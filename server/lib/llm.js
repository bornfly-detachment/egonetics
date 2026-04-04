/**
 * server/lib/llm.js
 * 三层 LLM 客户端：T0 SEAI 本地 / T1 MiniMax 云端 / T2 Claude 专家
 *
 * T0: localhost:8000 — SEAI 本地模型，零延迟，离线可用
 * T1: minimaxi.com   — MiniMax-M2.7，高并发，兼容 Anthropic 协议
 * T2: api.anthropic.com — claude-sonnet-4-6，顶级专家模型
 *
 * 注意：T0/T1/T2 执行逻辑已迁移到各自独立文件：
 *   t0-engine.js — T0 直接调用 localhost:8001/generate
 *   t1-engine.js — T1 MiniMax via Anthropic SDK
 *   t2-client.js — T2 spawn claude -p
 * 此文件保留向后兼容（getClientForTier / minimaxClient）。
 */
const Anthropic = require('@anthropic-ai/sdk')

// T1 — MiniMax（默认）
const minimaxClient = new Anthropic({
  apiKey:  process.env.MINIMAX_API_KEY  || '',
  baseURL: process.env.MINIMAX_BASE_URL || 'https://api.minimaxi.com/anthropic',
  timeout: 3000000,
})

// T0 — SEAI 本地（兼容 Anthropic 协议，localhost:8000）
const seaiClient = new Anthropic({
  apiKey:  process.env.SEAI_API_KEY  || 'seai-local',
  baseURL: process.env.SEAI_BASE_URL || 'http://localhost:8000',
  timeout: 30000,  // 本地延迟低，30s 超时即可
})

// T2 — Claude 真实 API（需要 ANTHROPIC_API_KEY 环境变量）
const claudeClient = new Anthropic({
  apiKey:  process.env.ANTHROPIC_API_KEY || '',
  timeout: 3000000,
})

const MODELS = {
  T0: process.env.SEAI_MODEL      || 'seai',
  T1: process.env.MINIMAX_MODEL   || 'MiniMax-M2.7',
  T2: process.env.CLAUDE_MODEL    || 'claude-sonnet-4-6',
}

const DEFAULT_MODEL      = MODELS.T1
const DEFAULT_MAX_TOKENS = parseInt(process.env.MINIMAX_MAX_TOKENS || '4096', 10)

/** 根据 tier 返回对应客户端和模型 */
function getClientForTier(tier) {
  if (tier === 'T0') return { client: seaiClient, model: MODELS.T0 }
  if (tier === 'T2') {
    if (!process.env.ANTHROPIC_API_KEY) {
      // Claude API key 未配置，降级到 MiniMax
      return { client: minimaxClient, model: MODELS.T1, downgraded: true }
    }
    return { client: claudeClient, model: MODELS.T2 }
  }
  return { client: minimaxClient, model: MODELS.T1 }  // T1 or default
}

// 保持向后兼容：其他路由仍可 require('./lib/llm').client
const client = minimaxClient

module.exports = { client, minimaxClient, seaiClient, claudeClient, MODELS, DEFAULT_MODEL, DEFAULT_MAX_TOKENS, getClientForTier }
