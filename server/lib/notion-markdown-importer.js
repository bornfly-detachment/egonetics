/**
 * Notion → Egonetics Markdown 导入器
 *
 * 特点：
 * 1. 保持原始格式，转换为 markdown
 * 2. 表格转义处理
 * 3. 递归导入子页面（逐个页面导入）
 * 4. 导入到指定 task 的 page tree 下
 */

const { genId } = require('./graph');

/**
 * 从 Notion URL 提取 page ID
 */
function extractNotionPageId(url) {
  const patterns = [
    /([a-f0-9]{32})/i,
    /-([a-f0-9]{32})/i,
    /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1].replace(/-/g, '');
    }
  }
  return null;
}

/**
 * 将 Notion rich_text 转换为纯文本
 */
function richTextToPlainText(richText) {
  if (!richText || !Array.isArray(richText)) return '';
  return richText.map(rt => rt.plain_text || '').join('');
}

/**
 * 转义 markdown 表格中的特殊字符
 */
function escapeTableCell(text) {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\n/g, '<br>');
}

/**
 * 将 Notion block 转换为 Markdown
 */
function blockToMarkdown(block, indent = 0) {
  const type = block.type;
  const content = block[type] || {};
  const text = richTextToPlainText(content.rich_text);
  const prefix = '  '.repeat(indent);

  switch (type) {
    case 'paragraph':
      return text ? `${prefix}${text}\n` : '\n';

    case 'heading_1':
      return `${prefix}# ${text}\n\n`;
    case 'heading_2':
      return `${prefix}## ${text}\n\n`;
    case 'heading_3':
      return `${prefix}### ${text}\n\n`;
    case 'heading_4':
      return `${prefix}#### ${text}\n\n`;

    case 'bulleted_list_item':
      return `${prefix}- ${text}\n`;
    case 'numbered_list_item':
      return `${prefix}1. ${text}\n`;
    case 'to_do':
      const checkbox = content.checked ? '[x]' : '[ ]';
      return `${prefix}- ${checkbox} ${text}\n`;

    case 'code':
      const language = content.language || '';
      return `${prefix}\`\`\`${language}\n${text}\n${prefix}\`\`\`\n\n`;

    case 'quote':
      return text.split('\n').map(line => `${prefix}> ${line}`).join('\n') + '\n\n';

    case 'callout':
      const icon = content.icon?.emoji || '💡';
      return `${prefix}> ${icon} ${text}\n\n`;

    case 'divider':
      return `${prefix}---\n\n`;

    case 'table':
      return tableToMarkdown(block, prefix);

    case 'image':
      const caption = richTextToPlainText(content.caption);
      const url = content.external?.url || content.file?.url || '';
      return `${prefix}![${caption}](${url})\n\n`;

    case 'bookmark':
    case 'link_preview':
      const url2 = content.url || '';
      const title2 = content.title || url2;
      return `${prefix}[${title2}](${url2})\n\n`;

    case 'child_page':
      const childTitle = content.title || '子页面';
      return `${prefix}📄 **${childTitle}**\n\n`;

    case 'column_list':
    case 'column':
      // 列布局：递归处理子块
      if (block.children) {
        return block.children.map(child => blockToMarkdown(child, indent)).join('');
      }
      return '';

    case 'equation':
      return `${prefix}$$${text}$$\n\n`;

    case 'table_of_contents':
      return `${prefix}**目录**\n\n`;

    default:
      return text ? `${prefix}${text}\n` : '';
  }
}

/**
 * 将 Notion 表格转换为 Markdown 表格
 */
function tableToMarkdown(block, prefix) {
  const table = block.table || {};
  const tableWidth = table.table_width || 0;
  const hasHeader = table.has_column_header !== false;

  if (!block.children || block.children.length === 0) {
    return `${prefix}*(空表格)*\n\n`;
  }

  let md = '\n';

  block.children.forEach((row, rowIdx) => {
    if (row.type !== 'table_row') return;

    const cells = row.table_row?.cells || [];
    const cellTexts = cells.map(cell => {
      const text = richTextToPlainText(cell);
      return escapeTableCell(text);
    });

    // 补齐空单元格
    while (cellTexts.length < tableWidth) {
      cellTexts.push('');
    }

    md += `${prefix}| ${cellTexts.join(' | ')} |\n`;

    // 表头分隔线
    if (hasHeader && rowIdx === 0) {
      const separators = cellTexts.map(() => '---');
      md += `${prefix}| ${separators.join(' | ')} |\n`;
    }
  });

  md += '\n';
  return md;
}

