/**
 * NodeInteractionPanel — AI Native UI for PRVSE World nodes
 *
 * Clicking any node opens this panel. The panel provides:
 *   1. Node context (name, type, description)
 *   2. Children quick-nav (drill into sub-nodes without leaving L1)
 *   3. Quick actions (ping, health check, task board link, etc.)
 *   4. AI chat — SSE-streamed, system prompt built from node context
 *
 * AI Native flow:
 *   User Intent → AI (理解 + 规划) → 动态响应 / 调用工具 / 执行任务
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { ArrowLeft, X, Send, ChevronRight, Zap, Plus, RefreshCw, Activity, Play, Square, Trash2, Wrench, MessageSquare, CheckCircle, AlertCircle, Loader, GitBranch, Lock } from 'lucide-react'
import { authFetch, getToken } from '@/lib/http'
import type { ControlNode } from '../useControlTree'
import PMessageCard, { type PMessage, nowHHMM } from './PMessageCard'

// ── Types ──────────────────────────────────────────────────────

type ChatMessage = PMessage

interface Props {
  node: ControlNode
  onClose: () => void
  onDrillChild?: (child: ControlNode) => void
  onRuleEstablished?: (nodeId: string, result: { contractId: string; schema: unknown }) => void
  onMutationProposed?: (nodeId: string, schema: unknown) => void
}

// ── Build Mode types ───────────────────────────────────────────

type BuildStep = 0 | 1 | 2 | 3 | 4 | 5  // 描述 → 结构化 → 预览 → 校验 → 待裁决 → 已建立
type BuildStatus = 'idle' | 'working' | 'done' | 'error'

interface ValidationResult {
  valid: boolean
  feedback: string
  issues?: string[]
}

// ── Expand/Commit (发散/收敛) types ────────────────────────────

interface PlanOption {
  title: string
  summary: string
  effort: 'low' | 'medium' | 'high'
  approach: string
}

type ExpandStatus = 'idle' | 'working' | 'options' | 'committing' | 'committed'

// ── System prompt builder ──────────────────────────────────────

const MODEL_DISPLAY: Record<string, string> = {
  'claude-sonnet-4-6': 'Claude Sonnet 4.6',
  'claude-opus-4-6':   'Claude Opus 4.6',
}

function buildSystemPrompt(node: ControlNode, t2Model?: string): string {
  const meta = node.meta ?? {}
  const type = meta.type as string
  const name = node.name
  const desc = (meta.desc as string) ?? ''

  if (type === 'resource-tier') {
    const tier = meta.tier as string
    if (tier === 'T0') {
      return `你是 SEAI 本地模型（零延迟，离线可用），运行在 Egonetics PRVSE 控制体系中。保持简洁专业，结果导向。当前状态：${desc}`
    }
    if (tier === 'T1') {
      return `你是 MiniMax 云端模型（高并发，兼容 Anthropic 协议），运行在 Egonetics PRVSE 控制体系中。保持简洁专业，结果导向。当前状态：${desc}`
    }
    // T2 Claude — 明确告知模型版本，避免自我认知偏差
    const displayName = t2Model ? (MODEL_DISPLAY[t2Model] ?? t2Model) : 'Claude Sonnet 4.6'
    return `你是 ${displayName}，由 Anthropic 开发，运行在 Egonetics PRVSE 控制体系中作为 T2 顶级专家模型。你的模型 ID 是 ${t2Model ?? 'claude-sonnet-4-6'}。当被问及版本或身份时，请如实回答。保持简洁专业，结果导向。当前状态：${desc}`
  }

  if (type === 'principle') {
    return `你是 Egonetics 宪法分析助手。当前原则：「${name}」。帮用户理解该原则的含义、边界条件和具体场景应用。保持严谨，多举实例。`
  }

  if (type === 'cybernetics' || (type === 'dimension' && name === '宪法')) {
    return `你是 Egonetics 控制论系统助手，当前节点：「${name}」。描述：${desc}。诊断系统状态，分析违规，提供改进建议。基于 PRVSE 控制论框架回答。`
  }

  if (node.id === 'dim-goals' || type === 'task') {
    return `你是 Egonetics 目标管理助手，节点：「${name}」。帮用户查看、拆解、创建、更新目标和任务。回答具体可操作，可以给出结构化任务清单。`
  }

  if (type === 'machine') {
    const machineType = meta.machineType as string
    return `你是 Egonetics 设备助手，当前设备：「${name}」（${machineType}）。${desc}。帮用户了解设备状态、连接情况和最佳使用策略。`
  }

  if (type === 'comm-node') {
    return `你是 Egonetics 通信助手，节点：「${name}」。${desc}。帮用户分析消息流量、队列积压情况，以及通信架构优化建议。`
  }

  if (type === 'resource-group') {
    return `你是 Egonetics 资源管理助手，节点：「${name}」。${desc}。帮用户理解资源分配策略、容量规划和调度决策。`
  }

  return `你是 Egonetics AI 助手，当前节点：「${name}」。${desc ? `背景：${desc}。` : ''}基于 PRVSE 控制论框架（意图→感知→反馈→约束→执行），帮用户理解和操作该节点。`
}

function getInputPlaceholder(node: ControlNode): string {
  const meta = node.meta ?? {}
  const type = meta.type as string
  const tier = meta.tier as string | undefined

  if (type === 'resource-tier') {
    if (tier === 'T0') return 'SEAI 本地模型在线，输入你的问题...'
    if (tier === 'T1') return 'MiniMax 就绪，输入你的问题...'
    return 'Claude 就绪，输入你的问题...'
  }
  if (type === 'principle') return '输入具体场景，AI 分析该原则的应用...'
  if (type === 'task' || node.id === 'dim-goals') return '描述目标，AI 帮你拆解为可执行任务...'
  if (type === 'machine') return '询问设备状态或使用建议...'
  if (type === 'comm-node') return '询问通信状态或架构优化...'
  return '向 AI 提问关于该节点的任何内容...'
}

// ── Node type badge ────────────────────────────────────────────

function NodeTypeBadge({ meta }: { meta: Record<string, unknown> }) {
  const type = meta.type as string
  const tier = meta.tier as string | undefined

  const label: Record<string, string> = {
    'resource-tier': tier ?? 'tier',
    'resource-group': 'group',
    'dimension': 'L1',
    'cybernetics': 'sys',
    'principle': 'rule',
    'task': 'task',
    'machine': 'hw',
    'comm-node': 'comm',
    'contract': 'contract',
    'mq': 'mq',
    'decision': 'human',
    'execution': 'exec',
  }

  return (
    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-white/30 shrink-0">
      {label[type] ?? type ?? '—'}
    </span>
  )
}

// ── SEAI process control (T0 tier) ────────────────────────────

type SEAIStatus = 'stopped' | 'starting' | 'running' | 'error' | 'unknown'

function SEAIProcessControl() {
  const [seaiStatus, setSeaiStatus] = useState<SEAIStatus>('unknown')
  const [actionLoading, setActionLoading] = useState(false)
  const [uptimeSeconds, setUptimeSeconds] = useState<number | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const data = await authFetch<{ status: SEAIStatus; uptimeSeconds: number | null }>('/seai/status')
      setSeaiStatus(data.status)
      setUptimeSeconds(data.uptimeSeconds)
    } catch {
      setSeaiStatus('unknown')
    }
  }, [])

  useEffect(() => {
    void fetchStatus()
    const timer = setInterval(() => void fetchStatus(), 8000)
    return () => clearInterval(timer)
  }, [fetchStatus])

  const handleStart = async () => {
    setActionLoading(true)
    setSeaiStatus('starting')
    try {
      await authFetch<unknown>('/seai/start', { method: 'POST' })
      await fetchStatus()
    } catch {
      setSeaiStatus('error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleStop = async () => {
    setActionLoading(true)
    try {
      await authFetch<unknown>('/seai/stop', { method: 'POST' })
      setSeaiStatus('stopped')
    } catch { /* ignore */ }
    finally {
      setActionLoading(false)
    }
  }

  const statusColor: Record<SEAIStatus, string> = {
    running: '#34d399',
    starting: '#fbbf24',
    stopped: '#6b7280',
    error: '#ef4444',
    unknown: '#6b7280',
  }

  const formatUptime = (s: number | null) => {
    if (!s) return ''
    if (s < 60) return `${s}s`
    if (s < 3600) return `${Math.floor(s / 60)}m`
    return `${Math.floor(s / 3600)}h${Math.floor((s % 3600) / 60)}m`
  }

  return (
    <div className="px-3 py-2 border-b border-white/[0.04] shrink-0 flex items-center gap-2 flex-wrap">
      {/* Status indicator */}
      <span className="flex items-center gap-1.5 text-[10px] font-mono" style={{ color: statusColor[seaiStatus] + 'cc' }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor[seaiStatus] }} />
        {seaiStatus}
        {uptimeSeconds !== null && seaiStatus === 'running' && (
          <span className="text-white/20">· {formatUptime(uptimeSeconds)}</span>
        )}
      </span>

      {/* Start button */}
      {(seaiStatus === 'stopped' || seaiStatus === 'error' || seaiStatus === 'unknown') && (
        <button
          onClick={() => void handleStart()}
          disabled={actionLoading}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#34d399]/10 border border-[#34d399]/20 hover:bg-[#34d399]/20 text-[10px] text-[#34d399]/80 transition-all disabled:opacity-40"
        >
          {actionLoading ? <RefreshCw size={9} className="animate-spin" /> : <Play size={9} />}
          启动 SEAI
        </button>
      )}

      {/* Starting state */}
      {seaiStatus === 'starting' && (
        <span className="flex items-center gap-1.5 text-[10px] text-yellow-400/60">
          <RefreshCw size={9} className="animate-spin" />
          启动中…
        </span>
      )}

      {/* Stop button (running only) */}
      {seaiStatus === 'running' && (
        <button
          onClick={() => void handleStop()}
          disabled={actionLoading}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-red-500/10 hover:border-red-500/20 text-[10px] text-white/30 hover:text-red-400/70 transition-all disabled:opacity-40"
        >
          <Square size={9} />
          停止
        </button>
      )}
    </div>
  )
}

