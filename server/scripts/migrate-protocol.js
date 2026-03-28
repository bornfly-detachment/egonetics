/**
 * migrate-protocol.js
 * 创建 hm_protocol 人机协作协议表（宪法文档）
 * 并写入 PDF 规范中定义的默认条目
 */
const path = require('path')
const sqlite3 = require('sqlite3').verbose()
const db = new sqlite3.Database(path.join(__dirname, '../data/pages.db'))

function genId() {
  return `proto-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS hm_protocol (
      id          TEXT PRIMARY KEY,
      category    TEXT NOT NULL DEFAULT 'universal',
      layer       TEXT NOT NULL DEFAULT '',
      human_char  TEXT NOT NULL DEFAULT '',
      ui_visual   TEXT NOT NULL DEFAULT '{}',
      machine_lang TEXT NOT NULL DEFAULT '',
      notes       TEXT NOT NULL DEFAULT '',
      sort_order  INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `, err => { if (err) console.error('hm_protocol:', err.message); else console.log('✅ hm_protocol') })

  // 默认种子数据（来自 PDF 规范）
  const seeds = [
    // ── 交互操作法 ──────────────────────────────────────────────
    { category: 'interaction', layer: '', sort_order: 1,
      human_char: '折叠',
      ui_visual: JSON.stringify({ action: 'collapse', icon: 'chevron', rule: '自顶向下可见' }),
      machine_lang: 'collapsible section, layer/permission hierarchy',
      notes: '折叠 ⟺ 层次+权限，Rule: 自顶向下可见' },
    { category: 'interaction', layer: '', sort_order: 2,
      human_char: '拖拽排序',
      ui_visual: JSON.stringify({ action: 'drag', cursor: 'grab', rule: '高→低/左→右/上→下' }),
      machine_lang: 'sort_order field, onMouseDown/Move/Up handlers',
      notes: '拖拽 ⟺ 排序，Rule: 高→低/左→右/上→下' },
    { category: 'interaction', layer: '', sort_order: 3,
      human_char: '点击',
      ui_visual: JSON.stringify({ action: 'click', effects: ['select', 'expand', 'detail'] }),
      machine_lang: 'onClick → setSelected, expand detail panel',
      notes: '点击 ⟺ 选中、展开、详情' },
    { category: 'interaction', layer: '', sort_order: 4,
      human_char: '双击/点编辑',
      ui_visual: JSON.stringify({ action: 'dblclick', effect: 'inline-edit', diff: true, engine: 'EditorBlock' }),
      machine_lang: 'onDoubleClick → EditorBlock, git-style diff tracking',
      notes: '修改后推进，基于 EditorBlock + diff' },
    { category: 'interaction', layer: '', sort_order: 5,
      human_char: '⊕ 快捷键/挂载',
      ui_visual: JSON.stringify({ action: 'shortcut-or-plus', effect: 'mount-component', icon: '⊕' }),
      machine_lang: '⊕ button → component registry mount',
      notes: '快捷键/点击⊕ ⟺ 挂载其他组件' },

    // ── 权限层级 ─────────────────────────────────────────────────
    { category: 'layer', layer: 'rule', sort_order: 0,
      human_char: '低层不可见高层信息',
      ui_visual: JSON.stringify({ lock: '🔒', visibility: 'top-down-only', rule: 'lN不可见l(N+1)+' }),
      machine_lang: 'if viewer.permission_level < layer.level → content hidden',
      notes: 'l₁>l₀, l₂>l₁, 低层看不到高层内容' },
    { category: 'layer', layer: 'l0', sort_order: 10,
      human_char: 'l₀ 物理信号层',
      ui_visual: JSON.stringify({ color: '#3b82f6', icon: '⚡', bg: '#1a2a44', label: 'l₀', permission: 0 }),
      machine_lang: 'node.l0_data: JSON, permission_level=0',
      notes: '物理/信号层，所有人可见' },
    { category: 'layer', layer: 'l1', sort_order: 11,
      human_char: 'l₁ 客观规律层',
      ui_visual: JSON.stringify({ color: '#10b981', icon: '🔧', bg: '#0a2a1a', label: 'l₁', permission: 1 }),
      machine_lang: 'node.l1_data: JSON, permission_level=1',
      notes: '客观规律/信息层，需 l₁ 权限' },
    { category: 'layer', layer: 'l2', sort_order: 12,
      human_char: 'l₂ 认知演化层',
      ui_visual: JSON.stringify({ color: '#8b5cf6', icon: '🧠', bg: '#221a44', label: 'l₂', permission: 2 }),
      machine_lang: 'node.l2_data: JSON, permission_level=2',
      notes: 'AI处理/认知层，需 l₂ 权限' },

    // ── R 关系 ───────────────────────────────────────────────────
    { category: 'R', layer: 'l0', sort_order: 20,
      human_char: 'l₀ 信号包含关系',
      ui_visual: JSON.stringify({ arrow: '⊂', style: 'contains', strokeDash: '8,3', level: 'l0', color: '#4b5563' }),
      machine_lang: "edge.constraint_type='contains', edge.level='l0'",
      notes: 'l₀层 Pattern 间的信号包含关系' },
    { category: 'R', layer: 'l1', sort_order: 21,
      human_char: 'A -×→ B  单向制约',
      ui_visual: JSON.stringify({ arrow: '→', marker: '✕', color: '#ef4444', style: 'block', midMarker: true }),
      machine_lang: "edge.constraint_type='constraint'",
      notes: 'A 制约 B，带 × 号箭头' },
    { category: 'R', layer: 'l1', sort_order: 22,
      human_char: 'A ←×→ B  互相制约',
      ui_visual: JSON.stringify({ arrow: '↔', marker: '✕', color: '#ef4444', style: 'mutual', bidirectional: true }),
      machine_lang: "edge.constraint_type='mutual_constraint'",
      notes: 'A、B 互相制约，双向 × 箭头' },
    { category: 'R', layer: 'l2', sort_order: 23,
      human_char: 'l₂ 推导/演化关系',
      ui_visual: JSON.stringify({ arrow: '⇒', style: 'derives', strokeWidth: 2.5, level: 'l2', color: '#8b5cf6' }),
      machine_lang: "edge.constraint_type='derives', edge.level='l2'",
      notes: 'l₂ 认知层的推论/演化有向边' },
    { category: 'R', layer: 'signal', sort_order: 24,
      human_char: 'l₀ 信号流',
      ui_visual: JSON.stringify({ arrow: '~~>', style: 'signal', strokeDash: '4,3', animated: true, color: '#4b5563' }),
      machine_lang: "edge.constraint_type='signal', edge.level='l0'",
      notes: '物理信号流动，虚线动画' },
    { category: 'R', layer: 'slider', sort_order: 25,
      human_char: 'slider 矛盾 ↔ 统一',
      ui_visual: JSON.stringify({ type: 'range', leftLabel: '矛盾/对立', rightLabel: '统一/融合', extremesAreMeaning: true, min: 0, max: 1 }),
      machine_lang: 'node.slider_value ∈ [0,1], 0=contradiction/opposition, 1=unity/convergence',
      notes: '左极=矛盾对立，右极=统一融合；不同 slider 可做 A/B test' },
    { category: 'R', layer: 'timeline', sort_order: 26,
      human_char: 'Timeline / Steps / Progress',
      ui_visual: JSON.stringify({ type: 'timeline', direction: 'horizontal', style: 'steps' }),
      machine_lang: 'node.l1_data.timeline: string[]',
      notes: '顺序关系，具体体验选择' },

    // ── P 模式 ───────────────────────────────────────────────────
    { category: 'P', layer: 'l0', sort_order: 30,
      human_char: 'P l₀ 信号输入输出',
      ui_visual: JSON.stringify({ fields: ['signal_input', 'signal_output'], style: 'io-ports' }),
      machine_lang: 'node.l0_data.signal_input: string, .signal_output: string',
      notes: 'Pattern 的物理信号端口' },
    { category: 'P', layer: 'l1', sort_order: 31,
      human_char: 'P l₁ 规律记录（文件/视频/硬记录）',
      ui_visual: JSON.stringify({ fields: ['files', 'records'], accepts: ['file', 'video', 'text'] }),
      machine_lang: 'node.l1_data.files: string[], .records: string',
      notes: '客观规律记录，文件/视频/硬记录' },
    { category: 'P', layer: 'l2', sort_order: 32,
      human_char: 'P l₂ AI理解 + 自主生命周期',
      ui_visual: JSON.stringify({ fields: ['ai_understanding', 'lifecycle'], autonomous: true }),
      machine_lang: 'node.l2_data.ai_understanding: string, .lifecycle: string',
      notes: 'P 本身自主改变，控制生命周期' },

    // ── V 价值 ───────────────────────────────────────────────────
    { category: 'V', layer: 'l0', sort_order: 40,
      human_char: 'V l₀ 计时/Token/资源监控',
      ui_visual: JSON.stringify({ metrics: ['timer_ms', 'token_count', 'resource_usage'], display: 'meter' }),
      machine_lang: 'node.l0_data.timer_ms: number, .token_count: number, .resource_usage: string',
      notes: '物理量度：计时、Token统计、消耗资源' },
    { category: 'V', layer: 'l1', sort_order: 41,
      human_char: 'V l₁ Reward = P(Action|Condition) ≤ 阈值',
      ui_visual: JSON.stringify({ formula: 'Reward = on概率 × 完成率', todos: 'checklist', conditionGated: true }),
      machine_lang: 'node.l1_data.todos: string[], .reward_fn: string, .threshold: number',
      notes: '代码/数学/TODO清单，Reward函数定义' },
    { category: 'V', layer: 'l2', sort_order: 42,
      human_char: 'V l₂ 主观分布 > 0.7 阈值',
      ui_visual: JSON.stringify({ threshold: 0.7, fields: ['uncertainty', 'subjective_narrative'], vsHuman: true }),
      machine_lang: 'node.l2_data.uncertainty: number, .subjective_narrative: string',
      notes: '不确定性>完成度0.7，与人类区别特征' },

    // ── AOP ─────────────────────────────────────────────────────
    { category: 'AOP', layer: '', sort_order: 50,
      human_char: 'AOP 切面编程接口',
      ui_visual: JSON.stringify({ icon: '🔗', status: 'stub', style: 'icon-link', clickable: false }),
      machine_lang: "// interface AopLink { id:string; layer:'l0'|'l1'|'l2'; type:'sensor'|'compute'|'ai'|'comm'; status:'stub'|'active'; endpoint?:string }",
      notes: '未实现的 AOP 占位符，每层有独立 AOP 接口钩子' },
  ]

  db.run('DELETE FROM hm_protocol WHERE id LIKE \'proto-seed-%\'', [], () => {
    for (let i = 0; i < seeds.length; i++) {
      const s = seeds[i]
      const id = `proto-seed-${String(i).padStart(3, '0')}`
      db.run(
        `INSERT OR IGNORE INTO hm_protocol (id, category, layer, human_char, ui_visual, machine_lang, notes, sort_order)
         VALUES (?,?,?,?,?,?,?,?)`,
        [id, s.category, s.layer, s.human_char, s.ui_visual, s.machine_lang, s.notes, s.sort_order],
        err => { if (err) console.error('seed:', err.message) }
      )
    }
    console.log(`✅ seeded ${seeds.length} protocol entries`)
  })
})

db.close(() => console.log('done'))
