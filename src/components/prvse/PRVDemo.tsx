/**
 * PRVDemo — PRV 三组件 Demo 页面
 * 用 mock 数据展示 PUnit / RUnit / VUnit + 三通用面板
 */
import { useState } from 'react'
import type {
  PatternData, RelationData, ValueData,
  ProvenanceData, ResourceData, MountData,
} from '@prvse/types'
import PUnit from './PUnit'
import RUnit from './RUnit'
import VUnit from './VUnit'

// ═══════════════════════════════════════════════════════════════════
// Mock Data
// ═══════════════════════════════════════════════════════════════════

const mockProvenance: ProvenanceData = {
  origin: {
    domain: 'internal',
    source: 'user_input',
    label: 'bornfly 手动输入',
    chain: [
      { domain: 'external', source: 'verifiable', label: 'react.dev/blog' },
    ],
  },
  parentId: undefined,
  version: 2,
  frozen: false,
  chronicle: {
    designRationale: '捕获 React 生态演进信号，作为前端架构决策输入',
    functionalSpec: 'Scanner 分类 + 三态转换 + L1 信息路由',
    dependencies: ['Scanner', 'Binder', 'V-gate'],
    constitutionBindings: ['const-001', 'const-004', 'const-005'],
    sourceRef: 'chronicle/P/P-001.yaml@v2',
  },
}

const mockResources: ResourceData = {
  filePath: 'chronicle/P/P-001.yaml',
  authority: 'A1',
  aiTier: 'T1',
  storage: 2048,
  memoryUsage: undefined,
  dependencies: ['Scanner', 'V-001'],
}

const mockMounts: MountData = {
  aopHooks: [
    { id: 'h1', type: 'pre', target: 'state_transition', active: true },
    { id: 'h2', type: 'post', target: 'classification_change', active: true },
    { id: 'h3', type: 'around', target: 'content_edit', active: false },
  ],
  constitutionBindings: [
    { ruleId: 'const-001', description: 'L0 可读写', status: 'pass' },
    { ruleId: 'const-004', description: '外部来源须声明链', status: 'pass' },
    { ruleId: 'const-005', description: '等待 L0 验证', status: 'pending' },
  ],
  ports: [
    { direction: 'out', target: 'R-001', targetType: 'R', edgeType: 'directed' },
    { direction: 'out', target: 'V-001', targetType: 'V', edgeType: 'signal' },
  ],
  skills: [
    { id: 's1', name: 'WebSearch', type: 'tool', active: true },
    { id: 's2', name: 'Scanner', type: 'compiler', active: true },
  ],
}

const mockPattern: PatternData = {
  id: 'P-001',
  timestamp: Date.now(),
  rawContent: 'React 19 Server Components 允许在服务端渲染组件，减少客户端 JS bundle 大小。这对 Egonetics 的 prvse-world 页面性能优化有直接参考价值。',
  origin: mockProvenance.origin,
  state: 'candidate',
  physical: { resolved: true, value: 'text' },
  level: { resolved: true, value: 'L1' },
  communication: { resolved: false },
  parentId: undefined,
  version: 2,
  frozen: false,
}

const mockRelation: RelationData = {
  id: 'R-001',
  timestamp: Date.now(),
  label: 'PRV Demo 关系图',
  infoLevel: 'L1_conditional',
  viewLevel: 'L1',
  nodes: ['P-001', 'P-002', 'V-001', 'S-001'],
  edges: [
    {
      id: 'e1', sourceNode: 'P-001', targetNode: 'P-002',
      infoLevel: 'L0_logic', edgeType: 'derives', direction: 'one_way',
      certainty: 'deterministic', temporal: 'sequential', strength: 'positive',
      propagation: 'forward', priority: 1, destination: 'R_D1_reasoning',
      logic: 'deductive',
    },
    {
      id: 'e2', sourceNode: 'P-001', targetNode: 'V-001',
      infoLevel: 'L1_conditional', edgeType: 'directed', direction: 'one_way',
      certainty: 'probabilistic', temporal: 'sequential', strength: 'positive',
      propagation: 'forward', priority: 2, destination: 'R_D2_value_calc',
      causal: 'direct_causal',
    },
    {
      id: 'e3', sourceNode: 'V-001', targetNode: 'S-001',
      infoLevel: 'L1_conditional', edgeType: 'constraint', direction: 'one_way',
      certainty: 'deterministic', temporal: 'sequential', strength: 'positive',
      propagation: 'forward', priority: 3, destination: 'R_D4_constraint_check',
    },
    {
      id: 'e4', sourceNode: 'S-001', targetNode: 'P-001',
      infoLevel: 'L2_existential', edgeType: 'signal', direction: 'one_way',
      certainty: 'fuzzy', temporal: 'cyclic', strength: 'positive',
      propagation: 'backward', priority: 4, destination: 'R_D5_activate_node',
      dialectic: 'transform',
    },
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
// Demo Page
// ═══════════════════════════════════════════════════════════════════

export default function PRVDemo() {
  const [pattern, setPattern] = useState(mockPattern)

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      {/* Title */}
      <div className="mb-8">
        <h1 className="text-lg font-semibold text-white/80 font-mono">PRV Demo</h1>
        <p className="text-xs text-white/50 mt-1">
          Pattern · Relation · Value — 三个独立控制论单元 + 三个通用面板
        </p>
      </div>

      {/* P — Pattern */}
      <div>
        <div className="text-xs text-amber-400/50 font-mono mb-2 uppercase tracking-wider">P — Pattern 信息原语</div>
        <PUnit
          data={pattern}
          provenance={mockProvenance}
          resources={mockResources}
          mounts={mockMounts}
          onUpdate={patch => setPattern(p => ({ ...p, ...patch }))}
          onStateTransition={next => setPattern(p => ({ ...p, state: next }))}
          onFork={() => alert('Fork P-001')}
          onFreeze={() => alert('Freeze P-001')}
        />
      </div>

      {/* R — Relation */}
      <div>
        <div className="text-xs text-violet-400/50 font-mono mb-2 uppercase tracking-wider">R — Relation 图结构</div>
        <RUnit
          data={mockRelation}
          provenance={{ ...mockProvenance, chronicle: { ...mockProvenance.chronicle!, designRationale: 'PRV Demo 的关系拓扑', functionalSpec: '展示 PRVSE 循环边和 L 级别递进' } }}
          resources={{ ...mockResources, filePath: 'chronicle/R/R-001.yaml' }}
          mounts={{ ...mockMounts, ports: [
            { direction: 'in', target: 'P-001', targetType: 'P', edgeType: 'directed' },
            { direction: 'out', target: 'V-001', targetType: 'V', edgeType: 'constraint' },
          ]}}
          onFork={() => alert('Fork R-001')}
        />
      </div>

      {/* V — Value */}
      <div>
        <div className="text-xs text-orange-400/50 font-mono mb-2 uppercase tracking-wider">V — Value 裁判</div>
        <VUnit
          data={mockValue}
          provenance={{ ...mockProvenance, chronicle: { ...mockProvenance.chronicle!, designRationale: 'P-001 的入库验证清单', functionalSpec: 'L0 确定性验证 + Reward 评估' } }}
          resources={{ ...mockResources, filePath: 'chronicle/V/V-001.yaml', authority: 'A2' }}
          mounts={{ ...mockMounts, skills: [{ id: 's3', name: 'ChecklistGenerator', type: 'compiler', active: true }] }}
          onFork={() => alert('Fork V-001')}
        />
      </div>
    </div>
  )
}
