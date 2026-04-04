/**
 * abort-controller.js
 * Ported from OpenClaudeCode/src/utils/abortController.ts
 *
 * WeakRef-safe AbortController factory.
 * - createAbortController(): sets MaxListeners to avoid warning spam
 * - createChildAbortController(): parent abort propagates to child,
 *   child abort cleans up parent listener, GC-safe via WeakRef
 */

'use strict'

const { setMaxListeners } = require('events')

const DEFAULT_MAX_LISTENERS = 50

function createAbortController(maxListeners = DEFAULT_MAX_LISTENERS) {
  const controller = new AbortController()
  setMaxListeners(maxListeners, controller.signal)
  return controller
}

function propagateAbort(weakParent, weakChild) {
  const parent = weakParent.deref()
  weakChild.deref()?.abort(parent?.signal.reason)
}

function removeAbortHandler(weakParent, weakHandler) {
  const parent = weakParent.deref()
  const handler = weakHandler.deref()
  if (parent && handler) {
    parent.signal.removeEventListener('abort', handler)
  }
}

/**
 * Creates a child AbortController that aborts when parent aborts.
 * Aborting child does NOT affect parent.
 * GC-safe: parent holds only a WeakRef to child — abandoned children can be GC'd.
 */
function createChildAbortController(parent, maxListeners) {
  const child = createAbortController(maxListeners)

  // Fast path: parent already aborted
  if (parent.signal.aborted) {
    child.abort(parent.signal.reason)
    return child
  }

  const weakChild = new WeakRef(child)
  const weakParent = new WeakRef(parent)
  const handler = propagateAbort.bind(null, weakParent, weakChild)

  parent.signal.addEventListener('abort', handler, { once: true })

  // Cleanup: remove parent listener when child aborts (from any source)
  child.signal.addEventListener(
    'abort',
    removeAbortHandler.bind(null, weakParent, new WeakRef(handler)),
    { once: true },
  )

  return child
}

module.exports = { createAbortController, createChildAbortController }
