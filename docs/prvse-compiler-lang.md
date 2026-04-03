# PRVSE Compiler Language Specification

> Source of truth: `pages.db → tag_trees` (278 nodes) + `hm_protocol` (120 entries)
> Generated: 2026-04-02
> Purpose: 将 Tag Tree 语义树形式化为编译器可执行的类型系统

---

## 0. 总览

```
任意信息输入
    │
    ▼ Lexer: 切分为 Token（P 分类）
    ▼ Parser: 组装为 AST（R 连接 + 结构校验）
    ▼ Semantic Analysis: 宪法裁决（V gate + 权限检查）
    ▼ IR Generation: PRVSE Graph Node + Edge
    ▼ Codegen: S 状态转移指令 → E 演化事件
    │
    ▼ Kernel Runtime (Tick Loop)
```

五根（Root Primitives）:

| 根 | ID | 编译器角色 |
|----|-----|-----------|
| **P** Pattern | `tag-p` | Lexer — 信息的物理/语义/价值分类 |
| **R** Relation | `tag-r` | Parser — 节点间连接的合法性与性质 |
| **V** Value | `tag-v` | Semantic Analysis — 约束门/奖励函数 |
| **S** State | `tag-s` | Codegen Target — 状态转移指令 |
| **E** Evolution | `tag-e` | Runtime — 演化事件/系统进化 |

每根的三问结构（Source / Nature / Destination）= 编译器的输入/处理/输出。

---

## 1. P — Pattern（Lexer 层：信息分类）

> 编译器第一步：任何输入信息必须被分类为一个 Pattern Token

### 1.1 Source — 从哪来（输入源声明，必填）

```typescript
type P_Source =
  | P_External   // 外部来源——需给出明确信息源
  | P_Internal   // 内部来源——需给出组件连接
```

#### 1.1.1 外部来源

```typescript
type P_External =
  | 'user_input'       // P-S1 用户输入
  | 'env_perception'   // P-S2 环境感知
  | 'external_search'  // P-S3 外部检索
  | 'external_push'    // P-S4 外部推送
  | 'external_api'     // P-S5 外部信息接口
  | 'llm_api_call'     // 大模型API调用
```

#### 1.1.2 内部来源

```typescript
type P_Internal =
  | 'execution_result'   // P-S5 执行结果
  | 'component_output'   // P-S6 系统组件输出
  | 'process_memory'     // P-S8 过程记忆
```

### 1.2 Nature — 是什么（类型声明）

#### 1.2.1 A 物理结构（静态标签，数据载体形式）

```typescript
type P_PhysicalType =
  | 'text'     // 文本
  | 'number'   // 数值
  | 'image'    // 图像
  | 'audio'    // 音频
  | 'code'     // 代码
```

#### 1.2.2 B 语义结构（对功能性、实践的提前定性）

```typescript
type P_SemanticType =
  | 'fact'        // 事实
  | 'rule'        // 规则
  | 'process'     // 过程
  | 'relation'    // 关系
  | 'evaluation'  // 评估
  | 'narrative'   // 叙事
  | 'goal_task'   // 目标任务
```

#### 1.2.3 C 价值属性（V 层前置标记）

```typescript
// 确定性〔单选〕
type P_Certainty = 'certain' | 'uncertain'

// 完备性〔单选〕
type P_Completeness = 'complete' | 'incomplete'

// 真值〔单选〕
type P_Truth = 'true' | 'false'
```

#### 1.2.4 实践属性——S（运行时动态标签）

```typescript
type P_PracticeAttr = {
  requirement: string          // 需求
  global_flow: string          // 全局流程图
  test_checklist: string[]     // 测试清单
  evaluation_system: string    // 评价体系
  conflict: string             // 冲突矛盾
  process_record: string       // 过程记录
}
```

### 1.3 Destination — 去哪里（输出路由，必填）

> 认识论性质：推动 PRVSE 的改造和实践

