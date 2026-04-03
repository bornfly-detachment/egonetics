/**
 * PRVSE Compiler — Constitution Checker
 *
 * Equivalent to TypeScript's checker.ts — the heaviest stage.
 * Validates operations against:
 *   1. Permission rules (who can modify what)
 *   2. Value gates (V metrics must pass thresholds)
 *   3. Edge legality (which connections are allowed)
 *   4. Info level policy (L0/L1/L2 trust boundaries)
 *   5. Narrowing completeness (unknown fields → downgrade)
 *
 * Core function: isConstitutionSatisfiedBy()
 *
 * Design principle: block → downgrade → warn, never silently pass.
 * Constitutional violations are checked exceptions — must be handled.
 */

import type {
  PatternToken,
  RelationEdge,
  ValueGate,
  ConstitutionViolation,
  ConstitutionBinding,
  MidIR,
  LowIR,
  StateInstruction,
  PermissionTier,
  InfoLevel,
  REdgeType,
  RInfoLevel,
  NarrowingLevel,
  GateResult,
  ViolationSeverity,
} from './types'

import {
  getNarrowingLevel,
  isResolved,
  checkGate,
} from './types'

// ── Permission Matrix ─────────────────────────────────────────

/**
 * Permission hierarchy: T3 > T2 > T1 > T0
 *
 * External 3-tier: T0 (execution) < T1 (reasoning) < T2 (evolution)
 * Internal hidden: T3 (生变论, bornfly creator authority)
 *
 * Lower cannot modify higher.
 */
const PERMISSION_RANK: Record<PermissionTier, number> = {
  T0: 0,
  T1: 1,
  T2: 2,
  T3: 3,
}

function hasPermission(actor: PermissionTier, required: PermissionTier): boolean {
  return PERMISSION_RANK[actor] >= PERMISSION_RANK[required]
}

/** Map narrowing level to maximum allowed permission */
function narrowingToPermission(level: NarrowingLevel): PermissionTier {
  switch (level) {
    case 'full': return 'T2'    // fully typed → evolution authority (can modify system)
    case 'partial': return 'T1' // partially typed → reasoning/control only
    case 'minimal': return 'T0' // mostly unknown → execution/practice only
  }
}

// ── Edge Legality Matrix ──────────────────────────────────────

/**
 * Which PRVSE node types can connect via which edge types.
 * Key: `${sourceType}->${targetType}`, Value: allowed edge types.
 *
 * The canonical PRVSE cycle: P → R → V → S → E → P
 * Plus structural edges (contains, derives).
 */
type NodeType = 'P' | 'R' | 'V' | 'S' | 'E'

const EDGE_RULES: Record<string, readonly REdgeType[]> = {
  // Forward cycle
  'P->R': ['directed', 'signal', 'derives'],
  'R->V': ['constraint', 'directed'],
  'V->S': ['directed', 'constraint'],
  'S->E': ['directed', 'signal'],
  'E->P': ['directed', 'derives'],

  // Structural / containment (hierarchical)
  'P->P': ['contains'],         // P can contain sub-patterns
  'S->S': ['contains'],         // S can contain sub-states
  'E->E': ['contains'],         // E can contain sub-evolutions

  // Cross-layer constraints
  'V->V': ['mutual_constraint'], // V values can constrain each other
  'R->R': ['mutual_constraint', 'derives'], // R can derive from R
  'V->P': [],                    // V cannot directly modify P (one-way gate)
  'S->P': [],                    // S cannot reach back to P directly
  'P->S': [],                    // P must go through R→V→S

  // Feedback (explicitly allowed, through E)
  'S->R': ['signal'],            // S can signal R for feedback loops
  'E->V': ['directed'],          // E can update V metrics
  'E->S': ['directed'],          // E can trigger state transitions
}

function isEdgeLegal(
  sourceType: NodeType,
  targetType: NodeType,
  edgeType: REdgeType,
): boolean {
  const key = `${sourceType}->${targetType}`
  const allowed = EDGE_RULES[key]
  if (!allowed) return false
  return allowed.includes(edgeType)
}

// ── Info Level Policy ─────────────────────────────────────────

/**
 * What can each info level do?
 * L0: direct route, no thinking needed
 * L1: model and compute, verified boundary
 * L2: verify before use, skeptical
 */
interface InfoLevelPolicy {
  readonly canModifyConstitution: boolean
  readonly canCreateNodes: boolean
  readonly canDeleteNodes: boolean
  readonly maxPermission: PermissionTier
  readonly requiresVerification: boolean
}

