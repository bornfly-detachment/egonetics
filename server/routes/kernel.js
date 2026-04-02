/**
 * routes/kernel.js — PRVSE Kernel REST API
 *
 * State/Nodes/Contracts/Ports/Tick/Fitness/Effects/Constitution
 * + Execution Engine (升级链 T0→T1→T2→Human)
 * + Decision Queue (人裁决)
 */

const express = require('express')
const { pagesDb } = require('../db')

function genId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    pagesDb.run(sql, params, function (err) { err ? reject(err) : resolve(this) })
  })
}
function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    pagesDb.get(sql, params, (err, row) => { err ? reject(err) : resolve(row) })
  })
}
function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    pagesDb.all(sql, params, (err, rows) => { err ? reject(err) : resolve(rows) })
  })
}

exports.init = (kernelRuntime) => {
  const router = express.Router()
  const kr = kernelRuntime

  // ══════════════════════════════════════════════════════════════
  //  Kernel Core API
  // ══════════════════════════════════════════════════════════════

  // GET /api/kernel/state
  router.get('/kernel/state', (req, res) => {
    try {
      res.json(kr.getState())
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // POST /api/kernel/nodes  — { id, values? }
  router.post('/kernel/nodes', (req, res) => {
    try {
      const { id, values } = req.body
      if (!id) return res.status(400).json({ error: 'id is required' })
      res.status(201).json(kr.addNode(id, values))
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // DELETE /api/kernel/nodes/:id
  router.delete('/kernel/nodes/:id', (req, res) => {
    try {
      res.json(kr.removeNode(req.params.id))
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // PATCH /api/kernel/nodes/:id  — { field, value }
  router.patch('/kernel/nodes/:id', (req, res) => {
    try {
      const { field, value } = req.body
      if (!field) return res.status(400).json({ error: 'field is required' })
      res.json(kr.setNodeValue(req.params.id, field, value))
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // POST /api/kernel/contracts  — { id?, type?, priority?, participants, conditionCode, emitCode }
  router.post('/kernel/contracts', (req, res) => {
    try {
      const result = kr.registerContract(req.body, req.body.source || 'human')
      if (!result.accepted) {
        return res.status(422).json(result)
      }
      res.status(201).json(result)
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // DELETE /api/kernel/contracts/:id
  router.delete('/kernel/contracts/:id', (req, res) => {
    try {
      res.json(kr.unregisterContract(req.params.id))
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // POST /api/kernel/ports/:id  — { value }
  router.post('/kernel/ports/:id', (req, res) => {
    try {
      res.json(kr.writePort(req.params.id, req.body.value))
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // POST /api/kernel/mutate  — immediate state change, no tick required
  //   body: { type, ...params }
  //   Commands: node.set, node.add, node.remove, port.write, contract.register, contract.unregister
  router.post('/kernel/mutate', async (req, res) => {
    try {
      const command = req.body
      if (!command || !command.type) {
        return res.status(400).json({ error: 'command.type is required' })
      }
      const result = await kr.mutate(command)
      if (!result.ok) {
        return res.status(422).json(result)
      }
      res.json(result)
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // POST /api/kernel/tick  — execute one tick
  router.post('/kernel/tick', async (req, res) => {
    try {
      const result = await kr.executeTick()
      res.json(result)
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // POST /api/kernel/tick/batch  — { count }
  router.post('/kernel/tick/batch', async (req, res) => {
    try {
      const count = Math.min(req.body.count || 1, 100)
      const results = await kr.executeTicks(count)
      res.json({ ticks: results.length, results })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // GET /api/kernel/fitness
  router.get('/kernel/fitness', (req, res) => {
    try {
      res.json(kr.getFitnessRates())
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // GET /api/kernel/effects  — ?limit=50
  router.get('/kernel/effects', (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 50, 200)
      res.json(kr.getEffectHistory(limit))
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // POST /api/kernel/constitution/check  — dry-run validate a contract
  router.post('/kernel/constitution/check', (req, res) => {
    try {
      res.json(kr.checkConstitution(req.body))
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // POST /api/kernel/establish-rule  — validate → register contract → write hm_protocol
  // Body: { name, summary, layer, kernel: {type,priority,participants,conditionCode,emitCode},
  //         protocol: {category,human_char,machine_lang}, node_id, anchor_tag_id? }
  router.post('/kernel/establish-rule', async (req, res) => {
    const { name, layer = 'l1', kernel: kernelSpec, protocol: protoSpec, node_id, anchor_tag_id } = req.body

    if (!kernelSpec?.conditionCode || !kernelSpec?.emitCode) {
      return res.status(400).json({ error: 'kernel.conditionCode 和 kernel.emitCode 必填' })
    }

    // ── Step 1: Kernel 宪法校验 ────────────────────────────────
    let checkResult
    try {
      checkResult = kr.checkConstitution({ ...kernelSpec, participants: kernelSpec.participants || [] })
    } catch (e) {
      return res.status(422).json({ valid: false, feedback: `Kernel 校验异常: ${e.message}` })
    }

    const isValid = checkResult?.ok === true || checkResult?.valid === true
    if (!isValid) {
      return res.status(422).json({
        valid: false,
        issues: checkResult?.issues || [],
        feedback: checkResult?.reason || checkResult?.feedback || '规则校验失败',
      })
    }

    // ── Step 2: 注册 Kernel 合约 ──────────────────────────────
    const contractId = `rule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    let contractResult
    try {
      contractResult = kr.registerContract(
        { id: contractId, ...kernelSpec, participants: kernelSpec.participants || [] },
        'constitution'
      )
    } catch (e) {
      return res.status(500).json({ valid: false, feedback: `合约注册异常: ${e.message}` })
    }

    if (!contractResult?.accepted) {
      return res.status(422).json({ valid: false, feedback: contractResult?.reason || '合约被 Kernel 拒绝' })
    }

    // ── Step 3: 写入 hm_protocol（有 anchor_tag_id 时）────────
    let protoId = null
    if (anchor_tag_id && protoSpec) {
      const tag = await dbGet('SELECT id FROM tag_trees WHERE id = ?', [anchor_tag_id])
      if (tag) {
        const pid = `proto-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`
        try {
          await dbRun(
            `INSERT INTO hm_protocol (id, category, layer, human_char, ui_visual, machine_lang, notes, sort_order, anchor_tag_id)
             VALUES (?,?,?,?,?,?,?,?,?)`,
            [
              pid,
              protoSpec.category || '分级约束控制层',
              layer,
              protoSpec.human_char || name || '',
              '{}',
              typeof protoSpec.machine_lang === 'object'
                ? JSON.stringify(protoSpec.machine_lang)
                : (protoSpec.machine_lang || JSON.stringify(kernelSpec)),
              `contract_id:${contractId} node_id:${node_id || ''}`,
              0,
              anchor_tag_id,
            ]
          )
          protoId = pid
        } catch (e) {
          console.error('[establish-rule] hm_protocol insert failed:', e.message)
        }
      }
    }

    res.json({
      valid: true,
      contractId,
      protoId,
      feedback: `宪法规则已建立 — Kernel 合约 ${contractId}${protoId ? ` / 协议条目 ${protoId}` : ''}`,
    })
  })

  // POST /api/kernel/reset  — reset runtime (dev only)
  router.post('/kernel/reset', (req, res) => {
    try {
      res.json(kr.resetRuntime())
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // GET /api/kernel/snapshots  — ?limit=20
  router.get('/kernel/snapshots', async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 20, 100)
      const rows = await dbAll(
        'SELECT tick, state_json, effects_json, created_at FROM kernel_snapshots ORDER BY tick DESC LIMIT ?',
        [limit]
      )
      res.json(rows.map(r => ({
        tick: r.tick,
        state: JSON.parse(r.state_json),
        effects: JSON.parse(r.effects_json),
        created_at: r.created_at,
      })))
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // GET /api/kernel/task-effects/:taskId  — kernel-driven task state changes
  router.get('/kernel/task-effects/:taskId', async (req, res) => {
    try {
      const rows = await dbAll(
        'SELECT * FROM kernel_task_effects WHERE task_id = ? ORDER BY tick DESC LIMIT 50',
        [req.params.taskId]
      )
      res.json(rows.map(r => ({
        ...r,
        effect_json: JSON.parse(r.effect_json || '{}'),
      })))
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // ══════════════════════════════════════════════════════════════
  //  Execution Engine — 升级链 T0→T1→T2→Human
  // ══════════════════════════════════════════════════════════════

  // POST /api/kernel/executions  — start a new execution run for a task
  //   body: { task_id, auto?: boolean }
  //   auto=true (default) → launches T0→T1→T2→Human executor in background
  //   auto=false → creates run record only (manual step-by-step)
  router.post('/kernel/executions', async (req, res) => {
    try {
      const { task_id, auto } = req.body
      if (!task_id) return res.status(400).json({ error: 'task_id is required' })
      const id = genId('run')
      await dbRun(
        `INSERT INTO execution_runs (id, task_id, status, current_tier, steps, api_calls, escalations)
         VALUES (?, ?, 'running', 'T0', '[]', 0, '[]')`,
        [id, task_id]
      )

      // Auto-execute: fetch task description and launch executor
      const shouldAuto = auto !== false
      if (shouldAuto) {
        // Get task description
        const task = await dbGet(
          `SELECT title, icon FROM pages WHERE id = ? AND page_type = 'task'`,
          [task_id]
        )
        const taskDesc = task?.title || `Task ${task_id}`

        // Fire and forget — executor runs in background
        const { executeTask } = require('../lib/executor')
        console.log(`[executor] starting run ${id} for task "${taskDesc}"`)
        executeTask(id, task_id, taskDesc)
          .then(() => console.log(`[executor] run ${id} finished`))
          .catch(err => console.error(`[executor] run ${id} fatal error:`, err.message, err.stack))
      }

      res.status(201).json({ id, task_id, status: 'running', current_tier: 'T0', auto: shouldAuto })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // GET /api/kernel/executions  — list runs, optional ?task_id=xxx&status=xxx
  router.get('/kernel/executions', async (req, res) => {
    try {
      const { task_id, status } = req.query
      const where = []; const params = []
      if (task_id) { where.push('task_id = ?'); params.push(task_id) }
      if (status)  { where.push('status = ?');  params.push(status) }
      const sql = where.length
        ? `SELECT * FROM execution_runs WHERE ${where.join(' AND ')} ORDER BY created_at DESC`
        : 'SELECT * FROM execution_runs ORDER BY created_at DESC LIMIT 50'
      const rows = await dbAll(sql, params)
      res.json(rows.map(r => ({
        ...r,
        steps: JSON.parse(r.steps || '[]'),
        escalations: JSON.parse(r.escalations || '[]'),
        result: r.result ? JSON.parse(r.result) : null,
      })))
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // GET /api/kernel/executions/:id
  router.get('/kernel/executions/:id', async (req, res) => {
    try {
      const row = await dbGet('SELECT * FROM execution_runs WHERE id = ?', [req.params.id])
      if (!row) return res.status(404).json({ error: 'execution not found' })
      res.json({
        ...row,
        steps: JSON.parse(row.steps || '[]'),
        escalations: JSON.parse(row.escalations || '[]'),
        result: row.result ? JSON.parse(row.result) : null,
      })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // PATCH /api/kernel/executions/:id  — update run (add step, escalate, complete)
  router.patch('/kernel/executions/:id', async (req, res) => {
    try {
      const row = await dbGet('SELECT * FROM execution_runs WHERE id = ?', [req.params.id])
      if (!row) return res.status(404).json({ error: 'execution not found' })

      const steps = JSON.parse(row.steps || '[]')
      const escalations = JSON.parse(row.escalations || '[]')
      let apiCalls = row.api_calls
      let currentTier = row.current_tier
      let status = row.status

      // Add a step
      if (req.body.step) {
        const step = { ...req.body.step, tier: currentTier, at: new Date().toISOString() }
        steps.push(step)
        apiCalls++

        // Auto-escalation logic: 10 failed API calls at current tier → escalate
        const tierSteps = steps.filter(s => s.tier === currentTier)
        const tierFails = tierSteps.filter(s => s.success === false).length
        if (tierFails >= 10 && currentTier !== 'human') {
          const TIER_ORDER = ['T0', 'T1', 'T2', 'human']
          const nextIdx = TIER_ORDER.indexOf(currentTier) + 1
          const nextTier = TIER_ORDER[nextIdx] || 'human'
          escalations.push({
            from_tier: currentTier,
            to_tier: nextTier,
            reason: `${tierFails} failed API calls at ${currentTier}`,
            at: new Date().toISOString(),
          })
          currentTier = nextTier

          // If escalated to human, create a decision request
          if (nextTier === 'human') {
            status = 'escalated'
            const decId = genId('dec')
            await dbRun(
              `INSERT INTO decisions (id, run_id, type, status, context, options)
               VALUES (?, ?, 'escalation', 'pending', ?, ?)`,
              [
                decId, req.params.id,
                JSON.stringify({
                  task_id: row.task_id,
                  reason: `All AI tiers exhausted after ${apiCalls} API calls`,
                  last_steps: steps.slice(-5),
                }),
                JSON.stringify(['retry_t2', 'manual_fix', 'abort']),
              ]
            )
          }
        }
      }

      // Manual escalation
      if (req.body.escalate_to) {
        escalations.push({
          from_tier: currentTier,
          to_tier: req.body.escalate_to,
          reason: req.body.escalate_reason || 'manual',
          at: new Date().toISOString(),
        })
        currentTier = req.body.escalate_to
        if (req.body.escalate_to === 'human') status = 'escalated'
      }

      // Complete
      if (req.body.status === 'completed' || req.body.status === 'failed') {
        status = req.body.status
      }

      const result = req.body.result ? JSON.stringify(req.body.result) : row.result

      await dbRun(
        `UPDATE execution_runs
         SET steps = ?, api_calls = ?, escalations = ?, current_tier = ?,
             status = ?, result = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [JSON.stringify(steps), apiCalls, JSON.stringify(escalations), currentTier, status, result, req.params.id]
      )

      res.json({
        id: req.params.id, status, current_tier: currentTier,
        api_calls: apiCalls, steps, escalations,
        result: result ? JSON.parse(result) : null,
      })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // ══════════════════════════════════════════════════════════════
  //  SEAI Local Inference — T0 本地推理
  // ══════════════════════════════════════════════════════════════

  // GET /api/kernel/seai/health
  router.get('/kernel/seai/health', async (req, res) => {
    try {
      const { checkSEAIHealth } = require('../lib/executor')
      const ready = await checkSEAIHealth()
      res.json({ available: ready })
    } catch (e) {
      res.json({ available: false, error: e.message })
    }
  })

  // POST /api/kernel/seai/generate  — { prompt, system?, max_tokens?, temperature? }
  router.post('/kernel/seai/generate', async (req, res) => {
    try {
      const { callSEAI, checkSEAIHealth } = require('../lib/executor')
      const ready = await checkSEAIHealth()
      if (!ready) return res.status(503).json({ error: 'SEAI local model not available' })
      const result = await callSEAI(req.body.prompt, req.body)
      res.json(result)
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // POST /api/kernel/seai/judge  — { question, context?, constitution_hint? }
  router.post('/kernel/seai/judge', async (req, res) => {
    try {
      const { callSEAIJudge, checkSEAIHealth } = require('../lib/executor')
      const ready = await checkSEAIHealth()
      if (!ready) return res.status(503).json({ error: 'SEAI local model not available' })
      const { question, context, constitution_hint } = req.body
      if (!question) return res.status(400).json({ error: 'question is required' })
      const result = await callSEAIJudge(question, context, constitution_hint)
      res.json(result)
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // ══════════════════════════════════════════════════════════════
  //  Decision Queue — 人裁决
  // ══════════════════════════════════════════════════════════════

  // GET /api/kernel/decisions  — ?status=pending
  router.get('/kernel/decisions', async (req, res) => {
    try {
      const { status, run_id } = req.query
      const where = []; const params = []
      if (status) { where.push('status = ?'); params.push(status) }
      if (run_id) { where.push('run_id = ?'); params.push(run_id) }
      const sql = where.length
        ? `SELECT * FROM decisions WHERE ${where.join(' AND ')} ORDER BY created_at DESC`
        : 'SELECT * FROM decisions ORDER BY created_at DESC LIMIT 50'
      const rows = await dbAll(sql, params)
      res.json(rows.map(r => ({
        ...r,
        context: JSON.parse(r.context || '{}'),
        options: r.options ? JSON.parse(r.options) : null,
        human_response: r.human_response ? JSON.parse(r.human_response) : null,
      })))
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // POST /api/kernel/decisions  — create a decision request (for rule triggers, approvals, etc.)
  router.post('/kernel/decisions', async (req, res) => {
    try {
      const { run_id, type, context, options } = req.body
      if (!run_id || !type || !context) {
        return res.status(400).json({ error: 'run_id, type, and context are required' })
      }
      const id = genId('dec')
      await dbRun(
        `INSERT INTO decisions (id, run_id, type, status, context, options)
         VALUES (?, ?, ?, 'pending', ?, ?)`,
        [id, run_id, type, JSON.stringify(context), options ? JSON.stringify(options) : null]
      )

      // Mark run as escalated if not already
      await dbRun(
        `UPDATE execution_runs SET status = 'escalated', updated_at = datetime('now')
         WHERE id = ? AND status = 'running'`,
        [run_id]
      )

      res.status(201).json({ id, run_id, type, status: 'pending' })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // PATCH /api/kernel/decisions/:id  — human responds
  router.patch('/kernel/decisions/:id', async (req, res) => {
    try {
      const { status, human_response } = req.body
      if (!status || !['approved', 'rejected', 'deferred'].includes(status)) {
        return res.status(400).json({ error: 'status must be approved|rejected|deferred' })
      }
      await dbRun(
        `UPDATE decisions
         SET status = ?, human_response = ?, decided_at = datetime('now')
         WHERE id = ?`,
        [status, human_response ? JSON.stringify(human_response) : null, req.params.id]
      )

      // If approved, resume the execution run
      const dec = await dbGet('SELECT * FROM decisions WHERE id = ?', [req.params.id])
      if (dec && status === 'approved') {
        await dbRun(
          `UPDATE execution_runs SET status = 'running', updated_at = datetime('now')
           WHERE id = ? AND status = 'escalated'`,
          [dec.run_id]
        )
      }
      if (dec && status === 'rejected') {
        await dbRun(
          `UPDATE execution_runs SET status = 'failed', updated_at = datetime('now')
           WHERE id = ? AND status = 'escalated'`,
          [dec.run_id]
        )
      }

      res.json({ ok: true, decision_status: status })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  return router
}
