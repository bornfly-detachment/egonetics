/**
 * resource-perceiver.js — 感知器：资源消耗监控
 *
 * Monitors execution_runs (api_calls, tier, status) and kernel state.
 * Writes resource metrics to kernel ports via writePort().
 * Publishes resource snapshots to MQ channel 'perceiver-resource'.
 *
 * Port IDs written:
 *   port-resource-api-calls     — total api_calls across all runs
 *   port-resource-runs-active   — count of running/escalated runs
 *   port-resource-tier-pressure — ratio of T2/human runs vs total
 *   port-resource-failure-rate  — ratio of failed runs
 *   port-resource-kernel-tick   — current kernel tick
 */

const { pagesDb } = require('../db')
const mq = require('./mq')
const kr = require('./kernel-runtime')

const PERCEIVER_ID = 'resource-perceiver'
const INTERVAL_MS = 30_000 // 30 seconds

let _timer = null
let _running = false
let _lastMetrics = null  // cached last snapshot for getPortValues()

// ── DB helpers ────────────────────────────────────────────────────────────────
function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    pagesDb.all(sql, params, (err, rows) => {
      if (err) reject(err)
      else resolve(rows || [])
    })
  })
}

// ── Collect resource metrics from execution_runs ──────────────────────────────
async function collectMetrics() {
  const rows = await dbAll(
    `SELECT status, current_tier, api_calls, created_at
     FROM execution_runs
     ORDER BY created_at DESC
     LIMIT 100`
  )

  if (rows.length === 0) {
    return {
      total_runs: 0,
      active_runs: 0,
      completed_runs: 0,
      failed_runs: 0,
      total_api_calls: 0,
      tier_distribution: {},
      tier_pressure: 0,
      failure_rate: 0,
      collected_at: new Date().toISOString(),
    }
  }

  const tierCount = {}
  let activeRuns = 0
  let completedRuns = 0
  let failedRuns = 0
  let totalApiCalls = 0

  for (const row of rows) {
    const tier = row.current_tier || 'T0'
    const status = row.status || 'unknown'

    tierCount[tier] = (tierCount[tier] || 0) + 1
    totalApiCalls += row.api_calls || 0

    if (status === 'running' || status === 'escalated') activeRuns++
    else if (status === 'completed') completedRuns++
    else if (status === 'failed') failedRuns++
  }

  const highTierRuns = (tierCount['T2'] || 0) + (tierCount['human'] || 0)
  const tierPressure = rows.length > 0 ? highTierRuns / rows.length : 0
  const failureRate = rows.length > 0 ? failedRuns / rows.length : 0

  return {
    total_runs: rows.length,
    active_runs: activeRuns,
    completed_runs: completedRuns,
    failed_runs: failedRuns,
    total_api_calls: totalApiCalls,
    tier_distribution: tierCount,
    tier_pressure: Math.round(tierPressure * 1000) / 1000,
    failure_rate: Math.round(failureRate * 1000) / 1000,
    collected_at: new Date().toISOString(),
  }
}

// ── Write metrics to kernel ports ──────────────────────────────────────────────
function writeMetricsToKernel(metrics) {
  try {
    kr.writePort('port-resource-api-calls', metrics.total_api_calls)
    kr.writePort('port-resource-runs-active', metrics.active_runs)
    kr.writePort('port-resource-tier-pressure', metrics.tier_pressure)
    kr.writePort('port-resource-failure-rate', metrics.failure_rate)
    kr.writePort('port-resource-kernel-tick', kr.getState().tick)
    return true
  } catch (err) {
    console.error('[resource-perceiver] writePort error:', err.message)
    return false
  }
}

// ── Publish snapshot to MQ ─────────────────────────────────────────────────────
async function publishToMQ(metrics) {
  try {
    await mq.publish({
      channel: 'perceiver-resource',
      event_type: 'resource_snapshot',
      tier: 'T0',
      source_id: PERCEIVER_ID,
      payload: metrics,
    })
  } catch (err) {
    console.error('[resource-perceiver] MQ publish error:', err.message)
  }
}

// ── Single perceive cycle ──────────────────────────────────────────────────────
async function perceive() {
  try {
    const metrics = await collectMetrics()
    _lastMetrics = metrics  // cache for getPortValues()
    writeMetricsToKernel(metrics)
    await publishToMQ(metrics)
    return metrics
  } catch (err) {
    console.error('[resource-perceiver] perceive error:', err.message)
    return null
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Start periodic resource perception.
 * Runs immediately on start, then every INTERVAL_MS ms.
 */
function start() {
  if (_running) return
  _running = true
  console.log(`[resource-perceiver] started (interval=${INTERVAL_MS}ms)`)

  // Run immediately
  perceive().then(m => {
    if (m) console.log(`[resource-perceiver] initial snapshot: runs=${m.total_runs} api_calls=${m.total_api_calls}`)
  })

  _timer = setInterval(() => {
    perceive()
  }, INTERVAL_MS)

  // Unref so it doesn't prevent Node.js process from exiting
  if (_timer.unref) _timer.unref()
}

/**
 * Stop periodic perception.
 */
function stop() {
  if (_timer) {
    clearInterval(_timer)
    _timer = null
  }
  _running = false
  console.log('[resource-perceiver] stopped')
}

/**
 * Run a single perceive cycle on demand (returns metrics).
 */
async function snapshot() {
  return perceive()
}

/**
 * Get current port values written by the perceiver.
 * Returns last cached metrics since kernel ports are consumed on tick().
 */
function getPortValues() {
  try {
    const state = kr.getState()
    const m = _lastMetrics
    return {
      tick: state.tick,
      last_perceived_at: m?.collected_at ?? null,
      ports: {
        'port-resource-api-calls': m?.total_api_calls ?? null,
        'port-resource-runs-active': m?.active_runs ?? null,
        'port-resource-tier-pressure': m?.tier_pressure ?? null,
        'port-resource-failure-rate': m?.failure_rate ?? null,
        'port-resource-kernel-tick': state.tick,
      }
    }
  } catch (err) {
    return { error: err.message }
  }
}

module.exports = { start, stop, snapshot, getPortValues, perceive, PERCEIVER_ID }
