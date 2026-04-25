import { useThemeStore, type BaseMode } from '@/stores/useThemeStore'
import { cn } from '@/lib/utils'

// ── Mini UI previews (match claude_theme.png card style) ──

function LightPreview() {
  return (
    <div className="w-full h-full flex flex-col" style={{ background: '#f5f5f4' }}>
      <div className="flex justify-center pt-3">
        <div className="rounded-full px-2.5 py-1 flex gap-1 items-center" style={{ background: '#e5e5e3' }}>
          <div className="w-7 h-[3px] rounded-full" style={{ background: 'rgba(0,0,0,0.28)' }} />
          <div className="w-4 h-[3px] rounded-full" style={{ background: 'rgba(0,0,0,0.14)' }} />
        </div>
      </div>
      <div className="flex-1 px-3 pt-3 flex flex-col gap-2">
        <div className="h-[3px] rounded-full" style={{ background: 'rgba(0,0,0,0.2)', width: '58%' }} />
        <div className="h-[3px] rounded-full" style={{ background: 'rgba(0,0,0,0.1)', width: '78%' }} />
      </div>
      <div className="px-2.5 pb-2.5">
        <div className="h-7 rounded-lg flex items-center justify-end pr-2" style={{ background: 'rgba(0,0,0,0.07)' }}>
          <div className="w-2 h-2 rounded-full" style={{ background: '#C0341D' }} />
        </div>
      </div>
    </div>
  )
}

function DarkPreview() {
  return (
    <div className="w-full h-full flex flex-col" style={{ background: '#1c1c1e' }}>
      <div className="flex justify-center pt-3">
        <div className="rounded-full px-2.5 py-1 flex gap-1 items-center" style={{ background: '#2c2c2e' }}>
          <div className="w-7 h-[3px] rounded-full" style={{ background: 'rgba(255,255,255,0.4)' }} />
          <div className="w-4 h-[3px] rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }} />
        </div>
      </div>
      <div className="flex-1 px-3 pt-3 flex flex-col gap-2">
        <div className="h-[3px] rounded-full" style={{ background: 'rgba(255,255,255,0.2)', width: '58%' }} />
        <div className="h-[3px] rounded-full" style={{ background: 'rgba(255,255,255,0.1)', width: '78%' }} />
      </div>
      <div className="px-2.5 pb-2.5">
        <div className="h-7 rounded-lg flex items-center justify-end pr-2" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div className="w-2 h-2 rounded-full" style={{ background: '#C0341D' }} />
        </div>
      </div>
    </div>
  )
}

const MODES: { value: BaseMode; label: string; Preview: React.FC }[] = [
  { value: 'light', label: 'Light', Preview: LightPreview },
  { value: 'dark',  label: 'Dark',  Preview: DarkPreview  },
]

const LAYERS = [
  { id: 'L0', label: 'L0', desc: '执行层', segments: ['#C8F5EC', '#2BC9A0', '#007A62'], name: 'Green'  },
  { id: 'L1', label: 'L1', desc: '编排层', segments: ['#F0EAF8', '#8B62B8', '#6B3FA0'], name: 'Purple' },
  { id: 'L2', label: 'L2', desc: '裁决层', segments: ['#fdecea', '#d4614e', '#C0341D'], name: 'Red'    },
]

export default function AppearancePage() {
  const { baseMode, setBaseMode } = useThemeStore()

  return (
    <div className="max-w-2xl mx-auto py-10 px-8 space-y-10">
      <h1 className="text-2xl font-semibold text-foreground">Appearance</h1>

      {/* Color Mode */}
      <section className="space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground">Color mode</h2>
        <div className="flex gap-3">
          {MODES.map(({ value, label, Preview }) => (
            <button
              key={value}
              onClick={() => setBaseMode(value)}
              className="flex flex-col items-center gap-2.5 focus:outline-none group"
            >
              <div className={cn(
                'w-36 h-28 rounded-2xl overflow-hidden border-2 transition-all duration-200',
                baseMode === value
                  ? 'border-blue-500'
                  : 'border-transparent opacity-70 group-hover:opacity-100'
              )}>
                <Preview />
              </div>
              <span className={cn(
                'text-sm transition-colors',
                baseMode === value ? 'text-foreground' : 'text-muted-foreground'
              )}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Layer Colors */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-medium text-muted-foreground">Layer colors</h2>
          <p className="text-xs text-muted-foreground/60 mt-0.5">Color weight represents layer authority — fixed mapping</p>
        </div>
        <div className="flex flex-col gap-2.5">
          {LAYERS.map(layer => (
            <div key={layer.id} className="flex items-center gap-4 p-3 rounded-xl border border-border bg-card">
              <span className="flex-none w-7 text-xs font-bold text-foreground font-mono text-center">{layer.label}</span>
              <div className="flex-1 flex rounded-lg overflow-hidden h-7">
                {layer.segments.map((color, i) => (
                  <div key={i} className="flex-1 h-full" style={{ background: color }} />
                ))}
              </div>
              <div className="flex-none text-right">
                <p className="text-xs font-medium text-foreground">{layer.name}</p>
                <p className="text-[10px] text-muted-foreground">{layer.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
