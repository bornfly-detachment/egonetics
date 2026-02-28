import React, { useState, useEffect, useCallback } from 'react'
import { 
  Plus, MoreHorizontal, Pencil, Trash2, FileText, Sparkles, 
  Clock, CheckCircle2, XCircle, Loader2, GripVertical 
} from 'lucide-react'
import { useDrag, useDrop } from 'react-dnd'
import { useTasksStore } from '@/stores/useTasksStore'
import { useChronicleStore } from '@/stores/useChronicleStore'
import PageLayout from './PageLayout'
import { useTranslation } from '@/lib/translations'

// Notion-style emoji picker
const EMOJI_LIST = ['📝', '🧠', '💡', '🚀', '⚡', '🎯', '📚', '🔧', '🎨', '💻', '🌟', '✨', '🔥', '💪', '🎮', '🎵', '📋', '💼', '🏠', '❤️', '🌈', '🦄', '🌙', '⚙️', '🔬', '🎭', '📊', '🗂️', '📈', '🔍']

// 看板列定义
const KANBAN_COLUMNS = [
  { id: 'planned', label: '计划', icon: Clock, color: 'bg-blue-500' },
  { id: 'in-progress', label: '执行中', icon: Loader2, color: 'bg-yellow-500' },
  { id: 'failed', label: '失败', icon: XCircle, color: 'bg-red-500' },
  { id: 'queued', label: '排队', icon: CheckCircle2, color: 'bg-green-500' }
] as const

// 任务状态类型
type TaskStatus = typeof KANBAN_COLUMNS[number]['id']

// 任务优先级
type TaskPriority = 'high' | 'medium' | 'low'

interface TaskWithStatus {
  id: string
  name: string
  icon: string
  content?: string
  content_plain?: string
  created_at: string
  updated_at: string
  property_count?: number
  version_count?: number
  status: TaskStatus  // 看板状态
  priority: TaskPriority  // 优先级
}

// 拖放项类型
const ItemTypes = {
  TASK: 'task'
}

// 拖放项接口
interface DragItem {
  id: string
  type: string
  status: TaskStatus
  index: number
}

// 可拖动的任务卡片组件
const DraggableTaskCard: React.FC<{
  task: TaskWithStatus
  index: number
  status: TaskStatus
  onClick: () => void
  onStatusChange: (taskId: string, status: TaskStatus) => void
  onPriorityChange: (taskId: string, priority: TaskPriority) => void
  deleteTask: (id: string) => Promise<void>
  moveTask: (dragIndex: number, hoverIndex: number, dragStatus: TaskStatus, hoverStatus: TaskStatus) => void
}> = ({ task, index, status, onClick, onStatusChange, onPriorityChange, deleteTask, moveTask }) => {
  const [showMenu, setShowMenu] = useState(false)
  
  const ref = React.useRef<HTMLDivElement>(null)
  
  // 使用useDrag使任务卡片可拖动
  const [{ isDragging }, drag, preview] = useDrag({
    type: ItemTypes.TASK,
    item: { 
      id: task.id, 
      type: ItemTypes.TASK,
      status: status,
      index: index 
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  })
  
  // 使用useDrop使任务卡片可放置（用于同一列内重新排序）
  const [, drop] = useDrop({
    accept: ItemTypes.TASK,
    hover: (item: DragItem, monitor) => {
      if (!ref.current) {
        return
      }
      
      const dragIndex = item.index
      const hoverIndex = index
      const dragStatus = item.status
      const hoverStatus = status
      
      // 如果是同一个任务，不做任何事
      if (dragIndex === hoverIndex && dragStatus === hoverStatus) {
        return
      }
      
      // 确定鼠标位置
      const hoverBoundingRect = ref.current?.getBoundingClientRect()
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2
      const clientOffset = monitor.getClientOffset()
      const hoverClientY = clientOffset!.y - hoverBoundingRect.top
      
      // 只在下半部分时才执行移动
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
        return
      }
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
        return
      }
      
      // 执行移动
      moveTask(dragIndex, hoverIndex, dragStatus, hoverStatus)
      item.index = hoverIndex
      item.status = hoverStatus
    },
  })
  
  drag(drop(ref))
  
  const opacity = isDragging ? 0.4 : 1
  
  // Format date with more detail
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) {
      return '今天'
    } else if (diffDays === 1) {
      return '昨天'
    } else if (diffDays < 7) {
      return `${diffDays}天前`
    } else {
      return date.toLocaleDateString('zh-CN', {
        month: 'short',
        day: 'numeric'
      })
    }
  }
  
  // Get content preview with better formatting
  const getContentPreview = () => {
    if (!task.content) return '暂无内容'
    
    // Use plain text if available
    const text = task.content_plain || task.content.replace(/<[^>]*>/g, '')
    const preview = text.substring(0, 80)
    
    if (text.length > 80) {
      return preview + '...'
    }
    return preview
  }
  
  return (
    <div 
      ref={preview}
      style={{ opacity }}
      className="group relative"
    >
      <div
        ref={ref}
        className="glass-panel p-4 cursor-move hover:bg-white/[0.07] transition-all duration-200"
        onClick={onClick}
      >
        {/* 拖拽手柄 */}
        <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical className="w-4 h-4 text-neutral-500" />
        </div>
        
        {/* 任务图标和标题 */}
        <div className="flex items-start gap-3 mb-3 pl-6">
          <span className="text-2xl">{task.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-white line-clamp-1">{task.name}</h3>
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              更新于 {formatDate(task.updated_at)}
            </p>
          </div>
          
          {/* 菜单按钮 - 超高 z-index */}
          <div className="relative z-[100]">
            <button
              className="p-1 rounded hover:bg-white/10 text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation()
                setShowMenu(!showMenu)
              }}
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            
            {/* 弹出的菜单 - 超高 z-index */}
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-40 bg-neutral-800 rounded-lg shadow-lg border border-neutral-700 z-[100]">
                {/* 状态选择 */}
                <div className="p-2 border-b border-neutral-700">
                  <div className="text-xs text-neutral-500 mb-1 px-2">状态</div>
                  {KANBAN_COLUMNS.map((col) => (
                    <button
                      key={col.id}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-white/10 text-left ${task.status === col.id ? 'text-white' : 'text-neutral-400'}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        onStatusChange(task.id, col.id)
                        setShowMenu(false)
                      }}
                    >
                      <col.icon className="w-3.5 h-3.5" />
                      <span>{col.label}</span>
                    </button>
                  ))}
                </div>
                
                {/* 删除按钮 */}
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-red-500/20 text-red-400"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (window.confirm('确定要删除这个任务吗？')) {
                      deleteTask(task.id)
                    }
                    setShowMenu(false)
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>删除</span>
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* 内容预览 */}
        <p className="text-sm text-neutral-400 line-clamp-2">
          {getContentPreview()}
        </p>
        
        {/* 统计信息 */}
        <div className="flex items-center gap-4 mt-3 text-xs text-neutral-500">
          <span>{task.property_count || 0} 属性</span>
          <span>{task.version_count || 0} 版本</span>
        </div>
      </div>
    </div>
  )
}

