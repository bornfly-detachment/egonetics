/**
 * migrate-prvse-graph.js
 * 创建 prvse_graph_nodes + prvse_graph_edges 两张表
 */
const path = require('path')
const sqlite3 = require('sqlite3').verbose()

const db = new sqlite3.Database(path.join(__dirname, '../data/pages.db'))

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS prvse_graph_nodes (
      id          TEXT PRIMARY KEY,
      task_id     TEXT NOT NULL,
      node_type   TEXT NOT NULL CHECK(node_type IN ('P','R','V','S','E')),
      label       TEXT NOT NULL DEFAULT '',
      x           REAL NOT NULL DEFAULT 100,
      y           REAL NOT NULL DEFAULT 100,
      from_tags   TEXT NOT NULL DEFAULT '[]',
      who_tags    TEXT NOT NULL DEFAULT '[]',
      to_tags     TEXT NOT NULL DEFAULT '[]',
      ai_aop      TEXT NOT NULL DEFAULT '[]',
      sensor_aop  TEXT NOT NULL DEFAULT '[]',
      comm_aop    TEXT NOT NULL DEFAULT '[]',
      content     TEXT NOT NULL DEFAULT '',
      author      TEXT NOT NULL DEFAULT '',
      power       TEXT NOT NULL DEFAULT '[]',
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `, err => { if (err) console.error('nodes:', err.message); else console.log('✅ prvse_graph_nodes') })

  db.run(`
    CREATE TABLE IF NOT EXISTS prvse_graph_edges (
      id            TEXT PRIMARY KEY,
      task_id       TEXT NOT NULL,
      source_id     TEXT NOT NULL,
      target_id     TEXT NOT NULL,
      edge_type     TEXT NOT NULL DEFAULT 'relation',
      label         TEXT NOT NULL DEFAULT '',
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `, err => { if (err) console.error('edges:', err.message); else console.log('✅ prvse_graph_edges') })
})

db.close(() => console.log('done'))
