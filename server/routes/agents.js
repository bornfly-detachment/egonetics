/**
 * routes/agents.js
 * /api/agents — Agent CRUD + 关系 + 消息
 *
 * Phase 3 将实现完整功能。当前为 Phase 0 基础框架。
 */

const express = require('express');
const router = express.Router();

let agentsDb;

function init(db) {
  agentsDb = db;
  return router;
}

function genId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── Agents ─────────────────────────────────────────────────

router.get('/agents', (req, res) => {
  agentsDb.all('SELECT * FROM agents ORDER BY created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ agents: rows });
  });
});

router.post('/agents', (req, res) => {
  const { name, type = 'claude_code', model, role = 'worker', description, position_x = 0, position_y = 0 } = req.body;
  if (!name) return res.status(400).json({ error: 'name 必填' });

  const id = genId('agent');
  agentsDb.run(
    'INSERT INTO agents (id, name, type, model, role, description, position_x, position_y) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, name, type, model || null, role, description || null, position_x, position_y],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ success: true, id });
    }
  );
});

// NOTE: /agents/relations must be defined BEFORE /agents/:id to avoid route shadowing
router.get('/agents/relations', (req, res) => {
  agentsDb.all('SELECT * FROM agent_relations ORDER BY created_at', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ relations: rows });
  });
});

router.get('/agents/:id', (req, res) => {
  agentsDb.get('SELECT * FROM agents WHERE id = ?', [req.params.id], (err, agent) => {
    if (err || !agent) return res.status(404).json({ error: 'Agent 不存在' });
    res.json(agent);
  });
});

router.patch('/agents/:id', (req, res) => {
  const { name, type, model, role, description, status, position_x, position_y } = req.body;
  const updates = [], params = [];

  if (name        !== undefined) { updates.push('name = ?');        params.push(name); }
  if (type        !== undefined) { updates.push('type = ?');        params.push(type); }
  if (model       !== undefined) { updates.push('model = ?');       params.push(model); }
  if (role        !== undefined) { updates.push('role = ?');        params.push(role); }
  if (description !== undefined) { updates.push('description = ?'); params.push(description); }
  if (status      !== undefined) { updates.push('status = ?');      params.push(status); }
  if (position_x  !== undefined) { updates.push('position_x = ?'); params.push(position_x); }
  if (position_y  !== undefined) { updates.push('position_y = ?'); params.push(position_y); }

  if (updates.length === 0) return res.status(400).json({ error: '没有要更新的字段' });
  updates.push("updated_at = datetime('now')");
  params.push(req.params.id);

  agentsDb.run(`UPDATE agents SET ${updates.join(', ')} WHERE id = ?`, params, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Agent 不存在' });
    res.json({ success: true });
  });
});

router.delete('/agents/:id', (req, res) => {
  agentsDb.run('DELETE FROM agents WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Agent 不存在' });
    res.json({ success: true });
  });
});

// ── 关系 ───────────────────────────────────────────────────

router.post('/agents/relations', (req, res) => {
  const { from_agent, to_agent, type = 'sequential', condition } = req.body;
  if (!from_agent || !to_agent) return res.status(400).json({ error: 'from_agent/to_agent 必填' });

  const id = genId('rel');
  agentsDb.run(
    'INSERT INTO agent_relations (id, from_agent, to_agent, type, condition) VALUES (?, ?, ?, ?, ?)',
    [id, from_agent, to_agent, type, condition || null],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ success: true, id });
    }
  );
});

router.delete('/agents/relations/:id', (req, res) => {
  agentsDb.run('DELETE FROM agent_relations WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: '关系不存在' });
    res.json({ success: true });
  });
});

// ── 消息 ───────────────────────────────────────────────────

router.get('/agents/:id/messages', (req, res) => {
  agentsDb.all(
    'SELECT * FROM agent_messages WHERE from_id = ? OR to_id = ? ORDER BY created_at',
    [req.params.id, req.params.id], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ messages: rows });
    }
  );
});

router.post('/agents/messages', (req, res) => {
  const { from_id, to_id, content, type = 'message' } = req.body;
  if (!content) return res.status(400).json({ error: 'content 必填' });

  const id = genId('msg');
  agentsDb.run(
    'INSERT INTO agent_messages (id, from_id, to_id, content, type) VALUES (?, ?, ?, ?, ?)',
    [id, from_id || null, to_id || null, content, type],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ success: true, id });
    }
  );
});

module.exports = { init };
