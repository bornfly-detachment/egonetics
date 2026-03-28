/**
 * migrate-prvse-v2.js
 * 为 prvse_graph_nodes 和 prvse_graph_edges 添加 v2 字段：
 *   nodes: l0_data, l1_data, l2_data, permission_level, slider_value
 *   edges: constraint_type, level
 */
const path = require('path')
const sqlite3 = require('sqlite3').verbose()
const db = new sqlite3.Database(path.join(__dirname, '../data/pages.db'))

const nodeAlters = [
  `ALTER TABLE prvse_graph_nodes ADD COLUMN l0_data TEXT NOT NULL DEFAULT '{}'`,
  `ALTER TABLE prvse_graph_nodes ADD COLUMN l1_data TEXT NOT NULL DEFAULT '{}'`,
  `ALTER TABLE prvse_graph_nodes ADD COLUMN l2_data TEXT NOT NULL DEFAULT '{}'`,
  `ALTER TABLE prvse_graph_nodes ADD COLUMN permission_level INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE prvse_graph_nodes ADD COLUMN slider_value REAL NOT NULL DEFAULT 0.5`,
]

const edgeAlters = [
  `ALTER TABLE prvse_graph_edges ADD COLUMN constraint_type TEXT NOT NULL DEFAULT 'directed'`,
  `ALTER TABLE prvse_graph_edges ADD COLUMN level TEXT NOT NULL DEFAULT 'l1'`,
]

db.serialize(() => {
  for (const sql of [...nodeAlters, ...edgeAlters]) {
    db.run(sql, err => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('❌', err.message)
      } else if (!err) {
        const col = sql.match(/ADD COLUMN (\w+)/)?.[1]
        console.log(`✅ added ${col}`)
      }
    })
  }
})

db.close(() => console.log('done'))
