/**
 * ai-resource-manager/allocator.js
 *
 * 动态资源分配器 — 基于 platform.js 实时数据做决策
 *
 * 职责：
 *   - 定时采集系统资源快照（默认 30s）
 *   - 计算当前可分配容量（max sessions / queue depth）
 *   - 提供 canAllocate() / mustReclaim() 决策接口
 *   - 识别僵尸/孤儿进程并报告
 *
 * 不做：不杀进程、不启动服务（那是 lifecycle.js 的事）
 */

'use strict'

const platform = require('./platform')

// ── 配置（可被 ai-resource-limits.yaml 覆盖） ────────────────────

const DEFAULT_CONFIG = {
  // 系统保留（OS + 基础服务，不可分配）
  systemReservedMb: 5000,
  // 安全余量（防止 swap 暴涨）
  safetyMarginMb: 1500,
  // swap 压力警戒线（超过则开始回收）
  swapWarningPct: 0.75,
  // CPU 负载警戒线（超过则限制新 session）
  cpuLoadWarningPct: 0.85,

  // 各 tier 按次调用的资源成本
  tierCallCost: {
    T0: { peakMb: 200, concurrency: 1 },    // 本地模型，串行
    T1: { peakMb: 0, concurrency: 5 },      // 云端，无本地内存
    T2: { peakMb: 0, concurrency: 3 },      // 云端
  },

  // 各 tier 常驻服务的资源成本
  tierServiceCost: {
    T0: { baseMb: 50 },   // mlx_lm.server 常驻
    T1: { baseMb: 0 },    // 云端
    T2: { baseMb: 0 },    // 云端
  },

  // session 成本
  sessionCost: {
    perSessionMb: 75,     // cli-dev + watcher
    minSessions: 1,
    idleTimeoutMin: 60,
  },

  // 采集间隔
  pollIntervalMs: 30000,
}

// ── 状态 ─────────────────────────────────────────────────────────

let _config = { ...DEFAULT_CONFIG }
let _snapshot = null
let _pollTimer = null
let _limits = null

// ── 核心计算 ─────────────────────────────────────────────────────

/**
 * 从快照计算动态分配上限。
 */
function calculateLimits(snapshot) {
  const ram = snapshot.ram
  const swap = snapshot.swap
  const cpu = snapshot.cpu

  // 按类别汇总进程内存
  const procs = snapshot.processes || []
  const categories = categorizeProcesses(procs)

  // 可分配内存 = 可回收内存 - 安全余量
  const reclaimable = ram.reclaimableMb || ram.freeMb
  const availableMb = Math.max(0,
    reclaimable - _config.safetyMarginMb
  )

  // T0 服务保留
  const t0Reserved = _config.tierServiceCost.T0.baseMb + _config.tierCallCost.T0.peakMb

  // session 可用
  const sessionBudget = Math.max(0, availableMb - t0Reserved)
  const maxSessions = Math.max(
    _config.sessionCost.minSessions,
    Math.floor(sessionBudget / _config.sessionCost.perSessionMb)
  )

  // 压力指标
  const memoryPressure = ram.pressure
  const swapPressure = swap.pressure
  const cpuPressure = cpu.loadPressure

  // 综合健康评分 0~1（1=健康）
  const health = Math.max(0, 1 - Math.max(memoryPressure, swapPressure, cpuPressure))

  // 是否需要回收
  const mustReclaim = swapPressure > _config.swapWarningPct
    || memoryPressure > 0.95
    || cpuPressure > _config.cpuLoadWarningPct

  return {
    // 容量
    availableMb,
    t0Reserved,
    sessionBudget,
    maxSessions,
    currentSessions: categories.sessions.length,
    canCreateSession: categories.sessions.length < maxSessions && !mustReclaim,

    // 压力
    memoryPressure: Math.round(memoryPressure * 100),
    swapPressure: Math.round(swapPressure * 100),
    cpuPressure: Math.round(cpuPressure * 100),
    health: Math.round(health * 100),
    mustReclaim,

    // 各 tier 并发上限
    tierConcurrency: {
      T0: _config.tierCallCost.T0.concurrency,
      T1: mustReclaim ? 2 : _config.tierCallCost.T1.concurrency,  // 压力大时降级
      T2: mustReclaim ? 1 : _config.tierCallCost.T2.concurrency,
    },

    // 进程分类
    categories,

    // 原始数据
    ram: { totalMb: ram.totalMb, reclaimableMb: reclaimable, usedMb: ram.usedMb },
    swap: { totalMb: swap.totalMb, usedMb: swap.usedMb },
    timestamp: snapshot.timestamp,
  }
}

/**
 * 将进程列表按角色分类。
 */
function categorizeProcesses(procs) {
  const result = {
    t0Service: [],    // mlx_lm.server
    t1Service: [],    // minimax MCP
    sessions: [],     // cli-dev
    backend: [],      // egonetics server
    devtools: [],     // vite, nodemon
    claude: [],       // Claude Code
    orphans: [],      // PPID=1 的 node index.js（可能是僵尸）
    other: [],
  }

  for (const p of procs) {
    const cmd = p.command.toLowerCase()
    if (cmd.includes('mlx_lm')) {
      result.t0Service.push(p)
    } else if (cmd.includes('minimax')) {
      result.t1Service.push(p)
    } else if (cmd.includes('cli-dev')) {
      result.sessions.push(p)
    } else if (cmd.includes('nodemon')) {
      result.devtools.push(p)
    } else if (cmd.includes('vite') || cmd.includes('esbuild')) {
      result.devtools.push(p)
    } else if (cmd.includes('claude')) {
      result.claude.push(p)
    } else if (cmd.includes('node') && cmd.includes('index.js')) {
      if (p.ppid === 1) {
        result.orphans.push(p)
      } else {
        result.backend.push(p)
      }
    } else {
      result.other.push(p)
    }
  }

  return result
}

// ── 公共接口 ─────────────────────────────────────────────────────

/**
 * 初始化分配器，开始定时采集。
 */
function start(configOverrides) {
  if (configOverrides) _config = { ...DEFAULT_CONFIG, ...configOverrides }
  refresh()
  if (!_pollTimer) {
    _pollTimer = setInterval(refresh, _config.pollIntervalMs)
    _pollTimer.unref()  // 不阻止进程退出
  }
}

/**
 * 立即刷新快照和限制。
 */
function refresh() {
  _snapshot = platform.detect()
  _limits = calculateLimits(_snapshot)
  return _limits
}

/**
 * 获取当前分配限制（不触发新采集）。
 */
function getLimits() {
  if (!_limits) return refresh()
  return _limits
}

/**
 * 获取最近一次系统快照。
 */
function getSnapshot() {
  if (!_snapshot) refresh()
  return _snapshot
}

/**
 * 检查是否可以为指定 tier 创建新 session。
 */
function canCreateSession() {
  const limits = getLimits()
  return limits.canCreateSession
}

/**
 * 获取指定 tier 的当前允许并发数。
 */
function getTierConcurrency(tier) {
  const limits = getLimits()
  return limits.tierConcurrency[tier] || 1
}

/**
 * 停止定时采集。
 */
function stop() {
  if (_pollTimer) {
    clearInterval(_pollTimer)
    _pollTimer = null
  }
}

module.exports = {
  start,
  stop,
  refresh,
  getLimits,
  getSnapshot,
  canCreateSession,
  getTierConcurrency,
  categorizeProcesses,
}
