import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type BaseMode  = 'dark' | 'light'
export type FontSize  = 'sm' | 'md' | 'lg'
export type FontStyle = 'default' | 'sans' | 'system'

interface ThemeState {
  baseMode:  BaseMode
  fontSize:  FontSize
  fontStyle: FontStyle
  setBaseMode:  (m: BaseMode)  => void
  setFontSize:  (s: FontSize)  => void
  setFontStyle: (s: FontStyle) => void
}

function applyAll(mode: BaseMode, size: FontSize, style: FontStyle) {
  const el = document.documentElement
  el.setAttribute('data-theme',     mode)
  el.setAttribute('data-font-size', size)
  el.setAttribute('data-font',      style)
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      baseMode:  'dark',
      fontSize:  'md',
      fontStyle: 'default',
      setBaseMode:  (baseMode)  => { set({ baseMode });  applyAll(baseMode,       get().fontSize,  get().fontStyle) },
      setFontSize:  (fontSize)  => { set({ fontSize });  applyAll(get().baseMode, fontSize,        get().fontStyle) },
      setFontStyle: (fontStyle) => { set({ fontStyle }); applyAll(get().baseMode, get().fontSize,  fontStyle)       },
    }),
    { name: 'egonetics-theme' }
  )
)

export function initTheme() {
  const { baseMode, fontSize, fontStyle } = useThemeStore.getState()
  applyAll(baseMode, fontSize, fontStyle)
}
