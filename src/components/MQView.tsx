/**
 * MQView — Message Queue 实时消息流
 *
 * 三栏布局：
 *   左 — 频道列表 + 计数，点击过滤
 *   中 — 消息流（最新在上），自动轮询
 *   右 — 选中消息的 payload 展开
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { Activity, RefreshCw, Circle, ChevronRight } from 'lucide-react'
import { authFetch } from '@/lib/http'

// ── Types ─────────────────────────────────────────────────────

interface MQMessage {
  id: string
  channel: string
  event_type: string
  tier: string
  payload: Record<string, unknown>
  source_id: string | null
  status: string
  created_at: string
}

interface MQStats {
  channel: string
  count: number
  pending: number
  latest: string
}

// ── Channel color map ──────────────────────────────────────────

const CHANNEL_COLORS: Record<string, string> = {
  'autonomous-execution': '#a78bfa',
  'task-execution':       '#34d399',
  'task-state':           '#60a5fa',
  'task':                 '#60a5fa',
  'controller-actions':   '#f59e0b',
  'kernel':               '#e879f9',
  'perceiver-resource':   '#2dd4bf',
  'builder':              '#fb923c',
}

function channelColor(ch: string): string {
  return CHANNEL_COLORS[ch] ?? '#94a3b8'
}

const TIER_COLORS: Record<string, string> = {
  T0: '#34d399', T1: '#60a5fa', T2: '#a78bfa', human: '#f59e0b',
}

// ── Helpers ───────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso + (iso.includes('Z') ? '' : 'Z')).getTime()
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return new Date(iso).toLocaleDateString()
}

function StatusDot({ status }: { status: string }) {
  const color = status === 'pending' ? '#f59e0b' : status === 'resolved' ? '#34d399' : '#60a5fa'
  return <Circle size={6} fill={color} stroke="none" style={{ color }} />
}

// ── Main Component ────────────────────────────────────────────

export default function MQView() {
  const [messages, setMessages] = useState<MQMessage[]>([])
  const [stats, setStats] = useState<MQStats[]>([])
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null)
  const [selectedMsg, setSelectedMsg] = useState<MQMessage | null>(null)
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [msgs, st] = await Promise.all([
        authFetch<MQMessage[]>(`/mq/messages?limit=200${selectedChannel ? `&channel=${selectedChannel}` : ''}`),
        authFetch<MQStats[]>('/mq/stats'),
      ])
      setMessages(msgs)
      setStats(st)
      setLastRefresh(new Date())
    } catch {
      // silently fail on poll
    } finally {
      setLoading(false)
    }
  }, [selectedChannel])

  // initial + channel change
  useEffect(() => {
    setLoading(true)
    fetchData()
  }, [fetchData])

  // auto-refresh
  useEffect(() => {
    if (!autoRefresh) { if (timerRef.current) clearInterval(timerRef.current); return }
    timerRef.current = setInterval(fetchData, 4000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [autoRefresh, fetchData])

  // deselect msg if not in current list
  useEffect(() => {
    if (selectedMsg && !messages.find(m => m.id === selectedMsg.id)) setSelectedMsg(null)
  }, [messages, selectedMsg])

  const allChannels = Array.from(new Set(stats.map(s => s.channel))).sort()
  const totalCount = stats.reduce((s, r) => s + r.count, 0)

  return (
    <div className="flex h-full bg-[#080809] text-white/80 overflow-hidden">

      {/* ── Left: Channel sidebar ─────────────────────────── */}
      <div className="w-52 shrink-0 border-r border-white/[0.06] flex flex-col">
        <div className="px-4 py-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Activity size={13} className="text-purple-400/70" />
            <span className="text-[11px] font-mono text-white/50 uppercase tracking-wider">MQ 频道</span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {/* All */}
          <button
            onClick={() => setSelectedChannel(null)}
            className={`w-full flex items-center justify-between px-4 py-2 text-[12px] transition-colors ${
              !selectedChannel ? 'bg-white/[0.05] text-white/80' : 'text-white/40 hover:text-white/60 hover:bg-white/[0.03]'
            }`}
          >
            <span className="font-mono">全部</span>
            <span className="text-[10px] text-white/25">{totalCount}</span>
          </button>

          {allChannels.map(ch => {
            const stat = stats.find(s => s.channel === ch)
            const active = selectedChannel === ch
            return (
              <button
                key={ch}
                onClick={() => setSelectedChannel(ch)}
                className={`w-full flex items-center justify-between px-4 py-2 text-[11px] transition-colors ${
                  active ? 'bg-white/[0.05] text-white/80' : 'text-white/40 hover:text-white/60 hover:bg-white/[0.03]'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: channelColor(ch) }}
                  />
                  <span className="font-mono truncate">{ch.replace(/-/g, '\u2011')}</span>
                </div>
                <span className="text-[10px] text-white/20 shrink-0 ml-1">{stat?.count ?? 0}</span>
              </button>
            )
          })}
        </nav>

        {/* Refresh controls */}
        <div className="px-3 py-2.5 border-t border-white/[0.06] flex items-center gap-2">
          <button
            onClick={fetchData}
            className="p-1.5 rounded hover:bg-white/[0.05] text-white/30 hover:text-white/60 transition-colors"
            title="立即刷新"
          >
            <RefreshCw size={12} />
          </button>
          <button
            onClick={() => setAutoRefresh(v => !v)}
            className={`flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded transition-colors ${
              autoRefresh
                ? 'bg-emerald-500/10 text-emerald-400/70 border border-emerald-500/20'
                : 'text-white/25 border border-white/[0.06]'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? 'bg-emerald-400 animate-pulse' : 'bg-white/20'}`} />
            {autoRefresh ? '实时' : '暂停'}
          </button>
          {lastRefresh && (
            <span className="text-[9px] text-white/15 font-mono">{relTime(lastRefresh.toISOString())}</span>
          )}
        </div>
      </div>

      {/* ── Middle: Message stream ────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-white/[0.06]">
        {/* Header */}
        <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-mono text-white/50">
              {selectedChannel ?? '所有频道'}
            </span>
            {selectedChannel && (
              <span
                className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                style={{ background: channelColor(selectedChannel) + '22', color: channelColor(selectedChannel) }}
              >
                {messages.length}
              </span>
            )}
          </div>
          <span className="text-[10px] text-white/15 font-mono">最新在上 ↑</span>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-4 h-4 border border-white/20 border-t-white/50 rounded-full animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-white/15 text-[12px] font-mono">
              暂无消息
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {messages.map(msg => {
                const active = selectedMsg?.id === msg.id
                return (
                  <button
                    key={msg.id}
                    onClick={() => setSelectedMsg(active ? null : msg)}
                    className={`w-full text-left px-5 py-3 transition-colors flex items-start gap-3 ${
                      active ? 'bg-white/[0.05]' : 'hover:bg-white/[0.025]'
                    }`}
                  >
                    {/* channel dot */}
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5"
                      style={{ background: channelColor(msg.channel) }}
                    />

                    <div className="flex-1 min-w-0">
                      {/* row 1: channel + event_type + time */}
                      <div className="flex items-center gap-2 mb-0.5">
                        <span
                          className="text-[10px] font-mono shrink-0"
                          style={{ color: channelColor(msg.channel) + 'cc' }}
                        >
                          {msg.channel}
                        </span>
                        <span className="text-[11px] text-white/60 font-mono truncate">{msg.event_type}</span>
                        <span className="ml-auto text-[9px] text-white/20 font-mono shrink-0">{relTime(msg.created_at)}</span>
                      </div>

                      {/* row 2: tier + status + payload preview */}
                      <div className="flex items-center gap-2">
                        <span
                          className="text-[9px] font-mono px-1 py-0.5 rounded"
                          style={{ background: (TIER_COLORS[msg.tier] ?? '#94a3b8') + '22', color: TIER_COLORS[msg.tier] ?? '#94a3b8' }}
                        >
                          {msg.tier}
                        </span>
                        <StatusDot status={msg.status} />
                        <span className="text-[10px] text-white/25 font-mono truncate">
                          {payloadPreview(msg.payload)}
                        </span>
                        {active && <ChevronRight size={10} className="ml-auto text-white/30 shrink-0" />}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Right: Payload detail ─────────────────────────── */}
      <div className="w-80 shrink-0 flex flex-col">
        {selectedMsg ? (
          <>
            <div className="px-4 py-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: channelColor(selectedMsg.channel) }}
                />
                <span className="text-[11px] font-mono text-white/60">{selectedMsg.channel}</span>
              </div>
              <div className="text-[13px] font-mono text-white/80">{selectedMsg.event_type}</div>
              <div className="mt-1.5 flex items-center gap-2">
                <span
                  className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                  style={{ background: (TIER_COLORS[selectedMsg.tier] ?? '#94a3b8') + '22', color: TIER_COLORS[selectedMsg.tier] ?? '#94a3b8' }}
                >
                  {selectedMsg.tier}
                </span>
                <StatusDot status={selectedMsg.status} />
                <span className="text-[9px] text-white/25 font-mono">{selectedMsg.status}</span>
                <span className="ml-auto text-[9px] text-white/20 font-mono">{relTime(selectedMsg.created_at)}</span>
              </div>
              {selectedMsg.source_id && (
                <div className="mt-1 text-[9px] text-white/20 font-mono truncate">src: {selectedMsg.source_id}</div>
              )}
            </div>

            {/* Payload */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="text-[9px] text-white/20 font-mono mb-2 uppercase tracking-wider">Payload</div>
              <pre className="text-[11px] font-mono text-white/60 leading-relaxed whitespace-pre-wrap break-all">
                {JSON.stringify(selectedMsg.payload, null, 2)}
              </pre>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-white/10 text-[11px] font-mono">
            点击消息查看详情
          </div>
        )}
      </div>

    </div>
  )
}

// ── Payload preview (one-liner summary) ───────────────────────

function payloadPreview(payload: Record<string, unknown>): string {
  if (!payload || typeof payload !== 'object') return ''
  const keys = Object.keys(payload)
  if (keys.length === 0) return '{}'

  // meaningful first fields
  const priority = ['summary', 'title', 'result', 'cybernetics_loop', 'message', 'channel']
  for (const k of priority) {
    if (payload[k] && typeof payload[k] === 'string') {
      const v = payload[k] as string
      return v.length > 60 ? v.slice(0, 60) + '…' : v
    }
  }

  // fallback: first key=value
  const k = keys[0]
  const v = payload[k]
  const str = typeof v === 'object' ? JSON.stringify(v) : String(v)
  return `${k}: ${str.length > 50 ? str.slice(0, 50) + '…' : str}`
}
