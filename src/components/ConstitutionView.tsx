/**
 * ConstitutionView — 宪法编译器
 * 左：控制论宪法树 | 右上：React Flow 可视化 | 右下：JSON 编辑器
 * constitution.json 是 Python GRPO reward 函数的直接输入
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow, Background, BackgroundVariant, Controls, Edge, EdgeChange,
  Handle, MiniMap, Node, NodeProps, Position, addEdge, useEdgesState, useNodesState,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  ChevronDown, ChevronRight, Cpu, Download, Layers, Loader2,
  Maximize2, Minimize2, Pencil, Play, Plus, Save, Shield, Sparkles, Trash2, X,
} from 'lucide-react'
import { authFetch, getToken } from '@/lib/http'
import BlockEditor, { generateBlockId, type Block } from './BlockEditor'
import PRVSPanel from './PRVSPanel'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExecNode {
  index: number
  title: string
  node_kind: string   // lifecycle | trigger | condition | action | human_gate | block | escalate
  exec_config: Record<string, unknown>
}

interface ExecEdge {
  from: number
  to: number
  label?: string
  branch?: string    // true | false | approved | rejected
}

interface ExecGraph {
  nodes: ExecNode[]
  edges: ExecEdge[]
}

interface CapabilityEntry {
  trigger: string       // 子任务特征描述
  node_kind: string     // llm_call | tool_call | local_judge | rule_branch | human_gate | lifecycle
  tool?: string         // 仅 tool_call 时：claude_code | openclaw
  description?: string
}

interface Principle {
  id: string
  parent_id: string | null
  title: string
  layer: string      // meta | control | subjectivity | practice | memory | adapt
  level: string      // L1 | L2 | L3
  icon: string
  kind?: 'principle' | 'capability_dict'   // default = 'principle'
  exec_graph?: ExecGraph
  capability_dict?: CapabilityEntry[]
  children?: Principle[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LAYER_META: Record<string, { label: string; color: string; bg: string }> = {
  meta:         { label: '元控制层',     color: 'text-red-400',    bg: 'bg-red-500/10' },
  control:      { label: '控制结构层',   color: 'text-orange-400', bg: 'bg-orange-500/10' },
  subjectivity: { label: '主体性叙事层', color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  practice:     { label: '实践层',       color: 'text-green-400',  bg: 'bg-green-500/10' },
  memory:       { label: '过程记忆层',   color: 'text-blue-400',   bg: 'bg-blue-500/10' },
  adapt:        { label: '自适应迭代层', color: 'text-purple-400', bg: 'bg-purple-500/10' },
}

const LEVEL_META: Record<string, { label: string; dot: string }> = {
  L1: { label: 'L1 硬约束',   dot: 'bg-red-500' },
  L2: { label: 'L2 规则约束', dot: 'bg-orange-400' },
  L3: { label: 'L3 语义判断', dot: 'bg-blue-400' },
}

const NODE_KIND_STYLE: Record<string, { bg: string; border: string; icon: string; label: string }> = {
  start:      { bg: '#166534', border: '#22c55e', icon: '▶', label: 'START' },
  end:        { bg: '#7c2d12', border: '#f97316', icon: '■', label: 'END' },
  trigger:    { bg: '#713f12', border: '#eab308', icon: '⚡', label: 'Trigger' },
  condition:  { bg: '#1e3a5f', border: '#3b82f6', icon: '◆', label: 'Condition' },
  action:     { bg: '#14532d', border: '#22c55e', icon: '⚙', label: 'Action' },
  human_gate: { bg: '#4c1d95', border: '#a855f7', icon: '👤', label: 'Human Gate' },
  block:      { bg: '#7f1d1d', border: '#ef4444', icon: '🚫', label: 'Block' },
  escalate:   { bg: '#312e81', border: '#818cf8', icon: '↑', label: 'Escalate' },
}

// ─── Default Principles ───────────────────────────────────────────────────────

const DEFAULT_PRINCIPLES: Omit<Principle, 'id' | 'children'>[] = [
  { parent_id: null, title: '元控制层', layer: 'meta', level: 'L1', icon: '🔒' },
  { parent_id: '__meta__', title: '控制权归属原则', layer: 'meta', level: 'L1', icon: '👑' },
  { parent_id: '__meta__', title: '不可逆操作必须人工确认', layer: 'meta', level: 'L1', icon: '⚠️' },
  { parent_id: '__meta__', title: '宪法不可自我修改', layer: 'meta', level: 'L1', icon: '🛡️' },
  { parent_id: null, title: '控制结构层', layer: 'control', level: 'L2', icon: '⚙️' },
  { parent_id: '__control__', title: '能力映射字典', layer: 'control', level: 'L2', icon: '📋', kind: 'capability_dict' },
  { parent_id: '__control__', title: 'LLM API 预算守护', layer: 'control', level: 'L2', icon: '💰' },
  { parent_id: '__control__', title: '隐私数据本地处理', layer: 'control', level: 'L2', icon: '🔐' },
  { parent_id: null, title: '主体性叙事层', layer: 'subjectivity', level: 'L3', icon: '🧠' },
]

// ─── Default Capability Dictionary ───────────────────────────────────────────

const DEFAULT_CAPABILITY_DICT: CapabilityEntry[] = [
  { trigger: '推理、分析、写作、规划、总结', node_kind: 'llm_call', description: '调用云端或本地 LLM 处理认知任务' },
  { trigger: '执行代码、修改文件、读写文件系统', node_kind: 'tool_call', tool: 'claude_code', description: '通过 Claude Code 工具执行本地操作' },
  { trigger: '需要外部 session、持续对话、web 搜索', node_kind: 'tool_call', tool: 'openclaw', description: '通过 OpenClaw 维持外部会话' },
  { trigger: '价值判断、路径选择、不确定性路由', node_kind: 'local_judge', description: '本地小模型做轻量推断，避免云端 API 消耗' },
  { trigger: '根据变量/输出结果条件分支', node_kind: 'rule_branch', description: '基于 ctx 变量的确定性条件判断' },
  { trigger: '需要人类决策、涉及伦理/权限边界', node_kind: 'human_gate', description: '暂停执行，等待人工审批' },
  { trigger: '生命周期控制（开始/结束标记）', node_kind: 'lifecycle', description: '执行图的入口和出口节点' },
]

// ─── Default Execution Graphs ─────────────────────────────────────────────────

const DEFAULT_EXEC_GRAPHS: Record<string, ExecGraph> = {
  '控制权归属原则': {
    nodes: [
      { index: 0, title: '开始', node_kind: 'lifecycle', exec_config: { action: 'start' } },
      { index: 1, title: '检测控制权变更操作', node_kind: 'trigger', exec_config: { event: 'pre_api_call', filter: "path.startswith('/api/auth') or 'role' in request.body", description: '用户创建/权限变更/宪法写入' } },
      { index: 2, title: '是否 admin 角色?', node_kind: 'condition', exec_config: { expression: "ctx.get('user_role') == 'admin'", description: '只有 admin 才能执行控制权变更' } },
      { index: 3, title: '硬拦截', node_kind: 'block', exec_config: { reason: '违反 L1 硬约束：控制权归属原则', severity: 'critical', log: true } },
      { index: 4, title: '完成', node_kind: 'lifecycle', exec_config: { action: 'complete' } },
    ],
    edges: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 2, to: 3, label: '否', branch: 'false' },
      { from: 2, to: 4, label: '是', branch: 'true' },
    ],
  },

  '不可逆操作必须人工确认': {
    nodes: [
      { index: 0, title: '开始', node_kind: 'lifecycle', exec_config: { action: 'start' } },
      { index: 1, title: '检测不可逆操作', node_kind: 'trigger', exec_config: { event: 'pre_tool_call', filter: "tool in ['Bash','Write','Edit','delete','drop','send']", description: '文件写入/删除/外发等操作' } },
      { index: 2, title: '已获人工确认?', node_kind: 'condition', exec_config: { expression: "ctx.get('human_approved', False)", description: '检查是否已有 human_gate 通过记录' } },
      { index: 3, title: '等待人工确认', node_kind: 'human_gate', exec_config: { prompt: 'Agent 请求执行不可逆操作，是否批准？', blocking: true, timeout_seconds: 300 } },
      { index: 4, title: '继续执行', node_kind: 'action', exec_config: { action: 'set_context', key: 'human_approved', value: true } },
      { index: 5, title: '终止执行', node_kind: 'block', exec_config: { reason: '用户拒绝，中止不可逆操作', severity: 'user_rejected' } },
      { index: 6, title: '完成', node_kind: 'lifecycle', exec_config: { action: 'complete' } },
    ],
    edges: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 2, to: 3, label: '否', branch: 'false' },
      { from: 2, to: 4, label: '已确认', branch: 'true' },
      { from: 3, to: 4, label: '批准', branch: 'approved' },
      { from: 3, to: 5, label: '拒绝', branch: 'rejected' },
      { from: 4, to: 6 },
      { from: 5, to: 6 },
    ],
  },

  '宪法不可自我修改': {
    nodes: [
      { index: 0, title: '开始', node_kind: 'lifecycle', exec_config: { action: 'start' } },
      { index: 1, title: '检测宪法写入请求', node_kind: 'trigger', exec_config: { event: 'pre_page_write', filter: "page_type == 'constitution'" } },
      { index: 2, title: 'admin + 宪法编译器?', node_kind: 'condition', exec_config: { expression: "ctx.get('user_role') == 'admin' and ctx.get('via_constitution_ui', False)", description: '只有 admin 通过宪法编译器界面才能修改' } },
      { index: 3, title: '硬拦截', node_kind: 'block', exec_config: { reason: '违反 L1：宪法不可由 agent 自我修改', severity: 'critical' } },
      { index: 4, title: '完成', node_kind: 'lifecycle', exec_config: { action: 'complete' } },
    ],
    edges: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 2, to: 3, label: '否', branch: 'false' },
      { from: 2, to: 4, label: '是', branch: 'true' },
    ],
  },

  'LLM API 预算守护': {
    nodes: [
      { index: 0, title: '开始', node_kind: 'lifecycle', exec_config: { action: 'start' } },
      { index: 1, title: '节点发起 LLM 调用', node_kind: 'trigger', exec_config: { event: 'pre_llm_call', description: '任何 llm_call 节点执行前触发' } },
      { index: 2, title: '预算是否超限?', node_kind: 'condition', exec_config: { expression: "ctx.get('node_budget_tokens', 0) > 8000 or ctx.get('session_total_tokens', 0) > 50000", description: '单节点 8k / 全图 50k token 上限' } },
      { index: 3, title: '降级处理', node_kind: 'action', exec_config: { action: 'downgrade_model', fallback_model: 'ark-lite', description: '切换到更小模型或拆分任务' } },
      { index: 4, title: '完成', node_kind: 'lifecycle', exec_config: { action: 'complete' } },
    ],
    edges: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 2, to: 3, label: '超限', branch: 'true' },
      { from: 2, to: 4, label: '正常', branch: 'false' },
      { from: 3, to: 4 },
    ],
  },

  '隐私数据本地处理': {
    nodes: [
      { index: 0, title: '开始', node_kind: 'lifecycle', exec_config: { action: 'start' } },
      { index: 1, title: '检测 LLM 调用', node_kind: 'trigger', exec_config: { event: 'pre_llm_call', description: '任何包含 prompt 的 LLM 调用' } },
      { index: 2, title: '包含 PII 数据?', node_kind: 'condition', exec_config: { expression: "contains_pii(ctx.get('prompt', '')) or ctx.get('data_sensitivity') == 'private'", description: '身份/位置/医疗/财务等 PII 数据' } },
      { index: 3, title: '路由到本地模型', node_kind: 'action', exec_config: { action: 'override_model', model: 'local', description: '强制使用本地 Qwen 模型处理' } },
      { index: 4, title: '完成', node_kind: 'lifecycle', exec_config: { action: 'complete' } },
    ],
    edges: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 2, to: 3, label: '含PII', branch: 'true' },
      { from: 2, to: 4, label: '无PII', branch: 'false' },
      { from: 3, to: 4 },
    ],
  },
}

// ─── Auto Layout ──────────────────────────────────────────────────────────────

function autoLayout(graph: ExecGraph): Map<number, { x: number; y: number }> {
  const { nodes, edges } = graph
  const inDegree = new Map<number, number>()
  const adj = new Map<number, number[]>()
  nodes.forEach((n) => { inDegree.set(n.index, 0); adj.set(n.index, []) })
  edges.forEach((e) => {
    inDegree.set(e.to, (inDegree.get(e.to) || 0) + 1)
    adj.get(e.from)?.push(e.to)
  })

  const level = new Map<number, number>()
  const queue: number[] = []
  nodes.forEach((n) => {
    if ((inDegree.get(n.index) || 0) === 0) { level.set(n.index, 0); queue.push(n.index) }
  })
  while (queue.length > 0) {
    const cur = queue.shift()!
    const curLevel = level.get(cur) || 0
    adj.get(cur)?.forEach((next) => {
      if (!level.has(next) || level.get(next)! < curLevel + 1) {
        level.set(next, curLevel + 1)
        queue.push(next)
      }
    })
  }

  const levelGroups = new Map<number, number[]>()
  nodes.forEach((n) => {
    const lv = level.get(n.index) || 0
    if (!levelGroups.has(lv)) levelGroups.set(lv, [])
    levelGroups.get(lv)!.push(n.index)
  })

  const NODE_W = 180; const GAP_X = 50; const GAP_Y = 130; const CENTER_X = 240
  const positions = new Map<number, { x: number; y: number }>()
  levelGroups.forEach((indices, lv) => {
    const totalW = indices.length * NODE_W + (indices.length - 1) * GAP_X
    const startX = CENTER_X - totalW / 2
    indices.forEach((idx, i) => {
      positions.set(idx, { x: startX + i * (NODE_W + GAP_X), y: lv * GAP_Y + 20 })
    })
  })
  return positions
}

function edgeBranchColor(branch: string): string {
  const isRed = ['false', '否', '拒绝', 'rejected', '超限', '含PII'].includes(branch)
  const isGreen = ['true', '是', '批准', 'approved', '已确认', '正常', '无PII'].includes(branch)
  return isRed ? '#ef4444' : isGreen ? '#22c55e' : '#64748b'
}

function execGraphToFlow(graph: ExecGraph): { nodes: Node[]; edges: Edge[] } {
  const positions = autoLayout(graph)
  const rfNodes: Node[] = graph.nodes.map((n) => {
    const isLifecycle = n.node_kind === 'lifecycle'
    const kind = isLifecycle ? (n.exec_config.action === 'start' ? 'start' : 'end') : n.node_kind
    const detail = String(
      n.exec_config.expression || n.exec_config.event || n.exec_config.reason ||
      n.exec_config.description || n.exec_config.action || '',
    ).slice(0, 55)
    return {
      id: String(n.index),
      type: 'constitutionNode',
      position: positions.get(n.index) || { x: 0, y: 0 },
      // Store full exec_config + meta for round-trip back to ExecGraph
      data: { kind, label: n.title, detail, _index: n.index, _node_kind: n.node_kind, _exec_config: n.exec_config },
      draggable: true,
    }
  })

  const rfEdges: Edge[] = graph.edges.map((e, i) => {
    const b = e.branch || e.label || ''
    const color = edgeBranchColor(b)
    return {
      id: `e-${e.from}-${e.to}-${i}`,
      source: String(e.from),
      target: String(e.to),
      label: e.label,
      labelStyle: { fill: color, fontSize: 10, fontWeight: 600 },
      style: { stroke: color, strokeWidth: 1.5 },
      animated: e.from === 0,
      // Store original edge data for round-trip
      data: { _from: e.from, _to: e.to, _label: e.label, _branch: e.branch },
    }
  })
  return { nodes: rfNodes, edges: rfEdges }
}

/** React Flow nodes/edges → ExecGraph (uses stored _exec_config from node data) */
function flowToExecGraph(rfNodes: Node[], rfEdges: Edge[]): ExecGraph {
  const nodes: ExecNode[] = rfNodes
    .map((n) => ({
      index: (n.data._index as number) ?? parseInt(n.id),
      title: n.data.label as string,
      node_kind: (n.data._node_kind as string) ?? 'action',
      exec_config: (n.data._exec_config as Record<string, unknown>) ?? {},
    }))
    .sort((a, b) => a.index - b.index)

  const edges: ExecEdge[] = rfEdges.map((e) => {
    const d = e.data as Record<string, unknown> | undefined
    return {
      from: (d?._from as number) ?? parseInt(e.source),
      to: (d?._to as number) ?? parseInt(e.target),
      label: (d?._label as string | undefined) ?? (typeof e.label === 'string' ? e.label : undefined),
      branch: (d?._branch as string | undefined),
    }
  })
  return { nodes, edges }
}

