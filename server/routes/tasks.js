/**
 * routes/tasks.js
 * /api/tasks  — Task CRUD + 属性 + 版本
 * /api/kanban — 看板视图
 *
 * 统一使用 pagesDb（pages 表，page_type='task'）
 * API 契约与原 tasks.js 保持完全兼容（KanbanBoard.tsx 零改动）
 */

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { syncPageUpsert, syncPageDelete } = require('../lib/graph-sync');

let pagesDb;

function init(db) {
  pagesDb = db;
  return router;
}

function genId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function tryParse(s) {
  try { return JSON.parse(s); } catch { return s || {}; }
}

// pages 表行 → Kanban Task 格式（KanbanBoard.tsx 需要）
function rowToKanbanTask(row) {
  return {
    id:          row.id,
    columnId:    row.column_id   || 'planned',
    status:      row.column_id   || 'planned',
    name:        row.title,        // pages.title → tasks.name
    icon:        row.icon,
    priority:    row.priority    || 'medium',
    sortOrder:   row.sort_order  || 0,
    assignee:    row.assignee    || null,
    startDate:   row.start_date  || null,
    dueDate:     row.due_date    || null,
    project:     row.project     || null,
    projectIcon: row.project_icon || null,
    tags:        row.tags ? (() => { try { return JSON.parse(row.tags); } catch { return []; } })() : [],
    created_at:  row.created_at,
    updated_at:  row.updated_at,
  };
}

function getDefaultValue(type) {
  switch (type) {
    case 'text': case 'url': return '';
    case 'number':           return 0;
    case 'select':           return '';
    case 'multi-select':     return [];
    case 'date':             return null;
    case 'checkbox':         return false;
    default:                 return '';
  }
}

// ── /api/tasks ───────────────────────────────────────────────────

router.get('/tasks', (req, res) => {
  pagesDb.all(`
    SELECT p.*,
           COUNT(DISTINCT pd.id) AS property_count,
           COUNT(DISTINCT pv.id) AS version_count
    FROM pages p
    LEFT JOIN page_property_defs pd ON p.id = pd.page_id
    LEFT JOIN process_versions    pv ON p.id = pv.entity_id AND pv.entity_type = 'task_version'
    WHERE p.page_type = 'task' AND p.parent_id IS NULL AND p.chronicle_entry_id IS NULL
    GROUP BY p.id
    ORDER BY p.updated_at DESC
  `, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const tasks = rows.map(r => ({
      ...r,
      name: r.title,   // compat alias
      tags: r.tags ? (() => { try { return JSON.parse(r.tags); } catch { return []; } })() : [],
    }));
    res.json({ tasks });
  });
});

router.get('/tasks/:id', (req, res) => {
  const taskId = req.params.id;
  pagesDb.get('SELECT * FROM pages WHERE id = ? AND page_type = ?', [taskId, 'task'], (err, task) => {
    if (err || !task) return res.status(404).json({ error: '任务不存在' });

    pagesDb.all('SELECT * FROM page_property_defs WHERE page_id = ? ORDER BY display_order', [taskId], (err, propertyDefs) => {
      if (err) return res.status(500).json({ error: err.message });

      pagesDb.all(`
        SELECT pp.*, pd.name, pd.type
        FROM page_properties pp
        JOIN page_property_defs pd ON pp.property_def_id = pd.id
        WHERE pp.page_id = ?
      `, [taskId], (err, properties) => {
        if (err) return res.status(500).json({ error: err.message });

        const propertyValues = {};
        properties.forEach(prop => {
          let value;
          switch (prop.type) {
            case 'text':         value = prop.value_text;   break;
            case 'number':       value = prop.value_number; break;
            case 'date':         value = prop.value_date;   break;
            case 'checkbox':     value = prop.value_boolean === 1; break;
            case 'select':
            case 'multi-select':
            case 'url':          value = prop.value_json ? tryParse(prop.value_json) : null; break;
            default:             value = prop.value_text;
          }
          propertyValues[prop.name] = value;
        });

        res.json({
          ...task,
          name: task.title,
          tags: task.tags ? (() => { try { return JSON.parse(task.tags); } catch { return []; } })() : [],
          propertyDefs,
          properties: propertyValues,
        });
      });
    });
  });
});

