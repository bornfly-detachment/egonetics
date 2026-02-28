const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// 数据库文件路径
const DB_PATH = path.join(__dirname, 'memory.db');

// 检查数据库是否已存在
const dbExists = fs.existsSync(DB_PATH);

// 创建数据库连接
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ 连接数据库失败:', err.message);
    process.exit(1);
  }
  console.log('✅ 已连接到 SQLite 数据库');
});

// 读取schema.sql文件
const schemaPath = path.join(__dirname, 'schema.sql');
const schemaSql = fs.readFileSync(schemaPath, 'utf8');

console.log('📋 正在初始化数据库...');

// 执行schema.sql中的SQL语句
// 需要按分号分割语句，但要注意分号可能出现在字符串中
// 这里使用简单的方法：按分号分割，忽略空语句
const statements = schemaSql.split(';').filter(stmt => stmt.trim().length > 0);

// 顺序执行所有语句
let completed = 0;
const total = statements.length;

statements.forEach((stmt, index) => {
  db.run(stmt, function(err) {
    if (err) {
      console.error(`❌ 执行语句 ${index + 1} 失败:`, err.message);
      console.error('问题语句:', stmt.substring(0, 200) + '...');
      process.exit(1);
    }
    completed++;
    
    if (completed === total) {
      console.log(`✅ 数据库初始化完成 (${total} 条语句)`);
      
      // 验证分类数据是否正确插入
      db.all('SELECT level, name, parent_id FROM categories ORDER BY level, id', (err, rows) => {
        if (err) {
          console.error('❌ 查询分类数据失败:', err.message);
          db.close();
          process.exit(1);
        }
        
        console.log('📊 分类数据验证:');
        const level1 = rows.filter(r => r.level === 1);
        const level2 = rows.filter(r => r.level === 2);
        const level3 = rows.filter(r => r.level === 3);
        
        console.log(`   一级分类: ${level1.length} 个`);
        level1.forEach(cat => console.log(`     - ${cat.name}`));
        
        console.log(`   二级分类: ${level2.length} 个`);
        level2.forEach(cat => console.log(`     - ${cat.name} (父级: ${cat.parent_id})`));
        
        console.log(`   三级标签: ${level3.length} 个 (用户自定义)`);
        
        // 测试数据插入（可选）
        console.log('\n🧪 插入测试数据...');
        const testSessionId = 'test-session-' + Date.now();
        const testMessageId = 'test-msg-' + Date.now();
        
        db.run(
          `INSERT OR IGNORE INTO sessions (id, created_at, updated_at, title, summary, source_file) VALUES (?, ?, ?, ?, ?, ?)`,
          [testSessionId, new Date().toISOString(), new Date().toISOString(), '测试会话', '这是一个测试会话', '/test/path.jsonl'],
          function(err) {
            if (err) {
              console.error('❌ 插入测试会话失败:', err.message);
            } else {
              console.log('   ✅ 测试会话插入成功');
            }
            
            db.run(
              `INSERT OR IGNORE INTO messages (id, session_id, message_type, content, timestamp, quality_score, role) VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [testMessageId, testSessionId, 'message', '这是一个测试消息', new Date().toISOString(), 3, 'user'],
              function(err) {
                if (err) {
                  console.error('❌ 插入测试消息失败:', err.message);
                } else {
                  console.log('   ✅ 测试消息插入成功');
                }
                
                // 关闭数据库连接
                db.close((err) => {
                  if (err) {
                    console.error('❌ 关闭数据库连接失败:', err.message);
                  } else {
                    console.log('🔒 数据库连接已关闭');
                  }
                  console.log(`\n🎉 数据库初始化完成！数据库文件: ${DB_PATH}`);
                  console.log(`📊 文件大小: ${fs.existsSync(DB_PATH) ? (fs.statSync(DB_PATH).size / 1024).toFixed(2) + ' KB' : '不存在'}`);
                });
              }
            );
          }
        );
      });
    }
  });
});