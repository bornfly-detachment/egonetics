/**
 * PRVSE Compiler — Binder
 *
 * Equivalent to TypeScript's binder.ts — builds the symbol table.
 * Takes scanner output (PatternTokens) and:
 *   1. Resolves node references (link tokens to existing PRVSE graph nodes)
 *   2. Infers missing Narrowable fields from context (type narrowing)
 *   3. Binds constitutional rules (which rules apply to which nodes)
 *   4. Constructs MidIR (fully typed graph fragment ready for checker)
 *
 * Binder is deterministic — no LLM calls, pure graph lookups + inference.
 */

import type {
  PatternToken,
  RelationEdge,
  ValueGate,
  ConstitutionBinding,
  MidIR,
  PermissionTier,
  PSemanticType,
  PPhysicalType,
  PDestination,
  REdgeType,
  RPropagation,
} from './types'

import { resolved, isResolved } from './types'

// ── Narrowing Rules ───────────────────────────────────────────

/**
 * Infer semantic type from physical type + source.
 * These are deterministic rules extracted from tag-tree patterns.
 */
function inferSemantic(token: PatternToken): PSemanticType | null {
  // If source is execution_result → likely 'process' or 'evaluation'
  if (token.source.origin === 'internal' && token.source.type === 'execution_result') {
    return 'evaluation'
  }

  // If physical is code → likely 'rule' or 'process'
  if (isResolved(token.physical)) {
    switch (token.physical.value) {
      case 'code': return 'rule'
      case 'number': return 'fact'
    }
  }

  return null
}

/**
 * Infer destination from semantic type.
 */
function inferDestination(token: PatternToken): PDestination | null {
  if (!isResolved(token.semantic)) return null

  switch (token.semantic.value) {
    case 'fact': return 'P2_retrieval'
    case 'rule': return 'P3_execution'
    case 'process': return 'P3_execution'
    case 'evaluation': return 'P5_introspection'
    case 'narrative': return 'P6_reasoning'
    case 'goal_task': return 'P1_instruction'
    case 'relation': return 'P6_reasoning'
  }
}

/**
 * Infer physical type from raw content heuristics.
 */
function inferPhysical(token: PatternToken): PPhysicalType | null {
  const content = token.rawContent.trim()

  // Number detection
  if (/^-?\d+(\.\d+)?$/.test(content)) return 'number'

  // Code detection (contains common code patterns)
  if (/[{}();]/.test(content) && /\b(function|const|let|var|if|for|return|import)\b/.test(content)) {
    return 'code'
  }

  // Default: text (most common)
  if (content.length > 0) return 'text'

  return null
}

// ── Token Narrowing ───────────────────────────────────────────

/**
 * Narrow a token's unknown fields using deterministic inference rules.
 * Returns a new token with as many fields resolved as possible.
 * Does NOT mutate the input.
 */
export function narrowToken(token: PatternToken): PatternToken {
  let result = token

  // Round 1: infer physical from content
  if (!isResolved(result.physical)) {
    const physical = inferPhysical(result)
    if (physical) {
      result = { ...result, physical: resolved(physical) }
    }
  }

  // Round 2: infer semantic from physical + source
  if (!isResolved(result.semantic)) {
    const semantic = inferSemantic(result)
    if (semantic) {
      result = { ...result, semantic: resolved(semantic) }
    }
  }

  // Round 3: infer destination from semantic
  if (!isResolved(result.destination)) {
    const destination = inferDestination(result)
    if (destination) {
      result = { ...result, destination: resolved(destination) }
    }
  }

  return result
}

// ── Constitution Binding ──────────────────────────────────────

/**
 * Constitutional rules — the rules that tokens/edges must satisfy.
 * These come from hm_protocol and tag-tree constraints.
 */
interface ConstitutionRuleSpec {
  readonly id: string
  readonly text: string
  readonly permissionRequired: PermissionTier
  readonly appliesTo: (token: PatternToken) => boolean
}

