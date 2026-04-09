/**
 * server/lib/t0-engine.js
 *
 * T0 薄适配器 — 保持旧接口不变，内部委托给 ai-service
 *
 * 所有消费者（session-engine / anthropic-compat / t0-inference）
 * 无需修改 import，自动走 ai-service 统一管道（队列+日志+溯源）。
 *
 * 接口（保持兼容）：
 *   call(messages, opts)   → { content, usage, stopReason }
 *   stream(messages, opts) → AsyncGenerator<{ type:'text', text } | { type:'done', usage }>
 *   checkHealth()          → Promise<boolean>
 */

'use strict'

const ai = require('./ai-service')
const { platform } = require('./resource-manager')

async function call(messages, opts = {}) {
  const result = await ai.call({
    tier: 'T0',
    messages,
    system: opts.system,
    maxTokens: opts.maxTokens || 2048,
    purpose: 'legacy-t0-call',
    enableThinking: true,
  })
  // Map to old interface shape
  return {
    content: result.content,
    usage: { input_tokens: result.usage.inputTokens, output_tokens: result.usage.outputTokens },
    stopReason: 'end_turn',
  }
}

async function* stream(messages, opts = {}) {
  const gen = ai.stream({
    tier: 'T0',
    messages,
    system: opts.system,
    maxTokens: opts.maxTokens || 2048,
    purpose: 'legacy-t0-stream',
    enableThinking: true,
  })
  for await (const event of gen) {
    if (event.type === 'done') {
      yield { type: 'done', usage: { input_tokens: 0, output_tokens: 0 }, stopReason: 'end_turn' }
    } else {
      yield event
    }
  }
}

async function checkHealth() {
  const port = parseInt(process.env.T0_INFERENCE_PORT || '8100', 10)
  return platform.isPortListening(port)
}

module.exports = { call, stream, checkHealth }
