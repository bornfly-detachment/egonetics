import { authFetch } from '@/lib/http'

// ── P.recognize ──────────────────────────────────────────────────────────────

export interface PRecognizeMatch {
  id:          string
  name:        string
  layer:       string
  layerIndex:  number
  type:        string | null
  score:       number
  description: string | null
}

export interface PRecognizeResult {
  input:     string
  matches:   PRecognizeMatch[]
  operation: 'P.recognize'
}

export interface PClassifyResult {
  input:              string
  best_layer:         string | null
  best_type:          string | null
  layer_distribution: { layer: string; score: number }[]
  type_distribution:  { type: string; score: number }[]
  operation: 'P.classify'
}

// ── R ────────────────────────────────────────────────────────────────────────

export interface RPropagateEdge {
  id:          string
  source:      string
  target:      string
  type:        string
  r_certainty: string
  strength:    number
}

export interface RPropagateResult {
  root:             string
  depth:            number
  direction:        string
  certainty_filter: string | null
  nodes:            { id: string; name: string; layer: string; type: string | null }[]
  edges:            RPropagateEdge[]
  node_count:       number
  edge_count:       number
  operation: 'R.propagate'
}

export interface RPathsResult {
  source:     { id: string; name: string }
  target:     { id: string; name: string }
  paths:      {
    length: number
    nodes:  { id: string; name: string | undefined }[]
    edges:  { type: string; r_certainty: string | undefined; label: string }[]
  }[]
  path_count: number
  operation: 'R.paths'
}

// ── V ────────────────────────────────────────────────────────────────────────

export interface VRankItem {
  id:         string
  name:       string
  layer:      string
  layerIndex: number
  weight:     number
  factors:    { centrality: number; layer_bonus: number; state_bonus: number; out_degree: number; in_degree: number }
}

export interface VRankResult {
  ranked:          VRankItem[]
  total_nodes:     number
  activated_count: number
  operation: 'V.rank'
}

export interface VWeightResult {
  node:    { id: string; name: string; layer: string }
  weight:  number
  factors: { centrality: number; layer_bonus: number; state_bonus: number; out_degree: number; in_degree: number }
  operation: 'V.weight'
}

// ── S ────────────────────────────────────────────────────────────────────────

export interface SState {
  activated_nodes:   string[]
  traversed_edges:   string[]
  v_distribution:    Record<string, number>
  context:           string
  timestamp:         string
  activated_details: { id: string; name: string | undefined; layer: string | undefined }[]
  operation:         string
}

export interface SPredictResult {
  from_nodes:      string[]
  reachable_nodes: unknown[]
  reachable_edges: unknown[]
  reachable_count: number
  operation:       string
}

export interface SDiffResult {
  added:   { id: string; name: string | undefined; layer: string | undefined }[]
  removed: { id: string; name: string | undefined; layer: string | undefined }[]
  stable:  { id: string; name: string | undefined; layer: string | undefined }[]
  delta:   number
  operation: 'S.diff'
}

// ── Spec ─────────────────────────────────────────────────────────────────────

export interface PrvsField     { name: string; type: string; constraint: string }
export interface PrvsOperation { sig: string; input: string; output: string; contract: string; example?: string }
export interface PrvsPrimitive { title: string; axiom: string; fields: PrvsField[]; operations: PrvsOperation[] }
export interface PrvsGuardrail { rule: string; enforcement: string }
export interface PrvsMetaOp    { name: string; formula: string; description: string }
export interface PrvsSpec {
  schema_version: string
  last_updated:   string
  changelog:      Record<string, string>
  boundary: {
    first_principles_law?: string
    occams_razor_law?:     string
    completeness_law:      string
    minimality_law:        string
    independence_law:      string
    inside_prvs:           string[]
    outside_prvs:          string[]
  }
  meta_operations: PrvsMetaOp[]
  primitives:      Record<'P'|'R'|'V'|'S', PrvsPrimitive>
  guardrails:      PrvsGuardrail[]
}

// ── Test Cases ────────────────────────────────────────────────────────────────

export interface PrvsTestCase {
  id:             string
  name:           string
  operation:      string
  input:          Record<string, unknown>
  expected_notes: string
  tags:           string[]
  last_result:    unknown
  last_run_at:    string | null
  created_at:     string
}

export interface PrvsRunResult {
  id: string; name: string; operation: string
  input: Record<string, unknown>; result: unknown; ran_at: string
}

export interface PrvsCompareResult {
  operation: string; label_a: string; label_b: string
  result_a: unknown; result_b: unknown; ran_at: string
}

// ── Axiom Sets ────────────────────────────────────────────────────────────────

export interface AxiomEntry {
  id:          string
  primitive:   'P' | 'R' | 'V' | 'S' | 'E'
  level:       number          // 1=公理(最小完备集) 2=推论 3=推理 ...
  name:        string
  derivedFrom: string[]        // 依赖的上游条目 id（语义待定义）
  created_at:  string
}

