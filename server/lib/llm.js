/**
 * server/lib/llm.js
 * 三层 LLM 客户端：T0 SEAI 本地 / T1 MiniMax 云端 / T2 Claude 专家
 *
 * T0: localhost:8001 — SEAI 本地 Qwen 推理服务（自定义 /generate 接口）
 * T1: minimaxi.com   — MiniMax-M2.7，高并发，兼容 Anthropic 协议
 * T2: api.anthropic.com — claude-sonnet-4-6，顶级专家模型
 */
const Anthropic = require('@anthropic-ai/sdk')

// T1 — MiniMax（默认）
const minimaxClient = new Anthropic({
  apiKey:  process.env.MINIMAX_API_KEY  || '',
  baseURL: process.env.MINIMAX_BASE_URL || 'https://api.minimaxi.com/anthropic',
  timeout: 3000000,
})

// T0 — SEAI 本地 Qwen（localhost:8001/generate，自定义协议）
// 实现与 Anthropic SDK 相同的 messages.create() 接口，让 llm-engine 无感知。
const SEAI_INFERENCE_URL = process.env.SEAI_INFERENCE_URL || 'http://localhost:8001'

function _extractPrompt(messages) {
  // 取最后一条 user 消息作为 prompt
  const last = [...messages].reverse().find(m => m.role === 'user')
  if (!last) return ''
  if (typeof last.content === 'string') return last.content
  if (Array.isArray(last.content)) {
    return last.content.filter(b => b.type === 'text').map(b => b.text).join('')
  }
  return String(last.content ?? '')
}

const seaiClient = {
  messages: {
    async create(params) {
      const { messages, system, max_tokens, stream } = params
      const prompt    = _extractPrompt(messages)
      const maxTok    = max_tokens || 512
      const body      = JSON.stringify({ prompt, system: system || '', max_tokens: maxTok, temperature: 0.7 })

      if (stream) {
        // SEAI 推理暂不支持流式 — 退化为单次调用后模拟 SSE 事件序列
        const resp = await fetch(`${SEAI_INFERENCE_URL}/generate`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
          signal: AbortSignal.timeout(30000),
        })
        if (!resp.ok) throw new Error(`[T0/SEAI] ${resp.status} ${await resp.text()}`)
        const data = await resp.json()
        const text = data.text ?? ''

        // 返回一个 async iterable，模拟 Anthropic SDK 流式事件
        return (async function* () {
          yield { type: 'content_block_delta', delta: { type: 'text_delta', text } }
          yield { type: 'message_delta',        usage: { input_tokens: 0, output_tokens: 0 } }
          yield { type: 'message_stop',         message: { stop_reason: 'end_turn' } }
        })()
      }

      const resp = await fetch(`${SEAI_INFERENCE_URL}/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
        signal: AbortSignal.timeout(30000),
      })
      if (!resp.ok) throw new Error(`[T0/SEAI] ${resp.status} ${await resp.text()}`)
      const data = await resp.json()

      return {
        content:     [{ type: 'text', text: data.text ?? '' }],
        usage:       { input_tokens: 0, output_tokens: 0 },
        stop_reason: 'end_turn',
      }
    },
  },
}

// T2 — Claude 真实 API（需要 ANTHROPIC_API_KEY 环境变量）
const claudeClient = new Anthropic({
  apiKey:  process.env.ANTHROPIC_API_KEY || '',
  timeout: 3000000,
})

const MODELS = {
  T0: process.env.SEAI_MODEL      || 'seai',
  T1: process.env.MINIMAX_MODEL   || 'MiniMax-M2.7',
  T2: process.env.CLAUDE_MODEL    || 'claude-sonnet-4-6',
}

const DEFAULT_MODEL      = MODELS.T1
const DEFAULT_MAX_TOKENS = parseInt(process.env.MINIMAX_MAX_TOKENS || '4096', 10)

/** 根据 tier 返回对应客户端和模型 */
function getClientForTier(tier) {
  if (tier === 'T0') return { client: seaiClient, model: MODELS.T0 }
  if (tier === 'T2') {
    if (!process.env.ANTHROPIC_API_KEY) {
      // Claude API key 未配置，降级到 MiniMax
      return { client: minimaxClient, model: MODELS.T1, downgraded: true }
    }
    return { client: claudeClient, model: MODELS.T2 }
  }
  return { client: minimaxClient, model: MODELS.T1 }  // T1 or default
}

// 保持向后兼容：其他路由仍可 require('./lib/llm').client
const client = minimaxClient

module.exports = { client, minimaxClient, seaiClient, claudeClient, MODELS, DEFAULT_MODEL, DEFAULT_MAX_TOKENS, getClientForTier }
