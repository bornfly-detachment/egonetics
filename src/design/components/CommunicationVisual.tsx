/**
 * CommunicationVisual — L0/L1/L2 通信机制可视化
 * AI不能直接和AI通信，必须过系统控制单元（Control Bus）校验
 */
import { ArrowRight, Shield, AlertTriangle, Lock } from 'lucide-react'

interface Props {
  vis: Record<string, unknown>
}

// ── 通信类型卡片 ─────────────────────────────────────────────────
function CommCard({ level, label, color, scenarios, policy, risk, humanOptional }: {
  level: number
  label: string
  color: string
  scenarios: string[]
  policy: string
  risk: string
  humanOptional?: boolean
}) {
  const RiskIcon = risk === '极高' ? Lock : risk === '高' ? AlertTriangle : Shield
  const riskColor = risk === '极高' ? '#ef4444' : risk === '高' ? '#f59e0b' : '#34d399'

  return (
    <div
      className="rounded-xl p-4 border relative overflow-hidden"
      style={{ background: `${color}0d`, borderColor: `${color}35` }}
    >
      {/* 扫描线纹理 */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.4) 2px, rgba(255,255,255,0.4) 4px)',
        }}
      />

      {/* 头部 */}
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${color}20`, border: `1px solid ${color}40` }}
        >
          <span className="text-[11px] font-black" style={{ color }}>L{level}</span>
        </div>
        <div>
          <div className="text-[12px] font-bold" style={{ color }}>{label}</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <RiskIcon size={9} style={{ color: riskColor }} />
            <span className="text-[9px]" style={{ color: riskColor }}>风险: {risk}</span>
            {humanOptional && (
              <span className="text-[8px] text-white/30 border border-white/10 px-1 rounded">可选 Human/T2</span>
            )}
          </div>
        </div>
      </div>

      {/* 场景 */}
      <div className="mb-3">
        <div className="text-[8px] text-white/25 uppercase tracking-widest mb-1">触发场景</div>
        <div className="flex flex-wrap gap-1">
          {scenarios.map(s => (
            <span
              key={s}
              className="px-1.5 py-0.5 rounded text-[9px] border"
              style={{ color: `${color}aa`, borderColor: `${color}30`, background: `${color}0a` }}
            >
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* 策略 */}
      <div className="pt-2 border-t border-white/[0.06]">
        <div className="text-[8px] text-white/25 uppercase tracking-widest mb-1">裁决策略</div>
        <div
          className="px-2 py-1 rounded text-[10px] font-medium"
          style={{ background: `${color}10`, color: `${color}cc`, border: `1px solid ${color}20` }}
        >
          {policy}
        </div>
      </div>
    </div>
  )
}

// ── 裁决流程 ────────────────────────────────────────────────────
function VerdictFlow() {
  return (
    <div className="rounded-xl p-4 border border-white/[0.08] bg-white/[0.02]">
      <div className="text-[8px] text-white/25 uppercase tracking-widest mb-3">裁决流程</div>
      <div className="flex items-center gap-2 text-[10px]">
        <div className="px-2 py-1 rounded bg-white/[0.05] text-white/50 border border-white/[0.08]">
          通信请求
        </div>
        <ArrowRight size={12} className="text-white/20 shrink-0" />
        <div className="px-2 py-1 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 font-medium">
          校验/裁决
        </div>
        <div className="flex-1 flex flex-col gap-1">
          {[
            { label: '允许', color: '#34d399', sub: '→ 执行' },
            { label: '拒绝', color: '#ef4444', sub: '→ 返回错误' },
            { label: '修改', color: '#f59e0b', sub: '→ 重写请求' },
          ].map(v => (
            <div key={v.label} className="flex items-center gap-1">
              <ArrowRight size={9} style={{ color: v.color }} />
              <span style={{ color: v.color }}>{v.label}</span>
              <span className="text-white/30 text-[9px]">{v.sub}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── AI间通信禁令提示 ─────────────────────────────────────────────
function NoAIAIAuthority() {
  return (
    <div className="rounded-xl p-3 border border-red-500/20 bg-red-500/05">
      <div className="flex items-center gap-2 mb-2">
        <Lock size={11} className="text-red-400/60" />
        <span className="text-[10px] font-bold text-red-400/80">核心约束：AI ↛ AI 直接通信</span>
      </div>
      <div className="text-[9px] text-white/40 leading-relaxed">
        任何 AI 间通信必须经过 <span className="text-red-400/60 font-mono">Control Bus</span> 校验通过后，
        才能转发至目标 AI。所有请求需携带源身份、目标身份、通信类型（L0/L1/L2）。
      </div>
    </div>
  )
}

// ── 主导出 ──────────────────────────────────────────────────────
export function CommunicationVisual({ vis }: Props) {
  const level   = (vis.level as number | undefined) ?? 0
  const label   = (vis.label as string) ?? ''
  const color   = (vis.color as string) ?? '#34d399'
  const scenarios = (vis.scenarios as string[] | undefined) ?? []
  const policy  = (vis.policy as string) ?? ''
  const risk   = (vis.risk as string) ?? '低'
  const humanOptional = vis.human_optional as boolean | undefined

  return (
    <div className="space-y-3">
      <NoAIAIAuthority />
      <CommCard
        level={level} label={label} color={color}
        scenarios={scenarios} policy={policy} risk={risk}
        humanOptional={humanOptional}
      />
      {level === 1 && <VerdictFlow />}
      {level === 2 && <VerdictFlow />}
    </div>
  )
}

// ── 批量展示（通信机制 tab） ────────────────────────────────────
export function CommunicationPipeline({ entries }: { entries: ProtocolEntry[] }) {
  return (
    <div className="space-y-4">
      {/* AI间通信禁令 */}
      <NoAIAIAuthority />

      {/* 三层卡片 */}
      <div className="grid grid-cols-3 gap-3">
        {entries.map(e => {
          const vis = (() => { try { return JSON.parse(e.ui_visual) } catch { return {} } })()
          return (
            <CommCard
              key={e.id}
              level={vis.level as number}
              label={vis.label as string}
              color={vis.color as string}
              scenarios={(vis.scenarios as string[]) ?? []}
              policy={vis.policy as string}
              risk={vis.risk as string}
              humanOptional={vis.human_optional as boolean | undefined}
            />
          )
        })}
      </div>

      {/* 裁决流程 */}
      <VerdictFlow />
    </div>
  )
}

interface ProtocolEntry { id: string; ui_visual: string }
