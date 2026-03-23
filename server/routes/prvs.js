/**
 * routes/prvs.js
 * PRVS 抽象操作接口 — 控制论底层指令集
 *
 * P — Pattern    差异的识别与结构
 * R — Relation   差异间的因果连接（确定性/概率性/解释性）
 * V — Value      差异的系统权重
 * S — State      系统的当前位置（图的激活模式）
 *
 * 任何控制论元操作 = PRVS 的组合
 *
 * POST /api/prvs/p/recognize        输入文本 → 匹配模式节点
 * POST /api/prvs/p/classify         输入文本 → 最佳分类（层/类型）
 * POST /api/prvs/r/propagate        从节点出发沿R网络扩散
 * POST /api/prvs/r/paths            两节点间的所有R路径
 * GET  /api/prvs/v/rank             全图节点按V权重排序
 * POST /api/prvs/v/weight           单节点V权重详情
 * GET  /api/prvs/s/current          当前S（激活模式）
 * POST /api/prvs/s/activate         设置激活节点集合
 * POST /api/prvs/s/predict          从当前S预测可达节点
 * POST /api/prvs/s/diff             两个S之间的差分
 */

const express = require('express')
const router  = express.Router()
const fs      = require('fs')
const path    = require('path')
const yaml    = require('js-yaml')

const ONTOLOGY_PATH   = path.join(__dirname, '../../docs/bornfly-theory-ontology.yaml')
const SPEC_PATH       = path.join(__dirname, '../../docs/prvs-spec.json')
const TESTS_PATH      = path.join(__dirname, '../../docs/prvs-test-cases.json')
const AXIOMS_PATH     = path.join(__dirname, '../../docs/prvs-axiom-sets.json')

// ── 内存状态 ──────────────────────────────────────────────────────────────
let graph = null   // { nodes: [], edges: [], nodeMap, adjOut, adjIn }
let currentState = {
  activated_nodes: [],
  traversed_edges: [],
  v_distribution:  {},
  context:         '',
  timestamp:       new Date().toISOString(),
}

function loadGraph() {
  const raw  = fs.readFileSync(ONTOLOGY_PATH, 'utf8')
  const data = yaml.load(raw)

  if (!String(data.schema_version || '').startsWith('2')) {
    throw new Error('需要先运行 migrate-ontology-v2.js 迁移到 v2 格式')
  }

  const nodes   = data.nodes   || []
  const edges   = data.edges   || []
  const nodeMap = {}
  const adjOut  = {}   // nodeId → [{edge, targetId}]
  const adjIn   = {}   // nodeId → [{edge, sourceId}]

  for (const n of nodes) {
    nodeMap[n.id] = n
    adjOut[n.id]  = []
    adjIn[n.id]   = []
  }
  for (const e of edges) {
    if (adjOut[e.source]) adjOut[e.source].push({ edge: e, peer: e.target })
    if (adjIn[e.target])  adjIn[e.target].push({ edge: e, peer: e.source })
  }

  graph = { nodes, edges, nodeMap, adjOut, adjIn }
}

function ensureGraph() {
  if (!graph) loadGraph()
  return graph
}

// ── 文本匹配工具 ──────────────────────────────────────────────────────────
function matchScore(node, query) {
  const q = query.toLowerCase()
  let score = 0
  if (node.name && node.name.toLowerCase().includes(q))        score += 10
  if (node.id   && node.id.toLowerCase().includes(q))          score += 8
  if (node.type && node.type.toLowerCase().includes(q))        score += 5
  if (node.description && String(node.description).toLowerCase().includes(q)) score += 3
  if (node.p?.tags) {
    for (const tag of node.p.tags) {
      if (String(tag).toLowerCase().includes(q)) score += 4
    }
  }
  if (node.key && node.key.toLowerCase().includes(q))          score += 2
  return score
}

