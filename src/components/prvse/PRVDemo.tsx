/**
 * PRVDemo — PRV 三组件 Demo 页面
 * P section: 真实 API (/api/prvse/P)
 * R/V sections: mock 数据（待后续接入）
 */
import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, RefreshCw } from 'lucide-react'
import type {
  PatternData, RelationData, ValueData,
  ProvenanceData, ResourceData, MountData,
} from '@prvse/types'
import { prvseApi, type IndexEntry } from '@/lib/prvse-api'
import PUnit from './PUnit'
import RUnit from './RUnit'
import VUnit from './VUnit'

// ═══════════════════════════════════════════════════════════════════
// Default panel data (provenance / resources / mounts)
// ═══════════════════════════════════════════════════════════════════

const defaultProvenance: ProvenanceData = {
  origin: { domain: 'internal', source: 'user_input', label: 'bornfly 手动输入', chain: [] },
  version: 1,
  frozen: false,
  chronicle: {
    designRationale: '',
    functionalSpec: '',
    dependencies: [],
    constitutionBindings: [],
    sourceRef: '',
  },
}

const defaultResources: ResourceData = {
  filePath: '',
  authority: 'A1',
  aiTier: 'T1',
  storage: 0,
  dependencies: [],
}

const defaultMounts: MountData = {
  aopHooks: [],
  constitutionBindings: [],
  ports: [],
  skills: [],
}

// ═══════════════════════════════════════════════════════════════════
// Mock R / V (unchanged, pending real API hookup)
// ═══════════════════════════════════════════════════════════════════

const mockRelation: RelationData = {
  id: 'R-001',
  timestamp: Date.now(),
  label: 'PRV Demo 关系图',
  infoLevel: 'L1_conditional',
  viewLevel: 'L1',
  nodes: ['P-001', 'P-002', 'V-001', 'S-001'],
  edges: [
    { id: 'e1', sourceNode: 'P-001', targetNode: 'P-002', infoLevel: 'L0_logic', edgeType: 'derives', direction: 'one_way', certainty: 'deterministic', temporal: 'sequential', strength: 'positive', propagation: 'forward', priority: 1, destination: 'R_D1_reasoning', logic: 'deductive' },
    { id: 'e2', sourceNode: 'P-001', targetNode: 'V-001', infoLevel: 'L1_conditional', edgeType: 'directed', direction: 'one_way', certainty: 'probabilistic', temporal: 'sequential', strength: 'positive', propagation: 'forward', priority: 2, destination: 'R_D2_value_calc', causal: 'direct_causal' },
    { id: 'e3', sourceNode: 'V-001', targetNode: 'S-001', infoLevel: 'L1_conditional', edgeType: 'constraint', direction: 'one_way', certainty: 'deterministic', temporal: 'sequential', strength: 'positive', propagation: 'forward', priority: 3, destination: 'R_D4_constraint_check' },
    { id: 'e4', sourceNode: 'S-001', targetNode: 'P-001', infoLevel: 'L2_existential', edgeType: 'signal', direction: 'one_way', certainty: 'fuzzy', temporal: 'cyclic', strength: 'positive', propagation: 'backward', priority: 4, destination: 'R_D5_activate_node', dialectic: 'transform' },
  ],
}

