import React, { useState, useEffect } from 'react'
import { 
  Plus, 
  Trash2, 
  Calendar,
  Edit3,
  Eye,
  Clock,
  Copy,
  Download,
  Bookmark,
  MoreVertical,
  History,
  Save,
  Table as TableIcon,
  Columns,
  Rows,
  MinusSquare,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Highlighter,
  Palette,
  Undo,
  Redo,
  Link,
  Type,
  Hash,
  CheckSquare
} from 'lucide-react'
import { useTasksStore } from '@/stores/useTasksStore'
import { useChronicleStore } from '@/stores/useChronicleStore'
import { PropertyType, PropertyDef } from '@/types'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import UnderlineExt from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import LinkExt from '@tiptap/extension-link'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import PageLayout from './PageLayout'

// Property type icons
const PropertyTypeIcon: React.FC<{ type: PropertyType }> = ({ type }) => {
  switch (type) {
    case 'text': return <Type className="w-4 h-4" />
    case 'number': return <Hash className="w-4 h-4" />
    case 'date': return <Calendar className="w-4 h-4" />
    case 'checkbox': return <CheckSquare className="w-4 h-4" />
    case 'url': return <Link className="w-4 h-4" />
    case 'select': return <List className="w-4 h-4" />
    default: return <Type className="w-4 h-4" />
  }
}

const PROPERTY_TYPES: { type: PropertyType; label: string; icon: string }[] = [
  { type: 'text', label: '文本', icon: '📝' },
  { type: 'number', label: '数字', icon: '🔢' },
  { type: 'select', label: '单选', icon: '📋' },
  { type: 'multi-select', label: '多选', icon: '☑️' },
  { type: 'date', label: '日期', icon: '📅' },
  { type: 'checkbox', label: '复选框', icon: '✅' },
  { type: 'url', label: '链接', icon: '🔗' },
]

