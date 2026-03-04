#!/usr/bin/env node
/**
 * backup-claude-projects.js
 *
 * 定期备份 ~/.claude/projects/ 下的 jsonl 文件到 memory.db
 * 保证不重复不漏
 *
 * 用法：
 *   node backup-claude-projects.js              # 单次执行
 *   node backup-claude-projects.js --daemon     # 每小时执行一次（后台模式）
 *   node backup-claude-projects.js --dry-run    # 预览，不实际导入
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// 从 server/node_modules 引入 sqlite3
const serverDir = path.join(__dirname, '..', 'server');
const sqlite3 = require(path.join(serverDir, 'node_modules', 'sqlite3')).verbose();

// ── 配置 ─────────────────────────────────────────────────────────

const CLAUDE_PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');
const MEMORY_DB_PATH = path.join(__dirname, '..', 'server', 'data', 'memory.db');
const SCAN_INTERVAL_MS = 60 * 60 * 1000; // 1小时

// 导入状态记录文件（记录已处理的文件，防止重复处理）
const STATE_FILE = path.join(__dirname, '..', 'server', 'data', '.backup-state.json');

// ── 帮助函数 ──────────────────────────────────────────────────

function log(message, type = 'info') {
  const time = new Date().toLocaleString('zh-CN');
  const prefix = {
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    error: '❌',
    dry: '🔍',
  }[type] || 'ℹ️';
  console.log(`[${time}] ${prefix} ${message}`);
}

function loadState() {
  if (!fs.existsSync(STATE_FILE)) {
    return { processedFiles: {}, lastScan: null };
  }
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { processedFiles: {}, lastScan: null };
  }
}

function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// 计算文件内容 hash（用于检测文件是否修改）
function fileHash(filePath) {
  const stats = fs.statSync(filePath);
  return `${stats.size}-${stats.mtimeMs}`;
}

// 递归扫描目录找 jsonl 文件
function scanJsonlFiles(dir) {
  const results = [];

  if (!fs.existsSync(dir)) {
    return results;
  }

  function scan(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        scan(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        results.push(fullPath);
      }
    }
  }

  scan(dir);
  return results;
}

// ── 使用 import-jsonl.js 的逻辑导入单个文件 ─────────────────────

async function importSingleFile(filePath, db, dryRun = false) {
  // 复用现有的 import-jsonl.js 模块
  const { importFile } = require('../server/scripts/import-jsonl');

  try {
    if (dryRun) {
      log(`将导入: ${path.relative(CLAUDE_PROJECTS_DIR, filePath)}`, 'dry');
      return { success: true, skipped: false };
    }

    const result = await importFile(filePath, db);
    log(`成功导入: ${path.relative(CLAUDE_PROJECTS_DIR, filePath)} (${result.rounds_count} 轮, ${result.steps_count} 步)`, 'success');
    return { success: true, skipped: false, result };
  } catch (err) {
    if (err.message.includes('已存在')) {
      log(`跳过已存在: ${path.relative(CLAUDE_PROJECTS_DIR, filePath)}`, 'info');
      return { success: true, skipped: true };
    }
    log(`导入失败: ${path.relative(CLAUDE_PROJECTS_DIR, filePath)} — ${err.message}`, 'error');
    return { success: false, skipped: false, error: err };
  }
}

// ── 主备份逻辑 ─────────────────────────────────────────────────

async function runBackup(dryRun = false) {
  const state = loadState();
  const startTime = Date.now();

  log(`开始扫描: ${CLAUDE_PROJECTS_DIR}`, 'info');

  if (!fs.existsSync(CLAUDE_PROJECTS_DIR)) {
    log(`目录不存在: ${CLAUDE_PROJECTS_DIR}`, 'warning');
    return;
  }

  if (!fs.existsSync(MEMORY_DB_PATH)) {
    log(`数据库不存在: ${MEMORY_DB_PATH}`, 'error');
    log('请先运行: cd server && npm run init-memory', 'warning');
    return;
  }

  // 扫描所有 jsonl 文件
  const jsonlFiles = scanJsonlFiles(CLAUDE_PROJECTS_DIR);
  log(`找到 ${jsonlFiles.length} 个 jsonl 文件`, 'info');

  if (jsonlFiles.length === 0) {
    log('没有找到 jsonl 文件', 'warning');
    return;
  }

  // 过滤出需要处理的文件
  const toProcess = [];
  for (const filePath of jsonlFiles) {
    const hash = fileHash(filePath);
    const lastProcessed = state.processedFiles[filePath];

    // 如果文件未处理过，或内容已修改，则处理
    if (!lastProcessed || lastProcessed.hash !== hash) {
      toProcess.push({ filePath, hash, isNew: !lastProcessed });
    }
  }

  if (toProcess.length === 0) {
    log('所有文件都是最新的，无需处理', 'success');
    return;
  }

  log(`需要处理 ${toProcess.length} 个文件 (${toProcess.filter(f => f.isNew).length} 个新文件, ${toProcess.filter(f => !f.isNew).length} 个已修改)`, 'info');

  if (dryRun) {
    for (const { filePath, isNew } of toProcess) {
      log(`${isNew ? '[新]' : '[修改]'} ${path.relative(CLAUDE_PROJECTS_DIR, filePath)}`, 'dry');
    }
    return;
  }

  // 打开数据库
  const db = new sqlite3.Database(MEMORY_DB_PATH, (err) => {
    if (err) {
      log(`数据库打开失败: ${err.message}`, 'error');
    }
  });

  // 处理每个文件
  let imported = 0;
  let skipped = 0;
  let failed = 0;

  for (const { filePath, hash } of toProcess) {
    const result = await importSingleFile(filePath, db, dryRun);

    if (result.success) {
      if (!result.skipped) {
        imported++;
        state.processedFiles[filePath] = {
          hash,
          processedAt: new Date().toISOString(),
        };
      } else {
        skipped++;
        // 即使跳过也要更新 hash（防止下次再检查）
        state.processedFiles[filePath] = {
          hash,
          processedAt: state.processedFiles[filePath]?.processedAt || new Date().toISOString(),
        };
      }
    } else {
      failed++;
    }
  }

  // 保存状态
  state.lastScan = new Date().toISOString();
  saveState(state);

  // 关闭数据库
  await new Promise(resolve => db.close(resolve));

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  log(`备份完成: 导入 ${imported}, 跳过 ${skipped}, 失败 ${failed} (耗时 ${duration}s)`,
    failed === 0 ? 'success' : 'warning');
}

// ── 入口 ─────────────────────────────────────────────────────

const args = process.argv.slice(2);
const isDaemon = args.includes('--daemon');
const isDryRun = args.includes('--dry-run');
const isHelp = args.includes('--help') || args.includes('-h');

if (isHelp) {
  console.log(`
用法: node backup-claude-projects.js [选项]

定期备份 ~/.claude/projects/ 下的 jsonl 文件到 memory.db

选项:
  --daemon     后台模式，每小时执行一次
  --dry-run    预览模式，不实际导入
  -h, --help   显示此帮助

示例:
  node backup-claude-projects.js              # 单次执行
  node backup-claude-projects.js --daemon     # 每小时执行
  node backup-claude-projects.js --dry-run    # 预览
`);
  process.exit(0);
}

// 单次执行
if (!isDaemon) {
  runBackup(isDryRun).catch(err => {
    log(`备份异常: ${err.message}`, 'error');
    console.error(err);
    process.exit(1);
  });
} else {
  // 后台模式
  log(`启动后台模式，每 ${SCAN_INTERVAL_MS / 1000 / 60} 分钟执行一次`, 'info');

  async function daemonLoop() {
    try {
      await runBackup(false);
    } catch (err) {
      log(`备份异常: ${err.message}`, 'error');
      console.error(err);
    }
  }

  // 立即执行一次
  daemonLoop();

  // 然后定期执行
  setInterval(daemonLoop, SCAN_INTERVAL_MS);

  // 优雅退出
  process.on('SIGINT', () => {
    log('收到 SIGINT，退出', 'info');
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    log('收到 SIGTERM，退出', 'info');
    process.exit(0);
  });
}
