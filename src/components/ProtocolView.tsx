/**
 * ProtocolView — 人机协作协议 CRUD
 * 设计：Modern Dark (Cinema) — OLED 深色 · 毛玻璃 · 分层霓虹accent
 * 字号规范：正文≥12px，次要文字≥11px，辅助文字≥11px，绝不用 <11px
 */
import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Save, X, Code2, ChevronDown, Anchor } from 'lucide-react'
import { authFetch } from '@/lib/http'
import { useTagTreeStore } from '@/stores/useTagTreeStore'
import ProtocolVisual from './ProtocolVisual'
import { ResourceTierVisual } from '@/design/components/ResourceTierVisual'
import { CommunicationPipeline } from '@/design/components/CommunicationVisual'

interface ProtocolEntry {
  id: string; category: string; layer: string
  human_char: string; ui_visual: string
  machine_lang: string; notes: string; sort_order: number
  anchor_tag_id?: string
}

// category → anchor_tag_id 默认映射（与 migration 脚本一致）
const CATEGORY_ANCHOR_MAP: Record<string, string> = {
  'P':              'tag-p',
  'V':              'tag-v',
  'R':              'tag-r',
  'S':              'tag-s',
  'interaction':    'tag-1774859312423-vicym',
  'communication':  'tag-1774862243393-6np0u',
  'resource-tier':  'tag-1774862651534-yzhzl',
  'layer':          'tag-1774561713452-bzfga',
  'lifecycle':      'tag-s',
  'AOP':            'tag-r',
  'ui-component':   'tag-e-ui-components',
  'kernel-comp':    'tag-e-system-roles',
  'graph-node':     'tag-e-system-roles',
  'permission-layer': 'tag-1774561713452-bzfga',
}

// ── 配色系统 ──────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, { color: string; bg: string; border: string; glow: string }> = {
  interaction:         { color: '#60a5fa', bg: 'rgba(96,165,250,0.08)',  border: 'rgba(96,165,250,0.25)',  glow: 'rgba(96,165,250,0.15)' },
  layer:             { color: '#34d399', bg: 'rgba(52,211,153,0.08)',  border: 'rgba(52,211,153,0.25)',  glow: 'rgba(52,211,153,0.15)' },
  R:                { color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.25)', glow: 'rgba(167,139,250,0.15)' },
  P:                { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.25)',  glow: 'rgba(245,158,11,0.15)' },
  V:                { color: '#fb923c', bg: 'rgba(251,146,60,0.08)',  border: 'rgba(251,146,60,0.25)',  glow: 'rgba(251,146,60,0.15)' },
  AOP:              { color: '#f472b6', bg: 'rgba(244,114,182,0.08)', border: 'rgba(244,114,182,0.25)', glow: 'rgba(244,114,182,0.15)' },
  S:                { color: '#10b981', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.25)',  glow: 'rgba(16,185,129,0.15)' },
  'ui-component':   { color: '#38bdf8', bg: 'rgba(56,189,248,0.08)',  border: 'rgba(56,189,248,0.25)',  glow: 'rgba(56,189,248,0.15)' },
  'kernel-comp':    { color: '#c084fc', bg: 'rgba(192,132,252,0.08)', border: 'rgba(192,132,252,0.25)', glow: 'rgba(192,132,252,0.15)' },
  'lifecycle':      { color: '#fbbf24', bg: 'rgba(251,191,36,0.08)',  border: 'rgba(251,191,36,0.25)',  glow: 'rgba(251,191,36,0.15)' },
  'graph-node':     { color: '#22d3ee', bg: 'rgba(34,211,238,0.08)',  border: 'rgba(34,211,238,0.25)',  glow: 'rgba(34,211,238,0.15)' },
  'resource-tier':  { color: '#2dd4bf', bg: 'rgba(45,212,191,0.08)',  border: 'rgba(45,212,191,0.25)',  glow: 'rgba(45,212,191,0.15)' },
  'permission-layer':{ color: '#4ade80', bg: 'rgba(74,222,128,0.08)', border: 'rgba(74,222,128,0.25)', glow: 'rgba(74,222,128,0.15)' },
  'communication':   { color: '#86efac', bg: 'rgba(134,239,172,0.08)',  border: 'rgba(134,239,172,0.25)', glow: 'rgba(134,239,172,0.15)' },
}

