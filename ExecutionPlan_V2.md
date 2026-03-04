# V2 Bug Fix 最终执行方案

> 基于 BugFixV2.md + 用户逐条确认。按 Phase 0 → A → B → C 顺序执行，每个 Phase 独立可验证。

---

## 核心架构原则（贯穿全部 Phase）

**BlockEditor.tsx 通用化是基础工程，优先于其他所有功能。**

### BlockEditor 权限模式扩展

为 BlockEditor 增加可选 `permissions` prop，默认全开（向后兼容），不破坏现有用法：

```typescript
interface BlockPermissions {
  canEdit: boolean      // 可编辑文本内容（默认 true）
  canDelete: boolean    // 可删除块（默认 true）
  canAdd: boolean       // 可新增块（默认 true）
  canReorder: boolean   // 可拖拽排序（默认 true）
}

// BlockEditor 新增 prop:
permissions?: Partial<BlockPermissions>  // 未传 = 全部 true
```

**各场景权限配置：**

| 场景 | canEdit | canDelete | canAdd | canReorder |
|------|---------|-----------|--------|------------|
| Theory 页面编辑（现状） | ✓ | ✓ | ✓ | ✓ |
| Chronicle 已发布条目内容 | ✗ | ✗ | ✗ | ✗ |
| Chronicle 标注块（新建） | ✓ | ✓ | ✓ | ✓ |
| Memory 标注面板的 session_ref 块 | ✗ | ✓ | ✗ | ✓ |
| Memory 标注面板的 text/heading 块 | ✓ | ✓ | ✓ | ✓ |
| Chronicle 抽屉中 task/memory/theory 内容 | ✗ | ✗ | ✗ | ✓ |

**实现要点：**
- `readonly` 模式：`contentEditable=false`，隐藏 "/" 插入菜单，隐藏 block 操作按钮
- `canDelete=false`：隐藏删除按钮
- `canAdd=false`：隐藏「+ 添加块」按钮，禁用 Enter 新建
- `canReorder=false`：隐藏拖拽手柄

**改动文件**：`src/components/BlockEditor.tsx`（最小化改动，只加 permissions 传递逻辑）

---

## Phase 0：BlockEditor 权限通用化（前置基础）

**改动文件**：`src/components/BlockEditor.tsx`

**步骤**：
1. 在 `BlockEditorProps` 中增加 `permissions?: Partial<BlockPermissions>`
2. 内部 `merge` 默认值：`const perm = { canEdit: true, canDelete: true, canAdd: true, canReorder: true, ...permissions }`
3. 各渲染位置按 `perm.*` 控制 UI 显示
4. 现有调用方不传 permissions → 行为完全不变

**验证**：现有 Theory 页面功能不受影响

---

## Phase A：Task 看板重写

### 设计原则（用户强调）

> 从来没实现成功过：①卡片点击跳转 ②拖拽稳定持久化。
> 宁可用笨办法，不做复杂方案。

### 简化决策
- **拖拽**：只做同列垂直排序（最简单最稳），跨列改状态走详情页
- **卡片**：点击只跳转 `/tasks/:id`，hover 只显示删除按钮，无弹窗无内联编辑
- **详情页**：头部属性栏（状态下拉 + 标题 + 日期 + 负责人，均可编辑），下方内容区

### 改动文件

| 文件 | 规模 |
|------|------|
| `src/components/taskBoard/KanbanBoard.tsx` | 完整重写 |
| `src/components/taskBoard/TaskDetailPage.tsx` | 中改（加属性栏 + 状态下拉） |
| `src/components/taskBoard/apiClient.ts` | 已修复（/api 代理） |
| 后端 | 不动（PATCH /api/kanban/tasks/:id 已就绪） |

### KanbanBoard.tsx 重写

**数据层**：
- `GET /api/kanban` → `{ columns, tasks }` → 本地合并为 `Column[]`
- 排序落定：`PATCH /api/kanban/tasks/:id { sortOrder }` 只更新排序
- 列管理（新增/删列）：`PUT /api/kanban/columns`

