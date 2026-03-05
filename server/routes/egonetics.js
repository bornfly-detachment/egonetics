/**
 * routes/egonetics.js
 * /api/egonetics — 主体档案 + 块存储 + 宪法批注
 * 数据存入 agents.db
 */

const express = require('express');
const router = express.Router();

let db;

function genId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function init(agentsDb) {
  db = agentsDb;

  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS subjects (
      id               TEXT PRIMARY KEY,
      name             TEXT NOT NULL,
      icon             TEXT NOT NULL DEFAULT '🧠',
      agent            TEXT NOT NULL DEFAULT '',
      model            TEXT NOT NULL DEFAULT '',
      model_display    TEXT,
      description      TEXT,
      constitution_ref TEXT,
      status           TEXT NOT NULL DEFAULT 'active',
      notes            TEXT,
      activated_at     TEXT NOT NULL DEFAULT (datetime('now')),
      archived_at      TEXT,
      created_at       TEXT NOT NULL DEFAULT (datetime('now'))
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS subject_blocks (
      id         TEXT PRIMARY KEY,
      page_id    TEXT NOT NULL,
      parent_id  TEXT,
      type       TEXT NOT NULL DEFAULT 'paragraph',
      content    TEXT NOT NULL DEFAULT '{}',
      metadata   TEXT NOT NULL DEFAULT '{}',
      collapsed  INTEGER NOT NULL DEFAULT 0,
      position   REAL NOT NULL DEFAULT 1.0
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS constitution_comments (
      id         TEXT PRIMARY KEY,
      section    TEXT NOT NULL,
      content    TEXT NOT NULL,
      author     TEXT NOT NULL DEFAULT 'user',
      status     TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS egonetics_pages (
      id          TEXT PRIMARY KEY,
      subject_id  TEXT NOT NULL,
      parent_id   TEXT,
      title       TEXT NOT NULL DEFAULT '',
      icon        TEXT NOT NULL DEFAULT '📄',
      file_path   TEXT,
      position    REAL NOT NULL DEFAULT 1.0,
      page_type   TEXT NOT NULL DEFAULT 'page',
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS egonetics_page_blocks (
      id         TEXT PRIMARY KEY,
      page_id    TEXT NOT NULL,
      parent_id  TEXT,
      type       TEXT NOT NULL DEFAULT 'paragraph',
      content    TEXT NOT NULL DEFAULT '{}',
      metadata   TEXT NOT NULL DEFAULT '{}',
      collapsed  INTEGER NOT NULL DEFAULT 0,
      position   REAL NOT NULL DEFAULT 1.0
    )`);

    db.run('CREATE INDEX IF NOT EXISTS idx_subjects_status ON subjects(status)');
    db.run('CREATE INDEX IF NOT EXISTS idx_subject_blocks_page ON subject_blocks(page_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_comments_section ON constitution_comments(section)');
    db.run('CREATE INDEX IF NOT EXISTS idx_ego_pages_subject ON egonetics_pages(subject_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_ego_page_blocks_page ON egonetics_page_blocks(page_id)');
  });

  return router;
}

// ── Subjects ────────────────────────────────────────────────

router.get('/egonetics/subjects/active', (req, res) => {
  db.get("SELECT * FROM subjects WHERE status = 'active' ORDER BY activated_at DESC LIMIT 1", [], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ subject: row || null });
  });
});

router.get('/egonetics/subjects', (req, res) => {
  db.all('SELECT * FROM subjects ORDER BY created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ subjects: rows });
  });
});

router.get('/egonetics/subjects/:id', (req, res) => {
  db.get('SELECT * FROM subjects WHERE id = ?', [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: '主体不存在' });
    res.json(row);
  });
});

router.post('/egonetics/subjects', (req, res) => {
  const { name, icon = '🧠', agent = '', model = '', model_display, description, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'name 必填' });

  const id = genId('subj');
  const constitution_ref = new Date().toISOString();

  db.run(
    `INSERT INTO subjects (id, name, icon, agent, model, model_display, description, constitution_ref, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, name, icon, agent, model, model_display || null, description || null, constitution_ref, notes || null],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ success: true, id });
    }
  );
});

