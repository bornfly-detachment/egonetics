/**
 * server/lib/code-agent.js
 *
 * tmux-based claude 通信：
 *   - tmux session `egonetics-coding-agent` 里保持一个 claude --dangerously-skip-permissions
 *   - send-keys 发 prompt
 *   - 等 claude 提示符恢复后，capture-pane 取截面，过滤工具调用 UI，提取纯文字响应
 *
 * 不 spawn claude，不用 socket，不用 pipe-pane。
 */

'use strict'

const { execSync } = require('child_process')
const fss  = require('fs')
const path = require('path')

const TMUX = 'egonetics-coding-agent'
const PANE = `${TMUX}:0`

// agent-spaces 软链接：egonetics/agent-spaces → ../prvse_world_workspace/L2/ai-resources
// __dirname = egonetics/server/lib/  →  ../../agent-spaces = egonetics/agent-spaces
const AGENT_SPACES = path.resolve(__dirname, '../../agent-spaces')

const SPHERE_WORKDIR = {
  constitution: path.join(AGENT_SPACES, 'constitution'),
  goals:        path.join(AGENT_SPACES, 'goals'),
  resources:    path.join(AGENT_SPACES, 'resources'),
  main:         path.resolve(__dirname, '../../..'),  // egonetics 根目录
}

// ── ANSI + 终端控制序列脱色 ───────────────────────────────────

function stripAnsi(str) {
  return str
    .replace(/\x1b\[[0-9;]*[A-Za-z]/g, '')
    .replace(/\x1b\][^\x07]*\x07/g, '')
    .replace(/\x1b[()][A-Z0-9]/g, '')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
    .replace(/\r/g, '')
}

// ── tmux 工具 ─────────────────────────────────────────────────

function tmuxHasSession() {
  try {
    execSync(`tmux has-session -t ${TMUX} 2>/dev/null`)
    return true
  } catch { return false }
}

function paneCurrentCommand() {
  try {
    return execSync(`tmux display-message -t ${PANE} -p '#{pane_current_command}'`, { encoding: 'utf8' }).trim()
  } catch { return '' }
}

/** 取 pane 当前可见内容（含 N 行历史） */
function capturePane(historyLines = 300) {
  try {
    return stripAnsi(
      execSync(`tmux capture-pane -t ${PANE} -p -S -${historyLines}`, { encoding: 'utf8' })
    )
  } catch { return '' }
}

/** claude 交互模式等待输入时出现 ╭─ 框 */
function paneHasClaudePrompt() {
  const out = capturePane(20)
  return /╭─/.test(out) || /^>\s*$/m.test(out)
}

// ── 过滤 claude TUI，只保留纯文字响应 ──────────────────────
//
// Claude tmux 输出结构：
//   > user prompt          ← 用户输入（跳过）
//   ⏺ / ● / ⎔ ...         ← TUI 状态装饰（跳过）
//   ToolName(args)         ← 工具调用 header（跳过）
//   │ result content       ← 工具返回内容（跳过）
//   ✓ Done / Cost: ...     ← 状态/费用行（跳过）
//   实际的文字回答           ← 保留
//   ╭──────────────╮       ← 输入框（跳过，也是结束标志）

