/**
 * ExcalidrawView — AI 通用视觉画布（感知器）
 *
 * 二次开发自 /Users/bornfly/Desktop/claude_code_learn/excalidraw
 * 数据持久化到 localStorage（后续迁移到 prvse_world_workspace）
 */

import { useState, useEffect, useCallback, useRef } from 'react'
// @ts-ignore — resolved by vite alias to local excalidraw dist
import { Excalidraw } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'

const SAVE_KEY = 'egonetics:excalidraw:scene'

export default function ExcalidrawView() {
  const [initialData, setInitialData] = useState<any>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        setInitialData({
          elements: parsed.elements || [],
          appState: { ...parsed.appState, collaborators: new Map() },
        })
      } else {
        setInitialData({ elements: [], appState: {} })
      }
    } catch {
      setInitialData({ elements: [], appState: {} })
    }
  }, [])

  const handleChange = useCallback((elements: any, appState: any) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify({
          elements,
          appState: {
            viewBackgroundColor: appState.viewBackgroundColor,
            gridSize: appState.gridSize,
          },
        }))
      } catch { /* quota */ }
    }, 1000)
  }, [])

  if (!initialData) return null

  return (
    <div className="h-full w-full" style={{ background: '#0a0e1a' }}>
      <Excalidraw
        initialData={initialData}
        onChange={handleChange}
        theme="dark"
      />
    </div>
  )
}
