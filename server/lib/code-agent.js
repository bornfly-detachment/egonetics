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
const os   = require('os')

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

/**
 * 判断指定 pane 是否有 claude 进程在运行（不论是否在处理中）。
 * claude CLI 是 Node.js 进程，#{pane_current_command} 返回 'node'，不是 'claude'。
 * 只检查进程名，不检查 ╭─ —— claude 处理任务时没有提示符，但进程仍在运行。
 */
function isClaudeRunningInPane(pane) {
  try {
    const cmd = execSync(
      `tmux display-message -t ${pane} -p '#{pane_current_command}' 2>/dev/null || echo ""`,
      { encoding: 'utf8' }
    ).trim()
    return cmd === 'claude' || cmd === 'node' || cmd === 'claude-cli'
  } catch { return false }
}

/**
 * 判断 claude 是否已完成初始化并在等待输入（有 ╭─ 提示符）。
 * 仅用于启动等待循环，不用于"是否在运行"判断。
 */
function isClaudeReadyInPane(pane) {
  if (!isClaudeRunningInPane(pane)) return false
  try {
    const out = stripAnsi(
      execSync(`tmux capture-pane -t ${pane} -p -S -8 2>/dev/null || true`, { encoding: 'utf8' })
    )
    return /╭─/.test(out)
  } catch { return false }
}

/** 判断 pane 内容是否是 /model 切换菜单（claude 内部模型列表，不转发前端） */
function isModelSelectionMenu(text) {
  const lines = text.split('\n').filter(l => /^\s*[1-9][.)]\s+\S/.test(l))
  return lines.length >= 2 && lines.some(l => /claude-(sonnet|opus|haiku)/i.test(l))
}

/**
 * 在 claude 内部切换模型，所有选项菜单在后端自动处理，不转发前端。
 *
 * 逻辑：
 *   - 有 targetModelId → 找菜单中匹配的行，发序号
 *   - 无 targetModelId 或找不到精确匹配 → 选 "Default (recommended)"
 *   - 找不到 Default → 发 Enter（选高亮默认项）
 */
async function switchModelInClaude(pane, targetModelId) {
  execSync(`tmux send-keys -t ${pane} "/model${targetModelId ? ' ' + targetModelId : ''}" Enter`)
  const deadline = Date.now() + 8000
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 350))
    const out = stripAnsi(
      execSync(`tmux capture-pane -t ${pane} -p -S -30 2>/dev/null || true`, { encoding: 'utf8' })
    )
    if (/set model to|model.*changed|已切换/i.test(out)) return
    if (/╭─/.test(out) && !isModelSelectionMenu(out)) return

    if (isModelSelectionMenu(out)) {
      const lines = out.split('\n')
      let defaultLine = null
      let targetLine = null

      for (const line of lines) {
        const m = line.match(/^\s*([1-9])[.)]\s+(.+)/)
        if (!m) continue
        if (/default.*recommended/i.test(m[2])) defaultLine = m[1]
        if (targetModelId && m[2].trim() === targetModelId) targetLine = m[1]
      }

      const choice = targetLine ?? defaultLine
      if (choice) {
        execSync(`tmux send-keys -t ${pane} ${choice} Enter`)
      } else {
        // 菜单中无匹配，直接 Enter 选高亮项
        execSync(`tmux send-keys -t ${pane} Enter`)
      }
      await new Promise(r => setTimeout(r, 500))
      return
    }
  }
}

// ── JSONL 读取：从 .claude/projects/ 取结构化响应 ────────────
//
// claude CLI 运行时把每次对话以 JSONL 追加写入
//   ~/.claude/projects/<project-key>/<session-uuid>.jsonl
// project-key = cwd 路径把 '/' 全替换为 '-'（去掉首个空段）
//
// 每行格式：
//   { type: "user"|"assistant", timestamp: ISO, message: { content: [...] } }
// content block type:
//   "text"      → 最终回答，展示
//   "thinking"  → 推理过程，展示
//   "tool_use"  → 工具调用，隐藏
//   "tool_result" → 工具结果，隐藏

