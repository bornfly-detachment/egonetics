/**
 * seed-resource-tier.js
 * 智能资源分级 T0/T1/T2 — 存入 hm_protocol category='resource-tier'
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
    id: 'tier-t0', layer: 't0',
    human_char: '⚡ T0 直觉层 — 快速反应',
    note: '本地模型，零成本，可 RL 训练',
    sort: 400,
    uiVisual: JSON.stringify({
      tier: 0, label: '三级快速反应', emoji: '⚡',
      color: '#9ca3af', cost_per_1k: 0,
      rl_capable: true,
      escalate_if: 'confidence < 0.6', level: 3,
    }),
    machineLang: JSON.stringify({
      schema_version: '1', category: 'resource-tier', subtype: 't0',
      spec: {
        tier: 0,
        models: [{ id: 'qwen3.5-0.8b', type: 'local', priority: 1 }],
        routing: { escalate_if: 'confidence < 0.6', escalate_to_tier: 1, max_tokens: 512, timeout_ms: 2000 },
        cost: { per_1k_tokens: 0, currency: '¥' },
        rl_capable: true,
      },
    }),
  },
  {
    id: 'tier-t1', layer: 't1',
    human_char: '🔍 T1 理性层 — 分析处理',
    note: 'MiniMax API，skills 扩展',
    sort: 401,
    uiVisual: JSON.stringify({
      tier: 1, label: '二级分析处理', emoji: '🔍',
      color: '#60a5fa', cost_per_1k: 0.003,
      skills_enabled: true,
      escalate_if: 'complexity > 0.8', level: 2,
    }),
    machineLang: JSON.stringify({
      schema_version: '1', category: 'resource-tier', subtype: 't1',
      spec: {
        tier: 1,
        models: [{ id: 'MiniMax-M2.7', type: 'api', priority: 1 }],
        routing: {
          escalate_if: 'complexity > 0.8 || requires_expert',
          escalate_to_tier: 2, fallback_to_tier: 0,
          max_tokens: 4096, timeout_ms: 15000,
          skills: ['search', 'calc', 'summarize'],
        },
        cost: { per_1k_tokens: 0.003, currency: '¥' },
        rl_capable: false,
      },
    }),
  },
  {
    id: 'tier-t2', layer: 't2',
    human_char: '🧠 一级 — Claude 深度推理层',
    note: 'API 调用次数少，仅 skills 优化',
    sort: 402,
    uiVisual: JSON.stringify({
      tier: 2, label: '一级深度推理', emoji: '🧠',
      color: '#c084fc', cost_per_1k: 0.06,
      high_cost_warning: true, level: 1,
    }),
    machineLang: JSON.stringify({
      schema_version: '1', category: 'resource-tier', subtype: 't2',
      spec: {
        tier: 2, level: 1, name: 'Claude 深度推理层',
        models: [{ id: 'MiniMax-M2.7', type: 'api', priority: 1 }],
        routing: {
          escalate_if: null, fallback_to_tier: 1,
          max_tokens: 32000, timeout_ms: 120000,
          skills: ['all'], call_budget_per_day: 50,
        },
        cost: { per_1k_tokens: 0.06, currency: '¥' },
        rl_capable: false,
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
      e.id, 'resource-tier', e.layer, e.human_char,
      e.uiVisual, e.machineLang, e.note, e.sort,
    ], function(err) {
      if (err) console.error('❌', e.id, err.message)
      else     console.log('✅', e.id, '[' + e.layer + ']')
      if (--pending === 0) { db.close(); console.log('\n✔ resource-tier T0/T1/T2 seeded') }
    })
  }
})
