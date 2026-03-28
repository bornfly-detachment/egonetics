/**
 * routes/ontology.js  v2
 * 本体图的完整 CRUD — 一切内容均可被人和机器修改
 *
 * GET    /api/ontology                  → 全量数据
 * ── Nodes ──
 * GET    /api/ontology/nodes            → 节点列表
 * GET    /api/ontology/nodes/:id        → 单节点
 * POST   /api/ontology/nodes            → 新建节点
 * PATCH  /api/ontology/nodes/:id        → 深度合并更新（任何字段）
 * DELETE /api/ontology/nodes/:id        → 删除节点（级联删关联边）
 * ── Edges ──
 * GET    /api/ontology/edges            → 边列表
 * GET    /api/ontology/edges/:id        → 单边
 * POST   /api/ontology/edges            → 新建边
 * PATCH  /api/ontology/edges/:id        → 更新边
 * DELETE /api/ontology/edges/:id        → 删除边
 * ── Layers ──
 * GET    /api/ontology/layers           → 层定义列表
 * POST   /api/ontology/layers           → 新建层
 * PATCH  /api/ontology/layers/:id       → 更新层
 * DELETE /api/ontology/layers/:id       → 删除层
 * ── Edge Types ──
 * GET    /api/ontology/edge-types       → 边类型列表
 * POST   /api/ontology/edge-types       → 新建边类型
 * PATCH  /api/ontology/edge-types/:id   → 更新边类型
 * DELETE /api/ontology/edge-types/:id   → 删除边类型
 *
 * Raw YAML:
 * GET    /api/ontology/raw              → 原始 YAML 文本
 */

const express = require('express');
const router  = express.Router();
const fs      = require('fs');
const path    = require('path');
const yaml    = require('js-yaml');

const ONTOLOGY_PATH = path.join(__dirname, '../../docs/bornfly-theory-ontology.yaml');

// ── 内存状态 ──────────────────────────────────────────────────────────────
let state = null;   // { meta, layers, edge_types, nodes, edges }

// ── 工具：深合并（对象 deep-merge，数组直接替换）────────────────────────
function deepMerge(target, source) {
  if (!target || typeof target !== 'object') return source;
  const result = { ...target };
  for (const [k, v] of Object.entries(source)) {
    if (v !== null && typeof v === 'object' && !Array.isArray(v)
        && typeof result[k] === 'object' && !Array.isArray(result[k])) {
      result[k] = deepMerge(result[k], v);
    } else {
      result[k] = v;
    }
  }
  return result;
}

// ── 加载 ──────────────────────────────────────────────────────────────────
function loadState() {
  const raw  = fs.readFileSync(ONTOLOGY_PATH, 'utf8');
  const data = yaml.load(raw);

  if (!String(data.schema_version || '').startsWith('2')) {
    console.error('[ontology] ⚠️  检测到 v1 格式，请先运行迁移脚本：');
    console.error('  cd server && node scripts/migrate-ontology-v2.js');
    // 降级：只提供只读数据，不支持 CRUD
    state = { _v1: true, _data: data };
    return;
  }

  state = {
    meta:       {
      version:     data.schema_version,
      lastUpdated: data.last_updated || '',
      author:      data.author || '',
      changelog:   data.changelog || {},
    },
    layers:     data.layers     || [],
    edge_types: data.edge_types || [],
    nodes:      data.nodes      || [],
    edges:      data.edges      || [],
  };
}

// ── 写回 YAML ──────────────────────────────────────────────────────────────
function saveState() {
  if (state._v1) return;   // v1 模式不写回
  const now = new Date().toISOString().split('T')[0];
  state.meta.lastUpdated = now;

  const out = {
    schema_version: state.meta.version,
    author:         state.meta.author,
    last_updated:   now,
    changelog:      state.meta.changelog,
    layers:         state.layers,
    edge_types:     state.edge_types,
    nodes:          state.nodes,
    edges:          state.edges,
  };
  fs.writeFileSync(ONTOLOGY_PATH, yaml.dump(out, { lineWidth: 160, noRefs: true, quotingType: '"' }), 'utf8');
}

// ── 序列化给前端的格式 ──────────────────────────────────────────────────
function toApiResponse() {
  if (state._v1) {
    return { error: 'v1 格式，请先迁移', needsMigration: true };
  }
  return {
    meta:       state.meta,
    layers:     state.layers,
    edge_types: state.edge_types,
    nodes:      state.nodes,
    edges:      state.edges,
  };
}

