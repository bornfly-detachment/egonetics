/**
 * CompilerPanel — PRVSE Compiler interactive frontend
 *
 * Input: human language + origin context + optional resource info
 * Process: Scanner → Binder → Checker → Emitter (client-side, zero latency)
 * Output: L0/L1/L2 progressive display of compilation stages + results
 *
 * Design: OLED cinema dark, matches ResourcePanel / WorldSpherePanel
 */

import { useState, useCallback, useMemo } from 'react'
import {
  Play,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Zap,
  Layers,
  Eye,
  FileCode,
} from 'lucide-react'
import { compile } from '@/kernel/compiler'
import type {
  CompileResult,
  PatternToken,
  ConstitutionViolation,
  EvolutionEvent,
  POrigin,
  PInternalOriginType,
  PExternalOriginType,
  PermissionTier,
  InfoLevel,
} from '@/kernel/compiler'

// ── Origin Options ────────────────────────────────────────────────

const INTERNAL_ORIGINS: { value: PInternalOriginType; label: string }[] = [
  { value: 'user_input', label: '人类输入' },
  { value: 'model_call', label: 'AI 推理' },
  { value: 'module_output', label: '模块输出' },
  { value: 'system_event', label: '系统事件' },
  { value: 'process_memory', label: '过程记忆' },
]

const EXTERNAL_ORIGINS: { value: PExternalOriginType; label: string }[] = [
  { value: 'computable', label: '可计算 (代码/API/DB)' },
  { value: 'verifiable', label: '可验证 (论文/实验)' },
  { value: 'narrative', label: '叙事 (社交/AI生成)' },
  { value: 'sensor', label: '传感器 (物理信号)' },
]

const PERMISSION_TIERS: { value: PermissionTier; label: string }[] = [
  { value: 'T0', label: 'T0 执行' },
  { value: 'T1', label: 'T1 推理' },
  { value: 'T2', label: 'T2 进化' },
  { value: 'T3', label: 'T3 生变论' },
]

const INFO_LEVELS: { value: InfoLevel; label: string }[] = [
  { value: 'L0_signal', label: 'L0 信号' },
  { value: 'L1_objective_law', label: 'L1 客观规律' },
  { value: 'L2_subjective', label: 'L2 主观认知' },
]

// ── Severity badge ────────────────────────────────────────────────

const SEVERITY_CONFIG = {
  block: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', label: 'BLOCK', Icon: XCircle },
  downgrade: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: 'DOWNGRADE', Icon: AlertTriangle },
  warn: { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', label: 'WARN', Icon: AlertTriangle },
} as const

// ── Collapsible Section ───────────────────────────────────────────

