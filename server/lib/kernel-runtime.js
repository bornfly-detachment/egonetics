/**
 * kernel-runtime.js — Server-side Kernel Singleton
 *
 * Loads dist/kernel.cjs (tsup-compiled PRVSE Kernel),
 * maintains a single Runtime instance, persists state to pages.db.
 */

const path = require('path')
const { pagesDb } = require('../db')

// ── Load compiled kernel ──
const kernel = require(path.join(__dirname, '..', '..', 'dist', 'index.cjs'))

// ── Singleton ──
let runtime = null
let effectHistory = []       // ring buffer, max 200
const MAX_EFFECTS = 200

// ── DB helpers ──
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    pagesDb.run(sql, params, function (err) {
      if (err) reject(err)
      else resolve(this)
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

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    pagesDb.all(sql, params, (err, rows) => {
      if (err) reject(err)
      else resolve(rows)
    })
  })
}

// ── Init schema ──
async function ensureSchema() {
  await dbRun(`CREATE TABLE IF NOT EXISTS kernel_snapshots (
    tick        INTEGER PRIMARY KEY,
    state_json  TEXT NOT NULL,
    effects_json TEXT NOT NULL DEFAULT '[]',
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  )`)

  await dbRun(`CREATE TABLE IF NOT EXISTS execution_runs (
    id          TEXT PRIMARY KEY,
    task_id     TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'running',
    current_tier TEXT NOT NULL DEFAULT 'T0',
    steps       TEXT NOT NULL DEFAULT '[]',
    api_calls   INTEGER NOT NULL DEFAULT 0,
    escalations TEXT NOT NULL DEFAULT '[]',
    result      TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  )`)

  await dbRun(`CREATE TABLE IF NOT EXISTS decisions (
    id             TEXT PRIMARY KEY,
    run_id         TEXT NOT NULL,
    type           TEXT NOT NULL,
    status         TEXT NOT NULL DEFAULT 'pending',
    context        TEXT NOT NULL,
    options        TEXT,
    human_response TEXT,
    decided_at     TEXT,
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
  )`)

  await dbRun(`CREATE TABLE IF NOT EXISTS kernel_task_effects (
    id          TEXT PRIMARY KEY,
    task_id     TEXT NOT NULL,
    tick        INTEGER NOT NULL,
    action      TEXT NOT NULL,
    effect_json TEXT NOT NULL DEFAULT '{}',
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  )`)

  await dbRun(`CREATE TABLE IF NOT EXISTS command_log (
    id           TEXT PRIMARY KEY,
    command_json TEXT NOT NULL,
    result_json  TEXT NOT NULL DEFAULT '{}',
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  )`)
}

// ── Serialize/deserialize state ──
// State contains Maps which JSON.stringify doesn't handle
function serializeState(state) {
  return JSON.stringify({
    tick: state.tick,
    nodes: Array.from(state.nodes.entries()).map(([id, ns]) => ({
      nodeId: id,
      patternVersion: ns.patternVersion,
      values: Array.from(ns.values.entries()),
    })),
    contracts: Array.from(state.contracts.keys()),
  })
}

function serializeEffects(effects) {
  return JSON.stringify(effects.map(e => {
    if (e.type === 'render') {
      return {
        type: 'render',
        nodeId: e.nodeId,
        changes: Array.from(e.changes.entries()).map(([k, v]) => ({ field: k, prev: v.prev, next: v.next })),
      }
    }
    return e
  }))
}

// ── Persist snapshot ──
async function persistSnapshot(tickResult, effects) {
  const stateJson = serializeState(tickResult.state)
  const effectsJson = serializeEffects(effects)
  await dbRun(
    `INSERT OR REPLACE INTO kernel_snapshots (tick, state_json, effects_json) VALUES (?, ?, ?)`,
    [tickResult.state.tick, stateJson, effectsJson]
  )
}

// ── Tick lock ──
let tickLock = false

// ── Public API ──

function getRuntime() {
  if (!runtime) {
    runtime = kernel.createRuntime()
  }
  return runtime
}

function getState() {
  const rt = getRuntime()
  const state = rt.state
  const nodes = {}
  for (const [id, ns] of state.nodes) {
    const values = {}
    for (const [k, v] of ns.values) values[k] = v
    nodes[id] = { nodeId: id, patternVersion: ns.patternVersion, values }
  }
  const contracts = []
  for (const [id, c] of state.contracts) {
    contracts.push({
      id,
      type: c.type,
      priority: c.priority,
      participants: [...c.participants],
    })
  }
  return { tick: state.tick, nodes, contracts }
}

