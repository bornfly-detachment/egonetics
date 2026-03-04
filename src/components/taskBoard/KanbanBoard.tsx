/**
 * KanbanBoard.tsx  — 极简看板
 *
 * 设计原则：
 *  - 拖拽：只做同列垂直排序（Pointer Events），跨列改状态在详情页
 *  - 卡片：点击 → /tasks/:id，hover → 右上角删除按钮，无弹窗/内联编辑
 *  - 持久化：drag 落定 → PATCH /api/kanban/tasks/:id { sortOrder }，失败回滚
 *  - 列管理：新增/重命名/删除，PUT /api/kanban/columns
 */

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, GripVertical, Search, Palette, Calendar, MoreHorizontal } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Priority = 'urgent' | 'high' | 'medium' | 'low'

interface Task {
  id: string
  name: string
  icon: string
  assignee?: string
  startDate?: string
  dueDate?: string
  project?: string
  projectIcon?: string
  status: string
  priority: Priority
  sortOrder: number
  created_at: string
  updated_at: string
  tags?: string[]
  columnId?: string
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

const API = '/api'

async function fetchKanban(): Promise<Column[] | null> {
  try {
    const res = await fetch(`${API}/kanban`)
    if (!res.ok) return null
    const data = await res.json()
    return data.columns.map((col: Column) => ({
      ...col,
      tasks: (data.tasks ?? []).filter((t: Task) => (t.columnId ?? t.status) === col.id),
    }))
  } catch {
    return null
  }
}

async function patchTask(id: string, fields: Partial<Task>): Promise<boolean> {
  try {
    const res = await fetch(`${API}/kanban/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    })
    return res.ok
  } catch {
    return false
  }
}

async function deleteTask(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${API}/kanban/tasks/${id}`, { method: 'DELETE' })
    return res.ok
  } catch {
    return false
  }
}

async function createTask(task: Partial<Task>): Promise<Task | null> {
  try {
    const res = await fetch(`${API}/kanban/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

async function saveColumns(columns: Column[]): Promise<void> {
  const colsData = columns.map(({ tasks: _t, ...c }) => c)
  await fetch(`${API}/kanban/columns`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(colsData),
  })
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
  '📝',
  '🧠',
  '💡',
  '🚀',
  '⚡',
  '🎯',
  '📚',
  '🔧',
  '🎨',
  '💻',
  '🌟',
  '✨',
  '🔥',
  '💪',
  '🎮',
  '🎵',
  '📋',
  '💼',
  '🏠',
  '❤️',
  '🌈',
  '🦄',
  '🌙',
  '⚙️',
  '🔬',
  '🎭',
  '📊',
  '🗂️',
  '📈',
  '🔍',
]

const PRI: Record<Priority, { label: string; cls: string; dot: string }> = {
  urgent: { label: '紧急', cls: 'text-red-400 bg-red-500/10 border-red-500/25', dot: '#ef4444' },
  high: {
    label: '高',
    cls: 'text-orange-400 bg-orange-500/10 border-orange-500/25',
    dot: '#f97316',
  },
  medium: {
    label: '中',
    cls: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/25',
    dot: '#eab308',
  },
  low: {
    label: '低',
    cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
    dot: '#10b981',
  },
}

const uid = () => `id-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
const todayISO = () => new Date().toISOString().slice(0, 10)
const fmtDate = (s?: string) => {
  if (!s) return ''
  try {
    return new Date(s).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  } catch {
    return s
  }
}
const sortDesc = (arr: Task[]) => [...arr].sort((a, b) => b.sortOrder - a.sortOrder)

function calcInsertSortOrder(sorted: Task[], insertBefore: number, excludeId?: string): number {
  const list = excludeId ? sorted.filter((t) => t.id !== excludeId) : sorted
  if (!list.length) return 1000
  if (insertBefore <= 0) return list[0].sortOrder + 100
  if (insertBefore >= list.length) return Math.max(0.01, list[list.length - 1].sortOrder - 1)
  return (list[insertBefore - 1].sortOrder + list[insertBefore].sortOrder) / 2
}

// ─── InsertLine ───────────────────────────────────────────────────────────────

const InsertLine = () => (
  <div className="relative h-0 my-1 pointer-events-none z-10" aria-hidden>
    <div
      className="absolute inset-x-0 h-[2px] rounded-full bg-blue-400"
      style={{ boxShadow: '0 0 8px 2px rgba(96,165,250,0.8)' }}
    />
    <div
      className="absolute left-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-blue-400"
      style={{ boxShadow: '0 0 6px 2px rgba(96,165,250,0.8)' }}
    />
  </div>
)

// ─── TaskCard ─────────────────────────────────────────────────────────────────

interface CardProps {
  task: Task
  col: Column
  dragging: boolean
  lineAbove: boolean
  lineBelow: boolean
  onCardClick: (taskId: string) => void
  onDelete: (taskId: string) => void
  setHandleRef: (el: HTMLElement | null) => void
  setCardRef: (el: HTMLDivElement | null) => void
}

const TaskCard = React.memo(function TaskCard({
  task,
  col,
  dragging,
  lineAbove,
  lineBelow,
  onCardClick,
  onDelete,
  setHandleRef,
  setCardRef,
}: CardProps) {
  const p = PRI[task.priority]

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
        onClick={() => onCardClick(task.id)}
      >
        {/* accent bar */}
        <div
          className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full"
          style={{ backgroundColor: col.accent }}
        />

        <div className="px-4 py-3 pl-5">
          <div className="flex items-start gap-2 mb-1.5">
            {/* drag handle */}
            <div
              ref={setHandleRef}
              data-handle-task={task.id}
              className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing mt-0.5 shrink-0 touch-none"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical size={12} className="text-white/30 hover:text-white/60" />
            </div>

            <span className="text-[16px] shrink-0 mt-0.5">{task.icon}</span>
            <span className="flex-1 min-w-0 text-[13px] font-semibold text-white/90 leading-snug break-words">
              {task.name}
            </span>

            {/* delete button on hover */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete(task.id)
              }}
              className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-all shrink-0"
              title="删除任务"
            >
              <Trash2 size={11} />
            </button>
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
            {task.startDate && (
              <span className="flex items-center gap-0.5">
                <Calendar size={9} className="shrink-0" /> {fmtDate(task.startDate)}
              </span>
            )}
            {task.dueDate && (
              <span className="flex items-center gap-0.5 text-white/20">
                <Calendar size={9} className="shrink-0" /> 截止 {fmtDate(task.dueDate)}
              </span>
            )}
          </div>

          {/* footer */}
          <div className="flex items-center justify-between mt-2 ml-6">
            <span
              className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium ${p.cls}`}
            >
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
              {task.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/25 border border-white/8"
                >
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
  draggingId: string | null
  insertLine: { colId: string; idx: number } | null
  onAddTask: (colId: string) => void
  onCardClick: (taskId: string) => void
  onDelete: (taskId: string) => void
  onDeleteCol: (colId: string) => void
  onRenameCol: (colId: string, label: string) => void
  registerHandle: (taskId: string, el: HTMLElement | null) => void
  registerCard: (taskId: string, el: HTMLDivElement | null) => void
}

function KanbanCol({
  col,
  draggingId,
  insertLine,
  onAddTask,
  onCardClick,
  onDelete,
  onDeleteCol,
  onRenameCol,
  registerHandle,
  registerCard,
}: ColProps) {
  const sorted = sortDesc(col.tasks)
  const [showMenu, setShowMenu] = useState(false)
  const [editTitle, setEditTitle] = useState(false)
  const [draft, setDraft] = useState(col.label)
  const menuRef = useRef<HTMLDivElement>(null)
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
    if (editTitle)
      setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 0)
  }, [editTitle])

  const commitTitle = () => {
    if (draft.trim() && draft !== col.label) onRenameCol(col.id, draft.trim())
    else setDraft(col.label)
    setEditTitle(false)
  }

  const sortedVisible = sorted.filter((t) => t.id !== draggingId)
  const lineIdx = insertLine?.colId === col.id ? insertLine.idx : null

  return (
    <div className="flex flex-col shrink-0 w-[272px]" data-col-id={col.id}>
      {/* header */}
      <div className={`${col.headerBg} rounded-xl px-3.5 py-2.5 mb-3 flex items-center gap-2`}>
        <span className="w-2.5 h-2.5 rounded-full bg-white/30 shrink-0" />

        {editTitle ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitTitle()
              if (e.key === 'Escape') {
                setDraft(col.label)
                setEditTitle(false)
              }
            }}
            className="flex-1 bg-transparent text-white text-sm font-semibold outline-none border-b border-white/40 min-w-0"
          />
        ) : (
          <span
            className="flex-1 text-white text-sm font-semibold truncate cursor-default"
            onDoubleClick={() => setEditTitle(true)}
          >
            {col.label}
          </span>
        )}

        <span className="bg-white/20 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 tabular-nums">
          {col.tasks.length}
        </span>

        <div ref={menuRef} className="relative shrink-0">
          <button
            onClick={() => setShowMenu((v) => !v)}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/20 text-white/60 hover:text-white transition-colors"
          >
            <MoreHorizontal size={13} />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-8 z-50 w-36 bg-[#1a1a1c] border border-white/10 rounded-xl shadow-2xl py-1 text-[13px]">
              <button
                onClick={() => {
                  setEditTitle(true)
                  setShowMenu(false)
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-white/60 hover:text-white hover:bg-white/8"
              >
                <Palette size={11} /> 重命名
              </button>
              <button
                onClick={() => {
                  onAddTask(col.id)
                  setShowMenu(false)
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-white/60 hover:text-white hover:bg-white/8"
              >
                <Plus size={11} /> 添加任务
              </button>
              <div className="border-t border-white/5 my-1" />
              <button
                onClick={() => {
                  onDeleteCol(col.id)
                  setShowMenu(false)
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-red-400/70 hover:text-red-400 hover:bg-red-500/8"
              >
                <Trash2 size={11} /> 删除列
              </button>
            </div>
          )}
        </div>
      </div>

      {/* task list */}
      <div
        data-col-drop={col.id}
        className="flex-1 flex flex-col gap-2 min-h-[80px] rounded-xl px-0.5 pb-2"
      >
        {sorted.map((task) => {
          const visIdx = sortedVisible.findIndex((t) => t.id === task.id)
          const showAbove = lineIdx !== null && visIdx !== -1 && visIdx === lineIdx
          const showBelow =
            lineIdx !== null &&
            visIdx !== -1 &&
            visIdx === sortedVisible.length - 1 &&
            lineIdx >= sortedVisible.length

          return (
            <TaskCard
              key={task.id}
              task={task}
              col={col}
              dragging={draggingId === task.id}
              lineAbove={showAbove}
              lineBelow={showBelow}
              onCardClick={onCardClick}
              onDelete={onDelete}
              setHandleRef={(el) => registerHandle(task.id, el)}
              setCardRef={(el) => registerCard(task.id, el)}
            />
          )
        })}

        {lineIdx !== null && lineIdx >= sortedVisible.length && sortedVisible.length > 0 && (
          <InsertLine />
        )}

        {col.tasks.length === 0 && (
          <div className="flex-1 min-h-[80px] rounded-lg border-2 border-dashed border-white/5 flex items-center justify-center text-xs text-white/15">
            暂无任务
          </div>
        )}

        <button
          onClick={() => onAddTask(col.id)}
          className="flex items-center gap-1.5 px-2 py-2 rounded-lg text-white/20 hover:text-white/55 hover:bg-white/5 transition-all text-xs group/add mt-0.5"
        >
          <Plus size={12} className="group-hover/add:rotate-90 transition-transform duration-150" />
          添加任务
        </button>
      </div>
    </div>
  )
}

// ─── New Task Modal ────────────────────────────────────────────────────────────

interface NewTaskModalProps {
  defaultColId: string
  allCols: Column[]
  onConfirm: (fields: Partial<Task>, colId: string) => void
  onClose: () => void
}

function NewTaskModal({ defaultColId, allCols, onConfirm, onClose }: NewTaskModalProps) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('📝')
  const [priority, setPriority] = useState<Priority>('medium')
  const [colId, setColId] = useState(defaultColId)
  const [showEmoji, setShowEmoji] = useState(false)

  const submit = () => {
    if (!name.trim()) return
    onConfirm({ name: name.trim(), icon, priority }, colId)
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[200]"
      onClick={onClose}
    >
      <div
        className="bg-[#18181b] border border-white/10 rounded-2xl p-6 w-[360px] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-white mb-4">新建任务</h3>

        <div className="flex items-center gap-3 mb-4">
          <div className="relative">
            <button
              onClick={() => setShowEmoji((v) => !v)}
              className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-xl flex items-center justify-center hover:bg-white/10"
            >
              {icon}
            </button>
            {showEmoji && (
              <div className="absolute top-12 left-0 z-20 bg-[#222] border border-white/10 rounded-xl p-2 shadow-2xl">
                <div className="grid grid-cols-6 gap-0.5 max-h-40 overflow-y-auto">
                  {EMOJIS.map((e) => (
                    <button
                      key={e}
                      onClick={() => {
                        setIcon(e)
                        setShowEmoji(false)
                      }}
                      className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 text-lg"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
            }}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-white/25 placeholder-white/20"
            placeholder="任务名称"
          />
        </div>

        <div className="mb-4">
          <label className="text-[11px] text-white/40 mb-1.5 block">所在列</label>
          <select
            value={colId}
            onChange={(e) => setColId(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-white/25 [color-scheme:dark]"
          >
            {allCols.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-5">
          <label className="text-[11px] text-white/40 mb-1.5 block">优先级</label>
          <div className="flex gap-1.5">
            {(Object.keys(PRI) as Priority[]).map((p) => (
              <button
                key={p}
                onClick={() => setPriority(p)}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium border transition-all
                  ${priority === p ? PRI[p].cls : 'bg-white/5 border-white/5 text-white/30 hover:text-white/60'}`}
              >
                {PRI[p].label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm text-white/40 hover:text-white/70"
          >
            取消
          </button>
          <button
            onClick={submit}
            disabled={!name.trim()}
            className="px-4 py-1.5 text-sm bg-white text-black rounded-xl font-medium hover:bg-white/90 disabled:opacity-25"
          >
            创建
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── AddColModal ──────────────────────────────────────────────────────────────

function AddColModal({
  usedIdx,
  onConfirm,
  onClose,
}: {
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
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[200]"
      onClick={onClose}
    >
      <div
        className="bg-[#18181b] border border-white/10 rounded-2xl p-6 w-72 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-white mb-4">新建列</h3>
        <div className="mb-4">
          <label className="text-[11px] text-white/40 mb-1.5 block">列名称</label>
          <input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && label.trim()) onConfirm(label, ti)
            }}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-white/25 placeholder-white/20"
            placeholder="例如：进行中"
          />
        </div>
        <div className="mb-5">
          <label className="text-[11px] text-white/40 mb-2 block">颜色</label>
          <div className="flex gap-2 flex-wrap">
            {THEMES.map((t, i) => (
              <button
                key={i}
                onClick={() => setTi(i)}
                className={`w-7 h-7 rounded-lg transition-all ${t.headerBg} ${ti === i ? 'ring-2 ring-white/60 scale-110' : 'opacity-40 hover:opacity-80'}`}
              />
            ))}
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm text-white/40 hover:text-white/70"
          >
            取消
          </button>
          <button
            onClick={() => {
              if (label.trim()) onConfirm(label, ti)
            }}
            disabled={!label.trim()}
            className="px-4 py-1.5 text-sm bg-white text-black rounded-xl font-medium hover:bg-white/90 disabled:opacity-25"
          >
            创建
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── KanbanBoard (root) ───────────────────────────────────────────────────────

export default function KanbanBoard() {
  const navigate = useNavigate()
  const [columns, setColumns] = useState<Column[]>([])
  const [loading, setLoading] = useState(true)
  const [addingToCol, setAddingToCol] = useState<string | null>(null)
  const [showAddCol, setShowAddCol] = useState(false)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  // drag visual state
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [insertLine, setInsertLine] = useState<{ colId: string; idx: number } | null>(null)

  // DOM ref maps: taskId → element
  const handleMap = useRef(new Map<string, HTMLElement>())
  const cardMap = useRef(new Map<string, HTMLDivElement>())
  const registerHandle = useCallback((id: string, el: HTMLElement | null) => {
    if (el) handleMap.current.set(id, el)
    else handleMap.current.delete(id)
  }, [])
  const registerCard = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) cardMap.current.set(id, el)
    else cardMap.current.delete(id)
  }, [])

  // colsRef: always current (avoids stale closure in drag handler)
  const colsRef = useRef<Column[]>([])
  useEffect(() => {
    colsRef.current = columns
  }, [columns])

  // Load
  useEffect(() => {
    fetchKanban().then((data) => {
      if (data) setColumns(data)
      setLoading(false)
    })
  }, [])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  // ─── Pointer-Events Drag (same-column only) ────────────────────────────────
  useEffect(() => {
    let active = false
    let dragTaskId = ''
    let startX = 0
    let startY = 0
    let ghost: HTMLDivElement | null = null
    let ghostOffX = 0
    let ghostOffY = 0
    let fromColId = ''

    const getColEl = (x: number, y: number): HTMLElement | null => {
      for (const el of document.querySelectorAll('[data-col-drop]')) {
        const r = el.getBoundingClientRect()
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return el as HTMLElement
      }
      return null
    }

    const getInsertIdx = (colEl: HTMLElement, curY: number, excludeId: string): number => {
      const cards = Array.from(colEl.querySelectorAll('[data-task-id]')).filter(
        (c) => (c as HTMLElement).dataset.taskId !== excludeId
      ) as HTMLElement[]

      for (let i = 0; i < cards.length; i++) {
        const r = cards[i].getBoundingClientRect()
        if (curY < r.top + r.height / 2) return i
      }
      return cards.length
    }

    const onDown = (e: PointerEvent) => {
      const handle = (e.target as HTMLElement).closest('[data-handle-task]') as HTMLElement | null
      if (!handle) return
      const taskId = handle.dataset.handleTask
      if (!taskId) return
      // find which column this task belongs to
      const cols = colsRef.current
      const col = cols.find((c) => c.tasks.some((t) => t.id === taskId))
      if (!col) return

      dragTaskId = taskId
      fromColId = col.id
      startX = e.clientX
      startY = e.clientY
      active = false
      handle.setPointerCapture(e.pointerId)
      e.preventDefault()
    }

    const onMove = (e: PointerEvent) => {
      if (!dragTaskId) return

      if (!active && Math.hypot(e.clientX - startX, e.clientY - startY) > 5) {
        active = true
        setDraggingId(dragTaskId)

        const cardEl = cardMap.current.get(dragTaskId)
        if (cardEl) {
          const rect = cardEl.getBoundingClientRect()
          ghostOffX = e.clientX - rect.left
          ghostOffY = e.clientY - rect.top
          ghost = cardEl.cloneNode(true) as HTMLDivElement
          Object.assign(ghost.style, {
            position: 'fixed',
            width: `${rect.width}px`,
            left: `${e.clientX - ghostOffX}px`,
            top: `${e.clientY - ghostOffY}px`,
            opacity: '0.88',
            pointerEvents: 'none',
            zIndex: '9999',
            transform: 'rotate(1.5deg) scale(1.03)',
            boxShadow: '0 24px 48px rgba(0,0,0,0.65)',
            borderRadius: '12px',
          })
          document.body.appendChild(ghost)
        }
      }

      if (!active || !ghost) return

      ghost.style.left = `${e.clientX - ghostOffX}px`
      ghost.style.top = `${e.clientY - ghostOffY}px`

      // Only show insert line if hovering over the SAME column
      const colEl = getColEl(e.clientX, e.clientY)
      const colId = colEl?.dataset.colDrop ?? null
      if (colEl && colId && colId === fromColId) {
        setInsertLine({ colId, idx: getInsertIdx(colEl, e.clientY, dragTaskId) })
      } else {
        setInsertLine(null)
      }
    }

    const onUp = async (e: PointerEvent) => {
      if (!dragTaskId) return

      const wasActive = active
      const taskId = dragTaskId
      const savedFromColId = fromColId // capture before reset
      const colEl = getColEl(e.clientX, e.clientY)
      const toColId = colEl?.dataset.colDrop ?? null
      const insertIdx =
        colEl && toColId && toColId === savedFromColId
          ? getInsertIdx(colEl, e.clientY, taskId)
          : null

      dragTaskId = ''
      fromColId = ''
      active = false
      if (ghost) {
        document.body.removeChild(ghost)
        ghost = null
      }
      setDraggingId(null)
      setInsertLine(null)

      // Only update if dragged within same column
      if (!wasActive || !toColId || insertIdx === null) return

      const cols = colsRef.current
      const col = cols.find((c) => c.id === savedFromColId)
      if (!col) return

      const sorted = sortDesc(col.tasks)
      const newOrder = calcInsertSortOrder(sorted, insertIdx, taskId)

      // Optimistic update
      const prevCols = colsRef.current
      setColumns((prev) =>
        prev.map((c) =>
          c.id !== savedFromColId
            ? c
            : {
                ...c,
                tasks: c.tasks.map((t) => (t.id === taskId ? { ...t, sortOrder: newOrder } : t)),
              }
        )
      )

      // Persist
      const ok = await patchTask(taskId, { sortOrder: newOrder })
      if (!ok) {
        setColumns(prevCols)
        showToast('排序保存失败，已回滚')
      }
    }

    document.addEventListener('pointerdown', onDown, { passive: false })
    document.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerup', onUp)
    document.addEventListener('pointercancel', onUp)

    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      document.removeEventListener('pointercancel', onUp)
      if (ghost) document.body.removeChild(ghost)
    }
  }, []) // empty deps, uses colsRef

