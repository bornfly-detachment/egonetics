/**
 * Layout Components — UI 语法骨架
 * Page / Section / Stack / Row / Grid / SplitPane / CardContainer / ScrollArea
 */
import { useState, type ReactNode } from 'react'
import type {
  PageProps, SectionProps, StackProps, RowProps,
  GridProps, SplitPaneProps, CardContainerProps, ScrollAreaProps,
} from './types'
import { ChevronDown } from 'lucide-react'

const GAP: Record<string, string> = {
  none: 'gap-0', xs: 'gap-1', sm: 'gap-2', md: 'gap-4', lg: 'gap-6',
}

export function Page({ title, subtitle, fullHeight, children }: PageProps & { children?: ReactNode }) {
  return (
    <div className={`flex flex-col ${fullHeight ? 'h-full' : ''} bg-[#0d0d0d]`}>
      {(title || subtitle) && (
        <div className="shrink-0 px-5 py-4 border-b border-white/[0.05]">
          {title && <h1 className="text-sm font-bold text-white/90">{title}</h1>}
          {subtitle && <p className="text-[10px] text-white/35 mt-0.5">{subtitle}</p>}
        </div>
      )}
      <div className="flex-1 overflow-auto p-4">{children}</div>
    </div>
  )
}

export function Section({
  title, collapsible, defaultOpen = true, accent, children,
}: SectionProps & { children?: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  const accentColor = accent ?? '#3b82f6'
  return (
    <div className="space-y-2">
      {title && (
        <div
          className="flex items-center gap-2 cursor-pointer select-none"
          onClick={() => collapsible && setOpen(p => !p)}
        >
          <div className="w-0.5 h-3.5 rounded-full shrink-0" style={{ background: accentColor }} />
          <span className="text-[11px] font-bold text-white/70">{title}</span>
          {collapsible && (
            <ChevronDown
              size={12}
              className={`ml-auto text-white/30 transition-transform ${open ? '' : '-rotate-90'}`}
            />
          )}
        </div>
      )}
      {(!collapsible || open) && <div className="space-y-2">{children}</div>}
    </div>
  )
}

export function Stack({ gap = 'md', align = 'stretch', children }: StackProps & { children?: ReactNode }) {
  const alignCls = { start: 'items-start', center: 'items-center', end: 'items-end', stretch: '' }[align]
  return <div className={`flex flex-col ${GAP[gap]} ${alignCls}`}>{children}</div>
}

export function Row({
  gap = 'md', align = 'center', wrap, justify = 'start', children,
}: RowProps & { children?: ReactNode }) {
  const alignCls  = { start: 'items-start', center: 'items-center', end: 'items-end' }[align]
  const justifyCls = {
    start: 'justify-start', center: 'justify-center', end: 'justify-end',
    between: 'justify-between', around: 'justify-around',
  }[justify]
  return (
    <div className={`flex ${alignCls} ${justifyCls} ${GAP[gap]} ${wrap ? 'flex-wrap' : ''}`}>
      {children}
    </div>
  )
}

export function Grid({ cols = 2, gap = 'md', minColWidth, children }: GridProps & { children?: ReactNode }) {
  const style = minColWidth
    ? { gridTemplateColumns: `repeat(auto-fill, minmax(${minColWidth}px, 1fr))` }
    : { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }
  return (
    <div className={`grid ${GAP[gap]}`} style={style}>{children}</div>
  )
}

export function SplitPane({
  ratio = 0.4, direction = 'horizontal', children,
}: SplitPaneProps & { children?: ReactNode }) {
  const childArr = Array.isArray(children) ? children : [children]
  const leftPct  = Math.round(ratio * 100)
  const rightPct = 100 - leftPct

  if (direction === 'horizontal') {
    return (
      <div className="flex h-full overflow-hidden">
        <div style={{ width: `${leftPct}%` }} className="overflow-auto border-r border-white/[0.06]">
          {childArr[0]}
        </div>
        <div style={{ width: `${rightPct}%` }} className="overflow-auto">{childArr[1]}</div>
      </div>
    )
  }
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div style={{ height: `${leftPct}%` }} className="overflow-auto border-b border-white/[0.06]">
        {childArr[0]}
      </div>
      <div style={{ height: `${rightPct}%` }} className="overflow-auto">{childArr[1]}</div>
    </div>
  )
}

export function CardContainer({
  elevated, bordered = true, accent, padding = 'md', children,
}: CardContainerProps & { children?: ReactNode }) {
  const pad = { none: '', sm: 'p-2', md: 'p-4', lg: 'p-6' }[padding]
  return (
    <div
      className={`rounded-lg ${pad}`}
      style={{
        background: elevated ? '#ffffff08' : '#ffffff04',
        border: bordered ? `1px solid ${accent ? accent + '30' : '#ffffff10'}` : 'none',
        boxShadow: elevated ? '0 4px 24px rgba(0,0,0,0.3)' : 'none',
      }}
    >
      {children}
    </div>
  )
}

export function ScrollArea({
  maxHeight = '100%', direction = 'vertical', children,
}: ScrollAreaProps & { children?: ReactNode }) {
  const overflow = {
    vertical: 'overflow-y-auto overflow-x-hidden',
    horizontal: 'overflow-x-auto overflow-y-hidden',
    both: 'overflow-auto',
  }[direction]
  return (
    <div className={overflow} style={{ maxHeight }}>
      {children}
    </div>
  )
}
