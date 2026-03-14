/**
 * ChronicleView.tsx — 基于 chronicle-spec.md 重写
 *
 * 实现优先级:
 * P1 Entry Detail Drawer (最高)
 * P2 Timeline view
 * P3 Library panel
 * P4 Collection nesting
 * P5 Workflow SVG (占位)
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Plus,
  Lock,
  ChevronDown,
  ChevronRight,
  X,
  BookOpen,
  CheckSquare,
  Brain,
  Package,
  Flag,
  PanelRight,
  Trash2,
  Edit2,
  LayoutList,
  Network,
  Archive,
} from 'lucide-react'
import BlockEditor from './BlockEditor'
import type { Block } from './BlockEditor'
import { getToken, removeToken } from '@/lib/http'

// ── API helpers ───────────────────────────────────────────────────────────────

const API = '/api'
const apiFetch = async (path: string, opts?: RequestInit) => {
  const token = getToken()
  const headers = {
    ...opts?.headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
  const r = await fetch(`${API}${path}`, { ...opts, headers })
  if (r.status === 401) {
    removeToken()
    window.location.href = '/login'
  }
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`)
  return r.json()
}
const post = (p: string, b: unknown) =>
  apiFetch(p, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(b),
  })
const patch = (p: string, b: unknown) =>
  apiFetch(p, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(b),
  })
const del = (p: string) => apiFetch(p, { method: 'DELETE' })

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChronicleEntry {
  id: string
  type: 'memory' | 'task' | 'theory'
  source_id: string
  title: string
  summary: string | null
  start_time: string | null
  end_time: string | null
  task_outcome: string | null
  version_tag: string | null
  content: string | null
  milestone_id: string | null
  is_locked: number
  created_at: string
}

interface Annotation {
  id: string
  entry_id: string
  version: number
  content: string
  milestone_version: string | null
  created_at: string
}

interface Milestone {
  id: string
  title: string
  description: string | null
  version: number | null
  cover_start: string | null
  cover_end: string | null
  is_published: number
  published_at: string | null
  created_at: string
}

interface Collection {
  id: string
  name: string
  description: string | null
  cover_icon: string | null
  milestone_id: string | null
  parent_id: string | null
  color: string | null
  content: string | null // JSON blocks
  position_x: number
  position_y: number
  sort_order: number
  is_locked: number
  created_at: string
}

interface CollectionItem {
  id: string
  collection_id: string
  entry_id: string
  sort_order: number
  type: 'memory' | 'task' | 'theory'
  title: string
  summary: string | null
  task_outcome: string | null
  version_tag: string | null
  is_locked: number
}

interface CollectionLink {
  id: string
  from_id: string
  to_id: string
  label: string | null
  created_at: string
}

interface EntryLink {
  id: string
  from_id: string
  to_id: string
  relation_hint: string
  draft_content: string
  content: string
  current_content_id: string
  created_at: string
  updated_at: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ENTRY_ICONS: Record<string, React.ReactNode> = {
  task: <CheckSquare size={12} className="text-blue-400 shrink-0" />,
  memory: <Brain size={12} className="text-green-400 shrink-0" />,
  theory: <BookOpen size={12} className="text-orange-400 shrink-0" />,
}
const ENTRY_LABELS: Record<string, string> = { task: 'task', memory: 'memory', theory: 'theory' }

// 预设颜色列表
const PRESET_COLORS = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
  '#f43f5e', // rose
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#10b981', // emerald
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#0ea5e9', // sky
  '#3b82f6', // blue
]

// 颜色选择器组件
function ColorPicker({
  value,
  onChange,
  disabled,
}: {
  value: string | null
  onChange: (c: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const currentColor = value || '#6366f1'

  if (disabled) {
    return (
      <div
        className="w-4 h-4 rounded-full shrink-0 border border-white/10"
        style={{ backgroundColor: currentColor }}
      />
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-4 h-4 rounded-full shrink-0 border border-white/20 hover:border-white/40 transition-colors"
        style={{ backgroundColor: currentColor }}
      />
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 bg-[#1e1e1e] border border-white/15 rounded-xl p-2 shadow-2xl">
            <div className="grid grid-cols-6 gap-1.5">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    onChange(c)
                    setOpen(false)
                  }}
                  className={`w-5 h-5 rounded-full border transition-all ${c === currentColor ? 'ring-2 ring-white scale-110' : 'border-white/10 hover:border-white/30'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// 从 blocks 中提取标题（第一个 heading 或 paragraph）
function getCollectionTitleFromBlocks(content: string | null): string {
  if (!content) return ''
  try {
    const blocks = JSON.parse(content)
    if (!Array.isArray(blocks) || blocks.length === 0) return ''
    const firstBlock = blocks[0]
    if (firstBlock.type?.startsWith('heading')) {
      const richText = firstBlock.content?.rich_text
      if (Array.isArray(richText)) {
        return richText.map((s: any) => s.text || '').join('')
      }
    }
    if (firstBlock.type === 'paragraph') {
      const richText = firstBlock.content?.rich_text
      if (Array.isArray(richText)) {
        return richText.map((s: any) => s.text || '').join('')
      }
    }
  } catch {
    /* ignore */
  }
  return ''
}

function fmtDate(ts: string | null) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// ── Entry Detail Drawer ───────────────────────────────────────────────────────

interface DrawerContent {
  entry: ChronicleEntry
  annotations: Annotation[]
}

function TaskDetail({ sourceId }: { sourceId: string }) {
  const [task, setTask] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch(`/kanban/tasks/${sourceId}`)
      .then((d) => setTask(d.task || d))
      .catch(() => setTask(null))
      .finally(() => setLoading(false))
  }, [sourceId])

  if (loading) return <div className="text-neutral-500 text-sm py-4">加载中…</div>
  if (!task) return <div className="text-neutral-500 text-sm py-4">找不到任务数据</div>

  const rawFields: Array<[string, unknown]> = [
    ['标题', task.name ?? task.title],
    ['状态', task.column_id ?? task.status],
    ['优先级', task.priority],
    ['负责人', task.assignee],
    ['开始日期', task.start_date],
    ['截止日期', task.due_date],
    ['描述', task.description],
    ['结果', task.task_outcome],
    ['摘要', task.task_summary],
  ]
  const fields = rawFields.filter(([, v]) => v !== undefined && v !== null && v !== '')

  return (
    <div className="space-y-2">
      {fields.map(([label, val]) => (
        <div key={label} className="flex gap-3 text-sm">
          <span className="text-neutral-500 w-16 shrink-0">{label}</span>
          <span className="text-neutral-200 flex-1 break-words">{String(val)}</span>
        </div>
      ))}
    </div>
  )
}

