/**
 * routes/mq.js — Message Queue REST API
 *
 * POST   /api/mq/publish          发布消息
 * GET    /api/mq/messages          查询消息
 * GET    /api/mq/messages/:id      单条消息
 * PATCH  /api/mq/messages/:id      更新状态 (ack/resolve)
 * POST   /api/mq/batch-ack         批量确认
 * GET    /api/mq/stats             统计
 * GET    /api/mq/count             计数 (供 Kernel contract 调用)
 */

const express = require('express')
const router = express.Router()
const mq = require('../lib/mq')

// POST /api/mq/publish
router.post('/mq/publish', async (req, res) => {
  try {
    const { channel, event_type, tier, payload, source_id } = req.body
    if (!channel || !event_type) {
      return res.status(400).json({ error: 'channel and event_type required' })
    }
    const result = await mq.publish({ channel, event_type, tier, payload, source_id })
    res.status(201).json(result)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/mq/messages?channel=&event_type=&source_id=&status=&limit=
router.get('/mq/messages', async (req, res) => {
  try {
    const { channel, event_type, source_id, status, limit } = req.query
    const rows = await mq.query({
      channel, event_type, source_id, status,
      limit: limit ? parseInt(limit) : 50,
    })
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/mq/messages/:id
router.get('/mq/messages/:id', async (req, res) => {
  try {
    const rows = await mq.query({ limit: 1 })
    // Direct query for single message
    const { pagesDb } = require('../db')
    pagesDb.get('SELECT * FROM mq_messages WHERE id = ?', [req.params.id], (err, row) => {
      if (err) return res.status(500).json({ error: err.message })
      if (!row) return res.status(404).json({ error: 'message not found' })
      res.json({ ...row, payload: JSON.parse(row.payload || '{}') })
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// PATCH /api/mq/messages/:id — { status, resolution? }
router.patch('/mq/messages/:id', async (req, res) => {
  try {
    const { status, resolution } = req.body
    if (!status || !['dispatched', 'resolved', 'expired'].includes(status)) {
      return res.status(400).json({ error: 'status must be dispatched|resolved|expired' })
    }
    const result = await mq.ack(req.params.id, status, resolution)
    res.json(result)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/mq/batch-ack — { ids: string[], status? }
router.post('/mq/batch-ack', async (req, res) => {
  try {
    const { ids, status } = req.body
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array required' })
    }
    const result = await mq.batchAck(ids, status || 'dispatched')
    res.json(result)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/mq/stats
router.get('/mq/stats', async (req, res) => {
  try {
    const rows = await mq.stats()
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/mq/count?channel=&event_type=&source_id=&window_sec=
router.get('/mq/count', async (req, res) => {
  try {
    const { channel, event_type, source_id, window_sec } = req.query
    const count = await mq.countPending({
      channel, event_type, source_id,
      window_sec: window_sec ? parseInt(window_sec) : 3600,
    })
    res.json({ count })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
