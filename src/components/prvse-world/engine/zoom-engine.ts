/**
 * Zoom Engine — 3D camera navigation with semantic zoom
 *
 * Camera uses spherical coordinates (theta, phi, distance) for true 3D orbit.
 * Navigation:
 *   Scroll        → zoom in/out (distance)
 *   Arrow / WASD  → pan (move lookAt target)
 *   Mouse drag    → orbit (theta/phi rotation)
 *   Click entity  → auto-fly to entity center
 *   Esc           → zoom out one level
 *
 * Semantic zoom levels still apply based on camera distance.
 */

import * as THREE from 'three'
import { ZOOM } from '../constants'
import type { ZoomLevel, PrvseNode } from '../types'

export interface ZoomState {
  /** Spherical: distance from lookAt target */
  distance: number
  targetDistance: number
  /** Spherical: horizontal angle (radians) */
  theta: number
  targetTheta: number
  /** Spherical: vertical angle (radians), 0 = top-down, PI/2 = side */
  phi: number
  targetPhi: number
  /** LookAt target position */
  lookX: number
  lookY: number
  lookZ: number
  targetLookX: number
  targetLookY: number
  targetLookZ: number
  /** Current semantic level */
  level: ZoomLevel
  /** Which root entity we're zoomed into */
  focusRootId: string | null
  /** Active keyboard keys */
  keys: Set<string>
}

/** Initial camera: slightly tilted for 3D feel */
const INIT_PHI = 0.85      // ~49 degrees from vertical — not top-down
const INIT_THETA = -0.3     // slight horizontal offset
const INIT_DISTANCE = 700

export function createZoomState(): ZoomState {
  return {
    distance: INIT_DISTANCE,
    targetDistance: INIT_DISTANCE,
    theta: INIT_THETA,
    targetTheta: INIT_THETA,
    phi: INIT_PHI,
    targetPhi: INIT_PHI,
    lookX: 0, lookY: 0, lookZ: 0,
    targetLookX: 0, targetLookY: 0, targetLookZ: 0,
    level: 'L2',
    focusRootId: null,
    keys: new Set(),
  }
}

// ── Input handlers ──────────────────────────────────────────────

/** Scroll wheel → zoom in/out */
export function handleWheel(state: ZoomState, deltaY: number): ZoomState {
  const speed = state.distance * 0.15
  const newDist = state.targetDistance + (deltaY > 0 ? speed : -speed)
  return {
    ...state,
    targetDistance: Math.max(ZOOM.MIN_Z, Math.min(ZOOM.MAX_Z, newDist)),
  }
}

/** Mouse drag → orbit rotation */
export function handleOrbitDrag(state: ZoomState, dx: number, dy: number): ZoomState {
  return {
    ...state,
    targetTheta: state.targetTheta - dx * 0.005,
    targetPhi: Math.max(0.15, Math.min(1.45, state.targetPhi - dy * 0.005)),
  }
}

/** Right-click drag → pan */
export function handlePanDrag(state: ZoomState, dx: number, dy: number): ZoomState {
  const panSpeed = state.distance * 0.002
  // Pan in the camera's local XY plane
  const sinT = Math.sin(state.theta)
  const cosT = Math.cos(state.theta)
  return {
    ...state,
    targetLookX: state.targetLookX + (-dx * cosT - dy * sinT * Math.cos(state.phi)) * panSpeed,
    targetLookY: state.targetLookY + (-dx * sinT + dy * cosT * Math.cos(state.phi)) * panSpeed,
  }
}

/** Keyboard key down */
export function handleKeyDown(state: ZoomState, key: string): ZoomState {
  const keys = new Set(state.keys)
  keys.add(key.toLowerCase())
  return { ...state, keys }
}

/** Keyboard key up */
export function handleKeyUp(state: ZoomState, key: string): ZoomState {
  const keys = new Set(state.keys)
  keys.delete(key.toLowerCase())
  return { ...state, keys }
}

