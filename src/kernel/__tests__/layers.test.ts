/**
 * PRVSE Kernel — Constitution, Observer, Reality Protocol Tests
 *
 * Verifies the 4 non-negotiable invariants:
 *   1. Effects are pure descriptions (Observer purity)
 *   2. No effect influences same tick (one-beat delay)
 *   3. Reality Protocol is ordering function (deterministic)
 *   4. Constitution does combinatorial validation
 *
 * Plus: liveness, self-feedback loop, causal ordering.
 */

import { describe, it, expect } from 'vitest'
import {
  // State + Tick
  createState, addNode, addContract, tickWithSnapshot, tick,
  createPortBuffer, emptySnapshot,
  nodeId, contractId, versionId, portId,
  // Constitution
  validateContract, validateRegistry, defaultUniverseSpec,
  // Observer
  diffObserver, conflictObserver, logObserver,
  composeObservers, defaultObserver, applyTriggerEffects, filterEffects,
  // Reality
  createEpochManager, timestampOrdering, sourcePriorityOrdering, causalOrdering,
  // Types
  type Contract, type State, type Effect, type RealityEvent,
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
// CONSTITUTION
// ═══════════════════════════════════════════════════════════════

describe('Constitution', () => {
  const spec = defaultUniverseSpec()

  it('validates a well-formed contract', () => {
    const contract: Contract = {
      id: contractId('c1'),
      type: 'dynamic',
      priority: 1,
      participants: [nodeId('n1')],
      condition: () => true,
      emit: () => [],
    }
    const state = makeState({ id: 'n1' })
    const result = validateContract(contract, state, spec)
    expect(result.valid).toBe(true)
  })

  it('warns on exclusivity: same participants + same priority', () => {
    const existing: Contract = {
      id: contractId('c1'),
      type: 'dynamic',
      priority: 1,
      participants: [nodeId('n1'), nodeId('n2')],
      condition: () => true,
      emit: () => [],
    }
    const candidate: Contract = {
      id: contractId('c2'),
      type: 'dynamic',
      priority: 1,
      participants: [nodeId('n1'), nodeId('n2')],
      condition: () => true,
      emit: () => [],
    }

    let state = makeState({ id: 'n1' }, { id: 'n2' })
    state = addContract(state, existing)

    const result = validateContract(candidate, state, spec)
    const exclusivity = result.violations.filter(v => v.rule === 'exclusivity')
    expect(exclusivity.length).toBeGreaterThan(0)
  })

  it('warns on dependency: shared participants with equal priority', () => {
    const existing: Contract = {
      id: contractId('c1'),
      type: 'semantic',
      priority: 5,
      participants: [nodeId('n1')],
      condition: () => true,
      emit: () => [],
    }
    const candidate: Contract = {
      id: contractId('c2'),
      type: 'semantic',
      priority: 5,
      participants: [nodeId('n1')],
      condition: () => true,
      emit: () => [],
    }

    let state = makeState({ id: 'n1' })
    state = addContract(state, existing)

    const result = validateContract(candidate, state, spec)
    const deps = result.violations.filter(v => v.rule === 'dependency')
    expect(deps.length).toBeGreaterThan(0)
  })

  it('warns on scope: too many participants', () => {
    const contract: Contract = {
      id: contractId('wide'),
      type: 'dynamic',
      priority: 1,
      participants: [nodeId('n1'), nodeId('n2'), nodeId('n3'), nodeId('n4'), nodeId('n5')],
      condition: () => true,
      emit: () => [],
    }
    const state = makeState({ id: 'n1' })
    const result = validateContract(contract, state, spec)
    const scope = result.violations.filter(v => v.rule === 'scope')
    expect(scope.length).toBeGreaterThan(0)
  })

  it('warns on liveness: no dynamic contracts', () => {
    const contract: Contract = {
      id: contractId('static'),
      type: 'structural',
      priority: 1,
      participants: [nodeId('n1')],
      condition: () => true,
      emit: () => [],
    }
    const state = makeState({ id: 'n1' })
    const result = validateContract(contract, state, spec)
    const liveness = result.violations.filter(v => v.rule === 'liveness')
    expect(liveness.length).toBeGreaterThan(0)
  })

  it('no liveness warning when dynamic contract exists', () => {
    const existing: Contract = {
      id: contractId('clock'),
      type: 'dynamic',
      priority: 1,
      participants: [nodeId('n1')],
      condition: () => true,
      emit: () => [],
    }
    const candidate: Contract = {
      id: contractId('static'),
      type: 'structural',
      priority: 2,
      participants: [nodeId('n2')],
      condition: () => true,
      emit: () => [],
    }

    let state = makeState({ id: 'n1' }, { id: 'n2' })
    state = addContract(state, existing)

    const result = validateContract(candidate, state, spec)
    const liveness = result.violations.filter(v => v.rule === 'liveness')
    expect(liveness).toHaveLength(0)
  })

  it('validateRegistry checks all contracts combinatorially', () => {
    const c1: Contract = {
      id: contractId('c1'),
      type: 'semantic',
      priority: 1,
      participants: [nodeId('n1')],
      condition: () => true,
      emit: () => [],
    }
    const c2: Contract = {
      id: contractId('c2'),
      type: 'semantic',
      priority: 1,
      participants: [nodeId('n1')],
      condition: () => true,
      emit: () => [],
    }

    let state = makeState({ id: 'n1' })
    state = addContract(state, c1)
    state = addContract(state, c2)

    const result = validateRegistry(state, spec)
    expect(result.violations.length).toBeGreaterThan(0)
  })
})

// ═══════════════════════════════════════════════════════════════
// OBSERVER PROTOCOL
// ═══════════════════════════════════════════════════════════════

describe('Observer Protocol', () => {
  it('diffObserver detects value changes', () => {
    const prev = makeState({ id: 'n1', values: { x: 0, y: 10 } })
    const next = makeState({ id: 'n1', values: { x: 42, y: 10 } })
    // Manually set tick on next
    const nextWithTick = { ...next, tick: 1 }
    const result = { state: nextWithTick, rounds: 1, converged: true, conflicts: [], patchesApplied: 1 }

    const effects = diffObserver(prev, nextWithTick, result)
    const renders = effects.filter(e => e.type === 'render')

    expect(renders).toHaveLength(1)
    expect(renders[0].type).toBe('render')
    if (renders[0].type === 'render') {
      expect(renders[0].nodeId).toBe(nodeId('n1'))
      expect(renders[0].changes.get('x')).toEqual({ prev: 0, next: 42 })
      expect(renders[0].changes.has('y')).toBe(false) // unchanged
    }
  })

  it('diffObserver detects new nodes', () => {
    const prev = makeState()
    const next = makeState({ id: 'n1', values: { x: 1 } })
    const result = { state: next, rounds: 1, converged: true, conflicts: [], patchesApplied: 1 }

    const effects = diffObserver(prev, next, result)
    expect(effects.some(e => e.type === 'render' && e.nodeId === nodeId('n1'))).toBe(true)
  })

  it('diffObserver detects deleted nodes', () => {
    const prev = makeState({ id: 'n1', values: { x: 1 } })
    const next = makeState()
    const result = { state: next, rounds: 1, converged: true, conflicts: [], patchesApplied: 0 }

    const effects = diffObserver(prev, next, result)
    expect(effects.some(
      e => e.type === 'render' && e.nodeId === nodeId('n1'),
    )).toBe(true)
  })

  it('conflictObserver produces alerts for conflicts', () => {
    const state = makeState()
    const result = {
      state,
      rounds: 1,
      converged: true,
      conflicts: [{ type: 'conflict' as const, patches: [], reason: 'test conflict' }],
      patchesApplied: 0,
    }

    const effects = conflictObserver(state, state, result)
    expect(effects).toHaveLength(1)
    expect(effects[0].type).toBe('alert')
  })

  it('logObserver produces a log entry per tick', () => {
    const state = makeState()
    const next = { ...state, tick: 1 }
    const result = { state: next, rounds: 2, converged: true, conflicts: [], patchesApplied: 3 }

    const effects = logObserver(state, next, result)
    expect(effects).toHaveLength(1)
    expect(effects[0].type).toBe('log')
    if (effects[0].type === 'log') {
      expect(effects[0].entry.event).toBe('tick:converged')
    }
  })

  it('composeObservers concatenates effects from all observers', () => {
    const composed = composeObservers(diffObserver, logObserver)
    const prev = makeState({ id: 'n1', values: { x: 0 } })
    const next = makeState({ id: 'n1', values: { x: 1 } })
    const result = { state: next, rounds: 1, converged: true, conflicts: [], patchesApplied: 1 }

    const effects = composed(prev, next, result)
    expect(effects.some(e => e.type === 'render')).toBe(true)
    expect(effects.some(e => e.type === 'log')).toBe(true)
  })

  it('filterEffects extracts effects by type', () => {
    const effects: Effect[] = [
      { type: 'render', nodeId: nodeId('n1'), changes: new Map() },
      { type: 'log', entry: { tick: 1, event: 'test', data: null } },
      { type: 'trigger', portId: portId('p1'), value: 42 },
    ]

    const renders = filterEffects(effects, 'render')
    expect(renders).toHaveLength(1)
    expect(renders[0].nodeId).toBe(nodeId('n1'))

    const triggers = filterEffects(effects, 'trigger')
    expect(triggers).toHaveLength(1)
    expect(triggers[0].portId).toBe(portId('p1'))
  })

  it('applyTriggerEffects writes to PortBuffer (one-beat delay)', () => {
    const buffer = createPortBuffer()
    const effects: Effect[] = [
      { type: 'trigger', portId: portId('feedback'), value: 'hello' },
      { type: 'render', nodeId: nodeId('n1'), changes: new Map() },
    ]

    applyTriggerEffects(effects, buffer)

    // Value is in buffer but NOT yet in any snapshot
    const snap = buffer.freeze(1)
    expect(snap.ports.get(portId('feedback'))).toBe('hello')
  })

  it('self-feedback loop: observer trigger → next tick sees it', () => {
    // Contract: when 'go' signal present, set active=true (fires once, converges)
    const contract: Contract = {
      id: contractId('activator'),
      type: 'dynamic',
      priority: 1,
      participants: [nodeId('n1')],
      condition: (view, env) =>
        env.ports.get(portId('go')) === true &&
        view.getValue(nodeId('n1'), 'active') !== true,
      emit: () => [
        { op: 'set' as const, target: nodeId('n1'), path: ['active'], value: true, priority: 1 },
      ],
    }

    // Second contract: when active, set level to snapshot's 'level' value
    const contract2: Contract = {
      id: contractId('level-setter'),
      type: 'dynamic',
      priority: 1,
      participants: [nodeId('n1')],
      condition: (view, env) =>
        view.getValue(nodeId('n1'), 'active') === true &&
        env.ports.get(portId('level')) !== undefined &&
        view.getValue(nodeId('n1'), 'level') !== env.ports.get(portId('level')),
      emit: (_view, env) => [
        { op: 'set' as const, target: nodeId('n1'), path: ['level'], value: env.ports.get(portId('level'))!, priority: 1 },
      ],
    }

    let state = makeState({ id: 'n1', values: { active: false, level: 0 } })
    state = addContract(state, contract)
    state = addContract(state, contract2)
    const buffer = createPortBuffer()

    // Tick 1: activate
    buffer.write(portId('go'), true)
    const result1 = tick(state, buffer)
    expect(result1.state.nodes.get(nodeId('n1'))?.values.get('active')).toBe(true)
    expect(result1.converged).toBe(true)

    // Observer sees the change, produces trigger for next tick
    const effects = defaultObserver(state, result1.state, result1)
    expect(effects.some(e => e.type === 'render')).toBe(true)

    // Simulate self-feedback: observer triggers 'level' for next tick
    applyTriggerEffects(
      [{ type: 'trigger', portId: portId('level'), value: 42 }],
      buffer,
    )

    // Tick 2: level-setter fires because active=true and level port is present
    const result2 = tick(result1.state, buffer)
    expect(result2.state.nodes.get(nodeId('n1'))?.values.get('level')).toBe(42)
    expect(result2.converged).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════
// REALITY PROTOCOL
// ═══════════════════════════════════════════════════════════════

describe('Reality Protocol', () => {
  const spec = defaultUniverseSpec()

  describe('Epoch Manager', () => {
    it('collects events and freezes into snapshot', () => {
      const manager = createEpochManager(timestampOrdering, spec)
      manager.open()

      manager.submit({
        portId: portId('temp'),
        value: 36.5,
        externalTimestamp: 1000,
        source: 'sensor',
      })

      manager.close()
      const snap = manager.freeze(1)

      expect(snap.tick).toBe(1)
      expect(snap.ports.get(portId('temp'))).toBe(36.5)
      expect(snap.epoch).toBe(1)
      expect(snap.completeness).toBe('full')
    })

    it('rejects events after epoch is closed', () => {
      const manager = createEpochManager(timestampOrdering, spec)
      manager.open()
      manager.close()

      const accepted = manager.submit({
        portId: portId('late'),
        value: 'too late',
        externalTimestamp: 2000,
        source: 'human',
      })

      expect(accepted).toBe(false)
    })

    it('reports partial snapshot when required ports are missing', () => {
      const specWithRequired = {
        ...spec,
        requiredPorts: [portId('essential')],
      }
      const manager = createEpochManager(timestampOrdering, specWithRequired)
      manager.open()
      // Don't submit 'essential' port
      manager.close()
      const snap = manager.freeze(1)

      expect(snap.completeness).toBe('partial')
      expect(snap.missingPorts).toContain(portId('essential'))
    })

    it('fills missing required ports with last known values', () => {
      const specWithRequired = {
        ...spec,
        requiredPorts: [portId('persistent')],
      }
      const manager = createEpochManager(timestampOrdering, specWithRequired)

      // Epoch 1: submit the required port
      manager.open()
      manager.submit({
        portId: portId('persistent'),
        value: 'remembered',
        externalTimestamp: 1000,
        source: 'sensor',
      })
      manager.close()
      manager.freeze(1)

      // Epoch 2: DON'T submit — should use last known value
      manager.open()
      manager.close()
      const snap2 = manager.freeze(2)

      expect(snap2.ports.get(portId('persistent'))).toBe('remembered')
      expect(snap2.completeness).toBe('full') // filled from last known
    })
  })

  describe('Ordering Functions', () => {
    it('timestampOrdering sorts by external time', () => {
      const events: RealityEvent[] = [
        { portId: portId('b'), value: 2, externalTimestamp: 200, source: 'sensor' },
        { portId: portId('a'), value: 1, externalTimestamp: 100, source: 'sensor' },
        { portId: portId('c'), value: 3, externalTimestamp: 300, source: 'sensor' },
      ]

      const ordered = timestampOrdering(events)
      expect(ordered[0].portId).toBe(portId('a'))
      expect(ordered[1].portId).toBe(portId('b'))
      expect(ordered[2].portId).toBe(portId('c'))
    })

    it('timestampOrdering is deterministic with same timestamp', () => {
      const events: RealityEvent[] = [
        { portId: portId('x'), value: 1, externalTimestamp: 100, source: 'beta' },
        { portId: portId('y'), value: 2, externalTimestamp: 100, source: 'alpha' },
      ]

      const ordered1 = timestampOrdering(events)
      const ordered2 = timestampOrdering([...events].reverse())

      // Same order regardless of input order
      expect(ordered1[0].source).toBe(ordered2[0].source)
    })

    it('sourcePriorityOrdering respects source hierarchy', () => {
      const events: RealityEvent[] = [
        { portId: portId('a'), value: 'sensor-says', externalTimestamp: 100, source: 'sensor' },
        { portId: portId('b'), value: 'human-says', externalTimestamp: 200, source: 'human' },
      ]

      const ordering = sourcePriorityOrdering({ human: 10, sensor: 1 })
      const ordered = ordering(events)

      expect(ordered[0].source).toBe('human') // higher priority first
    })

    it('causalOrdering respects dependencies', () => {
      // 'decision' depends on 'perception' — perception must come first
      const causalGraph = new Map([
        [portId('decision'), [portId('perception')]],
      ])

      const events: RealityEvent[] = [
        { portId: portId('decision'), value: 'go', externalTimestamp: 50, source: 'ai' },
        { portId: portId('perception'), value: 'clear', externalTimestamp: 100, source: 'sensor' },
      ]

      const ordering = causalOrdering(causalGraph)
      const ordered = ordering(events)

      // perception first despite later timestamp — causal dependency
      expect(ordered[0].portId).toBe(portId('perception'))
      expect(ordered[1].portId).toBe(portId('decision'))
    })

    it('causalOrdering falls back to timestamp when no dependency', () => {
      const causalGraph = new Map<ReturnType<typeof portId>, readonly ReturnType<typeof portId>[]>()

      const events: RealityEvent[] = [
        { portId: portId('b'), value: 2, externalTimestamp: 200, source: 'sensor' },
        { portId: portId('a'), value: 1, externalTimestamp: 100, source: 'sensor' },
      ]

      const ordering = causalOrdering(causalGraph)
      const ordered = ordering(events)

      expect(ordered[0].portId).toBe(portId('a')) // earlier timestamp
    })
  })

  describe('Integration: Reality → Kernel → Observer loop', () => {
    it('full cycle: epoch → snapshot → tick → observe → trigger → next epoch', () => {
      // Setup
      const manager = createEpochManager(timestampOrdering, spec)
      const buffer = createPortBuffer()

      const contract: Contract = {
        id: contractId('reactor'),
        type: 'dynamic',
        priority: 1,
        participants: [nodeId('n1')],
        condition: (view, env) => {
          const signal = env.ports.get(portId('signal'))
          const alreadyActive = view.getValue(nodeId('n1'), 'active')
          return signal === 'activate' && alreadyActive !== true
        },
        emit: () => [
          { op: 'set' as const, target: nodeId('n1'), path: ['active'], value: true, priority: 1 },
        ],
      }

      let state = makeState({ id: 'n1', values: { active: false } })
      state = addContract(state, contract)

      // Epoch 1: human sends "activate"
      manager.open()
      manager.submit({
        portId: portId('signal'),
        value: 'activate',
        externalTimestamp: Date.now(),
        source: 'human',
      })
      manager.close()
      const realitySnap = manager.freeze(1)

      // Feed reality snapshot into kernel (via port buffer for compatibility)
      // In practice, Runtime Interpreter bridges this
      for (const [pid, val] of Array.from(realitySnap.ports)) {
        buffer.write(pid, val)
      }

      // Tick
      const result = tick(state, buffer)
      expect(result.state.nodes.get(nodeId('n1'))?.values.get('active')).toBe(true)
      expect(result.converged).toBe(true)

      // Observer
      const effects = defaultObserver(state, result.state, result)

      // Should have render (active changed), log (tick summary)
      expect(effects.some(e => e.type === 'render')).toBe(true)
      expect(effects.some(e => e.type === 'log')).toBe(true)

      // No trigger effects in this case — but the mechanism works
      const triggers = filterEffects(effects, 'trigger')
      expect(triggers).toHaveLength(0)
    })
  })
})
