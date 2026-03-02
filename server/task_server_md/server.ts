/**
 * server.ts 或 app.ts
 * 
 * 完整的后端 API 实现
 * 支持看板和任务的所有 CRUD 操作
 * 
 * 依赖: express, cors
 * npm install express cors uuid
 */

import express, { Request, Response } from 'express'
import cors from 'cors'
import { v4 as uuidv4 } from 'uuid'

const app = express()

// ─── 中间件 ────────────────────────────────────────────────────────────────

app.use(cors())
app.use(express.json())

// ─── 类型定义 ──────────────────────────────────────────────────────────────

type Priority = 'urgent' | 'high' | 'medium' | 'low'

interface Task {
  id: string
  name: string
  icon: string
  assignee?: string
  startDate: string
  dueDate?: string
  project?: string
  projectIcon?: string
  status: string
  priority: Priority
  sortOrder: number
  created_at: string
  updated_at: string
  tags?: string[]
  columnId?: string
  description?: string  // 详情页额外字段
}

interface Column {
  id: string
  label: string
  headerBg: string
  cardBg: string
  accent: string
}

// ─── 内存数据存储 ──────────────────────────────────────────────────────────
// 注意：这是内存存储，应用重启后数据会丢失
// 生产环境应使用数据库（MongoDB, PostgreSQL 等）

let columns: Column[] = [
  {
    id: 'col-todo',
    label: '待办',
    headerBg: 'bg-[#7B5EA7]',
    cardBg: 'bg-[#1e1530]',
    accent: '#9B72CF',
  },
  {
    id: 'col-doing',
    label: '进行中',
    headerBg: 'bg-[#2E7DC5]',
    cardBg: 'bg-[#0a1f35]',
    accent: '#4A9DE0',
  },
  {
    id: 'col-done',
    label: '已完成',
    headerBg: 'bg-[#2E9E6A]',
    cardBg: 'bg-[#0a2318]',
    accent: '#3DBF80',
  },
]

let tasks: Task[] = [
  {
    id: 'task-1',
    name: '完成项目文档',
    icon: '📝',
    assignee: 'Alice',
    startDate: '2026-03-01',
    dueDate: '2026-03-10',
    project: 'Project A',
    projectIcon: '🚀',
    status: 'col-doing',
    columnId: 'col-doing',
    priority: 'high',
    sortOrder: 1000,
    created_at: '2026-02-28T10:00:00Z',
    updated_at: '2026-03-02T00:00:00Z',
    tags: ['文档', '重要'],
    description: '需要完成项目的详细文档编写，包括 API 文档和用户手册。',
  },
  {
    id: 'task-2',
    name: '代码审查',
    icon: '🔍',
    assignee: 'Bob',
    startDate: '2026-03-02',
    dueDate: '2026-03-05',
    project: 'Project A',
    status: 'col-doing',
    columnId: 'col-doing',
    priority: 'medium',
    sortOrder: 900,
    created_at: '2026-03-01T10:00:00Z',
    updated_at: '2026-03-02T00:00:00Z',
    tags: ['代码', '审查'],
    description: '对最新提交的代码进行审查，检查是否符合编码规范。',
  },
  {
    id: 'task-3',
    name: '修复 Bug',
    icon: '🐛',
    assignee: 'Charlie',
    startDate: '2026-02-28',
    dueDate: '2026-03-03',
    project: 'Project B',
    status: 'col-todo',
    columnId: 'col-todo',
    priority: 'urgent',
    sortOrder: 1100,
    created_at: '2026-02-25T10:00:00Z',
    updated_at: '2026-03-02T00:00:00Z',
    tags: ['Bug', '紧急'],
    description: '修复登录页面的 CSS 问题，导致在移动设备上显示不正常。',
  },
  {
    id: 'task-4',
    name: '性能优化',
    icon: '⚡',
    startDate: '2026-03-05',
    priority: 'low',
    status: 'col-done',
    columnId: 'col-done',
    sortOrder: 800,
    created_at: '2026-02-20T10:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
    tags: ['性能', '优化'],
    description: '优化数据库查询和 API 响应时间，目标降低至 100ms 以内。',
  },
]

// ─── 看板相关 API ──────────────────────────────────────────────────────────

/**
 * GET /api/kanban
 * 获取完整看板数据（列和任务）
 */
app.get('/api/kanban', (req: Request, res: Response) => {
  console.log('📋 GET /api/kanban')
  res.json({
    columns: columns,
    tasks: tasks,
  })
})

/**
 * PUT /api/kanban/columns
 * 更新列的数据（如重命名、重排序等）
 */
