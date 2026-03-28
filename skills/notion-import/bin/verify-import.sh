#!/bin/bash
#
# verify-import.sh
# 验证 Notion 导入结果
#

set -e

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m'

# 配置
API_BASE="${API_BASE:-http://localhost:3002/api}"
DB_DIR="${DB_DIR:-./server/data}"

# 打印函数
log_info() { echo -e "${CYAN}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }
log_warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_header() { echo -e "${BLUE}$1${NC}"; }

# 检查数据库
verify_database() {
  log_header "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  log_info "检查数据库..."

  if [ ! -f "$DB_DIR/pages.db" ]; then
    log_error "pages.db 不存在: $DB_DIR/pages.db"
    return 1
  fi

  if [ ! -f "$DB_DIR/memory.db" ]; then
    log_error "memory.db 不存在: $DB_DIR/memory.db"
    return 1
  fi

  log_success "数据库检查通过"
  echo ""
  return 0
}

# 统计导入的页面
verify_imported_pages() {
  log_header "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  log_info "统计导入的页面..."

  # 查询所有导入的页面
  local query="
    SELECT
      p.id,
      p.title,
      p.parent_id,
      p.ref_id,
      p.position
    FROM pages p
    WHERE p.ref_id = 'task-1773422058-d77c1f'
       OR p.parent_id IN (
         SELECT id FROM pages WHERE ref_id = 'task-1773422058-d77c1f'
       )
    ORDER BY p.position
  "

  local result
  result=$(sqlite3 "$DB_DIR/pages.db" "$query" 2>/dev/null || echo "")

  if [ -z "$result" ]; then
    log_warn "未找到导入的页面"
    return 1
  fi

  # 统计
  local total_count
  total_count=$(echo "$result" | wc -l)

  log_success "找到 $total_count 个导入的页面"
  echo ""

  # 打印页面列表
  log_header "页面列表:"
  echo "$result" | while IFS='|' read -r id title parent_id ref_id position; do
    if [ -z "$parent_id" ]; then
      echo -e "  ${GREEN}📄${NC} $title ${GRAY}(root, ref: $ref_id)${NC}"
    else
      echo -e "  ${BLUE}  📄${NC} $title ${GRAY}(parent: $parent_id)${NC}"
    fi
  done
  echo ""

  return 0
}

# 验证导入日志
verify_import_logs() {
  log_header "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  log_info "检查导入日志..."

  local query="
    SELECT
      id,
      status,
      notion_page_title,
      json_array_length(pages_imported) as pages_count,
      created_at
    FROM notion_import_logs
    WHERE notion_page_id = '316aa55009ee80838b0cf22b6b0b69a8'
    ORDER BY created_at DESC
    LIMIT 1
  "

  local result
  result=$(sqlite3 "$DB_DIR/memory.db" "$query" 2>/dev/null || echo "")

  if [ -z "$result" ]; then
    log_warn "未找到导入日志"
    return 1
  fi

  echo "$result" | while IFS='|' read -r id status title pages_count created_at; do
    log_success "找到导入日志"
    echo ""
    log_header "日志详情:"
    echo -e "  导入ID: ${CYAN}$id${NC}"
    echo -e "  状态: ${GREEN}$status${NC}"
    echo -e "  页面标题: $title"
    echo -e "  导入页面数: ${GREEN}$pages_count${NC}"
    echo -e "  创建时间: $created_at"
  done
  echo ""

  return 0
}

# 验证页面内容
verify_page_content() {
  log_header "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  log_info "检查页面内容..."

  # 获取主页面内容
  local query="
    SELECT
      p.title,
      b.content
    FROM pages p
    JOIN blocks b ON b.page_id = p.id
    WHERE p.title = '从头训练 智能分身'
    LIMIT 1
  "

  local result
  result=$(sqlite3 "$DB_DIR/pages.db" "$query" 2>/dev/null || echo "")

  if [ -z "$result" ]; then
    log_warn "未找到页面内容"
    return 1
  fi

  log_success "找到页面内容"

  # 提取 Markdown 预览
  local content
  content=$(echo "$result" | cut -d'|' -f2)

  # 解析 JSON 提取 text
  local markdown_preview
  markdown_preview=$(echo "$content" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    text = data.get('rich_text', [{}])[0].get('text', '')
    print(text[:500] + '...' if len(text) > 500 else text)
except:
    print('(无法解析内容)')
" 2>/dev/null || echo "(无法解析)")

  echo ""
  log_header "Markdown 内容预览:"
  echo -e "${GRAY}$markdown_preview${NC}"
  echo ""

  return 0
}

# 主函数
main() {
  echo ""
  echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║${NC}         Notion 导入验证工具                          ${GREEN}║${NC}"
  echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
  echo ""

  # 解析参数
  local target_task="${1:-task-1773422058-d77c1f}"

  log_info "验证目标 Task: $target_task"
  echo ""

  # 执行验证
  local has_errors=0

  verify_database || has_errors=1
  verify_import_logs || has_errors=1
  verify_imported_pages || has_errors=1
  verify_page_content || has_errors=1

  # 总结
  echo ""
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  if [ $has_errors -eq 0 ]; then
    echo -e "${GREEN}✅ 验证完成，所有检查通过！${NC}"
  else
    echo -e "${YELLOW}⚠️  验证完成，发现一些问题${NC}"
  fi
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
}

# 运行
main "$@"
