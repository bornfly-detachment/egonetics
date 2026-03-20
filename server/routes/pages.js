/**
 * routes/pages.js
 * /api/pages  — 页面 CRUD + 块编辑（统一所有类型：page/task/theory/blog）
 * /api/notion — 兼容旧版 Notion Blocks API
 *
 * 新增：
 *   GET  /api/pages/:id/subtree   — Canvas 用，返回子孙页面树（只到 page 层）
 *   POST /api/pages               — 含 task 专属字段
 *   PATCH /api/pages/:id          — 含 task 专属字段 + 标题去重
 *   DELETE /api/pages/:id         — 级联删除 + graph.db 同步
 */

const express = require('express');
const router = express.Router();
const { syncPageUpsert, syncPageDelete } = require('../lib/graph-sync');

let pagesDb;

function init(dbs) {
  pagesDb = dbs.pagesDb;
  return router;
}

function genId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const PAGE_COLS = `id, parent_id as parentId, page_type as pageType, ref_id as refId,
  title, icon, position,
  column_id as columnId, priority, assignee, start_date as startDate,
  due_date as dueDate, project, project_icon as projectIcon,
  sort_order as sortOrder, tags,
  chronicle_entry_id as chronicleEntryId,
  task_outcome as taskOutcome, task_summary as taskSummary,
  created_at as createdAt, updated_at as updatedAt`;

function parseRow(row) {
  if (!row) return null;
  return {
    ...row,
    tags: row.tags ? (() => { try { return JSON.parse(row.tags); } catch { return []; } })() : [],
  };
}

// ── 标题去重检查 ────────────────────────────────────────────────
function checkTitleUnique(parentId, title, excludeId, cb) {
  let sql, params;
  if (parentId === null || parentId === undefined) {
    sql = 'SELECT id FROM pages WHERE parent_id IS NULL AND title = ?' + (excludeId ? ' AND id != ?' : '');
    params = excludeId ? [title, excludeId] : [title];
  } else {
    sql = 'SELECT id FROM pages WHERE parent_id = ? AND title = ?' + (excludeId ? ' AND id != ?' : '');
    params = excludeId ? [parentId, title, excludeId] : [parentId, title];
  }
  pagesDb.get(sql, params, (err, row) => {
    if (err) return cb(err, false);
    cb(null, !!row); // true = duplicate exists
  });
}

// ── GET /api/pages ──────────────────────────────────────────────
// ?type=xxx         — 按 page_type 过滤
// ?refId=xxx        — CTE 递归返回整棵子树（忽略 type）
// ?taskRefId=xxx    — 返回 ref_id=xxx 且 page_type='exec_step' 的页面，
//                     平铺线性，按 created_at ASC（执行过程记录用）
// ?rootOnly=true    — 只返回根页面（parent_id IS NULL）
router.get('/pages', (req, res) => {
  const { type, refId, taskRefId, rootOnly } = req.query;

  // exec_step 线性过程记录（不做 CTE 递归，保持过程顺序）
  if (taskRefId) {
    pagesDb.all(
      `SELECT ${PAGE_COLS} FROM pages
       WHERE ref_id = ? AND page_type = 'exec_step'
       ORDER BY created_at ASC`,
      [taskRefId],
      (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.map(parseRow));
      }
    );
    return;
  }

  if (refId) {
    const sql = `
      WITH RECURSIVE tree AS (
        SELECT * FROM pages WHERE ref_id = ?
        UNION ALL
        SELECT p.* FROM pages p INNER JOIN tree t ON p.parent_id = t.id
      )
      SELECT ${PAGE_COLS} FROM tree ORDER BY position`;
    pagesDb.all(sql, [refId], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows.map(parseRow));
    });
    return;
  }

  let sql = `SELECT ${PAGE_COLS} FROM pages WHERE 1=1`;
  const params = [];
  if (type)                   { sql += ' AND page_type = ?'; params.push(type); }
  if (rootOnly === 'true')    { sql += ' AND parent_id IS NULL'; }
  sql += ' ORDER BY position';

  pagesDb.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(parseRow));
  });
});

// ── GET /api/pages/:id ──────────────────────────────────────────
router.get('/pages/:id', (req, res) => {
  pagesDb.get(`SELECT ${PAGE_COLS} FROM pages WHERE id = ?`, [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Page 不存在' });
    res.json(parseRow(row));
  });
});

