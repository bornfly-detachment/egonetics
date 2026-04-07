/**
 * MountPanel — 通用挂载面板（R 的子集）
 * 回答"可以连接什么"：AOP/Hook、宪法绑定、通信端口、Skill/工具
 */
import { useState } from 'react'
import { Plug, ChevronDown, ChevronRight, Anchor, Zap, ArrowRight, ArrowLeft, Wrench } from 'lucide-react'
import type { MountData, CheckResult } from '@prvse/types'

const STATUS_ICON: Record<CheckResult, { icon: string; color: string }> = {
  pass: { icon: '✅', color: '#4ade80' },
  fail: { icon: '❌', color: '#f87171' },
  warn: { icon: '⚠', color: '#facc15' },
  pending: { icon: '⏳', color: '#94a3b8' },
}

interface MountPanelProps {
  data: MountData
  accentColor?: string
}

export default function MountPanel({ data, accentColor = '#60a5fa' }: MountPanelProps) {
  const [open, setOpen] = useState(false)
  const activeCount = data.aopHooks.filter(h => h.active).length
    + data.ports.length
    + data.skills.filter(s => s.active).length

  return (
    <div className="border-t border-white/[0.04]">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/[0.02] transition-colors"
      >
        <Plug size={11} style={{ color: accentColor }} className="opacity-60" />
        <span className="text-sm font-semibold font-mono text-white/80">挂载</span>
        <span className="ml-auto flex items-center gap-1.5 text-sm text-white/70">
          {activeCount} active
          {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        </span>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3">
          {/* AOP Hooks */}
          {data.aopHooks.length > 0 && (
            <div>
              <div className="flex items-center gap-1 mb-1">
                <Zap size={9} className="text-amber-400/50" />
                <span className="text-xs font-semibold text-white/75 uppercase tracking-wider">AOP / Hook</span>
              </div>
              <div className="space-y-0.5">
                {data.aopHooks.map(hook => (
                  <div key={hook.id} className="flex items-center gap-2 text-sm">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${hook.active ? 'bg-emerald-400' : 'bg-white/15'}`} />
                    <span className="font-mono text-white/75 w-10 shrink-0">{hook.type}</span>
                    <span className="font-mono text-white/65 truncate">{hook.target}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 宪法绑定 */}
          {data.constitutionBindings.length > 0 && (
            <div>
              <div className="flex items-center gap-1 mb-1">
                <Anchor size={9} className="text-emerald-400/50" />
                <span className="text-xs font-semibold text-white/75 uppercase tracking-wider">宪法</span>
              </div>
              <div className="space-y-0.5">
                {data.constitutionBindings.map(binding => {
                  const st = STATUS_ICON[binding.status]
                  return (
                    <div key={binding.ruleId} className="flex items-center gap-2 text-sm">
                      <span className="shrink-0">{st.icon}</span>
                      <span className="font-mono text-white/65 w-16 shrink-0">{binding.ruleId}</span>
                      <span className="text-white/75 truncate">{binding.description}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 通信端口 */}
          {data.ports.length > 0 && (
            <div>
              <div className="flex items-center gap-1 mb-1">
                <Plug size={9} className="text-blue-400/50" />
                <span className="text-xs font-semibold text-white/75 uppercase tracking-wider">端口</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {data.ports.map((port, i) => (
                  <span
                    key={i}
                    className="flex items-center gap-1 text-xs font-mono px-1.5 py-0.5 rounded border bg-white/[0.03] text-white/70 border-white/[0.08]"
                  >
                    {port.direction === 'out' ? <ArrowRight size={8} /> : <ArrowLeft size={8} />}
                    {port.targetType}:{port.target}
                    <span className="text-white/70">{port.edgeType}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Skill/工具 */}
          {data.skills.length > 0 && (
            <div>
              <div className="flex items-center gap-1 mb-1">
                <Wrench size={9} className="text-purple-400/50" />
                <span className="text-xs font-semibold text-white/75 uppercase tracking-wider">Skill / 工具</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {data.skills.map(skill => (
                  <span
                    key={skill.id}
                    className={`text-xs font-mono px-1.5 py-0.5 rounded border ${
                      skill.active
                        ? 'bg-purple-500/[0.06] text-purple-400/60 border-purple-500/20'
                        : 'bg-white/[0.03] text-white/70 border-white/[0.06]'
                    }`}
                  >
                    {skill.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
