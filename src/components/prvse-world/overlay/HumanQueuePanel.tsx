/**
 * HumanQueuePanel — 人工处理收件箱
 *
 * 设计语言：Protocol View（OLED Cinema Dark + 毛玻璃 + 霓虹 accent）
 * 交互：邮件收件箱体验，未读角标 → 展开层级 → 逐条处理
 *
 * 触发：右上角角标按钮（有待处理时红点脉冲）
 * 结构：L0/L1/L2 三个可折叠分组，各独立展开
 * 每条：
 *   diff 类型  → T0预测 vs T1预测 → [选T0] [选T1] [自定义]
 *   pool 类型  → 失败原因 + 快照摘要 → [已处理]
 */

import { useState, useEffect, useCallback } from 'react'
import { X, RefreshCw, ChevronDown, ChevronRight, Inbox } from 'lucide-react'
import { authFetch } from '@/lib/http'

// ── 类型 ─────────────────────────────────────────────────────────

interface DiffItem {
  id: string
  layer: string
  signal_snapshot: Record<string, unknown> | null
  t0_prediction: { label: string; confidence: number; latency_ms?: number } | null
  t1_prediction: { label: string; confidence: number; latency_ms?: number } | null
  created_at: number
}

interface PoolItem {
  id: string
  layer: string
  signal_type: string
  signal_snapshot: string
  failure_reason: string | null
  failure_detail: string | null
  created_at: number
}

interface QueueCounts { L0: number; L1: number; L2: number; L3: number; total: number }

// ── 配色（与 Protocol View 对齐）────────────────────────────────

const LAYER_CFG = {
  L0: { color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.2)',  glow: 'rgba(148,163,184,0.12)', label: 'L0  物理信号' },
  L1: { color: '#7dd3fc', bg: 'rgba(125,211,252,0.08)', border: 'rgba(125,211,252,0.2)',  glow: 'rgba(125,211,252,0.12)', label: 'L1  客观规律' },
  L2: { color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.2)',  glow: 'rgba(167,139,250,0.12)', label: 'L2  主观认知' },
}

const DIFF_COLOR  = '#f87171'  // T0↔T1 冲突 — 红
const POOL_COLOR  = '#fb923c'  // P三问失败 — 橙

// ── 工具函数 ──────────────────────────────────────────────────────

function relativeTime(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60)  return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

function snapshotSummary(snapshot: unknown): string {
  if (!snapshot) return '—'
  try {
    const s = typeof snapshot === 'string' ? JSON.parse(snapshot) : snapshot
    const keys = Object.keys(s as object).slice(0, 3)
    return keys.map(k => `${k}:${JSON.stringify((s as Record<string,unknown>)[k])?.slice(0, 20)}`).join('  ')
  } catch { return String(snapshot).slice(0, 60) }
}

// ── 单条 Diff 卡片 ────────────────────────────────────────────────

