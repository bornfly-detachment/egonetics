import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { FolderOpen, Check, ChevronDown, Cpu } from 'lucide-react'
import { authFetch } from '@/lib/http'
import '@xterm/xterm/css/xterm.css'

type ConnState = 'connecting' | 'ready' | 'closed' | 'error'

interface TierInfo {
  id: string
  label: string
  description: string
  color: string
  enabled: boolean
  not_ready_reason: string | null
  model_hint: string
}

interface FreeCodeTerminalProps {
  wsUrl?: string
}

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

const MIN_COLS = 40
const MIN_ROWS = 10

const RECENT_CWD_KEY = 'egonetics:free-code:recent-cwds'
const MAX_RECENT = 6

// Common workspaces — shown as quick picks at the top of the dropdown
const COMMON_CWDS: { label: string; path: string }[] = [
  { label: 'Home', path: '~' },
  { label: 'Desktop', path: '~/Desktop' },
  { label: 'claude_code_learn', path: '~/Desktop/claude_code_learn' },
  { label: 'egonetics', path: '~/Desktop/claude_code_learn/egonetics' },
  { label: 'free-code', path: '~/Desktop/claude_code_learn/free-code' },
  { label: 'SubjectiveEgoneticsAI', path: '~/Desktop/SubjectiveEgoneticsAI' },
]

