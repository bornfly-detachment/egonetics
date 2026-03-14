// ============================================================
//  BlockEditor.tsx  —  块编辑器（含 subpage 块类型）
//  依赖: react-dnd, react-dnd-html5-backend, lucide-react
// ============================================================
import React, { useState, useRef, useCallback, useEffect, memo } from 'react'
import { updateBlockMeta, publishBlock, getBlockVersions } from '@/lib/block-graph-api'
import type { ProcessVersion } from './types'
import { useAuthStore } from '@/stores/useAuthStore'
import {
  Plus,
  Trash2,
  GripVertical,
  Type,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code,
  Image,
  Minus,
  ChevronRight,
  ChevronDown,
  Table,
  AlertCircle,
  Info,
  AlertTriangle,
  Lightbulb,
  ToggleLeft,
  Columns,
  Link,
  Hash,
  Film,
  FileText,
  BookOpen,
  Star,
  ArrowRight,
  FileEdit,
  Tag,
} from 'lucide-react'
import { DndProvider, useDrag, useDrop } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import type { Block, BlockType, RichTextSegment, TableCell, BlockPermissions } from './types'
import BlockTagSelector, { SelectedTagsList } from './BlockTagSelector'
import BlockWrapper from './rich-editor/shared/BlockWrapper'

export type { Block, BlockType, RichTextSegment, TableCell, BlockPermissions }
const DEFAULT_PERM: BlockPermissions = {
  canEdit: true,
  canDelete: true,
  canAdd: true,
  canReorder: true,
}

// ─── 代码语言列表 ──────────────────────────────────────────────────────────────
const CODE_LANGUAGES = [
  'plaintext',
  'markdown',
  'json',
  'javascript',
  'typescript',
  'python',
  'java',
  'c',
  'cpp',
  'csharp',
  'go',
  'rust',
  'php',
  'ruby',
  'swift',
  'kotlin',
  'scala',
  'bash',
  'shell',
  'powershell',
  'sql',
  'html',
  'css',
  'scss',
  'xml',
  'yaml',
  'toml',
  'dockerfile',
  'graphql',
  'r',
  'matlab',
  'lua',
  'perl',
  'haskell',
  'elixir',
]

// ─── 块类型配置 ────────────────────────────────────────────────────────────────
const BLOCK_TYPE_GROUPS = [
  {
    group: '基础文本',
    items: [
      {
        type: 'paragraph' as const,
        label: '段落',
        icon: Type,
        shortcut: 'text',
        desc: '普通段落文本',
      },
      {
        type: 'heading1' as const,
        label: '标题 1',
        icon: Heading1,
        shortcut: 'h1',
        desc: '大标题',
      },
      {
        type: 'heading2' as const,
        label: '标题 2',
        icon: Heading2,
        shortcut: 'h2',
        desc: '中标题',
      },
      {
        type: 'heading3' as const,
        label: '标题 3',
        icon: Heading3,
        shortcut: 'h3',
        desc: '小标题',
      },
      { type: 'heading4' as const, label: '标题 4', icon: Hash, shortcut: 'h4', desc: '最小标题' },
      { type: 'quote' as const, label: '引用', icon: Quote, shortcut: 'quote', desc: '引用段落' },
    ],
  },
  {
    group: '列表',
    items: [
      {
        type: 'bullet' as const,
        label: '无序列表',
        icon: List,
        shortcut: 'ul',
        desc: '• 项目列表',
      },
      {
        type: 'numbered' as const,
        label: '有序列表',
        icon: ListOrdered,
        shortcut: 'ol',
        desc: '1. 2. 3.',
      },
      {
        type: 'todo' as const,
        label: '待办事项',
        icon: CheckSquare,
        shortcut: 'todo',
        desc: '可勾选列表',
      },
      {
        type: 'toggle' as const,
        label: '折叠列表',
        icon: ToggleLeft,
        shortcut: 'tog',
        desc: '可折叠块',
      },
    ],
  },
  {
    group: '标注',
    items: [
      {
        type: 'callout_info' as const,
        label: '信息',
        icon: Info,
        shortcut: 'info',
        desc: '🔵 信息提示',
      },
      {
        type: 'callout_warning' as const,
        label: '警告',
        icon: AlertTriangle,
        shortcut: 'warn',
        desc: '🟡 警告提示',
      },
      {
        type: 'callout_success' as const,
        label: '成功',
        icon: AlertCircle,
        shortcut: 'ok',
        desc: '🟢 成功提示',
      },
      {
        type: 'callout_tip' as const,
        label: '技巧',
        icon: Lightbulb,
        shortcut: 'tip',
        desc: '💡 小技巧',
      },
    ],
  },
  {
    group: '代码 & 公式',
    items: [
      { type: 'code' as const, label: '代码块', icon: Code, shortcut: 'code', desc: '多语言代码' },
      {
        type: 'math' as const,
        label: '行内公式',
        icon: BookOpen,
        shortcut: 'math',
        desc: 'LaTeX 行内',
      },
      {
        type: 'equation_block' as const,
        label: '公式块',
        icon: Star,
        shortcut: 'eq',
        desc: 'LaTeX 独立块',
      },
    ],
  },
  {
    group: '媒体',
    items: [
      {
        type: 'image' as const,
        label: '图片',
        icon: Image,
        shortcut: 'img',
        desc: '图片（URL 或本地文件）',
      },
      {
        type: 'video' as const,
        label: '视频',
        icon: Film,
        shortcut: 'vid',
        desc: '视频（URL 或本地文件）',
      },
      {
        type: 'audio' as const,
        label: '音频',
        icon: BookOpen,
        shortcut: 'audio',
        desc: '音频（URL 或本地文件）',
      },
      {
        type: 'file' as const,
        label: '文件',
        icon: FileText,
        shortcut: 'file',
        desc: '附件（PDF/ZIP/文档等）',
      },
      { type: 'bookmark' as const, label: '书签', icon: Link, shortcut: 'bm', desc: '网页书签' },
    ],
  },
  {
    group: '结构',
    items: [
      { type: 'table' as const, label: '表格', icon: Table, shortcut: 'table', desc: '结构化表格' },
      {
        type: 'columns2' as const,
        label: '两列',
        icon: Columns,
        shortcut: 'col2',
        desc: '两栏布局',
      },
      {
        type: 'columns3' as const,
        label: '三列',
        icon: Columns,
        shortcut: 'col3',
        desc: '三栏布局',
      },
      { type: 'divider' as const, label: '分隔线', icon: Minus, shortcut: 'hr', desc: '水平线' },
      { type: 'toc' as const, label: '目录', icon: ArrowRight, shortcut: 'toc', desc: '自动目录' },
    ],
  },
  {
    group: '页面',
    items: [
      {
        type: 'subpage' as const,
        label: '子页面',
        icon: FileEdit,
        shortcut: 'page',
        desc: '嵌入一个子页面入口',
      },
    ],
  },
]

