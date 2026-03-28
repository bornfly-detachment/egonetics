/**
 * migrate-task-controller-fields.js
 * 为 pages 表添加 v_criteria + assigned_node（幂等）
 */
const path   = require('path')
const sqlite = require('sqlite3').verbose()

const DB_PATH = path.join(__dirname, '../data/pages.db')
const db = new sqlite.Database(DB_PATH, err => {
  if (err) { console.error('❌ 无法打开 pages.db:', err.message); process.exit(1) }
})

db.serialize(() => {
  db.run(
    "ALTER TABLE pages ADD COLUMN v_criteria TEXT",
    err => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('❌ v_criteria:', err.message)
      } else {
        console.log('✅ v_criteria 列就绪')
      }
    }
  )
  db.run(
    "ALTER TABLE pages ADD COLUMN assigned_node TEXT",
    err => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('❌ assigned_node:', err.message)
      } else {
        console.log('✅ assigned_node 列就绪')
      }
      db.close()
    }
  )
})