function workdirToProjectKey(workdir) {
  // /Users/foo/bar  →  -Users-foo-bar
  return workdir.replace(/\//g, '-')
}

function getProjectsDir(sphere) {
  const workdir = SPHERE_WORKDIR[sphere] ?? SPHERE_WORKDIR.main
  const key = workdirToProjectKey(workdir)
  return path.join(os.homedir(), '.claude', 'projects', key)
}

/** 找该 projects 目录下最近被写入的 .jsonl 文件 */
function findActiveJsonl(projectsDir) {
  try {
    const files = fss.readdirSync(projectsDir)
      .filter(f => f.endsWith('.jsonl'))
      .map(f => {
        const fp = path.join(projectsDir, f)
        return { fp, mtime: fss.statSync(fp).mtimeMs }
      })
      .sort((a, b) => b.mtime - a.mtime)
    return files[0]?.fp ?? null
  } catch { return null }
}

/** 读取 jsonlPath 中 timestamp > afterTs 的 assistant 条目 */
function readNewAssistantEntries(jsonlPath, afterTs) {
  try {
    const lines = fss.readFileSync(jsonlPath, 'utf8').split('\n').filter(l => l.trim())
    return lines
      .map(l => { try { return JSON.parse(l) } catch { return null } })
      .filter(e =>
        e &&
        e.type === 'assistant' &&
        new Date(e.timestamp).getTime() > afterTs
      )
  } catch { return [] }
}

/** 从 assistant 条目中提取 text + thinking，跳过 tool_use / tool_result */
function extractDisplayContent(entries) {
  const parts = []
  for (const entry of entries) {
    const content = entry.message?.content
    if (!Array.isArray(content)) continue
    for (const block of content) {
      if (block.type === 'thinking' && block.thinking) {
        parts.push(`<thinking>\n${block.thinking}\n</thinking>`)
      } else if (block.type === 'text' && block.text?.trim()) {
        parts.push(block.text.trim())
      }
    }
  }
  return parts.join('\n\n').trim()
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

  // ── 确保 tmux session + window 存在 ──────────────────────────
  if (!tmuxHasSession()) {
    execSync(`tmux new-session -d -s ${TMUX} -x 220 -y 50 -n main`)
    await new Promise(r => setTimeout(r, 300))
    execSync(`tmux send-keys -t ${TMUX}:main "source ~/.bash_profile" Enter`)
    await new Promise(r => setTimeout(r, 500))
  }
  try {
    execSync(`tmux select-window -t ${pane} 2>/dev/null || tmux new-window -t ${TMUX} -n ${sphere === 'main' ? 'main' : sphere}`)
    if (sphere !== 'main') {
      execSync(`tmux send-keys -t ${pane} "source ~/.bash_profile" Enter`)
      await new Promise(r => setTimeout(r, 300))
    }
  } catch { /* ignore */ }

  // ── 检测 claude 是否已在运行（claude CLI 进程名是 node，不是 claude） ──
  if (isClaudeRunningInPane(pane)) {
    // 已在运行，按需切换 model（用 switchModelInClaude，内部处理菜单）
    const currentModel = _runningModel[sphere]
    if (model && model !== currentModel) {
      await switchModelInClaude(pane, model)
      _runningModel[sphere] = model
    }
    return
  }

  // ── 有其他进程先 Ctrl+C ───────────────────────────────────────
  const otherCmd = (() => {
    try {
      return execSync(
        `tmux display-message -t ${pane} -p '#{pane_current_command}' 2>/dev/null || echo ""`,
        { encoding: 'utf8' }
      ).trim()
    } catch { return '' }
  })()
  if (otherCmd && !['zsh', 'bash', 'sh', 'node', 'claude', 'claude-cli'].includes(otherCmd)) {
    execSync(`tmux send-keys -t ${pane} C-c`)
    await new Promise(r => setTimeout(r, 800))
  }

  // ── 启动 claude（只执行一次，不带 --model） ───────────────────
  execSync(`tmux send-keys -t ${pane} "cd ${workdir} && env -u ANTHROPIC_API_KEY claude --dangerously-skip-permissions" Enter`)

  // 等待初始化（最多 20s），自动回应确认框
  const deadline = Date.now() + 20000
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 600))
    const paneText = stripAnsi(
      execSync(`tmux capture-pane -t ${pane} -p -S -30 2>/dev/null || true`, { encoding: 'utf8' })
    )
    if (/\(y\/n\)|\[Y\/n\]|\[y\/N\]|Yes\/No|accept|trust/i.test(paneText)) {
      execSync(`tmux send-keys -t ${pane} "y" Enter`)
      await new Promise(r => setTimeout(r, 400))
    }
    if (isClaudeRunningInPane(pane)) break
  }

  // 启动完成后切换 model（switchModelInClaude 内部处理菜单）
  if (model) {
    await switchModelInClaude(pane, model)
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

    // 记录发 prompt 前的时间戳 — 用于 JSONL 条目过滤的确定性边界
    const startTs = Date.now()
    const projectsDir = getProjectsDir(sphere)

    // 发 prompt
    execSync(`tmux send-keys -t ${pane} -- ${JSON.stringify(prompt)} Enter`)

    // 短暂等待 claude 开始处理
    await new Promise(r => setTimeout(r, 300))

    const deadline = Date.now() + 90000
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 400))
      try {
        const raw = execSync(`tmux capture-pane -t ${pane} -p -S -30 2>/dev/null || true`, { encoding: 'utf8' })
        const out = stripAnsi(raw)

        // 模型选择菜单 — 后端自动处理，绝不转发前端
        if (isModelSelectionMenu(out)) {
          await switchModelInClaude(pane, opts.model ?? null)
          await new Promise(r => setTimeout(r, 400))
          continue
        }

        // 其他交互式 prompt（非模型菜单）— relay 到前端
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

    // 等待 JSONL flush（claude CLI 异步写盘，给 300ms 余量）
    await new Promise(r => setTimeout(r, 300))

    // 从 JSONL 读取 startTs 之后写入的 assistant 条目
    const jsonlPath = findActiveJsonl(projectsDir)
    const newEntries = jsonlPath ? readNewAssistantEntries(jsonlPath, startTs) : []
    const responseText = extractDisplayContent(newEntries)

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
