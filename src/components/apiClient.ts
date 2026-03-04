// ============================================================
//  apiClient.ts  —  后端 API 接入层模板
//
//  将 BASE_URL 替换为你的后端地址后即可使用。
//  所有方法已对应 types.ts 中的 ApiClient 接口。
// ============================================================
import type { ApiClient, PageMeta, Block, CreatePageInput, MovePageInput } from './types'

export const BASE_URL = 'http://localhost:3002/api' // ← 修改为你的后端地址

// 统一 fetch 封装（自动携带 token、处理错误）
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      // Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
      ...options?.headers,
    },
    ...options,
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`API ${res.status}: ${err}`)
  }
  return res.json() as Promise<T>
}

export function createApiClient(pageType?: string, refId?: string): ApiClient {
  return {
    // ── 页面 ──────────────────────────────────────────────
    listPages() {
      // GET /api/pages?type=xxx&refId=xxx
      // Response: PageMeta[]
      const params = new URLSearchParams()
      if (pageType) params.append('type', pageType)
      if (refId) params.append('refId', refId)
      const query = params.toString()
      return request<PageMeta[]>(`/pages${query ? '?' + query : ''}`)
    },

    createPage(input: CreatePageInput) {
      // POST /api/pages
      // Body: CreatePageInput (包含 pageType 和 refId)
      // Response: PageMeta
      const body = {
        ...input,
        pageType: input.pageType || pageType || 'page',
        refId: input.refId || refId || null,
      }
      return request<PageMeta>('/pages', {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },

    updatePage(id: string, patch) {
      // PATCH /api/pages/:id
      // Body: { title?: string; icon?: string }
      // Response: PageMeta
      return request<PageMeta>(`/pages/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      })
    },

    async deletePage(id: string) {
      // DELETE /api/pages/:id
      // Response: { ok: true }
      await request(`/pages/${id}`, { method: 'DELETE' })
    },

    movePage(id: string, input: MovePageInput) {
      // POST /api/pages/:id/move
      // Body: MovePageInput  { newParentId, newPosition }
      // Response: PageMeta
      return request<PageMeta>(`/pages/${id}/move`, {
        method: 'POST',
        body: JSON.stringify(input),
      })
    },

    // ── 块 ───────────────────────────────────────────────
    listBlocks(pageId: string) {
      // GET /api/pages/:pageId/blocks
      // Response: Block[]
      return request<Block[]>(`/pages/${pageId}/blocks`)
    },

    saveBlocks(pageId: string, blocks: Block[]) {
      // PUT /api/pages/:pageId/blocks
      // Body: Block[]
      // Response: Block[]  （后端可以做版本冲突检测、返回 updatedAt 等）
      return request<Block[]>(`/pages/${pageId}/blocks`, {
        method: 'PUT',
        body: JSON.stringify(blocks),
      })
    },
  }
}

// ── 后端数据库建议的表结构（供后端参考）──────────────────────────────────────
//
// Table: pages
//   id          VARCHAR(64) PRIMARY KEY
//   parent_id   VARCHAR(64) REFERENCES pages(id) ON DELETE CASCADE
//   title       TEXT NOT NULL DEFAULT ''
//   icon        VARCHAR(8)  DEFAULT '📄'
//   position    FLOAT NOT NULL DEFAULT 1.0
//   created_at  TIMESTAMP DEFAULT now()
//   updated_at  TIMESTAMP DEFAULT now()
//
// Table: blocks
//   id          VARCHAR(64) PRIMARY KEY
//   page_id     VARCHAR(64) NOT NULL REFERENCES pages(id) ON DELETE CASCADE
//   parent_id   VARCHAR(64)   -- 块的父块 id（同一 page 内嵌套）
//   type        VARCHAR(32) NOT NULL
//   content     JSONB NOT NULL DEFAULT '{}'
//   position    FLOAT NOT NULL DEFAULT 1.0
//   metadata    JSONB DEFAULT '{}'
//   collapsed   BOOLEAN DEFAULT FALSE
//   created_at  TIMESTAMP DEFAULT now()
//   updated_at  TIMESTAMP DEFAULT now()
//
// INDEX: blocks(page_id), blocks(parent_id), pages(parent_id)
//
// ── subpage 块的处理建议 ─────────────────────────────────────────────────────
//
// 当 PUT /api/pages/:pageId/blocks 时，后端遍历 blocks，对于 type === 'subpage' 的块：
//   - 如果 content.subpageId 已存在，验证对应页面存在并更新 subpageTitle/subpageIcon 快照
//   - 如果 content.subpageId 为空，则根据 fromBlockId 创建子页面并回填 subpageId
//
// 这样前端只需传 subpageId，后端维护一致性。
