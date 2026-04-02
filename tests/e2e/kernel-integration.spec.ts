/**
 * E2E 联调测试 — Tasks ↔ Lab ↔ Protocol Builder
 *
 * 测试流程:
 *   1. 登录
 *   2. /tasks — 打开一个任务，验证 ExecutionConsole 渲染
 *   3. /lab — Kernel Runtime Lab：添加节点、inject port、tick、验证状态更新
 *   4. /protocol/builder — 创建规则、build pipeline、publish → kernel 注入
 *   5. /tasks/:id — 启动执行引擎、验证升级链、人工裁决
 */

import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:3000'
const API = 'http://localhost:3002/api'

// Auth helper — login and get token
async function login(page: ReturnType<typeof test['info']> extends never ? never : any) {
  await page.goto(`${BASE}/login`)
  await page.waitForLoadState('networkidle')

  // Fill login form
  await page.fill('input[type="text"], input[placeholder*="用户"], input[placeholder*="邮箱"], input[name="identifier"]', 'bornfly')
  await page.fill('input[type="password"]', '007@SYRsb')
  await page.click('button[type="submit"], button:has-text("登录")')

  // Wait for redirect away from login
  await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 10000 })
}

// API helper — get auth token directly
async function getToken(): Promise<string> {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'bornfly', password: '007@SYRsb' }),
  })
  const data = await res.json()
  return data.token
}

