# Kanban Board 改造总结

## 📋 改造内容概览

本次改造将原始看板组件进行了架构升级，核心变化如下：

### 主要改动

| 功能               | 旧逻辑         | 新逻辑                              |
| ------------------ | -------------- | ----------------------------------- |
| **点击 task 卡片** | 弹出编辑弹窗   | 导航到详情页 `/tasks/{taskId}`      |
| **编辑任务**       | 在看板弹窗编辑 | 右上角编辑按钮 → 在详情页或弹窗编辑 |
| **任务详情**       | 无             | 完整详情页面，展示所有信息          |
| **编辑按钮位置**   | 无             | 卡片右上角 + 详情页右上角           |

---

## 📁 新增文件

### 1. **KanbanBoard.tsx** (改造版本)

- **位置**: `/mnt/user-data/outputs/KanbanBoard.tsx`
- **改动点**:
  - ✅ 导入 `useNavigate` from `react-router-dom`
  - ✅ TaskCard 点击逻辑改为 `onCardClick(task.id)` → 导航到详情页
  - ✅ 添加右上角编辑按钮 `<Edit2 />` → 弹出编辑弹窗
  - ✅ 新增 `handleCardClick` 回调，使用 `navigate('/tasks/{taskId}')`
  - ✅ 编辑弹窗现在只在右上角编辑按钮点击时弹出

**关键代码示例**:

```typescript
// 点击卡片 → 导航到详情页
const handleCardClick = useCallback((taskId: string) => {
  navigate(`/tasks/${taskId}`)
}, [navigate])

// 卡片点击事件
onClick={() => !showMenu && onCardClick(task.id)}

// 右上角编辑按钮
<button onClick={(e) => { e.stopPropagation(); onEditClick(task) }}>
  <Edit2 size={12} />
</button>
```

---

### 2. **TaskDetailPage.tsx** (新增)

- **位置**: `/mnt/user-data/outputs/TaskDetailPage.tsx`
- **功能**:
  - 路由: `/tasks/:taskId`
  - 使用 `createApiClient('task')` 获取任务数据
  - 显示完整的任务详情
  - 右上角编辑按钮弹出编辑弹窗
  - 右上角删除按钮删除任务（删除后返回看板）
  - 左上角返回按钮返回看板

**关键特性**:

```typescript
const apiClient = useMemo(() => createApiClient('task'), [])

// 自动加载任务数据
useEffect(() => {
  const data = await apiClient.fetchOne(taskId)
  setTask(data as Task)
}, [taskId, apiClient])

// 编辑并保存
const handleEdit = async (updated: Partial<Task>) => {
  const result = await apiClient.save({ ...task, ...updated })
  setTask(result as Task)
}
```

---

### 3. **apiClient.ts** (新增)

- **位置**: `/mnt/user-data/outputs/apiClient.ts`
- **功能**:
  - 创建类型化的 API 客户端
  - 支持 `createApiClient('task')`, `createApiClient('chronicle')` 等
  - 标准 CRUD 操作: `fetchOne`, `fetchList`, `save`, `delete`
  - 自动处理网络错误

**使用示例**:

```typescript
// 方式 1：创建 task API 客户端（推荐）
const taskApi = createTaskApiClient()
const task = await taskApi.fetchOne('task-123')
await taskApi.save(updatedTask)

// 方式 2：创建其他类型的 API 客户端
const chronicleApi = createApiClient('chronicle')
const chronicles = await chronicleApi.fetchList()
```

---

### 4. **INTEGRATION_GUIDE.md** (新增)

- **位置**: `/mnt/user-data/outputs/INTEGRATION_GUIDE.md`
- **内容**:
  - 路由配置示例
  - 文件组织结构建议
  - 核心改动说明
  - 交互流程图
  - 环境配置
  - 依赖检查清单
  - 常见问题解答
  - 扩展功能建议

---

## 🔄 交互流程

### 看板页面 (KanbanBoard)

```
用户点击 task 卡片
    ↓
导航到 /tasks/{taskId}
    ↓
进入详情页
```

```
用户点击卡片右上角编辑按钮
    ↓
弹出编辑弹窗
    ↓
保存后更新卡片显示
```

```
用户拖拽卡片
    ↓
更新列和排序（不变）
    ↓
自动保存到后端（不变）
```

### 详情页 (TaskDetailPage)

```
用户进入详情页 /tasks/{taskId}
    ↓
自动加载任务数据
    ↓
展示完整任务信息
```

```
用户点击右上角编辑按钮
    ↓
弹出编辑弹窗
    ↓
保存后更新页面显示
```

```
用户点击左上角返回按钮
    ↓
导航回看板
```

---

## 📦 安装和集成步骤

### 1. 安装依赖

```bash
npm install react-router-dom@6+
```

### 2. 配置路由

在 `App.tsx` 中添加路由：

