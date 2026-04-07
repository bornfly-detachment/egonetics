/**
 * PRVSE 共享类型 — 基于 prvse-compiler-design.md
 * L/A/T 三维分级体系（2026-04-07 宪法确认）
 */

// ── L — 信息层级（根性质） ───────────────────────────────────────
export type InfoLevel = 'L0' | 'L1' | 'L2'

// ── A — 操作权限（L 的投影） ──────────────────────────────────────
export type AuthorityLevel = 'A0' | 'A1' | 'A2' | 'A3'

// ── T — AI 智能分级（L 的投影） ───────────────────────────────────
export type AITier = 'T0' | 'T1' | 'T2'

// ── Pattern 三态 ──────────────────────────────────────────────────
export type PatternState = 'external' | 'candidate' | 'internal'

// ── 物理载体 ──────────────────────────────────────────────────────
export type PhysicalType =
  | 'text' | 'number' | 'code' | 'structured'
  | 'image' | 'audio' | 'video' | 'stream' | 'mixed'

// ── 通信方向 ──────────────────────────────────────────────────────
export type Communication = 'bottom_up' | 'top_down' | 'lateral'

// ── Narrowable（渐进式确定） ──────────────────────────────────────
export interface Narrowable<T> {
  resolved: boolean
  value?: T
}

// ── 溯源链 ────────────────────────────────────────────────────────
export type OriginDomain = 'internal' | 'external'
export type InternalSource = 'user_input' | 'model_call' | 'module_output' | 'system_event' | 'process_memory'
export type ExternalSource = 'computable' | 'verifiable' | 'narrative' | 'sensor'

export interface Origin {
  domain: OriginDomain
  source: InternalSource | ExternalSource
  label?: string
  chain?: Origin[]
}

// ── Chronicle 快照（最小完备） ─────────────────────────────────────
export interface ChronicleSnapshot {
  designRationale: string
  functionalSpec: string
  dependencies: string[]
  constitutionBindings: string[]
  sourceRef?: string        // git commit / file path
}

// ── Pattern 数据模型 ──────────────────────────────────────────────
export interface PatternData {
  id: string
  timestamp: number
  rawContent: string
  origin: Origin
  state: PatternState
  physical: Narrowable<PhysicalType>
  level: Narrowable<InfoLevel>
  communication: Narrowable<Communication>
  // Chronicle
  parentId?: string
  version?: number
  frozen?: boolean
  chronicle?: ChronicleSnapshot
}

// ── 计算：缩窄程度 → 权限上限 ─────────────────────────────────────
export function narrowingCount(p: PatternData): number {
  return [p.physical, p.level, p.communication].filter(n => n.resolved).length
}

export function derivedAuthority(p: PatternData): AuthorityLevel {
  const n = narrowingCount(p)
  if (n === 3) return 'A2'
  if (n >= 1) return 'A1'
  return 'A0'
}

export function derivedTier(p: PatternData): AITier {
  const level = p.level.resolved ? p.level.value : undefined
  if (level === 'L2') return 'T2'
  if (level === 'L1') return 'T1'
  return 'T0'
}

// ── L 级别视觉色板 ────────────────────────────────────────────────
export const L_COLORS = {
  L0: { primary: '#94a3b8', bg: 'rgba(148,163,184,0.06)', border: 'rgba(148,163,184,0.25)', glow: 'rgba(148,163,184,0.12)', label: '信号层' },
  L1: { primary: '#60a5fa', bg: 'rgba(96,165,250,0.06)',  border: 'rgba(96,165,250,0.25)',  glow: 'rgba(96,165,250,0.12)',  label: '规律层' },
  L2: { primary: '#c084fc', bg: 'rgba(192,132,252,0.06)', border: 'rgba(192,132,252,0.25)', glow: 'rgba(192,132,252,0.12)', label: '认知层' },
} as const

// ── 三态视觉 ──────────────────────────────────────────────────────
export const STATE_VISUALS = {
  external:  { borderStyle: 'dashed'  as const, borderWidth: 1, opacity: 0.7, label: '外部' },
  candidate: { borderStyle: 'solid'   as const, borderWidth: 1, opacity: 0.85, label: '候选' },
  internal:  { borderStyle: 'solid'   as const, borderWidth: 2, opacity: 1.0, label: '内部' },
} as const
