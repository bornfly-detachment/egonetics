/**
 * OntologyView — 生变论控制论本体可视化 + 完整 CRUD
 * 路由：/ontology
 * 一切节点、边、层、边类型均可被人和机器修改
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ReactFlow, Background, BackgroundVariant, Controls, MiniMap,
  Node, Edge, Handle, Position, NodeProps, EdgeProps,
  useNodesState, useEdgesState,
  MarkerType, BaseEdge, getSmoothStepPath,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  fetchOntology,
  createNode, updateNode, deleteNode,
  createEdge, updateEdge, deleteEdge,
  createLayer, updateLayer, deleteLayer,
  createEdgeType, updateEdgeType, deleteEdgeType,
  type OntologyNode, type OntologyEdge,
  type OntologyData, type OntologyLayer, type OntologyEdgeType,
} from '@/lib/api/ontology'
import { X, Edit2, Trash2, Plus, Check, GitBranch, Layers, Search, Filter, Info,
         ChevronDown, ChevronRight, PanelLeft, Network, ArrowRightLeft, Tag } from 'lucide-react'

// ─── 动态样式：从 edge_types 构建，静态 fallback ──────────────────────────

const FALLBACK_EDGE_STYLE: Record<string, { color: string; dash?: boolean; label: string }> = {
  CONSTRAINS:      { color: '#ef4444', label: '约束'    },
  DEPENDS_ON:      { color: '#6b7280', label: '依赖'    },
  DERIVES_FROM:    { color: '#3b82f6', label: '派生自'  },
  FEEDBACK_TO:     { color: '#8b5cf6', dash: true, label: '反馈至' },
  EVALUATES_VIA:   { color: '#f97316', label: '经由评价'},
  IMPLEMENTS:      { color: '#22c55e', label: '实现'    },
  PROTECTS:        { color: '#16a34a', label: '保护'    },
  FILTERS_THROUGH: { color: '#06b6d4', label: '过滤进入'},
  TRIGGERED_BY:    { color: '#eab308', dash: true, label: '触发'  },
  CALLED_BY:       { color: '#14b8a6', label: '被调用'  },
  PARTICIPATES:    { color: '#ec4899', dash: true, label: '参与'  },
  APPLIES_TO:      { color: '#a78bfa', label: '作用于'  },
}

function getEdgeStyle(edgeTypes: OntologyEdgeType[], type: string) {
  const et = edgeTypes.find(t => t.id === type)
  if (et) return { color: et.color, dash: et.dash, label: et.label }
  return FALLBACK_EDGE_STYLE[type] ?? { color: '#94a3b8', label: type }
}

// ─── 层颜色（暖色调，不透明实体色）──────────────────────────────────────
const LAYER_PALETTE: Record<number, { bg: string; border: string; text: string; accent: string }> = {
  0: { bg: '#3d1578', border: '#9333ea', text: '#f3e8ff', accent: '#a855f7' },
  1: { bg: '#7c1818', border: '#ef4444', text: '#ffe4e4', accent: '#f87171' },
  2: { bg: '#1a3a7a', border: '#3b82f6', text: '#dbeafe', accent: '#60a5fa' },
  3: { bg: '#1a5c2a', border: '#22c55e', text: '#dcfce7', accent: '#4ade80' },
  4: { bg: '#0e4a5a', border: '#06b6d4', text: '#cffafe', accent: '#22d3ee' },
  5: { bg: '#6b3a00', border: '#f59e0b', text: '#fef3c7', accent: '#fbbf24' },
  6: { bg: '#4a0e5e', border: '#a855f7', text: '#fae8ff', accent: '#c084fc' },
  7: { bg: '#6b1638', border: '#f43f5e', text: '#ffe4e6', accent: '#fb7185' },
  8: { bg: '#3a3530', border: '#a8a29e', text: '#e7e5e4', accent: '#d6d3d1' },
}

function layerStyle(node: OntologyNode) {
  return LAYER_PALETTE[node.layerIndex ?? 8] ?? LAYER_PALETTE[8]
}

// ─── 节点宽度估算（按文本长度自适应）────────────────────────────────────
const NODE_H   = 52
const H_GAP    = 28
const V_GAP    = 90

function estimateNodeWidth(n: OntologyNode): number {
  // 中文字符约14px，英文约9px，加左右padding 32px
  let w = 32
  for (const ch of n.name) {
    w += ch.charCodeAt(0) > 127 ? 16 : 10
  }
  return Math.max(80, Math.min(240, w))
}

// ─── 布局算法（每行宽度按文本自适应）────────────────────────────────────
function computeLayout(apiNodes: OntologyNode[]): Node[] {
  const byLayer: Record<number, OntologyNode[]> = {}
  for (const n of apiNodes) {
    const idx = n.layerIndex ?? 8
    ;(byLayer[idx] ??= []).push(n)
  }

  // 各层总宽
  const layerRowWidths: Record<number, number> = {}
  for (const [layerStr, layerNodes] of Object.entries(byLayer)) {
    const layer = Number(layerStr)
    layerRowWidths[layer] = layerNodes.reduce((sum, n) => sum + estimateNodeWidth(n), 0)
      + Math.max(0, layerNodes.length - 1) * H_GAP
  }
  const totalWidth = Math.max(...Object.values(layerRowWidths), 1)

  const rfNodes: Node[] = []
  for (const [layerStr, layerNodes] of Object.entries(byLayer)) {
    const layer    = Number(layerStr)
    const rowWidth = layerRowWidths[layer]
    let x = (totalWidth - rowWidth) / 2
    layerNodes.forEach(n => {
      const nw = estimateNodeWidth(n)
      rfNodes.push({
        id:   n.id,
        type: 'ontologyNode',
        position: { x, y: layer * (NODE_H + V_GAP) },
        data: n as unknown as Record<string, unknown>,
      })
      x += nw + H_GAP
    })
  }
  return rfNodes
}

// ─── 边构建 ──────────────────────────────────────────────────────────────
function buildEdges(apiEdges: OntologyEdge[], visibleIds: Set<string>, edgeTypes: OntologyEdgeType[]): Edge[] {
  return apiEdges
    .filter(e => visibleIds.has(e.source) && visibleIds.has(e.target))
    .map(e => {
      const style = getEdgeStyle(edgeTypes, e.type)
      return {
        id:     e.id,
        source: e.source,
        target: e.target,
        type:   'ontologyEdge',
        style:  { stroke: style.color, strokeWidth: 1.8,
                  strokeDasharray: style.dash ? '6,4' : undefined },
        markerEnd: { type: MarkerType.ArrowClosed, color: style.color, width: 12, height: 12 },
        data: { edgeData: e } as Record<string, unknown>,
      }
    })
}

// ─── 自定义节点（简洁居中，暖色实体，自适应宽度）────────────────────────
function OntologyNodeComponent({ data, selected }: NodeProps) {
  const n  = data as unknown as OntologyNode
  const ls = layerStyle(n)
  return (
    <div style={{
      minWidth: 80,
      maxWidth: 240,
      width: 'max-content',
      minHeight: NODE_H,
      background: ls.bg,
      border: `2px solid ${selected ? '#fff' : ls.border}`,
      borderRadius: 10,
      boxShadow: selected
        ? `0 0 0 3px ${ls.accent}66, 0 0 24px ${ls.accent}55`
        : `0 3px 10px rgba(0,0,0,0.5), inset 0 1px 0 ${ls.accent}30`,
      padding: '10px 18px',
      cursor: 'pointer',
      transition: 'box-shadow 0.15s',
      textAlign: 'center',
    }}>
      <Handle type="target" position={Position.Top}    style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      <div style={{
        color: ls.text,
        fontWeight: 700,
        fontSize: 15,
        lineHeight: 1.4,
        fontFamily: 'Inter, sans-serif',
        whiteSpace: 'nowrap',
      }}>
        {n.name}
      </div>
    </div>
  )
}

// ─── 自定义边（可点击选中）────────────────────────────────────────────────
function OntologyEdgeComponent(props: EdgeProps) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
          style, markerEnd, data } = props
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
  })
  return (
    <BaseEdge
      path={edgePath}
      labelX={labelX}
      labelY={labelY}
      style={style}
      markerEnd={markerEnd}
      label={(data as { edgeData?: { type?: string } })?.edgeData?.type}
    />
  )
}

const nodeTypes = { ontologyNode: OntologyNodeComponent }
const edgeTypes = { ontologyEdge: OntologyEdgeComponent }

// ─── 工具函数 ─────────────────────────────────────────────────────────────
function jsonOrStr(val: unknown): string {
  if (val === null || val === undefined) return ''
  if (typeof val === 'string') return val
  return JSON.stringify(val, null, 2)
}
function parseJsonField(str: string): unknown {
  if (!str.trim()) return undefined
  try { return JSON.parse(str) } catch { return str }
}

// ─── 内联编辑行 ───────────────────────────────────────────────────────────
function EditField({ label, value, onChange, multiline = false, mono = false }:
  { label: string; value: string; onChange: (v: string) => void; multiline?: boolean; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs font-mono uppercase tracking-widest mb-1 opacity-40 text-white">{label}</div>
      {multiline ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          rows={4}
          className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm text-white/85 outline-none focus:border-white/30 resize-y"
          style={{ fontFamily: mono ? 'JetBrains Mono, monospace' : 'inherit', fontSize: 12 }}
        />
      ) : (
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm text-white/85 outline-none focus:border-white/30"
          style={{ fontFamily: mono ? 'JetBrains Mono, monospace' : 'inherit' }}
        />
      )}
    </div>
  )
}

// ─── 节点详情/编辑面板 ────────────────────────────────────────────────────
function NodePanel({
  node, allEdges, allNodes, edgeTypeList, layers,
  onClose, onUpdated, onDeleted, onAddEdge,
}: {
  node:         OntologyNode
  allEdges:     OntologyEdge[]
  allNodes:     OntologyNode[]
  edgeTypeList: OntologyEdgeType[]
  layers:       OntologyLayer[]
  onClose:      () => void
  onUpdated:    (n: OntologyNode) => void
  onDeleted:    (id: string) => void
  onAddEdge:    (sourceId: string) => void
}) {
  const ls = layerStyle(node)
  const [editing,  setEditing]  = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saving,   setSaving]   = useState(false)

  // 编辑态字段
  const [fname,        setFname]        = useState(node.name)
  const [ftype,        setFtype]        = useState(node.type ?? '')
  const [flayer,       setFlayer]       = useState(node.layer)
  const [fdesc,        setFdesc]        = useState(jsonOrStr(node.description))
  const [fformal,      setFformal]      = useState(node.formal ?? '')
  const [fnote,        setFnote]        = useState(node.note ?? '')
  const [fpattern,     setFpattern]     = useState(jsonOrStr(node.pattern))
  const [fcausality,   setFcausality]   = useState(jsonOrStr(node.causality))
  const [fvalue,       setFvalue]       = useState(jsonOrStr(node.value))
  const [fintent,      setFintent]      = useState(jsonOrStr(node.intent))

  // 重置表单为当前 node 值
  useEffect(() => {
    setFname(node.name); setFtype(node.type ?? '')
    setFlayer(node.layer); setFdesc(jsonOrStr(node.description))
    setFformal(node.formal ?? ''); setFnote(node.note ?? '')
    setFpattern(jsonOrStr(node.pattern)); setFcausality(jsonOrStr(node.causality))
    setFvalue(jsonOrStr(node.value)); setFintent(jsonOrStr(node.intent))
    setEditing(false); setDeleting(false)
  }, [node.id])

  async function handleSave() {
    setSaving(true)
    try {
      const layerObj = layers.find(l => l.id === flayer)
      const patch: Partial<OntologyNode> = {
        name:      fname,
        type:      ftype || undefined,
        layer:     flayer,
        layerIndex: layerObj?.layer ?? node.layerIndex,
        layerLabel: layerObj?.label ?? node.layerLabel,
        description: fdesc || undefined,
        formal:    fformal || undefined,
        note:      fnote   || undefined,
        pattern:   parseJsonField(fpattern)   as OntologyNode['pattern'],
        causality: parseJsonField(fcausality) as OntologyNode['causality'],
        value:     parseJsonField(fvalue)     as OntologyNode['value'],
        intent:    parseJsonField(fintent)    as OntologyNode['intent'],
      }
      const updated = await updateNode(node.id, patch)
      onUpdated(updated)
      setEditing(false)
    } catch (e) {
      alert('保存失败：' + String(e))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setSaving(true)
    try {
      await deleteNode(node.id)
      onDeleted(node.id)
    } catch (e) {
      alert('删除失败：' + String(e))
    } finally {
      setSaving(false)
    }
  }

  const outgoing = allEdges.filter(e => e.source === node.id)
  const incoming = allEdges.filter(e => e.target === node.id)
  function nodeName(id: string) { return allNodes.find(n => n.id === id)?.name ?? id }

  return (
    <div className="flex flex-col h-full overflow-hidden"
         style={{ background: '#0d0d0d', borderLeft: `1px solid ${ls.border}33` }}>
      {/* 头部 */}
      <div className="flex items-start justify-between p-4 pb-3 shrink-0"
           style={{ borderBottom: `1px solid ${ls.border}33` }}>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-mono mb-1" style={{ color: ls.accent }}>
            L{node.layerIndex} · {node.layerLabel} · {node.type}
          </div>
          <div className="font-semibold text-base leading-tight" style={{ color: ls.text }}>
            {node.name}
          </div>
          <div className="text-xs font-mono mt-0.5 opacity-40 text-white">{node.id}</div>
        </div>
        <div className="flex items-center gap-1 ml-2 shrink-0">
          {!editing && (
            <button onClick={() => setEditing(true)}
                    className="p-1.5 rounded hover:bg-white/10 text-white/40 hover:text-violet-300">
              <Edit2 size={13} />
            </button>
          )}
          {!deleting && !editing && (
            <button onClick={() => setDeleting(true)}
                    className="p-1.5 rounded hover:bg-white/10 text-white/40 hover:text-red-400">
              <Trash2 size={13} />
            </button>
          )}
          <button onClick={onClose}
                  className="p-1.5 rounded hover:bg-white/10 text-white/40 hover:text-white/80">
            <X size={13} />
          </button>
        </div>
      </div>

      {/* 删除确认 */}
      {deleting && !editing && (
        <div className="p-4 shrink-0 border-b border-red-500/20 bg-red-950/20">
          <p className="text-sm text-red-300 mb-3">删除节点及其所有关联边，不可撤销。</p>
          <div className="flex gap-2">
            <button onClick={handleDelete} disabled={saving}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-sm rounded">
              {saving ? '删除中…' : '确认删除'}
            </button>
            <button onClick={() => setDeleting(false)}
                    className="px-3 py-1.5 border border-white/10 text-white/50 hover:text-white text-sm rounded">
              取消
            </button>
          </div>
        </div>
      )}

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {editing ? (
          /* ── 编辑模式 ── */
          <div className="space-y-3">
            <EditField label="名称"   value={fname}  onChange={setFname} />
            <EditField label="类型"   value={ftype}  onChange={setFtype} />
            <div>
              <div className="text-xs font-mono uppercase tracking-widest mb-1 opacity-40 text-white">层</div>
              <select value={flayer} onChange={e => setFlayer(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm text-white/85 outline-none">
                {layers.map(l => (
                  <option key={l.id} value={l.id}>L{l.layer} {l.label}</option>
                ))}
              </select>
            </div>
            <EditField label="描述"          value={fdesc}       onChange={setFdesc}       multiline />
            <EditField label="形式化表达"    value={fformal}     onChange={setFformal}     multiline mono />
            <EditField label="备注"          value={fnote}       onChange={setFnote}       multiline />
            <EditField label="Pattern (JSON)"   value={fpattern}   onChange={setFpattern}   multiline mono />
            <EditField label="Causality (JSON)" value={fcausality} onChange={setFcausality} multiline mono />
            <EditField label="Value (JSON)"     value={fvalue}     onChange={setFvalue}     multiline mono />
            <EditField label="Intent (JSON)"    value={fintent}    onChange={setFintent}    multiline mono />

            <div className="flex gap-2 pt-1">
              <button onClick={handleSave} disabled={saving}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-sm rounded">
                <Check size={13} />{saving ? '保存中…' : '保存'}
              </button>
              <button onClick={() => setEditing(false)}
                      className="px-3 py-1.5 border border-white/10 text-white/50 hover:text-white text-sm rounded">
                取消
              </button>
            </div>
          </div>
        ) : (
          /* ── 查看模式 ── */
          <>
            {node.description && (
              <section>
                <div className="text-xs font-mono uppercase tracking-widest mb-1.5 opacity-40 text-white">描述</div>
                <p className="text-white/75 leading-relaxed text-sm whitespace-pre-line">
                  {String(node.description)}
                </p>
              </section>
            )}
            {node.formal && (
              <section>
                <div className="text-xs font-mono uppercase tracking-widest mb-1.5 opacity-40 text-white">形式化</div>
                <pre className="text-xs rounded p-2.5 leading-relaxed overflow-x-auto"
                     style={{ background: ls.bg, color: ls.accent, border: `1px solid ${ls.border}44` }}>
                  {node.formal}
                </pre>
              </section>
            )}
            {node.note && (
              <section>
                <div className="text-xs font-mono uppercase tracking-widest mb-1.5 opacity-40 text-white">注</div>
                <p className="text-white/60 leading-relaxed italic text-sm">{node.note}</p>
              </section>
            )}
            {/* 四维 */}
            {(['pattern','causality','value','intent'] as const).map(dim => {
              const val = node[dim]
              if (!val) return null
              return (
                <DimSection key={dim} label={dim} value={val} accent={ls.accent} bg={ls.bg} border={ls.border} />
              )
            })}

            {/* 关系 */}
            <RelationSection
              label={`输出关系 (${outgoing.length})`}
              edges={outgoing}
              getNodeName={nodeName}
              edgeTypes={edgeTypeList}
              direction="out"
            />
            <RelationSection
              label={`输入关系 (${incoming.length})`}
              edges={incoming}
              getNodeName={nodeName}
              edgeTypes={edgeTypeList}
              direction="in"
            />
            <button
              onClick={() => onAddEdge(node.id)}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded border border-white/10 text-white/40 hover:text-violet-300 hover:border-violet-500/40 w-full justify-center"
            >
              <Plus size={12} />添加关系
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── 四维折叠展示 ─────────────────────────────────────────────────────────
function DimSection({ label, value, accent, bg, border }:
  { label: string; value: unknown; accent: string; bg: string; border: string }) {
  const [open, setOpen] = useState(false)
  const LABELS: Record<string, string> = {
    pattern: 'Pattern · 是什么', causality: 'Causality · 从哪来',
    value: 'Value · 值不值', intent: 'Intent · 去哪里',
  }
  return (
    <section>
      <button onClick={() => setOpen(v => !v)}
              className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest opacity-50 hover:opacity-80 text-white w-full text-left mb-1">
        {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        {LABELS[label] ?? label}
      </button>
      {open && (
        <pre className="text-xs rounded p-2.5 leading-relaxed overflow-x-auto"
             style={{ background: bg, color: accent, border: `1px solid ${border}33` }}>
          {JSON.stringify(value, null, 2)}
        </pre>
      )}
    </section>
  )
}

// ─── 关系列表 ─────────────────────────────────────────────────────────────
function RelationSection({ label, edges, getNodeName, edgeTypes, direction }:
  { label: string; edges: OntologyEdge[]; getNodeName: (id: string) => string;
    edgeTypes: OntologyEdgeType[]; direction: 'in' | 'out' }) {
  if (!edges.length) return null
  return (
    <section>
      <div className="text-xs font-mono uppercase tracking-widest mb-2 opacity-40 text-white">{label}</div>
      <div className="space-y-1.5">
        {edges.map(e => {
          const es = getEdgeStyle(edgeTypes, e.type)
          const peerId = direction === 'out' ? e.target : e.source
          return (
            <div key={e.id} className="flex items-center gap-2">
              {direction === 'in' && (
                <span className="text-white/60 truncate text-sm">{getNodeName(peerId)}</span>
              )}
              <span className="text-xs font-mono px-1.5 py-0.5 rounded shrink-0"
                    style={{ background: `${es.color}22`, color: es.color, border: `1px solid ${es.color}44` }}>
                {es.label}
              </span>
              {direction === 'out' && (
                <span className="text-white/60 truncate text-sm">{getNodeName(peerId)}</span>
              )}
              {e.conditions && (
                <span className="text-[10px] text-yellow-400/60 font-mono shrink-0">∃条件</span>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ─── 边详情面板 ───────────────────────────────────────────────────────────
function EdgePanel({ edge, allNodes, edgeTypeList, onClose, onUpdated, onDeleted }:
  { edge: OntologyEdge; allNodes: OntologyNode[]; edgeTypeList: OntologyEdgeType[];
    onClose: () => void; onUpdated: (e: OntologyEdge) => void; onDeleted: (id: string) => void }) {
  const [editing,  setEditing]  = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saving,   setSaving]   = useState(false)

  const [ftype,       setFtype]       = useState(edge.type)
  const [fstrength,   setFstrength]   = useState(String(edge.strength ?? 1.0))
  const [fconditions, setFconditions] = useState(jsonOrStr(edge.conditions))
  const [fextra,      setFextra]      = useState(() => {
    const { id: _id, source: _s, target: _t, type: _ty, strength: _st, conditions: _c, ...rest } = edge
    return jsonOrStr(Object.keys(rest).length ? rest : undefined)
  })

  useEffect(() => {
    setFtype(edge.type); setFstrength(String(edge.strength ?? 1.0))
    setFconditions(jsonOrStr(edge.conditions)); setEditing(false); setDeleting(false)
  }, [edge.id])

  const es       = getEdgeStyle(edgeTypeList, edge.type)
  const srcNode  = allNodes.find(n => n.id === edge.source)
  const tgtNode  = allNodes.find(n => n.id === edge.target)

  async function handleSave() {
    setSaving(true)
    try {
      const patch: Partial<OntologyEdge> = {
        type:       ftype,
        strength:   parseFloat(fstrength) || 1.0,
        conditions: parseJsonField(fconditions) as OntologyEdge['conditions'],
        ...(parseJsonField(fextra) as Record<string, unknown> ?? {}),
      }
      const updated = await updateEdge(edge.id, patch)
      onUpdated(updated)
      setEditing(false)
    } catch (e) { alert('保存失败：' + String(e)) }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    setSaving(true)
    try { await deleteEdge(edge.id); onDeleted(edge.id) }
    catch (e) { alert('删除失败：' + String(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden"
         style={{ background: '#0d0d0d', borderLeft: `1px solid ${es.color}33` }}>
      <div className="flex items-start justify-between p-4 pb-3 shrink-0"
           style={{ borderBottom: `1px solid ${es.color}22` }}>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-mono px-1.5 py-0.5 rounded mr-2"
                style={{ background: `${es.color}22`, color: es.color, border: `1px solid ${es.color}44` }}>
            {es.label}
          </span>
          <div className="text-sm text-white/70 mt-2 truncate">
            {srcNode?.name ?? edge.source}
            <span className="text-white/30 mx-1">→</span>
            {tgtNode?.name ?? edge.target}
          </div>
          <div className="text-xs font-mono text-white/30 mt-0.5">{edge.id}</div>
        </div>
        <div className="flex items-center gap-1 ml-2 shrink-0">
          {!editing && (
            <button onClick={() => setEditing(true)}
                    className="p-1.5 rounded hover:bg-white/10 text-white/40 hover:text-violet-300">
              <Edit2 size={13} />
            </button>
          )}
          {!deleting && !editing && (
            <button onClick={() => setDeleting(true)}
                    className="p-1.5 rounded hover:bg-white/10 text-white/40 hover:text-red-400">
              <Trash2 size={13} />
            </button>
          )}
          <button onClick={onClose}
                  className="p-1.5 rounded hover:bg-white/10 text-white/40 hover:text-white/80">
            <X size={13} />
          </button>
        </div>
      </div>

      {deleting && !editing && (
        <div className="p-4 shrink-0 border-b border-red-500/20 bg-red-950/20">
          <p className="text-sm text-red-300 mb-3">删除此边，不可撤销。</p>
          <div className="flex gap-2">
            <button onClick={handleDelete} disabled={saving}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-sm rounded">
              {saving ? '删除中…' : '确认删除'}
            </button>
            <button onClick={() => setDeleting(false)}
                    className="px-3 py-1.5 border border-white/10 text-white/50 text-sm rounded">
              取消
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {editing ? (
          <div className="space-y-3">
            <div>
              <div className="text-xs font-mono uppercase tracking-widest mb-1 opacity-40 text-white">边类型</div>
              <select value={ftype} onChange={e => setFtype(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm text-white/85 outline-none">
                {edgeTypeList.map(t => (
                  <option key={t.id} value={t.id}>{t.label} ({t.id})</option>
                ))}
              </select>
            </div>
            <EditField label="强度 (0-1)" value={fstrength} onChange={setFstrength} />
            <EditField label="Conditions (JSON 逻辑树)" value={fconditions} onChange={setFconditions} multiline mono />
            <EditField label="其他字段 (JSON)" value={fextra} onChange={setFextra} multiline mono />
            <div className="flex gap-2 pt-1">
              <button onClick={handleSave} disabled={saving}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-sm rounded">
                <Check size={13} />{saving ? '保存中…' : '保存'}
              </button>
              <button onClick={() => setEditing(false)}
                      className="px-3 py-1.5 border border-white/10 text-white/50 text-sm rounded">
                取消
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs opacity-40 text-white mb-0.5">强度</div>
                <div className="text-white/80">{edge.strength ?? 1.0}</div>
              </div>
              <div>
                <div className="text-xs opacity-40 text-white mb-0.5">类型ID</div>
                <div className="text-white/60 font-mono text-xs">{edge.type}</div>
              </div>
            </div>
            {edge.conditions && (
              <section>
                <div className="text-xs font-mono uppercase tracking-widest mb-1.5 opacity-40 text-white">条件</div>
                <pre className="text-xs rounded p-2.5 leading-relaxed overflow-x-auto text-yellow-300/80"
                     style={{ background: '#1a1400', border: '1px solid #eab30833' }}>
                  {JSON.stringify(edge.conditions, null, 2)}
                </pre>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── 新建节点对话框 ───────────────────────────────────────────────────────
function AddNodeDialog({ layers, onConfirm, onCancel }:
  { layers: OntologyLayer[]; onConfirm: (data: Partial<OntologyNode>) => Promise<void>; onCancel: () => void }) {
  const [id,    setId]    = useState('')
  const [name,  setName]  = useState('')
  const [layer, setLayer] = useState(layers[0]?.id ?? '')
  const [type,  setType]  = useState('concept')
  const [desc,  setDesc]  = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!id.trim() || !name.trim()) return
    setSaving(true)
    try {
      const layerObj = layers.find(l => l.id === layer)
      await onConfirm({
        id: id.trim(), name: name.trim(), layer,
        layerIndex: layerObj?.layer ?? 0,
        layerLabel: layerObj?.label ?? '',
        type: type.trim() || 'concept',
        description: desc.trim() || undefined,
      })
    } catch (e) { alert('创建失败：' + String(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <form onSubmit={handleSubmit}
            className="bg-[#111] border border-white/10 rounded-xl p-6 w-[400px] space-y-4 shadow-2xl">
        <div className="text-white font-semibold text-base mb-1">新建节点</div>
        <EditField label="ID (唯一，英文下划线)" value={id}    onChange={setId} />
        <EditField label="名称"                  value={name}  onChange={setName} />
        <div>
          <div className="text-xs font-mono uppercase tracking-widest mb-1 opacity-40 text-white">层</div>
          <select value={layer} onChange={e => setLayer(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm text-white/85 outline-none">
            {layers.map(l => <option key={l.id} value={l.id}>L{l.layer} {l.label}</option>)}
          </select>
        </div>
        <EditField label="类型"   value={type}  onChange={setType} />
        <EditField label="描述"   value={desc}  onChange={setDesc} multiline />
        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={saving || !id.trim() || !name.trim()}
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm rounded">
            {saving ? '创建中…' : '创建'}
          </button>
          <button type="button" onClick={onCancel}
                  className="px-4 py-2 border border-white/10 text-white/50 hover:text-white text-sm rounded">
            取消
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── 新建边对话框 ─────────────────────────────────────────────────────────
function AddEdgeDialog({ sourceId, allNodes, edgeTypeList, onConfirm, onCancel }:
  { sourceId: string; allNodes: OntologyNode[]; edgeTypeList: OntologyEdgeType[];
    onConfirm: (data: Partial<OntologyEdge>) => Promise<void>; onCancel: () => void }) {
  const [target,     setTarget]     = useState('')
  const [type,       setType]       = useState(edgeTypeList[0]?.id ?? 'DEPENDS_ON')
  const [strength,   setStrength]   = useState('1.0')
  const [conditions, setConditions] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!target) return
    setSaving(true)
    try {
      await onConfirm({
        source: sourceId, target, type,
        strength: parseFloat(strength) || 1.0,
        conditions: parseJsonField(conditions) as OntologyEdge['conditions'] | undefined,
      })
    } catch (e) { alert('创建失败：' + String(e)) }
    finally { setSaving(false) }
  }

  const srcNode = allNodes.find(n => n.id === sourceId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <form onSubmit={handleSubmit}
            className="bg-[#111] border border-white/10 rounded-xl p-6 w-[420px] space-y-4 shadow-2xl">
        <div className="text-white font-semibold text-base mb-1">
          添加关系 <span className="text-violet-300 font-normal">from {srcNode?.name ?? sourceId}</span>
        </div>
        <div>
          <div className="text-xs font-mono uppercase tracking-widest mb-1 opacity-40 text-white">目标节点</div>
          <select value={target} onChange={e => setTarget(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm text-white/85 outline-none">
            <option value="">— 选择节点 —</option>
            {allNodes.filter(n => n.id !== sourceId).map(n => (
              <option key={n.id} value={n.id}>{n.name} ({n.id})</option>
            ))}
          </select>
        </div>
        <div>
          <div className="text-xs font-mono uppercase tracking-widest mb-1 opacity-40 text-white">关系类型</div>
          <select value={type} onChange={e => setType(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm text-white/85 outline-none">
            {edgeTypeList.map(t => <option key={t.id} value={t.id}>{t.label} ({t.id})</option>)}
          </select>
        </div>
        <EditField label="强度 (0-1)"            value={strength}   onChange={setStrength} />
        <EditField label="Conditions (JSON，可空)" value={conditions} onChange={setConditions} multiline mono />
        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={saving || !target}
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm rounded">
            {saving ? '创建中…' : '添加'}
          </button>
          <button type="button" onClick={onCancel}
                  className="px-4 py-2 border border-white/10 text-white/50 hover:text-white text-sm rounded">
            取消
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── 列表管理面板 ─────────────────────────────────────────────────────────

type ListTab = 'nodes' | 'edges' | 'layers' | 'edgeTypes'

function ListPanel({
  data, selectedNodeId, selectedEdgeId,
  onSelectNode, onSelectEdge,
  onNodeDeleted,
  onEdgeDeleted,
  onAddNode, onAddEdge,
  onDataChange,
}: {
  data: OntologyData
  selectedNodeId: string | null
  selectedEdgeId: string | null
  onSelectNode:   (n: OntologyNode) => void
  onSelectEdge:   (e: OntologyEdge) => void
  onNodeDeleted:  (id: string) => void
  onEdgeDeleted:  (id: string) => void
  onAddNode:      () => void
  onAddEdge:      (fromId: string) => void
  onDataChange:   (d: OntologyData) => void
}) {
  const [tab,    setTab]    = useState<ListTab>('nodes')
  const [search, setSearch] = useState('')

  const TABS: { id: ListTab; label: string; icon: React.ReactNode; count: number }[] = [
    { id: 'nodes',     label: '节点',   icon: <Network size={13} />,        count: data.nodes.length      },
    { id: 'edges',     label: '边',     icon: <ArrowRightLeft size={13} />, count: data.edges.length      },
    { id: 'layers',    label: '层',     icon: <Layers size={13} />,         count: data.layers.length     },
    { id: 'edgeTypes', label: '边类型', icon: <Tag size={13} />,            count: data.edge_types.length },
  ]

  const q = search.trim().toLowerCase()

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] border-r border-white/[0.06]" style={{ width: 272 }}>
      {/* Tab 栏 */}
      <div className="flex border-b border-white/[0.06] shrink-0">
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setSearch('') }}
                  className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-mono transition-colors
                    ${tab === t.id ? 'text-violet-300 border-b-2 border-violet-500' : 'text-white/30 hover:text-white/60'}`}>
            {t.icon}
            <span>{t.label}</span>
            <span className={`text-[10px] ${tab === t.id ? 'text-violet-400' : 'text-white/20'}`}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* 搜索 + 新建 */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.04] shrink-0">
        <div className="flex-1 flex items-center gap-1.5 bg-white/5 rounded px-2 py-1">
          <Search size={11} className="text-white/25 shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)}
                 placeholder="搜索…"
                 className="bg-transparent text-xs text-white/65 outline-none placeholder:text-white/20 w-full" />
        </div>
        <button
          onClick={() => {
            if (tab === 'nodes')     onAddNode()
            else if (tab === 'edges') onAddEdge('')
            else if (tab === 'layers')    onDataChange({ ...data }) // handled inline below
            else if (tab === 'edgeTypes') onDataChange({ ...data })
          }}
          className="p-1.5 rounded border border-white/10 text-white/40 hover:text-violet-300 hover:border-violet-500/40"
          title="新建">
          <Plus size={13} />
        </button>
      </div>

      {/* 列表主体 */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'nodes'     && <NodeList     {...{ data, q, selectedNodeId, onSelectNode, onNodeDeleted, onAddEdge }} />}
        {tab === 'edges'     && <EdgeList     {...{ data, q, selectedEdgeId, onSelectEdge, onEdgeDeleted }} />}
        {tab === 'layers'    && <LayerList    {...{ data, q, onDataChange }} />}
        {tab === 'edgeTypes' && <EdgeTypeList {...{ data, q, onDataChange }} />}
      </div>
    </div>
  )
}

// ── 节点列表 ──────────────────────────────────────────────────────────────
function NodeList({ data, q, selectedNodeId, onSelectNode, onNodeDeleted, onAddEdge }:
  { data: OntologyData; q: string; selectedNodeId: string | null
    onSelectNode: (n: OntologyNode) => void
    onNodeDeleted: (id: string) => void
    onAddEdge: (id: string) => void }) {

  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const layerMap = Object.fromEntries(data.layers.map(l => [l.id, l]))

  const nodes = data.nodes.filter(n =>
    !q || n.name.toLowerCase().includes(q) || n.id.toLowerCase().includes(q) ||
    String(n.type ?? '').toLowerCase().includes(q)
  )

  async function handleDelete(id: string) {
    try {
      await deleteNode(id)
      onNodeDeleted(id)
    } catch (e) { alert('删除失败：' + String(e)) }
    finally { setConfirmDel(null) }
  }

  return (
    <div className="divide-y divide-white/[0.04]">
      {nodes.map(n => {
        const lyr  = layerMap[n.layer]
        const pal  = LAYER_PALETTE[lyr?.layer ?? 8] ?? LAYER_PALETTE[8]
        const isSelected = n.id === selectedNodeId
        return (
          <div key={n.id}
               className={`group flex items-start gap-2 px-3 py-2.5 cursor-pointer transition-colors
                 ${isSelected ? 'bg-violet-500/10' : 'hover:bg-white/[0.03]'}`}
               onClick={() => onSelectNode(n)}>
            {/* 层色点 */}
            <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: pal.accent }} />
            <div className="flex-1 min-w-0">
              <div className="text-sm text-white/85 truncate font-medium">{n.name}</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] font-mono text-white/30">{n.id}</span>
                {n.type && (
                  <span className="text-[10px] px-1 rounded"
                        style={{ background: `${pal.accent}22`, color: pal.accent }}>
                    {n.type}
                  </span>
                )}
              </div>
            </div>
            {/* 操作按钮 */}
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 shrink-0"
                 onClick={e => e.stopPropagation()}>
              <button onClick={() => onAddEdge(n.id)}
                      className="p-1 rounded hover:bg-white/10 text-white/30 hover:text-violet-300" title="添加边">
                <ArrowRightLeft size={11} />
              </button>
              {confirmDel === n.id ? (
                <>
                  <button onClick={() => handleDelete(n.id)}
                          className="px-1.5 py-0.5 rounded text-[10px] bg-red-600 text-white">确认</button>
                  <button onClick={() => setConfirmDel(null)}
                          className="px-1.5 py-0.5 rounded text-[10px] text-white/40">✕</button>
                </>
              ) : (
                <button onClick={() => setConfirmDel(n.id)}
                        className="p-1 rounded hover:bg-white/10 text-white/30 hover:text-red-400">
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          </div>
        )
      })}
      {nodes.length === 0 && (
        <div className="text-center text-white/20 text-xs py-8">无匹配节点</div>
      )}
    </div>
  )
}

// ── 边列表 ────────────────────────────────────────────────────────────────
function EdgeList({ data, q, selectedEdgeId, onSelectEdge, onEdgeDeleted }:
  { data: OntologyData; q: string; selectedEdgeId: string | null
    onSelectEdge: (e: OntologyEdge) => void
    onEdgeDeleted: (id: string) => void }) {

  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const nodeMap = Object.fromEntries(data.nodes.map(n => [n.id, n]))

  const edges = data.edges.filter(e => {
    if (!q) return true
    const src = nodeMap[e.source]?.name ?? e.source
    const tgt = nodeMap[e.target]?.name ?? e.target
    return src.toLowerCase().includes(q) || tgt.toLowerCase().includes(q) ||
           e.type.toLowerCase().includes(q) || e.id.toLowerCase().includes(q)
  })

  async function handleDelete(id: string) {
    try {
      await deleteEdge(id)
      onEdgeDeleted(id)
    } catch (e) { alert('删除失败：' + String(e)) }
    finally { setConfirmDel(null) }
  }

  return (
    <div className="divide-y divide-white/[0.04]">
      {edges.map(e => {
        const es  = getEdgeStyle(data.edge_types, e.type)
        const src = nodeMap[e.source]?.name ?? e.source
        const tgt = nodeMap[e.target]?.name ?? e.target
        const isSelected = e.id === selectedEdgeId
        return (
          <div key={e.id}
               className={`group flex items-start gap-2 px-3 py-2.5 cursor-pointer transition-colors
                 ${isSelected ? 'bg-violet-500/10' : 'hover:bg-white/[0.03]'}`}
               onClick={() => onSelectEdge(e)}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-white/70 truncate max-w-[70px]">{src}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0"
                      style={{ background: `${es.color}22`, color: es.color, border: `1px solid ${es.color}33` }}>
                  {es.label}
                </span>
                <span className="text-xs text-white/70 truncate max-w-[70px]">{tgt}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-mono text-white/25">{e.id}</span>
                {e.strength !== undefined && e.strength !== 1 && (
                  <span className="text-[10px] text-white/30">s={e.strength}</span>
                )}
                {e.conditions && (
                  <span className="text-[10px] text-yellow-400/50">∃条件</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 shrink-0"
                 onClick={ev => ev.stopPropagation()}>
              {confirmDel === e.id ? (
                <>
                  <button onClick={() => handleDelete(e.id)}
                          className="px-1.5 py-0.5 rounded text-[10px] bg-red-600 text-white">确认</button>
                  <button onClick={() => setConfirmDel(null)}
                          className="px-1.5 py-0.5 rounded text-[10px] text-white/40">✕</button>
                </>
              ) : (
                <button onClick={() => setConfirmDel(e.id)}
                        className="p-1 rounded hover:bg-white/10 text-white/30 hover:text-red-400">
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          </div>
        )
      })}
      {edges.length === 0 && (
        <div className="text-center text-white/20 text-xs py-8">无匹配边</div>
      )}
    </div>
  )
}

// ── 层列表 ────────────────────────────────────────────────────────────────
function LayerList({ data, q, onDataChange }:
  { data: OntologyData; q: string; onDataChange: (d: OntologyData) => void }) {

  const [editId,    setEditId]    = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const [addingNew,  setAddingNew]  = useState(false)
  const [flabel,     setFlabel]     = useState('')
  const [forder,     setForder]     = useState('')
  const [newId,      setNewId]      = useState('')
  const [newLabel,   setNewLabel]   = useState('')
  const [newOrder,   setNewOrder]   = useState('')
  const [saving,     setSaving]     = useState(false)

  const layers = data.layers.filter(l =>
    !q || l.label.toLowerCase().includes(q) || l.id.toLowerCase().includes(q)
  )

  function startEdit(l: OntologyLayer) {
    setEditId(l.id); setFlabel(l.label); setForder(String(l.layer))
  }

  async function saveEdit(l: OntologyLayer) {
    setSaving(true)
    try {
      const updated = await updateLayer(l.id, { label: flabel, layer: parseInt(forder) || l.layer })
      onDataChange({ ...data, layers: data.layers.map(x => x.id === l.id ? updated : x) })
      setEditId(null)
    } catch (e) { alert('保存失败：' + String(e)) }
    finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    try {
      await deleteLayer(id)
      onDataChange({ ...data, layers: data.layers.filter(l => l.id !== id) })
    } catch (e) { alert('删除失败：' + String(e)) }
    finally { setConfirmDel(null) }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newId.trim() || !newLabel.trim()) return
    setSaving(true)
    try {
      const created = await createLayer({ id: newId.trim(), label: newLabel.trim(), layer: parseInt(newOrder) || 0 })
      onDataChange({ ...data, layers: [...data.layers, created] })
      setAddingNew(false); setNewId(''); setNewLabel(''); setNewOrder('')
    } catch (e) { alert('创建失败：' + String(e)) }
    finally { setSaving(false) }
  }

  return (
    <div>
      {/* 新建表单 */}
      {addingNew && (
        <form onSubmit={handleCreate} className="px-3 py-3 border-b border-white/[0.06] space-y-2 bg-white/[0.02]">
          <input value={newId} onChange={e => setNewId(e.target.value)} placeholder="ID (英文)"
                 className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white/80 outline-none" />
          <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="名称"
                 className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white/80 outline-none" />
          <input value={newOrder} onChange={e => setNewOrder(e.target.value)} placeholder="顺序 (数字)"
                 className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white/80 outline-none" />
          <div className="flex gap-2">
            <button type="submit" disabled={saving}
                    className="px-2 py-1 bg-violet-600 text-white text-xs rounded">创建</button>
            <button type="button" onClick={() => setAddingNew(false)}
                    className="px-2 py-1 border border-white/10 text-white/40 text-xs rounded">取消</button>
          </div>
        </form>
      )}
      {!addingNew && (
        <button onClick={() => setAddingNew(true)}
                className="w-full flex items-center gap-1.5 px-3 py-2 text-xs text-white/30 hover:text-violet-300 border-b border-white/[0.04]">
          <Plus size={11} />新建层
        </button>
      )}

      <div className="divide-y divide-white/[0.04]">
        {layers.map(l => {
          const pal = LAYER_PALETTE[l.layer] ?? LAYER_PALETTE[8]
          return (
            <div key={l.id} className="group px-3 py-2.5">
              {editId === l.id ? (
                <div className="space-y-1.5">
                  <input value={flabel} onChange={e => setFlabel(e.target.value)}
                         className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white/80 outline-none" />
                  <input value={forder} onChange={e => setForder(e.target.value)} placeholder="顺序"
                         className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white/80 outline-none" />
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(l)} disabled={saving}
                            className="flex items-center gap-1 px-2 py-0.5 bg-violet-600 text-white text-xs rounded">
                      <Check size={10} />{saving ? '…' : '保存'}
                    </button>
                    <button onClick={() => setEditId(null)}
                            className="px-2 py-0.5 border border-white/10 text-white/40 text-xs rounded">取消</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: pal.accent }} />
                  <span className="text-[11px] font-mono text-white/40 shrink-0">L{l.layer}</span>
                  <span className="text-sm text-white/75 flex-1 truncate">{l.label}</span>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
                    <button onClick={() => startEdit(l)}
                            className="p-1 rounded hover:bg-white/10 text-white/30 hover:text-violet-300">
                      <Edit2 size={11} />
                    </button>
                    {confirmDel === l.id ? (
                      <>
                        <button onClick={() => handleDelete(l.id)}
                                className="px-1.5 py-0.5 rounded text-[10px] bg-red-600 text-white">确认</button>
                        <button onClick={() => setConfirmDel(null)}
                                className="px-1.5 py-0.5 rounded text-[10px] text-white/40">✕</button>
                      </>
                    ) : (
                      <button onClick={() => setConfirmDel(l.id)}
                              className="p-1 rounded hover:bg-white/10 text-white/30 hover:text-red-400">
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── 边类型列表 ────────────────────────────────────────────────────────────
function EdgeTypeList({ data, q, onDataChange }:
  { data: OntologyData; q: string; onDataChange: (d: OntologyData) => void }) {

  const [editId,     setEditId]     = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const [addingNew,  setAddingNew]  = useState(false)
  const [flabel,     setFlabel]     = useState('')
  const [fcolor,     setFcolor]     = useState('#94a3b8')
  const [fdash,      setFdash]      = useState(false)
  const [newId,      setNewId]      = useState('')
  const [newLabel,   setNewLabel]   = useState('')
  const [newColor,   setNewColor]   = useState('#94a3b8')
  const [newDash,    setNewDash]    = useState(false)
  const [saving,     setSaving]     = useState(false)

  const types = data.edge_types.filter(t =>
    !q || t.label.toLowerCase().includes(q) || t.id.toLowerCase().includes(q)
  )

  function startEdit(t: OntologyEdgeType) {
    setEditId(t.id); setFlabel(t.label); setFcolor(t.color); setFdash(!!t.dash)
  }

  async function saveEdit(t: OntologyEdgeType) {
    setSaving(true)
    try {
      const updated = await updateEdgeType(t.id, { label: flabel, color: fcolor, dash: fdash })
      onDataChange({ ...data, edge_types: data.edge_types.map(x => x.id === t.id ? updated : x) })
      setEditId(null)
    } catch (e) { alert('保存失败：' + String(e)) }
    finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    try {
      await deleteEdgeType(id)
      onDataChange({ ...data, edge_types: data.edge_types.filter(t => t.id !== id) })
    } catch (e) { alert('删除失败：' + String(e)) }
    finally { setConfirmDel(null) }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newId.trim() || !newLabel.trim()) return
    setSaving(true)
    try {
      const created = await createEdgeType({ id: newId.trim(), label: newLabel.trim(), color: newColor, dash: newDash })
      onDataChange({ ...data, edge_types: [...data.edge_types, created] })
      setAddingNew(false); setNewId(''); setNewLabel(''); setNewColor('#94a3b8'); setNewDash(false)
    } catch (e) { alert('创建失败：' + String(e)) }
    finally { setSaving(false) }
  }

  return (
    <div>
      {addingNew && (
        <form onSubmit={handleCreate} className="px-3 py-3 border-b border-white/[0.06] space-y-2 bg-white/[0.02]">
          <input value={newId} onChange={e => setNewId(e.target.value)} placeholder="ID (英文大写)"
                 className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white/80 outline-none" />
          <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="标签"
                 className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white/80 outline-none" />
          <div className="flex items-center gap-2">
            <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)}
                   className="w-8 h-7 rounded cursor-pointer bg-transparent border-none" />
            <label className="flex items-center gap-1.5 text-xs text-white/50 cursor-pointer">
              <input type="checkbox" checked={newDash} onChange={e => setNewDash(e.target.checked)} />
              虚线
            </label>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving}
                    className="px-2 py-1 bg-violet-600 text-white text-xs rounded">创建</button>
            <button type="button" onClick={() => setAddingNew(false)}
                    className="px-2 py-1 border border-white/10 text-white/40 text-xs rounded">取消</button>
          </div>
        </form>
      )}
      {!addingNew && (
        <button onClick={() => setAddingNew(true)}
                className="w-full flex items-center gap-1.5 px-3 py-2 text-xs text-white/30 hover:text-violet-300 border-b border-white/[0.04]">
          <Plus size={11} />新建边类型
        </button>
      )}

      <div className="divide-y divide-white/[0.04]">
        {types.map(t => (
          <div key={t.id} className="group px-3 py-2.5">
            {editId === t.id ? (
              <div className="space-y-1.5">
                <input value={flabel} onChange={e => setFlabel(e.target.value)}
                       className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white/80 outline-none" />
                <div className="flex items-center gap-2">
                  <input type="color" value={fcolor} onChange={e => setFcolor(e.target.value)}
                         className="w-8 h-7 rounded cursor-pointer bg-transparent border-none" />
                  <label className="flex items-center gap-1.5 text-xs text-white/50 cursor-pointer">
                    <input type="checkbox" checked={fdash} onChange={e => setFdash(e.target.checked)} />
                    虚线
                  </label>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => saveEdit(t)} disabled={saving}
                          className="flex items-center gap-1 px-2 py-0.5 bg-violet-600 text-white text-xs rounded">
                    <Check size={10} />{saving ? '…' : '保存'}
                  </button>
                  <button onClick={() => setEditId(null)}
                          className="px-2 py-0.5 border border-white/10 text-white/40 text-xs rounded">取消</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-5 shrink-0"
                     style={{ borderTop: `2px ${t.dash ? 'dashed' : 'solid'} ${t.color}`, opacity: 0.8 }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white/75">{t.label}</div>
                  <div className="text-[10px] font-mono text-white/25">{t.id}</div>
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
                  <button onClick={() => startEdit(t)}
                          className="p-1 rounded hover:bg-white/10 text-white/30 hover:text-violet-300">
                    <Edit2 size={11} />
                  </button>
                  {confirmDel === t.id ? (
                    <>
                      <button onClick={() => handleDelete(t.id)}
                              className="px-1.5 py-0.5 rounded text-[10px] bg-red-600 text-white">确认</button>
                      <button onClick={() => setConfirmDel(null)}
                              className="px-1.5 py-0.5 rounded text-[10px] text-white/40">✕</button>
                    </>
                  ) : (
                    <button onClick={() => setConfirmDel(t.id)}
                            className="p-1 rounded hover:bg-white/10 text-white/30 hover:text-red-400">
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── 主组件 ───────────────────────────────────────────────────────────────

export default function OntologyView() {
  const [data,    setData]    = useState<OntologyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const [selectedNode,   setSelectedNode]   = useState<OntologyNode | null>(null)
  const [selectedEdge,   setSelectedEdge]   = useState<OntologyEdge | null>(null)
  const [addingEdgeFrom, setAddingEdgeFrom] = useState<string | null>(null)
  const [addingNode,     setAddingNode]     = useState(false)
  const [showListPanel,  setShowListPanel]  = useState(true)

  const [search,      setSearch]      = useState('')
  const [layerFilter, setLayerFilter] = useState<string | null>(null)
  const [edgeFilter,  setEdgeFilter]  = useState<string | null>(null)
  const [showLegend,  setShowLegend]  = useState(false)

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<Node>([])
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>([])

  // ── 加载 ──
  async function load() {
    try {
      const d = await fetchOntology()
      setData(d); setLoading(false)
    } catch (e) { setError(String(e)); setLoading(false) }
  }
  useEffect(() => { load() }, [])

  // ── 过滤 ──
  const filteredNodes = useMemo(() => {
    if (!data) return []
    let nodes = data.nodes
    if (layerFilter) nodes = nodes.filter(n => n.layer === layerFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      nodes = nodes.filter(n =>
        n.name.toLowerCase().includes(q) ||
        n.id.toLowerCase().includes(q) ||
        String(n.description ?? '').toLowerCase().includes(q)
      )
    }
    return nodes
  }, [data, layerFilter, search])

  const filteredEdges = useMemo(() => {
    if (!data) return []
    const ids = new Set(filteredNodes.map(n => n.id))
    let edges = data.edges.filter(e => ids.has(e.source) && ids.has(e.target))
    if (edgeFilter) edges = edges.filter(e => e.type === edgeFilter)
    return edges
  }, [data, filteredNodes, edgeFilter])

  useEffect(() => {
    if (!data) return
    const ids = new Set(filteredNodes.map(n => n.id))
    setRfNodes(computeLayout(filteredNodes))
    setRfEdges(buildEdges(filteredEdges, ids, data.edge_types))
  }, [filteredNodes, filteredEdges, data])

  // ── 节点点击 ──
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const n = data?.nodes.find(x => x.id === node.id) ?? null
    setSelectedNode(n); setSelectedEdge(null)
  }, [data])

  // ── 边点击 ──
  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    const e = data?.edges.find(x => x.id === edge.id) ?? null
    setSelectedEdge(e); setSelectedNode(null)
  }, [data])

  // ── CRUD 回调 ──
  function handleNodeUpdated(updated: OntologyNode) {
    setData(prev => {
      if (!prev) return prev
      const layerObj = prev.layers.find(l => l.id === updated.layer)
      const n = { ...updated, layerIndex: layerObj?.layer ?? updated.layerIndex, layerLabel: layerObj?.label ?? updated.layerLabel }
      return { ...prev, nodes: prev.nodes.map(x => x.id === n.id ? n : x) }
    })
    setSelectedNode(updated)
  }
  function handleNodeDeleted(id: string) {
    setData(prev => {
      if (!prev) return prev
      return { ...prev, nodes: prev.nodes.filter(n => n.id !== id),
               edges: prev.edges.filter(e => e.source !== id && e.target !== id) }
    })
    setSelectedNode(null)
  }
  function handleEdgeUpdated(updated: OntologyEdge) {
    setData(prev => prev ? { ...prev, edges: prev.edges.map(e => e.id === updated.id ? updated : e) } : prev)
    setSelectedEdge(updated)
  }
  function handleEdgeDeleted(id: string) {
    setData(prev => prev ? { ...prev, edges: prev.edges.filter(e => e.id !== id) } : prev)
    setSelectedEdge(null)
  }

  async function handleAddNode(nodeData: Partial<OntologyNode>) {
    const created = await createNode(nodeData as Parameters<typeof createNode>[0])
    const layerObj = data?.layers.find(l => l.id === created.layer)
    const n = { ...created, layerIndex: layerObj?.layer ?? 0, layerLabel: layerObj?.label ?? '' }
    setData(prev => prev ? { ...prev, nodes: [...prev.nodes, n] } : prev)
    setAddingNode(false)
  }

  async function handleAddEdge(edgeData: Partial<OntologyEdge>) {
    const created = await createEdge(edgeData as Parameters<typeof createEdge>[0])
    setData(prev => prev ? { ...prev, edges: [...prev.edges, created] } : prev)
    setAddingEdgeFrom(null)
  }

  if (loading) return (
    <div className="flex-1 flex items-center justify-center -m-6 h-[calc(100%+48px)] bg-[#080808]">
      <div className="text-white/40 text-sm font-mono animate-pulse">解析本体中…</div>
    </div>
  )
  if (error) return (
    <div className="flex-1 flex items-center justify-center -m-6 h-[calc(100%+48px)] bg-[#080808]">
      <div className="text-red-400 text-sm font-mono">错误：{error}</div>
    </div>
  )

  const allLayers    = data?.layers ?? []
  const allEdgeTypes = data?.edge_types ?? []
  const showPanel    = selectedNode || selectedEdge

  return (
    <div className="flex flex-col -m-6 h-[calc(100%+48px)] bg-[#080808] overflow-hidden">

      {/* ── 控制栏 ── */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.06] shrink-0 flex-wrap relative">
        <div className="flex items-center gap-2 mr-1">
          <GitBranch size={16} className="text-violet-400" />
          <span className="text-white/90 font-semibold text-base">生变论本体</span>
          {data && (
            <span className="text-xs font-mono text-white/30">
              v{data.meta.version} · {data.nodes.length}节点 · {data.edges.length}边
            </span>
          )}
        </div>

        {/* 搜索 */}
        <div className="flex items-center gap-2 bg-white/5 rounded-md px-3 py-1.5 min-w-[170px]">
          <Search size={13} className="text-white/30 shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)}
                 placeholder="搜索节点…"
                 className="bg-transparent text-sm text-white/70 outline-none placeholder:text-white/25 w-full" />
        </div>

        {/* 层过滤 */}
        <div className="flex items-center gap-1.5">
          <Layers size={13} className="text-white/30" />
          <select value={layerFilter ?? ''} onChange={e => setLayerFilter(e.target.value || null)}
                  className="bg-white/5 border border-white/10 rounded text-sm text-white/70 px-2 py-1.5 outline-none">
            <option value="">全部层</option>
            {allLayers.map(l => <option key={l.id} value={l.id}>L{l.layer} {l.label}</option>)}
          </select>
        </div>

        {/* 边类型过滤 */}
        <div className="flex items-center gap-1.5">
          <Filter size={13} className="text-white/30" />
          <select value={edgeFilter ?? ''} onChange={e => setEdgeFilter(e.target.value || null)}
                  className="bg-white/5 border border-white/10 rounded text-sm text-white/70 px-2 py-1.5 outline-none">
            <option value="">全部边</option>
            {allEdgeTypes.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>

        {/* 图例 */}
        <button onClick={() => setShowLegend(v => !v)}
                className={`flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded border ${showLegend ? 'border-violet-500/50 text-violet-300' : 'border-white/10 text-white/40'} hover:text-white/70`}>
          <Info size={13} />图例
        </button>

        {/* 列表面板切换 */}
        <button onClick={() => setShowListPanel(v => !v)}
                className={`flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded border ml-auto
                  ${showListPanel ? 'border-violet-500/50 text-violet-300 bg-violet-500/10' : 'border-white/10 text-white/40 hover:text-white/70'}`}>
          <PanelLeft size={13} />列表
        </button>

        {/* 新建节点 */}
        <button onClick={() => setAddingNode(true)}
                className="flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded border border-violet-500/40 text-violet-300 hover:bg-violet-500/10">
          <Plus size={13} />节点
        </button>

        {/* 图例浮层 */}
        {showLegend && (
          <div className="absolute top-full left-0 mt-1 z-50 bg-[#111] border border-white/10 rounded-lg p-4 shadow-2xl min-w-[320px]">
            <div className="text-xs font-mono text-white/40 mb-2 uppercase tracking-widest">边类型</div>
            <div className="grid grid-cols-2 gap-1.5 mb-3">
              {allEdgeTypes.map(t => (
                <div key={t.id} className="flex items-center gap-2">
                  <div className="w-5 shrink-0" style={{ borderTop: `2px ${t.dash ? 'dashed' : 'solid'} ${t.color}`, opacity: 0.8 }} />
                  <span className="text-xs" style={{ color: t.color }}>{t.label}</span>
                </div>
              ))}
            </div>
            <div className="text-xs font-mono text-white/40 mb-2 uppercase tracking-widest">节点层</div>
            <div className="space-y-1">
              {allLayers.map(l => (
                <div key={l.id} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full shrink-0"
                       style={{ background: LAYER_PALETTE[l.layer]?.accent ?? '#666' }} />
                  <span className="text-xs text-white/60">L{l.layer} {l.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── 主体 ── */}
      <div className="flex-1 flex min-h-0">
        {/* 左侧列表面板 */}
        {showListPanel && data && (
          <ListPanel
            data={data}
            selectedNodeId={selectedNode?.id ?? null}
            selectedEdgeId={selectedEdge?.id ?? null}
            onSelectNode={n => { setSelectedNode(n); setSelectedEdge(null) }}
            onSelectEdge={e => { setSelectedEdge(e); setSelectedNode(null) }}
            onNodeDeleted={handleNodeDeleted}
            onEdgeDeleted={handleEdgeDeleted}
            onAddNode={() => setAddingNode(true)}
            onAddEdge={id => { setAddingEdgeFrom(id || ''); setSelectedNode(null) }}
            onDataChange={setData}
          />
        )}

        {/* ReactFlow */}
        <div className="flex-1 min-w-0" onClick={() => { if (showLegend) setShowLegend(false) }}>
          <ReactFlow
            nodes={rfNodes} edges={rfEdges}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick} onEdgeClick={onEdgeClick}
            nodeTypes={nodeTypes} edgeTypes={edgeTypes}
            colorMode="dark" fitView fitViewOptions={{ padding: 0.12 }}
            minZoom={0.05} maxZoom={2.5}
          >
            <Background color="#2a2a2a" variant={BackgroundVariant.Dots} gap={28} size={1.2} />
            <Controls style={{
              '--xy-controls-button-background-color': '#1a1a1a',
              '--xy-controls-button-border-color': '#ffffff15',
              '--xy-controls-button-color': '#94a3b8',
              '--xy-controls-button-background-color-hover': '#2a2a2a',
            } as React.CSSProperties} />
            <MiniMap
              nodeColor={n => {
                const li = (n.data as unknown as OntologyNode)?.layerIndex ?? 8
                return LAYER_PALETTE[li]?.accent ?? '#666'
              }}
              maskColor="rgba(8,8,8,0.75)"
              style={{ background: '#111', border: '1px solid #ffffff12' }}
            />
          </ReactFlow>
        </div>

        {/* 侧栏 */}
        {showPanel && (
          <div className="w-80 shrink-0">
            {selectedNode && data && (
              <NodePanel
                node={selectedNode}
                allEdges={data.edges}
                allNodes={data.nodes}
                edgeTypeList={data.edge_types}
                layers={data.layers}
                onClose={() => setSelectedNode(null)}
                onUpdated={handleNodeUpdated}
                onDeleted={handleNodeDeleted}
                onAddEdge={id => { setAddingEdgeFrom(id); setSelectedNode(null) }}
              />
            )}
            {selectedEdge && data && (
              <EdgePanel
                edge={selectedEdge}
                allNodes={data.nodes}
                edgeTypeList={data.edge_types}
                onClose={() => setSelectedEdge(null)}
                onUpdated={handleEdgeUpdated}
                onDeleted={handleEdgeDeleted}
              />
            )}
          </div>
        )}
      </div>

      {/* ── 弹窗 ── */}
      {addingNode && data && (
        <AddNodeDialog
          layers={data.layers}
          onConfirm={handleAddNode}
          onCancel={() => setAddingNode(false)}
        />
      )}
      {addingEdgeFrom !== null && data && (
        <AddEdgeDialog
          sourceId={addingEdgeFrom}
          allNodes={data.nodes}
          edgeTypeList={data.edge_types}
          onConfirm={handleAddEdge}
          onCancel={() => setAddingEdgeFrom(null)}
        />
      )}
    </div>
  )
}
