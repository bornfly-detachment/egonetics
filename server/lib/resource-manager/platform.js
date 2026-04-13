/**
 * ai-resource-manager/platform.js
 *
 * 跨平台资源探测器 — macOS / Linux / 可扩展
 *
 * 职责：只读采集，不做决策。返回原始数据，由 allocator.js 决策。
 *
 * 接口：
 *   detect()        → { ram, swap, cpu, platform, processes }
 *   detectProcess() → { pid, rss, command }[]
 */

'use strict'

const os = require('os')
const { execSync } = require('child_process')

// ── 平台标识 ─────────────────────────────────────────────────────

const PLATFORM = os.platform()  // 'darwin' | 'linux' | 'win32'

// ── RAM ──────────────────────────────────────────────────────────

function detectRam() {
  const totalBytes = os.totalmem()
  const freeBytes = os.freemem()

  const result = {
    totalMb: Math.round(totalBytes / 1024 / 1024),
    freeMb: Math.round(freeBytes / 1024 / 1024),
    usedMb: Math.round((totalBytes - freeBytes) / 1024 / 1024),
    pressure: (totalBytes - freeBytes) / totalBytes,
  }

  // macOS: vm_stat gives more accurate breakdown (active/inactive/wired/compressed)
  if (PLATFORM === 'darwin') {
    try {
      const vmstat = execSync('vm_stat', { encoding: 'utf8', timeout: 2000 })
      const pageSize = parseInt((vmstat.match(/page size of (\d+)/) || [])[1] || '16384', 10)
      const parse = (label) => {
        const m = vmstat.match(new RegExp(`${label}:\\s+(\\d+)`))
        return m ? parseInt(m[1], 10) * pageSize / 1024 / 1024 : 0
      }
      result.active = Math.round(parse('Pages active'))
      result.inactive = Math.round(parse('Pages inactive'))
      result.wired = Math.round(parse('Pages wired down'))
      result.compressed = Math.round(parse('Pages occupied by compressor'))
      result.purgeable = Math.round(parse('Pages purgeable'))
      // Effective available = free + inactive + purgeable (can be reclaimed without swap)
      result.reclaimableMb = result.freeMb + result.inactive + result.purgeable
    } catch { /* fallback to os.freemem */ }
  }

  // Linux: /proc/meminfo gives MemAvailable (kernel's estimate of reclaimable memory)
  if (PLATFORM === 'linux') {
    try {
      const meminfo = execSync('cat /proc/meminfo', { encoding: 'utf8', timeout: 2000 })
      const parseMi = (label) => {
        const m = meminfo.match(new RegExp(`${label}:\\s+(\\d+)`))
        return m ? parseInt(m[1], 10) / 1024 : 0
      }
      result.available = Math.round(parseMi('MemAvailable'))
      result.buffers = Math.round(parseMi('Buffers'))
      result.cached = Math.round(parseMi('Cached'))
      result.reclaimableMb = result.available || (result.freeMb + result.buffers + result.cached)
    } catch { /* fallback */ }
  }

  // Fallback: reclaimable ≈ free
  if (!result.reclaimableMb) {
    result.reclaimableMb = result.freeMb
  }

  return result
}

// ── Swap ─────────────────────────────────────────────────────────

function detectSwap() {
  const result = { totalMb: 0, usedMb: 0, freeMb: 0, pressure: 0 }

  if (PLATFORM === 'darwin') {
    try {
      const raw = execSync('sysctl vm.swapusage', { encoding: 'utf8', timeout: 2000 })
      const parseVal = (label) => {
        const m = raw.match(new RegExp(`${label} = ([\\d.]+)M`))
        return m ? parseFloat(m[1]) : 0
      }
      result.totalMb = Math.round(parseVal('total'))
      result.usedMb = Math.round(parseVal('used'))
      result.freeMb = Math.round(parseVal('free'))
    } catch { /* ignore */ }
  }

  if (PLATFORM === 'linux') {
    try {
      const meminfo = execSync('cat /proc/meminfo', { encoding: 'utf8', timeout: 2000 })
      const parseMi = (label) => {
        const m = meminfo.match(new RegExp(`${label}:\\s+(\\d+)`))
        return m ? parseInt(m[1], 10) / 1024 : 0
      }
      result.totalMb = Math.round(parseMi('SwapTotal'))
      result.freeMb = Math.round(parseMi('SwapFree'))
      result.usedMb = result.totalMb - result.freeMb
    } catch { /* ignore */ }
  }

  result.pressure = result.totalMb > 0 ? result.usedMb / result.totalMb : 0
  return result
}

// ── CPU ──────────────────────────────────────────────────────────

function detectCpu() {
  const cpus = os.cpus()
  const result = {
    cores: cpus.length,
    model: cpus[0]?.model || 'unknown',
    arch: os.arch(),
  }

  // Load average (1/5/15 min) — works on both macOS and Linux
  const loadavg = os.loadavg()
  result.load1m = Math.round(loadavg[0] * 100) / 100
  result.load5m = Math.round(loadavg[1] * 100) / 100
  result.load15m = Math.round(loadavg[2] * 100) / 100
  result.loadPressure = loadavg[0] / cpus.length  // >1 means overloaded

  return result
}

