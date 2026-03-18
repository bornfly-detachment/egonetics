/**
 * routes/graph.js
 * /api/graph — 图数据库 CRUD
 *
 * Page:        POST/GET/PUT /graph/pages, POST /graph/pages/:id/publish
 * Block:       POST/GET/PUT /graph/blocks, POST /graph/blocks/:id/publish
 * Relation:    POST/GET/PUT/DELETE /graph/relations (跨类型 Block/Page)
 *              POST /graph/relations/:id/publish
 * LabelSystem: POST/GET/PUT/DELETE /graph/label-systems
 *              POST /graph/label-systems/:id/publish
 * Label:       POST/GET/PUT/DELETE /graph/labels
 *              POST /graph/labels/:id/publish
 *              POST /graph/labels/:id/parent
 * LabelRel:    POST /graph/label-relations
 *              POST /graph/label-relations/:id/publish
 * HasLabel:    POST/DELETE /graph/has-labels
 * Traversal:   GET /graph/nodes/:type/:id/neighbors?depth=2
 *              GET /graph/label-systems/:id/graph
 */

const express = require('express');
const router = express.Router();
const { genId, makeContentEntry, parseContent, query, exec, formatNode } = require('../lib/graph');

const now = () => new Date().toISOString();

// ── 通用发布逻辑 ─────────────────────────────────────────────
async function publishNode(nodeType, id, explain) {
  const rows = await query(`MATCH (n:${nodeType} {id: $id}) RETURN n`, { id });
  if (!rows.length) return null;
  const node = rows[0].n;
  const list = parseContent(node.content);
  const startAt = list.length ? list[list.length - 1].timestamp.end : node.created_at;
  const entry = makeContentEntry(node.draft_content, explain, startAt);
  list.push(entry);
  await exec(
    `MATCH (n:${nodeType} {id: $id}) SET n.content = $content, n.current_content_id = $cid, n.updated_at = $ts`,
    { id, content: JSON.stringify(list), cid: entry.id, ts: now() }
  );
  return entry;
}

async function publishRel(relType, id, explain) {
  const rows = await query(`MATCH ()-[r:${relType} {id: $id}]->() RETURN r`, { id });
  if (!rows.length) return null;
  const r = rows[0].r;
  const list = parseContent(r.content);
  const startAt = list.length ? list[list.length - 1].timestamp.end : r.created_at;
  const entry = makeContentEntry(r.draft_content, explain, startAt);
  list.push(entry);
  await exec(
    `MATCH ()-[r:${relType} {id: $id}]->() SET r.content = $content, r.current_content_id = $cid, r.updated_at = $ts`,
    { id, content: JSON.stringify(list), cid: entry.id, ts: now() }
  );
  return entry;
}

// ══════════════════════════════════════════════════════════════
// PAGE
// ══════════════════════════════════════════════════════════════

