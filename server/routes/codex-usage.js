'use strict'

const express = require('express')
const fs = require('fs')
const os = require('os')
const path = require('path')
const jwt = require('jsonwebtoken')
const sqlite3 = require('sqlite3').verbose()

const router = express.Router()
const CONFIG_PATH = path.join(__dirname, '../config/codex-usage-sensors.json')
const HOME = os.homedir()
const STATE_DB = path.join(HOME, '.codex/state_5.sqlite')
const HISTORY_PATH = path.join(HOME, '.codex/history.jsonl')
const AUTH_PATH = path.join(HOME, '.codex/auth.json')
const DEFAULT_POLL_MS = 20_000

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return fallback
  }
}

function readConfig() {
  const config = readJson(CONFIG_PATH, {}) || {}
  return {
    pollMs: Number(config.pollMs) > 0 ? Number(config.pollMs) : DEFAULT_POLL_MS,
    limits: config.limits || {},
    sensorOrder: Array.isArray(config.sensorOrder) ? config.sensorOrder : ['current-session', 'daily-usage', 'subscription-window', 'weekly-usage'],
  }
}

function openReadonlyDb(filePath) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(filePath, sqlite3.OPEN_READONLY, (err) => {
      if (err) reject(err)
      else resolve(db)
    })
  })
}

function dbGet(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err)
      else resolve(row || null)
    })
  })
}

function dbAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err)
      else resolve(rows || [])
    })
  })
}

function closeDb(db) {
  return new Promise((resolve) => db.close(() => resolve()))
}

function parseHistorySince(secondsSinceEpoch) {
  if (!fs.existsSync(HISTORY_PATH)) return []
  const lines = fs.readFileSync(HISTORY_PATH, 'utf8').split('\n').filter(Boolean)
  const rows = []
  for (const line of lines) {
    try {
      const item = JSON.parse(line)
      if (item.ts >= secondsSinceEpoch) rows.push(item)
    } catch {}
  }
  return rows
}

function decodeAuthClaims() {
  const auth = readJson(AUTH_PATH, {}) || {}
  const token = auth?.tokens?.id_token
  const decoded = token ? jwt.decode(token) : null
  const providerClaims = decoded?.['https://api.openai.com/auth'] || {}
  return {
    authMode: auth?.auth_mode || null,
    email: decoded?.email || null,
    authProvider: decoded?.auth_provider || null,
    chatgptPlanType: providerClaims.chatgpt_plan_type || null,
    subscriptionActiveStart: providerClaims.chatgpt_subscription_active_start || null,
    subscriptionActiveUntil: providerClaims.chatgpt_subscription_active_until || null,
    subscriptionLastChecked: providerClaims.chatgpt_subscription_last_checked || null,
    accountId: providerClaims.chatgpt_account_id || null,
  }
}

function toIsoFromSeconds(seconds) {
  if (!seconds) return null
  return new Date(seconds * 1000).toISOString()
}

function percentOrNull(used, limit) {
  if (!Number.isFinite(used) || !Number.isFinite(limit) || limit <= 0) return null
  return Math.max(0, Math.min(100, Math.round((used / limit) * 100)))
}

