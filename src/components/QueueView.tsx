import React, { useEffect, useState, useCallback } from 'react'
import { Plus, Trash2, RefreshCw, ArrowDown, ArrowUp, Cpu } from 'lucide-react'
import { queueApi, QueueItem, Preconditions } from '../lib/queue-api'

const SEAI = '/seai'

// ── 类型 ─────────────────────────────────────────────────────────────────────

interface ControllerStatus {
  is_running: boolean
  active_tasks: string[]
  active_count: number
  pending_count: number
  running_count: number
  poll_interval: number
  last_poll_at: string | null
}

interface TrajectoryEvent {
  id: string
  task_id: string
  node_kind: string
  status: string
  started_at: string | null
  ended_at: string | null
  cost_vector: { token_input?: number; token_output?: number; time_ms?: number } | string
  reward: number | null
  error_info: string | null
}

interface TagNode {
  id: string
  name: string
  color: string
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function fetchStatus(): Promise<ControllerStatus> {
  const r = await fetch(`${SEAI}/state-ctrl/status`)
  return r.json()
}

async function fetchEvents(task_ref_id?: string): Promise<TrajectoryEvent[]> {
  const qs = task_ref_id ? `?task_ref_id=${task_ref_id}&limit=20` : '?limit=20'
  const r = await fetch(`${SEAI}/state-ctrl/events${qs}`)
  return r.json()
}

async function fetchSmTags(): Promise<TagNode[]> {
  const r = await fetch('/api/tags')
  const all: TagNode[] = await r.json()
  return all.filter(t => t.id.startsWith('tag-s-n-sm-') && t.id !== 'tag-s-n-sm')
}

// ── 小组件 ────────────────────────────────────────────────────────────────────

function Dot({ ok, pulse }: { ok: boolean; pulse?: boolean }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${ok ? 'bg-green-400' : 'bg-red-400'} ${pulse ? 'animate-pulse' : ''}`} />
  )
}

function PrecondRow({ data }: { data: Preconditions | null }) {
  if (!data) return <span className="text-xs text-neutral-500 animate-pulse">检查中…</span>
  const items = [
    { key: 'environment', label: '环境' },
    { key: 'goals',       label: '目标' },
    { key: 'nodes',       label: '执行节点' },
    { key: 'cognition',   label: '认知' },
  ]
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {items.map(({ key, label }) => {
        const item = data[key as keyof Preconditions] as { ok: boolean }
        return (
          <span key={key} className="flex items-center gap-1 text-xs">
            <Dot ok={item.ok} />
            <span className={item.ok ? 'text-neutral-300' : 'text-red-400'}>{label}</span>
          </span>
        )
      })}
    </div>
  )
}

function VBadge({ score }: { score: number | null }) {
  if (score === null) return null
  const color = score >= 0.7 ? 'text-green-400 bg-green-400/10' : 'text-yellow-400 bg-yellow-400/10'
  return (
    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${color}`}>
      V={score.toFixed(2)}
    </span>
  )
}

function CostBadge({ cost }: { cost: string | null }) {
  if (!cost) return null
  let c: Record<string, number> = {}
  try { c = typeof cost === 'string' ? JSON.parse(cost) : cost } catch { return null }
  const tokens = (c.token_input ?? 0) + (c.token_output ?? 0)
  if (!tokens) return null
  return (
    <span className="text-[10px] font-mono text-neutral-500 px-1 py-0.5 rounded bg-neutral-800">
      {tokens.toLocaleString()} tok
    </span>
  )
}

function StateTags({ tags, tagMap }: { tags: string[] | string; tagMap: Record<string, TagNode> }) {
  let ids: string[] = []
  try { ids = typeof tags === 'string' ? JSON.parse(tags) : tags } catch { ids = [] }
  if (!ids.length) return null
  return (
    <span className="flex gap-1 flex-wrap">
      {ids.map(id => {
        const t = tagMap[id]
        if (!t) return null
        return (
          <span key={id} className="text-[10px] px-1.5 py-0.5 rounded-full border" style={{ borderColor: t.color, color: t.color }}>
            {t.name}
          </span>
        )
      })}
    </span>
  )
}

const STATE_STYLE: Record<string, string> = {
  pending: 'border-neutral-600 text-neutral-400',
  running: 'border-blue-500 text-blue-300 shadow-blue-500/20 shadow-sm',
  done:    'border-green-600 text-green-300',
  failed:  'border-red-600 text-red-400',
  blocked: 'border-yellow-600 text-yellow-300',
}

