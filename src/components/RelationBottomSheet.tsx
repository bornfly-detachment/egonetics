/**
 * RelationBottomSheet.tsx
 * 底部半屏关系详情面板：
 *   - meta 编辑（类型、标题）自动保存
 *   - BlockEditor 富文本内容区
 *   - 发布 / 版本历史
 *   - 删除确认
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  X, Trash2, GitBranch, Clock, ChevronDown, ChevronUp,
  AlertTriangle, Loader2,
} from 'lucide-react'
import { authFetch } from '../lib/http'
import BlockEditor from './BlockEditor'
import type { Block, Relation, ProcessVersion } from './types'

// ── 局部类型 ───────────────────────────────────────────────────────

interface RelationType  { id: string; label: string; color: string }
interface EntityData    { id: string; entityType: string; title: string; icon: string }

interface Props {
  relation:      Relation
  relationTypes: RelationType[]
  entityMap:     Record<string, EntityData>
  onClose:       () => void
  onUpdate:      (patch: Partial<Relation>) => void
  onDelete:      () => void
}

// ── Helpers ────────────────────────────────────────────────────────

const fmtDate = (s: string) =>
  new Date(s).toLocaleString('zh-CN', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })

// ── Component ──────────────────────────────────────────────────────

const RelationBottomSheet: React.FC<Props> = ({
  relation, relationTypes, entityMap, onClose, onUpdate, onDelete,
}) => {
  // ── Block state ──────────────────────────────────────────────
  const [blocks,        setBlocks]        = useState<Block[]>([])
  const [blocksLoading, setBlocksLoading] = useState(true)

  // ── Version state ────────────────────────────────────────────
  const [versions,        setVersions]        = useState<ProcessVersion[]>([])
  const [showVersions,    setShowVersions]    = useState(false)
  const [showPublishForm, setShowPublishForm] = useState(false)
  const [publishExp,      setPublishExp]      = useState('')
  const [publishing,      setPublishing]      = useState(false)

  // ── Meta edit state ──────────────────────────────────────────
  const [title,     setTitle]     = useState(relation.title)
  const [relType,   setRelType]   = useState(relation.relation_type ?? 'contains')
  const [metaDirty, setMetaDirty] = useState(false)

  // ── Delete state ─────────────────────────────────────────────
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting,      setDeleting]      = useState(false)

  // ── Height resize ────────────────────────────────────────────
  const [sheetH, setSheetH] = useState(Math.round(window.innerHeight * 0.5))
  const resizing = useRef<{ startY: number; startH: number } | null>(null)

  const handleResizeDown = (e: React.MouseEvent) => {
    resizing.current = { startY: e.clientY, startH: sheetH }
    e.preventDefault()
  }
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!resizing.current) return
      const dy = resizing.current.startY - e.clientY   // dragging UP = bigger
      const next = Math.max(200, Math.min(window.innerHeight - 80, resizing.current.startH + dy))
      setSheetH(next)
    }
    const onUp = () => { resizing.current = null }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  // ── Timers ───────────────────────────────────────────────────
  const blockTimer = useRef<ReturnType<typeof setTimeout>>()
  const metaTimer  = useRef<ReturnType<typeof setTimeout>>()

  // ── Load blocks + versions ───────────────────────────────────
  useEffect(() => {
    let cancelled = false
    setBlocksLoading(true)
    Promise.all([
      authFetch<Block[]>(`/relations/${relation.id}/blocks`).catch(() => [] as Block[]),
      authFetch<ProcessVersion[]>(`/relations/${relation.id}/versions`).catch(() => [] as ProcessVersion[]),
    ]).then(([blks, vers]) => {
      if (cancelled) return
      setBlocks(blks)
      setVersions(vers)
    }).finally(() => {
      if (!cancelled) setBlocksLoading(false)
    })
    return () => { cancelled = true }
  }, [relation.id])

  // ── Reset meta when relation switches ───────────────────────
  useEffect(() => {
    setTitle(relation.title)
    setRelType(relation.relation_type ?? 'contains')
    setMetaDirty(false)
  }, [relation.id])   // only reset on ID change, not every render

  // ── Auto-save meta ───────────────────────────────────────────
  const saveMeta = useCallback(() => {
    authFetch(`/relations/${relation.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title, relation_type: relType }),
    }).then(() => {
      onUpdate({ title, relation_type: relType })
    }).catch(() => {})
    setMetaDirty(false)
  }, [relation.id, title, relType, onUpdate])

  useEffect(() => {
    if (!metaDirty) return
    clearTimeout(metaTimer.current)
    metaTimer.current = setTimeout(saveMeta, 800)
    return () => clearTimeout(metaTimer.current)
  }, [metaDirty, saveMeta])

  // ── Block changes → debounce PUT ────────────────────────────
  const handleBlocksChange = useCallback((newBlocks: Block[]) => {
    setBlocks(newBlocks)
    clearTimeout(blockTimer.current)
    blockTimer.current = setTimeout(() => {
      authFetch(`/relations/${relation.id}/blocks`, {
        method: 'PUT',
        body: JSON.stringify(newBlocks),
      }).catch(() => {})
    }, 1200)
  }, [relation.id])

  // ── Publish ──────────────────────────────────────────────────
  const handlePublish = async () => {
    setPublishing(true)
    try {
      const ver = await authFetch<ProcessVersion>(`/relations/${relation.id}/publish`, {
        method: 'POST',
        body: JSON.stringify({ explanation: publishExp.trim() }),
      })
      setVersions(prev => [...prev, ver])
      setPublishExp('')
      setShowPublishForm(false)
    } catch { /* ignore */ } finally { setPublishing(false) }
  }

  // ── Delete ───────────────────────────────────────────────────
  const handleDelete = async () => {
    setDeleting(true)
    try {
      await authFetch(`/relations/${relation.id}`, { method: 'DELETE' })
      onDelete()
    } catch { /* ignore */ } finally { setDeleting(false) }
  }

  // ── Computed ─────────────────────────────────────────────────
  const srcEntity = entityMap[`${relation.source_type}:${relation.source_id}`]
  const tgtEntity = entityMap[`${relation.target_type}:${relation.target_id}`]
  const typeColor = relationTypes.find(t => t.id === relType)?.color ?? '#8b5cf6'

  // ── Render ───────────────────────────────────────────────────
  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-40 flex flex-col bg-[#0d0b16] shadow-[0_-8px_32px_rgba(0,0,0,0.6)]"
      style={{ height: sheetH, borderTop: `1px solid ${typeColor}40` }}
    >
      {/* ── Resize handle ── */}
      <div
        onMouseDown={handleResizeDown}
        className="flex justify-center py-1.5 shrink-0 cursor-row-resize select-none group"
      >
        <div className="w-12 h-1 rounded-full bg-white/10 group-hover:bg-white/25 transition-colors" />
      </div>

      {/* ── Header ── */}
      <div className="px-4 h-10 flex items-center gap-2 shrink-0 border-b border-white/6">
        {/* Color dot */}
        <span className="w-2.5 h-2.5 rounded-full shrink-0 transition-colors" style={{ background: typeColor }} />

        {/* Title */}
        <input
          value={title}
          onChange={e => { setTitle(e.target.value); setMetaDirty(true) }}
          placeholder="关系标题…"
          className="flex-1 min-w-0 bg-transparent text-sm font-medium text-white placeholder-neutral-700 outline-none border-none"
        />

        {/* Unsaved indicator */}
        {metaDirty && (
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 animate-pulse" title="未保存" />
        )}

        {/* Type selector */}
        <select
          value={relType}
          onChange={e => { setRelType(e.target.value); setMetaDirty(true) }}
          className="text-[11px] bg-white/5 border border-white/10 rounded-md px-2 py-1 text-neutral-300 outline-none shrink-0 cursor-pointer"
        >
          {relationTypes.map(t => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>

        <div className="w-px h-4 bg-white/8 shrink-0" />

        {/* Publish */}
        <button
          onClick={() => { setShowPublishForm(f => !f); setShowVersions(false) }}
          className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-md transition-all shrink-0
            ${showPublishForm ? 'text-emerald-400 bg-emerald-500/10' : 'text-neutral-600 hover:text-emerald-400 hover:bg-emerald-500/10'}`}
        >
          <GitBranch className="w-3 h-3" />
          发布
          {versions.length > 0 && (
            <span className="text-[9px] opacity-50">v{versions.length}</span>
          )}
        </button>

        {/* Version history toggle */}
        <button
          onClick={() => { setShowVersions(v => !v); setShowPublishForm(false) }}
          className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-md transition-all shrink-0
            ${showVersions ? 'text-blue-400 bg-blue-500/10' : 'text-neutral-600 hover:text-neutral-300 hover:bg-white/5'}`}
        >
          <Clock className="w-3 h-3" />
          历史
          {showVersions
            ? <ChevronDown className="w-3 h-3" />
            : <ChevronUp className="w-3 h-3" />}
        </button>

        <div className="w-px h-4 bg-white/8 shrink-0" />

        {/* Delete */}
        <button
          onClick={() => setConfirmDelete(true)}
          className="w-6 h-6 rounded text-neutral-700 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-all shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>

        {/* Close */}
        <button
          onClick={onClose}
          className="w-6 h-6 rounded text-neutral-700 hover:text-neutral-300 hover:bg-white/5 flex items-center justify-center transition-all shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Chain row ── */}
      <div className="px-4 h-9 flex items-center gap-2 text-xs shrink-0 border-b border-white/4">
        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white/5 rounded-lg max-w-[220px] min-w-0">
          <span className="shrink-0 text-sm leading-none">{srcEntity?.icon ?? '📄'}</span>
          <span className="text-neutral-300 truncate">{srcEntity?.title ?? relation.source_id}</span>
          <span className="text-[9px] text-neutral-700 shrink-0">{relation.source_type}</span>
        </div>

        <span className="font-bold shrink-0 text-base" style={{ color: typeColor }}>→</span>

        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white/5 rounded-lg max-w-[220px] min-w-0">
          <span className="shrink-0 text-sm leading-none">{tgtEntity?.icon ?? '📄'}</span>
          <span className="text-neutral-300 truncate">{tgtEntity?.title ?? relation.target_id}</span>
          <span className="text-[9px] text-neutral-700 shrink-0">{relation.target_type}</span>
        </div>

        <span className="ml-auto text-[9px] text-neutral-800 font-mono truncate">{relation.id}</span>
      </div>

      {/* ── Publish form ── */}
      {showPublishForm && (
        <div className="px-4 py-2 flex items-center gap-2 bg-emerald-500/5 border-b border-emerald-500/15 shrink-0">
          <input
            value={publishExp}
            onChange={e => setPublishExp(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handlePublish() }}
            placeholder="版本说明（可选）…"
            autoFocus
            className="flex-1 text-sm bg-white/5 border border-white/8 rounded-lg px-3 py-1.5 text-white placeholder-neutral-700 outline-none"
          />
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 px-3 py-1.5 rounded-lg transition-all shrink-0"
          >
            {publishing
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <GitBranch className="w-3 h-3" />}
            发布快照
          </button>
          <button onClick={() => setShowPublishForm(false)} className="text-xs text-neutral-600 hover:text-neutral-400 shrink-0">取消</button>
        </div>
      )}

      {/* ── Version history panel ── */}
      {showVersions && (
        <div className="px-4 py-2 shrink-0 border-b border-white/6 max-h-32 overflow-y-auto bg-blue-500/3">
          <p className="text-[9px] uppercase tracking-widest text-neutral-700 mb-2">
            版本历史 ({versions.length})
          </p>
          {versions.length === 0 ? (
            <p className="text-[10px] text-neutral-800 italic">暂无版本，点击「发布」创建快照</p>
          ) : (
            [...versions].reverse().map(v => (
              <div key={v.id} className="flex items-center gap-2.5 py-1.5 border-b border-white/4 last:border-0 text-[10px]">
                <div className="w-5 h-5 rounded-full bg-primary-500/15 border border-primary-500/30 flex items-center justify-center text-[9px] text-primary-400 font-bold shrink-0">
                  {v.version_num}
                </div>
                <span className="text-neutral-400 flex-1 truncate">{v.explanation || '(无说明)'}</span>
                <span className="text-neutral-700 shrink-0">{v.publisher?.replace('human:', '')}</span>
                <span className="text-neutral-800 shrink-0">{fmtDate(v.publish_time)}</span>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Block editor ── */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {blocksLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-5 h-5 text-neutral-700 animate-spin" />
          </div>
        ) : (
          <BlockEditor
            pageId={relation.id}
            initialBlocks={blocks}
            onChange={handleBlocksChange}
          />
        )}
      </div>

      {/* ── Delete confirm overlay ── */}
      {confirmDelete && (
        <div
          className="absolute inset-0 bg-black/70 z-10 flex items-center justify-center"
          onClick={() => setConfirmDelete(false)}
        >
          <div
            className="bg-[#16141e] border border-red-500/20 rounded-2xl p-5 w-80 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-sm font-semibold text-white">删除关系</p>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              确定删除「{relation.title || '(无标题)'}」？此操作不可撤销，关联的内容块也会一并删除。
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(false)} className="btn-secondary text-xs">取消</button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all"
              >
                {deleting && <div className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />}
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RelationBottomSheet
