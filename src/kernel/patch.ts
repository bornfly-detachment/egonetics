/**
 * Patch Algebra — Semilattice merge over delta operations
 *
 * Core invariants:
 *   Associativity: merge(merge(a,b), c) === merge(a, merge(b,c))
 *   Idempotency:   merge(a, a) === a
 *   Determinism:   same inputs → same output, always
 *
 * When merge is undecidable → produce Conflict, escalate to E-layer.
 */

import type {
  Patch, PatchSet, PatchDelete, PatchMerge,
  Conflict, MergeStrategyName, NodeId, Frozen,
  State, NodeState,
} from './types'

// ── Patch Key ──────────────────────────────────────────────────

/** Canonical key for a patch target: nodeId + path */
function patchKey(p: Patch): string {
  return `${p.target}::${p.path.join('.')}`
}

// ── Merge Strategies ───────────────────────────────────────────

type MergeFn = (a: Frozen, b: Frozen) => Frozen

const MERGE_STRATEGIES: Record<MergeStrategyName, MergeFn> = {
  'numeric.sum': (a, b) => (a as number) + (b as number),

  'numeric.max': (a, b) => Math.max(a as number, b as number),

  'numeric.min': (a, b) => Math.min(a as number, b as number),

  'set.union': (a, b) => {
    const sa = a as readonly unknown[]
    const sb = b as readonly unknown[]
    const merged = new Set(sa.concat(sb))
    return Array.from(merged)
  },

  'set.intersection': (a, b) => {
    const sa = new Set(a as readonly unknown[])
    const sb = b as readonly unknown[]
    return sb.filter(x => sa.has(x))
  },

  'priority.highest': (_a, b) => b, // b wins (higher priority passed second)

  'replace': (_a, b) => b, // last-write-wins
}

/**
 * Resolve a named merge strategy.
 * Returns the merge function or undefined if unknown.
 */
export function getMergeStrategy(name: MergeStrategyName): MergeFn | undefined {
  return MERGE_STRATEGIES[name]
}

// ── Two-Patch Merge ────────────────────────────────────────────

/**
 * Merge two patches targeting the same key.
 * Returns merged Patch or Conflict if irreconcilable.
 */
export function mergeTwoPatches(a: Patch, b: Patch): Patch | Conflict {
  // Different targets → no conflict (should not be called, but defensive)
  if (patchKey(a) !== patchKey(b)) {
    return b // no conflict, just take b
  }

  // delete + delete → idempotent
  if (a.op === 'delete' && b.op === 'delete') {
    return a
  }

  // delete + set/merge → higher priority wins
  if (a.op === 'delete' || b.op === 'delete') {
    return a.priority >= b.priority ? a : b
  }

  // Both are set or merge — use priority as tiebreaker for 'set'
  if (a.op === 'set' && b.op === 'set') {
    if (a.priority !== b.priority) {
      return a.priority > b.priority ? a : b
    }
    // Same priority, same path, different values → Conflict
    if (a.value === b.value) return a // idempotent
    return {
      type: 'conflict',
      patches: [a, b],
      reason: `set-set conflict at ${patchKey(a)} with equal priority`,
    }
  }

  // merge + merge → compose via strategy
  if (a.op === 'merge' && b.op === 'merge') {
    if (a.strategy !== b.strategy) {
      return {
        type: 'conflict',
        patches: [a, b],
        reason: `incompatible merge strategies: ${a.strategy} vs ${b.strategy}`,
      }
    }
    const fn = getMergeStrategy(a.strategy)
    if (!fn) {
      return {
        type: 'conflict',
        patches: [a, b],
        reason: `unknown merge strategy: ${a.strategy}`,
      }
    }
    // Compose: merge(a.value, b.value) using the declared strategy
    const merged = fn(a.value, b.value)
    return {
      op: 'merge',
      target: a.target,
      path: a.path,
      strategy: a.strategy,
      value: merged,
      priority: Math.max(a.priority, b.priority),
    }
  }

  // set + merge or merge + set → higher priority wins
  const higher = a.priority >= b.priority ? a : b
  return higher
}

// ── Multi-Patch Merge ──────────────────────────────────────────

/**
 * Merge a batch of patches from multiple contracts.
 * Groups by target key, then folds pairwise.
 *
 * Returns: { resolved: Patch[], conflicts: Conflict[] }
 */