/** Click on a node → fly to it */
export function handleClickZoom(state: ZoomState, node: PrvseNode): ZoomState {
  if (node.depth === 0) {
    return {
      ...state,
      targetDistance: 350,
      targetLookX: node.x,
      targetLookY: node.y,
      targetLookZ: node.z,
      focusRootId: node.id,
    }
  } else if (node.depth === 1) {
    return {
      ...state,
      targetDistance: 160,
      targetLookX: node.x,
      targetLookY: node.y,
      targetLookZ: node.z,
    }
  } else {
    return {
      ...state,
      targetDistance: Math.max(ZOOM.MIN_Z, state.targetDistance * 0.55),
      targetLookX: node.x,
      targetLookY: node.y,
      targetLookZ: node.z,
    }
  }
}

/** Zoom out one level */
export function handleZoomOut(state: ZoomState): ZoomState {
  if (state.level === 'L0') {
    return { ...state, targetDistance: 350 }
  } else if (state.level === 'L1') {
    return {
      ...state,
      targetDistance: INIT_DISTANCE,
      targetLookX: 0, targetLookY: 0, targetLookZ: 0,
      focusRootId: null,
    }
  }
  return state
}

// ── Per-frame update ────────────────────────────────────────────

/** Update camera from state each frame */
export function tickZoom(
  state: ZoomState,
  camera: THREE.PerspectiveCamera,
): ZoomState {
  const lerp = 0.07
  let s = { ...state }

  // ── Keyboard pan ──
  const panSpeed = s.distance * 0.008
  const sinT = Math.sin(s.theta)
  const cosT = Math.cos(s.theta)

  if (s.keys.has('arrowleft') || s.keys.has('a')) {
    s.targetLookX += cosT * panSpeed
    s.targetLookY += sinT * panSpeed
  }
  if (s.keys.has('arrowright') || s.keys.has('d')) {
    s.targetLookX -= cosT * panSpeed
    s.targetLookY -= sinT * panSpeed
  }
  if (s.keys.has('arrowup') || s.keys.has('w')) {
    s.targetLookX += sinT * panSpeed
    s.targetLookY -= cosT * panSpeed
  }
  if (s.keys.has('arrowdown') || s.keys.has('s')) {
    s.targetLookX -= sinT * panSpeed
    s.targetLookY += cosT * panSpeed
  }
  // Q/E for zoom via keyboard
  if (s.keys.has('q')) {
    s.targetDistance = Math.min(ZOOM.MAX_Z, s.targetDistance + s.distance * 0.02)
  }
  if (s.keys.has('e')) {
    s.targetDistance = Math.max(ZOOM.MIN_Z, s.targetDistance - s.distance * 0.02)
  }

  // ── Smooth interpolation ──
  s.distance += (s.targetDistance - s.distance) * lerp
  s.theta += (s.targetTheta - s.theta) * lerp
  s.phi += (s.targetPhi - s.phi) * lerp
  s.lookX += (s.targetLookX - s.lookX) * lerp
  s.lookY += (s.targetLookY - s.lookY) * lerp
  s.lookZ += (s.targetLookZ - s.lookZ) * lerp

  // ── Spherical → Cartesian camera position ──
  const sinPhi = Math.sin(s.phi)
  const cosPhi = Math.cos(s.phi)
  camera.position.set(
    s.lookX + s.distance * sinPhi * Math.sin(s.theta),
    s.lookY - s.distance * sinPhi * Math.cos(s.theta),
    s.lookZ + s.distance * cosPhi,
  )
  camera.lookAt(s.lookX, s.lookY, s.lookZ)

  // ── Semantic level ──
  let level: ZoomLevel = 'L2'
  if (s.distance < ZOOM.L1_THRESHOLD) {
    level = 'L0'
  } else if (s.distance < ZOOM.L2_THRESHOLD) {
    level = 'L1'
  }

  s.level = level
  s.focusRootId = level === 'L2' ? null : s.focusRootId

  return s
}
