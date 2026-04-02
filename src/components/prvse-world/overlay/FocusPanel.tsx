/**
 * FocusPanel — DOM overlay for inspecting/acting on a focused control node
 *
 * Context-aware: shows different actions depending on the dimension
 * (时间/资源/目标/宪法) and the node's metadata.
 */

import { useEffect, useRef } from 'react'
import { X, ChevronRight, ExternalLink, Play, AlertTriangle } from 'lucide-react'
import type { PrvseNode } from '../types'
import { useTranslation } from '@/lib/translations'

interface FocusPanelProps {
  node: PrvseNode
  path: PrvseNode[]
  screenX: number
  screenY: number
  onCommit: (nodeId: string, patch: { name?: string; color?: string }) => void
  onClose: () => void
}

/** Extract meta from node id patterns */
function inferMeta(node: PrvseNode): Record<string, unknown> {
  const id = node.id
  if (id.startsWith('task-'))     return { type: 'task', taskId: id.replace('task-', '') }
  if (id.startsWith('run-'))      return { type: 'execution', runId: id.replace(/^run-(t[012]-|active-)?/, '') }
  if (id.startsWith('contract-')) return { type: 'contract', contractId: id.replace('contract-', '') }
  if (id.startsWith('audit-'))    return { type: 'decision', runId: id.replace('audit-', '') }
  if (id.startsWith('mq-'))       return { type: 'mq' }
  if (id.startsWith('mid-'))      return { type: 'cybernetics' }
  if (id.startsWith('const-p-'))  return { type: 'principle' }
  if (id.startsWith('dim-'))      return { type: 'dimension' }
  if (id.startsWith('res-'))      return { type: 'resource' }
  return {}
}

/** Dimension label from root path — uses translations */
function getDimensionLabel(path: PrvseNode[], dims: Record<string, string>): string {
  if (path.length === 0) return ''
  const rootId = path[0].id
  if (rootId === 'dim-constitution') return dims.constitution
  if (rootId === 'dim-resources') return dims.resources
  if (rootId === 'dim-goals') return dims.goals
  return ''
}

