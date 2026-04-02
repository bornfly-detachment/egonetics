/**
 * Observer Protocol — Pure state diff → Effect descriptions
 *
 * INVARIANTS (non-negotiable):
 *   1. Observer is PURE: (prev, next, result) → Effect[]
 *   2. Observer has NO internal state, NO external reads
 *   3. Effects are DESCRIPTIONS, not actions
 *   4. Effects NEVER execute in the same tick
 *   5. Runtime Interpreter is responsible for executing effects
 *
 * The self-feedback loop:
 *   state → observer → TriggerEffect → PortBuffer → next Snapshot → next tick
 *   Safe because Snapshot freeze creates a one-beat delay.
 */

import type {
  State, TickResult, Effect, RenderEffect, AlertEffect, LogEffect, TriggerEffect,
  ObserverFn, NodeId, Frozen, PortBuffer,
} from './types'

// ── Built-in Observers ─────────────────────────────────────────

/**
 * Diff observer — produces RenderEffects for all changed node values.
 * This is the bridge between Kernel and Projection Layer (e.g., Three.js).
 */
export function diffObserver(prev: State, next: State, _result: TickResult): readonly Effect[] {
  const effects: Effect[] = []

  // Check all nodes in next state for changes
  for (const [id, nextNode] of Array.from(next.nodes)) {
    const prevNode = prev.nodes.get(id)

    if (!prevNode) {
      // New node — render all values as changes from undefined
      const changes = new Map<string, { prev: Frozen; next: Frozen }>()
      for (const [field, value] of Array.from(nextNode.values)) {
        changes.set(field, { prev: undefined, next: value })
      }
      if (changes.size > 0) {
        effects.push({ type: 'render', nodeId: id, changes })
      }
      continue
    }

    // Existing node — diff values
    const changes = new Map<string, { prev: Frozen; next: Frozen }>()
    for (const [field, nextVal] of Array.from(nextNode.values)) {
      const prevVal = prevNode.values.get(field)
      if (prevVal !== nextVal) {
        changes.set(field, { prev: prevVal, next: nextVal })
      }
    }
    // Check for deleted fields
    for (const [field, prevVal] of Array.from(prevNode.values)) {
      if (!nextNode.values.has(field)) {
        changes.set(field, { prev: prevVal, next: undefined })
      }
    }

    if (changes.size > 0) {
      effects.push({ type: 'render', nodeId: id, changes })
    }
  }

  // Check for deleted nodes
  for (const [id] of Array.from(prev.nodes)) {
    if (!next.nodes.has(id)) {
      effects.push({
        type: 'render',
        nodeId: id,
        changes: new Map([['__deleted', { prev: true, next: undefined }]]),
      })
    }
  }

  return effects
}

/**
 * Conflict observer — produces AlertEffects for all conflicts.
 * E-layer consumes these to decide how to resolve.
 */
export function conflictObserver(_prev: State, _next: State, result: TickResult): readonly Effect[] {
  return result.conflicts.map(conflict => ({
    type: 'alert' as const,
    conflict,
  }))
}

/**
 * Log observer — produces a LogEffect summarizing each tick.
 * Chronicle trace consumer.
 */
export function logObserver(_prev: State, next: State, result: TickResult): readonly Effect[] {
  return [{
    type: 'log',
    entry: {
      tick: next.tick,
      event: result.converged ? 'tick:converged' : 'tick:diverged',
      data: {
        rounds: result.rounds,
        patchesApplied: result.patchesApplied,
        conflicts: result.conflicts.length,
      },
    },
  }]
}

// ── Observer Composition ───────────────────────────────────────

/**
 * Compose multiple observers into one.
 * Each observer is pure; composition is just concatenation.
 */
export function composeObservers(...observers: ObserverFn[]): ObserverFn {
  return (prev, next, result) => {
    const effects: Effect[] = []
    for (const observer of observers) {
      effects.push(...observer(prev, next, result))
    }
    return effects
  }
}

/**
 * Default observer: diff + conflict + log.
 * Covers the three basic needs: render, alert, trace.
 */
export const defaultObserver: ObserverFn = composeObservers(
  diffObserver,
  conflictObserver,
  logObserver,
)

// ── Effect Execution (by Runtime Interpreter) ──────────────────

/**
 * Apply trigger effects to PortBuffer.
 * This is the ONLY function that bridges Observer → PortBuffer.
 *
 * Called by Runtime Interpreter AFTER tick completes.
 * The values only become visible in the NEXT Snapshot freeze.
 *
 * This function is NOT pure (it mutates PortBuffer),
 * which is why it lives at the boundary, not inside Observer.
 */
export function applyTriggerEffects(
  effects: readonly Effect[],
  buffer: PortBuffer,
): void {
  for (const effect of effects) {
    if (effect.type === 'trigger') {
      buffer.write(effect.portId, effect.value)
    }
  }
}

/**
 * Filter effects by type — utility for Runtime Interpreter.
 */
export function filterEffects<T extends Effect['type']>(
  effects: readonly Effect[],
  type: T,
): ReadonlyArray<Extract<Effect, { type: T }>> {
  return effects.filter(e => e.type === type) as unknown as ReadonlyArray<Extract<Effect, { type: T }>>
}
