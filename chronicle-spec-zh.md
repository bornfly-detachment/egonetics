# Chronicle 功能 — 实现规格文档

> **冲突解决原则**：当早期与后期章节存在矛盾时，以**后面的章节为准**。

---

## 1. 核心心智模型（请先阅读）

Chronicle 是一个对 Task、Memory、Theory 三类条目进行**时间戳归档**的模块。  
条目显示在垂直**时间轴**上，按**里程碑版本**（V1、V2…）分组。  
条目可以整理进**集合**（类似 Notion 页面——可嵌套、有颜色、支持富文本内容）。  
集合之间可以在**工作流视图**中用箭头连接。

```
时间轴
 │
 ├─ V1（已发布，已锁定 🔒）
 │   ├─ 集合："熬出低谷"  ← 可嵌套，有颜色 + BlockEditor 内容
 │   │   ├─ [task]   任务标题          ← 点击 → 右侧抽屉
 │   │   ├─ [memory] 记忆标题          ← 点击 → 右侧抽屉
 │   │   └─ [theory] Theory v1.0 🔒   ← 点击 → 右侧抽屉
 │   │       └─ 子集合："核心记录"      ← 集合像 Notion 一样嵌套
 │   │           └─ [task] 子任务
 │   └─ 散条目：[memory] 未分类
 │
 ├─ V2（未发布，可编辑）
 │   └─ 集合："产品化探索"
 │       ├─ [task] xxx
 │       └─ [memory] yyy
 │
 └─ 未分配条目（无里程碑，无集合）
```

---

## 2. 核心规则

### 2.1 锁定行为

| 状态 | CRUD 按钮 | 内容 | 标注 |
|------|----------|------|------|
| 未发布 | 可见 | 可编辑 | 无版本标签 |
| 已发布（已锁定） | 隐藏，显示 🔒 | 只读 | 允许追加，自动标记 `v{N+1}-note` |

- 锁定由发布里程碑触发
- 锁定范围：该里程碑、其下所有集合、所有条目
- **锁定 ≠ 隐藏** — 内容始终可见/可阅读
- 锁定后，集合仍可**拖拽调整位置**（position_x/position_y）— 仅影响 UI 布局，不改变数据

### 2.2 标注版本规则

- `chronicle_annotations` 表新增 `milestone_version TEXT` 字段
- 无任何已发布里程碑时 → 标注无版本标签
- V1 发布后 → 新标注自动写入 `milestone_version = "v2-note"`
- V2 发布后 → 新标注自动写入 `milestone_version = "v3-note"`
- 规则：`milestone_version = "v{当前最高已发布版本号 + 1}-note"`

### 2.3 条目显示

- 时间轴只显示：标题 + 日期 + 类型图标
- 点击条目 → 右侧抽屉滑出，展示完整内容
- 条目内容**点击时才通过接口获取**（懒加载，不预加载）
- 条目进入 Chronicle 后**不会被删除** — 而是归档（归属已发布里程碑后变为只读）

---

## 3. 数据库迁移

**文件：`server/scripts/migrate-chronicle.js`**

执行以下 SQL：

