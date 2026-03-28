/**
 * routes/constitution.js
 * POST /api/constitution/generate-graph — LLM 流式生成 ExecGraph JSON
 *
 * 响应格式（SSE）：
 *   data: {"text":"..."}          每个 JSON token 片段
 *   data: {"done":true,"graph":{...}}  完成，附带完整解析结果
 *   data: {"error":"..."}         出错
 */
const express = require('express')
const router  = express.Router()
const { client, DEFAULT_MODEL } = require('../lib/llm')

const MODEL = DEFAULT_MODEL

const SYSTEM_PROMPT = `你是一个宪法执行图设计专家。
根据用户提供的「原则标题」和「内容描述」，生成一个机器可执行的 ExecGraph JSON。

ExecGraph 格式规范（直接返回 JSON，不要 markdown 包裹）：
{
  "nodes": [
    { "index": 0, "title": "开始", "node_kind": "lifecycle", "exec_config": { "action": "start" } },
    { "index": N, "title": "结束", "node_kind": "lifecycle", "exec_config": { "action": "complete" } }
  ],
  "edges": [
    { "from": 0, "to": 1, "label": "描述" }
  ]
}

node_kind 可选值：
- lifecycle: 开始/结束（index=0 必须是 start）
- trigger: 事件触发（exec_config: { event, filter, description }）
- condition: 条件分支（exec_config: { expression, description }）
- action: 执行动作（exec_config: { description }）
- human_gate: 等待人工审批（exec_config: { reason }）
- block: 硬拦截（exec_config: { reason, severity: "critical", log: true }）

要求：节点 4-8 个，必须有 start 和 complete，condition 节点要有 true/false 两条出边。只输出 JSON。`

// POST /api/constitution/generate-graph  (SSE 流式)
router.post('/generate-graph', async (req, res) => {
  const { title, content } = req.body
  if (!title) return res.status(400).json({ error: 'title required' })

  console.log(`[generate-graph] title="${title}" content_len=${(content||'').length}`)

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`)

  let raw = ''
  try {
    const userPrompt = `原则标题：${title}\n\n内容描述：${content || '（无描述）'}\n\n输出 ExecGraph JSON：`

    const stream = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: SYSTEM_PROMPT + '\n\n' + userPrompt }],
      stream: true,
    })

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
        const text = chunk.delta.text
        raw += text
        send({ text })
      }
    }

    console.log(`[generate-graph] raw (first 200): ${raw.slice(0, 200)}`)

    // 提取 JSON（可能被 markdown 包裹）
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/)
    const jsonStr = match ? (match[1] || match[0]).trim() : raw.trim()
    const graph = JSON.parse(jsonStr)
    if (!graph.nodes || !graph.edges) throw new Error('Invalid graph structure')

    console.log(`[generate-graph] success, nodes=${graph.nodes.length} edges=${graph.edges.length}`)
    send({ done: true, graph })
  } catch (e) {
    console.error('[generate-graph] failed:', e.message)
    send({ error: e.message })
  }

  res.end()
})

module.exports = router
