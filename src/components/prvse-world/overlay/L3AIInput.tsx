/**
 * L3AIInput — PRVSE World 主会话入口
 *
 * 单一输入 + Tier 选择器：
 *   T0/T1 — 调用 /api/llm/chat (SSE流式)，消息以 P-format 显示并持久化
 *   T2    — 调用 /api/code-agent/chat (TC Claude Code CLI 子进程 SSE)
 *           完整映射 stream-json 事件：assistant/tool_use/tool_result/result/system/rate_limit_event
 *           子模型可选 S4.6 / O4.6
 *
 * TC Session 管理（T2 专属）：
 *   - 每个 session contextKey = "tc-{timestamp}-{rand4}"（不可变，对应唯一 claude session）
 *   - displayName 可重命名（双击 tab 编辑）
 *   - 数据存 localStorage，不删除
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { authFetch, getToken } from '@/lib/http'
import PMessageCard, { type PMessage, nowHHMM } from './PMessageCard'

// ── TC Session ────────────────────────────────────────────────

interface TCSession {
  contextKey: string    // 唯一键，对应 claude --resume session，不可变
  displayName: string   // 用户可重命名的展示名
  createdAt: number
  lastActiveAt: number
}

const TC_SESSIONS_KEY = 'tc-sessions'
const TC_ACTIVE_KEY   = 'tc-active-session'

function loadTCSessions(): TCSession[] {
  try { return JSON.parse(localStorage.getItem(TC_SESSIONS_KEY) ?? '[]') } catch { return [] }
}

function saveTCSessions(sessions: TCSession[]) {
  localStorage.setItem(TC_SESSIONS_KEY, JSON.stringify(sessions))
}

function loadSessionMessages(contextKey: string): PMessage[] {
  try { return JSON.parse(localStorage.getItem(`tc-msgs-${contextKey}`) ?? '[]') } catch { return [] }
}

function saveSessionMessages(contextKey: string, messages: PMessage[]) {
  localStorage.setItem(`tc-msgs-${contextKey}`, JSON.stringify(messages))
}

function generateContextKey(): string {
  return `tc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function initTC(): { sessions: TCSession[]; activeKey: string } {
  let sessions = loadTCSessions()
  const savedKey = localStorage.getItem(TC_ACTIVE_KEY) ?? ''

  if (sessions.length === 0) {
    const key: string = generateContextKey()
    const def: TCSession = { contextKey: key, displayName: 'main', createdAt: Date.now(), lastActiveAt: Date.now() }
    sessions = [def]
    saveTCSessions(sessions)
    localStorage.setItem(TC_ACTIVE_KEY, key)
    return { sessions, activeKey: key }
  }

  const activeKey = (savedKey && sessions.find(s => s.contextKey === savedKey))
    ? savedKey
    : sessions[sessions.length - 1].contextKey
  return { sessions, activeKey }
}

// ── Sphere contexts ────────────────────────────────────────────

const SPHERE_META: Record<string, { name: string; color: string; sessionNode: string; systemPrompt: string }> = {
  'dim-constitution': {
    name: '宪法', color: '#ef4444',
    sessionNode: 'sphere-constitution',
    systemPrompt: '你是 Egonetics 的宪法守护者 AI，维护约束框架。解释宪法规则、识别冲突、建议修正。铁律：先设计后编码 / 积累≥3再行动 / 三思而后行 / CRUD铁律。简洁专业。',
  },
  'dim-resources': {
    name: '资源', color: '#f59e0b',
    sessionNode: 'sphere-resources',
    systemPrompt: '你是 Egonetics 的资源管理 AI，监控可调配资源全局状态。分析资源瓶颈、调度建议、容量规划。简洁专业。',
  },
  'dim-goals': {
    name: '目标', color: '#22c55e',
    sessionNode: 'sphere-goals',
    systemPrompt: '你是 Egonetics 的目标规划 AI，追踪两大矛盾收敛：无限→有限 / 失控→可控。目标分解、进度评估、矛盾识别。简洁专业。',
  },
}

const DEFAULT_SESSION_NODE = 'prvse-world-main'
const DEFAULT_SYSTEM_PROMPT = `你是 Egonetics PRVSE World 助手，运行在 PRVSE 控制论框架下。
你帮助用户理解和操作 PRVSE 世界（宪法/资源/目标三个根节点下的控制体系）。
回答简洁、专业、结果导向。`

// ── Tier config ────────────────────────────────────────────────

type TierKey = 'T0' | 'T1' | 'T2'
type T2Model = 'sonnet' | 'opus'

const TIER_CONFIG: Record<TierKey, { label: string; color: string; apiModel?: string }> = {
  T0: { label: 'T0', color: '#34d399' },
  T1: { label: 'T1', color: '#60a5fa' },
  T2: { label: 'T2', color: '#a78bfa' },
}

// ── Component ─────────────────────────────────────────────────

interface Props {
  activeSphereId?: string | null
}

export default function L3AIInput({ activeSphereId }: Props) {
  const [value, setValue] = useState('')
  const [messages, setMessages] = useState<PMessage[]>([])
  const [streaming, setStreaming] = useState(false)
  const [connecting, setConnecting] = useState(false)  // T2 启动 claude 等待中
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)

  // Tier selector
  const [selectedTier, setSelectedTier] = useState<TierKey>('T1')
  const [t2Model, setT2Model] = useState<T2Model>('sonnet')

  // Active sphere context
  const prevSphereId = useRef<string | null>(null)

  // TC session state
  const tcInit = useRef(initTC())
  const [tcSessions, setTCSessions] = useState<TCSession[]>(tcInit.current.sessions)
  const [activeTCKey, setActiveTCKey] = useState<string>(tcInit.current.activeKey)
  const [codeMessages, setCodeMessages] = useState<PMessage[]>(() =>
    loadSessionMessages(tcInit.current.activeKey)
  )
  const [creatingSession, setCreatingSession] = useState(false)
  const [newSessionName, setNewSessionName] = useState('')
  const [renamingKey, setRenamingKey] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  // 用 ref 让 sendCode 始终拿到最新 activeTCKey，避免 stale closure
  const activeTCKeyRef = useRef(activeTCKey)
  useEffect(() => { activeTCKeyRef.current = activeTCKey }, [activeTCKey])

  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 持久化 codeMessages 到 localStorage
  useEffect(() => {
    if (activeTCKey) saveSessionMessages(activeTCKey, codeMessages)
  }, [codeMessages, activeTCKey])

  // 加载 chat 历史（通用上下文，非球体）
  useEffect(() => {
    if (historyLoaded || activeSphereId) return
    authFetch<{ messages: Array<{ role: string; content: string; tier_label: string | null }> }>(
      `/node-chat/${encodeURIComponent(DEFAULT_SESSION_NODE)}`
    ).then(data => {
      const msgs: PMessage[] = (data.messages ?? []).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
        tierLabel: m.tier_label ?? undefined,
      }))
      setMessages(msgs)
      if (msgs.length > 0) setPanelOpen(true)
    }).catch(() => {})
    setHistoryLoaded(true)
  }, [historyLoaded, activeSphereId])

  // 球体上下文切换：activeSphereId 变化时切换消息历史
  useEffect(() => {
    if (activeSphereId === prevSphereId.current) return
    prevSphereId.current = activeSphereId ?? null

    if (activeSphereId) {
      // 加载球体独立上下文（localStorage）
      const key = `l3-sphere-msgs-${activeSphereId}`
      try {
        const stored = JSON.parse(localStorage.getItem(key) ?? '[]') as PMessage[]
        setMessages(stored)
      } catch { setMessages([]) }
      setPanelOpen(true)
    } else {
      // 回到通用上下文
      setMessages([])
      setHistoryLoaded(false)
    }
  }, [activeSphereId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, codeMessages])

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 400)
    return () => clearTimeout(timer)
  }, [])

  // ── TC Session 管理 ────────────────────────────────────────

  const switchSession = useCallback((key: string) => {
    setActiveTCKey(key)
    localStorage.setItem(TC_ACTIVE_KEY, key)
    setCodeMessages(loadSessionMessages(key))
    setTCSessions(prev => {
      const updated = prev.map(s => s.contextKey === key ? { ...s, lastActiveAt: Date.now() } : s)
      saveTCSessions(updated)
      return updated
    })
    setPanelOpen(true)
  }, [])

  const createSession = useCallback((displayName: string) => {
    const contextKey = generateContextKey()
    const session: TCSession = {
      contextKey,
      displayName: displayName.trim() || '新任务',
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    }
    setTCSessions(prev => {
      const updated = [...prev, session]
      saveTCSessions(updated)
      return updated
    })
    setActiveTCKey(contextKey)
    localStorage.setItem(TC_ACTIVE_KEY, contextKey)
    setCodeMessages([])
    setCreatingSession(false)
    setNewSessionName('')
    setPanelOpen(true)
  }, [])

  const renameSession = useCallback((key: string, newName: string) => {
    setTCSessions(prev => {
      const updated = prev.map(s =>
        s.contextKey === key ? { ...s, displayName: newName.trim() || s.displayName } : s
      )
      saveTCSessions(updated)
      return updated
    })
    setRenamingKey(null)
  }, [])

  // ── Chat mode ──────────────────────────────────────────────

  const saveMessage = useCallback(async (msg: PMessage, sphereId?: string | null) => {
    if (sphereId) {
      // 球体上下文存 localStorage
      const key = `l3-sphere-msgs-${sphereId}`
      setMessages(prev => {
        const updated = prev[prev.length - 1]?.streaming === false ? prev : prev.map((m, i) =>
          i === prev.length - 1 ? { ...m, ...msg } : m
        )
        localStorage.setItem(key, JSON.stringify(updated.slice(-120)))
        return updated
      })
      return
    }
    try {
      await authFetch(`/node-chat/${encodeURIComponent(DEFAULT_SESSION_NODE)}`, {
        method: 'POST',
        body: JSON.stringify({ role: msg.role, content: msg.content, tier_label: msg.tierLabel }),
      })
    } catch { /* 存储失败不影响 UI */ }
  }, [])

  const sendChat = useCallback(async (text: string) => {
    const sphere = activeSphereId ? SPHERE_META[activeSphereId] : null
    const systemPrompt = sphere?.systemPrompt ?? DEFAULT_SYSTEM_PROMPT
    const contextKey   = sphere?.sessionNode   ?? DEFAULT_SESSION_NODE

    // resolve model
    const tierModel = selectedTier === 'T2'
      ? (t2Model === 'opus' ? 'claude-opus-4-6' : 'claude-sonnet-4-6')
      : undefined

    const userMsg: PMessage = { role: 'user', content: text, timestamp: nowHHMM() }
    const history = [...messages, userMsg]

    setMessages([...history, { role: 'assistant', content: '', streaming: true, timestamp: nowHHMM() }])
    setPanelOpen(true)
    setStreaming(true)

    // persist sphere messages immediately
    if (activeSphereId) {
      localStorage.setItem(`l3-sphere-msgs-${activeSphereId}`, JSON.stringify([...history].slice(-120)))
    } else {
      void saveMessage(userMsg, null)
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
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
          tier: selectedTier,
          model: tierModel,
          contextKey,
        }),
        signal: controller.signal,
      })

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)

      const reader = resp.body!.getReader()
      const decoder = new TextDecoder()
      let accum = ''
      let buffer = ''
      let activeTierLabel = 'T2'

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
              meta?: { tier?: string }
            }
            if (data.meta?.tier) activeTierLabel = data.meta.tier
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
              const assistantMsg: PMessage = { role: 'assistant', content: finalContent, tierLabel: activeTierLabel, timestamp: nowHHMM() }
              setMessages(prev => {
                const next = [...prev]
                next[next.length - 1] = assistantMsg
                if (activeSphereId) {
                  localStorage.setItem(`l3-sphere-msgs-${activeSphereId}`, JSON.stringify(next.slice(-120)))
                } else {
                  void saveMessage(assistantMsg, null)
                }
                return next
              })
            }
          } catch { /* skip */ }
        }
      }

      setMessages(prev => {
        const next = [...prev]
        if (next[next.length - 1]?.streaming) {
          const finalMsg: PMessage = { role: 'assistant', content: accum, tierLabel: activeTierLabel, timestamp: nowHHMM() }
          next[next.length - 1] = finalMsg
          if (activeSphereId) {
            localStorage.setItem(`l3-sphere-msgs-${activeSphereId}`, JSON.stringify(next.slice(-120)))
          } else {
            void saveMessage(finalMsg, null)
          }
        }
        return next
      })
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      setMessages(prev => {
        const next = [...prev]
        next[next.length - 1] = { role: 'assistant', content: '请求失败，请稍后重试。', timestamp: nowHHMM() }
        return next
      })
    } finally {
      setStreaming(false)
    }
  }, [messages, saveMessage, activeSphereId, selectedTier, t2Model])

  // ── T2 / Code-agent mode ──────────────────────────────────

  const sendCode = useCallback(async (prompt: string, modelOverride?: string) => {
    const contextKey = activeTCKeyRef.current
    const userMsg: PMessage = { role: 'user', content: prompt, timestamp: nowHHMM(), tierLabel: 'TC' }
    setCodeMessages(prev => [...prev, userMsg])
    setPanelOpen(true)
    setConnecting(true)   // 等待 claude 启动，不锁输入框

    // 更新 lastActiveAt
    setTCSessions(prev => {
      const updated = prev.map(s => s.contextKey === contextKey ? { ...s, lastActiveAt: Date.now() } : s)
      saveTCSessions(updated)
      return updated
    })

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const token = getToken()

    const placeholderId = `tc-${Date.now()}`
    let assistantAdded = false

    try {
      const resp = await fetch('/api/code-agent/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ prompt, contextKey, ...(modelOverride ? { model: modelOverride } : {}) }),
        signal: controller.signal,
      })

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)

      const reader = resp.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value: chunk } = await reader.read()
        if (done) break

        buffer += decoder.decode(chunk, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          let ev: Record<string, unknown>
          try { ev = JSON.parse(line.slice(6)) } catch { continue }

          const evType = ev.type as string

          if (evType === 'stream_start' || evType === 'stream_end' || evType === 'user') continue

          if (evType === 'assistant') {
            const content = (ev.message as { content?: unknown[] })?.content ?? []
            const texts = (content as Array<{ type: string; text?: string }>)
              .filter(c => c.type === 'text').map(c => c.text ?? '').join('')
            const toolUses = (content as Array<{ type: string; id?: string; name?: string; input?: unknown }>)
              .filter(c => c.type === 'tool_use')
              .map(c => ({ id: c.id ?? '', name: c.name ?? '', input: c.input }))

            const assistantMsg: PMessage = {
              id: placeholderId,
              role: 'assistant',
              content: texts,
              streaming: true,
              tierLabel: 'TC',
              tcEventType: 'assistant',
              toolUses: toolUses.length > 0 ? toolUses : undefined,
              timestamp: nowHHMM(),
            }

            if (!assistantAdded) {
              setConnecting(false)
              setStreaming(true)
              setCodeMessages(prev => [...prev, assistantMsg])
              assistantAdded = true
            } else {
              setCodeMessages(prev => prev.map(m => m.id === placeholderId ? assistantMsg : m))
            }
          }

          if (evType === 'interactive_prompt') {
            setConnecting(false)
            setCodeMessages(prev => [...prev, {
              role: 'assistant',
              content: (ev.content as string) ?? '',
              tierLabel: 'TC',
              tcEventType: 'interactive_prompt',
              interactiveOptions: (ev.options as string[]) ?? [],
              interactivePanePath: ev.pane as string,
              timestamp: nowHHMM(),
            }])
          }

          if (evType === 'tool_result') {
            const contentRaw = ev.content
            const contentStr = typeof contentRaw === 'string'
              ? contentRaw
              : (Array.isArray(contentRaw)
                ? (contentRaw as Array<{ type?: string; text?: string }>)
                    .filter(c => c.type === 'text').map(c => c.text ?? '').join('\n')
                : JSON.stringify(contentRaw))

            setCodeMessages(prev => [...prev, {
              role: 'assistant',
              content: '',
              tierLabel: 'TC',
              tcEventType: 'tool_result',
              toolResult: {
                tool_use_id: (ev.tool_use_id as string) ?? '',
                content: contentStr,
                is_error: !!(ev.is_error),
              },
              timestamp: nowHHMM(),
            }])
          }

          if (evType === 'result') {
            setCodeMessages(prev => [
              ...prev.map(m => m.id === placeholderId ? { ...m, streaming: false } : m),
              {
                role: 'assistant' as const,
                content: '',
                tierLabel: 'TC',
                tcEventType: 'result' as const,
                tcMeta: {
                  cost: ev.total_cost_usd as number | undefined,
                  duration_ms: ev.duration_ms as number | undefined,
                  session_id: ev.session_id as string | undefined,
                },
                timestamp: nowHHMM(),
              },
            ])
          }

          if (evType === 'error') {
            setCodeMessages(prev => {
              const next = [...prev]
              const errorMsg: PMessage = {
                role: 'assistant',
                content: `错误：${ev.error ?? '未知错误'}`,
                tierLabel: 'TC',
                tcEventType: 'assistant',
                timestamp: nowHHMM(),
              }
              if (assistantAdded) {
                return next.map(m => m.id === placeholderId ? { ...m, ...errorMsg, streaming: false } : m)
              }
              return [...next, errorMsg]
            })
          }
        }
      }

      setCodeMessages(prev => prev.map(m => m.id === placeholderId ? { ...m, streaming: false } : m))
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      setCodeMessages(prev => [
        ...prev,
        { role: 'assistant', content: '连接失败，请检查后端服务。', tierLabel: 'TC', tcEventType: 'assistant', timestamp: nowHHMM() }
      ])
    } finally {
      setStreaming(false)
      setConnecting(false)
    }
  }, [])

  // ── Interactive prompt 回调 ────────────────────────────────

  const respondToPrompt = useCallback(async (pane: string, option: string) => {
    // 标记已选
    setCodeMessages(prev => prev.map(m =>
      m.interactivePanePath === pane && !m.interactiveResolved
        ? { ...m, interactiveResolved: option }
        : m
    ))
    try {
      await authFetch('/code-agent/respond', {
        method: 'POST',
        body: JSON.stringify({ pane, option }),
      })
    } catch { /* ignore */ }
  }, [])

  // ── Submit ─────────────────────────────────────────────────

  const submit = () => {
    const text = value.trim()
    if (!text) return
    setValue('')
    if (selectedTier === 'T2') {
      const model = t2Model === 'opus' ? 'claude-opus-4-6' : 'claude-sonnet-4-6'
      void sendCode(text, model)
    } else {
      void sendChat(text)
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
  }

  const isWorking = streaming  // 只有真正 streaming 才锁输入

  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col items-center pointer-events-none">

      {/* ── TC Session Bar (T2 only) ── */}
      {selectedTier === 'T2' && (
        <div className="pointer-events-auto w-full max-w-2xl mx-auto mb-0.5 flex items-center gap-1 px-3 overflow-x-auto">
          {tcSessions.map(session => (
            <div
              key={session.contextKey}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-mono cursor-pointer shrink-0 transition-all select-none
                ${activeTCKey === session.contextKey
                  ? 'bg-orange-500/15 text-orange-400/80 border border-orange-500/25'
                  : 'text-white/25 hover:text-white/50 border border-transparent hover:border-white/10'
                }`}
              onClick={() => { if (renamingKey !== session.contextKey) switchSession(session.contextKey) }}
              onDoubleClick={() => { setRenamingKey(session.contextKey); setRenameValue(session.displayName) }}
              title="双击重命名"
            >
              {renamingKey === session.contextKey ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onBlur={() => renameSession(session.contextKey, renameValue)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') renameSession(session.contextKey, renameValue)
                    if (e.key === 'Escape') setRenamingKey(null)
                  }}
                  className="bg-transparent outline-none w-24 text-orange-400/90 caret-orange-400"
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <span>{session.displayName}</span>
              )}
              {activeTCKey === session.contextKey && (
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400/60 shrink-0" />
              )}
            </div>
          ))}

          {creatingSession ? (
            <input
              autoFocus
              value={newSessionName}
              onChange={e => setNewSessionName(e.target.value)}
              onBlur={() => { if (newSessionName.trim()) createSession(newSessionName); else setCreatingSession(false) }}
              onKeyDown={e => {
                if (e.key === 'Enter') createSession(newSessionName)
                if (e.key === 'Escape') setCreatingSession(false)
              }}
              placeholder="任务名称…"
              className="bg-transparent outline-none text-[10px] font-mono text-orange-400/80
                placeholder:text-white/20 border-b border-orange-500/40 py-0.5 w-28 caret-orange-400"
            />
          ) : (
            <button
              onClick={() => setCreatingSession(true)}
              className="px-2 py-1 text-[10px] font-mono text-white/20 hover:text-orange-400/60 transition-colors shrink-0"
            >
              + 新建
            </button>
          )}
        </div>
      )}

      {/* ── 对话面板 ── */}
      {panelOpen && (
        <div
          className="pointer-events-auto w-full max-w-2xl mb-2 mx-auto rounded-2xl overflow-hidden
            bg-[#060810]/90 backdrop-blur-2xl border border-white/[0.07] flex flex-col"
          style={{ maxHeight: '50vh' }}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.05] shrink-0">
            <span className="text-[9px] font-mono text-white/20 uppercase tracking-widest">
              {selectedTier === 'T2'
                ? `TC · ${tcSessions.find(s => s.contextKey === activeTCKey)?.displayName ?? 'Claude Code Agent'}`
                : activeSphereId && SPHERE_META[activeSphereId]
                  ? `P · ${SPHERE_META[activeSphereId].name} 上下文`
                  : 'P · Pattern 对话'}
            </span>
            <button
              onClick={() => setPanelOpen(false)}
              className="text-[9px] text-white/15 hover:text-white/40 transition-colors px-1"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 min-h-0">
            {(selectedTier === 'T2' ? codeMessages : messages).length === 0 ? (
              <div className="flex items-center justify-center py-6 text-[10px] text-white/15 font-mono">
                {selectedTier === 'T2' ? '向 Claude Code Agent 发送指令…' : '开始对话…'}
              </div>
            ) : (
              (selectedTier === 'T2' ? codeMessages : messages).map((msg, i) => (
                <PMessageCard key={i} msg={msg} onRespond={respondToPrompt} />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* ── Input bar ── */}
      <div
        className={`pointer-events-auto flex items-center gap-0 w-full max-w-2xl mb-6 mx-auto px-4
          bg-black/65 backdrop-blur border rounded-2xl transition-all duration-300
          ${isWorking
            ? 'border-white/20 shadow-[0_0_20px_rgba(167,139,250,0.12)]'
            : 'border-white/[0.08] hover:border-white/[0.15]'
          }`}
      >
        {/* Tier selector */}
        <div className="flex items-center gap-0.5 shrink-0 mr-2">
          {(['T0', 'T1', 'T2'] as TierKey[]).map(tier => (
            <button
              key={tier}
              onClick={() => setSelectedTier(tier)}
              className="px-1.5 py-0.5 rounded text-[9px] font-mono transition-all"
              style={selectedTier === tier
                ? { background: `${TIER_CONFIG[tier].color}20`, color: TIER_CONFIG[tier].color, border: `1px solid ${TIER_CONFIG[tier].color}40` }
                : { color: 'rgba(255,255,255,0.20)', border: '1px solid transparent' }
              }
            >
              {tier}
            </button>
          ))}
          {selectedTier === 'T2' && (
            <>
              <div className="w-px h-3 bg-white/10 mx-0.5" />
              {(['sonnet', 'opus'] as T2Model[]).map(m => (
                <button
                  key={m}
                  onClick={() => setT2Model(m)}
                  className="px-1.5 py-0.5 rounded text-[8px] font-mono transition-all"
                  style={t2Model === m
                    ? { background: '#a78bfa20', color: '#a78bfa', border: '1px solid #a78bfa40' }
                    : { color: 'rgba(255,255,255,0.18)', border: '1px solid transparent' }
                  }
                >
                  {m === 'sonnet' ? 'S4.6' : 'O4.6'}
                </button>
              ))}
            </>
          )}
        </div>

        <div className="w-px h-5 bg-white/[0.06] shrink-0 mr-2" />

        <input
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKey}
          disabled={isWorking}
          placeholder={selectedTier === 'T2' ? '向 Claude Code Agent 发送指令…' : '向 PRVSE World 提问…'}
          className="flex-1 bg-transparent py-2.5 text-[13px] font-mono text-white/70
            placeholder:text-white/20 outline-none caret-purple-400/60 disabled:opacity-40"
          spellCheck={false}
          autoComplete="off"
        />

        {(selectedTier === 'T2' ? codeMessages : messages).length > 0 && (
          <button
            onClick={() => setPanelOpen(v => !v)}
            className="shrink-0 text-[9px] font-mono text-white/20 hover:text-white/50 transition-colors px-2 py-1 mr-1"
            title={panelOpen ? '收起对话' : '展开对话'}
          >
            {panelOpen ? '▼' : '▲'}
          </button>
        )}

        <button
          onClick={submit}
          disabled={!value.trim() || isWorking}
          className="shrink-0 text-[10px] font-mono text-white/25 hover:text-white/50
            disabled:opacity-20 disabled:cursor-not-allowed transition-colors px-1 py-2.5"
        >
          {connecting ? (
            <span className="text-[8px] font-mono text-orange-400/50 animate-pulse">···</span>
          ) : isWorking ? (
            <span className="inline-block w-3 h-3 border border-purple-400/50 border-t-transparent rounded-full animate-spin" />
          ) : '⏎'}
        </button>
      </div>
    </div>
  )
}
