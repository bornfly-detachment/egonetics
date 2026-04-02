/**
 * Snapshot — Phase 0 Freeze Protocol
 *
 * External inputs (AI/Human/Sensor) write to PortBuffer asynchronously.
 * At tick start, PortBuffer is frozen into an immutable Snapshot.
 * After freeze, new writes go to the NEXT tick's buffer.
 *
 * Invariant: Snapshot is immutable once created. No writes after freeze.
 */

import type { PortId, PortBuffer, Snapshot, Frozen } from './types'

/**
 * Create a mutable port buffer that accumulates external inputs.
 * Call freeze() at tick start to produce an immutable Snapshot.
 */
export function createPortBuffer(): PortBuffer {
  const ports = new Map<PortId, Frozen>()

  return {
    ports,

    write(port: PortId, value: Frozen): void {
      ports.set(port, value)
    },

    freeze(tick: number): Snapshot {
      // Deep-copy ports into a frozen map
      const frozenPorts: ReadonlyMap<PortId, Frozen> = new Map(ports)

      // Clear buffer for next tick's accumulation
      ports.clear()

      return Object.freeze({
        tick,
        timestamp: Date.now(),
        ports: frozenPorts,
      })
    },
  }
}

/**
 * Create an empty snapshot (for bootstrapping / testing).
 */
export function emptySnapshot(tick: number = 0): Snapshot {
  return Object.freeze({
    tick,
    timestamp: Date.now(),
    ports: new Map(),
  })
}

/**
 * Read a port value from snapshot, with fallback.
 * Contract conditions should use this to safely access external inputs.
 */
export function readPort<T = unknown>(
  snapshot: Snapshot,
  port: PortId,
  fallback?: T,
): T | undefined {
  const val = snapshot.ports.get(port)
  return (val !== undefined ? val : fallback) as T | undefined
}
