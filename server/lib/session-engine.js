/**
 * server/lib/session-engine.js
 * 连续会话引擎 — 兼容 OpenClaw JSONL 格式
 *
 * 存储结构：
 *   server/data/chat/<agentId>/sessions/<uuid>.jsonl   对话条目
 *   server/data/chat/<agentId>/sessions/sessions.json  会话索引
 *
 * Session Key 规则：
 *   webhook: "<agentId>:<channel>:<from>"   (绑定渠道+发送者)
 *   heartbeat: "<agentId>:heartbeat"
 *   web: "<agentId>:web:<userId>"
 */

const fs   = require('fs')
const path = require('path')
const { randomUUID } = require('crypto')
const { getClientForTier, DEFAULT_MAX_TOKENS } = require('./llm')

const DATA_ROOT = path.join(__dirname, '../data/chat')

// ── 文件操作 ──────────────────────────────────────────────────────────────────

function sessionsDir(agentId) {
  const dir = path.join(DATA_ROOT, agentId, 'sessions')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function sessionsIndexPath(agentId) {
  return path.join(sessionsDir(agentId), 'sessions.json')
}

function sessionFilePath(agentId, sessionId) {
  return path.join(sessionsDir(agentId), `${sessionId}.jsonl`)
}

/** 读取 sessions.json 索引 */
function loadIndex(agentId) {
  const p = sessionsIndexPath(agentId)
  if (!fs.existsSync(p)) return {}
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return {} }
}

/** 写入 sessions.json 索引（原子写） */
function saveIndex(agentId, index) {
  const p = sessionsIndexPath(agentId)
  fs.writeFileSync(p + '.tmp', JSON.stringify(index, null, 2))
  fs.renameSync(p + '.tmp', p)
}

/** 追加一条 JSONL 条目 */
function appendEntry(filePath, entry) {
  fs.appendFileSync(filePath, JSON.stringify(entry) + '\n')
}

/** 读取 JSONL 文件所有条目 */
function readEntries(filePath) {
  if (!fs.existsSync(filePath)) return []
  return fs.readFileSync(filePath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => { try { return JSON.parse(line) } catch { return null } })
    .filter(Boolean)
}

// ── Session 生命周期 ──────────────────────────────────────────────────────────

/**
 * 获取或创建 session
 * @param {string} agentId
 * @param {string} sessionKey  如 "main:webhook:feishu:user123"
 * @param {object} deliveryContext  { channel, from, chatType }
 * @returns {{ sessionId, filePath, entry, isNew }}
 */
function getOrCreateSession(agentId, sessionKey, deliveryContext = {}) {
  const index = loadIndex(agentId)
  const existing = index[sessionKey]

  if (existing) {
    return {
      sessionId: existing.sessionId,
      filePath: sessionFilePath(agentId, existing.sessionId),
      entry: existing,
      isNew: false,
    }
  }

  // 新建 session
  const sessionId = randomUUID()
  const filePath  = sessionFilePath(agentId, sessionId)
  const now       = new Date().toISOString()

  // 写入 session 头条目
  appendEntry(filePath, {
    type: 'session',
    id:   sessionId,
    timestamp: now,
    agentId,
    sessionKey,
    deliveryContext,
  })

  const entry = {
    sessionId,
    updatedAt:       Date.now(),
    systemSent:      false,
    deliveryContext,
    messageCount:    0,
    sessionFile:     filePath,
  }

  index[sessionKey] = entry
  saveIndex(agentId, index)

  return { sessionId, filePath, entry, isNew: true }
}

// ── 上下文重建（从 parentId 链回溯） ─────────────────────────────────────────

/**
 * 从 JSONL 重建 messages[] 用于 LLM 调用
 * 简单实现：按时间顺序取 message 条目，忽略 parentId 分支
 * @param {string} filePath
 * @param {number} maxTokensEstimate  超过此字符数时截断旧消息
 * @returns {Array<{role, content}>}
 */
function buildContextMessages(filePath, maxTokensEstimate = 60000) {
  const entries = readEntries(filePath)
  const messages = entries
    .filter(e => e.type === 'message')
    .map(e => ({
      role:    e.message?.role,
      content: extractText(e.message?.content),
      id:      e.id,
    }))
    .filter(m => m.role && m.content)

  // 粗略按字符数截断（避免超出 context window）
  let totalChars = 0
  const kept = []
  for (let i = messages.length - 1; i >= 0; i--) {
    totalChars += messages[i].content.length
    if (totalChars > maxTokensEstimate && kept.length > 2) break
    kept.unshift(messages[i])
  }
  return kept.map(m => ({ role: m.role, content: m.content }))
}

function extractText(content) {
  if (!content) return ''
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content.filter(c => c.type === 'text').map(c => c.text || '').join('')
  }
  return ''
}

// ── 核心：发送消息 + 流式 LLM + 写回 JSONL ──────────────────────────────────