  // ─── Board mutations ────────────────────────────────────────────────────────

  const handleCardClick = useCallback(
    (taskId: string) => {
      navigate(`/tasks/${taskId}`)
    },
    [navigate]
  )

  const handleDelete = useCallback(async (taskId: string) => {
    if (!window.confirm('确定删除此任务？')) return
    setColumns((prev) => prev.map((c) => ({ ...c, tasks: c.tasks.filter((t) => t.id !== taskId) })))
    const ok = await deleteTask(taskId)
    if (!ok) {
      // Reload to restore
      fetchKanban().then((data) => {
        if (data) setColumns(data)
      })
      showToast('删除失败')
    }
  }, [])

  const handleAddTask = async (fields: Partial<Task>, colId: string) => {
    const col = colsRef.current.find((c) => c.id === colId)
    const sorted = sortDesc(col?.tasks ?? [])
    const newOrder = sorted.length ? sorted[sorted.length - 1].sortOrder - 100 : 1000
    const payload = {
      ...fields,
      columnId: colId,
      status: colId,
      sortOrder: newOrder,
      startDate: todayISO(),
    }

    setAddingToCol(null)
    const created = await createTask(payload)
    if (created) {
      setColumns((prev) =>
        prev.map((c) => (c.id === colId ? { ...c, tasks: [...c.tasks, created] } : c))
      )
    } else {
      showToast('创建任务失败')
    }
  }