function MemoryDetail({ sourceId }: { sourceId: string }) {
  const [session, setSession] = useState<Record<string, unknown> | null>(null)
  const [rounds, setRounds] = useState<Record<string, unknown>[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      apiFetch(`/memory/sessions/${sourceId}`),
      apiFetch(`/memory/sessions/${sourceId}/rounds`),
    ])
      .then(([s, r]) => {
        setSession(s.session || s)
        setRounds(r.rounds || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [sourceId])

  if (loading) return <div className="text-neutral-500 text-sm py-4">加载中…</div>
  if (!session) return <div className="text-neutral-500 text-sm py-4">找不到会话数据</div>

  return (
    <div className="space-y-2">
      <div className="text-xs text-neutral-500">{rounds.length} 轮对话</div>
      {rounds.map((r: Record<string, unknown>) => {
        const roundId = r.id as string
        return (
          <div key={roundId} className="border border-neutral-800 rounded">
            <button
              className="flex items-center gap-2 px-3 py-2 w-full text-left hover:bg-white/5"
              onClick={() => setExpanded((e) => ({ ...e, [roundId]: !e[roundId] }))}
            >
              {expanded[roundId] ? (
                <ChevronDown size={12} className="text-neutral-500 shrink-0" />
              ) : (
                <ChevronRight size={12} className="text-neutral-500 shrink-0" />
              )}
              <span className="text-xs text-neutral-400">
                <span className="text-neutral-600">#{r.round_num as number}</span>{' '}
                {r.user_input ? (
                  String(r.user_input).slice(0, 80) + (String(r.user_input).length > 80 ? '…' : '')
                ) : (
                  <em className="text-neutral-600">空</em>
                )}
              </span>
            </button>
            {!!(expanded[roundId] && r.user_input) && (
              <div className="px-3 pb-2 text-xs text-blue-200 bg-blue-900/15 border-t border-neutral-800 whitespace-pre-wrap">
                {String(r.user_input)}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function TheoryDetail({ sourceId }: { sourceId: string }) {
  const [blocks, setBlocks] = useState<Block[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch(`/pages/${sourceId}/blocks`)
      .then((d) => setBlocks(d.blocks || []))
      .catch(() => setBlocks([]))
      .finally(() => setLoading(false))
  }, [sourceId])

  if (loading) return <div className="text-neutral-500 text-sm py-4">加载中…</div>

  return (
    <div className="pointer-events-none">
      <BlockEditor
        pageId={sourceId}
        initialBlocks={blocks}
        permissions={{ canEdit: false, canDelete: false, canAdd: false, canReorder: false }}
      />
    </div>
  )
}

function EntryDrawer({
  entry,
  annotations,
  onClose,
  onAnnotationAdded,
}: {
  entry: ChronicleEntry
  annotations: Annotation[]
  onClose: () => void
  onAnnotationAdded: (a: Annotation) => void
}) {
  const [annos, setAnnos] = useState<Annotation[]>(annotations)
  const [newAnno, setNewAnno] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setAnnos(annotations)
  }, [annotations])

  const submitAnnotation = async () => {
    if (!newAnno.trim()) return
    setSubmitting(true)
    try {
      const d = await post(`/chronicle/entries/${entry.id}/annotations`, {
        content: newAnno.trim(),
      })
      const created: Annotation = {
        id: d.id,
        entry_id: entry.id,
        version: d.version,
        content: newAnno.trim(),
        milestone_version: d.milestone_version || null,
        created_at: new Date().toISOString(),
      }
      setAnnos((prev) => [...prev, created])
      onAnnotationAdded(created)
      setNewAnno('')
    } catch {
      /* ignore */
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div
        className="w-[520px] h-full bg-[#14141a] border-l border-white/[0.08] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-5 py-4 border-b border-white/[0.06] shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {ENTRY_ICONS[entry.type]}
              <span className="text-[10px] text-neutral-600 uppercase tracking-wider">
                {ENTRY_LABELS[entry.type]}
              </span>
              {!!entry.is_locked && <Lock size={10} className="text-neutral-600" />}
              {entry.version_tag && (
                <span className="text-[10px] bg-blue-900/30 text-blue-400 px-1.5 py-0.5 rounded">
                  {entry.version_tag}
                </span>
              )}
            </div>
            <h2 className="text-base font-semibold text-white leading-tight">{entry.title}</h2>
            {entry.summary && (
              <p className="text-xs text-neutral-400 mt-1 leading-relaxed">{entry.summary}</p>
            )}
            {entry.start_time && (
              <p className="text-[10px] text-neutral-600 mt-1">{fmtDate(entry.start_time)}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-neutral-500 hover:text-white transition-colors shrink-0"
          >
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-5 py-4 space-y-4">
          {/* Main content by type */}
          <div>
            {entry.type === 'task' && <TaskDetail sourceId={entry.source_id} />}
            {entry.type === 'memory' && <MemoryDetail sourceId={entry.source_id} />}
            {entry.type === 'theory' && <TheoryDetail sourceId={entry.source_id} />}
          </div>

          {/* Annotations */}
          <div className="border-t border-white/[0.06] pt-4">
            <div className="text-[10px] text-neutral-600 uppercase tracking-widest mb-3">标注</div>
            {annos.length === 0 && <p className="text-xs text-neutral-600 italic mb-3">暂无标注</p>}
            {annos.map((a) => (
              <div
                key={a.id}
                className="mb-2.5 bg-white/[0.03] rounded-lg px-3 py-2 border border-white/[0.05]"
              >
                <div className="flex items-center gap-2 mb-1">
                  {a.milestone_version && (
                    <span className="text-[10px] bg-violet-900/40 text-violet-400 px-1.5 py-0.5 rounded font-mono">
                      {a.milestone_version}
                    </span>
                  )}
                  <span className="text-[10px] text-neutral-600">{fmtDate(a.created_at)}</span>
                </div>
                <p className="text-sm text-neutral-300 whitespace-pre-wrap leading-relaxed">
                  {a.content}
                </p>
              </div>
            ))}

            {/* Add annotation */}
            <div className="mt-2">
              <textarea
                value={newAnno}
                onChange={(e) => setNewAnno(e.target.value)}
                rows={2}
                placeholder="添加标注…"
                className="w-full bg-neutral-800/60 border border-neutral-700/60 rounded-lg px-3 py-2 text-sm text-neutral-200 outline-none focus:border-blue-500/50 resize-none placeholder-neutral-600"
              />
              <button
                onClick={submitAnnotation}
                disabled={submitting || !newAnno.trim()}
                className="mt-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs rounded-lg font-medium transition-colors"
              >
                {submitting ? '提交中…' : '添加标注'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Entry Chip ────────────────────────────────────────────────────────────────

function EntryChip({
  entry,
  onOpen,
  onDelete,
}: {
  entry: ChronicleEntry | CollectionItem
  onOpen: () => void
  onDelete?: () => void
}) {
  const isLocked = !!(entry as ChronicleEntry).is_locked

  return (
    <div
      className="group flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/[0.05] cursor-pointer border border-transparent hover:border-white/[0.06] transition-all"
      onClick={onOpen}
    >
      {ENTRY_ICONS[entry.type]}
      <span className="text-sm text-neutral-300 flex-1 truncate">{entry.title}</span>
      {isLocked && <Lock size={10} className="text-neutral-700 shrink-0" />}
      {'version_tag' in entry && entry.version_tag && (
        <span className="text-[10px] text-orange-500 font-mono shrink-0">{entry.version_tag}</span>
      )}
      {!isLocked && onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded hover:bg-red-500/20 text-neutral-600 hover:text-red-400 transition-all shrink-0"
          title="移除"
        >
          <Trash2 size={10} />
        </button>
      )}
    </div>
  )
}

// ── Collection Card ───────────────────────────────────────────────────────────

function CollectionCard({
  col,
  allEntries,
  allCollections,
  collectionItems,
  onEntryOpen,
  onDelete,
  onDrop,
}: {
  col: Collection
  allEntries: ChronicleEntry[]
  allCollections: Collection[]
  collectionItems: Record<string, CollectionItem[]>
  onEntryOpen: (entry: ChronicleEntry | CollectionItem) => void
  onDelete: (colId: string) => void
  onDrop: (colId: string, entryId: string) => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(col.name)
  const [contentExpanded, setContentExpanded] = useState(false)
  const [localBlocks, setLocalBlocks] = useState<Block[] | undefined>(undefined)
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const isLocked = !!col.is_locked
  const borderColor = col.color || '#6366f1'
  const items = collectionItems[col.id] || []
  const children = allCollections
    .filter((c) => c.parent_id === col.id)
    .sort((a, b) => a.sort_order - b.sort_order)

  // 解析 content blocks
  useEffect(() => {
    if (col.content) {
      try {
        const parsed = JSON.parse(col.content)
        if (Array.isArray(parsed)) {
          setLocalBlocks(parsed)
        }
      } catch {
        setLocalBlocks(undefined)
      }
    }
  }, [col.content])

  // 获取第一行作为预览标题
  const contentPreview = useMemo(() => getCollectionTitleFromBlocks(col.content), [col.content])

  const commitName = async () => {
    setEditingName(false)
    const t = nameDraft.trim()
    if (t && t !== col.name)
      await patch(`/chronicle/collections/${col.id}`, { name: t }).catch(console.error)
  }

  const updateColor = async (color: string) => {
    await patch(`/chronicle/collections/${col.id}`, { color }).catch(console.error)
  }

  const handleContentChange = (blocks: Block[]) => {
    setLocalBlocks(blocks)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      patch(`/chronicle/collections/${col.id}`, { content: JSON.stringify(blocks) }).catch(
        console.error
      )
    }, 800)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    try {
      const d = JSON.parse(e.dataTransfer.getData('application/json'))
      if (d.entry_id) onDrop(col.id, d.entry_id)
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      className={`mb-3 rounded-xl border border-white/[0.06] ${isDragOver ? 'ring-2 ring-blue-500/40' : ''}`}
      style={{ borderLeft: `3px solid ${borderColor}` }}
      onDragOver={!isLocked ? handleDragOver : undefined}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={!isLocked ? handleDrop : undefined}
    >
      {/* Collection header */}
      <div className="flex items-center gap-2 px-3 py-2.5 group">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="text-neutral-600 hover:text-neutral-400 shrink-0"
        >
          {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
        </button>
        <span className="text-sm shrink-0">{col.cover_icon ?? '📦'}</span>
        {editingName && !isLocked ? (
          <input
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitName()
              if (e.key === 'Escape') setEditingName(false)
            }}
            className="flex-1 bg-transparent border-b border-white/20 text-sm text-white outline-none"
          />
        ) : (
          <span
            className={`flex-1 text-sm font-medium text-neutral-200 ${!isLocked ? 'cursor-text' : ''}`}
            onDoubleClick={() => !isLocked && setEditingName(true)}
          >
            {col.name}
          </span>
        )}
        {/* 颜色选择器 */}
        <ColorPicker value={col.color} onChange={updateColor} disabled={isLocked} />
        {isLocked && <Lock size={11} className="text-neutral-600 shrink-0" />}
        {!isLocked && (
          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100">
            <button
              onClick={() => {
                setNameDraft(col.name)
                setEditingName(true)
              }}
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-neutral-600 hover:text-neutral-300 transition-colors"
            >
              <Edit2 size={10} />
            </button>
            <button
              onClick={() => onDelete(col.id)}
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-500/20 text-neutral-600 hover:text-red-400 transition-colors"
            >
              <Trash2 size={10} />
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      {!collapsed && (
        <div className="px-3 pb-3">
          {/* 集合内容预览/编辑区 */}
          {(col.content || !isLocked) && (
            <div className="mb-3">
              {!contentExpanded ? (
                <button
                  onClick={() => !isLocked && setContentExpanded(true)}
                  className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-left transition-colors ${
                    isLocked ? 'opacity-60 cursor-default' : 'hover:bg-white/5'
                  }`}
                >
                  <BookOpen size={11} className="text-neutral-500 shrink-0" />
                  <span className="text-xs text-neutral-400 flex-1 truncate">
                    {contentPreview || (isLocked ? '无内容' : '点击编辑内容...')}
                  </span>
                  {!isLocked && <span className="text-[10px] text-neutral-600">编辑</span>}
                </button>
              ) : (
                <div className="border border-white/10 rounded-lg p-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-neutral-600 uppercase tracking-widest">
                      内容
                    </span>
                    <button
                      onClick={() => setContentExpanded(false)}
                      className="text-[10px] text-neutral-500 hover:text-neutral-300"
                    >
                      收起
                    </button>
                  </div>
                  <div className={isLocked ? 'pointer-events-none opacity-70' : ''}>
                    <BlockEditor
                      pageId={`col-${col.id}`}
                      initialBlocks={localBlocks}
                      onChange={isLocked ? undefined : handleContentChange}
                      permissions={
                        isLocked
                          ? { canEdit: false, canDelete: false, canAdd: false, canReorder: false }
                          : undefined
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Entry chips */}
          {items.map((item) => {
            const fullEntry = allEntries.find((e) => e.id === item.entry_id)
            return (
              <EntryChip
                key={item.entry_id}
                entry={fullEntry || item}
                onOpen={() => onEntryOpen(fullEntry || item)}
                onDelete={
                  !isLocked
                    ? () => del(`/chronicle/collections/${col.id}/items/${item.entry_id}`)
                    : undefined
                }
              />
            )
          })}

          {/* Nested child collections */}
          {children.map((child) => (
            <div key={child.id} className="ml-4 mt-2">
              <CollectionCard
                col={child}
                allEntries={allEntries}
                allCollections={allCollections}
                collectionItems={collectionItems}
                onEntryOpen={onEntryOpen}
                onDelete={onDelete}
                onDrop={onDrop}
              />
            </div>
          ))}

          {!isLocked && (
            <div className="mt-2 text-[10px] text-neutral-700 pl-2">拖入条目添加到此集合</div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Milestone Section ─────────────────────────────────────────────────────────

function MilestoneSection({
  ms,
  idx,
  allEntries,
  allCollections,
  collectionItems,
  onEntryOpen,
  onRefresh,
}: {
  ms: Milestone
  idx: number
  allEntries: ChronicleEntry[]
  allCollections: Collection[]
  collectionItems: Record<string, CollectionItem[]>
  onEntryOpen: (entry: ChronicleEntry | CollectionItem) => void
  onRefresh: () => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [publishing, setPublishing] = useState(false)

  const isPublished = !!ms.is_published
  const msEntries = allEntries.filter((e) => e.milestone_id === ms.id)
  const msCols = allCollections.filter((c) => c.milestone_id === ms.id && !c.parent_id)

  // Entries that are in this milestone but NOT in any collection
  const inCollectionEntryIds = new Set(
    Object.values(collectionItems)
      .flat()
      .map((ci: CollectionItem) => ci.entry_id)
  )
  const standaloneEntries = msEntries.filter((e) => !inCollectionEntryIds.has(e.id))

  const publish = async () => {
    if (!window.confirm(`发布里程碑 V${idx + 1} "${ms.title}"？发布后将锁定所有关联条目和集合。`))
      return
    setPublishing(true)
    try {
      await post(`/chronicle/milestones/${ms.id}/publish`, {})
      onRefresh()
    } catch {
      /* ignore */
    } finally {
      setPublishing(false)
    }
  }

  const deleteMs = async () => {
    if (!window.confirm(`删除里程碑 "${ms.title}"？关联条目将变为未分配状态。`)) return
    try {
      await del(`/chronicle/milestones/${ms.id}`)
      onRefresh()
    } catch {
      /* ignore */
    }
  }

  const deleteCollection = async (colId: string) => {
    if (!window.confirm('删除此集合？')) return
    try {
      await del(`/chronicle/collections/${colId}`)
      onRefresh()
    } catch {
      /* ignore */
    }
  }

  const handleDrop = async (colId: string, entryId: string) => {
    try {
      await post(`/chronicle/collections/${colId}/items`, { entry_id: entryId })
      onRefresh()
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="mb-8">
      {/* Milestone header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="text-neutral-600 hover:text-neutral-300"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
        <Flag size={14} className={isPublished ? 'text-violet-400' : 'text-yellow-500'} />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">
              V{idx + 1} · {ms.title}
            </span>
            {isPublished ? (
              <span className="flex items-center gap-1 text-[10px] text-violet-400 bg-violet-900/30 px-1.5 py-0.5 rounded">
                <Lock size={9} /> 已发布
              </span>
            ) : (
              <span className="text-[10px] text-yellow-500 bg-yellow-900/20 px-1.5 py-0.5 rounded">
                未发布
              </span>
            )}
          </div>
          {(ms.cover_start || ms.cover_end) && (
            <div className="text-[10px] text-neutral-600 mt-0.5">
              {ms.cover_start && fmtDate(ms.cover_start)}
              {ms.cover_start && ms.cover_end && ' — '}
              {ms.cover_end && fmtDate(ms.cover_end)}
            </div>
          )}
        </div>
        {!isPublished && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={publish}
              disabled={publishing}
              className="px-3 py-1 text-[11px] bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white rounded-lg font-medium transition-colors"
            >
              {publishing ? '发布中…' : `发布 V${idx + 1}`}
            </button>
            <button
              onClick={deleteMs}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-500/20 text-neutral-600 hover:text-red-400 transition-colors"
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>

      {!collapsed && (
        <div className="pl-6 border-l border-white/[0.04]">
          {/* Collections */}
          {msCols.map((col) => (
            <CollectionCard
              key={col.id}
              col={col}
              allEntries={allEntries}
              allCollections={allCollections}
              collectionItems={collectionItems}
              onEntryOpen={onEntryOpen}
              onDelete={deleteCollection}
              onDrop={handleDrop}
            />
          ))}

          {/* Standalone entries (in milestone but not in any collection) */}
          {standaloneEntries.map((e) => (
            <EntryChip key={e.id} entry={e} onOpen={() => onEntryOpen(e)} />
          ))}

          {msCols.length === 0 && standaloneEntries.length === 0 && (
            <p className="text-xs text-neutral-700 italic py-2">此里程碑暂无条目</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Library Panel ─────────────────────────────────────────────────────────────

function LibraryPanel({
  entries,
  collectionItems,
  onEntryOpen,
}: {
  entries: ChronicleEntry[]
  collectionItems: Record<string, CollectionItem[]>
  onEntryOpen: (entry: ChronicleEntry) => void
}) {
  const [tab, setTab] = useState<'task' | 'memory' | 'theory'>('task')

  const inCollectionIds = new Set(
    Object.values(collectionItems)
      .flat()
      .map((ci: CollectionItem) => ci.entry_id)
  )
  const unassigned = entries.filter(
    (e) => !e.milestone_id && !inCollectionIds.has(e.id) && e.type === tab
  )

  const handleDragStart = (e: React.DragEvent, entry: ChronicleEntry) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ entry_id: entry.id }))
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div className="flex flex-col h-full bg-[#101015] border-l border-white/[0.06]">
      <div className="px-3 py-2 border-b border-white/[0.06] shrink-0">
        <div className="text-[10px] text-neutral-500 uppercase tracking-widest font-semibold mb-2">
          Library
        </div>
        <div className="flex gap-1">
          {(['task', 'memory', 'theory'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${tab === t ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
            >
              {t === 'task' ? 'Tasks' : t === 'memory' ? 'Memory' : 'Theory'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto py-2">
        {unassigned.length === 0 ? (
          <p className="text-xs text-neutral-700 italic px-3 py-4">无未归入集合的条目</p>
        ) : (
          unassigned.map((e) => (
            <div
              key={e.id}
              draggable
              onDragStart={(ev) => handleDragStart(ev, e)}
              className="group flex items-center gap-2 px-3 py-1.5 cursor-grab hover:bg-white/[0.04] transition-colors"
            >
              {ENTRY_ICONS[e.type]}
              <span className="flex-1 text-xs text-neutral-300 truncate">{e.title}</span>
              <button
                onClick={() => onEntryOpen(e)}
                className="opacity-0 group-hover:opacity-100 text-[10px] text-blue-400 hover:text-blue-300 transition-all shrink-0"
              >
                查看
              </button>
              <span className="opacity-0 group-hover:opacity-100 text-[10px] text-neutral-600 shrink-0">
                拖→
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ── Create Milestone Modal ────────────────────────────────────────────────────

function CreateMilestoneModal({ onDone, onClose }: { onDone: () => void; onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)

  const create = async () => {
    if (!title.trim()) return
    setLoading(true)
    try {
      await post('/chronicle/milestones', { title: title.trim() })
      onDone()
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-[#1e1e1e] border border-white/15 rounded-xl p-5 w-[400px]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Flag size={14} className="text-yellow-500" /> 新建里程碑
        </h3>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && create()}
          placeholder="里程碑标题…"
          className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500 mb-3"
        />
        <div className="flex gap-2">
          <button
            onClick={create}
            disabled={loading || !title.trim()}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded text-sm"
          >
            {loading ? '创建中…' : '创建'}
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-neutral-700 hover:bg-neutral-600 text-white rounded text-sm"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Create Collection Modal ───────────────────────────────────────────────────

function CreateCollectionModal({
  milestones,
  onDone,
  onClose,
}: {
  milestones: Milestone[]
  onDone: () => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [milestoneId, setMilestoneId] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const create = async () => {
    if (!name.trim()) return
    setLoading(true)
    try {
      await post('/chronicle/collections', {
        name: name.trim(),
        milestone_id: milestoneId || null,
      })
      onDone()
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-[#1e1e1e] border border-white/15 rounded-xl p-5 w-[400px]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Package size={14} className="text-blue-400" /> 新建集合
        </h3>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && create()}
          placeholder="集合名称…"
          className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500 mb-2"
        />
        <select
          value={milestoneId}
          onChange={(e) => setMilestoneId(e.target.value)}
          className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-neutral-300 outline-none mb-3"
        >
          <option value="">不关联里程碑（散条目区）</option>
          {milestones.map((ms, i) => (
            <option key={ms.id} value={ms.id}>
              V{i + 1} · {ms.title}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <button
            onClick={create}
            disabled={loading || !name.trim()}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded text-sm"
          >
            {loading ? '创建中…' : '创建'}
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-neutral-700 hover:bg-neutral-600 text-white rounded text-sm"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Chronicle Graph View ──────────────────────────────────────────────────────

const TYPE_COLOR: Record<string, string> = {
  memory: '#22c55e',
  task: '#3b82f6',
  theory: '#f97316',
}

interface NodePos { x: number; y: number }

const COLS_PER_ROW = 5
const NODE_SPACING_X = 140
const NODE_SPACING_Y = 120
const BAND_PADDING = 50

function computeInitialLayout(
  entries: ChronicleEntry[],
  milestones: Milestone[]
): Record<string, NodePos> {
  const positions: Record<string, NodePos> = {}
  const msIds = milestones.map((m) => m.id)
  const groups: Record<string, ChronicleEntry[]> = { _none: [] }
  msIds.forEach((id) => { groups[id] = [] })
  entries.forEach((e) => {
    const key = e.milestone_id && groups[e.milestone_id] ? e.milestone_id : '_none'
    groups[key].push(e)
  })

  let yOffset = 60
  const orderedKeys = [...msIds, '_none']
  orderedKeys.forEach((msId) => {
    const group = groups[msId] || []
    if (!group.length) return
    const rows = Math.ceil(group.length / COLS_PER_ROW)
    group.forEach((e, i) => {
      const col = i % COLS_PER_ROW
      const row = Math.floor(i / COLS_PER_ROW)
      positions[e.id] = {
        x: BAND_PADDING + col * NODE_SPACING_X + NODE_SPACING_X / 2,
        y: yOffset + row * NODE_SPACING_Y + NODE_SPACING_Y / 2,
      }
    })
    yOffset += rows * NODE_SPACING_Y + BAND_PADDING
  })
  return positions
}

function ChronicleGraphView({
  entries,
  milestones,
  collectionItems,
  collectionLinks,
  entryLinks = [],
  onEntryOpen,
  onDataChange,
}: {
  entries: ChronicleEntry[]
  milestones: Milestone[]
  collectionItems: Record<string, CollectionItem[]>
  collectionLinks: CollectionLink[]
  entryLinks?: EntryLink[]
  onEntryOpen: (e: ChronicleEntry) => void
  onDataChange?: () => void
}) {
  const [positions, setPositions] = useState<Record<string, NodePos>>(() =>
    computeInitialLayout(entries, milestones)
  )
  const [transform, setTransform] = useState({ x: 40, y: 20, scale: 1 })
  const [dragging, setDragging] = useState<{ id: string; ox: number; oy: number } | null>(null)
  const [draggingEdge, setDraggingEdge] = useState<{ fromId: string; start: NodePos; current: NodePos } | null>(null)
  const [panning, setPanning] = useState<{ sx: number; sy: number; tx: number; ty: number } | null>(null)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [hoverEdgeId, setHoverEdgeId] = useState<string | null>(null)
  const [creatingEdge, setCreatingEdge] = useState<{ fromId: string; toId: string } | null>(null)
  const svgRef = React.useRef<SVGSVGElement>(null)

  useEffect(() => {
    setPositions(computeInitialLayout(entries, milestones))
  }, [entries.length, milestones.length])

  const createEntryLink = async (from_id: string, to_id: string, relation_hint: string) => {
    try {
      await post('/chronicle/entry-links', { from_id, to_id, relation_hint })
      onDataChange?.()
    } catch { /* ignore */ }
  }

  const deleteEntryLink = async (id: string) => {
    if (!window.confirm('删除此关联？')) return
    try {
      await del(`/chronicle/entry-links/${id}`)
      onDataChange?.()
    } catch { /* ignore */ }
  }

  const handleEdgeAnchorMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    const pos = positions[id]
    if (!pos) return
    const svgXY = toSvgXY(e.clientX, e.clientY)
    setDraggingEdge({ fromId: id, start: { x: pos.x, y: pos.y }, current: svgXY })
  }

  const handleEdgeDragEnd = () => {
    if (!draggingEdge || !hoverId || hoverId === draggingEdge.fromId) {
      setDraggingEdge(null)
      return
    }
    setCreatingEdge({ fromId: draggingEdge.fromId, toId: hoverId })
    setDraggingEdge(null)
  }

  // Build edges from collection memberships + collection links + entry_links
  const edges = useMemo(() => {
    const result: Array<{ id?: string; from: string; to: string; label?: string; isEntryLink?: boolean }> = []
    // Collection links (explicit)
    collectionLinks.forEach((link) => {
      if (positions[link.from_id] && positions[link.to_id]) {
        result.push({ id: link.id, from: link.from_id, to: link.to_id, label: link.label || undefined })
      }
    })
    // Entry links (graph relation)
    entryLinks.forEach((link) => {
      if (positions[link.from_id] && positions[link.to_id]) {
        result.push({ id: link.id, from: link.from_id, to: link.to_id, label: link.relation_hint || undefined, isEntryLink: true })
      }
    })
    // Sequential edges within each collection (item chain)
    Object.values(collectionItems).forEach((items) => {
      for (let i = 0; i < items.length - 1; i++) {
        const a = items[i].entry_id
        const b = items[i + 1].entry_id
        if (positions[a] && positions[b]) result.push({ from: a, to: b })
      }
    })
    return result
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionLinks, entryLinks, collectionItems, positions])

  const toSvgXY = (clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: (clientX - rect.left - transform.x) / transform.scale,
      y: (clientY - rect.top - transform.y) / transform.scale,
    }
  }

  const handleNodeMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    const svgXY = toSvgXY(e.clientX, e.clientY)
    const pos = positions[id] || { x: 0, y: 0 }
    setDragging({ id, ox: svgXY.x - pos.x, oy: svgXY.y - pos.y })
  }

  const handleSvgMouseDown = (e: React.MouseEvent) => {
    if (dragging) return
    setPanning({ sx: e.clientX, sy: e.clientY, tx: transform.x, ty: transform.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragging) {
      const svgXY = toSvgXY(e.clientX, e.clientY)
      setPositions((prev) => ({
        ...prev,
        [dragging.id]: { x: svgXY.x - dragging.ox, y: svgXY.y - dragging.oy },
      }))
    } else if (draggingEdge) {
      const svgXY = toSvgXY(e.clientX, e.clientY)
      setDraggingEdge((prev) => prev ? { ...prev, current: svgXY } : null)
    } else if (panning) {
      setTransform((prev) => ({
        ...prev,
        x: panning.tx + (e.clientX - panning.sx),
        y: panning.ty + (e.clientY - panning.sy),
      }))
    }
  }

  const handleMouseUp = () => {
    setDragging(null)
    handleEdgeDragEnd()
    setPanning(null)
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const factor = e.deltaY > 0 ? 0.9 : 1.1
    setTransform((prev) => ({
      ...prev,
      scale: Math.max(0.25, Math.min(3, prev.scale * factor)),
    }))
  }

  if (!entries.length) {
    return (
      <div className="flex flex-col items-center justify-center h-60 text-neutral-600">
        <Network size={32} className="mb-3 opacity-30" />
        <p className="text-sm">Chronicle 为空</p>
        <p className="text-xs mt-1">发布条目后图谱开始构建</p>
      </div>
    )
  }

  const NODE_R = 18

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Controls */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
        <button
          onClick={() => setTransform({ x: 40, y: 20, scale: 1 })}
          className="px-2.5 py-1 text-xs text-neutral-500 hover:text-neutral-300 bg-white/5 hover:bg-white/10 rounded transition-colors border border-white/10"
        >
          重置
        </button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-4 text-[10px] text-neutral-600">
        {(['memory', 'task', 'theory'] as const).map((t) => (
          <div key={t} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: TYPE_COLOR[t] }} />
            <span>{t}</span>
          </div>
        ))}
        <span className="text-neutral-700 ml-1">· 拖拽节点 · 滚轮缩放 · 拖拽背景平移</span>
      </div>

      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{ cursor: dragging ? 'grabbing' : draggingEdge ? 'crosshair' : panning ? 'grabbing' : 'grab' }}
        onMouseDown={handleSvgMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <defs>
          <marker id="cg-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="#374151" />
          </marker>
          <marker id="cg-arrow-active" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="#4f46e5" />
          </marker>
        </defs>

        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>

          {/* Milestone background bands */}
          {milestones.map((ms, idx) => {
            const msEntries = entries.filter((e) => e.milestone_id === ms.id)
            if (!msEntries.length) return null
            const pos = msEntries.map((e) => positions[e.id]).filter(Boolean)
            if (!pos.length) return null
            const xs = pos.map((p) => p.x)
            const ys = pos.map((p) => p.y)
            const pad = 36
            const minX = Math.min(...xs) - pad
            const maxX = Math.max(...xs) + pad
            const minY = Math.min(...ys) - pad
            const maxY = Math.max(...ys) + pad
            const hue = (idx * 53) % 360
            return (
              <g key={ms.id}>
                <rect
                  x={minX} y={minY}
                  width={maxX - minX} height={maxY - minY}
                  rx={10}
                  fill={`hsla(${hue},30%,20%,0.18)`}
                  stroke={`hsla(${hue},40%,55%,0.25)`}
                  strokeWidth={1}
                  strokeDasharray="4,3"
                />
                <text
                  x={minX + 10} y={minY + 14}
                  fontSize={9}
                  fill={`hsla(${hue},50%,65%,0.55)`}
                  style={{ userSelect: 'none' }}
                >
                  {ms.title}
                </text>
              </g>
            )
          })}

          {/* Dragging edge */}
          {draggingEdge && (
            <line
              x1={draggingEdge.start.x}
              y1={draggingEdge.start.y}
              x2={draggingEdge.current.x}
              y2={draggingEdge.current.y}
              stroke="#4f46e5"
              strokeWidth={1.5}
              strokeDasharray="4,2"
              markerEnd="url(#cg-arrow-active)"
            />
          )}

          {/* Edges */}
          {edges.map((edge, i) => {
            const from = positions[edge.from]
            const to = positions[edge.to]
            if (!from || !to) return null
            // offset endpoints to stop at node radius
            const dx = to.x - from.x
            const dy = to.y - from.y
            const len = Math.sqrt(dx * dx + dy * dy) || 1
            const ux = dx / len
            const uy = dy / len
            const midX = (from.x + to.x) / 2
            const midY = (from.y + to.y) / 2
            const isHovered = hoverEdgeId === edge.id && edge.isEntryLink
            const strokeColor = edge.isEntryLink ? '#4f46e5' : '#374151'
            return (
              <g key={edge.id || i}>
                <line
                  x1={from.x + ux * NODE_R} y1={from.y + uy * NODE_R}
                  x2={to.x - ux * (NODE_R + 5)} y2={to.y - uy * (NODE_R + 5)}
                  stroke={isHovered ? '#6366f1' : strokeColor}
                  strokeWidth={isHovered ? 2 : 1}
                  strokeDasharray={edge.isEntryLink ? 'none' : '3,3'}
                  markerEnd={isHovered ? 'url(#cg-arrow-active)' : 'url(#cg-arrow)'}
                  onMouseEnter={() => edge.id && setHoverEdgeId(edge.id)}
                  onMouseLeave={() => setHoverEdgeId(null)}
                />
                {edge.label && (
                  <text
                    x={midX}
                    y={midY - 4}
                    textAnchor="middle"
                    fontSize={8}
                    fill={isHovered ? '#a5b4fc' : '#4b5563'}
                    style={{ userSelect: 'none' }}
                  >
                    {edge.label}
                  </text>
                )}
                {isHovered && (
                  <circle
                    cx={midX}
                    cy={midY + 4}
                    r={6}
                    fill="#ef4444"
                    stroke="#dc2626"
                    strokeWidth={1}
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      edge.id && deleteEntryLink(edge.id)
                    }}
                  >
                    <title>删除关联</title>
                  </circle>
                )}
              </g>
            )
          })}

          {/* Nodes */}
          {entries.map((e) => {
            const pos = positions[e.id]
            if (!pos) return null
            const color = TYPE_COLOR[e.type] || '#6b7280'
            const isHovered = hoverId === e.id
            const isDragging = dragging?.id === e.id
            const label = e.title.length > 14 ? e.title.slice(0, 14) + '…' : e.title
            const emoji = e.type === 'memory' ? '🧠' : e.type === 'task' ? '✅' : '📖'
            return (
              <g
                key={e.id}
                transform={`translate(${pos.x},${pos.y})`}
                onMouseDown={(ev) => handleNodeMouseDown(ev, e.id)}
                onMouseEnter={() => setHoverId(e.id)}
                onMouseLeave={() => setHoverId(null)}
                onClick={(ev) => {
                  if (!isDragging && !draggingEdge) { ev.stopPropagation(); onEntryOpen(e) }
                }}
                style={{ cursor: isDragging ? 'grabbing' : draggingEdge ? 'crosshair' : 'pointer' }}
              >
                {/* Glow ring on hover */}
                {isHovered && (
                  <circle r={NODE_R + 8} fill={`${color}18`} stroke={`${color}40`} strokeWidth={1} />
                )}
                <circle
                  r={NODE_R}
                  fill={`${color}22`}
                  stroke={color}
                  strokeWidth={isHovered ? 2 : 1.5}
                />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={13}
                  style={{ userSelect: 'none' }}
                >
                  {emoji}
                </text>
                <text
                  y={NODE_R + 13}
                  textAnchor="middle"
                  fontSize={9}
                  fill={isHovered ? '#d1d5db' : '#6b7280'}
                  style={{ userSelect: 'none' }}
                >
                  {label}
                </text>
                {/* Locked badge */}
                {e.is_locked ? (
                  <circle cx={NODE_R - 5} cy={-NODE_R + 5} r={4} fill="#292524" stroke="#78716c" strokeWidth={1} />
                ) : null}
                {/* Connection anchor point (visible on hover) */}
                {isHovered && !dragging && (
                  <circle
                    cx={NODE_R * Math.cos(Math.PI / 4)}
                    cy={NODE_R * Math.sin(Math.PI / 4)}
                    r={4}
                    fill="#4f46e5"
                    stroke="#818cf8"
                    strokeWidth={1.5}
                    style={{ cursor: 'crosshair' }}
                    onMouseDown={(ev) => handleEdgeAnchorMouseDown(ev, e.id)}
                  />
                )}
              </g>
            )
          })}

        </g>
      </svg>

      {/* Create edge modal */}
      {creatingEdge && (
        <div className="absolute inset-0 z-20 bg-black/40 flex items-center justify-center">
          <div className="bg-[#1e1e1e] border border-white/15 rounded-xl p-4 w-80 shadow-2xl">
            <h3 className="text-sm font-semibold text-white mb-3">新建关联</h3>
            <div className="text-xs text-neutral-400 mb-3">
              从 <span className="text-blue-400">{entries.find((e) => e.id === creatingEdge.fromId)?.title || '?'}</span>
              {' → '}
              到 <span className="text-blue-400">{entries.find((e) => e.id === creatingEdge.toId)?.title || '?'}</span>
            </div>
            <input
              autoFocus
              placeholder="关系描述（可选）"
              className="w-full bg-black/30 border border-white/15 rounded-lg px-3 py-2 text-xs text-white mb-4 outline-none focus:border-blue-500"
              onKeyDown={async (e) => {
                if (e.key === 'Enter') {
                  await createEntryLink(creatingEdge.fromId, creatingEdge.toId, e.currentTarget.value)
                  setCreatingEdge(null)
                }
              }}
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setCreatingEdge(null)}
                className="px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200"
              >
                取消
              </button>
              <button
                onClick={async () => {
                  const input = document.querySelector('input[placeholder="关系描述（可选）"]') as HTMLInputElement
                  await createEntryLink(creatingEdge.fromId, creatingEdge.toId, input?.value || '')
                  setCreatingEdge(null)
                }}
                className="px-3 py-1.5 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Chronicle View ───────────────────────────────────────────────────────

interface ChronicleData {
  milestones: Milestone[]
  entries: ChronicleEntry[]
  collections: Collection[]
  collection_links: CollectionLink[]
  entry_links: EntryLink[]
}

export default function ChronicleView() {
  const [data, setData] = useState<ChronicleData | null>(null)
  const [loading, setLoading] = useState(true)
  const [colItems, setColItems] = useState<Record<string, CollectionItem[]>>({})
  const [view, setView] = useState<'timeline' | 'workflow'>('timeline')
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [drawer, setDrawer] = useState<DrawerContent | null>(null)
  const [showNewMs, setShowNewMs] = useState(false)
  const [showNewCol, setShowNewCol] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const d: ChronicleData = await apiFetch('/chronicle')
      setData(d)

      // Load collection items for each collection
      const itemsMap: Record<string, CollectionItem[]> = {}
      await Promise.all(
        d.collections.map(async (col) => {
          try {
            const colData = await apiFetch(`/chronicle/collections/${col.id}`)
            itemsMap[col.id] = colData.items || []
          } catch {
            itemsMap[col.id] = []
          }
        })
      )
      setColItems(itemsMap)
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const openEntry = useCallback(async (entry: ChronicleEntry | CollectionItem) => {
    // Fetch full entry with annotations
    try {
      const d = await apiFetch(`/chronicle/entries/${entry.id}`)
      setDrawer({
        entry: d as ChronicleEntry,
        annotations: d.annotations || [],
      })
    } catch {
      // Minimal drawer if fetch fails
      setDrawer({
        entry: entry as ChronicleEntry,
        annotations: [],
      })
    }
  }, [])

  const handleAnnotationAdded = useCallback((a: Annotation) => {
    setDrawer((prev) => (prev ? { ...prev, annotations: [...prev.annotations, a] } : null))
  }, [])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-neutral-500 text-sm bg-[#0d0d0f]">
        加载 Chronicle…
      </div>
    )
  }

  const milestones = (data?.milestones || [])
    .slice()
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  const entries = data?.entries || []
  const collections = data?.collections || []

  // Unassigned entries: no milestone_id, not in any collection
  const inColIds = new Set(
    Object.values(colItems)
      .flat()
      .map((ci: CollectionItem) => ci.entry_id)
  )
  const unassignedEntries = entries.filter((e) => !e.milestone_id && !inColIds.has(e.id))

  // Unassigned collections (no milestone_id, no parent_id)
  const unassignedCols = collections.filter((c) => !c.milestone_id && !c.parent_id)

  const deleteCollection = async (colId: string) => {
    if (!window.confirm('删除此集合？')) return
    try {
      await del(`/chronicle/collections/${colId}`)
      loadData()
    } catch {
      /* ignore */
    }
  }

  const handleDrop = async (colId: string, entryId: string) => {
    try {
      await post(`/chronicle/collections/${colId}/items`, { entry_id: entryId })
      loadData()
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      className="h-full flex flex-col bg-[#0d0d0f]"
      style={{ fontFamily: "'PingFang SC','SF Pro Text',system-ui,sans-serif" }}
    >
      {/* Top bar */}
      <div className="shrink-0 px-5 py-2.5 border-b border-white/[0.06] flex items-center gap-3">
        <Archive size={18} className="text-violet-400 shrink-0" />
        <h1 className="text-sm font-semibold text-white">Chronicle</h1>

        {/* View switcher */}
        <div className="flex items-center gap-1 bg-white/[0.06] rounded-lg p-0.5 ml-2">
          <button
            onClick={() => setView('timeline')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${view === 'timeline' ? 'bg-white/15 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
          >
            <LayoutList size={12} /> Timeline
          </button>
          <button
            onClick={() => setView('workflow')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${view === 'workflow' ? 'bg-white/15 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
          >
            <Network size={12} /> Workflow
          </button>
        </div>

        <div className="flex-1" />

        <button
          onClick={() => setShowNewCol(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-neutral-500 hover:text-neutral-200 hover:bg-white/8 transition-colors border border-transparent hover:border-white/10"
        >
          <Plus size={12} /> 集合
        </button>
        <button
          onClick={() => setShowNewMs(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-neutral-500 hover:text-neutral-200 hover:bg-white/8 transition-colors border border-transparent hover:border-white/10"
        >
          <Flag size={12} /> 里程碑
        </button>
        <button
          onClick={() => setLibraryOpen((o) => !o)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${libraryOpen ? 'text-white bg-white/10 border-white/15' : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/8 border-transparent hover:border-white/10'}`}
        >
          <PanelRight size={12} /> Library
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Timeline / Workflow */}
        <div className={`flex-1 overflow-hidden ${view === 'timeline' ? 'overflow-auto px-6 py-5' : ''}`}>
          {view === 'timeline' ? (
            <>
              {/* Milestones in chronological order */}
              {milestones.map((ms, idx) => (
                <MilestoneSection
                  key={ms.id}
                  ms={ms}
                  idx={idx}
                  allEntries={entries}
                  allCollections={collections}
                  collectionItems={colItems}
                  onEntryOpen={openEntry}
                  onRefresh={loadData}
                />
              ))}

              {/* Unassigned collections */}
              {unassignedCols.length > 0 && (
                <div className="mb-6">
                  <div className="text-[10px] text-neutral-600 uppercase tracking-widest font-semibold mb-3">
                    散集合
                  </div>
                  {unassignedCols.map((col) => (
                    <CollectionCard
                      key={col.id}
                      col={col}
                      allEntries={entries}
                      allCollections={collections}
                      collectionItems={colItems}
                      onEntryOpen={openEntry}
                      onDelete={deleteCollection}
                      onDrop={handleDrop}
                    />
                  ))}
                </div>
              )}

              {/* Unassigned standalone entries */}
              {unassignedEntries.length > 0 && (
                <div className="mb-6">
                  <div className="text-[10px] text-neutral-600 uppercase tracking-widest font-semibold mb-3">
                    未分配条目
                  </div>
                  {unassignedEntries.map((e) => (
                    <EntryChip key={e.id} entry={e} onOpen={() => openEntry(e)} />
                  ))}
                </div>
              )}

              {milestones.length === 0 && unassignedEntries.length === 0 && (
                <div className="flex flex-col items-center justify-center h-60 text-neutral-600">
                  <Archive size={32} className="mb-3 opacity-30" />
                  <p className="text-sm">Chronicle 为空</p>
                  <p className="text-xs mt-1">从 Memory 或 Tasks 发布条目后显示</p>
                </div>
              )}
            </>
          ) : (
            <ChronicleGraphView
              entries={entries}
              milestones={milestones}
              collectionItems={colItems}
              collectionLinks={data?.collection_links || []}
              entryLinks={data?.entry_links || []}
              onEntryOpen={openEntry}
              onDataChange={loadData}
            />
          )}
        </div>

        {/* Library panel */}
        {libraryOpen && (
          <div className="w-64 shrink-0 overflow-hidden">
            <LibraryPanel entries={entries} collectionItems={colItems} onEntryOpen={openEntry} />
          </div>
        )}
      </div>

      {/* Entry drawer */}
      {drawer && (
        <EntryDrawer
          entry={drawer.entry}
          annotations={drawer.annotations}
          onClose={() => setDrawer(null)}
          onAnnotationAdded={handleAnnotationAdded}
        />
      )}

      {/* Modals */}
      {showNewMs && (
        <CreateMilestoneModal
          onDone={() => {
            setShowNewMs(false)
            loadData()
          }}
          onClose={() => setShowNewMs(false)}
        />
      )}
      {showNewCol && (
        <CreateCollectionModal
          milestones={milestones}
          onDone={() => {
            setShowNewCol(false)
            loadData()
          }}
          onClose={() => setShowNewCol(false)}
        />
      )}
    </div>
  )
}
