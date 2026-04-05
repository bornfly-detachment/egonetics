import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'

type ConnState = 'connecting' | 'ready' | 'closed' | 'error'

interface FreeCodeTerminalProps {
  wsUrl?: string
}

/**
 * Modern Dark Cinema theme for xterm.js —
 * aligned with Egonetics design language.
 */
const CINEMA_THEME = {
  background: '#0a0e1a',
  foreground: '#e2e8f0',
  cursor: '#60a5fa',
  cursorAccent: '#0a0e1a',
  selectionBackground: 'rgba(96, 165, 250, 0.35)',
  black: '#0f172a',
  red: '#f87171',
  green: '#4ade80',
  yellow: '#facc15',
  blue: '#60a5fa',
  magenta: '#c084fc',
  cyan: '#22d3ee',
  white: '#e2e8f0',
  brightBlack: '#475569',
  brightRed: '#fca5a5',
  brightGreen: '#86efac',
  brightYellow: '#fde68a',
  brightBlue: '#93c5fd',
  brightMagenta: '#d8b4fe',
  brightCyan: '#67e8f9',
  brightWhite: '#f8fafc',
} as const

export default function FreeCodeTerminal({ wsUrl }: FreeCodeTerminalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const [state, setState] = useState<ConnState>('connecting')

  useEffect(() => {
    if (!containerRef.current) return

    const term = new Terminal({
      fontFamily:
        '"JetBrains Mono", "SF Mono", "Fira Code", ui-monospace, Menlo, Monaco, Consolas, monospace',
      fontSize: 13,
      lineHeight: 1.35,
      letterSpacing: 0,
      cursorBlink: true,
      cursorStyle: 'bar',
      cursorWidth: 2,
      scrollback: 10000,
      allowProposedApi: true,
      smoothScrollDuration: 120,
      theme: CINEMA_THEME,
    })

    const fit = new FitAddon()
    term.loadAddon(fit)
    term.loadAddon(new WebLinksAddon())
    term.open(containerRef.current)
    fit.fit()

    termRef.current = term
    fitRef.current = fit

    const resolvedUrl =
      wsUrl ||
      `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/free-code`
    const ws = new WebSocket(resolvedUrl)
    wsRef.current = ws

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: 'start',
          cols: term.cols,
          rows: term.rows,
        }),
      )
    }

    ws.onmessage = (ev) => {
      let msg: { type: string; data?: string; code?: number; error?: string }
      try {
        msg = JSON.parse(ev.data)
      } catch {
        return
      }
      switch (msg.type) {
        case 'ready':
          setState('ready')
          break
        case 'output':
          if (msg.data) term.write(msg.data)
          break
        case 'exit':
          term.writeln(`\r\n\x1b[90m[process exited code=${msg.code}]\x1b[0m`)
          setState('closed')
          break
        case 'error':
          term.writeln(`\r\n\x1b[31m[error] ${msg.error}\x1b[0m`)
          setState('error')
          break
      }
    }

    ws.onclose = () => setState((s) => (s === 'error' ? s : 'closed'))
    ws.onerror = () => setState('error')

    const sendInput = term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }))
      }
    })

    const observer = new ResizeObserver(() => {
      if (!fitRef.current || !termRef.current) return
      try {
        fitRef.current.fit()
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: 'resize',
              cols: termRef.current.cols,
              rows: termRef.current.rows,
            }),
          )
        }
      } catch {}
    })
    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
      sendInput.dispose()
      try { ws.close() } catch {}
      term.dispose()
      termRef.current = null
      fitRef.current = null
      wsRef.current = null
    }
  }, [wsUrl])

  const reconnect = () => {
    window.location.reload()
  }

  return (
    <div className="flex h-full w-full flex-col bg-[#0a0e1a] text-slate-200">
      {/* Title bar — Modern Dark Cinema header */}
      <div className="flex items-center justify-between border-b border-white/5 bg-gradient-to-r from-[#0f172a] via-[#0a0e1a] to-[#0f172a] px-4 py-2.5">
        <div className="flex items-center gap-3">
          {/* Traffic lights — visual cue, not functional */}
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="h-3 w-3 rounded-full bg-[#ff5f57] shadow-[0_0_8px_rgba(255,95,87,0.4)]" />
            <span className="h-3 w-3 rounded-full bg-[#febc2e] shadow-[0_0_8px_rgba(254,188,46,0.4)]" />
            <span className="h-3 w-3 rounded-full bg-[#28c840] shadow-[0_0_8px_rgba(40,200,64,0.4)]" />
          </div>
          <div className="flex items-baseline gap-2 font-mono text-[12px]">
            <span className="font-semibold tracking-wide text-slate-300">free-code</span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-500">TUI</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <StatusPill state={state} />
          {state !== 'ready' && state !== 'connecting' && (
            <button
              type="button"
              onClick={reconnect}
              aria-label="Reconnect free-code terminal"
              className="rounded-md border border-white/10 bg-white/5 px-3 py-1 font-mono text-[11px] font-medium text-slate-200 transition-all duration-150 ease-out hover:border-blue-400/50 hover:bg-blue-400/10 hover:text-blue-300 active:scale-[0.98]"
            >
              Reconnect
            </button>
          )}
        </div>
      </div>

      {/* Terminal surface — cinematic gradient vignette */}
      <div
        className="relative flex-1 overflow-hidden"
        style={{
          background:
            'radial-gradient(ellipse at center, #0c1220 0%, #070a14 100%)',
        }}
      >
        {/* Subtle top glow — implies depth without distraction */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(96,165,250,0.3), transparent)',
          }}
        />
        <div
          ref={containerRef}
          className="h-full w-full px-4 py-3"
          role="application"
          aria-label="free-code interactive terminal"
        />
      </div>
    </div>
  )
}

function StatusPill({ state }: { state: ConnState }) {
  const config = {
    connecting: {
      label: 'Connecting',
      dot: 'bg-amber-400 animate-pulse',
      text: 'text-amber-300',
      ring: 'ring-amber-400/20',
    },
    ready: {
      label: 'Connected',
      dot: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]',
      text: 'text-emerald-300',
      ring: 'ring-emerald-400/20',
    },
    closed: {
      label: 'Closed',
      dot: 'bg-slate-500',
      text: 'text-slate-400',
      ring: 'ring-slate-500/20',
    },
    error: {
      label: 'Error',
      dot: 'bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.6)]',
      text: 'text-rose-300',
      ring: 'ring-rose-400/20',
    },
  }[state]

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center gap-2 rounded-full bg-white/[0.03] px-2.5 py-1 ring-1 ${config.ring}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} aria-hidden="true" />
      <span className={`font-mono text-[10px] font-medium uppercase tracking-wider ${config.text}`}>
        {config.label}
      </span>
    </div>
  )
}
