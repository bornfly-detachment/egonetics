/**
 * src/lib/ai-bus.ts
 * AI Bus — 前端 AI 能力调用协议层
 *
 * 等价于 Claude/Anthropic SDK 在前端的标准接入协议。
 * 所有组件通过 useAI() 或直接调用此模块，不直接 fetch /api/ai/chat。
 *
 * componentId 命名规范：{层级}-{来源}-{是什么}-{目的}
 *   L0-lab-Controller1-Rule2Validate
 *   L1-Task-ControllerImpl-RequirementAnalysis
 *   L2-Canvas-NodeEditor-AutoComplete
 *   L3-World-BuilderAgent-StructureMutation
 */

import { getToken } from './http'

// ── 类型 ──────────────────────────────────────────────────────

export interface AIMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AITiming {
  component_id: string
  tier: string
  enqueue_at: number      // ms since epoch，进队列时刻
  start_at: number        // ms since epoch，真实 LLM 开始时刻
  end_at: number          // ms since epoch，LLM 结束时刻
  queue_wait_ms: number   // 排队等待时长
  duration_ms: number     // 真实 LLM 响应时长
}

export interface AIMeta {
  tier: string
  component_id: string
  enqueue_at: number
  start_at: number
  queue_wait_ms: number
}

export interface AIStreamChunk {
  text?: string
  done?: boolean
  error?: string
  meta?: AIMeta
  timing?: AITiming
  usage?: { input_tokens: number; output_tokens: number }
}

export interface AICallOptions {
  tier?: 'T0' | 'T1' | 'T2'
  system?: string
  model?: string
  max_tokens?: number
}

export interface AISyncResult {
  text: string
  timing: AITiming
  usage?: { input_tokens: number; output_tokens: number }
}

// ── 流式调用 ──────────────────────────────────────────────────

/**
 * 流式调用，返回 AsyncGenerator<AIStreamChunk>
 * 首个 chunk 为 meta（含排队等待时长）
 * 末尾 chunk 为 done=true（含完整 timing）
 */
export async function* aiStream(
  componentId: string,
  messages: AIMessage[],
  opts: AICallOptions = {}
): AsyncGenerator<AIStreamChunk> {
  const token = getToken()

  let resp: Response
  try {
    resp = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        messages,
        tier:        opts.tier ?? 'T1',
        system:      opts.system,
        model:       opts.model,
        max_tokens:  opts.max_tokens,
        stream:      true,
        componentId,
      }),
    })
  } catch (e: unknown) {
    yield { error: e instanceof Error ? e.message : '网络错误' }
    return
  }

  if (!resp.ok) {
    yield { error: `HTTP ${resp.status}` }
    return
  }

  const reader = resp.body!.getReader()
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
        yield JSON.parse(line.slice(6)) as AIStreamChunk
      } catch { /* skip malformed */ }
    }
  }
}

// ── 同步调用 ──────────────────────────────────────────────────

/**
 * 同步调用，等待完整响应（适合后台分析、非流式场景）
 */
export async function aiCall(
  componentId: string,
  messages: AIMessage[],
  opts: AICallOptions = {}
): Promise<AISyncResult> {
  const token = getToken()

  const resp = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      messages,
      tier:        opts.tier ?? 'T1',
      system:      opts.system,
      model:       opts.model,
      max_tokens:  opts.max_tokens,
      stream:      false,
      componentId,
    }),
  })

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? `HTTP ${resp.status}`)
  }

  return resp.json() as Promise<AISyncResult>
}

// ── 队列状态查询 ──────────────────────────────────────────────

export interface TierStats {
  tier: string
  max: number
  active: number
  queued: number
}

export async function fetchAIStats(): Promise<TierStats[]> {
  const token = getToken()
  const resp = await fetch('/api/ai/stats', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  const data = await resp.json() as { semaphores: TierStats[] }
  return data.semaphores ?? []
}
