# 看板改造前后对比和交互流程

## 📊 交互流程对比

### 改造前 (Before)

```
看板 (KanbanBoard)
│
├─ 点击 task 卡片
│  └─> 弹出编辑弹窗
│      └─> 在同一个看板页面编辑
│
├─ 拖拽 task
│  └─> 更新列和排序
│      └─> 自动保存
│
└─ 右键菜单
   └─> 移动到其他列
   └─> 删除任务
```

### 改造后 (After)

```
看板 (KanbanBoard)
│
├─ 点击 task 卡片
│  └─> 导航到详情页 (/tasks/{taskId})
│      └─> 进入完整的任务详情视图
│
├─ 点击卡片右上角编辑按钮
│  └─> 弹出编辑弹窗
│      └─> 在看板页面快速编辑
│      └─> 保存后更新卡片
│
├─ 拖拽 task
│  └─> 更新列和排序
│      └─> 自动保存（不变）
│
└─ 右键菜单
   └─> 移动到其他列
   └─> 删除任务


详情页 (TaskDetailPage) [新增]
│
├─ 左上角返回按钮
│  └─> 返回到看板
│
├─ 右上角编辑按钮
│  └─> 弹出编辑弹窗
│      └─> 详细编辑任务信息
│      └─> 保存后更新页面
│
└─ 右上角删除按钮
   └─> 删除任务
      └─> 返回到看板
```

---

## 🔄 详细交互流程

### 场景 1: 查看任务详情

```
用户在看板看到一个 task 卡片
        │
        ↓
    点击卡片（任意位置）
        │
        ↓
  导航到 /tasks/task-123
        │
        ↓
   加载任务数据
   （API: GET /api/tasks/task-123）
        │
        ↓
  进入详情页 (TaskDetailPage)
   - 展示任务名称、优先级、负责人
   - 展示日期、项目、标签
   - 展示完整描述
   - 显示创建/修改时间
        │
        ↓
  用户可以：
  ├─ 点击编辑按钮 → 编辑任务信息
  ├─ 点击删除按钮 → 删除任务
  └─ 点击返回按钮 → 回到看板
```

### 场景 2: 快速编辑（在看板页面）

```
用户在看板看到一个 task 卡片
        │
        ↓
   hover 卡片
   （显示编辑和菜单按钮）
        │
        ↓
 点击卡片右上角编辑按钮 ✏️
        │
        ↓
 弹出编辑弹窗
 - 修改任务名称
 - 修改优先级
 - 修改负责人
 - 修改日期等
        │
        ↓
  点击保存按钮
        │
        ↓
保存到后端
（API: PUT /api/tasks/task-123）
        │
        ↓
  更新卡片显示
  返回看板页面
```

### 场景 3: 拖拽排序（不变）

```
用户在看板拖拽 task 卡片
        │
        ↓
  按住 drag handle (🟰)
  并拖动卡片
        │
        ↓
  显示 ghost 元素和插入位置
        │
        ↓
  放开鼠标
        │
        ↓
 更新列和排序顺序
        │
        ↓
保存到后端
（API: PUT /api/kanban/tasks）
        │
        ↓
   卡片显示新位置
```

### 场景 4: 删除任务

```
方式 A: 在看板页面
  task 右侧菜单 → 删除任务 → 确认
           │
           ↓
     删除成功（API: DELETE）
           │
           ↓
    看板重新加载


方式 B: 在详情页
  详情页右上角 → 删除按钮 → 确认
           │
           ↓
     删除成功（API: DELETE）
           │
           ↓
    自动返回看板
```

---

## 🎯 核心改动点

### 1. TaskCard 组件

**改造前:**

```typescript
interface CardProps {
  onEdit: (t: Task) => void  // 点击卡片弹窗编辑
  // ...
}

// 点击卡片
onClick={() => !showMenu && onEdit(task)}
```

**改造后:**

