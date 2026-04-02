/**
 * KernelVisual — Runtime Kernel 三类协议条目的 AI Native 可视化
 * Design: Dark OLED + Real-Time Monitoring + Terminal CLI
 * Text minimum: 11px for identifiers, 10px for compact labels only
 *
 *   KernelComponentCard  → /protocol category='kernel-comp'
 *   LifecycleStateCard   → /protocol category='lifecycle'
 *   GraphNodeCard        → /protocol category='graph-node'
 */
import { ArrowRight, Box, Cpu, Zap } from 'lucide-react'

// ── Shared primitives ─────────────────────────────────────────────

/** 统一协议卡片容器 */
function ProtoCard({
  color, children, className = '',
}: {
  color: string; children: React.ReactNode; className?: string
}) {
  return (
    <div
      className={`rounded-lg overflow-hidden transition-all duration-200 ${className}`}
      style={{
        background: '#0e1420',
        border: `1px solid rgba(255,255,255,0.08)`,
        borderLeft: `2px solid ${color}80`,
      }}
    >
      {children}
    </div>
  )
}

/** 10px uppercase section label — acceptable for IN/OUT/trigger tiny labels */
function SectionLabel({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <div
      className="text-[10px] font-mono uppercase tracking-widest mb-1"
      style={{ color: color ?? 'rgba(255,255,255,0.25)' }}
    >
      {children}
    </div>
  )
}

/** 11px mono chip — identifiers, ports, states */
function MonoChip({
  label, color, dimmed,
}: {
  label: string; color: string; dimmed?: boolean
}) {
  return (
    <span
      className="inline-block text-[11px] font-mono px-1.5 py-0.5 rounded leading-none"
      style={{
        color: dimmed ? color + '70' : color,
        background: color + '12',
        border: `1px solid ${color}25`,
      }}
    >
      {label}
    </span>
  )
}

// ── KernelComponentCard ────────────────────────────────────────────
export function KernelComponentCard({ vis }: { vis: Record<string, unknown> }) {
  const role    = (vis.role    as string) ?? '—'
  const version = (vis.version as string) ?? ''
  const color   = (vis.color   as string) ?? '#6b7280'
  const ins     = (vis.interface_in  as string[]) ?? []
  const outs    = (vis.interface_out as string[]) ?? []
  const trigger = (vis.trigger as string) ?? ''

  return (
    <ProtoCard color={color}>
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 border-b"
        style={{ borderColor: color + '18', background: color + '0a' }}
      >
        <Cpu size={11} style={{ color, flexShrink: 0 }} />
        <span
          className="text-[12px] font-semibold font-mono flex-1 truncate"
          style={{ color }}
        >
          {role}
        </span>
        {version && (
          <MonoChip label={`v${version}`} color={color} dimmed />
        )}
      </div>

      {/* I/O grid */}
      <div className="grid grid-cols-2" style={{ borderBottom: trigger ? `1px solid ${color}12` : undefined }}>
        <div className="px-3 py-2" style={{ borderRight: `1px solid ${color}12` }}>
          <SectionLabel color={color + '50'}>IN</SectionLabel>
          <div className="flex flex-col gap-1">
            {ins.length
              ? ins.map(i => (
                  <span key={i} className="text-[11px] font-mono text-white/40 leading-snug">{i}</span>
                ))
              : <span className="text-[11px] text-white/18">—</span>}
          </div>
        </div>
        <div className="px-3 py-2">
          <SectionLabel color={color + '75'}>OUT</SectionLabel>
          <div className="flex flex-col gap-1">
            {outs.length
              ? outs.map(o => (
                  <span key={o} className="text-[11px] font-mono leading-snug" style={{ color }}>{o}</span>
                ))
              : <span className="text-[11px] text-white/18">—</span>}
          </div>
        </div>
      </div>

      {/* Trigger */}
      {trigger && (
        <div
          className="flex items-center gap-2 px-3 py-2"
          style={{ background: color + '06' }}
        >
          <Zap size={10} style={{ color: color + 'aa', flexShrink: 0 }} />
          <span className="text-[11px] font-mono" style={{ color: color + 'cc' }}>{trigger}</span>
        </div>
      )}
    </ProtoCard>
  )
}

