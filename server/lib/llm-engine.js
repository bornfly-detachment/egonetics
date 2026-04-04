/**
 * llm-engine.js
 *
 * LLM 执行引擎 — 组装 6 个零件（ported from OpenClaudeCode patterns）
 *
 * 三层能力：
 *   engine.call()       — 单轮调用 + 自动重试 + abort + timeout
 *   engine.stream()     — 流式单轮输出
 *   engine.agentLoop()  — Agentic Loop（有工具时）
 *
 * 向后兼容：替换 getClientForTier + messages.create 最小改动
 *
 * Agentic Loop 借鉴 OpenClaudeCode query.ts 的 while(true) + needsFollowUp 模式：
 *   ① call model
 *   ② text blocks + tool_use blocks 分离
 *   ③ 无 tool_use → done
 *   ④ 执行工具（只读并发 / 写入串行）
 *   ⑤ messages += [assistant, tool_results]
 *   ⑥ token budget check → continue or stop
 */

'use strict'

const { getClientForTier }           = require('./llm')
const { createAbortController, createChildAbortController } = require('./abort-controller')
const { sleep }                      = require('./sleep')
const { sequential }                 = require('./sequential')
const { isAbortError, isRetryableError, isContextLengthError, getRetryDelay, AbortError } = require('./llm-errors')
const { createBudgetTracker, checkTokenBudget, createUsageAccumulator, accumulateUsage, totalTokens } = require('./token-budget')

// ── Constants ──────────────────────────────────────────────────

const MAX_RETRIES        = 3
const MAX_AGENT_ROUNDS   = 50   // hard ceiling on tool-call rounds per agentLoop
const DEFAULT_MAX_TOKENS = parseInt(process.env.LLM_MAX_TOKENS || '4096', 10)

// ── LLMEngine ──────────────────────────────────────────────────

class LLMEngine {
  /**
   * @param {'T0'|'T1'|'T2'} tier
   * @param {{ signal?: AbortSignal }} [opts]
   */
  constructor(tier = 'T1', opts = {}) {
    const { client, model } = getClientForTier(tier)
    this._client  = client
    this._model   = model
    this._tier    = tier
    this._ctrl    = createAbortController()

    // If caller passes an external signal, wire it as parent
    if (opts.signal) {
      opts.signal.addEventListener('abort', () => this._ctrl.abort(opts.signal.reason), { once: true })
    }
  }

  /** Abort any in-flight call */
  abort(reason = 'cancelled') {
    this._ctrl.abort(reason)
  }

  get signal() { return this._ctrl.signal }

  // ── engine.call() ────────────────────────────────────────────

  /**
   * Single-turn LLM call with automatic retry + abort support.
   * Drop-in replacement for: client.messages.create({ model, messages, ... })
   *
   * @param {Array<{role:string,content:string}>} messages
   * @param {{ system?: string, maxTokens?: number, signal?: AbortSignal }} [opts]
   * @returns {Promise<{ content: string, usage: object, stopReason: string }>}
   */
  async call(messages, opts = {}) {
    const signal    = opts.signal ?? this.signal
    const maxTokens = opts.maxTokens ?? DEFAULT_MAX_TOKENS
    const system    = opts.system

    let attempt = 0
    let msgs = messages

    while (attempt < MAX_RETRIES) {
      if (signal.aborted) throw new AbortError()

      try {
        const params = {
          model:      this._model,
          max_tokens: maxTokens,
          messages:   msgs,
        }
        if (system) params.system = system

        const resp = await this._client.messages.create(params)

        const text = resp.content.find(b => b.type === 'text')?.text ?? ''
        return {
          content:    text,
          usage:      resp.usage,
          stopReason: resp.stop_reason,
          raw:        resp,
        }

      } catch (err) {
        if (isAbortError(err)) throw err

        if (isContextLengthError(err)) {
          // Truncate oldest messages (keep system + last 6) and retry once
          msgs = _truncateMessages(msgs)
          attempt++
          continue
        }

        if (isRetryableError(err) && attempt < MAX_RETRIES - 1) {
          const delay = getRetryDelay(attempt, err)
          console.warn(`[llm-engine/${this._tier}] retry ${attempt + 1}/${MAX_RETRIES} in ${delay}ms — ${err.message}`)
          await sleep(delay, signal, { throwOnAbort: true })
          attempt++
          continue
        }

        throw err
      }
    }

    throw new Error(`[llm-engine/${this._tier}] max retries (${MAX_RETRIES}) exceeded`)
  }

