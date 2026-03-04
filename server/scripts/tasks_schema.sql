-- Tasks 数据库 Schema (统一模型)
-- tasks 表同时服务 /api/tasks (Notion风格) 和 /api/kanban (看板视图)

-- ─── 主任务表 ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL DEFAULT 'Untitled',
  icon        TEXT DEFAULT '📋',
  -- 富文本内容
  content       TEXT DEFAULT '',
  content_plain TEXT DEFAULT '',
  -- 看板字段
  column_id   TEXT NOT NULL DEFAULT 'planned',
  sort_order  REAL DEFAULT 0,
  priority    TEXT DEFAULT 'medium',  -- urgent / high / medium / low
  assignee    TEXT,
  start_date  TEXT,
  due_date    TEXT,
  tags        TEXT DEFAULT '[]',      -- JSON 数组
  project     TEXT,
  project_icon TEXT,
  -- 时间戳
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── 看板列 ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kanban_columns (
  id         TEXT PRIMARY KEY,
  label      TEXT NOT NULL,
  header_bg  TEXT DEFAULT 'bg-slate-800',
  card_bg    TEXT DEFAULT 'bg-slate-900',
  accent     TEXT DEFAULT 'border-slate-600',
  position   REAL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── 动态属性定义 ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_property_defs (
  id            TEXT PRIMARY KEY,
  task_id       TEXT NOT NULL,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL,  -- text / number / select / multi-select / date / checkbox / url
  options       TEXT,           -- JSON 数组（select/multi-select 用）
  display_order INTEGER DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- ─── 属性值 ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_properties (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id         TEXT NOT NULL,
  property_def_id TEXT NOT NULL,
  value_text      TEXT,
  value_number    REAL,
  value_date      TEXT,
  value_boolean   INTEGER,
  value_json      TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(task_id, property_def_id),
  FOREIGN KEY (task_id)         REFERENCES tasks(id)              ON DELETE CASCADE,
  FOREIGN KEY (property_def_id) REFERENCES task_property_defs(id) ON DELETE CASCADE
);

-- ─── 版本历史（哈希链） ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_versions (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id               TEXT NOT NULL,
  content_hash          TEXT NOT NULL,
  content               TEXT NOT NULL,
  previous_version_hash TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  created_by            TEXT DEFAULT 'system',
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- ─── Blocks（页面块编辑器） ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blocks (
  id         TEXT PRIMARY KEY,
  page_id    TEXT NOT NULL,
  parent_id  TEXT,
  type       TEXT NOT NULL DEFAULT 'paragraph',
  content    TEXT DEFAULT '{}',
  metadata   TEXT DEFAULT '{}',
  collapsed  INTEGER DEFAULT 0,
  position   REAL DEFAULT 1.0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (page_id)   REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES blocks(id) ON DELETE CASCADE
);

-- ─── 索引 ──────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tasks_column_id    ON tasks(column_id);
CREATE INDEX IF NOT EXISTS idx_tasks_sort_order   ON tasks(sort_order);
CREATE INDEX IF NOT EXISTS idx_tasks_updated_at   ON tasks(updated_at);
CREATE INDEX IF NOT EXISTS idx_prop_defs_task_id  ON task_property_defs(task_id);
CREATE INDEX IF NOT EXISTS idx_props_task_id      ON task_properties(task_id);
CREATE INDEX IF NOT EXISTS idx_versions_task_id   ON task_versions(task_id);
CREATE INDEX IF NOT EXISTS idx_blocks_page_id     ON blocks(page_id);
CREATE INDEX IF NOT EXISTS idx_blocks_position    ON blocks(position);

-- ─── 触发器：自动更新 updated_at ──────────────────────────────────────────────
CREATE TRIGGER IF NOT EXISTS trg_tasks_updated_at
AFTER UPDATE ON tasks BEGIN
  UPDATE tasks SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_task_properties_updated_at
AFTER UPDATE ON task_properties BEGIN
  UPDATE task_properties SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_blocks_updated_at
AFTER UPDATE ON blocks BEGIN
  UPDATE blocks SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- ─── 默认看板列 ───────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO kanban_columns (id, label, header_bg, card_bg, accent, position) VALUES
  ('planned',     '计划中', 'bg-slate-800',        'bg-slate-900',        'border-slate-600',        0),
  ('in-progress', '进行中', 'bg-blue-900/30',       'bg-blue-950/20',       'border-blue-500/50',       1),
  ('review',      '审查中', 'bg-purple-900/30',     'bg-purple-950/20',     'border-purple-500/50',     2),
  ('done',        '已完成', 'bg-green-900/30',      'bg-green-950/20',      'border-green-500/50',      3);

-- ─── 示例任务 ─────────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO tasks (id, name, icon, column_id, sort_order, priority) VALUES
  ('task-1', 'Egonetics 开发计划', '🚀', 'in-progress', 300, 'high'),
  ('task-2', '项目文档模板',       '📋', 'planned',     200, 'medium'),
  ('task-3', '周会议记录',         '📅', 'planned',     100, 'low');