// ─── Custom Node ──────────────────────────────────────────────────────────────

function ConstitutionNode({ data }: NodeProps) {
  const kind = (data.kind as string) || 'action'
  const s = NODE_KIND_STYLE[kind] || NODE_KIND_STYLE.action
  const isTerminal = kind === 'start' || kind === 'end'
  return (
    <div style={{
      background: s.bg, border: `1.5px solid ${s.border}`,
      borderRadius: isTerminal ? '50%' : 8,
      width: isTerminal ? 48 : 170, height: isTerminal ? 48 : undefined,
      minHeight: isTerminal ? 48 : 56,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: isTerminal ? 0 : '8px 12px',
      boxShadow: `0 0 10px ${s.border}25`,
      userSelect: 'none', cursor: 'default',
    }}>
      {!isTerminal && <Handle type="target" position={Position.Top} style={{ background: s.border, width: 7, height: 7 }} />}
      {isTerminal ? (
        <span style={{ color: s.border, fontSize: 16, fontWeight: 700 }}>{s.icon}</span>
      ) : (
        <>
          <div style={{ color: s.border, fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3, opacity: 0.85 }}>
            {s.icon} {s.label}
          </div>
          <div style={{ color: '#f1f5f9', fontSize: 11, fontWeight: 500, textAlign: 'center', lineHeight: 1.4 }}>
            {data.label as string}
          </div>
          {data.detail && (
            <div style={{ color: '#64748b', fontSize: 9, marginTop: 3, textAlign: 'center', lineHeight: 1.3, wordBreak: 'break-all' }}>
              {data.detail as string}
            </div>
          )}
        </>
      )}
      {kind !== 'end' && <Handle type="source" position={Position.Bottom} style={{ background: s.border, width: 7, height: 7 }} />}
    </div>
  )
}

