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

const express = require('express')
const router  = express.Router()
const { client, DEFAULT_MODEL, DEFAULT_MAX_TOKENS } = require('../lib/llm')

/** 将 system prompt 合并进 messages（ARK 部分模型不支持顶层 system 字段） */
function buildMessages(messages, system) {
  if (!system) return messages
  // 在第一条 user 消息前插入 system 内容
  const first = messages[0]
  if (first?.role === 'user') {
    return [
      { role: 'user', content: `[系统指令]\n${system}\n\n[用户消息]\n${first.content}` },
      ...messages.slice(1),
    ]
  }
  return messages
}

// POST /api/llm/chat
router.post('/chat', async (req, res) => {
  const { messages, system, model, max_tokens } = req.body
  const useStream = req.body.stream !== false  // 默认 true

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages 不能为空' })
  }

  const finalModel     = model      || DEFAULT_MODEL
  const finalMaxTokens = max_tokens || DEFAULT_MAX_TOKENS
  const finalMessages  = buildMessages(messages, system)

  console.log(`[llm/chat] model=${finalModel} turns=${finalMessages.length} stream=${useStream}`)

  // ── 同步模式 ────────────────────────────────────────────────
  if (!useStream) {
    try {
      const msg = await client.messages.create({
        model: finalModel,
        max_tokens: finalMaxTokens,
        messages: finalMessages,
      })
      const text = msg.content.find(c => c.type === 'text')?.text || ''
      return res.json({ text, usage: msg.usage })
    } catch (e) {
      console.error('[llm/chat] sync error:', e.message)
      return res.status(500).json({ error: e.message })
    }
  }

  // ── SSE 流式模式 ─────────────────────────────────────────────
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')  // 禁止 nginx 缓冲
  res.flushHeaders()

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`)

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
      if (chunk.type === 'message_delta' && chunk.usage) {
        // 包含 usage 信息的最终 delta
      }
      if (chunk.type === 'message_stop') {
        // 某些模型在这里结束
      }
    }

    // 发送结束信号（usage 从 finalMessage 获取）
    try {
      const final = await stream.finalMessage()
      send({ done: true, usage: final.usage })
    } catch {
      send({ done: true })
    }
  } catch (e) {
    console.error('[llm/chat] stream error:', e.message)
    send({ error: e.message })
  }

  res.end()
})

module.exports = router
