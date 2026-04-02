/**
 * KernelOverlay — Kernel Runtime state overlay on PrvseWorld
 *
 * Floating panel showing live kernel state:
 *   - Tick counter + convergence status
 *   - Active nodes with values
 *   - Contract list with fitness
 *   - Recent effects stream
 *
 * Polls kernel state every 2s when visible.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Activity, ChevronDown, ChevronRight, Wifi, WifiOff,
  Play, RotateCcw, EyeOff,
} from 'lucide-react'
import { authFetch } from '@/lib/http'

interface KernelNode {
  nodeId: string
  patternVersion: string
  values: Record<string, unknown>
}

interface KernelContract {
  id: string
  type: string
  priority: number
  participants: string[]
}

interface KernelState {
  tick: number
  nodes: Record<string, KernelNode>
  contracts: KernelContract[]
}

interface ServerEffect {
  type: string
  nodeId?: string
  _tick?: number
  changes?: { field: string; prev: unknown; next: unknown }[]
  conflict?: { reason: string }
  entry?: { event: string }
  portId?: string
  value?: unknown
}

export default function KernelOverlay() {
  const [visible, setVisible] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const [state, setState] = useState<KernelState | null>(null)
  const [effects, setEffects] = useState<ServerEffect[]>([])
  const [connected, setConnected] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const poll = useCallback(async () => {
    try {
      const [s, fx] = await Promise.all([
        authFetch<KernelState>('/kernel/state'),
        authFetch<ServerEffect[]>('/kernel/effects?limit=10'),
      ])
      setState(s)
      setEffects(fx)
      setConnected(true)
    } catch {
      setConnected(false)
    }
  }, [])

  // Start/stop polling when visible
  useEffect(() => {
    if (!visible) {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
      return
    }
    poll()
    intervalRef.current = setInterval(poll, 2000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [visible, poll])

  const doTick = useCallback(async () => {
    try {
      await authFetch('/kernel/tick', { method: 'POST' })
      await poll()
    } catch { /* ignore */ }
  }, [poll])

  const doReset = useCallback(async () => {
    try {
      await authFetch('/kernel/reset', { method: 'POST' })
      await poll()
    } catch { /* ignore */ }
  }, [poll])

  // Toggle button (always visible)
  if (!visible) {
    return (
      <button
        onClick={() => setVisible(true)}
        className="absolute top-4 right-4 z-20 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/50 backdrop-blur-sm border border-white/[0.08] text-[10px] text-white/40 hover:text-white/70 hover:border-white/20 transition-all"
      >
        <Activity size={10} />
        <span className="font-mono">Kernel</span>
      </button>
    )
  }

  const nodeCount = state ? Object.keys(state.nodes).length : 0
  const contractCount = state?.contracts.length ?? 0

  return (
    <div className="absolute top-4 right-4 z-20 w-64 max-h-[calc(100%-2rem)] flex flex-col rounded-xl bg-black/70 backdrop-blur-md border border-white/[0.08] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06]">
        <Activity size={10} className="text-violet-400 shrink-0" />
        <span className="text-[10px] font-bold text-white/70 flex-1">Kernel Runtime</span>

        {connected ? (
          <Wifi size={9} className="text-emerald-400" />
        ) : (
          <WifiOff size={9} className="text-red-400" />
        )}

        <button onClick={() => setExpanded(!expanded)} className="text-white/30 hover:text-white/60">
          {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        </button>

        <button onClick={() => setVisible(false)} className="text-white/30 hover:text-white/60">
          <EyeOff size={10} />
        </button>
      </div>

      {expanded && (
        <>
          {/* Stats row */}
          <div className="flex items-center gap-3 px-3 py-1.5 border-b border-white/[0.04] text-[9px] font-mono text-white/50">
            <span>tick:<span className="text-violet-400 font-bold">{state?.tick ?? 0}</span></span>
            <span>nodes:<span className="text-cyan-400">{nodeCount}</span></span>
            <span>contracts:<span className="text-amber-400">{contractCount}</span></span>
          </div>

          {/* Nodes */}
          {state && nodeCount > 0 && (
            <div className="px-3 py-2 border-b border-white/[0.04] space-y-1.5">
              <div className="text-[8px] text-white/25 uppercase tracking-widest">Nodes</div>
              {Object.entries(state.nodes).map(([id, node]) => {
                const nodeColors: Record<string, string> = {
                  perception: '#60a5fa', evaluator: '#a78bfa',
                  controller: '#f59e0b', recorder: '#34d399', sensor: '#06b6d4',
                }
                const color = nodeColors[id] ?? '#6b7280'
                return (
                  <div key={id} className="flex items-start gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full mt-1 shrink-0" style={{ background: color }} />
                    <div className="flex-1 min-w-0">
                      <span className="text-[9px] font-mono font-bold" style={{ color }}>{id}</span>
                      <div className="flex flex-wrap gap-x-2 text-[8px] text-white/40 font-mono">
                        {Object.entries(node.values).slice(0, 4).map(([k, v]) => (
                          <span key={k}>{k}:{String(v)}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Contracts */}
          {state && contractCount > 0 && (
            <div className="px-3 py-2 border-b border-white/[0.04] space-y-0.5">
              <div className="text-[8px] text-white/25 uppercase tracking-widest">Contracts</div>
              {state.contracts.slice(0, 5).map(c => (
                <div key={c.id} className="flex items-center gap-1.5 text-[8px] font-mono text-white/40">
                  <div className="w-1 h-1 rounded-full bg-amber-400/50" />
                  <span className="truncate flex-1">{c.id}</span>
                  <span className="text-white/20">p:{c.priority}</span>
                </div>
              ))}
              {contractCount > 5 && (
                <div className="text-[8px] text-white/15 text-center">+{contractCount - 5} more</div>
              )}
            </div>
          )}

          {/* Effects stream */}
          {effects.length > 0 && (
            <div className="px-3 py-2 border-b border-white/[0.04] space-y-0.5 max-h-28 overflow-y-auto">
              <div className="text-[8px] text-white/25 uppercase tracking-widest">Effects</div>
              {effects.map((e, i) => {
                const color = e.type === 'render' ? '#60a5fa' : e.type === 'alert' ? '#ef4444' : e.type === 'trigger' ? '#f59e0b' : '#34d399'
                return (
                  <div key={i} className="flex items-center gap-1 text-[8px] font-mono">
                    <span className="px-0.5 rounded" style={{ color, background: color + '15' }}>{e.type}</span>
                    {e.nodeId && <span className="text-white/30 truncate">{e.nodeId}</span>}
                    {e._tick != null && <span className="text-white/15 ml-auto">t:{e._tick}</span>}
                  </div>
                )
              })}
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center gap-1.5 px-3 py-2">
            <button onClick={doTick}
              className="flex items-center gap-1 px-2 py-1 rounded border border-violet-500/30 text-violet-400/70 hover:bg-violet-500/10 text-[9px] font-mono transition-colors">
              <Play size={8} /> tick
            </button>
            <button onClick={doReset}
              className="p-1 rounded border border-white/10 text-white/30 hover:text-white/60 transition-colors">
              <RotateCcw size={8} />
            </button>
            <span className="flex-1" />
            {!connected && <span className="text-[8px] text-red-400/50">offline</span>}
          </div>
        </>
      )}
    </div>
  )
}