```typescript
interface CardProps {
  onCardClick: (taskId: string) => void    // 导航到详情页
  onEditClick: (t: Task) => void          // 编辑按钮弹窗编辑
  // ...
}

// 点击卡片 → 导航到详情页
onClick={() => !showMenu && onCardClick(task.id)}

// 编辑按钮 → 弹窗编辑
<button onClick={(e) => {
  e.stopPropagation()
  onEditClick(task)
}}>
  <Edit2 size={12} />
</button>
```

### 2. KanbanBoard 主组件

**改造前:**

```typescript
const [editingTask, setEditingTask] = useState(null)

const onEditTask = (task) => {
  setEditingTask(task)
}

// 点击卡片时调用 onEditTask
```

**改造后:**

```typescript
const navigate = useNavigate()
const [editingTask, setEditingTask] = useState(null)

const handleCardClick = useCallback(
  (taskId: string) => {
    navigate(`/tasks/${taskId}`)
  },
  [navigate]
)

const handleEditTask = (task) => {
  setEditingTask(task) // 仅编辑按钮时触发
}

// 点击卡片时调用 handleCardClick
// 编辑按钮时调用 handleEditTask
```

### 3. 新增 TaskDetailPage

```typescript
// 完整的任务详情页组件
- 使用 useParams 获取 taskId
- 使用 createApiClient('task') 获取数据
- 显示完整的任务信息
- 提供编辑和删除功能
- 支持返回到看板
```

### 4. 新增 apiClient

```typescript
// 统一的 API 客户端
createApiClient('task') // 创建 task 类型的客户端
createApiClient('chronicle') // 创建 chronicle 类型的客户端
// 支持 fetchOne, fetchList, save, delete
```

---

## 📱 用户体验改进

### Before (改造前)

- ❌ 点击卡片弹窗太小，信息不完整
- ❌ 所有编辑都在弹窗中进行
- ❌ 无法清楚地看到任务的完整信息
- ❌ 无法看到任务的创建/修改时间

### After (改造后)

- ✅ 点击卡片可以进入完整的详情页
- ✅ 支持快速编辑（编辑按钮 → 弹窗）
- ✅ 详情页显示所有任务信息
- ✅ 可以看到任务的完整历史信息
- ✅ 更清晰的导航流程
- ✅ 更好的信息展示

---

## 🔗 API 接口清单

### 看板相关（不变）

- `GET /api/kanban` - 获取看板数据
- `PUT /api/kanban/columns` - 更新列
- `PUT /api/kanban/tasks` - 更新任务列表

### 任务相关（新增）

- `GET /api/tasks/:id` - 获取单个任务详情
- `POST /api/tasks` - 创建新任务
- `PUT /api/tasks/:id` - 更新任务
- `DELETE /api/tasks/:id` - 删除任务
- `GET /api/tasks` - 获取任务列表（可选）

---

## 🧭 路由结构

```
/
├── /tasks
│   ├── 看板页面 (KanbanBoard)
│   │   ├── 点击卡片 → /tasks/:taskId
│   │   ├── 编辑按钮 → 弹窗编辑
│   │   └── 拖拽排序 → 自动保存
│   │
│   └── /tasks/:taskId
│       └── 详情页面 (TaskDetailPage)
│           ├── 编辑按钮 → 弹窗编辑
│           ├── 删除按钮 → 确认删除 → 返回看板
│           └── 返回按钮 → 返回看板
│
└── /other-routes
    └── 其他页面
```

---

## 📊 状态管理对比

### KanbanBoard 状态（不变的部分）

```typescript
const [columns, setColumns] = useState<Column[]>([]) // 列数据
const [draggingId, setDraggingId] = useState(null) // 正在拖拽的任务
const [hoverColId, setHoverColId] = useState(null) // 悬停的列
const [insertLine, setInsertLine] = useState(null) // 插入位置
```

### KanbanBoard 状态（改造的部分）

