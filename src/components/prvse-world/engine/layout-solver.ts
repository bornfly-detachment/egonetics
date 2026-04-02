/**
 * Layout Solver — Computes spatial positions for PRVSE nodes
 *
 * Pipeline: TagNode[] → PrvseNode[] with (x, y, z) positions
 *
 * Strategy:
 *   L2 roots  → evenly distributed on a circle
 *   L1 children → orbiting their parent
 *   L0+ leaves → packed within parent region
 */

import type { PrvseNode } from '../types'
import { ROOT_COLORS, LAYOUT, SIZE } from '../constants'

/** Generic tree node — compatible with TagNode and ControlNode */
interface TreeNode {
  id: string
  name: string
  color: string
  select_mode: 'single' | 'multi'
  children?: TreeNode[]
}

/** Convert tree nodes → flat PrvseNode[] with computed positions */
export function solveLayout(roots: TreeNode[]): PrvseNode[] {
  const allNodes: PrvseNode[] = []

  // L2: place root entities in a circle
  const rootCount = roots.length
  const angleStep = (Math.PI * 2) / rootCount

  roots.forEach((root, i) => {
    const angle = angleStep * i - Math.PI / 2 // start from top
    const rx = Math.cos(angle) * LAYOUT.ROOT_SPREAD
    const ry = Math.sin(angle) * LAYOUT.ROOT_SPREAD

    const rootNode = buildNode(root, 0, null, rx, ry, 0) // roots at z=0
    allNodes.push(rootNode)

    // L1: place children (三问: Source/Nature/Destination) orbiting parent
    const kids = root.children ?? []
    const kidAngleStep = kids.length > 0 ? (Math.PI * 2) / kids.length : 0

    kids.forEach((kid, j) => {
      const ka = kidAngleStep * j - Math.PI / 2
      const kx = rx + Math.cos(ka) * LAYOUT.MID_SPREAD
      const ky = ry + Math.sin(ka) * LAYOUT.MID_SPREAD

      const kidNode = buildNode(kid, 1, root.id, kx, ky, -20) // L1 slightly below roots
      allNodes.push(kidNode)
      rootNode.children.push(kidNode)

      // L0+: place leaf nodes in a grid/spiral within parent region
      const leaves = kid.children ?? []
      const leafPositions = spiralPositions(leaves.length, LAYOUT.LEAF_SPREAD)

      leaves.forEach((leaf, k) => {
        const lx = kx + leafPositions[k].x
        const ly = ky + leafPositions[k].y

        const leafNode = buildNode(leaf, 2, kid.id, lx, ly, -40 + (k % 3) * 5) // L2 leaves with z variation
        allNodes.push(leafNode)
        kidNode.children.push(leafNode)

        // Deeper levels — recursive pack
        packDeeper(leaf, leafNode, 3, lx, ly, allNodes)
      })
    })
  })

  return allNodes
}

function buildNode(
  tag: TreeNode,
  depth: number,
  parentId: string | null,
  x: number,
  y: number,
  z: number,
): PrvseNode {
  const color = depth === 0
    ? (ROOT_COLORS[tag.id] ?? tag.color)
    : tag.color

  const childCount = countDescendants(tag)
  const radius = depth === 0
    ? SIZE.ROOT_RADIUS
    : depth === 1
      ? SIZE.MID_RADIUS
      : Math.max(SIZE.LEAF_RADIUS, SIZE.LEAF_RADIUS + Math.log2(childCount + 1) * 2)

  return {
    id: tag.id,
    name: tag.name,
    color,
    select_mode: tag.select_mode,
    depth,
    parentId,
    children: [],
    x, y, z,
    radius,
  }
}

function packDeeper(
  tag: TreeNode,
  parentNode: PrvseNode,
  depth: number,
  cx: number,
  cy: number,
  allNodes: PrvseNode[],
) {
  const kids = tag.children ?? []
  if (kids.length === 0) return

  const spread = LAYOUT.LEAF_SPREAD * Math.pow(0.7, depth - 2)
  const positions = spiralPositions(kids.length, spread)

  kids.forEach((kid, i) => {
    const kx = cx + positions[i].x
    const ky = cy + positions[i].y

    const zDepth = -20 * depth + (i % 5) * 4 // deeper layers at lower z with variation
    const kidNode = buildNode(kid, depth, tag.id, kx, ky, zDepth)
    allNodes.push(kidNode)
    parentNode.children.push(kidNode)

    packDeeper(kid, kidNode, depth + 1, kx, ky, allNodes)
  })
}

/** Generate positions in a spiral pattern */
function spiralPositions(count: number, spread: number): { x: number; y: number }[] {
  if (count === 0) return []
  if (count === 1) return [{ x: 0, y: 0 }]

  const result: { x: number; y: number }[] = []
  for (let i = 0; i < count; i++) {
    const angle = i * 2.4 // golden angle approximation
    const r = spread * Math.sqrt(i + 1) / Math.sqrt(count)
    result.push({
      x: Math.cos(angle) * r,
      y: Math.sin(angle) * r,
    })
  }
  return result
}

function countDescendants(tag: TreeNode): number {
  let count = 0
  for (const child of tag.children ?? []) {
    count += 1 + countDescendants(child)
  }
  return count
}

/** Find a PrvseNode by id from the flat list */
export function findNodeById(nodes: PrvseNode[], id: string): PrvseNode | undefined {
  return nodes.find(n => n.id === id)
}

/** Get the breadcrumb path from root to a given node */
export function getNodePath(nodes: PrvseNode[], id: string): PrvseNode[] {
  const path: PrvseNode[] = []
  let current = nodes.find(n => n.id === id)
  while (current) {
    path.unshift(current)
    current = current.parentId ? nodes.find(n => n.id === current!.parentId) : undefined
  }
  return path
}
