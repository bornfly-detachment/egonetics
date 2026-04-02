/**
 * useControlTree — Builds the 3-layer human control tree for PRVSE World
 *
 * 权威序列：L3 > L2 > L1（序列越高权限越高）
 *
 *   L3 — 世界层 (3 根节点, 入口, 最高权威):
 *     宪法 — AI+控制论的约束框架，规则的来源
 *     资源 — 智能/机器/通信/权限四层资源
 *     目标 — 客观目标 + 主观目标 = 两大矛盾收敛
 *
 *   L2 — 控制论过程层 (协议·PRVSE·引擎·队列·冲突·优先级):
 *     Kernel物理引擎 / PRVSE规则集 / 协议层 /
 *     冲突裁决 / 优先级调度 / 任务队列 / 消息队列
 *
 *   L1 — 粒度层 (最细粒度可视化):
 *     每个Task实现 / 探索性实验与指令 / 测试 / 历史记录
 */

import { useState, useCallback } from 'react'
import { authFetch } from '@/lib/http'

export interface ControlNode {
  id: string
  name: string
  color: string
  select_mode: 'single' | 'multi'
  children?: ControlNode[]
  meta?: Record<string, unknown>
}

// ── Colors ─────────────────────────────────────────────────────

const C = {
  constitution: '#ef4444',
  resources: '#f59e0b',
  goals: '#22c55e',
  kernel: '#8b5cf6',
  controller: '#3b82f6',
  sensor: '#06b6d4',
  evaluator: '#f97316',
  constGen: '#ec4899',
  resourceConsole: '#eab308',
  taskPanel: '#10b981',
  t0: '#34d399',
  t1: '#60a5fa',
  t2: '#a78bfa',
  mq: '#8b5cf6',
  running: '#3b82f6',
  done: '#22c55e',
  blocked: '#ef4444',
  pending: '#6b7280',
  principles: '#ef4444',
  rules: '#f97316',
  objective: '#22c55e',
  subjective: '#8b5cf6',
  compute: '#f59e0b',
}

// ── API types ──────────────────────────────────────────────────

interface TaskRow { id: string; title: string; column_id: string }
interface ExecRun { id: string; task_id: string; status: string; current_tier: string; api_calls: number }
interface MQStat { channel: string; event_type: string; tier: string; count: number }
interface KernelState { tick: number; contracts: { id: string; type: string; priority: number }[] }
interface SEAIHealth { available: boolean }
interface QueueCounts { L0: number; L1: number; L2: number; L3: number; total: number }

// ── L1: 宪法 ──────────────────────────────────────────────────

