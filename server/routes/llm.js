/**
 * routes/llm.js
 * POST /api/llm/chat — 通用多轮对话接口，支持 SSE 流式输出
 *
 * 请求体：
 *   messages   [{role, content}]  必填，多轮历史
 *   system     string             可选，系统 prompt
 *   model      string             可选，默认 ark-code-latest
 *   max_tokens number             可选，默认 2048
 *   stream     boolean            可选，默认 true（SSE）；false 时同步返回
 *
 * SSE 事件格式（stream=true）：
 *   data: {"text":"..."}          每个 token 片段
 *   data: {"done":true,"usage":{...}}  结束信号
 *   data: {"error":"..."}         出错信号
 *
 * 同步响应格式（stream=false）：
 *   { text: "...", usage: {...} }
 */

const express    = require('express')
const router     = express.Router()
const { getClientForTier, DEFAULT_MODEL, DEFAULT_MAX_TOKENS } = require('../lib/llm')
const codeAgent  = require('../lib/code-agent')

/** 将 system prompt 合并进 messages（ARK 部分模型不支持顶层 system 字段） */
function buildMessages(messages, system) {
  if (!system) return messages
  const first = messages[0]
  if (first?.role === 'user') {
    return [
      { role: 'user', content: `[系统指令]\n${system}\n\n[用户消息]\n${first.content}` },
      ...messages.slice(1),
    ]
  }
  return messages
}

// ── T2: Claude Code CLI via code-agent (有状态会话 + tmux + JSONL) ─

// POST /api/llm/chat
// 字段: tier — 'T0'|'T1'|'T2'
router.post('/chat', async (req, res) => {
  const { messages, system, model, max_tokens, tier } = req.body
  const useStream = req.body.stream !== false

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages 不能为空' })
  }

  // ── T2: Claude Code CLI（code-agent，有状态 + tmux + JSONL）───
  if (tier === 'T2') {
    const m          = model || 'claude-sonnet-4-6'
    const contextKey = req.body.contextKey || 'llm-t2-default'

    res.setHeader('Content-Type',  'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection',    'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders()

    const send = obj => res.write(`data: ${JSON.stringify(obj)}\n\n`)
    send({ meta: { tier: 'T2', model: m } })

    // 取最后一条用户消息作为本轮 prompt（历史由 --resume session 维护）
    const lastUserMsg = [...messages].reverse().find(msg => msg.role === 'user')
    const prompt = lastUserMsg?.content ?? ''
    if (!prompt.trim()) { send({ error: 'no user message' }); return res.end() }

    // 如有 system，前置拼入 prompt（仅首轮有效，后续轮次靠 session 记忆）
    const fullPrompt = system
      ? `[System]\n${system}\n\n[User]\n${prompt}`
      : prompt

    try {
      for await (const event of codeAgent.runQuery(fullPrompt, {
        contextKey,
        model: m,
        useTmux:       true,
        streamPartial: true,   // 启用逐 token 流式输出
      })) {
        // 流式 token chunk
        if (event.type === 'stream_event' &&
            event.event?.type === 'content_block_delta' &&
            event.event?.delta?.type === 'text_delta') {
          send({ text: event.event.delta.text })
        }
        // 最终完成（带成本信息）
        if (event.type === 'result') {
          send({ done: true, meta: { tier: 'T2', model: m, cost: event.total_cost_usd } })
        }
        if (event.type === 'error') {
          send({ error: event.error })
        }
      }
    } catch (e) {
      send({ error: e.message })
    }
    return res.end()
  }

  // 按 tier 路由：T0=SEAI / T1=MiniMax
  const { client, model: tierModel, downgraded } = getClientForTier(tier)
  const finalModel     = model || tierModel || DEFAULT_MODEL
  const finalMaxTokens = max_tokens || DEFAULT_MAX_TOKENS
  const finalMessages  = buildMessages(messages, system)

  const tierLabel = tier ? `${tier}${downgraded ? '→T1(降级)' : ''}` : 'default'
  console.log(`[llm/chat] tier=${tierLabel} model=${finalModel} turns=${finalMessages.length} stream=${useStream}`)

  // ── 同步模式 ────────────────────────────────────────────────
  if (!useStream) {
    try {
      const msg = await client.messages.create({
        model: finalModel,
        max_tokens: finalMaxTokens,
        messages: finalMessages,
      })
      const text = msg.content.find(c => c.type === 'text')?.text || ''
      return res.json({ text, usage: msg.usage, tier: tierLabel })
    } catch (e) {
      console.error('[llm/chat] sync error:', e.message)
      return res.status(500).json({ error: e.message })
    }
  }

  // ── SSE 流式模式 ─────────────────────────────────────────────
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`)

  // 首先告知前端实际使用的 tier（前端可展示"T0 SEAI 响应中..."）
  send({ meta: { tier: tierLabel, model: finalModel } })

  try {
    const stream = await client.messages.create({
      model: finalModel,
      max_tokens: finalMaxTokens,
      messages: finalMessages,
      stream: true,
    })

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
        send({ text: chunk.delta.text })
      }
    }

    try {
      const final = await stream.finalMessage()
      send({ done: true, usage: final.usage })
    } catch {
      send({ done: true })
    }
  } catch (e) {
    console.error('[llm/chat] stream error:', e.message)
    // T0 SEAI 不可用时自动降级到 T1
    if (tier === 'T0') {
      send({ meta: { tier: 'T0→T1(SEAI离线，降级)', model: DEFAULT_MODEL } })
      console.log('[llm/chat] T0 SEAI unavailable, falling back to T1 MiniMax')
      try {
        const { client: fallbackClient } = getClientForTier('T1')
        const fallbackStream = await fallbackClient.messages.create({
          model: DEFAULT_MODEL,
          max_tokens: finalMaxTokens,
          messages: finalMessages,
          stream: true,
        })
        for await (const chunk of fallbackStream) {
          if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
            send({ text: chunk.delta.text })
          }
        }
        send({ done: true })
      } catch (fallbackErr) {
        send({ error: fallbackErr.message })
      }
    } else {
      send({ error: e.message })
    }
  }

  res.end()
})

module.exports = router
