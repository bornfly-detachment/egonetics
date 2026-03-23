/**
 * PRVSPanel — 控制论底层指令集 REPL
 * P=Pattern(差异识别) R=Relation(因果连接) V=Value(系统权重) S=State(激活模式)
 * 任何控制论元操作 = PRVS 的组合
 */
import React, { useState } from 'react'
import { prvsApi, type PRecognizeResult, type PClassifyResult, type RPropagateResult, type RPathsResult, type VRankResult, type VWeightResult, type SState, type SDiffResult, type SPredictResult, type AxiomEntry, type AxiomSets } from '@/lib/prvs-api'
import { Loader2, Plus, Trash2, ChevronDown, ChevronRight, Edit2, Check, X } from 'lucide-react'
import BlockEditor, { generateBlockId, type Block } from './BlockEditor'

type Tab = 'axioms' | 'spec' | 'tests' | 'P' | 'R' | 'V' | 'S'
type ResultData = PRecognizeResult | PClassifyResult | RPropagateResult | RPathsResult | VRankResult | VWeightResult | SState | SDiffResult | SPredictResult | { error: string } | null

// ── Shared ────────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-white/40 uppercase tracking-widest">{label}</label>
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="bg-[#111] border border-white/10 rounded-md px-3 py-2 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-violet-400/60 font-mono"
    />
  )
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="bg-[#111] border border-white/10 rounded-md px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-violet-400/60"
    >
      {options.map(o => (
        <option key={o.value} value={o.value} className="bg-neutral-900">{o.label}</option>
      ))}
    </select>
  )
}

function RunButton({ onClick, loading, label = '执行' }: { onClick: () => void; loading: boolean; label?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="self-start flex items-center gap-2 px-5 py-2.5 rounded-md bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm font-semibold text-white"
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : <span className="text-xs">▶</span>}
      {label}
    </button>
  )
}

// ── Result Renderer ───────────────────────────────────────────────────────────

function ResultPanel({ data }: { data: ResultData }) {
  if (!data) return null

  if ('error' in data) {
    return (
      <div className="mt-3 p-3 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-mono">
        ✗ {(data as { error: string }).error}
      </div>
    )
  }

  return (
    <div className="mt-3 rounded bg-[#0d0d0d] border border-white/[0.06] overflow-hidden">
      <div className="px-3 py-2 border-b border-white/[0.06] flex items-center justify-between">
        <span className="text-xs font-semibold text-neutral-500 font-mono">{'operation' in data ? String((data as { operation: string }).operation) : 'result'}</span>
      </div>
      <pre className="px-3 py-3 text-xs text-neutral-300 font-mono overflow-auto max-h-80 leading-relaxed whitespace-pre-wrap">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  )
}

// ── P Tab ─────────────────────────────────────────────────────────────────────

