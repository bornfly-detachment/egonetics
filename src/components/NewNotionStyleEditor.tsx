import React, { useState, useRef, useCallback, useEffect } from 'react'
import {
  Plus, Trash2, GripVertical,
  Type, Heading1, Heading2, Heading3,
  List, ListOrdered, CheckSquare, Quote,
  Code, Image, Minus, ChevronRight, ChevronDown,
  Table, AlertCircle, Info, AlertTriangle, Lightbulb,
  ToggleLeft, Columns, Link, Hash, Film, FileText,
  BookOpen, Star, ArrowRight,
} from 'lucide-react'
import { DndProvider, useDrag, useDrop } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'

// ─── 类型定义 ────────────────────────────────────────────────────────────────

export type BlockType =
  | 'paragraph'
  | 'heading1' | 'heading2' | 'heading3' | 'heading4'
  | 'bullet' | 'numbered' | 'todo' | 'toggle'
  | 'quote' | 'callout_info' | 'callout_warning' | 'callout_success' | 'callout_tip'
  | 'code' | 'math' | 'equation_block'
  | 'image' | 'video' | 'file' | 'bookmark'
  | 'divider' | 'table' | 'columns2' | 'columns3' | 'toc'

export interface RichTextSegment {
  text: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strikethrough?: boolean
  code?: boolean
  color?: string
  link?: string
}

export interface TableCell {
  rich_text: RichTextSegment[]
}

export interface Block {
  id: string
  parentId: string | null
  type: BlockType
  content: {
    rich_text: RichTextSegment[]
    language?: string
    tableRows?: TableCell[][]
    tableColCount?: number
    tableHasHeader?: boolean
    calloutIcon?: string
    numberStart?: number
    toggleOpen?: boolean
    fileName?: string
  }
  position: number
  metadata?: Record<string, any>
  collapsed?: boolean
}

// ─── 代码语言列表 ─────────────────────────────────────────────────────────────

const CODE_LANGUAGES = [
  'plaintext','markdown','json','javascript','typescript',
  'python','java','c','cpp','csharp','go','rust','php',
  'ruby','swift','kotlin','scala','bash','shell','powershell',
  'sql','html','css','scss','xml','yaml','toml','dockerfile',
  'graphql','r','matlab','lua','perl','haskell','elixir',
]

// ─── 块类型配置 ──────────────────────────────────────────────────────────────

const BLOCK_TYPE_GROUPS = [
  {
    group: '基础文本',
    items: [
      { type: 'paragraph' as const,       label: '段落',     icon: Type,          shortcut: 'text',  desc: '普通段落文本' },
      { type: 'heading1' as const,        label: '标题 1',   icon: Heading1,      shortcut: 'h1',    desc: '大标题' },
      { type: 'heading2' as const,        label: '标题 2',   icon: Heading2,      shortcut: 'h2',    desc: '中标题' },
      { type: 'heading3' as const,        label: '标题 3',   icon: Heading3,      shortcut: 'h3',    desc: '小标题' },
      { type: 'heading4' as const,        label: '标题 4',   icon: Hash,          shortcut: 'h4',    desc: '最小标题' },
      { type: 'quote' as const,           label: '引用',     icon: Quote,         shortcut: 'quote', desc: '引用段落' },
    ]
  },
  {
    group: '列表',
    items: [
      { type: 'bullet' as const,          label: '无序列表', icon: List,          shortcut: 'ul',    desc: '• 项目列表' },
      { type: 'numbered' as const,        label: '有序列表', icon: ListOrdered,   shortcut: 'ol',    desc: '1. 2. 3.' },
      { type: 'todo' as const,            label: '待办事项', icon: CheckSquare,   shortcut: 'todo',  desc: '可勾选列表' },
      { type: 'toggle' as const,          label: '折叠列表', icon: ToggleLeft,    shortcut: 'tog',   desc: '可折叠块' },
    ]
  },
  {
    group: '标注',
    items: [
      { type: 'callout_info' as const,    label: '信息',     icon: Info,          shortcut: 'info',  desc: '🔵 信息提示' },
      { type: 'callout_warning' as const, label: '警告',     icon: AlertTriangle, shortcut: 'warn',  desc: '🟡 警告提示' },
      { type: 'callout_success' as const, label: '成功',     icon: AlertCircle,   shortcut: 'ok',    desc: '🟢 成功提示' },
      { type: 'callout_tip' as const,     label: '技巧',     icon: Lightbulb,     shortcut: 'tip',   desc: '💡 小技巧' },
    ]
  },
  {
    group: '代码 & 公式',
    items: [
      { type: 'code' as const,            label: '代码块',   icon: Code,          shortcut: 'code',  desc: '多语言代码' },
      { type: 'math' as const,            label: '行内公式', icon: BookOpen,      shortcut: 'math',  desc: 'LaTeX 行内' },
      { type: 'equation_block' as const,  label: '公式块',   icon: Star,          shortcut: 'eq',    desc: 'LaTeX 独立块' },
    ]
  },
  {
    group: '媒体',
    items: [
      { type: 'image' as const,           label: '图片',     icon: Image,         shortcut: 'img',   desc: 'URL 图片' },
      { type: 'video' as const,           label: '视频',     icon: Film,          shortcut: 'vid',   desc: '嵌入视频' },
      { type: 'file' as const,            label: '文件',     icon: FileText,      shortcut: 'file',  desc: '附件' },
      { type: 'bookmark' as const,        label: '书签',     icon: Link,          shortcut: 'bm',    desc: '网页书签' },
    ]
  },
  {
    group: '结构',
    items: [
      { type: 'table' as const,           label: '表格',     icon: Table,         shortcut: 'table', desc: '结构化表格' },
      { type: 'columns2' as const,        label: '两列',     icon: Columns,       shortcut: 'col2',  desc: '两栏布局' },
      { type: 'columns3' as const,        label: '三列',     icon: Columns,       shortcut: 'col3',  desc: '三栏布局' },
      { type: 'divider' as const,         label: '分隔线',   icon: Minus,         shortcut: 'hr',    desc: '水平线' },
      { type: 'toc' as const,             label: '目录',     icon: ArrowRight,    shortcut: 'toc',   desc: '自动目录' },
    ]
  },
]

