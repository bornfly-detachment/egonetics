/**
 * UsageLimitsView.tsx
 *
 * /resources_claude — AI usage limits dashboard.
 * Probe-driven, SSE-backed, matches Claude_usage.png style:
 *   - Per-provider card with plan badge
 *   - Per-row progress bars (used_pct, used/total, reset_in)
 *   - Live "last updated" footer
 *   - Add/remove probe via floating action
 */

import React, { useEffect, useRef, useState, useCallback } from 'react'
import {
  BarChart2,
  RefreshCw,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Clock,
  Wifi,
  WifiOff,
  Loader2,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface UsageRow {
  id: string
  label: string
  status: 'ready' | 'estimated' | 'auth_required' | 'error' | 'unknown'
  used_pct: number | null
  used: string | number | null
  total: string | number | null
  reset_in: string | null
  note: string | null
}

interface Provider {
  id: string
  label: string
  plan: string | null
  kind: string
  interval_ms: number
  rows: UsageRow[]
  collected_at: string | null
}

interface SnapshotResponse {
  providers: Provider[]
  server_time: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function planBadgeColor(plan: string | null): string {
  if (!plan) return 'bg-neutral-700 text-neutral-300'
  const p = plan.toLowerCase()
  if (p === 'max')  return 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
  if (p === 'pro')  return 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
  if (p === 'free') return 'bg-green-500/20 text-green-300 border border-green-500/40'
  return 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
}

function statusColor(status: UsageRow['status']): string {
  switch (status) {
    case 'ready':         return 'text-emerald-400'
    case 'estimated':     return 'text-yellow-400'
    case 'auth_required': return 'text-orange-400'
    case 'error':         return 'text-red-400'
    default:              return 'text-neutral-500'
  }
}

function progressBarColor(pct: number): string {
  if (pct >= 90) return 'bg-red-500'
  if (pct >= 70) return 'bg-orange-500'
  if (pct >= 40) return 'bg-yellow-500'
  return 'bg-emerald-500'
}

function relativeTime(iso: string | null): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 5000)  return 'just now'
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  return `${Math.floor(diff / 3600000)}h ago`
}

// ── Sub-components ────────────────────────────────────────────────────────────

function UsageRow({ row }: { row: UsageRow }) {
  const pct = row.used_pct ?? 0
  const showBar = row.status === 'ready' || row.status === 'estimated'

  return (
    <div className="py-3 border-b border-white/5 last:border-0">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-neutral-300 font-medium">{row.label}</span>
        <div className="flex items-center gap-2">
          {row.reset_in && (
            <span className="flex items-center gap-1 text-xs text-neutral-500">
              <Clock className="w-3 h-3" />
              {row.reset_in}
            </span>
          )}
          {showBar ? (
            <span className="text-xs font-mono font-semibold text-neutral-200">
              {pct}%
            </span>
          ) : (
            <span className={`text-xs font-medium ${statusColor(row.status)}`}>
              {row.status === 'auth_required' ? 'Login required' :
               row.status === 'error' ? 'Error' : 'Unknown'}
            </span>
          )}
        </div>
      </div>

      {showBar && (
        <div className="relative h-2 bg-white/8 rounded-full overflow-hidden">
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ${progressBarColor(pct)}`}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
      )}

      {!showBar && (
        <div className="relative h-2 bg-white/5 rounded-full overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent animate-pulse" />
        </div>
      )}

      {(row.used !== null || row.total !== null || row.note) && (
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-xs text-neutral-600">
            {row.used !== null && row.total !== null
              ? `${row.used} / ${row.total}`
              : row.used !== null
              ? String(row.used)
              : null}
          </span>
          {row.note && (
            <span className="text-xs text-neutral-600 italic truncate max-w-[200px]">
              {row.note}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function ProviderCard({
  provider,
  onRefresh,
}: {
  provider: Provider
  onRefresh: (id: string) => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = async () => {
    setRefreshing(true)
    await onRefresh(provider.id)
    setTimeout(() => setRefreshing(false), 600)
  }

  return (
    <div className="bg-neutral-900/60 border border-white/8 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white/3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500/20 to-orange-700/10 border border-orange-500/20 flex items-center justify-center">
            <BarChart2 className="w-4 h-4 text-orange-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">{provider.label}</span>
              {provider.plan && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${planBadgeColor(provider.plan)}`}>
                  {provider.plan}
                </span>
              )}
            </div>
            <div className="text-[10px] text-neutral-600 mt-0.5">
              polls every {Math.round(provider.interval_ms / 1000)}s
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleRefresh}
            className="w-7 h-7 rounded-lg hover:bg-white/8 flex items-center justify-center text-neutral-500 hover:text-neutral-300 transition-colors"
            title="Force refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setCollapsed(c => !c)}
            className="w-7 h-7 rounded-lg hover:bg-white/8 flex items-center justify-center text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            {collapsed
              ? <ChevronDown className="w-3.5 h-3.5" />
              : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Rows */}
      {!collapsed && (
        <div className="px-4">
          {provider.rows.length === 0 ? (
            <div className="py-4 text-xs text-neutral-600 text-center">No data yet</div>
          ) : (
            provider.rows.map(row => <UsageRow key={row.id} row={row} />)
          )}
        </div>
      )}

      {/* Footer */}
      {!collapsed && (
        <div className="px-4 py-2 bg-white/2 flex items-center justify-between">
          <span className="text-[10px] text-neutral-700">
            Last updated: {relativeTime(provider.collected_at)}
          </span>
          <span className="text-[10px] text-neutral-700 font-mono">{provider.kind}</span>
        </div>
      )}
    </div>
  )
}

