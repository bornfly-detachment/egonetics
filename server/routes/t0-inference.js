/**
 * server/routes/t0-inference.js
 *
 * T0 推理路由 — Egonetics 内部推理端点
 *
 * POST /api/t0/generate  → { text, tokens_per_second }
 * GET  /api/t0/health    → { ok, ready, model, port }
 *
 * 内部调用 mlx_lm.server (OpenAI-compatible /v1/chat/completions)
 * 由 t0-runtime.js 管理子进程生命周期。
 */

'use strict'

const express = require('express')
const router  = express.Router()
const runtime = require('../lib/t0-runtime')

// ── 串行队列：T0 单线程推理，防止并发超时 ────────────────────────────────────
let _t0Busy = false
const _t0Queue = []

function acquireT0() {
  return new Promise((resolve) => {
    if (!_t0Busy) { _t0Busy = true; resolve(); return }
    _t0Queue.push(resolve)
  })
}

function releaseT0() {
  if (_t0Queue.length > 0) {
    const next = _t0Queue.shift()
    next()
  } else {
    _t0Busy = false
  }
}

// ── POST /api/t0/generate ────────────────────────────────────────────────────

router.post('/t0/generate', async (req, res) => {
  const { prompt, system, max_tokens = 512, temperature = 0.7, stream = false } = req.body

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'prompt 不能为空' })
  }

  await acquireT0()
  try {
    await runtime.ensureRunning()
  } catch (err) {
    releaseT0()
    return res.status(503).json({ error: `T0 运行时未就绪: ${err.message}` })
  }

  const messages = []
  if (system) messages.push({ role: 'system', content: system })
  messages.push({ role: 'user', content: prompt })

  const MODEL = process.env.T0_MODEL_PATH || '/Users/bornfly/Desktop/qwen-edge-llm/model_weights/Qwen/Qwen3.5-0.8B'

  // ── 流式模式 ─────────────────────────────────────────────────
  if (stream) {
    res.setHeader('Content-Type',  'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection',    'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders()

    let mlxResp
    try {
      mlxResp = await fetch(`${runtime.getBaseUrl()}/v1/chat/completions`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ model: MODEL, messages, max_tokens, temperature, stream: true }),
        signal:  AbortSignal.timeout(90000),
      })
    } catch (err) {
      releaseT0()
      runtime.shutdown()
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`)
      return res.end()
    }

    if (!mlxResp.ok) {
      releaseT0()
      const body = await mlxResp.text().catch(() => '')
      res.write(`data: ${JSON.stringify({ error: `mlx ${mlxResp.status}: ${body}` })}\n\n`)
      return res.end()
    }

    const decoder = new TextDecoder()
    let buf = ''
    for await (const chunk of mlxResp.body) {
      buf += decoder.decode(chunk, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) {
        const data = line.replace(/^data:\s*/, '').trim()
        if (!data || data === '[DONE]') continue
        try {
          const parsed = JSON.parse(data)
          const delta = parsed.choices?.[0]?.delta?.content ?? ''
          if (delta) res.write(`data: ${JSON.stringify({ text: delta })}\n\n`)
        } catch { /* skip malformed */ }
      }
    }
    releaseT0()
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
    return res.end()
  }

  // ── 同步模式 ─────────────────────────────────────────────────
  const t0 = Date.now()
  let mlxResp
  try {
    mlxResp = await fetch(`${runtime.getBaseUrl()}/v1/chat/completions`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ model: MODEL, messages, max_tokens, temperature }),
      signal:  AbortSignal.timeout(90000),
    })
  } catch (err) {
    releaseT0()
    runtime.shutdown()
    return res.status(503).json({ error: `T0 推理调用失败: ${err.message}` })
  }

  if (!mlxResp.ok) {
    releaseT0()
    const body = await mlxResp.text().catch(() => '')
    return res.status(502).json({ error: `mlx_lm.server ${mlxResp.status}: ${body}` })
  }

  const data = await mlxResp.json()
  const text = data.choices?.[0]?.message?.content ?? ''
  const elapsed = (Date.now() - t0) / 1000
  const outputTokens = data.usage?.completion_tokens ?? 0
  const tokensPerSecond = elapsed > 0 ? outputTokens / elapsed : 0

  res.json({ text, tokens_per_second: tokensPerSecond, usage: data.usage })
})

// ── POST /api/t0/v1/chat/completions  (OpenAI-compatible proxy for LiteLLM) ──
// LiteLLM config: api_base: http://localhost:3002/api/t0
// Ensures mlx_lm.server is running, then proxies request transparently.

router.post('/t0/v1/chat/completions', async (req, res) => {
  try {
    await runtime.ensureRunning()
  } catch (err) {
    return res.status(503).json({ error: { message: `T0 runtime not ready: ${err.message}`, type: 'server_error' } })
  }

  const isStream = req.body?.stream === true
  let mlxResp
  try {
    mlxResp = await fetch(`${runtime.getBaseUrl()}/v1/chat/completions`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(req.body),
      signal:  AbortSignal.timeout(60000),
    })
  } catch (err) {
    runtime.shutdown()
    return res.status(503).json({ error: { message: `T0 fetch failed: ${err.message}`, type: 'server_error' } })
  }

  // Pipe headers
  res.status(mlxResp.status)
  const ct = mlxResp.headers.get('content-type')
  if (ct) res.setHeader('Content-Type', ct)
  if (isStream) {
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders()
  }

  // Pipe body
  for await (const chunk of mlxResp.body) {
    res.write(chunk)
  }
  res.end()
})

// ── GET /api/t0/health ───────────────────────────────────────────────────────

router.get('/t0/health', async (_req, res) => {
  const ready = runtime.isReady()
  res.json({
    ok:    ready,
    ready,
    model: process.env.T0_MODEL_PATH || '/Users/bornfly/Desktop/qwen-edge-llm/model_weights/Qwen/Qwen3.5-0.8B',
    port:  runtime.T0_PORT,
    url:   runtime.BASE_URL,
  })
})

module.exports = router
