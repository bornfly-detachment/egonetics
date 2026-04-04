/**
 * ResourcePanel — L0/L1/L2 recursive progressive resource display
 *
 * Design: OLED cinema dark + glassmorphism (matches WorldSpherePanel)
 * Interaction: Click to drill down, infinite depth via recursive ResourceNode
 *
 * Structure:
 *   Level 0: L0 / L1 / L2 cards (summary + count + overall status)
 *   Level 1: Type groups (compute / storage / ai / network / human)
 *   Level 2: Individual resources (status + physicalMapping + capabilities)
 *   Level 3+: Child resources (e.g. sqlite-cluster → 5 DBs)
 *
 * No fixed layout — one recursive renderer eats all depths.
 */

import { useState, useMemo } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Circle,
  Cpu,
  Database,
  Brain,
  Globe,
  User,
  Layers,
} from 'lucide-react'
import type {
  Resource,
  ResourceLevel,
  ResourceType,
  ResourceStatus,
} from '@/kernel/resource-registry'
import { createDefaultRegistry } from '@/kernel/resource-registry'

// ── Constants ─────────────────────────────────────────────────────

const LEVEL_META: Record<ResourceLevel, {
  label: string
  sublabel: string
  color: string
  bg: string
  border: string
}> = {
  L0: {
    label: 'L0',
    sublabel: '确定性 / 本地 / 始终可用',
    color: '#94a3b8',
    bg: 'rgba(148,163,184,0.06)',
    border: 'rgba(148,163,184,0.15)',
  },
  L1: {
    label: 'L1',
    sublabel: '外部推理 / 有延迟有成本',
    color: '#7dd3fc',
    bg: 'rgba(125,211,252,0.06)',
    border: 'rgba(125,211,252,0.15)',
  },
  L2: {
    label: 'L2',
    sublabel: '战略级 / 需人审批 / 高价值',
    color: '#a78bfa',
    bg: 'rgba(167,139,250,0.06)',
    border: 'rgba(167,139,250,0.15)',
  },
}

const TYPE_ICONS: Record<ResourceType, typeof Cpu> = {
  compute: Cpu,
  storage: Database,
  ai: Brain,
  network: Globe,
  human: User,
}

const TYPE_LABELS: Record<ResourceType, string> = {
  compute: '算力',
  storage: '存储',
  ai: 'AI',
  network: '网络',
  human: '人类',
}

const STATUS_CONFIG: Record<ResourceStatus, { color: string; label: string }> = {
  available: { color: '#4ade80', label: '在线' },
  busy: { color: '#facc15', label: '忙碌' },
  offline: { color: '#f87171', label: '离线' },
  unknown: { color: '#6b7280', label: '未知' },
}

// ── Status Dot ────────────────────────────────────────────────────

function StatusDot({ status }: { status: ResourceStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span className="relative flex items-center gap-1.5">
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: cfg.color, boxShadow: `0 0 6px ${cfg.color}60` }}
      />
      <span className="text-[9px] font-mono" style={{ color: `${cfg.color}cc` }}>
        {cfg.label}
      </span>
    </span>
  )
}

// ── Capability Tag ────────────────────────────────────────────────

function CapTag({ text, color }: { text: string; color: string }) {
  return (
    <span
      className="inline-block px-1.5 py-0.5 rounded text-[8px] font-mono leading-none"
      style={{
        background: `${color}10`,
        color: `${color}88`,
        border: `1px solid ${color}20`,
      }}
    >
      {text}
    </span>
  )
}

// ── Resource Leaf ─────────────────────────────────────────────────
// Individual resource card — shows status, physical mapping, capabilities

