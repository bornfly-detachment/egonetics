/**
 * PRVSE Kernel — Tick Executor Tests
 *
 * Verifies the three formal properties:
 *   1. Contract condition purity (Snapshot freeze)
 *   2. Patch algebra (merge determinism, associativity, idempotency)
 *   3. Convergence (fixed-point termination)
 */

import { describe, it, expect } from 'vitest'
import {
  createState, addNode, addContract,
  createPortBuffer, emptySnapshot, readPort,
  tickWithSnapshot, tick,
  mergePatches, mergeTwoPatches, applyPatches,
  nodeId, contractId, versionId, portId,
  type Contract, type Patch, type State, type Snapshot,
} from '../index'

// ── Helpers ──────────────────────────────────────────────────

function makeState(...nodes: Array<{ id: string; values?: Record<string, unknown> }>): State {
  let state = createState(0)
  for (const n of nodes) {
    const vals = new Map(Object.entries(n.values ?? {}))
    state = addNode(state, nodeId(n.id), versionId('v1'), vals)
  }
  return state
}

// ═══════════════════════════════════════════════════════════════
// 1. SNAPSHOT FREEZE PROTOCOL
// ═══════════════════════════════════════════════════════════════

describe('Snapshot Freeze Protocol', () => {
  it('freezes port buffer into immutable snapshot', () => {
    const buffer = createPortBuffer()
    buffer.write(portId('temperature'), 36.5)
    buffer.write(portId('mood'), 'calm')

    const snap = buffer.freeze(1)

    expect(snap.tick).toBe(1)
    expect(snap.ports.get(portId('temperature'))).toBe(36.5)
    expect(snap.ports.get(portId('mood'))).toBe('calm')
  })

  it('clears buffer after freeze (writes go to next tick)', () => {
    const buffer = createPortBuffer()
    buffer.write(portId('x'), 1)
    buffer.freeze(1)

    // Buffer should be empty after freeze
    const snap2 = buffer.freeze(2)
    expect(snap2.ports.size).toBe(0)
  })

  it('readPort returns fallback when port missing', () => {
    const snap = emptySnapshot(0)
    expect(readPort(snap, portId('missing'))).toBeUndefined()
    expect(readPort(snap, portId('missing'), 42)).toBe(42)
  })

  it('contract condition only sees frozen snapshot, not live buffer', () => {
    const buffer = createPortBuffer()
    buffer.write(portId('signal'), 'go')

    const snap = buffer.freeze(1)

    // Write to buffer AFTER freeze — contract should NOT see this
    buffer.write(portId('signal'), 'stop')

    // Contract reads from snapshot
    expect(snap.ports.get(portId('signal'))).toBe('go') // frozen value
  })
})

// ═══════════════════════════════════════════════════════════════
// 2. PATCH ALGEBRA
// ═══════════════════════════════════════════════════════════════