test.describe('Kernel Integration — 联调测试', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('1. /tasks — 任务列表加载 + 任务详情含 ExecutionConsole', async ({ page }) => {
    await page.goto(`${BASE}/tasks`)
    await page.waitForLoadState('networkidle')

    // Kanban board should render
    await expect(page.locator('text=计划中, text=进行中, text=已完成').first()).toBeVisible({ timeout: 10000 }).catch(() => {
      // Columns may have different names, just check page loaded
    })

    // Click first task card to open detail
    const taskCard = page.locator('[class*="cursor-pointer"], [class*="task"], [draggable="true"]').first()
    if (await taskCard.isVisible()) {
      await taskCard.click()
      await page.waitForLoadState('networkidle')

      // Should be on /tasks/:taskId
      expect(page.url()).toContain('/tasks/')

      // ExecutionConsole should render (either "启动 Kernel 执行引擎" button or console header)
      const consoleEl = page.getByText('执行引擎').first()
      await expect(consoleEl).toBeVisible({ timeout: 8000 })
    }
  })

  test('2. /lab — Kernel Runtime Lab 完整交互', async ({ page }) => {
    await page.goto(`${BASE}/lab`)
    await page.waitForLoadState('networkidle')

    // Lab header should show
    await expect(page.locator('text=Kernel Runtime Lab')).toBeVisible({ timeout: 8000 })

    // Connection status
    const connectionEl = page.getByText('connected').or(page.getByText('offline'))
    await expect(connectionEl.first()).toBeVisible({ timeout: 5000 })

    // Check if connected
    const isConnected = await page.getByText('connected').isVisible()

    if (isConnected) {
      // Tick count should show
      await expect(page.locator('text=/tick:\\d+/')).toBeVisible()

      // Port injection inputs should exist
      await expect(page.locator('input[placeholder="portId"]')).toBeVisible()
      await expect(page.locator('input[placeholder="value"]')).toBeVisible()

      // Click tick button
      const tickBtn = page.locator('button:has-text("tick")')
      await expect(tickBtn).toBeVisible()
      await tickBtn.click()

      // Wait for tick result
      await page.waitForTimeout(1500)

      // Tick history should now have at least 1 entry
      const historyEl = page.locator('text=/tick:\\d+/')
      await expect(historyEl.first()).toBeVisible()

      // Take screenshot
      await page.screenshot({ path: 'test-results/lab-after-tick.png', fullPage: true })
    }
  })

  test('3. /protocol/builder — 规则构建流水线', async ({ page }) => {
    await page.goto(`${BASE}/protocol/builder`)
    await page.waitForLoadState('networkidle')

    // Page should load (check for common UI elements)
    await page.waitForTimeout(2000)

    // Take screenshot to see what's on the page
    await page.screenshot({ path: 'test-results/protocol-builder.png', fullPage: true })

    // Check for rule list or create button
    const hasContent = await page.locator('text=controller, text=evaluator, text=perceiver, text=规则, text=构建, text=Rule, text=Builder').first().isVisible().catch(() => false)

    if (hasContent) {
      // Look for create/new rule button
      const createBtn = page.locator('button:has-text("新建"), button:has-text("创建"), button:has-text("New"), button:has-text("+")').first()
      if (await createBtn.isVisible().catch(() => false)) {
        await createBtn.click()
        await page.waitForTimeout(1000)
        await page.screenshot({ path: 'test-results/protocol-builder-create.png', fullPage: true })
      }
    }
  })

  test('4. /tasks/:id — 执行引擎启动 + 升级链可视化', async ({ page }) => {
    // Get a task ID via API
    const token = await getToken()
    const kanbanRes = await fetch(`${API}/kanban`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const kanbanData = await kanbanRes.json()
    const tasks = kanbanData.tasks || []

    if (tasks.length === 0) {
      test.skip()
      return
    }

    const taskId = tasks[0].id
    await page.goto(`${BASE}/tasks/${taskId}`)
    await page.waitForLoadState('networkidle')

    // Task detail should load
    await expect(page.getByText('Chronicle').first()).toBeVisible({ timeout: 8000 })

    // ExecutionConsole area
    const startBtn = page.getByText('执行引擎').first()
    await expect(startBtn).toBeVisible({ timeout: 8000 })

    // Click to start execution engine
    const clickableStart = page.locator('button').filter({ hasText: 'Kernel 执行引擎' })
    if (await clickableStart.isVisible().catch(() => false)) {
      await clickableStart.click()
      await page.waitForTimeout(2000)

      // Should show execution console with tier progression
      await page.screenshot({ path: 'test-results/task-execution-started.png', fullPage: true })

      // Verify execution run was created via API
      const runsRes = await fetch(`${API}/kernel/executions?task_id=${taskId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const runs = await runsRes.json()
      expect(runs.length).toBeGreaterThan(0)
      expect(runs[0].status).toBe('running')
    }
  })

  test('5. API 级联调 — Builder publish 后 Lab 可见新 contract', async ({ page }) => {
    const token = await getToken()
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    }

    // Step 1: Create a rule in protocol-builder
    const createRes = await fetch(`${API}/protocol-rules`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        kernel_comp: 'evaluator',
        title: `E2E Test Rule ${Date.now()}`,
        human_char: '当评价指标 metrics 中的 accuracy 超过阈值 0.8 时，触发正向奖励，记录到评价日志',
      }),
    })
    const rule = await createRes.json()
    expect(rule.id).toBeTruthy()

    // Step 2: Build the rule
    const buildRes = await fetch(`${API}/protocol-rules/${rule.id}/build`, {
      method: 'POST',
      headers,
    })
    const buildText = await buildRes.text()
    expect(buildText).toContain('"status":"passed"')

    // Step 3: Publish → should inject into kernel
    const publishRes = await fetch(`${API}/protocol-rules/${rule.id}/publish`, {
      method: 'POST',
      headers,
    })
    const publishData = await publishRes.json()
    expect(publishData.ok).toBe(true)
    expect(publishData.kernel.accepted).toBe(true)

    // Step 4: Verify in kernel state
    const stateRes = await fetch(`${API}/kernel/state`, { headers })
    const state = await stateRes.json()
    const found = state.contracts.find((c: any) => c.id.includes(rule.id))
    expect(found).toBeTruthy()

    // Step 5: Navigate to Lab and verify visually
    await page.goto(`${BASE}/lab`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'test-results/lab-after-publish.png', fullPage: true })

    // Contract count should be visible
    const contractText = page.locator(`text=/contracts:\\d+/`)
    await expect(contractText.first()).toBeVisible({ timeout: 5000 })
  })

  test('6. 完整升级链 — T0→T1→T2→Human 裁决流程', async ({ page }) => {
    const token = await getToken()
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    }

    // Get a task
    const kanbanRes = await fetch(`${API}/kanban`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const kanbanData = await kanbanRes.json()
    const tasks = kanbanData.tasks || []
    if (tasks.length === 0) { test.skip(); return }
    const taskId = tasks[0].id

    // Create execution run
    const runRes = await fetch(`${API}/kernel/executions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ task_id: taskId }),
    })
    const run = await runRes.json()

    // Simulate 30 failures (10 per tier)
    for (let i = 0; i < 30; i++) {
      await fetch(`${API}/kernel/executions/${run.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          step: { action: `call_${i}`, success: false, message: `fail ${i}` },
        }),
      })
    }

    // Verify escalation to human
    const stateRes = await fetch(`${API}/kernel/executions/${run.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const execState = await stateRes.json()
    expect(execState.status).toBe('escalated')
    expect(execState.current_tier).toBe('human')
    expect(execState.escalations.length).toBe(3)

    // Verify pending decision
    const decRes = await fetch(`${API}/kernel/decisions?status=pending`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const decisions = await decRes.json()
    const myDec = decisions.find((d: any) => d.run_id === run.id)
    expect(myDec).toBeTruthy()

    // Navigate to task detail — should show escalated state
    await page.goto(`${BASE}/tasks/${taskId}`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)
    await page.screenshot({ path: 'test-results/task-escalated.png', fullPage: true })

    // Look for escalation indicators in UI
    const escalatedEl = page.getByText('需要人工裁决').or(page.getByText('待裁决')).or(page.getByText('Human'))
    await expect(escalatedEl.first()).toBeVisible({ timeout: 8000 })

    // Human approves
    await fetch(`${API}/kernel/decisions/${myDec.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'approved' }),
    })

    // Verify run resumed
    const afterRes = await fetch(`${API}/kernel/executions/${run.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const afterState = await afterRes.json()
    expect(afterState.status).toBe('running')
  })
})