function addNode(id, values) {
  const rt = getRuntime()
  rt.addNode(id, values || {})
  return { ok: true, nodeId: id }
}

function removeNode(id) {
  const rt = getRuntime()
  rt.removeNode(id)
  return { ok: true }
}

function setNodeValue(nodeId, field, value) {
  const rt = getRuntime()
  rt.setNodeValue(nodeId, field, value)
  return { ok: true }
}

function registerContract(contractDef, source) {
  const rt = getRuntime()
  // Build Contract object from definition
  // contractDef: { id, type, priority, participants, conditionCode, emitCode }
  const contract = {
    id: kernel.contractId(contractDef.id || `contract-${Date.now()}`),
    type: contractDef.type || 'dynamic',
    priority: contractDef.priority || 1,
    participants: (contractDef.participants || []).map(p => kernel.nodeId(p)),
    condition: buildConditionFn(contractDef.conditionCode || 'return true'),
    emit: buildEmitFn(contractDef.emitCode || 'return []'),
  }
  const result = rt.registerContract(contract, source || 'human')
  return {
    accepted: result.accepted,
    contractId: String(contract.id),
    violations: result.validation.violations,
  }
}

function unregisterContract(id) {
  const rt = getRuntime()
  rt.unregisterContract(kernel.contractId(id))
  return { ok: true }
}

function writePort(portId, value) {
  const rt = getRuntime()
  rt.writePort(kernel.portId(portId), value)
  return { ok: true }
}

/**
 * mutate(command) — Immediate state change, no tick required.
 *
 * command → kernel state change (synchronous)
 * tick   → reconciliation / consistency / constitution audit (async, periodic)
 *
 * Commands:
 *   { type: 'node.set',    nodeId, field, value }
 *   { type: 'node.add',    nodeId, values }
 *   { type: 'node.remove', nodeId }
 *   { type: 'port.write',  portId, value }
 *   { type: 'contract.register',   ...contractDef }
 *   { type: 'contract.unregister', contractId }
 *
 * Returns: { ok, command, state_after } — full audit trail.
 * Every mutate is logged to command_log for replay.
 */
async function mutate(command) {
  const ts = Date.now()
  let result = null

  switch (command.type) {
    case 'node.set':
      setNodeValue(command.nodeId, command.field, command.value)
      result = { ok: true }
      break

    case 'node.add':
      addNode(command.nodeId, command.values || {})
      result = { ok: true, nodeId: command.nodeId }
      break

    case 'node.remove':
      removeNode(command.nodeId)
      result = { ok: true }
      break

    case 'port.write':
      writePort(command.portId, command.value)
      result = { ok: true }
      break

    case 'contract.register':
      result = registerContract(command, command.source || 'human')
      break

    case 'contract.unregister':
      unregisterContract(command.contractId)
      result = { ok: true }
      break

    default:
      return { ok: false, error: `Unknown command type: ${command.type}` }
  }

  // Log command for replay / audit trail
  try {
    await dbRun(
      `INSERT INTO command_log (id, command_json, result_json, created_at)
       VALUES (?, ?, ?, datetime('now'))`,
      [
        `cmd-${ts}-${Math.random().toString(36).slice(2, 6)}`,
        JSON.stringify(command),
        JSON.stringify(result),
      ]
    )
  } catch (err) {
    // Non-fatal: log but don't block the mutation
    console.error('[kernel] command_log write error:', err.message)
  }

  return {
    ok: result.ok !== false,
    command,
    result,
    state_tick: getRuntime().state.tick,
    ts,
  }
}

async function executeTick() {
  if (tickLock) throw new Error('Tick already in progress')
  tickLock = true
  try {
    const rt = getRuntime()
    const result = rt.tick()

    // Push to effect history (ring buffer)
    for (const e of result.effects) {
      effectHistory.push({ ...e, _tick: result.tickResult.state.tick, _at: Date.now() })
      if (effectHistory.length > MAX_EFFECTS) effectHistory.shift()
    }

    // Process TriggerEffects → drive task state changes
    await processTaskEffects(result.effects, result.tickResult.state.tick)

    // Post-tick MQ processing (感知器→控制器 pipeline)
    try {
      const mqContracts = require('./mq-contracts')
      await mqContracts.processPostTick()
    } catch (err) {
      console.error('[mq-contracts] post-tick processing error:', err.message)
    }

    // Persist
    await persistSnapshot(result.tickResult, result.effects)

    // Publish to MQ if tick diverged or had conflicts
    const tick = result.tickResult.state.tick
    const conflicts = result.tickResult.conflicts.length
    const converged = result.tickResult.converged

    if (!converged || conflicts > 0) {
      try {
        const mq = require('./mq')
        if (!converged) {
          mq.publish({
            channel: 'kernel',
            event_type: 'tick_diverge',
            tier: 'T0',
            source_id: `tick-${tick}`,
            payload: { tick, rounds: result.tickResult.rounds, conflicts },
          })
        }
        if (conflicts > 0) {
          mq.publish({
            channel: 'kernel',
            event_type: 'conflict',
            tier: 'T0',
            source_id: `tick-${tick}`,
            payload: { tick, conflicts, selectionActions: result.selectionActions },
          })
        }
      } catch (err) {
        console.error('[mq] kernel tick publish error:', err.message)
      }
    }

    return {
      tick,
      converged,
      rounds: result.tickResult.rounds,
      patchesApplied: result.tickResult.patchesApplied,
      conflicts,
      effects: result.effects.length,
      selectionActions: result.selectionActions,
      fitnessRates: result.fitnessRates,
    }
  } finally {
    tickLock = false
  }
}