const mockValue: ValueData = {
  id: 'V-001',
  timestamp: Date.now(),
  label: 'P-001 入库验证',
  verdictLevel: 'L0_deterministic',
  metrics: [
    { type: 'accuracy', label: '分类准确率', value: 0.87, threshold: 0.80, unit: '' },
    { type: 'timer', label: '处理时间', value: 230, threshold: 500, unit: 'ms' },
    { type: 'counter', label: '引用次数', value: 3, unit: '次' },
    { type: 'roi', label: 'ROI', value: 3.2, threshold: 1.0 },
  ],
  checklist: [
    { id: 'c1', type: 'result', description: '输出匹配预期分类', result: 'pass' },
    { id: 'c2', type: 'function', description: '三态转换功能完整', result: 'pass' },
    { id: 'c3', type: 'effect', description: '信息路由到正确目标', result: 'pass' },
    { id: 'c4', type: 'extreme', description: '边界用例：空内容处理', result: 'warn', evidence: '空内容未测试' },
    { id: 'c5', type: 'format', description: '数据格式完整合法', result: 'pass' },
  ],
  rewards: [
    { type: 'alignment', label: '目标对齐', value: 0.92 },
    { type: 'relevance', label: '信息相关度', value: 0.78 },
    { type: 'optimality', label: '最优性', value: 0.45, formula: 'local optimal detected' },
  ],
  lifecycle: {
    resourceBudget: { timeDeadline: Date.now() + 86400000, aiTokenBudget: 10000 },
    feedbackDirection: 'positive',
    homeostasisDeviation: 0.12,
    optimalityType: 'local',
  },
  verdict: 'pass',
  independence: { neutral: true, antiInfiltration: true, kernelDirect: true },
}

// ═══════════════════════════════════════════════════════════════════
// P Section — real API
// ═══════════════════════════════════════════════════════════════════

