/**
 * Allowed Components — Props Interfaces
 * 42 个组件的完整类型约定，IR renderer 的类型基础
 */

// ── Layout ────────────────────────────────────────────────────────

export interface PageProps {
  title?: string
  subtitle?: string
  fullHeight?: boolean
}

export interface SectionProps {
  title?: string
  collapsible?: boolean
  defaultOpen?: boolean
  accent?: string
}

export interface StackProps {
  gap?: 'none' | 'xs' | 'sm' | 'md' | 'lg'
  align?: 'start' | 'center' | 'end' | 'stretch'
}

export interface RowProps {
  gap?: 'none' | 'xs' | 'sm' | 'md' | 'lg'
  align?: 'start' | 'center' | 'end'
  wrap?: boolean
  justify?: 'start' | 'center' | 'end' | 'between' | 'around'
}

export interface GridProps {
  cols?: number
  gap?: 'none' | 'xs' | 'sm' | 'md' | 'lg'
  minColWidth?: number
}

export interface SplitPaneProps {
  ratio?: number          // 0~1, left panel ratio, default 0.4
  direction?: 'horizontal' | 'vertical'
  resizable?: boolean
}

export interface CardContainerProps {
  elevated?: boolean
  bordered?: boolean
  accent?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

export interface ScrollAreaProps {
  maxHeight?: string | number
  direction?: 'vertical' | 'horizontal' | 'both'
}

// ── Content ───────────────────────────────────────────────────────

export interface TextProps {
  content: string
  variant?: 'body' | 'caption' | 'label' | 'mono'
  muted?: boolean
  color?: string
}

export interface TitleProps {
  content: string
  level?: 1 | 2 | 3 | 4
  mono?: boolean
}

export interface SubtitleProps {
  content: string
  muted?: boolean
}

export interface ParagraphProps {
  content: string
  muted?: boolean
  leading?: 'tight' | 'normal' | 'loose'
}

export interface CodeBlockProps {
  code: string
  lang?: string
  showCopy?: boolean
}

export interface QuoteProps {
  content: string
  attribution?: string
  accent?: string
}

export interface ListProps {
  items: string[]
  ordered?: boolean
  marker?: string
}

export interface TableProps {
  headers: string[]
  rows: (string | number)[][]
  compact?: boolean
}

// ── Action ────────────────────────────────────────────────────────

export interface ButtonProps {
  label: string
  variant?: 'default' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
  icon?: string
}

export interface IconButtonProps {
  icon: string
  label?: string               // aria-label
  variant?: 'default' | 'ghost'
  size?: 'sm' | 'md'
}

export interface PrimaryActionProps {
  label: string
  description?: string
  disabled?: boolean
}

export interface SecondaryActionProps {
  label: string
  disabled?: boolean
}

export interface LinkProps {
  label: string
  href?: string
  external?: boolean
  muted?: boolean
}

export interface ToggleProps {
  label?: string
  checked?: boolean
  size?: 'sm' | 'md'
}

export interface SliderProps {
  value?: number
  min?: number
  max?: number
  step?: number
  leftLabel?: string
  rightLabel?: string
  readOnly?: boolean
}

export interface InputProps {
  placeholder?: string
  value?: string
  label?: string
  type?: 'text' | 'number' | 'password'
  disabled?: boolean
}

export interface SearchBarProps {
  placeholder?: string
  value?: string
}

// ── Data / View ───────────────────────────────────────────────────

export interface DataCardProps {
  label: string
  value: string | number
  unit?: string
  trend?: 'up' | 'down' | 'neutral'
  color?: string
  size?: 'sm' | 'md' | 'lg'
}

export interface MetricProps {
  value: string | number
  label?: string
  unit?: string
  color?: string
  delta?: string
}

export interface ChartProps {
  type: 'bar' | 'line' | 'area'
  data: { label: string; value: number }[]
  height?: number
  color?: string
}

export interface TimelineProps {
  items: {
    label: string
    time?: string
    status?: 'done' | 'active' | 'pending'
    description?: string
  }[]
  orientation?: 'vertical' | 'horizontal'
}

export interface CalendarViewProps {
  year?: number
  month?: number
  highlights?: string[]       // ISO date strings
  today?: string
}

export interface DiffViewProps {
  before: string
  after: string
  lang?: string
  inline?: boolean
}

export interface EntityCardProps {
  entity_type: string         // P / R / V / S / E / task / page
  entity_id?: string
  title: string
  description?: string
  status?: string
  meta?: Record<string, string>
  compact?: boolean
}

export interface TableViewProps {
  headers: { key: string; label: string; width?: string }[]
  rows: Record<string, string | number>[]
  selectable?: boolean
  compact?: boolean
}

// ── AI-specific ───────────────────────────────────────────────────

export interface MessageBubbleProps {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  timestamp?: string
  model?: string
  streaming?: boolean
}

export interface ThoughtTraceProps {
  thoughts: string[]
  collapsed?: boolean
  label?: string
}

export interface SuggestionChipsProps {
  items: string[]
  multi?: boolean
  selected?: string[]
}

export interface FollowUpQuestionsProps {
  questions: string[]
  context?: string
}

export interface ConfidenceBadgeProps {
  value: number               // 0~1
  label?: string
  size?: 'sm' | 'md' | 'lg'
  showBar?: boolean
}

export interface MemoryReferenceProps {
  memory_id?: string
  title: string
  excerpt?: string
  source?: string
  relevance?: number
}

export interface TaskPlanProps {
  steps: {
    id: string
    label: string
    status: 'pending' | 'running' | 'done' | 'failed' | 'skipped'
    tool?: string
    note?: string
  }[]
  title?: string
  showProgress?: boolean
}

export interface AgentStepProps {
  label: string
  status: 'pending' | 'running' | 'done' | 'failed' | 'skipped'
  step_id?: string
  tool?: string
  output?: string
  duration_ms?: number
  expanded?: boolean
}

export interface ToolCallCardProps {
  tool_name: string
  status: 'calling' | 'done' | 'error'
  input?: Record<string, unknown>
  output?: unknown
  duration_ms?: number
  error?: string
}