/** Process effects that target tasks — update task status, log kernel-driven changes */
async function processTaskEffects(effects, tick) {
  for (const effect of effects) {
    // TriggerEffects with portId starting with "task:" are task state drivers
    // e.g. portId="task:complete:TASK_ID" or portId="task:fail:TASK_ID"
    if (effect.type === 'trigger' && typeof effect.portId === 'string' && effect.portId.startsWith('task:')) {
      const parts = effect.portId.split(':')
      const action = parts[1]  // complete, fail, escalate, etc.
      const taskId = parts.slice(2).join(':')
      if (!taskId) continue

      try {
        if (action === 'complete') {
          await dbRun(
            `UPDATE pages SET column_id = 'done', updated_at = datetime('now') WHERE id = ? AND page_type = 'task'`,
            [taskId]
          )
        } else if (action === 'fail') {
          await dbRun(
            `UPDATE pages SET column_id = 'blocked', updated_at = datetime('now') WHERE id = ? AND page_type = 'task'`,
            [taskId]
          )
        }
        // Log the kernel-driven change
        await dbRun(
          `INSERT OR IGNORE INTO kernel_task_effects (id, task_id, tick, action, effect_json, created_at)
           VALUES (?, ?, ?, ?, ?, datetime('now'))`,
          [
            `kte-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
            taskId, tick, action, JSON.stringify(effect),
          ]
        )
      } catch (err) {
        // Non-fatal: log and continue
        console.error(`[kernel] task effect error: ${err.message}`)
      }
    }
  }
}

async function executeTicks(count) {
  const results = []
  for (let i = 0; i < count; i++) {
    results.push(await executeTick())
  }
  return results
}

function getFitnessRates() {
  const rt = getRuntime()
  return rt.getFitnessRates()
}

function getEffectHistory(limit = 50) {
  return effectHistory.slice(-limit)
}

function checkConstitution(contractDef) {
  const rt = getRuntime()
  const contract = {
    id: kernel.contractId(contractDef.id || 'check-temp'),
    type: contractDef.type || 'dynamic',
    priority: contractDef.priority || 1,
    participants: (contractDef.participants || []).map(p => kernel.nodeId(p)),
    condition: buildConditionFn(contractDef.conditionCode || 'return true'),
    emit: buildEmitFn(contractDef.emitCode || 'return []'),
  }
  return rt.getConstitutionCheck(contract)
}

function resetRuntime() {
  runtime = kernel.createRuntime()
  effectHistory = []
  return { ok: true }
}

// ── Helper: build safe condition/emit functions from code strings ──
function buildConditionFn(code) {
  try {
    // code receives (state, env) and should return boolean
    return new Function('state', 'env', code)
  } catch {
    return () => true
  }
}

function buildEmitFn(code) {
  try {
    // code receives (state, env) and should return Patch[]
    // Inject kernel helpers into scope
    return new Function('state', 'env',
      `const nodeId = ${JSON.stringify(null)}; // use string IDs in patches
       ${code}`
    )
  } catch {
    return () => []
  }
}

// ── Init ──
async function init() {
  await ensureSchema()
  getRuntime() // ensure created
  console.log('✅ Kernel Runtime initialized (server singleton)')
}

module.exports = {
  init,
  getRuntime,
  getState,
  addNode,
  removeNode,
  setNodeValue,
  registerContract,
  unregisterContract,
  writePort,
  mutate,
  executeTick,
  executeTicks,
  getFitnessRates,
  getEffectHistory,
  checkConstitution,
  resetRuntime,
  kernel, // expose raw kernel module for advanced usage
}
