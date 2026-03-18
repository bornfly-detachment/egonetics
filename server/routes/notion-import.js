/**
 * routes/notion-import.js
 *
 * 服务端直接调 Notion API — 零 Claude 上下文消耗，完全自动化
 *
 * POST /api/notion/import
 *   Body: { notionPageUrl, taskId?, pageType? }
 *   pageType 默认 'task'，传 'theory'/'page' 可挂到不同页面树
 *
 * 核心逻辑：children-first 递归
 *   1. 拉取当前页元数据 + 所有块（自动翻页）
 *   2. 先在 DB 建页面记录
 *   3. 递归处理所有 child_page 块 → 得到子页面在 DB 中的真实 ID
 *   4. 用已知子页面 ID 转换当前页块（child_page → subpage block with subpageId）
 *   5. 保存个体 blocks
 *
 * 同时保留 notionPageToMarkdown（lib）供其他用途
 */

const https   = require('https');
const express = require('express');
const router  = express.Router();
const { genId }                   = require('../lib/graph');
const { extractNotionPageId,
        savePageToDatabase }      = require('../lib/notion-markdown-importer');

const NOTION_VERSION = '2022-06-28';

let pagesDb;

function init(dbInstances) {
  pagesDb = dbInstances.pagesDb;
  return router;
}

// ── Notion API ────────────────────────────────────────────────────────────────