```typescript
type P_Destination =
  | 'P1_instruction'     // 指令信息 Instruction
  | 'P2_retrieval'       // 获取信息 Retrieval
  | 'P3_execution'       // 执行信息 Execution
  | 'P4_interaction'     // 交互反馈 Interaction
  | 'P5_introspection'   // 内省信息 Introspection
  | 'P6_reasoning'       // 推理信息 Reasoning
  | 'P7_memory'          // 记忆信息 Memory
```

### 1.4 Pattern Token 完整类型

```typescript
interface PatternToken {
  // === 必填 ===
  source: P_Source                    // 从哪来
  physical_type: P_PhysicalType       // A 物理结构
  semantic_type: P_SemanticType       // B 语义结构
  destination: P_Destination          // 去哪里

  // === 价值前置标记 ===
  certainty: P_Certainty              // 确定/不确定
  completeness: P_Completeness        // 完整/残缺
  truth: P_Truth                      // 真/假

  // === 元数据 ===
  timestamp: number
  raw_content: string                 // 原始输入内容
}
```

---

## 2. R — Relation（Parser 层：连接合法性）

> 编译器第二步：Pattern Token 之间通过 Relation 组装为 AST

### 2.1 Source — 关系从哪来（因果来源）

```typescript
type R_Source =
  | R_SystemInternal   // 系统元组件内在逻辑
  | R_Communication    // 通信（信息流向）
  | R_TimeFlow         // 时间流向

type R_SystemInternal =
  | 'pattern'      // 来自 Pattern
  | 'state'        // 来自 State
  | 'evolution'    // 来自 Evolution
  | 'value'        // 来自 Value

type R_Communication =
  | 'human'        // 人
  | 'ai'           // AI
  | 'env'          // 环境信息
  | 'system'       // 系统内部通信机制

type R_TimeFlow =
  | 'irreversible_flow'    // 不可逆单向时间流
  | 'data_timeline'        // 系统数据时间线
```

### 2.2 Nature — 关系是什么（边的属性系统）

#### A 基本属性（物理特征）

```typescript
// A1 方向性〔单选〕
type R_Direction = 'none' | 'one_way' | 'bidirectional'

// A2 确定性〔单选〕
type R_Certainty = 'deterministic' | 'probabilistic' | 'fuzzy'

// A3 时间性〔单选〕
type R_Temporal = 'simultaneous' | 'sequential' | 'cyclic'
```

#### B 关系性质（语义分类）

```typescript
// B1 逻辑关系
type R_Logic = 'deductive' | 'inductive' | 'analogical'

// B2 因果关系
type R_Causal = 'direct' | 'indirect' | 'counterfactual'

// B3 过程关系
type R_Process = 'conditional_transform' | 'quantitative_accumulation' | 'qualitative_emergence'

// B4 辩证关系（三要素）
type R_Dialectic = 'oppose' | 'transform' | 'unify'
  // oppose: 根本对立
  // transform: 转化条件
  // unify: 高层统一

// B5 关系强度〔单选〕
type R_Strength = 'positive' | 'negative'
```

### 2.3 Destination — 关系去哪里（边的功能）

```typescript
type R_Destination =
  | 'R_D1_drive_reasoning'       // 驱动推理
  | 'R_D2_support_value_calc'    // 支撑价值计算
  | 'R_D3_record_evolution'      // 记录演化依据
  | 'R_D4_execute_constraint'    // 执行约束检查
  | 'R_D5_activate_related'      // 激活关联节点
```

### 2.4 Relation Edge 完整类型

```typescript
interface RelationEdge {
  // === 端点 ===
  source_node: NodeRef         // 起点（P|R|V|S|E）
  target_node: NodeRef         // 终点（P|R|V|S|E）

  // === 来源声明 ===
  origin: R_Source

  // === 基本属性 A ===
  direction: R_Direction       // A1
  certainty: R_Certainty       // A2
  temporal: R_Temporal         // A3

  // === 关系性质 B（至少选一类）===
  logic?: R_Logic              // B1
  causal?: R_Causal            // B2
  process?: R_Process          // B3
  dialectic?: R_Dialectic      // B4
  strength: R_Strength         // B5

  // === 功能目标 ===
  destination: R_Destination

  // === 编译器需要的（Tag Tree 缺失，需补充）===
  // propagation: 'forward' | 'backward' | 'bidirectional'
  // priority: number
  // edge_type: 'contains' | 'constraint' | 'mutual_constraint'
  //          | 'signal' | 'derives' | 'directed'
}
```

