/**
 * VUnit — Value 独立裁判 / Checklist 驱动
 *
 * 专有逻辑：Checklist + 指标仪表盘 + Reward 函数 + 裁决结果 + 独立性保证
 * 通用面板：ProvenancePanel + ResourcePanel + MountPanel
 */
import { useState } from 'react'
import { ChevronDown, ChevronRight, Scale, ShieldCheck, AlertTriangle, XCircle, Clock, TrendingUp } from 'lucide-react'
import type {
  ValueData, CheckResult, ChecklistItem, Metric, RewardFunction,
  ProvenanceData, ResourceData, MountData,
} from '@prvse/types'
import ProvenancePanel from './panels/ProvenancePanel'
import ResourcePanel from './panels/ResourcePanel'
import MountPanel from './panels/MountPanel'

// ── 裁决颜色 ────────────────────────────────────────────────────
const VERDICT_STYLE: Record<CheckResult, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  pass:    { color: '#4ade80', bg: 'rgba(74,222,128,0.08)',  icon: <ShieldCheck size={12} />,   label: 'PASS' },
  fail:    { color: '#f87171', bg: 'rgba(248,113,113,0.08)', icon: <XCircle size={12} />,       label: 'FAIL' },
  warn:    { color: '#facc15', bg: 'rgba(250,204,21,0.08)',  icon: <AlertTriangle size={12} />, label: 'WARN' },
  pending: { color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', icon: <Clock size={12} />,         label: '待定' },
}

const CHECK_ICON: Record<CheckResult, string> = {
  pass: '✅', fail: '❌', warn: '⚠️', pending: '⏳',
}

// ── Checklist 行 ────────────────────────────────────────────────
function CheckRow({ item }: { item: ChecklistItem }) {
  return (
    <div className="flex items-start gap-2 py-1">
      <span className="text-sm shrink-0 mt-0.5">{CHECK_ICON[item.result]}</span>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-mono text-white/70 w-14 shrink-0">{item.type}</span>
          <span className="text-sm text-white/70 truncate">{item.description}</span>
        </div>
        {item.evidence && (
          <div className="text-sm text-white/70 mt-0.5 truncate">{item.evidence}</div>
        )}
      </div>
    </div>
  )
}

// ── 指标条 ──────────────────────────────────────────────────────
function MetricBar({ metric }: { metric: Metric }) {
  const pct = metric.threshold ? Math.min(100, (metric.value / metric.threshold) * 100) : 50
  const passed = metric.threshold ? metric.value >= metric.threshold : true
  const color = passed ? '#4ade80' : '#f87171'

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-mono text-white/35 w-20 shrink-0 truncate">{metric.label || metric.type}</span>
      <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-sm font-mono text-white/70 w-12 text-right shrink-0">
        {typeof metric.value === 'number' ? metric.value.toFixed(2) : metric.value}
        {metric.unit && <span className="text-white/70 ml-0.5">{metric.unit}</span>}
      </span>
    </div>
  )
}

// ── Reward 行 ───────────────────────────────────────────────────
function RewardRow({ reward }: { reward: RewardFunction }) {
  const pct = Math.round(reward.value * 100)
  const color = reward.value >= 0.7 ? '#4ade80' : reward.value >= 0.4 ? '#facc15' : '#f87171'

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-mono text-white/35 w-24 shrink-0 truncate">{reward.label || reward.type}</span>
      <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-sm font-mono w-8 text-right shrink-0" style={{ color }}>{pct}%</span>
    </div>
  )
}

// ── 主组件 ──────────────────────────────────────────────────────
interface VUnitProps {
  data: ValueData
  provenance: ProvenanceData
  resources: ResourceData
  mounts: MountData
  collapsed?: boolean
  onToggle?: () => void
  onFork?: () => void
  onFreeze?: () => void
}

