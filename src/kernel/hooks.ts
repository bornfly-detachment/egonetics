/**
 * Hook Gateway — Constitutional pre-patch validation
 *
 * Analogous to OpenClaudeCode's PreToolUse/PostToolUse hooks.
 * Runs synchronously between mergePatches() and applyPatches().
 *
 * Circuit:
 *   patches → mergePatches() → [prePatch hooks]
 *     allow → applyPatches() → new State
 *     deny  → skip apply    → return original State (rollback)
 */

import type { PatchHook, PatchHookContext, PatchHookResult, HookRegistry } from './types'

// ── Registry Factory ───────────────────────────────────────────

export function createHookRegistry(prePatch: readonly PatchHook[] = []): HookRegistry {
  return { prePatch }
}

// ── Hook Runner ────────────────────────────────────────────────

/**
 * Run all pre-patch hooks in order.
 * Returns on first deny — remaining hooks are skipped.
 */
export function runPrePatchHooks(
  hooks: readonly PatchHook[],
  ctx: PatchHookContext,
): PatchHookResult {
  for (const hook of hooks) {
    const result = hook(ctx)
    if (result.decision === 'deny') return result
  }
  return { decision: 'allow' }
}

// ── Built-in Constitutional Hooks ──────────────────────────────

/**
 * Block any round that produced irreconcilable set-set conflicts
 * or unknown merge strategies.
 *
 * Maps to P-layer 'exclusivity' and 'algebra' constitutional rules.
 */
export const conflictBlockHook: PatchHook = (ctx) => {
  if (ctx.patches.length === 0) return { decision: 'allow' }

  const critical = ctx.conflicts.find(c =>
    c.reason.includes('set-set conflict') ||
    c.reason.includes('unknown merge strategy') ||
    c.reason.includes('incompatible merge strategies'),
  )
  if (critical) {
    return {
      decision: 'deny',
      reason: `P-layer violation (algebra/exclusivity): ${critical.reason}`,
    }
  }
  return { decision: 'allow' }
}

/**
 * Guard against runaway rounds within a single tick.
 * Deny if we are past round 50 — the tick executor's outer MAX_ROUNDS
 * handles full divergence, but this hook catches partial loops earlier.
 */
export const divergenceGuardHook: PatchHook = (ctx) => {
  if (ctx.round > 50) {
    return {
      decision: 'deny',
      reason: `Divergence guard: round ${ctx.round} exceeds threshold 50`,
    }
  }
  return { decision: 'allow' }
}

/**
 * Default registry shipped with the kernel.
 * Includes both built-in constitutional guards.
 * Consumers can extend via createHookRegistry([...defaultHooks, myHook]).
 */
export const DEFAULT_HOOKS: readonly PatchHook[] = [
  conflictBlockHook,
  divergenceGuardHook,
]

export function defaultHookRegistry(): HookRegistry {
  return createHookRegistry(DEFAULT_HOOKS)
}
