/**
 * routes/cybernetics.js
 * /api/cybernetics — 递归控制论骨架树 CRUD
 *
 * GET    /cybernetics/nodes              列出节点（?parent_id=  ?layer=）
 * GET    /cybernetics/nodes/:id          单节点
 * POST   /cybernetics/nodes/seed         植入最小骨架（幂等）
 * POST   /cybernetics/nodes              新建节点
 * PATCH  /cybernetics/nodes/:id          编辑节点
 * DELETE /cybernetics/nodes/:id          删除（级联）
 * POST   /cybernetics/nodes/:id/page     懒建关联 page（BlockEditor 数据源）
 */

const express = require('express');
const router = express.Router();

let db;

function genId() {
  return `cyber-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const now = () => new Date().toISOString();

const parseNode = row => ({
  ...row,
  meta: JSON.parse(row.meta || '{}'),
  is_builtin: !!row.is_builtin,
  page_id: row.page_id ?? null,
});

// ── Seed data: minimal PRVSE scaffold ───────────────────────────

const SEED_NODES = [
  { id: 'cyber-root', parent_id: null, layer: null, level: 0, node_type: 'root', name: 'PRVSE 生变论', description: 'PRVSE 控制论第一实例：自我演化的认知系统骨架', sort_order: 0, is_builtin: 1 },

  { id: 'cyber-P', parent_id: 'cyber-root', layer: 'P', level: 0, node_type: 'layer', name: 'P — 感知层', description: '信息输入、分类、压缩的感知管道', sort_order: 1, is_builtin: 1 },
  { id: 'cyber-P-L0', parent_id: 'cyber-P', layer: 'P', level: 1, node_type: 'axiom_group', name: 'L0 公理层', description: '感知层的第一性原理：何为可感知的信息？', sort_order: 0, is_builtin: 1 },
  { id: 'cyber-P-L1', parent_id: 'cyber-P', layer: 'P', level: 1, node_type: 'skeleton_group', name: 'L1 骨架层', description: '感知能力的骨架：信息标签体系与分类机制', sort_order: 1, is_builtin: 1 },
  { id: 'cyber-P-L1-observe', parent_id: 'cyber-P-L1', layer: 'P', level: 2, node_type: 'concept', name: 'observe', description: '原始信号采集与上下文快照', sort_order: 0, is_builtin: 1 },
  { id: 'cyber-P-L1-classify', parent_id: 'cyber-P-L1', layer: 'P', level: 2, node_type: 'concept', name: 'classify', description: '多维度标签分类（来源/类型/紧迫度/领域）', sort_order: 1, is_builtin: 1 },
  { id: 'cyber-P-L1-detect', parent_id: 'cyber-P-L1', layer: 'P', level: 2, node_type: 'concept', name: 'detect', description: '异常与模式检测', sort_order: 2, is_builtin: 1 },
  { id: 'cyber-P-L1-compress', parent_id: 'cyber-P-L1', layer: 'P', level: 2, node_type: 'concept', name: 'compress', description: '信息压缩与摘要提取', sort_order: 3, is_builtin: 1 },
  { id: 'cyber-P-L2', parent_id: 'cyber-P', layer: 'P', level: 1, node_type: 'impl_group', name: 'L2 实现层', description: '感知层的具体实现细节与流程', sort_order: 2, is_builtin: 1 },

  { id: 'cyber-R', parent_id: 'cyber-root', layer: 'R', level: 0, node_type: 'layer', name: 'R — 关系层', description: '实体间语义关系的推断与图谱构建', sort_order: 2, is_builtin: 1 },
  { id: 'cyber-R-L0', parent_id: 'cyber-R', layer: 'R', level: 1, node_type: 'axiom_group', name: 'L0 公理层', description: '关系层公理：何为有意义的语义边？', sort_order: 0, is_builtin: 1 },
  { id: 'cyber-R-L1', parent_id: 'cyber-R', layer: 'R', level: 1, node_type: 'skeleton_group', name: 'L1 骨架层', description: '关系推断骨架：实体、链接、推断、图谱', sort_order: 1, is_builtin: 1 },
  { id: 'cyber-R-L1-entity', parent_id: 'cyber-R-L1', layer: 'R', level: 2, node_type: 'concept', name: 'entity', description: '实体识别与规范化', sort_order: 0, is_builtin: 1 },
  { id: 'cyber-R-L1-link', parent_id: 'cyber-R-L1', layer: 'R', level: 2, node_type: 'concept', name: 'link', description: '语义边构建（关系类型：因果/推导/包含/联系）', sort_order: 1, is_builtin: 1 },
  { id: 'cyber-R-L1-infer', parent_id: 'cyber-R-L1', layer: 'R', level: 2, node_type: 'concept', name: 'infer', description: '从已知关系推断隐含关系', sort_order: 2, is_builtin: 1 },
  { id: 'cyber-R-L1-graph', parent_id: 'cyber-R-L1', layer: 'R', level: 2, node_type: 'concept', name: 'graph', description: '知识图谱持久化与查询', sort_order: 3, is_builtin: 1 },
  { id: 'cyber-R-L2', parent_id: 'cyber-R', layer: 'R', level: 1, node_type: 'impl_group', name: 'L2 实现层', description: '关系层的具体实现细节与流程', sort_order: 2, is_builtin: 1 },

  { id: 'cyber-V', parent_id: 'cyber-root', layer: 'V', level: 0, node_type: 'layer', name: 'V — 价值层', description: '5D reward 向量：local/global/now/future/certainty', sort_order: 3, is_builtin: 1 },
  { id: 'cyber-V-L0', parent_id: 'cyber-V', layer: 'V', level: 1, node_type: 'axiom_group', name: 'L0 公理层', description: '价值层公理：主观价值如何被量化为可优化信号？', sort_order: 0, is_builtin: 1 },
  { id: 'cyber-V-L1', parent_id: 'cyber-V', layer: 'V', level: 1, node_type: 'skeleton_group', name: 'L1 骨架层', description: '5D价值向量骨架', sort_order: 1, is_builtin: 1 },
  { id: 'cyber-V-L1-local', parent_id: 'cyber-V-L1', layer: 'V', level: 2, node_type: 'concept', name: 'local', description: '局部即时 reward（当前步骤质量）', sort_order: 0, is_builtin: 1 },
  { id: 'cyber-V-L1-global', parent_id: 'cyber-V-L1', layer: 'V', level: 2, node_type: 'concept', name: 'global', description: '全局目标对齐 reward（是否推进核心目标）', sort_order: 1, is_builtin: 1 },
  { id: 'cyber-V-L1-now', parent_id: 'cyber-V-L1', layer: 'V', level: 2, node_type: 'concept', name: 'now', description: '当下满意度（即时反馈）', sort_order: 2, is_builtin: 1 },
  { id: 'cyber-V-L1-future', parent_id: 'cyber-V-L1', layer: 'V', level: 2, node_type: 'concept', name: 'future', description: '未来价值（长期影响评估）', sort_order: 3, is_builtin: 1 },
  { id: 'cyber-V-L1-certainty', parent_id: 'cyber-V-L1', layer: 'V', level: 2, node_type: 'concept', name: 'certainty', description: '置信度（模型对 reward 评估的确定性）', sort_order: 4, is_builtin: 1 },
  { id: 'cyber-V-L2', parent_id: 'cyber-V', layer: 'V', level: 1, node_type: 'impl_group', name: 'L2 实现层', description: 'Reward function 注册、权重调整与 AOP 织入', sort_order: 2, is_builtin: 1 },

  { id: 'cyber-S', parent_id: 'cyber-root', layer: 'S', level: 0, node_type: 'layer', name: 'S — 状态层', description: 'E0/Task/Agent/Model 生命周期状态机', sort_order: 4, is_builtin: 1 },
  { id: 'cyber-S-L0', parent_id: 'cyber-S', layer: 'S', level: 1, node_type: 'axiom_group', name: 'L0 公理层', description: '状态层公理：系统任何时刻处于且仅处于一个合法状态', sort_order: 0, is_builtin: 1 },
  { id: 'cyber-S-L1', parent_id: 'cyber-S', layer: 'S', level: 1, node_type: 'skeleton_group', name: 'L1 骨架层', description: '生命周期定义与状态转换骨架', sort_order: 1, is_builtin: 1 },
  { id: 'cyber-S-L1-define', parent_id: 'cyber-S-L1', layer: 'S', level: 2, node_type: 'concept', name: 'define', description: '生命周期定义：合法状态集合与转换规则', sort_order: 0, is_builtin: 1 },
  { id: 'cyber-S-L1-transition', parent_id: 'cyber-S-L1', layer: 'S', level: 2, node_type: 'concept', name: 'transition', description: '状态转换：触发条件、副作用、回滚', sort_order: 1, is_builtin: 1 },
  { id: 'cyber-S-L1-lifecycle-e0', parent_id: 'cyber-S-L1', layer: 'S', level: 2, node_type: 'concept', name: 'lifecycle.e0', description: 'E0 全局生命周期：IDLE→OBSERVING→REFLECTING→TRAINING→VALIDATING→ACTIVATING', sort_order: 2, is_builtin: 1 },
  { id: 'cyber-S-L2', parent_id: 'cyber-S', layer: 'S', level: 1, node_type: 'impl_group', name: 'L2 实现层', description: '状态机实现：DB 持久化 + API + E0LifecycleManager', sort_order: 2, is_builtin: 1 },

  { id: 'cyber-E', parent_id: 'cyber-root', layer: 'E', level: 0, node_type: 'layer', name: 'E — 演化层', description: 'Diff 驱动的 SFT/GRPO 自主训练与模型版本管理', sort_order: 5, is_builtin: 1 },
  { id: 'cyber-E-L0', parent_id: 'cyber-E', layer: 'E', level: 1, node_type: 'axiom_group', name: 'L0 公理层', description: '演化层公理：模型的每次迭代必须有可追溯的 diff 驱动', sort_order: 0, is_builtin: 1 },
  { id: 'cyber-E-L1', parent_id: 'cyber-E', layer: 'E', level: 1, node_type: 'skeleton_group', name: 'L1 骨架层', description: '演化骨架：diff 积累 → 触发训练 → 验证 → 激活', sort_order: 1, is_builtin: 1 },
  { id: 'cyber-E-L1-diff', parent_id: 'cyber-E-L1', layer: 'E', level: 2, node_type: 'concept', name: 'diff', description: '行为偏差记录：{expected, actual, reward_delta, context}', sort_order: 0, is_builtin: 1 },
  { id: 'cyber-E-L1-trigger', parent_id: 'cyber-E-L1', layer: 'E', level: 2, node_type: 'concept', name: 'trigger', description: '训练触发条件：diff 数量阈值 / reward 下降 / 用户强制', sort_order: 1, is_builtin: 1 },
  { id: 'cyber-E-L1-train', parent_id: 'cyber-E-L1', layer: 'E', level: 2, node_type: 'concept', name: 'train', description: 'SFT / GRPO 异步训练任务', sort_order: 2, is_builtin: 1 },
  { id: 'cyber-E-L1-validate', parent_id: 'cyber-E-L1', layer: 'E', level: 2, node_type: 'concept', name: 'validate', description: '新版本验证：benchmark + 回归测试', sort_order: 3, is_builtin: 1 },
  { id: 'cyber-E-L1-activate', parent_id: 'cyber-E-L1', layer: 'E', level: 2, node_type: 'concept', name: 'activate', description: '热替换激活：旧版本保留快照，新版本上线', sort_order: 4, is_builtin: 1 },
  { id: 'cyber-E-L2', parent_id: 'cyber-E', layer: 'E', level: 1, node_type: 'impl_group', name: 'L2 实现层', description: 'LlamaFactory SFT/GRPO + 模型版本 API', sort_order: 2, is_builtin: 1 },
];

// ── Routes ───────────────────────────────────────────────────────

// GET /cybernetics/nodes
router.get('/cybernetics/nodes', (req, res) => {
  const { parent_id, layer } = req.query;
  let sql = 'SELECT * FROM cybernetics_nodes WHERE 1=1';
  const params = [];

  if (parent_id !== undefined) {
    if (parent_id === 'null' || parent_id === '') {
      sql += ' AND parent_id IS NULL';
    } else {
      sql += ' AND parent_id = ?';
      params.push(parent_id);
    }
  }
  if (layer) {
    sql += ' AND layer = ?';
    params.push(layer.toUpperCase());
  }
  sql += ' ORDER BY sort_order, name';

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(parseNode));
  });
});

// GET /cybernetics/nodes/:id
router.get('/cybernetics/nodes/:id', (req, res) => {
  db.get('SELECT * FROM cybernetics_nodes WHERE id = ?', [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'not found' });
    res.json(parseNode(row));
  });
});

// POST /cybernetics/nodes/seed  (must be before /:id)
router.post('/cybernetics/nodes/seed', (req, res) => {
  const sql = `INSERT OR IGNORE INTO cybernetics_nodes
    (id, parent_id, layer, level, node_type, name, description, content, sort_order, is_builtin, meta)
    VALUES (?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, '{}')`;

  let i = 0;
  const next = () => {
    if (i >= SEED_NODES.length) {
      return res.json({ ok: true, seeded: SEED_NODES.length });
    }
    const n = SEED_NODES[i++];
    db.run(sql, [n.id, n.parent_id, n.layer, n.level, n.node_type, n.name, n.description, n.sort_order, n.is_builtin], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      next();
    });
  };
  next();
});

// POST /cybernetics/nodes
router.post('/cybernetics/nodes', (req, res) => {
  const { parent_id = null, layer = null, level = 2, node_type = 'concept', name, description = '', content = [], sort_order = 0, meta = {} } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });

  const id = genId();
  const ts = now();
  db.run(
    `INSERT INTO cybernetics_nodes (id, parent_id, layer, level, node_type, name, description, content, sort_order, is_builtin, meta, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    [id, parent_id, layer, level, node_type, name.trim(), description, JSON.stringify(content), sort_order, JSON.stringify(meta), ts, ts],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      db.get('SELECT * FROM cybernetics_nodes WHERE id = ?', [id], (err2, row) => {
        if (err2) return res.status(500).json({ error: err2.message });
        res.status(201).json(parseNode(row));
      });
    }
  );
});

