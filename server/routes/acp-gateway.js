/**
 * server/routes/acp-gateway.js
 * ACP/MCP 轻量适配网关
 *
 * 设计原则：
 *   - 不改造 Claude Code 本体
 *   - 只做双向消息格式转换：ACP↔code-agent（tmux daemon）
 *   - 支持同步 + SSE 流式两种响应模式
 *
 * 支持的输入格式：
 *   1. ACP   { input: [{ parts: [{ content, content_type }] }] }
 *   2. MCP   { role, content: [{ type: "text", text }] }  或 content: "string"
 *   3. Plain { prompt: "string" }
 *
 * 端点：
 *   GET  /api/acp/agents              — Agent 描述符（ACP 元数据）
 *   POST /api/acp/runs                — 同步运行（等待完成返回）
 *   POST /api/acp/runs/stream         — SSE 流式运行
 *   GET  /api/acp/runs/:runId         — 查询 Run 状态 / 历史
 *   DELETE /api/acp/runs/:runId       — 取消 / 清除 Run 记录
 *
 * ACP 输出格式（BeeAI ACP 兼容）：
 *   {
 *     run_id: "...",
 *     agent_name: "egonetics-coding-agent",
 *     status: "created" | "running" | "completed" | "failed",
 *     output: [{ parts: [{ content, content_type, metadata? }] }],
 *     metadata: { cost_usd, duration_ms, session_id },
 *     final: bool
 *   }
 *
 * SSE 流中额外的事件类型（metadata.type）：
 *   text        — 普通文本 token（streamPartial 开启时为增量）
 *   tool_call   — Claude Code 工具调用（content = JSON）
 *   tool_result — 工具执行结果
 */

'use strict'

const { randomUUID } = require('crypto')
const express    = require('express')
const router     = express.Router()
const codeAgent  = require('../lib/t2-client')

// ── Run 内存注册表（24h TTL）─────────────────────────────────

const runs = new Map()   // runId → RunRecord

const RUN_TTL_MS = 24 * 60 * 60 * 1000

function gcRuns() {
  const now = Date.now()
  for (const [id, run] of runs) {
    if (now - run.startedAt > RUN_TTL_MS) runs.delete(id)
  }
}
setInterval(gcRuns, 60 * 60 * 1000).unref()

function createRun(contextKey, prompt) {
  const run = {
    run_id:      randomUUID(),
    agent_name:  'egonetics-coding-agent',
    status:      'created',
    contextKey,
    prompt,
    output:      [],   // 累积 ACP output parts
    metadata:    {},
    startedAt:   Date.now(),
    events:      [],   // 原始 code-agent 事件（调试用）
  }
  runs.set(run.run_id, run)
  return run
}

// ── 消息格式转换 ──────────────────────────────────────────────

/**
 * 把各种输入格式统一转成 prompt 字符串
 * 支持：ACP / MCP(OpenAI-compat) / Plain
 */
function toPrompt(body) {
  // Plain: { prompt }
  if (typeof body.prompt === 'string') return body.prompt.trim()

  // ACP: { input: [{ parts: [{ content, content_type }] }] }
  if (Array.isArray(body.input)) {
    return body.input.flatMap(msg => {
      if (Array.isArray(msg.parts)) {
        return msg.parts
          .filter(p => !p.content_type || p.content_type.startsWith('text/'))
          .map(p => String(p.content ?? ''))
      }
      // MCP/OpenAI-compat: { role, content }
      if (typeof msg.content === 'string') return [msg.content]
      if (Array.isArray(msg.content)) {
        return msg.content
          .filter(c => c.type === 'text' || typeof c === 'string')
          .map(c => c.text ?? c)
      }
      return []
    }).join('\n').trim()
  }

  // 裸字符串 body
  if (typeof body === 'string') return body.trim()
  return ''
}

/**
 * 从请求中提取 contextKey（ACP session_id / 自定义字段 / 默认值）
 */
function toContextKey(body) {
  return (
    body.context?.session_id ??
    body.contextKey ??
    body.session_id ??
    'acp-default'
  )
}

