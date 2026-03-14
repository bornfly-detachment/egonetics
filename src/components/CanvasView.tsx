import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, X, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react'
import { authFetch } from '../lib/http'
import {
  listCanvasNodes, addCanvasNode, updateCanvasNode, removeCanvasNode,
  type CanvasNode,
} from '../lib/canvas-api'
import { getRelations, createRelation } from '../lib/block-graph-api'
import type { Relation } from './types'

// ── Types ─────────────────────────────────────────────────────────

interface EntityData {
  id: string
  entityType: string
  title: string
  icon: string
  status?: string
}

const CARD_W = 264

function clamp(v: number, lo: number, hi: number) {
  return Math.min(Math.max(v, lo), hi)
}

// ── SVG Edge ──────────────────────────────────────────────────────

const SvgEdge: React.FC<{
  x1: number; y1: number; x2: number; y2: number
  label: string
  id: string
  onClick: () => void
}> = ({ x1, y1, x2, y2, label, onClick }) => {
  const dx = Math.max(Math.abs(x2 - x1) * 0.45, 60)
  const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2 - 6

  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      <path d={d} fill="none" stroke="transparent" strokeWidth={14} />
      <path d={d} fill="none" stroke="rgba(139,92,246,0.45)" strokeWidth={1.5} markerEnd="url(#arrowhead)" />
      {label && (
        <>
          <rect x={mx - 34} y={my - 9} width={68} height={18} rx={4}
            fill="rgba(16,10,32,0.92)" stroke="rgba(139,92,246,0.3)" strokeWidth={1} />
          <text x={mx} y={my + 4} textAnchor="middle" fontSize={10}
            fill="#c4b5fd" fontFamily="system-ui,sans-serif"
            style={{ pointerEvents: 'none', userSelect: 'none' }}>
            {label.length > 8 ? label.slice(0, 8) + '…' : label}
          </text>
        </>
      )}
    </g>
  )
}

// ── Entity Card ───────────────────────────────────────────────────

const TYPE_STYLE: Record<string, { border: string; head: string; badge: string }> = {
  task:    { border: 'border-blue-500/25',    head: 'bg-blue-500/8',    badge: 'bg-blue-400/10 text-blue-400' },
  page:    { border: 'border-emerald-500/25', head: 'bg-emerald-500/8', badge: 'bg-emerald-400/10 text-emerald-400' },
  theory:  { border: 'border-purple-500/25',  head: 'bg-purple-500/8',  badge: 'bg-purple-400/10 text-purple-400' },
  memory:  { border: 'border-amber-500/25',   head: 'bg-amber-500/8',   badge: 'bg-amber-400/10 text-amber-400' },
  chronicle: { border: 'border-orange-500/25', head: 'bg-orange-500/8', badge: 'bg-orange-400/10 text-orange-400' },
}

interface CardProps {
  node: CanvasNode
  entity: EntityData | undefined
  nodeRelations: Relation[]
  isConnectMode: boolean
  isConnectSource: boolean
  onMouseDown: (e: React.MouseEvent) => void
  onRemove: () => void
  onStartConnect: () => void
  onBecomeTarget: () => void
  onExpandLevel: (l: number) => void
}

