/**
 * fix-prvse-protocol.js
 * 修正 seed-prvse-protocol.js 的偏差，对齐 prvse-compiler-design.md
 *
 * 修正清单（8 处）:
 *   1. [NEW]  P-comm/direction       — §2.6 通信方向 bottom_up/top_down/lateral
 *   2. [FIX]  R-l1/conditional       — §8.1 缺 feedback/dependency/emergence
 *   3. [FIX]  R-l2/dialectic         — §8.1 缺 trajectory/identity/meaning
 *   4. [FIX]  V-l0/metrics           — §9.2 缺 accuracy/recall/precision/f1
 *   5. [NEW]  V-l1/homeostasis       — §9.3 State Evaluator: homeostasis deviation + trigger
 *   6. [FIX]  S-l1/lifecycle         — §10.3 缺 suspended
 *   7. [NEW]  S-drive/forces         — §10.1 Driving Force S1-S4
 *   8. [NEW]  E-transition/levels    — §11.4 Level Transitions L2→L1→L0
 *
 * 运行: cd server && node scripts/fix-prvse-protocol.js
 */

const path = require('path')
const sqlite3 = require('sqlite3').verbose()

const DB_PATH = path.resolve(__dirname, '../data/pages.db')
const db = new sqlite3.Database(DB_PATH)

let counter = 0
function genId() {
  return `proto-prvse-fix-${Date.now()}-${(counter++).toString(36).padStart(3, '0')}`
}

// ── UPDATE: 修正已有条目 ────────────────────────────────────────────

const UPDATES = [
  // 2. R-l1 补全 feedback/dependency/emergence (§8.1 Compositions)
  {
    id: 'proto-prvse-1775295550182-005',
    ui_visual: JSON.stringify({
      type: 'relation-card',
      subtypes: [
        // Primitives
        { id: 'condition', label: '条件关系', desc: 'A存在则B的概率', icon: 'GitBranch' },
        { id: 'temporal', label: '时间关系', desc: '序列/循环/同时', icon: 'Clock' },
        // Compositions
        { id: 'causal', label: '因果关系', desc: '条件+时间先后', icon: 'Zap' },
        { id: 'process', label: '过程关系', desc: '量变→质变→涌现', icon: 'TrendingUp' },
        { id: 'feedback', label: '反馈关系', desc: '输出影响输入，正/负反馈回路', icon: 'RefreshCw' },
        { id: 'dependency', label: '依赖关系', desc: 'A完成才能启动B', icon: 'Link' },
        { id: 'emergence', label: '涌现关系', desc: '大量L0交互产生L1/L2新性质', icon: 'Sparkles' },
      ],
    }),
    machine_lang: '{ "layer": "l1", "primitives": ["condition","temporal"], "compositions": ["causal","process","feedback","dependency","emergence"], "certainty": "probabilistic" }',
  },

  // 3. R-l2 补全 trajectory/identity/meaning (§8.1 Narrative 子类)
  {
    id: 'proto-prvse-1775295550182-006',
    ui_visual: JSON.stringify({
      type: 'relation-card',
      subtypes: [
        // Narrative
        { id: 'narrative', label: '主体性叙事', desc: '实践轨迹/自我认知/意义建构', icon: 'BookOpen' },
        { id: 'trajectory', label: '实践轨迹', desc: '经历链条，时间线上的实践积累', icon: 'Route' },
        { id: 'identity', label: '身份认同', desc: '自我叙事与外部标签的关系', icon: 'Fingerprint' },
        { id: 'meaning', label: '意义建构', desc: '赋予事件价值和目的', icon: 'Lightbulb' },
        // Dialectic
        { id: 'oppose', label: '根本对立', desc: '可控-失控、有限-无限', icon: 'Swords' },
        { id: 'transform', label: '转化条件', desc: '矛盾双方在条件下转化', icon: 'RefreshCw' },
        { id: 'unify', label: '高层统一', desc: '矛盾在更高层面整合', icon: 'Merge' },
      ],
      slider: { left: '矛盾/对立', right: '统一/融合', default: 0.5 },
    }),
    machine_lang: '{ "layer": "l2", "narrative": ["trajectory","identity","meaning"], "dialectic": ["oppose","transform","unify"], "certainty": "fuzzy", "slider": "[0,1]" }',
  },

  // 4. V-l0/metrics 补全 accuracy/recall/precision/f1 (§9.2 共10个)
  {
    id: 'proto-prvse-1775295550182-007',
    ui_visual: JSON.stringify({
      type: 'metrics-dashboard',
      metrics: [
        { id: 'accuracy', label: '准确率', unit: '%', icon: 'Target', format: 'percent', range: [0, 1] },
        { id: 'recall', label: '召回率', unit: '%', icon: 'Crosshair', format: 'percent', range: [0, 1] },
        { id: 'precision', label: '精确率', unit: '%', icon: 'Focus', format: 'percent', range: [0, 1] },
        { id: 'f1', label: 'F1 Score', unit: '', icon: 'Gauge', format: 'number', range: [0, 1] },
        { id: 'counter', label: '计数器', unit: 'count', icon: 'Hash', format: 'integer' },
        { id: 'timer', label: '计时器', unit: 's', icon: 'Timer', format: 'duration' },
        { id: 'token', label: 'Token 消耗', unit: 'K', icon: 'Coins', format: 'number', sub: ['input', 'output'] },
        { id: 'roi', label: 'ROI', unit: 'x', icon: 'TrendingUp', format: 'ratio', formula: 'output_value / input_cost' },
        { id: 'marginal', label: '边际收益', unit: '', icon: 'BarChart2', format: 'number', alert: '趋近0则该停' },
        { id: 'binary', label: '通过/不通过', unit: '', icon: 'CheckCircle', format: 'boolean' },
      ],
    }),
    machine_lang: '{ "table": "v_metrics", "fields": ["metric_id","value","unit","timestamp"], "auto_collect": true, "metrics_count": 10 }',
  },

  // 6. S-l1/lifecycle 补全 suspended (§10.3 共9个)
  {
    id: 'proto-prvse-1775295550182-00f',
    ui_visual: JSON.stringify({
      type: 'lifecycle-pipeline',
      stages: [
        { id: 'research', label: '技术调研', icon: 'Search', color: '#60a5fa' },
        { id: 'proposal', label: '方案构建', icon: 'FileText', color: '#818cf8' },
        { id: 'building', label: '构建中', icon: 'Hammer', color: '#fbbf24' },
        { id: 'executing', label: '执行中', icon: 'Play', color: '#34d399' },
        { id: 'testing', label: 'V测试中', icon: 'FlaskConical', color: '#fb923c' },
        { id: 'feedback', label: '反馈迭代', icon: 'RefreshCw', color: '#f472b6' },
        { id: 'delivered', label: '版本交付', icon: 'Package', color: '#22d3ee' },
        { id: 'suspended', label: '挂起', icon: 'Pause', color: '#f59e0b', desc: '等待外部依赖/资源补充/L2决策' },
        { id: 'archived', label: '归档', icon: 'Archive', color: '#6b7280' },
      ],
      feedback_loop: {
        positive: '继续推进',
        negative: '分析根因（实践/方案/数据量/训练方法）',
        circuit_breaker: '连续N次失败/资源耗尽 → 归档或上报L2',
      },
      version_tracking: 'V0 → V1 → V2... 每次迭代记录方案变更和效果delta',
    }),
    machine_lang: '{ "table": "s_l1_lifecycle", "field": "stage", "stages": 9, "version": "integer", "feedback": {"positive":"continue","negative":"analyze","circuit_breaker":"archive_or_escalate"}, "resource_binding": "v_l1_budget + v_l1_perceiver" }',
  },
]

