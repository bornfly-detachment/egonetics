import { useThemeStore, type BaseMode } from '@/stores/useThemeStore'
import { cn } from '@/lib/utils'

// ── Mini UI preview for color mode cards (like claude_theme.png) ──

function DarkPreview() {
  return (
    <div className="w-full h-full rounded-md overflow-hidden flex" style={{ background: '#090c12' }}>
      <div className="w-5 h-full flex flex-col gap-1 p-1" style={{ background: '#111111' }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-1.5 rounded-sm" style={{ background: 'rgba(255,255,255,0.12)', width: i === 0 ? '100%' : '80%' }} />
        ))}
      </div>
      <div className="flex-1 p-1.5 flex flex-col gap-1">
        <div className="h-2 rounded" style={{ background: 'rgba(255,255,255,0.25)', width: '60%' }} />
        <div className="h-1 rounded" style={{ background: 'rgba(255,255,255,0.08)', width: '80%' }} />
        <div className="h-1 rounded" style={{ background: 'rgba(255,255,255,0.08)', width: '65%' }} />
        <div className="mt-1 h-5 rounded-md" style={{ background: 'rgba(255,255,255,0.05)' }} />
      </div>
    </div>
  )
}

function LightPreview() {
  return (
    <div className="w-full h-full rounded-md overflow-hidden flex" style={{ background: '#f8fafc' }}>
      <div className="w-5 h-full flex flex-col gap-1 p-1" style={{ background: '#e2e8f0' }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-1.5 rounded-sm" style={{ background: 'rgba(0,0,0,0.15)', width: i === 0 ? '100%' : '80%' }} />
        ))}
      </div>
      <div className="flex-1 p-1.5 flex flex-col gap-1">
        <div className="h-2 rounded" style={{ background: 'rgba(0,0,0,0.35)', width: '60%' }} />
        <div className="h-1 rounded" style={{ background: 'rgba(0,0,0,0.12)', width: '80%' }} />
        <div className="h-1 rounded" style={{ background: 'rgba(0,0,0,0.12)', width: '65%' }} />
        <div className="mt-1 h-5 rounded-md" style={{ background: 'rgba(0,0,0,0.06)' }} />
      </div>
    </div>
  )
}

// ── Color Mode cards ──

const MODES: { value: BaseMode; label: string; Preview: React.FC }[] = [
  { value: 'dark',  label: 'Black', Preview: DarkPreview  },
  { value: 'light', label: 'White', Preview: LightPreview },
]

// ── Layer color rows (theme_color.png style) ──

const LAYERS = [
  {
    id: 'L0', label: 'L0', desc: '执行层',
    segments: ['#EBF5F0', '#6AAF84', '#2E8B57'],
    name: 'Green',
  },
  {
    id: 'L1', label: 'L1', desc: '编排层',
    segments: ['#F0EAF8', '#7B52A8', '#4E2579'],
    name: 'Purple',
  },
  {
    id: 'L2', label: 'L2', desc: '裁决层',
    segments: ['#fdecea', '#d4614e', '#C0341D'],
    name: 'Red',
  },
]

export default function AppearancePage() {
  const { baseMode, setBaseMode } = useThemeStore()

  return (
    <div className="max-w-xl mx-auto py-8 px-6 space-y-10">
      <div>
        <h1 className="text-lg font-semibold text-foreground">外观设置</h1>
        <p className="text-sm text-muted-foreground mt-1">个性化界面主题与层级配色</p>
      </div>

      {/* Color Mode */}
      <section>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Color Mode
        </h2>
        <div className="flex gap-4">
          {MODES.map(({ value, label, Preview }) => (
            <button
              key={value}
              onClick={() => setBaseMode(value)}
              className={cn(
                'flex flex-col items-center gap-2 focus:outline-none group'
              )}
            >
              <div className={cn(
                'w-32 h-20 rounded-xl border-2 p-1 transition-all duration-200',
                baseMode === value
                  ? 'border-blue-500 ring-2 ring-blue-500/30'
                  : 'border-border hover:border-muted-foreground/50'
              )}>
                <Preview />
              </div>
              <div className="flex items-center gap-1.5">
                <div className={cn(
                  'w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-all',
                  baseMode === value ? 'border-blue-500' : 'border-muted-foreground/40'
                )}>
                  {baseMode === value && (
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  )}
                </div>
                <span className={cn(
                  'text-sm font-medium',
                  baseMode === value ? 'text-foreground' : 'text-muted-foreground'
                )}>
                  {label}
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Layer Colors */}
      <section>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
          Layer Colors
        </h2>
        <p className="text-xs text-muted-foreground mb-4">
          颜色重量代表层级权重，固定映射，不可更改
        </p>
        <div className="flex flex-col gap-3">
          {LAYERS.map(layer => (
            <div key={layer.id} className="flex items-center gap-4 p-3 rounded-xl border border-border bg-card">
              <div className="flex-none w-8 text-center">
                <span className="text-xs font-bold text-foreground font-mono">{layer.label}</span>
              </div>
              {/* 3-segment gradient strip */}
              <div className="flex-1 flex rounded-lg overflow-hidden h-8">
                {layer.segments.map((color, i) => (
                  <div
                    key={i}
                    className="flex-1 h-full"
                    style={{ background: color }}
                  />
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
