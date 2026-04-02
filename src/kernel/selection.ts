/**
 * Selection — Evolutionary pressure on the contract space
 *
 * CRITICAL BOUNDARY: Positive feedback acts on CONTRACTS, never on STATE.
 * If positive feedback leaked into state space, the system would explode.
 *
 * Selection observes tick results over N ticks and decides:
 *   - keep: contract is healthy
 *   - kill: contract is harmful or dead
 *   - deprioritize: contract is noisy, reduce influence
 *   - mutate: contract has potential, try variations
 *
 * This is the E-layer's core mechanism.
 */

import type {
  ContractId, State, TickResult, Contract,
} from './types'
import { addContract, removeContract } from './state'

// ── Fitness Tracking ───────────────────────────────────────────

export interface ContractFitness {
  readonly contractId: ContractId
  /** How many ticks this contract has been alive */
  age: number
  /** Total ticks where this contract fired */
  fireCount: number
  /** Total ticks where this contract caused a conflict */
  conflictCount: number
  /** Total ticks where this contract produced a meaningful state change */
  effectCount: number
  /** Total ticks observed */
  totalTicks: number
}

/** Computed rates from raw fitness data */
export interface FitnessRates {
  readonly contractId: ContractId
  readonly fireRate: number       // fireCount / totalTicks
  readonly conflictRate: number   // conflictCount / totalTicks
  readonly effectRate: number     // effectCount / totalTicks
  readonly age: number
}

// ── Selection Policy ───────────────────────────────────────────

export interface SelectionPolicy {
  /** Conflict rate above this → kill */
  readonly maxConflictRate: number
  /** Fire rate below this → kill (dead rule) */
  readonly minFireRate: number
  /** Age above this AND effectRate below minEffectRate → kill */
  readonly maxAge: number
  /** Minimum effect rate for old contracts */
  readonly minEffectRate: number
  /** Minimum ticks before selection applies (grace period) */
  readonly minObservationTicks: number
}

export function defaultSelectionPolicy(): SelectionPolicy {
  return {
    maxConflictRate: 0.5,
    minFireRate: 0.01,
    maxAge: 100,
    minEffectRate: 0.05,
    minObservationTicks: 10,
  }
}

// ── Selection Actions ──────────────────────────────────────────

export type SelectionAction =
  | { readonly op: 'keep'; readonly contractId: ContractId }
  | { readonly op: 'kill'; readonly contractId: ContractId; readonly reason: string }
  | { readonly op: 'deprioritize'; readonly contractId: ContractId; readonly newPriority: number }

// ── Fitness Tracker ────────────────────────────────────────────

export interface FitnessTracker {
  /** Record a tick's results */
  recordTick(prev: State, next: State, result: TickResult): void
  /** Get fitness for all tracked contracts */
  getFitness(): readonly ContractFitness[]
  /** Get computed rates */
  getRates(): readonly FitnessRates[]
  /** Reset tracking for a contract (e.g., after mutation) */
  reset(contractId: ContractId): void
}