function notionGet(path, token) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.notion.com',
      path: `/v1${path}`,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const data = Buffer.concat(chunks).toString('utf8');
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse: ${data.slice(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function fetchPageMeta(pageId, token) {
  const page = await notionGet(`/pages/${pageId}`, token);
  if (page.object === 'error') throw new Error(`Notion pages: ${page.message}`);
  return page;
}

/** 获取块列表，自动处理 has_more 翻页 */
async function fetchAllBlocks(blockId, token) {
  const blocks = [];
  let cursor;
  do {
    const qs = cursor ? `?page_size=100&start_cursor=${cursor}` : '?page_size=100';
    const res = await notionGet(`/blocks/${blockId}/children${qs}`, token);
    if (res.object === 'error') throw new Error(`Notion blocks: ${res.message}`);
    blocks.push(...res.results);
    cursor = res.has_more ? res.next_cursor : null;
  } while (cursor);
  return blocks;
}

/** 递归拉取子块（table 行、toggle、column — 不含 child_page） */
async function fetchBlocksWithChildren(blockId, token) {
  const blocks = await fetchAllBlocks(blockId, token);
  for (const block of blocks) {
    if (!block.has_children) continue;
    if (block.type === 'child_page' || block.type === 'child_database') continue;
    block.children = await fetchBlocksWithChildren(block.id, token);
  }
  return blocks;
}

// ── 元数据提取 ────────────────────────────────────────────────────────────────

function extractTitle(page) {
  const arr = page.properties?.title?.title || page.properties?.Name?.title || [];
  return arr.map(t => t.plain_text).join('').trim() || '无标题';
}

function extractIcon(page) {
  if (page.icon?.type === 'emoji') return page.icon.emoji;
  return '📄';
}

// ── Notion → Egonetics 块转换 ─────────────────────────────────────────────────

/** Notion rich_text → Egonetics RichTextSegment[] */
function richTextToSegments(richText) {
  if (!Array.isArray(richText)) return [{ text: '' }];
  return richText.map(rt => {
    const seg = { text: rt.plain_text || '' };
    const a = rt.annotations || {};
    if (a.bold)          seg.bold = true;
    if (a.italic)        seg.italic = true;
    if (a.underline)     seg.underline = true;
    if (a.strikethrough) seg.strikethrough = true;
    if (a.code)          seg.code = true;
    if (a.color && a.color !== 'default') seg.color = a.color;
    const href = rt.href || rt.text?.link?.url;
    if (href) seg.link = href;
    return seg;
  }).filter(s => s.text);
}

const CALLOUT_COLOR_MAP = {
  blue: 'callout_info', gray: 'callout_info', brown: 'callout_info', default: 'callout_info',
  orange: 'callout_warning', yellow: 'callout_warning', red: 'callout_warning',
  green: 'callout_success',
  purple: 'callout_tip', pink: 'callout_tip',
};

/**
 * 单个 Notion block → Egonetics block 对象（或 null 跳过）
 * childPageMap: Map<notionBlockId, egoPageId> — 用于 child_page → subpage
 * 返回数组是因为 table 会拆成多行
 */
function notionBlockToEgo(notionBlock, position, childPageMap) {
  const type = notionBlock.type;
  const data = notionBlock[type] || {};
  const rt   = data.rich_text || [];

  const base = {
    id:       genId('block'),
    parentId: null,
    position,
    metadata: {},
    collapsed: false,
  };

  switch (type) {
    case 'paragraph':
      return [{ ...base, type: 'paragraph', content: { rich_text: richTextToSegments(rt) } }];

    case 'heading_1':
      return [{ ...base, type: 'heading1', content: { rich_text: richTextToSegments(rt) } }];
    case 'heading_2':
      return [{ ...base, type: 'heading2', content: { rich_text: richTextToSegments(rt) } }];
    case 'heading_3':
      return [{ ...base, type: 'heading3', content: { rich_text: richTextToSegments(rt) } }];

    case 'bulleted_list_item':
      return [{ ...base, type: 'bullet', content: { rich_text: richTextToSegments(rt) } }];
    case 'numbered_list_item':
      return [{ ...base, type: 'numbered', content: { rich_text: richTextToSegments(rt) } }];
    case 'to_do':
      return [{ ...base, type: 'todo', content: { rich_text: richTextToSegments(rt), checked: data.checked || false } }];

    case 'code':
      return [{ ...base, type: 'code', content: { rich_text: richTextToSegments(rt), language: data.language || 'plaintext' } }];

    case 'quote':
      return [{ ...base, type: 'quote', content: { rich_text: richTextToSegments(rt) } }];

    case 'callout': {
      const color       = data.color || 'default';
      const calloutType = CALLOUT_COLOR_MAP[color] || 'callout_info';
      return [{ ...base, type: calloutType, content: { rich_text: richTextToSegments(rt), calloutIcon: data.icon?.emoji || '💡' } }];
    }

    case 'divider':
      return [{ ...base, type: 'divider', content: { rich_text: [] } }];

    case 'image': {
      const url = data.external?.url || data.file?.url || '';
      return [{ ...base, type: 'image', content: { rich_text: richTextToSegments(data.caption || []), url } }];
    }

    case 'bookmark':
    case 'link_preview': {
      const url = data.url || '';
      return [{ ...base, type: 'bookmark', content: { url, rich_text: [{ text: url }] } }];
    }

    case 'table': {
      // 表格：转为 markdown code block（格式复杂，保持可读性）
      const rows   = notionBlock.children || [];
      const width  = data.table_width || 0;
      const hasHdr = data.has_column_header !== false;
      let md = '';
      rows.forEach((row, i) => {
        const cells = (row.table_row?.cells || []).map(cell =>
          cell.map(t => t.plain_text || '').join('').replace(/\|/g, '\\|')
        );
        while (cells.length < width) cells.push('');
        md += `| ${cells.join(' | ')} |\n`;
        if (hasHdr && i === 0) md += `| ${cells.map(() => '---').join(' | ')} |\n`;
      });
      return [{ ...base, type: 'code', content: { rich_text: [{ text: md.trim() }], language: 'markdown' } }];
    }

    case 'child_page': {
      // 用 childPageMap 查真实 pages.db ID + 从页面元数据获取的完整标题和图标
      const childInfo = childPageMap.get(notionBlock.id);
      return [{
        ...base,
        type: 'subpage',
        content: {
          rich_text:    [],
          subpageId:    childInfo?.pageId || '',
          subpageTitle: childInfo?.title || data.title || '子页面',
          subpageIcon:  childInfo?.icon  || '📄',
        },
      }];
    }

    case 'child_database':
      return [{ ...base, type: 'paragraph', content: { rich_text: [{ text: `🗄 [数据库: ${data.title || ''}]` }] } }];

    case 'column_list':
    case 'column':
      // 列布局：子块由 has_children 处理，容器本身不渲染
      return [];

    default:
      if (rt.length > 0) {
        return [{ ...base, type: 'paragraph', content: { rich_text: richTextToSegments(rt) } }];
      }
      return [];
  }
}

/**
 * Notion 块数组 → Egonetics 块数组
 * 递归处理 has_children（column/toggle 等），child_page 用 childPageMap
 */
function notionBlocksToEgo(notionBlocks, childPageMap, startPos = 1) {
  const result = [];
  let pos = startPos;

  for (const nb of notionBlocks) {
    const egoBlocks = notionBlockToEgo(nb, pos, childPageMap);
    if (egoBlocks.length === 0) continue;

    result.push(...egoBlocks);
    pos += egoBlocks.length;

    // 递归处理子块（非 child_page）
    if (nb.children?.length && nb.type !== 'child_page') {
      const childEgo = notionBlocksToEgo(nb.children, childPageMap, pos);
      // 设置 parentId = 当前块 id
      const parentId = egoBlocks[0].id;
      childEgo.forEach(b => { if (!b.parentId) b.parentId = parentId; });
      result.push(...childEgo);
      pos += childEgo.length;
    }
  }

  return result;
}

// ── DB ────────────────────────────────────────────────────────────────────────

function dbGet(db, sql, params = []) {
  return new Promise((resolve, reject) =>
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)))
  );
}