describe('Patch Algebra', () => {
  describe('merge determinism', () => {
    it('same-key set+set with different priority → higher wins', () => {
      const a: Patch = { op: 'set', target: nodeId('n1'), path: ['x'], value: 10, priority: 1 }
      const b: Patch = { op: 'set', target: nodeId('n1'), path: ['x'], value: 20, priority: 2 }

      const result = mergeTwoPatches(a, b)
      expect(result).toEqual(b) // higher priority
    })

    it('same-key set+set with equal priority, same value → idempotent', () => {
      const a: Patch = { op: 'set', target: nodeId('n1'), path: ['x'], value: 10, priority: 1 }
      const result = mergeTwoPatches(a, a)
      expect(result).toEqual(a)
    })

    it('same-key set+set with equal priority, different value → conflict', () => {
      const a: Patch = { op: 'set', target: nodeId('n1'), path: ['x'], value: 10, priority: 1 }
      const b: Patch = { op: 'set', target: nodeId('n1'), path: ['x'], value: 20, priority: 1 }

      const result = mergeTwoPatches(a, b)
      expect('type' in result && result.type).toBe('conflict')
    })

    it('delete + delete → idempotent', () => {
      const a: Patch = { op: 'delete', target: nodeId('n1'), path: ['x'], priority: 1 }
      const result = mergeTwoPatches(a, a)
      expect(result).toEqual(a)
    })
  })

  describe('merge strategies', () => {
    it('numeric.sum composes additively', () => {
      const a: Patch = { op: 'merge', target: nodeId('n1'), path: ['score'], strategy: 'numeric.sum', value: 5, priority: 1 }
      const b: Patch = { op: 'merge', target: nodeId('n1'), path: ['score'], strategy: 'numeric.sum', value: 3, priority: 1 }

      const result = mergeTwoPatches(a, b)
      expect(result).toEqual({
        op: 'merge',
        target: nodeId('n1'),
        path: ['score'],
        strategy: 'numeric.sum',
        value: 8,
        priority: 1,
      })
    })

    it('numeric.max takes maximum', () => {
      const a: Patch = { op: 'merge', target: nodeId('n1'), path: ['score'], strategy: 'numeric.max', value: 5, priority: 1 }
      const b: Patch = { op: 'merge', target: nodeId('n1'), path: ['score'], strategy: 'numeric.max', value: 3, priority: 1 }

      const result = mergeTwoPatches(a, b) as Patch
      expect('value' in result && result.value).toBe(5)
    })

    it('set.union merges arrays', () => {
      const a: Patch = { op: 'merge', target: nodeId('n1'), path: ['tags'], strategy: 'set.union', value: ['a', 'b'], priority: 1 }
      const b: Patch = { op: 'merge', target: nodeId('n1'), path: ['tags'], strategy: 'set.union', value: ['b', 'c'], priority: 1 }

      const result = mergeTwoPatches(a, b) as Patch
      expect('value' in result && result.value).toEqual(['a', 'b', 'c'])
    })

    it('incompatible strategies → conflict', () => {
      const a: Patch = { op: 'merge', target: nodeId('n1'), path: ['x'], strategy: 'numeric.sum', value: 5, priority: 1 }
      const b: Patch = { op: 'merge', target: nodeId('n1'), path: ['x'], strategy: 'numeric.max', value: 3, priority: 1 }

      const result = mergeTwoPatches(a, b)
      expect('type' in result && result.type).toBe('conflict')
    })
  })

  describe('batch merge', () => {
    it('merges independent patches without conflict', () => {
      const patches: Patch[] = [
        { op: 'set', target: nodeId('n1'), path: ['x'], value: 10, priority: 1 },
        { op: 'set', target: nodeId('n2'), path: ['y'], value: 20, priority: 1 },
      ]
      const { resolved, conflicts } = mergePatches(patches)
      expect(resolved).toHaveLength(2)
      expect(conflicts).toHaveLength(0)
    })

    it('merges conflicting patches and reports conflicts', () => {
      const patches: Patch[] = [
        { op: 'set', target: nodeId('n1'), path: ['x'], value: 10, priority: 1 },
        { op: 'set', target: nodeId('n1'), path: ['x'], value: 20, priority: 1 },
      ]
      const { resolved, conflicts } = mergePatches(patches)
      expect(resolved).toHaveLength(0)
      expect(conflicts).toHaveLength(1)
    })
  })

  describe('apply patches', () => {
    it('set creates/updates a value', () => {
      const state = makeState({ id: 'n1', values: { x: 0 } })
      const patched = applyPatches(state, [
        { op: 'set', target: nodeId('n1'), path: ['x'], value: 42, priority: 1 },
      ])
      expect(patched.nodes.get(nodeId('n1'))?.values.get('x')).toBe(42)
    })

    it('delete removes a value', () => {
      const state = makeState({ id: 'n1', values: { x: 10, y: 20 } })
      const patched = applyPatches(state, [
        { op: 'delete', target: nodeId('n1'), path: ['x'], priority: 1 },
      ])
      expect(patched.nodes.get(nodeId('n1'))?.values.has('x')).toBe(false)
      expect(patched.nodes.get(nodeId('n1'))?.values.get('y')).toBe(20)
    })

    it('merge applies strategy to existing value', () => {
      const state = makeState({ id: 'n1', values: { score: 10 } })
      const patched = applyPatches(state, [
        { op: 'merge', target: nodeId('n1'), path: ['score'], strategy: 'numeric.sum', value: 5, priority: 1 },
      ])
      expect(patched.nodes.get(nodeId('n1'))?.values.get('score')).toBe(15)
    })

    it('does not mutate original state', () => {
      const state = makeState({ id: 'n1', values: { x: 0 } })
      applyPatches(state, [
        { op: 'set', target: nodeId('n1'), path: ['x'], value: 99, priority: 1 },
      ])
      // Original unchanged
      expect(state.nodes.get(nodeId('n1'))?.values.get('x')).toBe(0)
    })
  })
})

// ═══════════════════════════════════════════════════════════════
// 3. TICK CONVERGENCE
// ═══════════════════════════════════════════════════════════════

