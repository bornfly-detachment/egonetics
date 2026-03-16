/**
 * lib/graph.js
 * Kuzu 图数据库连接管理器 + 通用工具函数
 */

const path = require('path');
const kuzu = require('kuzu');

const DB_PATH = path.join(__dirname, '../data/graph.db');

let _db = null;
let _conn = null;

function getConnection() {
  if (!_conn) {
    _db = new kuzu.Database(DB_PATH);
    _conn = new kuzu.Connection(_db);
  }
  return _conn;
}

// ── ID 生成 ───────────────────────────────────────────────────

function genId(prefix = 'g') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── ContentEntry ──────────────────────────────────────────────

/**
 * 创建新的 ContentEntry（发布版本时调用）
 * @param {string} content  - 版本内容快照
 * @param {string} explain  - 为什么发布这个版本
 * @param {string} startAt  - 上个版本发布时间（或创建时间）
 */
function makeContentEntry(content, explain, startAt) {
  return {
    id: genId('ce'),
    content,
    explain,
    timestamp: {
      start: startAt || new Date().toISOString(),
      end: new Date().toISOString()
    }
  };
}

/**
 * 解析 content JSON 字符串 → ContentEntry[]
 */
function parseContent(raw) {
  try {
    return JSON.parse(raw || '[]');
  } catch {
    return [];
  }
}

/**
 * 获取当前显示内容（current_content_id 指向的 entry）
 */
function getCurrentContent(raw, currentId) {
  const list = parseContent(raw);
  if (!currentId) return list[list.length - 1] || null;
  return list.find(e => e.id === currentId) || list[list.length - 1] || null;
}

// ── 查询封装 ──────────────────────────────────────────────────

/**
 * 执行 Cypher 查询，返回 rows 数组
 */
async function query(cypher, params = {}) {
  const conn = getConnection();
  const result = await conn.query(cypher, params);
  const rows = [];
  while (result.hasNext()) {
    rows.push(await result.getNext());
  }
  return rows;
}

/**
 * 执行写操作（CREATE / MERGE / SET / DELETE）
 */
async function exec(cypher, params = {}) {
  const conn = getConnection();
  await conn.query(cypher, params);
}

// ── 节点序列化 ────────────────────────────────────────────────

/**
 * 将 Kuzu row 转为 API 响应格式（展开 current content）
 */
function formatNode(row, key = 'n') {
  const node = row[key];
  if (!node) return null;
  const list = parseContent(node.content);
  const current = getCurrentContent(node.content, node.current_content_id);
  return {
    ...node,
    content: list,
    current_content: current,
    draft_content: node.draft_content || ''
  };
}

module.exports = {
  getConnection,
  genId,
  makeContentEntry,
  parseContent,
  getCurrentContent,
  query,
  exec,
  formatNode
};
