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

import { useState, useEffect, useMemo } from 'react'
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
  RefreshCw,
} from 'lucide-react'
import type {
  Resource,
  ResourceLevel,
  ResourceType,
  ResourceStatus,
} from '@/kernel/resource-registry'
import { createRegistry } from '@/kernel/resource-registry'
import { authFetch } from '@/lib/http'

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

/** Transform /api/resources/status + /api/resources/graph into Resource[] */
function apiToResources(
  status: { health: number; system: { ram: { totalMb: number; usedMb: number; reclaimableMb: number }; swap: { totalMb: number; usedMb: number }; pressure: { memory: number; swap: number; cpu: number } }; tiers: Record<string, { alive: boolean; model: string; queue?: { running: number; waiting: number; maxConcurrency: number }; today?: { calls: number; inputTokens: number; outputTokens: number; avgLatencyMs: number; errors: number } | null }>; sessions: { current: number; max: number; canCreate: boolean }; orphans: number },
  graph: { nodes: { id: string; level: string; type: string; description: string; file?: string; children: string[] }[]; edges: { id: string; type: string; from: string; to: string }[] },
): Resource[] {
  const resources: Resource[] = []
  const fmt = (mb: number) => mb >= 1024 ? `${(mb/1024).toFixed(1)} GB` : `${mb} MB`

  // System resources (L0 compute)
  resources.push({
    id: 'sys-ram', name: `RAM ${fmt(status.system.ram.totalMb)}`, type: 'compute', tier: 'T0', level: 'L0',
    status: status.system.pressure.memory > 90 ? 'busy' : 'available',
    capabilities: [`已用 ${fmt(status.system.ram.usedMb)}`, `可回收 ${fmt(status.system.ram.reclaimableMb)}`, `压力 ${status.system.pressure.memory}%`],
    constraints: [], children: [], physicalMapping: 'Apple M1 物理内存',
  })
  resources.push({
    id: 'sys-swap', name: `Swap ${fmt(status.system.swap.totalMb)}`, type: 'compute', tier: 'T0', level: 'L0',
    status: status.system.pressure.swap > 75 ? 'busy' : 'available',
    capabilities: [`已用 ${fmt(status.system.swap.usedMb)}`, `压力 ${status.system.pressure.swap}%`],
    constraints: [], children: [], physicalMapping: 'SSD 虚拟内存',
  })
  resources.push({
    id: 'sys-cpu', name: `CPU 压力 ${status.system.pressure.cpu}%`, type: 'compute', tier: 'T0', level: 'L0',
    status: status.system.pressure.cpu > 85 ? 'busy' : 'available',
    capabilities: [`负载 ${status.system.pressure.cpu}%`],
    constraints: [], children: [], physicalMapping: 'Apple M1 8 cores',
  })

  // AI Tier resources (L1 ai)
  for (const [tier, info] of Object.entries(status.tiers)) {
    const today = info.today
    const caps = [`模型: ${info.model}`]
    if (info.queue) caps.push(`队列: ${info.queue.running}运行 / ${info.queue.waiting}等待 / 上限${info.queue.maxConcurrency}`)
    if (today) {
      caps.push(`今日: ${today.calls}次调用`)
      caps.push(`延迟: ${today.avgLatencyMs > 1000 ? (today.avgLatencyMs/1000).toFixed(1) + 's' : today.avgLatencyMs + 'ms'}`)
      const totalTokens = today.inputTokens + today.outputTokens
      caps.push(`token: ${totalTokens > 1000 ? (totalTokens/1000).toFixed(1) + 'K' : totalTokens}`)
      if (today.errors > 0) caps.push(`错误: ${today.errors}`)
    }
    resources.push({
      id: `ai-${tier}`, name: `${tier} ${info.model}`, type: 'ai',
      tier: tier as Resource['tier'], level: 'L1',
      status: info.alive ? 'available' : 'offline',
      capabilities: caps, constraints: [], children: [],
      physicalMapping: tier === 'T0' ? 'mlx_lm.server localhost:8100' : tier === 'T1' ? 'api.minimaxi.com' : 'Claude CLI (Max)',
    })
  }

  // Sessions (L1 compute)
  resources.push({
    id: 'sessions', name: `CLI Sessions ${status.sessions.current}/${status.sessions.max}`, type: 'compute', tier: 'T2', level: 'L1',
    status: status.sessions.canCreate ? 'available' : 'busy',
    capabilities: [`当前 ${status.sessions.current}`, `上限 ${status.sessions.max}`, status.sessions.canCreate ? '可创建' : '已满'],
    constraints: status.orphans > 0 ? [`${status.orphans} 孤儿进程`] : [],
    children: [], physicalMapping: 'tmux sessions (free-code)',
  })

  // PR Graph nodes as L2 resources
  for (const node of graph.nodes.filter(n => n.level === 'L2')) {
    resources.push({
      id: node.id, name: node.id.replace('P-L2_', ''), type: 'network', tier: 'T3', level: 'L2',
      status: 'available',
      capabilities: [node.description],
      constraints: [], children: node.children,
      physicalMapping: 'chronicle YAML',
    })
  }

  return resources
}

export default function ResourcePanel({ sphereColor = '#7dd3fc' }: ResourcePanelProps) {
  const [allResources, setAllResources] = useState<readonly Resource[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const [status, graph] = await Promise.all([
          authFetch<Parameters<typeof apiToResources>[0]>('/resources/status'),
          authFetch<Parameters<typeof apiToResources>[1]>('/resources/graph?level=L2'),
        ])
        if (!cancelled) {
          setAllResources(apiToResources(status, graph))
        }
      } catch (err) {
        console.error('[ResourcePanel] fetch failed:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    const timer = setInterval(load, 30000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [])

  const registry = useMemo(() => createRegistry(allResources as Resource[]), [allResources])

  const byLevel = useMemo(() => ({
    L0: registry.listByLevel('L0'),
    L1: registry.listByLevel('L1'),
    L2: registry.listByLevel('L2'),
  } as const), [registry])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3.5 py-2.5 shrink-0"
        style={{ borderBottom: `1px solid ${sphereColor}15` }}
      >
        <Layers size={13} style={{ color: sphereColor }} />
        <span className="text-[13px] font-mono font-semibold" style={{ color: `${sphereColor}cc` }}>
          资源总览
        </span>
        {loading && <RefreshCw size={10} className="animate-spin text-white/20" />}
        <span className="text-[10px] font-mono text-white/25 ml-auto">
          {allResources.length} 项 · 实时
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
              allResources={allResources as Resource[]}
              defaultExpanded={i === 0}
            />
          )
        ))}
      </div>
    </div>
  )
}
