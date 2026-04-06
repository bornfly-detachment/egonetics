/**
 * TierManagePanel — T0/T1/T2 tier cards with real status + embedded terminals
 *
 * Data source: GET /api/free-code/tiers (real harness-runner config)
 * Terminal: EmbeddedTerminal (collapsible per tier)
 */

import { useState, useEffect } from 'react'
import { Terminal, ChevronDown, ChevronRight, Zap, AlertCircle } from 'lucide-react'
import { authFetch } from '@/lib/http'
import EmbeddedTerminal from './EmbeddedTerminal'

// ── Types ────────────────────────────────────────────────────────────

interface TierInfo {
  id: string
  label: string
  description: string
  color: string
  enabled: boolean
  not_ready_reason: string | null
  model_hint: string
}

// ── Level metadata per tier ──────────────────────────────────────────

const TIER_META: Record<string, { level: string; levelColor: string; sublabel: string }> = {
  T0: { level: 'L0', levelColor: '#94a3b8', sublabel: '本地 · 确定性 · 零成本' },
  T1: { level: 'L1', levelColor: '#7dd3fc', sublabel: '外部推理 · 有延迟有成本' },
  T2: { level: 'L2', levelColor: '#a78bfa', sublabel: '战略级 · 全权访问' },
}

// ── Component ────────────────────────────────────────────────────────

interface TierManagePanelProps {
  sphereColor?: string
}

export default function TierManagePanel({ sphereColor = '#7dd3fc' }: TierManagePanelProps) {
  const [tiers, setTiers]     = useState<TierInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [openTier, setOpenTier] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    authFetch<{ default_tier: string; tiers: TierInfo[] }>('/free-code/tiers')
      .then(d => { if (!cancelled) { setTiers(d.tiers ?? []); setLoading(false) } })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3.5 py-2.5 shrink-0"
        style={{ borderBottom: `1px solid ${sphereColor}15` }}
      >
        <Zap size={12} style={{ color: sphereColor }} />
        <span className="text-[11px] font-mono font-semibold" style={{ color: `${sphereColor}cc` }}>
          智能分级
        </span>
        <span className="text-[9px] font-mono text-white/20 ml-auto">
          {tiers.length} 层
        </span>
      </div>

      {/* Tier cards */}
      <div className="flex-1 overflow-y-auto px-3 py-3 min-h-0 space-y-2">
        {loading && (
          <div className="flex items-center justify-center h-20">
            <span className="text-[10px] font-mono text-white/20">加载中…</span>
          </div>
        )}

        {!loading && tiers.length === 0 && (
          <div className="flex items-center justify-center h-20">
            <span className="text-[10px] font-mono text-white/20">无可用 tier</span>
          </div>
        )}

        {tiers.map(tier => {
          const meta   = TIER_META[tier.id] ?? { level: '—', levelColor: '#6b7280', sublabel: '' }
          const isOpen = openTier === tier.id

          return (
            <div
              key={tier.id}
              className="rounded-xl overflow-hidden"
              style={{
                background: `${meta.levelColor}06`,
                border: `1px solid ${meta.levelColor}${isOpen ? '30' : '18'}`,
                transition: 'border-color 0.2s',
              }}
            >
              {/* Card row */}
              <div className="flex items-center gap-2.5 px-3 py-2.5">
                {/* Level badge */}
                <span
                  className="text-[12px] font-mono font-bold shrink-0 w-6"
                  style={{ color: meta.levelColor }}
                >
                  {meta.level}
                </span>

                {/* Label + model_hint */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-mono text-white/70 truncate">
                      {tier.label}
                    </span>
                    <span
                      className="text-[8px] font-mono px-1.5 py-px rounded shrink-0"
                      style={{
                        background: `${meta.levelColor}12`,
                        color: `${meta.levelColor}88`,
                        border: `1px solid ${meta.levelColor}22`,
                      }}
                    >
                      {tier.id}
                    </span>
                  </div>
                  <div className="text-[9px] font-mono text-white/25 truncate mt-0.5">
                    {tier.model_hint || meta.sublabel}
                  </div>
                </div>

                {/* Status dot */}
                {tier.enabled ? (
                  <span className="flex items-center gap-1 shrink-0">
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: '#4ade80', boxShadow: '0 0 5px #4ade8070' }}
                    />
                    <span className="text-[9px] font-mono text-white/25">在线</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 shrink-0">
                    <AlertCircle size={10} className="text-red-400/50" />
                    <span className="text-[9px] font-mono text-white/25">不可用</span>
                  </span>
                )}

                {/* Terminal toggle — only when tier is enabled */}
                {tier.enabled && (
                  <button
                    onClick={() => setOpenTier(isOpen ? null : tier.id)}
                    className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg transition-all"
                    style={{
                      background: isOpen ? `${meta.levelColor}20` : `${meta.levelColor}08`,
                      color: isOpen ? meta.levelColor : `${meta.levelColor}66`,
                      border: `1px solid ${meta.levelColor}${isOpen ? '40' : '18'}`,
                    }}
                    title={isOpen ? '收起终端' : '打开终端'}
                  >
                    <Terminal size={9} />
                    <span className="text-[8px] font-mono leading-none">终端</span>
                    {isOpen
                      ? <ChevronDown size={8} />
                      : <ChevronRight size={8} />
                    }
                  </button>
                )}
              </div>

              {/* Disabled reason */}
              {!tier.enabled && tier.not_ready_reason && (
                <div
                  className="px-3 pb-2.5 text-[9px] font-mono text-white/20 leading-relaxed"
                  style={{ borderTop: `1px solid ${meta.levelColor}10` }}
                >
                  {tier.not_ready_reason}
                </div>
              )}

              {/* Embedded terminal — unmounts on close, so connection drops cleanly */}
              {isOpen && (
                <div style={{ borderTop: `1px solid ${meta.levelColor}18` }}>
                  <EmbeddedTerminal key={tier.id} tierId={tier.id} height={220} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