// ── BFS ───────────────────────────────────────────────────────────────────
function bfs(startId, maxDepth, direction, certaintyFilter) {
  const { adjOut, adjIn, nodeMap } = ensureGraph()
  const adj    = direction === 'out' ? adjOut : direction === 'in' ? adjIn : null
  const visited = new Set([startId])
  const resultNodes = [nodeMap[startId]].filter(Boolean)
  const resultEdges = []
  let frontier = [startId]

  for (let d = 0; d < maxDepth && frontier.length; d++) {
    const next = []
    for (const id of frontier) {
      const links = adj ? adj[id] : [...(adjOut[id] || []), ...(adjIn[id] || [])]
      for (const { edge, peer } of links) {
        if (certaintyFilter && edge.r_certainty && edge.r_certainty !== certaintyFilter) continue
        if (!visited.has(peer)) {
          visited.add(peer)
          if (nodeMap[peer]) resultNodes.push(nodeMap[peer])
          next.push(peer)
        }
        if (!resultEdges.find(e => e.id === edge.id)) resultEdges.push(edge)
      }
    }
    frontier = next
  }
  return { nodes: resultNodes, edges: resultEdges }
}

// ── BFS 路径搜索 ──────────────────────────────────────────────────────────
function findPaths(sourceId, targetId, maxDepth) {
  const { adjOut } = ensureGraph()
  const paths = []

  function dfs(current, path, edgePath, visited) {
    if (path.length > maxDepth + 1) return
    if (current === targetId && path.length > 1) {
      paths.push({ nodes: [...path], edges: [...edgePath] })
      return
    }
    for (const { edge, peer } of (adjOut[current] || [])) {
      if (!visited.has(peer)) {
        visited.add(peer)
        dfs(peer, [...path, peer], [...edgePath, edge], visited)
        visited.delete(peer)
      }
    }
  }

  dfs(sourceId, [sourceId], [], new Set([sourceId]))
  return paths.slice(0, 20)  // 最多返回20条路径
}

