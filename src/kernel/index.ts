/**
 * PRVSE Kernel — Public API
 *
 * Pure TypeScript, zero dependencies.
 * This is the formal computational core of the PRVSE system.
 *
 * 4-Layer Architecture:
 *   Constitution      → validates contract legality at registration
 *   Kernel Core       → deterministic tick executor (fixed-point evaluator)
 *   Observer Protocol  → pure state diff → Effect descriptions
 *   Reality Protocol   → epoch-based event collection + causal ordering
 *
 * All layers share a single UniverseSpec to prevent semantic divergence.
 *
 * Non-negotiable invariants:
 *   1. Effects are pure descriptions — Runtime Interpreter executes them
 *   2. No effect can influence the same tick's state (one-beat delay)
 *   3. Reality Protocol is an ordering function, not a scheduler
 *   4. Constitution does combinatorial validation, not just single-contract checks
 */

// ── Types ──
export type {
  NodeId, ContractId, VersionId, PortId,
  Frozen,
  Pattern, SchemaField,
  Value, MergeStrategyName,
  RelationType, Contract, ContractCondition, ContractEmitter,
  Patch, PatchSet, PatchDelete, PatchMerge, Conflict,
  Snapshot,
  NodeState, State, StateView,
  TickResult, PortBuffer,
  // Universe Spec
  UniverseSpec,
  // Constitution
  Violation, ConstitutionRule, ConstitutionResult,
  // Observer
  Effect, RenderEffect, AlertEffect, LogEffect, TriggerEffect, ObserverFn,
  // Reality Protocol
  SnapshotCompleteness, RealitySnapshot, RealityEvent, RealityOrderingFn,
} from './types'

// ── ID Constructors ──
export { nodeId, contractId, versionId, portId } from './types'

// ── State ──
export {
  createState,
  addNode,
  addContract,
  removeNode,
  removeContract,
  createStateView,
  statesEqual,
} from './state'

// ── Snapshot ──
export {
  createPortBuffer,
  emptySnapshot,
  readPort,
} from './snapshot'

// ── Patch Algebra ──
export {
  mergeTwoPatches,
  mergePatches,
  applyPatches,
  getMergeStrategy,
} from './patch'

// ── Tick Executor ──
export {
  tick,
  tickWithSnapshot,
  runTicks,
} from './tick'

// ── Constitution ──
export {
  validateContract,
  validateRegistry,
  defaultUniverseSpec,
} from './constitution'

// ── Observer Protocol ──
export {
  diffObserver,
  conflictObserver,
  logObserver,
  composeObservers,
  defaultObserver,
  applyTriggerEffects,
  filterEffects,
} from './observer'

// ── Reality Protocol ──
export {
  createEpochManager,
  timestampOrdering,
  sourcePriorityOrdering,
  causalOrdering,
} from './reality'
export type { EpochState, EpochManager } from './reality'

// ── Candidate ──
export {
  submitCandidate,
  submitCandidates,
  createCandidate,
  nextCandidateId,
} from './candidate'
export type { CandidateContract, CandidateSource, CandidateResult } from './candidate'

// ── Selection (E-layer) ──
export {
  createFitnessTracker,
  selectContracts,
  applySelectionActions,
  defaultSelectionPolicy,
} from './selection'
export type {
  ContractFitness, FitnessRates, SelectionPolicy, SelectionAction, FitnessTracker,
} from './selection'

// ── Hook Gateway ──
export {
  createHookRegistry,
  defaultHookRegistry,
  runPrePatchHooks,
  conflictBlockHook,
  divergenceGuardHook,
  DEFAULT_HOOKS,
} from './hooks'
export type {
  HookDecision,
  PatchHookContext,
  PatchHookResult,
  PatchHook,
  HookRegistry,
} from './types'

// ── Runtime (Interpreter Bridge) ──
export { createRuntime } from './runtime'
export type { Runtime, RuntimeConfig, RuntimeTickResult } from './runtime'

// ── Resource Registry ──
export { createRegistry, createDefaultRegistry, SEED_RESOURCES } from './resource-registry'
export type { Resource, ResourceRegistry, ResourceType, ResourceTier, ResourceLevel, ResourceStatus } from './resource-registry'
