/**
 * kanban-server-sqlite.js  —  Kanban 后端服务 (SQLite + Notion Page 关联)
 *
 * 安装依赖：
 *   npm install express cors sqlite3
 *
 * 启动：
 *   node kanban-server-sqlite.js
 *
 * 数据存储：
 *   - task.db (SQLite) - kanban_columns, kanban_tasks 表
 *   - pages.db (SQLite) - pages, blocks 表 (Notion Page)
 *
 * 服务地址：http://localhost:3002
 *
 * API：
 *   GET  /api/kanban          → { columns: [...], tasks: [...] }
 *   PUT  /api/kanban/columns  → 全量替换列（body: Column[]）
 *   PUT  /api/kanban/tasks    → 全量替换任务（body: Task[]）
 *                              自动为每个新任务创建关联的 notion page
 */

const express = require('express')
const cors    = require('cors')
const sqlite3 = require('sqlite3').verbose()
const path    = require('path')

const app     = express()
const PORT    = 3003

// 数据库路径
const TASK_DB_PATH   = path.join(__dirname, 'task.db')
const PAGES_DB_PATH  = path.join(__dirname, 'pages.db')

app.use(cors())
app.use(express.json({ limit: '10mb' }))

// ── 数据库连接 ────────────────────────────────────────────────────────────────

const taskDb = new sqlite3.Database(TASK_DB_PATH)
const pagesDb = new sqlite3.Database(PAGES_DB_PATH)

// ── 初始化表 ──────────────────────────────────────────────────────────────────

function initTables() {
  return new Promise((resolve, reject) => {
    taskDb.serialize(() => {
      // Kanban 列表
      taskDb.run(`
        CREATE TABLE IF NOT EXISTS kanban_columns (
          id TEXT PRIMARY KEY,
          label TEXT NOT NULL,
          header_bg TEXT NOT NULL,
          card_bg TEXT NOT NULL,
          accent TEXT NOT NULL,
          position INTEGER DEFAULT 0
        )
      `)

      // Kanban 任务表（增加 page_id 字段关联 notion page）
      taskDb.run(`
        CREATE TABLE IF NOT EXISTS kanban_tasks (
          id TEXT PRIMARY KEY,
          column_id TEXT NOT NULL,
          name TEXT NOT NULL,
          icon TEXT DEFAULT '📝',
          assignee TEXT,
          start_date TEXT,
          due_date TEXT,
          project TEXT,
          project_icon TEXT,
          status TEXT NOT NULL,
          priority TEXT DEFAULT 'medium',
          sort_order INTEGER DEFAULT 0,
          tags TEXT,
          page_id TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `)

      // 创建索引
      taskDb.run(`CREATE INDEX IF NOT EXISTS idx_tasks_column ON kanban_tasks(column_id)`)
      taskDb.run(`CREATE INDEX IF NOT EXISTS idx_tasks_page ON kanban_tasks(page_id)`, (err) => {
        if (err) reject(err)
        else {
          console.log('✅ task.db 数据库表已初始化')
          resolve()
        }
      })
    })
  })
}

// ── Notion Page 操作 ──────────────────────────────────────────────────────────

/**
 * 为任务创建关联的 Notion Page
 * @param {Object} task - 任务对象
 * @returns {Promise<string>} pageId
 */
async function createTaskPage(task) {
  return new Promise((resolve, reject) => {
    const pageId = `page-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const now = new Date().toISOString()

    // 检查 pages 表是否存在
    pagesDb.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='pages'",
      [],
      (err, row) => {
        if (err || !row) {
          console.log('⚠️ pages 表不存在，跳过创建 notion page')
          resolve(null)
          return
        }

        // 创建 page
        pagesDb.run(
          `INSERT INTO pages (id, parent_id, page_type, ref_id, title, icon, position, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            pageId,
            null,           // parent_id
            'task',         // page_type
            task.id,        // ref_id = task.id
            task.name,
            task.icon || '📝',
            1,              // position
            now,
            now
          ],
          function(err) {
            if (err) {
              console.error('❌ 创建 notion page 失败:', err.message)
              resolve(null)
            } else {
              console.log(`✅ 创建 notion page: ${pageId} for task: ${task.id}`)
              resolve(pageId)
            }
          }
        )
      }
    )
  })
}