// 可放置的看板列组件
const DroppableKanbanColumn: React.FC<{
  column: typeof KANBAN_COLUMNS[number]
  tasks: TaskWithStatus[]
  onTaskClick: (taskId: string) => void
  onStatusChange: (taskId: string, status: TaskStatus) => void
  onPriorityChange: (taskId: string, priority: TaskPriority) => void
  deleteTask: (id: string) => Promise<void>
  moveTask: (dragIndex: number, hoverIndex: number, dragStatus: TaskStatus, hoverStatus: TaskStatus) => void
}> = ({ column, tasks, onTaskClick, onStatusChange, onPriorityChange, deleteTask, moveTask }) => {
  const Icon = column.icon
  
  // 使用useDrop使列可放置（用于跨列拖动）
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: ItemTypes.TASK,
    drop: (item: DragItem) => {
      // 如果任务已经在正确的状态，不做任何事
      if (item.status === column.id) {
        return
      }
      
      // 改变任务状态
      onStatusChange(item.id, column.id)
      return { status: column.id }
    },
    canDrop: (item: DragItem) => item.status !== column.id,
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  })
  
  const isActive = isOver && canDrop
  let backgroundColor = 'transparent'
  if (isActive) {
    backgroundColor = 'rgba(0, 255, 0, 0.1)'
  } else if (canDrop) {
    backgroundColor = 'rgba(0, 0, 255, 0.1)'
  }
  
  return (
    <div 
      ref={drop}
      className="flex flex-col h-full"
      style={{ backgroundColor }}
    >
      {/* 列标题 */}
      <div className="flex items-center gap-2 mb-4 px-2">
        <div className={`w-3 h-3 rounded-full ${column.color}`} />
        <h3 className="font-semibold text-neutral-200">{column.label}</h3>
        <span className="text-xs text-neutral-500 bg-neutral-800 px-2 py-0.5 rounded-full">
          {tasks.length}
        </span>
      </div>
      
      {/* 任务卡片列表 */}
      <div className="flex-1 space-y-3 overflow-y-auto pr-2">
        {tasks.map((task, index) => (
          <DraggableTaskCard
            key={task.id}
            task={task}
            index={index}
            status={column.id}
            onClick={() => onTaskClick(task.id)}
            onStatusChange={onStatusChange}
            onPriorityChange={onPriorityChange}
            deleteTask={deleteTask}
            moveTask={moveTask}
          />
        ))}
        
        {/* 空状态 */}
        {tasks.length === 0 && (
          <div className="text-center py-8 text-neutral-600 text-sm">
            {isActive ? '释放以移动到这里' : '暂无任务'}
          </div>
        )}
      </div>
    </div>
  )
}

