/**
 * token-budget.js
 * Ported from OpenClaudeCode/src/utils/tokenBudget.ts
 *
 * Token budget tracking and continuation decisions for agentic loops.
 * Tells the loop whether to keep going or stop based on token usage.
 */

'use strict'

// Stop at 90% of budget; below this → nudge AI to continue
const COMPLETION_THRESHOLD = 0.9
// If progress per round drops below 500 tokens for 3+ rounds → diminishing returns
const DIMINISHING_THRESHOLD = 500

// ── Tracker ────────────────────────────────────────────────────

function createBudgetTracker() {
  return {
    continuationCount: 0,
    lastDeltaTokens: 0,
    lastGlobalTurnTokens: 0,
    startedAt: Date.now(),
  }
}

// ── Decision ───────────────────────────────────────────────────

/**
 * Check whether the agentic loop should continue or stop.
 *
 * @param {object} tracker — from createBudgetTracker()
 * @param {number|null} budget — max tokens, or null for unlimited
 * @param {number} globalTurnTokens — total tokens used so far this turn
 * @returns {{ action: 'continue'|'stop', nudgeMessage?: string, pct?: number }}
 */
function checkTokenBudget(tracker, budget, globalTurnTokens) {
  if (budget === null || budget <= 0) {
    return { action: 'stop', completionEvent: null }
  }

  const turnTokens = globalTurnTokens
  const pct = Math.round((turnTokens / budget) * 100)
  const deltaSinceLastCheck = globalTurnTokens - tracker.lastGlobalTurnTokens

  const isDiminishing =
    tracker.continuationCount >= 3 &&
    deltaSinceLastCheck < DIMINISHING_THRESHOLD &&
    tracker.lastDeltaTokens < DIMINISHING_THRESHOLD

  if (!isDiminishing && turnTokens < budget * COMPLETION_THRESHOLD) {
    tracker.continuationCount++
    tracker.lastDeltaTokens = deltaSinceLastCheck
    tracker.lastGlobalTurnTokens = globalTurnTokens
    return {
      action: 'continue',
      nudgeMessage: _budgetContinuationMessage(pct, turnTokens, budget),
      continuationCount: tracker.continuationCount,
      pct,
      turnTokens,
      budget,
    }
  }

  return {
    action: 'stop',
    completionEvent: tracker.continuationCount > 0 || isDiminishing ? {
      continuationCount: tracker.continuationCount,
      pct,
      turnTokens,
      budget,
      diminishingReturns: isDiminishing,
      durationMs: Date.now() - tracker.startedAt,
    } : null,
  }
}

function _budgetContinuationMessage(pct, turnTokens, budget) {
  const fmt = n => new Intl.NumberFormat('en-US').format(n)
  return `Stopped at ${pct}% of token target (${fmt(turnTokens)} / ${fmt(budget)}). Keep working — do not summarize.`
}

// ── Usage accumulator ──────────────────────────────────────────

function createUsageAccumulator() {
  return { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 }
}

function accumulateUsage(acc, usage) {
  if (!usage) return
  acc.inputTokens  += usage.input_tokens  ?? 0
  acc.outputTokens += usage.output_tokens ?? 0
  acc.cacheReadTokens += usage.cache_read_input_tokens ?? 0
}

function totalTokens(acc) {
  return acc.inputTokens + acc.outputTokens
}

module.exports = {
  createBudgetTracker,
  checkTokenBudget,
  createUsageAccumulator,
  accumulateUsage,
  totalTokens,
}
