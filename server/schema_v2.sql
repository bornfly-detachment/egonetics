-- Egonetics Memory 模块数据库Schema v2
-- 支持完整执行链和标注功能

-- 会话表：存储OpenClaw会话的元数据
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,                     -- 会话ID (OpenClaw session ID)
    created_at TIMESTAMP NOT NULL,           -- 会话创建时间
    updated_at TIMESTAMP NOT NULL,           -- 最后更新时间
    title TEXT,                              -- 会话标题（可自动生成）
    summary TEXT,                            -- 会话摘要（可自动生成）
    source_file TEXT                         -- 原始JSONL文件路径
);

-- 消息表：存储JSONL中的原始消息（包括所有类型）
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,                     -- 消息ID (OpenClaw message ID)
    session_id TEXT NOT NULL,                -- 所属会话ID
    parent_id TEXT,                          -- 父消息ID (用于消息链)
    timestamp TIMESTAMP NOT NULL,            -- 消息时间戳
    role TEXT,                               -- 角色: 'user' | 'assistant' | 'tool' | 'system'
    message_type TEXT NOT NULL,              -- 消息类型: 'message' | 'thinking' | 'tool_call' | 'tool_result' | 'system'
    raw_content TEXT,                        -- 原始JSON内容（用于调试）
    is_final_output BOOLEAN DEFAULT 0,       -- 是否为最终输出消息
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES messages(id) ON DELETE SET NULL
);

-- 消息内容块表：存储消息中的各个部分（thinking, tool_call, text等）
CREATE TABLE IF NOT EXISTS message_parts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id TEXT NOT NULL,                -- 所属消息ID
    part_type TEXT NOT NULL,                 -- 内容块类型: 'thinking' | 'tool_call' | 'tool_result' | 'text' | 'system'
    content TEXT NOT NULL,                   -- 内容
    tool_name TEXT,                          -- 工具名称（如果是tool_call/tool_result）
    tool_call_id TEXT,                       -- tool_call ID（用于关联call和result）
    sequence INTEGER NOT NULL,               -- 在消息中的顺序
    is_collapsible BOOLEAN DEFAULT 1,        -- 是否可折叠（默认tool_call/tool_result可折叠）
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

-- 分类表：三级分类系统
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level INTEGER NOT NULL CHECK (level IN (1, 2, 3)),  -- 分类级别: 1-一级, 2-二级, 3-三级标签
    name TEXT NOT NULL,                                 -- 分类名称
    parent_id INTEGER,                                  -- 父分类ID (用于层级关系)
    description TEXT,                                   -- 分类描述
    is_predefined BOOLEAN DEFAULT 0,                    -- 是否为预定义分类 (1-预定义, 0-用户自定义)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, level, parent_id),
    FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- 消息-分类关联表：多对多关系
CREATE TABLE IF NOT EXISTS message_categories (
    message_id TEXT NOT NULL,
    category_id INTEGER NOT NULL,
    PRIMARY KEY (message_id, category_id),
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- 思考标注表：用户对thinking部分的评论和修改
CREATE TABLE IF NOT EXISTS thinking_annotations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_part_id INTEGER NOT NULL,        -- 对应的message_parts记录ID
    user_comment TEXT,                       -- 用户评论
    suggested_revision TEXT,                 -- 建议修改
    quality_score INTEGER DEFAULT 0,         -- 质量评分 0-5分
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (message_part_id) REFERENCES message_parts(id) ON DELETE CASCADE
);

