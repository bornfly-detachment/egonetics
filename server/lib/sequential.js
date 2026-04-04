/**
 * sequential.js
 * Ported from OpenClaudeCode/src/utils/sequential.ts
 *
 * Wraps an async function so concurrent calls are queued and executed
 * one at a time in arrival order. Return values are delivered to each
 * caller correctly regardless of queue depth.
 *
 * Use for write-type tool calls that must not run concurrently.
 *
 * @example
 *   const seqWrite = sequential(writeFile)
 *   // All concurrent callers queue up; each gets their own result
 *   await Promise.all([seqWrite(a), seqWrite(b), seqWrite(c)])
 */

'use strict'

function sequential(fn) {
  const queue = []
  let processing = false

  async function processQueue() {
    if (processing || queue.length === 0) return
    processing = true
    while (queue.length > 0) {
      const { args, resolve, reject, context } = queue.shift()
      try {
        resolve(await fn.apply(context, args))
      } catch (err) {
        reject(err)
      }
    }
    processing = false
    if (queue.length > 0) void processQueue()
  }

  return function (...args) {
    return new Promise((resolve, reject) => {
      queue.push({ args, resolve, reject, context: this })
      void processQueue()
    })
  }
}

module.exports = { sequential }
