/**
 * ResourcePanel — PR Graph 树形展开视图
 *
 * 数据源: /api/resources/graph → pr-graph.json
 * 交互: 点击节点原地展开子节点，不换页
 */

import { useState, useEffect, useCallback } from 'react'
import { ChevronDown, ChevronRight, Layers, RefreshCw } from 'lucide-react'
import { authFetch } from '@/lib/http'

// ── Types ────────────────────────────────────────────────────────

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

// ── Style ────────────────────────────────────────────────────────

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

// ── 递归节点 ─────────────────────────────────────────────────────

function PRNode({
  nodeId, depth, nodeMap, edgeMap, loadChildren, sphereColor,
}: {
  nodeId: string
  depth: number
  nodeMap: Map<string, GraphNode>
  edgeMap: Map<string, GraphEdge[]>
  loadChildren: (parentId: string) => Promise<void>
  sphereColor: string
}) {
  const [expanded, setExpanded] = useState(depth === 0) // L2 默认展开
  const [childrenLoaded, setChildrenLoaded] = useState(false)
  const [loading, setLoading] = useState(false)

  const node = nodeMap.get(nodeId)
  if (!node) return null

  const style = LEVEL_STYLE[node.level] || LEVEL_STYLE.L0
  const hasChildren = (node.children?.length ?? 0) > 0
  const outEdges = edgeMap.get(nodeId) || []

  const toggle = useCallback(async () => {
    if (hasChildren && !childrenLoaded) {
      setLoading(true)
      await loadChildren(nodeId)
      setChildrenLoaded(true)
      setLoading(false)
    }
    setExpanded(v => !v)
  }, [hasChildren, childrenLoaded, nodeId, loadChildren])

  const indent = depth * 16

  return (
    <>
      {/* Node row */}
      <button
        onClick={toggle}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all hover:brightness-110 mb-1"
        style={{ background: style.bg, border: `1px solid ${style.border}`, marginLeft: indent }}
      >
        {/* Expand icon */}
        {hasChildren ? (
          loading
            ? <RefreshCw size={11} className="animate-spin shrink-0" style={{ color: style.color }} />
            : expanded
              ? <ChevronDown size={11} className="shrink-0" style={{ color: style.color }} />
              : <ChevronRight size={11} className="shrink-0" style={{ color: style.color }} />
        ) : (
          <span className="w-[11px] shrink-0" />
        )}

        {/* Level badge */}
        <span
          className="text-[9px] font-mono font-bold px-1 py-0.5 rounded shrink-0"
          style={{ color: style.color, background: `${style.color}15` }}
        >
          {node.level}
        </span>

        {/* Name */}
        <span className="text-[12px] font-mono font-medium text-white/80 flex-1 text-left truncate">
          {displayName(nodeId)}
        </span>

        {/* File/dir */}
        {node.file && <span className="text-[9px] font-mono text-white/20 shrink-0">{node.file}</span>}
        {node.dir && !node.file && <span className="text-[9px] font-mono text-white/20 shrink-0">{node.dir}</span>}

        {/* Children count */}
        {hasChildren && (
          <span className="text-[9px] font-mono text-white/25 shrink-0">{node.children!.length}</span>
        )}
      </button>

      {/* Relations (always show if node is expanded and has relations) */}
      {expanded && outEdges.length > 0 && (
        <div className="mb-1 space-y-0.5" style={{ marginLeft: indent + 28 }}>
          {outEdges.map((e, i) => (
            <div key={i} className="flex items-center gap-1.5 text-[9px] font-mono">
              <span style={{ color: REL_COLOR[e.type] || '#6b7280' }}>{e.type}</span>
              <span className="text-white/30">&rarr;</span>
              <span className="text-white/40">{displayName(e.to)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Children (recursive) */}
      {expanded && hasChildren && node.children!.map(childId => (
        <PRNode
          key={childId}
          nodeId={childId}
          depth={depth + 1}
          nodeMap={nodeMap}
          edgeMap={edgeMap}
          loadChildren={loadChildren}
          sphereColor={sphereColor}
        />
      ))}
    </>
  )
}

// ── 主组件 ───────────────────────────────────────────────────────

interface ResourcePanelProps {
  sphereColor?: string
}

export default function ResourcePanel({ sphereColor = '#7dd3fc' }: ResourcePanelProps) {
  const [nodeMap, setNodeMap] = useState<Map<string, GraphNode>>(new Map())
  const [edgeMap, setEdgeMap] = useState<Map<string, GraphEdge[]>>(new Map())
  const [rootIds, setRootIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  // 加载初始 L2
  useEffect(() => {
    let cancelled = false
    authFetch<{ nodes: GraphNode[]; edges: GraphEdge[] }>('/resources/graph?level=L2')
      .then(data => {
        if (cancelled) return
        const nm = new Map<string, GraphNode>()
        const em = new Map<string, GraphEdge[]>()
        for (const n of data.nodes) nm.set(n.id, n)
        for (const e of data.edges) {
          if (!em.has(e.from)) em.set(e.from, [])
          em.get(e.from)!.push(e)
        }
        setNodeMap(nm)
        setEdgeMap(em)
        setRootIds(data.nodes.map(n => n.id))
        setLoading(false)
      })
      .catch(() => setLoading(false))
    return () => { cancelled = true }
  }, [])

  // 懒加载子节点
  const loadChildren = useCallback(async (parentId: string) => {
    const parentNode = nodeMap.get(parentId)
    if (!parentNode?.children?.length) return

    const level = parentNode.level === 'L2' ? 'L1' : 'L0'
    try {
      const data = await authFetch<{ nodes: GraphNode[]; edges: GraphEdge[] }>(
        `/resources/graph?level=${level}&parent=${parentId}`
      )
      setNodeMap(prev => {
        const next = new Map(prev)
        for (const n of data.nodes) {
          if (n.id !== parentId) next.set(n.id, n)
        }
        return next
      })
      setEdgeMap(prev => {
        const next = new Map(prev)
        for (const e of data.edges) {
          if (!next.has(e.from)) next.set(e.from, [])
          const arr = next.get(e.from)!
          if (!arr.some(x => x.to === e.to && x.type === e.type)) arr.push(e)
        }
        return next
      })
    } catch (err) {
      console.error('[ResourcePanel] loadChildren failed:', err)
    }
  }, [nodeMap])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3.5 py-2.5 shrink-0" style={{ borderBottom: `1px solid ${sphereColor}15` }}>
        <Layers size={13} style={{ color: sphereColor }} />
        <span className="text-[13px] font-mono font-semibold" style={{ color: `${sphereColor}cc` }}>
          PR Graph
        </span>
        {loading && <RefreshCw size={10} className="animate-spin text-white/20" />}
        <span className="text-[10px] font-mono text-white/20 ml-auto">
          {nodeMap.size} nodes
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 min-h-0">
        {rootIds.map(id => (
          <PRNode
            key={id}
            nodeId={id}
            depth={0}
            nodeMap={nodeMap}
            edgeMap={edgeMap}
            loadChildren={loadChildren}
            sphereColor={sphereColor}
          />
        ))}
      </div>
    </div>
  )
}