const INFO_LEVEL_POLICIES: Record<InfoLevel, InfoLevelPolicy> = {
  L0_signal: {
    canModifyConstitution: false,
    canCreateNodes: false,
    canDeleteNodes: false,
    maxPermission: 'T0',
    requiresVerification: false,  // L0 = objective, no verification needed
  },
  L1_objective_law: {
    canModifyConstitution: false,
    canCreateNodes: true,
    canDeleteNodes: false,
    maxPermission: 'T1',
    requiresVerification: false,  // L1 = verified by science
  },
  L2_subjective: {
    canModifyConstitution: false,
    canCreateNodes: true,
    canDeleteNodes: true,
    maxPermission: 'T2',
    requiresVerification: true,   // L2 = must verify, AI hallucination source
  },
}

// ── Core Checker ──────────────────────────────────────────────

export interface CheckerContext {
  readonly actor: PermissionTier
  readonly infoLevel: InfoLevel
}

/**
 * isConstitutionSatisfiedBy — the core checker function.
 *
 * Takes MidIR (bound PRVSE graph fragment) and validates everything.
 * Returns LowIR (executable instructions) or violations.
 */
export function isConstitutionSatisfiedBy(
  midIR: MidIR,
  ctx: CheckerContext,
): LowIR {
  const violations: ConstitutionViolation[] = []
  const instructions: StateInstruction[] = []

  // 1. Check permission bindings
  violations.push(...checkPermissions(midIR.constitutionBindings, ctx))

  // 2. Check narrowing completeness of all tokens
  const { tokenViolations, effectivePermission } = checkNarrowing(midIR.tokens, ctx)
  violations.push(...tokenViolations)

  // 3. Check info level policy
  violations.push(...checkInfoLevel(midIR, ctx))

  // 4. Check edge legality + relation level coherence
  violations.push(...checkEdges(midIR.edges, ctx))

  // 5. Check value gates
  const { gateViolations, gateInstructions } = checkValueGates(midIR.gates)
  violations.push(...gateViolations)
  instructions.push(...gateInstructions)

  // Determine final permission level (downgrade if needed)
  const hasBlocks = violations.some(v => v.severity === 'block')
  const hasDowngrades = violations.some(v => v.severity === 'downgrade')

  let permissionLevel = effectivePermission
  if (hasDowngrades) {
    // Downgrade one tier
    const rank = PERMISSION_RANK[permissionLevel]
    const downgraded = Object.entries(PERMISSION_RANK)
      .find(([_, r]) => r === Math.max(0, rank - 1))
    if (downgraded) {
      permissionLevel = downgraded[0] as PermissionTier
    }
  }

  return {
    instructions: hasBlocks ? [] : instructions,  // block = no instructions emitted
    violations,
    permissionLevel,
  }
}

// ── Sub-checks ────────────────────────────────────────────────

function checkPermissions(
  bindings: readonly ConstitutionBinding[],
  ctx: CheckerContext,
): ConstitutionViolation[] {
  const violations: ConstitutionViolation[] = []

  for (const binding of bindings) {
    if (!hasPermission(ctx.actor, binding.permissionRequired)) {
      violations.push({
        ruleId: binding.ruleId,
        message: `Permission denied: ${ctx.actor} cannot satisfy rule "${binding.ruleText}" (requires ${binding.permissionRequired})`,
        severity: 'block',
        handler: 'reject',
      })
    }
  }

  return violations
}

function checkNarrowing(
  tokens: readonly PatternToken[],
  ctx: CheckerContext,
): { tokenViolations: ConstitutionViolation[]; effectivePermission: PermissionTier } {
  const violations: ConstitutionViolation[] = []
  let lowestNarrowing: NarrowingLevel = 'full'

  for (const token of tokens) {
    const level = getNarrowingLevel(token)

    if (level === 'minimal') lowestNarrowing = 'minimal'
    else if (level === 'partial' && lowestNarrowing === 'full') lowestNarrowing = 'partial'

    // Report un-narrowed fields
    const unresolvedFields: string[] = []
    if (!isResolved(token.destination)) unresolvedFields.push('destination')
    if (!isResolved(token.physical)) unresolvedFields.push('physical')
    if (!isResolved(token.semantic)) unresolvedFields.push('semantic')
    if (!isResolved(token.certainty)) unresolvedFields.push('certainty')
    if (!isResolved(token.completeness)) unresolvedFields.push('completeness')
    if (!isResolved(token.truth)) unresolvedFields.push('truth')

    if (unresolvedFields.length > 0) {
      const severity: ViolationSeverity = level === 'minimal' ? 'downgrade' : 'warn'
      violations.push({
        ruleId: 'narrowing',
        message: `Token ${token.id} has unresolved fields: [${unresolvedFields.join(', ')}] → narrowing level: ${level}`,
        severity,
        handler: severity === 'downgrade' ? 'downgrade_permission' : 'escalate_to_human',
      })
    }
  }

  const maxFromNarrowing = narrowingToPermission(lowestNarrowing)
  const actorRank = PERMISSION_RANK[ctx.actor]
  const narrowingRank = PERMISSION_RANK[maxFromNarrowing]
  const effectiveRank = Math.min(actorRank, narrowingRank)

  const effectivePermission = Object.entries(PERMISSION_RANK)
    .find(([_, r]) => r === effectiveRank)?.[0] as PermissionTier ?? 'T0'

  return { tokenViolations: violations, effectivePermission }
}

