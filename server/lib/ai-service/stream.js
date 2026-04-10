/**
 * @prvse P-L0-IMPL_ai-stream
 * @parent P-L1_ai-service
 * @chronicle prvse_world_workspace/chronicle/P/P-L0-IMPL_ai-stream.yaml
 *
 * 统一 AI 流式调用接口
 *
 * stream({ tier, messages, system?, maxTokens?, purpose?, enableThinking? })
 * → AsyncGenerator<{ type:'text', text } | { type:'done', usage }>
 */

'use strict'

const queue = require('./queue')
const logger = require('./logger')
const { TIER_CONFIG, getCallerSite, isT0PortListening } = require('./tier-config')

// ── T0 streaming via OpenAI SSE ──────────────────────────────────

async function* streamOpenAI(config, messages, system, maxTokens, enableThinking) {
  const endpoint = config.getEndpoint()
  if (!isT0PortListening()) {
    const port = parseInt(new URL(endpoint).port, 10)
    throw new Error(`T0 server not running at ${endpoint}. Start: mlx_lm.server --model <path> --port ${port}`)
  }

  const msgs = []
  if (system) msgs.push({ role: 'system', content: system })
  msgs.push(...messages)

  const useThinking = enableThinking && config.supportsThinking
  const params = useThinking ? config.defaultParams : (config.nonThinkingParams || config.defaultParams)

  const body = { messages: msgs, max_tokens: maxTokens, stream: true, ...params }
  if (useThinking) body.enable_thinking = true

  const resp = await fetch(`${endpoint}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90000),
  })

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`T0 stream ${resp.status}: ${text.slice(0, 200)}`)
  }

  const decoder = new TextDecoder()
  let buf = ''
  for await (const chunk of resp.body) {
    buf += decoder.decode(chunk, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) {
      const data = line.replace(/^data:\s*/, '').trim()
      if (!data || data === '[DONE]') continue
      try {
        const parsed = JSON.parse(data)
        const delta = parsed.choices?.[0]?.delta?.content ?? ''
        if (delta) yield { type: 'text', text: delta }
      } catch { /* skip malformed */ }
    }
  }
  yield { type: 'done', usage: { inputTokens: 0, outputTokens: 0 } }
}

// ── T1/T2 streaming via Anthropic SDK ────────────────────────────

async function* streamAnthropic(config, messages, system, maxTokens) {
  const Anthropic = require('@anthropic-ai/sdk')
  const client = new Anthropic({
    apiKey: config.apiKey(),
    baseURL: config.getEndpoint(),
    timeout: 120000,
  })

  const params = {
    model: config.model(),
    max_tokens: maxTokens,
    messages,
    stream: true,
    ...config.defaultParams,
  }
  if (system) params.system = system

  const s = await client.messages.create(params)
  let usage = null

  for await (const event of s) {
    if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
      yield { type: 'text', text: event.delta.text }
    }
    if (event.type === 'message_delta') {
      usage = event.usage
    }
    if (event.type === 'message_stop') {
      yield { type: 'done', usage: { inputTokens: usage?.input_tokens || 0, outputTokens: usage?.output_tokens || 0 } }
    }
  }
}

// ── 统一流式入口 ─────────────────────────────────────────────────

async function* stream(opts) {
  const { tier = 'T1', messages, system, purpose = 'unknown', enableThinking } = opts
  const maxTokens = opts.maxTokens || TIER_CONFIG[tier]?.defaultMaxTokens || 4096
  const config = TIER_CONFIG[tier]
  if (!config) throw new Error(`Unknown tier: ${tier}`)

  const caller = opts.caller || getCallerSite()
  const startTime = Date.now()
  const model = config.model()

  const identity = {
    tier, model,
    endpoint: config.getEndpoint(),
    protocol: config.protocol,
    harness: purpose.startsWith('legacy-') ? 'legacy-adapter' : 'ai.stream',
    purpose, caller,
  }

  await queue.acquire(tier)
  let outputTokens = 0
  try {
    const gen = config.protocol === 'openai'
      ? streamOpenAI(config, messages, system, maxTokens, enableThinking)
      : streamAnthropic(config, messages, system, maxTokens)

    for await (const event of gen) {
      if (event.type === 'text') {
        yield event
      } else if (event.type === 'done') {
        outputTokens = event.usage?.outputTokens || 0
        yield event
      }
    }

    logger.logCall({ ...identity, inputTokens: 0, outputTokens, latencyMs: Date.now() - startTime, success: true })
  } catch (err) {
    logger.logCall({ ...identity, inputTokens: 0, outputTokens: 0, latencyMs: Date.now() - startTime, success: false, error: err.message })
    throw err
  } finally {
    queue.release(tier)
  }
}

module.exports = { stream }
