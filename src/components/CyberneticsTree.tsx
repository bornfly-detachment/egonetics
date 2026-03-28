/**
 * CyberneticsTree — 递归控制论骨架树
 *
 * 布局：左树（可折叠）+ 右侧节点详情
 * 每个节点：缩进 + 折叠/展开 + hover CRUD 动作
 * 数据源：/api/cybernetics/nodes（本地 pagesDb）
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronRight, ChevronDown, Plus, Edit2, Trash2, Check, Loader2, RefreshCw, Layers, FileText, GitBranch, X, AlertCircle } from 'lucide-react'
import { authFetch } from '../lib/http'
import BlockEditor, { type Block } from './BlockEditor'

// ── Types ────────────────────────────────────────────────────────

interface CyberNode {
  id: string
  parent_id: string | null
  layer: string | null
  level: number
  node_type: string
  name: string
  description: string
  sort_order: number
  is_builtin: boolean
  meta: Record<string, unknown>
  page_id: string | null
  created_at: string
  updated_at: string
  // UI only
  children?: CyberNode[]
}

interface CyberDiff {
  id: string
  node_id: string
  commit_a: string
  commit_b: string
  creator_a: string
  creator_b: string
  diff_type: string
  diff_patch: Record<string, unknown>
  resolution: string
  resolved_by: string | null
  training_value: number | null
  created_at: string
  resolved_at: string | null
}

// ── API helpers ──────────────────────────────────────────────────

const api = {
  list: () => authFetch<CyberNode[]>('/cybernetics/nodes'),
  create: (body: Partial<CyberNode>) => authFetch<CyberNode>('/cybernetics/nodes', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: Partial<CyberNode>) => authFetch<CyberNode>(`/cybernetics/nodes/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (id: string) => authFetch<{ ok: boolean }>(`/cybernetics/nodes/${id}`, { method: 'DELETE' }),
  seed: () => authFetch<{ ok: boolean; seeded: number }>('/cybernetics/nodes/seed', { method: 'POST' }),
  initPage: (id: string) => authFetch<{ page_id: string }>(`/cybernetics/nodes/${id}/page`, { method: 'POST' }),
  proposals: (id: string) => authFetch<CyberDiff[]>(`/cybernetics/nodes/${id}/proposals`),
  resolve: (id: string, body: { diff_id: string; action: 'accept' | 'reject'; training_value?: number }) =>
    authFetch<{ ok: boolean; diff_id: string; resolution: string }>(`/cybernetics/nodes/${id}/resolve`, { method: 'POST', body: JSON.stringify(body) }),
  allPendingDiffs: () => authFetch<CyberDiff[]>('/cybernetics/diffs?resolution=pending'),
}

// ── Build tree from flat array ───────────────────────────────────

function buildTree(nodes: CyberNode[]): CyberNode[] {
  const map = new Map<string, CyberNode>()
  nodes.forEach(n => map.set(n.id, { ...n, children: [] }))

  const roots: CyberNode[] = []
  map.forEach(node => {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children!.push(node)
    } else {
      roots.push(node)
    }
  })

  const sort = (arr: CyberNode[]) => {
    arr.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    arr.forEach(n => { if (n.children?.length) sort(n.children) })
  }
  sort(roots)
  return roots
}

// ── Layer colors ─────────────────────────────────────────────────

const LAYER_COLOR: Record<string, string> = {
  P: 'text-sky-400',
  R: 'text-indigo-400',
  V: 'text-violet-400',
  S: 'text-amber-400',
  E: 'text-emerald-400',
}

const NODE_TYPE_BADGE: Record<string, string> = {
  root:           'bg-white/8 text-neutral-400 border-white/10',
  layer:          'bg-violet-500/15 text-violet-300 border-violet-500/20',
  axiom_group:    'bg-orange-500/15 text-orange-300 border-orange-500/20',
  skeleton_group: 'bg-sky-500/15 text-sky-300 border-sky-500/20',
  impl_group:     'bg-green-500/15 text-green-300 border-green-500/20',
  lifecycle_group:'bg-amber-500/15 text-amber-300 border-amber-500/20',
  concept:        'bg-white/5 text-neutral-500 border-white/8',
}

// ── 左树单行改名 input ───────────────────────────────────────────

function InlineNameInput({ initial, onSave, onCancel }: {
  initial: string
  onSave: (name: string) => void
  onCancel: () => void
}) {
  const [val, setVal] = useState(initial)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select() }, [])

  return (
    <input
      ref={inputRef}
      value={val}
      onChange={e => setVal(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') { if (val.trim()) onSave(val.trim()) }
        if (e.key === 'Escape') onCancel()
      }}
      onBlur={() => { if (val.trim() && val.trim() !== initial) onSave(val.trim()); else onCancel() }}
      onClick={e => e.stopPropagation()}
      className="flex-1 min-w-0 bg-neutral-800 border border-white/20 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-white/40"
    />
  )
}

// ── Add child form ───────────────────────────────────────────────

function AddChildForm({ parentNode, onCreated, onCancel }: {
  parentNode: CyberNode
  onCreated: (n: CyberNode) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState({ name: '', description: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus() }, [])

  const submit = async () => {
    if (!form.name.trim()) { setError('名称必填'); return }
    setSaving(true); setError('')
    try {
      const n = await api.create({
        parent_id: parentNode.id,
        layer: parentNode.layer ?? undefined,
        level: (parentNode.level ?? 0) + 1,
        node_type: 'concept',
        name: form.name.trim(),
        description: form.description,
        sort_order: 999,
      })
      onCreated(n)
    } catch (e) { setError(String(e)) }
    setSaving(false)
  }

  return (
    <div className="ml-4 my-1 p-2 rounded bg-white/3 border border-white/8 space-y-1.5">
      <input
        ref={inputRef}
        value={form.name}
        onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel() }}
        placeholder="新节点名称"
        className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white placeholder-neutral-700 focus:outline-none focus:border-white/20"
      />
      <input
        value={form.description}
        onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel() }}
        placeholder="描述（可选）"
        className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-[11px] text-neutral-400 placeholder-neutral-700 focus:outline-none"
      />
      {error && <p className="text-[10px] text-red-400">{error}</p>}
      <div className="flex gap-1.5">
        <button onClick={submit} disabled={saving}
          className="flex items-center gap-1 px-2 py-0.5 bg-primary-500/20 hover:bg-primary-500/30 text-primary-300 text-[10px] rounded border border-primary-500/20">
          {saving ? <Loader2 size={9} className="animate-spin" /> : <Plus size={9} />}创建
        </button>
        <button onClick={onCancel} className="px-2 py-0.5 bg-white/5 text-neutral-500 text-[10px] rounded border border-white/8">取消</button>
      </div>
    </div>
  )
}

// ── Tree Node ────────────────────────────────────────────────────

function TreeNodeRow({
  node,
  depth,
  selected,
  onSelect,
  onUpdate,
  onDelete,
  onCreated,
  pendingNodeIds,
}: {
  node: CyberNode
  depth: number
  selected: string | null
  onSelect: (n: CyberNode) => void
  onUpdate: (id: string, updated: CyberNode) => void
  onDelete: (id: string) => void
  onCreated: (n: CyberNode) => void
  pendingNodeIds: Set<string>
}) {
  const [expanded, setExpanded] = useState(depth < 1)
  const [editing, setEditing] = useState(false)
  const [addingChild, setAddingChild] = useState(false)
  const [saving, setSaving] = useState(false)

  const hasChildren = (node.children?.length ?? 0) > 0
  const layerColor = node.layer ? (LAYER_COLOR[node.layer] ?? 'text-neutral-400') : 'text-neutral-400'
  const isSelected = selected === node.id

  const handleSaveName = async (name: string) => {
    setSaving(true)
    try {
      const updated = await api.update(node.id, { name })
      onUpdate(node.id, updated)
      setEditing(false)
    } catch { /* ignore */ }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!confirm(`删除节点「${node.name}」及其所有子节点？`)) return
    try {
      await api.delete(node.id)
      onDelete(node.id)
    } catch { /* ignore */ }
  }

  const indent = depth * 16

  return (
    <div>
      <div
        className={`group flex items-center gap-1 pr-2 py-1 cursor-pointer rounded transition-colors select-none ${
          isSelected ? 'bg-white/8 text-white' : 'text-neutral-500 hover:text-neutral-200 hover:bg-white/4'
        }`}
        style={{ paddingLeft: `${8 + indent}px` }}
        onClick={() => { onSelect(node); if (hasChildren) setExpanded(p => !p) }}
      >
        {/* Expand toggle */}
        <span className="w-3.5 shrink-0 flex items-center justify-center">
          {hasChildren ? (
            expanded
              ? <ChevronDown size={10} className="text-neutral-600" />
              : <ChevronRight size={10} className="text-neutral-600" />
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-white/10" />
          )}
        </span>

        {/* Node type badge (only for groups/layers) */}
        {node.node_type !== 'concept' && node.node_type !== 'root' && (
          <span className={`text-[9px] px-1 rounded border shrink-0 ${NODE_TYPE_BADGE[node.node_type] ?? 'bg-white/5 text-neutral-600 border-white/8'}`}>
            {node.node_type === 'axiom_group' ? 'L0' :
             node.node_type === 'skeleton_group' ? 'L1' :
             node.node_type === 'impl_group' ? 'L2' :
             node.node_type === 'lifecycle_group' ? 'LC' :
             node.node_type}
          </span>
        )}

        {/* Layer indicator */}
        {node.layer && node.node_type === 'layer' && (
          <span className={`text-xs font-bold font-mono shrink-0 ${layerColor}`}>{node.layer}</span>
        )}

        {/* Name */}
        {editing ? (
          saving
            ? <Loader2 size={10} className="animate-spin text-neutral-500 flex-1" />
            : <InlineNameInput
                initial={node.name}
                onSave={handleSaveName}
                onCancel={() => setEditing(false)}
              />
        ) : (
          <span className={`text-xs flex-1 min-w-0 truncate ${isSelected ? 'text-white' : ''}`}>
            {node.name}
          </span>
        )}

        {/* AI proposal indicator dot */}
        {pendingNodeIds.has(node.id) && (
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="有待处理的 AI 提案" />
        )}

        {/* Hover actions */}
        {!editing && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => { setAddingChild(p => !p); setExpanded(true) }}
              className="p-0.5 text-neutral-700 hover:text-primary-400 transition-colors"
              title="添加子节点"
            >
              <Plus size={10} />
            </button>
            <button
              onClick={() => setEditing(true)}
              className="p-0.5 text-neutral-700 hover:text-neutral-300 transition-colors"
              title="编辑"
            >
              <Edit2 size={10} />
            </button>
            <button
              onClick={handleDelete}
              className="p-0.5 text-neutral-700 hover:text-red-400 transition-colors"
              title="删除"
            >
              <Trash2 size={10} />
            </button>
          </div>
        )}
      </div>

      {/* Add child form */}
      {addingChild && (
        <div style={{ paddingLeft: `${8 + indent}px` }}>
          <AddChildForm
            parentNode={node}
            onCreated={n => { onCreated(n); setAddingChild(false) }}
            onCancel={() => setAddingChild(false)}
          />
        </div>
      )}

      {/* Children */}
      {expanded && hasChildren && node.children!.map(child => (
        <TreeNodeRow
          key={child.id}
          node={child}
          depth={depth + 1}
          selected={selected}
          onSelect={onSelect}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onCreated={onCreated}
          pendingNodeIds={pendingNodeIds}
        />
      ))}
    </div>
  )
}

