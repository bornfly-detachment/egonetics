/**
 * ProtocolView — 人机协作协议 CRUD
 * 三列：人类字符 ↔ UI可视化 ↔ 机器语言
 * 分类 Tab：全部 / interaction / layer / R / P / V / AOP
 */
import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Save, X, Code2, ChevronDown } from 'lucide-react'
import { authFetch } from '@/lib/http'
import ProtocolVisual from './ProtocolVisual'
import { ResourceTierVisual } from '@/design/components/ResourceTierVisual'
import { CommunicationPipeline } from '@/design/components/CommunicationVisual'

interface ProtocolEntry {
  id: string
  category: string
  layer: string
  human_char: string
  ui_visual: string
  machine_lang: string
  notes: string
  sort_order: number
}

// ── TabBtn 原子组件 ───────────────────────────────────────────────
function TabBtn({
  active, color, onClick, children,
}: {
  active: boolean; color: string; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1 rounded text-[11px] font-medium whitespace-nowrap shrink-0 transition-all"
      style={{
        color: active ? color : 'rgba(255,255,255,0.35)',
        background: active ? color + '18' : 'transparent',
        borderBottom: active ? `2px solid ${color}` : '2px solid transparent',
      }}
    >
      {children}
    </button>
  )
}

// ── 分组结构 ──────────────────────────────────────────────────────
const GROUPS = [
  {
    label: '资源权限通信层',
    accent: '#34d399',
    categories: [
      { id: 'permission-layer', label: '权限层级'     },
      { id: 'communication',     label: '通信机制'     },
      { id: 'resource-tier',     label: '智能资源分级' },
    ],
  },
  {
    label: '分级约束控制层',
    accent: '#f59e0b',
    categories: [
      { id: 'P',   label: 'P 模式' },
      { id: 'R',   label: 'R 关系' },
      { id: 'V',   label: 'V 价值' },
      { id: 'S',   label: 'S 状态' },
      { id: 'AOP', label: 'AOP'   },
    ],
  },
  {
    label: '实践层',
    accent: '#60a5fa',
    categories: [
      { id: 'interaction',   label: '交互操作'  },
      { id: 'ui-component', label: 'UI 组件库' },
    ],
  },
]

// 展平供筛选逻辑使用
const ALL_CATEGORIES = [
  { id: '', label: '全部' },
  ...GROUPS.flatMap(g => g.categories),
]

const CATEGORY_COLORS: Record<string, string> = {
  interaction: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  layer:       'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  R:           'text-purple-400 bg-purple-500/10 border-purple-500/30',
  P:           'text-amber-400 bg-amber-500/10 border-amber-500/30',
  V:           'text-orange-400 bg-orange-500/10 border-orange-500/30',
  AOP:         'text-pink-400 bg-pink-500/10 border-pink-500/30',
  S:            'text-emerald-300 bg-emerald-500/15 border-emerald-400/40',
  'ui-component': 'text-sky-300 bg-sky-500/15 border-sky-400/40',
  'resource-tier':    'text-teal-300 bg-teal-500/15 border-teal-400/40',
  'permission-layer': 'text-emerald-300 bg-emerald-500/15 border-emerald-400/40',
  'communication':    'text-green-300 bg-green-500/15 border-green-400/40',
}

function prettyJson(raw: string): string {
  try { return JSON.stringify(JSON.parse(raw), null, 2) }
  catch { return raw }
}

// ── Inline editable cell ──────────────────────────────────────────
function EditCell({
  value, multiline, monospace, onChange,
}: {
  value: string
  multiline?: boolean
  monospace?: boolean
  onChange: (v: string) => void
}) {
  const cls = `w-full bg-transparent outline-none resize-none text-white/70 placeholder-white/20
    focus:bg-white/[0.03] rounded px-1 -mx-1 transition-colors
    ${monospace ? 'font-mono text-[10px] leading-relaxed' : 'text-[11px]'}`
  if (multiline) {
    return (
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={3}
        className={cls}
      />
    )
  }
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      className={cls + ' border-b border-transparent hover:border-white/10 focus:border-white/20'}
    />
  )
}

