import React, { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import MemoryView from './components/MemoryView'
import TheoryView from './components/TheoryView'
import ChronicleView from './components/ChronicleView'
import EgoneticsView from './components/EgoneticsView'
import KanbanBoard from './components/taskBoard/KanbanBoard'
import TaskDetailPage from './components/taskBoard/TaskDetailPage'
import ChroniclePageView from './components/ChroniclePageView'
import TheoryPageView from './components/TheoryPageView'
import BlogEditor from './components/BlogEditor'
import NotionStyleEditor from './components/NotionStyleEditor'
import NewNotionStyleEditor from './components/NewNotionStyleEditor'
import BlogPage from './components/BlogPage'
import { useChronicleStore } from './stores/useChronicleStore'

// 路由同步组件 - 将 URL 同步到 Zustand store
const RouteSync: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { uiState, setUIState } = useChronicleStore()

  // URL -> Store 同步
  useEffect(() => {
    const path = location.pathname
    
    let view: string
    let taskId: string | null = null

    if (path === '/' || path === '/memory') {
      view = 'memory'
    } else if (path === '/theory') {
      view = 'theory'
    } else if (path === '/chronicle') {
      view = 'chronicle'
    } else if (path === '/egonetics') {
      view = 'egonetics'
    } else if (path === '/tasks') {
      view = 'tasks'
    } else if (path.startsWith('/tasks/')) {
      view = 'project-detail'
      taskId = path.replace('/tasks/', '')
    } else if (path === '/blog') {
      view = 'blog'
    } else if (path === '/editor1') {
      view = 'editor1'
    } else if (path === '/editor2') {
      view = 'editor2'
    } else if (path === '/agents') {
      view = 'agents'
    } else if (path === '/settings') {
      view = 'settings'
    } else {
      view = 'memory'
    }

    setUIState({ 
      currentView: view as any,
      currentTaskId: taskId
    })
  }, [location.pathname, setUIState])

  // Store -> URL 同步（当 store 变化时导航）
  useEffect(() => {
    if (!uiState) return

    let targetPath = '/'

    switch (uiState.currentView) {
      case 'memory':
        targetPath = '/memory'
        break
      case 'theory':
        targetPath = '/theory'
        break
      case 'chronicle':
        targetPath = '/chronicle'
        break
      case 'egonetics':
        targetPath = '/egonetics'
        break
      case 'tasks':
        targetPath = '/tasks'
        break
      case 'project-detail':
        if (uiState.currentTaskId) {
          targetPath = `/tasks/${uiState.currentTaskId}`
        } else {
          targetPath = '/tasks'
        }
        break
      case 'blog':
        targetPath = '/blog'
        break
      case 'editor1':
        targetPath = '/editor1'
        break
      case 'editor2':
        targetPath = '/editor2'
        break
      case 'agents':
        targetPath = '/agents'
        break
      case 'settings':
        targetPath = '/settings'
        break
      default:
        targetPath = '/memory'
    }

    if (location.pathname !== targetPath) {
      navigate(targetPath, { replace: true })
    }
  }, [uiState, location.pathname, navigate])

  return null
}

// 页面组件
const AgentsPage: React.FC = () => {
  return (
    <div className="p-8 text-center">
      <h1 className="text-3xl font-bold gradient-text mb-4">
        代理界面
      </h1>
      <p className="text-neutral-400">
        代理管理界面即将推出...
      </p>
    </div>
  )
}

const SettingsPage: React.FC = () => {
  return (
    <div className="p-8 text-center">
      <h1 className="text-3xl font-bold gradient-text mb-4">
        设置
      </h1>
      <p className="text-neutral-400">
        系统配置即将推出...
      </p>
    </div>
  )
}

// 主应用内容
const AppContent: React.FC = () => {
  const { uiState, initialize } = useChronicleStore()

  useEffect(() => {
    console.log('Egonetics App initializing...')
    initialize()
    console.log('UI State:', uiState)
  }, [initialize])

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-900 via-neutral-900 to-neutral-950">
      <div className="flex h-screen">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {!uiState ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-neutral-400">
                  初始化生命主体性...
                </p>
              </div>
            </div>
          ) : (
            <Routes>
              <Route path="/" element={<Navigate to="/memory" replace />} />
              <Route path="/memory" element={<MemoryView />} />
              <Route path="/theory" element={<TheoryPageView />} />
              <Route path="/chronicle" element={<ChroniclePageView />} />
              <Route path="/egonetics" element={<EgoneticsView />} />
              <Route path="/tasks" element={<KanbanBoard />} />
              <Route path="/tasks/:taskId" element={<TaskDetailPage />} />
              <Route path="/blog" element={<BlogPage />} />
              <Route path="/old-blog" element={<BlogEditor />} />
              <Route path="/editor1" element={<NewNotionStyleEditor />} />
              <Route path="/editor2" element={<NotionStyleEditor />} />
              <Route path="/agents" element={<AgentsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/memory" replace />} />
            </Routes>
          )}
        </main>
      </div>

      {/* Status Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/50 backdrop-blur-lg border-t border-white/10 p-3">
        <div className="container mx-auto flex items-center justify-between text-sm">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-neutral-300">
                生命主体性: 活跃
              </span>
            </div>
            <div className="text-neutral-500">|</div>
            <div className="text-neutral-400">
              Egonetics v0.1 · Bornfly Theory
            </div>
          </div>
          <div className="text-neutral-500">
            {new Date().toLocaleDateString('zh-CN', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// 根 App 组件
function App() {
  return (
    <Router>
      <RouteSync />
      <AppContent />
    </Router>
  )
}

export default App