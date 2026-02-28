#!/usr/bin/env python3
"""
每日定时导入脚本
在凌晨2点运行，导入前一天（或当天）的OpenClaw会话JSONL文件
"""

import os
import sys
import sqlite3
import argparse
from datetime import datetime, timedelta
from pathlib import Path

# 配置
SESSION_DIR = "/Users/bornfly/.openclaw/agents/main/sessions"
DB_PATH = "/Users/bornfly/Desktop/bornfly_v1/egonetics/server/memory.db"
IMPORT_SCRIPT = "/Users/bornfly/Desktop/bornfly_v1/egonetics/server/import_v5.py"

def get_date_range(hours_offset=0):
    """
    获取要导入的文件日期范围
    默认：导入前一天的文件（假设在凌晨2点运行）
    hours_offset: 小时偏移，用于调试
    """
    now = datetime.now() - timedelta(hours=hours_offset)
    
    # 如果是凌晨2点（0-5点），导入前一天的文件
    # 否则导入当天的文件（但一般脚本只在凌晨运行）
    if 0 <= now.hour < 5:
        target_date = now.date() - timedelta(days=1)
    else:
        target_date = now.date()
    
    start = datetime.combine(target_date, datetime.min.time())
    end = datetime.combine(target_date, datetime.max.time())
    
    print(f"📅 导入日期范围: {target_date} ({start} 到 {end})")
    return start, end, target_date

def find_jsonl_files(date_start, date_end):
    """查找在指定日期范围内的JSONL文件"""
    files = []
    session_path = Path(SESSION_DIR)
    
    if not session_path.exists():
        print(f"❌ 会话目录不存在: {SESSION_DIR}")
        return files
    
    for file in session_path.glob("*.jsonl"):
        if file.name.endswith(".deleted"):
            continue
        
        # 获取文件修改时间
        mtime = datetime.fromtimestamp(file.stat().st_mtime)
        
        # 检查是否在日期范围内
        if date_start <= mtime <= date_end:
            files.append((file, mtime))
    
    # 按修改时间排序
    files.sort(key=lambda x: x[1])
    return files

def import_file(file_path):
    """使用import_v5.py导入单个文件"""
    import subprocess
    
    cmd = [sys.executable, IMPORT_SCRIPT, str(file_path), "--db", DB_PATH]
    print(f"🔄 导入: {file_path.name}")
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        if result.returncode == 0:
            print(f"✅ 导入成功: {file_path.name}")
            # 打印最后几行输出
            for line in result.stdout.strip().split('\n')[-3:]:
                if line.strip():
                    print(f"   {line.strip()}")
        else:
            print(f"❌ 导入失败: {file_path.name}")
            print(f"   错误: {result.stderr[:200]}")
    except subprocess.TimeoutExpired:
        print(f"⏱️  导入超时: {file_path.name}")
    except Exception as e:
        print(f"⚠️  导入异常: {file_path.name} - {e}")

def check_already_imported(file_path):
    """检查文件是否已经导入过（通过source_file字段）"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        cursor.execute(
            "SELECT COUNT(*) FROM sessions WHERE source_file = ?",
            (str(file_path),)
        )
        count = cursor.fetchone()[0]
        return count > 0
    except sqlite3.Error as e:
        print(f"数据库查询错误: {e}")
        return False
    finally:
        conn.close()

def main():
    parser = argparse.ArgumentParser(description="每日OpenClaw会话导入")
    parser.add_argument("--hours-offset", type=int, default=0,
                       help="小时偏移（用于测试）")
    parser.add_argument("--force", action="store_true",
                       help="强制重新导入，即使已经导入过")
    args = parser.parse_args()
    
    print("=" * 60)
    print("📊 每日OpenClaw会话导入脚本")
    print(f"时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    # 获取日期范围
    date_start, date_end, target_date = get_date_range(args.hours_offset)
    
    # 查找文件
    files = find_jsonl_files(date_start, date_end)
    
    if not files:
        print("📭 未找到符合条件的JSONL文件")
        return
    
    print(f"📁 找到 {len(files)} 个文件:")
    for file, mtime in files:
        print(f"   • {file.name} ({mtime.strftime('%Y-%m-%d %H:%M')})")
    
    # 导入文件
    imported = 0
    for file, mtime in files:
        # 检查是否已经导入
        if not args.force and check_already_imported(file):
            print(f"⏭️  跳过已导入: {file.name}")
            continue
        
        import_file(file)
        imported += 1
    
    print("=" * 60)
    print(f"🎉 导入完成！处理 {len(files)} 个文件，导入 {imported} 个新会话")
    print(f"数据库: {DB_PATH}")
    print("=" * 60)

if __name__ == "__main__":
    main()
