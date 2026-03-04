# Egonetics 开发计划

> 最后更新：2026-03-03

---

## 一、项目愿景

Egonetics = Ego（自我）+ Cybernetics（控制论）

**核心目标**：打造一个人与 AI 协同进化的数字生命系统。记录人和 AI 共同工作的全部过程，找到其中的因果关系，形成可量化、可调控的自我进化路径。

```
Memory  ──┐  (原始记录)
Task    ──┤  (工作过程)  ──► Chronicle（精选生命史）──► Egonetics（自我控制论）
Theory  ──┘  (思想体系)
Agent   ──── (执行层，输出汇入 Memory)
```

**Chronicle 是精选内容库，不是原始流。** 只有用户主动审批的内容才进入 Chronicle。

---

## 二、Chronicle 核心设计

### 2.1 三种入库方式

| 来源 | 触发条件 | 入库后原模块行为 | Chronicle 展示 |
|---|---|---|---|
| **Memory** | 标注 session → 写标题+总结 → 确认入库 | 从 Memory 列表消失 | 标题 + 时间范围，点击展开全文 |
| **Task** | 任务完成/失败/终止 → 写总结 → 确认入库 | 从 Task/Kanban 消失 | 标题 + 结果标签 + 日期，点击展开 |
| **Theory** | 给页面打版本号 → 确认入库 | 仍可见但永久只读，Theory 内显示锁定 | 标题 + 版本号，点击展开（内容快照）|

### 2.2 Milestone（里程碑）

- 用户创建 Milestone，将一段时间内的 Chronicle 条目打包成一个历史节点
- **发布前**：可持续添加条目，条目可编辑
- **发布后**：
  - 所有条目永久锁定（不可编辑）
  - Milestone 在时间轴上显示为一个折叠节点，点击展开
  - 可追加标注（Append-only）：原标注 = V1，新增 = V2，再追加 = V3
  - 未来计划：哈希链加密（当前阶段不做）

### 2.3 Collection（主题集合）

- 用户可自由创建，自定义命名（如"熬出低谷"、"寻找人生意义"、"开发产品"）
- 将多个 Chronicle 条目（task/memory/theory 混合）打包为一个主题包
- 集合可拖拽到任意位置（position_x/position_y）
- **时间线是死的（条目按时间排序），块的位置是灵活的**
- 发布 Milestone 后，归属该 Milestone 的集合同步锁定，不可再编辑
- 锁定后集合仍可在 Chronicle 时间轴中拖拽显示位置（UI 层不影响数据）

### 2.4 Chronicle 时间轴规则

时间轴上三类元素：

1. **已发布的 Milestone 节点**（折叠）→ 点击展开内部条目
2. **Collection 集合块**（可拖拽定位）→ 点击展开内部条目列表
3. **独立条目**（未归入任何 Milestone 或 Collection）

条目只显示标题 + 日期 + 类型图标，点击才展开内容。一旦归入已发布 Milestone，内容锁定，只能追加版本化标注。

---

## 三、架构总览

### 数据库（4库分治）

| 数据库 | 职责 | 状态 |
|---|---|---|
| tasks.db | Tasks + Kanban 看板 | 已完成，需追加 3 个字段 |
| pages.db | Theory 页面 + Blocks 编辑器 | 不动（锁定状态通过查 chronicle_entries 判断）|
| memory.db | 对话记录 + 标注 + Chronicle 精选库 | 重写 |
| agents.db | Agent 定义 + 关系图 + 消息记录 | 新建 |

### 后端结构

```
server/
├── index.js            # 启动 + 注册路由（轻量）
├── db.js               # 4个数据库连接统一管理
├── routes/
│   ├── tasks.js        # /api/tasks + /api/kanban
│   ├── pages.js        # /api/pages + /api/blocks（保留现有逻辑）
│   ├── memory.js       # /api/memory/*
│   ├── agents.js       # /api/agents/*
│   └── chronicle.js    # /api/chronicle/*
└── scripts/
    └── import-jsonl.js # JSONL 解析（供 memory 路由调用）
```

### 前端