const GROUPS = [
  { label: '资源权限通信层', accent: '#34d399', categories: [
    { id: 'permission-layer', label: '权限层级' }, { id: 'communication', label: '通信机制' }, { id: 'resource-tier', label: '智能资源分级' },
  ]},
  { label: '分级约束控制层', accent: '#f59e0b', categories: [
    { id: 'P', label: 'P 模式' }, { id: 'R', label: 'R 关系' }, { id: 'V', label: 'V 价值' }, { id: 'S', label: 'S 状态' }, { id: 'AOP', label: 'AOP' },
  ]},
  { label: '实践层', accent: '#a78bfa', categories: [
    { id: 'interaction', label: '交互操作' }, { id: 'ui-component', label: 'UI 组件库' },
    { id: 'kernel-comp', label: 'Kernel 组件' }, { id: 'lifecycle', label: '生命周期态' }, { id: 'graph-node', label: 'Graph 节点' },
  ]},
]

const ALL_CATEGORIES = [{ id: '', label: '全部' }, ...GROUPS.flatMap(g => g.categories)]

// ── TabBtn — 胶囊发光标签 ───────────────────────────────────────
function TabBtn({ active, color, onClick, children }: {
  active: boolean; color: string; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button onClick={onClick}
      className="px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap shrink-0 transition-all duration-200 border cursor-pointer"
      style={{
        color:       active ? color              : 'rgba(255,255,255,0.35)',
        background:  active ? `${color}18`       : 'transparent',
        borderColor: active ? `${color}55`      : 'rgba(255,255,255,0.08)',
        boxShadow:    active ? `0 0 10px ${color}30` : 'none',
        fontWeight:  active ? 600 : 400,
      }}>
      {children}
    </button>
  )
}

// ── 辅助 ──────────────────────────────────────────────────────────
function prettyJson(raw: string): string {
  try { return JSON.stringify(JSON.parse(raw), null, 2) } catch { return raw }
}

/** 锚定标签徽章 — 显示 TagTree 锚点名称 */
function AnchorBadge({ tagId }: { tagId?: string }) {
  const { findTag } = useTagTreeStore()
  if (!tagId) return <span className="text-[10px] text-red-400/60 italic">未锚定</span>
  const tag = findTag(tagId)
  if (!tag) return <span className="text-[10px] text-white/20 font-mono">{tagId.slice(0, 12)}</span>
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-white/40">
      <Anchor size={9} className="text-white/25" />
      <span style={{ color: tag.color || '#6b7280' }}>{tag.name}</span>
    </span>
  )
}

// ── Inline editable cell — 正文12px，次要文字11px ────────────────────
function EditCell({ value, multiline, monospace, onChange }: {
  value: string; multiline?: boolean; monospace?: boolean; onChange: (v: string) => void
}) {
  const cls = `w-full bg-transparent outline-none resize-none
    focus:bg-white/[0.04] rounded px-1 -mx-1 transition-colors
    ${monospace
      ? 'font-mono text-[11px] text-white/55 leading-relaxed'
      : 'text-[12px] text-white/65 placeholder-white/25 leading-snug'}`
  if (multiline) {
    return <textarea value={value} onChange={e => onChange(e.target.value)} rows={3} className={cls} />
  }
  return (
    <input value={value} onChange={e => onChange(e.target.value)}
      className={cls + ' border-b border-transparent hover:border-white/12 focus:border-white/20'} />
  )
}

