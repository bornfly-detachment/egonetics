/**
 * routes/resource-status.js
 *
 * 资源管理状态 API — 聚合 ai-service + harness-manager + resource-manager
 *
 * 挂载: /api/resources
 *
 * GET /api/resources/status    → 系统健康 + tier 状态 + session 配额
 * GET /api/resources/registry  → provider/consumer 注册表
 * GET /api/resources/logs      → 调用日志（?date=YYYY-MM-DD）
 * GET /api/resources/logs/dates → 可用日志日期列表
 */

'use strict'

const express = require('express')
const router = express.Router()
const ai = require('../lib/ai-service')
const harness = require('../lib/harness-manager')
const { allocator } = require('../lib/resource-manager')

// Ensure allocator is running
ai.start()

// GET /api/resources/status
router.get('/resources/status', (_req, res) => {
  const aiStatus = ai.status()
  const harnessStatus = harness.status()
  const limits = allocator.getLimits()

  res.json({
    health: aiStatus.health,
    mustReclaim: aiStatus.mustReclaim,

    system: {
      ram: limits.ram,
      swap: limits.swap,
      pressure: aiStatus.pressure,
    },

    tiers: aiStatus.tiers,

    sessions: harnessStatus,

    queue: {
      T0: aiStatus.tiers.T0?.queue,
      T1: aiStatus.tiers.T1?.queue,
      T2: aiStatus.tiers.T2?.queue,
    },

    orphans: limits.categories?.orphans?.length || 0,
    timestamp: aiStatus.timestamp,
  })
})

// GET /api/resources/registry
router.get('/resources/registry', (_req, res) => {
  res.json(ai.registry.manifest())
})

// GET /api/resources/logs?date=YYYY-MM-DD&n=50
router.get('/resources/logs', (req, res) => {
  const date = req.query.date || undefined
  const n = parseInt(req.query.n || '100', 10)
  const calls = ai.logger.recentCalls(n, date)
  res.json({ date: date || new Date().toISOString().slice(0, 10), count: calls.length, calls })
})

// GET /api/resources/logs/dates
router.get('/resources/logs/dates', (_req, res) => {
  res.json({ dates: ai.logger.listDates() })
})

// GET /api/resources/logs/summary?date=YYYY-MM-DD
router.get('/resources/logs/summary', (req, res) => {
  res.json(ai.logger.todaySummary(req.query.date))
})

module.exports = router
