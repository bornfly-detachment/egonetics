/**
 * Arrow — Layer 3
 * SVG 箭头，完全由 tokens 驱动颜色/粗细/虚实
 * 使用 usePRVSEConstraint 决定行为（是否加 × / 是否双向）
 */
import { useTokens } from '../TokenProvider'
import { usePRVSEConstraint } from '../primitives'

interface ArrowProps {
  type: string        // constraint_type
  width?: number
  height?: number
  /** 覆盖 token 颜色（用于 ProtocolVisual 预览） */
  colorOverride?: string
}

export function Arrow({ type, width = 120, height = 32, colorOverride }: ArrowProps) {
  const { edge } = useTokens()
  const { showCrossMarker, isBidirectional } = usePRVSEConstraint(type)

  const tok = edge[type] ?? edge.directed
  const color = colorOverride ?? tok.color
  const strokeW = tok.width
  const dash = tok.dash
  const mid = height / 2
  const uid = type.replace('_', '-')  // 唯一 marker id 前缀

  return (
    <svg width={width} height={height} overflow="visible" style={{ display: 'block' }}>
      <defs>
        <marker id={`arr-${uid}-fwd`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill={color} />
        </marker>
        {isBidirectional && (
          <marker id={`arr-${uid}-bwd`} markerWidth="8" markerHeight="8" refX="2" refY="3"
            orient="auto-start-reverse">
            <path d="M0,0 L0,6 L8,3 z" fill={color} />
          </marker>
        )}
      </defs>

      {/* 反向箭头（互相制约） */}
      {isBidirectional && (
        <line x1={8} y1={mid} x2={width - 12} y2={mid}
          stroke={color} strokeWidth={strokeW} strokeDasharray={dash}
          markerStart={`url(#arr-${uid}-bwd)`} />
      )}

      {/* 主线 */}
      <line x1={8} y1={mid} x2={width - 12} y2={mid}
        stroke={color} strokeWidth={strokeW} strokeDasharray={dash}
        markerEnd={`url(#arr-${uid}-fwd)`} />

      {/* × 标记 */}
      {showCrossMarker && (
        <text x={width / 2} y={mid - 3} textAnchor="middle"
          fontSize="13" fontWeight="bold" fill={color}>
          ×
        </text>
      )}

      {/* ⊂ 标记（包含） */}
      {type === 'contains' && (
        <text x={width / 2} y={mid - 3} textAnchor="middle"
          fontSize="11" fill={color}>
          ⊂
        </text>
      )}

      {/* A / B 端点标注 */}
      <text x={2} y={mid + 10} fontSize="8" fill={color} opacity={0.5}>A</text>
      <text x={width - 9} y={mid + 10} fontSize="8" fill={color} opacity={0.5}>B</text>
    </svg>
  )
}