/**
 * 发送用户消息并获取 AI 回复
 * @param {object} opts
 *   agentId       Agent 标识
 *   sessionKey    会话键
 *   userText      用户消息文本
 *   systemPrompt  系统提示（首次发送）
 *   deliveryCtx   渠道上下文
 *   tier          'T0'|'T1'|'T2'，默认 T1
 *   onToken       (token: string) => void  流式 token 回调
 *   onDone        (result: {text, usage}) => void
 *   onError       (err: Error) => void
 */
async function sendMessage(opts) {
  const {
    agentId      = 'main',
    sessionKey,
    userText,
    systemPrompt = '',
    deliveryCtx  = {},
    tier         = 'T1',
    onToken      = () => {},
    onDone       = () => {},
    onError      = () => {},
  } = opts

  const { sessionId, filePath, entry } = getOrCreateSession(agentId, sessionKey, deliveryCtx)

  // 写入 user message 条目
  const userMsgId  = randomUUID().slice(0, 8)
  const entries    = readEntries(filePath)
  const lastEntry  = entries.filter(e => e.id).pop()
  const parentId   = lastEntry?.id || null

  appendEntry(filePath, {
    type:      'message',
    id:        userMsgId,
    parentId,
    timestamp: new Date().toISOString(),
    message: {
      role:    'user',
      content: [{ type: 'text', text: userText }],
      timestamp: new Date().toISOString(),
    },
  })

  // 重建上下文
  const contextMessages = buildContextMessages(filePath)

  // 确定是否需要注入 system prompt
  const index  = loadIndex(agentId)
  const useSystem = !index[sessionKey]?.systemSent && systemPrompt
  if (useSystem) {
    index[sessionKey].systemSent = true
    saveIndex(agentId, index)
  }

  // LLM 调用
  const { client, model } = getClientForTier(tier)
  let fullText = ''

  try {
    const stream = client.messages.stream({
      model,
      max_tokens: DEFAULT_MAX_TOKENS,
      system: useSystem ? systemPrompt : undefined,
      messages: contextMessages,
    })

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
        const token = chunk.delta.text
        fullText += token
        onToken(token)
      }
    }

    const finalMsg = await stream.finalMessage()
    const usage    = finalMsg.usage || {}

    // 写入 assistant message 条目
    const asstMsgId = randomUUID().slice(0, 8)
    appendEntry(filePath, {
      type:      'message',
      id:        asstMsgId,
      parentId:  userMsgId,
      timestamp: new Date().toISOString(),
      message: {
        role:      'assistant',
        content:   [{ type: 'text', text: fullText }],
        model,
        provider:  tier,
        usage: {
          input:  usage.input_tokens  || 0,
          output: usage.output_tokens || 0,
        },
        stopReason: finalMsg.stop_reason,
        timestamp:  new Date().toISOString(),
      },
    })

    // 更新索引
    const idx = loadIndex(agentId)
    if (idx[sessionKey]) {
      idx[sessionKey].updatedAt    = Date.now()
      idx[sessionKey].messageCount = (idx[sessionKey].messageCount || 0) + 2
      idx[sessionKey].lastModel    = model
    }
    saveIndex(agentId, idx)

    onDone({ text: fullText, usage })
    return { ok: true, text: fullText, sessionId }

  } catch (err) {
    console.error(`[session-engine] LLM error: ${err.message}`)
    onError(err)
    return { ok: false, error: err.message, sessionId }
  }
}

// ── 查询接口 ──────────────────────────────────────────────────────────────────

/** 列出某 agent 的所有 session 摘要 */
function listSessions(agentId) {
  const index = loadIndex(agentId)
  return Object.entries(index).map(([key, entry]) => ({
    sessionKey: key,
    ...entry,
  })).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
}

/** 读取某 session 的完整消息列表 */
function getSessionMessages(agentId, sessionId) {
  const filePath = sessionFilePath(agentId, sessionId)
  const entries  = readEntries(filePath)
  return {
    sessionId,
    messages: entries.filter(e => e.type === 'message').map(e => ({
      id:        e.id,
      parentId:  e.parentId,
      timestamp: e.timestamp,
      role:      e.message?.role,
      content:   extractText(e.message?.content),
      model:     e.message?.model,
      usage:     e.message?.usage,
    })),
    meta: entries.find(e => e.type === 'session'),
  }
}

/** 重置 session（新建文件，保留 sessionKey） */
function resetSession(agentId, sessionKey) {
  const index = loadIndex(agentId)
  const existing = index[sessionKey]
  if (existing) {
    const oldPath = sessionFilePath(agentId, existing.sessionId)
    if (fs.existsSync(oldPath)) {
      fs.renameSync(oldPath, oldPath + `.reset.${new Date().toISOString().replace(/[:.]/g, '-')}`)
    }
    delete index[sessionKey]
    saveIndex(agentId, index)
  }
}

module.exports = {
  sendMessage,
  getOrCreateSession,
  listSessions,
  getSessionMessages,
  resetSession,
  buildContextMessages,
  DATA_ROOT,
}
