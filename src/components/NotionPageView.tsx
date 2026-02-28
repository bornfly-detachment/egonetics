import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Plus, Type, Braces, Image, Film, Music, ChevronRight } from 'lucide-react'
import { useTasksStore } from '@/stores/useTasksStore'
import { useChronicleStore } from '@/stores/useChronicleStore'
import PageLayout from './PageLayout'
import BlockWrapper from './blocks/BlockWrapper'
import MarkdownBlock from './blocks/MarkdownBlock'
import JsonBlock from './blocks/JsonBlock'
import ImageBlock from './blocks/ImageBlock'
import VideoBlock from './blocks/VideoBlock'
import AudioBlock from './blocks/AudioBlock'

// 块类型定义
export type BlockType = 
  | 'markdown'       // Markdown编辑显示块
  | 'json'           // JSON格式展示块
  | 'image'          // 图片
  | 'video'          // 视频
  | 'audio'          // 音频

export interface PageBlock {
  id: string
  type: BlockType
  title: string                // 块标题（在列表中显示）
  content: string | Record<string, any>
  order: number
}

// 块类型信息
const BLOCK_TYPES = [
  { type: 'markdown' as const, label: 'Markdown', icon: Type, defaultTitle: '新 Markdown 块' },
  { type: 'json' as const, label: 'JSON', icon: Braces, defaultTitle: '新 JSON 块' },
  { type: 'image' as const, label: '图片', icon: Image, defaultTitle: '新图片块' },
  { type: 'video' as const, label: '视频', icon: Film, defaultTitle: '新视频块' },
  { type: 'audio' as const, label: '音频', icon: Music, defaultTitle: '新音频块' },
]

// 生成唯一 ID
const generateId = () => `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

const NotionPageView: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const { tasks, loadTask, currentTaskId, setCurrentTask, updateContent } = useTasksStore()
  const setUIState = useChronicleStore(s => s.setUIState)
  
  const [blocks, setBlocks] = useState<PageBlock[]>([])
  const [showMenu, setShowMenu] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 })
  const menuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLDivElement>(null)

  // 从 URL 同步到 store
  useEffect(() => {
    if (taskId && taskId !== currentTaskId) {
      setCurrentTask(taskId)
      loadTask(taskId)
    }
  }, [taskId, currentTaskId, setCurrentTask, loadTask])

  // 从任务内容初始化块
  useEffect(() => {
    const task = tasks.find(t => t.id === taskId)
    if (task && task.content) {
      try {
        const parsed = JSON.parse(task.content)
        if (Array.isArray(parsed)) {
          setBlocks(parsed)
          return
        }
      } catch (e) {
        // 如果不是 JSON，创建一个默认 Markdown 块
      }
    }
    
    // 默认块
    setBlocks([
      {
        id: generateId(),
        type: 'markdown',
        title: '欢迎',
        content: '# 欢迎使用 Notion 风格编辑器\n\n这是你的第一个块。',
        order: 0
      }
    ])
  }, [taskId, tasks])

  // 保存块到任务
  const saveBlocks = useCallback((newBlocks: PageBlock[]) => {
    if (taskId) {
      updateContent(taskId, JSON.stringify(newBlocks))
    }
  }, [taskId, updateContent])

  // 处理 "/" 按键
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === '/' && !showMenu) {
      e.preventDefault()
      const rect = inputRef.current?.getBoundingClientRect()
      if (rect) {
        setMenuPosition({ top: rect.bottom + 8, left: rect.left })
        setShowMenu(true)
      }
    } else if (e.key === 'Escape' && showMenu) {
      setShowMenu(false)
    }
  }, [showMenu])

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // 添加新块
  const addBlock = useCallback((type: BlockType) => {
    const blockType = BLOCK_TYPES.find(t => t.type === type)
    const newBlock: PageBlock = {
      id: generateId(),
      type,
      title: blockType?.defaultTitle || '新块',
      content: type === 'json' ? {} : '',
      order: blocks.length
    }

    const newBlocks = [...blocks, newBlock]
    setBlocks(newBlocks)
    saveBlocks(newBlocks)
    setShowMenu(false)
  }, [blocks, saveBlocks])

  const task = tasks.find(t => t.id === taskId)

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

  return (
    <PageLayout
      title={task.name}
      subtitle="Notion风格页面编辑器"
      icon={task.icon}
      showBack
      onBack={() => {
        setCurrentTask(null)
        setUIState({ currentView: 'tasks' })
      }}
      variant="blog"
    >
      <div className="max-w-3xl mx-auto">
        {/* 提示 */}
        <div className="mb-6 p-4 bg-neutral-800/50 rounded-lg border border-neutral-700">
          <p className="text-sm text-neutral-400">
            💡 <strong>操作说明：</strong> 点击下方输入框，输入 "/" 添加新块；点击块进行编辑
          </p>
        </div>

        {/* 输入区域 - 用于触发 "/" 命令 */}
        <div
          ref={inputRef}
          className="mb-6 p-4 border-2 border-dashed border-neutral-700 rounded-lg bg-neutral-900/30 text-neutral-500 text-sm cursor-text"
          onClick={() => inputRef.current?.focus()}
          tabIndex={0}
          onKeyDown={handleKeyDown}
        >
          点击这里，输入 <kbd className="px-1.5 py-0.5 bg-neutral-800 rounded text-neutral-300">/</kbd> 添加新块...
        </div>

        {/* 块列表 */}
        <div className="space-y-2">
          {blocks.map((block) => {
            const blockType = BLOCK_TYPES.find(t => t.type === block.type)
            const Icon = blockType?.icon || Type

            return (
              <div
                key={block.id}
                className="group flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                onClick={() => {
                  // 简单的编辑方式：直接用 alert 或者后续做模态框
                  alert(`编辑块: ${block.title}\n\n（完整的编辑页面功能开发中...）`)
                }}
              >
                {/* 块图标 */}
                <div className="p-2 bg-neutral-800 rounded-lg">
                  <Icon className="w-4 h-4 text-neutral-400" />
                </div>

                {/* 块标题 */}
                <div className="flex-1">
                  <div className="font-medium text-neutral-200">
                    {block.title || blockType?.defaultTitle || '未命名块'}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {blockType?.label}
                  </div>
                </div>

                {/* 箭头 */}
                <ChevronRight className="w-5 h-5 text-neutral-600 group-hover:text-neutral-400 transition-colors" />
              </div>
            )
          })}
        </div>

        {/* 空状态 */}
        {blocks.length === 0 && (
          <div className="text-center py-16">
            <div className="text-neutral-500 mb-4">还没有块</div>
            <div className="text-sm text-neutral-600">输入 "/" 添加第一个块</div>
          </div>
        )}

        {/* 块菜单 */}
        {showMenu && (
          <div
            ref={menuRef}
            className="fixed bg-neutral-800 rounded-lg shadow-xl border border-neutral-700 p-2 z-50 min-w-[240px]"
            style={{
              top: menuPosition.top,
              left: menuPosition.left
            }}
          >
            <div className="text-xs text-neutral-500 mb-2 px-2">选择块类型</div>
            {BLOCK_TYPES.map((blockType) => {
              const Icon = blockType.icon
              return (
                <button
                  key={blockType.type}
                  onClick={() => addBlock(blockType.type)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-white/10 text-left"
                >
                  <Icon className="w-4 h-4 text-neutral-400" />
                  <div>
                    <div className="text-sm font-medium">{blockType.label}</div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </PageLayout>
  )
}

export default NotionPageView