function checkInfoLevel(
  midIR: MidIR,
  ctx: CheckerContext,
): ConstitutionViolation[] {
  const violations: ConstitutionViolation[] = []
  const policy = INFO_LEVEL_POLICIES[ctx.infoLevel]

  // Check actor doesn't exceed info level's max permission
  if (PERMISSION_RANK[ctx.actor] > PERMISSION_RANK[policy.maxPermission]) {
    violations.push({
      ruleId: 'info_level_permission',
      message: `Info level ${ctx.infoLevel} caps permission at ${policy.maxPermission}, but actor is ${ctx.actor}`,
      severity: 'warn',
      handler: 'downgrade_permission',
    })
  }

  // Check constitutional modifications
  const hasConstitutionalBindings = midIR.constitutionBindings.some(
    b => b.permissionRequired === 'T3',
  )
  if (hasConstitutionalBindings && !policy.canModifyConstitution) {
    violations.push({
      ruleId: 'info_level_constitution',
      message: `Info level ${ctx.infoLevel} cannot modify constitutional nodes`,
      severity: 'block',
      handler: 'reject',
    })
  }

  // L2 subjective: require verification flag
  if (policy.requiresVerification) {
    for (const token of midIR.tokens) {
      if (isResolved(token.certainty) && token.certainty.value === 'uncertain') {
        violations.push({
          ruleId: 'l2_verification',
          message: `Token ${token.id} is L2 subjective + uncertain → requires verification before acting`,
          severity: 'warn',
          handler: 'escalate_to_human',
        })
      }
    }
  }

  return violations
}

// ── Relation Level ↔ Semantic Operator Coherence ─────────────

/**
 * Validate that a relation's infoLevel matches its semantic operators.
 *
 * L0_logic: must use logic operators (deductive/inductive/analogical)
 *   — computable without human/AI
 * L1_conditional: must use causal/process operators
 *   — too complex to enumerate, needs human/AI
 * L2_existential: must use dialectic operators
 *   — requires narrative, subjectivity
 *
 * Cross-level contamination is a constitutional violation.
 */
function checkRelationLevelCoherence(edge: RelationEdge): ConstitutionViolation[] {
  const violations: ConstitutionViolation[] = []

  switch (edge.infoLevel) {
    case 'L0_logic':
      // L0 must have logic, must NOT have dialectic
      if (edge.dialectic) {
        violations.push({
          ruleId: 'r_level_coherence',
          message: `Edge ${edge.id}: L0_logic cannot use dialectic operators (dialectic is L2_existential)`,
          severity: 'block',
          handler: 'reject',
        })
      }
      // L0 should be deterministic
      if (edge.certainty !== 'deterministic') {
        violations.push({
          ruleId: 'r_level_certainty',
          message: `Edge ${edge.id}: L0_logic should be deterministic, got "${edge.certainty}"`,
          severity: 'warn',
          handler: 'escalate_to_human',
        })
      }
      break

    case 'L1_conditional':
      // L1 uses causal/process; dialectic is L2 only
      if (edge.dialectic) {
        violations.push({
          ruleId: 'r_level_coherence',
          message: `Edge ${edge.id}: L1_conditional cannot use dialectic operators (dialectic is L2_existential)`,
          severity: 'downgrade',
          handler: 'downgrade_permission',
        })
      }
      break

    case 'L2_existential':
      // L2 can use any operator (existential subsumes lower levels)
      // But pure logic without dialectic/narrative context should be L0
      if (edge.logic && !edge.dialectic && !edge.causal && !edge.process) {
        violations.push({
          ruleId: 'r_level_coherence',
          message: `Edge ${edge.id}: L2_existential with only logic operators — should this be L0_logic?`,
          severity: 'warn',
          handler: 'escalate_to_human',
        })
      }
      break
  }

  return violations
}

/**
 * R info level must correspond to P info level in the context.
 * L0 relations can exist in L1/L2 context (lower is subset of higher).
 * But L2 relations cannot claim L0 context (escalation required).
 */
const R_LEVEL_RANK: Record<RInfoLevel, number> = {
  L0_logic: 0,
  L1_conditional: 1,
  L2_existential: 2,
}