---

## 3. V — Value / Reward（Semantic Analysis 层：约束门）

> 编译器第三步：任何操作通过 V gate 才允许执行

### 3.1 Source — 价值条件从哪来

```typescript
type V_Source =
  | 'computer_system'    // 计算机系统（客观可计算）
  | 'ai_model'           // AI 模型（概率性输出）
  | 'human_narrative'    // 人 → 主体叙事（V-H1）
  | 'external_narrative' // 人 → 外部叙事（V-H2）
```

### 3.2 Nature — 价值维度

```typescript
// 时间性〔单选〕
type V_Temporal = 'static' | 'dynamic'

// 优化范围〔单选〕
type V_Scope = 'local' | 'global'

// 确定性〔单选〕
type V_Certainty = 'deterministic' | 'uncertain'

// 可控性〔单选〕
type V_Control = 'controllable' | 'uncontrollable'

// 基线关系〔单选〕
type V_Baseline = 'maintain' | 'challenge'
```

### 3.3 Destination — 价值对谁负责

```typescript
type V_Destination =
  | 'V_D1_align_human_preference'   // 对齐人的价值偏好
  | 'V_D2_task_completion'          // 对完成任务负责
  | 'V_D3_system_evolution'         // 对系统进化负责
```

### 3.4 V Metric Types（来自 hm_protocol）

```typescript
// V1 客观指标 — 确定性度量
type V1_Metric =
  | { type: 'counter';           data: uint;   aggregation: 'sum' | 'max' | 'last' }
  | { type: 'timer';             data: float;  unit: 's' }
  | { type: 'token_consumption'; data: { input: number; output: number }; scale: 'K' | 'M' | 'B' }
  | { type: 'probability';       data: float;  range: [0, 1]; precision: 2 }
  | { type: 'binary';            data: 0 | 1 }

// V2 外部概率 — AI/外部评估
type V2_Metric =
  | 'confidence'
  | 'relevance_prob'
  | 'causal_prob'
  | 'prediction_prob'
  | 'narrative_legitimacy'
  | 'narrative_completeness'
  | 'narrative_logic'
// 全部: output ∈ [0, 1], precision = 2

// V3 内部评价 — 主观/宪法评估
type V3_Metric =
  | 'constitutional_rule'       // template=true, instantiable
  | 'value_alignment'
  | 'cognitive_eval'
  | 'narrative_consistency'
  | 'prediction_prob_internal'
// 全部: output ∈ [0, 1], precision = 2

// φ 因子 — 独立定义，运行时组合
type Phi =
  | { id: 'φ_causal';       r_edges: ['derives', 'signal'];            formula: 'P(B|do(A)) · C(E)' }
  | { id: 'φ_temporal';     r_edges: ['directed'];                     formula: 'P(B|A) · I(t_A < t_B)' }
  | { id: 'φ_contradiction'; r_edges: ['mutual_constraint'];           formula: '1 - |P(A)-P(B)| · tension(E)' }
  | { id: 'φ_dependency';   r_edges: ['constraint', 'contains'];       formula: 'P(B|A) · I(A→B, graph)' }

// 运行时: P(G) = ∏ φ(Node, Edge, Constraint)  — factor graph
```

### 3.5 Value Gate 完整类型

```typescript
interface ValueGate {
  source: V_Source
  temporal: V_Temporal
  scope: V_Scope
  certainty: V_Certainty
  control: V_Control
  baseline: V_Baseline
  destination: V_Destination

  // 具体度量（至少一个）
  v1?: V1_Metric       // 客观
  v2?: V2_Metric[]     // 外部概率
  v3?: V3_Metric[]     // 内部评价
  phi?: Phi[]          // φ 因子

  // 门控阈值
  threshold: number    // 通过条件
  on_fail: 'reject' | 'escalate' | 'evolve'
}
```

