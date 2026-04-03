/**
 * PRVSE Compiler — Public API
 *
 * Full pipeline: Scanner → Binder → Checker → Emitter
 *
 * Usage:
 *   const result = compile({ content: '用户登录失败超过5次就锁定', origin: ... })
 *   if (!result.success) { handle violations }
 *   else { feed result.patches to kernel tick }
 */

// ── Types ──
export type {
  // Narrowable
  Narrowable,
  NarrowingLevel,

  // P — Pattern
  PatternToken,
  POrigin,
  PInternalOriginType,
  PExternalOriginType,
  PPhysicalType,
  PState,
  PLevel,
  PCommunication,

  // R — Relation
  RelationEdge,
  RDirection,
  RCertainty,
  RTemporal,
  RLogic,
  RCausal,
  RProcess,
  RDialectic,
  RStrength,
  RPropagation,
  RInfoLevel,
  REdgeType,
  RDestination,

  // V — Value (校验清单驱动)
  VChecklistItem,
  VChecklist,
  VL0MetricType,
  VL0Metric,
  VL0RuleCheckType,
  VL0RuleCheck,
  VL0Assessment,
  VL1BudgetType,
  VL1ResourceBudget,
  VL1Perceiver,
  VL1Evaluator,
  VL1FeedbackDirection,
  VL1StateEvaluator,
  VL1RewardType,
  VL1RewardFunction,
  VL1Assessment,
  VL2PracticeType,
  VL2PracticeVerification,
  VL2ConstitutionalCompliance,
  VL2IdentityVerification,
  VL2HumanCommandValidation,
  VL2Assessment,
  VIndependence,
  ValueGate,
  GateResult,
  GateFailure,

  // S — State (PRV完备组织的运行时状态)
  SDrivingForce,
  SL0RuntimeState,
  SL1TaskState,
  SL1FeedbackRecord,
  SL1FeedbackLoop,
  SL2StrategicState,
  SL2Learner,
  SL2LearnerSignal,
  SL2GoalLevel,
  SL2GoalDecomposition,
  SEffect,
  SLevel,
  SCurrentState,
  StateInstruction,

  // E — Evolution
  EvolutionEvent,
  InfoLevel,
  CommLevel,
  ResourceTier,
  PermissionTier,
  MutationType,
  LevelTransitionDirection,
  LevelTransition,

  // Constitution
  ConstitutionViolation,
  ViolationSeverity,
  ConstitutionBinding,

  // IR layers
  HighIR,
  MidIR,
  LowIR,
  CompileResult,
} from './types'

export {
  resolved,
  unresolved,
  isResolved,
  getNarrowingLevel,
  isChecklistPassed,
  checkGate,
} from './types'

// ── Scanner ──
export { scan, scanBatch, resetTokenCounter } from './scanner'
export type { ScannerInput } from './scanner'

// ── Binder ──
export { bind, narrowToken, inferEdgeProperties } from './binder'
export type { BinderInput } from './binder'

// ── Checker ──
export { isConstitutionSatisfiedBy, quickCheck } from './checker'
export type { CheckerContext } from './checker'

// ── Emitter ──
export { emit } from './emitter'
export type { EmitterInput, EmitterOutput } from './emitter'

// ── Full Pipeline ─────────────────────────────────────────────

import type { ScannerInput } from './scanner'
import type { CheckerContext } from './checker'
import type { RelationEdge, ValueGate, CompileResult, InfoLevel, PermissionTier } from './types'
import { scan } from './scanner'
import { bind } from './binder'
import { isConstitutionSatisfiedBy } from './checker'
import { emit } from './emitter'

export interface CompileInput {
  /** Raw inputs to compile */
  readonly inputs: readonly ScannerInput[]
  /** Manually declared edges (optional) */
  readonly edges?: readonly RelationEdge[]
  /** Value gates to check (optional) */
  readonly gates?: readonly ValueGate[]
  /** Who is performing this operation */
  readonly actor: PermissionTier
  /** Information credibility level */
  readonly infoLevel: InfoLevel
}

/**
 * compile() — full pipeline in one call.
 *
 * Scanner → Binder → Checker → Emitter
 *
 * Returns CompileResult with all IR layers + violations + kernel output.
 */
export function compile(input: CompileInput): CompileResult {
  const { inputs, edges = [], gates = [], actor, infoLevel } = input

  // 1. Scanner: raw input → PatternTokens (High-IR)
  const tokens = inputs.map(scan)
  const highIR = tokens[0] // primary token (first input)

  // 2. Binder: narrow tokens + bind constitutional rules → Mid-IR
  const midIR = bind({ tokens, edges, gates })

  // 3. Checker: validate against constitution → Low-IR
  const ctx: CheckerContext = { actor, infoLevel }
  const lowIR = isConstitutionSatisfiedBy(midIR, ctx)

  // 4. Emitter: produce kernel patches + effects
  const emitted = emit({ lowIR, midIR, infoLevel })

  const allViolations = lowIR.violations

  return {
    success: !allViolations.some(v => v.severity === 'block'),
    highIR,
    midIR,
    lowIR,
    events: emitted.events,
    violations: allViolations,
  }
}
