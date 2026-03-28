/**
 * migrate-tagtree-aop.js
 * TagTree AOP 系统所需表：
 *   prvse_classifications  — 任意实体的三问标签选择
 *   tag_tree_migrations    — 标签体系迁移记录（含AI Prompt）
 *   prvse_reclassify_diffs — AI重打标结果（待审核 Diff）
 */
const path    = require('path')
const sqlite3 = require('sqlite3').verbose()
const db = new sqlite3.Database(path.join(__dirname, '../data/pages.db'))

db.serialize(() => {

  // 1. 通用三问标签分类表（任意实体类型可用）
  db.run(`
    CREATE TABLE IF NOT EXISTS prvse_classifications (
      entity_id   TEXT NOT NULL,
      entity_type TEXT NOT NULL,           -- task_component | controller_node | cyber_node | ...
      layer       TEXT NOT NULL DEFAULT '', -- P | V | S | R（所属层）
      from_tags   TEXT NOT NULL DEFAULT '[]',
      what_tags   TEXT NOT NULL DEFAULT '[]',
      where_tags  TEXT NOT NULL DEFAULT '[]',
      description TEXT NOT NULL DEFAULT '',
      updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (entity_id, entity_type)
    )
  `, err => {
    if (err) console.error('prvse_classifications:', err.message)
    else console.log('  + prvse_classifications')
  })

  // 2. 标签体系迁移记录
  db.run(`
    CREATE TABLE IF NOT EXISTS tag_tree_migrations (
      id             TEXT PRIMARY KEY,
      title          TEXT NOT NULL,
      description    TEXT NOT NULL DEFAULT '', -- 用户写的映射规则，直接作为AI Prompt
      status         TEXT NOT NULL DEFAULT 'draft', -- draft | running | done | failed
      affected_count INTEGER NOT NULL DEFAULT 0,
      applied_count  INTEGER NOT NULL DEFAULT 0,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      started_at     TEXT,
      applied_at     TEXT
    )
  `, err => {
    if (err) console.error('tag_tree_migrations:', err.message)
    else console.log('  + tag_tree_migrations')
  })

  // 3. AI重打标 Diff（每条 = 一个实体的新旧标签对比）
  db.run(`
    CREATE TABLE IF NOT EXISTS prvse_reclassify_diffs (
      id             TEXT PRIMARY KEY,
      migration_id   TEXT NOT NULL,
      entity_id      TEXT NOT NULL,
      entity_type    TEXT NOT NULL,
      entity_desc    TEXT NOT NULL DEFAULT '',
      old_layer      TEXT NOT NULL DEFAULT '',
      old_from_tags  TEXT NOT NULL DEFAULT '[]',
      old_what_tags  TEXT NOT NULL DEFAULT '[]',
      old_where_tags TEXT NOT NULL DEFAULT '[]',
      new_layer      TEXT NOT NULL DEFAULT '',
      new_from_tags  TEXT NOT NULL DEFAULT '[]',
      new_what_tags  TEXT NOT NULL DEFAULT '[]',
      new_where_tags TEXT NOT NULL DEFAULT '[]',
      confidence     REAL NOT NULL DEFAULT 0,
      review_status  TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (migration_id) REFERENCES tag_tree_migrations(id) ON DELETE CASCADE
    )
  `, err => {
    if (err) console.error('prvse_reclassify_diffs:', err.message)
    else console.log('  + prvse_reclassify_diffs')
  })

  db.run(`CREATE INDEX IF NOT EXISTS idx_clf_entity ON prvse_classifications(entity_id, entity_type)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_diff_migration ON prvse_reclassify_diffs(migration_id)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_diff_entity ON prvse_reclassify_diffs(entity_id, entity_type)`)

  db.close(() => console.log('\nMigration done.'))
})
