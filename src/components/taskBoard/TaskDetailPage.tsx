/**
 * TaskDetailPage.tsx
 *
 * 任务详情页
 * 路由: /tasks/:taskId
 *
 * 功能:
 *   - 显示任务详情
 *   - 右上角编辑按钮弹出编辑弹窗
 *   - 使用 createApiClient('task') 获取数据
 *   - 支持返回看板
 */

import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { createApiClient } from './apiClient'
import {
  ArrowLeft, Edit2, Trash2, Calendar, User, Tag,
  AlertCircle, Loader,
} from 'lucide-react'

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
  status: string
  priority: Priority
  sortOrder: number
  created_at: string
  updated_at: string
  tags?: string[]
  columnId?: string
  description?: string  // 详情页额外字段
}

const PRI: Record<Priority, { label: string; cls: string; dot: string }> = {
  urgent: { label: '紧急', cls: 'text-red-400 bg-red-500/10 border-red-500/25', dot: '#ef4444' },
  high: { label: '高', cls: 'text-orange-400 bg-orange-500/10 border-orange-500/25', dot: '#f97316' },
  medium: { label: '中', cls: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/25', dot: '#eab308' },
  low: { label: '低', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25', dot: '#10b981' },
}

const fmtDate = (s?: string) => {
  if (!s) return ''
  try {
    return new Date(s).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return s
  }
}

// ─── Edit Modal ───────────────────────────────────────────────────────────

interface EditModalProps {
  task: Task
  onConfirm: (updated: Partial<Task>) => Promise<void>
  onClose: () => void
}

function EditModal({ task, onConfirm, onClose }: EditModalProps) {
  const [name, setName] = useState(task.name)
  const [icon, setIcon] = useState(task.icon)
  const [priority, setPriority] = useState<Priority>(task.priority)
  const [assignee, setAssignee] = useState(task.assignee ?? '')
  const [startDate, setStartDate] = useState(task.startDate)
  const [dueDate, setDueDate] = useState(task.dueDate ?? '')
  const [description, setDescription] = useState(task.description ?? '')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!name.trim()) return
    setLoading(true)
    try {
      await onConfirm({
        name: name.trim(),
        icon,
        priority,
        assignee: assignee.trim() || undefined,
        startDate,
        dueDate: dueDate.trim() || undefined,
        description: description.trim() || undefined,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[200]"
      onClick={onClose}
    >
      <div
        className="bg-[#18181b] border border-white/10 rounded-2xl p-6 w-[400px] shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-white mb-5">编辑任务</h3>

        <div className="mb-4">
          <label className="text-[11px] text-white/40 mb-1.5 block">任务名称</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-white/25 placeholder-white/20"
            placeholder="任务名称"
          />
        </div>

        <div className="mb-4">
          <label className="text-[11px] text-white/40 mb-1.5 block">优先级</label>
          <div className="flex gap-1.5">
            {(Object.keys(PRI) as Priority[]).map((p) => (
              <button
                key={p}
                onClick={() => setPriority(p)}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium border transition-all
                  ${
                    priority === p
                      ? PRI[p].cls
                      : 'bg-white/5 border-white/5 text-white/30 hover:text-white/60'
                  }`}
              >
                {PRI[p].label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="text-[11px] text-white/40 mb-1.5 flex items-center gap-1 block">
            <User size={9} /> 负责人
          </label>
          <input
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-white/25 placeholder-white/20"
            placeholder="用户名（可选）"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-[11px] text-white/40 mb-1.5 flex items-center gap-1 block">
              <Calendar size={9} /> 开始日期
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-white/25 [color-scheme:dark]"
            />
          </div>
          <div>
            <label className="text-[11px] text-white/40 mb-1.5 flex items-center gap-1 block">
              <Calendar size={9} /> 截止日期
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-white/25 [color-scheme:dark]"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="text-[11px] text-white/40 mb-1.5 block">描述</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-white/25 placeholder-white/20 resize-none h-20"
            placeholder="添加任务描述..."
          />
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-1.5 text-sm text-white/40 hover:text-white/70 transition-colors disabled:opacity-40"
          >
            取消
          </button>
          <button
            onClick={submit}
            disabled={!name.trim() || loading}
            className="px-4 py-1.5 text-sm bg-white text-black rounded-xl font-medium hover:bg-white/90 disabled:opacity-25 transition-colors flex items-center gap-1"
          >
            {loading ? <Loader size={12} className="animate-spin" /> : null}
            保存
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

  // 创建带类型过滤的 API 客户端
  const apiClient = useMemo(() => createApiClient('task'), [])

  const [task, setTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showEdit, setShowEdit] = useState(false)

  // 加载任务数据
  useEffect(() => {
    if (!taskId) {
      setError('未找到任务 ID')
      setLoading(false)
      return
    }

    const fetchTask = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await apiClient.fetchOne(taskId)
        if (!data) {
          setError('任务不存在或已删除')
          setTask(null)
        } else {
          setTask(data as Task)
        }
      } catch (err) {
        setError('加载任务失败')
        console.error('Fetch error:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchTask()
  }, [taskId, apiClient])

  const handleEdit = async (updated: Partial<Task>) => {
    if (!task) return
    try {
      const result = await apiClient.save({ ...task, ...updated })
      setTask(result as Task)
      setShowEdit(false)
    } catch (err) {
      console.error('Save error:', err)
      alert('保存失败')
    }
  }

  const handleDelete = async () => {
    if (!task || !window.confirm(`确定要删除「${task.name}」？`)) return
    try {
      await apiClient.delete(task.id)
      navigate('/tasks') // 返回看板
    } catch (err) {
      console.error('Delete error:', err)
      alert('删除失败')
    }
  }

  if (loading) {
    return (
      <div
        className="min-h-screen bg-[#0d0d0d] flex items-center justify-center"
        style={{ fontFamily: "'PingFang SC','SF Pro Text',system-ui,sans-serif" }}
      >
        <div className="flex items-center gap-3 text-white/40">
          <Loader size={20} className="animate-spin" />
          <span className="text-sm">加载任务数据…</span>
        </div>
      </div>
    )
  }

  if (error || !task) {
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
            className="px-4 py-2 bg-white text-black rounded-xl font-medium hover:bg-white/90 transition-colors"
          >
            返回看板
          </button>
        </div>
      </div>
    )
  }

  const p = PRI[task.priority]

  return (
    <div
      className="min-h-screen bg-[#0d0d0d] flex flex-col"
      style={{ fontFamily: "'PingFang SC','SF Pro Text',system-ui,sans-serif" }}
    >
      {/* Header */}
      <div className="shrink-0 h-14 bg-[#1a1a1a] border-b border-white/5 flex items-center px-6 justify-between">
        <button
          onClick={() => navigate('/tasks')}
          className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft size={16} />
          <span className="text-sm">返回看板</span>
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEdit(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-black rounded-lg text-sm font-medium hover:bg-white/90 transition-colors"
          >
            <Edit2 size={14} />
            编辑
          </button>
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Title */}
          <div className="flex items-start gap-4 mb-8">
            <span className="text-5xl mt-2">{task.icon}</span>
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-bold text-white break-words mb-3">{task.name}</h1>
              <div className="flex flex-wrap gap-2 items-center">
                <span className={`inline-flex items-center gap-1 text-[12px] px-2.5 py-1 rounded-full border font-medium ${p.cls}`}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.dot }} />
                  {p.label}
                </span>
                {task.status && (
                  <span className="text-[12px] px-2.5 py-1 rounded-full bg-white/5 text-white/40 border border-white/10">
                    {task.status}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Meta Info */}
          <div className="space-y-6 mb-8">
            {task.assignee && (
              <div>
                <label className="text-[11px] text-white/40 mb-2 flex items-center gap-1 block">
                  <User size={11} /> 负责人
                </label>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center text-[10px] font-bold text-white">
                    {task.assignee[0].toUpperCase()}
                  </div>
                  <span className="text-white/80 text-sm">{task.assignee}</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="text-[11px] text-white/40 mb-2 flex items-center gap-1 block">
                  <Calendar size={11} /> 开始日期
                </label>
                <p className="text-white/80 text-sm">{fmtDate(task.startDate)}</p>
              </div>
              {task.dueDate && (
                <div>
                  <label className="text-[11px] text-white/40 mb-2 flex items-center gap-1 block">
                    <Calendar size={11} /> 截止日期
                  </label>
                  <p className="text-white/80 text-sm">{fmtDate(task.dueDate)}</p>
                </div>
              )}
            </div>

            {task.project && (
              <div>
                <label className="text-[11px] text-white/40 mb-2 block">所属项目</label>
                <div className="flex items-center gap-2">
                  {task.projectIcon && <span className="text-xl">{task.projectIcon}</span>}
                  <span className="text-white/80 text-sm">{task.project}</span>
                </div>
              </div>
            )}

            {task.description && (
              <div>
                <label className="text-[11px] text-white/40 mb-2 block">描述</label>
                <p className="text-white/70 text-sm whitespace-pre-wrap">{task.description}</p>
              </div>
            )}

            {task.tags && task.tags.length > 0 && (
              <div>
                <label className="text-[11px] text-white/40 mb-2 flex items-center gap-1 block">
                  <Tag size={11} /> 标签
                </label>
                <div className="flex flex-wrap gap-2">
                  {task.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[11px] px-2 py-1 rounded-full bg-white/5 text-white/40 border border-white/8"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Timestamps */}
          <div className="pt-6 border-t border-white/10">
            <div className="text-[11px] text-white/25 space-y-1">
              <p>创建于 {fmtDate(task.created_at)}</p>
              <p>更新于 {fmtDate(task.updated_at)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {showEdit && (
        <EditModal task={task} onConfirm={handleEdit} onClose={() => setShowEdit(false)} />
      )}
    </div>
  )
}
