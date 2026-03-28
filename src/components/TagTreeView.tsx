/**
 * TagTreeView — 标签语义树 CRUD + 拖拽排序/跨父移动
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { useDrag, useDrop, DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { ChevronRight, ChevronDown, Plus, Trash2, Edit2, Check, X, GripVertical, ToggleLeft, ToggleRight } from 'lucide-react'
import type { BlockTagNode } from './types'
import { useBlockTags } from '../hooks/useBlockTags'

// ── 颜色调色板 ──────────────────────────────────────────────────────────────
const PALETTE = [
  '#6b7280','#ef4444','#f97316','#eab308','#22c55e',
  '#06b6d4','#3b82f6','#8b5cf6','#ec4899','#14b8a6',
]

const DRAG_TYPE = 'TAG_NODE'
type DragItem  = { id: string }
type DropPos   = 'before' | 'inside' | 'after'

// ── 树操作工具 ──────────────────────────────────────────────────────────────

/** targetId 是否是 sourceId 的后代 */
function isDescendant(nodes: BlockTagNode[], sourceId: string, targetId: string): boolean {
  function findChildren(ns: BlockTagNode[], id: string): BlockTagNode[] {
    for (const n of ns) {
      if (n.id === id) return n.children ?? []
      if (n.children?.length) {
        const c = findChildren(n.children, id)
        if (c !== null) return c
      }
    }
    return []
  }
  function includes(ns: BlockTagNode[], id: string): boolean {
    return ns.some(n => n.id === id || includes(n.children ?? [], id))
  }
  return includes(findChildren(nodes, sourceId), targetId)
}

/** 找到 targetId 的父节点及其在父数组中的下标 */
function findParentAndIndex(
  nodes: BlockTagNode[],
  targetId: string,
  parent: BlockTagNode | null = null,
): { parent: BlockTagNode | null; index: number } | null {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].id === targetId) return { parent, index: i }
    if (nodes[i].children?.length) {
      const r = findParentAndIndex(nodes[i].children!, targetId, nodes[i])
      if (r) return r
    }
  }
  return null
}

function findNode(nodes: BlockTagNode[], id: string): BlockTagNode | null {
  for (const n of nodes) {
    if (n.id === id) return n
    if (n.children?.length) {
      const f = findNode(n.children, id)
      if (f) return f
    }
  }
  return null
}