const STATE_ZH: Record<string, string> = {
  pending: '待执行', running: '执行中', done: '完成', failed: '失败', blocked: '阻塞',
}

// ── Task 链路横向可视化 ────────────────────────────────────────────────────────

function TaskChain({ items, tagMap, onSelect, selected }: {
  items: QueueItem[]
  tagMap: Record<string, TagNode>
  onSelect: (id: string) => void
  selected: string | null
}) {
  if (!items.length) return (
    <div className="text-xs text-neutral-600 py-4 text-center">队列为空</div>
  )

  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))

  return (
    <div className="flex items-start gap-0 overflow-x-auto pb-2">
      {sorted.map((item, idx) => (
        <React.Fragment key={item.id}>
          {/* 连接线 */}
          {idx > 0 && (
            <div className="flex items-center shrink-0 mt-5">
              <div className={`h-px w-6 ${item.state === 'running' ? 'bg-blue-500' : 'bg-neutral-700'}`} />
              <div className={`w-0 h-0 border-t-4 border-b-4 border-l-4 border-transparent ${item.state === 'running' ? 'border-l-blue-500' : 'border-l-neutral-700'}`} />
            </div>
          )}

          {/* 节点卡片 */}
          <button
            onClick={() => onSelect(item.id === selected ? '' : item.id)}
            className={`shrink-0 w-44 rounded-lg border p-2.5 text-left transition-all cursor-pointer hover:brightness-110 ${STATE_STYLE[item.state] ?? STATE_STYLE.pending} ${selected === item.id ? 'ring-1 ring-white/20' : ''}`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono opacity-70">{STATE_ZH[item.state]}</span>
              {item.state === 'running' && <Dot ok pulse />}
              {item.state === 'done'    && <span className="text-[10px] text-green-400">✓</span>}
              {item.state === 'failed'  && <span className="text-[10px] text-red-400">✗</span>}
            </div>
            <p className="text-xs text-white line-clamp-2 leading-snug mb-1.5">{item.description}</p>
            <div className="flex flex-wrap gap-1">
              <VBadge score={item.v_score} />
              <CostBadge cost={item.resource_cost ?? null} />
            </div>
            {item.state_tags && (
              <div className="mt-1">
                <StateTags tags={item.state_tags} tagMap={tagMap} />
              </div>
            )}
          </button>
        </React.Fragment>
      ))}
    </div>
  )
}

// ── Bottom-Up 事件卡片 ────────────────────────────────────────────────────────

function EventCard({ ev }: { ev: TrajectoryEvent }) {
  const cost = typeof ev.cost_vector === 'string'
    ? (() => { try { return JSON.parse(ev.cost_vector) } catch { return {} } })()
    : (ev.cost_vector ?? {})
  const tokens = (cost.token_input ?? 0) + (cost.token_output ?? 0)

  const statusColor = ev.status === 'success' ? 'text-green-400' : ev.status === 'failed' ? 'text-red-400' : 'text-blue-400'

  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-neutral-800 last:border-0">
      <span className={`text-[10px] font-mono shrink-0 mt-0.5 ${statusColor}`}>{ev.status}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-neutral-300 font-mono">{ev.node_kind}</span>
          {tokens > 0 && <span className="text-[10px] text-neutral-500 font-mono">{tokens} tok</span>}
          {ev.reward !== null && <span className="text-[10px] text-primary-400 font-mono">r={ev.reward}</span>}
        </div>
        {ev.error_info && <p className="text-[10px] text-red-400 mt-0.5 truncate">{ev.error_info}</p>}
        <p className="text-[10px] text-neutral-600 mt-0.5">{ev.started_at?.slice(11, 19)}</p>
      </div>
    </div>
  )
}

// ── 主视图 ────────────────────────────────────────────────────────────────────

