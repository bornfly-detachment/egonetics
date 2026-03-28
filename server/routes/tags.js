/**
 * routes/tags.js
 * 标签语义树 CRUD — 存储在 pages.db 的 tag_trees 表
 *
 * GET    /api/tag-trees                    获取完整标签树（嵌套 JSON）
 * POST   /api/tag-trees                    新建根节点 { name, color }
 * POST   /api/tag-trees/:id/children       在指定节点下新建子节点 { name, color }
 * PATCH  /api/tag-trees/:id                更新节点 { name?, color? }
 * DELETE /api/tag-trees/:id                删除节点及其所有子孙（CASCADE）
 * POST   /api/tag-trees/:id/move           移动节点 { newParentId: string|null, position: number }
 */

const express   = require('express')
const router    = express.Router()
const { pagesDb } = require('../db')

// ── 工具 ──────────────────────────────────────────────────────

function genId() {
  return `tag-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

/** 从 DB 行数组重建嵌套树 */
function buildTree(rows) {
  const map = {}
  for (const r of rows) {
    map[r.id] = { id: r.id, name: r.name, color: r.color, select_mode: r.select_mode ?? 'multi', _parent: r.parent_id }
  }
  const roots = []
  for (const r of rows) {
    const node = map[r.id]
    if (r.parent_id && map[r.parent_id]) {
      const parent = map[r.parent_id]
      if (!parent.children) parent.children = []
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }
  // 清理内部字段
  function clean(node) {
    delete node._parent
    if (node.children) node.children.forEach(clean)
  }
  roots.forEach(clean)
  return roots
}

/** 获取同父节点下已排序的兄弟列表，用于计算插入位置 */
function getSiblings(parentId, cb) {
  const sql = parentId
    ? 'SELECT id, sort_order FROM tag_trees WHERE parent_id = ? ORDER BY sort_order'
    : 'SELECT id, sort_order FROM tag_trees WHERE parent_id IS NULL ORDER BY sort_order'
  const params = parentId ? [parentId] : []
  pagesDb.all(sql, params, cb)
}

/** 在 position 处计算新 sort_order（兄弟列表已排序） */
function calcSortOrder(siblings, position) {
  const n = siblings.length
  if (n === 0) return 0
  const pos = position != null ? Math.min(position, n) : n
  if (pos === 0) return siblings[0].sort_order - 1
  if (pos >= n)  return siblings[n - 1].sort_order + 1
  return (siblings[pos - 1].sort_order + siblings[pos].sort_order) / 2
}

// ── 路由 ──────────────────────────────────────────────────────

// GET /api/tag-trees
router.get('/tag-trees', (req, res) => {
  pagesDb.all('SELECT id, parent_id, name, color, select_mode FROM tag_trees ORDER BY sort_order', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message })
    res.json(buildTree(rows))
  })
})

// POST /api/tag-trees  — 新建根节点
router.post('/tag-trees', (req, res) => {
  const { name, color = '#6b7280', position, select_mode = 'multi' } = req.body
  if (!name) return res.status(400).json({ error: 'name is required' })
  const id = genId()
  getSiblings(null, (err, siblings) => {
    if (err) return res.status(500).json({ error: err.message })
    const sortOrder = calcSortOrder(siblings, position)
    pagesDb.run(
      'INSERT INTO tag_trees (id, parent_id, name, color, sort_order, select_mode) VALUES (?,NULL,?,?,?,?)',
      [id, name, color, sortOrder, select_mode],
      function(e) {
        if (e) return res.status(500).json({ error: e.message })
        res.status(201).json({ id, name, color, select_mode })
      }
    )
  })
})

// POST /api/tag-trees/:id/children  — 新建子节点
router.post('/tag-trees/:id/children', (req, res) => {
  const parentId = req.params.id
  const { name, color = '#6b7280', position, select_mode = 'multi' } = req.body
  if (!name) return res.status(400).json({ error: 'name is required' })

  pagesDb.get('SELECT id FROM tag_trees WHERE id = ?', [parentId], (err, row) => {
    if (err)  return res.status(500).json({ error: err.message })
    if (!row) return res.status(404).json({ error: 'parent not found' })

    const id = genId()
    getSiblings(parentId, (e2, siblings) => {
      if (e2) return res.status(500).json({ error: e2.message })
      const sortOrder = calcSortOrder(siblings, position)
      pagesDb.run(
        'INSERT INTO tag_trees (id, parent_id, name, color, sort_order, select_mode) VALUES (?,?,?,?,?,?)',
        [id, parentId, name, color, sortOrder, select_mode],
        function(e3) {
          if (e3) return res.status(500).json({ error: e3.message })
          res.status(201).json({ id, name, color, select_mode })
        }
      )
    })
  })
})

// PATCH /api/tag-trees/:id  — 更新名称、颜色或选择模式
router.patch('/tag-trees/:id', (req, res) => {
  const { name, color, select_mode } = req.body
  const sets   = []
  const params = []
  if (name        !== undefined) { sets.push('name = ?');        params.push(name) }
  if (color       !== undefined) { sets.push('color = ?');       params.push(color) }
  if (select_mode !== undefined) { sets.push('select_mode = ?'); params.push(select_mode) }
  if (!sets.length) return res.status(400).json({ error: 'nothing to update' })
  params.push(req.params.id)
  pagesDb.run(`UPDATE tag_trees SET ${sets.join(', ')} WHERE id = ?`, params, function(err) {
    if (err)            return res.status(500).json({ error: err.message })
    if (!this.changes)  return res.status(404).json({ error: 'tag not found' })
    res.json({ ok: true })
  })
})

// DELETE /api/tag-trees/:id  — 删除节点及子孙（CASCADE 自动处理）
router.delete('/tag-trees/:id', (req, res) => {
  pagesDb.run('DELETE FROM tag_trees WHERE id = ?', [req.params.id], function(err) {
    if (err)           return res.status(500).json({ error: err.message })
    if (!this.changes) return res.status(404).json({ error: 'tag not found' })
    res.json({ ok: true })
  })
})

// POST /api/tag-trees/:id/move  — 移动到新父节点
router.post('/tag-trees/:id/move', (req, res) => {
  const { newParentId = null, position } = req.body
  const tagId = req.params.id

  // 防止移动到自身或子孙（简单：检查目标父节点不在当前节点的子树中）
  function isDescendant(ancestorId, targetId, cb) {
    if (!targetId) return cb(null, false)
    if (targetId === ancestorId) return cb(null, true)
    pagesDb.get('SELECT parent_id FROM tag_trees WHERE id = ?', [targetId], (err, row) => {
      if (err || !row) return cb(err, false)
      isDescendant(ancestorId, row.parent_id, cb)
    })
  }

  isDescendant(tagId, newParentId, (err, cycle) => {
    if (err)   return res.status(500).json({ error: err.message })
    if (cycle) return res.status(400).json({ error: 'cannot move node into its own subtree' })

    // 如果 newParentId 非空，确认目标存在
    const checkParent = newParentId
      ? (cb) => pagesDb.get('SELECT id FROM tag_trees WHERE id = ?', [newParentId], (e, r) => {
          if (e)  return cb(e)
          if (!r) return cb(new Error('target parent not found'))
          cb(null)
        })
      : (cb) => cb(null)

    checkParent(e2 => {
      if (e2) return res.status(404).json({ error: e2.message })

      getSiblings(newParentId, (e3, siblings) => {
        if (e3) return res.status(500).json({ error: e3.message })
        // 移除自身（如果已在同父）
        const filtered = siblings.filter(s => s.id !== tagId)
        const sortOrder = calcSortOrder(filtered, position)

        const parentSql = newParentId ? 'parent_id = ?' : 'parent_id = NULL'
        const params    = newParentId ? [newParentId, sortOrder, tagId] : [sortOrder, tagId]
        pagesDb.run(
          `UPDATE tag_trees SET ${parentSql}, sort_order = ? WHERE id = ?`,
          params,
          function(e4) {
            if (e4)           return res.status(500).json({ error: e4.message })
            if (!this.changes) return res.status(404).json({ error: 'tag not found' })
            res.json({ ok: true })
          }
        )
      })
    })
  })
})

// ══════════════════════════════════════════════════════════════
// AOP — PRVSE 三问打标 & TagTree 迁移 pipeline
// ══════════════════════════════════════════════════════════════

function genMigId() {
  return `mig-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}
