/**
 * AI-specific Components — AI 原生组件
 * 与传统 UI 最大区别：展示 AI 的思维过程、置信度、执行步骤
 *
 * MessageBubble / ThoughtTrace / SuggestionChips / FollowUpQuestions /
 * ConfidenceBadge / MemoryReference / TaskPlan / AgentStep / ToolCallCard
 */
import { useState } from 'react'
import { ChevronDown, Brain, Wrench, BookOpen, CheckCircle2, XCircle, Loader2, Clock, SkipForward } from 'lucide-react'
import type {
  MessageBubbleProps, ThoughtTraceProps, SuggestionChipsProps, FollowUpQuestionsProps,
  ConfidenceBadgeProps, MemoryReferenceProps, TaskPlanProps, AgentStepProps, ToolCallCardProps,
} from './types'

// ── MessageBubble ─────────────────────────────────────────────────
export function MessageBubble({ role, content, timestamp, model, streaming }: MessageBubbleProps) {
  const isUser = role === 'user'
  const isTool = role === 'tool'
  const roleStyle = {
    user:      { bg: '#3b82f618', border: '#3b82f630', nameColor: '#93c5fd', name: '用户' },
    assistant: { bg: '#8b5cf618', border: '#8b5cf630', nameColor: '#c4b5fd', name: model ?? 'AI' },
    system:    { bg: '#ffffff08', border: '#ffffff15', nameColor: '#ffffff40', name: 'System' },
    tool:      { bg: '#10b98112', border: '#10b98128', nameColor: '#6ee7b7', name: 'Tool' },
  }[role]

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-xl px-3 py-2.5 space-y-1 ${isUser ? 'rounded-br-sm' : 'rounded-bl-sm'}`}
        style={{ background: roleStyle.bg, border: `1px solid ${roleStyle.border}` }}
      >
        {!isUser && (
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-bold" style={{ color: roleStyle.nameColor }}>
              {isTool ? '🔧 ' : ''}{roleStyle.name}
            </span>
            {timestamp && <span className="text-[8px] text-white/20">{timestamp}</span>}
            {streaming && (
              <span className="w-1 h-3.5 bg-current animate-pulse rounded-sm" style={{ color: roleStyle.nameColor }} />
            )}
          </div>
        )}
        <p className="text-[12px] text-white/80 leading-relaxed whitespace-pre-wrap">{content}</p>
        {isUser && timestamp && (
          <div className="text-[8px] text-white/20 text-right">{timestamp}</div>
        )}
      </div>
    </div>
  )
}

// ── ThoughtTrace ──────────────────────────────────────────────────
export function ThoughtTrace({ thoughts, collapsed: defaultCollapsed = true, label = '思维过程' }: ThoughtTraceProps) {
  const [open, setOpen] = useState(!defaultCollapsed)
  return (
    <div className="rounded-lg overflow-hidden" style={{ background: '#8b5cf608', border: '1px solid #8b5cf620' }}>
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/[0.02] transition-colors"
      >
        <Brain size={12} className="text-purple-400/60 shrink-0" />
        <span className="text-[10px] font-medium text-purple-300/60 flex-1 text-left">{label}</span>
        <span className="text-[9px] text-white/20">{thoughts.length} 步</span>
        <ChevronDown size={11} className={`text-white/20 transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-1.5 border-t border-white/[0.04]">
          {thoughts.map((t, i) => (
            <div key={i} className="flex gap-2 text-[10px]">
              <span className="text-purple-400/30 font-mono shrink-0 mt-px">{i + 1}.</span>
              <span className="text-white/50 leading-relaxed">{t}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── SuggestionChips ───────────────────────────────────────────────
export function SuggestionChips({ items, multi, selected: initialSelected = [] }: SuggestionChipsProps) {
  const [selected, setSelected] = useState<string[]>(initialSelected)
  const toggle = (item: string) => {
    if (multi) {
      setSelected(s => s.includes(item) ? s.filter(x => x !== item) : [...s, item])
    } else {
      setSelected(s => s.includes(item) ? [] : [item])
    }
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(item => {
        const isSelected = selected.includes(item)
        return (
          <button
            key={item}
            onClick={() => toggle(item)}
            className="px-2.5 py-1 rounded-full text-[10px] font-medium transition-all hover:opacity-90 active:scale-95"
            style={{
              background: isSelected ? '#3b82f625' : '#ffffff08',
              border: `1px solid ${isSelected ? '#3b82f650' : '#ffffff18'}`,
              color: isSelected ? '#93c5fd' : '#ffffff55',
            }}
          >
            {item}
          </button>
        )
      })}
    </div>
  )
}

// ── FollowUpQuestions ─────────────────────────────────────────────
export function FollowUpQuestions({ questions, context }: FollowUpQuestionsProps) {
  return (
    <div className="space-y-1.5">
      {context && (
        <div className="text-[9px] text-white/25 px-1">{context}</div>
      )}
      {questions.map((q, i) => (
        <button
          key={i}
          className="w-full text-left px-3 py-2 rounded-lg text-[11px] text-white/65
            bg-white/[0.03] border border-white/[0.07] hover:bg-white/[0.06] hover:text-white/80
            transition-all group flex items-center gap-2"
        >
          <span className="text-blue-400/40 shrink-0 transition-colors group-hover:text-blue-400/70">?</span>
          {q}
        </button>
      ))}
    </div>
  )
}

// ── ConfidenceBadge ───────────────────────────────────────────────
export function ConfidenceBadge({ value, label, size = 'md', showBar = true }: ConfidenceBadgeProps) {
  const pct = Math.round(value * 100)
  const color = value >= 0.8 ? '#10b981' : value >= 0.5 ? '#f59e0b' : '#ef4444'
  const sizeCls = { sm: 'text-[8px] px-1.5 py-0.5', md: 'text-[9px] px-2 py-1', lg: 'text-[10px] px-2.5 py-1.5' }[size]

  if (showBar && size !== 'sm') {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className={`font-mono font-bold tabular-nums ${sizeCls} rounded`}
            style={{ background: color + '18', color, border: `1px solid ${color}30` }}>
            {value.toFixed(2)}
          </span>
          {label && <span className="text-[9px] text-white/35">{label}</span>}
          <span className="text-[9px] text-white/25 ml-auto">{pct}%</span>
        </div>
        <div className="h-1 rounded-full overflow-hidden" style={{ background: color + '18' }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
        </div>
      </div>
    )
  }

  return (
    <span className={`inline-flex items-center gap-1 rounded font-mono font-bold tabular-nums ${sizeCls}`}
      style={{ background: color + '18', color, border: `1px solid ${color}30` }}>
      {value.toFixed(2)}
      {label && <span className="font-normal opacity-70 ml-0.5">{label}</span>}
    </span>
  )
}

// ── MemoryReference ───────────────────────────────────────────────
export function MemoryReference({ title, excerpt, source, relevance }: MemoryReferenceProps) {
  const relColor = relevance !== undefined
    ? (relevance >= 0.8 ? '#10b981' : relevance >= 0.5 ? '#f59e0b' : '#6b7280')
    : '#6b7280'
  return (
    <div className="flex gap-2 p-2 rounded-lg"
      style={{ background: '#ffffff06', border: '1px solid #ffffff0e' }}>
      <BookOpen size={12} className="text-white/25 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-white/75 truncate">{title}</span>
          {relevance !== undefined && (
            <span className="text-[8px] font-mono shrink-0" style={{ color: relColor }}>
              {(relevance * 100).toFixed(0)}%
            </span>
          )}
        </div>
        {excerpt && <p className="text-[9px] text-white/35 leading-snug line-clamp-2">{excerpt}</p>}
        {source && <span className="text-[8px] text-white/20">{source}</span>}
      </div>
    </div>
  )
}

// ── TaskPlan ──────────────────────────────────────────────────────
export function TaskPlan({ steps, title, showProgress = true }: TaskPlanProps) {
  const done = steps.filter(s => s.status === 'done').length
  const pct  = steps.length > 0 ? (done / steps.length) * 100 : 0

  return (
    <div className="space-y-2">
      {(title || showProgress) && (
        <div className="flex items-center gap-2">
          {title && <span className="text-[11px] font-bold text-white/70">{title}</span>}
          {showProgress && (
            <>
              <div className="flex-1 h-1 rounded-full overflow-hidden bg-white/[0.08]">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: '#10b981' }} />
              </div>
              <span className="text-[9px] font-mono text-white/30">{done}/{steps.length}</span>
            </>
          )}
        </div>
      )}
      <div className="space-y-1">
        {steps.map((step, i) => (
          <AgentStep key={step.id ?? i} {...step} />
        ))}
      </div>
    </div>
  )
}

// ── AgentStep ─────────────────────────────────────────────────────
const STEP_ICON = {
  pending:  <Clock     size={12} className="text-white/25" />,
  running:  <Loader2   size={12} className="text-blue-400 animate-spin" />,
  done:     <CheckCircle2 size={12} className="text-emerald-400" />,
  failed:   <XCircle   size={12} className="text-red-400" />,
  skipped:  <SkipForward size={12} className="text-white/20" />,
}

const STEP_LABEL_COLOR = {
  pending: 'text-white/35', running: 'text-white/80', done: 'text-white/60',
  failed: 'text-red-300/70', skipped: 'text-white/20',
}

export function AgentStep({ label, status, tool, output, duration_ms, expanded: defaultExpanded }: AgentStepProps) {
  const [open, setOpen] = useState(defaultExpanded ?? status === 'running')
  const hasDetails = !!(output || tool)
  return (
    <div className="rounded-lg overflow-hidden" style={{ background: '#ffffff04', border: '1px solid #ffffff08' }}>
      <div
        className={`flex items-center gap-2 px-3 py-2 ${hasDetails ? 'cursor-pointer hover:bg-white/[0.02]' : ''}`}
        onClick={() => hasDetails && setOpen(p => !p)}
      >
        <span className="shrink-0">{STEP_ICON[status]}</span>
        <span className={`flex-1 text-[11px] ${STEP_LABEL_COLOR[status]}`}>{label}</span>
        {tool && <span className="text-[8px] font-mono text-white/20 shrink-0">{tool}</span>}
        {duration_ms !== undefined && (
          <span className="text-[8px] font-mono text-white/20 shrink-0">{duration_ms}ms</span>
        )}
        {hasDetails && (
          <ChevronDown size={10} className={`text-white/20 transition-transform shrink-0 ${open ? '' : '-rotate-90'}`} />
        )}
      </div>
      {open && hasDetails && (
        <div className="px-3 pb-2.5 border-t border-white/[0.05] pt-2 space-y-1">
          {tool && (
            <div className="flex items-center gap-1.5">
              <Wrench size={9} className="text-white/20" />
              <span className="text-[9px] font-mono text-white/35">{tool}</span>
            </div>
          )}
          {output && (
            <pre className="text-[9px] font-mono text-white/45 whitespace-pre-wrap leading-relaxed max-h-24 overflow-auto">
              {output}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

// ── ToolCallCard ──────────────────────────────────────────────────
export function ToolCallCard({ tool_name, status, input, output, duration_ms, error }: ToolCallCardProps) {
  const [open, setOpen] = useState(status === 'error')
  const statusStyle = {
    calling: { color: '#3b82f6', icon: <Loader2 size={11} className="animate-spin" />, label: '调用中' },
    done:    { color: '#10b981', icon: <CheckCircle2 size={11} />, label: '完成' },
    error:   { color: '#ef4444', icon: <XCircle size={11} />, label: '错误' },
  }[status]

  return (
    <div className="rounded-lg overflow-hidden"
      style={{ background: statusStyle.color + '08', border: `1px solid ${statusStyle.color}25` }}>
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-white/[0.02]"
        onClick={() => setOpen(p => !p)}
      >
        <span style={{ color: statusStyle.color }}>{statusStyle.icon}</span>
        <span className="text-[11px] font-mono font-medium" style={{ color: statusStyle.color }}>
          {tool_name}
        </span>
        <span className="text-[8px] text-white/25 ml-auto shrink-0">{statusStyle.label}</span>
        {duration_ms !== undefined && (
          <span className="text-[8px] font-mono text-white/20 shrink-0">{duration_ms}ms</span>
        )}
        <ChevronDown size={10} className={`text-white/20 transition-transform ${open ? '' : '-rotate-90'}`} />
      </div>

      {/* Body */}
      {open && (
        <div className="border-t border-white/[0.05] divide-y divide-white/[0.04]">
          {input && (
            <div className="px-3 py-2 space-y-1">
              <div className="text-[8px] text-white/20 uppercase tracking-wider">Input</div>
              <pre className="text-[9px] font-mono text-white/50 whitespace-pre-wrap max-h-20 overflow-auto leading-relaxed">
                {JSON.stringify(input, null, 2)}
              </pre>
            </div>
          )}
          {output !== undefined && (
            <div className="px-3 py-2 space-y-1">
              <div className="text-[8px] text-white/20 uppercase tracking-wider">Output</div>
              <pre className="text-[9px] font-mono text-white/50 whitespace-pre-wrap max-h-20 overflow-auto leading-relaxed">
                {typeof output === 'string' ? output : JSON.stringify(output, null, 2)}
              </pre>
            </div>
          )}
          {error && (
            <div className="px-3 py-2 space-y-1">
              <div className="text-[8px] text-red-400/50 uppercase tracking-wider">Error</div>
              <pre className="text-[9px] font-mono text-red-300/60 whitespace-pre-wrap leading-relaxed">{error}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
