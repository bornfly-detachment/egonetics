/**
 * server/routes/free-code.js
 *
 * HTTP-side endpoints for free-code harness configuration.
 * WebSocket lives in free-code-ws.js; this is sibling metadata API.
 *
 * Endpoints:
 *   GET  /api/free-code/tiers    — list all configured tiers (T0/T1/T2 etc)
 *   GET  /api/free-code/status   — isolation status + default tier
 */

'use strict'

const express = require('express')
const router = express.Router()
const harnessRunner = require('../lib/harness-runner')

// GET /api/free-code/tiers
router.get('/tiers', (_req, res) => {
  try {
    res.json(harnessRunner.listTiers())
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/free-code/status
router.get('/status', (_req, res) => {
  try {
    res.json({
      isolation: harnessRunner.getIsolationStatus(),
      tiers: harnessRunner.listTiers(),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
