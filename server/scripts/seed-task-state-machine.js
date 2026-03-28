/**
 * seed-task-state-machine.js
 * 在 hm_protocol 中完备定义 Task 状态机三个维度
 * 幂等：INSERT OR REPLACE
 */
const path   = require('path')
const sqlite = require('sqlite3').verbose()

const DB_PATH = path.join(__dirname, '../data/pages.db')
const db = new sqlite.Database(DB_PATH, err => {
  if (err) { console.error('❌ 无法打开 pages.db:', err.message); process.exit(1) }
})

const entries = [
  {
    id: 'task-sm-lifecycle',
    category: 'S',
    layer: 'lifecycle',
    human_char: 'Task 生命周期',
    ui_visual: JSON.stringify({
      dimension: 'lifecycle',
      flow: 'directed-graph',
      initial: 'building',
      states: ['building', 'running', 'waiting', 'suspended', 'archived'],
      state_colors: {
        building:  '#3b82f6',
        running:   '#10b981',
        waiting:   '#f59e0b',
        suspended: '#6b7280',
        archived:  '#4b5563',
      },
      transitions: [
        { from: 'building',  to: 'running',   trigger: 'task.start',   guard: null },
        { from: 'running',   to: 'waiting',   trigger: 'task.block',   guard: null },
        { from: 'waiting',   to: 'running',   trigger: 'task.unblock', guard: null },
        { from: 'running',   to: 'suspended', trigger: 'task.pause',   guard: null },
        { from: 'suspended', to: 'running',   trigger: 'task.resume',  guard: null },
        { from: 'running',   to: 'archived',  trigger: 'task.done',    guard: 'V_reward >= threshold' },
        { from: 'suspended', to: 'archived',  trigger: 'task.abandon', guard: null },
      ],
    }),
    machine_lang: JSON.stringify({
      id: 'task-lifecycle',
      type: 'parallel-dimension',
      xstate: {
        id: 'lifecycle',
        initial: 'building',
        states: {
          building:  { on: { 'task.start': 'running' } },
          running:   { on: { 'task.block': 'waiting', 'task.pause': 'suspended', 'task.done': { target: 'archived', guard: 'rewardMet' } } },
          waiting:   { on: { 'task.unblock': 'running' } },
          suspended: { on: { 'task.resume': 'running', 'task.abandon': 'archived' } },
          archived:  { type: 'final' },
        },
      },
    }),
    notes: 'Task 从创建到归档的完整生命周期，task.done 受 V_reward 门控',
    sort_order: 100,
  },

  {
    id: 'task-sm-feedback',
    category: 'S',
    layer: 'feedback',
    human_char: 'Task 反馈回路',
    ui_visual: JSON.stringify({
      dimension: 'feedback',
      flow: 'feedback-loop',
      initial: 'positive_loop',
      states: ['positive_loop', 'negative_loop'],
      state_colors: {
        positive_loop: '#10b981',
        negative_loop: '#ef4444',
      },
      transitions: [
        { from: 'positive_loop', to: 'negative_loop', trigger: 'reward_drop',  guard: 'V_reward < threshold' },
        { from: 'negative_loop', to: 'positive_loop', trigger: 'correction',   guard: 'V_reward >= threshold' },
      ],
      loop_semantics: {
        positive_loop: '强化 — 继续当前策略',
        negative_loop: '修正 — 触发 Agent 纠偏',
      },
    }),
    machine_lang: JSON.stringify({
      id: 'task-feedback',
      type: 'parallel-dimension',
      xstate: {
        id: 'feedback',
        initial: 'positive_loop',
        states: {
          positive_loop: { on: { reward_drop: { target: 'negative_loop', guard: 'rewardBelowThreshold' } } },
          negative_loop: { on: { correction:  { target: 'positive_loop', guard: 'rewardMet' } } },
        },
      },
    }),
    notes: '正/负反馈回路，由 V 函数评分驱动切换',
    sort_order: 101,
  },

  {
    id: 'task-sm-execution',
    category: 'S',
    layer: 'execution',
    human_char: 'Task 执行结果',
    ui_visual: JSON.stringify({
      dimension: 'execution',
      flow: 'outcome-tree',
      initial: 'retrying',
      states: ['retrying', 'success', 'failure'],
      state_colors: {
        retrying: '#f59e0b',
        success:  '#10b981',
        failure:  '#ef4444',
      },
      transitions: [
        { from: 'retrying', to: 'success', trigger: 'exec.pass',          guard: 'V_reward >= threshold' },
        { from: 'retrying', to: 'failure', trigger: 'exec.exceed_retry',  guard: 'retry_count > max' },
        { from: 'failure',  to: 'retrying', trigger: 'exec.retry',        guard: null },
      ],
      terminal: ['success', 'failure'],
    }),
    machine_lang: JSON.stringify({
      id: 'task-execution',
      type: 'parallel-dimension',
      xstate: {
        id: 'execution',
        initial: 'retrying',
        states: {
          retrying: { on: {
            'exec.pass':         { target: 'success', guard: 'rewardMet' },
            'exec.exceed_retry': { target: 'failure', guard: 'retryExceeded' },
          }},
          success: { type: 'final' },
          failure: { on: { 'exec.retry': 'retrying' } },
        },
      },
    }),
    notes: '执行结果三态，success/failure 受 V_reward + retry_count 双重门控',
    sort_order: 102,
  },
]

db.serialize(() => {
  const sql = `
    INSERT OR REPLACE INTO hm_protocol
      (id, category, layer, human_char, ui_visual, machine_lang, notes, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `
  let pending = entries.length
  for (const e of entries) {
    db.run(sql,
      [e.id, e.category, e.layer, e.human_char, e.ui_visual, e.machine_lang, e.notes, e.sort_order],
      function(err) {
        if (err) console.error('❌', e.id, err.message)
        else console.log('✅', e.id, `(${e.layer})`)
        if (--pending === 0) db.close()
      }
    )
  }
})