/**
 * 获取或创建任务的 notion page
 * @param {Object} task - 任务对象
 * @returns {Promise<string>} pageId
 */
async function getOrCreateTaskPage(task) {
  return new Promise((resolve, reject) => {
    // 先检查是否已有 page_id
    taskDb.get(
      'SELECT page_id FROM kanban_tasks WHERE id = ?',
      [task.id],
      async (err, row) => {
        if (err) {
          reject(err)
          return
        }

        if (row && row.page_id) {
          // 已有 page，返回 id
          resolve(row.page_id)
        } else {
          // 创建新 page
          const pageId = await createTaskPage(task)
          if (pageId) {
            // 更新 task 的 page_id
            taskDb.run(
              'UPDATE kanban_tasks SET page_id = ?, updated_at = ? WHERE id = ?',
              [pageId, new Date().toISOString(), task.id],
              (err) => {
                if (err) console.error('❌ 更新 task page_id 失败:', err.message)
              }
            )
          }
          resolve(pageId)
        }
      }
    )
  })
}

// ── 接口实现 ──────────────────────────────────────────────────────────────────

// GET /api/kanban → { columns, tasks }
app.get('/api/kanban', (req, res) => {
  const result = { columns: [], tasks: [] }

  taskDb.all('SELECT * FROM kanban_columns ORDER BY position', [], (err, columns) => {
    if (err) {
      console.error('❌ 读取 columns 失败:', err.message)
      return res.status(500).json({ error: err.message })
    }
    result.columns = columns.map(col => ({
      id: col.id,
      label: col.label,
      headerBg: col.header_bg,
      cardBg: col.card_bg,
      accent: col.accent,
      position: col.position
    }))

    taskDb.all('SELECT * FROM kanban_tasks ORDER BY sort_order DESC', [], (err, tasks) => {
      if (err) {
        console.error('❌ 读取 tasks 失败:', err.message)
        return res.status(500).json({ error: err.message })
      }
      result.tasks = tasks.map(task => ({
        id: task.id,
        columnId: task.column_id,
        name: task.name,
        icon: task.icon,
        assignee: task.assignee,
        startDate: task.start_date,
        dueDate: task.due_date,
        project: task.project,
        projectIcon: task.project_icon,
        status: task.status,
        priority: task.priority,
        sortOrder: task.sort_order,
        tags: task.tags ? JSON.parse(task.tags) : [],
        pageId: task.page_id,  // 返回 page_id 供前端使用
        created_at: task.created_at,
        updated_at: task.updated_at
      }))

      res.json(result)
    })
  })
})

