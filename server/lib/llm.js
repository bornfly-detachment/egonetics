/**
 * server/lib/llm.js
 * MiniMax LLM client（兼容 Anthropic SDK 协议）
 */
const Anthropic = require('@anthropic-ai/sdk')

const client = new Anthropic({
  apiKey:  process.env.MINIMAX_API_KEY  || 'sk-cp-exbRJm3svPL7BS6YRWcuTkeErS9N07I-PMZpuVvwq6jjySoBQBjEzrgOlgDHmB9p60QxAtuDUzGEX7-EZAVMFfShUCEDkzvH322lo0pO5y6pc4Vy_qwZw1U',
  baseURL: process.env.MINIMAX_BASE_URL || 'https://api.minimaxi.com/anthropic',
  timeout: 3000000,
})

const DEFAULT_MODEL     = process.env.MINIMAX_MODEL       || 'MiniMax-M2.7'
const DEFAULT_MAX_TOKENS = parseInt(process.env.MINIMAX_MAX_TOKENS || '4096', 10)

module.exports = { client, DEFAULT_MODEL, DEFAULT_MAX_TOKENS }
