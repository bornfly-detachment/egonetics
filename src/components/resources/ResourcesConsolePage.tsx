import { useCallback, useEffect, useMemo, useState } from 'react'
import { authFetch } from '../../lib/http'

type CanonicalStatus = 'ready' | 'auth_required' | 'unknown' | 'unavailable' | 'degraded'

type HarnessResource = {
  id: string
  binary: string
  status: CanonicalStatus
}

type CanonicalStatusResponse = {
  observedAt: number
  canonical: {
    harnessResources: HarnessResource[]
    namingContract: { note: string }
  }
}

type TierUsage = {
  calls: number
  inputTokens: number
  outputTokens: number
  totalLatencyMs: number
  errors: number
  avgLatencyMs: number
}

type LogSummary = {
  date: string
  tiers: Record<string, TierUsage>
}

type ResourceStatus = {
  mustReclaim: boolean
  system: {
    ram: { totalMb: number; usedMb: number }
    pressure: { memory: number }
  }
  sessions: { current: number; max: number }
}

type RuntimeStatus = {
  gate: {
    enabled: boolean
    lastRunAt?: string
  }
}

type RuntimeSnapshot = {
  at: string
  summary: { total: number; alive: number }
}

type LoadState = {
  canonical: CanonicalStatusResponse | null
  logs: LogSummary | null
  status: ResourceStatus | null
  runtime: RuntimeStatus | null
  snapshot: RuntimeSnapshot | null
}

type ProviderCardModel = {
  key: string
  title: string
  plan: string
  status: CanonicalStatus
  session: { label: string; subtitle: string; percent: number | null }
  window: { label: string; subtitle: string; percent: number | null }
  daily: { label: string; subtitle: string; percent: number | null }
}

const REFRESH_MS = 20000
const PROVIDERS = [
  { key: 'harness:claude-cli', title: 'Claude Code', plan: 'Pro' },
  { key: 'harness:codex-cli', title: 'Codex CLI', plan: 'Member' },
  { key: 'harness:gemini-cli', title: 'Gemini CLI', plan: 'Advanced' },
] as const

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat('zh-CN').format(value)
}

function formatDateTime(value?: string | number | null): string {
  if (!value) return '未提供'
  const d = typeof value === 'number' ? new Date(value) : new Date(value)
  if (Number.isNaN(d.getTime())) return '未提供'
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(d)
}

function statusCopy(status: CanonicalStatus) {
  switch (status) {
    case 'ready':
      return { subtitle: '已连通，可继续细化 usage telemetry', muted: false }
    case 'auth_required':
      return { subtitle: '需要先完成 CLI 登录', muted: false }
    case 'degraded':
      return { subtitle: '部分能力可用，数据仍不完整', muted: false }
    case 'unavailable':
      return { subtitle: '当前不可用', muted: false }
    default:
      return { subtitle: '当前后端未暴露 provider 级 usage / reset 数据', muted: true }
  }
}

function UsageRow({
  label,
  subtitle,
  valueLabel,
  percent,
}: {
  label: string
  subtitle: string
  valueLabel: string
  percent: number | null
}) {
  const hasValue = percent !== null && percent !== undefined
  return (
    <div className="grid items-center gap-4 md:grid-cols-[1.1fr,1.6fr,120px]">
      <div>
        <div className="text-[15px] font-medium text-white">{label}</div>
        <div className="mt-1 text-sm text-slate-400">{subtitle}</div>
      </div>
      <div className="relative h-8 overflow-hidden rounded-xl border border-white/12 bg-[#302f2d]">
        {hasValue ? (
          <div className="absolute inset-y-1 left-1 rounded-lg bg-[#4184da]" style={{ width: `calc(${Math.max(0, Math.min(percent, 100))}% - 8px)` }} />
        ) : (
          <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.06)_10px,transparent_10px,transparent_20px)]" />
        )}
      </div>
      <div className="text-right text-sm text-slate-300">{valueLabel}</div>
    </div>
  )
}

function ProviderSection({ card, updatedAt }: { card: ProviderCardModel; updatedAt: string }) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-[#1f1f1d] px-12 py-10 shadow-[0_24px_90px_rgba(0,0,0,0.24)]">
      <div className="mb-10 flex items-start justify-between gap-6">
        <div>
          <h2 className="text-[44px] font-semibold tracking-tight text-white">{card.title}</h2>
          <p className="mt-3 text-base text-slate-400">{statusCopy(card.status).subtitle}</p>
        </div>
        <div className="rounded-full px-4 py-1.5 text-[15px] text-slate-300">{card.plan}</div>
      </div>

      <div className="space-y-8">
        <UsageRow label="Current session" subtitle={card.session.subtitle} valueLabel={card.session.label} percent={card.session.percent} />
        <div className="border-t border-white/10" />
        <UsageRow label="Subscription window" subtitle={card.window.subtitle} valueLabel={card.window.label} percent={card.window.percent} />
        <UsageRow label="Daily requests" subtitle={card.daily.subtitle} valueLabel={card.daily.label} percent={card.daily.percent} />
      </div>

      <div className="mt-10 flex items-center gap-3 text-sm text-slate-500">
        <span>Last updated: {updatedAt}</span>
      </div>
    </section>
  )
}

