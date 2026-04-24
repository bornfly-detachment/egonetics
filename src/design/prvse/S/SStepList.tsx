/**
 * SStepList — State layer sequential step chain
 * Trigger + numbered steps with connector lines.
 * Reference: Trigger_step.png
 */
import { cn } from '@/lib/utils'
import { CheckCircle2, Circle, AlertCircle, Loader2 } from 'lucide-react'

export type SStepStatus = 'pending' | 'running' | 'done' | 'error' | 'skipped'

export interface SStep {
  id: string
  title: string
  description?: string
  status: SStepStatus
}

export interface STrigger {
  label: string
  description?: string
  icon?: React.ReactNode
}

const STATUS_ICON: Record<SStepStatus, React.ReactNode> = {
  pending: <Circle className="w-4 h-4 text-muted-foreground" />,
  running: <Loader2 className="w-4 h-4 text-prvse-s animate-spin" />,
  done: <CheckCircle2 className="w-4 h-4 text-prvse-p" />,
  error: <AlertCircle className="w-4 h-4 text-destructive" />,
  skipped: <Circle className="w-4 h-4 text-muted-foreground/40" />,
}

const STATUS_LINE: Record<SStepStatus, string> = {
  pending: 'border-border',
  running: 'border-prvse-s/60',
  done: 'border-prvse-p/60',
  error: 'border-destructive/60',
  skipped: 'border-border/40',
}

interface SStepListProps {
  trigger?: STrigger
  steps: SStep[]
  className?: string
}

export function SStepList({ trigger, steps, className }: SStepListProps) {
  return (
    <div className={cn('bg-background', className)}>
      {/* Trigger */}
      {trigger && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            触发条件
          </p>
          <div className="flex items-start gap-3 p-3 border border-border rounded-lg bg-accent/30">
            {trigger.icon && (
              <span className="flex-none mt-0.5 text-muted-foreground">{trigger.icon}</span>
            )}
            <div>
              <p className="text-sm font-medium text-foreground">{trigger.label}</p>
              {trigger.description && (
                <p className="text-xs text-muted-foreground mt-0.5">{trigger.description}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Steps */}
      {steps.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            步骤
          </p>
          <div className="space-y-0">
            {steps.map((step, idx) => (
              <div key={step.id} className="flex gap-3">
                {/* Number + connector */}
                <div className="flex flex-col items-center flex-none">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full border border-border bg-background z-10">
                    <span className="text-[10px] font-semibold text-muted-foreground">{idx + 1}</span>
                  </div>
                  {idx < steps.length - 1 && (
                    <div className={cn('w-px flex-1 my-1 border-l border-dashed', STATUS_LINE[step.status])} />
                  )}
                </div>

                {/* Content */}
                <div className={cn('pb-5 flex-1 min-w-0', idx === steps.length - 1 && 'pb-0')}>
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={cn(
                          'text-sm font-medium',
                          step.status === 'skipped' ? 'text-muted-foreground/50 line-through' : 'text-foreground'
                        )}>
                          {step.title}
                        </p>
                        <span className="flex-none">{STATUS_ICON[step.status]}</span>
                      </div>
                      {step.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                          {step.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