export default function VUnit({
  data, provenance, resources, mounts,
  collapsed: controlledCollapsed, onToggle,
  onFork, onFreeze,
}: VUnitProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(true)
  const collapsed = controlledCollapsed ?? internalCollapsed
  const toggle = onToggle ?? (() => setInternalCollapsed(v => !v))

  const vs = VERDICT_STYLE[data.verdict]
  const passCount = data.checklist.filter(c => c.result === 'pass').length
  const totalCount = data.checklist.length

  return (
    <div
      className="rounded-xl overflow-hidden border transition-all duration-200"
      style={{
        background: vs.bg,
        borderColor: `${vs.color}25`,
        boxShadow: `0 0 8px ${vs.color}10`,
      }}
    >
      {/* ── Header ── */}
      <button
        onClick={toggle}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/[0.02] transition-colors"
      >
        <span className="text-sm font-black font-mono shrink-0" style={{ color: '#fb923c' }}>V</span>

        {/* 裁决级别 */}
        <span className="text-sm font-mono shrink-0 text-white/70">
          {data.verdictLevel === 'L0_deterministic' ? 'L0' : data.verdictLevel === 'L1_lifecycle' ? 'L1' : 'L2'}
        </span>

        {/* 标签 */}
        <span className="flex-1 text-sm text-white/65 truncate text-left min-w-0">
          {data.label}
        </span>

        {/* 通过率 */}
        <span className="text-sm font-mono shrink-0" style={{ color: vs.color }}>
          {passCount}/{totalCount}
        </span>

        {/* 裁决 badge */}
        <span
          className="flex items-center gap-1 text-xs font-mono px-1.5 py-0.5 rounded border shrink-0"
          style={{ color: vs.color, borderColor: `${vs.color}30`, background: `${vs.color}08` }}
        >
          {vs.icon}
          {vs.label}
        </span>

        {collapsed ? <ChevronRight size={12} className="text-white/70" /> : <ChevronDown size={12} className="text-white/70" />}
      </button>

      {/* ── Body ── */}
      {!collapsed && (
        <div>
          {/* Checklist */}
          <div className="px-3 pb-2">
            <div className="text-xs text-white/70 mb-1 uppercase tracking-wider">Checklist</div>
            <div className="rounded-lg bg-black/20 border border-white/[0.05] px-2 py-1">
              {data.checklist.map(item => <CheckRow key={item.id} item={item} />)}
            </div>
          </div>

          {/* 指标 */}
          {data.metrics.length > 0 && (
            <div className="px-3 pb-2">
              <div className="text-xs text-white/70 mb-1.5 uppercase tracking-wider">指标 (V1)</div>
              <div className="space-y-1.5">
                {data.metrics.map(m => <MetricBar key={m.type} metric={m} />)}
              </div>
            </div>
          )}

          {/* Reward */}
          {data.rewards.length > 0 && (
            <div className="px-3 pb-2">
              <div className="flex items-center gap-1 mb-1.5">
                <TrendingUp size={9} className="text-emerald-400/50" />
                <span className="text-xs font-semibold text-white/80 uppercase tracking-wider">Reward</span>
              </div>
              <div className="space-y-1.5">
                {data.rewards.map(r => <RewardRow key={r.type} reward={r} />)}
              </div>
            </div>
          )}

          {/* 生命周期评估（L1） */}
          {data.lifecycle && (
            <div className="px-3 pb-2">
              <div className="text-xs text-white/70 mb-1 uppercase tracking-wider">Lifecycle (L1)</div>
              <div className="rounded-lg bg-black/20 border border-white/[0.05] px-2.5 py-2 space-y-1 text-sm font-mono">
                <div className="flex justify-between">
                  <span className="text-white/75">反馈方向</span>
                  <span className={data.lifecycle.feedbackDirection === 'positive' ? 'text-emerald-400/70' : data.lifecycle.feedbackDirection === 'negative' ? 'text-red-400/70' : 'text-white/70'}>
                    {data.lifecycle.feedbackDirection}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/75">稳态偏离</span>
                  <span className={data.lifecycle.homeostasisDeviation > 0.5 ? 'text-red-400/70' : 'text-white/65'}>
                    {(data.lifecycle.homeostasisDeviation * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/75">最优性</span>
                  <span className={data.lifecycle.optimalityType === 'global' ? 'text-emerald-400/70' : data.lifecycle.optimalityType === 'local' ? 'text-amber-400/70' : 'text-white/70'}>
                    {data.lifecycle.optimalityType}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 独立性状态 */}
          <div className="px-3 pb-2">
            <div className="flex items-center gap-2 text-sm">
              <Scale size={9} className="text-white/70" />
              <span className={data.independence.neutral ? 'text-emerald-400/50' : 'text-red-400/50'}>
                {data.independence.neutral ? '✓ 中立' : '✗ 非中立'}
              </span>
              <span className={data.independence.antiInfiltration ? 'text-emerald-400/50' : 'text-red-400/50'}>
                {data.independence.antiInfiltration ? '✓ 反渗透' : '✗ 已渗透'}
              </span>
              <span className={data.independence.kernelDirect ? 'text-emerald-400/50' : 'text-red-400/50'}>
                {data.independence.kernelDirect ? '✓ 直达内核' : '✗ 间接'}
              </span>
            </div>
          </div>

          {/* 三个通用面板 */}
          <ProvenancePanel data={provenance} accentColor="#fb923c" onFork={onFork} onFreeze={onFreeze} />
          <MountPanel data={mounts} accentColor="#fb923c" />
          <ResourcePanel data={resources} accentColor="#fb923c" />
        </div>
      )}
    </div>
  )
}
