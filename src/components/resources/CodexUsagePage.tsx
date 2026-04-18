import { useCallback, useEffect, useMemo, useState } from 'react'
import { authFetch } from '../../lib/http'

type Sensor = {
  id: string
  label: string
  subtitle: string
  usedLabel: string
  progressPct: number | null
  resetLabel: string
  note: string
}

type Snapshot = {
  provider: string
  observedAt: string
  pollMs: number
  account: {
    email: string | null
    authMode: string | null
    authProvider: string | null
    chatgptPlanType: string | null
    subscriptionActiveUntil: string | null
    subscriptionActiveStart: string | null
    subscriptionLastChecked: string | null
  }
  overview: {
    latestThread: null | {
      id: string
      title: string
      updatedAt: string
      createdAt: string
      tokensUsed: number
      modelProvider: string | null
      cliVersion: string | null
    }
    daily: { promptCount: number; threadCount: number; tokensUsed: number }
    weekly: { promptCount: number; threadCount: number; tokensUsed: number }
    subscription: { promptCount: number; threadCount: number | null; tokensUsed: number | null }
    recentThreads: Array<{ id: string; title: string; updatedAt: string; tokensUsed: number }>
  }
  sensors: Sensor[]
  source: {
    stateDb: string
    historyJsonl: string
    authJson: string
  }
}

function formatDateTime(value?: string | null) {
  if (!value) return '未提供'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '未提供'
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(d)
}

function UsageRow({ sensor }: { sensor: Sensor }) {
  const hasProgress = sensor.progressPct !== null && sensor.progressPct !== undefined
  return (
    <div className="grid items-center gap-4 md:grid-cols-[1.05fr,1.6fr,130px]">
      <div>
        <div className="text-[15px] font-medium text-white">{sensor.label}</div>
        <div className="mt-1 text-sm text-slate-400">{sensor.subtitle}</div>
      </div>
      <div className="relative h-8 overflow-hidden rounded-xl border border-white/12 bg-[#302f2d]">
        {hasProgress ? (
          <div className="absolute inset-y-1 left-1 rounded-lg bg-[#4184da]" style={{ width: `calc(${Math.max(0, Math.min(sensor.progressPct!, 100))}% - 8px)` }} />
        ) : (
          <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.06)_10px,transparent_10px,transparent_20px)]" />
        )}
      </div>
      <div className="text-right text-sm text-slate-300">{sensor.usedLabel}</div>
    </div>
  )
}

export default function CodexUsagePage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      const data = await authFetch<Snapshot>('/codex-usage/snapshot')
      setSnapshot(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const ms = snapshot?.pollMs ?? 20000
    const timer = window.setInterval(() => void load(), ms)
    return () => window.clearInterval(timer)
  }, [load, snapshot?.pollMs])

  const facts = useMemo(() => {
    if (!snapshot) return []
    return [
      `plan ${snapshot.account.chatgptPlanType ?? 'unknown'}`,
      snapshot.account.subscriptionActiveUntil ? `renews ${formatDateTime(snapshot.account.subscriptionActiveUntil)}` : 'renewal 未暴露',
      snapshot.overview.latestThread ? `latest ${snapshot.overview.latestThread.tokensUsed} tokens` : 'no local thread',
      `${snapshot.overview.daily.promptCount} prompts / 24h`,
      `${snapshot.overview.weekly.tokensUsed} tokens / 7d`,
    ]
  }, [snapshot])

  return (
    <div className="min-h-screen bg-[#1b1a18] text-slate-100">
      <div className="mx-auto w-full max-w-[1680px] px-10 py-12 lg:px-16">
        <header className="mb-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 text-[11px] uppercase tracking-[0.32em] text-slate-500">Resources / Codex CLI</div>
            <h1 className="text-5xl font-semibold tracking-tight text-white">Subscription usage limits</h1>
            <p className="mt-4 max-w-4xl text-base leading-8 text-slate-400">
              这是 Codex CLI 专属页面：数据只来自本机 Codex CLI 的 state.sqlite、history.jsonl、auth.json，并按轮询实时刷新。后面新增感知器时，只要后端返回新的 sensor，前端会自动渲染。
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <button onClick={() => void load()} className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-slate-200 hover:bg-white/[0.08]">刷新</button>
            <span>来源：codex CLI 本地状态</span>
          </div>
        </header>

        {error ? <div className="mb-6 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">加载失败：{error}</div> : null}

        <section className="rounded-[28px] border border-white/10 bg-[#1f1f1d] px-12 py-10 shadow-[0_24px_90px_rgba(0,0,0,0.24)]">
          <div className="mb-10 flex items-start justify-between gap-6">
            <div>
              <h2 className="text-[44px] font-semibold tracking-tight text-white">Codex CLI</h2>
              <p className="mt-3 text-base text-slate-400">
                {snapshot?.account.email ?? 'unknown account'} · {snapshot?.account.authProvider ?? 'unknown auth'} · {snapshot?.account.authMode ?? 'unknown mode'}
              </p>
            </div>
            <div className="rounded-full px-4 py-1.5 text-[15px] text-slate-300">{snapshot?.account.chatgptPlanType ?? 'unknown'}</div>
          </div>

          <div className="space-y-8">
            {(snapshot?.sensors ?? []).map((sensor, index) => (
              <div key={sensor.id}>
                {index > 0 ? <div className="mb-8 border-t border-white/10" /> : null}
                <UsageRow sensor={sensor} />
                <div className="mt-3 text-right text-xs text-slate-500">{sensor.resetLabel} · {sensor.note}</div>
              </div>
            ))}
          </div>

          <div className="mt-10 flex items-center gap-3 text-sm text-slate-500">
            <span>Last updated: {formatDateTime(snapshot?.observedAt)}</span>
            <span>•</span>
            <span>subscription checked: {formatDateTime(snapshot?.account.subscriptionLastChecked)}</span>
          </div>
        </section>

        <section className="mt-10 rounded-[28px] border border-white/8 bg-[#1f1f1d] px-10 py-8 text-sm text-slate-400">
          <div className="mb-4 text-lg font-medium text-white">Codex CLI source of truth</div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {facts.map((fact) => <div key={fact}>{fact}</div>)}
          </div>
          <div className="mt-6 border-t border-white/8 pt-5 leading-7">
            <div>latest thread: {snapshot?.overview.latestThread?.title ?? '未发现'} · {snapshot?.overview.latestThread?.tokensUsed ?? '—'} tokens · updated {formatDateTime(snapshot?.overview.latestThread?.updatedAt)}</div>
            <div>sources: {snapshot?.source.stateDb ?? '—'} · {snapshot?.source.historyJsonl ?? '—'} · {snapshot?.source.authJson ?? '—'}</div>
            <div>{loading ? 'loading…' : 'live'} · 未来接更多感知器时，只要后端追加 sensors 数组，页面会自动长出新行。</div>
          </div>
        </section>
      </div>
    </div>
  )
}
