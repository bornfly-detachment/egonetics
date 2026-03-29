/**
 * seed-permission-layers.js
 * 权限层级 T3/T2/T1/T0 — 存入 hm_protocol category='layer', layer='t3/t2/t1/t0'
 * 幂等：INSERT OR REPLACE
 */
const path   = require('path')
const sqlite = require('sqlite3').verbose()

const DB_PATH = path.join(__dirname, '../data/pages.db')
const db = new sqlite.Database(DB_PATH, err => {
  if (err) { console.error('❌ DB open error:', err.message); process.exit(1) }
})

const entries = [
  {
    id: 'perm-t3',
    layer: 't3',
    human_char: '👑 T3 原创开发者 — bornfly',
    note: '控制论系统最高权限，宪章可CRUD，主体性内核加密不可见',
    sort: 100,
    uiVisual: JSON.stringify({
      tier: 3, label: '原创开发者',
      color: '#f59e0b', icon: '👑',
      permissions: ['constitutional_crud', 'system_admin', 'agent_control', 'data_export'],
    }),
    machineLang: JSON.stringify({
      schema_version: '1', category: 'permission-layer', subtype: 't3',
      spec: {
        tier: 3, name: '原创开发者',
        subject: { type: 'human', id: 'bornfly' },
        permissions: ['constitutional_crud', 'system_admin', 'agent_control', 'data_export'],
        restrictions: [],
      },
    }),
  },
  {
    id: 'perm-t2',
    layer: 't2',
    human_char: '🧠 T2 Claude 系列模型',
    note: '项目开发 CRUD，生成开发计划，执行复杂推理',
    sort: 101,
    uiVisual: JSON.stringify({
      tier: 2, label: 'Claude 系列',
      color: '#8b5cf6', icon: '🧠',
      permissions: ['project_crud', 'plan_generation', 'complex_reasoning'],
    }),
    machineLang: JSON.stringify({
      schema_version: '1', category: 'permission-layer', subtype: 't2',
      spec: {
        tier: 2, name: 'Claude 系列模型',
        subject: { type: 'model', id: 'claude-*' },
        permissions: ['project_crud', 'plan_generation', 'complex_reasoning'],
        restrictions: ['no_constitutional_modify', 'no_system_admin'],
      },
    }),
  },
  {
    id: 'perm-t1',
    layer: 't1',
    human_char: '🔍 T1 Minimax — 理性执行层',
    note: '执行 T2 分配的任务，skills 扩展',
    sort: 102,
    uiVisual: JSON.stringify({
      tier: 1, label: 'Minimax',
      color: '#60a5fa', icon: '🔍',
      permissions: ['task_execution', 'skills_extend'],
    }),
    machineLang: JSON.stringify({
      schema_version: '1', category: 'permission-layer', subtype: 't1',
      spec: {
        tier: 1, name: 'Minimax 理性层',
        subject: { type: 'model', id: 'minimax-*' },
        permissions: ['task_execution', 'skills_extend'],
        restrictions: ['no_plan_generation', 'no_constitutional_read'],
      },
    }),
  },
  {
    id: 'perm-t0',
    layer: 't0',
    human_char: '⚡ T0 Qwen 0.8B — 直觉感知层',
    note: '挂载于感知器P、测评器V、状态感知S，需逻辑推理的R和E',
    sort: 103,
    uiVisual: JSON.stringify({
      tier: 0, label: 'Qwen 0.8B',
      color: '#9ca3af', icon: '⚡',
      permissions: ['perception', 'signal_sense', 'fast_response'],
      rl_capable: true,
    }),
    machineLang: JSON.stringify({
      schema_version: '1', category: 'permission-layer', subtype: 't0',
      spec: {
        tier: 0, name: 'Qwen 0.8B 本地直觉层',
        subject: { type: 'local_model', id: 'qwen3.5-0.8b' },
        mounted_on: ['P_感知器', 'V_测评器', 'S_状态感知'],
        permissions: ['perception', 'signal_sense', 'fast_response', 'rl_trainable'],
        restrictions: ['no_complex_reasoning', 'escalate_to_t1_for_R_E'],
      },
    }),
  },
]

const SQL = `
  INSERT OR REPLACE INTO hm_protocol
    (id, category, layer, human_char, ui_visual, machine_lang, notes, sort_order)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`

db.serialize(() => {
  let pending = entries.length
  for (const e of entries) {
    db.run(SQL, [
      e.id, 'layer', e.layer, e.human_char,
      e.uiVisual, e.machineLang, e.note, e.sort,
    ], function(err) {
      if (err) console.error('❌', e.id, err.message)
      else     console.log('✅', e.id, '[layer=' + e.layer + ']')
      if (--pending === 0) { db.close(); console.log('\n✔ permission-layers T3/T2/T1/T0 seeded') }
    })
  }
})
