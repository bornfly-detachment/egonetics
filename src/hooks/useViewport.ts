import { useState, useEffect } from 'react'

export interface Viewport {
  width: number
  height: number
  isMobile: boolean    // < 768px
  isTablet: boolean    // >= 768px && < 1024px
  isDesktop: boolean   // >= 1024px
  isLandscape: boolean
}

function measure(): Viewport {
  const w = window.innerWidth
  const h = window.visualViewport?.height ?? window.innerHeight
  return {
    width: w,
    height: h,
    isMobile: w < 768,
    isTablet: w >= 768 && w < 1024,
    isDesktop: w >= 1024,
    isLandscape: w > h,
  }
}

/**
 * Tracks viewport dimensions and updates --app-height CSS variable.
 * Uses visualViewport.height (handles iOS Safari address bar shrink correctly).
 * Responds to both resize and orientationchange via the resize event (100ms debounce).
 */
export function useViewport(): Viewport {
  const [vp, setVp] = useState<Viewport>(measure)

  useEffect(() => {
    const syncHeight = () => {
      const h = window.visualViewport?.height ?? window.innerHeight
      document.documentElement.style.setProperty('--app-height', `${h}px`)
    }

    let timer: ReturnType<typeof setTimeout>
    const handler = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        setVp(measure())
        syncHeight()
      }, 100)
    }

    // Sync immediately on mount
    syncHeight()
    setVp(measure())

    window.addEventListener('resize', handler)
    window.visualViewport?.addEventListener('resize', handler)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', handler)
      window.visualViewport?.removeEventListener('resize', handler)
    }
  }, [])

  return vp
}
