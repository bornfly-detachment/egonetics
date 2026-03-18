import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, X, ZoomIn, ZoomOut, RefreshCw, ExternalLink, Plus, ChevronRight, ChevronDown, Minimize2, Maximize2, Settings, Expand, Shrink } from 'lucide-react'
import RelationBottomSheet from './RelationBottomSheet'
import { authFetch } from '../lib/http'
import {
  listCanvasNodes, addCanvasNode, updateCanvasNode, removeCanvasNode,
  type CanvasNode,
} from '../lib/canvas-api'
import { getRelations, createRelation } from '../lib/block-graph-api'
import type { Relation } from './types'

// ── Types ──────────────────────────────────────────────────────────

interface RelationType {
  id: string
  label: string
  color: string
}

interface SubpageMeta {
  id: string
  parentId: string | null
  title: string
  icon: string
  pageType?: string
}

interface EntityData {
  id: string
  entityType: string
  title: string
  icon: string
  status?: string
}

interface SidebarEntity {
  id: string
  entityType: string
  title: string
  icon: string
}

const CARD_W = 264
const TREE_GAP_X = 80   // horizontal gap between parent and children
const TREE_GAP_Y = 100  // vertical gap between siblings

function clamp(v: number, lo: number, hi: number) {
  return Math.min(Math.max(v, lo), hi)
}

// ── SVG Edge ───────────────────────────────────────────────────────

const SvgEdge: React.FC<{
  x1: number; y1: number; x2: number; y2: number
  label: string; id: string; active: boolean; color?: string
  onClick: () => void
}> = ({ x1, y1, x2, y2, label, active, color = '#8b5cf6', onClick }) => {
  const dx = Math.max(Math.abs(x2 - x1) * 0.45, 60)
  const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2 - 6
  const baseColor = color
  const strokeColor = active ? baseColor : `${baseColor}88`

  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      <path d={d} fill="none" stroke="transparent" strokeWidth={14} />
      <path d={d} fill="none" stroke={strokeColor} strokeWidth={active ? 2.5 : 1.5} markerEnd={`url(#arrowhead-${active ? 'active' : 'default'})`} />
      {label && (
        <>
          <rect x={mx - 34} y={my - 9} width={68} height={18} rx={4}
            fill="rgba(10,8,20,0.92)" stroke={`${baseColor}66`} strokeWidth={1} />
          <text x={mx} y={my + 4} textAnchor="middle" fontSize={10}
            fill={active ? baseColor : `${baseColor}cc`} fontFamily="system-ui,sans-serif"
            style={{ pointerEvents: 'none', userSelect: 'none' }}>
            {label.length > 8 ? label.slice(0, 8) + '…' : label}
          </text>
        </>
      )}
    </g>
  )
}

// ── Relation Type Manager Modal ────────────────────────────────────