**拖拽（同列排序，Pointer Events）**：
- `pointerdown` on drag handle（`[data-handle]`）→ 5px 阈值激活
- `colsRef = useRef(columns)` 解决 closure stale 问题
- ghost 元素 + 蓝色 InsertLine 显示落点
- `pointerup` → 更新本地 sortOrder → 异步 `PATCH /api/kanban/tasks/:id`
- PATCH 失败 → 回滚本地状态 + toast 提示

**卡片行为**：
- `onClick`（非 handle）→ `navigate('/tasks/' + task.id)`
- `hover` → 右上角出现删除按钮 → `DELETE /api/kanban/tasks/:id` → 从本地移除

### TaskDetailPage.tsx 改动

**头部属性栏**（内联编辑，不弹 modal）：
```
[icon] [标题 - 点击编辑]
状态: [planned▾]  优先级: [medium▾]  负责人: [__]  开始: [日期]  截止: [日期]
```

- 状态下拉：列出所有 `column.id + column.label`（从 `GET /api/kanban` 取）
- 字段变更 → 立即 `PATCH /api/kanban/tasks/:id` 对应字段
- 字段映射：`start_date↔startDate`, `due_date↔dueDate`, `column_id↔columnId`

**验证**：
```
✓ 同列卡片拖拽 → 刷新后排序保持
✓ 点击卡片 → 跳转详情页（不弹窗）
✓ 详情页状态下拉改列 → 看板列更新
✓ 详情页其他字段编辑保存
✓ 看板删除按钮 → 卡片消失
```

---

## Phase B：Memory 重设计（NotionBlock 标注面板）

**Phase B 用户批注**：思路非常可以，执行！

### 后端变更

**`server/init-memory-db.js`** — 追加两张表（不删旧表）：
```sql
CREATE TABLE IF NOT EXISTS memory_boards (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL DEFAULT '标注面板',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS memory_board_blocks (
  id       TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES memory_boards(id) ON DELETE CASCADE,
  type     TEXT NOT NULL,   -- 'heading'|'text'|'session_ref'
  content  TEXT,            -- JSON: {text} or {session_id, session_title, agent_type}
  position REAL NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
```

**`server/routes/memory.js`** — 新增端点：
```
POST   /memory/boards            { title } → 201 { id }
GET    /memory/boards            → { boards[] }
GET    /memory/boards/:id        → { board, blocks[] }
PATCH  /memory/boards/:id        { title?, blocks? }（全量替换 blocks）
DELETE /memory/boards/:id
```

### 前端变更

**`src/components/MemoryView.tsx`** — 完整重写，布局：
```
┌─────────────────────────────────────────────────────────┐
│  Memory                              [+ 新建面板]        │
├─────────────────────────┬───────────────────────────────┤
│  标注面板（左 60%）      │  Session 库（右 40%）         │
│  [面板A][面板B][+]      │  [搜索...]                    │
│  ─────────────────────  │  ── 2026-03-01 ──             │
│  # Heading              │  [🤖 Claude Code 09:32 拖→]  │
│  文本 block...          │    2轮 · 1.2k tok             │
│  📎 Session A [只读]    │  [⚡ OpenClaw 08:15 拖→]     │
│     claude · 3轮        │    5轮 · 3.4k tok             │
│     [▶ 展开轮次]        │  ── 2026-02-28 ──             │
│  [+ 添加块]             │  ...  [加载更多]              │
└─────────────────────────┴───────────────────────────────┘
```

**Block 类型与权限**：

| 块类型 | 渲染 | 权限 |
|--------|------|------|
| `heading` | 大字标题 | `canEdit+canDelete+canAdd` |
| `text` | 多行文本 | `canEdit+canDelete+canAdd` |
| `session_ref` | Session 引用卡 | `canDelete` only（只读内容） |

`session_ref` 块使用 BlockEditor 的只读模式渲染 session 内容，可删除（从面板移除引用）。

