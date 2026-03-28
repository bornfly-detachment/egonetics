/**
 * LayerBadge — Layer 3
 * l₀/l₁/l₂ 权限层徽章，颜色完全由 tokens 驱动
 * 支持 size: sm（行内）/ md（默认）/ lg（节点左边条）
 */
import { useTokens } from '../TokenProvider'
import { useLayerPermission } from '../primitives'

interface LayerBadgeProps {
  layerId: 'l0' | 'l1' | 'l2'
  userLevel?: number        // 当前用户权限级别，不传则只展示颜色
  size?: 'sm' | 'md' | 'lg'
  showName?: boolean
  showPerm?: boolean
  showLock?: boolean
}

export function LayerBadge({
  layerId, userLevel, size = 'md', showName = true, showPerm = true, showLock = false,
}: LayerBadgeProps) {
  const { layer } = useTokens()
  const tok = layer[layerId]
  if (!tok) return null

  const perm = useLayerPermission(userLevel ?? tok.perm)
  const isLocked = showLock && userLevel !== undefined && perm.locked(tok.perm)

  if (size === 'sm') {
    return (
      <span className="inline-flex items-center gap-1 px-1 py-px rounded text-[9px] font-mono font-bold border"
        style={{ color: tok.color, borderColor: tok.border + '60', background: tok.bg }}>
        {tok.icon} {layerId}
      </span>
    )
  }

  if (size === 'lg') {
    // 用于节点左边条
    return (
      <div className="flex flex-col items-center justify-center px-1.5 py-1 rounded-sm"
        style={{ background: tok.bg, borderRight: `1px solid ${tok.border}40` }}>
        <span className="text-sm leading-none">{tok.icon}</span>
        <span className="text-[8px] font-black font-mono mt-0.5" style={{ color: tok.color }}>
          {layerId}
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-md border"
      style={{ background: tok.bg, borderColor: tok.border + '50' }}>
      <span className="text-base leading-none">{isLocked ? '🔒' : tok.icon}</span>
      <div>
        {showName && (
          <div className="text-[11px] font-black font-mono tracking-wider" style={{ color: tok.color }}>
            {layerId}
          </div>
        )}
        <div className="text-[9px] opacity-50" style={{ color: tok.color }}>{tok.name}</div>
      </div>
      {showPerm && (
        <span className="ml-1 text-[9px] px-1.5 py-0.5 rounded font-mono font-bold border"
          style={{
            color: isLocked ? '#ffffff40' : tok.color,
            borderColor: isLocked ? '#ffffff15' : tok.border + '70',
          }}>
          {isLocked ? `🔒 P${tok.perm}` : `P${tok.perm} ✓`}
        </span>
      )}
    </div>
  )
}
