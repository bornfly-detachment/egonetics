const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3002;
const MEMORY_DB_PATH = path.join(__dirname, 'memory.db');
const TASKS_DB_PATH = path.join(__dirname, 'tasks.db');

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

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    databases: {
      memory: 'connected',
      tasks: 'connected'
    }
  });
});

// ========== Memory API (原有功能) ==========

// 获取会话列表
app.get('/api/sessions', (req, res) => {
  memoryDb.all('SELECT * FROM sessions ORDER BY created_at DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ sessions: rows });
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
  const { name, icon = '📝', content = '' } = req.body;
  const id = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  tasksDb.run(
    'INSERT INTO tasks (id, name, icon, content, content_plain) VALUES (?, ?, ?, ?, ?)',
    [id, name, icon, content, content.replace(/<[^>]*>/g, '')],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ 
        success: true, 
        id,
        task: { 
          id, 
          name, 
          icon, 
          content, 
          content_plain: content.replace(/<[^>]*>/g, ''), 
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

app.listen(PORT, () => {
  console.log(`🚀 后端运行在 http://localhost:${PORT}`);
  console.log(`📊 数据库: memory.db + tasks.db`);
});
