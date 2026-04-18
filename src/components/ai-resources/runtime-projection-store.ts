import type { HarnessResourceId, RuntimeProjection } from "./types"

export interface HarnessRuntimeSnapshot {
  projection?: RuntimeProjection
  usagePercent?: number
  totalTokens?: number
  usedTokens?: number
  dailyRequestsRemaining?: number
  isLeader?: boolean
}

type Listener = () => void

const snapshots = new Map<HarnessResourceId, HarnessRuntimeSnapshot>()
const listeners = new Set<Listener>()

export function getHarnessRuntimeSnapshot(
  harnessId: HarnessResourceId,
): HarnessRuntimeSnapshot | undefined {
  return snapshots.get(harnessId)
}

export function subscribeHarnessRuntimeSnapshots(listener: Listener): () => void {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

export function recordHarnessRuntimeSnapshot(
  harnessId: HarnessResourceId,
  snapshot: HarnessRuntimeSnapshot,
): HarnessRuntimeSnapshot {
  const previous = snapshots.get(harnessId)
  const next = {
    ...previous,
    ...snapshot,
  }

  snapshots.set(harnessId, next)
  notifyListeners()
  return next
}

export function clearHarnessRuntimeSnapshot(harnessId: HarnessResourceId): void {
  if (!snapshots.has(harnessId)) return

  snapshots.delete(harnessId)
  notifyListeners()
}

export function listHarnessRuntimeSnapshots(): Array<
  readonly [HarnessResourceId, HarnessRuntimeSnapshot]
> {
  return [...snapshots.entries()]
}

function notifyListeners(): void {
  for (const listener of listeners) {
    listener()
  }
}
