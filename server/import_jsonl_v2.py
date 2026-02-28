#!/usr/bin/env python3
"""
OpenClaw JSONL 会话文件导入脚本 v2

功能：
1. 解析OpenClaw会话JSONL文件
2. 保留所有消息类型（thinking, tool_call, tool_result, message）
3. 标记tool_call和tool_result为可折叠
4. 识别最终输出消息
5. 支持三级分类系统

使用：
python3 import_jsonl_v2.py <jsonl_file> [--db <database_path>]
"""

import json
import sqlite3
import argparse
import sys
import os
import re
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple

def parse_args():
    parser = argparse.ArgumentParser(description='导入OpenClaw JSONL会话文件到数据库(v2)')
    parser.add_argument('jsonl_file', help='JSONL文件路径')
    parser.add_argument('--db', default='memory.db', help='SQLite数据库路径（默认: memory.db）')
    parser.add_argument('--session-title', help='自定义会话标题')
    parser.add_argument('--session-summary', help='自定义会话摘要')
    return parser.parse_args()

def init_database(db_path: str):
    """初始化数据库，创建表结构（使用更新后的schema）"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 读取schema.sql并执行
    schema_path = os.path.join(os.path.dirname(__file__), 'schema.sql')
    if os.path.exists(schema_path):
        with open(schema_path, 'r', encoding='utf-8') as f:
            schema_sql = f.read()
        cursor.executescript(schema_sql)
        print(f"✅ 数据库架构已初始化: {db_path}")
    else:
        print(f"❌ 错误: schema.sql不存在于 {schema_path}")
        sys.exit(1)
    
    conn.commit()
    return conn

def parse_jsonl_file(file_path: str):
    """解析JSONL文件，返回解析后的记录列表"""
    records = []
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue
                
                try:
                    record = json.loads(line)
                    records.append(record)
                except json.JSONDecodeError as e:
                    print(f"⚠️  第{line_num}行JSON解析错误: {e}")
                    continue
    except FileNotFoundError:
        print(f"❌ 文件不存在: {file_path}")
        sys.exit(1)
    
    print(f"📊 已解析 {len(records)} 条记录来自: {file_path}")
    return records

def extract_session_info(records: List[Dict]) -> Dict[str, Any]:
    """从记录中提取会话信息"""
    session_info = {
        'id': None,
        'created_at': None,
        'first_timestamp': None,
        'last_timestamp': None,
        'message_count': 0,
        'thinking_count': 0,
        'tool_call_count': 0,
        'tool_result_count': 0
    }
    
    for record in records:
        record_type = record.get('type')
        timestamp = record.get('timestamp')
        
        # 查找会话记录
        if record_type == 'session':
            session_info['id'] = record.get('id')
            session_info['created_at'] = timestamp
        
        # 更新时间范围
        if timestamp:
            if not session_info['first_timestamp'] or timestamp < session_info['first_timestamp']:
                session_info['first_timestamp'] = timestamp
            if not session_info['last_timestamp'] or timestamp > session_info['last_timestamp']:
                session_info['last_timestamp'] = timestamp
        
        # 统计消息类型
        if record_type == 'message':
            session_info['message_count'] += 1
            # 检查消息内容类型
            message_data = record.get('message', {})
            role = message_data.get('role', '')
            content = message_data.get('content', [])
            
            for item in content:
                item_type = item.get('type')
                if item_type == 'thinking':
                    session_info['thinking_count'] += 1
                elif item_type == 'toolCall':
                    session_info['tool_call_count'] += 1
                elif item_type == 'toolResult':
                    session_info['tool_result_count'] += 1
    
    return session_info

def process_message_content(content: List[Dict], message_id: str, role: str) -> Tuple[str, str, bool, bool]:
    """
    处理消息内容，提取文本并确定消息类型
    
    返回: (提取的文本内容, 消息类型, 是否可折叠, 是否为最终输出)
    """
    extracted_text_parts = []
    message_type = 'message'
    is_collapsible = False
    is_final_output = False
    
    # 分析内容类型
    has_thinking = False
    has_tool_call = False
    has_tool_result = False
    has_text = False
    
    for item in content:
        item_type = item.get('type')
        
        if item_type == 'text':
            has_text = True
            text = item.get('text', '')
            if text:
                extracted_text_parts.append(text)
        
        elif item_type == 'thinking':
            has_thinking = True
            thinking = item.get('thinking', '')
            if thinking:
                extracted_text_parts.append(f"[思考] {thinking}")
        
        elif item_type == 'toolCall':
            has_tool_call = True
            tool_name = item.get('name', 'unknown_tool')
            # 简化的工具调用表示
            extracted_text_parts.append(f"[工具调用] {tool_name}")
        
        elif item_type == 'toolResult':
            has_tool_result = True
            tool_name = item.get('toolName', 'unknown_tool')
            # 简化的工具结果表示
            extracted_text_parts.append(f"[工具结果] {tool_name}")
    
    # 确定消息类型
    if has_thinking and not has_tool_call and not has_tool_result:
        message_type = 'thinking'
    elif has_tool_call:
        message_type = 'tool_call'
        is_collapsible = True
    elif has_tool_result:
        message_type = 'tool_result'
        is_collapsible = True
    elif role == 'assistant' and has_text and not has_thinking and not has_tool_call:
        # 纯文本的assistant消息可能是最终输出
        message_type = 'message'
        is_final_output = True
    
    extracted_text = '\n'.join(extracted_text_parts)
    
    return extracted_text, message_type, is_collapsible, is_final_output

def import_records(conn, records: List[Dict], session_title: Optional[str] = None, 
                   session_summary: Optional[str] = None, source_file: str = ""):
    """将解析后的记录导入数据库"""
    cursor = conn.cursor()
    
    # 提取会话信息
    session_info = extract_session_info(records)
    session_id = session_info['id']
    
    if not session_id:
        # 如果没有找到session记录，使用文件名作为会话ID
        session_id = os.path.basename(source_file).replace('.jsonl', '')
        print(f"⚠️  未找到会话记录，使用文件名作为会话ID: {session_id}")
    
    # 确定会话创建时间
    created_at = session_info['created_at'] or session_info['first_timestamp'] or datetime.now().isoformat()
    updated_at = session_info['last_timestamp'] or datetime.now().isoformat()
    
    # 生成会话标题和摘要
    if not session_title:
        session_title = f"会话 {session_id[:8]}"
    
    if not session_summary:
        session_summary = (f"包含 {session_info['message_count']} 条消息, "
                          f"{session_info['thinking_count']} 条思考, "
                          f"{session_info['tool_call_count']} 次工具调用, "
                          f"{session_info['tool_result_count']} 次工具结果")
    
    # 插入或更新会话
    cursor.execute('''
        INSERT OR REPLACE INTO sessions (id, created_at, updated_at, title, summary, source_file)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (session_id, created_at, updated_at, session_title, session_summary, source_file))
    
    print(f"📝 会话已创建: {session_title}")
    print(f"📊 会话统计: {session_summary}")
    
    # 处理每条记录
    imported_count = 0
    skipped_count = 0
    
    # 先收集所有消息，用于识别最终输出
    all_messages = []
    for record in records:
        if record.get('type') == 'message':
            all_messages.append(record)
    
    # 处理消息
    for i, record in enumerate(all_messages):
        record_type = record.get('type')
        record_id = record.get('id')
        timestamp = record.get('timestamp')
        parent_id = record.get('parentId')
        
        if record_type != 'message':
            continue
        
        message_data = record.get('message', {})
        role = message_data.get('role', 'unknown')
        content = message_data.get('content', [])
        
        # 处理消息内容
        extracted_text, message_type, is_collapsible, is_final_output = process_message_content(
            content, record_id, role
        )
        
        # 如果没有提取到文本内容，跳过
        if not extracted_text.strip():
            skipped_count += 1
            continue
        
        # 存储原始内容（JSON格式）
        raw_content = json.dumps(content, ensure_ascii=False)
        
        # 插入消息
        try:
            cursor.execute('''
                INSERT OR REPLACE INTO messages 
                (id, session_id, message_type, content, timestamp, parent_id, role, 
                 is_collapsible, is_final_output, raw_content)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (record_id, session_id, message_type, extracted_text, timestamp, 
                  parent_id, role, is_collapsible, is_final_output, raw_content))
            
            imported_count += 1
            
            # 输出导入进度
            if imported_count % 10 == 0:
                print(f"📨 已导入 {imported_count} 条消息...")
                
        except sqlite3.Error as e:
            print(f"❌ 插入消息 {record_id} 失败: {e}")
            skipped_count += 1
    
    conn.commit()
    
    print(f"✅ 导入完成: {imported_count} 条消息已导入, {skipped_count} 条被跳过")
    
    # 更新最终输出标记：会话中最后一条assistant消息（非tool_call/tool_result）标记为最终输出
    try:
        cursor.execute('''
            WITH last_assistant_msg AS (
                SELECT id 
                FROM messages 
                WHERE session_id = ? 
                  AND role = 'assistant' 
                  AND message_type NOT IN ('tool_call', 'tool_result')
                ORDER BY timestamp DESC 
                LIMIT 1
            )
            UPDATE messages 
            SET is_final_output = 1 
            WHERE id = (SELECT id FROM last_assistant_msg)
        ''', (session_id,))
        
        updated_count = cursor.rowcount
        if updated_count > 0:
            print(f"🎯 已标记最后一条assistant消息为最终输出")
        
        conn.commit()
    except sqlite3.Error as e:
        print(f"⚠️  标记最终输出失败: {e}")
    
    return imported_count, skipped_count

def main():
    args = parse_args()
    
    # 初始化数据库
    print(f"🔧 初始化数据库: {args.db}")
    conn = init_database(args.db)
    
    # 解析JSONL文件
    print(f"📂 解析文件: {args.jsonl_file}")
    records = parse_jsonl_file(args.jsonl_file)
    
    if not records:
        print("❌ 没有可导入的记录")
        conn.close()
        return
    
    # 导入记录
    imported, skipped = import_records(
        conn, 
        records, 
        session_title=args.session_title,
        session_summary=args.session_summary,
        source_file=args.jsonl_file
    )
    
    # 显示统计信息
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM sessions")
    session_count = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM messages")
    message_count = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM messages WHERE message_type = 'thinking'")
    thinking_count = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM messages WHERE message_type = 'tool_call'")
    tool_call_count = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM messages WHERE message_type = 'tool_result'")
    tool_result_count = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM messages WHERE is_final_output = 1")
    final_output_count = cursor.fetchone()[0]
    
    print("\n📊 数据库统计:")
    print(f"   会话数: {session_count}")
    print(f"   消息总数: {message_count}")
    print(f"   思考记录: {thinking_count}")
    print(f"   工具调用: {tool_call_count}")
    print(f"   工具结果: {tool_result_count}")
    print(f"   最终输出: {final_output_count}")
    print(f"   普通消息: {message_count - thinking_count - tool_call_count - tool_result_count}")
    
    conn.close()
    print(f"\n🎉 导入完成! 数据库文件: {args.db}")

if __name__ == '__main__':
    main()