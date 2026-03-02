const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3002;
const MEMORY_DB_PATH = path.join(__dirname, 'memory.db');
const TASKS_DB_PATH = path.join(__dirname, 'tasks.db');
const PAGES_DB_PATH = path.join(__dirname, 'pages.db');

app.use(cors());
app.use(bodyParser.json());

// 连接两个数据库
const memoryDb = new sqlite3.Database(MEMORY_DB_PATH, (err) => {
  if (err) {
    console.error('Memory 数据库连接失败:', err);
    process.exit(1);
  }
  console.log('✅ Memory 数据库已连接');
});

const tasksDb = new sqlite3.Database(TASKS_DB_PATH, (err) => {
  if (err) {
    console.error('Tasks 数据库连接失败:', err);
    // 如果tasks.db不存在，创建它
    console.log('尝试初始化 Tasks 数据库...');
    require('./init-tasks-db.js');
  } else {
    console.log('✅ Tasks 数据库已连接');
  }
});

// 连接 Pages 数据库
const pagesDb = new sqlite3.Database(PAGES_DB_PATH, (err) => {
  if (err) {
    console.error('Pages 数据库连接失败:', err);
    console.log('尝试初始化 Pages 数据库...');
    require('./init-pages-db.js');
  } else {
    console.log('✅ Pages 数据库已连接');
  }
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    databases: {
      memory: 'connected',
      tasks: 'connected',
      pages: 'connected'
    }
  });
});

// ========== Memory API (原有功能) ==========

// 获取会话列表
// 获取所有会话（不包含消息）- 只在需要时加载详细数据
app.get('/api/sessions', (req, res) => {
  memoryDb.all('SELECT * FROM sessions ORDER BY created_at DESC', (err, sessions) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ sessions: sessions });
  });
});

// 更新会话标题
app.put('/api/sessions/:id/title', (req, res) => {
  const { id } = req.params;
  const { title } = req.body;

  memoryDb.run('UPDATE sessions SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [title, id], function(err) {
    if (err) return res.status(500).json({ error: err.message });

    if (this.changes === 0) {
      return res.status(404).json({ error: '会话不存在' });
    }

    res.json({ success: true, id, title });
  });
});

// 获取会话详情（按user切分轮次）
app.get('/api/sessions/:id', (req, res) => {
  const sessionId = req.params.id;
  
  memoryDb.get('SELECT * FROM sessions WHERE id = ?', [sessionId], (err, session) => {
    if (err || !session) return res.status(404).json({ error: '会话不存在' });
    
    // 获取所有消息，按时间排序
    memoryDb.all('SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp', [sessionId], (err, messages) => {
      if (err) return res.status(500).json({ error: err.message });
      
      // 按user切分轮次
      const rounds = [];
      let currentRound = null;
      let roundNum = 0;
      
      for (const msg of messages) {
        if (msg.role === 'user') {
          // 新轮次开始
          if (currentRound) {
            rounds.push(currentRound);
          }
          roundNum++;
          currentRound = {
            id: msg.id,
            round_number: roundNum,
            user_message: msg,
            agent_messages: []
          };
        } else if (currentRound && msg.role === 'assistant') {
          // agent消息加入当前轮次
          currentRound.agent_messages.push(msg);
        }
      }
      
      // 最后一轮
      if (currentRound) {
        rounds.push(currentRound);
      }
      
      res.json({ ...session, rounds, messages });
    });
  });
});

// 保存标注
app.post('/api/messages/:id/annotation', (req, res) => {
  const { suggested_revision } = req.body;
  memoryDb.run(
    'INSERT INTO annotations (message_id, suggested_revision) VALUES (?, ?)',
    [req.params.id, suggested_revision],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: this.lastID });
    }
  );
});

// 获取消息的标注
app.get('/api/messages/:id/annotation', (req, res) => {
  memoryDb.get('SELECT * FROM annotations WHERE message_id = ?', [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ annotation: row });
  });
});

// 创建标签
app.post('/api/tags', (req, res) => {
  const { name } = req.body;
  memoryDb.run('INSERT OR IGNORE INTO categories (name) VALUES (?)', [name], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, name });
  });
});

// 获取所有标签
app.get('/api/tags', (req, res) => {
  memoryDb.all('SELECT * FROM categories ORDER BY name', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ tags: rows });
  });
});

