/**
 * ai-service/index.js
 *
 * AI 调用服务层 — 协议适配 + 队列 + 日志
 *
 * 职责：给模型发消息，拿回结果。不管进程生命周期。
 * 依赖：resource-manager（查询可用资源/并发上限）
 * 不依赖：harness-manager
 *
 * 接口：
 *   ai.call({ tier, messages, system, purpose }) → { content, usage, latencyMs }
 *   ai.status() → 各 tier 健康/队列/今日统计
 *   ai.start()  → 启动 allocator 定时采集
 */

'use strict'

const { allocator, platform } = require('../resource-manager')
const queue = require('./queue')
const { call, TIER_CONFIG } = require('./call')
const logger = require('./logger')

let _started = false

function start(configOverrides) {
  if (_started) return
  allocator.start(configOverrides)
  _started = true
  console.log('[ai-service] started')
}

function status() {
  const limits = allocator.getLimits()
  const queues = queue.status()
  const today = logger.todaySummary()

  return {
    health: limits.health,
    mustReclaim: limits.mustReclaim,
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
        alive: true,
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
    timestamp: limits.timestamp,
  }
}

function stop() {
  allocator.stop()
  _started = false
}

module.exports = {
  start,
  stop,
  call,
  status,
  queue,
  logger,
}
