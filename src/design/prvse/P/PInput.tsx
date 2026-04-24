/**
 * PInput — Pattern layer natural language input
 * AI input bar + action chips. Ephemeral UI surface.
 * Reference: Human_input_Pattern.png
 */
import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { ArrowUp, Loader2 } from 'lucide-react'

export interface PInputAction {
  id: string
  label: string
  icon?: React.ReactNode
  description?: string
}

interface PInputProps {
  placeholder?: string
  actions?: PInputAction[]
  loading?: boolean
  onSubmit?: (value: string, actionId?: string) => void
  onActionSelect?: (action: PInputAction) => void
  className?: string
}

export function PInput({
  placeholder = '描述你的目标、资源或规则…',
  actions = [],
  loading = false,
  onSubmit,
  onActionSelect,
  className,
}: PInputProps) {
  const [value, setValue] = useState('')
  const [selectedAction, setSelectedAction] = useState<string | undefined>()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  function handleSubmit() {
    if (!value.trim() || loading) return
    onSubmit?.(value.trim(), selectedAction)
    setValue('')
    setSelectedAction(undefined)
  }

  function handleActionClick(action: PInputAction) {
    setSelectedAction(prev => prev === action.id ? undefined : action.id)
    onActionSelect?.(action)
    textareaRef.current?.focus()
  }

  return (
    <div className={cn('bg-background border border-border rounded-xl overflow-hidden shadow-sm', className)}>
      {/* Textarea */}
      <div className="px-4 pt-3 pb-1">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={3}
          className={cn(
            'w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground',
            'focus:outline-none leading-relaxed'
          )}
        />
      </div>

      {/* Action chips + submit */}
      <div className="flex items-center justify-between px-3 pb-3 gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {actions.map(action => (
            <button
              key={action.id}
              onClick={() => handleActionClick(action)}
              className={cn(
                'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                selectedAction === action.id
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-transparent text-muted-foreground border-border hover:border-foreground/40 hover:text-foreground'
              )}
            >
              {action.icon && <span className="w-3.5 h-3.5">{action.icon}</span>}
              {action.label}
            </button>
          ))}
        </div>

        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!value.trim() || loading}
          className="h-7 w-7 p-0 rounded-full flex-none bg-foreground hover:bg-foreground/90 text-background"
        >
          {loading
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <ArrowUp className="w-3.5 h-3.5" />
          }
        </Button>
      </div>

      {/* Selected action hint */}
      {selectedAction && (
        <div className="px-4 py-1.5 border-t border-border bg-accent/50">
          <p className="text-[11px] text-muted-foreground">
            模式：{actions.find(a => a.id === selectedAction)?.label}
            {actions.find(a => a.id === selectedAction)?.description && (
              <span className="ml-1">— {actions.find(a => a.id === selectedAction)?.description}</span>
            )}
          </p>
        </div>
      )}
    </div>
  )
}
