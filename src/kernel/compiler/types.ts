/**
 * PRVSE Compiler — Type System
 *
 * Bridges tag-tree semantic types → kernel execution primitives.
 * Source of truth: docs/prvse-compiler-design.md + src/kernel/compiler/tag-tree.json
 *
 * Design:
 *   - PatternToken  → compiled into kernel Pattern + NodeState
 *   - RelationEdge  → compiled into kernel Contract
 *   - ValueGate     → used by checker as constraint gate
 *   - StateInstruction → compiled into kernel Patch[]
 *   - EvolutionEvent → compiled into kernel Effect
 *
 * TypeScript gradual typing: fields start as `unknown`, narrow through
 * the pipeline. Un-narrowed fields → downgrade permission, not reject.
 */

import type { NodeId } from '../types'

// ── Narrowable<T> — gradual typing primitive ──────────────────

/**
 * A value that starts unknown and narrows through the compiler pipeline.
 * `resolved: true` means the field has been classified.
 * `resolved: false` means it's still unknown → triggers permission downgrade.
 */
export type Narrowable<T> =
  | { resolved: true; value: T }
  | { resolved: false }

export function resolved<T>(value: T): Narrowable<T> {
  return { resolved: true, value }
}

export function unresolved<T>(): Narrowable<T> {
  return { resolved: false }
}

export function isResolved<T>(n: Narrowable<T>): n is { resolved: true; value: T } {
  return n.resolved
}

// ── P — Pattern Token (Lexer output) ──────────────────────────

/**
 * Pattern State (三态)
 *
 * external → candidate → internal
 *
 * External → Internal has NO shortcut. Even internally generated
 * hypotheses must pass through practice verification.
 */
export type PState = 'external' | 'candidate' | 'internal'

/**
 * Internal origin types — 天然合法 (100% legitimate)
 * Traceable, explainable, analyzable, reproducible.
 * Communication has direction (A→B / broadcast).
 */
export type PInternalOriginType =
  | 'user_input'       // human subject operation
  | 'model_call'       // internal AI reasoning/generation
  | 'module_output'    // component output / execution result
  | 'system_event'     // state change / scheduler trigger
  | 'process_memory'   // chronicle / life memory

/**
 * External origin types — 需控制论过滤改造
 * Classified by trust basis / verifiability.
 */
export type PExternalOriginType =
  | 'computable'   // code repos, databases, API returns — high certainty, complete chain
  | 'verifiable'   // papers, experiments, authoritative docs — verifiable, needs judgment
  | 'narrative'    // social media, personal expression, AI-generated — subjective
  | 'sensor'       // sensors, monitoring, auto-collection — physical world signals

/**
 * POrigin — chain provenance.
 * "从哪来" is a chain structure, not a single label.
 * Must trace to origin point.
 */
export type POrigin =
  | { domain: 'internal'; type: PInternalOriginType }
  | { domain: 'external'; type: PExternalOriginType }

/**
 * Physical type — 9 carrier forms (L0 basic classification)
 * Pure rule-based, no semantic understanding needed.
 */
export type PPhysicalType =
  | 'text'        // natural language
  | 'number'      // numeric / measurement
  | 'code'        // program / script / configuration
  | 'structured'  // JSON / table / database record
  | 'image'       // image
  | 'audio'       // audio
  | 'video'       // video
  | 'stream'      // real-time event stream / sensor stream
  | 'mixed'       // code+comments / image+text / multimodal

/**
 * Pattern Level — three-level form (三级形态)
 *
 * Information quantity and value increase with level —
 * not about content volume, but scope of impact.
 *
 * Level ≠ Power: L1 can self-promote to L2 candidate.
 * 谁最强谁最好就是谁 — capability determines authority.
 */
export type PLevel =
  | 'L0_atom'      // minimal complete information unit
  | 'L1_molecule'  // P+R+V combined structure
  | 'L2_gene'      // abstraction of L1 practice

/**
 * Communication direction
 *
 * Higher level ≠ greater power ≠ controls lower level.
 */
export type PCommunication =
  | 'bottom_up'   // L1 emergence → L2 candidate (needs rule verification + human confirmation)
  | 'top_down'    // high-level abstraction guides practice
  | 'lateral'     // same-level (determined by R + constitutional rules, A→B / broadcast)

/**
 * PatternToken — the output of the Lexer (scanner).
 *
 * origin + state are required (must know provenance and current state).
 * physical, level, communication use Narrowable — start unknown, narrow through pipeline.
 */
export interface PatternToken {
  readonly id: string
  readonly timestamp: number
  readonly rawContent: string

  // Required — must be declared at entry
  readonly origin: POrigin
  readonly state: PState

  // Narrowable — start unknown, narrow through pipeline
  readonly physical: Narrowable<PPhysicalType>
  readonly level: Narrowable<PLevel>
  readonly communication: Narrowable<PCommunication>
}

/** How narrowed is this token? Determines permission level. */
export type NarrowingLevel = 'full' | 'partial' | 'minimal'

