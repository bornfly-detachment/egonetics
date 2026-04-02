/**
 * server/lib/ai-semaphore.js
 * 三层 AI Tier FIFO 信号量 — 并发上限 + 精准计时
 *
 * 并发上限（根据实际瓶颈估算）：
 *   T0: 2  — SEAI 本地 GPU，单 batch 推理
 *   T1: 8  — MiniMax 云端，API rate limit
 *   T2: 3  — Claude API，成本 + rate limit
 *
 * 时间字段（精确到毫秒）：
 *   enqueue_at    — 请求进入队列的时刻
 *   start_at      — 获取到执行槽的时刻（真实 LLM 调用开始）
 *   end_at        — LLM 调用结束时刻（由调用方写入）
 *   queue_wait_ms — start_at - enqueue_at（在队列中等了多久）
 *   duration_ms   — end_at - start_at（真实 LLM 耗时）
 */

'use strict'

const LIMITS = {
  T0: 2,
  T1: 8,
  T2: 3,
}

class FIFOSemaphore {
  constructor(max, tier) {
    this.max    = max
    this.tier   = tier
    this.active = 0
    this.queue  = []   // { resolve, reject, enqueuedAt }
  }

  /**
   * 获取执行槽（FIFO）
   * resolve: { enqueuedAt, startAt, waitMs }
   */
  acquire() {
    const enqueuedAt = Date.now()

    if (this.active < this.max) {
      this.active++
      const startAt = Date.now()
      return Promise.resolve({ enqueuedAt, startAt, waitMs: startAt - enqueuedAt })
    }

    return new Promise((resolve, reject) => {
      this.queue.push({ resolve, reject, enqueuedAt })
    })
  }

  /**
   * 释放执行槽，FIFO 唤醒下一个等待者
   */
  release() {
    if (this.queue.length > 0) {
      // slot 直接移交，不减 active
      const { resolve, enqueuedAt } = this.queue.shift()
      const startAt = Date.now()
      resolve({ enqueuedAt, startAt, waitMs: startAt - enqueuedAt })
    } else {
      this.active--
    }
  }

  /** 关闭时清空队列（拒绝所有等待） */
  drain(reason = '服务关闭') {
    while (this.queue.length > 0) {
      this.queue.shift().reject(new Error(reason))
    }
    this.active = 0
  }

  getStats() {
    return { tier: this.tier, max: this.max, active: this.active, queued: this.queue.length }
  }
}

const semaphores = {
  T0: new FIFOSemaphore(LIMITS.T0, 'T0'),
  T1: new FIFOSemaphore(LIMITS.T1, 'T1'),
  T2: new FIFOSemaphore(LIMITS.T2, 'T2'),
}

function getAllStats() {
  return Object.values(semaphores).map(s => s.getStats())
}

module.exports = { semaphores, getAllStats }