// PUT /api/kanban/columns → 全量替换列
app.put('/api/kanban/columns', (req, res) => {
  const columns = req.body
  if (!Array.isArray(columns)) {
    return res.status(400).json({ error: 'columns must be an array' })
  }

  taskDb.serialize(() => {
    taskDb.run('BEGIN TRANSACTION')
    taskDb.run('DELETE FROM kanban_columns')

    const stmt = taskDb.prepare(`
      INSERT INTO kanban_columns (id, label, header_bg, card_bg, accent, position)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    columns.forEach((col, index) => {
      stmt.run([
        col.id,
        col.label,
        col.headerBg,
        col.cardBg,
        col.accent,
        index
      ])
    })

    stmt.finalize()
    taskDb.run('COMMIT', (err) => {
      if (err) {
        console.error('❌ 保存 columns 失败:', err.message)
        taskDb.run('ROLLBACK')
        return res.status(500).json({ error: err.message })
      }
      res.json({ ok: true, count: columns.length })
    })
  })
})

// PUT /api/kanban/tasks → 全量替换任务，自动创建 notion page 关联
app.put('/api/kanban/tasks', async (req, res) => {
  const tasks = req.body
  if (!Array.isArray(tasks)) {
    return res.status(400).json({ error: 'tasks must be an array' })
  }

  // 先获取现有的 tasks 以保留 page_id
  const existingPages = {}
  taskDb.all('SELECT id, page_id FROM kanban_tasks', [], async (err, rows) => {
    if (!err && rows) {
      rows.forEach(row => {
        if (row.page_id) existingPages[row.id] = row.page_id
      })
    }

    // 为没有 page_id 的新任务创建 notion page
    const tasksWithPage = await Promise.all(
      tasks.map(async (task) => {
        if (existingPages[task.id]) {
          // 保留现有 page_id
          return { ...task, pageId: existingPages[task.id] }
        }
        // 创建新 page
        const pageId = await createTaskPage(task)
        return { ...task, pageId }
      })
    )

    // 开始事务写入
    taskDb.serialize(() => {
      taskDb.run('BEGIN TRANSACTION')
      taskDb.run('DELETE FROM kanban_tasks')

      const stmt = taskDb.prepare(`
        INSERT INTO kanban_tasks
        (id, column_id, name, icon, assignee, start_date, due_date, project, project_icon, status, priority, sort_order, tags, page_id, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      const now = new Date().toISOString()

      tasksWithPage.forEach(task => {
        stmt.run([
          task.id,
          task.columnId || task.column_id || task.status,
          task.name || '未命名任务',
          task.icon || '📝',
          task.assignee || null,
          task.startDate || task.start_date || null,
          task.dueDate || task.due_date || null,
          task.project || null,
          task.projectIcon || task.project_icon || null,
          task.status || 'uncategorized',
          task.priority || 'medium',
          task.sortOrder || task.sort_order || 0,
          task.tags ? JSON.stringify(task.tags) : null,
          task.pageId || null,
          now
        ])
      })

      stmt.finalize()
      taskDb.run('COMMIT', (err) => {
        if (err) {
          console.error('❌ 保存 tasks 失败:', err.message)
          taskDb.run('ROLLBACK')
          return res.status(500).json({ error: err.message })
        }
        res.json({
          ok: true,
          count: tasks.length,
          pagesCreated: tasksWithPage.filter(t => !existingPages[t.id] && t.pageId).length
        })
      })
    })
  })
})

// GET /api/kanban/tasks/:id → 获取单个任务详情
app.get('/api/kanban/tasks/:id', (req, res) => {
  const taskId = req.params.id

  taskDb.get('SELECT * FROM kanban_tasks WHERE id = ?', [taskId], (err, task) => {
    if (err) return res.status(500).json({ error: err.message })
    if (!task) return res.status(404).json({ error: 'Task not found' })

    res.json({
      id: task.id,
      columnId: task.column_id,
      name: task.name,
      icon: task.icon,
      assignee: task.assignee,
      startDate: task.start_date,
      dueDate: task.due_date,
      project: task.project,
      projectIcon: task.project_icon,
      status: task.status,
      priority: task.priority,
      sortOrder: task.sort_order,
      tags: task.tags ? JSON.parse(task.tags) : [],
      pageId: task.page_id,
      created_at: task.created_at,
      updated_at: task.updated_at
    })
  })
})

// GET /api/kanban/tasks/:id/page → 获取任务关联的 notion page
app.get('/api/kanban/tasks/:id/page', (req, res) => {
  const taskId = req.params.id

  taskDb.get(
    'SELECT page_id FROM kanban_tasks WHERE id = ?',
    [taskId],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message })
      if (!row) return res.status(404).json({ error: 'Task not found' })
      if (!row.page_id) return res.status(404).json({ error: 'No page associated' })

      // 返回 page 信息
      res.json({
        taskId: taskId,
        pageId: row.page_id,
        pageUrl: `/pages/${row.page_id}`  // 前端可以通过此 URL 访问
      })
    }
  )
})

// ── 启动 ──────────────────────────────────────────────────────────────────────

// 先初始化表，再启动服务器
initTables().then(() => {
  app.listen(PORT, () => {
    console.log(`✅  Kanban server (SQLite): http://localhost:${PORT}`)
    console.log(`   Task DB: ${TASK_DB_PATH}`)
    console.log(`   Pages DB: ${PAGES_DB_PATH}`)
    console.log('')
    console.log('   自动为每个新任务创建关联的 Notion Page')
  })
}).catch(err => {
  console.error('❌ 初始化数据库失败:', err.message)
  process.exit(1)
})

// ── 优雅关闭 ──────────────────────────────────────────────────────────────────

process.on('SIGINT', () => {
  console.log('\n👋 正在关闭...')
  taskDb.close()
  if (pagesDb) pagesDb.close()
  process.exit(0)
})