```typescript
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import KanbanBoard from './components/KanbanBoard'
import TaskDetailPage from './pages/TaskDetailPage'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/tasks" element={<KanbanBoard />} />
        <Route path="/tasks/:taskId" element={<TaskDetailPage />} />
      </Routes>
    </Router>
  )
}
```

### 3. 复制文件

- 将 `KanbanBoard.tsx` 替换原文件
- 将 `TaskDetailPage.tsx` 放入 `src/pages/`
- 将 `apiClient.ts` 放入 `src/utils/`

### 4. 检查 API 地址

确保 `apiClient.ts` 中的 `API_BASE` 与你的后端地址一致：

```typescript
const API_BASE = 'http://localhost:3003/api'
```

---

## 🎯 核心 API 端点

### 后端需要实现的接口

- `GET /api/tasks` - 获取所有任务
- `GET /api/tasks/:id` - 获取单个任务 (详情页)
- `POST /api/tasks` - 创建任务
- `PUT /api/tasks/:id` - 更新任务 (详情页编辑)
- `DELETE /api/tasks/:id` - 删除任务

---

## 🔍 关键改动对比

### 旧版 TaskCard

```typescript
// 点击卡片弹出编辑弹窗
onClick={() => !showMenu && onEdit(task)}
```

### 新版 TaskCard

```typescript
// 点击卡片导航到详情页
onClick={() => !showMenu && onCardClick(task.id)}

// 右上角编辑按钮
<button onClick={(e) => {
  e.stopPropagation()
  onEditClick(task)
}}>
  <Edit2 size={12} />
</button>
```

---

## 📊 组件职责划分

| 组件               | 职责                                   |
| ------------------ | -------------------------------------- |
| **KanbanBoard**    | 看板视图、卡片列表、拖拽排序、快速编辑 |
| **TaskDetailPage** | 详情视图、完整信息展示、详细编辑       |
| **apiClient**      | 统一的 API 调用、错误处理、类型支持    |

---

## 🚀 性能优化

- **懒加载**: 详情页只在用户点击时加载数据
- **防止重复渲染**: 使用 `useMemo` 创建 API 客户端
- **自动保存**: 编辑后自动保存到后端（KanbanBoard 原有逻辑保留）
- **错误处理**: 所有 API 调用都有完整的错误处理

---

## ❓ 常见问题

### Q: 点击卡片不跳转？

**A**: 检查以下几点：

1. 是否在路由中配置了 `/tasks/:taskId` 路由
2. `useNavigate()` 是否正确导入
3. `react-router-dom` 是否已安装

### Q: 详情页加载失败？

**A**: 检查以下几点：

1. 后端是否实现了 `GET /api/tasks/:id` 接口
2. `API_BASE` 地址是否正确
3. 浏览器控制台是否有网络错误

### Q: 编辑后无法保存？

**A**: 检查以下几点：

1. 后端是否实现了 `PUT /api/tasks/:id` 接口
2. 请求体格式是否正确
3. 浏览器控制台是否有错误信息

---

## 📝 文件清单

| 文件                   | 类型     | 说明                       |
| ---------------------- | -------- | -------------------------- |
| `KanbanBoard.tsx`      | 改造版本 | 看板主组件，添加了导航逻辑 |
| `TaskDetailPage.tsx`   | 新增     | 任务详情页组件             |
| `apiClient.ts`         | 新增     | API 客户端工厂函数         |
| `INTEGRATION_GUIDE.md` | 文档     | 详细集成指南               |

---

## 🔗 后续扩展

### 支持其他页面类型

现有架构支持轻松扩展到其他页面类型（如 Chronicle）：

```typescript
// 创建 Chronicle 详情页
const chronicleApi = createApiClient('chronicle')

// 创建其他类型的详情页，模仿 TaskDetailPage.tsx 的结构
```

### 添加更多功能

- ✏️ 评论系统
- 📋 子任务支持
- 📎 附件上传
- 🔔 实时通知
- 👥 权限控制

---

## ✅ 验收清单

在集成前，请确认：

- [ ] React Router DOM 已安装
- [ ] 路由已配置
- [ ] 后端 API 接口已实现
- [ ] API_BASE 地址已正确配置
- [ ] 文件已复制到正确位置
- [ ] 依赖项已安装完整
- [ ] 测试点击卡片是否跳转到详情页
- [ ] 测试编辑按钮是否弹出编辑弹窗
- [ ] 测试返回按钮是否正常工作
- [ ] 测试删除功能是否正常工作

---

## 📞 支持

如有任何问题，请：

1. 查看 `INTEGRATION_GUIDE.md` 中的常见问题解答
2. 检查浏览器控制台的错误信息
3. 检查网络请求（F12 → Network 标签）
4. 确保后端 API 正常运行

---

**改造完成！祝使用愉快！** 🎉
