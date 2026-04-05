/**
 * server/lib/harness-runner.js
 *
 * Harness spawn wrapper with L0/L1/L2 user isolation.
 *
 * Design:
 *   - Backend (Node) runs as bornfly (main user) with full filesystem access
 *   - Harness Agents (free-code, codex, gemini-cli, ...) must spawn as a
 *     lower-privilege service user to enforce POSIX-level filesystem isolation
 *   - `sudo -u egonetics-lX` is the mechanism to drop privileges before exec
 *   - User isolation requires Phase 1 setup completed: groups, users, sudoers rule
 *
 * Feature flag:
 *   USE_USER_ISOLATION=true   → spawn via sudo -u egonetics-l<level>
 *   USE_USER_ISOLATION=false  → spawn directly as bornfly (legacy fallback)
 *
 * Default: enabled if the 3 service users exist, disabled otherwise.
 */

'use strict'

const { execSync } = require('child_process')
const os = require('os')

// ── Level → service user mapping ────────────────────────────
const LEVEL_USERS = Object.freeze({
  L0: 'egonetics-l0',
  L1: 'egonetics-l1',
  L2: 'egonetics-l2',
})

// ── Workspace gateway roots (per platform) ──────────────────
const PLATFORM = os.platform()
const WORKSPACE_ROOT =
  process.env.EGONETICS_WORKSPACE ||
  (PLATFORM === 'darwin'
    ? '/Users/Shared/prvse_world_workspace'
    : '/srv/egonetics/prvse_world_workspace')

// ── Detect isolation availability ───────────────────────────