-- 输出反馈表：用户对最终输出结果的反馈
CREATE TABLE IF NOT EXISTS output_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id TEXT NOT NULL,                -- 最终输出消息ID
    overall_feedback TEXT,                   -- 整体反馈
    correctness_score INTEGER DEFAULT 0,     -- 正确性评分 0-5分
    helpfulness_score INTEGER DEFAULT 0,     -- 有帮助程度评分 0-5分
    clarity_score INTEGER DEFAULT 0,         -- 清晰度评分 0-5分
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_parent_id ON messages(parent_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(role);
CREATE INDEX IF NOT EXISTS idx_messages_is_final_output ON messages(is_final_output);
CREATE INDEX IF NOT EXISTS idx_message_parts_message_id ON message_parts(message_id);
CREATE INDEX IF NOT EXISTS idx_message_parts_part_type ON message_parts(part_type);
CREATE INDEX IF NOT EXISTS idx_message_parts_tool_call_id ON message_parts(tool_call_id);
CREATE INDEX IF NOT EXISTS idx_message_parts_is_collapsible ON message_parts(is_collapsible);
CREATE INDEX IF NOT EXISTS idx_categories_level ON categories(level);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_message_categories_message_id ON message_categories(message_id);
CREATE INDEX IF NOT EXISTS idx_message_categories_category_id ON message_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_thinking_annotations_message_part_id ON thinking_annotations(message_part_id);
CREATE INDEX IF NOT EXISTS idx_output_feedback_message_id ON output_feedback(message_id);

-- 预定义一级分类 (level=1)
INSERT OR IGNORE INTO categories (level, name, description, is_predefined) VALUES
(1, '聊人生', '与工作无关，理想、梦想、信念、思想', 1),
(1, '情感', '吃喝玩乐、情绪价值、讲故事、娱乐、情绪波动时的对话', 1),
(1, '工作', '职业角色扮演，需要解决问题且需要外部系统反馈', 1);

-- 预定义二级分类 (level=2, parent_id对应一级分类的id)
-- 注意：需要先获取一级分类的id，这里使用子查询
INSERT OR IGNORE INTO categories (level, name, parent_id, description, is_predefined) VALUES
(2, '运维问题', (SELECT id FROM categories WHERE level=1 AND name='工作'), '服务器、网络、部署、监控等运维相关工作', 1),
(2, '前端开发', (SELECT id FROM categories WHERE level=1 AND name='工作'), '用户界面、交互设计、前端框架开发', 1),
(2, '后端开发', (SELECT id FROM categories WHERE level=1 AND name='工作'), '服务器端、API、数据库、业务逻辑开发', 1),
(2, '需求分析（产品角色）', (SELECT id FROM categories WHERE level=1 AND name='工作'), '产品需求分析、用户调研、功能设计', 1),
(2, '战略问题（CTO角色）', (SELECT id FROM categories WHERE level=1 AND name='工作'), '技术战略、架构决策、团队管理', 1),
(2, '计划及资源问题（项目经理角色）', (SELECT id FROM categories WHERE level=1 AND name='工作'), '项目规划、资源分配、进度管理', 1);

-- 创建视图：方便查询带分类信息和内容块的消息
CREATE VIEW IF NOT EXISTS message_with_details AS
SELECT 
    m.id as message_id,
    m.session_id,
    m.role,
    m.message_type,
    m.timestamp,
    m.is_final_output,
    GROUP_CONCAT(DISTINCT 
        CASE 
            WHEN c.level = 1 THEN c.name
            ELSE NULL
        END
    ) as level1_categories,
    GROUP_CONCAT(DISTINCT 
        CASE 
            WHEN c.level = 2 THEN c.name
            ELSE NULL
        END
    ) as level2_categories,
    GROUP_CONCAT(DISTINCT 
        CASE 
            WHEN c.level = 3 THEN c.name
            ELSE NULL
        END
    ) as level3_tags,
    COUNT(DISTINCT mp.id) as part_count,
    SUM(CASE WHEN mp.part_type = 'thinking' THEN 1 ELSE 0 END) as thinking_count,
    SUM(CASE WHEN mp.part_type = 'tool_call' THEN 1 ELSE 0 END) as tool_call_count,
    SUM(CASE WHEN mp.part_type = 'tool_result' THEN 1 ELSE 0 END) as tool_result_count
FROM messages m
LEFT JOIN message_categories mc ON m.id = mc.message_id
LEFT JOIN categories c ON mc.category_id = c.id
LEFT JOIN message_parts mp ON m.id = mp.message_id
GROUP BY m.id;

-- 创建视图：查询可标注的thinking部分
CREATE VIEW IF NOT EXISTS thinkings_for_annotation AS
SELECT 
    mp.id as part_id,
    mp.message_id,
    mp.content as thinking_content,
    mp.sequence,
    m.role,
    m.timestamp,
    ta.user_comment,
    ta.suggested_revision,
    ta.quality_score,
    ta.updated_at as last_annotation_time
FROM message_parts mp
JOIN messages m ON mp.message_id = m.id
LEFT JOIN thinking_annotations ta ON mp.id = ta.message_part_id
WHERE mp.part_type = 'thinking'
ORDER BY m.timestamp, mp.sequence;