/**
 * StateMachineVisual — Layer 3
 * S (State) 节点是 AI-Native 动态状态，非传统静态 UI
 *
 * 三种维度各有专属视觉：
 *   lifecycle  → DirectedFlow（状态链 + 循环高亮）
 *   feedback   → FeedbackLoop（正/负回路动画）
 *   execution  → OutcomeTree（结果树 + 门控标注）
 *   generic    → StateDiagram（通用状态节点循环）
 */
import { useEffect, useRef, useState } from 'react'

interface Transition {
  from: string
  to: string
  trigger: string
  guard?: string | null
}

interface Props {
  vis: Record<string, unknown>
  layer: string
}

// ── 共用原语 ──────────────────────────────────────────────────────

function LiveBadge({ label = 'AI-NATIVE' }: { label?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[7px] font-bold tracking-widest uppercase shrink-0"
      style={{
        background: 'linear-gradient(90deg, #10b98120 0%, #3b82f615 100%)',
        color: '#10b981',
        border: '1px solid #10b98135',
        letterSpacing: '0.08em',
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0" style={{ background: '#10b981' }} />
      {label}
    </span>
  )
}

function GuardPill({ guard }: { guard: string }) {
  return (
    <span
      className="px-1 py-px rounded text-[7px] font-mono shrink-0"
      style={{ background: '#f59e0b12', color: '#fcd34d80', border: '1px solid #f59e0b20' }}
    >
      ⊢ {guard}
    </span>
  )
}

// ── 扫描线动画背景 ────────────────────────────────────────────────
function ScanlineBg({ color }: { color: string }) {
  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden rounded"
      style={{ opacity: 0.04 }}
    >
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="absolute w-full"
          style={{
            height: 1,
            top: `${(i + 1) * 16}%`,
            background: color,
          }}
        />
      ))}
    </div>
  )
}

