/**
 * @prvse P-L0-IMPL_ai-call
 * @parent P-L1_ai-service
 * @chronicle prvse_world_workspace/chronicle/P/P-L0-IMPL_ai-call.yaml
 *
 * 统一 AI 同步调用接口
 *
 * call({ tier, messages, system?, maxTokens?, purpose?, enableThinking? })
 * → { content, reasoning, usage, latencyMs, model, tier, caller }
 */

'use strict'

const queue = require('./queue')
const logger = require('./logger')
const { TIER_CONFIG, getCallerSite, isT0PortListening } = require('./tier-config')

// ── OpenAI 协议调用（T0 Qwen via mlx_lm.server）─────────────────

async function callOpenAI(config, messages, system, maxTokens, enableThinking) {
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

  const body = { messages: msgs, max_tokens: maxTokens, ...params }
  if (useThinking) body.enable_thinking = true

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
  return {
    content: choice?.content || '',
    reasoning: choice?.reasoning || '',
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

  const MAX_RETRIES = 3
  let lastErr
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const resp = await client.messages.create(params)

      const textBlock = resp.content.find(b => b.type === 'text')
      let content = ''
      let reasoning = ''

      if (textBlock) {
        content = textBlock.text
      } else {
        const thinkingBlock = resp.content.find(b => b.type === 'thinking')
        if (thinkingBlock && thinkingBlock.thinking) {
          reasoning = thinkingBlock.thinking
          const jsonMatches = thinkingBlock.thinking.match(/\{[^{}]*\}/g)
          if (jsonMatches) content = jsonMatches[jsonMatches.length - 1]
        }
        if (!content) {
          const withText = resp.content.filter(b => b.text && b.type !== 'thinking')
          if (withText.length > 0) content = withText[withText.length - 1].text
        }
      }

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

async function call(opts) {
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
    harness: purpose.startsWith('legacy-') ? 'legacy-adapter' : 'ai.call',
    purpose, caller,
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

  return { ...result, latencyMs, model, tier, caller }
}

module.exports = { call, TIER_CONFIG }