// ── INSERT: 新增缺失条目 ────────────────────────────────────────────

const INSERTS = [
  // 1. P-comm: Communication Direction (§2.6)
  {
    category: 'P-comm', layer: 'direction',
    human_char: 'Pattern 通信方向 — bottom_up / top_down / lateral',
    anchor_tag_id: 'tag-p-comm',
    ui_visual: JSON.stringify({
      type: 'comm-direction-cards',
      directions: [
        { id: 'bottom_up', label: '自下而上', color: '#34d399', icon: 'ArrowUp',
          desc: 'L1涌现→L2候选（需规则验证+人确认）' },
        { id: 'top_down', label: '自上而下', color: '#60a5fa', icon: 'ArrowDown',
          desc: '高层抽象指导实践' },
        { id: 'lateral', label: '同层通信', color: '#a78bfa', icon: 'ArrowLeftRight',
          desc: '由R+宪法规则决定，A→B / 广播' },
      ],
      constitutional_rules: [
        '高层级≠更大权力≠控制低层级',
        '模型智能分级≠固定能力排序',
        '本地模型训练后T0可掌握L2，权威由实践和客观规则确认',
      ],
    }),
    machine_lang: '{ "field": "communication", "enum": ["bottom_up","top_down","lateral"], "gradual": true, "scanner_resolved": false }',
    notes: '§2.6: 高层≠权力。能力至上，权威由实践确认。Scanner阶段此字段unresolved。',
    sort_order: 45,
  },

  // 5. V-l1/homeostasis: State Evaluator (§9.3)
  {
    category: 'V-l1', layer: 'homeostasis',
    human_char: 'V-L1 稳态偏离检测 — homeostasis deviation [0,1] + 偏离触发器',
    anchor_tag_id: 'tag-v-l1',
    ui_visual: JSON.stringify({
      type: 'homeostasis-gauge',
      deviation: {
        range: [0, 1],
        threshold: 0.7,
        label: '稳态偏离度',
        icon: 'Activity',
        semantic: '距健康基线的距离（生物学稳态），量化非布尔',
      },
      evaluators: [
        { id: 'pos_neg', label: '正/负反馈', desc: '资源消耗 vs 清单完成方向', icon: 'TrendingUp' },
        { id: 'local_global', label: '局部/全局最优检测', desc: '局部方案完成部分目标，但剩余高权重目标不可能/成本过高 → 强制停止', icon: 'Eye' },
        { id: 'deviation_trigger', label: '偏离触发', desc: '超阈值 → 强制停止，重新规划', icon: 'AlertTriangle', color: '#ef4444' },
      ],
    }),
    machine_lang: '{ "field": "homeostasis_deviation", "type": "float[0,1]", "threshold": 0.7, "trigger": "force_stop_replan", "monitors": ["local_global_optimal","pos_neg_feedback"] }',
    notes: '§9.3 State Evaluator: 偏离阈值超过 → 触发偏离检测，强制重新规划。',
    sort_order: 218,
  },

  // 7. S-drive: Driving Force S1-S4 (§10.1)
  {
    category: 'S-drive', layer: 'forces',
    human_char: 'S 驱动力 — S1任务驱动 / S2生存驱动 / S3进化驱动 / S4探索驱动',
    anchor_tag_id: 'tag-s',
    ui_visual: JSON.stringify({
      type: 'driving-force-cards',
      forces: [
        { id: 'S1', label: '任务驱动', color: '#34d399', icon: 'ListChecks',
          desc: '具体目标分解为可执行任务' },
        { id: 'S2', label: '生存驱动', color: '#f87171', icon: 'HeartPulse',
          desc: '系统自维护，资源不足，健康检查' },
        { id: 'S3', label: '进化驱动', color: '#a78bfa', icon: 'Dna',
          desc: '系统自我改进，架构升级' },
        { id: 'S4', label: '探索驱动', color: '#60a5fa', icon: 'Compass',
          desc: '探索新可能性，信息获取' },
      ],
      note: 'L2层生成驱动力，驱动L1任务执行',
    }),
    machine_lang: '{ "field": "driving_force", "enum": ["S1_task","S2_survival","S3_evolution","S4_exploration"], "source": "s_l2_strategy" }',
    notes: '§10.1: 所有S的驱动力来源。L2战略目标生成L1任务。',
    sort_order: 295,
  },

  // 8. E-transition: Level Transitions (§11.4)
  {
    category: 'E-transition', layer: 'levels',
    human_char: 'E 信息级别迁移 — L2→L1(实践验证) / L1→L0(工程确定性)',
    anchor_tag_id: 'tag-e-info',
    ui_visual: JSON.stringify({
      type: 'level-transition-flow',
      transitions: [
        { from: 'L2', to: 'L1', color: '#8b5cf6', guard: '实践验证通过',
          desc: '主观认知经实践验证 → 可复现规律', icon: 'ArrowDown' },
        { from: 'L1', to: 'L0', color: '#10b981', guard: '工程确定性达标(≥99.XX%)',
          desc: '规律经工程化 → 确定性信号', icon: 'ArrowDown' },
      ],
      monitor: 'E监控置信度，累积超阈值 → 触发级别迁移',
      note: '信息级别不是永久标签，是工程状态快照',
    }),
    machine_lang: '{ "type": "level_transition", "rules": [{"from":"l2","to":"l1","guard":"practice_verified"},{"from":"l1","to":"l0","guard":"engineering_certainty>=0.99"}], "monitor": "e_confidence_tracker" }',
    notes: '§11.4: E监控置信度触发级别迁移。级别不是永久标签。',
    sort_order: 425,
  },
]

