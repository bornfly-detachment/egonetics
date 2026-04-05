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

// Harness runner: wraps spawn with optional sudo -u level isolation
const harnessRunner = require('../lib/harness-runner')

const FREE_CODE_BIN =
  process.env.FREE_CODE_BIN ||
  '/Users/bornfly/Desktop/claude_code_learn/free-code/cli-dev'

const DEFAULT_CWD = process.env.FREE_CODE_CWD || os.homedir()

// Isolated tmux socket — our freecode sessions live on a dedicated server,
// completely separate from the user's default tmux (incl. egonetics-coding-agent).
const TMUX_SOCKET = 'egonetics-freecode'
// NOT os.tmpdir() — that resolves to /var/folders/<uid>/T/ which is per-user-private
// on macOS (darwin user temp dir), so isolated agents (egonetics-lX) can't read it.
// /Users/Shared is world-traversable; file itself is world-readable.
const TMUX_CONFIG_DIR = '/Users/Shared/egonetics'
const TMUX_CONFIG = path.join(TMUX_CONFIG_DIR, 'freecode.tmux.conf')

// Write a minimal tmux config on first use. Status bar off so free-code's own
// status line (Claude Max · model · context) is visible on the bottom row.
function ensureTmuxConfig() {
  const content = [
    '# egonetics free-code embed — managed file, do not edit',
    'set -g status off',
    'set -g default-terminal "xterm-256color"',
    'set -ga terminal-overrides ",xterm-256color:Tc"',
    'set -g mouse on',
    'set -g history-limit 50000',
    'set -g escape-time 0',
    'set -g focus-events on',
    '',
  ].join('\n')
  try {
    // Ensure config dir exists with world-readable perms so isolated agents can read it
    if (!fs.existsSync(TMUX_CONFIG_DIR)) {
      fs.mkdirSync(TMUX_CONFIG_DIR, { recursive: true, mode: 0o755 })
    }
    if (!fs.existsSync(TMUX_CONFIG) || fs.readFileSync(TMUX_CONFIG, 'utf8') !== content) {
      fs.writeFileSync(TMUX_CONFIG, content, { encoding: 'utf8', mode: 0o644 })
    }
    // Force 644 in case file was previously written with restrictive perms
    fs.chmodSync(TMUX_CONFIG, 0o644)
  } catch (err) {
    console.warn('[free-code-ws] tmux config write failed:', err.message)
  }
}

/** Validate a cwd candidate. Returns resolved absolute path or null. */
function validateCwd(candidate) {
  if (!candidate || typeof candidate !== 'string') return null
  try {
    const resolved = path.resolve(candidate.replace(/^~/, os.homedir()))
    const stat = fs.statSync(resolved)
    if (!stat.isDirectory()) return null
    return resolved
  } catch {
    return null
  }
}

/** Derive a stable tmux session name from a cwd. One session per cwd. */
function tmuxSessionName(cwd) {
  const slug = cwd
    .replace(/^\//, '')
    .replace(/\//g, '-')
    .replace(/[^\w\-]/g, '_')
    .slice(0, 80)
  return `freecode-${slug}`
}

/** Check that tmux is installed; return version string or null. */
function detectTmux() {
  try {
    const { execSync } = require('child_process')
    return execSync('tmux -V', { encoding: 'utf8' }).trim()
  } catch {
    return null
  }
}

function attach(httpServer) {
  if (!pty) {
    console.warn('[free-code-ws] skipped (node-pty unavailable)')
    return null
  }
  const tmuxVersion = detectTmux()
  if (!tmuxVersion) {
    console.warn('[free-code-ws] skipped (tmux not installed)')
    return null
  }
  ensureTmuxConfig()
  const iso = harnessRunner.getIsolationStatus()
  console.log(`[free-code-ws] tmux: ${tmuxVersion} (socket=${TMUX_SOCKET})`)
  if (iso.enabled) {
    console.log('[free-code-ws] user isolation: ENABLED (egonetics-l0/l1/l2)')
  } else {
    console.log(`[free-code-ws] user isolation: DISABLED — ${iso.reason}`)
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

    let sessionName = null
    let currentTier = null

    const spawnPty = (cols, rows, cwdCandidate, tierIdRaw) => {
      if (ptyProcess) return
      const cwd = validateCwd(cwdCandidate) || DEFAULT_CWD

      // Tier selection: default 'T2' when client doesn't specify
      const tiersCfg = harnessRunner.loadTiers()
      const tierId = tierIdRaw || tiersCfg.default_tier || 'T2'

      // harness-runner generates tier-qualified session name + env + spawn plan
      try {
        const spawnPlan = harnessRunner.buildTmuxSpawn({
          tierId,
          tmuxSocket: TMUX_SOCKET,
          tmuxConfig: TMUX_CONFIG,
          cwd,
          binary: FREE_CODE_BIN,
        })
        sessionName = spawnPlan.sessionName
        currentTier = spawnPlan.tier

        ptyProcess = pty.spawn(
          spawnPlan.command,
          spawnPlan.args,
          {
            name: 'xterm-256color',
            cols: cols || 120,
            rows: rows || 32,
            cwd,
            env: {
              ...process.env,
              TERM: 'xterm-256color',
              COLORTERM: 'truecolor',
              FORCE_COLOR: '3',
            },
          },
        )

        ptyProcess.onData((data) => send({ type: 'output', data }))
        ptyProcess.onExit(({ exitCode, signal }) => {
          // This fires when the tmux CLIENT exits (detach). The tmux daemon
          // keeps the session alive unless the user explicitly killed it.
          send({ type: 'exit', code: exitCode, signal })
          ptyProcess = null
        })

        send({
          type: 'ready',
          cwd,
          session: sessionName,
          tier: currentTier,
          isolation: {
            isolated: spawnPlan.isolated,
            user: spawnPlan.effectiveUser,
            fallbackReason: spawnPlan.fallbackReason || null,
          },
        })
        const tag = spawnPlan.isolated
          ? `as ${spawnPlan.effectiveUser}`
          : `direct (${spawnPlan.fallbackReason})`
        console.log(`[free-code-ws] spawned id=${clientId} pid=${ptyProcess.pid} tier=${currentTier.id} session=${sessionName} cwd=${cwd} ${tag}`)
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
          spawnPty(msg.cols, msg.rows, msg.cwd, msg.tier)
          break
        case 'restart':
          if (ptyProcess) {
            try { ptyProcess.kill() } catch {}
            ptyProcess = null
          }
          // respawn with new cwd+tier after short delay so exit is observed cleanly
          setTimeout(() => spawnPty(msg.cols, msg.rows, msg.cwd, msg.tier), 100)
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
      console.log(`[free-code-ws] disconnect id=${clientId} (detaching tmux client, session "${sessionName}" stays alive)`)
      if (ptyProcess) {
        // Killing the node-pty process kills only the tmux CLIENT.
        // The tmux DAEMON preserves the session and the free-code process
        // running inside it. Next connect will reattach with full state.
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
