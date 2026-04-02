/**
 * slash-command.spec.ts — Slash 命令菜单 E2E 测试
 *
 * 覆盖场景：
 *   1. CommandPalette Cmd+K 打开
 *   2. CommandPalette 输入 "/" 显示视图列表
 *   3. 全局 Slash 菜单：在任意 input 输入 "/" 触发
 *   4. Slash 菜单键盘导航（↑↓ Enter Escape）
 *   5. Slash 菜单模糊搜索过滤
 *   6. 选择 navigate 条目后跳转路由
 *   7. 选择 prefix 条目后打开 CommandPalette 并填入前缀
 */

import { test, expect, type Page } from '@playwright/test'

// ── 辅助函数 ──────────────────────────────────────────────────

/** 登录（dev 模式下直接跳过，直接访问即可；有 auth 时走登录流程） */
async function ensureLoggedIn(page: Page) {
  await page.goto('/')
  // 如果有登录页就登录
  const loginForm = page.locator('input[type="password"]')
  if (await loginForm.isVisible({ timeout: 3000 }).catch(() => false)) {
    await page.fill('input[placeholder*="用户名"], input[type="text"]', 'bornfly')
    await page.fill('input[type="password"]', '007@SYRsb')
    await page.click('button[type="submit"], button:has-text("登录")')
    await page.waitForURL(/\/(home|tasks|memory)/, { timeout: 10000 })
  }
}

/** 等待 Slash 菜单出现 */
async function waitForSlashMenu(page: Page) {
  return page.waitForSelector('[data-testid="slash-command-menu"]', { timeout: 3000 })
}

// ── 测试套件 ──────────────────────────────────────────────────

test.describe('CommandPalette', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page)
    await page.goto('/home')
    await page.waitForLoadState('networkidle')
  })

  test('Cmd+K 打开命令面板', async ({ page }) => {
    await page.keyboard.press('Meta+k')
    const palette = page.locator('[placeholder*="导航视图"]')
    await expect(palette).toBeVisible()
  })

  test('命令面板输入 "/" 显示视图列表', async ({ page }) => {
    await page.keyboard.press('Meta+k')
    const cmdInput = page.locator('[placeholder*="导航视图"]')
    await expect(cmdInput).toBeVisible({ timeout: 3000 })
    // 直接 fill 确保 focus 和输入都正确
    await cmdInput.fill('/')

    // 第一个条目 data-idx="0" 应出现（CommandPalette 结果列表）
    await expect(page.locator('[data-idx="0"]')).toBeVisible({ timeout: 3000 })
    // 至少有 5 个视图条目
    const count = await page.locator('[data-idx]').count()
    expect(count).toBeGreaterThanOrEqual(5)
  })

  test('命令面板 "/" 后继续输入过滤视图', async ({ page }) => {
    await page.keyboard.press('Meta+k')
    await page.waitForSelector('[placeholder*="导航视图"]')
    await page.keyboard.type('/task')

    // 应该显示任务看板相关条目
    await expect(page.locator('text=任务看板')).toBeVisible({ timeout: 3000 })
  })

  test('Escape 关闭命令面板', async ({ page }) => {
    await page.keyboard.press('Meta+k')
    await page.waitForSelector('[placeholder*="导航视图"]')
    await page.keyboard.press('Escape')
    await expect(page.locator('[placeholder*="导航视图"]')).not.toBeVisible()
  })

  test('键盘 ↓↑ 导航条目', async ({ page }) => {
    await page.keyboard.press('Meta+k')
    const cmdInput = page.locator('[placeholder*="导航视图"]')
    await expect(cmdInput).toBeVisible({ timeout: 3000 })
    await cmdInput.fill('/')

    // 第一个条目应出现
    const first = page.locator('[data-idx="0"]')
    await expect(first).toBeVisible({ timeout: 3000 })

    // 按 ↓ 激活第二个条目
    await cmdInput.press('ArrowDown')
    const second = page.locator('[data-idx="1"]')
    await expect(second).toBeVisible()
  })

  test('Enter 跳转到选中视图', async ({ page }) => {
    await page.keyboard.press('Meta+k')
    const cmdInput = page.locator('[placeholder*="导航视图"]')
    await expect(cmdInput).toBeVisible({ timeout: 3000 })
    await cmdInput.fill('/memory')

    // 精准匹配命令面板中的 "记忆" 条目（data-idx 元素，含"记忆"文本）
    await expect(page.locator('[data-idx]').filter({ hasText: '记忆' }).first()).toBeVisible({ timeout: 3000 })
    await cmdInput.press('Enter')

    await expect(page).toHaveURL(/\/memory/, { timeout: 5000 })
  })
})

