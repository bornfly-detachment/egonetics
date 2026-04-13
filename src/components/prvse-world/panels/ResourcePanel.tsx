/**
 * ResourcePanel — PRVSE Graph 树形展开视图
 *
 * 数据源: /api/resources/graph → pr-graph.json
 * 交互: 点击节点原地展开子节点，不换页
 */

import { useState, useEffect, useCallback } from 'react'
import { ChevronDown, ChevronRight, Layers, RefreshCw, Circle, Server, Terminal, Container } from 'lucide-react'
import { authFetch } from '@/lib/http'

interface PortInfo { port: number; name: string; alive: boolean }
interface TmuxSession { name: string; user: string; socket: string }
interface DockerContainer { name: string; status: string; ports: string }
interface RuntimeStatus {
  ports: PortInfo[]
  tmux: TmuxSession[]
  docker: DockerContainer[]
  health: number
  system: { pressure: { memory: number; swap: number; cpu: number } }
}

// ── PRVS Runtime types ──────────────────────────────────────────

interface ServiceState { p: string; type: string; alive: boolean; at: string; port?: number; container?: string }
interface RuntimeSnapshot {
  at: string
  services: ServiceState[]
  tmux: TmuxSession[]
  docker: DockerContainer[]
  summary: { total: number; alive: number; dead: number }
}
interface GateStatus { enabled: boolean; running: boolean; intervalMs: number; lastRunAt: string | null; stats: { ticks: number; skipped: number; errors: number } }
interface RuntimeJob {
  id: string; name: string; enabled: boolean
  schedule: { kind: string; everyMs?: number; expr?: string }
  state: { nextRunAtMs: number | null; lastStatus: string | null; consecutiveErrors: number; lastDurationMs: number | null }
}

// ── Types ────────────────────────────────────────────────────────

interface GraphNode {
  id: string
  level: string
  children?: string[]
  dir?: string
  file?: string
  relations?: Record<string, string[]>
}

interface GraphEdge {
  from: string
  type: string
  to: string
}

// ── Style ────────────────────────────────────────────────────────

const LEVEL_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  L2: { color: '#c084fc', bg: 'rgba(192,132,252,0.08)', border: 'rgba(192,132,252,0.2)' },
  L1: { color: '#60a5fa', bg: 'rgba(96,165,250,0.08)', border: 'rgba(96,165,250,0.2)' },
  L0: { color: '#94a3b8', bg: 'rgba(148,163,184,0.06)', border: 'rgba(148,163,184,0.15)' },
}

const REL_COLOR: Record<string, string> = {
  depends_on: '#94a3b8',
  serves: '#22c55e',
  constrains: '#ef4444',
  exists_because: '#c084fc',
  validates: '#f59e0b',
  falls_back_to: '#f97316',
  triggers: '#06b6d4',
}

function displayName(id: string): string {
  return id.replace(/^[PRVSE]-L[012](-[A-Z]+)?_/, '').replace(/-/g, ' ')
}

// ── 递归节点 ─────────────────────────────────────────────────────

