/**
 * server/lib/harness-manager/cli-runner.js
 *
 * Claude-added (2026-04-18): Concrete runCli bridge for non-interactive CLI dispatch.
 *
 * Implements the RunnerDependencies.runCli interface defined in:
 *   prvse_world_workspace/src/ai-resources/types.ts
 *
 * transportHint → actual spawn convention:
 *   claude-cli  → claude -p <prompt> --output-format stream-json --dangerously-skip-permissions
 *   codex-cli   → codex exec <prompt>
 *   gemini-cli  → gemini --prompt <prompt> --yolo
 *
 * All runners return: { output: string, meta: { exitCode, durationMs } }
 * Throws on non-zero exit or spawn failure (orchestrator retries on retryable errors).
 */

'use strict'

const { spawn } = require('child_process')
const fs   = require('fs')
const path = require('path')
const os   = require('os')

const BINARY_MAP = {
  'claude-cli': process.env.CLAUDE_BIN || '/Users/bornfly/.npm-global/bin/claude',
  'codex-cli':  process.env.CODEX_BIN  || '/Users/bornfly/.npm-global/bin/codex',
  'gemini-cli': process.env.GEMINI_BIN || '/Users/bornfly/.npm-global/bin/gemini',
}

// ── Retryable error detection ───────────────────────────────────────────────

const RETRYABLE_PATTERNS = [
  /rate.?limit/i,
  /429/,
  /503/,
  /overloaded/i,
  /temporarily unavailable/i,
  /timeout/i,
  /ECONNRESET/,
  /ETIMEDOUT/,
]

function isRetryable(message) {
  return RETRYABLE_PATTERNS.some(p => p.test(message))
}

// ── Env-file loader (same logic as harness runner) ──────────────────────────

function parseEnvFile(filePath) {
  if (!filePath) return {}
  const expanded = filePath.replace(/^~/, os.homedir())
  try {
    const content = fs.readFileSync(expanded, 'utf8')
    const result = {}
    for (const raw of content.split('\n')) {
      const line = raw.replace(/^export\s+/, '').trim()
      if (!line || line.startsWith('#')) continue
      const eq = line.indexOf('=')
      if (eq < 1) continue
      const key = line.slice(0, eq).trim()
      let val = line.slice(eq + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      result[key] = val
    }
    return result
  } catch {
    return {}
  }
}

// ── Spawn helper ─────────────────────────────────────────────────────────────

function spawnCapture(bin, args, env) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now()
    const proc = spawn(bin, args, {
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    const stdoutChunks = []
    const stderrChunks = []
    proc.stdout.on('data', c => stdoutChunks.push(c))
    proc.stderr.on('data', c => stderrChunks.push(c))

    proc.on('error', err => reject(err))
    proc.on('close', exitCode => {
      const stdout = Buffer.concat(stdoutChunks).toString('utf8').trim()
      const stderr = Buffer.concat(stderrChunks).toString('utf8').trim()
      const durationMs = Date.now() - t0

      if (exitCode !== 0) {
        const msg = stderr || stdout || `exit code ${exitCode}`
        const err = new Error(msg)
        err.exitCode = exitCode
        err.retryable = isRetryable(msg)
        return reject(err)
      }

      resolve({ output: stdout, meta: { exitCode: 0, durationMs } })
    })
  })
}

// ── Transport adapters ───────────────────────────────────────────────────────

async function runClaudeCli(spec) {
  const bin = spec.binary || BINARY_MAP['claude-cli']
  const args = [
    '-p', spec.prompt,
    '--output-format', 'stream-json',
    '--dangerously-skip-permissions',
    '--max-turns', '1',
  ]
  const env = parseEnvFile(spec.envFile)
  const { output, meta } = await spawnCapture(bin, args, env)

  // Extract text from stream-json lines
  let text = ''
  for (const line of output.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      const msg = JSON.parse(trimmed)
      if (msg.type === 'assistant') {
        for (const block of msg.message?.content ?? []) {
          if (block.type === 'text') text += block.text
        }
      } else if (msg.type === 'result') {
        if (msg.result) text = msg.result  // prefer final result
      }
    } catch { /* skip non-JSON lines */ }
  }

  return { output: text || output, meta }
}

async function runCodexCli(spec) {
  const bin = spec.binary || BINARY_MAP['codex-cli']
  // codex exec reads prompt from arg or stdin
  const args = ['exec', spec.prompt]
  const env = parseEnvFile(spec.envFile)
  return spawnCapture(bin, args, env)
}

async function runGeminiCli(spec) {
  const bin = spec.binary || BINARY_MAP['gemini-cli']
  const args = ['--prompt', spec.prompt, '--yolo']
  const env = parseEnvFile(spec.envFile)
  return spawnCapture(bin, args, env)
}

// ── Public runCli bridge ─────────────────────────────────────────────────────

/**
 * Concrete runCli implementation — matches RunnerDependencies.runCli signature.
 *
 * @param {import('../../../prvse_world_workspace/src/ai-resources/types').CliCommandSpec} spec
 * @returns {Promise<{output: string, meta: Record<string, string|number|boolean>}>}
 */
async function runCli(spec) {
  switch (spec.transportHint) {
    case 'claude-cli': return runClaudeCli(spec)
    case 'codex-cli':  return runCodexCli(spec)
    case 'gemini-cli': return runGeminiCli(spec)
    default:
      throw new Error(`Unknown transportHint: "${spec.transportHint}"`)
  }
}

module.exports = { runCli, BINARY_MAP, isRetryable }