export function getNarrowingLevel(token: PatternToken): NarrowingLevel {
  const fields = [token.physical, token.level, token.communication]
  const resolvedCount = fields.filter(isResolved).length
  if (resolvedCount === fields.length) return 'full'
  if (resolvedCount >= 1) return 'partial'
  return 'minimal'
}

// ── R — Relation Edge (Parser output) ─────────────────────────

/**
 * Relation Info Level — constitutional definition of R.
 *
 * CORE PRINCIPLE: Levels are engineering state snapshots, NOT permanent labels.
 * The same phenomenon can transition between levels as engineering matures.
 *   - Face recognition: L1 (2010) → L0 (2024, 99.XX% accuracy)
 *   - Quantum computing: L1 (today) → L0 (after engineering breakthrough)
 *   - Dialectical problems: L2 → L1 (when validated through practice)
 *
 * Boundary criterion: practical engineering certainty at current state.
 *
 * L0_logic: Practically deterministic at engineering scale.
 *   - Math, classical physics, boolean logic (1+1=2, F=ma at macro scale)
 *   - Conditions determined → result unique (in classical physics regime)
 *   - Engineering certainty ≥ 99% → qualifies as L0
 *   - NOTE: Quantum measurement is L1 (ontologically probabilistic),
 *     but Schrödinger's equation itself is L0 (deterministic evolution).
 *     At human practice scale, quantum effects are negligible.
 *   - If ANY cognitive ambiguity or interpretation exists → belongs to L1
 *
 * L1_conditional: Theoretically computable but practically uncertain.
 *   - Conditions too complex to enumerate (chaos, multi-factor causality)
 *   - Causality = conditions + time; A→B appears causal but B depends on C,D...
 *   - Chaos systems: L0 rules at bottom, but sensitivity to initial conditions
 *     makes computation degrade to L1 (matches "cannot exhaustively compute")
 *   - Requires human/AI to distinguish, experiment to validate
 *   - Can transition to L0 when engineering achieves high certainty
 *
 * L2_existential: Requires subjectivity algorithm (e.g. life's three laws).
 *   - Subjectivity, cognition, meaning, narrative
 *   - Dialectics: oppose/unify — A and ¬A can coexist (forbidden in L0 logic)
 *   - Subject's practice in spacetime needs narrative for value and legitimacy
 *   - Can transition to L1 when validated through practice
 *
 * Level transitions are monitored by E (Evolution):
 *   E watches confidence metrics on L1 nodes → triggers L1→L0 upgrade at threshold
 *   E validates L2 predictions through practice → triggers L2→L1 transition
 *
 * Maps 1:1 to PLevel (P's L0/L1/L2) and PermissionTier hierarchy.
 */
export type RInfoLevel = 'L0_logic' | 'L1_conditional' | 'L2_existential'

export type RDirection = 'none' | 'one_way' | 'bidirectional'
export type RCertainty = 'deterministic' | 'probabilistic' | 'fuzzy'
export type RTemporal = 'simultaneous' | 'sequential' | 'cyclic'

/** L0 — pure logic (computable without human/AI) */
export type RLogic = 'deductive' | 'inductive' | 'analogical'

/** L1 — conditional/temporal (needs human/AI for complex enumeration) */
export type RCausal = 'direct' | 'indirect' | 'counterfactual'
export type RProcess = 'conditional_transform' | 'quantitative_accumulation' | 'qualitative_emergence'

/** L2 — existential (requires narrative, subjectivity, dialectics) */
export type RDialectic = 'oppose' | 'transform' | 'unify'

export type RStrength = 'positive' | 'negative'

/** Propagation direction — how changes travel along this edge */
export type RPropagation = 'forward' | 'backward' | 'bidirectional'

/** Edge type — maps to kernel Contract types */
export type REdgeType =
  | 'contains'
  | 'constraint'
  | 'mutual_constraint'
  | 'signal'
  | 'derives'
  | 'directed'

/** What this relation does in the system */
export type RDestination =
  | 'R_D1_drive_reasoning'
  | 'R_D2_support_value_calc'
  | 'R_D3_record_evolution'
  | 'R_D4_execute_constraint'
  | 'R_D5_activate_related'

export interface RelationEdge {
  readonly id: string
  readonly sourceNode: NodeId
  readonly targetNode: NodeId

  // Relation level — constitutional classification
  readonly infoLevel: RInfoLevel

  // Physical attributes
  readonly direction: RDirection
  readonly certainty: RCertainty
  readonly temporal: RTemporal

  // Semantic nature — which level's operators are used
  // L0: logic is set
  // L1: causal and/or process is set
  // L2: dialectic is set
  readonly logic?: RLogic
  readonly causal?: RCausal
  readonly process?: RProcess
  readonly dialectic?: RDialectic
  readonly strength: RStrength

  // Compiler-required
  readonly edgeType: REdgeType
  readonly propagation: RPropagation
  readonly priority: number
  readonly destination: RDestination
}

