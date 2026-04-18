/**
 * @prvse P-L0-DATA_ai-registry
 * @parent P-L1_ai-service
 * @chronicle prvse_world_workspace/chronicle/P/P-L1_ai-service.yaml
 *
 * AI 服务注册表 — 服务提供方 + 消费者 + 日志位置 的唯一清单
 *
 * 设计目标：
 *   从任何一条日志记录，能追溯到：
 *   1. 谁调用的（caller: file:line）← call.js 自动捕获
 *   2. 用的哪个服务（provider: T0/T1/T2）
 *   3. 服务的代码在哪（provider.codePath）
 *   4. 日志存在哪（logPaths）
 *
 * 用法：
 *   const registry = require('./registry')
 *   registry.getProvider('T0')     → { tier, codePath, endpoint, ... }
 *   registry.getConsumers()        → [{ name, codePath, purposes }]
 *   registry.getLogPaths()         → { calls, sessions }
 *   registry.manifest()            → 完整清单（供 API / 文档输出）
 */

'use strict'

const path = require('path')
const fs = require('fs')

const SERVER_ROOT = path.resolve(__dirname, '../..')
const FREE_CODE_TIERS_PATH = path.join(SERVER_ROOT, 'config/free-code-tiers.json')

// ── 服务提供方 ───────────────────────────────────────────────────

const PROVIDERS = {
  T0: {
    id: 'P-svc-t0',
    tier: 'T0',
    model: 'Qwen3.5-0.8B',
    protocol: 'openai',
    endpoint: 'http://localhost:8100',
    codePaths: {
      callAdapter: 'server/lib/ai-service/call.js → callOpenAI()',
      runtime: 'server/lib/t0-runtime.js',
      inference: 'server/routes/t0-inference.js',
      compatLayer: 'server/routes/anthropic-compat.js',
    },
    lifecycle: 'local — mlx_lm.server 手动/launchd 启动',
    notes: '0.8B 模型，thinking 模式有 loop 风险，presence_penalty=1.5',
  },
  T1: {
    tier: 'T1',
    model: 'MiniMax-M2.7',
    protocol: 'anthropic',
    endpoint: 'https://api.minimaxi.com/anthropic',
    codePaths: {
      callAdapter: 'server/lib/ai-service/call.js → callAnthropic()',
      engine: 'server/lib/t1-engine.js (legacy, session-engine 仍用)',
    },
    lifecycle: 'cloud — 无需管理',
    notes: 'thinking block 可能无 text block，需从 thinking 提取 JSON',
  },
  T2: {
    tier: 'T2',
    model: 'Claude Sonnet 4.6',
    protocol: 'anthropic',
    endpoint: 'https://api.anthropic.com',
    codePaths: {
      callAdapter: 'server/lib/ai-service/call.js → callAnthropic()',
      spawnClient: 'server/lib/t2-client.js (legacy, session spawn)',
    },
    lifecycle: 'cloud — 需要 ANTHROPIC_API_KEY',
    notes: 'Max 订阅，顶级模型',
  },
}

// ── 消费者（已迁移到 ai.call 的）────────────────────────────────