---

## 4. S — State（Codegen Target：状态转移指令）

> 编译器第四步：通过 V gate 后产出状态转移指令

### 4.1 Source — 状态变化的驱动力

```typescript
type S_Source =
  | 'S1_task_driven'        // 完成任务驱动
  | 'S2_survival_driven'    // 生存驱动
  | 'S3_evolution_driven'   // 系统进化驱动
  | 'S4_exploration_driven' // 探索驱动
```

### 4.2 Nature — 状态属性

#### A 节点分级〔单选〕

```typescript
type S_NodeTier =
  | 'execution'    // 执行节点
  | 'research'     // 认知节点
  | 'update'       // 更新节点
```

#### B 节点状态机〔单选〕— 生命周期

```typescript
type S_StateMachine =
  | 'building'          // 构建中
  | 'trial'             // 试运行
  | 'stable'            // 稳定运行
  | 'bug_suspended'     // Bug 挂起
  | 'waiting'           // 等待指令挂起
  | 'positive_loop'     // 正反馈迭代
  | 'negative_loop'     // 负反馈预警
  | 'archived'          // 归档
```

#### XState 兼容定义（来自 hm_protocol）

```typescript
// 三维并行状态机
type S_Machines = {
  lifecycle: 'building' | 'running' | 'waiting' | 'suspended' | 'archived'
  feedback:  'positive_loop' | 'negative_loop'
  execution: 'retrying' | 'success' | 'failure'
}

// 状态转移 = V gate 守卫
interface StateTransition {
  from: string
  to: string
  trigger: string               // 事件名
  guard: ValueGate[]            // 必须全部通过
}
```

### 4.3 Destination — 状态变化的影响

```typescript
// C 更新权属〔单选〕
type S_Owner = 'auto' | 'passive'
  // auto: 自主状态更新
  // passive: 被动状态更新

// D 更新影响
type S_Effect =
  | 'S_D_E1_trigger_perception'   // 触发上层感知
  | 'S_D_E2_trigger_execution'    // 触发执行计划
  | 'S_D_E3_trigger_evolution'    // 触发进化记录
  | 'S_D_E4_trigger_communication' // 触发通信
```

### 4.4 State Instruction 完整类型

```typescript
interface StateInstruction {
  source: S_Source
  node_tier: S_NodeTier
  current_state: S_StateMachine
  owner: S_Owner

  transition: StateTransition     // 要执行的转移
  effects: S_Effect[]             // 转移成功后触发
}
```

---

## 5. E — Evolution（Runtime：演化事件）

> 编译器最终产物：状态转移执行后的系统变化记录

### 5.1 E 的子树结构（来自 Tag Tree）

