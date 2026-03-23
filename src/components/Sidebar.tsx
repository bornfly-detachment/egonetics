import React from 'react'
import {
  CheckSquare,
  Cpu,
  Brain,
  History,
  Calendar,
  BookOpen,
  Shield,
  ChevronLeft,
  ChevronRight,
  Home,
  LogOut,
  Zap,
} from 'lucide-react'
import { useChronicleStore } from '@/stores/useChronicleStore'
import { useTranslation } from '@/lib/translations'
import { useAuthStore } from '@/stores/useAuthStore'
import { getVisibleNavItems } from '@/components/AuthGuard'

const Sidebar: React.FC = () => {
  const { uiState, setUIState } = useChronicleStore()
  const { t, language, setLanguage } = useTranslation()
  const { user, logout } = useAuthStore()

  const ALL_NAV_ITEMS = [
    { id: 'home',        label: language === 'zh' ? '主页'       : 'Home',       icon: Home,        color: 'text-neutral-300' },
    { id: 'memory',      label: t.memory,                                           icon: Calendar,    color: 'text-blue-400' },
    { id: 'theory',      label: t.theory,                                           icon: Brain,       color: 'text-yellow-400' },
    { id: 'chronicle',   label: t.chronicle,                                        icon: History,     color: 'text-primary-400' },
    { id: 'egonetics',   label: language === 'zh' ? '主体图谱'   : 'Subjects',      icon: Shield,      color: 'text-red-400' },
    { id: 'tasks',       label: t.tasks,                                            icon: CheckSquare, color: 'text-green-400' },
    { id: 'blog',        label: language === 'zh' ? '博客'       : 'Blog',          icon: BookOpen,    color: 'text-sky-400' },
    { id: 'agents',      label: t.agents,                                           icon: Cpu,         color: 'text-purple-400' },
    { id: 'cybernetics', label: language === 'zh' ? '控制论内核' : 'Core Kernel',   icon: Zap,         color: 'text-violet-400' },
  ]

  const visibleIds = user ? new Set(getVisibleNavItems(user.role)) : new Set(['home'])
  const NAV_ITEMS = ALL_NAV_ITEMS.filter(item => visibleIds.has(item.id))

  const open = uiState.sidebarOpen

  // 当前激活项：egonetics-detail 也高亮 egonetics
  const activeId = uiState.currentView === 'egonetics-detail' ? 'egonetics'
    : uiState.currentView === 'project-detail' ? 'tasks'
    : uiState.currentView

  return (
    <aside
      className={`
        flex flex-col h-full
        bg-[#111111] border-r border-white/[0.06]
        transition-all duration-300 ease-in-out
        ${open ? 'w-56' : 'w-[60px]'}
      `}
    >
      {/* Logo */}
      <div className={`shrink-0 flex items-center gap-3 px-4 h-14 border-b border-white/[0.06] ${!open && 'justify-center'}`}>
        <img
          src="/bornfly_logo.png"
          alt="Bornfly"
          className="app-logo shrink-0"
          style={{ height: 28, width: 'auto' }}
        />
        {open && (
          <div className="flex-1 min-w-0 flex items-center justify-between">
            <span className="font-semibold text-white text-sm tracking-wide">Egonetics</span>
            <button
              onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
              className="text-[10px] text-neutral-500 hover:text-neutral-300 transition-colors px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10"
            >
              {language === 'zh' ? 'EN' : '中'}
            </button>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 flex flex-col gap-0.5 px-2 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = activeId === item.id
          return (
            <button
              key={item.id}
              onClick={() => setUIState({ currentView: item.id as any })}
              title={!open ? item.label : undefined}
              className={`
                flex items-center gap-3 rounded-lg
                transition-all duration-150
                ${open ? 'px-3 py-2' : 'px-0 py-2 justify-center'}
                ${active
                  ? 'bg-white/10 text-white'
                  : 'text-neutral-500 hover:text-neutral-200 hover:bg-white/[0.05]'
                }
              `}
            >
              <item.icon className={`shrink-0 w-[18px] h-[18px] ${active ? item.color : ''}`} />
              {open && (
                <span className="text-sm font-medium truncate">{item.label}</span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Bottom actions */}
      <div className="shrink-0 px-2 pb-4 space-y-1">
        {/* Logout */}
        <button
          onClick={logout}
          title={!open ? '退出登录' : undefined}
          className={`
            w-full flex items-center rounded-lg py-2 text-neutral-600 hover:text-red-400
            hover:bg-white/[0.05] transition-all duration-150
            ${open ? 'px-3 gap-2' : 'justify-center'}
          `}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {open && (
            <div className="flex-1 flex items-center justify-between min-w-0">
              <span className="text-xs truncate">{user?.username || user?.email || '退出'}</span>
              <span className="text-[10px] text-neutral-700 ml-1 truncate">{user?.role}</span>
            </div>
          )}
        </button>

        {/* Collapse toggle */}
        <button
          onClick={() => useChronicleStore.getState().toggleSidebar()}
          className={`
            w-full flex items-center rounded-lg py-2 text-neutral-600 hover:text-neutral-300
            hover:bg-white/[0.05] transition-all duration-150
            ${open ? 'px-3 gap-2' : 'justify-center'}
          `}
        >
          {open
            ? <><ChevronLeft className="w-4 h-4" /><span className="text-xs">收起</span></>
            : <ChevronRight className="w-4 h-4" />
          }
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
