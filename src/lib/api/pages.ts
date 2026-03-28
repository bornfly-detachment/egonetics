/**
 * api/pages.ts — Pages CRUD
 */
import { authFetch } from '@/lib/http'

export const pagesApi = {
  getPagesByTaskRef: (taskRefId: string) =>
    authFetch<any[]>(`/pages?taskRefId=${taskRefId}`),
  getPage: (id: string) => authFetch<any>(`/pages/${id}`),
  updatePage: (id: string, patch: Record<string, unknown>) =>
    authFetch<any>(`/pages/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deletePage: (id: string) =>
    authFetch<{ ok: boolean }>(`/pages/${id}`, { method: 'DELETE' }),
}
