/**
 * ResourcePanel — 通用完备资源管理面板（系统级 P）
 * 回答"是什么"：文件路径、权限、存储/内存、AI Tier、依赖
 */
import { useState } from 'react'
import { HardDrive, Shield, Cpu, Link, ChevronDown, ChevronRight, FolderOpen } from 'lucide-react'
import type { ResourceData, AuthorityLevel, AITier } from '@prvse/types'

const A_LABELS: Record<AuthorityLevel, { label: string; color: string }> = {
  A0: { label: 'A0 执行', color: '#94a3b8' },
  A1: { label: 'A1 推理', color: '#60a5fa' },
  A2: { label: 'A2 进化', color: '#c084fc' },
  A3: { label: 'A3 生变', color: '#f59e0b' },
}

const T_LABELS: Record<AITier, { label: string; color: string }> = {
  T0: { label: 'T0 本地', color: '#94a3b8' },
  T1: { label: 'T1 推理', color: '#60a5fa' },
  T2: { label: 'T2 战略', color: '#c084fc' },
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

interface ResourcePanelProps {
  data: ResourceData
  accentColor?: string
}

export default function ResourcePanel({ data, accentColor = '#60a5fa' }: ResourcePanelProps) {
  const [open, setOpen] = useState(false)
  const a = A_LABELS[data.authority]
  const t = T_LABELS[data.aiTier]

  return (
    <div className="border-t border-white/[0.04]">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/[0.02] transition-colors"
      >
        <HardDrive size={11} style={{ color: accentColor }} className="opacity-60" />
        <span className="text-[10px] font-mono text-white/40">资源</span>
        <span className="ml-auto flex items-center gap-2 text-[9px]">
          <span className="font-mono px-1.5 py-0.5 rounded border" style={{ color: a.color, borderColor: `${a.color}30`, background: `${a.color}08` }}>
            {a.label}
          </span>
          <span className="font-mono px-1.5 py-0.5 rounded border" style={{ color: t.color, borderColor: `${t.color}30`, background: `${t.color}08` }}>
            {t.label}
          </span>
          {open ? <ChevronDown size={10} className="text-white/40" /> : <ChevronRight size={10} className="text-white/40" />}
        </span>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2">
          {/* 文件路径 */}
          <div className="flex items-center gap-1.5">
            <FolderOpen size={10} className="text-white/40 shrink-0" />
            <span className="text-[9px] font-mono text-white/30 truncate">{data.filePath}</span>
          </div>

          {/* 权限 + AI */}
          <div className="flex gap-3">
            <div className="flex items-center gap-1.5">
              <Shield size={10} className="text-white/40" />
              <span className="text-[10px] font-mono" style={{ color: a.color }}>{a.label}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Cpu size={10} className="text-white/40" />
              <span className="text-[10px] font-mono" style={{ color: t.color }}>{t.label}</span>
            </div>
          </div>

          {/* 存储/内存 */}
          <div className="flex gap-4 text-[10px] font-mono">
            <div>
              <span className="text-white/40">存储: </span>
              <span className="text-white/50">{formatBytes(data.storage)}</span>
            </div>
            {data.memoryUsage != null && (
              <div>
                <span className="text-white/40">内存: </span>
                <span className="text-white/50">{formatBytes(data.memoryUsage)}</span>
              </div>
            )}
          </div>

          {/* 依赖 */}
          {data.dependencies.length > 0 && (
            <div>
              <div className="flex items-center gap-1 mb-1">
                <Link size={9} className="text-white/40" />
                <span className="text-[9px] text-white/40">依赖</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {data.dependencies.map(dep => (
                  <span key={dep} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/[0.04] text-white/40 border border-white/[0.06]">
                    {dep}
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
