#!/usr/bin/env bash
# Egonetics 一键启动脚本
# 用法: ./start.sh [--no-open]
#
# 启动顺序:
#   1. Express 后端  (port 3002)  —— cd server && npm run dev
#   2. 等待后端健康检查通过
#   3. Vite 前端     (port 3000)  —— npm run dev
#   Ctrl-C 同时关闭两个进程

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/server"
HEALTH_URL="http://localhost:3002/api/health"
MAX_WAIT=20  # 秒

# ── 颜色 ──────────────────────────────────────────────────────
R='\033[0;31m'; G='\033[0;32m'; Y='\033[1;33m'; B='\033[0;34m'; N='\033[0m'

log()  { echo -e "${B}[egonetics]${N} $*"; }
ok()   { echo -e "${G}[egonetics]${N} $*"; }
warn() { echo -e "${Y}[egonetics]${N} $*"; }
err()  { echo -e "${R}[egonetics]${N} $*"; }

BACKEND_PID=""
FRONTEND_PID=""

# ── 首次运行：检查 auth.db 是否已初始化 ──────────────────────
check_auth_db() {
  local db="$BACKEND_DIR/data/auth.db"
  if [[ ! -f "$db" ]]; then
    echo ""
    warn "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    warn "  首次运行：auth.db 不存在"
    warn "  请先初始化认证数据库并创建管理员账号："
    warn ""
    warn "    cd server && npm run init-auth"
    warn ""
    warn "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    read -r -p "  现在立即运行初始化？[Y/n] " ans
    ans="${ans:-Y}"
    if [[ "$ans" =~ ^[Yy]$ ]]; then
      cd "$BACKEND_DIR"
      node scripts/init-auth-db.js
      cd "$SCRIPT_DIR"
      echo ""
    else
      err "已取消。请手动运行: cd server && npm run init-auth"
      exit 1
    fi
    return
  fi

  # auth.db exists — check if admin account was created
  local has_admin
  has_admin=$(node -e "
    const sqlite3 = require('sqlite3');
    const db = new sqlite3.Database('$db');
    db.get('SELECT id FROM users WHERE role=\"admin\" LIMIT 1', (err, row) => {
      process.stdout.write(row ? '1' : '0');
      db.close();
    });
  " 2>/dev/null || echo "0")

  if [[ "$has_admin" != "1" ]]; then
    echo ""
    warn "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    warn "  auth.db 存在但尚未创建管理员账号"
    warn "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    read -r -p "  现在创建管理员账号？[Y/n] " ans
    ans="${ans:-Y}"
    if [[ "$ans" =~ ^[Yy]$ ]]; then
      cd "$BACKEND_DIR"
      node scripts/init-auth-db.js
      cd "$SCRIPT_DIR"
      echo ""
    else
      warn "跳过，启动后无法登录管理员账号。"
    fi
  fi
}

check_auth_db

# ── 清理 ──────────────────────────────────────────────────────
cleanup() {
  echo ""
  warn "⏹  正在关闭所有服务..."
  [[ -n "$FRONTEND_PID" ]] && kill "$FRONTEND_PID" 2>/dev/null && ok "前端已关闭 (PID $FRONTEND_PID)"
  [[ -n "$BACKEND_PID"  ]] && kill "$BACKEND_PID"  2>/dev/null && ok "后端已关闭 (PID $BACKEND_PID)"
  exit 0
}
trap cleanup INT TERM

# ── 检查端口是否被占用 ────────────────────────────────────────
port_in_use() {
  lsof -i ":$1" -sTCP:LISTEN -t 2>/dev/null | head -1
}

check_port() {
  local port=$1 name=$2
  local pid
  pid=$(port_in_use "$port") || true
  if [[ -n "$pid" ]]; then
    warn "端口 $port ($name) 已被占用 (PID $pid)，跳过启动"
    echo "$pid"
    return 0
  fi
  echo ""
}

# ── 启动后端 ──────────────────────────────────────────────────
log "▶ 后端 (port 3002)..."

existing_backend=$(check_port 3002 "Express")
if [[ -n "$existing_backend" ]]; then
  BACKEND_PID="$existing_backend"
  ok "复用已有后端进程 (PID $BACKEND_PID)"
else
  cd "$BACKEND_DIR"
  npm run dev > /tmp/egonetics-backend.log 2>&1 &
  BACKEND_PID=$!
  ok "后端已启动 (PID $BACKEND_PID)，日志: /tmp/egonetics-backend.log"
fi

# ── 等待后端健康检查 ──────────────────────────────────────────
log "⏳ 等待后端就绪 (最多 ${MAX_WAIT}s)..."
for ((i=1; i<=MAX_WAIT; i++)); do
  if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
    ok "✅ 后端已就绪 (${i}s)"
    break
  fi
  if [[ $i -eq $MAX_WAIT ]]; then
    err "❌ 后端 ${MAX_WAIT}s 内未就绪，查看日志: /tmp/egonetics-backend.log"
    cat /tmp/egonetics-backend.log | tail -20
    cleanup
  fi
  sleep 1
done

# ── 启动前端 ──────────────────────────────────────────────────
log "▶ 前端 (port 3000)..."
cd "$SCRIPT_DIR"

existing_frontend=$(check_port 3000 "Vite")
if [[ -n "$existing_frontend" ]]; then
  FRONTEND_PID="$existing_frontend"
  ok "复用已有前端进程 (PID $FRONTEND_PID)"
else
  npm run dev > /tmp/egonetics-frontend.log 2>&1 &
  FRONTEND_PID=$!
  ok "前端已启动 (PID $FRONTEND_PID)，日志: /tmp/egonetics-frontend.log"
fi

echo ""
ok "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ok "  前端: http://localhost:3000"
ok "  后端: http://localhost:3002"
ok "  按 Ctrl-C 同时关闭两个服务"
ok "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── 持续等待，保持 trap 活跃 ──────────────────────────────────
wait
