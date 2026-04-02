/**
 * task-state-machine.js — 任务状态机管理
 *
 * Enforces valid task lifecycle transitions and integrates with the Kernel.
 * State machine: planned → in-progress → blocked | done
 *                blocked → in-progress | done
 *
 * Registers kernel contracts for state enforcement.
 * Publishes state change events to MQ channel 'task-state'.
 *
 * Valid transitions:
 *   planned     → in-progress
 *   in-progress → blocked, done
 *   blocked     → in-progress, done
 *   done        → (terminal, no transitions)
 */

const mq = require('./mq')

// ── State machine definition ──────────────────────────────────────────────────

const VALID_TRANSITIONS = {
  planned:        ['in-progress'],
  'in-progress':  ['blocked', 'done'],
  blocked:        ['in-progress', 'done'],
  done:           [],  // terminal state
}

/**
 * Check if a transition is valid.
 * Returns { valid: boolean, reason?: string }
 */
function checkTransition(fromState, toState) {
  if (!fromState) {
    // No current state — allow any initial assignment
    return { valid: true }
  }

  const allowed = VALID_TRANSITIONS[fromState]
  if (allowed === undefined) {
    // Unknown from-state: allow (don't block unknown column IDs)
    return { valid: true }
  }

  if (allowed.length === 0) {
    return {
      valid: false,
      reason: `State "${fromState}" is terminal — no further transitions allowed`,
    }
  }

  if (!allowed.includes(toState)) {
    return {
      valid: false,
      reason: `Invalid transition: "${fromState}" → "${toState}". Allowed: ${allowed.join(', ')}`,
    }
  }

  return { valid: true }
}

/**
 * Record a state transition in the kernel and MQ.
 * Called after a task column_id is successfully updated.
 */
async function recordTransition(taskId, fromState, toState, kernelRuntime) {
  // Update kernel nodes to reflect new state distribution
  try {
    if (kernelRuntime) {
      // Update task-state-{fromState} count (decrement)
      if (fromState && VALID_TRANSITIONS[fromState] !== undefined) {
        const fromNode = `task-state-${fromState}`
        const kr = kernelRuntime
        const state = kr.getState()
        const node = state.nodes[fromNode]
        const currentCount = node?.values?.count || 0
        kr.setNodeValue(fromNode, 'count', Math.max(0, currentCount - 1))
      }

      // Update task-state-{toState} count (increment)
      const toNode = `task-state-${toState}`
      const kr = kernelRuntime
      const state = kr.getState()
      const node = state.nodes[toNode]
      const currentCount = node?.values?.count || 0
      kr.setNodeValue(toNode, 'count', currentCount + 1)

      // If transitioning to done: signal the completion contract
      if (toState === 'done') {
        kr.setNodeValue('task-state-done', 'just_completed', true)
        kr.setNodeValue('task-state-done', 'task_id', taskId)
      }

      // If transitioning to blocked: update blocked count
      if (toState === 'blocked') {
        const blockedState = kr.getState().nodes['task-state-blocked']
        const blockedCount = blockedState?.values?.count || 0
        kr.setNodeValue('task-state-blocked', 'count', blockedCount + 1)
      }
    }
  } catch (err) {
    console.error('[task-state-machine] kernel update error:', err.message)
  }

  // Publish to MQ
  try {
    const eventType = toState === 'done' ? 'task_completed'
      : toState === 'blocked' ? 'task_blocked'
      : toState === 'in-progress' ? 'task_started'
      : 'task_state_changed'

    await mq.publish({
      channel: 'task-state',
      event_type: eventType,
      tier: 'T0',
      source_id: taskId,
      payload: {
        task_id: taskId,
        from_state: fromState,
        to_state: toState,
        transitioned_at: new Date().toISOString(),
      },
    })
  } catch (err) {
    console.error('[task-state-machine] MQ publish error:', err.message)
  }
}

/**
 * Register state machine kernel contracts.
 * Idempotent — contracts have fixed IDs.
 */
function registerContracts(kernelRuntime) {
  const kr = kernelRuntime

  // Ensure state nodes exist
  const states = ['planned', 'in-progress', 'blocked', 'done']
  for (const s of states) {
    try {
      kr.addNode(`task-state-${s}`, { state: s, count: 0 })
    } catch {
      // Node may already exist — ignore
    }
  }

  // Contract: task completion logger
  try {
    kr.registerContract({
      id: 'contract-task-done-logger',
      type: 'dynamic',
      priority: 8,
      participants: ['task-state-done'],
      conditionCode: `
        const done = state.nodes.get('task-state-done');
        return done && done.values.get('just_completed') === true;
      `,
      emitCode: `
        const done = state.nodes.get('task-state-done');
        const taskId = done && done.values.get('task_id');
        return [
          {type:'log', message:'Task completed: ' + taskId},
          {type:'patch', nodeId:'task-state-done', field:'just_completed', value: false}
        ];
      `,
    }, 'system')
  } catch {
    // Already registered
  }

  // Contract: blocked escalation trigger
  try {
    kr.registerContract({
      id: 'contract-task-blocked-escalation',
      type: 'dynamic',
      priority: 7,
      participants: ['task-state-blocked'],
      conditionCode: `
        const blocked = state.nodes.get('task-state-blocked');
        return blocked && (blocked.values.get('count') || 0) > 0;
      `,
      emitCode: `
        const blocked = state.nodes.get('task-state-blocked');
        const count = blocked && (blocked.values.get('count') || 0);
        return [{type:'log', message:'Tasks blocked: ' + count + ' — escalation check triggered'}];
      `,
    }, 'system')
  } catch {
    // Already registered
  }

  console.log('[task-state-machine] contracts registered')
}

module.exports = { checkTransition, recordTransition, registerContracts, VALID_TRANSITIONS }
