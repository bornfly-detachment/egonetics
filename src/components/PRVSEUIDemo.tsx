/**
 * PRVSEUIDemo — PRVSE component library preview page
 * Route: /prvse-ui
 */
import { useState } from 'react'
import { VQueue, type VQueueItem } from '@/design/prvse/V/VQueue'
import { VNotificationCard } from '@/design/prvse/V/VNotificationCard'
import { PInput, type PInputAction } from '@/design/prvse/P/PInput'
import { SStepList, type SStep, type STrigger } from '@/design/prvse/S/SStepList'
import { RGraph, type RNode, type REdge } from '@/design/prvse/R/RGraph'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calendar, Search, Cpu, FileText, BarChart2 } from 'lucide-react'

// ── Sample data ────────────────────────────────────────────────

const QUEUE_ITEMS: VQueueItem[] = [
  {
    id: '1', layer: 'L2', type: 'v_verdict', status: 'pending',
    title: '宪法规则冲突需人工裁决', urgency: 'high',
    description: 'V 评估结果 fail — broker 已累计 3 次拒绝，触发 ForceInterrupt',
    source: 'opencode/kernel-phase6a-runtime · broker.ts',
    timestamp: Date.now() - 120_000,
  },
  {
    id: '2', layer: 'L1', type: 'approval', status: 'pending',
    title: 'PR #12 待审批：Phase 6B Evolution Layer',
    urgency: 'medium',
    description: 'codex 提交 E layer 初始实现，需 CC review 后合并到 main',
    source: 'codex/kernel-phase6b-evolution',
    timestamp: Date.now() - 600_000,
  },
  {
    id: '3', layer: 'L0', type: 'conflict', status: 'pending',
    title: 'T0↔T1 分类冲突：Pattern P-L0-IMPL_ai-call',
    urgency: 'low',
    description: 'T0 预测 L0，T1 预测 L1，需人工标注正确层级',
    source: 'signals/classification_diff',
    timestamp: Date.now() - 1_800_000,
  },
  {
    id: '4', layer: 'L1', type: 'escalation', status: 'approved',
    title: 'T0→T1 升级：自动化 CI 任务',
    urgency: 'low',
    description: 'T0 本地模型失败 10 次，已升级到 T1 MiniMax',
    source: 'executor · run-abc123',
    timestamp: Date.now() - 3_600_000,
  },
]

const PACTIONS: PInputAction[] = [
  { id: 'goal',         label: '设定目标',   icon: <BarChart2 className="w-3.5 h-3.5" />, description: '创建 L2 目标，自动分解为 L1 任务' },
  { id: 'constitution', label: '定义宪法',   icon: <FileText className="w-3.5 h-3.5" />,  description: '建立约束规则，注册 Kernel 合约' },
  { id: 'resource',     label: '配置资源',   icon: <Cpu className="w-3.5 h-3.5" />,       description: '分配 T0/T1/T2 资源配额' },
  { id: 'search',       label: '查询状态',   icon: <Search className="w-3.5 h-3.5" /> },
]

const STEPS: SStep[] = [
  { id: 's1', title: '扫描 Pattern 记录', description: '对比 @prvse 注解与 chronicle/P/*.yaml，输出不匹配清单', status: 'done' },
  { id: 's2', title: '构建 P-R 关系图',  description: '从 P + R 记录生成 pr-graph.json', status: 'done' },
  { id: 's3', title: '校验图完整性',     description: '检查悬空节点、缺失 parent、循环引用', status: 'running' },
  { id: 's4', title: '生成 Kernel 补丁', description: '将通过校验的 Pattern 编译为 Low IR 指令', status: 'pending' },
  { id: 's5', title: '提交 Chronicle',   description: '将本次编译结果追加到 chronicle 历史', status: 'pending' },
]

const TRIGGER: STrigger = {
  label: 'PRVSE Scanner 触发',
  description: '检测到 @prvse 注解变更，自动启动编译流水线',
  icon: <Calendar className="w-4 h-4" />,
}

