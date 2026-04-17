/**
 * routes/runtime.js — PRVSE Runtime REST API
 *
 * L0/L1 Job CRUD + Gate 控制 + L2 Coordinator 入口
 *
 * GET    /runtime/status              — gate 状态 + 快照 + jobs 汇总
 * GET    /runtime/jobs                — 列出所有 jobs (includeDisabled query)
 * POST   /runtime/jobs                — 创建 job
 * GET    /runtime/jobs/:id            — 获取单个 job
 * PATCH  /runtime/jobs/:id            — 更新 job
 * DELETE /runtime/jobs/:id            — 删除 job
 * POST   /runtime/jobs/:id/trigger    — 手动触发单个 job (L1 直接执行)
 * POST   /runtime/gate/trigger        — 触发一次完整 gate tick
 * POST   /runtime/gate/start          — 启动 runtime
 * POST   /runtime/gate/stop           — 停止 runtime
 * POST   /runtime/coordinator/decompose — L2: 目标 → jobs
 */

'use strict'

const express = require('express')
const router = express.Router()
const runtime = require('../lib/runtime')
const coordinator = require('../lib/runtime/coordinator')

// ── Status ──────────────────────────────────────────────────────

// GET /runtime/status
router.get('/runtime/status', (req, res) => {
  try {
    const status = runtime.getStatus()
    res.json({ ok: true, ...status })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ── Job CRUD ─────────────────────────────────────────────────────

// GET /runtime/jobs
router.get('/runtime/jobs', (req, res) => {
  try {
    const includeDisabled = req.query.includeDisabled === 'true'
    const jobs = runtime.store.list({ includeDisabled })
    res.json({ ok: true, count: jobs.length, jobs })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// POST /runtime/jobs
router.post('/runtime/jobs', (req, res) => {
  try {
    const { name, description, schedule, payload, enabled } = req.body
    if (!name) return res.status(400).json({ ok: false, error: 'name is required' })
    if (!payload) return res.status(400).json({ ok: false, error: 'payload is required' })

    const job = runtime.store.add({ name, description, schedule, payload, enabled })
    res.status(201).json({ ok: true, job })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// GET /runtime/jobs/:id
router.get('/runtime/jobs/:id', (req, res) => {
  try {
    const job = runtime.store.get(req.params.id)
    if (!job) return res.status(404).json({ ok: false, error: 'job not found' })
    res.json({ ok: true, job })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// PATCH /runtime/jobs/:id
router.patch('/runtime/jobs/:id', (req, res) => {
  try {
    const { name, description, schedule, payload, enabled } = req.body
    const updated = runtime.store.update(req.params.id, { name, description, schedule, payload, enabled })
    if (!updated) return res.status(404).json({ ok: false, error: 'job not found' })
    res.json({ ok: true, job: updated })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// DELETE /runtime/jobs/:id
router.delete('/runtime/jobs/:id', (req, res) => {
  try {
    const removed = runtime.store.remove(req.params.id)
    if (!removed) return res.status(404).json({ ok: false, error: 'job not found' })
    res.json({ ok: true, removed: req.params.id })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ── Job manual trigger ───────────────────────────────────────────

// POST /runtime/jobs/:id/trigger
router.post('/runtime/jobs/:id/trigger', async (req, res) => {
  try {
    const job = runtime.store.get(req.params.id)
    if (!job) return res.status(404).json({ ok: false, error: 'job not found' })

    runtime.store.markRunning(job.id)
    const startedAt = Date.now()

    // executeJob is not exported; re-implement dispatch inline
    const payload = job.payload || {}
    let summary = 'unknown payload kind'

    if (payload.kind === 'systemEvent') {
      console.log(`[runtime/trigger] systemEvent: ${payload.text || '(empty)'}`)
      summary = payload.text || '(empty)'
    } else if (payload.kind === 'agentTurn') {
      const ai = require('../lib/ai-service')
      const result = await ai.call({
        tier: payload.tier || 'T1',
        system: payload.system || 'You are a task executor. Be concise.',
        messages: [{ role: 'user', content: payload.message || '' }],
        maxTokens: payload.maxTokens || 4096,
        purpose: `runtime-manual-${job.id}`,
      })
      summary = (result.content || '').slice(0, 500)
    }

    runtime.store.applyResult(job.id, { status: 'ok', startedAt, summary })
    res.json({ ok: true, job: runtime.store.get(job.id), summary })
  } catch (err) {
    if (req.params.id) {
      runtime.store.applyResult(req.params.id, { status: 'error', startedAt: Date.now(), error: err.message })
    }
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ── Gate control ─────────────────────────────────────────────────

// POST /runtime/gate/trigger
router.post('/runtime/gate/trigger', async (req, res) => {
  try {
    const result = await runtime.gate.triggerNow()
    res.json({ ok: true, ...result })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// POST /runtime/gate/start
router.post('/runtime/gate/start', (req, res) => {
  try {
    const { intervalMs } = req.body
    runtime.start({ intervalMs })
    res.json({ ok: true, status: runtime.gate.getStatus() })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// POST /runtime/gate/stop
router.post('/runtime/gate/stop', (req, res) => {
  try {
    runtime.stop()
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ── L2 Coordinator ───────────────────────────────────────────────

// POST /runtime/coordinator/decompose
router.post('/runtime/coordinator/decompose', async (req, res) => {
  try {
    const { goal, tier, maxJobs } = req.body
    if (!goal) return res.status(400).json({ ok: false, error: 'goal is required' })

    const jobs = await coordinator.decompose({ goal, tier, maxJobs })
    res.json({ ok: true, goal, jobs })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// GET /runtime/coordinator/status
router.get('/runtime/coordinator/status', (req, res) => {
  try {
    res.json({ ok: true, ...coordinator.getStatus() })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

module.exports = router
