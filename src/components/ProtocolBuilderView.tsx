/**
 * ProtocolBuilderView — 控制论构建器
 *
 * 逐级构建流程：
 *   Step1: 人写规则 → AI 编译 → Machine Lang
 *   Step2: 准备测试用例
 *   Step3: 执行测试
 *   Step4: 失败则迭代反馈 → 回到 Step1，直到测试通过
 *   保存: Graph + Machine Lang + JSON + Schema
 *
 * Route: /protocol/builder
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Plus, Play, Upload, ChevronRight, Cpu, BarChart2, Eye, Wrench,
  Tag, BookOpen, X, Check, AlertCircle, Loader2, Trash2,
  Sparkles, FileJson, GitBranch, FlaskConical,
} from 'lucide-react'
import { ControlGraph, type NodeStatus } from '@/design/components/ControlGraph'
import TagTreeView from './TagTreeView'
import { getToken } from '@/lib/http'

// ── Types ──────────────────────────────────────────────────────────────────
type KernelComp  = 'controller' | 'evaluator' | 'perceiver'
type BuildStatus = 'draft' | 'building' | 'testing' | 'passed' | 'failed'

interface ProtocolRule {
  id:            string
  kernel_comp:   KernelComp
  title:         string
  human_char:    string
  machine_lang:  string
  tag_ids:       string[]
  build_status:  BuildStatus
  test_env:      TestEnv
  test_results:  StepResult[]
  ai_feedback:   string
  ai_suggestion: string
  build_version: number
  model:         string
  created_at:    string
}

interface StepResult {
  step:    string
  status:  'passed' | 'failed'
  message: string
  detail:  string
}

interface TestCase {
  id:       string
  name:     string
  input:    string
  expected: string
}

interface TestEnv {
  cases: TestCase[]
}

type ConstitutionTree = Record<string, ProtocolRule[]>

// ── Constants ──────────────────────────────────────────────────────────────
const KERNEL_COMPS: { id: KernelComp; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'controller', label: '控制器', icon: <Wrench size={12} />,   color: '#6366f1' },
  { id: 'evaluator',  label: '测评器', icon: <BarChart2 size={12} />, color: '#f59e0b' },
  { id: 'perceiver',  label: '感知器', icon: <Eye size={12} />,       color: '#34d399' },
]

const MODELS = ['minimax', 'claude-sonnet-4-6', 'gpt-4o']

const STATUS_CFG: Record<BuildStatus, { label: string; color: string; bg: string }> = {
  draft:    { label: 'Draft',    color: '#94a3b8', bg: '#94a3b812' },
  building: { label: 'Building', color: '#fbbf24', bg: '#fbbf2412' },
  testing:  { label: 'Testing',  color: '#60a5fa', bg: '#60a5fa12' },
  passed:   { label: 'Passed',   color: '#34d399', bg: '#34d39912' },
  failed:   { label: 'Failed',   color: '#f87171', bg: '#f8717112' },
}

const SCHEMA_TEMPLATE: Record<KernelComp, string> = {
  controller: `{
  "observe": "...",      // 感知条件
  "condition": "...",   // 触发条件
  "decide": "...",      // 决策逻辑
  "actuate": "..."      // 执行动作
}`,
  evaluator: `{
  "metrics": [...],       // 评价指标列表
  "threshold": 0.6,      // 阈值
  "reward_fn": "...",    // 奖励函数
  "penalty_fn": "..."    // 惩罚函数
}`,
  perceiver: `{
  "input_type": "...",   // 输入类型
  "filter": "...",       // 过滤条件
  "process": "...",       // 处理逻辑
  "output_type": "..."   // 输出类型
}`,
}

// ── API ────────────────────────────────────────────────────────────────────
function authH(): Record<string, string> {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }
}

async function apiFetchRules(comp: KernelComp): Promise<ProtocolRule[]> {
  const res = await fetch(`/api/protocol-rules?kernel_comp=${comp}`, { headers: authH() })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function apiCreate(body: { kernel_comp: KernelComp; title: string; model: string }): Promise<ProtocolRule> {
  const res = await fetch('/api/protocol-rules', { method: 'POST', headers: authH(), body: JSON.stringify(body) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function apiPatch(id: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`/api/protocol-rules/${id}`, { method: 'PATCH', headers: authH(), body: JSON.stringify(body) })
  if (!res.ok) throw new Error(await res.text())
}

async function apiDelete(id: string): Promise<void> {
  const res = await fetch(`/api/protocol-rules/${id}`, { method: 'DELETE', headers: authH() })
  if (!res.ok) throw new Error(await res.text())
}

async function apiPublish(id: string): Promise<void> {
  const res = await fetch(`/api/protocol-rules/${id}/publish`, { method: 'POST', headers: authH() })
  if (!res.ok) throw new Error(await res.text())
}

async function apiSuggest(id: string): Promise<{ ok: boolean; ai_suggestion: string }> {
  const res = await fetch(`/api/protocol-rules/${id}/suggest`, { method: 'POST', headers: authH() })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function apiFetchTree(): Promise<ConstitutionTree> {
  const res = await fetch('/api/protocol-rules/constitution-tree', { headers: authH() })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

function genId(): string {
  return `tc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function parseTestEnv(raw: string | TestEnv): TestEnv {
  if (typeof raw === 'object') return raw
  try { return JSON.parse(raw || '{"cases":[]}') } catch { return { cases: [] } }
}

// ── Sub-components ─────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: BuildStatus }) {
  const c = STATUS_CFG[status]
  return (
    <span
      className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider"
      style={{ color: c.color, background: c.bg }}
    >
      {c.label}
    </span>
  )
}

function KernelTabs({ active, onChange }: { active: KernelComp; onChange: (k: KernelComp) => void }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {KERNEL_COMPS.map(k => (
        <button
          key={k.id}
          onClick={() => onChange(k.id)}
          className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-mono font-medium transition-all"
          style={
            active === k.id
              ? { background: k.color + '1a', color: k.color, border: `1px solid ${k.color}35` }
              : { background: 'transparent', color: '#ffffff35', border: '1px solid transparent' }
          }
        >
          {k.icon} {k.label}
        </button>
      ))}
    </div>
  )
}

// ── Test Case Editor ───────────────────────────────────────────────────────
function TestCaseItem({
  testCase,
  onUpdate,
  onDelete,
}: {
  testCase: TestCase
  onUpdate: (tc: TestCase) => void
  onDelete: () => void
}) {
  return (
    <div
      className="rounded-lg p-3 space-y-2"
      style={{ background: '#ffffff06', border: '1px solid #ffffff0e' }}
    >
      <div className="flex items-center gap-2">
        <input
          value={testCase.name}
          onChange={e => onUpdate({ ...testCase, name: e.target.value })}
          placeholder="用例名称..."
          className="flex-1 px-2 py-1 rounded text-[11px] font-mono text-white/65 bg-transparent outline-none placeholder:text-white/20"
        />
        <button onClick={onDelete} className="text-white/25 hover:text-red-400 transition-colors">
          <Trash2 size={11} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-[9px] font-mono text-white/25 uppercase tracking-widest mb-1">输入</div>
          <textarea
            value={testCase.input}
            onChange={e => onUpdate({ ...testCase, input: e.target.value })}
            rows={2}
            placeholder='{"topic": "AI对齐"}'
            className="w-full px-2 py-1.5 rounded text-[11px] font-mono text-white/55 bg-black/20 outline-none resize-none placeholder:text-white/15"
          />
        </div>
        <div>
          <div className="text-[9px] font-mono text-white/25 uppercase tracking-widest mb-1">期望输出</div>
          <textarea
            value={testCase.expected}
            onChange={e => onUpdate({ ...testCase, expected: e.target.value })}
            rows={2}
            placeholder='{"score": 0.9, "pass": true}'
            className="w-full px-2 py-1.5 rounded text-[11px] font-mono text-white/55 bg-black/20 outline-none resize-none placeholder:text-white/15"
          />
        </div>
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function ProtocolBuilderView() {
  // ── State ────────────────────────────────────────────────────────────
  const [activeComp, setActiveComp]     = useState<KernelComp>('controller')
  const [rules, setRules]               = useState<ProtocolRule[]>([])
  const [selected, setSelected]         = useState<ProtocolRule | null>(null)
  const [isCreating, setIsCreating]     = useState(false)
  const [newTitle, setNewTitle]         = useState('')
  const [humanChar, setHumanChar]       = useState('')
  const [editModel, setEditModel]       = useState('minimax')
  const [saving, setSaving]             = useState(false)

  // Center panel
  const [nodeStates, setNodeStates]     = useState<Record<string, NodeStatus>>({})
  const [buildLog, setBuildLog]         = useState<StepResult[]>([])
  const [building, setBuilding]         = useState(false)
  const [machineLang, setMachineLang]   = useState('')
  const [ruleTab, setRuleTab]         = useState<'ml_lang' | 'ml_schema' | 'ml_graph'>('ml_lang')
  const abortRef                        = useRef<AbortController | null>(null)
  const logEndRef                       = useRef<HTMLDivElement>(null)

  // AI diff
  const [aiSuggestion, setAiSuggestion] = useState('')
  const [showDiff, setShowDiff]         = useState(false)
  const [suggesting, setSuggesting]     = useState(false)
  const [aiFeedback, setAiFeedback]     = useState('')

  // Test cases
  const [testCases, setTestCases]       = useState<TestCase[]>([])

  // Right panel
  const [rightTab, setRightTab]         = useState<'tree' | 'tags' | 'step' | 'diff'>('step')
  const [constTree, setConstTree]       = useState<ConstitutionTree>({})

  // ── Data loaders ──────────────────────────────────────────────────────
  const loadRules = useCallback(async (comp: KernelComp = activeComp) => {
    try {
      const data = await apiFetchRules(comp)
      setRules(data)
      return data
    } catch { return [] }
  }, [activeComp])

  const loadTree = useCallback(async () => {
    try { setConstTree(await apiFetchTree()) } catch { /* ignore */ }
  }, [])

  useEffect(() => { loadRules() }, [loadRules])
  useEffect(() => { loadTree() }, [loadTree])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [buildLog])

  // ── Rule selection ────────────────────────────────────────────────────
  const selectRule = useCallback((rule: ProtocolRule) => {
    setSelected(rule)
    setHumanChar(rule.human_char)
    setEditModel(rule.model)
    setMachineLang(rule.machine_lang)
    setBuildLog(rule.test_results ?? [])
    setAiSuggestion(rule.ai_suggestion ?? '')
    setAiFeedback(rule.ai_feedback ?? '')
    setShowDiff(!!rule.ai_suggestion)
    const te = parseTestEnv(rule.test_env ?? '{"cases":[]}')
    setTestCases(te.cases ?? [])
    const ns: Record<string, NodeStatus> = {}
    for (const r of rule.test_results ?? []) {
      ns[r.step] = r.status === 'passed' ? 'passed' : 'failed'
    }
    setNodeStates(ns)
  }, [])

  const switchComp = (comp: KernelComp) => {
    setActiveComp(comp)
    setSelected(null)
    setNodeStates({})
    setBuildLog([])
    setMachineLang('')
    setShowDiff(false)
    setAiSuggestion('')
    setTestCases([])
  }

  // ── Save ─────────────────────────────────────────────────────────────
  const saveRule = useCallback(async (opts?: { machine_lang?: string }) => {
    if (!selected) return
    setSaving(true)
    try {
      await apiPatch(selected.id, {
        human_char: humanChar,
        model: editModel,
        machine_lang: opts?.machine_lang ?? machineLang,
        test_env: JSON.stringify({ cases: testCases }),
      })
      setSelected(prev => prev ? { ...prev, human_char: humanChar, model: editModel } : null)
    } finally { setSaving(false) }
  }, [selected, humanChar, editModel, machineLang, testCases])

  // ── Build ────────────────────────────────────────────────────────────
  const handleBuild = async () => {
    if (!selected || building) return
    await saveRule()
    setBuilding(true)
    setNodeStates({})
    setBuildLog([])
    setMachineLang('')
    abortRef.current = new AbortController()
    try {
      const res = await fetch(`/api/protocol-rules/${selected.id}/build`, {
        method: 'POST',
        headers: authH(),
        signal: abortRef.current.signal,
      })
      if (!res.ok || !res.body) throw new Error('Build failed')
      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer    = ''
      let cur = selected
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6)) as Record<string, unknown>
            if (event.type === 'step_start') {
              setNodeStates(prev => ({ ...prev, [event.step as string]: 'running' }))
            } else if (event.type === 'step_done') {
              const step   = event.step as string
              const status = event.status as 'passed' | 'failed'
              setNodeStates(prev => ({ ...prev, [step]: status }))
              setBuildLog(prev => [...prev, { step, status, message: (event.message as string) ?? '', detail: (event.detail as string) ?? '' }])
            } else if (event.type === 'done') {
              const overall = event.overall as BuildStatus
              const next = { ...cur, build_status: overall }
              setSelected(next)
              setRules(prev => prev.map(r => r.id === next.id ? next : r))
              if (event.results) {
                setBuildLog(event.results as StepResult[])
              }
              cur = next
            }
          } catch { /* skip */ }
        }
      }
    } catch (e: unknown) {
      if (!(e instanceof Error && e.name === 'AbortError')) console.error(e)
    } finally {
      setBuilding(false)
      const fresh = await loadRules()
      const updated = fresh.find(r => r.id === selected.id)
      if (updated) {
        setSelected(updated)
        if (updated.machine_lang) setMachineLang(updated.machine_lang)
      }
      await loadTree()
    }
  }

  // ── AI Suggest ─────────────────────────────────────────────────────
  const handleSuggest = async () => {
    if (!selected || suggesting) return
    setSuggesting(true)
    try {
      const data = await apiSuggest(selected.id)
      setAiSuggestion(data.ai_suggestion)
      setShowDiff(true)
      const fresh = await loadRules()
      const updated = fresh.find(r => r.id === selected.id)
      if (updated) {
        setSelected(updated)
        setAiFeedback(updated.ai_feedback ?? '')
      }
    } catch (e) { console.error(e) } finally {
      setSuggesting(false)
    }
  }

  const handleAdoptAi = () => {
    if (!aiSuggestion) return
    setHumanChar(aiSuggestion)
    setAiSuggestion('')
    setShowDiff(false)
    saveRule()
  }

  const handleDismissDiff = () => {
    setShowDiff(false)
    setAiSuggestion('')
  }

  // ── Publish ─────────────────────────────────────────────────────────
  const handlePublish = async () => {
    if (!selected) return
    try {
      await apiPublish(selected.id)
      const updated = { ...selected, build_status: 'passed' as BuildStatus }
      setSelected(updated)
      setRules(prev => prev.map(r => r.id === updated.id ? updated : r))
      await loadTree()
    } catch (e) { console.error(e) }
  }

  // ── Create / Delete ────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!newTitle.trim()) return
    try {
      const r = await apiCreate({ kernel_comp: activeComp, title: newTitle.trim(), model: editModel })
      setRules(prev => [r, ...prev])
      selectRule(r)
      setIsCreating(false)
      setNewTitle('')
    } catch (e) { console.error(e) }
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await apiDelete(id)
      setRules(prev => prev.filter(r => r.id !== id))
      if (selected?.id === id) { setSelected(null); setNodeStates({}); setBuildLog([]); setMachineLang('') }
    } catch (e) { console.error(e) }
  }

  // ── Test case helpers ────────────────────────────────────────────────
  const addTestCase = () => {
    setTestCases(prev => [...prev, { id: genId(), name: `边界测试 ${prev.length + 1}`, input: '', expected: '' }])
  }

  const updateTestCase = (updated: TestCase) => {
    setTestCases(prev => prev.map(tc => tc.id === updated.id ? updated : tc))
  }

  const deleteTestCase = (id: string) => {
    setTestCases(prev => prev.filter(tc => tc.id !== id))
  }

  // ── Helpers ──────────────────────────────────────────────────────────
  const activeKernelInfo = KERNEL_COMPS.find(k => k.id === activeComp)!

  const failedSteps = buildLog.filter(l => l.status === 'failed')
  const buildFailed = selected?.build_status === 'failed'
  const buildPassed = selected?.build_status === 'testing'

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div className="flex overflow-hidden -m-6" style={{ background: '#090c12', height: 'calc(100vh - 48px)' }}>

      {/* ═══ LEFT SIDEBAR ═══════════════════════════════════════════════ */}
      <div className="flex flex-col w-52 shrink-0 border-r overflow-hidden" style={{ borderColor: '#ffffff08', background: '#0a0d14' }}>
        {/* Header */}
        <div className="shrink-0 flex items-center gap-2 px-3 h-10 border-b" style={{ borderColor: '#ffffff08' }}>
          <Cpu size={12} className="text-indigo-400" />
          <span className="text-[11px] font-semibold text-white/60 font-mono tracking-widest uppercase">Proto</span>
        </div>

        {/* Kernel tabs */}
        <div className="shrink-0 px-3 py-2.5 border-b" style={{ borderColor: '#ffffff08' }}>
          <KernelTabs active={activeComp} onChange={switchComp} />
        </div>

        {/* Rules list */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
          {rules.map(rule => (
            <div
              key={rule.id}
              onClick={() => selectRule(rule)}
              className="group flex items-start gap-1.5 px-2 py-2 rounded-lg cursor-pointer transition-all"
              style={{
                background: selected?.id === rule.id ? activeKernelInfo.color + '10' : 'transparent',
                border: `1px solid ${selected?.id === rule.id ? activeKernelInfo.color + '20' : 'transparent'}`,
              }}
            >
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-medium text-white/55 truncate leading-tight">{rule.title}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <StatusBadge status={rule.build_status as BuildStatus} />
                  {rule.build_version > 0 && <span className="text-[9px] font-mono text-white/18">v{rule.build_version}</span>}
                </div>
              </div>
              <button onClick={e => handleDelete(rule.id, e)} className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 transition-all mt-0.5">
                <Trash2 size={9} />
              </button>
            </div>
          ))}
          {rules.length === 0 && (
            <div className="text-center py-8 text-[10px] text-white/18 font-mono">暂无规则</div>
          )}
        </div>

        {/* New rule */}
        <div className="shrink-0 px-2 pb-2 pt-1 border-t" style={{ borderColor: '#ffffff08' }}>
          {isCreating ? (
            <div className="space-y-1.5">
              <input autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setIsCreating(false); setNewTitle('') } }}
                placeholder="规则标题..." className="w-full px-2.5 py-1.5 rounded text-[11px] font-mono text-white/65 bg-white/5 outline-none placeholder:text-white/20"
                style={{ border: '1px solid #ffffff15' }} />
              <div className="flex gap-1.5">
                <button onClick={handleCreate} className="flex-1 py-1.5 rounded text-[11px] font-mono text-emerald-400 hover:bg-emerald-400/10 transition-colors"
                  style={{ border: '1px solid #34d39930' }}>创建</button>
                <button onClick={() => { setIsCreating(false); setNewTitle('') }} className="px-2.5 py-1.5 rounded text-white/25 hover:text-white/50 transition-colors"
                  style={{ border: '1px solid #ffffff10' }}><X size={11} /></button>
              </div>
            </div>
          ) : (
            <button onClick={() => setIsCreating(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-mono text-white/30 hover:text-white/55 transition-all hover:bg-white/4"
              style={{ border: '1px dashed #ffffff10' }}>
              <Plus size={10} /> 新建规则
            </button>
          )}
        </div>
      </div>

      {/* ═══ CENTER — Main Editor (vertical scroll) ══════════════════════ */}
      <div className="flex-1 overflow-y-auto min-w-0" style={{ background: '#090c12' }}>
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 opacity-25">
            <ControlGraph nodeStates={{}} className="w-40 h-32" />
            <span className="text-[12px] font-mono text-white/35">← 选择或新建规则</span>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-6 py-5 space-y-5">

            {/* ══ LAYER 1: 生成层 — 人输入 → AI 生成 ══════════════════════ */}
            <section>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-mono text-indigo-400/70 uppercase tracking-widest">生成层</span>
                <span className="text-[9px] font-mono text-white/20">自然语言 → Machine Lang</span>
                <div className="flex-1 h-px" style={{ background: '#ffffff08' }} />
                <select value={editModel} onChange={e => setEditModel(e.target.value)}
                  className="text-[10px] font-mono text-white/35 bg-transparent outline-none cursor-pointer">
                  {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <span className="ml-auto"><StatusBadge status={selected.build_status as BuildStatus} /></span>
              </div>
              <textarea
                value={humanChar}
                onChange={e => setHumanChar(e.target.value)}
                rows={5}
                placeholder={
                  activeComp === 'controller'
                    ? '当 [感知输入] 满足 [条件] 时，执行 [动作]...\n例如：当主题得分 > 0.8 且情绪为正面时，执行奖励函数，返回 +1'
                    : activeComp === 'evaluator'
                    ? '当 [输入] 满足 [条件] 时，reward_fn 返回 [值]...\n例如：当评分指标得分 > 0.7 时，返回 reward=1.0，否则返回 reward=-0.5'
                    : '感知 [输入类型]，过滤 [条件]，输出 [结果]...\n例如：感知文本输入，过滤长度<10的噪音，输出清洗后的文本'
                }
                className="w-full rounded-xl p-4 text-[12px] font-mono text-white/60 leading-relaxed resize-none outline-none placeholder:text-white/15"
                style={{ background: '#ffffff05', border: '1px solid #ffffff0c', minHeight: 120 }}
              />
              <div className="flex items-center gap-2 mt-2">
                <button onClick={handleBuild} disabled={building || !humanChar.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-mono font-medium transition-all disabled:opacity-40"
                  style={{ background: '#6366f120', border: '1px solid #6366f135', color: '#818cf8' }}>
                  {building ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                  {building ? 'AI 生成中...' : 'AI 生成'}
                </button>
                <button onClick={() => saveRule()} disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-mono transition-all disabled:opacity-40"
                  style={{ background: '#ffffff06', border: '1px solid #ffffff10', color: '#ffffff35' }}>
                  {saving ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />} 保存
                </button>
                {buildPassed && (
                  <button onClick={handlePublish}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-mono transition-all"
                    style={{ background: '#34d39912', border: '1px solid #34d39930', color: '#34d399' }}>
                    <Upload size={10} /> 发布
                  </button>
                )}
                {buildFailed && (
                  <button onClick={handleSuggest} disabled={suggesting}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-mono font-medium transition-all disabled:opacity-40"
                    style={{ background: '#f59e0b12', border: '1px solid #f59e0b30', color: '#fbbf24' }}>
                    {suggesting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    {suggesting ? 'AI修正中...' : 'AI 修正'}
                  </button>
                )}
              </div>
            </section>

            {/* ── Section 2: AI Diff indicator ─────────────────────────── */}
            {showDiff && (
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={11} className="text-yellow-400" />
                  <span className="text-[10px] font-mono text-yellow-400/70 uppercase tracking-widest">AI 迭代反馈</span>
                  {aiFeedback && <span className="text-[9px] font-mono text-white/20 ml-1">— {aiFeedback}</span>}
                  <div className="flex-1 h-px" style={{ background: '#ffffff08' }} />
                  <button onClick={() => setRightTab('diff')}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono transition-colors"
                    style={{ background: '#f59e0b12', border: '1px solid #f59e0b25', color: '#fbbf24' }}>
                    <Sparkles size={8} />查看AI修正
                  </button>
                </div>
              </section>
            )}

            {/* ── Section 3: Build Log ─────────────────────────────────── */}
            {(buildLog.length > 0 || building) && (
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest">执行日志</span>
                  {building && <Loader2 size={10} className="text-yellow-400 animate-spin" />}
                  <div className="flex-1 h-px" style={{ background: '#ffffff08' }} />
                  {failedSteps.length > 0 && (
                    <span className="text-[9px] font-mono text-red-400/60">{failedSteps.length} 步失败</span>
                  )}
                </div>
                <div className="space-y-1.5">
                  {buildLog.map((entry, i) => (
                    <div key={i} className="flex items-start gap-2.5 px-3 py-2 rounded-lg" style={{ background: entry.status === 'passed' ? '#34d39908' : '#f8717108' }}>
                      {entry.status === 'passed'
                        ? <Check size={11} className="text-emerald-400 shrink-0 mt-0.5" />
                        : <AlertCircle size={11} className="text-red-400 shrink-0 mt-0.5" />
                      }
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-mono text-white/50 leading-snug">{entry.message}</div>
                        {entry.detail && <div className="text-[10px] font-mono text-white/22 mt-0.5 leading-snug">{entry.detail}</div>}
                      </div>
                      <span className="text-[9px] font-mono text-white/18 shrink-0">{entry.step}</span>
                    </div>
                  ))}
                  <div ref={logEndRef} />
                </div>
              </section>
            )}

            {/* ══ LAYER 2: 裁决层 — Machine Lang / Schema / Graph ══════ */}
            {machineLang && (
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-mono text-emerald-400/70 uppercase tracking-widest">裁决层</span>
                  <span className="text-[9px] font-mono text-white/20">确定性标准 · 可编辑</span>
                  <div className="flex-1 h-px" style={{ background: '#ffffff08' }} />
                  {/* Tab bar */}
                  <div className="flex gap-1">
                    {([
                      { id: 'ml_lang' as const, label: 'Machine Lang', icon: <FileJson size={9} /> },
                      { id: 'ml_schema' as const, label: 'Schema',     icon: <GitBranch size={9} /> },
                      { id: 'ml_graph' as const, label: 'Graph',      icon: <GitBranch size={9} /> },
                    ] as const).map(tab => (
                      <button key={tab.id} onClick={() => setRuleTab(tab.id)}
                        className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono transition-all"
                        style={ruleTab === tab.id
                          ? { background: '#34d39912', color: '#34d399', border: '1px solid #34d39930' }
                          : { background: 'transparent', color: '#ffffff25', border: '1px solid #ffffff08' }
                        }>
                        {tab.icon} {tab.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #ffffff0e' }}>
                  {ruleTab === 'ml_lang' && (
                    <div>
                      <textarea
                        value={machineLang}
                        onChange={e => setMachineLang(e.target.value)}
                        rows={10}
                        className="w-full p-4 text-[11px] font-mono leading-relaxed resize-none outline-none"
                        style={{ background: '#02080d', color: '#34d39980', minHeight: 200 }}
                      />
                      <div className="flex items-center gap-2 px-4 py-2" style={{ borderTop: '1px solid #ffffff08' }}>
                        <button onClick={() => saveRule({ machine_lang: machineLang })} disabled={saving}
                          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono transition-all disabled:opacity-40"
                          style={{ background: '#34d39910', border: '1px solid #34d39925', color: '#34d399' }}>
                          {saving ? <Loader2 size={9} className="animate-spin" /> : <Check size={9} />} 保存裁决
                        </button>
                        <span className="text-[9px] font-mono text-white/20 ml-auto">
                          {(() => {
                            try { const p = JSON.parse(machineLang); return Object.keys(p).length + ' 字段' } catch { return 'JSON 无效' }
                          })()}
                        </span>
                      </div>
                    </div>
                  )}
                  {ruleTab === 'ml_schema' && (
                    <div className="p-4 space-y-3">
                      <div className="text-[10px] font-mono text-emerald-400/50 uppercase tracking-widest mb-2">Schema 裁决标准</div>
                      <pre className="text-[11px] font-mono leading-relaxed"
                        style={{ background: '#02080d', color: '#60a5fa70' }}>
                        {SCHEMA_TEMPLATE[activeComp]}
                      </pre>
                      <div className="space-y-1.5 mt-3">
                        {(activeComp === 'controller'
                          ? [{ k: 'observe', d: '感知输入' }, { k: 'condition', d: '触发条件' }, { k: 'decide', d: '决策逻辑' }, { k: 'actuate', d: '执行动作' }]
                          : activeComp === 'evaluator'
                          ? [{ k: 'metrics', d: '评价指标' }, { k: 'threshold', d: '阈值 0-1' }, { k: 'reward_fn', d: '奖励函数' }, { k: 'penalty_fn', d: '惩罚函数' }]
                          : [{ k: 'input_type', d: '输入类型' }, { k: 'filter', d: '过滤条件' }, { k: 'process', d: '处理逻辑' }, { k: 'output_type', d: '输出类型' }]
                        ).map(f => {
                          let filled = false
                          try { const p = JSON.parse(machineLang); filled = !!(p[f.k] && String(p[f.k]).trim()) } catch { filled = false }
                          return (
                            <div key={f.k} className="flex items-center gap-2 text-[11px]">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: filled ? '#34d399' : '#f87171' }} />
                              <span className="font-mono text-indigo-400/70 w-24 shrink-0">{f.k}</span>
                              <span className="text-white/30">{f.d}</span>
                              {filled && <span className="ml-auto text-[9px] font-mono text-emerald-400/50">已裁决</span>}
                              {!filled && <span className="ml-auto text-[9px] font-mono text-red-400/50">待裁决</span>}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {ruleTab === 'ml_graph' && (
                    <div className="p-6 flex justify-center" style={{ background: '#02080d' }}>
                      <ControlGraph nodeStates={nodeStates} className="w-full max-w-lg" />
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* ── Section 5: Test Cases ─────────────────────────────────── */}
            <section>
              <div className="flex items-center gap-2 mb-2">
                <FlaskConical size={11} className="text-white/30" />
                <span className="text-[10px] font-mono text-amber-400/70 uppercase tracking-widest">验证层</span>
                <span className="text-[9px] font-mono text-white/20">外部约束 · 边界测试 · 逐用例执行</span>
                <div className="flex-1 h-px" style={{ background: '#ffffff08' }} />
                <button onClick={addTestCase}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono text-white/30 hover:text-white/60 transition-colors"
                  style={{ border: '1px dashed #ffffff15' }}>
                  <Plus size={9} /> 添加边界用例
                </button>
              </div>
              {testCases.length === 0 ? (
                <div className="rounded-xl flex flex-col items-center justify-center py-10 text-center"
                  style={{ background: '#ffffff04', border: '1px dashed #ffffff0e' }}>
                  <FlaskConical size={24} className="text-white/15 mb-2" />
                  <p className="text-[11px] font-mono text-white/25">点击「添加边界用例」创建测试用例</p>
                  <p className="text-[10px] font-mono text-white/15 mt-1">必须覆盖正常、边界、异常情况</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {testCases.map(tc => (
                    <TestCaseItem
                      key={tc.id}
                      testCase={tc}
                      onUpdate={updateTestCase}
                      onDelete={() => deleteTestCase(tc.id)}
                    />
                  ))}
                </div>
              )}
            </section>

          </div>
        )}
      </div>

      {/* ═══ RIGHT SIDEBAR ════════════════════════════════════════════════ */}
      <div className="flex flex-col w-72 shrink-0 border-l overflow-hidden" style={{ borderColor: '#ffffff08', background: '#0a0d14' }}>
        {/* Tabs */}
        <div className="shrink-0 flex border-b" style={{ borderColor: '#ffffff08' }}>
          {([
            { id: 'step' as const,  label: '步骤',  icon: <GitBranch size={10} /> },
            { id: 'diff' as const,  label: 'AI迭代', icon: <Sparkles size={10} /> },
            { id: 'tree' as const,  label: '语义树', icon: <BookOpen size={10} /> },
            { id: 'tags' as const,  label: '标签',   icon: <Tag size={10} /> },
          ] as const).map(tab => (
            <button key={tab.id} onClick={() => setRightTab(tab.id)}
              className="flex-1 flex items-center justify-center gap-1 py-2.5 text-[10px] font-mono transition-all"
              style={rightTab === tab.id
                ? { color: '#818cf8', borderBottom: '2px solid #6366f1', background: '#6366f108' }
                : { color: '#ffffff25', borderBottom: '2px solid transparent' }
              }>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {rightTab === 'diff' && (
          <div className="flex-1 overflow-y-auto p-3">
            {aiFeedback && (
              <div className="mb-3 px-2 py-1.5 rounded-lg text-[9px] font-mono" style={{ background: '#f8717110', color: '#f87171', border: '1px solid #f8717120' }}>
                {aiFeedback}
              </div>
            )}
            {showDiff && aiSuggestion ? (
              <div className="space-y-3">
                {/* Human version */}
                <div className="rounded-xl overflow-hidden" style={{ background: '#0e1420', border: '1px solid #6366f115' }}>
                  <div className="flex items-center gap-1.5 px-3 py-2" style={{ background: '#6366f10a', borderBottom: '1px solid #6366f15' }}>
                    <span className="text-[9px] font-mono text-indigo-400/70 uppercase tracking-widest">人</span>
                    <span className="text-[9px] font-mono text-white/20">V0 · 原始版本</span>
                  </div>
                  <div className="p-3">
                    <p className="text-[11px] font-mono text-white/55 leading-relaxed whitespace-pre-wrap">{humanChar || '(空)'}</p>
                  </div>
                  <div className="px-3 py-2" style={{ borderTop: '1px solid #ffffff08' }}>
                    <button onClick={handleDismissDiff}
                      className="w-full py-1.5 rounded-lg text-[10px] font-mono text-white/30 hover:text-white/50 transition-colors"
                      style={{ border: '1px solid #ffffff10' }}>保留自己的</button>
                  </div>
                </div>
                {/* AI version */}
                <div className="rounded-xl overflow-hidden" style={{ background: '#0e1420', border: '1px solid #f59e0b15' }}>
                  <div className="flex items-center gap-1.5 px-3 py-2" style={{ background: '#f59e0b0a', borderBottom: '1px solid #f59e0b15' }}>
                    <Sparkles size={9} className="text-yellow-400" />
                    <span className="text-[9px] font-mono text-yellow-400/80 uppercase tracking-widest">AI</span>
                    <span className="text-[9px] font-mono text-white/20">修正版</span>
                  </div>
                  <div className="p-3">
                    <p className="text-[11px] font-mono text-white/55 leading-relaxed whitespace-pre-wrap">{aiSuggestion}</p>
                  </div>
                  <div className="px-3 py-2" style={{ borderTop: '1px solid #ffffff08' }}>
                    <button onClick={handleAdoptAi}
                      className="w-full py-1.5 rounded-lg text-[10px] font-mono font-medium transition-all"
                      style={{ background: '#f59e0b15', border: '1px solid #f59e0b30', color: '#fbbf24' }}>
                      采纳 AI 版本
                    </button>
                  </div>
                </div>
                <div className="text-[9px] font-mono text-white/18 text-center pt-1">
                  选择一项：采纳 AI 版本，或保留自己的手动修改再执行
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-40 text-center">
                <Sparkles size={20} className="text-white/10 mb-2" />
                <div className="text-[10px] font-mono text-white/25">构建失败时</div>
                <div className="text-[10px] font-mono text-white/25">AI 修正将显示在此</div>
              </div>
            )}
          </div>
        )}

        {rightTab === 'step' && (
          <div className="flex-1 overflow-y-auto p-3">
            <div className="space-y-1">
              {[
                { n: 1, label: '构建',      desc: '自然语言 → Machine Lang', color: '#6366f1' },
                { n: 2, label: '测试用例',  desc: '准备边界测试条件',         color: '#f59e0b' },
                { n: 3, label: '执行测试',   desc: '逐用例验证规则',           color: '#34d399' },
                { n: 4, label: '发布',       desc: '测试通过后发布到语义树',   color: '#60a5fa' },
              ].map(step => (
                <div key={step.n} className="flex items-start gap-2.5 px-2 py-2 rounded-lg" style={{ background: '#ffffff04' }}>
                  <div className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-mono font-bold"
                    style={{ background: step.color + '20', color: step.color }}>
                    S{step.n}
                  </div>
                  <div>
                    <div className="text-[11px] font-medium text-white/55">{step.label}</div>
                    <div className="text-[9px] font-mono text-white/22 mt-0.5 leading-snug">{step.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Control graph mini */}
            {selected && (
              <div className="mt-4">
                <div className="text-[9px] font-mono text-white/20 uppercase tracking-widest mb-2">控制论图</div>
                <div className="flex justify-center">
                  <ControlGraph nodeStates={nodeStates} className="w-full" />
                </div>
              </div>
            )}
          </div>
        )}

        {rightTab === 'tree' && (
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {KERNEL_COMPS.map(kc => {
              const items = (constTree[kc.id] ?? []) as ProtocolRule[]
              return (
                <div key={kc.id}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider" style={{ color: kc.color }}>{kc.label}</span>
                    <span className="text-[9px] font-mono text-white/20">({items.length})</span>
                  </div>
                  {items.length === 0
                    ? <div className="text-[10px] font-mono text-white/15 px-2">暂无已发布规则</div>
                    : <div className="space-y-0.5">
                        {items.map(r => (
                          <div key={r.id} onClick={() => { switchComp(kc.id as KernelComp); selectRule(r) }}
                            className="flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer hover:bg-white/5 transition-colors">
                            <ChevronRight size={8} style={{ color: kc.color, opacity: 0.5 }} />
                            <span className="text-[11px] text-white/45 flex-1 truncate">{r.title}</span>
                            <span className="text-[9px] font-mono text-white/18 shrink-0">v{r.build_version}</span>
                          </div>
                        ))}
                      </div>
                  }
                </div>
              )
            })}
          </div>
        )}

        {rightTab === 'tags' && (
          <div className="flex-1 overflow-y-auto">
            <TagTreeView />
          </div>
        )}
      </div>

    </div>
  )
}
