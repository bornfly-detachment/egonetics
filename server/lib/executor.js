/**
 * executor.js — T0→T1→T2→Human 自动执行引擎
 *
 * T0: SEAI 本地模型 (Qwen3.5-0.8B, MLX, free, ~1-3s, 256K context/output)
 * T1: MiniMax M2.7 云端 (200K input, ~128K output)
 * T2: Claude CLI session (Opus/Sonnet 4.6, 200K input, 128K output)
 * Human: 创建 decision 等待裁决
 *
 * 每层最多 10 次 API 调用，失败累计触发自动升级。
 * 响应评估优先使用 SEAI /judge (宪法判断)，不可用时回退关键词启发式。
 */

const { execFile } = require('child_process')
const { v4: uuidv4 } = require('uuid')
const { pagesDb } = require('../db')

// ── DB helpers ──
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

// ── Config ──
const MAX_CALLS_PER_TIER = 10
const TIER_ORDER = ['T0', 'T1', 'T2', 'human']

const SEAI_BASE = process.env.SEAI_URL || 'http://localhost:8001'

// ── SEAI Local Model (T0) ──

let _seaiReady = null // cached health status, reset after 30s

async function checkSEAIHealth() {
  if (_seaiReady !== null) return _seaiReady
  try {
    const res = await fetch(`${SEAI_BASE}/health`, { signal: AbortSignal.timeout(3000) })
    const data = await res.json()
    _seaiReady = data.status === 'ok' && data.model_loaded === true
    // Cache for 30s
    setTimeout(() => { _seaiReady = null }, 30000)
    return _seaiReady
  } catch {
    _seaiReady = false
    setTimeout(() => { _seaiReady = null }, 10000) // retry sooner on failure
    return false
  }
}

