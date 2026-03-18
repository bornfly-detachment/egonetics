// ============================================================
//  types.ts  —  共享类型定义 & 后端 API 接口规范
// ============================================================
//
//  后端需要实现以下 REST 接口（所有请求/响应均为 JSON）：
//
//  ── 页面树 ──────────────────────────────────────────────────
//  GET    /api/pages                → Page[]           获取所有页面（树形结构铺平）
//  POST   /api/pages                → Page             创建页面  body: CreatePageInput
//  PATCH  /api/pages/:id            → Page             更新页面元信息  body: Partial<PageMeta>
//  DELETE /api/pages/:id            → { ok: true }     删除页面（级联删除子页面）
//  POST   /api/pages/:id/move       → Page             移动页面  body: MovePageInput
//
//  ── 块内容 ──────────────────────────────────────────────────
//  GET    /api/pages/:id/blocks     → Block[]          获取页面的所有块
//  PUT    /api/pages/:id/blocks     → Block[]          全量覆盖保存块列表
//  PATCH  /api/pages/:id/blocks/:blockId → Block       更新单个块
//
//  ── 数据模型 ────────────────────────────────────────────────

export type BlockType =
  | 'paragraph'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'heading4'
  | 'bullet'
  | 'numbered'
  | 'todo'
  | 'toggle'
  | 'quote'
  | 'callout_info'
  | 'callout_warning'
  | 'callout_success'
  | 'callout_tip'
  | 'code'
  | 'math'
  | 'equation_block'
  | 'image'
  | 'video'
  | 'audio'
  | 'file'
  | 'bookmark'
  | 'divider'
  | 'table'
  | 'columns2'
  | 'columns3'
  | 'toc'
  | 'subpage' // ← 子页面块，块内嵌入一个子页面的入口

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

// ── 级联标签系统 ─────────────────────────────────────────────────

// 标签节点（支持无限层级）
export interface BlockTagNode {
  id: string
  name: string
  color?: string
  children?: BlockTagNode[]
}

// 块上的标签引用（存储在 metadata.tags 中）
export interface BlockTagRef {
  tagId: string // 引用的标签节点 ID
  path: string[] // 完整路径，如 ['角色', '前端']
  name: string // 冗余存储标签名
  color?: string // 冗余存储颜色
}

// 预设的级联标签树
export const DEFAULT_TAG_TREE: BlockTagNode[] = [
  {
    id: 'tag-role',
    name: '角色',
    color: '#8b5cf6',
    children: [
      { id: 'tag-role-frontend', name: '前端', color: '#3b82f6' },
      { id: 'tag-role-backend', name: '后端', color: '#10b981' },
      { id: 'tag-role-product', name: '产品', color: '#f59e0b' },
      { id: 'tag-role-ops', name: '运维', color: '#6b7280' },
      { id: 'tag-role-content', name: '内容创造', color: '#ec4899' },
      { id: 'tag-role-subject', name: '主体性', color: '#14b8a6' },
    ],
  },
  {
    id: 'tag-tech',
    name: '技术栈',
    color: '#06b6d4',
    children: [
      { id: 'tag-tech-react', name: 'React', color: '#61dafb' },
      { id: 'tag-tech-typescript', name: 'TypeScript', color: '#3178c6' },
      { id: 'tag-tech-nodejs', name: 'Node.js', color: '#339933' },
      { id: 'tag-tech-python', name: 'Python', color: '#3776ab' },
      { id: 'tag-tech-sqlite', name: 'SQLite', color: '#003b57' },
    ],
  },
  {
    id: 'tag-status',
    name: '状态',
    color: '#f97316',
    children: [
      { id: 'tag-status-todo', name: '待办', color: '#ef4444' },
      { id: 'tag-status-doing', name: '进行中', color: '#eab308' },
      { id: 'tag-status-done', name: '已完成', color: '#22c55e' },
      { id: 'tag-status-blocked', name: '阻塞', color: '#a855f7' },
    ],
  },
  {
    id: 'tag-priority',
    name: '优先级',
    color: '#dc2626',
    children: [
      { id: 'tag-priority-high', name: '高', color: '#dc2626' },
      { id: 'tag-priority-medium', name: '中', color: '#ea580c' },
      { id: 'tag-priority-low', name: '低', color: '#16a34a' },
    ],
  },
]

