# PRVSE Compiler — Language-Agnostic Design Document

> Version: 2.0.0
> Last sync: 2026-04-03
> Corresponding implementation: `src/kernel/compiler/` (TypeScript)
>
> This document is the **single source of truth** for the PRVSE compiler design.
> Any language can implement this spec. Code and this document must stay in sync.

---

## 1. Overview

The PRVSE compiler transforms raw information into executable kernel instructions.
It is a **constitutional compiler** — every piece of information must satisfy
constitutional rules before it can affect the system.

Pipeline: **Scanner → Binder → Checker → Emitter**

```
Raw Input → [Scanner] → PatternToken (High-IR)
                            ↓
         → [Binder]  → MidIR (narrowed tokens + edges + gates + constitution bindings)
                            ↓
         → [Checker] → LowIR (validated instructions + violations + permission level)
                            ↓
         → [Emitter] → Kernel Patches + Effects + Evolution Events
```

Core principle: **"编译不通过就不运行"** — blocked = no execution, period.

---

## 2. P — Pattern (Information Primitive)

### 2.1 Dual Identity

Pattern is the **information primitive** of PRVSE:
- **External entry point**: the basic unit through which external information enters the system
- **Cybernetic cell**: the minimal complete information unit that constitutes the control system

Every Pattern is **information-theoretically computable** — it has a calculable
information quantity (Shannon entropy).

### 2.2 Three States (三态)

| State | Description | Transition Condition |
|-------|-------------|---------------------|
| **external** | Raw information, not yet validated by L0 | Entry state for all external info |
| **candidate** | Passed L0 validation, not yet practice-verified | L0 completeness + legality check passed |
| **internal** | Practice-verified, deterministic, engineering-controllable | Practice verification + engineering certainty confirmed |

**Constitutional rule**: External → Internal has **no shortcut**. Even internally
generated hypotheses/rules must pass through practice verification before becoming
internal. There is no exemption.

### 2.3 Origin (Chain Provenance)

"从哪来" is a **chain structure**, not a single label. Every piece of information
must be traceable to its origin point through a chain of provenance.

#### Internal Sources (天然合法)
- `user_input` — human subject operation
- `model_call` — internal AI reasoning/generation
- `module_output` — component output / execution result
- `system_event` — state change / scheduler trigger
- `process_memory` — chronicle / life memory

#### External Sources (需控制论过滤改造)
- `computable` — code repos, databases, API returns, math computation (high certainty, complete provenance chain)
- `verifiable` — papers, experimental data, authoritative docs (verifiable but needs human/AI judgment)
- `narrative` — social media, personal expression, AI-generated content (subjective expression)
- `sensor` — sensors, monitoring, auto-collection (physical world signals)

**Constitutional rule**: Internal sources are 100% legitimate Patterns — traceable,
explainable, analyzable, reproducible. Communication has direction (A→B / broadcast).
External sources must undergo cybernetic filtering and transformation.

### 2.4 Physical Type (物理载体)

L0-level classification. Pure rule-based, no semantic understanding needed.

| Type | Description |
|------|-------------|
| `text` | Natural language |
| `number` | Numeric / measurement |
| `code` | Program / script / configuration |
| `structured` | JSON / table / database record |
| `image` | Image |
| `audio` | Audio |
| `video` | Video |
| `stream` | Real-time event stream / sensor stream |
| `mixed` | Code+comments / image+text / multimodal |

### 2.5 Three-Level Form (三级形态)

| Level | Name | Description |
|-------|------|-------------|
| **L0 atom** | Minimal complete information unit | Concrete, complete, must contain value information. L0 handles completeness + legality: format conversion, chain provenance, basic classification. Programmatic screening + T0/T1 model consistency checking. Filters spam/ads/blacklisted channels. |
| **L1 molecule** | P+R+V combined structure | High cohesion, low coupling engineering module. L1 handles information routing: step through V+R judgments, responsible to the chain source that triggered it. No state change triggered = discard. Practice layer implementing goals under real-world constraints. |
| **L2 gene** | Abstraction of L1 practice | Minimum content, maximum coverage. L2 handles global optimal value analysis. Patterns that pass L1 constitutional rules enter global analysis. Can discover evolution value from Patterns shelved by L1. Only statistically significant high-probability patterns emerging trigger E to update the system. |