```sql
-- 集合表：新增颜色、富文本内容、嵌套支持
ALTER TABLE chronicle_collections ADD COLUMN color TEXT DEFAULT '#6366f1';
ALTER TABLE chronicle_collections ADD COLUMN content TEXT;  -- Notion 风格 block JSON
ALTER TABLE chronicle_collections ADD COLUMN parent_id TEXT
  REFERENCES chronicle_collections(id);

-- 标注表：新增里程碑版本标签
ALTER TABLE chronicle_annotations ADD COLUMN milestone_version TEXT;

-- 新表：集合之间的有向连线（用于工作流视图箭头）
CREATE TABLE IF NOT EXISTS chronicle_collection_links (
  id         TEXT PRIMARY KEY,
  from_id    TEXT NOT NULL REFERENCES chronicle_collections(id) ON DELETE CASCADE,
  to_id      TEXT NOT NULL REFERENCES chronicle_collections(id) ON DELETE CASCADE,
  label      TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

---

## 4. 后端 API

**文件：`server/routes/chronicle.js`**

### 4.1 现有接口的修复/扩展

#### `GET /chronicle`
响应中必须同时返回 `collection_links` 数组：
```json
{
  "milestones": [...],
  "entries": [...],
  "collections": [...],
  "collection_links": [...]
}
```

#### `PATCH /chronicle/collections/:id`
新增以下字段支持：`color`、`content`、`parent_id`

#### `POST /chronicle/entries/:id/annotations`
自动计算并写入 `milestone_version`：
```javascript
// 伪代码
const maxVersion = await db.get(
  `SELECT MAX(version) FROM chronicle_milestones WHERE is_published = 1`
);
const milestoneVersion = maxVersion ? `v${maxVersion + 1}-note` : null;
// 插入标注时写入 milestone_version = milestoneVersion
```

### 4.2 新增接口（如不存在则创建）

| 方法 | 路径 | 条件 | 说明 |
|------|------|------|------|
| DELETE | `/chronicle/entries/:id` | 仅 `is_locked = 0` | 删除条目 |
| DELETE | `/chronicle/milestones/:id` | 仅 `is_published = 0` | 删除里程碑，将关联条目的 milestone_id 置为 null |
| POST | `/chronicle/collection-links` | — | 请求体：`{ from_id, to_id, label }` |
| GET | `/chronicle/collection-links` | — | 返回所有连线 |
| DELETE | `/chronicle/collection-links/:id` | — | 删除连线 |

### 4.3 条目内容接口（抽屉调用 — 勿新建，直接复用）

这些接口应已存在，Chronicle 抽屉直接调用：

| 类型 | 接口 |
|------|------|
| task | `GET /api/kanban/tasks/:id` |
| memory | `GET /memory/sessions/:id`（含 rounds） |
| theory | `GET /api/pages/:id/blocks` |

---

## 5. 前端 — `src/components/ChronicleView.tsx`

**需要完整重写。** 按以下优先级顺序实现：

### 优先级 1（最高）：条目详情抽屉

点击任意条目时从右侧滑入的抽屉。

**行为：**
- 触发：点击时间轴或工作流中任意 task/memory/theory 条目
- 动画：从右侧滑入
- 关闭：点击 X 按钮或点击抽屉外部区域

**抽屉内容（按类型）：**

| 类型 | 调用接口 | 展示方式 |
|------|---------|---------|
| task | `GET /api/kanban/tasks/:id` | 展示任务字段（标题、状态、描述等）— 只读 |
| memory | `GET /memory/sessions/:id` | 展示对话轮次 — 只读 |
| theory | `GET /api/pages/:id/blocks` | BlockEditor，`permissions={{ canEdit:false, canDelete:false, canAdd:false }}` |

**标注区（抽屉底部）：**
```
─── 标注 ─────────────────────────────────────────
[v1-note] 2026-01-10  "这是转折点"
[v2-note] 2026-02-03  "V2 后依然有参考价值"
──────────────────────────────────────────────────
[ 添加标注...                           ] [提交]
```
- 加载：`GET /chronicle/entries/:id/annotations` 按 created_at 升序排列
- 提交：`POST /chronicle/entries/:id/annotations` — 服务端自动写入版本标签
- 已锁定条目：提交后在 UI 上显示版本标签（如 "v2-note"）
- 未锁定条目：不显示版本标签

---

### 优先级 2：时间轴视图布局

**顶部工具栏：**
```
[● 时间轴]  [○ 工作流]          [+ 集合]  [+ 里程碑]  [库 ▶]
```

**时间轴结构：**

```
── V1 · 2026年1月 · 已发布 🔒 ──────────────────── [▼ 折叠]
  集合：熬出低谷              🔵（蓝色左边框）       🔒
    ├── [task]   Egonetics Alpha                  → 点击 = 抽屉
    ├── [memory] 2025-12-01 对话                   → 点击 = 抽屉
    ├── [theory] 系统设计 v1.0 🔒                  → 点击 = 抽屉
    └── 集合：核心记录（嵌套）  🟣
          └── [task] 子任务                        → 点击 = 抽屉

── V2 · 2026年2月 · 未发布 ─────────────────────── [▼ 折叠]
  集合：产品化探索             🟣（紫色左边框）  [编辑] [删除]
    ├── [task] xxx
    └── [memory] yyy
  [发布里程碑 V2]

── 未分配 ───────────────────────────────────────
  [task] 未归组    [memory] 未归档