export type AxiomSets = Record<'P' | 'R' | 'V' | 'S' | 'E', AxiomEntry[]>

// ── API calls ─────────────────────────────────────────────────────────────────

export const prvsApi = {
  // P
  recognize: (input: string, topK = 10) =>
    authFetch<PRecognizeResult>('/prvs/p/recognize', {
      method: 'POST',
      body: JSON.stringify({ input, top_k: topK }),
    }),

  classify: (input: string) =>
    authFetch<PClassifyResult>('/prvs/p/classify', {
      method: 'POST',
      body: JSON.stringify({ input }),
    }),

  // R
  propagate: (nodeId: string, depth = 2, direction: 'out' | 'in' | 'both' = 'out', rCertainty?: string) =>
    authFetch<RPropagateResult>('/prvs/r/propagate', {
      method: 'POST',
      body: JSON.stringify({ node_id: nodeId, depth, direction, r_certainty: rCertainty || null }),
    }),

  paths: (source: string, target: string, maxDepth = 5) =>
    authFetch<RPathsResult>('/prvs/r/paths', {
      method: 'POST',
      body: JSON.stringify({ source, target, max_depth: maxDepth }),
    }),

  // V
  rank: (topK = 20) =>
    authFetch<VRankResult>(`/prvs/v/rank?top_k=${topK}`),

  weight: (nodeId: string) =>
    authFetch<VWeightResult>('/prvs/v/weight', {
      method: 'POST',
      body: JSON.stringify({ node_id: nodeId }),
    }),

  // S
  current: () =>
    authFetch<SState>('/prvs/s/current'),

  activate: (nodeIds: string[], context = '') =>
    authFetch<SState>('/prvs/s/activate', {
      method: 'POST',
      body: JSON.stringify({ node_ids: nodeIds, context }),
    }),

  predict: (depth = 2, rCertainty?: string) =>
    authFetch<SPredictResult>('/prvs/s/predict', {
      method: 'POST',
      body: JSON.stringify({ depth, r_certainty: rCertainty || null }),
    }),

  diff: (state1: { activated_nodes: string[] }, state2: { activated_nodes: string[] }) =>
    authFetch<SDiffResult>('/prvs/s/diff', {
      method: 'POST',
      body: JSON.stringify({ state1, state2 }),
    }),

  // Spec
  getSpec: () => authFetch<PrvsSpec>('/prvs/spec'),
  patchSpec: (patch: Partial<PrvsSpec> & { reason: string }) =>
    authFetch<PrvsSpec>('/prvs/spec', { method: 'PATCH', body: JSON.stringify(patch) }),

  // Axiom sets
  getAxioms: () =>
    authFetch<AxiomSets>('/prvs/axioms'),
  getAxiomsByPrimitive: (primitive: 'P'|'R'|'V'|'S'|'E') =>
    authFetch<AxiomEntry[]>(`/prvs/axioms/${primitive}`),
  createAxiom: (data: Pick<AxiomEntry, 'primitive'|'level'|'name'|'derivedFrom'>) =>
    authFetch<AxiomEntry>('/prvs/axioms', { method: 'POST', body: JSON.stringify(data) }),
  updateAxiom: (id: string, patch: Partial<Pick<AxiomEntry, 'name'|'level'|'derivedFrom'>>) =>
    authFetch<AxiomEntry>(`/prvs/axioms/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteAxiom: (id: string) =>
    authFetch<{ deleted: string }>(`/prvs/axioms/${id}`, { method: 'DELETE' }),

  // Test cases
  listTests: () => authFetch<PrvsTestCase[]>('/prvs/tests'),
  createTest: (data: Omit<PrvsTestCase, 'id'|'last_result'|'last_run_at'|'created_at'>) =>
    authFetch<PrvsTestCase>('/prvs/tests', { method: 'POST', body: JSON.stringify(data) }),
  updateTest: (id: string, patch: Partial<PrvsTestCase>) =>
    authFetch<PrvsTestCase>(`/prvs/tests/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteTest: (id: string) =>
    authFetch<{ deleted: string }>(`/prvs/tests/${id}`, { method: 'DELETE' }),
  runTest: (id: string) =>
    authFetch<PrvsRunResult>(`/prvs/tests/${id}/run`, { method: 'POST' }),
  compareTests: (operation: string, inputA: Record<string,unknown>, inputB: Record<string,unknown>, labelA?: string, labelB?: string) =>
    authFetch<PrvsCompareResult>('/prvs/tests/compare', {
      method: 'POST',
      body: JSON.stringify({ operation, input_a: inputA, input_b: inputB, label_a: labelA, label_b: labelB }),
    }),
}
