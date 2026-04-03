/**
 * server/lib/prvse-compiler.js
 *
 * PRVSE Human-AI Compiler — MVP
 *
 * The sole entry point for all information flowing into the system.
 * Nothing executes without passing through this compiler.
 *
 * Four components:
 *   1. LLM Lexer    — MiniMax T1 classifies any input into PatternToken
 *   2. Checker      — Rule-based constitutional validation
 *   3. PNode Gen    — Versioned, constitution-referenced output nodes
 *   4. Daemon State — Persistent in-memory state (pending nodes, history)
 *
 * Design: "编译不通过就不运行" — blocked = no execution, period.
 */

const { getClientForTier, DEFAULT_MAX_TOKENS } = require('./llm')
const crypto = require('crypto')

// ── LLM Lexer System Prompt ─────────────────────────────────

const LEXER_SYSTEM_PROMPT = `You are the PRVSE Lexer — the first stage of a constitutional compiler.
Your job: classify ANY input into a structured PatternToken.

Return ONLY valid JSON, no explanation, no markdown:
{
  "physical": "text" | "number" | "code" | "image" | "audio",
  "semantic": "fact" | "rule" | "process" | "relation" | "evaluation" | "narrative" | "goal_task",
  "destination": "P1_instruction" | "P2_retrieval" | "P3_execution" | "P4_interaction" | "P5_introspection" | "P6_reasoning" | "P7_memory",
  "certainty": "certain" | "uncertain",
  "completeness": "complete" | "incomplete",
  "truth": null,
  "infoLevel": "L0_signal" | "L1_objective_law" | "L2_subjective",
  "relationLevel": "L0_logic" | "L1_conditional" | "L2_existential" | null,
  "summary": "one-line summary of what this input means in system context"
}

Classification rules:
- physical: what IS the data? text/number/code/image/audio
- semantic: what DOES it mean?
  - fact: objective, verifiable statement
  - rule: constraint, policy, or regulation
  - process: action, workflow, procedure
  - relation: describes connection between things
  - evaluation: judgment, assessment, metric
  - narrative: subjective story, opinion, experience
  - goal_task: desired outcome, task to accomplish
- destination: where should it GO?
  - P1_instruction: becomes a directive for agents
  - P2_retrieval: stored/retrieved as knowledge
  - P3_execution: triggers code/action execution
  - P4_interaction: requires human dialogue
  - P5_introspection: self-reflection, meta-analysis
  - P6_reasoning: needs logical analysis
  - P7_memory: archived for future reference
- certainty: is the speaker certain or uncertain?
- completeness: is the input self-contained or needs more context?
- truth: ALWAYS null — truth requires external verification, lexer cannot judge

Info Level (P layer — information credibility):
- L0_signal: objective, deterministic, no interpretation needed (sensor data, math result)
- L1_objective_law: verified by science/experiment, reproducible (physics laws, statistical results)
- L2_subjective: requires human judgment, narrative, or AI inference (opinions, strategies, plans)

Relation Level (R layer — if semantic is "relation", classify the relation type):
- L0_logic: pure logical relation, computable without human/AI (1+1=2, boolean logic, gravity law)
  Boundary: if ANY cognitive ambiguity or interpretation exists → L1
- L1_conditional: conditional/temporal/causal, too complex to fully enumerate, needs human/AI
  (causality, evolution, environmental dependencies, probabilistic conditions)
- L2_existential: requires narrative for legitimacy, involves subjectivity/dialectics
  (oppose/unify, finite/infinite, meaning, lived experience, value judgment)
- null: if semantic is NOT "relation"

The info level and relation level MUST correspond: L0↔L0, L1↔L1, L2↔L2.
Be precise. When in doubt between two levels, choose the HIGHER level (safer).`

// ── LLM Lexer ────────────────────────────────────────────────

/**
 * Call MiniMax to classify input into PatternToken fields.
 * Returns resolved fields (LLM does the semantic heavy lifting).
 */