```typescript
const [editingTask, setEditingTask] = useState(null) // 编辑中的任务

// 改造前: 点击卡片时设置 editingTask（弹弹窗编辑）
// 改造后: 只在编辑按钮点击时设置 editingTask（弹弹窗快速编辑）
//        点击卡片时导航到详情页（进入完整详情页）
```

### TaskDetailPage 状态（新增）

```typescript
const [task, setTask] = useState<Task | null>(null) // 任务数据
const [loading, setLoading] = useState(true) // 加载中
const [error, setError] = useState<string | null>(null) // 错误信息
const [showEdit, setShowEdit] = useState(false) // 编辑弹窗显示
```

---

## 🎨 UI 变化

### 看板卡片 (TaskCard)

**改造前:**

```
┌─────────────────────────┐
│ 🔥 (grip)  任务名  (more)│ ← 点击卡片 → 弹窗编辑
│ 🟦 ◯ Alex  开始...    │
│ 高 🚀 Project   Tags  │
└─────────────────────────┘
```

**改造后:**

```
┌─────────────────────────┐
│ 🔥 (grip)  任务名  ✏️ (more)│ ← 点击卡片 → 跳转详情页
│ 🟦 ◯ Alex  开始...    │   ← 点击 ✏️ → 弹窗编辑
│ 高 🚀 Project   Tags  │
└─────────────────────────┘
```

### 详情页 (TaskDetailPage)

**新增:**

```
┌─────────────────────────────────────────┐
│ ← 返回  |  任务管理 - 完整详情  | 编辑 ✏️ 删除 🗑️  │
├─────────────────────────────────────────┤
│                                         │
│  📝 任务名称                            │
│  高  进行中                              │
│                                         │
│  👤 负责人: Alex                        │
│  📅 开始: 2024年1月15日                 │
│  📅 截止: 2024年1月20日                 │
│  🚀 项目: My Project                    │
│  📝 描述: 任务的完整描述...              │
│  🏷️  标签: AI, Research, Finance       │
│                                         │
│  创建于 2024年1月10日                   │
│  更新于 2024年1月15日                   │
│                                         │
└─────────────────────────────────────────┘
```

---

## 🚀 性能优化

### 1. 懒加载

- 详情页只在用户点击时才加载数据
- 避免一次性加载所有任务的详细信息

### 2. 缓存策略

- KanbanBoard: 保持看板数据在内存中
- TaskDetailPage: 加载单个任务数据（可添加缓存）

### 3. 自动保存

- KanbanBoard: 拖拽后自动保存（debounce 600ms）
- TaskDetailPage: 编辑后点击保存按钮

---

## ✅ 测试检查清单

### 导航测试

- [ ] 在看板点击卡片是否跳转到详情页
- [ ] 详情页 URL 是否正确（/tasks/{taskId}）
- [ ] 详情页返回按钮是否回到看板

### 编辑测试

- [ ] 卡片编辑按钮是否正常弹窗
- [ ] 详情页编辑按钮是否正常弹窗
- [ ] 编辑后是否正确保存
- [ ] 是否能看到编辑后的数据更新

### 删除测试

- [ ] 卡片菜单删除是否正常工作
- [ ] 详情页删除按钮是否正常工作
- [ ] 删除后是否自动返回看板

### 拖拽测试

- [ ] 拖拽排序是否仍然正常工作
- [ ] 跨列拖拽是否正常工作
- [ ] 拖拽后是否自动保存

### 数据加载测试

- [ ] 详情页是否正确加载任务数据
- [ ] 网络错误时是否显示错误提示
- [ ] 任务不存在时是否显示错误信息

---

这个改造提供了更好的用户体验，允许用户：

1. **快速浏览**: 点击卡片快速进入详情页
2. **快速编辑**: 编辑按钮快速弹窗编辑
3. **详细查看**: 完整的详情页显示所有信息
4. **灵活操作**: 支持在看板和详情页两处编辑和删除

🎉 改造完成！
