// 编辑层路由：isEditing=true 时渲染各块的 Editor 组件
import React, { useState, useEffect, useRef } from 'react'
import type { Block, BlockType, TableCell } from '../types'
import { getPlainText } from './blockUtils'
import { formatCode } from '../../../lib/formatCode'
import ParagraphEditor from '../blocks/paragraph/ParagraphEditor'
import HeadingEditor from '../blocks/heading/HeadingEditor'
import CodeEditor from '../blocks/code/CodeEditor'
import BlockPreviewInner from './BlockPreviewInner'

interface Props {
  block: Block
  isEditing: boolean
  onCommit: (text: string) => void
  onStartEdit: () => void
  onExitEdit: () => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLElement>) => void
  onTypeChange?: (type: BlockType) => void
  onSlashMenu?: () => void
  onUpdateContent?: (patch: Partial<Block['content']>) => void
  onTableCommit?: (rows: TableCell[][]) => void
  onNavigate?: (pageId: string) => void
  onCreateSubpage?: (blockId: string) => Promise<string>
  onAddAfter?: () => void
  onDelete?: () => void
  onUpdate?: (updates: Partial<Block>) => void
  allBlocks?: Map<string, Block>
}

const SHARED_CLS =
  'w-full bg-transparent border-none outline-none resize-none text-inherit font-inherit caret-white placeholder-neutral-600'

export default function BlockEditorInner({
  block, isEditing, onCommit, onKeyDown, onTypeChange, onSlashMenu,
  onTableCommit, onNavigate, onCreateSubpage, onExitEdit,
}: Props) {
  const [draft, setDraft] = useState(getPlainText(block.content.rich_text))
  const historyRef = useRef<string[]>([])

  useEffect(() => {
    if (isEditing) {
      historyRef.current = []
      setDraft(getPlainText(block.content.rich_text))
    }
  }, [isEditing])

  const updateDraft = (val: string) => {
    historyRef.current.push(draft)
    if (historyRef.current.length > 200) historyRef.current.shift()
    setDraft(val)
  }

  const commit = () => onCommit(draft)

  const formatAndCommit = async () => {
    const formatted = await formatCode(draft, block.content.language ?? 'plaintext')
    setDraft(formatted)
    onCommit(formatted)
  }

  const handleKD = (e: React.KeyboardEvent<HTMLElement>) => {
    const isUndo = (e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey
    if (isUndo && block.type !== 'code') {
      e.preventDefault()
      const prev = historyRef.current.pop()
      if (prev !== undefined) setDraft(prev)
      return
    }
    if (e.key === 'Enter' && !e.shiftKey && block.type !== 'code') {
      e.preventDefault(); commit(); onKeyDown?.(e); return
    }
    if (e.key === 'Escape') { e.preventDefault(); commit(); return }
    onKeyDown?.(e)
  }

  // ── 不需要文本编辑的块类型 ───────────────────────────────────────────────────
  if (block.type === 'subpage')
    return <BlockPreviewInner block={block} onNavigate={onNavigate} onCreateSubpage={onCreateSubpage} />

  if (block.type === 'table')
    return <BlockPreviewInner block={block} isEditing onTableCommit={onTableCommit} />

  if (block.type === 'divider' || block.type === 'toc') {
    commit()
    return <BlockPreviewInner block={block} />
  }

  // ── 代码块 ────────────────────────────────────────────────────────────────────
  if (block.type === 'code')
    return (
      <CodeEditor
        language={block.content.language ?? 'plaintext'}
        value={draft}
        onChange={setDraft}
        onBlur={formatAndCommit}
      />
    )

  // ── 媒体块 ────────────────────────────────────────────────────────────────────
  if (['image', 'video', 'audio', 'file', 'bookmark'].includes(block.type)) {
    const PH: Record<string, string> = {
      image: '图片 URL 或选择文件…', video: '视频 URL 或选择文件…',
      audio: '音频 URL 或选择文件…', file: '文件 URL 或选择文件…', bookmark: '网页 URL…',
    }
    const acceptMap: Record<string, string> = { image: 'image/*', video: 'video/*', audio: 'audio/*', file: '*/*' }
    const accept = acceptMap[block.type]

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      const blobUrl = URL.createObjectURL(file)
      onCommit(blobUrl)
      onExitEdit()
      try {
        const r = await fetch('/api/media/upload', {
          method: 'POST',
          headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-Filename': encodeURIComponent(file.name) },
          body: file,
        })
        const d = await r.json()
        onCommit(d.url)
        URL.revokeObjectURL(blobUrl)
      } catch (err) {
        console.error('[upload]', err)
      }
    }

    return (
      <div className="flex items-center gap-2 w-full">
        <input
          autoFocus
          type="text" value={draft}
          onChange={(e) => updateDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKD as any}
          className={`${SHARED_CLS} text-sm flex-1`}
          placeholder={PH[block.type] ?? 'URL…'}
        />
        {accept && (
          <label className="shrink-0 cursor-pointer px-2 py-0.5 text-[11px] bg-neutral-700 hover:bg-neutral-600 rounded text-neutral-300 whitespace-nowrap select-none">
            选择文件
            <input type="file" accept={accept} className="hidden" onChange={handleFileSelect} />
          </label>
        )}
      </div>
    )
  }

  // ── 段落 / 标题 ───────────────────────────────────────────────────────────────
  if (block.type === 'paragraph')
    return (
      <ParagraphEditor
        block={block} draft={draft} onChange={updateDraft} onBlur={commit}
        onKeyDown={handleKD as any} onTypeChange={onTypeChange} onSlashMenu={onSlashMenu}
        autoFocus={isEditing}
      />
    )

  if (['heading1', 'heading2', 'heading3', 'heading4'].includes(block.type))
    return (
      <HeadingEditor
        block={block} draft={draft} onChange={updateDraft} onBlur={commit}
        onKeyDown={handleKD as any} autoFocus={isEditing}
      />
    )

  // ── 其他文本块：通用 textarea ─────────────────────────────────────────────────
  const autoResize = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const t = e.currentTarget; t.style.height = 'auto'; t.style.height = `${t.scrollHeight}px`
  }
  return (
    <textarea
      autoFocus
      value={draft} rows={1}
      onChange={(e) => updateDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={handleKD}
      onInput={autoResize}
      className={`${SHARED_CLS} overflow-hidden leading-relaxed`}
      placeholder="输入内容…"
    />
  )
}