router.post('/tasks', (req, res) => {
  const {
    name, icon = '📋', content = '',
    column_id = 'planned', sort_order = 0, priority = 'medium',
    assignee = null, start_date = null, due_date = null,
    tags = [], project = null, project_icon = null,
  } = req.body;

  const title = (name || 'Untitled').trim();
  const id = genId('t');
  const tagsJson = JSON.stringify(Array.isArray(tags) ? tags : []);

  // Check title uniqueness at root level for tasks
  pagesDb.get(
    "SELECT id FROM pages WHERE page_type = 'task' AND title = ? AND parent_id IS NULL",
    [title],
    (err, existing) => {
      if (err) return res.status(500).json({ error: err.message });
      // For tasks, root-level title uniqueness is optional (tasks can share names via subtasks)
      // We create the root task page without parent

      pagesDb.run(
        `INSERT INTO pages
           (id, page_type, title, icon, column_id, sort_order, priority,
            assignee, start_date, due_date, tags, project, project_icon, ref_id)
         VALUES (?, 'task', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, title, icon, column_id, sort_order, priority,
         assignee, start_date, due_date, tagsJson, project, project_icon,
         id],  // ref_id = self id for root task pages
        function(err) {
          if (err) return res.status(500).json({ error: err.message });
          syncPageUpsert({ id, title, page_type: 'task', icon });
          res.status(201).json({
            success: true, id,
            task: {
              id, name: title, icon, column_id, sort_order, priority,
              assignee, start_date, due_date, tags,
              project, project_icon,
              created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
              property_count: 0, version_count: 0,
            }
          });
        }
      );
    }
  );
});

router.put('/tasks/:id', (req, res) => {
  const taskId = req.params.id;
  const { name, icon, content, column_id, sort_order, priority,
          assignee, start_date, due_date, tags, project, project_icon,
          task_outcome, task_summary, chronicle_entry_id } = req.body;

  const updates = [], params = [];

  if (name             !== undefined) { updates.push('title = ?');             params.push(name); }
  if (icon             !== undefined) { updates.push('icon = ?');              params.push(icon); }
  if (column_id        !== undefined) { updates.push('column_id = ?');         params.push(column_id); }
  if (sort_order       !== undefined) { updates.push('sort_order = ?');        params.push(sort_order); }
  if (priority         !== undefined) { updates.push('priority = ?');          params.push(priority); }
  if (assignee         !== undefined) { updates.push('assignee = ?');          params.push(assignee); }
  if (start_date       !== undefined) { updates.push('start_date = ?');        params.push(start_date); }
  if (due_date         !== undefined) { updates.push('due_date = ?');          params.push(due_date); }
  if (tags             !== undefined) { updates.push('tags = ?');              params.push(JSON.stringify(tags)); }
  if (project          !== undefined) { updates.push('project = ?');           params.push(project); }
  if (project_icon     !== undefined) { updates.push('project_icon = ?');      params.push(project_icon); }
  if (task_outcome     !== undefined) { updates.push('task_outcome = ?');      params.push(task_outcome); }
  if (task_summary     !== undefined) { updates.push('task_summary = ?');      params.push(task_summary); }
  if (chronicle_entry_id !== undefined) { updates.push('chronicle_entry_id = ?'); params.push(chronicle_entry_id); }

  if (updates.length === 0) return res.status(400).json({ error: '没有要更新的字段' });
  updates.push("updated_at = datetime('now')");
  params.push(taskId);

  pagesDb.run(`UPDATE pages SET ${updates.join(', ')} WHERE id = ? AND page_type = 'task'`, params, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: '任务不存在' });
    // sync root page title to pages where ref_id = taskId
    if (name !== undefined) {
      pagesDb.run("UPDATE pages SET title = ?, updated_at = datetime('now') WHERE ref_id = ? AND id != ?",
        [name, taskId, taskId], () => {});
      syncPageUpsert({ id: taskId, title: name, page_type: 'task', icon: icon || '📋' });
    }
    res.json({ success: true, updated_at: new Date().toISOString() });
  });
});

router.patch('/tasks/:id', (req, res) => {
  const taskId = req.params.id;
  const u = req.body;
  const fields = [], values = [];

  if (u.title        !== undefined) { fields.push('title = ?');        values.push(u.title); }
  if (u.column_id    !== undefined) { fields.push('column_id = ?');    values.push(u.column_id); }
  if (u.task_summary !== undefined) { fields.push('task_summary = ?'); values.push(u.task_summary); }
  if (u.task_outcome !== undefined) { fields.push('task_outcome = ?'); values.push(u.task_outcome); }
  if (u.priority     !== undefined) { fields.push('priority = ?');     values.push(u.priority); }
  if (u.assignee     !== undefined) { fields.push('assignee = ?');     values.push(u.assignee); }

  if (fields.length === 0) return res.status(400).json({ error: '没有要更新的字段' });
  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(taskId);

  pagesDb.run(`UPDATE pages SET ${fields.join(', ')} WHERE id = ? AND page_type = 'task'`, values, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: '任务不存在' });
    res.json({ success: true, id: taskId });
  });
});

router.delete('/tasks/:id', (req, res) => {
  const taskId = req.params.id;

  // Collect full subtree for graph cleanup
  pagesDb.all(
    `WITH RECURSIVE tree AS (
       SELECT id FROM pages WHERE ref_id = ? AND id = ?
       UNION ALL
       SELECT p.id FROM pages p INNER JOIN tree t ON p.parent_id = t.id
     ) SELECT id FROM tree`,
    [taskId, taskId],
    (err, rows) => {
      const subtreeIds = rows ? rows.map(r => r.id) : [taskId];

      pagesDb.run("DELETE FROM pages WHERE id = ? AND page_type = 'task'", [taskId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: '任务不存在' });

        subtreeIds.forEach(id => syncPageDelete(id));
        if (subtreeIds.length) {
          const ph = subtreeIds.map(() => '?').join(',');
          pagesDb.run(`DELETE FROM canvas_nodes WHERE entity_id IN (${ph})`, subtreeIds, () => {});
        }
        res.json({ success: true });
      });
    }
  );
});

// Task → Chronicle
router.post('/tasks/:id/send-to-chronicle', (req, res) => {
  const taskId = req.params.id;
  const { task_outcome, task_summary } = req.body;
  if (!task_outcome) return res.status(400).json({ error: 'task_outcome 必填' });

  const entryId = genId('ce');
  pagesDb.get("SELECT * FROM pages WHERE id = ? AND page_type = 'task'", [taskId], (err, task) => {
    if (err || !task) return res.status(404).json({ error: '任务不存在' });
    if (task.chronicle_entry_id) return res.status(409).json({ error: '该任务已入库 Chronicle' });
    pagesDb.run(
      "UPDATE pages SET task_outcome = ?, task_summary = ?, chronicle_entry_id = ?, updated_at = datetime('now') WHERE id = ?",
      [task_outcome, task_summary || null, entryId, taskId],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, chronicle_entry_id: entryId, task_outcome, task_summary });
      }
    );
  });
});

// ── 属性定义（page_property_defs） ─────────────────────────────

router.post('/tasks/:id/properties/definitions', (req, res) => {
  const pageId = req.params.id;
  const { name, type, options } = req.body;
  const defId = genId('prop');

  pagesDb.run(
    'INSERT INTO page_property_defs (id, page_id, name, type, options, display_order) VALUES (?, ?, ?, ?, ?, ?)',
    [defId, pageId, name, type, options ? JSON.stringify(options) : null, 0],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      const defaultValue = getDefaultValue(type);
      const propId = genId('pval');
      let valueSql, valueParams;
      switch (type) {
        case 'text': case 'url':
          valueSql = 'INSERT INTO page_properties (id, page_id, property_def_id, value_text) VALUES (?, ?, ?, ?)';
          valueParams = [propId, pageId, defId, defaultValue]; break;
        case 'number':
          valueSql = 'INSERT INTO page_properties (id, page_id, property_def_id, value_number) VALUES (?, ?, ?, ?)';
          valueParams = [propId, pageId, defId, defaultValue]; break;
        case 'date':
          valueSql = 'INSERT INTO page_properties (id, page_id, property_def_id, value_date) VALUES (?, ?, ?, ?)';
          valueParams = [propId, pageId, defId, defaultValue]; break;
        case 'checkbox':
          valueSql = 'INSERT INTO page_properties (id, page_id, property_def_id, value_boolean) VALUES (?, ?, ?, ?)';
          valueParams = [propId, pageId, defId, 0]; break;
        case 'select': case 'multi-select':
          valueSql = 'INSERT INTO page_properties (id, page_id, property_def_id, value_json) VALUES (?, ?, ?, ?)';
          valueParams = [propId, pageId, defId, JSON.stringify(defaultValue)]; break;
        default:
          return res.json({ success: true, id: defId });
      }
      pagesDb.run(valueSql, valueParams, () => res.json({ success: true, id: defId }));
    }
  );
});

router.put('/tasks/:id/properties/:propertyName', (req, res) => {
  const { id: pageId, propertyName } = req.params;
  const { value } = req.body;

  pagesDb.get('SELECT id, type FROM page_property_defs WHERE page_id = ? AND name = ?', [pageId, propertyName], (err, def) => {
    if (err || !def) return res.status(404).json({ error: '属性定义不存在' });

    const colMap = { text: 'value_text', url: 'value_text', number: 'value_number',
                     date: 'value_date', checkbox: 'value_boolean', select: 'value_json', 'multi-select': 'value_json' };
    const col = colMap[def.type];
    if (!col) return res.status(400).json({ error: '不支持的属性类型' });

    const dbVal = def.type === 'checkbox' ? (value ? 1 : 0)
                : (def.type === 'select' || def.type === 'multi-select') ? JSON.stringify(value)
                : value;

    const propId = genId('pval');
    pagesDb.run(
      `INSERT INTO page_properties (id, page_id, property_def_id, ${col}) VALUES (?, ?, ?, ?)
       ON CONFLICT(page_id, property_def_id) DO UPDATE SET ${col} = excluded.${col}`,
      [propId, pageId, def.id, dbVal],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
      }
    );
  });
});

// ── 版本历史（task_versions 改为 process_versions）─────────────

router.post('/tasks/:id/versions', (req, res) => {
  const { content, previousHash } = req.body;
  const contentHash = crypto.createHash('sha256').update(content).digest('hex');
  const vId = genId('tv');
  pagesDb.run(
    `INSERT INTO process_versions
       (id, entity_id, entity_type, version_num, content_snapshot, explanation)
     SELECT ?, ?, 'task_version',
            COALESCE((SELECT MAX(version_num) FROM process_versions WHERE entity_id = ?), 0) + 1,
            ?, ?`,
    [vId, req.params.id, req.params.id, content, previousHash || ''],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, hash: contentHash, id: vId });
    }
  );
});

router.get('/tasks/:id/versions', (req, res) => {
  pagesDb.all(
    "SELECT * FROM process_versions WHERE entity_id = ? AND entity_type = 'task_version' ORDER BY created_at DESC",
    [req.params.id],
    (err, versions) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ versions });
    }
  );
});

// ── Task Blocks ──────────────────────────────────────────────────

router.get('/tasks/:id/blocks', (req, res) => {
  pagesDb.all('SELECT * FROM blocks WHERE page_id = ? ORDER BY position', [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json((rows || []).map(r => ({
      id: r.id,
      parentId: r.parent_id || null,
      type: r.type,
      content: tryParse(r.content),
      metadata: tryParse(r.metadata),
      collapsed: !!r.collapsed,
      position: r.position,
    })));
  });
});

router.put('/tasks/:id/blocks', (req, res) => {
  const blocks = req.body;
  if (!Array.isArray(blocks)) return res.status(400).json({ error: 'body must be array' });
  const pageId = req.params.id;

  pagesDb.serialize(() => {
    pagesDb.run('BEGIN TRANSACTION');
    pagesDb.run('DELETE FROM blocks WHERE page_id = ?', [pageId], (err) => {
      if (err) { pagesDb.run('ROLLBACK'); return res.status(500).json({ error: err.message }); }
      if (blocks.length === 0) {
        return pagesDb.run('COMMIT', (e) => {
          if (e) return res.status(500).json({ error: e.message });
          res.json([]);
        });
      }
      let done = 0, failed = false;
      blocks.forEach((b, i) => {
        const content  = typeof b.content  === 'string' ? b.content  : JSON.stringify(b.content  || {});
        const metadata = typeof b.metadata === 'string' ? b.metadata : JSON.stringify(b.metadata || {});
        const position = b.position ?? (i + 1);
        pagesDb.run(
          'INSERT INTO blocks (id, page_id, parent_id, type, content, metadata, collapsed, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [b.id, pageId, b.parentId || null, b.type, content, metadata, b.collapsed ? 1 : 0, position],
          (err2) => {
            if (failed) return;
            if (err2) { failed = true; pagesDb.run('ROLLBACK'); return res.status(500).json({ error: err2.message }); }
            if (++done === blocks.length) {
              pagesDb.run('COMMIT', (e) => {
                if (e) return res.status(500).json({ error: e.message });
                res.json(blocks);
              });
            }
          }
        );
      });
    });
  });
});

// ── /api/kanban ──────────────────────────────────────────────────

router.get('/kanban', (req, res) => {
  pagesDb.all(
    'SELECT id, label, header_bg as headerBg, card_bg as cardBg, accent, position FROM kanban_columns ORDER BY position',
    [], (err, columns) => {
      if (err) return res.status(500).json({ error: err.message });
      pagesDb.all(
        "SELECT * FROM pages WHERE page_type = 'task' AND parent_id IS NULL AND chronicle_entry_id IS NULL ORDER BY sort_order DESC",
        [], (err, rows) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ columns, tasks: rows.map(rowToKanbanTask) });
        }
      );
    }
  );
});

router.get('/kanban/tasks/:id', (req, res) => {
  pagesDb.get("SELECT * FROM pages WHERE id = ? AND page_type = 'task'", [req.params.id], (err, row) => {
    if (err || !row) return res.status(404).json({ error: '任务不存在' });
    res.json(rowToKanbanTask(row));
  });
});

router.put('/kanban/columns', (req, res) => {
  const columns = req.body;
  if (!Array.isArray(columns)) return res.status(400).json({ error: 'columns 必须是数组' });
  pagesDb.run('BEGIN TRANSACTION', (err) => {
    if (err) return res.status(500).json({ error: err.message });
    pagesDb.run('DELETE FROM kanban_columns', [], (err) => {
      if (err) { pagesDb.run('ROLLBACK'); return res.status(500).json({ error: err.message }); }
      if (columns.length === 0) { return pagesDb.run('COMMIT', () => res.json([])); }
      let done = 0, failed = false;
      columns.forEach((col, i) => {
        pagesDb.run(
          'INSERT INTO kanban_columns (id, label, header_bg, card_bg, accent, position) VALUES (?, ?, ?, ?, ?, ?)',
          [col.id, col.label, col.headerBg, col.cardBg, col.accent, i],
          (err) => {
            if (failed) return;
            if (err) { failed = true; pagesDb.run('ROLLBACK'); return res.status(500).json({ error: err.message }); }
            if (++done === columns.length) pagesDb.run('COMMIT', () => res.json(columns));
          }
        );
      });
    });
  });
});

router.put('/kanban/tasks', (req, res) => {
  const tasks = req.body;
  if (!Array.isArray(tasks)) return res.status(400).json({ error: 'tasks 必须是数组' });
  if (tasks.length === 0) return res.json([]);

  pagesDb.run('BEGIN TRANSACTION', (err) => {
    if (err) return res.status(500).json({ error: err.message });
    let done = 0, failed = false;
    tasks.forEach((task) => {
      const id = task.id || genId('t');
      pagesDb.run(
        `INSERT INTO pages (id, page_type, title, icon, column_id, sort_order, priority,
           assignee, start_date, due_date, project, project_icon, tags, ref_id)
         VALUES (?, 'task', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           title = excluded.title, icon = excluded.icon,
           column_id = excluded.column_id, sort_order = excluded.sort_order,
           priority = excluded.priority, assignee = excluded.assignee,
           start_date = excluded.start_date, due_date = excluded.due_date,
           project = excluded.project, project_icon = excluded.project_icon,
           tags = excluded.tags, updated_at = CURRENT_TIMESTAMP`,
        [id, task.name || 'Untitled', task.icon || '📋',
         task.columnId || task.status || 'planned', task.sortOrder ?? 0, task.priority || 'medium',
         task.assignee || null, task.startDate || null, task.dueDate || null,
         task.project || null, task.projectIcon || null,
         task.tags ? JSON.stringify(task.tags) : '[]',
         id],  // ref_id = self
        (err) => {
          if (failed) return;
          if (err) { failed = true; pagesDb.run('ROLLBACK'); return res.status(500).json({ error: err.message }); }
          if (++done === tasks.length) pagesDb.run('COMMIT', () => res.json(tasks));
        }
      );
    });
  });
});

router.post('/kanban/tasks', (req, res) => {
  const task = req.body;
  const id = task.id || genId('t');
  pagesDb.run(
    `INSERT INTO pages (id, page_type, title, icon, column_id, sort_order, priority,
       assignee, start_date, due_date, project, project_icon, tags, ref_id)
     VALUES (?, 'task', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, task.name || 'Untitled', task.icon || '📋',
     task.columnId || task.status || 'planned', task.sortOrder ?? 0, task.priority || 'medium',
     task.assignee || null, task.startDate || null, task.dueDate || null,
     task.project || null, task.projectIcon || null,
     task.tags ? JSON.stringify(task.tags) : '[]',
     id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      pagesDb.get("SELECT * FROM pages WHERE id = ?", [id], (err, row) => {
        if (err || !row) return res.status(500).json({ error: '任务创建后查询失败' });
        syncPageUpsert({ id, title: row.title, page_type: 'task', icon: row.icon });
        res.status(201).json(rowToKanbanTask(row));
      });
    }
  );
});

router.patch('/kanban/tasks/:id', (req, res) => {
  const taskId = req.params.id;
  const u = req.body;
  const fields = [], values = [];

  if (u.name        !== undefined) { fields.push('title = ?');        values.push(u.name); }
  if (u.icon        !== undefined) { fields.push('icon = ?');         values.push(u.icon); }
  if (u.assignee    !== undefined) { fields.push('assignee = ?');     values.push(u.assignee); }
  if (u.startDate   !== undefined) { fields.push('start_date = ?');   values.push(u.startDate); }
  if (u.dueDate     !== undefined) { fields.push('due_date = ?');     values.push(u.dueDate); }
  if (u.project     !== undefined) { fields.push('project = ?');      values.push(u.project); }
  if (u.projectIcon !== undefined) { fields.push('project_icon = ?'); values.push(u.projectIcon); }
  if (u.priority    !== undefined) { fields.push('priority = ?');     values.push(u.priority); }
  if (u.sortOrder   !== undefined) { fields.push('sort_order = ?');   values.push(u.sortOrder); }
  if (u.columnId    !== undefined) { fields.push('column_id = ?');    values.push(u.columnId); }
  if (u.status      !== undefined) { fields.push('column_id = ?');    values.push(u.status); }
  if (u.tags        !== undefined) { fields.push('tags = ?');         values.push(JSON.stringify(u.tags)); }

  if (fields.length === 0) return res.status(400).json({ error: '没有要更新的字段' });
  values.push(taskId);

  pagesDb.run(`UPDATE pages SET ${fields.join(', ')} WHERE id = ? AND page_type = 'task'`, values, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: '任务不存在' });
    res.json({ success: true, id: taskId });
  });
});