function DiffCard({ item, onArbitrate }: { item: DiffItem; onArbitrate: (id: string, label: string) => void }) {
  const [custom, setCustom] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const [doing, setDoing] = useState(false)

  const pick = async (label: string) => {
    setDoing(true)
    await onArbitrate(item.id, label)
  }

  const t0 = item.t0_prediction
  const t1 = item.t1_prediction

  return (
    <div
      className="rounded-xl p-3 mb-2 transition-all duration-200"
      style={{ background: 'rgba(248,113,113,0.06)', borderLeft: `3px solid ${DIFF_COLOR}70` }}
    >
      {/* header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-mono font-semibold" style={{ color: DIFF_COLOR }}>
          T0↔T1 分类冲突
        </span>
        <span className="text-[10px] font-mono text-white/25">{relativeTime(item.created_at)}</span>
      </div>

      {/* signal summary */}
      <div className="text-[10px] font-mono text-white/30 mb-2.5 truncate">
        {snapshotSummary(item.signal_snapshot)}
      </div>

      {/* predictions */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {t0 && (
          <div className="rounded-lg px-2.5 py-2 border" style={{ background: 'rgba(52,211,153,0.06)', borderColor: 'rgba(52,211,153,0.2)' }}>
            <div className="text-[9px] font-mono text-white/30 mb-0.5">T0 SEAI</div>
            <div className="text-[11px] font-semibold" style={{ color: '#34d399' }}>{t0.label}</div>
            <div className="text-[9px] font-mono text-white/25">{(t0.confidence * 100).toFixed(0)}%</div>
          </div>
        )}
        {t1 && (
          <div className="rounded-lg px-2.5 py-2 border" style={{ background: 'rgba(96,165,250,0.06)', borderColor: 'rgba(96,165,250,0.2)' }}>
            <div className="text-[9px] font-mono text-white/30 mb-0.5">T1 MiniMax</div>
            <div className="text-[11px] font-semibold" style={{ color: '#60a5fa' }}>{t1.label}</div>
            <div className="text-[9px] font-mono text-white/25">{(t1.confidence * 100).toFixed(0)}%</div>
          </div>
        )}
      </div>

      {/* action buttons */}
      {!showCustom ? (
        <div className="flex gap-1.5">
          {t0 && (
            <button
              disabled={doing}
              onClick={() => pick(t0.label)}
              className="flex-1 py-1.5 rounded-lg text-[10px] font-mono font-medium border transition-all hover:opacity-90 disabled:opacity-40"
              style={{ color: '#34d399', background: 'rgba(52,211,153,0.1)', borderColor: 'rgba(52,211,153,0.3)' }}
            >
              选 T0
            </button>
          )}
          {t1 && (
            <button
              disabled={doing}
              onClick={() => pick(t1.label)}
              className="flex-1 py-1.5 rounded-lg text-[10px] font-mono font-medium border transition-all hover:opacity-90 disabled:opacity-40"
              style={{ color: '#60a5fa', background: 'rgba(96,165,250,0.1)', borderColor: 'rgba(96,165,250,0.3)' }}
            >
              选 T1
            </button>
          )}
          <button
            disabled={doing}
            onClick={() => setShowCustom(true)}
            className="px-2.5 py-1.5 rounded-lg text-[10px] font-mono border transition-all text-white/40 hover:text-white/70"
            style={{ borderColor: 'rgba(255,255,255,0.1)' }}
          >
            自定义
          </button>
        </div>
      ) : (
        <div className="flex gap-1.5">
          <input
            autoFocus
            value={custom}
            onChange={e => setCustom(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && custom.trim()) pick(custom.trim()) }}
            placeholder="输入标签…"
            className="flex-1 bg-transparent border border-white/15 rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-white/65 outline-none focus:border-white/30 placeholder:text-white/20"
          />
          <button
            disabled={!custom.trim() || doing}
            onClick={() => pick(custom.trim())}
            className="px-3 py-1.5 rounded-lg text-[10px] font-mono border transition-all disabled:opacity-30"
            style={{ color: '#f59e0b', background: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.3)' }}
          >
            确认
          </button>
          <button onClick={() => setShowCustom(false)} className="px-2 text-white/30 hover:text-white/60">
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  )
}

// ── 单条 Pool 卡片 ────────────────────────────────────────────────

function PoolCard({ item, onResolve }: { item: PoolItem; onResolve: (id: string) => void }) {
  const [doing, setDoing] = useState(false)

  const REASON_LABEL: Record<string, string> = {
    from:    '① 来源不可溯',
    what:    '② 分类 schema 不合法',
    target:  '③ 目标控制器不存在',
    timeout: '超时升级 (>5s)',
  }

  return (
    <div
      className="rounded-xl p-3 mb-2 transition-all duration-200"
      style={{ background: 'rgba(251,146,60,0.06)', borderLeft: `3px solid ${POOL_COLOR}70` }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-mono font-semibold" style={{ color: POOL_COLOR }}>
          {item.signal_type === 'timeout_escalation' ? '超时升级' :
           item.signal_type === 'p_gate_fail'        ? 'P三问失败' :
           item.signal_type === 'rule_miss'          ? '规则未覆盖' : item.signal_type}
        </span>
        <span className="text-[10px] font-mono text-white/25">{relativeTime(item.created_at)}</span>
      </div>

      {item.failure_reason && (
        <div className="text-[11px] font-mono mb-1" style={{ color: POOL_COLOR }}>
          ✗ {REASON_LABEL[item.failure_reason] ?? item.failure_reason}
        </div>
      )}

      <div className="text-[10px] font-mono text-white/30 mb-2.5 truncate">
        {snapshotSummary(item.signal_snapshot)}
      </div>

      <div className="flex gap-1.5">
        <button
          disabled={doing}
          onClick={async () => { setDoing(true); onResolve(item.id) }}
          className="flex-1 py-1.5 rounded-lg text-[10px] font-mono font-medium border transition-all hover:opacity-90 disabled:opacity-40"
          style={{ color: '#34d399', background: 'rgba(52,211,153,0.1)', borderColor: 'rgba(52,211,153,0.3)' }}
        >
          已处理
        </button>
      </div>
    </div>
  )
}

// ── Layer Section ────────────────────────────────────────────────

function LayerSection({
  layer, count, diffs, poolItems, expanded, onToggle, onArbitrate, onResolve,
}: {
  layer: 'L0' | 'L1' | 'L2'
  count: number
  diffs: DiffItem[]
  poolItems: PoolItem[]
  expanded: boolean
  onToggle: () => void
  onArbitrate: (id: string, label: string) => void
  onResolve: (id: string) => void
}) {
  const cfg = LAYER_CFG[layer]
  const total = diffs.length + poolItems.length

  return (
    <div className="mb-1">
      {/* section header — 邮件折叠器 */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all hover:bg-white/[0.03] group"
        style={{ borderLeft: `3px solid ${cfg.color}50` }}
      >
        <span className="text-white/35 transition-colors group-hover:text-white/60" style={{ flexShrink: 0 }}>
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>

        <span className="text-[12px] font-mono font-medium flex-1 text-left" style={{ color: cfg.color }}>
          {cfg.label}
        </span>

        {count > 0 ? (
          <span
            className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full"
            style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, boxShadow: `0 0 8px ${cfg.glow}` }}
          >
            ● {count}
          </span>
        ) : (
          <span className="text-[10px] font-mono text-white/20">○ 清空</span>
        )}
      </button>

      {/* 展开内容 */}
      {expanded && total > 0 && (
        <div className="mx-2 mt-1">
          {diffs.map(d => (
            <DiffCard key={d.id} item={d} onArbitrate={onArbitrate} />
          ))}
          {poolItems.map(p => (
            <PoolCard key={p.id} item={p} onResolve={onResolve} />
          ))}
        </div>
      )}

      {expanded && total === 0 && (
        <div className="mx-2 mt-1 mb-2 py-3 text-center text-[11px] font-mono text-white/20">
          暂无待处理项
        </div>
      )}
    </div>
  )
}

// ── 主组件 ───────────────────────────────────────────────────────

export default function HumanQueuePanel() {
  const [open, setOpen] = useState(false)
  const [counts, setCounts] = useState<QueueCounts>({ L0: 0, L1: 0, L2: 0, L3: 0, total: 0 })
  const [diffs, setDiffs] = useState<DiffItem[]>([])
  const [pool, setPool] = useState<{ L0: PoolItem[]; L1: PoolItem[]; L2: PoolItem[] }>({ L0: [], L1: [], L2: [] })
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ L0: true, L1: false, L2: false })

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [countData, diffsData, l0Pool, l1Pool, l2Pool] = await Promise.all([
        authFetch<{ counts: QueueCounts; total: number }>('/signals/queue/counts'),
        authFetch<{ items: DiffItem[] }>('/signals/diffs?limit=50'),
        authFetch<{ items: PoolItem[] }>('/signals/queue?layer=L0&limit=50'),
        authFetch<{ items: PoolItem[] }>('/signals/queue?layer=L1&limit=50'),
        authFetch<{ items: PoolItem[] }>('/signals/queue?layer=L2&limit=50'),
      ])
      setCounts({ ...(countData.counts ?? { L0: 0, L1: 0, L2: 0, L3: 0 }), total: countData.total ?? 0 })
      setDiffs(diffsData.items ?? [])
      setPool({ L0: l0Pool.items ?? [], L1: l1Pool.items ?? [], L2: l2Pool.items ?? [] })
    } catch { /* silent */ }
    setLoading(false)
  }, [])

  // 轮询 counts（30s）
  useEffect(() => {
    fetchData()
    const id = setInterval(() => {
      authFetch<{ counts: QueueCounts; total: number }>('/signals/queue/counts')
        .then(d => setCounts({ ...(d.counts ?? { L0: 0, L1: 0, L2: 0, L3: 0 }), total: d.total ?? 0 }))
        .catch(() => {})
    }, 30_000)
    return () => clearInterval(id)
  }, [fetchData])

  // 打开面板时拉取完整数据
  useEffect(() => { if (open) fetchData() }, [open, fetchData])

  const handleArbitrate = useCallback(async (id: string, human_label: string) => {
    try {
      await authFetch(`/signals/diffs/${id}/arbitrate`, {
        method: 'POST',
        body: JSON.stringify({ human_label }),
      })
      setDiffs(prev => prev.filter(d => d.id !== id))
      setCounts(prev => ({ ...prev, L0: Math.max(0, prev.L0 - 1), total: Math.max(0, prev.total - 1) }))
    } catch { /* silent */ }
  }, [])

  const handleResolve = useCallback(async (id: string) => {
    const item = [...pool.L0, ...pool.L1, ...pool.L2].find(p => p.id === id)
    try {
      await authFetch(`/signals/queue/${id}/resolve`, { method: 'POST', body: JSON.stringify({}) })
      if (item) {
        const layer = item.layer as 'L0' | 'L1' | 'L2'
        setPool(prev => ({ ...prev, [layer]: prev[layer].filter(p => p.id !== id) }))
        setCounts(prev => ({
          ...prev,
          [layer]: Math.max(0, prev[layer as keyof QueueCounts] as number - 1),
          total:   Math.max(0, prev.total - 1),
        }))
      }
    } catch { /* silent */ }
  }, [pool])

  const toggle = (layer: string) => setExpanded(prev => ({ ...prev, [layer]: !prev[layer] }))

  // ── 触发按钮（始终可见）────────────────────────────────────────
  const TriggerBtn = (
    <button
      onClick={() => setOpen(v => !v)}
      className="relative flex items-center gap-2 px-3 py-2 rounded-xl border transition-all duration-200"
      style={{
        background:   counts.total > 0 ? 'rgba(248,113,113,0.10)' : 'rgba(255,255,255,0.08)',
        borderColor:  counts.total > 0 ? 'rgba(248,113,113,0.40)'  : 'rgba(255,255,255,0.28)',
        boxShadow:    counts.total > 0 ? '0 0 12px rgba(248,113,113,0.20)' : '0 0 0 1px rgba(255,255,255,0.06)',
      }}
    >
      <Inbox size={13} style={{ color: counts.total > 0 ? '#f87171' : 'rgba(255,255,255,0.70)' }} />
      <span
        className="text-[11px] font-mono"
        style={{ color: counts.total > 0 ? '#f87171' : 'rgba(255,255,255,0.60)' }}
      >
        {counts.total > 0 ? `收件箱 ${counts.total}` : '收件箱'}
      </span>
      {counts.total > 0 && (
        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-400/80 animate-pulse" />
      )}
    </button>
  )

  return (
    <>
      {/* 触发按钮 — 嵌入父级 HUD */}
      {TriggerBtn}

      {/* 收件箱面板 */}
      {open && (
        <div
          className="absolute top-12 right-0 z-50 w-80 rounded-2xl overflow-hidden
            bg-[#060810]/95 backdrop-blur-2xl border border-white/[0.08]
            flex flex-col shadow-2xl"
          style={{ maxHeight: 'calc(100vh - 120px)' }}
        >
          {/* panel header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-[12px] font-mono font-semibold text-white/70">待处理队列</span>
              {/* layer badges */}
              <div className="flex gap-1">
                {(['L0','L1','L2'] as const).map(l => counts[l] > 0 && (
                  <span key={l} className="text-[9px] font-mono px-1.5 py-0.5 rounded-full"
                    style={{ color: LAYER_CFG[l].color, background: LAYER_CFG[l].bg, border: `1px solid ${LAYER_CFG[l].border}` }}>
                    {l} ●{counts[l]}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={fetchData}
                disabled={loading}
                className="p-1.5 rounded-lg text-white/25 hover:text-white/55 transition-colors disabled:opacity-30"
              >
                <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
              </button>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg text-white/25 hover:text-white/55 transition-colors">
                <X size={11} />
              </button>
            </div>
          </div>

          {/* sections */}
          <div className="flex-1 overflow-y-auto py-2 px-2">
            {(['L0', 'L1', 'L2'] as const).map(layer => {
              const layerDiffs  = layer === 'L0' ? diffs : []
              const layerPool   = pool[layer]
              return (
                <LayerSection
                  key={layer}
                  layer={layer}
                  count={counts[layer]}
                  diffs={layerDiffs}
                  poolItems={layerPool}
                  expanded={!!expanded[layer]}
                  onToggle={() => toggle(layer)}
                  onArbitrate={handleArbitrate}
                  onResolve={handleResolve}
                />
              )
            })}
          </div>

          {/* empty state */}
          {counts.total === 0 && !loading && (
            <div className="py-8 text-center text-[11px] font-mono text-white/20">
              ✓ 收件箱已清空
            </div>
          )}
        </div>
      )}
    </>
  )
}
