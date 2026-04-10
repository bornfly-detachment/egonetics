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

// GET /api/resources/graph — PR Graph (nodes + edges from chronicle)
router.get('/resources/graph', (_req, res) => {
  try {
    const graphGen = require('../../prvse_world_workspace/chronicle/compiler/prvse-graph')
    // prvse-graph.js doesn't export functions yet — use child_process
  } catch { /* fallback below */ }

  // Direct load from chronicle YAML
  const path = require('path')
  const fs = require('fs')
  const WORKSPACE = process.env.EGONETICS_WORKSPACE || '/Users/Shared/prvse_world_workspace'
  const yamlLib = require('js-yaml')

  const nodes = []
  const pDir = path.join(WORKSPACE, 'chronicle', 'P')
  if (fs.existsSync(pDir)) {
    for (const f of fs.readdirSync(pDir).filter(f => f.endsWith('.yaml'))) {
      try {
        const doc = yamlLib.load(fs.readFileSync(path.join(pDir, f), 'utf8'))
        if (!doc?.id || /^P-[0-9a-f]{8}$/.test(doc.id)) continue
        nodes.push({
          id: doc.id, level: doc.level || 'unknown',
          type: doc.sub_type || doc.type || 'unknown',
          parent: doc.parent_L1 || doc.parent_L2 || null,
          description: (doc.what?.description || '').split('\n')[0],
          file: doc.what?.file || null,
          children: doc.children_L0 || doc.children_L1 || [],
        })
      } catch { /* skip */ }
    }
  }

  const edges = []
  const rDir = path.join(WORKSPACE, 'chronicle', 'R')
  if (fs.existsSync(rDir)) {
    for (const f of fs.readdirSync(rDir).filter(f => f.endsWith('.yaml'))) {
      try {
        const doc = yamlLib.load(fs.readFileSync(path.join(rDir, f), 'utf8'))
        if (!doc?.id) continue
        edges.push({
          id: doc.id, level: doc.level || 'unknown',
          type: doc.type, from: doc.from, to: doc.to,
          condition: doc.condition || null,
          mechanism: doc.mechanism || null,
        })
      } catch { /* skip */ }
    }
  }

  res.json({ nodes, edges, generated: new Date().toISOString() })
})

module.exports = router