router.delete('/kanban/tasks/:id', (req, res) => {
  const taskId = req.params.id;
  pagesDb.all(
    `WITH RECURSIVE tree AS (
       SELECT id FROM pages WHERE id = ?
       UNION ALL
       SELECT p.id FROM pages p INNER JOIN tree t ON p.parent_id = t.id
     ) SELECT id FROM tree`,
    [taskId],
    (err, rows) => {
      const subtreeIds = rows ? rows.map(r => r.id) : [taskId];
      pagesDb.run("DELETE FROM pages WHERE id = ? AND page_type = 'task'", [taskId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: '任务不存在' });
        subtreeIds.forEach(id => syncPageDelete(id));
        res.json({ success: true });
      });
    }
  );
});

router.post('/kanban/columns', (req, res) => {
  const col = req.body;
  const id = col.id || genId('col');
  pagesDb.get('SELECT MAX(position) as maxPos FROM kanban_columns', [], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    const position = (row?.maxPos ?? 0) + 1;
    pagesDb.run(
      'INSERT INTO kanban_columns (id, label, header_bg, card_bg, accent, position) VALUES (?, ?, ?, ?, ?, ?)',
      [id, col.label, col.headerBg, col.cardBg, col.accent, position],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ id, label: col.label, headerBg: col.headerBg, cardBg: col.cardBg, accent: col.accent, position });
      }
    );
  });
});

router.delete('/kanban/columns/:id', (req, res) => {
  pagesDb.run('DELETE FROM kanban_columns WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: '列不存在' });
    res.json({ success: true });
  });
});

module.exports = { init };
