/**
 * controller.js — 控制器
 *
 * The controller is the "brain" of the cybernetics loop:
 *   Perceiver → [Controller] → Executor
 *
 * It reads:
 *   1. Kernel state (node values set by perceiver ports)
 *   2. MQ messages from perceiver-resource channel
 *   3. Task state (blocked tasks need attention)
 *
 * It dispatches actions:
 *   - Routes tasks to appropriate execution tier (using resource-scheduler)
 *   - Publishes action decisions to MQ channel 'controller-actions'
 *   - Drives kernel tick when action is needed
 *   - Writes action log to MQ for observability
 *
 * The controller is event-driven: triggered by:
 *   a. Periodic tick (every TICK_INTERVAL_MS)
 *   b. Explicit POST /api/controller/tick
 *   c. After kernel tick (post-tick hook)
 */

const mq = require('./mq')
const { scoreTask, analyzeRunHistory } = require('./resource-scheduler')
const { pagesDb } = require('../db')

const CONTROLLER_ID = 'controller'
const TICK_INTERVAL_MS = 60_000  // 60 seconds

// ── Thresholds ────────────────────────────────────────────────────────────────
const ALERT_THRESHOLDS = {
  tier_pressure: 0.5,    // > 50% T2/human runs → alert
  failure_rate: 0.2,     // > 20% failure → alert
  active_runs_max: 10,   // > 10 active → alert
}

let _timer = null
let _running = false
let _lastControllerState = null

// ── DB helpers ────────────────────────────────────────────────────────────────
function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    pagesDb.all(sql, params, (err, rows) => {
      if (err) reject(err)
      else resolve(rows || [])
    })
  })
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    pagesDb.get(sql, params, (err, row) => {
      if (err) reject(err)
      else resolve(row)
    })
  })
}

// ── Read perceiver output from MQ ─────────────────────────────────────────────
async function readPerceiverSnapshot() {
  try {
    const msgs = await mq.query({
      channel: 'perceiver-resource',
      event_type: 'resource_snapshot',
      status: 'pending',
      limit: 1,
    })
    if (msgs.length === 0) return null
    const msg = msgs[0]
    const payload = typeof msg.payload === 'string' ? JSON.parse(msg.payload) : msg.payload
    return payload
  } catch {
    return null
  }
}

// ── Read blocked tasks ─────────────────────────────────────────────────────────
async function getBlockedTasks() {
  return dbAll(
    `SELECT id, title, priority, task_outcome FROM pages
     WHERE page_type = 'task' AND column_id = 'blocked'
     ORDER BY updated_at ASC LIMIT 20`
  )
}

// ── Read pending tasks that need execution ────────────────────────────────────
async function getPendingTasks() {
  return dbAll(
    `SELECT id, title, priority, task_outcome FROM pages
     WHERE page_type = 'task' AND column_id = 'in-progress'
       AND id NOT IN (SELECT DISTINCT task_id FROM execution_runs WHERE status IN ('running','escalated'))
     ORDER BY priority DESC, created_at ASC LIMIT 10`
  )
}

