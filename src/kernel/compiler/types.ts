/**
 * PRVSE Compiler — Type System
 *
 * Bridges tag-tree semantic types → kernel execution primitives.
 * Source of truth: docs/prvse-compiler-design.md + src/kernel/compiler/tag-tree.json
 *
 * Design:
 *   - PatternToken  → compiled into kernel Pattern + NodeState
 *   - RelationEdge  → compiled into kernel Contract
 *   - ValueGate     → used by checker as constraint gate
 *   - StateInstruction → compiled into kernel Patch[]
 *   - EvolutionEvent → compiled into kernel Effect
 *
 * TypeScript gradual typing: fields start as `unknown`, narrow through
 * the pipeline. Un-narrowed fields → downgrade permission, not reject.
 */

import type { NodeId } from '../types'

// ── Narrowable<T> — gradual typing primitive ──────────────────

/**
 * A value that starts unknown and narrows through the compiler pipeline.
 * `resolved: true` means the field has been classified.
 * `resolved: false` means it's still unknown → triggers permission downgrade.
 */
export type Narrowable<T> =
  | { resolved: true; value: T }
  | { resolved: false }

export function resolved<T>(value: T): Narrowable<T> {
  return { resolved: true, value }
}

export function unresolved<T>(): Narrowable<T> {
  return { resolved: false }
}

export function isResolved<T>(n: Narrowable<T>): n is { resolved: true; value: T } {
  return n.resolved
}

// ── P — Pattern Token (Lexer output) ──────────────────────────

/**
 * Pattern State (三态)
 *
 * external → candidate → internal
 *
 * External → Internal has NO shortcut. Even internally generated
 * hypotheses must pass through practice verification.
 */
export type PState = 'external' | 'candidate' | 'internal'

/**
 * Internal origin types — 天然合法 (100% legitimate)
 * Traceable, explainable, analyzable, reproducible.
 * Communication has direction (A→B / broadcast).
 */
export type PInternalOriginType =
  | 'user_input'       // human subject operation
  | 'model_call'       // internal AI reasoning/generation
  | 'module_output'    // component output / execution result
  | 'system_event'     // state change / scheduler trigger
  | 'process_memory'   // chronicle / life memory

/**
 * External origin types — 需控制论过滤改造
 * Classified by trust basis / verifiability.
 */
export type PExternalOriginType =
  | 'computable'   // code repos, databases, API returns — high certainty, complete chain
  | 'verifiable'   // papers, experiments, authoritative docs — verifiable, needs judgment
  | 'narrative'    // social media, personal expression, AI-generated — subjective
  | 'sensor'       // sensors, monitoring, auto-collection — physical world signals

/**
 * POrigin — chain provenance.
 * "从哪来" is a chain structure, not a single label.
 * Must trace to origin point.
 */
export type POrigin =
  | { domain: 'internal'; type: PInternalOriginType }
  | { domain: 'external'; type: PExternalOriginType }

/**
 * Physical type — 9 carrier forms (L0 basic classification)
 * Pure rule-based, no semantic understanding needed.
 */
export type PPhysicalType =
  | 'text'        // natural language
  | 'number'      // numeric / measurement
  | 'code'        // program / script / configuration
  | 'structured'  // JSON / table / database record
  | 'image'       // image
  | 'audio'       // audio
  | 'video'       // video
  | 'stream'      // real-time event stream / sensor stream
  | 'mixed'       // code+comments / image+text / multimodal

/**
 * Pattern Level — three-level form (三级形态)
 *
 * Information quantity and value increase with level —
 * not about content volume, but scope of impact.
 *
 * Level ≠ Power: L1 can self-promote to L2 candidate.
 * 谁最强谁最好就是谁 — capability determines authority.
 */
export type PLevel =
  | 'L0_atom'      // minimal complete information unit
  | 'L1_molecule'  // P+R+V combined structure
  | 'L2_gene'      // abstraction of L1 practice

/**
 * Communication direction
 *
 * Higher level ≠ greater power ≠ controls lower level.
 */
export type PCommunication =
  | 'bottom_up'   // L1 emergence → L2 candidate (needs rule verification + human confirmation)
  | 'top_down'    // high-level abstraction guides practice
  | 'lateral'     // same-level (determined by R + constitutional rules, A→B / broadcast)

/**
 * PatternToken — the output of the Lexer (scanner).
 *
 * origin + state are required (must know provenance and current state).
 * physical, level, communication use Narrowable — start unknown, narrow through pipeline.
 */
export interface PatternToken {
  readonly id: string
  readonly timestamp: number
  readonly rawContent: string

  // Required — must be declared at entry
  readonly origin: POrigin
  readonly state: PState

