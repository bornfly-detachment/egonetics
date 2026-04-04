/**
 * Runtime — The bridge between Kernel and the outside world
 *
 * This is the Runtime Interpreter layer.
 * It orchestrates: Reality → Kernel → Observer → Selection → back to Reality
 *
 * The runtime is NOT pure — it manages time, executes effects, and mutates PortBuffer.
 * But it calls only pure kernel functions internally.
 *
 * Usage:
 *   const rt = createRuntime(spec)
 *   rt.addNode(...)
 *   rt.registerContract(...)
 *   rt.writePort(...)
 *   const result = rt.tick()
 *   // result.effects → for UI rendering
 *   // result.tickResult → for diagnostics
 *   // result.selectionActions → for evolution display
 */

import type {
  NodeId, ContractId, VersionId, PortId,
  Contract, State, Snapshot, TickResult,
  Effect, UniverseSpec, Frozen,
  ConstitutionResult, HookRegistry,
} from './types'
import { nodeId, versionId } from './types'
import { createState, addNode, addContract, removeContract, advanceTick } from './state'
import { createPortBuffer } from './snapshot'
import { tick as kernelTick, tickWithSnapshot } from './tick'
import type { ObserverFn } from './types'
import { defaultObserver, applyTriggerEffects, filterEffects } from './observer'
import { validateContract, defaultUniverseSpec } from './constitution'
import {
  createFitnessTracker,
  selectContracts,
  applySelectionActions,
  defaultSelectionPolicy,
  type SelectionAction, type SelectionPolicy, type FitnessRates,
} from './selection'
import { createCandidate, submitCandidate, type CandidateResult, type CandidateSource } from './candidate'

// ── Runtime Types ──────────────────────────────────────────────

export interface RuntimeTickResult {
  readonly tickResult: TickResult
  readonly effects: readonly Effect[]
  readonly selectionActions: readonly SelectionAction[]
  readonly fitnessRates: readonly FitnessRates[]
  readonly prevState: State
  readonly nextState: State
}

export interface RuntimeConfig {
  readonly spec: UniverseSpec
  readonly selectionPolicy: SelectionPolicy
  readonly observer: ObserverFn
  /** Run selection every N ticks (0 = disabled) */
  readonly selectionInterval: number
  /** Pre-patch constitutional hooks — applied before every applyPatches() call */
  readonly hooks?: HookRegistry
  /** Number of past States to retain for rollback (default: 10) */
  readonly historySize?: number
}

export interface Runtime {
  // ── State access ──
  readonly state: State
  readonly tickCount: number
  readonly config: RuntimeConfig

  // ── Node management ──
  addNode(id: string, values?: Record<string, unknown>): void
  removeNode(id: string): void
  setNodeValue(nodeId: string, field: string, value: unknown): void

  // ── Contract management ──
  registerContract(contract: Contract, source?: CandidateSource): CandidateResult
  unregisterContract(id: ContractId): void

  // ── Port (external input) ──
  writePort(port: PortId, value: Frozen): void

  // ── Execution ──
  tick(): RuntimeTickResult
  runTicks(count: number): readonly RuntimeTickResult[]

  // ── Inspection ──
  getFitnessRates(): readonly FitnessRates[]
  getConstitutionCheck(contract: Contract): ConstitutionResult
}

// ── Runtime Factory ────────────────────────────────────────────

export function createRuntime(config?: Partial<RuntimeConfig>): Runtime {
  const cfg: RuntimeConfig = {
    spec: config?.spec ?? defaultUniverseSpec(),
    selectionPolicy: config?.selectionPolicy ?? defaultSelectionPolicy(),
    observer: config?.observer ?? defaultObserver,
    selectionInterval: config?.selectionInterval ?? 20,
  }

  let state = createState(0)
  const buffer = createPortBuffer()
  const tracker = createFitnessTracker()
  let tickCount = 0

  return {
    get state() { return state },
    get tickCount() { return tickCount },
    get config() { return cfg },

    // ── Node management ──

    addNode(id: string, values?: Record<string, unknown>) {
      const vals = values ? new Map(Object.entries(values)) : new Map()
      state = addNode(state, nodeId(id), versionId('v1'), vals)
    },

    removeNode(id: string) {
      const nodes = new Map(state.nodes)
      nodes.delete(nodeId(id))
      state = { ...state, nodes }
    },

    setNodeValue(nid: string, field: string, value: unknown) {
      const node = state.nodes.get(nodeId(nid))
      if (!node) return
      const newValues = new Map(node.values)
      newValues.set(field, value as Frozen)
      const nodes = new Map(state.nodes)
      nodes.set(nodeId(nid), { ...node, values: newValues })
      state = { ...state, nodes }
    },

    // ── Contract management ──

    registerContract(contract: Contract, source: CandidateSource = 'human'): CandidateResult {
      const candidate = createCandidate(source, contract, 0)
      const result = submitCandidate(candidate, state, cfg.spec)
      if (result.accepted) {
        state = addContract(state, contract)
      }
      return result
    },

    unregisterContract(id: ContractId) {
      state = removeContract(state, id)
      tracker.reset(id)
    },

    // ── Port ──

    writePort(port: PortId, value: Frozen) {
      buffer.write(port, value)
    },

    // ── Execution ──

    tick(): RuntimeTickResult {
      const prevState = state
      const tickResult = kernelTick(state, buffer, cfg.hooks)
      const nextState = tickResult.state

      // Observer: pure diff → effects
      const effects = cfg.observer(prevState, nextState, tickResult)

      // Apply trigger effects to port buffer (for next tick)
      applyTriggerEffects(effects, buffer)

      // Track fitness
      tracker.recordTick(prevState, nextState, tickResult)
      tickCount++

      // Selection: periodic evolutionary pressure
      let selectionActions: readonly SelectionAction[] = []
      let postSelectionState = nextState

      if (cfg.selectionInterval > 0 && tickCount % cfg.selectionInterval === 0) {
        const rates = tracker.getRates()
        selectionActions = selectContracts(rates, cfg.selectionPolicy)
        postSelectionState = applySelectionActions(nextState, selectionActions)
      }

      state = postSelectionState

      return {
        tickResult,
        effects,
        selectionActions,
        fitnessRates: tracker.getRates(),
        prevState,
        nextState: postSelectionState,
      }
    },

    runTicks(count: number): readonly RuntimeTickResult[] {
      const results: RuntimeTickResult[] = []
      for (let i = 0; i < count; i++) {
        results.push(this.tick())
      }
      return results
    },

    // ── Inspection ──

    getFitnessRates(): readonly FitnessRates[] {
      return tracker.getRates()
    },

    getConstitutionCheck(contract: Contract): ConstitutionResult {
      return validateContract(contract, state, cfg.spec)
    },
  }
}
