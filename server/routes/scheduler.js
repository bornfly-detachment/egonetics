/**
 * routes/scheduler.js — 智能资源调度 REST API
 *
 * POST /api/scheduler/score          — Score a single task, return tier
 * POST /api/scheduler/batch          — Score multiple tasks
 * GET  /api/scheduler/analysis       — Analyze run history, return tier recommendations
 * GET  /api/scheduler/thresholds     — Return tier thresholds (CRUD readable)
 */

const express = require('express')
const router = express.Router()
const { scoreTask, scheduleBatch, analyzeRunHistory, TIER_THRESHOLDS } = require('../lib/resource-scheduler')
const { pagesDb } = require('../db')

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    pagesDb.all(sql, params, (err, rows) => {
      if (err) reject(err)
      else resolve(rows || [])
    })
  })
}

// POST /scheduler/score — score a single task
router.post('/scheduler/score', (req, res) => {
  try {
    const { title, description, priority, sub_count } = req.body
    if (!title && !description) {
      return res.status(400).json({ error: 'title or description required' })
    }
    const result = scoreTask({ title, description, priority, sub_count })
    res.json(result)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /scheduler/batch — score multiple tasks
router.post('/scheduler/batch', (req, res) => {
  try {
    const { tasks } = req.body
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return res.status(400).json({ error: 'tasks array required' })
    }
    if (tasks.length > 100) {
      return res.status(400).json({ error: 'max 100 tasks per batch' })
    }
    const results = scheduleBatch(tasks)
    const distribution = {}
    for (const r of results) {
      distribution[r.tier] = (distribution[r.tier] || 0) + 1
    }
    res.json({ count: results.length, distribution, results })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /scheduler/analysis — analyze execution run history
router.get('/scheduler/analysis', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200)
    const runs = await dbAll(
      'SELECT id, task_id, status, current_tier, api_calls, created_at FROM execution_runs ORDER BY created_at DESC LIMIT ?',
      [limit]
    )
    const analysis = analyzeRunHistory(runs)
    res.json({ ...analysis, run_count: runs.length, analyzed_at: new Date().toISOString() })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /scheduler/thresholds — return tier thresholds
router.get('/scheduler/thresholds', (req, res) => {
  try {
    res.json({
      tiers: Object.entries(TIER_THRESHOLDS).map(([tier, [min, max]]) => ({
        tier,
        score_min: min,
        score_max: max === 999 ? null : max,
        description: {
          T0: 'SEAI local model — simple, short tasks',
          T1: 'MiniMax cloud — moderate complexity',
          T2: 'Claude — complex, architectural tasks',
        }[tier] || tier,
      })),
      max_score: 12,
      factors: ['description_length', 'complexity_keywords', 'priority', 'code_keywords', 'subtask_count'],
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /scheduler/score-tasks — score all pending tasks from DB
router.get('/scheduler/score-tasks', async (req, res) => {
  try {
    const column = req.query.column_id || null
    const where = column
      ? "page_type = 'task' AND parent_id IS NULL AND column_id = ?"
      : "page_type = 'task' AND parent_id IS NULL AND column_id NOT IN ('done')"
    const params = column ? [column] : []
    const rows = await dbAll(
      `SELECT id, title, priority, task_outcome, task_summary FROM pages WHERE ${where} LIMIT 50`,
      params
    )
    const results = scheduleBatch(rows)
    const distribution = {}
    for (const r of results) {
      distribution[r.tier] = (distribution[r.tier] || 0) + 1
    }
    res.json({ count: results.length, distribution, results })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