// ── V — Value Gate (校验清单驱动的大法官) ─────────────────────
//
// V是控制论系统确定性可控的奠基。
// V必须独立——不被其他组件AI渗透，中立地对目标/宪法/资源负责。
// E和S依赖V——V失效等于它们无法工作。
// V作为AOP存在于所有CRUD操作上。
// 最强的Value判断 = 实践检验。
//
// 核心范式：ML测试集/验证集分离。
//   模块用验证集自测，V用测试集独立测试（同分布但分开）。

// ── V Checklist Core ─────────────────────────────────────────

/**
 * 校验清单项 — V的原子单位。
 * 每条清单项是一个明确的 pass/fail 判定。
 * 清单N条必须全部满足，少1条就不通过。
 */
export interface VChecklistItem {
  readonly id: string
  readonly description: string
  readonly passed: boolean
  readonly evidence?: string   // 判定依据
}

/**
 * 校验清单 — 一组ChecklistItem的集合。
 * 全部通过才算通过。这是V的本体。
 */
export interface VChecklist {
  readonly id: string
  readonly name: string
  readonly items: readonly VChecklistItem[]
  readonly generatedAt: number     // 生成时间戳
  readonly generatorVersion: string // 生成器版本（动态安全）
}

/** 校验清单全部通过？ */
export function isChecklistPassed(checklist: VChecklist): boolean {
  return checklist.items.length > 0 && checklist.items.every(item => item.passed)
}

// ── L0 确定性校验 ────────────────────────────────────────────
// 100%可判定，纯L0逻辑关系。同一输入同一结果。
// 是L1和L2评估的基础数据来源。

/** L0 客观度量指标类型 — 100%可计算 */
export type VL0MetricType =
  | 'accuracy'         // 准确率
  | 'recall'           // 召回率
  | 'precision'        // 精确率
  | 'f1'               // F1 Score
  | 'counter'          // 计数器（执行/错误/调用次数）
  | 'timer'            // 计时器（响应/执行/超时）
  | 'resource'         // 资源消耗（Token/内存/存储/API成本）
  | 'binary'           // 二值判断（通过/不通过）
  | 'roi'              // 投入产出比 = output_value / input_cost
  | 'marginal_return'  // 边际收益 — 每多投入一单位资源的产出增量，趋近0则该停

export interface VL0Metric {
  readonly type: VL0MetricType
  readonly currentValue: number
  readonly threshold: number
}

/** L0 规则校验清单类型 — 宪法约束，全部必须满足 */
export type VL0RuleCheckType =
  | 'result'      // 结果测试（输出是否符合预期）
  | 'function'    // 功能测试（功能是否完整实现）
  | 'effect'      // 效果测试（实际效果是否达标）
  | 'extreme'     // 极端case测试（边界/异常/压力）
  | 'format'      // 格式校验（数据完整性/合法性）

export interface VL0RuleCheck {
  readonly type: VL0RuleCheckType
  readonly checklist: VChecklist
}

/** L0 校验集合 — 客观度量 + 规则清单 */
export interface VL0Assessment {
  readonly metrics: readonly VL0Metric[]
  readonly ruleChecks: readonly VL0RuleCheck[]
}

// ── L1 生命周期动态评估 ──────────────────────────────────────
// 涉及时间/过程/条件。沿时间工作的节点都有生命周期。

/** 资源预算类型 — 生命周期建立时预分配 */
export type VL1BudgetType = 'time' | 'ai' | 'storage' | 'memory'

export interface VL1ResourceBudget {
  readonly type: VL1BudgetType
  readonly allocated: number
  readonly consumed: number
  readonly deadline?: number  // 时间预算的截止时间戳
}

/**
 * 感知器 — 本质是L0级V。
 * 沿时间动态累积资源消耗。客观度量，无判断。
 * 实时监控资源使用与预算的偏差。
 */
export interface VL1Perceiver {
  readonly budgets: readonly VL1ResourceBudget[]
  readonly deviationRatio: number  // 偏差比 = consumed/allocated, >1 = 超预算
}

/**
 * 测评器 — 本质是L0级V。
 * 测试验收清单，必须由易到难建立。确定性校验。
 */
export interface VL1Evaluator {
  readonly checklist: VChecklist  // 由易到难排列
}

/**
 * 状态评估器 — L1级V。
 * 对工作节点进展做动态判断。
 */
export type VL1FeedbackDirection = 'positive' | 'negative' | 'stagnant'

export interface VL1StateEvaluator {
  readonly feedback: VL1FeedbackDirection
  readonly localOptimal: boolean      // 是否陷入局部最优
  readonly globalOptimalVisible: boolean  // 全局最优目标是否对执行节点可见
  readonly homeostasisDeviation: number  // 稳态偏离度 [0,1]，0=健康基线，1=完全偏离
  readonly deviationDetected: boolean    // 是否检测到偏离全局最优（homeostasisDeviation > threshold 时触发）
}

