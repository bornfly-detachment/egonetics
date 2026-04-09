/**
 * server/lib/t2-client.js
 *
 * T2 Agent Client — 直接 spawn `claude -p --output-format stream-json`
 * 不经过 HTTP 中转，与 T0/T1（llm-engine.js → MiniMax API）完全隔离。
 *
 * 对外接口：
 *   runQuery(prompt, opts)   → AsyncGenerator<event>
 *   getSessionId(contextKey) → string | null
 *   getHistory(contextKey)   → event[]
 *   listContexts()           → string[]
 *   resetContext(ctx)        → void
 *   checkT2Health()          → Promise<boolean>
 *   reloadConfig()           → void  (no-op)
 *
 * 事件格式：
 *   { type: 'init',        sessionId, tools? }
 *   { type: 'text',        text }
 *   { type: 'tool_use',    id, name, input }
 *   { type: 'tool_result', id, content, isError? }
 *   { type: 'done',        result, cost?, usage?, sessionId? }
 *   { type: 'error',       error }
 *   { type: 'stream_end' }
 */

'use strict'

const fs     = require('fs')
const path   = require('path')
const { spawn } = require('child_process')

// ── Config ──────────────────────────────────────────────────────────────────

const CLAUDE_BIN    = process.env.CLAUDE_BIN || '/Users/bornfly/.npm-global/bin/claude'
const T2_CONFIG_PATH = path.resolve(__dirname, '../config/t2-agents.json')

// ── Config lookup ────────────────────────────────────────────────────────────

function _loadConfig() {
  try { return JSON.parse(fs.readFileSync(T2_CONFIG_PATH, 'utf-8')) }
  catch { return [] }
}

function _getSphereConfig(sphere) {
  return _loadConfig().find(e => e.sphere === sphere && e.active !== false) ?? null
}

// ── In-memory context store ──────────────────────────────────────────────────

const _sessions = new Map()  // contextKey → { sessionId, events[] }

function _getCtx(contextKey) {
  if (!_sessions.has(contextKey)) {
    _sessions.set(contextKey, { sessionId: null, events: [] })
  }
  return _sessions.get(contextKey)
}

// ── SDKMessage normalizer ────────────────────────────────────────────────────
// 与 free-code/src/entrypoints/httpServer.ts 的 normalize() 逻辑一致

