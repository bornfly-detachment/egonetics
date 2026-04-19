/**
 * routes/tags.js
 * 标签语义树 CRUD — 基于 JSON 文件 (src/kernel/compiler/tag-tree.json)
 *
 * GET    /api/tag-trees                    获取完整标签树
 * POST   /api/tag-trees/:id/children       在指定节点下新建子节点 { name, ... }
 * PATCH  /api/tag-trees/:id                更新节点字段
 * DELETE /api/tag-trees/:id                删除节点及其所有子孙
 * POST   /api/tag-trees/:id/move           移动节点 { newParentId, position }
 *
 * prvse-classifications CRUD 保持不变（独立 DB 表）
 */

const express = require('express')
const router  = express.Router()
const fs      = require('fs')
const path    = require('path')
const { pagesDb } = require('../db')

// ── YAML 文件路径（workspace — Git 跟踪，T0/T1/T2 均可读） ──
const yaml = require('js-yaml')
const WORKSPACE = process.env.EGONETICS_WORKSPACE || '/Users/Shared/prvse_world_workspace'
const TAG_TREE_PATH = path.join(WORKSPACE, 'chronicle', 'tag-tree.yaml')
// Legacy JSON path — kept in sync for backward compatibility
const TAG_TREE_JSON_LEGACY = path.resolve(__dirname, '../../src/kernel/compiler/tag-tree.json')

// ── 内存缓存 + 读写 ──────────────────────────────────────────
let _cache = null
let _cacheMtime = 0

function readTree() {
  try {
    const stat = fs.statSync(TAG_TREE_PATH)
    if (_cache && stat.mtimeMs === _cacheMtime) return _cache
    const raw = fs.readFileSync(TAG_TREE_PATH, 'utf-8')
    _cache = yaml.load(raw)
    _cacheMtime = stat.mtimeMs
    return _cache
  } catch {
    // Fallback: try legacy JSON
    const raw = fs.readFileSync(TAG_TREE_JSON_LEGACY, 'utf-8')
    return JSON.parse(raw)
  }
}

function writeTree(tree) {
  _cache = tree
  _cacheMtime = Date.now()
  // Write YAML (primary)
  fs.writeFileSync(TAG_TREE_PATH, yaml.dump(tree, { lineWidth: 120, noRefs: true }), 'utf-8')
  // Write legacy JSON (backward compat for frontend imports)
  fs.writeFileSync(TAG_TREE_JSON_LEGACY, JSON.stringify(tree, null, 2) + '\n', 'utf-8')
}

// ── 递归查找/遍历 ─────────────────────────────────────────────

/**
 * 在嵌套 JSON 中按 id 查找节点。
 * 返回 { node, parent, key } 或 null。
 * parent 是包含该节点的对象/数组，key 是在 parent 中的键/索引。
 */
function findById(obj, targetId, parent = null, key = null) {
  if (obj == null || typeof obj !== 'object') return null

  // 当前对象本身有 id 匹配
  if (obj.id === targetId) return { node: obj, parent, key }

  // 遍历 children（数组或对象）
  if (Array.isArray(obj.children)) {
    for (let i = 0; i < obj.children.length; i++) {
      const found = findById(obj.children[i], targetId, obj.children, i)
      if (found) return found
    }
  } else if (obj.children && typeof obj.children === 'object') {
    for (const k of Object.keys(obj.children)) {
      const found = findById(obj.children[k], targetId, obj.children, k)
      if (found) return found
    }
  }

  // 遍历顶层 PRVSE 键
  for (const k of Object.keys(obj)) {
    if (k.startsWith('$') || k === 'id' || k === 'name' || k === 'description' ||
        k === 'children' || k === 'select_mode' || k === 'color') continue
    const val = obj[k]
    if (val && typeof val === 'object') {
      const found = findById(val, targetId, obj, k)
      if (found) return found
    }
  }

  return null
}

/**
 * 收集节点及所有子孙的 ID 列表。
 */
