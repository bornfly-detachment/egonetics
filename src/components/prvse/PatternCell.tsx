/**
 * PatternCell — UI_2 (v2)
 * 每个 PRVSE 节点的详情卡片
 *
 * 布局：
 *   顶栏  — 节点类型 + 标签 + 保存/关闭
 *   权限层 — l₀/l₁/l₂ 三个可折叠 section，极度视觉突出
 *   From/Who/To — 三行 tag 矩阵 + author/content/power
 *   AOP 侧边条 — 抽象 icon-link 占位符（未实现钩子，只做 stub）
 *
 * AOP Stub 接口（供未来实现参考）：
 *   interface AopLink {
 *     id:       string
 *     layer:    'l0' | 'l1' | 'l2'
 *     type:     'sensor' | 'compute' | 'ai' | 'comm'
 *     status:   'stub' | 'active'
 *     endpoint?: string   // 激活后填写
 *   }
 * 当前 status 全部为 'stub'，点击无效果，等待后端 AOP 框架实装。
 */
import { useState, useEffect, useCallback } from 'react'
import { X, ChevronDown, ChevronRight, Link2 } from 'lucide-react'
import { authFetch } from '@/lib/http'
import { useTokens } from '@/design/TokenProvider'
import { useLayerPermission } from '@/design/primitives'
import { SliderWidget } from '@/design/components/SliderWidget'

export type NodeType = 'P' | 'R' | 'V' | 'S' | 'E'

export interface PRVSENode {
  id:              string
  task_id:         string
  node_type:       NodeType
  label:           string
  x:               number
  y:               number
  from_tags:       string[]
  who_tags:        string[]
  to_tags:         string[]
  ai_aop:          string[]
  sensor_aop:      string[]
  comm_aop:        string[]
  content:         string
  author:          string
  power:           string[]
  // v2: permission layers
  l0_data:         Record<string, unknown>
  l1_data:         Record<string, unknown>
  l2_data:         Record<string, unknown>
  permission_level: number
  slider_value:    number   // 0=矛盾/对立, 1=统一/融合（R/V 专用）
}

const LAYER_IDS = ['l0', 'l1', 'l2'] as const
type LayerId = typeof LAYER_IDS[number]

