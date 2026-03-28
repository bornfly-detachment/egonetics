/**
 * migrate-prvs-skeleton.js
 * 用 PRVS 标签语义树的三问框架更新骨架树 L1 层
 * - 删除 P/R/V/S 各层旧的占位 concept
 * - 插入与标签语义树一一对应的 L1 骨架概念
 */
const path   = require('path')
const sqlite = require('sqlite3').verbose()

const DB_PATH = path.join(__dirname, '../data/pages.db')
const db = new sqlite.Database(DB_PATH, err => {
  if (err) { console.error('❌ 无法打开 pages.db:', err.message); process.exit(1) }
})
db.run('PRAGMA foreign_keys=ON')

// ── 旧节点清单 ──────────────────────────────────────────────
const OLD_L1 = [
  'cyber-P-L1-observe','cyber-P-L1-classify','cyber-P-L1-detect','cyber-P-L1-compress',
  'cyber-R-L1-entity','cyber-R-L1-link','cyber-R-L1-infer','cyber-R-L1-graph',
  'cyber-V-L1-local','cyber-V-L1-global','cyber-V-L1-now','cyber-V-L1-future','cyber-V-L1-certainty',
  'cyber-S-L1-define','cyber-S-L1-transition','cyber-S-L1-lifecycle-e0',
]

