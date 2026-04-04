# PRVSE Compiler — TypeScript Language Specification

> Version: 2.0.0
> Last sync: 2026-04-04
> Source of truth: `docs/prvse-compiler-design.md`
> Purpose: 将 design.md 的语言无关规范转化为 TypeScript 可执行的类型系统

---

## 0. 总览

```
Raw Input → [Scanner] → PatternToken (High-IR)
                            ↓
         → [Binder]  → MidIR (narrowed tokens + edges + gates + constitution bindings)
                            ↓
         → [Checker] → LowIR (validated instructions + violations + permission level)
                            ↓
         → [Emitter] → Kernel Patches + Effects + Evolution Events
```

核心原则：**编译不通过就不运行** — blocked = no execution, period.

五根（Root Primitives）在流水线中的角色：

| 根 | ID | 编译器角色 |
|----|-----|-----------|
| **P** Pattern | `tag-p` | Scanner 输入 — 信息原语，三态驱动 |
| **R** Relation | `tag-r` | Binder — 节点连接的合法性与性质 |
| **V** Value | `tag-v` | Checker — 校验清单驱动的大法官 |
| **S** State | `tag-s` | Emitter Target — 状态转移指令 |
| **E** Evolution | `tag-e` | Emitter Output — 演化事件/系统进化 |

---

## 1. P — Pattern（信息原语）

### 1.1 三态（State）

```typescript
type PState =
  | 'external'   // 原始信息，尚未经过 L0 验证
  | 'candidate'  // 通过 L0 验证，尚未经过实践验证
  | 'internal'   // 实践验证通过，确定性，工程可控

// 宪法规则：external → internal 无捷径
// 即使内部生成的假设/规则，也必须经过实践验证才能成为 internal
```

### 1.2 Origin（链式溯源）

```typescript
type POriginDomain = 'internal' | 'external'

// 内部来源 — 天然合法
type PInternalSource =
  | 'user_input'      // 人类主体操作
  | 'model_call'      // 内部 AI 推理/生成
  | 'module_output'   // 组件输出 / 执行结果
  | 'system_event'    // 状态变化 / 调度触发
  | 'process_memory'  // 年鉴 / 生命记忆

// 外部来源 — 需控制论过滤改造
type PExternalSource =
  | 'computable'   // 代码仓库、数据库、API 返回、数学计算（高确定性，完整溯源链）
  | 'verifiable'   // 论文、实验数据、权威文档（可验证但需人/AI 判断）
  | 'narrative'    // 社交媒体、个人表达、AI 生成内容（主观表达）
  | 'sensor'       // 传感器、监控、自动采集（物理世界信号）

interface POrigin {
  domain: POriginDomain
  source: PInternalSource | PExternalSource
  // 链式结构：每条信息必须能追溯到其起始点
  chain?: POrigin[]
}
```

### 1.3 Physical Type（物理载体）

```typescript
// L0 级分类，纯规则，无需语义理解
type PPhysicalType =
  | 'text'       // 自然语言
  | 'number'     // 数值 / 度量
  | 'code'       // 程序 / 脚本 / 配置
  | 'structured' // JSON / 表格 / 数据库记录
  | 'image'      // 图像
  | 'audio'      // 音频
  | 'video'      // 视频
  | 'stream'     // 实时事件流 / 传感器流
  | 'mixed'      // 代码+注释 / 图像+文字 / 多模态
```

### 1.4 Level（三级形态）

```typescript
type PLevel =
  | 'L0_atom'     // 最小完备信息单元：具体、完整，必须含有价值信息
  | 'L1_molecule' // P+R+V 组合结构：高内聚低耦合工程模块
  | 'L2_gene'     // L1 实践的抽象：最少内容，最大覆盖

// 宪法规则：Level ≠ Power
// L1 可以自升为 L2 候选（需要规则验证 + 人类确认）
// "谁最强谁最好就是谁" — 能力决定权威，而非层级
```

### 1.5 Communication Direction（通信方向）

