/**
 * kanban-server.js  —  Kanban 后端服务
 *
 * 安装依赖：
 *   npm install express cors
 *
 * 启动：
 *   node kanban-server.js
 *
 * 数据存储：task.db
 * 服务地址：http://localhost:3002
 *
 * API：
 *   GET  /api/kanban          → { columns: [...], tasks: [...] }
 *   PUT  /api/kanban/columns  → 全量替换列（body: Column[]）
 *   PUT  /api/kanban/tasks    → 全量替换任务（body: Task[]）
 */

const express = require('express')
const cors    = require('cors')
const fs      = require('fs')
const path    = require('path')

const app     = express()
const PORT    = 3002
const DB      = path.join(__dirname, 'kanban-data.json')

app.use(cors())
app.use(express.json({ limit: '10mb' }))

// ── helpers ──────────────────────────────────────────────────────────────────

function read() {
  try {
    if (!fs.existsSync(DB)) return { columns: [], tasks: [] }
    return JSON.parse(fs.readFileSync(DB, 'utf8'))
  } catch (e) {
    console.error('read error:', e.message)
    return { columns: [], tasks: [] }
  }
}

function write(data) {
  try { fs.writeFileSync(DB, JSON.stringify(data, null, 2)) }
  catch (e) { console.error('write error:', e.message) }
}

// ── routes ────────────────────────────────────────────────────────────────────

// GET /api/kanban → { columns, tasks }
app.get('/api/kanban', (req, res) => {
  res.json(read())
})

// PUT /api/kanban/columns → replace all columns
app.put('/api/kanban/columns', (req, res) => {
  const db = read()
  db.columns = req.body
  write(db)
  res.json({ ok: true, count: db.columns.length })
})

// PUT /api/kanban/tasks → replace all tasks
app.put('/api/kanban/tasks', (req, res) => {
  const db = read()
  db.tasks = req.body
  write(db)
  res.json({ ok: true, count: db.tasks.length })
})

// ── start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`✅  Kanban server: http://localhost:${PORT}`)
  console.log(`   Data: ${DB}`)
})