async function llmLex(content, opts = {}) {
  const tier = opts.tier || 'T1'
  const { client, model } = getClientForTier(tier)

  const startTime = Date.now()

  const msg = await client.messages.create({
    model,
    max_tokens: 512,
    messages: [
      { role: 'user', content: `[System]\n${LEXER_SYSTEM_PROMPT}\n\n[Input to classify]\n${content}` },
    ],
  })

  const raw = msg.content.find(c => c.type === 'text')?.text || '{}'
  const elapsed = Date.now() - startTime

  // Parse LLM response — extract JSON from possible markdown wrapping
  let parsed
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw)
  } catch {
    // LLM returned unparseable output — fallback to minimal classification
    parsed = {
      physical: 'text',
      semantic: 'narrative',
      destination: 'P4_interaction',
      certainty: 'uncertain',
      completeness: 'incomplete',
      truth: null,
      infoLevel: 'L2_subjective',
      relationLevel: null,
      summary: 'LLM classification failed — fallback to narrative/uncertain',
    }
  }

  return {
    physical: parsed.physical || 'text',
    semantic: parsed.semantic || 'narrative',
    destination: parsed.destination || 'P4_interaction',
    certainty: parsed.certainty || 'uncertain',
    completeness: parsed.completeness || 'incomplete',
    truth: parsed.truth ?? null,
    infoLevel: parsed.infoLevel || 'L2_subjective',
    relationLevel: parsed.relationLevel || null,
    summary: parsed.summary || '',
    _meta: {
      tier,
      model,
      elapsed,
      inputTokens: msg.usage?.input_tokens || 0,
      outputTokens: msg.usage?.output_tokens || 0,
    },
  }
}

// ── Constitution Rules (checker) ─────────────────────────────

/**
 * Built-in constitutional rules.
 * Each rule: id, text, permissionRequired, appliesTo(token) → boolean
 */
const CONSTITUTION_RULES = [
  {
    id: 'const-001',
    text: 'L0 signal (fact) nodes: T0+ can read, T1+ can modify',
    permissionRequired: 'T0',
    appliesTo: (token) => token.semantic === 'fact',
  },
  {
    id: 'const-002',
    text: 'Rule-type patterns require T1+ permission to create',
    permissionRequired: 'T1',
    appliesTo: (token) => token.semantic === 'rule',
  },
  {
    id: 'const-003',
    text: 'Goal/task patterns require T2+ permission',
    permissionRequired: 'T2',
    appliesTo: (token) => token.semantic === 'goal_task',
  },
  {
    id: 'const-004',
    text: 'Narrative patterns are L2 subjective — always require verification',
    permissionRequired: 'T1',
    appliesTo: (token) => token.semantic === 'narrative',
  },
  {
    id: 'const-005',
    text: 'External source patterns must declare provenance',
    permissionRequired: 'T0',
    appliesTo: (token) => token.source?.origin === 'external',
  },
  {
    id: 'const-006',
    text: 'Code execution requires T1+ and must be complete',
    permissionRequired: 'T1',
    appliesTo: (token) => token.physical === 'code' && token.destination === 'P3_execution',
  },
  {
    id: 'const-007',
    text: 'Uncertain inputs directed to execution must be escalated',
    permissionRequired: 'T2',
    appliesTo: (token) => token.certainty === 'uncertain' && token.destination === 'P3_execution',
  },
  {
    id: 'const-008',
    text: 'L0 signal info must not contain subjective/narrative content',
    permissionRequired: 'T0',
    appliesTo: (token) => token.infoLevel === 'L0_signal' && (token.semantic === 'narrative' || token.semantic === 'evaluation'),
    severity: 'block',
  },
  {
    id: 'const-009',
    text: 'Relation level must correspond to info level (L0↔L0, L1↔L1, L2↔L2)',
    permissionRequired: 'T0',
    appliesTo: (token) => {
      if (token.semantic !== 'relation' || !token.relationLevel) return false
      const levelMap = { L0_signal: 'L0_logic', L1_objective_law: 'L1_conditional', L2_subjective: 'L2_existential' }
      const expectedR = levelMap[token.infoLevel]
      return expectedR && token.relationLevel !== expectedR
    },
    severity: 'downgrade',
  },
]