| 模块 | 处理方式 |
|---|---|
| KanbanBoard.tsx + TaskPageView.tsx | 完全保留 |
| PageManager 相关组件 | 基本保留，Theory 增加锁定态展示 |
| App.tsx + Sidebar.tsx + 路由 | 重写，清理冗余 |
| Memory 视图 | 重写（渐进加载 + 标注工作流 + 入库操作）|
| Chronicle 视图 | 新建（时间轴 + Milestone 折叠节点）|
| Agent 视图 | 新建（ReactFlow 节点图）|

---

## 四、数据库 Schema

### 4.1 memory.db（完整重写）

```sql
-- 会话（一次完整的 Agent 对话）
CREATE TABLE sessions (
  id                  TEXT PRIMARY KEY,
  agent_name          TEXT NOT NULL,
  agent_type          TEXT NOT NULL,    -- 'claude_code' | 'openclaw' | 'api'
  model               TEXT,
  source_file         TEXT,
  token_input         INTEGER DEFAULT 0,
  token_output        INTEGER DEFAULT 0,
  duration_ms         INTEGER DEFAULT 0,
  started_at          TEXT,
  ended_at            TEXT,
  annotation_title    TEXT,             -- 用户填写的标题（入库前）
  annotation_summary  TEXT,             -- 用户写的总结（入库前）
  chronicle_entry_id  TEXT,             -- 非空 = 已入库
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 对话轮次（一个用户输入 → 完整响应链）
CREATE TABLE rounds (
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
);

-- 执行步骤链
CREATE TABLE steps (
  id          TEXT PRIMARY KEY,
  round_id    TEXT NOT NULL,
  step_num    INTEGER NOT NULL,
  type        TEXT NOT NULL,     -- 'thinking' | 'tool_call' | 'tool_result' | 'response'
  tool_name   TEXT,
  content     TEXT DEFAULT '{}', -- JSON 完整内容
  duration_ms INTEGER DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE
);

-- 用户标注
CREATE TABLE annotations (
  id         TEXT PRIMARY KEY,
  ref_type   TEXT NOT NULL,    -- 'session' | 'round' | 'step'
  ref_id     TEXT NOT NULL,
  type       TEXT NOT NULL,    -- 'tag' | 'note' | 'extract' | 'training_data'
  content    TEXT,
  tags       TEXT DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Chronicle 精选条目
CREATE TABLE chronicle_entries (
  id            TEXT PRIMARY KEY,
  type          TEXT NOT NULL,    -- 'memory' | 'task' | 'theory'
  source_id     TEXT NOT NULL,    -- session_id / task_id / page_id
  title         TEXT NOT NULL,
  summary       TEXT,             -- 用户总结（Memory/Task）
  start_time    TEXT,             -- Memory 条目：起始时间
  end_time      TEXT,             -- Memory 条目：结束时间
  task_outcome  TEXT,             -- Task 条目：'completed'|'failed'|'terminated'
  version_tag   TEXT,             -- Theory 条目：版本号，如 "v1.0"
  content       TEXT,             -- Theory 条目：入库时的内容快照
  milestone_id  TEXT,             -- 所属 Milestone（NULL = 独立条目）
  is_locked     INTEGER DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (milestone_id) REFERENCES chronicle_milestones(id)
);

-- Milestone 节点
CREATE TABLE chronicle_milestones (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  description  TEXT,
  cover_start  TEXT,
  cover_end    TEXT,
  is_published INTEGER DEFAULT 0,
  published_at TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Chronicle 主题集合（用户自定义，可跨类型，可拖拽）
CREATE TABLE chronicle_collections (
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
);

-- 集合与条目多对多
CREATE TABLE chronicle_collection_items (
  id            TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL,
  entry_id      TEXT NOT NULL,
  sort_order    REAL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (collection_id, entry_id),
  FOREIGN KEY (collection_id) REFERENCES chronicle_collections(id) ON DELETE CASCADE,
  FOREIGN KEY (entry_id)      REFERENCES chronicle_entries(id)     ON DELETE CASCADE
);

-- Chronicle 追加标注（V2/V3，锁定后仍可用）
-- V1 = 入库时的原始 summary，V2 起为此表追加
CREATE TABLE chronicle_annotations (
  id         TEXT PRIMARY KEY,
  entry_id   TEXT NOT NULL,
  version    INTEGER NOT NULL,
  content    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (entry_id) REFERENCES chronicle_entries(id)
);

-- 原始事件日志（所有模块行为的完整记录）
CREATE TABLE events (
  id         TEXT PRIMARY KEY,
  type       TEXT NOT NULL,
  source     TEXT NOT NULL,    -- 'memory' | 'task' | 'agent' | 'theory'
  ref_id     TEXT,
  title      TEXT,
  content    TEXT DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 索引
CREATE INDEX idx_sessions_chronicle     ON sessions(chronicle_entry_id);
CREATE INDEX idx_rounds_session_id      ON rounds(session_id);
CREATE INDEX idx_steps_round_id         ON steps(round_id);
CREATE INDEX idx_annotations_ref        ON annotations(ref_type, ref_id);
CREATE INDEX idx_chronicle_type         ON chronicle_entries(type);
CREATE INDEX idx_chronicle_milestone    ON chronicle_entries(milestone_id);
CREATE INDEX idx_chronicle_anno_entry   ON chronicle_annotations(entry_id);
CREATE INDEX idx_events_source_time     ON events(source, created_at);
```

