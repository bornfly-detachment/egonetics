import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Play, Square, RefreshCw, Wifi, WifiOff, MessageSquare, ChevronDown, Loader2 } from 'lucide-react'
import { getToken, removeToken } from '@/lib/http'

// ── Constants ──────────────────────────────────────────────────
const SEAI_BASE = 'http://localhost:8000'

// ── Types ──────────────────────────────────────────────────────
interface Task {
  id: string
  name: string
  column_id: string | null
  priority: string | null
  icon?: string
}

interface LifecycleStatus {
  running: boolean
  trajectories: Array<{ node_id: string; status: string; output?: string; error?: string }>
  pending_feedback: Array<{ id: string; prompt: string }>
}

interface StreamEvent {
  id: string
  type: string
  task_id: string
  ts: string
  node_id?: string
  canvas_id?: string
  cost?: Record<string, number>
  error?: string
  node_kind?: string
}

const PRIORITY_COLOR: Record<string, string> = {
  low: 'text-neutral-400',
  medium: 'text-blue-400',
  high: 'text-amber-400',
  urgent: 'text-red-400',
}

const COLUMN_LABEL: Record<string, string> = {
  planned: '计划中',
  'in-progress': '进行中',
  review: '审核中',
  done: '已完成',
}

const EVENT_STYLE: Record<string, { icon: string; cls: string }> = {
  node_start: { icon: '▶', cls: 'text-blue-400' },
  node_complete: { icon: '✓', cls: 'text-green-400' },
  node_failed: { icon: '✗', cls: 'text-red-400' },
  lifecycle_started: { icon: '🚀', cls: 'text-amber-400' },
  human_gate: { icon: '⏸', cls: 'text-yellow-400' },
  feedback_resolved: { icon: '✅', cls: 'text-emerald-400' },
}

