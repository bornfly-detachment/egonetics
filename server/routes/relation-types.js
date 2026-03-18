/**
 * routes/relation-types.js
 * GET    /api/relation-types
 * POST   /api/relation-types
 * PATCH  /api/relation-types/:id
 * DELETE /api/relation-types/:id
 *
 * 关系类型存储在 settings 表的 key='relation_types' 行（JSON 数组）
 */

const express = require('express')
const router  = express.Router()

const COLOR_PALETTE = [
  '#8b5cf6','#ef4444','#3b82f6','#10b981','#f59e0b',
  '#06b6d4','#a855f7','#84cc16','#ec4899','#f97316',
  '#14b8a6','#6366f1','#d946ef','#0ea5e9','#22c55e',
]

let pagesDb

function init(db) {
  pagesDb = db
  return router
}

function genId() {
  return `rt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function readTypes(cb) {
  pagesDb.get("SELECT value FROM settings WHERE key = 'relation_types'", (err, row) => {
    if (err) return cb(err, null)
    try { cb(null, JSON.parse(row?.value ?? '[]')) }
    catch { cb(new Error('JSON parse error'), null) }
  })
}

function writeTypes(types, cb) {
  pagesDb.run(
    `INSERT INTO settings (key, value, updated_at) VALUES ('relation_types', ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [JSON.stringify(types)],
    cb
  )
}

// ── GET /api/relation-types ─────────────────────────────────────
router.get('/relation-types', (req, res) => {
  readTypes((err, types) => {
    if (err) return res.status(500).json({ error: err.message })
    res.json(types)
  })
})

// ── POST /api/relation-types ────────────────────────────────────
router.post('/relation-types', (req, res) => {
  const { label } = req.body
  if (!label?.trim()) return res.status(400).json({ error: 'label 必填' })

  readTypes((err, types) => {
    if (err) return res.status(500).json({ error: err.message })
    if (types.some(t => t.label === label.trim())) {
      return res.status(409).json({ error: '类型名称已存在' })
    }

    // Auto-assign next unused color
    const usedColors = new Set(types.map(t => t.color))
    const color = COLOR_PALETTE.find(c => !usedColors.has(c)) ?? COLOR_PALETTE[types.length % COLOR_PALETTE.length]

    const newType = { id: genId(), label: label.trim(), color }
    writeTypes([...types, newType], err2 => {
      if (err2) return res.status(500).json({ error: err2.message })
      res.status(201).json(newType)
    })
  })
})

// ── PATCH /api/relation-types/:id ──────────────────────────────
router.patch('/relation-types/:id', (req, res) => {
  const { label, color } = req.body
  readTypes((err, types) => {
    if (err) return res.status(500).json({ error: err.message })
    const idx = types.findIndex(t => t.id === req.params.id)
    if (idx === -1) return res.status(404).json({ error: '类型不存在' })

    if (label !== undefined) types[idx].label = label.trim()
    if (color !== undefined) types[idx].color = color

    writeTypes(types, err2 => {
      if (err2) return res.status(500).json({ error: err2.message })
      res.json(types[idx])
    })
  })
})

// ── DELETE /api/relation-types/:id ─────────────────────────────
router.delete('/relation-types/:id', (req, res) => {
  readTypes((err, types) => {
    if (err) return res.status(500).json({ error: err.message })
    const target = types.find(t => t.id === req.params.id)
    if (!target) return res.status(404).json({ error: '类型不存在' })

    // 检查是否有 relations 在使用
    pagesDb.get(
      "SELECT COUNT(*) as cnt FROM relations WHERE relation_type = ?",
      [target.id],
      (err2, row) => {
        if (err2) return res.status(500).json({ error: err2.message })
        if (row.cnt > 0) {
          return res.status(409).json({ error: `该类型被 ${row.cnt} 条关系引用，无法删除` })
        }
        writeTypes(types.filter(t => t.id !== req.params.id), err3 => {
          if (err3) return res.status(500).json({ error: err3.message })
          res.json({ ok: true })
        })
      }
    )
  })
})

module.exports = { init }
