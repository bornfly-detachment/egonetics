#!/bin/bash
# 开机检查并补录昨天未入库的对话

cd "$(dirname "$0")"

echo "=========================================="
echo "🔄 开机检查 - $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="

# 检查昨天是否有未入库的会话
/usr/bin/python3 smart_import.py --yesterday --check-only

# 执行入库（会自动处理活跃检测）
echo ""
echo "📦 开始入库..."
/usr/bin/python3 smart_import.py --yesterday

echo ""
echo "✅ 检查完成"
