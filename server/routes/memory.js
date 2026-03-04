/**
 * routes/memory.js
 * /api/memory — 对话记录（sessions / rounds / steps）
 * /api/sessions, /api/messages, /api/tags — 向后兼容接口（Phase 0 过渡）
 */

const express = require('express');
const path = require('path');
const router = express.Router();
const { importFile } = require('../scripts/import-jsonl');

let memoryDb;

function init(db) {
  memoryDb = db;

  // Auto-create memory board tables (safe to run every startup)
  const noop = (err) => { if (err) console.error('[memory init]', err.message); };
  memoryDb.run(`CREATE TABLE IF NOT EXISTS memory_boards (
    id         TEXT PRIMARY KEY,
    title      TEXT NOT NULL DEFAULT '标注面板',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`, noop);
  // Migrate: add chronicle_entry_id to boards
  const noopMig = (err) => { if (err && !err.message.includes('duplicate column')) console.error('[memory init]', err.message); };
  memoryDb.run('ALTER TABLE memory_boards ADD COLUMN chronicle_entry_id TEXT', noopMig);
  memoryDb.run(`CREATE TABLE IF NOT EXISTS memory_board_blocks (
    id         TEXT PRIMARY KEY,
    board_id   TEXT NOT NULL REFERENCES memory_boards(id) ON DELETE CASCADE,
    type       TEXT NOT NULL,
    content    TEXT,
    position   REAL NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`, noop);
  memoryDb.run('CREATE INDEX IF NOT EXISTS idx_board_blocks_board ON memory_board_blocks(board_id)', noop);

  return router;
}

function genId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── 旧接口兼容（/api/sessions、/api/messages、/api/tags）──────

router.get('/sessions', (req, res) => {
  memoryDb.all(
    'SELECT * FROM sessions ORDER BY created_at DESC',
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ sessions: rows || [] });
    }
  );
});

router.put('/sessions/:id/title', (req, res) => {
  const { title } = req.body;
  memoryDb.run(
    'UPDATE sessions SET annotation_title = ? WHERE id = ?',
    [title, req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: '会话不存在' });
      res.json({ success: true });
    }
  );
});

router.get('/sessions/:id', (req, res) => {
  memoryDb.get('SELECT * FROM sessions WHERE id = ?', [req.params.id], (err, session) => {
    if (err || !session) return res.status(404).json({ error: '会话不存在' });
    res.json(session);
  });
});

router.post('/messages/:id/annotation', (req, res) => {
  const { suggested_revision } = req.body;
  const id = genId('ann');
  memoryDb.run(
    'INSERT INTO annotations (id, ref_type, ref_id, type, content) VALUES (?, ?, ?, ?, ?)',
    [id, 'step', req.params.id, 'note', suggested_revision],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id });
    }
  );
});

router.get('/messages/:id/annotation', (req, res) => {
  memoryDb.get(
    'SELECT * FROM annotations WHERE ref_id = ? AND ref_type = ? ORDER BY created_at DESC LIMIT 1',
    [req.params.id, 'step'],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ annotation: row || null });
    }
  );
});

router.post('/tags', (req, res) => res.json({ success: true, name: req.body.name }));
router.get('/tags', (req, res) => res.json({ tags: [] }));
router.post('/messages/:id/tags', (req, res) => res.json({ success: true }));

// ── 新 Memory API (/api/memory/*) ─────────────────────────

// POST /api/memory/import
// body: { filePath: "/absolute/path/to/file.jsonl" }
router.post('/memory/import', async (req, res) => {
  const { filePath } = req.body;
  if (!filePath) return res.status(400).json({ error: 'filePath 必填' });

  try {
    const result = await importFile(filePath, memoryDb);
    res.json({ success: true, ...result });
  } catch (err) {
    const alreadyExists = err.message.includes('已存在');
    res.status(alreadyExists ? 409 : 500).json({ error: err.message });
  }
});

// GET /api/memory/sessions
// 返回未入库 Chronicle 的会话列表（分页）
router.get('/memory/sessions', (req, res) => {
  const limit  = parseInt(req.query.limit  || '50');
  const offset = parseInt(req.query.offset || '0');

  // 统计 round 数量
  memoryDb.all(
    `SELECT s.*,
            COUNT(r.id) AS round_count
     FROM sessions s
     LEFT JOIN rounds r ON r.session_id = s.id
     WHERE s.chronicle_entry_id IS NULL
     GROUP BY s.id
     ORDER BY s.started_at DESC
     LIMIT ? OFFSET ?`,
    [limit, offset],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });

      memoryDb.get(
        'SELECT COUNT(*) as total FROM sessions WHERE chronicle_entry_id IS NULL',
        (err2, countRow) => {
          if (err2) return res.status(500).json({ error: err2.message });
          res.json({ sessions: rows || [], total: countRow?.total || 0 });
        }
      );
    }
  );
});