```typescript
type PCommunication =
  | 'bottom_up'  // L1 涌现 → L2 候选（需规则验证 + 人类二次确认）
  | 'top_down'   // 高层抽象指导实践
  | 'lateral'    // 同级通信（由 R + 宪法规则决定，A→B / 广播）
```

### 1.6 Narrowable 渐进定型原语

```typescript
type Narrowable<T> =
  | { resolved: true;  value: T }   // 字段已分类
  | { resolved: false }             // 仍未知 → 触发权限降级
```

### 1.7 PatternToken（Scanner 输出）

```typescript
interface PatternToken {
  // === 必填（Scanner 阶段确定）===
  id: string                          // 唯一 Token 标识符
  timestamp: number                   // 创建时间（epoch ms）
  rawContent: string                  // 原始内容（审计用，不可篡改）
  origin: POrigin                     // 链式溯源 — 入口时必须声明
  state: PState                       // 外部来源 → 'external'；内部 → 'candidate'

  // === Narrowable 字段（通过流水线逐步收窄）===
  physical: Narrowable<PPhysicalType>
  level: Narrowable<PLevel>
  communication: Narrowable<PCommunication>
}

// Narrowing Level（决定最大权限）
type NarrowingLevel =
  | 'full'    // 3 个 Narrowable 字段全部 resolved → 最大 T2
  | 'partial' // 1-2 个 resolved → 最大 T1
  | 'minimal' // 0 个 resolved → 最大 T0，severity = downgrade
```

---

## 2. Scanner（Lexer）

```typescript
interface ScannerInput {
  content: string
  origin: POrigin
  hints?: Partial<{
    physical: PPhysicalType
    level: PLevel
  }>
}

// 分类规则（启发式，生产环境由 LLM 替换）
const SCANNER_RULES = {
  physical: {
    // 数字模式 → 'number'
    // 代码信号（括号/关键字/箭头）≥2 个 → 'code'
    // 以 { 或 [ 开头且合法 JSON → 'structured'
    // 默认非空 → 'text'
    // 空 → unresolved
  },
  state: {
    // external origin → 'external'
    // internal origin → 'candidate'（已过系统边界，等待实践）
  },
  level: {
    // 数值 / 结构化 / 来自 computable 的代码 → 'L0_atom'
    // 内容引用多个组件或系统 → 'L1_molecule'
    // 默认 → unresolved（留给 Binder）
  },
  communication: 'always_unresolved_at_scanner' // 需要上下文
}
```

---

## 3. Binder

### 3.1 Purpose

确定性推断 — 无 LLM 调用。收窄未解析字段 + 绑定宪法规则 + 构造 MidIR。

### 3.2 Narrowing Rules

```typescript
// Level 推断（从 physical + origin）
const BINDER_LEVEL_RULES = {
  'code + internal module_output': 'L0_atom',       // 执行产物
  'internal system_event/module_output result': 'L0_atom', // 确定性输出
  'external narrative origin': 'L0_atom',           // 原始输入，最低形态
  'content with P+R+V references': 'L1_molecule',
  'content referencing constitution/goals': 'L2_gene'
}

// Communication 推断（从 origin + level）
const BINDER_COMM_RULES = {
  'internal module_output or system_event': 'lateral', // 同级信号
  'external': 'bottom_up',                            // 从外部进入，向上
  'level L2': 'top_down'                              // 抽象指导实践
}
```

### 3.3 Constitution Bindings

