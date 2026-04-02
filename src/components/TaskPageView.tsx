import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Loader2, Copy } from 'lucide-react'
import { authFetch } from '@/lib/http'
import PRVSEGraph from '@/components/prvse/PRVSEGraph'

interface TaskMeta {
  id: string
  name: string
  icon?: string
  column_id: string | null
  priority: string | null
  assignee: string | null
  start_date: string | null
  due_date: string | null
  parent_task_id?: string | null
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
  { value: 'templates',   label: '模板库' },
]

export default function TaskPageView() {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()

  const [taskMeta, setTaskMeta] = useState<TaskMeta | null>(null)
  const [metaLoading, setMetaLoading] = useState(true)
  const [instantiating, setInstantiating] = useState(false)

  useEffect(() => {
    if (!taskId) return
    authFetch<any>(`/kanban/tasks/${taskId}`)
      .then(d => setTaskMeta({
        id: d.id ?? taskId,
        name: d.name ?? d.title ?? '任务详情',
        icon: d.icon ?? '📋',
        column_id: d.column_id ?? 'planned',
        priority: d.priority ?? 'medium',
        assignee: d.assignee ?? '',
        start_date: d.start_date ?? null,
        due_date: d.due_date ?? null,
        parent_task_id: d.parent_task_id ?? null,
      }))
      .catch(() => {})
      .finally(() => setMetaLoading(false))
  }, [taskId])

  const updateAttr = useCallback(async (field: string, value: unknown) => {
    if (!taskId) return
    await authFetch(`/kanban/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify({ [field]: value }) }).catch(() => {})
  }, [taskId])

  async function handleInstantiate() {
    if (!taskId) return
    setInstantiating(true)
    try {
      const inst = await authFetch<any>(`/tasks/${taskId}/instantiate`, { method: 'POST' })
      navigate(`/tasks/${inst.id}`)
    } finally { setInstantiating(false) }
  }

  if (!taskId) return (
    <div className="h-screen flex items-center justify-center bg-[#191919]">
      <p className="text-neutral-400">无效的任务 ID</p>
    </div>
  )

  const priorityOpt = PRIORITY_OPTIONS.find(p => p.value === taskMeta?.priority) ?? PRIORITY_OPTIONS[1]
  const isTemplate = taskMeta?.column_id === 'templates'
  const isInstance = !!taskMeta?.parent_task_id

  return (
    <div className="h-screen flex flex-col bg-[#191919] overflow-hidden">

      {/* ── Header ── */}
      <div className="h-12 bg-[#141414] border-b border-white/5 flex items-center px-4 gap-3 shrink-0">
        <button
          onClick={() => navigate('/tasks')}
          className="flex items-center gap-1.5 text-neutral-500 hover:text-neutral-300 transition-colors shrink-0"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span className="text-[12px]">任务列表</span>
        </button>

        <div className="flex-1 flex items-center justify-center gap-2">
          <span className="text-base">{taskMeta?.icon ?? '📋'}</span>
          <span className="text-neutral-100 font-semibold text-[15px]">
            {metaLoading ? '加载中…' : (taskMeta?.name ?? '任务详情')}
          </span>
          {isTemplate && <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-400 border border-violet-500/20">模板</span>}
          {isInstance && <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400 border border-sky-500/20">实例</span>}
        </div>

        {isTemplate && !metaLoading && (
          <button
            onClick={handleInstantiate}
            disabled={instantiating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600/20 border border-violet-500/30
              text-violet-300 text-[11px] hover:bg-violet-600/35 disabled:opacity-50 transition-all shrink-0"
          >
            <Copy size={11} />
            {instantiating ? '创建中…' : '创建实例'}
          </button>
        )}
      </div>

      {/* ── Attributes bar ── */}
      {taskMeta && !metaLoading && (
        <div className="shrink-0 border-b border-white/5 bg-[#111] px-4 py-1.5 flex items-center gap-4 overflow-x-auto">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] text-neutral-600">状态</span>
            <select value={taskMeta.column_id ?? 'planned'}
              onChange={e => { setTaskMeta(p => p ? { ...p, column_id: e.target.value } : p); updateAttr('columnId', e.target.value) }}
              className="text-[11px] bg-neutral-800 border border-white/8 rounded px-1.5 py-0.5 text-neutral-300 outline-none cursor-pointer hover:border-white/15 transition-colors"
            >{COLUMN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
          </div>
          <div className="w-px h-4 bg-white/6 shrink-0" />
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] text-neutral-600">优先级</span>
            <select value={taskMeta.priority ?? 'medium'}
              onChange={e => { setTaskMeta(p => p ? { ...p, priority: e.target.value } : p); updateAttr('priority', e.target.value) }}
              className={`text-[11px] bg-neutral-800 border border-white/8 rounded px-1.5 py-0.5 outline-none cursor-pointer hover:border-white/15 transition-colors ${priorityOpt.cls}`}
            >{PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
          </div>
          <div className="w-px h-4 bg-white/6 shrink-0" />
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] text-neutral-600">负责人</span>
            <input value={taskMeta.assignee ?? ''} onChange={e => setTaskMeta(p => p ? { ...p, assignee: e.target.value } : p)}
              onBlur={e => updateAttr('assignee', e.target.value)} placeholder="未分配"
              className="text-[11px] bg-neutral-800 border border-white/8 rounded px-1.5 py-0.5 text-neutral-300 outline-none w-20 hover:border-white/15 focus:border-blue-500/40 transition-colors placeholder-neutral-700"
            />
          </div>
          <div className="w-px h-4 bg-white/6 shrink-0" />
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] text-neutral-600">开始</span>
            <input type="date" value={taskMeta.start_date ? taskMeta.start_date.split('T')[0] : ''}
              onChange={e => { const v = e.target.value || null; setTaskMeta(p => p ? { ...p, start_date: v } : p); updateAttr('startDate', v) }}
              className="text-[11px] bg-neutral-800 border border-white/8 rounded px-1.5 py-0.5 text-neutral-300 outline-none hover:border-white/15 focus:border-blue-500/40 transition-colors"
            />
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] text-neutral-600">截止</span>
            <input type="date" value={taskMeta.due_date ? taskMeta.due_date.split('T')[0] : ''}
              onChange={e => { const v = e.target.value || null; setTaskMeta(p => p ? { ...p, due_date: v } : p); updateAttr('dueDate', v) }}
              className="text-[11px] bg-neutral-800 border border-white/8 rounded px-1.5 py-0.5 text-neutral-300 outline-none hover:border-white/15 focus:border-blue-500/40 transition-colors"
            />
          </div>
        </div>
      )}

      {/* ── Body ── */}
      {metaLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={20} className="animate-spin text-neutral-600" />
        </div>
      ) : !taskMeta ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-neutral-500 text-sm">任务不存在</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <PRVSEGraph taskId={taskId} />
        </div>
      )}
    </div>
  )
}