// ── API helpers ────────────────────────────────────────────────
const egoFetch = async (path: string, opts?: RequestInit) => {
  const token = getToken()
  const r = await fetch(`/api${path}`, {
    ...opts,
    headers: { ...(opts?.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  })
  if (r.status === 401) { removeToken(); window.location.href = '/login' }
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

const seaiFetch = async (path: string, opts?: RequestInit) => {
  const r = await fetch(`${SEAI_BASE}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts?.headers ?? {}) },
  })
  if (!r.ok) throw new Error(`SEAI HTTP ${r.status}: ${await r.text()}`)
  return r.json()
}

// ── Left panel: Task Queue ─────────────────────────────────────
const TaskQueue: React.FC<{
  tasks: Task[]
  loading: boolean
  selectedId: string | null
  runningIds: Set<string>
  onSelect: (task: Task) => void
}> = ({ tasks, loading, selectedId, runningIds, onSelect }) => {
  const active = tasks.filter(t => t.column_id === 'planned' || t.column_id === 'in-progress')
  const done = tasks.filter(t => t.column_id === 'review' || t.column_id === 'done')
  const [showDone, setShowDone] = useState(false)

  return (
    <div className="flex flex-col h-full border-r border-white/8 bg-[#111] w-72 shrink-0">
      <div className="px-4 py-3 border-b border-white/5 shrink-0">
        <span className="text-xs font-semibold text-neutral-500 uppercase tracking-widest">任务队列</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={18} className="animate-spin text-neutral-600" />
          </div>
        ) : (
          <>
            {active.length === 0 ? (
              <div className="px-4 py-6 text-xs text-neutral-700 text-center">
                没有计划中或进行中的任务
              </div>
            ) : (
              active.map(task => (
                <button
                  key={task.id}
                  onClick={() => onSelect(task)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-white/3 ${
                    selectedId === task.id
                      ? 'bg-primary-500/10 border-l-2 border-l-primary-500'
                      : 'hover:bg-white/4'
                  }`}
                >
                  <span className="text-base shrink-0">{task.icon ?? '📋'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white truncate font-medium">{task.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-neutral-600">
                        {COLUMN_LABEL[task.column_id ?? 'planned'] ?? task.column_id}
                      </span>
                      {task.priority && (
                        <span className={`text-[10px] ${PRIORITY_COLOR[task.priority] ?? 'text-neutral-500'}`}>
                          {task.priority}
                        </span>
                      )}
                    </div>
                  </div>
                  {runningIds.has(task.id) && (
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
                  )}
                </button>
              ))
            )}

            {done.length > 0 && (
              <>
                <button
                  onClick={() => setShowDone(s => !s)}
                  className="w-full flex items-center gap-2 px-4 py-2 text-[10px] text-neutral-600 hover:text-neutral-400 transition-colors"
                >
                  <ChevronDown size={11} className={showDone ? '' : '-rotate-90'} />
                  已完成 / 审核中 ({done.length})
                </button>
                {showDone && done.map(task => (
                  <button
                    key={task.id}
                    onClick={() => onSelect(task)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors opacity-50 hover:opacity-70 border-b border-white/3 ${
                      selectedId === task.id ? 'bg-primary-500/10' : ''
                    }`}
                  >
                    <span className="text-sm shrink-0">{task.icon ?? '📋'}</span>
                    <p className="text-xs text-neutral-400 truncate">{task.name}</p>
                  </button>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Middle panel: Lifecycle Controls ──────────────────────────
const LifecyclePanel: React.FC<{
  task: Task | null
  status: LifecycleStatus | null
  starting: boolean
  stopping: boolean
  onStart: () => void
  onStop: () => void
  onRefreshStatus: () => void
}> = ({ task, status, starting, stopping, onStart, onStop, onRefreshStatus }) => {
  if (!task) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0d0d0d]">
        <div className="text-center">
          <div className="text-5xl mb-4 opacity-20">🤖</div>
          <p className="text-neutral-600 text-sm">从左侧选择一个任务</p>
          <p className="text-neutral-700 text-xs mt-1">然后启动生命周期，Agent 将自动执行</p>
        </div>
      </div>
    )
  }

  const isRunning = status?.running ?? false
  const trajectories = status?.trajectories ?? []
  const pendingFeedback = status?.pending_feedback ?? []

  const statusColor = (s: string) => {
    if (s === 'success') return 'text-green-400'
    if (s === 'failed') return 'text-red-400'
    if (s === 'running') return 'text-blue-400'
    if (s === 'waiting_human') return 'text-yellow-400'
    return 'text-neutral-500'
  }

  return (
    <div className="flex-1 flex flex-col bg-[#0d0d0d] min-w-0">
      {/* Controls bar */}
      <div className="px-5 py-3 border-b border-white/5 flex items-center gap-3 shrink-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span>{task.icon ?? '📋'}</span>
            <p className="text-sm font-medium text-white truncate">{task.name}</p>
            {isRunning && (
              <span className="flex items-center gap-1 text-xs text-green-400">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                运行中
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-600 mt-0.5">
            {COLUMN_LABEL[task.column_id ?? ''] ?? task.column_id ?? ''}
          </p>
        </div>

        <button
          onClick={onRefreshStatus}
          className="p-1.5 text-neutral-500 hover:text-neutral-300 transition-colors"
          title="刷新状态"
        >
          <RefreshCw size={14} />
        </button>

        {isRunning ? (
          <button
            onClick={onStop}
            disabled={stopping}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-xs rounded-lg border border-red-500/20 transition-colors disabled:opacity-50"
          >
            {stopping ? <Loader2 size={12} className="animate-spin" /> : <Square size={12} />}
            停止
          </button>
        ) : (
          <button
            onClick={onStart}
            disabled={starting}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 text-green-400 text-xs rounded-lg border border-green-500/20 transition-colors disabled:opacity-50"
          >
            {starting ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            启动生命周期
          </button>
        )}
      </div>

      {/* Trajectories */}
      <div className="flex-1 overflow-y-auto p-5">
        {trajectories.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-3xl mb-3 opacity-30">⚡</div>
            <p className="text-neutral-600 text-sm">
              {isRunning ? '执行中，等待节点完成...' : '启动生命周期后显示执行轨迹'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-neutral-600 mb-3 uppercase tracking-widest">执行轨迹</p>
            {trajectories.map((t, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded-lg bg-white/3 border border-white/5"
              >
                <div className={`text-xs mt-0.5 font-mono ${statusColor(t.status)}`}>
                  {t.status === 'success' ? '✓' : t.status === 'failed' ? '✗' : t.status === 'running' ? '▶' : '…'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-neutral-400">{t.node_id.slice(0, 8)}…</span>
                    <span className={`text-xs ${statusColor(t.status)}`}>{t.status}</span>
                  </div>
                  {t.output && (
                    <p className="text-xs text-neutral-500 mt-1 truncate">{
                      typeof t.output === 'string' ? t.output.slice(0, 120) : JSON.stringify(t.output).slice(0, 120)
                    }</p>
                  )}
                  {t.error && (
                    <p className="text-xs text-red-500/70 mt-1 truncate">{t.error}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pending feedback */}
        {pendingFeedback.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-yellow-500 uppercase tracking-widest">等待人工介入</p>
            {pendingFeedback.map(fb => (
              <div key={fb.id} className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
                <p className="text-xs text-yellow-300">{fb.prompt}</p>
                <p className="text-[10px] text-neutral-600 mt-1">feedback id: {fb.id}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Right panel: Real-time stream ─────────────────────────────
const StreamPanel: React.FC<{
  taskId: string | null
  events: StreamEvent[]
  connected: boolean
  pendingFeedback: Array<{ id: string; prompt: string }>
  onFeedback: (fbId: string, response: string) => void
}> = ({ taskId, events, connected, pendingFeedback, onFeedback }) => {
  const bottomRef = useRef<HTMLDivElement>(null)
  const [fbInput, setFbInput] = useState<Record<string, string>>({})

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events])

  const fmtTime = (ts: string) =>
    new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  return (
    <div className="w-80 shrink-0 flex flex-col border-l border-white/8 bg-[#0a0a0a]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2 shrink-0">
        <span className="text-xs font-semibold text-neutral-500 uppercase tracking-widest flex-1">实时流</span>
        <div className={`flex items-center gap-1.5 text-xs ${connected ? 'text-green-400' : 'text-neutral-600'}`}>
          {connected ? <Wifi size={11} /> : <WifiOff size={11} />}
          {connected ? 'WS 已连接' : taskId ? '未连接' : '未选择'}
        </div>
      </div>

      {/* Events stream */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5 font-mono text-xs">
        {events.length === 0 ? (
          <div className="text-center py-8 text-neutral-700 text-[11px]">
            {taskId ? '等待事件...' : '选择任务后开始监听'}
          </div>
        ) : (
          events.map(ev => {
            const style = EVENT_STYLE[ev.type] ?? { icon: '·', cls: 'text-neutral-500' }
            return (
              <div key={ev.id} className="flex items-start gap-2 leading-relaxed">
                <span className={`shrink-0 ${style.cls}`}>{style.icon}</span>
                <div className="flex-1 min-w-0">
                  <span className={`${style.cls} mr-1.5`}>{ev.type}</span>
                  {ev.node_id && (
                    <span className="text-neutral-600">{ev.node_id.slice(0, 8)}</span>
                  )}
                  {ev.error && <span className="text-red-500/80"> {ev.error.slice(0, 40)}</span>}
                </div>
                <span className="text-neutral-700 shrink-0 text-[10px]">{fmtTime(ev.ts)}</span>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Human feedback inputs */}
      {pendingFeedback.length > 0 && (
        <div className="border-t border-white/5 p-3 space-y-2 shrink-0">
          <div className="flex items-center gap-1.5 text-[10px] text-yellow-400 uppercase tracking-widest">
            <MessageSquare size={10} /> 人工反馈
          </div>
          {pendingFeedback.map(fb => (
            <div key={fb.id} className="space-y-1.5">
              <p className="text-[11px] text-neutral-400 leading-relaxed">{fb.prompt}</p>
              <div className="flex gap-1.5">
                <input
                  value={fbInput[fb.id] ?? ''}
                  onChange={e => setFbInput(prev => ({ ...prev, [fb.id]: e.target.value }))}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && fbInput[fb.id]?.trim()) {
                      onFeedback(fb.id, fbInput[fb.id])
                      setFbInput(prev => ({ ...prev, [fb.id]: '' }))
                    }
                  }}
                  placeholder="输入回复后按 Enter..."
                  className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white placeholder-neutral-700 focus:outline-none focus:border-yellow-500/40"
                />
                <button
                  onClick={() => {
                    if (fbInput[fb.id]?.trim()) {
                      onFeedback(fb.id, fbInput[fb.id])
                      setFbInput(prev => ({ ...prev, [fb.id]: '' }))
                    }
                  }}
                  className="px-2 py-1 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded text-xs transition-colors"
                >
                  发送
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main View ──────────────────────────────────────────────────
const AgentsView: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([])
  const [tasksLoading, setTasksLoading] = useState(true)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [status, setStatus] = useState<LifecycleStatus | null>(null)
  const [starting, setStarting] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set())
  const [events, setEvents] = useState<StreamEvent[]>([])
  const [wsConnected, setWsConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const eventsIdCounter = useRef(0)

  // ── Load tasks ──
  const loadTasks = useCallback(async () => {
    setTasksLoading(true)
    try {
      const data = await egoFetch('/tasks')
      const list = Array.isArray(data) ? data : (data?.tasks ?? [])
      setTasks(list)
    } catch { /* ignore */ }
    setTasksLoading(false)
  }, [])

  useEffect(() => { loadTasks() }, [loadTasks])

  // ── Refresh lifecycle status ──
  const refreshStatus = useCallback(async (taskId: string) => {
    try {
      const s: LifecycleStatus = await seaiFetch(`/lifecycle/status/${taskId}`)
      setStatus(s)
      if (s.running) {
        setRunningIds(prev => new Set([...prev, taskId]))
      } else {
        setRunningIds(prev => { const n = new Set(prev); n.delete(taskId); return n })
      }
    } catch {
      setStatus(null)
    }
  }, [])

  // ── WebSocket connection ──
  const connectWs = useCallback((taskId: string) => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setWsConnected(false)
    setEvents([])

    const ws = new WebSocket(`${SEAI_BASE.replace('http', 'ws')}/lifecycle/ws/${taskId}`)
    wsRef.current = ws

    ws.onopen = () => setWsConnected(true)
    ws.onclose = () => setWsConnected(false)
    ws.onerror = () => setWsConnected(false)

    ws.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data)
        if (ev.type === 'pong') return
        const stamped = { ...ev, id: String(++eventsIdCounter.current) }
        setEvents(prev => [...prev.slice(-200), stamped])

        // Refresh status on significant events
        if (['node_complete', 'node_failed', 'lifecycle_started'].includes(ev.type)) {
          refreshStatus(taskId)
        }
      } catch { /* ignore */ }
    }

    // Ping keepalive
    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }))
    }, 25000)

    ws.onclose = () => {
      clearInterval(ping)
      setWsConnected(false)
    }
  }, [refreshStatus])

  // ── Select task ──
  const handleSelectTask = useCallback((task: Task) => {
    setSelectedTask(task)
    setStatus(null)
    setEvents([])
    connectWs(task.id)
    refreshStatus(task.id)
  }, [connectWs, refreshStatus])

  // ── Start lifecycle ──
  const handleStart = useCallback(async () => {
    if (!selectedTask) return
    setStarting(true)
    try {
      await seaiFetch('/lifecycle/start', {
        method: 'POST',
        body: JSON.stringify({ task_id: selectedTask.id }),
      })
      setRunningIds(prev => new Set([...prev, selectedTask.id]))
      await loadTasks()
      setTimeout(() => refreshStatus(selectedTask.id), 1000)
    } catch (e) {
      setEvents(prev => [...prev, {
        id: String(++eventsIdCounter.current),
        type: 'error',
        task_id: selectedTask.id,
        ts: new Date().toISOString(),
        error: String(e),
      }])
    }
    setStarting(false)
  }, [selectedTask, loadTasks, refreshStatus])

  // ── Stop lifecycle ──
  const handleStop = useCallback(async () => {
    if (!selectedTask) return
    setStopping(true)
    try {
      await seaiFetch(`/lifecycle/stop/${selectedTask.id}`, { method: 'POST' })
      setRunningIds(prev => { const n = new Set(prev); n.delete(selectedTask.id); return n })
      await loadTasks()
      await refreshStatus(selectedTask.id)
    } catch { /* ignore */ }
    setStopping(false)
  }, [selectedTask, loadTasks, refreshStatus])

  // ── Human feedback ──
  const handleFeedback = useCallback(async (fbId: string, response: string) => {
    try {
      await seaiFetch(`/lifecycle/feedback/${fbId}`, {
        method: 'POST',
        body: JSON.stringify({ user_response: response }),
      })
      if (selectedTask) refreshStatus(selectedTask.id)
    } catch { /* ignore */ }
  }, [selectedTask, refreshStatus])

  // ── Cleanup ──
  useEffect(() => {
    return () => { wsRef.current?.close() }
  }, [])

  return (
    <div className="flex h-full" style={{ height: 'calc(100vh - 120px)' }}>
      {/* Left: Task Queue */}
      <TaskQueue
        tasks={tasks}
        loading={tasksLoading}
        selectedId={selectedTask?.id ?? null}
        runningIds={runningIds}
        onSelect={handleSelectTask}
      />

      {/* Middle: Lifecycle Controls */}
      <LifecyclePanel
        task={selectedTask}
        status={status}
        starting={starting}
        stopping={stopping}
        onStart={handleStart}
        onStop={handleStop}
        onRefreshStatus={() => selectedTask && refreshStatus(selectedTask.id)}
      />

      {/* Right: Real-time stream */}
      <StreamPanel
        taskId={selectedTask?.id ?? null}
        events={events}
        connected={wsConnected}
        pendingFeedback={status?.pending_feedback ?? []}
        onFeedback={handleFeedback}
      />
    </div>
  )
}

export default AgentsView