async function callSEAI(prompt, opts = {}) {
  const res = await fetch(`${SEAI_BASE}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      system: opts.system || null,
      max_tokens: opts.max_tokens || 2048,
      temperature: opts.temperature || 0.7,
    }),
    signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) throw new Error(`SEAI /generate ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return { text: data.text || '', tokensPerSecond: data.tokens_per_second }
}

async function callSEAIJudge(question, context = {}, constitutionHint = null) {
  const body = { question, context }
  if (constitutionHint) body.constitution_hint = constitutionHint
  const res = await fetch(`${SEAI_BASE}/judge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`SEAI /judge ${res.status}: ${await res.text()}`)
  return await res.json()
  // { answer: "是"|"否"|"不确定", confidence: 0-1, reasoning: string }
}

function buildT0Prompt(taskDesc) {
  return `你是一个任务执行 Agent。请直接完成以下任务，输出执行结果。
如果任务需要写代码，输出完整代码。如果需要分析，输出分析结论。
简洁直接，不要解释过多。

任务: ${taskDesc}`
}

// ── T1: MiniMax 云端 ──

async function callMiniMax(messages, opts = {}) {
  const { createLLMEngine } = require('./llm-engine')
  const engine = createLLMEngine('T1')
  const { content: text, usage } = await engine.call(messages, { maxTokens: opts.max_tokens || 16384 })
  return { text, usage }
}

function buildT1Prompt(taskDesc, prevSteps) {
  const history = prevSteps
    .slice(-5)
    .map(s => `[${s.tier}] ${s.action}: ${s.success ? '成功' : '失败'} — ${s.message || ''}`)
    .join('\n')

  return [
    {
      role: 'user',
      content: `你是一个高级任务执行 Agent。之前的尝试未能完成任务，现在由你接手。

## 任务描述
${taskDesc}

## 之前的尝试记录
${history || '无'}

## 要求
1. 分析之前失败的原因
2. 制定新的执行方案
3. 输出完整的执行结果

请直接输出解决方案和结果。`,
    },
  ]
}

// ── T2: Claude CLI with session ──

function classifyTask(taskDesc) {
  const planningKeywords = [
    '设计', '架构', '规划', '方案', '策略', '分析', '评估',
    'design', 'architect', 'plan', 'strategy', 'analyze', 'evaluate',
    '重构', 'refactor', '迁移', 'migrate', '选型',
  ]
  const lower = taskDesc.toLowerCase()
  return planningKeywords.some(k => lower.includes(k)) ? 'opus' : 'sonnet'
}

function callClaudeCLI(prompt, opts = {}) {
  return new Promise((resolve, reject) => {
    const args = ['-p', prompt, '--output-format', 'json']

    const model = opts.model || 'sonnet'
    args.push('--model', model)

    if (opts.resumeSession) {
      args.push('--resume', opts.resumeSession)
    } else if (opts.sessionId) {
      args.push('--session-id', opts.sessionId)
    }

    execFile('claude', args, {
      timeout: 120000,
      maxBuffer: 1024 * 1024 * 5,
      env: { ...process.env },
      stdin: 'ignore',
    }, (err, stdout, stderr) => {
      if (err) {
        return reject(new Error(`Claude CLI error: ${err.message}`))
      }
      try {
        const data = JSON.parse(stdout)
        resolve({
          text: data.result || '',
          sessionId: data.session_id || opts.sessionId,
          model: data.model || model,
          costUSD: data.cost_usd || 0,
        })
      } catch {
        resolve({ text: stdout.trim(), sessionId: opts.sessionId, model })
      }
    })
  })
}

function buildT2Prompt(taskDesc, prevSteps, isFirstCall) {
  if (isFirstCall) {
    return `你是最高级别的任务执行 Agent (T2)。T0 和 T1 级别的 AI 均未能完成此任务，现在由你接手。

## 任务描述
${taskDesc}

## 之前的尝试记录 (最近 10 步)
${prevSteps.slice(-10).map(s =>
  `[${s.tier}] ${s.action}: ${s.success ? '✓' : '✗'} ${s.message || ''}`
).join('\n')}

## 你的优势
- 你可以进行深度推理和规划
- 你可以分析之前所有层级失败的根因
- 你有完整的对话上下文累积

请先分析失败根因，然后制定并执行解决方案。`
  }

  const lastStep = prevSteps[prevSteps.length - 1]
  return `上次尝试的结果:
${lastStep ? `[${lastStep.tier}] ${lastStep.action}: ${lastStep.success ? '成功' : '失败'} — ${lastStep.message || ''}` : '无'}

请基于之前的分析和上下文，继续尝试解决。如果需要换策略，说明原因。`
}

// ── Evaluation: 判断 AI 响应是否"成功" ──

async function evaluateResponse(text, taskDesc) {
  if (!text || text.trim().length < 10) {
    return { success: false, reason: '响应为空或过短' }
  }

  // Try SEAI /judge for structured evaluation
  try {
    const seaiOk = await checkSEAIHealth()
    if (seaiOk) {
      const judgment = await callSEAIJudge(
        `这个AI的响应是否成功完成了任务？回答"是"表示任务已解决，"否"表示未解决。`,
        { task: taskDesc, response: text.slice(0, 1000) },
        '判断标准：响应是否直接解决了任务描述中的问题，提供了有效的解决方案或结果。'
      )
      if (judgment.answer === '是') {
        return { success: true, reason: `SEAI judge: ${judgment.reasoning?.slice(0, 100)}`, confidence: judgment.confidence }
      }
      if (judgment.answer === '否') {
        return { success: false, reason: `SEAI judge: ${judgment.reasoning?.slice(0, 100)}`, confidence: judgment.confidence }
      }
      // "不确定" with low confidence → treat as failure
      if (judgment.confidence < 0.6) {
        return { success: false, reason: `SEAI judge 不确定 (confidence=${judgment.confidence})` }
      }
    }
  } catch {
    // SEAI unavailable, fall through to heuristic
  }

  // Fallback: keyword heuristic
  return evaluateResponseHeuristic(text)
}

function evaluateResponseHeuristic(text) {
  const errorKeywords = [
    '无法完成', '不能完成', 'cannot complete', 'unable to',
    '需要更多信息', 'need more information', '抱歉', 'sorry',
    '超出能力', 'beyond my capability', '错误', 'error',
  ]
  const hasError = errorKeywords.some(k => text.toLowerCase().includes(k))

  const successKeywords = [
    '完成', '成功', '结果如下', '解决方案', 'completed', 'done',
    'solution', 'result', '输出', '代码如下', '```',
  ]
  const hasSuccess = successKeywords.some(k => text.toLowerCase().includes(k))

  if (hasError && !hasSuccess) {
    return { success: false, reason: '响应包含错误/拒绝关键词' }
  }

  if (text.trim().length > 50) {
    return { success: true, reason: '响应内容充实' }
  }

  return { success: false, reason: '响应不够充实' }
}

// ── Main Executor ──

function genId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

/**
 * Execute a task through the T0→T1→T2→Human pipeline.
 * T0 (SEAI local) will be skipped if the service is not available.
 *
 * @param {string} runId - execution_runs.id
 * @param {string} taskId - task ID
 * @param {string} taskDesc - task description text
 */
async function executeTask(runId, taskId, taskDesc) {
  let currentTier = 'T0'
  let tierCallCount = 0
  let totalCalls = 0
  let steps = []
  let escalations = []
  let claudeSessionId = null

  // Check if SEAI is available for T0; if not, start at T1
  const seaiAvailable = await checkSEAIHealth()
  if (!seaiAvailable) {
    console.log(`[executor] SEAI not available, starting at T1 (MiniMax)`)
    escalations.push({
      from_tier: 'T0',
      to_tier: 'T1',
      reason: 'SEAI local model not available, skipping T0',
      at: new Date().toISOString(),
    })
    currentTier = 'T1'
  }

  async function persist(status) {
    await dbRun(
      `UPDATE execution_runs
       SET steps = ?, api_calls = ?, escalations = ?, current_tier = ?,
           status = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [JSON.stringify(steps), totalCalls, JSON.stringify(escalations), currentTier, status, runId]
    )
  }

  async function escalate(reason) {
    const nextIdx = TIER_ORDER.indexOf(currentTier) + 1
    const nextTier = TIER_ORDER[nextIdx] || 'human'

    escalations.push({
      from_tier: currentTier,
      to_tier: nextTier,
      reason,
      at: new Date().toISOString(),
    })

    currentTier = nextTier
    tierCallCount = 0

    if (nextTier === 'human') {
      const decId = genId('dec')
      await dbRun(
        `INSERT INTO decisions (id, run_id, type, status, context, options)
         VALUES (?, ?, 'escalation', 'pending', ?, ?)`,
        [
          decId, runId,
          JSON.stringify({
            task_id: taskId,
            reason: `All AI tiers exhausted after ${totalCalls} API calls`,
            last_steps: steps.slice(-5),
          }),
          JSON.stringify(['retry_t2', 'manual_fix', 'abort']),
        ]
      )
      await persist('escalated')
      return false
    }

    await persist('running')
    return true
  }

  // ── Main loop ──
  try {
    while (currentTier !== 'human') {
      let response = null
      let action = ''

      try {
        if (currentTier === 'T0') {
          // SEAI local model
          action = `t0_seai_${tierCallCount + 1}`
          const prompt = buildT0Prompt(taskDesc)
          response = await callSEAI(prompt, { max_tokens: 2048 })
        } else if (currentTier === 'T1') {
          // MiniMax cloud
          action = `t1_minimax_${tierCallCount + 1}`
          const messages = buildT1Prompt(taskDesc, steps)
          response = await callMiniMax(messages, { max_tokens: 4096 })
        } else if (currentTier === 'T2') {
          // Claude CLI
          action = `t2_claude_${tierCallCount + 1}`
          const isFirstT2 = tierCallCount === 0
          const prompt = buildT2Prompt(taskDesc, steps, isFirstT2)
          const model = classifyTask(taskDesc)

          if (isFirstT2) {
            claudeSessionId = uuidv4()
            response = await callClaudeCLI(prompt, {
              model,
              sessionId: claudeSessionId,
            })
          } else {
            response = await callClaudeCLI(prompt, {
              model,
              resumeSession: claudeSessionId,
            })
          }
          if (response.sessionId) claudeSessionId = response.sessionId
        }
      } catch (callErr) {
        const step = {
          tier: currentTier,
          action,
          success: false,
          message: `API error: ${callErr.message?.slice(0, 200)}`,
          at: new Date().toISOString(),
        }
        steps.push(step)
        totalCalls++
        tierCallCount++
        await persist('running')

        if (tierCallCount >= MAX_CALLS_PER_TIER) {
          const shouldContinue = await escalate(
            `${tierCallCount} failed API calls at ${currentTier}`
          )
          if (!shouldContinue) return
        }
        continue
      }

      // Evaluate response
      const text = response?.text || ''
      const evaluation = await evaluateResponse(text, taskDesc)

      const step = {
        tier: currentTier,
        action,
        success: evaluation.success,
        message: evaluation.success
          ? `成功: ${text.slice(0, 100)}`
          : `失败: ${evaluation.reason}`,
        response_preview: text.slice(0, 300),
        confidence: evaluation.confidence,
        at: new Date().toISOString(),
      }
      steps.push(step)
      totalCalls++
      tierCallCount++

      await persist('running')

      if (evaluation.success) {
        await dbRun(
          `UPDATE execution_runs
           SET steps = ?, api_calls = ?, escalations = ?, current_tier = ?,
               status = 'completed', result = ?, updated_at = datetime('now')
           WHERE id = ?`,
          [
            JSON.stringify(steps), totalCalls, JSON.stringify(escalations),
            currentTier, JSON.stringify({ text, tier: currentTier }),
            runId,
          ]
        )
        return
      }

      if (tierCallCount >= MAX_CALLS_PER_TIER) {
        const shouldContinue = await escalate(
          `${tierCallCount} failed calls at ${currentTier}`
        )
        if (!shouldContinue) return
      }
    }
  } catch (fatalErr) {
    steps.push({
      tier: currentTier,
      action: 'fatal_error',
      success: false,
      message: `Fatal: ${fatalErr.message?.slice(0, 200)}`,
      at: new Date().toISOString(),
    })
    await dbRun(
      `UPDATE execution_runs
       SET steps = ?, api_calls = ?, escalations = ?, current_tier = ?,
           status = 'failed', updated_at = datetime('now')
       WHERE id = ?`,
      [JSON.stringify(steps), totalCalls, JSON.stringify(escalations), currentTier, runId]
    )
  }
}

module.exports = {
  executeTask,
  callSEAI,
  callSEAIJudge,
  callMiniMax,
  callClaudeCLI,
  classifyTask,
  checkSEAIHealth,
}