// ── TagRow ──────────────────────────────────────────────────────────────────
function TagRow({
  node, depth, expanded, tree,
  onToggle, onAddChild, onRename, onColorChange, onDelete, onMove, onModeToggle,
}: {
  node:           BlockTagNode
  depth:          number
  expanded:       boolean
  tree:           BlockTagNode[]
  onToggle:       () => void
  onAddChild:     () => void
  onRename:       (name: string) => void
  onColorChange:  (color: string) => void
  onDelete:       () => void
  onMove:         (dragId: string, targetId: string, pos: DropPos) => void
  onModeToggle:   () => void
}) {
  const isSingle    = node.select_mode === 'single'
  const hasChildren = (node.children?.length ?? 0) > 0

  const [editing,     setEditing]     = useState(false)
  const [draft,       setDraft]       = useState(node.name)
  const [showPalette, setShowPalette] = useState(false)

  const [dropPos,     setDropPos]     = useState<DropPos | null>(null)
  const inputRef    = useRef<HTMLInputElement>(null)
  const rowRef      = useRef<HTMLDivElement>(null)
  const dropPosRef  = useRef<DropPos>('after')
  const expandTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { if (editing) inputRef.current?.select() }, [editing])
  useEffect(() => { setDraft(node.name) }, [node.name])

  const commitRename = () => {
    setEditing(false)
    const t = draft.trim()
    if (t && t !== node.name) onRename(t)
    else setDraft(node.name)
  }
  const cancelRename = () => { setEditing(false); setDraft(node.name) }

  // ── Drag ──
  const [{ isDragging }, dragHandle] = useDrag<DragItem, void, { isDragging: boolean }>({
    type: DRAG_TYPE,
    item: { id: node.id },
    collect: m => ({ isDragging: m.isDragging() }),
  })

  // ── Drop ──
  const [{ isOver }, drop] = useDrop<DragItem, void, { isOver: boolean }>({
    accept: DRAG_TYPE,
    hover(item, monitor) {
      if (item.id === node.id || !rowRef.current) return
      if (isDescendant(tree, item.id, node.id)) return

      const { top, height } = rowRef.current.getBoundingClientRect()
      const ratio = (monitor.getClientOffset()!.y - top) / height
      const pos: DropPos = ratio < 0.3 ? 'before' : ratio > 0.7 ? 'after' : 'inside'

      if (pos !== dropPosRef.current) {
        dropPosRef.current = pos
        setDropPos(pos)
      }

      // 悬停 600ms 自动展开折叠节点
      if (pos === 'inside' && !expanded && hasChildren) {
        if (!expandTimer.current) {
          expandTimer.current = setTimeout(() => { onToggle(); expandTimer.current = null }, 600)
        }
      } else if (expandTimer.current) {
        clearTimeout(expandTimer.current)
        expandTimer.current = null
      }
    },
    drop(item) {
      if (item.id === node.id) return
      if (isDescendant(tree, item.id, node.id)) return
      onMove(item.id, node.id, dropPosRef.current)
    },
    collect: m => ({ isOver: m.isOver({ shallow: true }) }),
  })

  // isOver=false 时清除高亮
  useEffect(() => {
    if (!isOver) {
      setDropPos(null)
      if (expandTimer.current) { clearTimeout(expandTimer.current); expandTimer.current = null }
    }
  }, [isOver])

  return (
    <div
      ref={el => { (rowRef as React.MutableRefObject<HTMLDivElement | null>).current = el; drop(el) }}
      className={`group relative flex items-center gap-1 px-2 py-[5px] rounded transition-colors ${
        isDragging ? 'opacity-30' : ''
      } ${isOver && dropPos === 'inside'
          ? 'bg-blue-500/15 ring-1 ring-inset ring-blue-500/40'
          : 'hover:bg-white/[0.04]'
      }`}
      style={{ paddingLeft: `${8 + depth * 20}px` }}
    >
      {/* 插入线 — before */}
      {isOver && dropPos === 'before' && (
        <div className="pointer-events-none absolute top-0 inset-x-2 h-0.5 bg-blue-400 rounded-full z-10" />
      )}
      {/* 插入线 — after */}
      {isOver && dropPos === 'after' && (
        <div className="pointer-events-none absolute bottom-0 inset-x-2 h-0.5 bg-blue-400 rounded-full z-10" />
      )}

      {/* 单选左侧括线：只在 select_mode=single 且有子节点时渲染 */}
      {isSingle && hasChildren && (
        <div
          className="pointer-events-none absolute left-0 top-0 bottom-0 w-0.5 rounded-full"
          style={{ left: `${6 + depth * 20}px`, background: node.color ?? '#f59e0b', opacity: 0.5 }}
        />
      )}

      {/* 拖拽 handle */}
      <div
        ref={dragHandle}
        className="shrink-0 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-35 hover:!opacity-70 transition-opacity touch-none"
      >
        <GripVertical size={11} className="text-white/60" />
      </div>

      {/* 展开/折叠 */}
      <button
        onClick={onToggle}
        className="shrink-0 w-4 h-4 flex items-center justify-center text-white/30 hover:text-white/60"
      >
        {hasChildren
          ? (expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />)
          : <span className="w-3 h-3 border-l border-b border-white/10 rounded-bl-sm ml-1 mb-1" />}
      </button>

      {/* 颜色圆点 */}
      <div className="relative shrink-0">
        <button
          onClick={() => setShowPalette(p => !p)}
          className="w-3 h-3 rounded-full ring-1 ring-white/20 hover:ring-white/50 transition-all"
          style={{ background: node.color ?? '#6b7280' }}
        />
        {showPalette && (
          <div className="absolute left-0 top-5 z-50 bg-[#1a1a1a] border border-white/10 rounded-lg p-2 shadow-xl flex flex-wrap gap-1.5 w-[136px]">
            {PALETTE.map(c => (
              <button key={c} onClick={() => { onColorChange(c); setShowPalette(false) }}
                className="w-6 h-6 rounded-full ring-1 ring-white/20 hover:ring-white/60 transition-all"
                style={{ background: c }} />
            ))}
            <input type="color" defaultValue={node.color ?? '#6b7280'}
              onChange={e => onColorChange(e.target.value)}
              className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0" title="自定义颜色" />
          </div>
        )}
      </div>

      {/* 标签名 */}
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') cancelRename() }}
          className="flex-1 bg-transparent border-b border-white/30 outline-none text-sm text-white caret-white min-w-0"
        />
      ) : (
        <span
          className="flex-1 text-sm text-white/80 truncate cursor-default select-none"
          onDoubleClick={() => setEditing(true)}
        >
          {node.name}
        </span>
      )}

      {/* 选择模式徽章：仅当有子节点时常驻显示 */}
      {hasChildren && (
        <span
          className={`shrink-0 text-[9px] font-medium px-1 py-0.5 rounded leading-none select-none ${
            isSingle
              ? 'bg-amber-500/15 text-amber-400/80 ring-1 ring-inset ring-amber-500/25'
              : 'bg-white/[0.04]  text-white/25     ring-1 ring-inset ring-white/8'
          }`}
        >
          {isSingle ? '单选' : '多选'}
        </span>
      )}

      {/* 操作按钮 */}
      <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {editing ? (
          <>
            <button onClick={commitRename} className="p-1 rounded text-emerald-400 hover:bg-white/10"><Check  size={11} /></button>
            <button onClick={cancelRename} className="p-1 rounded text-red-400    hover:bg-white/10"><X      size={11} /></button>
          </>
        ) : (
          <>
            {/* 切换选择模式 */}
            <button
              onClick={onModeToggle}
              className={`p-1 rounded hover:bg-white/10 transition-colors ${
                isSingle ? 'text-amber-400/70 hover:text-amber-400' : 'text-white/30 hover:text-white/60'
              }`}
              title={isSingle ? '当前：单选互斥 — 点击切换为多选并列' : '当前：多选并列 — 点击切换为单选互斥'}
            >
              {isSingle ? <ToggleRight size={11} /> : <ToggleLeft size={11} />}
            </button>
            <button onClick={() => setEditing(true)} className="p-1 rounded text-white/40 hover:text-white/80  hover:bg-white/10" title="重命名"><Edit2  size={11} /></button>
            <button onClick={onAddChild}              className="p-1 rounded text-white/40 hover:text-emerald-300 hover:bg-white/10" title="添加子节点"><Plus size={11} /></button>
            <button onClick={onDelete}                className="p-1 rounded text-white/40 hover:text-red-400   hover:bg-white/10" title="删除"><Trash2 size={11} /></button>
          </>
        )}
      </div>
    </div>
  )
}

