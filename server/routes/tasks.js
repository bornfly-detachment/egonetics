/**
 * routes/tasks.js
 * /api/tasks  — Task CRUD + 属性 + 版本
 * /api/kanban — 看板视图（共享 tasks.db）
 */

const express = require('express');
const crypto = require('crypto');
const router = express.Router();

let tasksDb;
let pagesDb;

function init(db, pDb) {
  tasksDb = db;
  pagesDb = pDb;

  // Migrate: add chronicle columns if missing (safe to run every startup)
  const noop = (err) => { if (err && !err.message.includes('duplicate column')) console.error('[tasks init]', err.message); };
  tasksDb.run('ALTER TABLE tasks ADD COLUMN chronicle_entry_id TEXT', noop);
  tasksDb.run('ALTER TABLE tasks ADD COLUMN task_outcome TEXT', noop);
  tasksDb.run('ALTER TABLE tasks ADD COLUMN task_summary TEXT', noop);

  return router;
}

// ── 工具函数 ───────────────────────────────────────────────

function rowToKanbanTask(row) {
  return {
    id:          row.id,
    columnId:    row.column_id,
    status:      row.column_id,
    name:        row.name,
    icon:        row.icon,
    priority:    row.priority,
    sortOrder:   row.sort_order,
    assignee:    row.assignee     || null,
    startDate:   row.start_date   || null,
    dueDate:     row.due_date     || null,
    project:     row.project      || null,
    projectIcon: row.project_icon || null,
    tags:        row.tags ? JSON.parse(row.tags) : [],
    created_at:  row.created_at,
    updated_at:  row.updated_at
  };
}

function getDefaultValue(type) {
  switch (type) {
    case 'text':         return '';
    case 'number':       return 0;
    case 'select':       return '';
    case 'multi-select': return [];
    case 'date':         return null;
    case 'checkbox':     return false;
    case 'url':          return '';
    default:             return '';
  }
}

function genId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ── /api/tasks ─────────────────────────────────────────────

router.get('/tasks', (req, res) => {
  tasksDb.all(`
    SELECT t.*,
           COUNT(DISTINCT tp.id) AS property_count,
           COUNT(DISTINCT tv.id) AS version_count
    FROM tasks t
    LEFT JOIN task_properties tp ON t.id = tp.task_id
    LEFT JOIN task_versions   tv ON t.id = tv.task_id
    GROUP BY t.id
    ORDER BY t.updated_at DESC
  `, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const tasks = rows.map(r => ({ ...r, tags: r.tags ? JSON.parse(r.tags) : [] }));
    res.json({ tasks });
  });
});