const SKIP_LINE = /^[\s]*(⏺|●|⎔|✓|✗|⊕|·|▸|◆|■|□|╭|╰|│|├|└|─|↓|↑|✦|⏎|⚡|❯)/u
const BOX_LINE  = /^[\s╭╰│├└─╮╯┤┬┴┼]{3,}$/
const TOOL_CALL = /^(Read|Edit|Write|Bash|Glob|Grep|Agent|Task|WebFetch|WebSearch|Notebook)\s*[({(]/
const COST_LINE = /^\s*(Tokens:|Cost:|Cache|API cost|Total cost|Input:|Output:)/i
const PROMPT_MARKER = /^>\s*/  // claude 输入提示符行

function filterClaudeOutput(lines) {
  return lines.filter(line => {
    const t = line.trim()
    if (!t) return false
    if (SKIP_LINE.test(t)) return false
    if (BOX_LINE.test(t)) return false
    if (TOOL_CALL.test(t)) return false
    if (COST_LINE.test(t)) return false
    if (PROMPT_MARKER.test(t)) return false
    // 纯符号/数字行（工具结果分隔符）
    if (/^[-=]{10,}$/.test(t)) return false
    return true
  })
}

// ── 确保 claude 在 tmux 中运行（幂等）────────────────────────

// sphere → tmux window 名
function spherePane(sphere) {
  const win = sphere && sphere !== 'main' ? sphere : 'main'
  return `${TMUX}:${win}`
}

// 记录每个 sphere 当前运行的 model
const _runningModel = {}

async function ensureClaudeRunning(sphere = 'main', model) {
  const pane = spherePane(sphere)
  const workdir = SPHERE_WORKDIR[sphere] ?? SPHERE_WORKDIR.main

  // 确保 tmux session + window 存在
  if (!tmuxHasSession()) {
    execSync(`tmux new-session -d -s ${TMUX} -x 220 -y 50 -n main`)
    await new Promise(r => setTimeout(r, 300))
    // 加载用户环境变量（PATH, API keys 等）
    execSync(`tmux send-keys -t ${TMUX}:main "source ~/.bash_profile" Enter`)
    await new Promise(r => setTimeout(r, 500))
  }
  // 确保对应 window 存在
  try {
    execSync(`tmux select-window -t ${pane} 2>/dev/null || tmux new-window -t ${TMUX} -n ${sphere === 'main' ? 'main' : sphere}`)
    // 新 window 也需要加载环境
    if (sphere !== 'main') {
      execSync(`tmux send-keys -t ${pane} "source ~/.bash_profile" Enter`)
      await new Promise(r => setTimeout(r, 300))
    }
  } catch { /* ignore */ }

  const cmd = (() => {
    try {
      return execSync(`tmux display-message -t ${pane} -p '#{pane_current_command}'`, { encoding: 'utf8' }).trim()
    } catch { return '' }
  })()

  // 如果 claude 已在运行，切换 model（如需要）
  if (cmd === 'claude') {
    const currentModel = _runningModel[sphere]
    if (model && currentModel && model !== currentModel) {
      // 在 claude 内部用 /model 切换，不重启
      execSync(`tmux send-keys -t ${pane} "/model ${model}" Enter`)
      await new Promise(r => setTimeout(r, 1500))
      _runningModel[sphere] = model
    }
    return
  }

  // 有其他进程先 Ctrl+C
  const cmd2 = (() => {
    try {
      return execSync(`tmux display-message -t ${pane} -p '#{pane_current_command}'`, { encoding: 'utf8' }).trim()
    } catch { return '' }
  })()
  if (cmd2 && cmd2 !== 'zsh' && cmd2 !== 'bash' && cmd2 !== 'sh' && cmd2 !== 'claude') {
    execSync(`tmux send-keys -t ${pane} C-c`)
    await new Promise(r => setTimeout(r, 800))
  }

  // 启动 claude — 不带 --model，只执行一次
  execSync(`tmux send-keys -t ${pane} "cd ${workdir} && env -u ANTHROPIC_API_KEY claude --dangerously-skip-permissions" Enter`)

  // 等待 claude 初始化（最多 20s），自动回应确认框
  const deadline = Date.now() + 20000
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 600))
    const paneText = execSync(`tmux capture-pane -t ${pane} -p -S -30 2>/dev/null || true`, { encoding: 'utf8' })
    if (/\(y\/n\)|\[Y\/n\]|\[y\/N\]|Yes\/No|accept|trust/i.test(paneText)) {
      execSync(`tmux send-keys -t ${pane} "y" Enter`)
      await new Promise(r => setTimeout(r, 400))
    }
    try {
      const c = execSync(`tmux display-message -t ${pane} -p '#{pane_current_command}'`, { encoding: 'utf8' }).trim()
      if (c === 'claude') break
    } catch { /* ignore */ }
  }

  // claude 启动完成后，如需切换 model，用 /model 命令
  if (model) {
    execSync(`tmux send-keys -t ${pane} "/model ${model}" Enter`)
    await new Promise(r => setTimeout(r, 1500))
    _runningModel[sphere] = model
  }
}

// ── 交互式 prompt 检测与等待 ──────────────────────────────────

// pane → { resolve }
const pendingInputs = new Map()

/** 检测 pane 内容是否有需要用户回应的交互框，返回 { content, options } 或 null */
function detectInteractivePrompt(text) {
  const clean = text.trim()
  if (!clean) return null

  // 数字选项：1) / 1. / ① 等
  const optionLines = clean.split('\n').filter(l => /^\s*[1-9][.)]\s+\S/.test(l))
  if (optionLines.length >= 2) {
    const options = optionLines.map(l => l.match(/^\s*([1-9])[.)]/)[1])
    return { content: clean, options }
  }

  // Y/N
  if (/\(y\/n\)|\[Y\/n\]|\[y\/N\]|yes\/no/i.test(clean)) {
    return { content: clean, options: ['y', 'n'] }
  }

  // Press Enter
  if (/press\s+(enter|any key|return)/i.test(clean)) {
    return { content: clean, options: [''] }
  }

  return null
}