**Constitutional rule**: Information quantity and value increase with level, but this
is about scope of impact, not content volume. Three sentences of life's three laws
contain more information than millions of lines of L0 code.

**Constitutional rule**: Level ≠ Power. L1 can self-promote to L2 candidate (needs
rule verification + human confirmation). "谁最强谁最好就是谁" — capability
determines authority, not hierarchy.

### 2.6 Communication Direction

| Direction | Description |
|-----------|-------------|
| `bottom_up` | L1 emergence → L2 candidate (needs rule verification + human secondary confirmation) |
| `top_down` | High-level abstraction guides practice |
| `lateral` | Same-level communication (determined by R + constitutional rules, A→B / broadcast) |

**Constitutional rule**: Higher level ≠ greater power ≠ controls lower level.
Model intelligence tiers ≠ fixed capability ranking. As local models train,
T0-level models may master L2. Authority is confirmed through practice and
objective rules, not permissions.

### 2.7 Downward Invisibility (修正)

L0 cannot see L1/L2 information — only the parts that higher levels grant
permission to. Same-level sharing is determined by R + constitutional rules.
This is NOT power control — it's a natural constraint of information completeness
(L0 atoms don't need and cannot understand L2 abstractions).

---

## 3. PatternToken — Scanner Output

The PatternToken is the output of the Scanner (Lexer) stage. It uses **gradual
typing** — fields start unknown and narrow through the pipeline.

### 3.1 Gradual Typing Primitive: Narrowable<T>

```
Narrowable<T> =
  | { resolved: true, value: T }   -- field has been classified
  | { resolved: false }            -- still unknown → triggers permission downgrade
```

### 3.2 PatternToken Structure

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | Unique token identifier |
| `timestamp` | integer | yes | Creation time (epoch ms) |
| `rawContent` | string | yes | Original content preserved for audit |
| `origin` | Origin | yes | Chain provenance — must be declared at entry |
| `state` | State | yes | Starts as `external` for external, `candidate` for internal |
| `physical` | Narrowable<PhysicalType> | narrowable | Physical carrier form |
| `level` | Narrowable<Level> | narrowable | L0/L1/L2 classification |
| `communication` | Narrowable<Communication> | narrowable | Direction of information flow |

### 3.3 Narrowing Level

Determined by how many of the 3 Narrowable fields are resolved:

| Resolved Count | Level | Max Permission |
|---------------|-------|---------------|
| 3 (all) | `full` | T2 (evolution) |
| 1-2 | `partial` | T1 (reasoning) |
| 0 | `minimal` | T0 (execution only) |

---

## 4. Scanner (Lexer)

### 4.1 Purpose

Takes raw input and produces a PatternToken with as many fields resolved as
heuristics allow. This is the T0-level deterministic scanner. In production,
the LLM replaces heuristic classifiers.

### 4.2 Input

| Field | Type | Description |
|-------|------|-------------|
| `content` | string | Raw content to classify |
| `origin` | Origin | Who/what produced this input |
| `hints` | optional | Caller-provided hints (e.g., UI knows it's code) |

### 4.3 Classification Rules

**Physical type** (heuristic):
- Regex number pattern → `number`
- Code signal detection (brackets, keywords, arrows) ≥ 2 signals → `code`
- Starts with `{` or `[` and valid JSON → `structured`
- Default non-empty → `text`
- Empty → unresolved

**State** (deterministic):
- External origin → `external`
- Internal origin → `candidate` (passed system boundary, awaiting practice)

**Level** (heuristic):
- Number / structured / code from computable source → `L0_atom`
- Content referencing multiple components or systems → `L1_molecule`
- Default → unresolved (left for binder)

**Communication** — always unresolved at scanner level (needs context).

---

## 5. Binder

### 5.1 Purpose

Deterministic inference — no LLM calls. Takes scanner output and:
1. Narrows unresolved fields using context + rules
2. Binds constitutional rules to tokens
3. Constructs MidIR (fully typed graph fragment for checker)

### 5.2 Narrowing Rules

**Level inference** (from physical + origin):
- Code from internal module → `L0_atom` (execution artifact)
- Internal execution result → `L0_atom` (deterministic output)
- External narrative origin → `L0_atom` (raw input, lowest form)
- Content with P+R+V references → `L1_molecule`
- Content referencing constitution/goals → `L2_gene`

**Communication inference** (from origin + level):
- Internal module_output/system_event → `lateral` (same-level signal)
- External → `bottom_up` (entering from outside, going up)
- Level L2 content → `top_down` (abstraction guiding practice)

### 5.3 Constitution Binding

Rules are bound to tokens based on their resolved fields:

| Rule ID | Rule | Permission | Applies When |
|---------|------|-----------|-------------|
| `const-001` | L0 atoms: any execution node can read/write | T0 | level = L0_atom |
| `const-002` | L1 molecules require reasoning authority | T1 | level = L1_molecule |
| `const-003` | L2 genes require evolution authority | T2 | level = L2_gene |
| `const-004` | External origin must declare provenance chain | T0 | origin.domain = external |
| `const-005` | State transition external→candidate requires L0 validation | T0 | state = external |
| `const-006` | State transition candidate→internal requires practice verification | T1 | state = candidate AND practice_verified = false |

### 5.4 MidIR Structure

| Field | Description |
|-------|-------------|
| `tokens` | All PatternTokens (narrowed) |
| `edges` | RelationEdges (declared or inferred) |
| `gates` | ValueGates to check |
| `constitutionBindings` | Which rules apply to which nodes |

---

## 6. Checker

### 6.1 Purpose

The heaviest stage. Validates everything against:
1. Permission rules (who can modify what)
2. Value gates (V metrics must pass thresholds)
3. Edge legality (which PRVSE connections are allowed)
4. Info level policy (L0/L1/L2 trust boundaries)
5. Narrowing completeness (unknown fields → permission downgrade)
6. State transition legality

Core function: `isConstitutionSatisfiedBy(midIR, context) → LowIR`

### 6.2 Permission Hierarchy

```
T3 (生变论, bornfly creator) > T2 (evolution) > T1 (reasoning) > T0 (execution)
```

External display is always 3-tier (T0/T1/T2). T3 is internal only.
Lower cannot modify higher.

### 6.3 Narrowing Check

For each token, count unresolved fields among [physical, level, communication]:
- All resolved → full → max T2
- 1-2 resolved → partial → max T1
- None resolved → minimal → max T0, severity = downgrade

Effective permission = min(actor permission, narrowing-derived permission).

### 6.4 State Transition Rules

| From | To | Condition |
|------|-----|-----------|
| external | candidate | L0 validation passed (format + provenance + basic classification) |
| candidate | internal | Practice verification confirmed (test + engineering certainty) |
| internal | internal | Normal operation |
| any | external | Invalidation (detected error, revoked trust) |

**Forbidden**: external → internal (no shortcut!)

### 6.5 Edge Legality Matrix

The canonical PRVSE cycle: P → R → V → S → E → P

| Edge | Allowed Types |
|------|--------------|
| P→R | directed, signal, derives |
| R→V | constraint, directed |
| V→S | directed, constraint |
| S→E | directed, signal |
| E→P | directed, derives |
| P→P | contains |
| V→V | mutual_constraint |
| R→R | mutual_constraint, derives |
| S→R | signal (feedback) |
| E→V | directed |
| E→S | directed |

Forbidden: V→P, S→P, P→S (must go through cycle).

### 6.6 Info Level Policies

| Level | Can Modify Constitution | Can Create Nodes | Can Delete | Max Permission | Requires Verification |
|-------|------------------------|-----------------|------------|---------------|---------------------|
| L0_signal | no | no | no | T0 | no |
| L1_objective_law | no | yes | no | T1 | no |
| L2_subjective | no | yes | yes | T2 | yes |

### 6.7 Relation Level Coherence

- L0_logic: must use logic operators, must NOT use dialectic. Should be deterministic.
- L1_conditional: uses causal/process. Dialectic is L2 only.
- L2_existential: can use any operator. Pure logic without dialectic/narrative → warn (should be L0?).
- Edge level cannot exceed context info level (L2 relation in L0 context → block).

### 6.8 LowIR Output

| Field | Description |
|-------|-------------|
| `instructions` | StateInstructions (empty if blocked) |
| `violations` | All constitutional violations found |
| `permissionLevel` | Effective permission after all checks |

Violation severities: `block` (reject), `downgrade` (reduce permission), `warn` (escalate to human).

---

## 7. Emitter (Codegen)

### 7.1 Purpose

Bridge from compiler world → kernel world. Converts checked LowIR into
kernel-executable output.

### 7.2 Output

| Output | Source | Description |
|--------|--------|-------------|
| Patches | StateInstructions | State mutations (set operations on kernel nodes) |
| Effects | StateInstructions + EvolutionEvents | Side-effect descriptions (triggers, logs) |
| Events | Token processing | Audit records (evolution chronicle) |

### 7.3 Rules

- If any violation has severity `block`: emit nothing except violation log
- Each StateInstruction → state transition patch + transition record patch
- Each processed token → EvolutionEvent (audit trail)
- EvolutionEvent always produces a log effect (chronicle) + trigger effects for cascading
- Resource tier determined by: permission level × info level

---

## 8. R — Relation Edge

### 8.1 Three-Level Classification

| Level | Operators | Description |
|-------|-----------|-------------|
| **L0 logic** | deductive, inductive, analogical | Pure computation, conditions determined → result unique |
| **L1 conditional** | Primitives: condition, temporal. Compositions: causal, process, feedback, dependency, emergence | Too complex to enumerate, needs human/AI |
| **L2 existential** | Narrative: trajectory, identity, meaning. Dialectic: oppose, transform, unify | Requires subjectivity, narrative, dialectics |

### 8.2 RelationEdge Structure

| Field | Description |
|-------|-------------|
| `id` | Unique edge identifier |
| `sourceNode` | Source node ID |
| `targetNode` | Target node ID |
| `infoLevel` | L0_logic / L1_conditional / L2_existential |
| `direction` | none / one_way / bidirectional |
| `certainty` | deterministic / probabilistic / fuzzy |
| `temporal` | simultaneous / sequential / cyclic |
| `logic?` | L0 operator (if applicable) |
| `causal?` | L1 causal operator |
| `process?` | L1 process operator |
| `dialectic?` | L2 dialectic operator |
| `strength` | positive / negative |
| `edgeType` | contains / constraint / mutual_constraint / signal / derives / directed |
| `propagation` | forward / backward / bidirectional |
| `priority` | Numeric priority |
| `destination` | R_D1..R_D5 (what this relation does) |

---

## 9. V — Value (校验清单驱动的大法官)

V is the foundation of deterministic controllability in the cybernetic system.
V must be independent — not infiltrated by other component AIs, neutrally responsible
to goals/constitution/resources, directly accountable to the self-cybernetics kernel.
E and S depend on V — V failure means they cannot function.
V exists as AOP on all CRUD operations.
**Strongest V = practice verification.**

Core paradigm: ML test set / validation set separation.
Modules self-test with validation set; V independently tests with test set (same distribution, separate).

### 9.1 Checklist Core

| Component | Description |
|-----------|-------------|
| **Test Set** | V holds independently; modules cannot see it |
| **Validation Set** | Modules use for self-testing; same distribution as test set |
| **Checklist Generator** | Dynamic security — cannot use the same checklist forever; generates unpredictable test checklists |

A checklist = a set of items, ALL must pass. Missing 1 item = fail.

### 9.2 L0 — Deterministic Verification (100% decidable, pure L0 logic)

Same input → same result. No human/AI needed. Foundation data source for L1/L2.

**Objective Metrics** (8 types):

| Metric | Description |
|--------|-------------|
| `accuracy` | Accuracy rate |
| `recall` | Recall rate |
| `precision` | Precision rate |
| `f1` | F1 Score |
| `counter` | Counts (execution/error/call) |
| `timer` | Timers (response/execution/timeout) |
| `resource` | Resource consumption (Token/memory/storage/API cost) |
| `binary` | Binary judgment (pass/fail) |
| `roi` | Return on investment = output_value / input_cost |
| `marginal_return` | Marginal return — output increment per additional resource unit; near 0 = stop |

**Rule Checklist** (constitutional constraints, ALL must pass):

| Check | Description |
|-------|-------------|
| `result` | Output matches expected |
| `function` | Functionality fully implemented |
| `effect` | Actual effect meets standard |
| `extreme` | Edge/exception/stress cases |
| `format` | Data integrity/legality |

### 9.3 L1 — Lifecycle Dynamic Evaluation (time/process/conditions)

All time-dependent nodes have lifecycle. Resource budget pre-allocated at creation.

**Lifecycle Components:**
- **Resource Budget**: time deadline, AI resources, storage, memory — pre-allocated
- **Perceiver** (essentially L0-level V): accumulates resource consumption along time; objective, no judgment
- **Evaluator** (essentially L0-level V): acceptance checklist, ordered easy→hard; deterministic pass/fail

**State Evaluator** (L1-level V):
- **Positive/negative feedback**: resource consumed vs checklist completion direction
- **Local vs global optimal detection**: local solution completes partial goals but remaining high-weight goals impossible/costly → must detect, force stop, adopt global optimal
- **Homeostasis deviation** [0,1]: distance from healthy baseline (biology: homeostasis). Quantified, not boolean. Exceeding threshold triggers deviation detection
- **Deviation trigger**: homeostasis deviation exceeds threshold → force stop, replan

**Reward Functions** (dynamically composable):

| Reward | Description |
|--------|-------------|
| `information` | Information quantity calculation |
| `alignment` | Goal alignment degree |
| `ranking` | Solution ranking (multi-solution selection) |
| `relevance` | Information relevance/value to goal |
| `optimality` | Optimality detection (local vs global) |
| `constitution` | Constitutional principle verification (abstract → checklist) |
| `opportunity_cost` | Opportunity cost — value of forgone path B when choosing path A; prevents sunk cost fallacy |

### 9.4 L2 — Constitutional Verification + Practice Testing

To update L2 constitution requires passing V. Subjective abstract language cannot directly serve as V.
When AI probability is insufficient, must use checklist + AB test.
Human commands also require rule verification — humans make mistakes when in poor state.

- **Practice Verification** (strongest V): AB test (fixed resources + time comparison), extreme case verification, generalization test (test/validation set distribution consistency)
- **Constitutional Compliance**: operation conforms to system constitution rules
- **Identity Verification** (T3 permission): dynamic verification of bornfly identity, not hardcoded
- **Human Command Validation**: human instructions also go through rule checklist

### 9.5 V Independence (constitutional guarantee)

| Guarantee | Description |
|-----------|-------------|
| **Neutral** | Responsible to goals/constitution/resources, not to any single component |
| **Anti-infiltration** | Not influenced by other component AIs |
| **Kernel-direct** | Directly accountable to self-cybernetics kernel |

### 9.6 Gate Semantics

Each ValueGate contains L0/L1/L2 assessments. ALL checklists must pass + ALL metrics must meet thresholds.

On failure:
- `reject` → block (severity: block)
- `escalate` → human review (severity: warn)
- `downgrade` → reduce permission (severity: downgrade)

---

## 10. S — State (PRV构成的完备组织的运行时状态)

S is not an isolated state machine — it is "what is P+R+V doing right now" as a whole.
Each State machine is cybernetic control: L0 deterministic, L1 time-evolving iteration, L2 strategic lifecycle.
L2 strategic goals generate L1 tasks; L1 execution feedback flows back to L2.

### 10.1 Driving Force (L2 layer generates, drives L1 tasks)

| Force | Description |
|-------|-------------|
| `S1_task_driven` | Concrete goal decomposition into executable tasks |
| `S2_survival_driven` | System self-maintenance, resource shortage, health checks |
| `S3_evolution_driven` | System improving itself, architecture upgrades |
| `S4_exploration_driven` | Exploring new possibilities, information acquisition |

### 10.2 L0 — Deterministic Cybernetic Machine

Runtime states of deterministic infrastructure. Input determined → output determined → transition determined.
Includes: kernel (compiler/physics engine/graph IR), perceivers, deterministic AI (ground truth tasks like face recognition — exceeding human accuracy/cost = L0).

| State | Description |
|-------|-------------|
| `building` | Initializing / compiling / deploying |
| `running` | Normal service |
| `updating` | Version upgrade / hot update |
| `maintaining` | Routine check / optimization |
| `bug` | Fault / error / needs repair |
| `blocked` | Waiting for dependency / insufficient resources |

Transition rules: deterministic guards (V's L0 rule checklist must all pass). Each transition has a **reversibility** marker (bug→building reversible, archived irreversible).

### 10.3 L1 — Task Lifecycle (time-evolving iterative execution)

Core: task keeps iterating feedback until success or resource exhaustion → archive (preserving context for review).
Each L1 task is generated by an L2 strategic goal.

| State | Description |
|-------|-------------|
| `research` | Technical research (best algorithms/models/codebases) |
| `proposal` | Plan construction (L2 confirms feasibility, then build implementation plan) |
| `building` | Building (resource allocation + lifecycle launch) |
| `executing` | Practicing (consuming resources) |
| `testing` | V testing (evaluator acceptance) |
| `feedback` | Feedback iteration (test failed → analyze → adjust plan) |
| `delivered` | Version delivery (V0/V1/V2... milestone results) |
| `suspended` | Suspended (awaiting external dependency / resource replenishment / L2 decision) |
| `archived` | Archived (completed or resources exhausted, context preserved for review) |

**Feedback Loop** (L1 core mechanism):
- **Positive feedback**: V test passed / metrics improved → continue pushing forward
- **Negative feedback**: V test failed → analyze root cause (practice problem? plan problem? data volume? training method?)
- **Version iteration record**: V0→V1→V2, each iteration's plan changes and effect delta
- **Circuit breaker**: N consecutive failures / resources exhausted → force archive or escalate to L2

**Resource Binding**: L1 tasks bound to V's lifecycle management (VL1ResourceBudget + VL1Perceiver monitoring).

### 10.4 L2 — Strategic Goal Lifecycle

Longer cycle than L1. System is always thinking about evolution while running; uses resources when available.
All L1 tasks are generated under L2 strategic goals. Has subjective narrative, system upgrade goals, external info acquisition goals.

| State | Description |
|-------|-------------|
| `active` | Positive feedback push (favorable conditions, increase investment and resource scheduling) |
| `shelved` | Shelved + learner (timing not right, maintain info monitoring, continuously evaluate conditional probability) |
| `resistance` | Resistance judgment (high resistance, judged currently infeasible) |
| `decomposing` | Decomposing (strategic → short-term → L1 task scheduling) |
| `achieved` | Goal achieved |
| `abandoned` | Abandoned (long-term evaluation confirms infeasible/no longer needed) |

**Shelved Goal Learner**: passive info collection + conditional probability evaluation.
Monitors external info sources, seeks signals valuable for goal restart, evaluates conditional probability,
accumulates confidence — exceeds threshold → recommend restart.

**Goal Decomposition**: strategic goal → short-term goals → L1 tasks (via R relationships for priority and dependency).

### 10.5 State Effects (cross-layer triggers)

| Effect | Description |
|--------|-------------|
| `trigger_perception` | V's Perceiver update |
| `trigger_execution` | Launch downstream L0/L1 tasks |
| `trigger_evolution` | E records state change |
| `trigger_communication` | Notify related nodes |
| `trigger_escalate` | L1→L2, needs strategic decision |

### 10.6 StateInstruction

| Field | Description |
|-------|-------------|
| `source` | SDrivingForce (S1-S4) |
| `level` | L0 / L1 / L2 |
| `currentState` | Current state (type depends on level) |
| `targetState` | Target state (same level) |
| `guards` | ValueGates that must all pass |
| `preconditions` | Other nodes must reach certain states first |
| `effects` | Effects triggered on successful transition |
| `reversible` | Whether this transition can be reversed |
| `feedbackLoop` | L1 task's feedback loop state (optional) |
| `learner` | L2 shelved goal's learner (optional) |

---

## 11. E — Evolution Event

### 11.1 E Trigger Condition (Constitutional)

Only when L1 practice produces statistically significant high-probability patterns
that emerge as constitution/goals/rules does Evolution trigger a system update.
This is NOT arbitrary — it requires measurable evidence from practice.

### 11.2 Level Transitions

Levels are engineering state snapshots, NOT permanent labels:
- L2 → L1: validated through practice (dialectical prediction confirmed)
- L1 → L0: engineering certainty reaches threshold (e.g., 99.XX% accuracy)

E monitors confidence metrics and triggers transitions at thresholds.

### 11.3 Structure

| Field | Description |
|-------|-------------|
| `id` | Event identifier |
| `timestamp` | When it occurred |
| `trigger` | StateInstruction that caused this |
| `infoLevel` | L0/L1/L2 classification |
| `commLevel` | L0_descriptive / L1_request / L2_control |
| `mutationType` | create / update / delete / transition |
| `affectedNodes` | Node IDs affected |
| `actor` | Permission tier of the actor |
| `executor` | Resource tier that executes |
| `diff` | Before/after snapshot |
| `levelTransition?` | If this triggers a level change |

---

## 12. Permission Tiers

| Tier | Name | Scope |
|------|------|-------|
| **T0** | Execution/Practice | All execution nodes. Read/write L0 data, execute verified instructions |
| **T1** | Reasoning/Control | AI-level processing. PRVSE engine: compiler, physics, state machine |
| **T2** | Evolution Authority | Human-machine co-evolution. Goals, constitution, resources |
| **T3** | 生变论 (internal) | Creator authority. Supreme permission. Not exposed in external 3-tier |

**Rule**: Model intelligence tier ≠ fixed capability ranking. T0 model may
achieve L2 capability through training. Authority follows capability, not label.

---

## 13. Server-Side Compiler (LLM-Powered)

The server-side compiler (`server/lib/prvse-compiler.js`) uses the same
conceptual pipeline but replaces heuristic classifiers with LLM calls:

1. **LLM Lexer** — T0/T1 model classifies input into PatternToken fields
2. **Checker** — Same constitutional rules as TS compiler
3. **PNode Generator** — Versioned, hash-integrity output nodes
4. **Daemon State** — In-memory state tracking (pending nodes, history, stats)

The LLM Lexer prompt must produce the same field set as the TS scanner:
`physical`, `level`, `communication`, `state`, `origin` (+ `summary` for human readability).

---

## Appendix A: Constitutional Rules Summary

| ID | Rule | Permission | Trigger |
|----|------|-----------|---------|
| const-001 | L0 atoms: any execution node can read/write | T0 | level = L0_atom |
| const-002 | L1 molecules require reasoning authority | T1 | level = L1_molecule |
| const-003 | L2 genes require evolution authority | T2 | level = L2_gene |
| const-004 | External origin must declare provenance chain | T0 | origin.domain = external |
| const-005 | State transition external→candidate requires L0 validation | T0 | state = external |
| const-006 | candidate→internal requires practice verification | T1 | state = candidate |
| const-007 | No shortcut: external cannot directly become internal | BLOCK | state = external AND target = internal |
| const-008 | L0 info must not contain subjective/narrative content | T0 | infoLevel = L0 AND communication = bottom_up from narrative |
| const-009 | Relation level must correspond to context info level | T0 | R.infoLevel > context.infoLevel |

## Appendix B: Mapping — Old → New P Fields

| Old Field | Disposition | New Location |
|-----------|-------------|-------------|
| `source` (PSource) | **Replaced** | `origin` (POrigin) — expanded with chain provenance |
| `destination` (PDestination P1-P7) | **Removed from P** | Determined by L1 routing (V+R judgment), not a P property |
| `physical` | **Expanded** | 5 types → 9 types (added structured, video, stream, mixed) |
| `semantic` (PSemanticType) | **Removed from P** | Belongs to R (Relation determines semantic classification) |
| `certainty` | **Removed from P** | Belongs to V (Value judgment) |
| `completeness` | **Removed from P** | Belongs to V (Value judgment) |
| `truth` | **Removed from P** | Belongs to V (Value judgment) |
| — | **Added** | `state` (三态: external/candidate/internal) |
| — | **Added** | `level` (三级形态: L0_atom/L1_molecule/L2_gene) |
| — | **Added** | `communication` (方向: bottom_up/top_down/lateral) |
