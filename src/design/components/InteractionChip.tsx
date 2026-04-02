/**
 * InteractionChip — Layer 3
 * 交互操作标记，颜色由 tokens.interaction 驱动
 * Design: Dark OLED + Real-Time Monitoring
 * Text minimum: 11px
 */
import { ChevronDown, GripVertical, MousePointer2, PenLine, PlusCircle } from 'lucide-react'
import { useTokens } from '../TokenProvider'

const ACTION_ICONS: Record<string, React.ReactNode> = {
  collapse:           <ChevronDown size={13} />,
  drag:               <GripVertical size={13} />,
  click:              <MousePointer2 size={13} />,
  dblclick:           <PenLine size={13} />,
  'shortcut-or-plus': <PlusCircle size={13} />,
}

interface InteractionChipProps {
  action: string
  showLabel?: boolean
}

export function InteractionChip({ action, showLabel = true }: InteractionChipProps) {
  const { interaction } = useTokens()
  const tok = interaction[action]
  const icon = ACTION_ICONS[action]

  if (!tok) return null

  return (
    <div className="flex items-center gap-2.5">
      {/* Icon container with signal glow */}
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{
          background: tok.color + '12',
          border: `1px solid ${tok.color}38`,
          color: tok.color,
          boxShadow: `0 0 10px ${tok.color}18`,
        }}
      >
        {icon ?? <span className="text-sm font-bold">{tok.icon}</span>}
      </div>

      {showLabel && (
        <div>
          <div className="text-[11px] font-mono font-semibold leading-tight" style={{ color: tok.color }}>
            {action}
          </div>
          <div className="text-[11px] mt-0.5 text-white/35 leading-tight">{tok.label}</div>
        </div>
      )}
    </div>
  )
}
