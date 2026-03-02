import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Plus, Trash2, GripVertical, Type, Heading1, Heading2, Heading3, List, CheckSquare, Quote, Save } from 'lucide-react'
import { useDrag, useDrop } from 'react-dnd'

// 块类型定义
export type BlockType =
  | 'paragraph'    // 段落
  | 'heading1'     // 一级标题
  | 'heading2'     // 二级标题
  | 'heading3'     // 三级标题
  | 'bullet'       // 无序列表
  | 'todo'         // 待办事项
  | 'quote'        // 引用块
  | 'code'         // 代码块

// 块数据结构
export interface Block {
  id: string
  parentId: string | null
  type: BlockType
  content: string
  position: number
}

// 块类型信息
const BLOCK_TYPES = [
  { type: 'paragraph' as const, label: '段落', icon: Type },
  { type: 'heading1' as const, label: '标题 1', icon: Heading1 },
  { type: 'heading2' as const, label: '标题 2', icon: Heading2 },
  { type: 'heading3' as const, label: '标题 3', icon: Heading3 },
  { type: 'bullet' as const, label: '无序列表', icon: List },
  { type: 'todo' as const, label: '待办事项', icon: CheckSquare },
  { type: 'quote' as const, label: '引用块', icon: Quote },
  { type: 'code' as const, label: '代码块', icon: Type },
]

// 拖放项类型
const ItemTypes = {
  BLOCK: 'block'
}

