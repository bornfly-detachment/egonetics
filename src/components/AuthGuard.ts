import type { UserRole } from '@/stores/useAuthStore'

// Routes visible per role (matched against first path segment)
const GUEST_VISIBLE = new Set(['home', 'egonetics', 'tasks', 'blog'])
const AGENT_VISIBLE = new Set(['home', 'egonetics', 'tasks', 'blog', 'agents'])

export function isPathAllowed(pathname: string, role: UserRole): boolean {
  if (role === 'admin') return true
  const segment = pathname.split('/')[1] || 'home'
  if (role === 'agent') return AGENT_VISIBLE.has(segment)
  return GUEST_VISIBLE.has(segment)
}

export function getVisibleNavItems(role: UserRole): string[] {
  if (role === 'admin') {
    return ['home', 'memory', 'theory', 'chronicle', 'egonetics', 'tasks', 'blog', 'agents', 'cybernetics', 'tag-tree', 'queue', 'controller', 'protocol', 'protocol-builder', 'prvse-world', 'free-code', 'lab', 'mq', 'recycle']
  }
  if (role === 'agent') return ['home', 'egonetics', 'tasks', 'blog', 'agents']
  return ['home', 'egonetics', 'tasks', 'blog']
}