router.post('/graph/pages', async (req, res) => {
  try {
    const { id, title = '', page_type = 'page', icon = '📄', source = 'manual', notion_id = '', draft_content = '' } = req.body;
    const pid = id || genId('page');
    const ts = now();
    await exec(
      `CREATE (:Page {id:$id, title:$title, page_type:$pt, icon:$icon, source:$src,
        notion_id:$nid, draft_content:$draft, content:'[]', current_content_id:'',
        created_at:$ts, updated_at:$ts})`,
      { id: pid, title, pt: page_type, icon, src: source, nid: notion_id, draft: draft_content, ts }
    );
    res.status(201).json({ id: pid, title, page_type, icon, source, notion_id, draft_content, content: [], created_at: ts });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/graph/pages/:id', async (req, res) => {
  try {
    const rows = await query('MATCH (n:Page {id:$id}) RETURN n', { id: req.params.id });
    if (!rows.length) return res.status(404).json({ error: 'Page 不存在' });
    res.json(formatNode(rows[0]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/graph/pages', async (req, res) => {
  try {
    const { source, page_type, limit = 50 } = req.query;
    let cypher = 'MATCH (n:Page)';
    const params = {};
    const conds = [];
    if (source) { conds.push('n.source = $source'); params.source = source; }
    if (page_type) { conds.push('n.page_type = $page_type'); params.page_type = page_type; }
    if (conds.length) cypher += ' WHERE ' + conds.join(' AND ');
    cypher += ` RETURN n ORDER BY n.created_at DESC LIMIT ${parseInt(limit)}`;
    const rows = await query(cypher, params);
    res.json({ pages: rows.map(r => formatNode(r)) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/graph/pages/:id', async (req, res) => {
  try {
    const { draft_content, title, icon } = req.body;
    const sets = ['n.updated_at = $ts'];
    const params = { id: req.params.id, ts: now() };
    if (draft_content !== undefined) { sets.push('n.draft_content = $draft'); params.draft = draft_content; }
    if (title !== undefined) { sets.push('n.title = $title'); params.title = title; }
    if (icon !== undefined) { sets.push('n.icon = $icon'); params.icon = icon; }
    await exec(`MATCH (n:Page {id:$id}) SET ${sets.join(', ')}`, params);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/graph/pages/:id/publish', async (req, res) => {
  try {
    const entry = await publishNode('Page', req.params.id, req.body.explain || '');
    if (!entry) return res.status(404).json({ error: 'Page 不存在' });
    res.json({ success: true, entry });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════
// BLOCK
// ══════════════════════════════════════════════════════════════

router.post('/graph/blocks', async (req, res) => {
  try {
    const { id, title = '', draft_content = '', content_type = 'paragraph', source = 'manual', page_id = '', notion_id = '' } = req.body;
    const bid = id || genId('block');
    const ts = now();
    await exec(
      `CREATE (:Block {id:$id, title:$title, draft_content:$draft, content:'[]', current_content_id:'',
        content_type:$ct, source:$src, page_id:$pid, notion_id:$nid, created_at:$ts, updated_at:$ts})`,
      { id: bid, title, draft: draft_content, ct: content_type, src: source, pid: page_id, nid: notion_id, ts }
    );
    res.status(201).json({ id: bid, title, draft_content, content: [], content_type, source, page_id, notion_id, created_at: ts });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/graph/blocks/:id', async (req, res) => {
  try {
    const rows = await query('MATCH (n:Block {id:$id}) RETURN n', { id: req.params.id });
    if (!rows.length) return res.status(404).json({ error: 'Block 不存在' });
    res.json(formatNode(rows[0]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/graph/blocks', async (req, res) => {
  try {
    const { source, page_id, limit = 50 } = req.query;
    let cypher = 'MATCH (n:Block)';
    const params = {};
    const conds = [];
    if (source) { conds.push('n.source = $source'); params.source = source; }
    if (page_id) { conds.push('n.page_id = $page_id'); params.page_id = page_id; }
    if (conds.length) cypher += ' WHERE ' + conds.join(' AND ');
    cypher += ` RETURN n ORDER BY n.created_at DESC LIMIT ${parseInt(limit)}`;
    const rows = await query(cypher, params);
    res.json({ blocks: rows.map(r => formatNode(r)) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/graph/blocks/:id', async (req, res) => {
  try {
    const { draft_content, title, content_type } = req.body;
    const sets = ['n.updated_at = $ts'];
    const params = { id: req.params.id, ts: now() };
    if (draft_content !== undefined) { sets.push('n.draft_content = $draft'); params.draft = draft_content; }
    if (title !== undefined) { sets.push('n.title = $title'); params.title = title; }
    if (content_type !== undefined) { sets.push('n.content_type = $ct'); params.ct = content_type; }
    await exec(`MATCH (n:Block {id:$id}) SET ${sets.join(', ')}`, params);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/graph/blocks/:id/publish', async (req, res) => {
  try {
    const entry = await publishNode('Block', req.params.id, req.body.explain || '');
    if (!entry) return res.status(404).json({ error: 'Block 不存在' });
    res.json({ success: true, entry });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/graph/blocks/:id/checkout', async (req, res) => {
  try {
    await exec('MATCH (n:Block {id:$id}) SET n.current_content_id = $cid, n.updated_at = $ts',
      { id: req.params.id, cid: req.body.content_entry_id, ts: now() });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════
// RELATION（跨类型：Block/Page ↔ Block/Page）
// ══════════════════════════════════════════════════════════════

const VALID_TYPES = new Set(['Block', 'Page']);

router.post('/graph/relations', async (req, res) => {
  try {
    const {
      from_id, from_type = 'Block',
      to_id,   to_type   = 'Block',
      draft_content = '', relation_hint = '',
      condition_type = 'always', condition_detail = '',
      is_cycle = false, confidence = 1.0, creator = 'user'
    } = req.body;

    if (!from_id || !to_id) return res.status(400).json({ error: 'from_id 和 to_id 必填' });
    if (!VALID_TYPES.has(from_type) || !VALID_TYPES.has(to_type))
      return res.status(400).json({ error: 'from_type/to_type 只能是 Block 或 Page' });

    const id = genId('rel');
    const ts = now();
    const props = `id:$id, from_id:$fid, from_type:$ft, to_id:$tid, to_type:$tt,
      draft_content:$draft, content:'[]', current_content_id:'',
      relation_hint:$hint, condition_type:$ct, condition_detail:$cd,
      is_cycle:$cycle, confidence:$conf, creator:$creator,
      created_at:$ts, updated_at:$ts`;

    await exec(
      `MATCH (a:${from_type} {id:$fid}), (b:${to_type} {id:$tid})
       CREATE (a)-[:RELATION {${props}}]->(b)`,
      { id, fid: from_id, ft: from_type, tid: to_id, tt: to_type,
        draft: draft_content, hint: relation_hint, ct: condition_type,
        cd: condition_detail, cycle: is_cycle, conf: confidence, creator, ts }
    );
    res.status(201).json({ id, from_id, from_type, to_id, to_type, draft_content, relation_hint, created_at: ts });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/graph/relations/:id', async (req, res) => {
  try {
    const rows = await query('MATCH ()-[r:RELATION {id:$id}]->() RETURN r', { id: req.params.id });
    if (!rows.length) return res.status(404).json({ error: 'Relation 不存在' });
    const r = rows[0].r;
    res.json({ ...r, content: parseContent(r.content) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/graph/relations/:id', async (req, res) => {
  try {
    const { draft_content, relation_hint, condition_type, condition_detail, confidence } = req.body;
    const sets = ['r.updated_at = $ts'];
    const params = { id: req.params.id, ts: now() };
    if (draft_content !== undefined) { sets.push('r.draft_content = $draft'); params.draft = draft_content; }
    if (relation_hint !== undefined) { sets.push('r.relation_hint = $hint'); params.hint = relation_hint; }
    if (condition_type !== undefined) { sets.push('r.condition_type = $ct'); params.ct = condition_type; }
    if (condition_detail !== undefined) { sets.push('r.condition_detail = $cd'); params.cd = condition_detail; }
    if (confidence !== undefined) { sets.push('r.confidence = $conf'); params.conf = confidence; }
    await exec(`MATCH ()-[r:RELATION {id:$id}]->() SET ${sets.join(', ')}`, params);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/graph/relations/:id/publish', async (req, res) => {
  try {
    const entry = await publishRel('RELATION', req.params.id, req.body.explain || '');
    if (!entry) return res.status(404).json({ error: 'Relation 不存在' });
    res.json({ success: true, entry });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/graph/relations/:id', async (req, res) => {
  try {
    await exec('MATCH ()-[r:RELATION {id:$id}]->() DELETE r', { id: req.params.id });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════
// LABEL SYSTEM
// ══════════════════════════════════════════════════════════════

router.post('/graph/label-systems', async (req, res) => {
  try {
    const { draft_content = '', creator = 'user' } = req.body;
    const id = genId('ls');
    const ts = now();
    await exec(
      `CREATE (:LabelSystem {id:$id, draft_content:$draft, content:'[]', current_content_id:'', creator:$creator, created_at:$ts, updated_at:$ts})`,
      { id, draft: draft_content, creator, ts }
    );
    res.status(201).json({ id, draft_content, content: [], creator, created_at: ts });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/graph/label-systems', async (req, res) => {
  try {
    const rows = await query('MATCH (n:LabelSystem) RETURN n ORDER BY n.created_at DESC');
    res.json({ label_systems: rows.map(r => formatNode(r)) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/graph/label-systems/:id', async (req, res) => {
  try {
    const rows = await query('MATCH (n:LabelSystem {id:$id}) RETURN n', { id: req.params.id });
    if (!rows.length) return res.status(404).json({ error: 'LabelSystem 不存在' });
    res.json(formatNode(rows[0]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/graph/label-systems/:id', async (req, res) => {
  try {
    await exec('MATCH (n:LabelSystem {id:$id}) SET n.draft_content = $draft, n.updated_at = $ts',
      { id: req.params.id, draft: req.body.draft_content, ts: now() });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/graph/label-systems/:id/publish', async (req, res) => {
  try {
    const entry = await publishNode('LabelSystem', req.params.id, req.body.explain || '');
    if (!entry) return res.status(404).json({ error: 'LabelSystem 不存在' });
    res.json({ success: true, entry });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/graph/label-systems/:id', async (req, res) => {
  try {
    await exec('MATCH (n:LabelSystem {id:$id}) DETACH DELETE n', { id: req.params.id });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════
// LABEL
// ══════════════════════════════════════════════════════════════

router.post('/graph/labels', async (req, res) => {
  try {
    const { system_id, draft_content = '', color = '#6366f1', abstraction_level = 0 } = req.body;
    if (!system_id) return res.status(400).json({ error: 'system_id 必填' });
    const id = genId('label');
    const ts = now();
    await exec(
      `CREATE (:Label {id:$id, draft_content:$draft, content:'[]', current_content_id:'',
        color:$color, abstraction_level:$level, system_id:$sid, created_at:$ts, updated_at:$ts})`,
      { id, draft: draft_content, color, level: abstraction_level, sid: system_id, ts }
    );
    await exec(
      `MATCH (l:Label {id:$lid}), (s:LabelSystem {id:$sid})
       CREATE (l)-[:BELONGS_TO {id:$rid, from_id:$lid, to_id:$sid, created_at:$ts}]->(s)`,
      { lid: id, sid: system_id, rid: genId('bt'), ts }
    );
    res.status(201).json({ id, draft_content, color, abstraction_level, system_id, content: [], created_at: ts });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/graph/labels', async (req, res) => {
  try {
    const { system_id } = req.query;
    let cypher = 'MATCH (n:Label)';
    const params = {};
    if (system_id) { cypher += ' WHERE n.system_id = $system_id'; params.system_id = system_id; }
    cypher += ' RETURN n ORDER BY n.abstraction_level DESC, n.created_at ASC';
    const rows = await query(cypher, params);
    res.json({ labels: rows.map(r => formatNode(r)) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/graph/labels/:id', async (req, res) => {
  try {
    const rows = await query('MATCH (n:Label {id:$id}) RETURN n', { id: req.params.id });
    if (!rows.length) return res.status(404).json({ error: 'Label 不存在' });
    res.json(formatNode(rows[0]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/graph/labels/:id', async (req, res) => {
  try {
    const { draft_content, color, abstraction_level } = req.body;
    const sets = ['n.updated_at = $ts'];
    const params = { id: req.params.id, ts: now() };
    if (draft_content !== undefined) { sets.push('n.draft_content = $draft'); params.draft = draft_content; }
    if (color !== undefined) { sets.push('n.color = $color'); params.color = color; }
    if (abstraction_level !== undefined) { sets.push('n.abstraction_level = $level'); params.level = abstraction_level; }
    await exec(`MATCH (n:Label {id:$id}) SET ${sets.join(', ')}`, params);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/graph/labels/:id/publish', async (req, res) => {
  try {
    const entry = await publishNode('Label', req.params.id, req.body.explain || '');
    if (!entry) return res.status(404).json({ error: 'Label 不存在' });
    res.json({ success: true, entry });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/graph/labels/:id', async (req, res) => {
  try {
    await exec('MATCH (n:Label {id:$id}) DETACH DELETE n', { id: req.params.id });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/graph/labels/:id/parent', async (req, res) => {
  try {
    const { parent_id } = req.body;
    const ts = now();
    await exec(
      `MATCH (c:Label {id:$cid}), (p:Label {id:$pid})
       CREATE (c)-[:LABEL_PARENT {id:$rid, from_id:$cid, to_id:$pid, created_at:$ts}]->(p)`,
      { cid: req.params.id, pid: parent_id, rid: genId('lp'), ts }
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════
// LABEL RELATION
// ══════════════════════════════════════════════════════════════

router.post('/graph/label-relations', async (req, res) => {
  try {
    const { from_id, to_id, draft_content = '', relation_hint = '',
            condition_type = 'always', condition_detail = '', creator = 'user' } = req.body;
    if (!from_id || !to_id) return res.status(400).json({ error: 'from_id 和 to_id 必填' });
    const id = genId('lr');
    const ts = now();
    await exec(
      `MATCH (a:Label {id:$from}), (b:Label {id:$to})
       CREATE (a)-[:LABEL_RELATION {id:$id, from_id:$from, to_id:$to,
         draft_content:$draft, content:'[]', current_content_id:'',
         relation_hint:$hint, condition_type:$ct, condition_detail:$cd,
         creator:$creator, created_at:$ts, updated_at:$ts}]->(b)`,
      { from: from_id, to: to_id, id, draft: draft_content, hint: relation_hint,
        ct: condition_type, cd: condition_detail, creator, ts }
    );
    res.status(201).json({ id, from_id, to_id, created_at: ts });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/graph/label-relations/:id/publish', async (req, res) => {
  try {
    const entry = await publishRel('LABEL_RELATION', req.params.id, req.body.explain || '');
    if (!entry) return res.status(404).json({ error: 'LabelRelation 不存在' });
    res.json({ success: true, entry });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════
// HAS_LABEL（Block 或 Page 打标签）
// ══════════════════════════════════════════════════════════════

router.post('/graph/has-labels', async (req, res) => {
  try {
    const { node_id, node_type = 'Block', label_id, confidence = 1.0, creator = 'user' } = req.body;
    if (!node_id || !label_id) return res.status(400).json({ error: 'node_id 和 label_id 必填' });
    if (!VALID_TYPES.has(node_type)) return res.status(400).json({ error: 'node_type 只能是 Block 或 Page' });
    const id = genId('hl');
    const ts = now();
    await exec(
      `MATCH (n:${node_type} {id:$nid}), (l:Label {id:$lid})
       CREATE (n)-[:HAS_LABEL {id:$id, from_id:$nid, from_type:$nt, to_id:$lid,
         draft_content:'', content:'[]', current_content_id:'',
         confidence:$conf, creator:$creator, created_at:$ts, updated_at:$ts}]->(l)`,
      { nid: node_id, nt: node_type, lid: label_id, id, conf: confidence, creator, ts }
    );
    res.status(201).json({ id, node_id, node_type, label_id, confidence, created_at: ts });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/graph/has-labels', async (req, res) => {
  try {
    const { node_id, node_type = 'Block', label_id } = req.body;
    await exec(
      `MATCH (:${node_type} {id:$nid})-[r:HAS_LABEL]->(:Label {id:$lid}) DELETE r`,
      { nid: node_id, lid: label_id }
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════
// TRAVERSAL — 核心查询
// ══════════════════════════════════════════════════════════════

// 从任意节点（Block 或 Page）向上/向下找邻居，depth 1-4
// GET /graph/nodes/:type/:id/neighbors?depth=2&direction=both|out|in
router.get('/graph/nodes/:type/:id/neighbors', async (req, res) => {
  try {
    const { type, id } = req.params;
    const depth = Math.min(parseInt(req.query.depth) || 2, 4);
    const dir = req.query.direction || 'both';
    if (!VALID_TYPES.has(type)) return res.status(400).json({ error: 'type 只能是 Block 或 Page' });

    const pattern = dir === 'out' ? `-[r:RELATION*1..${depth}]->` :
                    dir === 'in'  ? `<-[r:RELATION*1..${depth}]-` :
                                    `-[r:RELATION*1..${depth}]-`;

    // 邻居节点（不知道类型，用 UNION）
    const blockNeighbors = await query(
      `MATCH (start:${type} {id:$id})${pattern}(n:Block) RETURN DISTINCT n, 'Block' AS node_type`,
      { id }
    );
    const pageNeighbors = await query(
      `MATCH (start:${type} {id:$id})${pattern}(n:Page) RETURN DISTINCT n, 'Page' AS node_type`,
      { id }
    );

    // 边（扁平化）
    const edgeRows = await query(
      `MATCH (start:${type} {id:$id})${pattern}(n) RETURN r`,
      { id }
    );

    const nodes = [
      ...blockNeighbors.map(r => ({ ...formatNode(r), node_type: 'Block' })),
      ...pageNeighbors.map(r => ({ ...formatNode(r), node_type: 'Page' }))
    ];
    const edges = edgeRows.flatMap(r => {
      const rel = r.r;
      if (!rel) return [];
      if (Array.isArray(rel)) return rel.map(e => ({ ...e, content: parseContent(e.content) }));
      return [{ ...rel, content: parseContent(rel.content) }];
    });

    res.json({ nodes, edges });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// LabelSystem 图视图（Label 结构 + 挂载的 Block/Page）
router.get('/graph/label-systems/:id/graph', async (req, res) => {
  try {
    const sid = req.params.id;

    const labelRows = await query(
      'MATCH (l:Label)-[:BELONGS_TO]->(:LabelSystem {id:$sid}) RETURN l',
      { sid }
    );
    const parentRows = await query(
      `MATCH (a:Label)-[r:LABEL_PARENT]->(b:Label) WHERE a.system_id = $sid RETURN r`,
      { sid }
    );
    const relRows = await query(
      `MATCH (a:Label)-[r:LABEL_RELATION]->(b:Label) WHERE a.system_id = $sid RETURN r`,
      { sid }
    );
    const blockRows = await query(
      `MATCH (b:Block)-[hl:HAS_LABEL]->(l:Label)-[:BELONGS_TO]->(:LabelSystem {id:$sid})
       RETURN b, l.id AS label_id, hl.confidence AS confidence`,
      { sid }
    );
    const pageRows = await query(
      `MATCH (p:Page)-[hl:HAS_LABEL]->(l:Label)-[:BELONGS_TO]->(:LabelSystem {id:$sid})
       RETURN p, l.id AS label_id, hl.confidence AS confidence`,
      { sid }
    );

    res.json({
      labels: labelRows.map(r => formatNode(r, 'l')),
      blocks: blockRows.map(r => ({ ...formatNode(r, 'b'), node_type: 'Block', label_id: r.label_id, confidence: r.confidence })),
      pages:  pageRows.map(r => ({ ...formatNode(r, 'p'), node_type: 'Page', label_id: r.label_id, confidence: r.confidence })),
      label_edges: [
        ...parentRows.map(r => ({ ...r.r, edge_type: 'LABEL_PARENT' })),
        ...relRows.map(r => ({ ...r.r, content: parseContent(r.r.content), edge_type: 'LABEL_RELATION' }))
      ]
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = { init: () => router };
