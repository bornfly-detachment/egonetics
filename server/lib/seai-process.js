/**
 * server/lib/seai-process.js
 * SEAI 进程管理器 — 在 Egonetics 内部管理 SubjectiveEgoneticsAI 的生命周期
 *
 * 职责：
 *   - start()  : 启动 SEAI scripts/start.sh（内部激活 llama-factory venv）
 *   - stop()   : 优雅终止 SEAI 进程树
 *   - status() : 返回当前状态 + PID + uptime + 近期日志
 *   - 自动健康检查：每 10s ping localhost:8000/health
 *   - 环形日志缓冲：保留最近 200 条日志行
 */

const { spawn } = require('child_process')
const path = require('path')
const http = require('http')
const EventEmitter = require('events')

// ── 常量 ─────────────────────────────────────────────────────────

const SEAI_PROJECT_DIR = path.resolve(__dirname, '..', '..', 'SubjectiveEgoneticsAI')
const SEAI_START_SCRIPT = path.join(SEAI_PROJECT_DIR, 'scripts', 'start.sh')
const SEAI_HEALTH_URL = 'http://localhost:8000/health'
const HEALTH_INTERVAL_MS = 10_000
const STARTUP_POLL_INTERVAL_MS = 2_000
const STARTUP_TIMEOUT_MS = 60_000
const LOG_RING_SIZE = 200

// ── State ────────────────────────────────────────────────────────

/** @type {'stopped' | 'starting' | 'running' | 'error'} */
let _status = 'stopped'
let _pid = null
let _startedAt = null
/** @type {import('child_process').ChildProcess | null} */
let _proc = null
let _healthTimer = null
const _logs = []   // ring buffer

const emitter = new EventEmitter()

// ── Helpers ──────────────────────────────────────────────────────

function pushLog(line, stream = 'stdout') {
  const entry = { t: Date.now(), s: stream, m: line.trimEnd() }
  _logs.push(entry)
  if (_logs.length > LOG_RING_SIZE) _logs.shift()
  emitter.emit('log', entry)
}

function setStatus(s) {
  if (_status === s) return
  _status = s
  emitter.emit('status', s)
}

/** Ping SEAI health endpoint. Returns true if alive. */
function pingHealth() {
  return new Promise((resolve) => {
    const req = http.get(SEAI_HEALTH_URL, { timeout: 3000 }, (res) => {
      let body = ''
      res.on('data', d => { body += d })
      res.on('end', () => {
        try {
          const json = JSON.parse(body)
          resolve(json.status === 'ok')
        } catch {
          resolve(res.statusCode === 200)
        }
      })
    })
    req.on('error', () => resolve(false))
    req.on('timeout', () => { req.destroy(); resolve(false) })
  })
}

function startHealthCheck() {
  stopHealthCheck()
  _healthTimer = setInterval(async () => {
    if (_status === 'stopped') { stopHealthCheck(); return }
    const alive = await pingHealth()
    if (!alive && _status === 'running') {
      pushLog('[health] SEAI health check failed — marking as error', 'stderr')
      setStatus('error')
    } else if (alive && _status === 'error') {
      pushLog('[health] SEAI recovered', 'stdout')
      setStatus('running')
    }
  }, HEALTH_INTERVAL_MS)
}

function stopHealthCheck() {
  if (_healthTimer) { clearInterval(_healthTimer); _healthTimer = null }
}

/** Wait for SEAI to become healthy (up to STARTUP_TIMEOUT_MS). */
async function waitForHealthy() {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS
  while (Date.now() < deadline) {
    const alive = await pingHealth()
    if (alive) return true
    await new Promise(r => setTimeout(r, STARTUP_POLL_INTERVAL_MS))
  }
  return false
}

// ── Public API ───────────────────────────────────────────────────

/**
 * Start SEAI. Idempotent — if already running, returns immediately.
 * @returns {Promise<{ ok: boolean; message: string }>}
 */
async function start() {
  if (_status === 'running') return { ok: true, message: 'SEAI 已在运行' }
  if (_status === 'starting') return { ok: false, message: 'SEAI 正在启动中，请稍候' }

  // Check if already alive from a previous launch
  const alreadyAlive = await pingHealth()
  if (alreadyAlive) {
    setStatus('running')
    _startedAt = _startedAt ?? new Date()
    startHealthCheck()
    pushLog('[seai] 检测到 SEAI 已在运行，跳过启动')
    return { ok: true, message: 'SEAI 已在运行（外部进程）' }
  }

  setStatus('starting')
  pushLog(`[seai] 启动 SEAI: bash ${SEAI_START_SCRIPT}`)
  pushLog(`[seai] 工作目录: ${SEAI_PROJECT_DIR}`)

  try {
    _proc = spawn('bash', [SEAI_START_SCRIPT], {
      cwd: SEAI_PROJECT_DIR,
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    _pid = _proc.pid
    pushLog(`[seai] 进程已启动 PID=${_pid}`)

    _proc.stdout.on('data', d => {
      for (const line of d.toString().split('\n')) {
        if (line.trim()) pushLog(line)
      }
    })
    _proc.stderr.on('data', d => {
      for (const line of d.toString().split('\n')) {
        if (line.trim()) pushLog(line, 'stderr')
      }
    })

    _proc.on('exit', (code, signal) => {
      pushLog(`[seai] 进程退出 code=${code} signal=${signal}`, 'stderr')
      _proc = null; _pid = null
      stopHealthCheck()
      setStatus(code === 0 || signal === 'SIGTERM' ? 'stopped' : 'error')
    })

    _proc.on('error', (err) => {
      pushLog(`[seai] spawn 错误: ${err.message}`, 'stderr')
      setStatus('error')
    })
  } catch (err) {
    setStatus('error')
    pushLog(`[seai] 启动失败: ${err.message}`, 'stderr')
    return { ok: false, message: `启动失败: ${err.message}` }
  }

  // Wait for health
  pushLog('[seai] 等待服务就绪（最多 60s）…')
  const healthy = await waitForHealthy()
  if (healthy) {
    _startedAt = new Date()
    setStatus('running')
    startHealthCheck()
    pushLog('[seai] ✅ SEAI 服务就绪 http://localhost:8000')
    return { ok: true, message: 'SEAI 启动成功' }
  } else {
    setStatus('error')
    pushLog('[seai] ❌ 超时：SEAI 未能在 60s 内就绪', 'stderr')
    return { ok: false, message: '启动超时（60s），请检查日志' }
  }
}

/**
 * Stop SEAI gracefully.
 * @returns {{ ok: boolean; message: string }}
 */
function stop() {
  stopHealthCheck()
  if (!_proc) {
    setStatus('stopped')
    return { ok: true, message: 'SEAI 未在运行' }
  }
  pushLog('[seai] 正在停止 SEAI…')
  try {
    _proc.kill('SIGTERM')
    return { ok: true, message: '已发送停止信号' }
  } catch (err) {
    return { ok: false, message: `停止失败: ${err.message}` }
  }
}

/**
 * Current status snapshot.
 */
function status() {
  const uptimeSeconds = _startedAt ? Math.floor((Date.now() - _startedAt.getTime()) / 1000) : null
  return {
    status: _status,
    pid: _pid,
    uptimeSeconds,
    recentLogs: _logs.slice(-50),
  }
}

// ── On exit, stop SEAI ───────────────────────────────────────────

process.on('exit', () => { try { stop() } catch {} })
process.on('SIGTERM', () => { stop(); process.exit(0) })
process.on('SIGINT', () => { stop(); process.exit(0) })

module.exports = { start, stop, status, emitter, pingHealth }
