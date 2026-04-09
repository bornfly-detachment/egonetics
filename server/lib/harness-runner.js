/**
 * server/lib/harness-runner.js
 *
 * 薄适配器 — 委托给 harness-manager/runner.js
 * 所有消费者（free-code-ws / routes/free-code）无需改 import。
 */
'use strict'
module.exports = require('./harness-manager/runner')
