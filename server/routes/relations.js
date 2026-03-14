/**
 * routes/relations.js
 * /api/relations — 跨实体类型的开放描述边
 *
 * 实体类型（source_type / target_type）：
 *   'block' | 'memory' | 'task' | 'theory' | 'label' | 'label_system' | 任意字符串
 *
 * GET    /api/relations              ?source_id=&target_id=&source_type=&target_type=
 * POST   /api/relations
 * GET    /api/relations/:id
 * PATCH  /api/relations/:id
 * DELETE /api/relations/:id
 * POST   /api/relations/:id/publish
 * GET    /api/relations/:id/versions
 */

const express = require('express');
const router = express.Router();

let pagesDb;

function init(db) {
  pagesDb = db;
  return router;
}

function genId(prefix = 'rel') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const now = () => new Date().toISOString();

// ── GET /api/relations ────────────────────────────────────────
router.get('/relations', (req, res) => {
  const { source_id, target_id, source_type, target_type } = req.query;
  let sql = 'SELECT * FROM relations WHERE 1=1';
  const params = [];

  if (source_id)   { sql += ' AND source_id = ?';   params.push(source_id); }
  if (target_id)   { sql += ' AND target_id = ?';   params.push(target_id); }
  if (source_type) { sql += ' AND source_type = ?'; params.push(source_type); }
  if (target_type) { sql += ' AND target_type = ?'; params.push(target_type); }

  sql += ' ORDER BY created_at DESC';

  pagesDb.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ── POST /api/relations ────────────────────────────────────────
router.post('/relations', (req, res) => {
  const {
    title = '',
    source_type, source_id,
    target_type, target_id,
    description = '',
  } = req.body;

  if (!source_type || !source_id || !target_type || !target_id) {
    return res.status(400).json({ error: 'source_type/source_id/target_type/target_id 必填' });
  }

  const id = genId('rel');
  const creator = req.user ? `human:${req.user.username}` : 'unknown';
  const ts = now();

  pagesDb.run(
    `INSERT INTO relations (id, title, source_type, source_id, target_type, target_id, description, creator, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, title, source_type, source_id, target_type, target_id, description, creator, ts, ts],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id, title, source_type, source_id, target_type, target_id, description, creator, created_at: ts, updated_at: ts });
    }
  );
});

// ── GET /api/relations/:id ─────────────────────────────────────
router.get('/relations/:id', (req, res) => {
  pagesDb.get('SELECT * FROM relations WHERE id = ?', [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Relation 不存在' });
    res.json(row);
  });
});

// ── PATCH /api/relations/:id ───────────────────────────────────
router.patch('/relations/:id', (req, res) => {
  const { title, description, properties } = req.body;
  const updates = ['updated_at = ?'];
  const params = [now()];

  if (title       !== undefined) { updates.push('title = ?');       params.push(title); }
  if (description !== undefined) { updates.push('description = ?'); params.push(description); }
  if (properties  !== undefined) { updates.push('properties = ?');  params.push(typeof properties === 'string' ? properties : JSON.stringify(properties)); }

  if (updates.length === 1) return res.status(400).json({ error: '没有要更新的字段' });
  params.push(req.params.id);

  pagesDb.run(`UPDATE relations SET ${updates.join(', ')} WHERE id = ?`, params, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Relation 不存在' });
    pagesDb.get('SELECT * FROM relations WHERE id = ?', [req.params.id], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(row);
    });
  });
});

// ── DELETE /api/relations/:id ──────────────────────────────────
router.delete('/relations/:id', (req, res) => {
  pagesDb.run('DELETE FROM relations WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Relation 不存在' });
    res.json({ ok: true });
  });
});

// ── POST /api/relations/:id/publish ───────────────────────────
router.post('/relations/:id/publish', (req, res) => {
  const { explanation = '' } = req.body;

  pagesDb.get('SELECT * FROM relations WHERE id = ?', [req.params.id], (err, rel) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!rel) return res.status(404).json({ error: 'Relation 不存在' });

    pagesDb.get(
      'SELECT COUNT(*) as cnt FROM process_versions WHERE entity_id = ?',
      [req.params.id],
      (err, row) => {
        if (err) return res.status(500).json({ error: err.message });

        const versionNum = (row?.cnt || 0) + 1;
        const versionId = genId('pv');
        const publisher = req.user ? `human:${req.user.username}` : 'unknown';
        const publishTime = now();

        const contentSnapshot = JSON.stringify({
          title: rel.title,
          source_type: rel.source_type,
          source_id: rel.source_id,
          target_type: rel.target_type,
          target_id: rel.target_id,
          description: rel.description,
        });

        pagesDb.run(
          `INSERT INTO process_versions (id, entity_id, entity_type, version_num, start_time, publish_time, publisher, title_snapshot, content_snapshot, explanation)
           VALUES (?, ?, 'relation', ?, ?, ?, ?, ?, ?, ?)`,
          [versionId, req.params.id, versionNum, rel.created_at, publishTime, publisher, rel.title, contentSnapshot, explanation],
          function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({
              id: versionId,
              entity_id: req.params.id,
              entity_type: 'relation',
              version_num: versionNum,
              publish_time: publishTime,
              publisher,
              explanation,
            });
          }
        );
      }
    );
  });
});

// ── GET /api/relations/:id/blocks ──────────────────────────────
router.get('/relations/:id/blocks', (req, res) => {
  pagesDb.all(
    `SELECT id, relation_id, parent_id as parentId, type, content, position, metadata,
            collapsed, title, creator, edit_start_time as editStartTime,
            draft_explanation as draftExplanation,
            created_at as createdAt, updated_at as updatedAt
     FROM relation_blocks WHERE relation_id = ? ORDER BY position`,
    [req.params.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows.map(r => ({
        ...r,
        content: JSON.parse(r.content || '{}'),
        metadata: JSON.parse(r.metadata || '{}'),
      })));
    }
  );
});

// ── PUT /api/relations/:id/blocks ───────────────────────────────
router.put('/relations/:id/blocks', (req, res) => {
  const relationId = req.params.id;
  const blocks = req.body;
  if (!Array.isArray(blocks)) return res.status(400).json({ error: 'body 须为数组' });

  pagesDb.run('BEGIN', (err) => {
    if (err) return res.status(500).json({ error: err.message });

    pagesDb.run('DELETE FROM relation_blocks WHERE relation_id = ?', [relationId], (err) => {
      if (err) { pagesDb.run('ROLLBACK'); return res.status(500).json({ error: err.message }); }

      if (blocks.length === 0) {
        pagesDb.run('COMMIT');
        return res.json([]);
      }

      let done = 0;
      const ts = now();
      for (const b of blocks) {
        const id = b.id || genId('rb');
        pagesDb.run(
          `INSERT INTO relation_blocks
             (id, relation_id, parent_id, type, content, position, metadata,
              collapsed, title, creator, edit_start_time, draft_explanation, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,COALESCE(?,?),?)`,
          [
            id, relationId, b.parentId || null, b.type || 'paragraph',
            JSON.stringify(b.content || {}), b.position ?? 1.0,
            JSON.stringify(b.metadata || {}), b.collapsed ? 1 : 0,
            b.title || '', b.creator || '',
            b.editStartTime || null, b.draftExplanation || '',
            b.createdAt || null, ts, ts,
          ],
          (err) => {
            if (err) { pagesDb.run('ROLLBACK'); return res.status(500).json({ error: err.message }); }
            done++;
            if (done === blocks.length) {
              pagesDb.run('COMMIT');
              res.json(blocks);
            }
          }
        );
      }
    });
  });
});

// ── GET /api/relations/:id/versions ───────────────────────────
router.get('/relations/:id/versions', (req, res) => {
  pagesDb.all(
    'SELECT * FROM process_versions WHERE entity_id = ? AND entity_type = ? ORDER BY version_num ASC',
    [req.params.id, 'relation'],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows.map(v => ({
        ...v,
        content_snapshot: JSON.parse(v.content_snapshot || '{}'),
      })));
    }
  );
});

module.exports = { init };
