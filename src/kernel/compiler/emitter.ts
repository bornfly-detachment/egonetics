/**
 * PRVSE Compiler — Emitter (Codegen)
 *
 * Equivalent to TypeScript's emitter.ts.
 * Takes checked LowIR and produces kernel-executable output:
 *   - StateInstructions → kernel Patch[]
 *   - EvolutionEvents → kernel Effect[]
 *
 * This is the bridge from compiler world → kernel world.
 * After this stage, the kernel's tick executor takes over.
 */

import type {
  Patch,
  PatchSet,
  Effect,
  LogEffect,
  TriggerEffect,
  Frozen,
} from '../types'

import { nodeId, portId } from '../types'

import type {
  LowIR,
  StateInstruction,
  EvolutionEvent,
  MidIR,
  PermissionTier,
  InfoLevel,
  CommLevel,
  ResourceTier,
} from './types'

// ── StateInstruction → Patch[] ────────────────────────────────

/**
 * Convert a state instruction to kernel patches.
 * Each instruction becomes a set patch on the target node's state field.
 */
function instructionToPatches(instruction: StateInstruction): readonly Patch[] {
  const patches: PatchSet[] = []

  // State transition patch
  patches.push({
    op: 'set',
    target: nodeId(`s-${instruction.source}`),
    path: ['state'],
    value: instruction.targetState as Frozen,
    priority: LEVEL_PRIORITY[instruction.level],
  })

  // Record the transition trigger
  patches.push({
    op: 'set',
    target: nodeId(`s-${instruction.source}`),
    path: ['lastTransition'],
    value: {
      from: instruction.currentState,
      to: instruction.targetState,
      timestamp: Date.now(),
    } as Frozen,
    priority: LEVEL_PRIORITY[instruction.level],
  })

  return patches
}

const LEVEL_PRIORITY: Record<string, number> = {
  L0: 10,
  L1: 20,
  L2: 30,
}

// ── StateInstruction → Effect[] ───────────────────────────────

/**
 * Convert state instruction effects to kernel effects.
 * Each S_Effect becomes a TriggerEffect (writes to port buffer for next tick).
 */
function instructionToEffects(instruction: StateInstruction): readonly Effect[] {
  const effects: Effect[] = []

  for (const effect of instruction.effects) {
    const trigger: TriggerEffect = {
      type: 'trigger',
      portId: portId(`effect-${effect}`),
      value: {
        source: instruction.source,
        fromState: instruction.currentState,
        toState: instruction.targetState,
        timestamp: Date.now(),
      } as Frozen,
    }
    effects.push(trigger)
  }

  return effects
}

// ── EvolutionEvent → Effect[] ─────────────────────────────────

/**
 * Convert an evolution event to kernel effects.
 * Evolution events always produce a log effect (audit trail)
 * plus trigger effects for cascading.
 */
function evolutionToEffects(event: EvolutionEvent): readonly Effect[] {
  const effects: Effect[] = []

  // Always log (chronicle audit trail)
  const log: LogEffect = {
    type: 'log',
    entry: {
      tick: 0, // filled by kernel at runtime
      event: `evolution:${event.mutationType}`,
      data: {
        id: event.id,
        actor: event.actor,
        executor: event.executor,
        infoLevel: event.infoLevel,
        commLevel: event.commLevel,
        affectedNodes: event.affectedNodes,
        diff: event.diff,
      } as Frozen,
    },
  }
  effects.push(log)

  // Trigger cascading effects for affected nodes
  for (const affected of event.affectedNodes) {
    const trigger: TriggerEffect = {
      type: 'trigger',
      portId: portId(`evolution-${affected}`),
      value: {
        eventId: event.id,
        mutationType: event.mutationType,
        timestamp: event.timestamp,
      } as Frozen,
    }
    effects.push(trigger)
  }

  return effects
}

// ── Resource Tier Resolution ──────────────────────────────────

/**
 * Determine which resource tier should execute, based on
 * permission level and info level.
 */
function resolveResourceTier(
  permission: PermissionTier,
  infoLevel: InfoLevel,
): ResourceTier {
  // L0 signal → always T0 (fast, local)
  if (infoLevel === 'L0_signal') return 'T0'

  // Map permission to resource
  switch (permission) {
    case 'T0': return 'T0'
    case 'T1': return 'T1'
    case 'T2':
    case 'T3': return 'T2'
  }
}

/**
 * Determine communication level from the operation type.
 */
function resolveCommLevel(lowIR: LowIR): CommLevel {
  const hasBlocks = lowIR.violations.some(v => v.severity === 'block')
  if (hasBlocks) return 'L2_control' // blocked operations are critical

  const hasStructuralChange = lowIR.instructions.some(
    i => i.level === 'L2',
  )
  if (hasStructuralChange) return 'L1_request'

  return 'L0_descriptive'
}

// ── Main Emitter ──────────────────────────────────────────────

export interface EmitterInput {
  readonly lowIR: LowIR
  readonly midIR: MidIR
  readonly infoLevel: InfoLevel
}

export interface EmitterOutput {
  readonly patches: readonly Patch[]
  readonly effects: readonly Effect[]
  readonly events: readonly EvolutionEvent[]
}

/**
 * emit() — the main emitter function.
 *
 * Takes checked LowIR + MidIR context, produces:
 *   - Kernel patches (state mutations)
 *   - Kernel effects (side-effect descriptions)
 *   - Evolution events (audit records)
 */
export function emit(input: EmitterInput): EmitterOutput {
  const { lowIR, midIR, infoLevel } = input

  // If blocked, emit nothing except violations as log effects
  if (lowIR.violations.some(v => v.severity === 'block')) {
    const blockLog: LogEffect = {
      type: 'log',
      entry: {
        tick: 0,
        event: 'compilation:blocked',
        data: {
          violations: lowIR.violations,
          tokenCount: midIR.tokens.length,
        } as Frozen,
      },
    }
    return { patches: [], effects: [blockLog], events: [] }
  }

  const allPatches: Patch[] = []
  const allEffects: Effect[] = []
  const allEvents: EvolutionEvent[] = []

  // 1. Convert instructions to patches + effects
  for (const instruction of lowIR.instructions) {
    allPatches.push(...instructionToPatches(instruction))
    allEffects.push(...instructionToEffects(instruction))
  }

  // 2. Create evolution events for each token processed
  const commLevel = resolveCommLevel(lowIR)
  const resourceTier = resolveResourceTier(lowIR.permissionLevel, infoLevel)

  for (const token of midIR.tokens) {
    const event: EvolutionEvent = {
      id: `evo-${token.id}`,
      timestamp: token.timestamp,
      trigger: lowIR.instructions[0] ?? {
        source: 'S1_task_driven',
        nodeTier: 'execution',
        currentState: 'building',
        targetState: 'building',
        guards: [],
        effects: [],
      },
      infoLevel,
      commLevel,
      mutationType: 'create',
      affectedNodes: [nodeId(token.id)],
      actor: lowIR.permissionLevel,
      executor: resourceTier,
      diff: {
        before: null,
        after: token.rawContent,
      },
    }

    allEvents.push(event)
    allEffects.push(...evolutionToEffects(event))
  }

  return {
    patches: allPatches,
    effects: allEffects,
    events: allEvents,
  }
}
