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
const fs = require('fs')
const path = require('path')
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

// ── Tier registry (loaded from server/config/free-code-tiers.json) ──

const TIERS_CONFIG_PATH = path.join(__dirname, '..', 'config', 'free-code-tiers.json')
let _tiersCache = null
let _tiersCacheMtime = 0

/**
 * Load tier definitions from config file, with mtime-based cache invalidation.
 * Each tier declares:
 *   - env: key-value pairs injected via `tmux new-session -e KEY=VAL`
 *   - session_prefix: used in tmux session name for per-tier isolation
 *   - enabled: whether the tier can be used (disabled tiers throw on spawn)
 */
function loadTiers() {
  try {
    const stat = fs.statSync(TIERS_CONFIG_PATH)
    if (_tiersCache && stat.mtimeMs === _tiersCacheMtime) return _tiersCache
    const raw = fs.readFileSync(TIERS_CONFIG_PATH, 'utf8')
    _tiersCache = JSON.parse(raw)
    _tiersCacheMtime = stat.mtimeMs
    return _tiersCache
  } catch (err) {
    console.warn('[harness-runner] failed to load tier config:', err.message)
    return { default_tier: 'T2', tiers: {} }
  }
}

/** Get a tier definition by id. Throws if tier doesn't exist or is disabled. */
function resolveTier(tierId) {
  const cfg = loadTiers()
  const tier = cfg.tiers[tierId]
  if (!tier) {
    throw new Error(`Unknown tier: ${tierId}. Available: ${Object.keys(cfg.tiers).join(', ')}`)
  }
  if (tier.enabled === false) {
    throw new Error(`Tier ${tierId} is disabled: ${tier.not_ready_reason || 'no reason given'}`)
  }
  return tier
}

/** List all tiers as {id, label, enabled, description, ...} for UI consumption. */
function listTiers() {
  const cfg = loadTiers()
  return {
    default_tier: cfg.default_tier,
    tiers: Object.values(cfg.tiers).map((t) => ({
      id: t.id,
      label: t.label,
      description: t.description,
      color: t.color,
      enabled: t.enabled !== false,
      not_ready_reason: t.not_ready_reason || null,
      model_hint: t.model_hint,
    })),
  }
}

/** Expand ~ in paths to the spawned user's home. Kept simple for MVP. */
function expandTilde(p, homeDir) {
  if (!p) return p
  if (p === '~') return homeDir
  if (p.startsWith('~/')) return path.join(homeDir, p.slice(2))
  return p
}

/**
 * Build the env vars to inject into the tmux session for a given tier.
 * Base vars (TERM/COLORTERM/FORCE_COLOR) apply to all tiers.
 * Tier-specific vars come from free-code-tiers.json.
 */
function buildTierEnv(tier, homeDir) {
  const base = {
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    FORCE_COLOR: '3',
  }
  const tierEnv = {}
  for (const [k, v] of Object.entries(tier.env || {})) {
    // Expand ~ in FREE_CODE_CONFIG_DIR and other path vars
    tierEnv[k] = typeof v === 'string' ? expandTilde(v, homeDir) : v
  }
  return { ...base, ...tierEnv }
}

/**
 * Slugify a cwd path for use in tmux session names.
 * `/Users/Shared/prvse_world_workspace/L2` → `Users-Shared-prvse_world_workspace-L2`
 */
function slugifyCwd(cwd) {
  return cwd.replace(/^\//, '').replace(/\//g, '-').slice(0, 80)
}

/**
 * Build a tier+cwd-qualified tmux session name.
 * Format: `<tier_prefix>-<cwd_slug>`
 * Example: `freecode-t2-Users-Shared-prvse_world_workspace-L2`
 */
function buildSessionName(tier, cwd) {
  return `${tier.session_prefix}-${slugifyCwd(cwd)}`
}

/**
 * Build the (command, args) pair to spawn a tmux session for a harness,
 * optionally wrapped in `sudo -u` for user isolation.
 *
 * @param {Object} opts
 * @param {string} opts.tierId          - Tier id ('T0' | 'T1' | 'T2')
 * @param {'L0'|'L1'|'L2'} opts.level   - Security level for the spawned process
 * @param {string} opts.tmuxSocket       - tmux -L socket name
 * @param {string} opts.tmuxConfig       - tmux -f config file path
 * @param {string} opts.cwd              - working directory
 * @param {string} opts.binary           - absolute path to harness binary
 * @returns {{ command, args, effectiveUser, isolated, env, tier, sessionName }}
 */
function buildTmuxSpawn(opts) {
  const { tierId, tmuxSocket, tmuxConfig, cwd, binary } = opts

  // Resolve tier (throws if unknown or disabled)
  const tier = resolveTier(tierId)

  // Per-tier spawn_user decides isolation:
  //   - null    → run as host user (bornfly)
  //   - 'egonetics-lX' → sudo -u to that service user
  // This is orthogonal to the OS-level isolation infrastructure; a tier
  // can opt out of isolation if it needs host-level access (e.g., Keychain).
  const spawnUser = tier.spawn_user || null
  const wantsIsolation = spawnUser !== null
  const isolationStatus = wantsIsolation ? detectIsolation() : { enabled: false, reason: 'tier does not request isolation' }
  const willIsolate = wantsIsolation && isolationStatus.enabled

  // HOME expansion target
  const homeDir = willIsolate
    ? `/var/egonetics/${spawnUser.replace('egonetics-', '')}-home`
    : os.homedir()

  const envVars = buildTierEnv(tier, homeDir)
  const envArgs = []
  for (const [k, v] of Object.entries(envVars)) {
    envArgs.push('-e', `${k}=${v}`)
  }

  // Per-tier session name: same cwd with different tier → different session
  const sessionName = buildSessionName(tier, cwd)

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
      tier: { id: tier.id, label: tier.label },
      sessionName,
    }
  }

  return {
    command: 'sudo',
    // -n: non-interactive (no password prompt, fail fast if NOPASSWD missing)
    // -H: set HOME to target user's home (/var/egonetics/lX-home)
    // -u: target user
    args: ['-n', '-H', '-u', targetUser, 'tmux', ...tmuxArgs],
    effectiveUser: targetUser,
    isolated: true,
    env: envVars,
    tier: { id: tier.id, label: tier.label },
    sessionName,
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
  buildSessionName,
  getIsolationStatus,
  validateCwdForLevel,
  listTiers,
  resolveTier,
  loadTiers,
  LEVEL_USERS,
  WORKSPACE_ROOT,
}