const CONSUMERS = [
  {
    name: 'prvse-compiler',
    codePath: 'server/lib/prvse-compiler.js → llmLex()',
    purposes: ['lexer-classify'],
    tiers: ['T0', 'T1'],
    status: 'migrated',
  },
  {
    name: 'prvse-aop',
    codePath: 'server/lib/prvse-aop.js → t0Classify() / t1Verify()',
    purposes: ['aop-t0-classify', 'aop-t1-verify'],
    tiers: ['T0', 'T1'],
    status: 'migrated',
  },
  {
    name: 'executor',
    codePath: 'server/lib/executor.js → callSEAI() / callMiniMax()',
    purposes: ['executor-t0', 'executor-t1'],
    tiers: ['T0', 'T1'],
    status: 'migrated',
  },
  {
    name: 'session-engine',
    codePath: 'server/lib/session-engine.js → t0/t1Engine.stream()',
    purposes: ['legacy-t0-stream', 'legacy-t1-stream'],
    tiers: ['T0', 'T1'],
    status: 'migrated — via t0/t1-engine adapter → ai.stream()',
  },
  {
    name: 'anthropic-compat',
    codePath: 'server/routes/anthropic-compat.js → t0/t1Engine.call()/stream()',
    purposes: ['legacy-t0-call', 'legacy-t0-stream', 'legacy-t1-call', 'legacy-t1-stream'],
    tiers: ['T0', 'T1'],
    status: 'migrated — via t0/t1-engine adapter → ai.call()/stream()',
  },
  {
    name: 'llm-routes',
    codePath: 'server/routes/llm.js → t0/t1Engine.stream()',
    purposes: ['legacy-t0-stream', 'legacy-t1-stream'],
    tiers: ['T0', 'T1', 'T2'],
    status: 'migrated — via t0/t1-engine adapter → ai.stream()',
  },
  {
    name: 'code-agent',
    codePath: 'server/routes/code-agent.js → t2-client.spawn()',
    purposes: ['t2-spawn'],
    tiers: ['T2'],
    status: 'pending — t2-client needs harness-manager adapter',
  },
  {
    name: 'acp-gateway',
    codePath: 'server/routes/acp-gateway.js',
    purposes: ['t2-spawn'],
    tiers: ['T2'],
    status: 'dead-code — 前端零引用，index.js 已注释',
  },
]

// ── 日志存储位置 ─────────────────────────────────────────────────

const WORKSPACE = process.env.EGONETICS_WORKSPACE || '/Users/Shared/prvse_world_workspace'

const LOG_PATHS = {
  calls: {
    path: 'prvse_world_workspace/L2/logs/ai-call-log.jsonl',
    absolutePath: path.join(WORKSPACE, 'L2/logs/ai-call-log.jsonl'),
    format: 'JSONL — { ts, tier, model, purpose, caller, inputTokens, outputTokens, latencyMs, success, error? }',
    rotation: 'none (TODO: daily rotation)',
  },
  sessions: {
    path: 'prvse_world_workspace/L2/logs/ai-session-log.jsonl',
    absolutePath: path.join(WORKSPACE, 'L2/logs/ai-session-log.jsonl'),
    format: 'JSONL — { ts, action, sessionId, tier, ... }',
    rotation: 'none (TODO)',
  },
  backend: {
    path: '/tmp/egonetics-backend.log',
    format: 'console stdout/stderr',
    rotation: 'overwritten on restart',
  },
}

const STATUS_VOCABULARY = ['ready', 'auth_required', 'unknown', 'unavailable', 'degraded']

const NAMING_CONTRACT = {
  aiLevels: ['T0', 'T1', 'T2'],
  note: 'PRVSE constitutional AI levels never exceed T2. free-code tier keys such as T3/T4 remain legacy host config keys.',
}

const OWNERSHIP_SPLIT = {
  prvse: ['resource_identity', 'harness_model_separation', 'bindings', 'policy', 'canonical_status_vocabulary'],
  egonetics: ['runtime_observation', 'terminal_transport', 'auth_detection', 'live_usage_projection', 'ui_projection'],
}

function readFreeCodeTiers() {
  try {
    return JSON.parse(fs.readFileSync(FREE_CODE_TIERS_PATH, 'utf8'))
  } catch {
    return null
  }
}

