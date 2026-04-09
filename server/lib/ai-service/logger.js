/**
 * ai-service/logger.js
 *
 * AI 调用日志 — 按日期分文件，永久保留
 *
 * 存储结构：
 *   prvse_world_workspace/L2/logs/
 *   ├── calls/
 *   │   ├── 2026-04-08.jsonl
 *   │   ├── 2026-04-09.jsonl
 *   │   └── ...
 *   └── sessions/
 *       ├── 2026-04-08.jsonl
 *       └── ...
 *
 * 设计：
 *   - 每天一个文件，文件名即日期，天然有序
 *   - 永不自动清理（持久化日志是资源管理的数据基础）
 *   - recentCalls() 只读当天文件（不扫全目录）
 *   - todaySummary() 从当天文件汇总
 */

'use strict'

const fs = require('fs')
const path = require('path')

const WORKSPACE = process.env.EGONETICS_WORKSPACE || '/Users/Shared/prvse_world_workspace'
const LOG_BASE = path.join(WORKSPACE, 'L2', 'logs')
const CALLS_DIR = path.join(LOG_BASE, 'calls')
const SESSIONS_DIR = path.join(LOG_BASE, 'sessions')

// 确保目录存在
try { fs.mkdirSync(CALLS_DIR, { recursive: true }) } catch { /* exists */ }
try { fs.mkdirSync(SESSIONS_DIR, { recursive: true }) } catch { /* exists */ }

// ── 日期文件路径 ─────────────────────────────────────────────────

function _today() {
  return new Date().toISOString().slice(0, 10)
}

function _callLogPath(date) {
  return path.join(CALLS_DIR, `${date || _today()}.jsonl`)
}

function _sessionLogPath(date) {
  return path.join(SESSIONS_DIR, `${date || _today()}.jsonl`)
}

// ── 写入 ─────────────────────────────────────────────────────────

function _append(filePath, record) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...record }) + '\n'
  try {
    fs.appendFileSync(filePath, line, 'utf8')
  } catch (err) {
    console.error(`[ai-logger] write failed: ${err.message}`)
  }
}

// ── 读取 ─────────────────────────────────────────────────────────

function _readLines(filePath) {
  try {
    if (!fs.existsSync(filePath)) return []
    return fs.readFileSync(filePath, 'utf8').trim().split('\n')
      .map(l => { try { return JSON.parse(l) } catch { return null } })
      .filter(Boolean)
  } catch {
    return []
  }
}

// ── 公共接口 ─────────────────────────────────────────────────────

function logCall(record) {
  _append(_callLogPath(), { type: 'call', ...record })
}

function logSession(record) {
  _append(_sessionLogPath(), { type: 'session', ...record })
}

/**
 * 读取最近 N 条调用日志（默认读当天）。
 * @param {number} n - 最多返回条数
 * @param {string} [date] - 指定日期 'YYYY-MM-DD'，默认今天
 */
function recentCalls(n = 50, date) {
  const lines = _readLines(_callLogPath(date))
  return lines.slice(-n)
}

/**
 * 读取指定日期范围的调用日志。
 * @param {string} from - 起始日期 'YYYY-MM-DD'
 * @param {string} to - 结束日期 'YYYY-MM-DD'
 */
function callsByRange(from, to) {
  const results = []
  try {
    const files = fs.readdirSync(CALLS_DIR).filter(f => f.endsWith('.jsonl')).sort()
    for (const f of files) {
      const date = f.replace('.jsonl', '')
      if (date >= from && date <= to) {
        results.push(..._readLines(path.join(CALLS_DIR, f)))
      }
    }
  } catch { /* empty */ }
  return results
}

/**
 * 汇总统计（指定日期，默认今天）。
 */
function todaySummary(date) {
  const d = date || _today()
  const calls = _readLines(_callLogPath(d))

  const summary = {}
  for (const c of calls) {
    const tier = c.tier || 'unknown'
    if (!summary[tier]) summary[tier] = { calls: 0, inputTokens: 0, outputTokens: 0, totalLatencyMs: 0, errors: 0 }
    summary[tier].calls++
    summary[tier].inputTokens += c.inputTokens || 0
    summary[tier].outputTokens += c.outputTokens || 0
    summary[tier].totalLatencyMs += c.latencyMs || 0
    if (!c.success) summary[tier].errors++
  }

  for (const s of Object.values(summary)) {
    s.avgLatencyMs = s.calls > 0 ? Math.round(s.totalLatencyMs / s.calls) : 0
  }

  return { date: d, tiers: summary }
}

/**
 * 列出所有日志日期（用于 UI 展示历史）。
 */
function listDates(type = 'calls') {
  const dir = type === 'sessions' ? SESSIONS_DIR : CALLS_DIR
  try {
    return fs.readdirSync(dir)
      .filter(f => f.endsWith('.jsonl'))
      .map(f => f.replace('.jsonl', ''))
      .sort()
  } catch {
    return []
  }
}

/**
 * 日志存储路径（供 registry 使用）。
 */
function getPaths() {
  return {
    base: LOG_BASE,
    calls: CALLS_DIR,
    sessions: SESSIONS_DIR,
    todayCall: _callLogPath(),
    todaySession: _sessionLogPath(),
  }
}

module.exports = { logCall, logSession, recentCalls, callsByRange, todaySummary, listDates, getPaths }