// 为消息添加标签
app.post('/api/messages/:id/tags', (req, res) => {
  const { tag_names } = req.body;
  
  if (!tag_names || !tag_names.length) {
    return res.json({ success: true });
  }
  
  // 创建标签并关联
  let completed = 0;
  tag_names.forEach(name => {
    memoryDb.run('INSERT OR IGNORE INTO categories (name) VALUES (?)', [name], function(err) {
      memoryDb.get('SELECT id FROM categories WHERE name = ?', [name], (err, row) => {
        if (row) {
          memoryDb.run('INSERT OR IGNORE INTO message_categories (message_id, category_id) VALUES (?, ?)', 
            [req.params.id, row.id], () => {
              completed++;
              if (completed === tag_names.length) {
                res.json({ success: true });
              }
            });
        }
      });
    });
  });
});

// ========== Tasks API (新增功能) ==========

// 获取所有任务
app.get('/api/tasks', (req, res) => {
  tasksDb.all(`
    SELECT t.*, 
           COUNT(DISTINCT tp.id) as property_count,
           COUNT(DISTINCT tv.id) as version_count
    FROM tasks t
    LEFT JOIN task_properties tp ON t.id = tp.task_id
    LEFT JOIN task_versions tv ON t.id = tv.task_id
    GROUP BY t.id
    ORDER BY t.updated_at DESC
  `, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ tasks: rows });
  });
});

// 获取单个任务详情（包含属性和定义）
app.get('/api/tasks/:id', (req, res) => {
  const taskId = req.params.id;
  
  // 获取任务基本信息
  tasksDb.get('SELECT * FROM tasks WHERE id = ?', [taskId], (err, task) => {
    if (err || !task) return res.status(404).json({ error: '任务不存在' });
    
    // 获取属性定义
    tasksDb.all('SELECT * FROM task_property_defs WHERE task_id = ? ORDER BY display_order', [taskId], (err, propertyDefs) => {
      if (err) return res.status(500).json({ error: err.message });
      
      // 获取属性值
      tasksDb.all(`
        SELECT tp.*, tpd.name, tpd.type
        FROM task_properties tp
        JOIN task_property_defs tpd ON tp.property_def_id = tpd.id
        WHERE tp.task_id = ?
      `, [taskId], (err, properties) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // 转换属性值为合适的格式
        const propertyValues = {};
        properties.forEach(prop => {
          let value;
          switch (prop.type) {
            case 'text': value = prop.value_text; break;
            case 'number': value = prop.value_number; break;
            case 'date': value = prop.value_date; break;
            case 'checkbox': value = prop.value_boolean === 1; break;
            case 'select':
            case 'multi-select':
            case 'url': 
              value = prop.value_json ? JSON.parse(prop.value_json) : null;
              break;
            default: value = prop.value_text;
          }
          propertyValues[prop.name] = value;
        });
        
        res.json({
          ...task,
          propertyDefs,
          properties: propertyValues
        });
      });
    });
  });
});

// 创建新任务
app.post('/api/tasks', (req, res) => {
  const { name, icon = '📝', content = '', priority = 50 } = req.body;
  const id = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // 确保 content 包含必要的元数据
  let taskContent = content;
  if (!taskContent || taskContent === '') {
    taskContent = JSON.stringify({
      kanbanStatus: 'planned',
      kanbanPriority: priority,
      blocks: []
    });
  }

  tasksDb.run(
    'INSERT INTO tasks (id, name, icon, content, content_plain) VALUES (?, ?, ?, ?, ?)',
    [id, name, icon, taskContent, taskContent.replace(/<[^>]*>/g, '')],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({
        success: true,
        id,
        task: {
          id,
          name,
          icon,
          content: taskContent,
          content_plain: taskContent.replace(/<[^>]*>/g, ''),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          property_count: 0,
          version_count: 0
        }
      });
    }
  );
});

// 更新任务
app.put('/api/tasks/:id', (req, res) => {
  const taskId = req.params.id;
  const { name, icon, content } = req.body;
  
  const updates = [];
  const params = [];
  
  if (name !== undefined) {
    updates.push('name = ?');
    params.push(name);
  }
  if (icon !== undefined) {
    updates.push('icon = ?');
    params.push(icon);
  }
  if (content !== undefined) {
    updates.push('content = ?, content_plain = ?');
    params.push(content);
    params.push(content.replace(/<[^>]*>/g, ''));
  }
  
  if (updates.length === 0) {
    return res.status(400).json({ error: '没有要更新的字段' });
  }
  
  params.push(taskId);
  
  tasksDb.run(
    `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`,
    params,
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: '任务不存在' });
      res.json({ success: true, updated_at: new Date().toISOString() });
    }
  );
});

// 删除任务
app.delete('/api/tasks/:id', (req, res) => {
  const taskId = req.params.id;
  
  tasksDb.run('DELETE FROM tasks WHERE id = ?', [taskId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: '任务不存在' });
    res.json({ success: true });
  });
});