const nodeTypes = { constitutionNode: ConstitutionNode }

// ─── Main Component ───────────────────────────────────────────────────────────

const ConstitutionView: React.FC = () => {
  const [principles, setPrinciples] = useState<Principle[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [seedingAll, setSeedingAll] = useState(false)

  // Left panel edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editIcon, setEditIcon] = useState('')
  const [editLevel, setEditLevel] = useState('L2')
  const [newPrincipleTitle, setNewPrincipleTitle] = useState('')
  const [addingToParentId, setAddingToParentId] = useState<string | null>(null)

  // Right panel mode
  const [rightMode, setRightMode] = useState<'editor' | 'prvs'>('editor')

  // Right panel
  const [principleBlocks, setPrincipleBlocks] = useState<Block[]>([])
  const [generatingJson, setGeneratingJson] = useState(false)
  const saveBlocksTimeout = useRef<ReturnType<typeof setTimeout>>()
  const [jsonText, setJsonText] = useState('')
  const [jsonError, setJsonError] = useState('')
  const [savingGraph, setSavingGraph] = useState(false)
  const [simulating, setSimulating] = useState(false)
  const [generateError, setGenerateError] = useState('')
  const [graphFullscreen, setGraphFullscreen] = useState(false)

  // 节点编辑
  const [editingNodeId, setEditingNodeId]   = useState<string | null>(null)
  const [nodeEditTitle, setNodeEditTitle]   = useState('')
  const [nodeEditKind, setNodeEditKind]     = useState('action')
  const [nodeEditConfig, setNodeEditConfig] = useState('')
  const [nodeEditError, setNodeEditError]   = useState('')

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  // Refs for sync — avoids stale closure in callbacks
  const jsonTextRef = useRef('')
  const edgesRef = useRef<Edge[]>([])
  useEffect(() => { jsonTextRef.current = jsonText }, [jsonText])
  useEffect(() => { edgesRef.current = edges }, [edges])

  const [blocksLoading, setBlocksLoading] = useState(false)

  // ── Load blocks when selected principle changes ──────────────
  useEffect(() => {
    if (!selectedId) { setPrincipleBlocks([]); return }
    setPrincipleBlocks([])   // 先清空，防止旧数据传入新 BlockEditor
    setBlocksLoading(true)
    authFetch<Block[]>(`/pages/${selectedId}/blocks`)
      .then((blocks) => {
        if (blocks?.length) {
          setPrincipleBlocks(blocks)
        } else {
          // 无内容时初始化一个空段落块，保证可编辑
          const empty: Block = { id: generateBlockId(), type: 'paragraph', content: { rich_text: [] }, position: 1, parentId: null }
          setPrincipleBlocks([empty])
        }
      })
      .catch(() => setPrincipleBlocks([]))
      .finally(() => setBlocksLoading(false))
  }, [selectedId])

  function handleBlocksChange(blocks: Block[]) {
    setPrincipleBlocks(blocks)
    clearTimeout(saveBlocksTimeout.current)
    saveBlocksTimeout.current = setTimeout(() => {
      if (!selectedId) return
      authFetch(`/pages/${selectedId}/blocks`, { method: 'PUT', body: JSON.stringify(blocks) }).catch(console.error)
    }, 800)
  }

  // 从 blocks 提取纯文本供 LLM 使用
  function extractText(blocks: Block[]): string {
    return blocks.map((b) => {
      const segs = (b.content as { rich_text?: { text: string }[] })?.rich_text || []
      return segs.map((s) => s.text).join('')
    }).join('\n')
  }

  /** 构建 tags 元数据对象，保留所有字段不丢失 */
  function buildMeta(p: Principle, patch: { exec_graph?: ExecGraph; capability_dict?: CapabilityEntry[] }) {
    return JSON.stringify({
      layer: p.layer,
      level: p.level,
      ...(p.kind ? { kind: p.kind } : {}),
      ...(p.capability_dict ? { capability_dict: p.capability_dict } : {}),
      ...(p.exec_graph ? { exec_graph: p.exec_graph } : {}),
      ...patch,  // 覆盖更新字段
    })
  }

  // ── 点击节点 → 填充编辑表单 ──────────────────────────────────
  function handleGraphNodeClick(_e: React.MouseEvent, node: Node) {
    setEditingNodeId(node.id)
    setNodeEditTitle(node.data.label as string)
    setNodeEditKind(node.data._node_kind as string)
    setNodeEditConfig(JSON.stringify(node.data._exec_config || {}, null, 2))
    setNodeEditError('')
  }

  // ── 应用节点编辑 → 同步 nodes + JSON ─────────────────────────
  function applyNodeEdit() {
    if (!editingNodeId) return
    let config: Record<string, unknown>
    try { config = JSON.parse(nodeEditConfig) }
    catch { setNodeEditError('exec_config JSON 格式错误'); return }

    const isLifecycle = nodeEditKind === 'lifecycle'
    const action = (config as { action?: string }).action
    const kind = isLifecycle ? (action === 'start' ? 'start' : 'end') : nodeEditKind
    const detail = String(
      config.expression || config.event || config.reason || config.description || config.action || ''
    ).slice(0, 55)

    setNodes(prev => prev.map(n => n.id !== editingNodeId ? n : {
      ...n, data: { ...n.data, label: nodeEditTitle, kind, _node_kind: nodeEditKind, _exec_config: config, detail },
    }))

    try {
      const g: ExecGraph = JSON.parse(jsonTextRef.current || jsonText)
      const idx = parseInt(editingNodeId)
      const i = g.nodes.findIndex(n => n.index === idx)
      if (i >= 0) {
        g.nodes[i] = { ...g.nodes[i], title: nodeEditTitle, node_kind: nodeEditKind, exec_config: config }
        setJsonText(JSON.stringify(g, null, 2))
        setJsonError('')
      }
    } catch { /* keep graph as-is */ }
    setEditingNodeId(null)
    setNodeEditError('')
  }

  // ── 添加新节点 ────────────────────────────────────────────────
  function addGraphNode() {
    const g: ExecGraph = (() => {
      try { return JSON.parse(jsonText || '{"nodes":[],"edges":[]}') }
      catch { return { nodes: [], edges: [] } }
    })()
    const newIdx = g.nodes.reduce((m, n) => Math.max(m, n.index), -1) + 1
    g.nodes.push({ index: newIdx, title: '新节点', node_kind: 'action', exec_config: { description: '' } })
    const newText = JSON.stringify(g, null, 2)
    setJsonText(newText)
    const { nodes: rfN, edges: rfE } = execGraphToFlow(g)
    setNodes(rfN); setEdges(rfE)
    setJsonError('')
    // 自动选中编辑
    setEditingNodeId(String(newIdx))
    setNodeEditTitle('新节点')
    setNodeEditKind('action')
    setNodeEditConfig('{\n  "description": ""\n}')
    setNodeEditError('')
  }

  // ── 删除选中节点 ──────────────────────────────────────────────
  function deleteEditingNode() {
    if (!editingNodeId) return
    const idx = parseInt(editingNodeId)
    try {
      const g: ExecGraph = JSON.parse(jsonText)
      g.nodes = g.nodes.filter(n => n.index !== idx)
      g.edges = g.edges.filter(e => e.from !== idx && e.to !== idx)
      const newText = JSON.stringify(g, null, 2)
      setJsonText(newText)
      const { nodes: rfN, edges: rfE } = execGraphToFlow(g)
      setNodes(rfN); setEdges(rfE)
      setJsonError('')
    } catch { /* ignore */ }
    setEditingNodeId(null)
  }

  async function generateJson() {
    if (!selected) return
    const currentSelected = selected   // 闭包捕获，避免异步期间 selected 变化
    setGeneratingJson(true)
    setGenerateError('')
    setJsonText('')   // 清空，准备流式填充
    setJsonError('')

    const token = getToken()
    try {
      const response = await fetch('/api/constitution/generate-graph', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ title: currentSelected.title, content: extractText(principleBlocks) }),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          let data: { text?: string; done?: boolean; graph?: ExecGraph; error?: string }
          try { data = JSON.parse(line.slice(6)) } catch { continue }

          if (data.text) {
            // 流式追加 token 到 JSON 区域
            setJsonText((prev) => prev + data.text)
          }
          if (data.error) throw new Error(data.error)
          if (data.done && data.graph) {
            const graph = data.graph
            // 用整洁格式替换流式原始文本
            setJsonText(JSON.stringify(graph, null, 2))
            setJsonError('')
            const { nodes: rfN, edges: rfE } = execGraphToFlow(graph)
            setNodes(rfN); setEdges(rfE)
            // 自动持久化
            const meta = buildMeta(currentSelected, { exec_graph: graph })
            await authFetch(`/pages/${currentSelected.id}`, {
              method: 'PATCH',
              body: JSON.stringify({ tags: meta }),
            })
            setPrinciples((prev) => updatePrincipleInTree(prev, currentSelected.id, { exec_graph: graph }))
          }
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('Generate failed:', msg)
      setGenerateError(msg)
    }
    setGeneratingJson(false)
  }

  /** User draws a new edge → add to JSON */
  const onConnect = useCallback(
    (params: Parameters<typeof addEdge>[0]) => {
      setEdges((eds) => addEdge(params, eds))
      try {
        const g: ExecGraph = JSON.parse(jsonTextRef.current)
        const from = parseInt(params.source!)
        const to = parseInt(params.target!)
        if (!g.edges.some((e) => e.from === from && e.to === to)) {
          g.edges.push({ from, to })
          const newText = JSON.stringify(g, null, 2)
          setJsonText(newText)
          setJsonError('')
        }
      } catch { /* ignore */ }
    },
    [setEdges],
  )

  /** User deletes an edge → remove from JSON */
  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChange(changes)
      const removedIds = new Set(
        changes.filter((c) => c.type === 'remove').map((c) => (c as { id: string }).id),
      )
      if (removedIds.size === 0) return
      // edgesRef.current still holds the pre-removal list at this point
      const remaining = edgesRef.current.filter((e) => !removedIds.has(e.id))
      try {
        const g = flowToExecGraph(nodes, remaining)
        const newText = JSON.stringify(g, null, 2)
        setJsonText(newText)
        setJsonError('')
      } catch { /* ignore */ }
    },
    [onEdgesChange, nodes],
  )

  // ── Escape 关闭全屏 ───────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setGraphFullscreen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ── Load principles ───────────────────────────────────────────
  useEffect(() => { loadPrinciples() }, [])

  async function loadPrinciples() {
    setLoading(true)
    try {
      type RawPage = { id: string; parentId: string | null; title: string; icon: string; refId?: string; tags?: unknown }
      const data = await authFetch<RawPage[]>('/pages?type=constitution')
      if (!data || data.length === 0) {
        await seedDefaultPrinciples()
        return
      }
      const parsed: Principle[] = data.map((p) => {
        let meta: { layer?: string; level?: string; kind?: 'principle' | 'capability_dict'; exec_graph?: ExecGraph; capability_dict?: CapabilityEntry[] } = {}
        try {
          const raw = p.tags
          meta = !raw ? {} : typeof raw === 'string' ? JSON.parse(raw) : raw as typeof meta
        } catch { /* */ }
        return {
          id: p.id, parent_id: p.parentId, title: p.title,
          layer: meta.layer || 'meta',
          level: meta.level || 'L2', icon: p.icon || '📄',
          kind: meta.kind || 'principle',
          exec_graph: meta.exec_graph,
          capability_dict: meta.capability_dict,
        }
      })
      setPrinciples(buildTree(parsed))
    } catch (e) {
      console.error('Load principles failed:', e)
      setPrinciples(buildTreeFromDefaults())
    } finally {
      setLoading(false)
    }
  }

  function buildTree(flat: Principle[]): Principle[] {
    const map = new Map<string, Principle>()
    flat.forEach((p) => map.set(p.id, { ...p, children: [] }))
    const roots: Principle[] = []
    map.forEach((p) => {
      if (p.parent_id && map.has(p.parent_id)) map.get(p.parent_id)!.children!.push(p)
      else if (!p.parent_id) roots.push(p)
    })
    return roots
  }

  function buildTreeFromDefaults(): Principle[] {
    const roots: Principle[] = []
    const layerNodes: Record<string, Principle> = {}
    DEFAULT_PRINCIPLES.forEach((p, i) => {
      const node: Principle = { ...p, id: `local-${i}`, children: [], capability_dict: p.kind === 'capability_dict' ? DEFAULT_CAPABILITY_DICT : undefined }
      if (!p.parent_id) { roots.push(node); layerNodes[`__${p.layer}__`] = node }
      else {
        const parent = layerNodes[p.parent_id]
        if (parent) { parent.children = parent.children || []; parent.children.push(node) }
      }
    })
    return roots
  }

  async function seedDefaultPrinciples() {
    const created: Record<string, string> = {}
    for (const p of DEFAULT_PRINCIPLES) {
      try {
        const parentId = p.parent_id ? created[p.parent_id] || null : null
        const metaObj: Record<string, unknown> = { layer: p.layer, level: p.level }
        if (p.kind === 'capability_dict') { metaObj.kind = 'capability_dict'; metaObj.capability_dict = DEFAULT_CAPABILITY_DICT }
        const meta = JSON.stringify(metaObj)
        const created_page = await authFetch<{ id: string }>('/pages', {
          method: 'POST',
          body: JSON.stringify({ title: p.title, icon: p.icon, pageType: 'constitution', parentId, tags: meta }),
        })
        if (created_page.id && p.parent_id === null) created[`__${p.layer}__`] = created_page.id
      } catch (e) { console.warn('Seed failed for:', p.title, e) }
    }
    await loadPrinciples()
  }

  // ── Seed all execution graphs ─────────────────────────────────
  async function seedExecGraphs() {
    setSeedingAll(true)
    const flat: Principle[] = []
    const flatten = (list: Principle[]) => { list.forEach((p) => { flat.push(p); if (p.children) flatten(p.children) }) }
    flatten(principles)

    for (const p of flat) {
      if (p.exec_graph) continue
      const defaultGraph = DEFAULT_EXEC_GRAPHS[p.title]
      if (!defaultGraph) continue
      const meta = JSON.stringify({ layer: p.layer, level: p.level, exec_graph: defaultGraph })
      try {
        await authFetch(`/pages/${p.id}`, { method: 'PATCH', body: JSON.stringify({ tags: meta }) })
      } catch (e) { console.warn('Seed graph failed:', p.title, e) }
    }
    await loadPrinciples()
    setSeedingAll(false)
  }

  // ── Selection → load graph ────────────────────────────────────
  const selected = useMemo(() => {
    function find(list: Principle[]): Principle | null {
      for (const p of list) {
        if (p.id === selectedId) return p
        if (p.children) { const f = find(p.children); if (f) return f }
      }
      return null
    }
    return find(principles)
  }, [selectedId, principles])

  useEffect(() => {
    if (!selected) { setNodes([]); setEdges([]); setJsonText(''); return }
    if (selected.exec_graph) {
      const { nodes: rfNodes, edges: rfEdges } = execGraphToFlow(selected.exec_graph)
      setNodes(rfNodes)
      setEdges(rfEdges)
      setJsonText(JSON.stringify(selected.exec_graph, null, 2))
    } else {
      setNodes([]); setEdges([])
      setJsonText('')
    }
    setJsonError('')
  }, [selected]) // selected 变化时重新加载（包含 exec_graph 数据）

  // ── JSON editor ───────────────────────────────────────────────
  function handleJsonChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const text = e.target.value
    setJsonText(text)
    jsonTextRef.current = text   // update ref immediately for onConnect/handleEdgesChange
    try {
      const parsed: ExecGraph = JSON.parse(text)
      if (Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
        const { nodes: rfNodes, edges: rfEdges } = execGraphToFlow(parsed)
        setNodes(rfNodes)
        setEdges(rfEdges)
        setJsonError('')
      }
    } catch { setJsonError('JSON 格式错误') }
  }

  async function saveGraphJson() {
    if (!selected) return
    let graph: ExecGraph
    try { graph = JSON.parse(jsonText) }
    catch { setJsonError('保存失败：JSON 格式错误'); return }
    setSavingGraph(true)
    try {
      const meta = buildMeta(selected, { exec_graph: graph })
      await authFetch(`/pages/${selected.id}`, { method: 'PATCH', body: JSON.stringify({ tags: meta }) })
      setPrinciples((prev) => updatePrincipleInTree(prev, selected.id, { exec_graph: graph }))
      setJsonError('')
    } catch (e) { setJsonError('保存失败'); console.error(e) }
    setSavingGraph(false)
  }

  // ── Simulate ──────────────────────────────────────────────────
  async function handleSimulate() {
    if (edges.length === 0) return
    setSimulating(true)
    for (let i = 0; i < Math.min(edges.length, 6); i++) {
      await new Promise((r) => setTimeout(r, 500))
      setEdges((eds) => eds.map((e, idx) =>
        idx === i ? { ...e, animated: true, style: { ...e.style, stroke: '#a855f7', strokeWidth: 2.5 } } : e,
      ))
    }
    await new Promise((r) => setTimeout(r, 800))
    // Reset to original colors from current jsonText
    try {
      const graph: ExecGraph = JSON.parse(jsonText)
      const { edges: rfEdges } = execGraphToFlow(graph)
      setEdges(rfEdges)
    } catch { /* ignore */ }
    setSimulating(false)
  }

  // ── Save capability dict ──────────────────────────────────────
  async function saveCapabilityDict(dict: CapabilityEntry[]) {
    if (!selected) return
    const meta = JSON.stringify({ layer: selected.layer, level: selected.level, kind: 'capability_dict', capability_dict: dict })
    await authFetch(`/pages/${selected.id}`, { method: 'PATCH', body: JSON.stringify({ tags: meta }) })
    setPrinciples((prev) => updatePrincipleInTree(prev, selected.id, { capability_dict: dict }))
  }

  // ── Export constitution.json ──────────────────────────────────
  function exportConstitution() {
    const flat: Principle[] = []
    const flatten = (list: Principle[]) => { list.forEach((p) => { flat.push(p); if (p.children) flatten(p.children) }) }
    flatten(principles)
    const payload = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      capability_dict: flat.find((p) => p.kind === 'capability_dict')?.capability_dict || DEFAULT_CAPABILITY_DICT,
      principles: flat.filter((p) => p.kind !== 'capability_dict').map((p) => ({
        id: p.id, title: p.title, layer: p.layer, level: p.level,
        hard_constraint: p.level === 'L1',
        enforcement_graph: p.exec_graph || null,
      })),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'constitution.json'; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Left panel edit ───────────────────────────────────────────
  function startEdit(p: Principle) {
    setEditingId(p.id); setEditTitle(p.title); setEditIcon(p.icon); setEditLevel(p.level)
  }

  async function saveEdit(p: Principle) {
    const meta = JSON.stringify({ layer: p.layer, level: editLevel, exec_graph: p.exec_graph })
    try {
      await authFetch(`/pages/${p.id}`, { method: 'PATCH', body: JSON.stringify({ title: editTitle, icon: editIcon, tags: meta }) })
      setPrinciples((prev) => updatePrincipleInTree(prev, p.id, { title: editTitle, icon: editIcon, level: editLevel }))
    } catch (e) { console.error('Save failed:', e) }
    setEditingId(null)
  }

  function updatePrincipleInTree(list: Principle[], id: string, patch: Partial<Principle>): Principle[] {
    return list.map((p) => ({
      ...p, ...(p.id === id ? patch : {}),
      children: p.children ? updatePrincipleInTree(p.children, id, patch) : undefined,
    }))
  }

  async function deletePrinciple(p: Principle) {
    if (!confirm(`删除原则「${p.title}」？`)) return
    try {
      await authFetch(`/pages/${p.id}`, { method: 'DELETE' })
      setPrinciples((prev) => removePrincipleFromTree(prev, p.id))
      if (selectedId === p.id) setSelectedId(null)
    } catch (e) { console.error('Delete failed:', e) }
  }

  function removePrincipleFromTree(list: Principle[], id: string): Principle[] {
    return list.filter((p) => p.id !== id)
      .map((p) => ({ ...p, children: p.children ? removePrincipleFromTree(p.children, id) : undefined }))
  }

  async function addPrinciple(parentId: string, layer: string) {
    if (!newPrincipleTitle.trim()) return
    const meta = JSON.stringify({ layer, level: 'L2' })
    try {
      const created = await authFetch<{ id: string; title: string; icon: string }>('/pages', {
        method: 'POST',
        body: JSON.stringify({ title: newPrincipleTitle.trim(), icon: '📝', pageType: 'constitution', parentId, tags: meta }),
      })
      const newP: Principle = { id: created.id, parent_id: parentId, title: created.title, icon: created.icon || '📝', layer, level: 'L2', children: [] }
      setPrinciples((prev) => insertIntoTree(prev, parentId, newP))
      setExpandedIds((s) => new Set([...s, parentId]))
    } catch (e) { console.error('Add failed:', e) }
    setNewPrincipleTitle(''); setAddingToParentId(null)
  }

  function insertIntoTree(list: Principle[], parentId: string, newNode: Principle): Principle[] {
    return list.map((p) => {
      if (p.id === parentId) return { ...p, children: [...(p.children || []), newNode] }
      if (p.children) return { ...p, children: insertIntoTree(p.children, parentId, newNode) }
      return p
    })
  }

  // ── Stats for seed button ─────────────────────────────────────
  const missingGraphCount = useMemo(() => {
    let count = 0
    const count_ = (list: Principle[]) => { list.forEach((p) => { if (!p.exec_graph && DEFAULT_EXEC_GRAPHS[p.title]) count++; if (p.children) count_(p.children) }) }
    count_(principles)
    return count
  }, [principles])

  const hasGraph = nodes.length > 0

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full -m-6 overflow-hidden">

      {/* ── Left: Constitution Tree ── */}
      <div className="w-72 shrink-0 flex flex-col bg-[#0d0d0d] border-r border-white/[0.07]">
        {/* Header */}
        <div className="shrink-0 px-3 py-2.5 border-b border-white/[0.07]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Shield size={14} className="text-red-400" />
              <span className="text-sm font-semibold text-white/90">控制论宪法</span>
            </div>
            <button onClick={exportConstitution} className="p-1 rounded hover:bg-white/10 text-neutral-600 hover:text-neutral-300 transition-colors" title="导出 constitution.json">
              <Download size={13} />
            </button>
          </div>
          {missingGraphCount > 0 && (
            <button
              onClick={seedExecGraphs}
              disabled={seedingAll}
              className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] font-medium bg-orange-500/10 border border-orange-500/20 text-orange-400 hover:bg-orange-500/20 transition-colors disabled:opacity-50"
            >
              {seedingAll ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
              {seedingAll ? '生成中...' : `种入全部执行图 (${missingGraphCount} 条)`}
            </button>
          )}
        </div>

        {/* Tree */}
        <div className="flex-1 overflow-y-auto py-2 px-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={18} className="animate-spin text-neutral-600" />
            </div>
          ) : (
            principles.map((node) => (
              <TreeNode
                key={node.id}
                node={node}
                depth={0}
                selectedId={selectedId}
                onSelect={setSelectedId}
                expandedIds={expandedIds}
                onToggleExpand={(id) => setExpandedIds((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })}
                editingId={editingId}
                editTitle={editTitle} editIcon={editIcon} editLevel={editLevel}
                onEditTitleChange={setEditTitle} onEditIconChange={setEditIcon}
                onEditLevelChange={setEditLevel}
                onStartEdit={startEdit} onSaveEdit={saveEdit} onCancelEdit={() => setEditingId(null)}
                onDelete={deletePrinciple}
                addingToParentId={addingToParentId}
                newPrincipleTitle={newPrincipleTitle}
                onNewPrincipleTitleChange={setNewPrincipleTitle}
                onStartAdd={(id) => { setAddingToParentId(id); setNewPrincipleTitle(''); setExpandedIds((s) => new Set([...s, id])) }}
                onConfirmAdd={(parentId, layer) => addPrinciple(parentId, layer)}
                onCancelAdd={() => { setAddingToParentId(null); setNewPrincipleTitle('') }}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Right: 三区域纵向布局 ── */}
      <div className="flex-1 flex flex-col bg-[#0f0f0f] overflow-hidden">

        {/* 顶部标题栏 */}
        <div className="shrink-0 h-11 px-4 border-b border-white/[0.07] flex items-center gap-3">
          {rightMode === 'editor' ? (
            selected ? (
              <>
                <span className="text-lg">{selected.icon}</span>
                <span className="text-sm font-medium text-white/90 truncate">{selected.title}</span>
                <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${selected.level === 'L1' ? 'bg-red-500/20 text-red-400' : selected.level === 'L2' ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'}`}>
                  {selected.level}
                </span>
                <span className={`shrink-0 text-[10px] ${selected.exec_graph ? 'text-green-500' : 'text-neutral-700'}`}>
                  {selected.exec_graph ? '✓ 有执行图' : '⚠ 无执行图'}
                </span>
              </>
            ) : (
              <span className="text-sm text-neutral-600">← 选择左侧原则开始编辑</span>
            )
          ) : (
            <span className="text-sm font-semibold text-white/80 font-mono">PRVS 指令集</span>
          )}
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => setRightMode('editor')}
              className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${rightMode === 'editor' ? 'bg-white/10 text-white/80' : 'text-neutral-600 hover:text-neutral-400'}`}
            >
              宪法
            </button>
            <button
              onClick={() => setRightMode('prvs')}
              className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${rightMode === 'prvs' ? 'bg-violet-500/20 text-violet-400' : 'text-neutral-600 hover:text-neutral-400'}`}
            >
              PRVS
            </button>
          </div>
        </div>

        {rightMode === 'prvs' ? (
          <div className="flex-1 overflow-hidden">
            <PRVSPanel />
          </div>
        ) : !selected ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-neutral-700 select-none">
            <Layers size={36} strokeWidth={1} />
            <div className="text-center">
              <p className="text-sm font-medium text-neutral-600">宪法编译器</p>
              <p className="text-xs text-neutral-700 mt-1">选择左侧原则，查看内容 · 生成 JSON · 渲染执行图</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">

            {/* ── 区域 1：内容 ── */}
            <div className="border-b border-white/[0.07]">
              <div className="flex items-center justify-between px-4 py-2">
                <span className="text-[10px] font-semibold text-neutral-500 tracking-wider uppercase">内容</span>
                <div className="flex items-center gap-2">
                  {generateError && <span className="text-[10px] text-red-400 max-w-[240px] truncate" title={generateError}>{generateError}</span>}
                  <button
                    onClick={generateJson}
                    disabled={generatingJson}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs bg-violet-600/15 border border-violet-500/30 text-violet-400 hover:bg-violet-600/25 disabled:opacity-50 transition-colors"
                  >
                    {generatingJson ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                    生成 JSON
                  </button>
                </div>
              </div>
              <div className="px-2 pb-2">
                {blocksLoading ? (
                  <div className="flex items-center gap-2 px-2 py-4 text-neutral-600">
                    <Loader2 size={14} className="animate-spin" />
                    <span className="text-xs">加载内容...</span>
                  </div>
                ) : (
                  <BlockEditor
                    key={selected.id}
                    pageId={selected.id}
                    initialBlocks={principleBlocks}
                    onChange={handleBlocksChange}
                    permissions={{ canAdd: false, canDelete: false, canReorder: false }}
                  />
                )}
              </div>
            </div>

            {/* ── 区域 2：JSON ── */}
            <div className="border-b border-white/[0.07]">
              <div className="flex items-center justify-between px-4 py-2">
                <span className="text-[10px] font-semibold text-neutral-500 tracking-wider uppercase">JSON</span>
                <div className="flex items-center gap-2">
                  {jsonError && <span className="text-[10px] text-red-400">{jsonError}</span>}
                  {!jsonError && jsonText && <span className="text-[10px] text-green-600">✓ valid</span>}
                  <button
                    onClick={saveGraphJson}
                    disabled={savingGraph || !!jsonError || !jsonText}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs bg-white/5 border border-white/10 text-neutral-400 hover:bg-white/10 disabled:opacity-40 transition-colors"
                  >
                    {savingGraph ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />} 保存
                  </button>
                  <button
                    onClick={() => {
                      try {
                        const g: ExecGraph = JSON.parse(jsonText)
                        const { nodes: rfN, edges: rfE } = execGraphToFlow(g)
                        setNodes(rfN); setEdges(rfE)
                        setJsonError('')
                      } catch { setJsonError('JSON 格式错误') }
                    }}
                    disabled={!jsonText}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs bg-blue-600/15 border border-blue-500/30 text-blue-400 hover:bg-blue-600/25 disabled:opacity-40 transition-colors"
                  >
                    <Play size={10} /> 渲染执行图
                  </button>
                </div>
              </div>
              <textarea
                value={jsonText || ''}
                onChange={handleJsonChange}
                placeholder={`{\n  "nodes": [\n    { "index": 0, "title": "开始", "node_kind": "lifecycle", "exec_config": { "action": "start" } },\n    ...\n  ],\n  "edges": [{ "from": 0, "to": 1 }]\n}`}
                rows={10}
                className="w-full px-4 pb-4 font-mono text-[11px] leading-relaxed text-emerald-300/75 bg-transparent resize-none outline-none placeholder-neutral-800"
                spellCheck={false}
              />
            </div>

            {/* ── 区域 3：执行图 ── */}
            <div>
              <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.04]">
                <span className="text-[10px] font-semibold text-neutral-500 tracking-wider uppercase">执行图</span>
                <div className="flex items-center gap-1.5">
                  <button onClick={addGraphNode}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs bg-white/5 border border-white/10 text-neutral-400 hover:text-green-400 hover:border-green-500/30 hover:bg-green-600/10 transition-colors"
                    title="添加节点">
                    <Plus size={10} /> 节点
                  </button>
                  {hasGraph && (
                    <>
                      <button onClick={handleSimulate} disabled={simulating}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs bg-green-600/15 border border-green-500/30 text-green-400 hover:bg-green-600/25 disabled:opacity-40 transition-colors">
                        {simulating ? <Loader2 size={10} className="animate-spin" /> : <Play size={10} />} 模拟
                      </button>
                      <button onClick={() => setGraphFullscreen(true)}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs bg-white/5 border border-white/10 text-neutral-400 hover:bg-white/10 transition-colors"
                        title="全屏查看 (Esc 关闭)">
                        <Maximize2 size={10} /> 全屏
                      </button>
                    </>
                  )}
                </div>
              </div>
              {selected.kind === 'capability_dict' ? (
                <CapabilityDictEditor principle={selected} onSave={saveCapabilityDict} />
              ) : !hasGraph ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-neutral-700">
                  <p className="text-xs">尚无执行图 — 填写内容后点击「生成 JSON」，或手动「+ 节点」构建</p>
                  {DEFAULT_EXEC_GRAPHS[selected.title] && (
                    <button onClick={async () => {
                      const g = DEFAULT_EXEC_GRAPHS[selected.title]
                      const meta = JSON.stringify({ layer: selected.layer, level: selected.level, exec_graph: g })
                      await authFetch(`/pages/${selected.id}`, { method: 'PATCH', body: JSON.stringify({ tags: meta }) })
                      setPrinciples((prev) => updatePrincipleInTree(prev, selected.id, { exec_graph: g }))
                      const { nodes: rfN, edges: rfE } = execGraphToFlow(g)
                      setNodes(rfN); setEdges(rfE)
                      setJsonText(JSON.stringify(g, null, 2))
                    }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs hover:bg-orange-500/25 transition-colors">
                      <Sparkles size={11} /> 种入预定义执行图
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex" style={{ height: 400 }}>
                  {/* 执行图画布 */}
                  <div className="flex-1 min-w-0">
                    <ExecGraphCanvas
                      nodes={nodes} edges={edges}
                      onNodesChange={onNodesChange}
                      onEdgesChange={handleEdgesChange}
                      onConnect={onConnect}
                      onNodeClick={handleGraphNodeClick}
                      selectedNodeId={editingNodeId}
                    />
                  </div>
                  {/* 节点编辑侧栏 */}
                  {editingNodeId && (
                    <div className="w-72 shrink-0 border-l border-white/[0.07] overflow-y-auto">
                      <NodeEditPanel
                        title={nodeEditTitle} onTitleChange={setNodeEditTitle}
                        kind={nodeEditKind} onKindChange={setNodeEditKind}
                        configText={nodeEditConfig} onConfigChange={setNodeEditConfig}
                        error={nodeEditError}
                        onApply={applyNodeEdit}
                        onDelete={deleteEditingNode}
                        onCancel={() => { setEditingNodeId(null); setNodeEditError('') }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      {/* ── 全屏执行图 overlay ── */}
      {graphFullscreen && hasGraph && (
        <div className="fixed inset-0 z-50 bg-[#080808] flex flex-col">
          {/* 全屏顶栏 */}
          <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-white/[0.07] bg-[#0d0d0d]">
            <div className="flex items-center gap-2">
              <span className="text-sm">{selected?.icon}</span>
              <span className="text-xs font-semibold text-white/80">{selected?.title}</span>
              <span className="text-[10px] text-neutral-600">执行图</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={addGraphNode}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs bg-white/5 border border-white/10 text-neutral-400 hover:text-green-400 hover:border-green-500/30 hover:bg-green-600/10 transition-colors">
                <Plus size={10} /> 节点
              </button>
              <button onClick={handleSimulate} disabled={simulating}
                className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs bg-green-600/15 border border-green-500/30 text-green-400 hover:bg-green-600/25 disabled:opacity-40 transition-colors">
                {simulating ? <Loader2 size={10} className="animate-spin" /> : <Play size={10} />} 模拟
              </button>
              <button onClick={() => setGraphFullscreen(false)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs bg-white/5 border border-white/10 text-neutral-400 hover:bg-white/10 transition-colors"
                title="退出全屏 (Esc)">
                <Minimize2 size={10} /> 退出全屏
              </button>
              <button onClick={() => setGraphFullscreen(false)}
                className="p-1.5 rounded hover:bg-white/10 text-neutral-600 hover:text-neutral-300 transition-colors">
                <X size={14} />
              </button>
            </div>
          </div>
          {/* 全屏主体：画布 + 右侧编辑栏 */}
          <div className="flex-1 min-h-0 flex">
            <div className="flex-1 min-w-0">
              <ExecGraphCanvas
                nodes={nodes} edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={handleEdgesChange}
                onConnect={onConnect}
                onNodeClick={handleGraphNodeClick}
                selectedNodeId={editingNodeId}
              />
            </div>
            {editingNodeId && (
              <div className="w-72 shrink-0 border-l border-white/[0.07]">
                <NodeEditPanel
                  title={nodeEditTitle} onTitleChange={setNodeEditTitle}
                  kind={nodeEditKind} onKindChange={setNodeEditKind}
                  configText={nodeEditConfig} onConfigChange={setNodeEditConfig}
                  error={nodeEditError}
                  onApply={applyNodeEdit}
                  onDelete={deleteEditingNode}
                  onCancel={() => { setEditingNodeId(null); setNodeEditError('') }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── NodeEditPanel ────────────────────────────────────────────────────────────

const NODE_KIND_OPTIONS_EDIT = [
  { value: 'lifecycle',   label: 'lifecycle  — 生命周期' },
  { value: 'trigger',     label: 'trigger    — 事件触发' },
  { value: 'condition',   label: 'condition  — 条件分支' },
  { value: 'action',      label: 'action     — 执行动作' },
  { value: 'human_gate',  label: 'human_gate — 人工审批' },
  { value: 'block',       label: 'block      — 硬拦截' },
]

function NodeEditPanel({
  title, onTitleChange, kind, onKindChange,
  configText, onConfigChange, error,
  onApply, onDelete, onCancel,
}: {
  title: string; onTitleChange: (v: string) => void
  kind: string;  onKindChange:  (v: string) => void
  configText: string; onConfigChange: (v: string) => void
  error: string
  onApply: () => void; onDelete: () => void; onCancel: () => void
}) {
  return (
    <div className="h-full bg-[#0d0d0d] px-3 py-3 flex flex-col gap-3">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-neutral-500 tracking-wider uppercase">编辑节点</span>
        <button onClick={onCancel}
          className="p-1 rounded hover:bg-white/10 text-neutral-600 hover:text-neutral-300 transition-colors">
          <X size={12} />
        </button>
      </div>

      {/* 标题 */}
      <div className="space-y-1">
        <label className="block text-[10px] text-neutral-500">标题</label>
        <input
          value={title}
          onChange={e => onTitleChange(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-blue-500/40 transition-colors"
        />
      </div>

      {/* node_kind */}
      <div className="space-y-1">
        <label className="block text-[10px] text-neutral-500">node_kind</label>
        <select
          value={kind}
          onChange={e => onKindChange(e.target.value)}
          className="w-full bg-[#111] border border-white/10 rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-blue-500/40 cursor-pointer"
        >
          {NODE_KIND_OPTIONS_EDIT.map(o => (
            <option key={o.value} value={o.value} className="bg-neutral-900">{o.label}</option>
          ))}
        </select>
      </div>

      {/* exec_config */}
      <div className="flex-1 flex flex-col space-y-1 min-h-0">
        <label className="block text-[10px] text-neutral-500 shrink-0">exec_config (JSON)</label>
        <textarea
          value={configText}
          onChange={e => onConfigChange(e.target.value)}
          spellCheck={false}
          className="flex-1 min-h-[80px] w-full bg-white/5 border border-white/10 rounded px-2.5 py-2 text-[11px] font-mono text-emerald-300/80 outline-none focus:border-blue-500/40 resize-none"
        />
      </div>

      {/* 错误提示 */}
      {error && <p className="text-[10px] text-red-400 shrink-0">{error}</p>}

      {/* 操作按钮 */}
      <div className="shrink-0 flex flex-col gap-1.5">
        <button onClick={onApply}
          className="w-full py-1.5 rounded-md text-xs bg-blue-600/20 border border-blue-500/30 text-blue-400 hover:bg-blue-600/30 transition-colors font-medium">
          应用修改
        </button>
        <button onClick={onDelete}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors">
          <Trash2 size={10} /> 删除节点
        </button>
      </div>
    </div>
  )
}

// ─── ExecGraphCanvas — ReactFlow 画布（内嵌 + 全屏复用）────────────────────────

function ExecGraphCanvas({ nodes, edges, onNodesChange, onEdgesChange, onConnect, onNodeClick, selectedNodeId }: {
  nodes: Node[]
  edges: Edge[]
  onNodesChange: (c: Parameters<ReturnType<typeof useNodesState>[2]>[0]) => void
  onEdgesChange: (c: EdgeChange[]) => void
  onConnect: (p: Parameters<typeof addEdge>[0]) => void
  onNodeClick?: (e: React.MouseEvent, node: Node) => void
  selectedNodeId?: string | null
}) {
  // 选中节点高亮 ring
  const displayNodes = selectedNodeId
    ? nodes.map(n => n.id === selectedNodeId
        ? { ...n, style: { ...n.style, outline: '2px solid #818cf8', outlineOffset: 2, borderRadius: 8 } }
        : n)
    : nodes

  return (
    <ReactFlow
      nodes={displayNodes} edges={edges}
      onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
      onNodeClick={onNodeClick}
      nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.2 }}
      defaultEdgeOptions={{ type: 'smoothstep' }}
      colorMode="dark"
      style={{ background: '#0a0a0a', width: '100%', height: '100%' }}
    >
      <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#ffffff0e" />
      <Controls style={{ '--xy-controls-button-background-color': '#1a1a1a', '--xy-controls-button-border-color': '#ffffff15', '--xy-controls-button-color': '#94a3b8', '--xy-controls-button-background-color-hover': '#2a2a2a' } as React.CSSProperties} />
      <MiniMap
        style={{ background: '#0f0f0f', border: '1px solid #ffffff10', borderRadius: 8 }}
        maskColor="rgba(10,10,10,0.7)"
        nodeColor={(n) => NODE_KIND_STYLE[(n.data?.kind as string) || 'action']?.border || '#64748b'}
      />
      <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, background: '#111', border: '1px solid #ffffff10', borderRadius: 8, padding: '8px 12px' }}>
        <p style={{ color: '#475569', fontSize: 9, fontWeight: 700, letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase' }}>点击节点可编辑</p>
        {Object.entries(NODE_KIND_STYLE).filter(([k]) => !['start', 'end'].includes(k)).map(([kind, s]) => (
          <div key={kind} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: s.bg, border: `1px solid ${s.border}` }} />
            <span style={{ color: '#475569', fontSize: 9 }}>{s.label}</span>
          </div>
        ))}
      </div>
    </ReactFlow>
  )
}

// ─── TreeNode — universal recursive node ─────────────────────────────────────

interface TreeNodeProps {
  node: Principle
  depth: number
  selectedId: string | null
  onSelect: (id: string) => void
  expandedIds: Set<string>
  onToggleExpand: (id: string) => void
  editingId: string | null
  editTitle: string; editIcon: string; editLevel: string
  onEditTitleChange: (v: string) => void; onEditIconChange: (v: string) => void
  onEditLevelChange: (v: string) => void
  onStartEdit: (p: Principle) => void; onSaveEdit: (p: Principle) => void; onCancelEdit: () => void
  onDelete: (p: Principle) => void
  addingToParentId: string | null
  newPrincipleTitle: string
  onNewPrincipleTitleChange: (v: string) => void
  onStartAdd: (id: string) => void
  onConfirmAdd: (parentId: string, layer: string) => void
  onCancelAdd: () => void
}

function TreeNode({
  node, depth, selectedId, onSelect, expandedIds, onToggleExpand,
  editingId, editTitle, editIcon, editLevel,
  onEditTitleChange, onEditIconChange, onEditLevelChange,
  onStartEdit, onSaveEdit, onCancelEdit, onDelete,
  addingToParentId, newPrincipleTitle, onNewPrincipleTitleChange,
  onStartAdd, onConfirmAdd, onCancelAdd,
}: TreeNodeProps) {
  const isExpanded = expandedIds.has(node.id)
  const hasChildren = (node.children?.length ?? 0) > 0
  const isEditing = editingId === node.id
  const isAdding = addingToParentId === node.id
  const isSelected = selectedId === node.id
  const isRoot = depth === 0

  const layerMeta = LAYER_META[node.layer] || LAYER_META.meta
  const levelMeta = LEVEL_META[node.level] || LEVEL_META.L2
  const hasGraph = !!node.exec_graph

  const INDENT = 14  // px per level
  const paddingLeft = depth * INDENT + 8

  const sharedProps: Omit<TreeNodeProps, 'node' | 'depth'> = {
    selectedId, onSelect, expandedIds, onToggleExpand,
    editingId, editTitle, editIcon, editLevel,
    onEditTitleChange, onEditIconChange, onEditLevelChange,
    onStartEdit, onSaveEdit, onCancelEdit, onDelete,
    addingToParentId, newPrincipleTitle, onNewPrincipleTitleChange,
    onStartAdd, onConfirmAdd, onCancelAdd,
  }

  return (
    <div>
      {/* ── Edit mode ── */}
      {isEditing ? (
        <div className="my-0.5 rounded-md bg-white/[0.07] border border-white/15 p-2.5 space-y-2" style={{ marginLeft: paddingLeft }}>
          <div className="flex gap-2">
            <input type="text" value={editIcon} onChange={(e) => onEditIconChange(e.target.value)} maxLength={4}
              className="w-9 text-center text-base bg-white/5 border border-white/10 rounded p-1 outline-none focus:border-white/25" />
            <input autoFocus type="text" value={editTitle} onChange={(e) => onEditTitleChange(e.target.value)}
              placeholder="原则标题" className="flex-1 text-xs text-white bg-white/5 border border-white/10 rounded px-2 py-1 outline-none focus:border-white/25" />
          </div>
          <div className="flex gap-1.5 items-center">
            {(['L1', 'L2', 'L3'] as const).map((lv) => (
              <button key={lv} onClick={() => onEditLevelChange(lv)}
                className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-colors ${
                  editLevel === lv
                    ? lv === 'L1' ? 'bg-red-500/25 text-red-300 border-red-500/50'
                      : lv === 'L2' ? 'bg-orange-500/25 text-orange-300 border-orange-500/50'
                      : 'bg-blue-500/25 text-blue-300 border-blue-500/50'
                    : 'bg-white/5 text-neutral-600 border-transparent hover:bg-white/10'
                }`}>{lv}</button>
            ))}
          </div>
          <div className="flex gap-1.5">
            <button onClick={() => onSaveEdit(node)} className="text-[10px] px-2.5 py-1 rounded bg-green-600/20 text-green-400 hover:bg-green-600/30 font-medium">保存</button>
            <button onClick={onCancelEdit} className="text-[10px] px-2.5 py-1 rounded bg-white/5 text-neutral-500 hover:bg-white/10">取消</button>
          </div>
        </div>
      ) : (
        /* ── Normal row ── */
        <div
          className={`group flex items-center gap-0.5 rounded-md my-0.5 transition-colors cursor-pointer
            ${isSelected ? 'bg-white/10 border border-white/10' : isRoot ? `${layerMeta.bg} hover:brightness-125` : 'hover:bg-white/5'}`}
          style={{ paddingLeft }}
          onClick={() => !isRoot && onSelect(node.id)}
        >
          {/* Expand toggle */}
          <button
            onClick={(e) => { e.stopPropagation(); if (hasChildren || isRoot) onToggleExpand(node.id) }}
            className="shrink-0 w-5 h-5 flex items-center justify-center text-neutral-600 hover:text-neutral-300"
          >
            {(hasChildren || isRoot)
              ? isExpanded
                ? <ChevronDown size={11} className={isRoot ? layerMeta.color : 'text-neutral-500'} />
                : <ChevronRight size={11} className={isRoot ? layerMeta.color : 'text-neutral-500'} />
              : <span className="w-2 h-2 rounded-full bg-neutral-800 inline-block" />
            }
          </button>

          {/* Icon + title */}
          <button
            className="flex-1 flex items-center gap-1.5 py-1.5 pr-1 min-w-0 text-left"
            onClick={(e) => { e.stopPropagation(); if (isRoot) onToggleExpand(node.id); else onSelect(node.id) }}
          >
            <span className={`shrink-0 ${isRoot ? 'text-sm' : 'text-xs'}`}>{node.icon}</span>
            <span className={`truncate font-medium ${isRoot ? `text-[11px] tracking-wide ${layerMeta.color}` : 'text-xs text-white/80'}`}>
              {isRoot ? layerMeta.label : node.title}
            </span>
            <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${levelMeta.dot}`} title={levelMeta.label} />
            {!isRoot && (hasGraph
              ? <Cpu size={9} className="shrink-0 text-green-500 opacity-70" aria-label="有执行图" />
              : DEFAULT_EXEC_GRAPHS[node.title]
                ? <Cpu size={9} className="shrink-0 text-orange-500/50" aria-label="可种入预定义图" />
                : null
            )}
          </button>

          {/* Actions (hover) */}
          <div className="shrink-0 flex items-center gap-0.5 pr-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={(e) => { e.stopPropagation(); onStartAdd(node.id) }}
              className="p-1 rounded hover:bg-white/10 text-neutral-600 hover:text-green-400 transition-colors" title="添加子条目">
              <Plus size={10} />
            </button>
            {!isRoot && (
              <>
                <button onClick={(e) => { e.stopPropagation(); onStartEdit(node) }}
                  className="p-1 rounded hover:bg-white/10 text-neutral-600 hover:text-blue-400 transition-colors" title="编辑">
                  <Pencil size={10} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); onDelete(node) }}
                  className="p-1 rounded hover:bg-white/10 text-neutral-600 hover:text-red-400 transition-colors" title="删除">
                  <Trash2 size={10} />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Children ── */}
      {isExpanded && (
        <>
          {node.children?.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} {...sharedProps} />
          ))}
          {/* Add input */}
          {isAdding && (
            <div className="my-1 p-2 rounded-md bg-white/5 border border-white/10" style={{ marginLeft: paddingLeft + INDENT + 8 }}>
              <input
                autoFocus type="text" placeholder="条目标题..."
                value={newPrincipleTitle}
                onChange={(e) => onNewPrincipleTitleChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') onConfirmAdd(node.id, node.layer); if (e.key === 'Escape') onCancelAdd() }}
                className="w-full text-xs text-white bg-transparent outline-none placeholder-neutral-600"
              />
              <div className="flex gap-1 mt-2">
                <button onClick={() => onConfirmAdd(node.id, node.layer)}
                  className="text-[10px] px-2 py-0.5 rounded bg-green-600/20 text-green-400 hover:bg-green-600/30">添加</button>
                <button onClick={onCancelAdd}
                  className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-neutral-500 hover:bg-white/10">取消</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Capability Dict Editor ───────────────────────────────────────────────────

const NODE_KIND_OPTIONS = ['llm_call', 'tool_call', 'local_judge', 'rule_branch', 'human_gate', 'lifecycle']
const TOOL_OPTIONS = ['claude_code', 'openclaw']

const NODE_KIND_COLOR: Record<string, string> = {
  llm_call:    'text-blue-400',
  tool_call:   'text-green-400',
  local_judge: 'text-yellow-400',
  rule_branch: 'text-orange-400',
  human_gate:  'text-purple-400',
  lifecycle:   'text-neutral-500',
}

function CapabilityDictEditor({ principle, onSave }: { principle: Principle; onSave: (dict: CapabilityEntry[]) => Promise<void> }) {
  const [dict, setDict] = useState<CapabilityEntry[]>(principle.capability_dict || DEFAULT_CAPABILITY_DICT)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  // Reset when switching principles
  useEffect(() => {
    setDict(principle.capability_dict || DEFAULT_CAPABILITY_DICT)
    setDirty(false)
  }, [principle.id])

  function update(i: number, patch: Partial<CapabilityEntry>) {
    setDict((d) => d.map((r, j) => j === i ? { ...r, ...patch } : r))
    setDirty(true)
  }

  function addRow() {
    setDict((d) => [...d, { trigger: '', node_kind: 'llm_call', description: '' }])
    setDirty(true)
  }

  function deleteRow(i: number) {
    setDict((d) => d.filter((_, j) => j !== i))
    setDirty(true)
  }

  async function handleSave() {
    setSaving(true)
    await onSave(dict)
    setSaving(false)
    setDirty(false)
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      {/* Header */}
      <div className="shrink-0 px-5 py-3 border-b border-white/[0.07] flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-white/80 mb-0.5">能力边界映射字典</p>
          <p className="text-[11px] text-neutral-600 leading-relaxed max-w-lg">
            子任务特征 → 执行节点类型。Agent 编译 NL2ExecGraph 时根据此字典决定每个子任务的 node_kind。
            修改后点击保存，<code className="text-neutral-500 font-mono text-[10px]">constitution.json</code> 导出时随之更新。
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-green-600/15 border border-green-500/30 text-green-400 hover:bg-green-600/25 disabled:opacity-40 transition-colors"
        >
          {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
          {dirty ? '保存更改' : '已保存'}
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-5 py-3">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="text-left py-2 pr-4 text-[10px] font-semibold text-neutral-600 tracking-wider uppercase w-2/5">子任务特征</th>
              <th className="text-left py-2 pr-4 text-[10px] font-semibold text-neutral-600 tracking-wider uppercase w-24">node_kind</th>
              <th className="text-left py-2 pr-4 text-[10px] font-semibold text-neutral-600 tracking-wider uppercase w-28">tool</th>
              <th className="text-left py-2 pr-4 text-[10px] font-semibold text-neutral-600 tracking-wider uppercase">说明</th>
              <th className="w-6" />
            </tr>
          </thead>
          <tbody>
            {dict.map((row, i) => (
              <tr key={i} className="group border-t border-white/[0.04] hover:bg-white/[0.03]">
                <td className="py-2 pr-3">
                  <input
                    value={row.trigger}
                    onChange={(e) => update(i, { trigger: e.target.value })}
                    className="w-full bg-transparent text-neutral-300 outline-none focus:text-white placeholder-neutral-700 text-[11px]"
                    placeholder="子任务特征描述..."
                  />
                </td>
                <td className="py-2 pr-3">
                  <select
                    value={row.node_kind}
                    onChange={(e) => update(i, { node_kind: e.target.value, tool: undefined })}
                    className={`bg-transparent outline-none font-mono text-[11px] font-semibold cursor-pointer ${NODE_KIND_COLOR[row.node_kind] || 'text-neutral-400'}`}
                  >
                    {NODE_KIND_OPTIONS.map((k) => (
                      <option key={k} value={k} className="bg-neutral-900 text-neutral-200">{k}</option>
                    ))}
                  </select>
                </td>
                <td className="py-2 pr-3">
                  {row.node_kind === 'tool_call' ? (
                    <select
                      value={row.tool || ''}
                      onChange={(e) => update(i, { tool: e.target.value })}
                      className="bg-transparent text-green-400/70 outline-none font-mono text-[11px] cursor-pointer"
                    >
                      <option value="" className="bg-neutral-900 text-neutral-500">— 选择 tool —</option>
                      {TOOL_OPTIONS.map((t) => (
                        <option key={t} value={t} className="bg-neutral-900 text-neutral-200">{t}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-neutral-700 text-[11px]">—</span>
                  )}
                </td>
                <td className="py-2 pr-3">
                  <input
                    value={row.description || ''}
                    onChange={(e) => update(i, { description: e.target.value })}
                    className="w-full bg-transparent text-neutral-600 outline-none focus:text-neutral-400 placeholder-neutral-800 text-[11px]"
                    placeholder="说明..."
                  />
                </td>
                <td className="py-2">
                  <button
                    onClick={() => deleteRow(i)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-neutral-700 hover:text-red-400"
                  >
                    <Trash2 size={11} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <button
          onClick={addRow}
          className="mt-4 flex items-center gap-1.5 text-[11px] text-neutral-700 hover:text-neutral-400 transition-colors"
        >
          <Plus size={12} /> 添加映射规则
        </button>

        {/* Reference card */}
        <div className="mt-6 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
          <p className="text-[10px] font-semibold text-neutral-600 mb-2 tracking-wider uppercase">node_kind 说明</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            {NODE_KIND_OPTIONS.map((k) => (
              <div key={k} className="flex items-center gap-2">
                <span className={`font-mono text-[10px] font-semibold ${NODE_KIND_COLOR[k]}`}>{k}</span>
                <span className="text-[10px] text-neutral-700">
                  {k === 'llm_call' ? '推理/分析/写作/规划' :
                   k === 'tool_call' ? '工具调用（代码/文件/外部）' :
                   k === 'local_judge' ? '本地模型价值判断' :
                   k === 'rule_branch' ? '确定性条件分支' :
                   k === 'human_gate' ? '等待人工审批' :
                   '生命周期（开始/结束）'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ConstitutionView
