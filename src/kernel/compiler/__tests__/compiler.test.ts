/**
 * PRVSE Compiler — Tests
 *
 * Tests the full pipeline: Scanner → Binder → Checker → Emitter
 * New P shape: origin, state, physical, level, communication
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
  type PatternToken, type POrigin, type ValueGate, type RelationEdge,
} from '../index'

import { nodeId } from '../../types'

// ── Helpers ───────────────────────────────────────────────────

const externalOrigin: POrigin = { domain: 'external', type: 'narrative' }
const computeOrigin: POrigin = { domain: 'external', type: 'computable' }
const internalOrigin: POrigin = { domain: 'internal', type: 'module_output' }
const userOrigin: POrigin = { domain: 'internal', type: 'user_input' }

function makeInput(content: string, origin: POrigin = externalOrigin): ScannerInput {
  return { content, origin }
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

  it('scans plain text input with external origin', () => {
    const token = scan(makeInput('Hello world'))
    expect(token.rawContent).toBe('Hello world')
    expect(token.origin).toEqual(externalOrigin)
    expect(token.state).toBe('external')
    expect(isResolved(token.physical)).toBe(true)
    if (isResolved(token.physical)) expect(token.physical.value).toBe('text')
  })

  it('scans with internal origin → candidate state', () => {
    const token = scan(makeInput('test result', internalOrigin))
    expect(token.state).toBe('candidate')
  })

  it('scans numeric input', () => {
    const token = scan(makeInput('42.5'))
    if (isResolved(token.physical)) expect(token.physical.value).toBe('number')
  })

  it('scans code input', () => {
    const token = scan(makeInput('const x = function() { return 1; }'))
    if (isResolved(token.physical)) expect(token.physical.value).toBe('code')
  })

  it('scans structured data (JSON)', () => {
    const token = scan(makeInput('{"key": "value", "num": 42}'))
    if (isResolved(token.physical)) expect(token.physical.value).toBe('structured')
  })

  it('classifies level for computable external source → L0_atom', () => {
    const token = scan(makeInput('42', computeOrigin))
    if (isResolved(token.level)) expect(token.level.value).toBe('L0_atom')
  })

  it('classifies level for internal module_output → L0_atom', () => {
    const token = scan(makeInput('test passed', internalOrigin))
    if (isResolved(token.level)) expect(token.level.value).toBe('L0_atom')
  })

  it('classifies level for code → L0_atom', () => {
    const token = scan(makeInput('const x = function() { return 1; }'))
    if (isResolved(token.level)) expect(token.level.value).toBe('L0_atom')
  })

  it('respects physical hints', () => {
    const token = scan({ content: 'raw', origin: externalOrigin, hints: { physical: 'audio' } })
    if (isResolved(token.physical)) expect(token.physical.value).toBe('audio')
  })

  it('respects level hints', () => {
    const token = scan({ content: 'abstract', origin: externalOrigin, hints: { level: 'L2_gene' } })
    if (isResolved(token.level)) expect(token.level.value).toBe('L2_gene')
  })

  it('communication always starts unresolved', () => {
    const token = scan(makeInput('anything'))
    expect(isResolved(token.communication)).toBe(false)
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

  it('infers level L0_atom from code physical', () => {
    const token = scan(makeInput('const x = function() { return 1; }'))
    const narrowed = narrowToken(token)
    if (isResolved(narrowed.level)) expect(narrowed.level.value).toBe('L0_atom')
  })

  it('infers level L0_atom for internal module_output', () => {
    const token = scan({ content: 'test passed', origin: internalOrigin })
    const narrowed = narrowToken(token)
    if (isResolved(narrowed.level)) expect(narrowed.level.value).toBe('L0_atom')
  })

  it('infers communication bottom_up for external origin', () => {
    const token = scan(makeInput('hello'))
    const narrowed = narrowToken(token)
    if (isResolved(narrowed.communication)) expect(narrowed.communication.value).toBe('bottom_up')
  })

  it('infers communication lateral for internal module_output', () => {
    const token = scan({ content: 'result data', origin: internalOrigin })
    const narrowed = narrowToken(token)
    if (isResolved(narrowed.communication)) expect(narrowed.communication.value).toBe('lateral')
  })

  it('infers communication bottom_up for user_input', () => {
    const token = scan({ content: 'user says hi', origin: userOrigin })
    const narrowed = narrowToken(token)
    if (isResolved(narrowed.communication)) expect(narrowed.communication.value).toBe('bottom_up')
  })

  it('infers level L2_gene for content referencing constitution/goals', () => {
    const token = scan(makeInput('update constitution and evolution goals'))
    const narrowed = narrowToken(token)
    if (isResolved(narrowed.level)) expect(narrowed.level.value).toBe('L2_gene')
  })

  it('infers level L1_molecule for content referencing modules/integration', () => {
    const token = scan(makeInput('integrate the pipeline module component'))
    const narrowed = narrowToken(token)
    if (isResolved(narrowed.level)) expect(narrowed.level.value).toBe('L1_molecule')
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
    // Code → L0_atom → const-001 should bind
    expect(midIR.constitutionBindings.length).toBeGreaterThan(0)
    const atomBinding = midIR.constitutionBindings.find(b => b.ruleId === 'const-001')
    expect(atomBinding).toBeDefined()
  })

  it('binds external origin rule', () => {
    const tokens = scanBatch([makeInput('hello')])
    const midIR = bind({ tokens, edges: [], gates: [] })

    const externalBinding = midIR.constitutionBindings.find(b => b.ruleId === 'const-004')
    expect(externalBinding).toBeDefined()
  })

  it('binds external state rule', () => {
    const tokens = scanBatch([makeInput('hello')])
    const midIR = bind({ tokens, edges: [], gates: [] })

    const stateBinding = midIR.constitutionBindings.find(b => b.ruleId === 'const-005')
    expect(stateBinding).toBeDefined()
  })

  it('binds L2 gene rule for constitution-referencing content', () => {
    const tokens = scanBatch([makeInput('update constitution goals')])
    const midIR = bind({ tokens, edges: [], gates: [] })

    const geneBinding = midIR.constitutionBindings.find(b => b.ruleId === 'const-003')
    expect(geneBinding).toBeDefined()
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

  it('minimal for completely unresolved token', () => {
    const token: PatternToken = {
      id: 'test',
      timestamp: Date.now(),
      rawContent: '',
      origin: externalOrigin,
      state: 'external',
      physical: unresolved(),
      level: unresolved(),
      communication: unresolved(),
    }
    expect(getNarrowingLevel(token)).toBe('minimal')
  })

  it('partial when some fields resolved', () => {
    const token: PatternToken = {
      id: 'test',
      timestamp: Date.now(),
      rawContent: 'hello',
      origin: externalOrigin,
      state: 'external',
      physical: resolved('text'),
      level: unresolved(),
      communication: unresolved(),
    }
    expect(getNarrowingLevel(token)).toBe('partial')
  })

  it('full when all 3 narrowable fields resolved', () => {
    const token: PatternToken = {
      id: 'test',
      timestamp: Date.now(),
      rawContent: 'hello world.',
      origin: externalOrigin,
      state: 'external',
      physical: resolved('text'),
      level: resolved('L0_atom'),
      communication: resolved('bottom_up'),
    }
    expect(getNarrowingLevel(token)).toBe('full')
  })
})

// ── Value Gate ────────────────────────────────────────────────

/** Helper: build a ValueGate with L0 metrics for testing */
function makeGate(
  id: string,
  metrics: { type: string; current: number; threshold: number }[],
  onFail: 'reject' | 'escalate' | 'downgrade' = 'reject',
): ValueGate {
  return {
    id,
    l0: {
      metrics: metrics.map(m => ({
        type: m.type as import('../types').VL0MetricType,
        currentValue: m.current,
        threshold: m.threshold,
      })),
      ruleChecks: [],
    },
    independence: { neutral: true, antiInfiltration: true, kernelDirect: true },
    onFail,
  }
}

describe('checkGate', () => {
  it('passes when all metrics above threshold', () => {
    const gate = makeGate('test-gate', [
      { type: 'binary', current: 0.95, threshold: 0.8 },
    ])
    const result = checkGate(gate)
    expect(result.passed).toBe(true)
  })

  it('fails when metric below threshold', () => {
    const gate = makeGate('test-gate', [
      { type: 'accuracy', current: 0.3, threshold: 0.7 },
    ], 'escalate')
    const result = checkGate(gate)
    expect(result.passed).toBe(false)
    if (!result.passed) {
      expect(result.action).toBe('escalate')
      expect(result.failures).toHaveLength(1)
    }
  })

  it('multiple metrics — one failure fails the gate', () => {
    const gate = makeGate('multi-gate', [
      { type: 'counter', current: 10, threshold: 5 },
      { type: 'accuracy', current: 0.2, threshold: 0.8 },
    ], 'downgrade')
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
      actor: 'T2',
      infoLevel: 'L1_objective_law',
    })

    const hasBlocks = lowIR.violations.some(v => v.severity === 'block')
    expect(hasBlocks).toBe(false)
  })

  it('blocks T0 actor from creating L2 gene patterns', () => {
    const token: PatternToken = {
      ...scan(makeInput('update constitution goals')),
      level: resolved('L2_gene'),
    }
    const midIR = bind({ tokens: [token], edges: [], gates: [] })
    const lowIR = isConstitutionSatisfiedBy(midIR, {
      actor: 'T0',
      infoLevel: 'L1_objective_law',
    })

    const blocks = lowIR.violations.filter(v => v.severity === 'block')
    expect(blocks.length).toBeGreaterThan(0)
    expect(blocks.some(v => v.ruleId === 'const-003')).toBe(true)
  })

  it('blocks T0 actor from creating L1 molecule patterns', () => {
    const token: PatternToken = {
      ...scan(makeInput('integrate module pipeline')),
      level: resolved('L1_molecule'),
    }
    const midIR = bind({ tokens: [token], edges: [], gates: [] })
    const lowIR = isConstitutionSatisfiedBy(midIR, {
      actor: 'T0',
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
      infoLevel: 'L0_logic',
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
      actor: 'T2',
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
      infoLevel: 'L0_logic',
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
      actor: 'T2',
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
      origin: userOrigin,
      state: 'candidate',
      physical: unresolved(),
      level: unresolved(),
      communication: unresolved(),
    }

    const midIR = bind({ tokens: [token], edges: [], gates: [] })
    const lowIR = isConstitutionSatisfiedBy(midIR, {
      actor: 'T2',
      infoLevel: 'L1_objective_law',
    })

    // T2 actor should be downgraded due to minimal narrowing
    expect(lowIR.permissionLevel).not.toBe('T2')
  })

  it('blocks external origin with internal state (no shortcut)', () => {
    const token: PatternToken = {
      id: 'test-shortcut',
      timestamp: Date.now(),
      rawContent: 'sneaky content',
      origin: externalOrigin,
      state: 'internal', // illegal! external cannot directly become internal
      physical: resolved('text'),
      level: resolved('L0_atom'),
      communication: resolved('bottom_up'),
    }

    const midIR = bind({ tokens: [token], edges: [], gates: [] })
    const lowIR = isConstitutionSatisfiedBy(midIR, {
      actor: 'T2',
      infoLevel: 'L1_objective_law',
    })

    const stateViolations = lowIR.violations.filter(v => v.ruleId === 'state_no_shortcut')
    expect(stateViolations.length).toBeGreaterThan(0)
    expect(stateViolations[0].severity).toBe('block')
  })

  it('reports failed value gates', () => {
    const tokens = scanBatch([makeInput('test')])
    const failingGate = makeGate('strict-gate', [
      { type: 'accuracy', current: 0.1, threshold: 0.9 },
    ], 'reject')

    const midIR = bind({ tokens, edges: [], gates: [failingGate] })
    const lowIR = isConstitutionSatisfiedBy(midIR, {
      actor: 'T2',
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
      actor: 'T2',
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
      actor: 'T2',
      infoLevel: 'L1_objective_law',
    })

    const output = emit({ lowIR, midIR, infoLevel: 'L1_objective_law' })
    expect(output.events.length).toBeGreaterThan(0)
    expect(output.events[0].mutationType).toBe('create')
    expect(['T0', 'T1', 'T2']).toContain(output.events[0].executor)
  })
})

