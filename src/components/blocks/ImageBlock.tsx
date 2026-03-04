import React, { useState } from 'react'
import { Image as ImageIcon, Edit3, Eye } from 'lucide-react'
import BlockWrapper from './BlockWrapper'

interface ImageBlockProps {
  content: string | Record<string, any>
  onChange?: (content: string | Record<string, any>) => void
}

const ImageBlock: React.FC<ImageBlockProps> = ({ content, onChange }) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editUrl, setEditUrl] = useState(typeof content === 'string' ? content : content.url)
  const [editAlt, setEditAlt] = useState(typeof content === 'string' ? '' : content.alt || '')

  const handleSave = () => {
    onChange?.({ url: editUrl, alt: editAlt })
    setIsEditing(false)
  }

  const url = typeof content === 'string' ? content : content.url
  const alt = typeof content === 'string' ? '' : content.alt || ''

  return (
    <BlockWrapper>
      <div className="flex items-start justify-between mb-2">
        <div className="text-xs text-neutral-500">图片</div>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-neutral-200"
        >
          {isEditing ? <Eye className="w-3 h-3" /> : <Edit3 className="w-3 h-3" />}
        </button>
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <input
            type="text"
            value={editUrl}
            onChange={(e) => setEditUrl(e.target.value)}
            className="w-full bg-neutral-900/50 border border-neutral-700 rounded-lg p-2 text-neutral-200 text-sm focus:border-primary-500 focus:outline-none"
            placeholder="输入图片 URL..."
          />
          <input
            type="text"
            value={editAlt}
            onChange={(e) => setEditAlt(e.target.value)}
            className="w-full bg-neutral-900/50 border border-neutral-700 rounded-lg p-2 text-neutral-200 text-sm focus:border-primary-500 focus:outline-none"
            placeholder="替代文本（可选）"
          />
          <div className="flex gap-2">
            <button onClick={handleSave} className="btn-primary text-sm px-3 py-1">
              保存
            </button>
            <button
              onClick={() => {
                setEditUrl(typeof content === 'string' ? content : content.url)
                setEditAlt(typeof content === 'string' ? '' : content.alt || '')
                setIsEditing(false)
              }}
              className="btn-secondary text-sm px-3 py-1"
            >
              取消
            </button>
          </div>
        </div>
      ) : (
        <div className="relative group">
          {url ? (
            <img
              src={url}
              alt={alt}
              className="max-w-full rounded-lg border border-neutral-700"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 bg-neutral-900/50 border border-neutral-700 rounded-lg border-dashed">
              <ImageIcon className="w-12 h-12 text-neutral-500 mb-3" />
              <p className="text-neutral-400 text-sm">点击编辑添加图片</p>
            </div>
          )}
        </div>
      )}
    </BlockWrapper>
  )
}

export default ImageBlock
