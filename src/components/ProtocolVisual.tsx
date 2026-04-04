/**
 * ProtocolVisual — Layer 4 入口
 * 根据 category + layer 渲染真实视觉组件
 * 颜色全部来自 useTokens()，不再 hardcode
 */
import { useTokens } from '@/design/TokenProvider'
import { Arrow } from '@/design/components/Arrow'
import { LayerBadge } from '@/design/components/LayerBadge'
import { SliderWidget } from '@/design/components/SliderWidget'
import { TimelineWidget } from '@/design/components/TimelineWidget'
import { InteractionChip } from '@/design/components/InteractionChip'
import { StateMachineVisual } from '@/design/components/StateMachineVisual'
import { V1MetricDisplay, VProbDisplay, PhiFunctionDisplay } from '@/design/components/VRewardVisual'
import { UIComponentVisual } from '@/design/components/UIComponentVisual'
import { ResourceTierVisual } from '@/design/components/ResourceTierVisual'
import { CommunicationVisual } from '@/design/components/CommunicationVisual'
import { KernelComponentCard, LifecycleStateCard, GraphNodeCard } from '@/design/components/KernelVisual'

interface VisualProps {
  category: string
  layer: string
  uiVisual: string
}

function parseVis(raw: string): Record<string, unknown> {
  try { return JSON.parse(raw) } catch { return {} }
}

// ── R 层 → edge constraint_type 映射 ─────────────────────────────
const R_EDGE_MAP: Record<string, string> = {
  l0:     'contains',
  l2:     'derives',
  signal: 'signal',
}

function rLayerToEdgeType(layer: string, vis: Record<string, unknown>): string {
  if (R_EDGE_MAP[layer]) return R_EDGE_MAP[layer]
  if (layer === 'l1') {
    const style = vis.style as string
    return style === 'mutual' ? 'mutual_constraint' : 'constraint'
  }
  return vis.style as string ?? 'directed'
}

// ── P 字段芯片 ────────────────────────────────────────────────────
function FieldChips({ fields, color }: { fields: string[]; color: string }) {
  return (
    <div className="flex flex-wrap gap-1">
      {fields.map(f => (
        <span key={f} className="px-1.5 py-0.5 rounded text-[9px] font-mono border"
          style={{ color, borderColor: color + '50', background: color + '15' }}>
          .{f}
        </span>
      ))}
    </div>
  )
}

// ── V 指标 ────────────────────────────────────────────────────────
function VMetrics({ vis }: { vis: Record<string, unknown> }) {
  const { layer } = useTokens()
  const metrics = vis.metrics as string[] | undefined
  const formula = vis.formula as string | undefined
  const threshold = vis.threshold as number | undefined

  if (metrics?.length) {
    return (
      <div className="space-y-1">
        {metrics.map(m => (
          <div key={m} className="flex items-center gap-1.5">
            <div className="text-[9px] font-mono w-24 shrink-0"
              style={{ color: layer.l0.color + 'aa' }}>{m}</div>
            <div className="flex-1 h-1.5 rounded overflow-hidden"
              style={{ background: layer.l0.border + '15', border: `1px solid ${layer.l0.border}30` }}>
              <div className="h-full rounded" style={{ width: '40%', background: layer.l0.border + '60' }} />
            </div>
          </div>
        ))}
      </div>
    )
  }
  if (formula) {
    return (
      <div className="px-2 py-1 rounded border"
        style={{ borderColor: layer.l1.border + '30', background: layer.l1.border + '08' }}>
        <div className="text-[9px] font-mono" style={{ color: layer.l1.color }}>{formula}</div>
      </div>
    )
  }
  if (threshold !== undefined) {
    return (
      <div className="flex items-center gap-2">
        <div className="text-[9px]" style={{ color: layer.l2.color + 'aa' }}>不确定性阈值</div>
        <div className="px-1.5 py-0.5 rounded border text-[10px] font-mono font-bold"
          style={{ color: layer.l2.color, borderColor: layer.l2.border + '40', background: layer.l2.border + '10' }}>
          &gt; {threshold}
        </div>
      </div>
    )
  }
  return null
}

