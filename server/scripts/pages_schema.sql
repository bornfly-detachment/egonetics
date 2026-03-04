-- Pages 数据库 Schema
-- 设计：Notion 风格的页面树 + 块内容存储
-- 符合前端 types.ts 和 apiClient.ts 规范

-- 页面表：存储页面元信息（不含块内容）
CREATE TABLE IF NOT EXISTS pages (
    id TEXT PRIMARY KEY,                     -- 页面ID
    parent_id TEXT,                          -- 父页面ID，null表示根页面
    page_type TEXT DEFAULT 'page',           -- 页面类型: 'page', 'task', 'chronicle', 'theory'
    title TEXT NOT NULL DEFAULT '',          -- 页面标题
    icon TEXT DEFAULT '📄',                  -- 页面图标 (emoji)
    position REAL NOT NULL DEFAULT 1.0,      -- 排序位置（浮点数）
    ref_id TEXT,                             -- 关联ID（如 task_id）
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES pages(id) ON DELETE CASCADE
);

-- 块表：存储页面块内容
CREATE TABLE IF NOT EXISTS blocks (
    id TEXT PRIMARY KEY,                     -- 块ID
    page_id TEXT NOT NULL,                   -- 所属页面ID
    parent_id TEXT,                          -- 父块ID（支持块嵌套）
    type TEXT NOT NULL,                      -- 块类型
    content TEXT NOT NULL DEFAULT '{}',      -- 块内容 (JSON格式)
    position REAL NOT NULL DEFAULT 1.0,      -- 排序位置（浮点数）
    metadata TEXT DEFAULT '{}',              -- 元数据 (JSON格式)
    collapsed BOOLEAN DEFAULT FALSE,         -- 是否折叠
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES blocks(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX idx_pages_parent_id ON pages(parent_id);
CREATE INDEX idx_pages_page_type ON pages(page_type);
CREATE INDEX idx_pages_ref_id ON pages(ref_id);
CREATE INDEX idx_pages_position ON pages(position);
CREATE INDEX idx_blocks_page_id ON blocks(page_id);
CREATE INDEX idx_blocks_parent_id ON blocks(parent_id);
CREATE INDEX idx_blocks_position ON blocks(position);

-- 触发器：自动更新 updated_at
CREATE TRIGGER IF NOT EXISTS update_pages_timestamp
AFTER UPDATE ON pages
BEGIN
    UPDATE pages SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_blocks_timestamp
AFTER UPDATE ON blocks
BEGIN
    UPDATE blocks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- 看板列表（Kanban Columns）
CREATE TABLE IF NOT EXISTS kanban_columns (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    header_bg TEXT NOT NULL,
    card_bg TEXT NOT NULL,
    accent TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 看板任务表（Kanban Tasks）
CREATE TABLE IF NOT EXISTS kanban_tasks (
    id TEXT PRIMARY KEY,
    column_id TEXT NOT NULL,
    name TEXT NOT NULL,
    icon TEXT DEFAULT '📝',
    assignee TEXT,
    start_date TEXT,
    due_date TEXT,
    project TEXT,
    project_icon TEXT,
    status TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium',
    sort_order INTEGER NOT NULL DEFAULT 0,
    tags TEXT,  -- JSON array
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (column_id) REFERENCES kanban_columns(id) ON DELETE CASCADE
);

-- 看板索引
CREATE INDEX idx_kanban_columns_position ON kanban_columns(position);
CREATE INDEX idx_kanban_tasks_column_id ON kanban_tasks(column_id);
CREATE INDEX idx_kanban_tasks_sort_order ON kanban_tasks(sort_order);

-- 看板触发器
CREATE TRIGGER IF NOT EXISTS update_kanban_columns_timestamp
AFTER UPDATE ON kanban_columns
BEGIN
    UPDATE kanban_columns SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_kanban_tasks_timestamp
AFTER UPDATE ON kanban_tasks
BEGIN
    UPDATE kanban_tasks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- 初始化示例数据
INSERT OR IGNORE INTO pages (id, parent_id, page_type, title, icon, position) VALUES
    ('page-1', NULL, 'page', '首页', '🏠', 1.0),
    ('page-2', NULL, 'page', '项目文档', '📁', 2.0),
    ('page-3', 'page-2', 'page', '开发计划', '🚀', 1.0);