**拖拽**：
- Session 卡：`draggable + onDragStart` 携带 `{ session_id, session_title, agent_type }`
- 面板落区：`onDragOver + onDrop` → 插入 session_ref 块
- 块内排序：Pointer Events

**Bug 修复**：
- Bug 1：`user_input` 完整显示，step content 展开不截断
- Bug 2：按 `started_at` 日期分组
- Bug 3：标题显示 `annotation_title ?? agent_name ?? id前8位` + agent badge；双击编辑 → `PATCH /memory/sessions/:id/annotate`
- Bug 4：session 展开时调 `GET /memory/sessions/:id/annotations` 展示

**验证**：
```
✓ 新建面板 → 添加 heading/text/session_ref 块
✓ 右侧拖 session → 生成只读 session_ref 块
✓ session_ref 展开 → 完整 user_input + steps
✓ session 标题双击可编辑
✓ session 展开显示已有标注
✓ 面板 blocks 刷新后不丢失
```

---

## Phase C：Chronicle 重设计

### 锁定行为（修正）
- 发布后：隐藏 CRUD 按钮，显示 🔒
- 仍可展开阅读（所有内容只读）
- 仍可追加评论，**但自动带里程碑版本标签**

### 版本标签规则
- 里程碑 V1 发布后 → 新追加 annotation 自动标记为 `v2-note`
- 里程碑 V2 发布后 → 新 annotation 标记为 `v3-note`
- 版本号 = 当前最高里程碑版本 +1
- 后端：`chronicle_annotations` 表增加 `milestone_version TEXT` 字段

### 后端变更

**`server/scripts/migrate-chronicle.js`**（新建迁移脚本）：
```sql
ALTER TABLE chronicle_collections ADD COLUMN color TEXT DEFAULT '#6366f1';
ALTER TABLE chronicle_collections ADD COLUMN content TEXT;
ALTER TABLE chronicle_collections ADD COLUMN parent_id TEXT
  REFERENCES chronicle_collections(id);

ALTER TABLE chronicle_annotations ADD COLUMN milestone_version TEXT;

CREATE TABLE IF NOT EXISTS chronicle_collection_links (
  id      TEXT PRIMARY KEY,
  from_id TEXT NOT NULL REFERENCES chronicle_collections(id) ON DELETE CASCADE,
  to_id   TEXT NOT NULL REFERENCES chronicle_collections(id) ON DELETE CASCADE,
  label   TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

**`server/routes/chronicle.js`** — 新增/修复：

| 端点 | 说明 |
|------|------|
| `DELETE /chronicle/entries/:id` | 仅当 `!is_locked` |
| `DELETE /chronicle/milestones/:id` | 仅当 `!is_published`，清空 entry.milestone_id |
| `PATCH /chronicle/collections/:id` | 补充 color/content/parent_id 字段 |
| `POST /chronicle/entries/:id/annotations` | 新增 milestone_version 自动写入 |
| `POST /chronicle/collection-links` | `{ from_id, to_id, label }` |
| `GET /chronicle/collection-links` | 全部连线 |
| `DELETE /chronicle/collection-links/:id` | 删除连线 |

`GET /chronicle` 扩展：同时返回 `collection_links`

### 前端变更

**`src/components/ChronicleView.tsx`** — 完整重写

#### 实现优先级（用户明确：抽屉最高优先）

1. **条目详情抽屉**（最高优先）
2. Timeline 视图骨架 + 集合渲染
3. 右侧库面板 + 拖入集合
4. 集合嵌套
5. Workflow SVG 视图（最后）

#### 条目详情抽屉（最高优先）

点击 Timeline 或 Workflow 中任意 task/memory/theory 条目 → 右侧抽屉滑出：

**抽屉内容区（按类型）**：

| 类型 | 接口 | BlockEditor 权限 |
|------|------|-----------------|
| task | `GET /api/kanban/tasks/:id` | readonly（显示字段属性） |
| memory | `GET /memory/sessions/:id` + rounds | readonly（会话展示） |
| theory | `GET /api/pages/:id/blocks` | `permissions={{ canEdit:false, canDelete:false, canAdd:false }}` |

**标注区**（抽屉底部）：
- 已有标注列表：`GET /chronicle/entries/:id/annotations`，按 version 升序显示
- 锁定后追加：新 annotation 自动带 `milestone_version`（如 `v2-note`）
- 追加输入框：一个简单文本 textarea + 提交按钮 → `POST /chronicle/entries/:id/annotations`
- 发布前追加：普通 annotation，无版本标记

#### Timeline 视图

```
[● Timeline] [○ Workflow]     [+ 集合] [+ 里程碑]  [右侧库 ▶]

