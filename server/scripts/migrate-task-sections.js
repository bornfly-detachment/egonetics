/**
 * migrate-task-sections.js
 * Task 三段结构迁移：测试清单 + 资源分配 + 工厂模式
 *
 * 新增：
 *   pages 表:  parent_task_id (工厂实例指向模板)
 *   新表:       task_checklist, task_resources
 *   看板列:    '模板库' (id='templates')
 */
const path    = require('path')
const sqlite3 = require('sqlite3').verbose()

const DB_PATH = path.join(__dirname, '../data/pages.db')
const db = new sqlite3.Database(DB_PATH)

db.serialize(() => {
  // 1. pages 表新增 parent_task_id
  db.run(`ALTER TABLE pages ADD COLUMN parent_task_id TEXT`, err => {
    if (err && !err.message.includes('duplicate')) console.log('parent_task_id:', err.message)
    else console.log('  + pages.parent_task_id')
  })

  // 2. task_checklist 表
  db.run(`
    CREATE TABLE IF NOT EXISTS task_checklist (
      id         TEXT PRIMARY KEY,
      task_id    TEXT NOT NULL,
      condition  TEXT NOT NULL DEFAULT '',
      status     TEXT NOT NULL DEFAULT 'pending',  -- pending | pass | fail
      sort_order REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (task_id) REFERENCES pages(id) ON DELETE CASCADE
    )
  `, err => {
    if (err) console.error('task_checklist:', err.message)
    else console.log('  + task_checklist table')
  })

  db.run(`CREATE INDEX IF NOT EXISTS idx_checklist_task ON task_checklist(task_id)`)

  // 3. task_resources 表
  db.run(`
    CREATE TABLE IF NOT EXISTS task_resources (
      id            TEXT PRIMARY KEY,
      task_id       TEXT NOT NULL,
      resource_type TEXT NOT NULL,  -- sensor | controller | tester | lifecycle
      enabled       INTEGER NOT NULL DEFAULT 1,
      config        TEXT NOT NULL DEFAULT '{}',
      updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(task_id, resource_type),
      FOREIGN KEY (task_id) REFERENCES pages(id) ON DELETE CASCADE
    )
  `, err => {
    if (err) console.error('task_resources:', err.message)
    else console.log('  + task_resources table')
  })

  db.run(`CREATE INDEX IF NOT EXISTS idx_resources_task ON task_resources(task_id)`)

  // 4. 看板新增 "模板库" 列
  db.run(`
    INSERT OR IGNORE INTO kanban_columns
      (id, label, header_bg, card_bg, accent, position)
    VALUES
      ('templates', '模板库', 'bg-violet-900/30', 'bg-violet-950/20', 'border-violet-500/50', 10)
  `, err => {
    if (err) console.error('templates column:', err.message)
    else console.log('  + kanban column: 模板库')
  })

  db.close(() => console.log('\nMigration done.'))
})
