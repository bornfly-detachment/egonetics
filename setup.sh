#!/usr/bin/env bash
# setup.sh — 新机器克隆后初始化 PRVSE World 工作区
#
# 创建 prvse_world_workspace/ 三级目录结构，并重建 Egonetics 内的相对软链接
# 只需在 egonetics/ 根目录执行一次：bash setup.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE="$(dirname "$SCRIPT_DIR")/prvse_world_workspace"

echo "=== Egonetics Setup ==="
echo "Workspace: $WORKSPACE"

# ── 1. 创建工作区目录 ──────────────────────────────────────────
mkdir -p "$WORKSPACE/L0"
mkdir -p "$WORKSPACE/L1"
mkdir -p "$WORKSPACE/L2/storage"
mkdir -p "$WORKSPACE/L2/ai-resources/constitution"
mkdir -p "$WORKSPACE/L2/ai-resources/goals"
mkdir -p "$WORKSPACE/L2/ai-resources/resources"
echo "[✓] prvse_world_workspace/ 目录结构已创建"

# ── 2. server/data → L2/storage（相对软链接）─────────────────
DATA_LINK="$SCRIPT_DIR/server/data"
if [ -L "$DATA_LINK" ]; then
  echo "[✓] server/data 软链接已存在，跳过"
else
  ln -s "../../prvse_world_workspace/L2/storage" "$DATA_LINK"
  echo "[✓] server/data → ../../prvse_world_workspace/L2/storage"
fi

# ── 3. agent-spaces → L2/ai-resources（相对软链接）──────────
AGENT_LINK="$SCRIPT_DIR/agent-spaces"
if [ -L "$AGENT_LINK" ]; then
  echo "[✓] agent-spaces 软链接已存在，跳过"
else
  ln -s "../prvse_world_workspace/L2/ai-resources" "$AGENT_LINK"
  echo "[✓] agent-spaces → ../prvse_world_workspace/L2/ai-resources"
fi

# ── 4. 初始化数据库 ────────────────────────────────────────────
echo ""
echo "=== 初始化数据库 ==="
cd "$SCRIPT_DIR/server"
if [ -f "package.json" ]; then
  node -e "require('./db')" 2>/dev/null && echo "[✓] db.js 连接成功" || echo "[!] db.js 连接失败，请检查"
fi

echo ""
echo "=== Setup 完成 ==="
echo "启动服务: bash start.sh"
