/**
 * apiClient.ts
 *
 * 创建类型化的 API 客户端
 * 支持 'task', 'chronicle' 等页面类型
 *
 * 使用示例：
 *   const apiClient = createApiClient('task')
 *   const task = await apiClient.fetchOne(taskId)
 *   await apiClient.save(taskData)
 */

import { getToken, removeToken } from '@/lib/http'

const API_BASE = '/api'

function authHeaders(): Record<string, string> {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function handle401(res: Response) {
  if (res.status === 401) { removeToken(); window.location.href = '/login' }
}

export interface PageData {
  id: string
  type: string
  [key: string]: any
}

export interface ApiClient {
  fetchOne: (id: string) => Promise<PageData | null>
  fetchList: (filter?: Record<string, any>) => Promise<PageData[]>
  save: (data: PageData) => Promise<PageData>
  delete: (id: string) => Promise<void>
}

/**
 * 创建类型化的 API 客户端
 * @param pageType - 页面类型，如 'task', 'chronicle'
 * @returns API 客户端实例
 */
export function createApiClient(pageType: string): ApiClient {
  // Task 类型使用 kanban API，其他类型使用标准 API
  const endpoint = pageType === 'task' ? `${API_BASE}/kanban/tasks` : `${API_BASE}/${pageType}s`

  return {
    /**
     * 获取单个数据
     */
    async fetchOne(id: string): Promise<PageData | null> {
      try {
        const res = await fetch(`${endpoint}/${id}`, { headers: authHeaders() })
        handle401(res)
        if (!res.ok) return null
        return await res.json()
      } catch (error) {
        console.error(`Failed to fetch ${pageType}:`, error)
        return null
      }
    },

    /**
     * 获取列表数据
     */
    async fetchList(filter?: Record<string, any>): Promise<PageData[]> {
      try {
        // Task 类型使用 /kanban 端点获取所有数据
        if (pageType === 'task') {
          const res = await fetch(`${API_BASE}/kanban`, { headers: authHeaders() })
          handle401(res)
          if (!res.ok) return []
          const data = await res.json()
          return data.tasks ?? []
        }

        const url = new URL(endpoint)
        if (filter) {
          Object.entries(filter).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              url.searchParams.append(key, String(value))
            }
          })
        }
        const res = await fetch(url.toString(), { headers: authHeaders() })
        handle401(res)
        if (!res.ok) return []
        const data = await res.json()
        return Array.isArray(data) ? data : (data.data ?? [])
      } catch (error) {
        console.error(`Failed to fetch ${pageType} list:`, error)
        return []
      }
    },

    /**
     * 保存数据（创建或更新）
     */
    async save(data: PageData): Promise<PageData> {
      try {
        const method = data.id ? 'PUT' : 'POST'
        const url = data.id ? `${endpoint}/${data.id}` : endpoint
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify(data),
        })
        if (!res.ok) throw new Error(`Save failed: ${res.statusText}`)
        return await res.json()
      } catch (error) {
        console.error(`Failed to save ${pageType}:`, error)
        throw error
      }
    },

    /**
     * 删除数据
     */
    async delete(id: string): Promise<void> {
      try {
        const res = await fetch(`${endpoint}/${id}`, { method: 'DELETE', headers: authHeaders() })
        if (!res.ok) throw new Error(`Delete failed: ${res.statusText}`)
      } catch (error) {
        console.error(`Failed to delete ${pageType}:`, error)
        throw error
      }
    },
  }
}

/**
 * 便捷函数：创建 Task API 客户端
 */
export function createTaskApiClient(): ApiClient {
  return createApiClient('task')
}
