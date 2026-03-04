import React, { useState } from 'react'
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Calendar,
  FileText,
  Eye,
  Sparkles,
  Layers,
  Hash,
  Clock,
  CheckSquare,
  Type,
  Tag,
  Link as LinkIcon,
} from 'lucide-react'
import { useProjectsStore } from '@/stores/useProjectsStore'
import { useChronicleStore } from '@/stores/useChronicleStore'
import PageLayout from './PageLayout'

// Notion-style emoji picker
const EMOJI_LIST = [
  '📝',
  '🧠',
  '💡',
  '🚀',
  '⚡',
  '🎯',
  '📚',
  '🔧',
  '🎨',
  '💻',
  '🌟',
  '✨',
  '🔥',
  '💪',
  '🎮',
  '🎵',
  '📋',
  '💼',
  '🏠',
  '❤️',
  '🌈',
  '🦄',
  '🌙',
  '⚙️',
  '🔬',
  '🎭',
  '📊',
  '🗂️',
  '📈',
  '🔍',
]

const ProjectCard: React.FC<{
  project: any
  onClick: () => void
}> = ({ project, onClick }) => {
  const deleteProject = useProjectsStore((s) => s.deleteProject)
  const [showMenu, setShowMenu] = useState(false)

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
        day: 'numeric',
      })
    }
  }

  // Get properties summary (limit to 3)
  const propsSummary = project.propertyDefs
    .slice(0, 3)
    .map((def: any) => ({
      name: def.name,
      value: project.properties[def.name],
      type: def.type,
    }))
    .filter((p: any) => p.value !== '' && p.value !== null && p.value !== false)

  // Get content preview with better formatting
  const getContentPreview = () => {
    if (!project.content) return '暂无内容'

    // Strip HTML tags
    const text = project.content.replace(/<[^>]*>/g, '')
    const preview = text.substring(0, 120)

    if (text.length > 120) {
      return preview + '...'
    }
    return preview
  }

  // Property stats are computed on the fly

  // Get property icon by type
  const getPropertyIcon = (type: string) => {
    switch (type) {
      case 'text':
        return <Type className="w-3 h-3" />
      case 'number':
        return <Hash className="w-3 h-3" />
      case 'select':
        return <Tag className="w-3 h-3" />
      case 'checkbox':
        return <CheckSquare className="w-3 h-3" />
      case 'date':
        return <Calendar className="w-3 h-3" />
      case 'url':
        return <LinkIcon className="w-3 h-3" />
      default:
        return <Tag className="w-3 h-3" />
    }
  }

  return (
    <div className="group relative">
      <div
        className="glass-panel p-0 cursor-pointer hover:bg-white/[0.07] transition-all duration-200 overflow-hidden"
        onClick={onClick}
      >
        {/* Cover with gradient based on icon emoji */}
        <div className="h-28 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-500/20 via-secondary-500/20 to-accent-500/20 opacity-70" />
          <div className="absolute top-0 right-0 bottom-0 left-0 bg-gradient-to-t from-neutral-900 via-transparent to-transparent" />

          {/* Icon floating in background */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-6xl opacity-10">
            {project.icon}
          </div>

          {/* Menu button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowMenu(!showMenu)
            }}
            className="absolute top-3 right-3 p-1.5 rounded-md hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
          >
            <MoreHorizontal className="w-4 h-4 text-neutral-300" />
          </button>

          {showMenu && (
            <div className="absolute right-3 top-10 bg-neutral-800/95 backdrop-blur-sm rounded-lg shadow-2xl py-1 z-10 min-w-[140px] border border-white/10">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowMenu(false)
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-white/10 flex items-center gap-2"
              >
                <Pencil className="w-3 h-3" /> 编辑项目
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  if (confirm('确定删除这个项目吗？')) {
                    deleteProject(project.id)
                  }
                  setShowMenu(false)
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-white/10 flex items-center gap-2 text-red-400"
              >
                <Trash2 className="w-3 h-3" /> 删除项目
              </button>
            </div>
          )}

          {/* Main icon */}
          <div className="absolute bottom-4 left-4">
            <div className="text-3xl bg-white/10 backdrop-blur-sm p-3 rounded-2xl shadow-lg">
              {project.icon}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-5">
          {/* Title */}
          <h3 className="font-semibold text-lg text-white mb-2 group-hover:text-primary-300 transition-colors">
            {project.name}
          </h3>

          {/* Content preview */}
          <p className="text-sm text-neutral-400 line-clamp-2 mb-3 leading-relaxed">
            {getContentPreview()}
          </p>

          {/* Property chips */}
          {propsSummary.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {propsSummary.map((prop: any, idx: number) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-white/5 rounded-lg text-xs text-neutral-300 hover:bg-white/10 transition-colors"
                >
                  <span className="opacity-60">{getPropertyIcon(prop.type)}</span>
                  <span className="truncate max-w-[80px]">{prop.name}</span>
                  <span className="font-medium">{String(prop.value).substring(0, 8)}</span>
                </span>
              ))}
            </div>
          )}

          {/* Footer stats */}
          <div className="flex items-center justify-between pt-3 border-t border-white/10">
            <div className="flex items-center gap-4 text-xs text-neutral-500">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{formatDate(project.updatedAt)}</span>
              </div>

              <div className="flex items-center gap-1">
                <Layers className="w-3 h-3" />
                <span>{project.propertyDefs.length} 属性</span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Eye className="w-3 h-3 text-neutral-500" />
              <span className="text-xs text-neutral-500">点击查看</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const CreateProjectModal: React.FC<{
  isOpen: boolean
  onClose: () => void
}> = ({ isOpen, onClose }) => {
  const addProject = useProjectsStore((s) => s.addProject)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('📝')
  const [showEmoji, setShowEmoji] = useState(false)

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    addProject(name.trim(), icon)
    setName('')
    setIcon('📝')
    onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="glass-panel p-8 w-full max-w-md border border-white/10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="text-4xl">{icon}</div>
          <div>
            <h2 className="text-2xl font-bold gradient-text">新建项目</h2>
            <p className="text-sm text-neutral-400 mt-1">创建新的文档或笔记</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Icon selector */}
          <div>
            <label className="block text-sm text-neutral-300 mb-3 font-medium">项目图标</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowEmoji(!showEmoji)}
                className="w-20 h-20 text-5xl flex items-center justify-center hover:bg-white/10 rounded-2xl transition-all duration-200 border-2 border-white/10 hover:border-primary-500/50"
              >
                {icon}
              </button>

              {showEmoji && (
                <div className="absolute left-0 right-0 top-full mt-4 bg-neutral-800/95 backdrop-blur-sm rounded-xl shadow-2xl p-4 border border-white/10 z-10 max-h-[200px] overflow-y-auto">
                  <div className="grid grid-cols-6 gap-2">
                    {EMOJI_LIST.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          setIcon(emoji)
                          setShowEmoji(false)
                        }}
                        className={`text-2xl p-2 rounded-lg transition-all duration-150 ${
                          icon === emoji
                            ? 'bg-primary-500/30 transform scale-110'
                            : 'hover:bg-white/10 hover:scale-105'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <p className="text-xs text-neutral-500 mt-2">点击图标选择表情符号</p>
          </div>

          {/* Name input */}
          <div>
            <label className="block text-sm text-neutral-300 mb-3 font-medium">项目名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：学习计划、项目文档、笔记..."
              className="input-field w-full text-lg py-3 bg-white/5 border-white/10 focus:border-primary-500"
              autoFocus
            />
            <p className="text-xs text-neutral-500 mt-2">项目名称可以是任何描述性的标题</p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 rounded-lg border border-white/10 hover:bg-white/10 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="btn-primary px-6 py-2 text-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!name.trim()}
            >
              <Plus className="w-4 h-4" />
              创建项目
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const ProjectsView: React.FC = () => {
  const { projects, setCurrentProject } = useProjectsStore()
  const setUIState = useChronicleStore((s) => s.setUIState)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const handleProjectClick = (projectId: string) => {
    setCurrentProject(projectId)
    setUIState({ currentView: 'project-detail' })
  }

  // Sort projects by updatedAt (newest first)
  const sortedProjects = [...projects].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )

  return (
    <PageLayout
      title="项目"
      subtitle="组织你的想法、计划和文档"
      icon="📚"
      actions={
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          新建项目
        </button>
      }
    >
      {/* Projects Grid - Notion style */}
      {sortedProjects.length > 0 ? (
        <div className="space-y-6">
          {/* Stats */}
          <div className="glass-panel p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold gradient-text">{sortedProjects.length}</div>
                  <div className="text-xs text-neutral-500 mt-1">总项目</div>
                </div>
                <div className="h-8 w-px bg-white/10" />
                <div className="text-center">
                  <div className="text-2xl font-bold gradient-text">
                    {sortedProjects.filter((p) => p.propertyDefs.length > 0).length}
                  </div>
                  <div className="text-xs text-neutral-500 mt-1">自定义属性</div>
                </div>
                <div className="h-8 w-px bg-white/10" />
                <div className="text-center">
                  <div className="text-2xl font-bold gradient-text">
                    {sortedProjects.filter((p) => p.content && p.content.length > 50).length}
                  </div>
                  <div className="text-xs text-neutral-500 mt-1">有内容</div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-neutral-400">
                <Sparkles className="w-4 h-4" />
                <span>点击卡片查看详情</span>
              </div>
            </div>
          </div>

          {/* Projects Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {sortedProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => handleProjectClick(project.id)}
              />
            ))}

            {/* Add new card */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="glass-panel p-0 flex flex-col items-center justify-center min-h-[320px] text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.07] transition-all duration-200 group"
            >
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-500/20 to-secondary-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <Plus className="w-8 h-8" />
              </div>
              <span className="text-lg font-medium mb-2">新建项目</span>
              <p className="text-sm text-neutral-500 max-w-[160px] text-center">
                创建新的文档、笔记或计划
              </p>
            </button>
          </div>
        </div>
      ) : (
        <div className="glass-panel p-16 text-center">
          <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-primary-500/20 via-secondary-500/20 to-accent-500/20 flex items-center justify-center">
            <FileText className="w-12 h-12 text-primary-400" />
          </div>
          <h3 className="text-2xl font-semibold text-neutral-200 mb-3">还没有项目</h3>
          <p className="text-neutral-500 mb-8 max-w-md mx-auto text-lg leading-relaxed">
            项目是你组织想法、计划和文档的地方。创建一个项目来开始你的数字工作室。
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary text-lg px-6 py-3"
          >
            <Plus className="w-5 h-5 mr-2" />
            创建第一个项目
          </button>
        </div>
      )}

      {/* Create Modal */}
      <CreateProjectModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} />
    </PageLayout>
  )
}

export default ProjectsView
