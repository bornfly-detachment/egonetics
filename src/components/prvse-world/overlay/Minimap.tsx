/**
 * Minimap — Global position awareness
 *
 * Shows the 5 root entities (P/V/R/S/E) as colored dots,
 * with the current camera viewport indicated.
 * Tells you "where you are" in the PRVSE system.
 */

import { useMemo } from 'react'
import type { PrvseNode, ZoomLevel } from '../types'
import { useTranslation } from '@/lib/translations'
import { getRootLabels } from '../constants'

interface MinimapProps {
  nodes: PrvseNode[]
  cameraX: number
  cameraY: number
  cameraZ: number
  zoomLevel: ZoomLevel
  focusRootId: string | null
}

const MAP_SIZE = 120
const PADDING = 16

export default function Minimap({
  nodes,
  cameraX,
  cameraY,
  cameraZ,
  zoomLevel,
  focusRootId,
}: MinimapProps) {
  const { language } = useTranslation()
  const rootLabels = getRootLabels(language as 'zh' | 'en')
  const roots = useMemo(
    () => nodes.filter(n => n.depth === 0),
    [nodes],
  )

  // Compute bounds for normalization
  const bounds = useMemo(() => {
    if (roots.length === 0) return { minX: -1, maxX: 1, minY: -1, maxY: 1 }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const r of roots) {
      minX = Math.min(minX, r.x)
      maxX = Math.max(maxX, r.x)
      minY = Math.min(minY, r.y)
      maxY = Math.max(maxY, r.y)
    }
    const pad = 80
    return { minX: minX - pad, maxX: maxX + pad, minY: minY - pad, maxY: maxY + pad }
  }, [roots])

  const toMap = (wx: number, wy: number) => ({
    x: PADDING + ((wx - bounds.minX) / (bounds.maxX - bounds.minX)) * (MAP_SIZE - PADDING * 2),
    y: PADDING + ((wy - bounds.minY) / (bounds.maxY - bounds.minY)) * (MAP_SIZE - PADDING * 2),
  })

  const cam = toMap(cameraX, cameraY)

  // Viewport indicator size based on zoom
  const vpSize = Math.max(8, (cameraZ / 1200) * (MAP_SIZE - PADDING * 2))

  return (
    <div
      className="absolute bottom-4 right-4 rounded-xl border border-white/[0.08] bg-[#0a0a0f]/80 backdrop-blur-sm overflow-hidden"
      style={{ width: MAP_SIZE, height: MAP_SIZE }}
    >
      {/* Level indicator */}
      <div className="absolute top-1.5 left-2 text-[9px] font-mono text-white/25">
        {zoomLevel}
      </div>

      {/* Root dots */}
      <svg width={MAP_SIZE} height={MAP_SIZE} className="absolute inset-0">
        {/* Viewport rectangle */}
        <rect
          x={cam.x - vpSize / 2}
          y={cam.y - vpSize / 2}
          width={vpSize}
          height={vpSize}
          fill="none"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={1}
          rx={2}
        />

        {/* Root entity dots */}
        {roots.map(root => {
          const pos = toMap(root.x, root.y)
          const isFocused = focusRootId === root.id
          const label = rootLabels[root.id] ?? '?'
          return (
            <g key={root.id}>
              <circle
                cx={pos.x}
                cy={pos.y}
                r={isFocused ? 6 : 4}
                fill={root.color}
                opacity={isFocused ? 1 : focusRootId ? 0.25 : 0.7}
              />
              <text
                x={pos.x}
                y={pos.y + 12}
                textAnchor="middle"
                fill="rgba(255,255,255,0.4)"
                fontSize={8}
                fontFamily="Inter, system-ui, sans-serif"
              >
                {label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
