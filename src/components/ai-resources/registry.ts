// Minimal registry for egonetics integration — only getHarnessResource needed by view.
import type { HarnessResource, HarnessResourceId } from "./types"

const HARNESS_RESOURCES: readonly HarnessResource[] = [
  {
    id: "harness:claude-cli",
    kind: "harness",
    aiLevel: "T2",
    name: "Claude CLI harness",
    runtime: "cli",
    protocol: "anthropic-cli",
    visibilityScope: "project",
    status: "unknown",
    capabilities: {
      reasoning: true, vision: true, toolUse: true,
      latencyClass: "medium", privacyClass: "trusted_cloud", budgetClass: "premium",
      maxContext: 200_000, verificationRequired: true,
    },
    providerId: "provider:claude-cli",
    binary: "claude",
    legacyFreeCodeTierKey: "T2",
  },
  {
    id: "harness:codex-cli",
    kind: "harness",
    aiLevel: "T2",
    name: "Codex CLI harness",
    runtime: "cli",
    protocol: "codex-cli",
    visibilityScope: "project",
    status: "unknown",
    capabilities: {
      reasoning: true, vision: true, toolUse: true,
      latencyClass: "medium", privacyClass: "trusted_cloud", budgetClass: "premium",
      maxContext: 200_000, verificationRequired: true,
    },
    providerId: "provider:codex-cli",
    binary: "codex",
    legacyFreeCodeTierKey: "T3",
  },
  {
    id: "harness:gemini-cli",
    kind: "harness",
    aiLevel: "T2",
    name: "Gemini CLI harness",
    runtime: "cli",
    protocol: "gemini-cli",
    visibilityScope: "project",
    status: "unknown",
    capabilities: {
      reasoning: true, vision: true, toolUse: true,
      latencyClass: "medium", privacyClass: "shared_cloud", budgetClass: "standard",
      maxContext: 1_000_000, verificationRequired: true,
    },
    providerId: "provider:gemini-cli",
    binary: "gemini",
    legacyFreeCodeTierKey: "T4",
  },
] as const

export function getHarnessResource(id: HarnessResourceId): HarnessResource | undefined {
  return HARNESS_RESOURCES.find(r => r.id === id)
}