function readRecentCwds(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_CWD_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function pushRecentCwd(cwd: string) {
  try {
    const list = readRecentCwds().filter((c) => c !== cwd)
    list.unshift(cwd)
    localStorage.setItem(RECENT_CWD_KEY, JSON.stringify(list.slice(0, MAX_RECENT)))
  } catch {}
}

function shortenPath(p: string): string {
  if (!p) return ''
  // Collapse home prefix
  const home = '/Users/bornfly'
  if (p.startsWith(home)) return '~' + p.slice(home.length)
  return p
}

export default function FreeCodeTerminal({ wsUrl }: FreeCodeTerminalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const [state, setState] = useState<ConnState>('connecting')
  const [cwd, setCwd] = useState<string>('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [recentCwds, setRecentCwds] = useState<string[]>(() => readRecentCwds())
  const [customPath, setCustomPath] = useState('')
  const pickerRef = useRef<HTMLDivElement | null>(null)

  // Tracks whether terminal viewport is pinned to the bottom
  const atBottomRef = useRef(true)
  // RAF write batching — prevents main-thread freeze on large PTY bursts
  const pendingWritesRef = useRef<string[]>([])
  const rafIdRef = useRef<number | null>(null)
  // Last captured selection — xterm may clear visual selection on live output,
  // but we keep a copy so Cmd+C still works after mouseup
  const lastSelectionRef = useRef('')

  // Tier state
  const [tiers, setTiers] = useState<TierInfo[]>([])
  const [currentTier, setCurrentTier] = useState<string>('T2')
  // Ref mirrors state so callbacks always see latest value without re-creation
  const currentTierRef = useRef<string>('T2')
  useEffect(() => {
    currentTierRef.current = currentTier
  }, [currentTier])

  // Derive initial cwd+tier from URL once on mount
  const initialCwdRef = useRef<string | undefined>(undefined)
  const initialTierRef = useRef<string | undefined>(undefined)
  if (initialCwdRef.current === undefined) {
    const params = new URLSearchParams(window.location.search)
    initialCwdRef.current = params.get('cwd') || undefined
    initialTierRef.current = params.get('tier') || undefined
  }

  // Fetch tier registry from backend once
  useEffect(() => {
    let cancelled = false
    authFetch<{ default_tier: string; tiers: TierInfo[] }>('/free-code/tiers')
      .then((data) => {
        if (cancelled) return
        setTiers(data.tiers || [])
        // Initialize tier: URL param > backend default > T2 fallback
        const initial = initialTierRef.current || data.default_tier || 'T2'
        setCurrentTier(initial)
      })
      .catch((err) => console.error('[FreeCodeTerminal] failed to fetch tiers:', err))
    return () => {
      cancelled = true
    }
  }, [])

  // Close picker on outside click / Esc
  useEffect(() => {
    if (!pickerOpen) return
    const onClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPickerOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [pickerOpen])

  // Main terminal + WS lifecycle
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
    term.focus()

    // Track viewport position so we can auto-scroll to bottom on new output
    // only when the user hasn't scrolled up to read history.
    term.onScroll(() => {
      const buf = term.buffer.active
      atBottomRef.current = buf.viewportY + term.rows >= buf.length
    })

    // Capture selection on mouseup directly on the container element.
    // term.onSelectionChange doesn't fire reliably in this xterm build.
    // xterm finalises its selection synchronously before mouseup bubbles,
    // so getSelection() at this point always returns the final text.
    // Poll selection during mouse drag — Ink's continuous screen redraws clear
    // xterm's selection between mousedown and mouseup, so we capture on every tick.
    let dragPollTimer: ReturnType<typeof setInterval> | null = null
    const onDragStart = () => {
      dragPollTimer = setInterval(() => {
        const sel = term.getSelection()
        if (sel) lastSelectionRef.current = sel
      }, 30)
    }
    const onDragEnd = () => {
      if (dragPollTimer) { clearInterval(dragPollTimer); dragPollTimer = null }
      // One final check right on mouseup
      const sel = term.getSelection()
      if (sel) lastSelectionRef.current = sel
    }
    containerRef.current.addEventListener('mousedown', onDragStart)
    containerRef.current.addEventListener('mouseup', onDragEnd)

    // ── Keyboard / clipboard integration ─────────────────────────────────
    // Cmd+C  → copy selection to clipboard (Mac); no SIGINT when text is selected
    // Cmd+V  → NOT intercepted: xterm's internal textarea receives the native
    //          paste event directly, fires onData, no clipboard permission needed
    // Ctrl+W/R/F/P/T/N → preventDefault so browser doesn't steal them; xterm
    //          still processes them and forwards the correct escape to the PTY
    term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      if (e.type !== 'keydown') return true

      console.log('[keyhandler]', e.key, 'meta:', e.metaKey, 'ctrl:', e.ctrlKey, 'lastSel:', JSON.stringify(lastSelectionRef.current))

      const isMac = navigator.platform.toUpperCase().includes('MAC')

      // Cmd+C: use lastSelectionRef — captured via onSelectionChange so it survives
      // live output clearing the visual selection before the key fires.
      if (isMac && e.metaKey && !e.ctrlKey && e.key === 'c') {
        const sel = lastSelectionRef.current
        if (sel) {
          navigator.clipboard.writeText(sel).catch(() => {})
          lastSelectionRef.current = ''
          return false
        }
        return true // nothing selected → Cmd+C passes through (no PTY effect on Mac)
      }

      // Reclaim Ctrl shortcuts stolen by the browser
      if (e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
        const key = e.key.toLowerCase()
        if (['w', 'r', 'f', 'p', 't', 'n'].includes(key)) {
          e.preventDefault()
          return true // xterm sends the escape sequence to PTY
        }
      }

      return true
    })

    termRef.current = term
    fitRef.current = fit

    // ── RAF write batcher ────────────────────────────────────────────────
    // Max bytes written per animation frame. Beyond this, remainder is
    // deferred to the next frame to avoid freezing the main thread.
    const MAX_FRAME_BYTES = 65536
    const flushWrites = () => {
      rafIdRef.current = null
      const chunks = pendingWritesRef.current
      if (chunks.length === 0) return
      pendingWritesRef.current = []

      const snap = atBottomRef.current
      const full = chunks.join('')
      // Use write callback to check selection AFTER xterm processes the chunk.
      // Checking before write races with in-flight mouse selection; after is accurate.
      // scrollToBottom() clears visual selection in xterm, so skip it when selected.
      if (full.length <= MAX_FRAME_BYTES) {
        term.write(full, () => {
          if (snap && !term.getSelection()) term.scrollToBottom()
        })
      } else {
        term.write(full.slice(0, MAX_FRAME_BYTES), () => {
          if (snap && !term.getSelection()) term.scrollToBottom()
        })
        pendingWritesRef.current.unshift(full.slice(MAX_FRAME_BYTES))
        rafIdRef.current = requestAnimationFrame(flushWrites)
      }
    }

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
          cwd: initialCwdRef.current,
          tier: initialTierRef.current || currentTierRef.current,
        }),
      )
    }

    ws.onmessage = (ev) => {
      let msg: {
        type: string
        data?: string
        code?: number
        error?: string
        cwd?: string
        tier?: { id: string; label: string }
      }
      try {
        msg = JSON.parse(ev.data)
      } catch {
        return
      }
      switch (msg.type) {
        case 'ready':
          setState('ready')
          if (msg.cwd) {
            setCwd(msg.cwd)
            pushRecentCwd(msg.cwd)
            setRecentCwds(readRecentCwds())
          }
          if (msg.tier?.id) {
            setCurrentTier(msg.tier.id)
          }
          break
        case 'output':
          if (msg.data) {
            pendingWritesRef.current.push(msg.data)
            if (rafIdRef.current === null) {
              rafIdRef.current = requestAnimationFrame(flushWrites)
            }
          }
          break
        case 'exit':
          term.writeln(`\r\n\x1b[90m[process exited code=${msg.code}]\x1b[0m`)
          setState('closed')
          break
        case 'error':
          term.writeln(`\r\n\x1b[31m[error] ${msg.error}\x1b[0m`)
          setState('error')
          break
        case 'pong':
          break
      }
    }

    ws.onclose = () => setState((s) => (s === 'error' ? s : 'closed'))
    ws.onerror = () => setState('error')

    // ── Heartbeat ────────────────────────────────────────────────────────
    // Sends a ping every 30 s. If the connection silently drops (tunnel,
    // NAT timeout, sleep/wake) the WS error/close handlers fire and the
    // status pill updates to Closed/Error — without this, it would stay
    // "Connected" forever.
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }))
      }
    }, 30_000)

    const sendInput = term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }))
      }
    })

    let resizeTimer: ReturnType<typeof setTimeout> | null = null
    const observer = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer)
      // Trailing-edge debounce: wait until resize stops, then do one reflow.
      // Firing on every pixel change floods the PTY with SIGWINCH and leaves
      // line-reflow debris in the scrollback.
      resizeTimer = setTimeout(() => {
        resizeTimer = null
        if (!fitRef.current || !termRef.current) return
        try {
          fitRef.current.fit()
          const cols = Math.max(MIN_COLS, termRef.current.cols)
          const rows = Math.max(MIN_ROWS, termRef.current.rows)
          // Clear scrollback debris from line reflow (Ink will redraw on SIGWINCH)
          termRef.current.write('\x1b[3J\x1b[H\x1b[2J')
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'resize', cols, rows }))
          }
        } catch {}
      }, 300)
    })
    observer.observe(containerRef.current)

    return () => {
      containerRef.current?.removeEventListener('mouseup', captureSelection)
      clearInterval(pingInterval)
      if (resizeTimer) clearTimeout(resizeTimer)
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current)
      pendingWritesRef.current = []
      observer.disconnect()
      sendInput.dispose()
      try { ws.close() } catch {}
      term.dispose()
      termRef.current = null
      fitRef.current = null
      wsRef.current = null
    }
  }, [wsUrl])

  const switchCwd = useCallback((newCwd: string) => {
    const term = termRef.current
    const ws = wsRef.current
    if (!term || !ws || ws.readyState !== WebSocket.OPEN) return
    term.clear()
    term.writeln(`\x1b[90m[switching workspace → ${newCwd}]\x1b[0m`)
    setState('connecting')
    ws.send(
      JSON.stringify({
        type: 'restart',
        cols: term.cols,
        rows: term.rows,
        cwd: newCwd,
        tier: currentTierRef.current,
      }),
    )
    setPickerOpen(false)
    setCustomPath('')
    // Update URL without reload so it can be bookmarked
    const url = new URL(window.location.href)
    url.searchParams.set('cwd', newCwd)
    window.history.replaceState({}, '', url.toString())
  }, [])

  const switchTier = useCallback((newTierId: string) => {
    if (newTierId === currentTierRef.current) return
    const term = termRef.current
    const ws = wsRef.current
    if (!term || !ws || ws.readyState !== WebSocket.OPEN) return
    term.clear()
    term.writeln(`\x1b[90m[switching tier → ${newTierId}]\x1b[0m`)
    setCurrentTier(newTierId)
    currentTierRef.current = newTierId
    setState('connecting')
    ws.send(
      JSON.stringify({
        type: 'restart',
        cols: term.cols,
        rows: term.rows,
        cwd: cwd || undefined,
        tier: newTierId,
      }),
    )
    // Update URL
    const url = new URL(window.location.href)
    url.searchParams.set('tier', newTierId)
    window.history.replaceState({}, '', url.toString())
  }, [cwd])

  const handleCustomSubmit = useCallback(() => {
    const trimmed = customPath.trim()
    if (trimmed) switchCwd(trimmed)
  }, [customPath, switchCwd])

  return (
    <div className="flex h-full w-full flex-col bg-[#0a0e1a] text-slate-200">
      {/* Title bar */}
      <div className="flex items-center justify-between border-b border-white/5 bg-gradient-to-r from-[#0f172a] via-[#0a0e1a] to-[#0f172a] px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          {/* Traffic lights */}
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="h-3 w-3 rounded-full bg-[#ff5f57] shadow-[0_0_8px_rgba(255,95,87,0.4)]" />
            <span className="h-3 w-3 rounded-full bg-[#febc2e] shadow-[0_0_8px_rgba(254,188,46,0.4)]" />
            <span className="h-3 w-3 rounded-full bg-[#28c840] shadow-[0_0_8px_rgba(40,200,64,0.4)]" />
          </div>
          <div className="flex min-w-0 items-baseline gap-2 font-mono text-[12px]">
            <span className="font-semibold tracking-wide text-slate-300">free-code</span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-500">TUI</span>
          </div>

          {/* Tier picker — segmented control */}
          <div className="ml-3 flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.02] p-0.5" role="radiogroup" aria-label="Model tier">
            <Cpu className="ml-1 h-3 w-3 text-slate-500" aria-hidden="true" />
            {tiers.map((tier) => (
              <TierButton
                key={tier.id}
                tier={tier}
                active={currentTier === tier.id}
                onSelect={() => switchTier(tier.id)}
              />
            ))}
          </div>

          {/* Workspace picker */}
          <div className="relative ml-3 min-w-0" ref={pickerRef}>
            <button
              type="button"
              onClick={() => setPickerOpen((v) => !v)}
              aria-label="Switch workspace directory"
              aria-expanded={pickerOpen}
              className="group flex min-w-0 items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 font-mono text-[11px] text-slate-300 transition-all duration-150 ease-out hover:border-blue-400/40 hover:bg-blue-400/[0.08] hover:text-blue-200 active:scale-[0.98]"
            >
              <FolderOpen className="h-3.5 w-3.5 flex-shrink-0 text-blue-400/80 group-hover:text-blue-300" aria-hidden="true" />
              <span className="max-w-[340px] truncate">{cwd ? shortenPath(cwd) : 'select workspace'}</span>
              <ChevronDown className={`h-3 w-3 flex-shrink-0 text-slate-500 transition-transform duration-150 ${pickerOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>

            {/* Dropdown */}
            {pickerOpen && (
              <div
                role="listbox"
                aria-label="Workspace directories"
                className="absolute left-0 top-[calc(100%+6px)] z-50 w-[380px] overflow-hidden rounded-lg border border-white/10 bg-[#0c1222]/95 shadow-[0_12px_48px_rgba(0,0,0,0.6)] backdrop-blur-xl"
              >
                {/* Common */}
                <div className="px-3 pb-1 pt-2.5">
                  <div className="font-mono text-[9px] font-semibold uppercase tracking-widest text-slate-500">
                    Common
                  </div>
                </div>
                <div className="pb-1.5">
                  {COMMON_CWDS.map((item) => (
                    <PickerItem
                      key={item.path}
                      label={item.label}
                      path={item.path}
                      active={cwd === item.path || shortenPath(cwd) === item.path}
                      onSelect={() => switchCwd(item.path)}
                    />
                  ))}
                </div>

                {/* Recent */}
                {recentCwds.length > 0 && (
                  <>
                    <div className="mx-3 h-px bg-white/5" />
                    <div className="px-3 pb-1 pt-2.5">
                      <div className="font-mono text-[9px] font-semibold uppercase tracking-widest text-slate-500">
                        Recent
                      </div>
                    </div>
                    <div className="pb-1.5">
                      {recentCwds.map((p) => (
                        <PickerItem
                          key={p}
                          path={shortenPath(p)}
                          active={cwd === p}
                          onSelect={() => switchCwd(p)}
                        />
                      ))}
                    </div>
                  </>
                )}

                {/* Custom path input */}
                <div className="border-t border-white/5 bg-black/30 p-2.5">
                  <label htmlFor="custom-cwd" className="block pb-1.5 font-mono text-[9px] font-semibold uppercase tracking-widest text-slate-500">
                    Custom path
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="custom-cwd"
                      type="text"
                      value={customPath}
                      onChange={(e) => setCustomPath(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCustomSubmit()
                      }}
                      placeholder="/path/to/workspace"
                      className="flex-1 rounded-md border border-white/10 bg-black/40 px-2.5 py-1.5 font-mono text-[11px] text-slate-200 placeholder:text-slate-600 focus:border-blue-400/60 focus:outline-none focus:ring-1 focus:ring-blue-400/30"
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <button
                      type="button"
                      onClick={handleCustomSubmit}
                      disabled={!customPath.trim()}
                      className="rounded-md border border-blue-400/40 bg-blue-400/10 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-blue-200 transition-all duration-150 ease-out hover:border-blue-400/70 hover:bg-blue-400/20 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Go
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <StatusPill state={state} />
          {(state === 'closed' || state === 'error') && (
            <button
              type="button"
              onClick={() => window.location.reload()}
              aria-label="Reconnect free-code terminal"
              className="rounded-md border border-white/10 bg-white/5 px-3 py-1 font-mono text-[11px] font-medium text-slate-200 transition-all duration-150 ease-out hover:border-blue-400/50 hover:bg-blue-400/10 hover:text-blue-300 active:scale-[0.98]"
            >
              Reconnect
            </button>
          )}
        </div>
      </div>

      {/* Terminal surface */}
      <div
        className="relative flex-1 overflow-hidden"
        style={{
          background:
            'radial-gradient(ellipse at center, #0c1220 0%, #070a14 100%)',
        }}
      >
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
          onClick={() => { if (!termRef.current?.getSelection()) termRef.current?.focus() }}
        />
      </div>
    </div>
  )
}

interface PickerItemProps {
  label?: string
  path: string
  active: boolean
  onSelect: () => void
}

function PickerItem({ label, path, active, onSelect }: PickerItemProps) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onClick={onSelect}
      className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left transition-colors duration-120 ease-out ${
        active
          ? 'bg-blue-400/10 text-blue-200'
          : 'text-slate-300 hover:bg-white/[0.04] hover:text-slate-100'
      }`}
    >
      <div className="flex min-w-0 flex-col">
        {label && (
          <span className="font-mono text-[11px] font-medium">{label}</span>
        )}
        <span className={`truncate font-mono text-[10px] ${label ? 'text-slate-500' : 'text-slate-300'}`}>
          {path}
        </span>
      </div>
      {active && <Check className="h-3.5 w-3.5 flex-shrink-0 text-blue-400" aria-hidden="true" />}
    </button>
  )
}