/**
 * 在 runQuery 里 yield interactive_prompt 事件后调用，
 * 挂起直到前端 POST /code-agent/respond 或超时自动选默认值
 */
function waitForUserInput(pane, defaultOption = '1', timeoutMs = 60000) {
  return new Promise(resolve => {
    const timer = setTimeout(() => {
      pendingInputs.delete(pane)
      resolve(defaultOption)
    }, timeoutMs)

    pendingInputs.set(pane, option => {
      clearTimeout(timer)
      pendingInputs.delete(pane)
      resolve(option)
    })
  })
}

/** 前端回调入口（由 route 调用） */
function respondToPrompt(pane, option) {
  const fn = pendingInputs.get(pane)
  if (fn) { fn(option); return true }
  return false
}

// ── 串行队列（per sphere）────────────────────────────────────

const _queues = {}
function getQueue(sphere) {
  if (!_queues[sphere]) _queues[sphere] = Promise.resolve()
  return _queues[sphere]
}

// ── history_size 工具 ─────────────────────────────────────────

function getPaneHistorySize(pane) {
  try {
    return parseInt(
      execSync(`tmux display-message -t ${pane} -p '#{history_size}'`, { encoding: 'utf8' }).trim(),
      10
    ) || 0
  } catch { return 0 }
}

// ── 核心：runQuery ─────────────────────────────────────────────

async function* runQuery(prompt, opts = {}) {
  const sphere = opts.sphere ?? 'main'
  let releaseQueue
  await new Promise(resolve => {
    _queues[sphere] = getQueue(sphere).then(() => new Promise(r => { releaseQueue = r; resolve() }))
  })

  const pane = spherePane(sphere)

  try {
    await ensureClaudeRunning(sphere, opts.model)
    yield { type: 'stream_start' }

    // 记录发 prompt 前的 history_size（时间戳基准）
    const histBefore = getPaneHistorySize(pane)

    // 发 prompt
    execSync(`tmux send-keys -t ${pane} -- ${JSON.stringify(prompt)} Enter`)

    // 等待 claude 开始响应
    await new Promise(r => setTimeout(r, 1000))

    const deadline = Date.now() + 90000
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 500))
      try {
        const raw = execSync(`tmux capture-pane -t ${pane} -p -S -30 2>/dev/null || true`, { encoding: 'utf8' })
        const out = stripAnsi(raw)

        // 检测交互式 prompt，relay 到前端
        const interactive = detectInteractivePrompt(out)
        if (interactive) {
          yield { type: 'interactive_prompt', content: interactive.content, options: interactive.options, pane }
          const chosen = await waitForUserInput(pane)
          execSync(`tmux send-keys -t ${pane} ${JSON.stringify(chosen)} Enter`)
          await new Promise(r => setTimeout(r, 600))
          continue
        }

        if (/╭─/.test(out)) break
      } catch { /* ignore */ }
    }

    // 基于 history_size delta 精准捕获新内容（不多不少）
    const histAfter = getPaneHistorySize(pane)
    const delta = Math.max(histAfter - histBefore + 60, 80)  // +60 行容差，至少80行
    const rawCapture = (() => {
      try { return stripAnsi(execSync(`tmux capture-pane -t ${pane} -p -S -${delta} 2>/dev/null || true`, { encoding: 'utf8' })) }
      catch { return '' }
    })()

    const filteredLines = filterClaudeOutput(rawCapture.split('\n'))
    const responseText = filteredLines.join('\n').trim()

    if (responseText) {
      yield {
        type: 'assistant',
        message: { content: [{ type: 'text', text: responseText }] },
      }
    }

    yield { type: 'result', total_cost_usd: 0, duration_ms: 0 }
    yield { type: 'stream_end' }

  } finally {
    releaseQueue()
  }
}

// ── 兼容旧接口 ────────────────────────────────────────────────

function getSessionId(_ctx) { return null }
function getHistory(_ctx)   { return [] }
function listContexts()     { return [] }
function resetContext()     {}

module.exports = { runQuery, getSessionId, getHistory, listContexts, resetContext, respondToPrompt }
