import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type BaseMode = 'dark' | 'light'

interface ThemeState {
  baseMode: BaseMode
  setBaseMode: (mode: BaseMode) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      baseMode: 'dark',
      setBaseMode: (baseMode) => {
        set({ baseMode })
        applyTheme(baseMode)
      },
    }),
    { name: 'egonetics-theme' }
  )
)

export function applyTheme(mode: BaseMode) {
  document.documentElement.setAttribute('data-theme', mode)
}

// Apply on store hydration
export function initTheme() {
  const stored = useThemeStore.getState().baseMode
  applyTheme(stored)
}
