/**
 * BottomNav — mobile-only bottom navigation bar
 *
 * Shows first 4 nav items + "More" sheet for the rest.
 * Fixed at bottom with safe-area-bottom padding.
 * Only rendered on screens < 768px (controlled by parent via isMobile).
 */

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckSquare, Brain, History, Calendar, BookOpen,
  Home, LogOut, Tag, FileText, FlaskConical, Trash2,
  Hammer, Globe, Waves, Terminal, MoreHorizontal, X,
} from 'lucide-react'
import { useChronicleStore } from '@/stores/useChronicleStore'
import { useTranslation } from '@/lib/translations'
import { useAuthStore } from '@/stores/useAuthStore'
import { getVisibleNavItems } from '@/components/AuthGuard'

const ICON_MAP: Record<string, React.ElementType> = {
  home: Home,
  memory: Calendar,
  theory: Brain,
  chronicle: History,
  tasks: CheckSquare,
  blog: BookOpen,
  'tag-tree': Tag,
  protocol: FileText,
  'protocol-builder': Hammer,
  'prvse-world': Globe,
  'free-code': Terminal,
  lab: FlaskConical,
  mq: Waves,
  recycle: Trash2,
}

const COLOR_MAP: Record<string, string> = {
  home: 'text-neutral-300',
  memory: 'text-blue-400',
  theory: 'text-yellow-400',
  chronicle: 'text-primary-400',
  tasks: 'text-green-400',
  blog: 'text-sky-400',
  'tag-tree': 'text-teal-400',
  protocol: 'text-pink-400',
  'protocol-builder': 'text-indigo-400',
  'prvse-world': 'text-amber-400',
  'free-code': 'text-emerald-400',
  lab: 'text-violet-400',
  mq: 'text-cyan-400',
  recycle: 'text-white/20',
}

const PATH_MAP: Record<string, string> = {
  home: '/home',
  memory: '/memory',
  theory: '/theory',
  chronicle: '/chronicle',
  tasks: '/tasks',
  blog: '/blog',
  'tag-tree': '/tag-tree',
  protocol: '/protocol',
  'protocol-builder': '/protocol/builder',
  'prvse-world': '/prvse-world',
  'free-code': '/free-code',
  lab: '/lab',
  mq: '/mq',
  recycle: '/recycle',
}

const MAX_TABS = 4

export default function BottomNav() {
  const { uiState } = useChronicleStore()
  const { t } = useTranslation()
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [sheetOpen, setSheetOpen] = useState(false)

  const s = t.sidebar
  const LABELS: Record<string, string> = {
    home: s.home,
    memory: s.memory,
    theory: s.theory,
    chronicle: s.chronicle,
    tasks: s.tasks,
    blog: s.blog,
    'tag-tree': s.tagTree,
    protocol: s.protocol,
    'protocol-builder': s.protoBuilder,
    'prvse-world': s.prvseWorld,
    'free-code': s.freeCode,
    lab: s.lab,
    mq: s.mq,
    recycle: s.recycle,
  }

  const visibleIds = user ? new Set(getVisibleNavItems(user.role)) : new Set(['home'])
  const allItems = Object.keys(ICON_MAP).filter(id => visibleIds.has(id))

  const primaryItems = allItems.slice(0, MAX_TABS)
  const moreItems    = allItems.slice(MAX_TABS)
  const hasMore      = moreItems.length > 0

  const activeId = uiState.currentView === 'egonetics-detail' ? 'egonetics'
    : uiState.currentView === 'project-detail' ? 'tasks'
    : uiState.currentView

  const navTo = (id: string) => {
    const path = PATH_MAP[id]
    if (path) {
      navigate(path)
      setSheetOpen(false)
    }
  }

  return (
    <>
      {/* More sheet overlay */}
      {sheetOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setSheetOpen(false)}
        />
      )}

      {/* More sheet */}
      <div
        className={`
          fixed left-0 right-0 z-50 bg-[#111111] border-t border-white/10
          rounded-t-2xl transition-transform duration-300 ease-out
          ${sheetOpen ? 'translate-y-0' : 'translate-y-full'}
        `}
        style={{
          bottom: 0,
          paddingBottom: 'calc(var(--bottom-nav-height) + var(--safe-area-bottom))',
        }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <span className="text-xs font-medium text-white/40 uppercase tracking-wider">更多</span>
          <button onClick={() => setSheetOpen(false)} className="text-white/40 hover:text-white/70 p-1">
            <X size={16} />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-1 px-3 py-3">
          {moreItems.map(id => {
            const Icon = ICON_MAP[id]
            const active = activeId === id
            return (
              <button
                key={id}
                onClick={() => navTo(id)}
                className={`flex flex-col items-center gap-1 py-3 rounded-xl transition-all ${
                  active ? 'bg-white/10' : 'hover:bg-white/[0.05]'
                }`}
              >
                <Icon size={20} className={active ? COLOR_MAP[id] : 'text-white/40'} />
                <span className={`text-[10px] font-medium truncate w-full text-center ${
                  active ? 'text-white/80' : 'text-white/40'
                }`}>
                  {LABELS[id]}
                </span>
              </button>
            )
          })}
        </div>
        {/* Logout row */}
        <div className="px-4 pb-2">
          <button
            onClick={() => { logout(); setSheetOpen(false) }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-neutral-600 hover:text-red-400 hover:bg-white/[0.05] transition-all"
          >
            <LogOut size={14} />
            <span className="text-xs truncate">{user?.username || user?.email}</span>
          </button>
        </div>
      </div>

      {/* Bottom tab bar */}
      <div
        className="fixed left-0 right-0 z-30 bg-[#111111]/95 backdrop-blur-xl border-t border-white/[0.06]"
        style={{
          bottom: 0,
          height: 'calc(var(--bottom-nav-height) + var(--safe-area-bottom))',
          paddingBottom: 'var(--safe-area-bottom)',
        }}
      >
        <div className="flex h-[56px]">
          {primaryItems.map(id => {
            const Icon = ICON_MAP[id]
            const active = activeId === id
            return (
              <button
                key={id}
                onClick={() => navTo(id)}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-all ${
                  active ? 'text-white' : 'text-white/35 hover:text-white/60'
                }`}
              >
                <Icon
                  size={20}
                  className={active ? COLOR_MAP[id] : ''}
                  strokeWidth={active ? 2.5 : 1.75}
                />
                <span className={`text-[9px] font-medium truncate max-w-[56px] text-center leading-none ${
                  active ? 'text-white/80' : 'text-white/35'
                }`}>
                  {LABELS[id]}
                </span>
              </button>
            )
          })}

          {/* More button */}
          {hasMore && (
            <button
              onClick={() => setSheetOpen(v => !v)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-all ${
                sheetOpen ? 'text-white' : 'text-white/35 hover:text-white/60'
              }`}
            >
              <MoreHorizontal size={20} strokeWidth={1.75} />
              <span className="text-[9px] font-medium leading-none text-white/35">更多</span>
            </button>
          )}
        </div>
      </div>
    </>
  )
}
