import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import PageLayout from './PageLayout'
import PageManager from './PageManager'
import { createApiClient } from './apiClient'
import type { ApiClient, PageMeta, Block, CreatePageInput } from './types'
import { getToken, removeToken } from '@/lib/http'

const KANBAN_API_BASE = '/api'

// Task 类型定义
interface Task {
  id: string
  name: string
  icon: string
  assignee?: string
  startDate?: string
  dueDate?: string
  project?: string
  projectIcon?: string
  status: string
  priority: string
  sortOrder: number
  tags?: string[]
  pageId?: string
  created_at: string
  updated_at: string
}

// 获取单个 task
async function fetchTask(taskId: string): Promise<Task | null> {
  try {
    const token = getToken()
    const res = await fetch(`${KANBAN_API_BASE}/kanban/tasks/${taskId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    if (res.status === 401) {
      removeToken()
      window.location.href = '/login'
      return null
    }
    if (!res.ok) return null
    return await res.json()
  } catch (e) {
    console.error('Fetch task failed:', e)
    return null
  }
}

// 为 Task 系统定制的 API 客户端
function createTaskApiClient(taskId: string, taskName: string, taskIcon: string): ApiClient {
  const baseClient = createApiClient('task', taskId)
  const storageKey = `task-page-${taskId}`

  async function getOrCreateTaskPage(): Promise<PageMeta> {
    const storedPageId = localStorage.getItem(storageKey)

    if (storedPageId) {
      try {
        const pages = await baseClient.listPages()
        const existingPage = pages.find((p) => p.id === storedPageId)
        if (existingPage) {
          if (existingPage.title !== taskName || existingPage.icon !== taskIcon) {
            return await baseClient.updatePage(storedPageId, { title: taskName, icon: taskIcon })
          }
          return existingPage
        }
      } catch (e) {
        console.log('Page not found, creating new one')
      }
    }

    const newPage = await baseClient.createPage({
      parentId: null,
      pageType: 'task',
      refId: taskId,
      title: taskName,
      icon: taskIcon,
      position: 1,
    })

    localStorage.setItem(storageKey, newPage.id)
    return newPage
  }

  return {
    async listPages() {
      const page = await getOrCreateTaskPage()
      return [page]
    },

    async createPage(input: CreatePageInput) {
      const page = await baseClient.createPage({
        ...input,
        parentId: input.parentId || (await getOrCreateTaskPage()).id,
      })
      return page
    },

    async updatePage(id: string, patch) {
      const updated = await baseClient.updatePage(id, patch)
      return updated
    },

    async deletePage(id: string) {
      await baseClient.deletePage(id)
      const storedPageId = localStorage.getItem(storageKey)
      if (storedPageId === id) {
        localStorage.removeItem(storageKey)
      }
    },

    async movePage(id: string, input) {
      const updated = await baseClient.movePage(id, input)
      return updated
    },

    async listBlocks(pageId: string) {
      const blocks = await baseClient.listBlocks(pageId)
      return blocks
    },

    async saveBlocks(pageId: string, blocks: Block[]) {
      const saved = await baseClient.saveBlocks(pageId, blocks)
      return saved
    },
  }
}

const NotionPageView: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const [task, setTask] = useState<Task | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // 加载 task 数据
  useEffect(() => {
    if (!taskId) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    fetchTask(taskId).then((taskData) => {
      setTask(taskData)
      setIsLoading(false)
    })
  }, [taskId])

  // 创建定制的 API 客户端
  const taskApiClient = useMemo(() => {
    if (!task) return null
    return createTaskApiClient(task.id, task.name, task.icon)
  }, [task])

  const handleBack = useCallback(() => {
    navigate('/tasks')
  }, [navigate])

  if (!isLoading && !task) {
    return (
      <PageLayout title="任务不存在" showBack onBack={handleBack}>
        <div className="p-8 text-center">
          <p className="text-neutral-400 mb-4">任务不存在或已被删除</p>
          <button
            onClick={handleBack}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
          >
            返回任务列表
          </button>
        </div>
      </PageLayout>
    )
  }

  if (isLoading || !taskApiClient) {
    return (
      <PageLayout title={task?.name || '加载中...'} icon={task?.icon} showBack onBack={handleBack}>
        <div className="p-8 text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-400">加载页面...</p>
        </div>
      </PageLayout>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-[#191919]">
      {/* 顶部导航栏 */}
      <div className="h-14 bg-[#1a1a1a] border-b border-white/5 flex items-center px-4 shrink-0">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span className="text-sm">返回任务列表</span>
        </button>
        <div className="flex-1" />
        <div className="flex items-center gap-2 text-neutral-500 text-sm">
          <span>{task?.icon}</span>
          <span>{task?.name}</span>
        </div>
      </div>

      {/* PageManager 内容区 */}
      <div className="flex-1 overflow-hidden">
        <PageManager api={taskApiClient} />
      </div>
    </div>
  )
}

export default NotionPageView