// ── V 权重计算 ────────────────────────────────────────────────────────────
function computeWeight(nodeId) {
  const { adjOut, adjIn, nodeMap } = ensureGraph()
  const node = nodeMap[nodeId]
  if (!node) return null

  const outDeg     = (adjOut[nodeId] || []).length
  const inDeg      = (adjIn[nodeId]  || []).length
  const totalNodes = graph.nodes.length || 1

  // 中心性得分：出度×1.5 + 入度×1.0（出度更重要，代表影响力）
  const centrality = (outDeg * 1.5 + inDeg * 1.0) / (totalNodes * 2.5)

  // 层权重：公理层最高
  const layerBonus = {
    axioms: 0.3, subjectivity_structure: 0.25, epistemology: 0.15,
    ontology: 0.12, operating_system: 0.10, execution: 0.08,
    feedback: 0.06, interlocking_nodes: 0.20, core_tensions: 0.18,
  }
  const layerW = layerBonus[node.layer] || 0.05

  // 状态激活加权
  const stateBonus = currentState.activated_nodes.includes(nodeId) ? 0.2 : 0

  const weight = Math.min(1, centrality + layerW + stateBonus)

  return {
    weight: Math.round(weight * 1000) / 1000,
    factors: {
      centrality:    Math.round(centrality * 1000) / 1000,
      layer_bonus:   layerW,
      state_bonus:   stateBonus,
      out_degree:    outDeg,
      in_degree:     inDeg,
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// P — Pattern 操作
// ═══════════════════════════════════════════════════════════════════════════

/**
 * P.recognize — 识别输入中的模式
 * 输入文本 → 激活匹配的P节点列表（有序）
 */
function p_recognize(input, topK = 10) {
  const { nodes } = ensureGraph()
  const scored = nodes
    .map(n => ({ node: n, score: matchScore(n, input) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)

  return {
    input,
    matches: scored.map(({ node, score }) => ({
      id:         node.id,
      name:       node.name,
      layer:      node.layer,
      layerIndex: node.layerIndex,
      type:       node.type,
      score,
      description: node.description ? String(node.description).slice(0, 200) : null,
    })),
    operation: 'P.recognize',
  }
}

/**
 * P.classify — 将输入分类到最佳P类别（层/类型）
 * 返回最可能的层、类型分布
 */
function p_classify(input) {
  const { nodes } = ensureGraph()
  const layerScores = {}
  const typeScores  = {}

  for (const n of nodes) {
    const s = matchScore(n, input)
    if (!s) continue
    layerScores[n.layer] = (layerScores[n.layer] || 0) + s
    if (n.type) typeScores[n.type] = (typeScores[n.type] || 0) + s
  }

  const sortedLayers = Object.entries(layerScores).sort((a, b) => b[1] - a[1])
  const sortedTypes  = Object.entries(typeScores).sort((a, b) => b[1] - a[1])

  return {
    input,
    best_layer: sortedLayers[0]?.[0] ?? null,
    best_type:  sortedTypes[0]?.[0]  ?? null,
    layer_distribution: sortedLayers.map(([id, score]) => ({ layer: id, score })),
    type_distribution:  sortedTypes.slice(0, 8).map(([type, score]) => ({ type, score })),
    operation: 'P.classify',
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// R — Relation 操作
// ═══════════════════════════════════════════════════════════════════════════

/**
 * R.propagate — 沿R网络从节点扩散
 * 支持方向（out/in/both）和 r_certainty 过滤
 */
function r_propagate(nodeId, depth = 2, direction = 'out', certaintyFilter = null) {
  const { nodeMap } = ensureGraph()
  if (!nodeMap[nodeId]) return { error: `节点 ${nodeId} 不存在` }

  const { nodes, edges } = bfs(nodeId, depth, direction, certaintyFilter)

  return {
    root:      nodeId,
    depth,
    direction,
    certainty_filter: certaintyFilter,
    nodes:     nodes.map(n => ({ id: n.id, name: n.name, layer: n.layer, type: n.type })),
    edges:     edges.map(e => ({ id: e.id, source: e.source, target: e.target, type: e.type, r_certainty: e.r_certainty || 'unknown', strength: e.strength })),
    node_count: nodes.length,
    edge_count: edges.length,
    operation: 'R.propagate',
  }
}

/**
 * R.paths — 两节点间的所有R路径
 * 揭示概念间的推导/依赖链
 */
function r_paths(sourceId, targetId, maxDepth = 5) {
  const { nodeMap } = ensureGraph()
  if (!nodeMap[sourceId]) return { error: `源节点 ${sourceId} 不存在` }
  if (!nodeMap[targetId]) return { error: `目标节点 ${targetId} 不存在` }

  const paths = findPaths(sourceId, targetId, maxDepth)

  return {
    source:     { id: sourceId, name: nodeMap[sourceId]?.name },
    target:     { id: targetId, name: nodeMap[targetId]?.name },
    paths:      paths.map(p => ({
      length: p.edges.length,
      nodes:  p.nodes.map(id => ({ id, name: nodeMap[id]?.name })),
      edges:  p.edges.map(e => ({ type: e.type, r_certainty: e.r_certainty, label: e.type })),
    })),
    path_count: paths.length,
    operation:  'R.paths',
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// V — Value 操作
// ═══════════════════════════════════════════════════════════════════════════

/**
 * V.rank — 全图节点按V权重排序
 * 当前S的激活状态会影响权重分布
 */
function v_rank(topK = 20) {
  const { nodes } = ensureGraph()
  const ranked = nodes
    .map(n => {
      const w = computeWeight(n.id)
      return { id: n.id, name: n.name, layer: n.layer, layerIndex: n.layerIndex, ...w }
    })
    .sort((a, b) => (b?.weight ?? 0) - (a?.weight ?? 0))
    .slice(0, topK)

  return {
    ranked,
    total_nodes: nodes.length,
    activated_count: currentState.activated_nodes.length,
    operation: 'V.rank',
  }
}

/**
 * V.weight — 单节点V权重详情
 */
function v_weight(nodeId) {
  const { nodeMap } = ensureGraph()
  if (!nodeMap[nodeId]) return { error: `节点 ${nodeId} 不存在` }

  const w = computeWeight(nodeId)
  return {
    node: { id: nodeId, name: nodeMap[nodeId]?.name, layer: nodeMap[nodeId]?.layer },
    ...w,
    operation: 'V.weight',
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// S — State 操作
// ═══════════════════════════════════════════════════════════════════════════

/**
 * S.snapshot — 当前激活模式（系统此刻在哪里）
 */
function s_current() {
  const { nodeMap } = ensureGraph()
  return {
    ...currentState,
    activated_details: currentState.activated_nodes.map(id => ({
      id,
      name: nodeMap[id]?.name,
      layer: nodeMap[id]?.layer,
    })),
    operation: 'S.snapshot',
  }
}

/**
 * S.activate — 设置激活节点集合（主体此刻是谁）
 */
function s_activate(nodeIds, context = '') {
  const { nodeMap, adjOut, adjIn } = ensureGraph()

  // 激活节点 + 自动遍历直接关联边
  const traversed = new Set()
  for (const id of nodeIds) {
    for (const { edge } of (adjOut[id] || [])) traversed.add(edge.id)
    for (const { edge } of (adjIn[id]  || [])) traversed.add(edge.id)
  }

  // V分布：激活节点权重提升
  const vDist = {}
  for (const id of nodeIds) {
    const w = computeWeight(id)
    vDist[id] = w?.weight ?? 0
  }

  currentState = {
    activated_nodes: nodeIds,
    traversed_edges: [...traversed],
    v_distribution:  vDist,
    context,
    timestamp: new Date().toISOString(),
  }

  return {
    ...currentState,
    activated_details: nodeIds.map(id => ({
      id, name: nodeMap[id]?.name, layer: nodeMap[id]?.layer,
    })),
    operation: 'S.activate',
  }
}

/**
 * S.predict — 从当前S预测可达节点（沿R网络推演）
 * 感知当前位置 → 推演未来位置
 */
function s_predict(depth = 2, certaintyFilter = null) {
  const { nodeMap } = ensureGraph()
  const seeds = currentState.activated_nodes.length
    ? currentState.activated_nodes
    : graph.nodes.slice(0, 3).map(n => n.id)  // fallback: 取前3个节点

  const allNodes = new Set()
  const allEdges = new Set()

  for (const id of seeds) {
    if (!nodeMap[id]) continue
    const { nodes, edges } = bfs(id, depth, 'out', certaintyFilter)
    for (const n of nodes) allNodes.add(JSON.stringify({ id: n.id, name: n.name, layer: n.layer }))
    for (const e of edges) allEdges.add(JSON.stringify({ id: e.id, source: e.source, target: e.target, type: e.type, r_certainty: e.r_certainty }))
  }

  return {
    from_nodes:     seeds,
    depth,
    certainty_filter: certaintyFilter,
    reachable_nodes: [...allNodes].map(s => JSON.parse(s)),
    reachable_edges: [...allEdges].map(s => JSON.parse(s)),
    reachable_count: allNodes.size,
    operation: 'S.predict',
  }
}

/**
 * S.diff — 两个S之间的差分
 * 系统从哪里到了哪里
 */
function s_diff(state1, state2) {
  const set1 = new Set(state1.activated_nodes || [])
  const set2 = new Set(state2.activated_nodes || [])
  const { nodeMap } = ensureGraph()

  const added   = [...set2].filter(id => !set1.has(id))
  const removed = [...set1].filter(id => !set2.has(id))
  const stable  = [...set1].filter(id => set2.has(id))

  function details(ids) {
    return ids.map(id => ({ id, name: nodeMap[id]?.name, layer: nodeMap[id]?.layer }))
  }

  return {
    added:   details(added),
    removed: details(removed),
    stable:  details(stable),
    delta: added.length - removed.length,
    operation: 'S.diff',
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 规范 CRUD 工具
// ═══════════════════════════════════════════════════════════════════════════
function loadSpec() {
  return JSON.parse(fs.readFileSync(SPEC_PATH, 'utf8'))
}
function saveSpec(spec) {
  spec.last_updated = new Date().toISOString().split('T')[0]
  fs.writeFileSync(SPEC_PATH, JSON.stringify(spec, null, 2), 'utf8')
}

// ═══════════════════════════════════════════════════════════════════════════
// 测试案例 CRUD 工具
// ═══════════════════════════════════════════════════════════════════════════
function loadTests() {
  return JSON.parse(fs.readFileSync(TESTS_PATH, 'utf8'))
}
function saveTests(tests) {
  fs.writeFileSync(TESTS_PATH, JSON.stringify(tests, null, 2), 'utf8')
}

// ═══════════════════════════════════════════════════════════════════════════
// 公理集 CRUD 工具
// ═══════════════════════════════════════════════════════════════════════════
function loadAxioms() {
  return JSON.parse(fs.readFileSync(AXIOMS_PATH, 'utf8'))
}
function saveAxioms(data) {
  fs.writeFileSync(AXIOMS_PATH, JSON.stringify(data, null, 2), 'utf8')
}
function allAxiomEntries(data) {
  return ['P','R','V','S'].flatMap(p => (data[p] || []).map(e => ({ ...e, primitive: p })))
}

// 运行单个操作（用于测试执行）
function runOperation(operation, input) {
  switch (operation) {
    case 'P.recognize': return p_recognize(input.input, input.top_k || 10)
    case 'P.classify':  return p_classify(input.input)
    case 'R.propagate': return r_propagate(input.node_id, input.depth || 2, input.direction || 'out', input.r_certainty || null)
    case 'R.paths':     return r_paths(input.source, input.target, input.max_depth || 5)
    case 'V.rank':      return v_rank(input.top_k || 20)
    case 'V.weight':    return v_weight(input.node_id)
    case 'S.snapshot':  return s_current()
    case 'S.activate':  return s_activate(input.node_ids || [], input.context || '')
    case 'S.predict':   return s_predict(input.depth || 2, input.r_certainty || null)
    case 'S.diff':      return s_diff(input.state1, input.state2)
    default: throw new Error(`未知操作: ${operation}`)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 路由注册
// ═══════════════════════════════════════════════════════════════════════════
function init() {
  // P
  router.post('/prvs/p/recognize', (req, res) => {
    try {
      const { input, top_k = 10 } = req.body
      if (!input) return res.status(400).json({ error: 'input 为必填' })
      res.json(p_recognize(input, top_k))
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  router.post('/prvs/p/classify', (req, res) => {
    try {
      const { input } = req.body
      if (!input) return res.status(400).json({ error: 'input 为必填' })
      res.json(p_classify(input))
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // R
  router.post('/prvs/r/propagate', (req, res) => {
    try {
      const { node_id, depth = 2, direction = 'out', r_certainty = null } = req.body
      if (!node_id) return res.status(400).json({ error: 'node_id 为必填' })
      res.json(r_propagate(node_id, depth, direction, r_certainty))
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  router.post('/prvs/r/paths', (req, res) => {
    try {
      const { source, target, max_depth = 5 } = req.body
      if (!source || !target) return res.status(400).json({ error: 'source / target 为必填' })
      res.json(r_paths(source, target, max_depth))
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // V
  router.get('/prvs/v/rank', (req, res) => {
    try {
      const topK = parseInt(req.query.top_k) || 20
      res.json(v_rank(topK))
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  router.post('/prvs/v/weight', (req, res) => {
    try {
      const { node_id } = req.body
      if (!node_id) return res.status(400).json({ error: 'node_id 为必填' })
      res.json(v_weight(node_id))
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // S
  router.get('/prvs/s/current', (_req, res) => {
    try { res.json(s_current()) }
    catch (e) { res.status(500).json({ error: e.message }) }
  })

  router.post('/prvs/s/activate', (req, res) => {
    try {
      const { node_ids, context = '' } = req.body
      if (!Array.isArray(node_ids)) return res.status(400).json({ error: 'node_ids 为数组' })
      res.json(s_activate(node_ids, context))
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  router.post('/prvs/s/predict', (req, res) => {
    try {
      const { depth = 2, r_certainty = null } = req.body
      res.json(s_predict(depth, r_certainty))
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  router.post('/prvs/s/diff', (req, res) => {
    try {
      const { state1, state2 } = req.body
      if (!state1 || !state2) return res.status(400).json({ error: 'state1 / state2 为必填' })
      res.json(s_diff(state1, state2))
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // ════════════════════════════════════════════════════════
  // 规范 CRUD
  // ════════════════════════════════════════════════════════

  router.get('/prvs/spec', (_req, res) => {
    try { res.json(loadSpec()) }
    catch (e) { res.status(500).json({ error: e.message }) }
  })

  // PATCH /prvs/spec — 改动规范，必须填 reason
  router.patch('/prvs/spec', (req, res) => {
    try {
      const { reason, ...patch } = req.body
      if (!reason || !reason.trim()) {
        return res.status(400).json({ error: '改动规范必须填写 reason（改了什么，为什么）' })
      }
      const spec = loadSpec()
      // 深合并 patch 到 spec
      function deepMerge(target, source) {
        if (!target || typeof target !== 'object') return source
        const result = { ...target }
        for (const [k, v] of Object.entries(source)) {
          if (v !== null && typeof v === 'object' && !Array.isArray(v)
              && typeof result[k] === 'object' && !Array.isArray(result[k])) {
            result[k] = deepMerge(result[k], v)
          } else { result[k] = v }
        }
        return result
      }
      const updated = deepMerge(spec, patch)
      const version = `${parseFloat(spec.schema_version) + 0.1}`.replace(/(\.\d{1}).*/, '$1')
      updated.schema_version = version
      updated.changelog = { ...updated.changelog, [version]: reason }
      saveSpec(updated)
      res.json(updated)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // ════════════════════════════════════════════════════════
  // 测试案例 CRUD
  // ════════════════════════════════════════════════════════

  router.get('/prvs/tests', (_req, res) => {
    try { res.json(loadTests()) }
    catch (e) { res.status(500).json({ error: e.message }) }
  })

  router.post('/prvs/tests', (req, res) => {
    try {
      const { name, operation, input, expected_notes = '', tags = [] } = req.body
      if (!name || !operation || !input) {
        return res.status(400).json({ error: 'name / operation / input 为必填' })
      }
      const tests = loadTests()
      const id = `tc-${Date.now()}`
      const tc = { id, name, operation, input, expected_notes, tags,
                   last_result: null, last_run_at: null,
                   created_at: new Date().toISOString().split('T')[0] }
      tests.push(tc)
      saveTests(tests)
      res.status(201).json(tc)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  router.patch('/prvs/tests/:id', (req, res) => {
    try {
      const tests = loadTests()
      const idx = tests.findIndex(t => t.id === req.params.id)
      if (idx === -1) return res.status(404).json({ error: '测试案例不存在' })
      const patch = { ...req.body }; delete patch.id; delete patch.created_at
      tests[idx] = { ...tests[idx], ...patch }
      saveTests(tests)
      res.json(tests[idx])
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  router.delete('/prvs/tests/:id', (req, res) => {
    try {
      const tests = loadTests()
      const before = tests.length
      const updated = tests.filter(t => t.id !== req.params.id)
      if (updated.length === before) return res.status(404).json({ error: '测试案例不存在' })
      saveTests(updated)
      res.json({ deleted: req.params.id })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // POST /prvs/tests/:id/run — 执行单个测试案例
  router.post('/prvs/tests/:id/run', (req, res) => {
    try {
      const tests = loadTests()
      const idx = tests.findIndex(t => t.id === req.params.id)
      if (idx === -1) return res.status(404).json({ error: '测试案例不存在' })
      const tc = tests[idx]
      const result = runOperation(tc.operation, tc.input)
      tc.last_result = result
      tc.last_run_at = new Date().toISOString()
      saveTests(tests)
      res.json({ id: tc.id, name: tc.name, operation: tc.operation,
                 input: tc.input, result, ran_at: tc.last_run_at })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // ── 公理集 CRUD ───────────────────────────────────────────────────────────

  // GET /prvs/axioms — 全部，按 P/R/V/S 分组
  router.get('/prvs/axioms', (req, res) => {
    try { res.json(loadAxioms()) }
    catch (e) { res.status(500).json({ error: e.message }) }
  })

  // GET /prvs/axioms/:primitive — 单个原语的条目列表（P/R/V/S）
  router.get('/prvs/axioms/:primitive', (req, res) => {
    try {
      const p = req.params.primitive.toUpperCase()
      if (!['P','R','V','S'].includes(p)) return res.status(400).json({ error: '无效原语，必须是 P/R/V/S' })
      const data = loadAxioms()
      res.json(data[p] || [])
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // POST /prvs/axioms — 新建条目
  router.post('/prvs/axioms', (req, res) => {
    try {
      const { primitive, level, name, derivedFrom = [] } = req.body
      const p = (primitive || '').toUpperCase()
      if (!['P','R','V','S'].includes(p)) return res.status(400).json({ error: 'primitive 必须是 P/R/V/S' })
      if (!name || !name.trim()) return res.status(400).json({ error: 'name 为必填' })
      if (typeof level !== 'number' || level < 1) return res.status(400).json({ error: 'level 必须是正整数' })
      const data  = loadAxioms()
      const id    = `${p.toLowerCase()}_${Date.now()}`
      const entry = { id, primitive: p, level, name: name.trim(), derivedFrom: Array.isArray(derivedFrom) ? derivedFrom : [], created_at: new Date().toISOString() }
      data[p] = [...(data[p] || []), entry]
      // 按 level 排序
      data[p].sort((a, b) => a.level - b.level)
      saveAxioms(data)
      res.status(201).json(entry)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // PATCH /prvs/axioms/:id — 更新 level/name/derivedFrom
  router.patch('/prvs/axioms/:id', (req, res) => {
    try {
      const { id } = req.params
      const data    = loadAxioms()
      let found     = null
      let foundPrim = null
      for (const p of ['P','R','V','S']) {
        const idx = (data[p] || []).findIndex(e => e.id === id)
        if (idx !== -1) { found = { idx, arr: data[p] }; foundPrim = p; break }
      }
      if (!found) return res.status(404).json({ error: '条目不存在' })
      const { name, level, derivedFrom } = req.body
      const entry = { ...found.arr[found.idx] }
      if (name !== undefined)        entry.name        = name.trim()
      if (level !== undefined)       entry.level       = level
      if (derivedFrom !== undefined) entry.derivedFrom = derivedFrom
      found.arr[found.idx] = entry
      data[foundPrim].sort((a, b) => a.level - b.level)
      saveAxioms(data)
      res.json(entry)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // DELETE /prvs/axioms/:id — 删除条目
  router.delete('/prvs/axioms/:id', (req, res) => {
    try {
      const { id } = req.params
      const data   = loadAxioms()
      let deleted  = false
      for (const p of ['P','R','V','S']) {
        const before = (data[p] || []).length
        data[p] = (data[p] || []).filter(e => e.id !== id)
        if (data[p].length < before) { deleted = true; break }
      }
      if (!deleted) return res.status(404).json({ error: '条目不存在' })
      saveAxioms(data)
      res.json({ deleted: id })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // POST /prvs/tests/compare — A/B 对比：同一操作，两组输入
  router.post('/prvs/tests/compare', (req, res) => {
    try {
      const { operation, input_a, input_b, label_a = 'A', label_b = 'B' } = req.body
      if (!operation || !input_a || !input_b) {
        return res.status(400).json({ error: 'operation / input_a / input_b 为必填' })
      }
      const result_a = runOperation(operation, input_a)
      const result_b = runOperation(operation, input_b)
      res.json({ operation, label_a, label_b, result_a, result_b,
                 ran_at: new Date().toISOString() })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  return router
}

module.exports = { init }
