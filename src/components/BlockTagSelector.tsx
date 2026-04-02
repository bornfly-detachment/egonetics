// ============================================================
//  BlockTagSelector.tsx  —  级联标签选择器组件（含 CRUD）
// ============================================================
import React, { useState } from 'react'
import {
  ChevronRight,
  Check,
  X,
  Tag as TagIcon,
  Plus,
  Pencil,
  Trash2,
  Save,
  Settings,
} from 'lucide-react'
import type { BlockTagNode, BlockTagRef } from './types'
import { useBlockTags } from '../hooks/useBlockTags'

interface BlockTagSelectorProps {
  selectedTags: BlockTagRef[]
  tagTree?: BlockTagNode[]
  onChange: (tags: BlockTagRef[]) => void
  onClose: () => void
}

// 检查标签是否已选中
function isTagSelected(selectedTags: BlockTagRef[], tagId: string): boolean {
  return selectedTags.some((t) => t.tagId === tagId)
}

// 获取标签的完整路径
function getTagPath(tree: BlockTagNode[], targetId: string): string[] {
  for (const node of tree) {
    if (node.id === targetId) {
      return [node.name]
    }
    if (node.children) {
      const childPath = getTagPath(node.children, targetId)
      if (childPath.length > 0) {
        return [node.name, ...childPath]
      }
    }
  }
  return []
}

// 获取 targetId 节点的所有兄弟节点 id（不含自身）
function getSiblingIds(tree: BlockTagNode[], targetId: string): string[] {
  for (const node of tree) {
    if (node.children) {
      if (node.children.some(c => c.id === targetId)) {
        return node.children.filter(c => c.id !== targetId).map(c => c.id)
      }
      const found = getSiblingIds(node.children, targetId)
      if (found.length > 0 || node.children.some(c => c.id === targetId)) return found
    }
  }
  return []
}

// 预设颜色选项
const COLOR_OPTIONS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#6b7280',
]