/** Check whether a given OS user exists. */
function userExists(username) {
  try {
    execSync(`id -u ${username}`, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/**
 * Check whether `sudo -n -u <user> tmux -V` works (NOPASSWD rule in place).
 * We probe the actual binary we'll run (tmux) — probing with `true` would
 * fail because only tmux is in the sudoers allowlist.
 */
function sudoWorks(username) {
  try {
    // Find tmux absolute path (same one sudoers references)
    const tmuxPath = execSync('command -v tmux', { encoding: 'utf8' }).trim()
    if (!tmuxPath) return false
    execSync(`sudo -n -u ${username} ${tmuxPath} -V`, { stdio: 'ignore', timeout: 2000 })
    return true
  } catch {
    return false
  }
}

let _isolationStatus = null

function detectIsolation() {
  if (_isolationStatus) return _isolationStatus

  const flag = process.env.USE_USER_ISOLATION
  if (flag === 'false' || flag === '0') {
    _isolationStatus = { enabled: false, reason: 'disabled via USE_USER_ISOLATION env' }
    return _isolationStatus
  }

  const missing = Object.values(LEVEL_USERS).filter((u) => !userExists(u))
  if (missing.length > 0) {
    _isolationStatus = {
      enabled: false,
      reason: `service users missing: ${missing.join(', ')} (run scripts/setup-egonetics-users.sh)`,
    }
    return _isolationStatus
  }

  // Probe that sudo NOPASSWD actually works (only need to check one level)
  if (!sudoWorks('egonetics-l2')) {
    _isolationStatus = {
      enabled: false,
      reason: 'sudoers NOPASSWD rule not in effect (is /etc/sudoers.d/egonetics installed?)',
    }
    return _isolationStatus
  }

  // If explicitly requested OR default-on
  _isolationStatus = { enabled: true, reason: 'users + sudoers OK' }
  return _isolationStatus
}

/** Get current isolation status, useful for health endpoints and logging. */
function getIsolationStatus() {
  return detectIsolation()
}

// ── Spawn command builder ───────────────────────────────────

/**
 * Environment variables injected into every isolated harness session.
 * These are passed via `tmux new-session -e KEY=VAL` which does NOT require
 * sudoers SETENV flag — they're set at the tmux session level, and the
 * spawned harness (free-code) inherits them.
 *
 * Why not preserve env via sudo: sudo by default strips env for security;
 * `sudo -E` or env_keep require sudoers changes. tmux -e is the clean path.
 */
const PROXY_PORT = process.env.EGONETICS_BACKEND_PORT || '3002'
const PROXY_BASE_URL = `http://127.0.0.1:${PROXY_PORT}/proxy/anthropic`

function buildIsolationEnv() {
  return {
    // Route Anthropic SDK calls through our proxy instead of direct to api.anthropic.com
    ANTHROPIC_BASE_URL: PROXY_BASE_URL,
    // Agent sees a dummy token; real credentials live in backend process memory only.
    // The proxy ignores this value and injects the real key from its own env.
    ANTHROPIC_API_KEY: 'sess-isolated-harness',
    // free-code reads these for TUI rendering
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    FORCE_COLOR: '3',
  }
}

/**
 * Build the (command, args) pair to spawn a tmux session for a harness,
 * optionally wrapped in `sudo -u` for user isolation.
 *
 * @param {Object} opts
 * @param {'L0'|'L1'|'L2'} opts.level   - Security level for the spawned process
 * @param {string} opts.tmuxSocket       - tmux -L socket name
 * @param {string} opts.tmuxConfig       - tmux -f config file path
 * @param {string} opts.sessionName      - tmux session name
 * @param {string} opts.cwd              - working directory
 * @param {string} opts.binary           - absolute path to harness binary
 * @returns {{ command: string, args: string[], effectiveUser: string, isolated: boolean, env: object }}
 */
function buildTmuxSpawn(opts) {
  const { level, tmuxSocket, tmuxConfig, sessionName, cwd, binary } = opts

  if (!LEVEL_USERS[level]) {
    throw new Error(`Unknown isolation level: ${level} (expected L0|L1|L2)`)
  }

  const envVars = buildIsolationEnv()
  // Flatten env vars into tmux -e KEY=VAL pairs
  const envArgs = []
  for (const [k, v] of Object.entries(envVars)) {
    envArgs.push('-e', `${k}=${v}`)
  }

  const tmuxArgs = [
    '-L', tmuxSocket,
    '-f', tmuxConfig,
    'new-session', '-A',
    ...envArgs,
    '-s', sessionName,
    '-c', cwd,
    binary,
  ]

  const status = detectIsolation()

  if (!status.enabled) {
    return {
      command: 'tmux',
      args: tmuxArgs,
      effectiveUser: os.userInfo().username,
      isolated: false,
      fallbackReason: status.reason,
      env: envVars,
    }
  }

  const targetUser = LEVEL_USERS[level]
  return {
    command: 'sudo',
    // -n: non-interactive (no password prompt, fail fast if NOPASSWD missing)
    // -H: set HOME to target user's home (/var/egonetics/lX-home)
    // -u: target user
    args: ['-n', '-H', '-u', targetUser, 'tmux', ...tmuxArgs],
    effectiveUser: targetUser,
    isolated: true,
    env: envVars,
  }
}

/** Validate that a cwd is allowed for a given level based on workspace gateway. */
function validateCwdForLevel(level, cwd) {
  // For now: L0 can access anything under WORKSPACE_ROOT/L0,
  //          L1 can access L0 and L1 subtrees,
  //          L2 can access all three.
  // Outside the workspace: only L2 (backend-authored) can access arbitrary paths.
  const allowedSubtrees = {
    L0: [`${WORKSPACE_ROOT}/L0`],
    L1: [`${WORKSPACE_ROOT}/L0`, `${WORKSPACE_ROOT}/L1`],
    L2: [`${WORKSPACE_ROOT}/L0`, `${WORKSPACE_ROOT}/L1`, `${WORKSPACE_ROOT}/L2`],
  }[level] || []

  for (const subtree of allowedSubtrees) {
    if (cwd === subtree || cwd.startsWith(subtree + '/')) return true
  }

  // TODO(phase-1.5): tighten this. For now, fall back to allow anywhere for L2
  // so current workflows (e.g., cwd in /tmp for testing) still work.
  if (level === 'L2') return true

  return false
}

// ── Exports ─────────────────────────────────────────────────
module.exports = {
  buildTmuxSpawn,
  getIsolationStatus,
  validateCwdForLevel,
  LEVEL_USERS,
  WORKSPACE_ROOT,
}
