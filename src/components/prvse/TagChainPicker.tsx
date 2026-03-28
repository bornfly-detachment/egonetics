/**
 * TagChainPicker — 内嵌树状标签选择器
 *
 * 用于三问各 section 内，展示：
 *   1. 可展开的树形标签浏览器（点击叶节点选择/取消）
 *   2. 已选标签以链式路径展示：A → B → C → 叶节点
 */

import { useState } from 'react'
import { ChevronRight, ChevronDown, X } from 'lucide-react'
import type { TagNode } from '@/stores/useTagTreeStore'

// ── 路径查找 ─────────────────────────────────────────────────

function findPath(nodes: TagNode[], targetId: string, path: TagNode[] = []): TagNode[] | null {
  for (const n of nodes) {
    const next = [...path, n]
    if (n.id === targetId) return next
    if (n.children?.length) {
      const found = findPath(n.children, targetId, next)
      if (found) return found
    }
  }
  return null
}

// ── 叶节点判断 ───────────────────────────────────────────────

function isLeaf(node: TagNode) {
  return !node.children || node.children.length === 0
}

// ── 树节点组件 ───────────────────────────────────────────────

function TreeNode({
  node, depth, selected, fullTree, onToggle,
}: {
  node: TagNode
  depth: number
  selected: string[]
  fullTree: TagNode[]
  onToggle: (id: string) => void
}) {
  const [open, setOpen] = useState(depth < 2)
  const leaf = isLeaf(node)
  const isSelected = selected.includes(node.id)
  const hasSelectedChild = !leaf && (node.children ?? []).some(c => hasSelected(c, selected))

  return (
    <div style={{ paddingLeft: depth * 12 }}>
      <div
        className={`flex items-center gap-1 py-0.5 px-1 rounded cursor-pointer group
          ${leaf
            ? isSelected
              ? 'bg-blue-500/20 text-blue-300'
              : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
            : 'text-neutral-500 hover:text-neutral-300'
          }`}
        onClick={() => {
          if (leaf) onToggle(node.id)
          else setOpen(o => !o)
        }}
      >
        {/* 展开图标 */}
        {!leaf ? (
          <span className="w-3 h-3 shrink-0 text-neutral-600">
            {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          </span>
        ) : (
          <span className={`w-2 h-2 rounded-full shrink-0 border ${
            isSelected ? 'bg-blue-400 border-blue-400' : 'border-neutral-600'
          }`} />
        )}

        <span
          className="text-[11px] leading-relaxed truncate"
          style={!leaf && node.color ? { color: hasSelectedChild ? node.color : undefined } : {}}
        >
          {node.name}
        </span>

        {hasSelectedChild && !open && (
          <span className="ml-auto text-[9px] text-blue-400/60 shrink-0">
            {countSelected(node, selected)}
          </span>
        )}
      </div>

      {!leaf && open && (
        <div>
          {(node.children ?? []).map(c => (
            <TreeNode
              key={c.id}
              node={c}
              depth={depth + 1}
              selected={selected}
              fullTree={fullTree}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function hasSelected(node: TagNode, selected: string[]): boolean {
  if (selected.includes(node.id)) return true
  return (node.children ?? []).some(c => hasSelected(c, selected))
}

function countSelected(node: TagNode, selected: string[]): number {
  let count = selected.includes(node.id) ? 1 : 0
  for (const c of node.children ?? []) count += countSelected(c, selected)
  return count
}

// ── 链式路径展示 ─────────────────────────────────────────────

function TagChain({
  tagId, fullTree, onRemove,
}: {
  tagId: string
  fullTree: TagNode[]
  onRemove: () => void
}) {
  const path = findPath(fullTree, tagId)
  if (!path?.length) return null

  return (
    <div className="flex items-center gap-0.5 flex-wrap bg-neutral-800/60 border border-neutral-700/50 rounded px-2 py-1 group">
      {path.map((n, i) => (
        <span key={n.id} className="flex items-center gap-0.5">
          {i > 0 && <ChevronRight size={9} className="text-neutral-600" />}
          <span
            className={`text-[11px] ${i === path.length - 1 ? 'text-blue-300 font-medium' : 'text-neutral-500'}`}
            style={i === path.length - 1 && path[0]?.color ? { color: path[0].color } : {}}
          >
            {n.name}
          </span>
        </span>
      ))}
      <button
        onClick={onRemove}
        className="ml-1 opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-red-400 transition-all"
      >
        <X size={9} />
      </button>
    </div>
  )
}

// ── 主组件 ──────────────────────────────────────────────────

interface TagChainPickerProps {
  /** 完整标签树（从 useTagTreeStore 获取） */
  fullTree: TagNode[]
  /** 过滤后只展示这些根节点（如：每层的"从哪来"子树） */
  roots: TagNode[]
  /** 当前已选标签 ID 列表 */
  selected: string[]
  /** 选择变化回调 */
  onChange: (ids: string[]) => void
  placeholder?: string
}

export default function TagChainPicker({
  fullTree, roots, selected, onChange, placeholder = '展开选择标签…',
}: TagChainPickerProps) {
  const [open, setOpen] = useState(false)

  function toggle(id: string) {
    onChange(
      selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]
    )
  }

  const hasAny = selected.length > 0

  return (
    <div className="space-y-2">
      {/* 已选标签链式展示 */}
      {hasAny && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map(id => (
            <TagChain
              key={id}
              tagId={id}
              fullTree={fullTree}
              onRemove={() => toggle(id)}
            />
          ))}
        </div>
      )}

      {/* 展开/收起树选择器 */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1 text-[11px] transition-colors ${
          open ? 'text-neutral-400' : 'text-neutral-600 hover:text-neutral-400'
        }`}
      >
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        {open ? '收起' : (hasAny ? '修改标签' : placeholder)}
      </button>

      {open && roots.length > 0 && (
        <div className="border border-neutral-800 rounded-lg bg-neutral-950/60 p-2 max-h-56 overflow-y-auto">
          {roots.map(n => (
            <TreeNode
              key={n.id}
              node={n}
              depth={0}
              selected={selected}
              fullTree={fullTree}
              onToggle={toggle}
            />
          ))}
        </div>
      )}

      {open && roots.length === 0 && (
        <div className="text-[11px] text-neutral-700 py-2">暂无可用标签（TagTree 为空）</div>
      )}
    </div>
  )
}
