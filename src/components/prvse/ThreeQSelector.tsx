/**
 * ThreeQSelector — TagTree AOP 核心组件（接入 AOP Pipeline）
 *
 * 功能：
 * - 读取/保存实体的三问标签（从哪来？是什么？要去哪？）
 * - 触发 T0→T1→宪法路由自动分类 pipeline
 * - 显示 AOP 状态（running/complete/needs_human_review）
 * - 冲突时显示人工打标入口
 */

import { useEffect, useState, useCallback } from 'react'
import { useTagTreeStore, TagNode, PrvseClassification } from '@/stores/useTagTreeStore'
import { authFetch } from '@/lib/http'

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
  /** 触发 AOP 时的内容文本（Block 内容） */
  content?: string
  /** 元信息（由调用方感知，不写死） */
  sourceMeta?: Record<string, unknown>
}

type AopStatus = 'none' | 'running' | 'complete' | 'needs_human_review' | 'human_reviewed' | 'error'

interface AopResult {
  aop_status: AopStatus
  needs_human_review: boolean
  conflicts: string[]
  constitution_route: { routes: Array<{ rule_id: string; category: string; layer: string; label: string; match: string }>; unmatched: boolean }
  t0_result: Record<string, unknown>
  source_meta: Record<string, unknown>
  aop_ran_at?: string
}

// PRVSE 四层
const LAYERS = [
  { id: 'P', label: '感知层 P', color: '#60a5fa' },
  { id: 'R', label: '关系+价值层 R', color: '#a78bfa' },
  { id: 'V', label: '关系+价值层 V', color: '#34d399' },
  { id: 'S', label: '状态+演化层 S', color: '#fbbf24' },
]

// ── 工具函数 ────────────────────────────────────────────────

/** 获取 targetId 节点的所有兄弟节点 id（不含自身） */
function getSiblingIds(tree: TagNode[], targetId: string): string[] {
  for (const node of tree) {
    if (node.children) {
      if (node.children.some(c => c.id === targetId)) {
        return node.children.filter(c => c.id !== targetId).map(c => c.id)
      }
      const found = getSiblingIds(node.children, targetId)
      if (found.length > 0) return found
    }
  }
  return []
}

// ── 递归树节点 ──────────────────────────────────────────────

