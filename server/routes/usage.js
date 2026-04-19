/**
 * server/routes/usage.js — Claude-added (2026-04-18)
 *
 * Usage snapshot API for the /resources_claude page.
 *
 * GET  /api/usage/snapshot          → all probe snapshots
 * GET  /api/usage/probes            → list registered probes
 * POST /api/usage/probes            → register a new probe
 * DELETE /api/usage/probes/:id      → remove a probe
 * POST /api/usage/probes/:id/refresh → force-refresh one probe
 * GET  /api/usage/stream            → SSE stream, pushes on every poll cycle
 */

'use strict'

const express    = require('express')
const { execSync } = require('child_process')
const fs         = require('fs')
const os         = require('os')
const router     = express.Router()

// ── In-memory probe registry ──────────────────────────────────────────────────
// Each probe: { id, label, subtitle, plan, kind, interval_ms, _timer, _last }
// kind: 'claude_cli_session' | 'db_execution_runs' | 'manual' | 'unknown'

const DEFAULT_PROBES = [
  {
    id:          'claude-session',
    label:       'Claude Code',
    plan:        'Max',
    kind:        'claude_cli_session',
    interval_ms: 60_000,
    rows: [
      { id: 'session', label: 'Current session', reset_hint: 'session window' },
      { id: 'weekly',  label: 'All models',      reset_hint: 'weekly' },
    ],
  },
  {
    id:          'egonetics-runs',
    label:       'EGonetics T2 calls',
    plan:        null,
    kind:        'db_execution_runs',
    interval_ms: 30_000,
    rows: [
      { id: 'runs', label: 'API calls (last 100 runs)', reset_hint: null },
    ],
  },
  {
    id:          'codex-session',
    label:       'Codex CLI',
    plan:        'Pro',
    kind:        'unknown',
    interval_ms: 120_000,
    rows: [
      { id: 'session', label: 'Current session', reset_hint: null },
    ],
  },
  {
    id:          'gemini-daily',
    label:       'Gemini CLI',
    plan:        'Pro',
    kind:        'gemini_daily_requests',
    interval_ms: 60_000,
    quota_rpd:   1500,
    rows: [
      { id: 'daily', label: 'Requests today', reset_hint: 'daily (midnight)' },
    ],
  },
  {
    id:          'minimax-daily',
    label:       'MiniMax T1',
    plan:        null,
    kind:        'minimax_daily_calls',
    interval_ms: 30_000,
    rows: [
      { id: 'daily', label: 'T1 calls today', reset_hint: 'daily (midnight)' },
    ],
  },
]

const _probes = new Map()   // id → probe config
const _cache  = new Map()   // id → { rows: [...], collected_at }
const _sseClients = new Set()

// ── Collectors ────────────────────────────────────────────────────────────────

