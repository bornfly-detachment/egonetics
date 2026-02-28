#!/usr/bin/env python3
"""
每日工作总结脚本
- 读取当天的所有会话记录
- 生成工作总结（任务进度、TODO等）
- 写入到共享目录，由 model_training agent 转发到飞书
"""

import os
import sys
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path

DB_PATH = "/Users/bornfly/Desktop/bornfly_v1/egonetics/server/memory.db"
SUMMARY_SESSION = "model_training:main"  # 目标agent
SUMMARY_DIR = "/Users/bornfly/.openclaw/workspace-model_training/work-summary"  # 共享目录

def get_today_sessions():
    """获取今天的所有会话（凌晨6点前算昨天）"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    now = datetime.now()
    # 凌晨6点前算昨天
    if now.hour < 6:
        today = (now - timedelta(days=1)).date()
    else:
        today = now.date()
    tomorrow = today + timedelta(days=1)
    
    cursor.execute("""
        SELECT s.id, s.title, s.created_at, s.agent, 
               COUNT(m.id) as msg_count,
               GROUP_CONCAT(DISTINCT m.provider) as providers
        FROM sessions s
        LEFT JOIN messages m ON s.id = m.session_id
        WHERE date(s.created_at) >= date(?) AND date(s.created_at) < date(?)
        GROUP BY s.id
        ORDER BY s.created_at DESC
    """, (today.isoformat(), tomorrow.isoformat()))
    
    sessions = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return sessions

def get_session_messages(session_id):
    """获取会话的关键消息（用户输入和assistant输出）"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT role, content, message_type, tool_name, timestamp
        FROM messages
        WHERE session_id = ? AND role IN ('user', 'assistant')
        ORDER BY timestamp
        LIMIT 50
    """, (session_id,))
    
    messages = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return messages

def extract_todos(messages):
    """从消息中提取TODO关键词"""
    todos = []
    keywords = ['todo', '待办', 'TODO', '需要', '接下来', '计划', '待处理', '未完成']
    
    for msg in messages:
        content = msg.get('content', '')
        for keyword in keywords:
            if keyword in content:
                # 提取包含关键词的句子
                lines = content.split('\n')
                for line in lines:
                    if keyword in line and len(line) > 10:
                        todos.append(line.strip()[:100])
                        break
    
    return list(set(todos))[:10]  # 去重，最多10条

def generate_summary():
    """生成每日工作总结"""
    sessions = get_today_sessions()
    
    if not sessions:
        return None, "今天没有工作记录"
    
    summary_lines = []
    now = datetime.now()
    if now.hour < 6:
        today = (now - timedelta(days=1)).strftime("%Y年%m月%d日")
    else:
        today = now.strftime("%Y年%m月%d日")
    summary_lines.append(f"# 📅 {today} 工作总结")
    summary_lines.append("")
    
    # 统计信息
    total_sessions = len(sessions)
    total_messages = sum(s['msg_count'] for s in sessions)
    agents = list(set(s['agent'] or 'main' for s in sessions))
    
    summary_lines.append(f"## 📊 工作统计")
    summary_lines.append(f"- 会话数量: {total_sessions}")
    summary_lines.append(f"- 消息总数: {total_messages}")
    summary_lines.append(f"- 涉及Agent: {', '.join(agents)}")
    summary_lines.append("")
    
    # 会话列表
    summary_lines.append(f"## 💬 今日会话")
    for s in sessions:
        agent_tag = f"[{s['agent']}]" if s['agent'] else "[main]"
        time_str = s['created_at'][11:16] if s['created_at'] else "??:??"
        summary_lines.append(f"- **{time_str}** {agent_tag} {s['title']} ({s['msg_count']}条消息)")
    summary_lines.append("")
    
    # 提取TODO
    all_todos = []
    for s in sessions[:5]:  # 只看最近的5个会话
        messages = get_session_messages(s['id'])
        todos = extract_todos(messages)
        all_todos.extend(todos)
    
    if all_todos:
        summary_lines.append(f"## ✅ 待办事项/TODO")
        for i, todo in enumerate(all_todos[:10], 1):
            summary_lines.append(f"{i}. {todo}")
        summary_lines.append("")
    
    # 任务进度总结
    summary_lines.append(f"## 📝 任务进展")
    summary_lines.append("根据今日对话记录：")
    
    # 简单的任务推断
    task_keywords = {
        '入库': '数据入库任务',
        '导入': '数据导入工作',
        '数据库': '数据库管理',
        '模型': '模型配置/切换',
        '定时': '定时任务设置',
        '记忆': '记忆管理',
        '会话': '会话管理',
        '配置': '系统配置',
    }
    
    tasks_done = set()
    for s in sessions:
        title = s['title'] or ''
        for keyword, task_name in task_keywords.items():
            if keyword in title or keyword in str(s.get('providers', '')):
                tasks_done.add(task_name)
    
    if tasks_done:
        for task in tasks_done:
            summary_lines.append(f"- ✓ {task}")
    else:
        summary_lines.append("- 对话记录回顾与分析")
    
    summary_lines.append("")
    summary_lines.append("---")
    summary_lines.append("*此总结由 OpenClaw 自动生成*")
    
    return summary_lines, None

def send_to_agent(summary_lines):
    """发送总结到指定agent（通过共享文件）"""
    import os
    from datetime import datetime
    
    summary_text = "\n".join(summary_lines)
    
    print("=" * 70)
    print("📤 发送工作总结（通过共享文件）...")
    print("=" * 70)
    print(summary_text)
    print("=" * 70)
    
    # 确保目录存在
    os.makedirs(SUMMARY_DIR, exist_ok=True)
    
    # 文件名格式：YYYY-MM-DD.md（凌晨6点前算昨天）
    now = datetime.now()
    if now.hour < 6:
        today = (now - timedelta(days=1)).strftime("%Y-%m-%d")
    else:
        today = now.strftime("%Y-%m-%d")
    summary_file = os.path.join(SUMMARY_DIR, f"{today}.md")
    
    # 写入文件
    with open(summary_file, 'w', encoding='utf-8') as f:
        f.write(summary_text)
    
    print(f"✅ 已写入共享文件: {summary_file}")
    print(f"   agent:model_training:main 会通过 heartbeat 读取并转发到飞书")

def main():
    print("🤖 生成每日工作总结...")
    print(f"⏰ {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("")
    
    summary_lines, error = generate_summary()
    
    if error:
        print(f"ℹ️ {error}")
        return
    
    # 打印总结
    print("\n".join(summary_lines))
    
    # 发送
    print("")
    send_to_agent(summary_lines)

if __name__ == "__main__":
    main()