function dbRun(db, sql, params = []) {
  return new Promise((resolve, reject) =>
    db.run(sql, params, (err) => (err ? reject(err) : resolve()))
  );
}

async function saveEgoBlocks(pageId, egoBlocks) {
  await dbRun(pagesDb, 'DELETE FROM blocks WHERE page_id = ?', [pageId]);
  for (const b of egoBlocks) {
    try {
      await dbRun(pagesDb,
        `INSERT INTO blocks (id, page_id, parent_id, type, content, position, metadata, collapsed)
         VALUES (?, ?, ?, ?, ?, ?, '{}', 0)`,
        [b.id, pageId, b.parentId || null, b.type, JSON.stringify(b.content), b.position]);
    } catch (err) {
      console.error('[notion-import] block INSERT FAILED', { blockId: b.id, pageId, parentId: b.parentId, type: b.type }, err.message);
      throw err;
    }
  }
}

// ── 核心递归（children-first） ────────────────────────────────────────────────

/**
 * ctx: { taskId, rootPageType, imported[], errors[], log }
 */
async function importPage(notionPageId, { parentPageId, position }, ctx) {
  // 1. 拉取元数据
  const pageMeta = await fetchPageMeta(notionPageId, ctx.token);
  let title      = extractTitle(pageMeta);
  const icon     = extractIcon(pageMeta);
  ctx.log(`  导入: ${title}`);

  // 2. 拉取所有块（自动翻页 + 子块）
  const notionBlocks = await fetchBlocksWithChildren(notionPageId, ctx.token);

  // 4. 建页面记录 ID（需在步骤3前生成）
  const pageId = genId('page');

  // 3. 根页面且无 taskId → 直接在 pagesDb 建 task 页
  if (!parentPageId && !ctx.taskId) {
    ctx.taskId = pageId; // task ID = 根页面 ID
    ctx.log(`  建立 Task Page: ${title} (${pageId})`);
  }

  // Title dedup
  const existingPage = await new Promise((resolve) =>
    pagesDb.get(
      parentPageId
        ? 'SELECT id FROM pages WHERE parent_id = ? AND title = ?'
        : 'SELECT id FROM pages WHERE parent_id IS NULL AND title = ?',
      parentPageId ? [parentPageId, title] : [title],
      (err, row) => resolve(row)
    )
  );
  if (existingPage) {
    // Deduplicate: append number suffix
    let suffix = 2;
    let newTitle = `${title} (${suffix})`;
    while (true) {
      const check = await new Promise((resolve) =>
        pagesDb.get(
          parentPageId
            ? 'SELECT id FROM pages WHERE parent_id = ? AND title = ?'
            : 'SELECT id FROM pages WHERE parent_id IS NULL AND title = ?',
          parentPageId ? [parentPageId, newTitle] : [newTitle],
          (err, row) => resolve(row)
        )
      );
      if (!check) break;
      suffix++;
      newTitle = `${title} (${suffix})`;
    }
    title = newTitle;
  }

  // 保存页面记录（blocks 稍后填）
  // 子页面始终为 'page'，只有根页面才应用 inheritedPageType / rootPageType
  const pageType = parentPageId ? 'page' : (ctx.inheritedPageType || ctx.rootPageType || 'task');
  try {
    await savePageToDatabase({ pagesDb }, {
      id:       pageId,
      parentId: parentPageId || null,
      pageType,
      title,
      icon,
      position: position || 1.0,
      refId:    parentPageId ? null : ctx.taskId,
    });
  } catch (err) {
    console.error('[notion-import] savePageToDatabase FAILED', { pageId, parentPageId, title, refId: parentPageId ? null : ctx.taskId }, err.message);
    throw err;
  }

  // 5. 递归处理 child_page 块，建立 notionBlockId → {pageId, title, icon} 映射
  const childPageBlocks = notionBlocks.filter(b => b.type === 'child_page');
  const childPageMap    = new Map();  // notionBlockId → { pageId, title, icon }
  let childPos = 1;

  for (const child of childPageBlocks) {
    try {
      const childResult = await importPage(child.id, { parentPageId: pageId, position: childPos++ }, ctx);
      childPageMap.set(child.id, { pageId: childResult.pageId, title: childResult.title, icon: childResult.icon });
    } catch (err) {
      ctx.errors.push({ notionPageId: child.id, title: child.child_page?.title, message: err.message });
      ctx.log(`  ❌ 子页面失败 (${child.id}): ${err.message}`);
    }
  }

  // 6. 转换块（child_page → subpage block with 已知 ID）
  const egoBlocks = notionBlocksToEgo(notionBlocks, childPageMap);

  // 7. 保存块
  try {
    await saveEgoBlocks(pageId, egoBlocks);
  } catch (err) {
    console.error('[notion-import] saveEgoBlocks FAILED', { pageId, title, blocksCount: egoBlocks.length }, err.message);
    throw err;
  }

  ctx.imported.push({ title, pageId });
  return { title, icon, pageId, taskId: ctx.taskId };
}

