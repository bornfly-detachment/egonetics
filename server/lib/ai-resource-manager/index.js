/**
 * ai-resource-manager/index.js
 *
 * PRVSE Resource 层 — AI 智能资源统一管理入口（单例）
 *
 * 职责：
 *   - 按次调用：ai.call({ tier, messages }) → 队列 → 协议适配 → 日志
 *   - 资源监控：ai.status() → 各 tier 健康/队列/内存
 *   - 动态分配：基于实时内存/swap/CPU 调整并发和 session 上限
 *
 * 替代：t0-engine.js / t1-engine.js / t2-client.js / llm.js 的分散调用
 *
 * 用法：
 *   const ai = require('./lib/ai-resource-manager')
 *   ai.start()
 *   const result = await ai.call({ tier: 'T1', messages: [...], purpose: 'classify' })
 *   const health = ai.status()
 */

'use strict'

const allocator = require('./allocator')
const queue = require('./queue')
const { call, TIER_CONFIG } = require('./call')
const logger = require('./logger')
const platform = require('./platform')

let _started = false

// ── 启动 ─────────────────────────────────────────────────────────

function start(configOverrides) {
  if (_started) return
  allocator.start(configOverrides)
  _started = true
  console.log('[ai-resource-manager] started — polling every 30s')
}

// ── 状态 ─────────────────────────────────────────────────────────

function status() {
  const limits = allocator.getLimits()
  const queues = queue.status()
  const today = logger.todaySummary()

  return {
    health: limits.health,
    mustReclaim: limits.mustReclaim,
    ram: limits.ram,
    swap: limits.swap,
    pressure: {
      memory: limits.memoryPressure,
      swap: limits.swapPressure,
      cpu: limits.cpuPressure,
    },
    tiers: {
      T0: {
        alive: platform.isPortListening(parseInt(process.env.T0_INFERENCE_PORT || '8100', 10)),
        model: TIER_CONFIG.T0.model(),
        queue: queues.T0,
        today: today.tiers.T0 || null,
      },
      T1: {
        alive: true,  // 云服务，假设可用
        model: TIER_CONFIG.T1.model(),
        queue: queues.T1,
        today: today.tiers.T1 || null,
      },
      T2: {
        alive: !!process.env.ANTHROPIC_API_KEY,
        model: TIER_CONFIG.T2.model(),
        queue: queues.T2,
        today: today.tiers.T2 || null,
      },
    },
    sessions: {
      current: limits.currentSessions,
      max: limits.maxSessions,
      canCreate: limits.canCreateSession,
    },
    orphans: limits.categories.orphans.length,
    timestamp: limits.timestamp,
  }
}

// ── 停止 ─────────────────────────────────────────────────────────

function stop() {
  allocator.stop()
  _started = false
}

// ── 导出 ─────────────────────────────────────────────────────────

module.exports = {
  start,
  stop,
  call,
  status,

  // 细粒度访问（供高级消费者使用）
  allocator,
  queue,
  logger,
  platform,
}
