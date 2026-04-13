/**
 * @prvse P-L0-IMPL_perceiver
 *
 * L0 Perceiver — V 感知器
 *
 * 从 pr-graph.json 读取有 runtime 字段的 P 节点，
 * 用 platform.js 的工具函数检测 alive/dead。
 *
 * 不持有 KNOWN_PORTS。端口信息来自 P 节点定义。
 * perceiver 是纯函数：输入 P 节点列表，输出 State 快照。
 */

'use strict'

const fs = require('fs')
const path = require('path')
const { isPortListening, detectCpu, detectRam, detectTmuxSessions, detectDocker } = require('../resource-manager/platform')

// ── pr-graph.json 路径 ──────────────────────────────────────────

const GRAPH_PATH = path.resolve(
  process.env.PRVSE_WORKSPACE || path.resolve(__dirname, '../../../../prvse_world_workspace'),
  'chronicle/pr-graph.json'
)

// ── 读取 runtime P 节点 ─────────────────────────────────────────

/**
 * 从 pr-graph.json 提取所有有 runtime 字段的 P 节点。
 * @returns {{ id: string, runtime: object }[]}
 */
function loadRuntimeNodes() {
  try {
    const raw = fs.readFileSync(GRAPH_PATH, 'utf8')
    const graph = JSON.parse(raw)
    const nodes = []
    for (const [id, node] of Object.entries(graph)) {
      if (id === 'schema') continue
      if (node.runtime && node.runtime.type !== 'embedded') {
        nodes.push({ id, ...node })
      }
    }
    return nodes
  } catch (err) {
    console.error('[perceiver] failed to load pr-graph.json:', err.message)
    return []
  }
}

// ── 单节点健康检测 ──────────────────────────────────────────────

/**
 * 检测单个 P 节点是否 alive。
 * 检测方式由 runtime.type 决定：
 *   http    → isPortListening(port)
 *   docker  → docker inspect
 *   process → kill -0 pid
 */
function checkNode(node) {
  const rt = node.runtime
  const result = { p: node.id, type: rt.type, alive: false, at: new Date().toISOString() }

  try {
    switch (rt.type) {
      case 'http': {
        if (rt.port) {
          result.alive = isPortListening(rt.port)
          result.port = rt.port
        }
        break
      }
      case 'docker': {
        if (rt.container) {
          const { execSync } = require('child_process')
          try {
            const out = execSync(
              `docker inspect -f "{{.State.Running}}" ${rt.container} 2>/dev/null`,
              { encoding: 'utf8', timeout: 3000 }
            ).trim()
            result.alive = out === 'true'
          } catch { result.alive = false }
          result.container = rt.container
        }
        break
      }
      case 'process': {
        if (rt.pid) {
          try { process.kill(rt.pid, 0); result.alive = true } catch { result.alive = false }
        }
        break
      }
    }
  } catch { /* detection failed = not alive */ }

  return result
}

// ── 全量感知 ────────────────────────────────────────────────────

/**
 * 感知所有 runtime P 节点的当前状态。
 * 返回 State 快照（PRV 三元组投影）。
 */
function sense() {
  const nodes = loadRuntimeNodes()
  const services = nodes.map(checkNode)

  // 系统级指标（不依赖 P 节点定义）
  const system = {
    cpu: detectCpu(),
    ram: detectRam(),
  }

  // tmux + docker（补充信息）
  const tmux = detectTmuxSessions()
  const docker = detectDocker()

  return {
    at: new Date().toISOString(),
    services,
    system,
    tmux,
    docker,
    summary: {
      total: services.length,
      alive: services.filter(s => s.alive).length,
      dead:  services.filter(s => !s.alive).length,
    },
  }
}

/**
 * 仅检测端口列表（向后兼容 ResourcePanel 等消费者）。
 * 数据从 pr-graph.json 动态读取，不再硬编码。
 */
function detectPorts() {
  const nodes = loadRuntimeNodes()
  return nodes
    .filter(n => n.runtime.port)
    .map(n => ({
      port: n.runtime.port,
      name: n.id.replace(/^P-L\d(-[A-Z]+)?_/, '').replace(/-/g, ' '),
      alive: isPortListening(n.runtime.port),
    }))
}

module.exports = { sense, detectPorts, loadRuntimeNodes, checkNode }
