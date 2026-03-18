/**
 * scripts/init-graph-db.js
 * 初始化 Kuzu 图数据库 schema
 * 运行: cd server && npm run init-graph
 *
 * 节点层级：
 *   Page  — 对应 pages.db 的页面，轻量引用
 *   Block — 不可再分的信息原子
 *   LabelSystem / Label — 标签体系
 *
 * 边层级：
 *   RELATION (REL TABLE GROUP) — Block↔Block / Block↔Page / Page↔Page
 *   CONTAINS  — Page→Block（页面包含块，结构边）
 *   HAS_LABEL — Block/Page → Label（标签打标）
 *   BELONGS_TO / LABEL_PARENT / LABEL_RELATION — 标签体系内部
 */

const path = require('path');
const kuzu = require('kuzu');

const DB_PATH = path.join(__dirname, '../data/graph.db');

async function run(stmt, conn, label) {
  try {
    await conn.query(stmt);
    console.log(`  ✓ ${label}`);
  } catch (e) {
    if (e.message && e.message.includes('already exists')) {
      console.log(`  – ${label} (already exists, skip)`);
    } else {
      console.error(`  ✗ ${label}: ${e.message}`);
      throw e;
    }
  }
}

async function init() {
  console.log('📦 初始化 graph.db...');
  console.log(`   路径: ${DB_PATH}`);

  const db = new kuzu.Database(DB_PATH);
  const conn = new kuzu.Connection(db);

  console.log('\n── Node Tables ──────────────────────────────');

  // Page：对应 pages.db 页面的轻量图节点
  await run(`
    CREATE NODE TABLE Page(
      id                 STRING,
      title              STRING DEFAULT '',
      page_type          STRING DEFAULT 'page',
      icon               STRING DEFAULT '📄',
      source             STRING DEFAULT 'manual',
      notion_id          STRING DEFAULT '',
      draft_content      STRING DEFAULT '',
      content            STRING DEFAULT '[]',
      current_content_id STRING DEFAULT '',
      created_at         STRING,
      updated_at         STRING,
      PRIMARY KEY(id)
    )
  `, conn, 'Node: Page');

  // Block：不可再分的信息原子
  await run(`
    CREATE NODE TABLE Block(
      id                 STRING,
      title              STRING DEFAULT '',
      content_type       STRING DEFAULT 'paragraph',
      source             STRING DEFAULT 'manual',
      page_id            STRING DEFAULT '',
      notion_id          STRING DEFAULT '',
      draft_content      STRING DEFAULT '',
      content            STRING DEFAULT '[]',
      current_content_id STRING DEFAULT '',
      created_at         STRING,
      updated_at         STRING,
      PRIMARY KEY(id)
    )
  `, conn, 'Node: Block');

  // LabelSystem：思考范式
  await run(`
    CREATE NODE TABLE LabelSystem(
      id                 STRING,
      draft_content      STRING DEFAULT '',
      content            STRING DEFAULT '[]',
      current_content_id STRING DEFAULT '',
      creator            STRING DEFAULT 'user',
      created_at         STRING,
      updated_at         STRING,
      PRIMARY KEY(id)
    )
  `, conn, 'Node: LabelSystem');

  // Label：信息压缩单元
  await run(`
    CREATE NODE TABLE Label(
      id                 STRING,
      draft_content      STRING DEFAULT '',
      content            STRING DEFAULT '[]',
      current_content_id STRING DEFAULT '',
      color              STRING DEFAULT '#6366f1',
      abstraction_level  INT    DEFAULT 0,
      system_id          STRING DEFAULT '',
      created_at         STRING,
      updated_at         STRING,
      PRIMARY KEY(id)
    )
  `, conn, 'Node: Label');

  console.log('\n── Rel Tables ───────────────────────────────');

  // ── 核心：跨类型语义边（REL TABLE GROUP）──────────────
  // 覆盖：Block↔Block / Block↔Page / Page↔Page
  // 所有语义关系（因果、关联、演化、对立…）都走这张表
  // relation_hint 是可选语义提示，description 是开放描述
  await run(`
    CREATE REL TABLE GROUP RELATION(
      FROM Block TO Block,
      FROM Block TO Page,
      FROM Page  TO Block,
      FROM Page  TO Page,
      id                 STRING,
      from_id            STRING,
      from_type          STRING,
      to_id              STRING,
      to_type            STRING,
      draft_content      STRING  DEFAULT '',
      content            STRING  DEFAULT '[]',
      current_content_id STRING  DEFAULT '',
      relation_hint      STRING  DEFAULT '',
      condition_type     STRING  DEFAULT 'always',
      condition_detail   STRING  DEFAULT '',
      is_cycle           BOOLEAN DEFAULT false,
      confidence         DOUBLE  DEFAULT 1.0,
      creator            STRING  DEFAULT 'user',
      created_at         STRING,
      updated_at         STRING
    )
  `, conn, 'Rel GROUP: RELATION (Block/Page ↔ Block/Page)');

  // ── 结构边：页面包含块 ─────────────────────────────────
  await run(`
    CREATE REL TABLE CONTAINS(
      FROM Page TO Block,
      id         STRING,
      position   DOUBLE DEFAULT 1.0,
      created_at STRING
    )
  `, conn, 'Rel: CONTAINS (Page→Block)');

  // ── 标签体系 ──────────────────────────────────────────
  await run(`
    CREATE REL TABLE BELONGS_TO(
      FROM Label TO LabelSystem,
      id         STRING,
      from_id    STRING,
      to_id      STRING,
      created_at STRING
    )
  `, conn, 'Rel: BELONGS_TO (Label→LabelSystem)');

  await run(`
    CREATE REL TABLE LABEL_PARENT(
      FROM Label TO Label,
      id         STRING,
      from_id    STRING,
      to_id      STRING,
      created_at STRING
    )
  `, conn, 'Rel: LABEL_PARENT (Label→Label)');

  await run(`
    CREATE REL TABLE LABEL_RELATION(
      FROM Label TO Label,
      id                 STRING,
      from_id            STRING,
      to_id              STRING,
      draft_content      STRING DEFAULT '',
      content            STRING DEFAULT '[]',
      current_content_id STRING DEFAULT '',
      relation_hint      STRING DEFAULT '',
      condition_type     STRING DEFAULT 'always',
      condition_detail   STRING DEFAULT '',
      creator            STRING DEFAULT 'user',
      created_at         STRING,
      updated_at         STRING
    )
  `, conn, 'Rel: LABEL_RELATION (Label→Label)');

  // ── 打标签：Block 和 Page 都可打标签 ──────────────────
  await run(`
    CREATE REL TABLE GROUP HAS_LABEL(
      FROM Block TO Label,
      FROM Page  TO Label,
      id                 STRING,
      from_id            STRING,
      from_type          STRING,
      to_id              STRING,
      draft_content      STRING DEFAULT '',
      content            STRING DEFAULT '[]',
      current_content_id STRING DEFAULT '',
      confidence         DOUBLE  DEFAULT 1.0,
      creator            STRING  DEFAULT 'user',
      created_at         STRING,
      updated_at         STRING
    )
  `, conn, 'Rel GROUP: HAS_LABEL (Block/Page→Label)');

  console.log('\n✅ graph.db 初始化完成');
  process.exit(0);
}

init().catch(e => {
  console.error('❌ 初始化失败:', e.message);
  process.exit(1);
});
