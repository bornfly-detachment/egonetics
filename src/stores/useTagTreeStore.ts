/**
 * useTagTreeStore — TagTree AOP 全局单一数据源
 *
 * 替代 useBlockTags hook，确保标签树 CRUD 操作在所有组件中实时同步。
 * 迁移 pipeline（AI重打标）也统一管理在此 store。
 */

import { create } from 'zustand'
import { authFetch } from '../lib/http'

// ── 类型定义 ────────────────────────────────────────────────

export interface TagNode {
  id: string
  name: string
  color: string
  select_mode: 'single' | 'multi'
  children?: TagNode[]
}

export interface PrvseClassification {
  entity_id: string
  entity_type: string
  layer: string
  from_tags: string[]
  what_tags: string[]
  where_tags: string[]
  from_text: string
  what_text: string
  where_text: string
  description: string
  updated_at?: string
}

export interface TagMigration {
  id: string
  title: string
  description: string
  status: 'draft' | 'running' | 'done' | 'failed'
  affected_count: number
  applied_count: number
  created_at: string
  started_at?: string
  applied_at?: string
}

export interface ReclassifyDiff {
  id: string
  migration_id: string
  entity_id: string
  entity_type: string
  entity_desc: string
  old_layer: string
  old_from_tags: string[]
  old_what_tags: string[]
  old_where_tags: string[]
  new_layer: string
  new_from_tags: string[]
  new_what_tags: string[]
  new_where_tags: string[]
  confidence: number
  review_status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

interface TagTreeState {
  // 标签树
  tree: TagNode[]
  loading: boolean
  error: string | null

  // 迁移 pipeline
  migrations: TagMigration[]
  migrationsLoading: boolean

  // ── 标签树操作 ──────────────────────────────────────────

  /** 从服务器加载完整标签树 */
  loadTree: () => Promise<void>

  /** 在根节点下创建节点 */
  createRootTag: (name: string, color?: string, select_mode?: string) => Promise<TagNode>

  /** 在指定节点下创建子节点 */
  createChildTag: (parentId: string, name: string, color?: string, select_mode?: string) => Promise<TagNode>

  /** 更新节点属性 */
  updateTag: (id: string, patch: Partial<Pick<TagNode, 'name' | 'color' | 'select_mode'>>) => Promise<void>

  /** 删除节点（含子孙） */
  deleteTag: (id: string) => Promise<void>

  /** 移动节点 */
  moveTag: (id: string, newParentId: string | null, position?: number) => Promise<void>

  /** 在树中查找节点 */
  findTag: (id: string) => TagNode | undefined

  // ── PRVSE 三问打标 AOP ─────────────────────────────────

  /** 加载单个实体的三问标签 */
  loadClassification: (entityId: string, entityType: string) => Promise<PrvseClassification | null>

  /** 保存单个实体的三问标签 */
  saveClassification: (clf: PrvseClassification) => Promise<void>

  // ── 迁移 pipeline ──────────────────────────────────────

  /** 加载迁移列表 */
  loadMigrations: () => Promise<void>

  /** 创建迁移任务 */
  createMigration: (title: string, description: string) => Promise<TagMigration>

  /** 更新迁移任务 */
  updateMigration: (id: string, patch: { title?: string; description?: string }) => Promise<void>

  /** 删除迁移任务 */
  deleteMigration: (id: string) => Promise<void>

  /** 触发 AI 重打标，生成 Diff 列表 */
  runMigration: (id: string) => Promise<{ affected: number }>

  /** 获取迁移的 Diff 列表 */
  getMigrationDiffs: (migrationId: string) => Promise<ReclassifyDiff[]>

  /** 审核 Diff（approve | reject） */
  reviewDiff: (migrationId: string, diffId: string, action: 'approve' | 'reject') => Promise<void>

  /** 将已审核的 Diff 应用到 prvse_classifications */
  applyMigration: (migrationId: string) => Promise<{ applied: number }>
}

// ── 工具函数 ────────────────────────────────────────────────

function flattenTree(nodes: TagNode[], result: TagNode[] = []): TagNode[] {
  for (const n of nodes) {
    result.push(n)
    if (n.children) flattenTree(n.children, result)
  }
  return result
}

// ── Store ────────────────────────────────────────────────────

export const useTagTreeStore = create<TagTreeState>((set, get) => ({
  tree: [],
  loading: false,
  error: null,
  migrations: [],
  migrationsLoading: false,

  // ── 标签树操作 ──────────────────────────────────────────

  loadTree: async () => {
    set({ loading: true, error: null })
    try {
      const tree: TagNode[] = await authFetch('/tag-trees')
      set({ tree, loading: false })
    } catch (e) {
      set({ loading: false, error: (e as Error).message })
    }
  },

  createRootTag: async (name, color = '#6b7280', select_mode = 'multi') => {
    const node: TagNode = await authFetch('/tag-trees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color, select_mode }),
    })
    await get().loadTree()
    return node
  },

  createChildTag: async (parentId, name, color = '#6b7280', select_mode = 'multi') => {
    const node: TagNode = await authFetch(`/tag-trees/${parentId}/children`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color, select_mode }),
    })
    await get().loadTree()
    return node
  },

  updateTag: async (id, patch) => {
    await authFetch(`/tag-trees/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    await get().loadTree()
  },

  deleteTag: async (id) => {
    await authFetch(`/tag-trees/${id}`, { method: 'DELETE' })
    await get().loadTree()
  },

  moveTag: async (id, newParentId, position) => {
    await authFetch(`/tag-trees/${id}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newParentId, position }),
    })
    await get().loadTree()
  },

  findTag: (id) => {
    return flattenTree(get().tree).find(n => n.id === id)
  },

  // ── PRVSE 三问打标 AOP ─────────────────────────────────

  loadClassification: async (entityId, entityType) => {
    return authFetch(
      `/prvse-classifications?entity_id=${encodeURIComponent(entityId)}&entity_type=${encodeURIComponent(entityType)}`
    )
  },

  saveClassification: async (clf) => {
    await authFetch('/prvse-classifications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(clf),
    })
  },

  // ── 迁移 pipeline ──────────────────────────────────────

  loadMigrations: async () => {
    set({ migrationsLoading: true })
    try {
      const migrations: TagMigration[] = await authFetch('/tag-migrations')
      set({ migrations, migrationsLoading: false })
    } catch {
      set({ migrationsLoading: false })
    }
  },

  createMigration: async (title, description) => {
    const mig: TagMigration = await authFetch('/tag-migrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description }),
    })
    await get().loadMigrations()
    return mig
  },

  updateMigration: async (id, patch) => {
    await authFetch(`/tag-migrations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    await get().loadMigrations()
  },

  deleteMigration: async (id) => {
    await authFetch(`/tag-migrations/${id}`, { method: 'DELETE' })
    set(s => ({ migrations: s.migrations.filter(m => m.id !== id) }))
  },

  runMigration: async (id) => {
    const data = await authFetch<{ ok: boolean; affected: number }>(`/tag-migrations/${id}/run`, { method: 'POST' })
    await get().loadMigrations()
    return data
  },

  getMigrationDiffs: async (migrationId) => {
    return authFetch<ReclassifyDiff[]>(`/tag-migrations/${migrationId}/diffs`)
  },

  reviewDiff: async (migrationId, diffId, action) => {
    await authFetch(`/tag-migrations/${migrationId}/diffs/${diffId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
  },

  applyMigration: async (migrationId) => {
    const data = await authFetch<{ ok: boolean; applied: number }>(`/tag-migrations/${migrationId}/apply`, { method: 'POST' })
    await get().loadMigrations()
    return data
  },
}))
