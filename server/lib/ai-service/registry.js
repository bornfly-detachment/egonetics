/**
 * ai-service/registry.js
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

const SERVER_ROOT = path.resolve(__dirname, '../..')

// ── 服务提供方 ───────────────────────────────────────────────────

const PROVIDERS = {
  T0: {
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
    codePath: 'server/lib/session-engine.js',
    purposes: ['chat-stream'],
    tiers: ['T0', 'T1'],
    status: 'pending — needs ai.stream()',
  },
  {
    name: 'anthropic-compat',
    codePath: 'server/routes/anthropic-compat.js',
    purposes: ['cli-proxy'],
    tiers: ['T0', 'T1'],
    status: 'pending — CLI 兼容层',
  },
  {
    name: 'llm-routes',
    codePath: 'server/routes/llm.js',
    purposes: ['api-chat'],
    tiers: ['T0', 'T1', 'T2'],
    status: 'pending — 旧 API 路由',
  },
  {
    name: 'code-agent',
    codePath: 'server/routes/code-agent.js',
    purposes: ['t2-spawn'],
    tiers: ['T2'],
    status: 'pending — belongs to harness-manager',
  },
  {
    name: 'acp-gateway',
    codePath: 'server/routes/acp-gateway.js',
    purposes: ['t2-spawn'],
    tiers: ['T2'],
    status: 'pending — belongs to harness-manager',
  },
]

// ── 日志存储位置 ─────────────────────────────────────────────────

const LOG_PATHS = {
  calls: {
    path: 'server/data/ai-call-log.jsonl',
    absolutePath: path.join(SERVER_ROOT, 'data/ai-call-log.jsonl'),
    format: 'JSONL — { ts, tier, model, purpose, caller, inputTokens, outputTokens, latencyMs, success, error? }',
    rotation: 'none (TODO: daily rotation)',
  },
  sessions: {
    path: 'server/data/ai-session-log.jsonl',
    absolutePath: path.join(SERVER_ROOT, 'data/ai-session-log.jsonl'),
    format: 'JSONL — { ts, action, sessionId, tier, ... }',
    rotation: 'none (TODO)',
  },
  backend: {
    path: '/tmp/egonetics-backend.log',
    format: 'console stdout/stderr',
    rotation: 'overwritten on restart',
  },
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
    migrationProgress: {
      migrated: CONSUMERS.filter(c => c.status === 'migrated').length,
      pending: CONSUMERS.filter(c => c.status.startsWith('pending')).length,
      total: CONSUMERS.length,
    },
  }
}

module.exports = { getProvider, getConsumers, getLogPaths, manifest, PROVIDERS, CONSUMERS, LOG_PATHS }
