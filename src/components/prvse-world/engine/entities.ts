/**
 * Entities — Maps PrvseNode[] → Three.js Object3D meshes
 *
 * Each node becomes a sphere with:
 *   - Color from PRVSE data
 *   - Size from depth/child count
 *   - Glow ring for root entities
 *   - Label sprite for names
 *
 * Node meshes are stored in a Map<id, THREE.Group> for fast lookup.
 */

import * as THREE from 'three'
import type { PrvseNode } from '../types'
import { getRootLabels, ROOT_SPECTRUM } from '../constants'
import type { Language } from '@/lib/translations'

export interface EntityMap {
  /** id → mesh group */
  meshes: Map<string, THREE.Group>
  /** id → node data (for raycasting back to data) */
  nodeData: Map<string, PrvseNode>
  /** All raycastable objects */
  rayTargets: THREE.Object3D[]
}

const sphereGeo16 = new THREE.SphereGeometry(1, 32, 32)
const sphereGeo8 = new THREE.SphereGeometry(1, 16, 16)
const ringGeo = new THREE.RingGeometry(1.15, 1.35, 64)

export function buildEntities(nodes: PrvseNode[], parent: THREE.Group, lang: Language = 'zh'): EntityMap {
  const meshes = new Map<string, THREE.Group>()
  const nodeData = new Map<string, PrvseNode>()
  const rayTargets: THREE.Object3D[] = []

  for (const node of nodes) {
    const group = new THREE.Group()
    group.position.set(node.x, node.y, node.z)
    group.userData = { prvseId: node.id, depth: node.depth }

    const color = new THREE.Color(node.color)
    const spectrum = node.depth === 0 ? ROOT_SPECTRUM[node.id] : null

    // Sphere — depthWrite false so labels behind are not clipped
    // Root spheres: polished orb (low roughness, high metalness, bright emissive)
    // Child spheres: subtler presence
    const geo = node.depth <= 1 ? sphereGeo16 : sphereGeo8
    const emissiveColor = spectrum
      ? new THREE.Color(spectrum.highlight)   // glow uses highlight variant
      : color
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: emissiveColor,
      emissiveIntensity: node.depth === 0 ? 0.55 : 0.18,
      roughness: node.depth === 0 ? 0.15 : 0.45,
      metalness: node.depth === 0 ? 0.45 : 0.15,
      transparent: true,
      opacity: 1,
      depthWrite: false,
    })
    const sphere = new THREE.Mesh(geo, mat)
    sphere.scale.setScalar(node.radius)
    sphere.renderOrder = 0
    sphere.userData = { prvseId: node.id }
    group.add(sphere)
    rayTargets.push(sphere)

    // Glow ring for root entities — render behind labels
    if (node.depth === 0) {
      const ringMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
      const ring = new THREE.Mesh(ringGeo, ringMat)
      ring.scale.setScalar(node.radius)
      ring.renderOrder = 1
      ring.userData = { isDecoration: true }
      group.add(ring)
    }

    // Label — renderOrder high, neon glow matching node color
    const rootLabels = getRootLabels(lang)
    const rootLabel = rootLabels[node.id]
    const nodeHex = '#' + color.getHexString()
    if (rootLabel) {
      const sprite = createTextSprite(rootLabel, 30, '#ffffff', nodeHex)
      sprite.position.set(0, node.radius + 22, 0)
      sprite.renderOrder = 10
      sprite.userData = { isDecoration: true }
      group.add(sprite)
    } else if (node.depth <= 1) {
      const sprite = createTextSprite(node.name, 13, '#e0e0e0', nodeHex)
      sprite.position.set(0, node.radius + 12, 0)
      sprite.renderOrder = 10
      sprite.userData = { isDecoration: true }
      group.add(sprite)
    } else if (node.depth === 2) {
      const sprite = createTextSprite(node.name, 10, '#b0b0b0')
      sprite.position.set(0, node.radius + 6, 0)
      sprite.renderOrder = 10
      sprite.userData = { isDecoration: true }
      group.add(sprite)
    }

    parent.add(group)
    meshes.set(node.id, group)
    nodeData.set(node.id, node)
  }

  return { meshes, nodeData, rayTargets }
}