function buildConstitutionRoot(
  kernel: KernelState | null,
  runs: ExecRun[],
): ControlNode {
  const contracts = kernel?.contracts ?? []
  const escalated = runs.filter(r => r.status === 'escalated')
  const tick = kernel?.tick ?? 0

  return {
    id: 'dim-constitution',
    name: '宪法',
    color: C.constitution,
    select_mode: 'single',
    meta: { type: 'dimension', desc: 'AI与控制论系统的约束框架。违反即审计告警。' },
    children: [
      // L2-①: Kernel 物理引擎
      {
        id: 'mid-kernel',
        name: `Kernel 物理引擎 (tick ${tick})`,
        color: C.kernel,
        select_mode: 'single',
        meta: { type: 'cybernetics', component: 'kernel', layer: 'L0', desc: 'PRVSE 物理引擎。合约验证、tick驱动、感知器/控制器/测评器调度。' },
        children: contracts.map(c => ({
          id: `contract-${c.id}`,
          name: `${c.id} (p:${c.priority})`,
          color: C.rules,
          select_mode: 'single' as const,
          meta: { type: 'contract', contractId: c.id, priority: c.priority },
        })),
      },
      // L2-②: PRVSE 规则集（TAG TREE）
      {
        id: 'mid-prvse-rules',
        name: 'PRVSE 规则集',
        color: '#6366f1',
        select_mode: 'single',
        meta: { type: 'cybernetics', component: 'prvse-rules', layer: 'L1', desc: 'P(模式) · R(关系) · V(价值) · S(状态) 五层标签树。宪法的语义底座。' },
        children: [
          { id: 'prvse-l0', name: 'L0 物理感知', color: '#6366f1', select_mode: 'single', meta: { type: 'principle', desc: '原始信号层 — 感知器直接采集' } },
          { id: 'prvse-l1', name: 'L1 可验证规律', color: '#818cf8', select_mode: 'single', meta: { type: 'principle', desc: '可测量、可重复的规律层' } },
          { id: 'prvse-l2', name: 'L2 认知判断', color: '#a5b4fc', select_mode: 'single', meta: { type: 'principle', desc: '基于上下文的主观判断层' } },
        ],
      },
      // L2-③: 协议层（hm_protocol）
      {
        id: 'mid-protocol',
        name: '协议层 hm_protocol',
        color: C.constGen,
        select_mode: 'single',
        meta: { type: 'cybernetics', component: 'protocol', layer: 'L1', desc: '人机协议规则集。三层架构：交互协议 / 资源分级 / 通信机制。' },
        children: [
          { id: 'proto-interaction', name: '交互协议 L0/L1/L2', color: C.constGen, select_mode: 'single', meta: { type: 'principle', desc: 'L0直连 / L1异步 / L2代理协调' } },
          { id: 'proto-resource-tier', name: '资源分级 T0/T1/T2', color: C.t1, select_mode: 'single', meta: { type: 'principle', desc: 'T0本地 / T1云端 / T2专家' } },
          { id: 'proto-components', name: '组件库', color: '#94a3b8', select_mode: 'single', meta: { type: 'principle', desc: '可复用协议组件集合' } },
        ],
      },
      // L2-④: 宪法生成 (Build Mode 入口)
      {
        id: 'mid-const-gen',
        name: '宪法生成',
        color: C.rules,
        select_mode: 'single',
        meta: { type: 'cybernetics', component: 'constitution-gen', layer: 'L2', desc: '人描述 → AI结构化(PRVSE IR) → Kernel校验 → 裁决 → 建立。' },
        children: [
          { id: 'const-p-design-first', name: '先设计后编码', color: C.principles, select_mode: 'single', meta: { type: 'principle' } },
          { id: 'const-p-accumulate', name: '积累≥3再行动', color: C.principles, select_mode: 'single', meta: { type: 'principle' } },
          { id: 'const-p-think-three', name: '三思而后行', color: C.principles, select_mode: 'single', meta: { type: 'principle' } },
          { id: 'const-p-crud', name: 'CRUD铁律', color: C.principles, select_mode: 'single', meta: { type: 'principle' } },
        ],
      },
      // L2-⑤: 冲突裁决器
      {
        id: 'mid-evaluator',
        name: `冲突裁决器 (${escalated.length} 待裁决)`,
        color: C.evaluator,
        select_mode: 'single',
        meta: { type: 'cybernetics', component: 'evaluator', layer: 'L2', desc: '宪法冲突检测 + 人工裁决队列。升级链终点。' },
        children: escalated.map(r => ({
          id: `audit-${r.id}`,
          name: `${r.task_id} — 等待裁决`,
          color: C.principles,
          select_mode: 'single' as const,
          meta: { type: 'decision', runId: r.id, taskId: r.task_id },
        })),
      },

      // ── 补全：宪法相关全系统页面入口 ──────────────────────────

      // L0 追加
      { id: 'mid-controller',  name: '控制器',     color: C.controller, select_mode: 'single',
        meta: { type: 'cybernetics', component: 'controller-view', layer: 'L0', desc: '感知→决策→行动控制器实现' } },
      { id: 'mid-queue-view',  name: '执行队列',   color: C.running,    select_mode: 'single',
        meta: { type: 'cybernetics', component: 'queue-view',      layer: 'L0', desc: '任务执行队列状态监控' } },
      { id: 'mid-mq-view',     name: '消息队列 MQ', color: C.mq,        select_mode: 'single',
        meta: { type: 'cybernetics', component: 'mq-view',         layer: 'L0', desc: '事件驱动消息总线' } },

      // L1 追加
      { id: 'mid-protocol-builder', name: '协议构建器',      color: C.constGen,  select_mode: 'single',
        meta: { type: 'cybernetics', component: 'protocol-builder', layer: 'L1', desc: '可视化协议规则构建' } },
      { id: 'mid-egonetics-map',    name: '本体图谱 Egonetics', color: '#6366f1', select_mode: 'single',
        meta: { type: 'cybernetics', component: 'egonetics-map',    layer: 'L1', desc: 'PRVSE 知识图谱与主体节点关系' } },

      // L2 追加
      { id: 'mid-theory-docs', name: '理论文档 Theory', color: '#8b5cf6', select_mode: 'single',
        meta: { type: 'cybernetics', component: 'theory',   layer: 'L2', desc: '系统理论基础与原则文档' } },
      { id: 'mid-recycle',     name: '回收站',          color: '#4b5563', select_mode: 'single',
        meta: { type: 'cybernetics', component: 'recycle',  layer: 'L2', desc: '已删除内容的暂存区，可恢复' } },
    ],
  }
}