```typescript
interface ConstitutionRule {
  id: string
  rule: string
  permission: PermissionTier
  appliesWhen: (token: PatternToken) => boolean
}

const CONSTITUTION_RULES: ConstitutionRule[] = [
  { id: 'const-001', rule: 'L0 atoms: 任意执行节点可读写', permission: 'T0',
    appliesWhen: t => t.level.resolved && t.level.value === 'L0_atom' },
  { id: 'const-002', rule: 'L1 molecules 需要推理权限', permission: 'T1',
    appliesWhen: t => t.level.resolved && t.level.value === 'L1_molecule' },
  { id: 'const-003', rule: 'L2 genes 需要演化权限', permission: 'T2',
    appliesWhen: t => t.level.resolved && t.level.value === 'L2_gene' },
  { id: 'const-004', rule: '外部来源必须声明溯源链', permission: 'T0',
    appliesWhen: t => t.origin.domain === 'external' },
  { id: 'const-005', rule: 'external→candidate 需要 L0 验证', permission: 'T0',
    appliesWhen: t => t.state === 'external' },
  { id: 'const-006', rule: 'candidate→internal 需要实践验证', permission: 'T1',
    appliesWhen: t => t.state === 'candidate' },
  { id: 'const-007', rule: '禁止 external 直接变为 internal', permission: 'BLOCK',
    appliesWhen: () => false /* Checker 阶段独立检测 */ },
]
```

### 3.4 MidIR

```typescript
interface RelationEdge {
  id: string
  sourceNode: string
  targetNode: string
  infoLevel: 'L0_logic' | 'L1_conditional' | 'L2_existential'
  direction: 'none' | 'one_way' | 'bidirectional'
  certainty: 'deterministic' | 'probabilistic' | 'fuzzy'
  temporal: 'simultaneous' | 'sequential' | 'cyclic'
  logic?: 'deductive' | 'inductive' | 'analogical'            // L0
  causal?: 'condition' | 'temporal' | 'causal' | 'process'    // L1
  dialectic?: 'oppose' | 'transform' | 'unify'                // L2
  strength: 'positive' | 'negative'
  edgeType: 'contains' | 'constraint' | 'mutual_constraint' | 'signal' | 'derives' | 'directed'
  propagation: 'forward' | 'backward' | 'bidirectional'
  priority: number
  destination: 'R_D1' | 'R_D2' | 'R_D3' | 'R_D4' | 'R_D5'
}

interface ValueGate {
  l0?: VL0Assessment
  l1?: VL1Assessment
  l2?: VL2Assessment
  onFail: 'reject' | 'escalate' | 'downgrade'
}

interface MidIR {
  tokens: PatternToken[]
  edges: RelationEdge[]
  gates: ValueGate[]
  constitutionBindings: Map<string, ConstitutionRule[]> // tokenId → rules
}
```

---

## 4. Checker

### 4.1 Permission Hierarchy

```typescript
type PermissionTier = 'T0' | 'T1' | 'T2' | 'T3' | 'BLOCK'

// T3（生变论，bornfly creator）> T2（演化）> T1（推理）> T0（执行）
// 对外展示永远是三级（T0/T1/T2），T3 仅内部
// 低层不可修改高层
```

### 4.2 State Transition Rules

```typescript
type StateTransitionRule = {
  from: PState
  to: PState
  condition: string
  allowed: boolean
}

const STATE_TRANSITIONS: StateTransitionRule[] = [
  { from: 'external',   to: 'candidate', condition: 'L0 验证通过（格式+溯源+基本分类）', allowed: true },
  { from: 'candidate',  to: 'internal',  condition: '实践验证确认（测试+工程确定性）', allowed: true },
  { from: 'internal',   to: 'internal',  condition: '正常运行', allowed: true },
  { from: 'external',   to: 'internal',  condition: '禁止！无捷径', allowed: false }, // BLOCK
  { from: 'any' as PState, to: 'external', condition: '失效（发现错误，撤销信任）', allowed: true },
]
```

### 4.3 Edge Legality Matrix（PRVSE 循环：P→R→V→S→E→P）

```typescript
type EdgeAllowedTypes = {
  [key: string]: RelationEdge['edgeType'][]
}

const EDGE_LEGALITY: EdgeAllowedTypes = {
  'P→R': ['directed', 'signal', 'derives'],
  'R→V': ['constraint', 'directed'],
  'V→S': ['directed', 'constraint'],
  'S→E': ['directed', 'signal'],
  'E→P': ['directed', 'derives'],
  'P→P': ['contains'],
  'V→V': ['mutual_constraint'],
  'R→R': ['mutual_constraint', 'derives'],
  'S→R': ['signal'],   // 反馈
  'E→V': ['directed'],
  'E→S': ['directed'],
  // 禁止：'V→P', 'S→P', 'P→S'（必须走完整循环）
}
```

