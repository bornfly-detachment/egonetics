/**
 * PRVSE Chronicle API client
 * Wraps /api/prvse/:type CRUD endpoints
 */
import { authFetch } from './http'
import type { PatternData, RelationData, ValueData } from '@prvse/types'

export type PrvseType = 'P' | 'R' | 'V' | 'S' | 'E' | 'constitution' | 'compiler' | 'physics-engine' | 'kernel'

export interface IndexEntry {
  id: string
  label: string
  timestamp: number
  parentId?: string
}

export interface ListResult {
  type: PrvseType
  items: IndexEntry[]
}

export const prvseApi = {
  list: (type: PrvseType) =>
    authFetch<ListResult>(`/prvse/${type}`),

  get: <T = PatternData | RelationData | ValueData>(type: PrvseType, id: string) =>
    authFetch<T>(`/prvse/${type}/${id}`),

  create: <T = PatternData | RelationData | ValueData>(type: PrvseType, data: Partial<T>) =>
    authFetch<T>(`/prvse/${type}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: <T = PatternData | RelationData | ValueData>(type: PrvseType, id: string, data: Partial<T>) =>
    authFetch<T>(`/prvse/${type}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (type: PrvseType, id: string) =>
    authFetch<{ deleted: string }>(`/prvse/${type}/${id}`, { method: 'DELETE' }),

  fork: <T = PatternData | RelationData | ValueData>(type: PrvseType, id: string, overrides?: Partial<T>) =>
    authFetch<T>(`/prvse/${type}/${id}/fork`, {
      method: 'POST',
      body: JSON.stringify(overrides ?? {}),
    }),

  freeze: <T = PatternData | RelationData | ValueData>(type: PrvseType, id: string) =>
    authFetch<T>(`/prvse/${type}/${id}/freeze`, { method: 'POST' }),

  classify: <T = PatternData>(type: PrvseType, id: string, tier?: string) =>
    authFetch<T>(`/prvse/${type}/${id}/classify`, {
      method: 'POST',
      body: JSON.stringify({ tier: tier || 'T1' }),
    }),
}
