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
  TrendingDown, OctagonX,
  Expand, Eye, EyeOff, Wand2,
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
  TrendingDown, OctagonX,
  Expand, Eye, EyeOff, Wand2,
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
    default:                     return null
  }
}