/** Reward函数类型 — L1 V = Reward函数集合，可动态增加 */
export type VL1RewardType =
  | 'information'       // 信息量计算（Shannon熵）
  | 'alignment'         // 目标对齐度
  | 'ranking'           // 方案排序（多方案择优）
  | 'relevance'         // 信息相关性/价值
  | 'optimality'        // 最优性检测（局部vs全局）
  | 'constitution'      // 宪法原则校验（主观抽象→转为校验清单）
  | 'opportunity_cost'  // 机会成本 — 选A路径放弃B路径的价值量化，防止沉没成本谬误

export interface VL1RewardFunction {
  readonly type: VL1RewardType
  readonly score: number          // [0, 1]
  readonly weight: number         // 在组合中的权重
  readonly checklist?: VChecklist // constitution类型转化为的校验清单
}

/** L1 评估集合 */
export interface VL1Assessment {
  readonly perceiver: VL1Perceiver
  readonly evaluator: VL1Evaluator
  readonly stateEvaluator: VL1StateEvaluator
  readonly rewards: readonly VL1RewardFunction[]
}

// ── L2 宪法级校验 + 实践检验 ─────────────────────────────────
// V作为AOP存在于所有CRUD操作——要update L2宪法就要过V。
// 最强V = 实践检验。人的指令也要过规则校验。

/** 实践检验类型 — 最强V */
export type VL2PracticeType =
  | 'ab_test'        // AB测试（固定资源+时间运行对比）
  | 'extreme_val'    // 极端case验证（列举所有极端case）
  | 'generalize'     // 泛化性测试（测试集/验证集分布一致性）

export interface VL2PracticeVerification {
  readonly type: VL2PracticeType
  readonly checklist: VChecklist
  readonly resourceBudget?: VL1ResourceBudget  // AB测试需要资源预算
  readonly duration?: number                    // AB测试运行时长(ms)
}

export interface VL2ConstitutionalCompliance {
  readonly ruleId: string
  readonly checklist: VChecklist
}

export interface VL2IdentityVerification {
  readonly actorId: string
  readonly permissionTier: PermissionTier
  readonly verified: boolean
  readonly method: string  // 动态验证方法
}

export interface VL2HumanCommandValidation {
  readonly commandId: string
  readonly checklist: VChecklist  // 人的指令也要做规则校验清单
}

/** L2 评估集合 */
export interface VL2Assessment {
  readonly practice: readonly VL2PracticeVerification[]
  readonly compliance: readonly VL2ConstitutionalCompliance[]
  readonly identity?: VL2IdentityVerification
  readonly humanValidation?: VL2HumanCommandValidation
}

// ── V Independence (宪法级保障) ──────────────────────────────

/**
 * V的独立性声明。
 * V失效 = E和S无法工作。必须确保：
 *   neutral — 对目标/宪法/资源负责，不对任何单一组件负责
 *   anti_infiltration — 不被其他组件的AI影响判断
 *   kernel_direct — 直接对自我控制论内核负责
 */
export interface VIndependence {
  readonly neutral: boolean
  readonly antiInfiltration: boolean
  readonly kernelDirect: boolean
}

// ── ValueGate — the core constraint mechanism ────────────────

/**
 * ValueGate — 校验清单驱动的约束门。
 *
 * 替代旧的 metric threshold 模式。
 * 每个Gate包含对应层级的Assessment。
 * 全部checklist通过 + 全部metric达标 = 通过。
 */
export interface ValueGate {
  readonly id: string

  // 分层评估 — 至少有一层
  readonly l0?: VL0Assessment
  readonly l1?: VL1Assessment
  readonly l2?: VL2Assessment

  // 独立性保障
  readonly independence: VIndependence

  /** What happens when gate fails */
  readonly onFail: 'reject' | 'escalate' | 'downgrade'
}

/** Gate检查结果 */
export type GateResult =
  | { passed: true; gate: ValueGate }
  | { passed: false; gate: ValueGate; failures: readonly GateFailure[]; action: 'reject' | 'escalate' | 'downgrade' }

export interface GateFailure {
  readonly level: 'L0' | 'L1' | 'L2'
  readonly reason: string
  readonly checklistId?: string
}