### 4.4 Info Level Policies

```typescript
interface InfoLevelPolicy {
  canModifyConstitution: boolean
  canCreateNodes: boolean
  canDelete: boolean
  maxPermission: PermissionTier
  requiresVerification: boolean
}

const INFO_LEVEL_POLICIES: Record<string, InfoLevelPolicy> = {
  L0_signal:       { canModifyConstitution: false, canCreateNodes: false, canDelete: false, maxPermission: 'T0', requiresVerification: false },
  L1_objective_law:{ canModifyConstitution: false, canCreateNodes: true,  canDelete: false, maxPermission: 'T1', requiresVerification: false },
  L2_subjective:   { canModifyConstitution: false, canCreateNodes: true,  canDelete: true,  maxPermission: 'T2', requiresVerification: true  },
}
```

### 4.5 Violation

```typescript
type ViolationSeverity = 'block' | 'downgrade' | 'warn'

interface Violation {
  ruleId: string
  severity: ViolationSeverity
  tokenId?: string
  message: string
}
```

### 4.6 LowIR

```typescript
interface LowIR {
  instructions: StateInstruction[]  // blocked 时为空
  violations: Violation[]
  permissionLevel: PermissionTier   // 所有检查后的有效权限
}

// 核心函数签名
function isConstitutionSatisfiedBy(midIR: MidIR, context: CheckerContext): LowIR
```

---

## 5. V — Value（校验清单驱动的大法官）

V 必须独立 — 不被其他组件 AI 渗透，对目标/宪法/资源中立负责，直接对自我控制论内核负责。
**最强 V = 实践验证。**

### 5.1 L0 — 确定性验证（100% 可判定，纯 L0 逻辑）

```typescript
// 客观指标（8 类）
type VL0Metric =
  | { type: 'accuracy';        value: number }              // 准确率
  | { type: 'recall';          value: number }              // 召回率
  | { type: 'precision';       value: number }              // 精确率
  | { type: 'f1';              value: number }              // F1 Score
  | { type: 'counter';         value: number; aggregation: 'sum' | 'max' | 'last' }
  | { type: 'timer';           value: number; unit: 's' }   // 响应/执行/超时
  | { type: 'resource';        value: number; unit: 'token' | 'memory' | 'storage' | 'api_cost' }
  | { type: 'binary';          value: 0 | 1 }               // pass/fail
  | { type: 'roi';             value: number }              // 投入产出比
  | { type: 'marginal_return'; value: number }              // 边际收益

// 规则清单（宪法约束，全部必须通过）
type VL0RuleCheck = 'result' | 'function' | 'effect' | 'extreme' | 'format'

interface VL0Assessment {
  metrics: VL0Metric[]
  ruleChecks: VL0RuleCheck[]
  testSet: unknown[]    // V 独立持有，模块不可见
}
```

### 5.2 L1 — 生命周期动态评估（时间/过程/条件）

```typescript
interface VL1ResourceBudget {
  timeDeadline: number    // epoch ms
  aiTokens: number
  storage: number
  memory: number
}

interface VL1Perceiver {
  resourceConsumed: Partial<VL1ResourceBudget>
  checklistProgress: number  // 0-1
}

type VL1RewardFunction =
  | 'information'        // 信息量计算
  | 'alignment'          // 目标对齐度
  | 'ranking'            // 方案排名
  | 'relevance'          // 信息相关性/价值
  | 'optimality'         // 最优性检测（局部 vs 全局）
  | 'constitution'       // 宪法原则验证
  | 'opportunity_cost'   // 机会成本

interface VL1Assessment {
  budget: VL1ResourceBudget
  perceiver: VL1Perceiver
  rewardFunctions: VL1RewardFunction[]
  homeostasisDeviation: number  // [0,1]，超过阈值触发偏离检测
  isLocalOptima: boolean        // 是否陷入局部最优
}
```

