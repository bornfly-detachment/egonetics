/**
 * ai-resource-manager/call.js
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
async function call(opts) {
  const { tier = 'T1', messages, system, purpose = 'unknown', enableThinking } = opts
  const maxTokens = opts.maxTokens || TIER_CONFIG[tier]?.defaultMaxTokens || 4096
  const config = TIER_CONFIG[tier]
  if (!config) throw new Error(`Unknown tier: ${tier}`)

  const startTime = Date.now()
  const model = config.model()

  const result = await queue.run(tier, async () => {
    if (config.protocol === 'openai') {
      return callOpenAI(config, messages, system, maxTokens, enableThinking)
    } else {
      return callAnthropic(config, messages, system, maxTokens)
    }
  })

  const latencyMs = Date.now() - startTime

  // 记录日志
  logger.logCall({
    tier,
    model,
    purpose,
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
  }
}

module.exports = { call, TIER_CONFIG }