function collectClaudeCliSession() {
  // Parse real token usage from ~/.claude/projects/**/*.jsonl
  // Each JSONL line may have message.usage with input_tokens, output_tokens, etc.
  try {
    const projectsDir = `${os.homedir()}/.claude/projects/`
    if (!fs.existsSync(projectsDir)) {
      return _claudeNoData('projects dir not found')
    }

    const nowMs  = Date.now()
    const fiveHMs = 5 * 3600 * 1000
    const weekMs  = 7 * 24 * 3600 * 1000

    // Collect all .jsonl files recursively (depth ≤ 3) modified within 7 days
    const jsonlFiles = []
    function scanDir(dir, depth) {
      if (depth > 3) return
      let entries
      try { entries = fs.readdirSync(dir) } catch { return }
      for (const e of entries) {
        const full = `${dir}/${e}`
        try {
          const stat = fs.statSync(full)
          if (stat.isDirectory()) {
            scanDir(full, depth + 1)
          } else if (e.endsWith('.jsonl') && (nowMs - stat.mtimeMs) < weekMs) {
            jsonlFiles.push({ path: full, mtimeMs: stat.mtimeMs })
          }
        } catch {}
      }
    }
    scanDir(projectsDir, 0)

    if (jsonlFiles.length === 0) return _claudeNoData('no recent sessions')

    // Aggregate tokens across files with a cutoffMs lower bound.
    // Returns aggregated counters + earliest timestamp seen (for reset calculation).
    function aggregateTokens(filePaths, cutoffMs) {
      let inputTokens = 0, outputTokens = 0, cacheRead = 0, turns = 0
      let earliestTs = Infinity
      for (const p of filePaths) {
        let lines
        try { lines = fs.readFileSync(p, 'utf8').split('\n') } catch { continue }
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const entry = JSON.parse(line)
            const ts = entry.timestamp ? new Date(entry.timestamp).getTime() : 0
            if (cutoffMs && ts < cutoffMs) continue
            const usage = entry.message?.usage || entry.usage
            if (!usage) continue
            const inp = usage.input_tokens || 0
            const out = usage.output_tokens || 0
            if (inp === 0 && out === 0) continue   // skip zero-value entries
            inputTokens += inp
            outputTokens += out
            cacheRead   += usage.cache_read_input_tokens || 0
            turns++
            if (ts && ts < earliestTs) earliestTs = ts
          } catch {}
        }
      }
      return { inputTokens, outputTokens, cacheRead, turns, earliestTs }
    }

    function fmt(n) {
      if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
      if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
      return String(n)
    }

    function fmtDuration(ms) {
      if (ms <= 0) return 'soon'
      const h = Math.floor(ms / 3600_000)
      const m = Math.floor((ms % 3600_000) / 60_000)
      if (h > 0) return `${h}h ${m}m`
      return `${m}m`
    }

    const allPaths     = jsonlFiles.map(f => f.path)
    const sessionStats = aggregateTokens(allPaths, nowMs - fiveHMs)
    const weekStats    = aggregateTokens(allPaths, nowMs - weekMs)

    // Reset countdown: 5h window expires at (earliest turn in window + 5h)
    const sessionResetMs = sessionStats.earliestTs !== Infinity
      ? (sessionStats.earliestTs + fiveHMs) - nowMs
      : null

    const sessionTotal = sessionStats.inputTokens + sessionStats.outputTokens
    const weekTotal    = weekStats.inputTokens + weekStats.outputTokens

    return {
      rows: [
        {
          id:       'session',
          label:    'Current session',
          status:   'ready',
          used_pct: null,
          used:     `${fmt(sessionTotal)} tokens`,
          total:    null,
          reset_in: sessionResetMs !== null ? `resets in ${fmtDuration(sessionResetMs)}` : null,
          note:     `in: ${fmt(sessionStats.inputTokens)}  out: ${fmt(sessionStats.outputTokens)}  cache: ${fmt(sessionStats.cacheRead)}`,
        },
        {
          id:       'weekly',
          label:    'All models (weekly)',
          status:   'ready',
          used_pct: null,
          used:     `${fmt(weekTotal)} tokens`,
          total:    null,
          reset_in: 'resets weekly',
          note:     `${weekStats.turns} turns  ${jsonlFiles.length} sessions`,
        },
      ],
      collected_at: new Date().toISOString(),
    }
  } catch (err) {
    return {
      rows: [
        { id: 'session', label: 'Current session', status: 'error', note: err.message },
        { id: 'weekly',  label: 'All models',      status: 'error', note: err.message },
      ],
      collected_at: new Date().toISOString(),
    }
  }
}

function _claudeNoData(reason) {
  return {
    rows: [
      { id: 'session', label: 'Current session', status: 'unknown', used_pct: null, used: null, total: null, reset_in: null, note: reason },
      { id: 'weekly',  label: 'All models (7 days)', status: 'unknown', used_pct: null, used: null, total: null, reset_in: null, note: reason },
    ],
    collected_at: new Date().toISOString(),
  }
}

function collectDbExecutionRuns() {
  try {
    const { pagesDb } = require('../db')
    return new Promise((resolve) => {
      pagesDb.all(
        `SELECT status, api_calls FROM execution_runs ORDER BY created_at DESC LIMIT 100`,
        [],
        (err, rows) => {
          if (err || !rows) {
            return resolve({ rows: [{ id: 'runs', label: 'API calls', status: 'error', note: err?.message }], collected_at: new Date().toISOString() })
          }
          const total = rows.reduce((s, r) => s + (r.api_calls || 0), 0)
          const quota = 1000 // rough per-100-run quota
          resolve({
            rows: [{
              id:       'runs',
              label:    'API calls (last 100 runs)',
              status:   'ready',
              used_pct: Math.min(100, Math.round((total / quota) * 100)),
              used:     total,
              total:    quota,
              reset_in: null,
              note:     `${rows.length} runs sampled`,
            }],
            collected_at: new Date().toISOString(),
          })
        }
      )
    })
  } catch {
    return Promise.resolve({ rows: [{ id: 'runs', label: 'API calls', status: 'unknown', note: 'DB unavailable' }], collected_at: new Date().toISOString() })
  }
}

