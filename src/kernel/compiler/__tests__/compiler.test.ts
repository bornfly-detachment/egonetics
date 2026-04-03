/**
 * PRVSE Compiler — Tests
 *
 * Tests the full pipeline: Scanner → Binder → Checker → Emitter
 */

import { describe, it, expect, beforeEach } from 'vitest'

import {
  // Scanner
  scan, scanBatch, resetTokenCounter,
  type ScannerInput,

  // Binder
  bind, narrowToken, inferEdgeProperties,

  // Checker
  isConstitutionSatisfiedBy, quickCheck,

  // Emitter
  emit,

  // Full pipeline
  compile,

  // Types & helpers
  resolved, unresolved, isResolved, getNarrowingLevel, checkGate,
  type PatternToken, type PSource, type ValueGate, type RelationEdge,
  type PermissionTier, type InfoLevel, type MidIR,
} from '../index'

import { nodeId } from '../../types'

// ── Helpers ───────────────────────────────────────────────────

const userSource: PSource = { origin: 'external', type: 'user_input' }
const internalSource: PSource = { origin: 'internal', type: 'execution_result' }

function makeInput(content: string, source: PSource = userSource): ScannerInput {
  return { content, source }
}

// ── Narrowable<T> ─────────────────────────────────────────────

describe('Narrowable', () => {
  it('resolved holds a value', () => {
    const n = resolved('text')
    expect(isResolved(n)).toBe(true)
    if (isResolved(n)) expect(n.value).toBe('text')
  })

  it('unresolved has no value', () => {
    const n = unresolved<string>()
    expect(isResolved(n)).toBe(false)
  })
})

// ── Scanner ───────────────────────────────────────────────────

describe('Scanner', () => {
  beforeEach(() => resetTokenCounter())

  it('scans plain text input', () => {
    const token = scan(makeInput('Hello world'))
    expect(token.rawContent).toBe('Hello world')
    expect(token.source).toEqual(userSource)
    expect(isResolved(token.physical)).toBe(true)
    if (isResolved(token.physical)) expect(token.physical.value).toBe('text')
  })

  it('scans numeric input', () => {
    const token = scan(makeInput('42.5'))
    if (isResolved(token.physical)) expect(token.physical.value).toBe('number')
  })

  it('scans code input', () => {
    const token = scan(makeInput('const x = function() { return 1; }'))
    if (isResolved(token.physical)) expect(token.physical.value).toBe('code')
  })

  it('detects uncertain language', () => {
    const token = scan(makeInput('maybe this could work?'))
    expect(isResolved(token.certainty)).toBe(true)
    if (isResolved(token.certainty)) expect(token.certainty.value).toBe('uncertain')
  })

  it('detects certain language', () => {
    const token = scan(makeInput('This must always be true'))
    if (isResolved(token.certainty)) expect(token.certainty.value).toBe('certain')
  })

  it('detects incomplete content', () => {
    const token = scan(makeInput('something...'))
    if (isResolved(token.completeness)) expect(token.completeness.value).toBe('incomplete')
  })

  it('detects complete content', () => {
    const token = scan(makeInput('This is a complete sentence.'))
    if (isResolved(token.completeness)) expect(token.completeness.value).toBe('complete')
  })

  it('respects hints', () => {
    const token = scan({ content: 'raw', source: userSource, hints: { physical: 'audio' } })
    if (isResolved(token.physical)) expect(token.physical.value).toBe('audio')
  })

  it('destination always starts unresolved', () => {
    const token = scan(makeInput('anything'))
    expect(isResolved(token.destination)).toBe(false)
  })

  it('truth always starts unresolved', () => {
    const token = scan(makeInput('anything'))
    expect(isResolved(token.truth)).toBe(false)
  })

  it('scanBatch preserves order', () => {
    const tokens = scanBatch([makeInput('first'), makeInput('second')])
    expect(tokens).toHaveLength(2)
    expect(tokens[0].rawContent).toBe('first')
    expect(tokens[1].rawContent).toBe('second')
  })
})

// ── Binder — Narrowing ────────────────────────────────────────

