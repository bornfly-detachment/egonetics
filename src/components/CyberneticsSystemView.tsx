/**
 * CyberneticsSystemView — 自我控制论系统（全局视图）
 *
 * 布局：左侧常驻树形导航 + 右侧内容区
 * PRVSE 每层展示 SEAI 组件树（来自 /e0/components）+ 操作面板
 */
import { useState, useEffect, useCallback } from 'react'
import { ChevronRight, ChevronDown, Plus, Edit2, Trash2, Check, X, Loader2, RefreshCw } from 'lucide-react'
import PRVSPanel from './PRVSPanel'
import ConstitutionView from './ConstitutionView'
import OntologyView from './OntologyView'
import TagTreeView from './TagTreeView'
import SEAIVPanel from './SEAIVPanel'
import CyberneticsTree from './CyberneticsTree'

// ── SEAI ────────────────────────────────────────────────────────
const SEAI_BASE = 'http://localhost:8000'

const seaiFetch = async <T = unknown>(path: string, opts?: RequestInit): Promise<T> => {
  const r = await fetch(`${SEAI_BASE}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts?.headers ?? {}) },
  })
  if (!r.ok) throw new Error(`SEAI ${r.status}: ${await r.text()}`)
  return r.json() as Promise<T>
}

interface PRVSEComponent {
  id: string
  lifecycle_id: string
  layer: string
  sub_id: string
  name: string
  description: string
  status: 'active' | 'inactive' | 'error' | 'running'
  config: Record<string, unknown>
  is_builtin: number
}

// ── Tree structure ──────────────────────────────────────────────

const STATUS_DOT: Record<string, string> = {
  active:   'bg-green-400',
  running:  'bg-blue-400 animate-pulse',
  error:    'bg-red-400',
  inactive: 'bg-neutral-700',
}

const LAYER_META: Record<string, { label: string; color: string; desc: string }> = {
  P: { label: '感知层', color: 'text-sky-400',     desc: 'Perception' },
  R: { label: '关系层', color: 'text-indigo-400',  desc: 'Relation' },
  V: { label: '价值层', color: 'text-violet-400',  desc: 'Value' },
  S: { label: '状态层', color: 'text-amber-400',   desc: 'State' },
  E: { label: '进化层', color: 'text-emerald-400', desc: 'Evolution' },
}

// node id format: 'P' | 'R' | 'V' | 'S' | 'E' | 'constitution' | 'ontology' | 'tags' | 'seai-v' | 'axioms' | 'spec'
type NodeId = string

// ── Component inline editor ─────────────────────────────────────
function CompRow({
  comp,
  onUpdate,
  onDelete,
}: {
  comp: PRVSEComponent
  onUpdate: (id: string, f: Partial<PRVSEComponent>) => void
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: comp.name, description: comp.description, status: comp.status })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await seaiFetch(`/e0/components/${comp.id}`, {
        method: 'PATCH',
        body: JSON.stringify(form),
      })
      onUpdate(comp.id, form)
      setEditing(false)
    } catch { /* ignore */ }
    setSaving(false)
  }

  return (
    <div className="group flex items-start gap-3 px-4 py-2.5 rounded-lg hover:bg-white/3 transition-colors border border-transparent hover:border-white/5">
      <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[comp.status] ?? 'bg-neutral-700'}`} />
      {editing ? (
        <div className="flex-1 space-y-2">
          <div className="flex gap-2">
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-white/20" />
            <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as PRVSEComponent['status'] }))}
              className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none">
              {['active', 'inactive', 'error', 'running'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            placeholder="描述..." className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-neutral-300 focus:outline-none focus:border-white/20" />
          <div className="flex gap-2">
            <button onClick={save} disabled={saving}
              className="flex items-center gap-1 px-2.5 py-1 bg-green-600/20 hover:bg-green-600/30 text-green-400 text-xs rounded border border-green-500/20">
              {saving ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}保存
            </button>
            <button onClick={() => { setEditing(false); setForm({ name: comp.name, description: comp.description, status: comp.status }) }}
              className="flex items-center gap-1 px-2.5 py-1 bg-white/5 text-neutral-400 text-xs rounded border border-white/8">
              <X size={10} />取消
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-white">{comp.sub_id}</span>
            <span className="text-xs text-neutral-500">{comp.name}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
              comp.status === 'active'   ? 'bg-green-500/20 text-green-400 border-green-500/30' :
              comp.status === 'running'  ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
              comp.status === 'error'    ? 'bg-red-500/20 text-red-400 border-red-500/30' :
              'bg-neutral-700/40 text-neutral-500 border-neutral-600/30'
            }`}>{comp.status}</span>
          </div>
          {comp.description && <p className="text-[11px] text-neutral-600 mt-0.5 truncate">{comp.description}</p>}
        </div>
      )}
      {!editing && (
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={() => setEditing(true)} className="p-1 text-neutral-600 hover:text-neutral-300 transition-colors"><Edit2 size={11} /></button>
          <button onClick={() => onDelete(comp.id)} className="p-1 text-neutral-600 hover:text-red-400 transition-colors"><Trash2 size={11} /></button>
        </div>
      )}
    </div>
  )
}

// ── Create component form ───────────────────────────────────────
function CreateCompForm({ layer, onCreated, onCancel }: {
  layer: string
  onCreated: (comp: PRVSEComponent) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState({ sub_id: '', name: '', description: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!form.sub_id.trim() || !form.name.trim()) { setError('sub_id 和 name 必填'); return }
    setSaving(true); setError('')
    try {
      const comp = await seaiFetch<PRVSEComponent>('/e0/components', {
        method: 'POST',
        body: JSON.stringify({ lifecycle_id: 'e0', layer, ...form }),
      })
      onCreated(comp)
    } catch (e) { setError(String(e)) }
    setSaving(false)
  }

  return (
    <div className="mx-4 my-2 p-3 rounded-lg bg-white/3 border border-white/8 space-y-2">
      <div className="flex gap-2">
        <input value={form.sub_id} onChange={e => setForm(p => ({ ...p, sub_id: e.target.value }))}
          placeholder="sub_id" className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white placeholder-neutral-700 focus:outline-none" />
        <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          placeholder="名称" className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white placeholder-neutral-700 focus:outline-none" />
      </div>
      <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
        placeholder="描述（可选）" className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-neutral-300 placeholder-neutral-700 focus:outline-none" />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button onClick={submit} disabled={saving}
          className="flex items-center gap-1 px-2.5 py-1 bg-primary-500/20 hover:bg-primary-500/30 text-primary-300 text-xs rounded border border-primary-500/20">
          {saving ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}创建
        </button>
        <button onClick={onCancel} className="px-2.5 py-1 bg-white/5 text-neutral-400 text-xs rounded border border-white/8">取消</button>
      </div>
    </div>
  )
}

// ── PRVSE layer panel (component tree + optional ops) ───────────
function LayerPanel({ layer, components, onUpdate, onDelete, onCreated }: {
  layer: string
  components: PRVSEComponent[]
  onUpdate: (id: string, f: Partial<PRVSEComponent>) => void
  onDelete: (id: string) => void
  onCreated: (comp: PRVSEComponent) => void
}) {
  const [creating, setCreating] = useState(false)
  const meta = LAYER_META[layer]
  const comps = components.filter(c => c.layer === layer)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between shrink-0">
        <div>
          <span className={`text-lg font-bold font-mono ${meta.color}`}>{layer}</span>
          <span className={`ml-2 text-sm font-medium ${meta.color}`}>{meta.label}</span>
          <span className="ml-2 text-xs text-neutral-600">{meta.desc}</span>
        </div>
        <button onClick={() => setCreating(c => !c)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-neutral-500 hover:text-neutral-300 hover:bg-white/5 rounded transition-colors border border-white/5">
          <Plus size={11} />新增组件
        </button>
      </div>

      {/* Component list */}
      <div className="flex-1 overflow-y-auto py-3">
        {comps.length === 0 && !creating && (
          <p className="px-6 py-4 text-xs text-neutral-700">暂无组件</p>
        )}
        {comps.map(c => (
          <CompRow key={c.id} comp={c} onUpdate={onUpdate} onDelete={onDelete} />
        ))}
        {creating && (
          <CreateCompForm
            layer={layer}
            onCreated={c => { onCreated(c); setCreating(false) }}
            onCancel={() => setCreating(false)}
          />
        )}
      </div>
    </div>
  )
}

// ── Left tree navigation ────────────────────────────────────────

interface TreeSection {
  id: string
  icon: string
  label: string
  color: string
  children?: Array<{ id: string; label: string; sub?: string }>
}

const TREE: TreeSection[] = [
  { id: 'cyber-tree',   icon: '🌲', label: '骨架树',       color: 'text-violet-300' },
  {
    id: 'prvse',
    icon: '⚡',
    label: 'SEAI 运行组件',
    color: 'text-violet-300',
    children: [
      { id: 'P', label: 'P', sub: '感知层' },
      { id: 'R', label: 'R', sub: '关系层' },
      { id: 'V', label: 'V', sub: '价值层' },
      { id: 'S', label: 'S', sub: '状态层' },
      { id: 'E', label: 'E', sub: '进化层' },
    ],
  },
  { id: 'axioms',       icon: '📐', label: '公理集',        color: 'text-amber-300' },
  { id: 'spec',         icon: '📋', label: '规范',          color: 'text-neutral-300' },
  { id: 'seai-v',       icon: '⚖️', label: 'V层 Reward',   color: 'text-violet-300' },
  { id: 'constitution', icon: '🛡',  label: '控制论宪法',   color: 'text-orange-300' },
  { id: 'ontology',     icon: '🔷', label: '生变论本体',    color: 'text-blue-300' },
  { id: 'tags',         icon: '🏷',  label: '标签语义树',   color: 'text-teal-300' },
]

const PRVSE_LAYERS = ['P', 'R', 'V', 'S', 'E']

function TreeNav({
  active,
  onSelect,
  components,
}: {
  active: NodeId
  onSelect: (id: NodeId) => void
  components: PRVSEComponent[]
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({ prvse: true })

  return (
    <nav className="flex flex-col h-full overflow-y-auto">
      <div className="px-4 py-3 border-b border-white/5 shrink-0">
        <span className="text-[10px] font-semibold text-neutral-600 uppercase tracking-widest">自我控制论系统</span>
      </div>

      <div className="flex-1 py-2">
        {TREE.map(section => {
          const isOpen = open[section.id] ?? false
          const hasChildren = !!section.children

          if (!hasChildren) {
            return (
              <button
                key={section.id}
                onClick={() => onSelect(section.id)}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors ${
                  active === section.id
                    ? `bg-white/6 border-l-2 border-l-current ${section.color}`
                    : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/3'
                }`}
              >
                <span className="text-base leading-none shrink-0">{section.icon}</span>
                <span className="text-xs font-medium">{section.label}</span>
              </button>
            )
          }

          return (
            <div key={section.id}>
              {/* Section header */}
              <button
                onClick={() => setOpen(p => ({ ...p, [section.id]: !p[section.id] }))}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-white/3 transition-colors group"
              >
                <span className="text-base leading-none shrink-0">{section.icon}</span>
                <span className={`text-xs font-semibold flex-1 ${section.color}`}>{section.label}</span>
                {isOpen
                  ? <ChevronDown size={12} className="text-neutral-600 group-hover:text-neutral-400" />
                  : <ChevronRight size={12} className="text-neutral-600 group-hover:text-neutral-400" />
                }
              </button>

              {/* Children */}
              {isOpen && section.children?.map(child => {
                const isLayer = PRVSE_LAYERS.includes(child.id)
                const layerComps = isLayer ? components.filter(c => c.layer === child.id) : []
                const activeCount = layerComps.filter(c => c.status === 'active').length
                const meta = isLayer ? LAYER_META[child.id] : null

                return (
                  <button
                    key={child.id}
                    onClick={() => onSelect(child.id)}
                    className={`w-full flex items-center gap-2 pl-10 pr-4 py-2 text-left transition-colors border-l border-white/3 ${
                      active === child.id
                        ? `bg-white/5 ${meta?.color ?? 'text-neutral-200'}`
                        : 'text-neutral-600 hover:text-neutral-300 hover:bg-white/3'
                    }`}
                  >
                    {isLayer && (
                      <span className={`text-xs font-bold font-mono w-4 ${active === child.id ? meta?.color : ''}`}>
                        {child.id}
                      </span>
                    )}
                    <span className="text-xs flex-1">{child.sub ?? child.label}</span>
                    {isLayer && layerComps.length > 0 && (
                      <div className="flex items-center gap-1">
                        {activeCount > 0 && (
                          <span className="text-[9px] text-green-500">{activeCount}↑</span>
                        )}
                        <span className="text-[9px] text-neutral-700">{layerComps.length}</span>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </nav>
  )
}

// ── Main ────────────────────────────────────────────────────────

export default function CyberneticsSystemView() {
  const [active, setActive] = useState<NodeId>('cyber-tree')
  const [components, setComponents] = useState<PRVSEComponent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadComponents = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const comps = await seaiFetch<PRVSEComponent[]>('/e0/components?lifecycle_id=e0')
      setComponents(comps)
    } catch (e) {
      setError(String(e))
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadComponents() }, [loadComponents])

  const handleUpdate = (id: string, fields: Partial<PRVSEComponent>) => {
    setComponents(prev => prev.map(c => c.id === id ? { ...c, ...fields } : c))
  }

  const handleDelete = async (id: string) => {
    try {
      await seaiFetch(`/e0/components/${id}`, { method: 'DELETE' })
      setComponents(prev => prev.filter(c => c.id !== id))
    } catch (e) { setError(String(e)) }
  }

  const handleCreated = (comp: PRVSEComponent) => {
    setComponents(prev => [...prev, comp])
  }

  const isPrvseLayer = PRVSE_LAYERS.includes(active)

  return (
    <div className="flex -m-6 h-[calc(100%+48px)] overflow-hidden bg-[#080808]">

      {/* ── Left: Tree nav ── */}
      <div className="w-48 shrink-0 border-r border-white/[0.06] bg-[#0c0c0c]">
        <TreeNav
          active={active}
          onSelect={setActive}
          components={components}
        />
      </div>

      {/* ── Right: Content ── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-[#0a0a0a]">

        {/* Error / loading bar */}
        {(loading || error) && (
          <div className="shrink-0 px-6 py-2 border-b border-white/5 flex items-center gap-2">
            {loading && <Loader2 size={12} className="animate-spin text-neutral-600" />}
            {error && <span className="text-xs text-red-400">{error}</span>}
            <button onClick={loadComponents} className="ml-auto p-1 text-neutral-600 hover:text-neutral-400">
              <RefreshCw size={12} />
            </button>
          </div>
        )}

        {/* Cybernetics skeleton tree */}
        {active === 'cyber-tree' && (
          <div className="flex-1 overflow-hidden">
            <CyberneticsTree />
          </div>
        )}

        {/* PRVSE layer (P / R / V / S / E) */}
        {isPrvseLayer && (
          <LayerPanel
            layer={active}
            components={components}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onCreated={handleCreated}
          />
        )}

        {/* 公理集 / 规范 → PRVSPanel（数据存 SEAI DB） */}
        {(active === 'axioms' || active === 'spec') && (
          <div className="flex-1 overflow-hidden">
            <PRVSPanel defaultTab={active} />
          </div>
        )}

        {/* Other modules */}
        {active === 'seai-v' && (
          <div className="flex-1 overflow-hidden">
            <SEAIVPanel />
          </div>
        )}
        {active === 'constitution' && (
          <div className="flex-1 overflow-y-auto p-6">
            <ConstitutionView />
          </div>
        )}
        {active === 'ontology' && (
          <div className="flex-1 overflow-y-auto p-6">
            <OntologyView />
          </div>
        )}
        {active === 'tags' && (
          <div className="flex-1 overflow-hidden">
            <TagTreeView />
          </div>
        )}
      </div>
    </div>
  )
}
