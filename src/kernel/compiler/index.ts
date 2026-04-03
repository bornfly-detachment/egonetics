/**
 * PRVSE Compiler — Public API
 *
 * Full pipeline: Scanner → Binder → Checker → Emitter
 *
 * Usage:
 *   const result = compile({ content: '用户登录失败超过5次就锁定', source: ... })
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
  PSource,
  PExternalSource,
  PInternalSource,
  PPhysicalType,
  PSemanticType,
  PCertainty,
  PCompleteness,
  PTruth,
  PDestination,

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

  // V — Value
  ValueGate,
  VMetric,
  V1Metric,
  V2Metric,
  V3Metric,
  V1MetricType,
  V2MetricType,
  V3MetricType,
  PhiFactor,
  VSource,
  VDestination,
  GateResult,

  // S — State
  StateInstruction,
  SSource,
  SNodeTier,
  SStateMachine,
  SEffect,

  // E — Evolution
  EvolutionEvent,
  InfoLevel,
  CommLevel,
  ResourceTier,
  PermissionTier,
  MutationType,

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
