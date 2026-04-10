/**
 * @prvse P-L0-DATA_tier-config
 * @parent P-L1_ai-service
 * @chronicle prvse_world_workspace/chronicle/P/P-L1_ai-service.yaml
 *
 * Tier 配置 + 调用者溯源工具 — call.js 和 stream.js 的共享基础
 */

'use strict'

const platform = require('../resource-manager/platform')

// ── Tier 配置 ────────────────────────────────────────────────────

const TIER_CONFIG = {
  T0: {
    protocol: 'openai',
    getEndpoint: () => `http://localhost:${process.env.T0_INFERENCE_PORT || '8100'}`,
    model: () => process.env.T0_MODEL || 'qwen3.5-0.8b',
    defaultMaxTokens: 4096,
    defaultParams: {
      temperature: 1.0,
      top_p: 0.95,
      top_k: 20,
      presence_penalty: 1.5,
      repetition_penalty: 1.0,
    },
    nonThinkingParams: {
      temperature: 1.0,
      top_p: 1.0,
      top_k: 20,
      presence_penalty: 2.0,
      repetition_penalty: 1.0,
    },
    supportsThinking: true,
  },
  T1: {
    protocol: 'anthropic',
    getEndpoint: () => process.env.MINIMAX_BASE_URL || 'https://api.minimaxi.com/anthropic',
    apiKey: () => process.env.MINIMAX_API_KEY || '',
    model: () => process.env.MINIMAX_MODEL || 'MiniMax-M2.7',
    defaultMaxTokens: 4096,
    defaultParams: {},
    supportsThinking: true,
  },
  T2: {
    protocol: 'anthropic',
    getEndpoint: () => 'https://api.anthropic.com',
    apiKey: () => process.env.ANTHROPIC_API_KEY || '',
    model: () => process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
    defaultMaxTokens: 4096,
    defaultParams: {},
    supportsThinking: false,
  },
}

// ── Caller 溯源 ──────────────────────────────────────────────────

/**
 * Extract caller location (file:line) from Error stack.
 * Skips frames inside ai-service/ to find the real caller.
 */
function getCallerSite() {
  const stack = new Error().stack || ''
  const lines = stack.split('\n').slice(1)
  const selfDir = __dirname.replace(/\\/g, '/')
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.includes(selfDir)) continue
    const m = trimmed.match(/\(([^)]+)\)/) || trimmed.match(/at\s+(.+)/)
    if (m) {
      const loc = m[1].replace(/^.*\/server\//, 'server/').replace(/:\d+$/, '')
      return loc
    }
  }
  return 'unknown'
}

// ── 协议工具 ─────────────────────────────────────────────────────

function isT0PortListening() {
  const port = parseInt(new URL(TIER_CONFIG.T0.getEndpoint()).port, 10)
  return platform.isPortListening(port)
}

module.exports = { TIER_CONFIG, getCallerSite, isT0PortListening }
