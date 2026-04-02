/**
 * seed-kernel-protocol.js
 * Runtime Kernel 协议条目 — 实践层三个子分类
 *   kernel-comp : 感知器V1 / 测评器V2 / 记录器E / 控制器
 *   lifecycle   : 草稿 / 等待 / 执行中 / 测试中 / 正反馈 / 负反馈 / 归档
 *   graph-node  : 感知/规划/执行/测试/归档 节点类型
 * 幂等：INSERT OR REPLACE
 * 运行: node server/scripts/seed-kernel-protocol.js
 */
const path   = require('path')
const sqlite = require('sqlite3').verbose()

const DB_PATH = path.join(__dirname, '../data/pages.db')
const db = new sqlite.Database(DB_PATH, err => {
  if (err) { console.error('❌ DB open error:', err.message); process.exit(1) }
})

const entries = [
  // ── kernel-comp ──────────────────────────────────────────────────
  {
    id: 'kc-perception', category: 'kernel-comp', layer: 'v1', sort_order: 300,
    human_char: '👁 感知器 V1 — 环境监控与状态检测',
    notes: '持续监控任务状态变化，捕获底层信号，触发 Bottom-up',
    ui_visual: JSON.stringify({
      role: '感知器', version: 'V1', emoji: '👁', color: '#60a5fa',
      interface_in: ['环境信号', '任务事件', '执行错误'],
      interface_out: ['感知结果', 'Bottom-up 触发', '状态快照'],
      trigger: '持续监控 / 事件驱动',
    }),
    machine_lang: JSON.stringify({
      id: 'perception-v1', type: 'kernel-component', subtype: 'perception', version: 1,
      runs_in: 'runtime_kernel',
      inputs: ['env_signal', 'task_event', 'execution_error'],
      outputs: ['perception_result', 'bottom_up_trigger', 'state_snapshot'],
      trigger_mode: 'continuous|event',
    }),
  },
  {
    id: 'kc-evaluator', category: 'kernel-comp', layer: 'v2', sort_order: 301,
    human_char: '⚖️ 测评器 V2 — 结果评估与目标达成度',
    notes: '执行完毕后评估结果，输出测评表单，判断正/负反馈',
    ui_visual: JSON.stringify({
      role: '测评器', version: 'V2', emoji: '⚖️', color: '#a78bfa',
      interface_in: ['执行结果', '预期目标', '测评标准'],
      interface_out: ['测评表单', '正/负反馈信号', '目标达成度'],
      trigger: '执行完成后触发',
    }),
    machine_lang: JSON.stringify({
      id: 'evaluator-v2', type: 'kernel-component', subtype: 'evaluator', version: 2,
      runs_in: 'runtime_kernel',
      inputs: ['execution_result', 'expected_target', 'eval_criteria'],
      outputs: ['eval_form', 'feedback_signal', 'achievement_score'],
      trigger_mode: 'post_execution',
    }),
  },
  {
    id: 'kc-recorder', category: 'kernel-comp', layer: 'e', sort_order: 302,
    human_char: '📝 记录器 E — 事件日志与消耗追踪',
    notes: '记录所有事件、Token/时间/存储消耗、状态转移历史',
    ui_visual: JSON.stringify({
      role: '记录器', version: 'E', emoji: '📝', color: '#34d399',
      interface_in: ['系统事件', '资源消耗', '状态转移'],
      interface_out: ['结构化日志', '消耗报告', '可审计追踪'],
      trigger: '所有事件实时写入',
    }),
    machine_lang: JSON.stringify({
      id: 'recorder-e', type: 'kernel-component', subtype: 'recorder', version: 'E',
      runs_in: 'runtime_kernel',
      inputs: ['system_event', 'resource_consumption', 'state_transition'],
      outputs: ['structured_log', 'cost_report', 'audit_trail'],
      trigger_mode: 'always_on',
    }),
  },
  {
    id: 'kc-controller', category: 'kernel-comp', layer: 'ctrl', sort_order: 303,
    human_char: '🎛️ 控制器 — 生命周期协调与状态机驱动',
    notes: '协调四组件协作，驱动状态机转移，下发 Graph-V0',
    ui_visual: JSON.stringify({
      role: '控制器', version: 'CTRL', emoji: '🎛️', color: '#f59e0b',
      interface_in: ['感知信号', '测评结果', '人/T2 指令'],
      interface_out: ['状态转移指令', 'Graph-V0 下发', '资源调度'],
      trigger: '状态机事件 / 外部指令',
    }),
    machine_lang: JSON.stringify({
      id: 'controller', type: 'kernel-component', subtype: 'controller', version: 'CTRL',
      runs_in: 'runtime_kernel',
      inputs: ['perception_signal', 'eval_result', 'human_t2_command'],
      outputs: ['state_transition', 'graph_dispatch', 'resource_schedule'],
      trigger_mode: 'state_event|external',
    }),
  },

  // ── lifecycle ────────────────────────────────────────────────────
  {
    id: 'lc-draft', category: 'lifecycle', layer: 'l0', sort_order: 400,
    human_char: '📋 草稿 — 任务创建，未验证',
    notes: 'Human/T2 触发，任务结构存在，资源尚未分配',
    ui_visual: JSON.stringify({
      state: '草稿', color: '#6b7280', order: 0,
      transitions_to: ['等待'], trigger_condition: 'Human/T2 确认任务有效',
      bottom_up_trigger: null,
    }),
    machine_lang: JSON.stringify({ state_id: 'draft', order: 0, terminal: false }),
  },
  {
    id: 'lc-waiting', category: 'lifecycle', layer: 'l1', sort_order: 401,
    human_char: '⏳ 等待 — GlobalAI 建图，资源分配中',
    notes: 'GlobalAI 建立 Graph-V0，等待 LocalAI 就绪和资源确认',
    ui_visual: JSON.stringify({
      state: '等待', color: '#60a5fa', order: 1,
      transitions_to: ['执行中'], trigger_condition: 'Graph-V0 完毕 + 资源确认',
      bottom_up_trigger: '资源不足 → 回到草稿',
    }),
    machine_lang: JSON.stringify({ state_id: 'waiting', order: 1, terminal: false }),
  },
  {
    id: 'lc-running', category: 'lifecycle', layer: 'l2', sort_order: 402,
    human_char: '▶️ 执行中 — LocalAI 按 Graph-V0 逐节点执行',
    notes: 'GlobalAI/LocalAI 两个独立上下文，只与控制单元通信',
    ui_visual: JSON.stringify({
      state: '执行中', color: '#f59e0b', order: 2,
      transitions_to: ['测试中', '负反馈'],
      trigger_condition: '所有 Graph 节点完毕',
      bottom_up_trigger: '节点失败 / 资源耗尽 / 发现漏洞',
    }),
    machine_lang: JSON.stringify({ state_id: 'running', order: 2, terminal: false }),
  },
  {
    id: 'lc-testing', category: 'lifecycle', layer: 'l3', sort_order: 403,
    human_char: '🧪 测试中 — 测评器 V2 评估执行结果',
    notes: '客观测评表单 + 感知器反馈综合评估',
    ui_visual: JSON.stringify({
      state: '测试中', color: '#a78bfa', order: 3,
      transitions_to: ['正反馈', '负反馈'],
      trigger_condition: '测评器 V2 输出结论',
      bottom_up_trigger: null,
    }),
    machine_lang: JSON.stringify({ state_id: 'testing', order: 3, terminal: false }),
  },
  {
    id: 'lc-positive', category: 'lifecycle', layer: 'l4', sort_order: 404,
    human_char: '✅ 正反馈 — 测评通过，进入正向迭代',
    notes: '成功结果归档，触发 V1>V0 版本升级',
    ui_visual: JSON.stringify({
      state: '正反馈', color: '#34d399', order: 4,
      transitions_to: ['归档'], trigger_condition: '自动 → 归档',
      bottom_up_trigger: null,
    }),
    machine_lang: JSON.stringify({ state_id: 'positive', order: 4, terminal: false }),
  },
  {
    id: 'lc-negative', category: 'lifecycle', layer: 'l4b', sort_order: 405,
    human_char: '❌ 负反馈 — 执行失败，触发 Bottom-up 复盘',
    notes: '两条分支：追加资源原计划执行 / 重新制定计划',
    ui_visual: JSON.stringify({
      state: '负反馈', color: '#ef4444', order: 4,
      transitions_to: ['等待（追加资源）', '草稿（重新计划）'],
      trigger_condition: 'Bottom-up 复盘决策',
      bottom_up_trigger: 'always',
    }),
    machine_lang: JSON.stringify({ state_id: 'negative', order: 4, terminal: false, branch: ['retry_resource', 'replan'] }),
  },
  {
    id: 'lc-archived', category: 'lifecycle', layer: 'l5', sort_order: 406,
    human_char: '🗄️ 归档 — 记录器 E 封存，生命周期结束',
    notes: '所有消耗/结果/反馈写入不可篡改记录',
    ui_visual: JSON.stringify({
      state: '归档', color: '#6b7280', order: 5,
      transitions_to: [], trigger_condition: 'terminal 状态',
      bottom_up_trigger: null,
    }),
    machine_lang: JSON.stringify({ state_id: 'archived', order: 5, terminal: true }),
  },

  // ── graph-node ───────────────────────────────────────────────────
  {
    id: 'gn-sense', category: 'graph-node', layer: 'sense', sort_order: 500,
    human_char: '👁 感知节点 — 检测当前环境状态',
    notes: '由感知器V1驱动，输出环境快照给控制器',
    ui_visual: JSON.stringify({
      node_type: '感知节点', emoji: '👁', color: '#60a5fa',
      executor: 'LocalAI', driven_by: '感知器V1',
      input: 'task_context', output: 'env_snapshot',
    }),
    machine_lang: JSON.stringify({ node_type: 'sense', executor: 'local_ai', component: 'perception_v1' }),
  },
  {
    id: 'gn-plan', category: 'graph-node', layer: 'plan', sort_order: 501,
    human_char: '🧠 规划节点 — GlobalAI 生成 Graph-V0',
    notes: 'GlobalAI 独立上下文，输出完整执行图',
    ui_visual: JSON.stringify({
      node_type: '规划节点', emoji: '🧠', color: '#a78bfa',
      executor: 'GlobalAI', driven_by: '控制器',
      input: 'task_spec', output: 'graph_v0',
    }),
    machine_lang: JSON.stringify({ node_type: 'plan', executor: 'global_ai', component: 'controller' }),
  },
  {
    id: 'gn-execute', category: 'graph-node', layer: 'execute', sort_order: 502,
    human_char: '⚙️ 执行节点 — LocalAI 执行具体操作',
    notes: '按 Graph-V0 逐节点执行，结果回传控制器',
    ui_visual: JSON.stringify({
      node_type: '执行节点', emoji: '⚙️', color: '#f59e0b',
      executor: 'LocalAI', driven_by: '控制器',
      input: 'node_instruction', output: 'execution_result',
    }),
    machine_lang: JSON.stringify({ node_type: 'execute', executor: 'local_ai', component: 'controller' }),
  },
  {
    id: 'gn-test', category: 'graph-node', layer: 'test', sort_order: 503,
    human_char: '🧪 测试节点 — 测评器 V2 验证结果',
    notes: '输出 pass/fail + 详细测评表单',
    ui_visual: JSON.stringify({
      node_type: '测试节点', emoji: '🧪', color: '#a78bfa',
      executor: 'LocalAI', driven_by: '测评器V2',
      input: 'execution_result', output: 'eval_form',
    }),
    machine_lang: JSON.stringify({ node_type: 'test', executor: 'local_ai', component: 'evaluator_v2' }),
  },
  {
    id: 'gn-archive', category: 'graph-node', layer: 'archive', sort_order: 504,
    human_char: '🗄️ 归档节点 — 记录器 E 封存生命周期',
    notes: '关闭两个 AI 上下文，写入不可篡改日志',
    ui_visual: JSON.stringify({
      node_type: '归档节点', emoji: '🗄️', color: '#34d399',
      executor: '控制器', driven_by: '记录器E',
      input: 'lifecycle_summary', output: 'archived_record',
    }),
    machine_lang: JSON.stringify({ node_type: 'archive', executor: 'controller', component: 'recorder_e' }),
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
      e.id, e.category, e.layer, e.human_char,
      e.ui_visual, e.machine_lang, e.notes, e.sort_order,
    ], function (err) {
      if (err) console.error('❌', e.id, err.message)
      else     console.log('✅', e.id, `[${e.category}]`)
      if (--pending === 0) {
        db.close()
        console.log('\n✔ kernel-comp / lifecycle / graph-node seeded (', entries.length, 'entries )')
      }
    })
  }
})
