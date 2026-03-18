/**
 * migrate-relation-types.js
 * 1. 创建 settings 表（若不存在）
 * 2. 写入默认 relation_types 配置
 * 3. relations 表补 relation_type 列
 */

const path    = require('path')
const sqlite3 = require('sqlite3').verbose()

const DB_PATH = path.join(__dirname, '../data/pages.db')
const db = new sqlite3.Database(DB_PATH)

const DEFAULT_TYPES = [
  { id: 'contains',  label: '包含',    color: '#8b5cf6' },
  { id: 'causal',    label: '因果',    color: '#ef4444' },
  { id: 'derives',   label: '推导',    color: '#3b82f6' },
  { id: 'relates',   label: '联系',    color: '#10b981' },
  { id: 'assumes',   label: '假设',    color: '#f59e0b' },
  { id: 'chain',     label: '链式过程', color: '#06b6d4' },
  { id: 'question',  label: '追问',    color: '#a855f7' },
  { id: 'answer',    label: '回答',    color: '#84cc16' },
  { id: 'based_on',  label: '基于',    color: '#ec4899' },
]

db.serialize(() => {
  // 1. settings 表
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL DEFAULT '{}',
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `, err => {
    if (err) console.error('❌ settings 表:', err.message)
    else     console.log('✅ settings 表已就绪')
  })

  // 2. 写入默认 relation_types（不覆盖已有数据）
  db.get("SELECT value FROM settings WHERE key = 'relation_types'", (err, row) => {
    if (row) {
      console.log('✓ relation_types 已存在，跳过写入')
    } else {
      db.run(
        "INSERT INTO settings (key, value) VALUES ('relation_types', ?)",
        [JSON.stringify(DEFAULT_TYPES)],
        err2 => {
          if (err2) console.error('❌ 写入 relation_types:', err2.message)
          else      console.log('✅ 默认关系类型已写入')
        }
      )
    }
  })

  // 3. relations 表补 relation_type 列
  db.all('PRAGMA table_info(relations)', (err, cols) => {
    if (err) { console.error(err); return }
    const existing = new Set(cols.map(c => c.name))
    if (existing.has('relation_type')) {
      console.log('✓ relation_type 列已存在，跳过')
    } else {
      db.run(
        "ALTER TABLE relations ADD COLUMN relation_type TEXT NOT NULL DEFAULT 'contains'",
        err2 => {
          if (err2) console.error('❌ 补列 relation_type:', err2.message)
          else      console.log('✅ relations.relation_type 已添加')
        }
      )
    }
  })
})

setTimeout(() => { db.close(); console.log('Migration 完成') }, 500)