function TagTreeNode({
  node,
  selected,
  onToggle,
  readOnly,
  level = 0,
  parentSelectMode = 'multi',
}: {
  node: TagNode
  selected: string[]
  onToggle: (tagId: string, parentSelectMode: 'single' | 'multi') => void
  readOnly?: boolean
  level?: number
  parentSelectMode?: 'single' | 'multi'
}) {
  const [expanded, setExpanded] = useState(level < 2)
  const hasChildren = node.children && node.children.length > 0
  const isSelected = selected.includes(node.id)
  const isSingle = parentSelectMode === 'single'

  return (
    <div className="select-none">
      <div
        className={`flex items-center gap-1.5 px-1.5 py-1 rounded cursor-pointer transition-colors ${
          isSelected
            ? isSingle
              ? 'bg-amber-500/15 text-amber-300'
              : 'bg-blue-500/20 text-blue-300'
            : readOnly
              ? 'text-neutral-400'
              : 'hover:bg-white/5 text-neutral-300'
        }`}
        style={{ paddingLeft: `${level * 14 + 4}px` }}
        onClick={() => {
          if (!readOnly) onToggle(node.id, parentSelectMode)
        }}
      >
        {/* 展开/收起按钮 */}
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setExpanded(v => !v)
            }}
            className="p-0.5 hover:bg-white/10 rounded shrink-0"
          >
            <svg
              className={`w-3 h-3 transition-transform text-neutral-500 ${expanded ? 'rotate-90' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}

        {/* 颜色圆点 */}
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: node.color || '#6b7280' }}
        />

        {/* 名称 */}
        <span className="flex-1 text-xs">{node.name}</span>

        {/* 选中指示器：单选=radio 圆点(amber)，多选=checkmark(blue) */}
        {isSingle ? (
          <span className={`shrink-0 w-3 h-3 rounded-full border-2 flex items-center justify-center ${
            isSelected ? 'border-amber-400 bg-amber-400' : 'border-neutral-600'
          }`}>
            {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white/90" />}
          </span>
        ) : (
          isSelected && (
            <svg className="w-3.5 h-3.5 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          )
        )}
      </div>

      {/* 子节点递归 */}
      {hasChildren && expanded && node.children && (
        <div className={node.select_mode === 'single' ? 'relative' : ''}>
          {/* 单选组左括线 */}
          {node.select_mode === 'single' && (
            <div
              className="pointer-events-none absolute top-0 bottom-0 w-px"
              style={{ left: `${level * 14 + 10}px`, background: node.color ?? '#f59e0b', opacity: 0.3 }}
            />
          )}
          {node.children.map(child => (
            <TagTreeNode
              key={child.id}
              node={child}
              selected={selected}
              onToggle={onToggle}
              readOnly={readOnly}
              level={level + 1}
              parentSelectMode={node.select_mode ?? 'multi'}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── 三问 section（层级树） ──────────────────────────────────

function TagSection({ label, rootNode, selected, onToggle, readOnly }: {
  label: string
  rootNode: TagNode | undefined
  selected: string[]
  onToggle: (tagId: string, parentSelectMode: 'single' | 'multi') => void
  readOnly?: boolean
}) {
  if (!rootNode || !rootNode.children?.length) return null
  return (
    <div className="space-y-1">
      <div className="text-xs text-neutral-500 font-medium">{label}</div>
      <div className="rounded border border-neutral-800 bg-neutral-900/50 py-0.5 max-h-48 overflow-y-auto">
        {rootNode.children.map(child => (
          <TagTreeNode
            key={child.id}
            node={child}
            selected={selected}
            onToggle={onToggle}
            readOnly={readOnly}
            level={0}
            parentSelectMode={rootNode.select_mode ?? 'multi'}
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
  content = '',
  sourceMeta = {},
}: ThreeQSelectorProps) {
  const { tree, loadTree, loadClassification, saveClassification } = useTagTreeStore()

  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const [clf, setClf] = useState<Omit<PrvseClassification, 'entity_id' | 'entity_type'>>(DEFAULT_CLF)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [aop, setAop] = useState<AopResult | null>(null)

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

  // 加载 AOP 状态
  useEffect(() => {
    authFetch<AopResult>(`/aop/${entityType}/${entityId}`)
      .then(data => { if (data) setAop(data) })
      .catch(() => {})
  }, [entityId, entityType])

  // AOP 轮询（running 状态时每 3s 刷新一次）
  useEffect(() => {
    if (aop?.aop_status !== 'running') return
    const timer = setInterval(() => {
      authFetch<AopResult>(`/aop/${entityType}/${entityId}`)
        .then(data => {
          if (data) {
            setAop(data)
            if (data.aop_status !== 'running') {
              // AOP 完成：更新 clf（若不是人工覆盖状态）
              if (data.aop_status !== 'human_reviewed') {
                loadClassification(entityId, entityType).then(d => {
                  if (d) setClf({ layer: d.layer ?? '', from_tags: d.from_tags ?? [], what_tags: d.what_tags ?? [], where_tags: d.where_tags ?? [], from_text: d.from_text ?? '', what_text: d.what_text ?? '', where_text: d.where_text ?? '', description: d.description ?? '' })
                })
              }
              clearInterval(timer)
            }
          }
        })
        .catch(() => {})
    }, 3000)
    return () => clearInterval(timer)
  }, [aop?.aop_status, entityId, entityType])

  // 触发 AOP pipeline
  const runAop = useCallback(async () => {
    if (!content.trim()) return
    setAop(prev => ({ ...(prev ?? {} as AopResult), aop_status: 'running', needs_human_review: false, conflicts: [] }))
    try {
      await authFetch('/aop/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId, entityType, content, sourceMeta, layer: clf.layer || 'P' }),
      })
    } catch (e) {
      setAop(prev => ({ ...(prev ?? {} as AopResult), aop_status: 'error' }))
    }
  }, [content, sourceMeta, entityId, entityType, clf.layer])

  /** 标签切换 — 尊重 select_mode：single 互斥兄弟，multi 独立 */
  const toggleTag = useCallback((field: 'from_tags' | 'what_tags' | 'where_tags', tagId: string, parentSelectMode: 'single' | 'multi') => {
    if (readOnly) return
    setClf(prev => {
      const arr = prev[field]
      if (arr.includes(tagId)) {
        // 取消选中
        return { ...prev, [field]: arr.filter(x => x !== tagId) }
      }
      if (parentSelectMode === 'single') {
        // 单选互斥：移除同级兄弟
        const siblings = getSiblingIds(tree, tagId)
        const withoutSiblings = arr.filter(x => !siblings.includes(x))
        return { ...prev, [field]: [...withoutSiblings, tagId] }
      }
      // 多选：直接追加
      return { ...prev, [field]: [...arr, tagId] }
    })
    setDirty(true)
  }, [readOnly, tree])

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

  // 若无层过滤，聚合所有根节点的三问子树
  const fallbackFrom  = !clf.layer ? tree.flatMap(r => r.children ?? []).find(c => c.name.includes('从哪来') || c.name.includes('From')) : undefined
  const fallbackWhat  = !clf.layer ? tree.flatMap(r => r.children ?? []).find(c => c.name.includes('是什么') || c.name.includes('What')) : undefined
  const fallbackWhere = !clf.layer ? tree.flatMap(r => r.children ?? []).find(c => c.name.includes('要去哪') || c.name.includes('去哪') || c.name.includes('Where')) : undefined

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
          {/* AOP 状态徽章 */}
          {aop?.aop_status === 'running' && (
            <span className="flex items-center gap-1 text-[10px] text-purple-400 animate-pulse">
              <span className="w-2.5 h-2.5 border border-purple-400 border-t-transparent rounded-full animate-spin inline-block" />
              T0 分类中
            </span>
          )}
          {aop?.aop_status === 'complete' && (
            <span className="text-[10px] text-emerald-500">✓ AOP 完成</span>
          )}
          {aop?.aop_status === 'human_reviewed' && (
            <span className="text-[10px] text-blue-400">✓ 人工审核</span>
          )}
          {aop?.needs_human_review && aop.aop_status !== 'human_reviewed' && (
            <span className="text-[10px] text-amber-400 font-medium">⚠ 需人工打标</span>
          )}
          {/* 自动分类按钮 */}
          {!readOnly && content.trim() && aop?.aop_status !== 'running' && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); runAop() }}
              className="text-[10px] px-1.5 py-0.5 rounded border border-purple-700/60 text-purple-400 hover:border-purple-500 hover:text-purple-300 transition-colors"
            >
              自动分类
            </button>
          )}
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

          {/* 从哪来 — 层级树 */}
          <TagSection
            label="从哪来？"
            rootNode={fromNode ?? fallbackFrom}
            selected={clf.from_tags}
            onToggle={(id, mode) => toggleTag('from_tags', id, mode)}
            readOnly={readOnly}
          />

          {/* 是什么 — 层级树 */}
          <TagSection
            label="是什么？"
            rootNode={whatNode ?? fallbackWhat}
            selected={clf.what_tags}
            onToggle={(id, mode) => toggleTag('what_tags', id, mode)}
            readOnly={readOnly}
          />

          {/* 要去哪 — 层级树 */}
          <TagSection
            label="要去哪？"
            rootNode={whereNode ?? fallbackWhere}
            selected={clf.where_tags}
            onToggle={(id, mode) => toggleTag('where_tags', id, mode)}
            readOnly={readOnly}
          />

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

          {/* ── 冲突人工审核提示 ─────────────────────────────── */}
          {aop?.needs_human_review && aop.aop_status !== 'human_reviewed' && aop.conflicts?.length > 0 && (
            <div className="rounded border border-amber-700/50 bg-amber-950/30 px-2.5 py-2 space-y-1">
              <div className="text-[10px] text-amber-400 font-medium">T0/T1 分类冲突，需人工确认：</div>
              {aop.conflicts.map((c, i) => (
                <div key={i} className="text-[10px] text-amber-300/70">· {c}</div>
              ))}
              <div className="text-[10px] text-neutral-500 mt-1">请在上方手动调整标签后点「保存标签」，系统将标记为人工审核完成。</div>
            </div>
          )}

          {/* ── 宪法路由结果（去哪预览）─────────────────────── */}
          {(aop?.constitution_route?.routes?.length ?? 0) > 0 && (
            <div className="rounded border border-neutral-700/60 bg-neutral-800/40 px-2.5 py-2">
              <div className="text-[10px] text-neutral-500 mb-1.5 uppercase tracking-widest">宪法路由 → 去哪</div>
              <div className="space-y-1">
                {aop!.constitution_route.routes.map(r => (
                  <div key={r.rule_id} className="flex items-center gap-1.5 text-[10px]">
                    <span className="px-1 py-px rounded font-mono text-[9px]"
                      style={{ background: 'rgba(96,165,250,0.1)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.25)' }}>
                      {r.category}/{r.layer}
                    </span>
                    <span className="text-neutral-300">{r.label}</span>
                    <span className="text-neutral-600 text-[9px] ml-auto">{r.match}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {aop?.constitution_route?.unmatched && (aop.aop_status === 'complete' || aop.aop_status === 'human_reviewed') && (
            <div className="text-[10px] text-neutral-600 italic">宪法路由未匹配 — 去哪待定</div>
          )}
        </div>
      )}
    </div>
  )
}
