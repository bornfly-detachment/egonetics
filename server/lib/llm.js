/**
 * server/lib/llm.js
 * 共用 ARK LLM client（兼容 Anthropic SDK 协议）
 */
const Anthropic = require('@anthropic-ai/sdk')

const client = new Anthropic({
  apiKey:  process.env.ARK_API_KEY  || '9a2642e3-d938-4c0e-b705-d8440841a846',
  baseURL: process.env.ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/coding',
  timeout: 90000,
})

const DEFAULT_MODEL     = process.env.ARK_MODEL      || 'ark-code-latest'
const DEFAULT_MAX_TOKENS = parseInt(process.env.ARK_MAX_TOKENS || '2048', 10)

module.exports = { client, DEFAULT_MODEL, DEFAULT_MAX_TOKENS }