// ── 可视化单元格：正常显示视觉组件，hover 展开 JSON 编辑器 ─────────
function VisualCell({ category, layer, uiVisual, onChange }: {
  category: string
  layer: string
  uiVisual: string
  onChange: (v: string) => void
}) {
  const [editing, setEditing] = useState(false)
  return (
    <div className="space-y-1.5">
      {/* 视觉渲染 */}
      <ProtocolVisual category={category} layer={layer} uiVisual={uiVisual} />
      {/* JSON 编辑切换 */}
      <button
        onClick={() => setEditing(p => !p)}
        className="flex items-center gap-0.5 text-[9px] text-white/20 hover:text-white/40 transition-colors"
      >
        <Code2 size={9} />
        {editing ? '收起' : 'JSON'}
      </button>
      {editing && (
        <textarea
          value={prettyJson(uiVisual)}
          onChange={e => onChange(e.target.value)}
          rows={4}
          className="w-full text-[10px] font-mono bg-black/30 border border-white/[0.08] rounded px-2 py-1 text-white/50 outline-none resize-y focus:border-white/15"
          spellCheck={false}
        />
      )}
    </div>
  )
}

// ── Row ──────────────────────────────────────────────────────────
function ProtocolRow({
  entry, onSave, onDelete,
}: {
  entry: ProtocolEntry
  onSave: (id: string, patch: Partial<ProtocolEntry>) => void
  onDelete: (id: string) => void
}) {
  const [local, setLocal] = useState(entry)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => { setLocal(entry); setDirty(false) }, [entry.id])

  const patch = (k: keyof ProtocolEntry, v: string | number) => {
    setLocal(p => ({ ...p, [k]: v }))
    setDirty(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      await authFetch(`/protocol/${local.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(local),
      })
      onSave(local.id, local)
      setDirty(false)
    } finally {
      setSaving(false)
    }
  }

  const catCls = CATEGORY_COLORS[local.category] ?? 'text-white/40 bg-white/[0.04] border-white/10'
  const isLive = local.category === 'S'

  return (
    <tr
      className="border-b border-white/[0.05] hover:bg-white/[0.02] group"
      style={isLive ? { borderLeft: '2px solid #10b98150', background: '#10b98105' } : undefined}
    >
      {/* 分类+层 */}
      <td className="py-2 px-2 w-28 align-top">
        <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${catCls}`}>
          {isLive && (
            <span className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0" style={{ background: '#10b981' }} />
          )}
          {local.category || '—'}
        </div>
        {local.layer && (
          <div className="mt-1 text-[9px] text-white/30 font-mono">{local.layer}</div>
        )}
        <input
          value={local.sort_order}
          type="number"
          onChange={e => patch('sort_order', Number(e.target.value))}
          className="mt-1 w-12 text-[9px] text-white/20 bg-transparent outline-none border-b border-white/[0.06] font-mono"
        />
      </td>

      {/* 人类字符 */}
      <td className="py-2 px-2 align-top w-40">
        <EditCell value={local.human_char} onChange={v => patch('human_char', v)} />
        {local.notes && (
          <div className="mt-1 text-[9px] text-white/25 italic leading-snug">{local.notes}</div>
        )}
      </td>

      {/* UI 可视化 */}
      <td className="py-2 px-2 align-top min-w-[160px]">
        <VisualCell
          category={local.category}
          layer={local.layer}
          uiVisual={local.ui_visual}
          onChange={v => patch('ui_visual', v)}
        />
      </td>

      {/* 机器语言 */}
      <td className="py-2 px-2 align-top">
        <EditCell
          value={local.machine_lang}
          multiline
          monospace
          onChange={v => patch('machine_lang', v)}
        />
      </td>

      {/* 操作 */}
      <td className="py-2 px-2 align-top w-14">
        <div className="flex flex-col gap-1 items-center opacity-0 group-hover:opacity-100 transition-opacity">
          {dirty && (
            <button
              onClick={save} disabled={saving}
              className="p-1 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 disabled:opacity-40"
              title="保存"
            >
              <Save size={11} />
            </button>
          )}
          <button
            onClick={() => onDelete(entry.id)}
            className="p-1 rounded bg-red-500/10 text-red-400/60 hover:bg-red-500/20 hover:text-red-400"
            title="删除"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── 候选 UI 可视化选择器 ──────────────────────────────────────────
/**
 * VisualTemplatePicker
 * 根据 category 加载已有协议条目，渲染为可点击的视觉缩略卡片
 * 点击 → 将该条目的 ui_visual / layer / machine_lang 填入新增表单
 */
function VisualTemplatePicker({
  category,
  selected,
  onSelect,
}: {
  category: string
  selected: string   // 当前 ui_visual JSON
  onSelect: (entry: { layer: string; ui_visual: string; machine_lang: string }) => void
}) {
  const [templates, setTemplates] = useState<ProtocolEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(true)

  useEffect(() => {
    if (!category) return
    setLoading(true)
    authFetch<ProtocolEntry[]>(`/protocol?category=${category}`)
      .then(rows => setTemplates(rows))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [category])

  if (!templates.length && !loading) return (
    <div className="text-[9px] text-white/20 italic py-1">该分类暂无候选模板</div>
  )

  return (
    <div className="space-y-1.5">
      {/* 收起/展开 */}
      <button
        onClick={() => setOpen(p => !p)}
        className="flex items-center gap-1 text-[9px] text-white/30 hover:text-white/50 transition-colors"
      >
        <ChevronDown size={9} className={`transition-transform ${open ? '' : '-rotate-90'}`} />
        {open ? '收起候选' : `展开候选（${templates.length}）`}
      </button>

      {open && (
        <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
          {loading && (
            <div className="col-span-2 text-[9px] text-white/20 py-2 text-center">加载中…</div>
          )}
          {templates.map(t => {
            const isActive = selected === t.ui_visual
            return (
              <button
                key={t.id}
                onClick={() => onSelect({ layer: t.layer, ui_visual: t.ui_visual, machine_lang: t.machine_lang })}
                className={`text-left p-2 rounded border transition-all group ${
                  isActive
                    ? 'border-blue-500/50 bg-blue-500/10'
                    : 'border-white/[0.06] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]'
                }`}
              >
                {/* 视觉预览 */}
                <div className="mb-1.5 pointer-events-none overflow-hidden">
                  <ProtocolVisual
                    category={t.category}
                    layer={t.layer}
                    uiVisual={t.ui_visual}
                  />
                </div>
                {/* 标签 */}
                <div className="text-[9px] text-white/50 group-hover:text-white/70 leading-tight truncate">
                  {t.human_char}
                </div>
                {t.layer && (
                  <div className="text-[8px] text-white/25 font-mono mt-0.5">{t.layer}</div>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── New entry form ───────────────────────────────────────────────
function NewEntryForm({
  onCreated, onCancel,
}: {
  onCreated: (entry: ProtocolEntry) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState({
    category: 'interaction', layer: '', human_char: '', ui_visual: '{}', machine_lang: '', notes: '', sort_order: 0,
  })
  const [saving, setSaving] = useState(false)
  const [showJson, setShowJson] = useState(false)

  const save = async () => {
    if (!form.human_char.trim()) return
    setSaving(true)
    try {
      const entry = await authFetch<ProtocolEntry>('/protocol', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      onCreated(entry)
    } finally {
      setSaving(false)
    }
  }

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(p => ({ ...p, [k]: e.target.value }))
    if (k === 'category') { setShowJson(false) }
  }

  return (
    <tr className="border-b border-blue-500/20 bg-blue-500/[0.03]">
      <td className="py-2 px-2 align-top">
        <select value={form.category} onChange={f('category')}
          className="w-full text-[10px] bg-[#1a1a2e] border border-white/10 rounded px-1 py-0.5 text-white/60 outline-none mb-1">
          {ALL_CATEGORIES.filter(c => c.id).map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <input value={form.layer} onChange={f('layer')} placeholder="layer…"
          className="w-full text-[10px] bg-transparent outline-none text-white/40 border-b border-white/10 font-mono" />
      </td>
      <td className="py-2 px-2 align-top">
        <input value={form.human_char} onChange={f('human_char')} placeholder="人类字符…"
          className="w-full text-[11px] bg-transparent outline-none text-white/70 border-b border-white/20 mb-1" />
        <input value={form.notes} onChange={f('notes')} placeholder="备注（可选）…"
          className="w-full text-[9px] bg-transparent outline-none text-white/30 border-b border-white/10" />
      </td>
      <td className="py-2 px-2 align-top min-w-[200px]">
        {/* 候选选择器 */}
        <VisualTemplatePicker
          category={form.category}
          selected={form.ui_visual}
          onSelect={({ layer, ui_visual, machine_lang }) =>
            setForm(p => ({
              ...p,
              layer: layer || p.layer,
              ui_visual,
              machine_lang: machine_lang || p.machine_lang,
            }))
          }
        />

        {/* 当前已选预览 */}
        {form.ui_visual !== '{}' && (
          <div className="mt-2 p-1.5 rounded border border-white/[0.06] bg-white/[0.02]">
            <div className="text-[8px] text-white/25 mb-1">已选预览</div>
            <ProtocolVisual
              category={form.category}
              layer={form.layer}
              uiVisual={form.ui_visual}
            />
          </div>
        )}

        {/* JSON 手动编辑（折叠） */}
        <button
          onClick={() => setShowJson(p => !p)}
          className="mt-1.5 flex items-center gap-0.5 text-[9px] text-white/20 hover:text-white/40"
        >
          <Code2 size={9} />
          {showJson ? '收起 JSON' : '手动编辑 JSON'}
        </button>
        {showJson && (
          <textarea value={prettyJson(form.ui_visual)} onChange={f('ui_visual')} rows={4}
            className="mt-1 w-full text-[10px] font-mono bg-black/20 border border-white/[0.08] rounded px-2 py-1 text-white/50 outline-none resize-y" />
        )}
      </td>
      <td className="py-2 px-2 align-top">
        <textarea value={form.machine_lang} onChange={f('machine_lang')} rows={3}
          className="w-full text-[10px] font-mono bg-transparent outline-none text-white/60 resize-none" />
      </td>
      <td className="py-2 px-2 align-top">
        <div className="flex flex-col gap-1">
          <button onClick={save} disabled={saving || !form.human_char.trim()}
            className="p-1 rounded bg-blue-500/30 text-blue-300 hover:bg-blue-500/40 disabled:opacity-40">
            <Save size={11} />
          </button>
          <button onClick={onCancel}
            className="p-1 rounded bg-white/[0.05] text-white/30 hover:text-white/50">
            <X size={11} />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── Main ─────────────────────────────────────────────────────────
export default function ProtocolView() {
  const [entries, setEntries] = useState<ProtocolEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [catFilter, setCatFilter] = useState('')
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // 前端 id → 后端 API category 映射
      const catMap: Record<string, string> = {
        'permission-layer': 'layer',
        'resource-tier':   'resource-tier',
        'communication':   'communication',
      }
      const apiCat = catMap[catFilter] ?? catFilter
      const url = apiCat ? `/protocol?category=${apiCat}` : '/protocol'
      const rows = await authFetch<ProtocolEntry[]>(url)
      setEntries(rows)
    } finally {
      setLoading(false)
    }
  }, [catFilter])

  useEffect(() => { load() }, [load])

  const onSave = useCallback((id: string, patch: Partial<ProtocolEntry>) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e))
  }, [])

  const onDelete = useCallback(async (id: string) => {
    await authFetch(`/protocol/${id}`, { method: 'DELETE' })
    setEntries(prev => prev.filter(e => e.id !== id))
  }, [])

  const onCreated = useCallback((entry: ProtocolEntry) => {
    setEntries(prev => [...prev, entry])
    setAdding(false)
  }, [])

  return (
    <div className="h-screen flex flex-col bg-[#0d0d0d] overflow-hidden">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-5 py-3 border-b border-white/[0.06] bg-[#111]">
        <div>
          <h1 className="text-sm font-bold text-white/90">人机协作协议</h1>
          <p className="text-[10px] text-white/30">Human-Machine Collaboration Protocol — 定义 人类字符 ↔ UI可视化 ↔ 机器语言 的映射宪法</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] text-white/30">{entries.length} 条</span>
          <button
            onClick={() => setAdding(true)}
            disabled={adding}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 border border-blue-500/30
              text-blue-300 text-[11px] hover:bg-blue-600/30 disabled:opacity-40 transition-all"
          >
            <Plus size={11} />
            新增条目
          </button>
        </div>
      </div>

      {/* 三层 Tab 栏 */}
      <div className="shrink-0 border-b border-white/[0.06]">
        {/* 全部 */}
        <div className="flex items-center px-4 pt-2">
          <TabBtn active={catFilter === ''} color="#ffffff" onClick={() => setCatFilter('')}>
            全部
          </TabBtn>
        </div>

        {/* 三个层级行 */}
        {GROUPS.map((group) => (
          <div
            key={group.label}
            className="flex items-center px-4 py-1.5 border-t border-white/[0.05]"
          >
            {/* 层名标签 */}
            <div
              className="text-[10px] font-bold uppercase tracking-widest w-40 shrink-0 pr-3"
              style={{ color: group.accent }}
            >
              {group.label}
            </div>

            {/* 该层 tabs */}
            <div className="flex items-center gap-1 flex-wrap">
              {group.categories.map((c) => {
                const isActive = catFilter === c.id
                return (
                  <TabBtn
                    key={c.id}
                    active={isActive}
                    color={group.accent}
                    onClick={() => setCatFilter(c.id)}
                  >
                    {c.label}
                  </TabBtn>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-white/30 text-sm">加载中…</div>
        ) : catFilter === 'communication' ? (
          /* 通信机制：L0/L1/L2 流水线 */
          <div className="flex-1 overflow-auto p-6">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-6">
                <h2 className="text-base font-bold text-white/80 mb-1">通信机制</h2>
                <p className="text-[11px] text-white/30">AI ↛ AI 直接通信 · 必须经过 Control Bus 校验</p>
              </div>
              <CommunicationPipeline entries={entries} />
            </div>
          </div>
        ) : catFilter === 'resource-tier' ? (
          /* 智能资源分级：流水线卡片 */
          <div className="flex-1 overflow-auto p-6">
            <div className="max-w-3xl mx-auto space-y-6">
              {/* 标题区 */}
              <div className="text-center mb-8">
                <h2 className="text-base font-bold text-white/80 mb-1">智能资源分级</h2>
                <p className="text-[11px] text-white/30">Claude → Minimax → Qwen0.8B · 升级条件驱动路由</p>
              </div>
              {/* 流水线 */}
              <ResourceTierVisual
                vis={{
                  tiers: entries.map(e => {
                    const v = (() => { try { return JSON.parse(e.ui_visual) } catch { return {} } })()
                    return {
                      tier: v.tier as number,
                      label: v.label as string,
                      emoji: v.emoji as string,
                      color: v.color as string,
                      cost: v.cost_per_1k as number,
                      note: v.rl_capable ? 'RL 可训练' : (v.skills_enabled ? 'skills 扩展' : '高成本'),
                      escalate_if: v.escalate_if as string | undefined,
                    }
                  }),
                }}
              />
              {/* 说明 */}
              <div className="mt-6 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                <div className="text-[10px] text-white/30 mb-3 uppercase tracking-widest font-bold">升级规则</div>
                <div className="space-y-2">
                  {[
                    { from: '三级 Qwen 0.8B', to: '二级 Minimax', cond: 'confidence < 0.6', color: '#9ca3af' },
                    { from: '二级 Minimax', to: '一级 Claude', cond: 'complexity > 0.8', color: '#60a5fa' },
                  ].map(rule => (
                    <div key={rule.from} className="flex items-center gap-3 text-[11px]">
                      <span className="font-medium" style={{ color: rule.color }}>{rule.from}</span>
                      <span className="text-white/30">→</span>
                      <span className="text-white/50">{rule.to}</span>
                      <span className="ml-auto text-white/25 font-mono text-[10px]">if {rule.cond}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-[#111] border-b border-white/[0.06]">
              <tr>
                <th className="py-2 px-2 text-[10px] text-white/30 font-medium w-28">分类 / 层</th>
                <th className="py-2 px-2 text-[10px] text-white/30 font-medium w-40">人类字符</th>
                <th className="py-2 px-2 text-[10px] text-white/30 font-medium">UI 可视化（JSON）</th>
                <th className="py-2 px-2 text-[10px] text-white/30 font-medium">机器语言 / 代码</th>
                <th className="py-2 px-2 w-14" />
              </tr>
            </thead>
            <tbody>
              {adding && (
                <NewEntryForm onCreated={onCreated} onCancel={() => setAdding(false)} />
              )}
              {entries.map(e => (
                <ProtocolRow key={e.id} entry={e} onSave={onSave} onDelete={onDelete} />
              ))}
              {entries.length === 0 && !adding && (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-white/20 text-sm">
                    暂无条目 — 点击「新增条目」开始
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
