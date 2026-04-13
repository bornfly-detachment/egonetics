/**
 * @prvse P-L0-IMPL_store
 *
 * L0/L1 Job Store — JSON 文件持久化 + CRUD
 *
 * 借鉴 Openclaw CronStoreFile 模式：
 *   - 内存缓存 + mtime 检测外部修改
 *   - 完整 CRUD（add/update/remove/list）
 *   - JSON 文件持久化，不用 DB
 *
 * 存储路径: prvse_world_workspace/L0/state/jobs.json
 */

'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

// ── Paths ───────────────────────────────────────────────────────

const STATE_DIR = path.join(
  process.env.PRVSE_WORKSPACE || path.resolve(__dirname, '../../../../prvse_world_workspace'),
  'L0/state'
)
const STORE_PATH = path.join(STATE_DIR, 'jobs.json')

// ── In-memory state ─────────────────────────────────────────────

let store = null          // { version: 1, jobs: [] }
let storeMtimeMs = null   // 检测外部修改

// ── Helpers ─────────────────────────────────────────────────────

function genId() {
  return `job-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`
}

function nowMs() { return Date.now() }

// ── Load / Persist (Openclaw ensureLoaded + persist pattern) ────

function ensureDir() {
  fs.mkdirSync(STATE_DIR, { recursive: true })
}

function getFileMtime() {
  try { return fs.statSync(STORE_PATH).mtimeMs } catch { return null }
}

/**
 * 加载 store。如果文件被外部修改则重新读取。
 */
function ensureLoaded(opts = {}) {
  const currentMtime = getFileMtime()

  // 快速路径：内存有缓存且文件未变
  if (store && !opts.forceReload && currentMtime === storeMtimeMs) {
    return store
  }

  // 从文件加载
  ensureDir()
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf8')
      store = JSON.parse(raw)
      // 迁移: 确保 version 字段
      if (!store.version) store.version = 1
      if (!Array.isArray(store.jobs)) store.jobs = []
    } else {
      store = { version: 1, jobs: [] }
    }
  } catch (err) {
    console.error('[store] load failed, starting fresh:', err.message)
    store = { version: 1, jobs: [] }
  }

  storeMtimeMs = getFileMtime()
  return store
}

/**
 * 持久化 store 到文件。
 */
function persist() {
  if (!store) return
  ensureDir()
  const json = JSON.stringify(store, null, 2)
  fs.writeFileSync(STORE_PATH, json, 'utf8')
  storeMtimeMs = getFileMtime()
}

// ── CRUD ────────────────────────────────────────────────────────

/**
 * 列出所有 jobs。
 * @param {Object} [opts]
 * @param {boolean} [opts.includeDisabled] - 是否包含 disabled 的 job
 */
function list(opts = {}) {
  ensureLoaded()
  if (opts.includeDisabled) return [...store.jobs]
  return store.jobs.filter(j => j.enabled !== false)
}

/**
 * 根据 ID 获取 job。
 */
function get(id) {
  ensureLoaded()
  return store.jobs.find(j => j.id === id) || null
}

/**
 * 添加 job。
 * @param {Object} input - { name, schedule, payload, enabled? }
 * @returns {Object} created job
 */
function add(input) {
  ensureLoaded()
  const now = nowMs()
  const job = {
    id: genId(),
    name: input.name || 'unnamed',
    description: input.description || '',
    enabled: input.enabled !== false,
    schedule: input.schedule || { kind: 'every', everyMs: 10 * 60_000 },
    payload: input.payload || { kind: 'systemEvent', text: '' },
    createdAtMs: now,
    updatedAtMs: now,
    state: {
      nextRunAtMs: computeNextRunAt(input.schedule, now),
      lastRunAtMs: null,
      runningAtMs: null,
      lastStatus: null,
      lastError: null,
      lastDurationMs: null,
      consecutiveErrors: 0,
    },
  }
  store.jobs.push(job)
  persist()
  return job
}

/**
 * 更新 job。
 * @param {string} id
 * @param {Object} patch - 部分字段覆盖
 * @returns {Object|null} updated job or null if not found
 */
