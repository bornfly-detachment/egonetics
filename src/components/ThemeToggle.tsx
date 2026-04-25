import { useThemeStore, type BaseMode } from '@/stores/useThemeStore'
import { cn } from '@/lib/utils'

const MODES: { value: BaseMode; label: string; preview: string }[] = [
  {
    value: 'dark',
    label: 'Black',
    preview: 'bg-neutral-950 border-neutral-800',
  },
  {
    value: 'light',
    label: 'White',
    preview: 'bg-neutral-100 border-neutral-300',
  },
]

const LAYER_SWATCHES = [
  { label: 'L0', color: 'bg-green-600',  desc: '执行' },
  { label: 'L1', color: 'bg-violet-600', desc: '编排' },
  { label: 'L2', color: 'bg-red-600',    desc: '裁决' },
]

interface ThemeToggleProps {
  open?: boolean
}

export function ThemeToggle({ open }: ThemeToggleProps) {
  const { baseMode, setBaseMode } = useThemeStore()

  if (!open) {
    const active = MODES.find(m => m.value === baseMode)!
    return (
      <button
        onClick={() => setBaseMode(baseMode === 'dark' ? 'light' : 'dark')}
        title="切换主题"
        className="w-full flex justify-center py-2 text-neutral-600 hover:text-neutral-300 transition-colors"
      >
        <div className={cn('w-4 h-4 rounded-full border', active.preview)} />
      </button>
    )
  }

  return (
    <div className="px-3 py-2 space-y-3">
      {/* Base mode */}
      <div>
        <p className="text-[10px] font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
          Color Mode
        </p>
        <div className="flex gap-2">
          {MODES.map(m => (
            <button
              key={m.value}
              onClick={() => setBaseMode(m.value)}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 rounded-lg border py-2 transition-all',
                baseMode === m.value
                  ? 'border-neutral-400 ring-1 ring-neutral-400'
                  : 'border-neutral-800 hover:border-neutral-600'
              )}
            >
              <div className={cn('w-full h-5 rounded mx-1', m.preview)} style={{ width: '80%' }} />
              <span className="text-[10px] text-neutral-400">{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Layer colors — display only */}
      <div>
        <p className="text-[10px] font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
          Layer Colors
        </p>
        <div className="flex flex-col gap-1">
          {LAYER_SWATCHES.map(s => (
            <div key={s.label} className="flex items-center gap-2">
              <div className={cn('w-3 h-3 rounded-sm flex-none', s.color)} />
              <span className="text-[11px] text-neutral-500 font-mono">{s.label}</span>
              <span className="text-[10px] text-neutral-700">{s.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
