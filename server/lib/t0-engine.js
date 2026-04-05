/**
 * server/lib/t0-engine.js
 *
 * T0 执行引擎 — 直接调用本地 Qwen 推理服务（localhost:8001）
 * 完全独立，不依赖 Anthropic SDK，不依赖 llm-engine.js。
 *
 * 接口（与 llm-engine.js 兼容）：
 *   call(messages, opts)   → { content, usage, stopReason }
 *   stream(messages, opts) → AsyncGenerator<{ type:'text', text } | { type:'done', usage }>
 *   checkHealth()          → Promise<boolean>
 */

'use strict'

// T0 调用 Egonetics 内部推理端点（由 t0-runtime.js 管理 mlx_lm.server）
const EGONETICS_BASE = process.env.EGONETICS_SERVER_URL || 'http://localhost:3002'
const T0_GENERATE    = `${EGONETICS_BASE}/api/t0/generate`
const DEFAULT_MAX_TOKENS = 2048
const TIMEOUT_MS = 35000

// ── Helpers ──────────────────────────────────────────────────────────────────

function _extractPrompt(messages) {
  const last = [...messages].reverse().find(m => m.role === 'user')
  if (!last) return ''
  if (typeof last.content === 'string') return last.content
  if (Array.isArray(last.content)) {
    return last.content.filter(b => b.type === 'text').map(b => b.text).join('')
  }
  return String(last.content ?? '')
}

async function _generate(prompt, system, maxTokens) {
  const resp = await fetch(T0_GENERATE, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ prompt, system: system || '', max_tokens: maxTokens }),
    signal:  AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!resp.ok) {
    const body = await resp.text().catch(() => '')
    throw new Error(`[T0] /api/t0/generate ${resp.status}: ${body}`)
  }
  return await resp.json()  // { text, tokens_per_second }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * 单轮调用。
 * @param {Array<{role:string, content:string}>} messages
 * @param {{ system?: string, maxTokens?: number }} [opts]
 * @returns {Promise<{ content: string, usage: object, stopReason: string }>}
 */
async function call(messages, opts = {}) {
  const prompt    = _extractPrompt(messages)
  const system    = opts.system    ?? ''
  const maxTokens = opts.maxTokens ?? DEFAULT_MAX_TOKENS

  const data = await _generate(prompt, system, maxTokens)

  return {
    content:    data.text ?? '',
    usage:      { input_tokens: 0, output_tokens: 0, tokens_per_second: data.tokens_per_second },
    stopReason: 'end_turn',
  }
}

/**
 * 流式调用（推理服务不支持 SSE，退化为一次性返回模拟流）。
 * @yields {{ type: 'text', text: string } | { type: 'done', usage: object }}
 */
async function* stream(messages, opts = {}) {
  const prompt    = _extractPrompt(messages)
  const system    = opts.system    ?? ''
  const maxTokens = opts.maxTokens ?? DEFAULT_MAX_TOKENS

  const data = await _generate(prompt, system, maxTokens)
  const text = data.text ?? ''

  if (text) yield { type: 'text', text }
  yield { type: 'done', usage: { input_tokens: 0, output_tokens: 0 }, stopReason: 'end_turn' }
}

/**
 * 检查推理服务是否在线且模型已加载。
 * @returns {Promise<boolean>}
 */
async function checkHealth() {
  try {
    const resp = await fetch(`${SEAI_BASE}/health`, { signal: AbortSignal.timeout(3000) })
    const data = await resp.json()
    return data.status === 'ok' && data.model_loaded === true
  } catch {
    return false
  }
}

module.exports = { call, stream, checkHealth, SEAI_BASE }
