# V2 Bug Fix 执行文档

> **范围**：三个模块全量重写。按 A→B→C 独立交付，每个 Phase 可单独验证。
> **不动**：PageManager.tsx、BlockEditor.tsx、apiClient.ts（Theory 版）、AgentsView.tsx、pages.db 结构

---

## Phase A：Task 看板重写（优先级最高，最独立）

##  严格执行注意，坚决避免重蹈覆辙：
注意如下bug从未改对过：

从未成功1： 目前最大问题是 下面功能从来没实现过，是后端问题还是前端问题。
点击卡片从不跳转，也无法返回
从未成功2： 拖拽同时稳定支持换行和换列，并且刷新后持久化保存

严格死守的原则：1 如果一个技术方案可以用其他笨办法平替，就不用复杂麻烦方案实现
比如：
（1）KanbanBoard拖拽不妨用最简单方式实现，只同列拖拽，任务状态 编辑保存改变；跨列和换行逻辑只实现一个，用最简单最稳的技术。
（2）KanbanBoard里task从来点不进去详情页，那么就新建完task，只保留task单机进详情页的功能，无任何其他点击弹出、编辑功能，只加个删除按钮就完。点击进详情页里面该 标题、任务人、日期等字段；不把所有功能怼在 一个页面

拖拽功能不确定是否是前端问题，但是前后端联调巨大问题，后端接口也巨大问题，请严肃考虑设计逻辑。一个非常简单的任务跳转功能，不要做复杂了！！！
前后端稳定只支持同列或同行拖拽，编辑功能全部放到详情页，点击task只跳转不编辑 >> 有bug

### 目标
- 拖拽稳定：横向跨列 + 纵向排序，每次松手立即持久化
- Task 卡片点击 → 跳转 `/tasks/:id`（当前是弹 modal）
- TaskDetailPage 字段与 API 实际返回对齐

### 改动文件

| 文件 | 规模 |
|------|------|
| `src/components/taskBoard/KanbanBoard.tsx` | 完整重写 |
| `src/components/taskBoard/TaskDetailPage.tsx` | 小修（字段名 + save 方法） |
| 后端路由 | **不动**（PATCH/GET /kanban/tasks/:id 已就绪） |

### KanbanBoard.tsx 重写要点

**数据层**
- 启动：`GET /api/kanban` → 拿 `{ columns, tasks }`，本地合并成 `Column[]`
- 拖拽落定：`PATCH /api/kanban/tasks/:id` 只更新 `{ columnId, sortOrder }`（不 PUT 全量）
- 列序调整（新增/删列）：`PUT /api/kanban/columns`（当前逻辑保留）

**拖拽实现**（沿用根 `KanbanBoard.tsx` 的 Pointer Events 方案，已验证稳定）
- `pointerdown` on drag handle → 5px 阈值才激活，防误触
- `colsRef = useRef(columns)` 解决 closure stale state 问题（关键修复点）
- ghost 元素跟随鼠标，蓝色 InsertLine 显示落点
- `pointerup` → 计算新 `columnId + sortOrder` → 立即更新本地状态 → 异步 PATCH


**导航修复**
- 卡片 onClick（非 drag handle）→ `navigate('/tasks/' + task.id)`
- 移除旧的 TaskModal 内联编辑弹窗

**错误处理**
- fetch 失败时 toast 提示（不静默失败）
- 拖拽 PATCH 失败时回滚本地状态

### TaskDetailPage.tsx 修复要点

问题：`apiClient.save()` 内部调 PUT，但后端 `/api/kanban/tasks/:id` 只有 PATCH，且字段名不对（API 返回 `start_date`，前端用 `startDate`）。

修复：
- `handleEdit()` 直接 `fetch PATCH /api/kanban/tasks/:id`（不走 apiClient）
- 字段映射：`start_date ↔ startDate`, `due_date ↔ dueDate`, `column_id ↔ columnId`

