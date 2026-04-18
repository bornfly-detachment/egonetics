/**
 * ResourceStatusView — PRVSE 资源管理面板
 *
 * 实时显示：系统健康 / Tier 状态 / 队列 / Session 配额 / 调用日志
 * 数据来源：/api/resources/status + /api/resources/logs/summary
 */

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Activity, Cpu, HardDrive, Zap, Users, Clock, AlertTriangle } from 'lucide-react'
import { authFetch } from '@/lib/http'

interface TierStatus {
  alive: boolean
  model: string
  queue: { running: number; waiting: number; maxConcurrency: number }
  today: { calls: number; inputTokens: number; outputTokens: number; avgLatencyMs: number; errors: number } | null
}

interface ResourceStatus {
  health: number
  mustReclaim: boolean
  system: {
    ram: { totalMb: number; reclaimableMb: number; usedMb: number }
    swap: { totalMb: number; usedMb: number }
    pressure: { memory: number; swap: number; cpu: number }
  }
  tiers: { T0: TierStatus; T1: TierStatus; T2: TierStatus }
  sessions: { current: number; max: number; canCreate: boolean }
  queue: Record<string, { running: number; waiting: number; maxConcurrency: number }>
  orphans: number
  timestamp: number
}

interface CanonicalProjection {
  namingContract?: { aiLevels?: string[]; note?: string }
  statusVocabulary?: string[]
  modelResources?: unknown[]
  harnessResources?: unknown[]
  resourceBindings?: unknown[]
  runtimeTiers?: Array<{ id: string; providers?: string[]; hostConfigPresent?: boolean; legacyFreeCodeTierKey?: string | null }>
}

const TIER_COLORS: Record<string, string> = {
  T0: '#22c55e',
  T1: '#60a5fa',
  T2: '#c084fc',
}

function HealthBar({ value, label }: { value: number; label: string }) {
  const color = value > 50 ? '#22c55e' : value > 20 ? '#eab308' : '#ef4444'
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-white/50 w-12 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="text-xs font-mono w-8 text-right" style={{ color }}>{value}%</span>
    </div>
  )
}

function PressureBar({ value, label }: { value: number; label: string }) {
  const color = value < 60 ? '#22c55e' : value < 85 ? '#eab308' : '#ef4444'
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-white/50 w-12 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="text-xs font-mono w-8 text-right" style={{ color }}>{value}%</span>
    </div>
  )
}

function TierCard({ tier, status }: { tier: string; status: TierStatus }) {
  const color = TIER_COLORS[tier] || '#6b7280'
  const today = status.today
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: status.alive ? color : '#ef4444' }} />
          <span className="text-sm font-mono font-bold" style={{ color }}>{tier}</span>
          <span className="text-xs text-white/40">{status.model}</span>
        </div>
        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${status.alive ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'}`}>
          {status.alive ? 'ONLINE' : 'OFFLINE'}
        </span>
      </div>

      {/* Queue */}
      <div className="flex items-center gap-3 text-xs text-white/50">
        <Zap className="w-3 h-3" />
        <span>队列: {status.queue?.running || 0} 运行 / {status.queue?.waiting || 0} 等待 / 上限 {status.queue?.maxConcurrency || 0}</span>
      </div>

      {/* Today stats */}
      {today && (
        <div className="grid grid-cols-4 gap-2 text-xs">
          <div className="text-center">
            <div className="text-white/70 font-mono">{today.calls}</div>
            <div className="text-white/30">调用</div>
          </div>
          <div className="text-center">
            <div className="text-white/70 font-mono">{((today.inputTokens + today.outputTokens) / 1000).toFixed(1)}k</div>
            <div className="text-white/30">tokens</div>
          </div>
          <div className="text-center">
            <div className="text-white/70 font-mono">{today.avgLatencyMs}ms</div>
            <div className="text-white/30">avg</div>
          </div>
          <div className="text-center">
            <div className={`font-mono ${today.errors > 0 ? 'text-red-400' : 'text-white/70'}`}>{today.errors}</div>
            <div className="text-white/30">errors</div>
          </div>
        </div>
      )}
      {!today && <div className="text-xs text-white/25 italic">今日无调用</div>}
      {(status as any).note && <div className="text-[10px] text-amber-400/60">{(status as any).note}</div>}
    </div>
  )
}

