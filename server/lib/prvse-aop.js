/**
 * server/lib/prvse-aop.js
 * PRVSE AOP Pipeline — Pattern 三问自动分类引擎
 *
 * 流程：
 *   1. 从 tag-tree.json 加载标签树（不写死枚举）
 *   2. T0 本地模型 → 三问链式标签候选
 *   3. T1 模型二次校验 → 验证 or 标记冲突
 *   4. 冲突 → needs_human_review = true，等人工打标
 *   5. 宪法路由 → where_tags 匹配 hm_protocol 规则节点 → 确定去哪
 *   6. 结果写回 prvse_classifications
 */

const { createLLMEngine } = require('./llm-engine')
const { readTree, flattenTree, findById } = require('../routes/tags')

// ── 从 JSON 文件加载完整 tag 树（扁平 + 树形两份）────────────────────

function loadTagTree() {
  const tree = readTree()
  const flat = []
  for (const key of ['P', 'R', 'V', 'S', 'E']) {
    if (tree[key]) flattenTree(tree[key], 0, flat)
  }
  // 构建 id→node map
  const map = {}
  for (const item of flat) map[item.id] = item
  return Promise.resolve({ flat, tree: [tree.P, tree.R, tree.V, tree.S, tree.E], map })
}

// ── 扁平化 tag 树为 prompt 可读格式 ──────────────────────────────────

function flattenForPrompt(nodes, depth = 0, lines = []) {
  for (const node of nodes) {
    lines.push(`${'  '.repeat(depth)}- [${node.id}] ${node.name}${node.select_mode === 'single' ? ' (单选)' : ''}`)
    if (node.children?.length) flattenForPrompt(node.children, depth + 1, lines)
  }
  return lines.join('\n')
}

// ── 加载 hm_protocol 规则（宪法路由用）──────────────────────────────

function loadProtocolRules(pagesDb) {
  return new Promise((resolve, reject) => {
    pagesDb.all(
      'SELECT id, category, layer, human_char, machine_lang, anchor_tag_id FROM hm_protocol ORDER BY sort_order',
      [],
      (err, rows) => {
        if (err) return reject(err)
        resolve(rows || [])
      }
    )
  })
}

// ── T0：本地模型三问分类 ──────────────────────────────────────────────

async function t0Classify(content, tagTreeText, sourceMeta) {
  const { client, model } = getClientForTier('T0')

  const systemPrompt = `你是 PRVSE 三问分类器（T0 感知层）。
给定内容，从提供的标签树中选择标签，完成三问分类。
输出格式必须是合法 JSON，不要添加任何多余文字。`

  const userPrompt = `## 内容
${content.slice(0, 2000)}

## 来源元信息
${JSON.stringify(sourceMeta, null, 2)}

## 可用标签树
${tagTreeText}

## 输出要求
选择对应标签 ID（只能从上方标签树中选，不可自造）：
{
  "from_tags": ["tag-id", ...],   // 从哪来：信息来源标签
  "what_tags": ["tag-id", ...],   // 是什么：性质/属性标签
  "where_tags": ["tag-id", ...],  // 去哪里：目标/功能标签（可能为空，待宪法路由后填充）
  "confidence": 0.0~1.0,
  "reasoning": "简要说明分类依据"
}`

  try {
    const msg = await client.messages.create({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })
    const text = msg.content?.[0]?.text ?? '{}'
    // 提取 JSON（T0 可能输出带注释的文本）
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('T0 返回非 JSON: ' + text.slice(0, 200))
    return { ok: true, result: JSON.parse(jsonMatch[0]), model }
  } catch (err) {
    return { ok: false, error: err.message, result: null, model }
  }
}

// ── T1：校验 T0 输出 ──────────────────────────────────────────────────

async function t1Verify(content, t0Result, tagTreeText) {
  const { client, model } = getClientForTier('T1')

  const systemPrompt = `你是 PRVSE 三问分类校验器（T1 校验层）。
验证 T0 模型的分类是否正确，指出错误或冲突。
输出合法 JSON，不要多余文字。`

  const userPrompt = `## 原始内容
${content.slice(0, 2000)}

## T0 分类结果
${JSON.stringify(t0Result, null, 2)}

## 可用标签树
${tagTreeText}

## 验证要求
{
  "verified": true/false,
  "corrections": {           // 仅 verified=false 时填写
    "from_tags": [...],      // 修正后的标签（null 表示无修正）
    "what_tags": [...],
    "where_tags": [...]
  },
  "conflicts": ["冲突原因1", ...],  // 存在冲突时填写
  "confidence": 0.0~1.0,
  "reasoning": "说明"
}`

  try {
    const msg = await client.messages.create({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })
    const text = msg.content?.[0]?.text ?? '{}'
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('T1 返回非 JSON')
    return { ok: true, result: JSON.parse(jsonMatch[0]), model }
  } catch (err) {
    return { ok: false, error: err.message, result: null, model }
  }
}

