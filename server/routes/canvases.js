/**
 * routes/canvases.js
 * 自由画布 CRUD + 画布节点管理
 *
 * GET    /api/canvases
 * POST   /api/canvases
 * PATCH  /api/canvases/:id
 * DELETE /api/canvases/:id
 *
 * GET    /api/canvases/:id/nodes
 * POST   /api/canvases/:id/nodes
 * PATCH  /api/canvases/:id/nodes/:nodeId
 * DELETE /api/canvases/:id/nodes/:nodeId
 */

const express = require('express');
const router = express.Router();

let pagesDb;

function init(db) {
  pagesDb = db;
  return router;
}

function genId(prefix = 'cvs') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const now = () => new Date().toISOString();

// ── GET /api/canvases ─────────────────────────────────────────────
// ?type=semantic|execution  — 按 canvas_type 过滤
router.get('/canvases', (req, res) => {
  const { type } = req.query;
  let sql = `SELECT c.*, COUNT(n.id) as node_count
     FROM canvases c
     LEFT JOIN canvas_nodes n ON n.canvas_id = c.id`;
  const params = [];
  if (type) { sql += ' WHERE c.canvas_type = ?'; params.push(type); }
  sql += ' GROUP BY c.id ORDER BY c.updated_at DESC';

  pagesDb.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ── POST /api/canvases ────────────────────────────────────────────
router.post('/canvases', (req, res) => {
  const { title = '新画布', description = '', canvasType = 'semantic', taskRefId } = req.body;
  const id = genId('cvs');
  const created_by = req.user ? `human:${req.user.username}` : 'unknown';
  const ts = now();

  pagesDb.run(
    `INSERT INTO canvases (id, title, description, created_by, canvas_type, task_ref_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, title, description, created_by, canvasType, taskRefId || null, ts, ts],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id, title, description, created_by, canvas_type: canvasType,
        task_ref_id: taskRefId || null, node_count: 0, created_at: ts, updated_at: ts });
    }
  );
});

// ── PATCH /api/canvases/:id ───────────────────────────────────────
router.patch('/canvases/:id', (req, res) => {
  const { title, description } = req.body;
  const updates = ['updated_at = ?'];
  const params = [now()];

  if (title !== undefined)       { updates.push('title = ?');       params.push(title); }
  if (description !== undefined) { updates.push('description = ?'); params.push(description); }

  params.push(req.params.id);

  pagesDb.run(`UPDATE canvases SET ${updates.join(', ')} WHERE id = ?`, params, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: '画布不存在' });
    pagesDb.get(
      `SELECT c.*, COUNT(n.id) as node_count FROM canvases c LEFT JOIN canvas_nodes n ON n.canvas_id = c.id WHERE c.id = ? GROUP BY c.id`,
      [req.params.id],
      (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row);
      }
    );
  });
});

// ── DELETE /api/canvases/:id ──────────────────────────────────────
router.delete('/canvases/:id', (req, res) => {
  pagesDb.run('DELETE FROM canvases WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: '画布不存在' });
    res.json({ ok: true });
  });
});

// ── GET /api/canvases/:id ─────────────────────────────────────────
router.get('/canvases/:id', (req, res) => {
  pagesDb.get(
    `SELECT c.*, COUNT(n.id) as node_count
     FROM canvases c LEFT JOIN canvas_nodes n ON n.canvas_id = c.id
     WHERE c.id = ? GROUP BY c.id`,
    [req.params.id],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: '画布不存在' });
      res.json(row);
    }
  );
});

// ── GET /api/canvases/:id/nodes ───────────────────────────────────
router.get('/canvases/:id/nodes', (req, res) => {
  pagesDb.all(
    `SELECT * FROM canvas_nodes WHERE canvas_id = ? ORDER BY created_at ASC`,
    [req.params.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// ── POST /api/canvases/:id/nodes ──────────────────────────────────
router.post('/canvases/:id/nodes', (req, res) => {
  const {
    entity_type, entity_id,
    x = 100, y = 100, expanded_level = 0,
    node_kind = 'entity',
    exec_config = {},
  } = req.body;
  if (!entity_type || !entity_id) {
    return res.status(400).json({ error: 'entity_type + entity_id 必填' });
  }

  const id = genId('node');
  const ts = now();
  const execConfigStr = typeof exec_config === 'string' ? exec_config : JSON.stringify(exec_config);

  pagesDb.run(
    `INSERT OR IGNORE INTO canvas_nodes
       (id, canvas_id, entity_type, entity_id, x, y, expanded_level, node_kind, exec_config, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, req.params.id, entity_type, entity_id, x, y, expanded_level, node_kind, execConfigStr, ts],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) {
        // Already exists — return existing node
        pagesDb.get(
          `SELECT * FROM canvas_nodes WHERE canvas_id = ? AND entity_type = ? AND entity_id = ?`,
          [req.params.id, entity_type, entity_id],
          (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            res.status(200).json(row);
          }
        );
        return;
      }
      // Update canvas updated_at
      pagesDb.run(`UPDATE canvases SET updated_at = ? WHERE id = ?`, [ts, req.params.id]);
      res.status(201).json({
        id, canvas_id: req.params.id, entity_type, entity_id, x, y, expanded_level,
        node_kind, exec_config: execConfigStr,
        lifecycle_state: 'pending', cost_snapshot: '{}',
        created_at: ts,
      });
    }
  );
});

// ── PATCH /api/canvases/:id/nodes/:nodeId ────────────────────────
router.patch('/canvases/:id/nodes/:nodeId', (req, res) => {
  const { x, y, expanded_level, collapsed, tree_expanded,
          node_kind, lifecycle_state, exec_config, cost_snapshot } = req.body;
  const updates = [];
  const params = [];

  if (x !== undefined)               { updates.push('x = ?');               params.push(x); }
  if (y !== undefined)               { updates.push('y = ?');               params.push(y); }
  if (expanded_level !== undefined)  { updates.push('expanded_level = ?');  params.push(expanded_level); }
  if (collapsed !== undefined)       { updates.push('collapsed = ?');       params.push(collapsed); }
  if (tree_expanded !== undefined)   { updates.push('tree_expanded = ?');   params.push(tree_expanded); }
  if (node_kind !== undefined)       { updates.push('node_kind = ?');       params.push(node_kind); }
  if (lifecycle_state !== undefined) { updates.push('lifecycle_state = ?'); params.push(lifecycle_state); }
  if (exec_config !== undefined) {
    const v = typeof exec_config === 'string' ? exec_config : JSON.stringify(exec_config);
    updates.push('exec_config = ?'); params.push(v);
  }
  if (cost_snapshot !== undefined) {
    const v = typeof cost_snapshot === 'string' ? cost_snapshot : JSON.stringify(cost_snapshot);
    updates.push('cost_snapshot = ?'); params.push(v);
  }

  if (updates.length === 0) return res.status(400).json({ error: '没有要更新的字段' });
  params.push(req.params.nodeId);

  pagesDb.run(`UPDATE canvas_nodes SET ${updates.join(', ')} WHERE id = ?`, params, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: '节点不存在' });
    pagesDb.get('SELECT * FROM canvas_nodes WHERE id = ?', [req.params.nodeId], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(row);
    });
  });
});

// ── DELETE /api/canvases/:id/nodes/:nodeId ────────────────────────
router.delete('/canvases/:id/nodes/:nodeId', (req, res) => {
  pagesDb.run('DELETE FROM canvas_nodes WHERE id = ?', [req.params.nodeId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: '节点不存在' });
    res.json({ ok: true });
  });
});

module.exports = { init };
