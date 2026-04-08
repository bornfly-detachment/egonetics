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
// Use venv Python (lightweight), NOT anaconda (2GB startup overhead).
// User manages mlx_lm.server lifecycle manually; runtime is a CONNECTOR, not a launcher.
const PYTHON_BIN   = process.env.T0_PYTHON || '/Users/bornfly/llama-factory/venv/bin/python3'
const BASE_URL     = `http://localhost:${T0_PORT}`
const PING_URL     = `${BASE_URL}/v1/models`

// ── State ─────────────────────────────────────────────────────────────────────

let _ready   = false

// ── Helpers ───────────────────────────────────────────────────────────────────

async function _ping() {
  try {
    const resp = await fetch(PING_URL, { signal: AbortSignal.timeout(2000) })
    return resp.ok
  } catch {
    return false
  }
}

// ── Runtime ───────────────────────────────────────────────────────────────────

/**
 * Check that mlx_lm.server is reachable on T0_PORT.
 * Does NOT spawn a process — the user starts mlx_lm.server manually.
 * This prevents zombie Python processes from repeated spawn-crash cycles.
 */
async function ensureRunning() {
  if (_ready && await _ping()) return

  const alive = await _ping()
  if (alive) {
    if (!_ready) console.log(`[T0 Runtime] Connected to existing server at ${BASE_URL}`)
    _ready = true
    return
  }

  _ready = false
  throw new Error(
    `T0 server not running on port ${T0_PORT}. ` +
    `Start it manually: mlx_lm.server --model ${MODEL_PATH} --port ${T0_PORT}`
  )
}

function isReady() { return _ready }
function getBaseUrl() { return BASE_URL }
function shutdown() { _ready = false }

module.exports = { ensureRunning, isReady, getBaseUrl, shutdown, T0_PORT, BASE_URL }
