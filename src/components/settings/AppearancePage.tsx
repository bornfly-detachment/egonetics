import { useThemeStore, type BaseMode, type FontSize, type FontStyle } from '@/stores/useThemeStore'
import { useTranslation } from '@/lib/translations'
import { cn } from '@/lib/utils'

// ── Color mode previews ──

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
    <div className="w-full h-full flex flex-col" style={{ background: '#1e1e1e' }}>
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

// ── Font size preview — macOS window style (font.png) ──

function FontSizePreview({ size }: { size: FontSize }) {
  const cfg = {
    lg: { lines: 2, h: 'h-2.5',   gap: 'gap-2'   },
    md: { lines: 3, h: 'h-[7px]', gap: 'gap-1.5' },
    sm: { lines: 5, h: 'h-[5px]', gap: 'gap-1'   },
  }[size]
  const widths = ['90%', '75%', '85%', '65%', '80%']
  return (
    <div className="w-full h-full flex flex-col" style={{ background: '#1e1e1e' }}>
      <div className="flex gap-1 px-2 pt-2">
        <div className="w-2 h-2 rounded-full" style={{ background: '#FF5F57' }} />
        <div className="w-2 h-2 rounded-full" style={{ background: '#FEBC2E' }} />
        <div className="w-2 h-2 rounded-full" style={{ background: '#28C840' }} />
      </div>
      <div className={`flex-1 px-2 pt-1.5 pb-2 flex flex-col ${cfg.gap} overflow-hidden`}>
        {[...Array(cfg.lines)].map((_, i) => (
          <div key={i} className={`${cfg.h} rounded-sm`}
               style={{ background: 'rgba(255,255,255,0.15)', width: widths[i] }} />
        ))}
      </div>
    </div>
  )
}

// ── Constants ──

const COLOR_MODES: { value: BaseMode; label: string; Preview: React.FC }[] = [
  { value: 'light', label: 'Light', Preview: LightPreview },
  { value: 'dark',  label: 'Dark',  Preview: DarkPreview  },
]

const FONT_SIZES: { value: FontSize; label: string }[] = [
  { value: 'lg', label: '更大' },
  { value: 'md', label: '默认' },
  { value: 'sm', label: '紧凑' },
]

const FONT_STYLES: { value: FontStyle; label: string; family: string }[] = [
  { value: 'default', label: 'Default', family: "'Inter', sans-serif"               },
  { value: 'sans',    label: 'Sans',    family: 'ui-sans-serif, system-ui'          },
  { value: 'system',  label: 'System',  family: '-apple-system, BlinkMacSystemFont' },
]

const LAYERS = [
  { id: 'L0', label: 'L0', desc: '执行层', segments: ['#C8F5EC', '#2BC9A0', '#007A62'], name: 'Green'  },
  { id: 'L1', label: 'L1', desc: '编排层', segments: ['#F0EAF8', '#8B62B8', '#6B3FA0'], name: 'Purple' },
  { id: 'L2', label: 'L2', desc: '裁决层', segments: ['#fdecea', '#d4614e', '#C0341D'], name: 'Red'    },
]

// ── Generic card selector ──

function SelectCard<T extends string>({
  value, current, onClick, label, wide, children,
}: {
  value: T; current: T; onClick: (v: T) => void
  label: string; wide?: boolean; children: React.ReactNode
}) {
  const active = value === current
  return (
    <button onClick={() => onClick(value)} className="flex flex-col items-center gap-2 focus:outline-none group">
      <div className={cn(
        'overflow-hidden border-2 transition-all duration-200',
        wide ? 'w-36 h-28 rounded-2xl' : 'w-24 h-20 rounded-xl',
        active
          ? 'border-blue-500'
          : 'border-transparent opacity-60 group-hover:opacity-90'
      )}>
        {children}
      </div>
      <span className={cn('text-xs transition-colors', active ? 'text-foreground' : 'text-muted-foreground')}>
        {label}
      </span>
    </button>
  )
}

// ── Section wrapper ──

function Section({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-sm font-medium text-muted-foreground">{label}</h2>
        {sub && <p className="text-xs text-muted-foreground/60 mt-0.5">{sub}</p>}
      </div>
      {children}
    </section>
  )
}

// ── Page ──

export default function AppearancePage() {
  const { baseMode, setBaseMode, fontSize, setFontSize, fontStyle, setFontStyle } = useThemeStore()
  const { language, setLanguage } = useTranslation()

  return (
    <div className="max-w-2xl mx-auto py-10 px-8 space-y-10">
      <h1 className="text-2xl font-semibold text-foreground">Appearance</h1>

      {/* Color mode */}
      <Section label="Color mode">
        <div className="flex gap-3">
          {COLOR_MODES.map(({ value, label, Preview }) => (
            <SelectCard key={value} value={value} current={baseMode} onClick={setBaseMode} label={label} wide>
              <Preview />
            </SelectCard>
          ))}
        </div>
      </Section>

      {/* Font size */}
      <Section label="Font size">
        <div className="flex gap-3">
          {FONT_SIZES.map(({ value, label }) => (
            <SelectCard key={value} value={value} current={fontSize} onClick={setFontSize} label={label}>
              <FontSizePreview size={value} />
            </SelectCard>
          ))}
        </div>
      </Section>

      {/* Font style */}
      <Section label="Font style">
        <div className="flex gap-3">
          {FONT_STYLES.map(({ value, label, family }) => (
            <SelectCard key={value} value={value} current={fontStyle} onClick={setFontStyle} label={label}>
              <div className="w-full h-full flex items-center justify-center" style={{ background: '#1e1e1e' }}>
                <span className="text-2xl font-semibold" style={{ fontFamily: family, color: 'rgba(255,255,255,0.85)' }}>
                  Aa
                </span>
              </div>
            </SelectCard>
          ))}
        </div>
      </Section>

      {/* Language */}
      <Section label="Language">
        <div className="flex gap-2">
          {(['en', 'zh'] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => setLanguage(lang)}
              className={cn(
                'px-5 py-2 rounded-xl text-sm font-medium border-2 transition-all duration-200',
                language === lang
                  ? 'border-blue-500 text-foreground bg-foreground/5'
                  : 'border-transparent bg-foreground/5 text-muted-foreground hover:text-foreground hover:bg-foreground/10'
              )}
            >
              {lang === 'en' ? 'English' : '中文'}
            </button>
          ))}
        </div>
      </Section>

      {/* Layer colors */}
      <Section label="Layer colors" sub="Color weight represents layer authority — fixed mapping">
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
      </Section>
    </div>
  )
}