── V1 · 2026-01 · 已发布 🔒 ─────────────────────────────
  ▼ 集合：熬出低谷（蓝色左边框）            [← 锁定后无编辑/删除]
    ├── [task] Egonetics Alpha              ← 点击 → 右侧抽屉
    ├── [memory] 2025-12-01 对话
    └── [theory 🔒 v1.0] 系统设计
    └── 📦 子集合：核心记录（嵌套）
          └── [task] 子任务

── V2 · 2026-02 · 未发布 ────────────────────────────────
  ▼ 集合：产品化探索（紫色）               [编辑] [删除]
    ├── [task] xxx
    └── [memory] yyy
  [发布里程碑 V2]

── 散条目 ────────────────────────────────────────────────
  [task] 未分配  [memory] 未归档
```

集合卡权限：
- 未锁定：编辑/删除按钮可见，`content` 区用 BlockEditor（全权限）
- 已锁定：隐藏编辑/删除，BlockEditor `permissions={{ canEdit:false, canDelete:false, canAdd:false }}`，但仍展示内容

#### 右侧库面板

```
[Tasks] [Memory] [Theory]
────────────────────────────
未归入集合的条目：
  [📋 Task 名称]      [拖→]
  [🧠 Memory 标题]    [拖→]
  [📖 Theory v1.0]   [拖→]
```

拖入集合 → `POST /chronicle/collections/:id/items`

#### Workflow SVG 视图

参照 AgentsView.tsx：
- 集合 = 彩色矩形节点，内容自适应高度
- 条目 = 节点内彩色小标签（task=蓝/memory=绿/theory=橙）点击 → 抽屉
- 节点拖拽 → `PATCH /chronicle/collections/:id { position_x, position_y }`
- 「连线模式」按钮 → 选源→选目标→弹标签输入 → `POST /chronicle/collection-links`
- 点连线 → 确认删除

**验证**：
```
✓ 点击任意条目 → 右侧抽屉滑出，显示完整内容
✓ 已锁定内容只读，标注区仍可追加（带版本号）
✓ 锁定后追加标注带 milestone_version 标记
✓ Timeline 里程碑展开/折叠
✓ 集合嵌套正确渲染
✓ 未锁定时删除条目/集合/里程碑生效
✓ Workflow 节点拖拽位置持久化
✓ 连线创建/删除
✓ 右侧库拖条目入集合
```

---

## 执行顺序

```
Phase 0  BlockEditor 权限通用化        基础，最先做，约半天
Phase A  Task 看板重写                 约 1 天
Phase B  Memory 标注面板重设计         约 2 天
Phase C  Chronicle 重设计              约 2-3 天（抽屉→Timeline→Workflow）
```

## 风险点

| 风险 | 缓解 |
|------|------|
| BlockEditor 改动影响 Theory 页面 | permissions 全默认 true，不传即不变，修改后先验证 Theory |
| ALTER TABLE 已有列报错 | 脚本用 try/catch per statement 忽略 duplicate column 错误 |
| Workflow SVG 工期 | Timeline + 抽屉先交付，Workflow 可单独迭代 |
| session_ref 只读内容嵌入 BlockEditor | 用 `permissions={{canEdit:false}}` 传入 BlockEditor，不需要单独组件 |
