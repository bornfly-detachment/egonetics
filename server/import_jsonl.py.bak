#!/usr/bin/env python3
"""
OpenClaw JSONL 会话文件导入脚本

功能：
1. 解析OpenClaw会话JSONL文件
2. 过滤掉工具调用和工具结果（toolCall, toolResult）
3. 提取思考过程和最终回答（thinking, message）
4. 导入到SQLite数据库，支持三级分类系统

使用：
python3 import_jsonl.py <jsonl_file> [--db <database_path>]
"""

import json
import sqlite3
import argparse
import sys
import os
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple

def parse_args():
    parser = argparse.ArgumentParser(description='导入OpenClaw JSONL会话文件到数据库')
    parser.add_argument('jsonl_file', help='JSONL文件路径')
    parser.add_argument('--db', default='memory.db', help='SQLite数据库路径（默认: memory.db）')
    parser.add_argument('--session-title', help='自定义会话标题')
    parser.add_argument('--session-summary', help='自定义会话摘要')
    return parser.parse_args()

def init_database(db_path: str):
    """初始化数据库，创建表结构"""
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
        print(f"⚠️  警告: schema.sql不存在于 {schema_path}")
        # 创建基本表（简化版）
        cursor.executescript("""
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                created_at TIMESTAMP NOT NULL,
                updated_at TIMESTAMP NOT NULL,
                title TEXT,
                summary TEXT,
                source_file TEXT
            );
            
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                message_type TEXT NOT NULL,
                content TEXT NOT NULL,
                timestamp TIMESTAMP NOT NULL,
                quality_score INTEGER DEFAULT 0,
                parent_id TEXT,
                role TEXT,
                FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
            );
        """)
    
    conn.commit()
    return conn

def extract_text_from_content(content: List[Dict]) -> Tuple[str, List[Dict]]:
    """
    从content数组中提取文本内容，过滤掉toolCall和toolResult
    
    返回: (提取的文本内容, 过滤后的content项列表)
    """
    extracted_text = []
    filtered_items = []
    
    for item in content:
        item_type = item.get('type')
        
        if item_type == 'text':
            # 文本内容
            text = item.get('text', '')
            if text:
                extracted_text.append(text)
            filtered_items.append(item)
        
        elif item_type == 'thinking':
            # 思考内容
            thinking = item.get('thinking', '')
            if thinking:
                extracted_text.append(f"[思考] {thinking}")
            filtered_items.append(item)
        
        elif item_type in ['toolCall', 'toolResult']:
            # 跳过工具调用和结果
            continue
        
        else:
            # 其他类型保留但不提取文本
            filtered_items.append(item)
    
    return '\n'.join(extracted_text), filtered_items

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
        'thinking_count': 0
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
            # 检查消息内容中是否包含thinking
            message_data = record.get('message', {})
            content = message_data.get('content', [])
            for item in content:
                if item.get('type') == 'thinking':
                    session_info['thinking_count'] += 1
    
    return session_info

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
        session_summary = f"包含 {session_info['message_count']} 条消息，{session_info['thinking_count']} 条思考"
    
    # 插入或更新会话
    cursor.execute('''
        INSERT OR REPLACE INTO sessions (id, created_at, updated_at, title, summary, source_file)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (session_id, created_at, updated_at, session_title, session_summary, source_file))
    
    print(f"📝 会话已创建: {session_title}")
    
    # 处理每条记录
    imported_count = 0
    skipped_count = 0
    
    for record in records:
        record_type = record.get('type')
        record_id = record.get('id')
        timestamp = record.get('timestamp')
        parent_id = record.get('parentId')
        
        # 只处理message类型的记录
        if record_type != 'message':
            continue
        
        message_data = record.get('message', {})
        role = message_data.get('role', 'unknown')
        content = message_data.get('content', [])
        
        # 跳过工具调用和工具结果消息
        if role in ['toolResult', 'toolCall']:
            skipped_count += 1
            continue
        
        # 提取文本内容并过滤toolCall/toolResult
        extracted_text, filtered_content = extract_text_from_content(content)
        
        # 如果没有提取到文本内容，跳过
        if not extracted_text.strip():
            skipped_count += 1
            continue
        
        # 确定消息类型：根据内容判断是thinking还是普通消息
        message_type = 'message'
        if '[思考]' in extracted_text:
            message_type = 'thinking'
        
        # 插入消息
        try:
            cursor.execute('''
                INSERT OR REPLACE INTO messages 
                (id, session_id, message_type, content, timestamp, parent_id, role)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (record_id, session_id, message_type, extracted_text, timestamp, parent_id, role))
            
            imported_count += 1
        except sqlite3.Error as e:
            print(f"❌ 插入消息 {record_id} 失败: {e}")
            skipped_count += 1
    
    conn.commit()
    
    print(f"✅ 导入完成: {imported_count} 条消息已导入, {skipped_count} 条被跳过")
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
    
    print("\n📊 数据库统计:")
    print(f"   会话数: {session_count}")
    print(f"   消息总数: {message_count}")
    print(f"   思考记录: {thinking_count}")
    print(f"   普通消息: {message_count - thinking_count}")
    
    conn.close()
    print(f"\n🎉 导入完成! 数据库文件: {args.db}")

if __name__ == '__main__':
    main()