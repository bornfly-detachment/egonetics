/**
 * ExcalidrawView — AI 通用视觉画布（感知器）
 *
 * 像 FreeCodeTerminal 一样嵌入 Egonetics。
 * 数据持久化到 prvse_world_workspace。
 * AI 可以通过 API 读写 .excalidraw JSON。
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { Excalidraw } from '@excalidraw/excalidraw'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { AppState, BinaryFiles } from '@excalidraw/excalidraw/types'
import '@excalidraw/excalidraw/index.css'

const SAVE_KEY = 'egonetics:excalidraw:scene'

export default function ExcalidrawView() {
  const [initialData, setInitialData] = useState<{
    elements: readonly ExcalidrawElement[]
    appState: Partial<AppState>
  } | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load saved scene
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

  // Auto-save on change (debounced)
  const handleChange = useCallback(
    (elements: readonly ExcalidrawElement[], appState: AppState, _files: BinaryFiles) => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        try {
          const data = {
            elements,
            appState: {
              viewBackgroundColor: appState.viewBackgroundColor,
              gridSize: appState.gridSize,
            },
          }
          localStorage.setItem(SAVE_KEY, JSON.stringify(data))
        } catch { /* quota exceeded etc */ }
      }, 1000)
    },
    [],
  )

  if (!initialData) return null

  return (
    <div className="h-full w-full" style={{ background: '#0a0e1a' }}>
      <Excalidraw
        initialData={initialData}
        onChange={handleChange}
        theme="dark"
        UIOptions={{
          canvasActions: {
            loadScene: true,
            saveToActiveFile: false,
            export: { saveFileToDisk: true },
          },
        }}
      />
    </div>
  )
}
