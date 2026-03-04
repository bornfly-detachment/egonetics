/**
 * init-agents-db.js
 * 初始化 agents.db — Agent 定义 + 关系图 + 消息记录
 * 运行：node init-agents-db.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'agents.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ agents.db 打开失败:', err.message);
    process.exit(1);
  }
  console.log('✅ agents.db 已打开');
});

db.serialize(() => {
  db.run('PRAGMA journal_mode=WAL');
  db.run('PRAGMA foreign_keys=ON');

  db.run(`CREATE TABLE IF NOT EXISTS agents (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    type        TEXT NOT NULL DEFAULT 'claude_code',
    model       TEXT,
    role        TEXT NOT NULL DEFAULT 'worker',
    description TEXT,
    status      TEXT NOT NULL DEFAULT 'idle',
    position_x  REAL DEFAULT 0,
    position_y  REAL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS agent_relations (
    id         TEXT PRIMARY KEY,
    from_agent TEXT NOT NULL,
    to_agent   TEXT NOT NULL,
    type       TEXT NOT NULL DEFAULT 'sequential',
    condition  TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (from_agent) REFERENCES agents(id) ON DELETE CASCADE,
    FOREIGN KEY (to_agent)   REFERENCES agents(id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS agent_messages (
    id         TEXT PRIMARY KEY,
    from_id    TEXT,
    to_id      TEXT,
    content    TEXT NOT NULL,
    type       TEXT NOT NULL DEFAULT 'message',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  db.run('CREATE INDEX IF NOT EXISTS idx_relations_from ON agent_relations(from_agent)');
  db.run('CREATE INDEX IF NOT EXISTS idx_relations_to   ON agent_relations(to_agent)');
  db.run('CREATE INDEX IF NOT EXISTS idx_messages_from  ON agent_messages(from_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_messages_to    ON agent_messages(to_id)');

  db.run('SELECT 1', [], (err) => {
    if (err) {
      console.error('❌ 初始化失败:', err.message);
    } else {
      console.log('✅ agents.db 初始化完成');
    }
    db.close();
  });
});
