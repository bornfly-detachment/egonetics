/**
 * ResourceTierVisual — 智能资源分级 T0/T1/T2 流水线卡片
 * 展示三级升级路径：直觉层 → 理性层 → 专家层
 */
import { ArrowDown } from 'lucide-react'

interface Props {
  vis: Record<string, unknown>
}

// ── 单层卡片 ──────────────────────────────────────────────────────
function TierCard({ tier, label, emoji, color, cost, note, escalateIf }: {
  tier: number
  label: string
  emoji: string
  color: string
  cost: string
  note: string
  escalateIf?: string
}) {
  return (
    <div
      className="rounded-xl p-3 border relative overflow-hidden"
      style={{
        background: `${color}10`,
        borderColor: `${color}40`,
      }}
    >
      {/* 扫描线纹理 */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.5) 2px, rgba(255,255,255,0.5) 4px)',
        }}
      />

      {/* 头部 */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">{emoji}</span>
        <div>
          <div className="text-[11px] font-bold" style={{ color }}>T{tier} {label}</div>
          <div className="text-[9px] text-white/30 mt-0.5">
            {tier === 0 && '秒级响应 · 零成本'}
            {tier === 1 && '分析处理 · skills 扩展'}
            {tier === 2 && '深度推理 · 高成本'}
          </div>
        </div>
      </div>

      {/* 成本 */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
          <span className="text-[9px] text-white/50">cost</span>
          <span className="text-[10px] font-mono font-medium" style={{ color: `${color}cc` }}>{cost}</span>
          <span className="text-[9px] text-white/30">/1k</span>
        </div>
        {note && (
          <span
            className="px-1.5 py-0.5 rounded text-[8px] font-medium border"
            style={{ color: `${color}aa`, borderColor: `${color}30`, background: `${color}08` }}
          >
            {note}
          </span>
        )}
      </div>

      {/* 升级条件 */}
      {escalateIf && tier < 2 && (
        <div className="mt-2 pt-2 border-t border-white/[0.06]">
          <div className="text-[8px] text-white/25 mb-1">升级条件</div>
          <div
            className="px-2 py-1 rounded text-[9px] font-mono"
            style={{ background: `${color}08`, color: `${color}80`, border: `1px solid ${color}20` }}
          >
            {escalateIf}
          </div>
          <div className="flex items-center gap-1 mt-1.5 text-[8px] text-white/20">
            <span>→ T{tier + 1}</span>
            <ArrowDown size={8} className="opacity-50" />
          </div>
        </div>
      )}

      {tier === 2 && (
        <div className="mt-2 pt-2 border-t border-white/[0.06]">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: color }} />
            <span className="text-[9px]" style={{ color: `${color}80` }}>最终决策层</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 主导出 ────────────────────────────────────────────────────────
export function ResourceTierVisual({ vis }: Props) {
  const tiers = (vis.tiers as Array<Record<string, unknown>> | undefined) ?? []

  // 单条 T0/T1/T2 展示（兼容旧格式）
  if (!tiers.length) {
    const tier = (vis.tier as number | undefined) ?? 0
    const label = (vis.label as string) ?? ''
    const emoji = (vis.emoji as string) ?? '⚡'
    const color = (vis.color as string) ?? '#9ca3af'
    const cost = vis.cost_per_1k !== undefined ? `¥${vis.cost_per_1k}` : '¥0'
    const note = vis.rl_capable ? 'RL 可训练' : (vis.skills_enabled ? 'skills 扩展' : '高成本提示')
    const escalateIf = (vis.escalate_if as string | undefined)

    return (
      <div className="space-y-1.5">
        <TierCard
          tier={tier} label={label} emoji={emoji} color={color}
          cost={cost} note={note} escalateIf={escalateIf}
        />
      </div>
    )
  }

  // 三层流水线（3 列 + 箭头）
  return (
    <div className="space-y-2">
      <div className="text-[8px] text-white/20 font-mono mb-1">资源分级流水线</div>
      <div className="grid grid-cols-3 gap-2">
        {tiers.map((t, i) => (
          <TierCard
            key={i}
            tier={t.tier as number}
            label={(t.label as string) ?? ''}
            emoji={(t.emoji as string) ?? '⚡'}
            color={(t.color as string) ?? '#9ca3af'}
            cost={t.cost ? `¥${t.cost}` : '¥0'}
            note={(t.note as string) ?? ''}
            escalateIf={(t.escalate_if as string | undefined)}
          />
        ))}
      </div>
    </div>
  )
}