// ── lifecycle: DirectedFlow ───────────────────────────────────────
function DirectedFlow({ vis }: { vis: Record<string, unknown> }) {
  const states = vis.states as string[]
  const transitions = (vis.transitions as Transition[]) ?? []
  const stateColors = (vis.state_colors as Record<string, string>) ?? {}
  const initial = vis.initial as string

  const [activeIdx, setActiveIdx] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const cycle = () => {
      setActiveIdx(i => {
        const cur = states[i]
        // 找当前状态的 outgoing transitions
        const outs = transitions.filter(t => t.from === cur)
        if (!outs.length) {
          // terminal state — reset to initial after pause
          timerRef.current = setTimeout(() => setActiveIdx(0), 2200)
          return i
        }
        const next = states.indexOf(outs[0].to)
        timerRef.current = setTimeout(cycle, 1600)
        return next >= 0 ? next : 0
      })
    }
    timerRef.current = setTimeout(cycle, 1200)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [states, transitions])

  const activeState = states[activeIdx]

  return (
    <div className="relative space-y-2 p-2 rounded" style={{ background: '#0a0f1a' }}>
      <ScanlineBg color="#3b82f6" />

      {/* Header */}
      <div className="relative flex items-center gap-2">
        <LiveBadge label="SCHEMA" />
        <span className="text-[8px] text-white/25 font-mono">lifecycle · {states.length} states</span>
        <span
          className="ml-auto text-[8px] font-mono font-bold px-1.5 py-0.5 rounded"
          style={{
            color: stateColors[activeState] ?? '#10b981',
            background: (stateColors[activeState] ?? '#10b981') + '15',
            border: `1px solid ${stateColors[activeState] ?? '#10b981'}30`,
          }}
        >
          ● {activeState}
        </span>
      </div>

      {/* State chain */}
      <div className="relative flex flex-wrap items-center gap-1">
        {states.map((s, i) => {
          const col = stateColors[s] ?? '#6b7280'
          const isActive = s === activeState
          const isInitial = s === initial
          const hasOutgoing = transitions.some(t => t.from === s)

          return (
            <div key={s} className="flex items-center gap-1">
              {/* State node */}
              <div
                className="relative px-2 py-1 rounded text-[9px] font-mono transition-all duration-500"
                style={{
                  background: isActive ? col + '22' : col + '08',
                  border: `1px solid ${isActive ? col + 'aa' : col + '25'}`,
                  color: isActive ? col : col + '55',
                  boxShadow: isActive ? `0 0 10px ${col}35, 0 0 2px ${col}50` : 'none',
                  transform: isActive ? 'scale(1.05)' : 'scale(1)',
                }}
              >
                {isInitial && !isActive && (
                  <span className="absolute -top-1 -left-1 text-[7px]" style={{ color: col + '60' }}>⊳</span>
                )}
                {s}
              </div>

              {/* Arrow to next if transition exists */}
              {hasOutgoing && i < states.length - 1 && (
                <div
                  className="text-[10px] font-bold transition-all duration-500"
                  style={{ color: isActive ? stateColors[s] + '80' : '#ffffff12' }}
                >
                  →
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Active transition info */}
      {(() => {
        const outgoing = transitions.filter(t => t.from === activeState)
        if (!outgoing.length) return (
          <div className="relative text-[8px] font-mono" style={{ color: '#6b7280' }}>
            ◼ terminal
          </div>
        )
        const t = outgoing[0]
        return (
          <div className="relative flex items-center gap-1.5 text-[8px] font-mono">
            <span style={{ color: stateColors[t.from] + '80' }}>{t.trigger}</span>
            <span className="text-white/15">→</span>
            <span style={{ color: stateColors[t.to] + '80' }}>{t.to}</span>
            {t.guard && <GuardPill guard={t.guard} />}
          </div>
        )
      })()}
    </div>
  )
}

// ── feedback: FeedbackLoop ────────────────────────────────────────
function FeedbackLoop({ vis }: { vis: Record<string, unknown> }) {
  const stateColors = (vis.state_colors as Record<string, string>) ?? {}
  const transitions = (vis.transitions as Transition[]) ?? []
  const loopSem = (vis.loop_semantics as Record<string, string>) ?? {}

  const [active, setActive] = useState<'positive_loop' | 'negative_loop'>('positive_loop')

  useEffect(() => {
    const t = setInterval(() => {
      setActive(a => a === 'positive_loop' ? 'negative_loop' : 'positive_loop')
    }, 2000)
    return () => clearInterval(t)
  }, [])

  const posColor = stateColors['positive_loop'] ?? '#10b981'
  const negColor = stateColors['negative_loop'] ?? '#ef4444'
  const isPos = active === 'positive_loop'

  const trigger = transitions.find(t => t.from === active)

  return (
    <div className="relative space-y-2 p-2 rounded" style={{ background: '#0a0f1a' }}>
      <ScanlineBg color={isPos ? posColor : negColor} />

      <div className="relative flex items-center gap-2">
        <LiveBadge label="SCHEMA" />
        <span className="text-[8px] text-white/25 font-mono">feedback · V_reward driven</span>
      </div>

      {/* Two loop nodes */}
      <div className="relative flex items-center gap-3 justify-center py-1">
        {/* Positive loop */}
        <div
          className="flex flex-col items-center gap-1 px-3 py-2 rounded transition-all duration-700"
          style={{
            background: isPos ? posColor + '18' : posColor + '06',
            border: `1px solid ${isPos ? posColor + '70' : posColor + '20'}`,
            boxShadow: isPos ? `0 0 12px ${posColor}30` : 'none',
          }}
        >
          <div className="text-[14px]" style={{ filter: isPos ? 'none' : 'grayscale(1) opacity(0.3)' }}>↺</div>
          <div className="text-[8px] font-bold" style={{ color: isPos ? posColor : posColor + '40' }}>+</div>
          <div className="text-[7px] font-mono" style={{ color: isPos ? posColor + 'cc' : posColor + '30' }}>positive</div>
        </div>

        {/* Bidirectional arrow */}
        <div className="flex flex-col items-center gap-0.5">
          <div
            className="text-[9px] transition-all duration-700"
            style={{ color: !isPos ? negColor + '80' : '#ffffff15', transform: 'rotate(180deg)' }}
          >
            ←
          </div>
          <div className="text-[7px] font-mono text-white/15">V</div>
          <div
            className="text-[9px] transition-all duration-700"
            style={{ color: isPos ? posColor + '80' : '#ffffff15' }}
          >
            →
          </div>
        </div>

        {/* Negative loop */}
        <div
          className="flex flex-col items-center gap-1 px-3 py-2 rounded transition-all duration-700"
          style={{
            background: !isPos ? negColor + '18' : negColor + '06',
            border: `1px solid ${!isPos ? negColor + '70' : negColor + '20'}`,
            boxShadow: !isPos ? `0 0 12px ${negColor}30` : 'none',
          }}
        >
          <div className="text-[14px]" style={{ filter: !isPos ? 'none' : 'grayscale(1) opacity(0.3)' }}>↻</div>
          <div className="text-[8px] font-bold" style={{ color: !isPos ? negColor : negColor + '40' }}>−</div>
          <div className="text-[7px] font-mono" style={{ color: !isPos ? negColor + 'cc' : negColor + '30' }}>negative</div>
        </div>
      </div>

      {/* Semantics + trigger */}
      {loopSem[active] && (
        <div className="relative text-[8px] text-white/35 text-center">{loopSem[active]}</div>
      )}
      {trigger?.guard && (
        <div className="relative flex justify-center">
          <GuardPill guard={trigger.guard} />
        </div>
      )}
    </div>
  )
}

// ── execution: OutcomeTree ────────────────────────────────────────
function OutcomeTree({ vis }: { vis: Record<string, unknown> }) {
  const stateColors = (vis.state_colors as Record<string, string>) ?? {}
  const transitions = (vis.transitions as Transition[]) ?? []
  const terminal = (vis.terminal as string[]) ?? []

  const [pulseRetry, setPulseRetry] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setPulseRetry(p => !p), 900)
    return () => clearInterval(t)
  }, [])

  const retryColor   = stateColors['retrying'] ?? '#f59e0b'
  const successColor = stateColors['success']  ?? '#10b981'
  const failColor    = stateColors['failure']  ?? '#ef4444'

  const toSuccess = transitions.find(t => t.to === 'success')
  const toFailure = transitions.find(t => t.to === 'failure')

  return (
    <div className="relative space-y-2 p-2 rounded" style={{ background: '#0a0f1a' }}>
      <ScanlineBg color={retryColor} />

      <div className="relative flex items-center gap-2">
        <LiveBadge label="SCHEMA" />
        <span className="text-[8px] text-white/25 font-mono">execution · guarded by V</span>
      </div>

      {/* Tree layout */}
      <div className="relative flex flex-col items-center gap-2">

        {/* Retrying node */}
        <div
          className="px-3 py-1.5 rounded text-[9px] font-mono font-bold transition-all duration-500"
          style={{
            background: retryColor + (pulseRetry ? '20' : '10'),
            border: `1px solid ${retryColor + (pulseRetry ? '70' : '30')}`,
            color: retryColor + (pulseRetry ? 'ff' : 'aa'),
            boxShadow: pulseRetry ? `0 0 8px ${retryColor}30` : 'none',
          }}
        >
          ↻ retrying
        </div>

        {/* Branch arrows */}
        <div className="flex items-start gap-8">
          {/* Success branch */}
          <div className="flex flex-col items-center gap-1">
            <div className="flex flex-col items-center">
              <div className="w-px h-3" style={{ background: successColor + '30' }} />
              <div className="text-[8px]" style={{ color: successColor + '60' }}>↙</div>
            </div>
            <div
              className="px-2.5 py-1 rounded text-[9px] font-mono font-bold"
              style={{
                background: successColor + '15',
                border: `1px solid ${successColor + '50'}`,
                color: successColor,
              }}
            >
              ✓ success
            </div>
            {toSuccess?.guard && (
              <GuardPill guard={toSuccess.guard} />
            )}
            <div className="text-[7px] font-mono" style={{ color: successColor + '40' }}>terminal</div>
          </div>

          {/* Failure branch */}
          <div className="flex flex-col items-center gap-1">
            <div className="flex flex-col items-center">
              <div className="w-px h-3" style={{ background: failColor + '30' }} />
              <div className="text-[8px]" style={{ color: failColor + '60' }}>↘</div>
            </div>
            <div
              className="px-2.5 py-1 rounded text-[9px] font-mono font-bold"
              style={{
                background: failColor + '15',
                border: `1px solid ${failColor + '50'}`,
                color: failColor,
              }}
            >
              ✗ failure
            </div>
            {toFailure?.guard && (
              <GuardPill guard={toFailure.guard} />
            )}
            <div className="text-[7px] font-mono" style={{ color: failColor + '50' }}>
              → retry ↺
            </div>
          </div>
        </div>
      </div>

      {/* Terminal states note */}
      {terminal.length > 0 && (
        <div className="relative text-[7px] text-white/20 font-mono text-center">
          terminal: {terminal.join(', ')}
        </div>
      )}
    </div>
  )
}

// ── 通用状态图（旧条目兼容） ──────────────────────────────────────
function GenericStateDiagram({
  states,
  transitions,
}: {
  states: string[]
  transitions?: Transition[]
}) {
  const [activeIdx, setActiveIdx] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setActiveIdx(i => (i + 1) % states.length), 1400)
    return () => clearInterval(t)
  }, [states.length])

  const S_COLOR = '#10b981'
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <LiveBadge />
        <span className="text-[9px] text-white/30">agent-driven</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {states.map((s, i) => (
          <div
            key={s}
            className="px-1.5 py-0.5 rounded text-[9px] font-mono transition-all duration-700"
            style={{
              background: i === activeIdx ? S_COLOR + '22' : S_COLOR + '08',
              border: `1px solid ${i === activeIdx ? S_COLOR + '80' : S_COLOR + '20'}`,
              color: i === activeIdx ? S_COLOR : S_COLOR + '55',
              boxShadow: i === activeIdx ? `0 0 8px ${S_COLOR}30` : 'none',
            }}
          >
            {i === activeIdx ? '●' : '○'} {s}
          </div>
        ))}
      </div>
      {transitions?.length ? (
        <div className="text-[8px] text-white/20 font-mono">
          {transitions.length} transitions
        </div>
      ) : null}
    </div>
  )
}

