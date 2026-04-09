/**
 * ai-resource-manager/logger.js
 *
 * AI 调用日志 — 所有 tier 的按次调用和 session 事件写入 JSONL
 *
 * 存储：server/data/ai-call-log.jsonl（追加写入，Git 不跟踪）
 * 格式：每行一个 JSON 对象
 */

'use strict'

const fs = require('fs')
const path = require('path')

const LOG_DIR = path.resolve(__dirname, '../../data')
const CALL_LOG = path.join(LOG_DIR, 'ai-call-log.jsonl')
const SESSION_LOG = path.join(LOG_DIR, 'ai-session-log.jsonl')

// 确保目录存在
try { fs.mkdirSync(LOG_DIR, { recursive: true }) } catch { /* exists */ }

// ── 写入 ─────────────────────────────────────────────────────────

function append(filePath, record) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...record }) + '\n'
  try {
    fs.appendFileSync(filePath, line, 'utf8')
  } catch (err) {
    console.error(`[ai-logger] write failed: ${err.message}`)
  }
}

// ── 公共接口 ─────────────────────────────────────────────────────

function logCall(record) {
  append(CALL_LOG, { type: 'call', ...record })
}

function logSession(record) {
  append(SESSION_LOG, { type: 'session', ...record })
}

/**
 * 读取最近 N 条调用日志。
 */
function recentCalls(n = 50) {
  try {
    const lines = fs.readFileSync(CALL_LOG, 'utf8').trim().split('\n')
    return lines.slice(-n).map(l => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
  } catch {
    return []
  }
}

/**
 * 汇总统计（今日 token / 成本 / 调用次数 by tier）。
 */
function todaySummary() {
  const today = new Date().toISOString().slice(0, 10)
  const calls = recentCalls(1000).filter(c => c.ts?.startsWith(today))

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

  // 平均延迟
  for (const s of Object.values(summary)) {
    s.avgLatencyMs = s.calls > 0 ? Math.round(s.totalLatencyMs / s.calls) : 0
  }

  return { date: today, tiers: summary }
}

module.exports = { logCall, logSession, recentCalls, todaySummary }
