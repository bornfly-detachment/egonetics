/**
 * migrate-canvas-type.js
 * 给 canvases 表加 canvas_type 字段，区分语义图和执行图
 *
 * canvas_type:
 *   'semantic'   — 用户手建，节点是 Page（现有默认值）
 *   'execution'  — Agent 创建，节点是 exec_step Action，有生命周期
 */

const path    = require('path')
const sqlite3 = require('sqlite3').verbose()

const DB_PATH = path.join(__dirname, '../data/pages.db')
const db = new sqlite3.Database(DB_PATH)

db.serialize(() => {
  const cols = [
    {
      name: 'canvas_type',
      def: `ALTER TABLE canvases ADD COLUMN canvas_type TEXT NOT NULL DEFAULT 'semantic'`,
    },
    {
      name: 'task_ref_id',
      def: `ALTER TABLE canvases ADD COLUMN task_ref_id TEXT`,
      // 指向发起执行的 task page id，execution canvas 专用
    },
  ]

  cols.forEach(({ name, def }) => {
    db.run(def, err => {
      if (err && err.message.includes('duplicate column')) {
        console.log(`⏭  ${name} 已存在，跳过`)
      } else if (err) {
        console.error(`❌ ${name}:`, err.message)
      } else {
        console.log(`✅ ${name} 已添加`)
      }
    })
  })

  // 已有 canvas 全部标记为 semantic
  db.run(
    `UPDATE canvases SET canvas_type = 'semantic' WHERE canvas_type IS NULL OR canvas_type = ''`,
    err => {
      if (err) console.error('❌ 回填 semantic 失败:', err.message)
      else     console.log('✅ 已有 canvas 回填为 semantic')
    }
  )
})

setTimeout(() => {
  db.close()
  console.log('Migration 完成')
}, 500)
