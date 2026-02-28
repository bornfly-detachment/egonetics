import React, { useState } from 'react'
import { Edit3, Eye, Copy, Check } from 'lucide-react'
import BlockWrapper from './BlockWrapper'

interface JsonBlockProps {
  content: Record<string, any> | string
  onChange?: (content: Record<string, any> | string) => void
}

const JsonBlock: React.FC<JsonBlockProps> = ({ content, onChange }) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(
    typeof content === 'string' ? content : JSON.stringify(content, null, 2)
  )
  const [copied, setCopied] = useState(false)

  const handleSave = () => {
    try {
      const parsed = JSON.parse(editValue)
      onChange?.(parsed)
    } catch (e) {
      onChange?.(editValue)
    }
    setIsEditing(false)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(editValue)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <BlockWrapper>
      <div className="flex items-start justify-between mb-2">
        <div className="text-xs text-neutral-500">JSON</div>
        <div className="flex gap-1">
          <button
            onClick={handleCopy}
            className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-neutral-200"
            title="复制"
          >
            {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
          </button>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-neutral-200"
          >
            {isEditing ? <Eye className="w-3 h-3" /> : <Edit3 className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="w-full bg-neutral-900/50 border border-neutral-700 rounded-lg p-3 text-neutral-200 font-mono text-sm focus:border-primary-500 focus:outline-none min-h-[150px]"
            placeholder='{"key": "value"}'
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
                setEditValue(typeof content === 'string' ? content : JSON.stringify(content, null, 2))
                setIsEditing(false)
              }}
              className="btn-secondary text-sm px-3 py-1"
            >
              取消
            </button>
          </div>
        </div>
      ) : (
        <pre className="bg-neutral-900/50 border border-neutral-700 rounded-lg p-3 text-sm font-mono text-green-400 overflow-x-auto">
          {typeof content === 'string' ? content : JSON.stringify(content, null, 2)}
        </pre>
      )}
    </BlockWrapper>
  )
}

export default JsonBlock