function buildCanonicalProjection() {
  const freeCodeTiers = readFreeCodeTiers()
  const tierMap = freeCodeTiers?.tiers || {}
  const hostT2 = tierMap.T2 || null

  return {
    namingContract: NAMING_CONTRACT,
    ownershipSplit: OWNERSHIP_SPLIT,
    statusVocabulary: STATUS_VOCABULARY,
    modelResources: [
      {
        id: 'model:local-deterministic',
        aiLevel: 'T0',
        providerTier: 'T0',
        runtime: 'local',
        protocol: PROVIDERS.T0.protocol,
        model: PROVIDERS.T0.model,
        status: 'ready',
      },
      {
        id: 'model:minimax',
        aiLevel: 'T1',
        providerTier: 'T1',
        runtime: 'api',
        protocol: PROVIDERS.T1.protocol,
        model: PROVIDERS.T1.model,
        status: 'unknown',
      },
    ],
    harnessResources: [
      {
        id: 'harness:claude-cli',
        aiLevel: 'T2',
        providerTier: 'T2',
        legacyFreeCodeTierKey: hostT2 ? 'T2' : null,
        runtime: 'cli',
        binary: 'claude',
        modelHint: hostT2?.model_hint || 'unknown',
        status: hostT2 ? 'unknown' : 'unavailable',
        hostConfigPresent: Boolean(hostT2),
      },
      {
        id: 'harness:codex-cli',
        aiLevel: 'T2',
        providerTier: 'T2',
        legacyFreeCodeTierKey: hostT2 ? 'T2' : null,
        runtime: 'cli',
        binary: 'codex',
        modelHint: 'codex',
        status: hostT2 ? 'unknown' : 'unavailable',
        hostConfigPresent: Boolean(hostT2),
      },
      {
        id: 'harness:gemini-cli',
        aiLevel: 'T2',
        providerTier: 'T2',
        legacyFreeCodeTierKey: hostT2 ? 'T2' : null,
        runtime: 'cli',
        binary: 'gemini',
        modelHint: 'gemini',
        status: hostT2 ? 'unknown' : 'unavailable',
        hostConfigPresent: Boolean(hostT2),
      },
    ],
    runtimeTiers: [
      {
        id: 'T2',
        aiLevel: 'T2',
        legacyFreeCodeTierKey: hostT2 ? 'T2' : null,
        hostConfigPresent: Boolean(hostT2),
        providers: ['harness:claude-cli', 'harness:codex-cli', 'harness:gemini-cli'],
      },
    ],
    resourceBindings: [
      { id: 'binding:slot:T0', aiLevel: 'T0', modelResourceId: 'model:local-deterministic' },
      { id: 'binding:slot:T1', aiLevel: 'T1', modelResourceId: 'model:minimax' },
      {
        id: 'binding:slot:T2',
        aiLevel: 'T2',
        harnessResourceIds: ['harness:claude-cli', 'harness:codex-cli', 'harness:gemini-cli'],
        legacyFreeCodeTierKey: hostT2 ? 'T2' : null,
        hostConfigPresent: Boolean(hostT2),
      },
    ],
  }
}

// ── 公共接口 ─────────────────────────────────────────────────────

function getProvider(tier) {
  return PROVIDERS[tier] || null
}

function getConsumers(filter) {
  if (!filter) return CONSUMERS
  if (filter.status) return CONSUMERS.filter(c => c.status.startsWith(filter.status))
  if (filter.tier) return CONSUMERS.filter(c => c.tiers.includes(filter.tier))
  return CONSUMERS
}

function getLogPaths() {
  return LOG_PATHS
}

/**
 * Full manifest — providers + consumers + logs.
 * Designed to be exposed via API or written to docs.
 */
function manifest() {
  return {
    generated: new Date().toISOString(),
    providers: PROVIDERS,
    consumers: CONSUMERS,
    logs: LOG_PATHS,
    canonicalProjection: buildCanonicalProjection(),
    migrationProgress: {
      migrated: CONSUMERS.filter(c => c.status === 'migrated').length,
      pending: CONSUMERS.filter(c => c.status.startsWith('pending')).length,
      total: CONSUMERS.length,
    },
  }
}

module.exports = {
  getProvider,
  getConsumers,
  getLogPaths,
  manifest,
  canonicalProjection: buildCanonicalProjection,
  PROVIDERS,
  CONSUMERS,
  LOG_PATHS,
}
