/**
 * PMessageCard — PRVSE P-unit 消息卡片（共享组件）
 *
 * P = Pattern，三问格式：
 *   Header → 从哪来（信息来源 + 性质标签 + 时间）
 *   Body   → 是什么（内容）
 *   Footer → 去哪（宪法路由，AOP 完成后更新）
 */

export interface PToolUse {
  id: string
  name: string
  input: unknown
}

export interface PMessage {
  id?: string
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
  tierLabel?: string
  timestamp?: string
  constitutionRoute?: string
  // TC 专属
  tcEventType?: string
  toolUses?: PToolUse[]
  toolResult?: { tool_use_id: string; content: string; is_error: boolean }
  tcMeta?: { cost?: number; duration_ms?: number; session_id?: string }
  // 交互式 prompt 专属
  interactiveOptions?: string[]   // 可选项，如 ['1','2','3'] 或 ['y','n']
  interactivePanePath?: string    // 对应的 tmux pane
  interactiveResolved?: string    // 用户已选的选项
}

export interface PSource {
  label: string
  sublabel: string
  color: string
  icon: string
  nature: string
}

export function inferPSource(msg: PMessage): PSource {
  if (msg.role === 'user') {
    return { label: 'bornfly', sublabel: '用户', color: '#f59e0b', icon: '◉', nature: '用户输入 · 主观' }
  }
  const tl = msg.tierLabel ?? ''
  if (tl.startsWith('TC')) {
    if (msg.tcEventType === 'interactive_prompt') {
      return { label: 'Claude Code', sublabel: '等待确认', color: '#f59e0b', icon: '?', nature: 'TC · 交互确认' }
    }
    if (msg.tcEventType === 'tool_result') {
      return { label: 'Claude Code', sublabel: '工具结果', color: '#fb923c', icon: '◧', nature: 'TC · 工具执行' }
    }
    if (msg.tcEventType === 'result') {
      return { label: 'Claude Code', sublabel: '会话结束', color: '#fb923c', icon: '▣', nature: 'TC · 执行报告' }
    }
    return { label: 'Claude Code', sublabel: 'T-Code', color: '#fb923c', icon: '⌘', nature: 'TC · 代码 Agent' }
  }
  if (tl.startsWith('T0')) {
    return { label: 'SEAI', sublabel: '本地模型', color: '#34d399', icon: '⚡', nature: 'AI生成 · 信息' }
  }
  if (tl.startsWith('T1')) {
    return { label: 'MiniMax', sublabel: '云端推理', color: '#60a5fa', icon: '◈', nature: 'AI生成 · 信息' }
  }
  if (tl.startsWith('T2')) {
    return { label: 'Claude', sublabel: 'T2 专家', color: '#a78bfa', icon: '✦', nature: 'AI生成 · 信息' }
  }
  return { label: 'AI', sublabel: '', color: '#9ca3af', icon: '◈', nature: 'AI生成 · 信息' }
}

export function nowHHMM(): string {
  return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

export default function PMessageCard({ msg, onRespond }: { msg: PMessage; onRespond?: (pane: string, option: string) => void }) {
  const src = inferPSource(msg)
  const isUser = msg.role === 'user'

  return (
    <div
      className={`flex flex-col rounded-xl overflow-hidden border ${isUser ? 'ml-6' : 'mr-1'}`}
      style={{ borderColor: src.color + '28' }}
    >
      {/* 从哪来 — source header */}
      <div
        className="flex items-center justify-between px-2.5 py-1.5"
        style={{ background: src.color + '0e', borderBottom: `1px solid ${src.color}1a` }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[9px] shrink-0" style={{ color: src.color }}>{src.icon}</span>
          <span className="text-[10px] font-mono font-medium shrink-0" style={{ color: src.color + 'cc' }}>
            {src.label}
          </span>
          {src.sublabel && (
            <span className="text-[8px] font-mono text-white/20 truncate">· {src.sublabel}</span>
          )}
          {msg.tierLabel && !isUser && (
            <span className="text-[8px] font-mono shrink-0" style={{ color: src.color + '55' }}>
              [{msg.tierLabel}]
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          <span
            className="px-1.5 py-px rounded text-[8px] font-mono whitespace-nowrap"
            style={{ color: src.color + '88', background: src.color + '0a', border: `1px solid ${src.color}18` }}
          >
            {src.nature}
          </span>
          {msg.timestamp && (
            <span className="text-[8px] font-mono text-white/18">{msg.timestamp}</span>
          )}
        </div>
      </div>

      {/* 是什么 — content body */}
      <div className="px-3 py-2.5 flex flex-col gap-2" style={{ background: src.color + '04' }}>
        {msg.streaming && !msg.content ? (
          <span className="flex gap-0.5 py-0.5">
            <span className="w-1 h-1 rounded-full bg-white/25 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1 h-1 rounded-full bg-white/25 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1 h-1 rounded-full bg-white/25 animate-bounce" style={{ animationDelay: '300ms' }} />
          </span>
        ) : msg.content ? (
          <span className="text-[11px] leading-relaxed whitespace-pre-wrap text-white/65">
            {msg.content}
          </span>
        ) : null}

        {/* 交互式 prompt 选项按钮 */}
        {msg.interactiveOptions && msg.interactiveOptions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {msg.interactiveResolved ? (
              <span className="text-[9px] font-mono px-2 py-0.5 rounded"
                style={{ color: '#f59e0b99', border: '1px solid #f59e0b22', background: '#f59e0b0a' }}>
                已选: {msg.interactiveResolved}
              </span>
            ) : (
              msg.interactiveOptions.map(opt => (
                <button
                  key={opt}
                  onClick={() => msg.interactivePanePath && onRespond?.(msg.interactivePanePath, opt)}
                  className="text-[10px] font-mono px-2.5 py-1 rounded transition-all
                    hover:scale-105 active:scale-95"
                  style={{
                    color: '#f59e0bcc',
                    border: '1px solid #f59e0b40',
                    background: '#f59e0b0f',
                  }}
                >
                  {opt === '' ? '↵ Enter' : opt}
                </button>
              ))
            )}
          </div>
        )}

        {/* TC: tool_use 调用列表 */}
        {msg.toolUses && msg.toolUses.length > 0 && (
          <div className="flex flex-col gap-1">
            {msg.toolUses.map(tu => (
              <div
                key={tu.id}
                className="rounded-lg overflow-hidden border"
                style={{ borderColor: '#fb923c26', background: '#fb923c08' }}
              >
                <div className="flex items-center gap-1.5 px-2 py-1" style={{ borderBottom: '1px solid #fb923c18' }}>
                  <span className="text-[8px] font-mono text-orange-400/50">⌘ 工具调用</span>
                  <span className="text-[9px] font-mono font-medium text-orange-300/80">{tu.name}</span>
                </div>
                <pre className="text-[9px] font-mono text-white/40 px-2 py-1.5 overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(tu.input, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        )}

        {/* TC: tool_result */}
        {msg.toolResult && (
          <div
            className="rounded-lg overflow-hidden border"
            style={{
              borderColor: msg.toolResult.is_error ? '#ef444426' : '#22c55e26',
              background: msg.toolResult.is_error ? '#ef444408' : '#22c55e08',
            }}
          >
            <div
              className="flex items-center gap-1.5 px-2 py-1"
              style={{ borderBottom: msg.toolResult.is_error ? '1px solid #ef444418' : '1px solid #22c55e18' }}
            >
              <span className="text-[8px] font-mono" style={{ color: msg.toolResult.is_error ? '#f87171aa' : '#4ade80aa' }}>
                {msg.toolResult.is_error ? '✗ 错误' : '✓ 结果'}
              </span>
              <span className="text-[8px] font-mono text-white/20">id:{msg.toolResult.tool_use_id.slice(-6)}</span>
            </div>
            <pre className="text-[9px] font-mono text-white/45 px-2 py-1.5 overflow-x-auto whitespace-pre-wrap max-h-32">
              {msg.toolResult.content}
            </pre>
          </div>
        )}

        {/* TC: result 成本/时长报告 */}
        {msg.tcEventType === 'result' && msg.tcMeta && (
          <div className="flex items-center gap-3 py-0.5">
            {msg.tcMeta.cost !== undefined && (
              <span className="text-[9px] font-mono text-orange-400/60">
                💰 ${msg.tcMeta.cost.toFixed(4)}
              </span>
            )}
            {msg.tcMeta.duration_ms !== undefined && (
              <span className="text-[9px] font-mono text-white/30">
                ⏱ {(msg.tcMeta.duration_ms / 1000).toFixed(1)}s
              </span>
            )}
            {msg.tcMeta.session_id && (
              <span className="text-[8px] font-mono text-white/15 truncate">
                sid:{msg.tcMeta.session_id.slice(-8)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* 去哪 — constitutional destination */}
      <div
        className="flex items-center gap-1.5 px-2.5 py-1"
        style={{ background: '#06080f', borderTop: `1px solid ${src.color}12` }}
      >
        <span className="text-[8px] font-mono text-white/12">去哪</span>
        <span
          className="text-[8px] font-mono px-1.5 py-px rounded"
          style={{
            color: msg.constitutionRoute ? '#6ee7b7' : '#4b5563',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.04)',
          }}
        >
          {msg.constitutionRoute ?? '待宪法路由'}
        </span>
      </div>
    </div>
  )
}
