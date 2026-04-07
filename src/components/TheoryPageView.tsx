import React, { useMemo, useState, useCallback, useEffect } from 'react'
import PageManager from './PageManager'
import { createApiClient } from './apiClient'
import type { PageMeta, Block } from './types'
import { X, Loader2 } from 'lucide-react'
import { authFetch } from '@/lib/http'

// ── Types ──────────────────────────────────────────────────
interface ArchivedPageInfo {
  version_tag: string
  entry_id: string
}

interface ArchiveModal {
  page: PageMeta
  blocks: Block[]
}

// ── Chronicle API helpers ───────────────────────────────────
const chroniclePost = (path: string, body: unknown) =>
  authFetch(path, {
    method: 'POST',
    body: JSON.stringify(body),
  })

// ── Main Component ─────────────────────────────────────────
const TheoryPageView: React.FC = () => {
  const apiClient = useMemo(() => createApiClient('theory'), [])

  const [archivedPages, setArchivedPages] = useState<Record<string, ArchivedPageInfo>>({})
  const [archiveModal, setArchiveModal] = useState<ArchiveModal | null>(null)
  const [modalVersionTag, setModalVersionTag] = useState('v1.0')
  const [modalSummary, setModalSummary] = useState('')
  const [archiving, setArchiving] = useState(false)
  const [archiveError, setArchiveError] = useState('')

  // ── Load existing archived Theory entries ──
  const loadArchivedPages = useCallback(async () => {
    try {
      const data = await authFetch<any>('/chronicle/entries?type=theory')
      const map: Record<string, ArchivedPageInfo> = {}
      for (const entry of data.entries || []) {
        // source_id maps to page id; entries are DESC so first = latest
        if (entry.source_id && !map[entry.source_id]) {
          map[entry.source_id] = { version_tag: entry.version_tag || '', entry_id: entry.id }
        }
      }
      setArchivedPages(map)
    } catch {
      /* non-critical, silently ignore */
    }
  }, [])

  useEffect(() => {
    loadArchivedPages()
  }, [loadArchivedPages])

  // ── Archive handler: open modal ──
  const handleArchivePage = useCallback((page: PageMeta, blocks: Block[]) => {
    setArchiveModal({ page, blocks })
    setModalVersionTag('v1.0')
    setModalSummary('')
    setArchiveError('')
  }, [])

  // ── Confirm archive: POST to chronicle ──
  const handleConfirmArchive = async () => {
    if (!archiveModal || !modalVersionTag.trim()) return
    setArchiving(true)
    setArchiveError('')
    try {
      await chroniclePost('/chronicle/entries', {
        type: 'theory',
        source_id: archiveModal.page.id,
        title: `${archiveModal.page.title} ${modalVersionTag.trim()}`,
        version_tag: modalVersionTag.trim(),
        summary: modalSummary.trim() || null,
        content: JSON.stringify(archiveModal.blocks),
      })
      setArchiveModal(null)
      await loadArchivedPages()
    } catch (e) {
      setArchiveError(e instanceof Error ? e.message : '入库失败，请重试')
    } finally {
      setArchiving(false)
    }
  }

  const closeModal = () => {
    if (!archiving) setArchiveModal(null)
  }

  return (
    <div className="h-full flex flex-col bg-[#191919]">
      {/* 顶部导航栏 */}
      <div className="h-14 bg-[#1a1a1a] border-b border-white/5 flex items-center px-4 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xl">🧠</span>
          <span className="text-white font-medium">Theory</span>
        </div>
        <div className="flex-1" />
        <div className="text-neutral-500 text-sm">Bornfly Theory 知识体系</div>
      </div>

      {/* PageManager 内容区 */}
      <div className="flex-1 overflow-hidden">
        <PageManager
          api={apiClient}
          archivedPages={archivedPages}
          onArchivePage={handleArchivePage}
        />
      </div>

      {/* ── Archive Modal ── */}
      {archiveModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6 w-96 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-semibold text-base flex items-center gap-2">
                🔒 入库 Chronicle
              </h2>
              <button
                onClick={closeModal}
                className="text-neutral-400 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Page info */}
            <div className="mb-4 px-3 py-2 bg-white/5 rounded-lg text-sm text-neutral-400">
              <span className="mr-2">{archiveModal.page.icon}</span>
              <span className="text-neutral-200">{archiveModal.page.title || '无标题'}</span>
            </div>

            <div className="space-y-4">
              {/* Version tag */}
              <div>
                <label className="text-xs text-neutral-400 mb-1 block">版本号 *</label>
                <input
                  autoFocus
                  className="w-full bg-neutral-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50 placeholder-neutral-600"
                  placeholder="e.g. v1.0, v2.0-alpha"
                  value={modalVersionTag}
                  onChange={(e) => setModalVersionTag(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleConfirmArchive()}
                />
              </div>

              {/* Summary */}
              <div>
                <label className="text-xs text-neutral-400 mb-1 block">摘要（可选）</label>
                <textarea
                  className="w-full bg-neutral-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50 resize-none placeholder-neutral-600"
                  rows={3}
                  placeholder="这个版本记录了什么…"
                  value={modalSummary}
                  onChange={(e) => setModalSummary(e.target.value)}
                />
              </div>

              {archiveError && <p className="text-xs text-red-400">{archiveError}</p>}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={archiving}
                  className="px-4 py-2 text-sm text-neutral-400 hover:text-white transition-colors disabled:opacity-40"
                >
                  取消
                </button>
                <button
                  onClick={handleConfirmArchive}
                  disabled={archiving || !modalVersionTag.trim()}
                  className="flex items-center gap-2 px-5 py-2 text-sm bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white rounded-lg font-medium transition-colors"
                >
                  {archiving && <Loader2 size={13} className="animate-spin" />}
                  确认入库
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TheoryPageView
