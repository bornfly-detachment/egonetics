import { create } from 'zustand'
import { getToken, setToken, removeToken } from '@/lib/http'

export type UserRole = 'admin' | 'agent' | 'guest'

export interface AuthUser {
  id: number
  username: string
  email?: string
  role: UserRole
}

interface AuthState {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  isInitialized: boolean

  initialize: () => Promise<void>
  login: (identifier: string, password: string) => Promise<void>
  register: (data: RegisterData) => Promise<RegisterResult>
  verifyEmail: (email: string, code: string) => Promise<void>
  resendCode: (email: string) => Promise<void>
  logout: () => void
}

export interface RegisterData {
  role: 'guest' | 'agent'
  password: string
  email?: string
  username?: string
}

export interface RegisterResult {
  requiresVerification: boolean
  email?: string
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: false,
  isInitialized: false,

  initialize: async () => {
    const token = getToken()
    if (!token) {
      set({ isInitialized: true })
      return
    }
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const user: AuthUser = await res.json()
        set({ user, token, isInitialized: true })
      } else {
        removeToken()
        set({ user: null, token: null, isInitialized: true })
      }
    } catch {
      removeToken()
      set({ user: null, token: null, isInitialized: true })
    }
  },

  login: async (identifier, password) => {
    set({ isLoading: true })
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      })
      const data = await res.json()
      if (!res.ok) throw Object.assign(new Error(data.error || '登录失败'), data)
      setToken(data.token)
      set({ user: data.user, token: data.token, isLoading: false })
    } catch (err) {
      set({ isLoading: false })
      throw err
    }
  },

  register: async (data) => {
    set({ isLoading: true })
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || '注册失败')

      if (!result.requiresVerification) {
        // Agent: auto-login
        setToken(result.token)
        set({ user: result.user, token: result.token, isLoading: false })
      } else {
        set({ isLoading: false })
      }
      return result as RegisterResult
    } catch (err) {
      set({ isLoading: false })
      throw err
    }
  },

  verifyEmail: async (email, code) => {
    set({ isLoading: true })
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '验证失败')
      setToken(data.token)
      set({ user: data.user, token: data.token, isLoading: false })
    } catch (err) {
      set({ isLoading: false })
      throw err
    }
  },

  resendCode: async (email) => {
    const res = await fetch('/api/auth/resend-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '发送失败')
  },

  logout: () => {
    removeToken()
    set({ user: null, token: null })
  },
}))