// ── GET /api/pages/:id/subtree ─────────────────────────────────
// Canvas 用：返回以 :id 为根的全部子孙页面（只含 page 元数据，不含 blocks）
router.get('/pages/:id/subtree', (req, res) => {
  const sql = `
    WITH RECURSIVE tree AS (
      SELECT * FROM pages WHERE id = ?
      UNION ALL
      SELECT p.* FROM pages p INNER JOIN tree t ON p.parent_id = t.id
    )
    SELECT ${PAGE_COLS} FROM tree ORDER BY position`;
  pagesDb.all(sql, [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(parseRow));
  });
});

// ── POST /api/pages ─────────────────────────────────────────────
router.post('/pages', (req, res) => {
  const {
    parentId, title = '未命名页面', icon = '📄',
    position = 1.0, pageType = 'page', refId,
    // task fields
    columnId = 'planned', priority = 'medium', assignee, startDate, dueDate,
    project, projectIcon, sortOrder = 0, tags = [],
  } = req.body;

  const titleTrimmed = title.trim();
  if (!titleTrimmed) return res.status(400).json({ error: '标题不能为空' });

  // exec_step pages are agent-generated execution records — skip title uniqueness
  const skipDupCheck = pageType === 'exec_step';

  checkTitleUnique(parentId || null, titleTrimmed, null, (err, dup) => {
    if (err) return res.status(500).json({ error: err.message });
    if (dup && !skipDupCheck) return res.status(409).json({ error: `同级目录下已存在标题「${titleTrimmed}」` });

    const id = genId('page');
    const tagsJson = JSON.stringify(Array.isArray(tags) ? tags : []);

    pagesDb.run(
      `INSERT INTO pages
         (id, parent_id, page_type, ref_id, title, icon, position,
          column_id, priority, assignee, start_date, due_date,
          project, project_icon, sort_order, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, parentId || null, pageType, refId || null, titleTrimmed, icon, position,
       columnId, priority, assignee || null, startDate || null, dueDate || null,
       project || null, projectIcon || null, sortOrder, tagsJson],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        const page = {
          id, parentId: parentId || null, pageType, refId: refId || null,
          title: titleTrimmed, icon, position,
          columnId, priority, assignee: assignee || null,
          startDate: startDate || null, dueDate: dueDate || null,
          project: project || null, projectIcon: projectIcon || null,
          sortOrder, tags: Array.isArray(tags) ? tags : [],
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        };
        // best-effort graph sync
        syncPageUpsert({ id, title: titleTrimmed, page_type: pageType, icon });
        res.status(201).json(page);
      }
    );
  });
});

// ── PATCH /api/pages/:id ────────────────────────────────────────
router.patch('/pages/:id', (req, res) => {
  const pageId = req.params.id;
  const {
    title, icon,
    // task fields
    columnId, priority, assignee, startDate, dueDate,
    project, projectIcon, sortOrder, tags,
    chronicleEntryId, taskOutcome, taskSummary,
  } = req.body;

  const updates = ["updated_at = CURRENT_TIMESTAMP"];
  const params = [];

  const doUpdate = () => {
    if (updates.length === 1) return res.status(400).json({ error: '没有要更新的字段' });
    params.push(pageId);
    pagesDb.run(`UPDATE pages SET ${updates.join(', ')} WHERE id = ?`, params, function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: '页面不存在' });

      pagesDb.get(`SELECT ${PAGE_COLS} FROM pages WHERE id = ?`, [pageId], (err, page) => {
        if (err) return res.status(500).json({ error: err.message });
        const parsed = parseRow(page);
        // graph sync
        if (title !== undefined || icon !== undefined) {
          syncPageUpsert({ id: pageId, title: parsed.title, page_type: parsed.pageType, icon: parsed.icon });
        }
        res.json(parsed);
      });
    });
  };

  if (title !== undefined) {
    const titleTrimmed = title.trim();
    if (!titleTrimmed) return res.status(400).json({ error: '标题不能为空' });
    // check uniqueness within same parent
    pagesDb.get('SELECT parent_id FROM pages WHERE id = ?', [pageId], (err, row) => {
      if (err || !row) return res.status(404).json({ error: '页面不存在' });
      checkTitleUnique(row.parent_id, titleTrimmed, pageId, (err2, dup) => {
        if (err2) return res.status(500).json({ error: err2.message });
        if (dup) return res.status(409).json({ error: `同级目录下已存在标题「${titleTrimmed}」` });
        updates.push('title = ?'); params.push(titleTrimmed);
        finishPatch();
      });
    });
    return;
  }
  finishPatch();

  function finishPatch() {
    if (icon           !== undefined) { updates.push('icon = ?');              params.push(icon); }
    if (columnId       !== undefined) { updates.push('column_id = ?');         params.push(columnId); }
    if (priority       !== undefined) { updates.push('priority = ?');          params.push(priority); }
    if (assignee       !== undefined) { updates.push('assignee = ?');          params.push(assignee); }
    if (startDate      !== undefined) { updates.push('start_date = ?');        params.push(startDate); }
    if (dueDate        !== undefined) { updates.push('due_date = ?');          params.push(dueDate); }
    if (project        !== undefined) { updates.push('project = ?');           params.push(project); }
    if (projectIcon    !== undefined) { updates.push('project_icon = ?');      params.push(projectIcon); }
    if (sortOrder      !== undefined) { updates.push('sort_order = ?');        params.push(sortOrder); }
    if (tags           !== undefined) { updates.push('tags = ?');              params.push(JSON.stringify(tags)); }
    if (chronicleEntryId !== undefined) { updates.push('chronicle_entry_id = ?'); params.push(chronicleEntryId); }
    if (taskOutcome    !== undefined) { updates.push('task_outcome = ?');      params.push(taskOutcome); }
    if (taskSummary    !== undefined) { updates.push('task_summary = ?');      params.push(taskSummary); }
    doUpdate();
  }
});

// ── DELETE /api/pages/:id ───────────────────────────────────────
router.delete('/pages/:id', (req, res) => {
  const pageId = req.params.id;

  // 收集整棵子树 ID 用于 graph.db 清理
  pagesDb.all(
    `WITH RECURSIVE tree AS (
       SELECT id FROM pages WHERE id = ?
       UNION ALL
       SELECT p.id FROM pages p INNER JOIN tree t ON p.parent_id = t.id
     ) SELECT id FROM tree`,
    [pageId],
    (err, rows) => {
      const subtreeIds = rows ? rows.map(r => r.id) : [pageId];

      pagesDb.run('DELETE FROM pages WHERE id = ?', [pageId], function(err2) {
        if (err2) return res.status(500).json({ error: err2.message });
        if (this.changes === 0) return res.status(404).json({ error: '页面不存在' });

        // 级联清理 graph.db（best-effort）
        subtreeIds.forEach(id => syncPageDelete(id));

        // 清理 canvas_nodes 中引用这些页面的节点
        if (subtreeIds.length) {
          const ph = subtreeIds.map(() => '?').join(',');
          pagesDb.run(
            `DELETE FROM canvas_nodes WHERE entity_type = 'page' AND entity_id IN (${ph})`,
            subtreeIds, () => {}
          );
        }

        res.json({ ok: true });
      });
    }
  );
});

// ── POST /api/pages/:id/move ────────────────────────────────────
router.post('/pages/:id/move', (req, res) => {
  const { newParentId, newPosition } = req.body;
  pagesDb.run(
    'UPDATE pages SET parent_id = ?, position = ? WHERE id = ?',
    [newParentId !== undefined ? (newParentId || null) : null, newPosition, req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: '页面不存在' });
      pagesDb.get(`SELECT ${PAGE_COLS} FROM pages WHERE id = ?`, [req.params.id], (err, page) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(parseRow(page));
      });
    }
  );
});

// ── GET /api/pages/:id/blocks ────────────────────────────────────
router.get('/pages/:id/blocks', (req, res) => {
  pagesDb.all(
    `SELECT id, parent_id as parentId, type, content, position, metadata, collapsed,
            title, creator, edit_start_time as editStartTime,
            draft_explanation as draftExplanation,
            created_at as createdAt, updated_at as updatedAt
     FROM blocks WHERE page_id = ? ORDER BY position`,
    [req.params.id], (err, blocks) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(blocks.map(b => ({
        ...b,
        content:  (() => { try { return JSON.parse(b.content || '{}'); } catch { return {}; } })(),
        metadata: (() => { try { return JSON.parse(b.metadata || '{}'); } catch { return {}; } })(),
      })));
    }
  );
});

// ── PUT /api/pages/:id/blocks ────────────────────────────────────
router.put('/pages/:id/blocks', async (req, res) => {
  const pageId = req.params.id;
  const blocks = req.body;
  if (!Array.isArray(blocks)) return res.status(400).json({ error: 'blocks 必须是数组' });

  const run = (sql, params = []) => new Promise((resolve, reject) =>
    pagesDb.run(sql, params, (err) => err ? reject(err) : resolve())
  );
  const all = (sql, params = []) => new Promise((resolve, reject) =>
    pagesDb.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows))
  );

  try {
    await run('BEGIN TRANSACTION');
    await run('DELETE FROM blocks WHERE page_id = ?', [pageId]);

    for (const block of blocks) {
      const blockId  = block.id || genId('block');
      const content  = typeof block.content  === 'string' ? block.content  : JSON.stringify(block.content  || {});
      const metadata = typeof block.metadata === 'string' ? block.metadata : JSON.stringify(block.metadata || {});
      await run(
        `INSERT INTO blocks
           (id, page_id, parent_id, type, content, position, metadata, collapsed,
            title, creator, edit_start_time, draft_explanation, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))`,
        [
          blockId, pageId, block.parentId || null, block.type || 'paragraph',
          content, block.position || 1.0, metadata, block.collapsed ? 1 : 0,
          block.title || '', block.creator || '', block.editStartTime || null,
          block.draftExplanation || '', block.createdAt || null,
        ]
      );
    }

    await run('COMMIT');
    const saved = await all(
      `SELECT id, parent_id as parentId, type, content, position, metadata, collapsed,
              title, creator, edit_start_time as editStartTime,
              draft_explanation as draftExplanation,
              created_at as createdAt, updated_at as updatedAt
       FROM blocks WHERE page_id = ? ORDER BY position`,
      [pageId]
    );
    res.json(saved.map(b => ({
      ...b,
      content:  (() => { try { return JSON.parse(b.content  || '{}'); } catch { return {}; } })(),
      metadata: (() => { try { return JSON.parse(b.metadata || '{}'); } catch { return {}; } })(),
    })));
  } catch (err) {
    pagesDb.run('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/pages/:id/blocks/append ───────────────────────────
// Agent 用：追加单个 block，不影响已有内容
router.post('/pages/:id/blocks/append', (req, res) => {
  const pageId = req.params.id;
  const { type = 'paragraph', content = {}, creator = 'agent' } = req.body;

  // Get max position
  pagesDb.get('SELECT MAX(position) as maxPos FROM blocks WHERE page_id = ?', [pageId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    const nextPos = ((row && row.maxPos) || 0) + 1;
    const blockId = genId('block');
    const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
    const ts = new Date().toISOString();

    pagesDb.run(
      `INSERT INTO blocks (id, page_id, type, content, position, creator, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [blockId, pageId, type, contentStr, nextPos, creator, ts, ts],
      function(insertErr) {
        if (insertErr) return res.status(500).json({ error: insertErr.message });
        // Update page updated_at
        pagesDb.run('UPDATE pages SET updated_at = ? WHERE id = ?', [ts, pageId]);
        res.status(201).json({
          id: blockId, page_id: pageId, type,
          content: typeof content === 'string' ? JSON.parse(content || '{}') : content,
          position: nextPos, creator, created_at: ts,
        });
      }
    );
  });
});