export default function QueueView() {
  const [items, setItems]       = useState<QueueItem[]>([])
  const [status, setStatus]     = useState<ControllerStatus | null>(null)
  const [precond, setPrecond]   = useState<Preconditions | null>(null)
  const [events, setEvents]     = useState<TrajectoryEvent[]>([])
  const [tagMap, setTagMap]     = useState<Record<string, TagNode>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const [showAdd, setShowAdd]   = useState(false)
  const [loading, setLoading]   = useState(false)

  // 新任务表单状态
  const [desc, setDesc]         = useState('')
  const [passCond, setPassCond] = useState('')
  const [adding, setAdding]     = useState(false)

  const selectedItem = selected ? items.find(i => i.id === selected) : null

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [list, st, pre, evts] = await Promise.all([
        queueApi.list(),
        fetchStatus().catch(() => null),
        queueApi.preconditions().catch(() => null),
        fetchEvents(selectedItem?.task_ref_id ?? undefined),
      ])
      setItems(list)
      if (st)  setStatus(st)
      if (pre) setPrecond(pre)
      setEvents(evts)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [selectedItem?.task_ref_id])

  // 初始化 + 加载 SM 标签
  useEffect(() => {
    fetchSmTags().then(tags => {
      const m: Record<string, TagNode> = {}
      tags.forEach(t => { m[t.id] = t })
      setTagMap(m)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 6000)
    return () => clearInterval(t)
  }, [load])

  // 切换选中任务时重新拉 events
  useEffect(() => {
    if (selected) {
      const item = items.find(i => i.id === selected)
      fetchEvents(item?.task_ref_id ?? undefined).then(setEvents).catch(() => {})
    }
  }, [selected, items])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!desc.trim()) return
    setAdding(true)
    try {
      await queueApi.create(desc.trim(), passCond ? { pass_condition: passCond } : {})
      setDesc(''); setPassCond(''); setShowAdd(false)
      load()
    } finally { setAdding(false) }
  }

  async function handleDelete(id: string) {
    await queueApi.delete(id)
    if (selected === id) setSelected(null)
    load()
  }

  const secondsAgo = status?.last_poll_at
    ? Math.round((Date.now() - new Date(status.last_poll_at).getTime()) / 1000)
    : null

  return (
    <div className="flex flex-col h-full overflow-hidden bg-neutral-900 text-white">

      {/* ── 顶部：控制器状态 + 前提条件 ── */}
      <div className="shrink-0 border-b border-neutral-800 px-6 py-3 space-y-2">
        {/* 控制器状态栏 */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Cpu size={14} className="text-orange-400" />
            <span className="text-sm font-medium text-orange-300">状态控制器</span>
            {status ? (
              <span className="flex items-center gap-1.5 text-xs">
                <Dot ok={status.is_running} pulse={status.is_running} />
                <span className={status.is_running ? 'text-green-300' : 'text-neutral-500'}>
                  {status.is_running ? '运行中' : '已停止'}
                </span>
              </span>
            ) : (
              <span className="text-xs text-neutral-600">连接中…</span>
            )}
            {status && (
              <span className="text-xs text-neutral-500">
                活跃 {status.active_count}  |  待执行 {status.pending_count}  |  轮询 {status.poll_interval}s
                {secondsAgo !== null && `  |  ${secondsAgo}s 前`}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAdd(v => !v)}
              className="flex items-center gap-1 px-2.5 py-1 bg-orange-600/80 hover:bg-orange-500 rounded text-xs transition-colors"
            >
              <Plus size={12} /> 新任务
            </button>
            <button onClick={load} disabled={loading} className="p-1.5 text-neutral-500 hover:text-white disabled:opacity-30">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* 前提条件 */}
        <PrecondRow data={precond} />

        {/* 新任务表单 */}
        {showAdd && (
          <form onSubmit={handleAdd} className="space-y-2 pt-1">
            <textarea
              value={desc} onChange={e => setDesc(e.target.value)}
              placeholder="任务描述（机器执行指令）" rows={2}
              className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 resize-none focus:outline-none focus:border-orange-500"
            />
            <div className="flex gap-2">
              <input
                value={passCond} onChange={e => setPassCond(e.target.value)}
                placeholder="通过条件（V criteria，可选）"
                className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-orange-500"
              />
              <button type="submit" disabled={!desc.trim() || adding}
                className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 rounded text-xs text-white transition-colors">
                加入队列
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ── Task 链路 ── */}
      <div className="shrink-0 border-b border-neutral-800 px-6 py-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">任务链路</span>
          <span className="text-[10px] text-neutral-600">按 sort_order 顺序执行</span>
        </div>
        <TaskChain items={items} tagMap={tagMap} onSelect={setSelected} selected={selected} />
      </div>

      {/* ── 双泳道 ── */}
      <div className="flex-1 overflow-hidden flex divide-x divide-neutral-800 min-h-0">

        {/* 自顶向下 Top-Down */}
        <div className="w-1/2 overflow-y-auto px-5 py-4 space-y-3">
          <div className="flex items-center gap-1.5 mb-2">
            <ArrowDown size={12} className="text-blue-400" />
            <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider">自顶向下 Top-Down</span>
            <span className="text-[10px] text-neutral-600">控制器 → 执行节点</span>
          </div>

          {items.filter(i => ['pending', 'running', 'blocked'].includes(i.state))
            .sort((a, b) => a.sort_order - b.sort_order)
            .map(item => (
              <div
                key={item.id}
                onClick={() => setSelected(item.id === selected ? null : item.id)}
                className={`rounded-lg border p-3 cursor-pointer transition-all hover:brightness-110 space-y-1.5 ${STATE_STYLE[item.state] ?? STATE_STYLE.pending} ${selected === item.id ? 'ring-1 ring-white/20' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-neutral-400">{STATE_ZH[item.state]}</span>
                  {item.state === 'running' && <Dot ok pulse />}
                </div>
                <p className="text-xs text-white leading-snug">{item.description}</p>

                {/* V criteria */}
                {item.v_criteria && Object.keys(item.v_criteria).length > 0 && (
                  <p className="text-[10px] text-neutral-500">
                    通过条件：{(item.v_criteria as any).pass_condition}
                  </p>
                )}

                <div className="flex items-center gap-1.5 flex-wrap">
                  {item.assigned_node && (
                    <span className="text-[10px] font-mono text-neutral-500">{item.assigned_node}</span>
                  )}
                  <StateTags tags={item.state_tags ?? '[]'} tagMap={tagMap} />
                </div>

                {/* 删除按钮（仅 pending） */}
                {item.state === 'pending' && (
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(item.id) }}
                    className="text-[10px] text-neutral-600 hover:text-red-400 flex items-center gap-0.5"
                  >
                    <Trash2 size={10} /> 移除
                  </button>
                )}
              </div>
            ))}

          {items.filter(i => ['pending', 'running', 'blocked'].includes(i.state)).length === 0 && (
            <p className="text-xs text-neutral-600 text-center py-8">无待执行任务</p>
          )}
        </div>

        {/* 自底向上 Bottom-Up */}
        <div className="w-1/2 overflow-y-auto px-5 py-4">
          <div className="flex items-center gap-1.5 mb-2">
            <ArrowUp size={12} className="text-green-400" />
            <span className="text-[10px] font-semibold text-green-400 uppercase tracking-wider">自底向上 Bottom-Up</span>
            <span className="text-[10px] text-neutral-600">
              {selected ? `${selectedItem?.description?.slice(0, 20)}…` : '执行节点 → 控制器'}
            </span>
          </div>

          {/* 历史完成任务的 V + cost 汇总 */}
          {items.filter(i => i.state === 'done' || i.state === 'failed').length > 0 && (
            <div className="mb-3 space-y-1.5">
              {items.filter(i => ['done', 'failed'].includes(i.state))
                .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))
                .map(item => (
                  <div
                    key={item.id}
                    onClick={() => setSelected(item.id === selected ? null : item.id)}
                    className={`rounded border p-2.5 cursor-pointer text-xs hover:brightness-110 ${STATE_STYLE[item.state]}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-neutral-300 line-clamp-1">{item.description}</span>
                      <span className={`text-[10px] ${item.state === 'done' ? 'text-green-400' : 'text-red-400'}`}>
                        {item.state === 'done' ? '✓' : '✗'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <VBadge score={item.v_score} />
                      <CostBadge cost={item.resource_cost ?? null} />
                      <StateTags tags={item.state_tags ?? '[]'} tagMap={tagMap} />
                    </div>
                    {item.error_msg && (
                      <p className="text-[10px] text-red-400 mt-1 truncate">{item.error_msg}</p>
                    )}
                  </div>
                ))}
            </div>
          )}

          {/* Trajectory 事件流 */}
          <div className="text-[10px] text-neutral-600 mb-1.5">
            {selected ? '执行轨迹' : '最近轨迹'}
          </div>
          {events.length === 0
            ? <p className="text-xs text-neutral-700 text-center py-6">暂无执行记录</p>
            : events.map(ev => <EventCard key={ev.id} ev={ev} />)
          }
        </div>
      </div>
    </div>
  )
}
