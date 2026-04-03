-- ============================================================
--  pages_schema_v2.sql  —  统一富文本数据库 Schema
--  覆盖：page / task / theory / blog 全部类型
--  取代：pages_schema.sql + tasks_schema.sql 的 page/block 部分
-- ============================================================

PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

-- ── 核心：页面表 ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pages (
  id          TEXT PRIMARY KEY,
  parent_id   TEXT REFERENCES pages(id) ON DELETE CASCADE,
  page_type   TEXT NOT NULL DEFAULT 'page',   -- 'page'|'task'|'theory'|'blog'
  title       TEXT NOT NULL DEFAULT '',
  icon        TEXT NOT NULL DEFAULT '📄',
  position    REAL NOT NULL DEFAULT 1.0,
  ref_id      TEXT,   -- 根 task 页面专用（= task id，保持 CTE 兼容）

  -- Task 专属元数据（非 task 类型 NULL）
  column_id    TEXT DEFAULT 'planned',
  priority     TEXT DEFAULT 'medium',
  assignee     TEXT,
  start_date   TEXT,
  due_date     TEXT,
  project      TEXT,
  project_icon TEXT,
  sort_order   REAL DEFAULT 0,
  tags         TEXT DEFAULT '[]',             -- JSON 数组，kanban 快速读写

  -- Chronicle 字段
  chronicle_entry_id TEXT,
  task_outcome       TEXT,
  task_summary       TEXT,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- 同父节点下标题唯一（非 NULL parent_id）
  UNIQUE (parent_id, title)
);

-- 根节点标题唯一（parent_id IS NULL）
CREATE UNIQUE INDEX IF NOT EXISTS idx_pages_root_title
  ON pages(title) WHERE parent_id IS NULL AND page_type != 'exec_step';

