/**
 * SEAIVPanel — SEAI V 层面板（完整 CRUD）
 * 系统函数：可编辑 description/weight/trigger/enabled，不可删除、不可改 expression
 * 用户函数：完整 CRUD，expression 可编辑
 */
import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, BarChart3, SlidersHorizontal, Plus, Trash2, Edit2, X, Lock } from 'lucide-react'

const SEAI_BASE = 'http://localhost:8000'

// ── 类型 ──────────────────────────────────────────────────────────────────────

interface VFunction {
  id:          string
  name:        string
  description: string
  unit:        string
  weight:      number
  trigger:     string
  enabled:     boolean
  is_builtin:  boolean
  expression:  string | null
}

interface VStats {
  total:      number
  avg_reward: number | null
  min_reward: number | null
  max_reward: number | null
  high_count: number
  low_count:  number
}

async function seaiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${SEAI_BASE}${path}`, init)
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`)
  return res.json()
}

const TRIGGER_OPTIONS = ['any', 'llm_call', 'tool_call', 'local_judge', 'rule_branch', 'human_gate']
const TRIGGER_COLOR: Record<string, string> = {
  any:         'text-white/40 bg-white/[0.06]',
  llm_call:    'text-violet-300 bg-violet-500/10',
  tool_call:   'text-blue-300  bg-blue-500/10',
  local_judge: 'text-amber-300 bg-amber-500/10',
}

// ── 编辑抽屉 ──────────────────────────────────────────────────────────────────

