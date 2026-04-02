import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, Brain, History, Shield, CheckSquare, BookOpen, Cpu, ArrowRight } from 'lucide-react'
import { useChronicleStore } from '@/stores/useChronicleStore'
import { useTranslation, type Translation } from '@/lib/translations'

type ModuleId = 'memory' | 'egonetics' | 'chronicle' | 'theory' | 'tasks' | 'blog' | 'agents'

function getModules(t: Translation) {
  const mt = t.home.moduleTitle
  const md = t.home.moduleDesc
  return [
    { id: 'memory' as ModuleId, path: '/memory', icon: Calendar, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', glow: 'hover:shadow-blue-500/10', title: mt.memory, desc: md.memory },
    { id: 'egonetics' as ModuleId, path: '/egonetics', icon: Shield, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', glow: 'hover:shadow-red-500/10', title: mt.egonetics, desc: md.egonetics },
    { id: 'chronicle' as ModuleId, path: '/chronicle', icon: History, color: 'text-primary-400', bg: 'bg-primary-500/10 border-primary-500/20', glow: 'hover:shadow-primary-500/10', title: mt.chronicle, desc: md.chronicle },
    { id: 'theory' as ModuleId, path: '/theory', icon: Brain, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', glow: 'hover:shadow-yellow-500/10', title: mt.theory, desc: md.theory },
    { id: 'tasks' as ModuleId, path: '/tasks', icon: CheckSquare, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20', glow: 'hover:shadow-green-500/10', title: mt.tasks, desc: md.tasks },
    { id: 'blog' as ModuleId, path: '/blog', icon: BookOpen, color: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/20', glow: 'hover:shadow-sky-500/10', title: mt.blog, desc: md.blog },
    { id: 'agents' as ModuleId, path: '/agents', icon: Cpu, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20', glow: 'hover:shadow-purple-500/10', title: mt.agents, desc: md.agents },
  ]
}

const HomeView: React.FC = () => {
  const navigate = useNavigate()
  const { getEntryCount } = useChronicleStore()
  const { t } = useTranslation()
  const MODULES = getModules(t)

  return (
    <div className="min-h-full pb-16" style={{ fontFamily: "'PingFang SC','SF Pro Text',system-ui,sans-serif" }}>
      {/* Hero */}
      <div className="pt-16 pb-12 px-8 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <img src="/bornfly_logo.png" alt="Bornfly" className="app-logo" style={{ height: 40, width: 'auto' }} />
          <div>
            <h1 className="text-4xl font-bold tracking-tight">
              <span className="gradient-text">Egonetics</span>
            </h1>
            <p className="text-neutral-500 text-sm mt-0.5">{t.home.tagline}</p>
          </div>
        </div>

        <p className="text-neutral-400 text-base leading-relaxed max-w-xl">
          {t.home.heroDesc}
        </p>

        {/* Quick stats */}
        <div className="flex items-center gap-6 mt-8">
          <div className="text-center">
            <div className="text-2xl font-mono font-bold text-primary-300">{getEntryCount()}</div>
            <div className="text-xs text-neutral-600 mt-0.5">{t.home.chronicleEntries}</div>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="text-center">
            <div className="text-2xl font-mono font-bold text-green-400">v0.1</div>
            <div className="text-xs text-neutral-600 mt-0.5">{t.home.currentVersion}</div>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="text-center">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-sm font-medium text-green-400">{t.home.active}</span>
            </div>
            <div className="text-xs text-neutral-600 mt-0.5">{t.home.systemStatus}</div>
          </div>
        </div>
      </div>

      {/* Module grid */}
      <div className="px-8 max-w-4xl">
        <h2 className="text-xs font-semibold text-neutral-600 uppercase tracking-widest mb-4">{t.home.modules}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {MODULES.map((m) => {
            const Icon = m.icon
            return (
              <button
                key={m.id}
                onClick={() => navigate(m.path)}
                className={`
                  text-left p-4 rounded-xl border transition-all duration-200 group
                  bg-white/[0.03] border-white/[0.07]
                  hover:bg-white/[0.07] hover:border-white/15
                  hover:shadow-lg ${m.glow}
                `}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`p-2 rounded-lg border ${m.bg}`}>
                    <Icon className={`w-4 h-4 ${m.color}`} />
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-neutral-700 group-hover:text-neutral-400 group-hover:translate-x-0.5 transition-all" />
                </div>
                <div className="font-semibold text-white text-sm">{m.title}</div>
                <div className="text-xs text-neutral-500 leading-relaxed mt-1">{m.desc}</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Core principles */}
      <div className="px-8 max-w-4xl mt-10">
        <h2 className="text-xs font-semibold text-neutral-600 uppercase tracking-widest mb-4">{t.home.laws.title}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { num: 'I', ...t.home.laws.i },
            { num: 'II', ...t.home.laws.ii },
            { num: 'III', ...t.home.laws.iii },
          ].map((law) => (
            <div key={law.num} className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]">
              <div className="text-xs font-mono text-neutral-700 mb-2">{t.home.laws.lawLabel} {law.num}</div>
              <div className="text-sm font-semibold text-white/80 mb-1.5">{law.title}</div>
              <div className="text-xs text-neutral-600 leading-relaxed">{law.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default HomeView
