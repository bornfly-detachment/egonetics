/**
 * Tick Executor — Deterministic fixed-point evaluator
 *
 * Tick lifecycle:
 *   Phase 0: FREEZE — PortBuffer → immutable Snapshot
 *   Phase 1: EVAL   — contracts evaluate against StateView + Snapshot
 *   Phase 2: APPLY  — patches merged via algebra, applied to State
 *   Repeat Phase 1-2 until convergence or MAX_ROUNDS
 *
 * Convergence = a round where no contract fires (empty patch set).
 * Divergence  = MAX_ROUNDS exceeded → escalate to E-layer.
 *
 * This is a prioritized rewrite system + fixed-point evaluator.
 * Closer to VM reduction semantics than event-driven runtime.
 */

import type {
  State, Snapshot, Contract, Patch, Conflict, TickResult, PortBuffer,
} from './types'
import { createStateView } from './state'
import { mergePatches, applyPatches } from './patch'

/** Hard upper bound on convergence rounds per tick */
const MAX_ROUNDS = 100

// ── Tick Executor ──────────────────────────────────────────────

/**
 * Execute one tick of the PRVSE kernel.
 *
 * @param state   Current world state
 * @param buffer  Port buffer with accumulated external inputs
 * @returns       TickResult with new state, convergence info, conflicts
 */
export function tick(state: State, buffer: PortBuffer): TickResult {
  // ── Phase 0: FREEZE ──
  const snapshot = buffer.freeze(state.tick + 1)

  return tickWithSnapshot(state, snapshot)
}

/**
 * Execute tick with a pre-built snapshot (for testing / deterministic replay).
 */
export function tickWithSnapshot(state: State, snapshot: Snapshot): TickResult {
  const allConflicts: Conflict[] = []
  let totalPatchesApplied = 0
  let current = state
  let round = 0

  // Collect and sort contracts by priority (high → low) for deterministic order
  const contracts = sortContracts(Array.from(current.contracts.values()))

  // ── Phase 1-2 Loop: EVAL → APPLY until convergence ──
  while (round < MAX_ROUNDS) {
    round++

    // Phase 1: EVAL — evaluate all contracts
    const view = createStateView(current)
    const allPatches: Patch[] = []

    for (const contract of contracts) {
      try {
        const shouldFire = contract.condition(view, snapshot)
        if (!shouldFire) continue

        const patches = contract.emit(view, snapshot)
        allPatches.push(...patches)
      } catch (_err) {
        // Contract threw → treat as non-firing (log in production)
        // A contract that throws is not pure — this is a safety net
        allConflicts.push({
          type: 'conflict',
          patches: [],
          reason: `contract ${contract.id} threw during evaluation`,
        })
      }
    }

    // Convergence check: no patches = fixed point reached
    if (allPatches.length === 0) {
      return {
        state: advanceTick(current),
        rounds: round,
        converged: true,
        conflicts: allConflicts,
        patchesApplied: totalPatchesApplied,
      }
    }

    // Phase 2: APPLY — merge patches, resolve conflicts, apply
    const { resolved, conflicts } = mergePatches(allPatches)
    allConflicts.push(...conflicts)

    current = applyPatches(current, resolved)
    totalPatchesApplied += resolved.length
  }

  // MAX_ROUNDS exceeded → divergence
  return {
    state: advanceTick(current),
    rounds: round,
    converged: false,
    conflicts: [
      ...allConflicts,
      {
        type: 'conflict',
        patches: [],
        reason: `tick did not converge within ${MAX_ROUNDS} rounds`,
      },
    ],
    patchesApplied: totalPatchesApplied,
  }
}

// ── Helpers ────────────────────────────────────────────────────

/** Sort contracts: higher priority first, then by ID for determinism */
function sortContracts(contracts: Contract[]): Contract[] {
  return contracts.sort((a, b) =>
    b.priority - a.priority || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  )
}

/** Advance tick counter (returns new immutable State) */
function advanceTick(state: State): State {
  return { ...state, tick: state.tick + 1 }
}

// ── Multi-Tick Runner ──────────────────────────────────────────

/**
 * Run multiple ticks, feeding port buffer between each.
 * Useful for simulation / testing.
 */
export function runTicks(
  initialState: State,
  buffer: PortBuffer,
  count: number,
): { states: State[]; results: TickResult[] } {
  const states: State[] = [initialState]
  const results: TickResult[] = []
  let current = initialState

  for (let i = 0; i < count; i++) {
    const result = tick(current, buffer)
    results.push(result)
    current = result.state
    states.push(current)
  }

  return { states, results }
}
