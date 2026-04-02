#!/usr/bin/env node
/**
 * server/lib/agent-daemon.js
 * Claude Code Agent 守护进程 — 在 tmux 会话中长期驻留
 *
 * 启动方式（由 code-agent.js 自动触发）：
 *   tmux new-session -d -s egonetics-coding-agent -x 220 -y 50
 *   tmux send-keys "node server/lib/agent-daemon.js" Enter
 *
 * ┌──────────────────────────────────────────────────────────────┐
 * │  tmux: egonetics-coding-agent                                │
 * │  [agent-daemon] 监听 /tmp/egonetics-agent.sock               │
 * │  [task] prvse-world-main ▶ "分析 PRVSE 宪法节点结构"          │
 * │  [T2]   claude --print --resume abc123 ...                   │
 * │  [流式]  正在读取 pages.db ... 发现 42 个节点 ...              │
 * │  [done] cost=$0.0038  duration=2.8s                          │
 * └──────────────────────────────────────────────────────────────┘
 *
 * IPC 协议（Unix socket，换行分隔 JSON）：
 *   → 客户端发送: { id, prompt, contextKey, model?, maxTurns?, resetCtx? }
 *   ← 守护进程返回（每行一个事件，透传 claude stream-json）:
 *       { id, type: 'stream_start', contextKey, sessionId }
 *       { id, type: 'user'|'assistant'|'tool_result'|'result'|..., ...event }
 *       { id, type: 'error', error: "..." }
 *       { id, type: 'stream_end' }
 */

'use strict'

const net    = require('net')
const fs     = require('fs')
const path   = require('path')
const { spawn }        = require('child_process')
const { createInterface } = require('readline')

// ── 路径常量 ──────────────────────────────────────────────────

const SOCKET_PATH   = process.env.AGENT_SOCKET   || '/tmp/egonetics-agent.sock'
const DATA_ROOT     = path.join(__dirname, '../data/code-agent')
const SESSIONS_FILE = path.join(DATA_ROOT, 'sessions.json')
const CLAUDE_BIN    = process.env.CLAUDE_BIN      || 'claude'
const PID_FILE      = '/tmp/egonetics-agent.pid'

// ── 终端颜色（在 tmux 里可见）─────────────────────────────────

const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  cyan:   '\x1b[36m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  orange: '\x1b[38;5;214m',
  red:    '\x1b[31m',
  gray:   '\x1b[90m',
  white:  '\x1b[97m',
}

function log(level, ...args) {
  const ts   = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const colors = { INFO: C.cyan, TASK: C.orange, TOOL: C.yellow, DONE: C.green, ERR: C.red, IDLE: C.gray }
  const color  = colors[level] ?? C.white
  console.log(`${C.dim}${ts}${C.reset} ${color}[${level}]${C.reset}`, ...args)
}

// ── 会话注册表 ────────────────────────────────────────────────

function loadSessions() {
  try {
    if (!fs.existsSync(SESSIONS_FILE)) return {}
    return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'))
  } catch { return {} }
}

function saveSessions(s) {
  fs.mkdirSync(DATA_ROOT, { recursive: true })
  fs.writeFileSync(SESSIONS_FILE + '.tmp', JSON.stringify(s, null, 2))
  fs.renameSync(SESSIONS_FILE + '.tmp', SESSIONS_FILE)
}

function getSessionId(contextKey) {
  return loadSessions()[contextKey] ?? null
}

function setSessionId(contextKey, sessionId) {
  const s = loadSessions()
  s[contextKey] = sessionId
  saveSessions(s)
}

// ── JSONL 持久化 ──────────────────────────────────────────────

function logPath(contextKey) {
  fs.mkdirSync(DATA_ROOT, { recursive: true })
  return path.join(DATA_ROOT, `${contextKey.replace(/[^a-zA-Z0-9_-]/g, '_')}.jsonl`)
}

function appendLog(contextKey, event) {
  fs.appendFileSync(logPath(contextKey), JSON.stringify({
    ...event, _ts: new Date().toISOString(),
  }) + '\n')
}

// ── 任务队列 ──────────────────────────────────────────────────

/** 当前是否有任务在执行（一次只跑一个，保证 tmux 输出清晰） */
let busy = false
const queue = []

/**
 * 每个 task: { id, prompt, contextKey, model, maxTurns, resetCtx, send }
 * send(event) → 往 socket 连接写事件
 */
function enqueue(task) {
  queue.push(task)
  drainQueue()
}

async function drainQueue() {
  if (busy || queue.length === 0) return
  busy = true
  const task = queue.shift()
  try {
    await runTask(task)
  } catch (err) {
    task.send({ id: task.id, type: 'error', error: err.message })
    log('ERR', task.contextKey, err.message)
  } finally {
    busy = false
    drainQueue()
  }
}

// ── 核心：执行一次 Claude 任务 ────────────────────────────────