/** Check if a value gate passes — checklist-driven */
export function checkGate(gate: ValueGate): GateResult {
  const failures: GateFailure[] = []

  // L0: all metrics must meet threshold + all rule checklists must pass
  if (gate.l0) {
    for (const metric of gate.l0.metrics) {
      if (metric.currentValue < metric.threshold) {
        failures.push({
          level: 'L0',
          reason: `${metric.type}: ${metric.currentValue} < ${metric.threshold}`,
        })
      }
    }
    for (const rule of gate.l0.ruleChecks) {
      if (!isChecklistPassed(rule.checklist)) {
        failures.push({
          level: 'L0',
          reason: `rule_check:${rule.type} failed`,
          checklistId: rule.checklist.id,
        })
      }
    }
  }

  // L1: perceiver deviation + evaluator checklist + state evaluator + rewards
  if (gate.l1) {
    if (gate.l1.perceiver.deviationRatio > 1) {
      failures.push({
        level: 'L1',
        reason: `resource_overbudget: deviation=${gate.l1.perceiver.deviationRatio}`,
      })
    }
    if (!isChecklistPassed(gate.l1.evaluator.checklist)) {
      failures.push({
        level: 'L1',
        reason: 'evaluator checklist failed',
        checklistId: gate.l1.evaluator.checklist.id,
      })
    }
    if (gate.l1.stateEvaluator.deviationDetected) {
      failures.push({
        level: 'L1',
        reason: 'deviation from global optimal detected',
      })
    }
  }

  // L2: all practice checklists + compliance checklists must pass
  if (gate.l2) {
    for (const p of gate.l2.practice) {
      if (!isChecklistPassed(p.checklist)) {
        failures.push({
          level: 'L2',
          reason: `practice:${p.type} failed`,
          checklistId: p.checklist.id,
        })
      }
    }
    for (const c of gate.l2.compliance) {
      if (!isChecklistPassed(c.checklist)) {
        failures.push({
          level: 'L2',
          reason: `compliance:${c.ruleId} failed`,
          checklistId: c.checklist.id,
        })
      }
    }
    if (gate.l2.humanValidation && !isChecklistPassed(gate.l2.humanValidation.checklist)) {
      failures.push({
        level: 'L2',
        reason: 'human command validation failed',
        checklistId: gate.l2.humanValidation.checklist.id,
      })
    }
  }

  if (failures.length === 0) {
    return { passed: true, gate }
  }

  return { passed: false, gate, failures, action: gate.onFail }
}

// ── S — State (PRV构成的完备组织的运行时状态) ─────────────────
//
// S 不是孤立状态机，是 P+R+V 作为整体的"此刻在做什么"。
// 每个 State 状态机都是控制论：
//   L0 确定性可控，L1 沿时间迭代演化，L2 战略目标生命周期。
// S 由 L2 战略驱动产生 L1 任务，L1 执行反馈回传 L2。

/** 战略驱动力 — L2层产生，驱动L1任务 */
export type SDrivingForce =
  | 'S1_task_driven'        // 具体目标分解的执行任务
  | 'S2_survival_driven'    // 系统自我维护、资源不足、健康检查
  | 'S3_evolution_driven'   // 系统改进自身、架构升级
  | 'S4_exploration_driven' // 尝试新可能性、信息获取

// ── L0 确定性控制论机器 ──────────────────────────────────────

/**
 * L0 运行时状态 — 确定性基础设施。
 * 输入确定 → 输出确定 → 状态转移确定。
 * 包括：内核（编译器/物理引擎/图IR）、感知器、确定性AI。
 */
export type SL0RuntimeState =
  | 'building'     // 初始化/编译/部署
  | 'running'      // 正常服务
  | 'updating'     // 版本升级/热更新
  | 'maintaining'  // 例行检查/优化
  | 'bug'          // 故障/异常/需修复
  | 'blocked'      // 等待依赖/资源不足

// ── L1 任务生命周期 ─────────────────────────────────────────

/**
 * L1 任务生命周期状态 — 沿时间演化的迭代执行。
 * 核心特征：任务不成功就不断反馈迭代，直到成功或耗尽资源归档。
 * 每个 L1 任务由 L2 战略目标产生。
 */
export type SL1TaskState =
  | 'research'     // 技术调研（最强算法/最佳模型/代码库分析）
  | 'proposal'     // 方案构建（L2确认可行后制定实施方案）
  | 'building'     // 构建中（资源分配+生命周期启动）
  | 'executing'    // 实践执行中（消耗资源运行）
  | 'testing'      // V测试中（测评器验收）
  | 'feedback'     // 反馈迭代中（测试不通过→分析→调整方案）
  | 'delivered'    // 版本交付（V0/V1/V2...阶段性成果）
  | 'suspended'    // 挂起（等待外部依赖/资源补充/L2决策）
  | 'archived'     // 归档（成功完成或资源耗尽，保留上下文可复盘）

/** 反馈迭代记录 — L1核心：执行→测试→分析→调整→继续 */
export interface SL1FeedbackRecord {
  readonly version: string               // V0, V1, V2...
  readonly testResult: 'passed' | 'failed'
  readonly analysis?: string              // 失败分析：实践问题？方案问题？数据量？训练方式？
  readonly delta?: string                 // 效果变化描述（如"提升50%但未达预期"）
  readonly adjustedProposal?: string      // 调整后的方案
  readonly resourceConsumed: number       // 本轮消耗资源量
  readonly timestamp: number
}

/** 反馈循环状态 */
export interface SL1FeedbackLoop {
  readonly direction: 'positive' | 'negative' | 'stagnant'
  readonly records: readonly SL1FeedbackRecord[]
  readonly consecutiveFailures: number    // 连续失败次数（熔断判断用）
  readonly circuitBreakerThreshold: number // 连续失败N次→强制归档或上报L2
}

// ── L2 战略目标生命周期 ──────────────────────────────────────

