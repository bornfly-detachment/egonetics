/**
 * @prvse P-L2_coordinator
 *
 * L2 Coordinator — 目标分解器
 *
 * 职责：
 *   - 接收高层目标 (goal string)
 *   - 调用 T1/T2 AI 把目标分解成有序 Job 列表
 *   - 写入 L1 store，返回创建的 jobs
 *
 * 借鉴 free-code coordinatorMode.ts 中的 goal→task 分解模式，
 * 但不依赖 coordinator env var — 这是服务端长期驻留的 L2 层。
 *
 * L2 不做调度决策，只做：
 *   1. 语义分解 (goal → [{name, payload, schedule}])
 *   2. 写入 store (L1 接管执行)
 *   3. 状态追踪 (decomposeHistory ring buffer)
 */

'use strict'

const store = require('./store')

// ── Ring buffer for decompose history ───────────────────────────

const MAX_HISTORY = 50
const history = []   // { id, goal, jobIds, tier, createdAt, status }

function addHistory(entry) {
  history.unshift(entry)
  if (history.length > MAX_HISTORY) history.pop()
}

// ── System prompt for goal decomposition ────────────────────────

const DECOMPOSE_SYSTEM = `You are a task decomposition coordinator (L2 layer of a cybernetic runtime system).

Given a high-level goal, decompose it into a list of concrete executable jobs.

Rules:
1. Return ONLY valid JSON — no prose, no markdown fences
2. Output format: { "jobs": [ { "name": "...", "description": "...", "schedule": {...}, "payload": {...} } ] }
3. Max jobs: respect the maxJobs parameter (default 5)
4. Each job must have:
   - name: short imperative label (≤60 chars)
   - description: one-sentence explanation
   - schedule: { "kind": "at", "at": "<ISO datetime within 24h>" } for one-shot tasks
              OR { "kind": "every", "everyMs": <ms> } for recurring
   - payload: { "kind": "agentTurn", "tier": "T1", "message": "<specific prompt>" }
              OR { "kind": "systemEvent", "text": "<event description>" }
5. Order jobs by execution dependency (earlier jobs first)
6. Be specific — vague jobs are useless
7. Default tier T1 (MiniMax) unless task explicitly requires T2 (Claude) reasoning`

// ── Decompose ────────────────────────────────────────────────────

/**
 * 把 goal 分解成 jobs 并写入 store。
 *
 * @param {Object} opts
 * @param {string} opts.goal     - 高层目标描述
 * @param {string} [opts.tier]   - AI tier for decomposition (default T1)
 * @param {number} [opts.maxJobs] - max jobs to create (default 5)
 * @returns {Promise<Object[]>}  - created jobs
 */
async function decompose({ goal, tier = 'T1', maxJobs = 5 }) {
  const ai = require('../ai-service')

  const userMsg = `Goal: ${goal}\n\nDecompose into at most ${maxJobs} jobs. Output only JSON.`

  let raw
  try {
    const result = await ai.call({
      tier,
      system: DECOMPOSE_SYSTEM,
      messages: [{ role: 'user', content: userMsg }],
      maxTokens: 2048,
      purpose: 'coordinator-decompose',
    })
    raw = result.content || ''
  } catch (err) {
    throw new Error(`AI decomposition failed: ${err.message}`)
  }

  // Parse JSON — strip any accidental markdown fences
  let parsed
  try {
    const clean = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    parsed = JSON.parse(clean)
  } catch (err) {
    throw new Error(`Failed to parse AI response as JSON: ${err.message}\n\nRaw: ${raw.slice(0, 300)}`)
  }

  if (!Array.isArray(parsed.jobs)) {
    throw new Error(`AI response missing "jobs" array. Got: ${JSON.stringify(parsed).slice(0, 200)}`)
  }

  // Clamp to maxJobs
  const jobDefs = parsed.jobs.slice(0, maxJobs)

  // Create jobs in store
  const created = []
  for (const def of jobDefs) {
    if (!def.name || !def.payload) continue
    const job = store.add({
      name: def.name,
      description: def.description || '',
      schedule: def.schedule || { kind: 'every', everyMs: 60 * 60_000 },
      payload: def.payload,
      enabled: true,
    })
    created.push(job)
  }

  // Record history
  const histEntry = {
    id: `decomp-${Date.now().toString(36)}`,
    goal,
    jobIds: created.map(j => j.id),
    tier,
    maxJobs,
    createdAt: new Date().toISOString(),
    status: created.length > 0 ? 'ok' : 'empty',
  }
  addHistory(histEntry)

  return created
}

// ── Status ───────────────────────────────────────────────────────

function getStatus() {
  return {
    historyCount: history.length,
    recentDecompositions: history.slice(0, 10),
  }
}

module.exports = { decompose, getStatus }
