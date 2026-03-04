import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Plus, Trash2, Link, X, Send, Bot, Zap, RefreshCw, ChevronDown } from 'lucide-react'

// ── API ────────────────────────────────────────────────────
const apiFetch = async (path: string, opts?: RequestInit) => {
  const r = await fetch(`/api${path}`, opts)
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`)
  return r.json()
}
const apiPost = (path: string, body: unknown) => apiFetch(path, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
})
const apiPatch = (path: string, body: unknown) => apiFetch(path, {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
})
const apiDelete = (path: string) => apiFetch(path, { method: 'DELETE' })

// ── Types ──────────────────────────────────────────────────
interface Agent {
  id: string
  name: string
  type: string
  model: string | null
  role: string
  description: string | null
  status: 'idle' | 'running' | 'error'
  position_x: number
  position_y: number
  created_at: string
}

interface Relation {
  id: string
  from_agent: string
  to_agent: string
  type: string
  condition: string | null
}

interface AgentMessage {
  id: string
  from_id: string | null
  to_id: string | null
  content: string
  type: string
  created_at: string
}

// ── Constants ──────────────────────────────────────────────
const NODE_W = 160
const NODE_H = 80
const AGENT_TYPES = ['claude_code', 'claude_api', 'tool', 'human', 'scheduler']
const AGENT_ROLES = ['orchestrator', 'worker', 'monitor', 'tool']

const STATUS_COLOR: Record<string, string> = {
  idle: 'bg-slate-500',
  running: 'bg-green-400 animate-pulse',
  error: 'bg-red-500',
}

const RELATION_STYLES: Record<string, {
  stroke: string
  dashArray: string
  arrowId: string
  arrowFill: string
  labelColor: string
  label: string
}> = {
  sequential: {
    stroke: 'rgba(148,163,184,0.5)',
    dashArray: '5,4',
    arrowId: 'arrow-sequential',
    arrowFill: 'rgba(148,163,184,0.7)',
    labelColor: 'text-slate-400',
    label: '顺序',
  },
  parallel: {
    stroke: 'rgba(74,222,128,0.6)',
    dashArray: 'none',
    arrowId: 'arrow-parallel',
    arrowFill: 'rgba(74,222,128,0.8)',
    labelColor: 'text-green-400',
    label: '并行',
  },
  causal: {
    stroke: 'rgba(167,139,250,0.6)',
    dashArray: '2,4',
    arrowId: 'arrow-causal',
    arrowFill: 'rgba(167,139,250,0.8)',
    labelColor: 'text-violet-400',
    label: '因果',
  },
}

const TYPE_ICON: Record<string, string> = {
  claude_code: '🤖',
  claude_api: '⚡',
  tool: '🔧',
  human: '👤',
  scheduler: '⏰',
}

// ── Sub-components ─────────────────────────────────────────

interface CreateAgentModalProps {
  onClose: () => void
  onCreate: (agent: Partial<Agent>) => void
  defaultPos: { x: number; y: number }
}

const CreateAgentModal: React.FC<CreateAgentModalProps> = ({ onClose, onCreate, defaultPos }) => {
  const [form, setForm] = useState({
    name: '',
    type: 'claude_code',
    model: 'claude-sonnet-4-6',
    role: 'worker',
    description: '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    onCreate({
      ...form,
      position_x: defaultPos.x,
      position_y: defaultPos.y,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-96 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold text-lg flex items-center gap-2">
            <Bot size={18} className="text-primary-400" /> 新建 Agent
          </h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-neutral-400 mb-1 block">名称 *</label>
            <input
              autoFocus
              className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-500"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. LifeCore, TaskRunner..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-neutral-400 mb-1 block">类型</label>
              <select
                className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-500"
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              >
                {AGENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-neutral-400 mb-1 block">角色</label>
              <select
                className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-500"
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
              >
                {AGENT_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-neutral-400 mb-1 block">Model</label>
            <input
              className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-500"
              value={form.model}
              onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
              placeholder="claude-sonnet-4-6"
            />
          </div>

          <div>
            <label className="text-xs text-neutral-400 mb-1 block">描述</label>
            <textarea
              className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-500 resize-none"
              rows={2}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="这个 Agent 负责..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-neutral-400 hover:text-white transition-colors">
              取消
            </button>
            <button type="submit"
              className="px-5 py-2 text-sm bg-primary-600 hover:bg-primary-500 text-white rounded-lg font-medium transition-colors">
              创建
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Message Panel ──────────────────────────────────────────
interface MessagePanelProps {
  agent: Agent
  agents: Agent[]
  onClose: () => void
  onDelete: (id: string) => void
  onStatusChange: (id: string, status: string) => void
}

const MessagePanel: React.FC<MessagePanelProps> = ({ agent, agents, onClose, onDelete, onStatusChange }) => {
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [input, setInput] = useState('')
  const [targetId, setTargetId] = useState('')
  const [loading, setLoading] = useState(false)
  const msgsContainerRef = useRef<HTMLDivElement>(null)

  const loadMessages = useCallback(async () => {
    try {
      const data = await apiFetch(`/agents/${agent.id}/messages`)
      setMessages(data.messages || [])
    } catch { /* ignore */ }
  }, [agent.id])

  useEffect(() => {
    loadMessages()
    const t = setInterval(loadMessages, 5000)
    return () => clearInterval(t)
  }, [loadMessages])

  useEffect(() => {
    const el = msgsContainerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim()) return
    setLoading(true)
    try {
      await apiPost('/agents/messages', {
        from_id: null,
        to_id: targetId || agent.id,
        content: input.trim(),
        type: 'message'
      })
      setInput('')
      await loadMessages()
    } catch { /* ignore */ }
    setLoading(false)
  }

  const getAgentName = (id: string | null) => {
    if (!id) return '系统'
    return agents.find(a => a.id === id)?.name || id.slice(0, 8)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{TYPE_ICON[agent.type] || '🤖'}</span>
          <div>
            <div className="text-white font-semibold">{agent.name}</div>
            <div className="text-xs text-neutral-400">{agent.type} · {agent.role}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Status selector */}
          <div className="relative group">
            <button className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-800 text-xs text-neutral-300 hover:bg-slate-700 transition-colors">
              <span className={`w-2 h-2 rounded-full ${STATUS_COLOR[agent.status]}`} />
              {agent.status}
              <ChevronDown size={12} />
            </button>
            <div className="absolute right-0 top-full mt-1 bg-slate-800 border border-white/10 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all z-10">
              {['idle', 'running', 'error'].map(s => (
                <button key={s} onClick={() => onStatusChange(agent.id, s)}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-neutral-300 hover:bg-slate-700 transition-colors first:rounded-t-lg last:rounded-b-lg">
                  <span className={`w-2 h-2 rounded-full ${STATUS_COLOR[s]}`} />
                  {s}
                </button>
              ))}
            </div>
          </div>
          <button onClick={() => { if (confirm(`删除 Agent "${agent.name}"?`)) onDelete(agent.id) }}
            className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors">
            <Trash2 size={14} />
          </button>
          <button onClick={onClose} className="p-1.5 text-neutral-400 hover:text-white rounded transition-colors">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Info */}
      {agent.description && (
        <div className="px-4 py-2 bg-slate-800/50 text-xs text-neutral-400 border-b border-white/5">
          {agent.description}
        </div>
      )}
      {agent.model && (
        <div className="px-4 py-2 bg-slate-800/30 text-xs text-neutral-500 border-b border-white/5 flex items-center gap-1">
          <Zap size={11} /> {agent.model}
        </div>
      )}

      {/* Messages */}
      <div ref={msgsContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="text-center text-neutral-500 text-sm py-8">暂无消息记录</div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`flex flex-col gap-1 ${msg.to_id === agent.id ? 'items-end' : 'items-start'}`}>
            <div className="text-xs text-neutral-500">
              {getAgentName(msg.from_id)} → {getAgentName(msg.to_id)}
            </div>
            <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
              msg.to_id === agent.id
                ? 'bg-primary-600/30 border border-primary-500/20 text-neutral-200'
                : 'bg-slate-700/50 border border-white/5 text-neutral-300'
            }`}>
              {msg.content}
            </div>
            <div className="text-xs text-neutral-600">
              {new Date(msg.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ))}
      </div>

      {/* Send */}
      <div className="p-4 border-t border-white/10 space-y-2">
        <select
          className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-neutral-300 focus:outline-none"
          value={targetId}
          onChange={e => setTargetId(e.target.value)}
        >
          <option value={agent.id}>→ 发送给 {agent.name}</option>
          {agents.filter(a => a.id !== agent.id).map(a => (
            <option key={a.id} value={a.id}>→ 发送给 {a.name}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <input
            className="flex-1 bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-primary-500"
            placeholder="输入消息..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          />
          <button onClick={sendMessage} disabled={loading || !input.trim()}
            className="px-3 py-2 bg-primary-600 hover:bg-primary-500 disabled:opacity-40 text-white rounded-lg transition-colors">
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main View ──────────────────────────────────────────────
const AgentsView: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([])
  const [relations, setRelations] = useState<Relation[]>([])
  const [selected, setSelected] = useState<Agent | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [linkMode, setLinkMode] = useState(false)
  const [linkFrom, setLinkFrom] = useState<string | null>(null)
  const [linkTo, setLinkTo] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Drag state (not in React state to avoid re-renders during drag)
  const dragRef = useRef<{ id: string; startX: number; startY: number; ox: number; oy: number } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  // Local position overrides during drag (avoids DB round-trip lag)
  const [localPos, setLocalPos] = useState<Record<string, { x: number; y: number }>>({})

  const load = useCallback(async () => {
    try {
      const [ad, rd] = await Promise.all([
        apiFetch('/agents'),
        apiFetch('/agents/relations'),
      ])
      setAgents(ad.agents || [])
      setRelations(rd.relations || [])
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── Drag handlers ──
  const getPos = (agent: Agent) => ({
    x: localPos[agent.id]?.x ?? agent.position_x,
    y: localPos[agent.id]?.y ?? agent.position_y,
  })

  const onNodeMouseDown = (e: React.MouseEvent, agentId: string) => {
    if (linkMode) return // in link mode, click = select for linking
    e.stopPropagation()
    const agent = agents.find(a => a.id === agentId)
    if (!agent) return
    dragRef.current = {
      id: agentId,
      startX: e.clientX,
      startY: e.clientY,
      ox: localPos[agentId]?.x ?? agent.position_x,
      oy: localPos[agentId]?.y ?? agent.position_y,
    }
    const onMove = (me: MouseEvent) => {
      if (!dragRef.current) return
      const dx = me.clientX - dragRef.current.startX
      const dy = me.clientY - dragRef.current.startY
      setLocalPos(p => ({
        ...p,
        [dragRef.current!.id]: {
          x: Math.max(0, dragRef.current!.ox + dx),
          y: Math.max(0, dragRef.current!.oy + dy),
        }
      }))
    }
    const onUp = async (me: MouseEvent) => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      if (!dragRef.current) return
      const dx = me.clientX - dragRef.current.startX
      const dy = me.clientY - dragRef.current.startY
      const nx = Math.max(0, dragRef.current.ox + dx)
      const ny = Math.max(0, dragRef.current.oy + dy)
      const id = dragRef.current.id
      dragRef.current = null
      // persist
      await apiPatch(`/agents/${id}`, { position_x: nx, position_y: ny }).catch(() => {})
      setAgents(prev => prev.map(a => a.id === id ? { ...a, position_x: nx, position_y: ny } : a))
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // ── Link mode click ──
  const onNodeClick = (e: React.MouseEvent, agentId: string) => {
    e.stopPropagation()
    if (!linkMode) {
      setSelected(agents.find(a => a.id === agentId) || null)
      return
    }
    if (!linkFrom) {
      setLinkFrom(agentId)
    } else if (linkFrom !== agentId) {
      // Show type selection popup
      setLinkTo(agentId)
    }
  }

  // ── Create relation with chosen type ──
  const handleCreateRelation = (type: string) => {
    if (!linkFrom || !linkTo) return
    apiPost('/agents/relations', { from_agent: linkFrom, to_agent: linkTo, type })
      .then(() => { load(); setLinkFrom(null); setLinkTo(null); setLinkMode(false) })
      .catch(() => { setLinkFrom(null); setLinkTo(null) })
  }

  // ── Create agent ──
  const handleCreate = async (data: Partial<Agent>) => {
    setShowCreate(false)
    try {
      await apiPost('/agents', data)
      await load()
    } catch { /* ignore */ }
  }

  // ── Delete agent ──
  const handleDelete = async (id: string) => {
    setSelected(null)
    await apiDelete(`/agents/${id}`).catch(() => {})
    await load()
  }

  // ── Delete relation ──
  const handleDeleteRelation = async (relId: string) => {
    await apiDelete(`/agents/relations/${relId}`).catch(() => {})
    await load()
  }

  // ── Status change ──
  const handleStatusChange = async (id: string, status: string) => {
    await apiPatch(`/agents/${id}`, { status }).catch(() => {})
    setAgents(prev => prev.map(a => a.id === id ? { ...a, status: status as Agent['status'] } : a))
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, status: status as Agent['status'] } : null)
  }

  // ── Edge path ──
  const getEdgePath = (rel: Relation) => {
    const from = agents.find(a => a.id === rel.from_agent)
    const to   = agents.find(a => a.id === rel.to_agent)
    if (!from || !to) return null
    const fx = (localPos[from.id]?.x ?? from.position_x) + NODE_W
    const fy = (localPos[from.id]?.y ?? from.position_y) + NODE_H / 2
    const tx = (localPos[to.id]?.x   ?? to.position_x)
    const ty = (localPos[to.id]?.y   ?? to.position_y) + NODE_H / 2
    const cx = (fx + tx) / 2
    const style = RELATION_STYLES[rel.type] ?? RELATION_STYLES.sequential
    return { d: `M ${fx} ${fy} C ${cx} ${fy}, ${cx} ${ty}, ${tx} ${ty}`, rel, style }
  }

  // Canvas click = deselect
  const onCanvasClick = () => {
    if (linkMode && (linkFrom || linkTo)) { setLinkFrom(null); setLinkTo(null); return }
    setSelected(null)
  }

  const defaultCreatePos = { x: 60 + agents.length * 20, y: 60 + agents.length * 20 }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex h-full" style={{ height: 'calc(100vh - 120px)' }}>
      {/* ── Canvas ── */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center gap-2 p-3 border-b border-white/10 bg-black/20">
          <span className="text-white font-semibold text-sm mr-2">Agent 网络图</span>

          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-500 text-white text-xs rounded-lg font-medium transition-colors">
            <Plus size={13} /> 新建 Agent
          </button>

          <button
            onClick={() => { setLinkMode(!linkMode); setLinkFrom(null) }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
              linkMode
                ? 'bg-amber-500 text-black'
                : 'bg-slate-700 hover:bg-slate-600 text-neutral-300'
            }`}>
            <Link size={13} /> {linkMode ? (linkFrom ? '选择目标节点' : '选择源节点') : '连接节点'}
          </button>

          <button onClick={load}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-neutral-300 text-xs rounded-lg transition-colors">
            <RefreshCw size={13} /> 刷新
          </button>

          {agents.length === 0 && (
            <span className="ml-2 text-xs text-neutral-500">点击「新建 Agent」开始构建你的 Agent 网络</span>
          )}
        </div>

        {/* SVG Canvas */}
        <div className="flex-1 overflow-hidden relative bg-slate-950"
          style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)', backgroundSize: '28px 28px' }}>
          <svg
            ref={svgRef}
            width="100%" height="100%"
            className="select-none"
            onClick={onCanvasClick}
          >
            <defs>
              <marker id="arrow-sequential" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                <path d="M 0 0 L 8 3 L 0 6 Z" fill="rgba(148,163,184,0.7)" />
              </marker>
              <marker id="arrow-parallel" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                <path d="M 0 0 L 8 3 L 0 6 Z" fill="rgba(74,222,128,0.8)" />
              </marker>
              <marker id="arrow-causal" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                <path d="M 0 0 L 8 3 L 0 6 Z" fill="rgba(167,139,250,0.8)" />
              </marker>
            </defs>

            {/* Edges */}
            {relations.map(rel => {
              const edge = getEdgePath(rel)
              if (!edge) return null
              return (
                <g key={rel.id}>
                  <path
                    d={edge.d}
                    fill="none"
                    stroke={edge.style.stroke}
                    strokeWidth="1.5"
                    strokeDasharray={edge.style.dashArray === 'none' ? undefined : edge.style.dashArray}
                    markerEnd={`url(#${edge.style.arrowId})`}
                  />
                  {/* delete hit area */}
                  <path
                    d={edge.d}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="12"
                    className="cursor-pointer"
                    onClick={e => { e.stopPropagation(); if (confirm('删除此连接?')) handleDeleteRelation(rel.id) }}
                  />
                </g>
              )
            })}

            {/* Nodes */}
            {agents.map(agent => {
              const pos = getPos(agent)
              const isSelected = selected?.id === agent.id
              const isLinkSrc = linkFrom === agent.id
              return (
                <g
                  key={agent.id}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  style={{ cursor: linkMode ? 'pointer' : 'grab' }}
                  onMouseDown={e => onNodeMouseDown(e, agent.id)}
                  onClick={e => onNodeClick(e, agent.id)}
                >
                  {/* Shadow */}
                  <rect x="2" y="4" width={NODE_W} height={NODE_H} rx="12" fill="rgba(0,0,0,0.4)" />

                  {/* Card */}
                  <rect
                    width={NODE_W} height={NODE_H} rx="12"
                    fill={isSelected ? 'rgba(99,102,241,0.25)' : 'rgba(30,41,59,0.95)'}
                    stroke={isLinkSrc ? '#f59e0b' : isSelected ? '#6366f1' : 'rgba(255,255,255,0.08)'}
                    strokeWidth={isSelected || isLinkSrc ? 2 : 1}
                  />

                  {/* Status dot */}
                  <circle
                    cx={NODE_W - 16} cy={14} r={5}
                    fill={agent.status === 'running' ? '#4ade80' : agent.status === 'error' ? '#f87171' : '#475569'}
                  />

                  {/* Icon */}
                  <text x="14" y="30" fontSize="18" dominantBaseline="middle">{TYPE_ICON[agent.type] || '🤖'}</text>

                  {/* Name */}
                  <text x="38" y="26" fill="white" fontSize="12" fontWeight="600" className="font-medium">
                    {agent.name.length > 14 ? agent.name.slice(0, 13) + '…' : agent.name}
                  </text>

                  {/* Role */}
                  <text x="38" y="42" fill="rgba(148,163,184,0.8)" fontSize="10">
                    {agent.role}
                  </text>

                  {/* Model tag */}
                  {agent.model && (
                    <text x="14" y="65" fill="rgba(148,163,184,0.5)" fontSize="9">
                      {agent.model.length > 20 ? agent.model.slice(0, 19) + '…' : agent.model}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>

          {/* Empty state overlay */}
          {agents.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <div className="text-5xl mb-4 opacity-30">🤖</div>
                <p className="text-neutral-500 text-sm">
                  还没有 Agent，点击工具栏「新建 Agent」开始
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Right Panel ── */}
      {selected && (
        <div className="w-80 border-l border-white/10 bg-slate-900/80 flex flex-col min-h-0">
          <MessagePanel
            agent={selected}
            agents={agents}
            onClose={() => setSelected(null)}
            onDelete={handleDelete}
            onStatusChange={handleStatusChange}
          />
        </div>
      )}

      {/* ── Relation list (footer) ── */}
      {relations.length > 0 && !selected && (
        <div className="absolute bottom-4 right-4 bg-slate-900/90 border border-white/10 rounded-xl p-3 text-xs text-neutral-400 max-w-xs">
          <div className="font-medium text-neutral-300 mb-2">连接关系 ({relations.length})</div>
          {relations.slice(0, 5).map(r => {
            const from = agents.find(a => a.id === r.from_agent)?.name || '?'
            const to = agents.find(a => a.id === r.to_agent)?.name || '?'
            const relStyle = RELATION_STYLES[r.type] ?? RELATION_STYLES.sequential
            return (
              <div key={r.id} className="flex items-center gap-2 py-0.5">
                <span className="text-neutral-300">{from}</span>
                <span className="text-neutral-500">→</span>
                <span className="text-neutral-300">{to}</span>
                <span className={`text-xs ${relStyle.labelColor}`}>[{relStyle.label}]</span>
                <button onClick={() => { if (confirm('删除?')) handleDeleteRelation(r.id) }}
                  className="ml-auto text-red-400/60 hover:text-red-400">
                  <X size={11} />
                </button>
              </div>
            )
          })}
          {relations.length > 5 && <div className="text-neutral-600 mt-1">+{relations.length - 5} 更多...</div>}
        </div>
      )}

      {showCreate && (
        <CreateAgentModal
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
          defaultPos={defaultCreatePos}
        />
      )}

      {/* ── Relation type selection popup ── */}
      {linkTo && linkFrom && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-5 w-72 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold text-sm">选择连接类型</h3>
              <button onClick={() => { setLinkTo(null); setLinkFrom(null) }} className="text-neutral-400 hover:text-white">
                <X size={15} />
              </button>
            </div>
            <div className="text-xs text-neutral-500 mb-4">
              {agents.find(a => a.id === linkFrom)?.name} → {agents.find(a => a.id === linkTo)?.name}
            </div>
            <div className="space-y-2">
              {(['sequential', 'parallel', 'causal'] as const).map(type => {
                const s = RELATION_STYLES[type]
                return (
                  <button
                    key={type}
                    onClick={() => handleCreateRelation(type)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/5 transition-colors text-left">
                    <svg width="32" height="10">
                      <line x1="0" y1="5" x2="28" y2="5"
                        stroke={s.arrowFill}
                        strokeWidth="1.5"
                        strokeDasharray={s.dashArray === 'none' ? undefined : s.dashArray}
                      />
                      <polygon points="24,2 32,5 24,8" fill={s.arrowFill} />
                    </svg>
                    <div>
                      <div className={`text-sm font-medium ${s.labelColor}`}>{s.label}</div>
                      <div className="text-xs text-neutral-500">{type}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AgentsView