function PSection() {
  const [items, setItems] = useState<IndexEntry[]>([])
  const [selected, setSelected] = useState<PatternData | null>(null)
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [classifying, setClassifying] = useState(false)
  const [newContent, setNewContent] = useState('')

  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      const result = await prvseApi.list('P')
      setItems(result.items)
      // Auto-select first if nothing selected
      if (result.items.length > 0 && !selected) {
        const first = await prvseApi.get<PatternData>('P', result.items[0].id)
        setSelected(first)
      }
    } finally {
      setLoading(false)
    }
  }, [selected])

  useEffect(() => { loadList() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = async (id: string) => {
    setLoading(true)
    try {
      const data = await prvseApi.get<PatternData>('P', id)
      setSelected(data)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!newContent.trim()) return
    setCreating(true)
    try {
      const data = await prvseApi.create<PatternData>('P', {
        rawContent: newContent.trim(),
        state: 'candidate',
        physical: { resolved: false },
        level: { resolved: false },
        communication: { resolved: false },
        origin: { domain: 'internal', source: 'user_input', label: 'bornfly 手动输入', chain: [] },
      })
      setNewContent('')
      setSelected(data)
      await loadList()
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    await prvseApi.delete('P', id)
    if (selected?.id === id) setSelected(null)
    await loadList()
  }

  const handleFork = async () => {
    if (!selected) return
    const forked = await prvseApi.fork<PatternData>('P', selected.id)
    setSelected(forked)
    await loadList()
  }

  const handleFreeze = async () => {
    if (!selected) return
    const frozen = await prvseApi.freeze<PatternData>('P', selected.id)
    setSelected(frozen)
  }

  const handleUpdate = async (patch: Partial<PatternData>) => {
    if (!selected) return
    const updated = await prvseApi.update<PatternData>('P', selected.id, patch)
    setSelected(updated)
    await loadList()
  }

  const provenance: ProvenanceData = selected ? {
    ...defaultProvenance,
    version: selected.version ?? 1,
    frozen: selected.frozen ?? false,
    parentId: selected.parentId,
    origin: selected.origin ?? defaultProvenance.origin,
    chronicle: {
      ...defaultProvenance.chronicle!,
      sourceRef: `chronicle/P/${selected.id}.yaml@v${selected.version ?? 1}`,
    },
  } : defaultProvenance

  const resources: ResourceData = {
    ...defaultResources,
    filePath: selected ? `chronicle/P/${selected.id}.yaml` : '',
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3">
        <div className="text-sm font-bold text-amber-400/70 font-mono uppercase tracking-wider flex-1">
          P — Pattern 信息原语
        </div>
        <button
          onClick={loadList}
          disabled={loading}
          className="p-1.5 rounded text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
          title="刷新"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Item list */}
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {items.map(item => (
            <div key={item.id} className="flex items-center gap-1">
              <button
                onClick={() => handleSelect(item.id)}
                className={`px-2 py-0.5 rounded text-xs font-mono transition-colors ${
                  selected?.id === item.id
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-white/[0.04] text-white/50 hover:text-white/70 border border-white/[0.06]'
                }`}
              >
                {item.id}
              </button>
              <button
                onClick={() => handleDelete(item.id)}
                className="p-0.5 rounded text-white/20 hover:text-red-400/70 transition-colors"
                title="删除"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create new */}
      <div className="flex gap-2 mb-4">
        <textarea
          value={newContent}
          onChange={e => setNewContent(e.target.value)}
          placeholder="输入新 Pattern 内容..."
          rows={2}
          className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 placeholder-white/25 resize-none focus:outline-none focus:border-amber-500/40 font-sans"
        />
        <button
          onClick={handleCreate}
          disabled={creating || !newContent.trim()}
          className="px-3 py-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-mono hover:bg-amber-500/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          {creating ? '创建中...' : '新建 P'}
        </button>
      </div>

      {/* PUnit */}
      {selected ? (
        <PUnit
          data={selected}
          provenance={provenance}
          resources={resources}
          mounts={defaultMounts}
          onUpdate={handleUpdate}
          onStateTransition={next => handleUpdate({ state: next })}
          onFork={handleFork}
          onFreeze={handleFreeze}
        />
      ) : (
        <div className="flex items-center justify-center h-24 rounded-xl border border-white/[0.06] text-white/25 text-sm">
          {loading ? '加载中...' : '暂无 Pattern — 输入内容新建一条'}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Demo Page
// ═══════════════════════════════════════════════════════════════════

export default function PRVDemo() {
  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      {/* Title */}
      <div className="mb-8">
        <h1 className="text-lg font-semibold text-white/80 font-mono">PRV Demo</h1>
        <p className="text-xs text-white/50 mt-1">
          Pattern · Relation · Value — 三个独立控制论单元 + 三个通用面板
        </p>
      </div>

      {/* P — real API */}
      <PSection />

      {/* R — mock */}
      <div>
        <div className="text-sm font-bold text-violet-400/70 font-mono mb-3 uppercase tracking-wider">R — Relation 图结构</div>
        <RUnit
          data={mockRelation}
          provenance={{ ...defaultProvenance, chronicle: { ...defaultProvenance.chronicle!, designRationale: 'PRV Demo 的关系拓扑', functionalSpec: '展示 PRVSE 循环边和 L 级别递进' } }}
          resources={{ ...defaultResources, filePath: 'chronicle/R/R-001.yaml' }}
          mounts={{ ...defaultMounts, ports: [
            { direction: 'in', target: 'P-001', targetType: 'P', edgeType: 'directed' },
            { direction: 'out', target: 'V-001', targetType: 'V', edgeType: 'constraint' },
          ]}}
          onFork={() => alert('Fork R-001')}
        />
      </div>

      {/* V — mock */}
      <div>
        <div className="text-sm font-bold text-orange-400/70 font-mono mb-3 uppercase tracking-wider">V — Value 裁判</div>
        <VUnit
          data={mockValue}
          provenance={{ ...defaultProvenance, chronicle: { ...defaultProvenance.chronicle!, designRationale: 'P-001 的入库验证清单', functionalSpec: 'L0 确定性验证 + Reward 评估' } }}
          resources={{ ...defaultResources, filePath: 'chronicle/V/V-001.yaml', authority: 'A2' }}
          mounts={{ ...defaultMounts, skills: [{ id: 's3', name: 'ChecklistGenerator', type: 'compiler', active: true }] }}
          onFork={() => alert('Fork V-001')}
        />
      </div>
    </div>
  )
}