const INFO_LEVEL_TO_R_LEVEL: Record<InfoLevel, RInfoLevel> = {
  L0_signal: 'L0_logic',
  L1_objective_law: 'L1_conditional',
  L2_subjective: 'L2_existential',
}

function checkRelationVsContext(
  edges: readonly RelationEdge[],
  ctx: CheckerContext,
): ConstitutionViolation[] {
  const violations: ConstitutionViolation[] = []
  const contextRLevel = INFO_LEVEL_TO_R_LEVEL[ctx.infoLevel]
  const contextRank = R_LEVEL_RANK[contextRLevel]

  for (const edge of edges) {
    const edgeRank = R_LEVEL_RANK[edge.infoLevel]

    // Edge claims higher level than context allows → block
    if (edgeRank > contextRank) {
      violations.push({
        ruleId: 'r_context_mismatch',
        message: `Edge ${edge.id}: relation level ${edge.infoLevel} exceeds context ${ctx.infoLevel} — cannot claim L2 relation in L0 context`,
        severity: 'block',
        handler: 'reject',
      })
    }
  }

  return violations
}

function checkEdges(
  edges: readonly RelationEdge[],
  ctx: CheckerContext,
): ConstitutionViolation[] {
  const violations: ConstitutionViolation[] = []

  for (const edge of edges) {
    // 1. Node type legality (existing check)
    const sourceType = inferNodeType(edge.sourceNode)
    const targetType = inferNodeType(edge.targetNode)

    if (!sourceType || !targetType) {
      violations.push({
        ruleId: 'edge_node_type',
        message: `Cannot infer node types for edge ${edge.id}: ${edge.sourceNode} → ${edge.targetNode}`,
        severity: 'warn',
        handler: 'escalate_to_human',
      })
      continue
    }

    if (!isEdgeLegal(sourceType, targetType, edge.edgeType)) {
      violations.push({
        ruleId: 'edge_legality',
        message: `Illegal edge: ${sourceType}→${targetType} via "${edge.edgeType}" (edge ${edge.id})`,
        severity: 'block',
        handler: 'reject',
      })
    }

    // 2. Relation level ↔ operator coherence (new constitutional check)
    violations.push(...checkRelationLevelCoherence(edge))
  }

  // 3. Relation level ↔ context info level correspondence
  violations.push(...checkRelationVsContext(edges, ctx))

  return violations
}

function checkValueGates(
  gates: readonly ValueGate[],
): { gateViolations: ConstitutionViolation[]; gateInstructions: StateInstruction[] } {
  const violations: ConstitutionViolation[] = []
  const instructions: StateInstruction[] = []

  for (const gate of gates) {
    const result: GateResult = checkGate(gate)

    if (!result.passed) {
      const failedMetrics = result.failures
        .map(m => `${m.dimension}.${m.metricType}: ${m.currentValue} < ${m.threshold}`)
        .join(', ')

      const severity: ViolationSeverity = result.action === 'reject' ? 'block'
        : result.action === 'downgrade' ? 'downgrade'
        : 'warn'

      violations.push({
        ruleId: `v_gate_${gate.id}`,
        message: `Value gate "${gate.id}" failed: [${failedMetrics}]`,
        severity,
        handler: result.action === 'reject' ? 'reject'
          : result.action === 'escalate' ? 'escalate_to_human'
          : 'downgrade_permission',
      })
    }
  }

  return { gateViolations: violations, gateInstructions: instructions }
}

// ── Helpers ───────────────────────────────────────────────────

/** Infer PRVSE node type from node ID convention */
function inferNodeType(nodeId: NodeId): NodeType | null {
  const id = nodeId as string
  if (id.startsWith('p-') || id.startsWith('tag-p')) return 'P'
  if (id.startsWith('r-') || id.startsWith('tag-r')) return 'R'
  if (id.startsWith('v-') || id.startsWith('tag-v')) return 'V'
  if (id.startsWith('s-') || id.startsWith('tag-s')) return 'S'
  if (id.startsWith('e-') || id.startsWith('tag-e')) return 'E'
  return null
}

// ── Convenience: check a single token quickly ─────────────────

/**
 * Quick check: can this token proceed at all?
 * Used by scanner to fast-reject obviously invalid input.
 */
export function quickCheck(
  token: PatternToken,
  actor: PermissionTier,
): { allowed: boolean; maxPermission: PermissionTier; reason?: string } {
  const level = getNarrowingLevel(token)
  const maxPermission = narrowingToPermission(level)

  if (!hasPermission(actor, 'T0')) {
    return { allowed: false, maxPermission, reason: 'Actor has no permission at all' }
  }

  return { allowed: true, maxPermission }
}