// PATCH /cybernetics/nodes/:id
router.patch('/cybernetics/nodes/:id', (req, res) => {
  db.get('SELECT * FROM cybernetics_nodes WHERE id = ?', [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'not found' });

    const { name, description, content, meta, sort_order, node_type, layer, level } = req.body;
    const updates = [];
    const params = [];

    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (content !== undefined) { updates.push('content = ?'); params.push(JSON.stringify(content)); }
    if (meta !== undefined) { updates.push('meta = ?'); params.push(JSON.stringify(meta)); }
    if (sort_order !== undefined) { updates.push('sort_order = ?'); params.push(sort_order); }
    if (node_type !== undefined) { updates.push('node_type = ?'); params.push(node_type); }
    if (layer !== undefined) { updates.push('layer = ?'); params.push(layer); }
    if (level !== undefined) { updates.push('level = ?'); params.push(level); }

    if (!updates.length) return res.json(parseNode(row));

    params.push(req.params.id);
    db.run(`UPDATE cybernetics_nodes SET ${updates.join(', ')} WHERE id = ?`, params, function(err2) {
      if (err2) return res.status(500).json({ error: err2.message });
      db.get('SELECT * FROM cybernetics_nodes WHERE id = ?', [req.params.id], (err3, updated) => {
        if (err3) return res.status(500).json({ error: err3.message });
        res.json(parseNode(updated));
      });
    });
  });
});

