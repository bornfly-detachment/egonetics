#!/usr/bin/env python3
"""
智能入库脚本 - 检测用户活跃状态，1小时无活动才入库
支持：每天0点入库前一天内容，或开机后补录
"""

import os
import sys
import sqlite3
import argparse
from datetime import datetime, timedelta
from pathlib import Path
import time

# 配置
AGENTS_DIR = "/Users/bornfly/.openclaw/agents"
DB_PATH = "/Users/bornfly/Desktop/bornfly_v1/egonetics/server/memory.db"
IMPORT_SCRIPT = "/Users/bornfly/Desktop/bornfly_v1/egonetics/server/import_v5.py"
INACTIVITY_THRESHOLD = 3600  # 1小时（秒）

def get_all_agent_dirs():
    """获取所有agent目录"""
    agents = []
    agents_path = Path(AGENTS_DIR)
    if agents_path.exists():
        for d in agents_path.iterdir():
            if d.is_dir() and (d / "sessions").exists():
                agents.append(d.name)
    return agents

def get_session_files(agent_dir, target_date=None):
    """获取指定agent的会话文件，按日期筛选"""
    session_path = Path(AGENTS_DIR) / agent_dir / "sessions"
    files = []
    
    if not session_path.exists():
        return files
    
    for file in session_path.glob("*.jsonl"):
        if file.name.endswith(".deleted"):
            continue
        
        # 获取文件修改时间
        mtime = datetime.fromtimestamp(file.stat().st_mtime)
        
        # 如果指定了目标日期，筛选该日期的文件
        if target_date:
            if mtime.date() == target_date:
                files.append((file, mtime, agent_dir))
        else:
            files.append((file, mtime, agent_dir))
    
    return files

def is_user_active(files):
    """检查用户是否在1小时内有活动"""
    now = datetime.now()
    for file, mtime, _ in files:
        if (now - mtime).total_seconds() < INACTIVITY_THRESHOLD:
            return True, file.name, (now - mtime).total_seconds() / 60
    return False, None, 0

def check_already_imported(file_path):
    """检查文件是否已经导入"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT COUNT(*) FROM sessions WHERE source_file = ?",
            (str(file_path),)
        )
        count = cursor.fetchone()[0]
        return count > 0
    except:
        return False
    finally:
        conn.close()

def import_file(file_path, agent_name):
    """导入单个文件"""
    import subprocess
    
    cmd = [sys.executable, IMPORT_SCRIPT, str(file_path), "--db", DB_PATH]
    print(f"🔄 导入 [{agent_name}]: {file_path.name}")
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        if result.returncode == 0:
            print(f"✅ 导入成功: {file_path.name}")
            # 更新agent字段
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            session_id = file_path.stem
            cursor.execute(
                "UPDATE sessions SET agent = ? WHERE id = ?",
                (agent_name, session_id)
            )
            conn.commit()
            conn.close()
            return True
        else:
            print(f"❌ 导入失败: {file_path.name}")
            print(f"   错误: {result.stderr[:200]}")
            return False
    except Exception as e:
        print(f"⚠️  导入异常: {file_path.name} - {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description="智能入库 - 检测活跃状态")
    parser.add_argument("--force", action="store_true", help="强制入库，忽略活跃检测")
    parser.add_argument("--yesterday", action="store_true", help="只入库昨天的内容")
    parser.add_argument("--check-only", action="store_true", help="只检查，不入库")
    args = parser.parse_args()
    
    print("=" * 70)
    print("📦 智能入库系统")
    print(f"⏰ 当前时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"⏱️  活跃阈值: {INACTIVITY_THRESHOLD/60:.0f}分钟无活动")
    print("=" * 70)
    
    # 确定目标日期
    now = datetime.now()
    if args.yesterday or now.hour < 6:  # 凌晨6点前，处理前一天
        target_date = (now - timedelta(days=1)).date()
    else:
        target_date = now.date()
    
    print(f"📅 目标日期: {target_date}")
    
    # 收集所有需要处理的文件
    all_files = []
    agents = get_all_agent_dirs()
    print(f"🔍 发现 {len(agents)} 个 agent: {', '.join(agents)}")
    
    for agent in agents:
        files = get_session_files(agent, target_date)
        all_files.extend(files)
    
    if not all_files:
        print("📭 没有找到需要入库的会话文件")
        return
    
    print(f"📁 找到 {len(all_files)} 个会话文件")
    for file, mtime, agent in all_files:
        status = "✓已导入" if check_already_imported(file) else "○待导入"
        print(f"   • [{agent}] {file.name} ({mtime.strftime('%H:%M')}) {status}")
    
    # 检查用户活跃状态
    if not args.force:
        is_active, active_file, minutes_ago = is_user_active(all_files)
        if is_active:
            print(f"\n⏳ 用户仍在活跃中...")
            print(f"   最近活动: {active_file} ({minutes_ago:.0f}分钟前)")
            print(f"   延迟入库，直到 {INACTIVITY_THRESHOLD/60:.0f}分钟无活动")
            
            if args.check_only:
                return
            
            # 等待直到不活跃
            print(f"\n🕐 等待用户停止活动...")
            wait_count = 0
            while True:
                time.sleep(60)  # 每分钟检查一次
                wait_count += 1
                
                # 重新检查活跃状态
                all_files = []
                for agent in agents:
                    files = get_session_files(agent, target_date)
                    all_files.extend(files)
                
                is_active, active_file, minutes_ago = is_user_active(all_files)
                
                if not is_active:
                    print(f"✅ 用户已停止活动 {INACTIVITY_THRESHOLD/60:.0f}分钟，开始入库")
                    break
                else:
                    print(f"   ...仍在活跃 ({minutes_ago:.0f}分钟前)，继续等待 ({wait_count}分钟)")
    
    if args.check_only:
        print("\n✓ 检查完成，不入库")
        return
    
    # 执行入库
    print("\n" + "=" * 70)
    print("🚀 开始入库...")
    print("=" * 70)
    
    imported = 0
    skipped = 0
    for file, mtime, agent in all_files:
        if check_already_imported(file):
            print(f"⏭️  跳过已导入: {file.name}")
            skipped += 1
            continue
        
        if import_file(file, agent):
            imported += 1
    
    print("=" * 70)
    print(f"🎉 入库完成!")
    print(f"   新导入: {imported} 个会话")
    print(f"   已存在: {skipped} 个会话")
    print("=" * 70)

if __name__ == "__main__":
    main()