// ── AI 认知态（confidence） ───────────────────────────────────────
function AiStateView({ vis }: { vis: Record<string, unknown> }) {
  const confidence = vis.confidence as number
  const source = vis.source as string | undefined
  const S_COLOR = '#10b981'
  const pct = Math.round(confidence * 100)
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <LiveBadge />
        {source && (
          <span
            className="text-[8px] font-mono px-1 py-px rounded"
            style={{ background: '#8b5cf620', color: '#c4b5fd', border: '1px solid #8b5cf630' }}
          >
            {source}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="text-[9px] text-white/40 shrink-0">confidence</div>
        <div className="flex-1 h-1.5 rounded overflow-hidden"
          style={{ background: S_COLOR + '18', border: `1px solid ${S_COLOR}28` }}>
          <div className="h-full rounded" style={{ width: `${pct}%`, background: S_COLOR }} />
        </div>
        <div className="text-[10px] font-mono font-bold shrink-0" style={{ color: S_COLOR }}>{pct}%</div>
      </div>
    </div>
  )
}

// ── 迁移规则列表 ──────────────────────────────────────────────────
function TransitionRules({ rules }: { rules: Array<{ trigger: string; condition?: string; action: string }> }) {
  const S_COLOR = '#10b981'
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <LiveBadge label="RULES" />
      </div>
      {rules.slice(0, 3).map((r, i) => (
        <div key={i} className="flex items-center gap-1 text-[8px] font-mono overflow-hidden">
          <span className="shrink-0" style={{ color: S_COLOR + 'cc' }}>{r.trigger}</span>
          <span className="text-white/15 shrink-0">→</span>
          <span className="text-white/40 truncate">{r.action}</span>
        </div>
      ))}
      {rules.length > 3 && <div className="text-[8px] text-white/20">+{rules.length - 3} more</div>}
    </div>
  )
}

// ── 主导出 ────────────────────────────────────────────────────────
export function StateMachineVisual({ vis, layer }: Props) {
  const dimension = vis.dimension as string | undefined

  // 三维度专属视觉
  if (dimension === 'lifecycle') return <DirectedFlow vis={vis} />
  if (dimension === 'feedback')  return <FeedbackLoop vis={vis} />
  if (dimension === 'execution') return <OutcomeTree vis={vis} />

  // 通用 fallback（兼容旧条目）
  const states     = vis.states as string[] | undefined
  const transitions = vis.transitions as Transition[] | undefined
  const confidence = vis.confidence as number | undefined
  const rules      = vis.rules as Array<{ trigger: string; action: string }> | undefined

  if (states?.length)     return <GenericStateDiagram states={states} transitions={transitions} />
  if (confidence !== undefined) return <AiStateView vis={vis} />
  if (rules?.length)      return <TransitionRules rules={rules} />

  return (
    <div className="flex items-center gap-2">
      <LiveBadge />
      <span className="text-[9px] font-mono text-white/30">{layer || 'dynamic'}</span>
    </div>
  )
}