export default function ResourceStatusView() {
  const [status, setStatus] = useState<ResourceStatus | null>(null)
  const [canonical, setCanonical] = useState<CanonicalProjection | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [data, canonicalData] = await Promise.allSettled([
        authFetch<ResourceStatus>('/resources/status'),
        authFetch<CanonicalProjection>('/resources/status/canonical'),
      ])

      if (data.status === 'fulfilled') setStatus(data.value)
      if (canonicalData.status === 'fulfilled') setCanonical(canonicalData.value)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, 30000) // 30s auto-refresh
    return () => clearInterval(timer)
  }, [refresh])

  return (
    <div className="min-h-full bg-[#0a0e1a] text-white p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-violet-400" />
          <h1 className="text-lg font-bold tracking-wide">PRVSE Resource Manager</h1>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="p-2 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-300">{error}</div>
      )}

      {canonical && (
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-cyan-200">Canonical Projection</span>
            <span className="text-xs text-cyan-300/70">
              {canonical.statusVocabulary?.length || 0} statuses · {canonical.modelResources?.length || 0} models · {canonical.harnessResources?.length || 0} harnesses
            </span>
          </div>
          <div className="text-xs text-cyan-100/70">
            {canonical.namingContract?.note || 'canonical projection loaded'}
          </div>
          {canonical.runtimeTiers?.[0] && (
            <div className="text-xs text-cyan-100/70">
              runtime tier {canonical.runtimeTiers[0].id} → providers: {(canonical.runtimeTiers[0].providers || []).join(', ')}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg border border-cyan-500/10 bg-black/10 p-3 space-y-1">
              <div className="font-semibold text-cyan-100">Models</div>
              {(canonical.modelResources || []).slice(0, 4).map((item: any) => (
                <div key={item.id} className="text-cyan-100/80">
                  {item.id} · {item.aiLevel} · {item.status}
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-cyan-500/10 bg-black/10 p-3 space-y-1">
              <div className="font-semibold text-cyan-100">Harnesses</div>
              {(canonical.harnessResources || []).slice(0, 4).map((item: any) => (
                <div key={item.id} className="text-cyan-100/80">
                  {item.id} · {item.binary || item.modelHint || 'unknown'} · {item.status}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {status && (
        <>
          {/* System Health */}
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-white/50" />
                <span className="text-sm font-semibold text-white/80">系统健康</span>
              </div>
              {status.mustReclaim && (
                <div className="flex items-center gap-1 text-xs text-amber-400">
                  <AlertTriangle className="w-3 h-3" />
                  <span>资源紧张 — 并发已降级</span>
                </div>
              )}
            </div>
            <HealthBar value={status.health} label="健康" />
            <PressureBar value={status.system.pressure.memory} label="内存" />
            <PressureBar value={status.system.pressure.swap} label="Swap" />
            <PressureBar value={status.system.pressure.cpu} label="CPU" />
            <div className="flex gap-4 text-xs text-white/40 pt-1">
              <span><HardDrive className="w-3 h-3 inline mr-1" />RAM {status.system.ram.totalMb}MB (可回收 {status.system.ram.reclaimableMb}MB)</span>
              <span>Swap {status.system.swap.usedMb}/{status.system.swap.totalMb}MB</span>
            </div>
          </div>

          {/* Tier Cards */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-white/50" />
              <span className="text-sm font-semibold text-white/80">AI Tier 状态</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <TierCard tier="T0" status={status.tiers.T0} />
              <TierCard tier="T1" status={status.tiers.T1} />
              <TierCard tier="T2" status={status.tiers.T2} />
            </div>
          </div>

          {/* Sessions */}
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-white/50" />
                <span className="text-sm font-semibold text-white/80">CLI Sessions</span>
              </div>
              <span className={`text-xs font-mono ${status.sessions.canCreate ? 'text-emerald-400' : 'text-red-400'}`}>
                {status.sessions.current} / {status.sessions.max}
              </span>
            </div>
            <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, (status.sessions.current / Math.max(1, status.sessions.max)) * 100)}%`,
                  background: status.sessions.canCreate ? '#22c55e' : '#ef4444',
                }}
              />
            </div>
            {status.orphans > 0 && (
              <div className="text-xs text-amber-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {status.orphans} 个孤儿进程检测到
              </div>
            )}
          </div>

          {/* Timestamp */}
          <div className="flex items-center gap-1 text-xs text-white/20">
            <Clock className="w-3 h-3" />
            <span>更新于 {new Date(status.timestamp).toLocaleTimeString()}</span>
            <span className="ml-2">· 每 30 秒自动刷新</span>
          </div>
        </>
      )}
    </div>
  )
}
