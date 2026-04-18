/**
 * routes/ai-world.js
 * POST /api/ai/l3-build — L3 世界层 AI 指令：自然语言 → 树结构 mutations
 *
 * 用户在 L3 描述"我有什么、MVP是什么、用户反馈什么"
 * T2 级别 AI (claude CLI) 直接输出 tree mutations
 * 前端 applyMutations() → 3D 世界实时变化
 *
 * 请求体：
 *   intent  string          用户自然语言（资源/MVP/用户反馈）
 *   tree    ControlNode[]   当前树结构快照（前端发送）
 *
 * 响应：
 *   { mutations: TreeMutation[], summary: string }
 */

const express = require('express')
const router  = express.Router()
const { spawn } = require('child_process')
const { semaphores, getAllStats } = require('../lib/ai-semaphore')
const { getClientForTier, DEFAULT_MAX_TOKENS } = require('../lib/llm')

/** 将 system prompt 合并进 messages 首条 */
function buildMessages(messages, system) {
  if (!system) return messages
  const first = messages[0]
  if (first?.role === 'user') {
    return [
      { role: 'user', content: `[系统指令]\n${system}\n\n[用户消息]\n${first.content}` },
      ...messages.slice(1),
    ]
  }
  return messages
}

const SYSTEM_PROMPT = `你是 PRVSE World 的 T2 世界构建器（最高权限、最高抽象层）。

你收到用户对当前现实的描述：他有什么资源、当前 MVP 是什么、用户反馈了什么。
你的任务：将这些信息结构化，以 mutations 写入世界树，让 3D 世界直接反映现实。

树结构三层：
- dim-constitution（宪法）: 规则/约束框架
- dim-resources（资源）: 物理/算力/人力/工具
- dim-goals（目标）: MVP/用户需求/里程碑

节点结构：
{ "id": "唯一ID", "name": "名称", "color": "十六进制颜色", "select_mode": "single", "meta": { "type": "...", "desc": "..." } }

可用 mutations：
- { "op": "addNode", "parentId": "父节点ID", "node": { ...ControlNode } }
- { "op": "updateNode", "id": "节点ID", "changes": { ...部分字段 } }
- { "op": "removeNode", "id": "节点ID" }

颜色规范：
- 机器/设备类: #94a3b8
- 资源/工具类: #f59e0b
- MVP/目标类: #22c55e
- 用户反馈/需求类: #06b6d4
- 约束/规则类: #ef4444
- T2/AI相关: #a78bfa

ID 命名规范：kebab-case，加前缀（machine-/tool-/mvp-/feedback-/res-）

只返回 JSON，不要解释，不要 markdown 代码块：
{
  "mutations": [ ...TreeMutation[] ],
  "summary": "一句话：做了什么改变"
}`

/** 调 claude CLI（T2 tier），同步等待完整 JSON 响应 */
function callClaudeSync({ system, userMessage }) {
  return new Promise((resolve, reject) => {
    const args = [
      '-p', userMessage,
      '--output-format', 'json',
      '--model', 'claude-sonnet-4-6',
    ]
    if (system) args.push('--system-prompt', system)

    const proc = spawn('claude', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    })
    proc.stdin.end()

    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', d => { stdout += d.toString() })
    proc.stderr.on('data', d => { stderr += d.toString() })

    proc.on('close', code => {
      if (code !== 0) {
        console.error('[ai-world] claude exit', code, stderr.slice(0, 200))
        return reject(new Error(`claude exited ${code}: ${stderr.slice(0, 100)}`))
      }
      try {
        // claude --output-format json 返回 { result: "...", ... }
        const wrapper = JSON.parse(stdout)
        const text = wrapper.result ?? wrapper.text ?? stdout
        // 从文本中提取 JSON（AI 可能有额外说明）
        const match = text.match(/\{[\s\S]*\}/)
        if (!match) return reject(new Error('AI 未返回有效 JSON'))
        resolve(JSON.parse(match[0]))
      } catch (e) {
        console.error('[ai-world] parse error', e.message, stdout.slice(0, 300))
        reject(new Error('解析 AI 响应失败: ' + e.message))
      }
    })
    proc.on('error', err => reject(err))
  })
}

