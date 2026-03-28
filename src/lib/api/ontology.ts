import { authFetch } from '@/lib/http'

// ── 核心数据结构 ──────────────────────────────────────────────────────────

export interface OntologyLayer {
  id:     string
  layer:  number
  label:  string
  [key: string]: unknown
}

export interface OntologyEdgeType {
  id:    string
  label: string
  color: string
  dash:  boolean
  [key: string]: unknown
}

// 条件树（客观逻辑判断，不是主观描述）
export interface ConditionClause {
  field: string
  op:    'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'exists'
  value: unknown
}
export interface ConditionTree {
  logic:   'AND' | 'OR' | 'NOT'
  clauses: (ConditionClause | ConditionTree)[]
}

// 四维信息模型（按需填写）
export interface NodePattern {
  type?:   string
  tags?:   string[]
  levels?: Record<string, string>
  [key: string]: unknown
}
export interface NodeCausality {
  sources?:        string[]
  mechanism?:      string
  conditions?:     ConditionTree
  analysis_notes?: string
  [key: string]: unknown
}
export interface NodeValue {
  function?:   string
  weights?:    Record<string, number>
  thresholds?: { activate?: number; suppress?: number }
  [key: string]: unknown
}
export interface NodeIntent {
  direction?:    string
  priority?:     number
  next_actions?: string[]
  [key: string]: unknown
}

export interface OntologyNode {
  id:         string
  key?:       string
  name:       string
  layer:      string          // 引用 OntologyLayer.id
  layerIndex: number
  layerLabel: string
  type?:      string
  description?: string
  formal?:    string
  note?:      string
  // 四维（可选）
  pattern?:   NodePattern
  causality?: NodeCausality
  value?:     NodeValue
  intent?:    NodeIntent
  [key: string]: unknown
}

export interface OntologyEdge {
  id:         string
  source:     string
  target:     string
  type:       string
  strength?:  number
  conditions?: ConditionTree
  [key: string]: unknown
}

export interface OntologyMeta {
  version:     string
  lastUpdated: string
  author:      string
  changelog:   Record<string, string>
}

export interface OntologyData {
  meta:       OntologyMeta
  layers:     OntologyLayer[]
  edge_types: OntologyEdgeType[]
  nodes:      OntologyNode[]
  edges:      OntologyEdge[]
}

// ── 读取 ──────────────────────────────────────────────────────────────────

export async function fetchOntology(): Promise<OntologyData> {
  return authFetch<OntologyData>('/ontology')
}

// ── 节点 CRUD ─────────────────────────────────────────────────────────────

export async function createNode(data: Omit<OntologyNode, 'layerIndex' | 'layerLabel'>): Promise<OntologyNode> {
  return authFetch<OntologyNode>('/ontology/nodes', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateNode(id: string, patch: Partial<OntologyNode>): Promise<OntologyNode> {
  return authFetch<OntologyNode>(`/ontology/nodes/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

export async function deleteNode(id: string): Promise<{ deleted: string; edgesRemoved: number }> {
  return authFetch(`/ontology/nodes/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

// ── 边 CRUD ───────────────────────────────────────────────────────────────

export async function createEdge(data: Omit<OntologyEdge, 'id'> & { id?: string }): Promise<OntologyEdge> {
  return authFetch<OntologyEdge>('/ontology/edges', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateEdge(id: string, patch: Partial<OntologyEdge>): Promise<OntologyEdge> {
  return authFetch<OntologyEdge>(`/ontology/edges/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

export async function deleteEdge(id: string): Promise<{ deleted: string }> {
  return authFetch(`/ontology/edges/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

// ── 层 CRUD ───────────────────────────────────────────────────────────────

export async function createLayer(data: OntologyLayer): Promise<OntologyLayer> {
  return authFetch<OntologyLayer>('/ontology/layers', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateLayer(id: string, patch: Partial<OntologyLayer>): Promise<OntologyLayer> {
  return authFetch<OntologyLayer>(`/ontology/layers/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

export async function deleteLayer(id: string): Promise<{ deleted: string }> {
  return authFetch(`/ontology/layers/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

// ── 边类型 CRUD ───────────────────────────────────────────────────────────

export async function createEdgeType(data: OntologyEdgeType): Promise<OntologyEdgeType> {
  return authFetch<OntologyEdgeType>('/ontology/edge-types', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateEdgeType(id: string, patch: Partial<OntologyEdgeType>): Promise<OntologyEdgeType> {
  return authFetch<OntologyEdgeType>(`/ontology/edge-types/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

export async function deleteEdgeType(id: string): Promise<{ deleted: string }> {
  return authFetch(`/ontology/edge-types/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
