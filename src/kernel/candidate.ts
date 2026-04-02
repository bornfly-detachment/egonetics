/**
 * Candidate — External structure intake pipeline
 *
 * All external uncertainty (AI / human / internet) enters the system
 * as "candidate contracts" — NOT as facts.
 *
 * A candidate may be wrong, conflicting, or garbage.
 * That's fine — Constitution only checks legality, not correctness.
 *
 * Pipeline: external source → CandidateContract → Constitution → accept/reject
 */

import type {
  Contract, ContractId, State, UniverseSpec,
  ConstitutionResult, Frozen,
} from './types'
import { contractId } from './types'
import { validateContract } from './constitution'

// ── Candidate Types ────────────────────────────────────────────

export interface CandidateContract {
  /** Where this candidate came from */
  readonly source: CandidateSource
  /** The proposed contract (may be invalid) */
  readonly contract: Contract
  /** Which generation of evolution produced this */
  readonly generation: number
  /** If mutated from an existing contract, the parent */
  readonly parentId?: ContractId
  /** Timestamp of creation */
  readonly createdAt: number
}

export type CandidateSource = 'ai' | 'human' | 'sensor' | 'mutation' | 'seed'

export interface CandidateResult {
  readonly accepted: boolean
  readonly candidate: CandidateContract
  readonly validation: ConstitutionResult
}

// ── Submission ─────────────────────────────────────────────────

/**
 * Submit a candidate contract for constitutional review.
 * Returns whether it was accepted and why/why not.
 */
export function submitCandidate(
  candidate: CandidateContract,
  state: State,
  spec: UniverseSpec,
): CandidateResult {
  const validation = validateContract(candidate.contract, state, spec)
  return {
    accepted: validation.valid,
    candidate,
    validation,
  }
}

/**
 * Submit a batch of candidates. Returns all results.
 * Accepted candidates are returned in priority order.
 */
export function submitCandidates(
  candidates: readonly CandidateContract[],
  state: State,
  spec: UniverseSpec,
): readonly CandidateResult[] {
  return candidates.map(c => submitCandidate(c, state, spec))
}

// ── Candidate Construction Helpers ─────────────────────────────

let candidateCounter = 0

/** Generate a unique candidate contract ID */
export function nextCandidateId(source: CandidateSource): ContractId {
  candidateCounter++
  return contractId(`${source}-${Date.now()}-${candidateCounter}`)
}

/**
 * Create a CandidateContract from raw parts.
 * Convenience for external systems that produce contracts.
 */
export function createCandidate(
  source: CandidateSource,
  contract: Contract,
  generation: number = 0,
  parentId?: ContractId,
): CandidateContract {
  return {
    source,
    contract,
    generation,
    parentId,
    createdAt: Date.now(),
  }
}
