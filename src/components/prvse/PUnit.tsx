/**
 * PUnit — Pattern 信息原语 / 控制论细胞
 *
 * 专有逻辑：三态状态机 + 缩窄指示器 + L 级别底色
 * 通用面板：ProvenancePanel + ResourcePanel + MountPanel
 */
import { useState } from 'react'
import { ChevronDown, ChevronRight, Circle, ArrowRight } from 'lucide-react'
import type {
  PatternData, PatternState, InfoLevel, PhysicalType, Communication,
  ProvenanceData, ResourceData, MountData,
} from '@prvse/types'
import { narrowingCount, derivedAuthority, L_COLORS, STATE_VISUALS } from '@prvse/types'
import ProvenancePanel from './panels/ProvenancePanel'
import ResourcePanel from './panels/ResourcePanel'
import MountPanel from './panels/MountPanel'

// ── 缩窄指示器 ──────────────────────────────────────────────────
function NarrowingDots({ physical, level, communication }: {
  physical: boolean; level: boolean; communication: boolean
}) {
  const dots = [
    { resolved: physical, label: 'phy' },
    { resolved: level, label: 'lvl' },
    { resolved: communication, label: 'com' },
  ]
  return (
    <div className="flex items-center gap-1" title={dots.map(d => `${d.label}:${d.resolved ? '✓' : '?'}`).join(' ')}>
      {dots.map((d, i) => (
        <span
          key={i}
          className="w-[6px] h-[6px] rounded-full transition-colors"
          style={{
            background: d.resolved ? '#60a5fa' : 'transparent',
            border: d.resolved ? '1px solid #60a5fa' : '1px solid rgba(255,255,255,0.15)',
          }}
        />
      ))}
    </div>
  )
}

