/**
 * UIComponentVisual — allowed_components 的 protocol 行内实时预览
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
  layout:  { color: '#60a5fa', bg: '#3b82f610', border: '#3b82f630', label: 'Layout'  },
  content: { color: '#a78bfa', bg: '#8b5cf610', border: '#8b5cf630', label: 'Content' },
  action:  { color: '#34d399', bg: '#10b98110', border: '#10b98130', label: 'Action'  },
  data:    { color: '#fbbf24', bg: '#f59e0b10', border: '#f59e0b30', label: 'Data'    },
  ai:      { color: '#f472b6', bg: '#ec489910', border: '#ec489930', label: 'AI'      },
}

export function UIComponentVisual({ vis }: Props) {
  const group     = (vis.group     as string) ?? ''
  const component = (vis.component as string) ?? ''
  const demoProps = (vis.demo_props as Record<string, unknown>) ?? {}
  const description = (vis.description as string) ?? ''

  const style = GROUP_STYLE[group] ?? GROUP_STYLE.content

  // Component not in registry → "从 Web 添加" stub
  if (!isAllowedComponent(component)) {
    return (
      <div className="space-y-1.5">
        <GroupBadge style={style} component={component} />
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded border border-dashed border-white/10
          bg-white/[0.02] text-[9px] text-white/30">
          <Globe size={10} className="shrink-0 text-blue-400/50" />
          <span>组件未注册 — 可从 Web API 添加</span>
        </div>
      </div>
    )
  }

  const Component = REGISTRY[component as keyof typeof REGISTRY]

  return (
    <div className="space-y-1.5">
      <GroupBadge style={style} component={component} />
      {description && (
        <div className="text-[9px] text-white/35 leading-snug">{description}</div>
      )}
      {/* Live component preview */}
      <div
        className="rounded-lg p-2 overflow-hidden"
        style={{ background: style.bg, border: `1px solid ${style.border}` }}
      >
        <div className="text-[8px] font-mono mb-1.5" style={{ color: style.color + '80' }}>
          PREVIEW
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
        className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider shrink-0"
        style={{ color: style.color, background: style.bg, border: `1px solid ${style.border}` }}
      >
        {style.label}
      </span>
      <span className="text-[10px] font-mono font-medium text-white/65">{component}</span>
    </div>
  )
}
