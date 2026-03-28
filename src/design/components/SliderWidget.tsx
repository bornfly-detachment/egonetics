/**
 * SliderWidget — Layer 3
 * 矛盾 ↔ 统一 滑块，使用 useRewardGate 语义
 * 用于 R/V 节点的值域表示
 */
import { useRewardGate } from '../primitives'

interface SliderWidgetProps {
  value: number
  onChange?: (v: number) => void
  threshold?: number
  leftLabel?: string
  rightLabel?: string
  readOnly?: boolean
  accentColor?: string
}

export function SliderWidget({
  value, onChange, threshold = 0.7,
  leftLabel = '矛盾 / 对立', rightLabel = '统一 / 融合',
  readOnly = false, accentColor = '#8b5cf6',
}: SliderWidgetProps) {
  const gate = useRewardGate(value, threshold)

  return (
    <div className="w-full space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-medium" style={{ color: '#ef4444cc' }}>{leftLabel}</span>
        <span className="text-[9px] px-1.5 py-px rounded font-mono font-bold border"
          style={{
            color: gate.met ? '#6ee7b7' : '#fcd34d',
            borderColor: gate.met ? '#10b98150' : '#f59e0b50',
          }}>
          {gate.shortLabel} {gate.pct}%
        </span>
        <span className="text-[9px] font-medium" style={{ color: '#10b981cc' }}>{rightLabel}</span>
      </div>

      <input
        type="range" min={0} max={1} step={0.01}
        value={value}
        onChange={e => onChange?.(parseFloat(e.target.value))}
        disabled={readOnly}
        className="w-full h-1.5 rounded cursor-pointer disabled:cursor-default"
        style={{ accentColor }}
      />

      <div className="flex justify-between">
        <span className="text-[8px]" style={{ color: '#ffffff30' }}>0</span>
        <span className="text-[8px]" style={{ color: '#ffffff20' }}>
          threshold {threshold}
        </span>
        <span className="text-[8px]" style={{ color: '#ffffff30' }}>1</span>
      </div>
    </div>
  )
}