// ── L3: 资源 ──────────────────────────────────────────────────

function buildResourceRoot(
  seaiHealth: boolean,
  runs: ExecRun[],
  mqStats: MQStat[],
  contracts: { id: string; type: string; priority: number }[],
  tasks: TaskRow[],
  queueCounts: QueueCounts,
): ControlNode {
  const tierRuns = (tier: string) => runs.filter(r => r.current_tier === tier && r.status === 'running')

  return {
    id: 'dim-resources',
    name: '资源',
    color: C.resources,
    select_mode: 'single',
    meta: { type: 'dimension', desc: '一切可调配资源的统一视图。智能/优先级/队列/机器/权限全局控制台。' },
    children: [
      // 1. 智能资源分级
      {
        id: 'mid-intelligence',
        name: '智能资源分级',
        color: C.t1,
        select_mode: 'single',
        meta: { type: 'resource-group', layer: 'L0', desc: 'T0本地 → T1云端 → T2专家。按任务复杂度自动分级调度。' },
        children: [
          {
            id: 'res-t0',
            name: `T0 SEAI 本地 ${seaiHealth ? '● online' : '○ offline'}`,
            color: C.t0,
            select_mode: 'single',
            meta: { type: 'resource-tier', tier: 'T0', available: seaiHealth, desc: '本地部署，延迟最低，零成本，离线可用。' },
            children: tierRuns('T0').map(r => ({
              id: `run-t0-${r.id}`,
              name: `执行中: ${r.task_id}`,
              color: C.t0,
              select_mode: 'single' as const,
              meta: { type: 'execution', tier: 'T0' },
            })),
          },
          {
            id: 'res-t1',
            name: `T1 MiniMax ${tierRuns('T1').length > 0 ? `(${tierRuns('T1').length} running)` : '● 待机'}`,
            color: C.t1,
            select_mode: 'single',
            meta: { type: 'resource-tier', tier: 'T1', desc: '云端推理，高并发，中等成本，兼容 Anthropic 协议。' },
            children: tierRuns('T1').map(r => ({
              id: `run-t1-${r.id}`,
              name: `${r.task_id} (${r.api_calls} calls)`,
              color: C.t1,
              select_mode: 'single' as const,
              meta: { type: 'execution', tier: 'T1', calls: r.api_calls },
            })),
          },
          {
            id: 'res-t2',
            name: `T2 Claude ${tierRuns('T2').length > 0 ? `(${tierRuns('T2').length} running)` : '● 待机'}`,
            color: C.t2,
            select_mode: 'single',
            meta: { type: 'resource-tier', tier: 'T2', desc: '顶级专家模型，最高质量，最高成本，人类决策升级链终点。' },
            children: tierRuns('T2').map(r => ({
              id: `run-t2-${r.id}`,
              name: `${r.task_id} (${r.api_calls} calls)`,
              color: C.t2,
              select_mode: 'single' as const,
              meta: { type: 'execution', tier: 'T2', calls: r.api_calls },
            })),
          },
        ],
      },
      // 2. 优先级调度
      {
        id: 'mid-priority',
        name: `优先级调度 (${contracts.length} contracts)`,
        color: C.evaluator,
        select_mode: 'single',
        meta: { type: 'resource-group', layer: 'L1', desc: '合约优先级队列。p值越高执行权越优先。Kernel tick时按优先级dispatch。' },
        children: contracts
          .sort((a, b) => b.priority - a.priority)
          .slice(0, 10)
          .map(c => ({
            id: `prio-${c.id}`,
            name: `${c.id} · p:${c.priority} [${c.type}]`,
            color: c.priority >= 80 ? C.blocked : c.priority >= 50 ? C.evaluator : C.pending,
            select_mode: 'single' as const,
            meta: { type: 'contract', contractId: c.id, priority: c.priority },
          })),
      },
      // 3. 任务队列
      {
        id: 'mid-task-queue',
        name: `任务队列 (${tasks.filter(t => t.column_id === 'todo' || t.column_id === 'backlog' || t.column_id === 'in-progress').length} active)`,
        color: C.running,
        select_mode: 'single',
        meta: { type: 'resource-group', component: 'objective-goals', layer: 'L1', desc: '跨状态任务队列视图。执行中/排队/阻塞的全局状态。' },
        children: tasks.slice(0, 15).map(t => ({
          id: `tq-${t.id}`,
          name: t.title || t.id,
          color: t.column_id === 'in-progress' || t.column_id === 'doing' ? C.running
            : t.column_id === 'blocked' ? C.blocked
            : t.column_id === 'done' ? C.done
            : C.pending,
          select_mode: 'single' as const,
          meta: { type: 'task', taskId: t.id, status: t.column_id },
        })),
      },
      // 4. 消息队列 MQ
      {
        id: 'mid-mq-ctrl',
        name: `消息队列 MQ (${mqStats.reduce((s, m) => s + m.count, 0)} pending)`,
        color: C.mq,
        select_mode: 'single',
        meta: { type: 'comm-node', commType: 'mq', layer: 'L0', desc: '事件驱动通信。累积≥3条触发 Kernel 自动 dispatch。' },
        children: mqStats.map(m => ({
          id: `mqc-${m.channel}-${m.event_type}`,
          name: `${m.channel}:${m.event_type} ×${m.count}`,
          color: m.count >= 3 ? C.blocked : C.mq,
          select_mode: 'single' as const,
          meta: { type: 'mq', channel: m.channel, event_type: m.event_type, count: m.count },
        })),
      },
      // 5. 机器节点（物理设备）
      {
        id: 'mid-machines',
        name: '机器',
        color: C.compute,
        select_mode: 'single',
        meta: { type: 'resource-group', layer: 'L0', desc: '所有物理计算设备。服务器提供算力，终端设备提供交互入口。' },
        children: [
          {
            id: 'machine-server',
            name: '服务器',
            color: C.compute,
            select_mode: 'single',
            meta: { type: 'machine', machineType: 'server', desc: 'Egonetics 后端 + SEAI 推理节点。Port 3002/8000。' },
          },
          {
            id: 'machine-desktop',
            name: '电脑',
            color: '#94a3b8',
            select_mode: 'single',
            meta: { type: 'machine', machineType: 'desktop', desc: '主要开发/操控终端。Claude Code 运行在此。' },
          },
          {
            id: 'machine-phone',
            name: '手机',
            color: '#64748b',
            select_mode: 'single',
            meta: { type: 'machine', machineType: 'phone', desc: '移动端访问节点。随时随地查看任务状态。' },
          },
          {
            id: 'machine-pad',
            name: 'Pad',
            color: '#475569',
            select_mode: 'single',
            meta: { type: 'machine', machineType: 'pad', desc: '平板端，适合阅读/审批场景。' },
          },
        ],
      },
      // 6. 通信接口
      {
        id: 'mid-comms',
        name: '通信接口',
        color: C.sensor,
        select_mode: 'single',
        meta: { type: 'resource-group', layer: 'L0', desc: 'API层 + Webhook外部事件入口。统一连接人/AI/系统。' },
        children: [
          {
            id: 'comm-api',
            name: 'REST API /api/*',
            color: C.controller,
            select_mode: 'single',
            meta: { type: 'comm-node', commType: 'api', desc: 'REST /api/* + Anthropic 兼容 SDK。前后端统一入口。' },
          },
          {
            id: 'comm-webhook',
            name: 'Webhook / 外部事件',
            color: '#7c3aed',
            select_mode: 'single',
            meta: { type: 'comm-node', commType: 'webhook', desc: '接收外部系统事件，转化为 PRVSE MQ 消息。' },
          },
        ],
      },
      // 7. 存储分级（命名与 server/data/ 目录 + DB 文件完全一致）
      {
        id: 'mid-storage',
        name: '存储分级',
        color: '#64748b',
        select_mode: 'single',
        meta: { type: 'resource-group', layer: 'L1', desc: 'L0物理信号 → L1客观规律 → L2主观认知 → L3主体性。DB + 本地文件按层隔离。' },
        children: [
          {
            id: 'storage-l0-signals',
            name: 'L0  signals.db  /data/L0/',
            color: '#94a3b8',
            select_mode: 'single',
            meta: { type: 'storage', layer: 'L0', db: 'signals.db', dir: 'server/data/L0/', desc: '原始信号流 + 未处理池 + 分类冲突 + 训练数据结构' },
          },
          {
            id: 'storage-l1-patterns',
            name: 'L1  pages.db  /data/L1/',
            color: '#7dd3fc',
            select_mode: 'single',
            meta: { type: 'storage', layer: 'L1', db: 'pages.db (L1 tables)', dir: 'server/data/L1/', desc: '规则集 / 分类模式 / 确认的客观规律' },
          },
          {
            id: 'storage-l2-cognition',
            name: 'L2  memory.db  /data/L2/',
            color: '#a78bfa',
            select_mode: 'single',
            meta: { type: 'storage', layer: 'L2', db: 'memory.db', dir: 'server/data/L2/', desc: '对话历史 / 用户记忆 / Chronicle / 主观解读' },
          },
          {
            id: 'storage-l3-subjectivity',
            name: 'L3  pages.db  /data/L3/',
            color: '#f59e0b',
            select_mode: 'single',
            meta: { type: 'storage', layer: 'L3', db: 'pages.db (L3 tables)', dir: 'server/data/L3/', desc: '宪法节点 / PRVS公理集 / 身份 / 目标（仅追加）' },
          },
        ],
      },

      // 8. 人工处理队列（收件箱）
      {
        id: 'mid-human-queue',
        name: `人工队列  ${queueCounts.total > 0 ? `● ${queueCounts.total}` : '○ 清空'}`,
        color: queueCounts.total > 0 ? '#f87171' : '#4b5563',
        select_mode: 'single',
        meta: { type: 'resource-group', layer: 'L2', desc: 'P三问失败 / T0↔T1冲突 / 超时升级。需人工裁定后才能进入控制论系统。' },
        children: [
          {
            id: 'hq-l0',
            name: `L0  物理信号  ${queueCounts.L0 > 0 ? `● ${queueCounts.L0}` : '○'}`,
            color: queueCounts.L0 > 0 ? '#f87171' : '#4b5563',
            select_mode: 'single',
            meta: { type: 'queue', layer: 'L0', count: queueCounts.L0 },
          },
          {
            id: 'hq-l1',
            name: `L1  客观规律  ${queueCounts.L1 > 0 ? `● ${queueCounts.L1}` : '○'}`,
            color: queueCounts.L1 > 0 ? '#fb923c' : '#4b5563',
            select_mode: 'single',
            meta: { type: 'queue', layer: 'L1', count: queueCounts.L1 },
          },
          {
            id: 'hq-l2',
            name: `L2  主观认知  ${queueCounts.L2 > 0 ? `● ${queueCounts.L2}` : '○'}`,
            color: queueCounts.L2 > 0 ? '#a78bfa' : '#4b5563',
            select_mode: 'single',
            meta: { type: 'queue', layer: 'L2', count: queueCounts.L2 },
          },
        ],
      },

      // 9. 权限
      {
        id: 'mid-permissions',
        name: '权限',
        color: C.principles,
        select_mode: 'single',
        meta: { type: 'resource-group', layer: 'L2', desc: '三角色权限矩阵。admin/agent/guest 对资源和操作的访问控制。' },
        children: [
          {
            id: 'perm-admin',
            name: 'admin — 全权',
            color: C.principles,
            select_mode: 'single',
            meta: { type: 'permission', role: 'admin', desc: '所有路由、所有变更。仅 CLI 注册。JWT 24h。' },
          },
          {
            id: 'perm-agent',
            name: 'agent — 执行权',
            color: C.evaluator,
            select_mode: 'single',
            meta: { type: 'permission', role: 'agent', desc: '执行任务/写回数据。禁止用户管理。JWT 30d。' },
          },
          {
            id: 'perm-guest',
            name: 'guest — 只读',
            color: C.pending,
            select_mode: 'single',
            meta: { type: 'permission', role: 'guest', desc: '仅读取公开视图。邮箱验证注册。JWT 24h。' },
          },
        ],
      },
    ],
  }
}

