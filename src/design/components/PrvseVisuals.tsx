/**
 * PrvseVisuals — PRVSE Protocol 交互组件渲染器
 *
 * 按层逐步实现：P → R → V → S → E
 * 设计规范：Dark Cinema OLED · Lucide SVG · Inter · 4/8dp spacing · 44px touch
 * 数据来源：prvse-compiler-design.md (single source of truth)
 */
import { useState } from 'react'
import {
  AlertTriangle, FlaskConical, ShieldCheck, ArrowRight,
  Type, Hash, Code2, Table2, ImageIcon, Volume2, Film, Activity, Layers,
  ArrowUp, ArrowDown, ArrowLeftRight,
  Atom, GitBranch, Dna,
  // R layer icons
  Zap, Clock, TrendingUp, RefreshCw, Link, Sparkles,
  BookOpen, Route, Fingerprint, Lightbulb, Swords, Merge,
  // V layer icons
  Target, Crosshair, Focus, Gauge, Timer, Coins, BarChart2, CheckCircle,
  ClipboardCheck, Puzzle, AlertOctagon, FileCheck,
  Cpu, HardDrive, ListOrdered, Crown, Scale,
  TrendingDown, Octagon,
  Expand, Eye, EyeOff, Wand2,
  // S layer icons
  Hammer, Play, Wrench, Bug, Pause, Search, FileText, Package, Archive,
  Rocket, BookMarked, Shield, XCircle, Trophy,
  ListChecks, HeartPulse, Compass,
  // E layer icons
  Radio, MessageSquare, ShieldAlert, HelpCircle, Ban, Lock,
  GraduationCap, Settings2, User, Globe,
  Repeat, Database,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { SliderWidget } from '@/design/components/SliderWidget'

// ── 共用工具 ─────────────────────────────────────────────────────────

const ICON_MAP: Record<string, LucideIcon> = {
  AlertTriangle, FlaskConical, ShieldCheck,
  Type, Hash, Code2, Table2, Image: ImageIcon, Volume2, Film, Activity, Layers,
  ArrowUp, ArrowDown, ArrowLeftRight,
  Atom, GitBranch, Dna,
  // R layer
  Zap, Clock, TrendingUp, RefreshCw, Link, Sparkles,
  BookOpen, Route, Fingerprint, Lightbulb, Swords, Merge,
  // V layer
  Target, Crosshair, Focus, Gauge, Timer, Coins, BarChart2, CheckCircle,
  ClipboardCheck, Puzzle, AlertOctagon, FileCheck,
  Cpu, HardDrive, ListOrdered, Crown, Scale,
  TrendingDown, Octagon,
  Expand, Eye, EyeOff, Wand2,
  OctagonX: Octagon,
  // S layer
  Hammer, Play, Wrench, Bug, Pause, Search, FileText, Package, Archive,
  Rocket, BookMarked, Shield, XCircle, Trophy,
  ListChecks, HeartPulse, Compass,
}

function Icon({ name, size = 14, className, style }: {
  name: string; size?: number; className?: string; style?: React.CSSProperties
}) {
  const Comp = ICON_MAP[name]
  if (!Comp) return <span className={className} style={{ ...style, fontSize: size * 0.7 }}>{name}</span>
  return <Comp size={size} className={className} style={style} />
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[8px] text-white/25 uppercase tracking-widest mb-1.5 font-medium">
      {children}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
//  P — Pattern 感知层
// ══════════════════════════════════════════════════════════════════════

// ── P: state-flow — 三态转换 ─────────────────────────────────────────
interface PState { id: string; label: string; color: string; icon: string; desc: string }
interface PTransition { from: string; to: string; guard: string }

export function StateFlowVisual({ vis }: { vis: Record<string, unknown> }) {
  const states = (vis.states as PState[]) ?? []
  const transitions = (vis.transitions as PTransition[]) ?? []
  const [active, setActive] = useState(states[0]?.id ?? '')

  const activeState = states.find(s => s.id === active)
  const outgoing = transitions.filter(t => t.from === active)

  return (
    <div className="space-y-3">
      <SectionLabel>Pattern 三态转换</SectionLabel>

      {/* State flow: 3 nodes + arrows */}
      <div className="flex items-center gap-1.5">
        {states.map((s, i) => (
          <div key={s.id} className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActive(s.id)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-200 cursor-pointer min-h-[44px]"
              style={{
                background: active === s.id ? s.color + '18' : s.color + '08',
                borderColor: active === s.id ? s.color + '70' : s.color + '25',
                boxShadow: active === s.id ? `0 0 12px ${s.color}20` : 'none',
              }}
            >
              <Icon name={s.icon} size={16} style={{ color: s.color }} />
              <div>
                <div className="text-[11px] font-semibold" style={{ color: active === s.id ? s.color : s.color + '90' }}>
                  {s.label}
                </div>
                <div className="text-[9px] text-white/30 leading-tight mt-0.5 max-w-[120px]">{s.desc}</div>
              </div>
            </button>
            {i < states.length - 1 && (
              <ArrowRight size={14} className="shrink-0" style={{ color: '#ffffff20' }} />
            )}
          </div>
        ))}
      </div>

      {/* Active state transitions */}
      {activeState && outgoing.length > 0 && (
        <div className="pl-2 border-l-2 space-y-1" style={{ borderColor: activeState.color + '30' }}>
          {outgoing.map(t => {
            const target = states.find(s => s.id === t.to)
            return (
              <div key={`${t.from}-${t.to}`} className="flex items-center gap-2 text-[10px]">
                <span style={{ color: activeState.color + 'aa' }}>{activeState.label}</span>
                <ArrowRight size={10} style={{ color: '#ffffff25' }} />
                <span style={{ color: target?.color ?? '#ffffff80' }}>{target?.label ?? t.to}</span>
                <span className="px-1.5 py-0.5 rounded text-[8px] font-mono border"
                  style={{ color: '#fcd34daa', borderColor: '#f59e0b25', background: '#f59e0b08' }}>
                  {t.guard}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── P: source-chain — 溯源链 ─────────────────────────────────────────
export function SourceChainVisual({ vis }: { vis: Record<string, unknown> }) {
  const internal = (vis.internal_sources as string[]) ?? []
  const external = (vis.external_sources as string[]) ?? []

  return (
    <div className="space-y-3">
      <SectionLabel>Pattern 溯源链</SectionLabel>

      {/* Internal sources — naturally legitimate */}
      <div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#34d399' }} />
          <span className="text-[9px] font-medium" style={{ color: '#34d399' }}>内部源 — 天然合法</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {internal.map(s => (
            <span key={s} className="px-2 py-1 rounded-md text-[10px] border min-h-[32px] flex items-center"
              style={{ color: '#34d399cc', borderColor: '#34d39930', background: '#34d39908' }}>
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* External sources — need cybernetic filtering */}
      <div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#f59e0b' }} />
          <span className="text-[9px] font-medium" style={{ color: '#f59e0b' }}>外部源 — 需控制论过滤</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {external.map(s => (
            <span key={s} className="px-2 py-1 rounded-md text-[10px] border min-h-[32px] flex items-center"
              style={{ color: '#f59e0bcc', borderColor: '#f59e0b30', background: '#f59e0b08' }}>
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* Chain principle */}
      <div className="text-[9px] text-white/25 border-t border-white/[0.06] pt-2">
        溯源 = 链式结构，必须追溯到源头原点
      </div>
    </div>
  )
}

// ── P: tier-cards — 三级形态 ─────────────────────────────────────────
interface PTier { id: string; label: string; color: string; icon: string; desc: string }

export function TierCardsVisual({ vis }: { vis: Record<string, unknown> }) {
  const tiers = (vis.tiers as PTier[]) ?? []

  return (
    <div className="space-y-3">
      <SectionLabel>Pattern 三级形态</SectionLabel>

      <div className="grid grid-cols-3 gap-2">
        {tiers.map(t => (
          <div key={t.id}
            className="rounded-lg p-3 border relative overflow-hidden"
            style={{ background: t.color + '0a', borderColor: t.color + '30' }}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <Icon name={t.icon} size={14} style={{ color: t.color }} />
              <div className="text-[11px] font-bold" style={{ color: t.color }}>{t.id}</div>
            </div>
            <div className="text-[11px] font-semibold text-white/70 mb-1">{t.label}</div>
            <div className="text-[9px] text-white/35 leading-relaxed">{t.desc}</div>
          </div>
        ))}
      </div>

      <div className="text-[9px] text-white/25 border-t border-white/[0.06] pt-2">
        层级 ≠ 权力。能力至上，L1 可自发涌现为 L2 候选
      </div>
    </div>
  )
}

// ── P: chip-selector — 物理载体选择器 ─────────────────────────────────
interface PChipOption { id: string; label: string; icon: string }

export function ChipSelectorVisual({ vis }: { vis: Record<string, unknown> }) {
  const options = (vis.options as PChipOption[]) ?? []
  const [selected, setSelected] = useState<string | null>(null)

  const P_COLOR = '#f59e0b'

  return (
    <div className="space-y-3">
      <SectionLabel>Pattern 物理载体</SectionLabel>

      <div className="flex flex-wrap gap-2">
        {options.map(o => {
          const isActive = selected === o.id
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => setSelected(isActive ? null : o.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border transition-all duration-200 cursor-pointer min-h-[44px]"
              style={{
                background: isActive ? P_COLOR + '18' : P_COLOR + '06',
                borderColor: isActive ? P_COLOR + '60' : P_COLOR + '20',
              }}
            >
              <Icon name={o.icon} size={14} style={{ color: isActive ? P_COLOR : P_COLOR + '60' }} />
              <span className="text-[10px] font-medium"
                style={{ color: isActive ? P_COLOR : P_COLOR + '80' }}>
                {o.label}
              </span>
            </button>
          )
        })}
      </div>

      <div className="text-[9px] text-white/25">
        L0 层纯规则判断，不需要语义理解
      </div>
    </div>
  )
}

// ── P: comm-direction-cards — 通信方向 ────────────────────────────────
interface PDirection { id: string; label: string; color: string; icon: string; desc: string }

export function CommDirectionVisual({ vis }: { vis: Record<string, unknown> }) {
  const directions = (vis.directions as PDirection[]) ?? []
  const rules = (vis.constitutional_rules as string[]) ?? []

  return (
    <div className="space-y-3">
      <SectionLabel>Pattern 通信方向</SectionLabel>

      <div className="grid grid-cols-3 gap-2">
        {directions.map(d => (
          <div key={d.id}
            className="rounded-lg p-3 border"
            style={{ background: d.color + '0a', borderColor: d.color + '30' }}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <Icon name={d.icon} size={14} style={{ color: d.color }} />
              <div className="text-[11px] font-bold" style={{ color: d.color }}>{d.label}</div>
            </div>
            <div className="text-[9px] text-white/40 leading-relaxed">{d.desc}</div>
          </div>
        ))}
      </div>

      {rules.length > 0 && (
        <div className="space-y-1 border-t border-white/[0.06] pt-2">
          {rules.map((r, i) => (
            <div key={i} className="text-[9px] text-white/25 flex gap-1.5">
              <span className="shrink-0" style={{ color: '#f59e0b60' }}>⊢</span>
              {r}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
//  R — Relation 关系层
// ══════════════════════════════════════════════════════════════════════

// ── R: relation-card — 关系类型卡片 (L0/L1/L2 共用) ──────────────────
interface RSubtype { id: string; label: string; desc: string; icon: string }
interface RSlider { left: string; right: string; default: number }

const R_LEVEL_META: Record<string, { color: string; label: string; certainty: string }> = {
  l0: { color: '#3b82f6', label: 'L0 逻辑关系', certainty: '确定性 · deterministic' },
  l1: { color: '#10b981', label: 'L1 条件关系', certainty: '概率性 · probabilistic' },
  l2: { color: '#8b5cf6', label: 'L2 存在关系', certainty: '模糊性 · fuzzy' },
}

export function RelationCardVisual({ vis, layer }: { vis: Record<string, unknown>; layer: string }) {
  const subtypes = (vis.subtypes as RSubtype[]) ?? []
  const slider = vis.slider as RSlider | undefined
  const meta = R_LEVEL_META[layer] ?? R_LEVEL_META.l0

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <SectionLabel>{meta.label}</SectionLabel>
        <span className="text-[8px] font-mono px-1.5 py-0.5 rounded border"
          style={{ color: meta.color + 'aa', borderColor: meta.color + '25', background: meta.color + '08' }}>
          {meta.certainty}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {subtypes.map(s => (
          <div key={s.id}
            className="flex items-start gap-2 p-2.5 rounded-lg border min-h-[44px]"
            style={{ background: meta.color + '06', borderColor: meta.color + '20' }}
          >
            <Icon name={s.icon} size={14} className="shrink-0 mt-0.5" style={{ color: meta.color + 'cc' }} />
            <div>
              <div className="text-[10px] font-semibold" style={{ color: meta.color + 'dd' }}>{s.label}</div>
              <div className="text-[9px] text-white/35 leading-snug mt-0.5">{s.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {slider && (
        <div className="pt-2 border-t border-white/[0.06]">
          <SliderWidget
            value={slider.default}
            readOnly
            leftLabel={slider.left}
            rightLabel={slider.right}
          />
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
//  V — Value 价值层
// ══════════════════════════════════════════════════════════════════════

const V_COLOR = '#fb923c'

// ── V: metrics-dashboard — L0 客观指标面板 ────────────────────────────
interface VMetric { id: string; label: string; unit: string; icon: string; format: string; sub?: string[]; range?: number[]; formula?: string; alert?: string }

export function MetricsDashboardVisual({ vis }: { vis: Record<string, unknown> }) {
  const metrics = (vis.metrics as VMetric[]) ?? []

  return (
    <div className="space-y-3">
      <SectionLabel>V-L0 客观指标</SectionLabel>
      <div className="grid grid-cols-2 gap-2">
        {metrics.map(m => (
          <div key={m.id}
            className="flex items-center gap-2 p-2 rounded-lg border min-h-[44px]"
            style={{ background: '#3b82f606', borderColor: '#3b82f620' }}
          >
            <Icon name={m.icon} size={14} style={{ color: '#93c5fd' }} />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-medium text-white/60">{m.label}</div>
              <div className="flex items-center gap-1">
                <span className="text-[9px] font-mono" style={{ color: '#93c5fdaa' }}>{m.format}</span>
                {m.unit && <span className="text-[8px] text-white/25">{m.unit}</span>}
              </div>
            </div>
            {m.alert && (
              <span className="text-[7px] px-1 py-0.5 rounded border shrink-0"
                style={{ color: '#f59e0baa', borderColor: '#f59e0b25', background: '#f59e0b08' }}>
                {m.alert}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── V: checklist-form — L0 校验清单 ──────────────────────────────────
interface VCheck { id: string; label: string; desc: string; icon: string }

export function ChecklistFormVisual({ vis }: { vis: Record<string, unknown> }) {
  const checks = (vis.checks as VCheck[]) ?? []
  const [checked, setChecked] = useState<Set<string>>(new Set())

  const toggle = (id: string) => {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  const allPassed = checked.size === checks.length

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <SectionLabel>V-L0 校验清单</SectionLabel>
        <span className="text-[8px] font-mono px-1.5 py-0.5 rounded border"
          style={{
            color: allPassed ? '#34d399' : '#f59e0baa',
            borderColor: allPassed ? '#34d39940' : '#f59e0b25',
            background: allPassed ? '#34d39910' : '#f59e0b08',
          }}>
          {checked.size}/{checks.length} {allPassed ? 'ALL PASS' : 'pending'}
        </span>
      </div>

      <div className="space-y-1.5">
        {checks.map(c => {
          const done = checked.has(c.id)
          return (
            <button key={c.id} type="button" onClick={() => toggle(c.id)}
              className="w-full flex items-center gap-2.5 p-2.5 rounded-lg border text-left transition-all duration-200 cursor-pointer min-h-[44px]"
              style={{
                background: done ? '#34d39910' : '#ffffff04',
                borderColor: done ? '#34d39940' : '#ffffff10',
              }}
            >
              <div className="w-5 h-5 rounded border flex items-center justify-center shrink-0"
                style={{
                  borderColor: done ? '#34d39970' : '#ffffff20',
                  background: done ? '#34d39920' : 'transparent',
                }}>
                {done && <CheckCircle size={12} style={{ color: '#34d399' }} />}
              </div>
              <Icon name={c.icon} size={14} className="shrink-0" style={{ color: done ? '#34d399aa' : V_COLOR + '80' }} />
              <div>
                <div className="text-[10px] font-medium" style={{ color: done ? '#34d399cc' : '#ffffffaa' }}>{c.label}</div>
                <div className="text-[9px] text-white/30">{c.desc}</div>
              </div>
            </button>
          )
        })}
      </div>

      <div className="text-[9px] text-white/25 border-t border-white/[0.06] pt-2">
        全部通过 = 状态迁移守卫条件满足
      </div>
    </div>
  )
}

// ── V: budget-form — L1 资源预算 ─────────────────────────────────────
interface VBudgetField { id: string; label: string; unit: string; icon: string; input: string; helper?: string; options?: string[] }

export function BudgetFormVisual({ vis }: { vis: Record<string, unknown> }) {
  const fields = (vis.fields as VBudgetField[]) ?? []

  return (
    <div className="space-y-3">
      <SectionLabel>V-L1 资源预算</SectionLabel>

      <div className="space-y-2">
        {fields.map(f => (
          <div key={f.id} className="flex items-center gap-3 p-2.5 rounded-lg border min-h-[44px]"
            style={{ background: V_COLOR + '06', borderColor: V_COLOR + '20' }}
          >
            <Icon name={f.icon} size={14} className="shrink-0" style={{ color: V_COLOR + 'cc' }} />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-medium text-white/60">{f.label}</div>
              {f.helper && <div className="text-[8px] text-white/25">{f.helper}</div>}
            </div>
            {f.options ? (
              <div className="flex gap-1 shrink-0">
                {f.options.map(o => (
                  <span key={o} className="px-1.5 py-0.5 rounded text-[9px] font-mono border cursor-pointer"
                    style={{ color: V_COLOR + '90', borderColor: V_COLOR + '25', background: V_COLOR + '08' }}>
                    {o}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-[9px] font-mono px-2 py-1 rounded border"
                style={{ color: V_COLOR + '80', borderColor: V_COLOR + '20', background: V_COLOR + '06' }}>
                {f.unit}
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="text-[9px] text-white/25 border-t border-white/[0.06] pt-2">
        预算耗尽 → 触发熔断机制
      </div>
    </div>
  )
}

// ── V: reward-editor — L1 Reward 函数 ────────────────────────────────
interface VRewardFn { id: string; label: string; icon: string; desc?: string }

export function RewardEditorVisual({ vis }: { vis: Record<string, unknown> }) {
  const fns = (vis.reward_functions as VRewardFn[]) ?? []
  const eachFn = vis.each_fn as { output: string; weight: string } | undefined

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <SectionLabel>V-L1 Reward 函数</SectionLabel>
        {eachFn && (
          <span className="text-[8px] font-mono px-1.5 py-0.5 rounded border"
            style={{ color: V_COLOR + 'aa', borderColor: V_COLOR + '25', background: V_COLOR + '08' }}>
            output: {eachFn.output} · weight: {eachFn.weight}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {fns.map(f => (
          <div key={f.id}
            className="flex items-start gap-2 p-2.5 rounded-lg border min-h-[44px]"
            style={{ background: V_COLOR + '06', borderColor: V_COLOR + '20' }}
          >
            <Icon name={f.icon} size={14} className="shrink-0 mt-0.5" style={{ color: V_COLOR + 'cc' }} />
            <div>
              <div className="text-[10px] font-semibold" style={{ color: V_COLOR + 'dd' }}>{f.label}</div>
              {f.desc && <div className="text-[9px] text-white/35 mt-0.5">{f.desc}</div>}
            </div>
          </div>
        ))}
      </div>

      <div className="text-[9px] text-white/25 border-t border-white/[0.06] pt-2">
        Reward 函数集合可动态增加，是 task.done 的门控条件
      </div>
    </div>
  )
}

// ── V: feedback-indicator — L1 正/负反馈 + 熔断 ──────────────────────
interface VFeedbackState { id: string; label: string; color: string; icon: string; desc: string }
interface VCircuitBreaker { label: string; icon: string; desc: string; color: string }

export function FeedbackIndicatorVisual({ vis }: { vis: Record<string, unknown> }) {
  const states = (vis.states as VFeedbackState[]) ?? []
  const breaker = vis.circuit_breaker as VCircuitBreaker | undefined

  return (
    <div className="space-y-3">
      <SectionLabel>V-L1 反馈回路</SectionLabel>

      <div className="flex gap-2">
        {states.map(s => (
          <div key={s.id}
            className="flex-1 flex items-center gap-2 p-3 rounded-lg border min-h-[44px]"
            style={{ background: s.color + '0a', borderColor: s.color + '30' }}
          >
            <Icon name={s.icon} size={16} style={{ color: s.color }} />
            <div>
              <div className="text-[11px] font-semibold" style={{ color: s.color }}>{s.label}</div>
              <div className="text-[9px] text-white/35 mt-0.5">{s.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {breaker && (
        <div className="flex items-center gap-2 p-3 rounded-lg border"
          style={{ background: breaker.color + '08', borderColor: breaker.color + '30' }}
        >
          <Icon name={breaker.icon} size={16} style={{ color: breaker.color }} />
          <div>
            <div className="text-[11px] font-bold" style={{ color: breaker.color }}>{breaker.label}</div>
            <div className="text-[9px] text-white/35 mt-0.5">{breaker.desc}</div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── V: homeostasis-gauge — L1 稳态偏离检测 ───────────────────────────
interface VEvaluator { id: string; label: string; desc: string; icon: string; color?: string }

export function HomeostasisGaugeVisual({ vis }: { vis: Record<string, unknown> }) {
  const deviation = vis.deviation as { range: number[]; threshold: number; label: string; icon: string; semantic: string } | undefined
  const evaluators = (vis.evaluators as VEvaluator[]) ?? []

  const threshold = deviation?.threshold ?? 0.7
  const thresholdPct = threshold * 100

  return (
    <div className="space-y-3">
      <SectionLabel>V-L1 稳态偏离检测</SectionLabel>

      {/* Gauge bar */}
      {deviation && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Icon name={deviation.icon} size={14} style={{ color: V_COLOR }} />
            <span className="text-[10px] font-medium text-white/60">{deviation.label}</span>
            <span className="text-[9px] font-mono ml-auto" style={{ color: '#ef4444aa' }}>
              阈值: {threshold}
            </span>
          </div>
          <div className="relative h-3 rounded-full overflow-hidden"
            style={{ background: '#ffffff08', border: '1px solid #ffffff10' }}>
            {/* Safe zone */}
            <div className="absolute inset-y-0 left-0 rounded-l-full"
              style={{ width: `${thresholdPct}%`, background: 'linear-gradient(90deg, #34d39920, #f59e0b20)' }} />
            {/* Danger zone */}
            <div className="absolute inset-y-0 right-0 rounded-r-full"
              style={{ width: `${100 - thresholdPct}%`, background: '#ef444418' }} />
            {/* Threshold marker */}
            <div className="absolute inset-y-0 w-px" style={{ left: `${thresholdPct}%`, background: '#ef4444aa' }} />
          </div>
          <div className="text-[8px] text-white/25">{deviation.semantic}</div>
        </div>
      )}

      {/* Evaluators */}
      <div className="space-y-1.5">
        {evaluators.map(e => (
          <div key={e.id}
            className="flex items-center gap-2 p-2 rounded-lg border min-h-[44px]"
            style={{
              background: (e.color ?? V_COLOR) + '06',
              borderColor: (e.color ?? V_COLOR) + '20',
            }}
          >
            <Icon name={e.icon} size={14} style={{ color: (e.color ?? V_COLOR) + 'cc' }} />
            <div>
              <div className="text-[10px] font-medium" style={{ color: (e.color ?? V_COLOR) + 'dd' }}>{e.label}</div>
              <div className="text-[9px] text-white/30">{e.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── V: practice-test-form — L2 实践检验 ──────────────────────────────
interface VTest { id: string; label: string; icon: string; desc: string; fields: string[] }

export function PracticeTestFormVisual({ vis }: { vis: Record<string, unknown> }) {
  const tests = (vis.tests as VTest[]) ?? []

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <SectionLabel>V-L2 实践检验</SectionLabel>
        <span className="text-[8px] font-mono px-1.5 py-0.5 rounded border"
          style={{ color: '#8b5cf6aa', borderColor: '#8b5cf625', background: '#8b5cf608' }}>
          最强 V = 实践检验
        </span>
      </div>

      <div className="space-y-2">
        {tests.map(t => (
          <div key={t.id}
            className="p-3 rounded-lg border"
            style={{ background: '#8b5cf606', borderColor: '#8b5cf620' }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <Icon name={t.icon} size={14} style={{ color: '#8b5cf6cc' }} />
              <div className="text-[11px] font-semibold" style={{ color: '#8b5cf6dd' }}>{t.label}</div>
            </div>
            <div className="text-[9px] text-white/35 mb-2">{t.desc}</div>
            <div className="flex flex-wrap gap-1">
              {t.fields.map(f => (
                <span key={f} className="px-1.5 py-0.5 rounded text-[8px] font-mono border"
                  style={{ color: '#8b5cf680', borderColor: '#8b5cf620', background: '#8b5cf608' }}>
                  {f}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── V: v-core-panel — 核心机制 ───────────────────────────────────────
interface VCoreComponent { id: string; label: string; icon: string; desc: string; access: string }

export function VCorePanelVisual({ vis }: { vis: Record<string, unknown> }) {
  const components = (vis.components as VCoreComponent[]) ?? []
  const independence = vis.independence as Record<string, boolean> | undefined

  const accessColor: Record<string, string> = {
    v_only: '#ef4444',
    module_visible: '#34d399',
  }

  return (
    <div className="space-y-3">
      <SectionLabel>V 核心机制</SectionLabel>

      <div className="space-y-2">
        {components.map(c => (
          <div key={c.id}
            className="flex items-center gap-3 p-3 rounded-lg border min-h-[44px]"
            style={{ background: V_COLOR + '06', borderColor: V_COLOR + '20' }}
          >
            <Icon name={c.icon} size={16} style={{ color: V_COLOR + 'cc' }} />
            <div className="flex-1">
              <div className="text-[11px] font-semibold" style={{ color: V_COLOR + 'dd' }}>{c.label}</div>
              <div className="text-[9px] text-white/35 mt-0.5">{c.desc}</div>
            </div>
            <span className="px-1.5 py-0.5 rounded text-[8px] font-mono border shrink-0"
              style={{
                color: (accessColor[c.access] ?? '#6b7280') + 'aa',
                borderColor: (accessColor[c.access] ?? '#6b7280') + '30',
                background: (accessColor[c.access] ?? '#6b7280') + '08',
              }}>
              {c.access === 'v_only' ? 'V独占' : '模块可见'}
            </span>
          </div>
        ))}
      </div>

      {independence && (
        <div className="flex gap-2 border-t border-white/[0.06] pt-2">
          {Object.entries(independence).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1 text-[8px]"
              style={{ color: v ? '#34d399aa' : '#ef4444aa' }}>
              {v ? <CheckCircle size={10} /> : <AlertOctagon size={10} />}
              {k === 'neutral' ? '中立性' : k === 'anti_infiltration' ? '防渗透' : '内核直接负责'}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
//  S — State 状态层
// ══════════════════════════════════════════════════════════════════════

const S_COLOR = '#10b981'

// ── S: state-machine — L0 运行时状态机 ───────────────────────────────
interface SState { id: string; label: string; color: string; icon: string }
interface STransition { from: string; to: string; guard: string }

export function SStateMachineVisual({ vis }: { vis: Record<string, unknown> }) {
  const states = (vis.states as SState[]) ?? []
  const transitions = (vis.transitions as STransition[]) ?? []
  const [active, setActive] = useState(states[0]?.id ?? '')

  const activeState = states.find(s => s.id === active)
  const outgoing = transitions.filter(t => t.from === active)

  return (
    <div className="space-y-3">
      <SectionLabel>S-L0 运行时状态机</SectionLabel>

      <div className="flex flex-wrap gap-1.5">
        {states.map(s => {
          const isActive = s.id === active
          return (
            <button key={s.id} type="button" onClick={() => setActive(s.id)}
              className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg border transition-all duration-200 cursor-pointer min-h-[44px]"
              style={{
                background: isActive ? s.color + '18' : s.color + '06',
                borderColor: isActive ? s.color + '60' : s.color + '20',
                boxShadow: isActive ? `0 0 10px ${s.color}20` : 'none',
              }}
            >
              <Icon name={s.icon} size={14} style={{ color: isActive ? s.color : s.color + '70' }} />
              <span className="text-[10px] font-medium"
                style={{ color: isActive ? s.color : s.color + '80' }}>
                {s.label}
              </span>
            </button>
          )
        })}
      </div>

      {activeState && outgoing.length > 0 && (
        <div className="pl-2 border-l-2 space-y-1" style={{ borderColor: activeState.color + '30' }}>
          {outgoing.map(t => {
            const target = states.find(s => s.id === t.to)
            return (
              <div key={`${t.from}-${t.to}`} className="flex items-center gap-2 text-[10px]">
                <ArrowRight size={10} style={{ color: '#ffffff25' }} />
                <span style={{ color: target?.color ?? '#ffffff80' }}>{target?.label ?? t.to}</span>
                <span className="px-1.5 py-0.5 rounded text-[8px] font-mono border"
                  style={{ color: '#fcd34daa', borderColor: '#f59e0b25', background: '#f59e0b08' }}>
                  {t.guard}
                </span>
              </div>
            )
          })}
        </div>
      )}

      <div className="text-[9px] text-white/25 border-t border-white/[0.06] pt-2">
        守卫条件 = V 的 L0 规则清单全部通过
      </div>
    </div>
  )
}

// ── S: lifecycle-pipeline — L1 任务生命周期 ──────────────────────────
interface SStage { id: string; label: string; icon: string; color: string; desc?: string }

export function LifecyclePipelineVisual({ vis }: { vis: Record<string, unknown> }) {
  const stages = (vis.stages as SStage[]) ?? []
  const feedbackLoop = vis.feedback_loop as Record<string, string> | undefined
  const versionTracking = vis.version_tracking as string | undefined
  const [activeIdx, setActiveIdx] = useState(0)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <SectionLabel>S-L1 任务生命周期</SectionLabel>
        {versionTracking && (
          <span className="text-[8px] font-mono px-1.5 py-0.5 rounded border"
            style={{ color: S_COLOR + 'aa', borderColor: S_COLOR + '25', background: S_COLOR + '08' }}>
            {versionTracking}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1">
        {stages.map((s, i) => {
          const isActive = i === activeIdx
          return (
            <div key={s.id} className="flex items-center gap-1">
              <button type="button" onClick={() => setActiveIdx(i)}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border transition-all duration-200 cursor-pointer min-h-[36px]"
                style={{
                  background: isActive ? s.color + '18' : s.color + '06',
                  borderColor: isActive ? s.color + '60' : s.color + '18',
                }}
              >
                <Icon name={s.icon} size={12} style={{ color: isActive ? s.color : s.color + '60' }} />
                <span className="text-[9px] font-medium"
                  style={{ color: isActive ? s.color : s.color + '70' }}>
                  {s.label}
                </span>
              </button>
              {i < stages.length - 1 && (
                <ArrowRight size={10} style={{ color: '#ffffff15' }} />
              )}
            </div>
          )
        })}
      </div>

      {stages[activeIdx]?.desc && (
        <div className="text-[9px] text-white/35 pl-2 border-l-2"
          style={{ borderColor: stages[activeIdx].color + '30' }}>
          {stages[activeIdx].desc}
        </div>
      )}

      {feedbackLoop && (
        <div className="border-t border-white/[0.06] pt-2 space-y-1">
          <div className="text-[8px] text-white/25 uppercase tracking-widest mb-1">反馈回路</div>
          {Object.entries(feedbackLoop).map(([k, v]) => {
            const color = k === 'positive' ? '#34d399' : k === 'negative' ? '#f87171' : '#ef4444'
            return (
              <div key={k} className="flex items-center gap-2 text-[9px]">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
                <span style={{ color: color + 'cc' }}>{k}</span>
                <span className="text-white/30">{v}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── S: strategy-board — L2 战略目标 ──────────────────────────────────
interface SStrategyState { id: string; label: string; color: string; icon: string; desc?: string }

export function StrategyBoardVisual({ vis }: { vis: Record<string, unknown> }) {
  const states = (vis.states as SStrategyState[]) ?? []
  const learner = vis.learner as Record<string, string> | undefined

  return (
    <div className="space-y-3">
      <SectionLabel>S-L2 战略目标生命周期</SectionLabel>

      <div className="grid grid-cols-3 gap-2">
        {states.map(s => (
          <div key={s.id}
            className="p-2.5 rounded-lg border"
            style={{ background: s.color + '08', borderColor: s.color + '25' }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Icon name={s.icon} size={14} style={{ color: s.color }} />
              <div className="text-[10px] font-semibold" style={{ color: s.color }}>{s.label}</div>
            </div>
            {s.desc && <div className="text-[8px] text-white/30 leading-snug">{s.desc}</div>}
          </div>
        ))}
      </div>

      {learner && (
        <div className="p-3 rounded-lg border"
          style={{ background: '#f59e0b06', borderColor: '#f59e0b20' }}
        >
          <div className="flex items-center gap-1.5 mb-2">
            <BookMarked size={14} style={{ color: '#f59e0b' }} />
            <span className="text-[10px] font-semibold" style={{ color: '#f59e0bcc' }}>搁置目标学习器</span>
          </div>
          <div className="space-y-1">
            {Object.entries(learner).map(([k, v]) => (
              <div key={k} className="flex items-center gap-2 text-[9px]">
                <span className="text-white/30 font-mono w-16 shrink-0">{k}</span>
                <span className="text-white/50">{v}</span>
              </div>
            ))}
          </div>
          <div className="text-[8px] text-white/20 mt-2 border-t border-white/[0.06] pt-1.5">
            搁置 ≠ 放弃。置信度超阈值 → 建议重启
          </div>
        </div>
      )}
    </div>
  )
}

// ── S: driving-force-cards — 驱动力 S1-S4 ────────────────────────────
interface SDrivingForce { id: string; label: string; color: string; icon: string; desc: string }

export function DrivingForceVisual({ vis }: { vis: Record<string, unknown> }) {
  const forces = (vis.forces as SDrivingForce[]) ?? []
  const note = vis.note as string | undefined

  return (
    <div className="space-y-3">
      <SectionLabel>S 驱动力</SectionLabel>

      <div className="grid grid-cols-2 gap-2">
        {forces.map(f => (
          <div key={f.id}
            className="flex items-start gap-2 p-3 rounded-lg border min-h-[44px]"
            style={{ background: f.color + '08', borderColor: f.color + '25' }}
          >
            <Icon name={f.icon} size={16} className="shrink-0 mt-0.5" style={{ color: f.color }} />
            <div>
              <div className="text-[11px] font-semibold" style={{ color: f.color }}>{f.id} {f.label}</div>
              <div className="text-[9px] text-white/35 mt-0.5">{f.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {note && (
        <div className="text-[9px] text-white/25 border-t border-white/[0.06] pt-2">{note}</div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
//  主分发器 — 根据 vis.type 路由到对应渲染器
// ══════════════════════════════════════════════════════════════════════

export function PrvseTypeRouter({ vis, layer }: { vis: Record<string, unknown>; layer?: string }) {
  const type = vis.type as string | undefined
  if (!type) return null

  switch (type) {
    // P layer
    case 'state-flow':           return <StateFlowVisual vis={vis} />
    case 'source-chain':         return <SourceChainVisual vis={vis} />
    case 'tier-cards':           return <TierCardsVisual vis={vis} />
    case 'chip-selector':        return <ChipSelectorVisual vis={vis} />
    case 'comm-direction-cards': return <CommDirectionVisual vis={vis} />
    // R layer
    case 'relation-card':        return <RelationCardVisual vis={vis} layer={layer ?? 'l0'} />
    // V layer
    case 'metrics-dashboard':    return <MetricsDashboardVisual vis={vis} />
    case 'checklist-form':       return <ChecklistFormVisual vis={vis} />
    case 'budget-form':          return <BudgetFormVisual vis={vis} />
    case 'reward-editor':        return <RewardEditorVisual vis={vis} />
    case 'feedback-indicator':   return <FeedbackIndicatorVisual vis={vis} />
    case 'homeostasis-gauge':    return <HomeostasisGaugeVisual vis={vis} />
    case 'practice-test-form':   return <PracticeTestFormVisual vis={vis} />
    case 'v-core-panel':         return <VCorePanelVisual vis={vis} />
    // S layer
    case 'state-machine':        return <SStateMachineVisual vis={vis} />
    case 'lifecycle-pipeline':   return <LifecyclePipelineVisual vis={vis} />
    case 'strategy-board':       return <StrategyBoardVisual vis={vis} />
    case 'driving-force-cards':  return <DrivingForceVisual vis={vis} />
    default:                     return null
  }
}
