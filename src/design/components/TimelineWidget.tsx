/**
 * TimelineWidget — Layer 3
 * 横向时序步骤，用于 R timeline 类型
 */
interface TimelineWidgetProps {
  steps?: string[]
  color?: string
}

export function TimelineWidget({
  steps = ['步骤 A', '演化 B', '结果 C'],
  color = '#3b82f6',
}: TimelineWidgetProps) {
  return (
    <div className="flex items-center">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center">
          <div className="flex flex-col items-center">
            <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center
              text-[8px] font-bold"
              style={{ borderColor: color + '80', background: color + '20', color }}>
              {i + 1}
            </div>
            <div className="text-[8px] mt-0.5 whitespace-nowrap" style={{ color: '#ffffff50' }}>{s}</div>
          </div>
          {i < steps.length - 1 && (
            <div className="w-6 h-px mb-3" style={{ background: '#ffffff20' }} />
          )}
        </div>
      ))}
    </div>
  )
}
