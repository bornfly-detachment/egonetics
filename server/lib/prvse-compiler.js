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
 * New P shape (v2.0):
 *   - origin: chain provenance (internal/external + type)
 *   - state: external / candidate / internal (三态)
 *   - physical: 9 carrier forms
 *   - level: L0_atom / L1_molecule / L2_gene (三级形态)
 *   - communication: bottom_up / top_down / lateral
 *
 * Design: "编译不通过就不运行" — blocked = no execution, period.
 */

const t0Engine = require('./t0-engine')
const t1Engine = require('./t1-engine')
const crypto = require('crypto')

// ── LLM Lexer System Prompt ─────────────────────────────────

const LEXER_SYSTEM_PROMPT = `Classify input into JSON. Return ONLY JSON, no text.

{"physical":"text|number|code|structured|image|audio|video|stream|mixed","level":"L0_atom|L1_molecule|L2_gene","communication":"bottom_up|top_down|lateral","infoLevel":"L0_signal|L1_objective_law|L2_subjective","relationLevel":"L0_logic|L1_conditional|L2_existential|null","summary":"one line"}

Rules:
physical: text=natural language, number=numeric, code=program/script, structured=JSON/table, image/audio/video=media, stream=realtime, mixed=multimodal
level: L0_atom=minimal complete info unit(concrete,specific,single fact/value/command), L1_molecule=P+R+V combined module(references multiple components,integration), L2_gene=abstraction of practice(constitution,goals,principles,evolution rules)
communication: bottom_up=info flowing into system from below(external input,user request,raw data), top_down=abstraction guiding practice(rules,directives,constitution), lateral=same-level signal(module output,status update,peer communication)
infoLevel: L0=objective/deterministic(math,sensor), L1=scientific/reproducible(physics,stats), L2=subjective/needs-judgment(opinion,plan)
relationLevel(only if content describes a relation): L0=pure-logic(1+1=2), L1=causal/conditional(too complex to enumerate), L2=dialectic/existential(narrative needed). null if not about relations.`

// ── LLM Lexer ────────────────────────────────────────────────

/**
 * Call MiniMax to classify input into PatternToken fields.
 * Returns resolved fields (LLM does the semantic heavy lifting).
 */