// DELETE /cybernetics/nodes/:id
router.delete('/cybernetics/nodes/:id', (req, res) => {
  db.get('SELECT id FROM cybernetics_nodes WHERE id = ?', [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'not found' });
    db.run('DELETE FROM cybernetics_nodes WHERE id = ?', [req.params.id], function(err2) {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ ok: true, id: req.params.id });
    });
  });
});

// POST /cybernetics/nodes/:id/page — 懒建关联 page
router.post('/cybernetics/nodes/:id/page', (req, res) => {
  db.get('SELECT * FROM cybernetics_nodes WHERE id = ?', [req.params.id], (err, node) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!node) return res.status(404).json({ error: 'node not found' });

    // 已有 page_id 直接返回
    if (node.page_id) return res.json({ page_id: node.page_id });

    const pageId = `cyber-page-${node.id}`;
    const ts = now();

    db.run(
      `INSERT OR IGNORE INTO pages (id, page_type, title, icon, position, created_at, updated_at)
       VALUES (?, 'cyber_node', ?, '🔷', 1.0, ?, ?)`,
      [pageId, node.name, ts, ts],
      function(err2) {
        if (err2) return res.status(500).json({ error: err2.message });

        db.run(
          'UPDATE cybernetics_nodes SET page_id = ? WHERE id = ?',
          [pageId, node.id],
          function(err3) {
            if (err3) return res.status(500).json({ error: err3.message });
            res.json({ page_id: pageId });
          }
        );
      }
    );
  });
});

