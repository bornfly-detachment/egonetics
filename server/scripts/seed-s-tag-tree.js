/**
 * seed-s-tag-tree.js
 * 将 S — State/状态 三问分类写入 tag_trees 表（幂等）
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
  ['tag-s', null, 'S — State / 状态', '#0891b2', 3, 'multi'],

  // ── 从哪来 Source（驱动意图）──
  ['tag-s-source', 'tag-s', '从哪来 Source', '#0ea5e9', 0, 'multi'],
  ['tag-s-s1', 'tag-s-source', 'S1 完成任务驱动', '#38bdf8', 0, 'multi'],
  ['tag-s-s2', 'tag-s-source', 'S2 生存驱动',     '#38bdf8', 1, 'multi'],
  ['tag-s-s3', 'tag-s-source', 'S3 系统进化驱动', '#38bdf8', 2, 'multi'],
  ['tag-s-s4', 'tag-s-source', 'S4 探索驱动',     '#38bdf8', 3, 'multi'],

  // ── 是什么 Nature ──
  ['tag-s-nature', 'tag-s', '是什么 Nature', '#8b5cf6', 1, 'multi'],

  // A 节点分级〔单选〕
  ['tag-s-n-tier',     'tag-s-nature', 'A 节点分级〔单选〕', '#818cf8', 0, 'single'],
  ['tag-s-n-exec',     'tag-s-n-tier', '执行节点',           '#a5b4fc', 0, 'multi'],
  ['tag-s-n-sys',      'tag-s-n-tier', '系统节点',           '#a5b4fc', 1, 'multi'],
  ['tag-s-n-research', 'tag-s-n-tier', '研究性节点',         '#a5b4fc', 2, 'multi'],

  // B 节点状态机〔单选〕
  ['tag-s-n-sm',        'tag-s-nature', 'B 节点状态机〔单选〕', '#818cf8', 1, 'single'],
  ['tag-s-n-sm-build',  'tag-s-n-sm',  '构建中',              '#a5b4fc', 0, 'multi'],
  ['tag-s-n-sm-trial',  'tag-s-n-sm',  '试运行',              '#a5b4fc', 1, 'multi'],
  ['tag-s-n-sm-stable', 'tag-s-n-sm',  '稳定运行',            '#a5b4fc', 2, 'multi'],
  ['tag-s-n-sm-bug',    'tag-s-n-sm',  'Bug 挂起',            '#a5b4fc', 3, 'multi'],
  ['tag-s-n-sm-wait',   'tag-s-n-sm',  '等待指令挂起',        '#a5b4fc', 4, 'multi'],
  ['tag-s-n-sm-pos',    'tag-s-n-sm',  '正反馈迭代',          '#a5b4fc', 5, 'multi'],
  ['tag-s-n-sm-neg',    'tag-s-n-sm',  '负反馈预警',          '#a5b4fc', 6, 'multi'],
  ['tag-s-n-sm-arch',   'tag-s-n-sm',  '归档',                '#a5b4fc', 7, 'multi'],

  // ── 去哪里 Destination ──
  ['tag-s-dest',      'tag-s', '去哪里 Destination', '#059669', 2, 'multi'],

  // C 更新权属〔单选〕
  ['tag-s-d-owner',   'tag-s-dest', 'C 更新权属〔单选〕', '#0d9488', 0, 'single'],
  ['tag-s-d-auto',    'tag-s-d-owner', '自主状态更新',    '#2dd4bf', 0, 'multi'],
  ['tag-s-d-passive', 'tag-s-d-owner', '被动状态更新',    '#2dd4bf', 1, 'multi'],

  // D 更新影响
  ['tag-s-d-effect',  'tag-s-dest', 'D 更新影响',   '#10b981', 1, 'multi'],
  ['tag-s-d-e1',      'tag-s-d-effect', '触发上层感知', '#34d399', 0, 'multi'],
  ['tag-s-d-e2',      'tag-s-d-effect', '触发执行计划', '#34d399', 1, 'multi'],
  ['tag-s-d-e3',      'tag-s-d-effect', '触发进化记录', '#34d399', 2, 'multi'],
  ['tag-s-d-e4',      'tag-s-d-effect', '对外通知',     '#34d399', 3, 'multi'],
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
    console.log(`✅ S 分类写入完成：${inserted} 个节点（已存在的跳过）`)
    db.close()
  })
})