// ── 内联添加子节点表单 ────────────────────────────────────────────────────
function InlineAddForm({
  parentId, depth, onAdd, onCancel,
}: {
  parentId: string
  depth:    number
  onAdd:    (parentId: string, name: string, color: string) => void
  onCancel: () => void
}) {
  const [name,  setName]  = useState('')
  const [color, setColor] = useState('#6b7280')
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus() }, [])
  const submit = () => { const t = name.trim(); if (t) onAdd(parentId, t, color) }

  return (
    <div
      className="flex items-center gap-2 px-2 py-[5px] rounded border border-white/10 bg-white/[0.02] mx-1 my-0.5"
      style={{ marginLeft: `${8 + (depth + 1) * 20}px` }}
    >
      <input type="color" value={color} onChange={e => setColor(e.target.value)}
        className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent p-0 shrink-0" />
      <input
        ref={ref}
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel() }}
        placeholder="子节点名称…"
        className="flex-1 bg-transparent outline-none text-sm text-white caret-white placeholder-neutral-600 border-b border-white/20"
      />
      <button onClick={submit}   className="p-1 text-emerald-400 hover:text-emerald-300"><Check size={11} /></button>
      <button onClick={onCancel} className="p-1 text-white/40  hover:text-white/70"><X     size={11} /></button>
    </div>
  )
}

// ── 添加根节点表单 ────────────────────────────────────────────────────────
function AddRootForm({ onAdd }: { onAdd: (name: string, color: string) => Promise<void> }) {
  const [open,   setOpen]   = useState(false)
  const [name,   setName]   = useState('')
  const [color,  setColor]  = useState('#6b7280')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { if (open) inputRef.current?.focus() }, [open])

  const submit = async () => {
    const t = name.trim()
    if (!t) return
    setSaving(true); setError('')
    try {
      await onAdd(t, color)
      setName(''); setColor('#6b7280'); setOpen(false)
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  if (!open) return (
    <button onClick={() => setOpen(true)}
      className="flex items-center gap-2 px-3 py-2 text-sm text-amber-300/70 hover:text-amber-300 border border-dashed border-amber-500/20 hover:border-amber-500/50 rounded-lg transition-colors w-full">
      <Plus size={14} /><span>新增根节点</span>
    </button>
  )

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 px-3 py-2 border border-amber-500/30 rounded-lg bg-white/[0.02]">
        <input type="color" value={color} onChange={e => setColor(e.target.value)}
          className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0 shrink-0" />
        <input ref={inputRef} value={name} onChange={e => { setName(e.target.value); setError('') }}
          onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') { setOpen(false); setName(''); setError('') } }}
          placeholder="标签名称…"
          className="flex-1 bg-transparent outline-none text-sm text-white caret-white placeholder-neutral-600 border-b border-white/20" />
        <button onClick={submit} disabled={saving} className="p-1 text-emerald-400 hover:text-emerald-300 disabled:opacity-40">
          {saving ? <span className="text-[10px]">…</span> : <Check size={13} />}
        </button>
        <button onClick={() => { setOpen(false); setName(''); setError('') }} className="p-1 text-white/40 hover:text-white/70"><X size={13} /></button>
      </div>
      {error && <p className="text-xs text-red-400 px-1">{error}</p>}
    </div>
  )
}