router.patch('/egonetics/subjects/:id', (req, res) => {
  const { name, icon, agent, model, model_display, description, notes, action } = req.body;
  const updates = [], params = [];

  if (name        !== undefined) { updates.push('name = ?');         params.push(name); }
  if (icon        !== undefined) { updates.push('icon = ?');         params.push(icon); }
  if (agent       !== undefined) { updates.push('agent = ?');        params.push(agent); }
  if (model       !== undefined) { updates.push('model = ?');        params.push(model); }
  if (model_display !== undefined) { updates.push('model_display = ?'); params.push(model_display); }
  if (description !== undefined) { updates.push('description = ?'); params.push(description); }
  if (notes       !== undefined) { updates.push('notes = ?');        params.push(notes); }
  if (action === 'archive') {
    updates.push("status = 'archived'");
    updates.push("archived_at = datetime('now')");
  }

  if (updates.length === 0) return res.status(400).json({ error: '没有要更新的字段' });
  params.push(req.params.id);

  db.run(`UPDATE subjects SET ${updates.join(', ')} WHERE id = ?`, params, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: '主体不存在' });
    res.json({ success: true });
  });
});

router.delete('/egonetics/subjects/:id', (req, res) => {
  db.run('DELETE FROM subjects WHERE id = ?', [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: '主体不存在' });
    res.json({ success: true });
  });
});

// ── Blocks ──────────────────────────────────────────────────

router.get('/egonetics/subjects/:id/blocks', (req, res) => {
  db.all('SELECT * FROM subject_blocks WHERE page_id = ? ORDER BY position', [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(r => ({
      id: r.id,
      parentId: r.parent_id || null,
      type: r.type,
      content: JSON.parse(r.content),
      metadata: JSON.parse(r.metadata),
      collapsed: !!r.collapsed,
      position: r.position,
    })));
  });
});

router.put('/egonetics/subjects/:id/blocks', (req, res) => {
  const pageId = req.params.id;
  const blocks = req.body;
  if (!Array.isArray(blocks)) return res.status(400).json({ error: 'body must be array' });

  db.run('DELETE FROM subject_blocks WHERE page_id = ?', [pageId], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    if (blocks.length === 0) return res.json(blocks);

    let done = 0;
    let failed = false;
    blocks.forEach((b, i) => {
      db.run(
        'INSERT INTO subject_blocks (id, page_id, parent_id, type, content, metadata, collapsed, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [b.id, pageId, b.parentId || null, b.type, JSON.stringify(b.content ?? {}), JSON.stringify(b.metadata ?? {}), b.collapsed ? 1 : 0, i + 1],
        (err) => {
          if (err && !failed) { failed = true; return res.status(500).json({ error: err.message }); }
          if (++done === blocks.length && !failed) res.json(blocks);
        }
      );
    });
  });
});

// ── Constitution Comments ───────────────────────────────────

router.get('/egonetics/comments', (req, res) => {
  const { section } = req.query;
  const sql = section
    ? 'SELECT * FROM constitution_comments WHERE section = ? ORDER BY created_at DESC'
    : 'SELECT * FROM constitution_comments ORDER BY created_at DESC';
  db.all(sql, section ? [section] : [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ comments: rows });
  });
});

router.post('/egonetics/comments', (req, res) => {
  const { section, content, author = 'user' } = req.body;
  if (!section || !content) return res.status(400).json({ error: 'section / content 必填' });
  const id = genId('cmt');
  db.run(
    'INSERT INTO constitution_comments (id, section, content, author) VALUES (?, ?, ?, ?)',
    [id, section, content, author],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ success: true, id });
    }
  );
});

router.patch('/egonetics/comments/:id', (req, res) => {
  const { status } = req.body;
  if (!['pending', 'reviewed', 'adopted'].includes(status)) {
    return res.status(400).json({ error: 'status 必须是 pending / reviewed / adopted' });
  }
  db.run('UPDATE constitution_comments SET status = ? WHERE id = ?', [status, req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: '批注不存在' });
    res.json({ success: true });
  });
});

// ── Egonetics Pages (PageManager tree) ─────────────────────

function parsePageRow(r) {
  return {
    id: r.id,
    parentId: r.parent_id || null,
    title: r.title,
    icon: r.icon,
    filePath: r.file_path || null,
    position: r.position,
    pageType: r.page_type,
    subjectId: r.subject_id,
    createdAt: r.created_at,
    updatedAt: r.created_at,
    refId: null,
  };
}

// GET /egonetics/subjects/:subjectId/pages  → listPages
router.get('/egonetics/subjects/:subjectId/pages', (req, res) => {
  db.all(
    'SELECT * FROM egonetics_pages WHERE subject_id = ? ORDER BY position',
    [req.params.subjectId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows.map(parsePageRow));
    }
  );
});

