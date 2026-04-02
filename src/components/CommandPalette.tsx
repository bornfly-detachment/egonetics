/**
 * CommandPalette — 全局快捷键命令面板
 *
 * 触发: Cmd+K (Mac) / Ctrl+K (Win/Linux)
 * 关闭: Escape
 *
 * 层级化导航语法:
 *   /               → 显示所有视图
 *   /task           → 筛选任务视图 + 任务列表
 *   /task-<查询>    → 搜索任务实体
 *   /page-<查询>    → 搜索理论页面
 *   /agent-<查询>   → 搜索 Agent
 *   /node-<查询>    → 搜索控制论节点
 *   /protocol-<查>  → 搜索协议规则
 *
 * 键盘操作:
 *   ↑ ↓             → 选中条目
 *   Enter           → 跳转
 *   Escape          → 关闭
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { authFetch } from '@/lib/http'

// ── 静态视图条目 ──────────────────────────────────────────────

interface CmdItem {
  id: string
  label: string
  sub?: string
  icon: string
  path: string
  group: string
  keywords?: string
}

const VIEWS: CmdItem[] = [
  { id: 'home',         label: '主页',         icon: '🏠', path: '/home',             group: '视图' },
  { id: 'prvse-world',  label: 'PRVSE World',  icon: '🌐', path: '/prvse-world',       group: '视图' },
  { id: 'tasks',        label: '任务看板',     icon: '📋', path: '/tasks',             group: '视图' },
  { id: 'protocol',     label: '人机协议',     icon: '⚖️', path: '/protocol',          group: '视图', keywords: 'hm' },
  { id: 'cybernetics',  label: '控制论系统',   icon: '⚙️', path: '/cybernetics',       group: '视图', keywords: 'prvse' },
  { id: 'memory',       label: '记忆',         icon: '🧠', path: '/memory',            group: '视图' },
  { id: 'egonetics',    label: '主体',         icon: '🪞', path: '/egonetics',         group: '视图' },
  { id: 'agents',       label: 'Agents',       icon: '🤖', path: '/agents',            group: '视图' },
  { id: 'chronicle',    label: '编年史',       icon: '📜', path: '/chronicle',         group: '视图' },
  { id: 'theory',       label: '理论',         icon: '📚', path: '/theory',            group: '视图' },
  { id: 'blog',         label: '博客',         icon: '✍️', path: '/blog',              group: '视图' },
  { id: 'tag-tree',     label: '标签树',       icon: '🏷️', path: '/tag-tree',          group: '视图' },
  { id: 'lab',          label: '实验室',       icon: '🧪', path: '/lab',               group: '视图' },
  { id: 'queue',        label: '调度队列',     icon: '📤', path: '/queue',             group: '视图' },
  { id: 'mq',           label: '消息队列 MQ',  icon: '📨', path: '/mq',               group: '视图' },
  { id: 'controller',   label: '控制器',       icon: '🎛️', path: '/controller',        group: '视图' },
  { id: 'proto-builder',label: '协议构建器',   icon: '🔧', path: '/protocol/builder',  group: '视图' },
  { id: 'recycle',      label: '回收站',       icon: '🗑️', path: '/recycle',           group: '视图' },
]

// ── 实体前缀定义 ──────────────────────────────────────────────

interface EntityDef {
  prefixes: string[]  // e.g. ['task', 't']
  label: string
  icon: string
  group: string
  fetchFn: (q: string) => Promise<CmdItem[]>
}

// ── 数据获取函数 ──────────────────────────────────────────────

async function fetchTasks(q: string): Promise<CmdItem[]> {
  const data = await authFetch<{ tasks?: Array<{ id: string; title: string; icon?: string; column_id?: string }> }>('/tasks')
  const tasks = data.tasks ?? (Array.isArray(data) ? data as Array<{ id: string; title: string; icon?: string; column_id?: string }> : [])
  const lq = q.toLowerCase()
  return tasks
    .filter(t => !q || t.title?.toLowerCase().includes(lq) || t.id.includes(lq))
    .slice(0, 12)
    .map(t => ({
      id: t.id,
      label: t.title ?? t.id,
      sub: t.id,
      icon: t.icon ?? '📋',
      path: `/tasks/${t.id}`,
      group: '任务',
    }))
}

async function fetchPages(q: string): Promise<CmdItem[]> {
  const data = await authFetch<{ pages?: Array<{ id: string; title: string; icon?: string; pageType?: string }> }>('/pages?type=theory&limit=100')
  const pages = data.pages ?? (Array.isArray(data) ? data as Array<{ id: string; title: string; icon?: string; pageType?: string }> : [])
  const lq = q.toLowerCase()
  return pages
    .filter(p => !q || p.title?.toLowerCase().includes(lq) || p.id.includes(lq))
    .slice(0, 10)
    .map(p => ({
      id: p.id,
      label: p.title ?? p.id,
      sub: p.id,
      icon: p.icon ?? '📄',
      path: `/theory#${p.id}`,
      group: '理论页面',
    }))
}

async function fetchAgents(q: string): Promise<CmdItem[]> {
  const data = await authFetch<{ agents?: Array<{ id: string; name: string; icon?: string }> }>('/agents')
  const agents = data.agents ?? (Array.isArray(data) ? data as Array<{ id: string; name: string; icon?: string }> : [])
  const lq = q.toLowerCase()
  return agents
    .filter(a => !q || a.name?.toLowerCase().includes(lq) || a.id.includes(lq))
    .slice(0, 10)
    .map(a => ({
      id: a.id,
      label: a.name ?? a.id,
      sub: a.id,
      icon: a.icon ?? '🤖',
      path: `/agents`,
      group: 'Agent',
    }))
}

async function fetchNodes(q: string): Promise<CmdItem[]> {
  const data = await authFetch<{ nodes?: Array<{ id: string; name: string; type?: string }> }>('/cybernetics/nodes')
  const nodes = data.nodes ?? (Array.isArray(data) ? data as Array<{ id: string; name: string; type?: string }> : [])
  const lq = q.toLowerCase()
  return nodes
    .filter(n => !q || n.name?.toLowerCase().includes(lq) || n.id.includes(lq))
    .slice(0, 10)
    .map(n => ({
      id: n.id,
      label: n.name ?? n.id,
      sub: n.type ?? '',
      icon: '⚙️',
      path: `/cybernetics`,
      group: '控制论节点',
    }))
}

async function fetchProtocol(q: string): Promise<CmdItem[]> {
  const data = await authFetch<{ nodes?: Array<{ id: string; human_char: string; category?: string; layer?: string }> }>('/protocol')
  const items = data.nodes ?? (Array.isArray(data) ? data as Array<{ id: string; human_char: string; category?: string; layer?: string }> : [])
  const lq = q.toLowerCase()
  return items
    .filter(n => !q || n.human_char?.toLowerCase().includes(lq) || n.id.includes(lq))
    .slice(0, 10)
    .map(n => ({
      id: n.id,
      label: n.human_char ?? n.id,
      sub: `${n.category ?? ''} · ${n.layer ?? ''}`,
      icon: '⚖️',
      path: `/protocol`,
      group: '协议节点',
    }))
}

const ENTITY_DEFS: EntityDef[] = [
  { prefixes: ['task', 't'],     label: '任务',       icon: '📋', group: '任务',     fetchFn: fetchTasks    },
  { prefixes: ['page', 'theory'],label: '理论页面',   icon: '📄', group: '理论页面', fetchFn: fetchPages    },
  { prefixes: ['agent', 'a'],    label: 'Agent',      icon: '🤖', group: 'Agent',    fetchFn: fetchAgents   },
  { prefixes: ['node', 'n'],     label: '控制论节点', icon: '⚙️', group: '控制论节点', fetchFn: fetchNodes  },
  { prefixes: ['protocol', 'p'], label: '协议节点',   icon: '⚖️', group: '协议节点', fetchFn: fetchProtocol },
]

// ── 解析输入 ──────────────────────────────────────────────────

interface ParsedQuery {
  raw: string
  entityDef: EntityDef | null
  entityQuery: string   // 实体搜索词（`-` 后面的部分）
  viewFilter: string    // 视图筛选词
  isEntityMode: boolean
}

function parseQuery(input: string): ParsedQuery {
  const raw = input.trim()

  // 以 / 开头的命令
  if (raw.startsWith('/')) {
    const cmd = raw.slice(1).toLowerCase()  // 去掉 /

    // 尝试匹配实体前缀
    for (const def of ENTITY_DEFS) {
      for (const prefix of def.prefixes) {
        if (cmd.startsWith(prefix + '-') || cmd === prefix) {
          const entityQuery = cmd.startsWith(prefix + '-')
            ? cmd.slice(prefix.length + 1)
            : ''
          return { raw, entityDef: def, entityQuery, viewFilter: '', isEntityMode: true }
        }
      }
    }

    // 视图过滤
    return { raw, entityDef: null, entityQuery: '', viewFilter: cmd, isEntityMode: false }
  }

  // 不以 / 开头：全文搜索视图 + 实体
  return { raw, entityDef: null, entityQuery: raw, viewFilter: raw, isEntityMode: false }
}

// ── 命令面板主组件 ────────────────────────────────────────────

interface ResultGroup {
  group: string
  items: CmdItem[]
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [entityItems, setEntityItems] = useState<CmdItem[]>([])
  const [entityLoading, setEntityLoading] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const fetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastFetchKey = useRef('')

  // ── 打开/关闭 ──────────────────────────────────────────────
  const openPalette = useCallback(() => {
    setOpen(true)
    setQuery('')
    setEntityItems([])
    setActiveIdx(0)
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  const closePalette = useCallback(() => {
    setOpen(false)
    setQuery('')
    setEntityItems([])
  }, [])

  // ── 全局键盘监听 ──────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (open) closePalette()
        else openPalette()
      }
      if (e.key === 'Escape' && open) {
        closePalette()
      }
    }
    window.addEventListener('keydown', handler)

    // slash-open-palette：由 SlashCommandMenu 的 prefix 类条目触发
    const onSlashOpen = (e: Event) => {
      const prefix = (e as CustomEvent<{ prefix: string }>).detail?.prefix ?? '/'
      setOpen(true)
      setQuery(prefix)
      setEntityItems([])
      setActiveIdx(0)
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus()
          inputRef.current.setSelectionRange(prefix.length, prefix.length)
        }
      }, 50)
    }
    window.addEventListener('slash-open-palette', onSlashOpen)

    return () => {
      window.removeEventListener('keydown', handler)
      window.removeEventListener('slash-open-palette', onSlashOpen)
    }
  }, [open, openPalette, closePalette])

  // ── 解析查询词 ────────────────────────────────────────────
  const parsed = useMemo(() => parseQuery(query), [query])

  // ── 视图过滤 ──────────────────────────────────────────────
  // 规则：空查询 → 不显示视图（只显示提示栏）
  //       / 或 /xxx → 显示视图（按 xxx 过滤）
  //       实体模式  → 不显示视图
  const filteredViews = useMemo(() => {
    if (parsed.isEntityMode) return []
    // 必须以 / 开头才激活视图列表
    if (!parsed.raw.startsWith('/') && !parsed.entityQuery) return []
    const f = parsed.viewFilter.toLowerCase()
    if (!f) return VIEWS
    return VIEWS.filter(v =>
      v.label.toLowerCase().includes(f) ||
      v.id.includes(f) ||
      (v.keywords ?? '').includes(f) ||
      v.path.includes(f)
    )
  }, [parsed])

  // ── 实体懒加载 ────────────────────────────────────────────
  useEffect(() => {
    if (!open) return

    // 非实体模式且有查询词时 → 全局搜索所有实体
    const shouldFetchAll = !parsed.isEntityMode && parsed.entityQuery.length > 0
    const shouldFetchEntity = parsed.isEntityMode && parsed.entityDef !== null

    if (!shouldFetchAll && !shouldFetchEntity) {
      setEntityItems([])
      return
    }

    const fetchKey = `${parsed.entityDef?.prefixes[0] ?? 'all'}:${parsed.entityQuery}`
    if (fetchKey === lastFetchKey.current) return

    if (fetchTimer.current) clearTimeout(fetchTimer.current)

    fetchTimer.current = setTimeout(async () => {
      lastFetchKey.current = fetchKey
      setEntityLoading(true)
      try {
        if (shouldFetchEntity && parsed.entityDef) {
          const items = await parsed.entityDef.fetchFn(parsed.entityQuery)
          setEntityItems(items)
        } else if (shouldFetchAll) {
          // 全局搜索：并发拉所有类型
          const allResults = await Promise.all(
            ENTITY_DEFS.map(def => def.fetchFn(parsed.entityQuery).catch(() => [] as CmdItem[]))
          )
          setEntityItems(allResults.flat())
        }
      } catch {
        setEntityItems([])
      } finally {
        setEntityLoading(false)
      }
    }, 200)
  }, [parsed, open])

  // ── 分组结果 ──────────────────────────────────────────────
  const groups = useMemo<ResultGroup[]>(() => {
    const result: ResultGroup[] = []
    if (filteredViews.length > 0) {
      result.push({ group: '视图', items: filteredViews })
    }
    // entity items，按 group 分组
    const entityGroups: Record<string, CmdItem[]> = {}
    for (const item of entityItems) {
      if (!entityGroups[item.group]) entityGroups[item.group] = []
      entityGroups[item.group].push(item)
    }
    for (const [group, items] of Object.entries(entityGroups)) {
      result.push({ group, items })
    }
    return result
  }, [filteredViews, entityItems])

  // 扁平化结果（用于键盘导航）
  const flatItems = useMemo(() => groups.flatMap(g => g.items), [groups])

  // 重置 activeIdx 当 results 变化
  useEffect(() => {
    setActiveIdx(0)
  }, [flatItems.length])

  // ── 自动滚动激活条目到视口 ────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return
    const el = containerRef.current.querySelector(`[data-idx="${activeIdx}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  // ── 键盘导航 ─────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, flatItems.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = flatItems[activeIdx]
      if (item) jump(item)
    }
  }

  const jump = (item: CmdItem) => {
    closePalette()
    navigate(item.path)
  }

  if (!open) return null

  // 全局计数（用于 data-idx 对应 flatItems 索引）
  let globalIdx = 0

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[12vh]"
      style={{ background: 'rgba(2,4,12,0.75)', backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) closePalette() }}
    >
      <div
        className="w-full max-w-xl flex flex-col rounded-2xl overflow-hidden
          bg-[#070a14]/95 backdrop-blur-2xl
          border border-white/[0.09]
          shadow-[0_24px_80px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.04)]"
        style={{ maxHeight: '72vh' }}
      >
        {/* ── 输入区 ── */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.07]">
          {/* 语法提示徽章 */}
          {parsed.isEntityMode && parsed.entityDef ? (
            <span
              className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-mono border"
              style={{ color: '#a78bfa', borderColor: '#a78bfa33', background: '#a78bfa0d' }}
            >
              {parsed.entityDef.icon} {parsed.entityDef.label}
            </span>
          ) : (
            <span className="text-[12px] text-white/20 shrink-0 select-none font-mono">⌘K</span>
          )}

          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setActiveIdx(0) }}
            onKeyDown={handleKeyDown}
            placeholder="输入 / 导航视图 · /task- 搜索任务 · /agent- 搜索 Agent…"
            className="flex-1 bg-transparent text-[13px] text-white/80 placeholder:text-white/18
              outline-none caret-purple-400/70 font-mono"
            spellCheck={false}
            autoComplete="off"
            data-no-slash="true"
          />

          {entityLoading && (
            <span className="shrink-0 w-3 h-3 border border-purple-400/40 border-t-transparent rounded-full animate-spin" />
          )}
          <kbd className="shrink-0 text-[9px] text-white/15 font-mono bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/[0.07]">
            esc
          </kbd>
        </div>

        {/* ── 语法帮助（空查询 或 仅输入 / 时显示） ── */}
        {(!query || query === '/') && (
          <div className="px-4 py-3 border-b border-white/[0.04] flex flex-wrap gap-x-4 gap-y-1.5">
            {[
              { prefix: '/',       desc: '浏览所有视图', active: query === '/' },
              { prefix: '/task-', desc: '搜索任务' },
              { prefix: '/page-', desc: '搜索理论' },
              { prefix: '/agent-', desc: '搜索 Agent' },
              { prefix: '/node-', desc: '搜索节点' },
              { prefix: '/protocol-', desc: '搜索协议' },
            ].map(hint => (
              <button
                key={hint.prefix}
                className={`flex items-center gap-1.5 text-[9px] font-mono transition-colors ${
                  (hint as { active?: boolean }).active
                    ? 'text-purple-400/80'
                    : 'text-white/25 hover:text-white/55'
                }`}
                onClick={() => { setQuery(hint.prefix); inputRef.current?.focus() }}
              >
                <span className={`px-1 py-px rounded border ${
                  (hint as { active?: boolean }).active
                    ? 'bg-purple-500/10 border-purple-500/30'
                    : 'bg-white/[0.04] border-white/[0.07]'
                }`}>
                  {hint.prefix}
                </span>
                <span>{hint.desc}</span>
              </button>
            ))}
          </div>
        )}

        {/* ── 结果列表 ── */}
        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto overscroll-contain py-1.5"
          style={{ scrollbarWidth: 'none' }}
        >
          {groups.length === 0 && !entityLoading && query && query !== '/' && (
            <div className="px-4 py-8 text-center text-[11px] text-white/20 font-mono">
              无结果
            </div>
          )}
          {!query && (
            <div className="px-4 py-6 text-center text-[10px] text-white/15 font-mono">
              输入 <span className="px-1 py-px rounded bg-white/[0.05] border border-white/[0.08]">/</span> 浏览视图，或直接输入搜索
            </div>
          )}

          {groups.map((g) => (
            <div key={g.group}>
              {/* 分组标题 */}
              <div className="px-4 py-1.5 text-[8px] font-mono text-white/18 uppercase tracking-widest select-none">
                {g.group}
              </div>

              {g.items.map((item) => {
                const idx = globalIdx++
                const isActive = idx === activeIdx
                return (
                  <button
                    key={item.id}
                    data-idx={idx}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      isActive
                        ? 'bg-white/[0.07]'
                        : 'hover:bg-white/[0.04]'
                    }`}
                    onClick={() => jump(item)}
                    onMouseEnter={() => setActiveIdx(idx)}
                  >
                    <span className="text-base shrink-0 w-5 text-center">{item.icon}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[12px] text-white/75 truncate">{item.label}</span>
                      {item.sub && (
                        <span className="block text-[9px] text-white/25 font-mono truncate mt-0.5">{item.sub}</span>
                      )}
                    </span>
                    {isActive && (
                      <kbd className="shrink-0 text-[9px] text-white/20 font-mono bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/[0.07]">
                        ↵
                      </kbd>
                    )}
                    <span className="shrink-0 text-[9px] text-white/15 font-mono truncate max-w-[140px]">
                      {item.path}
                    </span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {/* ── 底部提示 ── */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-white/[0.05] shrink-0">
          {[
            { key: '↑↓', desc: '导航' },
            { key: '↵', desc: '跳转' },
            { key: 'esc', desc: '关闭' },
          ].map(k => (
            <div key={k.key} className="flex items-center gap-1 text-[8px] text-white/20 font-mono">
              <kbd className="px-1 py-px rounded bg-white/[0.04] border border-white/[0.07]">{k.key}</kbd>
              <span>{k.desc}</span>
            </div>
          ))}
          <div className="ml-auto text-[8px] text-white/12 font-mono">⌘K</div>
        </div>
      </div>
    </div>
  )
}
