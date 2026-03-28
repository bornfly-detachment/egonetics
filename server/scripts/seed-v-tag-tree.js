/**
 * seed-v-tag-tree.js
 * 将 V — Value/Reward 三问分类写入 tag_trees 表（幂等）
 */
const path   = require('path')
const sqlite = require('sqlite3').verbose()

const DB_PATH = path.join(__dirname, '../data/pages.db')
const db = new sqlite.Database(DB_PATH, err => {
  if (err) { console.error('❌ 无法打开 pages.db:', err.message); process.exit(1) }
})
db.run('PRAGMA foreign_keys=ON')

// ── 节点定义 ──────────────────────────────────────────────────────────────
// [id, parent_id, name, color, sort_order, select_mode]
const nodes = [
  // ── 根节点 ──
  ['tag-v', null, 'V — Value / Reward', '#dc2626', 2, 'multi'],

  // ── 从哪来 Condition ──
  ['tag-v-source',       'tag-v', '从哪来 Condition', '#0ea5e9', 0, 'multi'],
  ['tag-v-src-computer', 'tag-v-source', 'C1 计算机系统', '#38bdf8', 0, 'multi'],
  ['tag-v-src-ai',       'tag-v-source', 'C2 AI 模型',    '#60a5fa', 1, 'multi'],
  ['tag-v-src-human',    'tag-v-source', 'C3 人',          '#a78bfa', 2, 'multi'],
  ['tag-v-src-h1',       'tag-v-src-human', '个体偏好',   '#c4b5fd', 0, 'multi'],
  ['tag-v-src-h2',       'tag-v-src-human', '群体共识',   '#c4b5fd', 1, 'multi'],

  // ── 是什么 Nature（5 个正交单选维度）──
  ['tag-v-nature',       'tag-v', '是什么 Nature', '#8b5cf6', 1, 'multi'],

  ['tag-v-n-temporal',   'tag-v-nature', '时间性〔单选〕',   '#818cf8', 0, 'single'],
  ['tag-v-n-static',     'tag-v-n-temporal',  '静态',         '#a5b4fc', 0, 'multi'],
  ['tag-v-n-dynamic',    'tag-v-n-temporal',  '动态',         '#a5b4fc', 1, 'multi'],

  ['tag-v-n-scope',      'tag-v-nature', '优化范围〔单选〕', '#818cf8', 1, 'single'],
  ['tag-v-n-local',      'tag-v-n-scope', '局部',            '#a5b4fc', 0, 'multi'],
  ['tag-v-n-global',     'tag-v-n-scope', '全局',            '#a5b4fc', 1, 'multi'],

  ['tag-v-n-certainty',  'tag-v-nature', '确定性〔单选〕',   '#818cf8', 2, 'single'],
  ['tag-v-n-det',        'tag-v-n-certainty', '确定性',       '#a5b4fc', 0, 'multi'],
  ['tag-v-n-uncer',      'tag-v-n-certainty', '不确定性',     '#a5b4fc', 1, 'multi'],

  ['tag-v-n-control',    'tag-v-nature', '可控性〔单选〕',   '#818cf8', 3, 'single'],
  ['tag-v-n-ctrl',       'tag-v-n-control', '可控',          '#a5b4fc', 0, 'multi'],
  ['tag-v-n-unctl',      'tag-v-n-control', '失控',          '#a5b4fc', 1, 'multi'],

  ['tag-v-n-baseline',   'tag-v-nature', '基线关系〔单选〕', '#818cf8', 4, 'single'],
  ['tag-v-n-maintain',   'tag-v-n-baseline', '维持 baseline', '#a5b4fc', 0, 'multi'],
  ['tag-v-n-challenge',  'tag-v-n-baseline', '挑战 baseline', '#a5b4fc', 1, 'multi'],

  // ── 去哪里 Destination ──
  ['tag-v-dest',    'tag-v', '去哪里 Destination',    '#059669', 2, 'multi'],
  ['tag-v-d1',      'tag-v-dest', 'D1 对齐人的价值偏好', '#10b981', 0, 'multi'],
  ['tag-v-d2',      'tag-v-dest', 'D2 对完成任务负责',  '#34d399', 1, 'multi'],
  ['tag-v-d3',      'tag-v-dest', 'D3 对系统进化负责',  '#2dd4bf', 2, 'multi'],
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
    console.log(`✅ V 分类写入完成：${inserted} 个节点（已存在的跳过）`)
    db.close()
  })
})
