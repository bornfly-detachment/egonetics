import React, { useEffect, useRef, useState } from 'react'
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import Sidebar from './components/Sidebar'
import MemoryView from './components/MemoryView'
import EgoneticsView from './components/EgoneticsView'
import EgoneticsSubjectPage from './components/EgoneticsSubjectPage'
import CanvasView from './components/CanvasView'
import RelationDetailView from './components/RelationDetailView'
import KanbanBoard from './components/taskBoard/KanbanBoard'
import TaskDetailPage from './components/taskBoard/TaskDetailPage'
import ChronicleView from './components/ChronicleView'
import AgentsView from './components/AgentsView'
import TheoryPageView from './components/TheoryPageView'
import CyberneticsSystemView from './components/CyberneticsSystemView'
import TagTreeView from './components/TagTreeView'
import BlogPage from './components/BlogPage'
import HomeView from './components/HomeView'
import QueueView from './components/QueueView'
import ControllerView from './components/ControllerView'
import ProtocolView from './components/ProtocolView'
import ProtocolBuilderView from './components/ProtocolBuilderView'
import LabView from './components/LabView'
import RecycleBinView from './components/RecycleBinView'
import PrvseWorldView from './components/prvse-world/PrvseWorldView'
import MQView from './components/MQView'
import { TokenProvider } from './design/TokenProvider'
import LoginPage from './components/LoginPage'
import LLMChatDialog from './components/LLMChatDialog'
import { useChronicleStore } from './stores/useChronicleStore'
import { useAuthStore } from './stores/useAuthStore'
import { isPathAllowed } from './components/AuthGuard'
import CommandPalette from './components/CommandPalette'
import SlashCommandMenu from './components/SlashCommandMenu'
import SpherePalette from './components/SpherePalette'

// 路由同步组件 - 将 URL 同步到 Zustand store
const RouteSync: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { uiState, setUIState } = useChronicleStore()
  // Tracks whether the URL just changed externally (navigate() call or back button).
  // Prevents Effect 2 (Store→URL) from navigating back with stale store state.
  const urlJustChangedRef = useRef(false)

  // URL -> Store 同步
  useEffect(() => {
    urlJustChangedRef.current = true
    const path = location.pathname

    let view: string
    let taskId: string | null = null

    if (path === '/') {
      view = 'home'
    } else if (path === '/home') {
      view = 'home'
    } else if (path === '/memory') {
      view = 'memory'
    } else if (path === '/theory') {
      view = 'theory'
    } else if (path === '/chronicle') {
      view = 'chronicle'
    } else if (path === '/egonetics') {
      view = 'egonetics'
    } else if (path.startsWith('/egonetics/')) {
      view = 'egonetics-detail'
    } else if (path === '/tasks') {
      view = 'tasks'
    } else if (path.startsWith('/tasks/')) {
      view = 'project-detail'
      taskId = path.replace('/tasks/', '')
    } else if (path === '/blog') {
      view = 'blog'
    } else if (path === '/agents') {
      view = 'agents'
    } else if (path === '/cybernetics') {
      view = 'cybernetics'
    } else if (path === '/tag-tree') {
      view = 'tag-tree'
    } else if (path === '/queue') {
      view = 'queue'
    } else if (path === '/controller') {
      view = 'controller'
    } else if (path === '/protocol') {
      view = 'protocol'
    } else if (path === '/protocol/builder') {
      view = 'protocol-builder'
    } else if (path === '/lab') {
      view = 'lab'
    } else if (path === '/mq') {
      view = 'mq'
    } else if (path === '/recycle') {
      view = 'recycle'
    } else if (path === '/prvse-world') {
      view = 'prvse-world'
    } else if (path === '/free-code') {
      view = 'free-code'
    } else {
      view = 'memory'
    }

    setUIState({
      currentView: view as any,
      currentTaskId: taskId,
    })
  }, [location.pathname, setUIState])

  // Store -> URL 同步（当 store 变化时导航）
  useEffect(() => {
    // If the URL just changed (Effect 1 just ran), skip — the store update is stale.
    // Effect 1's setUIState will trigger another render where this runs with fresh state.
    if (urlJustChangedRef.current) {
      urlJustChangedRef.current = false
      return
    }
    if (!uiState) return

    let targetPath = '/'

    switch (uiState.currentView) {
      case 'home':
        targetPath = '/home'
        break
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
      case 'egonetics-detail':
        // keep current URL — detail page manages its own navigation
        targetPath = location.pathname
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
      case 'agents':
        targetPath = '/agents'
        break
      case 'cybernetics':
        targetPath = '/cybernetics'
        break
      case 'tag-tree':
        targetPath = '/tag-tree'
        break
      case 'queue':
        targetPath = '/queue'
        break
      case 'controller':
        targetPath = '/controller'
        break
      case 'protocol':
        targetPath = '/protocol'
        break
      case 'protocol-builder':
        targetPath = '/protocol/builder'
        break
      case 'lab':
        targetPath = '/lab'
        break
      case 'mq':
        targetPath = '/mq'
        break
      case 'recycle':
        targetPath = '/recycle'
        break
      case 'prvse-world':
        targetPath = '/prvse-world'
        break
      case 'free-code':
        targetPath = '/free-code'
        break
      default:
        targetPath = '/memory'
    }

    if (location.pathname !== targetPath) {
      // Guard: don't navigate back when current URL is a valid sub-route of the target.
      // e.g. uiState still says 'tasks' (stale) while URL is already '/tasks/xxx' —
      // Effect 1 (URL→Store) will update the store in the same cycle, so skip.
      if (location.pathname.startsWith(targetPath + '/')) return
      navigate(targetPath, { replace: true })
    }
  }, [uiState, location.pathname, navigate])

  return null
}

