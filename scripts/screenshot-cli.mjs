/**
 * screenshot-cli.mjs — Standalone headless screenshot utility
 *
 * Usage:
 *   node scripts/screenshot-cli.mjs <url> [output] [options]
 *   npm run screenshot -- <url> [output] [options]
 *
 * Options:
 *   --selector <css>   Screenshot a specific element instead of full page
 *   --wait <ms>        Extra wait after networkidle (default: 0)
 *   --width <px>       Viewport width (default: 1280)
 *   --height <px>      Viewport height (default: 800)
 *   --full             Full-page screenshot (default: true)
 *
 * Examples:
 *   node scripts/screenshot-cli.mjs http://localhost:3000/resources
 *   node scripts/screenshot-cli.mjs http://localhost:3000/resources /tmp/resources.png
 *   node scripts/screenshot-cli.mjs http://localhost:3000 out.png --selector ".sidebar"
 *   node scripts/screenshot-cli.mjs http://localhost:3000 out.png --wait 2000
 *
 * Output: saves PNG to output path (default: screenshots/<slug>-<timestamp>.png)
 *         prints JSON { path, url, timestamp, width, height } to stdout
 */

import { chromium } from 'playwright'
import { mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Arg parsing ──────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const positional = []
  const flags = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2)
      const next = argv[i + 1]
      if (next && !next.startsWith('--')) {
        flags[key] = next
        i++
      } else {
        flags[key] = true
      }
    } else {
      positional.push(argv[i])
    }
  }
  return { positional, flags }
}

const { positional, flags } = parseArgs(process.argv.slice(2))
const url = positional[0]

if (!url) {
  console.error('Usage: screenshot-cli.mjs <url> [output] [--selector <css>] [--wait <ms>] [--width <px>] [--height <px>]')
  process.exit(1)
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const slug = url.replace(/https?:\/\//, '').replace(/[^a-zA-Z0-9]/g, '-').slice(0, 60)
const defaultOut = join(__dirname, '..', 'screenshots', `${slug}-${timestamp}.png`)
const outPath = positional[1] || defaultOut
const selector = flags.selector || null
const waitMs = parseInt(flags.wait || '0', 10)
const width = parseInt(flags.width || '1280', 10)
const height = parseInt(flags.height || '800', 10)
const fullPage = flags.full !== false

// Ensure output directory exists
mkdirSync(dirname(outPath), { recursive: true })

// ── Screenshot ───────────────────────────────────────────────────────────────

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width, height } })

try {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
  if (waitMs > 0) await page.waitForTimeout(waitMs)

  if (selector) {
    const el = page.locator(selector)
    await el.waitFor({ timeout: 10000 })
    await el.screenshot({ path: outPath })
  } else {
    await page.screenshot({ path: outPath, fullPage })
  }

  const result = { path: outPath, url, timestamp: new Date().toISOString(), width, height, selector }
  console.log(JSON.stringify(result))
} finally {
  await browser.close()
}
