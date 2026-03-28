/**
 * migrate-ontology-v2.js
 * 将 bornfly-theory-ontology.yaml v1（嵌套 section 结构）
 * 迁移到 v2（扁平 layers / edge_types / nodes / edges 四数组结构）
 *
 * 运行：cd server && node scripts/migrate-ontology-v2.js
 * 备份：docs/bornfly-theory-ontology.v1.bak.yaml
 */

const fs   = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const SRC  = path.join(__dirname, '../../docs/bornfly-theory-ontology.yaml');
const BAK  = path.join(__dirname, '../../docs/bornfly-theory-ontology.v1.bak.yaml');

// ── v1 Section → Layer 映射 ────────────────────────────────────────────────
const SECTION_META = [
  { id: 'subjectivity_structure', layer: 0, label: '主体性结构层' },
  { id: 'axioms',                 layer: 1, label: '公理层'       },
  { id: 'epistemology',           layer: 2, label: '认识论层'     },
  { id: 'ontology',               layer: 3, label: '本体论层'     },
  { id: 'operating_system',       layer: 4, label: '操作系统层'   },
  { id: 'execution',              layer: 5, label: '执行层'       },
  { id: 'feedback',               layer: 6, label: '反馈迭代层'   },
  { id: 'interlocking_nodes',     layer: 7, label: '互锁节点'     },
  { id: 'core_tensions',          layer: 8, label: '核心矛盾'     },
];

// ── v1 关系字段 → 边类型 ───────────────────────────────────────────────────
const EDGE_FIELDS = [
  ['depends_on',             'DEPENDS_ON'],
  ['constrains',             'CONSTRAINS'],
  ['derives_from',           'DERIVES_FROM'],
  ['feedback_to',            'FEEDBACK_TO'],
  ['evaluates_via',          'EVALUATES_VIA'],
  ['triggers',               'TRIGGERED_BY'],
  ['implements',             'IMPLEMENTS'],
  ['protects',               'PROTECTS'],
  ['called_by',              'CALLED_BY'],
  ['filters_through_before', 'FILTERS_THROUGH'],
  ['participating',          'PARTICIPATES'],
  ['applies_to',             'APPLIES_TO'],
];

const EDGE_TYPE_DEFS = [
  { id: 'CONSTRAINS',     label: '约束',    color: '#ef4444', dash: false },
  { id: 'DEPENDS_ON',     label: '依赖',    color: '#6b7280', dash: false },
  { id: 'DERIVES_FROM',   label: '派生自',  color: '#3b82f6', dash: false },
  { id: 'FEEDBACK_TO',    label: '反馈至',  color: '#8b5cf6', dash: true  },
  { id: 'EVALUATES_VIA',  label: '经由评价',color: '#f97316', dash: false },
  { id: 'IMPLEMENTS',     label: '实现',    color: '#22c55e', dash: false },
  { id: 'PROTECTS',       label: '保护',    color: '#16a34a', dash: false },
  { id: 'FILTERS_THROUGH',label: '过滤进入',color: '#06b6d4', dash: false },
  { id: 'TRIGGERED_BY',   label: '触发',    color: '#eab308', dash: true  },
  { id: 'CALLED_BY',      label: '被调用',  color: '#14b8a6', dash: false },
  { id: 'PARTICIPATES',   label: '参与',    color: '#ec4899', dash: true  },
  { id: 'APPLIES_TO',     label: '作用于',  color: '#a78bfa', dash: false },
];

// ── 从 v1 节点对象里剔除关系字段，返回「纯属性」对象 ──────────────────────
const RELATION_KEYS = new Set(EDGE_FIELDS.map(([k]) => k));

function stripRelations(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!RELATION_KEYS.has(k)) out[k] = v;
  }
  return out;
}

