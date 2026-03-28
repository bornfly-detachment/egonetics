/**
 * migrate-proposals.js
 * SEAI → Egonetics 通信中间层：seai_proposals 消息队列表
 */
const path    = require('path')
const sqlite3 = require('sqlite3').verbose()
const db = new sqlite3.Database(path.join(__dirname, '../data/pages.db'))

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS seai_proposals (
      id            TEXT PRIMARY KEY,
      source        TEXT NOT NULL DEFAULT 'seai',     -- 来源：seai | agent-xxx
      type          TEXT NOT NULL,                    -- classification | tag_tree | task | component | custom
      entity_id     TEXT NOT NULL DEFAULT '',
      entity_type   TEXT NOT NULL DEFAULT '',
      payload       TEXT NOT NULL DEFAULT '{}',       -- SEAI 想写入的新状态（JSON）
      conflict_with TEXT,                             -- 检测到的冲突：当前已有状态（JSON），NULL=无冲突
      status        TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected | auto_applied
      message       TEXT NOT NULL DEFAULT '',         -- SEAI 附加说明
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at   TEXT,
      resolved_by   TEXT                              -- user | auto
    )
  `, err => {
    if (err) console.error('seai_proposals:', err.message)
    else console.log('  + seai_proposals')
  })

  db.run(`CREATE INDEX IF NOT EXISTS idx_prop_status   ON seai_proposals(status)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_prop_entity   ON seai_proposals(entity_id, entity_type)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_prop_created  ON seai_proposals(created_at)`)

  db.close(() => console.log('Migration done.'))
})