async function collectSnapshot() {
  const config = readConfig()
  const auth = decodeAuthClaims()
  const nowMs = Date.now()
  const nowSec = Math.floor(nowMs / 1000)
  const dayAgo = nowSec - 86400
  const weekAgo = nowSec - 86400 * 7
  const subscriptionStartSec = auth.subscriptionActiveStart ? Math.floor(new Date(auth.subscriptionActiveStart).getTime() / 1000) : null

  let db
  try {
    db = await openReadonlyDb(STATE_DB)
    const latestThread = await dbGet(db, `
      SELECT id, title, created_at, updated_at, tokens_used, model_provider, cli_version
      FROM threads
      ORDER BY updated_at DESC
      LIMIT 1
    `)

    const daily = await dbGet(db, `
      SELECT COUNT(*) AS threadCount, COALESCE(SUM(tokens_used), 0) AS tokensUsed
      FROM threads
      WHERE updated_at >= ?
    `, [dayAgo])

    const weekly = await dbGet(db, `
      SELECT COUNT(*) AS threadCount, COALESCE(SUM(tokens_used), 0) AS tokensUsed
      FROM threads
      WHERE updated_at >= ?
    `, [weekAgo])

    const subscription = subscriptionStartSec
      ? await dbGet(db, `
          SELECT COUNT(*) AS threadCount, COALESCE(SUM(tokens_used), 0) AS tokensUsed
          FROM threads
          WHERE updated_at >= ?
        `, [subscriptionStartSec])
      : { threadCount: null, tokensUsed: null }

    const recentThreads = await dbAll(db, `
      SELECT id, title, updated_at, tokens_used
      FROM threads
      ORDER BY updated_at DESC
      LIMIT 5
    `)

    const dayHistory = parseHistorySince(dayAgo)
    const weekHistory = parseHistorySince(weekAgo)
    const subscriptionHistory = subscriptionStartSec ? parseHistorySince(subscriptionStartSec) : []

    const sensors = {
      'current-session': {
        id: 'current-session',
        label: 'Current session',
        subtitle: latestThread ? `${latestThread.title || 'Untitled thread'} · ${formatCount(latestThread.tokens_used)} tokens` : 'No local Codex thread yet',
        usedLabel: latestThread ? `${formatCount(latestThread.tokens_used)} tokens` : '未发现',
        progressPct: percentOrNull(latestThread?.tokens_used ?? null, config.limits.currentSessionTokens),
        resetLabel: latestThread ? `active ${relativeAge(latestThread.updated_at, nowSec)}` : '未提供',
        note: Number.isFinite(config.limits.currentSessionTokens) ? `limit ${formatCount(config.limits.currentSessionTokens)} tokens` : 'CLI 未暴露 session quota；当前显示本地线程 token 消耗',
      },
      'daily-usage': {
        id: 'daily-usage',
        label: 'Daily usage',
        subtitle: `${formatCount(dayHistory.length)} prompts · ${formatCount(daily?.threadCount || 0)} active threads`,
        usedLabel: `${formatCount(daily?.tokensUsed || 0)} tokens`,
        progressPct: percentOrNull(daily?.tokensUsed ?? null, config.limits.dailyTokens),
        resetLabel: 'rolling 24h',
        note: Number.isFinite(config.limits.dailyTokens) ? `limit ${formatCount(config.limits.dailyTokens)} tokens` : '无官方 daily limit；按最近 24h 本地 Codex 线程统计',
      },
      'subscription-window': {
        id: 'subscription-window',
        label: 'Subscription window',
        subtitle: auth.subscriptionActiveUntil ? `plan ${auth.chatgptPlanType || 'unknown'} · resets ${formatDateShort(auth.subscriptionActiveUntil)}` : 'subscription window 未暴露',
        usedLabel: subscription?.tokensUsed != null ? `${formatCount(subscription.tokensUsed)} tokens` : '未暴露',
        progressPct: percentOrNull(subscription?.tokensUsed ?? null, config.limits.subscriptionTokens),
        resetLabel: auth.subscriptionActiveUntil ? `resets ${formatCountdown(auth.subscriptionActiveUntil, nowMs)}` : '未暴露',
        note: Number.isFinite(config.limits.subscriptionTokens) ? `limit ${formatCount(config.limits.subscriptionTokens)} tokens` : '订阅结束时间来自 auth claims；usage 取订阅周期内本地线程 token 总量',
      },
      'weekly-usage': {
        id: 'weekly-usage',
        label: 'Weekly activity',
        subtitle: `${formatCount(weekHistory.length)} prompts · ${formatCount(weekly?.threadCount || 0)} threads`,
        usedLabel: `${formatCount(weekly?.tokensUsed || 0)} tokens`,
        progressPct: percentOrNull(weekly?.tokensUsed ?? null, config.limits.weeklyTokens),
        resetLabel: 'rolling 7d',
        note: '本地 Codex 7 天窗口统计',
      },
    }

    return {
      provider: 'codex_cli',
      observedAt: new Date(nowMs).toISOString(),
      pollMs: config.pollMs,
      account: auth,
      source: {
        stateDb: STATE_DB,
        historyJsonl: HISTORY_PATH,
        authJson: AUTH_PATH,
      },
      overview: {
        latestThread: latestThread ? {
          id: latestThread.id,
          title: latestThread.title,
          createdAt: toIsoFromSeconds(latestThread.created_at),
          updatedAt: toIsoFromSeconds(latestThread.updated_at),
          tokensUsed: latestThread.tokens_used,
          modelProvider: latestThread.model_provider,
          cliVersion: latestThread.cli_version,
        } : null,
        daily: {
          promptCount: dayHistory.length,
          threadCount: daily?.threadCount || 0,
          tokensUsed: daily?.tokensUsed || 0,
        },
        weekly: {
          promptCount: weekHistory.length,
          threadCount: weekly?.threadCount || 0,
          tokensUsed: weekly?.tokensUsed || 0,
        },
        subscription: {
          promptCount: subscriptionHistory.length,
          threadCount: subscription?.threadCount ?? null,
          tokensUsed: subscription?.tokensUsed ?? null,
        },
        recentThreads: recentThreads.map((thread) => ({
          id: thread.id,
          title: thread.title,
          updatedAt: toIsoFromSeconds(thread.updated_at),
          tokensUsed: thread.tokens_used,
        })),
      },
      sensors: config.sensorOrder.map((id) => sensors[id]).filter(Boolean),
      limits: config.limits,
    }
  } finally {
    if (db) await closeDb(db)
  }
}

function formatCount(value) {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-US').format(value)
}

function formatDateShort(value) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return 'unknown'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(d)
}

function formatCountdown(value, nowMs) {
  const target = new Date(value).getTime()
  if (!Number.isFinite(target)) return 'unknown'
  const diff = target - nowMs
  if (diff <= 0) return 'expired'
  const totalMinutes = Math.floor(diff / 60000)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function relativeAge(updatedAtSec, nowSec) {
  if (!updatedAtSec) return 'unknown'
  const diff = Math.max(0, nowSec - updatedAtSec)
  const hours = Math.floor(diff / 3600)
  const minutes = Math.floor((diff % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m ago`
  return `${minutes}m ago`
}

router.get('/codex-usage/snapshot', async (_req, res) => {
  try {
    const snapshot = await collectSnapshot()
    res.json(snapshot)
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to collect codex usage snapshot' })
  }
})

module.exports = router
