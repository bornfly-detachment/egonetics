/**
 * server/routes/signals.js
 * 信号层 API — 人工处理队列 + T0↔T1分类冲突裁定
 *
 * GET  /api/signals/queue/counts           — 各层级待处理数量 {L0,L1,L2,L3}
 * GET  /api/signals/queue?layer=L0&limit=20 — 某层未处理项列表
 * POST /api/signals/queue/:id/resolve      — 人工标记已处理
 * GET  /api/signals/diffs?limit=20         — T0↔T1冲突列表
 * POST /api/signals/diffs/:id/arbitrate    — 人工裁定 {human_label}
 *
 * (dev) POST /api/signals/queue            — 写入测试未处理项
 * (dev) POST /api/signals/diffs            — 写入测试冲突
 */

'use strict'

const express  = require('express')
const { randomUUID } = require('crypto')

module.exports = {
  init(signalsDb) {
    const router = express.Router()

    const run  = (sql, p = []) => new Promise((res, rej) => signalsDb.run(sql, p, function(e) { e ? rej(e) : res(this) }))
    const all  = (sql, p = []) => new Promise((res, rej) => signalsDb.all(sql, p, (e, r) => e ? rej(e) : res(r)))
    const get  = (sql, p = []) => new Promise((res, rej) => signalsDb.get(sql, p, (e, r) => e ? rej(e) : res(r)))

    // ── GET /api/signals/queue/counts ─────────────────────────────
    router.get('/queue/counts', async (_req, res) => {
      try {
        const rows = await all(
          `SELECT layer, COUNT(*) AS count FROM unresolved_pool
           WHERE status = 'pending' GROUP BY layer`
        )
        const counts = { L0: 0, L1: 0, L2: 0, L3: 0 }
        rows.forEach(r => { if (r.layer in counts) counts[r.layer] = r.count })

        // 加上 classification_diff 未裁定数量（计入 L0）
        const diffRow = await get(`SELECT COUNT(*) AS count FROM classification_diff WHERE status = 'pending'`)
        counts.L0 += (diffRow?.count ?? 0)

        res.json({ counts, total: Object.values(counts).reduce((a, b) => a + b, 0) })
      } catch (e) {
        res.status(500).json({ error: e.message })
      }
    })

    // ── GET /api/signals/queue ────────────────────────────────────
    router.get('/queue', async (req, res) => {
      const layer = req.query.layer   // L0/L1/L2/L3，不传则全部
      const limit = parseInt(req.query.limit) || 30
      try {
        const rows = await all(
          `SELECT * FROM unresolved_pool
           WHERE status = 'pending' ${layer ? 'AND layer = ?' : ''}
           ORDER BY created_at DESC LIMIT ?`,
          layer ? [layer, limit] : [limit]
        )
        res.json({ items: rows })
      } catch (e) {
        res.status(500).json({ error: e.message })
      }
    })

    // ── POST /api/signals/queue/:id/resolve ───────────────────────
    router.post('/queue/:id/resolve', async (req, res) => {
      const { notes } = req.body
      const userId = req.user?.username ?? 'unknown'
      try {
        await run(
          `UPDATE unresolved_pool SET status='resolved', resolved_at=?, resolved_by=?, notes=?
           WHERE id=? AND status='pending'`,
          [Date.now(), userId, notes ?? null, req.params.id]
        )
        res.json({ ok: true })
      } catch (e) {
        res.status(500).json({ error: e.message })
      }
    })

    // ── GET /api/signals/diffs ────────────────────────────────────
    router.get('/diffs', async (req, res) => {
      const limit = parseInt(req.query.limit) || 30
      try {
        const rows = await all(
          `SELECT * FROM classification_diff
           WHERE status = 'pending'
           ORDER BY created_at DESC LIMIT ?`,
          [limit]
        )
        res.json({ items: rows.map(r => ({
          ...r,
          t0_prediction: r.t0_prediction ? JSON.parse(r.t0_prediction) : null,
          t1_prediction: r.t1_prediction ? JSON.parse(r.t1_prediction) : null,
          signal_snapshot: r.signal_snapshot ? JSON.parse(r.signal_snapshot) : null,
        })) })
      } catch (e) {
        res.status(500).json({ error: e.message })
      }
    })

    // ── POST /api/signals/diffs/:id/arbitrate ─────────────────────
    router.post('/diffs/:id/arbitrate', async (req, res) => {
      const { human_label } = req.body
      if (!human_label) return res.status(400).json({ error: 'human_label 必填' })

      const userId = req.user?.username ?? 'unknown'
      const now    = Date.now()
      try {
        await run(
          `UPDATE classification_diff
           SET status='arbitrated', human_label=?, arbitrated_by=?, arbitrated_at=?
           WHERE id=? AND status='pending'`,
          [human_label, userId, now, req.params.id]
        )

        // 自动写入训练数据（E 后续补充 prvse_tags / reward_signal）
        const diff = await get(`SELECT * FROM classification_diff WHERE id=?`, [req.params.id])
        if (diff) {
          await run(
            `INSERT INTO training_records
               (id, source_type, source_id, signal_snapshot, label, label_source, model_tier, layer, created_at)
             VALUES (?,?,?,?,?,?,?,?,?)`,
            [
              randomUUID(), 'classification_diff', diff.id,
              diff.signal_snapshot, human_label, 'human',
              null,  // E 后续填充 model_tier
              diff.layer, now,
            ]
          )
        }

        res.json({ ok: true })
      } catch (e) {
        res.status(500).json({ error: e.message })
      }
    })

    // ── (dev) POST /api/signals/queue — 写入测试项 ────────────────
    router.post('/queue', async (req, res) => {
      const { layer = 'L0', signal_type = 'p_gate_fail', failure_reason, failure_detail, signal_snapshot } = req.body
      try {
        const id = randomUUID()
        await run(
          `INSERT INTO unresolved_pool (id, layer, signal_type, signal_snapshot, failure_reason, failure_detail, created_at)
           VALUES (?,?,?,?,?,?,?)`,
          [id, layer, signal_type, JSON.stringify(signal_snapshot ?? {}), failure_reason ?? null, JSON.stringify(failure_detail ?? null), Date.now()]
        )
        res.json({ ok: true, id })
      } catch (e) {
        res.status(500).json({ error: e.message })
      }
    })

    // ── (dev) POST /api/signals/diffs — 写入测试冲突 ─────────────
    router.post('/diffs', async (req, res) => {
      const { signal_snapshot, t0_prediction, t1_prediction, layer = 'L0' } = req.body
      try {
        const id = randomUUID()
        await run(
          `INSERT INTO classification_diff (id, layer, signal_snapshot, t0_prediction, t1_prediction, created_at)
           VALUES (?,?,?,?,?,?)`,
          [id, layer, JSON.stringify(signal_snapshot ?? {}), JSON.stringify(t0_prediction ?? null), JSON.stringify(t1_prediction ?? null), Date.now()]
        )
        res.json({ ok: true, id })
      } catch (e) {
        res.status(500).json({ error: e.message })
      }
    })

    return router
  }
}