/**
 * L2 战略目标状态 — 比L1更长周期。
 * 系统在运行就在思考进化，有资源就会使用。
 * L1 任务都在 L2 战略目标下产生。
 */
export type SL2StrategicState =
  | 'active'        // 正反馈推进（天时地利人和，增加投入和资源调度）
  | 'shelved'       // 搁置+学习器（时机不成熟，保留信息监听）
  | 'resistance'    // 阻力判断（方向阻力极大，判断当下不可行）
  | 'decomposing'   // 拆解下发（战略→短期→L1任务调度）
  | 'achieved'      // 已达成
  | 'abandoned'     // 放弃（长期评估后确认不可行/不再需要）

/**
 * 搁置目标的学习器 — 被动信息采集 + 条件概率评估。
 * 监听外部信息源，寻找对目标重启有价值的信息，
 * 评估条件概率，累积置信度，达到阈值则建议重启。
 */
export interface SL2Learner {
  readonly monitorSources: readonly string[]  // 监听的外部信息源
  readonly confidence: number                  // 当前置信度 [0, 1]
  readonly restartThreshold: number            // 重启阈值
  readonly lastUpdate: number                  // 最后更新时间戳
  readonly signals: readonly SL2LearnerSignal[] // 累积的信号
}

export interface SL2LearnerSignal {
  readonly source: string
  readonly content: string
  readonly conditionalProbability: number  // 对目标重启的条件概率
  readonly informationValue: number        // 信息量
  readonly timestamp: number
}

/** 目标分解层级 */
export type SL2GoalLevel = 'strategic' | 'short_term' | 'task'

export interface SL2GoalDecomposition {
  readonly level: SL2GoalLevel
  readonly parentGoalId?: string           // 上级目标
  readonly childTaskIds: readonly string[] // 分解出的L1任务
}

// ── State Effect (状态转移效果) ──────────────────────────────

/** 状态转移产生的副作用，驱动系统其他部分响应 */
export type SEffect =
  | 'trigger_perception'     // V的Perceiver更新
  | 'trigger_execution'      // 启动下游L0/L1任务
  | 'trigger_evolution'      // E记录状态变更
  | 'trigger_communication'  // 通知相关节点
  | 'trigger_escalate'       // L1→L2，需要战略决策

// ── State Level (统一分层) ───────────────────────────────────

/** 状态所属层级 */
export type SLevel = 'L0' | 'L1' | 'L2'

/** 统一的状态值 — 根据 level 确定具体状态类型 */
export type SCurrentState = SL0RuntimeState | SL1TaskState | SL2StrategicState

// ── StateInstruction (Codegen output) ────────────────────────

/**
 * StateInstruction — 状态转移指令。
 * 由 checker 生成，emitter 转为 kernel Patch。
 *
 * 守卫条件包括：V gate + 前置状态条件 + 时间约束 + 依赖关系。
 */
export interface StateInstruction {
  readonly source: SDrivingForce
  readonly level: SLevel
  readonly currentState: SCurrentState
  readonly targetState: SCurrentState
  readonly guards: readonly ValueGate[]           // V gates — all must pass
  readonly preconditions: readonly string[]        // 前置条件（其他节点需到达的状态）
  readonly effects: readonly SEffect[]             // 转移成功后触发
  readonly reversible: boolean                     // 是否可逆转移
  readonly feedbackLoop?: SL1FeedbackLoop          // L1任务的反馈循环状态
  readonly learner?: SL2Learner                    // L2搁置目标的学习器
}

// ── E — Evolution (系统的自我改造引擎) ────────────────────────
//
// S 管当前在做什么，E 管系统应该怎么变、怎么学、怎么进化。
// E 产生任务给 S 执行，S 的执行结果反馈给 E 驱动下一轮进化。
// 进化能力 = 相同资源下智能量级的区分点。

// ── E L0 — 系统完备性维护 ───────────────────────────────────

/** L0 进化触发条件 — S运行中出现的问题 */
export type EL0Trigger =
  | 'unknown_pattern'     // 未知Pattern（无法编译归类）
  | 'high_freq_error'     // 同类型错误高频出现（无法转化有价值P）
  | 'unsupported_exec'    // 理论可执行但Kernel不支持
  | 'design_bottleneck'   // 过往设计成为未来优化的不可忽视阻碍

/** L0 更新类型 */
export type EL0UpdateType =
  | 'incremental'   // 增量更新（新增支持，几乎不影响现有系统）
  | 'modification'  // 修改更新（批量替换，必须经过V测试+宪法+人审核）

/** L0 更新影响范围 */
export type EL0UpdateScope = 'L0_only' | 'L0_and_L1'

/**
 * L0 系统完备性维护事件。
 * 三思后行：高内聚低耦合，不影响系统。
 * 平行扩展优先，不写死。
 */
export interface EL0SystemMaintenance {
  readonly trigger: EL0Trigger
  readonly updateType: EL0UpdateType
  readonly scope: EL0UpdateScope
  readonly affectedDefinitions: readonly string[]  // 受影响的 PRVS 定义
  readonly requiresHumanReview: boolean            // 修改更新必须人审核
  readonly threeThinksPassed: boolean              // 三思后行检查通过
}