### 测试验证
```
✓ 卡片拖到同列不同位置 → 刷新后顺序保持
✓ 卡片拖到另一列 → column_id + sort_order 更新
✓ 点击卡片 → 跳转 /tasks/task-1 → 显示详情
✓ 详情页编辑保存 → 返回看板数据已更新
✓ 详情页删除 → 返回看板，卡片消失
```

---

## Phase B：Memory 重设计（NotionBlock 标注面板）
思路非常可以，执行！

### 目标
全新两栏布局：
- **右侧**：Session 库（可搜索，按日期分组，显示标题/Agent 工具，标注可见）
- **左侧/主区**：标注面板（自定义 Block 板）
- 从 Session 库拖 session → 落入标注面板 → 生成 `session_ref` 块
- Session_ref 块：可展开显示完整轮次/步骤
- 同时修复 bug 1-4

### 后端变更

**`server/init-memory-db.js`** — 追加两张表（不删旧表）：
```sql
CREATE TABLE IF NOT EXISTS memory_boards (
  id      TEXT PRIMARY KEY,
  title   TEXT NOT NULL DEFAULT '标注面板',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS memory_board_blocks (
  id       TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES memory_boards(id) ON DELETE CASCADE,
  type     TEXT NOT NULL,   -- 'heading'|'text'|'session_ref'
  content  TEXT,            -- JSON: {text} or {session_id, session_title, agent_type}
  position REAL NOT NULL,   -- 浮点排序位（positionBetween 算法）
  created_at TEXT DEFAULT (datetime('now'))
);
```

**`server/routes/memory.js`** — 新增 5 个端点：
```
POST   /memory/boards                { title } → 201 { id }
GET    /memory/boards                → { boards[] }
GET    /memory/boards/:id            → { board + blocks[] }
PATCH  /memory/boards/:id            body: { title?, blocks? }（全量替换 blocks）
DELETE /memory/boards/:id
```

**Bug 1 排查**：`GET /memory/sessions/:id/rounds` 返回完整 `user_input` 字段（TEXT 类型不截断，确认无 LIMIT 截断）。

**Bug 4 修复**：前端展开 session 时调 `GET /memory/sessions/:id/annotations`（已有端点，前端未调用）。

### 前端变更

**`src/components/MemoryView.tsx`** — 完整重写

#### 布局
```
┌─────────────────────────────────────────────────────────┐
│  Memory                              [+ 新建面板]        │
├─────────────────────────┬───────────────────────────────┤
│  标注面板（左 60%）      │  Session 库（右 40%）         │
├─────────────────────────┤                               │
│  [面板A] [面板B] [+]    │  [搜索...]                    │
│  ─────────────────────  │  ── 2026-03-01 ──             │
│  # Heading block        │  [🤖 Claude Code - 09:32]     │
│  文本 block...          │    2轮 · 1.2k tok  [拖→]     │
│  📎 Session A           │  [⚡ OpenClaw - 08:15]        │
│     Claude Code · 3轮   │    5轮 · 3.4k tok  [拖→]     │
│     [▶ 展开轮次]        │                               │
│                         │  ── 2026-02-28 ──             │
│  [+ 添加块]             │  ...                          │
│                         │  [加载更多]                   │
└─────────────────────────┴───────────────────────────────┘
```

#### Block 类型（标注面板）

| 类型 | 渲染 | 存储 content |
|------|------|-------------|
| `heading` | 大字标题，contenteditable | `{ text }` |
| `text` | 多行文本，contenteditable | `{ text }` |
| `session_ref` | Session 引用卡（见下） | `{ session_id, session_title, agent_type }` |

**session_ref 块展示**：
```
📎 [🤖] session_title                [✕]
   claude_code · 2026-03-01 · 3轮 · 1.2k tokens
   [▶ 展开轮次]
   ─ 展开后：轮次列表，每轮显示 user_input + steps（懒加载）
```

**拖拽**：
- 右侧 Session 卡：`draggable + onDragStart` 携带 `{ session_id, session_title, agent_type }`
- 左侧面板：`onDragOver + onDrop` → 在光标处插入 session_ref 块
- 块内排序：Pointer Events（同 KanbanBoard 方案）