// 添加属性定义
app.post('/api/tasks/:id/properties/definitions', (req, res) => {
  const taskId = req.params.id;
  const { name, type, options } = req.body;
  const defId = `prop-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  
  tasksDb.run(
    'INSERT INTO task_property_defs (id, task_id, name, type, options, display_order) VALUES (?, ?, ?, ?, ?, ?)',
    [defId, taskId, name, type, options ? JSON.stringify(options) : null, 0],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      // 为所有任务实例创建默认属性值
      const defaultValue = getDefaultValue(type);
      let valueSql, valueParams;
      
      switch (type) {
        case 'text':
        case 'url':
          valueSql = 'INSERT INTO task_properties (task_id, property_def_id, value_text) VALUES (?, ?, ?)';
          valueParams = [taskId, defId, defaultValue];
          break;
        case 'number':
          valueSql = 'INSERT INTO task_properties (task_id, property_def_id, value_number) VALUES (?, ?, ?)';
          valueParams = [taskId, defId, defaultValue];
          break;
        case 'date':
          valueSql = 'INSERT INTO task_properties (task_id, property_def_id, value_date) VALUES (?, ?, ?)';
          valueParams = [taskId, defId, defaultValue];
          break;
        case 'checkbox':
          valueSql = 'INSERT INTO task_properties (task_id, property_def_id, value_boolean) VALUES (?, ?, ?)';
          valueParams = [taskId, defId, defaultValue ? 1 : 0];
          break;
        case 'select':
        case 'multi-select':
          valueSql = 'INSERT INTO task_properties (task_id, property_def_id, value_json) VALUES (?, ?, ?)';
          valueParams = [taskId, defId, JSON.stringify(defaultValue)];
          break;
      }
      
      tasksDb.run(valueSql, valueParams, (err) => {
        if (err) {
          console.error('创建默认属性值失败:', err);
          // 继续返回属性定义创建成功
        }
        res.json({ success: true, id: defId });
      });
    }
  );
});

// 更新属性值
app.put('/api/tasks/:id/properties/:propertyName', (req, res) => {
  const taskId = req.params.id;
  const propertyName = req.params.propertyName;
  const { value } = req.body;
  
  // 首先获取属性定义
  tasksDb.get('SELECT id, type FROM task_property_defs WHERE task_id = ? AND name = ?', [taskId, propertyName], (err, def) => {
    if (err || !def) return res.status(404).json({ error: '属性定义不存在' });
    
    // 更新属性值
    let sql, params;
    switch (def.type) {
      case 'text':
      case 'url':
        sql = 'UPDATE task_properties SET value_text = ? WHERE task_id = ? AND property_def_id = ?';
        params = [value, taskId, def.id];
        break;
      case 'number':
        sql = 'UPDATE task_properties SET value_number = ? WHERE task_id = ? AND property_def_id = ?';
        params = [value, taskId, def.id];
        break;
      case 'date':
        sql = 'UPDATE task_properties SET value_date = ? WHERE task_id = ? AND property_def_id = ?';
        params = [value, taskId, def.id];
        break;
      case 'checkbox':
        sql = 'UPDATE task_properties SET value_boolean = ? WHERE task_id = ? AND property_def_id = ?';
        params = [value ? 1 : 0, taskId, def.id];
        break;
      case 'select':
      case 'multi-select':
        sql = 'UPDATE task_properties SET value_json = ? WHERE task_id = ? AND property_def_id = ?';
        params = [JSON.stringify(value), taskId, def.id];
        break;
      default:
        return res.status(400).json({ error: '不支持的属性类型' });
    }
    
    tasksDb.run(sql, params, function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) {
        // 如果不存在，创建属性值
        let insertSql, insertParams;
        switch (def.type) {
          case 'text':
          case 'url':
            insertSql = 'INSERT INTO task_properties (task_id, property_def_id, value_text) VALUES (?, ?, ?)';
            insertParams = [taskId, def.id, value];
            break;
          case 'number':
            insertSql = 'INSERT INTO task_properties (task_id, property_def_id, value_number) VALUES (?, ?, ?)';
            insertParams = [taskId, def.id, value];
            break;
          case 'date':
            insertSql = 'INSERT INTO task_properties (task_id, property_def_id, value_date) VALUES (?, ?, ?)';
            insertParams = [taskId, def.id, value];
            break;
          case 'checkbox':
            insertSql = 'INSERT INTO task_properties (task_id, property_def_id, value_boolean) VALUES (?, ?, ?)';
            insertParams = [taskId, def.id, value ? 1 : 0];
            break;
          case 'select':
          case 'multi-select':
            insertSql = 'INSERT INTO task_properties (task_id, property_def_id, value_json) VALUES (?, ?, ?)';
            insertParams = [taskId, def.id, JSON.stringify(value)];
            break;
        }
        
        tasksDb.run(insertSql, insertParams, (err) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ success: true });
        });
      } else {
        res.json({ success: true });
      }
    });
  });
});

// 保存任务版本（链式存储）
app.post('/api/tasks/:id/versions', (req, res) => {
  const taskId = req.params.id;
  const { content, previousHash } = req.body;
  
  // 计算内容哈希
  const crypto = require('crypto');
  const contentHash = crypto.createHash('sha256').update(content).digest('hex');
  
  tasksDb.run(
    'INSERT INTO task_versions (task_id, content_hash, content, previous_version_hash) VALUES (?, ?, ?, ?)',
    [taskId, contentHash, content, previousHash || null],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, hash: contentHash, id: this.lastID });
    }
  );
});

// 获取任务版本历史
app.get('/api/tasks/:id/versions', (req, res) => {
  const taskId = req.params.id;
  
  tasksDb.all(
    'SELECT * FROM task_versions WHERE task_id = ? ORDER BY created_at DESC',
    [taskId],
    (err, versions) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ versions });
    }
  );
});

// 工具函数：获取默认值
function getDefaultValue(type) {
  switch (type) {
    case 'text': return '';
    case 'number': return 0;
    case 'select': return '';
    case 'multi-select': return [];
    case 'date': return null;
    case 'checkbox': return false;
    case 'url': return '';
    default: return '';
  }
}

// ========== Notion Blocks API (兼容旧版) ==========

// 获取页面的所有块
app.get('/api/notion/pages/:pageId/blocks', (req, res) => {
  const pageId = req.params.pageId;

  tasksDb.all('SELECT * FROM blocks WHERE page_id = ? ORDER BY position', [pageId], (err, blocks) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ blocks });
  });
});

// 获取块的子块
app.get('/api/notion/blocks/:blockId/children', (req, res) => {
  const blockId = req.params.blockId;

  tasksDb.all('SELECT * FROM blocks WHERE parent_id = ? ORDER BY position', [blockId], (err, blocks) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ blocks });
  });
});

// 创建新块
app.post('/api/notion/blocks', (req, res) => {
  const { pageId, parentId, type, content, position } = req.body;
  const id = `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  tasksDb.run(
    'INSERT INTO blocks (id, page_id, parent_id, type, content, position) VALUES (?, ?, ?, ?, ?, ?)',
    [id, pageId, parentId || null, type || 'paragraph', content || '{}', position || 1.0],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id });
    }
  );
});