/**
 * 将 Notion 页面内容转换为 Markdown
 */
function notionPageToMarkdown(notionPage) {
  if (!notionPage) return '';

  let md = '';

  // 页面标题
  if (notionPage.title) {
    md += `# ${notionPage.title}\n\n`;
  }

  // 页面内容块
  if (notionPage.blocks && notionPage.blocks.length > 0) {
    for (const block of notionPage.blocks) {
      md += blockToMarkdown(block);
    }
  }

  return md;
}

/**
 * 提取子页面列表
 */
function extractChildPages(notionPage) {
  const childPages = [];

  if (!notionPage || !notionPage.blocks) return childPages;

  for (const block of notionPage.blocks) {
    if (block.type === 'child_page') {
      const childId = block.id;
      const childTitle = block.child_page?.title || '子页面';
      childPages.push({
        id: childId,
        title: childTitle,
        type: 'child_page',
      });
    } else if (block.type === 'link_to_page' && block.link_to_page?.type === 'page_id') {
      const linkedId = block.link_to_page.page_id;
      childPages.push({
        id: linkedId,
        title: block.link_to_page.title || '链接页面',
        type: 'link_to_page',
      });
    }

    // 递归检查子块
    if (block.children) {
      const nestedChildren = extractChildPages({ blocks: block.children });
      childPages.push(...nestedChildren);
    }
  }

  return childPages;
}

/**
 * 保存页面到数据库
 */
async function savePageToDatabase(db, pageData) {
  const { pagesDb } = db;

  return new Promise((resolve, reject) => {
    pagesDb.run(
      `INSERT INTO pages (id, parent_id, page_type, title, icon, position, ref_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        pageData.id,
        pageData.parentId || null,
        pageData.pageType || 'page',
        pageData.title,
        pageData.icon || '📄',
        pageData.position || 1.0,
        pageData.refId || null,
      ],
      function(err) {
        if (err) reject(err);
        else resolve({ id: pageData.id, ...pageData });
      }
    );
  });
}

/**
 * 保存块内容到数据库
 */
async function saveBlocksToDatabase(db, pageId, markdownContent) {
  const { pagesDb } = db;
  const blockId = genId('block');

  const content = JSON.stringify({
    rich_text: [{ text: markdownContent }],
    language: 'markdown',
  });

  return new Promise((resolve, reject) => {
    pagesDb.run(
      `INSERT INTO blocks (id, page_id, parent_id, type, content, position, metadata)
       VALUES (?, ?, NULL, 'code', ?, 1.0, '{}')`,
      [blockId, pageId, content],
      function(err) {
        if (err) reject(err);
        else resolve({ blockId, pageId });
      }
    );
  });
}

/**
 * 创建导入记录
 */
async function createImportLog(db, importData) {
  const { memoryDb } = db;

  return new Promise((resolve, reject) => {
    memoryDb.run(
      `INSERT INTO notion_import_logs (
        id, notion_page_id, notion_page_title, target_task_id,
        parent_page_id, status, pages_imported, errors, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        importData.id,
        importData.notionPageId,
        importData.notionPageTitle,
        importData.targetTaskId,
        importData.parentPageId || null,
        importData.status,
        JSON.stringify(importData.pagesImported || []),
        JSON.stringify(importData.errors || []),
      ],
      function(err) {
        if (err) reject(err);
        else resolve(importData);
      }
    );
  });
}

module.exports = {
  extractNotionPageId,
  notionPageToMarkdown,
  extractChildPages,
  savePageToDatabase,
  saveBlocksToDatabase,
  createImportLog,
  blockToMarkdown,
  richTextToPlainText,
  escapeTableCell,
};