// ── L3: 目标 ──────────────────────────────────────────────────
// 体现两大矛盾：无限→有限, 失控→可控

function buildGoalRoot(tasks: TaskRow[], runs: ExecRun[]): ControlNode {
  const running = tasks.filter(t => t.column_id === 'in-progress' || t.column_id === 'doing')
  const queued = tasks.filter(t => t.column_id === 'todo' || t.column_id === 'backlog')
  const blocked = tasks.filter(t => t.column_id === 'blocked')
  const done = tasks.filter(t => t.column_id === 'done')
  const activeRuns = runs.filter(r => r.status === 'running' || r.status === 'escalated')

  return {
    id: 'dim-goals',
    name: '目标',
    color: C.goals,
    select_mode: 'single',
    meta: {
      type: 'dimension',
      desc: '无限→有限：从无限可能收敛到有限可行。失控→可控：从不确定收敛到确定。',
    },
    children: [
      // L2-① 计划生成 — 发散/收敛核心入口
      {
        id: 'mid-plan-gen',
        name: '计划生成',
        color: '#06b6d4',
        select_mode: 'single',
        meta: {
          type: 'cybernetics',
          component: 'plan-gen',
          layer: 'L2',
          desc: '从目标发散出多个方案 → 用户选择 → 收敛锁定执行路径。点击面板中 ⎇ 图标进入发散/收敛模式。',
        },
        children: [],
      },
      // L2-② 客观目标 — 有限 + 可控：可度量的任务和交付物
      {
        id: 'mid-objective',
        name: `客观目标 · 有限可控 (${tasks.length - done.length} active)`,
        color: C.objective,
        select_mode: 'single',
        meta: { type: 'cybernetics', component: 'objective-goals', layer: 'L1', desc: '无限→有限：收敛为可度量的任务' },
        children: [
          {
            id: 'task-running',
            name: `执行中 (${running.length + activeRuns.length})`,
            color: C.running,
            select_mode: 'single',
            children: [
              ...running.map(t => ({
                id: `task-${t.id}`,
                name: t.title || t.id,
                color: C.running,
                select_mode: 'single' as const,
                meta: { type: 'task', status: t.column_id, taskId: t.id },
              })),
              ...activeRuns.map(r => ({
                id: `run-active-${r.id}`,
                name: `${r.current_tier} → ${r.task_id}`,
                color: C.t2,
                select_mode: 'single' as const,
                meta: { type: 'execution', tier: r.current_tier, calls: r.api_calls },
              })),
            ],
          },
          {
            id: 'task-queue',
            name: `队列 (${queued.length})`,
            color: C.pending,
            select_mode: 'single',
            children: queued.slice(0, 20).map(t => ({
              id: `task-${t.id}`,
              name: t.title || t.id,
              color: C.pending,
              select_mode: 'single' as const,
              meta: { type: 'task', status: t.column_id, taskId: t.id },
            })),
          },
          {
            id: 'task-blocked',
            name: `阻塞 (${blocked.length})`,
            color: C.blocked,
            select_mode: 'single',
            children: blocked.map(t => ({
              id: `task-${t.id}`,
              name: t.title || t.id,
              color: C.blocked,
              select_mode: 'single' as const,
              meta: { type: 'task', status: 'blocked', taskId: t.id },
            })),
          },
          {
            id: 'task-done',
            name: `完成 (${done.length})`,
            color: C.done,
            select_mode: 'single',
            children: done.slice(0, 15).map(t => ({
              id: `task-${t.id}`,
              name: t.title || t.id,
              color: C.done,
              select_mode: 'single' as const,
              meta: { type: 'task', status: 'done', taskId: t.id },
            })),
          },
        ],
      },
      // 主观目标 — 无限 + 失控→可控：自我进化、身份认同
      {
        id: 'mid-subjective',
        name: '主观目标 · 失控→可控',
        color: C.subjective,
        select_mode: 'single',
        meta: { type: 'cybernetics', component: 'subjective-goals', layer: 'L2', desc: '失控→可控：自我进化、身份认同、意义建构' },
        children: [
          {
            id: 'goal-self-evolution',
            name: '自我进化',
            color: C.subjective,
            select_mode: 'single',
            meta: { type: 'goal', desc: 'Chronicle记录→模式识别→行为修正' },
          },
          {
            id: 'goal-identity',
            name: '身份认同',
            color: C.subjective,
            select_mode: 'single',
            meta: { type: 'goal', desc: 'Egonetics核心：Ego+Cybernetics对齐' },
          },
        ],
      },
      // L1 粒度入口 — 实验场
      {
        id: 'mid-lab',
        name: '实验场 Lab',
        color: '#06b6d4',
        select_mode: 'single',
        meta: { type: 'cybernetics', component: 'lab', layer: 'L1', desc: '探索性实验与指令测试。沙盒环境，不影响正式宪法。' },
        children: [
          { id: 'lab-prompt', name: 'Prompt 实验', color: '#06b6d4', select_mode: 'single', meta: { type: 'goal', desc: '测试 AI 指令和响应的沙盒' } },
          { id: 'lab-rule', name: '规则草稿', color: '#22d3ee', select_mode: 'single', meta: { type: 'goal', desc: '尚未验证的宪法候选规则' } },
          { id: 'lab-trace', name: '执行追踪', color: '#67e8f9', select_mode: 'single', meta: { type: 'goal', desc: 'T0→T1→T2 升级链的完整追踪' } },
        ],
      },
      // L1 粒度入口 — 历史
      {
        id: 'mid-chronicle',
        name: '历史 Chronicle',
        color: '#f59e0b',
        select_mode: 'single',
        meta: { type: 'cybernetics', component: 'chronicle', layer: 'L1', desc: '哈希链式不可篡改历史。记录每次决策、里程碑、进化事件。' },
        children: [
          { id: 'chrono-milestone', name: '里程碑', color: '#fbbf24', select_mode: 'single', meta: { type: 'goal', desc: '用户标记的重要节点' } },
          { id: 'chrono-decision', name: '决策记录', color: '#f59e0b', select_mode: 'single', meta: { type: 'goal', desc: '人工裁决和方向确认' } },
          { id: 'chrono-evolution', name: '进化事件', color: '#d97706', select_mode: 'single', meta: { type: 'goal', desc: '自动记录的系统变化事件' } },
        ],
      },
    ],
  }
}

