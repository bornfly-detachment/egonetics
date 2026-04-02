import React, { useState, useEffect, useCallback } from 'react'
import {
  ChevronRight, Plus, Edit2, Trash2, RefreshCw, Loader2, Check, X
} from 'lucide-react'

// ── Constants ──────────────────────────────────────────────────
const SEAI_BASE = 'http://localhost:8000'

const seaiFetch = async <T = unknown>(path: string, opts?: RequestInit): Promise<T> => {
  const r = await fetch(`${SEAI_BASE}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts?.headers ?? {}) },
  })
  if (!r.ok) throw new Error(`SEAI ${r.status}: ${await r.text()}`)
  return r.json() as Promise<T>
}

// ── Types ──────────────────────────────────────────────────────
interface Lifecycle {
  id: string
  name: string
  description: string
  state: string
  enabled: number
  is_builtin: number
  updated_at: string
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

// ── State machine config ────────────────────────────────────────
const E0_STATES = ['IDLE', 'OBSERVING', 'REFLECTING', 'TRAINING', 'VALIDATING', 'ACTIVATING']

const STATE_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  IDLE:        { bg: 'bg-neutral-800',    text: 'text-neutral-400',  dot: 'bg-neutral-600' },
  OBSERVING:   { bg: 'bg-blue-900/40',    text: 'text-blue-300',     dot: 'bg-blue-400' },
  REFLECTING:  { bg: 'bg-violet-900/40',  text: 'text-violet-300',   dot: 'bg-violet-400' },
  TRAINING:    { bg: 'bg-amber-900/40',   text: 'text-amber-300',    dot: 'bg-amber-400 animate-pulse' },
  VALIDATING:  { bg: 'bg-cyan-900/40',    text: 'text-cyan-300',     dot: 'bg-cyan-400' },
  ACTIVATING:  { bg: 'bg-green-900/40',   text: 'text-green-300',    dot: 'bg-green-400 animate-pulse' },
}

const LAYER_META: Record<string, { label: string; color: string; desc: string }> = {
  P: { label: 'P — 感知层', color: 'text-sky-400',    desc: 'Perception' },
  R: { label: 'R — 关系层', color: 'text-indigo-400', desc: 'Relation' },
  V: { label: 'V — 价值层', color: 'text-violet-400', desc: 'Value' },
  S: { label: 'S — 状态层', color: 'text-amber-400',  desc: 'State' },
  E: { label: 'E — 进化层', color: 'text-emerald-400',desc: 'Evolution' },
}

const STATUS_BADGE: Record<string, string> = {
  active:   'bg-green-500/20 text-green-400 border-green-500/30',
  inactive: 'bg-neutral-700/40 text-neutral-500 border-neutral-600/30',
  error:    'bg-red-500/20 text-red-400 border-red-500/30',
  running:  'bg-blue-500/20 text-blue-400 border-blue-500/30',
}

// ── State Machine Bar ───────────────────────────────────────────
const StateMachineBar: React.FC<{
  lifecycle: Lifecycle
  onTransition: (to: string) => void
  transitioning: boolean
}> = ({ lifecycle, onTransition, transitioning }) => {
  const TRANSITIONS: Record<string, string[]> = {
    IDLE:       ['OBSERVING'],
    OBSERVING:  ['REFLECTING', 'IDLE'],
    REFLECTING: ['TRAINING', 'IDLE'],
    TRAINING:   ['VALIDATING', 'IDLE'],
    VALIDATING: ['ACTIVATING', 'REFLECTING'],
    ACTIVATING: ['IDLE'],
  }
  const allowed = TRANSITIONS[lifecycle.state] ?? []

  return (
    <div className="flex items-center gap-0 flex-wrap">
      {E0_STATES.map((s, i) => {
        const style = STATE_STYLE[s]
        const isCurrent = lifecycle.state === s
        const canGo = allowed.includes(s)
        return (
          <React.Fragment key={s}>
            <button
              onClick={() => canGo && !transitioning && onTransition(s)}
              disabled={!canGo || transitioning}
              className={`
                relative px-3 py-1.5 text-xs font-medium rounded transition-all
                ${isCurrent
                  ? `${style.bg} ${style.text} ring-1 ring-inset ring-current`
                  : canGo
                    ? `${style.bg} ${style.text} opacity-70 hover:opacity-100 cursor-pointer`
                    : 'bg-transparent text-neutral-700 cursor-default'
                }
                ${transitioning ? 'opacity-50' : ''}
              `}
            >
              {isCurrent && (
                <span className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${style.dot}`} />
              )}
              {s}
            </button>
            {i < E0_STATES.length - 1 && (
              <ChevronRight size={12} className="text-neutral-700 mx-0.5" />
            )}
          </React.Fragment>
        )
      })}
      {transitioning && <Loader2 size={12} className="ml-2 animate-spin text-neutral-500" />}
    </div>
  )
}