// ── Add Probe Modal ────────────────────────────────────────────────────────────

interface AddProbeForm {
  id: string
  label: string
  plan: string
  kind: string
  interval_ms: number
}

const DEFAULT_FORM: AddProbeForm = {
  id: '',
  label: '',
  plan: '',
  kind: 'unknown',
  interval_ms: 60000,
}

function AddProbeModal({ onClose, onAdd }: {
  onClose: () => void
  onAdd: (form: AddProbeForm) => Promise<void>
}) {
  const [form, setForm] = useState<AddProbeForm>(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.id.trim() || !form.label.trim()) {
      setError('ID and label are required')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onAdd(form)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add probe')
    } finally {
      setSaving(false)
    }
  }

  const field = (key: keyof AddProbeForm, label: string, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-xs text-neutral-400 mb-1">{label}</label>
      <input
        type={type}
        value={String(form[key])}
        onChange={e => setForm(f => ({
          ...f,
          [key]: type === 'number' ? Number(e.target.value) : e.target.value,
        }))}
        placeholder={placeholder}
        className="w-full bg-neutral-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-orange-500/50"
      />
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <span className="font-semibold text-white">Add Usage Probe</span>
          <button onClick={onClose} className="text-neutral-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-3">
          {field('id',     'Probe ID',     'text', 'e.g. openai-session')}
          {field('label',  'Display name', 'text', 'e.g. OpenAI ChatGPT')}
          {field('plan',   'Plan badge',   'text', 'e.g. Plus, Pro, Free')}
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Kind</label>
            <select
              value={form.kind}
              onChange={e => setForm(f => ({ ...f, kind: e.target.value }))}
              className="w-full bg-neutral-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/50"
            >
              <option value="unknown">unknown (placeholder)</option>
              <option value="db_execution_runs">db_execution_runs</option>
              <option value="claude_cli_session">claude_cli_session</option>
            </select>
          </div>
          {field('interval_ms', 'Poll interval (ms)', 'number', '60000')}
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-white/10 text-sm text-neutral-400 hover:text-white hover:border-white/20 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-sm text-white font-medium transition-colors disabled:opacity-50"
            >
              {saving ? 'Adding…' : 'Add probe'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main View ─────────────────────────────────────────────────────────────────

const API = '/api'

export default function UsageLimitsView() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [serverTime, setServerTime] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [sseConnected, setSseConnected] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [tick, setTick] = useState(0)

  const eventSourceRef = useRef<EventSource | null>(null)

  // Merge a single probe update into the providers list
  const mergeProbeUpdate = useCallback((id: string, snapshot: { rows: UsageRow[]; collected_at: string }) => {
    setProviders(prev => prev.map(p =>
      p.id === id ? { ...p, ...snapshot } : p
    ))
  }, [])

  // Initial snapshot fetch
  const fetchSnapshot = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token')
      const res = await fetch(`${API}/usage/snapshot`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: SnapshotResponse = await res.json()
      setProviders(data.providers)
      setServerTime(data.server_time)
    } catch {
      // silently fail; SSE will backfill
    } finally {
      setLoading(false)
    }
  }, [])

  // Connect SSE
  useEffect(() => {
    fetchSnapshot()

    const token = localStorage.getItem('auth_token')
    const url = token
      ? `${API}/usage/stream?token=${encodeURIComponent(token)}`
      : `${API}/usage/stream`

    const es = new EventSource(url)
    eventSourceRef.current = es

    es.onopen = () => setSseConnected(true)
    es.onerror = () => setSseConnected(false)

    es.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data)
        if (msg.type === 'init') {
          setProviders(prev => {
            const byId = new Map(prev.map(p => [p.id, p]))
            for (const p of msg.providers) {
              byId.set(p.id, { ...byId.get(p.id), ...p })
            }
            return [...byId.values()]
          })
          setSseConnected(true)
        } else if (msg.type === 'probe_update') {
          mergeProbeUpdate(msg.id, msg.snapshot)
        }
      } catch { /* ignore malformed */ }
    }

    return () => {
      es.close()
      eventSourceRef.current = null
    }
  }, [fetchSnapshot, mergeProbeUpdate])

  // Relative-time ticker (re-render every 15s to refresh "N min ago")
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 15_000)
    return () => clearInterval(t)
  }, [])

  // Force-refresh a probe
  const handleRefresh = useCallback(async (id: string) => {
    const token = localStorage.getItem('auth_token')
    await fetch(`${API}/usage/probes/${id}/refresh`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
  }, [])

  // Delete a probe
  const handleDelete = useCallback(async (id: string) => {
    const token = localStorage.getItem('auth_token')
    await fetch(`${API}/usage/probes/${id}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    setProviders(prev => prev.filter(p => p.id !== id))
  }, [])

  // Add a probe
  const handleAddProbe = useCallback(async (form: AddProbeForm) => {
    const token = localStorage.getItem('auth_token')
    const res = await fetch(`${API}/usage/probes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ ...form, rows: [] }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || `HTTP ${res.status}`)
    }
    await fetchSnapshot()
  }, [fetchSnapshot])

  // Suppress linter: tick used to force re-render for relativeTime()
  void tick

  return (
    <div className="min-h-full bg-neutral-950 text-white">
      {/* Page header */}
      <div className="sticky top-0 z-10 bg-neutral-950/90 backdrop-blur-md border-b border-white/6 px-5 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500/30 to-orange-700/10 border border-orange-500/30 flex items-center justify-center">
              <BarChart2 className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white leading-none">Plan usage limits</h1>
              <p className="text-xs text-neutral-500 mt-0.5">Live probe dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border ${
                sseConnected
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-red-500/10 border-red-500/20 text-red-400'
              }`}
            >
              {sseConnected
                ? <><Wifi className="w-3 h-3" /> Live</>
                : <><WifiOff className="w-3 h-3" /> Offline</>}
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600/20 hover:bg-orange-600/30 border border-orange-500/30 text-orange-300 text-xs font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add probe
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-2xl mx-auto px-5 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-neutral-600">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="text-sm">Loading usage data…</span>
          </div>
        ) : providers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-neutral-600">
            <BarChart2 className="w-10 h-10 opacity-30" />
            <span className="text-sm">No probes registered</span>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-2 text-xs text-orange-400 hover:text-orange-300 underline underline-offset-2"
            >
              Add the first probe
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {providers.map(p => (
              <div key={p.id} className="group relative">
                <ProviderCard provider={p} onRefresh={handleRefresh} />
                {/* Delete button — only on hover */}
                <button
                  onClick={() => handleDelete(p.id)}
                  className="absolute top-3 right-16 w-6 h-6 rounded-md bg-red-500/0 hover:bg-red-500/20 flex items-center justify-center text-neutral-700 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                  title="Remove probe"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        {serverTime && (
          <p className="text-center text-[11px] text-neutral-700 mt-8">
            Server time: {new Date(serverTime).toLocaleTimeString()}
          </p>
        )}
      </div>

      {/* Add probe modal */}
      {showAddModal && (
        <AddProbeModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddProbe}
        />
      )}
    </div>
  )
}
