/**
 * Component Registry — allowed_components 白名单注册表
 * IR renderer 通过此注册表实例化组件，任何不在此表中的 type 会被拒绝
 */
import type { ComponentType } from '../ir/types'

// Layout
import { Page, Section, Stack, Row, Grid, SplitPane, CardContainer, ScrollArea } from './layout'
// Content
import { Text, Title, Subtitle, Paragraph, CodeBlock, Quote, List, Table } from './content'
// Action
import { Button, IconButton, PrimaryAction, SecondaryAction, Link, Toggle, Slider, Input, SearchBar } from './action'
// Data
import { DataCard, Metric, Chart, Timeline, CalendarView, DiffView, EntityCard, TableView } from './data'
// AI
import {
  MessageBubble, ThoughtTrace, SuggestionChips, FollowUpQuestions,
  ConfidenceBadge, MemoryReference, TaskPlan, AgentStep, ToolCallCard,
} from './ai'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const REGISTRY: Record<ComponentType, React.ComponentType<any>> = {
  // Layout
  Page, Section, Stack, Row, Grid, SplitPane, CardContainer, ScrollArea,
  // Content
  Text, Title, Subtitle, Paragraph, CodeBlock, Quote, List, Table,
  // Action
  Button, IconButton, PrimaryAction, SecondaryAction, Link, Toggle, Slider, Input, SearchBar,
  // Data
  DataCard, Metric, Chart, Timeline, CalendarView, DiffView, EntityCard, TableView,
  // AI
  MessageBubble, ThoughtTrace, SuggestionChips, FollowUpQuestions,
  ConfidenceBadge, MemoryReference, TaskPlan, AgentStep, ToolCallCard,
} as const

export function isAllowedComponent(type: string): type is ComponentType {
  return type in REGISTRY
}
