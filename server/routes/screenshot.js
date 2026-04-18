/**
 * server/routes/screenshot.js
 *
 * POST /api/screenshot — Headless screenshot via Playwright.
 * Accepts JSON body, returns PNG binary or JSON with base64.
 *
 * Body:
 *   url        string   required  Full URL to screenshot
 *   selector   string   optional  CSS selector — screenshot specific element
 *   wait       number   optional  Extra ms to wait after networkidle (default 0)
 *   width      number   optional  Viewport width (default 1280)
 *   height     number   optional  Viewport height (default 800)
 *   fullPage   boolean  optional  Full-page screenshot (default true)
 *   format     string   optional  "png" (binary response) | "json" (base64, default "png")
 *
 * Response (format=png):   Content-Type: image/png  — raw bytes
 * Response (format=json):  { url, selector, timestamp, width, height, image: "<base64>" }
 *
 * Auth: requires valid JWT (same middleware as other /api routes).
 */

'use strict'

const express = require('express')
const router  = express.Router()

// ── Screenshot handler ────────────────────────────────────────────────────────

router.post('/screenshot', async (req, res) => {
  const {
    url,
    selector  = null,
    wait      = 0,
    width     = 1280,
    height    = 800,
    fullPage  = true,
    format    = 'png',
  } = req.body || {}

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url is required' })
  }

  // Only allow localhost/127.0.0.1 to prevent SSRF against external hosts.
  // Adjust this allowlist if you need to screenshot staging URLs etc.
  try {
    const parsed = new URL(url)
    const allowed = ['localhost', '127.0.0.1', '::1']
    if (!allowed.includes(parsed.hostname)) {
      return res.status(403).json({ error: `url host "${parsed.hostname}" not in allowlist` })
    }
  } catch {
    return res.status(400).json({ error: 'invalid url' })
  }

  let chromium, browser
  try {
    ;({ chromium } = require('playwright'))
  } catch {
    return res.status(503).json({ error: 'playwright not installed (npm install playwright)' })
  }

  try {
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage({ viewport: { width: Number(width), height: Number(height) } })
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })

    if (wait > 0) await page.waitForTimeout(Number(wait))

    let buf
    if (selector) {
      const el = page.locator(selector)
      await el.waitFor({ timeout: 10000 })
      buf = await el.screenshot()
    } else {
      buf = await page.screenshot({ fullPage: Boolean(fullPage) })
    }

    if (format === 'json') {
      return res.json({
        url,
        selector,
        timestamp: new Date().toISOString(),
        width: Number(width),
        height: Number(height),
        image: buf.toString('base64'),
      })
    }

    res.type('png').send(buf)
  } catch (err) {
    res.status(500).json({ error: err.message })
  } finally {
    if (browser) await browser.close().catch(() => {})
  }
})

module.exports = router
