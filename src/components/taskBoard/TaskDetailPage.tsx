/**
 * TaskDetailPage.tsx
 *
 * 任务详情页 — 头部属性栏（状态/优先级/负责人/日期）内联编辑
 * + 发布到 Chronicle 按钮
 * + 正文编辑器（复用 BlockEditor）
 * 路由: /tasks/:taskId
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Trash2,
  Calendar,
  User,
  AlertCircle,
  Loader,
  Tag,
  BookMarked,
} from 'lucide-react'
import PageManager from '../PageManager'
import { createApiClient } from '../apiClient'
import { getToken, removeToken } from '@/lib/http'

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
  description?: string
  chronicle_entry_id?: string | null
}

interface Column {
  id: string
  label: string
}

// ─── API Helpers ──────────────────────────────────────────────────────────────
function authHeaders(): Record<string, string> {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function handle401(res: Response) {
  if (res.status === 401) {
    removeToken()
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }
}

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

async function loadTask(id: string): Promise<Task | null> {
  try {
    const res = await fetch(`/api/kanban/tasks/${id}`, { headers: authHeaders() })
    handle401(res)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

async function loadColumns(): Promise<Column[]> {
  try {
    const res = await fetch('/api/kanban', { headers: authHeaders() })
    handle401(res)
    if (!res.ok) return []
    const data = await res.json()
    return data.columns ?? []
  } catch {
    return []
  }
}

async function patchTask(id: string, fields: Partial<Task>): Promise<boolean> {
  try {
    const res = await fetch(`/api/kanban/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(fields),
    })
    handle401(res)
    return res.ok
  } catch {
    return false
  }
}

// ─── Publish to Chronicle Modal ───────────────────────────────────────────────

const OUTCOMES = [
  { value: '完成', label: '✅ 完成' },
  { value: '失败', label: '❌ 失败' },
  { value: '终止', label: '⛔ 终止' },
]

function PublishModal({
  task,
  onDone,
  onClose,
}: {
  task: Task
  onDone: () => void
  onClose: () => void
}) {
  const [outcome, setOutcome] = useState('完成')
  const [summary, setSummary] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const doPublish = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/tasks/${task.id}/send-to-chronicle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ task_outcome: outcome, task_summary: summary.trim() || null }),
      })
      handle401(res)
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: '请求失败' }))
        throw new Error(d.error || '请求失败')
      }
      onDone()
    } catch (e: unknown) {
      setError((e as Error).message)
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-[#1e1e1e] border border-white/15 rounded-xl shadow-2xl p-6 w-[480px]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold mb-1 flex items-center gap-2">
          <BookMarked size={16} className="text-blue-400" /> 发布任务到 Chronicle
        </h3>
        <p className="text-xs text-neutral-500 mb-4">发布后此任务将从看板移除</p>

        <div className="mb-3">
          <label className="text-[11px] text-neutral-500 mb-2 block">结果 *</label>
          <div className="flex gap-2">
            {OUTCOMES.map((o) => (
              <button
                key={o.value}
                onClick={() => setOutcome(o.value)}
                className={`flex-1 py-2 rounded-lg text-sm border transition-all ${
                  outcome === o.value
                    ? 'bg-blue-600/20 border-blue-500/60 text-white'
                    : 'bg-white/5 border-white/10 text-white/50 hover:border-white/20'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="text-[11px] text-neutral-500 mb-1 block">总结（可选）</label>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            autoFocus
            className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500 resize-none"
            placeholder="对此任务的简要总结…"
          />
        </div>

        {error && <p className="mb-3 text-sm text-red-400">❌ {error}</p>}

        <div className="flex gap-2">
          <button
            onClick={doPublish}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded font-medium text-sm"
          >
            {loading ? '发布中…' : '确认发布'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded text-sm"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── TaskDetailPage ───────────────────────────────────────────────────────────

export default function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()

  // 创建任务专属的 API 客户端 - 只显示和当前任务关联的页面
  const taskApiClient = useMemo(() => {
    if (!taskId) return null
    return createApiClient('task', taskId)
  }, [taskId])

  const [task, setTask] = useState<Task | null>(null)
  const [columns, setColumns] = useState<Column[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showPublish, setShowPublish] = useState(false)

  // Load task + columns in parallel
  useEffect(() => {
    if (!taskId) {
      setError('未找到任务 ID')
      setLoading(false)
      return
    }
    Promise.all([loadTask(taskId), loadColumns()]).then(([t, cols]) => {
      if (!t) setError('任务不存在或已删除')
      else setTask(t)
      setColumns(cols)
      setLoading(false)
    })
  }, [taskId])

  const save = useCallback(
    async (fields: Partial<Task>) => {
      if (!task) return
      setSaving(true)
      const ok = await patchTask(task.id, fields)
      if (ok) setTask((prev) => (prev ? { ...prev, ...fields } : prev))
      setSaving(false)
    },
    [task]
  )

  const handleDelete = async () => {
    if (!task || !window.confirm(`确定要删除「${task.name}」？`)) return
    const res = await fetch(`/api/kanban/tasks/${task.id}`, { method: 'DELETE', headers: authHeaders() })
    handle401(res)
    if (res.ok) navigate('/tasks')
    else alert('删除失败')
  }

  if (loading)
    return (
      <div
        className="min-h-screen bg-[#0d0d0d] flex items-center justify-center"
        style={{ fontFamily: "'PingFang SC','SF Pro Text',system-ui,sans-serif" }}
      >
        <div className="flex items-center gap-3 text-white/40">
          <Loader size={20} className="animate-spin" />
          <span className="text-sm">加载任务…</span>
        </div>
      </div>
    )

  if (error || !task)
    return (
      <div
        className="min-h-screen bg-[#0d0d0d] flex items-center justify-center"
        style={{ fontFamily: "'PingFang SC','SF Pro Text',system-ui,sans-serif" }}
      >
        <div className="text-center">
          <AlertCircle size={32} className="mx-auto mb-3 text-red-400" />
          <p className="text-white/60 mb-6">{error}</p>
          <button
            onClick={() => navigate('/tasks')}
            className="px-4 py-2 bg-white text-black rounded-xl font-medium hover:bg-white/90"
          >
            返回看板
          </button>
        </div>
      </div>
    )

  const priorityStyle = PRI[task.priority]
  const isArchived = !!task.chronicle_entry_id

  return (
    <div
      className="h-screen bg-[#191919] flex flex-col"
      style={{ fontFamily: "'PingFang SC','SF Pro Text',system-ui,sans-serif" }}
    >
      {/* 顶部导航栏 */}
      <div className="shrink-0 h-14 bg-[#1a1a1a] border-b border-white/5 flex items-center px-4 justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/tasks')}
            className="flex items-center gap-1.5 text-white/60 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
          <span className="text-xl">{task?.icon || '📝'}</span>
          <span className="text-white font-medium">{task?.name || '任务详情'}</span>
        </div>
        <div className="flex items-center gap-2">
          {saving && <Loader size={14} className="animate-spin text-white/30" />}
          {isArchived ? (
            <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-neutral-500 border border-white/10 rounded-lg">
              <BookMarked size={12} /> 已归档
            </span>
          ) : (
            <button
              onClick={() => setShowPublish(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg border border-blue-500/30 hover:border-blue-500/50 transition-colors"
            >
              <BookMarked size={14} />
              <span>发布到 Chronicle</span>
            </button>
          )}
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* 属性栏 */}
      <div className="shrink-0 border-b border-white/5 bg-[#141414] px-4 py-2 flex items-center gap-4 overflow-x-auto">
        {/* 状态 */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-neutral-600">状态</span>
          <select
            value={task.columnId ?? task.status}
            onChange={(e) => save({ columnId: e.target.value, status: e.target.value })}
            className="text-[11px] bg-neutral-800 border border-white/10 rounded px-1.5 py-0.5 text-neutral-300 outline-none cursor-pointer hover:border-white/20 transition-colors"
          >
            {columns.length > 0
              ? columns.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)
              : <>
                  <option value="planned">计划中</option>
                  <option value="in-progress">进行中</option>
                  <option value="review">审核中</option>
                  <option value="done">已完成</option>
                </>
            }
          </select>
        </div>

        <div className="w-px h-4 bg-white/8 shrink-0" />

        {/* 优先级 */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-neutral-600">优先级</span>
          <select
            value={task.priority}
            onChange={(e) => save({ priority: e.target.value as Priority })}
            className={`text-[11px] bg-neutral-800 border border-white/10 rounded px-1.5 py-0.5 outline-none cursor-pointer hover:border-white/20 transition-colors ${priorityStyle.cls.split(' ')[0]}`}
          >
            {Object.entries(PRI).map(([val, opt]) => (
              <option key={val} value={val}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="w-px h-4 bg-white/8 shrink-0" />

        {/* 负责人 */}
        <div className="flex items-center gap-1.5 shrink-0">
          <User size={10} className="text-neutral-600 shrink-0" />
          <input
            value={task.assignee ?? ''}
            onChange={(e) => setTask((prev) => prev ? { ...prev, assignee: e.target.value } : prev)}
            onBlur={(e) => save({ assignee: e.target.value })}
            placeholder="未分配"
            className="text-[11px] bg-neutral-800 border border-white/10 rounded px-1.5 py-0.5 text-neutral-300 outline-none w-24 hover:border-white/20 focus:border-blue-500/50 transition-colors placeholder-neutral-700"
          />
        </div>

        <div className="w-px h-4 bg-white/8 shrink-0" />

        {/* 开始日期 */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Calendar size={10} className="text-neutral-600 shrink-0" />
          <input
            type="date"
            value={task.startDate ? task.startDate.split('T')[0] : ''}
            onChange={(e) => save({ startDate: e.target.value || undefined })}
            className="text-[11px] bg-neutral-800 border border-white/10 rounded px-1.5 py-0.5 text-neutral-300 outline-none hover:border-white/20 focus:border-blue-500/50 transition-colors"
          />
        </div>

        {/* 截止日期 */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-neutral-600">截止</span>
          <input
            type="date"
            value={task.dueDate ? task.dueDate.split('T')[0] : ''}
            onChange={(e) => save({ dueDate: e.target.value || undefined })}
            className="text-[11px] bg-neutral-800 border border-white/10 rounded px-1.5 py-0.5 text-neutral-300 outline-none hover:border-white/20 focus:border-blue-500/50 transition-colors"
          />
        </div>

        {/* 标签 */}
        {task.tags && task.tags.length > 0 && (
          <>
            <div className="w-px h-4 bg-white/8 shrink-0" />
            <div className="flex items-center gap-1.5 shrink-0">
              <Tag size={10} className="text-neutral-600 shrink-0" />
              <div className="flex gap-1">
                {task.tags.map((tag) => (
                  <span key={tag} className="text-[10px] bg-neutral-700/60 text-neutral-400 px-1.5 py-0.5 rounded border border-white/5">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* PageManager 内容区 */}
      <div className="flex-1 overflow-hidden">
        {taskApiClient && <PageManager api={taskApiClient} />}
      </div>

      {showPublish && (
        <PublishModal
          task={task}
          onDone={() => {
            setShowPublish(false)
            navigate('/tasks')
          }}
          onClose={() => setShowPublish(false)}
        />
      )}
    </div>
  )
}
