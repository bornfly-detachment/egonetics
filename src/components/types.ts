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
  | 'heading1' | 'heading2' | 'heading3' | 'heading4'
  | 'bullet' | 'numbered' | 'todo' | 'toggle'
  | 'quote' | 'callout_info' | 'callout_warning' | 'callout_success' | 'callout_tip'
  | 'code' | 'math' | 'equation_block'
  | 'image' | 'video' | 'file' | 'bookmark'
  | 'divider' | 'table' | 'columns2' | 'columns3' | 'toc'
  | 'subpage'   // ← 子页面块，块内嵌入一个子页面的入口

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
  parentId: string | null       // 父块 id，null 表示顶层
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
    // subpage 块专用
    subpageId?: string          // 指向的子页面 id
    subpageTitle?: string       // 冗余存一份标题，避免跨页查询
    subpageIcon?: string
  }
  position: number
  metadata?: Record<string, any>
  collapsed?: boolean
}

// 页面类型
export type PageType = 'page' | 'task' | 'chronicle' | 'theory'

// 页面元信息（不含块内容）
export interface PageMeta {
  id: string
  parentId: string | null       // 父页面 id，null 表示根页面
  pageType: PageType            // 页面类型
  refId: string | null          // 关联ID（如 task_id）
  title: string
  icon: string                  // emoji，如 "📄"
  position: number              // 同级排序浮点数
  createdAt: string             // ISO 8601
  updatedAt: string
}

// 页面完整对象（含块列表）
export interface Page extends PageMeta {
  blocks: Block[]
}

// ── 请求体类型 ────────────────────────────────────────────────

export interface CreatePageInput {
  parentId: string | null
  pageType?: PageType         // 页面类型，默认 'page'
  refId?: string | null       // 关联ID
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