### 5.3 L2 — 宪法验证 + 实践测试

```typescript
interface VL2Assessment {
  practiceVerification?: {
    abTest: boolean           // AB 测试（固定资源+时间对比）
    extremeCase: boolean      // 极端情况验证
    generalizationTest: boolean // 泛化测试（测试/验证集分布一致性）
  }
  constitutionalCompliance: boolean
  humanCommandValidation: boolean  // 人类指令也需规则清单验证
  identityVerification?: boolean   // T3 权限：bornfly 身份动态验证
}
```

### 5.4 ValueGate 完整类型

```typescript
interface ValueGate {
  l0?: VL0Assessment
  l1?: VL1Assessment
  l2?: VL2Assessment
  // 所有清单必须通过 + 所有指标必须达到阈值
  threshold: number
  onFail: 'reject' | 'escalate' | 'downgrade'
}
```

---

## 6. S — State（PRV 构成的完备组织的运行时状态）

S 不是孤立的状态机 — 是「P+R+V 现在在做什么」的整体。
L2 战略目标生成 L1 任务；L1 执行反馈流回 L2。

### 6.1 Driving Force

```typescript
type SDrivingForce =
  | 'S1_task_driven'        // 具体目标分解为可执行任务
  | 'S2_survival_driven'    // 系统自维护、资源不足、健康检查
  | 'S3_evolution_driven'   // 系统改造自身、架构升级
  | 'S4_exploration_driven' // 探索新可能、信息获取
```

### 6.2 L0 — 确定性控制论机器

```typescript
type SL0State =
  | 'building'    // 初始化/编译/部署
  | 'running'     // 正常服务
  | 'updating'    // 版本升级/热更新
  | 'maintaining' // 例行检查/优化
  | 'bug'         // 故障/错误/需修复
  | 'blocked'     // 等待依赖/资源不足

// 每次转移有 reversible 标记（bug→building 可逆，archived 不可逆）
```

### 6.3 L1 — 任务生命周期（时间演进迭代执行）

```typescript
type SL1State =
  | 'research'   // 技术调研（最佳算法/模型/代码库）
  | 'proposal'   // 方案构建（L2 确认可行性，再做实施计划）
  | 'building'   // 构建中（资源分配+生命周期启动）
  | 'executing'  // 实践中（消耗资源）
  | 'testing'    // V 测试（测评器验收）
  | 'feedback'   // 反馈迭代（测试失败→分析→调整方案）
  | 'delivered'  // 版本交付（V0/V1/V2... 里程碑成果）
  | 'suspended'  // 挂起（等待外部依赖/资源补充/L2 决策）
  | 'archived'   // 归档（完成或资源耗尽，保留上下文供复盘）

interface SL1FeedbackLoop {
  positiveFeedback: boolean   // V 测试通过 / 指标改善 → 继续推进
  negativeFeedback: boolean   // V 测试失败 → 分析根因
  consecutiveFailures: number
  circuitBreakerThreshold: number  // N 次连续失败 → 强制归档或上报 L2
  versionRecord: Array<{ version: string; planDelta: string; effectDelta: string }>
}
```

### 6.4 L2 — 战略目标生命周期

```typescript
type SL2State =
  | 'active'      // 正反馈推进（有利条件，增加投入）
  | 'shelved'     // 搁置+学习者（时机不到，持续监控条件概率）
  | 'resistance'  // 阻力判断（高阻力，当前判定不可行）
  | 'decomposing' // 分解中（战略→短期→L1 任务调度）
  | 'achieved'    // 目标达成
  | 'abandoned'   // 放弃（长期评估确认不可行/不再需要）

interface SL2ShelvedLearner {
  monitoringSources: string[]
  conditionalProbability: number  // [0,1]，超过阈值 → 推荐重启
  confidenceAccumulated: number
}
```

### 6.5 State Effects

