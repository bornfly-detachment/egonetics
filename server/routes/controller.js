/**
 * routes/controller.js — 控制器 REST API
 *
 * GET  /api/controller/state    — Get last controller state
 * POST /api/controller/tick     — Trigger one controller evaluation cycle
 * POST /api/controller/start    — Start periodic ticks
 * POST /api/controller/stop     — Stop periodic ticks
 * GET  /api/controller/thresholds — Get/update alert thresholds (CRUD)
 * PATCH /api/controller/thresholds — Update a threshold value
 */

const express = require('express')
const router = express.Router()
const controller = require('../lib/controller')

let _kernelRuntime = null

function init(kernelRuntime) {
  _kernelRuntime = kernelRuntime
  return router
}

// GET /controller/state
router.get('/controller/state', (req, res) => {
  try {
    const state = controller.getLastState()
    if (!state) return res.json({ status: 'no_tick_yet', message: 'Controller has not run yet' })
    res.json(state)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /controller/tick — trigger one evaluation
router.post('/controller/tick', async (req, res) => {
  try {
    const state = await controller.tick(_kernelRuntime)
    res.json(state)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /controller/start
router.post('/controller/start', (req, res) => {
  try {
    controller.start(_kernelRuntime)
    res.json({ ok: true, status: 'started', controller_id: controller.CONTROLLER_ID })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /controller/stop
router.post('/controller/stop', (req, res) => {
  try {
    controller.stop()
    res.json({ ok: true, status: 'stopped' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /controller/thresholds — read current thresholds
router.get('/controller/thresholds', (req, res) => {
  try {
    res.json({
      thresholds: controller.ALERT_THRESHOLDS,
      description: {
        tier_pressure: 'Max ratio of T2/human runs (0-1). Above this → alert.',
        failure_rate: 'Max ratio of failed runs (0-1). Above this → alert.',
        active_runs_max: 'Max number of concurrent active runs. Above this → alert.',
      }
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// PATCH /controller/thresholds — update a threshold
router.patch('/controller/thresholds', (req, res) => {
  try {
    const { key, value } = req.body
    if (!key || value === undefined) {
      return res.status(400).json({ error: 'key and value required' })
    }
    if (!(key in controller.ALERT_THRESHOLDS)) {
      return res.status(400).json({ error: `Unknown threshold key: ${key}. Valid: ${Object.keys(controller.ALERT_THRESHOLDS).join(', ')}` })
    }
    if (typeof value !== 'number' || value < 0) {
      return res.status(400).json({ error: 'value must be a non-negative number' })
    }
    controller.ALERT_THRESHOLDS[key] = value
    res.json({ ok: true, key, new_value: value, thresholds: controller.ALERT_THRESHOLDS })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = { init }