function PRNode({
  nodeId, depth, nodeMap, edgeMap, loadChildren, sphereColor,
}: {
  nodeId: string
  depth: number
  nodeMap: Map<string, GraphNode>
  edgeMap: Map<string, GraphEdge[]>
  loadChildren: (parentId: string) => Promise<void>
  sphereColor: string
}) {
  const [expanded, setExpanded] = useState(depth === 0) // L2 默认展开
  const [childrenLoaded, setChildrenLoaded] = useState(false)
  const [loading, setLoading] = useState(false)

  const node = nodeMap.get(nodeId)
  if (!node) return null

  const style = LEVEL_STYLE[node.level] || LEVEL_STYLE.L0
  const hasChildren = (node.children?.length ?? 0) > 0
  const outEdges = edgeMap.get(nodeId) || []

  const toggle = useCallback(async () => {
    if (hasChildren && !childrenLoaded) {
      setLoading(true)
      await loadChildren(nodeId)
      setChildrenLoaded(true)
      setLoading(false)
    }
    setExpanded(v => !v)
  }, [hasChildren, childrenLoaded, nodeId, loadChildren])

  const indent = depth * 16

  return (
    <>
      {/* Node row */}
      <button
        onClick={toggle}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all hover:brightness-110 mb-1"
        style={{ background: style.bg, border: `1px solid ${style.border}`, marginLeft: indent }}
      >
        {/* Expand icon */}
        {hasChildren ? (
          loading
            ? <RefreshCw size={11} className="animate-spin shrink-0" style={{ color: style.color }} />
            : expanded
              ? <ChevronDown size={11} className="shrink-0" style={{ color: style.color }} />
              : <ChevronRight size={11} className="shrink-0" style={{ color: style.color }} />
        ) : (
          <span className="w-[11px] shrink-0" />
        )}

        {/* Level badge */}
        <span
          className="text-[9px] font-mono font-bold px-1 py-0.5 rounded shrink-0"
          style={{ color: style.color, background: `${style.color}15` }}
        >
          {node.level}
        </span>

        {/* Name */}
        <span className="text-[12px] font-mono font-medium text-white/80 flex-1 text-left truncate">
          {displayName(nodeId)}
        </span>

        {/* File/dir */}
        {node.file && <span className="text-[9px] font-mono text-white/20 shrink-0">{node.file}</span>}
        {node.dir && !node.file && <span className="text-[9px] font-mono text-white/20 shrink-0">{node.dir}</span>}

        {/* Children count */}
        {hasChildren && (
          <span className="text-[9px] font-mono text-white/25 shrink-0">{node.children!.length}</span>
        )}
      </button>

      {/* Relations (always show if node is expanded and has relations) */}
      {expanded && outEdges.length > 0 && (
        <div className="mb-1 space-y-0.5" style={{ marginLeft: indent + 28 }}>
          {outEdges.map((e, i) => (
            <div key={i} className="flex items-center gap-1.5 text-[9px] font-mono">
              <span style={{ color: REL_COLOR[e.type] || '#6b7280' }}>{e.type}</span>
              <span className="text-white/30">&rarr;</span>
              <span className="text-white/40">{displayName(e.to)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Children (recursive) */}
      {expanded && hasChildren && node.children!.map(childId => (
        <PRNode
          key={childId}
          nodeId={childId}
          depth={depth + 1}
          nodeMap={nodeMap}
          edgeMap={edgeMap}
          loadChildren={loadChildren}
          sphereColor={sphereColor}
        />
      ))}
    </>
  )
}

// ── 主组件 ───────────────────────────────────────────────────────

interface ResourcePanelProps {
  sphereColor?: string
}

export default function ResourcePanel({ sphereColor = '#7dd3fc' }: ResourcePanelProps) {
  const [nodeMap, setNodeMap] = useState<Map<string, GraphNode>>(new Map())
  const [edgeMap, setEdgeMap] = useState<Map<string, GraphEdge[]>>(new Map())
  const [rootIds, setRootIds] = useState<string[]>([])
  const [runtime, setRuntime] = useState<RuntimeStatus | null>(null)
  const [snapshot, setSnapshot] = useState<RuntimeSnapshot | null>(null)
  const [gate, setGate] = useState<GateStatus | null>(null)
  const [jobs, setJobs] = useState<RuntimeJob[]>([])
  const [loading, setLoading] = useState(true)

  const [graphExpanded, setGraphExpanded] = useState(false)
  const [runtimeExpanded, setRuntimeExpanded] = useState(false)
  const graphLoadedRef = useRef(false)
  const runtimeLoadedRef = useRef(false)
  const runtimeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // PRVSE Graph — 按需加载（展开时才请求）
  useEffect(() => {
    if (!graphExpanded || graphLoadedRef.current) return
    graphLoadedRef.current = true
    setLoading(true)
    authFetch<{ nodes: GraphNode[]; edges: GraphEdge[] }>('/resources/graph?level=L2')
      .then(graphData => {
        const nm = new Map<string, GraphNode>()
        const em = new Map<string, GraphEdge[]>()
        for (const n of graphData.nodes) nm.set(n.id, n)
        for (const e of graphData.edges) {
          if (!em.has(e.from)) em.set(e.from, [])
          em.get(e.from)!.push(e)
        }
        setNodeMap(nm)
        setEdgeMap(em)
        setRootIds(graphData.nodes.map(n => n.id))
      })
      .catch(err => console.error('[ResourcePanel] graph load failed:', err))
      .finally(() => setLoading(false))
  }, [graphExpanded])

  // PRVS Runtime — 按需加载（展开时才请求 + 30s 轮询）
  useEffect(() => {
    if (!runtimeExpanded) {
      if (runtimeTimerRef.current) { clearInterval(runtimeTimerRef.current); runtimeTimerRef.current = null }
      return
    }

    async function loadRuntime() {
      try {
        const statusData = await authFetch<{ gate: GateStatus; jobs: RuntimeJob[] }>('/resources/runtime/status')
        setGate(statusData.gate)
        setJobs(statusData.jobs)
      } catch (err) {
        console.error('[ResourcePanel] runtime status failed:', err)
      }
      try {
        const snapshotData = await authFetch<RuntimeSnapshot>('/resources/runtime/snapshot')
        setSnapshot(snapshotData)
      } catch (err) {
        console.error('[ResourcePanel] snapshot failed:', err)
      }
      try {
        const res = await authFetch<RuntimeStatus>('/resources/status')
        setRuntime(res)
      } catch { /* optional */ }
    }

    loadRuntime()
    runtimeTimerRef.current = setInterval(loadRuntime, 30000)
    return () => { if (runtimeTimerRef.current) clearInterval(runtimeTimerRef.current) }
  }, [runtimeExpanded])

  // 懒加载子节点
  const loadChildren = useCallback(async (parentId: string) => {
    const parentNode = nodeMap.get(parentId)
    if (!parentNode?.children?.length) return

    const level = parentNode.level === 'L2' ? 'L1' : 'L0'
    try {
      const data = await authFetch<{ nodes: GraphNode[]; edges: GraphEdge[] }>(
        `/resources/graph?level=${level}&parent=${parentId}`
      )
      setNodeMap(prev => {
        const next = new Map(prev)
        for (const n of data.nodes) {
          if (n.id !== parentId) next.set(n.id, n)
        }
        return next
      })
      setEdgeMap(prev => {
        const next = new Map(prev)
        for (const e of data.edges) {
          if (!next.has(e.from)) next.set(e.from, [])
          const arr = next.get(e.from)!
          if (!arr.some(x => x.to === e.to && x.type === e.type)) arr.push(e)
        }
        return next
      })
    } catch (err) {
      console.error('[ResourcePanel] loadChildren failed:', err)
    }
  }, [nodeMap])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3.5 py-2.5 shrink-0" style={{ borderBottom: `1px solid ${sphereColor}15` }}>
        <Layers size={13} style={{ color: sphereColor }} />
        <span className="text-[13px] font-mono font-semibold" style={{ color: `${sphereColor}cc` }}>
          Resource
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 min-h-0">
        {/* ── PRVSE Graph 折叠区 ──────────────────────── */}
        <button
          onClick={() => setGraphExpanded(v => !v)}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg mb-1 transition-all hover:brightness-110"
          style={{ background: `${sphereColor}08`, border: `1px solid ${sphereColor}15` }}
        >
          {graphExpanded
            ? <ChevronDown size={11} style={{ color: sphereColor }} />
            : <ChevronRight size={11} style={{ color: sphereColor }} />}
          <Layers size={10} style={{ color: sphereColor }} />
          <span className="text-[11px] font-mono text-white/60">PRVSE Graph</span>
          {loading && graphExpanded && <RefreshCw size={9} className="animate-spin text-white/20 ml-auto" />}
          {!graphExpanded && nodeMap.size > 0 && <span className="text-[9px] font-mono text-white/20 ml-auto">{nodeMap.size} nodes</span>}
        </button>
        {graphExpanded && rootIds.map(id => (
          <PRNode
            key={id}
            nodeId={id}
            depth={0}
            nodeMap={nodeMap}
            edgeMap={edgeMap}
            loadChildren={loadChildren}
            sphereColor={sphereColor}
          />
        ))}

        {/* ── PRVS Runtime 折叠区 ─────────────────────── */}
        <button
          onClick={() => setRuntimeExpanded(v => !v)}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg mb-1 mt-1 transition-all hover:brightness-110"
          style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)' }}
        >
          {runtimeExpanded
            ? <ChevronDown size={11} className="text-green-400/70" />
            : <ChevronRight size={11} className="text-green-400/70" />}
          <Server size={10} className="text-green-400/70" />
          <span className="text-[11px] font-mono text-white/60">Runtime</span>
          {snapshot && !runtimeExpanded && (
            <span className="text-[9px] font-mono text-white/20 ml-auto">
              {snapshot.summary.alive}/{snapshot.summary.total} alive
            </span>
          )}
        </button>

        {/* ── PRVS Runtime 内容（展开后显示） ──────────────── */}
        {runtimeExpanded && (
          <>
            {/* Gate control */}
            <div className="mb-2 px-1">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Circle size={6} fill={gate?.enabled ? '#22c55e' : '#6b7280'} stroke="none" />
                <span className="text-[11px] font-mono text-white/50">
                  Gate {gate?.enabled ? 'ON' : 'OFF'}
                </span>
                <button
                  onClick={async () => {
                    await authFetch(gate?.enabled ? '/resources/runtime/stop' : '/resources/runtime/start', { method: 'POST', body: JSON.stringify({ intervalMs: 600000 }), headers: { 'Content-Type': 'application/json' } })
                    const r = await authFetch<{ gate: GateStatus }>('/resources/runtime/status')
                    setGate(r.gate)
                  }}
                  className="ml-auto text-[9px] font-mono px-1.5 py-0.5 rounded border transition-colors"
                  style={{ color: sphereColor, borderColor: `${sphereColor}30`, background: `${sphereColor}08` }}
                >
                  {gate?.enabled ? 'Stop' : 'Start'}
                </button>
                <button
                  onClick={async () => {
                    await authFetch('/resources/runtime/trigger', { method: 'POST' })
                    const r = await authFetch<{ gate: GateStatus; jobs: RuntimeJob[]; snapshot: RuntimeSnapshot }>('/resources/runtime/status')
                    setGate(r.gate); setJobs(r.jobs); setSnapshot(r.snapshot)
                  }}
                  className="text-[9px] font-mono px-1.5 py-0.5 rounded border transition-colors"
                  style={{ color: '#f59e0b', borderColor: 'rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.08)' }}
                >
                  Tick
                </button>
              </div>
              {gate && (
                <div className="flex gap-3 px-2 text-[9px] font-mono text-white/25">
                  <span>ticks: {gate.stats.ticks}</span>
                  <span>interval: {Math.round(gate.intervalMs / 1000)}s</span>
                  {gate.lastRunAt && <span>last: {new Date(gate.lastRunAt).toLocaleTimeString()}</span>}
                </div>
              )}
            </div>

            {/* Services (from pr-graph.json via perceiver) */}
            <div className="mb-2 px-1">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Server size={10} className="text-white/30" />
                <span className="text-[11px] font-mono text-white/50">
                  P nodes ({snapshot.summary.alive}/{snapshot.summary.total} alive)
                </span>
              </div>
              {snapshot.services.map(s => (
                <div key={s.p} className="flex items-center gap-2 px-2 py-1 text-[11px] font-mono">
                  <Circle size={6} fill={s.alive ? '#22c55e' : '#ef4444'} stroke="none" />
                  <span className="text-white/60 w-10">{s.port ? `:${s.port}` : s.container || s.type}</span>
                  <span className="text-white/40 flex-1 truncate">{s.p.replace(/^P-L\d(-[A-Z]+)?_/, '')}</span>
                </div>
              ))}
            </div>

            {/* Jobs */}
            {jobs.length > 0 && (
              <div className="mb-2 px-1">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <RefreshCw size={10} className="text-white/30" />
                  <span className="text-[11px] font-mono text-white/50">Jobs ({jobs.length})</span>
                </div>
                {jobs.map(j => (
                  <div key={j.id} className="flex items-center gap-2 px-2 py-1 text-[10px] font-mono">
                    <Circle size={5} fill={j.state.lastStatus === 'ok' ? '#22c55e' : j.state.lastStatus === 'error' ? '#ef4444' : '#6b7280'} stroke="none" />
                    <span className="text-white/50 flex-1 truncate">{j.name}</span>
                    <span className="text-white/20">{j.schedule.kind === 'every' ? `${Math.round((j.schedule.everyMs || 0) / 60000)}m` : j.schedule.expr || j.schedule.kind}</span>
                    {j.state.consecutiveErrors > 0 && <span className="text-red-400/60">x{j.state.consecutiveErrors}</span>}
                  </div>
                ))}
              </div>
            )}

            {/* tmux */}
            {snapshot.tmux.length > 0 && (
              <div className="mb-2 px-1">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Terminal size={10} className="text-white/30" />
                  <span className="text-[11px] font-mono text-white/50">tmux ({snapshot.tmux.length})</span>
                </div>
                {snapshot.tmux.map(s => (
                  <div key={s.name + s.user} className="flex items-center gap-2 px-2 py-1 text-[10px] font-mono">
                    <Circle size={5} fill="#22c55e" stroke="none" />
                    <span className="text-white/50 flex-1 truncate">{s.name}</span>
                    <span className="text-white/25">{s.user}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Docker */}
            {snapshot.docker.length > 0 && (
              <div className="mb-2 px-1">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Container size={10} className="text-white/30" />
                  <span className="text-[11px] font-mono text-white/50">docker ({snapshot.docker.length})</span>
                </div>
                {snapshot.docker.map(c => (
                  <div key={c.name} className="flex items-center gap-2 px-2 py-1 text-[10px] font-mono">
                    <Circle size={5} fill={c.status.startsWith('Up') ? '#22c55e' : '#ef4444'} stroke="none" />
                    <span className="text-white/50 flex-1 truncate">{c.name.replace('images-penpot-', 'penpot/')}</span>
                    <span className="text-white/25">{c.status.split('(')[0].trim()}</span>
                  </div>
                ))}
              </div>
            )}

            {/* System pressure (from original runtime) */}
            {runtime && (
              <div className="px-1 mt-2 flex gap-3 text-[9px] font-mono text-white/25">
                <span>MEM {runtime.system.pressure.memory}%</span>
                <span>SWAP {runtime.system.pressure.swap}%</span>
                <span>CPU {runtime.system.pressure.cpu}%</span>
                <span>Health {runtime.health}%</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