```typescript
type SEffect =
  | 'trigger_perception'    // V 的 Perceiver 更新
  | 'trigger_execution'     // 启动下游 L0/L1 任务
  | 'trigger_evolution'     // E 记录状态变化
  | 'trigger_communication' // 通知相关节点
  | 'trigger_escalate'      // L1→L2，需要战略决策
```

### 6.6 StateInstruction

```typescript
interface StateInstruction {
  source: SDrivingForce
  level: 'L0' | 'L1' | 'L2'
  currentState: SL0State | SL1State | SL2State
  targetState:  SL0State | SL1State | SL2State
  guards: ValueGate[]          // 全部通过才允许转移
  preconditions: string[]      // 其他节点必须先到达某状态
  effects: SEffect[]           // 转移成功后触发
  reversible: boolean
  feedbackLoop?: SL1FeedbackLoop  // L1 任务专用
  learner?: SL2ShelvedLearner     // L2 搁置目标专用
}
```

---

## 7. E — Evolution（系统的自我改造引擎）

S 管理「现在发生什么」；E 管理「系统如何改变、学习、进化」。
演化能力 = 同等资源下智能水平的分水岭。

### 7.1 L0 — 系统完整性维护

```typescript
type EL0Trigger =
  | 'unknown_pattern'    // Pattern 无法编译/分类
  | 'high_freq_error'    // 同类错误高频出现
  | 'unsupported_exec'   // 理论可执行但 Kernel 不支持
  | 'design_bottleneck'  // 过去的设计成为未来优化的瓶颈

type EL0UpdateType = 'incremental' | 'modification'
// incremental：添加新支持，对现有系统影响最小
// modification：批量替换，需要 V 测试 + 宪法合规 + 人类审查
```

### 7.2 L1 — 学习模块构建 + AI 训练

```typescript
interface EL1LearningOutput {
  trainedModels?: string[]        // 训练好的本地模型
  optimizedPipelines?: string[]   // 优化的流水线
  newCapabilities?: string[]      // 新系统能力
  internalizedKnowledge?: string[] // 外部→内部结构化知识
}

type EL1ActivityType =
  | 'training'              // 本地模型训练、深度学习范式探索
  | 'optimization'          // 外部 API → 本地模型替换
  | 'capability_expansion'  // 视频生成、语音、多模态、自定义能力
```

### 7.3 L2 — 主体性 + 生变论 + 原创价值

```typescript
interface EL2SubjectivityEngine {
  internalNarrativeMaintained: boolean  // 内部叙事（与外部控制论叙事隔离）
  antiInfiltration: boolean
}

interface EL2CognitiveEngine {
  problemAwareness: string[]  // 发现概率分布之外的问题
  intuitionStrength: number   // [0,1]，大量实践+学习后的涌现直觉
}
```

### 7.4 EvolutionEvent

```typescript
type ECommLevel =
  | { level: 'L0_descriptive'; risk: 'low';      policy: 'lenient' }
  | { level: 'L1_request';     risk: 'high';     policy: 'policy_engine_verdict' }
  | { level: 'L2_control';     risk: 'critical'; policy: 'dual_verification' }

interface EvolutionEvent {
  id: string
  timestamp: number
  trigger: StateInstruction              // 触发此事件的 S 层状态转移
  infoLevel: 'L0_signal' | 'L1_objective_law' | 'L2_subjective'
  commLevel: ECommLevel
  mutationType: 'create' | 'update' | 'delete' | 'transition'
  affectedNodes: string[]
  actor: PermissionTier                  // 操作者的权限层级
  executor: 'T0' | 'T1' | 'T2'          // 资源层级决定谁来执行
  diff: { before: unknown; after: unknown }
  levelTransition?: { from: PLevel; to: PLevel }  // 若触发信息层级升迁

  // L0 专属
  systemMaintenance?: { trigger: EL0Trigger; updateType: EL0UpdateType }
  // L1 专属
  learningModule?: EL1ActivityType
  evolutionOutput?: EL1LearningOutput
  // L2 专属
  subjectivity?: EL2SubjectivityEngine
  cognitive?: EL2CognitiveEngine
}
```

---

## 8. Emitter（Codegen）

