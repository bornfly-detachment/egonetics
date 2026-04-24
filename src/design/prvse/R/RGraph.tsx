/**
 * RGraph — Relation layer minimal flow graph
 * Clean node-edge graph: start → classifier → branches.
 * Reference: IR.png (if/else routing), workflow.png (DAG)
 */
import { cn } from '@/lib/utils'

export type RNodeType = 'start' | 'agent' | 'condition' | 'action' | 'end'

export interface RNode {
  id: string
  type: RNodeType
  label: string
  sublabel?: string
  meta?: string
}

export interface REdge {
  from: string
  to: string
  label?: string
}

const NODE_STYLE: Record<RNodeType, string> = {
  start:     'bg-prvse-p/10 border-prvse-p/40 text-prvse-p',
  agent:     'bg-prvse-r/10 border-prvse-r/40 text-prvse-r',
  condition: 'bg-prvse-v/10 border-prvse-v/40 text-prvse-v',
  action:    'bg-prvse-s/10 border-prvse-s/40 text-prvse-s',
  end:       'bg-muted border-border text-muted-foreground',
}

const NODE_ICON: Record<RNodeType, string> = {
  start: '▶',
  agent: '⟳',
  condition: '⇄',
  action: '⚡',
  end: '◼',
}

interface RNodeCardProps {
  node: RNode
  compact?: boolean
}

function RNodeCard({ node, compact }: RNodeCardProps) {
  return (
    <div className={cn(
      'inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium',
      'bg-background shadow-sm',
      compact ? 'px-2.5 py-1.5 text-xs' : ''
    )}>
      <span className={cn(
        'flex-none w-6 h-6 rounded-lg flex items-center justify-center text-[11px] border',
        NODE_STYLE[node.type]
      )}>
        {NODE_ICON[node.type]}
      </span>
      <div className="min-w-0">
        <p className="text-foreground font-medium truncate leading-tight">{node.label}</p>
        {node.sublabel && (
          <p className="text-[10px] text-muted-foreground leading-tight">{node.sublabel}</p>
        )}
      </div>
    </div>
  )
}

interface RConditionCardProps {
  node: RNode
  branches: Array<{ label?: string; targets: RNode[] }>
}

function RConditionCard({ node, branches }: RConditionCardProps) {
  return (
    <div className="flex items-start gap-6">
      {/* Condition node */}
      <div className={cn(
        'flex-none px-3 py-2.5 rounded-xl border bg-background shadow-sm min-w-[180px]'
      )}>
        <div className="flex items-center gap-2 mb-1.5">
          <span className={cn('w-5 h-5 rounded-md flex items-center justify-center text-[10px] border', NODE_STYLE.condition)}>
            {NODE_ICON.condition}
          </span>
          <span className="text-sm font-medium text-foreground">{node.label}</span>
        </div>
        {node.meta && (
          <p className="text-[11px] text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
            {node.meta}
          </p>
        )}
      </div>

      {/* Branches */}
      <div className="flex flex-col gap-4 justify-center">
        {branches.map((branch, i) => (
          <div key={i} className="flex items-center gap-3">
            {/* Connector line */}
            <div className="flex items-center gap-1">
              <div className="w-8 h-px bg-border" />
              {branch.label && (
                <span className="text-[10px] text-muted-foreground px-1">{branch.label}</span>
              )}
              <div className="w-4 h-px bg-border" />
            </div>
            {/* Target nodes */}
            <div className="flex flex-col gap-2">
              {branch.targets.map(target => (
                <RNodeCard key={target.id} node={target} compact />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export interface RGraphProps {
  nodes: RNode[]
  edges: REdge[]
  className?: string
}

export function RGraph({ nodes, edges, className }: RGraphProps) {
  const nodeMap = new Map(nodes.map(n => [n.id, n]))

  // Simple linear + branch layout detection
  const startNode = nodes.find(n => n.type === 'start')

  // Build adjacency
  const outEdges = new Map<string, REdge[]>()
  for (const edge of edges) {
    if (!outEdges.has(edge.from)) outEdges.set(edge.from, [])
    outEdges.get(edge.from)!.push(edge)
  }

  // Render as horizontal chain
  const linearChain: RNode[] = []
  const visited = new Set<string>()

  function walk(id: string) {
    if (visited.has(id)) return
    visited.add(id)
    const node = nodeMap.get(id)
    if (!node) return
    if (node.type !== 'condition') {
      linearChain.push(node)
      const nexts = outEdges.get(id) ?? []
      const next = nexts.find(e => nodeMap.get(e.to)?.type !== 'condition' && nodeMap.get(e.to)?.type !== 'end')
        ?? nexts.find(e => nodeMap.get(e.to)?.type === 'condition')
        ?? nexts[0]
      if (next) walk(next.to)
    }
  }

  if (startNode) walk(startNode.id)

  return (
    <div className={cn('bg-background rounded-xl border border-border p-6 overflow-x-auto', className)}>
      <div className="flex items-center gap-3 flex-nowrap">
        {linearChain.map((node, i) => (
          <div key={node.id} className="flex items-center gap-3 flex-none">
            {node.type === 'condition' ? (
              <RConditionCard
                node={node}
                branches={(outEdges.get(node.id) ?? []).map(e => ({
                  label: e.label,
                  targets: [nodeMap.get(e.to)].filter(Boolean) as RNode[],
                }))}
              />
            ) : (
              <RNodeCard node={node} />
            )}
            {i < linearChain.length - 1 && (
              <div className="flex-none w-6 h-px bg-border" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