function collectDescendantIds(node) {
  const ids = []
  if (node.id) ids.push(node.id)
  if (Array.isArray(node.children)) {
    for (const child of node.children) ids.push(...collectDescendantIds(child))
  } else if (node.children && typeof node.children === 'object') {
    for (const child of Object.values(node.children)) {
      if (child && typeof child === 'object') ids.push(...collectDescendantIds(child))
    }
  }
  return ids
}

/**
 * 将嵌套 JSON 展开为扁平数组（供 API 返回和 prompt 使用）。
 */
function flattenTree(obj, depth = 0, result = []) {
  if (obj == null || typeof obj !== 'object') return result
  if (obj.id) {
    result.push({
      id: obj.id,
      name: obj.name || '',
      description: obj.description || '',
      select_mode: obj.select_mode || 'multi',
      depth,
    })
  }
  if (Array.isArray(obj.children)) {
    for (const child of obj.children) flattenTree(child, depth + 1, result)
  } else if (obj.children && typeof obj.children === 'object') {
    for (const child of Object.values(obj.children)) {
      if (child && typeof child === 'object') flattenTree(child, depth + 1, result)
    }
  }
  return result
}

/**
 * 将 JSON 树节点转换为前端 TagNode 格式 {id, name, color, select_mode, children}
 */
function toTagNode(obj) {
  if (!obj || typeof obj !== 'object' || !obj.id) return null
  const node = {
    id: obj.id,
    name: obj.name || '',
    color: obj.color || '#6b7280',
    select_mode: obj.select_mode || 'multi',
  }
  const kids = []
  if (Array.isArray(obj.children)) {
    for (const child of obj.children) {
      const c = toTagNode(child)
      if (c) kids.push(c)
    }
  } else if (obj.children && typeof obj.children === 'object') {
    for (const child of Object.values(obj.children)) {
      const c = toTagNode(child)
      if (c) kids.push(c)
    }
  }
  if (kids.length) node.children = kids
  return node
}