  // Narrowable — start unknown, narrow through pipeline
  readonly physical: Narrowable<PPhysicalType>
  readonly level: Narrowable<PLevel>
  readonly communication: Narrowable<PCommunication>
}

/** How narrowed is this token? Determines permission level. */
export type NarrowingLevel = 'full' | 'partial' | 'minimal'

export function getNarrowingLevel(token: PatternToken): NarrowingLevel {
  const fields = [token.physical, token.level, token.communication]
  const resolvedCount = fields.filter(isResolved).length
  if (resolvedCount === fields.length) return 'full'
  if (resolvedCount >= 1) return 'partial'
  return 'minimal'
}

// ── R — Relation Edge (Parser output) ─────────────────────────

/**
 * Relation Info Level — constitutional definition of R.
 *
 * CORE PRINCIPLE: Levels are engineering state snapshots, NOT permanent labels.
 * The same phenomenon can transition between levels as engineering matures.
 *   - Face recognition: L1 (2010) → L0 (2024, 99.XX% accuracy)
 *   - Quantum computing: L1 (today) → L0 (after engineering breakthrough)
 *   - Dialectical problems: L2 → L1 (when validated through practice)
 *
 * Boundary criterion: practical engineering certainty at current state.
 *
 * L0_logic: Practically deterministic at engineering scale.
 *   - Math, classical physics, boolean logic (1+1=2, F=ma at macro scale)
 *   - Conditions determined → result unique (in classical physics regime)
 *   - Engineering certainty ≥ 99% → qualifies as L0
 *   - NOTE: Quantum measurement is L1 (ontologically probabilistic),
 *     but Schrödinger's equation itself is L0 (deterministic evolution).
 *     At human practice scale, quantum effects are negligible.
 *   - If ANY cognitive ambiguity or interpretation exists → belongs to L1
 *
 * L1_conditional: Theoretically computable but practically uncertain.
 *   - Conditions too complex to enumerate (chaos, multi-factor causality)
 *   - Causality = conditions + time; A→B appears causal but B depends on C,D...
 *   - Chaos systems: L0 rules at bottom, but sensitivity to initial conditions
 *     makes computation degrade to L1 (matches "cannot exhaustively compute")
 *   - Requires human/AI to distinguish, experiment to validate
 *   - Can transition to L0 when engineering achieves high certainty
 *
 * L2_existential: Requires subjectivity algorithm (e.g. life's three laws).
 *   - Subjectivity, cognition, meaning, narrative
 *   - Dialectics: oppose/unify — A and ¬A can coexist (forbidden in L0 logic)
 *   - Subject's practice in spacetime needs narrative for value and legitimacy
 *   - Can transition to L1 when validated through practice
 *
 * Level transitions are monitored by E (Evolution):
 *   E watches confidence metrics on L1 nodes → triggers L1→L0 upgrade at threshold
 *   E validates L2 predictions through practice → triggers L2→L1 transition
 *
 * Maps 1:1 to PLevel (P's L0/L1/L2) and PermissionTier hierarchy.
 */
export type RInfoLevel = 'L0_logic' | 'L1_conditional' | 'L2_existential'

export type RDirection = 'none' | 'one_way' | 'bidirectional'
export type RCertainty = 'deterministic' | 'probabilistic' | 'fuzzy'
export type RTemporal = 'simultaneous' | 'sequential' | 'cyclic'

/** L0 — pure logic (computable without human/AI) */
export type RLogic = 'deductive' | 'inductive' | 'analogical'

/** L1 — conditional/temporal (needs human/AI for complex enumeration) */
export type RCausal = 'direct' | 'indirect' | 'counterfactual'
export type RProcess = 'conditional_transform' | 'quantitative_accumulation' | 'qualitative_emergence'

/** L2 — existential (requires narrative, subjectivity, dialectics) */
export type RDialectic = 'oppose' | 'transform' | 'unify'

export type RStrength = 'positive' | 'negative'

/** Propagation direction — how changes travel along this edge */
export type RPropagation = 'forward' | 'backward' | 'bidirectional'

/** Edge type — maps to kernel Contract types */
export type REdgeType =
  | 'contains'
  | 'constraint'
  | 'mutual_constraint'
  | 'signal'
  | 'derives'
  | 'directed'

/** What this relation does in the system */
export type RDestination =
  | 'R_D1_drive_reasoning'
  | 'R_D2_support_value_calc'
  | 'R_D3_record_evolution'
  | 'R_D4_execute_constraint'
  | 'R_D5_activate_related'

export interface RelationEdge {
  readonly id: string
  readonly sourceNode: NodeId
  readonly targetNode: NodeId

  // Relation level — constitutional classification
  readonly infoLevel: RInfoLevel

  // Physical attributes
  readonly direction: RDirection
  readonly certainty: RCertainty
  readonly temporal: RTemporal

