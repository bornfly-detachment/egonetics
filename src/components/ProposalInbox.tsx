/**
 * ProposalInbox — SEAI 提议收件箱
 *
 * 订阅 SSE /api/events，实时显示 SEAI 推来的 proposal。
 * 用户可以 approve / reject，结果写回持久层。
 *
 * 使用方式（挂到任意布局）：
 *   import ProposalInbox from '@/components/ProposalInbox'
 *   <ProposalInbox />
 */

import { useEffect, useRef, useState } from 'react'
import { authFetch, getToken } from '@/lib/http'

// ── 类型 ────────────────────────────────────────────────────

interface Proposal {
  id: string
  source: string
  type: string
  entity_id: string
  entity_type: string
  payload: Record<string, unknown>
  conflict_with: Record<string, unknown> | null
  status: 'pending' | 'approved' | 'rejected' | 'auto_applied'
  message: string
  created_at: string
  resolved_at: string | null
}

// ── 标签渲染 ────────────────────────────────────────────────

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  classification: { label: '三问分类', color: '#60a5fa' },
  tag_tree:       { label: '标签树',   color: '#a78bfa' },
  task:           { label: '任务',     color: '#34d399' },
  component:      { label: '组件',     color: '#fbbf24' },
}

const STATUS_STYLES: Record<string, string> = {
  pending:      'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  approved:     'bg-green-500/20  text-green-300  border-green-500/40',
  rejected:     'bg-red-500/20    text-red-300    border-red-500/40',
  auto_applied: 'bg-blue-500/20   text-blue-300   border-blue-500/40',
}

const STATUS_LABELS: Record<string, string> = {
  pending:      '待裁决',
  approved:     '已通过',
  rejected:     '已拒绝',
  auto_applied: '自动应用',
}

// ── 单条 Proposal 卡片 ───────────────────────────────────────