// ── Process list (AI-related) ────────────────────────────────────

/**
 * List processes matching AI-related patterns.
 * Returns: [{ pid, ppid, rss (MB), command }]
 */
function detectProcesses(patterns) {
  const defaultPatterns = [
    'mlx_lm', 'minimax', 'cli-dev', 'claude',
    'node.*index.js', 'tmux.*egonetics', 'vite',
  ]
  const matchers = (patterns || defaultPatterns).map(p => new RegExp(p, 'i'))

  try {
    const raw = execSync('ps -eo pid,ppid,rss,command', { encoding: 'utf8', timeout: 3000 })
    const lines = raw.split('\n').slice(1) // skip header
    const results = []

    for (const line of lines) {
      const m = line.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.+)$/)
      if (!m) continue
      const [, pid, ppid, rss, command] = m
      if (matchers.some(re => re.test(command))) {
        results.push({
          pid: parseInt(pid, 10),
          ppid: parseInt(ppid, 10),
          rssMb: Math.round(parseInt(rss, 10) / 1024),
          command: command.slice(0, 120),
        })
      }
    }
    return results
  } catch {
    return []
  }
}

// ── Port check ───────────────────────────────────────────────────

/**
 * Check if a TCP port is listening.
 */
function isPortListening(port) {
  try {
    if (PLATFORM === 'darwin') {
      const out = execSync(`lsof -i :${port} -sTCP:LISTEN -t 2>/dev/null`, { encoding: 'utf8', timeout: 2000 })
      return out.trim().length > 0
    }
    if (PLATFORM === 'linux') {
      const out = execSync(`ss -tlnp sport = :${port} 2>/dev/null`, { encoding: 'utf8', timeout: 2000 })
      return out.includes(`:${port}`)
    }
    return false
  } catch {
    return false
  }
}

// ── Port services (动态，从 pr-graph.json 读取) ─────────────────

/**
 * 端口检测委托给 runtime/perceiver.js（从 pr-graph.json 动态读取）。
 * platform.js 保留 isPortListening 作为底层工具函数。
 * 不再硬编码 KNOWN_PORTS。
 */
function detectPorts() {
  try {
    const perceiver = require('../runtime/perceiver')
    return perceiver.detectPorts()
  } catch {
    // perceiver 未就绪时返回空（启动阶段）
    return []
  }
}

// ── tmux sessions ────────────────────────────────────────────────

function detectTmuxSessions() {
  const sessions = []
  // bornfly's sessions
  try {
    const out = execSync('tmux list-sessions -F "#{session_name}" 2>/dev/null', { encoding: 'utf8', timeout: 2000 })
    for (const name of out.trim().split('\n').filter(Boolean)) {
      sessions.push({ name, user: 'bornfly', socket: 'default' })
    }
  } catch { /* no tmux */ }
  // free-code isolated sessions
  for (const user of ['egonetics-l0', 'egonetics-l1']) {
    try {
      const out = execSync(`sudo -n -H -u ${user} /opt/homebrew/bin/tmux -L egonetics-freecode list-sessions -F "#{session_name}" 2>/dev/null`, { encoding: 'utf8', timeout: 2000 })
      for (const name of out.trim().split('\n').filter(Boolean)) {
        sessions.push({ name, user, socket: 'egonetics-freecode' })
      }
    } catch { /* no sessions or no sudo */ }
  }
  return sessions
}

// ── Docker containers ────────────────────────────────────────────

function detectDocker() {
  try {
    const out = execSync('docker ps --format "{{.Names}}\\t{{.Status}}\\t{{.Ports}}" 2>/dev/null', { encoding: 'utf8', timeout: 3000 })
    return out.trim().split('\n').filter(Boolean).map(line => {
      const [name, status, ports] = line.split('\t')
      return { name, status, ports: ports || '' }
    })
  } catch {
    return []
  }
}

// ── Unified detect ───────────────────────────────────────────────

/**
 * Full system resource snapshot.
 * Designed to be called periodically (e.g., every 30s) by allocator.
 */
function detect() {
  return {
    platform: PLATFORM,
    hostname: os.hostname(),
    uptime: Math.round(os.uptime()),
    timestamp: Date.now(),
    ram: detectRam(),
    swap: detectSwap(),
    cpu: detectCpu(),
    processes: detectProcesses(),
    ports: detectPorts(),
    tmux: detectTmuxSessions(),
    docker: detectDocker(),
  }
}

module.exports = {
  detect,
  detectRam,
  detectSwap,
  detectCpu,
  detectProcesses,
  detectPorts,
  detectTmuxSessions,
  detectDocker,
  isPortListening,
  PLATFORM,
}