```
E — Evolution
├── 信息分级
│   ├── L0 信号层
│   │   ├── 特征：不以人的意志为转移，客观事实
│   │   ├── 实践：直接处理，无需上升到高层次
│   │   │   ├── 一 无需思考和分析，直接走规则路由逻辑
│   │   │   ├── 二 通信、信息压缩表示、信息处理，以提高效率为第一目的
│   │   │   └── 三 用更少的代价处理更高的信息量
│   │   └── 边界：必须是客观世界的计算机化
│   ├── L1 客观规律层
│   │   ├── 特征：理论上遵循客观规律，实践上可复现可验证
│   │   ├── 实践：有限的，存在环境条件制约
│   │   │   ├── 有限性——适用范围
│   │   │   │   └── 明确系统的理论上限和下限
│   │   │   └── 约束条件
│   │   │       └── 需要建模，转化为客观规律的可计算模式
│   │   └── 边界：科学已实验论证，理工科广泛实践验证过
│   └── L2 主观认知层
│       ├── 特征：人类大脑产物，主观、情绪化、叙事
│       ├── 实践：无限的，AI幻觉来源，爽文意淫，消费主义
│       │   ├── 叙事包装的半虚构
│       │   │   ├── 一 任何叙事都是半虚构，警惕外部叙事控制
│       │   │   └── 二 唯一价值是了解客观环境信息和外部主流认知
│       │   └── 虚构
│       │       ├── 一 必须警惕爽文化标签，毒害系统，产生幻觉
│       │       ├── 二 好的作品，只可学习想象力和抽象认知
│       │       └── 三 唯一价值是转化为更好的自我叙事
│       └── 边界：必须经科学实验验证和人类社会中广泛论证
│
├── 人机交互协议
│   ├── 资源权限通信层
│   │   └── 通信机制
│   │       ├── 信号通信
│   │       │   ├── 感知器信号传递
│   │       │   └── 系统规则路由触发
│   │       ├── 自底向上—请求型通信
│   │       │   └── diff处理
│   │       │       ├── 全局最优VS局部最优
│   │       │       └── 客观VS主观
│   │       └── 自顶向下—控制型通信
│   │           ├── 任务执行
│   │           └── 系统结构改造
│   ├── 分级约束控制层-控制论单元
│   │   └── PRVSE规则流图
│   ├── 实践层
│   │   └── 自我控制论系统组件
│   │       ├── 构造器
│   │       ├── 控制器
│   │       ├── 感知器
│   │       │   ├── 计时器
│   │       │   ├── 状态监控器
│   │       │   └── 资源计算器
│   │       ├── 测评器
│   │       │   └── reward
│   │       ├── 执行节点
│   │       │   ├── 角色（前端/后端/产品/运维/内容创造/主体性）
│   │       │   ├── 技术栈（React/TypeScript/Node.js/Python/SQLite）
│   │       │   ├── 状态（待办/进行中/已完成/阻塞）
│   │       │   ├── 优先级（高/中/低）
│   │       │   └── 执行节点操作单元
│   │       │       ├── P1 指令信息（→ 认知类）
│   │       │       ├── P2 获取信息
│   │       │       ├── P3 执行信息
│   │       │       ├── P4 交互反馈
│   │       │       ├── P5 内省信息
│   │       │       ├── P6 推理信息
│   │       │       └── P7 记忆信息
│   │       ├── 通信器
│   │       └── 过程记录器
│   ├── 智能资源分级
│   │   ├── T2级智能：最强AI—全局优化、构建
│   │   │   └── claude code + opus4.6
│   │   ├── T1级智能：执行节点模型—局部最优
│   │   │   └── claude code + sonnet4.6 > minimax2.7
│   │   └── T0级智能：本地小模型，感知AI
│   │       └── Qwen3.5-0.8B（可RL训练，感知器/编译器/L0+部分L1控制器）
│   ├── UI 组件库
│   └── 系统角色
```

### 5.2 信息分级（编译器的信息可信度判定）

```typescript
// 任何信息进入编译器，首先判定信息层级
type InfoLevel =
  | 'L0_signal'        // 不以人的意志为转移，客观事实
  | 'L1_objective_law' // 遵循客观规律，可复现可验证
  | 'L2_subjective'    // 人类大脑产物，主观，需验证

// 编译器行为随层级不同
interface InfoLevelPolicy {
  L0_signal: {
    action: 'direct_route'   // 直接走规则路由，不需思考
    trust: 'full'
    processing: 'compress_and_transmit'
  }
  L1_objective_law: {
    action: 'model_and_compute'  // 需要建模，转化为可计算模式
    trust: 'verified'            // 科学实验论证过的理论边界内
    boundary: 'finite'           // 有限的，存在环境条件制约
    goal: 'approach_theoretical_upper_bound'
  }
  L2_subjective: {
    action: 'verify_before_use'  // 必须经验证才具备可信度
    trust: 'skeptical'           // 避免情绪化、虚构化、爽文化
    boundary: 'infinite_but_dangerous'  // AI幻觉来源
    guards: [
      'reject_entertainment_as_fact',      // 警惕爽文化标签
      'external_narrative_for_context_only', // 外部叙事仅供了解
      'convert_to_self_narrative_if_valuable' // 好的转化为自我叙事
    ]
  }
}
```

### 5.3 通信机制（编译器的 I/O 协议）

