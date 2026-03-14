/**
 * migrate-blocks-v4.js
 * 新增：canvases, canvas_nodes, relation_blocks 三张表
 *       relations 扩展 properties 字段
 */

const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database(
  path.join(__dirname, '../data/pages.db'),
  (err) => {
    if (err) { console.error('❌ pages.db 连接失败:', err.message); process.exit(1); }
    console.log('✅ pages.db 已连接');
  }
);

db.serialize(() => {
  db.run('PRAGMA foreign_keys=ON');

  // 1. relations 扩展 properties
  db.run(
    `ALTER TABLE relations ADD COLUMN properties TEXT NOT NULL DEFAULT '{}'`,
    (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('❌ ALTER relations.properties:', err.message);
      } else {
        console.log('✅ relations.properties 已添加');
      }
    }
  );

  // 2. relation_blocks — Relation 富文本块（结构与 blocks 表一致）
  db.run(`
    CREATE TABLE IF NOT EXISTS relation_blocks (
      id                TEXT    PRIMARY KEY,
      relation_id       TEXT    NOT NULL REFERENCES relations(id) ON DELETE CASCADE,
      parent_id         TEXT,
      type              TEXT    NOT NULL DEFAULT 'paragraph',
      content           TEXT    NOT NULL DEFAULT '{}',
      position          REAL    NOT NULL DEFAULT 1.0,
      metadata          TEXT    NOT NULL DEFAULT '{}',
      collapsed         INTEGER NOT NULL DEFAULT 0,
      title             TEXT    NOT NULL DEFAULT '',
      creator           TEXT    NOT NULL DEFAULT '',
      edit_start_time   TEXT,
      draft_explanation TEXT    NOT NULL DEFAULT '',
      created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error('❌ CREATE relation_blocks:', err.message);
    else console.log('✅ relation_blocks 已创建');
  });

  // 3. canvases — 画布主表
  db.run(`
    CREATE TABLE IF NOT EXISTS canvases (
      id          TEXT    PRIMARY KEY,
      title       TEXT    NOT NULL DEFAULT '新画布',
      description TEXT    NOT NULL DEFAULT '',
      creator     TEXT    NOT NULL DEFAULT '',
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error('❌ CREATE canvases:', err.message);
    else console.log('✅ canvases 已创建');
  });

  // 4. canvas_nodes — 画布上的实体节点（位置 + 展开级别）
  db.run(`
    CREATE TABLE IF NOT EXISTS canvas_nodes (
      id             TEXT    PRIMARY KEY,
      canvas_id      TEXT    NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
      entity_type    TEXT    NOT NULL,
      entity_id      TEXT    NOT NULL,
      x              REAL    NOT NULL DEFAULT 100,
      y              REAL    NOT NULL DEFAULT 100,
      expanded_level INTEGER NOT NULL DEFAULT 0,
      created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(canvas_id, entity_type, entity_id)
    )
  `, (err) => {
    if (err) console.error('❌ CREATE canvas_nodes:', err.message);
    else console.log('✅ canvas_nodes 已创建');
    db.close(() => console.log('✅ 迁移完成'));
  });
});