```

**集合卡规则：**
- 包含：彩色左边框（使用 `color` 字段）、标题、可选 BlockEditor（用于 `content`）
- 集合**默认展开**（内容始终可见，可手动折叠）
- 集合支持**嵌套**：子集合在父集合内缩进渲染
- 已锁定：隐藏编辑/删除按钮，显示 🔒，BlockEditor 只读
- 未锁定：显示编辑/删除按钮，BlockEditor 完全可编辑
- 拖拽条目到集合中：`POST /chronicle/collections/:id/items`

**集合内条目样式：**
```
[📋 task]   任务标题                        （点击 → 抽屉）
[🧠 memory] 记忆标题                        （点击 → 抽屉）
[📖 theory] Theory 标题 v1.0               （点击 → 抽屉）
```

---

### 优先级 3：右侧库面板

顶部工具栏中的"库 ▶"按钮控制开关。

```
┌─ 库 ───────────────────────────┐
│ [Tasks] [Memory] [Theory]      │
│ ────────────────────────────── │
│（显示尚未归入任何集合的条目）       │
│                                │
│  📋 任务名称 A          [拖→]  │
│  📋 任务名称 B          [拖→]  │
│  🧠 记忆 2026-01-05    [拖→]  │
│  📖 Theory v2.0        [拖→]  │
└────────────────────────────────┘
```

- 从库面板拖拽 → 放入集合 = `POST /chronicle/collections/:id/items`
- 放入后：条目从库面板消失，出现在集合中

---

### 优先级 4：集合嵌套

- 集合遵循与 Notion 块相同的嵌套逻辑
- 层级关系：`集合 > 集合（嵌套） > task/memory/theory 条目`
- `task/memory/theory` 条目是**叶节点** — 不能包含子项
- 嵌套关系通过 `chronicle_collections` 的 `parent_id` 字段存储
- 渲染：递归组件，视觉上缩进展示

---

### 优先级 5（最低）：工作流 SVG 视图

点击顶部视图切换器中的"工作流"标签激活。

**布局：**
- 每个集合 = 彩色矩形节点（高度根据内容自适应）
- 节点内的条目标签：`[task]`=蓝色，`[memory]`=绿色，`[theory]`=橙色
- 点击条目标签 → 与时间轴视图相同的右侧抽屉
- 拖拽节点：通过 `PATCH /chronicle/collections/:id` 更新 `position_x`、`position_y`

**连线模式：**
1. 点击"连线"按钮 → 进入连线模式
2. 点击源集合节点 → 点击目标集合节点
3. 弹出对话框：输入可选标签文字 → 确认
4. 调用：`POST /chronicle/collection-links { from_id, to_id, label }`
5. 在节点间渲染带标签的箭头（SVG `<line>` 或 `<path>`）
6. 点击已有箭头 → 确认对话框 → `DELETE /chronicle/collection-links/:id`

---

## 6. 验收清单

完成前逐项验证：

```
UI / 交互
□ 点击任意条目（时间轴或工作流）→ 右侧抽屉滑出
□ 抽屉按类型正确显示内容（task 字段 / memory 轮次 / theory 块）
□ 抽屉标注列表正确加载
□ 在抽屉中添加标注 → 立即显示在列表中
□ 已锁定条目：添加标注 → 显示里程碑版本标签（如 "v2-note"）
□ 未锁定条目：添加标注 → 无版本标签

时间轴
□ 里程碑按版本号顺序渲染（V1 在 V2 前）
□ 里程碑展开/折叠正常
□ 集合显示彩色左边框
□ 集合默认展开（不折叠）
□ 嵌套集合正确缩进渲染
□ 已锁定的里程碑/集合：CRUD 按钮隐藏，显示 🔒
□ 未锁定：编辑/删除按钮可见且功能正常

CRUD（仅限未锁定）
□ 删除条目 → is_locked = 0 时生效，= 1 时阻止
□ 删除里程碑 → is_published = 0 时生效，关联条目的 milestone_id 置为 null
□ 编辑集合 → color、content、parent_id 均正确保存

库面板
□ 库面板可正常开关
□ 只显示未归入任何集合的条目
□ 标签页按类型过滤（Tasks / Memory / Theory）
□ 从库面板拖拽条目 → 放入集合 → 条目正确移动

工作流视图
□ 集合渲染为可拖拽节点
□ 拖拽节点 → 刷新后位置持久化
□ "连线"模式：点击源 → 点击目标 → 输入标签 → 箭头显示
□ 点击箭头 → 删除确认 → 箭头移除
□ 点击工作流中的条目标签 → 同样的抽屉打开
```

---

## 7. 关键实现注意事项

1. **禁止预加载条目内容** — 始终在抽屉打开时懒加载
2. **集合的 `content` 字段**存储 Notion 风格 block JSON — 使用现有 `BlockEditor` 组件
3. **锁定是单向的** — 一旦锁定，无法解锁（不需要解锁接口）
4. **工作流视图中的位置拖拽**纯属外观调整 — 不影响时间轴排序
5. **时间轴排序规则** = 按里程碑版本号排序，同一里程碑内按条目 `created_at` 排序
6. 未分配条目（无 milestone_id，无所属集合）显示在时间轴底部
