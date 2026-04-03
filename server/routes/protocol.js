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

  // GET /api/protocol  — 支持 ?category=xxx 和 ?anchor_tag_id=xxx 过滤
  router.get('/protocol', (req, res) => {
    const { category, anchor_tag_id } = req.query
    const where = []; const params = []
    if (category)       { where.push('category = ?');       params.push(category) }
    if (anchor_tag_id)  { where.push('anchor_tag_id = ?');  params.push(anchor_tag_id) }
    const sql = where.length
      ? `SELECT * FROM hm_protocol WHERE ${where.join(' AND ')} ORDER BY sort_order, created_at`
      : 'SELECT * FROM hm_protocol ORDER BY sort_order, created_at'
    db.all(sql, params, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json(rows)
    })
  })

  // POST /api/protocol  — anchor_tag_id 必填，引用必须存在于 tag_trees
  router.post('/protocol', (req, res) => {
    const { category = 'universal', layer = '', human_char = '', ui_visual = '{}', machine_lang = '', notes = '', sort_order = 0, anchor_tag_id } = req.body
    if (!anchor_tag_id) return res.status(400).json({ error: 'anchor_tag_id is required — protocol rules must be anchored to a TagTree node' })
    const id = genId()
    // 校验 anchor 存在（从 JSON 文件查找）
    const { readTree, findById } = require('./tags')
    const tagTree = readTree()
    const tag = findById(tagTree, anchor_tag_id)
    if (!tag) return res.status(400).json({ error: `anchor_tag_id "${anchor_tag_id}" does not exist in tag-tree` })
    db.run(
      `INSERT INTO hm_protocol (id, category, layer, human_char, ui_visual, machine_lang, notes, sort_order, anchor_tag_id) VALUES (?,?,?,?,?,?,?,?,?)`,
      [id, category, layer, human_char, typeof ui_visual === 'object' ? JSON.stringify(ui_visual) : ui_visual, machine_lang, notes, sort_order, anchor_tag_id],
      function (e2) {
        if (e2) return res.status(500).json({ error: e2.message })
        db.get('SELECT * FROM hm_protocol WHERE id=?', [id], (e3, row) => {
          if (e3) return res.status(500).json({ error: e3.message })
          res.status(201).json(row)
        })
      }
    )
  })

  // PATCH /api/protocol/:id
  router.patch('/protocol/:id', (req, res) => {
    const fields = ['category', 'layer', 'human_char', 'ui_visual', 'machine_lang', 'notes', 'sort_order', 'anchor_tag_id']
    const sets = [], vals = []
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        sets.push(`${f}=?`)
        vals.push(typeof req.body[f] === 'object' ? JSON.stringify(req.body[f]) : req.body[f])
      }
    }
    if (!sets.length) return res.json({ ok: true })

    const doUpdate = () => {
      sets.push('updated_at=datetime(\'now\')')
      vals.push(req.params.id)
      db.run(`UPDATE hm_protocol SET ${sets.join(',')} WHERE id=?`, vals, function (err) {
        if (err) return res.status(500).json({ error: err.message })
        res.json({ ok: true })
      })
    }

    // 如果更新 anchor_tag_id，校验引用存在（从 JSON 文件查找）
    if (req.body.anchor_tag_id) {
      const { readTree, findById } = require('./tags')
      const tagTree = readTree()
      const tag = findById(tagTree, req.body.anchor_tag_id)
      if (!tag) return res.status(400).json({ error: `anchor_tag_id "${req.body.anchor_tag_id}" does not exist in tag-tree` })
      doUpdate()
    } else {
      doUpdate()
    }
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
