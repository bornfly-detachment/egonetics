/**
 * routes/compiler.js
 *
 * PRVSE Human-AI Compiler — HTTP Interaction Layer
 *
 * The human-machine interface for the constitutional compiler.
 * "言出法随" — but everything passes through constitution first.
 *
 * Endpoints:
 *   POST /api/compiler/compile   — compile any input
 *   POST /api/compiler/confirm   — approve/reject pending node
 *   GET  /api/compiler/status    — compressed system view
 *   GET  /api/compiler/nodes     — query compiled nodes
 *   GET  /api/compiler/nodes/:id — get specific node
 */

const express = require('express')
const router = express.Router()

let compiler = null

function init() {
  compiler = require('../lib/prvse-compiler')

  // ── POST /compiler/compile ─────────────────────────────────
  // The sole entry point. Any input → compile → constitution check → PNode
  router.post('/compiler/compile', async (req, res) => {
    const { content, source, actor, infoLevel, tier } = req.body

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'content is required' })
    }

    try {
      const result = await compiler.compile({
        content,
        source: source || { origin: 'external', type: 'user_input' },
        actor: actor || 'T2',
        infoLevel: infoLevel || 'L2_subjective',
        tier: tier || 'T1',
      })

      // Return compressed view — human sees everything needed to decide
      const response = {
        success: result.success,
        pnode: result.pnode ? {
          id: result.pnode.id,
          version: result.pnode.version,
          hash: result.pnode.hash,
          summary: result.pnode.summary,
          token: result.pnode.token,
          constitution: result.pnode.constitution,
          nextAction: result.pnode.nextAction,
        } : null,
        cost: result.cost ? {
          tier: result.cost.tier,
          model: result.cost.model,
          elapsed: result.cost.elapsed,
          tokens: (result.cost.inputTokens || 0) + (result.cost.outputTokens || 0),
        } : null,
        error: result.error || null,
      }

      res.json(response)
    } catch (err) {
      console.error('[compiler/compile] error:', err.message)
      res.status(500).json({ error: err.message })
    }
  })

  // ── POST /compiler/confirm ─────────────────────────────────
  // Human approves or rejects a pending PNode
  router.post('/compiler/confirm', (req, res) => {
    const { pnodeId, action, reason } = req.body

    if (!pnodeId) {
      return res.status(400).json({ error: 'pnodeId is required' })
    }
    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'action must be "approve" or "reject"' })
    }

    const result = compiler.confirm(pnodeId, action, reason)
    if (!result.success) {
      return res.status(404).json(result)
    }

    res.json(result)
  })

  // ── GET /compiler/status ───────────────────────────────────
  // Compressed system view — minimal tokens, full picture
  // "自顶向下可见全局抽象，用最小的 token 上下文就能控制整个系统"
  router.get('/compiler/status', (req, res) => {
    res.json(compiler.getStatus())
  })

  // ── GET /compiler/nodes ────────────────────────────────────
  // Query compiled nodes with filters
  router.get('/compiler/nodes', (req, res) => {
    const { status, semantic, destination, limit } = req.query
    const filter = {}
    if (status) filter.status = status
    if (semantic) filter.semantic = semantic
    if (destination) filter.destination = destination
    if (limit) filter.limit = parseInt(limit, 10)

    res.json(compiler.queryNodes(filter))
  })

  // ── GET /compiler/nodes/:id ────────────────────────────────
  // Get specific PNode detail
  router.get('/compiler/nodes/:id', (req, res) => {
    const node = compiler.getNode(req.params.id)
    if (!node) {
      return res.status(404).json({ error: `PNode ${req.params.id} not found` })
    }
    res.json(node)
  })

  return router
}

module.exports = { init }