interface BlockTypeItem {
  type: BlockType
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  shortcut: string
  desc: string
}
const ALL_BLOCK_TYPES: BlockTypeItem[] = BLOCK_TYPE_GROUPS.flatMap(
  (g) => g.items as BlockTypeItem[]
)
const MAX_NEST_LEVEL = 8
const ITEM_TYPE = 'BLOCK'
export const generateBlockId = () => `b-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`

// ─── 工具函数 ──────────────────────────────────────────────────────────────────
export const getPlainText = (segs: RichTextSegment[]) => segs.map((s) => s.text).join('')
export const makeSegs = (text: string): RichTextSegment[] => [{ text }]

export function positionBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return 1
  if (before === null) return (after as number) / 2
  if (after === null) return (before as number) + 1
  return (before + (after as number)) / 2
}

export function defaultBlockContent(type: BlockType): Block['content'] {
  if (type === 'table')
    return {
      rich_text: [],
      tableColCount: 3,
      tableHasHeader: true,
      tableRows: [
        [
          { rich_text: makeSegs('列 1') },
          { rich_text: makeSegs('列 2') },
          { rich_text: makeSegs('列 3') },
        ],
        [{ rich_text: [] }, { rich_text: [] }, { rich_text: [] }],
      ],
    }
  if (type === 'code') return { rich_text: [], language: 'plaintext' }
  if (type === 'callout_info') return { rich_text: [], calloutIcon: 'ℹ️' }
  if (type === 'callout_warning') return { rich_text: [], calloutIcon: '⚠️' }
  if (type === 'callout_success') return { rich_text: [], calloutIcon: '✅' }
  if (type === 'callout_tip') return { rich_text: [], calloutIcon: '💡' }
  if (type === 'toggle') return { rich_text: [], toggleOpen: false }
  if (type === 'subpage') return { rich_text: [], subpageTitle: '新页面', subpageIcon: '📄' }
  return { rich_text: [] }
}