// ── PATCH /api/blocks/:blockId/meta ─────────────────────────────
router.patch('/blocks/:blockId/meta', (req, res) => {
  const { title, creator, editStartTime, draftExplanation } = req.body;
  const updates = ['updated_at = CURRENT_TIMESTAMP'];
  const params = [];
  if (title            !== undefined) { updates.push('title = ?');            params.push(title); }
  if (creator          !== undefined) { updates.push('creator = ?');          params.push(creator); }
  if (editStartTime    !== undefined) { updates.push('edit_start_time = ?');  params.push(editStartTime); }
  if (draftExplanation !== undefined) { updates.push('draft_explanation = ?'); params.push(draftExplanation); }
  if (updates.length === 1) return res.status(400).json({ error: '没有要更新的字段' });
  params.push(req.params.blockId);
  pagesDb.run(`UPDATE blocks SET ${updates.join(', ')} WHERE id = ?`, params, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Block 不存在' });
    res.json({ ok: true });
  });
});

// ── POST /api/blocks/:blockId/publish ───────────────────────────
router.post('/blocks/:blockId/publish', (req, res) => {
  const { explanation = '' } = req.body;
  const blockId = req.params.blockId;
  pagesDb.get(
    'SELECT id, title, creator, content, edit_start_time, created_at FROM blocks WHERE id = ?',
    [blockId],
    (err, block) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!block) return res.status(404).json({ error: 'Block 不存在' });
      pagesDb.get('SELECT COUNT(*) as cnt FROM process_versions WHERE entity_id = ?', [blockId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        const versionNum  = (row?.cnt || 0) + 1;
        const versionId   = `pv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const publisher   = req.user ? `human:${req.user.username}` : 'unknown';
        const publishTime = new Date().toISOString();
        const startTime   = block.edit_start_time || block.created_at;
        pagesDb.run(
          `INSERT INTO process_versions
             (id, entity_id, entity_type, version_num, start_time, publish_time,
              publisher, title_snapshot, content_snapshot, explanation)
           VALUES (?, ?, 'block', ?, ?, ?, ?, ?, ?, ?)`,
          [versionId, blockId, versionNum, startTime, publishTime, publisher,
           block.title || '', block.content, explanation],
          function(err) {
            if (err) return res.status(500).json({ error: err.message });
            pagesDb.run(
              "UPDATE blocks SET edit_start_time = NULL, draft_explanation = '' WHERE id = ?",
              [blockId], () => {}
            );
            res.status(201).json({
              id: versionId, entity_id: blockId, entity_type: 'block',
              version_num: versionNum, start_time: startTime, publish_time: publishTime,
              publisher, explanation,
            });
          }
        );
      });
    }
  );
});

// ── GET /api/blocks/:blockId/versions ───────────────────────────
router.get('/blocks/:blockId/versions', (req, res) => {
  pagesDb.all(
    `SELECT * FROM process_versions WHERE entity_id = ? AND entity_type = 'block' ORDER BY version_num ASC`,
    [req.params.blockId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows.map(v => ({
        ...v,
        content_snapshot: (() => { try { return JSON.parse(v.content_snapshot || '{}'); } catch { return {}; } })(),
      })));
    }
  );
});

// ── /api/notion compat (blocks in pagesDb now) ──────────────────
router.get('/notion/pages/:pageId/blocks', (req, res) => {
  pagesDb.all('SELECT * FROM blocks WHERE page_id = ? ORDER BY position', [req.params.pageId], (err, blocks) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ blocks });
  });
});

router.post('/notion/blocks', (req, res) => {
  const { pageId, parentId, type, content, position } = req.body;
  const id = genId('block');
  pagesDb.run(
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
  pagesDb.run(`UPDATE blocks SET ${updates.join(', ')} WHERE id = ?`, params, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: '块不存在' });
    res.json({ success: true });
  });
});

router.delete('/notion/blocks/:id', (req, res) => {
  const deleteRecursive = (id, cb) => {
    pagesDb.all('SELECT id FROM blocks WHERE parent_id = ?', [id], (err, children) => {
      if (err) return cb(err);
      if (children.length === 0) return pagesDb.run('DELETE FROM blocks WHERE id = ?', [id], cb);
      let done = 0;
      children.forEach(c => deleteRecursive(c.id, (err) => {
        if (err) return cb(err);
        if (++done === children.length) pagesDb.run('DELETE FROM blocks WHERE id = ?', [id], cb);
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

  pagesDb.run('BEGIN TRANSACTION', (err) => {
    if (err) return res.status(500).json({ error: err.message });
    let done = 0;
    const total = operations.length;
    const errors = [];

    const checkCompletion = () => {
      if (done < total) return;
      if (errors.length > 0) {
        pagesDb.run('ROLLBACK', () => res.status(500).json({ error: errors.join(', ') }));
      } else {
        pagesDb.run('COMMIT', () => res.json({ success: true }));
      }
    };

    const deleteRecursive = (id, cb) => {
      pagesDb.all('SELECT id FROM blocks WHERE parent_id = ?', [id], (err, children) => {
        if (err) return cb(err);
        if (children.length === 0) return pagesDb.run('DELETE FROM blocks WHERE id = ?', [id], cb);
        let d = 0;
        children.forEach(c => deleteRecursive(c.id, (err) => {
          if (err) return cb(err);
          if (++d === children.length) pagesDb.run('DELETE FROM blocks WHERE id = ?', [id], cb);
        }));
      });
    };

    if (total === 0) { pagesDb.run('COMMIT', () => res.json({ success: true })); return; }

    operations.forEach(op => {
      if (op.type === 'create') {
        const id = genId('block');
        pagesDb.run(
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
        pagesDb.run(`UPDATE blocks SET ${upd.join(', ')} WHERE id = ?`, prm,
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