// Property Row Component
const PropertyRow: React.FC<{
  def: PropertyDef
  value: any
  onChange: (value: any) => void
  onDelete: () => void
}> = ({ def, value, onChange, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  
  useEffect(() => {
    setEditValue(value)
  }, [value])
  
  const handleSave = () => {
    onChange(editValue)
    setIsEditing(false)
  }
  
  const renderInput = () => {
    switch (def.type) {
      case 'text':
      case 'url':
        return (
          <input
            type="text"
            value={editValue || ''}
            onChange={(e) => setEditValue(e.target.value)}
            className="w-full bg-transparent text-neutral-200 outline-none border-b border-white/20 focus:border-primary-500 transition-colors py-1"
            placeholder="输入..."
          />
        )
      case 'number':
        return (
          <input
            type="number"
            value={editValue || 0}
            onChange={(e) => setEditValue(Number(e.target.value))}
            className="w-full bg-transparent text-neutral-200 outline-none border-b border-white/20 focus:border-primary-500 transition-colors py-1"
          />
        )
      case 'checkbox':
        return (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={editValue || false}
              onChange={(e) => {
                setEditValue(e.target.checked)
                onChange(e.target.checked)
              }}
              className="w-4 h-4 rounded accent-primary-500"
            />
          </label>
        )
      case 'date':
        return (
          <input
            type="date"
            value={editValue || ''}
            onChange={(e) => {
              setEditValue(e.target.value)
              onChange(e.target.value)
            }}
            className="w-full bg-transparent text-neutral-200 outline-none border-b border-white/20 focus:border-primary-500 transition-colors py-1"
          />
        )
      case 'select':
        return (
          <select
            value={editValue || ''}
            onChange={(e) => {
              setEditValue(e.target.value)
              onChange(e.target.value)
            }}
            className="w-full bg-transparent text-neutral-200 outline-none border-b border-white/20 focus:border-primary-500 transition-colors py-1"
          >
            <option value="">选择...</option>
            {(def.options || []).map(opt => (
              <option key={opt} value={opt} className="bg-neutral-800">{opt}</option>
            ))}
          </select>
        )
      default:
        return null
    }
  }
  
  return (
    <div className="group flex items-center gap-3 py-2 px-3 hover:bg-white/5 rounded-lg transition-colors">
      <PropertyTypeIcon type={def.type} />
      <span className="text-sm text-neutral-400 w-20 flex-shrink-0">{def.name}</span>
      
      {isEditing ? (
        <div className="flex-1 flex items-center gap-2">
          {renderInput()}
          <button onClick={handleSave} className="text-xs text-primary-400 hover:text-primary-300">
            保存
          </button>
        </div>
      ) : (
        <div 
          onClick={() => setIsEditing(true)}
          className="flex-1 text-sm text-neutral-200 cursor-pointer min-h-[24px] flex items-center"
        >
          {def.type === 'checkbox' 
            ? (value ? '✓' : '○')
            : value || <span className="text-neutral-600 italic">点击编辑</span>
          }
        </div>
      )}
      
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded text-neutral-500 hover:text-red-400 transition-all"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  )
}

// Add Property Modal
const AddPropertyModal: React.FC<{
  isOpen: boolean
  onClose: () => void
  onAdd: (def: Omit<PropertyDef, 'id'>) => void
}> = ({ isOpen, onClose, onAdd }) => {
  const [name, setName] = useState('')
  const [type, setType] = useState<PropertyType>('text')
  const [options, setOptions] = useState('')
  
  if (!isOpen) return null
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    
    onAdd({
      name: name.trim(),
      type,
      options: type === 'select' || type === 'multi-select' 
        ? options.split(',').map(o => o.trim()).filter(o => o)
        : undefined
    })
    
    setName('')
    setType('text')
    setOptions('')
    onClose()
  }
  
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="glass-panel p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-semibold mb-4">添加属性</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-neutral-400 mb-2">属性名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如: 状态、优先级、标签"
              className="input-field w-full"
              autoFocus
            />
          </div>
          
          <div>
            <label className="block text-sm text-neutral-400 mb-2">属性类型</label>
            <div className="grid grid-cols-4 gap-2">
              {PROPERTY_TYPES.map(pt => (
                <button
                  key={pt.type}
                  type="button"
                  onClick={() => setType(pt.type)}
                  className={`p-3 rounded-lg text-center transition-all ${
                    type === pt.type 
                      ? 'bg-primary-500/30 border border-primary-500/50' 
                      : 'bg-white/5 hover:bg-white/10 border border-transparent'
                  }`}
                >
                  <div className="text-xl mb-1">{pt.icon}</div>
                  <div className="text-xs">{pt.label}</div>
                </button>
              ))}
            </div>
          </div>
          
          {(type === 'select' || type === 'multi-select') && (
            <div>
              <label className="block text-sm text-neutral-400 mb-2">选项 (逗号分隔)</label>
              <input
                type="text"
                value={options}
                onChange={(e) => setOptions(e.target.value)}
                placeholder="例如: 进行中, 已完成, 待处理"
                className="input-field w-full"
              />
            </div>
          )}
          
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">
              取消
            </button>
            <button type="submit" className="btn-primary" disabled={!name.trim()}>
              添加
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Tiptap Editor Toolbar
const EditorToolbar: React.FC<{ editor: any }> = ({ editor }) => {
  if (!editor) return null
  
  const ToolbarButton: React.FC<{
    onClick: () => void
    isActive?: boolean
    title: string
    children: React.ReactNode
    disabled?: boolean
  }> = ({ onClick, isActive, title, children, disabled = false }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`p-2 rounded transition-colors ${
        disabled 
          ? 'opacity-30 cursor-not-allowed text-neutral-500'
          : isActive 
            ? 'bg-white/20 text-primary-400' 
            : 'hover:bg-white/10 text-neutral-400'
      }`}
      title={title}
    >
      {children}
    </button>
  )
  
  return (
    <div className="flex items-center gap-1 p-2 border-b border-white/10 flex-wrap">
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        title="撤销"
      >
        <Undo className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        title="重做"
      >
        <Redo className="w-4 h-4" />
      </ToolbarButton>
      
      <div className="w-px h-6 bg-white/10 mx-1" />
      
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        title="粗体"
      >
        <Bold className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        title="斜体"
      >
        <Italic className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive('underline')}
        title="下划线"
      >
        <Underline className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive('strike')}
        title="删除线"
      >
        <Strikethrough className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        isActive={editor.isActive('code')}
        title="代码"
      >
        <Code className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        isActive={editor.isActive('highlight')}
        title="高亮"
      >
        <Highlighter className="w-4 h-4" />
      </ToolbarButton>
      
      <div className="w-px h-6 bg-white/10 mx-1" />
      
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive('heading', { level: 1 })}
        title="标题1"
      >
        <Heading1 className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive('heading', { level: 2 })}
        title="标题2"
      >
        <Heading2 className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive('heading', { level: 3 })}
        title="标题3"
      >
        <Heading3 className="w-4 h-4" />
      </ToolbarButton>
      
      <div className="w-px h-6 bg-white/10 mx-1" />
      
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        title="无序列表"
      >
        <List className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        title="有序列表"
      >
        <ListOrdered className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive('blockquote')}
        title="引用"
      >
        <Quote className="w-4 h-4" />
      </ToolbarButton>
      
      <div className="w-px h-6 bg-white/10 mx-1" />
      
      <ToolbarButton
        onClick={() => {
          const url = window.prompt('输入链接地址')
          if (url) {
            editor.chain().focus().setLink({ href: url }).run()
          }
        }}
        isActive={editor.isActive('link')}
        title="链接"
      >
        <Link className="w-4 h-4" />
      </ToolbarButton>
      
      <ToolbarButton
        onClick={() => {
          const color = window.prompt('输入颜色 (hex)', '#ffffff')
          if (color) {
            editor.chain().focus().setColor(color).run()
          }
        }}
        title="文字颜色"
      >
        <Palette className="w-4 h-4" />
      </ToolbarButton>
      
      <div className="w-px h-6 bg-white/10 mx-1" />
      
      {/* Table controls */}
      <div className="flex items-center gap-0 border border-white/10 rounded">
        <ToolbarButton
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          title="插入表格"
        >
          <TableIcon className="w-4 h-4" />
        </ToolbarButton>
        
        <ToolbarButton
          onClick={() => editor.chain().focus().addColumnBefore().run()}
          title="在前面添加列"
          disabled={!editor.can().addColumnBefore()}
        >
          <Columns className="w-4 h-4" />
        </ToolbarButton>
        
        <ToolbarButton
          onClick={() => editor.chain().focus().addRowAfter().run()}
          title="在后面添加行"
          disabled={!editor.can().addRowAfter()}
        >
          <Rows className="w-4 h-4" />
        </ToolbarButton>
        
        <ToolbarButton
          onClick={() => editor.chain().focus().deleteTable().run()}
          title="删除表格"
          disabled={!editor.can().deleteTable()}
        >
          <MinusSquare className="w-4 h-4" />
        </ToolbarButton>
      </div>
    </div>
  )
}

