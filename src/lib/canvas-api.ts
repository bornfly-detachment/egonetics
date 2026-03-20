/**
 * canvas-api.ts
 * 画布 + 画布节点的前端 API 客户端
 */

import { authFetch } from './http'

export interface Canvas {
  id: string
  title: string
  description: string
  creator: string
  canvas_type: 'semantic' | 'execution'
  task_ref_id: string | null
  node_count: number
  created_at: string
  updated_at: string
}

export interface CanvasNode {
  id: string
  canvas_id: string
  entity_type: string
  entity_id: string
  x: number
  y: number
  expanded_level: number
  collapsed: number      // 0 | 1 — 卡片折叠到标题栏
  tree_expanded: number  // 0 | 1 — 子节点已在画布上展开
  created_at: string
}

// ── Canvases ──────────────────────────────────────────────────────

export async function listCanvases(): Promise<Canvas[]> {
  return authFetch<Canvas[]>('/canvases')
}

export async function createCanvas(input: { title: string; description?: string }): Promise<Canvas> {
  return authFetch<Canvas>('/canvases', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateCanvas(id: string, patch: { title?: string; description?: string }): Promise<Canvas> {
  return authFetch<Canvas>(`/canvases/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

export async function deleteCanvas(id: string): Promise<{ ok: boolean }> {
  return authFetch<{ ok: boolean }>(`/canvases/${id}`, { method: 'DELETE' })
}

// ── Canvas Nodes ──────────────────────────────────────────────────

export async function listCanvasNodes(canvasId: string): Promise<CanvasNode[]> {
  return authFetch<CanvasNode[]>(`/canvases/${canvasId}/nodes`)
}

export async function addCanvasNode(
  canvasId: string,
  input: { entity_type: string; entity_id: string; x?: number; y?: number; expanded_level?: number }
): Promise<CanvasNode> {
  return authFetch<CanvasNode>(`/canvases/${canvasId}/nodes`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateCanvasNode(
  canvasId: string,
  nodeId: string,
  patch: { x?: number; y?: number; expanded_level?: number; collapsed?: number; tree_expanded?: number }
): Promise<CanvasNode> {
  return authFetch<CanvasNode>(`/canvases/${canvasId}/nodes/${nodeId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

export async function removeCanvasNode(canvasId: string, nodeId: string): Promise<{ ok: boolean }> {
  return authFetch<{ ok: boolean }>(`/canvases/${canvasId}/nodes/${nodeId}`, {
    method: 'DELETE',
  })
}