async function llmLex(content, opts = {}) {
  const tier   = opts.tier || 'T1'
  const engine = tier === 'T0' ? t0Engine : t1Engine

  const startTime = Date.now()

  const { content: rawText } = await engine.call(
    [{ role: 'user', content: `[System]\n${LEXER_SYSTEM_PROMPT}\n\n[Input to classify]\n${content}` }],
    { maxTokens: 1024 }
  )
  const raw = rawText || '{}'
  const elapsed = Date.now() - startTime
  console.log(`[compiler/lexer] raw length=${raw.length}, first100=${JSON.stringify(raw.slice(0, 100))}`)

  // Parse LLM response — extract JSON from possible markdown wrapping
  let parsed
  try {
    // Try multiple extraction strategies
    let jsonStr = raw.trim()

    // Strategy 1: strip markdown code fence
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fenceMatch) jsonStr = fenceMatch[1].trim()

    // Strategy 2: extract outermost { ... }
    const braceMatch = jsonStr.match(/\{[\s\S]*\}/)
    if (braceMatch) jsonStr = braceMatch[0]

    // Strategy 3: if jsonStr contains | (from prompt echo), clean it
    jsonStr = jsonStr.replace(/"\s*\|\s*"/g, '" | "')

    parsed = JSON.parse(jsonStr)
    console.log(`[compiler/lexer] OK: level=${parsed.level}, infoLevel=${parsed.infoLevel}`)
  } catch (parseErr) {
    console.error(`[compiler/lexer] JSON parse failed: ${parseErr.message}`)
    console.error(`[compiler/lexer] raw: ${JSON.stringify(raw.slice(0, 300))}`)
    // LLM returned unparseable output — fallback to minimal classification
    parsed = {
      physical: 'text',
      level: 'L0_atom',
      communication: 'bottom_up',
      infoLevel: 'L2_subjective',
      relationLevel: null,
      summary: 'LLM classification failed — fallback to L0_atom/bottom_up',
    }
  }

  return {
    physical: parsed.physical || 'text',
    level: parsed.level || 'L0_atom',
    communication: parsed.communication || 'bottom_up',
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
 *
 * Rules are level-based (not semantic-based):
 *   L0_atom → T0, L1_molecule → T1, L2_gene → T2
 */
const CONSTITUTION_RULES = [
  {
    id: 'const-001',
    text: 'L0 atoms: any execution node (T0+) can read/write',
    permissionRequired: 'T0',
    appliesTo: (token) => token.level === 'L0_atom',
  },
  {
    id: 'const-002',
    text: 'L1 molecules require reasoning authority (T1+)',
    permissionRequired: 'T1',
    appliesTo: (token) => token.level === 'L1_molecule',
  },
  {
    id: 'const-003',
    text: 'L2 genes require evolution authority (T2+)',
    permissionRequired: 'T2',
    appliesTo: (token) => token.level === 'L2_gene',
  },
  {
    id: 'const-004',
    text: 'External origin must declare provenance chain (any tier)',
    permissionRequired: 'T0',
    appliesTo: (token) => token.origin?.domain === 'external',
  },
  {
    id: 'const-005',
    text: 'State transition external→candidate requires L0 validation',
    permissionRequired: 'T0',
    appliesTo: (token) => token.state === 'external',
  },
  {
    id: 'const-006',
    text: 'candidate→internal requires practice verification (T1+)',
    permissionRequired: 'T1',
    appliesTo: (token) => token.state === 'candidate',
  },
  {
    id: 'const-007',
    text: 'No shortcut: external cannot directly become internal',
    permissionRequired: 'T0',
    appliesTo: (token) => token.origin?.domain === 'external' && token.state === 'internal',
    severity: 'block',
  },
  {
    id: 'const-008',
    text: 'L0 signal info must not use top_down communication',
    permissionRequired: 'T0',
    appliesTo: (token) => token.infoLevel === 'L0_signal' && token.communication === 'top_down',
    severity: 'block',
  },
  {
    id: 'const-009',
    text: 'Relation level must correspond to info level (L0↔L0, L1↔L1, L2↔L2)',
    permissionRequired: 'T0',
    appliesTo: (token) => {
      if (!token.relationLevel) return false
      const levelMap = { L0_signal: 'L0_logic', L1_objective_law: 'L1_conditional', L2_subjective: 'L2_existential' }
      const expectedR = levelMap[token.infoLevel]
      return expectedR && token.relationLevel !== expectedR
    },
    severity: 'downgrade',
  },
]

/**
 * Permission hierarchy (external 3-tier + internal T3):
 *   T0 = execution/practice (all bottom-layer agents)
 *   T1 = reasoning/control (AI-level PRVSE engine)
 *   T2 = evolution authority (human-machine, goals/constitution/resources)
 *   T3 = 生变论 (bornfly creator authority, internal only)
 */
const PERMISSION_RANK = { T0: 0, T1: 1, T2: 2, T3: 3 }

function hasPermission(actor, required) {
  return (PERMISSION_RANK[actor] ?? 0) >= (PERMISSION_RANK[required] ?? 0)
}

/**
 * Narrowing level — how many fields are resolved.
 * physical + level + communication = 3 key narrowable fields
 */
function getNarrowingLevel(token) {
  const fields = [token.physical, token.level, token.communication]
  const resolved = fields.filter(f => f != null && f !== undefined).length
  if (resolved === fields.length) return 'full'
  if (resolved >= 1) return 'partial'
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

      // Rules with custom severity (e.g. const-007, const-008, const-009) fire regardless of permission
      if (rule.severity) {
        violations.push({
          ruleId: rule.id,
          message: `Constitutional violation: "${rule.text}"`,
          severity: rule.severity,
          handler: rule.severity === 'block' ? 'reject' : 'downgrade_permission',
        })
      } else if (!hasPermission(ctx.actor, rule.permissionRequired)) {
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

  if (policy.requiresVerification && token.state === 'external') {
    violations.push({
      ruleId: 'l2_verification',
      message: `L2 subjective + external state → requires human verification before acting`,
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

    // Classified token (new P shape: origin/state/physical/level/communication)
    token: {
      physical: token.physical,
      level: token.level,
      communication: token.communication,
      infoLevel: token.infoLevel,
      relationLevel: token.relationLevel,
    },

    // Origin chain provenance
    origin: token.origin || { domain: 'external', type: 'narrative' },

    // Pattern state (三态)
    state: token.state || 'external',

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
    origin = { domain: 'external', type: 'user_input' },
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

  // Attach origin + determine state
  const state = origin.domain === 'external' ? 'external' : 'candidate'
  const token = { ...lexResult, origin, state }

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
  if (filter.level) {
    results = results.filter(n => n.token.level === filter.level)
  }
  if (filter.communication) {
    results = results.filter(n => n.token.communication === filter.communication)
  }
  if (filter.physical) {
    results = results.filter(n => n.token.physical === filter.physical)
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
