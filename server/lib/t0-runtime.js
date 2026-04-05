/**
 * server/lib/t0-runtime.js
 *
 * T0 推理运行时 — 管理本地 mlx_lm.server 子进程的生命周期。
 *
 * 启动: python3 -m mlx_lm.server --model <MODEL_PATH> --port <T0_PORT>
 * 健康检查: GET http://localhost:<T0_PORT>/health
 *
 * 对外接口:
 *   ensureRunning()  → Promise<void>  — 确保进程在线，若未启动则启动
 *   isReady()        → boolean        — 当前是否就绪
 *   getBaseUrl()     → string         — 推理服务地址
 *   shutdown()       → void           — 主动关闭子进程
 */

'use strict'

const { spawn } = require('child_process')

// ── Config ────────────────────────────────────────────────────────────────────

const T0_PORT      = parseInt(process.env.T0_INFERENCE_PORT || '8100', 10)
const MODEL_PATH   = process.env.T0_MODEL_PATH || '/Users/bornfly/Desktop/qwen-edge-llm/model_weights/Qwen/Qwen3.5-0.8B'
const PYTHON_BIN   = process.env.T0_PYTHON || '/Users/bornfly/llama-factory/venv/bin/python'
const BASE_URL     = `http://localhost:${T0_PORT}`
const HEALTH_URL   = `${BASE_URL}/health`
const STARTUP_WAIT = 15000  // ms — model loading takes time

// ── State ─────────────────────────────────────────────────────────────────────

let _proc    = null
let _ready   = false
let _starting = false

// ── Helpers ───────────────────────────────────────────────────────────────────

async function _ping() {
  try {
    const resp = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(2000) })
    return resp.ok
  } catch {
    return false
  }
}

function _sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function _waitReady(maxMs = STARTUP_WAIT) {
  const deadline = Date.now() + maxMs
  while (Date.now() < deadline) {
    if (await _ping()) return true
    await _sleep(500)
  }
  return false
}

// ── Runtime ───────────────────────────────────────────────────────────────────

async function ensureRunning() {
  if (_ready && await _ping()) return
  if (_starting) {
    // 等待另一个启动流程完成
    const deadline = Date.now() + STARTUP_WAIT + 2000
    while (_starting && Date.now() < deadline) await _sleep(200)
    return
  }

  _starting = true
  _ready    = false

  // 若已有残留进程，先杀掉
  if (_proc) {
    try { _proc.kill() } catch { /* ignore */ }
    _proc = null
  }

  console.log(`[T0 Runtime] Starting mlx_lm.server — model: ${MODEL_PATH} port: ${T0_PORT}`)

  _proc = spawn(PYTHON_BIN, [
    '-m', 'mlx_lm.server',
    '--model', MODEL_PATH,
    '--port',  String(T0_PORT),
  ], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env:   process.env,
  })

  _proc.stdout.on('data', d => process.stdout.write(`[T0] ${d}`))
  _proc.stderr.on('data', d => process.stderr.write(`[T0] ${d}`))

  _proc.once('exit', (code) => {
    console.warn(`[T0 Runtime] Process exited (code=${code})`)
    _proc  = null
    _ready = false
  })

  _proc.once('error', (err) => {
    console.error(`[T0 Runtime] Spawn error: ${err.message}`)
    _proc     = null
    _ready    = false
    _starting = false
  })

  const ok = await _waitReady()
  _ready    = ok
  _starting = false

  if (!ok) {
    console.error('[T0 Runtime] Failed to start within timeout')
    try { _proc?.kill() } catch { /* ignore */ }
    _proc = null
    throw new Error('T0 runtime failed to start')
  }

  console.log(`[T0 Runtime] Ready at ${BASE_URL}`)
}

function isReady() { return _ready }
function getBaseUrl() { return BASE_URL }

function shutdown() {
  if (_proc) {
    console.log('[T0 Runtime] Shutting down')
    try { _proc.kill() } catch { /* ignore */ }
    _proc  = null
    _ready = false
  }
}

// 进程退出时清理
process.once('exit',    shutdown)
process.once('SIGINT',  shutdown)
process.once('SIGTERM', shutdown)

module.exports = { ensureRunning, isReady, getBaseUrl, shutdown, T0_PORT, BASE_URL }