// 主应用内容
const AppContent: React.FC = () => {
  const { uiState, initialize } = useChronicleStore()
  const [chatOpen, setChatOpen] = useState(false)

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
                <p className="text-neutral-400">初始化生命主体性...</p>
              </div>
            </div>
          ) : (
            <Routes>
              <Route path="/" element={<Navigate to="/home" replace />} />
              <Route path="/home" element={<HomeView />} />
              <Route path="/memory" element={<MemoryView />} />
              <Route path="/theory" element={<TheoryPageView />} />
              <Route path="/chronicle" element={<ChronicleView />} />
              <Route path="/egonetics" element={<EgoneticsView />} />
              <Route path="/egonetics/canvas/:canvasId" element={<CanvasView />} />
              <Route path="/egonetics/:subjectId" element={<EgoneticsSubjectPage />} />
              <Route path="/relations/:relationId" element={<RelationDetailView />} />
              <Route path="/tasks" element={<KanbanBoard />} />
              <Route path="/tasks/:taskId" element={<TaskDetailPage />} />
              <Route path="/blog" element={<BlogPage />} />
              {/* <Route path="/old-blog" element={<BlogEditor />} /> */}
              {/* <Route path="/editor1" element={<NewNotionStyleEditor />} /> */}
              {/* <Route path="/editor2" element={<NotionStyleEditor />} /> */}
              <Route path="/agents" element={<AgentsView />} />
              <Route path="/cybernetics" element={<CyberneticsSystemView />} />
              <Route path="/tag-tree" element={<TagTreeView />} />
              <Route path="/queue" element={<QueueView />} />
              <Route path="/controller" element={<ControllerView />} />
              <Route path="/protocol" element={<ProtocolView />} />
              <Route path="/protocol/builder" element={<ProtocolBuilderView />} />
              <Route path="/lab" element={<LabView />} />
              <Route path="/mq" element={<div className="-m-6 w-[calc(100%+3rem)] h-[calc(100vh-3rem)]"><MQView /></div>} />
              <Route path="/recycle" element={<RecycleBinView />} />
              <Route path="/prvse-world" element={<div className="-m-6 w-[calc(100%+3rem)] h-[calc(100vh-3rem)]"><PrvseWorldView /></div>} />
              <Route path="*" element={<Navigate to="/home" replace />} />
            </Routes>
          )}
        </main>
      </div>

      {/* Global LLM Chat */}
      <button
        onClick={() => setChatOpen(v => !v)}
        className="fixed bottom-14 right-5 z-40 w-10 h-10 rounded-full flex items-center justify-center bg-violet-600/25 border border-violet-500/40 text-violet-400 hover:bg-violet-600/40 shadow-lg shadow-violet-900/30 transition-all"
        title="AI 对话助手"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </button>
      <LLMChatDialog open={chatOpen} onClose={() => setChatOpen(false)} title="AI 助手" />

      {/* Status Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/50 backdrop-blur-lg border-t border-white/10 p-3">
        <div className="container mx-auto flex items-center justify-between text-sm">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-neutral-300">生命主体性: 活跃</span>
            </div>
            <div className="text-neutral-500">|</div>
            <div className="text-neutral-400">Egonetics v0.1 · Bornfly Theory</div>
          </div>
          <div className="text-neutral-500">
            {new Date().toLocaleDateString('zh-CN', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// Auth + routing root (must be inside Router for useLocation)
const AppRoot: React.FC = () => {
  const location = useLocation()
  const { isInitialized, user } = useAuthStore()

  useEffect(() => {
    useAuthStore.getState().initialize()
  }, [])

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Login page
  if (location.pathname === '/login') {
    return user ? <Navigate to="/home" replace /> : <LoginPage />
  }

  // Not authenticated → go to login
  if (!user) return <Navigate to="/login" replace />

  // Role-based path guard
  if (!isPathAllowed(location.pathname, user.role)) {
    return <Navigate to="/home" replace />
  }

  return (
    <>
      <RouteSync />
      <AppContent />
      <CommandPalette />
      <SlashCommandMenu />
      <SpherePalette />
    </>
  )
}

// 根 App 组件
function App() {
  return (
    <TokenProvider>
      <Router>
        <AppRoot />
      </Router>
    </TokenProvider>
  )
}

export default App
