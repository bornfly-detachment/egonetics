/**
 * Interaction — Raycaster-based click/hover detection
 *
 * Maps mouse events → PRVSE node events.
 * WebGL handles: hover highlight, click-to-zoom, double-click-to-focus.
 * DOM handles: FocusPanel editing (triggered via callback).
 */

import * as THREE from 'three'
import type { PrvseNode } from '../types'

export interface InteractionState {
  hoveredId: string | null
  isDragging: boolean
  dragStart: { x: number; y: number } | null
}

export function createInteractionState(): InteractionState {
  return {
    hoveredId: null,
    isDragging: false,
    dragStart: null,
  }
}

/** Raycast from mouse position → find intersected PRVSE node */
export function raycastNode(
  raycaster: THREE.Raycaster,
  camera: THREE.PerspectiveCamera,
  mouse: THREE.Vector2,
  rayTargets: THREE.Object3D[],
  nodeData: Map<string, PrvseNode>,
): PrvseNode | null {
  raycaster.setFromCamera(mouse, camera)
  const hits = raycaster.intersectObjects(rayTargets, false)

  for (const hit of hits) {
    const id = hit.object.userData?.prvseId
    if (id && nodeData.has(id)) {
      return nodeData.get(id)!
    }
  }
  return null
}

/** Convert DOM mouse event → normalized device coords */
export function toNDC(
  event: MouseEvent,
  canvas: HTMLCanvasElement,
  mouse: THREE.Vector2,
): THREE.Vector2 {
  const rect = canvas.getBoundingClientRect()
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  return mouse
}

/** Project a 3D world position → screen coordinates */
export function toScreen(
  worldPos: THREE.Vector3,
  camera: THREE.PerspectiveCamera,
  canvas: HTMLCanvasElement,
): { x: number; y: number } {
  const v = worldPos.clone().project(camera)
  const rect = canvas.getBoundingClientRect()
  return {
    x: (v.x * 0.5 + 0.5) * rect.width + rect.left,
    y: (-v.y * 0.5 + 0.5) * rect.height + rect.top,
  }
}

/** Build the connection lines between parent → child nodes */
export function buildConnectionLines(
  nodes: PrvseNode[],
  scene: THREE.Group,
): THREE.LineSegments {
  const positions: number[] = []
  const colors: number[] = []

  for (const node of nodes) {
    if (!node.parentId) continue
    const parent = nodes.find(n => n.id === node.parentId)
    if (!parent) continue

    positions.push(parent.x, parent.y, parent.z)
    positions.push(node.x, node.y, node.z)

    const c = new THREE.Color(node.color)
    colors.push(c.r, c.g, c.b)
    colors.push(c.r, c.g, c.b)
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))

  const mat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.15,
    linewidth: 1,
  })

  const lines = new THREE.LineSegments(geo, mat)
  lines.userData = { isConnectionLines: true }
  scene.add(lines)
  return lines
}
