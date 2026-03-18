/**
 * migrate-relation-blocks.js
 * 创建 relation_blocks 表（若不存在）
 */

const path    = require('path')
const sqlite3 = require('sqlite3').verbose()

const DB_PATH = path.join(__dirname, '../data/pages.db')
const db = new sqlite3.Database(DB_PATH)

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS relation_blocks (
      id                TEXT PRIMARY KEY,
      relation_id       TEXT NOT NULL REFERENCES relations(id) ON DELETE CASCADE,
      parent_id         TEXT REFERENCES relation_blocks(id) ON DELETE CASCADE,
      type              TEXT NOT NULL DEFAULT 'paragraph',
      content           TEXT NOT NULL DEFAULT '{}',
      position          REAL NOT NULL DEFAULT 1.0,
      metadata          TEXT NOT NULL DEFAULT '{}',
      collapsed         INTEGER NOT NULL DEFAULT 0,
      title             TEXT NOT NULL DEFAULT '',
      creator           TEXT NOT NULL DEFAULT '',
      edit_start_time   TEXT,
      draft_explanation TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `, err => {
    if (err) console.error('❌ relation_blocks 表:', err.message)
    else     console.log('✅ relation_blocks 表已就绪')
  })

  db.run(`CREATE INDEX IF NOT EXISTS idx_rel_blocks_relation ON relation_blocks(relation_id)`, err => {
    if (err && !err.message.includes('already exists')) console.error('❌ index:', err.message)
  })
  db.run(`CREATE INDEX IF NOT EXISTS idx_rel_blocks_parent ON relation_blocks(parent_id)`, () => {})
  db.run(`CREATE INDEX IF NOT EXISTS idx_rel_blocks_position ON relation_blocks(position)`, () => {})
})

setTimeout(() => { db.close(); console.log('Migration 完成') }, 500)
