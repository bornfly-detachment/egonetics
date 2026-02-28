import { create } from 'zustand'
import { tasksApi, Task, TaskDetail, UpdateTaskData, CreatePropertyDefData } from '@/lib/tasks-api'
import { PropertyDef } from '@/types'

interface TasksStore {
  tasks: Task[]
  currentTaskId: string | null
  isLoading: boolean
  error: string | null
  
  // 加载数据
  loadTasks: () => Promise<void>
  loadTask: (id: string) => Promise<TaskDetail | null>
  
  // CRUD
  addTask: (name: string, icon?: string) => Promise<Task>
  updateTask: (id: string, updates: UpdateTaskData) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  
  // Current task
  setCurrentTask: (id: string | null) => void
  getCurrentTask: () => Task | null
  
  // Properties
  addPropertyDef: (taskId: string, def: Omit<PropertyDef, 'id'>) => Promise<void>
  updatePropertyDef: (taskId: string, defId: string, updates: Partial<PropertyDef>) => Promise<void>
  deletePropertyDef: (taskId: string, defId: string) => Promise<void>
  updatePropertyValue: (taskId: string, propertyName: string, value: any) => Promise<void>
  
  // Content
  updateContent: (taskId: string, content: string) => Promise<void>
  
  // 工具函数
  clearError: () => void
}

export const useTasksStore = create<TasksStore>((set, get) => ({
  tasks: [],
  currentTaskId: null,
  isLoading: false,
  error: null,
  
  loadTasks: async () => {
    set({ isLoading: true, error: null })
    try {
      const response = await tasksApi.getTasks()
      set({ tasks: response.tasks, isLoading: false })
    } catch (err: any) {
      set({ error: err.message, isLoading: false })
      console.error('加载任务失败:', err)
    }
  },
  
  loadTask: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      const taskDetail = await tasksApi.getTask(id)
      
      // 更新任务列表中的任务信息
      set((state) => ({
        tasks: state.tasks.map(t => t.id === id ? { ...t, ...taskDetail } : t),
        isLoading: false
      }))
      
      return taskDetail
    } catch (err: any) {
      set({ error: err.message, isLoading: false })
      console.error('加载任务详情失败:', err)
      return null
    }
  },
  
  addTask: async (name: string, icon = '📝') => {
    set({ isLoading: true, error: null })
    try {
      const response = await tasksApi.createTask({ name, icon })
      
      // 使用后端返回的任务对象，确保数据一致
      const newTask: Task = {
        ...response.task,
        property_count: response.task.property_count || 0,
        version_count: response.task.version_count || 0
      }
      
      set((state) => ({
        tasks: [...state.tasks, newTask],
        isLoading: false
      }))
      
      return newTask
    } catch (err: any) {
      set({ error: err.message, isLoading: false })
      console.error('创建任务失败:', err)
      throw err
    }
  },
  
  updateTask: async (id: string, updates: UpdateTaskData) => {
    set({ isLoading: true, error: null })
    try {
      await tasksApi.updateTask(id, updates)
      
      set((state) => ({
        tasks: state.tasks.map(t =>
          t.id === id
            ? { ...t, ...updates, updated_at: new Date().toISOString() }
            : t
        ),
        isLoading: false
      }))
    } catch (err: any) {
      set({ error: err.message, isLoading: false })
      console.error('更新任务失败:', err)
      throw err
    }
  },
  
  deleteTask: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      await tasksApi.deleteTask(id)
      
      set((state) => ({
        tasks: state.tasks.filter(t => t.id !== id),
        currentTaskId: state.currentTaskId === id ? null : state.currentTaskId,
        isLoading: false
      }))
    } catch (err: any) {
      set({ error: err.message, isLoading: false })
      console.error('删除任务失败:', err)
      throw err
    }
  },
  
  setCurrentTask: (id) => {
    set({ currentTaskId: id })
  },
  
  getCurrentTask: () => {
    const { tasks, currentTaskId } = get()
    return tasks.find(t => t.id === currentTaskId) || null
  },
  
  addPropertyDef: async (taskId: string, def: Omit<PropertyDef, 'id'>) => {
    set({ isLoading: true, error: null })
    try {
      const data: CreatePropertyDefData = {
        name: def.name,
        type: def.type,
        options: def.options
      }
      
      await tasksApi.addPropertyDef(taskId, data)
      
      // 更新本地状态
      set((state) => ({
        tasks: state.tasks.map(t =>
          t.id === taskId
            ? {
                ...t,
                property_count: (t.property_count || 0) + 1,
                updated_at: new Date().toISOString()
              }
            : t
        ),
        isLoading: false
      }))
      
      // 重新加载任务详情以获取最新的属性定义
      await get().loadTask(taskId)
    } catch (err: any) {
      set({ error: err.message, isLoading: false })
      console.error('添加属性定义失败:', err)
      throw err
    }
  },
  
  updatePropertyDef: async (_taskId: string, _defId: string, _updates: Partial<PropertyDef>) => {
    // 注意：后端API目前不支持直接更新属性定义
    // 这里先实现一个占位，实际需要调用对应的API
    set({ error: '更新属性定义功能暂未实现', isLoading: false })
    throw new Error('更新属性定义功能暂未实现')
  },
  
  deletePropertyDef: async (_taskId: string, _defId: string) => {
    // 注意：后端API目前不支持直接删除属性定义
    // 这里先实现一个占位，实际需要调用对应的API
    set({ error: '删除属性定义功能暂未实现', isLoading: false })
    throw new Error('删除属性定义功能暂未实现')
  },
  
  updatePropertyValue: async (taskId: string, propertyName: string, value: any) => {
    set({ isLoading: true, error: null })
    try {
      await tasksApi.updatePropertyValue(taskId, propertyName, value)
      
      // 更新本地状态
      set((state) => ({
        tasks: state.tasks.map(t =>
          t.id === taskId
            ? { ...t, updated_at: new Date().toISOString() }
            : t
        ),
        isLoading: false
      }))
    } catch (err: any) {
      set({ error: err.message, isLoading: false })
      console.error('更新属性值失败:', err)
      throw err
    }
  },
  
  updateContent: async (taskId: string, content: string) => {
    set({ isLoading: true, error: null })
    try {
      await tasksApi.updateTask(taskId, { content })
      
      set((state) => ({
        tasks: state.tasks.map(t =>
          t.id === taskId
            ? { ...t, content, content_plain: content.replace(/<[^>]*>/g, ''), updated_at: new Date().toISOString() }
            : t
        ),
        isLoading: false
      }))
    } catch (err: any) {
      set({ error: err.message, isLoading: false })
      console.error('更新内容失败:', err)
      throw err
    }
  },
  
  clearError: () => {
    set({ error: null })
  }
}))