// ── Tree Mutation Types ─────────────────────────────────────────

export type TreeMutation =
  | { op: 'addNode';    parentId: string; node: ControlNode }
  | { op: 'updateNode'; id: string;       changes: Partial<ControlNode> }
  | { op: 'removeNode'; id: string }

function addNodeToTree(node: ControlNode, parentId: string, newNode: ControlNode): ControlNode {
  if (node.id === parentId) {
    return { ...node, children: [...(node.children ?? []), newNode] }
  }
  if (!node.children) return node
  return { ...node, children: node.children.map(c => addNodeToTree(c, parentId, newNode)) }
}

function updateNodeInTree(node: ControlNode, id: string, changes: Partial<ControlNode>): ControlNode {
  if (node.id === id) return { ...node, ...changes }
  if (!node.children) return node
  return { ...node, children: node.children.map(c => updateNodeInTree(c, id, changes)) }
}

function removeNodeFromTree(node: ControlNode, id: string): ControlNode {
  return {
    ...node,
    children: (node.children ?? [])
      .filter(c => c.id !== id)
      .map(c => removeNodeFromTree(c, id)),
  }
}

export function applyMutationsToTree(tree: ControlNode[], mutations: TreeMutation[]): ControlNode[] {
  let result = tree
  for (const m of mutations) {
    if (m.op === 'addNode') {
      result = result.map(root => addNodeToTree(root, m.parentId, m.node))
    } else if (m.op === 'updateNode') {
      result = result.map(root => updateNodeInTree(root, m.id, m.changes))
    } else if (m.op === 'removeNode') {
      result = result.map(root => removeNodeFromTree(root, m.id))
    }
  }
  return result
}

