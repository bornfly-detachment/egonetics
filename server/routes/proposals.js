/**
 * routes/proposals.js
 *
 * SEAI ↔ Egonetics 通信中间层
 *
 * REST API:
 *   GET    /api/proposals               获取消息列表（pending 优先）
 *   GET    /api/proposals/:id           获取单条
 *   POST   /api/proposals/:id/resolve   裁决 { action: "approve"|"reject" }
 *   DELETE /api/proposals/:id           删除（已解决后清理）
 *
 * SSE（前端订阅）:
 *   GET    /api/events                  Server-Sent Events 实时推流
 *
 * WebSocket（SEAI 推送）:
 *   通过 attachWebSocket(server, pagesDb) 挂载到 http.Server
 *   SEAI 连接后发送 proposal JSON，Node 写入队列并广播 SSE 给前端
 */

const express = require('express')
const router  = express.Router()
const WebSocket = require('ws')

// pagesDb 通过 init() 注入，路由通过 req.pagesDb 使用
let _pagesDb = null
router.use((req, _res, next) => { req.pagesDb = _pagesDb; next() })

// ── SSE 订阅者注册表 ─────────────────────────────────────────
const sseClients = new Set()

function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const res of sseClients) {
    try { res.write(msg) } catch { sseClients.delete(res) }
  }
}

