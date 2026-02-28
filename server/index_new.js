const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 创建Express应用
const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 数据库连接
const DB_PATH = path.join(__dirname, 'memory.db');
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ 连接数据库失败:', err.message);
    process.exit(1);
  }
  console.log('✅ 已连接到 SQLite 数据库:', DB_PATH);
});

// 健康检查端点
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'egonetics-memory-api',
    version: '0.1.0'
  });
});

// 获取所有会话
app.get('/api/sessions', (req, res) => {
  const { limit = 50, offset = 0 } = req.query;
  
  db.all(
    `SELECT * FROM sessions ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [parseInt(limit), parseInt(offset)],
    (err, rows) => {
      if (err) {
        console.error('❌ 查询会话失败:', err.message);
        res.status(500).json({ error: err.message });
        return;
      }
      
      // 获取每个会话的消息数量
      if (rows.length === 0) {
        res.json({ sessions: [], total: 0 });
        return;
      }
      
      const sessionIds = rows.map(s => s.id);
      const placeholders = sessionIds.map(() => '?').join(',');
      
      db.all(
        `SELECT session_id, COUNT(*) as message_count FROM messages 
         WHERE session_id IN (${placeholders}) GROUP BY session_id`,
        sessionIds,
        (err, counts) => {
          if (err) {
            console.error('❌ 查询消息数量失败:', err.message);
            res.status(500).json({ error: err.message });
            return;
          }
          
          const countMap = {};
          counts.forEach(c => {
            countMap[c.session_id] = c.message_count;
          });
          
          const sessionsWithCounts = rows.map(session => ({
            ...session,
            message_count: countMap[session.id] || 0
          }));
          
          // 获取总数量
          db.get('SELECT COUNT(*) as total FROM sessions', (err, result) => {
            if (err) {
              res.json({ sessions: sessionsWithCounts, total: rows.length });
            } else {
              res.json({ sessions: sessionsWithCounts, total: result.total });
            }
          });
        }
      );
    }
  );
});

// 获取单个会话详情
app.get('/api/sessions/:id', (req, res) => {
  const sessionId = req.params.id;
  
  // 获取会话基本信息
  db.get('SELECT * FROM sessions WHERE id = ?', [sessionId], (err, session) => {
    if (err) {
      console.error('❌ 查询会话详情失败:', err.message);
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!session) {
      res.status(404).json({ error: '会话不存在' });
      return;
    }
    
    // 获取会话的消息
    db.all(
      `SELECT m.*, 
              GROUP_CONCAT(DISTINCT c1.name) as level1_categories,
              GROUP_CONCAT(DISTINCT c2.name) as level2_categories,
              GROUP_CONCAT(DISTINCT c3.name) as level3_tags
       FROM messages m
       LEFT JOIN message_categories mc ON m.id = mc.message_id
       LEFT JOIN categories c1 ON mc.category_id = c1.id AND c1.level = 1
       LEFT JOIN categories c2 ON mc.category_id = c2.id AND c2.level = 2
       LEFT JOIN categories c3 ON mc.category_id = c3.id AND c3.level = 3
       WHERE m.session_id = ?
       GROUP BY m.id
       ORDER BY m.timestamp ASC`,
      [sessionId],
      (err, messages) => {
        if (err) {
          console.error('❌ 查询会话消息失败:', err.message);
          res.status(500).json({ error: err.message });
          return;
        }
        
        res.json({
          ...session,
          messages: messages.map(msg => ({
            ...msg,
            level1_categories: msg.level1_categories ? msg.level1_categories.split(',') : [],
            level2_categories: msg.level2_categories ? msg.level2_categories.split(',') : [],
            level3_tags: msg.level3_tags ? msg.level3_tags.split(',') : []
          }))
        });
      }
    );
  });
});

// 获取消息
app.get('/api/messages', (req, res) => {
  const { 
    session_id, 
    message_type, 
    limit = 100, 
    offset = 0,
    quality_min = 0
  } = req.query;
  
  let query = 'SELECT * FROM messages WHERE 1=1';
  const params = [];
  
  if (session_id) {
    query += ' AND session_id = ?';
    params.push(session_id);
  }
  
  if (message_type) {
    query += ' AND message_type = ?';
    params.push(message_type);
  }
  
  if (quality_min) {
    query += ' AND quality_score >= ?';
    params.push(parseInt(quality_min));
  }
  
  query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));
  
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('❌ 查询消息失败:', err.message);
      res.status(500).json({ error: err.message });
      return;
    }
    
    res.json({ messages: rows });
  });
});

// 获取分类系统
app.get('/api/categories', (req, res) => {
  const { level, parent_id } = req.query;
  
  let query = 'SELECT * FROM categories WHERE 1=1';
  const params = [];
  
  if (level) {
    query += ' AND level = ?';
    params.push(parseInt(level));
  }
  
  if (parent_id) {
    query += ' AND parent_id = ?';
    params.push(parseInt(parent_id));
  }
  
  query += ' ORDER BY level, name';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('❌ 查询分类失败:', err.message);
      res.status(500).json({ error: err.message });
      return;
    }
    
    // 构建层级结构
    const categories = rows.map(cat => ({
      ...cat,
      is_predefined: cat.is_predefined === 1
    }));
    
    res.json({ categories });
  });
});

// 为消息添加分类
app.post('/api/messages/:id/categories', (req, res) => {
  const messageId = req.params.id;
  const { category_ids } = req.body;
  
  if (!Array.isArray(category_ids) || category_ids.length === 0) {
    res.status(400).json({ error: '需要提供分类ID数组' });
    return;
  }
  
  // 验证消息存在
  db.get('SELECT id FROM messages WHERE id = ?', [messageId], (err, message) => {
    if (err) {
      console.error('❌ 验证消息失败:', err.message);
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!message) {
      res.status(404).json({ error: '消息不存在' });
      return;
    }
    
    // 开始事务
    db.run('BEGIN TRANSACTION');
    
    // 先删除现有的分类关联
    db.run('DELETE FROM message_categories WHERE message_id = ?', [messageId], (err) => {
      if (err) {
        db.run('ROLLBACK');
        console.error('❌ 删除现有分类失败:', err.message);
        res.status(500).json({ error: err.message });
        return;
      }
      
      // 插入新的分类关联
      let completed = 0;
      let hasError = false;
      
      if (category_ids.length === 0) {
        db.run('COMMIT', (err) => {
          if (err) {
            console.error('❌ 提交事务失败:', err.message);
            res.status(500).json({ error: err.message });
          } else {
            res.json({ 
              success: true, 
              message: '已更新消息分类',
              category_ids: [] 
            });
          }
        });
        return;
      }
      
      category_ids.forEach(categoryId => {
        db.run(
          'INSERT OR IGNORE INTO message_categories (message_id, category_id) VALUES (?, ?)',
          [messageId, categoryId],
          function(err) {
            if (err && !hasError) {
              hasError = true;
              db.run('ROLLBACK');
              console.error('❌ 插入分类关联失败:', err.message);
              res.status(500).json({ error: err.message });
              return;
            }
            
            completed++;
            if (completed === category_ids.length && !hasError) {
              db.run('COMMIT', (err) => {
                if (err) {
                  console.error('❌ 提交事务失败:', err.message);
                  res.status(500).json({ error: err.message });
                } else {
                  res.json({ 
                    success: true, 
                    message: '已更新消息分类',
                    category_ids 
                  });
                }
              });
            }
          }
        );
      });
    });
  });
});

// 更新消息质量评分
app.patch('/api/messages/:id/rating', (req, res) => {
  const messageId = req.params.id;
  const { quality_score } = req.body;
  
  if (quality_score === undefined || quality_score < 0 || quality_score > 5) {
    res.status(400).json({ error: '质量评分必须是0-5之间的整数' });
    return;
  }
  
  db.run(
    'UPDATE messages SET quality_score = ? WHERE id = ?',
    [parseInt(quality_score), messageId],
    function(err) {
      if (err) {
        console.error('❌ 更新评分失败:', err.message);
        res.status(500).json({ error: err.message });
        return;
      }
      
      if (this.changes === 0) {
        res.status(404).json({ error: '消息不存在' });
        return;
      }
      
      res.json({ 
        success: true, 
        message: '评分已更新',
        quality_score: parseInt(quality_score)
      });
    }
  );
});

// 统计数据
app.get('/api/stats', (req, res) => {