// ── Component Row ───────────────────────────────────────────────
const ComponentRow: React.FC<{
  comp: PRVSEComponent
  onUpdate: (id: string, fields: Partial<PRVSEComponent>) => void
  onDelete: (id: string) => void
}> = ({ comp, onUpdate, onDelete }) => {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: comp.name, description: comp.description, status: comp.status })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await seaiFetch(`/e0/components/${comp.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: form.name, description: form.description, status: form.status }),
      })
      onUpdate(comp.id, { name: form.name, description: form.description, status: form.status })
      setEditing(false)
    } catch { /* ignore */ }
    setSaving(false)
  }

  const badgeCls = STATUS_BADGE[comp.status] ?? STATUS_BADGE.inactive

  return (
    <div className="group flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-white/3 transition-colors border border-transparent hover:border-white/5">
      {/* Status dot */}
      <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
        comp.status === 'active'   ? 'bg-green-400' :
        comp.status === 'running'  ? 'bg-blue-400 animate-pulse' :
        comp.status === 'error'    ? 'bg-red-400' :
        'bg-neutral-700'
      }`} />

      {editing ? (
        <div className="flex-1 space-y-2">
          <div className="flex gap-2">
            <input
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-white/20"
            />
            <select
              value={form.status}
              onChange={e => setForm(p => ({ ...p, status: e.target.value as PRVSEComponent['status'] }))}
              className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none"
            >
              {['active', 'inactive', 'error', 'running'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <input
            value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            placeholder="描述..."
            className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-neutral-300 focus:outline-none focus:border-white/20"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1 px-2.5 py-1 bg-green-600/20 hover:bg-green-600/30 text-green-400 text-xs rounded border border-green-500/20 transition-colors"
            >
              {saving ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
              保存
            </button>
            <button
              onClick={() => { setEditing(false); setForm({ name: comp.name, description: comp.description, status: comp.status }) }}
              className="flex items-center gap-1 px-2.5 py-1 bg-white/5 hover:bg-white/8 text-neutral-400 text-xs rounded border border-white/8 transition-colors"
            >
              <X size={10} />取消
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-white">{comp.sub_id}</span>
            <span className="text-xs text-neutral-500">{comp.name}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${badgeCls}`}>{comp.status}</span>
          </div>
          {comp.description && (
            <p className="text-[11px] text-neutral-600 mt-0.5 truncate">{comp.description}</p>
          )}
        </div>
      )}

      {!editing && (
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={() => setEditing(true)}
            className="p-1 text-neutral-600 hover:text-neutral-300 transition-colors"
            title="编辑"
          >
            <Edit2 size={12} />
          </button>
          <button
            onClick={() => onDelete(comp.id)}
            className="p-1 text-neutral-600 hover:text-red-400 transition-colors"
            title="删除"
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}
    </div>
  )
}

// ── Create Component Form ───────────────────────────────────────
const CreateComponentForm: React.FC<{
  lifecycleId: string
  layer: string
  onCreated: (comp: PRVSEComponent) => void
  onCancel: () => void
}> = ({ lifecycleId, layer, onCreated, onCancel }) => {
  const [form, setForm] = useState({ sub_id: '', name: '', description: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    if (!form.sub_id.trim() || !form.name.trim()) { setError('sub_id 和 name 必填'); return }
    setSaving(true)
    setError('')
    try {
      const comp = await seaiFetch<PRVSEComponent>('/e0/components', {
        method: 'POST',
        body: JSON.stringify({ lifecycle_id: lifecycleId, layer, ...form }),
      })
      onCreated(comp)
    } catch (e) {
      setError(String(e))
    }
    setSaving(false)
  }

  return (
    <div className="mx-3 my-2 p-3 rounded-lg bg-white/3 border border-white/8 space-y-2">
      <div className="flex gap-2">
        <input
          value={form.sub_id}
          onChange={e => setForm(p => ({ ...p, sub_id: e.target.value }))}
          placeholder="sub_id (e.g. scan)"
          className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white placeholder-neutral-700 focus:outline-none focus:border-white/20"
        />
        <input
          value={form.name}
          onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          placeholder="名称"
          className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white placeholder-neutral-700 focus:outline-none focus:border-white/20"
        />
      </div>
      <input
        value={form.description}
        onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
        placeholder="描述（可选）"
        className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-neutral-300 placeholder-neutral-700 focus:outline-none focus:border-white/20"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleCreate}
          disabled={saving}
          className="flex items-center gap-1 px-2.5 py-1 bg-primary-500/20 hover:bg-primary-500/30 text-primary-300 text-xs rounded border border-primary-500/20 transition-colors"
        >
          {saving ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
          创建
        </button>
        <button
          onClick={onCancel}
          className="px-2.5 py-1 bg-white/5 hover:bg-white/8 text-neutral-400 text-xs rounded border border-white/8 transition-colors"
        >
          取消
        </button>
      </div>
    </div>
  )
}

// ── PRVSE Layer Panel ───────────────────────────────────────────
const LayerPanel: React.FC<{
  layer: string
  components: PRVSEComponent[]
  lifecycleId: string
  onUpdate: (id: string, fields: Partial<PRVSEComponent>) => void
  onDelete: (id: string) => void
  onCreated: (comp: PRVSEComponent) => void
}> = ({ layer, components, lifecycleId, onUpdate, onDelete, onCreated }) => {
  const [creating, setCreating] = useState(false)
  const meta = LAYER_META[layer]
  const layerComps = components.filter(c => c.layer === layer)

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-3 py-2">
        <div>
          <span className={`text-sm font-semibold ${meta.color}`}>{meta.label}</span>
          <span className="text-xs text-neutral-700 ml-2">{meta.desc}</span>
        </div>
        <button
          onClick={() => setCreating(c => !c)}
          className="flex items-center gap-1 px-2 py-1 text-xs text-neutral-500 hover:text-neutral-300 hover:bg-white/5 rounded transition-colors"
        >
          <Plus size={11} />新增
        </button>
      </div>

      {layerComps.length === 0 && !creating && (
        <p className="px-3 py-2 text-xs text-neutral-700">暂无组件</p>
      )}

      {layerComps.map(comp => (
        <ComponentRow
          key={comp.id}
          comp={comp}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      ))}

      {creating && (
        <CreateComponentForm
          lifecycleId={lifecycleId}
          layer={layer}
          onCreated={comp => { onCreated(comp); setCreating(false) }}
          onCancel={() => setCreating(false)}
        />
      )}
    </div>
  )
}

// ── Lifecycle Row (with inline edit) ───────────────────────────
const LifecycleRow: React.FC<{
  lc: Lifecycle
  selected: boolean
  onSelect: () => void
  onUpdated: (fields: Partial<Lifecycle>) => void
  onDelete: () => void
}> = ({ lc, selected, onSelect, onUpdated, onDelete }) => {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: lc.name, description: lc.description })
  const [saving, setSaving] = useState(false)

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setSaving(true)
    try {
      await seaiFetch(`/e0/lifecycles/${lc.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: form.name, description: form.description }),
      })
      onUpdated({ name: form.name, description: form.description })
      setEditing(false)
    } catch { /* ignore */ }
    setSaving(false)
  }

  if (editing) {
    return (
      <div className="px-3 py-2 border-b border-white/3 bg-white/3 space-y-1.5">
        <input
          autoFocus
          value={form.name}
          onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-white/20"
          onClick={e => e.stopPropagation()}
        />
        <input
          value={form.description}
          onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
          placeholder="描述..."
          className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-neutral-300 placeholder-neutral-700 focus:outline-none focus:border-white/20"
          onClick={e => e.stopPropagation()}
        />
        <div className="flex gap-1.5">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1 px-2 py-0.5 bg-green-600/20 hover:bg-green-600/30 text-green-400 text-xs rounded border border-green-500/20">
            {saving ? <Loader2 size={9} className="animate-spin" /> : <Check size={9} />}保存
          </button>
          <button onClick={e => { e.stopPropagation(); setEditing(false); setForm({ name: lc.name, description: lc.description }) }}
            className="px-2 py-0.5 bg-white/5 hover:bg-white/8 text-neutral-400 text-xs rounded border border-white/8">
            取消
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      onClick={onSelect}
      className={`group flex items-center gap-2 px-4 py-2.5 cursor-pointer transition-colors border-b border-white/3 ${
        selected ? 'bg-primary-500/10 border-l-2 border-l-primary-500' : 'hover:bg-white/4'
      }`}
    >
      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${(STATE_STYLE[lc.state] ?? STATE_STYLE.IDLE).dot}`} />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-white truncate">{lc.name}</p>
        <p className="text-[10px] text-neutral-600 truncate">{lc.state}</p>
      </div>
      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={e => { e.stopPropagation(); setEditing(true) }}
          className="p-0.5 text-neutral-700 hover:text-neutral-300 transition-colors"
          title="编辑"
        >
          <Edit2 size={10} />
        </button>
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          className="p-0.5 text-neutral-700 hover:text-red-400 transition-colors"
          title="删除"
        >
          <Trash2 size={10} />
        </button>
      </div>
    </div>
  )
}

// ── Create Lifecycle Form ───────────────────────────────────────
const CreateLifecycleForm: React.FC<{
  onCreated: (lc: Lifecycle) => void
  onCancel: () => void
}> = ({ onCreated, onCancel }) => {
  const [form, setForm] = useState({ id: '', name: '', description: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    if (!form.id.trim() || !form.name.trim()) { setError('id 和 name 必填'); return }
    setSaving(true); setError('')
    try {
      const lc = await seaiFetch<Lifecycle>('/e0/lifecycles', {
        method: 'POST',
        body: JSON.stringify(form),
      })
      onCreated(lc)
    } catch (e) { setError(String(e)) }
    setSaving(false)
  }

  return (
    <div className="mx-3 my-2 p-3 rounded-lg bg-white/3 border border-white/8 space-y-2">
      <div className="flex gap-2">
        <input
          value={form.id}
          onChange={e => setForm(p => ({ ...p, id: e.target.value }))}
          placeholder="id (英文, 如 loop)"
          className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white placeholder-neutral-700 focus:outline-none focus:border-white/20"
        />
        <input
          value={form.name}
          onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          placeholder="名称"
          className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white placeholder-neutral-700 focus:outline-none focus:border-white/20"
        />
      </div>
      <input
        value={form.description}
        onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
        placeholder="描述（可选）"
        className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-neutral-300 placeholder-neutral-700 focus:outline-none focus:border-white/20"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button onClick={handleCreate} disabled={saving}
          className="flex items-center gap-1 px-2.5 py-1 bg-primary-500/20 hover:bg-primary-500/30 text-primary-300 text-xs rounded border border-primary-500/20 transition-colors">
          {saving ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}创建
        </button>
        <button onClick={onCancel}
          className="px-2.5 py-1 bg-white/5 hover:bg-white/8 text-neutral-400 text-xs rounded border border-white/8 transition-colors">
          取消
        </button>
      </div>
    </div>
  )
}

// ── Main View ───────────────────────────────────────────────────
const AgentsView: React.FC = () => {
  const [lifecycles, setLifecycles] = useState<Lifecycle[]>([])
  const [components, setComponents] = useState<PRVSEComponent[]>([])
  const [selectedId, setSelectedId] = useState<string>('e0')
  const [activeLayer, setActiveLayer] = useState<string>('P')
  const [loading, setLoading] = useState(true)
  const [transitioning, setTransitioning] = useState(false)
  const [creatingLifecycle, setCreatingLifecycle] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selected = lifecycles.find(l => l.id === selectedId) ?? null

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [lcs, comps] = await Promise.all([
        seaiFetch<Lifecycle[]>('/e0/lifecycles'),
        seaiFetch<PRVSEComponent[]>('/e0/components'),
      ])
      setLifecycles(lcs)
      setComponents(comps)
      if (!lcs.find(l => l.id === selectedId) && lcs.length > 0) {
        setSelectedId(lcs[0].id)
      }
    } catch (e) {
      setError(String(e))
    }
    setLoading(false)
  }, [selectedId])

  useEffect(() => { load() }, [load])

  const handleTransition = async (toState: string) => {
    if (!selected) return
    setTransitioning(true)
    try {
      await seaiFetch(`/e0/lifecycles/${selected.id}/state/transition`, {
        method: 'POST',
        body: JSON.stringify({ to_state: toState }),
      })
      setLifecycles(prev => prev.map(l =>
        l.id === selected.id ? { ...l, state: toState } : l
      ))
    } catch (e) {
      setError(String(e))
    }
    setTransitioning(false)
  }

  const handleUpdateComp = (id: string, fields: Partial<PRVSEComponent>) => {
    setComponents(prev => prev.map(c => c.id === id ? { ...c, ...fields } : c))
  }

  const handleDeleteComp = async (id: string) => {
    try {
      await seaiFetch(`/e0/components/${id}`, { method: 'DELETE' })
      setComponents(prev => prev.filter(c => c.id !== id))
    } catch (e) { setError(String(e)) }
  }

  const handleCreatedComp = (comp: PRVSEComponent) => {
    setComponents(prev => [...prev, comp])
  }

  const handleDeleteLifecycle = async (id: string) => {
    try {
      await seaiFetch(`/e0/lifecycles/${id}`, { method: 'DELETE' })
      setLifecycles(prev => prev.filter(l => l.id !== id))
      if (selectedId === id) setSelectedId(lifecycles[0]?.id ?? '')
    } catch (e) { setError(String(e)) }
  }

  const selectedComps = components.filter(c => c.lifecycle_id === selectedId)

  return (
    <div className="flex flex-col h-full" style={{ height: 'calc(100vh - 120px)' }}>
      {/* ── Header ── */}
      <div className="px-5 py-3 border-b border-white/5 flex items-center gap-4 shrink-0 bg-[#0d0d0d]">
        <span className="text-xs font-semibold text-neutral-400 uppercase tracking-widest shrink-0">E0 控制台</span>

        {selected && (
          <StateMachineBar
            lifecycle={selected}
            onTransition={handleTransition}
            transitioning={transitioning}
          />
        )}

        <div className="ml-auto flex items-center gap-2">
          {error && (
            <span className="text-xs text-red-400 max-w-xs truncate">{error}</span>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="p-1.5 text-neutral-600 hover:text-neutral-300 transition-colors"
            title="刷新"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 min-h-0">

        {/* Left: Lifecycle List */}
        <div className="w-52 shrink-0 border-r border-white/5 bg-[#0d0d0d] flex flex-col">
          <div className="px-4 py-2.5 border-b border-white/5">
            <span className="text-[10px] font-semibold text-neutral-600 uppercase tracking-widest">生命周期</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={16} className="animate-spin text-neutral-700" />
              </div>
            ) : (
              <>
                {lifecycles.map(lc => (
                  <LifecycleRow
                    key={lc.id}
                    lc={lc}
                    selected={selectedId === lc.id}
                    onSelect={() => setSelectedId(lc.id)}
                    onUpdated={fields => setLifecycles(prev => prev.map(l => l.id === lc.id ? { ...l, ...fields } : l))}
                    onDelete={() => handleDeleteLifecycle(lc.id)}
                  />
                ))}

                {creatingLifecycle ? (
                  <CreateLifecycleForm
                    onCreated={lc => {
                      setLifecycles(prev => [...prev, lc as Lifecycle])
                      setCreatingLifecycle(false)
                    }}
                    onCancel={() => setCreatingLifecycle(false)}
                  />
                ) : (
                  <button
                    onClick={() => setCreatingLifecycle(true)}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-neutral-600 hover:text-neutral-400 hover:bg-white/3 transition-colors"
                  >
                    <Plus size={11} />新增生命周期
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right: PRVSE Tree */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#111]">
          {/* Layer tabs */}
          <div className="flex items-center gap-0 border-b border-white/5 shrink-0 px-2">
            {(['P', 'R', 'V', 'S', 'E'] as const).map(layer => {
              const meta = LAYER_META[layer]
              const count = selectedComps.filter(c => c.layer === layer).length
              return (
                <button
                  key={layer}
                  onClick={() => setActiveLayer(layer)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 transition-colors ${
                    activeLayer === layer
                      ? `${meta.color} border-current`
                      : 'text-neutral-600 border-transparent hover:text-neutral-400'
                  }`}
                >
                  <span className="font-mono text-sm">{layer}</span>
                  <span className="hidden sm:inline text-[10px] opacity-70">{meta.desc}</span>
                  <span className="text-[10px] text-neutral-700 font-mono">{count}</span>
                </button>
              )
            })}
          </div>

          {/* Component list */}
          <div className="flex-1 overflow-y-auto py-2">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={18} className="animate-spin text-neutral-700" />
              </div>
            ) : !selected ? (
              <div className="text-center py-12 text-neutral-700 text-sm">请选择一个生命周期</div>
            ) : (
              <LayerPanel
                layer={activeLayer}
                components={selectedComps}
                lifecycleId={selectedId}
                onUpdate={handleUpdateComp}
                onDelete={handleDeleteComp}
                onCreated={handleCreatedComp}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AgentsView
