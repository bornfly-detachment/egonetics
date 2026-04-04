/**
 * L1Panel — 2D granular view layer
 *
 * 直接复用已有页面组件（不重复实现）：
 *   ChronicleView  → src/components/ChronicleView.tsx
 *   ProtocolView   → src/components/ProtocolView.tsx
 *   KanbanBoard    → src/components/taskBoard/KanbanBoard.tsx
 *   LabView        → src/components/LabView.tsx
 *
 * 自实现（无可用替代，对应页面已废弃）：
 *   KernelView     — kernel state + contracts (/cybernetics 已废)
 *   PrvseRulesView — PRVSE P/R/V/S 文档 + 层级表
 *   PlanGenView    — Expand/Commit 发散收敛 (/egonetics 已废)
 *   ConflictView   — /kernel/executions 冲突队列 (/queue /controller 已废)
 *   AITierView     — T0/T1/T2 资源节点信息
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { ArrowLeft, RefreshCw, CheckCircle, Clock, AlertTriangle,
         Zap, GitBranch, Loader, Play, Pencil, Trash2, Plus, X, Check } from 'lucide-react'
import { authFetch, getToken } from '@/lib/http'
import type { ControlNode } from '../useControlTree'

// ── 直接复用已有页面组件 ───────────────────────────────────────
import ChronicleViewPage    from '@/components/ChronicleView'
import ProtocolViewPage     from '@/components/ProtocolView'
import KanbanBoard          from '@/components/taskBoard/KanbanBoard'
import LabViewPage          from '@/components/LabView'
import TagTreeView          from '@/components/TagTreeView'
import ConstitutionView     from '@/components/ConstitutionView'
import EgoneticsSubjectPage from '@/components/EgoneticsSubjectPage'
import MemoryView           from '@/components/MemoryView'
import AgentsView           from '@/components/AgentsView'
import HomeView             from '@/components/HomeView'
import BlogPage             from '@/components/BlogPage'
import TheoryPageView       from '@/components/TheoryPageView'
import RecycleBinView       from '@/components/RecycleBinView'
import ControllerView       from '@/components/ControllerView'
import MQView               from '@/components/MQView'
import QueueView            from '@/components/QueueView'
import EgoneticsView        from '@/components/EgoneticsView'
import ProtocolBuilderView  from '@/components/ProtocolBuilderView'
import CyberneticsSystemView from '@/components/CyberneticsSystemView'

// ── Props ──────────────────────────────────────────────────────

interface L1PanelProps {
  comp: ControlNode
  root: ControlNode
  onBack: () => void
}

// ── Router ─────────────────────────────────────────────────────

export default function L1Panel({ comp, root, onBack }: L1PanelProps) {
  const meta      = comp.meta ?? {}
  const component = meta.component as string | undefined
  const type      = meta.type as string | undefined
  const tier      = meta.tier as string | undefined

  const isMapped = [
    'kernel','prvse-rules','protocol','plan-gen','objective-goals',
    'evaluator','mq','priority','chronicle','lab','subjective-goals','constitution-gen',
    // all Egonetics pages
    'memory','agents','home','blog','theory','recycle',
    'controller-view','mq-view','queue-view','egonetics-map',
    'protocol-builder','cybernetics',
  ].includes(component ?? '')
    || type === 'resource-tier' || !!tier

  return (
    <div className="absolute inset-0 z-30 bg-[#04050a]/96 backdrop-blur-xl flex flex-col">

      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-white/[0.07] shrink-0">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-colors mr-1"
        >
          <ArrowLeft size={14} />
        </button>
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: root.color }} />
        <span className="text-[11px] text-white/30 font-mono">{root.name}</span>
        <span className="text-white/15 text-[11px]">/</span>
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: comp.color }} />
        <span className="text-[13px] text-white/75 font-medium">{comp.name}</span>
        <div className="flex-1" />
        <span className="text-[9px] font-mono text-white/20 px-1.5 py-0.5 rounded bg-white/[0.04]">L1 粒度</span>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {/* 自实现（对应页面已废，无可用替代） */}
        {component === 'kernel'                              && <KernelView />}
        {component === 'plan-gen'                            && <PlanGenView node={comp} />}
        {(component === 'evaluator' || component === 'mq')  && <ConflictView />}
        {(type === 'resource-tier' || !!tier)                && <AITierView tier={tier ?? ''} node={comp} />}

        {/* 直接复用已有页面组件 */}
        {component === 'prvse-rules'       && <TagTreeView />}
        {component === 'protocol'          && <ProtocolViewPage />}
        {component === 'objective-goals'   && <KanbanBoard />}
        {component === 'chronicle'         && <ChronicleViewPage />}
        {component === 'lab'               && <LabViewPage />}
        {component === 'priority'          && <ConstitutionView />}
        {component === 'subjective-goals'  && <EgoneticsSubjectPage />}
        {component === 'constitution-gen'  && <ConstitutionView />}

        {/* 全系统页面入口 */}
        {component === 'memory'            && <MemoryView />}
        {component === 'agents'            && <AgentsView />}
        {component === 'home'              && <HomeView />}
        {component === 'blog'              && <BlogPage />}
        {component === 'theory'            && <TheoryPageView />}
        {component === 'recycle'           && <RecycleBinView />}
        {component === 'controller-view'   && <ControllerView />}
        {component === 'mq-view'           && <MQView />}
        {component === 'queue-view'        && <QueueView />}
        {component === 'egonetics-map'     && <EgoneticsView />}
        {component === 'protocol-builder'  && <ProtocolBuilderView />}
        {component === 'cybernetics'       && <CyberneticsSystemView />}

        {/* Fallback */}
        {!isMapped && <GenericView comp={comp} />}
      </div>
    </div>
  )
}

