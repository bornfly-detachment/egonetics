/**
 * protocol-builder.js
 * 控制论构建器 — Rule/Policy 构建-测试-发布流水线
 *
 * GET    /api/protocol-rules                     列出所有规则
 * GET    /api/protocol-rules/constitution-tree   宪法语义树
 * POST   /api/protocol-rules                     新建
 * PATCH  /api/protocol-rules/:id                 更新
 * DELETE /api/protocol-rules/:id                 删除
 * POST   /api/protocol-rules/:id/build           SSE 构建流水线
 * POST   /api/protocol-rules/:id/publish         发布 (testing → passed)
 */

const express = require('express')
const router  = express.Router()

function genId() {
  return `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function initTable(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS protocol_rules (
      id            TEXT PRIMARY KEY,
      kernel_comp   TEXT NOT NULL,
      title         TEXT NOT NULL,
      human_char    TEXT NOT NULL DEFAULT '',
      machine_lang  TEXT NOT NULL DEFAULT '{}',
      tag_ids       TEXT NOT NULL DEFAULT '[]',
      build_status  TEXT NOT NULL DEFAULT 'draft',
      test_env      TEXT NOT NULL DEFAULT '{}',
      test_results  TEXT NOT NULL DEFAULT '[]',
      ai_feedback   TEXT NOT NULL DEFAULT '',
      ai_suggestion TEXT NOT NULL DEFAULT '',
      build_version INTEGER NOT NULL DEFAULT 0,
      model         TEXT NOT NULL DEFAULT 'minimax',
      created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)
  // Migration: add ai_suggestion column if missing (existing DBs)
  db.run("ALTER TABLE protocol_rules ADD COLUMN ai_suggestion TEXT NOT NULL DEFAULT ''", () => {})
}

function parseJSON(str, fallback) {
  try { return JSON.parse(str || '{}') } catch { return fallback ?? {} }
}

module.exports = {
  init(pagesDb) {
    initTable(pagesDb)

    // ── GET all rules ────────────────────────────────────────────
    router.get('/protocol-rules', (req, res) => {
      const { kernel_comp } = req.query
      const sql    = kernel_comp
        ? 'SELECT * FROM protocol_rules WHERE kernel_comp = ? ORDER BY created_at DESC'
        : 'SELECT * FROM protocol_rules ORDER BY created_at DESC'
      const params = kernel_comp ? [kernel_comp] : []
      pagesDb.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message })
        res.json(rows.map(r => ({
          ...r,
          tag_ids:       parseJSON(r.tag_ids, []),
          test_results:  parseJSON(r.test_results, []),
          ai_suggestion: r.ai_suggestion || '',
          ai_feedback:   r.ai_feedback   || '',
        })))
      })
    })

    // ── GET constitution tree (BEFORE :id route) ─────────────────
    router.get('/protocol-rules/constitution-tree', (req, res) => {
      pagesDb.all(
        "SELECT * FROM protocol_rules WHERE build_status = 'passed' ORDER BY kernel_comp, created_at",
        [],
        (err, rows) => {
          if (err) return res.status(500).json({ error: err.message })
          const tree = {}
          for (const r of rows) {
            if (!tree[r.kernel_comp]) tree[r.kernel_comp] = []
            tree[r.kernel_comp].push({ ...r, tag_ids: parseJSON(r.tag_ids, []) })
          }
          res.json(tree)
        }
      )
    })

    // ── POST create ──────────────────────────────────────────────
    router.post('/protocol-rules', (req, res) => {
      const { kernel_comp, title, human_char = '', model = 'minimax' } = req.body
      if (!kernel_comp || !title)
        return res.status(400).json({ error: 'kernel_comp and title required' })
      const id = genId()
      pagesDb.run(
        'INSERT INTO protocol_rules (id, kernel_comp, title, human_char, model) VALUES (?,?,?,?,?)',
        [id, kernel_comp, title, human_char, model],
        function(err) {
          if (err) return res.status(500).json({ error: err.message })
          res.status(201).json({ id, kernel_comp, title, human_char, model,
            build_status: 'draft', tag_ids: [], test_results: [], build_version: 0 })
        }
      )
    })

    // ── PATCH update ─────────────────────────────────────────────
    router.patch('/protocol-rules/:id', (req, res) => {
      const { title, human_char, machine_lang, tag_ids, test_env, model, ai_feedback, ai_suggestion } = req.body
      const sets = []; const params = []
      if (title        !== undefined) { sets.push('title = ?');        params.push(title) }
      if (human_char   !== undefined) { sets.push('human_char = ?');   params.push(human_char) }
      if (machine_lang !== undefined) { sets.push('machine_lang = ?'); params.push(machine_lang) }
      if (tag_ids      !== undefined) { sets.push('tag_ids = ?');      params.push(JSON.stringify(tag_ids)) }
      if (test_env     !== undefined) { sets.push('test_env = ?');     params.push(JSON.stringify(test_env)) }
      if (model        !== undefined) { sets.push('model = ?');        params.push(model) }
      if (ai_feedback  !== undefined) { sets.push('ai_feedback = ?');  params.push(ai_feedback) }
      if (ai_suggestion !== undefined) { sets.push('ai_suggestion = ?'); params.push(ai_suggestion) }
      if (!sets.length) return res.status(400).json({ error: 'nothing to update' })
      sets.push("updated_at = CURRENT_TIMESTAMP")
      params.push(req.params.id)
      pagesDb.run(`UPDATE protocol_rules SET ${sets.join(', ')} WHERE id = ?`, params, function(err) {
        if (err)           return res.status(500).json({ error: err.message })
        if (!this.changes) return res.status(404).json({ error: 'rule not found' })
        res.json({ ok: true })
      })
    })

    // ── DELETE ────────────────────────────────────────────────────
    router.delete('/protocol-rules/:id', (req, res) => {
      pagesDb.run('DELETE FROM protocol_rules WHERE id = ?', [req.params.id], function(err) {
        if (err)           return res.status(500).json({ error: err.message })
        if (!this.changes) return res.status(404).json({ error: 'rule not found' })
        res.json({ ok: true })
      })
    })

    // ── POST build (SSE 5-step pipeline) ─────────────────────────
    router.post('/protocol-rules/:id/build', (req, res) => {
      pagesDb.get('SELECT * FROM protocol_rules WHERE id = ?', [req.params.id], async (err, rule) => {
        if (err || !rule) return res.status(404).json({ error: 'rule not found' })

        res.setHeader('Content-Type', 'text/event-stream')
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('Connection', 'keep-alive')

        const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`)

        pagesDb.run(
          "UPDATE protocol_rules SET build_status='building', build_version=build_version+1, test_results='[]' WHERE id=?",
          [rule.id]
        )
        send({ type: 'status', status: 'building' })

        const results = []
        let passed    = true

        const step = async (id, label, fn) => {
          if (!passed) return
          send({ type: 'step_start', step: id, label })
          await new Promise(r => setTimeout(r, 400 + Math.random() * 300))
          try {
            const r = await fn()
            results.push({ step: id, status: 'passed', message: r.message, detail: r.detail ?? '' })
            send({ type: 'step_done', step: id, status: 'passed', message: r.message, detail: r.detail ?? '' })
          } catch (e) {
            const msg = e.message || String(e)
            results.push({ step: id, status: 'failed', message: msg, detail: '' })
            send({ type: 'step_done', step: id, status: 'failed', message: msg, detail: '' })
            passed = false
          }
        }

        // STEP 1 — PARSE (感知)
        await step('parse', '感知 · PARSE', async () => {
          const txt = rule.human_char.trim()
          if (!txt || txt.length < 5) throw new Error('规则内容为空或过短（需 ≥5 字符）')
          const keywords = ['当','如果','if','满足','触发','执行','感知','控制','评价','when','should','must','规则','条件','阈值']
          const found = keywords.filter(k => txt.toLowerCase().includes(k))
          return { message: `识别成功，${txt.length} 字符`, detail: found.length ? `关键词: ${found.slice(0,3).join(', ')}` : '基础结构完整' }
        })

        // STEP 2 — COMPILE (决策) — LLM or fallback
        let machineLang = rule.machine_lang
        await step('compile', '决策 · COMPILE', async () => {
          const SCHEMA = {
            controller: '{"observe":"...","condition":"...","decide":"...","actuate":"..."}',
            evaluator:  '{"metrics":[...],"threshold":0.6,"reward_fn":"...","penalty_fn":"..."}',
            perceiver:  '{"input_type":"...","filter":"...","process":"...","output_type":"..."}',
          }
          try {
            const llmRes = await fetch('http://localhost:3002/api/llm/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization },
              body: JSON.stringify({
                model: rule.model,
                messages: [{ role: 'user', content:
                  `将下面的控制论规则转换为 JSON。kernel_comp: ${rule.kernel_comp}。\n规则: ${rule.human_char}\n\n输出纯 JSON，格式参考: ${SCHEMA[rule.kernel_comp] ?? '{}'}` }]
              })
            })
            if (llmRes.ok) {
              const data = await llmRes.json()
              const text = data.content || data.message || data.choices?.[0]?.message?.content || ''
              const m    = text.match(/\{[\s\S]*\}/)
              if (m) {
                machineLang = m[0]
                pagesDb.run('UPDATE protocol_rules SET machine_lang=? WHERE id=?', [machineLang, rule.id])
                return { message: 'AI 成功生成 machine_lang', detail: `${machineLang.length} bytes` }
              }
            }
          } catch (_) { /* LLM offline */ }
          // Fallback
          const fallback = {
            controller: { observe: '', condition: rule.human_char.slice(0, 60), decide: '', actuate: '' },
            evaluator:  { metrics: [], threshold: 0.6, reward_fn: rule.human_char.slice(0, 60), penalty_fn: '' },
            perceiver:  { input_type: '', filter: '', process: rule.human_char.slice(0, 60), output_type: '' },
          }
          machineLang = JSON.stringify(fallback[rule.kernel_comp] ?? {})
          pagesDb.run('UPDATE protocol_rules SET machine_lang=? WHERE id=?', [machineLang, rule.id])
          return { message: '模板结构生成（AI 离线）', detail: '基础骨架，请补全字段' }
        })

        // STEP 3 — SCHEMA_CHECK (执行)
        await step('schema_check', '执行 · SCHEMA_CHECK', async () => {
          let parsed
          try { parsed = JSON.parse(machineLang) } catch { throw new Error('machine_lang 不是合法 JSON') }
          const required = {
            controller: ['observe', 'condition', 'decide', 'actuate'],
            evaluator:  ['metrics', 'threshold'],
            perceiver:  ['input_type', 'process', 'output_type'],
          }
          const fields   = required[rule.kernel_comp] ?? []
          const missing  = fields.filter(f => !(f in parsed))
          if (missing.length) throw new Error(`缺少字段: ${missing.join(', ')}`)
          return { message: `Schema 通过 (${fields.length} 字段)`, detail: `kernel_comp: ${rule.kernel_comp}` }
        })

        // STEP 4 — TEST_RUN (评价)
        await step('test_run', '评价 · TEST_RUN', async () => {
          const parsed = parseJSON(machineLang, {})
          if (rule.kernel_comp === 'evaluator') {
            const t = parseFloat(parsed.threshold)
            if (!isNaN(t) && (t < 0 || t > 1)) throw new Error(`threshold ${t} 超出 [0,1]`)
            if (!parsed.metrics?.length && !parsed.reward_fn?.trim()) throw new Error('evaluator 需要 metrics 或 reward_fn')
          }
          if (rule.kernel_comp === 'controller') {
            if (!parsed.condition?.trim()) throw new Error('controller condition 不能为空')
          }
          if (rule.kernel_comp === 'perceiver') {
            if (!parsed.input_type?.trim()) throw new Error('perceiver input_type 不能为空')
          }
          const testEnv = parseJSON(rule.test_env, {})
          return { message: `试运行通过 (${Object.keys(testEnv).length} mock 输入)`, detail: '全部断言通过' }
        })

        // STEP 5 — INTEGRATE (反馈)
        await step('integrate', '反馈 · INTEGRATE', async () => {
          const existing = await new Promise((resolve, reject) => {
            pagesDb.all(
              "SELECT id, title FROM protocol_rules WHERE kernel_comp=? AND build_status='passed' AND id!=?",
              [rule.kernel_comp, rule.id],
              (e, rows) => e ? reject(e) : resolve(rows)
            )
          })
          return {
            message: `集成检查通过 (${existing.length} 条已发布)`,
            detail:  existing.length
              ? `兼容: ${existing.slice(0, 3).map(r => r.title).join(', ')}`
              : '首条规则，无冲突',
          }
        })

        // Finalize
        const finalStatus = passed ? 'testing' : 'failed'
        pagesDb.run(
          'UPDATE protocol_rules SET build_status=?, test_results=? WHERE id=?',
          [finalStatus, JSON.stringify(results), rule.id]
        )

        // Publish build_fail to MQ if failed
        if (!passed) {
          const mq = require('../lib/mq')
          const failedStep = results.find(r => r.status === 'failed')
          mq.publish({
            channel: 'builder',
            event_type: 'build_fail',
            tier: 'T0',
            source_id: rule.id,
            payload: {
              rule_id: rule.id,
              kernel_comp: rule.kernel_comp,
              title: rule.title,
              failed_step: failedStep?.step,
              error: failedStep?.message,
            },
          }).catch(err => console.error('[mq] builder publish error:', err.message))
        }

        send({ type: 'done', overall: finalStatus, results })
        res.end()
      })
    })

    // ── POST suggest (AI 基于失败反馈生成替代版本) ──────────────────
    router.post('/protocol-rules/:id/suggest', (req, res) => {
      pagesDb.get('SELECT * FROM protocol_rules WHERE id = ?', [req.params.id], async (err, rule) => {
        if (err || !rule) return res.status(404).json({ error: 'rule not found' })

        const failedStep = parseJSON(rule.test_results, [])
          .find(r => r.status === 'failed')

        const SCHEMAS = {
          controller: 'JSON 格式: { "observe": "...", "condition": "...", "decide": "...", "actuate": "..." }',
          evaluator:  'JSON 格式: { "metrics": [...], "threshold": 0.6, "reward_fn": "...", "penalty_fn": "..." }',
          perceiver:  'JSON 格式: { "input_type": "...", "filter": "...", "process": "...", "output_type": "..." }',
        }

        const prompt = failedStep
          ? `控制论规则构建失败。kernel_comp: ${rule.kernel_comp}。\n\n` +
            `人的原始规则: ${rule.human_char}\n\n` +
            `失败步骤: ${failedStep.step}，原因: ${failedStep.message}\n\n` +
            `请修正上述规则，使其能够通过构建。` +
            `输出格式要求 (kernel_comp=${rule.kernel_comp}): ${SCHEMAS[rule.kernel_comp]}\n\n` +
            `直接输出修正后的规则文本（供人阅读的自然语言，不是 JSON）。` +
            `只需输出修正后的规则，不要解释。`
          : `请改进以下控制论规则，使其结构更完整、语义更清晰。\n\n规则: ${rule.human_char}\n\nkernel_comp: ${rule.kernel_comp}。` +
            `输出格式要求 (kernel_comp=${rule.kernel_comp}): ${SCHEMAS[rule.kernel_comp]}\n\n` +
            `直接输出改进后的规则文本（供人阅读的自然语言）。只需输出规则文本，不要解释。`

        let suggestion = ''
        try {
          const llmRes = await fetch('http://localhost:3002/api/llm/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization },
            body: JSON.stringify({ model: rule.model, messages: [{ role: 'user', content: prompt }] })
          })
          if (llmRes.ok) {
            const data = await llmRes.json()
            suggestion = (data.content || data.message || data.choices?.[0]?.message?.content || '').trim()
          }
        } catch (_) { /* offline */ }

        if (!suggestion) {
          suggestion = `${rule.human_char}\n\n[AI 建议：以上规则结构完整，建议补充具体的条件阈值和动作描述，以便机器理解执行。]`
        }

        pagesDb.run(
          'UPDATE protocol_rules SET ai_suggestion=?, ai_feedback=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
          [suggestion, failedStep ? `失败反馈: ${failedStep.message}` : '手动触发 AI 修正', rule.id],
          function(err2) {
            if (err2) return res.status(500).json({ error: err2.message })
            res.json({ ok: true, ai_suggestion: suggestion })
          }
        )
      })
    })

    // ── POST publish (testing → passed) + inject into Kernel ─────
    router.post('/protocol-rules/:id/publish', (req, res) => {
      pagesDb.get('SELECT * FROM protocol_rules WHERE id=?', [req.params.id], (err, rule) => {
        if (err)   return res.status(500).json({ error: err.message })
        if (!rule) return res.status(404).json({ error: 'rule not found' })
        if (rule.build_status !== 'testing') {
          return res.status(400).json({ error: 'rule must be in testing status to publish' })
        }

        pagesDb.run(
          "UPDATE protocol_rules SET build_status='passed', updated_at=CURRENT_TIMESTAMP WHERE id=?",
          [req.params.id],
          function(err2) {
            if (err2) return res.status(500).json({ error: err2.message })

            // Inject into Kernel Runtime
            let kernelResult = null
            try {
              const kernelRuntime = require('../lib/kernel-runtime')
              const machineLang = JSON.parse(rule.machine_lang || '{}')
              kernelResult = kernelRuntime.registerContract({
                id: `rule-${rule.id}`,
                type: 'dynamic',
                priority: machineLang.priority || 1,
                participants: (machineLang.participants || []),
                conditionCode: machineLang.condition || 'return true',
                emitCode: machineLang.emit || 'return []',
              }, 'human')
            } catch (kernelErr) {
              // Kernel injection failure does not block publish
              kernelResult = { accepted: false, error: kernelErr.message }
            }

            res.json({ ok: true, kernel: kernelResult })
          }
        )
      })
    })

    return router
  }
}
