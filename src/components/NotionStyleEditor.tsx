import React, { useState } from 'react'
import { Plus, Trash2, GripVertical } from 'lucide-react'
import BlockWrapper from './blocks/BlockWrapper'
import MarkdownBlock from './blocks/MarkdownBlock'
import JsonBlock from './blocks/JsonBlock'
import ImageBlock from './blocks/ImageBlock'
import VideoBlock from './blocks/VideoBlock'
import AudioBlock from './blocks/AudioBlock'
import { PageBlock, BlockType } from './NotionPageView'

interface NotionStyleEditorProps {
  initialBlocks?: PageBlock[]
  onChange?: (blocks: PageBlock[]) => void
}

const BLOCK_TYPE_OPTIONS: { type: BlockType; label: string; icon: string }[] = [
  { type: 'paragraph', label: '段落', icon: '📝' },
  { type: 'markdown', label: 'Markdown', icon: '📄' },
  { type: 'json', label: 'JSON', icon: '{}' },
  { type: 'image', label: '图片', icon: '🖼️' },
  { type: 'video', label: '视频', icon: '🎬' },
  { type: 'audio', label: '音频', icon: '🎵' },
  { type: 'subpage', label: '子页面', icon: '📂' },
]

const NotionStyleEditor: React.FC<NotionStyleEditorProps> = ({ initialBlocks = [], onChange }) => {
  const [blocks, setBlocks] = useState<PageBlock[]>(initialBlocks)
  const [showBlockMenu, setShowBlockMenu] = useState<string | null>(null)

  const updateBlocks = (newBlocks: PageBlock[]) => {
    setBlocks(newBlocks)
    onChange?.(newBlocks)
  }

  const addBlock = (afterId: string | null, type: BlockType) => {
    const newBlock: PageBlock = {
      id: `block-${Date.now()}-${Math.random()}`,
      type,
      content: type === 'json' ? {} : type === 'image' || type === 'video' || type === 'audio' ? '' : '',
      order: blocks.length,
    }

    let newBlocks: PageBlock[]
    if (afterId === null) {
      newBlocks = [...blocks, newBlock]
    } else {
      const index = blocks.findIndex(b => b.id === afterId)
      newBlocks = [
        ...blocks.slice(0, index + 1),
        newBlock,
        ...blocks.slice(index + 1),
      ]
    }

    // 重新排序
    newBlocks = newBlocks.map((b, idx) => ({ ...b, order: idx }))
    updateBlocks(newBlocks)
    setShowBlockMenu(null)
  }

  const deleteBlock = (id: string) => {
    const newBlocks = blocks.filter(b => b.id !== id).map((b, idx) => ({ ...b, order: idx }))
    updateBlocks(newBlocks)
  }

  const updateBlock = (id: string, updates: Partial<PageBlock>) => {
    const newBlocks = blocks.map(b => b.id === id ? { ...b, ...updates } : b)
    updateBlocks(newBlocks)
  }

  const renderBlock = (block: PageBlock) => {
    const commonProps = {
      key: block.id,
      className: 'group',
    }

    return (
      <div {...commonProps}>
        {/* Block Controls */}
        <div className="flex items-start gap-2 opacity-0 group-hover:opacity-100 transition-opacity -ml-12 w-12">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowBlockMenu(showBlockMenu === block.id ? null : block.id)
            }}
            className="p-1 hover:bg-white/10 rounded"
          >
            <Plus className="w-3 h-3 text-neutral-400" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              deleteBlock(block.id)
            }}
            className="p-1 hover:bg-white/10 rounded"
          >
            <Trash2 className="w-3 h-3 text-red-400" />
          </button>
        </div>

        {/* Block Content */}
        <div className="flex-1">
          {renderBlockContent(block)}
        </div>

        {/* Add Block Menu */}
        {showBlockMenu === block.id && (
          <div className="absolute z-50 mt-1 bg-neutral-800/95 backdrop-blur-sm rounded-lg shadow-xl py-2 border border-white/10 min-w-[180px]">
            {BLOCK_TYPE_OPTIONS.map(({ type, label, icon }) => (
              <button
                key={type}
                onClick={() => addBlock(block.id, type)}
                className="w-full px-4 py-2 text-left text-sm hover:bg-white/10 flex items-center gap-2"
              >
                <span>{icon}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  const renderBlockContent = (block: PageBlock) => {
    switch (block.type) {
      case 'paragraph':
        return (
          <BlockWrapper>
            <div className="text-neutral-200 leading-relaxed">
              {typeof block.content === 'string' ? block.content : ''}
            </div>
          </BlockWrapper>
        )
      case 'markdown':
        return (
          <MarkdownBlock
            content={typeof block.content === 'string' ? block.content : ''}
            onChange={(content) => updateBlock(block.id, { content })}
          />
        )
      case 'json':
        return (
          <JsonBlock
            content={block.content}
            onChange={(content) => updateBlock(block.id, { content })}
          />
        )
      case 'image':
        return (
          <ImageBlock
            content={block.content}
            onChange={(content) => updateBlock(block.id, { content })}
          />
        )
      case 'video':
        return (
          <VideoBlock
            content={block.content}
            onChange={(content) => updateBlock(block.id, { content })}
          />
        )
      case 'audio':
        return (
          <AudioBlock
            content={block.content}
            onChange={(content) => updateBlock(block.id, { content })}
          />
        )
      case 'subpage':
        return (
          <BlockWrapper>
            <div className="flex items-center gap-2 p-3 bg-neutral-900/50 border border-neutral-700 rounded-lg">
              <span>📂</span>
              <span className="text-neutral-300">
                {typeof block.content === 'string' ? block.content : '子页面'}
              </span>
            </div>
          </BlockWrapper>
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-1">
      {/* Blocks */}
      <div className="space-y-1">
        {blocks.map(renderBlock)}
      </div>

      {/* Add Block Button */}
      <div className="pt-2">
        <button
          onClick={() => setShowBlockMenu(showBlockMenu === 'new' ? null : 'new')}
          className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-400 hover:text-neutral-200 hover:bg-white/5 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>添加块</span>
        </button>

        {showBlockMenu === 'new' && (
          <div className="mt-1 bg-neutral-800/95 backdrop-blur-sm rounded-lg shadow-xl py-2 border border-white/10 min-w-[180px]">
            {BLOCK_TYPE_OPTIONS.map(({ type, label, icon }) => (
              <button
                key={type}
                onClick={() => addBlock(null, type)}
                className="w-full px-4 py-2 text-left text-sm hover:bg-white/10 flex items-center gap-2"
              >
                <span>{icon}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default NotionStyleEditor
