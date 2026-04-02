import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, LayoutTemplate, Zap, RefreshCw } from 'lucide-react'
import { listCanvases, createCanvas, deleteCanvas, type Canvas } from '../lib/api/canvas'

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })

// ── Semantic Canvas Card ─────────────────────────────────────────
const SemanticCard: React.FC<{
  canvas: Canvas
  onClick: () => void
  onDelete: (e: React.MouseEvent) => void
}> = ({ canvas, onClick, onDelete }) => (
  <div
    onClick={onClick}
    className="glass-panel p-4 cursor-pointer hover:bg-white/10 transition-all duration-200 group relative"
  >
    <button
      onClick={onDelete}
      className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1 rounded text-neutral-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>

    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-primary-500/10 border border-primary-500/20 flex items-center justify-center shrink-0">
        <LayoutTemplate className="w-4 h-4 text-primary-400" />
      </div>
      <div className="flex-1 min-w-0 pr-6">
        <p className="font-medium text-white group-hover:text-primary-300 transition-colors truncate text-sm">
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

// ── Execution Canvas Card ────────────────────────────────────────
const ExecutionCard: React.FC<{
  canvas: Canvas
  onClick: () => void
}> = ({ canvas, onClick }) => (
  <div
    onClick={onClick}
    className="glass-panel p-4 cursor-pointer hover:bg-white/10 transition-all duration-200 group relative border-l-2 border-l-amber-500/30"
  >
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
        <Zap className="w-4 h-4 text-amber-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-white group-hover:text-amber-300 transition-colors truncate text-sm flex-1">
            {canvas.title}
          </p>
          <span className="text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded shrink-0">
            Agent 执行
          </span>
        </div>
        {canvas.task_ref_id && (
          <p className="text-xs text-neutral-600 mt-0.5">Task: {canvas.task_ref_id.slice(0, 8)}…</p>
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

// ── CreateModal ──────────────────────────────────────────────────
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
        <h3 className="font-semibold text-white">新建语义画布</h3>

        <div>
          <label className="text-xs text-neutral-500 mb-1 block">画布名称 *</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            autoFocus
            placeholder="如：主体性认知框架 / 工程实践图谱..."
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

// ── Column ───────────────────────────────────────────────────────
const Column: React.FC<{
  title: string
  subtitle: string
  count: number
  headerColor: string
  action?: React.ReactNode
  empty: React.ReactNode
  children: React.ReactNode
}> = ({ title, subtitle, count, headerColor, action, empty, children }) => (
  <div className="flex-1 min-w-0 flex flex-col gap-3">
    <div className="flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${headerColor}`}>
            {count}
          </span>
        </div>
        <p className="text-neutral-600 text-xs mt-0.5">{subtitle}</p>
      </div>
      {action}
    </div>
    <div className="space-y-3">
      {count === 0 ? empty : children}
    </div>
  </div>
)

// ── EgoneticsView ────────────────────────────────────────────────
const EgoneticsView: React.FC = () => {
  const navigate = useNavigate()
  const [canvases, setCanvases] = useState<Canvas[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
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

  const semantic = canvases.filter(c => c.canvas_type === 'semantic')
  const execution = canvases.filter(c => c.canvas_type === 'execution')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text">抽象认知网络</h1>
          <p className="text-neutral-500 text-sm mt-1">语义图 · 执行图 — 连接 Task / 页面 / 理论 / Agent 过程</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> 刷新
        </button>
      </div>

      {loading ? (
        <div className="flex gap-6">
          <div className="flex-1 space-y-3">
            {[...Array(2)].map((_, i) => <div key={i} className="glass-panel h-20 animate-pulse" />)}
          </div>
          <div className="w-px self-stretch bg-white/5 shrink-0" />
          <div className="flex-1 space-y-3">
            {[...Array(2)].map((_, i) => <div key={i} className="glass-panel h-20 animate-pulse" />)}
          </div>
        </div>
      ) : (
        <div className="flex gap-6 items-start">
          {/* ── 语义图列 ── */}
          <Column
            title="语义图"
            subtitle="用户构建 · 自由连接页面与实体"
            count={semantic.length}
            headerColor="bg-primary-500/15 text-primary-400"
            action={
              <button
                onClick={() => setShowCreate(true)}
                className="btn-primary flex items-center gap-1.5 text-xs py-1.5 px-3"
              >
                <Plus className="w-3.5 h-3.5" /> 新建
              </button>
            }
            empty={
              <div className="glass-panel p-10 text-center">
                <span className="text-4xl block mb-3 opacity-50">🗺️</span>
                <p className="text-neutral-500 text-sm mb-1">还没有语义画布</p>
                <button
                  onClick={() => setShowCreate(true)}
                  className="btn-primary mt-3 text-xs inline-flex items-center gap-1.5 py-1.5 px-3"
                >
                  <Plus className="w-3 h-3" /> 新建画布
                </button>
              </div>
            }
          >
            {semantic.map(cvs => (
              <SemanticCard
                key={cvs.id}
                canvas={cvs}
                onClick={() => navigate(`/egonetics/canvas/${cvs.id}`)}
                onDelete={e => handleDelete(e, cvs)}
              />
            ))}
          </Column>

          {/* 竖向分隔线 */}
          <div className="w-px self-stretch bg-white/5 shrink-0 mt-8" />

          {/* ── 执行图列 ── */}
          <Column
            title="执行图"
            subtitle="Agent 自动生成 · 任务执行过程图"
            count={execution.length}
            headerColor="bg-amber-500/15 text-amber-400"
            empty={
              <div className="glass-panel p-10 text-center">
                <span className="text-4xl block mb-3 opacity-30">⚡</span>
                <p className="text-neutral-500 text-sm mb-1">还没有执行图</p>
                <p className="text-neutral-700 text-xs">在 /agents 启动 Task 生命周期后，Agent 会自动创建执行图</p>
              </div>
            }
          >
            {execution.map(cvs => (
              <ExecutionCard
                key={cvs.id}
                canvas={cvs}
                onClick={() => navigate(`/egonetics/canvas/${cvs.id}`)}
              />
            ))}
          </Column>
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