// ── 新节点定义 ────────────────────────────────────────────────
// [id, parent_id, layer, node_type, name, description, sort_order]
const NEW_NODES = [

  // ════════════════════════════════════════════════════════════
  // P — Pattern
  // ════════════════════════════════════════════════════════════

  // 从哪来 Source
  ['cyber-P-L1-src',      'cyber-P-L1', 'P', 'concept', '从哪来 Source',   'P 的信息来源分类', 0],
  ['cyber-P-L1-src-ext',  'cyber-P-L1-src', 'P', 'concept', '外部来源', 'S1-S4', 0],
  ['cyber-P-L1-src-s1',   'cyber-P-L1-src-ext', 'P', 'concept', 'S1 用户输入',   '', 0],
  ['cyber-P-L1-src-s2',   'cyber-P-L1-src-ext', 'P', 'concept', 'S2 环境感知',   '', 1],
  ['cyber-P-L1-src-s3',   'cyber-P-L1-src-ext', 'P', 'concept', 'S3 外部检索',   '', 2],
  ['cyber-P-L1-src-s4',   'cyber-P-L1-src-ext', 'P', 'concept', 'S4 外部推送',   '', 3],
  ['cyber-P-L1-src-int',  'cyber-P-L1-src', 'P', 'concept', '内部来源', 'S5-S8', 1],
  ['cyber-P-L1-src-s5',   'cyber-P-L1-src-int', 'P', 'concept', 'S5 执行产出',   '', 0],
  ['cyber-P-L1-src-s6',   'cyber-P-L1-src-int', 'P', 'concept', 'S6 自我感知',   '', 1],
  ['cyber-P-L1-src-s7',   'cyber-P-L1-src-int', 'P', 'concept', 'S7 认知加工',   '', 2],
  ['cyber-P-L1-src-s8',   'cyber-P-L1-src-int', 'P', 'concept', 'S8 记忆激活',   '', 3],

  // 是什么 Nature
  ['cyber-P-L1-nat',      'cyber-P-L1', 'P', 'concept', '是什么 Nature',  'P 的信息性质分类', 1],
  ['cyber-P-L1-nat-a',    'cyber-P-L1-nat', 'P', 'concept', 'A 物理结构', '文本/数值/图像/音频/代码', 0],
  ['cyber-P-L1-nat-b',    'cyber-P-L1-nat', 'P', 'concept', 'B 语义结构', '事实/规则/过程/关系/评估', 1],
  ['cyber-P-L1-nat-c',    'cyber-P-L1-nat', 'P', 'concept', 'C 认识论性质', '确定性/完备性/真值（各单选）', 2],
  ['cyber-P-L1-nat-d',    'cyber-P-L1-nat', 'P', 'concept', 'D 功能性质', 'P1指令—P7记忆', 3],
  ['cyber-P-L1-nat-d-p1', 'cyber-P-L1-nat-d', 'P', 'concept', 'P1 指令信息 Instruction', '', 0],
  ['cyber-P-L1-nat-d-p2', 'cyber-P-L1-nat-d', 'P', 'concept', 'P2 获取信息 Retrieval',   '', 1],
  ['cyber-P-L1-nat-d-p3', 'cyber-P-L1-nat-d', 'P', 'concept', 'P3 执行信息 Execution',   '', 2],
  ['cyber-P-L1-nat-d-p4', 'cyber-P-L1-nat-d', 'P', 'concept', 'P4 交互反馈 Interaction', '', 3],
  ['cyber-P-L1-nat-d-p5', 'cyber-P-L1-nat-d', 'P', 'concept', 'P5 内省信息 Introspection','', 4],
  ['cyber-P-L1-nat-d-p6', 'cyber-P-L1-nat-d', 'P', 'concept', 'P6 推理信息 Reasoning',   '', 5],
  ['cyber-P-L1-nat-d-p7', 'cyber-P-L1-nat-d', 'P', 'concept', 'P7 记忆信息 Memory',      '', 6],

  // 去哪里 Destination
  ['cyber-P-L1-dst',      'cyber-P-L1', 'P', 'concept', '去哪里 Destination', 'P 的去向', 2],
  ['cyber-P-L1-dst-task', 'cyber-P-L1-dst', 'P', 'concept', '对当前任务的作用', '', 0],
  ['cyber-P-L1-dst-d1',   'cyber-P-L1-dst-task', 'P', 'concept', 'D1 驱动行动', '', 0],
  ['cyber-P-L1-dst-d2',   'cyber-P-L1-dst-task', 'P', 'concept', 'D2 修正行动', '', 1],
  ['cyber-P-L1-dst-model','cyber-P-L1-dst', 'P', 'concept', '对系统模型的作用', '', 1],
  ['cyber-P-L1-dst-d3',   'cyber-P-L1-dst-model', 'P', 'concept', 'D3 更新认知',      '', 0],
  ['cyber-P-L1-dst-d4',   'cyber-P-L1-dst-model', 'P', 'concept', 'D4 更新自我认知',  '', 1],
  ['cyber-P-L1-dst-mem',  'cyber-P-L1-dst', 'P', 'concept', '对记忆的作用', '', 2],
  ['cyber-P-L1-dst-d5',   'cyber-P-L1-dst-mem', 'P', 'concept', 'D5 存入记忆', '', 0],
  ['cyber-P-L1-dst-d6',   'cyber-P-L1-dst-mem', 'P', 'concept', 'D6 激活记忆', '', 1],
  ['cyber-P-L1-dst-sys',  'cyber-P-L1-dst', 'P', 'concept', '对系统结构的作用', '', 3],
  ['cyber-P-L1-dst-d7',   'cyber-P-L1-dst-sys', 'P', 'concept', 'D7 触发训练', '', 0],
  ['cyber-P-L1-dst-d8',   'cyber-P-L1-dst-sys', 'P', 'concept', 'D8 丢弃',     '', 1],

  // ════════════════════════════════════════════════════════════
  // R — Relation
  // ════════════════════════════════════════════════════════════

  // 从哪来 Source
  ['cyber-R-L1-src',           'cyber-R-L1', 'R', 'concept', '从哪来 Source', 'R 的产生来源', 0],
  ['cyber-R-L1-src-sys',       'cyber-R-L1-src', 'R', 'concept', '系统元组件内在逻辑', 'P/R/V/S/E 之间的结构性关系', 0],
  ['cyber-R-L1-src-sys-p',     'cyber-R-L1-src-sys', 'R', 'concept', 'Pattern',   '', 0],
  ['cyber-R-L1-src-sys-s',     'cyber-R-L1-src-sys', 'R', 'concept', 'State',     '', 1],
  ['cyber-R-L1-src-sys-e',     'cyber-R-L1-src-sys', 'R', 'concept', 'Evolution', '', 2],
  ['cyber-R-L1-src-sys-v',     'cyber-R-L1-src-sys', 'R', 'concept', 'Value',     '', 3],
  ['cyber-R-L1-src-comm',      'cyber-R-L1-src', 'R', 'concept', '通信（信息流向）', '人/AI/环境/系统内部', 1],
  ['cyber-R-L1-src-comm-h',    'cyber-R-L1-src-comm', 'R', 'concept', '人',               '', 0],
  ['cyber-R-L1-src-comm-ai',   'cyber-R-L1-src-comm', 'R', 'concept', 'AI',              '', 1],
  ['cyber-R-L1-src-comm-env',  'cyber-R-L1-src-comm', 'R', 'concept', '环境信息',         '', 2],
  ['cyber-R-L1-src-comm-sys',  'cyber-R-L1-src-comm', 'R', 'concept', '系统内部通信机制', '', 3],
  ['cyber-R-L1-src-time',      'cyber-R-L1-src', 'R', 'concept', '时间流向', '不可逆单向', 2],
  ['cyber-R-L1-src-time-flow', 'cyber-R-L1-src-time', 'R', 'concept', '不可逆单向时间流', '', 0],
  ['cyber-R-L1-src-time-line', 'cyber-R-L1-src-time', 'R', 'concept', '系统数据时间线',  '', 1],

  // 是什么 Nature
  ['cyber-R-L1-nat',          'cyber-R-L1', 'R', 'concept', '是什么 Nature', 'R 的属性与性质', 1],
  ['cyber-R-L1-nat-basic',    'cyber-R-L1-nat', 'R', 'concept', 'A 基本属性', '方向性/确定性/时间性', 0],
  ['cyber-R-L1-nat-dir',      'cyber-R-L1-nat-basic', 'R', 'concept', 'A1 方向性', '无向/单向/双向', 0],
  ['cyber-R-L1-nat-cert',     'cyber-R-L1-nat-basic', 'R', 'concept', 'A2 确定性', '确定性/概率性/模糊', 1],
  ['cyber-R-L1-nat-tseq',     'cyber-R-L1-nat-basic', 'R', 'concept', 'A3 时间性', '同时/序列/循环', 2],
  ['cyber-R-L1-nat-type',     'cyber-R-L1-nat', 'R', 'concept', 'B 关系性质', '逻辑/因果/过程/辩证/强度', 1],
  ['cyber-R-L1-nat-logic',    'cyber-R-L1-nat-type', 'R', 'concept', 'B1 逻辑关系',    '演绎/归纳/类比', 0],
  ['cyber-R-L1-nat-causal',   'cyber-R-L1-nat-type', 'R', 'concept', 'B2 因果关系',    '直接/间接/反事实', 1],
  ['cyber-R-L1-nat-process',  'cyber-R-L1-nat-type', 'R', 'concept', 'B3 过程关系',    '条件转化/量变积累/质变涌现', 2],
  ['cyber-R-L1-nat-dialect',  'cyber-R-L1-nat-type', 'R', 'concept', 'B4 辩证关系',    'oppose+transform+unify 三要素', 3],
  ['cyber-R-L1-nat-strength', 'cyber-R-L1-nat-type', 'R', 'concept', 'B5 关系强度',    '正向/负向，绝对值=强度', 4],

  // 去哪里 Destination
  ['cyber-R-L1-dst',    'cyber-R-L1', 'R', 'concept', '去哪里 Destination', 'R 的效用去向', 2],
  ['cyber-R-L1-dst-d1', 'cyber-R-L1-dst', 'R', 'concept', 'R-D1 驱动推理',     '', 0],
  ['cyber-R-L1-dst-d2', 'cyber-R-L1-dst', 'R', 'concept', 'R-D2 支撑价值计算', '', 1],
  ['cyber-R-L1-dst-d3', 'cyber-R-L1-dst', 'R', 'concept', 'R-D3 记录演化依据', '', 2],
  ['cyber-R-L1-dst-d4', 'cyber-R-L1-dst', 'R', 'concept', 'R-D4 执行约束检查', '', 3],
  ['cyber-R-L1-dst-d5', 'cyber-R-L1-dst', 'R', 'concept', 'R-D5 激活关联节点', '', 4],

  // ════════════════════════════════════════════════════════════
  // V — Value
  // ════════════════════════════════════════════════════════════

  // 从哪来 Source
  ['cyber-V-L1-src',      'cyber-V-L1', 'V', 'concept', '从哪来 Condition', '评价标准的来源决定主客观性', 0],
  ['cyber-V-L1-src-c1',   'cyber-V-L1-src', 'V', 'concept', 'C1 计算机系统', 'certainty=1.0，确定性客观', 0],
  ['cyber-V-L1-src-c2',   'cyber-V-L1-src', 'V', 'concept', 'C2 AI 模型',   'certainty<1.0，统计性客观', 1],
  ['cyber-V-L1-src-c3',   'cyber-V-L1-src', 'V', 'concept', 'C3 人',         'certainty∝共识，主观', 2],
  ['cyber-V-L1-src-c3-h1','cyber-V-L1-src-c3', 'V', 'concept', '个体偏好', '', 0],
  ['cyber-V-L1-src-c3-h2','cyber-V-L1-src-c3', 'V', 'concept', '群体共识', '', 1],

  // 是什么 Nature（5个正交单选维度）
  ['cyber-V-L1-nat',      'cyber-V-L1', 'V', 'concept', '是什么 Nature', '5个正交属性维度', 1],
  ['cyber-V-L1-nat-t',    'cyber-V-L1-nat', 'V', 'concept', '时间性',   '静态（公式不变）/ 动态（随条件变）', 0],
  ['cyber-V-L1-nat-s',    'cyber-V-L1-nat', 'V', 'concept', '优化范围', '局部（当前任务）/ 全局（系统整体）', 1],
  ['cyber-V-L1-nat-c',    'cyber-V-L1-nat', 'V', 'concept', '确定性',   '确定性（可精确计算）/ 不确定性', 2],
  ['cyber-V-L1-nat-ctrl', 'cyber-V-L1-nat', 'V', 'concept', '可控性',   '可控（行动能改变V）/ 失控', 3],
  ['cyber-V-L1-nat-bl',   'cyber-V-L1-nat', 'V', 'concept', '基线关系', '维持 baseline / 挑战 baseline（AOP）', 4],

  // 去哪里 Destination
  ['cyber-V-L1-dst',    'cyber-V-L1', 'V', 'concept', '去哪里 Destination', 'V 为谁服务', 2],
  ['cyber-V-L1-dst-d1', 'cyber-V-L1-dst', 'V', 'concept', 'D1 对齐人的价值偏好', '主观V，短期/个体满意度', 0],
  ['cyber-V-L1-dst-d2', 'cyber-V-L1-dst', 'V', 'concept', 'D2 对完成任务负责',   '局部V，当前任务完成度', 1],
  ['cyber-V-L1-dst-d3', 'cyber-V-L1-dst', 'V', 'concept', 'D3 对系统进化负责',   '全局V，长期能力增长', 2],

  // ════════════════════════════════════════════════════════════
  // S — State
  // ════════════════════════════════════════════════════════════

  // 从哪来 Source
  ['cyber-S-L1-src',    'cyber-S-L1', 'S', 'concept', '从哪来 Source', '状态变化的驱动意图', 0],
  ['cyber-S-L1-src-s1', 'cyber-S-L1-src', 'S', 'concept', 'S1 完成任务驱动', '任务进度推动状态迁移', 0],
  ['cyber-S-L1-src-s2', 'cyber-S-L1-src', 'S', 'concept', 'S2 生存驱动',     '节点维持存在的基本活动', 1],
  ['cyber-S-L1-src-s3', 'cyber-S-L1-src', 'S', 'concept', 'S3 系统进化驱动', '以优化系统结构为目标', 2],
  ['cyber-S-L1-src-s4', 'cyber-S-L1-src', 'S', 'concept', 'S4 探索驱动',     'A/B测试/对照实验产生的状态变化', 3],

  // 是什么 Nature
  ['cyber-S-L1-nat',       'cyber-S-L1', 'S', 'concept', '是什么 Nature', '节点分级与状态机', 1],
  ['cyber-S-L1-nat-tier',  'cyber-S-L1-nat', 'S', 'concept', 'A 节点分级', '执行/系统/研究性', 0],
  ['cyber-S-L1-nat-exec',  'cyber-S-L1-nat-tier', 'S', 'concept', '执行节点',   '只有客观V，对系统节点负责', 0],
  ['cyber-S-L1-nat-sys',   'cyber-S-L1-nat-tier', 'S', 'concept', '系统节点',   '全局V，计划/终止/用户交互', 1],
  ['cyber-S-L1-nat-res',   'cyber-S-L1-nat-tier', 'S', 'concept', '研究性节点', '探索性V，A/B测试，发现最优路径', 2],
  ['cyber-S-L1-nat-sm',    'cyber-S-L1-nat', 'S', 'concept', 'B 节点状态机', '8态生命周期', 1],
  ['cyber-S-L1-nat-sm-1',  'cyber-S-L1-nat-sm', 'S', 'concept', '构建中',         '', 0],
  ['cyber-S-L1-nat-sm-2',  'cyber-S-L1-nat-sm', 'S', 'concept', '试运行',         '', 1],
  ['cyber-S-L1-nat-sm-3',  'cyber-S-L1-nat-sm', 'S', 'concept', '稳定运行',       '', 2],
  ['cyber-S-L1-nat-sm-4',  'cyber-S-L1-nat-sm', 'S', 'concept', 'Bug 挂起',       '', 3],
  ['cyber-S-L1-nat-sm-5',  'cyber-S-L1-nat-sm', 'S', 'concept', '等待指令挂起',   '', 4],
  ['cyber-S-L1-nat-sm-6',  'cyber-S-L1-nat-sm', 'S', 'concept', '正反馈迭代',     '', 5],
  ['cyber-S-L1-nat-sm-7',  'cyber-S-L1-nat-sm', 'S', 'concept', '负反馈预警',     '', 6],
  ['cyber-S-L1-nat-sm-8',  'cyber-S-L1-nat-sm', 'S', 'concept', '归档',           '', 7],

  // 去哪里 Destination
  ['cyber-S-L1-dst',        'cyber-S-L1', 'S', 'concept', '去哪里 Destination', '状态更新的权属与影响', 2],
  ['cyber-S-L1-dst-owner',  'cyber-S-L1-dst', 'S', 'concept', 'C 更新权属',   '自主 vs 被动', 0],
  ['cyber-S-L1-dst-auto',   'cyber-S-L1-dst-owner', 'S', 'concept', '自主状态更新', '节点内部评估后自行迁移', 0],
  ['cyber-S-L1-dst-passive','cyber-S-L1-dst-owner', 'S', 'concept', '被动状态更新', '上层节点下发指令强制迁移', 1],
  ['cyber-S-L1-dst-effect', 'cyber-S-L1-dst', 'S', 'concept', 'D 更新影响',   '', 1],
  ['cyber-S-L1-dst-e1',     'cyber-S-L1-dst-effect', 'S', 'concept', '触发上层感知', '负反馈预警→系统节点介入', 0],
  ['cyber-S-L1-dst-e2',     'cyber-S-L1-dst-effect', 'S', 'concept', '触发执行计划', '等待指令→收到指令→构建中', 1],
  ['cyber-S-L1-dst-e3',     'cyber-S-L1-dst-effect', 'S', 'concept', '触发进化记录', '状态轨迹写入进化层', 2],
  ['cyber-S-L1-dst-e4',     'cyber-S-L1-dst-effect', 'S', 'concept', '对外通知',     '推送给用户或外部系统', 3],
]

db.serialize(() => {
  db.run('BEGIN')

  // 1. 删除旧 L1 节点
  const ph = OLD_L1.map(() => '?').join(',')
  db.run(`DELETE FROM cybernetics_nodes WHERE id IN (${ph})`, OLD_L1, function(err) {
    if (err) console.error('删除旧节点失败:', err.message)
    else console.log(`🗑  删除旧 L1 节点 ${this.changes} 个`)
  })

  // 2. 插入新节点
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO cybernetics_nodes
      (id, parent_id, layer, level, node_type, name, description, sort_order, is_builtin)
    VALUES (?, ?, ?, 1, ?, ?, ?, ?, 1)
  `)
  let inserted = 0
  for (const [id, parent_id, layer, node_type, name, description, sort_order] of NEW_NODES) {
    stmt.run(id, parent_id, layer, node_type, name, description, sort_order, function(err) {
      if (err) console.warn(`  ⚠ 跳过 ${id}: ${err.message}`)
      else if (this.changes > 0) inserted++
    })
  }
  stmt.finalize()

  db.run('COMMIT', () => {
    console.log(`✅ 骨架树更新完成：新增 ${inserted} 个节点`)
    db.close()
  })
})
