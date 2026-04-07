/**
 * prvse-chronicle — PRVSE P/R/V CRUD API (file-system YAML, not DB)
 *
 * Storage: prvse_world_workspace/chronicle/{P,R,V}/*.yaml + index.json
 * Design: Git+文件为主干存储策略 (2026-04-07 宪法确认)
 *
 * Routes:
 *   GET    /api/prvse/:type              list (read index.json)
 *   GET    /api/prvse/:type/:id          detail (read YAML)
 *   POST   /api/prvse/:type              create (write YAML + update index)
 *   PATCH  /api/prvse/:type/:id          update (write YAML)
 *   DELETE /api/prvse/:type/:id          delete (remove YAML + update index)
 *   POST   /api/prvse/:type/:id/fork     fork (copy + set parentId)
 *   POST   /api/prvse/:type/:id/freeze   freeze (set frozen: true)
 */

const express = require('express')
const router = express.Router()
const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')
const crypto = require('crypto')

// Resolve workspace path (follows symlink)
const WORKSPACE = path.resolve(__dirname, '../../../prvse_world_workspace')
const CHRONICLE = path.join(WORKSPACE, 'chronicle')

const VALID_TYPES = ['P', 'R', 'V', 'S', 'E', 'constitution', 'compiler', 'physics-engine', 'kernel']

// ── Helpers ─────────────────────────────────────────────────────

function typeDir(type) {
  if (!VALID_TYPES.includes(type)) return null
  return path.join(CHRONICLE, type)
}

function indexPath(dir) {
  return path.join(dir, 'index.json')
}

function readIndex(dir) {
  const p = indexPath(dir)
  if (!fs.existsSync(p)) return []
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return [] }
}

function writeIndex(dir, entries) {
  fs.writeFileSync(indexPath(dir), JSON.stringify(entries, null, 2), 'utf8')
}

function readYaml(filePath) {
  if (!fs.existsSync(filePath)) return null
  return yaml.load(fs.readFileSync(filePath, 'utf8'))
}

function writeYaml(filePath, data) {
  fs.writeFileSync(filePath, yaml.dump(data, { lineWidth: 120, noRefs: true }), 'utf8')
}

function genId(type) {
  const short = crypto.randomBytes(4).toString('hex')
  return `${type}-${short}`
}

// ── Routes ──────────────────────────────────────────────────────

// LIST
router.get('/prvse/:type', (req, res) => {
  const dir = typeDir(req.params.type)
  if (!dir) return res.status(400).json({ error: `Invalid type: ${req.params.type}` })
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const index = readIndex(dir)
  res.json({ type: req.params.type, items: index })
})

// GET ONE
router.get('/prvse/:type/:id', (req, res) => {
  const dir = typeDir(req.params.type)
  if (!dir) return res.status(400).json({ error: `Invalid type` })
  const filePath = path.join(dir, `${req.params.id}.yaml`)
  const data = readYaml(filePath)
  if (!data) return res.status(404).json({ error: 'Not found' })
  res.json(data)
})

// CREATE
router.post('/prvse/:type', (req, res) => {
  const dir = typeDir(req.params.type)
  if (!dir) return res.status(400).json({ error: `Invalid type` })
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  const id = req.body.id || genId(req.params.type)
  const data = {
    ...req.body,
    id,
    timestamp: Date.now(),
    version: 1,
    frozen: false,
  }

  const filePath = path.join(dir, `${id}.yaml`)
  writeYaml(filePath, data)

  // Update index
  const index = readIndex(dir)
  index.push({ id, label: data.label || data.rawContent?.slice(0, 60) || id, timestamp: data.timestamp })
  writeIndex(dir, index)

  res.status(201).json(data)
})

// UPDATE
router.patch('/prvse/:type/:id', (req, res) => {
  const dir = typeDir(req.params.type)
  if (!dir) return res.status(400).json({ error: `Invalid type` })

  const filePath = path.join(dir, `${req.params.id}.yaml`)
  const existing = readYaml(filePath)
  if (!existing) return res.status(404).json({ error: 'Not found' })
  if (existing.frozen) return res.status(403).json({ error: 'Frozen — use fork instead' })

  const updated = {
    ...existing,
    ...req.body,
    id: existing.id,  // id immutable
    version: (existing.version || 1) + 1,
    timestamp: Date.now(),
  }

  writeYaml(filePath, updated)

  // Update index label
  const index = readIndex(dir)
  const entry = index.find(e => e.id === existing.id)
  if (entry) {
    entry.label = updated.label || updated.rawContent?.slice(0, 60) || entry.label
    entry.timestamp = updated.timestamp
    writeIndex(dir, index)
  }

  res.json(updated)
})

