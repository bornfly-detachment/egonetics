/**
 * ExecutionConsole — Manus/Perplexity-style Execution Visualization
 *
 * Shows:
 *   - Step-by-step execution timeline with status indicators
 *   - Tier escalation chain (T0→T1→T2→Human) with visual progression
 *   - Decision panel for human-in-the-loop approval/rejection
 *   - Live polling when a run is active
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Play, ChevronRight, ChevronDown, CheckCircle2,
  XCircle, AlertTriangle, Zap, User, Bot,
  ArrowUpRight, Loader, RefreshCw,
} from 'lucide-react'
import { authFetch } from '@/lib/http'

// ── Types ─────────────────────────────────────────────────────

interface ExecStep {
  tier: string
  action?: string
  message?: string
  success?: boolean
  at: string
}

interface Escalation {
  from_tier: string
  to_tier: string
  reason: string
  at: string
}

interface ExecutionRun {
  id: string
  task_id: string
  status: 'running' | 'escalated' | 'completed' | 'failed'
  current_tier: string
  steps: ExecStep[]
  api_calls: number
  escalations: Escalation[]
  result: unknown
  created_at: string
  updated_at: string
}

interface Decision {
  id: string
  run_id: string
  type: string
  status: 'pending' | 'approved' | 'rejected' | 'deferred'
  context: {
    task_id?: string
    reason?: string
    last_steps?: ExecStep[]
  }
  options: string[] | null
  human_response: unknown
  created_at: string
}

// ── Tier Visual Config ────────────────────────────────────────

const TIERS: Record<string, { label: string; color: string; icon: typeof Bot }> = {
  T0: { label: 'T0 · Qwen', color: '#60a5fa', icon: Bot },
  T1: { label: 'T1 · MiniMax', color: '#a78bfa', icon: Bot },
  T2: { label: 'T2 · Claude', color: '#f59e0b', icon: Bot },
  human: { label: 'Human', color: '#ef4444', icon: User },
}

const STATUS_STYLE: Record<string, { label: string; color: string }> = {
  running: { label: '执行中', color: '#60a5fa' },
  escalated: { label: '待裁决', color: '#f59e0b' },
  completed: { label: '已完成', color: '#34d399' },
  failed: { label: '已失败', color: '#ef4444' },
}

// ── Sub-components ────────────────────────────────────────────

function TierProgressBar({ currentTier, escalations }: { currentTier: string; escalations: Escalation[] }) {
  const tiers = ['T0', 'T1', 'T2', 'human']
  const currentIdx = tiers.indexOf(currentTier)

  return (
    <div className="flex items-center gap-1">
      {tiers.map((tier, i) => {
        const cfg = TIERS[tier]
        const isActive = i === currentIdx
        const isPast = i < currentIdx
        const escalation = escalations.find(e => e.to_tier === tier)
        return (
          <div key={tier} className="flex items-center gap-1">
            {i > 0 && (
              <div
                className="w-6 h-px"
                style={{ background: isPast || isActive ? cfg.color : 'rgba(255,255,255,0.08)' }}
              />
            )}
            <div
              className="relative flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-mono border transition-all"
              style={{
                borderColor: isActive ? cfg.color + '60' : isPast ? cfg.color + '30' : 'rgba(255,255,255,0.06)',
                background: isActive ? cfg.color + '15' : 'transparent',
                color: isActive ? cfg.color : isPast ? cfg.color + '80' : 'rgba(255,255,255,0.2)',
              }}
            >
              {isActive && <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: cfg.color }} />}
              {isPast && <CheckCircle2 size={8} style={{ color: cfg.color }} />}
              {cfg.label}
              {escalation && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[7px] text-white/20 whitespace-nowrap">
                  {escalation.reason.slice(0, 20)}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StepTimeline({ steps }: { steps: ExecStep[] }) {
  if (steps.length === 0) return null

  return (
    <div className="space-y-0.5 max-h-48 overflow-y-auto pr-1">
      {steps.map((step, i) => {
        const tierCfg = TIERS[step.tier] ?? TIERS.T0
        const isLast = i === steps.length - 1
        return (
          <div key={i} className="flex items-start gap-2 group">
            {/* Timeline line + dot */}
            <div className="flex flex-col items-center shrink-0 w-3">
              <div
                className="w-2 h-2 rounded-full border shrink-0"
                style={{
                  borderColor: step.success === false ? '#ef4444' : step.success === true ? '#34d399' : tierCfg.color,
                  background: step.success === false ? '#ef444430' : step.success === true ? '#34d39930' : tierCfg.color + '30',
                }}
              />
              {!isLast && <div className="w-px flex-1 min-h-[12px] bg-white/[0.06]" />}
            </div>

            {/* Step content */}
            <div className="flex-1 min-w-0 pb-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[8px] font-mono px-1 rounded" style={{ color: tierCfg.color, background: tierCfg.color + '15' }}>
                  {step.tier}
                </span>
                {step.action && (
                  <span className="text-[9px] text-white/50 font-mono truncate">{step.action}</span>
                )}
                {step.success === true && <CheckCircle2 size={8} className="text-emerald-400 shrink-0" />}
                {step.success === false && <XCircle size={8} className="text-red-400 shrink-0" />}
                <span className="text-[7px] text-white/15 ml-auto shrink-0">
                  {new Date(step.at).toLocaleTimeString('zh', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
              {step.message && (
                <div className="text-[8px] text-white/30 mt-0.5 truncate">{step.message}</div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DecisionPanel({
  decision,
  onRespond,
}: {
  decision: Decision
  onRespond: (id: string, status: string) => void
}) {
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-3 space-y-2">
      <div className="flex items-center gap-2">
        <AlertTriangle size={12} className="text-amber-400" />
        <span className="text-[11px] font-bold text-amber-400">需要人工裁决</span>
        <span className="text-[8px] text-white/20 ml-auto">{decision.type}</span>
      </div>

      {decision.context.reason && (
        <div className="text-[10px] text-white/50 leading-relaxed">
          {decision.context.reason}
        </div>
      )}

      {decision.context.last_steps && decision.context.last_steps.length > 0 && (
        <div className="text-[8px] text-white/25 border-t border-white/[0.06] pt-1.5 mt-1.5">
          最近 {decision.context.last_steps.length} 步:
          {decision.context.last_steps.map((s, i) => (
            <span key={i} className="ml-1">
              [{s.tier}] {s.action ?? ''}
              {s.success === false ? ' ✗' : s.success === true ? ' ✓' : ''}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        {(decision.options ?? ['approved', 'rejected']).map(opt => {
          const isApprove = opt === 'approved' || opt === 'retry_t2'
          const isReject = opt === 'rejected' || opt === 'abort'
          return (
            <button
              key={opt}
              onClick={() => onRespond(decision.id, isApprove ? 'approved' : isReject ? 'rejected' : 'deferred')}
              className={`px-3 py-1.5 rounded text-[10px] font-mono border transition-all ${
                isApprove
                  ? 'border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10'
                  : isReject
                    ? 'border-red-500/40 text-red-400 hover:bg-red-500/10'
                    : 'border-white/10 text-white/40 hover:bg-white/5'
              }`}
            >
              {opt === 'approved' ? '✓ 批准' : opt === 'rejected' ? '✗ 拒绝' :
               opt === 'retry_t2' ? '↻ 重试 T2' : opt === 'abort' ? '⛔ 终止' :
               opt === 'manual_fix' ? '🔧 手动修复' : opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────

interface ExecutionConsoleProps {
  taskId: string
}

export default function ExecutionConsole({ taskId }: ExecutionConsoleProps) {
  const [runs, setRuns] = useState<ExecutionRun[]>([])
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(true)
  const [creating, setCreating] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [r, d] = await Promise.all([
        authFetch<ExecutionRun[]>(`/kernel/executions?task_id=${encodeURIComponent(taskId)}`),
        authFetch<Decision[]>('/kernel/decisions?status=pending'),
      ])
      setRuns(r)
      setDecisions(d.filter(dec => {
        // Only show decisions for this task's runs
        return r.some(run => run.id === dec.run_id)
      }))
    } catch { /* ignore */ }
    setLoading(false)
  }, [taskId])

  // Initial load + poll active runs
  useEffect(() => {
    loadData()
    pollRef.current = setInterval(loadData, 3000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [loadData])

  // Stop polling if no active runs
  useEffect(() => {
    const hasActive = runs.some(r => r.status === 'running' || r.status === 'escalated')
    if (!hasActive && pollRef.current && !loading) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [runs, loading])

  const startRun = useCallback(async () => {
    setCreating(true)
    try {
      await authFetch('/kernel/executions', {
        method: 'POST',
        body: JSON.stringify({ task_id: taskId }),
      })
      await loadData()
    } catch { /* ignore */ }
    setCreating(false)
  }, [taskId, loadData])

  const respondDecision = useCallback(async (decId: string, status: string) => {
    try {
      await authFetch(`/kernel/decisions/${decId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      await loadData()
    } catch { /* ignore */ }
  }, [loadData])

  if (loading) return null

  // No runs yet — show start button
  if (runs.length === 0) {
    return (
      <div className="border-t border-white/[0.06] bg-[#0f0f0f]">
        <button
          onClick={startRun}
          disabled={creating}
          className="flex items-center gap-2 w-full px-4 py-3 text-[11px] text-white/40 hover:text-white/60 hover:bg-white/[0.02] transition-colors"
        >
          {creating ? <Loader size={12} className="animate-spin" /> : <Play size={12} />}
          <span className="font-mono">启动 Kernel 执行引擎</span>
        </button>
      </div>
    )
  }

  const latestRun = runs[0]
  const statusCfg = STATUS_STYLE[latestRun.status] ?? STATUS_STYLE.running
  const pendingDecisions = decisions.filter(d => d.run_id === latestRun.id)

  return (
    <div className="border-t border-white/[0.06] bg-[#0c0c0c]">
      {/* Console header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-4 py-2.5 hover:bg-white/[0.02] transition-colors"
      >
        {expanded ? <ChevronDown size={10} className="text-white/30" /> : <ChevronRight size={10} className="text-white/30" />}
        <Zap size={10} style={{ color: statusCfg.color }} />
        <span className="text-[10px] font-bold text-white/60">执行引擎</span>
        <span
          className="text-[9px] font-mono px-1.5 py-0.5 rounded border"
          style={{ color: statusCfg.color, borderColor: statusCfg.color + '30', background: statusCfg.color + '10' }}
        >
          {statusCfg.label}
        </span>
        <span className="text-[8px] text-white/20 font-mono">{latestRun.api_calls} API calls</span>
        <span className="text-[8px] text-white/20 font-mono ml-auto">{latestRun.current_tier}</span>

        {latestRun.status === 'running' && (
          <Loader size={10} className="animate-spin text-blue-400" />
        )}
        {latestRun.status === 'escalated' && (
          <AlertTriangle size={10} className="text-amber-400" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-3">
          {/* Tier progression */}
          <TierProgressBar currentTier={latestRun.current_tier} escalations={latestRun.escalations} />

          {/* Step timeline */}
          <StepTimeline steps={latestRun.steps} />

          {/* Pending decisions */}
          {pendingDecisions.map(dec => (
            <DecisionPanel key={dec.id} decision={dec} onRespond={respondDecision} />
          ))}

          {/* Escalation history */}
          {latestRun.escalations.length > 0 && (
            <div className="space-y-1">
              <div className="text-[8px] text-white/20 uppercase tracking-widest">升级历史</div>
              {latestRun.escalations.map((esc, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[8px] font-mono text-white/30">
                  <ArrowUpRight size={8} className="text-amber-400/60" />
                  <span>{esc.from_tier}</span>
                  <span className="text-white/15">→</span>
                  <span>{esc.to_tier}</span>
                  <span className="text-white/15 truncate flex-1">{esc.reason}</span>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            {(latestRun.status === 'completed' || latestRun.status === 'failed') && (
              <button
                onClick={startRun}
                disabled={creating}
                className="flex items-center gap-1 px-2.5 py-1 rounded border border-white/10 text-[9px] text-white/40 hover:text-white/60 hover:border-white/20 font-mono transition-colors"
              >
                <RefreshCw size={8} /> 新执行
              </button>
            )}
            <span className="flex-1" />
            <span className="text-[7px] text-white/10 font-mono">
              {latestRun.id}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
