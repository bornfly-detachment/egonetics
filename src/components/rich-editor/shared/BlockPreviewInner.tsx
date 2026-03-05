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
  const rows = block.content.tableRows ?? []
  const cols = block.content.tableColCount ?? 3
  const hasHeader = block.content.tableHasHeader ?? true
  return (
    <div className="overflow-x-auto my-1">
      <table className="w-full border-collapse text-sm">
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {Array.from({ length: cols }).map((_, ci) => {
                const cell = row[ci] ?? { rich_text: [] }
                const Tag = hasHeader && ri === 0 ? 'th' : 'td'
                return (
                  <Tag
                    key={ci}
                    className={`border border-neutral-700 px-3 py-1.5 text-left ${hasHeader && ri === 0 ? 'bg-neutral-800/80 font-semibold text-neutral-200' : 'text-neutral-300'}`}
                  >
                    {isEditing ? (
                      <input
                        className="bg-transparent outline-none w-full min-w-[60px]"
                        defaultValue={cell.rich_text.map((s) => s.text).join('')}
                        onBlur={(e) =>
                          onTableCommit?.(
                            rows.map((r, rIdx) =>
                              rIdx === ri
                                ? r.map((c, cIdx) =>
                                    cIdx === ci ? { rich_text: [{ text: e.target.value }] } : c
                                  )
                                : r
                            )
                          )
                        }
                      />
                    ) : (
                      <RichText segments={cell.rich_text} placeholder="" />
                    )}
                  </Tag>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
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
