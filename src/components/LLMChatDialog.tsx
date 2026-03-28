/**
 * LLMChatDialog — 通用 LLM 对话浮层
 *
 * 用法：
 *   <LLMChatDialog
 *     open={show}
 *     onClose={() => setShow(false)}
 *     systemPrompt="你是一位专家..."   // 可选
 *     title="AI 助手"                  // 可选
 *     initialMessage="请帮我..."       // 可选，打开时自动发送
 *   />
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Bot, Loader2, Maximize2, Minimize2, Send, Sparkles, Trash2, X } from 'lucide-react'
import { getToken } from '@/lib/http'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean   // 正在流式输出中
}

export interface LLMChatDialogProps {
  open: boolean
  onClose: () => void
  systemPrompt?: string
  title?: string
  model?: string
  initialMessage?: string   // 打开时自动发送的第一条消息
}

// ─── SSE 流式读取工具 ─────────────────────────────────────────────────────────

async function streamChat(
  messages: { role: string; content: string }[],
  system: string | undefined,
  model: string | undefined,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
  signal: AbortSignal,
) {
  const token = getToken()
  let response: Response
  try {
    response = await fetch('/api/llm/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ messages, system, model, stream: true }),
      signal,
    })
  } catch (e: unknown) {
    if ((e as Error).name === 'AbortError') return
    onError((e as Error).message || '网络错误')
    return
  }

  if (!response.ok) {
    const txt = await response.text()
    onError(txt || `HTTP ${response.status}`)
    return
  }

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
      try {
        const data = JSON.parse(line.slice(6))
        if (data.text) onChunk(data.text)
        if (data.done) onDone()
        if (data.error) onError(data.error)
      } catch { /* ignore parse errors */ }
    }
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