// ── LifecycleStateCard ─────────────────────────────────────────────
export function LifecycleStateCard({ vis }: { vis: Record<string, unknown> }) {
  const state    = (vis.state   as string) ?? '—'
  const color    = (vis.color   as string) ?? '#6b7280'
  const order    = (vis.order   as number) ?? 0
  const transTo  = (vis.transitions_to as string[]) ?? []
  const trigger  = (vis.trigger_condition as string) ?? ''
  const bottomUp = vis.bottom_up_trigger as string | null

  return (
    <div className="space-y-2">
      {/* State header */}
      <div className="flex items-center gap-2">
        <MonoChip label={`S${order}`} color={color} dimmed />
        <span className="text-[13px] font-bold tracking-tight flex-1" style={{ color }}>
          {state}
        </span>
        {/* Live signal dot */}
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: color, boxShadow: `0 0 6px ${color}` }}
        />
      </div>

      {/* Transitions */}
      {transTo.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[10px] text-white/25 mr-0.5">→</span>
          {transTo.map(t => (
            <MonoChip key={t} label={t} color={color} />
          ))}
        </div>
      )}

      {/* Trigger condition */}
      {trigger && (
        <div
          className="text-[11px] font-mono px-2.5 py-1.5 rounded border-l-2"
          style={{
            borderColor: color + '50',
            background: 'rgba(255,255,255,0.025)',
            color: 'rgba(255,255,255,0.40)',
          }}
        >
          if {trigger}
        </div>
      )}

      {/* Bottom-up signal */}
      {bottomUp && (
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-red-400/55">
          <ArrowRight size={9} className="rotate-[-90deg] shrink-0" />
          <span>{bottomUp}</span>
        </div>
      )}
    </div>
  )
}

