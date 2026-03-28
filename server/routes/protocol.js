/**
 * Human-Machine Collaboration Protocol — "宪法" CRUD
 * GET    /api/protocol          — 全部条目（可 ?category=xxx 过滤）
 * POST   /api/protocol          — 新增
 * PATCH  /api/protocol/:id      — 更新
 * DELETE /api/protocol/:id      — 删除
 */
const express = require('express')

function genId() {
  return `proto-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

exports.init = (db) => {
  const router = express.Router()

  // GET /api/protocol
  router.get('/protocol', (req, res) => {
    const { category } = req.query
    const sql = category
      ? 'SELECT * FROM hm_protocol WHERE category=? ORDER BY sort_order, created_at'
      : 'SELECT * FROM hm_protocol ORDER BY sort_order, created_at'
    const params = category ? [category] : []
    db.all(sql, params, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json(rows)
    })
  })

  // POST /api/protocol
  router.post('/protocol', (req, res) => {
    const { category = 'universal', layer = '', human_char = '', ui_visual = '{}', machine_lang = '', notes = '', sort_order = 0 } = req.body
    const id = genId()
    db.run(
      `INSERT INTO hm_protocol (id, category, layer, human_char, ui_visual, machine_lang, notes, sort_order) VALUES (?,?,?,?,?,?,?,?)`,
      [id, category, layer, human_char, typeof ui_visual === 'object' ? JSON.stringify(ui_visual) : ui_visual, machine_lang, notes, sort_order],
      function (err) {
        if (err) return res.status(500).json({ error: err.message })
        db.get('SELECT * FROM hm_protocol WHERE id=?', [id], (e2, row) => {
          if (e2) return res.status(500).json({ error: e2.message })
          res.status(201).json(row)
        })
      }
    )
  })

  // PATCH /api/protocol/:id
  router.patch('/protocol/:id', (req, res) => {
    const fields = ['category', 'layer', 'human_char', 'ui_visual', 'machine_lang', 'notes', 'sort_order']
    const sets = [], vals = []
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        sets.push(`${f}=?`)
        vals.push(typeof req.body[f] === 'object' ? JSON.stringify(req.body[f]) : req.body[f])
      }
    }
    if (!sets.length) return res.json({ ok: true })
    sets.push('updated_at=datetime(\'now\')')
    vals.push(req.params.id)
    db.run(`UPDATE hm_protocol SET ${sets.join(',')} WHERE id=?`, vals, function (err) {
      if (err) return res.status(500).json({ error: err.message })
      res.json({ ok: true })
    })
  })

  // DELETE /api/protocol/:id
  router.delete('/protocol/:id', (req, res) => {
    db.run('DELETE FROM hm_protocol WHERE id=?', [req.params.id], function (err) {
      if (err) return res.status(500).json({ error: err.message })
      res.json({ ok: true })
    })
  })

  return router
}