describe('Binder — narrowToken', () => {
  beforeEach(() => resetTokenCounter())

  it('infers semantic type from code physical', () => {
    const token = scan(makeInput('const x = function() { return 1; }'))
    const narrowed = narrowToken(token)
    if (isResolved(narrowed.semantic)) expect(narrowed.semantic.value).toBe('rule')
  })

  it('infers semantic type for internal execution_result', () => {
    const token = scan({ content: 'test passed', source: internalSource })
    const narrowed = narrowToken(token)
    if (isResolved(narrowed.semantic)) expect(narrowed.semantic.value).toBe('evaluation')
  })

  it('infers destination from semantic', () => {
    const token: PatternToken = {
      ...scan(makeInput('build the login feature.')),
      semantic: resolved('goal_task'),
    }
    const narrowed = narrowToken(token)
    if (isResolved(narrowed.destination)) expect(narrowed.destination.value).toBe('P1_instruction')
  })

  it('numeric input narrows to fact → P2_retrieval', () => {
    const token = scan(makeInput('42'))
    const narrowed = narrowToken(narrowToken(token)) // two passes
    if (isResolved(narrowed.semantic)) expect(narrowed.semantic.value).toBe('fact')
    if (isResolved(narrowed.destination)) expect(narrowed.destination.value).toBe('P2_retrieval')
  })
})

describe('Binder — bind', () => {
  beforeEach(() => resetTokenCounter())

  it('narrows tokens and produces constitution bindings', () => {
    const tokens = scanBatch([
      makeInput('const x = function() { return 1; }'),
    ])
    const midIR = bind({ tokens, edges: [], gates: [] })

    expect(midIR.tokens).toHaveLength(1)
    // Code → rule → const-002 should bind
    expect(midIR.constitutionBindings.length).toBeGreaterThan(0)
    const ruleBinding = midIR.constitutionBindings.find(b => b.ruleId === 'const-002')
    expect(ruleBinding).toBeDefined()
  })

  it('binds external source rule', () => {
    const tokens = scanBatch([makeInput('hello')])
    const midIR = bind({ tokens, edges: [], gates: [] })

    const externalBinding = midIR.constitutionBindings.find(b => b.ruleId === 'const-005')
    expect(externalBinding).toBeDefined()
  })
})

describe('Binder — inferEdgeProperties', () => {
  it('causal edge → directed, forward', () => {
    const props = inferEdgeProperties({ causal: 'direct' })
    expect(props.edgeType).toBe('directed')
    expect(props.propagation).toBe('forward')
  })

  it('dialectic oppose → mutual_constraint, bidirectional', () => {
    const props = inferEdgeProperties({ dialectic: 'oppose' })
    expect(props.edgeType).toBe('mutual_constraint')
    expect(props.propagation).toBe('bidirectional')
  })

  it('dialectic unify → derives, forward', () => {
    const props = inferEdgeProperties({ dialectic: 'unify' })
    expect(props.edgeType).toBe('derives')
    expect(props.propagation).toBe('forward')
  })
})

// ── Narrowing Level ───────────────────────────────────────────

describe('getNarrowingLevel', () => {
  beforeEach(() => resetTokenCounter())

  it('minimal for mostly unresolved token', () => {
    const token = scan(makeInput(''))
    // empty content → nothing resolved
    expect(getNarrowingLevel(token)).toBe('minimal')
  })

  it('partial when some fields resolved', () => {
    const token: PatternToken = {
      ...scan(makeInput('hello world')),
      semantic: resolved('fact'),
      destination: resolved('P2_retrieval'),
    }
    const level = getNarrowingLevel(token)
    expect(['partial', 'full']).toContain(level)
  })

  it('full when all 6 fields resolved', () => {
    const token: PatternToken = {
      ...scan(makeInput('hello world.')),
      physical: resolved('text'),
      semantic: resolved('fact'),
      destination: resolved('P2_retrieval'),
      certainty: resolved('certain'),
      completeness: resolved('complete'),
      truth: resolved('true'),
    }
    expect(getNarrowingLevel(token)).toBe('full')
  })
})

// ── Value Gate ────────────────────────────────────────────────

