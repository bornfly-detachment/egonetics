import React, { useState } from 'react'
import { Video, Edit3, Eye } from 'lucide-react'
import BlockWrapper from './BlockWrapper'

interface VideoBlockProps {
  content: string | Record<string, any>
  onChange?: (content: string | Record<string, any>) => void
}

const VideoBlock: React.FC<VideoBlockProps> = ({ content, onChange }) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editUrl, setEditUrl] = useState(
    typeof content === 'string' ? content : content.url
  )
  const [editAutoplay, setEditAutoplay] = useState(
    typeof content === 'string' ? false : content.autoplay || false
  )
  const [editControls, setEditControls] = useState(
    typeof content === 'string' ? true : content.controls !== false
  )

  const handleSave = () => {
    onChange?.({ url: editUrl, autoplay: editAutoplay, controls: editControls })
    setIsEditing(false)
  }

  const url = typeof content === 'string' ? content : content.url
  const autoplay = typeof content === 'string' ? false : content.autoplay || false
  const controls = typeof content === 'string' ? true : content.controls !== false

  return (
    <BlockWrapper>
      <div className="flex items-start justify-between mb-2">
        <div className="text-xs text-neutral-500">视频</div>
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
            placeholder="输入视频 URL..."
          />
          <div className="flex gap-4 text-sm text-neutral-300">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={editAutoplay}
                onChange={(e) => setEditAutoplay(e.target.checked)}
                className="w-4 h-4 rounded accent-primary-500"
              />
              自动播放
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={editControls}
                onChange={(e) => setEditControls(e.target.checked)}
                className="w-4 h-4 rounded accent-primary-500"
              />
              显示控制条
            </label>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="btn-primary text-sm px-3 py-1"
            >
              保存
            </button>
            <button
              onClick={() => {
                setEditUrl(typeof content === 'string' ? content : content.url)
                setEditAutoplay(typeof content === 'string' ? false : content.autoplay || false)
                setEditControls(typeof content === 'string' ? true : content.controls !== false)
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
            <video
              src={url}
              autoPlay={autoplay}
              controls={controls}
              className="max-w-full rounded-lg border border-neutral-700"
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 bg-neutral-900/50 border border-neutral-700 rounded-lg border-dashed">
              <Video className="w-12 h-12 text-neutral-500 mb-3" />
              <p className="text-neutral-400 text-sm">点击编辑添加视频</p>
            </div>
          )}
        </div>
      )}
    </BlockWrapper>
  )
}

export default VideoBlock
