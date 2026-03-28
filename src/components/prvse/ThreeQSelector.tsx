/**
 * ThreeQSelector — TagTree AOP 核心组件
 *
 * 使用方式（一行导入，挂到任意实体）：
 *
 *   import ThreeQSelector from '@/components/prvse/ThreeQSelector'
 *
 *   <ThreeQSelector entityId="task-123" entityType="task_component" />
 *
 * 功能：
 * - 读取/保存实体的三问标签（从哪来？是什么？要去哪？）
 * - 从全局 useTagTreeStore 消费标签树，CRUD 操作全局同步
 * - 懒加载：首次渲染时从 DB 加载打标记录
 * - 折叠/展开面板
 */

import { useEffect, useState, useCallback } from 'react'
import { useTagTreeStore, TagNode, PrvseClassification } from '@/stores/useTagTreeStore'

// ── 类型 ────────────────────────────────────────────────────

interface ThreeQSelectorProps {
  entityId: string
  entityType: string
  /** 精简模式：只显示标签选择，不显示层选择和描述 */
  compact?: boolean
  /** 只读模式 */
  readOnly?: boolean
  /** 初始折叠状态 */
  defaultCollapsed?: boolean
  /** 保存后回调 */
  onSaved?: (clf: PrvseClassification) => void
}

// PRVSE 四层
const LAYERS = [
  { id: 'P', label: '感知层 P', color: '#60a5fa' },
  { id: 'R', label: '关系+价值层 R', color: '#a78bfa' },
  { id: 'V', label: '关系+价值层 V', color: '#34d399' },
  { id: 'S', label: '状态+演化层 S', color: '#fbbf24' },
]

// ── 标签选择按钮 ─────────────────────────────────────────────

function TagPill({ node, selected, onToggle, readOnly }: {
  node: TagNode
  selected: boolean
  onToggle: () => void
  readOnly?: boolean
}) {
  return (
    <button
      type="button"
      disabled={readOnly}
      onClick={onToggle}
      style={{ borderColor: node.color, color: selected ? '#fff' : node.color, backgroundColor: selected ? node.color + 'cc' : 'transparent' }}
      className="px-2 py-0.5 rounded text-xs border transition-colors disabled:cursor-default"
    >
      {node.name}
    </button>
  )
}

// ── 单个三问 section ─────────────────────────────────────────

function TagGroup({ label, nodes, selected, onToggle, readOnly }: {
  label: string
  nodes: TagNode[]
  selected: string[]
  onToggle: (id: string) => void
  readOnly?: boolean
}) {
  if (!nodes.length) return null
  return (
    <div className="space-y-1">
      <div className="text-xs text-neutral-500 font-medium">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {nodes.map(n => (
          <TagPill
            key={n.id}
            node={n}
            selected={selected.includes(n.id)}
            onToggle={() => onToggle(n.id)}
            readOnly={readOnly}
          />
        ))}
      </div>
    </div>
  )
}

// ── 主组件 ──────────────────────────────────────────────────

const DEFAULT_CLF: Omit<PrvseClassification, 'entity_id' | 'entity_type'> = {
  layer: '',
  from_tags: [], what_tags: [], where_tags: [],
  from_text: '', what_text: '', where_text: '',
  description: '',
}