function collectUnknown(probe) {
  return Promise.resolve({
    rows: probe.rows.map(r => ({
      id:       r.id,
      label:    r.label,
      status:   'auth_required',
      used_pct: null,
      note:     'CLI harness not yet authenticated',
    })),
    collected_at: new Date().toISOString(),
  })
}

async function collectProbe(probe) {
  switch (probe.kind) {
    case 'claude_cli_session':  return collectClaudeCliSession()
    case 'db_execution_runs':   return collectDbExecutionRuns()
    default:                    return collectUnknown(probe)
  }
}

// ── SSE push ──────────────────────────────────────────────────────────────────

function pushSSE(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`
  for (const res of _sseClients) {
    try { res.write(payload) } catch { _sseClients.delete(res) }
  }
}

// ── Probe lifecycle ───────────────────────────────────────────────────────────

function startProbe(probe) {
  const tick = async () => {
    const snap = await collectProbe(probe)
    _cache.set(probe.id, snap)
    pushSSE({ type: 'probe_update', id: probe.id, snapshot: snap })
  }
  tick()
  probe._timer = setInterval(tick, probe.interval_ms)
  if (probe._timer.unref) probe._timer.unref()
  _probes.set(probe.id, probe)
}

function stopProbe(id) {
  const p = _probes.get(id)
  if (p?._timer) clearInterval(p._timer)
  _probes.delete(id)
  _cache.delete(id)
}

// Init default probes
for (const p of DEFAULT_PROBES) startProbe({ ...p })

// ── Routes ────────────────────────────────────────────────────────────────────

router.get('/usage/snapshot', (_req, res) => {
  const result = []
  for (const [id, probe] of _probes) {
    const snap = _cache.get(id) || { rows: [], collected_at: null }
    result.push({
      id,
      label:       probe.label,
      plan:        probe.plan,
      kind:        probe.kind,
      interval_ms: probe.interval_ms,
      ...snap,
    })
  }
  res.json({ providers: result, server_time: new Date().toISOString() })
})

router.get('/usage/probes', (_req, res) => {
  res.json([..._probes.values()].map(p => ({
    id:          p.id,
    label:       p.label,
    plan:        p.plan,
    kind:        p.kind,
    interval_ms: p.interval_ms,
    row_ids:     (p.rows || []).map(r => r.id),
  })))
})

router.post('/usage/probes', (req, res) => {
  const { id, label, plan, kind = 'unknown', interval_ms = 60_000, rows = [] } = req.body || {}
  if (!id || !label) return res.status(400).json({ error: 'id and label required' })
  if (_probes.has(id)) return res.status(409).json({ error: `probe "${id}" already exists` })

  const probe = { id, label, plan: plan || null, kind, interval_ms: Math.max(5000, interval_ms), rows }
  startProbe(probe)
  res.status(201).json({ id, label, kind })
})

router.delete('/usage/probes/:id', (req, res) => {
  const { id } = req.params
  if (!_probes.has(id)) return res.status(404).json({ error: 'probe not found' })
  stopProbe(id)
  res.json({ deleted: id })
})

router.post('/usage/probes/:id/refresh', async (req, res) => {
  const probe = _probes.get(req.params.id)
  if (!probe) return res.status(404).json({ error: 'probe not found' })
  const snap = await collectProbe(probe)
  _cache.set(probe.id, snap)
  pushSSE({ type: 'probe_update', id: probe.id, snapshot: snap })
  res.json(snap)
})

router.get('/usage/stream', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' })
  res.flushHeaders()
  _sseClients.add(res)

  // Send current snapshot immediately on connect
  const snapshot = []
  for (const [id, probe] of _probes) {
    const snap = _cache.get(id) || { rows: [], collected_at: null }
    snapshot.push({ id, label: probe.label, plan: probe.plan, ...snap })
  }
  res.write(`data: ${JSON.stringify({ type: 'init', providers: snapshot })}\n\n`)

  const keepalive = setInterval(() => res.write(': keepalive\n\n'), 25_000)
  req.on('close', () => { _sseClients.delete(res); clearInterval(keepalive) })
})

module.exports = router
