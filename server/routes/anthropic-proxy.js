/**
 * server/routes/anthropic-proxy.js
 *
 * Transparent forwarding proxy to api.anthropic.com, running in the
 * trusted (bornfly) control plane. Isolated harness agents (egonetics-l2
 * under sudo -u) hit this proxy instead of the real API.
 *
 * Purpose:
 *   1. Agent never sees the real ANTHROPIC_API_KEY / OAuth token
 *   2. Real credentials stay in the backend process memory (bornfly)
 *   3. Agent uses a dummy session token; proxy substitutes real creds
 *   4. Every request is auditable (log destination, byte count, status)
 *
 * Mounted at: /proxy/anthropic  (before auth middleware — localhost only)
 *
 * Endpoints:
 *   POST /v1/messages           — forward to api.anthropic.com/v1/messages
 *   GET  /health                — proxy status + whether credentials configured
 *
 * Agent env vars:
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:3002/proxy/anthropic
 *   ANTHROPIC_API_KEY=sess-dummy-any-string-is-fine
 *
 * Backend env vars (real credentials):
 *   ANTHROPIC_API_KEY=sk-ant-...    (read from process.env, NOT forwarded to agents)
 */

'use strict'

const express = require('express')
const https = require('https')
const router = express.Router()

const UPSTREAM_HOST = 'api.anthropic.com'
const UPSTREAM_PORT = 443
const DEFAULT_ANTHROPIC_VERSION = '2023-06-01'

/**
 * Get real upstream credentials from backend env.
 * Never forwarded to the agent; only used server-side.
 */
function getRealApiKey() {
  return process.env.ANTHROPIC_API_KEY || ''
}

/**
 * Audit log entry — printed to server console for now.
 * TODO(phase-1.5): persist to chronicle DB with instance_id binding.
 */
function audit(kind, detail) {
  console.log(`[anthropic-proxy] ${kind}`, detail)
}

// ── POST /v1/messages ─────────────────────────────────────────────────

router.post('/v1/messages', (req, res) => {
  const realKey = getRealApiKey()
  if (!realKey) {
    return res.status(503).json({
      type: 'error',
      error: {
        type: 'proxy_not_configured',
        message:
          'ANTHROPIC_API_KEY not set in backend environment. ' +
          'Get a key from https://console.anthropic.com/ and add it to egonetics/.env or export it before starting the backend.',
      },
    })
  }

  const body = JSON.stringify(req.body)
  const bodyLen = Buffer.byteLength(body)
  const isStream = req.body && req.body.stream === true
  const model = (req.body && req.body.model) || 'unknown'

  audit('request', {
    model,
    stream: isStream,
    body_bytes: bodyLen,
    messages: Array.isArray(req.body?.messages) ? req.body.messages.length : 0,
  })

  const options = {
    hostname: UPSTREAM_HOST,
    port: UPSTREAM_PORT,
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': bodyLen,
      'x-api-key': realKey,
      'anthropic-version': req.headers['anthropic-version'] || DEFAULT_ANTHROPIC_VERSION,
      'anthropic-beta': req.headers['anthropic-beta'] || '',
      'user-agent': 'egonetics-anthropic-proxy/1.0',
    },
  }
  // Drop empty headers (Anthropic rejects empty anthropic-beta)
  for (const [k, v] of Object.entries(options.headers)) {
    if (v === '' || v === undefined) delete options.headers[k]
  }

  const upstream = https.request(options, (upstreamRes) => {
    // Pass through status code
    res.status(upstreamRes.statusCode || 500)

    // Pass through response headers except hop-by-hop
    const HOP_BY_HOP = new Set([
      'connection',
      'keep-alive',
      'proxy-authenticate',
      'proxy-authorization',
      'te',
      'trailers',
      'transfer-encoding',
      'upgrade',
    ])
    for (const [k, v] of Object.entries(upstreamRes.headers || {})) {
      if (!HOP_BY_HOP.has(k.toLowerCase())) {
        res.setHeader(k, v)
      }
    }

    let responseBytes = 0
    upstreamRes.on('data', (chunk) => {
      responseBytes += chunk.length
    })
    upstreamRes.on('end', () => {
      audit('response', {
        status: upstreamRes.statusCode,
        bytes: responseBytes,
        model,
      })
    })

    upstreamRes.pipe(res)
  })

  upstream.on('error', (err) => {
    audit('upstream_error', { message: err.message })
    if (!res.headersSent) {
      res.status(502).json({
        type: 'error',
        error: { type: 'upstream_error', message: err.message },
      })
    } else {
      res.end()
    }
  })

  // Handle client disconnect — abort upstream request
  req.on('close', () => {
    if (!upstream.destroyed) {
      upstream.destroy()
    }
  })

  upstream.write(body)
  upstream.end()
})

// ── GET /health ───────────────────────────────────────────────────────

router.get('/health', (_req, res) => {
  res.json({
    ok: true,
    configured: !!getRealApiKey(),
    upstream: `https://${UPSTREAM_HOST}`,
    note: getRealApiKey()
      ? 'ANTHROPIC_API_KEY present in backend env'
      : 'ANTHROPIC_API_KEY missing — set it in backend env to enable proxy',
  })
})

module.exports = router