// ─── 斜杠菜单 ──────────────────────────────────────────────────────────────────
function SlashMenu({
  position,
  onSelect,
  onClose,
}: {
  position: { top: number; left: number }
  onSelect: (type: BlockType) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [search, setSearch] = useState('')
  const [hIdx, setHIdx] = useState(0)

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])

  const filtered = search
    ? ALL_BLOCK_TYPES.filter(
        (b) =>
          b.label.includes(search) ||
          b.shortcut.includes(search.toLowerCase()) ||
          b.desc.includes(search)
      )
    : null
  useEffect(() => setHIdx(0), [search])

  const handleKD = (e: React.KeyboardEvent) => {
    const list = filtered ?? ALL_BLOCK_TYPES
    if (e.key === 'Escape') {
      onClose()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHIdx((h) => Math.min(h + 1, list.length - 1))
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHIdx((h) => Math.max(h - 1, 0))
    }
    if (e.key === 'Enter' && list[hIdx]) onSelect(list[hIdx].type)
  }

  const style: React.CSSProperties = {
    top: Math.min(position.top, window.innerHeight - 440),
    left: Math.min(position.left, window.innerWidth - 256),
  }

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-[#1e1e1e] border border-neutral-700/80 rounded-xl shadow-2xl w-64 overflow-hidden"
      style={style}
    >
      <div className="px-3 py-2 border-b border-neutral-800">
        <input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleKD}
          placeholder="搜索块类型…"
          className="w-full bg-transparent text-sm text-neutral-200 outline-none placeholder-neutral-600"
        />
      </div>
      <div className="max-h-[360px] overflow-y-auto py-1">
        {filtered ? (
          filtered.length === 0 ? (
            <p className="text-xs text-neutral-600 px-4 py-3">无匹配结果</p>
          ) : (
            filtered.map((bt, i) => {
              const Icon = bt.icon
              return (
                <button
                  key={bt.type}
                  onClick={() => onSelect(bt.type)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${i === hIdx ? 'bg-white/10' : 'hover:bg-white/5'}`}
                >
                  <Icon size={14} className="text-neutral-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-neutral-200">{bt.label}</div>
                    <div className="text-[10px] text-neutral-600 truncate">{bt.desc}</div>
                  </div>
                  <span className="text-[10px] text-neutral-700 font-mono shrink-0">
                    /{bt.shortcut}
                  </span>
                </button>
              )
            })
          )
        ) : (
          BLOCK_TYPE_GROUPS.map((group) => (
            <div key={group.group}>
              <div className="text-[10px] text-neutral-700 font-semibold uppercase tracking-widest px-3 pt-3 pb-1.5">
                {group.group}
              </div>
              {group.items.map((bt) => {
                const globalIdx = ALL_BLOCK_TYPES.findIndex((x) => x.type === bt.type)
                const Icon = bt.icon
                return (
                  <button
                    key={bt.type}
                    onClick={() => onSelect(bt.type)}
                    className={`w-full flex items-center gap-3 px-3 py-1.5 text-left transition-colors ${globalIdx === hIdx ? 'bg-white/10' : 'hover:bg-white/5'}`}
                  >
                    <Icon size={14} className="text-neutral-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-neutral-200">{bt.label}</div>
                      <div className="text-[10px] text-neutral-600 truncate">{bt.desc}</div>
                    </div>
                    <span className="text-[10px] text-neutral-700 font-mono shrink-0">
                      /{bt.shortcut}
                    </span>
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

// ─── BlockHeader ──────────────────────────────────────────────────────────────
// 每个 block 顶部的元信息行：标题 / 创建人 / 创建时间 / 发布 / 过程记忆 / 关系
// 无 title 时高度折叠为 0，hover 时展开
const BlockHeader = memo(function BlockHeader({
  block,
  onUpdate,
  canEdit,
}: {
  block: Block
  onUpdate: (updates: Partial<Block>) => void
  canEdit: boolean
}) {
  const { user } = useAuthStore()
  const [activePanel, setActivePanel] = useState<'publish' | 'memory' | 'relations' | null>(null)
  const [versions, setVersions]       = useState<ProcessVersion[]>([])
  const [loadingV, setLoadingV]       = useState(false)
  const [publishing, setPublishing]   = useState(false)
  const [draftSaved, setDraftSaved]   = useState(false)
  const [explanation, setExplanation] = useState(block.draftExplanation ?? '')
  const [relations, setRelations]     = useState<import('./types').Relation[]>([])
  const [loadingR, setLoadingR]       = useState(false)
  const [showRelForm, setShowRelForm] = useState(false)
  const [relForm, setRelForm]         = useState({ target_type: 'block', target_id: '', description: '', title: '' })
  const titleDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasTitle = !!(block.title?.trim())

  // ── 标题 ──────────────────────────────────────────────────────
  const handleTitleChange = (val: string) => {
    onUpdate({ title: val })
    if (!block.editStartTime) {
      const t = new Date().toISOString()
      onUpdate({ editStartTime: t })
      updateBlockMeta(block.id, { editStartTime: t }).catch(() => {})
    }
    if (titleDebounce.current) clearTimeout(titleDebounce.current)
    titleDebounce.current = setTimeout(() => {
      updateBlockMeta(block.id, { title: val }).catch(() => {})
    }, 400)
  }

  // ── 发布 ──────────────────────────────────────────────────────
  const handlePublish = async () => {
    setPublishing(true)
    try {
      if (!block.creator && user) {
        const creator = `human:${user.username}`
        onUpdate({ creator })
        await updateBlockMeta(block.id, { creator }).catch(() => {})
      }
      await publishBlock(block.id, explanation)
      onUpdate({ editStartTime: undefined, draftExplanation: '' })
      setActivePanel(null)
      setExplanation('')
      setVersions([])
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setPublishing(false)
    }
  }

  const handleSaveDraft = async () => {
    await updateBlockMeta(block.id, { draftExplanation: explanation }).catch(() => {})
    onUpdate({ draftExplanation: explanation })
    setDraftSaved(true)
    setTimeout(() => setDraftSaved(false), 2000)
  }

  // ── 过程记忆 ──────────────────────────────────────────────────
  const loadVersions = async () => {
    setLoadingV(true)
    const v = await getBlockVersions(block.id)
    setVersions(v)
    setLoadingV(false)
  }

  // ── 关系 ──────────────────────────────────────────────────────
  const loadRelations = async () => {
    setLoadingR(true)
    const { getRelations } = await import('@/lib/block-graph-api')
    const r = await getRelations({ source_id: block.id, source_type: 'block' })
    setRelations(r)
    setLoadingR(false)
  }

  const handleTogglePanel = (panel: 'publish' | 'memory' | 'relations') => {
    if (activePanel === panel) { setActivePanel(null); return }
    setActivePanel(panel)
    if (panel === 'memory') loadVersions()
    if (panel === 'relations') loadRelations()
  }

  const handleCreateRelation = async () => {
    if (!relForm.target_id.trim()) return
    const { createRelation } = await import('@/lib/block-graph-api')
    try {
      await createRelation({
        title: relForm.title,
        source_type: 'block',
        source_id: block.id,
        target_type: relForm.target_type as import('./types').EntityType,
        target_id: relForm.target_id.trim(),
        description: relForm.description,
      })
      setRelForm({ target_type: 'block', target_id: '', description: '', title: '' })
      setShowRelForm(false)
      loadRelations()
    } catch (e) {
      alert((e as Error).message)
    }
  }

  const handleDeleteRelation = async (id: string) => {
    const { deleteRelation } = await import('@/lib/block-graph-api')
    await deleteRelation(id).catch(() => {})
    setRelations(r => r.filter(x => x.id !== id))
  }

  // ── 显示信息 ──────────────────────────────────────────────────
  const creatorLabel = block.creator
    ? block.creator.replace('human:', '').replace('ai:', '🤖 ')
    : (user ? user.username : '')

  const createdAtLabel = block.createdAt
    ? new Date(block.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    : ''

  const hasDraft = !!(block.draftExplanation?.trim())

  return (
    <div
      className={`block-header group/hdr overflow-hidden transition-all duration-150 ${
        hasTitle || activePanel ? 'max-h-[800px] mb-1' : 'max-h-0 group-hover:max-h-[800px] group-hover:mb-1'
      }`}
      onClick={e => e.stopPropagation()}
    >
      {/* ── 标题行 ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 py-0.5">
        {canEdit ? (
          <input
            value={block.title ?? ''}
            onChange={e => handleTitleChange(e.target.value)}
            placeholder="块标题…"
            className="flex-1 min-w-0 bg-transparent text-xs text-neutral-400 placeholder-neutral-700 outline-none border-b border-transparent focus:border-neutral-700 transition-colors py-0.5"
          />
        ) : (
          hasTitle && <span className="flex-1 text-xs text-neutral-500 truncate">{block.title}</span>
        )}

        {/* 元信息 + 操作按钮：仅 hover 显示 */}
        <div className="shrink-0 flex items-center gap-1.5 opacity-0 group-hover/hdr:opacity-100 focus-within:opacity-100 transition-opacity">
          {creatorLabel   && <span className="text-[10px] text-neutral-600">{creatorLabel}</span>}
          {createdAtLabel && <span className="text-[10px] text-neutral-700">{createdAtLabel}</span>}

          {/* 发布 */}
          {canEdit && (
            <button
              onClick={() => handleTogglePanel('publish')}
              className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                activePanel === 'publish'
                  ? 'border-blue-500/60 text-blue-400'
                  : 'border-neutral-700 text-neutral-500 hover:border-blue-500/60 hover:text-blue-400'
              }${hasDraft ? ' after:content-["·"] after:text-blue-400 after:ml-0.5' : ''}`}
            >发布{hasDraft && <span className="ml-0.5 text-blue-400">·</span>}</button>
          )}

          {/* 过程记忆 */}
          <button
            onClick={() => handleTogglePanel('memory')}
            className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
              activePanel === 'memory'
                ? 'border-amber-500/60 text-amber-400'
                : 'border-neutral-700 text-neutral-500 hover:border-amber-500/40 hover:text-amber-500/80'
            }`}
          >记忆</button>

          {/* 关系 */}
          <button
            onClick={() => handleTogglePanel('relations')}
            className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
              activePanel === 'relations'
                ? 'border-purple-500/60 text-purple-400'
                : 'border-neutral-700 text-neutral-500 hover:border-purple-500/40 hover:text-purple-500/80'
            }`}
          >关系</button>
        </div>
      </div>

      {/* ── 发布面板 ────────────────────────────────────────────── */}
      {activePanel === 'publish' && (
        <div className="mt-1 border border-blue-900/40 rounded-lg bg-neutral-950/70 text-xs overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800/60">
            <span className="text-neutral-300 font-medium">发布说明</span>
            <span className="text-neutral-700 text-[10px]">记录这次改动的意图与上下文</span>
          </div>
          <div className="px-3 pt-2 pb-1">
            <textarea
              autoFocus
              value={explanation}
              onChange={e => setExplanation(e.target.value)}
              placeholder="这次做了什么？为什么这样改？留给未来的自己…"
              className="w-full bg-transparent border-0 outline-none resize-none text-xs text-neutral-200 placeholder-neutral-700 leading-relaxed min-h-[72px]"
            />
          </div>
          <div className="flex items-center justify-between px-3 pb-3 pt-1 border-t border-neutral-800/40">
            <button
              onClick={() => setActivePanel(null)}
              className="text-[10px] text-neutral-600 hover:text-neutral-400 transition-colors px-1 py-1"
            >取消</button>
            <div className="flex items-center gap-2">
              {draftSaved && <span className="text-[10px] text-neutral-600 animate-pulse">已存草稿</span>}
              <button
                onClick={handleSaveDraft}
                className="text-[10px] border border-neutral-700 text-neutral-500 hover:border-neutral-500 hover:text-neutral-300 transition-colors px-2.5 py-1 rounded"
              >存草稿</button>
              <button
                onClick={handlePublish}
                disabled={publishing}
                className="text-[10px] bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-3 py-1 rounded font-medium transition-colors"
              >{publishing ? '发布中…' : '确认发布'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 过程记忆面板 ───────────────────────────────────────── */}
      {activePanel === 'memory' && (
        <div className="mt-1 border border-neutral-800 rounded-lg bg-neutral-900/60 text-xs overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-neutral-800">
            <span className="text-neutral-400 font-medium">过程记忆</span>
            <span className="text-neutral-700">{versions.length} 个版本</span>
          </div>
          {loadingV ? (
            <p className="text-neutral-600 px-3 py-3 text-center">加载中…</p>
          ) : versions.length === 0 ? (
            <p className="text-neutral-700 px-3 py-3 text-center">尚未发布版本，点「发布」创建第一条记录</p>
          ) : (
            <div className="max-h-52 overflow-y-auto divide-y divide-neutral-800/60">
              {[...versions].reverse().map(v => (
                <div key={v.id} className="px-3 py-2">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-blue-500/80 font-mono">v{v.version_num}</span>
                    <span className="text-neutral-600">
                      {new Date(v.publish_time).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-neutral-700 text-[10px]">{v.publisher.replace('human:', '')}</span>
                    {v.start_time && (
                      <span className="text-neutral-800 text-[10px]">
                        开始 {new Date(v.start_time).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  {v.title_snapshot && <p className="text-neutral-500 truncate">标题: {v.title_snapshot}</p>}
                  {v.explanation    && <p className="text-neutral-400 mt-0.5 leading-relaxed">{v.explanation}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 关系面板 ───────────────────────────────────────────── */}
      {activePanel === 'relations' && (
        <div className="mt-1 border border-neutral-800 rounded-lg bg-neutral-900/60 text-xs overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-neutral-800">
            <span className="text-neutral-400 font-medium">关系</span>
            <button
              onClick={() => setShowRelForm(f => !f)}
              className="text-[10px] text-purple-500 hover:text-purple-300 transition-colors"
            >+ 新建关系</button>
          </div>

          {/* 新建关系表单 */}
          {showRelForm && (
            <div className="px-3 py-2 border-b border-neutral-800 space-y-1.5 bg-neutral-950/40">
              <input
                value={relForm.title}
                onChange={e => setRelForm(f => ({ ...f, title: e.target.value }))}
                placeholder="关系标题（可选）"
                className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200 outline-none focus:border-neutral-500"
              />
              <div className="flex gap-1.5">
                <select
                  value={relForm.target_type}
                  onChange={e => setRelForm(f => ({ ...f, target_type: e.target.value }))}
                  className="bg-neutral-900 border border-neutral-700 rounded px-1.5 py-1 text-xs text-neutral-300 outline-none"
                >
                  {['block','task','memory','theory','label','label_system'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <input
                  value={relForm.target_id}
                  onChange={e => setRelForm(f => ({ ...f, target_id: e.target.value }))}
                  placeholder="目标 ID"
                  className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200 outline-none focus:border-neutral-500"
                />
              </div>
              <input
                value={relForm.description}
                onChange={e => setRelForm(f => ({ ...f, description: e.target.value }))}
                placeholder="关系描述（开放文本：依赖 / 推导自 / 矛盾于…）"
                className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200 outline-none focus:border-neutral-500"
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowRelForm(false)} className="text-neutral-500 hover:text-neutral-300 px-2 py-1">取消</button>
                <button
                  onClick={handleCreateRelation}
                  disabled={!relForm.target_id.trim()}
                  className="bg-purple-700 hover:bg-purple-600 disabled:opacity-40 text-white px-3 py-1 rounded"
                >创建</button>
              </div>
            </div>
          )}

          {/* 关系列表 */}
          {loadingR ? (
            <p className="text-neutral-600 px-3 py-3 text-center">加载中…</p>
          ) : relations.length === 0 ? (
            <p className="text-neutral-700 px-3 py-3 text-center">暂无关系</p>
          ) : (
            <div className="max-h-52 overflow-y-auto divide-y divide-neutral-800/60">
              {relations.map(r => (
                <div key={r.id} className="px-3 py-2 flex items-start gap-2 group/rel">
                  <div className="flex-1 min-w-0">
                    {r.title && <p className="text-neutral-300 truncate font-medium">{r.title}</p>}
                    <p className="text-neutral-500">
                      <span className="text-neutral-700">{r.description || '→'}</span>
                      {' '}
                      <span className="text-purple-500/70">[{r.target_type}]</span>
                      {' '}
                      <span className="font-mono text-[10px] text-neutral-600 truncate">{r.target_id}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteRelation(r.id)}
                    className="opacity-0 group-hover/rel:opacity-100 text-neutral-700 hover:text-red-400 transition-all shrink-0 text-[10px] px-1"
                  >×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
})

// ─── 块节点 ────────────────────────────────────────────────────────────────────
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
  onNavigate?: (pageId: string) => void
  onCreateSubpage?: (blockId: string) => Promise<string>
  perm: BlockPermissions
}

function BlockNode({
  block,
  level,
  allBlocks,
  getChildren,
  editingId,
  setEditingId,
  focusedId,
  setFocusedId,
  onUpdate,
  onDelete,
  onAddAfter,
  onAddInside,
  onMove,
  onIndent,
  onOutdent,
  showSlashMenu,
  siblingIndex = 0,
  onNavigate,
  onCreateSubpage,
  perm,
}: BlockNodeProps) {
  const rowRef = useRef<HTMLDivElement>(null)
  const [dropZone, setDropZone] = useState<DropZone>(null)
  const [showTagSelector, setShowTagSelector] = useState(false)
  const children = getChildren(block.id)
  const hasChildren = children.length > 0
  const isEditing = editingId === block.id
  const isFocused = focusedId === block.id
  const isSubpage = block.type === 'subpage'
  const blockTags = block.metadata?.tags || []

  const blockWithNum =
    block.type === 'numbered'
      ? { ...block, content: { ...block.content, numberStart: siblingIndex + 1 } }
      : block

  const [{ isDragging }, drag] = useDrag({
    type: ITEM_TYPE,
    item: { id: block.id },
    collect: (m) => ({ isDragging: m.isDragging() }),
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
      setDropZone(
        ratio < 0.25 ? 'before' : ratio > 0.75 && level < MAX_NEST_LEVEL ? 'inside' : 'after'
      )
    },
    drop(item, monitor) {
      if (monitor.didDrop() || !dropZone || item.id === block.id) return
      onMove(item.id, block.id, dropZone)
      setDropZone(null)
    },
    collect: () => ({}),
  })
  if (perm.canReorder) drag(drop(rowRef))
  else drop(rowRef)

  const handleCommit = (text: string) =>
    onUpdate(block.id, { content: { ...block.content, rich_text: makeSegs(text) } })
  const handleTableCommit = (rows: TableCell[][]) =>
    onUpdate(block.id, {
      content: {
        ...block.content,
        tableRows: rows,
        tableColCount: rows[0]?.length ?? block.content.tableColCount,
      },
    })
  const handleTypeChange = (type: BlockType) =>
    onUpdate(block.id, { type, content: defaultBlockContent(type) })
  const handleUpdateContent = (patch: Partial<Block['content']>) =>
    onUpdate(block.id, { content: { ...block.content, ...patch } })
  const handleShowSlashMenu = () => {
    if (perm.canAdd && rowRef.current)
      showSlashMenu(block.id, rowRef.current.getBoundingClientRect())
  }
  const handleKD = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && block.type !== 'code') {
      if (perm.canAdd) {
        onAddAfter(block.id)
        setEditingId(null)
      }
    } else if (e.key === 'Tab') {
      e.preventDefault()
      e.shiftKey ? onOutdent(block.id) : onIndent(block.id)
    } else if (e.key === 'Backspace' && getPlainText(block.content.rich_text) === '') {
      e.preventDefault()
      if (perm.canDelete) onDelete(block.id)
    }
  }

  const dropCls =
    dropZone === 'before'
      ? 'border-t-2 border-blue-400'
      : dropZone === 'after'
        ? 'border-b-2 border-blue-400'
        : dropZone === 'inside'
          ? 'ring-2 ring-blue-400/60 ring-inset'
          : ''
  const isToggle = block.type === 'toggle'
  const childrenVisible = !block.collapsed && (!isToggle || block.content.toggleOpen)

  return (
    <div
      className={`relative ${isDragging ? 'opacity-25' : ''}`}
      onMouseLeave={() => setDropZone(null)}
    >
      <div
        ref={rowRef}
        className={`group flex items-start gap-1 rounded-md py-[3px] transition-colors ${isFocused && !isEditing ? 'bg-white/5' : 'hover:bg-white/[0.04]'} ${dropCls}`}
        style={{ paddingLeft: `${level * 24 + 4}px` }}
        onClick={() => {
          if (!isSubpage) {
            setFocusedId(block.id)
            if (perm.canEdit) setEditingId(block.id)
          }
        }}
      >
        {/* 折叠 + 拖拽 */}
        <div className="flex items-center gap-0.5 shrink-0 pt-1">
          {hasChildren || isToggle ? (
            <button
              onClick={(e) => {
                e.stopPropagation()
                isToggle
                  ? onUpdate(block.id, {
                      content: { ...block.content, toggleOpen: !block.content.toggleOpen },
                    })
                  : onUpdate(block.id, { collapsed: !block.collapsed })
              }}
              className="w-4 h-4 flex items-center justify-center text-neutral-700 hover:text-neutral-400 transition-colors"
            >
              {childrenVisible ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            </button>
          ) : (
            <div className="w-4" />
          )}
          {perm.canReorder ? (
            <div
              className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <GripVertical size={13} className="text-neutral-700 hover:text-neutral-500" />
            </div>
          ) : (
            <div className="w-4" />
          )}
        </div>

        {/* 内容 */}
        <div className="flex-1 min-w-0 py-[1px]">
          {/* Block 头部：标题 / 创建人 / 时间 / 发布 / 过程记忆 */}
          <BlockHeader
            block={block}
            onUpdate={(updates) => onUpdate(block.id, updates)}
            canEdit={perm.canEdit}
          />
          {/* 标签显示 */}
          {blockTags.length > 0 && (
            <div className="mb-1.5">
              <SelectedTagsList
                tags={blockTags}
                onRemove={
                  perm.canEdit
                    ? (tagId) => {
                        onUpdate(block.id, {
                          metadata: {
                            ...block.metadata,
                            tags: blockTags.filter((t) => t.tagId !== tagId),
                          },
                        })
                      }
                    : undefined
                }
              />
            </div>
          )}

          {block.type === 'code' && (
            <div className="mb-1" onClick={(e) => e.stopPropagation()}>
              <select
                value={block.content.language ?? 'plaintext'}
                onChange={(e) =>
                  onUpdate(block.id, { content: { ...block.content, language: e.target.value } })
                }
                className="text-[11px] bg-neutral-800 border border-neutral-700 rounded px-2 py-0.5 text-neutral-400 outline-none cursor-pointer hover:border-neutral-600"
              >
                {CODE_LANGUAGES.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          )}
          <BlockWrapper
            block={blockWithNum}
            isEditing={isEditing}
            canEdit={perm.canEdit}
            onCommit={handleCommit}
            onUpdate={(updates) => onUpdate(block.id, updates)}
            onUpdateContent={handleUpdateContent}
            onStartEdit={() => {
              if (!isSubpage) {
                setFocusedId(block.id)
                setEditingId(block.id)
              }
            }}
            onExitEdit={() => setEditingId(null)}
            onAddAfter={() => { if (perm.canAdd) onAddAfter(block.id) }}
            onDelete={() => { if (perm.canDelete) onDelete(block.id) }}
            onKeyDown={handleKD}
            allBlocks={allBlocks}
            onTableCommit={handleTableCommit}
            onNavigate={onNavigate}
            onCreateSubpage={onCreateSubpage}
            onTypeChange={perm.canEdit ? handleTypeChange : undefined}
            onSlashMenu={perm.canAdd ? handleShowSlashMenu : undefined}
          />
        </div>

        {/* 操作按钮 */}
        {(perm.canAdd || perm.canDelete || perm.canEdit) && (
          <div className="shrink-0 opacity-0 group-hover:opacity-100 flex items-center gap-0.5 pt-1 transition-opacity">
            {!isSubpage && perm.canEdit && (
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowTagSelector(!showTagSelector)
                  }}
                  className={`w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 transition-colors ${
                    blockTags.length > 0
                      ? 'text-blue-400'
                      : 'text-neutral-600 hover:text-neutral-300'
                  }`}
                  title="添加标签"
                >
                  <Tag size={11} />
                </button>
                {showTagSelector && (
                  <div className="absolute top-full right-0 mt-1 z-50">
                    <div onClick={(e) => e.stopPropagation()}>
                      <BlockTagSelector
                        selectedTags={blockTags}
                        onChange={(tags) => {
                          onUpdate(block.id, {
                            metadata: { ...block.metadata, tags },
                          })
                        }}
                        onClose={() => setShowTagSelector(false)}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
            {!isSubpage && perm.canAdd && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onAddAfter(block.id)
                  }}
                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-neutral-600 hover:text-neutral-300 transition-colors"
                  title="同级添加（Enter）"
                >
                  <Plus size={11} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onAddInside(block.id)
                  }}
                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-neutral-600 hover:text-neutral-300 transition-colors"
                  title="添加子块（Tab）"
                >
                  <ArrowRight size={11} />
                </button>
              </>
            )}
            {perm.canDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(block.id)
                }}
                className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-500/20 text-neutral-600 hover:text-red-400 transition-colors"
                title="删除"
              >
                <Trash2 size={11} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* 子块递归 */}
      {childrenVisible &&
        children.map((child, idx) => (
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
            onNavigate={onNavigate}
            onCreateSubpage={onCreateSubpage}
            perm={perm}
          />
        ))}
    </div>
  )
}

// ─── 主编辑器组件 ──────────────────────────────────────────────────────────────
export interface BlockEditorProps {
  pageId: string
  initialBlocks?: Block[]
  onChange?: (blocks: Block[]) => void
  readOnly?: boolean
  permissions?: Partial<BlockPermissions>
  onNavigate?: (pageId: string) => void
  onCreateSubpage?: (blockId: string, parentPageId: string) => Promise<string>
}

export default function BlockEditor({
  pageId,
  initialBlocks = [],
  onChange,
  readOnly = false,
  permissions,
  onNavigate,
  onCreateSubpage,
}: BlockEditorProps) {
  const perm: BlockPermissions = {
    ...DEFAULT_PERM,
    ...(readOnly ? { canEdit: false, canDelete: false, canAdd: false, canReorder: false } : {}),
    ...permissions,
  }

  const [blocksMap, setBlocksMap] = useState<Map<string, Block>>(() => {
    if (initialBlocks.length) return new Map(initialBlocks.map((b) => [b.id, b]))
    const id = generateBlockId()
    return new Map([
      [
        id,
        {
          id,
          parentId: null,
          type: 'paragraph' as BlockType,
          content: { rich_text: [] },
          position: 1,
        },
      ],
    ])
  })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [slashMenu, setSlashMenu] = useState<{
    anchorId: string
    pos: { top: number; left: number }
  } | null>(null)

  useEffect(() => {
    if (initialBlocks.length) {
      setBlocksMap(new Map(initialBlocks.map((b) => [b.id, b])))
    } else {
      const id = generateBlockId()
      setBlocksMap(
        new Map([
          [
            id,
            {
              id,
              parentId: null,
              type: 'paragraph' as BlockType,
              content: { rich_text: [] },
              position: 1,
            },
          ],
        ])
      )
    }
    setEditingId(null)
    setFocusedId(null)
  }, [pageId])

  const emit = useCallback(
    (m: Map<string, Block>) => onChange?.(Array.from(m.values())),
    [onChange]
  )
  const getChildren = useCallback(
    (parentId: string | null) =>
      Array.from(blocksMap.values())
        .filter((b) => b.parentId === parentId)
        .sort((a, b) => a.position - b.position),
    [blocksMap]
  )

  const updateBlock = useCallback(
    (id: string, updates: Partial<Block>) => {
      setBlocksMap((prev) => {
        const b = prev.get(id)
        if (!b) return prev
        const next = new Map(prev)
        next.set(id, { ...b, ...updates })
        emit(next)
        return next
      })
    },
    [emit]
  )

  const deleteBlock = useCallback(
    (id: string) => {
      setBlocksMap((prev) => {
        const next = new Map(prev)
        const rm = (bid: string) => {
          Array.from(next.values())
            .filter((b) => b.parentId === bid)
            .forEach((c) => rm(c.id))
          next.delete(bid)
        }
        rm(id)
        if (!Array.from(next.values()).some((b) => b.parentId === null)) {
          const def: Block = {
            id: generateBlockId(),
            parentId: null,
            type: 'paragraph',
            content: { rich_text: [] },
            position: 1,
          }
          next.set(def.id, def)
          setFocusedId(def.id)
          setEditingId(def.id)
        } else {
          setFocusedId(null)
          setEditingId(null)
        }
        emit(next)
        return next
      })
    },
    [emit]
  )

  const addAfter = useCallback(
    (refId: string, type: BlockType = 'paragraph') => {
      setBlocksMap((prev) => {
        const ref = prev.get(refId)
        if (!ref) return prev
        const sibs = Array.from(prev.values())
          .filter((b) => b.parentId === ref.parentId)
          .sort((a, b) => a.position - b.position)
        const idx = sibs.findIndex((b) => b.id === refId)
        const nb: Block = {
          id: generateBlockId(),
          parentId: ref.parentId,
          type,
          content: defaultBlockContent(type),
          position: positionBetween(sibs[idx]?.position ?? null, sibs[idx + 1]?.position ?? null),
        }
        const next = new Map(prev)
        next.set(nb.id, nb)
        setFocusedId(nb.id)
        setEditingId(nb.id)
        emit(next)
        return next
      })
    },
    [emit]
  )

  const addInside = useCallback(
    (parentId: string, type: BlockType = 'paragraph') => {
      setBlocksMap((prev) => {
        const children = Array.from(prev.values())
          .filter((b) => b.parentId === parentId)
          .sort((a, b) => a.position - b.position)
        const nb: Block = {
          id: generateBlockId(),
          parentId,
          type,
          content: defaultBlockContent(type),
          position: children.length ? children[children.length - 1].position + 1 : 1,
        }
        const next = new Map(prev)
        next.set(nb.id, nb)
        const parent = prev.get(parentId)
        if (parent) {
          if (parent.type === 'toggle')
            next.set(parentId, { ...parent, content: { ...parent.content, toggleOpen: true } })
          else if (parent.collapsed) next.set(parentId, { ...parent, collapsed: false })
        }
        setFocusedId(nb.id)
        setEditingId(nb.id)
        emit(next)
        return next
      })
    },
    [emit]
  )

  const moveBlock = useCallback(
    (dragId: string, targetId: string, zone: 'before' | 'after' | 'inside') => {
      setBlocksMap((prev) => {
        const drag = prev.get(dragId),
          target = prev.get(targetId)
        if (!drag || !target || dragId === targetId) return prev
        const isAnc = (cId: string, aId: string): boolean => {
          const b = prev.get(cId)
          if (!b || b.parentId === null) return false
          return b.parentId === aId || isAnc(b.parentId, aId)
        }
        if (isAnc(targetId, dragId)) return prev
        let newParentId: string | null, newPos: number
        if (zone === 'inside') {
          newParentId = targetId
          const ch = Array.from(prev.values())
            .filter((b) => b.parentId === targetId)
            .sort((a, b) => a.position - b.position)
          newPos = ch.length ? ch[ch.length - 1].position + 1 : 1
        } else {
          newParentId = target.parentId
          const sibs = Array.from(prev.values())
            .filter((b) => b.parentId === target.parentId && b.id !== dragId)
            .sort((a, b) => a.position - b.position)
          const idx = sibs.findIndex((b) => b.id === targetId)
          newPos = positionBetween(
            zone === 'after' ? (sibs[idx]?.position ?? null) : (sibs[idx - 1]?.position ?? null),
            zone === 'before' ? (sibs[idx]?.position ?? null) : (sibs[idx + 1]?.position ?? null)
          )
        }
        const next = new Map(prev)
        next.set(dragId, { ...drag, parentId: newParentId, position: newPos })
        emit(next)
        return next
      })
    },
    [emit]
  )

  const indentBlock = useCallback(
    (id: string) => {
      setBlocksMap((prev) => {
        const block = prev.get(id)
        if (!block) return prev
        const sibs = Array.from(prev.values())
          .filter((b) => b.parentId === block.parentId)
          .sort((a, b) => a.position - b.position)
        const idx = sibs.findIndex((b) => b.id === id)
        if (idx === 0) return prev
        const newParent = sibs[idx - 1]
        const ch = Array.from(prev.values())
          .filter((b) => b.parentId === newParent.id)
          .sort((a, b) => a.position - b.position)
        const next = new Map(prev)
        next.set(id, {
          ...block,
          parentId: newParent.id,
          position: ch.length ? ch[ch.length - 1].position + 1 : 1,
        })
        next.set(newParent.id, {
          ...newParent,
          collapsed: false,
          content:
            newParent.type === 'toggle'
              ? { ...newParent.content, toggleOpen: true }
              : newParent.content,
        })
        emit(next)
        return next
      })
    },
    [emit]
  )

  const outdentBlock = useCallback(
    (id: string) => {
      setBlocksMap((prev) => {
        const block = prev.get(id)
        if (!block || block.parentId === null) return prev
        const parent = prev.get(block.parentId)
        if (!parent) return prev
        const gsibs = Array.from(prev.values())
          .filter((b) => b.parentId === parent.parentId)
          .sort((a, b) => a.position - b.position)
        const pidx = gsibs.findIndex((b) => b.id === parent.id)
        const next = new Map(prev)
        next.set(id, {
          ...block,
          parentId: parent.parentId,
          position: positionBetween(
            gsibs[pidx]?.position ?? null,
            gsibs[pidx + 1]?.position ?? null
          ),
        })
        emit(next)
        return next
      })
    },
    [emit]
  )

  const showSlashMenu = useCallback((anchorId: string, rect: DOMRect) => {
    setSlashMenu({ anchorId, pos: { top: rect.bottom + 4, left: rect.left } })
  }, [])

  const handleSlashSelect = (type: BlockType) => {
    if (!slashMenu) return
    setBlocksMap((prev) => {
      const b = prev.get(slashMenu.anchorId)
      if (!b) return prev
      const next = new Map(prev)
      next.set(slashMenu.anchorId, {
        ...b,
        type,
        content: { ...defaultBlockContent(type), rich_text: b.content.rich_text },
      })
      emit(next)
      return next
    })
    setSlashMenu(null)
    setEditingId(slashMenu.anchorId)
  }

  const handleCreateSubpage = useCallback(
    async (blockId: string): Promise<string> => {
      if (!onCreateSubpage) return ''
      const newPageId = await onCreateSubpage(blockId, pageId)
      setBlocksMap((prev) => {
        const b = prev.get(blockId)
        if (!b) return prev
        const next = new Map(prev)
        next.set(blockId, { ...b, content: { ...b.content, subpageId: newPageId } })
        emit(next)
        return next
      })
      return newPageId
    },
    [onCreateSubpage, pageId, emit]
  )

  // ─── 媒体块：blob → 服务器 URL 原地替换 ────────────────────────────────────
  const addMediaBlock = useCallback(
    (url: string, type: BlockType, id?: string) => {
      setBlocksMap((prev) => {
        const next = new Map(prev)
        if (id && prev.has(id)) {
          const b = prev.get(id)!
          next.set(id, { ...b, content: { ...b.content, rich_text: [{ text: url }] } })
        } else {
          const roots = Array.from(prev.values())
            .filter((b) => b.parentId === null)
            .sort((a, b) => a.position - b.position)
          const last = roots[roots.length - 1]
          const pos = last ? last.position + 1 : 1
          const nb: Block = {
            id: id ?? generateBlockId(),
            parentId: null,
            type,
            content: { ...defaultBlockContent(type), rich_text: [{ text: url }] },
            position: pos,
          }
          next.set(nb.id, nb)
        }
        emit(next)
        return next
      })
    },
    [emit]
  )

  const addMediaBlockRef = useRef(addMediaBlock)
  useEffect(() => {
    addMediaBlockRef.current = addMediaBlock
  }, [addMediaBlock])

  // ─── 文件拖拽：window capture 绕过 react-dnd HTML5Backend 拦截 ───────────
  const containerRef = useRef<HTMLDivElement>(null)
  const [isFileDragging, setIsFileDragging] = useState(false)

  useEffect(() => {
    if (!perm.canAdd) return
    let enterCount = 0

    const isFileEvent = (e: DragEvent) => !!e.dataTransfer?.types.includes('Files')
    const inContainer = (e: DragEvent) => !!containerRef.current?.contains(e.target as Node)

    const onDragEnter = (e: DragEvent) => {
      if (!isFileEvent(e) || !inContainer(e)) return
      enterCount++
      setIsFileDragging(true)
    }
    const onDragLeave = (e: DragEvent) => {
      if (!isFileEvent(e)) return
      enterCount = Math.max(0, enterCount - 1)
      if (enterCount === 0) setIsFileDragging(false)
    }
    const onDragOver = (e: DragEvent) => {
      if (!isFileEvent(e) || !inContainer(e)) return
      e.preventDefault()
      e.stopPropagation()
    }
    const onDrop = async (e: DragEvent) => {
      if (!isFileEvent(e) || !inContainer(e)) return
      e.preventDefault()
      e.stopPropagation()
      enterCount = 0
      setIsFileDragging(false)

      for (const file of Array.from(e.dataTransfer!.files)) {
        const fileType: BlockType = file.type.startsWith('image/')
          ? 'image'
          : file.type.startsWith('video/')
            ? 'video'
            : file.type.startsWith('audio/')
              ? 'audio'
              : 'file'
        const blobUrl = URL.createObjectURL(file)
        const blockId = generateBlockId()
        addMediaBlockRef.current(blobUrl, fileType, blockId)
        try {
          const r = await fetch('/api/media/upload', {
            method: 'POST',
            headers: {
              'Content-Type': file.type || 'application/octet-stream',
              'X-Filename': encodeURIComponent(file.name),
            },
            body: file,
          })
          const d = await r.json()
          addMediaBlockRef.current(d.url, fileType, blockId)
          URL.revokeObjectURL(blobUrl)
        } catch (err) {
          console.error('[drop upload]', err)
        }
      }
    }

    window.addEventListener('dragenter', onDragEnter, { capture: true })
    window.addEventListener('dragleave', onDragLeave, { capture: true })
    window.addEventListener('dragover', onDragOver, { capture: true })
    window.addEventListener('drop', onDrop, { capture: true })
    return () => {
      window.removeEventListener('dragenter', onDragEnter, { capture: true })
      window.removeEventListener('dragleave', onDragLeave, { capture: true })
      window.removeEventListener('dragover', onDragOver, { capture: true })
      window.removeEventListener('drop', onDrop, { capture: true })
    }
  }, [perm.canAdd])

  const rootBlocks = getChildren(null)

  return (
    <div ref={containerRef} className="relative">
      {isFileDragging && (
        <div className="absolute inset-0 z-50 border-2 border-dashed border-blue-400/60 bg-blue-500/10 rounded-lg flex items-center justify-center pointer-events-none">
          <div className="text-blue-400 text-sm font-medium">拖放文件到此处</div>
        </div>
      )}
      <DndProvider backend={HTML5Backend}>
        <div onClick={() => setEditingId(null)}>
          <div onClick={(e) => e.stopPropagation()}>
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
                onNavigate={onNavigate}
                onCreateSubpage={handleCreateSubpage}
                perm={perm}
              />
            ))}
          </div>
          {perm.canAdd && (
            <div
              className="h-32 cursor-text"
              onClick={(e) => {
                e.stopPropagation()
                const r = rootBlocks
                if (r.length) addAfter(r[r.length - 1].id)
              }}
            />
          )}
          {slashMenu && (
            <SlashMenu
              position={slashMenu.pos}
              onSelect={handleSlashSelect}
              onClose={() => setSlashMenu(null)}
            />
          )}
        </div>
      </DndProvider>
    </div>
  )
}
