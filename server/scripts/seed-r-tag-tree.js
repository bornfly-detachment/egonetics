/**
 * seed-r-tag-tree.js
 * 将 R — Relation/关系 三问分类写入 tag_trees 表（幂等）
 */
const path   = require('path')
const sqlite = require('sqlite3').verbose()

const DB_PATH = path.join(__dirname, '../data/pages.db')
const db = new sqlite.Database(DB_PATH, err => {
  if (err) { console.error('❌ 无法打开 pages.db:', err.message); process.exit(1) }
})
db.run('PRAGMA foreign_keys=ON')

// [id, parent_id, name, color, sort_order, select_mode]
const nodes = [

  // ── 根节点 ──
  ['tag-r', null, 'R — Relation / 关系', '#ea580c', 4, 'multi'],

  // ══════════════════════════════════════════
  // 从哪来 Source
  // ══════════════════════════════════════════
  ['tag-r-source', 'tag-r', '从哪来 Source', '#0ea5e9', 0, 'multi'],

  // 系统元组件内在逻辑关系
  ['tag-r-src-sys',   'tag-r-source', '系统元组件内在逻辑', '#fb923c', 0, 'multi'],
  ['tag-r-src-sys-p', 'tag-r-src-sys', 'Pattern',            '#fdba74', 0, 'multi'],
  ['tag-r-src-sys-s', 'tag-r-src-sys', 'State',              '#fdba74', 1, 'multi'],
  ['tag-r-src-sys-e', 'tag-r-src-sys', 'Evolution',          '#fdba74', 2, 'multi'],
  ['tag-r-src-sys-v', 'tag-r-src-sys', 'Value',              '#fdba74', 3, 'multi'],

  // 通信（信息流向）
  ['tag-r-src-comm',       'tag-r-source', '通信（信息流向）',  '#f97316', 1, 'multi'],
  ['tag-r-src-comm-human', 'tag-r-src-comm', '人',             '#fed7aa', 0, 'multi'],
  ['tag-r-src-comm-ai',    'tag-r-src-comm', 'AI',             '#fed7aa', 1, 'multi'],
  ['tag-r-src-comm-env',   'tag-r-src-comm', '环境信息',       '#fed7aa', 2, 'multi'],
  ['tag-r-src-comm-sys',   'tag-r-src-comm', '系统内部通信机制','#fed7aa', 3, 'multi'],

  // 时间流向
  ['tag-r-src-time',      'tag-r-source', '时间流向',          '#c2410c', 2, 'multi'],
  ['tag-r-src-time-flow', 'tag-r-src-time', '不可逆单向时间流', '#fb923c', 0, 'multi'],
  ['tag-r-src-time-line', 'tag-r-src-time', '系统数据时间线',  '#fb923c', 1, 'multi'],

  // ══════════════════════════════════════════
  // 是什么 Nature
  // ══════════════════════════════════════════
  ['tag-r-nature', 'tag-r', '是什么 Nature', '#8b5cf6', 1, 'multi'],

  // ── A 基本属性 ──
  ['tag-r-n-basic', 'tag-r-nature', 'A 基本属性', '#7c3aed', 0, 'multi'],

  ['tag-r-n-dir',       'tag-r-n-basic', 'A1 方向性〔单选〕', '#818cf8', 0, 'single'],
  ['tag-r-n-dir-none',  'tag-r-n-dir',   '无向关系',          '#a5b4fc', 0, 'multi'],
  ['tag-r-n-dir-one',   'tag-r-n-dir',   '单向关系',          '#a5b4fc', 1, 'multi'],
  ['tag-r-n-dir-bi',    'tag-r-n-dir',   '双向关系',          '#a5b4fc', 2, 'multi'],

  ['tag-r-n-cert',       'tag-r-n-basic', 'A2 确定性〔单选〕', '#818cf8', 1, 'single'],
  ['tag-r-n-cert-det',   'tag-r-n-cert',  '确定性关系',        '#a5b4fc', 0, 'multi'],
  ['tag-r-n-cert-prob',  'tag-r-n-cert',  '概率性关系',        '#a5b4fc', 1, 'multi'],
  ['tag-r-n-cert-fuzzy', 'tag-r-n-cert',  '模糊关系',          '#a5b4fc', 2, 'multi'],

  ['tag-r-n-tseq',          'tag-r-n-basic', 'A3 时间性〔单选〕', '#818cf8', 2, 'single'],
  ['tag-r-n-tseq-simul',    'tag-r-n-tseq',  '同时关系',          '#a5b4fc', 0, 'multi'],
  ['tag-r-n-tseq-seq',      'tag-r-n-tseq',  '序列关系',          '#a5b4fc', 1, 'multi'],
  ['tag-r-n-tseq-cycle',    'tag-r-n-tseq',  '循环关系',          '#a5b4fc', 2, 'multi'],

  // ── B 关系性质 ──
  ['tag-r-n-type', 'tag-r-nature', 'B 关系性质', '#6d28d9', 1, 'multi'],

  ['tag-r-n-logic',         'tag-r-n-type', 'B1 逻辑关系',  '#8b5cf6', 0, 'multi'],
  ['tag-r-n-logic-ded',     'tag-r-n-logic', '演绎',         '#c4b5fd', 0, 'multi'],
  ['tag-r-n-logic-ind',     'tag-r-n-logic', '归纳',         '#c4b5fd', 1, 'multi'],
  ['tag-r-n-logic-ana',     'tag-r-n-logic', '类比',         '#c4b5fd', 2, 'multi'],

  ['tag-r-n-causal',        'tag-r-n-type', 'B2 因果关系',    '#8b5cf6', 1, 'multi'],
  ['tag-r-n-causal-dir',    'tag-r-n-causal', '直接因果',     '#c4b5fd', 0, 'multi'],
  ['tag-r-n-causal-indir',  'tag-r-n-causal', '间接因果',     '#c4b5fd', 1, 'multi'],
  ['tag-r-n-causal-counter','tag-r-n-causal', '反事实因果',   '#c4b5fd', 2, 'multi'],

  ['tag-r-n-process',       'tag-r-n-type', 'B3 过程关系',    '#8b5cf6', 2, 'multi'],
  ['tag-r-n-proc-cond',     'tag-r-n-process', '条件转化',    '#c4b5fd', 0, 'multi'],
  ['tag-r-n-proc-quant',    'tag-r-n-process', '量变积累',    '#c4b5fd', 1, 'multi'],
  ['tag-r-n-proc-qual',     'tag-r-n-process', '质变涌现',    '#c4b5fd', 2, 'multi'],

  // B4 辩证关系：三要素必须同时满足（multi，通常全选）
  ['tag-r-n-dialect',       'tag-r-n-type', 'B4 辩证关系（三要素）', '#8b5cf6', 3, 'multi'],
  ['tag-r-n-dial-opp',      'tag-r-n-dialect', 'oppose 根本对立',    '#c4b5fd', 0, 'multi'],
  ['tag-r-n-dial-trans',    'tag-r-n-dialect', 'transform 转化条件', '#c4b5fd', 1, 'multi'],
  ['tag-r-n-dial-unify',    'tag-r-n-dialect', 'unify 高层统一',     '#c4b5fd', 2, 'multi'],

  ['tag-r-n-strength',      'tag-r-n-type', 'B5 关系强度〔单选〕', '#818cf8', 4, 'single'],
  ['tag-r-n-str-pos',       'tag-r-n-strength', '正向关系',          '#a5b4fc', 0, 'multi'],
  ['tag-r-n-str-neg',       'tag-r-n-strength', '负向关系',          '#a5b4fc', 1, 'multi'],

  // ══════════════════════════════════════════
  // 去哪里 Destination
  // ══════════════════════════════════════════
  ['tag-r-dest', 'tag-r', '去哪里 Destination', '#059669', 2, 'multi'],
  ['tag-r-d1', 'tag-r-dest', 'R-D1 驱动推理',       '#10b981', 0, 'multi'],
  ['tag-r-d2', 'tag-r-dest', 'R-D2 支撑价值计算',   '#10b981', 1, 'multi'],
  ['tag-r-d3', 'tag-r-dest', 'R-D3 记录演化依据',   '#10b981', 2, 'multi'],
  ['tag-r-d4', 'tag-r-dest', 'R-D4 执行约束检查',   '#10b981', 3, 'multi'],
  ['tag-r-d5', 'tag-r-dest', 'R-D5 激活关联节点',   '#10b981', 4, 'multi'],
]

db.serialize(() => {
  db.run('BEGIN')
  const stmt = db.prepare(
    'INSERT OR IGNORE INTO tag_trees (id, parent_id, name, color, sort_order, select_mode) VALUES (?,?,?,?,?,?)'
  )
  let inserted = 0
  for (const [id, parent_id, name, color, sort_order, select_mode] of nodes) {
    stmt.run(id, parent_id, name, color, sort_order, select_mode, function(err) {
      if (err) console.warn(`  ⚠ 跳过 ${id}: ${err.message}`)
      else if (this.changes > 0) inserted++
    })
  }
  stmt.finalize()
  db.run('COMMIT', () => {
    console.log(`✅ R 分类写入完成：${inserted} 个节点（已存在的跳过）`)
    db.close()
  })
})