// ── 端点 ──────────────────────────────────────────────────────────────────────

/**
 * POST /api/notion/import
 *
 * Body:
 *   notionPageUrl  {string}  Notion 页面 URL（必填）
 *   taskId         {string}  挂载到已有 task（可选）
 *   pageType       {string}  根页面类型，默认 'task'；传 'theory'/'page' 挂到对应树
 */
router.post('/notion/import', async (req, res) => {
  const {
    notionPageUrl, taskId: initTaskId, pageType = 'task',
    parentPageId: initParentPageId, notionToken,
  } = req.body;

  if (!notionPageUrl) {
    return res.status(400).json({ error: '请提供 notionPageUrl' });
  }

  const notionPageId = extractNotionPageId(notionPageUrl);
  if (!notionPageId) {
    return res.status(400).json({ error: '无法从 URL 提取 Notion 页面 ID' });
  }

  // 优先使用请求体中的 token，fallback 到环境变量
  const token = (notionToken || '').trim() || process.env.NOTION_TOKEN;
  if (!token) {
    return res.status(400).json({ error: '请在导入对话框中填入 Notion Integration Token（secret_xxx）' });
  }

  // Validate parentPageId exists if provided, and inherit its page_type
  let inheritedPageType = null;
  if (initParentPageId) {
    const parentPage = await new Promise((resolve) =>
      pagesDb.get('SELECT id, page_type FROM pages WHERE id = ?', [initParentPageId], (err, row) => resolve(row))
    );
    if (!parentPage) {
      return res.status(400).json({ error: `父页面不存在: ${initParentPageId}` });
    }
    inheritedPageType = parentPage.page_type; // 继承父页面类型（theory / page / task）
  }

  const ctx = {
    token,
    taskId:           initTaskId || null,
    rootPageType:     pageType,
    inheritedPageType,  // when set, ALL imported pages use this type
    imported:     [],
    errors:       [],
    log: (msg) => console.log('[notion-import]', msg),
  };

  try {
    ctx.log(`开始导入: ${notionPageUrl} parentPageId=${initParentPageId || 'none'}`);
    const root = await importPage(notionPageId, { parentPageId: initParentPageId || null, position: 1 }, ctx);

    res.json({
      success:       true,
      taskId:        ctx.taskId,
      rootTitle:     root.title,
      pagesImported: ctx.imported,
      errors:        ctx.errors,
    });
  } catch (error) {
    console.error('[notion-import] 失败:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = { init };
