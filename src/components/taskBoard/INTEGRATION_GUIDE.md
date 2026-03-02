/**
 * INTEGRATION GUIDE - 集成指南
 *
 * 这个文档说明如何将改造后的代码集成到你的应用中
 */

// ─────────────────────────────────────────────────────────────────────────
// 1. 路由配置
// ─────────────────────────────────────────────────────────────────────────

// 在你的 App.tsx 或路由配置文件中，添加以下路由：

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import KanbanBoard from './components/KanbanBoard'
import TaskDetailPage from './pages/TaskDetailPage'

function App() {
  return (
    <Router>
      <Routes>
        {/* 看板页面 */}
        <Route path="/tasks" element={<KanbanBoard />} />
        
        {/* 任务详情页 */}
        <Route path="/tasks/:taskId" element={<TaskDetailPage />} />
        
        {/* 其他路由... */}
      </Routes>
    </Router>
  )
}

export default App

// ─────────────────────────────────────────────────────────────────────────
// 2. 文件组织结构
// ─────────────────────────────────────────────────────────────────────────

/*
src/
├── components/
│   ├── KanbanBoard.tsx          (改造后的看板组件)
│   └── ...
├── pages/
│   ├── TaskDetailPage.tsx       (任务详情页)
│   └── ...
├── utils/
│   ├── apiClient.ts            (API 客户端工厂)
│   └── ...
├── App.tsx
└── main.tsx
*/

// ─────────────────────────────────────────────────────────────────────────
// 3. 核心改动说明
// ─────────────────────────────────────────────────────────────────────────

/**
 * KanbanBoard.tsx 改动：
 * 
 * 旧逻辑：
 *   - 点击 task 卡片 → 弹出编辑弹窗 (onEdit)
 * 
 * 新逻辑：
 *   - 点击 task 卡片 → 导航到详情页 (onCardClick → navigate(/tasks/:taskId))
 *   - 右上角编辑按钮 → 弹出编辑弹窗 (onEditClick)
 * 
 * TaskCard 组件：
 *   - 删除了 onClick={() => !showMenu && onEdit(task)} 中的 onEdit 调用
 *   - 改为 onClick={() => !showMenu && onCardClick(task.id)}
 *   - 添加了编辑按钮 <Edit2 /> 触发 onEditClick
 * 
 * KanbanBoard 主组件：
 *   - 新增 useNavigate() hook
 *   - 新增 handleCardClick 回调，直接导航到详情页
 */

// ─────────────────────────────────────────────────────────────────────────
// 4. API 客户端使用示例
// ─────────────────────────────────────────────────────────────────────────

// apiClient.ts 导出的工具：

import { createApiClient, createTaskApiClient } from './utils/apiClient'

// 方式 1：创建任务 API 客户端（推荐）
const taskApi = createTaskApiClient()
const task = await taskApi.fetchOne('task-123')
await taskApi.save(updatedTask)

// 方式 2：创建其他类型的 API 客户端（支持扩展）
const chronicleApi = createApiClient('chronicle')
const chronicles = await chronicleApi.fetchList()

// ─────────────────────────────────────────────────────────────────────────
// 5. TaskDetailPage 使用示例
// ─────────────────────────────────────────────────────────────────────────

/**
 * TaskDetailPage.tsx：
 *   - 通过 useParams 获取 taskId
 *   - 使用 createApiClient('task') 创建 API 客户端
 *   - 自动加载任务数据
 *   - 右上角有编辑按钮，点击弹出编辑弹窗
 *   - 编辑后自动保存并更新页面
 *   - 可以删除任务（会返回看板）
 *   - 可以返回看板（左上角返回按钮）
 */

// ─────────────────────────────────────────────────────────────────────────
// 6. 交互流程
// ─────────────────────────────────────────────────────────────────────────

