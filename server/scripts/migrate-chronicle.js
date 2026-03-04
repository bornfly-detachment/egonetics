/**
 * migrate-chronicle.js
 * 为 memory.db 的 chronicle 相关表追加新列 + 新建 collection_links 表
 * 使用方式：node server/scripts/migrate-chronicle.js  （需先启动 server 目录为工作目录）
 * 可反复运行（幂等）
 */

const path   = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, '..', 'data', 'memory.db');
const db = new sqlite3.Database(DB_PATH);

const migrations = [
  `ALTER TABLE chronicle_collections ADD COLUMN color TEXT DEFAULT '#6366f1'`,
  `ALTER TABLE chronicle_collections ADD COLUMN content TEXT`,
  `ALTER TABLE chronicle_collections ADD COLUMN parent_id TEXT`,
  `ALTER TABLE chronicle_annotations ADD COLUMN milestone_version TEXT`,
  `CREATE TABLE IF NOT EXISTS chronicle_collection_links (
    id         TEXT PRIMARY KEY,
    from_id    TEXT NOT NULL,
    to_id      TEXT NOT NULL,
    label      TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,
];

let i = 0;
function next() {
  if (i >= migrations.length) { db.close(); console.log('\nMigration complete.'); return; }
  const sql = migrations[i++];
  db.run(sql, (err) => {
    if (err && err.message.includes('duplicate column name')) {
      console.log('SKIP (already exists):', sql.trim().slice(0, 60));
    } else if (err) {
      console.error('FAIL:', err.message);
    } else {
      console.log('OK:', sql.trim().slice(0, 60));
    }
    next();
  });
}
next();
