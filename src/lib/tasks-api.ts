import { PropertyDef, PropertyType } from '@/types'

const API_BASE = '/api'

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `HTTP ${response.status}`);
  }
  
  return response.json();
}

// 从数据库类型转换为前端类型
export interface Task {
  id: string;
  name: string;
  icon: string;
  content: string;
  content_plain: string;
  created_at: string;
  updated_at: string;
  property_count?: number;
  version_count?: number;
  properties?: Record<string, any>;
  propertyDefs?: PropertyDef[];
}

export interface TaskDetail extends Task {
  properties: Record<string, any>;
  propertyDefs: PropertyDef[];
}

export interface CreateTaskData {
  name: string;
  icon?: string;
  content?: string;
}

export interface UpdateTaskData {
  name?: string;
  icon?: string;
  content?: string;
}

export interface CreatePropertyDefData {
  name: string;
  type: PropertyType;
  options?: string[];
}

// Tasks API
export const tasksApi = {
  // 获取所有任务
  getTasks: () => fetchApi<{ tasks: Task[] }>('/tasks'),
  
  // 获取单个任务详情
  getTask: (id: string) => fetchApi<TaskDetail>(`/tasks/${id}`),
  
  // 创建新任务
  createTask: (data: CreateTaskData) => 
    fetchApi<{ success: boolean; id: string; task: Task }>('/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  // 更新任务
  updateTask: (id: string, data: UpdateTaskData) =>
    fetchApi<{ success: boolean; updated_at: string }>(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  // 删除任务
  deleteTask: (id: string) =>
    fetchApi<{ success: boolean }>(`/tasks/${id}`, {
      method: 'DELETE',
    }),
  
  // 添加属性定义
  addPropertyDef: (taskId: string, data: CreatePropertyDefData) =>
    fetchApi<{ success: boolean; id: string }>(`/tasks/${taskId}/properties/definitions`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  // 更新属性值
  updatePropertyValue: (taskId: string, propertyName: string, value: any) =>
    fetchApi<{ success: boolean }>(`/tasks/${taskId}/properties/${encodeURIComponent(propertyName)}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    }),
  
  // 保存版本（链式存储）
  saveVersion: (taskId: string, content: string, previousHash?: string) =>
    fetchApi<{ success: boolean; hash: string; id: number }>(`/tasks/${taskId}/versions`, {
      method: 'POST',
      body: JSON.stringify({ content, previousHash }),
    }),
  
  // 获取版本历史
  getVersions: (taskId: string) =>
    fetchApi<{ versions: any[] }>(`/tasks/${taskId}/versions`),
};