```typescript
// 来自 hm_protocol: comm-l0, comm-l1, comm-l2
type CommunicationLevel =
  | { level: 'L0_descriptive';  risk: 'low';      policy: 'lenient' }
  | { level: 'L1_request';      risk: 'high';     policy: 'policy_engine_verdict' }
  | { level: 'L2_control';      risk: 'critical'; policy: 'dual_verification' }

// 信号通信 — 底层
interface SignalComm {
  perceiver_signal: 'passive_sense'    // 感知器信号传递
  rule_route: 'trigger_on_match'       // 系统规则路由触发
}

// 请求型通信 — 自底向上
interface RequestComm {
  diff_handling: {
    global_vs_local: 'optimize'        // 全局最优VS局部最优
    objective_vs_subjective: 'arbitrate' // 客观VS主观
  }
  verdict: 'allow' | 'deny' | 'modify_and_retry'
}

// 控制型通信 — 自顶向下
interface ControlComm {
  task_execution: 'dispatch'           // 任务执行
  structure_change: 'requires_t2_review' // 系统结构改造
}
```

### 5.4 智能资源分级（编译器的执行资源路由）

```typescript
// 来自 hm_protocol: tier-t0, tier-t1, tier-t2
interface ResourceTier {
  T0: {
    model: 'Qwen3.5-0.8B'
    type: 'local'
    capability: 'perception | signal_sense | fast_response'
    rl_trainable: true
    escalate_if: 'confidence < 0.6'
    escalate_to: 'T1'
  }
  T1: {
    model: 'MiniMax-M2.7'
    type: 'api'
    capability: 'task_execution | skills_extend | local_optimization'
    escalate_if: 'complexity > 0.8 || requires_expert'
    escalate_to: 'T2'
    fallback_to: 'T0'
  }
  T2: {
    model: 'claude-opus-4-6 | claude-sonnet-4-6'
    type: 'api'
    capability: 'global_optimization | construction | complex_reasoning'
    escalate_if: null  // 顶层，无法升级
    fallback_to: 'T1'
    budget: '50 calls/day'
  }
}
```

### 5.5 权限层级（编译器的权限裁决）

```typescript
// 来自 hm_protocol: perm-t0 ~ perm-t3
interface PermissionLayer {
  T3_creator: {
    subject: 'human:bornfly'
    can: ['constitutional_crud', 'system_admin', 'agent_control', 'data_export']
    cannot: []  // 无限制
  }
  T2_claude: {
    subject: 'model:claude-*'
    can: ['project_crud', 'plan_generation', 'complex_reasoning']
    cannot: ['constitutional_modify', 'system_admin']
  }
  T1_minimax: {
    subject: 'model:minimax-*'
    can: ['task_execution', 'skills_extend']
    cannot: ['plan_generation', 'constitutional_read']
  }
  T0_qwen: {
    subject: 'local_model:qwen3.5-0.8b'
    can: ['perception', 'signal_sense', 'fast_response', 'rl_trainable']
    cannot: ['complex_reasoning']
    escalate: 'to T1 for R and E operations'
  }
}

// 核心裁决规则
// 低层不可见高层信息: if viewer.permission < layer.level → hidden
// 低层不可修改高层节点: if mutator.permission < target.permission → REJECT
```

### 5.6 Evolution Event 完整类型

```typescript
interface EvolutionEvent {
  // === 触发 ===
  trigger: StateInstruction       // 来自 S 层的状态转移
  info_level: InfoLevel           // L0/L1/L2 信息分级
  comm_level: CommunicationLevel  // 通信等级

  // === 变更 ===
  mutation_type: 'create' | 'update' | 'delete' | 'transition'
  affected_nodes: NodeRef[]       // 波及的 PRVSE 节点
  diff: {
    before: any
    after: any
    conflict?: 'global_vs_local' | 'objective_vs_subjective'
  }

  // === 裁决 ===
  permission_check: {
    actor: PermissionLayer
    target_level: number
    verdict: 'allow' | 'deny' | 'escalate'
  }

  // === 资源 ===
  executor: ResourceTier          // T0/T1/T2 谁来执行
  
  // === 记录 ===
  timestamp: number
  chronicle_entry_id?: string     // 写入 Chronicle
}
```

