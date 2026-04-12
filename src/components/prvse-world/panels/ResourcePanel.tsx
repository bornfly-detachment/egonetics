/**
 * ResourcePanel — PR Graph 渐进下钻视图
 *
 * 数据源: /api/resources/graph → pr-graph.json（唯一数据源）
 * 交互: L2 → 点击展开 L1 → 点击展开 L0 → 点击展开 Relations
 */

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, Layers, RefreshCw } from 'lucide-react'
import { authFetch } from '@/lib/http'

// ── Types（直接映射 pr-graph.json 结构）─────────────────────────

interface GraphNode {
  id: string
  level: string
  children?: string[]
  dir?: string
  file?: string
  relations?: Record<string, string[]>
}

interface GraphEdge {
  from: string
  type: string
  to: string
}

interface GraphResponse {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

// ── 样式 ─────────────────────────────────────────────────────────

const LEVEL_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  L2: { color: '#c084fc', bg: 'rgba(192,132,252,0.08)', border: 'rgba(192,132,252,0.2)' },
  L1: { color: '#60a5fa', bg: 'rgba(96,165,250,0.08)', border: 'rgba(96,165,250,0.2)' },
  L0: { color: '#94a3b8', bg: 'rgba(148,163,184,0.06)', border: 'rgba(148,163,184,0.15)' },
}

const REL_COLOR: Record<string, string> = {
  depends_on: '#94a3b8',
  serves: '#22c55e',
  constrains: '#ef4444',
  exists_because: '#c084fc',
  validates: '#f59e0b',
  falls_back_to: '#f97316',
  triggers: '#06b6d4',
}

function displayName(id: string): string {
  return id.replace(/^[PRVSE]-L[012](-[A-Z]+)?_/, '').replace(/-/g, ' ')
}

// ── 节点行 ───────────────────────────────────────────────────────

function NodeRow({
  node, edges, sphereColor, onDrillDown,
}: {
  node: GraphNode
  edges: GraphEdge[]
  sphereColor: string
  onDrillDown: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const style = LEVEL_STYLE[node.level] || LEVEL_STYLE.L0
  const hasChildren = (node.children?.length ?? 0) > 0
  const outEdges = edges.filter(e => e.from === node.id)
  const inEdges = edges.filter(e => e.to === node.id)
  const hasRelations = outEdges.length > 0 || inEdges.length > 0

  return (
    <div className="mb-2">
      <button
        onClick={() => hasChildren ? onDrillDown(node.id) : setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg transition-all hover:brightness-110"
        style={{ background: style.bg, border: `1px solid ${style.border}` }}
      >
        <span
          className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
          style={{ color: style.color, background: `${style.color}15` }}
        >
          {node.level}
        </span>

        <span className="text-[13px] font-mono font-medium text-white/80 flex-1 text-left">
          {displayName(node.id)}
        </span>

        {node.file && <span className="text-[9px] font-mono text-white/25">{node.file}</span>}
        {node.dir && <span className="text-[9px] font-mono text-white/25">{node.dir}</span>}

        {hasChildren && (
          <span
            className="text-[10px] font-mono px-1.5 py-0.5 rounded-full"
            style={{ color: sphereColor, background: `${sphereColor}15` }}
          >
            {node.children!.length} &rarr;
          </span>
        )}

        {!hasChildren && hasRelations && (
          expanded
            ? <ChevronDown size={12} className="text-white/30" />
            : <ChevronRight size={12} className="text-white/30" />
        )}
      </button>

      {expanded && !hasChildren && hasRelations && (
        <div className="ml-6 mt-1 space-y-1">
          {outEdges.map((e, i) => (
            <div key={`o${i}`} className="flex items-center gap-1.5 text-[10px] font-mono">
              <span className="text-white/30">&rarr;</span>
              <span style={{ color: REL_COLOR[e.type] || '#6b7280' }}>{e.type}</span>
              <span className="text-white/50">{displayName(e.to)}</span>
            </div>
          ))}
          {inEdges.map((e, i) => (
            <div key={`i${i}`} className="flex items-center gap-1.5 text-[10px] font-mono">
              <span className="text-white/30">&larr;</span>
              <span style={{ color: REL_COLOR[e.type] || '#6b7280' }}>{e.type}</span>
              <span className="text-white/50">{displayName(e.from)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── 主组件 ───────────────────────────────────────────────────────

interface ResourcePanelProps {
  sphereColor?: string
}

export default function ResourcePanel({ sphereColor = '#7dd3fc' }: ResourcePanelProps) {
  const [graph, setGraph] = useState<GraphResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [drillPath, setDrillPath] = useState<string[]>([])

  const currentParent = drillPath.length > 0 ? drillPath[drillPath.length - 1] : null
  const currentLevel = drillPath.length === 0 ? 'L2' : drillPath.length === 1 ? 'L1' : 'L0'

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const url = currentParent
          ? `/resources/graph?level=${currentLevel}&parent=${currentParent}`
          : '/resources/graph?level=L2'
        const data = await authFetch<GraphResponse>(url)
        if (!cancelled) setGraph(data)
      } catch (err) {
        console.error('[ResourcePanel] fetch failed:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [currentParent, currentLevel])

  const drillDown = (id: string) => setDrillPath(prev => [...prev, id])
  const goBack = () => setDrillPath(prev => prev.slice(0, -1))

  return (
    <div className="flex flex-col h-full">
      {/* Header + breadcrumb */}
      <div className="flex items-center gap-2 px-3.5 py-2.5 shrink-0" style={{ borderBottom: `1px solid ${sphereColor}15` }}>
        {drillPath.length > 0 && (
          <button onClick={goBack} className="text-white/40 hover:text-white/70 transition-colors text-[13px] font-mono">&larr;</button>
        )}
        <Layers size={13} style={{ color: sphereColor }} />
        <span className="text-[13px] font-mono font-semibold" style={{ color: `${sphereColor}cc` }}>
          {currentParent ? displayName(currentParent) : 'PR Graph'}
        </span>
        {loading && <RefreshCw size={10} className="animate-spin text-white/20" />}
        <span className="text-[10px] font-mono text-white/20 ml-auto">
          {currentLevel} · {graph?.nodes.filter(n => n.id !== currentParent).length || 0} nodes
        </span>
      </div>

      {/* Breadcrumb path */}
      {drillPath.length > 0 && (
        <div className="flex items-center gap-1 px-3.5 py-1.5 text-[9px] font-mono text-white/25 shrink-0">
          <button onClick={() => setDrillPath([])} className="hover:text-white/50">L2</button>
          {drillPath.map((id, i) => (
            <span key={id} className="flex items-center gap-1">
              <span>&rsaquo;</span>
              <button onClick={() => setDrillPath(drillPath.slice(0, i + 1))} className="hover:text-white/50">
                {displayName(id)}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Nodes */}
      <div className="flex-1 overflow-y-auto px-3 py-3 min-h-0">
        {graph?.nodes
          .filter(n => n.id !== currentParent)
          .map(node => (
            <NodeRow
              key={node.id}
              node={node}
              edges={graph.edges}
              sphereColor={sphereColor}
              onDrillDown={drillDown}
            />
          ))
        }
        {!loading && (!graph || graph.nodes.filter(n => n.id !== currentParent).length === 0) && (
          <div className="text-center py-8 text-[11px] font-mono text-white/20">
            {currentParent ? '该节点无子节点' : '无数据'}
          </div>
        )}
      </div>
    </div>
  )
}
