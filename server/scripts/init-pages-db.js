/**
 * scripts/init-pages-db.js
 * 初始化统一 Pages 数据库（v2 schema）
 * 运行: cd server && npm run init-pages
 */
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_PATH     = path.join(__dirname, '..', 'data', 'pages.db');
const SCHEMA_PATH = path.join(__dirname, 'pages_schema_v2.sql');

console.log('🔄 初始化统一 Pages 数据库 (v2)...');

if (fs.existsSync(DB_PATH)) {
  fs.unlinkSync(DB_PATH);
  console.log('🗑️  已删除旧 pages.db');
}

// 同时删除 WAL 相关文件
[DB_PATH + '-shm', DB_PATH + '-wal'].forEach(f => {
  if (fs.existsSync(f)) fs.unlinkSync(f);
});

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) { console.error('❌ 数据库连接失败:', err); process.exit(1); }
  console.log('✅ 已创建 pages.db');
});

const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');

db.serialize(() => {
  db.run('PRAGMA journal_mode=WAL');
  db.run('PRAGMA foreign_keys=ON');

  db.exec(schema, (err) => {
    if (err) { console.error('❌ Schema 执行失败:', err); process.exit(1); }

    db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", (err, tables) => {
      if (!err) {
        console.log('📊 已创建的表:');
        tables.forEach((t, i) => console.log(`  ${i + 1}. ${t.name}`));
      }
      console.log('🎉 pages.db 初始化完成 (v2 统一 schema)');
      console.log(`📁 路径: ${DB_PATH}`);
      db.close(() => process.exit(0));
    });
  });
});

process.on('uncaughtException', (err) => {
  console.error('❌ 未捕获异常:', err);
  process.exit(1);
});
