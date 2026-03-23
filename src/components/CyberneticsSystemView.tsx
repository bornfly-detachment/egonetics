/**
 * CyberneticsSystemView — 自我控制论系统
 * 三个全屏 Tab：PRVS 指令集 / 控制论宪法 / 生变论本体
 */
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import PRVSPanel from './PRVSPanel'
import ConstitutionView from './ConstitutionView'
import OntologyView from './OntologyView'

type ModuleId = 'prvs' | 'constitution' | 'ontology'

const MODULES: {
  id:     ModuleId
  label:  string
  sub:    string
  icon:   string
  accent: string
  dot:    string
}[] = [
  {
    id:     'prvs',
    label:  'PRVS 指令集',
    sub:    '控制论底层指令集 · 最小完备集',
    icon:   '⚡',
    accent: 'text-violet-300',
    dot:    'bg-violet-400',
  },
  {
    id:     'constitution',
    label:  '控制论宪法',
    sub:    '原则树 · 执行图 · JSON 编译',
    icon:   '🛡',
    accent: 'text-orange-300',
    dot:    'bg-orange-400',
  },
  {
    id:     'ontology',
    label:  '生变论本体',
    sub:    '知识图谱 · CRUD · 关系编辑',
    icon:   '🔷',
    accent: 'text-blue-300',
    dot:    'bg-blue-400',
  },
]

export default function CyberneticsSystemView() {
  const [active, setActive] = useState<ModuleId>('prvs')

  return (
    <div className="flex flex-col -m-6 h-[calc(100%+48px)] overflow-hidden bg-[#080808]">

      {/* ── Tab bar ── */}
      <div className="shrink-0 flex items-stretch border-b border-white/[0.08] bg-[#0c0c0c]">

        {/* System title */}
        <div className="flex items-center px-6 border-r border-white/[0.06]">
          <span className="text-sm font-semibold text-white/50 tracking-wide whitespace-nowrap">
            自我控制论系统
          </span>
        </div>

        {/* Tabs */}
        <div className="flex flex-1">
          {MODULES.map(m => {
            const isActive = active === m.id
            return (
              <button
                key={m.id}
                onClick={() => setActive(m.id)}
                className={`
                  relative flex items-center gap-3 px-8 py-0 border-r border-white/[0.06]
                  transition-colors duration-150 min-w-[200px]
                  ${isActive
                    ? 'bg-[#141414]'
                    : 'bg-transparent hover:bg-white/[0.03]'
                  }
                `}
                style={{ minHeight: '56px' }}
              >
                {/* Active indicator bar at top */}
                {isActive && (
                  <span className={`absolute top-0 left-0 right-0 h-[2px] ${m.dot}`} />
                )}

                <span className="text-xl leading-none">{m.icon}</span>

                <span className="flex flex-col items-start gap-0.5">
                  <span className={`text-sm font-semibold leading-tight ${
                    isActive ? m.accent : 'text-white/40'
                  }`}>
                    {m.label}
                  </span>
                  <span className={`text-[11px] leading-tight ${
                    isActive ? 'text-white/30' : 'text-white/20'
                  }`}>
                    {m.sub}
                  </span>
                </span>

                {isActive && (
                  <ChevronDown size={14} className="ml-auto text-white/20" />
                )}
              </button>
            )
          })}
        </div>

        {/* Right info */}
        <div className="flex items-center px-6 text-[11px] text-white/20 whitespace-nowrap">
          Egonetics Cybernetics · v1
        </div>
      </div>

      {/* ── Full-screen module content ── */}
      <div className="flex-1 min-h-0 overflow-hidden bg-[#0a0a0a]">
        {active === 'prvs' && (
          <PRVSPanel />
        )}
        {active === 'constitution' && (
          <div className="w-full h-full p-6 overflow-hidden">
            <ConstitutionView />
          </div>
        )}
        {active === 'ontology' && (
          <div className="w-full h-full p-6 overflow-hidden">
            <OntologyView />
          </div>
        )}
      </div>
    </div>
  )
}
