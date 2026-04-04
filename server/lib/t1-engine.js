/**
 * server/lib/t1-engine.js
 *
 * T1 执行引擎 — MiniMax 云端（兼容 Anthropic 协议）
 * 完全独立，不依赖 t0-engine.js / t2-client.js。
 *
 * 接口（与 llm-engine.js 兼容）：
 *   call(messages, opts)   → { content, usage, stopReason }
 *   stream(messages, opts) → AsyncGenerator<{ type:'text', text } | { type:'done', usage }>
 */

'use strict'

const Anthropic = require('@anthropic-ai/sdk')

// ── Client ────────────────────────────────────────────────────────────────────

const _client = new Anthropic({
  apiKey:  process.env.MINIMAX_API_KEY  || '',
  baseURL: process.env.MINIMAX_BASE_URL || 'https://api.minimaxi.com/anthropic',
  timeout: 3000000,
})

const MODEL       = process.env.MINIMAX_MODEL || 'MiniMax-M2.7'
const MAX_TOKENS  = parseInt(process.env.MINIMAX_MAX_TOKENS || '4096', 10)
const MAX_RETRIES = 3

// ── Helpers ───────────────────────────────────────────────────────────────────

function _sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

function _retryDelay(attempt) {
  return Math.min(1000 * 2 ** attempt, 30000)
}

function _isRetryable(err) {
  const status = err?.status ?? err?.statusCode
  return status === 429 || status === 529 || status === 500 || status === 503
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * 单轮调用，自动重试。
 * @param {Array<{role:string, content:string}>} messages
 * @param {{ system?: string, maxTokens?: number }} [opts]
 * @returns {Promise<{ content: string, usage: object, stopReason: string }>}
 */
async function call(messages, opts = {}) {
  const maxTokens = opts.maxTokens ?? MAX_TOKENS
  const params = {
    model:      MODEL,
    max_tokens: maxTokens,
    messages,
    ...(opts.system ? { system: opts.system } : {}),
  }

  let attempt = 0
  while (attempt < MAX_RETRIES) {
    try {
      const resp = await _client.messages.create(params)
      return {
        content:    resp.content.find(b => b.type === 'text')?.text ?? '',
        usage:      resp.usage,
        stopReason: resp.stop_reason,
      }
    } catch (err) {
      if (_isRetryable(err) && attempt < MAX_RETRIES - 1) {
        const delay = _retryDelay(attempt)
        console.warn(`[T1] retry ${attempt + 1}/${MAX_RETRIES} in ${delay}ms — ${err.message}`)
        await _sleep(delay)
        attempt++
        continue
      }
      throw err
    }
  }
  throw new Error(`[T1] max retries (${MAX_RETRIES}) exceeded`)
}

/**
 * 流式调用。
 * @yields {{ type: 'text', text: string } | { type: 'done', usage: object, stopReason: string }}
 */
async function* stream(messages, opts = {}) {
  const maxTokens = opts.maxTokens ?? MAX_TOKENS
  const params = {
    model:      MODEL,
    max_tokens: maxTokens,
    messages,
    stream:     true,
    ...(opts.system ? { system: opts.system } : {}),
  }

  const s = await _client.messages.create(params)
  let usage = null

  for await (const event of s) {
    if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
      yield { type: 'text', text: event.delta.text }
    }
    if (event.type === 'message_delta') {
      usage = event.usage
    }
    if (event.type === 'message_stop') {
      yield { type: 'done', usage, stopReason: event.message?.stop_reason }
    }
  }
}

module.exports = { call, stream, MODEL }