// POST /egonetics/subjects/:subjectId/pages  → createPage
router.post('/egonetics/subjects/:subjectId/pages', (req, res) => {
  const { parentId, title = '未命名', icon = '📄', position = 1.0, pageType = 'page', filePath } = req.body;
  const id = genId('ep');
  db.run(
    'INSERT INTO egonetics_pages (id, subject_id, parent_id, title, icon, file_path, position, page_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, req.params.subjectId, parentId || null, title, icon, filePath || null, position, pageType],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      db.get('SELECT * FROM egonetics_pages WHERE id = ?', [id], (e, row) => {
        if (e) return res.status(500).json({ error: e.message });
        res.status(201).json(parsePageRow(row));
      });
    }
  );
});

// PATCH /egonetics/pages/:id  → updatePage
router.patch('/egonetics/pages/:id', (req, res) => {
  const { title, icon } = req.body;
  const updates = [], params = [];
  if (title !== undefined) { updates.push('title = ?'); params.push(title); }
  if (icon  !== undefined) { updates.push('icon = ?');  params.push(icon); }
  if (updates.length === 0) return res.status(400).json({ error: '无更新字段' });
  params.push(req.params.id);
  db.run(`UPDATE egonetics_pages SET ${updates.join(', ')} WHERE id = ?`, params, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    db.get('SELECT * FROM egonetics_pages WHERE id = ?', [req.params.id], (e, row) => {
      if (e || !row) return res.status(404).json({ error: '页面不存在' });
      res.json(parsePageRow(row));
    });
  });
});

// DELETE /egonetics/pages/:id  → deletePage (cascade)
router.delete('/egonetics/pages/:id', (req, res) => {
  const deleteRecursive = (id, cb) => {
    db.all('SELECT id FROM egonetics_pages WHERE parent_id = ?', [id], (err, children) => {
      if (err) return cb(err);
      let pending = children.length;
      if (pending === 0) {
        db.run('DELETE FROM egonetics_page_blocks WHERE page_id = ?', [id], () =>
          db.run('DELETE FROM egonetics_pages WHERE id = ?', [id], cb)
        );
        return;
      }
      children.forEach(c => deleteRecursive(c.id, (e) => {
        if (e) return cb(e);
        if (--pending === 0) {
          db.run('DELETE FROM egonetics_page_blocks WHERE page_id = ?', [id], () =>
            db.run('DELETE FROM egonetics_pages WHERE id = ?', [id], cb)
          );
        }
      }));
    });
  };
  deleteRecursive(req.params.id, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true });
  });
});

// POST /egonetics/pages/:id/move  → movePage
router.post('/egonetics/pages/:id/move', (req, res) => {
  const { newParentId, newPosition } = req.body;
  db.run(
    'UPDATE egonetics_pages SET parent_id = ?, position = ? WHERE id = ?',
    [newParentId || null, newPosition, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      db.get('SELECT * FROM egonetics_pages WHERE id = ?', [req.params.id], (e, row) => {
        if (e || !row) return res.status(404).json({ error: '页面不存在' });
        res.json(parsePageRow(row));
      });
    }
  );
});

// GET /egonetics/pages/:id/blocks  → listBlocks
router.get('/egonetics/pages/:id/blocks', (req, res) => {
  db.all(
    'SELECT * FROM egonetics_page_blocks WHERE page_id = ? ORDER BY position',
    [req.params.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows.map(r => ({
        id: r.id,
        parentId: r.parent_id || null,
        type: r.type,
        content: JSON.parse(r.content),
        metadata: JSON.parse(r.metadata),
        collapsed: !!r.collapsed,
        position: r.position,
      })));
    }
  );
});

// PUT /egonetics/pages/:id/blocks  → saveBlocks
router.put('/egonetics/pages/:id/blocks', (req, res) => {
  const pageId = req.params.id;
  const blocks = req.body;
  if (!Array.isArray(blocks)) return res.status(400).json({ error: 'body must be array' });
  db.run('DELETE FROM egonetics_page_blocks WHERE page_id = ?', [pageId], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    if (blocks.length === 0) return res.json([]);
    let done = 0, failed = false;
    blocks.forEach((b, i) => {
      db.run(
        'INSERT INTO egonetics_page_blocks (id, page_id, parent_id, type, content, metadata, collapsed, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [b.id, pageId, b.parentId || null, b.type, JSON.stringify(b.content ?? {}), JSON.stringify(b.metadata ?? {}), b.collapsed ? 1 : 0, i + 1],
        (e) => {
          if (e && !failed) { failed = true; return res.status(500).json({ error: e.message }); }
          if (++done === blocks.length && !failed) res.json(blocks);
        }
      );
    });
  });
});

module.exports = { init };
