import React, { useState } from 'react'
import { 
  Plus, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Play, 
  Pause,
  Trash2,
  GitBranch,
  Target,
  Zap
} from 'lucide-react'
import { useChronicleStore } from '@/stores/useChronicleStore'
import { useTranslation } from '@/lib/translations'
import { Task } from '@/types'

const TasksView: React.FC = () => {
  const { tasks, addTask, updateTask, deleteTask } = useChronicleStore()
  const [isAdding, setIsAdding] = useState(false)
  const { t, language } = useTranslation()
  
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium' as Task['priority']
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTask.title.trim()) return

    addTask({
      title: newTask.title,
      description: newTask.description,
      status: 'pending',
      priority: newTask.priority
    })

    setNewTask({
      title: '',
      description: '',
      priority: 'medium'
    })
    setIsAdding(false)
  }

  const getStatusIcon = (status: Task['status']) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-5 h-5 text-green-400" />
      case 'running': return <Play className="w-5 h-5 text-blue-400" />
      case 'failed': return <AlertCircle className="w-5 h-5 text-red-400" />
      default: return <Clock className="w-5 h-5 text-yellow-400" />
    }
  }

  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'critical': return 'bg-red-500/20 text-red-300 border-red-500/30'
      case 'high': return 'bg-orange-500/20 text-orange-300 border-orange-500/30'
      case 'medium': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
      case 'low': return 'bg-green-500/20 text-green-300 border-green-500/30'
    }
  }

  const getPriorityLabel = (priority: Task['priority']) => {
    if (language === 'zh') {
      switch (priority) {
        case 'critical': return '紧急'
        case 'high': return '高'
        case 'medium': return '中'
        case 'low': return '低'
      }
    } else {
      return priority.charAt(0).toUpperCase() + priority.slice(1)
    }
  }


  const handleStartTask = (taskId: string) => {
    updateTask(taskId, { status: 'running' })
  }

  const handleCompleteTask = (taskId: string) => {
    updateTask(taskId, { status: 'completed' })
  }

  const handlePauseTask = (taskId: string) => {
    updateTask(taskId, { status: 'pending' })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">{t.tasksTitle}</h1>
          <p className="text-neutral-400 mt-2">{t.tasksSubtitle}</p>
        </div>
        <div className="flex items-center space-x-2 text-sm text-neutral-400">
          <Target className="w-4 h-4" />
          <span>
            {language === 'zh' ? '活跃' : 'Active'}: {tasks.filter(t => t.status === 'running').length}
          </span>
        </div>
      </div>

      {/* Add Task Form */}
      {isAdding ? (
        <form onSubmit={handleSubmit} className="glass-panel p-6 space-y-4">
          <div className="space-y-4">
            <input
              type="text"
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              placeholder={t.taskTitle}
              className="input-field"
              autoFocus
            />
            <textarea
              value={newTask.description}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
              placeholder={t.taskDescription}
              className="input-field min-h-[80px] resize-none"
            />
            <div className="flex items-center space-x-4">
              <select
                value={newTask.priority}
                onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as Task['priority'] })}
                className="input-field flex-1"
              >
                <option value="low">{t.low}</option>
                <option value="medium">{t.medium}</option>
                <option value="high">{t.high}</option>
                <option value="critical">{t.urgent}</option>
              </select>
              <div className="flex space-x-2">
                <button
                  type="submit"
                  className="btn-primary"
                >
                  {t.addTask}
                </button>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="btn-secondary"
                >
                  {t.cancel}
                </button>
              </div>
            </div>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="glass-panel p-6 w-full flex items-center justify-center space-x-3 hover:bg-white/10 transition-all duration-300"
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium">{t.newTask}</span>
        </button>
      )}

      {/* Tasks Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="glass-panel p-6 hover:bg-white/10 transition-all duration-300"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  {getStatusIcon(task.status)}
                  <h3 className="text-lg font-semibold">{task.title}</h3>
                  <span className={`px-2 py-1 text-xs rounded border ${getPriorityColor(task.priority)}`}>
                    {getPriorityLabel(task.priority)}
                  </span>
                </div>
                <p className="text-neutral-400 text-sm mb-4">{task.description}</p>
              </div>
              <button
                onClick={() => deleteTask(task.id)}
                className="p-2 text-neutral-500 hover:text-red-400 transition-colors"
                title={t.delete}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                {task.status === 'pending' && (
                  <button
                    onClick={() => handleStartTask(task.id)}
                    className="flex items-center space-x-2 px-3 py-1.5 bg-blue-500/20 text-blue-300 rounded-lg hover:bg-blue-500/30 transition-colors"
                  >
                    <Play className="w-4 h-4" />
                    <span className="text-sm">
                      {language === 'zh' ? '开始' : 'Start'}
                    </span>
                  </button>
                )}
                {task.status === 'running' && (
                  <>
                    <button
                      onClick={() => handleCompleteTask(task.id)}
                      className="flex items-center space-x-2 px-3 py-1.5 bg-green-500/20 text-green-300 rounded-lg hover:bg-green-500/30 transition-colors"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm">
                        {language === 'zh' ? '完成' : 'Complete'}
                      </span>
                    </button>
                    <button
                      onClick={() => handlePauseTask(task.id)}
                      className="flex items-center space-x-2 px-3 py-1.5 bg-yellow-500/20 text-yellow-300 rounded-lg hover:bg-yellow-500/30 transition-colors"
                    >
                      <Pause className="w-4 h-4" />
                      <span className="text-sm">
                        {language === 'zh' ? '暂停' : 'Pause'}
                      </span>
                    </button>
                  </>
                )}
                {task.status === 'completed' && (
                  <span className="px-3 py-1.5 bg-green-500/20 text-green-300 rounded-lg text-sm">
                    {language === 'zh' ? '已完成' : 'Completed'}
                  </span>
                )}
                {task.status === 'failed' && (
                  <span className="px-3 py-1.5 bg-red-500/20 text-red-300 rounded-lg text-sm">
                    {language === 'zh' ? '失败' : 'Failed'}
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2">
                {task.agentSessionKey && (
                  <div className="flex items-center space-x-1 text-xs text-neutral-400">
                    <GitBranch className="w-3 h-3" />
                    <span>
                      {language === 'zh' ? '代理活跃' : 'Agent Active'}
                    </span>
                  </div>
                )}
                <button className="flex items-center space-x-1 px-3 py-1.5 bg-white/5 text-neutral-300 rounded-lg hover:bg-white/10 transition-colors">
                  <Zap className="w-4 h-4" />
                  <span className="text-sm">
                    {language === 'zh' ? '创建代理' : 'Spawn Agent'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {tasks.length === 0 && (
        <div className="glass-panel p-12 text-center">
          <Target className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-neutral-300 mb-2">{t.noTasks}</h3>
          <p className="text-neutral-500">{t.createFirstTask}</p>
        </div>
      )}
    </div>
  )
}

export default TasksView