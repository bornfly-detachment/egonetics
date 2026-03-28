/**
 * seed-reward-values.js
 * 完备定义 V = {objective, external, internal} 三维奖励向量
 * + φ 函数独立定义（V2/V3 运行时动态组合）
 * 幂等：INSERT OR REPLACE
 */
const path   = require('path')
const sqlite = require('sqlite3').verbose()

const DB_PATH = path.join(__dirname, '../data/pages.db')
const db = new sqlite.Database(DB_PATH, err => {
  if (err) { console.error('❌', err.message); process.exit(1) }
})

const entries = [

  // ── V1 客观物理计算类 × 5 ──────────────────────────────────────

  {
    id: 'v1-counter',
    category: 'V', layer: 'v1',
    human_char: '计数器 counter',
    ui_visual: JSON.stringify({
      display: 'counter',
      metric: 'counter',
      data_type: 'uint',
      unit: 'count',
      range: [0, null],
      examples: ['token_count', 'retry_count', 'step_count', 'error_count'],
    }),
    machine_lang: JSON.stringify({
      v_type: 'v1', metric: 'counter',
      data_type: 'uint', unit: 'count',
      aggregation: 'sum|max|last',
    }),
    notes: '正整数，不以人意志为转移',
    sort_order: 200,
  },

  {
    id: 'v1-timer',
    category: 'V', layer: 'v1',
    human_char: '计时器 / 时间消耗',
    ui_visual: JSON.stringify({
      display: 'timer',
      metric: 'timer',
      data_type: 'positive_real',
      unit: 's',
      range: [0, null],
      examples: ['time_elapsed', 'time_remaining', 'response_time', 'wait_duration'],
    }),
    machine_lang: JSON.stringify({
      v_type: 'v1', metric: 'timer',
      data_type: 'float', unit: 's',
      aggregation: 'sum|last',
    }),
    notes: '正实数秒，物理时间流逝',
    sort_order: 201,
  },

  {
    id: 'v1-token',
    category: 'V', layer: 'v1',
    human_char: 'Token 消耗',
    ui_visual: JSON.stringify({
      display: 'token_pair',
      metric: 'token_consumption',
      parts: ['input_tokens', 'output_tokens'],
      unit: 'K|M|B',
      examples: ['prompt_tokens', 'completion_tokens'],
    }),
    machine_lang: JSON.stringify({
      v_type: 'v1', metric: 'token_consumption',
      parts: { input: { unit: 'K', scale: 1000 }, output: { unit: 'K', scale: 1000 } },
      thresholds: { K: 1e3, M: 1e6, B: 1e9 },
    }),
    notes: 'Input/Output 分别计量，单位自动换算 K/M/B',
    sort_order: 202,
  },

  {
    id: 'v1-probability',
    category: 'V', layer: 'v1',
    human_char: 'usage% / 成功率 / 合规评分',
    ui_visual: JSON.stringify({
      display: 'probability_bar',
      metric: 'usage_pct',
      data_type: 'float_0_1',
      precision: 2,
      format: '0~1 ↔ 0.00%',
      examples: ['usage_pct', 'actual_success_rate', 'code_compliance', 'format_compliance', 'process_compliance'],
      note: '0~1概率与百分比是同一数值的两种展示形式',
    }),
    machine_lang: JSON.stringify({
      v_type: 'v1', metric: 'probability',
      data_type: 'float', range: [0, 1],
      display_precision: 2,
      dual_format: { probability: '0.7023', percentage: '70.23%' },
    }),
    notes: '0~1浮点，保留小数点后2位，70.23% = 0.70',
    sort_order: 203,
  },

  {
    id: 'v1-binary',
    category: 'V', layer: 'v1',
    human_char: '0/1 二分类',
    ui_visual: JSON.stringify({
      display: 'binary_indicator',
      metric: 'binary',
      data_type: 'boolean',
      values: [0, 1],
      symbols: { 0: '❎', 1: '✅' },
      examples: ['pass_fail', 'present_absent', 'valid_invalid', 'reachable_blocked'],
      note: '任何二元分类都是0/1信号',
    }),
    machine_lang: JSON.stringify({
      v_type: 'v1', metric: 'binary',
      data_type: 'int', values: [0, 1],
      semantic: '0=false/fail/absent, 1=true/pass/present',
    }),
    notes: '最小信息单元，✅/❎，是一切二元判断的底层信号',
    sort_order: 204,
  },

  // ── V2 控制论外部客体叙事 × 7 ────────────────────────────────

  {
    id: 'v2-confidence',
    category: 'V', layer: 'v2',
    human_char: '置信度',
    ui_visual: JSON.stringify({
      display: 'probability', dimension: 'v2',
      metric: 'confidence',
      semantic: '模型对当前输出正确性的主观评估',
      phi_capable: ['φ_dependency', 'φ_causal'],
    }),
    machine_lang: JSON.stringify({ v_type: 'v2', metric: 'confidence', output: [0, 1], precision: 2 }),
    notes: '外部叙事维度，运行时由 φ 因子图动态计算',
    sort_order: 210,
  },

  {
    id: 'v2-relevance',
    category: 'V', layer: 'v2',
    human_char: '相关概率',
    ui_visual: JSON.stringify({
      display: 'probability', dimension: 'v2',
      metric: 'relevance_prob',
      semantic: 'P(node_B 与 node_A 相关)',
      phi_capable: ['φ_dependency'],
    }),
    machine_lang: JSON.stringify({ v_type: 'v2', metric: 'relevance_prob', output: [0, 1], precision: 2 }),
    notes: '',
    sort_order: 211,
  },

  {
    id: 'v2-causal',
    category: 'V', layer: 'v2',
    human_char: '因果概率',
    ui_visual: JSON.stringify({
      display: 'probability', dimension: 'v2',
      metric: 'causal_prob',
      semantic: 'P(B | do(A)) — 干预因果而非相关',
      phi_capable: ['φ_causal'],
    }),
    machine_lang: JSON.stringify({ v_type: 'v2', metric: 'causal_prob', output: [0, 1], precision: 2 }),
    notes: '区分相关性与因果性，do-calculus 语义',
    sort_order: 212,
  },

  {
    id: 'v2-prediction',
    category: 'V', layer: 'v2',
    human_char: '预测概率（外部）',
    ui_visual: JSON.stringify({
      display: 'probability', dimension: 'v2',
      metric: 'prediction_prob',
      semantic: 'P(future_state | current_evidence) — 外部视角预测',
      phi_capable: ['φ_temporal', 'φ_causal'],
    }),
    machine_lang: JSON.stringify({ v_type: 'v2', metric: 'prediction_prob', output: [0, 1], precision: 2 }),
    notes: '外部叙事对未来状态的预测，区别于V3内部预测',
    sort_order: 213,
  },

  {
    id: 'v2-narrative-legitimacy',
    category: 'V', layer: 'v2',
    human_char: '叙事合法性概率',
    ui_visual: JSON.stringify({
      display: 'probability', dimension: 'v2',
      metric: 'narrative_legitimacy',
      semantic: '当前行动/叙事是否可被外部观察者接受',
      phi_capable: ['φ_dependency', 'φ_contradiction'],
    }),
    machine_lang: JSON.stringify({ v_type: 'v2', metric: 'narrative_legitimacy', output: [0, 1], precision: 2 }),
    notes: '',
    sort_order: 214,
  },

  {
    id: 'v2-narrative-completeness',
    category: 'V', layer: 'v2',
    human_char: '叙事完备性概率',
    ui_visual: JSON.stringify({
      display: 'probability', dimension: 'v2',
      metric: 'narrative_completeness',
      semantic: '叙事是否包含必要的所有节点和关系',
      phi_capable: ['φ_dependency'],
    }),
    machine_lang: JSON.stringify({ v_type: 'v2', metric: 'narrative_completeness', output: [0, 1], precision: 2 }),
    notes: '',
    sort_order: 215,
  },

  {
    id: 'v2-narrative-logic',
    category: 'V', layer: 'v2',
    human_char: '叙事逻辑性概率',
    ui_visual: JSON.stringify({
      display: 'probability', dimension: 'v2',
      metric: 'narrative_logic',
      semantic: '叙事内部是否无矛盾、推理链条完整',
      phi_capable: ['φ_contradiction', 'φ_causal'],
    }),
    machine_lang: JSON.stringify({ v_type: 'v2', metric: 'narrative_logic', output: [0, 1], precision: 2 }),
    notes: '',
    sort_order: 216,
  },

  // ── V3 控制论内部主体性叙事 × 5 ──────────────────────────────

  {
    id: 'v3-constitutional-rule',
    category: 'V', layer: 'v3',
    human_char: '自定宪法规则评价',
    ui_visual: JSON.stringify({
      display: 'probability', dimension: 'v3',
      metric: 'constitutional_rule',
      semantic: '当前行动是否符合主体自定宪法规则 rule_N',
      phi_capable: ['φ_dependency', 'φ_contradiction'],
      note: '模板条目，实例化时指定 rule_id',
    }),
    machine_lang: JSON.stringify({
      v_type: 'v3', metric: 'constitutional_rule',
      template: true,
      instance_fields: ['rule_id', 'rule_text', 'rule_weight'],
      output: [0, 1], precision: 2,
    }),
    notes: '宪法规则是确定性的 — 同输入必定同输出，非概率性',
    sort_order: 220,
  },

  {
    id: 'v3-value-alignment',
    category: 'V', layer: 'v3',
    human_char: '价值观评价',
    ui_visual: JSON.stringify({
      display: 'probability', dimension: 'v3',
      metric: 'value_alignment',
      semantic: '当前行动与主体声明价值观的对齐程度',
      phi_capable: ['φ_dependency', 'φ_contradiction'],
    }),
    machine_lang: JSON.stringify({ v_type: 'v3', metric: 'value_alignment', output: [0, 1], precision: 2 }),
    notes: '',
    sort_order: 221,
  },

  {
    id: 'v3-cognitive-eval',
    category: 'V', layer: 'v3',
    human_char: '认知评价',
    ui_visual: JSON.stringify({
      display: 'probability', dimension: 'v3',
      metric: 'cognitive_eval',
      semantic: '当前判断与主体已有认知模型的一致性',
      phi_capable: ['φ_dependency', 'φ_temporal'],
    }),
    machine_lang: JSON.stringify({ v_type: 'v3', metric: 'cognitive_eval', output: [0, 1], precision: 2 }),
    notes: '',
    sort_order: 222,
  },

  {
    id: 'v3-narrative-consistency',
    category: 'V', layer: 'v3',
    human_char: '叙事一致性评价',
    ui_visual: JSON.stringify({
      display: 'probability', dimension: 'v3',
      metric: 'narrative_consistency',
      semantic: '当前叙事与主体自我模型/历史叙事的一致性',
      phi_capable: ['φ_temporal', 'φ_contradiction'],
    }),
    machine_lang: JSON.stringify({ v_type: 'v3', metric: 'narrative_consistency', output: [0, 1], precision: 2 }),
    notes: '',
    sort_order: 223,
  },

  {
    id: 'v3-prediction',
    category: 'V', layer: 'v3',
    human_char: '预测概率（内部）',
    ui_visual: JSON.stringify({
      display: 'probability', dimension: 'v3',
      metric: 'prediction_prob_internal',
      semantic: '主体内部对自身下一步行动结果的预测',
      phi_capable: ['φ_temporal', 'φ_causal'],
      note: '区别于V2外部预测：这是自我预测，输入是内部状态',
    }),
    machine_lang: JSON.stringify({ v_type: 'v3', metric: 'prediction_prob_internal', output: [0, 1], precision: 2 }),
    notes: 'V2预测=外部观测者视角，V3预测=主体自我视角',
    sort_order: 224,
  },

  // ── φ 函数独立定义 × 4 ────────────────────────────────────────

  {
    id: 'phi-causal',
    category: 'V', layer: 'phi',
    human_char: 'φ_causal — 因果关系因子',
    ui_visual: JSON.stringify({
      display: 'phi_function',
      phi: 'φ_causal',
      semantic: '因果关系因子',
      formula: 'φ(A,B,E) = P(B | do(A)) · C(E)',
      formula_note: 'do-calculus 干预概率，C(E)=边约束强度',
      r_edge_mapping: ['derives', 'signal'],
      output: [0, 1],
    }),
    machine_lang: JSON.stringify({
      phi_id: 'φ_causal',
      r_edge_types: ['derives', 'signal'],
      formula: 'P(B|do(A)) * constraint_strength(E)',
      requires: ['intervention_target', 'edge_strength'],
    }),
    notes: 'PRVSE derives/signal 边触发此φ',
    sort_order: 230,
  },

  {
    id: 'phi-temporal',
    category: 'V', layer: 'phi',
    human_char: 'φ_temporal — 时序关系因子',
    ui_visual: JSON.stringify({
      display: 'phi_function',
      phi: 'φ_temporal',
      semantic: '时序关系因子',
      formula: 'φ(A,B,E) = P(B | A, t_A ≺ t_B)',
      formula_note: '时间先序关系，t_A必须先于t_B',
      r_edge_mapping: ['directed'],
      output: [0, 1],
    }),
    machine_lang: JSON.stringify({
      phi_id: 'φ_temporal',
      r_edge_types: ['directed'],
      formula: 'P(B|A) * indicator(t_A < t_B)',
      requires: ['timestamp_A', 'timestamp_B'],
    }),
    notes: 'PRVSE directed 边触发此φ，需要时间戳',
    sort_order: 231,
  },

  {
    id: 'phi-contradiction',
    category: 'V', layer: 'phi',
    human_char: 'φ_contradiction — 矛盾对立因子',
    ui_visual: JSON.stringify({
      display: 'phi_function',
      phi: 'φ_contradiction',
      semantic: '矛盾/对立一体因子',
      formula: 'φ(A,B,E) = 1 − |P(A) − P(B)| · tension(E)',
      formula_note: '对立统一：越接近0越矛盾，越接近1越统一',
      r_edge_mapping: ['mutual_constraint'],
      output: [0, 1],
    }),
    machine_lang: JSON.stringify({
      phi_id: 'φ_contradiction',
      r_edge_types: ['mutual_constraint'],
      formula: '1 - abs(P(A) - P(B)) * tension(E)',
      requires: ['prob_A', 'prob_B', 'tension_weight'],
    }),
    notes: 'PRVSE mutual_constraint 边触发，对应SliderWidget的矛盾↔统一轴',
    sort_order: 232,
  },

  {
    id: 'phi-dependency',
    category: 'V', layer: 'phi',
    human_char: 'φ_dependency — 依赖关系因子',
    ui_visual: JSON.stringify({
      display: 'phi_function',
      phi: 'φ_dependency',
      semantic: '依赖/包含关系因子',
      formula: 'φ(A,B,E) = P(B | A) · I(A → B)',
      formula_note: 'I=结构可达性指示函数，A可达B才有效',
      r_edge_mapping: ['constraint', 'contains'],
      output: [0, 1],
    }),
    machine_lang: JSON.stringify({
      phi_id: 'φ_dependency',
      r_edge_types: ['constraint', 'contains'],
      formula: 'P(B|A) * reachability_indicator(A, B, graph)',
      requires: ['graph_topology', 'conditional_prob'],
    }),
    notes: 'PRVSE constraint/contains 边触发，需要图可达性计算',
    sort_order: 233,
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
        else     console.log('✅', e.id, `[${e.layer}]`)
        if (--pending === 0) db.close()
      }
    )
  }
})