function genDiffId() {
  return `diff-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

// ── prvse-classifications ───────────────────────────────────

// GET /api/prvse-classifications?entity_id=X&entity_type=Y
router.get('/prvse-classifications', (req, res) => {
  const { entity_id, entity_type } = req.query
  if (!entity_id || !entity_type)
    return res.status(400).json({ error: 'entity_id and entity_type are required' })
  pagesDb.get(
    'SELECT * FROM prvse_classifications WHERE entity_id = ? AND entity_type = ?',
    [entity_id, entity_type],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message })
      if (!row) return res.json(null)
      res.json({
        ...row,
        from_tags:  JSON.parse(row.from_tags  || '[]'),
        what_tags:  JSON.parse(row.what_tags  || '[]'),
        where_tags: JSON.parse(row.where_tags || '[]'),
        from_text:  row.from_text  || '',
        what_text:  row.what_text  || '',
        where_text: row.where_text || '',
      })
    }
  )
})

// PUT /api/prvse-classifications  — upsert
router.put('/prvse-classifications', (req, res) => {
  const { entity_id, entity_type, layer = '', from_tags = [], what_tags = [], where_tags = [], description = '',
          from_text = '', what_text = '', where_text = '' } = req.body
  if (!entity_id || !entity_type)
    return res.status(400).json({ error: 'entity_id and entity_type are required' })
  pagesDb.run(
    `INSERT INTO prvse_classifications
       (entity_id, entity_type, layer, from_tags, what_tags, where_tags, description,
        from_text, what_text, where_text, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?, datetime('now'))
     ON CONFLICT(entity_id, entity_type) DO UPDATE SET
       layer=excluded.layer, from_tags=excluded.from_tags, what_tags=excluded.what_tags,
       where_tags=excluded.where_tags, description=excluded.description,
       from_text=excluded.from_text, what_text=excluded.what_text, where_text=excluded.where_text,
       updated_at=excluded.updated_at`,
    [entity_id, entity_type, layer,
     JSON.stringify(from_tags), JSON.stringify(what_tags), JSON.stringify(where_tags),
     description, from_text, what_text, where_text],
    function(err) {
      if (err) return res.status(500).json({ error: err.message })
      res.json({ ok: true })
    }
  )
})

// ── tag-migrations ──────────────────────────────────────────

// GET /api/tag-migrations
router.get('/tag-migrations', (req, res) => {
  pagesDb.all('SELECT * FROM tag_tree_migrations ORDER BY created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message })
    res.json(rows)
  })
})

// POST /api/tag-migrations
router.post('/tag-migrations', (req, res) => {
  const { title, description = '' } = req.body
  if (!title) return res.status(400).json({ error: 'title is required' })
  const id = genMigId()
  pagesDb.run(
    `INSERT INTO tag_tree_migrations (id, title, description) VALUES (?,?,?)`,
    [id, title, description],
    function(err) {
      if (err) return res.status(500).json({ error: err.message })
      res.status(201).json({ id, title, description, status: 'draft', affected_count: 0, applied_count: 0 })
    }
  )
})

// PATCH /api/tag-migrations/:id
router.patch('/tag-migrations/:id', (req, res) => {
  const { title, description } = req.body
  const sets = []; const params = []
  if (title       !== undefined) { sets.push('title = ?');       params.push(title) }
  if (description !== undefined) { sets.push('description = ?'); params.push(description) }
  if (!sets.length) return res.status(400).json({ error: 'nothing to update' })
  params.push(req.params.id)
  pagesDb.run(`UPDATE tag_tree_migrations SET ${sets.join(', ')} WHERE id = ?`, params, function(err) {
    if (err)           return res.status(500).json({ error: err.message })
    if (!this.changes) return res.status(404).json({ error: 'migration not found' })
    res.json({ ok: true })
  })
})

// DELETE /api/tag-migrations/:id
router.delete('/tag-migrations/:id', (req, res) => {
  pagesDb.run('DELETE FROM tag_tree_migrations WHERE id = ?', [req.params.id], function(err) {
    if (err)           return res.status(500).json({ error: err.message })
    if (!this.changes) return res.status(404).json({ error: 'migration not found' })
    res.json({ ok: true })
  })
})

// POST /api/tag-migrations/:id/run  — AI重打标（生成 Diff，待审核）
router.post('/tag-migrations/:id/run', async (req, res) => {
  const migId = req.params.id
  pagesDb.get('SELECT * FROM tag_tree_migrations WHERE id = ?', [migId], async (err, mig) => {
    if (err)  return res.status(500).json({ error: err.message })
    if (!mig) return res.status(404).json({ error: 'migration not found' })

    // 更新状态为 running
    pagesDb.run(`UPDATE tag_tree_migrations SET status='running', started_at=datetime('now') WHERE id=?`, [migId])

    // 获取所有打标记录
    pagesDb.all('SELECT * FROM prvse_classifications', [], async (e2, entities) => {
      if (e2) return res.status(500).json({ error: e2.message })

      // 获取标签树（作为 context）
      pagesDb.all('SELECT id, parent_id, name FROM tag_trees ORDER BY sort_order', [], async (e3, tagRows) => {
        if (e3) return res.status(500).json({ error: e3.message })

        const tagTree = buildTree(tagRows)
        const tagTreeStr = JSON.stringify(tagTree, null, 2)

        // 调用 SEAI LLM（通过内部 /api/llm/chat，需要系统级别调用）
        const systemPrompt = `你是一个标签迁移助手。用户提供了旧标签体系和迁移规则，你需要将每个实体的旧标签按照规则重新打标。
当前标签语义树结构：
${tagTreeStr}

迁移规则（用户描述）：
${mig.description}

对每个实体，输出 JSON 格式：
{
  "entity_id": "...",
  "new_layer": "P|V|S|R",
  "new_from_tags": ["tag_id", ...],
  "new_what_tags": ["tag_id", ...],
  "new_where_tags": ["tag_id", ...],
  "confidence": 0.0-1.0
}`

        const messages = entities.map(e => ({
          role: 'user',
          content: `实体 ${e.entity_id} (${e.entity_type}):\n旧: layer=${e.layer}, from=${e.from_tags}, what=${e.what_tags}, where=${e.where_tags}\n描述: ${e.description}`
        }))

        // 批量调用 LLM
        let results = []
        try {
          const llmRes = await fetch('http://localhost:3002/api/llm/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: [
                { role: 'user', content: systemPrompt + '\n\n待重打标实体列表:\n' + entities.map(e =>
                  `entity_id: ${e.entity_id}, entity_type: ${e.entity_type}, layer: ${e.layer}, ` +
                  `from_tags: ${e.from_tags}, what_tags: ${e.what_tags}, where_tags: ${e.where_tags}, description: ${e.description}`
                ).join('\n') }
              ]
            })
          })
          const llmData = await llmRes.json()
          const text = llmData.content || llmData.message || ''
          // 尝试解析 JSON 数组
          const match = text.match(/\[[\s\S]*\]/)
          if (match) results = JSON.parse(match[0])
        } catch (llmErr) {
          // AI 离线：仍然创建 Diff，但标为低置信度
          results = entities.map(e => ({
            entity_id: e.entity_id,
            new_layer: e.layer,
            new_from_tags: JSON.parse(e.from_tags || '[]'),
            new_what_tags: JSON.parse(e.what_tags || '[]'),
            new_where_tags: JSON.parse(e.where_tags || '[]'),
            confidence: 0
          }))
        }

        // 写入 Diff 记录
        const stmt = pagesDb.prepare(
          `INSERT OR IGNORE INTO prvse_reclassify_diffs
           (id, migration_id, entity_id, entity_type, entity_desc,
            old_layer, old_from_tags, old_what_tags, old_where_tags,
            new_layer, new_from_tags, new_what_tags, new_where_tags,
            confidence)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
        )

        const entityMap = {}
        for (const e of entities) entityMap[e.entity_id] = e

        for (const r of results) {
          const orig = entityMap[r.entity_id]
          if (!orig) continue
          stmt.run([
            genDiffId(), migId, r.entity_id, orig.entity_type, orig.description,
            orig.layer, orig.from_tags, orig.what_tags, orig.where_tags,
            r.new_layer,
            JSON.stringify(r.new_from_tags || []),
            JSON.stringify(r.new_what_tags || []),
            JSON.stringify(r.new_where_tags || []),
            r.confidence ?? 0
          ])
        }
        stmt.finalize()

        pagesDb.run(
          `UPDATE tag_tree_migrations SET status='done', affected_count=? WHERE id=?`,
          [results.length, migId]
        )

        res.json({ ok: true, affected: results.length })
      })
    })
  })
})

