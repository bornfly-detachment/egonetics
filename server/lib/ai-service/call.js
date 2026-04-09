/**
 * @prvse P-L0-IMPL_ai-call
 * @parent P-L1_ai-service
 * @chronicle prvse_world_workspace/chronicle/P/P-L1_ai-service.yaml
 *
 * 统一 AI 按次调用接口 — 替代分散的 t0-engine / t1-engine / t2-client
 *
 * 所有调用走同一入口，自动：
 *   1. 通过 queue 排队
 *   2. 按 tier 选择协议（OpenAI / Anthropic）
 *   3. 记录日志（token / 延迟 / 成本）
 *   4. 处理各模型的响应差异（MiniMax thinking / Qwen thinking）
 *
 * 接口：
 *   call({ tier, messages, system?, maxTokens?, purpose?, enableThinking? })
 *   → { content, usage, latencyMs, model, tier }
 */

'use strict'

const queue = require('./queue')
const logger = require('./logger')
const platform = require('../resource-manager/platform')

// ── Tier 配置 ────────────────────────────────────────────────────

const TIER_CONFIG = {
  T0: {
    protocol: 'openai',
    getEndpoint: () => `http://localhost:${process.env.T0_INFERENCE_PORT || '8100'}`,
    model: () => process.env.T0_MODEL || 'qwen3.5-0.8b',
    defaultMaxTokens: 4096,
    // Qwen3.5-0.8B official recommended parameters:
    // - temperature=1.0 (not 0.6 — low temp suppresses reasoning)
    // - presence_penalty=1.5 (critical for 0.8B to avoid repetition loops)
    // - top_k=20, top_p=0.95 for thinking; top_p=1.0 for non-thinking
    // WARNING: 0.8B is prone to thinking loops. Use streaming + timeout to detect.
    defaultParams: {
      temperature: 1.0,
      top_p: 0.95,
      top_k: 20,
      presence_penalty: 1.5,
      repetition_penalty: 1.0,
    },
    // Non-thinking params (used when enableThinking=false)
    nonThinkingParams: {
      temperature: 1.0,
      top_p: 1.0,
      top_k: 20,
      presence_penalty: 2.0,
      repetition_penalty: 1.0,
    },
    supportsThinking: true,
  },
  T1: {
    protocol: 'anthropic',
    getEndpoint: () => process.env.MINIMAX_BASE_URL || 'https://api.minimaxi.com/anthropic',
    apiKey: () => process.env.MINIMAX_API_KEY || '',
    model: () => process.env.MINIMAX_MODEL || 'MiniMax-M2.7',
    defaultMaxTokens: 4096,
    defaultParams: {},
    supportsThinking: true,  // MiniMax has thinking blocks
  },
  T2: {
    protocol: 'anthropic',
    getEndpoint: () => 'https://api.anthropic.com',
    apiKey: () => process.env.ANTHROPIC_API_KEY || '',
    model: () => process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
    defaultMaxTokens: 4096,
    defaultParams: {},
    supportsThinking: false,
  },
}

// ── OpenAI 协议调用（T0 Qwen via mlx_lm.server）─────────────────