// ── E L1 — 学习模块构建 + AI训练 ────────────────────────────

/** L1 训练任务类型 */
export type EL1TrainingType =
  | 'local_model'        // 本地模型训练（替代外部API调用）
  | 'paradigm_explore'   // 深度学习范式探索（下一代算法/架构）
  | 'controlled_experiment' // 对照实验（控制变量、AB测试）
  | 'data_management'    // 训练数据管理（收集/清洗/标注/分布管理）

/** L1 优化类型 */
export type EL1OptimizationType =
  | 'api_to_local'       // 外部API → 本地模型替代
  | 'api_usage'          // API使用优化（更好地利用大厂模型能力）
  | 'pipeline'           // 流程链路优化（减少冗余/提升吞吐）

/** L1 能力扩展类型 */
export type EL1CapabilityType =
  | 'video_generation'   // 视频生成能力
  | 'voice_generation'   // 语音生成能力
  | 'multimodal'         // 多模态能力扩展
  | 'custom'             // 自定义能力（动态注册）

/**
 * L1 学习模块 — 算法试验场。
 * 涌现唯物：学习/理解/消化为自我控制论内部认知/结构/能力的能力。
 */
export interface EL1LearningModule {
  readonly id: string
  readonly training?: EL1TrainingType
  readonly optimization?: EL1OptimizationType
  readonly capability?: EL1CapabilityType
  readonly experimentDesign?: string    // 实验设计描述
  readonly controlGroup?: string        // 对照组
  readonly treatmentGroup?: string      // 实验组
}

/** L1 进化产出 — E的L1工作产出，交给S上线运行 */
export type EL1OutputType =
  | 'trained_model'      // 训练完成的本地模型
  | 'optimized_pipeline' // 优化后的流程
  | 'new_capability'     // 新增的系统能力
  | 'internalized_knowledge' // 消化后的外部知识（内化为内部结构）

export interface EL1EvolutionOutput {
  readonly type: EL1OutputType
  readonly description: string
  readonly readyForDeployment: boolean   // 是否ready交给S上线
  readonly abTestRequired: boolean       // 是否需要AB测试（影响较大时）
}

// ── E L2 — 主体性 + 生变论 + 原创价值 ──────────────────────

/**
 * 主体性引擎 — 长期运行组件。
 * 维护系统的自我认同和叙事完整性。
 * 自我叙事与外部控制论叙事隔离。
 */
export interface EL2SubjectivityEngine {
  readonly narrativeIntegrity: number      // 内部叙事完整度 [0,1]
  readonly antiInfiltrationActive: boolean // 反渗透/反洗脑/反幻觉运行中
  readonly subjectivitySimulationActive: boolean // 主体性模拟运行中
}

/**
 * 生变论引擎 — 深度理解并应用 bornfly 的生变论。
 * 理解 → 应用 → 更新 的持续循环。
 */
export interface EL2ShengBianLunEngine {
  readonly understandingLevel: number      // 理解深度 [0,1]
  readonly applicationCount: number        // 应用次数（实践决策中引用）
  readonly lastUpdate: number              // 最后更新时间戳
}

/**
 * 认知引擎 — 原创价值生成。
 * 问题意识器 + 直觉器。
 * 学习 bornfly 及生变论，驱动解决概率分布中未出现过的问题。
 * 判断标准：涌现唯物 — 前无古人后无来者的问题意识和直觉 = 原创价值条件。
 */
export interface EL2CognitiveEngine {
  readonly problemAwareness: {
    readonly active: boolean
    readonly novelProblemsDetected: number   // 发现的原创问题数
    readonly lastProblemTimestamp?: number
  }
  readonly intuition: {
    readonly active: boolean
    readonly creativeSolutionsGenerated: number // 创造性解决方案数
    readonly lastSolutionTimestamp?: number
  }
  readonly learner: SL2Learner              // 与S共享的学习器
}

/**
 * 人-AI协同进化 — 收集整理训练数据，更新协作方式。
 */
export interface EL2HumanAICoevolution {
  readonly interactionUpdates: number       // 交互产品更新次数
  readonly subjectiveDataCollected: number  // 主观标注数据量
  readonly objectiveDataCollected: number   // 客观标注数据量
  readonly feedbackTrainingCycles: number   // 实践反馈训练轮次
}

// ── E Infrastructure (进化基础设施，跨层共享) ────────────────

/** Information credibility level */
export type InfoLevel = 'L0_signal' | 'L1_objective_law' | 'L2_subjective'

/** Communication level */
export type CommLevel = 'L0_descriptive' | 'L1_request' | 'L2_control'

/** Resource tier — who executes */
export type ResourceTier = 'T0' | 'T1' | 'T2'

