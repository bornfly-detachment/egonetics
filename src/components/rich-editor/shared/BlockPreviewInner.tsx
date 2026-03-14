// 预览层路由：根据 block.type 分发到各自的 Preview 组件
// 编辑态不经过这里
import React from 'react'
import type { Block, TableCell } from '../types'
import RichText from './RichText'
import ParagraphPreview from '../blocks/paragraph/ParagraphPreview'
import HeadingPreview from '../blocks/heading/HeadingPreview'
import CodePreview from '../blocks/code/CodePreview'

// ── 内联类型（暂未独立拆文件，后续可逐一提取）─────────────────────────────────

function QuotePreview({ block }: { block: Block }) {
  return (
    <blockquote className="border-l-3 border-neutral-500 pl-4 italic text-neutral-400">
      <RichText segments={block.content.rich_text} placeholder="引用内容…" />
    </blockquote>
  )
}

function BulletPreview({ block }: { block: Block }) {
  return (
    <li className="list-disc list-inside text-neutral-200">
      <RichText segments={block.content.rich_text} />
    </li>
  )
}

function NumberedPreview({ block }: { block: Block }) {
  const start = block.content.numberStart ?? 1
  return (
    <li value={start} className="list-decimal list-inside text-neutral-200">
      <RichText segments={block.content.rich_text} />
    </li>
  )
}

function TodoPreview({ block }: { block: Block }) {
  return (
    <div className="flex items-start gap-2 text-neutral-200">
      <input type="checkbox" readOnly className="mt-1 shrink-0" />
      <RichText segments={block.content.rich_text} />
    </div>
  )
}