-- ── 块内容表 ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blocks (
  id              TEXT PRIMARY KEY,
  page_id         TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  parent_id       TEXT REFERENCES blocks(id) ON DELETE CASCADE,
  type            TEXT NOT NULL DEFAULT 'paragraph',
  content         TEXT NOT NULL DEFAULT '{}',
  position        REAL NOT NULL DEFAULT 1.0,
  metadata        TEXT NOT NULL DEFAULT '{}',
  collapsed       INTEGER NOT NULL DEFAULT 0,
  title           TEXT NOT NULL DEFAULT '',
  creator         TEXT NOT NULL DEFAULT '',
  edit_start_time TEXT,
  draft_explanation TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── 标签体系（规范化） ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tags (
  id    TEXT PRIMARY KEY,
  name  TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS page_tags (
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  tag_id  TEXT NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
  PRIMARY KEY (page_id, tag_id)
);

-- ── 看板列 ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kanban_columns (
  id        TEXT PRIMARY KEY,
  label     TEXT NOT NULL,
  header_bg TEXT NOT NULL DEFAULT 'bg-slate-800',
  card_bg   TEXT NOT NULL DEFAULT 'bg-slate-900',
  accent    TEXT NOT NULL DEFAULT 'border-slate-600',
  position  REAL NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── 自定义属性定义（per-page） ────────────────────────────────
CREATE TABLE IF NOT EXISTS page_property_defs (
  id            TEXT PRIMARY KEY,
  page_id       TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL,
  options       TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── 自定义属性值 ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS page_properties (
  id              TEXT PRIMARY KEY,
  page_id         TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  property_def_id TEXT NOT NULL REFERENCES page_property_defs(id) ON DELETE CASCADE,
  value_text      TEXT,
  value_number    REAL,
  value_boolean   INTEGER,
  value_date      TEXT,
  value_json      TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (page_id, property_def_id)
);

-- ── 版本历史 ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS process_versions (
  id               TEXT PRIMARY KEY,
  entity_id        TEXT NOT NULL,
  entity_type      TEXT NOT NULL DEFAULT 'block',
  version_num      INTEGER NOT NULL DEFAULT 1,
  start_time       TEXT,
  publish_time     TEXT,
  publisher        TEXT,
  title_snapshot   TEXT,
  content_snapshot TEXT,
  explanation      TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── Settings（全局 KV 配置表） ────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── Relation Blocks（关系内容块，与 blocks 表同构） ─────────────
CREATE TABLE IF NOT EXISTS relation_blocks (
  id                TEXT PRIMARY KEY,
  relation_id       TEXT NOT NULL REFERENCES relations(id) ON DELETE CASCADE,
  parent_id         TEXT REFERENCES relation_blocks(id) ON DELETE CASCADE,
  type              TEXT NOT NULL DEFAULT 'paragraph',
  content           TEXT NOT NULL DEFAULT '{}',
  position          REAL NOT NULL DEFAULT 1.0,
  metadata          TEXT NOT NULL DEFAULT '{}',
  collapsed         INTEGER NOT NULL DEFAULT 0,
  title             TEXT NOT NULL DEFAULT '',
  creator           TEXT NOT NULL DEFAULT '',
  edit_start_time   TEXT,
  draft_explanation TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rel_blocks_relation ON relation_blocks(relation_id);
CREATE INDEX IF NOT EXISTS idx_rel_blocks_parent   ON relation_blocks(parent_id);
CREATE INDEX IF NOT EXISTS idx_rel_blocks_position ON relation_blocks(position);

-- ── Relations（跨实体语义边，原 pagesDb.relations 表） ─────────
CREATE TABLE IF NOT EXISTS relations (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL DEFAULT '',
  relation_type TEXT NOT NULL DEFAULT 'contains',
  source_type   TEXT NOT NULL,
  source_id     TEXT NOT NULL,
  target_type   TEXT NOT NULL,
  target_id     TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  creator       TEXT NOT NULL DEFAULT 'user',
  properties    TEXT NOT NULL DEFAULT '{}',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── Canvases（画布元数据） ────────────────────────────────────
CREATE TABLE IF NOT EXISTS canvases (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL DEFAULT '新画布',
  description TEXT NOT NULL DEFAULT '',
  created_by  TEXT NOT NULL DEFAULT 'user',
  canvas_type TEXT NOT NULL DEFAULT 'semantic',
  -- 'semantic'   — 用户手建语义图，节点是 Page
  -- 'execution'  — Agent 创建执行图，节点是 Action（有生命周期）
  task_ref_id TEXT,
  -- execution canvas 专用：指向发起执行的 task page id
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── Canvas Nodes（画布节点位置 + 执行语义） ────────────────────
CREATE TABLE IF NOT EXISTS canvas_nodes (
  id              TEXT PRIMARY KEY,
  canvas_id       TEXT NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
  entity_type     TEXT NOT NULL,
  entity_id       TEXT NOT NULL,
  x               REAL    NOT NULL DEFAULT 0,
  y               REAL    NOT NULL DEFAULT 0,
  expanded_level  INTEGER NOT NULL DEFAULT 0,  -- 保留兼容
  collapsed       INTEGER NOT NULL DEFAULT 0,  -- 卡片折叠到标题栏
  tree_expanded   INTEGER NOT NULL DEFAULT 0,  -- 子节点已在画布展开

  -- SubjectiveEgoneticsAI Agent 执行字段
  node_kind       TEXT NOT NULL DEFAULT 'entity',
  -- 'entity'|'llm_call'|'tool_call'|'local_judge'|'rule_branch'|'human_gate'|'lifecycle'|'cost_tracker'
  lifecycle_state TEXT NOT NULL DEFAULT 'pending',
  -- 'pending'|'running'|'success'|'failed'|'timeout'|'loop_detected'|'budget_exceeded'|'waiting_human'
  exec_config     TEXT NOT NULL DEFAULT '{}',  -- 执行参数 JSON（按 node_kind 不同）
  cost_snapshot   TEXT NOT NULL DEFAULT '{}',  -- 执行完成后写入 cost 向量 JSON

  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (canvas_id, entity_id)
);

-- ── 索引 ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pages_parent      ON pages(parent_id);
CREATE INDEX IF NOT EXISTS idx_pages_type        ON pages(page_type);
CREATE INDEX IF NOT EXISTS idx_pages_ref_id      ON pages(ref_id);
CREATE INDEX IF NOT EXISTS idx_pages_column      ON pages(column_id);
CREATE INDEX IF NOT EXISTS idx_pages_sort        ON pages(sort_order);
CREATE INDEX IF NOT EXISTS idx_blocks_page       ON blocks(page_id);
CREATE INDEX IF NOT EXISTS idx_blocks_parent     ON blocks(parent_id);
CREATE INDEX IF NOT EXISTS idx_blocks_position   ON blocks(position);
CREATE INDEX IF NOT EXISTS idx_page_tags_page    ON page_tags(page_id);
CREATE INDEX IF NOT EXISTS idx_page_tags_tag     ON page_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_prop_defs_page    ON page_property_defs(page_id);
CREATE INDEX IF NOT EXISTS idx_props_page        ON page_properties(page_id);
CREATE INDEX IF NOT EXISTS idx_process_entity    ON process_versions(entity_id);
CREATE INDEX IF NOT EXISTS idx_kanban_cols_pos   ON kanban_columns(position);
CREATE INDEX IF NOT EXISTS idx_relations_src     ON relations(source_id);
CREATE INDEX IF NOT EXISTS idx_relations_tgt     ON relations(target_id);
CREATE INDEX IF NOT EXISTS idx_canvas_nodes_cvs  ON canvas_nodes(canvas_id);
CREATE INDEX IF NOT EXISTS idx_canvas_nodes_eid  ON canvas_nodes(entity_id);

-- ── 标签语义树已迁移至 JSON 文件: src/kernel/compiler/tag-tree.json ──
-- tag_trees / tag_tree_migrations / prvse_reclassify_diffs 表已移除

-- ── 控制论节点树（cybernetics_nodes） ───────────────────────
-- 递归树：每个节点可有任意子节点，支持 L0→LN 渐进展开
-- 这棵树是整个控制论系统的地图 + 蓝图
CREATE TABLE IF NOT EXISTS cybernetics_nodes (
  id          TEXT PRIMARY KEY,
  parent_id   TEXT REFERENCES cybernetics_nodes(id) ON DELETE CASCADE,
  layer       TEXT,            -- P|R|V|S|E|null（null=跨层或根节点）
  level       INTEGER DEFAULT 0,  -- 0=layer根, 1=L1分组, 2=L2叶节点, ...
  node_type   TEXT DEFAULT 'concept',
  -- 'root'|'layer'|'axiom_group'|'skeleton_group'|'impl_group'|'lifecycle_group'|'concept'
  name        TEXT NOT NULL,
  description TEXT DEFAULT '',
  content     TEXT DEFAULT '[]',  -- BlockEditor JSON，行内存储
  sort_order  REAL DEFAULT 0,
  is_builtin  INTEGER DEFAULT 0,
  meta        TEXT DEFAULT '{}',  -- JSON：links/refs/外部系统 id 等
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cyber_parent ON cybernetics_nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_cyber_layer  ON cybernetics_nodes(layer);

CREATE TRIGGER IF NOT EXISTS trg_cyber_updated
AFTER UPDATE ON cybernetics_nodes BEGIN
  UPDATE cybernetics_nodes SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ── 触发器：自动更新 updated_at ──────────────────────────────
CREATE TRIGGER IF NOT EXISTS trg_pages_updated
AFTER UPDATE ON pages BEGIN
  UPDATE pages SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_blocks_updated
AFTER UPDATE ON blocks BEGIN
  UPDATE blocks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_kanban_cols_updated
AFTER UPDATE ON kanban_columns BEGIN
  UPDATE kanban_columns SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_page_properties_updated
AFTER UPDATE ON page_properties BEGIN
  UPDATE page_properties SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_relations_updated
AFTER UPDATE ON relations BEGIN
  UPDATE relations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_canvas_nodes_updated
AFTER UPDATE ON canvas_nodes BEGIN
  UPDATE canvas_nodes SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ── 默认关系类型 ──────────────────────────────────────────────
INSERT OR IGNORE INTO settings (key, value) VALUES ('relation_types', '[
  {"id":"contains",  "label":"包含",   "color":"#8b5cf6"},
  {"id":"causal",    "label":"因果",   "color":"#ef4444"},
  {"id":"derives",   "label":"推导",   "color":"#3b82f6"},
  {"id":"relates",   "label":"联系",   "color":"#10b981"},
  {"id":"assumes",   "label":"假设",   "color":"#f59e0b"},
  {"id":"chain",     "label":"链式过程","color":"#06b6d4"},
  {"id":"question",  "label":"追问",   "color":"#a855f7"},
  {"id":"answer",    "label":"回答",   "color":"#84cc16"},
  {"id":"based_on",  "label":"基于",   "color":"#ec4899"}
]');

-- ── 默认看板列 ────────────────────────────────────────────────
INSERT OR IGNORE INTO kanban_columns (id, label, header_bg, card_bg, accent, position) VALUES
  ('planned',     '计划中', 'bg-slate-800',    'bg-slate-900',    'border-slate-600',    0),
  ('in-progress', '进行中', 'bg-blue-900/30',  'bg-blue-950/20',  'border-blue-500/50',  1),
  ('review',      '审查中', 'bg-purple-900/30','bg-purple-950/20','border-purple-500/50', 2),
  ('done',        '已完成', 'bg-green-900/30', 'bg-green-950/20', 'border-green-500/50',  3);
