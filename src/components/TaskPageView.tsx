import React, { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import PageManager from './PageManager'
import { createApiClient } from './apiClient'
import type { ApiClient, PageMeta } from './types'
import { getToken, removeToken } from '@/lib/http'

const KANBAN_API_BASE = '/api'

// 创建 Task 专属的 API 客户端
function createTaskPageApiClient(taskId: string): ApiClient {
  // 使用带过滤的 baseClient，会自动添加 type=task&refId=taskId 参数
  const baseClient = createApiClient('task', taskId)

  return {
    async listPages(): Promise<PageMeta[]> {
      // 从主 server 获取与该 task 关联的 pages
      // baseClient 会自动添加 ?type=task&refId=taskId 参数
      return baseClient.listPages()
    },

    async createPage(input) {
      return baseClient.createPage(input)
    },

    async updatePage(id, patch) {
      return baseClient.updatePage(id, patch)
    },

    async deletePage(id) {
      return baseClient.deletePage(id)
    },

    async movePage(id, input) {
      return baseClient.movePage(id, input)
    },

    async listBlocks(pageId) {
      return baseClient.listBlocks(pageId)
    },

    async saveBlocks(pageId, blocks) {
      return baseClient.saveBlocks(pageId, blocks)
    },
  }
}

const TaskPageView: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const [taskName, setTaskName] = useState<string>('任务详情')
  const [isLoading, setIsLoading] = useState(true)

  // 获取 task 信息
  useEffect(() => {
    if (!taskId) return

    fetch(`${KANBAN_API_BASE}/kanban/tasks/${taskId}`, {
      headers: {
        Authorization: `Bearer ${getToken() || ''}`
      }
    })
      .then((res) => {
        if (res.status === 401) {
          removeToken()
          window.location.href = '/login'
          throw new Error('Unauthorized')
        }
        return res.json()
      })
      .then((data) => {
        if (data.name) {
          setTaskName(data.name)
        }
        setIsLoading(false)
      })
      .catch(() => {
        setIsLoading(false)
      })
  }, [taskId])

  // 创建 API 客户端 - 使用 useMemo 避免每次渲染重新创建
  const apiClient = useMemo(() => {
    return taskId ? createTaskPageApiClient(taskId) : null
  }, [taskId])

  if (!taskId || !apiClient) {
    return (
      <div className="h-screen flex flex-col bg-[#191919]">
        <div className="h-14 bg-[#1a1a1a] border-b border-white/5 flex items-center px-4 shrink-0">
          <button
            onClick={() => navigate('/tasks')}
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
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-neutral-400">无效的任务 ID</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-[#191919]">
      {/* 顶部导航栏 */}
      <div className="h-14 bg-[#1a1a1a] border-b border-white/5 flex items-center px-4 shrink-0">
        <button
          onClick={() => navigate('/tasks')}
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
          <span>📝</span>
          <span>{isLoading ? '加载中...' : taskName}</span>
        </div>
      </div>

      {/* PageManager 内容区 */}
      <div className="flex-1 overflow-hidden">
        <PageManager api={apiClient} />
      </div>
    </div>
  )
}

export default TaskPageView