// GET /api/tag-migrations/:id/diffs
router.get('/tag-migrations/:id/diffs', (req, res) => {
  pagesDb.all(
    'SELECT * FROM prvse_reclassify_diffs WHERE migration_id = ? ORDER BY created_at',
    [req.params.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json(rows.map(r => ({
        ...r,
        old_from_tags:  JSON.parse(r.old_from_tags  || '[]'),
        old_what_tags:  JSON.parse(r.old_what_tags  || '[]'),
        old_where_tags: JSON.parse(r.old_where_tags || '[]'),
        new_from_tags:  JSON.parse(r.new_from_tags  || '[]'),
        new_what_tags:  JSON.parse(r.new_what_tags  || '[]'),
        new_where_tags: JSON.parse(r.new_where_tags || '[]'),
      })))
    }
  )
})

// POST /api/tag-migrations/:id/diffs/:diffId/review  — approve | reject
router.post('/tag-migrations/:id/diffs/:diffId/review', (req, res) => {
  const { action } = req.body  // 'approve' | 'reject'
  if (!['approve', 'reject'].includes(action))
    return res.status(400).json({ error: 'action must be approve or reject' })
  pagesDb.run(
    `UPDATE prvse_reclassify_diffs SET review_status=? WHERE id=? AND migration_id=?`,
    [action === 'approve' ? 'approved' : 'rejected', req.params.diffId, req.params.id],
    function(err) {
      if (err)           return res.status(500).json({ error: err.message })
      if (!this.changes) return res.status(404).json({ error: 'diff not found' })
      res.json({ ok: true })
    }
  )
})

