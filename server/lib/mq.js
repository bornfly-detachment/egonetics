/**
 * mq.js — 消息队列（纯传输层）
 *
 * 职责：收消息、存消息、暴露给 Kernel Port。
 * 所有智能（累积判断、触发决策、结果评估）归 Kernel 控制论组件。
 *
 * publish() = 写 DB + writePort('mq:<channel>:<event_type>', payload)
 *   → Kernel Contract 感知 port 变化 → 自行决定如何处理
 */

const { pagesDb } = require('../db')

// ── DB helpers ──
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    pagesDb.run(sql, params, function (err) { err ? reject(err) : resolve(this) })
  })
}
function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    pagesDb.get(sql, params, (err, row) => { err ? reject(err) : resolve(row) })
  })
}
function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    pagesDb.all(sql, params, (err, rows) => { err ? reject(err) : resolve(rows) })
  })
}

function genId() {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

// ── Schema ──
async function ensureSchema() {
  await dbRun(`CREATE TABLE IF NOT EXISTS mq_messages (
    id          TEXT PRIMARY KEY,
    channel     TEXT NOT NULL,
    event_type  TEXT NOT NULL,
    tier        TEXT NOT NULL DEFAULT 'T0',
    payload     TEXT NOT NULL DEFAULT '{}',
    source_id   TEXT,
    status      TEXT NOT NULL DEFAULT 'pending',
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  )`)
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_mq_channel_status ON mq_messages(channel, status)`)
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_mq_source ON mq_messages(source_id, event_type)`)
}

// ── Kernel bridge ──
// Set by init() — reference to kernel-runtime.writePort
let _writePort = null

function setKernelBridge(writePortFn) {
  _writePort = writePortFn
}

// ── Core API ──

/**
 * Publish a message to the queue + notify Kernel via port write.
 *
 * @param {object} msg
 * @param {string} msg.channel    — builder | kernel | task | human | executor
 * @param {string} msg.event_type — build_fail | conflict | blocked | assign | ...
 * @param {string} [msg.tier]     — T0 | T1 | T2 | T3 (default T0)
 * @param {object} [msg.payload]  — arbitrary JSON context
 * @param {string} [msg.source_id] — related entity ID
 * @returns {Promise<{id: string}>}
 */
async function publish(msg) {
  const id = genId()
  const { channel, event_type, tier = 'T0', payload = {}, source_id = null } = msg

  await dbRun(
    `INSERT INTO mq_messages (id, channel, event_type, tier, payload, source_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, channel, event_type, tier, JSON.stringify(payload), source_id]
  )

  // Write to Kernel port so contracts can sense it
  if (_writePort) {
    try {
      _writePort(`mq:${channel}:${event_type}`, {
        msg_id: id,
        channel,
        event_type,
        tier,
        source_id,
        payload,
        at: new Date().toISOString(),
      })
    } catch (err) {
      // Kernel offline — non-fatal, message is still in DB
      console.error(`[mq] kernel port write failed: ${err.message}`)
    }
  }

  return { id, channel, event_type, tier, status: 'pending' }
}

/**
 * Query messages.
 */
async function query({ channel, event_type, source_id, status, limit = 50 } = {}) {
  const where = []
  const params = []
  if (channel)    { where.push('channel = ?');    params.push(channel) }
  if (event_type) { where.push('event_type = ?'); params.push(event_type) }
  if (source_id)  { where.push('source_id = ?');  params.push(source_id) }
  if (status)     { where.push('status = ?');      params.push(status) }

  const sql = where.length
    ? `SELECT * FROM mq_messages WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT ?`
    : `SELECT * FROM mq_messages ORDER BY created_at DESC LIMIT ?`
  params.push(Math.min(limit, 200))

  const rows = await dbAll(sql, params)
  return rows.map(r => ({ ...r, payload: JSON.parse(r.payload || '{}') }))
}

/**
 * Count pending messages by channel+event_type+source_id within a time window.
 * Used by Kernel contracts (感知器) to detect accumulation.
 */
async function countPending({ channel, event_type, source_id, window_sec = 3600 } = {}) {
  const where = ["status = 'pending'"]
  const params = []

  if (channel)    { where.push('channel = ?');    params.push(channel) }
  if (event_type) { where.push('event_type = ?'); params.push(event_type) }
  if (source_id)  { where.push('source_id = ?');  params.push(source_id) }
  if (window_sec) {
    where.push(`created_at >= datetime('now', ?)`)
    params.push(`-${window_sec} seconds`)
  }

  const row = await dbGet(
    `SELECT COUNT(*) as count FROM mq_messages WHERE ${where.join(' AND ')}`,
    params
  )
  return row?.count || 0
}

/**
 * Update message status.
 */
async function ack(id, status = 'dispatched', resolution = null) {
  const sets = ['status = ?']
  const params = [status]
  if (resolution) {
    sets.push('payload = json_patch(payload, ?)')
    params.push(JSON.stringify({ _resolution: resolution }))
  }
  params.push(id)
  await dbRun(`UPDATE mq_messages SET ${sets.join(', ')} WHERE id = ?`, params)
  return { ok: true }
}

/**
 * Batch ack — mark multiple messages as dispatched.
 */
async function batchAck(ids, status = 'dispatched') {
  if (!ids.length) return { ok: true, count: 0 }
  const placeholders = ids.map(() => '?').join(',')
  const result = await dbRun(
    `UPDATE mq_messages SET status = ? WHERE id IN (${placeholders})`,
    [status, ...ids]
  )
  return { ok: true, count: result.changes }
}

/**
 * Stats — pending count per channel+event_type.
 */
async function stats() {
  const rows = await dbAll(
    `SELECT channel, event_type, tier, COUNT(*) as count
     FROM mq_messages WHERE status = 'pending'
     GROUP BY channel, event_type, tier
     ORDER BY count DESC`
  )
  return rows
}

// ── Init ──
async function init(kernelRuntime) {
  await ensureSchema()
  if (kernelRuntime?.writePort) {
    setKernelBridge((portId, value) => {
      const kr = require('./kernel-runtime')
      kr.writePort(portId, value)
    })
  }
  console.log('✅ Message Queue initialized')
}

module.exports = {
  init,
  publish,
  query,
  countPending,
  ack,
  batchAck,
  stats,
  setKernelBridge,
}
