import type { RichTextSegment } from '../types'

export default function RichText({
  segments,
  placeholder = '输入内容，或按 / 插入块…',
}: {
  segments: RichTextSegment[]
  placeholder?: string
}) {
  if (!segments.length || (segments.length === 1 && !segments[0].text))
    return <span className="text-neutral-500 select-none">{placeholder}</span>

  return (
    <>
      {segments.map((seg, i) => {
        const cls = [
          seg.bold ? 'font-bold' : '',
          seg.italic ? 'italic' : '',
          seg.underline ? 'underline' : '',
          seg.strikethrough ? 'line-through' : '',
          seg.code ? 'font-mono bg-neutral-800 px-1 rounded text-sm text-green-300' : '',
        ]
          .filter(Boolean)
          .join(' ')

        return seg.link ? (
          <a
            key={i}
            href={seg.link}
            target="_blank"
            rel="noreferrer"
            className={`${cls} text-blue-400 underline`}
          >
            {seg.text}
          </a>
        ) : (
          <span key={i} className={cls}>
            {seg.text}
          </span>
        )
      })}
    </>
  )
}
