/**
 * @prvse P-L0-IMPL_gate
 *
 * L0 Gate Engine — 确定性门控层
 *
 * 借鉴 Openclaw armTimer + free-code consolidationLock 模式。
 * 不做决策，只做"门控条件满足 → 向 L1 发 ready 事件"。
 *
 * 门控链（最便宜的先查）：
 *   1. Timer gate   — 距上次 tick ≥ intervalMs
 *   2. Lock gate    — 没有其他 tick 正在执行
 *   3. Health gate  — perceiver 检测目标 P 节点 alive
 *
 * 不用 setInterval 盲轮询。用 setTimeout 精确定时到下一个 fire time
 * （Openclaw armTimer 模式）。
 */

'use strict'

const fs = require('fs')
const path = require('path')
const perceiver = require('./perceiver')

// ── Constants ───────────────────────────────────────────────────

const MAX_TIMER_DELAY_MS = 60_000        // cap: 60s, 防止 drift
const MIN_REFIRE_GAP_MS  = 2_000         // 最小间隔, 防止 tight loop
const DEFAULT_INTERVAL   = 10 * 60_000   // 10 min default tick

// ── State ───────────────────────────────────────────────────────

const state = {
  timer:     null,
  running:   false,
  lastRunAt: 0,
  intervalMs: DEFAULT_INTERVAL,
  onReady:   null,   // L1 回调: (ctx) => Promise<void>
  enabled:   false,
  stats: {
    ticks:     0,
    skipped:   0,
    errors:    0,
    lastError: null,
  },
}

// ── Timer gate (Openclaw armTimer pattern) ───────────────────────

function armTimer() {
  if (state.timer) {
    clearTimeout(state.timer)
    state.timer = null
  }
  if (!state.enabled) return

  const now = Date.now()
  const nextAt = state.lastRunAt + state.intervalMs
  const delay = Math.max(nextAt - now, MIN_REFIRE_GAP_MS)
  const clamped = Math.min(delay, MAX_TIMER_DELAY_MS)

  state.timer = setTimeout(() => onTick(), clamped)

  // 不阻止进程退出 (free-code preventSleep 模式)
  if (state.timer.unref) state.timer.unref()
}

// ── Lock gate (file-based, free-code consolidationLock pattern) ──

const LOCK_DIR = path.join(
  process.env.PRVSE_WORKSPACE || path.resolve(__dirname, '../../../../prvse_world_workspace'),
  'L0/state'
)
const LOCK_FILE = path.join(LOCK_DIR, 'gate.lock')

function tryAcquireLock() {
  try {
    fs.mkdirSync(LOCK_DIR, { recursive: true })
    // 检查是否已有锁 + PID 是否存活
    if (fs.existsSync(LOCK_FILE)) {
      const content = fs.readFileSync(LOCK_FILE, 'utf8').trim()
      const [pidStr, tsStr] = content.split(':')
      const pid = parseInt(pidStr, 10)
      const ts = parseInt(tsStr, 10)

      // 锁存活且 PID 存活 → 拒绝
      if (pid && ts && (Date.now() - ts) < 60 * 60_000) {
        try {
          process.kill(pid, 0)  // 检查 PID 是否存活
          return false           // 另一个进程持有锁
        } catch { /* PID 不存在, 锁过期 */ }
      }
    }
    // 写入锁
    fs.writeFileSync(LOCK_FILE, `${process.pid}:${Date.now()}`)
    // 验证 (防竞争)
    const verify = fs.readFileSync(LOCK_FILE, 'utf8').trim()
    return verify.startsWith(`${process.pid}:`)
  } catch {
    return false
  }
}

function releaseLock() {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      const content = fs.readFileSync(LOCK_FILE, 'utf8').trim()
      if (content.startsWith(`${process.pid}:`)) {
        fs.unlinkSync(LOCK_FILE)
      }
    }
  } catch { /* ignore */ }
}

// ── Tick (all gates check in order) ─────────────────────────────

async function onTick() {
  // Gate 1: Lock — 是否有其他进程正在执行
  if (state.running) {
    state.stats.skipped++
    armTimer()
    return
  }

  // Gate 2: Lock file — 跨进程锁
  if (!tryAcquireLock()) {
    state.stats.skipped++
    armTimer()
    return
  }

  state.running = true
  const startedAt = Date.now()

  try {
    // Gate 3: Health — 感知 P 节点状态
    const snapshot = perceiver.sense()

    // 构造 L1 上下文
    const ctx = {
      snapshot,
      startedAt,
      tickNumber: ++state.stats.ticks,
    }

    // 向 L1 发 ready 事件
    if (state.onReady) {
      await state.onReady(ctx)
    }

    state.lastRunAt = startedAt

  } catch (err) {
    state.stats.errors++
    state.stats.lastError = { message: err.message, at: new Date().toISOString() }
    console.error('[gate] tick error:', err.message)
  } finally {
    state.running = false
    releaseLock()
    armTimer()
  }
}

// ── Public API ──────────────────────────────────────────────────

/**
 * Start the L0 gate engine.
 * @param {Object} opts
 * @param {number} [opts.intervalMs] - tick interval in ms (default 10min)
 * @param {function} opts.onReady    - L1 callback: async (ctx) => void
 */
function start(opts = {}) {
  if (state.enabled) return

  state.intervalMs = opts.intervalMs || DEFAULT_INTERVAL
  state.onReady = opts.onReady || null
  state.enabled = true
  state.lastRunAt = Date.now() - state.intervalMs  // 首次立即触发

  console.log(`[gate] started — interval=${Math.round(state.intervalMs / 1000)}s`)
  armTimer()
}

function stop() {
  state.enabled = false
  if (state.timer) {
    clearTimeout(state.timer)
    state.timer = null
  }
  releaseLock()
  console.log('[gate] stopped')
}

function getStatus() {
  return {
    enabled:    state.enabled,
    running:    state.running,
    intervalMs: state.intervalMs,
    lastRunAt:  state.lastRunAt ? new Date(state.lastRunAt).toISOString() : null,
    stats:      { ...state.stats },
  }
}

/** 手动触发一次（测试/调试） */
async function triggerNow() {
  if (state.running) return { ok: false, reason: 'already-running' }
  await onTick()
  return { ok: true }
}

// 进程退出时释放锁
process.on('exit', releaseLock)
process.on('SIGINT', () => { stop(); process.exit(0) })
process.on('SIGTERM', () => { stop(); process.exit(0) })

module.exports = { start, stop, getStatus, triggerNow }