// GET /api/memory/sessions/:id
router.get('/memory/sessions/:id', (req, res) => {
  memoryDb.get('SELECT * FROM sessions WHERE id = ?', [req.params.id], (err, session) => {
    if (err || !session) return res.status(404).json({ error: '会话不存在' });
    res.json(session);
  });
});

// GET /api/memory/sessions/:id/rounds  (懒加载)
router.get('/memory/sessions/:id/rounds', (req, res) => {
  memoryDb.all(
    `SELECT r.*,
            COUNT(s.id) AS step_count
     FROM rounds r
     LEFT JOIN steps s ON s.round_id = r.id
     WHERE r.session_id = ?
     GROUP BY r.id
     ORDER BY r.round_num`,
    [req.params.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ rounds: rows || [] });
    }
  );
});

// GET /api/memory/rounds/:id/steps  (懒加载)
router.get('/memory/rounds/:id/steps', (req, res) => {
  memoryDb.all(
    'SELECT * FROM steps WHERE round_id = ? ORDER BY step_num',
    [req.params.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      // content 列存 JSON 字符串，解析返回
      const steps = (rows || []).map(s => {
        let content = s.content;
        try { content = JSON.parse(s.content); } catch { /* keep string */ }
        return { ...s, content };
      });
      res.json({ steps });
    }
  );
});

// PATCH /api/memory/sessions/:id/annotate
// body: { annotation_title, annotation_summary }
router.patch('/memory/sessions/:id/annotate', (req, res) => {
  const { annotation_title, annotation_summary } = req.body;
  memoryDb.run(
    'UPDATE sessions SET annotation_title = ?, annotation_summary = ? WHERE id = ?',
    [annotation_title || null, annotation_summary || null, req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: '会话不存在' });
      res.json({ success: true });
    }
  );
});

// POST /api/memory/sessions/:id/annotations
// body: { type, content, tags }
router.post('/memory/sessions/:id/annotations', (req, res) => {
  const { type = 'note', content, tags = [] } = req.body;
  if (!content) return res.status(400).json({ error: 'content 必填' });
  const id = genId('ann');

  memoryDb.run(
    'INSERT INTO annotations (id, ref_type, ref_id, type, content, tags) VALUES (?, ?, ?, ?, ?, ?)',
    [id, 'session', req.params.id, type, content, JSON.stringify(tags)],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id });
    }
  );
});

// GET /api/memory/sessions/:id/annotations
router.get('/memory/sessions/:id/annotations', (req, res) => {
  memoryDb.all(
    'SELECT * FROM annotations WHERE ref_type = ? AND ref_id = ? ORDER BY created_at DESC',
    ['session', req.params.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ annotations: rows || [] });
    }
  );
});

// POST /api/memory/sessions/:id/send-to-chronicle
// body: { title, summary }  →  在 chronicle_entries 创建一条 'memory' 类型条目
router.post('/memory/sessions/:id/send-to-chronicle', (req, res) => {
  const sessionId = req.params.id;
  const { title, summary } = req.body;
  if (!title) return res.status(400).json({ error: 'title 必填' });

  memoryDb.get('SELECT * FROM sessions WHERE id = ?', [sessionId], (err, session) => {
    if (err || !session) return res.status(404).json({ error: '会话不存在' });
    if (session.chronicle_entry_id) return res.status(409).json({ error: '该会话已入库 Chronicle' });

    const entryId = genId('ce');

    memoryDb.run(
      `INSERT INTO chronicle_entries
         (id, type, source_id, title, summary, start_time, end_time)
       VALUES (?, 'memory', ?, ?, ?, ?, ?)`,
      [entryId, sessionId, title, summary || null,
       session.started_at, session.ended_at],
      (err) => {
        if (err) return res.status(500).json({ error: err.message });

        // 标记 session 已入库
        memoryDb.run(
          'UPDATE sessions SET chronicle_entry_id = ?, annotation_title = ?, annotation_summary = ? WHERE id = ?',
          [entryId, title, summary || null, sessionId],
          (err) => {
            if (err) return res.status(500).json({ error: err.message });

            // 写 event
            memoryDb.run(
              `INSERT INTO events (id, type, source, ref_id, title)
               VALUES (?, 'memory.sent_to_chronicle', 'memory', ?, ?)`,
              [genId('evt'), sessionId, title]
            );

            res.json({ success: true, chronicle_entry_id: entryId });
          }
        );
      }
    );
  });
});

// GET /api/memory/steps/:id/annotations  (对单个 step 的标注)
router.get('/memory/steps/:id/annotations', (req, res) => {
  memoryDb.all(
    'SELECT * FROM annotations WHERE ref_type = ? AND ref_id = ? ORDER BY created_at DESC',
    ['step', req.params.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ annotations: rows || [] });
    }
  );
});