export default function FocusPanel({
  node,
  path,
  screenX,
  screenY,
  onClose,
}: FocusPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const { t } = useTranslation()
  const meta = inferMeta(node)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const style: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(screenX + 20, window.innerWidth - 340),
    top: Math.max(20, Math.min(screenY - 60, window.innerHeight - 320)),
    zIndex: 1000,
  }

  const dimLabel = getDimensionLabel(path, t.prvse.dimensions)

  return (
    <div
      ref={panelRef}
      style={style}
      className="w-[300px] bg-[#111318]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden"
      onClick={e => e.stopPropagation()}
    >
      {/* Breadcrumb path */}
      <div className="px-3 pt-3 pb-2 flex items-center gap-1 text-[10px] text-white/30 overflow-x-auto">
        {dimLabel && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/40 shrink-0">
            {dimLabel}
          </span>
        )}
        {path.map((p, i) => (
          <span key={p.id} className="flex items-center gap-1 shrink-0">
            {i > 0 && <ChevronRight size={8} className="text-white/15" />}
            <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
            <span className="truncate max-w-[80px]">{p.name}</span>
          </span>
        ))}
      </div>

      <div className="h-px bg-white/[0.06]" />

      {/* Node info */}
      <div className="p-3 space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full shrink-0" style={{ background: node.color }} />
          <span className="text-sm font-medium text-white">{node.name}</span>
        </div>

        {/* Context-specific content */}
        {meta.type === 'task' && <TaskPanel taskId={meta.taskId as string} t={t} />}
        {meta.type === 'execution' && <ExecutionPanel t={t} />}
        {meta.type === 'contract' && <ContractPanel contractId={meta.contractId as string} t={t} />}
        {meta.type === 'decision' && <DecisionPanel t={t} />}
        {meta.type === 'mq' && <MQPanel node={node} t={t} />}
        {meta.type === 'cybernetics' && <CyberneticsPanel node={node} t={t} />}
        {meta.type === 'principle' && <PrinciplePanel node={node} t={t} />}
        {meta.type === 'dimension' && <DimensionPanel node={node} t={t} />}
        {meta.type === 'resource' && <ResourcePanel node={node} t={t} />}

        {/* Depth/children meta */}
        <div className="flex items-center gap-3 text-[10px] text-white/20">
          <span>{t.focusPanel.depth}: {node.depth}</span>
          <span>{t.focusPanel.children}: {node.children.length}</span>
        </div>

        {/* Close */}
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
          >
            <X size={12} className="inline mr-1" />{t.common.close}
          </button>
          {meta.type === 'task' && (
            <a
              href={`/tasks/${meta.taskId}`}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-cyan-400/70 hover:text-cyan-300 hover:bg-cyan-500/10 transition-colors"
            >
              <ExternalLink size={11} />{t.focusPanel.openTask}
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Context Panels ──────────────────────────────────────────────

type T = import('@/lib/translations').Translation

function TaskPanel({ taskId, t }: { taskId: string; t: T }) {
  return (
    <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-2.5 space-y-1">
      <div className="text-[10px] text-white/40 uppercase tracking-wider">{t.focusPanel.taskLabel}</div>
      <div className="text-[11px] text-white/60 font-mono">{taskId}</div>
      <div className="flex gap-1.5 mt-1.5">
        <a href={`/tasks/${taskId}`}
          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-cyan-500/10 text-cyan-400/80 border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors">
          <ExternalLink size={9} />{t.common.details}
        </a>
        <button className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-violet-500/10 text-violet-400/80 border border-violet-500/20 hover:bg-violet-500/20 transition-colors">
          <Play size={9} />{t.common.execute}
        </button>
      </div>
    </div>
  )
}

function ExecutionPanel({ t }: { t: T }) {
  return (
    <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-2.5">
      <div className="text-[10px] text-white/40 uppercase tracking-wider">{t.focusPanel.executionEngine}</div>
      <div className="text-[11px] text-white/50 mt-1">{t.focusPanel.executionStatus}</div>
    </div>
  )
}

function ContractPanel({ contractId, t }: { contractId: string; t: T }) {
  return (
    <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-2.5 space-y-1">
      <div className="text-[10px] text-white/40 uppercase tracking-wider">{t.focusPanel.kernelContract}</div>
      <div className="text-[11px] text-white/60 font-mono">{contractId}</div>
      <div className="text-[10px] text-white/30">{t.focusPanel.contractDesc}</div>
    </div>
  )
}

function DecisionPanel({ t }: { t: T }) {
  return (
    <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5 space-y-1">
      <div className="flex items-center gap-1.5 text-[10px] text-amber-400 uppercase tracking-wider">
        <AlertTriangle size={10} />{t.focusPanel.humanDecision}
      </div>
      <div className="text-[11px] text-white/50">{t.focusPanel.humanInterventionDesc}</div>
    </div>
  )
}

function MQPanel({ node, t }: { node: PrvseNode; t: T }) {
  return (
    <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-2.5 space-y-1">
      <div className="text-[10px] text-white/40 uppercase tracking-wider">{t.focusPanel.messageQueue}</div>
      <div className="text-[11px] text-white/60">{node.name}</div>
      <div className="text-[10px] text-white/30">{t.focusPanel.mqDesc}</div>
    </div>
  )
}

function CyberneticsPanel({ node, t }: { node: PrvseNode; t: T }) {
  return (
    <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-2.5 space-y-1">
      <div className="text-[10px] text-white/40 uppercase tracking-wider">{t.focusPanel.cyberneticsComponent}</div>
      <div className="text-[11px] text-white/60 leading-relaxed">
        {t.focusPanel.cyberneticsDesc[node.id] ?? node.name}
      </div>
    </div>
  )
}

function PrinciplePanel({ node, t }: { node: PrvseNode; t: T }) {
  return (
    <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-2.5 space-y-1">
      <div className="text-[10px] text-red-400 uppercase tracking-wider">{t.focusPanel.principleTitle}</div>
      <div className="text-[11px] text-white/60">{node.name}</div>
      <div className="text-[10px] text-white/30">{t.focusPanel.principleDesc}</div>
    </div>
  )
}

function DimensionPanel({ node, t }: { node: PrvseNode; t: T }) {
  return (
    <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-2.5">
      <div className="text-[11px] text-white/60 leading-relaxed">
        {t.focusPanel.dimensionDesc[node.id] ?? ''}
      </div>
    </div>
  )
}

function ResourcePanel({ node, t }: { node: PrvseNode; t: T }) {
  return (
    <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-2.5">
      <div className="text-[10px] text-white/40 uppercase tracking-wider">{t.focusPanel.resourceTier}</div>
      <div className="text-[11px] text-white/50 mt-1">{node.name}</div>
    </div>
  )
}
