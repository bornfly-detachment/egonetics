/**
 * scripts/migrate-blocks-v2.js
 * 数据结构 v2 迁移：
 *   blocks 表新增 title, creator, edit_start_time
 *   新建 process_versions 表（block + relation 共用）
 *   新建 relations 表（跨实体类型的开放描述边）
 *
 * 运行: cd server && npm run migrate-v2
 */

const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, '../data/pages.db');

function runSerial(db, statements) {
  return statements.reduce((p, { sql, label }) => {
    return p.then(() => new Promise((resolve, reject) => {
      db.run(sql, (err) => {
        if (err && !err.message.includes('duplicate column') && !err.message.includes('already exists')) {
          console.error(`  ✗ ${label}: ${err.message}`);
          return reject(err);
        }
        console.log(err ? `  – ${label} (已存在，跳过)` : `  ✓ ${label}`);
        resolve();
      });
    }));
  }, Promise.resolve());
}

async function run() {
  console.log('🔄 开始迁移 pages.db v2...');
  const db = new sqlite3.Database(DB_PATH);

  await runSerial(db, [
    // blocks 新增字段
    { sql: "ALTER TABLE blocks ADD COLUMN title TEXT DEFAULT ''",    label: 'blocks.title' },
    { sql: "ALTER TABLE blocks ADD COLUMN creator TEXT DEFAULT ''",  label: 'blocks.creator' },
    { sql: "ALTER TABLE blocks ADD COLUMN edit_start_time TEXT",     label: 'blocks.edit_start_time' },

    // process_versions 表
    {
      sql: `CREATE TABLE IF NOT EXISTS process_versions (
        id               TEXT PRIMARY KEY,
        entity_id        TEXT NOT NULL,
        entity_type      TEXT NOT NULL DEFAULT 'block',
        version_num      INTEGER NOT NULL DEFAULT 1,
        start_time       TEXT,
        publish_time     TEXT NOT NULL,
        publisher        TEXT NOT NULL DEFAULT '',
        title_snapshot   TEXT DEFAULT '',
        content_snapshot TEXT NOT NULL DEFAULT '{}',
        explanation      TEXT DEFAULT '',
        created_at       TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      label: 'CREATE TABLE process_versions',
    },
    {
      sql: 'CREATE INDEX IF NOT EXISTS idx_pv_entity ON process_versions(entity_id)',
      label: 'INDEX process_versions.entity_id',
    },
    {
      sql: 'CREATE INDEX IF NOT EXISTS idx_pv_entity_type ON process_versions(entity_id, entity_type)',
      label: 'INDEX process_versions.(entity_id, entity_type)',
    },

    // relations 表
    {
      sql: `CREATE TABLE IF NOT EXISTS relations (
        id          TEXT PRIMARY KEY,
        title       TEXT DEFAULT '',
        source_type TEXT NOT NULL,
        source_id   TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id   TEXT NOT NULL,
        description TEXT DEFAULT '',
        creator     TEXT DEFAULT '',
        created_at  TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at  TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      label: 'CREATE TABLE relations',
    },
    {
      sql: 'CREATE INDEX IF NOT EXISTS idx_rel_source ON relations(source_type, source_id)',
      label: 'INDEX relations.source',
    },
    {
      sql: 'CREATE INDEX IF NOT EXISTS idx_rel_target ON relations(target_type, target_id)',
      label: 'INDEX relations.target',
    },
  ]);

  await new Promise(resolve => db.close(resolve));
  console.log('\n✅ 迁移完成');
}

run().catch(e => {
  console.error('❌ 迁移失败:', e.message);
  process.exit(1);
});
