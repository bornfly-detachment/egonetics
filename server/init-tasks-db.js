const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'tasks.db');
const SCHEMA_PATH = path.join(__dirname, 'tasks_schema.sql');

console.log('🔄 初始化 Tasks 数据库...');

// 删除现有数据库文件（如果存在）
if (fs.existsSync(DB_PATH)) {
  fs.unlinkSync(DB_PATH);
  console.log('🗑️  删除旧的 tasks.db 文件');
}

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ 数据库连接失败:', err);
    process.exit(1);
  }
  console.log('✅ 已创建新的 tasks.db 数据库');
});

// 读取并执行schema
fs.readFile(SCHEMA_PATH, 'utf8', (err, schema) => {
  if (err) {
    console.error('❌ 无法读取schema文件:', err);
    process.exit(1);
  }

  console.log('📋 执行数据库schema...');
  
  // 逐条执行SQL语句
  const statements = schema
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  let completed = 0;
  
  statements.forEach((sql, index) => {
    db.run(sql, (err) => {
      if (err) {
        console.error(`❌ 执行SQL语句失败 (语句 ${index + 1}):`, err);
        console.error('问题SQL:', sql.substring(0, 200) + '...');
        process.exit(1);
      }
      
      completed++;
      
      if (completed === statements.length) {
        console.log(`✅ 所有 ${statements.length} 条SQL语句执行完成`);
        
        // 验证表创建
        db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
          if (err) {
            console.error('❌ 无法验证表创建:', err);
          } else {
            console.log('📊 创建的数据库表:');
            tables.forEach((table, i) => {
              console.log(`  ${i + 1}. ${table.name}`);
            });
          }
          
          // 插入示例数据
          console.log('📝 插入示例数据...');
          db.get("SELECT COUNT(*) as count FROM tasks", (err, row) => {
            if (err) {
              console.error('❌ 无法查询tasks表:', err);
            } else if (row.count === 0) {
              console.log('📋 示例数据已包含在schema中');
            }
            
            console.log('🎉 Tasks 数据库初始化完成!');
            console.log(`📁 数据库文件: ${DB_PATH}`);
            
            db.close();
            process.exit(0);
          });
        });
      }
    });
  });
});

// 错误处理
process.on('uncaughtException', (err) => {
  console.error('❌ 未捕获异常:', err);
  process.exit(1);
});