// ── 小标签列表 ───────────────────────────────────────────────────
function TagList({ tags, onChange, placeholder }: {
  tags: string[]
  onChange: (t: string[]) => void
  placeholder: string
}) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const t = draft.trim()
    if (t && !tags.includes(t)) { onChange([...tags, t]); setDraft('') }
  }
  return (
    <div className="flex flex-wrap gap-1 items-center min-h-[20px]">
      {tags.map(t => (
        <span key={t} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-white/[0.06] text-white/60">
          {t}
          <button onClick={() => onChange(tags.filter(x => x !== t))} className="text-white/30 hover:text-red-400">
            <X size={8} />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') add() }}
        placeholder={placeholder}
        className="bg-transparent outline-none text-[10px] text-white/40 placeholder-white/20 w-16"
      />
    </div>
  )
}

// ── AOP Stub 侧边条 ──────────────────────────────────────────────
/**
 * AOP 抽象占位符 — 每层一个 icon-link stub
 * 当前不可点击，未来接入 AOP 框架后激活 endpoint
 *
 * 接口草案:
 *   AopLink { id, layer:'l0'|'l1'|'l2', type:'sensor'|'compute'|'ai'|'comm', status:'stub'|'active', endpoint? }
 */
function AopSideBar({ tags, onChangeTags }: {
  tags: { ai: string[]; sensor: string[]; comm: string[] }
  onChangeTags: (k: 'ai' | 'sensor' | 'comm', v: string[]) => void
}) {
  return (
    <div className="w-24 shrink-0 border-r border-white/[0.06] flex flex-col bg-white/[0.015] overflow-y-auto">
      <div className="px-1.5 py-1.5 border-b border-white/[0.04]">
        <div className="text-[8px] text-white/25 font-bold mb-1 tracking-widest uppercase">AOP</div>

        {/* l₀ sensor stub */}
        <div className="mb-2">
          <div className="flex items-center gap-1 mb-0.5">
            <span className="text-[8px] text-blue-400/60">⚡ l₀</span>
            {/* AOP stub icon-link — sensor AOP, status: stub */}
            <span title="Sensor AOP stub — 未实现" className="text-white/15 cursor-not-allowed">
              <Link2 size={8} />
            </span>
          </div>
          <TagList tags={tags.sensor} onChange={v => onChangeTags('sensor', v)} placeholder="+ hook" />
        </div>

        {/* l₁ compute/comm stub */}
        <div className="mb-2">
          <div className="flex items-center gap-1 mb-0.5">
            <span className="text-[8px] text-emerald-400/60">🔧 l₁</span>
            {/* AOP stub icon-link — comm AOP, status: stub */}
            <span title="Comm AOP stub — 未实现" className="text-white/15 cursor-not-allowed">
              <Link2 size={8} />
            </span>
          </div>
          <TagList tags={tags.comm} onChange={v => onChangeTags('comm', v)} placeholder="+ hook" />
        </div>

        {/* l₂ AI stub */}
        <div>
          <div className="flex items-center gap-1 mb-0.5">
            <span className="text-[8px] text-purple-400/60">🧠 l₂</span>
            {/* AOP stub icon-link — AI AOP, status: stub */}
            <span title="AI AOP stub — 未实现" className="text-white/15 cursor-not-allowed">
              <Link2 size={8} />
            </span>
          </div>
          <TagList tags={tags.ai} onChange={v => onChangeTags('ai', v)} placeholder="+ hook" />
        </div>
      </div>
    </div>
  )
}

// ── 权限层 Section ───────────────────────────────────────────────
function LayerSection({
  layerId, data, isUnlocked, onDataChange,
}: {
  layerId: LayerId
  data: Record<string, unknown>
  isUnlocked: boolean
  onDataChange: (d: Record<string, unknown>) => void
}) {
  const { layer: layerTokens } = useTokens()
  const tok = layerTokens[layerId]
  const [open, setOpen] = useState(true)
  const raw = JSON.stringify(data, null, 2)
  const label = layerId === 'l0' ? 'l₀' : layerId === 'l1' ? 'l₁' : 'l₂'

  return (
    <div className="border-b border-white/[0.06] last:border-0">
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:brightness-110 transition-all"
        style={{ background: tok.bg + 'cc' }}
      >
        <span className="text-base leading-none">{tok.icon}</span>
        <span className="text-xs font-black font-mono tracking-widest" style={{ color: tok.color }}>{label}</span>
        <span className="text-[9px] text-white/40 font-medium">{tok.name}</span>
        <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded font-mono font-bold border"
          style={isUnlocked
            ? { color: tok.color, borderColor: tok.border + '80' }
            : { color: '#ffffff20', borderColor: '#ffffff15' }
          }>
          {isUnlocked ? `P${tok.perm} ✓` : `🔒 P${tok.perm}`}
        </span>
        {open ? <ChevronDown size={10} className="text-white/30" /> : <ChevronRight size={10} className="text-white/30" />}
      </button>

      {open && (
        <div className="px-3 py-2">
          {!isUnlocked ? (
            <div className="text-[10px] text-white/20 italic py-2">权限不足，内容不可见</div>
          ) : (
            <textarea
              value={raw}
              onChange={e => {
                try { onDataChange(JSON.parse(e.target.value)) } catch { /* typing */ }
              }}
              rows={3}
              className="w-full bg-black/20 border border-white/[0.06] rounded px-2 py-1.5
                text-[10px] font-mono text-white/60 outline-none resize-y focus:border-white/15"
              spellCheck={false}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ── R 专属: 约束类型 + Slider ────────────────────────────────────
const CONSTRAINT_TYPES = [
  { value: 'directed',          label: 'A →  B',   desc: '有向边' },
  { value: 'constraint',        label: 'A -×→ B',  desc: '单向制约' },
  { value: 'mutual_constraint', label: 'A ←×→ B', desc: '互相制约' },
  { value: 'contains',          label: 'A ⊂  B',   desc: '包含关系' },
  { value: 'derives',           label: 'A ⇒  B',   desc: '推导/演化' },
  { value: 'signal',            label: 'A ~~> B',  desc: '信号流' },
]

function RBody({ l1Data, sliderValue, onL1Change, onSliderChange }: {
  l1Data: Record<string, unknown>
  sliderValue: number
  onL1Change: (d: Record<string, unknown>) => void
  onSliderChange: (v: number) => void
}) {
  const constraintType = (l1Data.constraint_type as string) ?? 'directed'

  return (
    <div className="px-3 py-2 space-y-3 border-t border-white/[0.05]">
      {/* 约束类型 */}
      <div>
        <div className="text-[9px] text-white/30 mb-1.5">约束类型（Value 制约箭头）</div>
        <div className="flex flex-wrap gap-1.5">
          {CONSTRAINT_TYPES.map(ct => (
            <button
              key={ct.value}
              onClick={() => onL1Change({ ...l1Data, constraint_type: ct.value })}
              className={`px-2 py-1 rounded text-[10px] font-mono border transition-colors ${
                constraintType === ct.value
                  ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                  : 'bg-white/[0.04] border-white/10 text-white/40 hover:border-white/20'
              }`}
              title={ct.desc}
            >
              {ct.label}
            </button>
          ))}
        </div>
      </div>

      <SliderWidget value={sliderValue} onChange={onSliderChange} accentColor="#8b5cf6" />
    </div>
  )
}

// ── V 专属: 指标 + Reward + 主观分布 ─────────────────────────────
function VBody({ l0Data, l1Data, sliderValue, onL1Change, onSliderChange }: {
  l0Data: Record<string, unknown>
  l1Data: Record<string, unknown>
  sliderValue: number
  onL1Change: (d: Record<string, unknown>) => void
  onSliderChange: (v: number) => void
}) {
  const todos = (l1Data.todos as string[]) ?? []
  const rewardFn = (l1Data.reward_fn as string) ?? ''

  return (
    <div className="px-3 py-2 space-y-3 border-t border-white/[0.05]">
      {/* l₀ metrics */}
      <div className="flex gap-3">
        {['timer_ms', 'token_count', 'resource_usage'].map(k => (
          <div key={k} className="flex-1">
            <div className="text-[8px] text-blue-400/60 mb-0.5 font-mono">{k}</div>
            <input
              value={(l0Data[k] as string) ?? ''}
              onChange={() => {/* handled via LayerSection JSON edit */}}
              readOnly
              className="w-full text-[10px] font-mono bg-blue-500/5 border border-blue-500/15 rounded px-1.5 py-0.5 text-white/50 outline-none"
            />
          </div>
        ))}
      </div>

      {/* l₁ Reward */}
      <div>
        <div className="text-[9px] text-emerald-400/70 mb-1">Reward = P(Action|Condition) ≤ 阈值</div>
        <textarea
          value={rewardFn}
          onChange={e => onL1Change({ ...l1Data, reward_fn: e.target.value })}
          rows={2}
          placeholder="定义 Reward 函数或数学公式…"
          className="w-full text-[10px] font-mono bg-emerald-500/5 border border-emerald-500/15 rounded px-2 py-1 text-white/60 outline-none resize-none"
        />
        {/* TODO checklist */}
        <div className="mt-1 space-y-0.5">
          {todos.map((t, i) => (
            <label key={i} className="flex items-center gap-1.5 text-[10px] text-white/50">
              <input type="checkbox" className="accent-emerald-500" />
              <span>{t}</span>
            </label>
          ))}
          <input
            placeholder="+ 添加 TODO…"
            onKeyDown={e => {
              if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                onL1Change({ ...l1Data, todos: [...todos, e.currentTarget.value.trim()] })
                e.currentTarget.value = ''
              }
            }}
            className="w-full text-[10px] bg-transparent outline-none text-white/30 placeholder-white/15 border-b border-white/[0.06]"
          />
        </div>
      </div>

      {/* l₂ 主观分布 slider */}
      <div>
        <SliderWidget
          value={sliderValue} onChange={onSliderChange}
          leftLabel="主观不确定性" rightLabel="完成确定性"
          accentColor="#f59e0b"
        />
      </div>
    </div>
  )
}

// ── From / Who / To 行 ───────────────────────────────────────────
function Row({ label, color, children }: { label: string; color: string; children: React.ReactNode }) {
  return (
    <div className="flex border-b border-white/[0.05] last:border-0">
      <div className={`w-10 shrink-0 flex items-center justify-center text-[10px] font-black border-r border-white/[0.05] ${color}`}>
        {label}
      </div>
      <div className="flex-1 p-2">{children}</div>
    </div>
  )
}

// ── 主组件 ───────────────────────────────────────────────────────
export default function PatternCell({
  node, onClose, onSave,
}: {
  node:    PRVSENode
  onClose: () => void
  onSave:  (updated: Partial<PRVSENode>) => void
}) {
  const { node: nodeTokens } = useTokens()
  const [local, setLocal] = useState<PRVSENode>(node)
  const permGate = useLayerPermission(local.permission_level)
  const [saving, setSaving] = useState(false)
  const nc = nodeTokens[node.node_type] ?? nodeTokens.P

  useEffect(() => { setLocal(node) }, [node.id])

  const patch = useCallback((updates: Partial<PRVSENode>) => {
    setLocal(prev => ({ ...prev, ...updates }))
  }, [])

  const save = useCallback(async () => {
    setSaving(true)
    try {
      const body = {
        ...local,
        l0_data: JSON.stringify(local.l0_data),
        l1_data: JSON.stringify(local.l1_data),
        l2_data: JSON.stringify(local.l2_data),
      }
      await authFetch(`/tasks/${local.task_id}/graph/nodes/${local.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      onSave(local)
    } finally {
      setSaving(false)
    }
  }, [local, onSave])

  return (
    <div className="flex flex-col h-full bg-[#0d1117] overflow-hidden"
      style={{ borderLeft: `2px solid ${nc.border}60` }}>
      {/* 顶栏 */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-white/[0.06]"
        style={{ background: nc.bg + 'cc' }}>
        <div className="w-2 h-2 rounded-full" style={{ background: nc.border }} />
        <span className="text-xs font-black" style={{ color: nc.text }}>{node.node_type}</span>
        <span className="text-[10px] text-white/40">{nc.label}</span>
        <input
          value={local.label}
          onChange={e => patch({ label: e.target.value })}
          placeholder="节点标签…"
          className="flex-1 bg-transparent outline-none text-sm text-white/80 placeholder-white/20"
        />
        {/* 权限级别选择 */}
        <select
          value={local.permission_level}
          onChange={e => patch({ permission_level: Number(e.target.value) })}
          className="text-[10px] bg-black/30 border border-white/10 rounded px-1 py-0.5 text-white/50 outline-none"
          title="当前用户权限级别"
        >
          <option value={0}>P₀ 全公开</option>
          <option value={1}>P₁ 规律层</option>
          <option value={2}>P₂ 认知层</option>
        </select>
        <button onClick={save} disabled={saving}
          className="text-[10px] px-2 py-0.5 rounded bg-white/[0.06] hover:bg-white/10 text-white/50 hover:text-white/80 disabled:opacity-40">
          {saving ? '…' : '保存'}
        </button>
        <button onClick={onClose} className="text-white/30 hover:text-white/60"><X size={13} /></button>
      </div>

      {/* 主体：AOP侧边 + 内容区 */}
      <div className="flex flex-1 overflow-hidden">
        {/* AOP 侧边条 */}
        <AopSideBar
          tags={{ ai: local.ai_aop, sensor: local.sensor_aop, comm: local.comm_aop }}
          onChangeTags={(k, v) => {
            if (k === 'ai') patch({ ai_aop: v })
            else if (k === 'sensor') patch({ sensor_aop: v })
            else patch({ comm_aop: v })
          }}
        />

        {/* 右侧内容 */}
        <div className="flex-1 flex flex-col overflow-y-auto">
          {/* ── 权限层 l₀/l₁/l₂ ── */}
          <div className="border-b border-white/[0.08]">
            {LAYER_IDS.map(lid => (
              <LayerSection
                key={lid}
                layerId={lid}
                data={local[`${lid}_data` as 'l0_data' | 'l1_data' | 'l2_data']}
                isUnlocked={permGate.canView(lid === 'l0' ? 0 : lid === 'l1' ? 1 : 2)}
                onDataChange={d => patch({ [`${lid}_data`]: d } as any)}
              />
            ))}
          </div>

          {/* ── R 专属 body ── */}
          {node.node_type === 'R' && (
            <RBody
              l1Data={local.l1_data}
              sliderValue={local.slider_value}
              onL1Change={d => patch({ l1_data: d })}
              onSliderChange={v => patch({ slider_value: v })}
            />
          )}

          {/* ── V 专属 body ── */}
          {node.node_type === 'V' && (
            <VBody
              l0Data={local.l0_data}
              l1Data={local.l1_data}
              sliderValue={local.slider_value}
              onL1Change={d => patch({ l1_data: d })}
              onSliderChange={v => patch({ slider_value: v })}
            />
          )}

          {/* ── From / Who / To ── */}
          <div className="border-t border-white/[0.06]">
            <Row label="From" color="text-blue-400/70">
              <div className="flex gap-2">
                <div className="flex-1">
                  <div className="text-[8px] text-white/25 mb-1">Tag Aop</div>
                  <TagList tags={local.from_tags} onChange={v => patch({ from_tags: v })} placeholder="+ tag" />
                </div>
                <div className="flex-1 border-l border-white/[0.05] pl-2">
                  <div className="text-[8px] text-white/25 mb-1">Author</div>
                  <input
                    value={local.author}
                    onChange={e => patch({ author: e.target.value })}
                    placeholder="作者…"
                    className="w-full bg-transparent outline-none text-[10px] text-white/60 placeholder-white/20"
                  />
                </div>
              </div>
            </Row>

            <Row label="Who" color="text-purple-400/70">
              <div className="flex gap-2">
                <div className="flex-1">
                  <div className="text-[8px] text-white/25 mb-1">Tag Aop</div>
                  <TagList tags={local.who_tags} onChange={v => patch({ who_tags: v })} placeholder="+ tag" />
                </div>
                <div className="flex-1 border-l border-white/[0.05] pl-2">
                  <div className="text-[8px] text-white/25 mb-1">Content</div>
                  <textarea
                    value={local.content}
                    onChange={e => patch({ content: e.target.value })}
                    placeholder="内容描述…"
                    rows={2}
                    className="w-full bg-transparent outline-none text-[10px] text-white/70 placeholder-white/20 resize-none"
                  />
                  <div className="mt-1">
                    <div className="text-[8px] text-white/25 mb-0.5">Power</div>
                    <TagList tags={local.power} onChange={v => patch({ power: v })} placeholder="+ power" />
                  </div>
                </div>
              </div>
            </Row>

            <Row label="To" color="text-emerald-400/70">
              <div className="flex gap-2">
                <div className="flex-1">
                  <div className="text-[8px] text-white/25 mb-1">Tag Aop</div>
                  <TagList tags={local.to_tags} onChange={v => patch({ to_tags: v })} placeholder="+ tag" />
                </div>
                <div className="flex-1 border-l border-white/[0.05] pl-2">
                  <div className="text-[8px] text-white/25 italic text-[9px]">连线在图中定义</div>
                </div>
              </div>
            </Row>
          </div>
        </div>
      </div>
    </div>
  )
}