// DELETE
router.delete('/prvse/:type/:id', (req, res) => {
  const dir = typeDir(req.params.type)
  if (!dir) return res.status(400).json({ error: `Invalid type` })

  const filePath = path.join(dir, `${req.params.id}.yaml`)
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' })

  fs.unlinkSync(filePath)

  const index = readIndex(dir).filter(e => e.id !== req.params.id)
  writeIndex(dir, index)

  res.json({ deleted: req.params.id })
})

// FORK
router.post('/prvse/:type/:id/fork', (req, res) => {
  const dir = typeDir(req.params.type)
  if (!dir) return res.status(400).json({ error: `Invalid type` })

  const filePath = path.join(dir, `${req.params.id}.yaml`)
  const source = readYaml(filePath)
  if (!source) return res.status(404).json({ error: 'Not found' })

  const newId = genId(req.params.type)
  const forked = {
    ...source,
    ...req.body,  // allow overrides (e.g. different physical type)
    id: newId,
    parentId: source.id,
    version: 1,
    frozen: false,
    timestamp: Date.now(),
  }

  const newPath = path.join(dir, `${newId}.yaml`)
  writeYaml(newPath, forked)

  const index = readIndex(dir)
  index.push({ id: newId, label: forked.label || forked.rawContent?.slice(0, 60) || newId, timestamp: forked.timestamp, parentId: source.id })
  writeIndex(dir, index)

  res.status(201).json(forked)
})

// CLASSIFY — AI auto-classification via prvse-compiler lexer + tag-tree
router.post('/prvse/:type/:id/classify', async (req, res) => {
  const dir = typeDir(req.params.type)
  if (!dir) return res.status(400).json({ error: `Invalid type` })

  const filePath = path.join(dir, `${req.params.id}.yaml`)
  const existing = readYaml(filePath)
  if (!existing) return res.status(404).json({ error: 'Not found' })
  if (!existing.rawContent) return res.status(400).json({ error: 'No rawContent to classify' })

  try {
    const { _internals: { llmLex } } = require('../lib/prvse-compiler')
    const { readTree, flattenTree } = require('./tags')
    const tier = req.body.tier || 'T1'

    // Build tag-tree context for the LLM — dynamic, not hardcoded.
    // IMPORTANT: exclude origin and state tags — those are context-derived
    // metadata set by the system at creation time, NOT content-derived.
    // AI can only classify: physical, level, communication.
    const EXCLUDE_PREFIXES = ['tag-p-ori', 'tag-p-state', 'tag-p-st-']
    let tagTreeContext = ''
    try {
      const tree = readTree()
      const pTree = tree.P
      if (pTree) {
        const flat = flattenTree(pTree, 0, [])
        tagTreeContext = flat
          .filter(t => !EXCLUDE_PREFIXES.some(p => t.id.startsWith(p)))
          .map(t => `${'  '.repeat(t.depth)}[${t.id}] ${t.name}`)
          .join('\n')
      }
    } catch { /* fallback: llmLex uses its built-in prompt */ }

    const result = await llmLex(existing.rawContent, { tier, tagTreeContext })

    // Map compiler level format to PatternData format
    const levelMap = { L0_atom: 'L0', L1_molecule: 'L1', L2_gene: 'L2' }

    const classified = {
      ...existing,
      physical: { resolved: true, value: result.physical },
      level: { resolved: true, value: levelMap[result.level] || result.level },
      communication: { resolved: true, value: result.communication },
      classificationTags: result.tagIds || [],
      _classification: {
        summary: result.summary,
        infoLevel: result.infoLevel,
        relationLevel: result.relationLevel,
        tagIds: result.tagIds || [],
        meta: result._meta,
        classifiedAt: Date.now(),
        source: 'ai',
      },
      timestamp: Date.now(),
    }

    writeYaml(filePath, classified)
    res.json(classified)
  } catch (err) {
    console.error(`[prvse-chronicle] classify failed:`, err.message)
    res.status(500).json({ error: `Classification failed: ${err.message}` })
  }
})

// FREEZE
router.post('/prvse/:type/:id/freeze', (req, res) => {
  const dir = typeDir(req.params.type)
  if (!dir) return res.status(400).json({ error: `Invalid type` })

  const filePath = path.join(dir, `${req.params.id}.yaml`)
  const existing = readYaml(filePath)
  if (!existing) return res.status(404).json({ error: 'Not found' })

  const frozen = { ...existing, frozen: true, timestamp: Date.now() }
  writeYaml(filePath, frozen)

  res.json(frozen)
})

module.exports = router