// POST /api/ai/l3-build
router.post('/l3-build', async (req, res) => {
  const { intent, tree } = req.body

  if (!intent || typeof intent !== 'string' || intent.trim().length === 0) {
    return res.status(400).json({ error: 'intent 不能为空' })
  }

  const treeStr = tree ? JSON.stringify(tree, null, 2).slice(0, 8000) : '（暂无树结构）'

  const userMessage = `当前世界树结构：
${treeStr}

用户描述：
${intent.trim()}

请输出 mutations 将用户描述的现实写入世界树。`

  console.log(`[ai-world] l3-build intent="${intent.slice(0, 60)}"`)

  try {
    const result = await callClaudeSync({ system: SYSTEM_PROMPT, userMessage })
    const mutations = Array.isArray(result.mutations) ? result.mutations : []
    const summary   = result.summary ?? '已更新世界结构'
    console.log(`[ai-world] ${mutations.length} mutations, summary="${summary}"`)
    res.json({ mutations, summary })
  } catch (e) {
    console.error('[ai-world] error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

// ── GET /api/ai/stats — 各 tier 队列实时状态 ──────────────────

router.get('/stats', (_req, res) => {
  res.json({ semaphores: getAllStats() })
})

// ── POST /api/ai/chat — 统一 AI 能力挂载点 ───────────────────
//
// 请求体：
//   messages     [{role, content}]  必填
//   tier         'T0'|'T1'|'T2'    可选，默认 T1
//   componentId  string            必填，命名规范：层级-来源-是什么-目的
//                                  例：L1-Task-ControllerImpl-RequirementAnalysis
//   system       string            可选
//   model        string            可选
//   max_tokens   number            可选
//   stream       boolean           可选，默认 true
//
// SSE timing 字段（stream=true 时通过 done 事件返回）：
//   enqueue_at    — 进入队列时刻（ms since epoch）
//   start_at      — 真实 LLM 调用开始时刻
//   end_at        — LLM 调用结束时刻
//   queue_wait_ms — 排队等待时长
//   duration_ms   — 真实 LLM 响应时长

router.post('/chat', async (req, res) => {
  const {
    messages,
    tier        = 'T1',
    componentId = 'unknown',
    system,
    model,
    max_tokens,
    stream      = true,
  } = req.body

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages 不能为空' })
  }
  if (req.user?.role === 'guest') {
    return res.status(403).json({ error: '权限不足：guest 不能调用 AI' })
  }

  const sem = semaphores[tier] ?? semaphores.T1
  let timing
  try {
    timing = await sem.acquire()
  } catch (err) {
    return res.status(503).json({ error: `AI 队列拒绝请求: ${err.message}` })
  }

  let client
  let tierModel
  try {
    ({ client, model: tierModel } = getClientForTier(tier))
  } catch (e) {
    sem.release()
    if (e?.code === 'AUTH_REQUIRED' || e?.status === 401) {
      return res.status(401).json({ error: e.message, code: 'AUTH_REQUIRED' })
    }
    return res.status(500).json({ error: e.message })
  }

  const finalModel     = model || tierModel
  const finalMaxTokens = max_tokens || DEFAULT_MAX_TOKENS
  const finalMessages  = buildMessages(messages, system)

  console.log(`[ai/chat] componentId=${componentId} tier=${tier} model=${finalModel} waitMs=${timing.waitMs} active=${sem.active} queued=${sem.queue.length}`)

  // ── 同步模式 ───────────────────────────────────────────────
  if (!stream) {
    try {
      const msg = await client.messages.create({
        model: finalModel,
        max_tokens: finalMaxTokens,
        messages: finalMessages,
      })
      const endAt = Date.now()
      sem.release()
      const text = msg.content.find(c => c.type === 'text')?.text ?? ''
      return res.json({
        text,
        usage: msg.usage,
        timing: {
          component_id:  componentId,
          tier,
          enqueue_at:    timing.enqueuedAt,
          start_at:      timing.startAt,
          end_at:        endAt,
          queue_wait_ms: timing.waitMs,
          duration_ms:   endAt - timing.startAt,
        },
      })
    } catch (e) {
      sem.release()
      if (e?.code === 'AUTH_REQUIRED' || e?.status === 401) {
        return res.status(401).json({ error: e.message, code: 'AUTH_REQUIRED' })
      }
      return res.status(500).json({ error: e.message })
    }
  }

  // ── SSE 流式模式 ───────────────────────────────────────────
  res.setHeader('Content-Type',      'text/event-stream')
  res.setHeader('Cache-Control',     'no-cache')
  res.setHeader('Connection',        'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  const send = obj => res.write(`data: ${JSON.stringify(obj)}\n\n`)

  // 首包：告知队列等待情况
  send({
    meta: {
      tier,
      component_id:  componentId,
      enqueue_at:    timing.enqueuedAt,
      start_at:      timing.startAt,
      queue_wait_ms: timing.waitMs,
    },
  })

  try {
    const streamResp = await client.messages.create({
      model:      finalModel,
      max_tokens: finalMaxTokens,
      messages:   finalMessages,
      stream:     true,
    })

    for await (const chunk of streamResp) {
      if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
        send({ text: chunk.delta.text })
      }
    }

    const endAt = Date.now()
    let usage
    try { usage = (await streamResp.finalMessage()).usage } catch { /* optional */ }

    send({
      done:   true,
      usage,
      timing: {
        component_id:  componentId,
        tier,
        enqueue_at:    timing.enqueuedAt,
        start_at:      timing.startAt,
        end_at:        endAt,
        queue_wait_ms: timing.waitMs,
        duration_ms:   endAt - timing.startAt,
      },
    })
  } catch (e) {
    console.error('[ai/chat] stream error:', e.message)
    if (e?.code === 'AUTH_REQUIRED' || e?.status === 401) {
      send({ error: e.message, code: 'AUTH_REQUIRED' })
    } else {
    send({ error: e.message })
    }
  } finally {
    sem.release()
    res.end()
  }
})

module.exports = router
