/**
 * seed-communication-protocol.js
 * 通信机制 L0/L1/L2 — 存入 hm_protocol category='communication'
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
    id: 'comm-l0',
    layer: 'l0',
    human_char: '📋 L0 描述型通信 — 任务下发与反馈',
    note: '权限宽松，满足条件即过',
    sort: 200,
    uiVisual: JSON.stringify({
      level: 0, label: '描述型通信', color: '#34d399',
      scenarios: ['任务下发', '感知器输出', '测评器反馈', '执行结果回传'],
      policy: '宽松 · 条件校验',
      risk: '低',
    }),
    machineLang: JSON.stringify({
      schema_version: '1', category: 'communication', subtype: 'l0',
      spec: {
        level: 0, name: '描述型通信',
        risk: 'low',
        policy: '宽松 · 条件校验',
        scenarios: ['task_dispatch', 'sensor_output', 'evaluator_feedback', 'result_feedback'],
        routes_to: ['P_感知器', 'V_测评器', 'S_状态感知'],
        escalate_condition: null,
      },
    }),
  },
  {
    id: 'comm-l1',
    layer: 'l1',
    human_char: '⚠️ L1 请求型通信 — 权限申请与状态变更',
    note: '高风险，必须过 Policy Engine',
    sort: 201,
    uiVisual: JSON.stringify({
      level: 1, label: '请求型通信', color: '#f59e0b',
      scenarios: ['权限申请', '自底向上权限请求', '性质升级', '状态变更', '写入操作'],
      policy: 'Policy Engine 裁决',
      risk: '高',
    }),
    machineLang: JSON.stringify({
      schema_version: '1', category: 'communication', subtype: 'l1',
      spec: {
        level: 1, name: '请求型通信',
        risk: 'high',
        policy: 'Policy Engine 裁决',
        scenarios: ['permission_request', 'bottom_up_request', 'tier_escalate', 'state_change', 'write_operation'],
        routes_to: ['Policy_Engine'],
        escalate_condition: 'requires_policy_verdict',
        verdict: { allow: 'proceed', deny: 'return_error', modify: 'rewrite_and_retry' },
      },
    }),
  },
  {
    id: 'comm-l2',
    layer: 'l2',
    human_char: '🔒 L2 控制型通信 — 系统结构改造',
    note: '最危险，双重校验（规则 + 状态；可选 Human/T2 介入）',
    sort: 202,
    uiVisual: JSON.stringify({
      level: 2, label: '控制型通信', color: '#ef4444',
      scenarios: ['系统结构改造', '资源分配', '冲突裁决'],
      policy: '双重校验 · 规则+状态',
      risk: '极高',
      human_optional: true,
    }),
    machineLang: JSON.stringify({
      schema_version: '1', category: 'communication', subtype: 'l2',
      spec: {
        level: 2, name: '控制型通信',
        risk: 'critical',
        policy: '双重校验（规则 + 状态）',
        scenarios: ['system_structure_change', 'resource_allocation', 'conflict_arbitration'],
        routes_to: ['Control_Bus', 'Policy_Engine', 'State_Machine'],
        escalate_condition: 'always_require_verdict',
        verdict: { allow: 'execute', deny: 'block', modify: 'require_human_t2_review' },
        human_intervention: 'optional',
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
      e.id, 'communication', e.layer, e.human_char,
      e.uiVisual, e.machineLang, e.note, e.sort,
    ], function(err) {
      if (err) console.error('❌', e.id, err.message)
      else     console.log('✅', e.id, '[l' + e.layer + ']')
      if (--pending === 0) { db.close(); console.log('\n✔ communication L0/L1/L2 seeded') }
    })
  }
})
