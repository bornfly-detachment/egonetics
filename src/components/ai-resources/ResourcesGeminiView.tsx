// Gemini-added (2026-04-18): real-time AI resource view backed by runtime projection store.
import React, { useSyncExternalStore } from "react"
import {
  getHarnessRuntimeSnapshot,
  subscribeHarnessRuntimeSnapshots,
} from "./runtime-projection-store"
import { getHarnessResource } from "./registry"
import type { ResourceStatus } from "./types"

const COLORS = {
  gemini: { primary: "#c084fc", bg: "rgba(192,132,252,0.1)", border: "#c084fc" },
  ready: "#22c55e",
  warning: "#f59e0b",
  error: "#ef4444",
  unknown: "#94a3b8",
}

const HARNESS_ID = "harness:gemini-cli" as const

export function ResourcesGeminiView() {
  const resource = getHarnessResource(HARNESS_ID)
  const snapshot = useSyncExternalStore(
    subscribeHarnessRuntimeSnapshots,
    () => getHarnessRuntimeSnapshot(HARNESS_ID),
    () => getHarnessRuntimeSnapshot(HARNESS_ID),
  )

  const projection = snapshot?.projection
  const status = projection?.status ?? resource?.status ?? "unknown"
  const observedAt = projection?.observedAt ?? "未观测"
  const usagePercent = snapshot?.usagePercent
  const usageKnown = projection?.usageKnown ?? typeof usagePercent === "number"
  const quotaKnown = projection?.quotaKnown ?? false
  const usedTokens = snapshot?.usedTokens
  const dailyRequestsRemaining = snapshot?.dailyRequestsRemaining
  const isLeader = snapshot?.isLeader ?? false

  const getStatusColor = (value: ResourceStatus) => {
    switch (value) {
      case "ready":
        return COLORS.ready
      case "auth_required":
        return COLORS.warning
      case "unavailable":
      case "degraded":
        return COLORS.error
      default:
        return COLORS.unknown
    }
  }

  const statusLabel = status.replace(/_/g, " ")
  const usageLabel = usageKnown && typeof usagePercent === "number" ? `${usagePercent}%` : "unknown"
  const usageWidth = typeof usagePercent === "number" ? `${usagePercent}%` : "0%"
  const tokensUsedLabel =
    typeof usedTokens === "number" ? `${(usedTokens / 1000).toFixed(1)}K` : "unknown"
  const requestsLeftLabel =
    typeof dailyRequestsRemaining === "number" ? String(dailyRequestsRemaining) : "unknown"
  return (
    <div className="p-6 bg-[#0f172a] text-slate-100 rounded-xl border border-slate-800 shadow-2xl max-w-md font-sans relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          background: `radial-gradient(circle at top right, ${COLORS.gemini.bg}, transparent 45%)`,
        }}
      />

      <div className="relative flex justify-between items-start mb-6">
        <div className="flex items-center gap-3">
          <div
            className="w-3 h-3 rounded-full animate-pulse"
            style={{ backgroundColor: getStatusColor(status) }}
          />
          <div>
            <h2 className="text-xl font-bold tracking-tight">
              {resource?.name ?? "Gemini CLI Harness"}
            </h2>
            <p className="text-xs text-slate-400 font-mono mt-1">
              {resource?.legacyFreeCodeTierKey ? `legacyFreeCodeTierKey:${resource.legacyFreeCodeTierKey}` : "legacyFreeCodeTierKey:unknown"}
            </p>
          </div>
        </div>
        {isLeader && (
          <span className="px-2 py-1 text-xs font-bold uppercase bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-full">
            Leader
          </span>
        )}
      </div>

      <div className="relative space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-2 text-slate-400 font-mono">
            <span>Usage Quota</span>
            <span>{usageLabel}</span>
          </div>
          <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
            <div
              className="h-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(192,132,252,0.4)]"
              style={{
                width: usageWidth,
                backgroundColor: COLORS.gemini.primary,
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-6">
          <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/50">
            <p className="text-xs text-slate-500 uppercase mb-1">Tokens Used</p>
            <p className="text-lg font-mono font-bold">{tokensUsedLabel}</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/50">
            <p className="text-xs text-slate-500 uppercase mb-1">Requests Left</p>
            <p className="text-lg font-mono font-bold text-green-400">{requestsLeftLabel}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/50">
            <p className="text-xs text-slate-500 uppercase mb-1">Status</p>
            <p className="text-sm font-mono capitalize text-slate-200">{statusLabel}</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/50">
            <p className="text-xs text-slate-500 uppercase mb-1">Quota Known</p>
            <p className="text-sm font-mono capitalize text-slate-200">
              {quotaKnown ? "yes" : "no"}
            </p>
          </div>
        </div>
      </div>

      <div className="relative mt-8 pt-4 border-t border-slate-800 flex justify-between items-center text-xs text-slate-500">
        <div className="flex flex-col gap-1">
          <span>
            Runtime: <b className="text-slate-300">CLI / aiLevel:T2</b>
          </span>
          <span>
            Observed: <b className="text-slate-300">{observedAt}</b>
          </span>
        </div>
        <div className="text-right">
          <div>
            Auth: <b className="text-slate-300">{projection?.authRequired ? "required" : "not required"}</b>
          </div>
          <div>
            Available: <b className="text-slate-300">{projection?.available ? "yes" : "no"}</b>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ResourcesGeminiView
