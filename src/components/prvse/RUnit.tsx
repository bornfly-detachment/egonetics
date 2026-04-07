/**
 * RUnit — Relation 图结构 / 信息压缩传输 / Chronicle
 *
 * 专有逻辑：图可视化 + L级别递进展开 + 边列表管理 + 合法边矩阵
 * 通用面板：ProvenancePanel + ResourcePanel + MountPanel
 */
import { useState } from 'react'
import { ChevronDown, ChevronRight, Network, Layers } from 'lucide-react'
import type {
  RelationData, RelationEdge, RelationLevel, EdgeType,
  ProvenanceData, ResourceData, MountData,
} from '@prvse/types'
import { L_COLORS } from '@prvse/types'
import ProvenancePanel from './panels/ProvenancePanel'
import ResourcePanel from './panels/ResourcePanel'
import MountPanel from './panels/MountPanel'

// ── R 的 L 级别色板 ─────────────────────────────────────────────
const R_LEVEL_COLORS: Record<RelationLevel, { primary: string; label: string }> = {
  L0_logic:        { primary: '#94a3b8', label: 'L0 逻辑' },
  L1_conditional:  { primary: '#60a5fa', label: 'L1 条件' },
  L2_existential:  { primary: '#c084fc', label: 'L2 存在' },
}

const EDGE_TYPE_SYMBOLS: Record<EdgeType, string> = {
  directed:          '→',
  contains:          '⊂',
  constraint:        '-×→',
  mutual_constraint: '←×→',
  signal:            '~~>',
  derives:           '⇒',
}

// ── 边行 ────────────────────────────────────────────────────────
function EdgeRow({ edge }: { edge: RelationEdge }) {
  const lc = R_LEVEL_COLORS[edge.infoLevel]
  return (
    <div className="flex items-center gap-1.5 py-1 text-sm font-mono">
      <span className="text-white/70 w-14 truncate shrink-0">{edge.sourceNode}</span>
      <span style={{ color: lc.primary }} title={edge.edgeType}>
        {EDGE_TYPE_SYMBOLS[edge.edgeType]}
      </span>
      <span className="text-white/70 w-14 truncate shrink-0">{edge.targetNode}</span>
      <span className="text-sm px-1 py-0.5 rounded border shrink-0"
        style={{ color: lc.primary, borderColor: `${lc.primary}30`, background: `${lc.primary}08` }}>
        {lc.label}
      </span>
      <span className="text-white/70 text-sm truncate">
        {edge.certainty} · {edge.temporal}
        {edge.strength === 'negative' && ' · 负'}
      </span>
    </div>
  )
}