function* _normalize(msg) {
  if (msg.type === 'system' && msg.subtype === 'init') {
    const tools = Array.isArray(msg.tools)
      ? msg.tools
          .map(t => (t && typeof t === 'object' && t.name) ? t.name : null)
          .filter(Boolean)
      : undefined
    yield { type: 'init', sessionId: String(msg.session_id ?? ''), tools }
    return
  }

  if (msg.type === 'assistant') {
    const content = msg.message?.content
    if (!Array.isArray(content)) return
    for (const block of content) {
      if (block.type === 'text' && block.text) {
        yield { type: 'text', text: String(block.text) }
      } else if (block.type === 'tool_use') {
        yield {
          type:  'tool_use',
          id:    String(block.id   ?? ''),
          name:  String(block.name ?? ''),
          input: block.input ?? {},
        }
      }
    }
    return
  }

  if (msg.type === 'user') {
    const content = msg.message?.content
    if (!Array.isArray(content)) return
    for (const block of content) {
      if (block.type === 'tool_result') {
        const raw  = block.content
        const text = Array.isArray(raw)
          ? raw.map(c => c.text ?? '').join('')
          : String(raw ?? '')
        yield {
          type:    'tool_result',
          id:      String(block.tool_use_id ?? ''),
          content: text,
          ...(block.is_error ? { isError: true } : {}),
        }
      }
    }
    return
  }

  if (msg.type === 'result') {
    yield {
      type:      'done',
      result:    String(msg.result ?? ''),
      cost:      typeof msg.total_cost_usd === 'number' ? msg.total_cost_usd : undefined,
      usage:     msg.usage,
      sessionId: String(msg.session_id ?? ''),
    }
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * 运行 T2 agent query，直接 spawn claude -p，流式 yield 事件。
 *
 * @param {string} prompt
 * @param {{
 *   contextKey?:    string,
 *   maxTurns?:      number,
 *   model?:         string,
 *   cwd?:           string,
 *   resetCtx?:      boolean,
 *   systemPrompt?:  string,
 *   allowedTools?:  string[],
 * }} opts
 */
async function* runQuery(prompt, opts = {}) {
  const {
    contextKey  = 'main',
    maxTurns    = 20,
    resetCtx    = false,
    systemPrompt,
    allowedTools,
  } = opts

  const sphereCfg = _getSphereConfig(contextKey)
  const model = opts.model ?? sphereCfg?.default_model ?? 'claude-sonnet-4-6'
  const cwd   = opts.cwd   ?? sphereCfg?.workdir       ?? process.cwd()

  if (resetCtx) resetContext(contextKey)
  const ctx = _getCtx(contextKey)

  // Build args
  const args = [
    '-p', prompt,
    '--output-format', 'stream-json',
    '--verbose',
    '--dangerously-skip-permissions',
    '--model', model,
    '--max-turns', String(maxTurns),
  ]

  if (systemPrompt) {
    args.push('--system-prompt', systemPrompt)
  }
  if (allowedTools?.length) {
    args.push('--allowedTools', allowedTools.join(','))
  }

  // Spawn T2 process
  let proc
  try {
    proc = spawn(CLAUDE_BIN, args, {
      cwd,
      env:   process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (spawnErr) {
    const ev = { type: 'error', error: `T2 spawn 失败: ${spawnErr.message}` }
    ctx.events.push(ev)
    yield ev
    yield { type: 'stream_end' }
    return
  }

  // Collect stderr for error reporting
  const stderrChunks = []
  proc.stderr.on('data', chunk => stderrChunks.push(chunk))

  // Parse stdout line by line
  let buffer = ''
  const decoder = new TextDecoder()

  try {
    for await (const chunk of proc.stdout) {
      buffer += decoder.decode(chunk, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue

        let parsed
        try { parsed = JSON.parse(trimmed) } catch { continue }

        for (const event of _normalize(parsed)) {
          const stamped = { ...event, _ts: Date.now() }
          ctx.events.push(stamped)
          if (event.type === 'init' && event.sessionId) {
            ctx.sessionId = event.sessionId
          }
          yield event
        }
      }
    }

    // Flush remaining buffer
    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer.trim())
        for (const event of _normalize(parsed)) {
          ctx.events.push({ ...event, _ts: Date.now() })
          if (event.type === 'init' && event.sessionId) ctx.sessionId = event.sessionId
          yield event
        }
      } catch { /* partial line, discard */ }
    }
  } catch (readErr) {
    const ev = { type: 'error', error: `T2 读取失败: ${readErr.message}` }
    ctx.events.push(ev)
    yield ev
  }

  // Wait for process exit
  const exitCode = await new Promise(resolve => {
    if (proc.exitCode !== null) {
      resolve(proc.exitCode)
    } else {
      proc.once('close', code => resolve(code ?? 0))
    }
  })

  if (exitCode !== 0) {
    const stderr = Buffer.concat(stderrChunks).toString().trim()
    const errMsg = stderr || `T2 进程退出码 ${exitCode}`
    // Only emit error if we haven't already seen a 'done' event
    const hasDone = ctx.events.some(e => e.type === 'done')
    if (!hasDone) {
      const ev = { type: 'error', error: errMsg }
      ctx.events.push(ev)
      yield ev
    }
  }

  yield { type: 'stream_end' }
}

/**
 * 获取 contextKey 对应的 sessionId。
 */
function getSessionId(contextKey = 'main') {
  return _sessions.get(contextKey)?.sessionId ?? null
}

/**
 * 获取 contextKey 的完整事件历史。
 */
function getHistory(contextKey = 'main') {
  return _sessions.get(contextKey)?.events ?? []
}

/**
 * 列出所有已知 context keys。
 */
function listContexts() {
  return Array.from(_sessions.keys())
}

/**
 * 清空某 context 的内存状态。
 */
function resetContext(contextKey = 'main') {
  _sessions.delete(contextKey)
}

/**
 * 检查 claude binary 是否可用。
 */
async function checkT2Health() {
  return new Promise(resolve => {
    const proc = spawn(CLAUDE_BIN, ['--version'], { stdio: 'ignore' })
    proc.once('close', code => resolve(code === 0))
    proc.once('error', () => resolve(false))
  })
}

/**
 * no-op — 兼容旧接口。
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
  CLAUDE_BIN,
}
