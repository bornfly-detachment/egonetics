/**
 * sphere-pages — 三球体页面映射（L0/L1/L2 分层）
 *
 * Single source of truth for:
 *   - WorldSpherePanel 的树形视图
 *   - SpherePalette 的 "/" 快捷键面板
 *
 * 每个 page entry 的 component 字段对应 L1Panel 路由键。
 */

export type SphereLayer = 'L0' | 'L1' | 'L2'

export interface SpherePage {
  id: string
  name: string
  color: string
  component: string   // L1Panel component key → used for both embed and route lookup
  layer: SphereLayer
  desc: string
}

export interface SphereEntry {
  id: string
  name: string
  color: string
  pages: SpherePage[]
}

/** Component key → canonical route (for direct navigation) */
export const COMPONENT_ROUTE: Record<string, string> = {
  'kernel':            '/cybernetics',
  'controller-view':   '/controller',
  'queue-view':        '/queue',
  'mq-view':           '/mq',
  'prvse-rules':       '/tag-tree',
  'protocol':          '/protocol',
  'protocol-builder':  '/protocol/builder',
  'egonetics-map':     '/egonetics',
  'constitution-gen':  '/theory',
  'evaluator':         '/queue',
  'theory':            '/theory',
  'lab':               '/lab',
  'recycle':           '/recycle',
  'cybernetics':       '/cybernetics',
  'agents':            '/agents',
  'objective-goals':   '/tasks',
  'memory':            '/memory',
  'chronicle':         '/chronicle',
  'priority':          '/cybernetics',
  'home':              '/home',
  'blog':              '/blog',
  'plan-gen':          '/prvse-world',
  'subjective-goals':  '/egonetics',
  'mq':                '/mq',
}

