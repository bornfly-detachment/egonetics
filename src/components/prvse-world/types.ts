/**
 * PRVSE World — Type Definitions
 *
 * Core types for the WebGL Reality Stack.
 * PrvseNode is the universal node representation used across all layers.
 */

export interface PrvseNode {
  id: string
  name: string
  color: string
  select_mode: 'single' | 'multi'
  depth: number            // 0 = root (P/V/R/S/E), 1 = 三问, 2+ = deeper
  parentId: string | null
  children: PrvseNode[]
  /** Computed by layout solver */
  x: number
  y: number
  z: number
  /** Visual radius — computed from child count / depth */
  radius: number
}

/** Zoom semantic levels */
export type ZoomLevel = 'L2' | 'L1' | 'L0'

/** Focus state for DOM overlay */
export interface FocusState {
  nodeId: string
  node: PrvseNode
  screenX: number
  screenY: number
}

/** Camera state */
export interface CameraState {
  x: number
  y: number
  z: number
  targetX: number
  targetY: number
  targetZ: number
}

/** Engine events emitted to React */
export type EngineEvent =
  | { type: 'focus'; node: PrvseNode; screenX: number; screenY: number }
  | { type: 'unfocus' }
  | { type: 'zoom-level-change'; level: ZoomLevel }
  | { type: 'hover'; nodeId: string | null }
