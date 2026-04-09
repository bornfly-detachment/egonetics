/**
 * harness-manager/index.js
 *
 * 运行环境管理层 — tmux session + CLI 生命周期
 *
 * 职责：创建/管理长期运行的 AI 工作环境（free-code sessions）。
 * 依赖：resource-manager（查询 session 配额）
 * 不依赖：ai-service（不直接调 LLM）
 *
 * 接口：
 *   harness.canCreate()          → boolean
 *   harness.createSession(opts)  → { sessionId, tier, pid }
 *   harness.listSessions()      → [{ id, tier, pid, rss, uptime }]
 *   harness.killSession(id)     → void
 *   harness.status()            → { sessions, capacity }
 *
 * TODO Phase 2: migrate harness-runner.js + free-code-ws.js logic here
 */

'use strict'

const { allocator } = require('../resource-manager')
const logger = require('../ai-service/logger')

// ── Session 注册表（内存，进程重启后从 ps 重建）─────────────────

const _sessions = new Map()  // sessionId → { tier, pid, createdAt, lastActive }

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
  canCreate,
  listSessions,
  status,
  registerSession,
  unregisterSession,
  touchSession,
}
