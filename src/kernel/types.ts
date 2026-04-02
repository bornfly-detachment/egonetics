/**
 * PRVSE Kernel — Formal Type Definitions
 *
 * Every type here is a computational primitive, not a UI concept.
 * Zero dependencies. Pure data structures.
 *
 * Ontology:
 *   P (Pattern)   — atomic structural unit, immutable per version
 *   V (Value)     — computable scalar with declared merge algebra
 *   R (Relation)  — runtime interaction contract between nodes
 *   S (State)     — computational closure over P + V + R at a point in time
 *   E (Evolution) — control system over the S-graph (tick orchestrator)
 */

// ── Identifiers ────────────────────────────────────────────────

/** Opaque branded ID types for type safety */
export type NodeId = string & { readonly __brand: 'NodeId' }
export type ContractId = string & { readonly __brand: 'ContractId' }
export type VersionId = string & { readonly __brand: 'VersionId' }
export type PortId = string & { readonly __brand: 'PortId' }

export function nodeId(s: string): NodeId { return s as NodeId }
export function contractId(s: string): ContractId { return s as ContractId }
export function versionId(s: string): VersionId { return s as VersionId }
export function portId(s: string): PortId { return s as PortId }

// ── Frozen Values ──────────────────────────────────────────────

/**
 * Frozen<T> — deeply immutable value.
 * At runtime this is just T, but the type signals "do not mutate".
 * All values inside a Snapshot and inside State are Frozen.
 */
export type Frozen<T = unknown> = Readonly<T>

// ── P (Pattern) ────────────────────────────────────────────────

/** Atomic structural unit. Immutable once created; new version = new P. */
export interface Pattern {
  readonly id: NodeId
  readonly version: VersionId
  readonly name: string
  readonly schema: Frozen<Record<string, SchemaField>>
}

export interface SchemaField {
  readonly type: 'string' | 'number' | 'boolean' | 'set' | 'map'
  readonly mergeStrategy: MergeStrategyName
  readonly defaultValue?: Frozen
}

// ── V (Value) ──────────────────────────────────────────────────

/**
 * Computable scalar bound to a Pattern field.
 * Each V declares its merge algebra via `mergeStrategy`.
 */
export interface Value {
  readonly nodeId: NodeId
  readonly field: string
  readonly value: Frozen
  readonly mergeStrategy: MergeStrategyName
}

/** Named merge strategies — each must satisfy associativity + idempotency */
export type MergeStrategyName =
  | 'numeric.sum'
  | 'numeric.max'
  | 'numeric.min'
  | 'set.union'
  | 'set.intersection'
  | 'priority.highest'
  | 'replace'  // last-write-wins fallback

// ── R (Relation) — Runtime Interaction Contract ────────────────

/**
 * R is NOT a line drawn between nodes.
 * R is a contract: "when condition holds, emit patches."
 *
 * Three sub-systems:
 *   R-1 Structural  — containment, static hierarchy
 *   R-2 Dynamic     — forces, continuous adjustment
 *   R-3 Semantic    — dependency, causality, typed discrete
 */
export type RelationType = 'structural' | 'dynamic' | 'semantic'

export interface Contract {
  readonly id: ContractId
  readonly type: RelationType
  readonly priority: number  // higher = evaluated first, used as tiebreaker
  readonly participants: readonly NodeId[]  // nodes involved

  /**
   * Pure function: (self state view, frozen snapshot) → should this contract fire?
   * MUST be side-effect free. Only reads from StateView and Snapshot.
   */
  readonly condition: ContractCondition

  /**
   * Pure function: when condition is true, produce patches.
   * MUST be side-effect free. Output is delta, not mutation.
   */
  readonly emit: ContractEmitter
}

export type ContractCondition = (state: StateView, env: Snapshot) => boolean
export type ContractEmitter = (state: StateView, env: Snapshot) => readonly Patch[]

// ── Patch ──────────────────────────────────────────────────────

/**
 * Delta operation on State. Never a direct mutation.
 * Patches form a semilattice under merge.
 */
export type Patch =
  | PatchSet
  | PatchDelete
  | PatchMerge

export interface PatchSet {
  readonly op: 'set'
  readonly target: NodeId
  readonly path: readonly string[]
  readonly value: Frozen
  readonly priority: number
}

export interface PatchDelete {
  readonly op: 'delete'
  readonly target: NodeId
  readonly path: readonly string[]
  readonly priority: number
}

export interface PatchMerge {
  readonly op: 'merge'
  readonly target: NodeId
  readonly path: readonly string[]
  readonly strategy: MergeStrategyName
  readonly value: Frozen
  readonly priority: number
}

/**
 * When two patches conflict and merge algebra cannot resolve,
 * produce a Conflict that escalates to E-layer.
 */
export interface Conflict {
  readonly type: 'conflict'
  readonly patches: readonly Patch[]
  readonly reason: string
}

// ── Snapshot (Frozen External Input) ───────────────────────────

/**
 * Immutable snapshot of all external inputs at tick start.
 * Created during Phase 0 (FREEZE), read-only during Phase 1 (EVAL).
 */
export interface Snapshot {
  readonly tick: number
  readonly timestamp: number
  readonly ports: Frozen<ReadonlyMap<PortId, Frozen>>
}

// ── S (State) — Computational Closure ──────────────────────────

/**
 * State of a single node: its pattern version + current field values.
 * S = closure over P + V + R at a point in time.
 */
export interface NodeState {
  readonly nodeId: NodeId
  readonly patternVersion: VersionId
  readonly values: Frozen<ReadonlyMap<string, Frozen>>
}

/**
 * Global state: all node states + contract registry.
 * This is the "world" that tick operates on.
 */
