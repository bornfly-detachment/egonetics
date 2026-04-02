/**
 * SlashCommandMenu — 全局 Slash 命令菜单
 *
 * 触发规则：在任意 input / textarea 中输入 "/"
 *   - 输入框为空时输入 "/"
 *   - "/" 前面是空格或换行时
 *
 * 菜单内容：
 *   - 所有视图快捷跳转
 *   - 实体搜索前缀提示（/task- /page- ...）
 *
 * 键盘操作：
 *   ↑ ↓  选中  Enter 跳转  Escape 关闭
 */

import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

// ── 快捷菜单条目 ──────────────────────────────────────────────

interface SlashItem {
  id: string
  label: string
  desc: string
  icon: string
  action: 'navigate' | 'prefix'
  value: string   // navigate: path / prefix: 填入命令面板的前缀
}

const SLASH_ITEMS: SlashItem[] = [
  // 视图
  { id: 'home',        label: '主页',       desc: '跳转到主页',         icon: '🏠', action: 'navigate', value: '/home'         },
  { id: 'prvse',       label: 'PRVSE World',desc: '跳转到 PRVSE World', icon: '🌐', action: 'navigate', value: '/prvse-world'   },
  { id: 'tasks',       label: '任务看板',   desc: '跳转到任务看板',     icon: '📋', action: 'navigate', value: '/tasks'         },
  { id: 'protocol',    label: '人机协议',   desc: '跳转到协议视图',     icon: '⚖️', action: 'navigate', value: '/protocol'      },
  { id: 'cybernetics', label: '控制论系统', desc: '跳转到控制论',       icon: '⚙️', action: 'navigate', value: '/cybernetics'   },
  { id: 'memory',      label: '记忆',       desc: '跳转到记忆视图',     icon: '🧠', action: 'navigate', value: '/memory'        },
  { id: 'agents',      label: 'Agents',     desc: '跳转到 Agent 列表', icon: '🤖', action: 'navigate', value: '/agents'        },
  { id: 'theory',      label: '理论',       desc: '跳转到理论页面',     icon: '📚', action: 'navigate', value: '/theory'        },
  { id: 'chronicle',   label: '编年史',     desc: '跳转到编年史',       icon: '📜', action: 'navigate', value: '/chronicle'     },
  // 搜索前缀（打开命令面板）
  { id: 'srch-task',   label: '/task-',     desc: '搜索任务',           icon: '🔍', action: 'prefix',   value: '/task-'         },
  { id: 'srch-page',   label: '/page-',     desc: '搜索理论页面',       icon: '🔍', action: 'prefix',   value: '/page-'         },
  { id: 'srch-agent',  label: '/agent-',    desc: '搜索 Agent',         icon: '🔍', action: 'prefix',   value: '/agent-'        },
  { id: 'srch-node',   label: '/node-',     desc: '搜索控制论节点',     icon: '🔍', action: 'prefix',   value: '/node-'         },
]

// ── 判断是否应该触发菜单 ──────────────────────────────────────

function shouldTrigger(el: HTMLInputElement | HTMLTextAreaElement): boolean {
  const v = el.value
  const pos = el.selectionStart ?? 0
  if (pos === 0) return false          // 还没输入任何字符
  if (v[pos - 1] !== '/') return false // 最新输入不是 /
  if (pos === 1) return true           // 第一个字符就是 /
  const prev = v[pos - 2]
  return prev === ' ' || prev === '\n' // 前面是空格/换行
}

// ── 获取输入框中光标的屏幕坐标 ────────────────────────────────

function getCaretRect(el: HTMLElement): DOMRect {
  const rect = el.getBoundingClientRect()
  // 简单用输入框下边缘作为菜单位置
  return new DOMRect(rect.left, rect.bottom + 4, rect.width, 0)
}

// ── 主组件 ────────────────────────────────────────────────────

interface MenuState {
  visible: boolean
  x: number
  y: number
  query: string     // "/" 后面输入的过滤词
  sourceEl: HTMLInputElement | HTMLTextAreaElement | null
  slashPos: number  // "/" 在输入框中的位置（用于替换）
}

const INIT: MenuState = { visible: false, x: 0, y: 0, query: '', sourceEl: null, slashPos: -1 }

