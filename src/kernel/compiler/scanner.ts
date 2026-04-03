/**
 * PRVSE Compiler — Scanner (Lexer)
 *
 * Equivalent to TypeScript's scanner.ts.
 * Takes raw input (any information) and produces PatternTokens.
 *
 * Unlike a traditional lexer that does character-level tokenization,
 * this scanner classifies INFORMATION — it decides:
 *   - Where did this info come from? (origin — chain provenance)
 *   - What state is it in? (external / candidate / internal)
 *   - What physical form is it? (text/number/code/structured/image/audio/video/stream/mixed)
 *   - What level is it? (L0 atom / L1 molecule / L2 gene)
 *   - What communication direction? (bottom_up / top_down / lateral)
 *
 * Fields that can't be determined start as `unresolved()` —
 * the binder will attempt to narrow them, and the checker will
 * downgrade permissions for anything still unresolved.
 *
 * In production, the LLM replaces the heuristic classifiers here.
 * This module is the deterministic fallback / T0-level scanner.
 */

import type {
  PatternToken,
  POrigin,
  PPhysicalType,
  PLevel,
  PState,
} from './types'

import { resolved, unresolved } from './types'

// ── Scanner Input ─────────────────────────────────────────────

export interface ScannerInput {
  /** Raw content to classify */
  readonly content: string
  /** Who/what produced this input — chain provenance */
  readonly origin: POrigin
  /** Optional hints from the caller (e.g., UI already knows it's code) */
  readonly hints?: {
    physical?: PPhysicalType
    level?: PLevel
  }
}

// ── ID Generation ─────────────────────────────────────────────

let tokenCounter = 0

function generateTokenId(): string {
  tokenCounter++
  return `pt-${Date.now()}-${tokenCounter.toString(36)}`
}

/** Reset counter (for testing) */
export function resetTokenCounter(): void {
  tokenCounter = 0
}

// ── Heuristic Classifiers ─────────────────────────────────────

/**
 * Classify physical type from raw content.
 * T0-level: pure heuristics, no LLM.
 * Expanded to 9 types per constitutional design.
 */
function classifyPhysical(content: string): PPhysicalType | null {
  const trimmed = content.trim()
  if (trimmed.length === 0) return null

  // Number
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(trimmed)) return 'number'

  // Structured data (JSON-like)
  if (/^\s*[{\[]/.test(trimmed)) {
    try {
      JSON.parse(trimmed)
      return 'structured'
    } catch {
      // Not valid JSON, fall through
    }
  }

  // Code (multiple heuristic signals)
  const codeSignals = [
    /[{}\[\]();]/.test(trimmed),                                        // brackets
    /\b(function|const|let|var|class|import|export)\b/.test(trimmed),   // JS keywords
    /\b(def|class|import|from|return|if|elif)\b/.test(trimmed),         // Python keywords
    /^\s*(\/\/|#|\/\*)/.test(trimmed),                                  // comment start
    /=>|->/.test(trimmed),                                              // arrow
  ]
  if (codeSignals.filter(Boolean).length >= 2) return 'code'

  // Text (default for non-empty string)
  return 'text'
}

/**
 * Determine state from origin.
 * External origin → external state (needs L0 validation).
 * Internal origin → candidate state (passed system boundary, awaiting practice).
 */
function determineState(origin: POrigin): PState {
  return origin.domain === 'external' ? 'external' : 'candidate'
}

/**
 * Classify level from content + origin heuristics.
 * Most content starts as L0_atom — the binder refines this.
 */
function classifyLevel(content: string, origin: POrigin, physical: PPhysicalType | null): PLevel | null {
  // Internal execution results are L0 atoms (deterministic output)
  if (origin.domain === 'internal' && origin.type === 'module_output') return 'L0_atom'
  if (origin.domain === 'internal' && origin.type === 'system_event') return 'L0_atom'

  // Computable external sources produce L0 atoms
  if (origin.domain === 'external' && origin.type === 'computable') return 'L0_atom'

  // Numbers and structured data from any source are L0 atoms
  if (physical === 'number' || physical === 'structured') return 'L0_atom'

  // Code is typically L0 atom (concrete, complete, executable)
  if (physical === 'code') return 'L0_atom'

  // Cannot determine at scanner level — leave for binder
  return null
}

// ── Main Scanner ──────────────────────────────────────────────

/**
 * scan() — the main scanner function.
 *
 * Takes raw input, produces a PatternToken with as many fields
 * resolved as heuristics allow. Remaining unknowns stay unresolved()
 * for the binder to narrow.
 */
export function scan(input: ScannerInput): PatternToken {
  const { content, origin, hints } = input

  // State: determined by origin (deterministic)
  const state = determineState(origin)

  // Physical: use hint if provided, else heuristic
  const physicalValue = hints?.physical ?? classifyPhysical(content)
  const physical = physicalValue
    ? resolved(physicalValue)
    : unresolved<PPhysicalType>()

  // Level: use hint if provided, else heuristic
  const levelValue = hints?.level ?? classifyLevel(content, origin, physicalValue)
  const level = levelValue
    ? resolved(levelValue)
    : unresolved<PLevel>()

  // Communication: always starts unresolved — needs context from binder
  const communication = unresolved<never>()

  return {
    id: generateTokenId(),
    timestamp: Date.now(),
    rawContent: content,
    origin,
    state,
    physical,
    level,
    communication,
  }
}

/**
 * scanBatch() — scan multiple inputs in order.
 * Returns tokens in same order as inputs.
 */
export function scanBatch(inputs: readonly ScannerInput[]): readonly PatternToken[] {
  return inputs.map(scan)
}
