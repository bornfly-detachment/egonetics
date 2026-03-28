/**
 * VRewardVisual — Layer 3
 * V = {objective, external, internal} 三维奖励向量的可视化
 *
 * 路由：
 *   layer='v1'  + display → V1MetricDisplay
 *   layer='v2'/'v3'       → VProbDisplay
 *   layer='phi'            → PhiFunctionDisplay
 */
import { useState, useEffect } from 'react'

// ── V 维度配色 ────────────────────────────────────────────────────
const DIM: Record<string, { color: string; bg: string; label: string }> = {
  v1:  { color: '#3b82f6', bg: '#1a2a44', label: 'V1 · objective' },
  v2:  { color: '#8b5cf6', bg: '#221a44', label: 'V2 · external'  },
  v3:  { color: '#10b981', bg: '#0a2a1a', label: 'V3 · internal'  },
  phi: { color: '#f59e0b', bg: '#2a200a', label: 'φ · factor'     },
}

function DimBadge({ dim }: { dim: string }) {
  const d = DIM[dim] ?? DIM.v1
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-[7px] font-bold tracking-wide shrink-0"
      style={{ background: d.color + '18', color: d.color, border: `1px solid ${d.color}35` }}
    >
      {d.label}
    </span>
  )
}

// ── V1 MetricDisplay ──────────────────────────────────────────────
function CounterWidget() {
  const [count, setCount] = useState(42)
  useEffect(() => {
    const t = setInterval(() => setCount(c => c + Math.floor(Math.random() * 3)), 1200)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="flex items-center gap-2">
      <div
        className="px-2 py-1 rounded font-mono text-[13px] font-bold tabular-nums"
        style={{ background: '#3b82f615', color: '#93c5fd', border: '1px solid #3b82f630' }}
      >
        {count.toString().padStart(4, '0')}
      </div>
      <span className="text-[8px] text-white/25">uint · count</span>
    </div>
  )
}

function TimerWidget() {
  const [ms, setMs] = useState(3725.4)
  useEffect(() => {
    const t = setInterval(() => setMs(m => m + 0.1), 100)
    return () => clearInterval(t)
  }, [])
  const h = Math.floor(ms / 3600)
  const m = Math.floor((ms % 3600) / 60)
  const s = (ms % 60).toFixed(1)
  return (
    <div className="flex items-center gap-2">
      <div
        className="px-2 py-1 rounded font-mono text-[11px] tabular-nums"
        style={{ background: '#3b82f615', color: '#93c5fd', border: '1px solid #3b82f630' }}
      >
        {h > 0 ? `${h}:` : ''}{m.toString().padStart(2,'0')}:{s.toString().padStart(4,'0')}
      </div>
      <span className="text-[8px] text-white/25">float · /s</span>
    </div>
  )
}

function TokenWidget() {
  const [inp, setInp] = useState(12.3)
  const [out, setOut] = useState(4.7)
  useEffect(() => {
    const t = setInterval(() => {
      setInp(v => parseFloat((v + 0.1).toFixed(1)))
      setOut(v => parseFloat((v + 0.04).toFixed(2)))
    }, 800)
    return () => clearInterval(t)
  }, [])
  const fmt = (n: number) => n >= 1000 ? (n/1000).toFixed(1)+'M' : n.toFixed(1)+'K'
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-[10px]"
        style={{ background: '#3b82f612', color: '#93c5fd', border: '1px solid #3b82f628' }}
      >
        <span className="text-[8px] opacity-60">▲</span>{fmt(inp)}
      </div>
      <div
        className="flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-[10px]"
        style={{ background: '#8b5cf612', color: '#c4b5fd', border: '1px solid #8b5cf628' }}
      >
        <span className="text-[8px] opacity-60">▼</span>{fmt(out)}
      </div>
      <span className="text-[8px] text-white/25">K|M|B</span>
    </div>
  )
}

function ProbabilityBar({ value = 0.7023 }: { value?: number }) {
  const pct = value * 100
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <div
          className="flex-1 h-2 rounded overflow-hidden"
          style={{ background: '#3b82f610', border: '1px solid #3b82f625' }}
        >
          <div
            className="h-full rounded transition-all duration-500"
            style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #3b82f6, #60a5fa)' }}
          />
        </div>
        <span className="font-mono text-[10px] font-bold tabular-nums shrink-0" style={{ color: '#93c5fd' }}>
          {value.toFixed(2)}
        </span>
        <span className="text-[9px] text-white/35 shrink-0">{pct.toFixed(2)}%</span>
      </div>
      <div className="text-[7px] text-white/20">float [0,1] · precision: 2</div>
    </div>
  )
}