export default function ThreeQSelector({
  entityId,
  entityType,
  compact = false,
  readOnly = false,
  defaultCollapsed = false,
  onSaved,
}: ThreeQSelectorProps) {
  const { tree, loadTree, loadClassification, saveClassification } = useTagTreeStore()

  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const [clf, setClf] = useState<Omit<PrvseClassification, 'entity_id' | 'entity_type'>>(DEFAULT_CLF)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  // 加载标签树（全局 store 已有则跳过网络请求）
  useEffect(() => {
    if (!tree.length) loadTree()
  }, [])

  // 加载当前实体打标记录
  useEffect(() => {
    setLoading(true)
    loadClassification(entityId, entityType)
      .then(data => {
        if (data) {
          setClf({
            layer:       data.layer       ?? '',
            from_tags:   data.from_tags   ?? [],
            what_tags:   data.what_tags   ?? [],
            where_tags:  data.where_tags  ?? [],
            from_text:   data.from_text   ?? '',
            what_text:   data.what_text   ?? '',
            where_text:  data.where_text  ?? '',
            description: data.description ?? '',
          })
        } else {
          setClf(DEFAULT_CLF)
        }
      })
      .catch(() => setClf(DEFAULT_CLF))
      .finally(() => setLoading(false))
  }, [entityId, entityType])

  const toggleTag = useCallback((field: 'from_tags' | 'what_tags' | 'where_tags', tagId: string) => {
    if (readOnly) return
    setClf(prev => {
      const arr = prev[field]
      const next = arr.includes(tagId) ? arr.filter(x => x !== tagId) : [...arr, tagId]
      return { ...prev, [field]: next }
    })
    setDirty(true)
  }, [readOnly])

  const setLayer = useCallback((layer: string) => {
    if (readOnly) return
    setClf(prev => ({ ...prev, layer }))
    setDirty(true)
  }, [readOnly])

  const handleSave = async () => {
    if (!dirty || saving) return
    setSaving(true)
    try {
      const full: PrvseClassification = { entity_id: entityId, entity_type: entityType, ...clf }
      await saveClassification(full)
      setDirty(false)
      onSaved?.(full)
    } finally {
      setSaving(false)
    }
  }

  // 找到当前激活层对应的标签树节点（根节点按层 P/V/S/R 匹配）
  const layerNode = clf.layer ? tree.find(n => n.name === clf.layer || n.id.startsWith(clf.layer.toLowerCase())) : null
  const layerChildren = layerNode?.children ?? []

  // 三问子节点（按名称匹配）
  const fromNode  = layerChildren.find(c => c.name.includes('从哪来') || c.name.includes('From'))
  const whatNode  = layerChildren.find(c => c.name.includes('是什么') || c.name.includes('What'))
  const whereNode = layerChildren.find(c => c.name.includes('要去哪') || c.name.includes('Where') || c.name.includes('去哪'))

  // 若无层过滤，直接展示全部根节点的子节点
  const fromNodes  = fromNode?.children  ?? (clf.layer ? [] : tree.flatMap(r => r.children?.find(c => c.name.includes('从哪来'))?.children ?? []))
  const whatNodes  = whatNode?.children  ?? (clf.layer ? [] : tree.flatMap(r => r.children?.find(c => c.name.includes('是什么'))?.children ?? []))
  const whereNodes = whereNode?.children ?? (clf.layer ? [] : tree.flatMap(r => r.children?.find(c => c.name.includes('要去哪') || c.name.includes('去哪'))?.children ?? []))

  if (loading) return (
    <div className="text-xs text-neutral-500 py-2">加载三问标签…</div>
  )

  return (
    <div className="rounded-lg border border-neutral-700 bg-neutral-900 overflow-hidden">
      {/* 标题栏 */}
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs text-neutral-400 hover:text-white transition-colors"
      >
        <span className="font-medium text-neutral-300">三问分类 <span className="text-neutral-600">AOP</span></span>
        <div className="flex items-center gap-2">
          {clf.layer && (
            <span
              className="px-1.5 py-0.5 rounded text-xs"
              style={{ color: LAYERS.find(l => l.id === clf.layer)?.color ?? '#9ca3af' }}
            >
              {clf.layer}
            </span>
          )}
          {dirty && !readOnly && (
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" title="未保存" />
          )}
          <svg
            className={`w-3.5 h-3.5 transition-transform ${collapsed ? '' : 'rotate-180'}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {!collapsed && (
        <div className="px-3 pb-3 space-y-3">
          {/* 层选择 */}
          {!compact && (
            <div className="flex gap-1.5 flex-wrap">
              {LAYERS.map(l => (
                <button
                  key={l.id}
                  type="button"
                  disabled={readOnly}
                  onClick={() => setLayer(clf.layer === l.id ? '' : l.id)}
                  style={{
                    borderColor: l.color,
                    color: clf.layer === l.id ? '#fff' : l.color,
                    backgroundColor: clf.layer === l.id ? l.color + 'cc' : 'transparent',
                  }}
                  className="px-2 py-0.5 rounded text-xs border transition-colors disabled:cursor-default"
                >
                  {l.label}
                </button>
              ))}
            </div>
          )}

          {/* 从哪来 */}
          {(fromNode || fromNodes.length > 0) && (
            <TagGroup
              label="从哪来？"
              nodes={fromNode?.children ?? fromNodes}
              selected={clf.from_tags}
              onToggle={id => toggleTag('from_tags', id)}
              readOnly={readOnly}
            />
          )}

          {/* 是什么 */}
          {(whatNode || whatNodes.length > 0) && (
            <TagGroup
              label="是什么？"
              nodes={whatNode?.children ?? whatNodes}
              selected={clf.what_tags}
              onToggle={id => toggleTag('what_tags', id)}
              readOnly={readOnly}
            />
          )}

          {/* 要去哪 */}
          {(whereNode || whereNodes.length > 0) && (
            <TagGroup
              label="要去哪？"
              nodes={whereNode?.children ?? whereNodes}
              selected={clf.where_tags}
              onToggle={id => toggleTag('where_tags', id)}
              readOnly={readOnly}
            />
          )}

          {/* 描述 */}
          {!compact && !readOnly && (
            <textarea
              rows={2}
              placeholder="简要描述此实体（供 AI 打标参考）"
              value={clf.description}
              onChange={e => { setClf(p => ({ ...p, description: e.target.value })); setDirty(true) }}
              className="w-full bg-neutral-800 text-neutral-200 placeholder-neutral-600 text-xs rounded px-2 py-1.5 border border-neutral-700 focus:border-neutral-500 resize-none outline-none"
            />
          )}

          {/* 保存按钮 */}
          {!readOnly && dirty && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-3 py-1 rounded text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition-colors"
              >
                {saving ? '保存中…' : '保存标签'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
