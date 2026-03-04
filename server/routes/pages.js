/**
 * routes/pages.js
 * /api/pages  — 页面 CRUD + 块编辑（符合 apiClient.ts 规范）
 * /api/notion — 兼容旧版 Notion Blocks API（使用 tasks.db 中的 blocks）
 */

const express = require('express');
const router = express.Router();

let pagesDb;
let tasksDb; // notion blocks 仍在 tasks.db

function init(dbs) {
  pagesDb = dbs.pagesDb;
  tasksDb = dbs.tasksDb;
  return router;
}

function genId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ── /api/pages ─────────────────────────────────────────────

// GET /api/pages?type=xxx&refId=xxx
router.get('/pages', (req, res) => {
  const { type, refId } = req.query;
  let sql = 'SELECT id, parent_id as parentId, page_type as pageType, ref_id as refId, title, icon, position, created_at as createdAt, updated_at as updatedAt FROM pages WHERE 1=1';
  const params = [];
  if (type)  { sql += ' AND page_type = ?'; params.push(type); }
  if (refId) { sql += ' AND ref_id = ?';    params.push(refId); }
  sql += ' ORDER BY position';

  pagesDb.all(sql, params, (err, pages) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(pages);
  });
});

// POST /api/pages
router.post('/pages', (req, res) => {
  const { parentId, title = '未命名页面', icon = '📄', position = 1.0, pageType = 'page', refId } = req.body;
  const id = genId('page');

  pagesDb.run(
    'INSERT INTO pages (id, parent_id, page_type, ref_id, title, icon, position) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, parentId || null, pageType, refId || null, title, icon, position],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({
        id, parentId: parentId || null, pageType, refId: refId || null,
        title, icon, position,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      });
    }
  );
});

// PATCH /api/pages/:id
router.patch('/pages/:id', (req, res) => {
  const pageId = req.params.id;
  const { title, icon } = req.body;
  const updates = [], params = [];
  if (title !== undefined) { updates.push('title = ?'); params.push(title); }
  if (icon  !== undefined) { updates.push('icon = ?');  params.push(icon); }
  if (updates.length === 0) return res.status(400).json({ error: '没有要更新的字段' });
  params.push(pageId);

  pagesDb.run(`UPDATE pages SET ${updates.join(', ')} WHERE id = ?`, params, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: '页面不存在' });
    pagesDb.get(
      'SELECT id, parent_id as parentId, page_type as pageType, ref_id as refId, title, icon, position, created_at as createdAt, updated_at as updatedAt FROM pages WHERE id = ?',
      [pageId], (err, page) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(page);
      }
    );
  });
});

// DELETE /api/pages/:id
router.delete('/pages/:id', (req, res) => {
  const deletePageRecursive = (id, callback) => {
    pagesDb.all('SELECT id FROM pages WHERE parent_id = ?', [id], (err, children) => {
      if (err) return callback(err);
      if (children.length === 0) return pagesDb.run('DELETE FROM pages WHERE id = ?', [id], callback);

      let done = 0;
      children.forEach(child => {
        deletePageRecursive(child.id, (err) => {
          if (err) return callback(err);
          if (++done === children.length) pagesDb.run('DELETE FROM pages WHERE id = ?', [id], callback);
        });
      });
    });
  };

  deletePageRecursive(req.params.id, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true });
  });
});

// POST /api/pages/:id/move
router.post('/pages/:id/move', (req, res) => {
  const { newParentId, newPosition } = req.body;
  pagesDb.run(
    'UPDATE pages SET parent_id = ?, position = ? WHERE id = ?',
    [newParentId || null, newPosition, req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: '页面不存在' });
      pagesDb.get(
        'SELECT id, parent_id as parentId, page_type as pageType, ref_id as refId, title, icon, position, created_at as createdAt, updated_at as updatedAt FROM pages WHERE id = ?',
        [req.params.id], (err, page) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json(page);
        }
      );
    }
  );
});

