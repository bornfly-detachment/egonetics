import React, { useState } from 'react'
import { Edit3, Eye } from 'lucide-react'
import BlockWrapper from './BlockWrapper'

interface MarkdownBlockProps {
  content: string
  onChange?: (content: string) => void
}

const MarkdownBlock: React.FC<MarkdownBlockProps> = ({ content, onChange }) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(content)

  const handleSave = () => {
    onChange?.(editValue)
    setIsEditing(false)
  }

  // 简单的 Markdown 渲染
  const renderMarkdown = (md: string) => {
    return md
      .replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
      .replace(/^## (.*$)/gm, '<h2 class="text-xl font-bold mt-6 mb-3">$1</h2>')
      .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mt-8 mb-4 gradient-text">$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-neutral-800 px-1 py-0.5 rounded text-sm font-mono">$1</code>')
      .replace(/\n/g, '<br />')
  }

  return (
    <BlockWrapper>
      <div className="flex items-start justify-between mb-2">
        <div className="text-xs text-neutral-500">Markdown</div>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-neutral-200"
        >
          {isEditing ? <Eye className="w-3 h-3" /> : <Edit3 className="w-3 h-3" />}
        </button>
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="w-full bg-neutral-900/50 border border-neutral-700 rounded-lg p-3 text-neutral-200 font-mono text-sm focus:border-primary-500 focus:outline-none min-h-[150px]"
            placeholder="输入 Markdown..."
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="btn-primary text-sm px-3 py-1"
            >
              保存
            </button>
            <button
              onClick={() => {
                setEditValue(content)
                setIsEditing(false)
              }}
              className="btn-secondary text-sm px-3 py-1"
            >
              取消
            </button>
          </div>
        </div>
      ) : (
        <div
          className="text-neutral-200 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
        />
      )}
    </BlockWrapper>
  )
}

export default MarkdownBlock
