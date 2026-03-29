/**
 * Content Components — 信息原语
 * Text / Title / Subtitle / Paragraph / CodeBlock / Quote / List / Table
 */
import type {
  TextProps, TitleProps, SubtitleProps, ParagraphProps,
  CodeBlockProps, QuoteProps, ListProps, TableProps,
} from './types'

export function Text({ content, variant = 'body', muted, color }: TextProps) {
  const cls = {
    body:    'text-[12px]',
    caption: 'text-[10px]',
    label:   'text-[10px] font-medium uppercase tracking-wider',
    mono:    'text-[11px] font-mono',
  }[variant]
  const colorCls = muted ? 'text-white/40' : 'text-white/75'
  return <span className={`${cls} ${colorCls}`} style={color ? { color } : {}}>{content}</span>
}

export function Title({ content, level = 2, mono }: TitleProps) {
  const cls = {
    1: 'text-xl font-bold text-white/95',
    2: 'text-base font-bold text-white/90',
    3: 'text-sm font-semibold text-white/80',
    4: 'text-[12px] font-semibold text-white/70',
  }[level]
  const Tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4'
  return <Tag className={`${cls} ${mono ? 'font-mono' : ''}`}>{content}</Tag>
}

export function Subtitle({ content, muted = true }: SubtitleProps) {
  return (
    <p className={`text-[11px] ${muted ? 'text-white/40' : 'text-white/60'}`}>{content}</p>
  )
}

export function Paragraph({ content, muted, leading = 'normal' }: ParagraphProps) {
  const leadCls = { tight: 'leading-tight', normal: 'leading-relaxed', loose: 'leading-loose' }[leading]
  return (
    <p className={`text-[12px] ${leadCls} ${muted ? 'text-white/40' : 'text-white/70'}`}>
      {content}
    </p>
  )
}

export function CodeBlock({ code, lang, showCopy }: CodeBlockProps) {
  return (
    <div className="rounded-lg overflow-hidden border border-white/[0.08]">
      {lang && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-white/[0.04] border-b border-white/[0.06]">
          <span className="text-[9px] font-mono text-white/30 uppercase">{lang}</span>
          {showCopy && (
            <button
              className="text-[9px] text-white/25 hover:text-white/50 transition-colors"
              onClick={() => navigator.clipboard.writeText(code)}
            >
              copy
            </button>
          )}
        </div>
      )}
      <pre className="px-3 py-2.5 text-[10px] font-mono text-white/65 overflow-x-auto bg-black/20 leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  )
}

export function Quote({ content, attribution, accent = '#8b5cf6' }: QuoteProps) {
  return (
    <div
      className="pl-3 py-1 space-y-1"
      style={{ borderLeft: `2px solid ${accent}50` }}
    >
      <p className="text-[12px] text-white/60 italic leading-relaxed">{content}</p>
      {attribution && (
        <p className="text-[10px] text-white/30">— {attribution}</p>
      )}
    </div>
  )
}

export function List({ items, ordered, marker }: ListProps) {
  return (
    <ul className="space-y-1">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-[12px] text-white/65">
          <span className="shrink-0 text-white/30 mt-px text-[10px]">
            {ordered ? `${i + 1}.` : (marker ?? '·')}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export function Table({ headers, rows, compact }: TableProps) {
  const cellCls = compact ? 'px-2 py-1 text-[10px]' : 'px-3 py-2 text-[11px]'
  return (
    <div className="overflow-x-auto rounded border border-white/[0.08]">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-white/[0.08] bg-white/[0.03]">
            {headers.map(h => (
              <th key={h} className={`${cellCls} text-left font-medium text-white/40 text-[9px] uppercase tracking-wider`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
              {row.map((cell, j) => (
                <td key={j} className={`${cellCls} text-white/65`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