const RelationTypeManager: React.FC<{
  types: RelationType[]
  onClose: () => void
  onAdd: (label: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onUpdate: (id: string, label: string, color: string) => Promise<void>
}> = ({ types, onClose, onAdd, onDelete, onUpdate }) => {
  const [newLabel, setNewLabel] = useState('')
  const [adding, setAdding]     = useState(false)
  const [editingId, setEditingId]     = useState<string | null>(null)
  const [editLabel, setEditLabel]     = useState('')
  const [editColor, setEditColor]     = useState('')

  const handleAdd = async () => {
    if (!newLabel.trim()) return
    setAdding(true)
    await onAdd(newLabel.trim())
    setNewLabel('')
    setAdding(false)
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#13111e] border border-purple-500/20 rounded-2xl w-full max-w-md flex flex-col max-h-[80vh]"
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/6 flex items-center justify-between shrink-0">
          <h3 className="text-sm font-semibold text-white">关系类型库</h3>
          <button onClick={onClose} className="w-6 h-6 rounded text-neutral-600 hover:text-neutral-300 hover:bg-white/5 flex items-center justify-center">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Type list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {types.map(t => (
            <div key={t.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 group">
              {editingId === t.id ? (
                <>
                  <input type="color" value={editColor} onChange={e => setEditColor(e.target.value)}
                    className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0" />
                  <input value={editLabel} onChange={e => setEditLabel(e.target.value)}
                    className="flex-1 text-sm bg-white/5 border border-white/10 rounded px-2 py-0.5 text-white outline-none"
                    onKeyDown={e => { if (e.key === 'Enter') { onUpdate(t.id, editLabel, editColor); setEditingId(null) } }} />
                  <button onClick={() => { onUpdate(t.id, editLabel, editColor); setEditingId(null) }}
                    className="text-[10px] text-emerald-400 hover:text-emerald-300 px-1.5 py-0.5 rounded bg-emerald-500/10">保存</button>
                  <button onClick={() => setEditingId(null)}
                    className="text-[10px] text-neutral-600 hover:text-neutral-400">取消</button>
                </>
              ) : (
                <>
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: t.color }} />
                  <span className="flex-1 text-[12px] text-neutral-300">{t.label}</span>
                  <span className="text-[10px] text-neutral-700 font-mono">{t.id}</span>
                  <button onClick={() => { setEditingId(t.id); setEditLabel(t.label); setEditColor(t.color) }}
                    className="opacity-0 group-hover:opacity-100 text-[10px] text-neutral-600 hover:text-neutral-300 transition-opacity px-1">编辑</button>
                  <button onClick={() => onDelete(t.id)}
                    className="opacity-0 group-hover:opacity-100 text-[10px] text-neutral-600 hover:text-red-400 transition-opacity px-1">删除</button>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Add new */}
        <div className="px-3 py-3 border-t border-white/6 shrink-0 flex items-center gap-2">
          <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
            placeholder="新类型名称…"
            onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
            className="flex-1 text-sm input-field" />
          <button onClick={handleAdd} disabled={!newLabel.trim() || adding}
            className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5">
            {adding ? <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> : <Plus className="w-3 h-3" />}
            新增
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Entity Card ────────────────────────────────────────────────────

const TYPE_STYLE: Record<string, { border: string; head: string; badge: string }> = {
  task:      { border: 'border-blue-500/25',    head: 'bg-blue-500/8',    badge: 'bg-blue-400/10 text-blue-400' },
  page:      { border: 'border-emerald-500/25', head: 'bg-emerald-500/8', badge: 'bg-emerald-400/10 text-emerald-400' },
  theory:    { border: 'border-purple-500/25',  head: 'bg-purple-500/8',  badge: 'bg-purple-400/10 text-purple-400' },
  memory:    { border: 'border-amber-500/25',   head: 'bg-amber-500/8',   badge: 'bg-amber-400/10 text-amber-400' },
  chronicle: { border: 'border-orange-500/25',  head: 'bg-orange-500/8',  badge: 'bg-orange-400/10 text-orange-400' },
}

interface CardProps {
  node: CanvasNode
  entity: EntityData | undefined
  nodeRelations: Relation[]
  isConnectMode: boolean
  isConnectSource: boolean
  isExpanding: boolean
  onMouseDown: (e: React.MouseEvent) => void
  onRemove: () => void
  onStartConnect: () => void
  onBecomeTarget: () => void
  onExpandTree: () => void
  onCollapseTree: () => void
  onFold: (collapsed: 0 | 1) => void
  onNavigate: (() => void) | null
}

const EntityCard: React.FC<CardProps> = ({
  node, entity, isConnectMode, isConnectSource,
  onMouseDown, onRemove, onStartConnect, onBecomeTarget,
  onExpandTree, onCollapseTree, onFold, onNavigate, isExpanding,
}) => {
  const s = TYPE_STYLE[node.entity_type] ?? { border: 'border-white/10', head: 'bg-white/5', badge: 'bg-white/5 text-neutral-400' }
  const isCollapsed = node.collapsed === 1
  const isTreeExpanded = node.tree_expanded === 1

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
      <div className={`flex items-center gap-1.5 px-2 py-2.5 ${s.head} border-b border-white/5 cursor-grab active:cursor-grabbing`}>
        {/* Fold toggle */}
        <button onClick={e => { e.stopPropagation(); onFold(isCollapsed ? 0 : 1) }}
          title={isCollapsed ? '展开卡片' : '折叠卡片'}
          className="w-4 h-4 rounded text-neutral-600 hover:text-neutral-300 hover:bg-white/10 flex items-center justify-center transition-colors shrink-0">
          {isCollapsed ? <Maximize2 className="w-2.5 h-2.5" /> : <Minimize2 className="w-2.5 h-2.5" />}
        </button>

        <span className="text-sm leading-none shrink-0">{entity?.icon ?? '📄'}</span>
        <span
          className={`flex-1 text-[12px] font-medium text-white truncate min-w-0 ${onNavigate ? 'hover:text-primary-300 cursor-pointer' : ''}`}
          onClick={onNavigate ? e => { e.stopPropagation(); onNavigate() } : undefined}
          title={entity?.title}
        >
          {entity?.title ?? <span className="text-neutral-600 italic text-xs">加载中…</span>}
        </span>

        <div className="flex items-center gap-0.5 shrink-0">
          {/* Tree expand / collapse */}
          {!isTreeExpanded ? (
            <button onClick={e => { e.stopPropagation(); onExpandTree() }}
              disabled={isExpanding}
              title="展开子节点"
              className="w-5 h-5 rounded text-neutral-600 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all flex items-center justify-center font-bold text-sm">
              {isExpanding ? <div className="w-3 h-3 border border-neutral-600 border-t-emerald-400 rounded-full animate-spin" /> : '+'}
            </button>
          ) : (
            <button onClick={e => { e.stopPropagation(); onCollapseTree() }}
              title="收起子节点"
              className="w-5 h-5 rounded text-emerald-500 hover:text-red-400 hover:bg-red-500/10 transition-all flex items-center justify-center font-bold text-sm">
              −
            </button>
          )}

          {/* Connect */}
          <button onClick={e => { e.stopPropagation(); onStartConnect() }} title="建立关系"
            className="w-5 h-5 rounded text-neutral-600 hover:text-purple-400 hover:bg-purple-500/10 transition-all flex items-center justify-center text-sm">↗</button>

          {/* Navigate */}
          {onNavigate && (
            <button onClick={e => { e.stopPropagation(); onNavigate() }} title="打开详情页"
              className="w-5 h-5 rounded text-neutral-600 hover:text-blue-400 hover:bg-blue-500/10 transition-all flex items-center justify-center">
              <ExternalLink className="w-3 h-3" />
            </button>
          )}

          {/* Remove */}
          <button onClick={e => { e.stopPropagation(); onRemove() }}
            className="w-5 h-5 rounded text-neutral-600 hover:text-red-400 hover:bg-red-500/10 transition-all flex items-center justify-center">
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Body — hidden when collapsed */}
      {!isCollapsed && (
        <div className="px-3 py-1.5 flex items-center gap-2">
          <span className={`text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded font-semibold ${s.badge}`}>
            {node.entity_type}
          </span>
          {entity?.status && <span className="text-[10px] text-neutral-600">{entity.status}</span>}
          {isTreeExpanded && (
            <span className="ml-auto text-[9px] text-emerald-700">已展开</span>
          )}
        </div>
      )}
    </div>
  )
}

// ── Sidebar Tree Node ───────────────────────────────────────────────

const SidebarTreeNode: React.FC<{
  entity: SidebarEntity
  depth: number
  onCanvasSet: Set<string>
  expanded: Set<string>
  childrenMap: Record<string, SidebarEntity[]>
  onToggle: (entityId: string, entityType: string) => void
}> = ({ entity, depth, onCanvasSet, expanded, childrenMap, onToggle }) => {
  const isOnCanvas = onCanvasSet.has(`${entity.entityType}:${entity.id}`)
  const isExpanded = expanded.has(entity.id)
  const children = childrenMap[entity.id]          // undefined = not loaded yet
  const hasArrow = children === undefined || children.length > 0

  return (
    <div>
      <div
        style={{ paddingLeft: 8 + depth * 14 }}
        draggable={!isOnCanvas}
        onDragStart={e => {
          if (isOnCanvas) return
          e.dataTransfer.setData('entity_type', entity.entityType)
          e.dataTransfer.setData('entity_id', entity.id)
          e.dataTransfer.effectAllowed = 'copy'
        }}
        className={`flex items-center gap-1 pr-2 py-1 rounded-lg text-[11px] group
          ${isOnCanvas
            ? 'opacity-40 cursor-not-allowed text-neutral-600'
            : 'text-neutral-400 hover:bg-white/5 cursor-grab active:cursor-grabbing'}`}
      >
        {/* Expand arrow */}
        <button
          onClick={e => { e.stopPropagation(); onToggle(entity.id, entity.entityType) }}
          className={`w-4 h-4 flex items-center justify-center shrink-0 transition-colors
            ${hasArrow ? 'text-neutral-700 hover:text-neutral-400' : 'opacity-0 pointer-events-none'}`}
        >
          {isExpanded
            ? <ChevronDown className="w-3 h-3" />
            : <ChevronRight className="w-3 h-3" />}
        </button>

        <span className="shrink-0 text-sm leading-none">{entity.icon}</span>
        <span className="truncate flex-1">{entity.title}</span>
        {isOnCanvas && <span className="text-[9px] text-neutral-700 shrink-0">✓</span>}
      </div>

      {/* Children */}
      {isExpanded && children && children.length > 0 && children.map(child => (
        <SidebarTreeNode key={child.id} entity={child} depth={depth + 1}
          onCanvasSet={onCanvasSet} expanded={expanded} childrenMap={childrenMap}
          onToggle={onToggle} />
      ))}

      {/* Loading indicator */}
      {isExpanded && children === undefined && (
        <div style={{ paddingLeft: 8 + (depth + 1) * 14 }} className="py-1 text-[10px] text-neutral-800 italic">加载中…</div>
      )}

      {/* Empty children */}
      {isExpanded && children !== undefined && children.length === 0 && (
        <div style={{ paddingLeft: 8 + (depth + 1) * 14 }} className="py-1 text-[10px] text-neutral-800 italic">无子页面</div>
      )}
    </div>
  )
}

// ── New Relation Form (sidebar "新建关系") ─────────────────────────

const CreateRelForm: React.FC<{
  nodes: CanvasNode[]
  entityMap: Record<string, EntityData>
  relationTypes: RelationType[]
  onConfirm: (srcNodeId: string, tgtNodeId: string, title: string, desc: string, relType: string) => Promise<void>
  onCancel: () => void
}> = ({ nodes, entityMap, relationTypes, onConfirm, onCancel }) => {
  const [srcId, setSrcId] = useState(nodes[0]?.id ?? '')
  const [tgtId, setTgtId] = useState(nodes[1]?.id ?? nodes[0]?.id ?? '')
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [relType, setRelType] = useState(relationTypes[0]?.id ?? 'contains')
  const [saving, setSaving] = useState(false)

  const getLabel = (nodeId: string) => {
    const n = nodes.find(x => x.id === nodeId)
    if (!n) return '—'
    const e = entityMap[`${n.entity_type}:${n.entity_id}`]
    return `${e?.icon ?? '📄'} ${e?.title ?? n.entity_id}`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !srcId || !tgtId || srcId === tgtId) return
    setSaving(true)
    await onConfirm(srcId, tgtId, title.trim(), desc.trim(), relType)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <form onSubmit={handleSubmit} onClick={e => e.stopPropagation()}
        className="bg-[#16141e] border border-purple-500/20 rounded-2xl p-5 w-full max-w-sm space-y-4">
        <h3 className="font-semibold text-white text-sm">新建关系</h3>
        <div className="space-y-2">
          <div>
            <label className="text-[10px] text-neutral-600 mb-0.5 block">来源实体</label>
            <select value={srcId} onChange={e => setSrcId(e.target.value)} className="input-field w-full text-sm">
              {nodes.map(n => <option key={n.id} value={n.id}>{getLabel(n.id)}</option>)}
            </select>
          </div>
          <div className="text-center text-purple-500 text-lg">↓</div>
          <div>
            <label className="text-[10px] text-neutral-600 mb-0.5 block">目标实体</label>
            <select value={tgtId} onChange={e => setTgtId(e.target.value)} className="input-field w-full text-sm">
              {nodes.map(n => <option key={n.id} value={n.id}>{getLabel(n.id)}</option>)}
            </select>
          </div>
        </div>
        <div className="space-y-2">
          <div>
            <label className="text-[10px] text-neutral-600 mb-0.5 block">关系类型</label>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: relationTypes.find(t => t.id === relType)?.color ?? '#8b5cf6' }} />
              <select value={relType} onChange={e => setRelType(e.target.value)} className="flex-1 input-field text-sm">
                {relationTypes.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <input value={title} onChange={e => setTitle(e.target.value)} autoFocus
            placeholder="关系标题（包含、推导出、基于、演化为…）" className="input-field w-full text-sm" />
          <textarea value={desc} onChange={e => setDesc(e.target.value)}
            placeholder="描述（可选）" rows={2} className="input-field w-full text-sm resize-none" />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="btn-secondary text-sm">取消</button>
          <button type="submit" disabled={!title.trim() || !srcId || !tgtId || srcId === tgtId || saving}
            className="btn-primary text-sm flex items-center gap-2">
            {saving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            创建
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Relation Connect Form (card ↗ button) ─────────────────────────

const RelationConnectForm: React.FC<{
  sourceEntity?: EntityData; targetEntity?: EntityData
  relationTypes: RelationType[]
  onConfirm: (title: string, description: string, relType: string) => Promise<void>
  onCancel: () => void
}> = ({ sourceEntity, targetEntity, relationTypes, onConfirm, onCancel }) => {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [relType, setRelType] = useState(relationTypes[0]?.id ?? 'contains')
  const [saving, setSaving] = useState(false)

  const handleConfirm = async () => {
    if (!title.trim()) return
    setSaving(true)
    await onConfirm(title.trim(), description.trim(), relType)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-[#16141e] border border-purple-500/20 rounded-2xl p-5 w-full max-w-sm space-y-4"
        onClick={e => e.stopPropagation()}>
        <h3 className="font-semibold text-white text-sm">建立关系</h3>
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
          <div>
            <label className="text-[10px] text-neutral-600 mb-0.5 block">关系类型</label>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: relationTypes.find(t => t.id === relType)?.color ?? '#8b5cf6' }} />
              <select value={relType} onChange={e => setRelType(e.target.value)} className="flex-1 input-field text-sm">
                {relationTypes.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <input value={title} onChange={e => setTitle(e.target.value)} autoFocus
            placeholder="关系标题（包含、推导出、基于、演化为…）"
            className="input-field w-full text-sm"
            onKeyDown={e => { if (e.key === 'Enter') handleConfirm() }} />
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            placeholder="描述（可选）" rows={2} className="input-field w-full text-sm resize-none" />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="btn-secondary text-sm">取消</button>
          <button onClick={handleConfirm} disabled={!title.trim() || saving}
            className="btn-primary text-sm flex items-center gap-2">
            {saving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            确认
          </button>
        </div>
      </div>
    </div>
  )
}

// ── CanvasView ─────────────────────────────────────────────────────

const CanvasView: React.FC = () => {
  const { canvasId } = useParams<{ canvasId: string }>()
  const navigate = useNavigate()

  // Data
  const [nodes, setNodes]         = useState<CanvasNode[]>([])
  const [entityMap, setEntityMap] = useState<Record<string, EntityData>>({})
  const [relations, setRelations] = useState<Relation[]>([])
  const [allTasks, setAllTasks]   = useState<any[]>([])
  const [allPages, setAllPages]   = useState<any[]>([])
  const [canvasTitle, setCanvasTitle] = useState('画布')
  const [loading, setLoading]     = useState(true)

  // Sidebar tree state
  const [sidebarExpanded, setSidebarExpanded] = useState<Set<string>>(new Set())
  const [sidebarChildren, setSidebarChildren] = useState<Record<string, SidebarEntity[]>>({})

  // View state
  const [pan, setPan]   = useState({ x: 120, y: 80 })
  const [zoom, setZoom] = useState(1)
  const [panStart, setPanStart]   = useState<{ mx: number; my: number; px: number; py: number } | null>(null)
  const [dragging, setDragging]   = useState<{ nodeId: string; startX: number; startY: number; msx: number; msy: number } | null>(null)

  // Connection flow
  const [connecting, setConnecting] = useState<{ fromNodeId: string } | null>(null)
  const [relConnectForm, setRelConnectForm] = useState<{ srcNodeId: string; tgtNodeId: string } | null>(null)

  // Active relation (bottom sheet)
  const [activeRelId, setActiveRelId] = useState<string | null>(null)

  // Relation types
  const [relationTypes, setRelationTypes]   = useState<RelationType[]>([])
  const [showTypeManager, setShowTypeManager] = useState(false)

  // Create relation from sidebar
  const [showCreateRel, setShowCreateRel] = useState(false)

  // Tree expand loading state
  const [expandingNodeId, setExpandingNodeId] = useState<string | null>(null)

  // Fullscreen
  const [isFullscreen, setIsFullscreen] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>()

  // (edit state is now managed inside RelationBottomSheet)

  // ── Load ────────────────────────────────────────────────────

  useEffect(() => { if (canvasId) loadAll() }, [canvasId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && isFullscreen) setIsFullscreen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isFullscreen])

  const loadAll = async () => {
    if (!canvasId) return
    try {
      const [canvasData, nodesData, tasksResp, pages, rtypes] = await Promise.all([
        authFetch<any>(`/canvases/${canvasId}`).catch(() => null),
        listCanvasNodes(canvasId),
        authFetch<any>('/tasks').catch(() => []),
        authFetch<any[]>('/pages?rootOnly=true').catch(() => []),
        authFetch<RelationType[]>('/relation-types').catch(() => []),
      ])
      setRelationTypes(rtypes)
      if (canvasData?.title) setCanvasTitle(canvasData.title)
      const tasks: any[] = Array.isArray(tasksResp) ? tasksResp : (tasksResp?.tasks ?? [])

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
      setNodes(nodesData)

      // Fetch entity data for canvas nodes not covered by rootOnly pages or tasks
      const missing = nodesData.filter(n => !map[`${n.entity_type}:${n.entity_id}`])
      if (missing.length > 0) {
        const fetched = await Promise.all(
          missing.map(n =>
            authFetch<any>(`/pages/${n.entity_id}`)
              .then(p => ({ key: `${p.pageType || n.entity_type}:${p.id}`, data: { id: p.id, entityType: p.pageType || n.entity_type, title: p.title || '无标题', icon: p.icon || '📄' } as EntityData }))
              .catch(() => null)
          )
        )
        fetched.forEach(r => { if (r) map[r.key] = r.data })
      }

      setEntityMap(map)
      if (nodesData.length > 0) loadRelations(nodesData)
    } finally { setLoading(false) }
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

  const getTypeColor = (typeId: string) =>
    relationTypes.find(t => t.id === typeId)?.color ?? '#8b5cf6'

  const getEntity = (node: CanvasNode) => entityMap[`${node.entity_type}:${node.entity_id}`]
  const entityNavPath = (type: string, id: string): string | null =>
    type === 'task' ? `/tasks/${id}` : null

  // ── Sidebar tree toggle ──────────────────────────────────────

  const handleSidebarToggle = useCallback(async (entityId: string, _entityType: string) => {
    setSidebarExpanded(prev => {
      const next = new Set(prev)
      if (next.has(entityId)) next.delete(entityId)
      else next.add(entityId)
      return next
    })

    // Lazy-load children
    setSidebarChildren(prev => {
      if (prev[entityId] !== undefined) return prev  // already loaded
      // Mark as loading (undefined stays until resolved)
      return prev
    })

    // If not loaded yet, fetch
    setSidebarChildren(prev => {
      if (prev[entityId] !== undefined) return prev
      // Trigger async load
      authFetch<SubpageMeta[]>(`/pages/${entityId}/subtree`)
        .then(subtree => {
          const direct = subtree
            .filter(p => p.parentId === entityId)
            .map(p => ({ id: p.id, entityType: p.pageType || 'page', title: p.title, icon: p.icon } as SidebarEntity))
          setSidebarChildren(c => ({ ...c, [entityId]: direct }))
          setEntityMap(m => {
            const next = { ...m }
            direct.forEach(d => { next[`${d.entityType}:${d.id}`] = { id: d.id, entityType: d.entityType, title: d.title, icon: d.icon } })
            return next
          })
        })
        .catch(() => setSidebarChildren(c => ({ ...c, [entityId]: [] })))
      return prev
    })
  }, [])

  // ── Zoom ────────────────────────────────────────────────────

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const factor = e.deltaY < 0 ? 1.12 : 0.9
    setZoom(prev => {
      const nz = clamp(prev * factor, 0.12, 3)
      setPan(p => ({ x: mx - (mx - p.x) * (nz / prev), y: my - (my - p.y) * (nz / prev) }))
      return nz
    })
  }, [])

  // ── Mouse ────────────────────────────────────────────────────

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
    if (panStart) setPan({ x: panStart.px + (e.clientX - panStart.mx), y: panStart.py + (e.clientY - panStart.my) })
    if (dragging) {
      const dx = (e.clientX - dragging.msx) / zoom
      const dy = (e.clientY - dragging.msy) / zoom
      setNodes(prev => prev.map(n => n.id === dragging.nodeId ? { ...n, x: dragging.startX + dx, y: dragging.startY + dy } : n))
    }
  }, [panStart, dragging, zoom])

  const handleMouseUp = useCallback(() => {
    if (dragging && canvasId) {
      const node = nodes.find(n => n.id === dragging.nodeId)
      if (node) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = setTimeout(() => updateCanvasNode(canvasId, node.id, { x: node.x, y: node.y }).catch(() => {}), 400)
      }
    }
    setPanStart(null)
    setDragging(null)
  }, [dragging, nodes, canvasId])

  // ── Node CRUD ────────────────────────────────────────────────

  const addEntityAt = async (entityType: string, entityId: string, x: number, y: number) => {
    if (!canvasId || nodes.some(n => n.entity_type === entityType && n.entity_id === entityId)) return
    try {
      const newNode = await addCanvasNode(canvasId, { entity_type: entityType, entity_id: entityId, x, y })
      setNodes(prev => [...prev, newNode])
      loadRelations([newNode])
    } catch { /* ignore */ }
  }

  const removeNode = async (nodeId: string) => {
    if (!canvasId) return
    try { await removeCanvasNode(canvasId, nodeId); setNodes(prev => prev.filter(n => n.id !== nodeId)) } catch { /* ignore */ }
  }

  // ── Tree expand / collapse ────────────────────────────────────

  const expandTreeNode = async (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId)
    if (!node || !canvasId) return
    setExpandingNodeId(nodeId)

    try {
      const subtree = await authFetch<SubpageMeta[]>(`/pages/${node.entity_id}/subtree`)
      const direct = subtree.filter(p => p.parentId === node.entity_id)
      if (direct.length === 0) return

      const total = direct.length
      const startY = node.y + 22 - (total * TREE_GAP_Y) / 2
      const childX = node.x + CARD_W + TREE_GAP_X

      const newNodes: CanvasNode[] = []
      const newEntityEntries: Record<string, EntityData> = {}

      for (let i = 0; i < direct.length; i++) {
        const child = direct[i]
        const childType = child.pageType || 'page'
        const childY = startY + i * TREE_GAP_Y

        // Skip if already on canvas
        if (nodes.some(n => n.entity_id === child.id)) continue

        try {
          const newNode = await addCanvasNode(canvasId, {
            entity_type: childType, entity_id: child.id, x: childX, y: childY,
          })
          newNodes.push(newNode)
          newEntityEntries[`${childType}:${child.id}`] = {
            id: child.id, entityType: childType, title: child.title, icon: child.icon,
          }
        } catch { /* duplicate – skip */ }
      }

      // Auto-create parent→child relations (skip existing)
      for (const child of direct) {
        const childType = child.pageType || 'page'
        const exists = relations.some(r => r.source_id === node.entity_id && r.target_id === child.id)
        if (!exists) {
          try {
            const rel = await createRelation({
              title: '包含',
              relation_type: 'contains',
              source_type: node.entity_type as any,
              source_id: node.entity_id,
              target_type: childType as any,
              target_id: child.id,
              description: '',
            })
            setRelations(prev => [...prev, rel])
          } catch { /* ignore */ }
        }
      }

      // Update state first so UI reflects immediately
      setEntityMap(prev => ({ ...prev, ...newEntityEntries }))
      setNodes(prev => [
        ...prev.map(n => n.id === nodeId ? { ...n, tree_expanded: 1 } : n),
        ...newNodes,
      ])

      if (newNodes.length > 0) {
        loadRelations([...nodes.filter(n => n.id !== nodeId), ...newNodes])
      }

      // Persist to DB (non-blocking)
      updateCanvasNode(canvasId, nodeId, { tree_expanded: 1 }).catch(() => {})
    } finally {
      setExpandingNodeId(null)
    }
  }

  const collapseTreeNode = async (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId)
    if (!node || !canvasId) return

    try {
      // Fetch all descendants to know which canvas nodes to remove
      const subtree = await authFetch<SubpageMeta[]>(`/pages/${node.entity_id}/subtree`)
      const descendantIds = new Set(subtree.map(p => p.id))

      const toRemove = nodes.filter(n => n.id !== nodeId && descendantIds.has(n.entity_id))
      await Promise.all(toRemove.map(n => removeCanvasNode(canvasId, n.id).catch(() => {})))

      const removeIds = new Set(toRemove.map(n => n.id))
      setNodes(prev => prev
        .filter(n => !removeIds.has(n.id))
        .map(n => n.id === nodeId ? { ...n, tree_expanded: 0 } : n)
      )
      updateCanvasNode(canvasId, nodeId, { tree_expanded: 0 }).catch(() => {})
    } catch { /* ignore */ }
  }

  const foldNode = (nodeId: string, collapsed: 0 | 1) => {
    if (!canvasId) return
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, collapsed } : n))
    updateCanvasNode(canvasId, nodeId, { collapsed }).catch(() => {})
  }

  // ── Relation CRUD ────────────────────────────────────────────

  const confirmRelationConnect = async (title: string, description: string, relType: string) => {
    if (!relConnectForm) return
    const srcNode = nodes.find(n => n.id === relConnectForm.srcNodeId)
    const tgtNode = nodes.find(n => n.id === relConnectForm.tgtNodeId)
    if (!srcNode || !tgtNode) { setRelConnectForm(null); return }
    try {
      const rel = await createRelation({
        title, relation_type: relType,
        source_type: srcNode.entity_type as any, source_id: srcNode.entity_id,
        target_type: tgtNode.entity_type as any, target_id: tgtNode.entity_id, description,
      })
      setRelations(prev => [...prev, rel])
      setActiveRelId(rel.id)
    } catch { /* ignore */ }
    setRelConnectForm(null)
  }

  const confirmRelationCreate = async (srcNodeId: string, tgtNodeId: string, title: string, desc: string, relType: string) => {
    const srcNode = nodes.find(n => n.id === srcNodeId)
    const tgtNode = nodes.find(n => n.id === tgtNodeId)
    if (!srcNode || !tgtNode) { setShowCreateRel(false); return }
    try {
      const rel = await createRelation({
        title, relation_type: relType,
        source_type: srcNode.entity_type as any, source_id: srcNode.entity_id,
        target_type: tgtNode.entity_type as any, target_id: tgtNode.entity_id, description: desc,
      })
      setRelations(prev => [...prev, rel])
      setActiveRelId(rel.id)
    } catch { /* ignore */ }
    setShowCreateRel(false)
  }

  // (relation save/delete handled inside RelationBottomSheet)

  // ── Relation Type CRUD ───────────────────────────────────────

  const addRelationType = async (label: string) => {
    try {
      const newType = await authFetch<RelationType>('/relation-types', {
        method: 'POST',
        body: JSON.stringify({ label }),
      })
      setRelationTypes(prev => [...prev, newType])
    } catch { /* ignore */ }
  }

  const deleteRelationType = async (id: string) => {
    try {
      await authFetch(`/relation-types/${id}`, { method: 'DELETE' })
      setRelationTypes(prev => prev.filter(t => t.id !== id))
    } catch { /* ignore */ }
  }

  const updateRelationType = async (id: string, label: string, color: string) => {
    try {
      const updated = await authFetch<RelationType>(`/relation-types/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ label, color }),
      })
      setRelationTypes(prev => prev.map(t => t.id === id ? updated : t))
    } catch { /* ignore */ }
  }

  // ── Computed ─────────────────────────────────────────────────

  const onCanvasSet = new Set(nodes.map(n => `${n.entity_type}:${n.entity_id}`))
  const canvasEntitySet = onCanvasSet

  const visibleEdges = relations.filter(r =>
    canvasEntitySet.has(`${r.source_type}:${r.source_id}`) &&
    canvasEntitySet.has(`${r.target_type}:${r.target_id}`)
  )
  const getNodeForEntity = (type: string, id: string) =>
    nodes.find(n => n.entity_type === type && n.entity_id === id)

  const activeRel = activeRelId ? relations.find(r => r.id === activeRelId) ?? null : null

  // Build sidebar entities
  const sidebarTasks: SidebarEntity[] = allTasks.map(t => ({
    id: t.id, entityType: 'task', title: t.name || t.title || '无标题', icon: t.icon || '📋',
  }))
  const sidebarPages: SidebarEntity[] = (allPages as any[]).map(p => ({
    id: p.id, entityType: p.pageType || 'page', title: p.title || '无标题', icon: p.icon || '📄',
  }))

  // ── Render ───────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 120px)' }}>
      <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const relConnectSrc = relConnectForm ? nodes.find(n => n.id === relConnectForm.srcNodeId) : undefined
  const relConnectTgt = relConnectForm ? nodes.find(n => n.id === relConnectForm.tgtNodeId) : undefined

  const rootStyle: React.CSSProperties = isFullscreen
    ? { position: 'fixed', inset: 0, zIndex: 50 }
    : { position: 'relative', height: 'calc(100vh - 120px)' }

  return (
    <div className={`flex overflow-hidden ${isFullscreen ? 'bg-[#080810]' : '-m-6'}`} style={rootStyle}>

      {/* ── Sidebar ── */}
      <aside className="w-56 shrink-0 border-r border-white/8 bg-[#0c0c14] flex flex-col">
        <div className="p-3 border-b border-white/8">
          <button onClick={() => navigate('/egonetics')}
            className="flex items-center gap-2 text-neutral-600 hover:text-neutral-300 transition-colors text-xs">
            <ArrowLeft className="w-3.5 h-3.5" /> 画布列表
          </button>
          <p className="text-sm font-medium text-white mt-2 truncate">{canvasTitle}</p>
          <p className="text-[10px] text-neutral-700 mt-0.5">拖拽节点到画布</p>
        </div>

        <div className="flex-1 overflow-y-auto py-2 space-y-3">

          {/* Tasks tree */}
          {sidebarTasks.length > 0 && (
            <div>
              <p className="text-[9px] uppercase tracking-widest text-neutral-700 px-3 mb-1">任务 ({sidebarTasks.length})</p>
              {sidebarTasks.map(entity => (
                <SidebarTreeNode key={entity.id} entity={entity} depth={0}
                  onCanvasSet={onCanvasSet} expanded={sidebarExpanded}
                  childrenMap={sidebarChildren} onToggle={handleSidebarToggle} />
              ))}
            </div>
          )}

          {/* Pages tree */}
          {sidebarPages.length > 0 && (
            <div>
              <p className="text-[9px] uppercase tracking-widest text-neutral-700 px-3 mb-1">页面 ({sidebarPages.length})</p>
              {sidebarPages.map(entity => (
                <SidebarTreeNode key={entity.id} entity={entity} depth={0}
                  onCanvasSet={onCanvasSet} expanded={sidebarExpanded}
                  childrenMap={sidebarChildren} onToggle={handleSidebarToggle} />
              ))}
            </div>
          )}

          {/* Relations list */}
          <div>
            <div className="flex items-center justify-between px-3 mb-1">
              <p className="text-[9px] uppercase tracking-widest text-neutral-700">
                关系 ({relations.length})
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => setShowTypeManager(true)} title="管理关系类型"
                  className="w-4 h-4 rounded text-neutral-700 hover:text-amber-400 hover:bg-amber-500/10 transition-all flex items-center justify-center">
                  <Settings className="w-2.5 h-2.5" />
                </button>
                {nodes.length >= 2 && (
                  <button onClick={() => setShowCreateRel(true)} title="新建关系"
                    className="w-4 h-4 rounded text-neutral-700 hover:text-purple-400 hover:bg-purple-500/10 transition-all flex items-center justify-center">
                    <Plus className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
            {relations.length === 0 ? (
              <p className="text-[10px] text-neutral-800 px-3 italic">暂无关系</p>
            ) : (
              relations.map(r => {
                const src = entityMap[`${r.source_type}:${r.source_id}`]
                const tgt = entityMap[`${r.target_type}:${r.target_id}`]
                const isActive = r.id === activeRelId
                return (
                  <button key={r.id} onClick={() => setActiveRelId(isActive ? null : r.id)}
                    className={`w-full flex flex-col px-3 py-1.5 rounded-lg text-left transition-all text-[10px] mb-0.5
                      ${isActive ? 'bg-purple-500/15 border border-purple-500/30' : 'hover:bg-white/5 border border-transparent'}`}>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: getTypeColor(r.relation_type ?? 'contains') }} />
                      <span className={`font-medium truncate ${isActive ? 'text-purple-300' : 'text-neutral-400'}`}>
                        {r.title || '(无标题)'}
                      </span>
                    </div>
                    <span className="text-neutral-700 truncate mt-0.5 pl-3.5">
                      {src?.icon ?? ''}{src?.title?.slice(0, 6) ?? r.source_id.slice(0, 6)} → {tgt?.icon ?? ''}{tgt?.title?.slice(0, 6) ?? r.target_id.slice(0, 6)}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Zoom controls */}
        <div className="p-2 border-t border-white/8 flex items-center gap-1.5">
          <button onClick={() => setZoom(z => clamp(z * 0.8, 0.12, 3))}
            className="w-6 h-6 rounded bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-600 hover:text-neutral-300 transition-colors">
            <ZoomOut className="w-3 h-3" />
          </button>
          <button onClick={() => setZoom(z => clamp(z * 1.25, 0.12, 3))}
            className="w-6 h-6 rounded bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-600 hover:text-neutral-300 transition-colors">
            <ZoomIn className="w-3 h-3" />
          </button>
          <button onClick={() => { setZoom(1); setPan({ x: 120, y: 80 }) }}
            className="w-6 h-6 rounded bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-600 hover:text-neutral-300 transition-colors" title="重置视图">
            <RefreshCw className="w-3 h-3" />
          </button>
          <span className="text-[10px] text-neutral-700 ml-auto">{Math.round(zoom * 100)}%</span>
        </div>
      </aside>

      {/* ── Canvas + Relation Panel ── */}
      <div className="flex-1 flex flex-col bg-[#080810] relative min-w-0">

        {/* Toolbar */}
        <div className="px-4 py-2 border-b border-white/8 flex items-center gap-3 bg-[#0c0c14] shrink-0">
          <span className="text-xs text-neutral-600">{nodes.length} 节点 · {visibleEdges.length} 关系</span>
          {connecting && (
            <span className="flex items-center gap-2 text-xs text-purple-300 bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
              连接模式 — 点击目标节点
              <button onClick={() => setConnecting(null)} className="underline text-purple-400 hover:text-purple-200">取消</button>
            </span>
          )}
          <button
            onClick={() => setIsFullscreen(f => !f)}
            title={isFullscreen ? '退出全屏' : '全屏'}
            className="ml-auto w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-600 hover:text-neutral-300 transition-colors"
          >
            {isFullscreen ? <Shrink className="w-3.5 h-3.5" /> : <Expand className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Canvas area */}
        <div className="flex-1 overflow-hidden relative">
          <div ref={containerRef} className="absolute inset-0"
            style={{ cursor: panStart ? 'grabbing' : connecting ? 'crosshair' : 'grab' }}
            onMouseDown={handleBgMouseDown} onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onWheel={handleWheel}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault()
              const entityType = e.dataTransfer.getData('entity_type')
              const entityId   = e.dataTransfer.getData('entity_id')
              if (!entityType || !entityId) return
              const rect = containerRef.current?.getBoundingClientRect()
              if (!rect) return
              const x = (e.clientX - rect.left - pan.x) / zoom - CARD_W / 2
              const y = (e.clientY - rect.top  - pan.y) / zoom - 20
              addEntityAt(entityType, entityId, x, y)
            }}>

            {/* Dot grid */}
            <div className="absolute inset-0 pointer-events-none" style={{
              backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
              backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
              backgroundPosition: `${pan.x % (20 * zoom)}px ${pan.y % (20 * zoom)}px`,
            }} />

            {/* Transformed canvas */}
            <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0', position: 'absolute', width: 12000, height: 12000 }}>

              {/* Edges */}
              <svg style={{ position: 'absolute', top: 0, left: 0, width: 12000, height: 12000, pointerEvents: 'none', overflow: 'visible' }}>
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
                      <SvgEdge key={rel.id}
                        x1={src.x + CARD_W} y1={src.y + 22} x2={tgt.x} y2={tgt.y + 22}
                        label={rel.title} id={rel.id} active={rel.id === activeRelId}
                        color={getTypeColor(rel.relation_type ?? 'contains')}
                        onClick={() => setActiveRelId(rel.id === activeRelId ? null : rel.id)} />
                    )
                  })}
                </g>
              </svg>

              {/* Entity cards */}
              {nodes.map(node => (
                <EntityCard key={node.id} node={node} entity={getEntity(node)}
                  nodeRelations={relations.filter(r =>
                    (r.source_type === node.entity_type && r.source_id === node.entity_id) ||
                    (r.target_type === node.entity_type && r.target_id === node.entity_id)
                  )}
                  isConnectMode={!!connecting} isConnectSource={connecting?.fromNodeId === node.id}
                  isExpanding={expandingNodeId === node.id}
                  onMouseDown={e => handleNodeMouseDown(e, node.id)}
                  onRemove={() => removeNode(node.id)}
                  onStartConnect={() => setConnecting({ fromNodeId: node.id })}
                  onBecomeTarget={() => {
                    if (!connecting || connecting.fromNodeId === node.id) { setConnecting(null); return }
                    setRelConnectForm({ srcNodeId: connecting.fromNodeId, tgtNodeId: node.id })
                    setConnecting(null)
                  }}
                  onExpandTree={() => expandTreeNode(node.id)}
                  onCollapseTree={() => collapseTreeNode(node.id)}
                  onFold={collapsed => foldNode(node.id, collapsed)}
                  onNavigate={(() => {
                    const path = entityNavPath(node.entity_type, node.entity_id)
                    return path ? () => navigate(path) : null
                  })()}
                />
              ))}
            </div>

            {/* Empty state */}
            {nodes.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <p className="text-neutral-700 text-sm">从左侧拖拽节点到画布</p>
                  <p className="text-neutral-800 text-xs mt-1">拖入后点击 [+] 展开子节点</p>
                </div>
              </div>
            )}
          </div>

          {/* ── Relation Bottom Sheet ── */}
          {activeRel && (
            <RelationBottomSheet
              relation={activeRel}
              relationTypes={relationTypes}
              entityMap={entityMap}
              onClose={() => setActiveRelId(null)}
              onUpdate={patch => setRelations(prev => prev.map(r => r.id === activeRel.id ? { ...r, ...patch } : r))}
              onDelete={() => { setRelations(prev => prev.filter(r => r.id !== activeRel.id)); setActiveRelId(null) }}
            />
          )}
        </div>
      </div>

      {/* Card ↗ connect form */}
      {relConnectForm && (
        <RelationConnectForm
          sourceEntity={relConnectSrc ? getEntity(relConnectSrc) : undefined}
          targetEntity={relConnectTgt ? getEntity(relConnectTgt) : undefined}
          relationTypes={relationTypes}
          onConfirm={confirmRelationConnect}
          onCancel={() => setRelConnectForm(null)}
        />
      )}

      {/* Sidebar "新建关系" form */}
      {showCreateRel && (
        <CreateRelForm nodes={nodes} entityMap={entityMap} relationTypes={relationTypes}
          onConfirm={confirmRelationCreate}
          onCancel={() => setShowCreateRel(false)} />
      )}

      {/* Relation Type Manager modal */}
      {showTypeManager && (
        <RelationTypeManager
          types={relationTypes}
          onClose={() => setShowTypeManager(false)}
          onAdd={addRelationType}
          onDelete={deleteRelationType}
          onUpdate={updateRelationType}
        />
      )}
    </div>
  )
}

export default CanvasView
