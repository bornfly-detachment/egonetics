/**
 * routes/seai.js
 * /api/seai — SEAI 进程管理（Egonetics 内部管理 SubjectiveEgoneticsAI 生命周期）
 *
 * GET  /seai/status       — 当前状态 + PID + uptime + 近期日志
 * POST /seai/start        — 启动 SEAI
 * POST /seai/stop         — 停止 SEAI
 * GET  /seai/logs         — 近期日志（最近 200 条）
 * GET  /seai/logs/stream  — SSE 实时日志流
 */

const express = require('express')
const router = express.Router()
const seaiProcess = require('../lib/seai-process')

// GET /seai/status
router.get('/seai/status', async (req, res) => {
  const snap = seaiProcess.status()
  res.json(snap)
})

// POST /seai/start
router.post('/seai/start', async (req, res) => {
  const result = await seaiProcess.start()
  res.status(result.ok ? 200 : 500).json(result)
})

// POST /seai/stop
router.post('/seai/stop', (req, res) => {
  const result = seaiProcess.stop()
  res.json(result)
})

// GET /seai/logs — 返回最近 200 条
router.get('/seai/logs', (req, res) => {
  const snap = seaiProcess.status()
  res.json({ logs: snap.recentLogs })
})

// GET /seai/logs/stream — SSE 实时推送
router.get('/seai/logs/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  const send = (entry) => {
    res.write(`data: ${JSON.stringify(entry)}\n\n`)
  }

  // Send recent logs first
  const snap = seaiProcess.status()
  for (const entry of snap.recentLogs) send(entry)

  // Stream new logs
  seaiProcess.emitter.on('log', send)

  // Status changes as synthetic log entries
  const onStatus = (s) => send({ t: Date.now(), s: 'status', m: `[status] ${s}` })
  seaiProcess.emitter.on('status', onStatus)

  req.on('close', () => {
    seaiProcess.emitter.off('log', send)
    seaiProcess.emitter.off('status', onStatus)
  })
})

function init() {
  return router
}

module.exports = { init }