const PERMISSION_RANK = { T0: 0, T1: 1, T2: 2, T3: 3 }

function hasPermission(actor, required) {
  return (PERMISSION_RANK[actor] ?? 0) >= (PERMISSION_RANK[required] ?? 0)
}

/**
 * Narrowing level — how many fields are resolved.
 * physical + semantic + destination + certainty + completeness = 5 key fields
 */
function getNarrowingLevel(token) {
  const fields = [token.physical, token.semantic, token.destination, token.certainty, token.completeness]
  const resolved = fields.filter(f => f != null && f !== undefined).length
  if (resolved === fields.length) return 'full'
  if (resolved >= 3) return 'partial'
  return 'minimal'
}

function narrowingToMaxPermission(level) {
  switch (level) {
    case 'full': return 'T2'
    case 'partial': return 'T1'
    case 'minimal': return 'T0'
    default: return 'T0'
  }
}

/** Info level policies */
const INFO_LEVEL_POLICIES = {
  L0_signal: { maxPermission: 'T0', requiresVerification: false, canCreate: false },
  L1_objective_law: { maxPermission: 'T1', requiresVerification: false, canCreate: true },
  L2_subjective: { maxPermission: 'T2', requiresVerification: true, canCreate: true },
}

// ── Checker ──────────────────────────────────────────────────

/**
 * check() — constitutional validation.
 *
 * Takes a classified token + context, returns violations + effective permission.
 * Design: block → downgrade → warn, never silently pass.
 */
function check(token, ctx) {
  const violations = []

  // 1. Check constitutional rule bindings
  const appliedRules = []
  for (const rule of CONSTITUTION_RULES) {
    if (rule.appliesTo(token)) {
      appliedRules.push(rule.id)
      if (!hasPermission(ctx.actor, rule.permissionRequired)) {
        violations.push({
          ruleId: rule.id,
          message: `Permission denied: ${ctx.actor} cannot satisfy "${rule.text}" (requires ${rule.permissionRequired})`,
          severity: 'block',
          handler: 'reject',
        })
      }
    }
  }

  // 2. Check narrowing completeness
  const narrowing = getNarrowingLevel(token)
  const maxFromNarrowing = narrowingToMaxPermission(narrowing)
  const narrowingRank = PERMISSION_RANK[maxFromNarrowing]
  const actorRank = PERMISSION_RANK[ctx.actor] ?? 0

  if (narrowing === 'minimal') {
    violations.push({
      ruleId: 'narrowing',
      message: `Token has minimal narrowing (too many unknown fields) → permission downgraded`,
      severity: 'downgrade',
      handler: 'downgrade_permission',
    })
  } else if (narrowing === 'partial') {
    violations.push({
      ruleId: 'narrowing',
      message: `Token has partial narrowing → some fields unresolved`,
      severity: 'warn',
      handler: 'escalate_to_human',
    })
  }

  // 3. Check info level policy
  const policy = INFO_LEVEL_POLICIES[ctx.infoLevel] || INFO_LEVEL_POLICIES.L2_subjective
  if (actorRank > PERMISSION_RANK[policy.maxPermission]) {
    violations.push({
      ruleId: 'info_level_permission',
      message: `Info level ${ctx.infoLevel} caps permission at ${policy.maxPermission}, actor is ${ctx.actor}`,
      severity: 'warn',
      handler: 'downgrade_permission',
    })
  }

  if (policy.requiresVerification && token.certainty === 'uncertain') {
    violations.push({
      ruleId: 'l2_verification',
      message: `L2 subjective + uncertain → requires human verification before acting`,
      severity: 'warn',
      handler: 'escalate_to_human',
    })
  }

  // 4. Determine effective permission
  const hasBlocks = violations.some(v => v.severity === 'block')
  const hasDowngrades = violations.some(v => v.severity === 'downgrade')

  let effectiveRank = Math.min(actorRank, narrowingRank)
  if (hasDowngrades) {
    effectiveRank = Math.max(0, effectiveRank - 1)
  }

  const effectivePermission = Object.entries(PERMISSION_RANK)
    .find(([_, r]) => r === effectiveRank)?.[0] || 'T0'

  // 5. Determine status
  let status = 'approved'
  let nextAction = 'execute'

  if (hasBlocks) {
    status = 'blocked'
    nextAction = 'blocked'
  } else if (violations.some(v => v.handler === 'escalate_to_human')) {
    status = 'pending_confirmation'
    nextAction = 'confirm'
  } else if (hasDowngrades) {
    status = 'downgraded'
    nextAction = 'execute'
  }

  return {
    status,
    nextAction,
    violations,
    appliedRules,
    effectivePermission,
    narrowingLevel: narrowing,
  }
}

