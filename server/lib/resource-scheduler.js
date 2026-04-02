/**
 * resource-scheduler.js — 智能资源调度
 *
 * Scores task complexity and routes to appropriate execution tier:
 *   T0 — SEAI local model (simple tasks: short description, low priority, no code keywords)
 *   T1 — MiniMax cloud model (moderate tasks: medium complexity, some keywords)
 *   T2 — Claude (complex tasks: architecture, design, long description, high priority)
 *
 * Scoring algorithm:
 *   - Description length:       <100 chars → +0, 100-500 → +1, >500 → +2
 *   - Complexity keywords:      each match → +1 (max 3)
 *   - Priority level:           low → +0, medium → +1, high → +2, critical → +3
 *   - Code/technical keywords:  each match → +1 (max 2)
 *   - Sub-task count:           0 → +0, 1-3 → +1, >3 → +2
 *
 *   Total 0-2  → T0
 *   Total 3-5  → T1
 *   Total 6+   → T2
 */

const COMPLEXITY_KEYWORDS = [
  '架构', '设计', '重构', '迁移', '规划', '方案', '分析', '评估', '策略',
  'architect', 'design', 'refactor', 'migrate', 'plan', 'strategy', 'analyze',
  '系统', '模块', '集成', '优化', '算法',
]

const CODE_KEYWORDS = [
  '代码', '实现', '开发', '编写', '接口', 'API', '函数', '类', '组件',
  'code', 'implement', 'develop', 'interface', 'function', 'class', 'component',
  '测试', 'test', '调试', 'debug',
]

const PRIORITY_SCORES = {
  low:      0,
  medium:   1,
  high:     2,
  critical: 3,
}

const TIER_THRESHOLDS = {
  T0: [0, 2],   // score 0–2
  T1: [3, 5],   // score 3–5
  T2: [6, 999], // score 6+
}

/**
 * Score a task and determine the appropriate execution tier.
 *
 * @param {Object} task
 *   task.title       {string}  — task title
 *   task.description {string}  — full task description (optional)
 *   task.priority    {string}  — 'low'|'medium'|'high'|'critical'
 *   task.sub_count   {number}  — number of sub-tasks
 * @returns {{ tier: string, score: number, factors: Object }}
 */
function scoreTask(task) {
  const title = task.title || ''
  const desc = task.description || task.task_outcome || task.task_summary || ''
  const fullText = `${title} ${desc}`.toLowerCase()
  const priority = (task.priority || 'medium').toLowerCase()
  const subCount = task.sub_count || 0

  const factors = {}

  // ── Factor 1: Description length ──────────────────────────────────────
  const textLength = fullText.trim().length
  let lengthScore = 0
  if (textLength >= 500) lengthScore = 2
  else if (textLength >= 100) lengthScore = 1
  factors.length = { value: textLength, score: lengthScore }

  // ── Factor 2: Complexity keywords ─────────────────────────────────────
  const complexMatches = COMPLEXITY_KEYWORDS.filter(k => fullText.includes(k.toLowerCase()))
  const complexScore = Math.min(complexMatches.length, 3)
  factors.complexity = { matches: complexMatches.slice(0, 5), score: complexScore }

  // ── Factor 3: Priority ────────────────────────────────────────────────
  const priorityScore = PRIORITY_SCORES[priority] ?? 1
  factors.priority = { value: priority, score: priorityScore }

  // ── Factor 4: Code/technical keywords ─────────────────────────────────
  const codeMatches = CODE_KEYWORDS.filter(k => fullText.includes(k.toLowerCase()))
  const codeScore = Math.min(codeMatches.length, 2)
  factors.code = { matches: codeMatches.slice(0, 5), score: codeScore }

  // ── Factor 5: Sub-task count ──────────────────────────────────────────
  let subScore = 0
  if (subCount > 3) subScore = 2
  else if (subCount >= 1) subScore = 1
  factors.subtasks = { count: subCount, score: subScore }

  const totalScore = lengthScore + complexScore + priorityScore + codeScore + subScore

  // Determine tier
  let tier = 'T2' // default
  for (const [t, [min, max]] of Object.entries(TIER_THRESHOLDS)) {
    if (totalScore >= min && totalScore <= max) {
      tier = t
      break
    }
  }

  return { tier, score: totalScore, factors }
}

/**
 * Score a batch of tasks and return tier assignments.
 * @param {Array} tasks
 * @returns {Array<{ id, title, tier, score, factors }>}
 */
function scheduleBatch(tasks) {
  return tasks.map(task => ({
    id: task.id,
    title: task.title,
    ...scoreTask(task),
  }))
}

/**
 * Get tier statistics for a set of execution runs.
 * Helps inform scheduling decisions based on recent history.
 *
 * @param {Array} runs — execution_runs rows
 * @returns {{ by_tier, avg_api_calls_per_tier, recommended_start_tier }}
 */
function analyzeRunHistory(runs) {
  const byTier = {}
  const apiCallsByTier = {}

  for (const run of runs) {
    const tier = run.current_tier || 'T0'
    byTier[tier] = (byTier[tier] || 0) + 1
    apiCallsByTier[tier] = (apiCallsByTier[tier] || 0) + (run.api_calls || 0)
  }

  const avgApiCalls = {}
  for (const [tier, count] of Object.entries(byTier)) {
    avgApiCalls[tier] = count > 0 ? Math.round(apiCallsByTier[tier] / count) : 0
  }

  // If T0 is failing often, recommend starting at T1
  const t0Runs = runs.filter(r => r.current_tier === 'T0')
  const t0Failed = t0Runs.filter(r => r.status === 'failed' || r.current_tier !== 'T0').length
  const t0FailRate = t0Runs.length > 0 ? t0Failed / t0Runs.length : 0

  let recommendedStartTier = 'T0'
  if (t0FailRate > 0.5) recommendedStartTier = 'T1'

  return {
    by_tier: byTier,
    avg_api_calls_per_tier: avgApiCalls,
    t0_fail_rate: Math.round(t0FailRate * 100) / 100,
    recommended_start_tier: recommendedStartTier,
  }
}

module.exports = { scoreTask, scheduleBatch, analyzeRunHistory, TIER_THRESHOLDS, COMPLEXITY_KEYWORDS }