// ── 执行 ─────────────────────────────────────────────────────────────

db.serialize(() => {
  let updated = 0
  let inserted = 0

  // UPDATEs
  const upStmt = db.prepare('UPDATE hm_protocol SET ui_visual = ?, machine_lang = ? WHERE id = ?')
  for (const u of UPDATES) {
    upStmt.run(u.ui_visual, u.machine_lang, u.id, function (err) {
      if (err) console.error(`  ✗ UPDATE ${u.id}: ${err.message}`)
      else { updated++; console.log(`  ✓ UPDATE ${u.id}`) }
    })
  }
  upStmt.finalize()

  // INSERTs
  const inStmt = db.prepare(
    `INSERT OR IGNORE INTO hm_protocol
     (id, category, layer, human_char, ui_visual, machine_lang, notes, sort_order, anchor_tag_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
  for (const s of INSERTS) {
    const id = genId()
    inStmt.run(
      id, s.category, s.layer, s.human_char, s.ui_visual,
      s.machine_lang, s.notes || '', s.sort_order || 0, s.anchor_tag_id,
      function (err) {
        if (err) console.error(`  ✗ INSERT ${s.category}/${s.layer}: ${err.message}`)
        else { inserted++; console.log(`  ✓ INSERT ${s.category}/${s.layer} — ${s.human_char.slice(0, 50)}`) }
      }
    )
  }
  inStmt.finalize()

  db.close(() => {
    console.log(`\n✅ 修正完成: ${updated} updated, ${inserted} inserted`)
  })
})
