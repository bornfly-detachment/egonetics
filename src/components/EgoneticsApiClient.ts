// EgoneticsApiClient.ts
// 实现 ApiClient 接口，对接 /api/egonetics/pages 后端
// saveBlocks / createPage / updatePage / deletePage / movePage 在只读模式下为 no-op

import type { ApiClient, PageMeta, Block, CreatePageInput, MovePageInput } from './types'

const BASE = '/api'

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json() as Promise<T>
}

export function createEgoneticsApiClient(subjectId: string, readOnly = true): ApiClient {
  return {
    listPages() {
      return req<PageMeta[]>(`/egonetics/subjects/${subjectId}/pages`)
    },

    createPage(input: CreatePageInput) {
      if (readOnly) return Promise.reject(new Error('read-only'))
      return req<PageMeta>(`/egonetics/subjects/${subjectId}/pages`, {
        method: 'POST',
        body: JSON.stringify(input),
      })
    },

    updatePage(id: string, patch: Partial<Pick<PageMeta, 'title' | 'icon'>>) {
      if (readOnly) return Promise.reject(new Error('read-only'))
      return req<PageMeta>(`/egonetics/pages/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      })
    },

    async deletePage(id: string) {
      if (readOnly) return
      await req(`/egonetics/pages/${id}`, { method: 'DELETE' })
    },

    movePage(id: string, input: MovePageInput) {
      if (readOnly) return Promise.reject(new Error('read-only'))
      return req<PageMeta>(`/egonetics/pages/${id}/move`, {
        method: 'POST',
        body: JSON.stringify(input),
      })
    },

    listBlocks(pageId: string) {
      return req<Block[]>(`/egonetics/pages/${pageId}/blocks`)
    },

    saveBlocks(pageId: string, blocks: Block[]) {
      if (readOnly) return Promise.resolve(blocks)
      return req<Block[]>(`/egonetics/pages/${pageId}/blocks`, {
        method: 'PUT',
        body: JSON.stringify(blocks),
      })
    },
  }
}