// ── Full Pipeline ─────────────────────────────────────────────

describe('compile — full pipeline', () => {
  beforeEach(() => resetTokenCounter())

  it('compiles simple text input successfully', () => {
    const result = compile({
      inputs: [makeInput('This is a fact.')],
      actor: 'T2',
      infoLevel: 'L1_objective_law',
    })

    expect(result.success).toBe(true)
    expect(result.highIR).toBeDefined()
    expect(result.midIR).toBeDefined()
    expect(result.lowIR).toBeDefined()
    expect(result.events.length).toBeGreaterThan(0)
  })

  it('blocks unauthorized L2 gene creation by T0', () => {
    const result = compile({
      inputs: [{
        content: 'update constitution goals and evolution',
        origin: externalOrigin,
        hints: { level: 'L2_gene' },
      }],
      actor: 'T0',
      infoLevel: 'L1_objective_law',
    })

    // T0 cannot create L2_gene (requires T2)
    expect(result.success).toBe(false)
    expect(result.violations.some(v => v.severity === 'block')).toBe(true)
  })

  it('compiles with value gates', () => {
    const result = compile({
      inputs: [makeInput('execute task')],
      gates: [makeGate('quality-gate', [
        { type: 'binary', current: 0.95, threshold: 0.8 },
      ])],
      actor: 'T1',
      infoLevel: 'L1_objective_law',
    })

    expect(result.success).toBe(true)
  })

  it('rejects when value gate fails', () => {
    const result = compile({
      inputs: [makeInput('execute task')],
      gates: [makeGate('strict-gate', [
        { type: 'accuracy', current: 0.1, threshold: 0.9 },
      ], 'reject')],
      actor: 'T1',
      infoLevel: 'L1_objective_law',
    })

    expect(result.success).toBe(false)
  })

  it('handles code input end-to-end', () => {
    const result = compile({
      inputs: [{
        content: 'const validate = function(input) { if (!input) { return false; } return true; }',
        origin: { domain: 'internal', type: 'module_output' },
      }],
      actor: 'T2',
      infoLevel: 'L1_objective_law',
    })

    expect(result.success).toBe(true)
    expect(result.midIR?.tokens[0]).toBeDefined()
    const token = result.midIR!.tokens[0]
    if (isResolved(token.physical)) expect(token.physical.value).toBe('code')
    if (isResolved(token.level)) expect(token.level.value).toBe('L0_atom')
    expect(token.state).toBe('candidate') // internal → candidate
  })

  it('Chinese input compiles correctly', () => {
    const result = compile({
      inputs: [makeInput('用户登录失败超过5次就锁定。')],
      actor: 'T2',
      infoLevel: 'L1_objective_law',
    })

    expect(result.success).toBe(true)
    expect(result.highIR.rawContent).toBe('用户登录失败超过5次就锁定。')
  })

  it('external origin produces external state', () => {
    const result = compile({
      inputs: [makeInput('外部信息', { domain: 'external', type: 'sensor' })],
      actor: 'T2',
      infoLevel: 'L1_objective_law',
    })

    expect(result.success).toBe(true)
    expect(result.highIR.state).toBe('external')
    expect(result.highIR.origin.domain).toBe('external')
  })

  it('internal origin produces candidate state', () => {
    const result = compile({
      inputs: [{
        content: '内部模块输出',
        origin: { domain: 'internal', type: 'model_call' },
      }],
      actor: 'T2',
      infoLevel: 'L1_objective_law',
    })

    expect(result.success).toBe(true)
    expect(result.highIR.state).toBe('candidate')
  })
})

// ── quickCheck ────────────────────────────────────────────────

describe('quickCheck', () => {
  beforeEach(() => resetTokenCounter())

  it('allows any token for T2 actor', () => {
    const token = scan(makeInput('anything'))
    const result = quickCheck(token, 'T2')
    expect(result.allowed).toBe(true)
  })

  it('returns maxPermission based on narrowing', () => {
    const token = scan(makeInput('hello world.'))
    const result = quickCheck(token, 'T2')
    expect(result.maxPermission).toBeDefined()
  })

  it('rejects external origin with internal state', () => {
    const token: PatternToken = {
      id: 'test',
      timestamp: Date.now(),
      rawContent: 'hack',
      origin: externalOrigin,
      state: 'internal',
      physical: resolved('text'),
      level: resolved('L0_atom'),
      communication: resolved('bottom_up'),
    }
    const result = quickCheck(token, 'T2')
    expect(result.allowed).toBe(false)
  })
})
