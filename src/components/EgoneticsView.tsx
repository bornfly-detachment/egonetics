import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, LayoutTemplate } from 'lucide-react'
import { listCanvases, createCanvas, deleteCanvas, type Canvas } from '../lib/canvas-api'

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })

// ── CanvasCard ──────────────────────────────────────────────────
const CanvasCard: React.FC<{
  canvas: Canvas
  onClick: () => void
  onDelete: (e: React.MouseEvent) => void
}> = ({ canvas, onClick, onDelete }) => (
  <div
    onClick={onClick}
    className="glass-panel p-5 cursor-pointer hover:bg-white/10 transition-all duration-200 group relative"
  >
    <button
      onClick={onDelete}
      className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1 rounded text-neutral-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>

    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-primary-500/10 border border-primary-500/20 flex items-center justify-center shrink-0">
        <LayoutTemplate className="w-4 h-4 text-primary-400" />
      </div>
      <div className="flex-1 min-w-0 pr-4">
        <p className="font-medium text-white group-hover:text-primary-300 transition-colors truncate">
          {canvas.title}
        </p>
        {canvas.description && (
          <p className="text-xs text-neutral-500 mt-0.5 line-clamp-2">{canvas.description}</p>
        )}
        <div className="flex items-center gap-2 mt-2 text-xs text-neutral-600">
          <span>{canvas.node_count} 个节点</span>
          <span>·</span>
          <span>{fmtDate(canvas.updated_at)}</span>
        </div>
      </div>
    </div>
  </div>
)

// ── CreateModal ─────────────────────────────────────────────────
const CreateModal: React.FC<{ onCreated: (id: string) => void; onClose: () => void }> = ({ onCreated, onClose }) => {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    try {
      const cvs = await createCanvas({ title: title.trim(), description: description.trim() || undefined })
      onCreated(cvs.id)
    } catch { /* ignore */ } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={e => e.stopPropagation()}
        className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white">新建画布</h3>
        </div>

        <div>
          <label className="text-xs text-neutral-500 mb-1 block">画布名称 *</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            autoFocus
            placeholder="如：主体性认知框架 / 工程实践图谱 / 宪法关系网络..."
            className="input-field w-full text-sm"
          />
        </div>

        <div>
          <label className="text-xs text-neutral-500 mb-1 block">描述（可选）</label>
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="简短描述这个画布的用途..."
            className="input-field w-full text-sm"
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary text-sm">取消</button>
          <button
            type="submit"
            disabled={saving || !title.trim()}
            className="btn-primary text-sm flex items-center gap-2"
          >
            {saving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            创建画布
          </button>
        </div>
      </form>
    </div>
  )
}

// ── EgoneticsView ───────────────────────────────────────────────
const EgoneticsView: React.FC = () => {
  const navigate = useNavigate()
  const [canvases, setCanvases] = useState<Canvas[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await listCanvases()
      setCanvases(data)
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleDelete = useCallback(async (e: React.MouseEvent, canvas: Canvas) => {
    e.stopPropagation()
    if (!window.confirm(`确定删除画布「${canvas.title}」？此操作不可撤销。`)) return
    await deleteCanvas(canvas.id)
    setCanvases(prev => prev.filter(c => c.id !== canvas.id))
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text">抽象认知网络</h1>
          <p className="text-neutral-500 text-sm mt-1">自由画布 · 构建跨实体知识网络，连接 Task / 页面 / 理论</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" /> 新建画布
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="glass-panel h-28 animate-pulse" />
          ))}
        </div>
      ) : canvases.length === 0 ? (
        <div className="glass-panel p-16 text-center">
          <span className="text-5xl block mb-4">🗺️</span>
          <p className="text-neutral-400 mb-2">还没有画布</p>
          <p className="text-neutral-600 text-sm">点击"新建画布"开始构建你的认知网络</p>
          <button
            onClick={() => setShowCreate(true)}
            className="btn-primary mt-4 text-sm inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> 新建画布
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {canvases.map(cvs => (
            <CanvasCard
              key={cvs.id}
              canvas={cvs}
              onClick={() => navigate(`/egonetics/canvas/${cvs.id}`)}
              onDelete={e => handleDelete(e, cvs)}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateModal
          onCreated={async (id) => {
            setShowCreate(false)
            await load()
            navigate(`/egonetics/canvas/${id}`)
          }}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  )
}

export default EgoneticsView
