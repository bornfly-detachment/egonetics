/**
 * server/routes/code-agent.js
 * Claude Code T-Code Agent HTTP/SSE 路由
 *
 * POST   /api/code-agent/chat             → SSE 流式推送所有 stream-json 事件
 * GET    /api/code-agent/history/:ctx     → 某 context 完整交互历史（JSONL 全量）
 * GET    /api/code-agent/contexts         → 所有 context 列表 + session_id
 * DELETE /api/code-agent/session/:ctx     → 重置 session（可选清空日志 ?clearLog=true）
 * GET    /api/code-agent/tmux/status      → tmux 会话状态
 * POST   /api/code-agent/tmux/ensure      → 确保 tmux 会话存在
 *
 * SSE 事件字段：
 *   data: JSON.stringify(event)
 *   event 结构与 claude --output-format stream-json 完全一致，额外追加 _ts 字段
 *
 * SSE 特殊事件（本路由自行生成）：
 *   { type: 'stream_start', contextKey, sessionId }
 *   { type: 'error', error: string, code?: number }
 *   { type: 'stream_end' }
 */

const express    = require('express')
const router     = express.Router()
const agent      = require('../lib/t2-client')

// ── POST /api/code-agent/chat ──────────────────────────────────────────────
// Body: { prompt, contextKey?, maxTurns?, model?, cwd?, resetCtx?, useTmux? }
router.post('/code-agent/chat', async (req, res) => {
  const {
    prompt,
    contextKey = 'main',
    maxTurns   = 20,
    model,
    cwd,
    resetCtx   = false,
    useTmux    = false,
  } = req.body

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'prompt 不能为空' })
  }

  // SSE 头
  res.setHeader('Content-Type',  'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection',    'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  const send = (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`)
  }

  // 告知客户端流已启动
  send({ type: 'stream_start', contextKey, sessionId: agent.getSessionId(contextKey) })

  try {
    for await (const event of agent.runQuery(prompt, { contextKey, maxTurns, model, cwd, resetCtx, useTmux })) {
      send(event)
    }
  } catch (err) {
    send({ type: 'error', error: err.message ?? String(err) })
  }

  send({ type: 'stream_end' })
  res.end()
})

// ── GET /api/code-agent/history/:ctx ──────────────────────────────────────
router.get('/code-agent/history/:ctx', (req, res) => {
  const { ctx } = req.params
  try {
    const history = agent.getHistory(ctx)
    res.json({ contextKey: ctx, count: history.length, events: history })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/code-agent/contexts ──────────────────────────────────────────
router.get('/code-agent/contexts', (_req, res) => {
  try {
    res.json({ contexts: agent.listContexts() })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── DELETE /api/code-agent/session/:ctx ───────────────────────────────────
// Query: ?clearLog=true  (可选，同时删除 JSONL 日志)
router.delete('/code-agent/session/:ctx', (req, res) => {
  const { ctx }   = req.params
  const clearLog  = req.query.clearLog === 'true'
  try {
    agent.resetContext(ctx, clearLog)
    res.json({ ok: true, contextKey: ctx, clearLog })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/code-agent/health ────────────────────────────────────────────
router.get('/code-agent/health', async (_req, res) => {
  const ok = await agent.checkT2Health()
  res.json({ ok, bin: agent.CLAUDE_BIN })
})

module.exports = router
