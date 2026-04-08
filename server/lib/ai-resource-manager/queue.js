/**
 * ai-resource-manager/queue.js
 *
 * 统一请求队列 — 所有 AI 按次调用必经此队列
 *
 * 每个 tier 独立队列，并发数由 allocator 动态控制：
 *   T0: 串行（concurrency=1），本地模型单线程
 *   T1: 并发池（默认 5，压力大时降级）
 *   T2: 并发池（默认 3，压力大时降级）
 */

'use strict'

const allocator = require('./allocator')

// ── 队列状态 ─────────────────────────────────────────────────────

const _queues = {
  T0: { running: 0, waiting: [] },
  T1: { running: 0, waiting: [] },
  T2: { running: 0, waiting: [] },
}

// ── 核心逻辑 ─────────────────────────────────────────────────────

/**
 * 获取执行槽位。返回 Promise，resolve 时表示可以执行。
 * 调用方必须在完成后调用 release(tier)。
 */
function acquire(tier) {
  const q = _queues[tier]
  if (!q) return Promise.reject(new Error(`Unknown tier: ${tier}`))

  const maxConcurrency = allocator.getTierConcurrency(tier)

  if (q.running < maxConcurrency) {
    q.running++
    return Promise.resolve()
  }

  // 排队等待
  return new Promise((resolve) => {
    q.waiting.push(resolve)
  })
}

/**
 * 释放执行槽位。如果有等待的请求，唤醒下一个。
 */
function release(tier) {
  const q = _queues[tier]
  if (!q) return

  if (q.waiting.length > 0) {
    const next = q.waiting.shift()
    next()  // running 数不变，直接交给下一个
  } else {
    q.running = Math.max(0, q.running - 1)
  }
}

/**
 * 包装一个异步函数，自动 acquire/release。
 *
 * const result = await queue.run('T1', () => callMiniMax(messages))
 */
async function run(tier, fn) {
  await acquire(tier)
  try {
    return await fn()
  } finally {
    release(tier)
  }
}

/**
 * 获取各队列状态（供监控/API 使用）。
 */
function status() {
  const result = {}
  for (const [tier, q] of Object.entries(_queues)) {
    result[tier] = {
      running: q.running,
      waiting: q.waiting.length,
      maxConcurrency: allocator.getTierConcurrency(tier),
    }
  }
  return result
}

module.exports = { acquire, release, run, status }
