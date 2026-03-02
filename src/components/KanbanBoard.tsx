/**
 * KanbanBoard.tsx
 *
 * 拖拽方案：全部用原生 Pointer Events，彻底去掉 react-dnd
 *  - 同列排序 ✅  跨列移动 ✅  触摸屏 ✅  无 HTML5 drag 冲突 ✅
 *  - ghost 元素跟随鼠标，有视觉反馈
 *  - 蓝色 InsertLine 实时显示插入位置
 *
 * 数据：后端 REST API，无 localStorage，无硬编码默认数据
 *  BASE_URL = 'http://localhost:3003/api'（可修改）
 *
 * 依赖：react, lucide-react（无 react-dnd）
 *
 * 后端接口：
 *   GET  /kanban           → { columns: Column[], tasks: Task[] }
 *   PUT  /kanban/columns   body: Column[]  → 204
 *   PUT  /kanban/tasks     body: Task[]    → 204
 */

import React, { useState, useRef, useCallback, useEffect } from 'react'
import {
  Plus, MoreHorizontal, Trash2, GripVertical,
  Search, Palette, Calendar, User,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Priority = 'urgent' | 'high' | 'medium' | 'low'

interface Task {
  id: string
  name: string
  icon: string
  assignee?: string
  startDate: string
  dueDate?: string
  project?: string
  projectIcon?: string
  status: string        // equals the column id
  priority: Priority
  sortOrder: number     // descending: higher = top of column
  created_at: string
  updated_at: string
  tags?: string[]
  columnId?: string     // for API compat
}

interface Column {
  id: string
  label: string
  headerBg: string
  cardBg: string
  accent: string
  tasks: Task[]
}

// ─── API ──────────────────────────────────────────────────────────────────────

const API_BASE = 'http://localhost:3003/api'

async function fetchKanban(): Promise<Column[] | null> {
  try {
    const res = await fetch(`${API_BASE}/kanban`)
    if (!res.ok) return null
    const data = await res.json()
    return data.columns.map((col: Column) => ({
      ...col,
      tasks: (data.tasks ?? []).filter((t: Task) => (t.columnId ?? t.status) === col.id),
    }))
  } catch { return null }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null
function scheduleSave(columns: Column[]) {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    const colsData  = columns.map(({ tasks: _t, ...c }) => c)
    const tasksData = columns.flatMap(col =>
      col.tasks.map(t => ({ ...t, columnId: col.id, status: col.id }))
    )
    try {
      await Promise.all([
        fetch(`${API_BASE}/kanban/columns`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(colsData),
        }),
        fetch(`${API_BASE}/kanban/tasks`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(tasksData),
        }),
      ])
    } catch (e) { console.error('save failed:', e) }
  }, 600)
}

// ─── Constants ────────────────────────────────────────────────────────────────

const THEMES = [
  { headerBg: 'bg-[#7B5EA7]', cardBg: 'bg-[#1e1530]', accent: '#9B72CF' },
  { headerBg: 'bg-[#2E7DC5]', cardBg: 'bg-[#0a1f35]', accent: '#4A9DE0' },
  { headerBg: 'bg-[#2E9E6A]', cardBg: 'bg-[#0a2318]', accent: '#3DBF80' },
  { headerBg: 'bg-[#C27B2B]', cardBg: 'bg-[#251508]', accent: '#E09030' },
  { headerBg: 'bg-[#C24040]', cardBg: 'bg-[#250a0a]', accent: '#D85050' },
  { headerBg: 'bg-[#5B8FAF]', cardBg: 'bg-[#0a1e2b]', accent: '#6BAACF' },
  { headerBg: 'bg-[#7BAF5B]', cardBg: 'bg-[#14240a]', accent: '#8DCF6B' },
  { headerBg: 'bg-[#AF5B8F]', cardBg: 'bg-[#250a1a]', accent: '#CF6BAF' },
]

const EMOJIS = [
  '📝','🧠','💡','🚀','⚡','🎯','📚','🔧','🎨','💻',
  '🌟','✨','🔥','💪','🎮','🎵','📋','💼','🏠','❤️',
  '🌈','🦄','🌙','⚙️','🔬','🎭','📊','🗂️','📈','🔍',
]

