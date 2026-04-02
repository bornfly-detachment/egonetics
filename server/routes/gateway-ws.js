/**
 * routes/gateway-ws.js
 * WebSocket Gateway — 双向实时通信控制平面
 *
 * 协议（参考 OpenClaw Gateway 设计）：
 *
 * 阶段 1 — 握手：
 *   Client → { type: "connect", token?: string }
 *   Server → { type: "hello-ok", system: { agentId, version } }
 *          或 { type: "error", code: "unauthorized" }
 *
 * 阶段 2 — RPC（JSON-RPC 风格）：
 *   Client → { id: "req-1", method: "send", params: { agentId, sessionKey, text, tier? } }
 *   Server → { id: "req-1", type: "ack" }               (立即回执)
 *   Server → { id: "req-1", type: "token", token: "..." } (流式 token)
 *   Server → { id: "req-1", type: "done", text: "...", usage: {...} }
 *          或 { id: "req-1", type: "error", error: "..." }
 *
 * 其他方法：
 *   "health"           → { ok: true, ts }
 *   "sessions.list"    → { sessions: [...] }
 *   "session.reset"    → { ok: true }
 *   "heartbeat.status" → { ...status }
 *   "heartbeat.trigger"→ { ok: true }
 *
 * SSE 广播（服务器主动推送）：
 *   Server → { type: "event", event: "heartbeat_done", data: {...} }
 */

const WebSocket     = require('ws')
const sessionEngine = require('../lib/session-engine')
const heartbeat     = require('../lib/heartbeat')

const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || ''
const VERSION       = '1.0.0'
const DEFAULT_AGENT = 'main'

// 所有已认证的 WS 连接
const clients = new Set()

/** 广播事件给所有已连接的客户端 */
function broadcast(event, data) {
  const frame = JSON.stringify({ type: 'event', event, data, ts: Date.now() })
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      try { ws.send(frame) } catch {}
    }
  }
}

/** 挂载到 httpServer，创建 WebSocket 服务器 */
function attach(httpServer) {
  const wss = new WebSocket.Server({ server: httpServer, path: '/ws/gateway' })

  wss.on('connection', (ws, req) => {
    let authenticated = !GATEWAY_TOKEN  // 未配置 token → 开放
    let clientId      = Math.random().toString(36).slice(2, 8)

    console.log(`[gateway-ws] connect from ${req.socket.remoteAddress} id=${clientId}`)

    const send = (obj) => {
      if (ws.readyState === WebSocket.OPEN) {
        try { ws.send(JSON.stringify(obj)) } catch {}
      }
    }

    // Ping 保活（每 30s）
    const pingTimer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.ping()
    }, 30000)

    ws.on('pong', () => { /* 连接存活 */ })

    ws.on('message', async (raw) => {
      let msg
      try { msg = JSON.parse(raw) } catch {
        return send({ type: 'error', error: 'invalid json' })
      }

      // ── 握手 ──────────────────────────────────────────────────────────────
      if (msg.type === 'connect') {
        if (GATEWAY_TOKEN && msg.token !== GATEWAY_TOKEN) {
          send({ type: 'error', code: 'unauthorized' })
          return ws.close(4001, 'unauthorized')
        }
        authenticated = true
        clients.add(ws)
        return send({
          type:   'hello-ok',
          system: { agentId: DEFAULT_AGENT, version: VERSION, ts: Date.now() },
        })
      }

      if (!authenticated) {
        return send({ type: 'error', code: 'not_connected', message: 'Send connect first' })
      }

      const { id, method, params = {} } = msg

      // ── RPC 分发 ──────────────────────────────────────────────────────────
      switch (method) {

        case 'health':
          send({ id, type: 'result', ok: true, ts: Date.now() })
          break

        case 'send': {
          const {
            agentId    = DEFAULT_AGENT,
            sessionKey,
            text,
            tier       = 'T1',
            systemPrompt,
          } = params

          if (!text) return send({ id, type: 'error', error: 'text required' })
          const sKey = sessionKey || `${agentId}:web:${clientId}`

          // 立即回执
          send({ id, type: 'ack', sessionKey: sKey })

          await sessionEngine.sendMessage({
            agentId,
            sessionKey: sKey,
            userText:   text,
            systemPrompt,
            deliveryCtx: { channel: 'websocket', from: clientId, chatType: 'direct' },
            tier,
            onToken:  (token) => send({ id, type: 'token', token }),
            onDone:   (result) => send({ id, type: 'done', text: result.text, usage: result.usage }),
            onError:  (err)   => send({ id, type: 'error', error: err.message }),
          })
          break
        }

        case 'sessions.list': {
          const agentId  = params.agentId || DEFAULT_AGENT
          const sessions = sessionEngine.listSessions(agentId)
          send({ id, type: 'result', sessions })
          break
        }

        case 'session.messages': {
          const { agentId = DEFAULT_AGENT, sessionId } = params
          if (!sessionId) return send({ id, type: 'error', error: 'sessionId required' })
          const data = sessionEngine.getSessionMessages(agentId, sessionId)
          send({ id, type: 'result', ...data })
          break
        }

        case 'session.reset': {
          const { agentId = DEFAULT_AGENT, sessionKey } = params
          if (!sessionKey) return send({ id, type: 'error', error: 'sessionKey required' })
          sessionEngine.resetSession(agentId, sessionKey)
          send({ id, type: 'result', ok: true })
          break
        }

        case 'heartbeat.status':
          send({ id, type: 'result', ...heartbeat.getStatus() })
          break

        case 'heartbeat.trigger': {
          send({ id, type: 'ack' })
          heartbeat.triggerNow()
            .then(r => send({ id, type: 'result', ok: true, result: r }))
            .catch(e => send({ id, type: 'error', error: e.message }))
          break
        }

        default:
          send({ id, type: 'error', error: `unknown method: ${method}` })
      }
    })

    ws.on('close', () => {
      clearInterval(pingTimer)
      clients.delete(ws)
      console.log(`[gateway-ws] disconnect id=${clientId}`)
    })

    ws.on('error', (err) => {
      console.error(`[gateway-ws] error id=${clientId}: ${err.message}`)
    })
  })

  console.log(`[gateway-ws] WebSocket Gateway ready at ws://localhost:3002/ws/gateway`)
  return wss
}

module.exports = { attach, broadcast }