// ── 可视化单元格 ─────────────────────────────────────────────────
function VisualCell({ category, layer, uiVisual, onChange }: {
  category: string; layer: string; uiVisual: string; onChange: (v: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const cfg = CATEGORY_COLORS[category]

  return (
    <div className="space-y-2">
      <div className="rounded-xl p-3 border transition-all duration-200"
        style={{
          background: cfg ? cfg.bg : 'rgba(255,255,255,0.03)',
          borderColor: cfg ? cfg.border : 'rgba(255,255,255,0.09)',
          boxShadow: editing ? (cfg ? `0 0 16px ${cfg.glow}` : 'none') : (cfg ? `0 0 6px ${cfg.glow}50` : 'none'),
        }}>
        <ProtocolVisual category={category} layer={layer} uiVisual={uiVisual} />
      </div>

      <button onClick={() => setEditing(p => !p)}
        className="flex items-center gap-1 text-[11px] text-white/40 hover:text-white/65 transition-colors">
        <Code2 size={10} />
        {editing ? '收起' : 'JSON'}
      </button>

      {editing && (
        <textarea value={prettyJson(uiVisual)} onChange={e => onChange(e.target.value)} rows={4}
          className="w-full text-[11px] font-mono bg-black/50 border border-white/08 rounded-xl px-3 py-2 text-white/50 outline-none resize-y focus:border-white/15"
          spellCheck={false} />
      )}
    </div>
  )
}

// ── Row ──────────────────────────────────────────────────────────
function ProtocolRow({ entry, onSave, onDelete }: {
  entry: ProtocolEntry; onSave: (id: string, patch: Partial<ProtocolEntry>) => void; onDelete: (id: string) => void
}) {
  const [local, setLocal] = useState(entry)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => { setLocal(entry); setDirty(false) }, [entry.id])

  const patch = (k: keyof ProtocolEntry, v: string | number) => {
    setLocal(p => ({ ...p, [k]: v })); setDirty(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      await authFetch(`/protocol/${local.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(local),
      })
      onSave(local.id, local); setDirty(false)
    } finally { setSaving(false) }
  }

  const cfg = CATEGORY_COLORS[local.category]

  return (
    <tr className="group transition-colors duration-150"
      style={{
        background: cfg ? cfg.bg : 'rgba(255,255,255,0.015)',
        borderLeft: cfg ? `3px solid ${cfg.color}70` : '3px solid transparent',
      }}>

      {/* 分类+层 */}
      <td className="py-3 px-4 w-36 align-top">
        <div className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold border mb-2"
          style={{
            color: cfg?.color ?? 'rgba(255,255,255,0.45)',
            background: cfg?.bg ?? 'rgba(255,255,255,0.04)',
            borderColor: cfg?.border ?? 'rgba(255,255,255,0.09)',
          }}>
          {local.category}
        </div>
        <div className="mb-1"><AnchorBadge tagId={local.anchor_tag_id} /></div>
        {local.layer && (
          <div className="text-[11px] font-mono mb-1" style={{ color: cfg ? `${cfg.color}55` : 'rgba(255,255,255,0.25)' }}>
            {local.layer}
          </div>
        )}
        <input value={local.sort_order} type="number" onChange={e => patch('sort_order', Number(e.target.value))}
          className="w-14 text-[11px] font-mono text-white/20 bg-transparent outline-none border-b border-white/06" />
      </td>

      {/* 人类字符 */}
      <td className="py-3 px-4 align-top w-48">
        <EditCell value={local.human_char} onChange={v => patch('human_char', v)} />
        {local.notes && (
          <div className="mt-1.5 text-[11px] text-white/30 italic leading-snug">{local.notes}</div>
        )}
      </td>

      {/* UI 可视化 */}
      <td className="py-3 px-4 align-top min-w-[220px]">
        <VisualCell category={local.category} layer={local.layer} uiVisual={local.ui_visual}
          onChange={v => patch('ui_visual', v)} />
      </td>

      {/* 机器语言 */}
      <td className="py-3 px-4 align-top">
        <EditCell value={local.machine_lang} multiline monospace onChange={v => patch('machine_lang', v)} />
      </td>

      {/* 操作 */}
      <td className="py-3 px-4 align-top w-16">
        <div className="flex flex-col gap-1.5 items-center opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          {dirty && (
            <button onClick={save} disabled={saving}
              className="p-1.5 rounded-lg border transition-all cursor-pointer"
              style={{ background: 'rgba(59,130,246,0.15)', borderColor: 'rgba(59,130,246,0.35)', color: '#60a5fa' }}
              title="保存"><Save size={12} /></button>
          )}
          <button onClick={() => onDelete(entry.id)}
            className="p-1.5 rounded-lg border transition-all cursor-pointer"
            style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.22)', color: 'rgba(239,68,68,0.65)' }}
            title="删除"><Trash2 size={12} /></button>
        </div>
      </td>
    </tr>
  )
}

// ── 候选模板选择器 ────────────────────────────────────────────────
function VisualTemplatePicker({ category, selected, onSelect }: {
  category: string; selected: string
  onSelect: (e: { layer: string; ui_visual: string; machine_lang: string }) => void
}) {
  const [templates, setTemplates] = useState<ProtocolEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(true)

  useEffect(() => {
    if (!category) return
    setLoading(true)
    authFetch<ProtocolEntry[]>(`/protocol?category=${category}`)
      .then(rows => setTemplates(rows)).catch(() => {}).finally(() => setLoading(false))
  }, [category])

  if (!templates.length && !loading) return <div className="text-[11px] text-white/25 italic py-1">该分类暂无候选模板</div>

  return (
    <div className="space-y-2">
      <button onClick={() => setOpen(p => !p)}
        className="flex items-center gap-1 text-[11px] text-white/35 hover:text-white/60 transition-colors">
        <ChevronDown size={10} className={`transition-transform duration-150 ${open ? '' : '-rotate-90'}`} />
        {open ? '收起候选' : `展开候选（${templates.length}）`}
      </button>

      {open && (
        <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
          {loading && <div className="col-span-2 text-[11px] text-white/25 py-2 text-center">加载中…</div>}
          {templates.map(t => {
            const isActive = selected === t.ui_visual
            const cfg = CATEGORY_COLORS[t.category]
            return (
              <button key={t.id}
                onClick={() => onSelect({ layer: t.layer, ui_visual: t.ui_visual, machine_lang: t.machine_lang })}
                className="text-left p-3 rounded-xl border transition-all cursor-pointer group"
                style={{
                  background: isActive ? (cfg ? cfg.bg : 'rgba(59,130,246,0.1)') : 'rgba(255,255,255,0.02)',
                  borderColor: isActive ? (cfg ? `${cfg.color}55` : 'rgba(59,130,246,0.5)') : 'rgba(255,255,255,0.08)',
                  boxShadow: isActive ? (cfg ? `0 0 12px ${cfg.glow}` : '0 0 12px rgba(59,130,246,0.2)') : 'none',
                }}>
                <div className="mb-2 pointer-events-none overflow-hidden rounded-lg">
                  <ProtocolVisual category={t.category} layer={t.layer} uiVisual={t.ui_visual} />
                </div>
                <div className="text-[11px] text-white/50 group-hover:text-white/75 leading-tight truncate font-medium">
                  {t.human_char}
                </div>
                {t.layer && (
                  <div className="text-[11px] font-mono mt-0.5" style={{ color: cfg ? `${cfg.color}50` : 'rgba(255,255,255,0.25)' }}>
                    {t.layer}
                  </div>
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
function NewEntryForm({ onCreated, onCancel }: {
  onCreated: (entry: ProtocolEntry) => void; onCancel: () => void
}) {
  const [form, setForm] = useState({
    category: 'interaction', layer: '', human_char: '', ui_visual: '{}', machine_lang: '', notes: '', sort_order: 0,
    anchor_tag_id: CATEGORY_ANCHOR_MAP['interaction'] || '',
  })
  const [saving, setSaving] = useState(false)
  const [showJson, setShowJson] = useState(false)

  const save = async () => {
    if (!form.human_char.trim()) return
    setSaving(true)
    try {
      const entry = await authFetch<ProtocolEntry>('/protocol', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      onCreated(entry)
    } finally { setSaving(false) }
  }

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const val = e.target.value
    setForm(p => {
      const next = { ...p, [k]: val }
      // 切换 category 时自动更新 anchor_tag_id
      if (k === 'category') next.anchor_tag_id = CATEGORY_ANCHOR_MAP[val] || ''
      return next
    })
    if (k === 'category') setShowJson(false)
  }

  return (
    <tr style={{ background: 'rgba(59,130,246,0.06)', borderLeft: '3px solid rgba(59,130,246,0.5)' }}>
      <td className="py-3 px-4 align-top">
        <select value={form.category} onChange={f('category')}
          className="w-full text-[11px] rounded-lg px-2 py-1.5 outline-none mb-2 cursor-pointer"
          style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}>
          {ALL_CATEGORIES.filter(c => c.id).map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <input value={form.layer} onChange={f('layer')} placeholder="layer…"
          className="w-full text-[11px] bg-transparent outline-none text-white/40 border-b border-white/10 font-mono" />
      </td>
      <td className="py-3 px-4 align-top">
        <input value={form.human_char} onChange={f('human_char')} placeholder="人类字符…"
          className="w-full text-[12px] bg-transparent outline-none text-white/7 border-b border-white/15 mb-2" />
        <input value={form.notes} onChange={f('notes')} placeholder="备注（可选）…"
          className="w-full text-[11px] bg-transparent outline-none text-white/3 border-b border-white/08" />
      </td>
      <td className="py-3 px-4 align-top min-w-[220px]">
        <VisualTemplatePicker category={form.category} selected={form.ui_visual}
          onSelect={({ layer, ui_visual, machine_lang }) =>
            setForm(p => ({ ...p, layer: layer || p.layer, ui_visual, machine_lang: machine_lang || p.machine_lang }))
          } />
        {form.ui_visual !== '{}' && (
          <div className="mt-2 p-2 rounded-xl border"
            style={{ background: 'rgba(255,255,255,0.025)', borderColor: 'rgba(255,255,255,0.07)' }}>
            <div className="text-[10px] text-white/2 mb-1">已选预览</div>
            <ProtocolVisual category={form.category} layer={form.layer} uiVisual={form.ui_visual} />
          </div>
        )}
        <button onClick={() => setShowJson(p => !p)}
          className="mt-2 flex items-center gap-1 text-[11px] text-white/35 hover:text-white/6 transition-colors">
          <Code2 size={10} />{showJson ? '收起 JSON' : '手动编辑 JSON'}
        </button>
        {showJson && (
          <textarea value={prettyJson(form.ui_visual)} onChange={f('ui_visual')} rows={4}
            className="mt-1 w-full text-[11px] font-mono bg-black/50 border border-white/08 rounded-xl px-3 py-2 text-white/5 outline-none resize-y" />
        )}
      </td>
      <td className="py-3 px-4 align-top">
        <textarea value={form.machine_lang} onChange={f('machine_lang')} rows={3}
          className="w-full text-[11px] font-mono bg-transparent outline-none text-white/55 resize-none" />
      </td>
      <td className="py-3 px-4 align-top">
        <div className="flex flex-col gap-1.5">
          <button onClick={save} disabled={saving || !form.human_char.trim()}
            className="p-1.5 rounded-lg border transition-all cursor-pointer disabled:opacity-30"
            style={{ background: 'rgba(59,130,246,0.2)', borderColor: 'rgba(59,130,246,0.4)', color: '#60a5fa' }}>
            <Save size={12} />
          </button>
          <button onClick={onCancel}
            className="p-1.5 rounded-lg border transition-all cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.35)' }}>
            <X size={12} />
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
  const { tree, loadTree } = useTagTreeStore()

  // 确保 TagTree 已加载（AnchorBadge 依赖 findTag）
  useEffect(() => { if (!tree.length) loadTree() }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const catMap: Record<string, string> = { 'permission-layer': 'layer', 'resource-tier': 'resource-tier', 'communication': 'communication' }
      const apiCat = catMap[catFilter] ?? catFilter
      const rows = await authFetch<ProtocolEntry[]>(apiCat ? `/protocol?category=${apiCat}` : '/protocol')
      setEntries(rows)
    } finally { setLoading(false) }
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
    setEntries(prev => [...prev, entry]); setAdding(false)
  }, [])

  return (
    <div className="h-screen flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #06060a 0%, #050507 100%)' }}>

      {/* Header */}
      <div className="shrink-0 flex items-center gap-4 px-6 py-4 border-b"
        style={{ background: 'rgba(255,255,255,0.025)', borderColor: 'rgba(255,255,255,0.06)' }}>
        <div>
          <h1 className="text-base font-bold text-white/9 tracking-tight">人机协作协议</h1>
          <p className="text-[11px] text-white/3 mt-0.5">Human-Machine Collaboration Protocol · 人类字符 ↔ UI可视化 ↔ 机器语言</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-[11px] text-white/3 font-mono">{entries.length} 条</span>
          <button onClick={() => setAdding(true)} disabled={adding}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold transition-all cursor-pointer border"
            style={{
              background: 'rgba(59,130,246,0.15)', borderColor: 'rgba(59,130,246,0.35)',
              color: '#60a5fa', boxShadow: adding ? 'none' : '0 0 14px rgba(59,130,246,0.18)',
            }}>
            <Plus size={12} />新增条目
          </button>
        </div>
      </div>

      {/* Tab 栏 */}
      <div className="shrink-0" style={{ background: 'rgba(255,255,255,0.015)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center px-5 pt-3 pb-0.5">
          <TabBtn active={catFilter === ''} color="#ffffff" onClick={() => setCatFilter('')}>全部</TabBtn>
        </div>
        {GROUPS.map((group) => (
          <div key={group.label} className="flex items-center px-5 py-2 border-t"
            style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
            <div className="w-40 shrink-0 pr-3">
              <span className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: group.accent }}>
                {group.label}
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {group.categories.map((c) => (
                <TabBtn key={c.id} active={catFilter === c.id} color={group.accent}
                  onClick={() => setCatFilter(c.id)}>{c.label}</TabBtn>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <span className="text-[12px] text-white/3">加载中…</span>
          </div>
        ) : catFilter === 'communication' ? (
          <div className="p-6">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-6">
                <h2 className="text-base font-bold text-white/8 mb-1">通信机制</h2>
                <p className="text-[11px] text-white/3">AI ↛ AI 直接通信 · 必须经过 Control Bus 校验</p>
              </div>
              <CommunicationPipeline entries={entries} />
            </div>
          </div>
        ) : catFilter === 'resource-tier' ? (
          <div className="p-6">
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-base font-bold text-white/8 mb-1">智能资源分级</h2>
                <p className="text-[11px] text-white/3">Claude → Minimax → Qwen0.8B · 升级条件驱动路由</p>
              </div>
              <ResourceTierVisual vis={{
                tiers: entries.map(e => {
                  const v = (() => { try { return JSON.parse(e.ui_visual) } catch { return {} } })()
                  return {
                    tier: v.tier as number, label: v.label as string, emoji: v.emoji as string,
                    color: v.color as string, cost: v.cost_per_1k as number,
                    note: v.rl_capable ? 'RL 可训练' : (v.skills_enabled ? 'skills 扩展' : '高成本'),
                    escalate_if: v.escalate_if as string | undefined,
                  }
                }),
              }} />
              <div className="mt-6 p-5 rounded-2xl border"
                style={{ background: 'rgba(255,255,255,0.025)', borderColor: 'rgba(255,255,255,0.07)' }}>
                <div className="text-[10px] text-white/3 uppercase tracking-widest font-bold mb-3">升级规则</div>
                {[
                  { from: '三级 Qwen 0.8B', to: '二级 Minimax', cond: 'confidence < 0.6', color: '#9ca3af' },
                  { from: '二级 Minimax', to: '一级 Claude', cond: 'complexity > 0.8', color: '#60a5fa' },
                ].map(rule => (
                  <div key={rule.from} className="flex items-center gap-3 text-[12px] mb-2.5">
                    <span className="font-medium" style={{ color: rule.color }}>{rule.from}</span>
                    <span className="text-white/25">→</span>
                    <span className="text-white/5">{rule.to}</span>
                    <span className="ml-auto font-mono text-[11px] text-white/3">if {rule.cond}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 z-10"
              style={{ background: 'rgba(6,6,10,0.96)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <tr>
                <th className="py-3 px-4 text-[10px] text-white/3 uppercase tracking-widest font-semibold w-36 text-left">分类 / 层</th>
                <th className="py-3 px-4 text-[10px] text-white/3 uppercase tracking-widest font-semibold w-48 text-left">人类字符</th>
                <th className="py-3 px-4 text-[10px] text-white/3 uppercase tracking-widest font-semibold text-left">UI 可视化</th>
                <th className="py-3 px-4 text-[10px] text-white/3 uppercase tracking-widest font-semibold text-left">机器语言</th>
                <th className="py-3 px-4 w-16" />
              </tr>
            </thead>
            <tbody>
              {adding && <NewEntryForm onCreated={onCreated} onCancel={() => setAdding(false)} />}
              {entries.map(e => (
                <ProtocolRow key={e.id} entry={e} onSave={onSave} onDelete={onDelete} />
              ))}
              {entries.length === 0 && !adding && (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <span className="text-[12px] text-white/2">暂无条目 — 点击「新增条目」开始</span>
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
