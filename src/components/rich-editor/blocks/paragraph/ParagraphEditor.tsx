import React, { useEffect, useRef } from 'react'
import type { Block, BlockType } from '../../types'
import { SHORTCUT_MAP } from '../../shared/blockTypeConfig'

const MD_SHORTCUTS: Array<{ pattern: RegExp | string; type: BlockType }> = [
  { pattern: '# ',    type: 'heading1' },
  { pattern: '## ',   type: 'heading2' },
  { pattern: '### ',  type: 'heading3' },
  { pattern: '#### ', type: 'heading4' },
  { pattern: '> ',    type: 'quote' },
  { pattern: '- ',    type: 'bullet' },
  { pattern: '* ',    type: 'bullet' },
  { pattern: '1. ',   type: 'numbered' },
  { pattern: '---',   type: 'divider' },
  { pattern: '[ ] ',  type: 'todo' },
]

interface Props {
  block: Block
  draft: string
  onChange: (v: string) => void
  onBlur: () => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onTypeChange?: (type: BlockType) => void
  onSlashMenu?: () => void
  autoFocus?: boolean
}

export default function ParagraphEditor({
  block: _block,
  draft,
  onChange,
  onBlur,
  onKeyDown,
  onTypeChange,
  onSlashMenu,
  autoFocus,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!autoFocus || !ref.current) return
    const el = ref.current
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [autoFocus])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value

    if (onTypeChange) {
      for (const { pattern, type } of MD_SHORTCUTS) {
        if (val === pattern) {
          onChange('')
          onTypeChange(type)
          return
        }
      }
      if (val.startsWith('```')) { onChange(''); onTypeChange('code'); return }
    }

    // /shortcut direct trigger (用法B): e.g. "/code" → change to code block
    if (val.startsWith('/') && val.length > 1 && !val.includes(' ') && onTypeChange) {
      const cmd = val.slice(1).toLowerCase()
      const type = SHORTCUT_MAP[cmd]
      if (type) { onChange(''); onTypeChange(type); return }
    }

    if (val === '/' && onSlashMenu) {
      onSlashMenu()
      return
    }

    onChange(val)
  }

  const autoResize = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const t = e.currentTarget
    t.style.height = 'auto'
    t.style.height = `${t.scrollHeight}px`
  }

  return (
    <textarea
      ref={ref}
      value={draft}
      rows={1}
      onChange={handleChange}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      onInput={autoResize}
      className="w-full bg-transparent border-none outline-none resize-none text-neutral-200 leading-relaxed overflow-hidden placeholder-neutral-600 font-inherit caret-white"
      placeholder="输入内容，或 / 插入块，或以 # ## > - 1. 开头自动转换类型…"
    />
  )
}