**events.type 清单：**

| type | 含义 |
|---|---|
| memory.session_imported | 导入了一条对话记录 |
| memory.session_annotated | 用户完成标注，待入库 |
| memory.sent_to_chronicle | 正式入库 |
| task.created / updated / completed / failed / terminated | Task 状态变更 |
| task.sent_to_chronicle | Task 入库 |
| theory.versioned / sent_to_chronicle | Theory 版本化并入库 |
| chronicle.milestone_created / published | 里程碑操作 |
| agent.started / output / completed | Agent 生命周期 |

### 4.2 tasks.db（追加 3 个字段）

```sql
ALTER TABLE tasks ADD COLUMN task_outcome       TEXT;   -- 'completed'|'failed'|'terminated'
ALTER TABLE tasks ADD COLUMN task_summary       TEXT;   -- 任务结束时的总结
ALTER TABLE tasks ADD COLUMN chronicle_entry_id TEXT;   -- 非空 = 已入库
```

### 4.3 pages.db（不动）

Theory 页面是否已入库、是否锁定，通过 chronicle_entries 反查，无需修改 pages.db：

```sql
-- 判断某 Theory 页面状态：
SELECT id, is_locked, version_tag
FROM chronicle_entries
WHERE type = 'theory' AND source_id = :pageId
-- 有结果 → 已入库；is_locked=1 → 只读，展示 content 快照
```

### 4.4 agents.db（新建）