test.describe('SlashCommandMenu — 全局 input 触发', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page)
    // /tasks 页面有可见 input，适合测试全局 Slash 菜单
    await page.goto('/tasks')
    await page.waitForLoadState('networkidle')
  })

  test('任意 input 输入 "/" 触发 Slash 菜单', async ({ page }) => {
    // 找到页面上第一个可见 input
    const input = page.locator('input:visible').first()
    const count = await input.count()
    if (count === 0) {
      // 如果当前页面没有 input，去有 input 的页面
      await page.goto('/tasks')
      await page.waitForLoadState('networkidle')
    }

    const el = page.locator('input:visible').first()
    await el.click()
    await el.fill('/')

    await expect(page.locator('[data-testid="slash-command-menu"]')).toBeVisible({ timeout: 3000 })
  })

  test('Slash 菜单显示视图和搜索前缀条目', async ({ page }) => {
    const input = page.locator('input:visible').first()
    await input.click()
    await input.fill('/')

    const menu = await waitForSlashMenu(page)
    expect(menu).toBeTruthy()

    // 包含 navigate 类型条目（主页、任务等）
    await expect(page.locator('[data-testid="slash-item-home"]')).toBeVisible()
    // 包含 prefix 类型条目
    await expect(page.locator('[data-testid="slash-item-srch-task"]')).toBeVisible()
  })

  test('Slash 菜单输入后继续输入过滤条目', async ({ page }) => {
    const input = page.locator('input:visible').first()
    await input.click()
    await input.fill('/')
    await waitForSlashMenu(page)

    // 继续输入 "任务" 过滤
    await input.fill('/任务')
    // 应该有"任务看板"条目
    await expect(page.locator('[data-testid="slash-item-tasks"]')).toBeVisible({ timeout: 2000 })
  })

  test('Escape 关闭 Slash 菜单', async ({ page }) => {
    const input = page.locator('input:visible').first()
    await input.click()
    await input.fill('/')
    await waitForSlashMenu(page)

    await page.keyboard.press('Escape')
    await expect(page.locator('[data-testid="slash-command-menu"]')).not.toBeVisible()
  })

  test('点击 navigate 条目跳转路由', async ({ page }) => {
    const input = page.locator('input:visible').first()
    await input.click()
    await input.fill('/')
    await waitForSlashMenu(page)

    await page.locator('[data-testid="slash-item-memory"]').click()
    await expect(page).toHaveURL(/\/memory/, { timeout: 5000 })
  })

  test('点击 prefix 条目打开 CommandPalette 并填入前缀', async ({ page }) => {
    const input = page.locator('input:visible').first()
    await input.click()
    await input.fill('/')
    await waitForSlashMenu(page)

    // 点击 /task- 前缀条目
    await page.locator('[data-testid="slash-item-srch-task"]').click()

    // CommandPalette 应打开且输入框填有 /task-
    const paletteInput = page.locator('[placeholder*="导航视图"]')
    await expect(paletteInput).toBeVisible({ timeout: 3000 })
    await expect(paletteInput).toHaveValue('/task-')
  })

  test('textarea 中输入 "/" 也能触发 Slash 菜单', async ({ page }) => {
    // 去有 textarea 的页面（任务详情或 PRVSE world 的输入框）
    await page.goto('/tasks')
    await page.waitForLoadState('networkidle')

    const textarea = page.locator('textarea:visible').first()
    const count = await textarea.count()
    if (count === 0) test.skip()

    await textarea.click()
    await textarea.fill('/')

    await expect(page.locator('[data-testid="slash-command-menu"]')).toBeVisible({ timeout: 3000 })
  })
})

test.describe('SlashCommandMenu — 不应触发的场景', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page)
    // 使用有 input 的页面
    await page.goto('/tasks')
    await page.waitForLoadState('networkidle')
  })

  test('输入 URL（含 /）不触发菜单', async ({ page }) => {
    const input = page.locator('input:visible').first()
    await input.click()
    await input.fill('https://example.com/path')

    // 非首位 / 不触发
    await expect(page.locator('[data-testid="slash-command-menu"]')).not.toBeVisible({ timeout: 1000 })
  })

  test('搜索框内容含空格后输入 / 触发菜单', async ({ page }) => {
    const input = page.locator('input:visible').first()
    await input.click()
    await input.fill('hello /')

    await expect(page.locator('[data-testid="slash-command-menu"]')).toBeVisible({ timeout: 3000 })
  })
})