// ── KernelView (/cybernetics 已废，自实现) ─────────────────────

interface Contract { id: string; type: string; priority: number; layer?: string }
interface KernelState { tick: number; contracts: Contract[] }

function KernelView() {
  const [state, setState] = useState<KernelState | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try { setState(await authFetch<KernelState>('/kernel/state')) } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const typeColor: Record<string, string> = {
    perceiver: '#06b6d4', controller: '#3b82f6', evaluator: '#f97316'
  }

  return (
    <div className="h-full overflow-y-auto p-6 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <h2 className="text-[15px] text-white/70 font-medium">Kernel 物理引擎</h2>
        {state && (
          <span className="text-[10px] font-mono text-purple-400/60 bg-purple-400/[0.08] px-2 py-0.5 rounded">
            tick #{state.tick}
          </span>
        )}
        <button onClick={() => void load()} className="p-1.5 rounded-lg text-white/20 hover:text-white/50 hover:bg-white/[0.05] transition-colors">
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading && <LoadingDots label="加载合约中…" />}

      {state && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {(['perceiver','controller','evaluator'] as const).map(t => {
              const count = state.contracts.filter(c => c.type === t).length
              return (
                <div key={t} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 text-center">
                  <div className="text-[20px] font-light mb-1" style={{ color: typeColor[t] + 'cc' }}>{count}</div>
                  <div className="text-[9px] text-white/30 font-mono">{t}</div>
                </div>
              )
            })}
          </div>
          <div className="space-y-1.5">
            {state.contracts.length === 0 && (
              <EmptyState label="尚无合约" hint="在宪法生成面板中建立第一条规则" />
            )}
            {state.contracts
              .sort((a, b) => b.priority - a.priority)
              .map(c => (
                <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.09] transition-colors">
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: typeColor[c.type] ?? '#888' }} />
                  <span className="flex-1 text-[11px] text-white/60 font-mono truncate">{c.id}</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                    style={{ background: (typeColor[c.type] ?? '#888') + '15', color: (typeColor[c.type] ?? '#888') + 'bb' }}>
                    {c.type}
                  </span>
                  <span className="text-[9px] text-white/30 font-mono">p:{c.priority}</span>
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  )
}


// ── PlanGenView — Expand/Commit 发散收敛 (/egonetics 已废) ─────

interface PlanOption { title: string; description: string; steps: string[] }