// ── Evaluate and dispatch actions ─────────────────────────────────────────────
async function evaluate(kernelRuntime) {
  const actions = []
  const alerts = []

  // ── 1. Read perceiver snapshot ──────────────────────────────────────────────
  const snapshot = await readPerceiverSnapshot()
  if (snapshot) {
    // Check tier pressure
    if (snapshot.tier_pressure > ALERT_THRESHOLDS.tier_pressure) {
      alerts.push({
        type: 'high_tier_pressure',
        value: snapshot.tier_pressure,
        threshold: ALERT_THRESHOLDS.tier_pressure,
        message: `Tier pressure ${snapshot.tier_pressure} > ${ALERT_THRESHOLDS.tier_pressure} — too many T2/human runs`,
      })
    }

    // Check failure rate
    if (snapshot.failure_rate > ALERT_THRESHOLDS.failure_rate) {
      alerts.push({
        type: 'high_failure_rate',
        value: snapshot.failure_rate,
        threshold: ALERT_THRESHOLDS.failure_rate,
        message: `Failure rate ${snapshot.failure_rate} > ${ALERT_THRESHOLDS.failure_rate}`,
      })
    }

    // Check active runs
    if (snapshot.active_runs > ALERT_THRESHOLDS.active_runs_max) {
      alerts.push({
        type: 'too_many_active_runs',
        value: snapshot.active_runs,
        threshold: ALERT_THRESHOLDS.active_runs_max,
        message: `Active runs ${snapshot.active_runs} > ${ALERT_THRESHOLDS.active_runs_max}`,
      })
    }
  }

  // ── 2. Check blocked tasks ────────────────────────────────────────────────
  const blocked = await getBlockedTasks()
  if (blocked.length > 0) {
    actions.push({
      type: 'unblock_tasks',
      task_ids: blocked.map(t => t.id),
      count: blocked.length,
      message: `${blocked.length} tasks are blocked — need attention`,
    })
  }

  // ── 3. Score pending tasks and route to tiers ────────────────────────────
  const pending = await getPendingTasks()
  if (pending.length > 0) {
    const scheduled = pending.map(t => ({
      ...t,
      ...scoreTask(t),
    }))
    const distribution = {}
    for (const s of scheduled) {
      distribution[s.tier] = (distribution[s.tier] || 0) + 1
    }
    actions.push({
      type: 'route_tasks',
      count: pending.length,
      distribution,
      tasks: scheduled.map(s => ({ id: s.id, title: s.title, tier: s.tier, score: s.score })),
      message: `${pending.length} pending tasks routed: ${JSON.stringify(distribution)}`,
    })
  }

  // ── 4. Drive kernel tick if we have actions ──────────────────────────────
  if ((actions.length > 0 || alerts.length > 0) && kernelRuntime) {
    try {
      await kernelRuntime.executeTick()
    } catch (err) {
      console.error('[controller] kernel tick error:', err.message)
    }
  }

  const controllerState = {
    evaluated_at: new Date().toISOString(),
    perceiver_snapshot: snapshot,
    actions,
    alerts,
    action_count: actions.length,
    alert_count: alerts.length,
  }

  _lastControllerState = controllerState

  // ── 5. Publish controller output to MQ ─────────────────────────────────
  if (actions.length > 0 || alerts.length > 0) {
    await mq.publish({
      channel: 'controller-actions',
      event_type: actions.length > 0 ? 'actions_dispatched' : 'alerts_only',
      tier: 'T0',
      source_id: CONTROLLER_ID,
      payload: controllerState,
    }).catch(e => console.error('[controller] MQ publish error:', e.message))
  }

  return controllerState
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Run a single controller evaluation cycle.
 */
async function tick(kernelRuntime) {
  try {
    return await evaluate(kernelRuntime)
  } catch (err) {
    console.error('[controller] tick error:', err.message)
    return { error: err.message, evaluated_at: new Date().toISOString() }
  }
}

/**
 * Start periodic controller ticks.
 */
function start(kernelRuntime) {
  if (_running) return
  _running = true
  console.log(`[controller] started (interval=${TICK_INTERVAL_MS}ms)`)

  // Initial tick
  tick(kernelRuntime).then(s => {
    if (s) console.log(`[controller] initial tick: actions=${s.action_count} alerts=${s.alert_count}`)
  })

  _timer = setInterval(() => {
    tick(kernelRuntime)
  }, TICK_INTERVAL_MS)

  if (_timer.unref) _timer.unref()
}

/**
 * Stop periodic ticks.
 */
function stop() {
  if (_timer) {
    clearInterval(_timer)
    _timer = null
  }
  _running = false
  console.log('[controller] stopped')
}

/**
 * Get last controller state.
 */
function getLastState() {
  return _lastControllerState
}

/**
 * Register controller kernel contracts.
 */
function registerContracts(kernelRuntime) {
  const kr = kernelRuntime

  // Contract: detect high tier pressure from perceiver ports and emit alert
  try {
    kr.registerContract({
      id: 'contract-controller-tier-pressure',
      type: 'dynamic',
      priority: 9,
      participants: [],
      conditionCode: `
        const pressure = env && env.ports ? env.ports.get('port-resource-tier-pressure') : null;
        return pressure != null && pressure > 0.5;
      `,
      emitCode: `
        const pressure = env && env.ports ? env.ports.get('port-resource-tier-pressure') : 0;
        return [{type:'alert', message:'High tier pressure: ' + pressure}];
      `,
    }, 'system')
  } catch {
    // Already registered
  }

  // Contract: detect high active runs from perceiver ports
  try {
    kr.registerContract({
      id: 'contract-controller-active-runs',
      type: 'dynamic',
      priority: 9,
      participants: [],
      conditionCode: `
        const active = env && env.ports ? env.ports.get('port-resource-runs-active') : null;
        return active != null && active > 10;
      `,
      emitCode: `
        const active = env && env.ports ? env.ports.get('port-resource-runs-active') : 0;
        return [{type:'alert', message:'High active runs: ' + active}];
      `,
    }, 'system')
  } catch {
    // Already registered
  }

  console.log('[controller] contracts registered')
}

module.exports = { tick, start, stop, getLastState, registerContracts, CONTROLLER_ID, ALERT_THRESHOLDS }