export interface State {
  readonly tick: number
  readonly nodes: ReadonlyMap<NodeId, NodeState>
  readonly contracts: ReadonlyMap<ContractId, Contract>
}

/**
 * Read-only projection of State, passed to contract conditions/emitters.
 * Prevents mutation — contracts can observe but never directly change state.
 */
export interface StateView {
  readonly tick: number
  getNode(id: NodeId): NodeState | undefined
  getValue(nodeId: NodeId, field: string): Frozen | undefined
  getContract(id: ContractId): Contract | undefined
  getNodesByPattern(patternId: NodeId): readonly NodeState[]
}

// ── E (Evolution) — Control System ─────────────────────────────

/**
 * Tick result: what happened during one tick cycle.
 */
export interface TickResult {
  readonly state: State
  readonly rounds: number
  readonly converged: boolean
  readonly conflicts: readonly Conflict[]
  readonly patchesApplied: number
}

/**
 * Port buffer: external inputs waiting to be frozen into next Snapshot.
 * Async writes land here; Phase 0 flushes this into an immutable Snapshot.
 */
export interface PortBuffer {
  readonly ports: Map<PortId, Frozen>
  write(port: PortId, value: Frozen): void
  freeze(tick: number): Snapshot
}

// ── Universe Spec (shared semantic root for all 3 layers) ──────

/**
 * UniverseSpec — single source of truth for what this universe allows.
 * Constitution, Kernel, and Reality Protocol all derive from this.
 * Prevents semantic divergence between layers.
 */
export interface UniverseSpec {
  /** Which merge strategies are available in this universe */
  readonly allowedStrategies: readonly MergeStrategyName[]
  /** Max contracts per node (prevents combinatorial explosion) */
  readonly maxContractsPerNode: number
  /** Whether liveness is required (at least one clock/decay contract) */
  readonly requireLiveness: boolean
  /** Max collection window for Reality Protocol (ms) */
  readonly maxCollectionWindow: number
  /** Required ports that must be present for a full snapshot */
  readonly requiredPorts: readonly PortId[]
}

// ── Constitution Layer ─────────────────────────────────────────

/**
 * Violation found during contract registration validation.
 * Constitution blocks registration if any CRITICAL violation exists.
 */
export interface Violation {
  readonly severity: 'critical' | 'warning'
  readonly rule: ConstitutionRule
  readonly message: string
  readonly contracts: readonly ContractId[]
}

export type ConstitutionRule =
  | 'exclusivity'    // same path must not have >1 set-type contract
  | 'monotonicity'   // emit must respect ⊑ partial order
  | 'scope'          // participants must share R-1 subtree
  | 'dependency'     // if A reads B's output, A.priority < B.priority (DAG)
  | 'algebra'        // contract's merge strategy must be in universe spec
  | 'liveness'       // system must have at least one clock/decay contract

export interface ConstitutionResult {
  readonly valid: boolean
  readonly violations: readonly Violation[]
}

// ── Observer Layer ─────────────────────────────────────────────

/**
 * Effect — pure description of what should happen after a tick.
 * Observer produces these; Runtime Interpreter executes them.
 *
 * INVARIANT: Effects NEVER execute in the same tick.
 * They are descriptions, not actions. The one-beat delay is structural.
 */
export type Effect =
  | RenderEffect
  | AlertEffect
  | LogEffect
  | TriggerEffect

export interface RenderEffect {
  readonly type: 'render'
  readonly nodeId: NodeId
  readonly changes: ReadonlyMap<string, { prev: Frozen; next: Frozen }>
}

export interface AlertEffect {
  readonly type: 'alert'
  readonly conflict: Conflict
}

export interface LogEffect {
  readonly type: 'log'
  readonly entry: {
    readonly tick: number
    readonly event: string
    readonly data: Frozen
  }
}

/**
 * TriggerEffect — writes a value to PortBuffer for the NEXT tick.
 * This is the self-feedback loop, but it's safe because:
 * 1. It's a description (Observer doesn't write directly)
 * 2. Runtime Interpreter writes to PortBuffer AFTER tick completes
 * 3. The value only becomes visible after next Snapshot freeze
 */
export interface TriggerEffect {
  readonly type: 'trigger'
  readonly portId: PortId
  readonly value: Frozen
}

/**
 * Observer function signature.
 * MUST be pure: (prev, next, result) → Effect[]
 * No side effects. No external reads. No internal state.
 */
export type ObserverFn = (
  prev: State,
  next: State,
  result: TickResult,
) => readonly Effect[]

// ── Reality Protocol ───────────────────────────────────────────

/**
 * Snapshot completeness — tracks whether all required ports were present.
 * Contracts can check this to degrade behavior on partial snapshots.
 */
export type SnapshotCompleteness = 'full' | 'partial'

/**
 * Extended Snapshot with completeness and causal ordering metadata.
 */
export interface RealitySnapshot extends Snapshot {
  readonly completeness: SnapshotCompleteness
  readonly missingPorts: readonly PortId[]
  /** Monotonic epoch counter — defines "what counts as now" */
  readonly epoch: number
}

/**
 * Reality event — an external input with causal metadata.
 * The Reality Protocol orders these into a consistent Snapshot.
 */
export interface RealityEvent {
  readonly portId: PortId
  readonly value: Frozen
  /** Wall-clock time of the event in the external world */
  readonly externalTimestamp: number
  /** Source identifier (which agent/sensor/human produced this) */
  readonly source: string
}

/**
 * Reality Ordering Function — NOT a scheduler, but a sort function.
 * Defines "what counts as the canonical order of reality events"
 * within an epoch's collection window.
 *
 * MUST be deterministic: same events → same order, always.
 */
export type RealityOrderingFn = (
  events: readonly RealityEvent[],
) => readonly RealityEvent[]