// POST /api/tag-migrations/:id/apply  — 将 approved diffs 写回 prvse_classifications
router.post('/tag-migrations/:id/apply', (req, res) => {
  const migId = req.params.id
  pagesDb.all(
    `SELECT * FROM prvse_reclassify_diffs WHERE migration_id=? AND review_status='approved'`,
    [migId],
    (err, diffs) => {
      if (err) return res.status(500).json({ error: err.message })

      let applied = 0
      const finish = () => {
        pagesDb.run(
          `UPDATE tag_tree_migrations SET applied_count=?, applied_at=datetime('now') WHERE id=?`,
          [applied, migId]
        )
        res.json({ ok: true, applied })
      }

      if (!diffs.length) return finish()

      let done = 0
      for (const d of diffs) {
        pagesDb.run(
          `INSERT INTO prvse_classifications (entity_id, entity_type, layer, from_tags, what_tags, where_tags, updated_at)
           VALUES (?,?,?,?,?,?, datetime('now'))
           ON CONFLICT(entity_id, entity_type) DO UPDATE SET
             layer=excluded.layer, from_tags=excluded.from_tags, what_tags=excluded.what_tags,
             where_tags=excluded.where_tags, updated_at=excluded.updated_at`,
          [d.entity_id, d.entity_type, d.new_layer, d.new_from_tags, d.new_what_tags, d.new_where_tags],
          function(e) {
            if (!e) applied++
            if (++done === diffs.length) finish()
          }
        )
      }
    }
  )
})

module.exports = { init: () => router }
