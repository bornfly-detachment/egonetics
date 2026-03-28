#!/bin/bash
#
# import-notion.sh
# Notion 递归导入 CLI 工具
#
# 用法: ./import-notion.sh <notion-url> <target-task-id> [options]
#

set -e

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

# 配置
API_BASE="${API_BASE:-http://localhost:3002/api}"

# 打印函数
log_info() { echo -e "${CYAN}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }
log_step() { echo -e "${BLUE}[$1/$2]${NC} $3"; }
log_warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }

# 检查依赖
check_deps() {
  if ! command -v curl &> /dev/null; then
    log_error "需要安装 curl"
    exit 1
  fi

  if ! command -v jq &> /dev/null; then
    log_error "需要安装 jq"
    exit 1
  fi
}

# 检查服务
health_check() {
  log_step "1" "5" "检查服务状态..."

  if ! curl -s "${API_BASE}/health" > /dev/null; then
    log_error "后端服务未启动"
    log_info "请先运行: npm run dev"
    exit 1
  fi

  log_success "服务运行正常"
  echo ""
}

# 创建导入任务
create_import_task() {
  local notion_url=$1
  local target_task=$2
  local parent_page=$3

  log_step "2" "5" "创建导入任务..."

  local response
  response=$(curl -s -X POST "${API_BASE}/notion-md/import" \
    -H "Content-Type: application/json" \
    -d "{
      \"notionPageUrl\": \"${notion_url}\",
      \"targetTaskId\": \"${target_task}\",
      \"parentPageId\": ${parent_page:+\"$parent_page\"}${parent_page:-null},
      \"recursive\": true
    }" 2>&1)

  if [ $? -ne 0 ]; then
    log_error "创建导入任务失败"
    echo "$response"
    exit 1
  fi

  local import_id
  import_id=$(echo "$response" | jq -r '.importId // empty')

  if [ -z "$import_id" ] || [ "$import_id" = "null" ]; then
    log_error "无法获取导入ID"
    echo "$response" | jq '.'
    exit 1
  fi

  echo "$import_id" > /tmp/notion-import-id.txt
  log_success "导入任务创建成功: ${import_id}"
  echo ""

  # 打印 Notion Page ID
  local notion_page_id
  notion_page_id=$(echo "$response" | jq -r '.notionPageId // empty')
  if [ -n "$notion_page_id" ] && [ "$notion_page_id" != "null" ]; then
    echo -e "${GRAY}Notion Page ID: ${notion_page_id}${NC}"
    echo ""
  fi
}

# 打印使用说明
print_usage_instructions() {
  local import_id
  import_id=$(cat /tmp/notion-import-id.txt)

  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${YELLOW}下一步：使用 Claude Code MCP 工具获取 Notion 内容${NC}"
  echo ""
  echo -e "${CYAN}1. 获取 Notion 页面内容:${NC}"
  echo -e "   在 Claude Code 中执行:"
  echo -e "   ${GRAY}使用 notion-fetch MCP 工具${NC}"
  echo ""
  echo -e "${CYAN}2. 处理导入:${NC}"
  echo -e "   将获取的数据 POST 到:"
  echo -e "   ${GRAY}POST ${API_BASE}/notion-md/import/${import_id}/process${NC}"
  echo ""
  echo -e "${CYAN}3. 检查状态:${NC}"
  echo -e "   ${GRAY}GET ${API_BASE}/notion-md/import/${import_id}/status${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
}

# 主函数
main() {
  # 显示帮助
  if [ $# -eq 0 ] || [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    echo "Notion 递归导入工具"
    echo ""
    echo "用法: $0 <notion-url> <target-task-id> [options]"
    echo ""
    echo "参数:"
    echo "  notion-url       Notion 页面 URL"
    echo "  target-task-id   目标 Task ID"
    echo ""
    echo "选项:"
    echo "  -p, --parent <id>  指定父页面 ID"
    echo "  -h, --help         显示帮助"
    echo ""
    echo "示例:"
    echo "  $0 \"https://notion.so/xxx\" task-123"
    echo "  $0 \"https://notion.so/xxx\" task-123 -p page-456"
    echo ""
    echo "环境变量:"
    echo "  API_BASE    API 基础 URL (默认: http://localhost:3002/api)"
    exit 0
  fi

  # 解析参数
  local notion_url=$1
  local target_task=$2
  local parent_page=""

  shift 2
  while [ $# -gt 0 ]; do
    case $1 in
      -p|--parent)
        parent_page=$2
        shift 2
        ;;
      *)
        log_warn "未知选项: $1"
        shift
        ;;
    esac
  done

  # 检查参数
  if [ -z "$notion_url" ] || [ -z "$target_task" ]; then
    log_error "缺少必要参数"
    echo "用法: $0 <notion-url> <target-task-id>"
    exit 1
  fi

  # 执行流程
  check_deps
  health_check
  create_import_task "$notion_url" "$target_task" "$parent_page"
  print_usage_instructions

  log_success "导入任务准备完成！"
  log_info "请按照上方说明使用 Claude Code MCP 工具继续导入流程"
}

# 运行主函数
main "$@"
