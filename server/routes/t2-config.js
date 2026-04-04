/**
 * server/routes/t2-config.js
 * T2 Agent 配置 CRUD — 基于 server/config/t2-agents.json
 *
 * GET    /api/t2-config          → 所有配置项
 * POST   /api/t2-config          → 新建 { tmux_session, sphere, workdir, default_model? }
 * PATCH  /api/t2-config/:id      → 更新字段
 * DELETE /api/t2-config/:id      → 删除
 */

'use strict'

const express = require('express')
const router  = express.Router()
const fs      = require('fs')
const path    = require('path')

const CONFIG_PATH = path.resolve(__dirname, '../config/t2-agents.json')

function read() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) }
  catch { return [] }
}

function write(data) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2) + '\n', 'utf-8')
}

// GET /api/t2-config
router.get('/t2-config', (_req, res) => {
  res.json(read())
})

// POST /api/t2-config
router.post('/t2-config', (req, res) => {
  const { tmux_session, sphere, workdir, default_model = 'claude-sonnet-4-6', active = true } = req.body
  if (!tmux_session || !sphere || !workdir) {
    return res.status(400).json({ error: 'tmux_session, sphere, workdir 必填' })
  }
  const data = read()
  if (data.some(e => e.tmux_session === tmux_session && e.sphere === sphere)) {
    return res.status(409).json({ error: 'tmux_session + sphere 组合已存在' })
  }
  const entry = { id: Date.now(), tmux_session, sphere, workdir, default_model, active }
  data.push(entry)
  write(data)
  try { require('../lib/code-agent').reloadConfig() } catch { /* ignore */ }
  res.status(201).json(entry)
})

// PATCH /api/t2-config/:id
router.patch('/t2-config/:id', (req, res) => {
  const id = parseInt(req.params.id)
  const data = read()
  const idx = data.findIndex(e => e.id === id)
  if (idx === -1) return res.status(404).json({ error: '未找到' })

  const { tmux_session, sphere, workdir, default_model, active } = req.body
  const next = { ...data[idx] }
  if (tmux_session !== undefined) next.tmux_session = tmux_session
  if (sphere       !== undefined) next.sphere        = sphere
  if (workdir      !== undefined) next.workdir       = workdir
  if (default_model !== undefined) next.default_model = default_model
  if (active       !== undefined) next.active        = active

  // 唯一性检查
  if (data.some((e, i) => i !== idx && e.tmux_session === next.tmux_session && e.sphere === next.sphere)) {
    return res.status(409).json({ error: 'tmux_session + sphere 组合已存在' })
  }

  data[idx] = next
  write(data)
  try { require('../lib/code-agent').reloadConfig() } catch { /* ignore */ }
  res.json(next)
})

// DELETE /api/t2-config/:id
router.delete('/t2-config/:id', (req, res) => {
  const id = parseInt(req.params.id)
  const data = read()
  const idx = data.findIndex(e => e.id === id)
  if (idx === -1) return res.status(404).json({ error: '未找到' })
  data.splice(idx, 1)
  write(data)
  try { require('../lib/code-agent').reloadConfig() } catch { /* ignore */ }
  res.json({ ok: true })
})

module.exports = router