// ── AOP stub ──────────────────────────────────────────────────────
function AopStubVisual({ vis }: { vis: Record<string, unknown> }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 rounded border border-pink-500/30 bg-pink-500/10
        flex items-center justify-center text-base">
        {(vis.icon as string) ?? '🔗'}
      </div>
      <div>
        <div className="text-[9px] text-pink-400/80 font-mono">AopLink</div>
        <div className="flex items-center gap-1 mt-0.5">
          <span className="px-1 py-px rounded text-[8px] border border-white/10 bg-white/[0.04] text-white/30 font-mono">
            status: stub
          </span>
          <span className="text-[8px] text-white/20">l₀ · l₁ · l₂</span>
        </div>
      </div>
    </div>
  )
}

// ── 主导出 ────────────────────────────────────────────────────────
export default function ProtocolVisual({ category, layer, uiVisual }: VisualProps) {
  const { layer: layerTokens } = useTokens()
  const vis = parseVis(uiVisual)

  if (category === 'layer') {
    if (['l0', 'l1', 'l2'].includes(layer)) {
      return <LayerBadge layerId={layer as 'l0' | 'l1' | 'l2'} showPerm showName />
    }
    // rule 条目
    return (
      <div className="flex items-center gap-2 text-[10px] text-white/50">
        <span>🔒</span>
        <span>lN 不可见 l(N+1)+</span>
      </div>
    )
  }

  if (category === 'R') {
    if (layer === 'slider') return (
      <SliderWidget value={0.5} readOnly
        leftLabel={(vis.leftLabel as string) ?? '矛盾/对立'}
        rightLabel={(vis.rightLabel as string) ?? '统一/融合'}
      />
    )
    if (layer === 'timeline') return <TimelineWidget color={layerTokens.l1.border} />
    const edgeType = rLayerToEdgeType(layer, vis)
    return <Arrow type={edgeType} />
  }

  if (category === 'interaction') {
    const action = vis.action as string
    if (action) return <InteractionChip action={action} />
  }

  if (category === 'P') {
    const fields = (vis.fields as string[]) ?? []
    const colors: Record<string, string> = {
      l0: layerTokens.l0.color,
      l1: layerTokens.l1.color,
      l2: layerTokens.l2.color,
    }
    return <FieldChips fields={fields} color={colors[layer] ?? '#6b7280'} />
  }

  if (category === 'V') {
    if (layer === 'phi') return <PhiFunctionDisplay vis={vis} />
    if (layer === 'v1')  return <V1MetricDisplay vis={vis} />
    if (layer === 'v2' || layer === 'v3') return <VProbDisplay vis={vis} layer={layer} />
    return <VMetrics vis={vis} />
  }

  if (category === 'AOP') return <AopStubVisual vis={vis} />

  if (category === 'S' || category === 'S-l0' || category === 'S-l1' || category === 'S-l2')
    return <StateMachineVisual vis={vis} layer={layer} />

  if (category === 'ui-component' || category === 'E-ui') return <UIComponentVisual vis={vis} />

  if (category === 'resource-tier' || category === 'E-perm') return <ResourceTierVisual vis={vis} />

  if (category === 'communication' || category === 'E-comm') return <CommunicationVisual vis={vis} />
  if (category === 'kernel-comp')    return <KernelComponentCard vis={vis} />
  if (category === 'lifecycle')      return <LifecycleStateCard vis={vis} />
  if (category === 'graph-node' || category === 'R-edge') return <GraphNodeCard vis={vis} />

  // ── P 子分类 → 复用 P 渲染 ──────────────────────────────────────
  if (category.startsWith('P-')) {
    const fields = (vis.fields as string[]) ?? []
    if (fields.length) {
      const color = category === 'P-state' ? '#f59e0b'
        : category === 'P-origin'   ? '#fbbf24'
        : category === 'P-level'    ? '#fcd34d'
        : category === 'P-physical' ? '#d97706'
        : '#92400e'
      return <FieldChips fields={fields} color={color} />
    }
  }

  // ── R 子分类 → 复用 R 渲染 ──────────────────────────────────────
  if (category.startsWith('R-')) {
    if (layer === 'slider') return (
      <SliderWidget value={0.5} readOnly
        leftLabel={(vis.leftLabel as string) ?? '矛盾/对立'}
        rightLabel={(vis.rightLabel as string) ?? '统一/融合'}
      />
    )
    if (layer === 'timeline') return <TimelineWidget color={layerTokens.l1.border} />
    const edgeType = rLayerToEdgeType(layer, vis)
    return <Arrow type={edgeType} />
  }

  // ── V 子分类 → 复用 V 渲染 ──────────────────────────────────────
  if (category.startsWith('V-')) {
    if (layer === 'phi') return <PhiFunctionDisplay vis={vis} />
    if (layer === 'v1')  return <V1MetricDisplay vis={vis} />
    if (layer === 'v2' || layer === 'v3') return <VProbDisplay vis={vis} layer={layer} />
    return <VMetrics vis={vis} />
  }

  // ── E 子分类 — 信息分级 ──────────────────────────────────────────
  if (category === 'E-info' || category === 'layer') {
    const INFO_LEVELS = [
      { id: 'L0', label: '信号层',   color: '#3b82f6', desc: '客观确定 ≥99%，规则路由' },
      { id: 'L1', label: '规律层',   color: '#10b981', desc: '可复现可验证，约束条件建模' },
      { id: 'L2', label: '认知层',   color: '#8b5cf6', desc: '主观/叙事，警惕幻觉' },
    ]
    const active = (vis.level as string) ?? layer
    return (
      <div className="flex gap-1.5">
        {INFO_LEVELS.map(lv => (
          <div key={lv.id}
            className="flex-1 rounded-lg px-2 py-1.5 border text-center transition-all"
            style={{
              background: active === lv.id.toLowerCase() ? lv.color + '20' : 'transparent',
              borderColor: active === lv.id.toLowerCase() ? lv.color + '55' : lv.color + '20',
            }}>
            <div className="text-[10px] font-bold font-mono mb-0.5" style={{ color: lv.color }}>{lv.id}</div>
            <div className="text-[9px] text-white/50">{lv.label}</div>
          </div>
        ))}
      </div>
    )
  }

  // ── E 子分类 — 演化阶段 ──────────────────────────────────────────
  if (category === 'E-l0' || category === 'E-l1' || category === 'E-l2') {
    const E_CFG: Record<string, { color: string; icon: string; label: string }> = {
      'E-l0': { color: '#6366f1', icon: '⚙️', label: 'L0 系统完备性维护' },
      'E-l1': { color: '#818cf8', icon: '🧬', label: 'L1 学习模块构建' },
      'E-l2': { color: '#a5b4fc', icon: '🧠', label: 'L2 主体性 + 生变论' },
    }
    const cfg = E_CFG[category]
    const title = (vis.title as string) ?? cfg.label
    const desc  = (vis.description as string) ?? ''
    return (
      <div className="flex items-start gap-2">
        <span className="text-base mt-0.5">{cfg.icon}</span>
        <div>
          <div className="text-[10px] font-semibold" style={{ color: cfg.color }}>{title}</div>
          {desc && <div className="text-[9px] text-white/40 mt-0.5 leading-snug">{desc}</div>}
        </div>
      </div>
    )
  }

  // fallback
  const entries = Object.entries(vis).slice(0, 4)
  if (!entries.length) return <span className="text-[9px] text-white/20">—</span>
  return (
    <div className="flex flex-wrap gap-1">
      {entries.map(([k, v]) => (
        <span key={k} className="px-1 py-0.5 rounded text-[9px] bg-white/[0.04] text-white/40 font-mono">
          {k}: {String(v).slice(0, 12)}
        </span>
      ))}
    </div>
  )
}
