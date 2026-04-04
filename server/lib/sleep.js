/**
 * sleep.js
 * Ported from OpenClaudeCode/src/utils/sleep.ts
 *
 * Abort-responsive sleep and timeout utilities.
 * Unlike plain setTimeout, these respond immediately to AbortSignal.
 */

'use strict'

/**
 * Abort-responsive sleep.
 * Resolves after ms, or immediately when signal aborts.
 *
 * @param {number} ms
 * @param {AbortSignal} [signal]
 * @param {{ throwOnAbort?: boolean, unref?: boolean }} [opts]
 */
function sleep(ms, signal, opts = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      if (opts.throwOnAbort) return reject(new Error('aborted'))
      return resolve()
    }

    function onAbort() {
      clearTimeout(timer)
      if (opts.throwOnAbort) reject(new Error('aborted'))
      else resolve()
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)

    signal?.addEventListener('abort', onAbort, { once: true })

    if (opts.unref && typeof timer === 'object') timer.unref?.()
  })
}

/**
 * Race a promise against a timeout.
 * Rejects with Error(message) if promise doesn't settle within ms.
 * Timer is unref'd so it won't block process exit.
 *
 * @param {Promise<T>} promise
 * @param {number} ms
 * @param {string} message
 * @returns {Promise<T>}
 */
function withTimeout(promise, ms, message) {
  let timer
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms)
    if (typeof timer === 'object') timer.unref?.()
  })
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer !== undefined) clearTimeout(timer)
  })
}

module.exports = { sleep, withTimeout }
