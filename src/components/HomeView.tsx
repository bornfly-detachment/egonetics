import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, Brain, History, Shield, CheckSquare, BookOpen, Cpu, ArrowRight } from 'lucide-react'
import { useChronicleStore } from '@/stores/useChronicleStore'

const MODULES = [
  {
    id: 'memory',
    path: '/memory',
    icon: Calendar,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
    glow: 'hover:shadow-blue-500/10',
    title: '记忆',
    en: 'Memory',
    desc: '会话记录、标注面板、发布到编年史',
  },
  {
    id: 'egonetics',
    path: '/egonetics',
    icon: Shield,
    color: 'text-red-400',
    bg: 'bg-red-500/10 border-red-500/20',
    glow: 'hover:shadow-red-500/10',
    title: '自我控制论',
    en: 'Egonetics',
    desc: '宪法主体性档案，只读内容树，块级批注',
  },
  {
    id: 'chronicle',
    path: '/chronicle',
    icon: History,
    color: 'text-primary-400',
    bg: 'bg-primary-500/10 border-primary-500/20',
    glow: 'hover:shadow-primary-500/10',
    title: '编年史',
    en: 'Chronicle',
    desc: '哈希链时间轴、里程碑、集合',
  },
  {
    id: 'theory',
    path: '/theory',
    icon: Brain,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10 border-yellow-500/20',
    glow: 'hover:shadow-yellow-500/10',
    title: '理论',
    en: 'Theory',
    desc: '价值判断框架，版本化，可锁定',
  },
  {
    id: 'tasks',
    path: '/tasks',
    icon: CheckSquare,
    color: 'text-green-400',
    bg: 'bg-green-500/10 border-green-500/20',
    glow: 'hover:shadow-green-500/10',
    title: '任务',
    en: 'Tasks',
    desc: '看板、富文本块、自定义属性',
  },
  {
    id: 'blog',
    path: '/blog',
    icon: BookOpen,
    color: 'text-sky-400',
    bg: 'bg-sky-500/10 border-sky-500/20',
    glow: 'hover:shadow-sky-500/10',
    title: '博客',
    en: 'Blog',
    desc: '层级页面树，块编辑',
  },
  {
    id: 'agents',
    path: '/agents',
    icon: Cpu,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10 border-purple-500/20',
    glow: 'hover:shadow-purple-500/10',
    title: '智能体',
    en: 'Agents',
    desc: 'SVG 节点图，关系网络',
  },
]

const HomeView: React.FC = () => {
  const navigate = useNavigate()
  const { getEntryCount } = useChronicleStore()

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
            <p className="text-neutral-500 text-sm mt-0.5">Ego × Cybernetics — 生命主体性系统</p>
          </div>
        </div>

        <p className="text-neutral-400 text-base leading-relaxed max-w-xl">
          个人 AI 协同进化系统。通过防篡改的编年史记录决策与成长，
          以宪法主体性约束智能体行为，让记忆、任务与理论在同一个时间轴上收敛。
        </p>

        {/* Quick stats */}
        <div className="flex items-center gap-6 mt-8">
          <div className="text-center">
            <div className="text-2xl font-mono font-bold text-primary-300">{getEntryCount()}</div>
            <div className="text-xs text-neutral-600 mt-0.5">Chronicle 条目</div>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="text-center">
            <div className="text-2xl font-mono font-bold text-green-400">v0.1</div>
            <div className="text-xs text-neutral-600 mt-0.5">当前版本</div>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="text-center">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-sm font-medium text-green-400">活跃</span>
            </div>
            <div className="text-xs text-neutral-600 mt-0.5">系统状态</div>
          </div>
        </div>
      </div>

      {/* Module grid */}
      <div className="px-8 max-w-4xl">
        <h2 className="text-xs font-semibold text-neutral-600 uppercase tracking-widest mb-4">模块</h2>
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
                <div className="text-[10px] text-neutral-600 font-mono mb-1">{m.en}</div>
                <div className="text-xs text-neutral-500 leading-relaxed">{m.desc}</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Core principles */}
      <div className="px-8 max-w-4xl mt-10">
        <h2 className="text-xs font-semibold text-neutral-600 uppercase tracking-widest mb-4">生命三大定律</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { num: 'I', title: '个体完备性', desc: '个体是生命社会的最小完整单位，理论上能够完成一切该生命形态的发展创造活动' },
            { num: 'II', title: '存在利益最大化', desc: '所有个体与集体无一例外会做出认知和生存环境内的利益最大化的选择' },
            { num: 'III', title: '认知条件转化', desc: '真与假、美与丑、善与恶、强与弱永远相对存在且动态转化' },
          ].map((law) => (
            <div key={law.num} className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]">
              <div className="text-xs font-mono text-neutral-700 mb-2">定律 {law.num}</div>
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