// Color maps must be static literals for Tailwind JIT
const TIER_ACTIVE_CLASSES: Record<string, string> = {
  emerald: 'bg-emerald-400/15 text-emerald-200 shadow-[0_0_10px_rgba(52,211,153,0.25)] ring-1 ring-emerald-400/40',
  sky:     'bg-sky-400/15 text-sky-200 shadow-[0_0_10px_rgba(56,189,248,0.25)] ring-1 ring-sky-400/40',
  violet:  'bg-violet-400/15 text-violet-200 shadow-[0_0_10px_rgba(167,139,250,0.25)] ring-1 ring-violet-400/40',
}
const TIER_INACTIVE_CLASSES: Record<string, string> = {
  emerald: 'text-slate-400 hover:bg-emerald-400/[0.06] hover:text-emerald-200',
  sky:     'text-slate-400 hover:bg-sky-400/[0.06] hover:text-sky-200',
  violet:  'text-slate-400 hover:bg-violet-400/[0.06] hover:text-violet-200',
}

function TierButton({
  tier,
  active,
  onSelect,
}: {
  tier: TierInfo
  active: boolean
  onSelect: () => void
}) {
  const activeClass = TIER_ACTIVE_CLASSES[tier.color] || TIER_ACTIVE_CLASSES.violet
  const inactiveClass = TIER_INACTIVE_CLASSES[tier.color] || TIER_INACTIVE_CLASSES.violet

  const title = tier.enabled
    ? `${tier.label} · ${tier.description}`
    : `${tier.label} (disabled): ${tier.not_ready_reason || 'unavailable'}`

  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-label={tier.label}
      disabled={!tier.enabled}
      title={title}
      onClick={() => tier.enabled && onSelect()}
      className={`rounded-sm px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider transition-all duration-150 ease-out active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? activeClass : inactiveClass
      }`}
    >
      {tier.id}
    </button>
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