// ── Diff patch renderer ──────────────────────────────────────────

/**
 * jsondiffpatch format:
 *   added:    { key: [newVal] }
 *   modified: { key: [oldVal, newVal] }
 *   deleted:  { key: [oldVal, 0, 0] }
 */
function DiffPatchView({ patch }: { patch: Record<string, unknown> }) {
  const entries = Object.entries(patch).filter(([k]) => !k.startsWith('_'))
  if (!entries.length) return <p className="text-[10px] text-neutral-600 italic">无可见变更</p>

  return (
    <div className="space-y-1.5">
      {entries.map(([key, val]) => {
        const arr = Array.isArray(val) ? val : null
        if (!arr) return null
        const isAdded    = arr.length === 1
        const isDeleted  = arr.length === 3 && arr[1] === 0 && arr[2] === 0
        const isModified = arr.length === 2

        return (
          <div key={key} className="text-[10px] font-mono">
            <span className="text-neutral-500">{key}: </span>
            {isAdded && (
              <span className="text-emerald-400">+ {JSON.stringify(arr[0])}</span>
            )}
            {isDeleted && (
              <span className="text-red-400">- {JSON.stringify(arr[0])}</span>
            )}
            {isModified && (
              <span>
                <span className="text-red-400 line-through mr-1">{JSON.stringify(arr[0])}</span>
                <span className="text-emerald-400">{JSON.stringify(arr[1])}</span>
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Proposals panel ───────────────────────────────────────────────

function ProposalsPanel({ node, onResolved }: {
  node: CyberNode
  onResolved: (diffId: string) => void
}) {
  const [diffs, setDiffs] = useState<CyberDiff[]>([])
  const [loading, setLoading] = useState(true)
  const [resolving, setResolving] = useState<string | null>(null)
  const [trainingValues, setTrainingValues] = useState<Record<string, string>>({})

  useEffect(() => {
    setLoading(true)
    api.proposals(node.id)
      .then(setDiffs)
      .catch(() => setDiffs([]))
      .finally(() => setLoading(false))
  }, [node.id])

  const handleResolve = async (diff: CyberDiff, action: 'accept' | 'reject') => {
    setResolving(diff.id)
    try {
      const tv = parseFloat(trainingValues[diff.id] ?? '')
      await api.resolve(node.id, {
        diff_id: diff.id,
        action,
        training_value: isNaN(tv) ? undefined : tv,
      })
      setDiffs(prev => prev.filter(d => d.id !== diff.id))
      onResolved(diff.id)
    } catch { /* ignore */ }
    setResolving(null)
  }

  if (loading) return (
    <div className="flex items-center gap-2 px-6 py-3 text-[10px] text-neutral-600">
      <Loader2 size={10} className="animate-spin" />加载提案中…
    </div>
  )

  if (!diffs.length) return null

  const DIFF_TYPE_LABEL: Record<string, string> = {
    ai_proposal:    'AI提案',
    user_correction:'用户纠正',
    ai_challenge:   'AI挑战',
    ab_test:        'A/B测试',
  }

  return (
    <div className="px-6 py-3 border-b border-white/5 shrink-0">
      <div className="flex items-center gap-1.5 mb-2">
        <GitBranch size={11} className="text-amber-400" />
        <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">
          AI 提案 ({diffs.length})
        </span>
      </div>
      <div className="space-y-3">
        {diffs.map(diff => (
          <div key={diff.id} className="rounded border border-amber-500/15 bg-amber-500/5 p-3 space-y-2">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/20">
                  {DIFF_TYPE_LABEL[diff.diff_type] ?? diff.diff_type}
                </span>
                <span className="text-[9px] text-neutral-700 font-mono">
                  {diff.commit_b.slice(0, 7)}
                </span>
              </div>
              <span className="text-[9px] text-neutral-700">
                {new Date(diff.created_at).toLocaleDateString('zh-CN')}
              </span>
            </div>

            {/* Diff content */}
            <DiffPatchView patch={diff.diff_patch} />

            {/* Training value input */}
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-neutral-600">训练价值:</span>
              <input
                type="number"
                min={0}
                max={1}
                step={0.1}
                placeholder="0.0–1.0"
                value={trainingValues[diff.id] ?? ''}
                onChange={e => setTrainingValues(prev => ({ ...prev, [diff.id]: e.target.value }))}
                className="w-16 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-[9px] text-neutral-300 focus:outline-none focus:border-white/20"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleResolve(diff, 'accept')}
                disabled={resolving === diff.id}
                className="flex items-center gap-1 px-2 py-0.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-[9px] rounded border border-emerald-500/20 transition-colors"
              >
                {resolving === diff.id ? <Loader2 size={8} className="animate-spin" /> : <Check size={8} />}
                接受
              </button>
              <button
                onClick={() => handleResolve(diff, 'reject')}
                disabled={resolving === diff.id}
                className="flex items-center gap-1 px-2 py-0.5 bg-red-600/15 hover:bg-red-600/25 text-red-400 text-[9px] rounded border border-red-500/15 transition-colors"
              >
                {resolving === diff.id ? <Loader2 size={8} className="animate-spin" /> : <X size={8} />}
                拒绝
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Right panel: node detail ─────────────────────────────────────

function NodeDetail({ node, onUpdate, onProposalResolved }: {
  node: CyberNode
  onUpdate: (id: string, updated: CyberNode) => void
  onProposalResolved: (nodeId: string, diffId: string) => void
}) {
  const [editingName, setEditingName] = useState(false)
  const [nameVal, setNameVal] = useState(node.name)
  const [editingDesc, setEditingDesc] = useState(false)
  const [desc, setDesc] = useState(node.description)
  const [saving, setSaving] = useState(false)
  const [pageId, setPageId] = useState<string | null>(node.page_id)
  const [initingPage, setInitingPage] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 节点切换时重置
  useEffect(() => {
    setNameVal(node.name)
    setEditingName(false)
    setDesc(node.description)
    setEditingDesc(false)
    setPageId(node.page_id)
    setPendingCount(0)
    api.proposals(node.id).then(diffs => setPendingCount(diffs.length)).catch(() => {})
  }, [node.id, node.name, node.description, node.page_id])

  const saveName = async () => {
    if (!nameVal.trim() || nameVal === node.name) { setEditingName(false); return }
    setSaving(true)
    try {
      const updated = await api.update(node.id, { name: nameVal.trim() })
      onUpdate(node.id, updated)
      setEditingName(false)
    } catch { /* ignore */ }
    setSaving(false)
  }

  const saveDesc = async () => {
    setSaving(true)
    try {
      const updated = await api.update(node.id, { description: desc })
      onUpdate(node.id, updated)
      setEditingDesc(false)
    } catch { /* ignore */ }
    setSaving(false)
  }

  const handleBlocksChange = (next: Block[]) => {
    if (!pageId) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      authFetch(`/pages/${pageId}/blocks`, { method: 'PUT', body: JSON.stringify(next) }).catch(() => {})
    }, 800)
  }

  const handleInitPage = async () => {
    setInitingPage(true)
    try {
      const { page_id } = await api.initPage(node.id)
      setPageId(page_id)
      onUpdate(node.id, { ...node, page_id })
    } catch { /* ignore */ }
    setInitingPage(false)
  }

  const layerColor = node.layer ? (LAYER_COLOR[node.layer] ?? 'text-neutral-400') : 'text-neutral-400'
  const badge = NODE_TYPE_BADGE[node.node_type] ?? 'bg-white/5 text-neutral-500 border-white/8'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2 mb-2">
          {node.layer && (
            <span className={`text-xs font-bold font-mono ${layerColor}`}>{node.layer}</span>
          )}
          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${badge}`}>{node.node_type}</span>
          <span className="text-[10px] text-neutral-700">L{node.level}</span>
          {pendingCount > 0 && (
            <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/20">
              <AlertCircle size={8} />{pendingCount} AI提案
            </span>
          )}
        </div>
        {editingName ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={nameVal}
              onChange={e => setNameVal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { setNameVal(node.name); setEditingName(false) } }}
              onBlur={saveName}
              className="flex-1 bg-white/6 border border-white/20 rounded px-2 py-1 text-base font-semibold text-white focus:outline-none focus:border-white/40"
            />
            {saving && <Loader2 size={12} className="animate-spin text-neutral-500 shrink-0" />}
          </div>
        ) : (
          <h2
            className="text-base font-semibold text-white leading-snug cursor-text hover:bg-white/4 rounded px-1 -mx-1 py-0.5 transition-colors"
            onClick={() => setEditingName(true)}
            title="点击编辑名称"
          >
            {node.name}
          </h2>
        )}
      </div>

      {/* Description */}
      <div className="px-6 py-3 border-b border-white/5 shrink-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-semibold text-neutral-600 uppercase tracking-wider">描述</span>
          {!editingDesc && (
            <button onClick={() => setEditingDesc(true)}
              className="text-[10px] text-neutral-700 hover:text-neutral-400 transition-colors flex items-center gap-1">
              <Edit2 size={9} />编辑
            </button>
          )}
        </div>
        {editingDesc ? (
          <div className="space-y-2">
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-white/20 resize-none"
              placeholder="节点描述..."
            />
            <div className="flex gap-2">
              <button onClick={saveDesc} disabled={saving}
                className="flex items-center gap-1 px-2.5 py-1 bg-green-600/20 hover:bg-green-600/30 text-green-400 text-[10px] rounded border border-green-500/20">
                {saving ? <Loader2 size={9} className="animate-spin" /> : <Check size={9} />}保存
              </button>
              <button onClick={() => { setEditingDesc(false); setDesc(node.description) }}
                className="px-2.5 py-1 bg-white/5 text-neutral-500 text-[10px] rounded border border-white/8">取消</button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-neutral-400 leading-relaxed">
            {node.description || <span className="text-neutral-700 italic">暂无描述</span>}
          </p>
        )}
      </div>

      {/* AI Proposals */}
      {pendingCount > 0 && (
        <ProposalsPanel
          node={node}
          onResolved={(diffId) => {
            setPendingCount(p => Math.max(0, p - 1))
            onProposalResolved(node.id, diffId)
          }}
        />
      )}

      {/* BlockEditor 内容区 */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {pageId ? (
          <div className="flex-1 overflow-y-auto">
            <BlockEditor
              key={pageId}
              pageId={pageId}
              onChange={handleBlocksChange}
              readOnly={false}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 gap-3">
            <FileText size={28} className="text-neutral-800" />
            <p className="text-xs text-neutral-600">此节点还没有内容笔记</p>
            <button
              onClick={handleInitPage}
              disabled={initingPage}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/8 border border-white/10 text-neutral-400 hover:text-neutral-200 text-xs rounded transition-colors"
            >
              {initingPage ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
              初始化笔记
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────

export default function CyberneticsTree() {
  const [flat, setFlat] = useState<CyberNode[]>([])
  const [tree, setTree] = useState<CyberNode[]>([])
  const [selected, setSelected] = useState<CyberNode | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [seeding, setSeeding] = useState(false)
  const [pendingNodeIds, setPendingNodeIds] = useState<Set<string>>(new Set())

  const loadPendingDiffs = useCallback(async () => {
    try {
      const diffs = await api.allPendingDiffs()
      setPendingNodeIds(new Set(diffs.map(d => d.node_id)))
    } catch { /* non-critical */ }
  }, [])

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const nodes = await api.list()
      setFlat(nodes)
      setTree(buildTree(nodes))
    } catch (e) { setError(String(e)) }
    setLoading(false)
    loadPendingDiffs()
  }, [loadPendingDiffs])

  useEffect(() => { load() }, [load])

  // Rebuild tree whenever flat changes
  useEffect(() => { setTree(buildTree(flat)) }, [flat])

  const handleSeed = async () => {
    setSeeding(true)
    try {
      await api.seed()
      await load()
    } catch (e) { setError(String(e)) }
    setSeeding(false)
  }

  // Update a node in flat list (and re-select if it's selected)
  const handleUpdate = (id: string, updated: CyberNode) => {
    setFlat(prev => prev.map(n => n.id === id ? { ...n, ...updated } : n))
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, ...updated } : prev)
  }

  // Remove node + all descendants from flat list
  const handleDelete = (id: string) => {
    const toRemove = new Set<string>()
    const collect = (nid: string) => {
      toRemove.add(nid)
      flat.filter(n => n.parent_id === nid).forEach(child => collect(child.id))
    }
    collect(id)
    setFlat(prev => prev.filter(n => !toRemove.has(n.id)))
    if (selected && toRemove.has(selected.id)) setSelected(null)
  }

  // Add new node to flat list
  const handleCreated = (n: CyberNode) => {
    setFlat(prev => [...prev, n])
    setSelected(n)
  }

  // When a proposal is resolved, refresh pending dots
  const handleProposalResolved = useCallback((nodeId: string, _diffId: string) => {
    // Re-fetch all pending to see if more remain for this node
    api.proposals(nodeId).then(remaining => {
      setPendingNodeIds(prev => {
        const next = new Set(prev)
        if (remaining.length === 0) next.delete(nodeId)
        return next
      })
    }).catch(() => {})
  }, [])

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left: recursive tree ── */}
      <div className="w-72 shrink-0 border-r border-white/[0.06] bg-[#0c0c0c] flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-semibold text-neutral-600 uppercase tracking-widest">控制论骨架树</span>
          <div className="flex items-center gap-1">
            {flat.length === 0 && !loading && (
              <button onClick={handleSeed} disabled={seeding}
                className="flex items-center gap-1 px-2 py-1 text-[10px] text-amber-400 hover:text-amber-300 bg-amber-500/10 rounded border border-amber-500/20">
                {seeding ? <Loader2 size={9} className="animate-spin" /> : <Plus size={9} />}
                植入骨架
              </button>
            )}
            <button onClick={load} className="p-1 text-neutral-700 hover:text-neutral-400 transition-colors">
              <RefreshCw size={11} />
            </button>
          </div>
        </div>

        {/* Loading / error */}
        {loading && (
          <div className="flex items-center justify-center flex-1">
            <Loader2 size={16} className="animate-spin text-neutral-700" />
          </div>
        )}
        {error && (
          <div className="px-4 py-3">
            <p className="text-[10px] text-red-400">{error}</p>
          </div>
        )}

        {/* Tree */}
        {!loading && (
          <div className="flex-1 overflow-y-auto py-2">
            {tree.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-xs text-neutral-700 mb-3">树为空</p>
                <button onClick={handleSeed} disabled={seeding}
                  className="flex items-center gap-1 mx-auto px-3 py-1.5 text-[10px] text-amber-400 bg-amber-500/10 rounded border border-amber-500/20">
                  {seeding ? <Loader2 size={9} className="animate-spin" /> : <Plus size={9} />}
                  植入 PRVSE 骨架
                </button>
              </div>
            ) : (
              tree.map(root => (
                <TreeNodeRow
                  key={root.id}
                  node={root}
                  depth={0}
                  selected={selected?.id ?? null}
                  onSelect={setSelected}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                  onCreated={handleCreated}
                  pendingNodeIds={pendingNodeIds}
                />
              ))
            )}
          </div>
        )}

        {/* Add root node */}
        {!loading && tree.length > 0 && (
          <div className="px-4 py-2 border-t border-white/5 shrink-0">
            <AddRootButton onCreated={handleCreated} />
          </div>
        )}
      </div>

      {/* ── Right: node detail ── */}
      <div className="flex-1 min-w-0 bg-[#0a0a0a] overflow-hidden">
        {selected ? (
          <NodeDetail node={selected} onUpdate={handleUpdate} onProposalResolved={handleProposalResolved} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Layers size={32} className="text-neutral-800 mb-3" />
            <p className="text-sm text-neutral-600">点击左侧节点查看详情</p>
            <p className="text-xs text-neutral-800 mt-1">每个节点支持增删改查 + 内容编写</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Add root node button ─────────────────────────────────────────

function AddRootButton({ onCreated }: { onCreated: (n: CyberNode) => void }) {
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', description: '' })
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const n = await api.create({ parent_id: null, level: 0, node_type: 'concept', name: form.name.trim(), description: form.description, sort_order: 999 })
      onCreated(n)
      setAdding(false)
      setForm({ name: '', description: '' })
    } catch { /* ignore */ }
    setSaving(false)
  }

  if (!adding) {
    return (
      <button onClick={() => setAdding(true)}
        className="w-full flex items-center gap-1.5 py-1.5 text-[10px] text-neutral-700 hover:text-neutral-500 transition-colors">
        <Plus size={10} />添加根节点
      </button>
    )
  }

  return (
    <div className="space-y-1.5">
      <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setAdding(false) }}
        placeholder="根节点名称" autoFocus
        className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-[11px] text-white placeholder-neutral-700 focus:outline-none" />
      <div className="flex gap-1">
        <button onClick={submit} disabled={saving}
          className="flex items-center gap-1 px-2 py-0.5 bg-primary-500/20 text-primary-300 text-[10px] rounded border border-primary-500/20">
          {saving ? <Loader2 size={8} className="animate-spin" /> : <Check size={8} />}创建
        </button>
        <button onClick={() => setAdding(false)} className="px-2 py-0.5 bg-white/5 text-neutral-500 text-[10px] rounded border border-white/8">取消</button>
      </div>
    </div>
  )
}
