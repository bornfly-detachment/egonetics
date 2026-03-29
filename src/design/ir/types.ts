/**
 * IR (Intent Representation) — 自然语言 → 结构化 UI 描述
 *
 * 双向通信原则：
 *   A→B top-down: IRTree.context 向下传递
 *   B→A bottom-up: GraphCtx.findConnected() 通过 Relation 反向找祖先
 */

// ── 42 个 allowed_components 的类型名 ────────────────────────────

export type LayoutType =
  | 'Page' | 'Section' | 'Stack' | 'Row'
  | 'Grid' | 'SplitPane' | 'CardContainer' | 'ScrollArea'

export type ContentType =
  | 'Text' | 'Title' | 'Subtitle' | 'Paragraph'
  | 'CodeBlock' | 'Quote' | 'List' | 'Table'

export type ActionType =
  | 'Button' | 'IconButton' | 'PrimaryAction' | 'SecondaryAction'
  | 'Link' | 'Toggle' | 'Slider' | 'Input' | 'SearchBar'

export type DataType =
  | 'DataCard' | 'Metric' | 'Chart' | 'Timeline'
  | 'CalendarView' | 'DiffView' | 'EntityCard' | 'TableView'

export type AIType =
  | 'MessageBubble' | 'ThoughtTrace' | 'SuggestionChips' | 'FollowUpQuestions'
  | 'ConfidenceBadge' | 'MemoryReference' | 'TaskPlan' | 'AgentStep' | 'ToolCallCard'

export type ComponentType = LayoutType | ContentType | ActionType | DataType | AIType

// ── IRAction — 组件触发的行为 ─────────────────────────────────────

export interface IRAction {
  type: 'navigate' | 'api_call' | 'update_context' | 'emit_event' | 'nl_query'
  payload?: Record<string, unknown>
}

// ── IRNode — IR 树节点 ────────────────────────────────────────────

export interface IRNode {
  type: ComponentType
  props?: Record<string, unknown>
  children?: IRNode[]
  /**
   * 数据绑定路径，两种来源：
   *   "task.status"         → local context (top-down A→B)
   *   "@graph.parent.title" → Relation graph (bottom-up B→A)
   */
  data_binding?: Record<string, string>
  on_action?: IRAction
  key?: string
}

// ── IRTree — 完整 IR 文档 ─────────────────────────────────────────

export interface IRTree {
  intent: string
  source: 'agent' | 'nl' | 'protocol_template' | 'manual'
  /** 传入 Renderer 的初始 local context */
  context?: Record<string, unknown>
  root: IRNode
  /** 创建时间，用于缓存/版本管理 */
  created_at?: string
}

// ── GraphCtx — Relation graph 双向查找 ───────────────────────────

export interface GraphRelation {
  source_type: string
  source_id: string
  target_type: string
  target_id: string
  relation_type: string
  title?: string
}

export interface GraphEntity {
  entity_type: string
  entity_id: string
  data: Record<string, unknown>
}

export interface GraphCtx {
  /** 预加载的实体数据 Map: "entityType:entityId" → data */
  entities: Map<string, Record<string, unknown>>
  /** 预加载的关系列表 */
  relations: GraphRelation[]
  /**
   * 从 entityId 出发，通过 Relation 反向找连接实体
   * B→A: component B 可以找到触发它的 component A 的上下文
   */
  findConnected: (
    entityId: string,
    entityType: string,
    relationType?: string
  ) => Array<{ id: string; type: string; data: Record<string, unknown> }>
}

// ── IRCtx — Renderer 内部 context（React Context 的值类型）────────

export interface IRCtxValue {
  /** top-down 显式传入的数据 (A→B) */
  local: Record<string, unknown>
  /** PRVSE Relation graph，用于 bottom-up 查找 (B→A) */
  graph?: GraphCtx
  /** 组件触发 action 时的 dispatch */
  dispatch: (action: IRAction) => void
  /** 解析 data_binding 路径 */
  resolve: (path: string) => unknown
}
