/**
 * LabView — Kernel Runtime 实时可视化（Server-side Kernel）
 *
 * 通过 REST API 与 server/lib/kernel-runtime.js 交互：
 *   左列 — Kernel 组件状态（GET /api/kernel/state）
 *   中列 — Tick 历史（POST /api/kernel/tick 结果）
 *   右列 — Observer Effects（GET /api/kernel/effects）
 *   底部 — 演化指标 + Tick 控制
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import {
  ChevronRight, RotateCcw, FlaskConical, Play, Pause,
  Activity, Zap, AlertTriangle, Clock, Wifi, WifiOff,
} from 'lucide-react'
import { authFetch } from '@/lib/http'

// ── Types (server response shapes) ────────────────────────────

interface KernelState {
  tick: number
  nodes: Record<string, { nodeId: string; patternVersion: string; values: Record<string, unknown> }>
  contracts: { id: string; type: string; priority: number; participants: string[] }[]
}

interface TickResult {
  tick: number
  converged: boolean
  rounds: number
  patchesApplied: number
  conflicts: number
  effects: number
  selectionActions: { op: string; contractId: string; reason?: string }[]
  fitnessRates: { contractId: string; fireRate: number; conflictRate: number; effectRate: number; age: number }[]
}

interface ServerEffect {
  type: string
  nodeId?: string
  changes?: { field: string; prev: unknown; next: unknown }[]
  conflict?: { reason: string }
  entry?: { event: string }
  portId?: string
  value?: unknown
  _tick?: number
}

// ── Sub-components ─────────────────────────────────────────────

function NodeCard({ id, values }: { id: string; values: Record<string, unknown> }) {
  const nodeColors: Record<string, string> = {
    perception: '#60a5fa', evaluator: '#a78bfa',
    controller: '#f59e0b', recorder: '#34d399', sensor: '#06b6d4',
  }
  const color = nodeColors[id] ?? '#6b7280'

  return (
    <div
      className="rounded-lg p-3 space-y-2 transition-all"
      style={{ background: '#0e1420', border: '1px solid rgba(255,255,255,0.08)', borderLeft: `2px solid ${color}80` }}
    >
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full" style={{ background: color }} />
        <span className="text-[11px] font-bold font-mono" style={{ color }}>{id}</span>
      </div>
      <div className="space-y-1">
        {Object.entries(values).map(([key, val]) => (
          <div key={key} className="flex items-center justify-between">
            <span className="text-[10px] text-white/30 font-mono">{key}</span>
            <span className="text-[10px] text-white/70 font-mono">{String(val)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function EffectLog({ effects }: { effects: ServerEffect[] }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-2 shrink-0">
        <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
        <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Observer Effects</span>
        <div className="flex-1 h-px bg-white/[0.06]" />
        <span className="text-[9px] text-white/25 font-mono">{effects.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto space-y-1 pr-1">
        {effects.map((e, i) => {
          const color = e.type === 'render' ? '#60a5fa' : e.type === 'alert' ? '#ef4444' : e.type === 'trigger' ? '#f59e0b' : '#34d399'
          return (
            <div key={i} className="rounded p-2 border border-white/[0.05] bg-white/[0.02] space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[8px] font-mono px-1 py-px rounded shrink-0"
                  style={{ color, background: color + '18', border: `1px solid ${color}35` }}>
                  {e.type}
                </span>
                {e.type === 'render' && e.nodeId && (
                  <span className="text-[9px] text-white/40 font-mono">{e.nodeId}</span>
                )}
                {e._tick != null && (
                  <span className="text-[8px] text-white/20 font-mono ml-auto">t:{e._tick}</span>
                )}
              </div>
              <div className="text-[9px] text-white/50 leading-snug font-mono">
                {e.type === 'render' && e.changes && `${e.changes.length} field(s) changed`}
                {e.type === 'alert' && e.conflict?.reason}
                {e.type === 'log' && e.entry?.event}
                {e.type === 'trigger' && `→ ${e.portId}: ${JSON.stringify(e.value)}`}
              </div>
            </div>
          )
        })}
        {effects.length === 0 && (
          <div className="text-[9px] text-white/15 text-center py-4">tick 运行后显示 effects</div>
        )}
      </div>
    </div>
  )
}

function FitnessPanel({ rates }: { rates: TickResult['fitnessRates'] }) {
  if (rates.length === 0) return null
  return (
    <div className="space-y-1">
      <div className="text-[9px] text-white/25 uppercase tracking-widest mb-1">Contract Fitness</div>
      {rates.map(r => {
        const healthColor = r.conflictRate > 0.3 ? '#ef4444' : r.effectRate > 0.5 ? '#34d399' : '#f59e0b'
        return (
          <div key={r.contractId} className="flex items-center gap-2 text-[9px]">
            <span className="font-mono text-white/50 w-28 truncate">{r.contractId}</span>
            <span className="text-white/25">fire:{(r.fireRate * 100).toFixed(0)}%</span>
            <span style={{ color: healthColor }}>eff:{(r.effectRate * 100).toFixed(0)}%</span>
            <span className={r.conflictRate > 0 ? 'text-red-400' : 'text-white/20'}>
              conf:{(r.conflictRate * 100).toFixed(0)}%
            </span>
            <span className="text-white/20">age:{r.age}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────

export default function LabView() {
  const [state, setState] = useState<KernelState | null>(null)
  const [history, setHistory] = useState<TickResult[]>([])
  const [effects, setEffects] = useState<ServerEffect[]>([])
  const [connected, setConnected] = useState(false)
  const [autoRun, setAutoRun] = useState(false)
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Port input state
  const [portId, setPortId] = useState('sensor')
  const [portValue, setPortValue] = useState('activate')

  const current = history.length > 0 ? history[history.length - 1] : null

  // Load initial state
  const loadState = useCallback(async () => {
    try {
      const s = await authFetch<KernelState>('/kernel/state')
      setState(s)
      setConnected(true)
    } catch {
      setConnected(false)
    }
  }, [])

  const loadEffects = useCallback(async () => {
    try {
      const fx = await authFetch<ServerEffect[]>('/kernel/effects?limit=100')
      setEffects(fx)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { loadState(); loadEffects() }, [])

  const doTick = useCallback(async () => {
    try {
      const result = await authFetch<TickResult>('/kernel/tick', { method: 'POST' })
      setHistory(prev => [...prev, result])
      await loadState()
      await loadEffects()
    } catch (err) {
      setConnected(false)
    }
  }, [loadState, loadEffects])

  const handleInject = useCallback(async () => {
    try {
      await authFetch(`/kernel/ports/${encodeURIComponent(portId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: isNaN(Number(portValue)) ? portValue : Number(portValue) }),
      })
    } catch { /* ignore */ }
  }, [portId, portValue])

  const handleReset = useCallback(async () => {
    if (autoRef.current) { clearInterval(autoRef.current); autoRef.current = null }
    setAutoRun(false)
    try {
      await authFetch('/kernel/reset', { method: 'POST' })
      setHistory([])
      setEffects([])
      await loadState()
    } catch { /* ignore */ }
  }, [loadState])

  const toggleAutoRun = useCallback(() => {
    if (autoRun) {
      if (autoRef.current) { clearInterval(autoRef.current); autoRef.current = null }
      setAutoRun(false)
    } else {
      setAutoRun(true)
      autoRef.current = setInterval(async () => {
        try {
          const result = await authFetch<TickResult>('/kernel/tick', { method: 'POST' })
          setHistory(prev => [...prev, result])
          const s = await authFetch<KernelState>('/kernel/state')
          setState(s)
          const fx = await authFetch<ServerEffect[]>('/kernel/effects?limit=100')
          setEffects(fx)
        } catch { /* ignore */ }
      }, 800)
    }
  }, [autoRun])

  return (
    <div className="h-screen flex flex-col bg-[#0d0d0d] overflow-hidden">

      {/* ── Top Bar ── */}
      <div className="shrink-0 flex items-center gap-3 px-5 py-2.5 border-b border-white/[0.06] bg-[#111]">
        <FlaskConical size={14} className="text-violet-400 shrink-0" />
        <div>
          <div className="text-[11px] font-bold text-white/80">Kernel Runtime Lab</div>
          <div className="text-[9px] text-white/30">Server-side PRVSE Kernel — REST API 驱动</div>
        </div>

        {/* Connection status */}
        <div className="flex items-center gap-1.5 ml-2">
          {connected ? (
            <><Wifi size={10} className="text-emerald-400" /><span className="text-[9px] text-emerald-400/60">connected</span></>
          ) : (
            <><WifiOff size={10} className="text-red-400" /><span className="text-[9px] text-red-400/60">offline</span></>
          )}
        </div>

        <div className="w-px h-8 bg-white/[0.08] mx-2" />

        {/* Tick info */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Clock size={10} className="text-white/30" />
            <span className="text-[11px] font-mono text-white/60">tick:{state?.tick ?? 0}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Activity size={10} className="text-white/30" />
            <span className="text-[11px] font-mono text-white/60">contracts:{state?.contracts.length ?? 0}</span>
          </div>
          {current && (
            <>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${current.converged ? 'text-emerald-400 bg-emerald-400/10 border border-emerald-400/20' : 'text-red-400 bg-red-400/10 border border-red-400/20'}`}>
                {current.converged ? 'converged' : 'diverged'}
              </span>
              <span className="text-[9px] text-white/25 font-mono">
                {current.rounds}r · {current.patchesApplied}p · {current.conflicts}c
              </span>
            </>
          )}
        </div>

        {/* Port injection */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[9px] text-white/30">Port:</span>
          <input value={portId} onChange={e => setPortId(e.target.value)}
            className="w-20 px-1.5 py-0.5 text-[10px] font-mono bg-white/[0.04] border border-white/10 rounded text-white/70"
            placeholder="portId" />
          <input value={portValue} onChange={e => setPortValue(e.target.value)}
            className="w-20 px-1.5 py-0.5 text-[10px] font-mono bg-white/[0.04] border border-white/10 rounded text-white/70"
            placeholder="value" />
          <button onClick={handleInject}
            className="px-2 py-0.5 text-[9px] font-mono rounded border border-cyan-500/30 text-cyan-400/70 hover:bg-cyan-500/10 transition-colors">
            inject
          </button>
        </div>
      </div>

      {/* ── Main: 3-column ── */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* Left: Node State */}
        <div className="w-56 shrink-0 border-r border-white/[0.05] p-3 overflow-y-auto space-y-2">
          <div className="text-[9px] text-white/25 uppercase tracking-widest mb-1">State Nodes</div>
          {state && Object.entries(state.nodes).map(([id, node]) => (
            <NodeCard key={id} id={id} values={node.values} />
          ))}
          {state && Object.keys(state.nodes).length === 0 && (
            <div className="text-[9px] text-white/15 text-center py-4">no nodes — add via API</div>
          )}

          {/* Fitness panel */}
          {current && current.fitnessRates.length > 0 && (
            <div className="mt-4 pt-3 border-t border-white/[0.06]">
              <FitnessPanel rates={current.fitnessRates} />
            </div>
          )}

          {/* Contracts list */}
          {state && state.contracts.length > 0 && (
            <div className="mt-4 pt-3 border-t border-white/[0.06]">
              <div className="text-[9px] text-white/25 uppercase tracking-widest mb-1">Contracts</div>
              {state.contracts.map(c => (
                <div key={c.id} className="text-[9px] font-mono text-white/40 py-0.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400/50" />
                  <span className="truncate">{c.id}</span>
                  <span className="text-white/20 ml-auto">p:{c.priority}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Center: Tick History */}
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="text-[9px] text-white/25 uppercase tracking-widest mb-3">
            Tick History
            <span className="ml-2 text-white/15 normal-case font-normal">{history.length} ticks recorded</span>
          </div>

          {history.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-white/15 text-sm">
              inject port data, then tick to start
            </div>
          ) : (
            <div className="space-y-2">
              {history.slice(-20).map((snap) => (
                <div key={snap.tick} className="rounded-lg p-3 border border-white/[0.05] bg-white/[0.015]">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-[11px] font-mono font-bold text-white/60">tick:{snap.tick}</span>
                    <span className={`text-[9px] font-mono px-1 rounded ${snap.converged ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                      {snap.converged ? 'converged' : 'DIVERGED'}
                    </span>
                    <span className="text-[9px] text-white/25 font-mono">{snap.rounds}r · {snap.patchesApplied}p</span>
                    {snap.conflicts > 0 && (
                      <span className="text-[9px] text-red-400 font-mono flex items-center gap-0.5">
                        <AlertTriangle size={9} /> {snap.conflicts} conflict(s)
                      </span>
                    )}
                    {snap.selectionActions.length > 0 && (
                      <span className="text-[9px] text-amber-400 font-mono flex items-center gap-0.5">
                        <Zap size={9} /> {snap.selectionActions.length} selection
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-violet-500/10 border border-violet-500/20 text-violet-300/70">
                      {snap.effects} effect(s)
                    </span>
                    {snap.selectionActions.filter(a => a.op === 'kill').map((a, i) => (
                      <span key={`kill-${i}`} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-300/70">
                        kill: {a.contractId}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Observer Effects */}
        <div className="w-64 shrink-0 border-l border-white/[0.05] p-3 flex flex-col overflow-hidden">
          <EffectLog effects={effects} />
        </div>
      </div>

      {/* ── Bottom Bar ── */}
      <div className="shrink-0 border-t border-white/[0.06] bg-[#0f0f0f]">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-white/30 uppercase tracking-widest">Ticks</span>
              <span className="text-[13px] font-mono font-bold text-violet-400">{history.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-white/30 uppercase tracking-widest">Total Patches</span>
              <span className="text-[13px] font-mono font-bold text-blue-400">
                {history.reduce((s, h) => s + h.patchesApplied, 0)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-white/30 uppercase tracking-widest">Conflicts</span>
              <span className="text-[13px] font-mono font-bold text-red-400">
                {history.reduce((s, h) => s + h.conflicts, 0)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-white/30 uppercase tracking-widest">Nodes</span>
              <span className="text-[13px] font-mono font-bold text-cyan-400">
                {state ? Object.keys(state.nodes).length : 0}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-white/30 uppercase tracking-widest">Contracts</span>
              <span className="text-[13px] font-mono font-bold text-amber-400">
                {state?.contracts.length ?? 0}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={handleReset}
              className="p-1.5 rounded border border-white/10 text-white/30 hover:text-white/60 hover:border-white/20 transition-all"
              title="Reset runtime">
              <RotateCcw size={12} />
            </button>
            <button onClick={toggleAutoRun}
              className={`px-3 py-1.5 rounded border text-[10px] font-mono transition-all ${
                autoRun ? 'border-amber-500/40 text-amber-400 bg-amber-500/10' : 'border-white/10 text-white/40 hover:text-white/60 hover:border-white/20'
              }`}>
              {autoRun ? <><Pause size={10} className="inline mr-1" />auto</> : <><Play size={10} className="inline mr-1" />auto</>}
            </button>
            <button onClick={async () => { await handleInject(); await doTick() }}
              className="px-4 py-1.5 rounded border border-violet-500/30 text-violet-400/80 hover:bg-violet-500/10 hover:text-violet-300 transition-all text-[11px] font-mono font-bold">
              <ChevronRight size={12} className="inline mr-1" />tick
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