  const handleAddCol = async (label: string, ti: number) => {
    const newCol: Column = { id: uid(), label, ...THEMES[ti], tasks: [] }
    const next = [...columns, newCol]
    setColumns(next)
    setShowAddCol(false)
    await saveColumns(next)
  }

  const handleDeleteCol = useCallback(
    async (colId: string) => {
      if (!window.confirm('删除此列及所有任务？不可撤销。')) return
      const next = columns.filter((c) => c.id !== colId)
      setColumns(next)
      await saveColumns(next)
    },
    [columns]
  )

  const handleRenameCol = useCallback(
    async (colId: string, label: string) => {
      const next = columns.map((c) => (c.id === colId ? { ...c, label } : c))
      setColumns(next)
      await saveColumns(next)
    },
    [columns]
  )

  // ─── Render ────────────────────────────────────────────────────────────────

  const displayCols = search
    ? columns.map((c) => ({
        ...c,
        tasks: c.tasks.filter(
          (t) =>
            t.name.toLowerCase().includes(search.toLowerCase()) ||
            (t.assignee ?? '').toLowerCase().includes(search.toLowerCase())
        ),
      }))
    : columns

  const totalTasks = columns.reduce((n, c) => n + c.tasks.length, 0)
  const usedIdx = columns.map((c) => THEMES.findIndex((t) => t.headerBg === c.headerBg))

