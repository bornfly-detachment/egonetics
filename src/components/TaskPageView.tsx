import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import PageManager from './PageManager'
import { createApiClient } from './apiClient'
import type { ApiClient, PageMeta } from './types'
import { getToken, removeToken } from '@/lib/http'

// ── Exec Step panel ─────────────────────────────────────────────
interface ExecStepMeta {
  id: string
  title: string
  icon: string
  createdAt: string
}

const ExecStepPanel: React.FC<{ taskId: string }> = ({ taskId }) => {
  const [steps, setSteps] = useState<ExecStepMeta[]>([])
  const [collapsed, setCollapsed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeStep, setActiveStep] = useState<string | null>(null)

  useEffect(() => {
    const token = getToken()
    fetch(`/api/pages?taskRefId=${taskId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : [])
      .then((data: ExecStepMeta[]) => {
        setSteps(Array.isArray(data) ? data : [])
        if (data.length > 0 && !activeStep) setActiveStep(data[data.length - 1].id)
      })
      .catch(() => setSteps([]))
      .finally(() => setLoading(false))
  }, [taskId]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="absolute bottom-0 left-0 z-10 flex flex-col bg-[#161616] border-t border-r border-white/5"
      style={{ width: 240 }}
    >
      {/* Section header */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="flex items-center justify-between px-3 py-2 text-xs text-neutral-500 hover:text-neutral-300 transition-colors shrink-0"
      >
        <span className="font-semibold uppercase tracking-widest text-[10px]">执行步骤</span>
        <div className="flex items-center gap-1">
          {steps.length > 0 && (
            <span className="text-[10px] bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded">
              {steps.length}
            </span>
          )}
          {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
        </div>
      </button>

      {!collapsed && (
        <div className="overflow-y-auto" style={{ maxHeight: 180 }}>
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 size={12} className="animate-spin text-neutral-600" />
            </div>
          ) : steps.length === 0 ? (
            <div className="px-3 pb-3 text-xs text-neutral-700 text-center">
              暂无执行步骤
            </div>
          ) : (
            <div className="pb-2">
              {steps.map(step => (
                <button
                  key={step.id}
                  onClick={() => setActiveStep(step.id)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors ${
                    activeStep === step.id
                      ? 'bg-amber-500/10 text-amber-300'
                      : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/5'
                  }`}
                >
                  <span className="shrink-0">{step.icon || '⚙️'}</span>
                  <span className="truncate">{step.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const KANBAN_API_BASE = '/api'

interface TaskData {
  id: string
  name: string
  column_id: string | null
  priority: string | null
  assignee: string | null
  start_date: string | null
  due_date: string | null
  tags: string[]
  icon?: string
}

// 创建 Task 专属的 API 客户端
function createTaskPageApiClient(taskId: string): ApiClient {
  // 使用带过滤的 baseClient，会自动添加 type=task&refId=taskId 参数
  const baseClient = createApiClient('task', taskId)

  return {
    async listPages(): Promise<PageMeta[]> {
      return baseClient.listPages()
    },
    async createPage(input) {
      return baseClient.createPage(input)
    },
    async updatePage(id, patch) {
      return baseClient.updatePage(id, patch)
    },
    async deletePage(id) {
      return baseClient.deletePage(id)
    },
    async movePage(id, input) {
      return baseClient.movePage(id, input)
    },
    async listBlocks(pageId) {
      return baseClient.listBlocks(pageId)
    },
    async saveBlocks(pageId, blocks) {
      return baseClient.saveBlocks(pageId, blocks)
    },
  }
}

const PRIORITY_OPTIONS = [
  { value: 'low',    label: '低',   cls: 'text-neutral-400' },
  { value: 'medium', label: '中',   cls: 'text-blue-400' },
  { value: 'high',   label: '高',   cls: 'text-amber-400' },
  { value: 'urgent', label: '紧急', cls: 'text-red-400' },
]

const COLUMN_OPTIONS = [
  { value: 'planned',     label: '计划中' },
  { value: 'in-progress', label: '进行中' },
  { value: 'review',      label: '审核中' },
  { value: 'done',        label: '已完成' },
]

const TaskPageView: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const [taskData, setTaskData] = useState<TaskData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // 获取 task 完整信息
  useEffect(() => {
    if (!taskId) return

    fetch(`${KANBAN_API_BASE}/kanban/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${getToken() || ''}` },
    })
      .then((res) => {
        if (res.status === 401) {
          removeToken()
          window.location.href = '/login'
          throw new Error('Unauthorized')
        }
        return res.json()
      })
      .then((data) => {
        setTaskData({
          id: data.id ?? taskId,
          name: data.name ?? data.title ?? '任务详情',
          column_id: data.column_id ?? data.columnId ?? 'planned',
          priority: data.priority ?? 'medium',
          assignee: data.assignee ?? '',
          start_date: data.start_date ?? data.startDate ?? null,
          due_date: data.due_date ?? data.dueDate ?? null,
          tags: Array.isArray(data.tags) ? data.tags : [],
          icon: data.icon ?? '📋',
        })
        setIsLoading(false)
      })
      .catch(() => setIsLoading(false))
  }, [taskId])

  // PATCH task field — fires on blur / select change
  const updateTaskField = useCallback(
    async (field: string, value: unknown) => {
      if (!taskId) return
      try {
        const res = await fetch(`${KANBAN_API_BASE}/kanban/tasks/${taskId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken() || ''}`,
          },
          body: JSON.stringify({ [field]: value }),
        })
        if (res.ok) {
          const updated = await res.json()
          setTaskData((prev) =>
            prev
              ? {
                  ...prev,
                  column_id: updated.column_id ?? updated.columnId ?? prev.column_id,
                  priority: updated.priority ?? prev.priority,
                  assignee: updated.assignee ?? prev.assignee,
                  start_date: updated.start_date ?? updated.startDate ?? prev.start_date,
                  due_date: updated.due_date ?? updated.dueDate ?? prev.due_date,
                  tags: Array.isArray(updated.tags) ? updated.tags : prev.tags,
                }
              : prev
          )
        }
      } catch {
        /* ignore */
      }
    },
    [taskId]
  )

  // 创建 API 客户端 - 使用 useMemo 避免每次渲染重新创建
  const apiClient = useMemo(() => {
    return taskId ? createTaskPageApiClient(taskId) : null
  }, [taskId])

  if (!taskId || !apiClient) {
    return (
      <div className="h-screen flex flex-col bg-[#191919]">
        <div className="h-14 bg-[#1a1a1a] border-b border-white/5 flex items-center px-4 shrink-0">
          <button
            onClick={() => navigate('/tasks')}
            className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            <span className="text-sm">返回任务列表</span>
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-neutral-400">无效的任务 ID</p>
        </div>
      </div>
    )
  }

  const priorityOpt = PRIORITY_OPTIONS.find((p) => p.value === taskData?.priority) ?? PRIORITY_OPTIONS[1]

  return (
    <div className="h-screen flex flex-col bg-[#191919]">
      {/* 顶部导航栏 */}
      <div className="h-14 bg-[#1a1a1a] border-b border-white/5 flex items-center px-4 shrink-0">
        <button
          onClick={() => navigate('/tasks')}
          className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span className="text-sm">返回任务列表</span>
        </button>
        <div className="flex-1" />
        <div className="flex items-center gap-2 text-neutral-500 text-sm">
          <span>{taskData?.icon ?? '📝'}</span>
          <span>{isLoading ? '加载中...' : (taskData?.name ?? '任务详情')}</span>
        </div>
      </div>

      {/* 属性栏 */}
      {taskData && !isLoading && (
        <div className="shrink-0 border-b border-white/5 bg-[#141414] px-4 py-2 flex items-center gap-4 overflow-x-auto">
          {/* 状态 */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] text-neutral-600">状态</span>
            <select
              value={taskData.column_id ?? 'planned'}
              onChange={(e) => {
                setTaskData((prev) => prev ? { ...prev, column_id: e.target.value } : prev)
                updateTaskField('column_id', e.target.value)
              }}
              className="text-[11px] bg-neutral-800 border border-white/10 rounded px-1.5 py-0.5 text-neutral-300 outline-none cursor-pointer hover:border-white/20 transition-colors"
            >
              {COLUMN_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="w-px h-4 bg-white/8 shrink-0" />

          {/* 优先级 */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] text-neutral-600">优先级</span>
            <select
              value={taskData.priority ?? 'medium'}
              onChange={(e) => {
                setTaskData((prev) => prev ? { ...prev, priority: e.target.value } : prev)
                updateTaskField('priority', e.target.value)
              }}
              className={`text-[11px] bg-neutral-800 border border-white/10 rounded px-1.5 py-0.5 outline-none cursor-pointer hover:border-white/20 transition-colors ${priorityOpt.cls}`}
            >
              {PRIORITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="w-px h-4 bg-white/8 shrink-0" />

          {/* 负责人 */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] text-neutral-600">负责人</span>
            <input
              value={taskData.assignee ?? ''}
              onChange={(e) => setTaskData((prev) => prev ? { ...prev, assignee: e.target.value } : prev)}
              onBlur={(e) => updateTaskField('assignee', e.target.value)}
              placeholder="未分配"
              className="text-[11px] bg-neutral-800 border border-white/10 rounded px-1.5 py-0.5 text-neutral-300 outline-none w-24 hover:border-white/20 focus:border-blue-500/50 transition-colors placeholder-neutral-700"
            />
          </div>

          <div className="w-px h-4 bg-white/8 shrink-0" />

          {/* 开始日期 */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] text-neutral-600">开始</span>
            <input
              type="date"
              value={taskData.start_date ? taskData.start_date.split('T')[0] : ''}
              onChange={(e) => {
                const v = e.target.value || null
                setTaskData((prev) => prev ? { ...prev, start_date: v } : prev)
                updateTaskField('start_date', v)
              }}
              className="text-[11px] bg-neutral-800 border border-white/10 rounded px-1.5 py-0.5 text-neutral-300 outline-none hover:border-white/20 focus:border-blue-500/50 transition-colors"
            />
          </div>

          {/* 截止日期 */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] text-neutral-600">截止</span>
            <input
              type="date"
              value={taskData.due_date ? taskData.due_date.split('T')[0] : ''}
              onChange={(e) => {
                const v = e.target.value || null
                setTaskData((prev) => prev ? { ...prev, due_date: v } : prev)
                updateTaskField('due_date', v)
              }}
              className="text-[11px] bg-neutral-800 border border-white/10 rounded px-1.5 py-0.5 text-neutral-300 outline-none hover:border-white/20 focus:border-blue-500/50 transition-colors"
            />
          </div>

          {/* 标签 */}
          {taskData.tags.length > 0 && (
            <>
              <div className="w-px h-4 bg-white/8 shrink-0" />
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] text-neutral-600">标签</span>
                <div className="flex gap-1">
                  {taskData.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] bg-neutral-700/60 text-neutral-400 px-1.5 py-0.5 rounded border border-white/5"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* PageManager 内容区 + exec step overlay */}
      <div className="flex-1 overflow-hidden relative">
        <PageManager api={apiClient} />
        <ExecStepPanel taskId={taskId} />
      </div>
    </div>
  )
}

export default TaskPageView
