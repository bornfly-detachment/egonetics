/**
 * VQueue — Value layer decision queue
 * Inbox-style async human-AI arbitration surface.
 * Reference: Superman_mail.png, notification_center_UI.png
 */
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { CheckCircle, XCircle, Clock, ChevronRight } from 'lucide-react'

export type VQueueItemLayer = 'L0' | 'L1' | 'L2'
export type VQueueItemType = 'v_verdict' | 'escalation' | 'conflict' | 'approval' | 'force_interrupt'
export type VQueueItemStatus = 'pending' | 'approved' | 'rejected' | 'deferred'

export interface VQueueItem {
  id: string
  layer: VQueueItemLayer
  type: VQueueItemType
  status: VQueueItemStatus
  title: string
  description: string
  source?: string
  timestamp: number
  urgency?: 'low' | 'medium' | 'high'
}

const LAYER_COLOR: Record<VQueueItemLayer, string> = {
  L0: 'bg-prvse-s/10 text-prvse-s border-prvse-s/20',
  L1: 'bg-prvse-r/10 text-prvse-r border-prvse-r/20',
  L2: 'bg-prvse-v/10 text-prvse-v border-prvse-v/20',
}

const TYPE_LABEL: Record<VQueueItemType, string> = {
  v_verdict: 'V 裁决',
  escalation: '升级',
  conflict: '冲突',
  approval: '审批',
  force_interrupt: '强制中断',
}

const URGENCY_DOT: Record<string, string> = {
  high: 'bg-destructive',
  medium: 'bg-prvse-v',
  low: 'bg-muted-foreground',
}

interface VQueueItemRowProps {
  item: VQueueItem
  active?: boolean
  onClick?: (item: VQueueItem) => void
}

function VQueueItemRow({ item, active, onClick }: VQueueItemRowProps) {
  const timeStr = new Date(item.timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <button
      onClick={() => onClick?.(item)}
      className={cn(
        'w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-accent transition-colors',
        active && 'bg-accent',
        item.status !== 'pending' && 'opacity-50'
      )}
    >
      <span className="mt-2 flex-none">
        <span className={cn('block w-2 h-2 rounded-full', URGENCY_DOT[item.urgency ?? 'low'])} />
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 h-4 border', LAYER_COLOR[item.layer])}>
            {item.layer}
          </Badge>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border text-muted-foreground">
            {TYPE_LABEL[item.type]}
          </Badge>
        </div>
        <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
        <p className="text-xs text-muted-foreground truncate mt-0.5">{item.description}</p>
        {item.source && (
          <p className="text-[10px] text-muted-foreground/60 mt-1">{item.source}</p>
        )}
      </div>

      <div className="flex-none flex flex-col items-end gap-1">
        <span className="text-[11px] text-muted-foreground whitespace-nowrap">{timeStr}</span>
        {item.status === 'pending' && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
        {item.status === 'approved' && <CheckCircle className="w-3.5 h-3.5 text-green-500" />}
        {item.status === 'rejected' && <XCircle className="w-3.5 h-3.5 text-destructive" />}
        {item.status === 'deferred' && <Clock className="w-3.5 h-3.5 text-muted-foreground" />}
      </div>
    </button>
  )
}

interface VQueueProps {
  items: VQueueItem[]
  activeId?: string
  onSelect?: (item: VQueueItem) => void
  className?: string
}

export function VQueue({ items, activeId, onSelect, className }: VQueueProps) {
  const pending = items.filter(i => i.status === 'pending')
  const done = items.filter(i => i.status !== 'pending')

  return (
    <div className={cn('bg-background border border-border rounded-lg overflow-hidden', className)}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-sm font-semibold text-foreground">裁决队列</span>
        {pending.length > 0 && (
          <Badge className="bg-prvse-v text-white text-xs h-5 px-1.5">{pending.length}</Badge>
        )}
      </div>

      <ScrollArea className="h-full">
        {pending.length > 0 && (
          <div>
            <div className="px-4 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              待处理
            </div>
            {pending.map((item, i) => (
              <div key={item.id}>
                <VQueueItemRow item={item} active={item.id === activeId} onClick={onSelect} />
                {i < pending.length - 1 && <Separator />}
              </div>
            ))}
          </div>
        )}

        {done.length > 0 && (
          <div>
            <Separator />
            <div className="px-4 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              已处理
            </div>
            {done.map((item, i) => (
              <div key={item.id}>
                <VQueueItemRow item={item} active={item.id === activeId} onClick={onSelect} />
                {i < done.length - 1 && <Separator />}
              </div>
            ))}
          </div>
        )}

        {items.length === 0 && (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            队列为空
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