function BinaryIndicator() {
  const [val, setVal] = useState(1)
  useEffect(() => {
    const t = setInterval(() => setVal(v => 1 - v), 1800)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex items-center gap-1.5 px-2.5 py-1 rounded transition-all duration-500"
        style={{
          background: val === 1 ? '#10b98120' : '#10b98108',
          border: `1px solid ${val === 1 ? '#10b98160' : '#10b98120'}`,
        }}
      >
        <span className="text-[14px]" style={{ filter: val === 1 ? 'none' : 'grayscale(1) opacity(0.3)' }}>✅</span>
        <span className="font-mono text-[9px]" style={{ color: val === 1 ? '#10b981' : '#10b98140' }}>1</span>
      </div>
      <div
        className="flex items-center gap-1.5 px-2.5 py-1 rounded transition-all duration-500"
        style={{
          background: val === 0 ? '#ef444420' : '#ef444408',
          border: `1px solid ${val === 0 ? '#ef444460' : '#ef444420'}`,
        }}
      >
        <span className="text-[14px]" style={{ filter: val === 0 ? 'none' : 'grayscale(1) opacity(0.3)' }}>❎</span>
        <span className="font-mono text-[9px]" style={{ color: val === 0 ? '#ef4444' : '#ef444440' }}>0</span>
      </div>
      <span className="text-[8px] text-white/25">0/1 signal</span>
    </div>
  )
}

export function V1MetricDisplay({ vis }: { vis: Record<string, unknown> }) {
  const display = vis.display as string
  const examples = (vis.examples as string[]) ?? []

  return (
    <div className="space-y-2">
      <DimBadge dim="v1" />
      <div>
        {display === 'counter'           && <CounterWidget />}
        {display === 'timer'             && <TimerWidget />}
        {display === 'token_pair'        && <TokenWidget />}
        {display === 'probability_bar'   && <ProbabilityBar />}
        {display === 'binary_indicator'  && <BinaryIndicator />}
      </div>
      {examples.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {examples.slice(0, 3).map(ex => (
            <span key={ex}
              className="px-1 py-px rounded text-[7px] font-mono"
              style={{ background: '#3b82f608', color: '#93c5fd50', border: '1px solid #3b82f615' }}
            >
              {ex}
            </span>
          ))}
          {examples.length > 3 && (
            <span className="text-[7px] text-white/20">+{examples.length - 3}</span>
          )}
        </div>
      )}
    </div>
  )
}

// ── V2 / V3 ProbDisplay ───────────────────────────────────────────
export function VProbDisplay({ vis, layer }: { vis: Record<string, unknown>; layer: string }) {
  const dim = DIM[layer] ?? DIM.v2
  const metric = vis.metric as string
  const semantic = vis.semantic as string | undefined
  const phiCapable = (vis.phi_capable as string[]) ?? []
  const note = vis.note as string | undefined

  // Simulate a live probability value
  const [prob, setProb] = useState(0.73)
  useEffect(() => {
    const t = setInterval(() => {
      setProb(p => Math.max(0.1, Math.min(0.99, p + (Math.random() - 0.5) * 0.06)))
    }, 1400)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="space-y-2">
      <DimBadge dim={layer} />

      {/* metric name */}
      <div
        className="inline-block px-1.5 py-0.5 rounded font-mono text-[9px] font-bold"
        style={{ background: dim.color + '12', color: dim.color, border: `1px solid ${dim.color}28` }}
      >
        {metric}
      </div>

      {/* Animated probability bar */}
      <div className="flex items-center gap-2">
        <div
          className="flex-1 h-1.5 rounded overflow-hidden"
          style={{ background: dim.color + '10', border: `1px solid ${dim.color}20` }}
        >
          <div
            className="h-full rounded transition-all duration-700"
            style={{ width: `${prob * 100}%`, background: dim.color }}
          />
        </div>
        <span
          className="font-mono text-[10px] font-bold tabular-nums shrink-0"
          style={{ color: dim.color }}
        >
          {prob.toFixed(2)}
        </span>
        <span className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0" style={{ background: dim.color }} />
      </div>

      {/* Semantic */}
      {semantic && (
        <div className="text-[8px] text-white/30 leading-snug">{semantic}</div>
      )}

      {/* φ capable chips */}
      {phiCapable.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <span className="text-[7px] text-white/20 self-center">φ:</span>
          {phiCapable.map(phi => (
            <span key={phi}
              className="px-1 py-px rounded text-[7px] font-mono"
              style={{ background: '#f59e0b10', color: '#fcd34d60', border: '1px solid #f59e0b20' }}
            >
              {phi}
            </span>
          ))}
        </div>
      )}

      {note && <div className="text-[7px] italic text-white/20">{note}</div>}
    </div>
  )
}

// ── φ Function Display ────────────────────────────────────────────
export function PhiFunctionDisplay({ vis }: { vis: Record<string, unknown> }) {
  const phi    = vis.phi       as string
  const formula = vis.formula  as string
  const formulaNote = vis.formula_note as string | undefined
  const semantic = vis.semantic as string | undefined
  const rEdges = (vis.r_edge_mapping as string[]) ?? []

  return (
    <div className="space-y-2">
      <DimBadge dim="phi" />

      {/* φ name */}
      <div
        className="font-mono text-[11px] font-bold"
        style={{ color: '#fcd34d' }}
      >
        {phi}
      </div>

      {semantic && (
        <div className="text-[8px] text-white/40">{semantic}</div>
      )}

      {/* Formula */}
      <div
        className="px-2 py-1.5 rounded font-mono text-[9px] leading-relaxed"
        style={{
          background: '#f59e0b08',
          border: '1px solid #f59e0b20',
          color: '#fcd34dcc',
        }}
      >
        {formula}
      </div>

      {formulaNote && (
        <div className="text-[7px] text-white/25 italic">{formulaNote}</div>
      )}

      {/* R edge mappings */}
      {rEdges.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[7px] text-white/20">R →</span>
          {rEdges.map(e => (
            <span key={e}
              className="px-1 py-px rounded text-[7px] font-mono"
              style={{ background: '#8b5cf610', color: '#c4b5fd60', border: '1px solid #8b5cf625' }}
            >
              {e}
            </span>
          ))}
          <span className="text-[7px] text-white/15">1:N</span>
        </div>
      )}

      <div className="text-[7px] font-mono text-white/20">output ∈ [0, 1]</div>
    </div>
  )
}
