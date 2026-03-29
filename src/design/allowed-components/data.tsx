/**
 * Data / View Components — 结构化展示层
 * DataCard / Metric / Chart / Timeline / CalendarView / DiffView / EntityCard / TableView
 */
import type {
  DataCardProps, MetricProps, ChartProps, TimelineProps,
  CalendarViewProps, DiffViewProps, EntityCardProps, TableViewProps,
} from './types'

const NODE_COLORS: Record<string, string> = {
  P: '#3b82f6', R: '#8b5cf6', V: '#f59e0b',
  S: '#10b981', E: '#ef4444',
  task: '#6366f1', page: '#0ea5e9',
}

export function DataCard({ label, value, unit, trend, color = '#3b82f6', size = 'md' }: DataCardProps) {
  const sizeCls = { sm: 'p-2', md: 'p-3', lg: 'p-4' }[size]
  const valSize  = { sm: 'text-[13px]', md: 'text-base', lg: 'text-xl' }[size]
  const trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '—'
  const trendColor = trend === 'up' ? '#10b981' : trend === 'down' ? '#ef4444' : '#6b7280'
  return (
    <div className={`rounded-lg ${sizeCls}`}
      style={{ background: color + '0c', border: `1px solid ${color}25` }}>
      <div className="text-[9px] text-white/35 uppercase tracking-wider mb-1">{label}</div>
      <div className="flex items-end gap-1.5">
        <span className={`font-bold font-mono tabular-nums ${valSize}`} style={{ color }}>
          {value}
        </span>
        {unit && <span className="text-[9px] text-white/30 mb-px">{unit}</span>}
        {trend && (
          <span className="text-[10px] mb-px ml-auto" style={{ color: trendColor }}>
            {trendIcon}
          </span>
        )}
      </div>
    </div>
  )
}

export function Metric({ value, label, unit, color = '#3b82f6', delta }: MetricProps) {
  return (
    <div className="text-center space-y-0.5">
      <div className="flex items-baseline justify-center gap-1">
        <span className="text-3xl font-bold tabular-nums" style={{ color }}>{value}</span>
        {unit && <span className="text-[11px] text-white/35">{unit}</span>}
      </div>
      {label && <div className="text-[10px] text-white/40">{label}</div>}
      {delta && <div className="text-[9px]" style={{ color: delta.startsWith('+') ? '#10b981' : '#ef4444' }}>{delta}</div>}
    </div>
  )
}