  // Semantic nature — which level's operators are used
  // L0: logic is set
  // L1: causal and/or process is set
  // L2: dialectic is set
  readonly logic?: RLogic
  readonly causal?: RCausal
  readonly process?: RProcess
  readonly dialectic?: RDialectic
  readonly strength: RStrength

  // Compiler-required
  readonly edgeType: REdgeType
  readonly propagation: RPropagation
  readonly priority: number
  readonly destination: RDestination
}

// ── V — Value Gate (Semantic Analysis) ────────────────────────

export type VSource = 'computer_system' | 'ai_model' | 'human_narrative' | 'external_narrative'
export type VTemporal = 'static' | 'dynamic'
export type VScope = 'local' | 'global'
export type VCertainty = 'deterministic' | 'uncertain'
export type VControl = 'controllable' | 'uncontrollable'
export type VBaseline = 'maintain' | 'challenge'

export type VDestination =
  | 'V_D1_align_human_preference'
  | 'V_D2_task_completion'
  | 'V_D3_system_evolution'

/** V1 — objective metrics (deterministic) */
export type V1MetricType = 'counter' | 'timer' | 'token_consumption' | 'probability' | 'binary'

export interface V1Metric {
  readonly dimension: 'v1'
  readonly metricType: V1MetricType
  readonly currentValue: number
  readonly threshold: number
}

/** V2 — external probability metrics */
export type V2MetricType =
  | 'confidence'
  | 'relevance_prob'
  | 'causal_prob'
  | 'prediction_prob'
  | 'narrative_legitimacy'
  | 'narrative_completeness'
  | 'narrative_logic'

export interface V2Metric {
  readonly dimension: 'v2'
  readonly metricType: V2MetricType
  readonly currentValue: number  // [0, 1]
  readonly threshold: number     // [0, 1]
}

/** V3 — internal/constitutional evaluation */
export type V3MetricType =
  | 'constitutional_rule'
  | 'value_alignment'
  | 'cognitive_eval'
  | 'narrative_consistency'
  | 'prediction_prob_internal'

export interface V3Metric {
  readonly dimension: 'v3'
  readonly metricType: V3MetricType
  readonly currentValue: number  // [0, 1]
  readonly threshold: number     // [0, 1]
  readonly ruleId?: string       // for constitutional_rule: which rule
}

export type VMetric = V1Metric | V2Metric | V3Metric

/** Phi factor — independent, composed at runtime */
export interface PhiFactor {
  readonly id: 'phi_causal' | 'phi_temporal' | 'phi_contradiction' | 'phi_dependency'
  readonly rEdgeTypes: readonly REdgeType[]
  readonly computedValue: number  // [0, 1]
}

/** Value Gate — the core constraint mechanism */
export interface ValueGate {
  readonly id: string
  readonly source: VSource
  readonly temporal: VTemporal
  readonly scope: VScope
  readonly destination: VDestination

  readonly metrics: readonly VMetric[]
  readonly phi?: readonly PhiFactor[]

  /** What happens when gate fails */
  readonly onFail: 'reject' | 'escalate' | 'downgrade'
}

/** Check if a value gate passes */
export function checkGate(gate: ValueGate): GateResult {
  const failures: VMetric[] = []

  for (const metric of gate.metrics) {
    if (metric.currentValue < metric.threshold) {
      failures.push(metric)
    }
  }

  if (failures.length === 0) {
    return { passed: true, gate }
  }

  return {
    passed: false,
    gate,
    failures,
    action: gate.onFail,
  }
}

export type GateResult =
  | { passed: true; gate: ValueGate }
  | { passed: false; gate: ValueGate; failures: readonly VMetric[]; action: 'reject' | 'escalate' | 'downgrade' }

// ── S — State Instruction (Codegen output) ────────────────────

export type SSource =
  | 'S1_task_driven'
  | 'S2_survival_driven'
  | 'S3_evolution_driven'
  | 'S4_exploration_driven'

export type SNodeTier = 'execution' | 'research' | 'update'

export type SStateMachine =
  | 'building'
  | 'trial'
  | 'stable'
  | 'bug_suspended'
  | 'waiting'
  | 'positive_loop'
  | 'negative_loop'
  | 'archived'

export type SEffect =
  | 'trigger_perception'
  | 'trigger_execution'
  | 'trigger_evolution'
  | 'trigger_communication'

export interface StateInstruction {
  readonly source: SSource
  readonly nodeTier: SNodeTier
  readonly currentState: SStateMachine
  readonly targetState: SStateMachine
  readonly guards: readonly ValueGate[]  // all must pass
  readonly effects: readonly SEffect[]   // triggered on success
}

// ── E — Evolution Event (Runtime output) ──────────────────────

/** Information credibility level */
export type InfoLevel = 'L0_signal' | 'L1_objective_law' | 'L2_subjective'

