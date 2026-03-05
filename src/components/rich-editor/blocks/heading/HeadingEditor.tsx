import React, { useEffect, useRef } from 'react'
import type { Block } from '../../types'

const HEADING_CLS: Record<string, string> = {
  heading1: 'text-3xl font-bold text-neutral-100',
  heading2: 'text-2xl font-semibold text-neutral-100',
  heading3: 'text-xl font-semibold text-neutral-200',
  heading4: 'text-lg font-medium text-neutral-200',
}

interface Props {
  block: Block
  draft: string
  onChange: (v: string) => void
  onBlur: () => void
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  autoFocus?: boolean
}

export default function HeadingEditor({ block, draft, onChange, onBlur, onKeyDown, autoFocus }: Props) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!autoFocus || !ref.current) return
    const el = ref.current
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [autoFocus])

  const cls = HEADING_CLS[block.type] ?? HEADING_CLS.heading1

  return (
    <input
      ref={ref}
      type="text"
      value={draft}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      className={`w-full bg-transparent border-none outline-none caret-white placeholder-neutral-600 ${cls}`}
      placeholder="标题…"
    />
  )
}
