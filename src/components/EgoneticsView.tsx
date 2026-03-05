import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Cpu, Archive, X, Trash2 } from 'lucide-react'

interface Subject {
  id: string
  name: string
  icon: string
  agent: string
  model: string
  model_display: string | null
  description: string | null
  status: 'active' | 'archived'
  activated_at: string
  created_at: string
}

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })

const KNOWN_AGENTS = ['Claude Code', 'Claude API', 'Cursor', 'Windsurf', 'Human', '']
const KNOWN_MODELS = [
  { value: 'claude-sonnet-4-6', label: 'Sonnet 4.6' },
  { value: 'claude-opus-4-6',   label: 'Opus 4.6' },
  { value: 'claude-haiku-4-5',  label: 'Haiku 4.5' },
  { value: 'custom',            label: '自定义' },
]
const ICONS = ['🧠', '🤖', '⚡', '🌀', '🔮', '🧬', '💡', '🌊', '🦾', '🪐']

// ── CreateModal ────────────────────────────────────────────
const CreateModal: React.FC<{ onCreated: (id: string) => void; onClose: () => void }> = ({ onCreated, onClose }) => {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('🧠')
  const [agent, setAgent] = useState('Claude Code')
  const [model, setModel] = useState('claude-sonnet-4-6')
  const [customModel, setCustomModel] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  const finalModel = model === 'custom' ? customModel : model
  const modelLabel = KNOWN_MODELS.find(m => m.value === model)?.label || model

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/egonetics/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(), icon,
          agent, model: finalModel,
          model_display: model === 'custom' ? customModel : modelLabel,
          description: description.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (data.id) onCreated(data.id)
    } catch { /* ignore */ } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={e => e.stopPropagation()}
        className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white">新建主题</h3>
          <button type="button" onClick={onClose} className="text-neutral-500 hover:text-neutral-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Icon picker */}
        <div>
          <label className="text-xs text-neutral-500 mb-2 block">图标</label>
          <div className="flex gap-2 flex-wrap">
            {ICONS.map(ic => (
              <button key={ic} type="button" onClick={() => setIcon(ic)}
                className={`w-9 h-9 rounded-lg text-lg transition-all ${icon === ic ? 'bg-primary-500/30 ring-1 ring-primary-400' : 'bg-white/5 hover:bg-white/10'}`}>
                {ic}
              </button>
            ))}
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="text-xs text-neutral-500 mb-1 block">主题名称 *</label>
          <input value={name} onChange={e => setName(e.target.value)} autoFocus
            placeholder="如：Claude Code · Sonnet 4.6 / 生命三大定律 / 宪法..."
            className="input-field w-full text-sm" />
        </div>

        {/* Description */}
        <div>
          <label className="text-xs text-neutral-500 mb-1 block">描述（可选）</label>
          <input value={description} onChange={e => setDescription(e.target.value)}
            placeholder="简短描述..."
            className="input-field w-full text-sm" />
        </div>

        {/* Agent + Model */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-neutral-500 mb-1 block">Agent（可选）</label>
            <select value={agent} onChange={e => setAgent(e.target.value)} className="input-field text-sm w-full">
              {KNOWN_AGENTS.map(a => <option key={a} value={a}>{a || '无'}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-neutral-500 mb-1 block">Model（可选）</label>
            <select value={model} onChange={e => setModel(e.target.value)} className="input-field text-sm w-full">
              {KNOWN_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
        </div>
        {model === 'custom' && (
          <input value={customModel} onChange={e => setCustomModel(e.target.value)}
            placeholder="输入模型名称" className="input-field text-sm w-full" />
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary text-sm">取消</button>
          <button type="submit" disabled={saving || !name.trim()} className="btn-primary text-sm flex items-center gap-2">
            {saving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            创建主题
          </button>
        </div>
      </form>
    </div>
  )
}

// ── SubjectCard ────────────────────────────────────────────
const SubjectCard: React.FC<{
  subject: Subject
  onClick: () => void
  onDelete: (e: React.MouseEvent) => void
}> = ({ subject, onClick, onDelete }) => {
  const isActive = subject.status === 'active'
  return (
    <div
      onClick={onClick}
      className={`glass-panel p-5 cursor-pointer hover:bg-white/10 transition-all duration-200 group relative
        ${isActive ? 'border border-primary-500/30' : 'opacity-70 hover:opacity-90'}`}
    >
      {/* 删除按钮 */}
      <button
        onClick={onDelete}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1 rounded text-neutral-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      <div className="flex items-start gap-3">
        <span className="text-3xl shrink-0 mt-0.5">{subject.icon}</span>
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-white group-hover:text-primary-300 transition-colors truncate">
              {subject.name}
            </span>
            {isActive && (
              <span className="flex items-center gap-1 text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                活跃
              </span>
            )}
            {subject.status === 'archived' && (
              <span className="flex items-center gap-1 text-xs text-neutral-500 bg-white/5 px-2 py-0.5 rounded-full shrink-0">
                <Archive className="w-3 h-3" /> 已归档
              </span>
            )}
          </div>
          {subject.description && (
            <p className="text-sm text-neutral-500 mt-1 truncate">{subject.description}</p>
          )}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {subject.agent && (
              <span className="text-xs bg-white/5 text-neutral-400 px-2 py-0.5 rounded">
                <Cpu className="w-3 h-3 inline mr-1" />{subject.agent}
              </span>
            )}
            {subject.model && (
              <span className="text-xs bg-white/5 text-neutral-400 px-2 py-0.5 rounded font-mono">
                {subject.model_display || subject.model}
              </span>
            )}
            <span className="text-xs text-neutral-600 ml-auto">{fmtDate(subject.created_at)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── EgoneticsView ──────────────────────────────────────────
const EgoneticsView: React.FC = () => {
  const navigate = useNavigate()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/egonetics/subjects')
      const data = await res.json()
      setSubjects(data.subjects || [])
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [])

  const handleDelete = useCallback(async (e: React.MouseEvent, subject: Subject) => {
    e.stopPropagation()
    if (!window.confirm(`确定删除「${subject.name}」？此操作不可撤销。`)) return
    await fetch(`/api/egonetics/subjects/${subject.id}`, { method: 'DELETE' })
    setSubjects(prev => prev.filter(s => s.id !== subject.id))
  }, [])

  useEffect(() => { load() }, [load])

  const active = subjects.filter(s => s.status === 'active')
  const archived = subjects.filter(s => s.status === 'archived')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text">自我控制论</h1>
          <p className="text-neutral-500 text-sm mt-1">每个主题独立记录，点击进入富文本编辑</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" /> 新建主题
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="glass-panel p-5 h-28 animate-pulse" />
          ))}
        </div>
      ) : subjects.length === 0 ? (
        <div className="glass-panel p-16 text-center">
          <span className="text-5xl block mb-4">🧠</span>
          <p className="text-neutral-400 mb-2">还没有主题</p>
          <p className="text-neutral-600 text-sm">点击"新建主题"开始记录你的第一个自我控制论主题</p>
        </div>
      ) : (
        <>
          {/* 活跃主题 */}
          {active.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-medium text-neutral-500 uppercase tracking-widest">活跃主题</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {active.map(s => (
                  <SubjectCard key={s.id} subject={s} onClick={() => navigate(`/egonetics/${s.id}`)} onDelete={(e) => handleDelete(e, s)} />
                ))}
              </div>
            </div>
          )}

          {/* 归档主题 */}
          {archived.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-medium text-neutral-600 uppercase tracking-widest">归档主题</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {archived.map(s => (
                  <SubjectCard key={s.id} subject={s} onClick={() => navigate(`/egonetics/${s.id}`)} onDelete={(e) => handleDelete(e, s)} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {showCreate && (
        <CreateModal
          onCreated={async (id) => { setShowCreate(false); await load(); navigate(`/egonetics/${id}`) }}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  )
}

export default EgoneticsView
