/**
 * EmbeddedTerminal — compact xterm+WS terminal for embedding in panels
 *
 * Props:
 *   tierId  — T0 | T1 | T2, forwarded to WS 'start' message
 *   height  — pixel height of terminal viewport (default 220)
 *
 * Design: same CINEMA_THEME as FreeCodeTerminal, no chrome/header.
 * On tierId change the component unmounts + remounts (key-driven by parent).
 */

import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

// ── Theme (matches FreeCodeTerminal) ─────────────────────────────────

const CINEMA_THEME = {
  background:          '#060810',
  foreground:          '#e2e8f0',
  cursor:              '#60a5fa',
  cursorAccent:        '#060810',
  selectionBackground: 'rgba(96,165,250,0.25)',
  black:        '#0f172a',
  red:          '#f87171',
  green:        '#4ade80',
  yellow:       '#facc15',
  blue:         '#60a5fa',
  magenta:      '#c084fc',
  cyan:         '#22d3ee',
  white:        '#e2e8f0',
  brightBlack:  '#475569',
  brightRed:    '#fca5a5',
  brightGreen:  '#86efac',
  brightYellow: '#fde68a',
  brightBlue:   '#93c5fd',
  brightMagenta:'#d8b4fe',
  brightCyan:   '#67e8f9',
  brightWhite:  '#f8fafc',
} as const

const MIN_COLS = 30
const MIN_ROWS = 6

// ── Component ─────────────────────────────────────────────────────────

interface EmbeddedTerminalProps {
  tierId: string
  height?: number
}

export default function EmbeddedTerminal({ tierId, height = 220 }: EmbeddedTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Plain objects (not state/refs) — local to this effect lifetime
    let rafId: number | null = null
    let resizeTimer: ReturnType<typeof setTimeout> | null = null
    const atBottom   = { current: true }
    const isReady    = { current: false }
    const pending: string[] = []

    // ── xterm init ─────────────────────────────────────────────────────
    const term = new Terminal({
      fontFamily:    '"JetBrains Mono","SF Mono",ui-monospace,monospace',
      fontSize:      12,
      lineHeight:    1.3,
      cursorBlink:   true,
      cursorStyle:   'bar',
      cursorWidth:   2,
      scrollback:    5000,
      allowProposedApi: true,
      theme: CINEMA_THEME,
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(containerRef.current)
    fit.fit()
    term.focus()

    term.onScroll(() => {
      const buf = term.buffer.active
      atBottom.current = buf.viewportY + term.rows >= buf.length
    })

    // ── RAF write batcher ──────────────────────────────────────────────
    const MAX_FRAME = 65536
    const flushWrites = () => {
      rafId = null
      const chunks = pending.splice(0)
      if (!chunks.length) return
      const snap = atBottom.current
      const full = chunks.join('')
      if (full.length <= MAX_FRAME) {
        term.write(full, () => { if (snap && !term.getSelection()) term.scrollToBottom() })
      } else {
        term.write(full.slice(0, MAX_FRAME), () => { if (snap && !term.getSelection()) term.scrollToBottom() })
        pending.unshift(full.slice(MAX_FRAME))
        rafId = requestAnimationFrame(flushWrites)
      }
    }

    // ── WebSocket ─────────────────────────────────────────────────────
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${wsProto}//${window.location.host}/ws/free-code`)

    ws.onopen = () => {
      isReady.current = false
      ws.send(JSON.stringify({ type: 'start', cols: term.cols, rows: term.rows, tier: tierId }))
    }

    ws.onmessage = (ev) => {
      let msg: { type: string; data?: string; code?: number; error?: string }
      try { msg = JSON.parse(ev.data as string) } catch { return }
      switch (msg.type) {
        case 'ready':
          isReady.current = true
          break
        case 'output':
          if (msg.data) {
            pending.push(msg.data)
            if (rafId === null) rafId = requestAnimationFrame(flushWrites)
          }
          break
        case 'exit':
          term.writeln(`\r\n\x1b[90m[exited ${msg.code}]\x1b[0m`)
          break
        case 'error':
          term.writeln(`\r\n\x1b[31m[error] ${msg.error}\x1b[0m`)
          break
      }
    }

    ws.onclose = () => term.writeln('\r\n\x1b[90m[disconnected]\x1b[0m')
    ws.onerror = () => term.writeln('\r\n\x1b[31m[ws error]\x1b[0m')

    // Heartbeat — keep connection alive through NAT timeouts
    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }))
    }, 30_000)

    // Input gate — matches isReadyRef pattern from FreeCodeTerminal
    const inputDisposable = term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN && isReady.current) {
        ws.send(JSON.stringify({ type: 'input', data }))
      }
    })

    // Resize observer — debounced, matches FreeCodeTerminal pattern
    const observer = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        resizeTimer = null
        try {
          fit.fit()
          const cols = Math.max(MIN_COLS, term.cols)
          const rows = Math.max(MIN_ROWS, term.rows)
          term.write('\x1b[3J\x1b[H\x1b[2J')
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'resize', cols, rows }))
          }
        } catch { /* fit may throw if element already detached */ }
      }, 300)
    })
    observer.observe(containerRef.current)

    return () => {
      clearInterval(ping)
      if (resizeTimer) clearTimeout(resizeTimer)
      if (rafId !== null) cancelAnimationFrame(rafId)
      observer.disconnect()
      inputDisposable.dispose()
      try { ws.close() } catch { /* ignore */ }
      term.dispose()
    }
  }, [tierId])

  return (
    <div
      ref={containerRef}
      style={{ height, background: '#060810' }}
      className="w-full"
    />
  )
}
