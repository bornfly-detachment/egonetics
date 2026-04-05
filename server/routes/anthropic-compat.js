/**
 * server/routes/anthropic-compat.js
 *
 * 轻量 Anthropic Messages API 兼容层，供 free-code / 任意 Anthropic SDK 调用 T0。
 *
 * 挂载路径: /  (根级别，非 /api)
 * 端点:
 *   POST /v1/messages          — 同步 & 流式
 *   GET  /v1/models            — 返回可用模型列表
 *
 * free-code 设置:
 *   ANTHROPIC_BASE_URL=http://localhost:3002
 *   ANTHROPIC_API_KEY=local   (任意非空字符串)
 *
 * Anthropic 流式 SSE 事件顺序:
 *   message_start → content_block_start → content_block_delta(×N) → content_block_stop → message_delta → message_stop
 */

'use strict'

const express  = require('express')
const router   = express.Router()
const t0Engine = require('../lib/t0-engine')
const t1Engine = require('../lib/t1-engine')
const { v4: uuidv4 } = require('uuid')

const DEFAULT_MAX_TOKENS = 2048

// ── helpers ──────────────────────────────────────────────────────────────────

function pickEngine(model = '') {
  const m = model.toLowerCase()
  if (m.includes('qwen') || m.includes('t0') || m === 'local') return t0Engine
  // minimax / t1
  if (m.includes('minimax') || m.includes('t1')) return t1Engine
  // default: T0
  return t0Engine
}

function buildMessages(body) {
  const msgs = Array.isArray(body.messages) ? body.messages : []
  // Anthropic messages already use {role, content} — pass through as-is
  return msgs
}

function writeSse(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

// ── GET /v1/models ────────────────────────────────────────────────────────────

router.get('/v1/models', (_req, res) => {
  res.json({
    object: 'list',
    data: [
      { id: 'qwen3.5-0.8b',     object: 'model', display_name: 'Qwen 3.5 0.8B (T0 local)' },
      { id: 'minimax-m2.7',     object: 'model', display_name: 'MiniMax M2.7 (T1 cloud)'  },
    ],
  })
})

// ── POST /v1/messages ─────────────────────────────────────────────────────────

router.post('/v1/messages', async (req, res) => {
  const { model, system, max_tokens, stream } = req.body
  const messages   = buildMessages(req.body)
  const maxTokens  = max_tokens || DEFAULT_MAX_TOKENS
  const useStream  = stream === true
  const engine     = pickEngine(model)
  const msgId      = `msg_${uuidv4().replace(/-/g, '').slice(0, 24)}`
  const modelName  = model || 'qwen3.5-0.8b'

  console.log('[compat] model=%s stream=%s msgs=%d system_len=%d', modelName, useStream, messages.length, system?.length ?? 0)

  if (!messages.length) {
    return res.status(400).json({ type: 'error', error: { type: 'invalid_request_error', message: 'messages is required' } })
  }

  // ── 同步模式 ──────────────────────────────────────────────────────────────
  if (!useStream) {
    try {
      const { content: text, usage } = await engine.call(messages, { system, maxTokens })
      console.log('[compat] sync response text_len=%d text_preview=%s', text.length, text.slice(0,80))
      return res.json({
        id:           msgId,
        type:         'message',
        role:         'assistant',
        content:      [{ type: 'text', text }],
        model:        modelName,
        stop_reason:  'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens:  usage?.input_tokens  ?? 0,
          output_tokens: usage?.output_tokens ?? 0,
        },
      })
    } catch (e) {
      return res.status(500).json({ type: 'error', error: { type: 'api_error', message: e.message } })
    }
  }

  // ── 流式模式 (SSE) ────────────────────────────────────────────────────────
  res.setHeader('Content-Type',      'text/event-stream')
  res.setHeader('Cache-Control',     'no-cache')
  res.setHeader('Connection',        'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  // message_start
  writeSse(res, 'message_start', {
    type: 'message_start',
    message: { id: msgId, type: 'message', role: 'assistant', content: [], model: modelName,
               stop_reason: null, stop_sequence: null,
               usage: { input_tokens: 0, output_tokens: 0 } },
  })

  // content_block_start
  writeSse(res, 'content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } })
  writeSse(res, 'ping', { type: 'ping' })

  let outputTokens = 0
  try {
    for await (const event of engine.stream(messages, { system, maxTokens })) {
      if (event.type === 'text') {
        console.log('[compat] stream delta:', JSON.stringify(event.text).slice(0,40))
        writeSse(res, 'content_block_delta', {
          type:  'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: event.text },
        })
        outputTokens++
      }
      if (event.type === 'done') {
        outputTokens = event.usage?.output_tokens || outputTokens
      }
    }
  } catch (e) {
    writeSse(res, 'error', { type: 'error', error: { type: 'api_error', message: e.message } })
    return res.end()
  }

  // content_block_stop
  writeSse(res, 'content_block_stop', { type: 'content_block_stop', index: 0 })

  // message_delta
  writeSse(res, 'message_delta', {
    type:  'message_delta',
    delta: { stop_reason: 'end_turn', stop_sequence: null },
    usage: { output_tokens: outputTokens },
  })

  // message_stop
  writeSse(res, 'message_stop', { type: 'message_stop' })

  res.end()
})

module.exports = router