export interface Block {
  id: string
  parentId: string | null // 父块 id，null 表示顶层
  type: BlockType
  content: {
    rich_text: RichTextSegment[]
    language?: string
    viewMode?: 'edit' | 'preview'
    tableRows?: TableCell[][]
    tableColCount?: number
    tableHasHeader?: boolean
    calloutIcon?: string
    numberStart?: number
    toggleOpen?: boolean
    fileName?: string
    imageWidth?: number // 图片宽度百分比 1-100，undefined = 100%
    // subpage 块专用
    subpageId?: string
    subpageTitle?: string
    subpageIcon?: string
    // 可扩展字段
    extensions?: Record<string, unknown>
  }
  position: number
  metadata?: {
    tags?: BlockTagRef[]
    [key: string]: unknown
  }
  collapsed?: boolean

  // ── 可视化元信息（v2）──────────────────────────────────────
  title?: string              // block 级标题，独立于 content（可视化用）
  creator?: string            // 'human:username' | 'ai:model-name'
  editStartTime?: string      // 上次发布后首次编辑的时间（ISO）
  draftExplanation?: string   // 未发布的草稿说明（持久化到 DB）
  createdAt?: string          // ISO
  updatedAt?: string          // ISO
}

// ── 过程版本记录 ──────────────────────────────────────────────

export interface ProcessVersion {
  id: string
  entity_id: string
  entity_type: 'block' | 'relation'
  version_num: number
  start_time: string | null   // 编辑开始时间
  publish_time: string         // 发布时间
  publisher: string            // 'human:bornfly' | 'ai:claude-sonnet-4-6'
  title_snapshot: string
  content_snapshot: Block['content'] | Record<string, unknown>
  explanation: string
  created_at: string
}

// ── 关系边（跨实体类型）──────────────────────────────────────

// 实体类型（开放，可扩展）
export type EntityType =
  | 'block'
  | 'memory'
  | 'task'
  | 'theory'
  | 'label'
  | 'label_system'
  | string

export interface Relation {
  id: string
  title: string
  relation_type: string  // e.g. 'contains' | 'causal' | ...
  source_type: EntityType
  source_id: string
  target_type: EntityType
  target_id: string
  description: string   // 开放描述，不写死枚举
  creator: string
  created_at: string
  updated_at: string
}

// 块级权限（文档级或块级覆盖均使用此类型）
export interface BlockPermissions {
  canEdit: boolean     // 可编辑文本内容
  canDelete: boolean   // 可删除块
  canAdd: boolean      // 可新增块
  canReorder: boolean  // 可拖拽排序
}

// 页面类型
export type PageType = 'page' | 'task' | 'chronicle' | 'theory'

// 页面元信息（不含块内容）
export interface PageMeta {
  id: string
  parentId: string | null // 父页面 id，null 表示根页面
  pageType: PageType // 页面类型
  refId: string | null // 关联ID（如 task_id）
  title: string
  icon: string // emoji，如 "📄"
  position: number // 同级排序浮点数
  createdAt: string // ISO 8601
  updatedAt: string
}

// 页面完整对象（含块列表）
export interface Page extends PageMeta {
  blocks: Block[]
}

// ── 请求体类型 ────────────────────────────────────────────────

export interface CreatePageInput {
  parentId: string | null
  pageType?: PageType // 页面类型，默认 'page'
  refId?: string | null // 关联ID
  title?: string
  icon?: string
  position?: number
  // 若从 subpage 块创建，传入 subpageId 让后端做关联
  fromBlockId?: string
}

export interface MovePageInput {
  newParentId: string | null
  newPosition: number
}

// ── API 客户端接口（前端实现此接口对接任意后端）────────────────

export interface ApiClient {
  // 页面
  listPages(): Promise<PageMeta[]>
  createPage(input: CreatePageInput): Promise<PageMeta>
  updatePage(id: string, patch: Partial<Pick<PageMeta, 'title' | 'icon'>>): Promise<PageMeta>
  deletePage(id: string): Promise<void>
  movePage(id: string, input: MovePageInput): Promise<PageMeta>

  // 块
  listBlocks(pageId: string): Promise<Block[]>
  saveBlocks(pageId: string, blocks: Block[]): Promise<Block[]>
}
