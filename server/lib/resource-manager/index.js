/**
 * resource-manager/index.js
 *
 * 底层资源管理 — 纯硬件资源探测 + 动态分配决策
 *
 * 不知道 AI 调用细节，不知道 tmux/pty 细节。
 * 只回答"机器有多少资源"和"还能分配多少"。
 *
 * 消费者：ai-service、harness-manager
 */

'use strict'

const platform = require('./platform')
const allocator = require('./allocator')

module.exports = { platform, allocator }
