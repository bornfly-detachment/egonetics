/**
 * routes/chronicle.js
 * /api/chronicle — 精选生命史（条目 + 里程碑 + 集合）
 *
 * Phase 2 将实现完整功能。当前为 Phase 0 基础框架。
 */

const express = require('express');
const router = express.Router();

let memoryDb;

function init(db) {
  memoryDb = db;

  // Auto-create collection_links table (safe to run every startup)
  memoryDb.run(`CREATE TABLE IF NOT EXISTS chronicle_collection_links (
    id         TEXT PRIMARY KEY,
    from_id    TEXT NOT NULL,
    to_id      TEXT NOT NULL,
    label      TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  // Auto-create entry_links table
  memoryDb.run(`CREATE TABLE IF NOT EXISTS chronicle_entry_links (
    id                  TEXT PRIMARY KEY,
    from_id             TEXT NOT NULL,
    to_id               TEXT NOT NULL,
    relation_hint       TEXT DEFAULT '',
    draft_content       TEXT DEFAULT '',
    content             TEXT DEFAULT '[]',
    current_content_id  TEXT DEFAULT '',
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL
  )`);

  // Ensure new columns exist — must use callback to catch async sqlite3 errors
  const newCols = [
    `ALTER TABLE chronicle_collections ADD COLUMN color TEXT DEFAULT '#6366f1'`,
    `ALTER TABLE chronicle_collections ADD COLUMN content TEXT`,
    `ALTER TABLE chronicle_collections ADD COLUMN parent_id TEXT`,
    `ALTER TABLE chronicle_annotations ADD COLUMN milestone_version TEXT`,
  ];
  newCols.forEach(sql => {
    memoryDb.run(sql, (err) => {
      if (err && !err.message.includes('duplicate column name') && !err.message.includes('no such table')) {
        console.error('[chronicle init]', err.message);
      }
    });
  });

  return router;
}

function genId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── 时间轴 ─────────────────────────────────────────────────

// GET /api/chronicle → { milestones, entries, collections, collection_links, entry_links }
router.get('/chronicle', (req, res) => {
  const result = { milestones: [], entries: [], collections: [], collection_links: [], entry_links: [] };
  let pending = 5;

  const done = (err) => {
    if (err) return res.status(500).json({ error: err.message });
    if (--pending === 0) res.json(result);
  };

  memoryDb.all('SELECT * FROM chronicle_milestones ORDER BY created_at DESC', [], (err, rows) => {
    result.milestones = rows || [];
    done(err);
  });

  memoryDb.all('SELECT * FROM chronicle_entries ORDER BY created_at DESC', [], (err, rows) => {
    result.entries = rows || [];
    done(err);
  });

  memoryDb.all('SELECT * FROM chronicle_collections ORDER BY sort_order, created_at DESC', [], (err, rows) => {
    result.collections = rows || [];
    done(err);
  });

  memoryDb.all('SELECT * FROM chronicle_collection_links ORDER BY created_at', [], (err, rows) => {
    result.collection_links = rows || [];
    done(err);
  });

  memoryDb.all('SELECT * FROM chronicle_entry_links ORDER BY created_at', [], (err, rows) => {
    result.entry_links = rows || [];
    done(err);
  });
});

// ── 条目 ───────────────────────────────────────────────────

router.get('/chronicle/entries', (req, res) => {
  const { type } = req.query;
  let sql = 'SELECT * FROM chronicle_entries';
  const params = [];
  if (type) { sql += ' WHERE type = ?'; params.push(type); }
  sql += ' ORDER BY created_at DESC';

  memoryDb.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ entries: rows });
  });
});

router.post('/chronicle/entries', (req, res) => {
  const { type, source_id, title, summary, start_time, end_time,
          task_outcome, version_tag, content, milestone_id } = req.body;
  if (!type || !source_id || !title) return res.status(400).json({ error: 'type/source_id/title 必填' });

  const id = genId('ce');
  memoryDb.run(
    `INSERT INTO chronicle_entries
      (id, type, source_id, title, summary, start_time, end_time, task_outcome, version_tag, content, milestone_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, type, source_id, title, summary || null, start_time || null, end_time || null,
     task_outcome || null, version_tag || null, content || null, milestone_id || null],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ success: true, id });
    }
  );
});

router.get('/chronicle/entries/:id', (req, res) => {
  memoryDb.get('SELECT * FROM chronicle_entries WHERE id = ?', [req.params.id], (err, entry) => {
    if (err || !entry) return res.status(404).json({ error: '条目不存在' });

    memoryDb.all(
      'SELECT * FROM chronicle_annotations WHERE entry_id = ? ORDER BY version',
      [entry.id], (err, annotations) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ ...entry, annotations });
      }
    );
  });
});