function genId() {
  return `tag-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

// ── scope 过滤 + classify 辅助 ────────────────────────────────

/** 递归过滤：只保留 scope 包含指定级别的节点（按 name 中的 L0/L1/L2 推断） */
function filterByScope(node, scope) {
  if (!node) return null
  // 检查节点名称是否包含目标 scope 级别
  const nameHasScope = node.name && (
    node.name.includes(scope) ||
    node.name.includes('L0') && scope === 'L0' ||
    node.name.includes('L1') && scope === 'L1' ||
    node.name.includes('L2') && scope === 'L2'
  )
  // 递归过滤子节点
  const filteredChildren = (node.children || [])
    .map(c => filterByScope(c, scope))
    .filter(Boolean)
  // 保留：自身匹配 OR 有匹配的子节点 OR 是根/分类节点
  if (nameHasScope || filteredChildren.length > 0) {
    return { ...node, children: filteredChildren.length ? filteredChildren : undefined }
  }
  return null
}

/** 收集标签树为 {id, name, path} 扁平列表，供 classify prompt 使用 */
function collectClassifyTags(node, parentPath, result) {
  if (!node) return
  const myPath = parentPath ? `${parentPath} > ${node.name}` : node.name
  if (node.id) result.push({ id: node.id, name: node.name, path: myPath })
  for (const child of node.children || []) {
    collectClassifyTags(child, myPath, result)
  }
}

// ── 路由 ──────────────────────────────────────────────────────

// GET /api/tag-trees — 返回 TagNode[] 格式（前端兼容）
// ?scope=L0|L1|L2 — 按级别过滤（只返回 scope 包含该级别的节点）
// ?for=classify — 返回精简版供 AI 分类 prompt 使用
router.get('/tag-trees', (req, res) => {
  try {
    const tree = readTree()
    const roots = []
    for (const key of ['P', 'R', 'V', 'S', 'E', 'cybernetic_feedback_loop']) {
      if (tree[key]) {
        const node = toTagNode(tree[key])
        if (node) roots.push(node)
      }
    }

    // scope 过滤：只返回 scope 字段包含指定级别的节点
    const scope = req.query.scope
    if (scope) {
      const filtered = roots.map(r => filterByScope(r, scope)).filter(Boolean)
      return res.json(filtered)
    }

    // for=classify：返回精简的 {id, name, path} 列表供 prompt 生成
    if (req.query.for === 'classify') {
      const flat = []
      for (const root of roots) {
        collectClassifyTags(root, '', flat)
      }
      return res.json(flat)
    }

    res.json(roots)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/tag-trees/raw — 返回原始 JSON 树（编译器/内核使用）
router.get('/tag-trees/raw', (_req, res) => {
  try {
    res.json(readTree())
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/tag-trees/flat — 返回扁平数组（供 prompt / 搜索使用）
router.get('/tag-trees/flat', (_req, res) => {
  try {
    const tree = readTree()
    const flat = []
    for (const key of ['P', 'R', 'V', 'S', 'E']) {
      if (tree[key]) flattenTree(tree[key], 0, flat)
    }
    res.json(flat)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/tag-trees/:id/children — 在指定节点下新建子节点
router.post('/tag-trees/:id/children', (req, res) => {
  const parentId = req.params.id
  const { name, id: customId, description, select_mode } = req.body
  if (!name) return res.status(400).json({ error: 'name is required' })

  try {
    const tree = readTree()
    const found = findById(tree, parentId)
    if (!found) return res.status(404).json({ error: 'parent not found' })

    const newNode = { id: customId || genId(), name }
    if (description) newNode.description = description
    if (select_mode) newNode.select_mode = select_mode

    const parent = found.node
    if (Array.isArray(parent.children)) {
      parent.children.push(newNode)
    } else if (parent.children && typeof parent.children === 'object') {
      // object children — use id as key
      parent.children[newNode.id] = newNode
    } else {
      // no children yet — create array
      parent.children = [newNode]
    }

    writeTree(tree)
    res.status(201).json(newNode)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/tag-trees/:id — 更新节点字段
router.patch('/tag-trees/:id', (req, res) => {
  const { name, description, select_mode } = req.body
  if (name === undefined && description === undefined && select_mode === undefined) {
    return res.status(400).json({ error: 'nothing to update' })
  }

  try {
    const tree = readTree()
    const found = findById(tree, req.params.id)
    if (!found) return res.status(404).json({ error: 'tag not found' })

    const node = found.node
    if (name !== undefined) node.name = name
    if (description !== undefined) node.description = description
    if (select_mode !== undefined) node.select_mode = select_mode

    writeTree(tree)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/tag-trees/:id — 删除节点及其所有子孙
router.delete('/tag-trees/:id', (req, res) => {
  const tagId = req.params.id

  // 禁止删除 PRVSE 五大根节点
  if (['tag-p', 'tag-r', 'tag-v', 'tag-s', 'tag-e'].includes(tagId)) {
    return res.status(400).json({ error: 'cannot delete PRVSE root nodes' })
  }

  try {
    const tree = readTree()
    const found = findById(tree, tagId)
    if (!found) return res.status(404).json({ error: 'tag not found' })

    // 收集将被删除的所有 ID，检查 protocol 引用
    const allIds = collectDescendantIds(found.node)
    const placeholders = allIds.map(() => '?').join(',')

    pagesDb.all(
      `SELECT id, category, substr(human_char, 1, 60) as hc, anchor_tag_id
       FROM hm_protocol WHERE anchor_tag_id IN (${placeholders})`,
      allIds,
      (err, refs) => {
        if (err) return res.status(500).json({ error: err.message })
        if (refs && refs.length > 0) {
          return res.status(409).json({
            error: `该节点被 ${refs.length} 条协议规则引用，请先解除锚定`,
            referenced_by: refs.map(r => ({ id: r.id, category: r.category, human_char: r.hc }))
          })
        }

        // 从父容器中移除
        const { parent, key } = found
        if (Array.isArray(parent)) {
          parent.splice(key, 1)
        } else if (parent && typeof parent === 'object') {
          delete parent[key]
        }

        writeTree(tree)
        res.json({ ok: true })
      }
    )
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/tag-trees/:id/move — 移动到新父节点
router.post('/tag-trees/:id/move', (req, res) => {
  const { newParentId, position } = req.body
  const tagId = req.params.id

  if (!newParentId) return res.status(400).json({ error: 'newParentId is required' })

  try {
    const tree = readTree()

    // 找到源节点
    const source = findById(tree, tagId)
    if (!source) return res.status(404).json({ error: 'tag not found' })

    // 找到目标父节点
    const target = findById(tree, newParentId)
    if (!target) return res.status(404).json({ error: 'target parent not found' })

    // 防止移动到自身子树
    const descendantIds = collectDescendantIds(source.node)
    if (descendantIds.includes(newParentId)) {
      return res.status(400).json({ error: 'cannot move node into its own subtree' })
    }

    // 从源父容器移除
    const { parent: srcParent, key: srcKey } = source
    const detached = source.node
    if (Array.isArray(srcParent)) {
      srcParent.splice(srcKey, 1)
    } else if (srcParent && typeof srcParent === 'object') {
      delete srcParent[srcKey]
    }

    // 插入目标父节点
    const targetNode = target.node
    if (Array.isArray(targetNode.children)) {
      const pos = position != null ? Math.min(position, targetNode.children.length) : targetNode.children.length
      targetNode.children.splice(pos, 0, detached)
    } else if (targetNode.children && typeof targetNode.children === 'object') {
      targetNode.children[detached.id] = detached
    } else {
      targetNode.children = [detached]
    }

    writeTree(tree)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ══════════════════════════════════════════════════════════════
// prvse-classifications — 保持不变（独立 DB 表）
// ══════════════════════════════════════════════════════════════

// GET /api/prvse-classifications?entity_id=X&entity_type=Y
router.get('/prvse-classifications', (req, res) => {
  const { entity_id, entity_type } = req.query
  if (!entity_id || !entity_type)
    return res.status(400).json({ error: 'entity_id and entity_type are required' })
  pagesDb.get(
    'SELECT * FROM prvse_classifications WHERE entity_id = ? AND entity_type = ?',
    [entity_id, entity_type],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message })
      if (!row) return res.json(null)
      res.json({
        ...row,
        from_tags:  JSON.parse(row.from_tags  || '[]'),
        what_tags:  JSON.parse(row.what_tags  || '[]'),
        where_tags: JSON.parse(row.where_tags || '[]'),
        from_text:  row.from_text  || '',
        what_text:  row.what_text  || '',
        where_text: row.where_text || '',
      })
    }
  )
})

// PUT /api/prvse-classifications — upsert
router.put('/prvse-classifications', (req, res) => {
  const { entity_id, entity_type, layer = '', from_tags = [], what_tags = [], where_tags = [], description = '',
          from_text = '', what_text = '', where_text = '' } = req.body
  if (!entity_id || !entity_type)
    return res.status(400).json({ error: 'entity_id and entity_type are required' })
  pagesDb.run(
    `INSERT INTO prvse_classifications
       (entity_id, entity_type, layer, from_tags, what_tags, where_tags, description,
        from_text, what_text, where_text, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?, datetime('now'))
     ON CONFLICT(entity_id, entity_type) DO UPDATE SET
       layer=excluded.layer, from_tags=excluded.from_tags, what_tags=excluded.what_tags,
       where_tags=excluded.where_tags, description=excluded.description,
       from_text=excluded.from_text, what_text=excluded.what_text, where_text=excluded.where_text,
       updated_at=excluded.updated_at`,
    [entity_id, entity_type, layer,
     JSON.stringify(from_tags), JSON.stringify(what_tags), JSON.stringify(where_tags),
     description, from_text, what_text, where_text],
    function(err) {
      if (err) return res.status(500).json({ error: err.message })
      res.json({ ok: true })
    }
  )
})

module.exports = {
  init: () => router,
  // 供其他模块使用的导出
  readTree,
  findById,
  flattenTree,
  collectDescendantIds,
  TAG_TREE_PATH,
}
