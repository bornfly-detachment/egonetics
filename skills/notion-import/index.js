#!/usr/bin/env node
/**
 * Notion Import Skill
 * 递归导入 Notion 页面到 Egonetics
 *
 * 用法: npx notion-import <notion-url> <target-task-id> [options]
 */

const fs = require('fs');
const path = require('path');

const API_BASE = process.env.API_BASE || 'http://localhost:3002/api';

// 颜色
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function logError(msg) { log(`❌ ${msg}`, 'red'); }
function logSuccess(msg) { log(`✅ ${msg}`, 'green'); }
function logInfo(msg) { log(`ℹ️  ${msg}`, 'cyan'); }
function logStep(step, total, msg) { log(`[${step}/${total}] ${msg}`, 'blue'); }
function logWarn(msg) { log(`⚠️  ${msg}`, 'yellow'); }

// API 调用
async function apiCall(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// 健康检查
async function healthCheck() {
  logStep(1, 4, '检查服务状态...');
  try {
    await fetch(`${API_BASE}/health`);
    logSuccess('服务运行正常');
    return true;
  } catch (e) {
    logError('后端服务未启动');
    logInfo('请先运行: npm run dev');
    return false;
  }
}

// 创建导入任务
async function createImportTask(notionUrl, targetTaskId, parentPageId = null) {
  logStep(2, 4, '创建导入任务...');

  const result = await apiCall('/notion-md/import', {
    method: 'POST',
    body: JSON.stringify({
      notionPageUrl: notionUrl,
      targetTaskId,
      parentPageId,
      recursive: true,
    }),
  });

  logSuccess(`导入任务创建成功: ${result.importId}`);
  return result;
}

// 处理页面导入
async function processPage(importId, notionPageData) {
  const result = await apiCall(`/notion-md/import/${importId}/process`, {
    method: 'POST',
    body: JSON.stringify({ notionPageData }),
  });

  return result;
}

// 获取导入状态
async function getImportStatus(importId) {
  return apiCall(`/notion-md/import/${importId}/status`);
}

// 打印使用说明
function printUsageInstructions(importId, notionPageId) {
  log('');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  log('下一步：使用 Claude Code MCP 工具获取 Notion 内容', 'yellow');
  log('');
  log('1. 获取 Notion 页面内容:', 'cyan');
  log(`   使用 MCP 工具: notion-fetch`, 'gray');
  log(`   页面 ID: ${notionPageId}`, 'gray');
  log('');
  log('2. 处理导入:', 'cyan');
  log(`   POST ${API_BASE}/notion-md/import/${importId}/process`, 'gray');
  log('');
  log('3. 检查状态:', 'cyan');
  log(`   GET ${API_BASE}/notion-md/import/${importId}/status`, 'gray');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  log('');
}

// 显示帮助
function showHelp() {
  console.log(`
Notion 递归导入工具

用法: notion-import <notion-url> <target-task-id> [options]

参数:
  notion-url       Notion 页面 URL
  target-task-id   目标 Task ID

选项:
  -p, --parent <id>  指定父页面 ID
  -h, --help         显示帮助
  -v, --version      显示版本

示例:
  notion-import "https://notion.so/xxx" task-123
  notion-import "https://notion.so/xxx" task-123 -p page-456

环境变量:
  API_BASE    API 基础 URL (默认: http://localhost:3002/api)
`);
}

// 主函数
async function main() {
  const args = process.argv.slice(2);

  // 解析参数
  if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
    showHelp();
    process.exit(0);
  }

  if (args[0] === '-v' || args[0] === '--version') {
    console.log('notion-import v1.0.0');
    process.exit(0);
  }

  const notionUrl = args[0];
  const targetTaskId = args[1];
  let parentPageId = null;

  // 解析选项
  for (let i = 2; i < args.length; i++) {
    if ((args[i] === '-p' || args[i] === '--parent') && args[i + 1]) {
      parentPageId = args[i + 1];
      i++;
    }
  }

  // 验证参数
  if (!notionUrl || !targetTaskId) {
    logError('缺少必要参数');
    showHelp();
    process.exit(1);
  }

  // 执行流程
  log('');
  log('╔════════════════════════════════════════╗', 'green');
  log('║     Notion 递归导入工具 v1.0.0         ║', 'green');
  log('╚════════════════════════════════════════╝', 'green');
  log('');

  try {
    // 健康检查
    const isHealthy = await healthCheck();
    if (!isHealthy) {
      process.exit(1);
    }

    // 创建导入任务
    const task = await createImportTask(notionUrl, targetTaskId, parentPageId);

    // 打印使用说明
    printUsageInstructions(task.importId, task.notionPageId);

    logSuccess('导入任务准备完成！');
    logInfo('请按照上方说明使用 Claude Code MCP 工具继续导入流程');

  } catch (error) {
    logError(error.message);
    process.exit(1);
  }
}

// 运行
main().catch(console.error);
