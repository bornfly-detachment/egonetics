-- Tasks 数据库Schema
-- 设计：Notion风格的动态任务/项目系统
-- 包含动态属性定义和富文本内容存储

-- 任务表：存储任务/项目的元数据
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,                     -- 任务ID (UUID)
    name TEXT NOT NULL,                      -- 任务名称
    icon TEXT DEFAULT '📝',                  -- 任务图标 (emoji)
    content TEXT DEFAULT '',                 -- 富文本内容 (HTML/Markdown)
    content_plain TEXT DEFAULT '',           -- 纯文本内容 (用于搜索)
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 动态属性定义表：每个任务可以有自定义属性
CREATE TABLE IF NOT EXISTS task_property_defs (
    id TEXT PRIMARY KEY,                     -- 属性定义ID (UUID)
    task_id TEXT NOT NULL,                   -- 所属任务ID
    name TEXT NOT NULL,                      -- 属性名称
    type TEXT NOT NULL,                      -- 属性类型: 'text', 'number', 'select', 'multi-select', 'date', 'checkbox', 'url'
    options TEXT,                            -- 选项列表 (JSON数组，用于select/multi-select)
    display_order INTEGER DEFAULT 0,         -- 显示顺序
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- 任务属性值表：存储每个任务的属性值
CREATE TABLE IF NOT EXISTS task_properties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,                   -- 所属任务ID
    property_def_id TEXT NOT NULL,           -- 属性定义ID
    value_text TEXT,                         -- 文本类型值
    value_number REAL,                       -- 数字类型值
    value_date TIMESTAMP,                    -- 日期类型值
    value_boolean BOOLEAN,                   -- 布尔类型值
    value_json TEXT,                         -- JSON值 (用于select/multi-select/array类型)
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(task_id, property_def_id),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (property_def_id) REFERENCES task_property_defs(id) ON DELETE CASCADE
);

-- 任务版本表：存储内容的历史版本（用于链式存储）
CREATE TABLE IF NOT EXISTS task_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,                   -- 所属任务ID
    content_hash TEXT NOT NULL,              -- 内容哈希 (SHA-256)
    content TEXT NOT NULL,                   -- 版本内容
    previous_version_hash TEXT,              -- 前一个版本的哈希 (用于链式结构)
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT DEFAULT 'system',        -- 创建者
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX idx_tasks_created_at ON tasks(created_at);
CREATE INDEX idx_tasks_updated_at ON tasks(updated_at);
CREATE INDEX idx_task_property_defs_task_id ON task_property_defs(task_id);
CREATE INDEX idx_task_properties_task_id ON task_properties(task_id);
CREATE INDEX idx_task_versions_task_id ON task_versions(task_id);
CREATE INDEX idx_task_versions_content_hash ON task_versions(content_hash);

-- 触发器：自动更新updated_at时间戳
CREATE TRIGGER IF NOT EXISTS update_tasks_timestamp 
AFTER UPDATE ON tasks
BEGIN
    UPDATE tasks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_task_properties_timestamp 
AFTER UPDATE ON task_properties
BEGIN
    UPDATE task_properties SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- 初始化一些示例数据（可选）
INSERT OR IGNORE INTO tasks (id, name, icon, content) VALUES 
    ('task-1', 'Egonetics 开发计划', '🚀', '# Egonetics 开发计划\n\n## Phase 1-3 已完成\n- [x] Memory 模块\n- [x] Projects/Tasks 系统\n- [x] 富文本编辑器\n\n## 下一步\n- [ ] 链式存储集成\n- [ ] 导出功能'),
    ('task-2', '项目文档模板', '📋', '# 项目文档模板\n\n## 目标\n\n## 进度\n\n## 下一步行动'),
    ('task-3', '周会议记录', '📅', '# 周会议记录\n\n## 日期: \n## 参与者: \n## 议题: ');