router.get('/tasks/:id', (req, res) => {
  const taskId = req.params.id;
  tasksDb.get('SELECT * FROM tasks WHERE id = ?', [taskId], (err, task) => {
    if (err || !task) return res.status(404).json({ error: '任务不存在' });

    tasksDb.all('SELECT * FROM task_property_defs WHERE task_id = ? ORDER BY display_order', [taskId], (err, propertyDefs) => {
      if (err) return res.status(500).json({ error: err.message });

      tasksDb.all(`
        SELECT tp.*, tpd.name, tpd.type
        FROM task_properties tp
        JOIN task_property_defs tpd ON tp.property_def_id = tpd.id
        WHERE tp.task_id = ?
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
            case 'url':          value = prop.value_json ? JSON.parse(prop.value_json) : null; break;
            default:             value = prop.value_text;
          }
          propertyValues[prop.name] = value;
        });

        res.json({ ...task, tags: task.tags ? JSON.parse(task.tags) : [], propertyDefs, properties: propertyValues });
      });
    });
  });
});

router.post('/tasks', (req, res) => {
  const {
    name, icon = '📋', content = '',
    column_id = 'planned', sort_order = 0, priority = 'medium',
    assignee = null, start_date = null, due_date = null,
    tags = [], project = null, project_icon = null
  } = req.body;
  const id = genId('task');
  const content_plain = content.replace(/<[^>]*>/g, '');
  const tagsJson = JSON.stringify(Array.isArray(tags) ? tags : []);

  tasksDb.run(
    `INSERT INTO tasks
       (id, name, icon, content, content_plain, column_id, sort_order, priority,
        assignee, start_date, due_date, tags, project, project_icon)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, name, icon, content, content_plain, column_id, sort_order, priority,
     assignee, start_date, due_date, tagsJson, project, project_icon],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({
        success: true, id,
        task: { id, name, icon, content, content_plain, column_id, sort_order, priority,
                assignee, start_date, due_date, tags, project, project_icon,
                created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
                property_count: 0, version_count: 0 }
      });
    }
  );
});

router.put('/tasks/:id', (req, res) => {
  const taskId = req.params.id;
  const { name, icon, content, column_id, sort_order, priority,
          assignee, start_date, due_date, tags, project, project_icon,
          task_outcome, task_summary, chronicle_entry_id } = req.body;

  const updates = [], params = [];

  if (name             !== undefined) { updates.push('name = ?');              params.push(name); }
  if (icon             !== undefined) { updates.push('icon = ?');              params.push(icon); }
  if (content          !== undefined) {
    updates.push('content = ?, content_plain = ?');
    params.push(content, content.replace(/<[^>]*>/g, ''));
  }
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

  updates.push('updated_at = datetime(\'now\')');
  params.push(taskId);
  tasksDb.run(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`, params, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: '任务不存在' });
    res.json({ success: true, updated_at: new Date().toISOString() });
  });
});

router.delete('/tasks/:id', (req, res) => {
  const taskId = req.params.id;
  tasksDb.run('DELETE FROM tasks WHERE id = ?', [taskId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: '任务不存在' });
    // 级联删除 pages.db 中关联的页面和块
    const db = pagesDb;
    if (db) {
      db.all(
        `WITH RECURSIVE tree AS (
           SELECT id FROM pages WHERE ref_id = ?
           UNION ALL
           SELECT p.id FROM pages p INNER JOIN tree t ON p.parent_id = t.id
         ) SELECT id FROM tree`,
        [taskId],
        (err2, rows) => {
          if (err2 || !rows?.length) return;
          const ids = rows.map(r => r.id);
          const placeholders = ids.map(() => '?').join(',');
          db.run(`DELETE FROM blocks WHERE page_id IN (${placeholders})`, ids);
          db.run(`DELETE FROM pages  WHERE id      IN (${placeholders})`, ids);
        }
      );
    }
    res.json({ success: true });
  });
});

// Task 入库 Chronicle
router.post('/tasks/:id/send-to-chronicle', (req, res) => {
  const taskId = req.params.id;
  const { task_outcome, task_summary } = req.body;

  if (!task_outcome) return res.status(400).json({ error: 'task_outcome 必填' });

  const entryId = genId('ce');
  tasksDb.get('SELECT * FROM tasks WHERE id = ?', [taskId], (err, task) => {
    if (err || !task) return res.status(404).json({ error: '任务不存在' });
    if (task.chronicle_entry_id) return res.status(409).json({ error: '该任务已入库 Chronicle' });

    tasksDb.run(
      'UPDATE tasks SET task_outcome = ?, task_summary = ?, chronicle_entry_id = ?, updated_at = datetime(\'now\') WHERE id = ?',
      [task_outcome, task_summary || null, entryId, taskId],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, chronicle_entry_id: entryId, task_outcome, task_summary });
      }
    );
  });
});

// 属性定义
router.post('/tasks/:id/properties/definitions', (req, res) => {
  const taskId = req.params.id;
  const { name, type, options } = req.body;
  const defId = genId('prop');

  tasksDb.run(
    'INSERT INTO task_property_defs (id, task_id, name, type, options, display_order) VALUES (?, ?, ?, ?, ?, ?)',
    [defId, taskId, name, type, options ? JSON.stringify(options) : null, 0],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });

      const defaultValue = getDefaultValue(type);
      let valueSql, valueParams;

      switch (type) {
        case 'text': case 'url':
          valueSql = 'INSERT INTO task_properties (task_id, property_def_id, value_text) VALUES (?, ?, ?)';
          valueParams = [taskId, defId, defaultValue]; break;
        case 'number':
          valueSql = 'INSERT INTO task_properties (task_id, property_def_id, value_number) VALUES (?, ?, ?)';
          valueParams = [taskId, defId, defaultValue]; break;
        case 'date':
          valueSql = 'INSERT INTO task_properties (task_id, property_def_id, value_date) VALUES (?, ?, ?)';
          valueParams = [taskId, defId, defaultValue]; break;
        case 'checkbox':
          valueSql = 'INSERT INTO task_properties (task_id, property_def_id, value_boolean) VALUES (?, ?, ?)';
          valueParams = [taskId, defId, defaultValue ? 1 : 0]; break;
        case 'select': case 'multi-select':
          valueSql = 'INSERT INTO task_properties (task_id, property_def_id, value_json) VALUES (?, ?, ?)';
          valueParams = [taskId, defId, JSON.stringify(defaultValue)]; break;
        default:
          return res.json({ success: true, id: defId });
      }

      tasksDb.run(valueSql, valueParams, () => res.json({ success: true, id: defId }));
    }
  );
});

// 属性值更新
router.put('/tasks/:id/properties/:propertyName', (req, res) => {
  const { id: taskId, propertyName } = req.params;
  const { value } = req.body;

  tasksDb.get('SELECT id, type FROM task_property_defs WHERE task_id = ? AND name = ?', [taskId, propertyName], (err, def) => {
    if (err || !def) return res.status(404).json({ error: '属性定义不存在' });

    const colMap = { text: 'value_text', url: 'value_text', number: 'value_number',
                     date: 'value_date', checkbox: 'value_boolean', select: 'value_json', 'multi-select': 'value_json' };
    const col = colMap[def.type];
    if (!col) return res.status(400).json({ error: '不支持的属性类型' });

    const dbVal = def.type === 'checkbox' ? (value ? 1 : 0)
                : (def.type === 'select' || def.type === 'multi-select') ? JSON.stringify(value)
                : value;

    tasksDb.run(`UPDATE task_properties SET ${col} = ? WHERE task_id = ? AND property_def_id = ?`,
      [dbVal, taskId, def.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) {
          tasksDb.run(`INSERT INTO task_properties (task_id, property_def_id, ${col}) VALUES (?, ?, ?)`,
            [taskId, def.id, dbVal], (err) => {
              if (err) return res.status(500).json({ error: err.message });
              res.json({ success: true });
            });
        } else {
          res.json({ success: true });
        }
      });
  });
});

// 版本历史
router.post('/tasks/:id/versions', (req, res) => {
  const { content, previousHash } = req.body;
  const contentHash = crypto.createHash('sha256').update(content).digest('hex');

  tasksDb.run(
    'INSERT INTO task_versions (task_id, content_hash, content, previous_version_hash) VALUES (?, ?, ?, ?)',
    [req.params.id, contentHash, content, previousHash || null],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, hash: contentHash, id: this.lastID });
    }
  );
});

router.get('/tasks/:id/versions', (req, res) => {
  tasksDb.all('SELECT * FROM task_versions WHERE task_id = ? ORDER BY created_at DESC', [req.params.id], (err, versions) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ versions });
  });
});

// ── /api/kanban ────────────────────────────────────────────

router.get('/kanban', (req, res) => {
  tasksDb.all(
    'SELECT id, label, header_bg as headerBg, card_bg as cardBg, accent, position FROM kanban_columns ORDER BY position',
    [], (err, columns) => {
      if (err) return res.status(500).json({ error: err.message });
      tasksDb.all('SELECT * FROM tasks WHERE chronicle_entry_id IS NULL ORDER BY sort_order DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ columns, tasks: rows.map(rowToKanbanTask) });
      });
    }
  );
});

router.get('/kanban/tasks/:id', (req, res) => {
  tasksDb.get('SELECT * FROM tasks WHERE id = ?', [req.params.id], (err, row) => {
    if (err || !row) return res.status(404).json({ error: '任务不存在' });
    res.json(rowToKanbanTask(row));
  });
});

router.put('/kanban/columns', (req, res) => {
  const columns = req.body;
  if (!Array.isArray(columns)) return res.status(400).json({ error: 'columns 必须是数组' });

  tasksDb.run('BEGIN TRANSACTION', (err) => {
    if (err) return res.status(500).json({ error: err.message });
    tasksDb.run('DELETE FROM kanban_columns', [], (err) => {
      if (err) { tasksDb.run('ROLLBACK'); return res.status(500).json({ error: err.message }); }
      if (columns.length === 0) { return tasksDb.run('COMMIT', () => res.json([])); }

      let done = 0, failed = false;
      columns.forEach((col, i) => {
        tasksDb.run(
          'INSERT INTO kanban_columns (id, label, header_bg, card_bg, accent, position) VALUES (?, ?, ?, ?, ?, ?)',
          [col.id, col.label, col.headerBg, col.cardBg, col.accent, i],
          (err) => {
            if (failed) return;
            if (err) { failed = true; tasksDb.run('ROLLBACK'); return res.status(500).json({ error: err.message }); }
            if (++done === columns.length) tasksDb.run('COMMIT', () => res.json(columns));
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

  tasksDb.run('BEGIN TRANSACTION', (err) => {
    if (err) return res.status(500).json({ error: err.message });

    let done = 0, failed = false;
    tasks.forEach((task) => {
      const id = task.id || genId('t');
      tasksDb.run(
        `INSERT INTO tasks (id, name, icon, column_id, sort_order, priority, assignee, start_date, due_date, project, project_icon, tags)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name, icon = excluded.icon,
           column_id = excluded.column_id, sort_order = excluded.sort_order,
           priority = excluded.priority, assignee = excluded.assignee,
           start_date = excluded.start_date, due_date = excluded.due_date,
           project = excluded.project, project_icon = excluded.project_icon,
           tags = excluded.tags, updated_at = datetime('now')`,
        [id, task.name || 'Untitled', task.icon || '📋',
         task.columnId || task.status || 'planned', task.sortOrder ?? 0, task.priority || 'medium',
         task.assignee || null, task.startDate || null, task.dueDate || null,
         task.project || null, task.projectIcon || null,
         task.tags ? JSON.stringify(task.tags) : '[]'],
        (err) => {
          if (failed) return;
          if (err) { failed = true; tasksDb.run('ROLLBACK'); return res.status(500).json({ error: err.message }); }
          if (++done === tasks.length) tasksDb.run('COMMIT', () => res.json(tasks));
        }
      );
    });
  });
});

router.post('/kanban/tasks', (req, res) => {
  const task = req.body;
  const id = task.id || genId('t');

  tasksDb.run(
    `INSERT INTO tasks (id, name, icon, column_id, sort_order, priority, assignee, start_date, due_date, project, project_icon, tags)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, task.name || 'Untitled', task.icon || '📋',
     task.columnId || task.status || 'planned', task.sortOrder ?? 0, task.priority || 'medium',
     task.assignee || null, task.startDate || null, task.dueDate || null,
     task.project || null, task.projectIcon || null,
     task.tags ? JSON.stringify(task.tags) : '[]'],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      tasksDb.get('SELECT * FROM tasks WHERE id = ?', [id], (err, row) => {
        if (err || !row) return res.status(500).json({ error: '任务创建后查询失败' });
        res.status(201).json(rowToKanbanTask(row));
      });
    }
  );
});