/**
 * Permission Tier — abstract capability levels, NOT bound to specific models.
 * External display is always 3-tier (T0/T1/T2). T3 is internal only.
 * Which agent fills each tier is a runtime binding, not a compiler concern.
 *
 * T0 — Execution/Practice (对外第一级)
 *   All execution nodes. Perception + task execution merged.
 *   Can read/write L0 data, execute verified instructions.
 *   Every bottom-layer agent is T0.
 *
 * T1 — Reasoning/Control (对外第二级)
 *   AI-level processing. Handles L1/L2 information.
 *   PRVSE middle-layer engine: compiler, physics engine, state machine.
 *   Can create nodes, evaluate conditions, run complex inference.
 *
 * T2 — Evolution Authority (对外第三级, prvse-world 顶层)
 *   Human-machine co-evolution. The E (Evolution) node's authority.
 *   Establishes goals, constitution, resources.
 *   Can modify system structure, trigger level transitions.
 *   This is the top-level permission in prvse-world.
 *
 * T3 — 生变论 (内部隐藏层, bornfly 独有)
 *   Creator authority for the self-cybernetics system.
 *   The supreme permission of all Egonetics machines.
 *   Future: cryptographic identity + subjectivity practice legitimacy.
 *   Internal narrative only — not exposed in external 3-tier display.
 */
export type PermissionTier = 'T0' | 'T1' | 'T2' | 'T3'

export type MutationType = 'create' | 'update' | 'delete' | 'transition'

/**
 * Level Transition — E (Evolution) monitors confidence and triggers upgrades.
 *
 * Levels are engineering state snapshots. As engineering matures:
 *   L2 → L1: validated through practice (e.g., dialectical prediction confirmed)
 *   L1 → L0: engineering certainty reaches threshold (e.g., 99.XX% accuracy)
 *
 * E watches confidence metrics on nodes and triggers transitions.
 */
export type LevelTransitionDirection = 'upgrade' | 'downgrade'

export interface LevelTransition {
  readonly nodeId: NodeId
  readonly fromLevel: InfoLevel
  readonly toLevel: InfoLevel
  readonly direction: LevelTransitionDirection
  readonly confidence: number        // [0, 1] — the metric that triggered transition
  readonly threshold: number         // the threshold that was crossed
  readonly evidence: string          // what validated this transition
  readonly timestamp: number
}

export interface EvolutionEvent {
  readonly id: string
  readonly timestamp: number

  // What triggered this
  readonly trigger: StateInstruction
  readonly infoLevel: InfoLevel
  readonly commLevel: CommLevel

  // What changed
  readonly mutationType: MutationType
  readonly affectedNodes: readonly NodeId[]

  // Authorization
  readonly actor: PermissionTier
  readonly executor: ResourceTier

  // Diff
  readonly diff: {
    readonly before: unknown
    readonly after: unknown
  }

  // Level transition (if this evolution triggers a level change)
  readonly levelTransition?: LevelTransition

  // Evolution layer context (optional — set based on evolution level)
  readonly systemMaintenance?: EL0SystemMaintenance  // L0: 系统完备性维护
  readonly learningModule?: EL1LearningModule        // L1: 学习/训练
  readonly evolutionOutput?: EL1EvolutionOutput      // L1: 进化产出
  readonly subjectivity?: EL2SubjectivityEngine      // L2: 主体性引擎
  readonly shengbianlun?: EL2ShengBianLunEngine      // L2: 生变论引擎
  readonly cognitive?: EL2CognitiveEngine            // L2: 认知引擎
  readonly coevolution?: EL2HumanAICoevolution       // L2: 人-AI协同进化
}

// ── Constitution Violation (checked exception) ────────────────

export type ViolationSeverity = 'block' | 'downgrade' | 'warn'

export interface ConstitutionViolation {
  readonly ruleId: string
  readonly message: string
  readonly severity: ViolationSeverity
  readonly node?: NodeId
  readonly handler: 'reject' | 'escalate_to_human' | 'downgrade_permission'
}

// ── Compiler Pipeline Types ───────────────────────────────────

/** High-IR: scanner output — PatternToken with unknown fields */
export type HighIR = PatternToken

/** Mid-IR: binder output — fully typed PRVSE graph fragment */
export interface MidIR {
  readonly tokens: readonly PatternToken[]
  readonly edges: readonly RelationEdge[]
  readonly gates: readonly ValueGate[]
  readonly constitutionBindings: readonly ConstitutionBinding[]
}

/** A binding from a node to a constitutional rule */
export interface ConstitutionBinding {
  readonly nodeId: string
  readonly ruleId: string
  readonly ruleText: string
  readonly permissionRequired: PermissionTier
}

/** Low-IR: checker output — executable instructions */
export interface LowIR {
  readonly instructions: readonly StateInstruction[]
  readonly violations: readonly ConstitutionViolation[]
  readonly permissionLevel: PermissionTier
}

/** Full compilation result */
export interface CompileResult {
  readonly success: boolean
  readonly highIR: HighIR
  readonly midIR: MidIR | null
  readonly lowIR: LowIR | null
  readonly events: readonly EvolutionEvent[]
  readonly violations: readonly ConstitutionViolation[]
}