// 更新块
app.put('/api/notion/blocks/:id', (req, res) => {
  const blockId = req.params.id;
  const { type, content, position } = req.body;

  const updates = [];
  const params = [];

  if (type !== undefined) {
    updates.push('type = ?');
    params.push(type);
  }
  if (content !== undefined) {
    updates.push('content = ?');
    params.push(content);
  }
  if (position !== undefined) {
    updates.push('position = ?');
    params.push(position);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: '没有要更新的字段' });
  }

  params.push(blockId);

  tasksDb.run(
    `UPDATE blocks SET ${updates.join(', ')} WHERE id = ?`,
    params,
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: '块不存在' });
      res.json({ success: true });
    }
  );
});

// 删除块（级联删除所有子块）
app.delete('/api/notion/blocks/:id', (req, res) => {
  const blockId = req.params.id;

  // 递归删除所有子块
  const deleteBlockRecursive = (id, callback) => {
    tasksDb.all('SELECT id FROM blocks WHERE parent_id = ?', [id], (err, children) => {
      if (err) return callback(err);

      let completed = 0;
      const total = children.length;

      if (total === 0) {
        // 没有子块，直接删除当前块
        tasksDb.run('DELETE FROM blocks WHERE id = ?', [id], callback);
      } else {
        // 先删除子块
        children.forEach(child => {
          deleteBlockRecursive(child.id, (err) => {
            if (err) return callback(err);

            completed++;
            if (completed === total) {
              // 所有子块删除完成，删除当前块
              tasksDb.run('DELETE FROM blocks WHERE id = ?', [id], callback);
            }
          });
        });
      }
    });
  };

  deleteBlockRecursive(blockId, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// 块操作接口（用于批量操作和复杂操作）
app.post('/api/notion/blocks/operations', (req, res) => {
  const { operations } = req.body;

  if (!operations || !Array.isArray(operations)) {
    return res.status(400).json({ error: '无效的操作格式' });
  }

  // 开始事务处理多个操作
  tasksDb.run('BEGIN TRANSACTION', (err) => {
    if (err) return res.status(500).json({ error: err.message });

    let completed = 0;
    const total = operations.length;
    const errors = [];

    operations.forEach(op => {
      switch (op.type) {
        case 'create':
          const id = `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          tasksDb.run(
            'INSERT INTO blocks (id, page_id, parent_id, type, content, position) VALUES (?, ?, ?, ?, ?, ?)',
            [id, op.pageId, op.parentId || null, op.blockType || 'paragraph', op.content || '{}', op.position || 1.0],
            function(err) {
              if (err) errors.push(err.message);
              completed++;
              checkCompletion();
            }
          );
          break;

        case 'update':
          const updates = [];
          const params = [];

          if (op.blockType !== undefined) {
            updates.push('type = ?');
            params.push(op.blockType);
          }
          if (op.content !== undefined) {
            updates.push('content = ?');
            params.push(op.content);
          }
          if (op.position !== undefined) {
            updates.push('position = ?');
            params.push(op.position);
          }

          if (updates.length > 0) {
            params.push(op.blockId);
            tasksDb.run(
              `UPDATE blocks SET ${updates.join(', ')} WHERE id = ?`,
              params,
              function(err) {
                if (err) errors.push(err.message);
                completed++;
                checkCompletion();
              }
            );
          } else {
            completed++;
            checkCompletion();
          }
          break;

        case 'delete':
          const deleteBlockRecursive = (id, cb) => {
            tasksDb.all('SELECT id FROM blocks WHERE parent_id = ?', [id], (err, children) => {
              if (err) return cb(err);

              let childCompleted = 0;
              const childTotal = children.length;

              if (childTotal === 0) {
                tasksDb.run('DELETE FROM blocks WHERE id = ?', [id], cb);
              } else {
                children.forEach(child => {
                  deleteBlockRecursive(child.id, (err) => {
                    if (err) return cb(err);

                    childCompleted++;
                    if (childCompleted === childTotal) {
                      tasksDb.run('DELETE FROM blocks WHERE id = ?', [id], cb);
                    }
                  });
                });
              }
            });
          };

          deleteBlockRecursive(op.blockId, (err) => {
            if (err) errors.push(err.message);
            completed++;
            checkCompletion();
          });
          break;

        default:
          completed++;
          checkCompletion();
      }
    });

    const checkCompletion = () => {
      if (completed === total) {
        if (errors.length > 0) {
          tasksDb.run('ROLLBACK', () => {
            res.status(500).json({ error: errors.join(', ') });
          });
        } else {
          tasksDb.run('COMMIT', () => {
            res.json({ success: true });
          });
        }
      }
    };
  });
});

// ========== Pages API (符合 types.ts 和 apiClient.ts 规范) ==========

// 获取所有页面（树形结构铺平）
// GET /api/pages?type=xxx&refId=xxx → PageMeta[]
app.get('/api/pages', (req, res) => {
  const { type, refId } = req.query;

  let sql = 'SELECT id, parent_id as parentId, page_type as pageType, ref_id as refId, title, icon, position, created_at as createdAt, updated_at as updatedAt FROM pages WHERE 1=1';
  const params = [];

  if (type) {
    sql += ' AND page_type = ?';
    params.push(type);
  }
  if (refId) {
    sql += ' AND ref_id = ?';
    params.push(refId);
  }

  sql += ' ORDER BY position';

  pagesDb.all(sql, params, (err, pages) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(pages);
  });
});

// 创建页面
// POST /api/pages → PageMeta  body: CreatePageInput
app.post('/api/pages', (req, res) => {
  const { parentId, title = '未命名页面', icon = '📄', position = 1.0, fromBlockId, pageType = 'page', refId } = req.body;
  const id = `page-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  pagesDb.run(
    'INSERT INTO pages (id, parent_id, page_type, ref_id, title, icon, position) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, parentId || null, pageType, refId || null, title, icon, position],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });

      res.status(201).json({
        id,
        parentId: parentId || null,
        pageType,
        refId: refId || null,
        title,
        icon,
        position,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
  );
});

// 更新页面元信息
// PATCH /api/pages/:id → PageMeta  body: Partial<PageMeta>
app.patch('/api/pages/:id', (req, res) => {
  const pageId = req.params.id;
  const { title, icon } = req.body;

  const updates = [];
  const params = [];

  if (title !== undefined) {
    updates.push('title = ?');
    params.push(title);
  }
  if (icon !== undefined) {
    updates.push('icon = ?');
    params.push(icon);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: '没有要更新的字段' });
  }

  params.push(pageId);

  pagesDb.run(
    `UPDATE pages SET ${updates.join(', ')} WHERE id = ?`,
    params,
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: '页面不存在' });

      // 返回更新后的页面
      pagesDb.get(
        'SELECT id, parent_id as parentId, page_type as pageType, ref_id as refId, title, icon, position, created_at as createdAt, updated_at as updatedAt FROM pages WHERE id = ?',
        [pageId],
        (err, page) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json(page);
        }
      );
    }
  );
});

// 删除页面（级联删除子页面）
// DELETE /api/pages/:id → { ok: true }
app.delete('/api/pages/:id', (req, res) => {
  const pageId = req.params.id;

  // 递归删除所有子页面
  const deletePageRecursive = (id, callback) => {
    pagesDb.all('SELECT id FROM pages WHERE parent_id = ?', [id], (err, children) => {
      if (err) return callback(err);

      let completed = 0;
      const total = children.length;

      if (total === 0) {
        // 没有子页面，直接删除当前页面
        pagesDb.run('DELETE FROM pages WHERE id = ?', [id], callback);
      } else {
        // 先删除子页面
        children.forEach(child => {
          deletePageRecursive(child.id, (err) => {
            if (err) return callback(err);

            completed++;
            if (completed === total) {
              // 所有子页面删除完成，删除当前页面
              pagesDb.run('DELETE FROM pages WHERE id = ?', [id], callback);
            }
          });
        });
      }
    });
  };

  deletePageRecursive(pageId, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true });
  });
});

// 移动页面
// POST /api/pages/:id/move → PageMeta  body: MovePageInput
app.post('/api/pages/:id/move', (req, res) => {
  const pageId = req.params.id;
  const { newParentId, newPosition } = req.body;

  pagesDb.run(
    'UPDATE pages SET parent_id = ?, position = ? WHERE id = ?',
    [newParentId || null, newPosition, pageId],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: '页面不存在' });

      // 返回更新后的页面
      pagesDb.get(
        'SELECT id, parent_id as parentId, page_type as pageType, ref_id as refId, title, icon, position, created_at as createdAt, updated_at as updatedAt FROM pages WHERE id = ?',
        [pageId],
        (err, page) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json(page);
        }
      );
    }
  );
});