export const SPHERE_PAGES: SphereEntry[] = [
  // ── 宪法 ────────────────────────────────────────────────────────
  {
    id: 'dim-constitution',
    name: '宪法',
    color: '#ef4444',
    pages: [
      // L0 物理执行层
      { id: 'c-kernel',    name: 'Kernel 物理引擎',   color: '#8b5cf6', layer: 'L0', component: 'kernel',           desc: 'PRVSE 物理引擎·合约验证·tick 驱动' },
      { id: 'c-ctrl',      name: '控制器',             color: '#3b82f6', layer: 'L0', component: 'controller-view',  desc: '感知→决策→行动控制器实现' },
      { id: 'c-queue',     name: '执行队列',           color: '#22c55e', layer: 'L0', component: 'queue-view',       desc: '任务执行队列状态监控与调度' },
      { id: 'c-mq',        name: '消息队列 MQ',        color: '#8b5cf6', layer: 'L0', component: 'mq-view',          desc: '事件驱动消息总线·累积≥3触发 dispatch' },
      // L1 客观规律层
      { id: 'c-prvse',     name: 'PRVSE 规则集',       color: '#6366f1', layer: 'L1', component: 'prvse-rules',      desc: 'P·R·V·S 五层语义标签树·宪法底座' },
      { id: 'c-protocol',  name: '人机协议',           color: '#ec4899', layer: 'L1', component: 'protocol',         desc: 'hm_protocol·交互协议/资源分级/通信机制' },
      { id: 'c-proto-b',   name: '协议构建器',         color: '#db2777', layer: 'L1', component: 'protocol-builder', desc: '可视化协议规则构建与版本管理' },
      { id: 'c-ego-map',   name: '本体图谱 Egonetics', color: '#6366f1', layer: 'L1', component: 'egonetics-map',    desc: 'PRVSE 知识图谱与主体节点关系' },
      // L2 主观认知层
      { id: 'c-const-gen', name: '宪法生成',           color: '#f97316', layer: 'L2', component: 'constitution-gen', desc: '人描述→AI结构化→Kernel 校验→裁决建立' },
      { id: 'c-evaluator', name: '冲突裁决器',         color: '#f97316', layer: 'L2', component: 'evaluator',        desc: '宪法冲突检测·人工裁决队列·升级链终点' },
      { id: 'c-theory',    name: '理论文档 Theory',    color: '#8b5cf6', layer: 'L2', component: 'theory',           desc: '系统理论基础与核心原则文档' },
      { id: 'c-lab',       name: '实验场 Lab',         color: '#06b6d4', layer: 'L2', component: 'lab',              desc: '规则草稿与沙盒实验·不影响正式宪法' },
      { id: 'c-recycle',   name: '回收站',             color: '#4b5563', layer: 'L2', component: 'recycle',          desc: '已删除内容的暂存区·可恢复' },
    ],
  },

  // ── 资源 ────────────────────────────────────────────────────────
  {
    id: 'dim-resources',
    name: '资源',
    color: '#f59e0b',
    pages: [
      // L0 物理层
      { id: 'r-agents',    name: 'Agents 执行节点',     color: '#60a5fa', layer: 'L0', component: 'agents',          desc: 'Agent 执行引擎与节点连接图' },
      { id: 'r-mq',        name: '消息队列 MQ',          color: '#8b5cf6', layer: 'L0', component: 'mq-view',         desc: '事件驱动消息总线·物理通信底层' },
      { id: 'r-queue',     name: '执行队列',             color: '#22c55e', layer: 'L0', component: 'queue-view',      desc: '任务调度执行状态监控' },
      // L1 客观规律层
      { id: 'r-tasks',     name: '任务看板',             color: '#22c55e', layer: 'L1', component: 'objective-goals', desc: '跨状态任务队列·执行中/排队/阻塞/完成' },
      { id: 'r-memory',    name: '记忆/对话历史',        color: '#60a5fa', layer: 'L1', component: 'memory',          desc: 'AI 对话记忆与历史会话管理' },
      { id: 'r-chronicle', name: 'Chronicle 历史',       color: '#fbbf24', layer: 'L1', component: 'chronicle',       desc: '哈希链式不可篡改历史·里程碑/决策/进化' },
      { id: 'r-priority',  name: '优先级调度',           color: '#f97316', layer: 'L1', component: 'priority',        desc: '合约优先级队列·p 值越高执行权越优先' },
      // L2 主观层
      { id: 'r-home',      name: '主页 Dashboard',       color: '#10b981', layer: 'L2', component: 'home',            desc: '系统状态全局仪表盘与快速入口' },
      { id: 'r-blog',      name: 'Blog 思考记录',        color: '#f59e0b', layer: 'L2', component: 'blog',            desc: '主观思考·知识沉淀·学习记录' },
    ],
  },

  // ── 目标 ────────────────────────────────────────────────────────
  {
    id: 'dim-goals',
    name: '目标',
    color: '#22c55e',
    pages: [
      // L1 客观层
      { id: 'g-tasks',      name: '任务看板',             color: '#22c55e', layer: 'L1', component: 'objective-goals', desc: '可度量任务·执行中/队列/阻塞/完成' },
      { id: 'g-lab',        name: '实验场 Lab',           color: '#06b6d4', layer: 'L1', component: 'lab',             desc: '探索性实验·沙盒测试·规则验证' },
      { id: 'g-chronicle',  name: 'Chronicle 历史',       color: '#fbbf24', layer: 'L1', component: 'chronicle',       desc: '哈希链式执行历史·不可篡改' },
      { id: 'g-memory',     name: '记忆 Memory',          color: '#60a5fa', layer: 'L1', component: 'memory',          desc: 'AI 对话记忆·目标相关上下文' },
      // L2 主观层
      { id: 'g-plan',       name: '计划生成',             color: '#06b6d4', layer: 'L2', component: 'plan-gen',        desc: '发散→收敛·从无限可能到有限执行路径' },
      { id: 'g-subjective', name: '主观目标',             color: '#8b5cf6', layer: 'L2', component: 'subjective-goals',desc: '自我进化·身份认同·意义建构' },
      { id: 'g-ego',        name: '主体图谱 Egonetics',   color: '#6366f1', layer: 'L2', component: 'egonetics-map',   desc: '主体性节点与身份认同图谱' },
      { id: 'g-blog',       name: 'Blog 思考记录',        color: '#f59e0b', layer: 'L2', component: 'blog',            desc: '主观目标相关的思考记录' },
    ],
  },
]

export const LAYER_INFO: Record<SphereLayer, { label: string; color: string }> = {
  L0: { label: 'L0  物理执行层', color: '#94a3b8' },
  L1: { label: 'L1  客观规律层', color: '#7dd3fc' },
  L2: { label: 'L2  主观认知层', color: '#a78bfa' },
}
