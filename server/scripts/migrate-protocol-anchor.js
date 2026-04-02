#!/usr/bin/env node
/**
 * migrate-protocol-anchor.js
 *
 * 1. hm_protocol 加 anchor_tag_id 列
 * 2. TagTree 补齐 Protocol 缺失的节点（UI组件库、系统角色）
 * 3. 按 category 回填 anchor_tag_id
 * 4. 幂等：重复运行不报错
 */

const sqlite3 = require('sqlite3').verbose()
const path = require('path')

const DB_PATH = path.join(__dirname, '..', 'data', 'pages.db')
const db = new sqlite3.Database(DB_PATH)

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err)
      else resolve(this)
    })
  })
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err)
      else resolve(rows)
    })
  })
}

// category → tag_tree id 映射
const CATEGORY_ANCHOR_MAP = {
  'P':              'tag-p',
  'V':              'tag-v',
  'R':              'tag-r',
  'S':              'tag-s',
  'interaction':    'tag-1774859312423-vicym',   // E/人机交互协议
  'communication':  'tag-1774862243393-6np0u',   // E/人机交互协议/资源权限通信层
  'resource-tier':  'tag-1774862651534-yzhzl',   // E/人机交互协议/智能资源分级
  'layer':          'tag-1774561713452-bzfga',   // E/信息分级
  'lifecycle':      'tag-s',                      // S — 状态层 (生命周期 ⊂ 状态)
  'AOP':            'tag-r',                      // R — 关系层 (切面 ⊂ 关系)
  'ui-component':   'tag-e-ui-components',        // E/人机交互协议/UI组件库
  'kernel-comp':    'tag-e-system-roles',         // E/人机交互协议/系统角色
  'graph-node':     'tag-e-system-roles',         // 同义合并 → 系统角色
}

const PARENT_PROTOCOL = 'tag-1774859312423-vicym' // E/人机交互协议

async function main() {
  db.run('PRAGMA journal_mode = WAL')
  db.run('PRAGMA foreign_keys = ON')

  // ── Step 1: ALTER TABLE ───────────────────────────────────
  const cols = await all('PRAGMA table_info(hm_protocol)')
  if (!cols.find(c => c.name === 'anchor_tag_id')) {
    await run('ALTER TABLE hm_protocol ADD COLUMN anchor_tag_id TEXT REFERENCES tag_trees(id)')
    console.log('✓ Added anchor_tag_id column to hm_protocol')
  } else {
    console.log('· anchor_tag_id column already exists')
  }

  // ── Step 2: 补齐缺失 TagTree 节点 ────────────────────────
  const newNodes = [
    { id: 'tag-e-ui-components', parent_id: PARENT_PROTOCOL, name: 'UI 组件库', color: '#ec4899', select_mode: 'multi', sort_order: 50 },
    { id: 'tag-e-system-roles',  parent_id: PARENT_PROTOCOL, name: '系统角色', color: '#f97316', select_mode: 'multi', sort_order: 60 },
  ]

  for (const node of newNodes) {
    try {
      await run(
        `INSERT OR IGNORE INTO tag_trees (id, parent_id, name, color, select_mode, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [node.id, node.parent_id, node.name, node.color, node.select_mode, node.sort_order]
      )
      console.log(`✓ Ensured TagTree node: ${node.name} (${node.id})`)
    } catch (err) {
      console.error(`✗ Failed to create ${node.name}:`, err.message)
    }
  }

  // ── Step 3: 回填 anchor_tag_id ────────────────────────────
  let filled = 0
  for (const [category, anchor] of Object.entries(CATEGORY_ANCHOR_MAP)) {
    const r = await run(
      `UPDATE hm_protocol SET anchor_tag_id = ?, updated_at = datetime('now')
       WHERE category = ? AND (anchor_tag_id IS NULL OR anchor_tag_id = '')`,
      [anchor, category]
    )
    filled += r.changes
  }
  console.log(`✓ Backfilled ${filled} protocol rules with anchor_tag_id`)

  // ── Step 4: 验证 ──────────────────────────────────────────
  const orphans = await all(`
    SELECT id, category, substr(human_char, 1, 40) as hc
    FROM hm_protocol
    WHERE anchor_tag_id IS NULL OR anchor_tag_id = ''
  `)

  if (orphans.length === 0) {
    console.log('✓ All protocol rules have anchor_tag_id — no orphans')
  } else {
    console.log(`⚠ ${orphans.length} orphan rules without anchor:`)
    orphans.forEach(o => console.log(`  - [${o.category}] ${o.hc}`))
  }

  // ── Step 5: 统计 ──────────────────────────────────────────
  const stats = await all(`
    SELECT p.anchor_tag_id, t.name as tag_name, COUNT(*) as cnt
    FROM hm_protocol p
    LEFT JOIN tag_trees t ON p.anchor_tag_id = t.id
    GROUP BY p.anchor_tag_id
    ORDER BY cnt DESC
  `)

  console.log('\n── Anchor distribution ──')
  stats.forEach(s => console.log(`  ${s.tag_name || '(null)'}: ${s.cnt} rules`))

  db.close()
  console.log('\n✓ Migration complete')
}

main().catch(err => {
  console.error('Migration failed:', err)
  db.close()
  process.exit(1)
})