/**
 * 把单个 code-agent 事件转成 ACP output part（用于 SSE 流式推送）
 * 返回 null 表示此事件不需要向客户端推送
 */
function eventToAcpPart(event) {
  // 流式 token（需 streamPartial=true）
  if (
    event.type === 'stream_event' &&
    event.event?.type === 'content_block_delta' &&
    event.event?.delta?.type === 'text_delta'
  ) {
    return {
      content:      event.event.delta.text,
      content_type: 'text/plain',
      metadata:     { type: 'text' },
    }
  }

  // assistant 完整响应（非流式时才包含文本，流式时只推工具调用）
  if (event.type === 'assistant') {
    const content = event.message?.content ?? []
    const parts = []

    // 工具调用（无论是否 streamPartial 都推送）
    for (const t of content.filter(c => c.type === 'tool_use')) {
      parts.push({
        content:      JSON.stringify({ id: t.id, name: t.name, input: t.input }),
        content_type: 'application/json',
        metadata:     { type: 'tool_call', tool_name: t.name },
      })
    }

    return parts.length > 0 ? parts : null
  }

  // 工具执行结果
  if (event.type === 'tool_result') {
    const contentStr = Array.isArray(event.content)
      ? event.content.filter(c => c.type === 'text').map(c => c.text).join('\n')
      : String(event.content ?? '')
    return {
      content:      contentStr,
      content_type: 'text/plain',
      metadata:     { type: 'tool_result', is_error: !!event.is_error },
    }
  }

  return null
}

/**
 * 从累积的 code-agent 事件中提取最终 ACP output
 */
function buildFinalOutput(events) {
  const texts    = []
  const toolParts = []
  let cost = null, durationMs = null, sessionId = null

  for (const ev of events) {
    if (ev.type === 'assistant') {
      const content = ev.message?.content ?? []
      const text = content.filter(c => c.type === 'text').map(c => c.text).join('')
      if (text) texts.push(text)
      for (const t of content.filter(c => c.type === 'tool_use')) {
        toolParts.push({
          content:      JSON.stringify({ id: t.id, name: t.name, input: t.input }),
          content_type: 'application/json',
          metadata:     { type: 'tool_call', tool_name: t.name },
        })
      }
    }
    if (ev.type === 'result') {
      cost       = ev.total_cost_usd
      durationMs = ev.duration_ms
      sessionId  = ev.session_id
    }
  }

  const parts = []
  if (texts.length > 0) {
    parts.push({ content: texts.join(''), content_type: 'text/plain', metadata: { type: 'text' } })
  }
  parts.push(...toolParts)

  return {
    output:   [{ parts }],
    metadata: { cost_usd: cost, duration_ms: durationMs, session_id: sessionId },
  }
}

// ── SSE 工具 ─────────────────────────────────────────────────