```sql
CREATE TABLE agents (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL,          -- 'claude_code' | 'openclaw' | 'api'
  model       TEXT,
  role        TEXT DEFAULT 'worker',  -- 'master' | 'worker'
  description TEXT,
  status      TEXT DEFAULT 'idle',    -- 'idle' | 'running' | 'paused' | 'done'
  position_x  REAL DEFAULT 0,
  position_y  REAL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE agent_relations (
  id           TEXT PRIMARY KEY,
  from_agent   TEXT NOT NULL,
  to_agent     TEXT NOT NULL,
  type         TEXT NOT NULL,    -- 'parallel' | 'sequential' | 'causal'
  condition    TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (from_agent) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY (to_agent)   REFERENCES agents(id) ON DELETE CASCADE
);

CREATE TABLE agent_messages (
  id         TEXT PRIMARY KEY,
  from_id    TEXT,               -- NULL = 来自用户
  to_id      TEXT,               -- NULL = 发给用户
  content    TEXT NOT NULL,
  type       TEXT DEFAULT 'message',  -- 'message' | 'command' | 'output'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## 五、JSONL 解析规则

### 5.1 来源识别

**OpenClaw：**
- 第一条记录 `type === "session"` 且 `cwd` 含 `.openclaw`
- 或存在 `type === "model_change"` 记录
- 或 `message.provider` 为 `deepseek` / `volcengine` / `moonshot`

**Claude Code：**
- 记录含 `isSidechain` + `gitBranch` + 顶层 `sessionId` 字段
- 或顶层 `type` 直接为 `"user"` / `"assistant"` / `"tool"`

### 5.2 OpenClaw 格式解析

记录通过 parentId 构成链，核心是 `type:"message"` 记录：

| message.role | content 类型 | 映射到 step.type |
|---|---|---|
| user | text | 新 Round 开始 |
| assistant | thinking | thinking |
| assistant | toolCall | tool_call（取 name, arguments）|
| assistant | text（stopReason:stop）| response |
| toolResult | text | tool_result |

**Token**：来自 assistant 消息的 `message.usage.input` / `message.usage.output`

**Duration**：相邻两条 assistant 消息间无 user 时的时间差（参考 import_v5.py → calculate_durations）

**Session 元信息**：
- `id` = type:"session" 的 id，或文件名去 .jsonl
- `agent_type` = "openclaw"
- `model` = 第一条 assistant 的 `message.model`
- `started_at` / `ended_at` = 所有 message 记录的最早/最晚 timestamp

### 5.3 Claude Code 格式解析

记录通过 parentUuid 构成链：

| 顶层 type | 映射 |
|---|---|
| "user" | 新 Round 开始（message.content）|
| "assistant" | content 数组：thinking / tool_use / text → 对应 step |
| "tool"（userType:"tool"）| tool_result（取 message.content + message.tool_use_id）|
| 其他 | 忽略 |

**Token**：`message.usage.input_tokens` / `output_tokens` / `cache_*`

**Duration**：`record.durationMs`（assistant 记录顶层字段）

**Session 元信息**：
- `id` = `record.sessionId`
- `agent_type` = "claude_code"
- `model` = 任意 assistant 记录的 `message.model`
- `started_at` / `ended_at` = 最早/最晚的 `record.timestamp`

### 5.4 通用导入流程

```
1. 读取 jsonl → 逐行解析
2. 识别来源（openclaw / claude_code）
3. 提取 session 元信息 → INSERT INTO sessions
4. 按 user 消息划分 Rounds → INSERT INTO rounds
5. 每 Round 内顺序提取 steps → INSERT INTO steps
6. 累计 token/duration → UPDATE sessions
7. 写 events：{type:"memory.session_imported", ref_id:sessionId}
```

---

## 六、API 设计

### Memory API

```
POST  /api/memory/import                         # 导入 jsonl（body: {filePath}）
GET   /api/memory/sessions                       # 分页（过滤已入库的）
GET   /api/memory/sessions/:id
GET   /api/memory/sessions/:id/rounds            # 懒加载
GET   /api/memory/rounds/:id/steps               # 懒加载
PATCH /api/memory/sessions/:id/annotate          # 写标题+总结
POST  /api/memory/sessions/:id/annotations       # 打标签/备注
POST  /api/memory/sessions/:id/send-to-chronicle # 确认入库
```

### Chronicle API

```
GET  /api/chronicle                              # 时间轴（entries + milestones + collections 合并）
GET  /api/chronicle/entries                      # 条目列表（?type= 过滤）
POST /api/chronicle/entries                      # 手动创建（Theory 入库走此）
GET  /api/chronicle/entries/:id                  # 详情 + 全版本标注
POST /api/chronicle/entries/:id/annotations      # 追加标注（V2, V3...）

GET  /api/chronicle/milestones
POST /api/chronicle/milestones                   # 创建 Milestone
PATCH /api/chronicle/milestones/:id              # 编辑（含添加/移除条目）
POST  /api/chronicle/milestones/:id/publish      # 发布 → 锁定所有条目+集合

GET   /api/chronicle/collections                 # 集合列表
POST  /api/chronicle/collections                 # 创建集合（自定义命名）
GET   /api/chronicle/collections/:id             # 集合详情（含条目列表）
PATCH /api/chronicle/collections/:id             # 编辑（名称/位置/归属Milestone）
DELETE /api/chronicle/collections/:id            # 删除（未锁定）
POST  /api/chronicle/collections/:id/items       # 向集合添加条目
DELETE /api/chronicle/collections/:id/items/:entryId  # 从集合移除条目
```

### Tasks API（新增）

```
POST /api/tasks/:id/send-to-chronicle            # Task 入库（写 outcome + summary）
```

### Agents API

```
GET/POST             /api/agents
GET/PATCH/DELETE     /api/agents/:id
GET/POST             /api/agents/relations
DELETE               /api/agents/relations/:id
GET                  /api/agents/:id/messages
POST                 /api/agents/messages
```

---

## 七、前端组件规划

### Memory 视图

```
SessionList（不显示 chronicle_entry_id 非空的）
  → 点击展开 RoundList（懒加载）
    → 点击展开 StepChain（懒加载）
      ├── thinking    折叠展示推理过程
      ├── tool_call   工具名 + 参数
      ├── tool_result 结果（长文本自动折叠）
      └── response    最终输出