async function callOpenAI(config, messages, system, maxTokens, enableThinking) {
  const endpoint = config.getEndpoint()
  const port = parseInt(new URL(endpoint).port, 10)
  if (!platform.isPortListening(port)) {
    throw new Error(`T0 server not running at ${endpoint}. Start: mlx_lm.server --model <path> --port ${port}`)
  }

  const msgs = []
  if (system) msgs.push({ role: 'system', content: system })
  msgs.push(...messages)

  // Select params based on thinking mode (Qwen3.5 official recommendations)
  const useThinking = enableThinking && config.supportsThinking
  const params = useThinking ? config.defaultParams : (config.nonThinkingParams || config.defaultParams)

  const body = {
    messages: msgs,
    max_tokens: maxTokens,
    ...params,
  }
  if (useThinking) {
    body.enable_thinking = true
  }

  // Qwen3.5-0.8B is prone to thinking loops — use a shorter timeout
  // and AbortSignal to interrupt runaway generation.
  const timeoutMs = useThinking ? 30000 : 60000

  const resp = await fetch(`${endpoint}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  })

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`T0 ${resp.status}: ${text.slice(0, 200)}`)
  }

  const data = await resp.json()
  if (data.error) throw new Error(`T0: ${typeof data.error === 'string' ? data.error : data.error.message || JSON.stringify(data.error)}`)

  const choice = data.choices?.[0]?.message
  const content = choice?.content || ''
  const reasoning = choice?.reasoning || ''

  return {
    content,
    reasoning,
    usage: {
      inputTokens: data.usage?.prompt_tokens || 0,
      outputTokens: data.usage?.completion_tokens || 0,
    },
  }
}

// ── Anthropic 协议调用（T1 MiniMax / T2 Claude）──────────────────

async function callAnthropic(config, messages, system, maxTokens) {
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
    ...config.defaultParams,
  }
  if (system) params.system = system

  // Retry logic
  const MAX_RETRIES = 3
  let lastErr
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const resp = await client.messages.create(params)

      // Extract content — handle MiniMax thinking blocks
      const textBlock = resp.content.find(b => b.type === 'text')
      let content = ''
      let reasoning = ''

      if (textBlock) {
        content = textBlock.text
      } else {
        // No text block — extract from thinking block (MiniMax)
        const thinkingBlock = resp.content.find(b => b.type === 'thinking')
        if (thinkingBlock && thinkingBlock.thinking) {
          reasoning = thinkingBlock.thinking
          const jsonMatches = thinkingBlock.thinking.match(/\{[^{}]*\}/g)
          if (jsonMatches) {
            content = jsonMatches[jsonMatches.length - 1]
          }
        }
        // Also check for any block with .text property
        if (!content) {
          const withText = resp.content.filter(b => b.text && b.type !== 'thinking')
          if (withText.length > 0) content = withText[withText.length - 1].text
        }
      }

      // Capture reasoning from thinking blocks even when text exists
      if (!reasoning) {
        const tb = resp.content.find(b => b.type === 'thinking')
        if (tb) reasoning = tb.thinking || ''
      }

      return {
        content,
        reasoning,
        usage: {
          inputTokens: resp.usage?.input_tokens || 0,
          outputTokens: resp.usage?.output_tokens || 0,
        },
      }
    } catch (err) {
      lastErr = err
      const status = err?.status ?? err?.statusCode
      if ([429, 500, 503, 529].includes(status) && attempt < MAX_RETRIES - 1) {
        await new Promise(r => setTimeout(r, Math.min(1000 * 2 ** attempt, 15000)))
        continue
      }
      throw err
    }
  }
  throw lastErr
}

// ── 统一调用入口 ─────────────────────────────────────────────────

/**
 * 统一 AI 调用。所有按次调用（classify / compile / 任何 LLM 请求）走这里。
 *
 * @param {Object} opts
 * @param {'T0'|'T1'|'T2'} opts.tier
 * @param {Array<{role:string, content:string}>} opts.messages
 * @param {string} [opts.system]          — system prompt（Anthropic 协议 / OpenAI system role）
 * @param {number} [opts.maxTokens=4096]
 * @param {string} [opts.purpose='unknown'] — 日志标记（classify / compile / chat / ...）
 * @param {boolean} [opts.enableThinking]   — 启用模型思考模式（Qwen / MiniMax）
 * @returns {Promise<{ content, reasoning, usage, latencyMs, model, tier }>}
 */
/**
 * Extract caller location (file:line) from Error stack.
 * Skips frames inside ai-service/ to find the real caller.
 */
function _getCallerSite() {
  const stack = new Error().stack || ''
  const lines = stack.split('\n').slice(1) // skip "Error" line
  const selfDir = __dirname.replace(/\\/g, '/')
  for (const line of lines) {
    const trimmed = line.trim()
    // Skip frames inside ai-service/
    if (trimmed.includes(selfDir)) continue
    // Extract file:line from "at ... (/path/file.js:42:10)" or "at /path/file.js:42:10"
    const m = trimmed.match(/\(([^)]+)\)/) || trimmed.match(/at\s+(.+)/)
    if (m) {
      // Normalize: strip project root for readability
      const loc = m[1].replace(/^.*\/server\//, 'server/').replace(/:\d+$/, '')
      return loc
    }
  }
  return 'unknown'
}

async function call(opts) {
  const { tier = 'T1', messages, system, purpose = 'unknown', enableThinking } = opts
  const maxTokens = opts.maxTokens || TIER_CONFIG[tier]?.defaultMaxTokens || 4096
  const config = TIER_CONFIG[tier]
  if (!config) throw new Error(`Unknown tier: ${tier}`)

  // Auto-capture caller file:line for traceability
  const caller = opts.caller || _getCallerSite()

  const startTime = Date.now()
  const model = config.model()

  // Build identity block — every log record is a self-describing L0 Pattern
  const identity = {
    tier,
    model,
    endpoint: config.getEndpoint(),
    protocol: config.protocol,
    harness: purpose.startsWith('legacy-') ? 'legacy-adapter' : 'ai.call',
    purpose,
    caller,
  }

  let result
  try {
    result = await queue.run(tier, async () => {
      if (config.protocol === 'openai') {
        return callOpenAI(config, messages, system, maxTokens, enableThinking)
      } else {
        return callAnthropic(config, messages, system, maxTokens)
      }
    })
  } catch (err) {
    const latencyMs = Date.now() - startTime
    logger.logCall({ ...identity, inputTokens: 0, outputTokens: 0, latencyMs, success: false, error: err.message })
    throw err
  }

  const latencyMs = Date.now() - startTime

  logger.logCall({
    ...identity,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    latencyMs,
    success: true,
  })

  return {
    ...result,
    latencyMs,
    model,
    tier,
    caller,
  }
}

// ── 流式调用 ─────────────────────────────────────────────────────

/**
 * T0 streaming via OpenAI SSE protocol.
 * Yields: { type:'text', text } | { type:'done', usage }
 */
async function* streamOpenAI(config, messages, system, maxTokens, enableThinking) {
  const endpoint = config.getEndpoint()
  const port = parseInt(new URL(endpoint).port, 10)
  if (!platform.isPortListening(port)) {
    throw new Error(`T0 server not running at ${endpoint}`)
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

/**
 * T1/T2 streaming via Anthropic SDK.
 * Yields: { type:'text', text } | { type:'done', usage }
 */
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

/**
 * 统一流式调用。与 call() 对称，走同一队列 + 日志。
 *
 * @param {Object} opts — 同 call()
 * @yields {{ type:'text', text:string } | { type:'done', usage:object }}
 */
async function* stream(opts) {
  const { tier = 'T1', messages, system, purpose = 'unknown', enableThinking } = opts
  const maxTokens = opts.maxTokens || TIER_CONFIG[tier]?.defaultMaxTokens || 4096
  const config = TIER_CONFIG[tier]
  if (!config) throw new Error(`Unknown tier: ${tier}`)

  const caller = opts.caller || _getCallerSite()
  const startTime = Date.now()
  const model = config.model()

  const identity = {
    tier,
    model,
    endpoint: config.getEndpoint(),
    protocol: config.protocol,
    harness: purpose.startsWith('legacy-') ? 'legacy-adapter' : 'ai.stream',
    purpose,
    caller,
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

module.exports = { call, stream, TIER_CONFIG }