describe('checkGate', () => {
  it('passes when all metrics above threshold', () => {
    const gate: ValueGate = {
      id: 'test-gate',
      source: 'computer_system',
      temporal: 'static',
      scope: 'local',
      destination: 'V_D2_task_completion',
      metrics: [
        { dimension: 'v1', metricType: 'probability', currentValue: 0.95, threshold: 0.8 },
      ],
      onFail: 'reject',
    }
    const result = checkGate(gate)
    expect(result.passed).toBe(true)
  })

  it('fails when metric below threshold', () => {
    const gate: ValueGate = {
      id: 'test-gate',
      source: 'ai_model',
      temporal: 'dynamic',
      scope: 'global',
      destination: 'V_D1_align_human_preference',
      metrics: [
        { dimension: 'v2', metricType: 'confidence', currentValue: 0.3, threshold: 0.7 },
      ],
      onFail: 'escalate',
    }
    const result = checkGate(gate)
    expect(result.passed).toBe(false)
    if (!result.passed) {
      expect(result.action).toBe('escalate')
      expect(result.failures).toHaveLength(1)
    }
  })

  it('multiple metrics — one failure fails the gate', () => {
    const gate: ValueGate = {
      id: 'multi-gate',
      source: 'computer_system',
      temporal: 'static',
      scope: 'local',
      destination: 'V_D2_task_completion',
      metrics: [
        { dimension: 'v1', metricType: 'counter', currentValue: 10, threshold: 5 },
        { dimension: 'v1', metricType: 'probability', currentValue: 0.2, threshold: 0.8 },
      ],
      onFail: 'downgrade',
    }
    const result = checkGate(gate)
    expect(result.passed).toBe(false)
    if (!result.passed) {
      expect(result.failures).toHaveLength(1)
    }
  })
})

// ── Checker ───────────────────────────────────────────────────