// ── 宪法路由：where_tags → hm_protocol 规则节点 ──────────────────────

function routeConstitution(whereTags, protocolRules, tagMap) {
  if (!whereTags?.length) return { routes: [], unmatched: true }

  const routes = []

  for (const rule of protocolRules) {
    if (!rule.anchor_tag_id) continue
    // anchor_tag_id 命中 where_tags 中任意一个，或其祖先链命中
    if (whereTags.includes(rule.anchor_tag_id)) {
      routes.push({
        rule_id:    rule.id,
        category:  rule.category,
        layer:     rule.layer,
        label:     rule.human_char,
        anchor:    rule.anchor_tag_id,
        match:     'direct',
      })
    } else {
      // 检查 where_tag 是否是 anchor 的子节点
      for (const wt of whereTags) {
        if (isDescendant(tagMap, wt, rule.anchor_tag_id)) {
          routes.push({
            rule_id:   rule.id,
            category: rule.category,
            layer:    rule.layer,
            label:    rule.human_char,
            anchor:   rule.anchor_tag_id,
            match:    'descendant',
          })
          break
        }
      }
    }
  }

  return { routes, unmatched: routes.length === 0 }
}

function isDescendant(tagMap, nodeId, ancestorId) {
  let current = tagMap[nodeId]
  while (current) {
    if (current.parent_id === ancestorId) return true
    current = tagMap[current.parent_id]
  }
  return false
}

// ── 写回 DB ──────────────────────────────────────────────────────────

function saveAopResult(pagesDb, entityId, entityType, data) {
  return new Promise((resolve, reject) => {
    const {
      layer = '', from_tags = [], what_tags = [], where_tags = [],
      from_text = '', what_text = '', where_text = '',
      aop_status, source_meta, t0_result, t1_result,
      conflicts = [], constitution_route = {},
      needs_human_review = false,
    } = data

    pagesDb.run(
      `INSERT INTO prvse_classifications
         (entity_id, entity_type, layer,
          from_tags, what_tags, where_tags,
          from_text, what_text, where_text,
          aop_status, source_meta, t0_result, t1_result,
          conflicts, constitution_route,
          needs_human_review, aop_ran_at, updated_at)
       VALUES (?,?,?, ?,?,?, ?,?,?, ?,?,?,?, ?,?, ?, datetime('now'), datetime('now'))
       ON CONFLICT(entity_id, entity_type) DO UPDATE SET
         layer=excluded.layer,
         from_tags=excluded.from_tags, what_tags=excluded.what_tags, where_tags=excluded.where_tags,
         from_text=excluded.from_text, what_text=excluded.what_text, where_text=excluded.where_text,
         aop_status=excluded.aop_status,
         source_meta=excluded.source_meta,
         t0_result=excluded.t0_result,
         t1_result=excluded.t1_result,
         conflicts=excluded.conflicts,
         constitution_route=excluded.constitution_route,
         needs_human_review=excluded.needs_human_review,
         aop_ran_at=excluded.aop_ran_at,
         updated_at=excluded.updated_at`,
      [
        entityId, entityType, layer,
        JSON.stringify(from_tags), JSON.stringify(what_tags), JSON.stringify(where_tags),
        from_text, what_text, where_text,
        aop_status,
        JSON.stringify(source_meta),
        JSON.stringify(t0_result),
        JSON.stringify(t1_result),
        JSON.stringify(conflicts),
        JSON.stringify(constitution_route),
        needs_human_review ? 1 : 0,
      ],
      function(err) {
        if (err) return reject(err)
        resolve({ ok: true })
      }
    )
  })
}

// ── 主入口：runAOP ────────────────────────────────────────────────────

/**
 * @param {object} pagesDb   - pages.db 连接
 * @param {object} opts
 *   entityId    - block/task/node 的 ID
 *   entityType  - 'block' | 'task_component' | ...
 *   content     - 主要文本内容
 *   sourceMeta  - 元信息 { type, author?, model?, url?, timestamp }（由调用方感知，不写死）
 *   layer       - 'P' | 'R' | 'V' | 'S'（默认 'P'）
 */