// ── 工具 ─────────────────────────────────────────────────────
function genId() {
  return `prop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function parsePayload(row) {
  return {
    ...row,
    payload:      tryParse(row.payload,      {}),
    conflict_with: row.conflict_with ? tryParse(row.conflict_with, null) : null,
  }
}

function tryParse(s, fallback) {
  try { return JSON.parse(s) } catch { return fallback }
}

// ── 冲突检测 ─────────────────────────────────────────────────
/**
 * 根据 proposal 类型，查询现有状态。
 * 如果 entity 已有用户手动设置的记录 → 返回当前状态（conflict）
 * 否则 → 返回 null（可 auto_apply）
 */
function detectConflict(pagesDb, type, entity_id, entity_type) {
  return new Promise(resolve => {
    if (type === 'classification') {
      pagesDb.get(
        'SELECT * FROM prvse_classifications WHERE entity_id=? AND entity_type=?',
        [entity_id, entity_type],
        (err, row) => {
          if (err || !row) return resolve(null)
          // 存在已有打标 → 冲突
          resolve({
            layer:       row.layer,
            from_tags:   tryParse(row.from_tags,  []),
            what_tags:   tryParse(row.what_tags,  []),
            where_tags:  tryParse(row.where_tags, []),
            description: row.description,
            updated_at:  row.updated_at,
          })
        }
      )
    } else if (type === 'tag_tree') {
      // tag 节点修改：检查该节点是否存在
      pagesDb.get('SELECT * FROM tag_trees WHERE id=?', [entity_id], (err, row) => {
        resolve(row ? { name: row.name, color: row.color } : null)
      })
    } else if (type === 'task') {
      pagesDb.get('SELECT id, title, column_id, updated_at FROM tasks WHERE id=?', [entity_id], (err, row) => {
        resolve(row || null)
      })
    } else {
      resolve(null)
    }
  })
}

// ── 自动应用（无冲突时）─────────────────────────────────────
function autoApply(pagesDb, proposal) {
  const p = typeof proposal.payload === 'string' ? tryParse(proposal.payload, {}) : proposal.payload

  if (proposal.type === 'classification') {
    pagesDb.run(
      `INSERT INTO prvse_classifications (entity_id, entity_type, layer, from_tags, what_tags, where_tags, description, updated_at)
       VALUES (?,?,?,?,?,?,?, datetime('now'))
       ON CONFLICT(entity_id, entity_type) DO UPDATE SET
         layer=excluded.layer, from_tags=excluded.from_tags, what_tags=excluded.what_tags,
         where_tags=excluded.where_tags, description=excluded.description, updated_at=excluded.updated_at`,
      [proposal.entity_id, proposal.entity_type,
       p.layer || '', JSON.stringify(p.from_tags || []), JSON.stringify(p.what_tags || []),
       JSON.stringify(p.where_tags || []), p.description || '']
    )
  } else if (proposal.type === 'task') {
    const fields = []; const vals = []
    if (p.column_id)    { fields.push('column_id=?');    vals.push(p.column_id) }
    if (p.task_summary) { fields.push('task_summary=?'); vals.push(p.task_summary) }
    if (p.title)        { fields.push('title=?');        vals.push(p.title) }
    if (fields.length) {
      vals.push(proposal.entity_id)
      pagesDb.run(`UPDATE tasks SET ${fields.join(',')} WHERE id=?`, vals)
    }
  }
  // tag_tree 修改需要用户确认，不自动应用
}

// ── REST 路由 ────────────────────────────────────────────────

// GET /api/proposals
router.get('/proposals', (req, res) => {
  const { status } = req.query
  const sql = status
    ? 'SELECT * FROM seai_proposals WHERE status=? ORDER BY created_at DESC'
    : "SELECT * FROM seai_proposals ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, created_at DESC"
  const params = status ? [status] : []
  req.pagesDb.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message })
    res.json(rows.map(parsePayload))
  })
})

// GET /api/proposals/stats
router.get('/proposals/stats', (req, res) => {
  req.pagesDb.all(
    "SELECT status, COUNT(*) as count FROM seai_proposals GROUP BY status",
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message })
      const stats = { pending: 0, approved: 0, rejected: 0, auto_applied: 0 }
      for (const r of rows) stats[r.status] = r.count
      res.json(stats)
    }
  )
})

// GET /api/proposals/:id
router.get('/proposals/:id', (req, res) => {
  req.pagesDb.get('SELECT * FROM seai_proposals WHERE id=?', [req.params.id], (err, row) => {
    if (err)  return res.status(500).json({ error: err.message })
    if (!row) return res.status(404).json({ error: 'not found' })
    res.json(parsePayload(row))
  })
})

// POST /api/proposals/:id/resolve
router.post('/proposals/:id/resolve', async (req, res) => {
  const { action } = req.body  // approve | reject
  if (!['approve', 'reject'].includes(action))
    return res.status(400).json({ error: 'action must be approve or reject' })

  req.pagesDb.get('SELECT * FROM seai_proposals WHERE id=?', [req.params.id], (err, row) => {
    if (err)  return res.status(500).json({ error: err.message })
    if (!row) return res.status(404).json({ error: 'not found' })

    if (action === 'approve') autoApply(req.pagesDb, row)

    req.pagesDb.run(
      `UPDATE seai_proposals SET status=?, resolved_at=datetime('now'), resolved_by='user' WHERE id=?`,
      [action === 'approve' ? 'approved' : 'rejected', req.params.id],
      function(e) {
        if (e) return res.status(500).json({ error: e.message })
        broadcast('proposal_resolved', { id: req.params.id, action })
        res.json({ ok: true })
      }
    )
  })
})

// DELETE /api/proposals/:id
router.delete('/proposals/:id', (req, res) => {
  req.pagesDb.run('DELETE FROM seai_proposals WHERE id=?', [req.params.id], function(err) {
    if (err)           return res.status(500).json({ error: err.message })
    if (!this.changes) return res.status(404).json({ error: 'not found' })
    res.json({ ok: true })
  })
})

// ── SSE 端点 ─────────────────────────────────────────────────

// GET /api/events  （SSE 不支持自定义 header，允许 ?token= 鉴权）
router.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  // 心跳（防止代理 15s 超时断连）
  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n') } catch { clearInterval(heartbeat) }
  }, 10000)

  sseClients.add(res)

  // 连接后立即推送 pending 数量
  req.pagesDb.get(
    "SELECT COUNT(*) as count FROM seai_proposals WHERE status='pending'",
    [],
    (err, row) => {
      if (!err) res.write(`event: connected\ndata: ${JSON.stringify({ pending: row?.count || 0 })}\n\n`)
    }
  )

  req.on('close', () => {
    clearInterval(heartbeat)
    sseClients.delete(res)
  })
})

// ── WebSocket 接入（SEAI 推送通道）───────────────────────────

function attachWebSocket(httpServer, pagesDb) {
  const wss = new WebSocket.Server({ server: httpServer, path: '/ws/seai' })

  wss.on('connection', (ws, req) => {
    console.log('[WS] SEAI connected from', req.socket.remoteAddress)

    ws.on('message', async (raw) => {
      let msg
      try { msg = JSON.parse(raw) } catch { return }

      const { type, entity_id = '', entity_type = '', payload = {}, message = '' } = msg

      if (!type) return

      // 冲突检测
      const conflictWith = await detectConflict(pagesDb, type, entity_id, entity_type)
      const requiresReview = conflictWith !== null || type === 'tag_tree'
      const status = requiresReview ? 'pending' : 'auto_applied'

      const id = genId()
      pagesDb.run(
        `INSERT INTO seai_proposals (id, source, type, entity_id, entity_type, payload, conflict_with, status, message)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [
          id, 'seai', type, entity_id, entity_type,
          JSON.stringify(payload),
          conflictWith ? JSON.stringify(conflictWith) : null,
          status,
          message,
        ],
        function(err) {
          if (err) { console.error('[WS] insert proposal failed', err.message); return }

          if (!requiresReview) {
            autoApply(pagesDb, { type, entity_id, entity_type, payload })
          }

          // 广播给前端
          broadcast('proposal', {
            id, type, entity_id, entity_type,
            payload, conflict_with: conflictWith,
            status, message,
            created_at: new Date().toISOString(),
          })

          // 回执给 SEAI
          ws.send(JSON.stringify({ ok: true, id, status }))
        }
      )
    })

    ws.on('close', () => console.log('[WS] SEAI disconnected'))
    ws.on('error', err => console.error('[WS] error', err.message))
  })

  console.log('[WS] SEAI WebSocket ready at ws://localhost:3002/ws/seai')
  return wss
}

// ── init ─────────────────────────────────────────────────────
function init(pagesDb) {
  _pagesDb = pagesDb
  return router
}

module.exports = { init, attachWebSocket, broadcast }