function EditDrawer({
  fn,
  onSave,
  onClose,
}: {
  fn: VFunction
  onSave: (updated: Partial<VFunction>) => Promise<void>
  onClose: () => void
}) {
  const [description, setDescription] = useState(fn.description)
  const [weight,      setWeight]      = useState(String(fn.weight))
  const [trigger,     setTrigger]     = useState(fn.trigger)
  const [expression,  setExpression]  = useState(fn.expression ?? '')
  const [enabled,     setEnabled]     = useState(fn.enabled)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')

  const save = async () => {
    const w = parseFloat(weight)
    if (isNaN(w) || w < 0) { setError('weight 必须 >= 0'); return }
    setSaving(true); setError('')
    try {
      const patch: Partial<VFunction> = { description, weight: w, trigger, enabled }
      if (!fn.is_builtin) patch.expression = expression
      await onSave(patch)
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-[520px] max-h-[90vh] overflow-y-auto bg-[#111] border border-white/10 rounded-xl shadow-2xl flex flex-col">

        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07]">
          <div>
            <div className="text-sm font-mono font-bold text-violet-300">{fn.name}</div>
            <div className="text-xs text-white/30 mt-0.5">{fn.is_builtin ? '系统函数' : '用户函数'}</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded text-white/30 hover:text-white/70 hover:bg-white/[0.06]">
            <X size={15} />
          </button>
        </div>

        {/* 表单 */}
        <div className="flex flex-col gap-4 p-6">

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-white/40 uppercase tracking-widest">描述</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              className="bg-[#0d0d0d] border border-white/10 rounded-md px-3 py-2 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-violet-400/60 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-white/40 uppercase tracking-widest">权重 Weight</label>
              <input
                type="number" min={0} max={10} step={0.1}
                value={weight}
                onChange={e => setWeight(e.target.value)}
                className="bg-[#0d0d0d] border border-white/10 rounded-md px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-violet-400/60"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-white/40 uppercase tracking-widest">触发 Trigger</label>
              <select
                value={trigger}
                onChange={e => setTrigger(e.target.value)}
                className="bg-[#0d0d0d] border border-white/10 rounded-md px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-violet-400/60"
              >
                {TRIGGER_OPTIONS.map(t => (
                  <option key={t} value={t} className="bg-neutral-900">{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setEnabled(v => !v)}
              className={`relative w-10 h-5 rounded-full transition-colors ${enabled ? 'bg-violet-500' : 'bg-white/10'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${enabled ? 'left-5' : 'left-0.5'}`} />
            </button>
            <span className="text-sm text-white/50">{enabled ? '已启用' : '已禁用'}</span>
          </div>

          {/* Expression（仅用户函数） */}
          {fn.is_builtin ? (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-white/20 uppercase tracking-widest flex items-center gap-1.5">
                <Lock size={10} />计算逻辑（系统函数，不可编辑）
              </label>
              <div className="bg-[#0a0a0a] border border-white/[0.06] rounded-md px-3 py-2 text-xs font-mono text-white/20">
                Python 代码 — 在 modules/prvse/v/functions/ 中定义
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-white/40 uppercase tracking-widest">
                Expression（Python 表达式，返回 float）
              </label>
              <textarea
                value={expression}
                onChange={e => setExpression(e.target.value)}
                rows={4}
                placeholder={'# ctx 是 ExecutionContext\n# 可用字段: ctx.succeeded, ctx.token_total, ctx.net_time_ms,\n#          ctx.budget_tokens, ctx.error_info, ctx.node_kind\n1.0 if ctx.succeeded else 0.0'}
                className="bg-[#0d0d0d] border border-white/10 rounded-md px-3 py-2 text-xs font-mono text-white/70 placeholder:text-white/20 focus:outline-none focus:border-violet-400/60 resize-none"
              />
              <p className="text-[11px] text-white/20">可用: ctx.succeeded / ctx.failed / ctx.token_total / ctx.budget_tokens / ctx.net_time_ms / ctx.error_info</p>
            </div>
          )}

          {error && <p className="text-xs text-red-400 px-1">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 px-6 pb-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-white/40 hover:text-white/70 rounded-lg hover:bg-white/[0.06]">取消</button>
          <button
            onClick={save} disabled={saving}
            className="px-4 py-2 text-sm bg-violet-600 hover:bg-violet-500 text-white rounded-lg disabled:opacity-50"
          >
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 新建函数表单 ──────────────────────────────────────────────────────────────

function CreateDrawer({ onCreated, onClose }: { onCreated: () => void; onClose: () => void }) {
  const [name,        setName]        = useState('')
  const [description, setDescription] = useState('')
  const [unit,        setUnit]        = useState('score')
  const [weight,      setWeight]      = useState('1.0')
  const [trigger,     setTrigger]     = useState('any')
  const [expression,  setExpression]  = useState('')
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')

  const create = async () => {
    if (!name.trim())       { setError('name 必填'); return }
    if (!expression.trim()) { setError('expression 必填'); return }
    const w = parseFloat(weight)
    if (isNaN(w) || w < 0) { setError('weight 必须 >= 0'); return }
    setSaving(true); setError('')
    try {
      await seaiFetch('/prvse/v/functions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, description, unit, weight: w, trigger, expression }),
      })
      onCreated()
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-[520px] max-h-[90vh] overflow-y-auto bg-[#111] border border-white/10 rounded-xl shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07]">
          <span className="text-sm font-semibold text-white/80">新建 Reward Function</span>
          <button onClick={onClose} className="p-1.5 rounded text-white/30 hover:text-white/70 hover:bg-white/[0.06]">
            <X size={15} />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-6">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-white/40 uppercase tracking-widest">函数名（英文，作为 ID）</label>
            <input
              value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. quality_depth"
              className="bg-[#0d0d0d] border border-white/10 rounded-md px-3 py-2 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-violet-400/60 font-mono"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-white/40 uppercase tracking-widest">描述</label>
            <input
              value={description} onChange={e => setDescription(e.target.value)}
              placeholder="这个函数评估什么"
              className="bg-[#0d0d0d] border border-white/10 rounded-md px-3 py-2 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-violet-400/60"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-white/40 uppercase tracking-widest">单位</label>
              <input value={unit} onChange={e => setUnit(e.target.value)}
                className="bg-[#0d0d0d] border border-white/10 rounded-md px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-violet-400/60" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-white/40 uppercase tracking-widest">权重</label>
              <input type="number" min={0} step={0.1} value={weight} onChange={e => setWeight(e.target.value)}
                className="bg-[#0d0d0d] border border-white/10 rounded-md px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-violet-400/60" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-white/40 uppercase tracking-widest">Trigger</label>
              <select value={trigger} onChange={e => setTrigger(e.target.value)}
                className="bg-[#0d0d0d] border border-white/10 rounded-md px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-violet-400/60">
                {TRIGGER_OPTIONS.map(t => <option key={t} value={t} className="bg-neutral-900">{t}</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-white/40 uppercase tracking-widest">Expression（Python 表达式）</label>
            <textarea
              value={expression} onChange={e => setExpression(e.target.value)} rows={5}
              placeholder={'# 返回 float，ctx 是 ExecutionContext\n1.0 if ctx.succeeded and ctx.net_time_ms < 3000 else 0.5'}
              className="bg-[#0d0d0d] border border-white/10 rounded-md px-3 py-2 text-xs font-mono text-white/70 placeholder:text-white/20 focus:outline-none focus:border-violet-400/60 resize-none"
            />
            <p className="text-[11px] text-white/20">ctx.succeeded / ctx.failed / ctx.token_total / ctx.budget_tokens / ctx.net_time_ms / ctx.error_info / ctx.node_kind</p>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 px-6 pb-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-white/40 hover:text-white/70 rounded-lg hover:bg-white/[0.06]">取消</button>
          <button onClick={create} disabled={saving}
            className="px-4 py-2 text-sm bg-violet-600 hover:bg-violet-500 text-white rounded-lg disabled:opacity-50">
            {saving ? '创建中…' : '创建'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 函数行 ────────────────────────────────────────────────────────────────────

function FunctionRow({
  fn,
  onEdit,
  onDelete,
  onToggleEnabled,
}: {
  fn: VFunction
  onEdit: (fn: VFunction) => void
  onDelete: (fn: VFunction) => void
  onToggleEnabled: (fn: VFunction) => void
}) {
  return (
    <div className={`flex items-start gap-3 p-4 rounded-lg border transition-colors
      ${fn.enabled
        ? 'border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04]'
        : 'border-white/[0.03] bg-transparent opacity-50'
      }`}
    >
      {/* 启禁用点 */}
      <button
        onClick={() => onToggleEnabled(fn)}
        className={`mt-0.5 shrink-0 w-2.5 h-2.5 rounded-full border transition-all
          ${fn.enabled ? 'bg-violet-400 border-violet-400' : 'bg-transparent border-white/20'}`}
        title={fn.enabled ? '点击禁用' : '点击启用'}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-mono font-semibold text-white/80">{fn.name}</span>
          {fn.is_builtin && (
            <span className="flex items-center gap-1 text-[10px] text-white/20 bg-white/[0.04] px-1.5 py-0.5 rounded">
              <Lock size={8} />内置
            </span>
          )}
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${TRIGGER_COLOR[fn.trigger] ?? TRIGGER_COLOR.any}`}>
            {fn.trigger}
          </span>
          <span className="text-[10px] text-white/20">{fn.unit}</span>
        </div>
        <p className="text-xs text-white/40 mt-1 leading-relaxed">{fn.description || <span className="italic">无描述</span>}</p>
        {!fn.is_builtin && fn.expression && (
          <pre className="mt-2 text-[10px] font-mono text-white/30 bg-white/[0.03] rounded px-2 py-1 overflow-x-auto">
            {fn.expression}
          </pre>
        )}
      </div>

      {/* 权重 */}
      <div className="shrink-0 text-right">
        <div className="text-base font-mono font-bold text-white/70">×{fn.weight.toFixed(1)}</div>
      </div>

      {/* 操作 */}
      <div className="shrink-0 flex items-center gap-1">
        <button
          onClick={() => onEdit(fn)}
          className="p-1.5 rounded text-white/30 hover:text-white/70 hover:bg-white/[0.07]"
          title="编辑"
        >
          <Edit2 size={13} />
        </button>
        {!fn.is_builtin && (
          <button
            onClick={() => onDelete(fn)}
            className="p-1.5 rounded text-white/30 hover:text-red-400 hover:bg-red-500/10"
            title="删除"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  )
}

// ── Stats 面板 ────────────────────────────────────────────────────────────────

function StatsPanel({ stats }: { stats: VStats | null }) {
  if (!stats || !stats.total) {
    return <div className="text-center text-white/20 py-8 text-sm">暂无 reward 数据 — 执行任务后自动积累</div>
  }
  const items = [
    { label: '总样本',      value: stats.total,                          color: 'text-white/70' },
    { label: '平均 reward', value: stats.avg_reward?.toFixed(3) ?? '-',  color: 'text-emerald-300' },
    { label: '最高',        value: stats.max_reward?.toFixed(3) ?? '-',  color: 'text-green-300' },
    { label: '最低',        value: stats.min_reward?.toFixed(3) ?? '-',  color: 'text-red-300' },
    { label: '高分 ≥2',    value: stats.high_count,                     color: 'text-violet-300' },
    { label: '低分 <0.5',  value: stats.low_count,                      color: 'text-orange-300' },
  ]
  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map(item => (
        <div key={item.label} className="p-3 rounded-lg border border-white/[0.07] bg-white/[0.02] text-center">
          <div className={`text-xl font-mono font-bold ${item.color}`}>{item.value}</div>
          <div className="text-[11px] text-white/30 mt-1">{item.label}</div>
        </div>
      ))}
    </div>
  )
}

// ── 主面板 ────────────────────────────────────────────────────────────────────

type PanelTab = 'registry' | 'stats'

export default function SEAIVPanel() {
  const [tab,        setTab]        = useState<PanelTab>('registry')
  const [functions,  setFunctions]  = useState<VFunction[]>([])
  const [stats,      setStats]      = useState<VStats | null>(null)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')
  const [editTarget, setEditTarget] = useState<VFunction | null>(null)
  const [creating,   setCreating]   = useState(false)

  const loadFunctions = useCallback(async () => {
    setLoading(true); setError('')
    try {
      setFunctions(await seaiFetch<VFunction[]>('/prvse/v/functions'))
    } catch {
      setError('无法连接 SEAI :8000 — 请确认服务已启动')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadStats = useCallback(async () => {
    try { setStats(await seaiFetch<VStats>('/prvse/v/stats')) } catch { /* ignore */ }
  }, [])

  useEffect(() => { loadFunctions(); loadStats() }, [loadFunctions, loadStats])

  const handleSave = async (fn: VFunction, patch: Partial<VFunction>) => {
    await seaiFetch(`/prvse/v/functions/${fn.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(patch),
    })
    await loadFunctions()
  }

  const handleDelete = async (fn: VFunction) => {
    if (!confirm(`确认删除 "${fn.name}"？`)) return
    await seaiFetch(`/prvse/v/functions/${fn.id}`, { method: 'DELETE' })
    await loadFunctions()
  }

  const handleToggleEnabled = async (fn: VFunction) => {
    await seaiFetch(`/prvse/v/functions/${fn.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ enabled: !fn.enabled }),
    })
    await loadFunctions()
  }

  const totalWeight = functions.filter(f => f.enabled).reduce((s, f) => s + f.weight, 0)

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-hidden">

      {/* 顶栏 */}
      <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
        <div>
          <h2 className="text-sm font-semibold text-white/80">V 层 — Reward Functions</h2>
          <p className="text-xs text-white/30 mt-0.5">SEAI 执行评价 · 权重可调 · 驱动 GRPO 训练</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/20">{functions.filter(f => f.enabled).length}/{functions.length} 启用</span>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/20 rounded-lg transition-colors"
          >
            <Plus size={12} />新建函数
          </button>
          <button
            onClick={() => { loadFunctions(); loadStats() }}
            disabled={loading}
            className="p-1.5 rounded text-white/30 hover:text-white/70 hover:bg-white/[0.06]"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* 子 Tab */}
      <div className="shrink-0 flex gap-1 px-6 py-2 border-b border-white/[0.04]">
        {([
          { id: 'registry', label: '函数注册表', icon: <SlidersHorizontal size={12} /> },
          { id: 'stats',    label: 'Reward 统计', icon: <BarChart3 size={12} /> },
        ] as { id: PanelTab; label: string; icon: React.ReactNode }[]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-colors
              ${tab === t.id ? 'bg-violet-500/20 text-violet-300' : 'text-white/30 hover:text-white/60 hover:bg-white/[0.04]'}`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* 内容 */}
      <div className="flex-1 overflow-y-auto p-6">
        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg border border-red-500/20 bg-red-500/10 text-sm text-red-300">{error}</div>
        )}

        {tab === 'registry' && (
          <>
            {/* 权重分布 */}
            {functions.length > 0 && (
              <div className="mb-5 p-4 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                <div className="text-xs text-white/30 mb-2">启用函数权重分布（总和 {totalWeight.toFixed(1)}）</div>
                <div className="flex h-2 rounded-full overflow-hidden gap-px">
                  {functions.filter(f => f.enabled).map(fn => (
                    <div key={fn.id} title={`${fn.name}: ${fn.weight}`} className="h-full"
                      style={{
                        width: `${(fn.weight / totalWeight) * 100}%`,
                        background: fn.trigger === 'llm_call' ? '#8b5cf6' :
                                    fn.trigger === 'tool_call' ? '#3b82f6' :
                                    fn.is_builtin ? '#6b7280' : '#f59e0b',
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {loading && functions.length === 0
                ? <div className="text-center text-white/20 py-12 text-sm">连接 SEAI…</div>
                : functions.map(fn => (
                    <FunctionRow
                      key={fn.id} fn={fn}
                      onEdit={setEditTarget}
                      onDelete={handleDelete}
                      onToggleEnabled={handleToggleEnabled}
                    />
                  ))
              }
            </div>
          </>
        )}

        {tab === 'stats' && <StatsPanel stats={stats} />}
      </div>

      {/* 抽屉 */}
      {editTarget && (
        <EditDrawer
          fn={editTarget}
          onSave={patch => handleSave(editTarget, patch)}
          onClose={() => setEditTarget(null)}
        />
      )}
      {creating && (
        <CreateDrawer
          onCreated={loadFunctions}
          onClose={() => setCreating(false)}
        />
      )}
    </div>
  )
}