export function Chart({ type, data, height = 80, color = '#3b82f6' }: ChartProps) {
  if (!data.length) return null
  const max = Math.max(...data.map(d => d.value))
  return (
    <div style={{ height }}>
      <div className="flex items-end gap-0.5 h-full">
        {data.map((d, i) => {
          const pct = max > 0 ? (d.value / max) * 100 : 0
          return (
            <div key={i} className="flex-1 flex flex-col justify-end group relative">
              <div
                className="rounded-t transition-all duration-500"
                style={{
                  height: `${pct}%`,
                  background: type === 'line' ? 'transparent' : color + (i % 2 === 0 ? '80' : '50'),
                  borderTop: type === 'line' ? `2px solid ${color}` : 'none',
                  minHeight: 2,
                }}
              />
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[8px] text-white/40
                opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                {d.label}: {d.value}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function Timeline({ items, orientation = 'vertical' }: TimelineProps) {
  const statusColor = { done: '#10b981', active: '#3b82f6', pending: '#4b5563' }
  if (orientation === 'horizontal') {
    return (
      <div className="flex items-center gap-0">
        {items.map((item, i) => {
          const col = statusColor[item.status ?? 'pending']
          return (
            <div key={i} className="flex items-center">
              <div className="flex flex-col items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-full border-2"
                  style={{ borderColor: col, background: item.status === 'done' ? col : 'transparent' }} />
                <span className="text-[9px] text-white/50 whitespace-nowrap">{item.label}</span>
              </div>
              {i < items.length - 1 && (
                <div className="w-8 h-px mx-1" style={{ background: col + '40' }} />
              )}
            </div>
          )
        })}
      </div>
    )
  }
  return (
    <div className="space-y-0">
      {items.map((item, i) => {
        const col = statusColor[item.status ?? 'pending']
        return (
          <div key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="w-2.5 h-2.5 rounded-full border-2 mt-0.5 shrink-0"
                style={{ borderColor: col, background: item.status === 'done' ? col : 'transparent' }} />
              {i < items.length - 1 && (
                <div className="w-px flex-1 mt-1" style={{ background: col + '25' }} />
              )}
            </div>
            <div className="pb-4 min-h-6">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-white/70">{item.label}</span>
                {item.time && <span className="text-[9px] text-white/25">{item.time}</span>}
              </div>
              {item.description && (
                <p className="text-[10px] text-white/40 mt-0.5 leading-snug">{item.description}</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function CalendarView({ year, month, highlights = [], today }: CalendarViewProps) {
  const now = new Date()
  const y = year ?? now.getFullYear()
  const m = (month ?? now.getMonth() + 1) - 1
  const firstDay = new Date(y, m, 1).getDay()
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const todayStr = today ?? now.toISOString().slice(0, 10)

  const days: (number | null)[] = Array(firstDay).fill(null)
  for (let d = 1; d <= daysInMonth; d++) days.push(d)

  const monthName = new Date(y, m).toLocaleString('zh-CN', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-2">
      <div className="text-[11px] font-bold text-white/70 text-center">{monthName}</div>
      <div className="grid grid-cols-7 gap-px">
        {['日','一','二','三','四','五','六'].map(d => (
          <div key={d} className="text-[8px] text-white/25 text-center py-0.5">{d}</div>
        ))}
        {days.map((d, i) => {
          if (!d) return <div key={`e${i}`} />
          const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
          const isToday = dateStr === todayStr
          const isHighlighted = highlights.includes(dateStr)
          return (
            <div key={d}
              className="text-center text-[10px] py-0.5 rounded transition-colors"
              style={{
                background: isToday ? '#3b82f640' : isHighlighted ? '#10b98130' : 'transparent',
                color: isToday ? '#93c5fd' : isHighlighted ? '#6ee7b7' : '#ffffff50',
                border: isToday ? '1px solid #3b82f650' : 'none',
              }}
            >
              {d}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function DiffView({ before, after, lang, inline }: DiffViewProps) {
  const beforeLines = before.split('\n')
  const afterLines  = after.split('\n')
  if (inline) {
    return (
      <div className="space-y-1 font-mono text-[10px]">
        {beforeLines.map((line, i) => (
          <div key={`b${i}`} className="flex gap-2 px-2 py-px rounded" style={{ background: '#ef444410', color: '#fca5a5' }}>
            <span className="text-white/20 select-none">−</span><span>{line}</span>
          </div>
        ))}
        {afterLines.map((line, i) => (
          <div key={`a${i}`} className="flex gap-2 px-2 py-px rounded" style={{ background: '#10b98110', color: '#6ee7b7' }}>
            <span className="text-white/20 select-none">+</span><span>{line}</span>
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="grid grid-cols-2 gap-2 font-mono text-[10px]">
      <div className="rounded border border-red-500/20 overflow-auto">
        <div className="px-2 py-1 border-b border-white/[0.05] text-[8px] text-red-400/60">Before{lang ? ` · ${lang}` : ''}</div>
        <pre className="p-2 text-red-200/60">{before}</pre>
      </div>
      <div className="rounded border border-green-500/20 overflow-auto">
        <div className="px-2 py-1 border-b border-white/[0.05] text-[8px] text-green-400/60">After{lang ? ` · ${lang}` : ''}</div>
        <pre className="p-2 text-green-200/60">{after}</pre>
      </div>
    </div>
  )
}

export function EntityCard({ entity_type, title, description, status, meta, compact }: EntityCardProps) {
  const color = NODE_COLORS[entity_type] ?? '#6b7280'
  return (
    <div className={`rounded-lg ${compact ? 'p-2' : 'p-3'} space-y-1.5`}
      style={{ background: color + '0a', border: `1px solid ${color}25` }}>
      <div className="flex items-start gap-2">
        <span className="px-1.5 py-0.5 rounded text-[8px] font-bold shrink-0"
          style={{ background: color + '20', color, border: `1px solid ${color}35` }}>
          {entity_type}
        </span>
        <span className={`font-medium text-white/80 ${compact ? 'text-[11px]' : 'text-[12px]'} leading-tight`}>
          {title}
        </span>
        {status && (
          <span className="ml-auto text-[9px] text-white/35 shrink-0">{status}</span>
        )}
      </div>
      {description && !compact && (
        <p className="text-[10px] text-white/45 leading-snug">{description}</p>
      )}
      {meta && !compact && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {Object.entries(meta).map(([k, v]) => (
            <span key={k} className="text-[8px] font-mono text-white/30">
              {k}: <span className="text-white/50">{v}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export function TableView({ headers, rows, selectable, compact }: TableViewProps) {
  const cellCls = compact ? 'px-2 py-1 text-[10px]' : 'px-3 py-2 text-[11px]'
  return (
    <div className="overflow-x-auto rounded border border-white/[0.08]">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-white/[0.08] bg-white/[0.03]">
            {selectable && <th className={`${cellCls} w-8`} />}
            {headers.map(h => (
              <th key={h.key}
                className={`${cellCls} text-left font-medium text-white/35 text-[9px] uppercase tracking-wider`}
                style={h.width ? { width: h.width } : {}}>
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
              {selectable && (
                <td className={cellCls}>
                  <input type="checkbox" className="w-3 h-3 accent-blue-500" />
                </td>
              )}
              {headers.map(h => (
                <td key={h.key} className={`${cellCls} text-white/65`}>{row[h.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