  // ── engine.stream() ──────────────────────────────────────────

  /**
   * Streaming single-turn call.
   * Yields text chunks as they arrive.
   *
   * @param {Array} messages
   * @param {{ system?: string, maxTokens?: number }} [opts]
   * @yields {{ type: 'text', text: string } | { type: 'done', usage: object, stopReason: string }}
   */
  async *stream(messages, opts = {}) {
    const signal    = opts.signal ?? this.signal
    const maxTokens = opts.maxTokens ?? DEFAULT_MAX_TOKENS
    const system    = opts.system

    if (signal.aborted) throw new AbortError()

    const params = {
      model:      this._model,
      max_tokens: maxTokens,
      messages,
      stream:     true,
    }
    if (system) params.system = system

    const stream = await this._client.messages.create(params)

    let usage = null
    for await (const event of stream) {
      if (signal.aborted) break

      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        yield { type: 'text', text: event.delta.text }
      }
      if (event.type === 'message_delta') {
        usage = event.usage
      }
      if (event.type === 'message_stop') {
        yield { type: 'done', usage, stopReason: event.message?.stop_reason }
      }
    }
  }

  // ── engine.agentLoop() ───────────────────────────────────────

  /**
   * Agentic Loop — the main new capability.
   * Borrowed from OpenClaudeCode query.ts while(true) + needsFollowUp pattern.
   *
   * Runs until:
   *   - Model returns no tool_use blocks (converged)
   *   - Token budget exhausted
   *   - MAX_AGENT_ROUNDS exceeded
   *   - Abort signal fired
   *   - Error (non-retryable)
   *
   * @param {Array} messages  — initial message history
   * @param {Record<string, ToolDef>} tools  — tool definitions
   * @param {{
   *   system?: string,
   *   maxTokens?: number,
   *   tokenBudget?: number,
   *   signal?: AbortSignal,
   *   onRoundStart?: (round: number) => void,
   * }} [opts]
   *
   * @yields {AgentEvent}
   *
   * ToolDef shape:
   *   {
   *     description: string,
   *     inputSchema: object,          // JSON Schema
   *     isConcurrencySafe?: boolean,  // default false
   *     execute: async (input, signal) => any
   *   }
   *
   * AgentEvent shapes:
   *   { type: 'text',        text: string }
   *   { type: 'tool_start',  toolName: string, toolUseId: string, input: object }
   *   { type: 'tool_result', toolName: string, toolUseId: string, output: any, error?: string }
   *   { type: 'round_done',  round: number, usage: object }
   *   { type: 'done',        rounds: number, usage: object, stopReason: string }
   *   { type: 'error',       error: Error }
   */
  async *agentLoop(messages, tools = {}, opts = {}) {
    const signal      = opts.signal ?? this.signal
    const maxTokens   = opts.maxTokens ?? DEFAULT_MAX_TOKENS
    const tokenBudget = opts.tokenBudget ?? null
    const system      = opts.system

    const budgetTracker = createBudgetTracker()
    const usageAcc      = createUsageAccumulator()

    // Build Anthropic tool definitions from our tool map
    const toolDefs = _buildToolDefs(tools)

    // Sequential wrappers for write tools (created once, reused across rounds)
    const seqWrappers = _buildSeqWrappers(tools)

    let msgs  = [...messages]
    let round = 0

    try {
      while (round < MAX_AGENT_ROUNDS) {
        if (signal.aborted) throw new AbortError()
        round++
        opts.onRoundStart?.(round)

        // ── Phase 1: Call model ──────────────────────────────
        const params = {
          model:      this._model,
          max_tokens: maxTokens,
          messages:   msgs,
          ...(toolDefs.length ? { tools: toolDefs } : {}),
        }
        if (system) params.system = system

        let resp
        try {
          resp = await this._callWithRetry(params, signal)
        } catch (err) {
          yield { type: 'error', error: err }
          return
        }

        accumulateUsage(usageAcc, resp.usage)

        // ── Phase 2: Separate text / tool_use blocks ─────────
        const textBlocks    = resp.content.filter(b => b.type === 'text')
        const toolUseBlocks = resp.content.filter(b => b.type === 'tool_use')

        for (const tb of textBlocks) {
          if (tb.text) yield { type: 'text', text: tb.text }
        }

        yield { type: 'round_done', round, usage: resp.usage }

        // ── Phase 3: Convergence check ───────────────────────
        // No tool_use = model is done (OpenClaudeCode: needsFollowUp = false)
        if (toolUseBlocks.length === 0) {
          yield {
            type:       'done',
            rounds:     round,
            usage:      { ...usageAcc },
            stopReason: resp.stop_reason,
          }
          return
        }

        // ── Phase 4: Token budget check ──────────────────────
        const budgetDecision = checkTokenBudget(budgetTracker, tokenBudget, totalTokens(usageAcc))
        if (budgetDecision.action === 'stop') {
          yield {
            type:       'done',
            rounds:     round,
            usage:      { ...usageAcc },
            stopReason: 'token_budget',
          }
          return
        }

        // ── Phase 5: Execute tools ───────────────────────────
        // Partition: read-only (concurrent) vs write (serial)
        const { readOnly, writes } = _partitionTools(toolUseBlocks, tools)

        const toolResults = []

        // Read-only tools: run concurrently (OpenClaudeCode: runToolsConcurrently)
        if (readOnly.length) {
          const childSignal = createChildAbortController(this._ctrl).signal
          const results = await Promise.allSettled(
            readOnly.map(block => _executeToolBlock(block, tools, seqWrappers, childSignal))
          )
          for (let i = 0; i < readOnly.length; i++) {
            const block = readOnly[i]
            const r = results[i]
            if (r.status === 'fulfilled') {
              yield { type: 'tool_result', toolName: block.name, toolUseId: block.id, output: r.value }
              toolResults.push(_makeToolResult(block.id, r.value))
            } else {
              const errMsg = r.reason?.message ?? String(r.reason)
              yield { type: 'tool_result', toolName: block.name, toolUseId: block.id, output: null, error: errMsg }
              toolResults.push(_makeToolResult(block.id, { error: errMsg }, true))
            }
            yield { type: 'tool_start', toolName: block.name, toolUseId: block.id, input: block.input }
          }
        }

        // Write tools: run serially (OpenClaudeCode: runToolsSerially)
        for (const block of writes) {
          if (signal.aborted) throw new AbortError()
          yield { type: 'tool_start', toolName: block.name, toolUseId: block.id, input: block.input }
          try {
            const out = await _executeToolBlock(block, tools, seqWrappers, signal)
            yield { type: 'tool_result', toolName: block.name, toolUseId: block.id, output: out }
            toolResults.push(_makeToolResult(block.id, out))
          } catch (err) {
            if (isAbortError(err)) throw err
            const errMsg = err.message ?? String(err)
            yield { type: 'tool_result', toolName: block.name, toolUseId: block.id, output: null, error: errMsg }
            toolResults.push(_makeToolResult(block.id, { error: errMsg }, true))
          }
        }

        // ── Phase 6: Append assistant + tool results to history ─
        // (OpenClaudeCode: messages = [...prev, assistantMsg, ...toolResults]; continue)
        msgs = [
          ...msgs,
          { role: 'assistant', content: resp.content },
          { role: 'user',      content: toolResults },
        ]
      }

      // MAX_AGENT_ROUNDS exceeded
      yield {
        type:       'done',
        rounds:     round,
        usage:      { ...usageAcc },
        stopReason: 'max_rounds',
      }

    } catch (err) {
      if (!isAbortError(err)) {
        yield { type: 'error', error: err }
      }
    }
  }

  // ── Internal: single call with retry ─────────────────────────

  async _callWithRetry(params, signal) {
    let attempt = 0
    let p = params

    while (attempt < MAX_RETRIES) {
      if (signal.aborted) throw new AbortError()

      try {
        return await this._client.messages.create(p)
      } catch (err) {
        if (isAbortError(err)) throw err

        if (isContextLengthError(err)) {
          p = { ...p, messages: _truncateMessages(p.messages) }
          attempt++
          continue
        }

        if (isRetryableError(err) && attempt < MAX_RETRIES - 1) {
          const delay = getRetryDelay(attempt, err)
          console.warn(`[llm-engine/${this._tier}] retry ${attempt + 1}/${MAX_RETRIES} in ${delay}ms`)
          await sleep(delay, signal, { throwOnAbort: true })
          attempt++
          continue
        }

        throw err
      }
    }

    throw new Error(`[llm-engine/${this._tier}] max retries exceeded`)
  }
}