app.put('/api/kanban/columns', (req: Request, res: Response) => {
  console.log('✏️  PUT /api/kanban/columns')
  try {
    const newColumns: Column[] = req.body
    if (Array.isArray(newColumns)) {
      columns = newColumns
      res.status(204).send()  // 204 No Content
    } else {
      res.status(400).json({ error: 'Invalid columns data' })
    }
  } catch (error) {
    console.error('Error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * PUT /api/kanban/tasks
 * 批量更新任务（用于拖拽排序和列移动）
 */
app.put('/api/kanban/tasks', (req: Request, res: Response) => {
  console.log('✏️  PUT /api/kanban/tasks')
  try {
    const newTasks: Task[] = req.body
    if (Array.isArray(newTasks)) {
      // 更新任务
      newTasks.forEach(newTask => {
        const idx = tasks.findIndex(t => t.id === newTask.id)
        if (idx >= 0) {
          tasks[idx] = {
            ...tasks[idx],
            ...newTask,
            updated_at: new Date().toISOString(),
          }
        }
      })
      res.status(204).send()  // 204 No Content
    } else {
      res.status(400).json({ error: 'Invalid tasks data' })
    }
  } catch (error) {
    console.error('Error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ─── 任务详情 API（这是你缺少的关键接口！） ────────────────────────────────

/**
 * GET /api/tasks/:id
 * 获取单个任务详情（详情页需要）
 * 
 * ⭐ 这是 TaskDetailPage.tsx 需要的接口
 */
app.get('/api/tasks/:id', (req: Request, res: Response) => {
  console.log(`📖 GET /api/tasks/:id - taskId: ${req.params.id}`)
  try {
    const taskId = req.params.id
    const task = tasks.find(t => t.id === taskId)

    if (!task) {
      return res.status(404).json({ error: 'Task not found' })
    }

    res.json(task)
  } catch (error) {
    console.error('Error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /api/tasks
 * 获取所有任务列表（可选）
 */
app.get('/api/tasks', (req: Request, res: Response) => {
  console.log('📋 GET /api/tasks')
  try {
    res.json(tasks)
  } catch (error) {
    console.error('Error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * POST /api/tasks
 * 创建新任务
 */
app.post('/api/tasks', (req: Request, res: Response) => {
  console.log('➕ POST /api/tasks')
  try {
    const { name, icon, priority, status, columnId, ...rest } = req.body

    if (!name) {
      return res.status(400).json({ error: 'Task name is required' })
    }

    const newTask: Task = {
      id: `task-${uuidv4().slice(0, 8)}`,
      name,
      icon: icon || '📝',
      priority: priority || 'medium',
      status: status || columnId || 'col-todo',
      columnId: columnId || status || 'col-todo',
      sortOrder: 1000,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...rest,
    }

    tasks.push(newTask)
    res.status(201).json(newTask)
  } catch (error) {
    console.error('Error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * PUT /api/tasks/:id
 * 更新任务（编辑详情页使用）
 */
app.put('/api/tasks/:id', (req: Request, res: Response) => {
  console.log(`✏️  PUT /api/tasks/:id - taskId: ${req.params.id}`)
  try {
    const taskId = req.params.id
    const idx = tasks.findIndex(t => t.id === taskId)

    if (idx < 0) {
      return res.status(404).json({ error: 'Task not found' })
    }

    tasks[idx] = {
      ...tasks[idx],
      ...req.body,
      id: taskId,  // 确保 ID 不被修改
      created_at: tasks[idx].created_at,  // 确保创建时间不变
      updated_at: new Date().toISOString(),  // 更新修改时间
    }

    res.json(tasks[idx])
  } catch (error) {
    console.error('Error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * DELETE /api/tasks/:id
 * 删除任务
 */
app.delete('/api/tasks/:id', (req: Request, res: Response) => {
  console.log(`🗑️  DELETE /api/tasks/:id - taskId: ${req.params.id}`)
  try {
    const taskId = req.params.id
    const idx = tasks.findIndex(t => t.id === taskId)

    if (idx < 0) {
      return res.status(404).json({ error: 'Task not found' })
    }

    const deletedTask = tasks.splice(idx, 1)[0]
    res.json(deletedTask)
  } catch (error) {
    console.error('Error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ─── OPTIONS 请求处理（用于 CORS 预检） ──────────────────────────────────

app.options('/api/kanban/tasks', cors())
app.options('/api/tasks/:id', cors())
app.options('/api/tasks', cors())

// ─── 启动服务器 ────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3003

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║  🚀 Kanban Board API Server                 ║
║  Server running at: http://localhost:${PORT}/api ║
║  Environment: ${process.env.NODE_ENV || 'development'}                  ║
╚══════════════════════════════════════════════╝
  `)

  console.log(`
📋 Available Endpoints:
  
  看板接口:
  ✅ GET    /api/kanban                - 获取看板数据
  ✅ PUT    /api/kanban/columns        - 更新列
  ✅ PUT    /api/kanban/tasks          - 批量更新任务

  任务接口:
  ✅ GET    /api/tasks                 - 获取所有任务
  ✅ GET    /api/tasks/:id             - 获取单个任务（详情页）⭐
  ✅ POST   /api/tasks                 - 创建新任务
  ✅ PUT    /api/tasks/:id             - 更新任务（编辑）⭐
  ✅ DELETE /api/tasks/:id             - 删除任务⭐
  `)
})

export default app