async function runAOP(pagesDb, opts) {
  const {
    entityId,
    entityType,
    content = '',
    sourceMeta = {},
    layer = 'P',
  } = opts

  if (!entityId || !entityType) throw new Error('entityId and entityType required')

  // 1. 标记为运行中
  await saveAopResult(pagesDb, entityId, entityType, {
    layer,
    source_meta: sourceMeta,
    aop_status: 'running',
  })

  try {
    // 2. 加载活的标签树
    const { flat, tree, map } = await loadTagTree(pagesDb)
    const tagTreeText = flattenForPrompt(tree)

    // 3. 加载宪法规则
    const protocolRules = await loadProtocolRules(pagesDb)

    // 4. T0 分类
    const t0 = await t0Classify(content, tagTreeText, sourceMeta)
    if (!t0.ok || !t0.result) {
      // T0 失败 → 降级到人工打标
      await saveAopResult(pagesDb, entityId, entityType, {
        layer,
        source_meta: sourceMeta,
        t0_result: { error: t0.error },
        aop_status: 'needs_human_review',
        needs_human_review: true,
        conflicts: [`T0 分类失败: ${t0.error}`],
      })
      return { ok: false, status: 'needs_human_review', reason: 't0_failed' }
    }

    const t0r = t0.result
    const fromTags  = Array.isArray(t0r.from_tags)  ? t0r.from_tags.filter(id => map[id])  : []
    const whatTags  = Array.isArray(t0r.what_tags)  ? t0r.what_tags.filter(id => map[id])  : []
    const whereTags = Array.isArray(t0r.where_tags) ? t0r.where_tags.filter(id => map[id]) : []

    // 5. T1 校验
    const t1 = await t1Verify(content, t0r, tagTreeText)
    let finalFrom  = fromTags
    let finalWhat  = whatTags
    let finalWhere = whereTags
    let conflicts  = []
    let needsHuman = false

    if (t1.ok && t1.result) {
      const t1r = t1.result
      if (!t1r.verified) {
        // T1 发现问题
        if (t1r.conflicts?.length) {
          conflicts = t1r.conflicts
          needsHuman = true  // 有冲突 → 交给人
        } else if (t1r.corrections) {
          // T1 给出修正，采用修正结果
          if (t1r.corrections.from_tags)  finalFrom  = t1r.corrections.from_tags.filter(id => map[id])
          if (t1r.corrections.what_tags)  finalWhat  = t1r.corrections.what_tags.filter(id => map[id])
          if (t1r.corrections.where_tags) finalWhere = t1r.corrections.where_tags.filter(id => map[id])
        }
      }
    }

    // 6. 宪法路由（即使 needsHuman=true 也预计算，供参考）
    const { routes, unmatched } = routeConstitution(finalWhere, protocolRules, map)
    const constitutionRoute = { routes, unmatched, routed_at: new Date().toISOString() }

    // 7. 确定 where_text（路由结果描述）
    const whereText = routes.length
      ? routes.map(r => `${r.category}/${r.layer}: ${r.label}`).join('; ')
      : ''

    // 8. 获取标签名称作为 text 摘要
    const fromText  = finalFrom.map(id  => map[id]?.name ?? id).join(', ')
    const whatText  = finalWhat.map(id  => map[id]?.name ?? id).join(', ')

    const finalStatus = needsHuman ? 'needs_human_review' : 'complete'

    await saveAopResult(pagesDb, entityId, entityType, {
      layer,
      from_tags: finalFrom,
      what_tags: finalWhat,
      where_tags: finalWhere,
      from_text: fromText,
      what_text: whatText,
      where_text: whereText,
      source_meta: sourceMeta,
      t0_result: t0r,
      t1_result: t1.result || {},
      conflicts,
      constitution_route: constitutionRoute,
      needs_human_review: needsHuman,
      aop_status: finalStatus,
    })

    return {
      ok: true,
      status: finalStatus,
      from_tags: finalFrom,
      what_tags: finalWhat,
      where_tags: finalWhere,
      from_text: fromText,
      what_text: whatText,
      where_text: whereText,
      conflicts,
      constitution_route: constitutionRoute,
      needs_human_review: needsHuman,
    }

  } catch (err) {
    await saveAopResult(pagesDb, entityId, entityType, {
      layer,
      source_meta: sourceMeta,
      aop_status: 'error',
      conflicts: [`AOP pipeline 错误: ${err.message}`],
      needs_human_review: true,
    })
    return { ok: false, status: 'error', reason: err.message }
  }
}

module.exports = { runAOP, loadTagTree, flattenForPrompt, routeConstitution }
