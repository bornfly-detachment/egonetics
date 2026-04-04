/**
 * circular-buffer.js
 * Ported from OpenClaudeCode/src/utils/CircularBuffer.ts
 *
 * Fixed-size circular buffer. Evicts oldest items when full.
 * More memory-efficient than Array.shift() — pre-allocated, O(1) add.
 */

'use strict'

class CircularBuffer {
  constructor(capacity) {
    this.capacity = capacity
    this.buffer = new Array(capacity)
    this.head = 0
    this.size = 0
  }

  /** Add one item. Evicts oldest if full. */
  add(item) {
    this.buffer[this.head] = item
    this.head = (this.head + 1) % this.capacity
    if (this.size < this.capacity) this.size++
  }

  /** Add multiple items at once. */
  addAll(items) {
    for (const item of items) this.add(item)
  }

  /** Get the most recent N items, oldest→newest. */
  getRecent(count) {
    const result = []
    const start = this.size < this.capacity ? 0 : this.head
    const available = Math.min(count, this.size)
    for (let i = 0; i < available; i++) {
      const index = (start + this.size - available + i) % this.capacity
      result.push(this.buffer[index])
    }
    return result
  }

  /** Get all items, oldest→newest. */
  toArray() {
    if (this.size === 0) return []
    const result = []
    const start = this.size < this.capacity ? 0 : this.head
    for (let i = 0; i < this.size; i++) {
      result.push(this.buffer[(start + i) % this.capacity])
    }
    return result
  }

  /** Remove all items. */
  clear() {
    this.buffer = new Array(this.capacity)
    this.head = 0
    this.size = 0
  }

  /** Current item count. */
  length() { return this.size }
}

module.exports = { CircularBuffer }
