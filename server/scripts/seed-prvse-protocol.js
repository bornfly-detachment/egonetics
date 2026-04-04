/**
 * seed-prvse-protocol.js
 * 往 hm_protocol 表注入全量 PRVSE 5层 UI 组件定义
 * 运行: cd server && node scripts/seed-prvse-protocol.js
 *
 * 设计规范 (ui-ux-pro-max):
 *   - Dark Cinema OLED · glassmorphism · neon accents per PRVSE layer
 *   - Lucide SVG icons (no emoji)
 *   - Inter font · 4/8dp spacing · 44px min touch targets
 *   - Form: visible labels, error near field, loading feedback
 */

const path = require('path')
const sqlite3 = require('sqlite3').verbose()

const DB_PATH = path.resolve(__dirname, '../data/pages.db')
const db = new sqlite3.Database(DB_PATH)

let counter = 0
function genId() {
  return `proto-prvse-${Date.now()}-${(counter++).toString(36).padStart(3, '0')}`
}

// ── 全量 PRVSE 种子数据 ──────────────────────────────────────────

const SEEDS = [
  // ════════════════════════════════════════════════
  //  P — Pattern 感知层 (amber)
  // ════════════════════════════════════════════════
  {
    category: 'P-state', layer: 'transition',
    human_char: 'Pattern 三态转换 — 外部态 → 候选态 → 内部态',
    anchor_tag_id: 'tag-p-state',
    ui_visual: JSON.stringify({
      type: 'state-flow',
      states: [
        { id: 'external', label: '外部态', color: '#ef4444', icon: 'AlertTriangle', desc: '未经L0校验的原始信息' },
        { id: 'candidate', label: '候选态', color: '#fbbf24', icon: 'FlaskConical', desc: '通过L0校验，未经实践检验' },
        { id: 'internal', label: '内部态', color: '#34d399', icon: 'ShieldCheck', desc: '经实践检验，具备确定性' },
      ],
      transitions: [
        { from: 'external', to: 'candidate', guard: 'L0校验通过' },
        { from: 'candidate', to: 'internal', guard: '实践检验通过' },
        { from: 'candidate', to: 'external', guard: '检验不通过 → 退回' },
      ],
    }),
    machine_lang: '{ "entity_type": "pattern", "field": "state", "enum": ["external","candidate","internal"], "transition_guard": "v_l0_checklist" }',
    notes: '每个 Pattern 进入系统的必经之路。外部→内部唯一路径=实践检验。',
    sort_order: 10,
  },
  {
    category: 'P-origin', layer: 'chain',
    human_char: 'Pattern 溯源链 — 链式追溯到信息源头',
    anchor_tag_id: 'tag-p-origin',
    ui_visual: JSON.stringify({
      type: 'source-chain',
      internal_sources: ['用户输入', '内部模型调用', '内部模块产生', '系统事件', '过程记忆'],
      external_sources: ['可计算溯源', '可验证溯源', '叙事溯源', '环境感知'],
      chain_display: 'breadcrumb',
    }),
    machine_lang: '{ "field": "origin_chain", "type": "array<{source_id, source_type, timestamp}>" }',
    notes: '溯源是链式结构，必须追溯到源头原点。',
    sort_order: 20,
  },
  {
    category: 'P-level', layer: 'hierarchy',
    human_char: 'Pattern 三级形态 — L0原子 / L1分子 / L2基因',
    anchor_tag_id: 'tag-p-level',
    ui_visual: JSON.stringify({
      type: 'tier-cards',
      tiers: [
        { id: 'L0', label: '原子', color: '#3b82f6', icon: 'Atom', desc: '最小完备信息单元，L0负责完备性+合法性' },
        { id: 'L1', label: '分子', color: '#10b981', icon: 'GitBranch', desc: 'P+R+V组合结构，高内聚低耦合工程模块' },
        { id: 'L2', label: '基因', color: '#8b5cf6', icon: 'Dna', desc: '最少内容最大覆盖，全局最优化价值分析' },
      ],
    }),
    machine_lang: '{ "field": "pattern_level", "enum": ["l0","l1","l2"], "select_mode": "single" }',
    notes: '信息量越高层越大，层级≠权力，能力至上。L1可自发涌现为L2候选。',
    sort_order: 30,
  },
  {
    category: 'P-physical', layer: 'type',
    human_char: 'Pattern 物理载体 — 文本/数值/代码/结构化/图像/音频/视频/流式/混合',
    anchor_tag_id: 'tag-p-physical',
    ui_visual: JSON.stringify({
      type: 'chip-selector',
      select_mode: 'single',
      options: [
        { id: 'text', label: '文本', icon: 'Type' },
        { id: 'number', label: '数值', icon: 'Hash' },
        { id: 'code', label: '代码', icon: 'Code2' },
        { id: 'structured', label: '结构化', icon: 'Table2' },
        { id: 'image', label: '图像', icon: 'Image' },
        { id: 'audio', label: '音频', icon: 'Volume2' },
        { id: 'video', label: '视频', icon: 'Film' },
        { id: 'stream', label: '流式', icon: 'Activity' },
        { id: 'mixed', label: '混合', icon: 'Layers' },
      ],
    }),
    machine_lang: '{ "field": "physical_type", "enum": ["text","number","code","structured","image","audio","video","stream","mixed"] }',
    notes: 'L0层纯规则判断，不需要语义理解。',
    sort_order: 40,
  },

  // ════════════════════════════════════════════════
  //  R — Relation 关系层 (violet)
  // ════════════════════════════════════════════════
  {
    category: 'R-l0', layer: 'logic',
    human_char: 'R-L0 逻辑关系 — 纯计算，条件确定结果唯一',
    anchor_tag_id: 'tag-r-l0',
    ui_visual: JSON.stringify({
      type: 'relation-card',
      subtypes: [
        { id: 'deductive', label: '演绎', desc: '前提→结论，必然', icon: 'ArrowDown' },
        { id: 'inductive', label: '归纳', desc: '样本→规律，统计确定', icon: 'ArrowUp' },
        { id: 'analogical', label: '类比', desc: '结构映射，形式确定', icon: 'ArrowLeftRight' },
      ],
    }),
    machine_lang: '{ "layer": "l0", "subtypes": ["deductive","inductive","analogical"], "certainty": "deterministic" }',
    notes: '纯计算关系，条件确定结果唯一。',
    sort_order: 100,
  },
  {
    category: 'R-l1', layer: 'conditional',
    human_char: 'R-L1 条件/时间关系 — 需人脑/AI辅助，无法穷举',
    anchor_tag_id: 'tag-r-l1',
    ui_visual: JSON.stringify({
      type: 'relation-card',
      subtypes: [
        { id: 'condition', label: '条件关系', desc: 'A存在则B的概率', icon: 'GitBranch' },
        { id: 'temporal', label: '时间关系', desc: '序列/循环/同时', icon: 'Clock' },
        { id: 'causal', label: '因果关系', desc: '条件+时间先后', icon: 'Zap' },
        { id: 'process', label: '过程关系', desc: '量变→质变→涌现', icon: 'TrendingUp' },
        { id: 'evolution', label: '发展关系', desc: '条件+时间+环境', icon: 'Sprout' },
      ],
    }),
    machine_lang: '{ "layer": "l1", "subtypes": ["condition","temporal","causal","process","evolution"], "certainty": "probabilistic" }',
    notes: '需人脑/AI辅助判断，无法穷举所有可能。',
    sort_order: 110,
  },
  {
    category: 'R-l2', layer: 'dialectic',
    human_char: 'R-L2 存在关系 — 叙事赋予价值和合法性，辩证矛盾',
    anchor_tag_id: 'tag-r-l2',
    ui_visual: JSON.stringify({
      type: 'relation-card',
      subtypes: [
        { id: 'narrative', label: '主体性叙事', desc: '实践轨迹/自我认知/意义建构', icon: 'BookOpen' },
        { id: 'oppose', label: '根本对立', desc: '可控-失控、有限-无限', icon: 'Swords' },
        { id: 'transform', label: '转化条件', desc: '矛盾双方在条件下转化', icon: 'RefreshCw' },
        { id: 'unify', label: '高层统一', desc: '矛盾在更高层面整合', icon: 'Merge' },
      ],
      slider: { left: '矛盾/对立', right: '统一/融合', default: 0.5 },
    }),
    machine_lang: '{ "layer": "l2", "subtypes": ["narrative","oppose","transform","unify"], "certainty": "fuzzy", "slider": "[0,1]" }',
    notes: '辩证唯物论的对立统一，需叙事赋予价值。',
    sort_order: 120,
  },

  // ════════════════════════════════════════════════
  //  V — Value 价值层 (orange)
  // ════════════════════════════════════════════════
  {
    category: 'V-l0', layer: 'metrics',
    human_char: 'V-L0 客观指标面板 — 计数器/计时器/Token/ROI/二值判断',
    anchor_tag_id: 'tag-v-l0',
    ui_visual: JSON.stringify({
      type: 'metrics-dashboard',
      metrics: [
        { id: 'counter', label: '计数器', unit: 'count', icon: 'Hash', format: 'integer' },
        { id: 'timer', label: '计时器', unit: 's', icon: 'Timer', format: 'duration' },
        { id: 'token', label: 'Token 消耗', unit: 'K', icon: 'Coins', format: 'number', sub: ['input', 'output'] },
        { id: 'success_rate', label: '成功率', unit: '%', icon: 'Target', format: 'percent', range: [0, 1] },
        { id: 'roi', label: 'ROI', unit: 'x', icon: 'TrendingUp', format: 'ratio', formula: 'output_value / input_cost' },
        { id: 'marginal', label: '边际收益', unit: '', icon: 'BarChart2', format: 'number', alert: '趋近0则该停' },
        { id: 'binary', label: '通过/不通过', unit: '', icon: 'CheckCircle', format: 'boolean' },
      ],
    }),
    machine_lang: '{ "table": "v_metrics", "fields": ["metric_id","value","unit","timestamp"], "auto_collect": true }',
    notes: '不以人意志为转移的客观指标。V-L0规则清单是状态迁移的守卫条件。',
    sort_order: 200,
  },
  {
    category: 'V-l0', layer: 'checklist',
    human_char: 'V-L0 校验清单 — 结果/功能/效果/极端case/格式',
    anchor_tag_id: 'tag-v-l0',
    ui_visual: JSON.stringify({
      type: 'checklist-form',
      checks: [
        { id: 'result', label: '结果测试', desc: '输出是否符合预期', icon: 'ClipboardCheck' },
        { id: 'function', label: '功能测试', desc: '功能是否完整实现', icon: 'Puzzle' },
        { id: 'effect', label: '效果测试', desc: '实际效果是否达标', icon: 'Gauge' },
        { id: 'extreme', label: '极端case', desc: '边界/异常/压力测试', icon: 'AlertOctagon' },
        { id: 'format', label: '格式校验', desc: '数据完整性/合法性', icon: 'FileCheck' },
      ],
      each_result: { type: 'boolean', with_note: true },
    }),
    machine_lang: '{ "type": "checklist", "items": ["result","function","effect","extreme","format"], "pass_all_required": true, "guard_for": "state_transition" }',
    notes: 'V的L0规则清单必须全部通过 = 状态迁移守卫条件。',
    sort_order: 205,
  },
  {
    category: 'V-l1', layer: 'budget',
    human_char: 'V-L1 资源预算表单 — 时间/AI/存储/内存预算分配',
    anchor_tag_id: 'tag-v-l1',
    ui_visual: JSON.stringify({
      type: 'budget-form',
      fields: [
        { id: 'time_budget', label: '时间预算', unit: 'h', icon: 'Clock', input: 'number', helper: 'deadline 绝对时间' },
        { id: 'ai_budget', label: 'AI资源预算', unit: 'Token(K)', icon: 'Cpu', input: 'select', options: ['100K', '500K', '1M', 'unlimited'] },
        { id: 'storage_budget', label: '存储预算', unit: 'MB', icon: 'HardDrive', input: 'select', options: ['500MB', '2GB', 'unlimited'] },
        { id: 'memory_budget', label: '内存预算', unit: 'MB', icon: 'MemoryStick', input: 'number' },
      ],
      summary: { show_estimated_cost: true, show_remaining: true },
    }),
    machine_lang: '{ "table": "v_l1_budget", "fields": ["task_id","time_ms","ai_tokens","storage_mb","memory_mb","allocated_at"], "monitors": ["perceiver","evaluator"] }',
    notes: 'L1任务生命周期的资源绑定。预算耗尽 → 触发熔断机制。',
    sort_order: 210,
  },
  {
    category: 'V-l1', layer: 'reward',
    human_char: 'V-L1 Reward 函数编辑器 — 目标对齐/方案排序/信息相关性/最优性/宪法校验',
    anchor_tag_id: 'tag-v-l1',
    ui_visual: JSON.stringify({
      type: 'reward-editor',
      reward_functions: [
        { id: 'info_quantity', label: '信息量计算', icon: 'BarChart' },
        { id: 'alignment', label: '目标对齐度', icon: 'Target', desc: '对目标的理解程度' },
        { id: 'rank', label: '方案排序', icon: 'ListOrdered', desc: '多方案择优' },
        { id: 'relevance', label: '信息相关性', icon: 'Link', desc: '对目标的信息量' },
        { id: 'optimality', label: '最优性检测', icon: 'Crown', desc: '局部vs全局' },
        { id: 'constitution', label: '宪法原则校验', icon: 'Scale', desc: '主观抽象→校验清单' },
        { id: 'opportunity', label: '机会成本', icon: 'Coins', desc: '选A放弃B的价值量化' },
      ],
      each_fn: { output: 'float[0,1]', weight: 'configurable' },
    }),
    machine_lang: '{ "table": "v_l1_rewards", "fields": ["id","task_id","fn_type","weight","value","computed_at"], "dynamic_add": true }',
    notes: 'Reward函数集合可动态增加。是 task.done 的门控条件。',
    sort_order: 215,
  },
  {
    category: 'V-l1', layer: 'feedback',
    human_char: 'V-L1 正/负反馈回路指示器',
    anchor_tag_id: 'tag-v-l1',
    ui_visual: JSON.stringify({
      type: 'feedback-indicator',
      states: [
        { id: 'positive', label: '正反馈', color: '#34d399', icon: 'TrendingUp', desc: 'V测试通过/指标提升 → 继续推进' },
        { id: 'negative', label: '负反馈', color: '#f87171', icon: 'TrendingDown', desc: 'V测试不通过 → 分析原因' },
      ],
      circuit_breaker: { label: '熔断', icon: 'OctagonX', desc: '连续N次负反馈/资源耗尽 → 强制归档或上报L2', color: '#ef4444' },
    }),
    machine_lang: '{ "field": "feedback_type", "enum": ["positive","negative","circuit_breaker"], "triggers": "state_transition" }',
    notes: '由V函数评分驱动。熔断机制防止无限迭代。',
    sort_order: 220,
  },
  {
    category: 'V-l2', layer: 'practice',
    human_char: 'V-L2 实践检验表单 — AB测试/极端验证/泛化测试/宪法合规',
    anchor_tag_id: 'tag-v-l2',
    ui_visual: JSON.stringify({
      type: 'practice-test-form',
      tests: [
        { id: 'ab_test', label: 'AB测试', icon: 'FlaskConical', desc: '固定资源+时间运行对比', fields: ['group_a', 'group_b', 'metric', 'duration'] },
        { id: 'extreme_val', label: '极端case验证', icon: 'AlertOctagon', desc: '列举所有极端case', fields: ['cases_list', 'pass_threshold'] },
        { id: 'generalize', label: '泛化性测试', icon: 'Expand', desc: '测试集/验证集分布一致性', fields: ['test_distribution', 'val_distribution'] },
        { id: 'compliance', label: '宪法合规', icon: 'Scale', desc: '宪法条目逐条校验', fields: ['constitution_rules'] },
        { id: 'identity', label: '身份验证', icon: 'Fingerprint', desc: 'T3权限动态验证', fields: ['identity_proof'] },
      ],
      result: { type: 'pass_fail_with_evidence' },
    }),
    machine_lang: '{ "table": "v_l2_practice", "fields": ["id","test_type","input","result","evidence","tested_at"], "strongest_v": true }',
    notes: 'V-L2 = 最强V。实践是检验真理的唯一标准。',
    sort_order: 230,
  },
  {
    category: 'V-core', layer: 'mechanism',
    human_char: 'V 核心机制 — 测试集(隐藏)/验证集(自测)/校验清单生成器',
    anchor_tag_id: 'tag-v-core',
    ui_visual: JSON.stringify({
      type: 'v-core-panel',
      components: [
        { id: 'testset', label: '测试集', icon: 'EyeOff', desc: 'V独立持有，模块不可见', access: 'v_only' },
        { id: 'valset', label: '验证集', icon: 'Eye', desc: '模块自测用', access: 'module_visible' },
        { id: 'generator', label: '校验清单生成器', icon: 'Wand2', desc: '动态安全生成', access: 'v_only' },
      ],
      independence: { neutral: true, anti_infiltration: true, kernel_direct: true },
    }),
    machine_lang: '{ "v_independence": ["neutral","anti_infiltration","kernel_direct"], "access_control": "strict" }',
    notes: 'V的独立性保障是宪法级的——中立性、防渗透、内核直接负责。',
    sort_order: 240,
  },

  // ════════════════════════════════════════════════
  //  S — State 状态层 (emerald)
  // ════════════════════════════════════════════════
  {
    category: 'S-l0', layer: 'machine',
    human_char: 'S-L0 运行时状态机 — 构建/运行/更新/维护/故障/阻塞',
    anchor_tag_id: 'tag-s-l0',
    ui_visual: JSON.stringify({
      type: 'state-machine',
      states: [
        { id: 'building', label: '构建中', color: '#fbbf24', icon: 'Hammer' },
        { id: 'running', label: '运行中', color: '#34d399', icon: 'Play' },
        { id: 'updating', label: '更新中', color: '#60a5fa', icon: 'RefreshCw' },
        { id: 'maintaining', label: '维护中', color: '#a78bfa', icon: 'Wrench' },
        { id: 'bug', label: '故障', color: '#f87171', icon: 'Bug' },
        { id: 'blocked', label: '阻塞', color: '#6b7280', icon: 'Pause' },
      ],
      transitions: [
        { from: 'building', to: 'running', guard: 'V-L0全部通过' },
        { from: 'running', to: 'bug', guard: '异常检测' },
        { from: 'bug', to: 'building', guard: '可逆修复' },
        { from: 'running', to: 'blocked', guard: '依赖缺失/资源不足' },
      ],
    }),
    machine_lang: '{ "table": "s_l0_states", "field": "status", "guard": "v_l0_checklist", "reversibility": {"bug_to_building": true, "archived": false} }',
    notes: 'L0确定性基础设施状态。守卫条件=V的L0规则清单。',
    sort_order: 300,
  },
  {
    category: 'S-l1', layer: 'lifecycle',
    human_char: 'S-L1 任务生命周期 — 调研→方案→构建→执行→测试→反馈→交付→归档',
    anchor_tag_id: 'tag-s-l1',
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
        { id: 'archived', label: '归档', icon: 'Archive', color: '#6b7280' },
      ],
      feedback_loop: true,
      version_tracking: 'V0 → V1 → V2...',
    }),
    machine_lang: '{ "table": "s_l1_lifecycle", "field": "stage", "version": "integer", "feedback": {"positive":"continue","negative":"analyze","circuit_breaker":"archive_or_escalate"} }',
    notes: 'L1任务沿时间演化的迭代执行。版本交付是阶段性成果。',
    sort_order: 310,
  },
  {
    category: 'S-l2', layer: 'strategy',
    human_char: 'S-L2 战略目标生命周期 — 推进/搁置/阻力/拆解/达成/放弃',
    anchor_tag_id: 'tag-s-l2',
    ui_visual: JSON.stringify({
      type: 'strategy-board',
      states: [
        { id: 'active', label: '正反馈推进', color: '#34d399', icon: 'Rocket', desc: '天时地利人和，增加投入' },
        { id: 'shelved', label: '搁置+学习器', color: '#fbbf24', icon: 'BookMarked', desc: '时机不成熟，保留监听' },
        { id: 'resistance', label: '阻力判断', color: '#f87171', icon: 'Shield', desc: '方向阻力极大，当下不可行' },
        { id: 'decomposing', label: '拆解下发', color: '#60a5fa', icon: 'GitBranch', desc: '战略→短期→L1任务' },
        { id: 'achieved', label: '已达成', color: '#22d3ee', icon: 'Trophy' },
        { id: 'abandoned', label: '放弃', color: '#6b7280', icon: 'XCircle', desc: '长期评估确认不可行' },
      ],
      learner: {
        monitor: '信息监听源',
        prob: '条件概率评估',
        confidence: '置信度累积 → 超阈值建议重启',
      },
    }),
    machine_lang: '{ "table": "s_l2_strategy", "field": "status", "learner": {"monitor_sources":[],"confidence_threshold":0.7}, "decompose": {"levels":["strategic","shortterm","task"]} }',
    notes: '搁置≠放弃。学习器持续监听，条件成熟时建议重启。',
    sort_order: 320,
  },

  // ════════════════════════════════════════════════
  //  E — Evolution 演化层 (indigo/purple)
  // ════════════════════════════════════════════════
  {
    category: 'E-info', layer: 'levels',
    human_char: 'E 信息分级 — L0信号层 / L1规律层 / L2认知层',
    anchor_tag_id: 'tag-e-info',
    ui_visual: JSON.stringify({
      type: 'info-level-cards',
      levels: [
        { id: 'L0', label: '信号层', color: '#3b82f6', icon: 'Zap', certainty: '>=99%', practice: '规则路由，无需思考', boundary: '客观世界计算机化' },
        { id: 'L1', label: '规律层', color: '#10b981', icon: 'Beaker', certainty: '可复现', practice: '有限的，约束条件建模', boundary: '科学实验论证' },
        { id: 'L2', label: '认知层', color: '#8b5cf6', icon: 'Brain', certainty: '主观', practice: '无限的，AI幻觉来源', boundary: '需验证才具备可信度' },
      ],
    }),
    machine_lang: '{ "field": "info_level", "enum": ["l0","l1","l2"], "routing": {"l0":"rule_engine","l1":"model_assist","l2":"human_review"} }',
    notes: '警惕L2层：爽文化标签毒害系统，外部叙事控制内部叙事。',
    sort_order: 400,
  },
  {
    category: 'E-comm', layer: 'tiers',
    human_char: 'E 通信机制 — L0信号/L1请求/L2控制',
    anchor_tag_id: 'tag-e-comm',
    ui_visual: JSON.stringify({
      type: 'comm-tier-cards',
      tiers: [
        { id: 'L0', label: '信号通信', color: '#3b82f6', icon: 'Radio', risk: '低', strategy: '宽松·条件校验', scenes: ['任务下发', '感知器输出', '执行结果回传'] },
        { id: 'L1', label: '请求型通信', color: '#fbbf24', icon: 'MessageSquare', risk: '高', strategy: 'Policy Engine裁决', scenes: ['权限申请', '状态变更', '写入操作'] },
        { id: 'L2', label: '控制型通信', color: '#ef4444', icon: 'ShieldAlert', risk: '极高', strategy: '双重校验+Human介入', scenes: ['系统结构改造', '资源分配', '冲突裁决'] },
      ],
    }),
    machine_lang: '{ "field": "comm_level", "enum": ["l0","l1","l2"], "l2_requires": ["rule_check","state_check","optional_human_review"] }',
    notes: 'AI↛AI直接通信，必须经过Control Bus校验。',
    sort_order: 410,
  },
  {
    category: 'E-perm', layer: 'tiers',
    human_char: 'E 权限分级 — T0执行 / T1推理 / T2进化 / T3原创',
    anchor_tag_id: 'tag-e-perm',
    ui_visual: JSON.stringify({
      type: 'permission-tier-cards',
      tiers: [
        { id: 'T0', label: '执行/实践', color: '#6b7280', icon: 'Zap', agents: '所有底层agent', capability: 'perception, signal_sense, fast_response, rl_trainable' },
        { id: 'T1', label: '推理/控制', color: '#60a5fa', icon: 'Cpu', agents: 'AI级PRVSE引擎', capability: 'task_execution, skills_extend' },
        { id: 'T2', label: '进化权威', color: '#a78bfa', icon: 'Brain', agents: '人机协同', capability: 'project_crud, plan_generation, complex_reasoning' },
        { id: 'T3', label: '原创开发者', color: '#fbbf24', icon: 'Crown', agents: 'bornfly (human)', capability: 'constitutional_crud, system_admin, agent_control' },
      ],
      escalation: { from: 'T0', to: 'T1', condition: '需逻辑推理的R和E层' },
    }),
    machine_lang: '{ "field": "permission_tier", "enum": ["t0","t1","t2","t3"], "t2_approval_required": ["create_claude_instance","system_structure_change","resource_allocation"] }',
    notes: 'T2级CRUD需要用户审批（宪法级）。L2控制型通信由T2+T3裁决。',
    sort_order: 420,
  },
  {
    category: 'E-ui', layer: 'registry',
    human_char: 'L2 审批表单 — AI智能资源创建审批（claude实例/Token/时间/存储）',
    anchor_tag_id: 'tag-e-infra',
    ui_visual: JSON.stringify({
      type: 'approval-form',
      component_id: 'L2ApprovalModal',
      permission_tier: 'T3',
      triggers: ['CLAUDE_NOT_RUNNING'],
      fields: [
        { id: 'sphere', label: 'Sphere名称', type: 'input', default: 'main', icon: 'Globe' },
        { id: 'model', label: '初始模型', type: 'select', options: ['claude-sonnet-4-6', 'claude-opus-4-6'], icon: 'Cpu' },
        { id: 'token_budget', label: 'Token预算', type: 'radio', options: ['100K', '500K', '1M', 'unlimited'], icon: 'Coins' },
        { id: 'session_duration', label: '会话时长', type: 'radio', options: ['1h', '4h', '8h', 'permanent'], icon: 'Clock' },
        { id: 'storage_mb', label: '存储配额', type: 'radio', options: ['500MB', '2GB', 'unlimited'], icon: 'HardDrive' },
      ],
      summary: { show_estimated_cost: true, show_expiry: true },
      actions: [
        { id: 'cancel', label: '取消', variant: 'secondary' },
        { id: 'approve', label: '审批启动', variant: 'primary', requires_confirmation: true },
      ],
    }),
    machine_lang: '{ "endpoint": "POST /api/code-agent/spheres", "body": {"sphere":"string","model":"string","token_budget":"number|null","session_duration_ms":"number|null","storage_mb":"number|null"}, "executes": "tmux send-keys claude --dangerously-skip-permissions" }',
    notes: '宪法级操作：创建claude实例=L2 AI资源Create，必须用户审批。',
    sort_order: 500,
  },
  {
    category: 'E-ui', layer: 'registry',
    human_char: 'V 测评仪表盘 — 实时指标 + 校验清单 + Reward 函数可视化',
    anchor_tag_id: 'tag-e-infra',
    ui_visual: JSON.stringify({
      type: 'dashboard-layout',
      component_id: 'VEvaluationDashboard',
      sections: [
        { id: 'metrics', label: '实时指标', component: 'V-l0:metrics', span: 'full' },
        { id: 'checklist', label: '校验清单', component: 'V-l0:checklist', span: 'half' },
        { id: 'rewards', label: 'Reward函数', component: 'V-l1:reward', span: 'half' },
        { id: 'feedback', label: '反馈状态', component: 'V-l1:feedback', span: 'third' },
        { id: 'budget', label: '资源预算', component: 'V-l1:budget', span: 'third' },
        { id: 'practice', label: '实践检验', component: 'V-l2:practice', span: 'third' },
      ],
    }),
    machine_lang: '{ "type": "composite_dashboard", "data_sources": ["v_metrics","v_l1_budget","v_l1_rewards","v_l2_practice"], "refresh": "realtime" }',
    notes: 'V层全景仪表盘，组合多个V子组件。',
    sort_order: 510,
  },
  {
    category: 'E-ui', layer: 'registry',
    human_char: 'S 任务面板 — 生命周期进度 + 状态机 + 反馈回路',
    anchor_tag_id: 'tag-e-infra',
    ui_visual: JSON.stringify({
      type: 'dashboard-layout',
      component_id: 'STaskPanel',
      sections: [
        { id: 'lifecycle', label: '任务生命周期', component: 'S-l1:lifecycle', span: 'full' },
        { id: 'state_machine', label: '运行时状态', component: 'S-l0:machine', span: 'half' },
        { id: 'strategy', label: '战略目标', component: 'S-l2:strategy', span: 'half' },
      ],
    }),
    machine_lang: '{ "type": "composite_dashboard", "data_sources": ["s_l0_states","s_l1_lifecycle","s_l2_strategy"] }',
    notes: 'S层全景面板，任务维度统一视图。',
    sort_order: 520,
  },
  {
    category: 'E-l0', layer: 'completeness',
    human_char: 'E-L0 系统完备性维护 — 触发条件 + 更新类型 + 影响范围',
    anchor_tag_id: 'tag-e-l0',
    ui_visual: JSON.stringify({
      type: 'evolution-trigger-panel',
      triggers: [
        { id: 'unknown_pattern', label: '未知Pattern', icon: 'HelpCircle', desc: '无法编译归类' },
        { id: 'freq_errors', label: '高频同类错误', icon: 'AlertTriangle', desc: '无法转化有价值P' },
        { id: 'unsupported', label: 'Kernel不支持', icon: 'Ban', desc: '理论可执行但系统缺能力' },
        { id: 'bottleneck', label: '设计瓶颈', icon: 'Lock', desc: '过往设计成为未来优化的阻碍' },
      ],
      update_types: ['incremental', 'modification'],
      principles: ['平行扩展优先', '高内聚低耦合', '三思后行'],
    }),
    machine_lang: '{ "table": "e_l0_evolution", "trigger_type": "enum", "update_scope": ["l0_prvs","l1_sync"], "guard": "three_think_check" }',
    notes: '从设计之初就为灵活性和动态性增加空间。',
    sort_order: 430,
  },
  {
    category: 'E-l1', layer: 'learning',
    human_char: 'E-L1 学习模块构建 — AI训练 + 流程优化 + 能力扩展',
    anchor_tag_id: 'tag-e-l1',
    ui_visual: JSON.stringify({
      type: 'learning-board',
      modules: [
        { id: 'training', label: 'AI模型训练', icon: 'GraduationCap', sub: ['本地训练', '范式探索', '对照实验', '数据管理'] },
        { id: 'optimize', label: '流程优化', icon: 'Settings2', sub: ['API→本地替代', 'API使用优化', '流程链路优化'] },
        { id: 'capability', label: '能力扩展', icon: 'Sparkles', sub: ['视频生成', '语音生成', '多模态', '自定义能力'] },
      ],
      outputs: ['训练完成的本地模型', '优化后的流程', '新增系统能力', '消化后的外部知识'],
    }),
    machine_lang: '{ "table": "e_l1_learning", "modules": ["training","optimize","capability"], "output_types": ["model","pipeline","capability","knowledge"] }',
    notes: 'E-L1的产出反哺整个系统。',
    sort_order: 440,
  },
  {
    category: 'E-l2', layer: 'subjectivity',
    human_char: 'E-L2 主体性引擎 — 内部叙事/生变论/认知引擎/人-AI协同进化',
    anchor_tag_id: 'tag-e-l2',
    ui_visual: JSON.stringify({
      type: 'subjectivity-panel',
      engines: [
        { id: 'narrative', label: '内部叙事维护器', icon: 'BookOpen', desc: '自我叙事与外部控制论叙事隔离' },
        { id: 'simulator', label: '主体性模拟器', icon: 'User', desc: '模拟产生主体性行为和判断' },
        { id: 'anti', label: '反渗透/反幻觉', icon: 'ShieldCheck', desc: '防止外部叙事侵蚀内部认同' },
        { id: 'sbl', label: '生变论引擎', icon: 'Dna', desc: '理解→应用→基于实践更新' },
        { id: 'cognitive', label: '认知引擎', icon: 'Lightbulb', desc: '问题意识→直觉→学习', sub: ['problem', 'intuition', 'learner'] },
      ],
      coevolution: [
        { id: 'interaction', label: '交互产品更新', icon: 'Repeat' },
        { id: 'data', label: '人打标数据收集', icon: 'Database' },
        { id: 'train', label: '混合训练', icon: 'GraduationCap' },
        { id: 'feedback', label: '实践反馈训练', icon: 'RefreshCw' },
      ],
    }),
    machine_lang: '{ "engines": ["narrative","simulator","anti_infiltration","sbl","cognitive"], "coevolution_pipeline": ["interaction_update","data_collect","mixed_training","practice_feedback"] }',
    notes: 'E-L2 = bornfly独有的T3级进化引擎。生变论是核心哲学。',
    sort_order: 450,
  },
]

// ── 执行插入 ─────────────────────────────────────────────────────

const INSERT_SQL = `INSERT OR IGNORE INTO hm_protocol
  (id, category, layer, human_char, ui_visual, machine_lang, notes, sort_order, anchor_tag_id)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`

db.serialize(() => {
  const stmt = db.prepare(INSERT_SQL)
  let inserted = 0

  for (const s of SEEDS) {
    const id = genId()
    stmt.run(
      id, s.category, s.layer, s.human_char,
      typeof s.ui_visual === 'object' ? JSON.stringify(s.ui_visual) : s.ui_visual,
      s.machine_lang, s.notes || '', s.sort_order || 0, s.anchor_tag_id,
      function (err) {
        if (err) console.error(`  ✗ ${s.category}/${s.layer}: ${err.message}`)
        else { inserted++; console.log(`  ✓ ${s.category}/${s.layer} — ${s.human_char.slice(0, 40)}`) }
      }
    )
  }

  stmt.finalize(() => {
    console.log(`\n✅ 插入完成: ${inserted}/${SEEDS.length} 条 PRVSE Protocol 条目`)
    db.close()
  })
})