// GET /api/pages/:id/blocks
router.get('/pages/:id/blocks', (req, res) => {
  pagesDb.all(
    'SELECT id, parent_id as parentId, type, content, position, metadata, collapsed, created_at as createdAt, updated_at as updatedAt FROM blocks WHERE page_id = ? ORDER BY position',
    [req.params.id], (err, blocks) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(blocks.map(b => ({
        ...b,
        content:  JSON.parse(b.content  || '{}'),
        metadata: JSON.parse(b.metadata || '{}')
      })));
    }
  );
});

// PUT /api/pages/:id/blocks
router.put('/pages/:id/blocks', (req, res) => {
  const pageId = req.params.id;
  const blocks = req.body;
  if (!Array.isArray(blocks)) return res.status(400).json({ error: 'blocks 必须是数组' });

  pagesDb.run('BEGIN TRANSACTION', (err) => {
    if (err) return res.status(500).json({ error: err.message });

    pagesDb.run('DELETE FROM blocks WHERE page_id = ?', [pageId], (err) => {
      if (err) { pagesDb.run('ROLLBACK'); return res.status(500).json({ error: err.message }); }

      if (blocks.length === 0) {
        return pagesDb.run('COMMIT', (err) => {
          if (err) { pagesDb.run('ROLLBACK'); return res.status(500).json({ error: err.message }); }
          res.json([]);
        });
      }

      let done = 0;
      blocks.forEach((block) => {
        const blockId  = block.id || genId('block');
        const content  = typeof block.content  === 'string' ? block.content  : JSON.stringify(block.content  || {});
        const metadata = typeof block.metadata === 'string' ? block.metadata : JSON.stringify(block.metadata || {});

        pagesDb.run(
          'INSERT INTO blocks (id, page_id, parent_id, type, content, position, metadata, collapsed) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [blockId, pageId, block.parentId || null, block.type || 'paragraph', content, block.position || 1.0, metadata, block.collapsed || false],
          (err) => {
            if (err) { pagesDb.run('ROLLBACK'); return res.status(500).json({ error: err.message }); }
            if (++done === blocks.length) {
              pagesDb.run('COMMIT', (err) => {
                if (err) { pagesDb.run('ROLLBACK'); return res.status(500).json({ error: err.message }); }
                pagesDb.all(
                  'SELECT id, parent_id as parentId, type, content, position, metadata, collapsed, created_at as createdAt, updated_at as updatedAt FROM blocks WHERE page_id = ? ORDER BY position',
                  [pageId], (err, saved) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json(saved.map(b => ({
                      ...b,
                      content:  JSON.parse(b.content  || '{}'),
                      metadata: JSON.parse(b.metadata || '{}')
                    })));
                  }
                );
              });
            }
          }
        );
      });
    });
  });
});

// ── /api/notion (兼容旧版，blocks 在 tasksDb) ─────────────

router.get('/notion/pages/:pageId/blocks', (req, res) => {
  tasksDb.all('SELECT * FROM blocks WHERE page_id = ? ORDER BY position', [req.params.pageId], (err, blocks) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ blocks });
  });
});

router.get('/notion/blocks/:blockId/children', (req, res) => {
  tasksDb.all('SELECT * FROM blocks WHERE parent_id = ? ORDER BY position', [req.params.blockId], (err, blocks) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ blocks });
  });
});

router.post('/notion/blocks', (req, res) => {
  const { pageId, parentId, type, content, position } = req.body;
  const id = genId('block');
  tasksDb.run(
    'INSERT INTO blocks (id, page_id, parent_id, type, content, position) VALUES (?, ?, ?, ?, ?, ?)',
    [id, pageId, parentId || null, type || 'paragraph', content || '{}', position || 1.0],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id });
    }
  );
});

