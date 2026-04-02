export const TOKEN_KEY = 'egonetics_auth_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export async function authFetch<T>(path: string, options?: RequestInit): Promise<T> {
  // 开发者模式：不发 Token，后端直接注入 admin
  const devMode = import.meta.env.VITE_DEV_MODE === 'true'
  const token = devMode ? null : getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const response = await fetch(`/api${path}`, { ...options, headers })

  if (response.status === 401) {
    removeToken()
    window.location.href = '/login'
    throw new Error('未授权，请重新登录')
  }

  if (!response.ok) {
    const error = await response.text()
    throw new Error(error || `HTTP ${response.status}`)
  }

  return response.json()
}
