/**
 * PRVSE Graph CRUD
 * GET    /api/tasks/:taskId/graph          — 获取图（节点+边）
 * POST   /api/tasks/:taskId/graph/nodes    — 新增节点
 * PATCH  /api/tasks/:taskId/graph/nodes/:nodeId  — 更新节点
 * DELETE /api/tasks/:taskId/graph/nodes/:nodeId  — 删除节点（级联删边）
 * POST   /api/tasks/:taskId/graph/edges    — 新增边
 * DELETE /api/tasks/:taskId/graph/edges/:edgeId  — 删除边
 */
const express = require('express')
const router = express.Router({ mergeParams: true })

let _db = null
router.use((req, _, next) => { req.pagesDb = _db; next() })
exports.init = (db) => { _db = db }
exports.router = router

function genId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

// GET /api/tasks/:taskId/graph
router.get('/', (req, res) => {
  const { taskId } = req.params
  const db = req.pagesDb
  db.all('SELECT * FROM prvse_graph_nodes WHERE task_id=? ORDER BY created_at', [taskId], (e1, nodes) => {
    if (e1) return res.status(500).json({ error: e1.message })
    db.all('SELECT * FROM prvse_graph_edges WHERE task_id=? ORDER BY created_at', [taskId], (e2, edges) => {
      if (e2) return res.status(500).json({ error: e2.message })
      const parse = (n) => ({
        ...n,
        from_tags:  JSON.parse(n.from_tags  || '[]'),
        who_tags:   JSON.parse(n.who_tags   || '[]'),
        to_tags:    JSON.parse(n.to_tags    || '[]'),
        ai_aop:     JSON.parse(n.ai_aop     || '[]'),
        sensor_aop: JSON.parse(n.sensor_aop || '[]'),
        comm_aop:   JSON.parse(n.comm_aop   || '[]'),
        power:      JSON.parse(n.power      || '[]'),
        l0_data:    JSON.parse(n.l0_data    || '{}'),
        l1_data:    JSON.parse(n.l1_data    || '{}'),
        l2_data:    JSON.parse(n.l2_data    || '{}'),
      })
      res.json({ nodes: nodes.map(parse), edges })
    })
  })
})

// POST /api/tasks/:taskId/graph/nodes
router.post('/nodes', (req, res) => {
  const { taskId } = req.params
  const { node_type = 'P', label = '', x = 100, y = 100 } = req.body
  const id = genId('node')
  req.pagesDb.run(
    `INSERT INTO prvse_graph_nodes (id, task_id, node_type, label, x, y) VALUES (?,?,?,?,?,?)`,
    [id, taskId, node_type, label, x, y],
    function(err) {
      if (err) return res.status(500).json({ error: err.message })
      req.pagesDb.get('SELECT * FROM prvse_graph_nodes WHERE id=?', [id], (e2, row) => {
        if (e2) return res.status(500).json({ error: e2.message })
        res.status(201).json({
          ...row,
          from_tags: [], who_tags: [], to_tags: [],
          ai_aop: [], sensor_aop: [], comm_aop: [], power: [],
        })
      })
    }
  )
})

// PATCH /api/tasks/:taskId/graph/nodes/:nodeId
router.patch('/nodes/:nodeId', (req, res) => {
  const { nodeId } = req.params
  const fields = ['label','x','y','from_tags','who_tags','to_tags',
                  'ai_aop','sensor_aop','comm_aop','content','author','power',
                  'l0_data','l1_data','l2_data','permission_level','slider_value']
  const sets = [], vals = []
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      sets.push(`${f}=?`)
      vals.push(typeof req.body[f] === 'object' ? JSON.stringify(req.body[f]) : req.body[f])
    }
  }
  if (!sets.length) return res.json({ ok: true })
  vals.push(nodeId)
  req.pagesDb.run(`UPDATE prvse_graph_nodes SET ${sets.join(',')} WHERE id=?`, vals, function(err) {
    if (err) return res.status(500).json({ error: err.message })
    res.json({ ok: true })
  })
})

// DELETE /api/tasks/:taskId/graph/nodes/:nodeId
router.delete('/nodes/:nodeId', (req, res) => {
  const { nodeId, taskId } = req.params
  const db = req.pagesDb
  db.run('DELETE FROM prvse_graph_edges WHERE task_id=? AND (source_id=? OR target_id=?)',
    [taskId, nodeId, nodeId], (e1) => {
      if (e1) return res.status(500).json({ error: e1.message })
      db.run('DELETE FROM prvse_graph_nodes WHERE id=?', [nodeId], function(err) {
        if (err) return res.status(500).json({ error: err.message })
        res.json({ ok: true })
      })
    })
})

// POST /api/tasks/:taskId/graph/edges
router.post('/edges', (req, res) => {
  const { taskId } = req.params
  const { source_id, target_id, edge_type = 'relation', label = '', constraint_type = 'directed', level = 'l1' } = req.body
  if (!source_id || !target_id) return res.status(400).json({ error: 'source_id and target_id required' })
  const id = genId('edge')
  req.pagesDb.run(
    `INSERT INTO prvse_graph_edges (id, task_id, source_id, target_id, edge_type, label, constraint_type, level) VALUES (?,?,?,?,?,?,?,?)`,
    [id, taskId, source_id, target_id, edge_type, label, constraint_type, level],
    function(err) {
      if (err) return res.status(500).json({ error: err.message })
      res.status(201).json({ id, task_id: taskId, source_id, target_id, edge_type, label, constraint_type, level })
    }
  )
})

// DELETE /api/tasks/:taskId/graph/edges/:edgeId
router.delete('/edges/:edgeId', (req, res) => {
  req.pagesDb.run('DELETE FROM prvse_graph_edges WHERE id=?', [req.params.edgeId], function(err) {
    if (err) return res.status(500).json({ error: err.message })
    res.json({ ok: true })
  })
})