router.put('/notion/blocks/:id', (req, res) => {
  const { type, content, position } = req.body;
  const updates = [], params = [];
  if (type     !== undefined) { updates.push('type = ?');     params.push(type); }
  if (content  !== undefined) { updates.push('content = ?');  params.push(content); }
  if (position !== undefined) { updates.push('position = ?'); params.push(position); }
  if (updates.length === 0) return res.status(400).json({ error: '没有要更新的字段' });
  params.push(req.params.id);

  tasksDb.run(`UPDATE blocks SET ${updates.join(', ')} WHERE id = ?`, params, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: '块不存在' });
    res.json({ success: true });
  });
});

router.delete('/notion/blocks/:id', (req, res) => {
  const deleteRecursive = (id, cb) => {
    tasksDb.all('SELECT id FROM blocks WHERE parent_id = ?', [id], (err, children) => {
      if (err) return cb(err);
      if (children.length === 0) return tasksDb.run('DELETE FROM blocks WHERE id = ?', [id], cb);
      let done = 0;
      children.forEach(c => deleteRecursive(c.id, (err) => {
        if (err) return cb(err);
        if (++done === children.length) tasksDb.run('DELETE FROM blocks WHERE id = ?', [id], cb);
      }));
    });
  };
  deleteRecursive(req.params.id, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

router.post('/notion/blocks/operations', (req, res) => {
  const { operations } = req.body;
  if (!Array.isArray(operations)) return res.status(400).json({ error: '无效的操作格式' });

  tasksDb.run('BEGIN TRANSACTION', (err) => {
    if (err) return res.status(500).json({ error: err.message });

    let done = 0;
    const total = operations.length;
    const errors = [];

    const checkCompletion = () => {
      if (done < total) return;
      if (errors.length > 0) {
        tasksDb.run('ROLLBACK', () => res.status(500).json({ error: errors.join(', ') }));
      } else {
        tasksDb.run('COMMIT', () => res.json({ success: true }));
      }
    };

    const deleteRecursive = (id, cb) => {
      tasksDb.all('SELECT id FROM blocks WHERE parent_id = ?', [id], (err, children) => {
        if (err) return cb(err);
        if (children.length === 0) return tasksDb.run('DELETE FROM blocks WHERE id = ?', [id], cb);
        let d = 0;
        children.forEach(c => deleteRecursive(c.id, (err) => {
          if (err) return cb(err);
          if (++d === children.length) tasksDb.run('DELETE FROM blocks WHERE id = ?', [id], cb);
        }));
      });
    };

    if (total === 0) { tasksDb.run('COMMIT', () => res.json({ success: true })); return; }

    operations.forEach(op => {
      if (op.type === 'create') {
        const id = genId('block');
        tasksDb.run(
          'INSERT INTO blocks (id, page_id, parent_id, type, content, position) VALUES (?, ?, ?, ?, ?, ?)',
          [id, op.pageId, op.parentId || null, op.blockType || 'paragraph', op.content || '{}', op.position || 1.0],
          (err) => { if (err) errors.push(err.message); done++; checkCompletion(); }
        );
      } else if (op.type === 'update') {
        const upd = [], prm = [];
        if (op.blockType !== undefined) { upd.push('type = ?');     prm.push(op.blockType); }
        if (op.content   !== undefined) { upd.push('content = ?');  prm.push(op.content); }
        if (op.position  !== undefined) { upd.push('position = ?'); prm.push(op.position); }
        if (upd.length === 0) { done++; checkCompletion(); return; }
        prm.push(op.blockId);
        tasksDb.run(`UPDATE blocks SET ${upd.join(', ')} WHERE id = ?`, prm,
          (err) => { if (err) errors.push(err.message); done++; checkCompletion(); }
        );
      } else if (op.type === 'delete') {
        deleteRecursive(op.blockId, (err) => { if (err) errors.push(err.message); done++; checkCompletion(); });
      } else {
        done++; checkCompletion();
      }
    });
  });
});

module.exports = { init };