async function runTask({ id, prompt, contextKey, model, maxTurns = 20, resetCtx = false, streamPartial = false, send }) {
  const sessionId = resetCtx ? null : getSessionId(contextKey)

  const args = [
    '--print',
    '--output-format', 'stream-json',
    '--verbose',
    '--dangerously-skip-permissions',
    '--max-turns', String(maxTurns),
  ]
  if (streamPartial) args.push('--include-partial-messages')
  if (sessionId)     args.push('--resume', sessionId)
  if (model)         args.push('--model', model)

  // ── 终端显示（在 tmux 里直接可见）──────────────────────────
  console.log('')
  log('TASK', `${C.bold}${contextKey}${C.reset} ▶ ${C.white}"${prompt.slice(0, 80)}"${C.reset}`)
  log('INFO', `claude ${args.filter(a => a !== '--print').join(' ')}`)

  // ── 通知客户端：流开始 ─────────────────────────────────────
  const startEvent = { id, type: 'stream_start', contextKey, sessionId }
  appendLog(contextKey, { type: 'user', content: prompt, contextKey, sessionId })
  send(startEvent)

  // ── spawn ───────────────────────────────────────────────────
  // 必须剔除 ANTHROPIC_API_KEY：CLI 走 Max 会员 OAuth，API key 存在时会覆盖认证 → 403
  const childEnv = { ...process.env }
  delete childEnv.ANTHROPIC_API_KEY
  const proc = spawn(CLAUDE_BIN, args, {
    cwd:   process.cwd(),
    stdio: ['pipe', 'pipe', 'pipe'],
    env:   childEnv,
  })
  proc.stdin.write(prompt)
  proc.stdin.end()

  let stderrBuf = ''
  proc.stderr.on('data', d => {
    stderrBuf += d.toString()
    process.stderr.write(`${C.gray}${d.toString()}${C.reset}`)
  })

  const rl = createInterface({ input: proc.stdout, crlfDelay: Infinity })

  for await (const line of rl) {
    const trimmed = line.trim()
    if (!trimmed) continue

    let event
    try { event = JSON.parse(trimmed) } catch { continue }

    // 持久化
    appendLog(contextKey, event)

    // 更新 session_id
    if (event.type === 'result' && event.session_id) {
      setSessionId(contextKey, event.session_id)
    }

    // ── 终端实时显示 ─────────────────────────────────────────
    if (event.type === 'assistant') {
      const content = event.message?.content ?? []
      const text = content.filter(c => c.type === 'text').map(c => c.text).join('')
      const tools = content.filter(c => c.type === 'tool_use')
      if (text) {
        process.stdout.write(`${C.white}${text}${C.reset}`)
      }
      for (const t of tools) {
        log('TOOL', `${C.yellow}${t.name}${C.reset}`, JSON.stringify(t.input).slice(0, 120))
      }
    }
    if (event.type === 'tool_result') {
      const ok = !event.is_error
      const contentStr = Array.isArray(event.content)
        ? event.content.filter(c => c.type === 'text').map(c => c.text).join('').slice(0, 200)
        : String(event.content ?? '').slice(0, 200)
      log(ok ? 'INFO' : 'ERR', `tool_result: ${contentStr}`)
    }
    if (event.type === 'result') {
      log('DONE',
        `cost=${C.green}$${(event.total_cost_usd ?? 0).toFixed(4)}${C.reset}`,
        `duration=${C.cyan}${((event.duration_ms ?? 0) / 1000).toFixed(1)}s${C.reset}`,
      )
    }

    // 转发给客户端
    send({ id, ...event })
  }

  // 等待进程退出
  await new Promise((resolve, reject) => {
    proc.on('close', code => {
      if (code !== 0 && stderrBuf) {
        const errEvent = { id, type: 'error', error: stderrBuf.slice(0, 500), code }
        appendLog(contextKey, { type: 'error', error: stderrBuf.slice(0, 500), code })
        send(errEvent)
        reject(new Error(stderrBuf.slice(0, 200)))
      } else {
        resolve(undefined)
      }
    })
    proc.on('error', reject)
  })

  send({ id, type: 'stream_end' })
  console.log('')
}

// ── Unix Socket 服务器 ────────────────────────────────────────

function startSocketServer() {
  // 清理残留 socket 文件
  if (fs.existsSync(SOCKET_PATH)) {
    try { fs.unlinkSync(SOCKET_PATH) } catch { /* ignore */ }
  }

  const server = net.createServer(socket => {
    log('INFO', `客户端连接 ${socket.remoteAddress ?? 'unix'}`)

    let buf = ''

    socket.on('data', data => {
      buf += data.toString()
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.trim()) continue
        let req
        try { req = JSON.parse(line) } catch { continue }

        const send = (event) => {
          if (!socket.destroyed) {
            socket.write(JSON.stringify(event) + '\n')
          }
        }

        enqueue({ ...req, send })
      }
    })

    socket.on('close', () => log('IDLE', '客户端断开'))
    socket.on('error', () => {})
  })

  server.listen(SOCKET_PATH, () => {
    fs.chmodSync(SOCKET_PATH, 0o600)
    log('INFO', `${C.bold}Agent Daemon 已启动${C.reset}  socket=${SOCKET_PATH}`)
    log('IDLE', '等待任务...')
  })

  server.on('error', err => {
    log('ERR', 'Socket 服务器错误:', err.message)
    process.exit(1)
  })
}

// ── 启动 ──────────────────────────────────────────────────────

// 写 PID 文件
fs.writeFileSync(PID_FILE, String(process.pid))

// 进程退出时清理
process.on('exit', () => {
  try { fs.unlinkSync(SOCKET_PATH) } catch { /* ignore */ }
  try { fs.unlinkSync(PID_FILE)    } catch { /* ignore */ }
})
process.on('SIGINT',  () => process.exit(0))
process.on('SIGTERM', () => process.exit(0))

console.clear()
console.log(`${C.bold}${C.orange}╔═══════════════════════════════════════════════════════╗${C.reset}`)
console.log(`${C.bold}${C.orange}║   Egonetics  Coding  Agent  Daemon                    ║${C.reset}`)
console.log(`${C.bold}${C.orange}╚═══════════════════════════════════════════════════════╝${C.reset}`)
console.log(`${C.dim}  PID: ${process.pid}  |  socket: ${SOCKET_PATH}${C.reset}`)
console.log('')

startSocketServer()
