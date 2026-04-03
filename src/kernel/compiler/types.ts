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

// ── S — State Instruction (Codegen output) ────────────────────

export type SSource =
  | 'S1_task_driven'
  | 'S2_survival_driven'
  | 'S3_evolution_driven'
  | 'S4_exploration_driven'

export type SNodeTier = 'execution' | 'research' | 'update'

export type SStateMachine =
  | 'building'
  | 'trial'
  | 'stable'
  | 'bug_suspended'
  | 'waiting'
  | 'positive_loop'
  | 'negative_loop'
  | 'archived'

export type SEffect =
  | 'trigger_perception'
  | 'trigger_execution'
  | 'trigger_evolution'
  | 'trigger_communication'

export interface StateInstruction {
  readonly source: SSource
  readonly nodeTier: SNodeTier
  readonly currentState: SStateMachine
  readonly targetState: SStateMachine
  readonly guards: readonly ValueGate[]  // all must pass
  readonly effects: readonly SEffect[]   // triggered on success
}

// ── E — Evolution Event (Runtime output) ──────────────────────

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