describe('Tick Convergence', () => {
  it('converges immediately when no contracts fire', () => {
    const state = makeState({ id: 'n1', values: { x: 0 } })
    const snap = emptySnapshot(1)

    const result = tickWithSnapshot(state, snap)

    expect(result.converged).toBe(true)
    expect(result.rounds).toBe(1)
    expect(result.state.tick).toBe(1) // advanced
  })

  it('converges after one round when contract fires once', () => {
    // Contract: if x < 10, set x = 10
    const contract: Contract = {
      id: contractId('c1'),
      type: 'dynamic',
      priority: 1,
      participants: [nodeId('n1')],
      condition: (view) => {
        const x = view.getValue(nodeId('n1'), 'x') as number | undefined
        return x !== undefined && x < 10
      },
      emit: () => [
        { op: 'set' as const, target: nodeId('n1'), path: ['x'], value: 10, priority: 1 },
      ],
    }

    let state = makeState({ id: 'n1', values: { x: 0 } })
    state = addContract(state, contract)

    const result = tickWithSnapshot(state, emptySnapshot(1))

    expect(result.converged).toBe(true)
    expect(result.rounds).toBe(2) // round 1: fires, round 2: no-op → converge
    expect(result.state.nodes.get(nodeId('n1'))?.values.get('x')).toBe(10)
  })

  it('converges with multiple interacting contracts', () => {
    // Contract A: if x < 5, add 1 to x
    const contractA: Contract = {
      id: contractId('cA'),
      type: 'dynamic',
      priority: 2,
      participants: [nodeId('n1')],
      condition: (view) => (view.getValue(nodeId('n1'), 'x') as number) < 5,
      emit: (view) => {
        const x = view.getValue(nodeId('n1'), 'x') as number
        return [{ op: 'set' as const, target: nodeId('n1'), path: ['x'], value: x + 1, priority: 2 }]
      },
    }
    // Contract B: if x >= 3, set ready = true
    const contractB: Contract = {
      id: contractId('cB'),
      type: 'semantic',
      priority: 1,
      participants: [nodeId('n1')],
      condition: (view) => {
        const x = view.getValue(nodeId('n1'), 'x') as number
        const ready = view.getValue(nodeId('n1'), 'ready') as boolean | undefined
        return x >= 3 && !ready
      },
      emit: () => [
        { op: 'set' as const, target: nodeId('n1'), path: ['ready'], value: true, priority: 1 },
      ],
    }

    let state = makeState({ id: 'n1', values: { x: 0, ready: false } })
    state = addContract(state, contractA)
    state = addContract(state, contractB)

    const result = tickWithSnapshot(state, emptySnapshot(1))

    expect(result.converged).toBe(true)
    expect(result.state.nodes.get(nodeId('n1'))?.values.get('x')).toBe(5)
    expect(result.state.nodes.get(nodeId('n1'))?.values.get('ready')).toBe(true)
  })

  it('detects non-convergence (oscillating contracts)', () => {
    // Contract: toggle x between 0 and 1 — will never converge
    const contract: Contract = {
      id: contractId('oscillator'),
      type: 'dynamic',
      priority: 1,
      participants: [nodeId('n1')],
      condition: () => true, // always fires
      emit: (view) => {
        const x = view.getValue(nodeId('n1'), 'x') as number
        return [{ op: 'set' as const, target: nodeId('n1'), path: ['x'], value: x === 0 ? 1 : 0, priority: 1 }]
      },
    }

    let state = makeState({ id: 'n1', values: { x: 0 } })
    state = addContract(state, contract)

    const result = tickWithSnapshot(state, emptySnapshot(1))

    expect(result.converged).toBe(false)
    expect(result.conflicts.some(c => c.reason.includes('converge'))).toBe(true)
  })

  it('reports conflicts from patch merge to E-layer', () => {
    // Two contracts writing different values to same field, same priority
    const c1: Contract = {
      id: contractId('c1'),
      type: 'dynamic',
      priority: 1,
      participants: [nodeId('n1')],
      condition: (view) => view.getValue(nodeId('n1'), 'x') === 0,
      emit: () => [{ op: 'set' as const, target: nodeId('n1'), path: ['x'], value: 10, priority: 1 }],
    }
    const c2: Contract = {
      id: contractId('c2'),
      type: 'dynamic',
      priority: 1,
      participants: [nodeId('n1')],
      condition: (view) => view.getValue(nodeId('n1'), 'x') === 0,
      emit: () => [{ op: 'set' as const, target: nodeId('n1'), path: ['x'], value: 20, priority: 1 }],
    }

    let state = makeState({ id: 'n1', values: { x: 0 } })
    state = addContract(state, c1)
    state = addContract(state, c2)

    const result = tickWithSnapshot(state, emptySnapshot(1))
    expect(result.conflicts.length).toBeGreaterThan(0)
  })

  it('uses snapshot for external input in contract condition', () => {
    // Contract fires only when external signal says "go"
    const contract: Contract = {
      id: contractId('signal-gate'),
      type: 'semantic',
      priority: 1,
      participants: [nodeId('n1')],
      condition: (_view, env) => env.ports.get(portId('signal')) === 'go',
      emit: () => [
        { op: 'set' as const, target: nodeId('n1'), path: ['activated'], value: true, priority: 1 },
      ],
    }

    let state = makeState({ id: 'n1', values: { activated: false } })
    state = addContract(state, contract)

    // Tick without signal → should NOT fire
    const result1 = tickWithSnapshot(state, emptySnapshot(1))
    expect(result1.state.nodes.get(nodeId('n1'))?.values.get('activated')).toBe(false)

    // Tick with signal → should fire
    const buffer = createPortBuffer()
    buffer.write(portId('signal'), 'go')
    const result2 = tick(result1.state, buffer)
    expect(result2.state.nodes.get(nodeId('n1'))?.values.get('activated')).toBe(true)
  })

  it('tick advances tick counter', () => {
    const state = makeState({ id: 'n1' })
    const result = tickWithSnapshot(state, emptySnapshot(1))
    expect(result.state.tick).toBe(1)
  })
})
