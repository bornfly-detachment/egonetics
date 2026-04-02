/**
 * Reality Protocol — Epoch-based collection + causal ordering
 *
 * This is the ONLY layer that deals with "time" and "external world".
 * Everything else in the kernel is timeless and deterministic.
 *
 * Key insight: Reality Protocol is NOT a scheduler.
 * It is a REALITY ORDERING FUNCTION — it defines
 * "what counts as the canonical order of events" within an epoch.
 *
 * Causal ordering prevents:
 *   - Network delay causing "history rewriting"
 *   - AI latency making old decisions appear as new
 *   - Multiple agents producing contradictory "now"
 *
 * Epoch lifecycle:
 *   1. OPEN  — accept RealityEvents from external sources
 *   2. CLOSE — deadline reached or quorum met
 *   3. ORDER — apply RealityOrderingFn to sort events
 *   4. FREEZE — produce RealitySnapshot with completeness metadata
 */

import type {
  PortId, Frozen, Snapshot, UniverseSpec,
  RealitySnapshot, RealityEvent, RealityOrderingFn,
  SnapshotCompleteness,
} from './types'
import { portId } from './types'

// ── Epoch Manager ──────────────────────────────────────────────

export interface EpochState {
  readonly epoch: number
  readonly openedAt: number
  readonly events: RealityEvent[]
  readonly closed: boolean
}

export interface EpochManager {
  /** Current epoch number */
  readonly currentEpoch: number
  /** Open a new epoch for event collection */
  open(): EpochState
  /** Submit an event to the current epoch */
  submit(event: RealityEvent): boolean
  /** Close the current epoch (no more events accepted) */
  close(): EpochState
  /** Freeze the closed epoch into a RealitySnapshot */
  freeze(tick: number): RealitySnapshot
  /** Check if the epoch is still within collection window */
  isWithinWindow(): boolean
}

/**
 * Create an EpochManager with the given ordering function and spec.
 */
export function createEpochManager(
  orderingFn: RealityOrderingFn,
  spec: UniverseSpec,
): EpochManager {
  let epoch = 0
  let current: EpochState = {
    epoch: 0,
    openedAt: Date.now(),
    events: [],
    closed: true, // starts closed, must call open()
  }
  // Last known values for ports — used when a port is missing in current epoch
  const lastKnown = new Map<PortId, Frozen>()

  return {
    get currentEpoch() { return epoch },

    open(): EpochState {
      epoch++
      current = {
        epoch,
        openedAt: Date.now(),
        events: [],
        closed: false,
      }
      return current
    },

    submit(event: RealityEvent): boolean {
      if (current.closed) return false
      current.events.push(event)
      return true
    },

    close(): EpochState {
      current = { ...current, closed: true }
      return current
    },

    freeze(tick: number): RealitySnapshot {
      if (!current.closed) {
        current = { ...current, closed: true }
      }

      // Apply ordering function — deterministic sort
      const ordered = orderingFn(current.events)

      // Build port map from ordered events (last event per port wins)
      const ports = new Map<PortId, Frozen>()
      for (const event of ordered) {
        ports.set(event.portId, event.value)
        lastKnown.set(event.portId, event.value)
      }

      // Fill missing required ports with last known values
      const missingPorts: PortId[] = []
      for (const required of spec.requiredPorts) {
        if (!ports.has(required)) {
          const last = lastKnown.get(required)
          if (last !== undefined) {
            ports.set(required, last)
          } else {
            missingPorts.push(required)
          }
        }
      }

      const completeness: SnapshotCompleteness =
        missingPorts.length === 0 ? 'full' : 'partial'

      return Object.freeze({
        tick,
        timestamp: Date.now(),
        ports,
        completeness,
        missingPorts,
        epoch: current.epoch,
      })
    },

    isWithinWindow(): boolean {
      if (current.closed) return false
      return (Date.now() - current.openedAt) < spec.maxCollectionWindow
    },
  }
}

// ── Built-in Ordering Functions ────────────────────────────────

/**
 * Timestamp ordering — events sorted by externalTimestamp.
 * Tiebreaker: source name (deterministic).
 *
 * This is the simplest ordering: "what happened first in the real world".
 * Assumes clocks are roughly synchronized.
 */
export function timestampOrdering(events: readonly RealityEvent[]): readonly RealityEvent[] {
  return [...events].sort((a, b) =>
    a.externalTimestamp - b.externalTimestamp ||
    a.source.localeCompare(b.source) ||
    a.portId.localeCompare(b.portId),
  )
}

/**
 * Source-priority ordering — events sorted by source priority,
 * then timestamp within same source.
 *
 * Use when some sources (e.g., human) should override others (e.g., sensor).
 */
export function sourcePriorityOrdering(
  priorityMap: Record<string, number>,
): RealityOrderingFn {
  return (events) => {
    return [...events].sort((a, b) => {
      const pa = priorityMap[a.source] ?? 0
      const pb = priorityMap[b.source] ?? 0
      return pb - pa || // higher priority first
        a.externalTimestamp - b.externalTimestamp ||
        a.source.localeCompare(b.source)
    })
  }
}

/**
 * Causal ordering — events are ordered by declared causal dependencies.
 * If event A must happen before B, A always appears first regardless of timestamp.
 *
 * This prevents network delay from "rewriting history".
 */
export function causalOrdering(
  causalGraph: ReadonlyMap<PortId, readonly PortId[]>,
): RealityOrderingFn {
  return (events) => {
    // Topological sort based on causal dependencies
    const sorted = [...events]
    const portIndex = new Map<PortId, number>()
    sorted.forEach((e, i) => portIndex.set(e.portId, i))

    // Simple: for each dependency, ensure predecessor comes first
    // This is a stable sort that respects causal order
    sorted.sort((a, b) => {
      const aDeps = causalGraph.get(a.portId) ?? []
      const bDeps = causalGraph.get(b.portId) ?? []

      // If a depends on b, b must come first
      if (aDeps.includes(b.portId)) return 1
      // If b depends on a, a must come first
      if (bDeps.includes(a.portId)) return -1

      // No causal relation → fall back to timestamp
      return a.externalTimestamp - b.externalTimestamp ||
        a.source.localeCompare(b.source)
    })

    return sorted
  }
}