const PRI: Record<Priority, { label: string; cls: string; dot: string }> = {
  urgent: { label: '紧急', cls: 'text-red-400 bg-red-500/10 border-red-500/25',            dot: '#ef4444' },
  high:   { label: '高',   cls: 'text-orange-400 bg-orange-500/10 border-orange-500/25',   dot: '#f97316' },
  medium: { label: '中',   cls: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/25',   dot: '#eab308' },
  low:    { label: '低',   cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25', dot: '#10b981' },
}

const uid      = () => `id-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
const todayISO = () => new Date().toISOString().slice(0, 10)
const fmtDate  = (s?: string) => {
  if (!s) return ''
  try { return new Date(s).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) }
  catch { return s }
}
const sortDesc = (arr: Task[]) => [...arr].sort((a, b) => b.sortOrder - a.sortOrder)

function calcInsertSortOrder(sorted: Task[], insertBefore: number, excludeId?: string): number {
  const list = excludeId ? sorted.filter(t => t.id !== excludeId) : sorted
  if (!list.length) return 1000
  if (insertBefore <= 0)           return list[0].sortOrder + 100
  if (insertBefore >= list.length) return Math.max(0.01, list[list.length - 1].sortOrder - 1)
  return (list[insertBefore - 1].sortOrder + list[insertBefore].sortOrder) / 2
}

// ─── InsertLine ───────────────────────────────────────────────────────────────

const InsertLine = () => (
  <div className="relative h-0 my-1 pointer-events-none z-10" aria-hidden>
    <div className="absolute inset-x-0 h-[2px] rounded-full bg-blue-400"
      style={{ boxShadow: '0 0 8px 2px rgba(96,165,250,0.8)' }} />
    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-blue-400"
      style={{ boxShadow: '0 0 6px 2px rgba(96,165,250,0.8)' }} />
  </div>
)

// ─── TaskCard ─────────────────────────────────────────────────────────────────

interface CardProps {
  task: Task
  col: Column
  allCols: Column[]
  dragging: boolean
  lineAbove: boolean
  lineBelow: boolean
  onEdit:      (t: Task) => void
  onDelete:    (taskId: string, colId: string) => void
  onMenuMove:  (taskId: string, fromColId: string, toColId: string) => void
  setHandleRef: (el: HTMLElement | null) => void
  setCardRef:   (el: HTMLDivElement | null) => void
}

const TaskCard = React.memo(function TaskCard({
  task, col, allCols, dragging, lineAbove, lineBelow,
  onEdit, onDelete, onMenuMove, setHandleRef, setCardRef,
}: CardProps) {
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const p = PRI[task.priority]

  useEffect(() => {
    if (!showMenu) return
    const h = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setShowMenu(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [showMenu])

  return (
    <>
      {lineAbove && <InsertLine />}

      <div
        ref={setCardRef}
        data-task-id={task.id}
        data-col-id={col.id}
        className={[
          'group relative rounded-xl border transition-colors duration-100 select-none',
          col.cardBg,
          'border-white/[0.06] hover:border-white/[0.14]',
          dragging ? 'opacity-25 scale-[0.97]' : 'cursor-pointer',
        ].join(' ')}
        onClick={() => !showMenu && onEdit(task)}
      >
        {/* accent bar */}
        <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full"
          style={{ backgroundColor: col.accent }} />

        <div className="px-4 py-3 pl-5">
          <div className="flex items-start gap-2 mb-1.5">
            {/* drag handle — board-level pointerdown listener picks this up */}
            <div
              ref={setHandleRef}
              data-handle-task={task.id}
              className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing mt-0.5 shrink-0 touch-none"
            >
              <GripVertical size={12} className="text-white/30 hover:text-white/60" />
            </div>

            <span className="text-[16px] shrink-0 mt-0.5">{task.icon}</span>
            <span className="flex-1 min-w-0 text-[13px] font-semibold text-white/90 leading-snug break-words">
              {task.name}
            </span>

            {/* context menu */}
            <div ref={menuRef} className="relative shrink-0" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => setShowMenu(v => !v)}
                className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-white/30 hover:text-white/70 transition-all"
              >
                <MoreHorizontal size={12} />
              </button>
              {showMenu && (
                <div className="absolute right-0 top-6 z-50 w-44 bg-[#1a1a1c] border border-white/10 rounded-xl shadow-2xl py-1.5 text-[13px]">
                  <div className="px-3 pb-1">
                    <p className="text-[10px] text-white/25 uppercase tracking-wider mb-1.5">移动到</p>
                    {allCols.filter(c => c.id !== col.id).map(c => (
                      <button key={c.id}
                        onClick={() => { onMenuMove(task.id, col.id, c.id); setShowMenu(false) }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/8 transition-colors"
                      >
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.accent }} />
                        <span className="truncate">{c.label}</span>
                      </button>
                    ))}
                  </div>
                  <div className="border-t border-white/5 my-1" />
                  <button
                    onClick={() => {
                      if (window.confirm(`删除「${task.name}」？`)) { onDelete(task.id, col.id); setShowMenu(false) }
                    }}
                    className="w-full flex items-center gap-2 px-4 py-1.5 text-red-400/80 hover:text-red-400 hover:bg-red-500/8 transition-colors"
                  >
                    <Trash2 size={11} /> 删除任务
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* meta */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/30 ml-6">
            {task.assignee && (
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded-full bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center text-[8px] font-bold text-white shrink-0">
                  {task.assignee[0].toUpperCase()}
                </div>
                <span>{task.assignee}</span>
              </div>
            )}
            <span className="flex items-center gap-0.5">
              <Calendar size={9} className="shrink-0" /> 开始 {fmtDate(task.startDate)}
            </span>
            {task.dueDate && (
              <span className="flex items-center gap-0.5 text-white/20">
                <Calendar size={9} className="shrink-0" /> 截止 {fmtDate(task.dueDate)}
              </span>
            )}
          </div>

          {/* footer */}
          <div className="flex items-center justify-between mt-2 ml-6">
            <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium ${p.cls}`}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.dot }} />
              {p.label}
            </span>
            {task.project && (
              <span className="flex items-center gap-1 text-[11px] text-white/25 max-w-[110px]">
                {task.projectIcon && <span>{task.projectIcon}</span>}
                <span className="truncate">{task.project}</span>
              </span>
            )}
          </div>

          {task.tags && task.tags.length > 0 && (
            <div className="flex gap-1 mt-1.5 ml-6 flex-wrap">
              {task.tags.map(tag => (
                <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/25 border border-white/8">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {lineBelow && <InsertLine />}
    </>
  )
})

// ─── KanbanCol ────────────────────────────────────────────────────────────────

interface ColProps {
  col: Column
  allCols: Column[]
  draggingId: string | null
  hoverColId: string | null
  insertLine: { colId: string; idx: number } | null
  onAddTask:   (colId: string) => void
  onEditTask:  (task: Task, colId: string) => void
  onDelete:    (taskId: string, colId: string) => void
  onMenuMove:  (taskId: string, fromColId: string, toColId: string) => void
  onDeleteCol: (colId: string) => void
  onRenameCol: (colId: string, label: string) => void
  registerHandle: (taskId: string, el: HTMLElement | null) => void
  registerCard:   (taskId: string, el: HTMLDivElement | null) => void
}

function KanbanCol({
  col, allCols, draggingId, hoverColId, insertLine,
  onAddTask, onEditTask, onDelete, onMenuMove, onDeleteCol, onRenameCol,
  registerHandle, registerCard,
}: ColProps) {
  const sorted    = sortDesc(col.tasks)
  const isHovered = hoverColId === col.id

  const [showMenu,  setShowMenu]  = useState(false)
  const [editTitle, setEditTitle] = useState(false)
  const [draft,     setDraft]     = useState(col.label)
  const menuRef  = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!showMenu) return
    const h = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setShowMenu(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [showMenu])

  useEffect(() => {
    if (editTitle) setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select() }, 0)
  }, [editTitle])

  const commitTitle = () => {
    if (draft.trim() && draft !== col.label) onRenameCol(col.id, draft.trim())
    else setDraft(col.label)
    setEditTitle(false)
  }

  // visible list = sorted minus currently-dragged card (for line index mapping)
  const sortedVisible = sorted.filter(t => t.id !== draggingId)
  const lineIdx = insertLine?.colId === col.id ? insertLine.idx : null

  return (
    <div className="flex flex-col shrink-0 w-[272px]" data-col-id={col.id}>
      {/* header */}
      <div className={`${col.headerBg} rounded-xl px-3.5 py-2.5 mb-3 flex items-center gap-2`}>
        <span className="w-2.5 h-2.5 rounded-full bg-white/30 shrink-0" />

        {editTitle ? (
          <input ref={inputRef} value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={e => {
              if (e.key === 'Enter')  commitTitle()
              if (e.key === 'Escape') { setDraft(col.label); setEditTitle(false) }
            }}
            className="flex-1 bg-transparent text-white text-sm font-semibold outline-none border-b border-white/40 min-w-0"
          />
        ) : (
          <span className="flex-1 text-white text-sm font-semibold truncate cursor-default"
            onDoubleClick={() => setEditTitle(true)}>
            {col.label}
          </span>
        )}

        <span className="bg-white/20 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 tabular-nums">
          {col.tasks.length}
        </span>

        <div ref={menuRef} className="relative shrink-0">
          <button onClick={() => setShowMenu(v => !v)}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/20 text-white/60 hover:text-white transition-colors">
            <MoreHorizontal size={13} />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-8 z-50 w-36 bg-[#1a1a1c] border border-white/10 rounded-xl shadow-2xl py-1 text-[13px]">
              <button onClick={() => { setEditTitle(true); setShowMenu(false) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-white/60 hover:text-white hover:bg-white/8">
                <Palette size={11} /> 重命名
              </button>
              <button onClick={() => { onAddTask(col.id); setShowMenu(false) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-white/60 hover:text-white hover:bg-white/8">
                <Plus size={11} /> 添加任务
              </button>
              <div className="border-t border-white/5 my-1" />
              <button onClick={() => { onDeleteCol(col.id); setShowMenu(false) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-red-400/70 hover:text-red-400 hover:bg-red-500/8">
                <Trash2 size={11} /> 删除列
              </button>
            </div>
          )}
        </div>
      </div>

      {/* task list */}
      <div
        data-col-drop={col.id}
        className={[
          'flex-1 flex flex-col gap-2 min-h-[80px] rounded-xl px-0.5 pb-2 transition-colors duration-100',
          isHovered ? 'bg-white/[0.025] ring-1 ring-inset ring-white/8' : '',
        ].join(' ')}
      >
        {sorted.map((task) => {
          const visIdx   = sortedVisible.findIndex(t => t.id === task.id)
          const showAbove = lineIdx !== null && visIdx !== -1 && visIdx === lineIdx
          const showBelow = lineIdx !== null && visIdx !== -1
            && visIdx === sortedVisible.length - 1
            && lineIdx >= sortedVisible.length

          return (
            <TaskCard
              key={task.id}
              task={task}
              col={col}
              allCols={allCols}
              dragging={draggingId === task.id}
              lineAbove={showAbove}
              lineBelow={showBelow}
              onEdit={t  => onEditTask(t, col.id)}
              onDelete={onDelete}
              onMenuMove={onMenuMove}
              setHandleRef={el => registerHandle(task.id, el)}
              setCardRef={el   => registerCard(task.id, el)}
            />
          )
        })}

        {/* insert line after all cards */}
        {lineIdx !== null && lineIdx >= sortedVisible.length && sortedVisible.length > 0 && (
          <InsertLine />
        )}

        {col.tasks.length === 0 && (
          <div className={[
            'flex-1 min-h-[80px] rounded-lg border-2 border-dashed flex items-center justify-center text-xs transition-colors',
            isHovered ? 'border-white/20 text-white/35' : 'border-white/5 text-white/15',
          ].join(' ')}>
            {isHovered ? '放到这里' : '暂无任务'}
          </div>
        )}

        <button onClick={() => onAddTask(col.id)}
          className="flex items-center gap-1.5 px-2 py-2 rounded-lg text-white/20 hover:text-white/55 hover:bg-white/5 transition-all text-xs group/add mt-0.5">
          <Plus size={12} className="group-hover/add:rotate-90 transition-transform duration-150" />
          添加任务
        </button>
      </div>
    </div>
  )
}

// ─── Task Modal ───────────────────────────────────────────────────────────────

interface ModalProps {
  init?: Task
  defaultColId: string
  allCols: Column[]
  onConfirm: (fields: Partial<Task>, colId: string) => void
  onClose: () => void
}

function TaskModal({ init, defaultColId, allCols, onConfirm, onClose }: ModalProps) {
  const [name,        setName]        = useState(init?.name ?? '')
  const [icon,        setIcon]        = useState(init?.icon ?? '📝')
  const [priority,    setPriority]    = useState<Priority>(init?.priority ?? 'medium')
  const [assignee,    setAssignee]    = useState(init?.assignee ?? '')
  const [startDate,   setStartDate]   = useState(init?.startDate ?? todayISO())
  const [dueDate,     setDueDate]     = useState(init?.dueDate ?? '')
  const [project,     setProject]     = useState(init?.project ?? '')
  const [projectIcon, setProjectIcon] = useState(init?.projectIcon ?? '')
  const [tagsRaw,     setTagsRaw]     = useState((init?.tags ?? []).join(', '))
  const [showEmoji,   setShowEmoji]   = useState(false)

  const submit = () => {
    if (!name.trim()) return
    onConfirm({
      name: name.trim(), icon, priority,
      assignee:    assignee.trim()     || undefined,
      startDate:   startDate          || todayISO(),
      dueDate:     dueDate.trim()     || undefined,
      project:     project.trim()     || undefined,
      projectIcon: projectIcon.trim() || undefined,
      tags:        tagsRaw.split(',').map(t => t.trim()).filter(Boolean),
    }, defaultColId)
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[200]"
      onClick={onClose}>
      <div className="bg-[#18181b] border border-white/10 rounded-2xl p-6 w-[400px] shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-white mb-5">{init ? '编辑任务' : '新建任务'}</h3>

        <div className="flex items-center gap-3 mb-4">
          <div className="relative">
            <button onClick={() => setShowEmoji(v => !v)}
              className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-xl flex items-center justify-center hover:bg-white/10 transition-colors">
              {icon}
            </button>
            {showEmoji && (
              <div className="absolute top-12 left-0 z-20 bg-[#222] border border-white/10 rounded-xl p-2 shadow-2xl">
                <div className="grid grid-cols-6 gap-0.5 max-h-40 overflow-y-auto">
                  {EMOJIS.map(e => (
                    <button key={e} onClick={() => { setIcon(e); setShowEmoji(false) }}
                      className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 text-lg">{e}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <input autoFocus value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit() }}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-white/25 placeholder-white/20"
            placeholder="任务名称" />
        </div>

        <div className="mb-4">
          <label className="text-[11px] text-white/40 mb-1.5 block">优先级</label>
          <div className="flex gap-1.5">
            {(Object.keys(PRI) as Priority[]).map(p => (
              <button key={p} onClick={() => setPriority(p)}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium border transition-all
                  ${priority === p ? PRI[p].cls : 'bg-white/5 border-white/5 text-white/30 hover:text-white/60'}`}>
                {PRI[p].label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="text-[11px] text-white/40 mb-1.5 flex items-center gap-1 block">
            <User size={9} /> 负责人
          </label>
          <input value={assignee} onChange={e => setAssignee(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-white/25 placeholder-white/20"
            placeholder="用户名（可选）" />
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-[11px] text-white/40 mb-1.5 flex items-center gap-1 block">
              <Calendar size={9} /> 开始日期
            </label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-white/25 [color-scheme:dark]" />
          </div>
          <div>
            <label className="text-[11px] text-white/40 mb-1.5 flex items-center gap-1 block">
              <Calendar size={9} /> 截止日期
            </label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-white/25 [color-scheme:dark]" />
          </div>
        </div>

        <div className="grid grid-cols-[44px_1fr] gap-2 mb-4">
          <div>
            <label className="text-[11px] text-white/40 mb-1.5 block">图标</label>
            <input value={projectIcon} onChange={e => setProjectIcon(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-2 py-2 text-sm text-white outline-none focus:border-white/25 text-center"
              placeholder="🚀" maxLength={2} />
          </div>
          <div>
            <label className="text-[11px] text-white/40 mb-1.5 block">所属项目</label>
            <input value={project} onChange={e => setProject(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-white/25 placeholder-white/20"
              placeholder="可选" />
          </div>
        </div>

        <div className="mb-5">
          <label className="text-[11px] text-white/40 mb-1.5 block">标签（逗号分隔）</label>
          <input value={tagsRaw} onChange={e => setTagsRaw(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-white/25 placeholder-white/20"
            placeholder="AI, Research, Finance" />
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-1.5 text-sm text-white/40 hover:text-white/70 transition-colors">取消</button>
          <button onClick={submit} disabled={!name.trim()}
            className="px-4 py-1.5 text-sm bg-white text-black rounded-xl font-medium hover:bg-white/90 disabled:opacity-25 transition-colors">
            {init ? '保存' : '创建'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── AddColModal ──────────────────────────────────────────────────────────────

function AddColModal({ usedIdx, onConfirm, onClose }: {
  usedIdx: number[]
  onConfirm: (label: string, themeIdx: number) => void
  onClose: () => void
}) {
  const [label, setLabel] = useState('')
  const [ti, setTi] = useState(() => {
    for (let i = 0; i < THEMES.length; i++) if (!usedIdx.includes(i)) return i
    return 0
  })
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[200]"
      onClick={onClose}>
      <div className="bg-[#18181b] border border-white/10 rounded-2xl p-6 w-72 shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-white mb-4">新建列</h3>
        <div className="mb-4">
          <label className="text-[11px] text-white/40 mb-1.5 block">列名称</label>
          <input autoFocus value={label} onChange={e => setLabel(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && label.trim()) onConfirm(label, ti) }}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-white/25 placeholder-white/20"
            placeholder="例如：进行中" />
        </div>
        <div className="mb-5">
          <label className="text-[11px] text-white/40 mb-2 block">颜色</label>
          <div className="flex gap-2 flex-wrap">
            {THEMES.map((t, i) => (
              <button key={i} onClick={() => setTi(i)}
                className={`w-7 h-7 rounded-lg transition-all ${t.headerBg} ${ti === i ? 'ring-2 ring-white/60 scale-110' : 'opacity-40 hover:opacity-80'}`} />
            ))}
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-1.5 text-sm text-white/40 hover:text-white/70 transition-colors">取消</button>
          <button onClick={() => { if (label.trim()) onConfirm(label, ti) }} disabled={!label.trim()}
            className="px-4 py-1.5 text-sm bg-white text-black rounded-xl font-medium hover:bg-white/90 disabled:opacity-25 transition-colors">
            创建
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── KanbanBoard (root) ───────────────────────────────────────────────────────

export default function KanbanBoard() {
  const [columns,     setColumns]     = useState<Column[]>([])
  const [loading,     setLoading]     = useState(true)
  const [addingToCol, setAddingToCol] = useState<string | null>(null)
  const [editingTask, setEditingTask] = useState<{ task: Task; colId: string } | null>(null)
  const [showAddCol,  setShowAddCol]  = useState(false)
  const [search,      setSearch]      = useState('')

  // drag visual state (drives renders in child components)
  const [draggingId,  setDraggingId]  = useState<string | null>(null)
  const [hoverColId,  setHoverColId]  = useState<string | null>(null)
  const [insertLine,  setInsertLine]  = useState<{ colId: string; idx: number } | null>(null)

  // ── DOM ref maps: taskId → element ──
  const handleMap = useRef(new Map<string, HTMLElement>())
  const cardMap   = useRef(new Map<string, HTMLDivElement>())
  const registerHandle = useCallback((id: string, el: HTMLElement | null) => {
    if (el) handleMap.current.set(id, el); else handleMap.current.delete(id)
  }, [])
  const registerCard = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) cardMap.current.set(id, el); else cardMap.current.delete(id)
  }, [])

  // ── IMPORTANT: colsRef declared BEFORE the drag useEffect ──
  // This ref always holds the latest columns state so the drag handler
  // (which has a stale closure) can still read current data.
  const colsRef = useRef<Column[]>([])
  useEffect(() => { colsRef.current = columns }, [columns])

  // ── Load ──
  useEffect(() => {
    fetchKanban().then(data => {
      if (data) setColumns(data)
      setLoading(false)
    })
  }, [])

  // ── Auto-save (debounced, skip initial load) ──
  const initialized = useRef(false)
  useEffect(() => {
    if (loading) return
    if (!initialized.current) { initialized.current = true; return }
    scheduleSave(columns)
  }, [columns, loading])

  // ══════════════════════════════════════════════════════════════════════════
  //  UNIFIED POINTER-EVENTS DRAG SYSTEM
  //  Single set of listeners on `document`. No react-dnd needed.
  //  Handles both same-column reorder AND cross-column move.
  // ══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    let active       = false
    let dragTaskId   = ''
    let startX       = 0
    let startY       = 0
    let ghost: HTMLDivElement | null = null
    let ghostOffX    = 0
    let ghostOffY    = 0

    // Find column drop-zone element at (x, y)
    const getColEl = (x: number, y: number): HTMLElement | null => {
      for (const el of document.querySelectorAll('[data-col-drop]')) {
        const r = el.getBoundingClientRect()
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom)
          return el as HTMLElement
      }
      return null
    }

    // Find insert position within a column (ignoring the dragged task's card)
    const getInsertIdx = (colEl: HTMLElement, curY: number): number => {
      const cards = Array.from(
        colEl.querySelectorAll('[data-task-id]')
      ).filter(c => (c as HTMLElement).dataset.taskId !== dragTaskId) as HTMLElement[]

      for (let i = 0; i < cards.length; i++) {
        const r = cards[i].getBoundingClientRect()
        if (curY < r.top + r.height / 2) return i
      }
      return cards.length
    }

    // ── pointerdown: only activate when coming from a drag handle ──
    const onDown = (e: PointerEvent) => {
      const handle = (e.target as HTMLElement).closest('[data-handle-task]') as HTMLElement | null
      if (!handle) return
      const taskId = handle.dataset.handleTask
      if (!taskId) return
      // confirm task exists (prevents stale handles)
      if (!colsRef.current.some(c => c.tasks.some(t => t.id === taskId))) return

      dragTaskId = taskId
      startX     = e.clientX
      startY     = e.clientY
      active     = false
      // capture pointer on the handle so we get all move/up events even if cursor leaves
      handle.setPointerCapture(e.pointerId)
      e.preventDefault()
    }

    // ── pointermove: create ghost after threshold, then track ──
    const onMove = (e: PointerEvent) => {
      if (!dragTaskId) return

      if (!active && Math.hypot(e.clientX - startX, e.clientY - startY) > 5) {
        active = true
        setDraggingId(dragTaskId)

        const cardEl = cardMap.current.get(dragTaskId)
        if (cardEl) {
          const rect = cardEl.getBoundingClientRect()
          ghostOffX  = e.clientX - rect.left
          ghostOffY  = e.clientY - rect.top
          ghost      = cardEl.cloneNode(true) as HTMLDivElement
          Object.assign(ghost.style, {
            position:     'fixed',
            width:        `${rect.width}px`,
            left:         `${e.clientX - ghostOffX}px`,
            top:          `${e.clientY - ghostOffY}px`,
            opacity:      '0.88',
            pointerEvents:'none',
            zIndex:       '9999',
            transform:    'rotate(1.5deg) scale(1.03)',
            boxShadow:    '0 24px 48px rgba(0,0,0,0.65)',
            borderRadius: '12px',
          })
          document.body.appendChild(ghost)
        }
      }

      if (!active || !ghost) return

      ghost.style.left = `${e.clientX - ghostOffX}px`
      ghost.style.top  = `${e.clientY - ghostOffY}px`

      const colEl = getColEl(e.clientX, e.clientY)
      const colId = colEl?.dataset.colDrop ?? null
      setHoverColId(colId)
      if (colEl && colId) {
        setInsertLine({ colId, idx: getInsertIdx(colEl, e.clientY) })
      } else {
        setInsertLine(null)
      }
    }

    // ── pointerup: commit drop ──
    const onUp = (e: PointerEvent) => {
      if (!dragTaskId) return

      const wasActive  = active
      const taskId     = dragTaskId
      const colEl      = getColEl(e.clientX, e.clientY)
      const toColId    = colEl?.dataset.colDrop ?? null
      const insertIdx  = colEl && toColId ? getInsertIdx(colEl, e.clientY) : null

      // reset session
      dragTaskId = ''
      active     = false
      if (ghost) { document.body.removeChild(ghost); ghost = null }
      setDraggingId(null)
      setHoverColId(null)
      setInsertLine(null)

      if (!wasActive || !toColId || insertIdx === null) return

      const cols    = colsRef.current
      const fromCol = cols.find(c => c.tasks.some(t => t.id === taskId))
      if (!fromCol) return
      const toCol = cols.find(c => c.id === toColId)
      if (!toCol) return

      const toSorted = sortDesc(toCol.tasks)
      const newOrder = calcInsertSortOrder(toSorted, insertIdx, taskId)

      setColumns(prev => {
        const next = prev.map(c => ({ ...c, tasks: [...c.tasks] }))
        const src  = next.find(c => c.id === fromCol.id)!
        const ti   = src.tasks.findIndex(t => t.id === taskId)
        if (ti < 0) return prev
        const [task] = src.tasks.splice(ti, 1)
        const dst = next.find(c => c.id === toColId)!
        dst.tasks.push({
          ...task,
          status:     toColId,
          columnId:   toColId,
          sortOrder:  newOrder,
          updated_at: new Date().toISOString(),
        })
        return next
      })
    }

    document.addEventListener('pointerdown',  onDown,  { passive: false })
    document.addEventListener('pointermove',  onMove,  { passive: true  })
    document.addEventListener('pointerup',    onUp)
    document.addEventListener('pointercancel',onUp)

    return () => {
      document.removeEventListener('pointerdown',   onDown)
      document.removeEventListener('pointermove',   onMove)
      document.removeEventListener('pointerup',     onUp)
      document.removeEventListener('pointercancel', onUp)
      if (ghost) document.body.removeChild(ghost)
    }
  }, []) // empty deps intentional — uses colsRef for live data

  // ─── Board mutations ───────────────────────────────────────────────────────

  const handleMenuMove = useCallback((taskId: string, fromColId: string, toColId: string) => {
    setColumns(prev => {
      const next = prev.map(c => ({ ...c, tasks: [...c.tasks] }))
      const from = next.find(c => c.id === fromColId)
      const to   = next.find(c => c.id === toColId)
      if (!from || !to) return prev
      const i = from.tasks.findIndex(t => t.id === taskId)
      if (i < 0) return prev
      const [task] = from.tasks.splice(i, 1)
      const maxOrder = to.tasks.length ? Math.max(...to.tasks.map(t => t.sortOrder)) : 0
      to.tasks.push({ ...task, status: toColId, columnId: toColId, sortOrder: maxOrder + 100, updated_at: new Date().toISOString() })
      return next
    })
  }, [])

  const handleDelete = useCallback((taskId: string, colId: string) => {
    setColumns(prev => prev.map(c =>
      c.id === colId ? { ...c, tasks: c.tasks.filter(t => t.id !== taskId) } : c
    ))
  }, [])

  const handleAddTask = (fields: Partial<Task>, colId: string) => {
    const col      = colsRef.current.find(c => c.id === colId)
    const s        = sortDesc(col?.tasks ?? [])
    const newOrder = s.length ? Math.max(1, s[s.length - 1].sortOrder - 100) : 1000
    const task: Task = {
      id: uid(), name: fields.name!, icon: fields.icon ?? '📝',
      priority:    fields.priority ?? 'medium',
      assignee:    fields.assignee,
      startDate:   fields.startDate ?? todayISO(),
      dueDate:     fields.dueDate,
      project:     fields.project,
      projectIcon: fields.projectIcon,
      tags:        fields.tags,
      status:      colId,
      columnId:    colId,
      sortOrder:   newOrder,
      created_at:  new Date().toISOString(),
      updated_at:  new Date().toISOString(),
    }
    setColumns(prev => prev.map(c => c.id === colId ? { ...c, tasks: [...c.tasks, task] } : c))
    setAddingToCol(null)
  }

  const handleEditTask = (fields: Partial<Task>, colId: string) => {
    setColumns(prev => prev.map(c => c.id !== colId ? c : {
      ...c,
      tasks: c.tasks.map(t =>
        t.id === editingTask?.task.id ? { ...t, ...fields, updated_at: new Date().toISOString() } : t
      ),
    }))
    setEditingTask(null)
  }

  const handleAddCol = (label: string, ti: number) => {
    setColumns(prev => [...prev, { id: uid(), label, ...THEMES[ti], tasks: [] }])
    setShowAddCol(false)
  }

  const handleDeleteCol = useCallback((colId: string) => {
    if (!window.confirm('删除此列及所有任务？不可撤销。')) return
    setColumns(prev => prev.filter(c => c.id !== colId))
  }, [])

  const handleRenameCol = useCallback((colId: string, label: string) => {
    setColumns(prev => prev.map(c => c.id === colId ? { ...c, label } : c))
  }, [])

  // ─── Render ────────────────────────────────────────────────────────────────

  const displayCols = search
    ? columns.map(c => ({
        ...c,
        tasks: c.tasks.filter(t =>
          t.name.toLowerCase().includes(search.toLowerCase()) ||
          (t.assignee ?? '').toLowerCase().includes(search.toLowerCase()) ||
          (t.project  ?? '').toLowerCase().includes(search.toLowerCase())
        ),
      }))
    : columns

  const totalTasks = columns.reduce((n, c) => n + c.tasks.length, 0)
  const usedIdx    = columns.map(c => THEMES.findIndex(t => t.headerBg === c.headerBg))

  if (loading) return (
    <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center"
      style={{ fontFamily: "'PingFang SC','SF Pro Text',system-ui,sans-serif" }}>
      <div className="flex items-center gap-3 text-white/40">
        <div className="w-5 h-5 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
        <span className="text-sm">加载看板数据…</span>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex flex-col"
      style={{ fontFamily: "'PingFang SC','SF Pro Text','Noto Sans SC',system-ui,sans-serif" }}>

      {/* Toolbar */}
      <div className="shrink-0 px-6 pt-5 pb-4 border-b border-white/[0.05]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-base">☑️</div>
            <div>
              <h1 className="text-base font-bold text-white leading-tight">任务管理</h1>
              <p className="text-[11px] text-white/25 mt-0.5">{totalTasks} 个任务 · 拖拽排序 · 自动保存</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-white/5 border border-white/8 rounded-xl px-3 py-1.5">
              <Search size={12} className="text-white/25 shrink-0" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                className="bg-transparent text-white/80 outline-none placeholder-white/20 w-28 text-sm"
                placeholder="搜索任务…" />
            </div>
            <button
              onClick={() => setAddingToCol(columns[0]?.id ?? '')}
              disabled={columns.length === 0}
              className="flex items-center gap-1.5 bg-white text-black rounded-xl px-3.5 py-1.5 text-sm font-semibold hover:bg-white/90 disabled:opacity-40 transition-colors"
            >
              <Plus size={13} /> 新建任务
            </button>
          </div>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-auto px-6 py-5">
        <div className="flex gap-4 min-w-max items-start pb-8">
          {displayCols.map(col => (
            <KanbanCol
              key={col.id}
              col={col}
              allCols={displayCols}
              draggingId={draggingId}
              hoverColId={hoverColId}
              insertLine={insertLine}
              onAddTask={colId => setAddingToCol(colId)}
              onEditTask={(task, colId) => setEditingTask({ task, colId })}
              onDelete={handleDelete}
              onMenuMove={handleMenuMove}
              onDeleteCol={handleDeleteCol}
              onRenameCol={handleRenameCol}
              registerHandle={registerHandle}
              registerCard={registerCard}
            />
          ))}

          <button onClick={() => setShowAddCol(true)}
            className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-white/8 text-white/20 hover:text-white/50 hover:border-white/20 transition-all text-sm w-[180px] group/nc">
            <Plus size={13} className="group-hover/nc:rotate-90 transition-transform duration-150 shrink-0" />
            添加列
          </button>
        </div>
      </div>

      {/* Modals */}
      {addingToCol && (
        <TaskModal defaultColId={addingToCol} allCols={columns}
          onConfirm={handleAddTask} onClose={() => setAddingToCol(null)} />
      )}
      {editingTask && (
        <TaskModal init={editingTask.task} defaultColId={editingTask.colId} allCols={columns}
          onConfirm={handleEditTask} onClose={() => setEditingTask(null)} />
      )}
      {showAddCol && (
        <AddColModal usedIdx={usedIdx} onConfirm={handleAddCol} onClose={() => setShowAddCol(false)} />
      )}
    </div>
  )
}
