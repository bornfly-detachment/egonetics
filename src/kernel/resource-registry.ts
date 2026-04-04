/**
 * PRVSE Kernel — Resource Registry
 *
 * The minimal seed for system self-awareness.
 * Every resource the system can use is declared here.
 *
 * This is the ONLY thing that can be "hardcoded" —
 * everything else (persistence, schema, interaction)
 * flows from this registry.
 *
 * Pure TypeScript, zero dependencies.
 */

// ── Types ────────────────────────────────────────────────────────

export type ResourceType = 'compute' | 'storage' | 'ai' | 'network' | 'human'
export type ResourceTier = 'T0' | 'T1' | 'T2' | 'T3'
export type ResourceLevel = 'L0' | 'L1' | 'L2'
export type ResourceStatus = 'available' | 'busy' | 'offline' | 'unknown'

export interface Resource {
  readonly id: string
  readonly name: string
  readonly type: ResourceType
  readonly tier: ResourceTier
  readonly level: ResourceLevel
  readonly status: ResourceStatus
  readonly capabilities: readonly string[]
  readonly constraints: readonly string[]
  readonly children: readonly string[]       // child resource IDs
  readonly physicalMapping: string           // what it maps to in the real world
  readonly meta?: Readonly<Record<string, unknown>>  // extensible, not enumerated
}

// ── Registry ─────────────────────────────────────────────────────

export interface ResourceRegistry {
  readonly resources: ReadonlyMap<string, Resource>
  get(id: string): Resource | undefined
  list(): readonly Resource[]
  listByLevel(level: ResourceLevel): readonly Resource[]
  listByType(type: ResourceType): readonly Resource[]
  add(resource: Resource): ResourceRegistry
  update(id: string, patch: Partial<Omit<Resource, 'id'>>): ResourceRegistry
  remove(id: string): ResourceRegistry
}

export function createRegistry(seed: readonly Resource[] = []): ResourceRegistry {
  const map = new Map<string, Resource>(seed.map(r => [r.id, r]))
  return buildRegistry(map)
}

function buildRegistry(map: Map<string, Resource>): ResourceRegistry {
  const frozen = new Map(map) // shallow copy for immutability

  return {
    resources: frozen,

    get(id: string) {
      return frozen.get(id)
    },

    list() {
      return [...frozen.values()]
    },

    listByLevel(level: ResourceLevel) {
      return [...frozen.values()].filter(r => r.level === level)
    },

    listByType(type: ResourceType) {
      return [...frozen.values()].filter(r => r.type === type)
    },

    add(resource: Resource) {
      const next = new Map(frozen)
      next.set(resource.id, resource)
      return buildRegistry(next)
    },

    update(id: string, patch: Partial<Omit<Resource, 'id'>>) {
      const existing = frozen.get(id)
      if (!existing) return buildRegistry(new Map(frozen))
      const next = new Map(frozen)
      next.set(id, { ...existing, ...patch })
      return buildRegistry(next)
    },

    remove(id: string) {
      const next = new Map(frozen)
      next.delete(id)
      return buildRegistry(next)
    },
  }
}

// ── Seed Resources ───────────────────────────────────────────────
// The initial set of resources the system knows about at boot.
// This is the ONE hardcoded thing — everything else is dynamic.

