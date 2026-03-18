/**
 * migrate-canvas-nodes.js
 * 为旧库的 canvas_nodes 表补齐三个字段：
 *   expanded_level, collapsed, tree_expanded
 * 已存在的列会被跳过（PRAGMA table_info 检测）
 */

const path   = require('path')
const sqlite3 = require('sqlite3').verbose()

const DB_PATH = path.join(__dirname, '../data/pages.db')
const db = new sqlite3.Database(DB_PATH)

const migrations = [
  { col: 'expanded_level', sql: 'ALTER TABLE canvas_nodes ADD COLUMN expanded_level INTEGER NOT NULL DEFAULT 0' },
  { col: 'collapsed',      sql: 'ALTER TABLE canvas_nodes ADD COLUMN collapsed      INTEGER NOT NULL DEFAULT 0' },
  { col: 'tree_expanded',  sql: 'ALTER TABLE canvas_nodes ADD COLUMN tree_expanded  INTEGER NOT NULL DEFAULT 0' },
]

db.all('PRAGMA table_info(canvas_nodes)', (err, cols) => {
  if (err) { console.error(err); process.exit(1) }
  const existing = new Set(cols.map(c => c.name))

  let pending = migrations.filter(m => !existing.has(m.col))
  if (pending.length === 0) {
    console.log('✓ 所有列已存在，无需迁移')
    db.close()
    return
  }

  let done = 0
  for (const { col, sql } of pending) {
    db.run(sql, err2 => {
      if (err2) console.error(`❌ ${col}:`, err2.message)
      else      console.log(`✅ 已添加列 ${col}`)
      if (++done === pending.length) {
        db.close()
        console.log('Migration 完成')
      }
    })
  }
})