// ── 主迁移逻辑 ─────────────────────────────────────────────────────────────
function migrate(data) {
  const nodes    = [];
  const edges    = [];
  const keyToId  = {};   // sectionKey → id
  const idSet    = new Set();
  const edgeSet  = new Set();

  // ── Pass 1: 收集所有节点 ──
  for (const { id: sectionId, layer, label } of SECTION_META) {
    const section = data[sectionId];
    if (!section || typeof section !== 'object') continue;

    for (const [nodeKey, nodeData] of Object.entries(section)) {
      if (typeof nodeData !== 'object' || Array.isArray(nodeData)) continue;

      const id = (nodeData.id && typeof nodeData.id === 'string')
        ? nodeData.id
        : nodeKey;

      keyToId[nodeKey] = id;
      idSet.add(id);

      // 过滤掉关系字段，保留其余所有字段
      const clean = stripRelations(nodeData);

      nodes.push({
        id,
        key: nodeKey,
        layer: sectionId,    // 引用 layer 的 id
        layerIndex: layer,
        layerLabel: label,
        ...clean,
      });
    }
  }

  // ── 解析器：key 或 id 都能解析 ──
  function resolveId(ref) {
    if (!ref || typeof ref !== 'string') return null;
    if (ref.length > 80 || ref.includes(' ')) return null;
    if (idSet.has(ref)) return ref;
    if (keyToId[ref] && idSet.has(keyToId[ref])) return keyToId[ref];
    return null;
  }

  // ── Pass 2: 提取边 ──
  let edgeCounter = 0;

  function addEdge(source, target, type) {
    if (!source || !target || source === target) return;
    const dedup = `${source}→${target}:${type}`;
    if (edgeSet.has(dedup)) return;
    edgeSet.add(dedup);
    edgeCounter++;
    edges.push({
      id:       `e-${String(edgeCounter).padStart(4, '0')}`,
      source,
      target,
      type,
      strength: 1.0,
    });
  }

  for (const { id: sectionId } of SECTION_META) {
    const section = data[sectionId];
    if (!section || typeof section !== 'object') continue;

    for (const [nodeKey, nodeData] of Object.entries(section)) {
      if (typeof nodeData !== 'object' || Array.isArray(nodeData)) continue;

      const sourceId = keyToId[nodeKey] || nodeKey;
      if (!idSet.has(sourceId)) continue;

      for (const [field, edgeType] of EDGE_FIELDS) {
        const refs = nodeData[field];
        if (!refs) continue;
        const list = Array.isArray(refs) ? refs : [refs];
        for (const ref of list) {
          const targetId = resolveId(ref);
          if (targetId) addEdge(sourceId, targetId, edgeType);
        }
      }
    }
  }

  return { nodes, edges };
}

// ── 主函数 ─────────────────────────────────────────────────────────────────
function main() {
  const raw  = fs.readFileSync(SRC, 'utf8');
  const data = yaml.load(raw);

  if (data.schema_version && String(data.schema_version).startsWith('2')) {
    console.log('✅ 已经是 v2 格式，无需迁移。');
    return;
  }

  console.log(`📄 读取 v1 (${data.schema_version || '?'})，开始迁移…`);

  // 备份
  fs.copyFileSync(SRC, BAK);
  console.log(`💾 v1 备份已保存至 ${BAK}`);

  const { nodes, edges } = migrate(data);

  const v2 = {
    schema_version: '2.0',
    author:         data.author || 'BornflyTheory / Egonetics',
    last_updated:   new Date().toISOString().split('T')[0],
    changelog:      {
      ...(data.changelog || {}),
      'v2.0': `迁移至扁平结构 (${nodes.length} 节点, ${edges.length} 边)`,
    },
    layers:     SECTION_META.map(({ id, layer, label }) => ({ id, layer, label })),
    edge_types: EDGE_TYPE_DEFS,
    nodes,
    edges,
  };

  const out = yaml.dump(v2, { lineWidth: 160, noRefs: true, quotingType: '"' });
  fs.writeFileSync(SRC, out, 'utf8');

  console.log(`✅ 迁移完成：${nodes.length} 节点, ${edges.length} 边`);
  console.log(`📝 已写回 ${SRC}`);
}

main();