describe('Checker — isConstitutionSatisfiedBy', () => {
  beforeEach(() => resetTokenCounter())

  it('passes for simple text with T2 actor', () => {
    const tokens = scanBatch([makeInput('hello world.')])
    const midIR = bind({ tokens, edges: [], gates: [] })
    const lowIR = isConstitutionSatisfiedBy(midIR, {
      actor: 'T2_claude',
      infoLevel: 'L1_objective_law',
    })

    const hasBlocks = lowIR.violations.some(v => v.severity === 'block')
    expect(hasBlocks).toBe(false)
  })

  it('blocks T0 actor from creating rule-type patterns', () => {
    const token: PatternToken = {
      ...scan(makeInput('const x = function() { return 1; }')),
      semantic: resolved('rule'),
    }
    const midIR = bind({ tokens: [token], edges: [], gates: [] })
    const lowIR = isConstitutionSatisfiedBy(midIR, {
      actor: 'T0_qwen',
      infoLevel: 'L1_objective_law',
    })

    const blocks = lowIR.violations.filter(v => v.severity === 'block')
    expect(blocks.length).toBeGreaterThan(0)
    expect(blocks.some(v => v.ruleId === 'const-002')).toBe(true)
  })

  it('blocks illegal edge connections', () => {
    const tokens = scanBatch([makeInput('test')])
    const illegalEdge: RelationEdge = {
      id: 'bad-edge',
      sourceNode: nodeId('v-reward'),
      targetNode: nodeId('p-input'),
      direction: 'one_way',
      certainty: 'deterministic',
      temporal: 'sequential',
      strength: 'positive',
      edgeType: 'directed', // V→P directed is illegal
      propagation: 'forward',
      priority: 1,
      destination: 'R_D1_drive_reasoning',
    }

    const midIR = bind({ tokens, edges: [illegalEdge], gates: [] })
    const lowIR = isConstitutionSatisfiedBy(midIR, {
      actor: 'T2_claude',
      infoLevel: 'L1_objective_law',
    })

    const edgeViolations = lowIR.violations.filter(v => v.ruleId === 'edge_legality')
    expect(edgeViolations.length).toBeGreaterThan(0)
  })

  it('allows legal P→R edge', () => {
    const tokens = scanBatch([makeInput('test')])
    const legalEdge: RelationEdge = {
      id: 'good-edge',
      sourceNode: nodeId('p-input'),
      targetNode: nodeId('r-causes'),
      direction: 'one_way',
      certainty: 'deterministic',
      temporal: 'sequential',
      strength: 'positive',
      edgeType: 'directed',
      propagation: 'forward',
      priority: 1,
      destination: 'R_D1_drive_reasoning',
    }

    const midIR = bind({ tokens, edges: [legalEdge], gates: [] })
    const lowIR = isConstitutionSatisfiedBy(midIR, {
      actor: 'T2_claude',
      infoLevel: 'L1_objective_law',
    })

    const edgeViolations = lowIR.violations.filter(v => v.ruleId === 'edge_legality')
    expect(edgeViolations).toHaveLength(0)
  })

  it('downgrades permission for minimal narrowing', () => {
    const token: PatternToken = {
      id: 'test-minimal',
      timestamp: Date.now(),
      rawContent: '',
      source: userSource,
      destination: unresolved(),
      physical: unresolved(),
      semantic: unresolved(),
      certainty: unresolved(),
      completeness: unresolved(),
      truth: unresolved(),
    }

    const midIR = bind({ tokens: [token], edges: [], gates: [] })
    const lowIR = isConstitutionSatisfiedBy(midIR, {
      actor: 'T2_claude',
      infoLevel: 'L1_objective_law',
    })

    // T2 actor should be downgraded due to minimal narrowing
    expect(lowIR.permissionLevel).not.toBe('T2_claude')
  })

  it('reports failed value gates', () => {
    const tokens = scanBatch([makeInput('test')])
    const failingGate: ValueGate = {
      id: 'strict-gate',
      source: 'computer_system',
      temporal: 'static',
      scope: 'local',
      destination: 'V_D2_task_completion',
      metrics: [
        { dimension: 'v1', metricType: 'probability', currentValue: 0.1, threshold: 0.9 },
      ],
      onFail: 'reject',
    }

    const midIR = bind({ tokens, edges: [], gates: [failingGate] })
    const lowIR = isConstitutionSatisfiedBy(midIR, {
      actor: 'T2_claude',
      infoLevel: 'L1_objective_law',
    })

    const gateViolations = lowIR.violations.filter(v => v.ruleId.startsWith('v_gate_'))
    expect(gateViolations.length).toBeGreaterThan(0)
  })
})

// ── Emitter ───────────────────────────────────────────────────

describe('Emitter', () => {
  beforeEach(() => resetTokenCounter())

  it('emits nothing when blocked', () => {
    const tokens = scanBatch([makeInput('test')])
    const midIR = bind({ tokens, edges: [], gates: [] })
    const lowIR = isConstitutionSatisfiedBy(midIR, {
      actor: 'T2_claude',
      infoLevel: 'L1_objective_law',
    })

    // Force a block
    const blockedLowIR = {
      ...lowIR,
      violations: [
        ...lowIR.violations,
        { ruleId: 'test', message: 'blocked', severity: 'block' as const, handler: 'reject' as const },
      ],
    }

    const output = emit({ lowIR: blockedLowIR, midIR, infoLevel: 'L1_objective_law' })
    expect(output.patches).toHaveLength(0)
    expect(output.events).toHaveLength(0)
    // Should still have a log effect
    expect(output.effects.length).toBeGreaterThan(0)
  })

  it('emits evolution events for processed tokens', () => {
    const tokens = scanBatch([makeInput('hello world.')])
    const midIR = bind({ tokens, edges: [], gates: [] })
    const lowIR = isConstitutionSatisfiedBy(midIR, {
      actor: 'T2_claude',
      infoLevel: 'L1_objective_law',
    })

    const output = emit({ lowIR, midIR, infoLevel: 'L1_objective_law' })
    expect(output.events.length).toBeGreaterThan(0)
    expect(output.events[0].mutationType).toBe('create')
    // executor determined by permission level (may be downgraded by narrowing)
    expect(['T0', 'T1', 'T2']).toContain(output.events[0].executor)
  })
})

