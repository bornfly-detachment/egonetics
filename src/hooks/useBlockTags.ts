// ============================================================
//  useBlockTags.ts  —  标签 CRUD 管理 Hook
// ============================================================
import { useState, useEffect, useCallback } from 'react'
import type { BlockTagNode } from '../components/types'
import { DEFAULT_TAG_TREE } from '../components/types'

const STORAGE_KEY = 'egonetics-block-tags'

// 生成唯一 ID
function generateTagId(): string {
  return `tag-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

// 从 localStorage 加载标签树
function loadTagTree(): BlockTagNode[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (e) {
    console.warn('Failed to load tag tree from localStorage:', e)
  }
  // 默认标签树
  return DEFAULT_TAG_TREE
}

// 保存标签树到 localStorage
function saveTagTree(tree: BlockTagNode[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tree))
  } catch (e) {
    console.error('Failed to save tag tree to localStorage:', e)
  }
}

// 递归查找标签
function findTagInTree(
  tree: BlockTagNode[],
  tagId: string
): { node: BlockTagNode; parent: BlockTagNode | null; path: BlockTagNode[] } | null {
  for (const node of tree) {
    if (node.id === tagId) {
      return { node, parent: null, path: [node] }
    }
    if (node.children) {
      const found = findTagInTree(node.children, tagId)
      if (found) {
        return {
          node: found.node,
          parent: node,
          path: [node, ...found.path],
        }
      }
    }
  }
  return null
}

// 递归删除标签
function removeTagFromTree(tree: BlockTagNode[], tagId: string): BlockTagNode[] {
  return tree.filter((node) => {
    if (node.id === tagId) {
      return false
    }
    if (node.children) {
      node.children = removeTagFromTree(node.children, tagId)
    }
    return true
  })
}

// 递归更新标签
function updateTagInTree(
  tree: BlockTagNode[],
  tagId: string,
  updates: Partial<BlockTagNode>
): BlockTagNode[] {
  return tree.map((node) => {
    if (node.id === tagId) {
      return { ...node, ...updates }
    }
    if (node.children) {
      return {
        ...node,
        children: updateTagInTree(node.children, tagId, updates),
      }
    }
    return node
  })
}

// 递归添加子标签
function addChildTagToTree(
  tree: BlockTagNode[],
  parentId: string | null,
  newTag: BlockTagNode
): BlockTagNode[] {
  if (parentId === null) {
    return [...tree, newTag]
  }

  return tree.map((node) => {
    if (node.id === parentId) {
      return {
        ...node,
        children: [...(node.children || []), newTag],
      }
    }
    if (node.children) {
      return {
        ...node,
        children: addChildTagToTree(node.children, parentId, newTag),
      }
    }
    return node
  })
}

// 移动标签（改变顺序或父节点）
function moveTagInTree(
  tree: BlockTagNode[],
  tagId: string,
  newParentId: string | null,
  newPosition: number
): BlockTagNode[] {
  // 先找到并移除标签
  const tagInfo = findTagInTree(tree, tagId)
  if (!tagInfo) return tree

  const tagToMove = { ...tagInfo.node }
  let newTree = removeTagFromTree(tree, tagId)

  // 添加到新位置
  if (newParentId === null) {
    // 添加到根级别
    const result = [...newTree]
    result.splice(newPosition, 0, tagToMove)
    return result
  } else {
    // 添加到某个父节点下
    return addChildTagToTree(newTree, newParentId, tagToMove)
  }
}

export function useBlockTags() {
  const [tagTree, setTagTree] = useState<BlockTagNode[]>(() => loadTagTree())

  // 保存到 localStorage
  useEffect(() => {
    saveTagTree(tagTree)
  }, [tagTree])

  // 创建标签
  const createTag = useCallback(
    (parentId: string | null, name: string, color?: string): BlockTagNode => {
      const newTag: BlockTagNode = {
        id: generateTagId(),
        name,
        color: color || '#6b7280',
      }

      setTagTree((prev) => addChildTagToTree(prev, parentId, newTag))
      return newTag
    },
    []
  )

  // 更新标签
  const updateTag = useCallback((tagId: string, updates: Partial<BlockTagNode>) => {
    setTagTree((prev) => updateTagInTree(prev, tagId, updates))
  }, [])

  // 删除标签
  const deleteTag = useCallback((tagId: string) => {
    setTagTree((prev) => removeTagFromTree(prev, tagId))
  }, [])

  // 移动标签
  const moveTag = useCallback((tagId: string, newParentId: string | null, newPosition: number) => {
    setTagTree((prev) => moveTagInTree(prev, tagId, newParentId, newPosition))
  }, [])

  // 查找标签
  const findTag = useCallback(
    (tagId: string) => {
      return findTagInTree(tagTree, tagId)
    },
    [tagTree]
  )

  // 重置为默认标签
  const resetToDefault = useCallback(() => {
    setTagTree(DEFAULT_TAG_TREE)
  }, [])

  return {
    tagTree,
    setTagTree,
    createTag,
    updateTag,
    deleteTag,
    moveTag,
    findTag,
    resetToDefault,
  }
}
