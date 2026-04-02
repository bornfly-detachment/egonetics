import type { RichTextSegment } from '../types'

// 将含 \n 的文本渲染为带 <br/> 的节点数组
function renderText(text: string, cls: string, baseKey: string) {
  const lines = text.split('\n')
  return lines.flatMap((line, li) => {
    const node = <span key={`${baseKey}-${li}`} className={cls}>{line}</span>
    return li < lines.length - 1 ? [node, <br key={`${baseKey}-br-${li}`} />] : [node]
  })
}

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
      {segments.flatMap((seg, i) => {
        const cls = [
          seg.bold ? 'font-bold' : '',
          seg.italic ? 'italic' : '',
          seg.underline ? 'underline' : '',
          seg.strikethrough ? 'line-through' : '',
          seg.code ? 'font-mono bg-neutral-800 px-1 rounded text-sm text-green-300' : '',
        ]
          .filter(Boolean)
          .join(' ')

        if (seg.link) {
          return [
            <a key={i} href={seg.link} target="_blank" rel="noreferrer"
              className={`${cls} text-blue-400 underline`}>
              {seg.text}
            </a>
          ]
        }

        return renderText(seg.text, cls, String(i))
      })}
    </>
  )
}
