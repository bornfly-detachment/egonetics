import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Plus, MoreHorizontal, Trash2, Sparkles,
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
  kanbanPriority: number  // 看板优先级 (0-100)
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
  deleteTask: (id: string) => Promise<void>
  moveTask: (dragIndex: number, hoverIndex: number, dragStatus: TaskStatus, hoverStatus: TaskStatus) => void
}> = ({ task, index, status, onClick, onStatusChange, deleteTask, moveTask }) => {
  const [showMenu, setShowMenu] = useState(false)

  // 使用useDrag使任务卡片可拖动
  const [{ isDragging }, drag, preview] = useDrag({
    type: ItemTypes.TASK,
    item: { id: task.id, type: ItemTypes.TASK, status, index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  })

  const ref = useRef<HTMLDivElement>(null)

  // 使用useDrop使任务卡片可放置（用于排序）
  const [, drop] = useDrop({
    accept: ItemTypes.TASK,
    hover: (item: DragItem, monitor) => {
      if (!ref.current) return

      // 如果拖动的是同一个任务，不做任何事
      if (item.id === task.id) return

      // 计算相对位置
      const hoverBoundingRect = ref.current.getBoundingClientRect()
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2
      const clientOffset = monitor.getClientOffset()
      const hoverClientY = clientOffset!.y - hoverBoundingRect.top

      // 当拖动到当前任务的上方时
      if (item.index < index && hoverClientY < hoverMiddleY) {
        return
      }

      // 当拖动到当前任务的下方时
      if (item.index > index && hoverClientY > hoverMiddleY) {
        return
      }

      // 移动任务
      moveTask(item.index, index, item.status, status)
      item.index = index
    },
    collect: () => ({}),
  })

  const opacity = isDragging ? 0.4 : 1

  const getContentPreview = () => {
    if (task.content) {
      try {
        // 检查是否是JSON格式的内容
        const contentData = JSON.parse(task.content)
        if (contentData && typeof contentData === 'object' && contentData.originalContent) {
          return contentData.originalContent.slice(0, 100)
        }
      } catch (e) {
        // 如果不是JSON，直接返回内容片段
        return task.content.replace(/<[^>]*>/g, '').slice(0, 100)
      }
    }
    return '暂无内容'
  }

  return (
    <div
      ref={(node) => {
        // 正确设置 ref
        Object.assign(ref, { current: node })
        drag(drop(node))
        preview(node)
      }}
      style={{ opacity }}
      className="group bg-neutral-800 border border-neutral-700 rounded-lg p-4 hover:border-neutral-500 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        {/* 拖动手柄 */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity pt-1">
          <GripVertical className="w-4 h-4 text-neutral-500" />
        </div>

        {/* 任务图标和标题 */}
        <div className="flex items-start gap-3 mb-3 pl-6">
          <span className="text-2xl">{task.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-white flex-1">{task.name}</h3>
            </div>
            {/* 优先级显示 */}
            <div className="flex items-center gap-2 mt-1">
              <span className="w-14 h-6 bg-neutral-800 border border-neutral-700 rounded px-1 py-0.5 text-xs text-center text-white flex items-center justify-center">
                {task.kanbanPriority.toFixed(0)}
              </span>
              <span className="text-xs text-neutral-500">优先级</span>
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              更新于 {new Date(task.updated_at).toLocaleString('zh-CN')}
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
  deleteTask: (id: string) => Promise<void>
  moveTask: (dragIndex: number, hoverIndex: number, dragStatus: TaskStatus, hoverStatus: TaskStatus) => void
}> = ({ column, tasks, onTaskClick, onStatusChange, deleteTask, moveTask }) => {
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
    backgroundColor = 'rgba(0, 255, 0, 0.1)'
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
  const [newTaskPriority, setNewTaskPriority] = useState(50) // 默认优先级为50
  const [tasksWithStatus, setTasksWithStatus] = useState<TaskWithStatus[]>([])

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  // 从任务内容中恢复状态和优先级，或者设置默认值
  useEffect(() => {
    setTasksWithStatus(() => {
      return tasks.map((task) => {
        // 尝试从content中解析元数据
        let status: TaskStatus = 'planned'
        let priority: TaskPriority = 'medium'
        let kanbanPriority = 50  // 默认优先级 (0-100)

        try {
          if (task.content) {
            // 检查content是不是JSON格式
            const contentData = JSON.parse(task.content)
            if (contentData && typeof contentData === 'object') {
              if (contentData.kanbanStatus) {
                status = contentData.kanbanStatus as TaskStatus
              }
              if (contentData.kanbanPriority !== undefined) {
                // 检查是否是数字类型的优先级
                if (typeof contentData.kanbanPriority === 'number') {
                  kanbanPriority = contentData.kanbanPriority
                } else {
                  priority = contentData.kanbanPriority as TaskPriority
                }
              }
            }
          }
        } catch (e) {
          // 不是JSON，用默认值
        }

        return {
          ...task,
          status,
          priority,
          kanbanPriority
        }
      })
    })
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
      if (updates.kanbanPriority !== undefined) {
        contentData.kanbanPriority = updates.kanbanPriority
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

      // 获取当前列的所有任务（按优先级降序排序）
      const sameStatusTasks = newTasks
        .filter(t => t.status === dragStatus)
        .sort((a, b) => b.kanbanPriority - a.kanbanPriority)

      // 找到拖动的任务
      const dragTask = sameStatusTasks[dragIndex]
      if (!dragTask) return prevTasks

      // 如果状态相同，只是重新排序
      if (dragStatus === hoverStatus) {
        // 计算新的优先级
        let newPriority: number
        if (hoverIndex === 0) {
          // 拖到最前面
          newPriority = 100.0
        } else if (hoverIndex === sameStatusTasks.length) {
          // 拖到最后面
          newPriority = 0.0
        } else {
          // 拖到中间位置
          const beforeTask = sameStatusTasks[hoverIndex]
          const afterTask = sameStatusTasks[hoverIndex - 1]
          newPriority = (beforeTask.kanbanPriority + afterTask.kanbanPriority) / 2
        }

        // 保留一位小数
        newPriority = Number(newPriority.toFixed(1))
        // 更新任务的优先级
        const taskIndex = newTasks.findIndex(t => t.id === dragTask.id)
        newTasks[taskIndex].kanbanPriority = newPriority
        // 持久化新的优先级到数据库
        saveTaskMetadata(dragTask.id, { kanbanPriority: newPriority })
      } else {
        // 状态不同，改变任务状态
        const taskIndex = newTasks.findIndex(t => t.id === dragTask.id)
        newTasks[taskIndex].status = hoverStatus

        // 获取目标列的所有任务（按优先级降序排序）
        const targetStatusTasks = newTasks
          .filter(t => t.status === hoverStatus && t.id !== dragTask.id)
          .sort((a, b) => b.kanbanPriority - a.kanbanPriority)

        // 计算新的优先级
        let newPriority: number
        if (hoverIndex === 0) {
          // 拖到最前面
          newPriority = 100.0
        } else if (hoverIndex === targetStatusTasks.length) {
          // 拖到最后面
          newPriority = 0.0
        } else {
          // 拖到中间位置
          const beforeTask = targetStatusTasks[hoverIndex]
          const afterTask = targetStatusTasks[hoverIndex - 1]
          newPriority = (beforeTask.kanbanPriority + afterTask.kanbanPriority) / 2
        }

        // 保留一位小数
        newPriority = Number(newPriority.toFixed(1))
        // 更新任务的优先级
        newTasks[taskIndex].kanbanPriority = newPriority
        // 持久化状态和优先级到数据库
        saveTaskMetadata(dragTask.id, { status: hoverStatus, kanbanPriority: newPriority })
      }

      return newTasks
    })
  }, [saveTaskMetadata])

  const handleCreateTask = async () => {
    if (!newTaskName.trim()) return

    try {
      await addTask(newTaskName, selectedEmoji, newTaskPriority)
      setNewTaskName('')
      setSelectedEmoji('📝')
      setNewTaskPriority(50) // 重置为默认值
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

  // 按列分组任务，并按优先级降序排序
  const getTasksByStatus = (status: TaskStatus) => {
    return tasksWithStatus
      .filter(t => t.status === status)
      .sort((a, b) => b.kanbanPriority - a.kanbanPriority)
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
      <div className="flex-1">
        {isLoading && tasks.length === 0 && (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-neutral-500 mx-auto mb-4" />
            <p className="text-neutral-400">正在加载任务...</p>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {!isLoading && tasks.length === 0 && !error && (
          <div className="text-center py-12">
            <div className="text-neutral-500 mb-4">还没有任务</div>
            <button
              className="btn-primary"
              onClick={() => setIsCreating(true)}
            >
              <Plus className="w-4 h-4" />
              创建第一个任务
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
          {KANBAN_COLUMNS.map((column) => (
            <DroppableKanbanColumn
              key={column.id}
              column={column}
              tasks={getTasksByStatus(column.id)}
              onTaskClick={handleTaskClick}
              onStatusChange={handleStatusChange}
              deleteTask={deleteTask}
              moveTask={moveTask}
            />
          ))}
        </div>

        {/* 创建任务模态框 */}
        {isCreating && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]">
            <div className="bg-neutral-800 rounded-lg p-6 w-full max-w-md">
              <h3 className="text-xl font-semibold text-white mb-4">创建新任务</h3>

              {/* 表情选择器 */}
              <div className="mb-4">
                <label className="block text-sm text-neutral-400 mb-2">图标</label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {EMOJI_LIST.map((emoji) => (
                    <button
                      key={emoji}
                      className={`w-10 h-10 rounded flex items-center justify-center ${
                        selectedEmoji === emoji ? 'bg-primary-500/20 border-2 border-primary-500' : 'bg-neutral-700 hover:bg-neutral-600'
                      }`}
                      onClick={() => setSelectedEmoji(emoji)}
                    >
                      <span className="text-xl">{emoji}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm text-neutral-400 mb-2">任务名称</label>
                <input
                  type="text"
                  value={newTaskName}
                  onChange={(e) => setNewTaskName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateTask()}
                  className="w-full bg-neutral-700 border border-neutral-600 rounded px-3 py-2 text-white focus:outline-none focus:border-primary-500"
                  placeholder="请输入任务名称"
                  autoFocus
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm text-neutral-400 mb-2">优先级 (0-100)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={newTaskPriority}
                  onChange={(e) => setNewTaskPriority(parseInt(e.target.value))}
                  className="w-full bg-neutral-700 border border-neutral-600 rounded px-3 py-2 text-white focus:outline-none focus:border-primary-500"
                  placeholder="请输入优先级"
                />
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  className="px-4 py-2 text-sm text-neutral-400 hover:text-neutral-300"
                  onClick={() => setIsCreating(false)}
                >
                  取消
                </button>
                <button
                  className="px-4 py-2 text-sm bg-primary-500 hover:bg-primary-600 rounded text-white"
                  onClick={handleCreateTask}
                  disabled={!newTaskName.trim()}
                >
                  创建
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  )
}

export default TasksView