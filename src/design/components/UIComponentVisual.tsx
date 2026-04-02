/**
 * UIComponentVisual — allowed_components 的 protocol 行内实时预览
 * Design: Dark OLED + Real-Time Monitoring
 * Text minimum: 11px
 *
 * vis.group    = layout | content | action | data | ai
 * vis.component = 组件名 (REGISTRY key)
 * vis.demo_props = 传给组件的演示 props
 * vis.description = 一句话说明
 */
import { Globe } from 'lucide-react'
import { REGISTRY, isAllowedComponent } from '../allowed-components/registry'

interface Props {
  vis: Record<string, unknown>
}

const GROUP_STYLE: Record<string, { color: string; bg: string; border: string; label: string }> = {
  layout:  { color: '#60a5fa', bg: '#3b82f60d', border: '#3b82f625', label: 'Layout'  },
  content: { color: '#a78bfa', bg: '#8b5cf60d', border: '#8b5cf625', label: 'Content' },
  action:  { color: '#34d399', bg: '#10b9810d', border: '#10b98125', label: 'Action'  },
  data:    { color: '#fbbf24', bg: '#f59e0b0d', border: '#f59e0b25', label: 'Data'    },
  ai:      { color: '#f472b6', bg: '#ec48990d', border: '#ec489925', label: 'AI'      },
}

export function UIComponentVisual({ vis }: Props) {
  const group       = (vis.group       as string) ?? ''
  const component   = (vis.component   as string) ?? ''
  const demoProps   = (vis.demo_props  as Record<string, unknown>) ?? {}
  const description = (vis.description as string) ?? ''

  const style = GROUP_STYLE[group] ?? GROUP_STYLE.content

  if (!isAllowedComponent(component)) {
    return (
      <div className="space-y-2">
        <GroupBadge style={style} component={component} />
        <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-dashed
          text-[11px] text-white/30"
          style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)' }}>
          <Globe size={11} className="shrink-0 text-blue-400/50" />
          <span>组件未注册 — 可从 Web API 添加</span>
        </div>
      </div>
    )
  }

  const Component = REGISTRY[component as keyof typeof REGISTRY]

  return (
    <div className="space-y-2">
      <GroupBadge style={style} component={component} />
      {description && (
        <div className="text-[11px] text-white/40 leading-snug">{description}</div>
      )}
      {/* Live preview */}
      <div
        className="rounded-lg px-3 py-2.5 overflow-hidden"
        style={{ background: style.bg, border: `1px solid ${style.border}` }}
      >
        <div
          className="text-[10px] font-mono uppercase tracking-widest mb-2"
          style={{ color: style.color + '80' }}
        >
          preview
        </div>
        <div className="pointer-events-none select-none">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <Component {...(demoProps as any)} />
        </div>
      </div>
    </div>
  )
}

function GroupBadge({
  style, component,
}: {
  style: { color: string; bg: string; border: string; label: string }
  component: string
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0"
        style={{ color: style.color, background: style.bg, border: `1px solid ${style.border}` }}
      >
        {style.label}
      </span>
      <span className="text-[11px] font-mono font-medium text-white/60">{component}</span>
    </div>
  )
}
