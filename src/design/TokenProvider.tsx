/**
 * TokenProvider — Layer 1b
 * 从 hm_protocol 加载可选覆盖，合并到静态 tokens
 * 挂在 App 根部，静默失败（网络错误时用静态 tokens 兜底）
 *
 * 覆盖规则：
 *   category='layer', layer='l0/l1/l2'  → 覆盖 tokens.layer[layer]
 *   category='R'                         → 根据 vis.style 覆盖 tokens.edge[type]
 *   category='interaction'               → 根据 vis.action 覆盖 tokens.interaction[action]
 *   其他 category                        → 不影响 tokens（P/V/AOP 是内容规范，非样式）
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { DESIGN_TOKENS, type DesignTokens } from './tokens'
import { authFetch } from '@/lib/http'

// ── R 层映射：protocol.layer → edge token key ─────────────────────
const R_LAYER_TO_EDGE: Record<string, string> = {
  l0:     'contains',
  signal: 'signal',
  l2:     'derives',
}
// layer='l1' 需要看 vis.style 来区分 constraint vs mutual_constraint

function pick<T extends object>(obj: T, keys: (keyof T)[]): Partial<T> {
  const result: Partial<T> = {}
  for (const k of keys) {
    if (obj[k] !== undefined) result[k] = obj[k]
  }
  return result
}

function deepMerge(base: DesignTokens, overrides: Partial<DesignTokens>): DesignTokens {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = { ...base }
  for (const section of ['node', 'layer', 'edge', 'interaction'] as const) {
    if (!overrides[section]) continue
    result[section] = { ...base[section] }
    for (const [key, val] of Object.entries(overrides[section] as Record<string, unknown>)) {
      if (val && typeof val === 'object') {
        result[section][key] = { ...(base[section][key] ?? {}), ...(val as object) }
      }
    }
  }
  return result as DesignTokens
}

interface ProtocolEntry {
  id: string; category: string; layer: string; ui_visual: string
}

function buildOverrides(entries: ProtocolEntry[]): Partial<DesignTokens> {
  const layer: Record<string, object> = {}
  const edge:  Record<string, object> = {}
  const interaction: Record<string, object> = {}

  for (const e of entries) {
    let vis: Record<string, unknown> = {}
    try { vis = JSON.parse(e.ui_visual || '{}') } catch { continue }

    if (e.category === 'layer' && ['l0', 'l1', 'l2'].includes(e.layer)) {
      layer[e.layer] = pick(vis as never, ['color', 'bg', 'border', 'icon'] as never[])
    }

    if (e.category === 'R') {
      const edgeKey = R_LAYER_TO_EDGE[e.layer]
      if (edgeKey) {
        edge[edgeKey] = pick(vis as never, ['color', 'width', 'strokeWidth', 'dash'] as never[])
      } else if (e.layer === 'l1') {
        // l1 有 constraint 和 mutual_constraint 两条
        const style = vis.style as string
        const key = style === 'mutual' ? 'mutual_constraint' : 'constraint'
        edge[key] = pick(vis as never, ['color', 'width', 'strokeWidth', 'dash'] as never[])
      }
    }

    if (e.category === 'interaction') {
      const action = vis.action as string
      if (action) {
        interaction[action] = pick(vis as never, ['color', 'icon'] as never[])
      }
    }
  }

  const result: Partial<DesignTokens> = {}
  if (Object.keys(layer).length) result.layer = layer as unknown as DesignTokens['layer']
  if (Object.keys(edge).length)  result.edge  = edge  as unknown as DesignTokens['edge']
  if (Object.keys(interaction).length) result.interaction = interaction as unknown as DesignTokens['interaction']
  return result
}

// ── Context ───────────────────────────────────────────────────────
const TokenContext = createContext<DesignTokens>(DESIGN_TOKENS)

export function TokenProvider({ children }: { children: ReactNode }) {
  const [tokens, setTokens] = useState<DesignTokens>(DESIGN_TOKENS)

  useEffect(() => {
    authFetch<ProtocolEntry[]>('/protocol')
      .then(entries => {
        const overrides = buildOverrides(entries)
        if (Object.keys(overrides).length) {
          setTokens(deepMerge(DESIGN_TOKENS, overrides))
        }
      })
      .catch(() => { /* 静默失败，用静态 tokens */ })
  }, [])

  return <TokenContext.Provider value={tokens}>{children}</TokenContext.Provider>
}

/** 组件内取 tokens 的 hook */
export function useTokens(): DesignTokens {
  return useContext(TokenContext)
}