// ── 根节点 Drop Zone（拖到此处提升为根节点）─────────────────────────────
function RootDropZone({ onDrop }: { onDrop: (dragId: string) => void }) {
  const [{ isOver }, drop] = useDrop<DragItem, void, { isOver: boolean }>({
    accept: DRAG_TYPE,
    drop(item) { onDrop(item.id) },
    collect: m => ({ isOver: m.isOver() }),
  })
  return (
    <div
      ref={drop}
      className={`mt-2 flex items-center justify-center px-3 py-2.5 rounded-lg border border-dashed text-xs transition-colors ${
        isOver
          ? 'border-blue-400/60 bg-blue-500/10 text-blue-300'
          : 'border-white/10 text-white/20 hover:border-white/20'
      }`}
    >
      {isOver ? '松手提升为根节点' : '拖到这里 → 提升为根节点'}
    </div>
  )
}

// ── 递归树节点列表 ────────────────────────────────────────────────────────
function TreeNodes({
  nodes, depth, expandedIds, addingToId, tree,
  onToggle, onAddChild, onCommitAddChild, onCancelAddChild,
  onRename, onColorChange, onDelete, onMove, onModeToggle,
}: {
  nodes:            BlockTagNode[]
  depth:            number
  expandedIds:      Set<string>
  addingToId:       string | null
  tree:             BlockTagNode[]
  onToggle:         (id: string) => void
  onAddChild:       (id: string) => void
  onCommitAddChild: (parentId: string, name: string, color: string) => void
  onCancelAddChild: () => void
  onRename:         (id: string, name: string) => void
  onColorChange:    (id: string, color: string) => void
  onDelete:         (id: string) => void
  onMove:           (dragId: string, targetId: string, pos: DropPos) => void
  onModeToggle:     (id: string) => void
}) {
  return (
    <>
      {nodes.map(node => {
        const isSingle   = node.select_mode === 'single'
        const isExpanded = expandedIds.has(node.id)
        const hasKids    = (node.children?.length ?? 0) > 0

        return (
          <div key={node.id}>
            <TagRow
              node={node}
              depth={depth}
              expanded={isExpanded}
              tree={tree}
              onToggle={() => onToggle(node.id)}
              onAddChild={() => onAddChild(node.id)}
              onRename={name => onRename(node.id, name)}
              onColorChange={color => onColorChange(node.id, color)}
              onDelete={() => onDelete(node.id)}
              onMove={onMove}
              onModeToggle={() => onModeToggle(node.id)}
            />
            {addingToId === node.id && (
              <InlineAddForm
                parentId={node.id}
                depth={depth}
                onAdd={onCommitAddChild}
                onCancel={onCancelAddChild}
              />
            )}
            {isExpanded && hasKids && (
              /* 单选组子节点区域：左侧括线延伸到最后一个子节点 */
              <div className="relative">
                {isSingle && (
                  <div
                    className="pointer-events-none absolute top-0 bottom-0 w-px rounded-full"
                    style={{
                      left:       `${14 + depth * 20}px`,
                      background: node.color ?? '#f59e0b',
                      opacity:    0.25,
                    }}
                  />
                )}
                <TreeNodes
                  nodes={node.children!}
                  depth={depth + 1}
                  expandedIds={expandedIds}
                  addingToId={addingToId}
                  tree={tree}
                  onToggle={onToggle}
                  onAddChild={onAddChild}
                  onCommitAddChild={onCommitAddChild}
                  onCancelAddChild={onCancelAddChild}
                  onRename={onRename}
                  onColorChange={onColorChange}
                  onDelete={onDelete}
                  onMove={onMove}
                  onModeToggle={onModeToggle}
                />
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}

// ── 主视图 ────────────────────────────────────────────────────────────────
// ── 节点移动工具（独立于 DnD，不进树行） ────────────────────────────────────
function flatAll(nodes: BlockTagNode[], path = '', result: {id:string;name:string;path:string}[] = []) {
  for (const n of nodes) {
    const here = path ? `${path} › ${n.name}` : n.name
    result.push({ id: n.id, name: n.name, path: here })
    if (n.children?.length) flatAll(n.children, here, result)
  }
  return result
}

function MoveNodeTool({ tree, onMove, onClose }: {
  tree:    BlockTagNode[]
  onMove:  (srcId: string, dstId: string) => void
  onClose: () => void
}) {
  const [srcQ, setSrcQ] = useState('')
  const [dstQ, setDstQ] = useState('')
  const [srcId, setSrcId] = useState('')
  const [dstId, setDstId] = useState('')
  const all = flatAll(tree)

  const srcList = srcQ ? all.filter(n => n.path.toLowerCase().includes(srcQ.toLowerCase())) : all
  const dstList = dstQ ? all.filter(n => n.path.toLowerCase().includes(dstQ.toLowerCase()) && n.id !== srcId)
                       : all.filter(n => n.id !== srcId)

  const srcNode = all.find(n => n.id === srcId)
  const dstNode = all.find(n => n.id === dstId)

  return (
    <div className="border border-blue-500/20 rounded-lg bg-[#0d1117] p-3 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/50 font-medium">移动节点</span>
        <button onClick={onClose} className="text-white/30 hover:text-white/60"><X size={12} /></button>
      </div>

      {/* 选源节点 */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-white/30">选择要移动的节点</span>
        {srcId ? (
          <div className="flex items-center gap-1 px-2 py-1 bg-white/[0.04] rounded text-xs text-white/70">
            <span className="flex-1 truncate">{srcNode?.path}</span>
            <button onClick={() => setSrcId('')} className="text-white/30 hover:text-white/60 shrink-0"><X size={10}/></button>
          </div>
        ) : (
          <>
            <input value={srcQ} onChange={e => setSrcQ(e.target.value)} placeholder="搜索节点…"
              className="bg-white/[0.04] border border-white/10 rounded px-2 py-1 text-xs text-white/70 placeholder-white/20 outline-none" />
            {srcQ && (
              <div className="max-h-32 overflow-y-auto border border-white/[0.06] rounded">
                {srcList.slice(0,20).map(n => (
                  <button key={n.id} onClick={() => { setSrcId(n.id); setSrcQ('') }}
                    className="w-full text-left px-2 py-1 text-[11px] text-white/60 hover:bg-white/[0.06] truncate">{n.path}</button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* 选目标节点 */}
      {srcId && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-white/30">移入到…</span>
          {dstId ? (
            <div className="flex items-center gap-1 px-2 py-1 bg-white/[0.04] rounded text-xs text-white/70">
              <span className="flex-1 truncate">{dstNode?.path}</span>
              <button onClick={() => setDstId('')} className="text-white/30 hover:text-white/60 shrink-0"><X size={10}/></button>
            </div>
          ) : (
            <>
              <input value={dstQ} onChange={e => setDstQ(e.target.value)} placeholder="搜索目标节点…"
                className="bg-white/[0.04] border border-white/10 rounded px-2 py-1 text-xs text-white/70 placeholder-white/20 outline-none" />
              {dstQ && (
                <div className="max-h-32 overflow-y-auto border border-white/[0.06] rounded">
                  {dstList.slice(0,20).map(n => (
                    <button key={n.id} onClick={() => { setDstId(n.id); setDstQ('') }}
                      className="w-full text-left px-2 py-1 text-[11px] text-white/60 hover:bg-white/[0.06] truncate">{n.path}</button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* 确认 */}
      {srcId && dstId && (
        <button
          onClick={() => { onMove(srcId, dstId); onClose() }}
          className="px-3 py-1.5 rounded text-xs bg-blue-600 hover:bg-blue-500 text-white transition-colors"
        >
          确认移动
        </button>
      )}
    </div>
  )
}

export default function TagTreeView() {
  const { tagTree, loading, createTag, updateTag, deleteTag, moveTag } = useBlockTags()
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [addingToId,  setAddingToId]  = useState<string | null>(null)
  const [showMoveTool, setShowMoveTool] = useState(false)

  // 首次加载后展开所有根节点
  useEffect(() => {
    if (tagTree.length > 0 && expandedIds.size === 0) {
      setExpandedIds(new Set(tagTree.map(n => n.id)))
    }
  }, [tagTree.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = useCallback((id: string) =>
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    }), [])

  const handleAddChild = useCallback((id: string) => {
    setExpandedIds(prev => new Set([...prev, id]))
    setAddingToId(id)
  }, [])

  const handleCommitAddChild = useCallback(async (parentId: string, name: string, color: string) => {
    await createTag(parentId, name, color).catch(() => {})
    setAddingToId(null)
  }, [createTag])

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('确认删除该节点及所有子节点？')) return
    await deleteTag(id)
  }, [deleteTag])

  const handleModeToggle = useCallback(async (id: string) => {
    const node = tagTree.reduce<BlockTagNode | null>((found, n) => {
      if (found) return found
      function search(ns: BlockTagNode[]): BlockTagNode | null {
        for (const x of ns) {
          if (x.id === id) return x
          if (x.children) { const f = search(x.children); if (f) return f }
        }
        return null
      }
      return search([n])
    }, null)
    if (!node) return
    const next = node.select_mode === 'single' ? 'multi' : 'single'
    await updateTag(id, { select_mode: next })
  }, [tagTree, updateTag])

  const handleMove = useCallback(async (dragId: string, targetId: string, pos: DropPos) => {
    if (dragId === targetId) return

    if (pos === 'inside') {
      const target = findNode(tagTree, targetId)
      const position = target?.children?.length ?? 0
      setExpandedIds(prev => new Set([...prev, targetId]))
      await moveTag(dragId, targetId, position)
    } else {
      const info = findParentAndIndex(tagTree, targetId)
      if (!info) return
      const newParentId = info.parent?.id ?? null
      const position = pos === 'before' ? info.index : info.index + 1
      await moveTag(dragId, newParentId, position)
    }
  }, [tagTree, moveTag])

  // 提升为根节点
  const handlePromoteToRoot = useCallback(async (dragId: string) => {
    await moveTag(dragId, null, tagTree.length)
  }, [tagTree.length, moveTag])

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex flex-col h-full bg-[#0a0a0a] overflow-hidden">

        {/* 顶栏 */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div>
            <h2 className="text-sm font-semibold text-white/80">标签语义树</h2>
            <p className="text-xs text-white/30 mt-0.5">分类体系 · 拖拽排序 / 跨父移动</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMoveTool(v => !v)}
              className={`px-2 py-1 rounded text-[11px] border transition-colors ${
                showMoveTool
                  ? 'border-blue-500/50 text-blue-300 bg-blue-500/10'
                  : 'border-white/10 text-white/30 hover:text-white/60 hover:border-white/20'
              }`}
            >
              移动节点
            </button>
            <span className="text-xs text-white/20">{tagTree.length} 根节点</span>
          </div>
        </div>

        {/* 移动工具面板 */}
        {showMoveTool && (
          <div className="shrink-0 px-4 pt-3 pb-2 border-b border-white/[0.06]">
            <MoveNodeTool
              tree={tagTree}
              onMove={(srcId, dstId) => handleMove(srcId, dstId, 'inside')}
              onClose={() => setShowMoveTool(false)}
            />
          </div>
        )}

        {/* 树内容 */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center text-white/20 py-12 text-sm">加载中…</div>
          ) : tagTree.length === 0 ? (
            <div className="text-center text-white/20 py-12 text-sm">暂无标签，点击下方新增</div>
          ) : (
            <TreeNodes
              nodes={tagTree}
              depth={0}
              expandedIds={expandedIds}
              addingToId={addingToId}
              tree={tagTree}
              onToggle={toggle}
              onAddChild={handleAddChild}
              onCommitAddChild={handleCommitAddChild}
              onCancelAddChild={() => setAddingToId(null)}
              onRename={(id, name) => updateTag(id, { name })}
              onColorChange={(id, color) => updateTag(id, { color })}
              onDelete={handleDelete}
              onMove={handleMove}
              onModeToggle={handleModeToggle}
            />
          )}
        </div>

        {/* 底部：新增根节点 + 提升 drop zone */}
        <div className="shrink-0 px-4 pb-4 pt-2 border-t border-white/[0.06] flex flex-col gap-2">
          <RootDropZone onDrop={handlePromoteToRoot} />
          <AddRootForm onAdd={async (name, color) => { await createTag(null, name, color) }} />
        </div>
      </div>
    </DndProvider>
  )
}
