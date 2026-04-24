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



#### chronicle 重构
1 没有删除和编辑页面，导入chronicle不是锁死了，依然可以CRUD；
2 集合和里程碑是建立在时间轴上的，不是三个分离的详情页。有一个视图功能，除了一条条的菜单栏，也能切换为workflow状态的视图，现实集合（里面的task，memory，theory）不同集合直接可以插入箭头来表示逻辑顺序，类似agent工作流的视图

3 http://localhost:3000/chronicle  前端页面完全不符合预期；
你把集合想简单了，集合应该有标题、颜色、内容(notionBlock编辑块)
现在的逻辑不是不能查看task，memory，theory块的内容和标注信息、这些应该点击从库中掉接口查询显示的；块和集合的关系，不是集合里可以选择块 是可以拖动task，memory，theory块到不同集合中的，且拖进来可以看到标题并显示出来，不怕集合臃肿条数多，集合和集合也可以嵌套。你可以这样理解。时间线是按照里程碑标识，V1在V2前面，点击展开V1的内容，这样。集合的内容是可以一直显示的，集合之间也可以嵌套，跟NotionBlock嵌套逻辑一样，但是这里前端显示要遵循  集合> task，memory，theory块 (集合可以嵌套，task，memory，theory块 算是集合里面的元素)


#### Chronicle 重设计

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

## 历史记录 — 旧使命定义（已被新宪法取代，2026-04-25）

> 以下为 Egonetics 早期定义，现已归入 Chronicle 历史。与新宪法冲突处以新宪法为准。

**EN（旧）**: Egonetics (Ego + Cybernetics) is a personal agent system with a tamper-evident chronicle for self-evolution. It provides a cryptographically hash-linked record of decisions, memories, and growth — ensuring continuity and alignment with user intent over time.

**ZH（旧）**: Egonetics（Ego + Cybernetics，自我 + 控制论）是一个个人智能体系统，通过防篡改的编年史记录自我进化过程。它使用密码学哈希链保存决策、记忆与成长轨迹，确保系统随时间推移保持与用户意图的一致性。

**新宪法（2026-04-25）**: Egonetics 是控制论复杂系统的 runtime 和 AI OS，用于孕育没有幻觉、具备自我控制论反馈循环的下一代 AI。PRVSE + L0~L2 构成进化控制论/自我控制论。实事求是，实践检验真理，生命三大定律决定进化方向。任何前端 UI/UX、任何后端都能被纳入这个极简架构。

