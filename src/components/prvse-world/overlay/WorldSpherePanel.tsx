/**
 * WorldSpherePanel — 三球体 L0/L1/L2 分层展开 + 持久 AI 上下文
 *
 * 设计语言: Protocol View (OLED cinema dark + 毛玻璃 + sphere color accent)
 * 交互: 右侧滑入面板，3D 世界依然在左侧活跃
 *
 * 结构:
 *   - 头部: 球体名 + "AI 持久上下文" 标签
 *   - 中部: L0/L1/L2 可折叠树形分组 (各层独立展开)
 *   - 底部: 持久 AI 对话 (per-sphere contextKey → localStorage)
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, ChevronDown, ChevronRight, Bot, Send, RotateCcw, Cpu, ArrowUpRight, Paperclip, PanelRight, AppWindow, Maximize2 } from 'lucide-react'

type PanelMode = 'side' | 'center' | 'fullscreen'
import { getToken } from '@/lib/http'
import type { ControlNode } from '../useControlTree'
import { COMPONENT_ROUTE } from '../sphere-pages'
import { ROOT_SPECTRUM } from '../constants'
import ResourcePanel from '../panels/ResourcePanel'
import CompilerPanel from '../panels/CompilerPanel'
import TierManagePanel from '../panels/TierManagePanel'

// ── Types ──────────────────────────────────────────────────────────

type SphereLayer = 'L0' | 'L1' | 'L2'

interface SphereMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  imageData?: string   // base64 data URL for display
  imageType?: string   // e.g. "image/png"
}

interface LayerGroup {
  layer: SphereLayer
  label: string
  color: string
  bg: string
  border: string
  nodes: ControlNode[]
}

// ── Config ─────────────────────────────────────────────────────────

const LAYER_META: Record<SphereLayer, { label: string; color: string; bg: string; border: string }> = {
  L0: { label: 'L0  物理执行层', color: '#94a3b8', bg: 'rgba(148,163,184,0.05)', border: 'rgba(148,163,184,0.15)' },
  L1: { label: 'L1  客观规律层', color: '#7dd3fc', bg: 'rgba(125,211,252,0.05)', border: 'rgba(125,211,252,0.15)' },
  L2: { label: 'L2  主观认知层', color: '#a78bfa', bg: 'rgba(167,139,250,0.05)', border: 'rgba(167,139,250,0.15)' },
}

const SPHERE_SYSTEM_PROMPTS: Record<string, string> = {
  'dim-constitution': `你是 Egonetics 的宪法守护者 AI，持续监控并维护这个控制论系统的约束框架。
你的职责：解释宪法规则、识别冲突、建议修正、记录重要决策。
当前宪法层级：
- L0 物理执行层: Kernel 物理引擎（tick 驱动，合约验证）
- L1 客观规律层: PRVSE 语义规则集（P/R/V/S 五层标签树）、人机协议层 hm_protocol
- L2 主观认知层: 宪法生成流程（人描述→AI结构化→Kernel校验→裁决）、冲突裁决器
核心铁律: 先设计后编码 / 积累≥3问题再行动 / 三思而后行 / CRUD铁律
用中文回答，简洁专业。`,

  'dim-resources': `你是 Egonetics 的资源管理 AI，持续监控所有可调配资源的全局状态。
你的职责：分析资源瓶颈、调度建议、容量规划、异常告警。
资源层级：
- L0 物理层: T0/T1/T2 智能算力、机器节点（server/desktop/phone/pad）、消息队列 MQ、通信接口（API/Webhook）
- L1 客观层: 优先级调度合约、任务队列状态、存储分级（signals.db/pages.db/memory.db）
- L2 主观层: 人工裁决队列、角色权限矩阵（admin/agent/guest）
用中文回答，简洁专业。`,

  'dim-goals': `你是 Egonetics 的目标规划 AI，追踪两大矛盾的持续收敛：无限→有限 和 失控→可控。
你的职责：目标分解与度量、进度评估、矛盾识别、演化轨迹建议。
目标层级：
- L1 客观层: 可度量任务（执行中/队列/阻塞/完成）、实验场 Lab、历史 Chronicle
- L2 主观层: 计划生成（发散→收敛）、主观目标（自我进化/身份认同/意义建构）
核心矛盾: 无限（主观欲望）→有限（可行任务）/ 失控（不确定性）→可控（系统化执行）
用中文回答，简洁专业。`,
}

const SPHERE_COMPONENT_IDS: Record<string, string> = {
  'dim-constitution': 'L3-Constitution-Guardian-PersistentContext',
  'dim-resources':    'L3-Resources-Manager-PersistentContext',
  'dim-goals':        'L3-Goals-Planner-PersistentContext',
}

// ── Tree Node Item ─────────────────────────────────────────────────

function TreeNodeItem({
  node,
  depth = 0,
  onNavigate,
}: {
  node: ControlNode
  depth?: number
  onNavigate: () => void
}) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(depth < 1)
  const hasChildren = (node.children?.length ?? 0) > 0
  const component = node.meta?.component as string | undefined
  const route = component ? COMPONENT_ROUTE[component] : undefined
  const isNavigable = !!route

  const handleClick = () => {
    if (isNavigable) {
      navigate(route!)
      onNavigate()
    } else if (hasChildren) {
      setExpanded(v => !v)
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        className={`w-full flex items-center gap-2 py-1.5 rounded-lg transition-all text-left group
          ${(hasChildren || isNavigable) ? 'hover:bg-white/[0.05] cursor-pointer' : 'cursor-default'}`}
        style={{ paddingLeft: `${8 + depth * 14}px`, paddingRight: '6px' }}
      >
        <span className="shrink-0 text-white/25" style={{ width: '12px' }}>
          {hasChildren && !isNavigable
            ? (expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />)
            : null}
        </span>
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: node.color, boxShadow: `0 0 4px ${node.color}70` }}
        />
        <span className={`text-[11px] font-mono truncate flex-1 leading-snug transition-colors
          ${isNavigable ? 'text-white/75 group-hover:text-white' : 'text-white/55'}`}>
          {node.name}
        </span>
        {typeof node.meta?.count === 'number' && (node.meta.count as number) > 0 && (
          <span className="text-[9px] font-mono text-red-400/60 shrink-0">
            ● {node.meta.count as number}
          </span>
        )}
        {isNavigable && (
          <ArrowUpRight
            size={9}
            className="shrink-0 opacity-0 group-hover:opacity-50 transition-opacity"
            style={{ color: node.color }}
          />
        )}
      </button>

      {expanded && hasChildren && (
        <div>
          {node.children!.map(child => (
            <TreeNodeItem key={child.id} node={child} depth={depth + 1} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Layer Group Section ────────────────────────────────────────────

function LayerGroupSection({
  group,
  defaultExpanded,
  onNavigate,
}: {
  group: LayerGroup
  defaultExpanded: boolean
  onNavigate: () => void
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <div
      className="mb-2 rounded-xl overflow-hidden"
      style={{ background: group.bg, border: `1px solid ${group.border}` }}
    >
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/[0.02] transition-all"
      >
        <span className="text-white/25 shrink-0">
          {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </span>
        <span className="text-[11px] font-mono font-semibold" style={{ color: group.color }}>
          {group.label}
        </span>
        <span className="text-[9px] font-mono text-white/20 ml-auto">
          {group.nodes.length} 项
        </span>
      </button>

      {expanded && (
        <div className="px-1 pb-2">
          {group.nodes.map(node => (
            <TreeNodeItem key={node.id} node={node} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── AI Chat ────────────────────────────────────────────────────────

function AIChat({
  sphereId,
  sphereColor,
  systemPrompt,
  componentId,
}: {
  sphereId: string
  sphereColor: string
  systemPrompt: string
  componentId: string
}) {
  const storageKey = `prvse_sphere_ctx_${sphereId}`

  const [messages, setMessages] = useState<SphereMessage[]>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) ?? '[]') }
    catch { return [] }
  })
  const [input, setInput]         = useState('')
  const [streaming, setStreaming]  = useState(false)
  const [streamBuf, setStreamBuf]  = useState('')
  const [pendingImage, setPendingImage] = useState<{ data: string; type: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bottomRef    = useRef<HTMLDivElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      // strip "data:image/png;base64," prefix to get raw base64
      setPendingImage({ data: dataUrl, type: file.type })
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(messages.slice(-120)))
  }, [messages, storageKey])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamBuf])

  const send = useCallback(async () => {
    const text = input.trim()
    if ((!text && !pendingImage) || streaming) return
    setInput('')
    const img = pendingImage
    setPendingImage(null)

    const userMsg: SphereMessage = {
      role: 'user',
      content: text || '（图片）',
      timestamp: Date.now(),
      ...(img ? { imageData: img.data, imageType: img.type } : {}),
    }
    const history = [...messages, userMsg]
    setMessages(history)
    setStreaming(true)
    setStreamBuf('')

    // Build API message list — multimodal when image present
    const apiMessages = history.map(m => {
      if (m.imageData) {
        const base64 = m.imageData.split(',')[1] ?? m.imageData
        return {
          role: m.role,
          content: [
            { type: 'image', source: { type: 'base64', media_type: m.imageType ?? 'image/png', data: base64 } },
            ...(m.content && m.content !== '（图片）' ? [{ type: 'text', text: m.content }] : []),
          ],
        }
      }
      return { role: m.role, content: m.content }
    })

    try {
      const devMode = import.meta.env.VITE_DEV_MODE === 'true'
      const token   = devMode ? null : getToken()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          componentId,
          tier:   'T1',
          stream: true,
          system: systemPrompt,
          messages: apiMessages,
        }),
      })

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ''

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue
          try {
            const ev = JSON.parse(line.slice(6))
            if (ev.text)  { full += ev.text;  setStreamBuf(full) }
            if (ev.delta) { full += ev.delta; setStreamBuf(full) }
            if (ev.done) {
              setMessages(prev => [...prev, {
                role: 'assistant',
                content: full || (ev.content as string) || '',
                timestamp: Date.now(),
              }])
              setStreamBuf('')
              full = ''
            }
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `[错误: ${err instanceof Error ? err.message : 'Unknown'}]`,
        timestamp: Date.now(),
      }])
      setStreamBuf('')
    }
    setStreaming(false)
  }, [input, messages, streaming, componentId, systemPrompt, pendingImage])

  const clearHistory = () => {
    setMessages([])
    localStorage.removeItem(storageKey)
  }

  return (
    <div className="flex flex-col h-full">
      {/* chat header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.05] shrink-0">
        <Bot size={11} style={{ color: sphereColor }} />
        <span className="text-[10px] font-mono text-white/35 flex-1">AI 持久上下文 · 始终在线</span>
        <button
          onClick={clearHistory}
          className="p-1 rounded text-white/20 hover:text-white/50 transition-colors"
          title="清空历史"
        >
          <RotateCcw size={10} />
        </button>
      </div>

      {/* messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0">
        {messages.length === 0 && !streaming && (
          <div className="text-center py-5">
            <Cpu size={18} className="mx-auto mb-2 opacity-15" style={{ color: sphereColor }} />
            <p className="text-[10px] font-mono text-white/20">上下文已就绪 · 对话历史持久化</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className="max-w-[88%] rounded-xl text-[11px] font-mono leading-relaxed overflow-hidden"
              style={
                msg.role === 'user'
                  ? { background: `${sphereColor}16`, color: sphereColor, border: `1px solid ${sphereColor}28` }
                  : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.65)', border: '1px solid rgba(255,255,255,0.07)' }
              }
            >
              {msg.imageData && (
                <img
                  src={msg.imageData}
                  alt="截图"
                  className="max-w-full max-h-40 object-contain block"
                />
              )}
              {msg.content && msg.content !== '（图片）' && (
                <div className="px-2.5 py-1.5 whitespace-pre-wrap break-words">{msg.content}</div>
              )}
            </div>
          </div>
        ))}
        {streamBuf && (
          <div className="flex justify-start">
            <div
              className="max-w-[88%] px-2.5 py-1.5 rounded-xl text-[11px] font-mono leading-relaxed whitespace-pre-wrap break-words"
              style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.65)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              {streamBuf}
              <span className="inline-block w-0.5 h-3 bg-white/40 ml-0.5 animate-pulse" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* input */}
      <div className="px-3 pb-3 pt-1.5 border-t border-white/[0.05] shrink-0">
        {/* image preview */}
        {pendingImage && (
          <div className="mb-2 relative inline-block">
            <img
              src={pendingImage.data}
              alt="待发送图片"
              className="max-h-20 max-w-full rounded-lg border border-white/10 object-contain"
            />
            <button
              onClick={() => setPendingImage(null)}
              className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-black/70 text-white/60
                hover:text-white flex items-center justify-center text-[10px] leading-none"
            >✕</button>
          </div>
        )}
        <div
          className="flex items-end gap-2 rounded-xl border px-3 py-2"
          style={{ background: 'rgba(255,255,255,0.025)', borderColor: 'rgba(255,255,255,0.07)' }}
        >
          {/* hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={streaming}
            className="shrink-0 p-1 rounded text-white/25 hover:text-white/55 transition-colors disabled:opacity-20"
            title="附加图片（截图 / 图片文件）"
          >
            <Paperclip size={11} />
          </button>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
            }}
            placeholder="输入消息… (Enter 发送)"
            disabled={streaming}
            rows={1}
            className="flex-1 bg-transparent text-[11px] font-mono text-white/65 resize-none outline-none
              placeholder:text-white/20 leading-relaxed disabled:opacity-40"
            style={{ maxHeight: '72px' }}
          />
          <button
            onClick={send}
            disabled={(!input.trim() && !pendingImage) || streaming}
            className="shrink-0 p-1.5 rounded-lg transition-all disabled:opacity-25"
            style={{ background: `${sphereColor}18`, color: sphereColor, border: `1px solid ${sphereColor}35` }}
          >
            <Send size={11} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────

interface WorldSpherePanelProps {
  node: ControlNode
  onClose: () => void
  mode: PanelMode
  onModeChange: (m: PanelMode) => void
}

// ── Responsive panel dimensions ───────────────────────────────────
// Listens to resize + orientationchange so rotating the device recalculates.
// All sizing is relative to the actual container (100%) not the viewport (vw/vh),
// because the panel is position:absolute inside a flex container.

function usePanelDimensions(mode: PanelMode): React.CSSProperties {
  const [vw, setVw] = useState(() => window.innerWidth)
  const [vh, setVh] = useState(() => window.innerHeight)

  useEffect(() => {
    const update = () => { setVw(window.innerWidth); setVh(window.innerHeight) }
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])

  const isMobileWidth  = vw  < 768   // phone portrait or landscape narrow
  const isShortScreen  = vh  < 500   // phone landscape

  if (mode === 'fullscreen') return { top: 0, right: 0, height: '100%', width: '100%' }

  if (mode === 'center') {
    if (isMobileWidth) {
      // Phone: nearly full screen with small inset so user sees they can dismiss
      return {
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '94%',
        height: isShortScreen ? '96%' : '88%',
        borderRadius: '14px',
      }
    }
    // Tablet / desktop
    return {
      top: '50%', left: '50%',
      transform: 'translate(-50%, -50%)',
      width: Math.min(720, vw * 0.9) + 'px',
      height: isShortScreen ? '90%' : '78%',
      borderRadius: '18px',
    }
  }

  // side mode
  if (isMobileWidth) {
    // Phone: full width side panel (essentially fullscreen)
    return { top: 0, right: 0, height: '100%', width: '100%' }
  }
  return { top: 0, right: 0, height: '100%', width: '380px' }
}

const MODE_BUTTONS: { id: PanelMode; icon: React.ReactNode; title: string }[] = [
  { id: 'side',       icon: <PanelRight size={12} />,  title: '侧边面板' },
  { id: 'center',     icon: <AppWindow size={12} />,   title: '居中窗口' },
  { id: 'fullscreen', icon: <Maximize2 size={12} />,   title: '全屏' },
]

export default function WorldSpherePanel({ node, onClose, mode, onModeChange }: WorldSpherePanelProps) {
  const panelStyle = usePanelDimensions(mode)
  const children = node.children ?? []

  // Group direct children by their meta.layer
  const layerGroups: LayerGroup[] = (['L0', 'L1', 'L2'] as SphereLayer[]).map(layer => ({
    layer,
    ...LAYER_META[layer],
    nodes: children.filter(c => (c.meta?.layer as string | undefined) === layer),
  })).filter(g => g.nodes.length > 0)

  // Unclassified nodes go into L1
  const classified = new Set(layerGroups.flatMap(g => g.nodes.map(n => n.id)))
  const unclassified = children.filter(c => !classified.has(c.id))
  if (unclassified.length > 0) {
    const l1 = layerGroups.find(g => g.layer === 'L1')
    if (l1) l1.nodes = [...l1.nodes, ...unclassified]
    else layerGroups.push({ layer: 'L1', ...LAYER_META.L1, nodes: unclassified })
  }

  const systemPrompt = SPHERE_SYSTEM_PROMPTS[node.id] ?? `你是 ${node.name} 的 AI 守护者，用中文回答。`
  const componentId  = SPHERE_COMPONENT_IDS[node.id]  ?? `L3-${node.id}-Guardian-PersistentContext`

  // Tab state — only used for dim-resources sphere
  type ResourceTab = 'overview' | 'tiers'
  const [resourceTab, setResourceTab] = useState<ResourceTab>('overview')
  const [chatExpanded, setChatExpanded] = useState(false)

  const spectrum = ROOT_SPECTRUM[node.id]
  // Parse base color for gradient rgba values
  const hexToRgb = (hex: string) => {
    const h = hex.replace('#', '')
    return `${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)}`
  }
  const rgb = spectrum ? hexToRgb(spectrum.base) : '255,255,255'

  return (
    <div
      className="absolute z-40 flex flex-col transition-all duration-300 overflow-hidden"
      style={{
        ...panelStyle,
        background: `linear-gradient(180deg, rgba(${rgb},0.08) 0%, rgba(${rgb},0.03) 12%, rgba(4,5,10,0.97) 30%, rgba(4,5,10,0.97) 100%)`,
        backdropFilter: 'blur(28px)',
        boxShadow: mode === 'side'
          ? `-12px 0 48px rgba(0,0,0,0.8), -2px 0 20px rgba(${rgb},0.04)`
          : mode === 'center'
          ? `0 24px 80px rgba(0,0,0,0.85), 0 0 0 1px rgba(${rgb},0.15), 0 0 40px rgba(${rgb},0.06)`
          : 'none',
      }}
    >
      {/* Gradient left border line — side mode only */}
      {mode === 'side' && spectrum && (
        <div
          className="absolute left-0 top-0 h-full pointer-events-none"
          style={{
            width: '1px',
            background: `linear-gradient(180deg, transparent 0%, ${spectrum.highlight} 15%, ${spectrum.base} 50%, ${spectrum.shadow} 85%, transparent 100%)`,
          }}
        />
      )}
      {/* Header */}
      <div
        className="flex items-center gap-2.5 px-4 py-3.5 shrink-0"
        style={{
          borderBottom: `1px solid ${node.color}40`,
          background: `linear-gradient(90deg, rgba(${rgb},0.08) 0%, transparent 100%)`,
        }}
      >
        <span
          className="w-2.5 h-2.5 rounded-full animate-pulse"
          style={{ background: node.color, boxShadow: `0 0 10px ${node.color}` }}
        />
        <span className="text-[14px] font-mono font-semibold" style={{ color: node.color }}>
          {node.name}
        </span>
        <span
          className="text-[9px] font-mono px-2 py-0.5 rounded-full"
          style={{
            background: `${node.color}12`,
            color: `${node.color}99`,
            border: `1px solid ${node.color}22`,
          }}
        >
          AI 持久上下文
        </span>
        <div className="ml-auto flex items-center gap-0.5">
          {/* Mode selector — 3 icons */}
          <div
            className="flex items-center gap-0.5 rounded-lg px-1 py-0.5 mr-1"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            {MODE_BUTTONS.map(({ id, icon, title }) => (
              <button
                key={id}
                onClick={() => onModeChange(id)}
                title={title}
                className="p-1 rounded transition-all"
                style={mode === id ? {
                  background: `${node.color}22`,
                  color: node.color,
                  boxShadow: `0 0 8px ${node.color}30`,
                } : {
                  color: 'rgba(255,255,255,0.25)',
                }}
              >
                {icon}
              </button>
            ))}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/25 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Content — specialized panels per sphere, tree view as fallback */}
      {node.id === 'dim-resources' ? (
        <div className="flex flex-col flex-1 min-h-0">
          {/* Segmented control — centered, Apple HIG style */}
          <div className="flex justify-center px-4 py-2.5 shrink-0">
            <div
              className="flex rounded-xl p-0.5"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {([['overview', '资源总览'], ['tiers', '智能分级']] as [ResourceTab, string][]).map(([id, label]) => {
                const active = resourceTab === id
                return (
                  <button
                    key={id}
                    onClick={() => setResourceTab(id)}
                    className="relative px-4 py-1.5 text-[11px] font-mono rounded-[10px] transition-all duration-200 min-w-[80px]"
                    style={active ? {
                      background: `${node.color}22`,
                      color: node.color,
                      boxShadow: `0 0 12px ${node.color}30, inset 0 1px 0 ${node.color}25`,
                      border: `1px solid ${node.color}35`,
                    } : {
                      color: 'rgba(255,255,255,0.35)',
                      border: '1px solid transparent',
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
          {/* Panel content */}
          <div className="overflow-y-auto flex-1 min-h-0">
            {resourceTab === 'overview'
              ? <ResourcePanel sphereColor={node.color} />
              : <TierManagePanel sphereColor={node.color} />
            }
          </div>
        </div>
      ) : node.id === 'dim-constitution' ? (
        <div className="overflow-y-auto shrink-0" style={{ maxHeight: '52%' }}>
          <CompilerPanel sphereColor={node.color} />
        </div>
      ) : (
        <div className="overflow-y-auto px-3 py-3 shrink-0" style={{ maxHeight: '52%' }}>
          {layerGroups.map((group, i) => (
            <LayerGroupSection
              key={group.layer}
              group={group}
              defaultExpanded={i === 0}
              onNavigate={onClose}
            />
          ))}
        </div>
      )}

      {/* AI Chat — collapsed by default, expand on click */}
      <div className="shrink-0">
        {chatExpanded ? (
          <>
            <div
              className="mx-4 shrink-0 cursor-pointer"
              onClick={() => setChatExpanded(false)}
              style={{ height: '1px', background: `linear-gradient(90deg, transparent, ${node.color}25, transparent)` }}
            />
            <div className="flex flex-col overflow-hidden" style={{ height: '40vh' }}>
              <AIChat sphereId={node.id} sphereColor={node.color} systemPrompt={systemPrompt} componentId={componentId} />
            </div>
          </>
        ) : (
          <button
            onClick={() => setChatExpanded(true)}
            className="flex items-center gap-2 w-full px-4 py-2 text-[11px] font-mono transition-colors hover:bg-white/[0.03]"
            style={{ color: `${node.color}60`, borderTop: `1px solid ${node.color}15` }}
          >
            <Bot size={11} />
            <span>AI 对话</span>
            <span className="text-white/15 ml-auto text-[9px]">点击展开</span>
          </button>
        )}
      </div>
    </div>
  )
}