// T2 model options
const T2_MODELS = [
  { id: 'sonnet', label: 'Sonnet 4.6', full: 'claude-sonnet-4-6', color: '#a78bfa' },
  { id: 'opus',   label: 'Opus 4.6',   full: 'claude-opus-4-6',   color: '#c084fc' },
]

// ── Quick actions per node type ────────────────────────────────

function NodeQuickActions({
  node,
  t2Model,
  onT2ModelChange,
}: {
  node: ControlNode
  t2Model: string
  onT2ModelChange: (model: string) => void
}) {
  const meta = node.meta ?? {}
  const type = meta.type as string
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const pingEndpoint = async (endpoint: string, label: string) => {
    setLoading(true)
    setResult(null)
    try {
      await authFetch<unknown>(endpoint)
      setResult(`${label} ✓`)
    } catch {
      setResult(`${label} 不可达`)
    } finally {
      setLoading(false)
    }
  }

  if (type === 'resource-tier') {
    const tier = meta.tier as string
    // T0 SEAI — 进程管理控件
    if (tier === 'T0') {
      return <SEAIProcessControl />
    }
    // T2 — 模型选择 + 健康检查
    if (tier === 'T2') {
      return (
        <div className="px-3 py-2 border-b border-white/[0.04] shrink-0 flex items-center gap-2 flex-wrap">
          {T2_MODELS.map(m => (
            <button
              key={m.id}
              onClick={() => onT2ModelChange(m.full)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] transition-all border ${
                t2Model === m.full
                  ? 'border-[#a78bfa]/40 bg-[#a78bfa]/10 text-[#a78bfa]/90'
                  : 'border-white/[0.06] bg-white/[0.03] text-white/35 hover:text-white/60 hover:bg-white/[0.06]'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.color }} />
              {m.label}
            </button>
          ))}
        </div>
      )
    }
    // T1 — 健康检查
    return (
      <div className="px-3 py-2 border-b border-white/[0.04] shrink-0 flex items-center gap-2 flex-wrap">
        <button
          onClick={() => void pingEndpoint('/health', `${tier}`)}
          disabled={loading}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] text-[10px] text-white/50 transition-all disabled:opacity-40"
        >
          <Activity size={9} className={loading ? 'animate-pulse' : ''} />
          健康检查
        </button>
        {result && <span className="text-[9px] text-white/30 font-mono">{result}</span>}
      </div>
    )
  }

  if (node.id === 'dim-goals' || type === 'task') {
    return (
      <div className="px-3 py-2 border-b border-white/[0.04] shrink-0 flex items-center gap-2">
        <a
          href="/tasks"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] text-[10px] text-white/50 transition-all"
        >
          <Plus size={9} />
          任务看板
        </a>
      </div>
    )
  }

  if (type === 'machine') {
    return (
      <div className="px-3 py-2 border-b border-white/[0.04] shrink-0 flex items-center gap-2">
        <button
          onClick={() => pingEndpoint('/health', '服务器')}
          disabled={loading}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] text-[10px] text-white/50 transition-all disabled:opacity-40"
        >
          <RefreshCw size={9} className={loading ? 'animate-spin' : ''} />
          检查连接
        </button>
        {result && <span className="text-[9px] text-white/30 font-mono">{result}</span>}
      </div>
    )
  }

  if (type === 'comm-node') {
    return (
      <div className="px-3 py-2 border-b border-white/[0.04] shrink-0 flex items-center gap-2">
        <button
          onClick={() => pingEndpoint('/mq/stats', 'MQ')}
          disabled={loading}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] text-[10px] text-white/50 transition-all disabled:opacity-40"
        >
          <Activity size={9} className={loading ? 'animate-pulse' : ''} />
          查看队列
        </button>
        {result && <span className="text-[9px] text-white/30 font-mono">{result}</span>}
      </div>
    )
  }

  return null
}

// ── Main panel ─────────────────────────────────────────────────

function buildStructuringPrompt(node: ControlNode): string {
  const type = (node.meta?.type as string) ?? 'node'
  const desc = (node.meta?.desc as string) ?? ''
  return `你是 PRVSE 宪法规则结构化引擎，当前节点：「${node.name}」（${type}）。${desc ? `节点描述：${desc}。` : ''}

将用户描述的规则转化为 PRVSE IR（中间表示），只输出合法 JSON（无注释无说明），结构如下：
{
  "name": "规则名（≤15字）",
  "summary": "一句话描述这条规则做什么",
  "layer": "l1",
  "prvse": {
    "P": {
      "source": "信号/事件来源节点 ID 或名称",
      "nature": "continuous|discrete|threshold|event",
      "destination": "目标/受体节点 ID 或名称"
    },
    "R": {
      "type": "causal|temporal|mutual_constraint|dependency",
      "direction": "unidirectional|bidirectional",
      "participants": ["nodeId1", "nodeId2"]
    },
    "V": {
      "condition": "触发或评估条件（自然语言）",
      "metric": "counter|timer|ratio|boolean|score",
      "threshold": "阈值描述（如 >80, ==false, <100ms）",
      "reward_direction": "maximize|minimize|maintain"
    },
    "S": {
      "current_state": "当前所处状态名",
      "trigger": "状态转移触发器（事件或条件）",
      "next_state": "转移后目标状态名",
      "guard": "转移守卫条件（可选）"
    }
  },
  "kernel": {
    "type": "perceiver|controller|evaluator",
    "priority": 50,
    "participants": [],
    "conditionCode": "return true;",
    "emitCode": ""
  },
  "protocol": {
    "category": "分级约束控制层",
    "human_char": "人类可读的规则描述",
    "machine_lang": "{}"
  }
}

PRVSE IR 说明：
- P（Pattern）：信号/模式 — 什么在发生，来自哪里，去向哪里
- R（Relation）：关系类型 — 因果/时序/互约/依赖
- V（Value）：评估指标 — 触发条件、度量方式、阈值、优化方向
- S（State）：状态机 — 当前状态、触发器、目标状态、守卫条件
层级：l0=物理信号  l1=可验证规律  l2=认知判断
Kernel type：perceiver=感知监控  controller=控制执行  evaluator=评估评分
conditionCode：接受 s（状态读取，s.get(nodeId,field)），返回 boolean
emitCode：接受 s,e（e.set(nodeId,field,value) 写状态，e.emit(type,data) 触发效果）`
}

