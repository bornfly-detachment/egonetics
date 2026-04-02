/**
 * routes/perceiver.js — 感知器 REST API
 *
 * GET  /api/perceiver/resource/snapshot   — 立即采集资源指标并返回
 * GET  /api/perceiver/resource/ports      — 读取感知器写入的 Kernel Port 值
 * POST /api/perceiver/resource/start      — 启动周期感知（已启动则幂等）
 * POST /api/perceiver/resource/stop       — 停止周期感知
 */

const express = require('express')
const router = express.Router()
const perceiver = require('../lib/resource-perceiver')

// GET /perceiver/resource/snapshot — on-demand single cycle
router.get('/perceiver/resource/snapshot', async (req, res) => {
  try {
    const metrics = await perceiver.snapshot()
    if (!metrics) return res.status(500).json({ error: 'perceive cycle returned null' })
    res.json(metrics)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /perceiver/resource/ports — read kernel port values
router.get('/perceiver/resource/ports', (req, res) => {
  try {
    res.json(perceiver.getPortValues())
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /perceiver/resource/start — start periodic perception
router.post('/perceiver/resource/start', (req, res) => {
  try {
    perceiver.start()
    res.json({ ok: true, status: 'started', perceiver_id: perceiver.PERCEIVER_ID })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /perceiver/resource/stop — stop periodic perception
router.post('/perceiver/resource/stop', (req, res) => {
  try {
    perceiver.stop()
    res.json({ ok: true, status: 'stopped' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