---

## 6. 系统组件（Kernel Components）

> 来自 hm_protocol: kernel-comp + Tag Tree 实践层

```typescript
// 来自 hm_protocol: kc-perception, kc-evaluator, kc-recorder, kc-controller
interface KernelComponents {
  perception_v1: {
    role: '感知器'
    inputs: ['env_signal', 'task_event', 'execution_error']
    outputs: ['perception_result', 'bottom_up_trigger', 'state_snapshot']
    trigger: 'continuous | event'
    sub_components: ['timer', 'status_monitor', 'resource_calculator']
  }
  evaluator_v2: {
    role: '测评器'
    inputs: ['execution_result', 'expected_target', 'eval_criteria']
    outputs: ['eval_form', 'feedback_signal', 'achievement_score']
    trigger: 'post_execution'
    sub_components: ['reward']
  }
  recorder_e: {
    role: '记录器'
    inputs: ['system_event', 'resource_consumption', 'state_transition']
    outputs: ['structured_log', 'cost_report', 'audit_trail']
    trigger: 'always_on'
  }
  controller: {
    role: '控制器'
    inputs: ['perception_signal', 'eval_result', 'human_t2_command']
    outputs: ['state_transition', 'graph_dispatch', 'resource_schedule']
    trigger: 'state_event | external'
  }
  constructor: {
    role: '构造器'
    inputs: ['plan', 'blueprint']
    outputs: ['new_nodes', 'new_edges', 'structure_change']
    trigger: 'on_demand'
  }
  communicator: {
    role: '通信器'
    inputs: ['any_message']
    outputs: ['routed_message']
    trigger: 'on_message'
  }
}
```

---

## 7. 图执行节点（Graph Nodes）

> 来自 hm_protocol: graph-node

```typescript
// 执行图中的节点类型
type GraphNode =
  | { type: 'sense';   executor: 'local_ai';   component: 'perception_v1' }
  | { type: 'plan';    executor: 'global_ai';  component: 'controller' }
  | { type: 'execute'; executor: 'local_ai';   component: 'controller' }
  | { type: 'test';    executor: 'local_ai';   component: 'evaluator_v2' }
  | { type: 'archive'; executor: 'controller'; component: 'recorder_e' }

// 执行流: sense → plan → execute → test → archive
//                                    ↓ fail
//                              negative_loop → replan
```

---

## 8. 编译器缺失项（Tag Tree + hm_protocol 尚未定义）

### 8.1 P 层缺失

| 缺失 | 说明 | 影响 |
|------|------|------|
| Pattern 必填字段校验 | source + physical_type + semantic_type 哪些组合合法？ | Lexer 无法拒绝非法 Token |
| 物理↔语义 兼容矩阵 | `audio` + `rule` 合法吗？`code` + `narrative` 合法吗？ | Parser 无法做类型检查 |

### 8.2 R 层缺失

| 缺失 | 说明 | 影响 |
|------|------|------|
| EdgeRules 合法连接矩阵 | P→V 直连？V→V？S→P？ | Parser 无法校验 AST |
| 传播语义 propagation | constraint 边 forward 还是 backward？ | Tick 传播引擎无法运行 |
| 边优先级/冲突解决 | 两条冲突边谁赢？ | 裁决层无法工作 |

### 8.3 E 层缺失

| 缺失 | 说明 | 影响 |
|------|------|------|
| Evolution Schema | mutation_type 的输入/输出/前置条件 | Codegen 无目标格式 |
| Evolution 触发条件 | 什么事件产生 Evolution？ | Runtime 不知何时触发 |

### 8.4 跨层缺失

| 缺失 | 说明 | 影响 |
|------|------|------|
| Graph Invariants | 全局不变量（无环、连通性、覆盖率） | 编译后的图可能不一致 |
| S.guard → V 具体绑定 | `rewardMet` = 哪个 V 指标 ≥ 什么值？ | 状态机转移条件是空的 |
| 信息分级 × 权限分级 交叉规则 | L2 信息能否被 T0 处理？ | 资源路由可能越权 |