/** Communication level */
export type CommLevel = 'L0_descriptive' | 'L1_request' | 'L2_control'

/** Resource tier — who executes */
export type ResourceTier = 'T0' | 'T1' | 'T2'

/**
 * Permission Tier — abstract capability levels, NOT bound to specific models.
 * External display is always 3-tier (T0/T1/T2). T3 is internal only.
 * Which agent fills each tier is a runtime binding, not a compiler concern.
 *
 * T0 — Execution/Practice (对外第一级)
 *   All execution nodes. Perception + task execution merged.
 *   Can read/write L0 data, execute verified instructions.
 *   Every bottom-layer agent is T0.
 *
 * T1 — Reasoning/Control (对外第二级)
 *   AI-level processing. Handles L1/L2 information.
 *   PRVSE middle-layer engine: compiler, physics engine, state machine.
 *   Can create nodes, evaluate conditions, run complex inference.
 *
 * T2 — Evolution Authority (对外第三级, prvse-world 顶层)
 *   Human-machine co-evolution. The E (Evolution) node's authority.
 *   Establishes goals, constitution, resources.
 *   Can modify system structure, trigger level transitions.
 *   This is the top-level permission in prvse-world.
 *
 * T3 — 生变论 (内部隐藏层, bornfly 独有)
 *   Creator authority for the self-cybernetics system.
 *   The supreme permission of all Egonetics machines.
 *   Future: cryptographic identity + subjectivity practice legitimacy.
 *   Internal narrative only — not exposed in external 3-tier display.
 */
export type PermissionTier = 'T0' | 'T1' | 'T2' | 'T3'

export type MutationType = 'create' | 'update' | 'delete' | 'transition'

/**
 * Level Transition — E (Evolution) monitors confidence and triggers upgrades.
 *
 * Levels are engineering state snapshots. As engineering matures:
 *   L2 → L1: validated through practice (e.g., dialectical prediction confirmed)
 *   L1 → L0: engineering certainty reaches threshold (e.g., 99.XX% accuracy)
 *
 * E watches confidence metrics on nodes and triggers transitions.
 */
export type LevelTransitionDirection = 'upgrade' | 'downgrade'

export interface LevelTransition {
  readonly nodeId: NodeId
  readonly fromLevel: InfoLevel
  readonly toLevel: InfoLevel
  readonly direction: LevelTransitionDirection
  readonly confidence: number        // [0, 1] — the metric that triggered transition
  readonly threshold: number         // the threshold that was crossed
  readonly evidence: string          // what validated this transition
  readonly timestamp: number
}

export interface EvolutionEvent {
  readonly id: string
  readonly timestamp: number

  // What triggered this
  readonly trigger: StateInstruction
  readonly infoLevel: InfoLevel
  readonly commLevel: CommLevel

  // What changed
  readonly mutationType: MutationType
  readonly affectedNodes: readonly NodeId[]

  // Authorization
  readonly actor: PermissionTier
  readonly executor: ResourceTier

  // Diff
  readonly diff: {
    readonly before: unknown
    readonly after: unknown
  }

  // Level transition (if this evolution triggers a level change)
  readonly levelTransition?: LevelTransition
}

// ── Constitution Violation (checked exception) ────────────────

export type ViolationSeverity = 'block' | 'downgrade' | 'warn'

export interface ConstitutionViolation {
  readonly ruleId: string
  readonly message: string
  readonly severity: ViolationSeverity
  readonly node?: NodeId
  readonly handler: 'reject' | 'escalate_to_human' | 'downgrade_permission'
}

// ── Compiler Pipeline Types ───────────────────────────────────

/** High-IR: scanner output — PatternToken with unknown fields */
export type HighIR = PatternToken

/** Mid-IR: binder output — fully typed PRVSE graph fragment */
export interface MidIR {
  readonly tokens: readonly PatternToken[]
  readonly edges: readonly RelationEdge[]
  readonly gates: readonly ValueGate[]
  readonly constitutionBindings: readonly ConstitutionBinding[]
}

/** A binding from a node to a constitutional rule */
export interface ConstitutionBinding {
  readonly nodeId: string
  readonly ruleId: string
  readonly ruleText: string
  readonly permissionRequired: PermissionTier
}

/** Low-IR: checker output — executable instructions */
export interface LowIR {
  readonly instructions: readonly StateInstruction[]
  readonly violations: readonly ConstitutionViolation[]
  readonly permissionLevel: PermissionTier
}

/** Full compilation result */
export interface CompileResult {
  readonly success: boolean
  readonly highIR: HighIR
  readonly midIR: MidIR | null
  readonly lowIR: LowIR | null
  readonly events: readonly EvolutionEvent[]
  readonly violations: readonly ConstitutionViolation[]
}
