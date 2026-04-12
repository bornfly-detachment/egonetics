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

// GET /api/resources/graph — PR Graph (分级懒加载)
//   ?level=L2           → 只返回 L2 节点 + R-L2（初始视图）
//   ?level=L1&parent=P-L2_resource → 指定 L2 下的 L1 子节点 + R-L1
//   ?level=L0&parent=P-L1_ai-service → 指定 L1 下的 L0 子节点 + R-L0
//   无参数              → 全量（向后兼容）
router.get('/resources/graph', (req, res) => {
  const path = require('path')
  const fs = require('fs')
  const WORKSPACE = process.env.EGONETICS_WORKSPACE || '/Users/Shared/prvse_world_workspace'
  const yamlLib = require('js-yaml')

  const level = req.query.level || null    // 'L0' | 'L1' | 'L2' | null(全量)
  const parent = req.query.parent || null  // 父节点 ID，缩小范围

  // 加载所有 P
  const allNodes = []
  const pDir = path.join(WORKSPACE, 'chronicle', 'P')
  if (fs.existsSync(pDir)) {
    for (const f of fs.readdirSync(pDir).filter(f => f.endsWith('.yaml'))) {
      try {
        const doc = yamlLib.load(fs.readFileSync(path.join(pDir, f), 'utf8'))
        if (!doc?.id || /^P-[0-9a-f]{8}$/.test(doc.id)) continue
        allNodes.push({
          id: doc.id,
          level: doc.level || 'unknown',
          type: doc.sub_type || doc.type || 'unknown',
          parent: doc.parent_L1 || doc.parent_L2 || null,
          description: (doc.what?.description || '').split('\n')[0],
          file: doc.what?.file || null,
          children: doc.children_L0 || doc.children_L1 || [],
          // L0 额外信息（完整展开时用）
          ...(doc.level === 'L0' ? {
            exports: doc.what?.exports || [],
            code_range: doc.what?.file || null,
          } : {}),
          // L2 额外信息
          ...(doc.level === 'L2' ? {
            why: (doc.why || '').split('\n')[0],
            scope: doc.what?.scope || [],
          } : {}),
        })
      } catch { /* skip */ }
    }
  }

  // 加载所有 R
  const allEdges = []
  const rDir = path.join(WORKSPACE, 'chronicle', 'R')
  if (fs.existsSync(rDir)) {
    for (const f of fs.readdirSync(rDir).filter(f => f.endsWith('.yaml'))) {
      try {
        const doc = yamlLib.load(fs.readFileSync(path.join(rDir, f), 'utf8'))
        if (!doc?.id) continue
        allEdges.push({
          id: doc.id,
          level: doc.level || 'unknown',
          type: doc.type,
          from: doc.from,
          to: doc.to,
          condition: doc.condition || null,
          mechanism: doc.mechanism || null,
          why: doc.why ? (typeof doc.why === 'string' ? doc.why.split('\n')[0] : '') : null,
        })
      } catch { /* skip */ }
    }
  }

  // 过滤
  let nodes, edges

  if (!level) {
    // 全量
    nodes = allNodes
    edges = allEdges
  } else if (level === 'L2') {
    // 只返回 L2 节点 + R-L2
    nodes = allNodes.filter(n => n.level === 'L2')
    edges = allEdges.filter(e => e.level === 'L2')
  } else if (parent) {
    // 返回 parent 的直接子节点 + 该层级的 R
    const parentNode = allNodes.find(n => n.id === parent)
    const childIds = new Set(parentNode?.children || [])
    nodes = allNodes.filter(n => childIds.has(n.id))
    // 也返回 parent 本身（前端需要显示上下文）
    if (parentNode) nodes.unshift(parentNode)
    // R：涉及这些节点的该层级关系
    const nodeIds = new Set(nodes.map(n => n.id))
    edges = allEdges.filter(e => e.level === level && (nodeIds.has(e.from) || nodeIds.has(e.to)))
  } else {
    // level 指定但无 parent：返回该层级全部
    nodes = allNodes.filter(n => n.level === level)
    edges = allEdges.filter(e => e.level === level)
  }

  res.json({ nodes, edges, level: level || 'all', parent, generated: new Date().toISOString() })
})

module.exports = router
