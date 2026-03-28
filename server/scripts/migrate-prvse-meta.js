/**
 * migrate-prvse-meta.js
 * PRVSE 三问元数据迁移：为 pages 表添加 from_config / what_config
 *
 * from_config: { trigger_type, input_signal, deps: [] }
 * what_config: { description, prvse_layer, v_dims: [] }
 */
const path    = require('path')
const sqlite3 = require('sqlite3').verbose()

const DB_PATH = path.join(__dirname, '../data/pages.db')
const db = new sqlite3.Database(DB_PATH)

db.serialize(() => {
  db.run(`ALTER TABLE pages ADD COLUMN from_config TEXT DEFAULT '{}'`, err => {
    if (err && !err.message.includes('duplicate')) console.error('from_config:', err.message)
    else console.log('  + pages.from_config')
  })

  db.run(`ALTER TABLE pages ADD COLUMN what_config TEXT DEFAULT '{}'`, err => {
    if (err && !err.message.includes('duplicate')) console.error('what_config:', err.message)
    else console.log('  + pages.what_config')
  })

  db.close(() => console.log('\nMigration done.'))
})