function TogglePreview({ block }: { block: Block }) {
  const [open, setOpen] = React.useState(block.content.toggleOpen ?? false)
  return (
    <div>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}
        className="flex items-center gap-1.5 text-neutral-200 hover:text-white w-full text-left"
      >
        <span className={`text-xs transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
        <RichText segments={block.content.rich_text} placeholder="折叠标题…" />
      </button>
    </div>
  )
}

const CALLOUT_STYLE: Record<string, { border: string; bg: string }> = {
  callout_info:    { border: 'border-blue-500/40',   bg: 'bg-blue-950/30' },
  callout_warning: { border: 'border-yellow-500/40', bg: 'bg-yellow-950/30' },
  callout_success: { border: 'border-green-500/40',  bg: 'bg-green-950/30' },
  callout_tip:     { border: 'border-purple-500/40', bg: 'bg-purple-950/30' },
}

function CalloutPreview({ block }: { block: Block }) {
  const { border, bg } = CALLOUT_STYLE[block.type] ?? CALLOUT_STYLE.callout_info
  return (
    <div className={`flex gap-3 p-3 rounded-lg border ${border} ${bg}`}>
      <span className="text-lg shrink-0">{block.content.calloutIcon ?? 'ℹ️'}</span>
      <div className="text-neutral-200">
        <RichText segments={block.content.rich_text} placeholder="Callout 内容…" />
      </div>
    </div>
  )
}

function TablePreview({ block, onTableCommit, isEditing }: {
  block: Block
  onTableCommit?: (rows: TableCell[][]) => void
  isEditing?: boolean
}) {
  const [localRows, setLocalRows] = React.useState<TableCell[][]>(() => block.content.tableRows ?? [])
  const hasHeader = block.content.tableHasHeader ?? true
  const colCount = localRows[0]?.length ?? block.content.tableColCount ?? 3

  React.useEffect(() => {
    setLocalRows(block.content.tableRows ?? [])
  }, [block.content.tableRows])

  const emptyRow = () => Array.from({ length: colCount }, () => ({ rich_text: [] as { text: string }[] }))
  const emptyCell = () => ({ rich_text: [] as { text: string }[] })

  const updateCell = (ri: number, ci: number, text: string) => {
    const next = localRows.map((r, rIdx) =>
      rIdx === ri ? r.map((c, cIdx) => cIdx === ci ? { rich_text: [{ text }] } : c) : r
    )
    setLocalRows(next)
    onTableCommit?.(next)
  }

  const addRow = () => {
    const next = [...localRows, emptyRow()]
    setLocalRows(next)
    onTableCommit?.(next)
  }

  const deleteRow = (ri: number) => {
    if (localRows.length <= 1) return
    const next = localRows.filter((_, i) => i !== ri)
    setLocalRows(next)
    onTableCommit?.(next)
  }

  const addCol = () => {
    const next = localRows.map(r => [...r, emptyCell()])
    setLocalRows(next)
    onTableCommit?.(next)
  }

  const deleteCol = (ci: number) => {
    if (colCount <= 1) return
    const next = localRows.map(r => r.filter((_, i) => i !== ci))
    setLocalRows(next)
    onTableCommit?.(next)
  }

  return (
    <div className="overflow-x-auto my-1 group/table">
      <div className="inline-flex flex-col min-w-full">
        <table className="border-collapse text-sm">
          <tbody>
            {localRows.map((row, ri) => (
              <tr key={ri} className="group/row">
                {Array.from({ length: colCount }).map((_, ci) => {
                  const cell = row[ci] ?? { rich_text: [] }
                  const Tag = hasHeader && ri === 0 ? 'th' : 'td'
                  return (
                    <Tag
                      key={ci}
                      className={`relative border border-neutral-700 px-3 py-1.5 text-left ${hasHeader && ri === 0 ? 'bg-neutral-800/80 font-semibold text-neutral-200' : 'text-neutral-300'}`}
                    >
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <input
                            className="bg-transparent outline-none w-full min-w-[60px]"
                            defaultValue={cell.rich_text.map((s: { text: string }) => s.text).join('')}
                            onBlur={(e) => updateCell(ri, ci, e.target.value)}
                          />
                          {/* 删除列按钮（仅首行显示） */}
                          {ri === 0 && colCount > 1 && (
                            <button
                              onMouseDown={(e) => { e.preventDefault(); deleteCol(ci) }}
                              className="opacity-0 group-hover/row:opacity-100 shrink-0 text-neutral-600 hover:text-red-400 transition-opacity"
                              title="删除此列"
                            >
                              <svg width="10" height="10" viewBox="0 0 10 10"><line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="1.5"/><line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="1.5"/></svg>
                            </button>
                          )}
                        </div>
                      ) : (
                        <RichText segments={cell.rich_text} placeholder="" />
                      )}
                    </Tag>
                  )
                })}
                {/* 删除行按钮 */}
                {isEditing && localRows.length > 1 && (
                  <td className="border-0 pl-1 align-middle">
                    <button
                      onMouseDown={(e) => { e.preventDefault(); deleteRow(ri) }}
                      className="opacity-0 group-hover/row:opacity-100 text-neutral-600 hover:text-red-400 transition-opacity"
                      title="删除此行"
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10"><line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="1.5"/><line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="1.5"/></svg>
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {/* 底部操作栏：加行 + 加列 */}
        {isEditing && (
          <div className="flex gap-2 mt-1">
            <button
              onMouseDown={(e) => { e.preventDefault(); addRow() }}
              className="flex items-center gap-1 px-2 py-0.5 text-xs text-neutral-500 hover:text-neutral-300 hover:bg-white/5 rounded transition-colors"
            >
              <svg width="10" height="10" viewBox="0 0 10 10"><line x1="5" y1="1" x2="5" y2="9" stroke="currentColor" strokeWidth="1.5"/><line x1="1" y1="5" x2="9" y2="5" stroke="currentColor" strokeWidth="1.5"/></svg>
              加行
            </button>
            <button
              onMouseDown={(e) => { e.preventDefault(); addCol() }}
              className="flex items-center gap-1 px-2 py-0.5 text-xs text-neutral-500 hover:text-neutral-300 hover:bg-white/5 rounded transition-colors"
            >
              <svg width="10" height="10" viewBox="0 0 10 10"><line x1="5" y1="1" x2="5" y2="9" stroke="currentColor" strokeWidth="1.5"/><line x1="1" y1="5" x2="9" y2="5" stroke="currentColor" strokeWidth="1.5"/></svg>
              加列
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function MediaPreview({ block }: { block: Block }) {
  const url = block.content.rich_text.map((s) => s.text).join('')
  const { type } = block
  if (!url) return <p className="text-neutral-500 italic text-sm">（未设置 URL）</p>
  if (type === 'image')
    return <img src={url} alt={block.content.fileName || ''} className="max-w-full rounded-lg my-1" style={{ width: `${block.content.imageWidth ?? 100}%` }} />
  if (type === 'video')
    return <video src={url} controls className="max-w-full rounded-lg my-1" />
  if (type === 'audio')
    return <audio src={url} controls className="w-full my-1" />
  if (type === 'file')
    return <a href={url} target="_blank" rel="noreferrer" className="text-blue-400 underline text-sm">{block.content.fileName || url}</a>
  if (type === 'bookmark')
    return <a href={url} target="_blank" rel="noreferrer" className="text-blue-400 underline text-sm break-all">{url}</a>
  return null
}

function DividerPreview() {
  return <hr className="border-neutral-700/60 my-2" />
}

function SubpagePreview({ block, onNavigate, onCreateSubpage }: {
  block: Block
  onNavigate?: (pageId: string) => void
  onCreateSubpage?: (blockId: string) => Promise<string>
}) {
  const { subpageId, subpageTitle, subpageIcon } = block.content
  const [creating, setCreating] = React.useState(false)

  if (!subpageId)
    return (
      <button
        onClick={async (e) => {
          e.stopPropagation()
          if (creating || !onCreateSubpage) return
          setCreating(true)
          try { await onCreateSubpage(block.id) } finally { setCreating(false) }
        }}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-lg border border-dashed border-neutral-700 hover:border-neutral-500 text-neutral-500 hover:text-neutral-300 transition-all text-sm"
      >
        <span>📄</span>
        <span>{creating ? '正在创建页面…' : '点击创建子页面'}</span>
      </button>
    )

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onNavigate?.(subpageId) }}
      className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg bg-neutral-800/50 hover:bg-neutral-800 border border-neutral-700/60 hover:border-neutral-600 transition-all text-sm group"
    >
      <span className="shrink-0">{subpageIcon ?? '📄'}</span>
      <span className="text-neutral-200 group-hover:text-white font-medium truncate">{subpageTitle || '无标题'}</span>
      <span className="ml-auto text-neutral-600 group-hover:text-neutral-400 text-xs">›</span>
    </button>
  )
}

// ── 主路由 ────────────────────────────────────────────────────────────────────
interface Props {
  block: Block
  allBlocks?: Map<string, Block>
  isEditing?: boolean
  onTableCommit?: (rows: TableCell[][]) => void
  onNavigate?: (pageId: string) => void
  onCreateSubpage?: (blockId: string) => Promise<string>
  onUpdateContent?: (patch: Partial<Block['content']>) => void
}

export default function BlockPreviewInner({
  block, allBlocks: _allBlocks, isEditing, onTableCommit, onNavigate, onCreateSubpage,
}: Props) {
  const { type } = block

  if (type === 'paragraph') return <ParagraphPreview block={block} />
  if (['heading1', 'heading2', 'heading3', 'heading4'].includes(type)) return <HeadingPreview block={block} />
  if (type === 'code') return <CodePreview block={block} />
  if (type === 'quote') return <QuotePreview block={block} />
  if (type === 'bullet') return <BulletPreview block={block} />
  if (type === 'numbered') return <NumberedPreview block={block} />
  if (type === 'todo') return <TodoPreview block={block} />
  if (type === 'toggle') return <TogglePreview block={block} />
  if (['callout_info', 'callout_warning', 'callout_success', 'callout_tip'].includes(type))
    return <CalloutPreview block={block} />
  if (type === 'table') return <TablePreview block={block} onTableCommit={onTableCommit} isEditing={isEditing} />
  if (['image', 'video', 'audio', 'file', 'bookmark'].includes(type)) return <MediaPreview block={block} />
  if (type === 'divider') return <DividerPreview />
  if (type === 'subpage') return <SubpagePreview block={block} onNavigate={onNavigate} onCreateSubpage={onCreateSubpage} />

  // math / equation_block / toc / columns2 / columns3 — 占位，后续补充
  return (
    <div className="text-neutral-500 italic text-sm py-1">
      [{type}] 预览待实现
    </div>
  )
}
