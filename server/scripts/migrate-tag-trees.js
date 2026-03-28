/**
 * migrate-tag-trees.js
 * 将 docs/tag-trees.json 中的标签语义树迁移到 pages.db 的 tag_trees 表
 *
 * 用法: node server/scripts/migrate-tag-trees.js
 */

const path   = require('path')
const fs     = require('fs')
const sqlite = require('sqlite3').verbose()

const DB_PATH   = path.join(__dirname, '../data/pages.db')
const JSON_PATH = path.join(__dirname, '../../docs/tag-trees.json')

const db = new sqlite.Database(DB_PATH, err => {
  if (err) { console.error('❌ 无法打开 pages.db:', err.message); process.exit(1) }
})

db.run('PRAGMA foreign_keys=ON')

// ── 建表（幂等） ───────────────────────────────────────────────
db.run(`
  CREATE TABLE IF NOT EXISTS tag_trees (
    id         TEXT PRIMARY KEY,
    parent_id  TEXT REFERENCES tag_trees(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    color      TEXT NOT NULL DEFAULT '#6b7280',
    sort_order REAL NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`, createErr => {
  if (createErr) { console.error('❌ 建表失败:', createErr.message); process.exit(1) }

  const json = JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'))

  // ── 扁平化递归树 ──────────────────────────────────────────
  const rows = []
  function flatten(nodes, parentId) {
    nodes.forEach((node, i) => {
      rows.push({ id: node.id, parent_id: parentId, name: node.name, color: node.color, sort_order: i })
      if (node.children && node.children.length) flatten(node.children, node.id)
    })
  }
  flatten(json, null)

  console.log(`📦 共 ${rows.length} 个节点，开始写入…`)

  const stmt = db.prepare(
    'INSERT OR IGNORE INTO tag_trees (id, parent_id, name, color, sort_order) VALUES (?,?,?,?,?)'
  )

  let inserted = 0
  db.serialize(() => {
    db.run('BEGIN')
    for (const r of rows) {
      stmt.run(r.id, r.parent_id, r.name, r.color, r.sort_order, function(err) {
        if (err) console.warn(`  ⚠ 跳过 ${r.id}: ${err.message}`)
        else if (this.changes > 0) inserted++
      })
    }
    stmt.finalize()
    db.run('COMMIT', () => {
      console.log(`✅ 迁移完成：写入 ${inserted} 个节点（已存在的跳过）`)
      db.close()
    })
  })
})