// ── GraphNodeCard ──────────────────────────────────────────────────
export function GraphNodeCard({ vis }: { vis: Record<string, unknown> }) {
  const nodeType = (vis.node_type as string) ?? '—'
  const color    = (vis.color    as string) ?? '#6b7280'
  const executor = (vis.executor as string) ?? '—'
  const drivenBy = (vis.driven_by as string) ?? ''
  const input    = (vis.input    as string) ?? ''
  const output   = (vis.output   as string) ?? ''

  return (
    <ProtoCard color={color}>
      <div className="px-3 py-2.5 space-y-2">
        {/* Node identity */}
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
            style={{ background: color + '14', border: `1px solid ${color}35` }}
          >
            <Box size={12} style={{ color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div
              className="text-[12px] font-bold font-mono truncate"
              style={{ color }}
            >
              {nodeType}
            </div>
            <div className="text-[11px] text-white/30 mt-0.5">
              runs on:{' '}
              <span className="font-mono" style={{ color: color + 'bb' }}>{executor}</span>
            </div>
          </div>
        </div>

        {/* Driven by */}
        {drivenBy && (
          <div className="text-[11px] font-mono text-white/30">
            driven by: <span className="text-white/50">{drivenBy}</span>
          </div>
        )}

        {/* Data flow */}
        {(input || output) && (
          <div className="flex items-center gap-1.5 text-[11px] font-mono">
            {input && (
              <span
                className="px-1.5 py-0.5 rounded text-white/40"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                {input}
              </span>
            )}
            {input && output && (
              <ArrowRight size={9} className="text-white/22 shrink-0" />
            )}
            {output && (
              <span
                className="px-1.5 py-0.5 rounded"
                style={{ color, background: color + '12', border: `1px solid ${color}28` }}
              >
                {output}
              </span>
            )}
          </div>
        )}
      </div>
    </ProtoCard>
  )
}


// ══════════════════════════════════════════════════════════════════
// Lab 专用组合组件（供 LabView 使用，内部复用上方协议组件）
// ══════════════════════════════════════════════════════════════════

export type KernelStatus = 'idle' | 'active' | 'processing' | 'alert'
export type NodeStatus   = 'done' | 'running' | 'pending' | 'failed'
export type LifecycleId  = 'draft' | 'waiting' | 'running' | 'testing' | 'positive' | 'negative' | 'archived'

export interface KernelComp {
  id: 'v1' | 'v2' | 'e' | 'ctrl'
  emoji: string
  label: string
  color: string
  status: KernelStatus
  detail: string
}

export interface GraphNodeMock {
  id: string
  emoji: string
  label: string
  type: string
  executor: string
  status: NodeStatus
  detail: string
}

// ── KernelPanel：四组件状态面板 ───────────────────────────────────
export function KernelPanel({ items }: { items: KernelComp[] }) {
  const statusLabel: Record<KernelStatus, string> = {
    idle: '待机', active: '活跃', processing: '处理中', alert: '告警',
  }
  const statusColor: Record<KernelStatus, string> = {
    idle: '#6b7280', active: '#34d399', processing: '#f59e0b', alert: '#ef4444',
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map(c => {
        const sc = statusColor[c.status]
        return (
          <div
            key={c.id}
            className="rounded-lg p-2.5 border"
            style={{ background: c.color + '08', borderColor: c.color + '25' }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-base">{c.emoji}</span>
              <span className="text-[11px] font-bold flex-1" style={{ color: c.color }}>{c.label}</span>
              <span
                className="text-[9px] px-1.5 py-0.5 rounded font-mono"
                style={{ color: sc, background: sc + '18', border: `1px solid ${sc}35` }}
              >
                {statusLabel[c.status]}
              </span>
            </div>
            <div className="text-[9px] text-white/40 leading-snug">{c.detail}</div>
          </div>
        )
      })}
    </div>
  )
}

// ── ExecutionGraphPanel：Graph-V0 执行流 ──────────────────────────
export function ExecutionGraphPanel({ nodes }: { nodes: GraphNodeMock[] }) {
  const statusStyle: Record<NodeStatus, { color: string; bg: string; icon: string }> = {
    done:    { color: '#34d399', bg: '#34d39912', icon: '✓' },
    running: { color: '#f59e0b', bg: '#f59e0b12', icon: '▶' },
    pending: { color: '#374151', bg: 'transparent', icon: '○' },
    failed:  { color: '#ef4444', bg: '#ef444412', icon: '✗' },
  }

  return (
    <div className="flex flex-col items-center gap-0">
      {nodes.map((node, i) => {
        const s = statusStyle[node.status]
        const isRunning = node.status === 'running'
        return (
          <div key={node.id} className="flex flex-col items-center w-full">
            <div
              className="w-full rounded-lg px-3 py-2 border flex items-center gap-2.5 transition-all"
              style={{
                background: s.bg,
                borderColor: s.color + (node.status === 'pending' ? '18' : '45'),
                boxShadow: isRunning ? `0 0 12px ${s.color}20` : undefined,
              }}
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${isRunning ? 'animate-pulse' : ''}`}
                style={{ background: s.color + '25', color: s.color, border: `1.5px solid ${s.color}60` }}
              >
                {s.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">{node.emoji}</span>
                  <span
                    className="text-[11px] font-medium"
                    style={{ color: node.status === 'pending' ? 'rgba(255,255,255,0.3)' : s.color }}
                  >
                    {node.label}
                  </span>
                </div>
                {node.detail && (
                  <div className="text-[9px] mt-0.5" style={{ color: s.color + '99' }}>{node.detail}</div>
                )}
              </div>
              <div className="text-[9px] text-white/25 shrink-0 font-mono">{node.executor}</div>
            </div>
            {i < nodes.length - 1 && (
              <div className="w-px h-3" style={{ background: 'rgba(255,255,255,0.08)' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── LifecycleBar：横向生命周期时间轴 ─────────────────────────────
const LC_STATES: { id: LifecycleId; label: string; color: string }[] = [
  { id: 'draft',    label: '草稿',  color: '#6b7280' },
  { id: 'waiting',  label: '等待',  color: '#60a5fa' },
  { id: 'running',  label: '执行中', color: '#f59e0b' },
  { id: 'testing',  label: '测试中', color: '#a78bfa' },
  { id: 'positive', label: '正反馈', color: '#34d399' },
  { id: 'negative', label: '负反馈', color: '#ef4444' },
  { id: 'archived', label: '归档',  color: '#6b7280' },
]

const LC_ORDER: LifecycleId[] = ['draft', 'waiting', 'running', 'testing', 'positive', 'archived']

export function LifecycleBar({ current }: { current: LifecycleId }) {
  const currentIdx = LC_ORDER.indexOf(current)

  return (
    <div className="flex items-center gap-0">
      {LC_ORDER.map((id, i) => {
        const def    = LC_STATES.find(s => s.id === id)!
        const isDone = i < currentIdx
        const isCur  = id === current
        const isPend = i > currentIdx

        return (
          <div key={id} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center shrink-0">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${isCur ? 'animate-pulse' : ''}`}
                style={{
                  background: isPend ? 'rgba(255,255,255,0.04)' : def.color + '22',
                  border: `2px solid ${isCur ? def.color : isDone ? def.color + '60' : 'rgba(255,255,255,0.1)'}`,
                  color: isCur ? def.color : isDone ? def.color + 'aa' : 'rgba(255,255,255,0.2)',
                }}
              >
                {isDone ? '✓' : isCur ? '●' : '○'}
              </div>
              <div
                className="mt-1 text-[9px] whitespace-nowrap"
                style={{ color: isCur ? def.color : isDone ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.2)' }}
              >
                {def.label}
              </div>
            </div>
            {i < LC_ORDER.length - 1 && (
              <div
                className="flex-1 h-px mx-1 mb-4"
                style={{ background: i < currentIdx ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)' }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