export const SEED_RESOURCES: readonly Resource[] = [
  // ═══ L0: Deterministic / Local / Always Available ═══

  // compute
  {
    id: 'node-runtime',
    name: 'Node.js Runtime',
    type: 'compute',
    tier: 'T0',
    level: 'L0',
    status: 'available',
    capabilities: ['js-execution', 'ts-compilation', 'file-io', 'network-io'],
    constraints: ['single-thread-event-loop', 'v8-heap-limit'],
    children: [],
    physicalMapping: 'Node.js 18 on macOS Darwin 25.3',
  },

  // storage — memory
  {
    id: 'mem-heap',
    name: 'JS Heap',
    type: 'storage',
    tier: 'T0',
    level: 'L0',
    status: 'available',
    capabilities: ['fast-read-write', 'structured-data', 'zero-latency'],
    constraints: ['volatile', 'process-scoped', 'gc-pressure'],
    children: [],
    physicalMapping: 'V8 Heap Memory (process-local)',
  },
  {
    id: 'browser-storage',
    name: 'Browser Storage',
    type: 'storage',
    tier: 'T0',
    level: 'L0',
    status: 'available',
    capabilities: ['key-value', 'persistent-across-sessions', 'sync-access'],
    constraints: ['5MB-limit', 'string-only', 'same-origin'],
    children: [],
    physicalMapping: 'localStorage / sessionStorage (Browser)',
  },

  // storage — filesystem
  {
    id: 'fs-local',
    name: 'Local Filesystem',
    type: 'storage',
    tier: 'T0',
    level: 'L0',
    status: 'available',
    capabilities: ['arbitrary-files', 'directory-tree', 'large-capacity'],
    constraints: ['disk-speed', 'permission-model', 'no-query'],
    children: [],
    physicalMapping: '~/Desktop/claude_code_learn/egonetics/',
  },

  // storage — sqlite cluster
  {
    id: 'sqlite-cluster',
    name: 'SQLite Cluster',
    type: 'storage',
    tier: 'T0',
    level: 'L0',
    status: 'available',
    capabilities: ['sql-query', 'acid-transactions', 'structured-schema'],
    constraints: ['single-writer', 'no-replication', 'local-only'],
    children: ['sqlite-memory', 'sqlite-tasks', 'sqlite-pages', 'sqlite-agents', 'sqlite-auth'],
    physicalMapping: 'server/data/*.db (5x SQLite)',
  },
  {
    id: 'sqlite-memory',
    name: 'memory.db',
    type: 'storage',
    tier: 'T0',
    level: 'L0',
    status: 'available',
    capabilities: ['chat-sessions', 'chronicle-entries', 'chronicle-collections'],
    constraints: ['append-heavy', 'hash-chain-integrity'],
    children: [],
    physicalMapping: 'server/data/memory.db',
  },
  {
    id: 'sqlite-tasks',
    name: 'tasks.db',
    type: 'storage',
    tier: 'T0',
    level: 'L0',
    status: 'available',
    capabilities: ['task-crud', 'kanban-state', 'task-outcome-tracking'],
    constraints: ['single-source-of-truth-for-tasks'],
    children: [],
    physicalMapping: 'server/data/tasks.db',
  },
  {
    id: 'sqlite-pages',
    name: 'pages.db',
    type: 'storage',
    tier: 'T0',
    level: 'L0',
    status: 'available',
    capabilities: ['page-content', 'block-editor-storage', 'theory-pages'],
    constraints: ['do-not-modify-theory-lock-state-here'],
    children: [],
    physicalMapping: 'server/data/pages.db',
  },
  {
    id: 'sqlite-agents',
    name: 'agents.db',
    type: 'storage',
    tier: 'T0',
    level: 'L0',
    status: 'available',
    capabilities: ['agent-definitions', 'agent-relations', 'agent-messages'],
    constraints: [],
    children: [],
    physicalMapping: 'server/data/agents.db',
  },
  {
    id: 'sqlite-auth',
    name: 'auth.db',
    type: 'storage',
    tier: 'T0',
    level: 'L0',
    status: 'available',
    capabilities: ['user-accounts', 'jwt-tokens', 'role-permissions', 'login-attempts'],
    constraints: ['security-critical', 'never-expose-hashes'],
    children: [],
    physicalMapping: 'server/data/auth.db',
  },

  // ai — rule engine
  {
    id: 'rule-engine',
    name: 'PRVSE Compiler',
    type: 'ai',
    tier: 'T0',
    level: 'L0',
    status: 'available',
    capabilities: ['pattern-scanning', 'relation-binding', 'value-checking', 'state-emitting'],
    constraints: ['deterministic-only', 'no-learning', 'no-external-calls'],
    children: [],
    physicalMapping: 'src/kernel/compiler/ (Scanner/Binder/Checker/Emitter)',
  },

  // network
  {
    id: 'express-3002',
    name: 'Backend API',
    type: 'network',
    tier: 'T0',
    level: 'L0',
    status: 'available',
    capabilities: ['rest-api', 'auth-middleware', 'db-access', 'file-serving'],
    constraints: ['local-only', 'single-instance', 'no-clustering'],
    children: [],
    physicalMapping: 'Express.js on localhost:3002',
  },

  // ═══ L1: External Reasoning / Latency + Cost ═══

  // ai — MiniMax
  {
    id: 'minimax-m27',
    name: 'MiniMax M2.7',
    type: 'ai',
    tier: 'T1',
    level: 'L1',
    status: 'available',
    capabilities: ['text-generation', 'pattern-recognition', 'task-planning', 'feedback-analysis'],
    constraints: ['api-latency', 'token-cost', 'rate-limit', 'context-window-limit'],
    children: [],
    physicalMapping: 'api.minimaxi.com (Anthropic SDK compatible)',
    meta: { model: 'MiniMax-M2.7', protocol: 'anthropic-sdk' },
  },

  // network — SEAI
  {
    id: 'seai-8000',
    name: 'SubjectiveEgoneticsAI',
    type: 'network',
    tier: 'T1',
    level: 'L1',
    status: 'unknown',
    capabilities: ['ai-agent', 'prvse-inference', 'training-pipeline'],
    constraints: ['requires-manual-start', 'gpu-dependent', 'local-only'],
    children: [],
    physicalMapping: 'localhost:8000 (Python FastAPI)',
  },

  // ═══ L2: Strategic / Human Approval / High Value ═══

  // ai — Claude Max
  {
    id: 'claude-max',
    name: 'Claude Max',
    type: 'ai',
    tier: 'T2',
    level: 'L2',
    status: 'available',
    capabilities: ['deep-reasoning', 'constitution-generation', 'strategic-decisions', 'code-generation'],
    constraints: ['tmux-session-only', 'max-membership', 'T2-operations-only', 'must-log-to-evolution'],
    children: [],
    physicalMapping: 'Anthropic Claude Max (tmux session)',
    meta: { accessMethod: 'tmux', tier: 'T2' },
  },

  // human
  {
    id: 'bornfly',
    name: 'bornfly',
    type: 'human',
    tier: 'T3',
    level: 'L2',
    status: 'available',
    capabilities: ['final-judgment', 'constitution-approval', 'strategic-direction', 'T3-shengbianlun'],
    constraints: ['async-response', 'limited-bandwidth', 'attention-is-scarce'],
    children: [],
    physicalMapping: 'Human operator (admin)',
  },
]

// ── Default Registry ─────────────────────────────────────────────

export function createDefaultRegistry(): ResourceRegistry {
  return createRegistry(SEED_RESOURCES)
}
