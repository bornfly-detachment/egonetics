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

// GET /api/resources/graph — 直接读 pr-graph.json（唯一数据源）
//   ?level=L2                       → L2 节点 + R
//   ?level=L1&parent=P-L2_resource  → 指定 L2 下的 L1 子节点 + R
//   ?level=L0&parent=P-L1_ai-service → 指定 L1 下的 L0 子节点 + R
//   ?id=P-L0-IMPL_ai-call          → 单个节点详情
//   无参数                          → 全量
router.get('/resources/graph', (req, res) => {
  const path = require('path')
  const fs = require('fs')
  const WORKSPACE = process.env.EGONETICS_WORKSPACE || '/Users/Shared/prvse_world_workspace'
  const graphPath = path.join(WORKSPACE, 'chronicle', 'pr-graph.json')

  if (!fs.existsSync(graphPath)) {
    return res.status(404).json({ error: 'pr-graph.json not found' })
  }

  let graph
  try {
    graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'))
  } catch (e) {
    return res.status(500).json({ error: `pr-graph.json parse failed: ${e.message}` })
  }

  const level = req.query.level || null
  const parent = req.query.parent || null
  const nodeId = req.query.id || null

  // 提取 ID→level 映射
  const parseLevel = (id) => {
    const m = id.match(/-L([012])[-_]/)
    return m ? `L${m[1]}` : 'unknown'
  }

  // 收集所有节点（排除 schema）
  const allEntries = Object.entries(graph).filter(([k]) => k !== 'schema')

  // 单节点查询
  if (nodeId) {
    const node = graph[nodeId]
    if (!node) return res.status(404).json({ error: `Node ${nodeId} not found` })
    return res.json({ id: nodeId, level: parseLevel(nodeId), ...node })
  }

  // 展开 relations 为 edges 数组
  const flattenEdges = (entries) => {
    const edges = []
    for (const [id, node] of entries) {
      if (!node?.relations) continue
      for (const [relType, targets] of Object.entries(node.relations)) {
        for (const target of targets) {
          edges.push({ from: id, type: relType, to: target })
        }
      }
    }
    return edges
  }

  if (!level) {
    // 全量
    const nodes = allEntries.map(([id, node]) => ({ id, level: parseLevel(id), ...node }))
    return res.json({ nodes, edges: flattenEdges(allEntries), generated: new Date().toISOString() })
  }

  if (level && !parent) {
    // 指定层级全部
    const filtered = allEntries.filter(([id]) => parseLevel(id) === level)
    const nodes = filtered.map(([id, node]) => ({ id, level, ...node }))
    return res.json({ nodes, edges: flattenEdges(filtered), level, generated: new Date().toISOString() })
  }

  if (parent) {
    // 指定父节点的子节点
    const parentNode = graph[parent]
    if (!parentNode) return res.status(404).json({ error: `Parent ${parent} not found` })
    const childIds = parentNode.children || []
    const result = [[parent, parentNode]]  // 包含父节点本身
    for (const cid of childIds) {
      if (graph[cid]) result.push([cid, graph[cid]])
    }
    const nodes = result.map(([id, node]) => ({ id, level: parseLevel(id), ...node }))
    const nodeIdSet = new Set(result.map(([id]) => id))
    // edges：只返回这些节点之间的关系
    const edges = flattenEdges(result).filter(e => nodeIdSet.has(e.from) || nodeIdSet.has(e.to))
    return res.json({ nodes, edges, level, parent, generated: new Date().toISOString() })
  }
})

module.exports = router
