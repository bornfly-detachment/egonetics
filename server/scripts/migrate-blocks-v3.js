/**
 * migrate-blocks-v3.js
 * 为 blocks 表添加 draft_explanation 列（发布草稿持久化）
 */
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, '../data/pages.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) { console.error('无法打开 pages.db:', err.message); process.exit(1); }
});

db.run("ALTER TABLE blocks ADD COLUMN draft_explanation TEXT NOT NULL DEFAULT ''", (err) => {
  if (err && err.message.includes('duplicate column name')) {
    console.log('✓ draft_explanation 列已存在，跳过');
  } else if (err) {
    console.error('迁移失败:', err.message);
    process.exit(1);
  } else {
    console.log('✓ blocks 表新增 draft_explanation 列');
  }
  db.close(() => console.log('✓ 迁移完成'));
});