// ── PNode Generator ──────────────────────────────────────────

let pnodeCounter = 0

/**
 * Generate a versioned PNode with constitution references.
 * This is the standardized output — what the kernel receives.
 */
function generatePNode(token, checkResult, rawContent) {
  const id = `pnode-${Date.now()}-${++pnodeCounter}`

  return {
    id,
    version: 1,
    createdAt: Date.now(),

    // Classified token (all fields resolved by LLM)
    token: {
      physical: token.physical,
      semantic: token.semantic,
      destination: token.destination,
      certainty: token.certainty,
      completeness: token.completeness,
      truth: token.truth,
      infoLevel: token.infoLevel,
      relationLevel: token.relationLevel,
    },

    // Human-readable summary
    summary: token.summary,

    // Raw input preserved for audit
    rawContent,

    // Constitution validation result
    constitution: {
      status: checkResult.status,
      permissionLevel: checkResult.effectivePermission,
      narrowingLevel: checkResult.narrowingLevel,
      appliedRules: checkResult.appliedRules,
      violations: checkResult.violations,
    },

    // What happens next
    nextAction: checkResult.nextAction,

    // Content hash for integrity
    hash: crypto.createHash('sha256')
      .update(JSON.stringify({ rawContent, token, checkResult }))
      .digest('hex')
      .slice(0, 16),
  }
}

// ── Daemon State ─────────────────────────────────────────────

/**
 * In-memory state for the compiler daemon.
 * Tracks processed nodes, pending confirmations, and history.
 */
const daemon = {
  /** All generated PNodes, keyed by id */
  nodes: new Map(),

  /** PNodes awaiting human confirmation */
  pendingConfirmation: new Map(),

  /** Compilation history (last N entries) */
  history: [],

  /** Max history entries to keep */
  MAX_HISTORY: 200,

  /** Stats */
  stats: {
    totalCompiled: 0,
    totalBlocked: 0,
    totalApproved: 0,
    totalPending: 0,
    totalTokensUsed: 0,
    startedAt: Date.now(),
  },
}

// ── Main Compile Function ────────────────────────────────────

/**
 * compile() — the main entry point.
 *
 * Takes raw input from human, runs full pipeline:
 *   LLM Lexer → Checker → PNode Gen
 *
 * Returns everything the human needs to see and decide.
 */
