// Ported from Gemini workspace — types are self-contained here for egonetics integration.

export type AuthorityLevel = 'A0' | 'A1' | 'A2' | 'A3'
export type AITier = 'T0' | 'T1' | 'T2'

export type ProviderSlotId =
  | "slot:T0"
  | "slot:T1"
  | "slot:T2"
  | "slot:T3"
  | "slot:T4"

export type ProviderSlotLabel = "T0" | "T1" | "T2" | "T3" | "T4"
export type ProviderRuntime = "local" | "api" | "cli"
export type ProviderProtocol =
  | "deterministic"
  | "openai"
  | "anthropic"
  | "anthropic-cli"
  | "codex-cli"
  | "gemini-cli"
export type ProviderId =
  | "provider:local-deterministic"
  | "provider:minimax-api"
  | "provider:claude-cli"
  | "provider:codex-cli"
  | "provider:gemini-cli"

export type OrchestratorRole =
  | "main_worker"
  | "reasoning"
  | "fast_search"
  | "vision"

export type AuthorityTier = AuthorityLevel | AITier
export type LatencyClass = "low" | "medium" | "high"
export type BudgetClass = "economy" | "standard" | "premium"
export type PrivacyClass = "local" | "trusted_cloud" | "shared_cloud"
export type VisibilityScope = "builtin" | "project" | "session"
export type SlotHealth = "healthy" | "degraded" | "unknown"
export type SelectionPolicy = "ordered" | "cost_first" | "health_first"
export type ResourceStatus =
  | "ready"
  | "auth_required"
  | "unknown"
  | "unavailable"
  | "degraded"
export type ResourceKind = "model" | "harness"
export type HarnessRuntime = "cli"
export type ModelResourceId =
  | "model:local-deterministic"
  | "model:minimax"
export type HarnessResourceId =
  | "harness:claude-cli"
  | "harness:codex-cli"
  | "harness:gemini-cli"
export type ResourceBindingId =
  | "binding:slot:T0"
  | "binding:slot:T1"
  | "binding:slot:T2"
  | "binding:slot:T3"
  | "binding:slot:T4"
export type LegacyFreeCodeTierKey = "T0" | "T1" | "T2" | "T3" | "T4"

export interface CapabilityProfile {
  reasoning: boolean
  vision: boolean
  toolUse: boolean
  latencyClass: LatencyClass
  privacyClass: PrivacyClass
  budgetClass: BudgetClass
  maxContext?: number
  verificationRequired: boolean
}

export interface HarnessResource {
  id: HarnessResourceId
  kind: "harness"
  aiLevel: AITier
  name: string
  runtime: HarnessRuntime
  protocol: Extract<ProviderProtocol, "anthropic-cli" | "codex-cli" | "gemini-cli">
  visibilityScope: VisibilityScope
  status: ResourceStatus
  capabilities: CapabilityProfile
  providerId: Extract<ProviderId, "provider:claude-cli" | "provider:codex-cli" | "provider:gemini-cli">
  binary: string
  legacyFreeCodeTierKey?: LegacyFreeCodeTierKey
  notes?: string[]
}

export interface RuntimeProjection {
  observedAt: string
  status: ResourceStatus
  authRequired: boolean
  available: boolean
  usageKnown: boolean
  quotaKnown: boolean
  notes?: string[]
}