// PATCH 更新条目（milestone_id、summary 等）
router.patch('/chronicle/entries/:id', (req, res) => {
  const entryId = req.params.id;
  const { milestone_id, summary, title, task_outcome } = req.body;

  memoryDb.get('SELECT is_locked FROM chronicle_entries WHERE id = ?', [entryId], (err, entry) => {
    if (err || !entry) return res.status(404).json({ error: '条目不存在' });
    if (entry.is_locked) return res.status(403).json({ error: '已锁定的条目不可编辑' });

    const updates = [], params = [];
    if (milestone_id  !== undefined) { updates.push('milestone_id = ?');  params.push(milestone_id ?? null); }
    if (summary       !== undefined) { updates.push('summary = ?');       params.push(summary); }
    if (title         !== undefined) { updates.push('title = ?');         params.push(title); }
    if (task_outcome  !== undefined) { updates.push('task_outcome = ?');  params.push(task_outcome); }

    if (updates.length === 0) return res.json({ success: true });
    params.push(entryId);

    memoryDb.run(`UPDATE chronicle_entries SET ${updates.join(', ')} WHERE id = ?`, params, function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
  });
});

// GET 条目的所有标注
router.get('/chronicle/entries/:id/annotations', (req, res) => {
  memoryDb.get('SELECT id FROM chronicle_entries WHERE id = ?', [req.params.id], (err, entry) => {
    if (err || !entry) return res.status(404).json({ error: '条目不存在' });
    memoryDb.all(
      'SELECT * FROM chronicle_annotations WHERE entry_id = ? ORDER BY version ASC, created_at ASC',
      [req.params.id], (err, annotations) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ annotations: annotations || [] });
      }
    );
  });
});

// DELETE /api/chronicle/entries/:id — 仅未锁定
router.delete('/chronicle/entries/:id', (req, res) => {
  memoryDb.get('SELECT is_locked FROM chronicle_entries WHERE id = ?', [req.params.id], (err, entry) => {
    if (err || !entry) return res.status(404).json({ error: '条目不存在' });
    if (entry.is_locked) return res.status(403).json({ error: '已锁定的条目不可删除' });

    memoryDb.run('DELETE FROM chronicle_entries WHERE id = ?', [req.params.id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
  });
});

// 追加标注（V2/V3...），锁定后自动写入 milestone_version
router.post('/chronicle/entries/:id/annotations', (req, res) => {
  const entryId = req.params.id;
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'content 必填' });

  memoryDb.get('SELECT is_locked, milestone_id FROM chronicle_entries WHERE id = ?', [entryId], (err, entry) => {
    if (err || !entry) return res.status(404).json({ error: '条目不存在' });

    // 获取当前最大版本号
    memoryDb.get(
      'SELECT MAX(version) as maxVer FROM chronicle_annotations WHERE entry_id = ?',
      [entryId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        const nextVersion = (row?.maxVer || 1) + 1;
        const id = genId('ca');

        // 计算 milestone_version: 已发布里程碑数量 + 1（只在条目已锁定时写入）
        const computeVersion = (cb) => {
          if (!entry.is_locked) return cb(null, null);
          memoryDb.get(
            'SELECT COUNT(*) as cnt FROM chronicle_milestones WHERE is_published = 1',
            (err2, countRow) => {
              if (err2) return cb(err2);
              cb(null, `v${(countRow?.cnt || 1) + 1}-note`);
            }
          );
        };

        computeVersion((err2, milestoneVersion) => {
          if (err2) return res.status(500).json({ error: err2.message });

          memoryDb.run(
            'INSERT INTO chronicle_annotations (id, entry_id, version, content, milestone_version) VALUES (?, ?, ?, ?, ?)',
            [id, entryId, nextVersion, content, milestoneVersion],
            function(err3) {
              if (err3) return res.status(500).json({ error: err3.message });
              res.json({ success: true, id, version: nextVersion, milestone_version: milestoneVersion });
            }
          );
        });
      }
    );
  });
});

// ── 里程碑 ────────────────────────────────────────────────

router.get('/chronicle/milestones', (req, res) => {
  memoryDb.all('SELECT * FROM chronicle_milestones ORDER BY created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ milestones: rows });
  });
});

router.post('/chronicle/milestones', (req, res) => {
  const { title, description, cover_start, cover_end } = req.body;
  if (!title) return res.status(400).json({ error: 'title 必填' });

  const id = genId('ms');
  memoryDb.run(
    'INSERT INTO chronicle_milestones (id, title, description, cover_start, cover_end) VALUES (?, ?, ?, ?, ?)',
    [id, title, description || null, cover_start || null, cover_end || null],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ success: true, id });
    }
  );
});