// Markdown Editor using Tiptap
const MarkdownEditor: React.FC<{
  content: string
  onChange: (content: string) => void
}> = ({ content, onChange }) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: '开始书写你的内容... 支持表格、富文本、代码块等'
      }),
      UnderlineExt,
      Highlight.configure({
        multicolor: true
      }),
      LinkExt.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary-400 hover:text-primary-300 underline'
        }
      }),
      TextStyle,
      Color,
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'border-collapse border border-white/20'
        }
      }),
      TableRow,
      TableHeader,
      TableCell.configure({
        HTMLAttributes: {
          class: 'border border-white/20 p-2'
        }
      })
    ],
    content: content || '',
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none focus:outline-none min-h-[400px] p-6 bg-transparent'
      }
    }
  })
  
  return (
    <div className="flex flex-col h-full bg-neutral-900/30 rounded-xl overflow-hidden">
      <EditorToolbar editor={editor} />
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}

const ProjectDetailView: React.FC = () => {
  const { 
    tasks, 
    currentTaskId, 
    setCurrentTask,
    addPropertyDef, 
    deletePropertyDef,
    updatePropertyValue,
    updateContent,
    loadTask
  } = useTasksStore()
  const setUIState = useChronicleStore(s => s.setUIState)
  
  // 加载任务详情（如果缺少属性定义）
  useEffect(() => {
    if (currentTaskId) {
      const currentTask = tasks.find(t => t.id === currentTaskId)
      if (currentTask && (!currentTask.propertyDefs || !currentTask.properties)) {
        // 任务存在但缺少详情，加载完整数据
        loadTask(currentTaskId)
      }
    }
  }, [currentTaskId, tasks, loadTask])
  
  const [showAddProperty, setShowAddProperty] = useState(false)
  const [showActions, setShowActions] = useState(false)
  
  const task = tasks.find(t => t.id === currentTaskId)
  
  if (!task) {
    return (
      <div className="p-8 text-center">
        <p className="text-neutral-400 mb-4">任务不存在</p>
        <button 
          onClick={() => {
            setCurrentTask(null)
            setUIState({ currentView: 'tasks' })
          }}
          className="btn-secondary"
        >
          返回任务列表
        </button>
      </div>
    )
  }
  
  // Format date with more detail
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }
  
  // Get content stats
  const getContentStats = () => {
    if (!task.content) return { chars: 0, words: 0, readingTime: 0 }
    
    const text = task.content.replace(/<[^>]*>/g, '')
    const chars = text.length
    const words = text.split(/\s+/).filter(w => w.length > 0).length
    const readingTime = Math.ceil(words / 200) // 200 words per minute
    
    return { chars, words, readingTime }
  }
  
  const contentStats = getContentStats()
  
  // Action buttons
  const ActionButtons = () => (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setShowAddProperty(true)}
        className="btn-secondary flex items-center gap-2"
      >
        <Plus className="w-4 h-4" />
        添加属性
      </button>
      
      <div className="relative">
        <button
          onClick={() => setShowActions(!showActions)}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <MoreVertical className="w-5 h-5" />
        </button>
        
        {showActions && (
          <div className="absolute right-0 top-full mt-2 bg-neutral-800/95 backdrop-blur-sm rounded-lg shadow-2xl py-2 z-20 min-w-[180px] border border-white/10">
            <button
              onClick={() => {
                // Save functionality
                console.log('Save project')
                setShowActions(false)
              }}
              className="w-full px-4 py-2 text-left text-sm hover:bg-white/10 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              保存版本
            </button>
            <button
              onClick={() => {
                // Export functionality
                console.log('Export project')
                setShowActions(false)
              }}
              className="w-full px-4 py-2 text-left text-sm hover:bg-white/10 flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              导出
            </button>
            <button
              onClick={() => {
                // Copy link functionality
                console.log('Copy link')
                setShowActions(false)
              }}
              className="w-full px-4 py-2 text-left text-sm hover:bg-white/10 flex items-center gap-2"
            >
              <Copy className="w-4 h-4" />
              复制链接
            </button>
            <div className="h-px bg-white/10 my-1" />
            <button
              onClick={() => {
                // Delete functionality
                if (confirm('确定删除这个任务吗？')) {
                  // Need to implement delete
                  console.log('Delete project')
                }
                setShowActions(false)
              }}
              className="w-full px-4 py-2 text-left text-sm hover:bg-white/10 flex items-center gap-2 text-red-400"
            >
              <Trash2 className="w-4 h-4" />
              删除任务
            </button>
          </div>
        )}
      </div>
    </div>
  )
  
  return (
    <PageLayout
      title={task.name}
      subtitle="任务详情 · 自由编辑"
      icon={task.icon}
      showBack
      onBack={() => {
        setCurrentTask(null)
        setUIState({ currentView: 'tasks' })
      }}
      actions={<ActionButtons />}
      variant="blog"
    >
      {/* Stats bar */}
      <div className="glass-panel p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-xl font-bold gradient-text">{task.propertyDefs?.length || 0}</div>
              <div className="text-xs text-neutral-500 mt-1">自定义属性</div>
            </div>
            <div className="h-6 w-px bg-white/10" />
            <div className="text-center">
              <div className="text-xl font-bold gradient-text">{contentStats.words}</div>
              <div className="text-xs text-neutral-500 mt-1">字数</div>
            </div>
            <div className="h-6 w-px bg-white/10" />
            <div className="text-center">
              <div className="text-xl font-bold gradient-text">{contentStats.readingTime}</div>
              <div className="text-xs text-neutral-500 mt-1">分钟阅读</div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-neutral-400">
            <Clock className="w-4 h-4" />
            <span>最后更新: {formatDate(task.updated_at)}</span>
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Left: Properties Panel - Blog sidebar style */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 space-y-4">
            <div className="glass-panel p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm text-neutral-400 uppercase tracking-wider">任务属性</h3>
                <button
                  onClick={() => setShowAddProperty(true)}
                  className="p-1.5 hover:bg-white/10 rounded text-neutral-400 hover:text-white transition-colors"
                  title="添加属性"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              
              <div className="space-y-3">
                {task.propertyDefs?.map(def => (
                  <PropertyRow
                    key={def.id}
                    def={def}
                    value={task.properties?.[def.name]}
                    onChange={(value) => updatePropertyValue(task.id, def.name, value)}
                    onDelete={() => deletePropertyDef(task.id, def.id)}
                  />
                )) || []}
                
                {(!task.propertyDefs || task.propertyDefs.length === 0) && (
                  <div className="text-center py-6 text-neutral-500 text-sm">
                    <Plus className="w-5 h-5 mx-auto mb-2 opacity-50" />
                    <div>添加属性来组织信息</div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Quick Stats */}
            <div className="glass-panel p-5">
              <h3 className="font-semibold text-sm text-neutral-400 uppercase tracking-wider mb-3">文档信息</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-400">创建时间</span>
                  <span className="text-neutral-200">
                    {new Date(task.created_at).toLocaleDateString('zh-CN')}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-400">最后更新</span>
                  <span className="text-neutral-200">
                    {new Date(task.updated_at).toLocaleDateString('zh-CN')}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-400">属性数量</span>
                  <span className="text-neutral-200">{task.propertyDefs?.length || 0}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-400">内容字数</span>
                  <span className="text-neutral-200">{contentStats.words}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-400">阅读时间</span>
                  <span className="text-neutral-200">{contentStats.readingTime} 分钟</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Right: Content Editor - Blog content style */}
        <div className="lg:col-span-4">
          <div className="glass-panel overflow-hidden">
            {/* Editor header */}
            <div className="border-b border-white/10 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-primary-400" />
                  <span className="text-sm font-medium">文档编辑器</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-neutral-500">
                  <span className="flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    自动保存
                  </span>
                </div>
              </div>
            </div>
            
            {/* Editor */}
            <div className="h-[600px]">
              <MarkdownEditor
                content={task.content}
                onChange={(content) => updateContent(task.id, content)}
              />
            </div>
            
            {/* Editor footer */}
            <div className="border-t border-white/10 p-4">
              <div className="flex items-center justify-between text-sm text-neutral-500">
                <div className="flex items-center gap-4">
                  <span>字数: {contentStats.words}</span>
                  <span>字符: {contentStats.chars}</span>
                  <span>段落: {task.content ? (task.content.match(/<p>/g) || []).length : 0}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-1 hover:bg-white/10 rounded transition-colors" title="历史记录">
                    <History className="w-4 h-4" />
                  </button>
                  <button className="p-1 hover:bg-white/10 rounded transition-colors" title="收藏">
                    <Bookmark className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Modals */}
      <AddPropertyModal
        isOpen={showAddProperty}
        onClose={() => setShowAddProperty(false)}
        onAdd={(def) => addPropertyDef(task.id, def)}
      />
    </PageLayout>
  )
}

export default ProjectDetailView