async function compile(input) {
  const {
    content,
    source = { origin: 'external', type: 'user_input' },
    actor = 'T2',
    infoLevel = 'L2_subjective',
    tier = 'T1',
  } = input

  if (!content || !content.trim()) {
    return {
      success: false,
      error: 'Empty input — nothing to compile',
      pnode: null,
    }
  }

  // 1. LLM Lexer — classify input
  const lexResult = await llmLex(content, { tier })

  // Attach source info to token
  const token = { ...lexResult, source }

  // 2. Checker — constitutional validation
  const ctx = { actor, infoLevel }
  const checkResult = check(token, ctx)

  // 3. PNode Generator — produce versioned node
  const pnode = generatePNode(token, checkResult, content)

  // 4. Update daemon state
  daemon.nodes.set(pnode.id, pnode)
  daemon.stats.totalCompiled++
  daemon.stats.totalTokensUsed += (lexResult._meta?.inputTokens || 0) + (lexResult._meta?.outputTokens || 0)

  if (pnode.nextAction === 'blocked') {
    daemon.stats.totalBlocked++
  } else if (pnode.nextAction === 'confirm') {
    daemon.pendingConfirmation.set(pnode.id, pnode)
    daemon.stats.totalPending++
  } else {
    daemon.stats.totalApproved++
  }

  // Record in history
  daemon.history.push({
    id: pnode.id,
    timestamp: pnode.createdAt,
    summary: pnode.summary,
    status: pnode.constitution.status,
    nextAction: pnode.nextAction,
  })
  if (daemon.history.length > daemon.MAX_HISTORY) {
    daemon.history = daemon.history.slice(-daemon.MAX_HISTORY)
  }

  return {
    success: pnode.nextAction !== 'blocked',
    pnode,
    cost: lexResult._meta,
  }
}

// ── Confirm / Reject ─────────────────────────────────────────

/**
 * Human confirms or rejects a pending PNode.
 */
function confirm(pnodeId, action, reason) {
  const pnode = daemon.pendingConfirmation.get(pnodeId)
  if (!pnode) {
    return { success: false, error: `PNode ${pnodeId} not found in pending queue` }
  }

  daemon.pendingConfirmation.delete(pnodeId)
  daemon.stats.totalPending--

  if (action === 'approve') {
    pnode.constitution.status = 'approved'
    pnode.nextAction = 'execute'
    pnode.confirmedAt = Date.now()
    pnode.confirmedBy = 'human'
    pnode.confirmReason = reason || null
    daemon.stats.totalApproved++
    daemon.nodes.set(pnodeId, pnode)
    return { success: true, pnode }
  }

  if (action === 'reject') {
    pnode.constitution.status = 'rejected'
    pnode.nextAction = 'discarded'
    pnode.rejectedAt = Date.now()
    pnode.rejectReason = reason || null
    daemon.nodes.set(pnodeId, pnode)
    return { success: true, pnode }
  }

  return { success: false, error: `Unknown action: ${action}. Use "approve" or "reject"` }
}

// ── Status ───────────────────────────────────────────────────

/**
 * Get daemon status — compressed view for human.
 * "用最小的 token 上下文就能控制整个系统"
 */
function getStatus() {
  const uptime = Date.now() - daemon.stats.startedAt
  const pending = Array.from(daemon.pendingConfirmation.values()).map(p => ({
    id: p.id,
    summary: p.summary,
    violations: p.constitution.violations.map(v => v.message),
    nextAction: p.nextAction,
  }))

  return {
    uptime,
    stats: { ...daemon.stats },
    pending,
    recentHistory: daemon.history.slice(-10),
  }
}

/**
 * Get a specific PNode by id.
 */
function getNode(id) {
  return daemon.nodes.get(id) || null
}

/**
 * Get all nodes matching a filter.
 */
function queryNodes(filter = {}) {
  let results = Array.from(daemon.nodes.values())

  if (filter.status) {
    results = results.filter(n => n.constitution.status === filter.status)
  }
  if (filter.semantic) {
    results = results.filter(n => n.token.semantic === filter.semantic)
  }
  if (filter.destination) {
    results = results.filter(n => n.token.destination === filter.destination)
  }

  // Sort by creation time, newest first
  results.sort((a, b) => b.createdAt - a.createdAt)

  // Limit
  const limit = filter.limit || 50
  return results.slice(0, limit)
}

// ── Exports ──────────────────────────────────────────────────

module.exports = {
  compile,
  confirm,
  getStatus,
  getNode,
  queryNodes,
  // Expose internals for testing
  _internals: {
    llmLex,
    check,
    generatePNode,
    CONSTITUTION_RULES,
    daemon,
  },
}