export default function NodeInteractionPanel({ node, onClose, onDrillChild, onRuleEstablished, onMutationProposed }: Props) {
  const [panelStack, setPanelStack] = useState<ControlNode[]>([node])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [t2Model, setT2Model] = useState('claude-sonnet-4-6')
  const [historyLoading, setHistoryLoading] = useState(false)

  // ── Build Mode state ─────────────────────────────────────────
  const [mode, setMode] = useState<'chat' | 'build' | 'expand'>('chat')
  const [buildStep, setBuildStep] = useState<BuildStep>(0)
  const [buildDesc, setBuildDesc] = useState('')
  const [ruleSchemaText, setRuleSchemaText] = useState('')
  const [buildValidation, setBuildValidation] = useState<ValidationResult | null>(null)
  const [buildStatus, setBuildStatus] = useState<BuildStatus>('idle')
  const [buildError, setBuildError] = useState<string | null>(null)
  const [establishedRule, setEstablishedRule] = useState<{ contractId: string; protoId: string | null } | null>(null)

  // ── Expand/Commit (发散/收敛) state ──────────────────────────
  const [expandInput, setExpandInput] = useState('')
  const [expandOptions, setExpandOptions] = useState<PlanOption[]>([])
  const [expandStatus, setExpandStatus] = useState<ExpandStatus>('idle')
  const [selectedOptionIdx, setSelectedOptionIdx] = useState<number | null>(null)
  const [committedTaskId, setCommittedTaskId] = useState<string | null>(null)
  const [expandError, setExpandError] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const currentNode = panelStack[panelStack.length - 1]

  // ── 加载历史 ──────────────────────────────────────────────────
  const loadHistory = useCallback(async (nodeId: string) => {
    setHistoryLoading(true)
    try {
      const data = await authFetch<{ messages: Array<{ role: string; content: string; tier_label: string | null }> }>(
        `/node-chat/${encodeURIComponent(nodeId)}`
      )
      setMessages(
        (data.messages ?? []).map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
          tierLabel: m.tier_label ?? undefined,
        }))
      )
    } catch {
      setMessages([])
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  // ── 保存一条消息 ──────────────────────────────────────────────
  const saveMessage = useCallback(async (nodeId: string, msg: ChatMessage) => {
    try {
      await authFetch(`/node-chat/${encodeURIComponent(nodeId)}`, {
        method: 'POST',
        body: JSON.stringify({ role: msg.role, content: msg.content, tier_label: msg.tierLabel }),
      })
    } catch { /* 存储失败不影响 UI */ }
  }, [])

  // ── 清空历史 ──────────────────────────────────────────────────
  const clearHistory = useCallback(async () => {
    if (!confirm('清空该节点的所有对话历史？')) return
    try {
      await authFetch(`/node-chat/${encodeURIComponent(currentNode.id)}`, { method: 'DELETE' })
      setMessages([])
    } catch { /* ignore */ }
  }, [currentNode.id])

  // T2 model switch → clear messages (stateless, no session needed)
  const handleT2ModelChange = useCallback((model: string) => {
    abortRef.current?.abort()
    setT2Model(model)
    setMessages([])
    setInput('')
    setStreaming(false)
  }, [])

  // Reset + load history when root node changes from outside
  useEffect(() => {
    abortRef.current?.abort()
    setPanelStack([node])
    setMessages([])
    setInput('')
    setStreaming(false)
    void loadHistory(node.id)
  }, [node.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const drillIntoChild = useCallback((child: ControlNode) => {
    abortRef.current?.abort()
    setPanelStack(prev => [...prev, child])
    setMessages([])
    setInput('')
    setStreaming(false)
    void loadHistory(child.id)
    onDrillChild?.(child)
  }, [onDrillChild, loadHistory])

  const panelGoBack = useCallback(() => {
    if (panelStack.length > 1) {
      abortRef.current?.abort()
      const prev = panelStack[panelStack.length - 2]
      setPanelStack(s => s.slice(0, -1))
      setMessages([])
      setInput('')
      setStreaming(false)
      void loadHistory(prev.id)
    }
  }, [panelStack, loadHistory])

  // ── 切换模式 ──────────────────────────────────────────────────
  const switchMode = useCallback((m: 'chat' | 'build' | 'expand') => {
    abortRef.current?.abort()
    setMode(m)
    // build state reset
    setBuildStep(0)
    setBuildDesc('')
    setRuleSchemaText('')
    setBuildValidation(null)
    setBuildStatus('idle')
    setBuildError(null)
    setEstablishedRule(null)
    // expand state reset
    setExpandInput('')
    setExpandOptions([])
    setExpandStatus('idle')
    setSelectedOptionIdx(null)
    setCommittedTaskId(null)
    setExpandError(null)
  }, [])

  // ── Step ①→② AI 结构化 ───────────────────────────────────────
  const handleStructure = useCallback(async () => {
    if (!buildDesc.trim() || buildStatus === 'working') return
    setBuildStatus('working')
    setBuildError(null)
    setBuildStep(1)
    setRuleSchemaText('')

    const token = getToken()
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const resp = await fetch('/api/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          system: buildStructuringPrompt(currentNode),
          messages: [{ role: 'user', content: buildDesc }],
          stream: true,
          max_tokens: 2048,
          tier: 'T2',
          model: t2Model,
        }),
        signal: controller.signal,
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)

      const reader = resp.body!.getReader()
      const decoder = new TextDecoder()
      let accum = ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6)) as { text?: string; done?: boolean }
            if (data.text) { accum += data.text; setRuleSchemaText(accum) }
          } catch { /* skip */ }
        }
      }

      // 提取 JSON 块
      const match = accum.match(/\{[\s\S]*\}/)
      if (match) {
        try { JSON.parse(match[0]); setRuleSchemaText(match[0]) } catch { /* keep full accum */ }
      }

      setBuildStep(2)
      setBuildStatus('idle')
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      setBuildError(err instanceof Error ? err.message : '结构化失败')
      setBuildStatus('error')
      setBuildStep(0)
    }
  }, [buildDesc, buildStatus, t2Model, currentNode])

  // ── Step ②→③ Kernel 校验 ─────────────────────────────────────
  const handleValidate = useCallback(async () => {
    setBuildStatus('working')
    setBuildError(null)
    setBuildStep(3)

    let schema: Record<string, unknown>
    try { schema = JSON.parse(ruleSchemaText) } catch {
      setBuildError('JSON 格式错误，请修正后重试')
      setBuildStatus('error')
      setBuildStep(2)
      return
    }

    try {
      const kernelSpec = (schema.kernel as Record<string, unknown>) ?? {}
      const data = await authFetch<{ ok?: boolean; valid?: boolean; issues?: string[]; reason?: string; feedback?: string }>(
        '/kernel/constitution/check',
        { method: 'POST', body: JSON.stringify({ ...kernelSpec, participants: (kernelSpec.participants as string[]) || [] }) }
      )
      const valid = data.ok === true || data.valid === true
      setBuildValidation({
        valid,
        feedback: data.reason || data.feedback || (valid ? '规则结构有效，可建立宪法' : '规则校验未通过'),
        issues: data.issues,
      })
      setBuildStatus('idle')
    } catch (e: unknown) {
      setBuildError(e instanceof Error ? e.message : '校验请求失败')
      setBuildStatus('error')
    }
  }, [ruleSchemaText])

  // ── Step ③→④ 提交变更提议（待裁决）─────────────────────────
  const handleSubmitProposal = useCallback(() => {
    let schema: unknown
    try { schema = JSON.parse(ruleSchemaText) } catch {
      setBuildError('JSON 格式错误，请修正后重试')
      return
    }
    setBuildStep(4)
    setBuildStatus('idle')
    setBuildError(null)
    onMutationProposed?.(currentNode.id, schema)
  }, [ruleSchemaText, currentNode.id, onMutationProposed])

  // ── Step ④→⑤ 确认建立宪法 ─────────────────────────────────
  const handleConfirmEstablish = useCallback(async () => {
    setBuildStatus('working')
    setBuildError(null)

    let schema: Record<string, unknown>
    try { schema = JSON.parse(ruleSchemaText) } catch {
      setBuildError('JSON 格式错误')
      setBuildStatus('error')
      return
    }

    const anchorTagId = (currentNode.meta?.anchor_tag_id as string | undefined) ?? null

    try {
      const data = await authFetch<{ valid: boolean; contractId?: string; protoId?: string | null; feedback?: string; error?: string }>(
        '/kernel/establish-rule',
        { method: 'POST', body: JSON.stringify({ ...schema, node_id: currentNode.id, anchor_tag_id: anchorTagId }) }
      )

      if (!data.valid) {
        setBuildError(data.error || data.feedback || '建立失败')
        setBuildStatus('error')
        return
      }

      setEstablishedRule({ contractId: data.contractId!, protoId: data.protoId ?? null })
      setBuildStep(5)
      setBuildStatus('done')
      onRuleEstablished?.(currentNode.id, { contractId: data.contractId!, schema })
    } catch (e: unknown) {
      setBuildError(e instanceof Error ? e.message : '建立失败')
      setBuildStatus('error')
    }
  }, [ruleSchemaText, currentNode, onRuleEstablished])

  // ── 发散：AI 展开为 3-5 个方案 ───────────────────────────────
  const handleExpand = useCallback(async () => {
    if (!expandInput.trim() || expandStatus === 'working') return
    setExpandStatus('working')
    setExpandError(null)
    setExpandOptions([])
    setSelectedOptionIdx(null)

    const token = getToken()
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const prompt = `你是 Egonetics 计划发散引擎，当前节点：「${currentNode.name}」。
用户意图：${expandInput}

将该意图展开为 3-5 个互不重叠的具体可执行方案。只输出合法 JSON 数组，无注释：
[
  {
    "title": "方案名（≤20字）",
    "summary": "一句话说明这个方案解决什么",
    "effort": "low|medium|high",
    "approach": "具体如何做（2-3个关键步骤，逗号分隔）"
  }
]`

    try {
      const resp = await fetch('/api/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          system: '你是结构化计划引擎，只输出 JSON，不输出任何解释文字。',
          messages: [{ role: 'user', content: prompt }],
          stream: true,
          max_tokens: 1024,
          tier: 'T2',
          model: t2Model,
        }),
        signal: controller.signal,
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)

      const reader = resp.body!.getReader()
      const decoder = new TextDecoder()
      let accum = ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6)) as { text?: string; done?: boolean }
            if (data.text) accum += data.text
          } catch { /* skip */ }
        }
      }

      const match = accum.match(/\[[\s\S]*\]/)
      if (!match) throw new Error('AI 未返回有效 JSON')
      const options = JSON.parse(match[0]) as PlanOption[]
      if (!Array.isArray(options) || options.length === 0) throw new Error('方案列表为空')
      setExpandOptions(options.slice(0, 5))
      setExpandStatus('options')
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      setExpandError(err instanceof Error ? err.message : '发散失败')
      setExpandStatus('idle')
    }
  }, [expandInput, expandStatus, currentNode, t2Model])

  // ── 收敛：锁定选中方案，写入任务队列 ─────────────────────────
  const handleCommit = useCallback(async () => {
    if (selectedOptionIdx === null) return
    const opt = expandOptions[selectedOptionIdx]
    if (!opt) return
    setExpandStatus('committing')
    setExpandError(null)

    try {
      const data = await authFetch<{ task?: { id: string } }>('/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title: opt.title,
          description: `${opt.summary}\n\n执行路径：${opt.approach}\n\n来源节点：${currentNode.name}`,
          column_id: 'todo',
        }),
      })
      setCommittedTaskId(data.task?.id ?? null)
      setExpandStatus('committed')
    } catch (e: unknown) {
      setExpandError(e instanceof Error ? e.message : '写入任务队列失败')
      setExpandStatus('options')
    }
  }, [selectedOptionIdx, expandOptions, currentNode])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || streaming) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const nodeId = currentNode.id
    const userMsg: ChatMessage = { role: 'user', content: text, timestamp: nowHHMM() }
    const history = [...messages, userMsg]

    setMessages([...history, { role: 'assistant', content: '', streaming: true, timestamp: nowHHMM() }])
    setInput('')
    setStreaming(true)

    // 持久化 user 消息
    void saveMessage(nodeId, userMsg)

    // Extract tier from node meta (T0/T1/T2 resource-tier nodes)
    const tier = (currentNode.meta?.tier as string | undefined) ?? undefined
    const systemPrompt = buildSystemPrompt(currentNode, tier === 'T2' ? t2Model : undefined)
    const token = getToken()

    try {
      const resp = await fetch('/api/llm/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          system: systemPrompt,
          messages: history.map(m => ({ role: m.role, content: m.content })),
          stream: true,
          max_tokens: 1024,
          tier,
          model: tier === 'T2' ? t2Model : undefined,
        }),
        signal: controller.signal,
      })

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)

      const reader = resp.body!.getReader()
      const decoder = new TextDecoder()
      let accum = ''
      let buffer = ''
      let activeTierLabel = tier ?? 'T1'

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6)) as {
              text?: string; done?: boolean; error?: string
              meta?: { tier?: string; model?: string }
            }
            if (data.meta?.tier) {
              activeTierLabel = data.meta.tier
            }
            if (data.text) {
              accum += data.text
              setMessages(prev => {
                const next = [...prev]
                const ts = next[next.length - 1]?.timestamp
                next[next.length - 1] = { role: 'assistant', content: accum, streaming: true, tierLabel: activeTierLabel, timestamp: ts }
                return next
              })
            }
            if (data.done || data.error) {
              const finalContent = data.error ? `错误：${data.error}` : accum
              const assistantMsg: ChatMessage = { role: 'assistant', content: finalContent, tierLabel: activeTierLabel, timestamp: nowHHMM() }
              setMessages(prev => {
                const next = [...prev]
                next[next.length - 1] = assistantMsg
                return next
              })
              // 持久化 assistant 消息
              void saveMessage(nodeId, assistantMsg)
            }
          } catch { /* skip malformed */ }
        }
      }

      // Finalize if stream ended without done signal
      setMessages(prev => {
        const next = [...prev]
        if (next[next.length - 1]?.streaming) {
          const finalMsg: ChatMessage = { role: 'assistant', content: accum, tierLabel: activeTierLabel, timestamp: nowHHMM() }
          next[next.length - 1] = finalMsg
          void saveMessage(nodeId, finalMsg)
        }
        return next
      })
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      setMessages(prev => {
        const next = [...prev]
        next[next.length - 1] = { role: 'assistant', content: '请求失败，请稍后重试。' }
        return next
      })
    } finally {
      setStreaming(false)
    }
  }, [input, messages, streaming, currentNode, t2Model, saveMessage])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendMessage()
    }
  }, [sendMessage])

  const children = currentNode.children ?? []
  const meta = currentNode.meta ?? {}
  const desc = meta.desc as string | undefined

  return (
    <div className="absolute right-0 top-0 bottom-0 z-20 w-[380px] flex flex-col bg-[#060810]/93 backdrop-blur-2xl border-l border-white/[0.07]">

      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-3.5 py-3 border-b border-white/[0.07] shrink-0">
        {panelStack.length > 1 && (
          <button onClick={panelGoBack} className="p-1.5 rounded-lg text-white/25 hover:text-white/60 hover:bg-white/[0.05] transition-colors">
            <ArrowLeft size={12} />
          </button>
        )}
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: currentNode.color }} />
        <span className="flex-1 text-[13px] text-white/75 font-medium truncate">{currentNode.name}</span>
        <NodeTypeBadge meta={meta} />
        {/* 模式切换 */}
        <div className="flex items-center gap-0.5 bg-white/[0.04] rounded-lg p-0.5">
          <button
            onClick={() => switchMode('chat')}
            className={`p-1.5 rounded-md transition-all ${mode === 'chat' ? 'bg-white/[0.10] text-white/70' : 'text-white/25 hover:text-white/45'}`}
            title="对话模式"
          >
            <MessageSquare size={11} />
          </button>
          <button
            onClick={() => switchMode('expand')}
            className={`p-1.5 rounded-md transition-all ${mode === 'expand' ? 'bg-cyan-500/[0.20] text-cyan-300/80' : 'text-white/25 hover:text-white/45'}`}
            title="发散/收敛 — 展开方案并选择路径"
          >
            <GitBranch size={11} />
          </button>
          <button
            onClick={() => switchMode('build')}
            className={`p-1.5 rounded-md transition-all ${mode === 'build' ? 'bg-white/[0.10] text-white/70' : 'text-white/25 hover:text-white/45'}`}
            title="建立宪法"
          >
            <Wrench size={11} />
          </button>
        </div>
        {mode === 'chat' && messages.length > 0 && (
          <button onClick={() => void clearHistory()} className="p-1.5 rounded-lg text-white/15 hover:text-red-400/60 hover:bg-white/[0.05] transition-colors" title="清空对话历史">
            <Trash2 size={11} />
          </button>
        )}
        <button onClick={onClose} className="p-1.5 rounded-lg text-white/20 hover:text-white/55 hover:bg-white/[0.05] transition-colors">
          <X size={12} />
        </button>
      </div>

      {/* ── Panel breadcrumb (nested navigation) ── */}
      {panelStack.length > 1 && (
        <div className="px-3.5 py-1.5 border-b border-white/[0.04] flex items-center gap-0.5 overflow-x-auto shrink-0">
          {panelStack.map((n, i) => (
            <span key={n.id} className="flex items-center gap-0.5 shrink-0">
              {i > 0 && <ChevronRight size={8} className="text-white/15" />}
              <button
                onClick={() => {
                  const target = panelStack[i]
                  setPanelStack(panelStack.slice(0, i + 1))
                  setMessages([])
                  setInput('')
                  void loadHistory(target.id)
                }}
                className="text-[9px] text-white/30 hover:text-white/60 transition-colors font-mono truncate max-w-[100px]"
              >
                {n.name}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* ── Node description ── */}
      {desc && (
        <div className="px-3.5 py-2 text-[10px] text-white/30 border-b border-white/[0.04] shrink-0 leading-relaxed">
          {desc}
        </div>
      )}

      {/* ── Children quick-nav (drill in panel without 3D movement) ── */}
      {children.length > 0 && (
        <div className="px-3 py-2.5 border-b border-white/[0.04] shrink-0">
          <div className="text-[8px] text-white/15 mb-1.5 px-0.5 font-mono uppercase tracking-widest">子节点</div>
          <div className="flex flex-wrap gap-1.5">
            {children.map(child => (
              <button
                key={child.id}
                onClick={() => drillIntoChild(child)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.07] hover:bg-white/[0.08] hover:border-white/[0.16] transition-all text-[10px] text-white/45 hover:text-white/75"
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: child.color }} />
                <span className="truncate max-w-[110px]">{child.name}</span>
                {(child.children?.length ?? 0) > 0 && (
                  <span className="text-white/20 font-mono text-[8px]">{child.children!.length}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Quick actions (chat mode only) ── */}
      {mode === 'chat' && <NodeQuickActions node={currentNode} t2Model={t2Model} onT2ModelChange={handleT2ModelChange} />}

      {/* ══════════════ CHAT MODE ══════════════ */}
      {mode === 'chat' && (
        <>
          <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3 min-h-0">
            {historyLoading && (
              <div className="flex items-center justify-center py-6">
                <span className="text-[9px] text-white/20 font-mono animate-pulse">加载历史中…</span>
              </div>
            )}
            {!historyLoading && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center gap-3 pb-10">
                <div className="w-9 h-9 rounded-full flex items-center justify-center opacity-25" style={{ background: currentNode.color }}>
                  <Zap size={16} className="text-black" />
                </div>
                <div className="text-[10px] text-white/20 max-w-[220px] leading-relaxed">
                  {getInputPlaceholder(currentNode)}
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <PMessageCard key={i} msg={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>
          <div className="px-3 pb-3 pt-2 border-t border-white/[0.05] shrink-0">
            <div className="flex items-end gap-2 rounded-xl bg-white/[0.03] border border-white/[0.07] focus-within:border-white/[0.15] transition-colors px-3 py-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={getInputPlaceholder(currentNode)}
                rows={1}
                className="flex-1 bg-transparent resize-none text-[12px] text-white/75 placeholder-white/20 outline-none leading-relaxed"
                style={{ minHeight: '32px', maxHeight: '96px' }}
              />
              <button
                onClick={() => void sendMessage()}
                disabled={!input.trim() || streaming}
                className="shrink-0 p-1.5 rounded-lg bg-white/[0.07] hover:bg-white/[0.14] disabled:opacity-25 transition-colors"
              >
                {streaming ? <RefreshCw size={11} className="animate-spin text-white/40" /> : <Send size={11} className="text-white/55" />}
              </button>
            </div>
            <div className="text-[8px] text-white/15 mt-1.5 px-1 font-mono">Enter 发送 · Shift+Enter 换行</div>
          </div>
        </>
      )}

      {/* ══════════════ EXPAND / COMMIT MODE ══════════════ */}
      {mode === 'expand' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header hint */}
          <div className="px-4 py-2 border-b border-white/[0.04] shrink-0 flex items-center gap-2">
            <GitBranch size={9} className="text-cyan-400/60" />
            <span className="text-[9px] text-white/30 font-mono">发散 → 选择路径 → 收敛锁定</span>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0 space-y-4">

            {/* ① 输入意图 */}
            {(expandStatus === 'idle' || expandStatus === 'working') && (
              <div className="space-y-3">
                <div className="text-[10px] text-white/35 leading-relaxed">
                  描述你在这个节点上想实现的目标或解决的问题。AI 将发散出 3~5 个具体可执行方案供你选择。
                </div>
                <textarea
                  value={expandInput}
                  onChange={e => setExpandInput(e.target.value)}
                  placeholder={`例：在「${currentNode.name}」下，我想…`}
                  rows={4}
                  disabled={expandStatus === 'working'}
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-[11px] text-white/70 placeholder-white/20 outline-none focus:border-cyan-400/30 resize-none leading-relaxed disabled:opacity-40"
                />
                {expandError && (
                  <div className="flex items-start gap-1.5 text-[10px] text-red-400/70 bg-red-400/[0.06] rounded-lg px-2.5 py-2">
                    <AlertCircle size={10} className="shrink-0 mt-0.5" />
                    {expandError}
                  </div>
                )}
                <button
                  onClick={() => void handleExpand()}
                  disabled={!expandInput.trim() || expandStatus === 'working'}
                  className="w-full py-2.5 rounded-xl text-[11px] font-medium bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-400/20 hover:border-cyan-400/35 text-cyan-300/70 hover:text-cyan-200 disabled:opacity-30 transition-all flex items-center justify-center gap-2"
                >
                  {expandStatus === 'working'
                    ? <><Loader size={10} className="animate-spin" />AI 正在发散…</>
                    : <><GitBranch size={10} />发散方案</>}
                </button>
              </div>
            )}

            {/* ② 方案列表 */}
            {(expandStatus === 'options' || expandStatus === 'committing' || expandStatus === 'committed') && expandOptions.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-white/25 font-mono">选择一条路径收敛</span>
                  <button
                    onClick={() => { setExpandStatus('idle'); setExpandOptions([]); setSelectedOptionIdx(null) }}
                    className="text-[8px] text-white/20 hover:text-white/40 transition-colors"
                  >
                    重新发散
                  </button>
                </div>

                {expandOptions.map((opt, i) => {
                  const isSelected = selectedOptionIdx === i
                  const effortColor = opt.effort === 'low' ? '#34d399' : opt.effort === 'medium' ? '#f59e0b' : '#ef4444'
                  return (
                    <div
                      key={i}
                      onClick={() => expandStatus !== 'committed' && setSelectedOptionIdx(i)}
                      className={`rounded-xl border p-3 space-y-1.5 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-cyan-400/35 bg-cyan-500/[0.06]'
                          : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full border-2 shrink-0 transition-all ${isSelected ? 'border-cyan-400 bg-cyan-400/30' : 'border-white/20'}`} />
                        <span className="text-[11px] text-white/70 font-medium flex-1">{opt.title}</span>
                        <span className="text-[8px] font-mono px-1.5 py-0.5 rounded" style={{ background: effortColor + '15', color: effortColor + 'cc' }}>
                          {opt.effort}
                        </span>
                      </div>
                      <p className="text-[10px] text-white/40 leading-relaxed pl-5">{opt.summary}</p>
                      {isSelected && (
                        <p className="text-[9px] text-cyan-400/50 leading-relaxed pl-5 font-mono">{opt.approach}</p>
                      )}
                    </div>
                  )
                })}

                {/* 收敛按钮 */}
                {expandStatus !== 'committed' && (
                  <button
                    onClick={() => void handleCommit()}
                    disabled={selectedOptionIdx === null || expandStatus === 'committing'}
                    className="w-full py-2.5 rounded-xl text-[11px] font-medium bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/20 hover:border-emerald-400/35 text-emerald-300/70 hover:text-emerald-200 disabled:opacity-30 transition-all flex items-center justify-center gap-2"
                  >
                    {expandStatus === 'committing'
                      ? <><Loader size={10} className="animate-spin" />写入任务队列…</>
                      : <><Lock size={10} />收敛锁定 — 创建任务</>}
                  </button>
                )}

                {/* 已提交确认 */}
                {expandStatus === 'committed' && (
                  <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.04] p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle size={13} className="text-emerald-400" />
                      <span className="text-[12px] font-medium text-emerald-300/80">路径已锁定</span>
                    </div>
                    <p className="text-[10px] text-white/35">
                      「{expandOptions[selectedOptionIdx!]?.title}」已写入任务队列。
                    </p>
                    {committedTaskId && (
                      <a href={`/tasks/${committedTaskId}`} className="text-[9px] text-cyan-400/60 hover:text-cyan-300 underline underline-offset-2">
                        打开任务 →
                      </a>
                    )}
                    <button onClick={() => switchMode('expand')} className="w-full mt-2 py-1.5 rounded-lg text-[10px] text-white/30 hover:text-white/50 bg-white/[0.03] transition-all">
                      继续发散下一个目标
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════ BUILD MODE ══════════════ */}
      {mode === 'build' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* 步骤指示器 */}
          <div className="px-4 py-2.5 border-b border-white/[0.04] shrink-0 flex items-center gap-1">
            {(['描述', '结构', '预览', '校验', '裁决', '完成'] as const).map((label, i) => (
              <div key={i} className="flex items-center gap-1">
                {i > 0 && <div className={`w-3 h-px ${buildStep >= i ? 'bg-white/20' : 'bg-white/[0.06]'}`} />}
                <div className={`flex items-center gap-0.5 text-[8px] font-mono px-1 py-0.5 rounded-md transition-all
                  ${buildStep === i
                    ? i === 4 ? 'bg-amber-500/[0.15] text-amber-300/80' : 'bg-white/[0.10] text-white/75'
                    : buildStep > i ? 'text-white/35' : 'text-white/15'}`}>
                  {buildStep > i
                    ? <CheckCircle size={7} className="text-emerald-400/70" />
                    : i === 4 && buildStep === 4
                      ? <span className="w-2.5 text-center text-amber-400/80">⚡</span>
                      : <span className="w-2.5 text-center">{i + 1}</span>}
                  {label}
                </div>
              </div>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0 space-y-3">

            {/* ① 描述 */}
            {buildStep === 0 && (
              <div className="space-y-3">
                <div className="text-[10px] text-white/40 leading-relaxed">
                  用自然语言描述你想建立的宪法规则。AI 将把它结构化为 Kernel 可执行合约。
                </div>
                <textarea
                  value={buildDesc}
                  onChange={e => setBuildDesc(e.target.value)}
                  placeholder={`例：当 ${currentNode.name} 的状态变为错误时，立即通知控制器并挂起相关执行节点`}
                  rows={5}
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-[11px] text-white/70 placeholder-white/20 outline-none focus:border-white/[0.18] resize-none leading-relaxed"
                />
                {buildError && (
                  <div className="flex items-start gap-1.5 text-[10px] text-red-400/70 bg-red-400/[0.06] rounded-lg px-2.5 py-2">
                    <AlertCircle size={10} className="shrink-0 mt-0.5" />
                    {buildError}
                  </div>
                )}
                <button
                  onClick={() => void handleStructure()}
                  disabled={!buildDesc.trim() || buildStatus === 'working'}
                  className="w-full py-2 rounded-xl text-[11px] font-medium transition-all bg-white/[0.07] hover:bg-white/[0.12] disabled:opacity-30 text-white/60"
                >
                  AI 结构化 →
                </button>
              </div>
            )}

            {/* ② 结构化进行中 */}
            {buildStep === 1 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[10px] text-white/40">
                  <Loader size={10} className="animate-spin" />
                  T2 正在结构化…
                </div>
                {ruleSchemaText && (
                  <pre className="text-[9px] text-white/30 font-mono bg-white/[0.02] rounded-lg p-3 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                    {ruleSchemaText}
                  </pre>
                )}
              </div>
            )}

            {/* ③ 预览 + 编辑 */}
            {buildStep === 2 && (
              <div className="space-y-3">
                <div className="text-[10px] text-white/35">检查并编辑结构化结果，确认后发起 Kernel 校验</div>
                <textarea
                  value={ruleSchemaText}
                  onChange={e => setRuleSchemaText(e.target.value)}
                  rows={14}
                  className="w-full bg-white/[0.02] border border-white/[0.07] rounded-xl px-3 py-2.5 text-[10px] text-white/55 font-mono outline-none focus:border-white/[0.15] resize-none leading-relaxed"
                />
                {buildError && (
                  <div className="flex items-start gap-1.5 text-[10px] text-red-400/70 bg-red-400/[0.06] rounded-lg px-2.5 py-2">
                    <AlertCircle size={10} className="shrink-0 mt-0.5" />
                    {buildError}
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={() => { setBuildStep(0); setBuildStatus('idle') }} className="flex-1 py-2 rounded-xl text-[11px] text-white/35 hover:text-white/55 bg-white/[0.03] hover:bg-white/[0.07] transition-all">
                    ← 重新描述
                  </button>
                  <button
                    onClick={() => void handleValidate()}
                    disabled={buildStatus === 'working'}
                    className="flex-1 py-2 rounded-xl text-[11px] font-medium bg-white/[0.07] hover:bg-white/[0.12] disabled:opacity-30 text-white/60 transition-all"
                  >
                    Kernel 校验 →
                  </button>
                </div>
              </div>
            )}

            {/* ④ 校验结果 */}
            {buildStep === 3 && (
              <div className="space-y-3">
                {buildStatus === 'working' && (
                  <div className="flex items-center gap-2 text-[10px] text-white/40">
                    <Loader size={10} className="animate-spin" />
                    物理引擎校验中…
                  </div>
                )}
                {buildValidation && (
                  <div className={`rounded-xl p-3 border ${buildValidation.valid ? 'border-emerald-400/20 bg-emerald-400/[0.05]' : 'border-red-400/20 bg-red-400/[0.05]'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      {buildValidation.valid
                        ? <CheckCircle size={12} className="text-emerald-400" />
                        : <AlertCircle size={12} className="text-red-400" />}
                      <span className={`text-[11px] font-medium ${buildValidation.valid ? 'text-emerald-300/80' : 'text-red-300/80'}`}>
                        {buildValidation.valid ? '校验通过' : '校验未通过'}
                      </span>
                    </div>
                    <p className="text-[10px] text-white/40 leading-relaxed">{buildValidation.feedback}</p>
                    {buildValidation.issues?.map((issue, i) => (
                      <div key={i} className="text-[9px] text-red-400/60 font-mono mt-1">· {issue}</div>
                    ))}
                  </div>
                )}
                {buildError && (
                  <div className="flex items-start gap-1.5 text-[10px] text-red-400/70 bg-red-400/[0.06] rounded-lg px-2.5 py-2">
                    <AlertCircle size={10} className="shrink-0 mt-0.5" />
                    {buildError}
                  </div>
                )}
                {buildValidation && (
                  <div className="flex gap-2">
                    <button onClick={() => { setBuildStep(2); setBuildValidation(null); setBuildStatus('idle') }} className="flex-1 py-2 rounded-xl text-[11px] text-white/35 hover:text-white/55 bg-white/[0.03] hover:bg-white/[0.07] transition-all">
                      ← 修改
                    </button>
                    {!buildValidation.valid && (
                      <button onClick={() => void handleValidate()} disabled={buildStatus === 'working'} className="flex-1 py-2 rounded-xl text-[11px] text-white/50 bg-white/[0.05] hover:bg-white/[0.09] disabled:opacity-30 transition-all">
                        重新校验
                      </button>
                    )}
                    {buildValidation.valid && (
                      <button
                        onClick={handleSubmitProposal}
                        className="flex-1 py-2 rounded-xl text-[11px] font-medium bg-amber-500/15 hover:bg-amber-500/25 text-amber-300/80 transition-all"
                      >
                        提交裁决 ⚡
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ⑤ 待裁决 */}
            {buildStep === 4 && (
              <div className="space-y-4">
                <div className="rounded-xl border border-amber-400/25 bg-amber-400/[0.04] p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400/80 text-base">⚡</span>
                    <span className="text-[12px] font-medium text-amber-300/80">变更提议待裁决</span>
                  </div>
                  <p className="text-[10px] text-white/35 leading-relaxed">
                    节点 <span className="text-white/55 font-medium">{currentNode.name}</span> 的宪法规则已进入裁决队列。
                    3D 节点正在显示提议光环。确认后将写入 Kernel。
                  </p>
                  <div className="bg-white/[0.02] rounded-lg p-2 max-h-24 overflow-y-auto">
                    <pre className="text-[8px] text-white/25 font-mono whitespace-pre-wrap leading-relaxed">
                      {(() => {
                        try {
                          const s = JSON.parse(ruleSchemaText) as Record<string, unknown>
                          return `${s.name as string}\n${s.summary as string}\n层级: ${s.layer as string}`
                        } catch { return ruleSchemaText.slice(0, 120) }
                      })()}
                    </pre>
                  </div>
                </div>
                {buildError && (
                  <div className="flex items-start gap-1.5 text-[10px] text-red-400/70 bg-red-400/[0.06] rounded-lg px-2.5 py-2">
                    <AlertCircle size={10} className="shrink-0 mt-0.5" />
                    {buildError}
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={() => { setBuildStep(3); setBuildStatus('idle') }} className="flex-1 py-2 rounded-xl text-[11px] text-white/35 hover:text-white/55 bg-white/[0.03] hover:bg-white/[0.07] transition-all">
                    ← 取消提议
                  </button>
                  <button
                    onClick={() => void handleConfirmEstablish()}
                    disabled={buildStatus === 'working'}
                    className="flex-1 py-2 rounded-xl text-[11px] font-medium bg-emerald-500/20 hover:bg-emerald-500/30 disabled:opacity-30 text-emerald-300/80 transition-all"
                  >
                    {buildStatus === 'working'
                      ? <span className="flex items-center justify-center gap-1.5"><Loader size={10} className="animate-spin" />建立中…</span>
                      : '确认建立 ✦'}
                  </button>
                </div>
              </div>
            )}

            {/* ⑥ 完成 */}
            {buildStep === 5 && establishedRule && (
              <div className="space-y-4">
                <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.04] p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={14} className="text-emerald-400" />
                    <span className="text-[12px] font-medium text-emerald-300/80">宪法规则已建立</span>
                  </div>
                  <div className="text-[9px] font-mono text-white/30 space-y-1">
                    <div>合约 ID：{establishedRule.contractId}</div>
                    {establishedRule.protoId && <div>协议条目：{establishedRule.protoId}</div>}
                    <div className="text-white/20 mt-1">节点 {currentNode.name} 已更新</div>
                  </div>
                </div>
                <button onClick={() => switchMode('build')} className="w-full py-2 rounded-xl text-[11px] text-white/40 hover:text-white/60 bg-white/[0.03] hover:bg-white/[0.07] transition-all">
                  建立下一条规则
                </button>
                <button onClick={() => switchMode('chat')} className="w-full py-2 rounded-xl text-[11px] text-white/30 hover:text-white/50 transition-all">
                  返回对话
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
