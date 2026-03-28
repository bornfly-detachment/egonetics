/**
 * InteractionChip — Layer 3
 * 交互操作标记，颜色由 tokens.interaction 驱动
 * 图标用 Lucide（避免偏僻 Unicode 乱码问题）
 */
import { ChevronDown, GripVertical, MousePointer2, PenLine, PlusCircle } from 'lucide-react'
import { useTokens } from '../TokenProvider'

// Lucide 图标映射，完全规避偏僻 Unicode
const ACTION_ICONS: Record<string, React.ReactNode> = {
  collapse:           <ChevronDown size={16} />,
  drag:               <GripVertical size={16} />,
  click:              <MousePointer2 size={16} />,
  dblclick:           <PenLine size={16} />,
  'shortcut-or-plus': <PlusCircle size={16} />,
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
    <div className="flex items-center gap-2">
      <div className="w-9 h-9 rounded-lg border flex items-center justify-center shrink-0"
        style={{ background: tok.color + '18', borderColor: tok.color + '50', color: tok.color }}>
        {icon ?? <span className="text-base font-bold">{tok.icon}</span>}
      </div>
      {showLabel && (
        <div>
          <div className="text-[10px] font-bold" style={{ color: tok.color }}>{action}</div>
          <div className="text-[9px] mt-0.5" style={{ color: '#ffffff40' }}>{tok.label}</div>
        </div>
      )}
    </div>
  )
}
