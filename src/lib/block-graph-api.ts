/**
 * block-graph-api.ts
 * Block 元信息、版本发布、Relation CRUD 的前端 API 客户端
 */

import { authFetch } from './http'
import type { ProcessVersion, Relation, EntityType } from '../components/types'

// ── Block 元信息 ──────────────────────────────────────────────

export async function updateBlockMeta(
  blockId: string,
  patch: { title?: string; creator?: string; editStartTime?: string; draftExplanation?: string }
): Promise<{ ok: boolean }> {
  return authFetch<{ ok: boolean }>(`/blocks/${blockId}/meta`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

// ── 发布 ──────────────────────────────────────────────────────

export async function publishBlock(
  blockId: string,
  explanation = ''
): Promise<ProcessVersion> {
  return authFetch<ProcessVersion>(`/blocks/${blockId}/publish`, {
    method: 'POST',
    body: JSON.stringify({ explanation }),
  })
}

export async function getBlockVersions(blockId: string): Promise<ProcessVersion[]> {
  return authFetch<ProcessVersion[]>(`/blocks/${blockId}/versions`)
}

// ── Relation CRUD ─────────────────────────────────────────────

export async function getRelations(params: {
  source_id?: string
  target_id?: string
  source_type?: EntityType
  target_type?: EntityType
}): Promise<Relation[]> {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][]
  ).toString()
  return authFetch<Relation[]>(`/relations${qs ? `?${qs}` : ''}`)
}

export async function createRelation(input: {
  title?: string
  relation_type?: string
  source_type: EntityType
  source_id: string
  target_type: EntityType
  target_id: string
  description?: string
}): Promise<Relation> {
  return authFetch<Relation>('/relations', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateRelation(
  id: string,
  patch: { title?: string; description?: string }
): Promise<Relation> {
  return authFetch<Relation>(`/relations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

export async function deleteRelation(id: string): Promise<{ ok: boolean }> {
  return authFetch<{ ok: boolean }>(`/relations/${id}`, { method: 'DELETE' })
}

export async function publishRelation(
  id: string,
  explanation = ''
): Promise<ProcessVersion> {
  return authFetch<ProcessVersion>(`/relations/${id}/publish`, {
    method: 'POST',
    body: JSON.stringify({ explanation }),
  })
}

export async function getRelationVersions(id: string): Promise<ProcessVersion[]> {
  return authFetch<ProcessVersion[]>(`/relations/${id}/versions`)
}