const ALL_BLOCK_TYPES = BLOCK_TYPE_GROUPS.flatMap(g => g.items)
const MAX_NEST_LEVEL = 8
const ITEM_TYPE = 'BLOCK'
const generateId = () => `b-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

const getPlainText = (segs: RichTextSegment[]) => segs.map(s => s.text).join('')
const makeSegs = (text: string): RichTextSegment[] => [{ text }]

function positionBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return 1
  if (before === null) return (after as number) / 2
  if (after === null) return (before as number) + 1
  return (before + (after as number)) / 2
}

function defaultContent(type: BlockType): Block['content'] {
  if (type === 'table') return {
    rich_text: [], tableColCount: 3, tableHasHeader: true,
    tableRows: [
      [{ rich_text: makeSegs('列 1') }, { rich_text: makeSegs('列 2') }, { rich_text: makeSegs('列 3') }],
      [{ rich_text: [] }, { rich_text: [] }, { rich_text: [] }],
      [{ rich_text: [] }, { rich_text: [] }, { rich_text: [] }],
    ]
  }
  if (type === 'code')            return { rich_text: [], language: 'plaintext' }
  if (type === 'callout_info')    return { rich_text: [], calloutIcon: 'ℹ️' }
  if (type === 'callout_warning') return { rich_text: [], calloutIcon: '⚠️' }
  if (type === 'callout_success') return { rich_text: [], calloutIcon: '✅' }
  if (type === 'callout_tip')     return { rich_text: [], calloutIcon: '💡' }
  if (type === 'toggle')          return { rich_text: [], toggleOpen: false }
  return { rich_text: [] }
}

// ─── 富文本渲染 ───────────────────────────────────────────────────────────────

function RichText({ segments, placeholder = '输入内容，或按 / 插入块…' }: {
  segments: RichTextSegment[]
  placeholder?: string
}) {
  if (!segments.length || (segments.length === 1 && !segments[0].text)) {
    return <span className="text-neutral-500 select-none">{placeholder}</span>
  }
  return (
    <>
      {segments.map((seg, i) => {
        const cls = [
          seg.bold   ? 'font-bold' : '',
          seg.italic ? 'italic' : '',
          seg.underline ? 'underline' : '',
          seg.strikethrough ? 'line-through' : '',
          seg.code ? 'font-mono bg-neutral-800 px-1 rounded text-sm text-green-300' : '',
        ].filter(Boolean).join(' ')
        return seg.link
          ? <a key={i} href={seg.link} target="_blank" rel="noreferrer" className={`${cls} text-blue-400 underline`}>{seg.text}</a>
          : <span key={i} className={cls}>{seg.text}</span>
      })}
    </>
  )
}

// ─── 块内容展示 ───────────────────────────────────────────────────────────────

function BlockViewContent({
  block, isEditing, allBlocks, onTableCommit,
}: {
  block: Block
  isEditing?: boolean
  allBlocks?: Map<string, Block>
  onTableCommit?: (rows: TableCell[][]) => void
}) {
  const { type, content } = block
  const segs = content.rich_text

  // ── 表格 ──
  if (type === 'table') {
    const rows = content.tableRows ?? []
    const cols = content.tableColCount ?? 3
    const hasHeader = content.tableHasHeader ?? true
    return (
      <div className="overflow-x-auto my-1">
        <table className="w-full border-collapse text-sm">
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {Array.from({ length: cols }).map((_, ci) => {
                  const cell = row[ci] ?? { rich_text: [] }
                  const Tag = (hasHeader && ri === 0) ? 'th' : 'td'
                  return (
                    <Tag key={ci} className={`border border-neutral-700 px-3 py-1.5 text-left ${
                      hasHeader && ri === 0 ? 'bg-neutral-800/80 font-semibold text-neutral-200' : 'text-neutral-300'
                    }`}>
                      {isEditing ? (
                        <input
                          className="bg-transparent outline-none w-full min-w-[60px]"
                          defaultValue={getPlainText(cell.rich_text)}
                          onBlur={e => {
                            const newRows = rows.map((r, rIdx) =>
                              rIdx === ri ? r.map((c, cIdx) => cIdx === ci ? { rich_text: makeSegs(e.target.value) } : c) : r
                            )
                            onTableCommit?.(newRows)
                          }}
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
        {isEditing && (
          <div className="flex gap-2 mt-2 flex-wrap">
            {[
              { label: '+ 行', action: () => onTableCommit?.([...rows, Array.from({ length: cols }, () => ({ rich_text: [] as RichTextSegment[] }))]) },
              { label: '+ 列', action: () => onTableCommit?.(rows.map(r => [...r, { rich_text: [] as RichTextSegment[] }])) },
              ...(rows.length > 1 ? [{ label: '- 末行', action: () => onTableCommit?.(rows.slice(0, -1)) }] : []),
              ...(cols > 1 ? [{ label: '- 末列', action: () => onTableCommit?.(rows.map(r => r.slice(0, -1))) }] : []),
            ].map(btn => (
              <button key={btn.label} onClick={btn.action}
                className="text-xs text-neutral-500 hover:text-neutral-300 px-2 py-0.5 rounded border border-neutral-700 hover:border-neutral-500 transition-colors">
                {btn.label}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Callout ──
  const calloutMap: Record<string, { bg: string; border: string }> = {
    callout_info:    { bg: 'bg-blue-950/40',   border: 'border-blue-600/50' },
    callout_warning: { bg: 'bg-yellow-950/40', border: 'border-yellow-600/50' },
    callout_success: { bg: 'bg-green-950/40',  border: 'border-green-600/50' },
    callout_tip:     { bg: 'bg-purple-950/40', border: 'border-purple-600/50' },
  }
  if (type in calloutMap) {
    const s = calloutMap[type]
    return (
      <div className={`flex gap-3 rounded-lg border px-4 py-3 my-0.5 ${s.bg} ${s.border}`}>
        <span className="text-lg shrink-0 select-none">{content.calloutIcon}</span>
        <div className="flex-1 text-neutral-200"><RichText segments={segs} /></div>
      </div>
    )
  }

  // ── 代码块 ──
  if (type === 'code') {
    return (
      <div className="my-0.5 rounded-lg overflow-hidden border border-neutral-700/60">
        <div className="px-3 py-1 bg-neutral-800/80 border-b border-neutral-700/60 flex items-center">
          <span className="text-xs text-neutral-500 font-mono">{content.language ?? 'plaintext'}</span>
        </div>
        <pre className="p-4 text-sm text-green-300 font-mono overflow-x-auto whitespace-pre-wrap bg-neutral-800/40">
          <RichText segments={segs} placeholder="// 点击输入代码…" />
        </pre>
      </div>
    )
  }

  // ── 数学公式 ──
  if (type === 'math') {
    const text = getPlainText(segs)
    return (
      <code className="font-mono text-yellow-300 bg-neutral-800 px-2 py-0.5 rounded text-sm">
        {text || <span className="text-neutral-500 italic">LaTeX…</span>}
      </code>
    )
  }
  if (type === 'equation_block') {
    const text = getPlainText(segs)
    return (
      <div className="bg-neutral-800/60 rounded-lg p-5 text-center my-1 border border-neutral-700/40">
        <code className="font-mono text-yellow-300 text-base">
          {text || <span className="text-neutral-500 italic">输入 LaTeX 公式…</span>}
        </code>
      </div>
    )
  }

  // ── 图片 ──
  if (type === 'image') {
    const url = getPlainText(segs)
    return url ? (
      <div className="my-1"><img src={url} alt="" className="max-w-full rounded-lg shadow-lg" /></div>
    ) : (
      <div className="border-2 border-dashed border-neutral-700 rounded-lg p-8 text-center text-neutral-500 text-sm my-1">
        🖼️ 点击输入图片 URL
      </div>
    )
  }

  // ── 视频 ──
  if (type === 'video') {
    const url = getPlainText(segs)
    if (url) {
      const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)
      if (ytMatch) return (
        <div className="my-1 aspect-video rounded-lg overflow-hidden border border-neutral-700">
          <iframe src={`https://www.youtube.com/embed/${ytMatch[1]}`} className="w-full h-full" allowFullScreen />
        </div>
      )
      return <video src={url} controls className="max-w-full rounded-lg my-1" />
    }
    return (
      <div className="border-2 border-dashed border-neutral-700 rounded-lg p-8 text-center text-neutral-500 text-sm my-1">
        🎬 点击输入视频 URL
      </div>
    )
  }

  // ── 文件 ──
  if (type === 'file') {
    const url = getPlainText(segs)
    return url ? (
      <a href={url} target="_blank" rel="noreferrer"
        className="flex items-center gap-2 my-1 px-4 py-2.5 bg-neutral-800/60 rounded-lg border border-neutral-700 hover:bg-neutral-800 transition-colors text-sm text-blue-400">
        <FileText size={15} className="shrink-0" />
        <span className="truncate">{content.fileName || url.split('/').pop() || '附件'}</span>
      </a>
    ) : (
      <div className="border-2 border-dashed border-neutral-700 rounded-lg p-6 text-center text-neutral-500 text-sm my-1">
        📎 点击输入文件 URL
      </div>
    )
  }

  // ── 书签 ──
  if (type === 'bookmark') {
    const url = getPlainText(segs)
    return url ? (
      <a href={url} target="_blank" rel="noreferrer"
        className="flex items-center gap-2 my-1 px-4 py-2.5 bg-neutral-800/60 rounded-lg border border-neutral-700 hover:bg-neutral-800 transition-colors text-sm text-blue-400">
        <Link size={15} className="shrink-0" />
        <span className="truncate">{url}</span>
      </a>
    ) : (
      <div className="border-2 border-dashed border-neutral-700 rounded-lg p-6 text-center text-neutral-500 text-sm my-1">
        🔗 点击输入网页 URL
      </div>
    )
  }

  // ── 分隔线 ──
  if (type === 'divider') return <hr className="border-neutral-700/60 my-2" />

  // ── 目录 ──
  if (type === 'toc') {
    const headings = allBlocks
      ? Array.from(allBlocks.values())
          .filter(b => ['heading1','heading2','heading3','heading4'].includes(b.type))
          .sort((a, b) => a.position - b.position)
      : []
    if (!headings.length) return (
      <div className="text-neutral-600 text-sm italic my-1 bg-neutral-800/30 rounded-lg px-4 py-3">
        目录将在添加标题后自动生成
      </div>
    )
    const indent: Record<string, string> = { heading1: 'ml-0 font-medium', heading2: 'ml-4', heading3: 'ml-8 text-neutral-400', heading4: 'ml-12 text-neutral-500' }
    return (
      <div className="bg-neutral-800/30 rounded-lg p-4 my-1 text-sm border border-neutral-700/30">
        <div className="text-[10px] text-neutral-600 font-semibold uppercase tracking-widest mb-2">目录</div>
        <div className="space-y-1">
          {headings.map(h => (
            <div key={h.id} className={`${indent[h.type] ?? ''} text-blue-400 hover:text-blue-300 cursor-pointer truncate`}>
              {getPlainText(h.content.rich_text) || '（无标题）'}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── toggle 摘要行 ──
  if (type === 'toggle') {
    return (
      <div className="flex items-baseline gap-1.5 text-neutral-200">
        <span className="text-neutral-500 text-[11px] shrink-0">
          {content.toggleOpen ? '▾' : '▸'}
        </span>
        <span><RichText segments={segs} /></span>
      </div>
    )
  }

  // ── 列布局 ──
  if (type === 'columns2' || type === 'columns3') {
    const n = type === 'columns2' ? 2 : 3
    return (
      <div className="grid gap-3 my-1" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
        {Array.from({ length: n }).map((_, i) => (
          <div key={i} className="min-h-10 rounded border border-dashed border-neutral-700/50 p-2 text-xs text-neutral-600">
            第 {i + 1} 列
          </div>
        ))}
      </div>
    )
  }

  // ── 文本类 ──
  switch (type) {
    case 'heading1': return <h1 className="text-[32px] font-bold text-neutral-100 mt-2 leading-tight"><RichText segments={segs} /></h1>
    case 'heading2': return <h2 className="text-2xl font-semibold text-neutral-100 mt-1"><RichText segments={segs} /></h2>
    case 'heading3': return <h3 className="text-xl font-medium text-neutral-200"><RichText segments={segs} /></h3>
    case 'heading4': return <h4 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider"><RichText segments={segs} /></h4>
    case 'quote':
      return (
        <blockquote className="border-l-[3px] border-neutral-600 pl-4 italic text-neutral-400 my-0.5">
          <RichText segments={segs} />
        </blockquote>
      )
    case 'bullet':
      return (
        <div className="flex items-baseline gap-2 text-neutral-200">
          <span className="text-neutral-600 shrink-0 text-xs">•</span>
          <span><RichText segments={segs} /></span>
        </div>
      )
    case 'numbered':
      return (
        <div className="flex items-baseline gap-2 text-neutral-200">
          <span className="text-neutral-500 shrink-0 tabular-nums text-sm min-w-[1.5rem] text-right">{content.numberStart ?? 1}.</span>
          <span><RichText segments={segs} /></span>
        </div>
      )
    case 'todo':
      return (
        <div className="flex items-center gap-2 text-neutral-200">
          <input type="checkbox" checked={!!block.metadata?.checked} onChange={() => {}} className="accent-blue-500 shrink-0" />
          <span className={block.metadata?.checked ? 'line-through text-neutral-500' : ''}>
            <RichText segments={segs} />
          </span>
        </div>
      )
    default:
      return <p className="text-neutral-200 leading-relaxed"><RichText segments={segs} /></p>
  }
}

// ─── 内联编辑器 ───────────────────────────────────────────────────────────────

function InlineEditor({ block, isEditing, onCommit, onStartEdit, onKeyDown, allBlocks, onTableCommit }: {
  block: Block
  isEditing: boolean
  onCommit: (text: string) => void
  onStartEdit: () => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLElement>) => void
  allBlocks?: Map<string, Block>
  onTableCommit?: (rows: TableCell[][]) => void
}) {
  const [draft, setDraft] = useState(getPlainText(block.content.rich_text))
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing) {
      setDraft(getPlainText(block.content.rich_text))
      setTimeout(() => {
        const el = textareaRef.current ?? inputRef.current
        if (!el) return
        el.focus()
        const len = el.value.length
        el.setSelectionRange(len, len)
        if (el instanceof HTMLTextAreaElement) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px` }
      }, 0)
    }
  }, [isEditing])

  const commit = () => onCommit(draft)

  const handleKD = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && block.type !== 'code') { e.preventDefault(); commit(); onKeyDown?.(e); return }
    if (e.key === 'Escape') { e.preventDefault(); commit(); return }
    onKeyDown?.(e)
  }

  const autoResize = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const t = e.currentTarget; t.style.height = 'auto'; t.style.height = `${t.scrollHeight}px`
  }

  if (!isEditing) return (
    <div className="cursor-text w-full" onClick={onStartEdit}>
      <BlockViewContent block={block} allBlocks={allBlocks} onTableCommit={onTableCommit} />
    </div>
  )

  if (block.type === 'table') return (
    <BlockViewContent block={block} isEditing allBlocks={allBlocks} onTableCommit={onTableCommit} />
  )
  if (block.type === 'divider' || block.type === 'toc') { commit(); return <BlockViewContent block={block} allBlocks={allBlocks} /> }

  const shared = 'w-full bg-transparent border-none outline-none resize-none text-inherit font-inherit caret-white placeholder-neutral-600'

  if (block.type === 'code') return (
    <textarea ref={textareaRef} value={draft} onChange={e => setDraft(e.target.value)}
      onBlur={commit} onKeyDown={handleKD}
      rows={Math.max(3, draft.split('\n').length + 1)}
      className={`${shared} font-mono text-sm text-green-300 leading-relaxed`}
      placeholder="// 输入代码…" spellCheck={false} />
  )

  if (['image','video','file','bookmark'].includes(block.type)) {
    const ph = { image:'图片 URL…', video:'视频 URL…', file:'文件 URL…', bookmark:'网页 URL…' }[block.type] ?? 'URL…'
    return <input ref={inputRef} type="text" value={draft} onChange={e => setDraft(e.target.value)}
      onBlur={commit} onKeyDown={handleKD as any} className={`${shared} text-sm`} placeholder={ph} />
  }

  return (
    <textarea ref={textareaRef} value={draft} onChange={e => setDraft(e.target.value)}
      onBlur={commit} onKeyDown={handleKD} onInput={autoResize}
      rows={1} className={`${shared} overflow-hidden leading-relaxed`} placeholder="输入内容…" />
  )
}

// ─── 块组件 ───────────────────────────────────────────────────────────────────

type DropZone = 'before' | 'after' | 'inside' | null

interface BlockNodeProps {
  block: Block
  level: number
  allBlocks: Map<string, Block>
  getChildren: (id: string | null) => Block[]
  editingId: string | null
  setEditingId: (id: string | null) => void
  focusedId: string | null
  setFocusedId: (id: string | null) => void
  onUpdate: (id: string, updates: Partial<Block>) => void
  onDelete: (id: string) => void
  onAddAfter: (refId: string, type?: BlockType) => void
  onAddInside: (parentId: string, type?: BlockType) => void
  onMove: (dragId: string, targetId: string, zone: 'before' | 'after' | 'inside') => void
  onIndent: (id: string) => void
  onOutdent: (id: string) => void
  showSlashMenu: (anchorId: string, rect: DOMRect) => void
  siblingIndex?: number
}

function BlockNode({
  block, level, allBlocks, getChildren,
  editingId, setEditingId, focusedId, setFocusedId,
  onUpdate, onDelete, onAddAfter, onAddInside, onMove,
  onIndent, onOutdent, showSlashMenu, siblingIndex = 0,
}: BlockNodeProps) {
  const rowRef = useRef<HTMLDivElement>(null)
  const [dropZone, setDropZone] = useState<DropZone>(null)

  const children = getChildren(block.id)
  const hasChildren = children.length > 0
  const isEditing = editingId === block.id
  const isFocused = focusedId === block.id

  // 有序列表注入序号
  const blockWithNum = block.type === 'numbered'
    ? { ...block, content: { ...block.content, numberStart: siblingIndex + 1 } }
    : block

  // ── 拖拽 ──
  const [{ isDragging }, drag] = useDrag({
    type: ITEM_TYPE, item: { id: block.id },
    collect: m => ({ isDragging: m.isDragging() }),
  })

  const [, drop] = useDrop<{ id: string }, void, {}>({
    accept: ITEM_TYPE,
    hover(item, monitor) {
      if (!rowRef.current || item.id === block.id) return
      const isDesc = (cId: string, aId: string): boolean => {
        const b = allBlocks.get(cId)
        if (!b || b.parentId === null) return false
        return b.parentId === aId || isDesc(b.parentId, aId)
      }
      if (isDesc(block.id, item.id)) return
      const rect = rowRef.current.getBoundingClientRect()
      const ratio = (monitor.getClientOffset()!.y - rect.top) / rect.height
      setDropZone(ratio < 0.25 ? 'before' : (ratio > 0.75 && level < MAX_NEST_LEVEL) ? 'inside' : 'after')
    },
    drop(item, monitor) {
      if (monitor.didDrop() || !dropZone || item.id === block.id) return
      onMove(item.id, block.id, dropZone); setDropZone(null)
    },
    collect: () => ({})
  })

  drag(drop(rowRef))

  const handleCommit = (text: string) => {
    onUpdate(block.id, { content: { ...block.content, rich_text: makeSegs(text) } })
  }

  const handleTableCommit = (rows: TableCell[][]) => {
    onUpdate(block.id, { content: { ...block.content, tableRows: rows, tableColCount: rows[0]?.length ?? block.content.tableColCount } })
  }

  const handleKD = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && block.type !== 'code') {
      onAddAfter(block.id); setEditingId(null)
    } else if (e.key === 'Tab') {
      e.preventDefault()
      e.shiftKey ? onOutdent(block.id) : onIndent(block.id)
    } else if (e.key === 'Backspace' && getPlainText(block.content.rich_text) === '') {
      e.preventDefault(); onDelete(block.id)
    } else if (e.key === '/' && getPlainText(block.content.rich_text) === '') {
      if (rowRef.current) showSlashMenu(block.id, rowRef.current.getBoundingClientRect())
    }
  }

  const dropCls = dropZone === 'before' ? 'border-t-2 border-blue-400'
    : dropZone === 'after' ? 'border-b-2 border-blue-400'
    : dropZone === 'inside' ? 'ring-2 ring-blue-400/60 ring-inset'
    : ''

  const isToggle = block.type === 'toggle'
  const childrenVisible = !block.collapsed && (!isToggle || block.content.toggleOpen)

  return (
    <div className={`relative ${isDragging ? 'opacity-25' : ''}`} onMouseLeave={() => setDropZone(null)}>
      {/* 块行 */}
      <div
        ref={rowRef}
        className={`group flex items-start gap-1 rounded-md py-[3px] transition-colors
          ${isFocused && !isEditing ? 'bg-white/5' : 'hover:bg-white/[0.04]'}
          ${dropCls}`}
        style={{ paddingLeft: `${level * 24 + 4}px` }}
        onClick={() => { setFocusedId(block.id); setEditingId(block.id) }}
      >
        {/* 折叠 + 拖拽 */}
        <div className="flex items-center gap-0.5 shrink-0 pt-1">
          {(hasChildren || isToggle) ? (
            <button
              onClick={e => {
                e.stopPropagation()
                isToggle
                  ? onUpdate(block.id, { content: { ...block.content, toggleOpen: !block.content.toggleOpen } })
                  : onUpdate(block.id, { collapsed: !block.collapsed })
              }}
              className="w-4 h-4 flex items-center justify-center text-neutral-700 hover:text-neutral-400 transition-colors"
            >
              {childrenVisible ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            </button>
          ) : <div className="w-4" />}

          <div
            className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
            onMouseDown={e => e.stopPropagation()}
          >
            <GripVertical size={13} className="text-neutral-700 hover:text-neutral-500" />
          </div>
        </div>

        {/* 内容区 */}
        <div className="flex-1 min-w-0 py-[1px]">
          {/* 代码语言选择器 */}
          {block.type === 'code' && (
            <div className="mb-1" onClick={e => e.stopPropagation()}>
              <select
                value={block.content.language ?? 'plaintext'}
                onChange={e => onUpdate(block.id, { content: { ...block.content, language: e.target.value } })}
                className="text-[11px] bg-neutral-800 border border-neutral-700 rounded px-2 py-0.5 text-neutral-400 outline-none cursor-pointer hover:border-neutral-600"
              >
                {CODE_LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          )}

          <InlineEditor
            block={blockWithNum}
            isEditing={isEditing}
            onCommit={handleCommit}
            onStartEdit={() => { setFocusedId(block.id); setEditingId(block.id) }}
            onKeyDown={handleKD}
            allBlocks={allBlocks}
            onTableCommit={handleTableCommit}
          />
        </div>

        {/* 操作按钮 */}
        <div className="shrink-0 opacity-0 group-hover:opacity-100 flex items-center gap-0.5 pt-1 transition-opacity">
          <button onClick={e => { e.stopPropagation(); onAddAfter(block.id) }}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-neutral-600 hover:text-neutral-300 transition-colors" title="同级添加（Enter）">
            <Plus size={11} />
          </button>
          <button onClick={e => { e.stopPropagation(); onAddInside(block.id) }}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-neutral-600 hover:text-neutral-300 transition-colors" title="添加子块（Tab）">
            <ArrowRight size={11} />
          </button>
          <button onClick={e => { e.stopPropagation(); onDelete(block.id) }}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-500/20 text-neutral-600 hover:text-red-400 transition-colors" title="删除">
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      {/* 子块递归（无限嵌套） */}
      {childrenVisible && children.map((child, idx) => (
        <BlockNode
          key={child.id}
          block={child}
          level={level + 1}
          allBlocks={allBlocks}
          getChildren={getChildren}
          editingId={editingId}
          setEditingId={setEditingId}
          focusedId={focusedId}
          setFocusedId={setFocusedId}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onAddAfter={onAddAfter}
          onAddInside={onAddInside}
          onMove={onMove}
          onIndent={onIndent}
          onOutdent={onOutdent}
          showSlashMenu={showSlashMenu}
          siblingIndex={idx}
        />
      ))}
    </div>
  )
}

// ─── 斜杠菜单 ────────────────────────────────────────────────────────────────

function SlashMenu({ position, onSelect, onClose }: {
  position: { top: number; left: number }
  onSelect: (type: BlockType) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [search, setSearch] = useState('')
  const [hIdx, setHIdx] = useState(0)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])

  const filtered = search
    ? ALL_BLOCK_TYPES.filter(b => b.label.includes(search) || b.shortcut.includes(search.toLowerCase()) || b.desc.includes(search))
    : null

  useEffect(() => setHIdx(0), [search])

  const handleKD = (e: React.KeyboardEvent) => {
    const list = filtered ?? ALL_BLOCK_TYPES
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHIdx(h => Math.min(h + 1, list.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setHIdx(h => Math.max(h - 1, 0)) }
    if (e.key === 'Enter' && list[hIdx]) onSelect(list[hIdx].type)
  }

  const style: React.CSSProperties = {
    top: Math.min(position.top, window.innerHeight - 440),
    left: Math.min(position.left, window.innerWidth - 256),
  }

  return (
    <div ref={ref} className="fixed z-50 bg-[#1e1e1e] border border-neutral-700/80 rounded-xl shadow-2xl w-64 overflow-hidden" style={style}>
      <div className="px-3 py-2 border-b border-neutral-800">
        <input autoFocus value={search} onChange={e => setSearch(e.target.value)} onKeyDown={handleKD}
          placeholder="搜索块类型…"
          className="w-full bg-transparent text-sm text-neutral-200 outline-none placeholder-neutral-600" />
      </div>
      <div className="max-h-[360px] overflow-y-auto py-1">
        {filtered ? (
          filtered.length === 0
            ? <p className="text-xs text-neutral-600 px-4 py-3">无匹配结果</p>
            : filtered.map((bt, i) => {
                const Icon = bt.icon
                return (
                  <button key={bt.type} onClick={() => onSelect(bt.type)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${i === hIdx ? 'bg-white/10' : 'hover:bg-white/5'}`}>
                    <Icon size={14} className="text-neutral-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-neutral-200">{bt.label}</div>
                      <div className="text-[10px] text-neutral-600 truncate">{bt.desc}</div>
                    </div>
                    <span className="text-[10px] text-neutral-700 font-mono shrink-0">/{bt.shortcut}</span>
                  </button>
                )
              })
        ) : (
          BLOCK_TYPE_GROUPS.map(group => (
            <div key={group.group}>
              <div className="text-[10px] text-neutral-700 font-semibold uppercase tracking-widest px-3 pt-3 pb-1.5">{group.group}</div>
              {group.items.map((bt, gi) => {
                const globalIdx = ALL_BLOCK_TYPES.findIndex(x => x.type === bt.type)
                const Icon = bt.icon
                return (
                  <button key={bt.type} onClick={() => onSelect(bt.type)}
                    className={`w-full flex items-center gap-3 px-3 py-1.5 text-left transition-colors ${globalIdx === hIdx ? 'bg-white/10' : 'hover:bg-white/5'}`}>
                    <Icon size={14} className="text-neutral-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-neutral-200">{bt.label}</div>
                      <div className="text-[10px] text-neutral-600 truncate">{bt.desc}</div>
                    </div>
                    <span className="text-[10px] text-neutral-700 font-mono shrink-0">/{bt.shortcut}</span>
                  </button>
                )
              })}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ─── 主编辑器 ────────────────────────────────────────────────────────────────

export default function BlockEditor({
  initialBlocks = [], onChange, readOnly = false, title: initTitle = '',
}: {
  initialBlocks?: Block[]
  onChange?: (blocks: Block[]) => void
  readOnly?: boolean
  title?: string
}) {
  const [blocksMap, setBlocksMap] = useState<Map<string, Block>>(() => {
    if (initialBlocks.length) return new Map(initialBlocks.map(b => [b.id, b]))
    const id = generateId()
    return new Map([[id, { id, parentId: null, type: 'paragraph' as BlockType, content: { rich_text: [] }, position: 1 }]])
  })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [slashMenu, setSlashMenu] = useState<{ anchorId: string; pos: { top: number; left: number } } | null>(null)
  const [docTitle, setDocTitle] = useState(initTitle)

  const emit = useCallback((m: Map<string, Block>) => onChange?.(Array.from(m.values())), [onChange])

  const getChildren = useCallback((parentId: string | null) =>
    Array.from(blocksMap.values()).filter(b => b.parentId === parentId).sort((a, b) => a.position - b.position)
  , [blocksMap])

  const updateBlock = useCallback((id: string, updates: Partial<Block>) => {
    setBlocksMap(prev => {
      const b = prev.get(id); if (!b) return prev
      const next = new Map(prev); next.set(id, { ...b, ...updates }); emit(next); return next
    })
  }, [emit])

  const deleteBlock = useCallback((id: string) => {
    setBlocksMap(prev => {
      const next = new Map(prev)
      const rm = (bid: string) => { Array.from(next.values()).filter(b => b.parentId === bid).forEach(c => rm(c.id)); next.delete(bid) }
      rm(id)
      if (!Array.from(next.values()).some(b => b.parentId === null)) {
        const def: Block = { id: generateId(), parentId: null, type: 'paragraph', content: { rich_text: [] }, position: 1 }
        next.set(def.id, def); setFocusedId(def.id); setEditingId(def.id)
      } else { setFocusedId(null); setEditingId(null) }
      emit(next); return next
    })
  }, [emit])

  const addAfter = useCallback((refId: string, type: BlockType = 'paragraph') => {
    setBlocksMap(prev => {
      const ref = prev.get(refId); if (!ref) return prev
      const sibs = Array.from(prev.values()).filter(b => b.parentId === ref.parentId).sort((a,b) => a.position - b.position)
      const idx = sibs.findIndex(b => b.id === refId)
      const nb: Block = { id: generateId(), parentId: ref.parentId, type, content: defaultContent(type),
        position: positionBetween(sibs[idx]?.position ?? null, sibs[idx+1]?.position ?? null) }
      const next = new Map(prev); next.set(nb.id, nb)
      setFocusedId(nb.id); setEditingId(nb.id); emit(next); return next
    })
  }, [emit])

  const addInside = useCallback((parentId: string, type: BlockType = 'paragraph') => {
    setBlocksMap(prev => {
      const children = Array.from(prev.values()).filter(b => b.parentId === parentId).sort((a,b) => a.position - b.position)
      const nb: Block = { id: generateId(), parentId, type, content: defaultContent(type),
        position: children.length ? children[children.length-1].position + 1 : 1 }
      const next = new Map(prev); next.set(nb.id, nb)
      const parent = prev.get(parentId)
      if (parent) {
        if (parent.type === 'toggle') next.set(parentId, { ...parent, content: { ...parent.content, toggleOpen: true } })
        else if (parent.collapsed) next.set(parentId, { ...parent, collapsed: false })
      }
      setFocusedId(nb.id); setEditingId(nb.id); emit(next); return next
    })
  }, [emit])

  const moveBlock = useCallback((dragId: string, targetId: string, zone: 'before'|'after'|'inside') => {
    setBlocksMap(prev => {
      const drag = prev.get(dragId), target = prev.get(targetId)
      if (!drag || !target || dragId === targetId) return prev
      const isAnc = (cId: string, aId: string): boolean => {
        const b = prev.get(cId); if (!b || b.parentId === null) return false
        return b.parentId === aId || isAnc(b.parentId, aId)
      }
      if (isAnc(targetId, dragId)) return prev
      let newParentId: string|null, newPos: number
      if (zone === 'inside') {
        newParentId = targetId
        const ch = Array.from(prev.values()).filter(b => b.parentId === targetId).sort((a,b) => a.position-b.position)
        newPos = ch.length ? ch[ch.length-1].position + 1 : 1
      } else {
        newParentId = target.parentId
        const sibs = Array.from(prev.values()).filter(b => b.parentId === target.parentId && b.id !== dragId).sort((a,b) => a.position-b.position)
        const idx = sibs.findIndex(b => b.id === targetId)
        newPos = positionBetween(
          zone === 'after' ? sibs[idx]?.position ?? null : sibs[idx-1]?.position ?? null,
          zone === 'before' ? sibs[idx]?.position ?? null : sibs[idx+1]?.position ?? null,
        )
      }
      const next = new Map(prev); next.set(dragId, { ...drag, parentId: newParentId, position: newPos }); emit(next); return next
    })
  }, [emit])

  const indentBlock = useCallback((id: string) => {
    setBlocksMap(prev => {
      const block = prev.get(id); if (!block) return prev
      const sibs = Array.from(prev.values()).filter(b => b.parentId === block.parentId).sort((a,b) => a.position-b.position)
      const idx = sibs.findIndex(b => b.id === id); if (idx === 0) return prev
      const newParent = sibs[idx-1]
      const ch = Array.from(prev.values()).filter(b => b.parentId === newParent.id).sort((a,b) => a.position-b.position)
      const next = new Map(prev)
      next.set(id, { ...block, parentId: newParent.id, position: ch.length ? ch[ch.length-1].position+1 : 1 })
      next.set(newParent.id, { ...newParent, collapsed: false,
        content: newParent.type === 'toggle' ? { ...newParent.content, toggleOpen: true } : newParent.content })
      emit(next); return next
    })
  }, [emit])

  const outdentBlock = useCallback((id: string) => {
    setBlocksMap(prev => {
      const block = prev.get(id); if (!block || block.parentId === null) return prev
      const parent = prev.get(block.parentId); if (!parent) return prev
      const gsibs = Array.from(prev.values()).filter(b => b.parentId === parent.parentId).sort((a,b) => a.position-b.position)
      const pidx = gsibs.findIndex(b => b.id === parent.id)
      const next = new Map(prev)
      next.set(id, { ...block, parentId: parent.parentId,
        position: positionBetween(gsibs[pidx]?.position ?? null, gsibs[pidx+1]?.position ?? null) })
      emit(next); return next
    })
  }, [emit])

  const showSlashMenu = useCallback((anchorId: string, rect: DOMRect) => {
    setSlashMenu({ anchorId, pos: { top: rect.bottom + 4, left: rect.left } })
  }, [])

  const handleSlashSelect = (type: BlockType) => {
    if (!slashMenu) return
    setBlocksMap(prev => {
      const b = prev.get(slashMenu.anchorId); if (!b) return prev
      const next = new Map(prev)
      next.set(slashMenu.anchorId, { ...b, type, content: { ...defaultContent(type), rich_text: b.content.rich_text } })
      emit(next); return next
    })
    setSlashMenu(null)
    setEditingId(slashMenu.anchorId)
  }

  const rootBlocks = getChildren(null)

  return (
    <DndProvider backend={HTML5Backend}>
      <div
        className="min-h-screen bg-[#191919] text-neutral-200"
        style={{ fontFamily: "'PingFang SC','Noto Serif SC','Microsoft YaHei',serif" }}
        onClick={() => setEditingId(null)}
      >
        {/* 顶栏 */}
        <div className="sticky top-0 z-40 bg-[#191919]/90 backdrop-blur-sm border-b border-white/5 px-6 py-2 flex items-center justify-between">
          <div className="flex items-center gap-4 text-[11px] text-neutral-700">
            {[
              ['Tab','缩进'],['Shift+Tab','反缩进'],['/','插入块'],['Enter','新建同级'],['→','添加子块'],
            ].map(([k,v]) => (
              <span key={k}><kbd className="bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-600">{k}</kbd> {v}</span>
            ))}
          </div>
          <span className="text-[11px] text-neutral-700">{blocksMap.size} 块</span>
        </div>

        <div className="max-w-[740px] mx-auto px-12 py-16">
          {/* 文档标题 */}
          <input
            className="w-full bg-transparent text-[38px] font-bold text-neutral-100 placeholder-neutral-700/60 outline-none border-none mb-10 leading-tight"
            placeholder="无标题"
            value={docTitle}
            onChange={e => setDocTitle(e.target.value)}
          />

          {/* 块列表 */}
          <div onClick={e => e.stopPropagation()}>
            {rootBlocks.map((block, idx) => (
              <BlockNode
                key={block.id}
                block={block}
                level={0}
                allBlocks={blocksMap}
                getChildren={getChildren}
                editingId={editingId}
                setEditingId={setEditingId}
                focusedId={focusedId}
                setFocusedId={setFocusedId}
                onUpdate={updateBlock}
                onDelete={deleteBlock}
                onAddAfter={addAfter}
                onAddInside={addInside}
                onMove={moveBlock}
                onIndent={indentBlock}
                onOutdent={outdentBlock}
                showSlashMenu={showSlashMenu}
                siblingIndex={idx}
              />
            ))}
          </div>

          {/* 底部点击区域 */}
          <div className="h-40 cursor-text"
            onClick={e => { e.stopPropagation(); const r = rootBlocks; if (r.length) addAfter(r[r.length-1].id) }} />
        </div>

        {slashMenu && (
          <SlashMenu
            position={slashMenu.pos}
            onSelect={handleSlashSelect}
            onClose={() => setSlashMenu(null)}
          />
        )}
      </div>
    </DndProvider>
  )
}