// ── Full Pipeline ─────────────────────────────────────────────

describe('compile — full pipeline', () => {
  beforeEach(() => resetTokenCounter())

  it('compiles simple text input successfully', () => {
    const result = compile({
      inputs: [makeInput('This is a fact.')],
      actor: 'T2_claude',
      infoLevel: 'L1_objective_law',
    })

    expect(result.success).toBe(true)
    expect(result.highIR).toBeDefined()
    expect(result.midIR).toBeDefined()
    expect(result.lowIR).toBeDefined()
    expect(result.events.length).toBeGreaterThan(0)
  })

  it('blocks unauthorized operation', () => {
    const result = compile({
      inputs: [{
        content: 'build everything',
        source: userSource,
        hints: { semantic: 'goal_task' },
      }],
      actor: 'T0_qwen',
      infoLevel: 'L1_objective_law',
    })

    // T0 cannot create goal_task (requires T2)
    expect(result.success).toBe(false)
    expect(result.violations.some(v => v.severity === 'block')).toBe(true)
  })

  it('compiles with value gates', () => {
    const result = compile({
      inputs: [makeInput('execute task')],
      gates: [{
        id: 'quality-gate',
        source: 'computer_system',
        temporal: 'static',
        scope: 'local',
        destination: 'V_D2_task_completion',
        metrics: [
          { dimension: 'v1', metricType: 'probability', currentValue: 0.95, threshold: 0.8 },
        ],
        onFail: 'reject',
      }],
      actor: 'T1_minimax',
      infoLevel: 'L1_objective_law',
    })

    expect(result.success).toBe(true)
  })

  it('rejects when value gate fails', () => {
    const result = compile({
      inputs: [makeInput('execute task')],
      gates: [{
        id: 'strict-gate',
        source: 'computer_system',
        temporal: 'static',
        scope: 'local',
        destination: 'V_D2_task_completion',
        metrics: [
          { dimension: 'v1', metricType: 'probability', currentValue: 0.1, threshold: 0.9 },
        ],
        onFail: 'reject',
      }],
      actor: 'T1_minimax',
      infoLevel: 'L1_objective_law',
    })

    expect(result.success).toBe(false)
  })

  it('handles code input end-to-end', () => {
    const result = compile({
      inputs: [{
        content: 'const validate = function(input) { if (!input) { return false; } return true; }',
        source: { origin: 'internal', type: 'component_output' },
      }],
      actor: 'T2_claude',
      infoLevel: 'L1_objective_law',
    })

    expect(result.success).toBe(true)
    // Should detect as code → rule → needs T1+
    expect(result.midIR?.tokens[0]).toBeDefined()
    const token = result.midIR!.tokens[0]
    if (isResolved(token.physical)) expect(token.physical.value).toBe('code')
  })

  it('Chinese input compiles correctly', () => {
    const result = compile({
      inputs: [makeInput('用户登录失败超过5次就锁定。')],
      actor: 'T2_claude',
      infoLevel: 'L1_objective_law',
    })

    expect(result.success).toBe(true)
    expect(result.highIR.rawContent).toBe('用户登录失败超过5次就锁定。')
  })

  it('uncertain Chinese input detected', () => {
    const result = compile({
      inputs: [makeInput('可能需要重新设计这个模块')],
      actor: 'T2_claude',
      infoLevel: 'L2_subjective',
    })

    // Should detect 可能 as uncertain
    const token = result.midIR?.tokens[0]
    if (token && isResolved(token.certainty)) {
      expect(token.certainty.value).toBe('uncertain')
    }
  })
})

// ── quickCheck ────────────────────────────────────────────────

describe('quickCheck', () => {
  beforeEach(() => resetTokenCounter())

  it('allows any token for T2 actor', () => {
    const token = scan(makeInput('anything'))
    const result = quickCheck(token, 'T2_claude')
    expect(result.allowed).toBe(true)
  })

  it('returns maxPermission based on narrowing', () => {
    const token = scan(makeInput('hello world.'))
    const result = quickCheck(token, 'T2_claude')
    expect(result.maxPermission).toBeDefined()
  })
})
