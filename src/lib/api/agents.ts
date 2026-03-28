/**
 * api/agents.ts — Agents & Egonetics API
 */
import { authFetch } from '@/lib/http'

export const agentsApi = {
  getSubject: (id: string) => authFetch<any>(`/egonetics/subjects/${id}`),
  listSubjects: () => authFetch<any[]>('/egonetics/subjects'),
}
