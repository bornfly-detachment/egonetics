#!/bin/bash

cd "$(dirname "$0")"

echo "🔄 初始化 Tasks 数据库..."

# 删除现有数据库文件
if [ -f "tasks.db" ]; then
    rm tasks.db
    echo "🗑️  删除旧的 tasks.db 文件"
fi

# 创建新数据库并执行schema
echo "📋 执行数据库schema..."
sqlite3 tasks.db <<EOF
$(cat tasks_schema.sql)
EOF

if [ $? -eq 0 ]; then
    echo "✅ 数据库schema执行成功"
    
    # 验证表创建
    echo "📊 创建的数据库表:"
    sqlite3 tasks.db ".tables" | tr ' ' '\n' | grep -v '^$' | nl
    
    # 统计数据
    echo "📝 数据统计:"
    sqlite3 tasks.db "SELECT 'tasks: ' || COUNT(*) FROM tasks;"
    sqlite3 tasks.db "SELECT 'task_property_defs: ' || COUNT(*) FROM task_property_defs;"
    sqlite3 tasks.db "SELECT 'task_properties: ' || COUNT(*) FROM task_properties;"
    sqlite3 tasks.db "SELECT 'task_versions: ' || COUNT(*) FROM task_versions;"
    
    echo "🎉 Tasks 数据库初始化完成!"
    echo "📁 数据库文件: $(pwd)/tasks.db"
else
    echo "❌ 数据库初始化失败"
    exit 1
fi