// 主组件
const TasksView: React.FC = () => {
  const { setUIState } = useChronicleStore()
  const { t } = useTranslation()
  
  const {
    tasks,
    isLoading,
    error,
    loadTasks,
    addTask,
    deleteTask,
    setCurrentTask,
    updateContent
  } = useTasksStore()
  
  const [isCreating, setIsCreating] = useState(false)
  const [newTaskName, setNewTaskName] = useState('')
  const [selectedEmoji, setSelectedEmoji] = useState('📝')
  const [tasksWithStatus, setTasksWithStatus] = useState<TaskWithStatus[]>([])
  
  useEffect(() => {
    loadTasks()
  }, [loadTasks])
  
  // 从任务内容中恢复状态和优先级，或者设置默认值
  useEffect(() => {
    setTasksWithStatus(
      tasks.map((task, index) => {
        // 尝试从content中解析元数据
        let status: TaskStatus = 'planned'
        let priority: TaskPriority = 'medium'
        
        try {
          if (task.content) {
            // 检查content是不是JSON格式
            const contentData = JSON.parse(task.content)
            if (contentData && typeof contentData === 'object') {
              if (contentData.kanbanStatus) {
                status = contentData.kanbanStatus as TaskStatus
              }
              if (contentData.kanbanPriority) {
                priority = contentData.kanbanPriority as TaskPriority
              }
            }
          }
        } catch (e) {
          // 不是JSON，用默认值
        }
        
        return {
          ...task,
          status,
          priority
        }
      })
    )
  }, [tasks])
  
  // 持久化状态和优先级到任务内容
  const saveTaskMetadata = useCallback((taskId: string, updates: Partial<TaskWithStatus>) => {
    const task = tasksWithStatus.find(t => t.id === taskId)
    if (!task) return
    
    // 把元数据保存到content字段里
    try {
      let contentData: any = {}
      
      // 如果当前content是JSON，保留其他数据
      if (task.content) {
        try {
          const parsed = JSON.parse(task.content)
          if (parsed && typeof parsed === 'object') {
            contentData = parsed
          }
        } catch (e) {
          // 不是JSON，创建新对象
          contentData = { originalContent: task.content }
        }
      }
      
      // 更新元数据
      if (updates.status) {
        contentData.kanbanStatus = updates.status
      }
      if (updates.priority) {
        contentData.kanbanPriority = updates.priority
      }
      
      // 保存到数据库
      updateContent(taskId, JSON.stringify(contentData))
    } catch (e) {
      console.error('保存任务元数据失败:', e)
    }
  }, [tasksWithStatus, updateContent])
  
  // 移动任务的函数
  const moveTask = useCallback((dragIndex: number, hoverIndex: number, dragStatus: TaskStatus, hoverStatus: TaskStatus) => {
    setTasksWithStatus((prevTasks) => {
      const newTasks = [...prevTasks]
      
      // 找到拖动的任务
      const dragTaskIndex = newTasks.findIndex((t, i) => {
        const taskStatus = t.status
        return taskStatus === dragStatus && 
               newTasks.filter(t2 => t2.status === dragStatus).findIndex(t2 => t2.id === t.id) === dragIndex
      })
      
      if (dragTaskIndex === -1) return prevTasks
      
      const dragTask = newTasks[dragTaskIndex]
      
      // 如果状态相同，只是重新排序
      if (dragStatus === hoverStatus) {
        // 移除拖动的任务
        newTasks.splice(dragTaskIndex, 1)
        
        // 找到新的位置
        const sameStatusTasks = newTasks.filter(t => t.status === hoverStatus)
        const newIndex = hoverIndex < sameStatusTasks.length ? hoverIndex : sameStatusTasks.length
        
        // 插入到新位置
        newTasks.splice(
          newTasks.findIndex(t => {
            const sameStatusTasksBefore = newTasks.filter(t2 => t2.status === hoverStatus && t2.id !== dragTask.id)
            return t.id === sameStatusTasksBefore[newIndex]?.id
          }),
          0,
          dragTask
        )
      } else {
        // 状态不同，改变任务状态
        dragTask.status = hoverStatus
        
        // 找到新的位置
        const targetStatusTasks = newTasks.filter(t => t.status === hoverStatus && t.id !== dragTask.id)
        const newIndex = hoverIndex < targetStatusTasks.length ? hoverIndex : targetStatusTasks.length
        
        // 重新排序数组
        newTasks.splice(dragTaskIndex, 1)
        
        // 找到插入位置
        const insertIndex = newTasks.findIndex(t => {
          const targetStatusTasksBefore = newTasks.filter(t2 => t2.status === hoverStatus)
          return t.id === targetStatusTasksBefore[newIndex]?.id
        })
        
        if (insertIndex === -1) {
          newTasks.push(dragTask)
        } else {
          newTasks.splice(insertIndex, 0, dragTask)
        }
        
        // 持久化到数据库
        saveTaskMetadata(dragTask.id, { status: hoverStatus })
      }
      
      return newTasks
    })
  }, [saveTaskMetadata])
  
  const handleCreateTask = async () => {
    if (!newTaskName.trim()) return
    
    try {
      await addTask(newTaskName, selectedEmoji)
      setNewTaskName('')
      setSelectedEmoji('📝')
      setIsCreating(false)
    } catch (err) {
      console.error('创建任务失败:', err)
    }
  }
  
  const handleTaskClick = (taskId: string) => {
    console.log('Task clicked, setting currentTaskId:', taskId)
    setCurrentTask(taskId)
    setUIState({ 
      currentView: 'project-detail',
      currentTaskId: taskId 
    })
  }
  
  const handleStatusChange = (taskId: string, status: TaskStatus) => {
    setTasksWithStatus(
      tasksWithStatus.map(t => 
        t.id === taskId ? { ...t, status } : t
      )
    )
    saveTaskMetadata(taskId, { status })
  }
  
  const handlePriorityChange = (taskId: string, priority: TaskPriority) => {
    setTasksWithStatus(
      tasksWithStatus.map(t => 
        t.id === taskId ? { ...t, priority } : t
      )
    )
    saveTaskMetadata(taskId, { priority })
  }
  
  // 按列分组任务
  const getTasksByStatus = (status: TaskStatus) => {
    return tasksWithStatus.filter(t => t.status === status)
  }
  
  const totalTasks = tasks.length
  
  return (
    <PageLayout
      title={t.tasksTitle}
      subtitle="看板视图 (支持拖放)"
      icon={<Sparkles className="w-8 h-8" />}
      showChainInfo={true}
      chainLength={totalTasks}
      actions={
        <button
          className="btn-primary flex items-center gap-2"
          onClick={() => setIsCreating(true)}
        >
          <Plus className="w-4 h-4" />
          {t.newTask}
        </button>
      }
    >
      {/* Error message */}
      {error && (
        <div className="mb-6 p-4 bg-red-900/20 border border-red-700/30 rounded-lg flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-red-300">数据库连接错误</p>
            <p className="text-sm text-red-400/80 mt-1">{error}</p>
          </div>
        </div>
      )}
      
      {/* 看板视图 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 h-[calc(100vh-280px)]">
        {KANBAN_COLUMNS.map((column) => (
          <DroppableKanbanColumn
            key={column.id}
            column={column}
            tasks={getTasksByStatus(column.id)}
            onTaskClick={handleTaskClick}
            onStatusChange={handleStatusChange}
            onPriorityChange={handlePriorityChange}
            deleteTask={deleteTask}
            moveTask={moveTask}
          />
        ))}
      </div>
      
      {/* Create task modal */}
      {isCreating && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="glass-panel max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4">{t.createFirstTask}</h3>
            
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">选择图标</label>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border border-neutral-700 rounded-lg">
                {EMOJI_LIST.map((emoji) => (
                  <button
                    key={emoji}
                    className={`text-2xl p-2 rounded-lg transition-colors ${
                      selectedEmoji === emoji
                        ? 'bg-primary-500/30 ring-2 ring-primary-500'
                        : 'hover:bg-neutral-700/50'
                    }`}
                    onClick={() => setSelectedEmoji(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">{t.taskTitle}</label>
              <input
                type="text"
                className="input-field w-full"
                placeholder="例如：产品需求文档"
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
                autoFocus
              />
            </div>
            
            <div className="flex gap-3">
              <button
                className="btn-secondary flex-1"
                onClick={() => setIsCreating(false)}
              >
                {t.cancel}
              </button>
              <button
                className="btn-primary flex-1 flex items-center justify-center gap-2"
                onClick={handleCreateTask}
                disabled={!newTaskName.trim() || isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    创建中...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    {t.addTask}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  )
}

export default TasksView