// ========== Page Blocks API (符合 apiClient.ts 规范) ==========

// 获取页面的所有块
// GET /api/pages/:id/blocks → Block[]
app.get('/api/pages/:id/blocks', (req, res) => {
  const pageId = req.params.id;

  pagesDb.all(
    'SELECT id, parent_id as parentId, type, content, position, metadata, collapsed, created_at as createdAt, updated_at as updatedAt FROM blocks WHERE page_id = ? ORDER BY position',
    [pageId],
    (err, blocks) => {
      if (err) return res.status(500).json({ error: err.message });

      // 解析 content 和 metadata JSON
      const parsedBlocks = blocks.map(block => ({
        ...block,
        content: JSON.parse(block.content || '{}'),
        metadata: JSON.parse(block.metadata || '{}')
      }));

      res.json(parsedBlocks);
    }
  );
});

// 全量覆盖保存块列表
// PUT /api/pages/:id/blocks → Block[]  body: Block[]
app.put('/api/pages/:id/blocks', (req, res) => {
  const pageId = req.params.id;
  const blocks = req.body;

  if (!Array.isArray(blocks)) {
    return res.status(400).json({ error: 'blocks 必须是数组' });
  }

  // 开始事务
  pagesDb.run('BEGIN TRANSACTION', (err) => {
    if (err) return res.status(500).json({ error: err.message });

    // 1. 删除该页面所有现有块
    pagesDb.run('DELETE FROM blocks WHERE page_id = ?', [pageId], (err) => {
      if (err) {
        pagesDb.run('ROLLBACK');
        return res.status(500).json({ error: err.message });
      }

      // 2. 插入新块
      let completed = 0;
      const total = blocks.length;

      if (total === 0) {
        // 没有块需要插入，直接提交
        pagesDb.run('COMMIT', (err) => {
          if (err) {
            pagesDb.run('ROLLBACK');
            return res.status(500).json({ error: err.message });
          }
          res.json([]);
        });
        return;
      }

      blocks.forEach((block) => {
        const blockId = block.id || `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const content = typeof block.content === 'string' ? block.content : JSON.stringify(block.content || {});
        const metadata = typeof block.metadata === 'string' ? block.metadata : JSON.stringify(block.metadata || {});

        pagesDb.run(
          'INSERT INTO blocks (id, page_id, parent_id, type, content, position, metadata, collapsed) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [
            blockId,
            pageId,
            block.parentId || null,
            block.type || 'paragraph',
            content,
            block.position || 1.0,
            metadata,
            block.collapsed || false
          ],
          (err) => {
            if (err) {
              pagesDb.run('ROLLBACK');
              return res.status(500).json({ error: err.message });
            }

            completed++;
            if (completed === total) {
              // 所有块插入完成，提交事务
              pagesDb.run('COMMIT', (err) => {
                if (err) {
                  pagesDb.run('ROLLBACK');
                  return res.status(500).json({ error: err.message });
                }

                // 返回保存后的块
                pagesDb.all(
                  'SELECT id, parent_id as parentId, type, content, position, metadata, collapsed, created_at as createdAt, updated_at as updatedAt FROM blocks WHERE page_id = ? ORDER BY position',
                  [pageId],
                  (err, savedBlocks) => {
                    if (err) return res.status(500).json({ error: err.message });

                    const parsedBlocks = savedBlocks.map(block => ({
                      ...block,
                      content: JSON.parse(block.content || '{}'),
                      metadata: JSON.parse(block.metadata || '{}')
                    }));

                    res.json(parsedBlocks);
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

// ========== Kanban API ==========

// 获取看板列和任务
// GET /api/kanban → { columns: Column[], tasks: Task[] }
app.get('/api/kanban', (req, res) => {
  // 1. 获取所有列
  pagesDb.all(
    'SELECT id, label, header_bg as headerBg, card_bg as cardBg, accent, position FROM kanban_columns ORDER BY position',
    [],
    (err, columns) => {
      if (err) return res.status(500).json({ error: err.message });

      // 2. 获取所有任务
      pagesDb.all(
        `SELECT id, column_id as columnId, name, icon, assignee, start_date as startDate, due_date as dueDate,
                project, project_icon as projectIcon, status, priority, sort_order as sortOrder, tags
         FROM kanban_tasks ORDER BY sort_order DESC`,
        [],
        (err, tasks) => {
          if (err) return res.status(500).json({ error: err.message });

          // 解析 tags JSON
          const parsedTasks = tasks.map(task => ({
            ...task,
            tags: task.tags ? JSON.parse(task.tags) : [],
            created_at: task.startDate || new Date().toISOString(),
            updated_at: task.startDate || new Date().toISOString()
          }));

          res.json({ columns, tasks: parsedTasks });
        }
      );
    }
  );
});

// 保存看板列（全量覆盖）
// PUT /api/kanban/columns → Column[]
app.put('/api/kanban/columns', (req, res) => {
  const columns = req.body;
  if (!Array.isArray(columns)) {
    return res.status(400).json({ error: 'columns 必须是数组' });
  }

  pagesDb.run('BEGIN TRANSACTION', (err) => {
    if (err) return res.status(500).json({ error: err.message });

    // 删除现有列
    pagesDb.run('DELETE FROM kanban_columns', [], (err) => {
      if (err) {
        pagesDb.run('ROLLBACK');
        return res.status(500).json({ error: err.message });
      }

      if (columns.length === 0) {
        pagesDb.run('COMMIT');
        return res.json([]);
      }

      let completed = 0;
      columns.forEach((col, index) => {
        pagesDb.run(
          'INSERT INTO kanban_columns (id, label, header_bg, card_bg, accent, position) VALUES (?, ?, ?, ?, ?, ?)',
          [col.id, col.label, col.headerBg, col.cardBg, col.accent, index],
          (err) => {
            if (err) {
              pagesDb.run('ROLLBACK');
              return res.status(500).json({ error: err.message });
            }

            completed++;
            if (completed === columns.length) {
              pagesDb.run('COMMIT', (err) => {
                if (err) {
                  pagesDb.run('ROLLBACK');
                  return res.status(500).json({ error: err.message });
                }
                res.json(columns);
              });
            }
          }
        );
      });
    });
  });
});

// 保存看板任务（全量覆盖）
// PUT /api/kanban/tasks → Task[]
app.put('/api/kanban/tasks', (req, res) => {
  const tasks = req.body;
  if (!Array.isArray(tasks)) {
    return res.status(400).json({ error: 'tasks 必须是数组' });
  }

  pagesDb.run('BEGIN TRANSACTION', (err) => {
    if (err) return res.status(500).json({ error: err.message });

    // 删除现有任务
    pagesDb.run('DELETE FROM kanban_tasks', [], (err) => {
      if (err) {
        pagesDb.run('ROLLBACK');
        return res.status(500).json({ error: err.message });
      }

      if (tasks.length === 0) {
        pagesDb.run('COMMIT');
        return res.json([]);
      }

      let completed = 0;
      let hasError = false;
      tasks.forEach((task) => {
        pagesDb.run(
          `INSERT INTO kanban_tasks
           (id, column_id, name, icon, assignee, start_date, due_date, project, project_icon, status, priority, sort_order, tags)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            task.id || `t-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
            task.columnId || 'uncategorized',
            task.name || '未命名任务',
            task.icon || '📝',
            task.assignee || null,
            task.startDate || null,
            task.dueDate || null,
            task.project || null,
            task.projectIcon || null,
            task.status || 'uncategorized',
            task.priority || 'medium',
            task.sortOrder || 0,
            task.tags ? JSON.stringify(task.tags) : null
          ],
          (err) => {
            if (hasError) return; // 已经出错，忽略后续结果
            if (err) {
              hasError = true;
              pagesDb.run('ROLLBACK');
              return res.status(500).json({ error: err.message });
            }

            completed++;
            if (completed === tasks.length) {
              pagesDb.run('COMMIT', (err) => {
                if (hasError) return; // 已经出错
                if (err) {
                  hasError = true;
                  pagesDb.run('ROLLBACK');
                  return res.status(500).json({ error: err.message });
                }
                res.json(tasks);
              });
            }
          }
        );
      });
    });
  });
});

// 创建任务
// POST /api/kanban/tasks → Task
app.post('/api/kanban/tasks', (req, res) => {
  const task = req.body;
  const id = task.id || `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  pagesDb.run(
    `INSERT INTO kanban_tasks
     (id, column_id, name, icon, assignee, start_date, due_date, project, project_icon, status, priority, sort_order, tags)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      task.columnId || 'uncategorized',
      task.name || '未命名任务',
      task.icon || '📝',
      task.assignee || null,
      task.startDate || null,
      task.dueDate || null,
      task.project || null,
      task.projectIcon || null,
      task.status || 'uncategorized',
      task.priority || 'medium',
      task.sortOrder || 0,
      task.tags ? JSON.stringify(task.tags) : null
    ],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });

      res.status(201).json({
        ...task,
        id,
        name: task.name || '未命名任务',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
  );
});

// 更新任务
// PATCH /api/kanban/tasks/:id → Task
app.patch('/api/kanban/tasks/:id', (req, res) => {
  const taskId = req.params.id;
  const updates = req.body;

  const fields = [];
  const values = [];

  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.icon !== undefined) { fields.push('icon = ?'); values.push(updates.icon); }
  if (updates.assignee !== undefined) { fields.push('assignee = ?'); values.push(updates.assignee); }
  if (updates.startDate !== undefined) { fields.push('start_date = ?'); values.push(updates.startDate); }
  if (updates.dueDate !== undefined) { fields.push('due_date = ?'); values.push(updates.dueDate); }
  if (updates.project !== undefined) { fields.push('project = ?'); values.push(updates.project); }
  if (updates.projectIcon !== undefined) { fields.push('project_icon = ?'); values.push(updates.projectIcon); }
  if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
  if (updates.priority !== undefined) { fields.push('priority = ?'); values.push(updates.priority); }
  if (updates.sortOrder !== undefined) { fields.push('sort_order = ?'); values.push(updates.sortOrder); }
  if (updates.columnId !== undefined) { fields.push('column_id = ?'); values.push(updates.columnId); }
  if (updates.tags !== undefined) { fields.push('tags = ?'); values.push(JSON.stringify(updates.tags)); }

  if (fields.length === 0) {
    return res.status(400).json({ error: '没有要更新的字段' });
  }

  values.push(taskId);

  pagesDb.run(
    `UPDATE kanban_tasks SET ${fields.join(', ')} WHERE id = ?`,
    values,
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: '任务不存在' });

      res.json({ success: true, id: taskId });
    }
  );
});

// 删除任务
// DELETE /api/kanban/tasks/:id
app.delete('/api/kanban/tasks/:id', (req, res) => {
  const taskId = req.params.id;

  pagesDb.run('DELETE FROM kanban_tasks WHERE id = ?', [taskId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: '任务不存在' });

    res.json({ success: true });
  });
});

// 创建列
// POST /api/kanban/columns → Column
app.post('/api/kanban/columns', (req, res) => {
  const col = req.body;
  const id = col.id || `col-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  pagesDb.get('SELECT MAX(position) as maxPos FROM kanban_columns', [], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });

    const position = (row?.maxPos || 0) + 1;

    pagesDb.run(
      'INSERT INTO kanban_columns (id, label, header_bg, card_bg, accent, position) VALUES (?, ?, ?, ?, ?, ?)',
      [id, col.label, col.headerBg, col.cardBg, col.accent, position],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });

        res.status(201).json({
          id,
          label: col.label,
          headerBg: col.headerBg,
          cardBg: col.cardBg,
          accent: col.accent,
          position
        });
      }
    );
  });
});

// 删除列（会级联删除该列下的任务）
// DELETE /api/kanban/columns/:id
app.delete('/api/kanban/columns/:id', (req, res) => {
  const colId = req.params.id;

  pagesDb.run('DELETE FROM kanban_columns WHERE id = ?', [colId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: '列不存在' });

    res.json({ success: true });
  });
});

app.listen(PORT, () => {
  console.log(`🚀 后端运行在 http://localhost:${PORT}`);
  console.log(`📊 数据库: memory.db + tasks.db + pages.db`);
});
