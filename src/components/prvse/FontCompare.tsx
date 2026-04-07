/**
 * FontCompare — 字体对比选择页面
 * 展示多组字体在深色背景 + 不同字号下的实际效果
 */
import { useState } from 'react'

const SAMPLE_ZH = '控制论系统 · 信息原语 · 生变论 · 宪法编译器'
const SAMPLE_EN = 'PRVSE Pattern L0/L1/L2 — const-001 A2 T1'
const SAMPLE_CODE = 'export function narrowingCount(p: PatternData): number { return 3 }'
const SAMPLE_DATA = 'accuracy: 0.87  timer: 230ms  counter: 147  roi: 3.2'

interface FontOption {
  id: string
  label: string
  family: string
  import?: string  // Google Fonts URL
  weights: number[]
  description: string
}

const FONTS: FontOption[] = [
  {
    id: 'system-mono',
    label: '系统等宽 (GitHub)',
    family: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    weights: [400, 500, 600],
    description: 'GitHub/VSCode 默认，macOS=SF Mono, Windows=Consolas',
  },
  {
    id: 'jetbrains',
    label: 'JetBrains Mono（当前）',
    family: '"JetBrains Mono", monospace',
    weights: [400, 500, 600],
    description: '编程字体，偏细，连字支持好',
  },
  {
    id: 'fira-code',
    label: 'Fira Code',
    family: '"Fira Code", monospace',
    import: 'https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600&display=swap',
    weights: [400, 500, 600],
    description: '编程字体，笔画适中，连字丰富',
  },
  {
    id: 'source-code',
    label: 'Source Code Pro',
    family: '"Source Code Pro", monospace',
    import: 'https://fonts.googleapis.com/css2?family=Source+Code+Pro:wght@400;500;600&display=swap',
    weights: [400, 500, 600],
    description: 'Adobe 出品，笔画清晰，可读性高',
  },
  {
    id: 'ibm-plex',
    label: 'IBM Plex Mono',
    family: '"IBM Plex Mono", monospace',
    import: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap',
    weights: [400, 500, 600],
    description: 'IBM 设计系统字体，偏粗，工业感',
  },
  {
    id: 'roboto-mono',
    label: 'Roboto Mono',
    family: '"Roboto Mono", monospace',
    import: 'https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;500;600&display=swap',
    weights: [400, 500, 600],
    description: 'Google Material 等宽字体，圆润',
  },
  {
    id: 'inter',
    label: 'Inter（非等宽）',
    family: '"Inter", system-ui, sans-serif',
    weights: [400, 500, 600],
    description: '当前正文字体，不等宽但清晰度最高',
  },
  {
    id: 'geist-mono',
    label: 'Geist Mono (Vercel)',
    family: '"Geist Mono", monospace',
    import: 'https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;600&display=swap',
    weights: [400, 500, 600],
    description: 'Vercel/Next.js 默认等宽字体，现代感',
  },
]

function FontCard({ font, selectedWeight }: { font: FontOption; selectedWeight: number }) {
  return (
    <div
      className="rounded-xl border border-white/[0.08] overflow-hidden transition-all hover:border-white/[0.15]"
      style={{ background: 'rgba(255,255,255,0.02)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div>
          <span className="text-sm font-semibold text-white/80">{font.label}</span>
          <span className="text-xs text-white/40 ml-2">{font.id}</span>
        </div>
        <span className="text-xs text-white/35">{font.description}</span>
      </div>

      {/* Samples */}
      <div className="px-4 py-3 space-y-3" style={{ fontFamily: font.family, fontWeight: selectedWeight }}>
        {/* 14px 正文 */}
        <div>
          <div className="text-xs text-white/35 mb-1" style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400 }}>14px 正文</div>
          <div className="text-sm text-white/75 leading-relaxed">{SAMPLE_ZH}</div>
          <div className="text-sm text-white/75 leading-relaxed">{SAMPLE_EN}</div>
        </div>

        {/* 12px 标签 */}
        <div>
          <div className="text-xs text-white/35 mb-1" style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400 }}>12px 标签/数据</div>
          <div className="text-xs text-white/65 leading-relaxed">{SAMPLE_DATA}</div>
          <div className="text-xs text-white/65 leading-relaxed">{SAMPLE_CODE}</div>
        </div>

        {/* 混合：模拟 PRV Header */}
        <div>
          <div className="text-xs text-white/35 mb-1" style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400 }}>模拟 PRV Header</div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)' }}>
            <span className="text-xs font-bold" style={{ color: '#f59e0b' }}>P</span>
            <span className="text-sm" style={{ color: '#60a5fa' }}>L1</span>
            <span className="text-xs text-white/60">·text</span>
            <span className="flex-1 text-sm text-white/65 truncate">React Server Components...</span>
            <span className="text-xs text-white/55">A1</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function FontCompare() {
  const [weight, setWeight] = useState(500)
  const [loaded, setLoaded] = useState(false)

  // Dynamically load Google Fonts
  if (!loaded) {
    const imports = FONTS.filter(f => f.import).map(f => f.import!)
    imports.forEach(url => {
      if (!document.querySelector(`link[href="${url}"]`)) {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = url
        document.head.appendChild(link)
      }
    })
    setLoaded(true)
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-white/80">字体对比</h1>
        <p className="text-sm text-white/40 mt-1">在深色背景下对比不同字体的可读性，选一个最清晰的</p>
      </div>

      {/* Weight 选择 */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-sm text-white/50">字重:</span>
        {[400, 500, 600].map(w => (
          <button
            key={w}
            onClick={() => setWeight(w)}
            className={`px-3 py-1 rounded-lg text-sm border transition-all ${
              weight === w
                ? 'bg-blue-500/15 border-blue-500/40 text-blue-400'
                : 'bg-white/[0.03] border-white/[0.08] text-white/40 hover:text-white/60'
            }`}
          >
            {w === 400 ? 'Regular' : w === 500 ? 'Medium' : 'SemiBold'}
          </button>
        ))}
      </div>

      {/* Font cards */}
      <div className="space-y-4">
        {FONTS.map(font => (
          <FontCard key={font.id} font={font} selectedWeight={weight} />
        ))}
      </div>
    </div>
  )
}