function sseHeaders(res) {
  res.setHeader('Content-Type',  'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection',    'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()
}

function sseSend(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

// ── GET /api/acp/agents ───────────────────────────────────────

router.get('/agents', (_req, res) => {
  res.json({
    agents: [{
      name:        'egonetics-coding-agent',
      description: 'Claude Code Agent — 常驻 tmux 的编程助手，支持 Bash / 文件读写 / 代码分析',
      metadata: {
        framework:    'Claude Code CLI',
        transport:    'unix-socket → tmux daemon',
        capabilities: ['code', 'bash', 'file_read', 'file_write', 'analysis'],
        session_mode: 'stateful (--resume)',
      },
    }],
  })
})

// ── POST /api/acp/runs (同步) ─────────────────────────────────

router.post('/runs', async (req, res) => {
  const prompt     = toPrompt(req.body)
  const contextKey = toContextKey(req.body)
  const model      = req.body.model
  const maxTurns   = req.body.max_turns ?? 20
  const resetCtx   = req.body.reset_context ?? false

  if (!prompt) return res.status(400).json({ error: 'input / prompt 不能为空' })

  const run = createRun(contextKey, prompt)
  run.status = 'running'

  try {
    for await (const event of codeAgent.runQuery(prompt, {
      contextKey, model, maxTurns, resetCtx, streamPartial: false,
    })) {
      run.events.push(event)
      if (event.type === 'error') {
        run.status = 'failed'
        run.metadata.error = event.error
      }
    }

    if (run.status !== 'failed') run.status = 'completed'

    const { output, metadata } = buildFinalOutput(run.events)
    run.output   = output
    run.metadata = { ...run.metadata, ...metadata }

    res.json({
      run_id:     run.run_id,
      agent_name: run.agent_name,
      status:     run.status,
      output:     run.output,
      metadata:   run.metadata,
    })
  } catch (err) {
    run.status = 'failed'
    run.metadata.error = err.message
    res.status(500).json({
      run_id:  run.run_id,
      status:  'failed',
      error:   err.message,
    })
  }
})

// ── POST /api/acp/runs/stream (SSE 流式) ──────────────────────

router.post('/runs/stream', async (req, res) => {
  const prompt     = toPrompt(req.body)
  const contextKey = toContextKey(req.body)
  const model      = req.body.model
  const maxTurns   = req.body.max_turns ?? 20
  const resetCtx   = req.body.reset_context ?? false

  if (!prompt) {
    res.status(400).json({ error: 'input / prompt 不能为空' })
    return
  }

  const run = createRun(contextKey, prompt)
  sseHeaders(res)

  // 通知客户端：Run 已创建
  sseSend(res, { run_id: run.run_id, agent_name: run.agent_name, status: 'created' })
  run.status = 'running'
  sseSend(res, { run_id: run.run_id, status: 'running' })

  let fullText = ''

  try {
    for await (const event of codeAgent.runQuery(prompt, {
      contextKey, model, maxTurns, resetCtx, streamPartial: true,
    })) {
      run.events.push(event)

      // 流式 token
      if (
        event.type === 'stream_event' &&
        event.event?.type === 'content_block_delta' &&
        event.event?.delta?.type === 'text_delta'
      ) {
        const delta = event.event.delta.text
        fullText += delta
        sseSend(res, {
          run_id:  run.run_id,
          status:  'running',
          output:  [{ parts: [{ content: delta, content_type: 'text/plain', metadata: { type: 'text' } }] }],
          final:   false,
        })
        continue
      }

      // 工具调用 / 工具结果 / 其他
      const parts = eventToAcpPart(event)
      if (parts) {
        const partsArr = Array.isArray(parts) ? parts : [parts]
        sseSend(res, {
          run_id:  run.run_id,
          status:  'running',
          output:  [{ parts: partsArr }],
          final:   false,
        })
      }

      // 最终 result 事件
      if (event.type === 'result') {
        run.status = 'completed'
        const { output, metadata } = buildFinalOutput(run.events)
        run.output   = output
        run.metadata = metadata

        sseSend(res, {
          run_id:     run.run_id,
          agent_name: run.agent_name,
          status:     'completed',
          output:     run.output,
          metadata:   run.metadata,
          final:      true,
        })
      }

      if (event.type === 'error') {
        run.status = 'failed'
        sseSend(res, {
          run_id: run.run_id,
          status: 'failed',
          error:  event.error,
          final:  true,
        })
      }
    }
  } catch (err) {
    run.status = 'failed'
    sseSend(res, { run_id: run.run_id, status: 'failed', error: err.message, final: true })
  }

  res.end()
})

// ── GET /api/acp/runs/:runId ──────────────────────────────────

router.get('/runs/:runId', (req, res) => {
  const run = runs.get(req.params.runId)
  if (!run) return res.status(404).json({ error: 'Run 不存在' })

  res.json({
    run_id:     run.run_id,
    agent_name: run.agent_name,
    status:     run.status,
    output:     run.output,
    metadata:   run.metadata,
    started_at: new Date(run.startedAt).toISOString(),
  })
})

// ── DELETE /api/acp/runs/:runId ───────────────────────────────

router.delete('/runs/:runId', (req, res) => {
  const deleted = runs.delete(req.params.runId)
  res.json({ ok: deleted })
})

module.exports = router
