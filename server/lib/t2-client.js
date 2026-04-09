/**
 * server/lib/t2-client.js
 *
 * 薄适配器 — 委托给 harness-manager/t2-spawn.js
 * 所有消费者（code-agent / routes/llm）无需改 import。
 */
'use strict'
module.exports = require('./harness-manager/t2-spawn')