// ── 简化图可视化（节点+边计数 + L级别切换） ──────────────────────
function GraphSummary({ data, viewLevel, onViewLevelChange }: {
  data: RelationData
  viewLevel: 'L0' | 'L1' | 'L2'
  onViewLevelChange: (lv: 'L0' | 'L1' | 'L2') => void
}) {
  const levels: Array<'L0' | 'L1' | 'L2'> = ['L2', 'L1', 'L0']
  const edgesByLevel = {
    L0: data.edges.filter(e => e.infoLevel === 'L0_logic'),
    L1: data.edges.filter(e => e.infoLevel === 'L1_conditional'),
    L2: data.edges.filter(e => e.infoLevel === 'L2_existential'),
  }

  return (
    <div className="space-y-2">
      {/* 统计概览 */}
      <div className="flex gap-4 text-sm font-mono">
        <span className="text-white/75">{data.nodes.length} 节点</span>
        <span className="text-white/75">{data.edges.length} 边</span>
        <span className="text-white/70">
          L0:{edgesByLevel.L0.length} L1:{edgesByLevel.L1.length} L2:{edgesByLevel.L2.length}
        </span>
      </div>

      {/* L 级别切换（R 的核心能力：递进展开） */}
      <div className="flex items-center gap-1">
        <Layers size={10} className="text-white/70" />
        <span className="text-xs font-semibold text-white/80 mr-1">视图</span>
        {levels.map(lv => {
          const active = viewLevel === lv
          const lc = L_COLORS[lv]
          return (
            <button
              key={lv}
              onClick={() => onViewLevelChange(lv)}
              className="px-2 py-0.5 rounded text-sm font-mono transition-all border"
              style={{
                color: active ? lc.primary : 'rgba(255,255,255,0.25)',
                background: active ? `${lc.primary}12` : 'transparent',
                borderColor: active ? `${lc.primary}40` : 'rgba(255,255,255,0.06)',
              }}
            >
              {lv} {lv === 'L2' ? '抽象' : lv === 'L1' ? '展开' : '完整'}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── 主组件 ──────────────────────────────────────────────────────
interface RUnitProps {
  data: RelationData
  provenance: ProvenanceData
  resources: ResourceData
  mounts: MountData
  collapsed?: boolean
  onToggle?: () => void
  onUpdate?: (patch: Partial<RelationData>) => void
  onFork?: () => void
  onFreeze?: () => void
}

export default function RUnit({
  data, provenance, resources, mounts,
  collapsed: controlledCollapsed, onToggle,
  onUpdate, onFork, onFreeze,
}: RUnitProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(true)
  const collapsed = controlledCollapsed ?? internalCollapsed
  const toggle = onToggle ?? (() => setInternalCollapsed(v => !v))
  const [viewLevel, setViewLevel] = useState<'L0' | 'L1' | 'L2'>(data.viewLevel)

  const lc = R_LEVEL_COLORS[data.infoLevel]

  // 根据 viewLevel 过滤可见边
  const visibleEdges = viewLevel === 'L2'
    ? data.edges.filter(e => e.infoLevel === 'L2_existential')
    : viewLevel === 'L1'
      ? data.edges.filter(e => e.infoLevel !== 'L0_logic')
      : data.edges

  return (
    <div
      className="rounded-xl overflow-hidden border transition-all duration-200"
      style={{
        background: `${lc.primary}06`,
        borderColor: `${lc.primary}25`,
        boxShadow: `0 0 8px ${lc.primary}10`,
      }}
    >
      {/* ── Header ── */}
      <button
        onClick={toggle}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/[0.02] transition-colors"
      >
        <span className="text-sm font-black font-mono shrink-0" style={{ color: '#a78bfa' }}>R</span>
        <span className="text-sm font-mono shrink-0" style={{ color: lc.primary }}>{lc.label}</span>
        <span className="flex-1 text-sm text-white/65 truncate text-left min-w-0">
          {data.label}
        </span>
        <span className="text-sm font-mono text-white/70 shrink-0">
          {data.nodes.length}n·{data.edges.length}e
        </span>
        <Network size={11} className="text-white/70 shrink-0" />
        {collapsed ? <ChevronRight size={12} className="text-white/70" /> : <ChevronDown size={12} className="text-white/70" />}
      </button>

      {/* ── Body ── */}
      {!collapsed && (
        <div>
          {/* 图概览 + L 级别切换 */}
          <div className="px-3 pb-2">
            <GraphSummary data={data} viewLevel={viewLevel} onViewLevelChange={lv => {
              setViewLevel(lv)
              onUpdate?.({ viewLevel: lv })
            }} />
          </div>

          {/* 边列表（按当前视图级别过滤） */}
          <div className="px-3 pb-2">
            <div className="text-xs font-semibold text-white/80 mb-1.5">
              边 ({visibleEdges.length}/{data.edges.length})
              {viewLevel !== 'L0' && <span className="text-white/15"> — {viewLevel} 视图已压缩</span>}
            </div>
            <div className="rounded-lg bg-black/20 border border-white/[0.05] px-2 py-1 max-h-[200px] overflow-y-auto">
              {visibleEdges.length === 0 ? (
                <div className="text-sm text-white/70 py-2 text-center">此级别无边</div>
              ) : (
                visibleEdges.map(edge => <EdgeRow key={edge.id} edge={edge} />)
              )}
            </div>
          </div>

          {/* 三个通用面板 */}
          <ProvenancePanel data={provenance} accentColor="#a78bfa" onFork={onFork} onFreeze={onFreeze} />
          <MountPanel data={mounts} accentColor="#a78bfa" />
          <ResourcePanel data={resources} accentColor="#a78bfa" />
        </div>
      )}
    </div>
  )
}