function Section({
  title,
  icon: Icon,
  color,
  count,
  defaultOpen,
  children,
}: {
  title: string
  icon: typeof Layers
  color: string
  count?: number
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  return (
    <div className="mb-2 rounded-xl overflow-hidden" style={{ background: `${color}08`, border: `1px solid ${color}18` }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/[0.02] transition-all"
      >
        <span className="text-white/25 shrink-0">
          {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </span>
        <Icon size={12} style={{ color }} />
        <span className="text-[11px] font-mono font-semibold" style={{ color }}>
          {title}
        </span>
        {count !== undefined && (
          <span className="text-[9px] font-mono text-white/20 ml-auto">{count}</span>
        )}
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  )
}

// ── Token Display ─────────────────────────────────────────────────

function TokenCard({ token }: { token: PatternToken }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className="mb-1.5 rounded-lg overflow-hidden"
      style={{ background: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.12)' }}
    >
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-white/[0.02]"
      >
        <span className="text-white/20 shrink-0">
          {expanded ? <ChevronDown size={9} /> : <ChevronRight size={9} />}
        </span>
        <span className="text-[10px] font-mono text-white/50 truncate flex-1">
          {token.rawContent.slice(0, 60)}{token.rawContent.length > 60 ? '...' : ''}
        </span>
        <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-white/30">
          {token.state}
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-2.5 space-y-1.5">
          <Field label="ID" value={token.id} />
          <Field label="Origin" value={`${token.origin.domain}:${token.origin.type}`} />
          <Field label="State" value={token.state} />
          <Field
            label="Physical"
            value={token.physical.resolved ? token.physical.value as string : 'unresolved'}
          />
          <Field
            label="Level"
            value={token.level.resolved ? token.level.value as string : 'unresolved'}
          />
          <Field
            label="Communication"
            value={token.communication.resolved ? token.communication.value as string : 'unresolved'}
          />
        </div>
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] font-mono text-white/25 w-20 shrink-0">{label}</span>
      <span className="text-[9px] font-mono text-white/55">{value}</span>
    </div>
  )
}

// ── Violation Display ─────────────────────────────────────────────

function ViolationCard({ violation }: { violation: ConstitutionViolation }) {
  const cfg = SEVERITY_CONFIG[violation.severity]
  const Icon = cfg.Icon

  return (
    <div
      className="flex items-start gap-2 px-2.5 py-2 rounded-lg mb-1.5"
      style={{ background: cfg.bg, border: `1px solid ${cfg.color}25` }}
    >
      <Icon size={12} className="shrink-0 mt-0.5" style={{ color: cfg.color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono font-bold" style={{ color: cfg.color }}>
            {cfg.label}
          </span>
          <span className="text-[9px] font-mono text-white/30">
            {violation.ruleId}
          </span>
        </div>
        <div className="text-[10px] font-mono text-white/50 mt-0.5">
          {violation.message}
        </div>
      </div>
    </div>
  )
}

// ── Evolution Event Display ───────────────────────────────────────

function EventCard({ event }: { event: EvolutionEvent }) {
  return (
    <div
      className="px-2.5 py-2 rounded-lg mb-1.5"
      style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.12)' }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[9px] font-mono text-purple-400/60">{event.mutationType}</span>
        <span className="text-[8px] font-mono text-white/20">{event.id}</span>
        <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-white/[0.05] text-white/25 ml-auto">
          {event.actor} → {event.executor}
        </span>
      </div>
      {event.diff && (
        <div className="text-[9px] font-mono text-white/35">
          {event.diff.before === null ? '+' : '~'} {typeof event.diff.after === 'string' ? event.diff.after.slice(0, 80) : JSON.stringify(event.diff.after).slice(0, 80)}
        </div>
      )}
    </div>
  )
}

// ── Select Component ──────────────────────────────────────────────

function Select<T extends string>({
  value,
  options,
  onChange,
  color,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  color: string
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value as T)}
      className="text-[10px] font-mono rounded-lg px-2 py-1.5 outline-none cursor-pointer"
      style={{
        background: `${color}10`,
        color: `${color}cc`,
        border: `1px solid ${color}25`,
      }}
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value} style={{ background: '#0a0a0f', color: '#ccc' }}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}

// ── Main Component ────────────────────────────────────────────────

interface CompilerPanelProps {
  sphereColor?: string
}

export default function CompilerPanel({ sphereColor = '#94a3b8' }: CompilerPanelProps) {
  // Input state
  const [content, setContent] = useState('')
  const [domain, setDomain] = useState<'internal' | 'external'>('internal')
  const [internalType, setInternalType] = useState<PInternalOriginType>('user_input')
  const [externalType, setExternalType] = useState<PExternalOriginType>('computable')
  const [actor, setActor] = useState<PermissionTier>('T1')
  const [infoLevel, setInfoLevel] = useState<InfoLevel>('L1_objective_law')

  // Result state
  const [result, setResult] = useState<CompileResult | null>(null)
  const [compileTime, setCompileTime] = useState<number>(0)

  const origin = useMemo<POrigin>(() => {
    if (domain === 'internal') return { domain: 'internal', type: internalType }
    return { domain: 'external', type: externalType }
  }, [domain, internalType, externalType])

  const handleCompile = useCallback(() => {
    if (!content.trim()) return

    const t0 = performance.now()
    const res = compile({
      inputs: [{ content: content.trim(), origin }],
      actor,
      infoLevel,
    })
    const t1 = performance.now()

    setResult(res)
    setCompileTime(Math.round((t1 - t0) * 100) / 100)
  }, [content, origin, actor, infoLevel])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3.5 py-2.5 shrink-0"
        style={{ borderBottom: `1px solid ${sphereColor}15` }}
      >
        <FileCode size={12} style={{ color: sphereColor }} />
        <span className="text-[11px] font-mono font-semibold" style={{ color: `${sphereColor}cc` }}>
          PRVSE Compiler
        </span>
        <span className="text-[9px] font-mono text-white/20 ml-auto">
          Scanner → Binder → Checker → Emitter
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 min-h-0 space-y-3">
        {/* ── Input Area ── */}
        <div
          className="rounded-xl p-3"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          {/* Text input */}
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && e.metaKey) { e.preventDefault(); handleCompile() }
            }}
            placeholder="输入人话 / 代码 / 结构化数据 / 外部资源信息...  (⌘+Enter 编译)"
            rows={3}
            className="w-full bg-transparent text-[11px] font-mono text-white/65 resize-none outline-none
              placeholder:text-white/20 leading-relaxed mb-3"
          />

          {/* Origin selector */}
          <div className="flex flex-wrap items-center gap-2 mb-2.5">
            <span className="text-[9px] font-mono text-white/25 w-10">来源</span>
            <div className="flex gap-1">
              {(['internal', 'external'] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setDomain(d)}
                  className="text-[9px] font-mono px-2 py-1 rounded-lg transition-all"
                  style={domain === d
                    ? { background: `${sphereColor}18`, color: `${sphereColor}cc`, border: `1px solid ${sphereColor}35` }
                    : { background: 'transparent', color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.08)' }
                  }
                >
                  {d === 'internal' ? '内部' : '外部'}
                </button>
              ))}
            </div>
            {domain === 'internal' ? (
              <Select value={internalType} options={INTERNAL_ORIGINS} onChange={setInternalType} color={sphereColor} />
            ) : (
              <Select value={externalType} options={EXTERNAL_ORIGINS} onChange={setExternalType} color={sphereColor} />
            )}
          </div>

          {/* Actor + InfoLevel */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-[9px] font-mono text-white/25 w-10">权限</span>
            <Select value={actor} options={PERMISSION_TIERS} onChange={setActor} color="#a78bfa" />
            <span className="text-[9px] font-mono text-white/25 ml-2">信息</span>
            <Select value={infoLevel} options={INFO_LEVELS} onChange={setInfoLevel} color="#7dd3fc" />
          </div>

          {/* Compile button */}
          <button
            onClick={handleCompile}
            disabled={!content.trim()}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[11px] font-mono font-semibold transition-all disabled:opacity-25"
            style={{
              background: `${sphereColor}18`,
              color: `${sphereColor}cc`,
              border: `1px solid ${sphereColor}30`,
            }}
          >
            <Play size={12} />
            编译 (⌘+Enter)
          </button>
        </div>

        {/* ── Result Area ── */}
        {result && (
          <div className="space-y-2">
            {/* Status bar */}
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{
                background: result.success ? 'rgba(74,222,128,0.08)' : 'rgba(239,68,68,0.08)',
                border: `1px solid ${result.success ? 'rgba(74,222,128,0.2)' : 'rgba(239,68,68,0.2)'}`,
              }}
            >
              {result.success
                ? <CheckCircle size={13} className="text-green-400/70" />
                : <XCircle size={13} className="text-red-400/70" />
              }
              <span className="text-[11px] font-mono" style={{ color: result.success ? '#4ade80cc' : '#f87171cc' }}>
                {result.success ? '编译通过' : '编译被阻止'}
              </span>
              <span className="text-[9px] font-mono text-white/20 ml-auto">
                {compileTime}ms
              </span>
            </div>

            {/* Violations */}
            {result.violations.length > 0 && (
              <Section
                title="违规"
                icon={AlertTriangle}
                color="#f59e0b"
                count={result.violations.length}
                defaultOpen
              >
                {result.violations.map((v, i) => (
                  <ViolationCard key={i} violation={v} />
                ))}
              </Section>
            )}

            {/* High-IR: Tokens */}
            <Section
              title="High-IR (Scanner 输出)"
              icon={Eye}
              color="#94a3b8"
              count={1}
              defaultOpen
            >
              <TokenCard token={result.highIR} />
            </Section>

            {/* Mid-IR: Binder output */}
            <Section
              title="Mid-IR (Binder 输出)"
              icon={Layers}
              color="#7dd3fc"
              count={result.midIR.tokens.length}
            >
              <div className="space-y-1">
                <Field label="Tokens" value={String(result.midIR.tokens.length)} />
                <Field label="Edges" value={String(result.midIR.edges.length)} />
                <Field label="Gates" value={String(result.midIR.gates.length)} />
                <Field label="Bindings" value={String(result.midIR.bindings.length)} />
              </div>
              <div className="mt-2">
                {result.midIR.tokens.map(t => (
                  <TokenCard key={t.id} token={t} />
                ))}
              </div>
            </Section>

            {/* Low-IR: Checker output */}
            <Section
              title="Low-IR (Checker 输出)"
              icon={Zap}
              color="#a78bfa"
            >
              <div className="space-y-1">
                <Field label="Permission" value={result.lowIR.permissionLevel} />
                <Field label="Instructions" value={String(result.lowIR.instructions.length)} />
                <Field label="Violations" value={String(result.lowIR.violations.length)} />
              </div>
            </Section>

            {/* Events: Emitter output */}
            {result.events.length > 0 && (
              <Section
                title="Events (Emitter 输出)"
                icon={Zap}
                color="#c084fc"
                count={result.events.length}
              >
                {result.events.map((ev, i) => (
                  <EventCard key={i} event={ev} />
                ))}
              </Section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
