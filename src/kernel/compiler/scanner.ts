/**
 * PRVSE Compiler — Scanner (Lexer)
 *
 * Equivalent to TypeScript's scanner.ts.
 * Takes raw input (any information) and produces PatternTokens.
 *
 * Unlike a traditional lexer that does character-level tokenization,
 * this scanner classifies INFORMATION — it decides:
 *   - Where did this info come from? (source)
 *   - What physical form is it? (text/number/code/image/audio)
 *   - What semantic type is it? (fact/rule/process/...)
 *   - What value attributes does it have? (certainty/completeness/truth)
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
  PSource,
  PPhysicalType,
  PCertainty,
  PCompleteness,
  PSemanticType,
} from './types'

import { resolved, unresolved } from './types'

// ── Scanner Input ─────────────────────────────────────────────

export interface ScannerInput {
  /** Raw content to classify */
  readonly content: string
  /** Who/what produced this input */
  readonly source: PSource
  /** Optional hints from the caller (e.g., UI already knows it's code) */
  readonly hints?: {
    physical?: PPhysicalType
    semantic?: PSemanticType
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
 */
function classifyPhysical(content: string): PPhysicalType | null {
  const trimmed = content.trim()

  // Number
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(trimmed)) return 'number'

  // Code (multiple heuristic signals)
  const codeSignals = [
    /[{}\[\]();]/.test(trimmed),                          // brackets
    /\b(function|const|let|var|class|import|export)\b/.test(trimmed), // JS keywords
    /\b(def|class|import|from|return|if|elif)\b/.test(trimmed),       // Python keywords
    /^\s*(\/\/|#|\/\*)/.test(trimmed),                     // comment start
    /=>|->/.test(trimmed),                                 // arrow
  ]
  if (codeSignals.filter(Boolean).length >= 2) return 'code'

  // Text (default for non-empty string)
  if (trimmed.length > 0) return 'text'

  return null
}

/**
 * Classify certainty from content signals.
 * Looks for hedging language, question marks, etc.
 */
function classifyCertainty(content: string): PCertainty | null {
  const uncertain = [
    /\?/.test(content),                                    // question mark
    /\b(maybe|perhaps|probably|might|could|possibly)\b/i.test(content),
    /\b(可能|也许|大概|或许|不确定)\b/.test(content),
  ]

  if (uncertain.filter(Boolean).length >= 1) return 'uncertain'

  const certain = [
    /\b(always|never|must|shall|definitely|certainly)\b/i.test(content),
    /\b(必须|一定|肯定|确定|绝对)\b/.test(content),
  ]

  if (certain.filter(Boolean).length >= 1) return 'certain'

  return null
}

/**
 * Classify completeness from content.
 * Short fragments or trailing ellipsis → incomplete.
 */
function classifyCompleteness(content: string): PCompleteness | null {
  const trimmed = content.trim()

  // Ellipsis or trailing dots → incomplete
  if (/\.\.\.|…$/.test(trimmed)) return 'incomplete'

  // Very short content with no period → likely incomplete
  if (trimmed.length < 10 && !trimmed.endsWith('.') && !trimmed.endsWith('。')) {
    return 'incomplete'
  }

  // Has sentence-ending punctuation → likely complete
  if (/[.。!！?？]$/.test(trimmed)) return 'complete'

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
  const { content, source, hints } = input

  // Physical: use hint if provided, else heuristic
  const physical = hints?.physical
    ? resolved(hints.physical)
    : (() => {
        const classified = classifyPhysical(content)
        return classified ? resolved(classified) : unresolved<PPhysicalType>()
      })()

  // Semantic: use hint if provided, else leave for binder
  const semantic = hints?.semantic
    ? resolved(hints.semantic)
    : unresolved<PSemanticType>()

  // Value attributes: heuristic classification
  const certaintyResult = classifyCertainty(content)
  const certainty = certaintyResult ? resolved(certaintyResult) : unresolved<PCertainty>()

  const completenessResult = classifyCompleteness(content)
  const completeness = completenessResult
    ? resolved(completenessResult)
    : unresolved<PCompleteness>()

  return {
    id: generateTokenId(),
    timestamp: Date.now(),
    rawContent: content,
    source,
    destination: unresolved(),   // always starts unknown — binder infers
    physical,
    semantic,
    certainty,
    completeness,
    truth: unresolved(),          // truth requires external verification — never guessed
  }
}

/**
 * scanBatch() — scan multiple inputs in order.
 * Returns tokens in same order as inputs.
 */
export function scanBatch(inputs: readonly ScannerInput[]): readonly PatternToken[] {
  return inputs.map(scan)
}
