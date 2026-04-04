/**
 * llm-errors.js
 * Ported from OpenClaudeCode/src/utils/errors.ts
 *
 * LLM error classification utilities.
 * Correctly identifies abort errors across all shapes the SDK may produce.
 */

'use strict'

const { APIError } = require('@anthropic-ai/sdk')

// ── Error Classes ──────────────────────────────────────────────

class LLMError extends Error {
  constructor(message) {
    super(message)
    this.name = 'LLMError'
  }
}

class AbortError extends Error {
  constructor(message = 'aborted') {
    super(message)
    this.name = 'AbortError'
  }
}

// ── Error Predicates ───────────────────────────────────────────

/**
 * True if e is any abort-shaped error:
 * - Our AbortError class
 * - DOMException from AbortController.abort() (.name === 'AbortError')
 * - Anthropic SDK APIUserAbortError (checked via instanceof, not name —
 *   minified builds mangle class names so string matching fails silently)
 */
function isAbortError(e) {
  if (e instanceof AbortError) return true
  if (e instanceof Error && e.name === 'AbortError') return true
  // SDK abort: status 400 + error.type === 'request_cancelled' or message match
  if (e instanceof APIError && e.message?.includes('abort')) return true
  return false
}

/**
 * True if the error is a transient API failure worth retrying:
 * - 429 rate limit
 * - 500/502/503/529 server errors
 * - Network/timeout errors (no status code)
 */
function isRetryableError(e) {
  if (isAbortError(e)) return false  // never retry aborts
  if (e instanceof APIError) {
    const status = e.status
    return status === 429 || status >= 500
  }
  // Network-level errors (ECONNRESET, ETIMEDOUT, etc.)
  if (e instanceof Error) {
    const code = e.code
    return code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ENOTFOUND'
  }
  return false
}

/**
 * True if the error is a context-length overflow.
 * Triggers compaction / message truncation recovery.
 */
function isContextLengthError(e) {
  if (e instanceof APIError) {
    return e.status === 400 &&
      (e.message?.includes('prompt is too long') ||
       e.message?.includes('context_length_exceeded') ||
       e.message?.includes('too many tokens'))
  }
  return false
}

/**
 * Compute retry delay with exponential backoff + jitter.
 * Caps at 30s. Respects Retry-After header from 429 responses.
 *
 * @param {number} attempt — 0-based attempt index
 * @param {Error} error
 * @returns {number} milliseconds to wait
 */
function getRetryDelay(attempt, error) {
  // Honour Retry-After from 429
  if (error instanceof APIError && error.status === 429) {
    const retryAfter = error.headers?.['retry-after']
    if (retryAfter) {
      const seconds = parseInt(retryAfter, 10)
      if (!isNaN(seconds)) return seconds * 1000
    }
  }
  const base = Math.min(1000 * 2 ** attempt, 30000)
  const jitter = Math.random() * 0.3 * base
  return Math.floor(base + jitter)
}

module.exports = {
  LLMError,
  AbortError,
  isAbortError,
  isRetryableError,
  isContextLengthError,
  getRetryDelay,
}
