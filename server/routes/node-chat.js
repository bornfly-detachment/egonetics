/**
 * routes/node-chat.js
 * /api/node-chat — PRVSE 节点对话历史持久化
 *
 * GET    /node-chat/:nodeId        — 加载历史（最近 200 条）
 * POST   /node-chat/:nodeId        — 追加一条消息
 * DELETE /node-chat/:nodeId        — 清空该节点所有历史
 */

const express = require('express')
const router  = express.Router()

function init(pagesDb) {
  // ── 建表（首次启动自动创建）──────────────────────────────────
  pagesDb.run(`
    CREATE TABLE IF NOT EXISTS node_chat_history (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      node_id    TEXT    NOT NULL,
      user_id    INTEGER NOT NULL,
      role       TEXT    NOT NULL,
      content    TEXT    NOT NULL,
      tier_label TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    )
  `)
  pagesDb.run(`
    CREATE INDEX IF NOT EXISTS idx_nch_node
    ON node_chat_history(node_id, user_id, created_at)
  `)

  // GET /node-chat/:nodeId
  router.get('/node-chat/:nodeId', (req, res) => {
    const { nodeId } = req.params
    const userId = req.user.id
    const limit  = Math.min(parseInt(req.query.limit ?? '200', 10), 500)

    pagesDb.all(
      `SELECT id, role, content, tier_label, created_at
       FROM node_chat_history
       WHERE node_id = ? AND user_id = ?
       ORDER BY created_at ASC, id ASC
       LIMIT ?`,
      [nodeId, userId, limit],
      (err, rows) => {
        if (err) return res.status(500).json({ error: err.message })
        res.json({ messages: rows ?? [] })
      }
    )
  })

  // POST /node-chat/:nodeId
  router.post('/node-chat/:nodeId', (req, res) => {
    const { nodeId } = req.params
    const userId = req.user.id
    const { role, content, tier_label } = req.body

    if (!role || !content) {
      return res.status(400).json({ error: 'role 和 content 必填' })
    }
    if (!['user', 'assistant'].includes(role)) {
      return res.status(400).json({ error: 'role 必须是 user 或 assistant' })
    }

    pagesDb.run(
      `INSERT INTO node_chat_history (node_id, user_id, role, content, tier_label)
       VALUES (?, ?, ?, ?, ?)`,
      [nodeId, userId, role, content, tier_label ?? null],
      function (err) {
        if (err) return res.status(500).json({ error: err.message })
        res.status(201).json({ id: this.lastID })
      }
    )
  })

  // DELETE /node-chat/:nodeId
  router.delete('/node-chat/:nodeId', (req, res) => {
    const { nodeId } = req.params
    const userId = req.user.id

    pagesDb.run(
      `DELETE FROM node_chat_history WHERE node_id = ? AND user_id = ?`,
      [nodeId, userId],
      function (err) {
        if (err) return res.status(500).json({ error: err.message })
        res.json({ deleted: this.changes })
      }
    )
  })

  return router
}

module.exports = { init }
