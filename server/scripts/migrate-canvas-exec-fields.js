/**
 * migrate-canvas-exec-fields.js
 * 给 canvas_nodes 加执行语义字段，支持 SubjectiveEgoneticsAI Agent 系统
 *
 * 新增字段：
 *   node_kind       — 节点类型（7种）
 *   lifecycle_state — 执行生命周期状态
 *   exec_config     — 执行配置 JSON
 *   cost_snapshot   — 执行完成后的 cost 向量 JSON
 */

const path    = require('path')
const sqlite3 = require('sqlite3').verbose()

const DB_PATH = path.join(__dirname, '../data/pages.db')
const db = new sqlite3.Database(DB_PATH)

const columns = [
  {
    name: 'node_kind',
    def:  `ALTER TABLE canvas_nodes ADD COLUMN node_kind TEXT NOT NULL DEFAULT 'entity'`,
    // 'entity'|'llm_call'|'tool_call'|'local_judge'|'rule_branch'|'human_gate'|'lifecycle'|'cost_tracker'
  },
  {
    name: 'lifecycle_state',
    def:  `ALTER TABLE canvas_nodes ADD COLUMN lifecycle_state TEXT NOT NULL DEFAULT 'pending'`,
    // 'pending'|'running'|'success'|'failed'|'timeout'|'loop_detected'|'budget_exceeded'|'waiting_human'|'backtracking'
  },
  {
    name: 'exec_config',
    def:  `ALTER TABLE canvas_nodes ADD COLUMN exec_config TEXT NOT NULL DEFAULT '{}'`,
    // JSON: 执行参数，按 node_kind 不同而不同
  },
  {
    name: 'cost_snapshot',
    def:  `ALTER TABLE canvas_nodes ADD COLUMN cost_snapshot TEXT NOT NULL DEFAULT '{}'`,
    // JSON: {time_ms, memory_mb, vram_mb, token_input, token_output, completion_rate, quality_score}
  },
]

db.serialize(() => {
  columns.forEach(({ name, def }) => {
    db.run(def, err => {
      if (err && err.message.includes('duplicate column')) {
        console.log(`⏭  ${name} 已存在，跳过`)
      } else if (err) {
        console.error(`❌ ${name}:`, err.message)
      } else {
        console.log(`✅ ${name} 已添加`)
      }
    })
  })
})

setTimeout(() => {
  db.close()
  console.log('Migration 完成')
}, 500)