function update(id, patch) {
  ensureLoaded()
  const job = store.jobs.find(j => j.id === id)
  if (!job) return null

  const now = nowMs()
  if (patch.name !== undefined) job.name = patch.name
  if (patch.description !== undefined) job.description = patch.description
  if (patch.enabled !== undefined) job.enabled = patch.enabled
  if (patch.payload !== undefined) job.payload = patch.payload
  if (patch.schedule !== undefined) {
    job.schedule = patch.schedule
    job.state.nextRunAtMs = computeNextRunAt(patch.schedule, now)
  }
  job.updatedAtMs = now

  persist()
  return job
}

/**
 * 删除 job。
 * @returns {boolean} true if removed
 */
function remove(id) {
  ensureLoaded()
  const before = store.jobs.length
  store.jobs = store.jobs.filter(j => j.id !== id)
  if (store.jobs.length !== before) {
    persist()
    return true
  }
  return false
}

// ── Schedule computation ────────────────────────────────────────

/**
 * 计算下一次运行时间。
 * 借鉴 Openclaw computeNextRunAtMs。
 */
function computeNextRunAt(schedule, now) {
  if (!schedule) return now

  if (schedule.kind === 'at') {
    const atMs = typeof schedule.at === 'string' ? new Date(schedule.at).getTime() : schedule.at
    return atMs > now ? atMs : null
  }

  if (schedule.kind === 'every') {
    const everyMs = schedule.everyMs || 10 * 60_000
    const anchor = schedule.anchorMs || now
    if (now < anchor) return anchor
    const elapsed = now - anchor
    const steps = Math.ceil(elapsed / everyMs)
    return anchor + steps * everyMs
  }

  // kind === 'cron' — 需要 croner, 延迟加载
  if (schedule.kind === 'cron' && schedule.expr) {
    try {
      const { Cron } = require('croner')
      const cron = new Cron(schedule.expr)
      const next = cron.nextRun(new Date(now))
      return next ? next.getTime() : null
    } catch { return null }
  }

  return now
}

// ── Job execution helpers ───────────────────────────────────────

/**
 * 查找所有到期的 job。
 */
function collectDueJobs(now) {
  ensureLoaded()
  return store.jobs.filter(j =>
    j.enabled !== false &&
    j.state.runningAtMs === null &&
    j.state.nextRunAtMs !== null &&
    now >= j.state.nextRunAtMs
  )
}

/**
 * 标记 job 开始执行。
 */
function markRunning(id) {
  const job = get(id)
  if (!job) return null
  job.state.runningAtMs = nowMs()
  persist()
  return job
}

/**
 * 记录 job 执行结果（Openclaw applyJobResult 模式）。
 *
 * Error backoff: 30s → 1min → 5min → 15min → 60min (capped)
 */
const BACKOFF_SCHEDULE = [30_000, 60_000, 5*60_000, 15*60_000, 60*60_000]

function applyResult(id, result) {
  ensureLoaded()
  const job = store.jobs.find(j => j.id === id)
  if (!job) return null

  const now = nowMs()
  job.state.runningAtMs = null
  job.state.lastRunAtMs = result.startedAt || now
  job.state.lastDurationMs = now - (result.startedAt || now)
  job.state.lastStatus = result.status  // 'ok' | 'error' | 'skipped'
  job.state.lastError = result.error || null

  if (result.status === 'error') {
    job.state.consecutiveErrors = (job.state.consecutiveErrors || 0) + 1
    // Backoff
    const idx = Math.min(job.state.consecutiveErrors - 1, BACKOFF_SCHEDULE.length - 1)
    const backoff = BACKOFF_SCHEDULE[idx]
    const nextNatural = computeNextRunAt(job.schedule, now)
    job.state.nextRunAtMs = Math.max(nextNatural || 0, now + backoff)
  } else {
    job.state.consecutiveErrors = 0
    // 一次性 job 执行成功后禁用
    if (job.schedule.kind === 'at' && result.status === 'ok') {
      job.enabled = false
      job.state.nextRunAtMs = null
    } else {
      job.state.nextRunAtMs = computeNextRunAt(job.schedule, now)
    }
  }

  job.updatedAtMs = now
  persist()
  return job
}

module.exports = {
  list, get, add, update, remove,
  collectDueJobs, markRunning, applyResult,
  ensureLoaded, persist,
  computeNextRunAt,
}
