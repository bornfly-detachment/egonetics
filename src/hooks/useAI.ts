/**
 * src/hooks/useAI.ts
 * 组件级 AI 能力挂载钩子
 *
 * 用法：
 *   const { send, streaming, messages, timing } = useAI({
 *     componentId: 'L1-Task-ControllerImpl-RequirementAnalysis',
 *     tier: 'T1',
 *   })
 *
 * timing 字段在前端展示（元数据）：
 *   queueWaitMs  — 排队等待时长（ms）
 *   durationMs   — LLM 真实响应时长（ms）
 *   enqueuedAt   — 进队列时刻
 *   startAt      — LLM 开始时刻
 *   endAt        — LLM 结束时刻
 */

import { useState, useRef, useCallback } from 'react'
import { aiStream, type AIMessage, type AITiming, type AICallOptions } from '@/lib/ai-bus'

interface UseAIOptions extends AICallOptions {
  componentId: string
}

export interface UseAIReturn {
  messages: AIMessage[]
  streaming: boolean
  timing: AITiming | null       // 上一次调用的完整计时
  queueWaitMs: number | null    // 上一次排队等待时长（首包即可得）
  send: (text: string) => Promise<void>
  reset: () => void
}

export function useAI({
  componentId,
  tier       = 'T1',
  system,
  model,
  max_tokens,
}: UseAIOptions): UseAIReturn {
  const [messages,    setMessages]    = useState<AIMessage[]>([])
  const [streaming,   setStreaming]   = useState(false)
  const [timing,      setTiming]      = useState<AITiming | null>(null)
  const [queueWaitMs, setQueueWaitMs] = useState<number | null>(null)

  const abortedRef = useRef(false)

  const send = useCallback(async (text: string) => {
    const userMsg: AIMessage = { role: 'user', content: text }
    const history = [...messages, userMsg]

    setMessages([...history, { role: 'assistant', content: '' }])
    setStreaming(true)
    setQueueWaitMs(null)
    abortedRef.current = false

    let accum = ''

    try {
      for await (const chunk of aiStream(componentId, history, { tier, system, model, max_tokens })) {
        if (abortedRef.current) break

        // 首包：排队等待时长（立即可得，无需等 LLM 响应）
        if (chunk.meta?.queue_wait_ms !== undefined) {
          setQueueWaitMs(chunk.meta.queue_wait_ms)
        }

        if (chunk.text) {
          accum += chunk.text
          setMessages(prev => {
            const next = [...prev]
            next[next.length - 1] = { role: 'assistant', content: accum }
            return next
          })
        }

        if (chunk.done) {
          if (chunk.timing) setTiming(chunk.timing)
          setMessages(prev => {
            const next = [...prev]
            next[next.length - 1] = { role: 'assistant', content: accum || next[next.length - 1].content }
            return next
          })
        }

        if (chunk.error) {
          setMessages(prev => {
            const next = [...prev]
            next[next.length - 1] = { role: 'assistant', content: `错误：${chunk.error}` }
            return next
          })
        }
      }
    } finally {
      setStreaming(false)
    }
  }, [messages, componentId, tier, system, model, max_tokens])

  const reset = useCallback(() => {
    abortedRef.current = true
    setMessages([])
    setTiming(null)
    setQueueWaitMs(null)
    setStreaming(false)
  }, [])

  return { messages, streaming, timing, queueWaitMs, send, reset }
}