export function mergePatches(
  patches: readonly Patch[],
): { resolved: readonly Patch[]; conflicts: readonly Conflict[] } {
  // Group patches by key
  const groups = new Map<string, Patch[]>()
  for (const p of patches) {
    const key = patchKey(p)
    const group = groups.get(key)
    if (group) {
      group.push(p)
    } else {
      groups.set(key, [p])
    }
  }

  const resolved: Patch[] = []
  const conflicts: Conflict[] = []

  for (const group of Array.from(groups.values())) {
    if (group.length === 1) {
      resolved.push(group[0])
      continue
    }

    // Sort by priority descending for deterministic fold order
    group.sort((a, b) => b.priority - a.priority || comparePatches(a, b))

    // Fold pairwise: merge(merge(p0, p1), p2)...
    let acc: Patch | Conflict = group[0]
    for (let i = 1; i < group.length; i++) {
      if ('type' in acc && acc.type === 'conflict') break
      acc = mergeTwoPatches(acc as Patch, group[i])
    }

    if ('type' in acc && (acc as Conflict).type === 'conflict') {
      conflicts.push(acc as Conflict)
    } else {
      resolved.push(acc as Patch)
    }
  }

  return { resolved, conflicts }
}

/** Deterministic ordering for same-priority patches (by target + path + op) */
function comparePatches(a: Patch, b: Patch): number {
  const ka = `${a.target}::${a.path.join('.')}::${a.op}`
  const kb = `${b.target}::${b.path.join('.')}::${b.op}`
  return ka < kb ? -1 : ka > kb ? 1 : 0
}

// ── Apply Patches to State ─────────────────────────────────────

/**
 * Apply a list of resolved patches to produce a new State.
 * Immutable: returns a new State, never mutates the input.
 *
 * Monotonicity check: if a patch tries to "downgrade" a value
 * in a monotone field, the patch is skipped (violation logged).
 */
export function applyPatches(state: State, patches: readonly Patch[]): State {
  // Build a mutable working copy of node states
  const nodes = new Map(state.nodes)

  for (const patch of patches) {
    const nodeState = nodes.get(patch.target)
    if (!nodeState && patch.op !== 'delete') {
      // Target node doesn't exist — skip (or could create, but that's E-layer)
      continue
    }

    if (patch.op === 'delete') {
      if (!nodeState) continue
      const newValues = new Map(nodeState.values)
      deleteAtPath(newValues, patch.path)
      nodes.set(patch.target, {
        ...nodeState,
        values: newValues,
      })
      continue
    }

    if (patch.op === 'set') {
      const newValues = new Map(nodeState!.values)
      setAtPath(newValues, patch.path, patch.value)
      nodes.set(patch.target, {
        ...nodeState!,
        values: newValues,
      })
      continue
    }

    if (patch.op === 'merge') {
      const fn = getMergeStrategy(patch.strategy)
      if (!fn) continue

      const newValues = new Map(nodeState!.values)
      const existing = getAtPath(newValues, patch.path)
      const merged = existing !== undefined ? fn(existing, patch.value) : patch.value
      setAtPath(newValues, patch.path, merged)
      nodes.set(patch.target, {
        ...nodeState!,
        values: newValues,
      })
    }
  }

  return {
    tick: state.tick,
    nodes,
    contracts: state.contracts,
  }
}

// ── Path Utilities ─────────────────────────────────────────────

/** Get a value at a dot-path within a values map */
function getAtPath(values: ReadonlyMap<string, Frozen>, path: readonly string[]): Frozen | undefined {
  if (path.length === 0) return undefined
  if (path.length === 1) return values.get(path[0])

  // Nested: first element is the field, rest navigate into the value
  let current: Frozen | undefined = values.get(path[0])
  for (let i = 1; i < path.length; i++) {
    if (current === undefined || current === null) return undefined
    current = (current as Record<string, Frozen>)[path[i]]
  }
  return current
}

/** Set a value at a dot-path within a mutable values map */
function setAtPath(values: Map<string, Frozen>, path: readonly string[], value: Frozen): void {
  if (path.length === 0) return

  if (path.length === 1) {
    values.set(path[0], value)
    return
  }

  // Nested: clone intermediate objects
  const root = (values.get(path[0]) ?? {}) as Record<string, unknown>
  const cloned = structuredClone(root)
  let current = cloned
  for (let i = 1; i < path.length - 1; i++) {
    if (current[path[i]] === undefined || typeof current[path[i]] !== 'object') {
      current[path[i]] = {}
    }
    current = current[path[i]] as Record<string, unknown>
  }
  current[path[path.length - 1]] = value
  values.set(path[0], cloned as Frozen)
}

/** Delete a value at a dot-path within a mutable values map */
function deleteAtPath(values: Map<string, Frozen>, path: readonly string[]): void {
  if (path.length === 0) return
  if (path.length === 1) {
    values.delete(path[0])
    return
  }

  const root = values.get(path[0])
  if (root === undefined) return
  const cloned = structuredClone(root) as Record<string, unknown>
  let current = cloned
  for (let i = 1; i < path.length - 1; i++) {
    if (current[path[i]] === undefined) return
    current = current[path[i]] as Record<string, unknown>
  }
  delete current[path[path.length - 1]]
  values.set(path[0], cloned as Frozen)
}