// ── 三态指示条 ──────────────────────────────────────────────────
function StateBar({ state, onTransition }: {
  state: PatternState
  onTransition?: (next: PatternState) => void
}) {
  const stages: PatternState[] = ['external', 'candidate', 'internal']
  const currentIdx = stages.indexOf(state)

  return (
    <div className="flex items-center gap-1">
      {stages.map((s, i) => {
        const active = i <= currentIdx
        const isCurrent = s === state
        const vis = STATE_VISUALS[s]
        return (
          <div key={s} className="flex items-center gap-1">
            {i > 0 && <ArrowRight size={8} className="text-white/15" />}
            <button
              onClick={() => onTransition?.(s)}
              disabled={!onTransition || i > currentIdx + 1}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded transition-all"
              style={{
                background: isCurrent ? 'rgba(255,255,255,0.06)' : 'transparent',
                border: isCurrent ? '1px solid rgba(255,255,255,0.12)' : '1px solid transparent',
                opacity: active ? 1 : 0.35,
              }}
            >
              <Circle
                size={6}
                fill={active ? (s === 'internal' ? '#4ade80' : s === 'candidate' ? '#60a5fa' : '#f59e0b') : 'transparent'}
                stroke={active ? 'none' : 'rgba(255,255,255,0.2)'}
              />
              <span className="text-xs font-mono text-white/65">{vis.label}</span>
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ── 分类显示行 ──────────────────────────────────────────────────
function ClassificationRow({ label, value, resolved, source }: {
  label: string; value: string | undefined; resolved: boolean; source?: string
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-white/75 w-10 shrink-0">{label}</span>
      {resolved ? (
        <span className="text-sm font-mono text-white/75 flex items-center gap-1.5">
          {value}
          {source === 'ai' && <span className="text-[9px] px-1 py-0.5 rounded bg-violet-500/20 text-violet-300 font-semibold">AI</span>}
        </span>
      ) : (
        <span className="text-sm font-mono text-white/30 italic">待分类</span>
      )}
    </div>
  )
}

// ── 主组件 ──────────────────────────────────────────────────────
interface PUnitProps {
  data: PatternData
  provenance: ProvenanceData
  resources: ResourceData
  mounts: MountData
  collapsed?: boolean
  onToggle?: () => void
  onUpdate?: (patch: Partial<PatternData>) => void
  onStateTransition?: (next: PatternState) => void
  onFork?: () => void
  onFreeze?: () => void
  onClassify?: () => void
}

export default function PUnit({
  data, provenance, resources, mounts,
  collapsed: controlledCollapsed, onToggle,
  onUpdate, onStateTransition, onFork, onFreeze, onClassify,
}: PUnitProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(true)
  const collapsed = controlledCollapsed ?? internalCollapsed
  const toggle = onToggle ?? (() => setInternalCollapsed(v => !v))

  const lv = data.level.resolved ? data.level.value! : 'L0'
  const lc = L_COLORS[lv]
  const sv = STATE_VISUALS[data.state]
  const nc = narrowingCount(data)
  const authority = derivedAuthority(data)

  const PHYSICAL_OPTIONS: PhysicalType[] = ['text', 'number', 'code', 'structured', 'image', 'audio', 'video', 'stream', 'mixed']
  const LEVEL_OPTIONS: InfoLevel[] = ['L0', 'L1', 'L2']
  const COMM_OPTIONS: Communication[] = ['bottom_up', 'top_down', 'lateral']

  return (
    <div
      className="rounded-xl overflow-hidden transition-all duration-200"
      style={{
        background: lc.bg,
        borderStyle: sv.borderStyle,
        borderWidth: sv.borderWidth,
        borderColor: lc.border,
        opacity: sv.opacity,
        boxShadow: data.state === 'internal' ? `0 0 16px ${lc.glow}` : `0 0 6px ${lc.glow}50`,
      }}
    >
      {/* ── Header（始终可见） ── */}
      <button
        onClick={toggle}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/[0.02] transition-colors"
      >
        {/* P 标志 */}
        <span className="text-sm font-black font-mono shrink-0" style={{ color: '#f59e0b' }}>P</span>

        {/* L 级别 */}
        <span className="text-sm font-mono shrink-0" style={{ color: lc.primary }}>
          {lv}
        </span>

        {/* 物理类型 */}
        {data.physical.resolved && (
          <span className="text-sm font-mono text-white/75">·{data.physical.value}</span>
        )}

        {/* 内容预览 */}
        <span className="flex-1 text-sm text-white/65 truncate text-left min-w-0">
          {data.rawContent.slice(0, 60)}{data.rawContent.length > 60 ? '...' : ''}
        </span>

        {/* 缩窄指示器 */}
        <NarrowingDots
          physical={data.physical.resolved}
          level={data.level.resolved}
          communication={data.communication.resolved}
        />

        {/* 权限 + Tier */}
        <span className="text-sm font-mono text-white/70 shrink-0">{authority}</span>

        {/* 展开控制 */}
        {collapsed ? <ChevronRight size={12} className="text-white/70" /> : <ChevronDown size={12} className="text-white/70" />}
      </button>

      {/* ── Body（展开后） ── */}
      {!collapsed && (
        <div>
          {/* 内容区 */}
          <div className="px-3 pb-2">
            <textarea
              value={data.rawContent}
              onChange={e => onUpdate?.({ rawContent: e.target.value })}
              readOnly={!onUpdate || data.frozen}
              rows={3}
              className="w-full text-sm font-mono bg-black/20 border border-white/[0.06] rounded-lg px-2.5 py-2 text-white/75 outline-none resize-y focus:border-white/15"
              spellCheck={false}
            />
          </div>

          {/* 三态 */}
          <div className="px-3 pb-2">
            <div className="text-xs font-semibold text-white/80 mb-1.5">状态</div>
            <StateBar state={data.state} onTransition={onStateTransition} />
          </div>

          {/* 分类属性 — AI 自动识别 */}
          <div className="px-3 pb-2 space-y-1">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-semibold text-white/80">分类（缩窄 {nc}/3）</span>
              {onClassify && nc < 3 && (
                <button
                  onClick={onClassify}
                  className="text-[10px] px-2 py-0.5 rounded bg-violet-500/15 border border-violet-500/30 text-violet-300 font-mono hover:bg-violet-500/25 transition-colors"
                >
                  AI 识别
                </button>
              )}
              {(data as any)._classification?.source === 'ai' && (
                <span className="text-[9px] text-violet-400/60 font-mono">
                  {(data as any)._classification?.summary}
                </span>
              )}
            </div>
            <ClassificationRow label="物理" value={data.physical.value} resolved={data.physical.resolved} source={(data as any)._classification?.source} />
            <ClassificationRow label="级别" value={data.level.value} resolved={data.level.resolved} source={(data as any)._classification?.source} />
            <ClassificationRow label="通信" value={data.communication.value} resolved={data.communication.resolved} source={(data as any)._classification?.source} />
          </div>

          {/* ── 三个通用面板 ── */}
          <ProvenancePanel data={provenance} accentColor="#f59e0b" onFork={onFork} onFreeze={onFreeze} />
          <MountPanel data={mounts} accentColor="#f59e0b" />
          <ResourcePanel data={resources} accentColor="#f59e0b" />
        </div>
      )}
    </div>
  )
}
