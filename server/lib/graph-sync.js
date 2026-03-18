/**
 * lib/graph-sync.js
 * 页面 CRUD 与 Kuzu graph.db 自动同步
 *
 * syncPageUpsert(page)  — 创建或更新 Page 节点
 * syncPageDelete(id)    — 删除 Page 节点及其所有关联边
 */

const { exec, query } = require('./graph');

/**
 * 创建或更新 graph.db 中的 Page 节点
 * @param {{ id, title, page_type, icon }} page
 */
async function syncPageUpsert(page) {
  try {
    const existing = await query('MATCH (n:Page {id: $id}) RETURN n', { id: page.id });
    if (existing.length) {
      await exec(
        'MATCH (n:Page {id: $id}) SET n.title = $title, n.page_type = $pt, n.icon = $icon, n.updated_at = $ts',
        { id: page.id, title: page.title || '', pt: page.page_type || 'page', icon: page.icon || '📄', ts: new Date().toISOString() }
      );
    } else {
      const ts = new Date().toISOString();
      await exec(
        `CREATE (:Page {id:$id, title:$title, page_type:$pt, icon:$icon,
          source:'sqlite', notion_id:'', draft_content:'', content:'[]',
          current_content_id:'', created_at:$ts, updated_at:$ts})`,
        { id: page.id, title: page.title || '', pt: page.page_type || 'page', icon: page.icon || '📄', ts }
      );
    }
  } catch (err) {
    // graph sync is best-effort — do not crash main request
    console.warn('[graph-sync] syncPageUpsert failed:', err.message);
  }
}

/**
 * 从 graph.db 删除 Page 节点及其所有边
 * @param {string} id — page id
 */
async function syncPageDelete(id) {
  try {
    await exec('MATCH (n:Page {id: $id}) DETACH DELETE n', { id });
  } catch (err) {
    console.warn('[graph-sync] syncPageDelete failed:', err.message);
  }
}

module.exports = { syncPageUpsert, syncPageDelete };
