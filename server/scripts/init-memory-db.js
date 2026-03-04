/**
 * init-memory-db.js
 * 初始化 memory.db — 对话记录 + Chronicle 精选库
 * 运行：node init-memory-db.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'memory.db');

// 如果存在旧 memory.db，备份它
if (fs.existsSync(DB_PATH)) {
  const backup = DB_PATH + '.bak.' + Date.now();
  fs.copyFileSync(DB_PATH, backup);
  console.log(`⚠️  已备份旧 memory.db → ${path.basename(backup)}`);
}

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ 数据库打开失败:', err.message);
    process.exit(1);
  }
  console.log('✅ memory.db 已打开');
});

db.serialize(() => {
  db.run('PRAGMA journal_mode=WAL');
  db.run('PRAGMA foreign_keys=ON');

  // 对话会话
  db.run(`CREATE TABLE IF NOT EXISTS sessions (
    id                  TEXT PRIMARY KEY,
    agent_name          TEXT NOT NULL DEFAULT 'unknown',
    agent_type          TEXT NOT NULL DEFAULT 'claude_code',
    model               TEXT,
    source_file         TEXT,
    token_input         INTEGER DEFAULT 0,
    token_output        INTEGER DEFAULT 0,
    duration_ms         INTEGER DEFAULT 0,
    started_at          TEXT,
    ended_at            TEXT,
    annotation_title    TEXT,
    annotation_summary  TEXT,
    chronicle_entry_id  TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  // 对话轮次
  db.run(`CREATE TABLE IF NOT EXISTS rounds (
    id           TEXT PRIMARY KEY,
    session_id   TEXT NOT NULL,
    round_num    INTEGER NOT NULL,
    user_input   TEXT,
    started_at   TEXT,
    ended_at     TEXT,
    duration_ms  INTEGER DEFAULT 0,
    token_input  INTEGER DEFAULT 0,
    token_output INTEGER DEFAULT 0,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  )`);

  // 执行步骤链
  db.run(`CREATE TABLE IF NOT EXISTS steps (
    id          TEXT PRIMARY KEY,
    round_id    TEXT NOT NULL,
    step_num    INTEGER NOT NULL,
    type        TEXT NOT NULL,
    tool_name   TEXT,
    content     TEXT DEFAULT '{}',
    duration_ms INTEGER DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE
  )`);

  // 用户标注
  db.run(`CREATE TABLE IF NOT EXISTS annotations (
    id         TEXT PRIMARY KEY,
    ref_type   TEXT NOT NULL,
    ref_id     TEXT NOT NULL,
    type       TEXT NOT NULL,
    content    TEXT,
    tags       TEXT DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  // Chronicle 里程碑（先建，entries/collections 引用它）
  db.run(`CREATE TABLE IF NOT EXISTS chronicle_milestones (
    id           TEXT PRIMARY KEY,
    title        TEXT NOT NULL,
    description  TEXT,
    cover_start  TEXT,
    cover_end    TEXT,
    is_published INTEGER DEFAULT 0,
    published_at TEXT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  // Chronicle 精选条目
  db.run(`CREATE TABLE IF NOT EXISTS chronicle_entries (
    id            TEXT PRIMARY KEY,
    type          TEXT NOT NULL,
    source_id     TEXT NOT NULL,
    title         TEXT NOT NULL,
    summary       TEXT,
    start_time    TEXT,
    end_time      TEXT,
    task_outcome  TEXT,
    version_tag   TEXT,
    content       TEXT,
    milestone_id  TEXT,
    is_locked     INTEGER DEFAULT 0,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (milestone_id) REFERENCES chronicle_milestones(id)
  )`);

  // Chronicle 主题集合（用户自定义命名，可跨类型、可拖拽）
  db.run(`CREATE TABLE IF NOT EXISTS chronicle_collections (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    description  TEXT,
    cover_icon   TEXT DEFAULT '📦',
    milestone_id TEXT,
    position_x   REAL DEFAULT 0,
    position_y   REAL DEFAULT 0,
    sort_order   REAL DEFAULT 0,
    is_locked    INTEGER DEFAULT 0,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (milestone_id) REFERENCES chronicle_milestones(id)
  )`);

  // 集合与条目的关联（多对多）
  db.run(`CREATE TABLE IF NOT EXISTS chronicle_collection_items (
    id            TEXT PRIMARY KEY,
    collection_id TEXT NOT NULL,
    entry_id      TEXT NOT NULL,
    sort_order    REAL DEFAULT 0,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (collection_id, entry_id),
    FOREIGN KEY (collection_id) REFERENCES chronicle_collections(id) ON DELETE CASCADE,
    FOREIGN KEY (entry_id)      REFERENCES chronicle_entries(id)     ON DELETE CASCADE
  )`);

  // Chronicle 追加标注（V2/V3，锁定后仍可追加）
  db.run(`CREATE TABLE IF NOT EXISTS chronicle_annotations (
    id         TEXT PRIMARY KEY,
    entry_id   TEXT NOT NULL,
    version    INTEGER NOT NULL,
    content    TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (entry_id) REFERENCES chronicle_entries(id)
  )`);

  // 原始事件日志
  db.run(`CREATE TABLE IF NOT EXISTS events (
    id         TEXT PRIMARY KEY,
    type       TEXT NOT NULL,
    source     TEXT NOT NULL,
    ref_id     TEXT,
    title      TEXT,
    content    TEXT DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  // 索引
  db.run('CREATE INDEX IF NOT EXISTS idx_sessions_chronicle     ON sessions(chronicle_entry_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_rounds_session_id      ON rounds(session_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_steps_round_id         ON steps(round_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_annotations_ref        ON annotations(ref_type, ref_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_chronicle_type         ON chronicle_entries(type)');
  db.run('CREATE INDEX IF NOT EXISTS idx_chronicle_milestone    ON chronicle_entries(milestone_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_chronicle_anno_entry   ON chronicle_annotations(entry_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_collection_milestone   ON chronicle_collections(milestone_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_col_items_col          ON chronicle_collection_items(collection_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_col_items_entry        ON chronicle_collection_items(entry_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_events_source_time     ON events(source, created_at)');

  db.run('SELECT 1', [], (err) => {
    if (err) {
      console.error('❌ 初始化失败:', err.message);
    } else {
      console.log('✅ memory.db 初始化完成');
    }
    db.close();
  });
});