```typescript
interface EmitterOutput {
  patches: KernelPatch[]         // StateInstructions → 内核状态变更
  effects: KernelEffect[]        // StateInstructions + EvolutionEvents → 副作用描述
  events: EvolutionEvent[]       // Token 处理的审计记录
}

// 规则
// 1. 任何 violation.severity = 'block' → 只输出 violation log，patches/effects 为空
// 2. 每条 StateInstruction → 状态转移 patch + 转移记录 patch
// 3. 每个处理的 token → EvolutionEvent（审计追踪）
// 4. EvolutionEvent 永远产生 log effect（年鉴）+ 级联触发 effect
// 5. 资源层级 = 权限级别 × 信息层级
```

---

## 9. Permission Tiers

```typescript
interface PermissionTierDef {
  tier: PermissionTier
  name: string
  scope: string
  subjects: string[]
}

const PERMISSION_TIERS: PermissionTierDef[] = [
  {
    tier: 'T0',
    name: '执行/实践',
    scope: '所有执行节点。读写 L0 数据，执行已验证指令',
    subjects: ['local_model:qwen3.5-0.8b', 'execution_node']
  },
  {
    tier: 'T1',
    name: '推理/控制',
    scope: 'AI 级处理。PRVSE 引擎：编译器、物理引擎、状态机',
    subjects: ['model:minimax-*', 'prvse_engine']
  },
  {
    tier: 'T2',
    name: '演化权限',
    scope: '人机协同演化。目标、宪法、资源',
    subjects: ['model:claude-*']
  },
  {
    tier: 'T3',
    name: '生变论（内部）',
    scope: '创造者权限。至高权限，不在外部三级中暴露',
    subjects: ['human:bornfly']
  },
]

// 核心规则：模型智能层级 ≠ 固定能力排名
// T0 模型经过训练可能掌握 L2 能力
// 权威随能力而来，不随标签而来
```

---

## 10. Appendix A：宪法规则汇总

| ID | 规则 | 权限 | 触发条件 |
|----|------|------|----------|
| const-001 | L0 atoms：任意执行节点可读写 | T0 | level = L0_atom |
| const-002 | L1 molecules 需要推理权限 | T1 | level = L1_molecule |
| const-003 | L2 genes 需要演化权限 | T2 | level = L2_gene |
| const-004 | 外部来源必须声明溯源链 | T0 | origin.domain = external |
| const-005 | external→candidate 需要 L0 验证 | T0 | state = external |
| const-006 | candidate→internal 需要实践验证 | T1 | state = candidate |
| const-007 | 禁止 external 直接变为 internal | BLOCK | state=external AND target=internal |
| const-008 | L0 信息不得含主观/叙事内容 | T0 | infoLevel=L0 AND comm=bottom_up from narrative |
| const-009 | 关系层级不得超过上下文信息层级 | T0 | R.infoLevel > context.infoLevel |

---

## 11. Appendix B：字段变更映射（Old → New）

| 旧字段 | 处置 | 新位置 |
|--------|------|--------|
| `source` (PSource) | **替换** | `origin` (POrigin) — 扩展为链式溯源 |
| `destination` (P1-P7) | **从 P 中移除** | 由 L1 路由决定（V+R 判断），不是 P 的属性 |
| `physical` | **扩展** | 5 类 → 9 类（新增 structured, video, stream, mixed） |
| `semantic` (PSemanticType) | **从 P 中移除** | 属于 R（关系决定语义分类） |
| `certainty` | **从 P 中移除** | 属于 V（价值判断） |
| `completeness` | **从 P 中移除** | 属于 V（价值判断） |
| `truth` | **从 P 中移除** | 属于 V（价值判断） |
| — | **新增** | `state`（三态：external/candidate/internal） |
| — | **新增** | `level`（三级形态：L0_atom/L1_molecule/L2_gene） |
| — | **新增** | `communication`（方向：bottom_up/top_down/lateral） |
| — | **新增** | `Narrowable<T>`（渐进定型，未解析字段触发权限降级） |
