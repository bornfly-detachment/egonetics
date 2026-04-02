/**
 * server/lib/heartbeat.js
 * 心跳机制 — 定时自触发 Agent 轮次，无需用户消息
 *
 * 行为：
 *   每 N 分钟向主 session 注入一条 heartbeat 消息
 *   Agent 读 HEARTBEAT.md（若存在）并决定是否需要采取行动
 *   若无需行动，回复 HEARTBEAT_OK（静默）
 *
 * 配置（server/.env）：
 *   HEARTBEAT_ENABLED=true
 *   HEARTBEAT_INTERVAL=30m        (croner 格式或 ms 数字)
 *   HEARTBEAT_AGENT_ID=main
 *   HEARTBEAT_SYSTEM_PROMPT=...   可选系统提示
 */

const { Cron }     = require('croner')
const path         = require('path')
const fs           = require('fs')
const sessionEngine = require('./session-engine')

const AGENT_ID     = process.env.HEARTBEAT_AGENT_ID    || 'main'
const INTERVAL     = process.env.HEARTBEAT_INTERVAL    || '*/30 * * * *'  // 每 30 分钟
const ENABLED      = process.env.HEARTBEAT_ENABLED !== 'false'
const SESSION_KEY  = `${AGENT_ID}:heartbeat`

// 默认心跳 prompt — 读 HEARTBEAT.md 作为工作空间上下文
const DEFAULT_PROMPT = `Read HEARTBEAT.md if it exists in the workspace. Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK.`

const SYSTEM_PROMPT = process.env.HEARTBEAT_SYSTEM_PROMPT ||
  `You are a personal AI assistant running a periodic self-check. Be concise.`

let _job    = null
let _running = false
let _lastRun = null
let _lastResult = null

async function runHeartbeat() {
  if (_running) {
    console.log('[heartbeat] skipped — previous run still active')
    return
  }
  _running = true
  const startedAt = new Date().toISOString()
  console.log(`[heartbeat] tick at ${startedAt}`)

  try {
    let fullReply = ''

    const result = await sessionEngine.sendMessage({
      agentId:      AGENT_ID,
      sessionKey:   SESSION_KEY,
      userText:     DEFAULT_PROMPT,
      systemPrompt: SYSTEM_PROMPT,
      deliveryCtx:  { channel: 'heartbeat', from: 'system', chatType: 'autonomous' },
      tier:         process.env.HEARTBEAT_TIER || 'T1',
      onToken:      (t) => { fullReply += t },
      onDone:       ({ text }) => {
        const silent = text.trim().startsWith('HEARTBEAT_OK')
        console.log(`[heartbeat] done — ${silent ? 'OK (silent)' : `reply: ${text.slice(0, 120)}`}`)
        _lastResult = { text, silent, at: startedAt }
      },
      onError: (err) => {
        console.error(`[heartbeat] error: ${err.message}`)
        _lastResult = { error: err.message, at: startedAt }
      },
    })

    _lastRun = startedAt
    return result

  } finally {
    _running = false
  }
}

function start() {
  if (!ENABLED) {
    console.log('[heartbeat] disabled (HEARTBEAT_ENABLED=false)')
    return
  }
  if (_job) return  // 已启动

  // 判断是 cron 表达式还是分钟数
  let cronExpr = INTERVAL
  if (/^\d+$/.test(INTERVAL)) {
    // 纯数字 → 当作分钟
    const mins = parseInt(INTERVAL)
    cronExpr = `*/${mins} * * * *`
  } else if (INTERVAL.endsWith('m')) {
    const mins = parseInt(INTERVAL)
    cronExpr = `*/${mins} * * * *`
  } else if (INTERVAL.endsWith('h')) {
    const hrs = parseInt(INTERVAL)
    cronExpr = `0 */${hrs} * * *`
  }

  console.log(`[heartbeat] started — agent=${AGENT_ID} cron="${cronExpr}"`)

  _job = new Cron(cronExpr, { protect: true }, () => {
    runHeartbeat().catch(err => console.error('[heartbeat] unhandled:', err))
  })

  // 不阻止进程退出
  if (_job.getNextRun) {
    console.log(`[heartbeat] next run: ${_job.nextRun?.()?.toISOString() ?? 'unknown'}`)
  }
}

function stop() {
  if (_job) {
    _job.stop()
    _job = null
    console.log('[heartbeat] stopped')
  }
}

function getStatus() {
  return {
    enabled:    ENABLED,
    agentId:    AGENT_ID,
    interval:   INTERVAL,
    running:    _running,
    lastRun:    _lastRun,
    lastResult: _lastResult,
    nextRun:    _job?.nextRun?.()?.toISOString() ?? null,
  }
}

/** 手动触发一次（用于测试/调试） */
async function triggerNow() {
  return runHeartbeat()
}

module.exports = { start, stop, getStatus, triggerNow, SESSION_KEY }
