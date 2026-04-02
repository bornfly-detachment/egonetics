/**
 * server/routes/aop.js
 * PRVSE AOP API
 *
 * POST /api/aop/run         — 触发 AOP pipeline（T0→T1→宪法路由）
 * GET  /api/aop/:entityType/:entityId  — 查询 AOP 状态和结果
 * PUT  /api/aop/override    — 人工打标覆盖（冲突处理）
 */

const express  = require('express')
const router   = express.Router()
const { runAOP } = require('../lib/prvse-aop')

let pagesDb = null

function init(db) {
  pagesDb = db
  return router
}

// POST /api/aop/run
// body: { entityId, entityType, content, sourceMeta, layer }
router.post('/aop/run', async (req, res) => {
  const { entityId, entityType, content = '', sourceMeta = {}, layer = 'P' } = req.body
  if (!entityId || !entityType)
    return res.status(400).json({ error: 'entityId and entityType required' })

  try {
    // 异步运行（不阻塞响应）：先返回 202 Accepted，pipeline 后台跑
    res.status(202).json({ ok: true, status: 'running', entityId, entityType })

    runAOP(pagesDb, { entityId, entityType, content, sourceMeta, layer })
      .then(result => {
        console.log(`[aop] ${entityId} → ${result.status}`, result.needs_human_review ? '⚠️ needs human' : '✓')
      })
      .catch(err => {
        console.error(`[aop] ${entityId} error:`, err.message)
      })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/aop/run/sync  — 同步版本（等待结果，供测试用）
router.post('/aop/run/sync', async (req, res) => {
  const { entityId, entityType, content = '', sourceMeta = {}, layer = 'P' } = req.body
  if (!entityId || !entityType)
    return res.status(400).json({ error: 'entityId and entityType required' })

  try {
    const result = await runAOP(pagesDb, { entityId, entityType, content, sourceMeta, layer })
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/aop/:entityType/:entityId  — 查询 AOP 结果
router.get('/aop/:entityType/:entityId', (req, res) => {
  const { entityType, entityId } = req.params
  pagesDb.get(
    'SELECT * FROM prvse_classifications WHERE entity_id = ? AND entity_type = ?',
    [entityId, entityType],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message })
      if (!row) return res.json(null)
      res.json({
        ...row,
        from_tags:         JSON.parse(row.from_tags         || '[]'),
        what_tags:         JSON.parse(row.what_tags         || '[]'),
        where_tags:        JSON.parse(row.where_tags        || '[]'),
        source_meta:       JSON.parse(row.source_meta       || '{}'),
        t0_result:         JSON.parse(row.t0_result         || '{}'),
        t1_result:         JSON.parse(row.t1_result         || '{}'),
        conflicts:         JSON.parse(row.conflicts         || '[]'),
        constitution_route: JSON.parse(row.constitution_route || '{}'),
        needs_human_review: !!row.needs_human_review,
      })
    }
  )
})

// PUT /api/aop/override  — 人工打标（冲突解决 / bornfly 手动覆盖）
// body: { entityId, entityType, from_tags, what_tags, where_tags, from_text, what_text, where_text, layer }
router.put('/aop/override', (req, res) => {
  const {
    entityId, entityType,
    from_tags = [], what_tags = [], where_tags = [],
    from_text = '', what_text = '', where_text = '',
    layer = 'P',
  } = req.body
  if (!entityId || !entityType)
    return res.status(400).json({ error: 'entityId and entityType required' })

  pagesDb.run(
    `UPDATE prvse_classifications SET
       from_tags = ?, what_tags = ?, where_tags = ?,
       from_text = ?, what_text = ?, where_text = ?,
       layer = ?,
       aop_status = 'human_reviewed',
       needs_human_review = 0,
       updated_at = datetime('now')
     WHERE entity_id = ? AND entity_type = ?`,
    [
      JSON.stringify(from_tags), JSON.stringify(what_tags), JSON.stringify(where_tags),
      from_text, what_text, where_text,
      layer,
      entityId, entityType,
    ],
    function(err) {
      if (err) return res.status(500).json({ error: err.message })
      if (this.changes === 0) return res.status(404).json({ error: 'classification not found' })
      res.json({ ok: true, status: 'human_reviewed' })
    }
  )
})

module.exports = { router, init }