export function createFitnessTracker(): FitnessTracker {
  const fitness = new Map<ContractId, ContractFitness>()

  return {
    recordTick(prev: State, next: State, result: TickResult): void {
      // Ensure all contracts in state are tracked
      for (const [id] of Array.from(next.contracts)) {
        if (!fitness.has(id)) {
          fitness.set(id, {
            contractId: id,
            age: 0,
            fireCount: 0,
            conflictCount: 0,
            effectCount: 0,
            totalTicks: 0,
          })
        }
      }

      // Determine which contracts fired (heuristic: if patches were applied and contract exists)
      // In a full implementation, tick would report which contracts fired.
      // For now: if state changed and contract exists, assume it may have fired.
      const stateChanged = prev.tick !== next.tick && result.patchesApplied > 0

      // Determine which contracts caused conflicts
      const conflictContracts = new Set<string>()
      for (const conflict of result.conflicts) {
        for (const patch of conflict.patches) {
          // Find contracts whose participants include the patch target
          for (const [cId, contract] of Array.from(next.contracts)) {
            if (contract.participants.includes(patch.target)) {
              conflictContracts.add(cId)
            }
          }
        }
      }

      // Update fitness for each tracked contract
      for (const [id, f] of Array.from(fitness)) {
        // Skip contracts no longer in state
        if (!next.contracts.has(id)) {
          fitness.delete(id)
          continue
        }

        f.age++
        f.totalTicks++

        if (stateChanged) {
          f.fireCount++
        }

        if (conflictContracts.has(id)) {
          f.conflictCount++
        }

        // Effect: did this contract's participants' values change?
        const contract = next.contracts.get(id)
        if (contract) {
          const hasEffect = contract.participants.some(nodeId => {
            const prevNode = prev.nodes.get(nodeId)
            const nextNode = next.nodes.get(nodeId)
            if (!prevNode || !nextNode) return true // node added/removed = effect
            // Compare values
            if (prevNode.values.size !== nextNode.values.size) return true
            for (const [key, val] of Array.from(prevNode.values)) {
              if (nextNode.values.get(key) !== val) return true
            }
            return false
          })
          if (hasEffect) {
            f.effectCount++
          }
        }
      }
    },

    getFitness(): readonly ContractFitness[] {
      return Array.from(fitness.values())
    },

    getRates(): readonly FitnessRates[] {
      return Array.from(fitness.values()).map(f => ({
        contractId: f.contractId,
        fireRate: f.totalTicks > 0 ? f.fireCount / f.totalTicks : 0,
        conflictRate: f.totalTicks > 0 ? f.conflictCount / f.totalTicks : 0,
        effectRate: f.totalTicks > 0 ? f.effectCount / f.totalTicks : 0,
        age: f.age,
      }))
    },

    reset(contractId: ContractId): void {
      fitness.delete(contractId)
    },
  }
}

// ── Selection Engine ───────────────────────────────────────────

/**
 * Evaluate all tracked contracts and produce selection actions.
 * This is the core evolutionary pressure function.
 *
 * Rules:
 *   1. Grace period: contracts younger than minObservationTicks are always kept
 *   2. High conflict → kill
 *   3. Zero fire rate → kill (dead rule)
 *   4. Old + low effect → kill (obsolete rule)
 *   5. Everything else → keep
 */
export function selectContracts(
  rates: readonly FitnessRates[],
  policy: SelectionPolicy,
): readonly SelectionAction[] {
  const actions: SelectionAction[] = []

  for (const r of rates) {
    // Grace period
    if (r.age < policy.minObservationTicks) {
      actions.push({ op: 'keep', contractId: r.contractId })
      continue
    }

    // High conflict rate → kill
    if (r.conflictRate > policy.maxConflictRate) {
      actions.push({
        op: 'kill',
        contractId: r.contractId,
        reason: `conflict rate ${(r.conflictRate * 100).toFixed(1)}% exceeds max ${(policy.maxConflictRate * 100).toFixed(1)}%`,
      })
      continue
    }

    // Dead rule → kill
    if (r.fireRate < policy.minFireRate) {
      actions.push({
        op: 'kill',
        contractId: r.contractId,
        reason: `fire rate ${(r.fireRate * 100).toFixed(1)}% below min ${(policy.minFireRate * 100).toFixed(1)}%`,
      })
      continue
    }

    // Old + ineffective → kill
    if (r.age > policy.maxAge && r.effectRate < policy.minEffectRate) {
      actions.push({
        op: 'kill',
        contractId: r.contractId,
        reason: `age ${r.age} exceeds max ${policy.maxAge} with effect rate ${(r.effectRate * 100).toFixed(1)}%`,
      })
      continue
    }

    // Healthy
    actions.push({ op: 'keep', contractId: r.contractId })
  }

  return actions
}

/**
 * Apply selection actions to state.
 * Returns new state with killed contracts removed and deprioritized contracts updated.
 */
export function applySelectionActions(
  state: State,
  actions: readonly SelectionAction[],
): State {
  let current = state

  for (const action of actions) {
    if (action.op === 'kill') {
      current = removeContract(current, action.contractId)
    } else if (action.op === 'deprioritize') {
      const existing = current.contracts.get(action.contractId)
      if (existing) {
        const updated: Contract = { ...existing, priority: action.newPriority }
        current = removeContract(current, action.contractId)
        current = addContract(current, updated)
      }
    }
    // 'keep' → no-op
  }

  return current
}
