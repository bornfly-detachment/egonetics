/**
 * PRVSEGraph — UI_1 (v2)
 * SVG 画布：拖拽节点 + 连边（带约束类型+层级颜色）+ 点击展开 PatternCell
 *
 * 边类型（对应 hm_protocol 宪法）：
 *   directed          — 普通有向边 →
 *   constraint        — 单向制约  A -×→ B（红色，中点带 × 标记）
 *   mutual_constraint — 互相制约  A ←×→ B（红色，双向箭头 + × 标记）
 *   contains          — 包含关系  A ⊂ B（灰色虚线）
 *   derives           — 推导/演化 A ⇒ B（紫色粗线）
 *   signal            — 信号流    A ~~> B（灰色动态虚线）
 *
 * 层级颜色：l0=#3b82f6  l1=#10b981  l2=#8b5cf6
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'lucide-react'
import { authFetch } from '@/lib/http'
import { useTokens } from '@/design/TokenProvider'
import { usePRVSEConstraint } from '@/design/primitives'
import PatternCell, { type PRVSENode, type NodeType } from './PatternCell'

interface PRVSEEdge {
  id: string
  task_id: string
  source_id: string
  target_id: string
  edge_type: string
  label: string
  constraint_type: string   // directed|constraint|mutual_constraint|contains|derives|signal
  level: string             // l0|l1|l2
}

const NODE_W = 110
const NODE_H = 44

const NODE_TYPES: NodeType[] = ['P', 'R', 'V', 'S', 'E']
const NODE_LABELS: Record<NodeType, string> = {
  P: 'Pattern', R: 'Relation', V: 'Value', S: 'State', E: 'Evolution',
}

// ── 边路径 ────────────────────────────────────────────────────────
function EdgePath({ edge, nodes }: { edge: PRVSEEdge; nodes: PRVSENode[] }) {
  const { edge: edgeTokens, layer: layerTokens } = useTokens()
  const { showCrossMarker, isBidirectional } = usePRVSEConstraint(edge.constraint_type)

  const src = nodes.find(n => n.id === edge.source_id)
  const dst = nodes.find(n => n.id === edge.target_id)
  if (!src || !dst) return null

  const tok = edgeTokens[edge.constraint_type] ?? edgeTokens.directed
  const levelColor = (layerTokens[edge.level] ?? layerTokens.l1).border

  // contains/signal 用层级颜色，其余用边类型颜色
  const color = (edge.constraint_type === 'contains' || edge.constraint_type === 'signal')
    ? levelColor : tok.color

  const x1 = src.x + NODE_W, y1 = src.y + NODE_H / 2
  const x2 = dst.x,          y2 = dst.y + NODE_H / 2
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  const uid = edge.id.slice(-6)

  return (
    <g>
      <defs>
        <marker id={`m-${uid}-fwd`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill={color} />
        </marker>
        {isBidirectional && (
          <marker id={`m-${uid}-bwd`} markerWidth="8" markerHeight="8" refX="2" refY="3"
            orient="auto-start-reverse">
            <path d="M0,0 L0,6 L8,3 z" fill={color} />
          </marker>
        )}
      </defs>

      {isBidirectional && (
        <path d={`M${x2},${y2} C${mx},${y2} ${mx},${y1} ${x1},${y1}`}
          fill="none" stroke={color} strokeWidth={tok.width} strokeDasharray={tok.dash}
          markerEnd={`url(#m-${uid}-fwd)`} />
      )}
      <path d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
        fill="none" stroke={color} strokeWidth={tok.width} strokeDasharray={tok.dash}
        markerEnd={`url(#m-${uid}-fwd)`}
        markerStart={isBidirectional ? `url(#m-${uid}-bwd)` : undefined} />

      {showCrossMarker && (
        <text x={mx} y={my - 3} textAnchor="middle" fontSize="12" fontWeight="bold" fill={color}>×</text>
      )}
      {edge.label && (
        <text x={mx} y={my + (showCrossMarker ? 14 : -4)}
          textAnchor="middle" fontSize="9" fill="#6b7280">{edge.label}</text>
      )}
      <text x={mx + 8} y={my + 4} fontSize="8" fill={levelColor} opacity={0.6}>
        {edge.level}
      </text>
    </g>
  )
}

export default function PRVSEGraph({ taskId }: { taskId: string }) {
  const { node: nodeTokens, edge: edgeTokens, layer: layerTokens } = useTokens()

  const [nodes, setNodes] = useState<PRVSENode[]>([])
  const [edges, setEdges] = useState<PRVSEEdge[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<PRVSENode | null>(null)
  const [linking, setLinking] = useState<string | null>(null)
  const [linkConstraint, setLinkConstraint] = useState('directed')
  const [linkLevel, setLinkLevel] = useState('l1')
  const [scope, setScope] = useState<'global' | 'local'>('global')

  const dragging = useRef<{ id: string; ox: number; oy: number } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await authFetch<{ nodes: PRVSENode[]; edges: PRVSEEdge[] }>(`/tasks/${taskId}/graph`)
      setNodes(data.nodes.map(n => ({
        ...n,
        l0_data: n.l0_data ?? {},
        l1_data: n.l1_data ?? {},
        l2_data: n.l2_data ?? {},
        permission_level: n.permission_level ?? 0,
        slider_value: n.slider_value ?? 0.5,
      })))
      setEdges(data.edges.map(e => ({
        ...e,
        constraint_type: e.constraint_type ?? 'directed',
        level: e.level ?? 'l1',
      })))
    } finally {
      setLoading(false)
    }
  }, [taskId])

  useEffect(() => { load() }, [load])

  const addNode = useCallback(async (type: NodeType) => {
    const x = 80 + Math.random() * 400
    const y = 80 + Math.random() * 250
    const node = await authFetch<PRVSENode>(`/tasks/${taskId}/graph/nodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ node_type: type, label: NODE_LABELS[type], x, y }),
    })
    setNodes(prev => [...prev, {
      ...node,
      l0_data: {}, l1_data: {}, l2_data: {},
      permission_level: 0, slider_value: 0.5,
    }])
  }, [taskId])

  const deleteNode = useCallback(async (nodeId: string) => {
    await authFetch(`/tasks/${taskId}/graph/nodes/${nodeId}`, { method: 'DELETE' })
    setNodes(prev => prev.filter(n => n.id !== nodeId))
    setEdges(prev => prev.filter(e => e.source_id !== nodeId && e.target_id !== nodeId))
    if (selected?.id === nodeId) setSelected(null)
  }, [taskId, selected])

  const onMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    if (linking) return
    e.stopPropagation()
    const svg = svgRef.current!
    const pt = svg.createSVGPoint()
    pt.x = e.clientX; pt.y = e.clientY
    const svgPt = pt.matrixTransform(svg.getScreenCTM()!.inverse())
    const node = nodes.find(n => n.id === nodeId)!
    dragging.current = { id: nodeId, ox: svgPt.x - node.x, oy: svgPt.y - node.y }
  }, [nodes, linking])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return
    const svg = svgRef.current!
    const pt = svg.createSVGPoint()
    pt.x = e.clientX; pt.y = e.clientY
    const svgPt = pt.matrixTransform(svg.getScreenCTM()!.inverse())
    const { id, ox, oy } = dragging.current
    setNodes(prev => prev.map(n => n.id === id ? { ...n, x: svgPt.x - ox, y: svgPt.y - oy } : n))
  }, [])

  const onMouseUp = useCallback(async () => {
    if (!dragging.current) return
    const { id } = dragging.current
    dragging.current = null
    const node = nodes.find(n => n.id === id)
    if (node) {
      await authFetch(`/tasks/${taskId}/graph/nodes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x: node.x, y: node.y }),
      })
    }
  }, [nodes, taskId])

  const onNodeClick = useCallback((nodeId: string) => {
    if (linking) {
      if (linking === nodeId) { setLinking(null); return }
      authFetch<PRVSEEdge>(`/tasks/${taskId}/graph/edges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_id: linking, target_id: nodeId,
          constraint_type: linkConstraint, level: linkLevel,
        }),
      }).then(edge => {
        setEdges(prev => [...prev, edge])
        setLinking(null)
      })
    } else {
      const node = nodes.find(n => n.id === nodeId)
      if (node) setSelected(node)
    }
  }, [linking, nodes, taskId, linkConstraint, linkLevel])

  const deleteEdge = useCallback(async (edgeId: string) => {
    await authFetch(`/tasks/${taskId}/graph/edges/${edgeId}`, { method: 'DELETE' })
    setEdges(prev => prev.filter(e => e.id !== edgeId))
  }, [taskId])

  const onSave = useCallback((updated: Partial<PRVSENode>) => {
    setNodes(prev => prev.map(n => n.id === updated.id ? { ...n, ...updated } : n))
    setSelected(prev => prev && prev.id === updated.id ? { ...prev, ...updated } : prev)
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-full text-white/30 text-sm">加载中…</div>
  )

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-hidden">
      {/* 工具栏 */}
      <div className="shrink-0 flex flex-wrap items-center gap-2 px-4 py-2 border-b border-white/[0.06]">
        <span className="text-xs text-white/40 mr-1">节点：</span>
        {NODE_TYPES.map(t => {
          const tok = nodeTokens[t]
          return (
            <button key={t}
              onClick={() => addNode(t)}
              className="px-2 py-0.5 rounded text-[11px] font-bold border transition-colors"
              style={{ color: tok?.text, borderColor: (tok?.border ?? '') + '60', background: tok?.bg }}
            >
              + {t}
            </button>
          )
        })}

        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {/* 连线类型选择 */}
          <select
            value={linkConstraint}
            onChange={e => setLinkConstraint(e.target.value)}
            className="text-[10px] bg-[#1a1a1a] border border-white/10 rounded px-1.5 py-0.5 text-white/50 outline-none"
            title="边类型"
          >
            {Object.entries(edgeTokens).map(([key, tok]) => (
              <option key={key} value={key}>{tok.label}</option>
            ))}
          </select>

          {/* 层级选择 */}
          <select
            value={linkLevel}
            onChange={e => setLinkLevel(e.target.value)}
            className="text-[10px] bg-[#1a1a1a] border border-white/10 rounded px-1.5 py-0.5 outline-none"
            style={{ color: layerTokens[linkLevel]?.border }}
            title="层级"
          >
            <option value="l0">l₀ 物理</option>
            <option value="l1">l₁ 规律</option>
            <option value="l2">l₂ 认知</option>
          </select>

          {/* 连线模式按钮 */}
          <button
            onClick={() => setLinking(linking ? null : '__pick__')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] border transition-colors ${
              linking ? 'border-blue-400/60 text-blue-300 bg-blue-500/10' : 'border-white/10 text-white/40 hover:border-white/20'
            }`}
          >
            <Link size={11} />
            {linking ? '选择目标…' : '连线'}
          </button>

          {/* scope */}
          <div className="flex rounded border border-white/10 overflow-hidden text-[11px]">
            {(['global', 'local'] as const).map(s => (
              <button key={s}
                onClick={() => setScope(s)}
                className={`px-2 py-0.5 transition-colors ${
                  scope === s ? 'bg-white/10 text-white/70' : 'text-white/30 hover:text-white/50'
                }`}
              >
                {s === 'global' ? '全局' : '局部'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 画布 + 详情面板 */}
      <div className="flex flex-1 overflow-hidden">
        <svg
          ref={svgRef}
          className="flex-1 h-full"
          style={{ background: '#0a0a0a', cursor: linking ? 'crosshair' : 'default' }}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
        >
          <defs>{/* EdgePath 内部各自定义 marker，无需全局 defs */}</defs>

          {/* 边 */}
          {edges.map(e => (
            <g key={e.id} onClick={() => deleteEdge(e.id)} style={{ cursor: 'pointer' }} opacity={0.9}>
              <EdgePath edge={e} nodes={nodes} />
            </g>
          ))}

          {/* 节点 */}
          {nodes.map(node => {
            const tok = nodeTokens[node.node_type] ?? nodeTokens.P
            const isSelected = selected?.id === node.id
            const isLinkSrc = linking === node.id
            const permLayerKey = `l${node.permission_level}` as 'l0' | 'l1' | 'l2'
            const permColor = (layerTokens[permLayerKey] ?? layerTokens.l0).border
            return (
              <g key={node.id}
                transform={`translate(${node.x},${node.y})`}
                onMouseDown={e => onMouseDown(e, node.id)}
                onClick={() => onNodeClick(node.id)}
                style={{ cursor: 'grab' }}
              >
                <rect
                  width={NODE_W} height={NODE_H} rx={6}
                  fill={tok.bg}
                  stroke={isSelected || isLinkSrc ? tok.text : tok.border}
                  strokeWidth={isSelected || isLinkSrc ? 2 : 1}
                />
                <rect x={0} y={0} width={3} height={NODE_H} rx={6} fill={permColor} opacity={0.8} />
                <text x={12} y={16} fontSize="11" fontWeight="bold" fill={tok.text}>
                  {node.node_type}
                </text>
                <text x={12} y={29} fontSize="10" fill="#9ca3af"
                  textLength={NODE_W - 36} lengthAdjust="spacing">
                  {node.label.slice(0, 14)}
                </text>
                <text x={NODE_W - 18} y={NODE_H - 5} fontSize="8" fill={permColor} opacity={0.7}
                  textAnchor="middle">
                  l{node.permission_level}
                </text>
                {/* 删除按钮 */}
                <g transform={`translate(${NODE_W - 14}, 4)`}
                  onClick={e => { e.stopPropagation(); deleteNode(node.id) }}
                  style={{ cursor: 'pointer', opacity: 0.4 }}
                >
                  <circle r={7} fill="#1a1a1a" />
                  <text x={-3.5} y={4} fontSize="10" fill="#ef4444">×</text>
                </g>
              </g>
            )
          })}

          {nodes.length === 0 && (
            <text x="50%" y="50%" textAnchor="middle" fill="#374151" fontSize="14">
              点击工具栏添加节点
            </text>
          )}
        </svg>

        {/* PatternCell 详情面板 */}
        {selected && (
          <div className="w-[440px] shrink-0 border-l border-white/[0.06] overflow-hidden">
            <PatternCell
              node={selected}
              onClose={() => setSelected(null)}
              onSave={onSave}
            />
          </div>
        )}
      </div>
    </div>
  )
}
