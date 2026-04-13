/**
 * @prvse P-L1_runtime
 *
 * PRVS Runtime — 入口模块
 *
 * L0: gate (门控) + perceiver (感知) + store (持久化)
 * L1: 调度逻辑（gate.onReady 回调）
 *
 * 用法：
 *   const runtime = require('./lib/runtime')
 *   runtime.start({ intervalMs: 10 * 60_000 })
 *   runtime.stop()
 */

'use strict'

const gate = require('./gate')
const store = require('./store')
const perceiver = require('./perceiver')

/**
 * L1 调度回调 — gate 门控通过后执行。
 * 从 store 取到期 job → 逐个执行 → 记录结果。
 */
async function onReady(ctx) {
  const dueJobs = store.collectDueJobs(ctx.startedAt)

  if (dueJobs.length === 0) {
    console.log(`[runtime] tick #${ctx.tickNumber} — no due jobs, ${ctx.snapshot.summary.alive}/${ctx.snapshot.summary.total} services alive`)
    return
  }

  console.log(`[runtime] tick #${ctx.tickNumber} — ${dueJobs.length} due jobs`)

  for (const job of dueJobs) {
    store.markRunning(job.id)

    try {
      const result = await executeJob(job, ctx)
      store.applyResult(job.id, { status: 'ok', startedAt: ctx.startedAt, ...result })
    } catch (err) {
      store.applyResult(job.id, { status: 'error', startedAt: ctx.startedAt, error: err.message })
      console.error(`[runtime] job ${job.id} (${job.name}) failed:`, err.message)
    }
  }
}

/**
 * 执行单个 job。
 * payload.kind 决定执行方式：
 *   systemEvent → 打印日志（MVP 最简）
 *   agentTurn   → 调用 ai-service（未来扩展）
 */
async function executeJob(job, ctx) {
  const payload = job.payload || {}

  if (payload.kind === 'systemEvent') {
    console.log(`[runtime] systemEvent: ${payload.text || '(empty)'}`)
    return { summary: payload.text }
  }

  if (payload.kind === 'agentTurn') {
    // L1 扩展点：调用 ai-service
    const ai = require('../ai-service')
    const result = await ai.call({
      tier: payload.tier || 'T1',
      system: payload.system || 'You are a task executor. Be concise.',
      messages: [{ role: 'user', content: payload.message || '' }],
      maxTokens: payload.maxTokens || 4096,
      purpose: `runtime-job-${job.id}`,
    })
    return { summary: (result.content || '').slice(0, 200) }
  }

  return { summary: 'unknown payload kind' }
}

// ── Public API ──────────────────────────────────────────────────

function start(opts = {}) {
  gate.start({
    intervalMs: opts.intervalMs,
    onReady,
  })
  console.log('[runtime] PRVS runtime started')
}

function stop() {
  gate.stop()
  console.log('[runtime] PRVS runtime stopped')
}

function getStatus() {
  return {
    gate: gate.getStatus(),
    jobs: store.list({ includeDisabled: true }),
    snapshot: perceiver.sense(),
  }
}

module.exports = { start, stop, getStatus, gate, store, perceiver }