const LLMChatDialog: React.FC<LLMChatDialogProps> = ({
  open,
  onClose,
  systemPrompt,
  title = 'AI 助手',
  model,
  initialMessage,
}) => {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput]     = useState('')
  const [sending, setSending] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLTextAreaElement>(null)
  const abortRef   = useRef<AbortController | null>(null)

  // ── 自动滚到底部 ───────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── 打开时自动聚焦 + 可选初始消息 ─────────────────────────
  useEffect(() => {
    if (!open) return
    setTimeout(() => inputRef.current?.focus(), 80)
    if (initialMessage && messages.length === 0) {
      void sendMessage(initialMessage)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 关闭时取消流 ──────────────────────────────────────────
  useEffect(() => {
    if (!open) abortRef.current?.abort()
  }, [open])

  // ── 发送消息 ──────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || sending) return

    // 构建历史 (只传 role+content 给后端)
    const userMsg: Message = { role: 'user', content: trimmed }
    const historyForApi = [...messages.map(m => ({ role: m.role, content: m.content })), { role: 'user', content: trimmed }]

    const assistantMsg: Message = { role: 'assistant', content: '', streaming: true }
    setMessages(prev => [...prev, userMsg, assistantMsg])
    setInput('')
    setSending(true)

    const ctrl = new AbortController()
    abortRef.current = ctrl

    await streamChat(
      historyForApi,
      systemPrompt,
      model,
      // onChunk — 追加 token
      (chunk) => {
        setMessages(prev => {
          const copy = [...prev]
          const last = copy[copy.length - 1]
          if (last?.role === 'assistant') copy[copy.length - 1] = { ...last, content: last.content + chunk }
          return copy
        })
      },
      // onDone
      () => {
        setMessages(prev => {
          const copy = [...prev]
          const last = copy[copy.length - 1]
          if (last?.role === 'assistant') copy[copy.length - 1] = { ...last, streaming: false }
          return copy
        })
        setSending(false)
      },
      // onError
      (err) => {
        setMessages(prev => {
          const copy = [...prev]
          const last = copy[copy.length - 1]
          if (last?.role === 'assistant') copy[copy.length - 1] = { ...last, content: `❌ ${err}`, streaming: false }
          return copy
        })
        setSending(false)
      },
      ctrl.signal,
    )
  }, [messages, sending, systemPrompt, model])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendMessage(input)
    }
  }

  function clearHistory() {
    abortRef.current?.abort()
    setMessages([])
    setSending(false)
  }

  if (!open) return null

  const dialogW = expanded ? 640 : 380
  const dialogH = expanded ? 700 : 520

  return (
    <div
      className="fixed z-50 flex flex-col rounded-xl border border-white/10 bg-[#111] shadow-2xl shadow-black/60"
      style={{
        bottom: 56, right: 24,
        width: dialogW, height: dialogH,
        transition: 'width 0.2s, height 0.2s',
      }}
    >
      {/* ── 头部 ── */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2.5 border-b border-white/[0.08] rounded-t-xl bg-white/[0.03]">
        <Sparkles size={13} className="text-violet-400" />
        <span className="flex-1 text-xs font-semibold text-white/80 truncate">{title}</span>
        {systemPrompt && (
          <span className="text-[9px] text-neutral-600 border border-white/[0.06] rounded px-1.5 py-0.5 shrink-0">
            system ✓
          </span>
        )}
        <button onClick={clearHistory} className="p-1 rounded hover:bg-white/10 text-neutral-600 hover:text-neutral-300 transition-colors" title="清空对话">
          <Trash2 size={12} />
        </button>
        <button onClick={() => setExpanded(v => !v)} className="p-1 rounded hover:bg-white/10 text-neutral-600 hover:text-neutral-300 transition-colors" title={expanded ? '缩小' : '放大'}>
          {expanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
        </button>
        <button onClick={onClose} className="p-1 rounded hover:bg-white/10 text-neutral-600 hover:text-red-400 transition-colors" title="关闭">
          <X size={12} />
        </button>
      </div>

      {/* ── 消息列表 ── */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-neutral-700 select-none">
            <Bot size={28} strokeWidth={1} />
            <p className="text-xs text-neutral-600 text-center">开始对话 — Shift+Enter 换行，Enter 发送</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="shrink-0 w-6 h-6 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center mr-2 mt-0.5">
                <Sparkles size={10} className="text-violet-400" />
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-[12px] leading-relaxed whitespace-pre-wrap break-words ${
                msg.role === 'user'
                  ? 'bg-violet-600/20 border border-violet-500/20 text-white/90'
                  : 'bg-white/[0.04] border border-white/[0.06] text-white/85'
              }`}
            >
              {msg.content}
              {msg.streaming && (
                <span className="inline-block w-0.5 h-3.5 bg-violet-400 ml-0.5 animate-pulse align-text-bottom" />
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* ── 输入区 ── */}
      <div className="shrink-0 border-t border-white/[0.07] px-3 py-2.5 flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入消息... (Enter 发送，Shift+Enter 换行)"
          rows={1}
          disabled={sending}
          className="flex-1 resize-none bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-white/90 placeholder-neutral-700 outline-none focus:border-violet-500/40 transition-colors disabled:opacity-50"
          style={{ maxHeight: 120, overflowY: 'auto' }}
          onInput={e => {
            const el = e.currentTarget
            el.style.height = 'auto'
            el.style.height = `${Math.min(el.scrollHeight, 120)}px`
          }}
        />
        <button
          onClick={() => void sendMessage(input)}
          disabled={sending || !input.trim()}
          className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-violet-600/20 border border-violet-500/30 text-violet-400 hover:bg-violet-600/35 disabled:opacity-40 transition-colors"
          title="发送 (Enter)"
        >
          {sending
            ? <Loader2 size={13} className="animate-spin" />
            : <Send size={13} />
          }
        </button>
      </div>

      {/* ── 底部 model 标注 ── */}
      <div className="shrink-0 px-3 pb-1.5 flex items-center justify-between">
        <span className="text-[9px] text-neutral-800 font-mono">
          {model || 'ark-code-latest'} · 火山引擎 ARK
        </span>
        {sending && (
          <button
            onClick={() => { abortRef.current?.abort(); setSending(false) }}
            className="text-[9px] text-neutral-700 hover:text-red-400 transition-colors"
          >
            停止生成
          </button>
        )}
      </div>
    </div>
  )
}

export default LLMChatDialog