// ── Helpers ────────────────────────────────────────────────────

/** Convert our tool map to Anthropic tool_definitions format */
function _buildToolDefs(tools) {
  return Object.entries(tools).map(([name, def]) => ({
    name,
    description:  def.description ?? '',
    input_schema: def.inputSchema ?? { type: 'object', properties: {} },
  }))
}

/** Build sequential wrappers for non-concurrent-safe tools */
function _buildSeqWrappers(tools) {
  const wrappers = {}
  for (const [name, def] of Object.entries(tools)) {
    if (!def.isConcurrencySafe) {
      wrappers[name] = sequential(def.execute)
    }
  }
  return wrappers
}

/** Partition tool_use blocks into read-only vs write */
function _partitionTools(blocks, tools) {
  const readOnly = []
  const writes   = []
  for (const block of blocks) {
    const def = tools[block.name]
    if (def?.isConcurrencySafe) readOnly.push(block)
    else writes.push(block)
  }
  return { readOnly, writes }
}

/** Execute a single tool_use block */
async function _executeToolBlock(block, tools, seqWrappers, signal) {
  const def = tools[block.name]
  if (!def) throw new Error(`Unknown tool: ${block.name}`)

  const executor = seqWrappers[block.name] ?? def.execute
  return executor(block.input, signal)
}

/** Build an Anthropic tool_result content block */
function _makeToolResult(toolUseId, output, isError = false) {
  return {
    type:        'tool_result',
    tool_use_id: toolUseId,
    content:     typeof output === 'string' ? output : JSON.stringify(output),
    ...(isError ? { is_error: true } : {}),
  }
}

/**
 * Truncate messages to fit context window.
 * Keeps system framing + most recent messages (last 6 turns).
 * Called on context_length errors.
 */
function _truncateMessages(messages) {
  if (messages.length <= 4) return messages
  // Keep first 2 (often system context) + last 6
  const head = messages.slice(0, 2)
  const tail = messages.slice(-6)
  return [...head, ...tail]
}

// ── Factory ────────────────────────────────────────────────────

/**
 * Create an LLMEngine for the given tier.
 *
 * @param {'T0'|'T1'|'T2'} tier
 * @param {{ signal?: AbortSignal }} [opts]
 * @returns {LLMEngine}
 */
function createLLMEngine(tier = 'T1', opts = {}) {
  return new LLMEngine(tier, opts)
}

module.exports = { LLMEngine, createLLMEngine }
