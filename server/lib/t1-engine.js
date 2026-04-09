/**
 * server/lib/t1-engine.js
 *
 * T1 薄适配器 — 保持旧接口不变，内部委托给 ai-service
 *
 * 所有消费者（session-engine / anthropic-compat）
 * 无需修改 import，自动走 ai-service 统一管道（队列+日志+溯源）。
 *
 * 接口（保持兼容）：
 *   call(messages, opts)   → { content, usage, stopReason }
 *   stream(messages, opts) → AsyncGenerator<{ type:'text', text } | { type:'done', usage }>
 *   MODEL                  → string
 */

'use strict'

const ai = require('./ai-service')

const MODEL = process.env.MINIMAX_MODEL || 'MiniMax-M2.7'

async function call(messages, opts = {}) {
  const result = await ai.call({
    tier: 'T1',
    messages,
    system: opts.system,
    maxTokens: opts.maxTokens || 4096,
    purpose: 'legacy-t1-call',
  })
  return {
    content: result.content,
    usage: { input_tokens: result.usage.inputTokens, output_tokens: result.usage.outputTokens },
    stopReason: 'end_turn',
  }
}

async function* stream(messages, opts = {}) {
  const gen = ai.stream({
    tier: 'T1',
    messages,
    system: opts.system,
    maxTokens: opts.maxTokens || 4096,
    purpose: 'legacy-t1-stream',
  })
  for await (const event of gen) {
    if (event.type === 'done') {
      yield { type: 'done', usage: { input_tokens: 0, output_tokens: 0 }, stopReason: 'end_turn' }
    } else {
      yield event
    }
  }
}

module.exports = { call, stream, MODEL }