router.patch('/kanban/tasks/:id', (req, res) => {
  const taskId = req.params.id;
  const u = req.body;
  const fields = [], values = [];

  if (u.name        !== undefined) { fields.push('name = ?');         values.push(u.name); }
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
  tasksDb.run(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`, values, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: '任务不存在' });
    res.json({ success: true, id: taskId });
  });
});

router.delete('/kanban/tasks/:id', (req, res) => {
  const taskId = req.params.id;
  tasksDb.run('DELETE FROM tasks WHERE id = ?', [taskId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: '任务不存在' });
    // 级联删除 pages.db 中关联的页面和块
    const db = pagesDb;
    if (db) {
      db.all(
        `WITH RECURSIVE tree AS (
           SELECT id FROM pages WHERE ref_id = ?
           UNION ALL
           SELECT p.id FROM pages p INNER JOIN tree t ON p.parent_id = t.id
         ) SELECT id FROM tree`,
        [taskId],
        (err2, rows) => {
          if (err2 || !rows?.length) return;
          const ids = rows.map(r => r.id);
          const placeholders = ids.map(() => '?').join(',');
          db.run(`DELETE FROM blocks WHERE page_id IN (${placeholders})`, ids);
          db.run(`DELETE FROM pages  WHERE id      IN (${placeholders})`, ids);
        }
      );
    }
    res.json({ success: true });
  });
});

router.post('/kanban/columns', (req, res) => {
  const col = req.body;
  const id = col.id || genId('col');

  tasksDb.get('SELECT MAX(position) as maxPos FROM kanban_columns', [], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    const position = (row?.maxPos ?? 0) + 1;

    tasksDb.run(
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
  tasksDb.run('DELETE FROM kanban_columns WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: '列不存在' });
    res.json({ success: true });
  });
});

// ── Task Blocks (body editor) ───────────────────────────────

function tryParse(s) {
  try { return JSON.parse(s); } catch { return s || {}; }
}

// GET /api/tasks/:id/blocks — load all blocks for a task
router.get('/tasks/:id/blocks', (req, res) => {
  tasksDb.all('SELECT * FROM blocks WHERE page_id = ? ORDER BY position', [req.params.id], (err, rows) => {
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

// PUT /api/tasks/:id/blocks — full replace (mirrors PUT /api/pages/:id/blocks)
router.put('/tasks/:id/blocks', (req, res) => {
  const blocks = req.body;
  if (!Array.isArray(blocks)) return res.status(400).json({ error: 'body must be array' });
  const pageId = req.params.id;

  tasksDb.serialize(() => {
    tasksDb.run('BEGIN TRANSACTION');
    tasksDb.run('DELETE FROM blocks WHERE page_id = ?', [pageId], (err) => {
      if (err) { tasksDb.run('ROLLBACK'); return res.status(500).json({ error: err.message }); }

      if (blocks.length === 0) {
        return tasksDb.run('COMMIT', (e) => {
          if (e) return res.status(500).json({ error: e.message });
          res.json([]);
        });
      }

      let done = 0;
      let failed = false;
      blocks.forEach((b, i) => {
        const content = typeof b.content === 'string' ? b.content : JSON.stringify(b.content || {});
        const metadata = typeof b.metadata === 'string' ? b.metadata : JSON.stringify(b.metadata || {});
        const position = b.position ?? (i + 1);
        tasksDb.run(
          'INSERT INTO blocks (id, page_id, parent_id, type, content, metadata, collapsed, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [b.id, pageId, b.parentId || null, b.type, content, metadata, b.collapsed ? 1 : 0, position],
          (err2) => {
            if (failed) return;
            if (err2) {
              failed = true;
              tasksDb.run('ROLLBACK');
              return res.status(500).json({ error: err2.message });
            }
            if (++done === blocks.length) {
              tasksDb.run('COMMIT', (e) => {
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

module.exports = { init };
