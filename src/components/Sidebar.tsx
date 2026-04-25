import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckSquare,
  Brain,
  History,
  Calendar,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Home,
  LogOut,
  Tag,
  FileText,
  FlaskConical,
  Trash2,
  Hammer,
  Globe,
  Waves,
  Terminal,
  BarChart2,
  Settings,
} from 'lucide-react'
import { useChronicleStore } from '@/stores/useChronicleStore'
import { useTranslation } from '@/lib/translations'
import { useAuthStore } from '@/stores/useAuthStore'
import { getVisibleNavItems } from '@/components/AuthGuard'

const Sidebar: React.FC = () => {
  const { uiState } = useChronicleStore()
  const { t, language, setLanguage } = useTranslation()
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const s = t.sidebar
  const ALL_NAV_ITEMS = [
    { id: 'home',             label: s.home,          icon: Home,         color: 'text-neutral-300', path: '/home'             },
    { id: 'memory',           label: s.memory,        icon: Calendar,     color: 'text-blue-400',    path: '/memory'           },
    { id: 'theory',           label: s.theory,        icon: Brain,        color: 'text-yellow-400',  path: '/theory'           },
    { id: 'chronicle',        label: s.chronicle,     icon: History,      color: 'text-primary-400', path: '/chronicle'        },
    { id: 'tasks',            label: s.tasks,         icon: CheckSquare,  color: 'text-green-400',   path: '/tasks'            },
    { id: 'blog',             label: s.blog,          icon: BookOpen,     color: 'text-sky-400',     path: '/blog'             },
    { id: 'tag-tree',         label: s.tagTree,       icon: Tag,          color: 'text-teal-400',    path: '/tag-tree'         },
    { id: 'protocol',         label: s.protocol,      icon: FileText,     color: 'text-pink-400',    path: '/protocol'         },
    { id: 'protocol-builder', label: s.protoBuilder,  icon: Hammer,       color: 'text-indigo-400',  path: '/protocol/builder' },
    { id: 'prvse-world',      label: s.prvseWorld,    icon: Globe,        color: 'text-amber-400',   path: '/prvse-world'      },
    { id: 'free-code',        label: s.freeCode,      icon: Terminal,     color: 'text-emerald-400', path: '/free-code'        },
    { id: 'lab',              label: s.lab,           icon: FlaskConical, color: 'text-violet-400',  path: '/lab'              },
    { id: 'mq',               label: s.mq,            icon: Waves,        color: 'text-cyan-400',    path: '/mq'               },
    { id: 'resources-claude', label: s.resourcesClaude, icon: BarChart2,  color: 'text-orange-400',  path: '/resources_claude' },
    { id: 'resources-gemini', label: s.resourcesGemini, icon: BarChart2,  color: 'text-purple-400',  path: '/resources_gemini' },
    { id: 'recycle',          label: s.recycle,       icon: Trash2,       color: 'text-white/20',    path: '/recycle'          },
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
        border-r border-border
        transition-all duration-300 ease-in-out
        ${open ? 'w-56' : 'w-[60px]'}
      `}
      style={{ background: 'var(--bg-surface)' }}
    >
      {/* Logo */}
      <div className={`shrink-0 flex items-center gap-3 px-4 h-14 border-b border-border ${!open && 'justify-center'}`}>
        <img
          src="/bornfly_logo.png"
          alt="Bornfly"
          className="app-logo shrink-0"
          style={{ height: 28, width: 'auto' }}
        />
        {open && (
          <div className="flex-1 min-w-0 flex items-center justify-between">
            <span className="font-semibold text-foreground text-sm tracking-wide">Egonetics</span>
            <button
              onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded bg-foreground/5 hover:bg-foreground/10"
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
              onClick={() => navigate(item.path)}
              title={!open ? item.label : undefined}
              className={`
                flex items-center gap-3 rounded-lg
                transition-all duration-150
                ${open ? 'px-3 py-2' : 'px-0 py-2 justify-center'}
                ${active
                  ? 'bg-foreground/10 text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-foreground/[0.05]'
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
        {/* Settings */}
        <button
          onClick={() => navigate('/settings')}
          title={!open ? '外观设置' : undefined}
          className={`
            w-full flex items-center rounded-lg py-2 text-muted-foreground hover:text-foreground
            hover:bg-foreground/[0.05] transition-all duration-150
            ${open ? 'px-3 gap-2' : 'justify-center'}
          `}
        >
          <Settings className="w-4 h-4 shrink-0" />
          {open && <span className="text-xs">外观设置</span>}
        </button>
        {/* Logout */}
        <button
          onClick={logout}
          title={!open ? s.logout : undefined}
          className={`
            w-full flex items-center rounded-lg py-2 text-muted-foreground hover:text-red-500
            hover:bg-foreground/[0.05] transition-all duration-150
            ${open ? 'px-3 gap-2' : 'justify-center'}
          `}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {open && (
            <div className="flex-1 flex items-center justify-between min-w-0">
              <span className="text-xs truncate">{user?.username || user?.email || s.logout}</span>
              <span className="text-[10px] text-muted-foreground/40 ml-1 truncate">{user?.role}</span>
            </div>
          )}
        </button>

        {/* Collapse toggle */}
        <button
          onClick={() => useChronicleStore.getState().toggleSidebar()}
          className={`
            w-full flex items-center rounded-lg py-2 text-muted-foreground hover:text-foreground
            hover:bg-foreground/[0.05] transition-all duration-150
            ${open ? 'px-3 gap-2' : 'justify-center'}
          `}
        >
          {open
            ? <><ChevronLeft className="w-4 h-4" /><span className="text-xs">{s.collapse}</span></>
            : <ChevronRight className="w-4 h-4" />
          }
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