**持久化**：块变更 debounce 800ms → `PATCH /memory/boards/:id`

#### Session 库修复（右侧面板）

**Bug 1（显示不完整）**：
- `user_input` 字段完整显示，不设 maxLength 截断
- Step content 展开显示（tool_result 不折叠）

**Bug 2（日期分类）**：
- 按 `started_at` 日期分组，确认跨日期 session 正确归类

**Bug 3（标题/工具名）**：
- 显示：`annotation_title` ?? `agent_name` ?? session_id 前 8 位
- Agent badge：`claude_code` = 🤖，`openclaw` = ⚡，其他 = 🔧
- 双击标题 → 内联编辑 → `PATCH /memory/sessions/:id/annotate`

**Bug 4（标注无法显示）**：
- Session 展开时调 `GET /memory/sessions/:id/annotations`
- 标注列表显示在 session 头部下方

### 测试验证
```
✓ 新建面板 → 添加 heading/text/session_ref 块
✓ 右侧拖 session → 左侧生成 session_ref 块
✓ session_ref 展开 → 完整 user_input + steps 可见
✓ session 标题双击可编辑
✓ session 展开显示已有标注
✓ 面板 blocks 刷新后不丢失（持久化）
```

---

## Phase C：Chronicle 重设计（时间轴 + Workflow 视图）


条目详情抽屉（右滑出） 来显示 所有 task/memory/theory 是很好的想法，这个优先级最高！！！
在 Timeline 视图和 Workflow 视图里面点击每个 task/memory/theory都要用好看清楚的页面显示出，很重要

### 目标
- 单页统一视图（废弃三 Tab 分离）
- Timeline 视图：里程碑为锚点，点击展开，集合内嵌显示
- Workflow 视图：SVG 画布，集合为节点，箭头表逻辑顺序(g工具尽量多，类似的xmind组件可以添加，丰富视图可视化内容)
- 集合支持嵌套（parent_id），有颜色/标题/描述（编辑用 NotionBlock）
- 右侧库：未分配 task/memory/theory 可拖入集合
- 条目点击 → 右侧抽屉展示 source 内容 + 标注
- 发布后锁定：UI 隐藏 CRUD 按钮，显示 🔒（但依然可以展开阅读，追加评论但里程碑版本标签的评论，不是完全看不了）

### 后端变更

**新建 `server/scripts/migrate-chronicle.js`**（运行一次）：
```sql
-- chronicle_collections 扩展字段
ALTER TABLE chronicle_collections ADD COLUMN color TEXT DEFAULT '#6366f1';
ALTER TABLE chronicle_collections ADD COLUMN content TEXT;
ALTER TABLE chronicle_collections ADD COLUMN parent_id TEXT
  REFERENCES chronicle_collections(id);

-- 集合间连线（Workflow 箭头）
CREATE TABLE IF NOT EXISTS chronicle_collection_links (
  id      TEXT PRIMARY KEY,
  from_id TEXT NOT NULL REFERENCES chronicle_collections(id) ON DELETE CASCADE,
  to_id   TEXT NOT NULL REFERENCES chronicle_collections(id) ON DELETE CASCADE,
  label   TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

**`server/routes/chronicle.js`** — 新增 / 修复：

| 端点 | 说明 |
|------|------|
| `DELETE /chronicle/entries/:id` | 仅当 `!is_locked` |
| `DELETE /chronicle/milestones/:id` | 仅当 `!is_published`，清除 entry 关联 |
| `PATCH /chronicle/collections/:id` | 补充 color/content/parent_id 字段 |
| `POST /chronicle/collection-links` | `{ from_id, to_id, label }` |
| `GET /chronicle/collection-links` | 返回全部连线 |
| `DELETE /chronicle/collection-links/:id` | 删除连线 |

**`GET /chronicle`** 扩展：同时返回 `collection_links`

### 前端变更

**`src/components/ChronicleView.tsx`** — 完整重写

#### 视图 1：Timeline（默认）

```
[● Timeline] [○ Workflow]          [+ 集合] [+ 里程碑]