/**
 * Built-in constitutional rules.
 * In production, these would be loaded from hm_protocol DB.
 */
const CONSTITUTION_RULES: readonly ConstitutionRuleSpec[] = [
  {
    id: 'const-001',
    text: 'L0 signal nodes can only be modified by T0+',
    permissionRequired: 'T0',
    appliesTo: (t) => isResolved(t.semantic) && t.semantic.value === 'fact',
  },
  {
    id: 'const-002',
    text: 'Rule-type patterns require T1+ permission to create',
    permissionRequired: 'T1_minimax',
    appliesTo: (t) => isResolved(t.semantic) && t.semantic.value === 'rule',
  },
  {
    id: 'const-003',
    text: 'Goal/task patterns require T2+ permission to create',
    permissionRequired: 'T2_claude',
    appliesTo: (t) => isResolved(t.semantic) && t.semantic.value === 'goal_task',
  },
  {
    id: 'const-004',
    text: 'Narrative patterns are L2 subjective — always require verification',
    permissionRequired: 'T1_minimax',
    appliesTo: (t) => isResolved(t.semantic) && t.semantic.value === 'narrative',
  },
  {
    id: 'const-005',
    text: 'External source patterns must declare provenance',
    permissionRequired: 'T0',
    appliesTo: (t) => t.source.origin === 'external',
  },
]

function bindConstitution(tokens: readonly PatternToken[]): ConstitutionBinding[] {
  const bindings: ConstitutionBinding[] = []

  for (const token of tokens) {
    for (const rule of CONSTITUTION_RULES) {
      if (rule.appliesTo(token)) {
        bindings.push({
          nodeId: token.id,
          ruleId: rule.id,
          ruleText: rule.text,
          permissionRequired: rule.permissionRequired,
        })
      }
    }
  }

  return bindings
}

// ── Edge Inference ────────────────────────────────────────────

/**
 * Infer edge type and propagation from relation's semantic nature.
 */
export function inferEdgeProperties(edge: Partial<RelationEdge>): {
  edgeType: REdgeType
  propagation: RPropagation
} {
  // Causal → directed, forward propagation
  if (edge.causal) {
    return { edgeType: 'directed', propagation: 'forward' }
  }

  // Dialectic oppose/transform → mutual_constraint, bidirectional
  if (edge.dialectic === 'oppose' || edge.dialectic === 'transform') {
    return { edgeType: 'mutual_constraint', propagation: 'bidirectional' }
  }

  // Dialectic unify → derives, forward
  if (edge.dialectic === 'unify') {
    return { edgeType: 'derives', propagation: 'forward' }
  }

  // Logic → constraint, forward
  if (edge.logic) {
    return { edgeType: 'constraint', propagation: 'forward' }
  }

  // Process → directed, forward
  if (edge.process) {
    return { edgeType: 'directed', propagation: 'forward' }
  }

  // Default: signal, forward
  return { edgeType: 'signal', propagation: 'forward' }
}

// ── Main Binder ───────────────────────────────────────────────

export interface BinderInput {
  readonly tokens: readonly PatternToken[]
  readonly edges: readonly RelationEdge[]
  readonly gates: readonly ValueGate[]
}

/**
 * bind() — the main binder function.
 *
 * Takes scanner output + manually declared edges/gates,
 * narrows all tokens, binds constitutional rules,
 * produces MidIR for checker.
 */
export function bind(input: BinderInput): MidIR {
  // 1. Narrow all tokens (multi-pass until stable)
  const narrowedTokens = input.tokens.map(t => {
    let prev = t
    let next = narrowToken(t)
    // Max 3 passes to reach stability
    for (let i = 0; i < 2 && prev !== next; i++) {
      prev = next
      next = narrowToken(next)
    }
    return next
  })

  // 2. Bind constitutional rules
  const constitutionBindings = bindConstitution(narrowedTokens)

  // 3. Return MidIR
  return {
    tokens: narrowedTokens,
    edges: input.edges,
    gates: input.gates,
    constitutionBindings,
  }
}