/** Update visibility/opacity based on camera distance (semantic zoom) */
export function updateVisibility(
  entities: EntityMap,
  cameraZ: number,
  focusRootId: string | null,
) {
  for (const [id, group] of entities.meshes) {
    const node = entities.nodeData.get(id)!
    const sphere = group.children[0] as THREE.Mesh
    const mat = sphere.material as THREE.MeshStandardMaterial

    // Determine target opacity based on zoom level and depth
    let targetOpacity = 1
    let targetScale = node.radius

    if (cameraZ > 600) {
      // L2: only roots visible
      if (node.depth === 0) {
        targetOpacity = 1
      } else if (node.depth === 1) {
        targetOpacity = Math.max(0, (700 - cameraZ) / 100)
      } else {
        targetOpacity = 0
      }
    } else if (cameraZ > 250) {
      // L1: roots + 三问 visible
      if (node.depth === 0) {
        // If we have a focus root, dim others
        if (focusRootId && node.id !== focusRootId) {
          targetOpacity = 0.15
        } else {
          targetOpacity = 0.6
          targetScale = node.radius * 0.6
        }
      } else if (node.depth === 1) {
        if (focusRootId && node.parentId !== focusRootId) {
          targetOpacity = 0.08
        } else {
          targetOpacity = 1
        }
      } else if (node.depth === 2) {
        targetOpacity = Math.max(0, (350 - cameraZ) / 100)
        if (focusRootId) {
          // Check if this node's grandparent is the focus root
          const parent = entities.nodeData.get(node.parentId ?? '')
          if (parent && parent.parentId !== focusRootId) {
            targetOpacity *= 0.1
          }
        }
      } else {
        targetOpacity = 0
      }
    } else {
      // L0: everything potentially visible
      if (node.depth === 0) {
        targetOpacity = 0.2
        targetScale = node.radius * 0.4
      } else if (node.depth === 1) {
        if (focusRootId) {
          const isRelevant = node.parentId === focusRootId
          targetOpacity = isRelevant ? 0.5 : 0.05
        } else {
          targetOpacity = 0.5
        }
      } else {
        targetOpacity = 1
      }
    }

    // Smooth interpolation
    mat.opacity += (targetOpacity - mat.opacity) * 0.08
    sphere.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.08)

    // Hide completely invisible groups for performance
    group.visible = mat.opacity > 0.01

    // Update decorations (ring, label) opacity
    for (let i = 1; i < group.children.length; i++) {
      const child = group.children[i]
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) {
        child.material.opacity += (targetOpacity * 0.3 - child.material.opacity) * 0.08
      }
      if (child instanceof THREE.Sprite && child.material instanceof THREE.SpriteMaterial) {
        child.material.opacity += (targetOpacity - child.material.opacity) * 0.08
      }
    }
  }
}

/** Highlight a node (for hover) */
export function setHighlight(entities: EntityMap, nodeId: string | null, prevId: string | null) {
  if (prevId) {
    const group = entities.meshes.get(prevId)
    if (group) {
      const sphere = group.children[0] as THREE.Mesh
      const mat = sphere.material as THREE.MeshStandardMaterial
      const node = entities.nodeData.get(prevId)!
      mat.emissiveIntensity = node.depth === 0 ? 0.35 : 0.15
    }
  }
  if (nodeId) {
    const group = entities.meshes.get(nodeId)
    if (group) {
      const sphere = group.children[0] as THREE.Mesh
      const mat = sphere.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = 0.8
    }
  }
}

// ── Text sprite helper ──────────────────────────────────────────────────

/**
 * createTextSprite — Canvas text with dark backdrop + neon glow
 *
 * Cyberpunk UI style: text rendered with:
 *   1. Dark semi-transparent pill background for contrast
 *   2. Neon glow via multiple shadowBlur passes (matches node color)
 *   3. Crisp white/colored foreground text
 *   4. depthTest=false + high renderOrder so never occluded
 */
function createTextSprite(
  text: string,
  fontSize: number,
  color: string,
  glowColor?: string,
): THREE.Sprite {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const font = `bold ${fontSize}px 'JetBrains Mono', 'Inter', monospace`

  // Measure text
  ctx.font = font
  const metrics = ctx.measureText(text)
  const padX = fontSize * 0.8
  const padY = fontSize * 0.5
  const w = Math.ceil(metrics.width) + padX * 2
  const h = fontSize + padY * 2

  canvas.width = w * 2
  canvas.height = h * 2
  ctx.scale(2, 2)

  // 1. Dark pill background
  const r = h * 0.4
  ctx.fillStyle = 'rgba(5, 5, 10, 0.75)'
  ctx.beginPath()
  roundRect(ctx, 1, 1, w - 2, h - 2, r)
  ctx.fill()

  // Subtle border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
  ctx.lineWidth = 0.5
  ctx.beginPath()
  roundRect(ctx, 1, 1, w - 2, h - 2, r)
  ctx.stroke()

  // 2. Neon glow pass (if glowColor provided)
  ctx.font = font
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  if (glowColor) {
    ctx.shadowColor = glowColor
    ctx.shadowBlur = fontSize * 0.6
    ctx.fillStyle = glowColor
    ctx.fillText(text, w / 2, h / 2)
    // Second glow pass for intensity
    ctx.shadowBlur = fontSize * 0.3
    ctx.fillText(text, w / 2, h / 2)
  }

  // 3. Crisp foreground text
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.fillStyle = color
  ctx.fillText(text, w / 2, h / 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true

  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  })

  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(w * 0.5, h * 0.5, 1)

  return sprite
}

/** Canvas roundRect polyfill for older browsers */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, radius: number,
) {
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, radius)
    return
  }
  const r = Math.min(radius, w / 2, h / 2)
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