  if (loading)
    return (
      <div
        className="min-h-screen bg-[#0d0d0d] flex items-center justify-center"
        style={{ fontFamily: "'PingFang SC','SF Pro Text',system-ui,sans-serif" }}
      >
        <div className="flex items-center gap-3 text-white/40">
          <div className="w-5 h-5 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
          <span className="text-sm">加载看板…</span>
        </div>
      </div>
    )

  return (
    <div
      className="min-h-screen bg-[#0d0d0d] flex flex-col"
      style={{ fontFamily: "'PingFang SC','SF Pro Text','Noto Sans SC',system-ui,sans-serif" }}
    >
      {/* Toolbar */}
      <div className="shrink-0 px-6 pt-5 pb-4 border-b border-white/[0.05]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-base">
              ☑️
            </div>
            <div>
              <h1 className="text-base font-bold text-white leading-tight">任务看板</h1>
              <p className="text-[11px] text-white/25 mt-0.5">
                {totalTasks} 个任务 · 拖拽排序 · 点击查看详情
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-white/5 border border-white/8 rounded-xl px-3 py-1.5">
              <Search size={12} className="text-white/25 shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent text-white/80 outline-none placeholder-white/20 w-28 text-sm"
                placeholder="搜索任务…"
              />
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
          {displayCols.map((col) => (
            <KanbanCol
              key={col.id}
              col={col}
              draggingId={draggingId}
              insertLine={insertLine}
              onAddTask={(colId) => setAddingToCol(colId)}
              onCardClick={handleCardClick}
              onDelete={handleDelete}
              onDeleteCol={handleDeleteCol}
              onRenameCol={handleRenameCol}
              registerHandle={registerHandle}
              registerCard={registerCard}
            />
          ))}

          <button
            onClick={() => setShowAddCol(true)}
            className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-white/8 text-white/20 hover:text-white/50 hover:border-white/20 transition-all text-sm w-[180px] group/nc"
          >
            <Plus
              size={13}
              className="group-hover/nc:rotate-90 transition-transform duration-150 shrink-0"
            />
            添加列
          </button>
        </div>
      </div>

      {/* Modals */}
      {addingToCol && (
        <NewTaskModal
          defaultColId={addingToCol}
          allCols={columns}
          onConfirm={handleAddTask}
          onClose={() => setAddingToCol(null)}
        />
      )}
      {showAddCol && (
        <AddColModal
          usedIdx={usedIdx}
          onConfirm={handleAddCol}
          onClose={() => setShowAddCol(false)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] bg-red-900/90 text-red-200 text-sm px-4 py-2 rounded-xl border border-red-700/50 shadow-xl">
          {toast}
        </div>
      )}
    </div>
  )
}