const EntityCard: React.FC<CardProps> = ({
  node, entity, nodeRelations, isConnectMode, isConnectSource,
  onMouseDown, onRemove, onStartConnect, onBecomeTarget, onExpandLevel,
}) => {
  const s = TYPE_STYLE[node.entity_type] ?? { border: 'border-white/10', head: 'bg-white/5', badge: 'bg-white/5 text-neutral-400' }

  return (
    <div
      className={`absolute rounded-xl border shadow-2xl overflow-hidden select-none ${s.border} bg-[#0f0f18]
        ${isConnectMode && !isConnectSource ? 'cursor-crosshair ring-1 ring-blue-400/30 hover:ring-2 hover:ring-blue-400/60' : ''}
        ${isConnectSource ? 'ring-2 ring-purple-400' : ''}`}
      style={{ left: node.x, top: node.y, width: CARD_W }}
      onMouseDown={e => {
        if ((e.target as HTMLElement).closest('button')) return
        if (isConnectMode) { e.stopPropagation(); onBecomeTarget() }
        else onMouseDown(e)
      }}
    >
      {/* Header */}
      <div className={`flex items-center gap-2 px-3 py-2.5 ${s.head} border-b border-white/5 cursor-grab active:cursor-grabbing`}>
        <span className="text-base leading-none">{entity?.icon ?? '📄'}</span>
        <span className="flex-1 text-[13px] font-medium text-white truncate min-w-0">
          {entity?.title ?? <span className="text-neutral-600 italic text-xs">加载中…</span>}
        </span>
        <div className="flex items-center gap-0.5 shrink-0">
          {/* L1-L4 expand dots */}
          {([0, 1, 2, 3] as const).map(l => (
            <button
              key={l}
              onClick={e => { e.stopPropagation(); onExpandLevel(l) }}
              title={`展开 L${l + 1}`}
              className={`w-3.5 h-3.5 rounded-sm text-[8px] leading-none flex items-center justify-center transition-colors
                ${node.expanded_level >= l ? 'bg-primary-500/30 text-primary-300' : 'bg-white/5 text-neutral-700 hover:bg-white/10 hover:text-neutral-500'}`}
            >●</button>
          ))}
          {/* Connect */}
          <button
            onClick={e => { e.stopPropagation(); onStartConnect() }}
            title="建立关系"
            className="w-5 h-5 ml-0.5 rounded text-neutral-600 hover:text-purple-400 hover:bg-purple-500/10 transition-all flex items-center justify-center text-sm">
            ↗
          </button>
          {/* Remove */}
          <button
            onClick={e => { e.stopPropagation(); onRemove() }}
            className="w-5 h-5 rounded text-neutral-600 hover:text-red-400 hover:bg-red-500/10 transition-all flex items-center justify-center">
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Type badge + status */}
      <div className="px-3 py-1.5 flex items-center gap-2">
        <span className={`text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded font-semibold ${s.badge}`}>
          {node.entity_type}
        </span>
        {entity?.status && (
          <span className="text-[10px] text-neutral-600">{entity.status}</span>
        )}
      </div>

      {/* Relations panel (L3+) */}
      {node.expanded_level >= 2 && nodeRelations.length > 0 && (
        <div className="border-t border-white/5 px-3 py-2 space-y-1">
          <p className="text-[9px] text-neutral-700 uppercase tracking-wider mb-1">
            关系 ({nodeRelations.length})
          </p>
          {nodeRelations.slice(0, 4).map(r => (
            <p key={r.id} className="text-[11px] text-neutral-500 truncate">→ {r.title || '(未命名)'}</p>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Relation Form ─────────────────────────────────────────────────

const RelationForm: React.FC<{
  sourceEntity?: EntityData
  targetEntity?: EntityData
  onConfirm: (title: string, description: string) => Promise<void>
  onCancel: () => void
}> = ({ sourceEntity, targetEntity, onConfirm, onCancel }) => {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  const handleConfirm = async () => {
    if (!title.trim()) return
    setSaving(true)
    await onConfirm(title.trim(), description.trim())
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div
        className="bg-[#16141e] border border-purple-500/20 rounded-2xl p-5 w-full max-w-sm space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="font-semibold text-white text-sm">建立关系</h3>

        {/* Source → Target preview */}
        <div className="flex items-center gap-2 text-xs">
          <span className="flex-1 px-2 py-1.5 bg-white/5 rounded text-neutral-300 truncate text-center">
            {sourceEntity?.icon} {sourceEntity?.title ?? '…'}
          </span>
          <span className="text-purple-400 font-bold shrink-0">→</span>
          <span className="flex-1 px-2 py-1.5 bg-white/5 rounded text-neutral-300 truncate text-center">
            {targetEntity?.icon} {targetEntity?.title ?? '…'}
          </span>
        </div>

        <div className="space-y-2">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            autoFocus
            placeholder="关系标题（包含、推导出、基于、演化为…）"
            className="input-field w-full text-sm"
            onKeyDown={e => { if (e.key === 'Enter') handleConfirm() }}
          />
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="描述（可选）"
            rows={2}
            className="input-field w-full text-sm resize-none"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="btn-secondary text-sm">取消</button>
          <button
            onClick={handleConfirm}
            disabled={!title.trim() || saving}
            className="btn-primary text-sm flex items-center gap-2"
          >
            {saving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            确认
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Sidebar Item ──────────────────────────────────────────────────

const SidebarItem: React.FC<{
  icon: string; title: string; onCanvas: boolean; onClick: () => void
  hoverClass: string
}> = ({ icon, title, onCanvas, onClick, hoverClass }) => (
  <button
    onClick={onClick}
    disabled={onCanvas}
    title={onCanvas ? '已在画布上' : `添加到画布`}
    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-all text-[11px]
      ${onCanvas ? 'opacity-35 cursor-not-allowed text-neutral-600' : `text-neutral-400 ${hoverClass}`}`}
  >
    <span className="text-sm leading-none">{icon}</span>
    <span className="truncate flex-1">{title}</span>
    {onCanvas && <span className="text-[9px] text-neutral-700 shrink-0">✓</span>}
  </button>
)

// ── CanvasView ────────────────────────────────────────────────────

const CanvasView: React.FC = () => {
  const { canvasId } = useParams<{ canvasId: string }>()
  const navigate = useNavigate()

  const [nodes, setNodes] = useState<CanvasNode[]>([])
  const [entityMap, setEntityMap] = useState<Record<string, EntityData>>({})
  const [relations, setRelations] = useState<Relation[]>([])
  const [allTasks, setAllTasks] = useState<any[]>([])
  const [allPages, setAllPages] = useState<any[]>([])
  const [canvasTitle, setCanvasTitle] = useState('画布')
  const [loading, setLoading] = useState(true)

  const [pan, setPan] = useState({ x: 120, y: 80 })
  const [zoom, setZoom] = useState(1)

  // Pan drag state
  const [panStart, setPanStart] = useState<{ mx: number; my: number; px: number; py: number } | null>(null)
  // Node drag state
  const [dragging, setDragging] = useState<{
    nodeId: string; startX: number; startY: number; msx: number; msy: number
  } | null>(null)

  const [connecting, setConnecting] = useState<{ fromNodeId: string } | null>(null)
  const [relForm, setRelForm] = useState<{ srcNodeId: string; tgtNodeId: string } | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>()

  // ── Load ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!canvasId) return
    loadAll()
  }, [canvasId])

  const loadAll = async () => {
    if (!canvasId) return
    try {
      const [canvasData, nodesData, tasksResp, pages] = await Promise.all([
        authFetch<any>(`/canvases/${canvasId}`).catch(() => null),
        listCanvasNodes(canvasId),
        authFetch<any>('/tasks').catch(() => []),
        authFetch<any[]>('/pages').catch(() => []),
      ])

      if (canvasData?.title) setCanvasTitle(canvasData.title)

      // Tasks API returns { tasks: [...] } or plain array
      const tasks: any[] = Array.isArray(tasksResp)
        ? tasksResp
        : (tasksResp?.tasks ?? [])

      const map: Record<string, EntityData> = {}
      tasks.forEach((t: any) => {
        map[`task:${t.id}`] = { id: t.id, entityType: 'task', title: t.name || t.title || '无标题', icon: t.icon || '📋', status: t.column_id || t.status }
      })
      ;(pages as any[]).forEach(p => {
        const type = p.pageType || 'page'
        map[`${type}:${p.id}`] = { id: p.id, entityType: type, title: p.title || '无标题', icon: p.icon || '📄' }
      })

      setAllTasks(tasks)
      setAllPages(pages as any[])
      setEntityMap(map)
      setNodes(nodesData)

      if (nodesData.length > 0) {
        loadRelations(nodesData)
      }
    } finally {
      setLoading(false)
    }
  }

  const loadRelations = async (nodeList: CanvasNode[]) => {
    try {
      const all: Relation[] = []
      const seen = new Set<string>()
      for (const node of nodeList) {
        const [bySrc, byTgt] = await Promise.all([
          getRelations({ source_id: node.entity_id, source_type: node.entity_type as any }),
          getRelations({ target_id: node.entity_id, target_type: node.entity_type as any }),
        ])
        for (const r of [...bySrc, ...byTgt]) {
          if (!seen.has(r.id)) { seen.add(r.id); all.push(r) }
        }
      }
      setRelations(all)
    } catch { /* ignore */ }
  }

  const getEntity = (node: CanvasNode): EntityData | undefined =>
    entityMap[`${node.entity_type}:${node.entity_id}`]

  // ── Wheel zoom ───────────────────────────────────────────────

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const factor = e.deltaY < 0 ? 1.12 : 0.9
    setZoom(prev => {
      const nz = clamp(prev * factor, 0.12, 3)
      setPan(p => ({
        x: mx - (mx - p.x) * (nz / prev),
        y: my - (my - p.y) * (nz / prev),
      }))
      return nz
    })
  }, [])

  // ── Mouse handlers ───────────────────────────────────────────

  const handleBgMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    if (connecting) { setConnecting(null); return }
    setPanStart({ mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y })
  }, [connecting, pan])

  const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    if (connecting) return
    e.stopPropagation()
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return
    setDragging({ nodeId, startX: node.x, startY: node.y, msx: e.clientX, msy: e.clientY })
  }, [nodes, connecting])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (panStart) {
      setPan({ x: panStart.px + (e.clientX - panStart.mx), y: panStart.py + (e.clientY - panStart.my) })
    }
    if (dragging) {
      const dx = (e.clientX - dragging.msx) / zoom
      const dy = (e.clientY - dragging.msy) / zoom
      setNodes(prev => prev.map(n =>
        n.id === dragging.nodeId ? { ...n, x: dragging.startX + dx, y: dragging.startY + dy } : n
      ))
    }
  }, [panStart, dragging, zoom])

  const handleMouseUp = useCallback(() => {
    if (dragging && canvasId) {
      const node = nodes.find(n => n.id === dragging.nodeId)
      if (node) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = setTimeout(() => {
          updateCanvasNode(canvasId, node.id, { x: node.x, y: node.y }).catch(() => {})
        }, 400)
      }
    }
    setPanStart(null)
    setDragging(null)
  }, [dragging, nodes, canvasId])

  // ── Add entity ───────────────────────────────────────────────

  const addEntity = async (entityType: string, entityId: string) => {
    if (!canvasId) return
    if (nodes.some(n => n.entity_type === entityType && n.entity_id === entityId)) return
    const rect = containerRef.current?.getBoundingClientRect()
    const cx = rect ? (rect.width / 2 - pan.x) / zoom : 200
    const cy = rect ? (rect.height / 2 - pan.y) / zoom : 150
    const x = cx - CARD_W / 2 + (Math.random() - 0.5) * 120
    const y = cy - 40 + (Math.random() - 0.5) * 80
    try {
      const newNode = await addCanvasNode(canvasId, { entity_type: entityType, entity_id: entityId, x, y })
      setNodes(prev => [...prev, newNode])
      // Load relations for the new node
      loadRelations([newNode])
    } catch { /* ignore */ }
  }

  // ── Remove node ──────────────────────────────────────────────

  const removeNode = async (nodeId: string) => {
    if (!canvasId) return
    try {
      await removeCanvasNode(canvasId, nodeId)
      setNodes(prev => prev.filter(n => n.id !== nodeId))
    } catch { /* ignore */ }
  }

  // ── Expand level ─────────────────────────────────────────────

  const setExpandLevel = (nodeId: string, level: number) => {
    if (!canvasId) return
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, expanded_level: level } : n))
    updateCanvasNode(canvasId, nodeId, { expanded_level: level }).catch(() => {})
  }

  // ── Connection flow ──────────────────────────────────────────

  const confirmRelation = async (title: string, description: string) => {
    if (!relForm) return
    const srcNode = nodes.find(n => n.id === relForm.srcNodeId)
    const tgtNode = nodes.find(n => n.id === relForm.tgtNodeId)
    if (!srcNode || !tgtNode) { setRelForm(null); return }
    try {
      const rel = await createRelation({
        title,
        source_type: srcNode.entity_type as any,
        source_id: srcNode.entity_id,
        target_type: tgtNode.entity_type as any,
        target_id: tgtNode.entity_id,
        description,
      })
      setRelations(prev => [...prev, rel])
    } catch { /* ignore */ }
    setRelForm(null)
  }

  // ── Edge computation ─────────────────────────────────────────

  const canvasEntitySet = new Set(nodes.map(n => `${n.entity_type}:${n.entity_id}`))
  const visibleEdges = relations.filter(r =>
    canvasEntitySet.has(`${r.source_type}:${r.source_id}`) &&
    canvasEntitySet.has(`${r.target_type}:${r.target_id}`)
  )
  const getNodeForEntity = (type: string, id: string) =>
    nodes.find(n => n.entity_type === type && n.entity_id === id)

  // ── Sidebar data ─────────────────────────────────────────────

  const onCanvasSet = new Set(nodes.map(n => `${n.entity_type}:${n.entity_id}`))

  // ── Render ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const relFormSrc = relForm ? nodes.find(n => n.id === relForm.srcNodeId) : undefined
  const relFormTgt = relForm ? nodes.find(n => n.id === relForm.tgtNodeId) : undefined

  return (
    <div className="flex h-full -m-6 overflow-hidden" style={{ height: 'calc(100vh - 120px)' }}>

      {/* ── Sidebar ── */}
      <aside className="w-52 shrink-0 border-r border-white/8 bg-[#0c0c14] flex flex-col">
        <div className="p-3 border-b border-white/8">
          <button
            onClick={() => navigate('/egonetics')}
            className="flex items-center gap-2 text-neutral-600 hover:text-neutral-300 transition-colors text-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            画布列表
          </button>
          <p className="text-sm font-medium text-white mt-2 truncate">{canvasTitle}</p>
        </div>

        <div className="flex-1 overflow-y-auto py-2 space-y-3 px-1">
          {/* Tasks */}
          {allTasks.length > 0 && (
            <div>
              <p className="text-[9px] uppercase tracking-widest text-neutral-700 px-2 mb-1">
                任务 ({allTasks.length})
              </p>
              {allTasks.map((t: any) => (
                <SidebarItem
                  key={t.id}
                  icon={t.icon || '📋'}
                  title={t.name || t.title || '无标题'}
                  onCanvas={onCanvasSet.has(`task:${t.id}`)}
                  onClick={() => addEntity('task', t.id)}
                  hoverClass="hover:bg-blue-500/10 hover:text-blue-300"
                />
              ))}
            </div>
          )}

          {/* Pages */}
          {allPages.length > 0 && (
            <div>
              <p className="text-[9px] uppercase tracking-widest text-neutral-700 px-2 mb-1">
                页面 ({allPages.length})
              </p>
              {(allPages as any[]).map(p => {
                const type = p.pageType || 'page'
                return (
                  <SidebarItem
                    key={p.id}
                    icon={p.icon || '📄'}
                    title={p.title || '无标题'}
                    onCanvas={onCanvasSet.has(`${type}:${p.id}`)}
                    onClick={() => addEntity(type, p.id)}
                    hoverClass="hover:bg-emerald-500/10 hover:text-emerald-300"
                  />
                )
              })}
            </div>
          )}
        </div>

        {/* Zoom controls */}
        <div className="p-2 border-t border-white/8 flex items-center gap-1.5">
          <button
            onClick={() => setZoom(z => clamp(z * 0.8, 0.12, 3))}
            className="w-6 h-6 rounded bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-600 hover:text-neutral-300 transition-colors">
            <ZoomOut className="w-3 h-3" />
          </button>
          <button
            onClick={() => setZoom(z => clamp(z * 1.25, 0.12, 3))}
            className="w-6 h-6 rounded bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-600 hover:text-neutral-300 transition-colors">
            <ZoomIn className="w-3 h-3" />
          </button>
          <button
            onClick={() => { setZoom(1); setPan({ x: 120, y: 80 }) }}
            className="w-6 h-6 rounded bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-600 hover:text-neutral-300 transition-colors"
            title="重置视图">
            <RefreshCw className="w-3 h-3" />
          </button>
          <span className="text-[10px] text-neutral-700 ml-auto">{Math.round(zoom * 100)}%</span>
        </div>
      </aside>

      {/* ── Canvas ── */}
      <div className="flex-1 flex flex-col bg-[#080810] relative min-w-0">

        {/* Toolbar */}
        <div className="px-4 py-2 border-b border-white/8 flex items-center gap-3 bg-[#0c0c14] shrink-0">
          <span className="text-xs text-neutral-600">
            {nodes.length} 节点 · {visibleEdges.length} 关系
          </span>
          {connecting && (
            <span className="ml-auto flex items-center gap-2 text-xs text-purple-300 bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
              连接模式 — 点击目标节点
              <button onClick={() => setConnecting(null)} className="underline text-purple-400 hover:text-purple-200">取消</button>
            </span>
          )}
        </div>

        {/* Canvas area */}
        <div
          ref={containerRef}
          className="flex-1 overflow-hidden relative"
          style={{ cursor: panStart ? 'grabbing' : connecting ? 'crosshair' : 'grab' }}
          onMouseDown={handleBgMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          {/* Dot-grid background */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
              backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
              backgroundPosition: `${pan.x % (20 * zoom)}px ${pan.y % (20 * zoom)}px`,
            }}
          />

          {/* Transformed inner canvas */}
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
              position: 'absolute',
              width: 12000,
              height: 12000,
            }}
          >
            {/* SVG edges */}
            <svg
              style={{ position: 'absolute', top: 0, left: 0, width: 12000, height: 12000, pointerEvents: 'none', overflow: 'visible' }}
            >
              <defs>
                <marker id="arrowhead" markerWidth="7" markerHeight="5" refX="5" refY="2.5" orient="auto">
                  <polygon points="0 0, 7 2.5, 0 5" fill="rgba(139,92,246,0.5)" />
                </marker>
              </defs>
              <g style={{ pointerEvents: 'all' }}>
                {visibleEdges.map(rel => {
                  const src = getNodeForEntity(rel.source_type, rel.source_id)
                  const tgt = getNodeForEntity(rel.target_type, rel.target_id)
                  if (!src || !tgt) return null
                  return (
                    <SvgEdge
                      key={rel.id}
                      x1={src.x + CARD_W} y1={src.y + 22}
                      x2={tgt.x}          y2={tgt.y + 22}
                      label={rel.title}
                      id={rel.id}
                      onClick={() => navigate(`/relations/${rel.id}`)}
                    />
                  )
                })}
              </g>
            </svg>

            {/* Entity cards */}
            {nodes.map(node => {
              const nodeRels = relations.filter(r =>
                (r.source_type === node.entity_type && r.source_id === node.entity_id) ||
                (r.target_type === node.entity_type && r.target_id === node.entity_id)
              )
              return (
                <EntityCard
                  key={node.id}
                  node={node}
                  entity={getEntity(node)}
                  nodeRelations={nodeRels}
                  isConnectMode={!!connecting}
                  isConnectSource={connecting?.fromNodeId === node.id}
                  onMouseDown={e => handleNodeMouseDown(e, node.id)}
                  onRemove={() => removeNode(node.id)}
                  onStartConnect={() => setConnecting({ fromNodeId: node.id })}
                  onBecomeTarget={() => {
                    if (!connecting || connecting.fromNodeId === node.id) { setConnecting(null); return }
                    setRelForm({ srcNodeId: connecting.fromNodeId, tgtNodeId: node.id })
                    setConnecting(null)
                  }}
                  onExpandLevel={l => setExpandLevel(node.id, l)}
                />
              )
            })}
          </div>

          {/* Empty state */}
          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p className="text-neutral-700 text-sm">从左侧添加实体到画布</p>
                <p className="text-neutral-800 text-xs mt-1">点击列表项即可添加节点</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Relation form modal */}
      {relForm && (
        <RelationForm
          sourceEntity={relFormSrc ? getEntity(relFormSrc) : undefined}
          targetEntity={relFormTgt ? getEntity(relFormTgt) : undefined}
          onConfirm={confirmRelation}
          onCancel={() => setRelForm(null)}
        />
      )}
    </div>
  )
}

export default CanvasView