function ResourceLeaf({
  resource,
  levelColor,
  allResources,
}: {
  resource: Resource
  levelColor: string
  allResources: readonly Resource[]
}) {
  const [expanded, setExpanded] = useState(false)
  const children = allResources.filter(r => resource.children.includes(r.id))
  const hasChildren = children.length > 0
  const Icon = TYPE_ICONS[resource.type]

  return (
    <div className="mb-1">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all text-left group hover:bg-white/[0.03]"
      >
        {/* Expand indicator */}
        <span className="shrink-0 w-3 text-white/20">
          {hasChildren
            ? (expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />)
            : <Circle size={4} className="ml-1" />
          }
        </span>

        {/* Type icon */}
        <Icon size={12} className="shrink-0" style={{ color: `${levelColor}88` }} />

        {/* Name + Physical mapping */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-white/70 truncate">
              {resource.name}
            </span>
            {resource.tier !== 'T0' && (
              <span
                className="text-[8px] font-mono px-1 py-px rounded"
                style={{
                  background: `${levelColor}15`,
                  color: `${levelColor}aa`,
                  border: `1px solid ${levelColor}25`,
                }}
              >
                {resource.tier}
              </span>
            )}
          </div>
          <div className="text-[9px] font-mono text-white/25 truncate mt-0.5">
            {resource.physicalMapping}
          </div>
        </div>

        {/* Status */}
        <StatusDot status={resource.status} />
      </button>

      {/* Expanded: capabilities + constraints + children */}
      {expanded && (
        <div className="ml-7 pl-3 border-l border-white/[0.05] pb-1">
          {/* Capabilities */}
          {resource.capabilities.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5 mb-1">
              {resource.capabilities.map(cap => (
                <CapTag key={cap} text={cap} color={levelColor} />
              ))}
            </div>
          )}

          {/* Constraints */}
          {resource.constraints.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1 mb-1.5">
              {resource.constraints.map(con => (
                <CapTag key={con} text={con} color="#f87171" />
              ))}
            </div>
          )}

          {/* Child resources (recursive) */}
          {children.map(child => (
            <ResourceLeaf
              key={child.id}
              resource={child}
              levelColor={levelColor}
              allResources={allResources}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Type Group ────────────────────────────────────────────────────
// Groups resources by type within a level

function TypeGroup({
  type,
  resources,
  levelColor,
  allResources,
}: {
  type: ResourceType
  resources: readonly Resource[]
  levelColor: string
  allResources: readonly Resource[]
}) {
  const [expanded, setExpanded] = useState(true)
  const Icon = TYPE_ICONS[type]

  // Only show top-level resources in this group (not children of other resources)
  const childIds = new Set(resources.flatMap(r => [...r.children]))
  const topLevel = resources.filter(r => !childIds.has(r.id))

  return (
    <div className="mb-2">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.03] transition-all"
      >
        <span className="text-white/20 shrink-0">
          {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        </span>
        <Icon size={11} style={{ color: `${levelColor}77` }} />
        <span className="text-[10px] font-mono" style={{ color: `${levelColor}99` }}>
          {TYPE_LABELS[type]}
        </span>
        <span className="text-[9px] font-mono text-white/15 ml-auto">
          {topLevel.length}
        </span>
      </button>

      {expanded && (
        <div className="ml-2">
          {topLevel.map(r => (
            <ResourceLeaf
              key={r.id}
              resource={r}
              levelColor={levelColor}
              allResources={allResources}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Level Card ────────────────────────────────────────────────────
// Top-level L0/L1/L2 card with progressive drill-down

function LevelCard({
  level,
  resources,
  allResources,
  defaultExpanded,
}: {
  level: ResourceLevel
  resources: readonly Resource[]
  allResources: readonly Resource[]
  defaultExpanded: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const meta = LEVEL_META[level]

  // Group by type
  const typeGroups = useMemo(() => {
    const groups = new Map<ResourceType, Resource[]>()
    for (const r of resources) {
      const list = groups.get(r.type) ?? []
      list.push(r)
      groups.set(r.type, list)
    }
    return groups
  }, [resources])

  // Status summary
  const statusCounts = useMemo(() => {
    const counts: Record<ResourceStatus, number> = { available: 0, busy: 0, offline: 0, unknown: 0 }
    for (const r of resources) counts[r.status]++
    return counts
  }, [resources])

  return (
    <div
      className="mb-3 rounded-xl overflow-hidden"
      style={{ background: meta.bg, border: `1px solid ${meta.border}` }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-3.5 py-3 hover:bg-white/[0.02] transition-all"
      >
        <span className="text-white/25 shrink-0">
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>

        {/* Level badge */}
        <span
          className="text-[13px] font-mono font-bold"
          style={{ color: meta.color }}
        >
          {meta.label}
        </span>

        {/* Sublabel */}
        <span className="text-[10px] font-mono text-white/30 flex-1 truncate">
          {meta.sublabel}
        </span>

        {/* Status summary dots */}
        <div className="flex items-center gap-2 shrink-0">
          {statusCounts.available > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_CONFIG.available.color }} />
              <span className="text-[9px] font-mono text-white/30">{statusCounts.available}</span>
            </span>
          )}
          {statusCounts.offline > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_CONFIG.offline.color }} />
              <span className="text-[9px] font-mono text-white/30">{statusCounts.offline}</span>
            </span>
          )}
          {statusCounts.unknown > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_CONFIG.unknown.color }} />
              <span className="text-[9px] font-mono text-white/30">{statusCounts.unknown}</span>
            </span>
          )}
        </div>

        {/* Total count */}
        <span className="text-[10px] font-mono text-white/20 shrink-0">
          {resources.length}
        </span>
      </button>

      {/* Body — type groups */}
      {expanded && (
        <div className="px-2 pb-2.5">
          {[...typeGroups.entries()].map(([type, typeResources]) => (
            <TypeGroup
              key={type}
              type={type}
              resources={typeResources}
              levelColor={meta.color}
              allResources={allResources}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────

interface ResourcePanelProps {
  /** Accent color from the parent sphere */
  sphereColor?: string
}

export default function ResourcePanel({ sphereColor = '#7dd3fc' }: ResourcePanelProps) {
  const registry = useMemo(() => createDefaultRegistry(), [])
  const allResources = useMemo(() => registry.list(), [registry])

  const byLevel = useMemo(() => {
    const l0 = registry.listByLevel('L0')
    const l1 = registry.listByLevel('L1')
    const l2 = registry.listByLevel('L2')
    return { L0: l0, L1: l1, L2: l2 } as const
  }, [registry])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3.5 py-2.5 shrink-0"
        style={{ borderBottom: `1px solid ${sphereColor}15` }}
      >
        <Layers size={12} style={{ color: sphereColor }} />
        <span className="text-[11px] font-mono font-semibold" style={{ color: `${sphereColor}cc` }}>
          资源总览
        </span>
        <span className="text-[9px] font-mono text-white/20 ml-auto">
          {allResources.length} 项
        </span>
      </div>

      {/* Level cards — progressive drill-down */}
      <div className="flex-1 overflow-y-auto px-3 py-3 min-h-0">
        {(['L0', 'L1', 'L2'] as const).map((level, i) => (
          byLevel[level].length > 0 && (
            <LevelCard
              key={level}
              level={level}
              resources={byLevel[level]}
              allResources={allResources}
              defaultExpanded={i === 0}
            />
          )
        ))}
      </div>
    </div>
  )
}