AnnotationPanel（侧边）
  ├── 对任意 step/round 打标签/备注/标记训练数据
  └── 「整理为 Chronicle 条目」
        ├── 填标题 + 写总结
        └── 确认入库 → session 消失，进入 Chronicle
```

### Chronicle 视图

```
时间轴（上新下旧）

  [已发布 Milestone]  → 点击展开
    └── 内部 entry：标题 + 类型图标 + 日期 → 点击展开内容
          └── 锁定，显示 V1，可追加 V2/V3

  [独立条目]
    ├── Memory：标题 + 时间范围
    ├── Task：标题 + outcome 标签
    └── Theory：标题 + 版本号

操作区
  ├── 创建 Milestone → 选择条目打包
  └── 发布 → 锁定，不可撤销
```

### Theory 视图（在 PageManager 基础上增加）

```
页面列表
  ├── 未入库：正常可编辑
  └── 已入库：锁定图标 + 版本号，内容只读

工具栏新增「入库」按钮
  ├── 填版本号（如 "v1.0 - 核心价值观确立"）
  └── 确认 → content 快照存入 chronicle_entries，页面变只读
```

### Agent 视图（ReactFlow）

```
GraphEditor
  ├── 节点：master（金色）/ worker（蓝色）
  ├── 边：样式区分 parallel / sequential / causal
  ├── 拖拽 → 保存坐标
  └── 双击 → AgentDetail
        ├── 基本信息
        ├── MessageFeed
        └── 关联的 Memory Sessions
```

---

## 八、开发阶段

### Phase 0 — 后端重构 ✅ 已完成

- [x] 新建 `server/db.js`，统一 4 个数据库连接（memory/tasks/pages/agents）
- [x] 路由拆分：`routes/tasks.js`（tasks+kanban）、`routes/pages.js`（pages+blocks）
- [x] 新建 `routes/memory.js`（旧接口兼容 + 新 memory API 骨架）
- [x] 新建 `routes/chronicle.js`（完整 Chronicle + Milestone + Collection API）
- [x] 新建 `routes/agents.js`（Agent CRUD + 关系 + 消息 API）
- [x] 初始化新 `memory.db` schema（含 chronicle_collections 新表）
- [x] 初始化 `agents.db` schema
- [x] `tasks.db` 追加 3 个 Chronicle 字段（task_outcome/task_summary/chronicle_entry_id）
- [x] `index.js` 精简为 30 行，仅保留启动和路由注册
- [x] 新建 `server/init-memory-db.js` + `server/init-agents-db.js`

### Phase 1 — Memory 重写

- [ ] scripts/import-jsonl.js：OpenClaw + Claude Code 双格式解析
- [ ] routes/memory.js：导入 + 查询 + 标注 + 入库接口
- [ ] 前端 Memory 视图：渐进加载 + 标注 + 入库操作

### Phase 2 — Chronicle

- [ ] routes/chronicle.js：条目 CRUD + Milestone + 发布锁定
- [ ] 前端 Chronicle 视图：时间轴 + Milestone + 追加标注
- [ ] Theory：入库操作 + 锁定态

### Phase 3 — Agents V1

- [ ] routes/agents.js：CRUD + 关系 + 消息
- [ ] 前端：ReactFlow 节点图 + AgentDetail

### Phase 4+ — 延后

- [ ] Chronicle 哈希链加密
- [ ] Agent 接入真实进程
- [ ] 内容 LLM 自动压缩
- [ ] /egonetics、/blog

---

## 九、不动的代码

| 文件/模块 | 说明 |
|---|---|
| KanbanBoard.tsx + TaskPageView.tsx | 完全保留 |
| PageManager 及相关组件 | 完全保留（Theory 只在外层加锁定状态）|
| apiClient.ts | Pages API 客户端 |
| tasks_schema.sql | 只追加字段，不重建 |
| pages_schema.sql + pages.db | 完全不动 |

---

## 十、技术选型

| 技术 | 用途 |
|---|---|
| ReactFlow | Agent 节点图编辑器 |
| SQLite3 (Node) | 后端数据库 |
| Express.js | 后端框架 |
| Zustand | 前端状态管理（按模块拆 store）|
| Vite Proxy | /api → localhost:3002，不硬编码端口 |