function ProposalCard({ p, onResolve }: { p: Proposal; onResolve: (id: string, action: 'approve' | 'reject') => void }) {
  const [expanded, setExpanded] = useState(false)
  const meta = TYPE_LABELS[p.type] ?? { label: p.type, color: '#9ca3af' }
  const isPending = p.status === 'pending'

  return (
    <div className={`rounded-lg border bg-neutral-900 overflow-hidden transition-all ${isPending ? 'border-yellow-500/30' : 'border-neutral-700'}`}>
      {/* 头部 */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-neutral-800/50"
        onClick={() => setExpanded(e => !e)}
      >
        <span
          className="px-1.5 py-0.5 rounded text-xs font-medium shrink-0"
          style={{ backgroundColor: meta.color + '22', color: meta.color, border: `1px solid ${meta.color}44` }}
        >
          {meta.label}
        </span>
        <span className="text-xs text-neutral-300 flex-1 truncate">
          {p.entity_id}
          {p.message && <span className="text-neutral-500 ml-1">— {p.message}</span>}
        </span>
        {p.conflict_with && (
          <span className="text-xs text-orange-400 shrink-0">⚠ 冲突</span>
        )}
        <span className={`px-1.5 py-0.5 rounded text-xs border shrink-0 ${STATUS_STYLES[p.status]}`}>
          {STATUS_LABELS[p.status]}
        </span>
        <svg className={`w-3 h-3 text-neutral-500 transition-transform shrink-0 ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* 展开详情 */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-neutral-800">
          <div className="grid grid-cols-2 gap-2 mt-2">
            {/* SEAI 提议 */}
            <div>
              <div className="text-xs text-neutral-500 mb-1">SEAI 提议写入</div>
              <pre className="text-xs text-blue-300 bg-neutral-800 rounded p-2 overflow-auto max-h-32">
                {JSON.stringify(p.payload, null, 2)}
              </pre>
            </div>
            {/* 冲突内容 */}
            {p.conflict_with && (
              <div>
                <div className="text-xs text-orange-400 mb-1">当前已有状态（冲突）</div>
                <pre className="text-xs text-orange-300 bg-neutral-800 rounded p-2 overflow-auto max-h-32">
                  {JSON.stringify(p.conflict_with, null, 2)}
                </pre>
              </div>
            )}
          </div>

          <div className="text-xs text-neutral-600">
            {new Date(p.created_at).toLocaleString('zh-CN')}
          </div>

          {/* 裁决按钮 */}
          {isPending && (
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => onResolve(p.id, 'approve')}
                className="flex-1 py-1 rounded text-xs bg-green-600 hover:bg-green-500 text-white transition-colors"
              >
                通过
              </button>
              <button
                onClick={() => onResolve(p.id, 'reject')}
                className="flex-1 py-1 rounded text-xs bg-red-700 hover:bg-red-600 text-white transition-colors"
              >
                拒绝
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── 主组件 ──────────────────────────────────────────────────

export default function ProposalInbox() {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [connected, setConnected] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')
  const [collapsed, setCollapsed] = useState(false)
  const esRef = useRef<EventSource | null>(null)

  // 初始加载
  useEffect(() => {
    loadProposals()
  }, [filter])

  // SSE 订阅
  useEffect(() => {
    const token = getToken()
    const url = token ? `/api/events?token=${token}` : '/api/events'
    // SSE 无法自定义 header，后端通过 query param 或 cookie 鉴权
    const es = new EventSource(url)
    esRef.current = es

    es.onopen = () => setConnected(true)
    es.onerror = () => setConnected(false)

    es.addEventListener('connected', (e) => {
      const d = JSON.parse((e as MessageEvent).data)
      setPendingCount(d.pending || 0)
    })

    es.addEventListener('proposal', (e) => {
      const p: Proposal = JSON.parse((e as MessageEvent).data)
      setProposals(prev => [p, ...prev.filter(x => x.id !== p.id)])
      if (p.status === 'pending') {
        setPendingCount(c => c + 1)
        setCollapsed(false) // 有新提议时自动展开
      }
    })

    es.addEventListener('proposal_resolved', (e) => {
      const { id, action } = JSON.parse((e as MessageEvent).data)
      setProposals(prev => prev.map(p =>
        p.id === id ? { ...p, status: action === 'approve' ? 'approved' : 'rejected' } : p
      ))
      setPendingCount(c => Math.max(0, c - 1))
    })

    return () => { es.close(); esRef.current = null }
  }, [])

  async function loadProposals() {
    try {
      const params = filter === 'pending' ? '?status=pending' : ''
      const data = await authFetch<Proposal[]>(`/proposals${params}`)
      setProposals(data)
      setPendingCount(data.filter(p => p.status === 'pending').length)
    } catch { /* silent */ }
  }

  async function handleResolve(id: string, action: 'approve' | 'reject') {
    try {
      await authFetch(`/proposals/${id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      })
      setProposals(prev => prev.map(p =>
        p.id === id ? { ...p, status: action === 'approve' ? 'approved' : 'rejected', resolved_at: new Date().toISOString() } : p
      ))
      setPendingCount(c => Math.max(0, c - 1))
    } catch (e) {
      console.error('resolve failed', e)
    }
  }

  const displayed = filter === 'pending'
    ? proposals.filter(p => p.status === 'pending')
    : proposals

  return (
    <div className="flex flex-col h-full">
      {/* 标题栏 */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b border-neutral-800 cursor-pointer hover:bg-neutral-800/30"
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-neutral-200">SEAI 消息队列</span>
          {pendingCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-xs bg-yellow-500 text-black font-bold">
              {pendingCount}
            </span>
          )}
          <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-400' : 'bg-neutral-600'}`} title={connected ? '已连接' : '未连接'} />
        </div>
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => setFilter('pending')}
            className={`text-xs px-2 py-0.5 rounded ${filter === 'pending' ? 'bg-neutral-700 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
          >待处理</button>
          <button
            onClick={() => setFilter('all')}
            className={`text-xs px-2 py-0.5 rounded ${filter === 'all' ? 'bg-neutral-700 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
          >全部</button>
          <button onClick={loadProposals} className="text-xs text-neutral-500 hover:text-neutral-300">刷新</button>
        </div>
      </div>

      {/* 列表 */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto space-y-1.5 p-2">
          {displayed.length === 0 ? (
            <div className="text-xs text-neutral-600 text-center py-6">
              {filter === 'pending' ? '暂无待裁决消息' : '暂无消息'}
            </div>
          ) : (
            displayed.map(p => (
              <ProposalCard key={p.id} p={p} onResolve={handleResolve} />
            ))
          )}
        </div>
      )}
    </div>
  )
}