export default function SlashCommandMenu() {
  const [state, setState] = useState<MenuState>(INIT)
  const [activeIdx, setActiveIdx] = useState(0)
  const navigate = useNavigate()
  const menuRef = useRef<HTMLDivElement>(null)

  // ── 过滤条目 ──────────────────────────────────────────────
  const filtered = state.query
    ? SLASH_ITEMS.filter(item =>
        item.label.toLowerCase().includes(state.query) ||
        item.desc.toLowerCase().includes(state.query)
      )
    : SLASH_ITEMS

  const close = useCallback(() => setState(INIT), [])

  // ── 执行选中 ──────────────────────────────────────────────
  const commit = useCallback((item: SlashItem) => {
    const el = state.sourceEl
    if (el) {
      // 删除输入框中的 "/" + 后续查询词
      const before = el.value.slice(0, state.slashPos)
      const after  = el.value.slice(state.slashPos + 1 + state.query.length)
      el.value = before + after
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }

    if (item.action === 'navigate') {
      navigate(item.value)
    } else {
      // prefix: 触发 Cmd+K 并填入前缀
      window.dispatchEvent(new CustomEvent('slash-open-palette', { detail: { prefix: item.value } }))
    }
    close()
  }, [state, navigate, close])

  // ── 全局 input 监听 ──────────────────────────────────────
  useEffect(() => {
    const onInput = (e: Event) => {
      const el = e.target as HTMLInputElement | HTMLTextAreaElement
      if (!['INPUT', 'TEXTAREA'].includes(el.tagName)) return
      if ((el as HTMLInputElement).type === 'hidden') return
      // 排除 CommandPalette 自身的输入框，避免相互干扰
      if ((el as HTMLElement).dataset.noSlash === 'true') return

      if (shouldTrigger(el)) {
        const rect = getCaretRect(el)
        const pos  = (el.selectionStart ?? 1) - 1  // position of "/"
        setState({ visible: true, x: rect.left, y: rect.y, query: '', sourceEl: el, slashPos: pos })
        setActiveIdx(0)
      } else if (state.visible && state.sourceEl === el) {
        // 继续输入：更新 query（"/" 之后的内容）
        const pos = state.slashPos
        const cur = el.selectionStart ?? 0
        if (cur <= pos) {
          // 光标移到 "/" 之前：关闭
          close()
        } else {
          const q = el.value.slice(pos + 1, cur).toLowerCase()
          if (q.includes(' ')) {
            close()
          } else {
            setState(s => ({ ...s, query: q }))
            setActiveIdx(0)
          }
        }
      }
    }

    document.addEventListener('input', onInput)
    return () => document.removeEventListener('input', onInput)
  }, [state, close])

  // ── 键盘导航 ─────────────────────────────────────────────
  useEffect(() => {
    if (!state.visible) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); return }
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, filtered.length - 1)); return }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); return }
      if (e.key === 'Enter') {
        e.preventDefault()
        const item = filtered[activeIdx]
        if (item) commit(item)
      }
    }
    document.addEventListener('keydown', onKey, true)  // capture phase
    return () => document.removeEventListener('keydown', onKey, true)
  }, [state.visible, filtered, activeIdx, commit, close])

  // ── 点击外部关闭 ─────────────────────────────────────────
  useEffect(() => {
    if (!state.visible) return
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) close()
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [state.visible, close])

  if (!state.visible || filtered.length === 0) return null

  // 避免超出视口右边
  const menuWidth = 260
  const x = Math.min(state.x, window.innerWidth - menuWidth - 12)
  // 避免超出底部
  const menuMaxH = 280
  const yBelow = state.y
  const yAbove = state.y - menuMaxH - (state.sourceEl?.getBoundingClientRect().height ?? 32) - 8
  const y = yBelow + menuMaxH > window.innerHeight ? yAbove : yBelow

  return (
    <div
      ref={menuRef}
      data-testid="slash-command-menu"
      className="fixed z-[9998] rounded-xl overflow-hidden
        bg-[#070a14]/96 backdrop-blur-2xl
        border border-white/[0.09]
        shadow-[0_12px_40px_rgba(0,0,0,0.6)]"
      style={{ left: x, top: y, width: menuWidth }}
    >
      {/* 标题行 */}
      <div className="px-3 py-2 border-b border-white/[0.06] flex items-center gap-2">
        <span className="text-[9px] font-mono text-white/20 uppercase tracking-widest">Slash 命令</span>
        {state.query && (
          <span className="text-[9px] font-mono px-1.5 py-px rounded bg-purple-500/10 border border-purple-500/20 text-purple-400/70">
            /{state.query}
          </span>
        )}
      </div>

      {/* 条目列表 */}
      <div style={{ maxHeight: menuMaxH - 36, overflowY: 'auto', scrollbarWidth: 'none' }}>
        {filtered.map((item, i) => (
          <button
            key={item.id}
            data-testid={`slash-item-${item.id}`}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
              i === activeIdx ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]'
            }`}
            onMouseEnter={() => setActiveIdx(i)}
            onClick={() => commit(item)}
          >
            <span className="text-sm shrink-0 w-5 text-center">{item.icon}</span>
            <span className="flex-1 min-w-0">
              <span className="block text-[12px] text-white/75 font-mono">{item.label}</span>
              <span className="block text-[9px] text-white/25 truncate">{item.desc}</span>
            </span>
            {i === activeIdx && (
              <kbd className="shrink-0 text-[8px] text-white/20 font-mono bg-white/[0.04] px-1 py-px rounded border border-white/[0.07]">↵</kbd>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