// ── Diffs / Proposals ─────────────────────────────────────────────

// GET /cybernetics/diffs?node_id=&type=&resolution=
router.get('/cybernetics/diffs', (req, res) => {
  const { node_id, type, resolution } = req.query;
  let sql = 'SELECT * FROM cyber_diffs WHERE 1=1';
  const params = [];

  if (node_id) { sql += ' AND node_id = ?'; params.push(node_id); }
  if (type)    { sql += ' AND diff_type = ?'; params.push(type); }
  if (resolution) { sql += ' AND resolution = ?'; params.push(resolution); }
  sql += ' ORDER BY created_at DESC';

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(r => ({ ...r, diff_patch: JSON.parse(r.diff_patch || '{}') })));
  });
});

// GET /cybernetics/diffs/:id
router.get('/cybernetics/diffs/:id', (req, res) => {
  db.get('SELECT * FROM cyber_diffs WHERE id = ?', [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'not found' });
    res.json({ ...row, diff_patch: JSON.parse(row.diff_patch || '{}') });
  });
});

// GET /cybernetics/nodes/:id/proposals  — AI 提案列表（pending）
router.get('/cybernetics/nodes/:id/proposals', (req, res) => {
  db.all(
    "SELECT * FROM cyber_diffs WHERE node_id = ? AND resolution = 'pending' ORDER BY created_at DESC",
    [req.params.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows.map(r => ({ ...r, diff_patch: JSON.parse(r.diff_patch || '{}') })));
    }
  );
});

// POST /cybernetics/nodes/:id/resolve  — 接受 / 拒绝 AI 提案
// body: { diff_id, action: 'accept'|'reject', training_value? }
router.post('/cybernetics/nodes/:id/resolve', (req, res) => {
  const { diff_id, action, training_value } = req.body;
  if (!diff_id || !['accept', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'diff_id and action (accept|reject) required' });
  }

  const resolution = action === 'accept' ? 'accepted' : 'rejected';
  const resolvedBy = req.user?.username || req.user?.role || 'user';
  const ts = now();

  db.run(
    `UPDATE cyber_diffs SET resolution = ?, resolved_by = ?, training_value = ?, resolved_at = ? WHERE id = ? AND node_id = ?`,
    [resolution, resolvedBy, training_value ?? null, ts, diff_id, req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'diff not found for this node' });
      res.json({ ok: true, diff_id, resolution, resolved_by: resolvedBy });
    }
  );
});

module.exports = {
  init(database) {
    db = database;
    return router;
  },
};
