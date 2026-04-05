/**
 * routes/free-code-ws.js
 * WebSocket + node-pty bridge for free-code TUI
 *
 * 挂载点: ws://localhost:3002/ws/free-code
 *
 * 协议：
 *   Client → { type: 'start', cols, rows }       建立 pty
 *          | { type: 'input', data }             键盘输入
 *          | { type: 'resize', cols, rows }      尺寸变化
 *          | { type: 'kill' }                    主动关闭
 *
 *   Server → { type: 'ready' }                   pty 已就绪
 *          | { type: 'output', data }            pty 输出（含 ANSI）
 *          | { type: 'exit', code, signal }      进程退出
 *          | { type: 'error', error }
 */

const WebSocket = require('ws')
const path = require('path')
const os = require('os')
const fs = require('fs')

// node-pty 是原生模块，失败时 bridge 不挂载但不影响主进程
let pty
try {
  pty = require('node-pty')
} catch (err) {
  console.warn('[free-code-ws] node-pty not available:', err.message)
}

const FREE_CODE_BIN =
  process.env.FREE_CODE_BIN ||
  '/Users/bornfly/Desktop/claude_code_learn/free-code/cli-dev'

const DEFAULT_CWD = process.env.FREE_CODE_CWD || os.homedir()

function attach(httpServer) {
  if (!pty) {
    console.warn('[free-code-ws] skipped (node-pty unavailable)')
    return null
  }

  // noServer mode + manual upgrade dispatch — avoids the ws-library bug where
  // multiple { server, path } WSS instances on one httpServer abort each other
  // on path mismatch. See: node_modules/ws/lib/websocket-server.js onServerUpgrade.
  const wss = new WebSocket.Server({ noServer: true })
  const WS_PATH = '/ws/free-code'

  httpServer.on('upgrade', (req, socket, head) => {
    try {
      const url = new URL(req.url, 'http://localhost')
      if (url.pathname !== WS_PATH) return
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req)
      })
    } catch { /* ignore — other listeners may handle */ }
  })

  wss.on('connection', (ws, req) => {
    const clientId = Math.random().toString(36).slice(2, 8)
    console.log(`[free-code-ws] connect id=${clientId} from ${req.socket.remoteAddress}`)

    let ptyProcess = null

    const send = (obj) => {
      if (ws.readyState === WebSocket.OPEN) {
        try { ws.send(JSON.stringify(obj)) } catch {}
      }
    }

    const spawnPty = (cols, rows) => {
      if (ptyProcess) return
      try {
        ptyProcess = pty.spawn(FREE_CODE_BIN, [], {
          name: 'xterm-256color',
          cols: cols || 120,
          rows: rows || 32,
          cwd: DEFAULT_CWD,
          env: {
            ...process.env,
            TERM: 'xterm-256color',
            COLORTERM: 'truecolor',
            FORCE_COLOR: '3',
          },
        })

        ptyProcess.onData((data) => send({ type: 'output', data }))
        ptyProcess.onExit(({ exitCode, signal }) => {
          send({ type: 'exit', code: exitCode, signal })
          ptyProcess = null
        })

        send({ type: 'ready' })
        console.log(`[free-code-ws] pty spawned id=${clientId} pid=${ptyProcess.pid}`)
      } catch (err) {
        send({ type: 'error', error: `spawn failed: ${err.message}` })
      }
    }

    ws.on('message', (raw) => {
      let msg
      try { msg = JSON.parse(raw) } catch {
        return send({ type: 'error', error: 'invalid json' })
      }

      switch (msg.type) {
        case 'start':
          spawnPty(msg.cols, msg.rows)
          break
        case 'input':
          if (ptyProcess && typeof msg.data === 'string') {
            ptyProcess.write(msg.data)
          }
          break
        case 'resize':
          if (ptyProcess && msg.cols && msg.rows) {
            try { ptyProcess.resize(msg.cols, msg.rows) } catch {}
          }
          break
        case 'kill':
          if (ptyProcess) {
            try { ptyProcess.kill() } catch {}
            ptyProcess = null
          }
          break
        default:
          send({ type: 'error', error: `unknown type: ${msg.type}` })
      }
    })

    ws.on('close', () => {
      console.log(`[free-code-ws] disconnect id=${clientId}`)
      if (ptyProcess) {
        try { ptyProcess.kill() } catch {}
        ptyProcess = null
      }
    })

    ws.on('error', (err) => {
      console.error(`[free-code-ws] error id=${clientId}: ${err.message}`)
    })
  })

  console.log(`[free-code-ws] ready at ws://localhost:3002/ws/free-code → ${FREE_CODE_BIN}`)
  return wss
}

module.exports = { attach }