router.patch('/chronicle/milestones/:id', (req, res) => {
  const { title, description, cover_start, cover_end, add_entry_ids, remove_entry_ids } = req.body;
  const milestoneId = req.params.id;

  // 检查里程碑未发布
  memoryDb.get('SELECT is_published FROM chronicle_milestones WHERE id = ?', [milestoneId], (err, ms) => {
    if (err || !ms) return res.status(404).json({ error: '里程碑不存在' });
    if (ms.is_published) return res.status(403).json({ error: '已发布的里程碑不可编辑' });

    const tasks = [];

    // 更新基本信息
    const updates = [], params = [];
    if (title       !== undefined) { updates.push('title = ?');       params.push(title); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (cover_start !== undefined) { updates.push('cover_start = ?'); params.push(cover_start); }
    if (cover_end   !== undefined) { updates.push('cover_end = ?');   params.push(cover_end); }

    if (updates.length > 0) {
      tasks.push((cb) => {
        params.push(milestoneId);
        memoryDb.run(`UPDATE chronicle_milestones SET ${updates.join(', ')} WHERE id = ?`, params, cb);
      });
    }

    // 添加条目到里程碑
    if (Array.isArray(add_entry_ids)) {
      add_entry_ids.forEach(entryId => {
        tasks.push((cb) => memoryDb.run('UPDATE chronicle_entries SET milestone_id = ? WHERE id = ?', [milestoneId, entryId], cb));
      });
    }

    // 从里程碑移除条目
    if (Array.isArray(remove_entry_ids)) {
      remove_entry_ids.forEach(entryId => {
        tasks.push((cb) => memoryDb.run('UPDATE chronicle_entries SET milestone_id = NULL WHERE id = ?', [entryId], cb));
      });
    }

    let done = 0;
    if (tasks.length === 0) return res.json({ success: true });
    tasks.forEach(t => t((err) => {
      if (err) return res.status(500).json({ error: err.message });
      if (++done === tasks.length) res.json({ success: true });
    }));
  });
});

// DELETE /api/chronicle/milestones/:id — 仅未发布
router.delete('/chronicle/milestones/:id', (req, res) => {
  memoryDb.get('SELECT is_published FROM chronicle_milestones WHERE id = ?', [req.params.id], (err, ms) => {
    if (err || !ms) return res.status(404).json({ error: '里程碑不存在' });
    if (ms.is_published) return res.status(403).json({ error: '已发布的里程碑不可删除' });

    // 解绑所有关联条目
    memoryDb.run(
      'UPDATE chronicle_entries SET milestone_id = NULL WHERE milestone_id = ?',
      [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        memoryDb.run('DELETE FROM chronicle_milestones WHERE id = ?', [req.params.id], function(err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ success: true });
        });
      }
    );
  });
});

// POST /api/chronicle/milestones/:id/publish — 发布并锁定
router.post('/chronicle/milestones/:id/publish', (req, res) => {
  const milestoneId = req.params.id;

  memoryDb.get('SELECT * FROM chronicle_milestones WHERE id = ?', [milestoneId], (err, ms) => {
    if (err || !ms) return res.status(404).json({ error: '里程碑不存在' });
    if (ms.is_published) return res.status(409).json({ error: '里程碑已发布' });

    const now = new Date().toISOString();

    // 发布里程碑 + 锁定所有关联条目 + 锁定所有关联集合
    memoryDb.run(
      'UPDATE chronicle_milestones SET is_published = 1, published_at = ? WHERE id = ?',
      [now, milestoneId], (err) => {
        if (err) return res.status(500).json({ error: err.message });

        memoryDb.run(
          'UPDATE chronicle_entries SET is_locked = 1 WHERE milestone_id = ?',
          [milestoneId], (err) => {
            if (err) return res.status(500).json({ error: err.message });

            memoryDb.run(
              'UPDATE chronicle_collections SET is_locked = 1 WHERE milestone_id = ?',
              [milestoneId], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true, published_at: now });
              }
            );
          }
        );
      }
    );
  });
});

// ── 集合 ───────────────────────────────────────────────────

router.get('/chronicle/collections', (req, res) => {
  memoryDb.all('SELECT * FROM chronicle_collections ORDER BY sort_order, created_at DESC', [], (err, collections) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ collections });
  });
});