function PlanGenView({ node }: { node: ControlNode }) {
  const [goal, setGoal]       = useState('')
  const [loading, setLoading] = useState(false)
  const [options, setOptions] = useState<PlanOption[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [committed, setCommitted] = useState(false)
  const [error, setError]     = useState('')
  const bufRef = useRef('')

  const handleExpand = useCallback(async () => {
    if (!goal.trim()) return
    setLoading(true)
    setOptions([])
    setSelected(null)
    setCommitted(false)
    setError('')
    bufRef.current = ''

    try {
      const token = getToken()
      const res = await fetch('/api/seai/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `你是一个计划生成器。用户目标：${goal}\n\n`
              + `请生成3-5个不同角度的实现方案，以JSON数组返回，每项格式：\n`
              + `{"title":"方案名（≤15字）","description":"简述（≤50字）","steps":["步骤1","步骤2","步骤3"]}\n`
              + `只返回JSON数组，不要其他内容。`,
          }],
          model: 'claude-sonnet-4-6',
          max_tokens: 1200,
        }),
      })

      if (!res.ok || !res.body) throw new Error('stream failed')
      const reader = res.body.getReader()
      const dec = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = dec.decode(value)
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ')) {
            try {
              const d = JSON.parse(line.slice(6))
              const text = d.delta?.text ?? d.choices?.[0]?.delta?.content ?? ''
              bufRef.current += text
            } catch { /* ignore */ }
          }
        }
      }

      const raw = bufRef.current.trim()
      const match = raw.match(/\[[\s\S]*\]/)
      if (match) {
        const parsed = JSON.parse(match[0]) as PlanOption[]
        setOptions(parsed)
      } else {
        throw new Error('invalid response')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成失败')
    } finally {
      setLoading(false)
    }
  }, [goal])

  const handleCommit = useCallback(async () => {
    if (selected === null) return
    const opt = options[selected]
    try {
      await authFetch('/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: opt.title,
          description: opt.description + '\n\n步骤：\n' + opt.steps.map((s, i) => `${i + 1}. ${s}`).join('\n'),
          status: 'todo',
          source: node.id,
        }),
      })
      setCommitted(true)
    } catch {
      setError('创建任务失败')
    }
  }, [selected, options, node.id])

  return (
    <div className="h-full overflow-y-auto p-6 space-y-5">
      <div className="flex items-center gap-2 mb-2">
        <GitBranch size={14} className="text-cyan-400/60" />
        <h2 className="text-[15px] text-white/70 font-medium">计划生成 — 发散/收敛</h2>
      </div>

      {/* Goal input */}
      <div className="space-y-2">
        <label className="text-[11px] text-white/35">描述你的目标</label>
        <div className="flex gap-2">
          <input
            value={goal}
            onChange={e => setGoal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !loading) void handleExpand() }}
            placeholder="例：实现用户登录功能"
            className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-white/70 placeholder-white/20 outline-none focus:border-cyan-500/40"
          />
          <button
            onClick={() => void handleExpand()}
            disabled={!goal.trim() || loading}
            className="px-4 py-2 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300/80 text-[11px] font-medium hover:bg-cyan-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
          >
            {loading ? <Loader size={11} className="animate-spin" /> : <Zap size={11} />}
            发散
          </button>
        </div>
      </div>

      {error && <p className="text-[11px] text-red-400/70">{error}</p>}

      {/* Options */}
      {options.length > 0 && !committed && (
        <div className="space-y-3">
          <div className="text-[11px] text-white/35">选择一个方案</div>
          {options.map((opt, i) => (
            <button
              key={i}
              onClick={() => setSelected(i)}
              className={`w-full text-left rounded-xl p-4 border transition-all ${
                selected === i
                  ? 'border-cyan-500/40 bg-cyan-500/[0.07]'
                  : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-4 h-4 rounded-full border flex items-center justify-center text-[8px] shrink-0"
                  style={{ borderColor: selected === i ? '#06b6d4' : 'rgba(255,255,255,0.15)',
                           color: selected === i ? '#06b6d4' : 'rgba(255,255,255,0.3)' }}>
                  {i + 1}
                </span>
                <span className="text-[12px] font-medium text-white/70">{opt.title}</span>
              </div>
              <p className="text-[10px] text-white/35 mb-2">{opt.description}</p>
              <ul className="space-y-0.5">
                {opt.steps.map((s, si) => (
                  <li key={si} className="text-[9px] text-white/25 flex items-start gap-1.5">
                    <span className="shrink-0 mt-0.5">·</span>{s}
                  </li>
                ))}
              </ul>
            </button>
          ))}

          <button
            onClick={() => void handleCommit()}
            disabled={selected === null}
            className="w-full py-2.5 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-[12px] font-medium hover:bg-cyan-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            <Play size={12} /> 收敛 — 创建任务
          </button>
        </div>
      )}

      {committed && (
        <div className="flex items-center gap-2 text-green-400/70 text-[12px]">
          <CheckCircle size={14} /> 任务已创建，前往
          <a href="/tasks" className="underline hover:text-green-300 transition-colors">/tasks</a>
          查看
        </div>
      )}
    </div>
  )
}

// ── ConflictView (/queue /controller 已废，自实现) ─────────────

interface Execution { id: string; contractId: string; status: string; startedAt: string; error?: string }

function ConflictView() {
  const [runs, setRuns]       = useState<Execution[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const all = await authFetch<Execution[]>('/kernel/executions')
      setRuns(all.filter(r => r.status === 'escalated' || r.status === 'failed' || r.status === 'blocked'))
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  return (
    <div className="h-full overflow-y-auto p-6 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <AlertTriangle size={14} className="text-amber-400/60" />
        <h2 className="text-[15px] text-white/70 font-medium">冲突裁决队列</h2>
        <button onClick={() => void load()} className="p-1.5 rounded-lg text-white/20 hover:text-white/50 hover:bg-white/[0.05] transition-colors ml-auto">
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading && <LoadingDots label="加载冲突列表…" />}

      {!loading && runs.length === 0 && (
        <EmptyState label="无待裁决冲突" hint="所有执行正常运行中" />
      )}

      <div className="space-y-2">
        {runs.map(r => (
          <div key={r.id} className="rounded-xl bg-white/[0.02] border border-amber-400/[0.12] p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={10} className="text-amber-400/50 shrink-0" />
              <span className="text-[11px] text-white/55 font-mono truncate flex-1">{r.contractId}</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded font-mono bg-amber-400/10 text-amber-400/70">{r.status}</span>
            </div>
            {r.error && (
              <p className="text-[10px] text-red-400/60 mt-1 font-mono leading-relaxed">{r.error}</p>
            )}
            <div className="text-[9px] text-white/20 mt-1.5">{new Date(r.startedAt).toLocaleString('zh')}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── AITierView — T0/T1/T2 资源节点 ────────────────────────────

interface T2Agent {
  id: number
  tmux_session: string
  sphere: string
  workdir: string
  default_model: string
  active: boolean
}

const BLANK_AGENT: Omit<T2Agent, 'id'> = {
  tmux_session: '', sphere: '', workdir: '', default_model: 'claude-sonnet-4-6', active: true,
}

function AITierView({ tier, node }: { tier: string; node: ControlNode }) {
  const meta = node.meta ?? {}
  const tierDefs: Record<string, { label: string; color: string; desc: string; proto: string }> = {
    T0: { label: 'T0 本地模型', color: '#10b981', desc: '零延迟 · 完全离线 · 最高隐私', proto: 'L0 内存调用' },
    T1: { label: 'T1 私有部署', color: '#3b82f6', desc: '局域网 · 可信环境 · 低延迟',  proto: 'L1 IPC' },
    T2: { label: 'T2 Claude (tmux)', color: '#8b5cf6', desc: '本机 tmux · Claude Code CLI · 审批制', proto: 'L2 tmux/JSONL' },
  }
  const def = tierDefs[tier] ?? { label: tier, color: '#888', desc: '', proto: '' }

  // T2 专属：config CRUD
  const [agents, setAgents]       = useState<T2Agent[]>([])
  const [editId, setEditId]       = useState<number | null>(null)
  const [editBuf, setEditBuf]     = useState<Partial<T2Agent>>({})
  const [adding, setAdding]       = useState(false)
  const [newBuf, setNewBuf]       = useState<Omit<T2Agent, 'id'>>(BLANK_AGENT)
  const [loading, setLoading]     = useState(false)
  const [err, setErr]             = useState('')

  const fetchAgents = useCallback(async () => {
    if (tier !== 'T2') return
    setLoading(true)
    try {
      const r = await authFetch('/t2-config')
      setAgents(await r.json())
    } catch { setErr('加载失败') }
    finally { setLoading(false) }
  }, [tier])

  useEffect(() => { fetchAgents() }, [fetchAgents])

  async function saveEdit(id: number) {
    await authFetch(`/t2-config/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editBuf) })
    setEditId(null); setEditBuf({}); fetchAgents()
  }

  async function deleteAgent(id: number) {
    await authFetch(`/t2-config/${id}`, { method: 'DELETE' })
    fetchAgents()
  }

  async function addAgent() {
    if (!newBuf.tmux_session || !newBuf.sphere || !newBuf.workdir) { setErr('tmux_session / sphere / workdir 必填'); return }
    await authFetch('/t2-config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newBuf) })
    setAdding(false); setNewBuf(BLANK_AGENT); setErr(''); fetchAgents()
  }

  const inputCls = 'bg-white/[0.04] border border-white/[0.08] rounded px-2 py-0.5 text-[10px] font-mono text-white/70 outline-none focus:border-white/20 w-full'

  return (
    <div className="h-full overflow-y-auto p-5 space-y-4">
      {/* 标题行 */}
      <div className="flex items-center gap-3">
        <Zap size={13} style={{ color: def.color }} />
        <h2 className="text-[14px] text-white/70 font-medium">{def.label}</h2>
        <span className="text-[9px] font-mono px-2 py-0.5 rounded" style={{ background: def.color + '15', color: def.color + 'bb' }}>{def.proto}</span>
        <span className="flex-1" />
        <button onClick={fetchAgents} className="text-white/20 hover:text-white/50 transition-colors"><RefreshCw size={11} /></button>
      </div>
      <p className="text-[11px] text-white/30">{def.desc}</p>

      {tier !== 'T2' ? (
        // T0 / T1：只读 meta
        <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] p-4 space-y-2">
          {Object.entries(meta).map(([k, v]) => (
            <div key={k} className="flex items-center gap-3">
              <span className="text-[10px] text-white/25 font-mono w-24 shrink-0">{k}</span>
              <span className="text-[10px] text-white/50 truncate">{String(v)}</span>
            </div>
          ))}
        </div>
      ) : (
        // T2：CRUD 配置表
        <div className="space-y-3">
          {err && <p className="text-[10px] text-red-400/80">{err}</p>}
          {loading ? (
            <div className="flex items-center gap-2 text-white/20 text-[11px]"><Loader size={11} className="animate-spin" />加载中…</div>
          ) : (
            <div className="rounded-xl border border-white/[0.06] overflow-hidden">
              {/* 表头 */}
              <div className="grid grid-cols-[1fr_80px_1.5fr_120px_60px_52px] gap-2 px-3 py-2 bg-white/[0.03] border-b border-white/[0.05]">
                {['session', 'sphere', 'workdir', 'model', 'active', ''].map(h => (
                  <span key={h} className="text-[9px] font-mono text-white/20 uppercase tracking-wider">{h}</span>
                ))}
              </div>

              {/* 数据行 */}
              {agents.map(a => editId === a.id ? (
                <div key={a.id} className="grid grid-cols-[1fr_80px_1.5fr_120px_60px_52px] gap-2 px-3 py-2 border-b border-white/[0.04] bg-white/[0.02] items-center">
                  <input className={inputCls} value={editBuf.tmux_session ?? a.tmux_session} onChange={e => setEditBuf(b => ({ ...b, tmux_session: e.target.value }))} />
                  <input className={inputCls} value={editBuf.sphere ?? a.sphere} onChange={e => setEditBuf(b => ({ ...b, sphere: e.target.value }))} />
                  <input className={inputCls} value={editBuf.workdir ?? a.workdir} onChange={e => setEditBuf(b => ({ ...b, workdir: e.target.value }))} />
                  <input className={inputCls} value={editBuf.default_model ?? a.default_model} onChange={e => setEditBuf(b => ({ ...b, default_model: e.target.value }))} />
                  <select className={inputCls} value={String(editBuf.active ?? a.active)} onChange={e => setEditBuf(b => ({ ...b, active: e.target.value === 'true' }))}>
                    <option value="true">on</option><option value="false">off</option>
                  </select>
                  <div className="flex gap-1">
                    <button onClick={() => saveEdit(a.id)} className="text-green-400/70 hover:text-green-400 transition-colors"><Check size={11} /></button>
                    <button onClick={() => { setEditId(null); setEditBuf({}) }} className="text-white/20 hover:text-white/50 transition-colors"><X size={11} /></button>
                  </div>
                </div>
              ) : (
                <div key={a.id} className="grid grid-cols-[1fr_80px_1.5fr_120px_60px_52px] gap-2 px-3 py-2 border-b border-white/[0.04] items-center group hover:bg-white/[0.01]">
                  <span className="text-[10px] font-mono text-white/50 truncate">{a.tmux_session}</span>
                  <span className="text-[10px] font-mono text-white/60 truncate">{a.sphere}</span>
                  <span className="text-[9px] font-mono text-white/30 truncate" title={a.workdir}>{a.workdir.split('/').slice(-2).join('/')}</span>
                  <span className="text-[9px] font-mono text-white/40 truncate">{a.default_model}</span>
                  <span className={`text-[9px] font-mono ${a.active ? 'text-green-400/60' : 'text-white/20'}`}>{a.active ? 'on' : 'off'}</span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditId(a.id); setEditBuf({}) }} className="text-white/30 hover:text-white/70 transition-colors"><Pencil size={10} /></button>
                    <button onClick={() => deleteAgent(a.id)} className="text-red-400/40 hover:text-red-400/80 transition-colors"><Trash2 size={10} /></button>
                  </div>
                </div>
              ))}

              {/* 新增行 */}
              {adding ? (
                <div className="grid grid-cols-[1fr_80px_1.5fr_120px_60px_52px] gap-2 px-3 py-2 bg-white/[0.02] items-center">
                  <input className={inputCls} placeholder="session" value={newBuf.tmux_session} onChange={e => setNewBuf(b => ({ ...b, tmux_session: e.target.value }))} />
                  <input className={inputCls} placeholder="sphere" value={newBuf.sphere} onChange={e => setNewBuf(b => ({ ...b, sphere: e.target.value }))} />
                  <input className={inputCls} placeholder="workdir" value={newBuf.workdir} onChange={e => setNewBuf(b => ({ ...b, workdir: e.target.value }))} />
                  <input className={inputCls} placeholder="model" value={newBuf.default_model} onChange={e => setNewBuf(b => ({ ...b, default_model: e.target.value }))} />
                  <select className={inputCls} value={String(newBuf.active)} onChange={e => setNewBuf(b => ({ ...b, active: e.target.value === 'true' }))}>
                    <option value="true">on</option><option value="false">off</option>
                  </select>
                  <div className="flex gap-1">
                    <button onClick={addAgent} className="text-green-400/70 hover:text-green-400 transition-colors"><Check size={11} /></button>
                    <button onClick={() => { setAdding(false); setNewBuf(BLANK_AGENT); setErr('') }} className="text-white/20 hover:text-white/50 transition-colors"><X size={11} /></button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setAdding(true)} className="w-full flex items-center gap-2 px-3 py-2 text-white/20 hover:text-white/50 hover:bg-white/[0.02] transition-colors text-[10px]">
                  <Plus size={10} /> 新增 T2 Agent
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── GenericView — fallback ─────────────────────────────────────

function GenericView({ comp }: { comp: ControlNode }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-4 text-white/20 p-8">
      <div className="w-10 h-10 rounded-xl border border-white/[0.08] flex items-center justify-center">
        <span className="w-3 h-3 rounded-full" style={{ background: comp.color }} />
      </div>
      <div className="text-center">
        <div className="text-[13px] text-white/40 font-medium mb-1">{comp.name}</div>
        <div className="text-[11px] text-white/20">
          {comp.meta?.description as string ?? '暂无对应视图'}
        </div>
      </div>
      <pre className="text-[9px] font-mono text-white/10 bg-white/[0.02] rounded-lg px-4 py-3 max-w-sm overflow-auto">
        {JSON.stringify(comp.meta, null, 2)}
      </pre>
    </div>
  )
}

// ── Shared helpers ─────────────────────────────────────────────

function LoadingDots({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-6 justify-center text-white/20 text-[11px]">
      <Loader size={12} className="animate-spin" />{label}
    </div>
  )
}

function EmptyState({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="py-10 text-center space-y-1">
      <div className="text-[13px] text-white/30">{label}</div>
      <div className="text-[10px] text-white/15">{hint}</div>
    </div>
  )
}