function PTab() {
  const [op, setOp] = useState<'recognize' | 'classify'>('recognize')
  const [input, setInput] = useState('')
  const [topK, setTopK] = useState('10')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ResultData>(null)

  async function run() {
    if (!input.trim()) return
    setLoading(true)
    try {
      const r = op === 'recognize'
        ? await prvsApi.recognize(input.trim(), parseInt(topK) || 10)
        : await prvsApi.classify(input.trim())
      setResult(r)
    } catch (e) {
      setResult({ error: String(e) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="p-4 rounded-lg bg-white/[0.03] border border-white/[0.08] text-sm text-white/40 leading-relaxed">
        <span className="text-violet-300 font-bold text-base">P = Pattern</span>
        {'  '}差异的识别与结构化。输入任意文本，P 在本体图中找到匹配的模式节点。
      </div>

      <Field label="操作">
        <Select
          value={op}
          onChange={v => setOp(v as 'recognize' | 'classify')}
          options={[
            { value: 'recognize', label: 'P.recognize — 识别匹配模式节点' },
            { value: 'classify',  label: 'P.classify — 分类到最佳层/类型' },
          ]}
        />
      </Field>

      <Field label="输入文本">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="输入任意概念、问题或描述..."
          rows={3}
          className="bg-[#111] border border-white/10 rounded-md px-3 py-2 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-violet-400/60 font-mono resize-none"
        />
      </Field>

      {op === 'recognize' && (
        <Field label="返回 Top-K">
          <Input value={topK} onChange={setTopK} placeholder="10" />
        </Field>
      )}

      <RunButton onClick={run} loading={loading} label={op === 'recognize' ? 'P.recognize' : 'P.classify'} />
      <ResultPanel data={result} />
    </div>
  )
}

// ── R Tab ─────────────────────────────────────────────────────────────────────

function RTab() {
  const [op, setOp] = useState<'propagate' | 'paths'>('propagate')
  const [nodeId, setNodeId] = useState('')
  const [depth, setDepth] = useState('2')
  const [direction, setDirection] = useState('out')
  const [certainty, setCertainty] = useState('')
  const [source, setSource] = useState('')
  const [target, setTarget] = useState('')
  const [maxDepth, setMaxDepth] = useState('5')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ResultData>(null)

  async function run() {
    setLoading(true)
    try {
      const r = op === 'propagate'
        ? await prvsApi.propagate(nodeId.trim(), parseInt(depth) || 2, direction as 'out' | 'in' | 'both', certainty || undefined)
        : await prvsApi.paths(source.trim(), target.trim(), parseInt(maxDepth) || 5)
      setResult(r)
    } catch (e) {
      setResult({ error: String(e) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="p-4 rounded-lg bg-white/[0.03] border border-white/[0.08] text-sm text-white/40 leading-relaxed">
        <span className="text-blue-300 font-bold text-base">R = Relation</span>
        {'  '}因果连接：确定性(必然) · 概率性(分布) · 解释性(事后溯因)。沿 R 网络扩散或寻路。
      </div>

      <Field label="操作">
        <Select
          value={op}
          onChange={v => setOp(v as 'propagate' | 'paths')}
          options={[
            { value: 'propagate', label: 'R.propagate — 从节点沿R网络扩散' },
            { value: 'paths',     label: 'R.paths — 两节点间所有R路径' },
          ]}
        />
      </Field>

      {op === 'propagate' ? (
        <>
          <Field label="节点 ID">
            <Input value={nodeId} onChange={setNodeId} placeholder="e.g. subjectivity" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="深度">
              <Input value={depth} onChange={setDepth} placeholder="2" />
            </Field>
            <Field label="方向">
              <Select value={direction} onChange={setDirection} options={[
                { value: 'out',  label: '出边 (out)' },
                { value: 'in',   label: '入边 (in)' },
                { value: 'both', label: '双向 (both)' },
              ]} />
            </Field>
          </div>
          <Field label="确定性过滤（可选）">
            <Select value={certainty} onChange={setCertainty} options={[
              { value: '',              label: '不过滤' },
              { value: 'certain',       label: '确定性 (certain)' },
              { value: 'probable',      label: '概率性 (probable)' },
              { value: 'interpretive',  label: '解释性 (interpretive)' },
            ]} />
          </Field>
        </>
      ) : (
        <>
          <Field label="源节点 ID">
            <Input value={source} onChange={setSource} placeholder="e.g. subjectivity" />
          </Field>
          <Field label="目标节点 ID">
            <Input value={target} onChange={setTarget} placeholder="e.g. action" />
          </Field>
          <Field label="最大深度">
            <Input value={maxDepth} onChange={setMaxDepth} placeholder="5" />
          </Field>
        </>
      )}

      <RunButton onClick={run} loading={loading} label={op === 'propagate' ? 'R.propagate' : 'R.paths'} />
      <ResultPanel data={result} />
    </div>
  )
}

// ── V Tab ─────────────────────────────────────────────────────────────────────

function VTab() {
  const [op, setOp] = useState<'rank' | 'weight'>('rank')
  const [topK, setTopK] = useState('20')
  const [nodeId, setNodeId] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ResultData>(null)

  async function run() {
    setLoading(true)
    try {
      const r = op === 'rank'
        ? await prvsApi.rank(parseInt(topK) || 20)
        : await prvsApi.weight(nodeId.trim())
      setResult(r)
    } catch (e) {
      setResult({ error: String(e) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="p-4 rounded-lg bg-white/[0.03] border border-white/[0.08] text-sm text-white/40 leading-relaxed">
        <span className="text-yellow-300 font-bold text-base">V = Value</span>
        {'  '}系统权重分布。V 权重 = 中心性 + 层权重 + 状态激活加权。当前 S 会影响 V 分布。
      </div>

      <Field label="操作">
        <Select
          value={op}
          onChange={v => setOp(v as 'rank' | 'weight')}
          options={[
            { value: 'rank',   label: 'V.rank — 全图节点权重排行' },
            { value: 'weight', label: 'V.weight — 单节点权重详情' },
          ]}
        />
      </Field>

      {op === 'rank' ? (
        <Field label="Top-K">
          <Input value={topK} onChange={setTopK} placeholder="20" />
        </Field>
      ) : (
        <Field label="节点 ID">
          <Input value={nodeId} onChange={setNodeId} placeholder="e.g. subjectivity" />
        </Field>
      )}

      <RunButton onClick={run} loading={loading} label={op === 'rank' ? 'V.rank' : 'V.weight'} />
      <ResultPanel data={result} />
    </div>
  )
}

// ── S Tab ─────────────────────────────────────────────────────────────────────

function STab() {
  const [op, setOp] = useState<'current' | 'activate' | 'predict' | 'diff'>('current')
  const [nodeIds, setNodeIds] = useState('')
  const [context, setContext] = useState('')
  const [depth, setDepth] = useState('2')
  const [certainty, setCertainty] = useState('')
  const [state1, setState1] = useState('')
  const [state2, setState2] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ResultData>(null)
  const [currentStateCache, setCurrentStateCache] = useState<SState | null>(null)

  async function run() {
    setLoading(true)
    try {
      let r: ResultData = null
      if (op === 'current') {
        const s = await prvsApi.current()
        setCurrentStateCache(s)
        r = s
      } else if (op === 'activate') {
        const ids = nodeIds.split(',').map(s => s.trim()).filter(Boolean)
        r = await prvsApi.activate(ids, context.trim())
      } else if (op === 'predict') {
        r = await prvsApi.predict(parseInt(depth) || 2, certainty || undefined)
      } else if (op === 'diff') {
        let s1: { activated_nodes: string[] }
        let s2: { activated_nodes: string[] }
        try {
          s1 = JSON.parse(state1)
          s2 = JSON.parse(state2)
        } catch {
          setResult({ error: 'state1/state2 必须是有效 JSON，格式: {"activated_nodes": ["id1","id2"]}' })
          setLoading(false)
          return
        }
        r = await prvsApi.diff(s1, s2)
      }
      setResult(r)
    } catch (e) {
      setResult({ error: String(e) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="p-4 rounded-lg bg-white/[0.03] border border-white/[0.08] text-sm text-white/40 leading-relaxed">
        <span className="text-green-300 font-bold text-base">S = State</span>
        {'  '}图的当前激活模式 = 主体此刻是谁。S 影响 V 分布，驱动 R 扩散方向。
      </div>

      <Field label="操作">
        <Select
          value={op}
          onChange={v => setOp(v as 'current' | 'activate' | 'predict' | 'diff')}
          options={[
            { value: 'current',  label: 'S.snapshot — 当前激活状态' },
            { value: 'activate', label: 'S.activate — 设置激活节点集合' },
            { value: 'predict',  label: 'S.predict — 从当前S预测可达节点' },
            { value: 'diff',     label: 'S.diff — 两个S之间的差分' },
          ]}
        />
      </Field>

      {op === 'activate' && (
        <>
          <Field label="节点 ID 列表（逗号分隔）">
            <Input value={nodeIds} onChange={setNodeIds} placeholder="subjectivity, axioms, ..." />
          </Field>
          <Field label="Context（可选）">
            <Input value={context} onChange={setContext} placeholder="当前会话上下文描述" />
          </Field>
        </>
      )}

      {op === 'predict' && (
        <>
          <Field label="深度">
            <Input value={depth} onChange={setDepth} placeholder="2" />
          </Field>
          <Field label="确定性过滤（可选）">
            <Select value={certainty} onChange={setCertainty} options={[
              { value: '',             label: '不过滤' },
              { value: 'certain',      label: '确定性 (certain)' },
              { value: 'probable',     label: '概率性 (probable)' },
              { value: 'interpretive', label: '解释性 (interpretive)' },
            ]} />
          </Field>
        </>
      )}

      {op === 'diff' && (
        <>
          {currentStateCache && (
            <button
              onClick={() => setState1(JSON.stringify({ activated_nodes: currentStateCache.activated_nodes }))}
              className="text-xs text-neutral-500 hover:text-neutral-300 text-left"
            >
              ← 将当前 S 填入 state1
            </button>
          )}
          <Field label="state1 (JSON)">
            <textarea
              value={state1}
              onChange={e => setState1(e.target.value)}
              placeholder={'{"activated_nodes": ["id1","id2"]}'}
              rows={2}
              className="bg-[#111] border border-white/10 rounded-md px-3 py-2 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-violet-400/60 font-mono resize-none"
            />
          </Field>
          <Field label="state2 (JSON)">
            <textarea
              value={state2}
              onChange={e => setState2(e.target.value)}
              placeholder={'{"activated_nodes": ["id3","id4"]}'}
              rows={2}
              className="bg-[#111] border border-white/10 rounded-md px-3 py-2 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-violet-400/60 font-mono resize-none"
            />
          </Field>
        </>
      )}

      <RunButton onClick={run} loading={loading} label={`S.${op === 'current' ? 'snapshot' : op}`} />
      <ResultPanel data={result} />
    </div>
  )
}

// ── Axioms Tab ────────────────────────────────────────────────────────────────

const LEVEL_LABEL: Record<number, string> = { 1: '公理', 2: '推论', 3: '推理' }
const PRIM_COLORS: Record<string, { badge: string; dot: string; border: string }> = {
  P: { badge: 'bg-violet-500/20 text-violet-300', dot: 'bg-violet-400', border: 'border-violet-500/20' },
  R: { badge: 'bg-blue-500/20 text-blue-300',     dot: 'bg-blue-400',   border: 'border-blue-500/20' },
  V: { badge: 'bg-yellow-500/20 text-yellow-300', dot: 'bg-yellow-400', border: 'border-yellow-500/20' },
  S: { badge: 'bg-green-500/20 text-green-300',   dot: 'bg-green-400',  border: 'border-green-500/20' },
}

function makeTextBlock(text: string): Block {
  return {
    id: generateBlockId(),
    parentId: null,
    type: 'paragraph',
    position: 0,
    content: { rich_text: [{ text }] },
  }
}

function AxiomRow({
  entry,
  allEntries,
  onUpdate,
  onDelete,
}: {
  entry: AxiomEntry
  allEntries: AxiomEntry[]
  onUpdate: (id: string, patch: Partial<Pick<AxiomEntry, 'name' | 'level' | 'derivedFrom'>>) => void
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing]   = useState(false)
  const [level, setLevel]       = useState(String(entry.level))
  const [derived, setDerived]   = useState(entry.derivedFrom.join(', '))
  const [saving, setSaving]     = useState(false)

  // Build blocks for BlockEditor from name
  const [blocks, setBlocks] = useState<Block[]>(() => [makeTextBlock(entry.name)])

  const col = PRIM_COLORS[entry.primitive]
  const lvlLabel = LEVEL_LABEL[entry.level] ?? `L${entry.level}`

  async function save() {
    setSaving(true)
    const newName = blocks[0]?.content.rich_text.map(s => s.text).join('') ?? entry.name
    await onUpdate(entry.id, {
      name: newName,
      level: parseInt(level, 10),
      derivedFrom: derived.split(',').map(s => s.trim()).filter(Boolean),
    })
    setSaving(false)
    setEditing(false)
  }

  return (
    <div className={`rounded-lg border ${col.border} bg-white/[0.04]`}>
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => setExpanded(v => !v)} className="text-white/50 hover:text-white/80 transition-colors">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <span className={`text-xs px-2 py-0.5 rounded font-mono font-semibold ${col.badge}`}>{lvlLabel}</span>
        <span className="text-sm font-medium text-white flex-1 truncate">{entry.name}</span>
        {entry.derivedFrom.length > 0 && (
          <span className="text-xs text-white/40 font-mono">← {entry.derivedFrom.join(', ')}</span>
        )}
        <button onClick={() => { setEditing(v => !v); setExpanded(true) }}
          className="p-1.5 rounded text-white/40 hover:text-amber-300 transition-colors">
          <Edit2 size={13} />
        </button>
        <button onClick={() => onDelete(entry.id)}
          className="p-1.5 rounded text-white/40 hover:text-red-400 transition-colors">
          <Trash2 size={13} />
        </button>
      </div>

      {/* Expanded: BlockEditor + edit fields */}
      {expanded && (
        <div className="px-4 pb-4 flex flex-col gap-3 border-t border-white/[0.08] pt-3">
          <BlockEditor
            pageId={`prvs_axiom_${entry.id}`}
            initialBlocks={blocks}
            onChange={setBlocks}
            readOnly={!editing}
          />
          {editing && (
            <div className="flex flex-col gap-3">
              <div className="flex gap-3 items-end">
                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-xs text-white/30 uppercase tracking-widest">层级</label>
                  <select value={level} onChange={e => setLevel(e.target.value)}
                    className="bg-[#111] border border-white/10 rounded-md px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-amber-400/60">
                    <option value="1" className="bg-neutral-900">1 — 公理（最小完备集）</option>
                    <option value="2" className="bg-neutral-900">2 — 推论</option>
                    <option value="3" className="bg-neutral-900">3 — 推理</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-xs text-white/30 uppercase tracking-widest">依赖 ID（逗号分隔）</label>
                  <input value={derived} onChange={e => setDerived(e.target.value)} placeholder="p_ax_1, p_ax_2"
                    className="bg-[#111] border border-white/10 rounded-md px-3 py-2 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-amber-400/60 font-mono" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={save} disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-sm font-semibold text-white transition-colors">
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  保存
                </button>
                <button onClick={() => setEditing(false)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded bg-white/5 hover:bg-white/10 text-sm text-white/50 transition-colors">
                  <X size={13} /> 取消
                </button>
              </div>
            </div>
          )}
          {/* Upstream deps */}
          {entry.derivedFrom.length > 0 && !editing && (
            <div className="flex flex-wrap gap-1.5">
              {entry.derivedFrom.map(depId => {
                const dep = allEntries.find(e => e.id === depId)
                return dep ? (
                  <span key={depId} className={`text-xs px-2 py-0.5 rounded font-mono ${PRIM_COLORS[dep.primitive].badge}`}>
                    {dep.name}
                  </span>
                ) : (
                  <span key={depId} className="text-xs px-2 py-0.5 rounded font-mono bg-white/5 text-white/30">{depId}</span>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AddAxiomForm({
  primitive,
  onAdd,
}: {
  primitive: 'P' | 'R' | 'V' | 'S'
  onAdd: (entry: AxiomEntry) => void
}) {
  const [open, setOpen]   = useState(false)
  const [name, setName]   = useState('')
  const [level, setLevel] = useState('1')
  const [derived, setDerived] = useState('')
  const [saving, setSaving]   = useState(false)

  async function submit() {
    if (!name.trim()) return
    setSaving(true)
    const result = await prvsApi.createAxiom({
      primitive,
      level: parseInt(level, 10),
      name: name.trim(),
      derivedFrom: derived.split(',').map(s => s.trim()).filter(Boolean),
    })
    onAdd(result)
    setName(''); setLevel('1'); setDerived('')
    setSaving(false); setOpen(false)
  }

  if (!open) return (
    <button onClick={() => setOpen(true)}
      className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-amber-500/40 text-amber-300/80 hover:text-amber-200 hover:border-amber-400/70 hover:bg-amber-500/10 text-sm font-semibold transition-colors w-full justify-center">
      <Plus size={15} /> 新增条目
    </button>
  )

  return (
    <div className="flex flex-col gap-3 p-4 rounded-lg border border-amber-500/20 bg-amber-500/5">
      <input value={name} onChange={e => setName(e.target.value)} placeholder="条目名称"
        className="bg-[#111] border border-white/10 rounded-md px-3 py-2 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-amber-400/60" />
      <div className="flex gap-3">
        <select value={level} onChange={e => setLevel(e.target.value)}
          className="bg-[#111] border border-white/10 rounded-md px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-amber-400/60 flex-1">
          <option value="1" className="bg-neutral-900">1 — 公理</option>
          <option value="2" className="bg-neutral-900">2 — 推论</option>
          <option value="3" className="bg-neutral-900">3 — 推理</option>
        </select>
        <input value={derived} onChange={e => setDerived(e.target.value)} placeholder="依赖 ID（可选）"
          className="bg-[#111] border border-white/10 rounded-md px-3 py-2 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-amber-400/60 font-mono flex-1" />
      </div>
      <div className="flex gap-2">
        <button onClick={submit} disabled={saving || !name.trim()}
          className="flex items-center gap-1.5 px-4 py-2 rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-sm font-semibold text-white transition-colors">
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
          添加
        </button>
        <button onClick={() => setOpen(false)}
          className="px-4 py-2 rounded bg-white/5 hover:bg-white/10 text-sm text-white/50 transition-colors">
          取消
        </button>
      </div>
    </div>
  )
}

function AxiomsTab() {
  const [axioms, setAxioms] = useState<AxiomSets | null>(null)
  const [loading, setLoading] = useState(true)
  const [activePrim, setActivePrim] = useState<'P' | 'R' | 'V' | 'S'>('P')

  React.useEffect(() => {
    prvsApi.getAxioms().then(a => { setAxioms(a); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const allEntries = axioms ? ['P','R','V','S'].flatMap(p => axioms[p as 'P'|'R'|'V'|'S']) : []

  async function handleUpdate(id: string, patch: Partial<Pick<AxiomEntry, 'name'|'level'|'derivedFrom'>>) {
    const updated = await prvsApi.updateAxiom(id, patch)
    setAxioms(prev => {
      if (!prev) return prev
      return {
        ...prev,
        [updated.primitive]: prev[updated.primitive].map(e => e.id === id ? updated : e)
      }
    })
  }

  async function handleDelete(id: string) {
    await prvsApi.deleteAxiom(id)
    setAxioms(prev => {
      if (!prev) return prev
      const next = { ...prev }
      for (const p of ['P','R','V','S'] as const) {
        next[p] = prev[p].filter(e => e.id !== id)
      }
      return next
    })
  }

  function handleAdd(entry: AxiomEntry) {
    setAxioms(prev => {
      if (!prev) return prev
      return { ...prev, [entry.primitive]: [...prev[entry.primitive], entry] }
    })
  }

  if (loading) return <div className="flex justify-center py-8"><Loader2 size={16} className="animate-spin text-neutral-600" /></div>
  if (!axioms)  return <div className="text-sm text-red-400 p-4">加载公理集失败</div>

  const PRIMS = ['P','R','V','S'] as const

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-bold text-white/80">PRVS 公理集</h2>
        <p className="text-sm text-white/50">最小完备集（一级公理）是基础；推论与推理可由公理组合推导</p>
      </div>

      {/* Primitive tabs */}
      <div className="flex gap-2">
        {PRIMS.map(p => {
          const col = PRIM_COLORS[p]
          const count = axioms[p].length
          const isActive = activePrim === p
          return (
            <button key={p} onClick={() => setActivePrim(p)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold transition-colors ${
                isActive
                  ? `${col.badge} border-current`
                  : 'text-white/55 border-white/15 hover:text-white/80 hover:bg-white/[0.06]'
              }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isActive ? col.dot : 'bg-white/20'}`} />
              {p}
              <span className="text-xs opacity-60">{count}</span>
            </button>
          )
        })}
      </div>

      {/* Add form */}
      <AddAxiomForm key={activePrim} primitive={activePrim} onAdd={handleAdd} />

      {/* Level groups */}
      {[1, 2, 3].map(lvl => {
        const entries = axioms[activePrim].filter(e => e.level === lvl)
        if (entries.length === 0 && lvl > 1) return null
        return (
          <div key={lvl} className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-white/60 uppercase tracking-widest">
                {lvl}级 — {LEVEL_LABEL[lvl] ?? `L${lvl}`}
              </span>
              <span className="text-xs text-white/40">{entries.length} 条</span>
              {lvl > 1 && <span className="text-xs text-white/30 italic">可由上级推导</span>}
              <div className="flex-1 h-px bg-white/[0.10]" />
            </div>
            {entries.map(e => (
              <AxiomRow
                key={e.id}
                entry={e}
                allEntries={allEntries}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            ))}
            {lvl === 1 && entries.length === 0 && (
              <div className="text-sm text-white/20 px-4 py-3">尚无一级公理</div>
            )}
          </div>
        )
      })}

    </div>
  )
}

// ── Spec Tab ──────────────────────────────────────────────────────────────────

// ── Spec Tab (API-driven, editable) ──────────────────────────────────────────

const PRIM_STYLE: Record<string, { border: string; bg: string; badge: string }> = {
  P: { border: 'border-violet-500/30', bg: 'bg-violet-500/5',  badge: 'bg-violet-500/20 text-violet-400' },
  R: { border: 'border-blue-500/30',   bg: 'bg-blue-500/5',    badge: 'bg-blue-500/20 text-blue-400' },
  V: { border: 'border-yellow-500/30', bg: 'bg-yellow-500/5',  badge: 'bg-yellow-500/20 text-yellow-400' },
  S: { border: 'border-green-500/30',  bg: 'bg-green-500/5',   badge: 'bg-green-500/20 text-green-400' },
}

function SpecTab() {
  const [spec, setSpec]           = useState<import('@/lib/prvs-api').PrvsSpec | null>(null)
  const [loading, setLoading]     = useState(true)
  const [expanded, setExpanded]   = useState<Set<string>>(new Set(['boundary', 'P']))
  const [editing, setEditing]     = useState<string | null>(null)   // section key being edited
  const [editBuf, setEditBuf]     = useState('')
  const [reason, setReason]       = useState('')
  const [saving, setSaving]       = useState(false)
  const [saveErr, setSaveErr]     = useState('')

  React.useEffect(() => {
    prvsApi.getSpec().then(s => { setSpec(s); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  function toggle(id: string) {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function startEdit(key: string, value: unknown) {
    setEditing(key)
    setEditBuf(typeof value === 'string' ? value : JSON.stringify(value, null, 2))
    setReason('')
    setSaveErr('')
  }

  async function commitEdit(path: string[]) {
    if (!reason.trim()) { setSaveErr('改动规范必须填写 reason'); return }
    if (!spec) return
    setSaving(true); setSaveErr('')
    try {
      // Build nested patch from path
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      function setIn(obj: any, keys: string[], val: unknown): unknown {
        if (keys.length === 0) return val
        return { ...obj, [keys[0]]: setIn(obj[keys[0]], keys.slice(1), val) }
      }
      let parsed: unknown = editBuf
      try { parsed = JSON.parse(editBuf) } catch { /* keep as string */ }
      const patch = setIn({}, path, parsed) as Partial<import('@/lib/prvs-api').PrvsSpec> & { reason: string }
      patch.reason = reason
      const updated = await prvsApi.patchSpec(patch)
      setSpec(updated)
      setEditing(null)
    } catch (e) { setSaveErr(String(e)) }
    finally { setSaving(false) }
  }

  if (loading) return <div className="flex justify-center py-8"><Loader2 size={16} className="animate-spin text-neutral-600" /></div>
  if (!spec) return <div className="text-xs text-red-400 p-4">加载规范失败</div>

  return (
    <div className="flex flex-col gap-4">
      {/* Version strip */}
      <div className="flex items-center gap-4 px-5 py-3.5 rounded-lg bg-white/[0.03] border border-white/[0.07] text-sm">
        <span className="font-mono text-white/60 font-bold">v{spec.schema_version}</span>
        <span className="text-white/20">·</span>
        <span className="text-white/40">{spec.last_updated}</span>
        <span className="text-white/20">·</span>
        <span className="text-white/40">{Object.keys(spec.changelog).length} 次修订</span>
        <div className="ml-auto text-white/25 italic text-xs">改动规范需填 reason — 没有不能改的，只有改的程序</div>
      </div>

      {/* 边界标准 */}
      <div className="rounded-lg border border-white/[0.08] bg-white/[0.02]">
        <button onClick={() => toggle('boundary')} className="w-full flex items-center gap-3 px-5 py-4 text-left">
          <span className="text-xs font-bold font-mono px-2 py-1 rounded bg-white/10 text-white/60 uppercase tracking-wide">边界</span>
          <span className="text-base font-semibold text-white/80">PRVS 边界标准五律</span>
          <span className="ml-auto text-white/30 text-sm">{expanded.has('boundary') ? '▲' : '▼'}</span>
        </button>
        {expanded.has('boundary') && (
          <div className="px-4 pb-4 border-t border-white/[0.05] flex flex-col gap-3 pt-3">
            {([
              ['first_principles_law', '第一性原理', spec.boundary.first_principles_law ?? ''],
              ['occams_razor_law',     '奥卡姆剃刀', spec.boundary.occams_razor_law ?? ''],
              ['completeness_law',     '完备性律',   spec.boundary.completeness_law],
              ['minimality_law',       '最小性律',   spec.boundary.minimality_law],
              ['independence_law',     '独立性律',   spec.boundary.independence_law],
            ] as [string, string, string][]).map(([key, label, text]) => (
              <div key={key} className="group">
                {editing === `boundary.${key}` ? (
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-semibold text-neutral-400">{label}</span>
                    <textarea value={editBuf} onChange={e => setEditBuf(e.target.value)} rows={3}
                      className="bg-[#1a1a1a] border border-violet-500/40 rounded px-3 py-2 text-sm text-white/80 font-mono resize-none focus:outline-none" />
                    <input value={reason} onChange={e => setReason(e.target.value)} placeholder="reason（必填）"
                      className="bg-[#1a1a1a] border border-white/[0.08] rounded px-3 py-2 text-sm text-white/70 focus:outline-none focus:border-violet-500/40" />
                    {saveErr && <span className="text-xs text-red-400">{saveErr}</span>}
                    <div className="flex gap-2">
                      <button onClick={() => commitEdit(['boundary', key])} disabled={saving}
                        className="px-3 py-1.5 rounded bg-violet-600 text-white text-sm font-semibold disabled:opacity-40 hover:bg-violet-500 transition-colors">
                        {saving ? '保存中…' : '保存'}
                      </button>
                      <button onClick={() => setEditing(null)} className="px-3 py-1.5 rounded text-neutral-500 text-sm hover:text-neutral-300">取消</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <span className="shrink-0 text-xs font-semibold text-neutral-400 w-20 pt-0.5">{label}</span>
                    <span className="flex-1 text-sm text-neutral-300 leading-relaxed">{text}</span>
                    <button onClick={() => startEdit(`boundary.${key}`, text)}
                      className="shrink-0 opacity-0 group-hover:opacity-100 text-xs text-neutral-600 hover:text-neutral-300 transition-opacity ml-1">编辑</button>
                  </div>
                )}
              </div>
            ))}
            <div className="mt-2 grid grid-cols-2 gap-3">
              {(['inside_prvs', 'outside_prvs'] as const).map(k => (
                <div key={k}>
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                    {k === 'inside_prvs' ? 'PRVS 内部（实现层）' : 'PRVS 外部（使用层）'}
                  </p>
                  {spec.boundary[k].map((item, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs mb-1">
                      <span className={k === 'inside_prvs' ? 'text-green-500 mt-0.5' : 'text-neutral-500 mt-0.5'}>·</span>
                      <span className="text-neutral-400 leading-relaxed">{item}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 元操作映射 */}
      <div className="p-4 rounded bg-white/[0.02] border border-white/[0.06]">
        <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">元操作 = PRVS 组合</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          {spec.meta_operations.map(op => (
            <div key={op.name} title={op.description} className="flex items-baseline gap-2">
              <span className="text-xs font-semibold text-neutral-400 w-10 shrink-0">{op.name}</span>
              <span className="text-xs font-mono text-neutral-500">{op.formula}</span>
            </div>
          ))}
        </div>
      </div>

      {/* P/R/V/S primitives */}
      {(['P','R','V','S'] as const).map(pid => {
        const prim = spec.primitives[pid]
        const style = PRIM_STYLE[pid]
        return (
          <div key={pid} className={`rounded border ${style.border} ${style.bg}`}>
            <button onClick={() => toggle(pid)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
              <span className={`shrink-0 text-sm font-bold font-mono px-2 py-0.5 rounded ${style.badge}`}>{pid}</span>
              <span className="text-sm font-semibold text-white/80">{prim.title}</span>
              <span className="ml-auto text-neutral-500 text-xs">{expanded.has(pid) ? '▲' : '▼'}</span>
            </button>
            {expanded.has(pid) && (
              <div className="px-4 pb-4 flex flex-col gap-4 border-t border-white/[0.05]">
                {/* Axiom row with edit */}
                <div className="group flex items-start gap-3 pt-3">
                  {editing === `primitives.${pid}.axiom` ? (
                    <div className="flex-1 flex flex-col gap-2">
                      <textarea value={editBuf} onChange={e => setEditBuf(e.target.value)} rows={3}
                        className="bg-[#1a1a1a] border border-violet-500/40 rounded px-3 py-2 text-sm text-white/80 font-mono resize-none focus:outline-none" />
                      <input value={reason} onChange={e => setReason(e.target.value)} placeholder="reason（必填）"
                        className="bg-[#1a1a1a] border border-white/[0.08] rounded px-3 py-2 text-sm text-white/70 focus:outline-none focus:border-violet-500/40" />
                      {saveErr && <span className="text-xs text-red-400">{saveErr}</span>}
                      <div className="flex gap-2">
                        <button onClick={() => commitEdit(['primitives', pid, 'axiom'])} disabled={saving}
                          className="px-3 py-1.5 rounded bg-violet-600 text-white text-sm font-semibold disabled:opacity-40 hover:bg-violet-500 transition-colors">
                          {saving ? '…' : '保存'}
                        </button>
                        <button onClick={() => setEditing(null)} className="px-3 py-1.5 rounded text-neutral-500 text-sm hover:text-neutral-300">取消</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="flex-1 text-sm text-neutral-400 leading-relaxed">{prim.axiom}</p>
                      <button onClick={() => startEdit(`primitives.${pid}.axiom`, prim.axiom)}
                        className="shrink-0 opacity-0 group-hover:opacity-100 text-xs text-neutral-600 hover:text-neutral-300 transition-opacity">编辑</button>
                    </>
                  )}
                </div>
                {/* Fields */}
                <div>
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">数据结构</p>
                  <div className="rounded bg-[#0d0d0d] border border-white/[0.05] overflow-hidden">
                    {prim.fields.map((f, i) => (
                      <div key={f.name} className={`flex items-start gap-4 px-4 py-2.5 ${i > 0 ? 'border-t border-white/[0.04]' : ''}`}>
                        <span className="shrink-0 font-mono text-sm text-white/70 w-28">{f.name}</span>
                        <span className="shrink-0 font-mono text-xs text-neutral-500 w-16">{f.type}</span>
                        <span className="text-xs text-neutral-400 leading-relaxed">{f.constraint}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Operations */}
                <div className="flex flex-col gap-2.5">
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">操作接口</p>
                  {prim.operations.map(op => (
                    <div key={op.sig} className="rounded bg-[#0d0d0d] border border-white/[0.05] p-4 flex flex-col gap-2">
                      <code className="text-sm font-mono text-violet-300">{op.sig}</code>
                      <div className="grid grid-cols-[40px_1fr] gap-x-3 gap-y-1 text-xs">
                        <span className="text-neutral-500 font-semibold">入</span><span className="text-neutral-400">{op.input}</span>
                        <span className="text-neutral-500 font-semibold">出</span><span className="text-neutral-400">{op.output}</span>
                        <span className="text-neutral-500 font-semibold">约束</span><span className="text-neutral-300">{op.contract}</span>
                      </div>
                      {op.example && <p className="text-xs text-neutral-600 font-mono">{op.example}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Guardrails */}
      <div className="p-4 rounded bg-white/[0.02] border border-white/[0.06]">
        <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">接口护栏</p>
        {spec.guardrails.map(g => (
          <div key={g.rule} className="flex items-start gap-3 mb-2">
            <span className="shrink-0 text-green-500 mt-0.5 text-sm">✓</span>
            <span className="text-sm text-neutral-300 font-mono">{g.rule}</span>
            <span className="text-xs text-neutral-500 self-center">— {g.enforcement}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Tests Tab ─────────────────────────────────────────────────────────────────

const ALL_OPS = ['P.recognize','P.classify','R.propagate','R.paths','V.rank','V.weight','S.snapshot','S.activate','S.predict','S.diff']

function TestsTab() {
  const [tests, setTests]         = useState<import('@/lib/prvs-api').PrvsTestCase[]>([])
  const [loading, setLoading]     = useState(true)
  const [running, setRunning]     = useState<string | null>(null)
  const [creating, setCreating]   = useState(false)
  const [form, setForm]           = useState({ name:'', operation:'P.recognize', input:'{}', expected_notes:'', tags:'' })
  const [formErr, setFormErr]     = useState('')
  // A/B compare state
  const [compareMode, setCompareMode]   = useState(false)
  const [compareOp, setCompareOp]       = useState('P.recognize')
  const [compareA, setCompareA]         = useState('')
  const [compareB, setCompareB]         = useState('')
  const [compareResult, setCompareResult] = useState<import('@/lib/prvs-api').PrvsCompareResult | null>(null)
  const [comparing, setComparing]       = useState(false)

  React.useEffect(() => {
    prvsApi.listTests().then(t => { setTests(t); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  async function runTest(id: string) {
    setRunning(id)
    try {
      const r = await prvsApi.runTest(id)
      setTests(prev => prev.map(t => t.id === id ? { ...t, last_result: r.result, last_run_at: r.ran_at } : t))
    } catch (e) { console.error(e) }
    finally { setRunning(null) }
  }

  async function deleteTest(id: string) {
    await prvsApi.deleteTest(id)
    setTests(prev => prev.filter(t => t.id !== id))
  }

  async function createTest() {
    setFormErr('')
    if (!form.name.trim()) { setFormErr('name 必填'); return }
    let inputParsed: Record<string,unknown>
    try { inputParsed = JSON.parse(form.input) } catch { setFormErr('input 必须是有效 JSON'); return }
    const tc = await prvsApi.createTest({
      name: form.name, operation: form.operation, input: inputParsed,
      expected_notes: form.expected_notes,
      tags: form.tags.split(',').map(s => s.trim()).filter(Boolean),
    })
    setTests(prev => [...prev, tc])
    setCreating(false)
    setForm({ name:'', operation:'P.recognize', input:'{}', expected_notes:'', tags:'' })
  }

  async function runCompare() {
    setComparing(true)
    try {
      let a: Record<string,unknown>, b: Record<string,unknown>
      try { a = JSON.parse(compareA); b = JSON.parse(compareB) }
      catch { setCompareResult(null); setComparing(false); return }
      const r = await prvsApi.compareTests(compareOp, a, b, 'A', 'B')
      setCompareResult(r)
    } catch (e) { console.error(e) }
    finally { setComparing(false) }
  }

  if (loading) return <div className="flex justify-center py-8"><Loader2 size={16} className="animate-spin text-neutral-600" /></div>

  return (
    <div className="flex flex-col gap-3">
      {/* Header bar */}
      <div className="flex items-center gap-2">
        <button onClick={() => { setCreating(true); setCompareMode(false) }}
          className="flex items-center gap-1.5 px-3 py-2 rounded bg-white/[0.06] border border-white/[0.10] text-neutral-300 text-sm font-medium hover:text-white hover:border-white/20 transition-colors">
          + 新增测试
        </button>
        <button onClick={() => { setCompareMode(c => !c); setCreating(false) }}
          className={`flex items-center gap-1.5 px-3 py-2 rounded border text-sm font-medium transition-colors ${compareMode ? 'bg-blue-500/20 border-blue-500/40 text-blue-400' : 'bg-white/[0.05] border-white/[0.08] text-neutral-400 hover:text-white'}`}>
          A/B 对比
        </button>
        <span className="ml-auto text-xs text-neutral-500">{tests.length} 个测试案例</span>
      </div>

      {/* Create form */}
      {creating && (
        <div className="p-4 rounded bg-white/[0.03] border border-white/[0.08] flex flex-col gap-3">
          <p className="text-sm font-semibold text-neutral-300">新建测试案例</p>
          <Field label="名称">
            <Input value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="描述这个测试要验证什么" />
          </Field>
          <Field label="操作">
            <Select value={form.operation} onChange={v => setForm(f => ({ ...f, operation: v }))}
              options={ALL_OPS.map(o => ({ value: o, label: o }))} />
          </Field>
          <Field label="输入参数 (JSON)">
            <textarea value={form.input} onChange={e => setForm(f => ({ ...f, input: e.target.value }))} rows={3}
              className="bg-[#1a1a1a] border border-white/[0.08] rounded px-2 py-1.5 text-xs text-white/80 font-mono resize-none focus:outline-none focus:border-violet-500/40" />
          </Field>
          <Field label="预期描述（非严格断言）">
            <Input value={form.expected_notes} onChange={v => setForm(f => ({ ...f, expected_notes: v }))} placeholder="期望看到什么？" />
          </Field>
          <Field label="标签（逗号分隔）">
            <Input value={form.tags} onChange={v => setForm(f => ({ ...f, tags: v }))} placeholder="smoke, P, ..." />
          </Field>
          {formErr && <span className="text-xs text-red-400">{formErr}</span>}
          <div className="flex gap-2 mt-1">
            <RunButton onClick={createTest} loading={false} label="创建" />
            <button onClick={() => setCreating(false)} className="text-sm text-neutral-500 hover:text-neutral-300 px-3">取消</button>
          </div>
        </div>
      )}

      {/* A/B Compare panel */}
      {compareMode && (
        <div className="p-4 rounded bg-blue-500/5 border border-blue-500/20 flex flex-col gap-3">
          <p className="text-sm font-semibold text-blue-400">A/B 对比 — 同一操作，两组输入</p>
          <Field label="操作">
            <Select value={compareOp} onChange={setCompareOp} options={ALL_OPS.map(o => ({ value: o, label: o }))} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="输入 A (JSON)">
              <textarea value={compareA} onChange={e => setCompareA(e.target.value)} rows={3} placeholder="{}"
                className="bg-[#1a1a1a] border border-white/[0.08] rounded px-2 py-1.5 text-xs text-white/80 font-mono resize-none focus:outline-none focus:border-blue-500/40" />
            </Field>
            <Field label="输入 B (JSON)">
              <textarea value={compareB} onChange={e => setCompareB(e.target.value)} rows={3} placeholder="{}"
                className="bg-[#1a1a1a] border border-white/[0.08] rounded px-2 py-1.5 text-xs text-white/80 font-mono resize-none focus:outline-none focus:border-blue-500/40" />
            </Field>
          </div>
          <RunButton onClick={runCompare} loading={comparing} label="对比运行" />
          {compareResult && (
            <div className="grid grid-cols-2 gap-3 mt-1">
              {(['result_a','result_b'] as const).map((k, i) => (
                <div key={k} className="rounded bg-[#0d0d0d] border border-white/[0.05] overflow-hidden">
                  <div className="px-3 py-2 border-b border-white/[0.05] text-xs font-semibold text-neutral-400">{i === 0 ? 'A' : 'B'}</div>
                  <pre className="px-3 py-2 text-xs text-neutral-400 font-mono overflow-auto max-h-48 whitespace-pre-wrap">
                    {JSON.stringify(compareResult[k], null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Test list */}
      {tests.length === 0 && !creating && (
        <div className="text-center py-10 text-neutral-500 text-sm">暂无测试案例，点击「新增测试」创建</div>
      )}
      {tests.map(tc => (
        <div key={tc.id} className="rounded border border-white/[0.07] bg-white/[0.02]">
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="font-mono text-xs text-neutral-400 bg-white/[0.05] px-2 py-1 rounded shrink-0">{tc.operation}</span>
            <span className="text-sm text-white/80 flex-1 truncate font-medium">{tc.name}</span>
            <div className="flex items-center gap-2 shrink-0">
              {tc.last_run_at && (
                <span className="text-xs text-neutral-500">{new Date(tc.last_run_at).toLocaleTimeString()}</span>
              )}
              <button onClick={() => runTest(tc.id)} disabled={running === tc.id}
                className="px-3 py-1.5 rounded bg-violet-500/20 border border-violet-500/30 text-violet-300 text-xs font-semibold hover:bg-violet-500/30 disabled:opacity-40 transition-colors flex items-center gap-1.5">
                {running === tc.id ? <Loader2 size={11} className="animate-spin" /> : '▶'}
                运行
              </button>
              <button onClick={() => deleteTest(tc.id)}
                className="px-2 py-1.5 rounded text-neutral-600 hover:text-red-400 text-sm transition-colors">✕</button>
            </div>
          </div>
          {tc.expected_notes && (
            <div className="px-4 pb-2 text-xs text-neutral-500 italic">{tc.expected_notes}</div>
          )}
          {tc.tags.length > 0 && (
            <div className="px-4 pb-3 flex gap-1.5">
              {tc.tags.map(tag => <span key={tag} className="text-xs px-2 py-0.5 rounded bg-white/[0.05] text-neutral-500">{tag}</span>)}
            </div>
          )}
          {tc.last_result != null && (
            <details className="px-4 pb-3">
              <summary className="text-xs text-neutral-500 cursor-pointer hover:text-neutral-300">上次运行结果</summary>
              <pre className="mt-2 px-3 py-2 rounded bg-[#0d0d0d] text-xs text-neutral-400 font-mono overflow-auto max-h-48 whitespace-pre-wrap">
                {JSON.stringify(tc.last_result as object, null, 2)}
              </pre>
            </details>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

type TabMeta = { id: Tab; label: string; labelFull: string; activeColor: string; activeBg: string; dot: string }
const TAB_META: TabMeta[] = [
  { id: 'axioms', label: '公理集',  labelFull: '最小完备集', activeColor: 'text-amber-300',   activeBg: 'bg-amber-500/15',    dot: 'bg-amber-400' },
  { id: 'spec',  label: '规范',     labelFull: '接口规范',  activeColor: 'text-white',        activeBg: 'bg-white/10',        dot: 'bg-white/40' },
  { id: 'tests', label: '测试',     labelFull: '测试运行',  activeColor: 'text-orange-300',   activeBg: 'bg-orange-500/15',   dot: 'bg-orange-400' },
  { id: 'P',     label: 'P',        labelFull: 'Pattern',   activeColor: 'text-violet-300',   activeBg: 'bg-violet-500/15',   dot: 'bg-violet-400' },
  { id: 'R',     label: 'R',        labelFull: 'Relation',  activeColor: 'text-blue-300',     activeBg: 'bg-blue-500/15',     dot: 'bg-blue-400' },
  { id: 'V',     label: 'V',        labelFull: 'Value',     activeColor: 'text-yellow-300',   activeBg: 'bg-yellow-500/15',   dot: 'bg-yellow-400' },
  { id: 'S',     label: 'S',        labelFull: 'State',     activeColor: 'text-green-300',    activeBg: 'bg-green-500/15',    dot: 'bg-green-400' },
]

export default function PRVSPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('spec')

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">

      {/* ── Tab bar ── */}
      <div className="shrink-0 flex items-stretch border-b border-white/[0.07] bg-[#0c0c0c]">
        {TAB_META.map(t => {
          const isActive = activeTab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`
                relative flex flex-col justify-center items-center gap-0.5
                px-6 transition-colors duration-150
                ${isActive ? t.activeBg : 'hover:bg-white/[0.03]'}
              `}
              style={{ minHeight: '52px', minWidth: t.id === 'spec' || t.id === 'tests' ? '88px' : '72px' }}
            >
              {isActive && (
                <span className={`absolute top-0 left-0 right-0 h-[2px] ${t.dot}`} />
              )}
              <span className={`text-sm font-semibold ${isActive ? t.activeColor : 'text-white/30'}`}>
                {t.label}
              </span>
              <span className={`text-[10px] ${isActive ? 'text-white/30' : 'text-white/15'}`}>
                {t.labelFull}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto px-8 pt-6 pb-8">
        {activeTab === 'axioms' && <AxiomsTab />}
        {activeTab === 'spec'  && <SpecTab />}
        {activeTab === 'tests' && <TestsTab />}
        {activeTab === 'P' && <PTab />}
        {activeTab === 'R' && <RTab />}
        {activeTab === 'V' && <VTab />}
        {activeTab === 'S' && <STab />}
      </div>
    </div>
  )
}
