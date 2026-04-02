/**
 * State — Computational closure construction and read-only projection
 *
 * State is the "world" that tick operates on.
 * StateView is the read-only projection passed to contract conditions/emitters.
 */

import type {
  State, StateView, NodeState, NodeId, ContractId,
  Contract, VersionId, Frozen,
} from './types'
import { nodeId, versionId } from './types'

// ── State Construction ─────────────────────────────────────────

/** Create an empty initial state */
export function createState(tick: number = 0): State {
  return {
    tick,
    nodes: new Map(),
    contracts: new Map(),
  }
}

/** Add or replace a node in state (immutable — returns new State) */
export function addNode(
  state: State,
  id: NodeId,
  patternVersion: VersionId,
  values?: ReadonlyMap<string, Frozen>,
): State {
  const nodes = new Map(state.nodes)
  nodes.set(id, {
    nodeId: id,
    patternVersion,
    values: values ?? new Map(),
  })
  return { ...state, nodes }
}

/** Register a contract in state (immutable) */
export function addContract(state: State, contract: Contract): State {
  const contracts = new Map(state.contracts)
  contracts.set(contract.id, contract)
  return { ...state, contracts }
}

/** Remove a node from state (immutable) */
export function removeNode(state: State, id: NodeId): State {
  const nodes = new Map(state.nodes)
  nodes.delete(id)
  return { ...state, nodes }
}

/** Remove a contract from state (immutable) */
export function removeContract(state: State, id: ContractId): State {
  const contracts = new Map(state.contracts)
  contracts.delete(id)
  return { ...state, contracts }
}

/** Advance tick counter (immutable) */
export function advanceTick(state: State): State {
  return { ...state, tick: state.tick + 1 }
}

// ── StateView — Read-Only Projection ───────────────────────────

/**
 * Create a StateView from State.
 * This is what contracts receive — they can read but never mutate.
 */
export function createStateView(state: State): StateView {
  return {
    tick: state.tick,

    getNode(id: NodeId): NodeState | undefined {
      return state.nodes.get(id)
    },

    getValue(nid: NodeId, field: string): Frozen | undefined {
      return state.nodes.get(nid)?.values.get(field)
    },

    getContract(id: ContractId): Contract | undefined {
      return state.contracts.get(id)
    },

    getNodesByPattern(patternId: NodeId): readonly NodeState[] {
      const result: NodeState[] = []
      for (const node of Array.from(state.nodes.values())) {
        // Match by pattern version prefix (nodeId is the pattern's id)
        if (node.patternVersion.startsWith(patternId)) {
          result.push(node)
        }
      }
      return result
    },
  }
}

// ── State Comparison (for convergence detection) ───────────────

/**
 * Check if two states are structurally equal.
 * Used by tick executor to detect convergence (no patches produced = same state).
 */
export function statesEqual(a: State, b: State): boolean {
  if (a.nodes.size !== b.nodes.size) return false

  for (const [id, nodeA] of Array.from(a.nodes)) {
    const nodeB = b.nodes.get(id)
    if (!nodeB) return false
    if (nodeA.patternVersion !== nodeB.patternVersion) return false
    if (!valuesEqual(nodeA.values, nodeB.values)) return false
  }

  return true
}

function valuesEqual(
  a: ReadonlyMap<string, Frozen>,
  b: ReadonlyMap<string, Frozen>,
): boolean {
  if (a.size !== b.size) return false
  for (const [key, val] of Array.from(a)) {
    const bVal = b.get(key)
    if (!deepEqual(val, bVal)) return false
  }
  return true
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || b === null) return false
  if (typeof a !== typeof b) return false
  if (typeof a !== 'object') return false

  const aObj = a as Record<string, unknown>
  const bObj = b as Record<string, unknown>
  const aKeys = Object.keys(aObj)
  const bKeys = Object.keys(bObj)
  if (aKeys.length !== bKeys.length) return false

  for (const key of aKeys) {
    if (!deepEqual(aObj[key], bObj[key])) return false
  }
  return true
}