// POST /api/memory/steps/:id/annotations
router.post('/memory/steps/:id/annotations', (req, res) => {
  const { type = 'note', content, tags = [] } = req.body;
  if (!content) return res.status(400).json({ error: 'content 必填' });
  const id = genId('ann');

  memoryDb.run(
    'INSERT INTO annotations (id, ref_type, ref_id, type, content, tags) VALUES (?, ?, ?, ?, ?, ?)',
    [id, 'step', req.params.id, type, content, JSON.stringify(tags)],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id });
    }
  );
});

// ── Memory Boards API (/api/memory/boards/*) ──────────────────────────────────

// GET /api/memory/boards
router.get('/memory/boards', (req, res) => {
  memoryDb.all('SELECT * FROM memory_boards ORDER BY created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ boards: rows || [] });
  });
});

// POST /api/memory/boards
router.post('/memory/boards', (req, res) => {
  const { title = '标注面板' } = req.body;
  const id = genId('mb');
  memoryDb.run(
    'INSERT INTO memory_boards (id, title) VALUES (?, ?)',
    [id, title],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id, title });
    }
  );
});

// GET /api/memory/boards/:id
router.get('/memory/boards/:id', (req, res) => {
  memoryDb.get('SELECT * FROM memory_boards WHERE id = ?', [req.params.id], (err, board) => {
    if (err || !board) return res.status(404).json({ error: '面板不存在' });
    memoryDb.all(
      'SELECT * FROM memory_board_blocks WHERE board_id = ? ORDER BY position',
      [req.params.id],
      (err2, blocks) => {
        if (err2) return res.status(500).json({ error: err2.message });
        const parsed = (blocks || []).map(b => {
          let content = b.content;
          try { content = JSON.parse(b.content); } catch { /* keep string */ }
          return { ...b, content };
        });
        res.json({ board, blocks: parsed });
      }
    );
  });
});

// PATCH /api/memory/boards/:id
// body: { title?, blocks? } — blocks 全量替换
router.patch('/memory/boards/:id', (req, res) => {
  const { title, blocks } = req.body;
  const boardId = req.params.id;

  const doReplace = (callback) => {
    if (!blocks) return callback();
    memoryDb.run('DELETE FROM memory_board_blocks WHERE board_id = ?', [boardId], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!blocks.length) return callback();

      let done = 0, failed = false;
      blocks.forEach((block, i) => {
        const bid = block.id || genId('blk');
        const position = block.position ?? (i + 1);
        const content = typeof block.content === 'string' ? block.content : JSON.stringify(block.content);
        memoryDb.run(
          'INSERT INTO memory_board_blocks (id, board_id, type, content, position) VALUES (?, ?, ?, ?, ?)',
          [bid, boardId, block.type, content, position],
          (err2) => {
            if (failed) return;
            if (err2) { failed = true; return res.status(500).json({ error: err2.message }); }
            if (++done === blocks.length) callback();
          }
        );
      });
    });
  };

  doReplace(() => {
    const updates = [];
    const vals = [];
    if (title !== undefined) { updates.push('title = ?'); vals.push(title); }
    updates.push("updated_at = datetime('now')");
    vals.push(boardId);
    memoryDb.run(`UPDATE memory_boards SET ${updates.join(', ')} WHERE id = ?`, vals, function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
  });
});

// DELETE /api/memory/boards/:id
router.delete('/memory/boards/:id', (req, res) => {
  memoryDb.run('DELETE FROM memory_boards WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: '面板不存在' });
    res.json({ success: true });
  });
});

// POST /api/memory/boards/:id/send-to-chronicle
// 将标注面板发布为 Chronicle 条目，发布后面板从列表隐藏
router.post('/memory/boards/:id/send-to-chronicle', (req, res) => {
  const boardId = req.params.id;
  const { title, summary } = req.body;
  if (!title) return res.status(400).json({ error: 'title 必填' });

  memoryDb.get('SELECT * FROM memory_boards WHERE id = ?', [boardId], (err, board) => {
    if (err || !board) return res.status(404).json({ error: '面板不存在' });
    if (board.chronicle_entry_id) return res.status(409).json({ error: '该面板已发布到 Chronicle' });

    const entryId = genId('ce');
    memoryDb.run(
      `INSERT INTO chronicle_entries (id, type, source_id, title, summary, start_time, end_time)
       VALUES (?, 'memory', ?, ?, ?, datetime('now'), datetime('now'))`,
      [entryId, boardId, title, summary || null],
      (err) => {
        if (err) return res.status(500).json({ error: err.message });
        memoryDb.run(
          'UPDATE memory_boards SET chronicle_entry_id = ?, updated_at = datetime(\'now\') WHERE id = ?',
          [entryId, boardId],
          (err2) => {
            if (err2) return res.status(500).json({ error: err2.message });
            res.json({ success: true, chronicle_entry_id: entryId });
          }
        );
      }
    );
  });
});

module.exports = { init };
