import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ReactFlow,
  Background, BackgroundVariant, Controls,
  Node, Edge, Handle, Position, NodeProps,
  useNodesState, useEdgesState,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  RefreshCw, Pause, Play, SkipForward,
  CheckCircle, AlertTriangle, Circle, Loader, XCircle,
  GripVertical, Zap, Send, Wifi, WifiOff, Pencil, X, Check,
} from 'lucide-react'
import { queueApi, QueueItem } from '../lib/queue-api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlanNode {
  id: string
  label: string
  dependencies: string[]
  status: 'planned' | 'running' | 'done' | 'failed'
}

interface ConflictCard {
  id: string
  title: string
  description: string
  options: { label: string; variant: 'accept' | 'retry' | 'adjust' }[]
}

interface CtrlStatus {
  is_running: boolean
  is_paused: boolean
  active_count: number
  pending_count: number
  running_count: number
  last_poll_at: string | null
}

// ─── Node edit state — only tracks which node is open + loading ───────────────

type EditState = { nodeId: string; loading: boolean } | null

// ─── Custom React Flow node ───────────────────────────────────────────────────

function PlanNodeCard({ data }: NodeProps) {
  const {
    label, status,
    onEdit, editing, editLoading,
    onEditSubmit, onEditCancel,
  } = data as {
    label: string
    status: PlanNode['status']
    onEdit: () => void
    editing: boolean
    editLoading: boolean
    onEditSubmit: (text: string) => void
    onEditCancel: () => void
  }

  // Local input state — never touches React Flow data, no RF re-render on keystroke
  const [localText, setLocalText] = useState('')

  const borderColor = {
    planned: 'border-white/15',
    running: 'border-blue-500/60',
    done:    'border-green-500/50',
    failed:  'border-red-500/50',
  }[status]

  const bg = {
    planned: 'bg-neutral-800/80',
    running: 'bg-blue-950/60',
    done:    'bg-green-950/50',
    failed:  'bg-red-950/50',
  }[status]

  const textColor = {
    planned: 'text-neutral-200',
    running: 'text-blue-200',
    done:    'text-green-300',
    failed:  'text-red-300',
  }[status]

  function handleCancel() {
    setLocalText('')
    onEditCancel()
  }

  function handleSubmit() {
    if (!localText.trim()) return
    onEditSubmit(localText)
  }

  return (
    <div className={`relative rounded-xl border ${borderColor} ${bg} shadow-lg min-w-[140px] max-w-[180px]`}>
      <Handle type="target" position={Position.Left}  style={{ opacity: 0, width: 6, height: 6 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0, width: 6, height: 6 }} />

      {/* 主体 */}
      <div className="px-3 py-2.5 group">
        <div className="flex items-center gap-1.5 mb-1">
          <StateIconSmall status={status} />
          <span className={`text-[11px] font-medium leading-tight ${textColor}`}>{label}</span>
          {!editing && (
            <button
              onClick={onEdit}
              onMouseDown={e => e.stopPropagation()}
              className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity
                text-neutral-600 hover:text-violet-400 shrink-0"
              title="修改意见"
            >
              <Pencil size={10} />
            </button>
          )}
        </div>

        {/* 修改意见输入框 — 完全本地状态，不触发 RF 重渲染 */}
        {editing && (
          <div className="mt-1.5 flex flex-col gap-1"
            onClick={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
          >
            <input
              autoFocus
              value={localText}
              onChange={e => setLocalText(e.target.value)}
              onKeyDown={e => {
                e.stopPropagation()
                if (e.key === 'Enter') handleSubmit()
                if (e.key === 'Escape') handleCancel()
              }}
              placeholder="修改意见…"
              className="w-full bg-neutral-900 border border-violet-500/40 rounded px-2 py-1
                text-[10px] text-neutral-200 placeholder-neutral-600 focus:outline-none"
            />
            <div className="flex gap-1">
              <button
                onClick={handleSubmit}
                onMouseDown={e => e.stopPropagation()}
                disabled={editLoading || !localText.trim()}
                className="flex-1 flex items-center justify-center gap-1 py-0.5 rounded
                  bg-violet-600/30 border border-violet-500/30 text-violet-300 text-[10px]
                  hover:bg-violet-600/50 disabled:opacity-40 transition-all">
                {editLoading ? <Loader size={9} className="animate-spin" /> : <Check size={9} />}
                AI 优化
              </button>
              <button
                onClick={handleCancel}
                onMouseDown={e => e.stopPropagation()}
                className="px-2 py-0.5 rounded bg-neutral-700/50 border border-white/10
                  text-neutral-500 text-[10px] hover:text-neutral-300 transition-all">
                <X size={9} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StateIconSmall({ status }: { status: PlanNode['status'] }) {
  if (status === 'done')    return <CheckCircle size={11} className="text-green-400 shrink-0" />
  if (status === 'running') return <Loader size={11} className="text-blue-400 animate-spin shrink-0" />
  if (status === 'failed')  return <XCircle size={11} className="text-red-400 shrink-0" />
  return <Circle size={11} className="text-neutral-600 shrink-0" />
}

const nodeTypes = { plan: PlanNodeCard }

// ─── Layout helper ────────────────────────────────────────────────────────────

function toReactFlowGraph(
  nodes: PlanNode[],
  editState: EditState,
  onEdit: (id: string) => void,
  onEditSubmit: (text: string) => void,
  onEditCancel: () => void,
): { rfNodes: Node[]; rfEdges: Edge[] } {
  // Topological level assignment
  const levelMap = new Map<string, number>()
  nodes.forEach(n => levelMap.set(n.id, 0))
  let changed = true
  while (changed) {
    changed = false
    nodes.forEach(n => n.dependencies.forEach(dep => {
      const next = (levelMap.get(dep) ?? 0) + 1
      if ((levelMap.get(n.id) ?? 0) < next) { levelMap.set(n.id, next); changed = true }
    }))
  }

  const byLevel = new Map<number, string[]>()
  levelMap.forEach((lv, id) => { if (!byLevel.has(lv)) byLevel.set(lv, []); byLevel.get(lv)!.push(id) })

  const COL_W = 210, ROW_H = 90
  const positions: Record<string, { x: number; y: number }> = {}
  byLevel.forEach((ids, lv) => {
    const totalH = ids.length * ROW_H
    ids.forEach((id, i) => {
      positions[id] = { x: lv * COL_W, y: i * ROW_H - totalH / 2 + ROW_H / 2 }
    })
  })

  const rfNodes: Node[] = nodes.map(n => ({
    id: n.id,
    type: 'plan',
    position: positions[n.id] ?? { x: 0, y: 0 },
    data: {
      label: n.label,
      status: n.status,
      onEdit: () => onEdit(n.id),
      editing: editState?.nodeId === n.id,
      editLoading: editState?.nodeId === n.id ? editState.loading : false,
      onEditSubmit,
      onEditCancel,
    },
  }))

  const rfEdges: Edge[] = nodes.flatMap(n =>
    n.dependencies.map(dep => ({
      id: `${dep}->${n.id}`,
      source: dep,
      target: n.id,
      style: { stroke: 'rgba(255,255,255,0.15)', strokeWidth: 1.5 },
      animated: n.status === 'running',
    }))
  )

  return { rfNodes, rfEdges }
}

// ─── SEAI API ─────────────────────────────────────────────────────────────────

async function apiGeneratePlan(description: string) {
  const r = await fetch('/seai/plan/generate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description }),
  })
  if (!r.ok) throw new Error(await r.text())
  const data = await r.json()
  const raw = data.nodes as Array<{ id: string; label: string; db_id: string; dependencies: string[] }>
  const idMap: Record<string, string> = {}
  raw.forEach(n => { idMap[n.id] = n.db_id })
  const nodes: PlanNode[] = raw.map(n => ({
    id: n.db_id,
    label: n.label,
    dependencies: (n.dependencies ?? []).map(dep => idMap[dep] ?? dep),
    status: 'planned' as const,
  }))
  return { nodes, regen_count: data.regen_count as number }
}

async function apiRefineNode(nodeId: string, feedback: string): Promise<string> {
  const r = await fetch(`/seai/plan/${nodeId}/refine`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ feedback }),
  })
  if (!r.ok) throw new Error(await r.text())
  const d = await r.json()
  return d.description as string
}

async function apiConfirmPlan() {
  const r = await fetch('/seai/plan/confirm', { method: 'POST' })
  return r.json()
}
async function apiPause()  { await fetch('/seai/state-ctrl/pause',  { method: 'POST' }) }
async function apiResume() { await fetch('/seai/state-ctrl/resume', { method: 'POST' }) }

// ─── Sortable queue row ───────────────────────────────────────────────────────

function StateIcon({ state, size = 13, className = '' }: {
  state: QueueItem['state']; size?: number; className?: string
}) {
  const p = { size, className }
  if (state === 'done')    return <CheckCircle   {...p} className={`${className} text-green-400`} />
  if (state === 'running') return <Loader        {...p} className={`${className} text-blue-400 animate-spin`} />
  if (state === 'failed')  return <XCircle       {...p} className={`${className} text-red-400`} />
  if (state === 'blocked') return <AlertTriangle {...p} className={`${className} text-yellow-400`} />
  return <Circle {...p} className={`${className} text-neutral-600`} />
}

function SortableRow({ item, onSkip }: { item: QueueItem; onSkip: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  return (
    <div ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-neutral-800/60 border border-white/[0.06] group hover:border-white/10 transition-colors"
    >
      <button {...attributes} {...listeners}
        className="text-neutral-700 hover:text-neutral-500 cursor-grab active:cursor-grabbing shrink-0">
        <GripVertical size={13} />
      </button>
      <StateIcon state={item.state} size={12} />
      <span className="flex-1 text-xs text-neutral-300 truncate">{item.description}</span>
      {item.v_score !== null && (
        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded
          ${item.v_score >= 0.7 ? 'text-green-400 bg-green-400/10' : 'text-yellow-400 bg-yellow-400/10'}`}>
          V={item.v_score.toFixed(2)}
        </span>
      )}
      {item.state === 'pending' && (
        <button onClick={() => onSkip(item.id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-neutral-600 hover:text-yellow-400">
          <SkipForward size={12} />
        </button>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ControllerView() {
  const [taskDesc, setTaskDesc]       = useState('')
  const [planNodes, setPlanNodes]     = useState<PlanNode[]>([])
  const [regenCount, setRegenCount]   = useState(0)
  const [editable, setEditable]       = useState(false)
  const [generating, setGenerating]   = useState(false)
  const [genError, setGenError]       = useState('')
  const [confirming, setConfirming]   = useState(false)
  const [confirmMsg, setConfirmMsg]   = useState('')
  const [editState, setEditState]     = useState<EditState>(null)

  const [conflicts, setConflicts]     = useState<ConflictCard[]>([])
  const [localQueue, setLocalQueue]   = useState<QueueItem[]>([])
  const [queueLoading, setQueueLoading] = useState(true)
  const [paused, setPaused]           = useState(false)
  const [ctrlStatus, setCtrlStatus]   = useState<CtrlStatus | null>(null)
  const [seaiOnline, setSeaiOnline]   = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)

  // React Flow state
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<Node>([])
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>([])

  // ── 同步 planNodes → React Flow graph ──────────────────────────────────────
  // 注意：不再传 editText/onEditChange，text 完全本地化到 PlanNodeCard
  // editState.nodeId/loading 变化才触发 RF 重渲染，打字不会触发
  useEffect(() => {
    const { rfNodes: n, rfEdges: e } = toReactFlowGraph(
      planNodes, editState,
      (nodeId) => setEditState({ nodeId, loading: false }),
      handleEditSubmit,
      ()       => setEditState(null),
    )
    setRfNodes(n)
    setRfEdges(e)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planNodes, editState?.nodeId, editState?.loading])

  // ── SSE ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let es: EventSource
    function connect() {
      es = new EventSource('/seai/state-ctrl/stream')
      es.onopen  = () => setSeaiOnline(true)
      es.onmessage = (e) => {
        try {
          const d = JSON.parse(e.data)
          if (d.error) return
          setCtrlStatus(d); setSeaiOnline(true)
          if (typeof d.is_paused === 'boolean') setPaused(d.is_paused)
        } catch { /* */ }
      }
      es.onerror = () => { setSeaiOnline(false); es.close(); setTimeout(connect, 5000) }
    }
    connect()
    return () => es?.close()
  }, [])

  // ── 局部队列轮询 ────────────────────────────────────────────────────────────
  const refreshQueue = useCallback(async () => {
    try { const items = await queueApi.list(); setLocalQueue(items) }
    catch { /* SEAI offline */ }
    finally { setQueueLoading(false) }
  }, [])

  useEffect(() => {
    refreshQueue()
    const t = setInterval(refreshQueue, 4000)
    return () => clearInterval(t)
  }, [refreshQueue])

  // ── 生成计划 ───────────────────────────────────────────────────────────────
  async function handleGenerate() {
    if (!taskDesc.trim()) { inputRef.current?.focus(); return }
    if (regenCount >= 3) return
    setGenerating(true); setGenError('')
    try {
      const { nodes, regen_count } = await apiGeneratePlan(taskDesc)
      setPlanNodes(nodes); setRegenCount(regen_count)
      if (regen_count >= 3) setEditable(true)
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'SEAI 无响应')
    } finally { setGenerating(false) }
  }

  // ── 节点修改意见提交 ────────────────────────────────────────────────────────
  async function handleEditSubmit(text: string) {
    if (!editState || !text.trim()) return
    const nodeId = editState.nodeId
    setEditState(s => s ? { ...s, loading: true } : s)
    try {
      const newLabel = await apiRefineNode(nodeId, text)
      setPlanNodes(ns => ns.map(n => n.id === nodeId ? { ...n, label: newLabel } : n))
      setEditState(null)
    } catch (e) {
      setEditState(s => s ? { ...s, loading: false } : s)
      console.error('Refine failed:', e)
    }
  }

  // ── 确认执行 ───────────────────────────────────────────────────────────────
  async function handleConfirm() {
    setConfirming(true); setConfirmMsg('')
    try {
      const res = await apiConfirmPlan()
      await refreshQueue()
      setConfirmMsg(`✓ 已创建执行画布，${res.created ?? 0} 个任务流入队列`)
      setTimeout(() => setConfirmMsg(''), 4000)
    } catch {
      setConfirmMsg('下发失败，请检查 SEAI 连接')
      setTimeout(() => setConfirmMsg(''), 3000)
    } finally { setConfirming(false) }
  }

  // ── 暂停 / 恢复 ────────────────────────────────────────────────────────────
  async function togglePause() {
    const next = !paused; setPaused(next)
    try { next ? await apiPause() : await apiResume() }
    catch { setPaused(!next) }
  }

  // ── 冲突解决 ───────────────────────────────────────────────────────────────
  function resolveConflict(id: string) { setConflicts(cs => cs.filter(c => c.id !== id)) }

  // ── 拖拽排序 ───────────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    setLocalQueue(q => arrayMove(q, q.findIndex(i => i.id === active.id), q.findIndex(i => i.id === over.id)))
  }
  function handleSkip(id: string) { queueApi.patch(id, { state: 'done' }).then(refreshQueue).catch(() => {}) }

  const runningCount = ctrlStatus?.active_count  ?? localQueue.filter(i => i.state === 'running').length
  const pendingCount = ctrlStatus?.pending_count ?? localQueue.filter(i => i.state === 'pending').length

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 max-w-5xl mx-auto pb-8">

      {/* ══ 状态栏 ══════════════════════════════════════════════════════════ */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-neutral-900 border border-white/[0.08] sticky top-0 z-10">
        <Zap size={14} className="text-violet-400 shrink-0" />
        <div className="flex items-center gap-1.5">
          {seaiOnline ? <Wifi size={12} className="text-green-400" /> : <WifiOff size={12} className="text-neutral-600" />}
          <span className={`text-[11px] font-medium ${seaiOnline ? 'text-green-400' : 'text-neutral-500'}`}>
            {seaiOnline ? 'SEAI 在线' : 'SEAI 离线'}
          </span>
        </div>
        <span className="text-neutral-700">·</span>
        <span className="text-[11px] text-neutral-400">执行中 <span className="text-blue-400 font-semibold">{runningCount}</span></span>
        <span className="text-[11px] text-neutral-400">等待 <span className="text-neutral-200 font-semibold">{pendingCount}</span></span>
        {conflicts.length > 0 && (
          <span className="text-[11px] text-red-400 font-semibold animate-pulse">{conflicts.length} 个冲突</span>
        )}
        {ctrlStatus?.last_poll_at && (
          <span className="text-[10px] text-neutral-600">
            {new Date(ctrlStatus.last_poll_at).toLocaleTimeString('zh-CN')}
          </span>
        )}
        <div className="flex-1" />
        <button onClick={togglePause}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all
            ${paused
              ? 'bg-green-500/15 border-green-500/30 text-green-300 hover:bg-green-500/25'
              : 'bg-neutral-800 border-white/10 text-neutral-400 hover:text-white hover:border-white/20'}`}>
          {paused ? <><Play size={11} /> 继续</> : <><Pause size={11} /> 暂停</>}
        </button>
      </div>

      {/* ══ 全局最优 ════════════════════════════════════════════════════════ */}
      <div className="rounded-xl border border-white/[0.08] bg-neutral-900 overflow-hidden">
        {/* 标题栏 */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
          <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
          <span className="text-xs font-semibold text-neutral-200 tracking-wide">全局最优</span>
          <span className="text-[10px] text-neutral-600">AI 生成计划图，悬停节点可提修改意见</span>
          {planNodes.length > 0 && (
            <span className="ml-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300">
              {planNodes.length} 步
            </span>
          )}
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            {editable && (
              <span className="text-[10px] text-violet-400 bg-violet-400/10 px-2 py-0.5 rounded-full border border-violet-500/20">
                手动编辑模式
              </span>
            )}
            {!editable && planNodes.length > 0 && (
              <button onClick={handleGenerate} disabled={generating || regenCount >= 3}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px]
                  bg-neutral-800 border border-white/10 text-neutral-400
                  hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                <RefreshCw size={11} className={generating ? 'animate-spin' : ''} />
                重新生成 {regenCount}/3
              </button>
            )}
            {planNodes.length > 0 && (
              <button onClick={handleConfirm} disabled={confirming}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-semibold
                  bg-violet-600 text-white hover:bg-violet-500
                  disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-lg shadow-violet-900/40">
                {confirming ? <><Loader size={11} className="animate-spin" /> 下发中…</> : <>确认执行 →</>}
              </button>
            )}
          </div>
        </div>

        {/* 输入框 */}
        <div className="px-4 py-3 border-b border-white/[0.05]">
          <div className="flex gap-2">
            <input ref={inputRef} value={taskDesc}
              onChange={e => setTaskDesc(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) handleGenerate() }}
              placeholder="描述任务目标，AI 自动拆解为执行计划…"
              className="flex-1 bg-neutral-800/80 border border-white/10 rounded-lg px-3 py-2 text-sm
                text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-violet-500/50 focus:bg-neutral-800 transition-all"
            />
            <button onClick={handleGenerate}
              disabled={generating || !taskDesc.trim() || regenCount >= 3}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                bg-violet-600/30 border border-violet-500/40 text-violet-300
                hover:bg-violet-600/50 hover:text-white
                disabled:opacity-30 disabled:cursor-not-allowed transition-all">
              {generating
                ? <><Loader size={13} className="animate-spin" /> 生成中…</>
                : <><Send size={13} /> {planNodes.length === 0 ? '生成计划' : '重新生成'}</>}
            </button>
          </div>
          {genError && <p className="mt-1.5 text-[11px] text-red-400">{genError}</p>}
          {confirmMsg && (
            <p className={`mt-1.5 text-[11px] ${confirmMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
              {confirmMsg}
            </p>
          )}
        </div>

        {/* React Flow DAG */}
        <div style={{ height: 260 }} className="bg-neutral-950/40">
          {planNodes.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-neutral-700">
              <Zap size={20} className="text-violet-500/30" />
              <p className="text-xs">输入任务描述 → AI 生成 DAG 计划图</p>
              <p className="text-[10px]">悬停节点可提修改意见，AI 实时优化；满意后点"确认执行"</p>
            </div>
          ) : (
            <ReactFlow
              nodes={rfNodes}
              edges={rfEdges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.3 }}
              minZoom={0.4}
              maxZoom={2}
              proOptions={{ hideAttribution: true }}
            >
              <Background color="#2a2a2a" variant={BackgroundVariant.Dots} gap={20} size={1} />
              <Controls showInteractive={false} style={{ bottom: 8, right: 8, left: 'auto', top: 'auto' }} />
            </ReactFlow>
          )}
        </div>
      </div>

      {/* ══ 冲突处理 ════════════════════════════════════════════════════════ */}
      {conflicts.length > 0 ? (
        <div className="rounded-xl border border-red-500/20 bg-neutral-900 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-red-500/15">
            <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            <span className="text-xs font-semibold text-neutral-200">冲突处理</span>
            <span className="text-[10px] bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded">{conflicts.length} 个待决策</span>
          </div>
          <div className="flex flex-col gap-2 p-3">
            {conflicts.map(c => (
              <div key={c.id} className="rounded-lg bg-red-500/8 border border-red-500/20 p-3">
                <div className="flex items-start gap-2 mb-2.5">
                  <AlertTriangle size={13} className="text-red-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs font-medium text-red-300">{c.title}</div>
                    <div className="text-[11px] text-neutral-400 mt-0.5">{c.description}</div>
                  </div>
                </div>
                <div className="flex gap-2 pl-5 flex-wrap">
                  {c.options.map((opt, i) => (
                    <button key={i} onClick={() => resolveConflict(c.id)}
                      className={`px-3 py-1 rounded-lg text-[11px] font-medium border transition-all
                        ${opt.variant === 'accept' ? 'bg-green-500/15 border-green-500/30 text-green-300 hover:bg-green-500/25' : ''}
                        ${opt.variant === 'retry'  ? 'bg-blue-500/15 border-blue-500/30 text-blue-300 hover:bg-blue-500/25' : ''}
                        ${opt.variant === 'adjust' ? 'bg-yellow-500/15 border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/25' : ''}
                      `}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : localQueue.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-900/50 border border-white/[0.05] text-[11px] text-neutral-700">
          <CheckCircle size={12} className="text-green-700" />
          冲突处理 — 系统运行正常，无冲突
        </div>
      )}

      {/* ══ 局部最优 ════════════════════════════════════════════════════════ */}
      <div className="rounded-xl border border-white/[0.08] bg-neutral-900 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          <span className="text-xs font-semibold text-neutral-200">局部最优</span>
          <span className="text-[10px] text-neutral-600">当前执行队列 — 拖拽调整优先级</span>
          {localQueue.length > 0 && (
            <span className="ml-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300">
              {localQueue.length}
            </span>
          )}
        </div>
        <div className="p-3 min-h-[100px]">
          {queueLoading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-[11px] text-neutral-600">
              <Loader size={13} className="animate-spin" /> 连接 SEAI…
            </div>
          ) : localQueue.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 gap-1.5 text-neutral-700">
              <p className="text-xs">队列为空</p>
              <p className="text-[10px]">确认全局计划后，任务将自动流入此处</p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={localQueue.map(i => i.id)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-1.5">
                  {localQueue.map(item => <SortableRow key={item.id} item={item} onSkip={handleSkip} />)}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>
    </div>
  )
}