// ── Hook ────────────────────────────────────────────────────────

export function useControlTree() {
  const [tree, setTree] = useState<ControlNode[]>([])
  const [loading, setLoading] = useState(false)

  const loadTree = useCallback(async () => {
    setLoading(true)
    try {
      const [tasks, runs, mqStats, kernelState, seaiHealth, queueData] = await Promise.all([
        authFetch<{ tasks: TaskRow[] }>('/tasks').then(r => r.tasks ?? []).catch(() => [] as TaskRow[]),
        authFetch<ExecRun[]>('/kernel/executions').catch(() => [] as ExecRun[]),
        authFetch<MQStat[]>('/mq/stats').catch(() => [] as MQStat[]),
        authFetch<KernelState>('/kernel/state').catch(() => null),
        authFetch<SEAIHealth>('/kernel/seai/health').catch(() => ({ available: false })),
        authFetch<{ counts: QueueCounts; total: number }>('/signals/queue/counts').catch(() => ({ counts: { L0: 0, L1: 0, L2: 0, L3: 0 }, total: 0 })),
      ])

      const contracts = kernelState?.contracts ?? []
      const queueCounts: QueueCounts = { ...(queueData.counts ?? { L0: 0, L1: 0, L2: 0, L3: 0 }), total: queueData.total ?? 0 }

      setTree([
        buildConstitutionRoot(kernelState, runs),
        buildResourceRoot(seaiHealth.available, runs, mqStats, contracts, tasks, queueCounts),
        buildGoalRoot(tasks, runs),
      ])
    } catch {
      setTree([
        { id: 'dim-constitution', name: '宪法', color: C.constitution, select_mode: 'single', children: [] },
        { id: 'dim-resources', name: '资源', color: C.resources, select_mode: 'single', children: [] },
        { id: 'dim-goals', name: '目标', color: C.goals, select_mode: 'single', children: [] },
      ])
    }
    setLoading(false)
  }, [])

  const applyMutations = (mutations: TreeMutation[]) => {
    setTree(prev => applyMutationsToTree(prev, mutations))
  }

  return { tree, setTree, loading, loadTree, applyMutations }
}
