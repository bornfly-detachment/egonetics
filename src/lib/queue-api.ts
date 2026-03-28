/**
 * queue-api.ts — SEAI execution queue API client
 * 所有请求走 /seai 代理 → localhost:8000
 */

const BASE = '/seai'

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? res.statusText)
  }
  return res.json()
}

export interface QueueItem {
  id: string
  description: string
  v_criteria: { pass_condition?: string; score_fn?: string }
  state: 'pending' | 'running' | 'done' | 'failed' | 'blocked'
  assigned_node: string | null
  output: string | null
  v_score: number | null
  error_msg: string | null
  sort_order: number
  created_at: string
  started_at: string | null
  completed_at: string | null
  // Three-layer controller fields
  layer?: string
  task_ref_id?: string | null
  resource_cost?: string | null
  state_tags?: string | null
}

export interface Preconditions {
  environment: { ok: boolean; detail: Record<string, unknown> }
  goals:       { ok: boolean; detail: Record<string, unknown> }
  nodes:       { ok: boolean; detail: Record<string, unknown> }
  cognition:   { ok: boolean; detail: Record<string, unknown> }
  all_ok: boolean
}

export const queueApi = {
  list:   (state?: string) =>
    req<QueueItem[]>('GET', `/queue/${state ? `?state=${state}` : ''}`),

  create: (description: string, v_criteria = {}, sort_order = 0) =>
    req<QueueItem>('POST', '/queue/', { description, v_criteria, sort_order }),

  patch:  (id: string, patch: Partial<Pick<QueueItem, 'state' | 'assigned_node' | 'output' | 'v_score' | 'error_msg'>>) =>
    req<QueueItem>('PATCH', `/queue/${id}`, patch),

  delete: (id: string) =>
    req<{ ok: boolean }>('DELETE', `/queue/${id}`),

  preconditions: () =>
    req<Preconditions>('GET', '/queue/preconditions'),
}
