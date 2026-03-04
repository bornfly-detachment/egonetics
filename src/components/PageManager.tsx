// ============================================================
//  PageManager.tsx  —  页面管理层
//
//  职责：
//    1. 维护页面树状态（内存 + 通过 ApiClient 同步后端）
//    2. 当前激活页面（activePageId）& 面包屑路径
//    3. 侧边栏：树状导航、新建/删除/重命名、拖拽排序 & 拖入子目录
//    4. 主区域：渲染 BlockEditor，向其注入导航 & 创建子页面回调
//
//  使用方式：
//    import PageManager from './PageManager'
//    import { createApiClient } from './apiClient'   // 你自己实现
//
//    <PageManager api={createApiClient()} />
// ============================================================
import React, {
  useState, useEffect, useCallback, useRef,
} from 'react'
import {
  ChevronRight, ChevronDown, Plus, Trash2, GripVertical,
  FileEdit, MoreHorizontal, Check, Loader2,
} from 'lucide-react'
import { useDrag, useDrop, DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import BlockEditor, { positionBetween } from './BlockEditor'
import type { Block, PageMeta, ApiClient } from './types'

// ─── Mock API（开发期间使用，对接真实后端时删除） ───────────────────────────────

let _mockPages: PageMeta[] = [
  { id: 'root', parentId: null, title: '我的工作区', icon: '🏠', position: 1, pageType: 'page', refId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'p1',   parentId: 'root', title: '产品文档',  icon: '📦', position: 1, pageType: 'page', refId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'p2',   parentId: 'root', title: '设计稿',    icon: '🎨', position: 2, pageType: 'page', refId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'p1-1', parentId: 'p1',   title: '需求文档',  icon: '📋', position: 1, pageType: 'page', refId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'p1-2', parentId: 'p1',   title: 'API 接口',  icon: '🔌', position: 2, pageType: 'page', refId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
]

const _mockBlocks: Record<string, Block[]> = {
  root: [{ id: 'b1', parentId: null, type: 'paragraph', content: { rich_text: [{ text: '欢迎使用！从侧边栏选择或新建页面。在块中输入 / 可以插入子页面块。' }] }, position: 1 }],
  p1:   [{ id: 'b2', parentId: null, type: 'heading1',  content: { rich_text: [{ text: '产品文档' }] }, position: 1 },
         { id: 'b3', parentId: null, type: 'paragraph', content: { rich_text: [{ text: '在这里写你的产品文档内容。' }] }, position: 2 }],
}

export function createMockApiClient(): ApiClient {
  const delay = (ms = 200) => new Promise(r => setTimeout(r, ms))
  return {
    async listPages() { await delay(); return [..._mockPages] },
    async createPage(input) {
      await delay()
      const p: PageMeta = { id: `page-${Date.now()}`, parentId: input.parentId, title: input.title ?? '新页面',
        icon: input.icon ?? '📄', position: input.position ?? 1, pageType: input.pageType ?? 'page', refId: input.refId ?? null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      _mockPages.push(p); return p
    },
    async updatePage(id, patch) {
      await delay()
      const p = _mockPages.find(p => p.id === id); if (!p) throw new Error('Not found')
      Object.assign(p, patch, { updatedAt: new Date().toISOString() }); return { ...p }
    },
    async deletePage(id) {
      await delay()
      const rm = (pid: string) => { _mockPages = _mockPages.filter(p => p.id !== pid); _mockPages.filter(p => p.parentId === pid).forEach(c => rm(c.id)) }
      rm(id)
    },
    async movePage(id, input) {
      await delay()
      const p = _mockPages.find(p => p.id === id); if (!p) throw new Error('Not found')
      Object.assign(p, { parentId: input.newParentId, position: input.newPosition, updatedAt: new Date().toISOString() }); return { ...p }
    },
    async listBlocks(pageId) { await delay(100); return _mockBlocks[pageId] ?? [] },
    async saveBlocks(pageId, blocks) { await delay(100); _mockBlocks[pageId] = blocks; return blocks },
  }
}

// ─── 页面树工具 ────────────────────────────────────────────────────────────────

function getPageChildren(pages: PageMeta[], parentId: string | null) {
  return pages.filter(p => p.parentId === parentId).sort((a, b) => a.position - b.position)
}

function getAncestorIds(pages: PageMeta[], pageId: string): string[] {
  const page = pages.find(p => p.id === pageId)
  if (!page || page.parentId === null) return []
  return [...getAncestorIds(pages, page.parentId), page.parentId]
}

// ─── 侧边栏节点 ────────────────────────────────────────────────────────────────

const PAGE_DRAG_TYPE = 'PAGE_NODE'

interface SidebarNodeProps {
  page: PageMeta
  allPages: PageMeta[]
  activePageId: string
  expandedIds: Set<string>
  onToggleExpand: (id: string) => void
  onActivate: (id: string) => void
  onRename: (id: string, title: string) => Promise<void>
  onDelete: (id: string) => void
  onAddChild: (parentId: string) => void
  onMovePage: (dragId: string, targetId: string, zone: 'before' | 'after' | 'inside') => void
  level: number
  archivedPages?: Record<string, { version_tag: string; entry_id: string }>
}

function SidebarNode({
  page, allPages, activePageId, expandedIds,
  onToggleExpand, onActivate, onRename, onDelete, onAddChild, onMovePage, level, archivedPages,
}: SidebarNodeProps) {
  const isArchived = archivedPages ? !!archivedPages[page.id] : false
  const children = getPageChildren(allPages, page.id)
  const hasChildren = children.length > 0
  const isExpanded = expandedIds.has(page.id)
  const isActive = activePageId === page.id
  const [editingTitle, setEditingTitle] = useState(false)
  const [draftTitle, setDraftTitle] = useState(page.title)
  const [showMenu, setShowMenu] = useState(false)
  const [dropZone, setDropZone] = useState<'before' | 'after' | 'inside' | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => { if (editingTitle) setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select() }, 0) }, [editingTitle])
  useEffect(() => {
    if (!showMenu) return
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [showMenu])

  const [{ isDragging }, drag] = useDrag({ type: PAGE_DRAG_TYPE, item: { id: page.id }, collect: m => ({ isDragging: m.isDragging() }) })
  const [, drop] = useDrop<{ id: string }, void, {}>({
    accept: PAGE_DRAG_TYPE,
    hover(item, monitor) {
      if (!ref.current || item.id === page.id) return
      // 防止拖入自己的子孙
      const isDesc = (cId: string, aId: string): boolean => {
        const p = allPages.find(x => x.id === cId)
        if (!p || p.parentId === null) return false
        return p.parentId === aId || isDesc(p.parentId, aId)
      }
      if (isDesc(page.id, item.id)) return
      const rect = ref.current.getBoundingClientRect()
      const ratio = (monitor.getClientOffset()!.y - rect.top) / rect.height
      setDropZone(ratio < 0.25 ? 'before' : ratio > 0.75 ? 'inside' : 'after')
    },
    drop(item, monitor) {
      if (monitor.didDrop() || !dropZone || item.id === page.id) return
      onMovePage(item.id, page.id, dropZone); setDropZone(null)
    },
    collect: () => ({})
  })
  drag(drop(ref))

  const commitRename = async () => {
    if (draftTitle.trim() && draftTitle !== page.title) await onRename(page.id, draftTitle.trim())
    else setDraftTitle(page.title)
    setEditingTitle(false)
  }

  const dropCls = dropZone === 'before' ? 'border-t border-blue-400' : dropZone === 'after' ? 'border-b border-blue-400' : dropZone === 'inside' ? 'ring-1 ring-blue-400/50' : ''

  return (
    <div className={`${isDragging ? 'opacity-30' : ''}`} onMouseLeave={() => setDropZone(null)}>
      <div
        ref={ref}
        className={`group flex items-center gap-1 px-2 py-[5px] rounded-md cursor-pointer select-none transition-colors relative
          ${isActive ? 'bg-white/10 text-white' : 'text-neutral-400 hover:bg-white/5 hover:text-neutral-200'}
          ${dropCls}`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => onActivate(page.id)}
      >
        {/* 折叠箭头 */}
        <button
          onClick={e => { e.stopPropagation(); if (hasChildren) onToggleExpand(page.id) }}
          className={`w-4 h-4 flex items-center justify-center shrink-0 rounded hover:bg-white/10 transition-colors ${!hasChildren ? 'opacity-0 pointer-events-none' : ''}`}
        >
          {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        </button>

        {/* 图标 */}
        <span className="text-sm shrink-0">{page.icon}</span>

        {/* 标题 */}
        {editingTitle ? (
          <input
            ref={inputRef}
            value={draftTitle}
            onChange={e => setDraftTitle(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { setDraftTitle(page.title); setEditingTitle(false) } }}
            onClick={e => e.stopPropagation()}
            className="flex-1 min-w-0 bg-neutral-700 rounded px-1 text-sm text-white outline-none border border-blue-500/50"
          />
        ) : (
          <span className="flex-1 min-w-0 text-sm truncate">
            {isArchived && <span className="mr-1 text-[10px] opacity-50">🔒</span>}
            {page.title || '无标题'}
          </span>
        )}

        {/* 操作按钮 */}
        <div className="shrink-0 opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
          <button onClick={e => { e.stopPropagation(); onAddChild(page.id) }}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/15 text-neutral-500 hover:text-neutral-200" title="添加子页面">
            <Plus size={10} />
          </button>
          <div className="relative">
            <button onClick={e => { e.stopPropagation(); setShowMenu(v => !v) }}
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/15 text-neutral-500 hover:text-neutral-200">
              <MoreHorizontal size={10} />
            </button>
            {showMenu && (
              <div ref={menuRef} className="absolute left-0 top-6 z-50 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl w-36 py-1 text-sm">
                <button onClick={e => { e.stopPropagation(); setEditingTitle(true); setShowMenu(false) }}
                  className="w-full px-3 py-1.5 text-left text-neutral-300 hover:bg-white/10 flex items-center gap-2">
                  <FileEdit size={12} /> 重命名
                </button>
                <div className="my-1 border-t border-neutral-700" />
                <button onClick={e => { e.stopPropagation(); onDelete(page.id); setShowMenu(false) }}
                  className="w-full px-3 py-1.5 text-left text-red-400 hover:bg-red-500/10 flex items-center gap-2">
                  <Trash2 size={12} /> 删除页面
                </button>
              </div>
            )}
          </div>
          <div className="cursor-grab active:cursor-grabbing" onMouseDown={e => e.stopPropagation()}>
            <GripVertical size={10} className="text-neutral-600 hover:text-neutral-400" />
          </div>
        </div>
      </div>

      {/* 子节点 */}
      {isExpanded && children.map(child => (
        <SidebarNode key={child.id} page={child} allPages={allPages} activePageId={activePageId}
          expandedIds={expandedIds} onToggleExpand={onToggleExpand} onActivate={onActivate}
          onRename={onRename} onDelete={onDelete} onAddChild={onAddChild} onMovePage={onMovePage}
          level={level + 1} archivedPages={archivedPages} />
      ))}
    </div>
  )
}

// ─── 面包屑 ────────────────────────────────────────────────────────────────────

function Breadcrumb({ pages, activePageId, onActivate }: {
  pages: PageMeta[], activePageId: string, onActivate: (id: string) => void
}) {
  const ancestorIds = getAncestorIds(pages, activePageId)
  const path = [...ancestorIds, activePageId].map(id => pages.find(p => p.id === id)).filter(Boolean) as PageMeta[]

  if (path.length <= 1) return (
    <div className="flex items-center gap-1.5 text-sm text-neutral-400">
      <span className="text-base">{path[0]?.icon ?? '📄'}</span>
      <span className="text-neutral-300 font-medium">{path[0]?.title || '无标题'}</span>
    </div>
  )

  return (
    <div className="flex items-center gap-1 text-sm">
      {path.map((p, i) => {
        const isLast = i === path.length - 1
        return (
          <React.Fragment key={p.id}>
            <button
              onClick={() => !isLast && onActivate(p.id)}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${
                isLast ? 'text-neutral-200 font-medium cursor-default' : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/5 cursor-pointer'
              }`}
            >
              <span>{p.icon}</span>
              <span>{p.title || '无标题'}</span>
            </button>
            {!isLast && <ChevronRight size={12} className="text-neutral-700 shrink-0" />}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ─── 主页面管理组件 ────────────────────────────────────────────────────────────

interface PageManagerProps {
  api?: ApiClient   // 不传则使用 Mock
  defaultPageId?: string
  archivedPages?: Record<string, { version_tag: string; entry_id: string }>
  onArchivePage?: (page: PageMeta, blocks: Block[]) => void
}

export default function PageManager({ api: apiProp, defaultPageId, archivedPages, onArchivePage }: PageManagerProps) {
  const api = apiProp ?? createMockApiClient()

  const [pages, setPages] = useState<PageMeta[]>([])
  const [activePageId, setActivePageId] = useState<string>('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [pageBlocks, setPageBlocks] = useState<Record<string, Block[]>>({})
  const [loading, setLoading] = useState(true)
  const [blockLoading, setBlockLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(240)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>()

  // ── 初始化 ──
  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        const ps = await api.listPages()
        setPages(ps)
        const first = defaultPageId ?? ps.find(p => p.parentId === null)?.id ?? ps[0]?.id ?? ''
        if (first) {
          setActivePageId(first)
          // 展开祖先
          const ancestors = getAncestorIds(ps, first)
          setExpandedIds(new Set([...ancestors, first]))
          await loadBlocks(first, ps)
        }
      } finally { setLoading(false) }
    })()
  }, [])

  const loadBlocks = async (pageId: string, _ps = pages) => {
    if (pageBlocks[pageId]) return
    setBlockLoading(true)
    try {
      const blocks = await api.listBlocks(pageId)
      setPageBlocks(prev => ({ ...prev, [pageId]: blocks }))
    } finally { setBlockLoading(false) }
  }

  // ── 激活页面 ──
  const activatePage = useCallback(async (pageId: string) => {
    setActivePageId(pageId)
    // 展开祖先路径
    setExpandedIds(prev => {
      const ancestors = getAncestorIds(pages, pageId)
      const next = new Set(prev)
      ancestors.forEach(id => next.add(id))
      return next
    })
    await loadBlocks(pageId)
  }, [pages, pageBlocks])

  // ── 折叠侧边栏节点 ──
  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }, [])

  // ── 创建页面 ──
  const createPage = useCallback(async (parentId: string | null) => {
    const siblings = getPageChildren(pages, parentId)
    const lastPos = siblings.length ? siblings[siblings.length - 1].position : 0
    const p = await api.createPage({ parentId, title: '新页面', icon: '📄', position: lastPos + 1 })
    setPages(prev => [...prev, p])
    // 展开父节点
    if (parentId) setExpandedIds(prev => { const next = new Set(prev); next.add(parentId); return next })
    await activatePage(p.id)
    // 初始化空块
    setPageBlocks(prev => ({ ...prev, [p.id]: [] }))
    return p.id
  }, [pages, api, activatePage])

  // ── 删除页面 ──
  const deletePage = useCallback(async (id: string) => {
    if (!window.confirm('删除此页面及所有子页面？')) return
    await api.deletePage(id)
    setPages(prev => {
      const rm = (pid: string, list: PageMeta[]): PageMeta[] => {
        const children = list.filter(p => p.parentId === pid)
        return list.filter(p => p.id !== pid && !children.some(c => c.id === p.id)).concat(
          children.reduce((acc, c) => acc.filter(p => !rm(c.id, acc).includes(p)), [] as PageMeta[])
        )
      }
      // 简单递归删除
      const allIds = new Set<string>()
      const collectIds = (pid: string) => {
        allIds.add(pid)
        prev.filter(p => p.parentId === pid).forEach(c => collectIds(c.id))
      }
      collectIds(id)
      return prev.filter(p => !allIds.has(p.id))
    })
    if (activePageId === id || getAncestorIds(pages, activePageId).includes(id)) {
      const remaining = pages.filter(p => p.id !== id)
      const fallback = remaining.find(p => p.parentId === null)?.id ?? remaining[0]?.id ?? ''
      if (fallback) await activatePage(fallback)
    }
  }, [api, pages, activePageId, activatePage])

  // ── 重命名页面 ──
  const renamePage = useCallback(async (id: string, title: string) => {
    const updated = await api.updatePage(id, { title })
    setPages(prev => prev.map(p => p.id === id ? updated : p))
    // 如果有 subpage 块引用了这个页面，同步更新块的 subpageTitle
    setPageBlocks(prev => {
      const next = { ...prev }
      Object.keys(next).forEach(pid => {
        next[pid] = next[pid].map(b =>
          b.type === 'subpage' && b.content.subpageId === id
            ? { ...b, content: { ...b.content, subpageTitle: title } }
            : b
        )
      })
      return next
    })
  }, [api])

  // ── 移动页面（侧边栏拖拽） ──
  const movePage = useCallback(async (dragId: string, targetId: string, zone: 'before' | 'after' | 'inside') => {
    const target = pages.find(p => p.id === targetId)
    if (!target) return
    let newParentId: string | null
    let newPosition: number

    if (zone === 'inside') {
      newParentId = targetId
      const children = getPageChildren(pages, targetId)
      newPosition = children.length ? children[children.length - 1].position + 1 : 1
    } else {
      newParentId = target.parentId
      const siblings = getPageChildren(pages, target.parentId).filter(p => p.id !== dragId)
      const idx = siblings.findIndex(p => p.id === targetId)
      newPosition = positionBetween(
        zone === 'after' ? siblings[idx]?.position ?? null : siblings[idx-1]?.position ?? null,
        zone === 'before' ? siblings[idx]?.position ?? null : siblings[idx+1]?.position ?? null,
      )
    }

    const updated = await api.movePage(dragId, { newParentId, newPosition })
    setPages(prev => prev.map(p => p.id === dragId ? updated : p))
    if (zone === 'inside') setExpandedIds(prev => { const next = new Set(prev); next.add(targetId); return next })
  }, [pages, api])

  // ── 自动保存块 ──
  const handleBlocksChange = useCallback((blocks: Block[]) => {
    const pid = activePageId
    setPageBlocks(prev => ({ ...prev, [pid]: blocks }))
    clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(async () => {
      setSaving(true)
      try { await api.saveBlocks(pid, blocks) } finally { setSaving(false) }
    }, 800)
  }, [activePageId, api])

  // ── 创建子页面块 ──
  const handleCreateSubpage = useCallback(async (blockId: string, parentPageId: string): Promise<string> => {
    const newPageId = await createPage(parentPageId)
    // 同步更新父页面块里的 subpageId
    setPageBlocks(prev => {
      const blocks = prev[parentPageId] ?? []
      return {
        ...prev,
        [parentPageId]: blocks.map(b =>
          b.id === blockId
            ? { ...b, content: { ...b.content, subpageId: newPageId, subpageTitle: '新页面', subpageIcon: '📄' } }
            : b
        )
      }
    })
    return newPageId
  }, [createPage])

  // ── 侧边栏拖拽调整宽度 ──
  const handleSidebarResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = sidebarWidth
    const onMove = (e: MouseEvent) => setSidebarWidth(Math.max(160, Math.min(400, startWidth + e.clientX - startX)))
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [sidebarWidth])

  const activePage = pages.find(p => p.id === activePageId)
  const rootPages = getPageChildren(pages, null)
  const currentBlocks = pageBlocks[activePageId] ?? []

  if (loading) return (
    <div className="h-full bg-[#191919] flex items-center justify-center">
      <div className="flex items-center gap-3 text-neutral-500">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">加载中…</span>
      </div>
    </div>
  )

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="h-full bg-[#191919] flex text-neutral-200 overflow-hidden"
        style={{ fontFamily: "'PingFang SC','Noto Serif SC','Microsoft YaHei',serif" }}>

        {/* ── 侧边栏 ── */}
        {!sidebarCollapsed && (
          <div className="flex shrink-0 relative" style={{ width: sidebarWidth }}>
            <div className="flex-1 flex flex-col bg-[#161616] border-r border-white/5 overflow-hidden">
              {/* 侧边栏顶部 */}
              <div className="px-3 pt-4 pb-2 flex items-center justify-between shrink-0">
                <span className="text-xs font-semibold text-neutral-600 uppercase tracking-widest">页面</span>
                <button onClick={() => createPage(null)}
                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 text-neutral-600 hover:text-neutral-300 transition-colors" title="新建根页面">
                  <Plus size={13} />
                </button>
              </div>

              {/* 页面树 */}
              <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
                {rootPages.length === 0 ? (
                  <div className="text-xs text-neutral-700 px-3 py-6 text-center">
                    点击 + 新建第一个页面
                  </div>
                ) : (
                  rootPages.map(page => (
                    <SidebarNode key={page.id} page={page} allPages={pages}
                      activePageId={activePageId} expandedIds={expandedIds}
                      onToggleExpand={toggleExpand} onActivate={activatePage}
                      onRename={renamePage} onDelete={deletePage}
                      onAddChild={createPage} onMovePage={movePage}
                      level={0} archivedPages={archivedPages} />
                  ))
                )}
              </div>
            </div>

            {/* 拖拽调整宽度手柄 */}
            <div
              onMouseDown={handleSidebarResize}
              className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500/30 transition-colors"
            />
          </div>
        )}

        {/* ── 主区域 ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* 顶部导航栏 */}
          <div className="shrink-0 h-11 bg-[#191919]/90 backdrop-blur-sm border-b border-white/5 flex items-center px-4 gap-3">
            {/* 折叠侧边栏按钮 */}
            <button onClick={() => setSidebarCollapsed(v => !v)}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/8 text-neutral-600 hover:text-neutral-400 transition-colors shrink-0">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <rect x="2" y="2" width="5" height="12" rx="1" opacity="0.4" />
                <rect x="9" y="2" width="5" height="12" rx="1" />
              </svg>
            </button>

            {/* 面包屑 */}
            <div className="flex-1 min-w-0">
              {activePage && <Breadcrumb pages={pages} activePageId={activePageId} onActivate={activatePage} />}
            </div>

            {/* 保存状态 */}
            <div className="shrink-0 text-[11px] text-neutral-700 flex items-center gap-1.5">
              {saving ? (
                <><Loader2 size={10} className="animate-spin" /><span>保存中…</span></>
              ) : (
                <><Check size={10} /><span>已保存</span></>
              )}
            </div>

            {/* Chronicle 入库 / 锁定 badge */}
            {activePage && onArchivePage && (
              archivedPages?.[activePageId] ? (
                <span className="shrink-0 flex items-center gap-1 text-[11px] text-amber-500/70 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  🔒 {archivedPages[activePageId].version_tag}
                </span>
              ) : (
                <button
                  onClick={() => onArchivePage(activePage, currentBlocks)}
                  className="shrink-0 text-[11px] text-neutral-400 hover:text-neutral-200 bg-white/5 hover:bg-white/10 px-2 py-0.5 rounded transition-colors border border-white/5">
                  入库 Chronicle
                </button>
              )
            )}

            {/* 快捷键提示 */}
            <div className="shrink-0 hidden lg:flex items-center gap-3 text-[10px] text-neutral-700">
              {[['Tab','缩进'],['Shift+Tab','反缩进'],['/','插入块']].map(([k,v]) => (
                <span key={k}><kbd className="bg-neutral-800 px-1 rounded text-neutral-600">{k}</kbd> {v}</span>
              ))}
            </div>
          </div>

          {/* 编辑器区域 */}
          <div className="flex-1 overflow-y-auto">
            {blockLoading ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 size={16} className="animate-spin text-neutral-600" />
              </div>
            ) : activePageId ? (
              <div className="max-w-[740px] mx-auto px-12 pt-16 pb-52">
                {/* 页面标题编辑 */}
                <div className="flex items-center gap-3 mb-10 group">
                  <span className="text-5xl cursor-default select-none">{activePage?.icon ?? '📄'}</span>
                  <input
                    key={activePageId}
                    className="flex-1 bg-transparent text-[38px] font-bold text-neutral-100 placeholder-neutral-700/60 outline-none border-none leading-tight"
                    placeholder="无标题"
                    defaultValue={activePage?.title ?? ''}
                    onBlur={e => { if (e.target.value !== activePage?.title) renamePage(activePageId, e.target.value) }}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                  />
                </div>

                {/* 块编辑器 */}
                <BlockEditor
                  key={activePageId}
                  pageId={activePageId}
                  initialBlocks={currentBlocks}
                  onChange={handleBlocksChange}
                  onNavigate={activatePage}
                  onCreateSubpage={handleCreateSubpage}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-neutral-600 text-sm">
                从侧边栏选择一个页面开始
              </div>
            )}
          </div>
        </div>
      </div>
    </DndProvider>
  )
}
