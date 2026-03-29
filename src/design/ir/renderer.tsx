/**
 * IR Renderer — IR JSON → React 组件树
 *
 * 双向通信原则：
 *   A→B top-down:  IRCtx.local 向下传递（显式 context prop）
 *   B→A bottom-up: IRCtx.graph.findConnected() 通过 Relation 反向查祖先
 *
 * data_binding 路径规则：
 *   "task.status"          → ctx.local.task?.status
 *   "@graph.parent.title"  → graph.findConnected(entityId, type)[0]?.data?.title
 */
import { createContext, useContext, type ReactNode } from 'react'
import type { IRTree, IRNode, IRCtxValue, IRAction, GraphCtx, GraphRelation, GraphEntity } from './types'
import { REGISTRY, isAllowedComponent } from '../allowed-components/registry'

// ── IRContext ─────────────────────────────────────────────────────

const IRContext = createContext<IRCtxValue>({
  local: {},
  graph: undefined,
  dispatch: () => {},
  resolve: () => undefined,
})

export function useIRCtx(): IRCtxValue {
  return useContext(IRContext)
}

// ── path resolver ─────────────────────────────────────────────────

function getByPath(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== 'object') return undefined
  return path.split('.').reduce((cur: unknown, key) => {
    if (cur == null || typeof cur !== 'object') return undefined
    return (cur as Record<string, unknown>)[key]
  }, obj)
}

function makeResolve(local: Record<string, unknown>, graph?: GraphCtx) {
  return (path: string): unknown => {
    // "@graph.*" → graph lookup (B→A bottom-up)
    if (path.startsWith('@graph.')) {
      if (!graph) return undefined
      const rest = path.slice(7)    // remove "@graph."
      // e.g. "parent.title" → findConnected(...)[0]?.data?.title
      const [connector, ...fieldParts] = rest.split('.')
      const connected = graph.findConnected('', '', connector)
      if (!connected.length) return undefined
      return fieldParts.length ? getByPath(connected[0].data, fieldParts.join('.')) : connected[0]
    }
    // "@entity.type.id" → direct entity lookup
    if (path.startsWith('@entity.')) {
      if (!graph) return undefined
      const [, entityType, entityId] = path.split('.')
      return graph.entities.get(`${entityType}:${entityId}`)
    }
    // default: local context (A→B top-down)
    return getByPath(local, path)
  }
}

// ── GraphCtx factory ──────────────────────────────────────────────

export function buildGraphCtx(
  entities: GraphEntity[],
  relations: GraphRelation[],
): GraphCtx {
  const entityMap = new Map<string, Record<string, unknown>>()
  for (const e of entities) {
    entityMap.set(`${e.entity_type}:${e.entity_id}`, e.data)
  }
  return {
    entities: entityMap,
    relations,
    findConnected(entityId, entityType, relationType) {
      return relations
        .filter(r =>
          (r.source_id === entityId || r.target_id === entityId || (!entityId && !entityType)) &&
          (!relationType || r.relation_type === relationType)
        )
        .map(r => {
          const isSource = r.source_id === entityId
          const id   = isSource ? r.target_id   : r.source_id
          const type = isSource ? r.target_type  : r.source_type
          return { id, type, data: entityMap.get(`${type}:${id}`) ?? {} }
        })
    },
  }
}

// ── Render single IRNode ──────────────────────────────────────────

function RenderNode({ node }: { node: IRNode }): ReactNode {
  const ctx = useIRCtx()

  if (!isAllowedComponent(node.type)) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[IRRenderer] Unknown component type: "${node.type}" — skipped`)
    }
    return null
  }

  const Component = REGISTRY[node.type]

  // Resolve data_binding: merge resolved values into props
  let resolvedProps: Record<string, unknown> = { ...(node.props ?? {}) }
  if (node.data_binding) {
    for (const [propKey, bindPath] of Object.entries(node.data_binding)) {
      const val = ctx.resolve(bindPath)
      if (val !== undefined) resolvedProps[propKey] = val
    }
  }

  // Attach on_action dispatcher
  if (node.on_action) {
    const action = node.on_action
    resolvedProps = { ...resolvedProps, onClick: () => ctx.dispatch(action) }
  }

  // Render children recursively
  const children = node.children?.length
    ? node.children.map((child, i) => (
        <RenderNode key={child.key ?? i} node={child} />
      ))
    : undefined

  return <Component {...resolvedProps}>{children}</Component>
}

// ── IRRenderer (public API) ───────────────────────────────────────

interface IRRendererProps {
  /** IR tree or single node */
  ir: IRTree | IRNode
  /**
   * Top-down context (A→B).
   * Merged with ir.context if IRTree is passed.
   */
  context?: Record<string, unknown>
  /**
   * PRVSE Relation graph for bottom-up lookup (B→A).
   * Build with buildGraphCtx(entities, relations).
   */
  graph?: GraphCtx
  /**
   * Action dispatcher — component触发 IRAction 时调用.
   * 父组件决定如何处理 navigate / api_call / emit_event 等.
   */
  onAction?: (action: IRAction) => void
}

export function IRRenderer({ ir, context, graph, onAction }: IRRendererProps) {
  const isTree = 'intent' in ir
  const rootNode: IRNode = isTree ? (ir as IRTree).root : (ir as IRNode)
  const mergedLocal: Record<string, unknown> = {
    ...(isTree ? (ir as IRTree).context ?? {} : {}),
    ...(context ?? {}),
  }

  const resolve = makeResolve(mergedLocal, graph)
  const dispatch = (action: IRAction) => onAction?.(action)

  const ctxValue: IRCtxValue = {
    local: mergedLocal,
    graph,
    dispatch,
    resolve,
  }

  return (
    <IRContext.Provider value={ctxValue}>
      <RenderNode node={rootNode} />
    </IRContext.Provider>
  )
}