// 生成唯一 ID
const generateId = () => `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

// 可拖动的块组件
const DraggableBlock: React.FC<{
  block: Block
  blocksMap: Map<string, Block>
  getChildren: (parentId: string | null) => Block[]
  moveBlock: (dragId: string, targetId: string, position: 'before' | 'after' | 'inside') => void
  updateBlock: (id: string, updates: Partial<Block>) => void
  deleteBlock: (id: string) => void
  onBlockClick: (block: Block) => void
  level: number
  onAddBlock: (parentId: string | null, position: 'before' | 'after' | 'inside', type: BlockType) => void
}> = ({ block, blocksMap, getChildren, moveBlock, updateBlock, deleteBlock, onBlockClick, onAddBlock, level }) => {
  const ref = useRef<HTMLDivElement>(null)

  const [{ isDragging }, drag, preview] = useDrag({
    type: ItemTypes.BLOCK,
    item: {
      id: block.id,
      type: ItemTypes.BLOCK,
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  })

  const [, drop] = useDrop({
    accept: ItemTypes.BLOCK,
    hover: (item: any, monitor) => {
      if (!ref.current) return

      const dragId = item.id
      if (dragId === block.id) return

      const hoverBoundingRect = ref.current.getBoundingClientRect()
      const clientOffset = monitor.getClientOffset()
      const hoverClientY = clientOffset!.y - hoverBoundingRect.top

      let position: 'before' | 'after' | 'inside' = 'after'
      if (hoverClientY < hoverBoundingRect.height * 0.25) {
        position = 'before'
      } else if (hoverClientY > hoverBoundingRect.height * 0.75 && level < 3) {
        position = 'inside'
      }

      moveBlock(dragId, block.id, position)
    },
  })

  drag(drop(ref))

  const opacity = isDragging ? 0.4 : 1

  return (
    <div
      ref={preview}
      style={{ opacity }}
      className="group"
    >
      <div
        ref={ref}
        className="flex items-start gap-2 p-2 rounded hover:bg-white/5 transition-colors"
        style={{ marginLeft: `${level * 24}px` }}
      >
        {/* 拖拽手柄 */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity pt-1">
          <GripVertical className="w-4 h-4 text-neutral-500 cursor-move" />
        </div>

        {/* 块内容 */}
        <div className="flex-1" onClick={() => onBlockClick(block)}>
          {renderBlockContent(
            block,
            (content) => updateBlock(block.id, { content }),
            () => {},
            () => {}
          )}
        </div>

        {/* 块操作按钮 */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onAddBlock(block.id, 'after', 'paragraph')
            }}
            className="p-1 hover:bg-white/10 rounded"
          >
            <Plus className="w-4 h-4 text-neutral-400" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              deleteBlock(block.id)
            }}
            className="p-1 hover:bg-red/20 hover:text-red-400 rounded"
          >
            <Trash2 className="w-4 h-4 text-neutral-400" />
          </button>
        </div>
      </div>

      {/* 子块 */}
      {getChildren(block.id).map(child => (
        <DraggableBlock
          key={child.id}
          block={child}
          blocksMap={blocksMap}
          getChildren={getChildren}
          moveBlock={moveBlock}
          updateBlock={updateBlock}
          deleteBlock={deleteBlock}
          onBlockClick={onBlockClick}
          level={level + 1}
          onAddBlock={onAddBlock}
        />
      ))}
    </div>
  )
}

// 块内容编辑组件
const BlockContentEditor: React.FC<{
  block: Block
  onUpdate: (content: string) => void
  onCancel: () => void
  onSave: () => void
}> = ({ block, onUpdate, onCancel, onSave }) => {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(block.content)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [editing])

  // 同步 editValue 和 block.content
  useEffect(() => {
    setEditValue(block.content)
  }, [block.content])

  const handleSave = () => {
    onUpdate(editValue)
    setEditing(false)
    onSave()
  }

  const handleCancel = () => {
    setEditValue(block.content)
    setEditing(false)
    onCancel()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancel()
    }
  }

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditing(true)
  }

  if (editing) {
    return (
      <div className="space-y-2">
        <textarea
          ref={textareaRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full bg-neutral-800 border border-neutral-700 rounded-lg p-3 text-neutral-200 text-sm focus:border-primary-500 focus:outline-none min-h-[80px]"
          placeholder="输入内容..."
          spellCheck={false}
        />
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="px-3 py-1 bg-primary-500 hover:bg-primary-600 text-white text-sm rounded transition-colors flex items-center gap-1"
          >
            <Save className="w-3 h-3" />
            保存
          </button>
          <button
            onClick={handleCancel}
            className="px-3 py-1 bg-neutral-700 hover:bg-neutral-600 text-neutral-200 text-sm rounded transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    )
  }

  const { type, content } = block
  const baseStyle = 'leading-relaxed'

  const getPlaceholder = () => {
    switch (type) {
      case 'heading1':
      case 'heading2':
      case 'heading3':
        return '点击输入标题...'
      case 'bullet':
        return '点击输入内容...'
      case 'todo':
        return '点击输入待办事项...'
      case 'quote':
        return '点击输入引用内容...'
      case 'code':
        return '点击输入代码...'
      default:
        return '点击输入内容...'
    }
  }

  const getBlockStyle = () => {
    switch (type) {
      case 'heading1':
        return `${baseStyle} text-3xl font-bold text-neutral-100 mt-4 mb-2`
      case 'heading2':
        return `${baseStyle} text-2xl font-semibold text-neutral-100 mt-3 mb-1`
      case 'heading3':
        return `${baseStyle} text-xl font-medium text-neutral-100 mt-2 mb-1`
      case 'quote':
        return `${baseStyle} text-neutral-300 italic pl-4 border-l-2 border-neutral-600 my-4`
      case 'code':
        return `${baseStyle} text-neutral-300 bg-neutral-800 p-4 rounded-lg font-mono text-sm my-4`
      default:
        return `${baseStyle} text-neutral-200`
    }
  }

  return (
    <div className="flex items-start gap-2 w-full">
      <div
        className={`flex-1 ${getBlockStyle()} cursor-text hover:bg-white/5 rounded px-2 py-1 -mx-2 transition-colors`}
        onClick={handleEditClick}
      >
        {type === 'bullet' && (
          <span className="inline-block w-2 h-2 rounded-full bg-neutral-500 mr-2 mt-2" />
        )}
        {type === 'todo' && (
          <span className="inline-flex items-center mr-2">
            <CheckSquare className="w-4 h-4 text-neutral-500 mr-1" />
          </span>
        )}
        {content || <span className="text-neutral-500 italic">{getPlaceholder()}</span>}
      </div>
      <button
        onClick={handleEditClick}
        className="p-1 rounded hover:bg-white/10 text-neutral-400 transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
        title="编辑块内容"
      >
        ✏️
      </button>
    </div>
  )
}

// 渲染块内容
const renderBlockContent = (block: Block, onUpdate: (content: string) => void, onCancel: () => void, onSave: () => void) => {
  return (
    <BlockContentEditor
      block={block}
      onUpdate={onUpdate}
      onCancel={onCancel}
      onSave={onSave}
    />
  )
}

// 博客编辑器组件
const BlogEditor: React.FC<{
  pageId?: string
  initialBlocks?: Block[]
  onSave?: (blocks: Block[]) => void
  readOnly?: boolean
}> = ({ initialBlocks = [], onSave, readOnly = false }) => {
  const [blocksMap, setBlocksMap] = useState<Map<string, Block>>(new Map())
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null)
  const [showSlashMenu, setShowSlashMenu] = useState(false)
  const [slashMenuPosition, setSlashMenuPosition] = useState({ top: 0, left: 0 })
  const [saving, setSaving] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // 初始化块数据
  useEffect(() => {
    if (initialBlocks.length > 0) {
      const map = new Map<string, Block>()
      initialBlocks.forEach(block => {
        map.set(block.id, block)
      })
      setBlocksMap(map)
    } else {
      // 创建一个默认的段落块
      const defaultBlock: Block = {
        id: generateId(),
        parentId: null,
        type: 'paragraph',
        content: '',
        position: 1.0
      }
      setBlocksMap(new Map([[defaultBlock.id, defaultBlock]]))
    }
  }, [initialBlocks])

  // 获取子块
  const getChildren = useCallback((parentId: string | null) => {
    return Array.from(blocksMap.values())
      .filter(block => block.parentId === parentId)
      .sort((a, b) => a.position - b.position)
  }, [blocksMap])

  // 生成新位置
  const generatePosition = useCallback((beforeId?: string, afterId?: string) => {
    if (!beforeId && !afterId) {
      return 1.0
    }

    if (beforeId) {
      const beforeBlock = blocksMap.get(beforeId)
      if (!beforeBlock) return 1.0

      const parentId = beforeBlock.parentId
      const siblings = getChildren(parentId)
      const index = siblings.findIndex(b => b.id === beforeId)

      if (index === 0) {
        return beforeBlock.position / 2
      }

      const previousSibling = siblings[index - 1]
      return (previousSibling.position + beforeBlock.position) / 2
    }

    if (afterId) {
      const afterBlock = blocksMap.get(afterId)
      if (!afterBlock) return 1.0

      const parentId = afterBlock.parentId
      const siblings = getChildren(parentId)
      const index = siblings.findIndex(b => b.id === afterId)

      if (index === siblings.length - 1) {
        return afterBlock.position + 1.0
      }

      const nextSibling = siblings[index + 1]
      return (afterBlock.position + nextSibling.position) / 2
    }

    return 1.0
  }, [blocksMap, getChildren])

  // 添加块
  const onAddBlock = useCallback((parentId: string | null, position: 'before' | 'after' | 'inside', type: BlockType = 'paragraph') => {
    const newBlock: Block = {
      id: generateId(),
      parentId: null,
      type,
      content: '',
      position: 1.0
    }

    if (parentId) {
      if (position === 'inside') {
        newBlock.parentId = parentId
        const children = getChildren(parentId)
        if (children.length === 0) {
          newBlock.position = 1.0
        } else {
          newBlock.position = children[children.length - 1].position + 1.0
        }
      } else {
        const refBlock = blocksMap.get(parentId)
        if (refBlock) {
          newBlock.parentId = refBlock.parentId
          newBlock.position = generatePosition(
            position === 'before' ? parentId : undefined,
            position === 'after' ? parentId : undefined
          )
        }
      }
    }

    setBlocksMap(prev => {
      const newMap = new Map(prev)
      newMap.set(newBlock.id, newBlock)
      return newMap
    })

    setFocusedBlockId(newBlock.id)
  }, [blocksMap, getChildren, generatePosition])

  // 更新块
  const updateBlock = useCallback((id: string, updates: Partial<Block>) => {
    setBlocksMap(prev => {
      const block = prev.get(id)
      if (!block) return prev

      const newBlock = { ...block, ...updates }
      const newMap = new Map(prev)
      newMap.set(id, newBlock)
      return newMap
    })
  }, [blocksMap])

  // 删除块
  const deleteBlock = useCallback((id: string) => {
    const block = blocksMap.get(id)
    if (!block) return

    // 递归删除所有子块
    const deleteRecursive = (blockId: string) => {
      const block = blocksMap.get(blockId)
      if (!block) return []

      const children = getChildren(blockId)
      const toDelete = [blockId]

      children.forEach(child => {
        toDelete.push(...deleteRecursive(child.id))
      })

      return toDelete
    }

    const toDelete = deleteRecursive(id)
    setBlocksMap(prev => {
      const newMap = new Map(prev)
      toDelete.forEach(blockId => {
        newMap.delete(blockId)
      })
      return newMap
    })

    if (focusedBlockId && toDelete.includes(focusedBlockId)) {
      setFocusedBlockId(null)
    }
  }, [blocksMap, getChildren, focusedBlockId])

  // 移动块
  const moveBlock = useCallback((dragId: string, targetId: string, position: 'before' | 'after' | 'inside') => {
    const dragBlock = blocksMap.get(dragId)
    const targetBlock = blocksMap.get(targetId)

    if (!dragBlock || !targetBlock) return

    let newParentId = dragBlock.parentId
    let newPosition = dragBlock.position

    if (position === 'inside') {
      newParentId = targetId
      const children = getChildren(targetId)
      if (children.length === 0) {
        newPosition = 1.0
      } else {
        newPosition = children[children.length - 1].position + 1.0
      }
    } else {
      newParentId = targetBlock.parentId
      newPosition = generatePosition(
        position === 'before' ? targetId : undefined,
        position === 'after' ? targetId : undefined
      )
    }

    setBlocksMap(prev => {
      const newMap = new Map(prev)
      const updatedBlock = { ...dragBlock, parentId: newParentId, position: newPosition }
      newMap.set(dragId, updatedBlock)
      return newMap
    })
  }, [blocksMap, getChildren, generatePosition])

  // 保存文档
  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const blocks = Array.from(blocksMap.values())
      if (onSave) {
        await onSave(blocks)
      } else {
        // 默认保存到 localStorage
        localStorage.setItem('blog-content', JSON.stringify(blocks))
        alert('文档已保存到浏览器本地存储')
      }
    } catch (error) {
      console.error('保存失败:', error)
      alert('保存失败')
    } finally {
      setSaving(false)
    }
  }, [blocksMap, onSave])

  // 键盘事件处理
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (readOnly) return

    if (e.key === '/' && !showSlashMenu) {
      e.preventDefault()
      const rect = inputRef.current?.getBoundingClientRect()
      if (rect) {
        setSlashMenuPosition({ top: rect.bottom + 8, left: rect.left })
        setShowSlashMenu(true)
      }
    } else if (e.key === 'Escape' && showSlashMenu) {
      e.preventDefault()
      setShowSlashMenu(false)
    } else if (e.key === 'Enter' && !e.shiftKey && focusedBlockId) {
      e.preventDefault()
      const focusedBlock = blocksMap.get(focusedBlockId)
      let blockType: BlockType = 'paragraph'
      if (focusedBlock?.type === 'heading1' || focusedBlock?.type === 'heading2' || focusedBlock?.type === 'heading3' || focusedBlock?.type === 'todo') {
        blockType = 'paragraph'
      } else {
        blockType = focusedBlock?.type || 'paragraph'
      }
      onAddBlock(focusedBlockId, 'after', blockType)
    } else if (e.key === 'Backspace' && focusedBlockId) {
      const focusedBlock = blocksMap.get(focusedBlockId)
      if (focusedBlock && !focusedBlock.content) {
        e.preventDefault()
        const siblings = getChildren(focusedBlock.parentId || null)
        const index = siblings.findIndex(b => b.id === focusedBlockId)
        if (index > 0) {
          const previousSibling = siblings[index - 1]
          deleteBlock(focusedBlockId)
          setFocusedBlockId(previousSibling.id)
        } else if (focusedBlock.parentId) {
          const parentBlock = blocksMap.get(focusedBlock.parentId)
          deleteBlock(focusedBlockId)
          setFocusedBlockId(parentBlock?.id || null)
        } else {
          // 不能删除最后一个块
          const defaultBlock: Block = {
            id: generateId(),
            parentId: null,
            type: 'paragraph',
            content: '',
            position: 1.0
          }
          setBlocksMap(new Map([[defaultBlock.id, defaultBlock]]))
          setFocusedBlockId(defaultBlock.id)
        }
      }
    } else if (e.key === 'Tab' && focusedBlockId) {
      e.preventDefault()
      const focusedBlock = blocksMap.get(focusedBlockId)
      if (!focusedBlock) return

      if (e.shiftKey) {
        // Shift+Tab - 提升层级
        if (focusedBlock.parentId) {
          const parentBlock = blocksMap.get(focusedBlock.parentId)
          if (parentBlock) {
            moveBlock(focusedBlockId, parentBlock.id, 'after')
          }
        }
      } else {
        // Tab - 降低层级
        const siblings = getChildren(focusedBlock.parentId || null)
        const index = siblings.findIndex(b => b.id === focusedBlockId)
        if (index > 0) {
          const previousSibling = siblings[index - 1]
          moveBlock(focusedBlockId, previousSibling.id, 'inside')
        }
      }
    }
  }, [readOnly, showSlashMenu, focusedBlockId, blocksMap, onAddBlock, deleteBlock, moveBlock, getChildren])

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowSlashMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // 组件挂载时自动聚焦到隐藏输入框
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  // 点击页面时重新聚焦到隐藏输入框
  const handlePageClick = () => {
    if (inputRef.current && document.activeElement !== inputRef.current) {
      inputRef.current.focus()
    }
  }

  // 渲染编辑器
  return (
    <div className="min-h-screen bg-neutral-900 p-8 font-sans" onClick={handlePageClick}>
      <div className="max-w-3xl mx-auto">
        {/* 标题栏 */}
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-white mb-2">我的博客文章</h1>
          <div className="flex items-center gap-4 text-neutral-400">
            <span className="text-sm">2026年3月2日</span>
            <span className="text-sm">•</span>
            <span className="text-sm">阅读时间: 5分钟</span>
          </div>
        </div>

        {/* 操作栏 */}
        {!readOnly && (
          <div className="mb-6 flex items-center gap-3">
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
              disabled={saving}
            >
              <Save className="w-4 h-4" />
              {saving ? '保存中...' : '保存文档'}
            </button>
            <div className="text-sm text-neutral-400">
              💡 点击块内容编辑；输入 "/" 快速添加块；拖拽块左侧的手柄可以重新排序
            </div>
          </div>
        )}

        {/* 块列表 */}
        <div className="space-y-2">
          {getChildren(null).map(block => (
            <DraggableBlock
              key={block.id}
              block={block}
              blocksMap={blocksMap}
              getChildren={getChildren}
              moveBlock={moveBlock}
              updateBlock={updateBlock}
              deleteBlock={deleteBlock}
              onBlockClick={(block) => setFocusedBlockId(block.id)}
              level={0}
              onAddBlock={onAddBlock}
            />
          ))}
        </div>

        {/* 空状态 */}
        {getChildren(null).length === 0 && (
          <div className="text-center py-16">
            <div className="text-neutral-500 mb-4">还没有内容</div>
            {!readOnly && (
              <button
                onClick={() => onAddBlock(null, 'after', 'paragraph')}
                className="px-6 py-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg transition-colors"
              >
                添加第一个块
              </button>
            )}
          </div>
        )}

        {/* 斜杠菜单 */}
        {showSlashMenu && (
          <div
            ref={menuRef}
            className="fixed bg-neutral-800 rounded-lg shadow-xl border border-neutral-700 p-2 z-50 min-w-[240px]"
            style={{
              top: slashMenuPosition.top,
              left: slashMenuPosition.left
            }}
          >
            <div className="text-xs text-neutral-500 mb-2 px-2">选择块类型</div>
            {BLOCK_TYPES.map((blockType) => {
              const Icon = blockType.icon
              return (
                <button
                  key={blockType.type}
                  onClick={() => {
                    if (focusedBlockId) {
                      updateBlock(focusedBlockId, { type: blockType.type })
                    } else {
                      onAddBlock(null, 'after', blockType.type)
                    }
                    setShowSlashMenu(false)
                  }}
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

        {/* 隐藏的输入框，用于捕获键盘事件 */}
        <input
          ref={inputRef}
          className="fixed -top-10 -left-10 w-1 h-1 opacity-0"
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onFocus={(e) => (e.target as HTMLInputElement).blur()}
          onClick={(e) => (e.target as HTMLInputElement).blur()}
        />
      </div>
    </div>
  )
}

export default BlogEditor
