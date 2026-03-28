import { PropertyDef, PropertyType } from '@/types'
import { authFetch } from '@/lib/http'

// 从数据库类型转换为前端类型
export interface Task {
  id: string
  name: string
  icon: string
  content: string
  content_plain: string
  created_at: string
  updated_at: string
  property_count?: number
  version_count?: number
  properties?: Record<string, any>
  propertyDefs?: PropertyDef[]
}

export interface TaskDetail extends Task {
  properties: Record<string, any>
  propertyDefs: PropertyDef[]
}

export interface CreateTaskData {
  name: string
  icon?: string
  content?: string
}

export interface UpdateTaskData {
  name?: string
  icon?: string
  content?: string
}

export interface CreatePropertyDefData {
  name: string
  type: PropertyType
  options?: string[]
}

// Tasks API
export const tasksApi = {
  // 获取所有任务
  getTasks: () => authFetch<{ tasks: Task[] }>('/tasks'),

  // 获取单个任务详情
  getTask: (id: string) => authFetch<TaskDetail>(`/tasks/${id}`),

  // 创建新任务
  createTask: (data: CreateTaskData) =>
    authFetch<{ success: boolean; id: string; task: Task }>('/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // 更新任务
  updateTask: (id: string, data: UpdateTaskData) =>
    authFetch<{ success: boolean; updated_at: string }>(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // 删除任务
  deleteTask: (id: string) =>
    authFetch<{ success: boolean }>(`/tasks/${id}`, {
      method: 'DELETE',
    }),

  // 添加属性定义
  addPropertyDef: (taskId: string, data: CreatePropertyDefData) =>
    authFetch<{ success: boolean; id: string }>(`/tasks/${taskId}/properties/definitions`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // 更新属性值
  updatePropertyValue: (taskId: string, propertyName: string, value: any) =>
    authFetch<{ success: boolean }>(
      `/tasks/${taskId}/properties/${encodeURIComponent(propertyName)}`,
      {
        method: 'PUT',
        body: JSON.stringify({ value }),
      }
    ),

  // 保存版本（链式存储）
  saveVersion: (taskId: string, content: string, previousHash?: string) =>
    authFetch<{ success: boolean; hash: string; id: number }>(`/tasks/${taskId}/versions`, {
      method: 'POST',
      body: JSON.stringify({ content, previousHash }),
    }),

  // 获取版本历史
  getVersions: (taskId: string) => authFetch<{ versions: any[] }>(`/tasks/${taskId}/versions`),

  // ========== Notion Blocks API ==========

  // 获取页面的所有块
  getBlocks: (pageId: string) => authFetch<{ blocks: any[] }>(`/notion/pages/${pageId}/blocks`),

  // 获取块的子块
  getBlockChildren: (blockId: string) =>
    authFetch<{ blocks: any[] }>(`/notion/blocks/${blockId}/children`),

  // 创建新块
  createBlock: (data: {
    pageId: string
    parentId?: string | null
    type?: string
    content?: string
    position?: number
  }) =>
    authFetch<{ success: boolean; id: string }>('/notion/blocks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // 更新块
  updateBlock: (
    blockId: string,
    data: {
      type?: string
      content?: string
      position?: number
    }
  ) =>
    authFetch<{ success: boolean }>(`/notion/blocks/${blockId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // 删除块（级联删除子块）
  deleteBlock: (blockId: string) =>
    authFetch<{ success: boolean }>(`/notion/blocks/${blockId}`, {
      method: 'DELETE',
    }),

  // 批量操作块（支持事务）
  batchBlockOperations: (
    operations: Array<{
      type: 'create' | 'update' | 'delete'
      pageId?: string
      blockId?: string
      parentId?: string | null
      blockType?: string
      content?: string
      position?: number
    }>
  ) =>
    authFetch<{ success: boolean }>('/notion/blocks/operations', {
      method: 'POST',
      body: JSON.stringify({ operations }),
    }),
}

// ── Kanban API ──────────────────────────────────────────────
export const kanbanApi = {
  getBoard: () => authFetch<{ tasks: Task[] }>('/kanban'),
  getTask: (id: string) => authFetch<Task>(`/kanban/tasks/${id}`),
  updateTask: (id: string, data: Partial<Task>) =>
    authFetch<Task>(`/kanban/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTask: (id: string) =>
    authFetch<{ ok: boolean }>(`/kanban/tasks/${id}`, { method: 'DELETE' }),
  sendToChronicle: (taskId: string, data: { summary?: string; outcome?: string }) =>
    authFetch<{ ok: boolean }>(`/tasks/${taskId}/send-to-chronicle`, {
      method: 'POST', body: JSON.stringify(data),
    }),
}
