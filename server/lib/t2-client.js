/**
 * server/lib/t2-client.js
 *
 * T2 Agent Client — 替换 code-agent.js 的 tmux 实现。
 * 通过 HTTP/SSE 调用 free-code Agent Server（默认 localhost:3003）。
 *
 * 对外接口与 code-agent.js 完全兼容：
 *   runQuery(prompt, opts)   → AsyncGenerator<event>
 *   getSessionId(contextKey) → string | null
 *   getHistory(contextKey)   → event[]
 *   listContexts()           → string[]
 *   resetContext(ctx)        → void
 *   reloadConfig()           → void  (no-op，server 无状态)
 *
 * 事件格式（与 llm-engine agentLoop 一致）：
 *   { type: 'init',        sessionId }
 *   { type: 'text',        text }
 *   { type: 'tool_use',   id, name, input }
 *   { type: 'tool_result', id, content, isError? }
 *   { type: 'done',        result, cost, usage, sessionId }
 *   { type: 'error',       error }
 *   { type: 'stream_end' }
 */

'use strict'

const T2_SERVER_URL = process.env.T2_SERVER_URL || 'http://localhost:3003'

// ── In-memory context store ─────────────────────────────────────────────────
// 按 contextKey 存储 sessionId + event 历史，用于 getHistory / getSessionId

const _sessions  = new Map()   // contextKey → { sessionId, events[] }

function _getCtx(contextKey) {
  if (!_sessions.has(contextKey)) {
    _sessions.set(contextKey, { sessionId: null, events: [] })
  }
  return _sessions.get(contextKey)
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * 运行 T2 agent query，流式 yield 事件。
 *
 * @param {string} prompt
 * @param {{
 *   contextKey?:  string,
 *   maxTurns?:    number,
 *   model?:       string,
 *   cwd?:         string,
 *   resetCtx?:    boolean,
 *   systemPrompt?: string,
 *   allowedTools?: string[],
 * }} opts
 */
async function* runQuery(prompt, opts = {}) {
  const {
    contextKey  = 'main',
    maxTurns    = 20,
    model,
    cwd,
    resetCtx    = false,
    systemPrompt,
    allowedTools,
  } = opts

  if (resetCtx) resetContext(contextKey)

  const ctx = _getCtx(contextKey)

  // health check — 给前端友好错误
  const healthy = await checkT2Health()
  if (!healthy) {
    const err = { type: 'error', error: `T2 server 未启动，请先运行: bun run src/entrypoints/httpServer.ts (port ${T2_SERVER_URL})` }
    ctx.events.push(err)
    yield err
    yield { type: 'stream_end' }
    return
  }

  let resp
  try {
    resp = await fetch(`${T2_SERVER_URL}/run`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        prompt,
        cwd:                       cwd ?? process.cwd(),
        systemPrompt,
        dangerouslySkipPermissions: true,
        maxTurns,
        allowedTools,
        model,
      }),
    })
  } catch (err) {
    const ev = { type: 'error', error: `T2 server 连接失败: ${err.message}` }
    ctx.events.push(ev)
    yield ev
    yield { type: 'stream_end' }
    return
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    const ev   = { type: 'error', error: `T2 server 返回 ${resp.status}: ${text}` }
    ctx.events.push(ev)
    yield ev
    yield { type: 'stream_end' }
    return
  }

  // ── Parse SSE stream ─────────────────────────────────────────────────────
  const reader  = resp.body.getReader()
  const decoder = new TextDecoder()
  let   buffer  = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (!data) continue

        let event
        try { event = JSON.parse(data) } catch { continue }

        // 更新 context store
        ctx.events.push({ ...event, _ts: Date.now() })
        if (event.type === 'init' && event.sessionId) {
          ctx.sessionId = event.sessionId
        }

        yield event
      }
    }
  } finally {
    reader.releaseLock()
  }

  yield { type: 'stream_end' }
}

/**
 * 获取 contextKey 对应的 sessionId（来自最近一次 init 事件）。
 * @param {string} contextKey
 * @returns {string|null}
 */
function getSessionId(contextKey = 'main') {
  return _sessions.get(contextKey)?.sessionId ?? null
}

/**
 * 获取 contextKey 的完整事件历史。
 * @param {string} contextKey
 * @returns {object[]}
 */
function getHistory(contextKey = 'main') {
  return _sessions.get(contextKey)?.events ?? []
}

/**
 * 列出所有已知 context keys。
 * @returns {string[]}
 */
function listContexts() {
  return Array.from(_sessions.keys())
}

/**
 * 清空某 context 的内存状态。
 * @param {string} contextKey
 */
function resetContext(contextKey = 'main') {
  _sessions.delete(contextKey)
}

/**
 * 健康检查 — 返回 true 表示 T2 server 可用。
 * @returns {Promise<boolean>}
 */
async function checkT2Health() {
  try {
    const resp = await fetch(`${T2_SERVER_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    })
    return resp.ok
  } catch {
    return false
  }
}

/**
 * no-op：t2-client 无状态，无需重载配置。
 * 保留此函数保证 t2-config.js 路由兼容。
 */
function reloadConfig() { /* no-op */ }

module.exports = {
  runQuery,
  getSessionId,
  getHistory,
  listContexts,
  resetContext,
  checkT2Health,
  reloadConfig,
  T2_SERVER_URL,
}