// ── 边 ID 生成 ──────────────────────────────────────────────────────────
function genEdgeId(source, target, type) {
  // 优先语义 ID，去重靠调用方检查
  const base = `e-${source}-${target}-${type}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  // 如果已存在则加后缀
  const existing = new Set(state.edges.map(e => e.id));
  if (!existing.has(base)) return base;
  let i = 2;
  while (existing.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

// ── 路由 ──────────────────────────────────────────────────────────────────
function init() {

  // ── GET /ontology — 全量 ──
  router.get('/ontology', (_req, res) => {
    try {
      if (!state) loadState();
      res.json(toApiResponse());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /ontology/raw ──
  router.get('/ontology/raw', (_req, res) => {
    try {
      res.type('text/plain').send(fs.readFileSync(ONTOLOGY_PATH, 'utf8'));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ════════════════════════════════════════════════════════
  // NODES
  // ════════════════════════════════════════════════════════

  router.get('/ontology/nodes', (_req, res) => {
    if (!state) loadState();
    if (state._v1) return res.status(409).json({ error: '需要先迁移到 v2' });
    res.json(state.nodes);
  });

  router.get('/ontology/nodes/:id', (req, res) => {
    if (!state) loadState();
    if (state._v1) return res.status(409).json({ error: '需要先迁移到 v2' });
    const node = state.nodes.find(n => n.id === req.params.id);
    if (!node) return res.status(404).json({ error: '节点不存在' });
    res.json(node);
  });

  router.post('/ontology/nodes', (req, res) => {
    if (!state) loadState();
    if (state._v1) return res.status(409).json({ error: '需要先迁移到 v2' });

    const { id, name, layer } = req.body;
    if (!id || !name || !layer) {
      return res.status(400).json({ error: 'id / name / layer 为必填' });
    }
    if (state.nodes.find(n => n.id === id)) {
      return res.status(409).json({ error: `节点 ${id} 已存在` });
    }

    const node = { id, name, layer, ...req.body };
    state.nodes.push(node);
    saveState();
    res.status(201).json(node);
  });

  router.patch('/ontology/nodes/:id', (req, res) => {
    if (!state) loadState();
    if (state._v1) return res.status(409).json({ error: '需要先迁移到 v2' });

    const idx = state.nodes.findIndex(n => n.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: '节点不存在' });

    // 不允许修改 id
    const patch = { ...req.body };
    delete patch.id;

    state.nodes[idx] = deepMerge(state.nodes[idx], patch);
    saveState();
    res.json(state.nodes[idx]);
  });

  router.delete('/ontology/nodes/:id', (req, res) => {
    if (!state) loadState();
    if (state._v1) return res.status(409).json({ error: '需要先迁移到 v2' });

    const { id } = req.params;
    const before = state.nodes.length;
    state.nodes  = state.nodes.filter(n => n.id !== id);
    if (state.nodes.length === before) return res.status(404).json({ error: '节点不存在' });

    // 级联删除关联边
    const edgesBefore = state.edges.length;
    state.edges = state.edges.filter(e => e.source !== id && e.target !== id);
    saveState();
    res.json({ deleted: id, edgesRemoved: edgesBefore - state.edges.length });
  });

  // ════════════════════════════════════════════════════════
  // EDGES
  // ════════════════════════════════════════════════════════

  router.get('/ontology/edges', (_req, res) => {
    if (!state) loadState();
    if (state._v1) return res.status(409).json({ error: '需要先迁移到 v2' });
    res.json(state.edges);
  });

  router.get('/ontology/edges/:id', (req, res) => {
    if (!state) loadState();
    if (state._v1) return res.status(409).json({ error: '需要先迁移到 v2' });
    const edge = state.edges.find(e => e.id === req.params.id);
    if (!edge) return res.status(404).json({ error: '边不存在' });
    res.json(edge);
  });

  router.post('/ontology/edges', (req, res) => {
    if (!state) loadState();
    if (state._v1) return res.status(409).json({ error: '需要先迁移到 v2' });

    const { source, target, type } = req.body;
    if (!source || !target || !type) {
      return res.status(400).json({ error: 'source / target / type 为必填' });
    }

    const id   = req.body.id || genEdgeId(source, target, type);
    if (state.edges.find(e => e.id === id)) {
      return res.status(409).json({ error: `边 ${id} 已存在` });
    }

    const edge = { id, source, target, type, strength: 1.0, ...req.body };
    state.edges.push(edge);
    saveState();
    res.status(201).json(edge);
  });

  router.patch('/ontology/edges/:id', (req, res) => {
    if (!state) loadState();
    if (state._v1) return res.status(409).json({ error: '需要先迁移到 v2' });

    const idx = state.edges.findIndex(e => e.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: '边不存在' });

    const patch = { ...req.body };
    delete patch.id;
    state.edges[idx] = deepMerge(state.edges[idx], patch);
    saveState();
    res.json(state.edges[idx]);
  });

  router.delete('/ontology/edges/:id', (req, res) => {
    if (!state) loadState();
    if (state._v1) return res.status(409).json({ error: '需要先迁移到 v2' });

    const before = state.edges.length;
    state.edges  = state.edges.filter(e => e.id !== req.params.id);
    if (state.edges.length === before) return res.status(404).json({ error: '边不存在' });
    saveState();
    res.json({ deleted: req.params.id });
  });

  // ════════════════════════════════════════════════════════
  // LAYERS
  // ════════════════════════════════════════════════════════

  router.get('/ontology/layers', (_req, res) => {
    if (!state) loadState();
    if (state._v1) return res.status(409).json({ error: '需要先迁移到 v2' });
    res.json(state.layers);
  });

  router.post('/ontology/layers', (req, res) => {
    if (!state) loadState();
    const { id, layer, label } = req.body;
    if (!id || layer === undefined || !label) {
      return res.status(400).json({ error: 'id / layer / label 为必填' });
    }
    if (state.layers.find(l => l.id === id)) {
      return res.status(409).json({ error: `层 ${id} 已存在` });
    }
    const lyr = { id, layer, label, ...req.body };
    state.layers.push(lyr);
    saveState();
    res.status(201).json(lyr);
  });

  router.patch('/ontology/layers/:id', (req, res) => {
    if (!state) loadState();
    const idx = state.layers.findIndex(l => l.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: '层不存在' });
    const patch = { ...req.body }; delete patch.id;
    state.layers[idx] = deepMerge(state.layers[idx], patch);
    saveState();
    res.json(state.layers[idx]);
  });

  router.delete('/ontology/layers/:id', (req, res) => {
    if (!state) loadState();
    const before = state.layers.length;
    state.layers = state.layers.filter(l => l.id !== req.params.id);
    if (state.layers.length === before) return res.status(404).json({ error: '层不存在' });
    saveState();
    res.json({ deleted: req.params.id });
  });

  // ════════════════════════════════════════════════════════
  // EDGE TYPES
  // ════════════════════════════════════════════════════════

  router.get('/ontology/edge-types', (_req, res) => {
    if (!state) loadState();
    if (state._v1) return res.status(409).json({ error: '需要先迁移到 v2' });
    res.json(state.edge_types);
  });

  router.post('/ontology/edge-types', (req, res) => {
    if (!state) loadState();
    const { id, label, color } = req.body;
    if (!id || !label || !color) {
      return res.status(400).json({ error: 'id / label / color 为必填' });
    }
    if (state.edge_types.find(t => t.id === id)) {
      return res.status(409).json({ error: `边类型 ${id} 已存在` });
    }
    const et = { id, label, color, dash: false, ...req.body };
    state.edge_types.push(et);
    saveState();
    res.status(201).json(et);
  });

  router.patch('/ontology/edge-types/:id', (req, res) => {
    if (!state) loadState();
    const idx = state.edge_types.findIndex(t => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: '边类型不存在' });
    const patch = { ...req.body }; delete patch.id;
    state.edge_types[idx] = deepMerge(state.edge_types[idx], patch);
    saveState();
    res.json(state.edge_types[idx]);
  });

  router.delete('/ontology/edge-types/:id', (req, res) => {
    if (!state) loadState();
    const before = state.edge_types.length;
    state.edge_types = state.edge_types.filter(t => t.id !== req.params.id);
    if (state.edge_types.length === before) return res.status(404).json({ error: '边类型不存在' });
    saveState();
    res.json({ deleted: req.params.id });
  });

  return router;
}

module.exports = { init };