router.post('/chronicle/collections', (req, res) => {
  const { name, description, cover_icon, milestone_id, position_x, position_y, sort_order } = req.body;
  if (!name) return res.status(400).json({ error: 'name 必填' });

  const id = genId('col');
  memoryDb.run(
    `INSERT INTO chronicle_collections
       (id, name, description, cover_icon, milestone_id, position_x, position_y, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, name, description || null, cover_icon || '📦',
     milestone_id || null, position_x || 0, position_y || 0, sort_order || 0],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ success: true, id });
    }
  );
});

router.get('/chronicle/collections/:id', (req, res) => {
  memoryDb.get('SELECT * FROM chronicle_collections WHERE id = ?', [req.params.id], (err, col) => {
    if (err || !col) return res.status(404).json({ error: '集合不存在' });

    memoryDb.all(
      `SELECT ci.*, ce.type, ce.title, ce.summary, ce.task_outcome, ce.version_tag, ce.created_at as entry_created_at
       FROM chronicle_collection_items ci
       JOIN chronicle_entries ce ON ci.entry_id = ce.id
       WHERE ci.collection_id = ?
       ORDER BY ci.sort_order`,
      [col.id], (err, items) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ ...col, items });
      }
    );
  });
});

router.patch('/chronicle/collections/:id', (req, res) => {
  const colId = req.params.id;
  const { name, description, cover_icon, milestone_id, position_x, position_y, sort_order,
          color, content, parent_id } = req.body;

  memoryDb.get('SELECT is_locked FROM chronicle_collections WHERE id = ?', [colId], (err, col) => {
    if (err || !col) return res.status(404).json({ error: '集合不存在' });
    // position updates allowed even when locked
    const nonPosFields = { name, description, cover_icon, milestone_id, color, content, parent_id };
    const hasNonPos = Object.values(nonPosFields).some(v => v !== undefined);
    if (col.is_locked && hasNonPos) return res.status(403).json({ error: '已锁定的集合不可编辑' });

    const updates = [], params = [];
    if (name        !== undefined) { updates.push('name = ?');        params.push(name); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (cover_icon  !== undefined) { updates.push('cover_icon = ?');  params.push(cover_icon); }
    if (milestone_id!== undefined) { updates.push('milestone_id = ?');params.push(milestone_id); }
    if (position_x  !== undefined) { updates.push('position_x = ?'); params.push(position_x); }
    if (position_y  !== undefined) { updates.push('position_y = ?'); params.push(position_y); }
    if (sort_order  !== undefined) { updates.push('sort_order = ?');  params.push(sort_order); }
    if (color       !== undefined) { updates.push('color = ?');       params.push(color); }
    if (content     !== undefined) { updates.push('content = ?');     params.push(content); }
    if (parent_id   !== undefined) { updates.push('parent_id = ?');   params.push(parent_id ?? null); }

    if (updates.length === 0) return res.json({ success: true });
    params.push(colId);

    memoryDb.run(`UPDATE chronicle_collections SET ${updates.join(', ')} WHERE id = ?`, params, function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
  });
});

router.delete('/chronicle/collections/:id', (req, res) => {
  memoryDb.get('SELECT is_locked FROM chronicle_collections WHERE id = ?', [req.params.id], (err, col) => {
    if (err || !col) return res.status(404).json({ error: '集合不存在' });
    if (col.is_locked) return res.status(403).json({ error: '已锁定的集合不可删除' });

    memoryDb.run('DELETE FROM chronicle_collections WHERE id = ?', [req.params.id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
  });
});

// 向集合添加条目
router.post('/chronicle/collections/:id/items', (req, res) => {
  const { entry_id, sort_order } = req.body;
  if (!entry_id) return res.status(400).json({ error: 'entry_id 必填' });

  memoryDb.get('SELECT is_locked FROM chronicle_collections WHERE id = ?', [req.params.id], (err, col) => {
    if (err || !col) return res.status(404).json({ error: '集合不存在' });
    if (col.is_locked) return res.status(403).json({ error: '已锁定的集合不可编辑' });

    const id = genId('ci');
    memoryDb.run(
      'INSERT OR IGNORE INTO chronicle_collection_items (id, collection_id, entry_id, sort_order) VALUES (?, ?, ?, ?)',
      [id, req.params.id, entry_id, sort_order || 0],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, id });
      }
    );
  });
});

// 从集合移除条目
router.delete('/chronicle/collections/:id/items/:entryId', (req, res) => {
  memoryDb.get('SELECT is_locked FROM chronicle_collections WHERE id = ?', [req.params.id], (err, col) => {
    if (err || !col) return res.status(404).json({ error: '集合不存在' });
    if (col.is_locked) return res.status(403).json({ error: '已锁定的集合不可编辑' });

    memoryDb.run(
      'DELETE FROM chronicle_collection_items WHERE collection_id = ? AND entry_id = ?',
      [req.params.id, req.params.entryId],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
      }
    );
  });
});

// ── Collection Links ────────────────────────────────────────

// GET /api/chronicle/collection-links
router.get('/chronicle/collection-links', (req, res) => {
  memoryDb.all('SELECT * FROM chronicle_collection_links ORDER BY created_at', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ links: rows || [] });
  });
});

// POST /api/chronicle/collection-links  { from_id, to_id, label }
router.post('/chronicle/collection-links', (req, res) => {
  const { from_id, to_id, label } = req.body;
  if (!from_id || !to_id) return res.status(400).json({ error: 'from_id 和 to_id 必填' });

  const id = genId('cl');
  memoryDb.run(
    'INSERT INTO chronicle_collection_links (id, from_id, to_id, label) VALUES (?, ?, ?, ?)',
    [id, from_id, to_id, label || null],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ success: true, id });
    }
  );
});

// DELETE /api/chronicle/collection-links/:id
router.delete('/chronicle/collection-links/:id', (req, res) => {
  memoryDb.run('DELETE FROM chronicle_collection_links WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: '连线不存在' });
    res.json({ success: true });
  });
});

// ── Entry Links ──────────────────────────────────────────────

// GET /api/chronicle/entry-links
router.get('/chronicle/entry-links', (req, res) => {
  memoryDb.all('SELECT * FROM chronicle_entry_links ORDER BY created_at', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ links: rows || [] });
  });
});

// POST /api/chronicle/entry-links  { from_id, to_id, relation_hint, draft_content }
router.post('/chronicle/entry-links', (req, res) => {
  const { from_id, to_id, relation_hint = '', draft_content = '' } = req.body;
  if (!from_id || !to_id) return res.status(400).json({ error: 'from_id 和 to_id 必填' });
  const id = genId('el');
  const ts = new Date().toISOString();
  memoryDb.run(
    `INSERT INTO chronicle_entry_links
      (id, from_id, to_id, relation_hint, draft_content, content, current_content_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, '[]', '', ?, ?)`,
    [id, from_id, to_id, relation_hint, draft_content, ts, ts],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id, from_id, to_id, relation_hint, draft_content, content: [], created_at: ts });
    }
  );
});

// GET /api/chronicle/entry-links/:id
router.get('/chronicle/entry-links/:id', (req, res) => {
  memoryDb.get('SELECT * FROM chronicle_entry_links WHERE id = ?', [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: '边不存在' });
    try { row.content = JSON.parse(row.content || '[]'); } catch { row.content = []; }
    res.json(row);
  });
});

// PATCH /api/chronicle/entry-links/:id  { relation_hint?, draft_content? }
router.patch('/chronicle/entry-links/:id', (req, res) => {
  const { relation_hint, draft_content } = req.body;
  const sets = ['updated_at = ?'];
  const params = [new Date().toISOString()];
  if (relation_hint !== undefined) { sets.push('relation_hint = ?'); params.push(relation_hint); }
  if (draft_content !== undefined) { sets.push('draft_content = ?'); params.push(draft_content); }
  params.push(req.params.id);
  memoryDb.run(`UPDATE chronicle_entry_links SET ${sets.join(', ')} WHERE id = ?`, params, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// POST /api/chronicle/entry-links/:id/publish  { explain? }
router.post('/chronicle/entry-links/:id/publish', (req, res) => {
  memoryDb.get('SELECT * FROM chronicle_entry_links WHERE id = ?', [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: '边不存在' });
    let list = [];
    try { list = JSON.parse(row.content || '[]'); } catch { list = []; }
    const startAt = list.length ? list[list.length - 1].timestamp.end : row.created_at;
    const ts = new Date().toISOString();
    const entry = {
      id: genId('ce'),
      content: row.draft_content,
      explain: req.body.explain || '',
      timestamp: { start: startAt, end: ts }
    };
    list.push(entry);
    memoryDb.run(
      'UPDATE chronicle_entry_links SET content = ?, current_content_id = ?, updated_at = ? WHERE id = ?',
      [JSON.stringify(list), entry.id, ts, req.params.id],
      function(e) {
        if (e) return res.status(500).json({ error: e.message });
        res.json({ success: true, entry });
      }
    );
  });
});

// DELETE /api/chronicle/entry-links/:id
router.delete('/chronicle/entry-links/:id', (req, res) => {
  memoryDb.run('DELETE FROM chronicle_entry_links WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: '边不存在' });
    res.json({ success: true });
  });
});

module.exports = { init };