/**
 * 用户交互流程：
 * 
 * 1. 看板 (KanbanBoard)
 *    ├─ 点击 task 卡片
 *    │  └─> 导航到详情页 /tasks/{taskId}
 *    │
 *    ├─ 拖拽 task
 *    │  └─> 更新列和排序（不变）
 *    │
 *    └─ 点击右上角编辑按钮
 *       └─> 弹出编辑弹窗
 *           └─> 保存后更新卡片显示
 * 
 * 2. 任务详情页 (TaskDetailPage)
 *    ├─ 左上角返回按钮
 *    │  └─> 返回看板
 *    │
 *    ├─ 右上角编辑按钮
 *    │  └─> 弹出编辑弹窗
 *    │      └─> 保存后更新页面显示
 *    │
 *    └─ 右上角删除按钮
 *       └─> 删除任务
 *           └─> 返回看板
 */

// ─────────────────────────────────────────────────────────────────────────
// 7. 环境配置
// ─────────────────────────────────────────────────────────────────────────

/**
 * API_BASE 地址配置（在 apiClient.ts 中）：
 * 
 * const API_BASE = 'http://localhost:3003/api'
 * 
 * 如需修改，可以：
 * 1. 直接修改 apiClient.ts 中的 API_BASE 常量
 * 2. 或在环境变量中配置，然后在 apiClient.ts 中读取：
 *    const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3003/api'
 */

// .env 配置示例（如果使用环境变量）
/*
VITE_API_BASE=http://localhost:3003/api
*/

// ─────────────────────────────────────────────────────────────────────────
// 8. 依赖检查
// ─────────────────────────────────────────────────────────────────────────

/**
 * 必要的依赖包：
 * - react@18+
 * - react-router-dom@6+  (新增，用于路由导航)
 * - lucide-react@latest  (已有)
 * - tailwindcss@latest   (已有)
 * 
 * 安装命令：
 * npm install react-router-dom
 */

// ─────────────────────────────────────────────────────────────────────────
// 9. 常见问题
// ─────────────────────────────────────────────────────────────────────────

/**
 * Q: 点击卡片不跳转到详情页？
 * A: 检查：
 *    1. 是否在路由中配置了 /tasks/:taskId 路由
 *    2. useNavigate() 是否正确导入
 *    3. react-router-dom 是否已安装
 * 
 * Q: 编辑弹窗无法保存？
 * A: 检查：
 *    1. API 端点是否正确（/api/tasks/:id）
 *    2. 后端是否实现了 PUT /api/tasks/:id 接口
 *    3. 浏览器控制台是否有报错
 * 
 * Q: 详情页无法加载任务数据？
 * A: 检查：
 *    1. URL 参数中是否有有效的 taskId
 *    2. 后端是否实现了 GET /api/tasks/:id 接口
 *    3. API_BASE 地址是否正确
 *    4. 浏览器控制台是否有网络错误
 * 
 * Q: 如何支持其他页面类型的详情页？
 * A: 参考 TaskDetailPage.tsx，创建新的详情页组件：
 *    1. 使用 createApiClient('pageType') 创建 API 客户端
 *    2. 使用 useParams 获取 ID
 *    3. 实现加载、编辑、删除等功能
 */

// ─────────────────────────────────────────────────────────────────────────
// 10. 扩展功能建议
// ─────────────────────────────────────────────────────────────────────────

/**
 * 后续可以添加的功能：
 * 
 * 1. 评论系统
 *    - 在详情页添加评论区域
 *    - 支持添加、编辑、删除评论
 * 
 * 2. 活动日志
 *    - 显示任务的修改历史
 *    - 谁在什么时间做了什么改动
 * 
 * 3. 子任务
 *    - 任务可以有子任务
 *    - 子任务可以独立拖拽和编辑
 * 
 * 4. 附件支持
 *    - 为任务添加附件
 *    - 支持预览和下载
 * 
 * 5. 通知系统
 *    - 任务被指派时通知用户
 *    - 任务截止时间提醒
 * 
 * 6. 权限控制
 *    - 不同用户有不同的操作权限
 *    - 支持任务共享和协作
 */
