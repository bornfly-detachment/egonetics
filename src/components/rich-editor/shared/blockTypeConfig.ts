// 块类型配置 — 单一数据源
// ParagraphEditor 的 /shortcut 直接触发 + SlashMenu 菜单项 都从这里取数据
import {
  Type, Heading1, Heading2, Heading3, Hash,
  Quote, List, ListOrdered, CheckSquare, ToggleLeft,
  Info, AlertTriangle, AlertCircle, Lightbulb,
  Code, BookOpen, Star,
  Image, Film, FileText, Link,
  Table, Columns, Minus, ArrowRight, FileEdit,
  type LucideIcon,
} from 'lucide-react'
import type { BlockType } from '../types'

export interface BlockTypeItem {
  type: BlockType
  label: string
  icon: LucideIcon
  shortcut: string
  desc: string
}

export interface BlockTypeGroup {
  group: string
  items: BlockTypeItem[]
}

export const BLOCK_TYPE_GROUPS: BlockTypeGroup[] = [
  {
    group: '基础文本',
    items: [
      { type: 'paragraph',  label: '段落',   icon: Type,     shortcut: 'text',  desc: '普通段落文本' },
      { type: 'heading1',   label: '标题 1', icon: Heading1, shortcut: 'h1',    desc: '大标题' },
      { type: 'heading2',   label: '标题 2', icon: Heading2, shortcut: 'h2',    desc: '中标题' },
      { type: 'heading3',   label: '标题 3', icon: Heading3, shortcut: 'h3',    desc: '小标题' },
      { type: 'heading4',   label: '标题 4', icon: Hash,     shortcut: 'h4',    desc: '最小标题' },
      { type: 'quote',      label: '引用',   icon: Quote,    shortcut: 'quote', desc: '引用段落' },
    ],
  },
  {
    group: '列表',
    items: [
      { type: 'bullet',   label: '无序列表', icon: List,        shortcut: 'ul',   desc: '• 项目列表' },
      { type: 'numbered', label: '有序列表', icon: ListOrdered, shortcut: 'ol',   desc: '1. 2. 3.' },
      { type: 'todo',     label: '待办事项', icon: CheckSquare, shortcut: 'todo', desc: '可勾选列表' },
      { type: 'toggle',   label: '折叠列表', icon: ToggleLeft,  shortcut: 'tog',  desc: '可折叠块' },
    ],
  },
  {
    group: '标注',
    items: [
      { type: 'callout_info',    label: '信息', icon: Info,          shortcut: 'info', desc: '🔵 信息提示' },
      { type: 'callout_warning', label: '警告', icon: AlertTriangle, shortcut: 'warn', desc: '🟡 警告提示' },
      { type: 'callout_success', label: '成功', icon: AlertCircle,   shortcut: 'ok',   desc: '🟢 成功提示' },
      { type: 'callout_tip',     label: '技巧', icon: Lightbulb,     shortcut: 'tip',  desc: '💡 小技巧' },
    ],
  },
  {
    group: '代码 & 公式',
    items: [
      { type: 'code',           label: '代码块',   icon: Code,     shortcut: 'code', desc: '多语言代码' },
      { type: 'math',           label: '行内公式', icon: BookOpen, shortcut: 'math', desc: 'LaTeX 行内' },
      { type: 'equation_block', label: '公式块',   icon: Star,     shortcut: 'eq',   desc: 'LaTeX 独立块' },
    ],
  },
  {
    group: '媒体',
    items: [
      { type: 'image',    label: '图片', icon: Image,    shortcut: 'img',   desc: '图片（URL 或本地文件）' },
      { type: 'video',    label: '视频', icon: Film,     shortcut: 'vid',   desc: '视频（URL 或本地文件）' },
      { type: 'audio',    label: '音频', icon: BookOpen, shortcut: 'audio', desc: '音频（URL 或本地文件）' },
      { type: 'file',     label: '文件', icon: FileText, shortcut: 'file',  desc: '附件（PDF/ZIP/文档等）' },
      { type: 'bookmark', label: '书签', icon: Link,     shortcut: 'bm',    desc: '网页书签' },
    ],
  },
  {
    group: '结构',
    items: [
      { type: 'table',    label: '表格',  icon: Table,    shortcut: 'table', desc: '结构化表格' },
      { type: 'columns2', label: '两列',  icon: Columns,  shortcut: 'col2',  desc: '两栏布局' },
      { type: 'columns3', label: '三列',  icon: Columns,  shortcut: 'col3',  desc: '三栏布局' },
      { type: 'divider',  label: '分隔线',icon: Minus,    shortcut: 'hr',    desc: '水平线' },
      { type: 'toc',      label: '目录',  icon: ArrowRight, shortcut: 'toc', desc: '自动目录' },
    ],
  },
  {
    group: '页面',
    items: [
      { type: 'subpage', label: '子页面', icon: FileEdit, shortcut: 'page', desc: '嵌入一个子页面入口' },
    ],
  },
]

// 扁平化，供 /shortcut 查找用
export const ALL_BLOCK_TYPES: BlockTypeItem[] = BLOCK_TYPE_GROUPS.flatMap((g) => g.items)

// shortcut → BlockType 快查表
export const SHORTCUT_MAP: Record<string, BlockType> = Object.fromEntries(
  ALL_BLOCK_TYPES.map((item) => [item.shortcut, item.type])
)
