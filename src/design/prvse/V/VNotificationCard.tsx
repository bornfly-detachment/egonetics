/**
 * VNotificationCard — Value verdict notification
 * Stacked list card with icon, title, description, timestamp.
 * Reference: notification_center_UI.png
 */
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

export type VNotificationVariant = 'info' | 'warn' | 'error' | 'success'

export interface VNotificationCardProps {
  id: string
  title: string
  description: string
  timestamp: number
  variant?: VNotificationVariant
  icon?: React.ReactNode
  layer?: 'L0' | 'L1' | 'L2'
  read?: boolean
  onClick?: () => void
}

const VARIANT_STYLES: Record<VNotificationVariant, { dot: string; border: string }> = {
  info:    { dot: 'bg-prvse-s',    border: '' },
  warn:    { dot: 'bg-prvse-v',    border: 'border-l-2 border-l-prvse-v/50' },
  error:   { dot: 'bg-destructive', border: 'border-l-2 border-l-destructive/50' },
  success: { dot: 'bg-prvse-p',    border: 'border-l-2 border-l-prvse-p/50' },
}

function formatTime(ts: number) {
  const d = new Date(ts)
  const now = Date.now()
  const diff = now - ts
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

export function VNotificationCard({
  title,
  description,
  timestamp,
  variant = 'info',
  icon,
  layer,
  read = false,
  onClick,
}: VNotificationCardProps) {
  const { dot, border } = VARIANT_STYLES[variant]

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left flex items-start gap-3 px-4 py-3.5',
        'bg-background hover:bg-accent/60 transition-colors rounded-lg',
        'border border-border',
        border,
        read && 'opacity-60'
      )}
    >
      {/* Icon or dot */}
      <div className="flex-none mt-0.5">
        {icon
          ? <span className="block w-8 h-8 rounded-full bg-accent flex items-center justify-center text-muted-foreground">{icon}</span>
          : <span className={cn('block w-2 h-2 rounded-full mt-1.5', dot)} />
        }
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-semibold text-foreground truncate">{title}</p>
          {layer && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 flex-none">{layer}</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{description}</p>
      </div>

      {/* Time */}
      <span className="flex-none text-[11px] text-muted-foreground whitespace-nowrap mt-0.5">
        {formatTime(timestamp)}
      </span>
    </button>
  )
}
