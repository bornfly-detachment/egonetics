/**
 * harness-manager/index.js
 *
 * 运行环境管理层 — 所有 AI CLI session 的生命周期管理
 *
 * 职责：创建/管理长期运行的 AI 工作环境
 * 依赖：resource-manager（查询 session 配额）
 * 不依赖：ai-service（不直接调 LLM）
 *
 * 包含：
 *   runner    — T0/T1/T2 free-code tmux session（从 harness-runner.js 迁入）
 *   t2Spawn  — T2 code-agent claude spawn（从 t2-client.js 迁入）
 *
 * 接口：
 *   harness.canCreate()                → boolean
 *   harness.listSessions()             → [{ pid, rssMb, command }]
 *   harness.status()                   → { current, max, canCreate, sessions }
 *   harness.registerSession(id, meta)  → void
 *   harness.unregisterSession(id)      → void
 *   harness.runner.*                   → tmux spawn 工具（buildTmuxSpawn, listTiers, ...）
 *   harness.t2Spawn.*                  → claude spawn 工具（runQuery, checkT2Health, ...）
 */

'use strict'

const { allocator } = require('../resource-manager')
const logger = require('../ai-service/logger')

// Sub-modules
const runner = require('./runner')
const t2Spawn = require('./t2-spawn')

// ── Session 注册表（内存，进程重启后从 ps 重建）─────────────────

const _sessions = new Map()

function canCreate() {
  return allocator.canCreateSession()
}

function listSessions() {
  const limits = allocator.getLimits()
  const procs = limits.categories?.sessions || []
  return procs.map(p => ({
    pid: p.pid,
    rssMb: p.rssMb,
    command: p.command,
    tracked: _sessions.has(String(p.pid)),
  }))
}

function status() {
  const limits = allocator.getLimits()
  return {
    current: limits.currentSessions,
    max: limits.maxSessions,
    canCreate: limits.canCreateSession,
    sessions: listSessions(),
  }
}

function registerSession(sessionId, meta) {
  _sessions.set(sessionId, { ...meta, createdAt: Date.now(), lastActive: Date.now() })
  logger.logSession({ action: 'create', sessionId, ...meta })
}

function unregisterSession(sessionId) {
  const meta = _sessions.get(sessionId)
  _sessions.delete(sessionId)
  if (meta) logger.logSession({ action: 'kill', sessionId, ...meta })
}

function touchSession(sessionId) {
  const s = _sessions.get(sessionId)
  if (s) s.lastActive = Date.now()
}

module.exports = {
  // Session lifecycle
  canCreate,
  listSessions,
  status,
  registerSession,
  unregisterSession,
  touchSession,

  // Sub-modules (preserve full API for consumers)
  runner,     // buildTmuxSpawn, listTiers, resolveTier, ...
  t2Spawn,    // runQuery, checkT2Health, getSessionId, ...
}