── V1 · 2026-01 · 已发布 🔒 ────────────────────────
  ▼ 熬出低谷（蓝色左边框）
    ├── [task] Egonetics Alpha
    ├── [memory] 2025-12-01 对话
    └── [theory 🔒] 系统设计 v1.0
      [展开子集合...]

── V2 · 2026-02 · 未发布 ──────────────────────────
  ▼ 产品化探索（紫色）
    ├── [task] xxx
    └── 📦 子集合: UI重构（嵌套）
          └── [task] yyy
  [发布里程碑]  [编辑]  [删除]

── 散条目（未归入里程碑）────────────────────────────
  [task] 待处理 ...   [memory] 未归档 ...
```

集合卡：彩色左边框 + 标题 + 描述 + 条目行，锁定后隐藏编辑/删除，但依然可以展开阅读，追加评论但里程碑版本标签的评论，

#### 视图 2：Workflow（SVG Canvas）

参照 `AgentsView.tsx` 实现：
- 集合 = 彩色矩形节点（可拖拽大小、根据内容自适应）
- 条目 = 集合内的的memory、task/theory标题 用不同颜色块显示
- 节点拖拽 → `PATCH position_x/y`
- 连线：`chronicle_collection_links`，带箭头
- 「连线模式」按钮 → 点源 → 点目标 → 弹类型/标签输入
- 点连线 → 删除确认

#### 右侧库面板

```
[Tasks] [Memory] [Theory]
─────────────────────────
待分配条目（未归入任何集合）：
  [📋 Task 名称]        [拖→]
  [🧠 Memory 标题]      [拖→]
  [📖 Theory v1.0 🔒]   [拖→]
```

拖入集合 → `POST /chronicle/collections/:id/items`

#### 条目详情抽屉（右滑出）

点击集合中任意条目 → 右侧抽屉：

| source 类型 | 调用接口 | 展示内容 |
|-------------|---------|---------|
| task | `GET /api/kanban/tasks/:id` | 优先级/日期/描述 |
| memory | `GET /memory/sessions/:id` + rounds | 折叠展示轮次 |
| theory | `GET /api/pages/:id/blocks` | 渲染文本块 |

- 标注区：V1 summary + V2/V3 追加标注
- 未锁定时可追加标注（`POST /chronicle/entries/:id/annotations`）

### 测试验证
```
✓ Timeline：里程碑展开/折叠
✓ 集合条目正确渲染，颜色区分
✓ 发布后 UI 禁止 CRUD，显示 🔒
✓ 未锁定时删除条目/里程碑生效
✓ Workflow：节点拖拽位置刷新后保持
✓ Workflow：连线创建/删除
✓ 右侧库拖条目入集合
✓ 条目详情抽屉显示 source 内容
```

---

## 执行顺序总结

```
Phase A (Task 看板)   → 独立验证 → 约 1 天
Phase B (Memory)      → 独立验证 → 约 2 天
Phase C (Chronicle)   → 独立验证 → 约 2-3 天
```

## 风险点

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| Session_ref 不扩展 BlockEditor，只在 MemoryBoard 实现 | Memory/Chronicle 各自维护 | Phase B 后评估是否统一编辑器 |
| ALTER TABLE 可能因已有列报错 | Phase C 迁移脚本失败 | 用 `IF NOT EXISTS` 或 catch 忽略 duplicate column |
| Workflow SVG 复杂度高 | Phase C 工期超预期 | 先交 Timeline，Workflow 降优先级 |
| A/B/C 后端改动顺序 | DB 状态不一致 | A 不动后端；B 只加新表；C 跑迁移脚本 |



## 核心原则
NotionBlock编辑块要大量复用，大量使用点击block块进入NotionBlock编辑的功能，大量使用 NotionBlock块拖动的功能。 但是后端按照模块低耦合存储，走不同后端接口。
chronicle集合又是能兼容 集合和 task，memory，theory块的数据结构。