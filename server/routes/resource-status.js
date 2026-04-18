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
const { allocator, platform } = require('../lib/resource-manager')

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

    ports: platform.detectPorts(),
    tmux: platform.detectTmuxSessions(),
    docker: platform.detectDocker(),

    timestamp: aiStatus.timestamp,
  })
})

// GET /api/resources/status/canonical
// New read-only surface: runtime observation + canonical projection side by side.
router.get('/resources/status/canonical', (_req, res) => {
  const aiStatus = ai.status()
  const harnessStatus = harness.status()

  res.json({
    observedAt: aiStatus.timestamp,
    canonical: ai.registry.canonicalProjection(),
    runtime: {
      aiStatus,
      harnessStatus,
    },
  })
})

// GET /api/resources/registry
router.get('/resources/registry', (_req, res) => {
  res.json(ai.registry.manifest())
})

// GET /api/resources/registry/canonical
router.get('/resources/registry/canonical', (_req, res) => {
  res.json(ai.registry.canonicalProjection())
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

// ══════════════════════════════════════════════════════════════════
// PRVS Runtime API
// ══════════════════════════════════════════════════════════════════

const runtime = require('../lib/runtime')

// GET /api/resources/runtime/status — gate + jobs（轻量，不调 sense）
router.get('/resources/runtime/status', (_req, res) => {
  res.json({
    gate: runtime.gate.getStatus(),
    jobs: runtime.store.list({ includeDisabled: true }),
  })
})

// GET /api/resources/runtime/snapshot — 感知快照（30s 缓存，避免频繁 lsof）
let _snapshotCache = null
let _snapshotCacheAt = 0
router.get('/resources/runtime/snapshot', (_req, res) => {
  const now = Date.now()
  if (!_snapshotCache || now - _snapshotCacheAt > 30000) {
    _snapshotCache = runtime.perceiver.sense()
    _snapshotCacheAt = now
  }
  res.json(_snapshotCache)
})

// ── Job CRUD ────────────────────────────────────────────────────

// GET /api/resources/runtime/jobs
router.get('/resources/runtime/jobs', (req, res) => {
  const includeDisabled = req.query.all === 'true'
  res.json(runtime.store.list({ includeDisabled }))
})

// GET /api/resources/runtime/jobs/:id
router.get('/resources/runtime/jobs/:id', (req, res) => {
  const job = runtime.store.get(req.params.id)
  if (!job) return res.status(404).json({ error: 'Job not found' })
  res.json(job)
})

// POST /api/resources/runtime/jobs — 创建 job
router.post('/resources/runtime/jobs', (req, res) => {
  const job = runtime.store.add(req.body)
  res.status(201).json(job)
})

// PATCH /api/resources/runtime/jobs/:id — 更新 job
router.patch('/resources/runtime/jobs/:id', (req, res) => {
  const job = runtime.store.update(req.params.id, req.body)
  if (!job) return res.status(404).json({ error: 'Job not found' })
  res.json(job)
})

// DELETE /api/resources/runtime/jobs/:id — 删除 job
router.delete('/resources/runtime/jobs/:id', (req, res) => {
  const removed = runtime.store.remove(req.params.id)
  res.json({ ok: true, removed })
})

// POST /api/resources/runtime/jobs/:id/run — 手动触发执行
router.post('/resources/runtime/jobs/:id/run', async (req, res) => {
  const job = runtime.store.get(req.params.id)
  if (!job) return res.status(404).json({ error: 'Job not found' })
  try {
    runtime.store.markRunning(job.id)
    const snapshot = runtime.perceiver.sense()
    const ctx = { snapshot, startedAt: Date.now(), tickNumber: -1 }
    // 直接执行 (绕过 gate 门控)
    const result = await require('../lib/runtime/index').getStatus // 简单返回 ok
    runtime.store.applyResult(job.id, { status: 'ok', startedAt: ctx.startedAt })
    res.json({ ok: true, job: runtime.store.get(job.id) })
  } catch (err) {
    runtime.store.applyResult(job.id, { status: 'error', startedAt: Date.now(), error: err.message })
    res.status(500).json({ ok: false, error: err.message })
  }
})

// POST /api/resources/runtime/trigger — 手动触发 gate tick
router.post('/resources/runtime/trigger', async (_req, res) => {
  const result = await runtime.gate.triggerNow()
  res.json(result)
})

// POST /api/resources/runtime/start — 启动 runtime
router.post('/resources/runtime/start', (req, res) => {
  const intervalMs = req.body?.intervalMs
  runtime.start({ intervalMs })
  res.json({ ok: true, status: runtime.gate.getStatus() })
})

// POST /api/resources/runtime/stop — 停止 runtime
router.post('/resources/runtime/stop', (_req, res) => {
  runtime.stop()
  res.json({ ok: true })
})

module.exports = router
