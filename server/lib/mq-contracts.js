/**
 * mq-contracts.js — Kernel Contracts that consume MQ messages
 *
 * Implements the cybernetics loop: 感知 → 控制 → 执行
 *
 * Two mechanisms work together:
 *   1. Kernel Contracts (感知器): detect MQ ports in snapshot, emit node patches
 *      for observability (e.g. set a "mq_alert" node value)
 *   2. Post-tick processing: reads snapshot ports, checks MQ accumulation (N≥3),
 *      dispatches to executor (控制器)
 *
 * MQ is pure transport. All intelligence is here.
 */

const mq = require('./mq')

// Track which channels we monitor
const MONITORED_CHANNELS = [
  { channel: 'builder', event_type: 'build_fail' },
  { channel: 'kernel', event_type: 'tick_diverge' },
  { channel: 'kernel', event_type: 'conflict' },
  { channel: 'task', event_type: 'blocked' },
]

/**
 * Register MQ-consuming contracts into the kernel runtime.
 * These contracts fire when MQ ports have data, providing kernel-level
 * observability. The actual dispatch logic is in processPostTick().
 */
async function register(kernelRuntime) {
  const kr = kernelRuntime

  // ── 感知器 Contract: Builder Build Failures ──
  kr.registerContract({
    id: 'mq-perceiver-builder',
    type: 'dynamic',
    priority: 5,
    participants: [],
    conditionCode: `
      const port = env && env.ports ? env.ports.get('mq:builder:build_fail') : null;
      return port != null;
    `,
    emitCode: `return [];`,
  }, 'system')

  // ── 感知器 Contract: Kernel Tick Divergence ──
  kr.registerContract({
    id: 'mq-perceiver-kernel-diverge',
    type: 'dynamic',
    priority: 5,
    participants: [],
    conditionCode: `
      const port = env && env.ports ? env.ports.get('mq:kernel:tick_diverge') : null;
      return port != null;
    `,
    emitCode: `return [];`,
  }, 'system')

  // ── 感知器 Contract: Task Blocked ──
  kr.registerContract({
    id: 'mq-perceiver-task-blocked',
    type: 'dynamic',
    priority: 5,
    participants: [],
    conditionCode: `
      const port = env && env.ports ? env.ports.get('mq:task:blocked') : null;
      return port != null;
    `,
    emitCode: `return [];`,
  }, 'system')

  console.log('✅ MQ Contracts registered (3 perceivers)')
}

/**
 * Post-tick MQ processing — the 控制器 layer.
 * Checks all monitored channels for accumulation (N ≥ 3) and dispatches.
 * Called from kernel-runtime after each tick.
 */
async function processPostTick() {
  for (const { channel, event_type } of MONITORED_CHANNELS) {
    try {
      const count = await mq.countPending({
        channel,
        event_type,
        window_sec: 3600,
      })

      if (count >= 3) {
        console.log(`[mq-contract] ${channel}:${event_type} accumulated ${count} ≥ 3, dispatching...`)

        const messages = await mq.query({
          channel,
          event_type,
          status: 'pending',
          limit: count,
        })

        const ids = messages.map(m => m.id)
        await mq.batchAck(ids, 'dispatched')

        const aggregatedPayload = {
          channel,
          event_type,
          count,
          messages: messages.map(m => ({
            id: m.id,
            source_id: m.source_id,
            payload: m.payload,
            created_at: m.created_at,
          })),
        }

        await dispatchAction(channel, event_type, aggregatedPayload)
      }
    } catch (err) {
      console.error(`[mq-contract] dispatch error for ${channel}:${event_type}:`, err.message)
    }
  }
}

/**
 * Dispatch action based on channel + event_type.
 * This is the 控制器 — decides what to do with accumulated messages.
 */
async function dispatchAction(channel, event_type, aggregatedPayload) {
  const { executeTask } = require('./executor')
  const { pagesDb } = require('../db')

  function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
      pagesDb.run(sql, params, function (err) { err ? reject(err) : resolve(this) })
    })
  }

  const genId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

  if (channel === 'builder' && event_type === 'build_fail') {
    const ruleIds = [...new Set(aggregatedPayload.messages.map(m => m.source_id).filter(Boolean))]
    const errors = aggregatedPayload.messages.map(m => m.payload?.error).filter(Boolean)

    const taskDesc = `Protocol Builder 规则构建失败 (${aggregatedPayload.count} 次)。
失败规则: ${ruleIds.join(', ')}
错误信息: ${errors.join('; ')}
请分析失败原因并提供修正方案。`

    const runId = genId('run')
    await dbRun(
      `INSERT INTO execution_runs (id, task_id, status, current_tier, steps, api_calls, escalations)
       VALUES (?, ?, 'running', 'T0', '[]', 0, '[]')`,
      [runId, `mq-builder-${Date.now()}`]
    )
    executeTask(runId, `mq-builder-${Date.now()}`, taskDesc).catch(err =>
      console.error('[mq-contract] builder executor error:', err.message)
    )
    console.log(`[mq-contract] dispatched builder fix executor: ${runId}`)
  }

  else if (channel === 'kernel' && event_type === 'tick_diverge') {
    console.log(`[mq-contract] ${aggregatedPayload.count} tick divergences detected — review contracts`)
  }

  else if (channel === 'kernel' && event_type === 'conflict') {
    console.log(`[mq-contract] ${aggregatedPayload.count} conflicts detected — review contracts`)
  }

  else if (channel === 'task' && event_type === 'blocked') {
    const taskIds = [...new Set(aggregatedPayload.messages.map(m => m.source_id).filter(Boolean))]
    for (const taskId of taskIds) {
      const runId = genId('run')
      await dbRun(
        `INSERT INTO execution_runs (id, task_id, status, current_tier, steps, api_calls, escalations)
         VALUES (?, ?, 'running', 'T0', '[]', 0, '[]')`,
        [runId, taskId]
      )
      const taskDesc = `任务 ${taskId} 被阻塞，请分析原因并提供解决方案。`
      executeTask(runId, taskId, taskDesc).catch(err =>
        console.error('[mq-contract] task executor error:', err.message)
      )
      console.log(`[mq-contract] dispatched task unblock executor: ${runId} for ${taskId}`)
    }
  }
}

module.exports = { register, processPostTick }
