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

// ── POST /api/t0/generate ────────────────────────────────────────────────────

router.post('/t0/generate', async (req, res) => {
  const { prompt, system, max_tokens = 512, temperature = 0.7 } = req.body

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'prompt 不能为空' })
  }

  try {
    await runtime.ensureRunning()
  } catch (err) {
    return res.status(503).json({ error: `T0 运行时未就绪: ${err.message}` })
  }

  // 构建 messages
  const messages = []
  if (system) messages.push({ role: 'system', content: system })
  messages.push({ role: 'user', content: prompt })

  const t0 = Date.now()

  let mlxResp
  try {
    mlxResp = await fetch(`${runtime.getBaseUrl()}/v1/chat/completions`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        model:       'qwen3.5-0.8b',
        messages,
        max_tokens,
        temperature,
      }),
      signal: AbortSignal.timeout(30000),
    })
  } catch (err) {
    runtime.shutdown()   // 强制重置，下次请求重新启动
    return res.status(503).json({ error: `T0 推理调用失败: ${err.message}` })
  }

  if (!mlxResp.ok) {
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
