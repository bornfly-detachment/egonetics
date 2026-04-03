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
  PLevel,
  PPhysicalType,
  PCommunication,
  REdgeType,
  RPropagation,
} from './types'

import { resolved, isResolved } from './types'

// ── Narrowing Rules ───────────────────────────────────────────

/**
 * Infer level from physical type + origin.
 * These are deterministic rules extracted from tag-tree patterns.
 */
function inferLevel(token: PatternToken): PLevel | null {
  // Internal module output / system events are L0 atoms
  if (token.origin.domain === 'internal' &&
      (token.origin.type === 'module_output' || token.origin.type === 'system_event')) {
    return 'L0_atom'
  }

  // Internal execution results (model calls) that produce concrete output
  if (token.origin.domain === 'internal' && token.origin.type === 'model_call') {
    return 'L0_atom'
  }

  // Physical type hints at level
  if (isResolved(token.physical)) {
    switch (token.physical.value) {
      case 'code':
      case 'number':
      case 'structured':
        return 'L0_atom'  // concrete, complete data
      case 'stream':
        return 'L0_atom'  // raw signal data
    }
  }

  // External computable sources → L0 atom
  if (token.origin.domain === 'external' && token.origin.type === 'computable') {
    return 'L0_atom'
  }

  // Content heuristics for higher levels
  const content = token.rawContent.toLowerCase()

  // References to combination/integration/module → L1 molecule
  if (/\b(组合|集成|模块|pipeline|integration|module|component)\b/i.test(content)) {
    return 'L1_molecule'
  }

  // References to constitution/goals/principles/abstraction → L2 gene
  if (/\b(宪法|目标|原则|抽象|constitution|goal|principle|abstract|evolution)\b/i.test(content)) {
    return 'L2_gene'
  }

  // Default: external narrative/sensor → L0 atom (raw input, lowest form)
  if (token.origin.domain === 'external') return 'L0_atom'

  return null
}

/**
 * Infer communication direction from origin + level.
 */
function inferCommunication(token: PatternToken): PCommunication | null {
  // External input enters from below (going up into the system)
  if (token.origin.domain === 'external') return 'bottom_up'

  // Internal system events / module output → lateral (same-level signal)
  if (token.origin.domain === 'internal' &&
      (token.origin.type === 'module_output' || token.origin.type === 'system_event')) {
    return 'lateral'
  }

  // User input → bottom_up (human entering info into the system)
  if (token.origin.domain === 'internal' && token.origin.type === 'user_input') {
    return 'bottom_up'
  }

  // If level is resolved, use level to determine direction
  if (isResolved(token.level)) {
    switch (token.level.value) {
      case 'L2_gene': return 'top_down'      // abstraction guides practice
      case 'L1_molecule': return 'lateral'    // P+R+V module operates laterally
      case 'L0_atom': return 'bottom_up'      // raw data flows up
    }
  }

  // Process memory → lateral (recalling from chronicle)
  if (token.origin.domain === 'internal' && token.origin.type === 'process_memory') {
    return 'lateral'
  }

  return null
}

/**
 * Infer physical type from raw content heuristics (backup for scanner).
 */
function inferPhysical(token: PatternToken): PPhysicalType | null {
  const content = token.rawContent.trim()
  if (content.length === 0) return null

  // Number detection
  if (/^-?\d+(\.\d+)?$/.test(content)) return 'number'

  // Structured data
  if (/^\s*[{\[]/.test(content)) {
    try {
      JSON.parse(content)
      return 'structured'
    } catch {
      // fall through
    }
  }

  // Code detection (contains common code patterns)
  if (/[{}();]/.test(content) && /\b(function|const|let|var|if|for|return|import)\b/.test(content)) {
    return 'code'
  }

  // Default: text (most common)
  return 'text'
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

  // Round 2: infer level from physical + origin
  if (!isResolved(result.level)) {
    const level = inferLevel(result)
    if (level) {
      result = { ...result, level: resolved(level) }
    }
  }

  // Round 3: infer communication from origin + level
  if (!isResolved(result.communication)) {
    const communication = inferCommunication(result)
    if (communication) {
      result = { ...result, communication: resolved(communication) }
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
    text: 'L0 atoms: any execution node (T0+) can read/write',
    permissionRequired: 'T0',
    appliesTo: (t) => isResolved(t.level) && t.level.value === 'L0_atom',
  },
  {
    id: 'const-002',
    text: 'L1 molecules require reasoning authority (T1+)',
    permissionRequired: 'T1',
    appliesTo: (t) => isResolved(t.level) && t.level.value === 'L1_molecule',
  },
  {
    id: 'const-003',
    text: 'L2 genes require evolution authority (T2+)',
    permissionRequired: 'T2',
    appliesTo: (t) => isResolved(t.level) && t.level.value === 'L2_gene',
  },
  {
    id: 'const-004',
    text: 'External origin must declare provenance chain (any tier)',
    permissionRequired: 'T0',
    appliesTo: (t) => t.origin.domain === 'external',
  },
  {
    id: 'const-005',
    text: 'State transition external→candidate requires L0 validation',
    permissionRequired: 'T0',
    appliesTo: (t) => t.state === 'external',
  },
  {
    id: 'const-006',
    text: 'candidate→internal requires practice verification (T1+)',
    permissionRequired: 'T1',
    appliesTo: (t) => t.state === 'candidate',
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