export default function ResourcesConsolePage() {
  const [data, setData] = useState<LoadState>({ canonical: null, logs: null, status: null, runtime: null, snapshot: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      const [canonical, logs, status, runtime, snapshot] = await Promise.all([
        authFetch<CanonicalStatusResponse>('/resources/status/canonical'),
        authFetch<LogSummary>('/resources/logs/summary'),
        authFetch<ResourceStatus>('/resources/status'),
        authFetch<RuntimeStatus>('/resources/runtime/status'),
        authFetch<RuntimeSnapshot>('/resources/runtime/snapshot'),
      ])
      setData({ canonical, logs, status, runtime, snapshot })
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [load])

  const providerCards = useMemo<ProviderCardModel[]>(() => {
    const harnessMap = new Map((data.canonical?.canonical.harnessResources ?? []).map((item) => [item.id, item]))
    const t2Usage = data.logs?.tiers?.T2 ?? null

    return PROVIDERS.map((provider) => {
      const harness = harnessMap.get(provider.key)
      const status = harness?.status ?? 'unknown'
      const usageKnown = Boolean(t2Usage)

      return {
        key: provider.key,
        title: provider.title,
        plan: provider.plan,
        status,
        session: {
          label: status === 'auth_required' ? '需要登录' : '未暴露',
          subtitle: status === 'auth_required' ? 'CLI 登录后才可能读取本轮电量' : '当前 session 级 usage 还没有 provider 数据源',
          percent: null,
        },
        window: {
          label: status === 'auth_required' ? '登录后可探测' : '未暴露',
          subtitle: 'reset 时间 / 剩余额度目前没有 provider 级 API 或 CLI probe 接口',
          percent: null,
        },
        daily: {
          label: usageKnown ? `${formatNumber(t2Usage?.calls)} requests` : '未暴露',
          subtitle: usageKnown
            ? `${formatNumber(t2Usage?.outputTokens)} output tokens · ${formatNumber(t2Usage?.errors)} errors`
            : '当前只有 tier 级统计，没有按厂商拆分的 usage',
          percent: null,
        },
      }
    })
  }, [data.canonical, data.logs])

  const footerFacts = useMemo(() => ({
    services: data.snapshot ? `${data.snapshot.summary.alive}/${data.snapshot.summary.total} services alive` : '—',
    sessions: data.status ? `${data.status.sessions.current}/${data.status.sessions.max} sessions` : '—',
    memory: data.status ? `${data.status.system.pressure.memory}% memory pressure` : '—',
    gate: data.runtime?.gate?.enabled ? 'runtime gate on' : 'runtime gate off',
    reclaim: data.status?.mustReclaim ? 'needs reclaim' : 'stable',
  }), [data])

  return (
    <div className="min-h-screen bg-[#1b1a18] text-slate-100">
      <div className="mx-auto w-full max-w-[1800px] px-10 py-12 lg:px-16">
        <header className="mb-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 text-[11px] uppercase tracking-[0.32em] text-slate-500">Resources / Usage</div>
            <h1 className="text-5xl font-semibold tracking-tight text-white">Subscription usage limits</h1>
            <p className="mt-4 max-w-4xl text-base leading-8 text-slate-400">
              按 Claude_usage 的节奏重做：整页只围绕三大厂商的订阅剩余电量展示。现在没有 provider 级 reset / quota / session 数据的地方，统一显示为未暴露，而不是继续做假的资源面板。
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <button onClick={() => void load()} className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-slate-200 hover:bg-white/[0.08]">刷新</button>
            <span>自动刷新 {REFRESH_MS / 1000}s</span>
          </div>
        </header>

        {error ? <div className="mb-6 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">加载失败：{error}</div> : null}

        <div className="space-y-8">
          {providerCards.map((card) => (
            <ProviderSection key={card.key} card={card} updatedAt={formatDateTime(data.canonical?.observedAt)} />
          ))}
        </div>

        <section className="mt-10 rounded-[28px] border border-white/8 bg-[#1f1f1d] px-10 py-8 text-sm text-slate-400">
          <div className="mb-4 text-lg font-medium text-white">Reality check</div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div>{footerFacts.services}</div>
            <div>{footerFacts.sessions}</div>
            <div>{footerFacts.memory}</div>
            <div>{footerFacts.gate}</div>
            <div>{footerFacts.reclaim}</div>
          </div>
          <div className="mt-6 border-t border-white/8 pt-5 leading-7">
            <div>未完成：provider 级 auth probe、attempt/pitfall runtime、subscription reset 时间、各厂商独立 usage 百分比。</div>
            <div>命名约束：{data.canonical?.canonical.namingContract.note ?? '未加载'}</div>
            <div>Last runtime tick: {formatDateTime(data.runtime?.gate?.lastRunAt)} · Snapshot: {formatDateTime(data.snapshot?.at)} · {loading ? 'loading…' : 'live'}</div>
          </div>
        </section>
      </div>
    </div>
  )
}
