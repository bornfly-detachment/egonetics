// ============================================================
//  useBlockTags.ts  —  TagTree CRUD Hook（委托全局 useTagTreeStore）
//
//  保持原有接口兼容，所有操作经由 useTagTreeStore，实现全局同步。
// ============================================================
import { useEffect } from 'react'
import type { BlockTagNode } from '../components/types'
import { useTagTreeStore, TagNode } from '../stores/useTagTreeStore'

/** 将 TagNode 转换为 BlockTagNode（结构兼容） */
function toBlockTagNode(n: TagNode): BlockTagNode {
  return {
    id: n.id,
    name: n.name,
    color: n.color,
    select_mode: n.select_mode,
    children: n.children?.map(toBlockTagNode),
  }
}

export function useBlockTags() {
  const {
    tree, loading,
    loadTree,
    createRootTag, createChildTag,
    updateTag, deleteTag, moveTag,
  } = useTagTreeStore()

  // 首次使用时加载（store 已有数据则幂等）
  useEffect(() => {
    if (!tree.length && !loading) loadTree()
  }, [])

  const tagTree: BlockTagNode[] = tree.map(toBlockTagNode)

  const createTag = async (
    parentId: string | null,
    name: string,
    color = '#6b7280'
  ): Promise<BlockTagNode> => {
    const node = parentId
      ? await createChildTag(parentId, name, color)
      : await createRootTag(name, color)
    return toBlockTagNode(node)
  }

  const findTagWrapped = (tagId: string) => {
    function search(nodes: BlockTagNode[], parent: BlockTagNode | null): { node: BlockTagNode; parent: BlockTagNode | null } | null {
      for (const node of nodes) {
        if (node.id === tagId) return { node, parent }
        if (node.children) {
          const found = search(node.children, node)
          if (found) return found
        }
      }
      return null
    }
    return search(tagTree, null)
  }

  return {
    tagTree,
    loading,
    setTagTree: () => { /* no-op: state managed by store */ },
    createTag,
    updateTag: (tagId: string, updates: Partial<Pick<BlockTagNode, 'name' | 'color' | 'select_mode'>>) =>
      updateTag(tagId, updates),
    deleteTag,
    moveTag,
    findTag: findTagWrapped,
    reload: loadTree,
  }
}
