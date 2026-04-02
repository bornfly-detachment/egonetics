/**
 * routes/webhook.js
 * POST /api/webhook/:channel — 外部渠道入站消息接收
 *
 * 支持的渠道：
 *   feishu    飞书机器人 webhook
 *   generic   通用 JSON webhook（测试/自定义集成）
 *   任意      只要携带正确 token
 *
 * 鉴权方式：
 *   Header:  X-Webhook-Token: <WEBHOOK_SECRET>
 *   Query:   ?token=<WEBHOOK_SECRET>
 *
 * 请求体（generic 格式）：
 *   { "from": "user_id", "text": "消息内容", "agentId": "main" }
 *
 * 飞书格式：
 *   { "sender": { "sender_id": { "open_id": "..." } }, "message": { "content": "{\"text\":\"...\"}" } }
 *
 * 响应：
 *   流式 SSE（Content-Type: text/event-stream）
 *   或同步 JSON（?stream=false）
 */

const express        = require('express')
const router         = express.Router()
const sessionEngine  = require('../lib/session-engine')

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || ''
const DEFAULT_AGENT  = process.env.WEBHOOK_AGENT_ID || 'main'

const SYSTEM_PROMPT = process.env.WEBHOOK_SYSTEM_PROMPT ||
  `You are a helpful AI assistant. Answer concisely.`

// ── 鉴权中间件 ────────────────────────────────────────────────────────────────
function verifyToken(req, res, next) {
  if (!WEBHOOK_SECRET) return next()  // 未配置 secret → 开放

  const headerToken = req.headers['x-webhook-token']
  const queryToken  = req.query.token

  if (headerToken === WEBHOOK_SECRET || queryToken === WEBHOOK_SECRET) {
    return next()
  }
  return res.status(401).json({ error: 'Unauthorized: invalid webhook token' })
}

// ── 渠道解析器 ────────────────────────────────────────────────────────────────
function parseFeishu(body) {
  // 飞书验证挑战
  if (body.type === 'url_verification') {
    return { challenge: body.challenge }
  }
  const event   = body.event || {}
  const sender  = event.sender?.sender_id?.open_id || event.sender?.sender_id?.user_id || 'unknown'
  let text      = ''
  try {
    const msgContent = JSON.parse(event.message?.content || '{}')
    text = msgContent.text || ''
  } catch {
    text = event.message?.content || ''
  }
  return { from: sender, text, chatType: event.message?.chat_type || 'direct' }
}

function parseGeneric(body) {
  return {
    from:     body.from || body.sender || body.user_id || 'anonymous',
    text:     body.text || body.message || body.content || '',
    agentId:  body.agentId || body.agent_id,
    chatType: body.chatType || 'direct',
  }
}

// ── 主路由 ────────────────────────────────────────────────────────────────────
router.post('/webhook/:channel', verifyToken, async (req, res) => {
  const channel = req.params.channel
  const body    = req.body || {}
  const useSSE  = req.query.stream !== 'false'

  console.log(`[webhook] inbound channel=${channel} keys=${Object.keys(body).join(',')}`)

  // 飞书 URL 验证挑战（必须同步响应）
  if (channel === 'feishu' && body.type === 'url_verification') {
    return res.json({ challenge: body.challenge })
  }

  // 解析消息
  let parsed
  if (channel === 'feishu') {
    parsed = parseFeishu(body)
  } else {
    parsed = parseGeneric(body)
  }

  const { from, text, agentId: bodyAgentId, chatType } = parsed
  const agentId    = bodyAgentId || DEFAULT_AGENT
  const sessionKey = `${agentId}:${channel}:${from}`

  if (!text || !text.trim()) {
    return res.json({ ok: true, message: 'empty message ignored' })
  }

  const deliveryCtx = { channel, from, chatType, receivedAt: new Date().toISOString() }

  if (useSSE) {
    // ── 流式响应 ──
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()

    const send = (event, data) => {
      try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`) } catch {}
    }

    send('start', { sessionKey, agentId, channel })

    await sessionEngine.sendMessage({
      agentId,
      sessionKey,
      userText:     text.trim(),
      systemPrompt: SYSTEM_PROMPT,
      deliveryCtx,
      tier:         req.query.tier || 'T1',
      onToken:      (token) => send('token', { token }),
      onDone:       (result) => {
        send('done', { text: result.text, usage: result.usage })
        res.end()
      },
      onError:      (err) => {
        send('error', { error: err.message })
        res.end()
      },
    })

  } else {
    // ── 同步响应 ──
    const result = await sessionEngine.sendMessage({
      agentId,
      sessionKey,
      userText:     text.trim(),
      systemPrompt: SYSTEM_PROMPT,
      deliveryCtx,
      tier: req.query.tier || 'T1',
    })
    res.json(result)
  }
})

// GET /api/webhook/sessions/:agentId — 查看某 agent 的所有 session
router.get('/webhook/sessions/:agentId', (req, res) => {
  const sessions = sessionEngine.listSessions(req.params.agentId)
  res.json(sessions)
})

// GET /api/webhook/sessions/:agentId/:sessionId — 查看 session 消息
router.get('/webhook/sessions/:agentId/:sessionId', (req, res) => {
  const { agentId, sessionId } = req.params
  const data = sessionEngine.getSessionMessages(agentId, sessionId)
  res.json(data)
})

// DELETE /api/webhook/sessions/:agentId/:sessionKey — 重置 session
router.delete('/webhook/sessions/:agentId/:sessionKey(*)', (req, res) => {
  const { agentId, sessionKey } = req.params
  sessionEngine.resetSession(agentId, decodeURIComponent(sessionKey))
  res.json({ ok: true })
})

module.exports = router
