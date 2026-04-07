/**
 * ProvenancePanel — 通用溯源+Chronicle面板（R 的子集）
 * 回答"从哪来"：溯源链、版本历史、血统树、冻结/Fork/继承
 */
import { useState } from 'react'
import { GitBranch, Lock, GitFork, History, ChevronDown, ChevronRight, ExternalLink, User, Cpu, Box, Radio } from 'lucide-react'
import type { ProvenanceData, Origin } from '@prvse/types'

// ── 溯源链节点 ──────────────────────────────────────────────────
function OriginNode({ origin, depth = 0 }: { origin: Origin; depth?: number }) {
  const domainIcon = origin.domain === 'internal'
    ? <Box size={10} className="text-emerald-400/70" />
    : <ExternalLink size={10} className="text-amber-400/70" />

  const sourceIcon: Record<string, React.ReactNode> = {
    user_input: <User size={10} className="text-blue-400/60" />,
    model_call: <Cpu size={10} className="text-purple-400/60" />,
    module_output: <Box size={10} className="text-emerald-400/60" />,
    system_event: <Radio size={10} className="text-cyan-400/60" />,
  }

  return (
    <div style={{ paddingLeft: depth * 16 }}>
      <div className="flex items-center gap-1.5 py-1">
        {depth > 0 && <span className="text-white/15 text-[10px]">└→</span>}
        {domainIcon}
        {sourceIcon[origin.source] ?? <Box size={10} className="text-white/45" />}
        <span className="text-[10px] font-mono text-white/50">{origin.source}</span>
        {origin.label && (
          <span className="text-[10px] text-white/45 truncate max-w-[180px]">{origin.label}</span>
        )}
      </div>
      {origin.chain?.map((child, i) => (
        <OriginNode key={i} origin={child} depth={depth + 1} />
      ))}
    </div>
  )
}

// ── 主组件 ──────────────────────────────────────────────────────
interface ProvenancePanelProps {
  data: ProvenanceData
  accentColor?: string
  onFork?: () => void
  onFreeze?: () => void
  onInherit?: () => void
}

export default function ProvenancePanel({ data, accentColor = '#60a5fa', onFork, onFreeze, onInherit }: ProvenancePanelProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border-t border-white/[0.04]">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/[0.02] transition-colors"
      >
        <GitBranch size={11} style={{ color: accentColor }} className="opacity-60" />
        <span className="text-[10px] font-mono text-white/40">溯源 + Chronicle</span>
        <span className="ml-auto flex items-center gap-1.5 text-[9px] text-white/40">
          v{data.version ?? 1}
          {data.frozen && <Lock size={8} className="text-amber-400/50" />}
          {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        </span>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3">
          {/* 溯源链 */}
          <div>
            <div className="text-[9px] text-white/40 mb-1 uppercase tracking-wider">Origin Chain</div>
            <div className="rounded-lg bg-white/[0.02] border border-white/[0.05] px-2 py-1.5">
              <OriginNode origin={data.origin} />
            </div>
          </div>

          {/* Chronicle 快照 */}
          {data.chronicle && (
            <div>
              <div className="text-[9px] text-white/40 mb-1 uppercase tracking-wider">Chronicle Snapshot</div>
              <div className="rounded-lg bg-white/[0.02] border border-white/[0.05] px-2.5 py-2 space-y-1.5">
                <div>
                  <span className="text-[9px] text-white/45">设计思路: </span>
                  <span className="text-[10px] text-white/65">{data.chronicle.designRationale}</span>
                </div>
                <div>
                  <span className="text-[9px] text-white/45">功能: </span>
                  <span className="text-[10px] text-white/65">{data.chronicle.functionalSpec}</span>
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[9px] text-white/45">依赖: </span>
                  {data.chronicle.dependencies.map(d => (
                    <span key={d} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/[0.04] text-white/40 border border-white/[0.06]">
                      {d}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[9px] text-white/45">宪法: </span>
                  {data.chronicle.constitutionBindings.map(c => (
                    <span key={c} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/[0.06] text-emerald-400/50 border border-emerald-500/[0.12]">
                      {c}
                    </span>
                  ))}
                </div>
                {data.chronicle.sourceRef && (
                  <div className="text-[9px] font-mono text-white/40 truncate">
                    ref: {data.chronicle.sourceRef}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-2">
            {onInherit && !data.frozen && (
              <button onClick={onInherit} className="flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-medium bg-white/[0.04] border border-white/[0.08] text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors">
                <History size={9} /> 继承+魔改
              </button>
            )}
            {onFreeze && !data.frozen && (
              <button onClick={onFreeze} className="flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-medium bg-white/[0.04] border border-white/[0.08] text-white/40 hover:text-amber-400/70 hover:bg-amber-500/[0.06] transition-colors">
                <Lock size={9} /> 冻结
              </button>
            )}
            {onFork && (
              <button onClick={onFork} className="flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-medium bg-white/[0.04] border border-white/[0.08] text-white/40 hover:text-purple-400/70 hover:bg-purple-500/[0.06] transition-colors">
                <GitFork size={9} /> Fork
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