const GRAPH_NODES: RNode[] = [
  { id: 'start',      type: 'start',     label: 'Start' },
  { id: 'classifier', type: 'agent',     label: 'Classifier', sublabel: 'Agent' },
  { id: 'ifelse',     type: 'condition', label: 'If / else', meta: 'output_parsed.classification == "L0"' },
  { id: 'l0agent',    type: 'agent',     label: 'L0 Agent',  sublabel: 'Agent' },
  { id: 'l1agent',    type: 'agent',     label: 'L1 Agent',  sublabel: 'Agent' },
]

const GRAPH_EDGES: REdge[] = [
  { from: 'start',      to: 'classifier' },
  { from: 'classifier', to: 'ifelse' },
  { from: 'ifelse',     to: 'l0agent', label: 'L0' },
  { from: 'ifelse',     to: 'l1agent', label: 'Else' },
]

// ── Demo page ──────────────────────────────────────────────────

export default function PRVSEUIDemo() {
  const [activeQueueId, setActiveQueueId] = useState<string | undefined>('1')
  const [inputLoading, setInputLoading] = useState(false)

  function handleSubmit(value: string, actionId?: string) {
    console.log('submit', value, actionId)
    setInputLoading(true)
    setTimeout(() => setInputLoading(false), 1500)
  }

  return (
    <div className="min-h-screen bg-neutral-50 p-6">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div className="border-b border-border pb-4">
          <h1 className="text-xl font-semibold text-foreground">PRVSE UI 组件库</h1>
          <p className="text-sm text-muted-foreground mt-1">
            基于 Shadcn/ui — P / R / V / S / E 各层解耦维护
          </p>
        </div>

        <Tabs defaultValue="v">
          <TabsList className="bg-background border border-border">
            <TabsTrigger value="v">V — 裁决队列</TabsTrigger>
            <TabsTrigger value="p">P — 输入</TabsTrigger>
            <TabsTrigger value="s">S — 步骤链</TabsTrigger>
            <TabsTrigger value="r">R — 关系图</TabsTrigger>
          </TabsList>

          {/* V Layer */}
          <TabsContent value="v" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">VQueue — 裁决队列</p>
                <VQueue
                  items={QUEUE_ITEMS}
                  activeId={activeQueueId}
                  onSelect={item => setActiveQueueId(item.id)}
                  className="h-96"
                />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">VNotificationCard — 通知卡片</p>
                <div className="space-y-2">
                  <VNotificationCard
                    id="n1" title="ForceInterrupt 已注册"
                    description="broker 连续 3 次 V=fail，已向 Kernel 注册 ForceInterrupt 合约"
                    timestamp={Date.now() - 60_000} variant="error" layer="L2"
                  />
                  <VNotificationCard
                    id="n2" title="PR #11 已合并到 main"
                    description="Phase 3 Value Layer — L0/L1/L2 checkers + RewardRegistry"
                    timestamp={Date.now() - 3_600_000} variant="success" layer="L1"
                  />
                  <VNotificationCard
                    id="n3" title="T0↔T1 分类冲突待裁定"
                    description="Pattern P-L0-IMPL_ai-call 分类结果不一致，需人工标注"
                    timestamp={Date.now() - 1_800_000} variant="warn" layer="L0"
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* P Layer */}
          <TabsContent value="p" className="mt-6">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">PInput — 自然语言输入 + Action Chips</p>
            <div className="max-w-xl">
              <PInput
                placeholder="描述你的目标、资源配置或宪法规则…"
                actions={PACTIONS}
                loading={inputLoading}
                onSubmit={handleSubmit}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Enter 提交 · Shift+Enter 换行 · 选择 Action Chip 指定模式
            </p>
          </TabsContent>

          {/* S Layer */}
          <TabsContent value="s" className="mt-6">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">SStepList — Trigger + 编号步骤链</p>
            <div className="max-w-lg bg-background border border-border rounded-xl p-6">
              <SStepList trigger={TRIGGER} steps={STEPS} />
            </div>
          </TabsContent>

          {/* R Layer */}
          <TabsContent value="r" className="mt-6">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">RGraph — 分类路由图</p>
            <RGraph nodes={GRAPH_NODES} edges={GRAPH_EDGES} />
          </TabsContent>
        </Tabs>

      </div>
    </div>
  )
}