// 标签树节点（带编辑功能）
function EditableTagTreeNode({
  node,
  path,
  selectedTags,
  onToggle,
  onEdit,
  onDelete,
  onAddChild,
  level = 0,
  editingId,
  onStartEdit,
  parentSelectMode = 'multi',
}: {
  node: BlockTagNode
  path: string[]
  selectedTags: BlockTagRef[]
  onToggle: (node: BlockTagNode, path: string[], parentSelectMode: 'single' | 'multi') => void
  onEdit: (node: BlockTagNode, name: string, color: string) => void
  onDelete: (node: BlockTagNode) => void
  onAddChild: (parent: BlockTagNode) => void
  level?: number
  editingId: string | null
  onStartEdit: (node: BlockTagNode) => void
  parentSelectMode?: 'single' | 'multi'
}) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [editName, setEditName] = useState(node.name)
  const [editColor, setEditColor] = useState(node.color || '#6b7280')
  const hasChildren    = node.children && node.children.length > 0
  const isSelected     = isTagSelected(selectedTags, node.id)
  const isEditing      = editingId === node.id
  const currentPath    = [...path, node.name]
  const isSingleChild  = parentSelectMode === 'single'  // 我在单选组里

  const handleSave = () => {
    if (editName.trim()) {
      onEdit(node, editName.trim(), editColor)
    } else {
      setEditName(node.name)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      setEditName(node.name)
      setEditColor(node.color || '#6b7280')
    }
  }

  if (isEditing) {
    return (
      <div key={node.id} className="select-none" style={{ paddingLeft: `${level * 12 + 8}px` }}>
        <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-blue-500/10">
          <div className="w-[22px]" />
          <input
            autoFocus
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            className="flex-1 bg-transparent text-sm text-neutral-200 outline-none border-b border-neutral-600 focus:border-blue-400"
            placeholder="标签名称"
          />
          <div className="flex gap-1">
            {COLOR_OPTIONS.map((color) => (
              <button
                key={color}
                onClick={() => setEditColor(color)}
                className={`w-4 h-4 rounded-full border-2 ${
                  editColor === color ? 'border-white' : 'border-transparent'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <button onClick={handleSave} className="p-1 hover:bg-white/10 rounded text-green-400">
            <Save size={14} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div key={node.id} className="select-none">
      <div
        className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors group ${
          isSelected
            ? isSingleChild
              ? 'bg-amber-500/15 text-amber-300'
              : 'bg-blue-500/20 text-blue-300'
            : 'hover:bg-white/5 text-neutral-300'
        }`}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => onToggle(node, currentPath, parentSelectMode)}
      >
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setIsExpanded(!isExpanded)
            }}
            className="p-0.5 hover:bg-white/10 rounded"
          >
            <ChevronRight
              size={14}
              className={`transition-transform text-neutral-500 ${isExpanded ? 'rotate-90' : ''}`}
            />
          </button>
        )}
        {!hasChildren && <span className="w-[22px]" />}

        <span
          className="w-3 h-3 rounded-full shrink-0"
          style={{ backgroundColor: node.color || '#6b7280' }}
        />

        <span className="flex-1 text-sm">{node.name}</span>

        {/* 选中指示：单选=实心圆，多选=勾 */}
        {isSingleChild ? (
          <span className={`shrink-0 w-3 h-3 rounded-full border-2 flex items-center justify-center ${
            isSelected ? 'border-amber-400 bg-amber-400' : 'border-neutral-600'
          }`}>
            {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white/90" />}
          </span>
        ) : (
          isSelected && <Check size={14} className="text-blue-400 shrink-0" />
        )}

        {/* 编辑按钮 - 悬停显示 */}
        <div className="opacity-0 group-hover:opacity-100 flex gap-0.5">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onAddChild(node)
            }}
            className="p-0.5 hover:bg-white/10 rounded text-neutral-500 hover:text-neutral-300"
            title="添加子标签"
          >
            <Plus size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onStartEdit(node)
            }}
            className="p-0.5 hover:bg-white/10 rounded text-neutral-500 hover:text-neutral-300"
            title="编辑标签"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete(node)
            }}
            className="p-0.5 hover:bg-red-500/20 rounded text-neutral-500 hover:text-red-400"
            title="删除标签"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {hasChildren && isExpanded && node.children && (
        <div className={node.select_mode === 'single' ? 'relative' : ''}>
          {/* 单选组左括线 */}
          {node.select_mode === 'single' && (
            <div
              className="pointer-events-none absolute top-0 bottom-0 w-px"
              style={{ left: `${level * 12 + 14}px`, background: node.color ?? '#f59e0b', opacity: 0.3 }}
            />
          )}
          {node.children.map((child) => (
            <EditableTagTreeNode
              key={child.id}
              node={child}
              path={currentPath}
              selectedTags={selectedTags}
              onToggle={onToggle}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
              level={level + 1}
              editingId={editingId}
              onStartEdit={onStartEdit}
              parentSelectMode={node.select_mode ?? 'multi'}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// 已选标签展示组件
export function SelectedTagsList({
  tags,
  onRemove,
  compact = false,
}: {
  tags: BlockTagRef[]
  onRemove?: (tagId: string) => void
  compact?: boolean
}) {
  if (!tags || tags.length === 0) return null

  return (
    <div className={`flex flex-wrap gap-1 ${compact ? '' : 'mb-2'}`}>
      {tags.map((tag) => (
        <span
          key={tag.tagId}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
          style={{
            backgroundColor: (tag.color || '#6b7280') + '30',
            color: tag.color || '#9ca3af',
            border: '1px solid ' + (tag.color || '#6b7280') + '50',
          }}
        >
          <span className="opacity-70">
            {tag.path
              .slice(0, -1)
              .map((p) => p + '/')
              .join('')}
          </span>
          <span>{tag.name}</span>
          {onRemove && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onRemove(tag.tagId)
              }}
              className="hover:bg-white/10 rounded-full p-0.5"
            >
              <X size={10} />
            </button>
          )}
        </span>
      ))}
    </div>
  )
}

const BlockTagSelector: React.FC<BlockTagSelectorProps> = ({ selectedTags, onChange, onClose }) => {
  const { tagTree, createTag, updateTag, deleteTag } = useBlockTags()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showManageMode, setShowManageMode] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#6b7280')

  const handleToggleTag = (node: BlockTagNode, path: string[], parentSelectMode: 'single' | 'multi') => {
    const isSelected = isTagSelected(selectedTags, node.id)

    if (isSelected) {
      // 取消选中
      onChange(selectedTags.filter((t) => t.tagId !== node.id))
    } else {
      const newTag: BlockTagRef = {
        tagId: node.id,
        path,
        name: node.name,
        color: node.color,
      }
      if (parentSelectMode === 'single') {
        // 单选互斥：找到父节点，移除同级已选的兄弟节点
        const siblings = getSiblingIds(tagTree, node.id)
        const withoutSiblings = selectedTags.filter((t) => !siblings.includes(t.tagId))
        onChange([...withoutSiblings, newTag])
      } else {
        onChange([...selectedTags, newTag])
      }
    }
  }

  const handleRemoveTag = (tagId: string) => {
    onChange(selectedTags.filter((t) => t.tagId !== tagId))
  }

  const handleClearAll = () => {
    onChange([])
  }

  const handleEditTag = (node: BlockTagNode, name: string, color: string) => {
    updateTag(node.id, { name, color })
    setEditingId(null)

    // 同时更新已选标签中的信息
    onChange(
      selectedTags.map((t) => {
        if (t.tagId === node.id) {
          const newPath = getTagPath(tagTree, node.id)
          return { ...t, name, color, path: newPath.length ? newPath : t.path }
        }
        return t
      })
    )
  }

  const handleDeleteTag = (node: BlockTagNode) => {
    if (
      confirm(
        `确定要删除标签 "${node.name}" 吗？${node.children?.length ? ' 这将同时删除所有子标签。' : ''}`
      )
    ) {
      deleteTag(node.id)
      // 同时从已选标签中移除
      onChange(selectedTags.filter((t) => t.tagId !== node.id))
    }
  }

  const handleAddChildTag = (parent: BlockTagNode) => {
    const name = prompt('输入新标签名称：')
    if (name?.trim()) {
      createTag(parent.id, name.trim())
    }
  }

  const handleAddRootTag = () => {
    if (newTagName.trim()) {
      createTag(null, newTagName.trim(), newTagColor)
      setNewTagName('')
    }
  }

  return (
    <div className="bg-[#252525] border border-neutral-700 rounded-lg shadow-xl overflow-hidden w-80">
      {/* 头部 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-700 bg-neutral-800/50">
        <div className="flex items-center gap-2 text-neutral-200">
          <TagIcon size={16} />
          <span className="text-sm font-medium">{showManageMode ? '管理标签' : '选择标签'}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowManageMode(!showManageMode)}
            className={`p-1 rounded transition-colors ${
              showManageMode
                ? 'bg-blue-500/20 text-blue-400'
                : 'hover:bg-white/10 text-neutral-400 hover:text-neutral-200'
            }`}
            title="管理标签"
          >
            <Settings size={16} />
          </button>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded text-neutral-400 hover:text-neutral-200"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* 已选标签 */}
      {!showManageMode && selectedTags.length > 0 && (
        <div className="px-3 py-2 border-b border-neutral-700/50 bg-neutral-900/30">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-neutral-500">已选 {selectedTags.length} 个标签</span>
            <button
              onClick={handleClearAll}
              className="text-xs text-neutral-500 hover:text-red-400"
            >
              清空
            </button>
          </div>
          <SelectedTagsList tags={selectedTags} onRemove={handleRemoveTag} />
        </div>
      )}

      {/* 管理模式 - 添加根标签 */}
      {showManageMode && (
        <div className="px-3 py-2 border-b border-neutral-700/50 bg-neutral-900/30">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddRootTag()}
                placeholder="新标签名称"
                className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm text-neutral-200 outline-none focus:border-blue-400"
              />
            </div>
            <div className="flex gap-1">
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color}
                  onClick={() => setNewTagColor(color)}
                  className={`w-5 h-5 rounded-full border-2 ${
                    newTagColor === color ? 'border-white' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <button
              onClick={handleAddRootTag}
              disabled={!newTagName.trim()}
              className="px-2 py-1 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm text-white"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      )}

      {/* 标签树 */}
      <div className="max-h-80 overflow-y-auto p-2">
        {tagTree.map((node) => (
          <EditableTagTreeNode
            key={node.id}
            node={node}
            path={[]}
            selectedTags={selectedTags}
            onToggle={handleToggleTag}
            onEdit={handleEditTag}
            onDelete={handleDeleteTag}
            onAddChild={handleAddChildTag}
            editingId={editingId}
            onStartEdit={(node) => setEditingId(node.id)}
            parentSelectMode="multi"
          />
        ))}
      </div>
    </div>
  )
}

export default BlockTagSelector
