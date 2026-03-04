import React from 'react'
import {
  CheckSquare,
  Cpu,
  Settings,
  Shield,
  Brain,
  History,
  Calendar,
  BookOpen,
} from 'lucide-react'
import { useChronicleStore } from '@/stores/useChronicleStore'
import { useTranslation } from '@/lib/translations'

const Sidebar: React.FC = () => {
  const { uiState, setUIState, verifyChain, getEntryCount } = useChronicleStore()
  const { t, language, setLanguage } = useTranslation()

  const lifeCoreItems = [
    {
      id: 'memory',
      label: t.memory,
      icon: Calendar,
      color: 'text-blue-400',
      description: t.memoryDesc,
    },
    {
      id: 'theory',
      label: t.theory,
      icon: Brain,
      color: 'text-yellow-400',
      description: t.theoryDesc,
    },
    {
      id: 'chronicle',
      label: t.chronicle,
      icon: History,
      color: 'text-primary-400',
      description: t.chronicleDesc,
    },
    {
      id: 'egonetics',
      label: t.principles,
      icon: Shield,
      color: 'text-red-400',
      description: t.egoneticsDesc,
    },
  ]

  const otherItems = [
    { id: 'tasks', label: t.tasks, icon: CheckSquare, color: 'text-green-400' },
    { id: 'blog', label: '博客', icon: BookOpen, color: 'text-blue-400' },
    { id: 'agents', label: t.agents, icon: Cpu, color: 'text-purple-400' },
    { id: 'settings', label: t.settings, icon: Settings, color: 'text-neutral-400' },
  ]

  const handleVerifyChain = () => {
    const result = verifyChain()
    if (result.valid) {
      alert('✅ Chronicle chain is valid and intact!')
    } else {
      alert(`❌ Chain broken at entry ${result.brokenAt}: ${result.error}`)
    }
  }

  const toggleLanguage = () => {
    setLanguage(language === 'zh' ? 'en' : 'zh')
  }

  return (
    <aside
      className={`glass-panel h-full flex flex-col transition-all duration-300 ${uiState.sidebarOpen ? 'w-64' : 'w-20'}`}
    >
      {/* Logo */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center space-x-3">
          {/* 侧边栏 Logo：使用 bornfly_logo.png，自适应大小 */}
          <img
            src="/bornfly_logo.png"
            alt="Bornfly Logo"
            className="max-w-full max-h-16 object-contain app-logo"
            style={{ maxHeight: '64px', width: 'auto', height: 'auto' }}
          />
          {uiState.sidebarOpen && (
            <div className="flex-1 flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold gradient-text">Egonetics</h1>
                <p className="text-xs text-neutral-400">{t.lifeCore}</p>
              </div>
              {/* Language Toggle Button */}
              <button
                onClick={toggleLanguage}
                className="px-3 py-1 text-xs bg-white/10 hover:bg-white/20 rounded-md transition-colors"
                title={language === 'zh' ? 'Switch to English' : '切换到中文'}
              >
                {language === 'zh' ? 'EN' : '中'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-4">
        {/* Life Core Group */}
        {uiState.sidebarOpen && (
          <div className="mb-2">
            <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
              {t.lifeCoreGroup}
            </div>
            <div className="space-y-1 ml-2">
              {lifeCoreItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setUIState({ currentView: item.id as any })}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                    uiState.currentView === item.id
                      ? 'bg-white/10 text-white'
                      : 'text-neutral-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <item.icon className={`w-5 h-5 ${item.color}`} />
                  {uiState.sidebarOpen && (
                    <div className="flex-1 text-left">
                      <div className="font-medium">{item.label}</div>
                      <div className="text-xs text-neutral-500">{item.description}</div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Other Items */}
        <div className="space-y-1">
          {otherItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setUIState({ currentView: item.id as any })}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                uiState.currentView === item.id
                  ? 'bg-white/10 text-white'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <item.icon className={`w-5 h-5 ${item.color}`} />
              {uiState.sidebarOpen && <span className="font-medium">{item.label}</span>}
            </button>
          ))}
        </div>
      </nav>

      {/* Stats & Actions */}
      <div className="p-4 border-t border-white/10 space-y-4">
        {uiState.sidebarOpen && (
          <>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-neutral-400">{t.entries}</span>
                <span className="font-mono font-bold text-primary-300">{getEntryCount()}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-neutral-400">{t.chainStatus}</span>
                <span className="font-mono text-green-400">✓ Valid</span>
              </div>
            </div>

            <button
              onClick={handleVerifyChain}
              className="w-full btn-secondary flex items-center justify-center space-x-2"
            >
              <Shield className="w-4 h-4" />
              <span>{t.verifyChain}</span>
            </button>
          </>
        )}

        <button
          onClick={() => useChronicleStore.getState().toggleSidebar()}
          className="w-full p-2 text-neutral-400 hover:text-white transition-colors"
        >
          {uiState.sidebarOpen ? t.collapse : t.expand}
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
