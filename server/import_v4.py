#!/usr/bin/env python3
"""
OpenClaw JSONL 导入脚本 v4
按用户消息切分轮次，保持原始行结构
"""

import json
import sqlite3
import argparse
import os
from datetime import datetime
from typing import Dict, List, Any

def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('jsonl_file')
    parser.add_argument('--db', default='memory.db')
    return parser.parse_args()

def init_db(db_path: str):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 清理旧表
    cursor.executescript("""
        DROP TABLE IF EXISTS messages;
        DROP TABLE IF EXISTS sessions;
        DROP TABLE IF EXISTS categories;
        DROP TABLE IF EXISTS message_categories;
        DROP TABLE IF EXISTS thinking_annotations;
        DROP TABLE IF EXISTS output_feedback;
        
        CREATE TABLE sessions (
            id TEXT PRIMARY KEY,
            created_at TIMESTAMP,
            updated_at TIMESTAMP,
            title TEXT,
            summary TEXT,
            source_file TEXT
        );
        
        CREATE TABLE rounds (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT,
            round_number INTEGER,
            user_message_id TEXT,
            user_content TEXT,
            user_timestamp TIMESTAMP,
            agent_messages TEXT,  -- JSON数组，包含完整的assistant消息
            FOREIGN KEY (session_id) REFERENCES sessions(id)
        );
        
        CREATE TABLE thinking_annotations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            round_id INTEGER,
            thought_index INTEGER,
            suggested_revision TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE round_categories (
            round_id INTEGER,
            category_id INTEGER,
            PRIMARY KEY (round_id, category_id)
        );
    """)
    
    conn.commit()
    return conn

def parse_jsonl(file_path: str) -> List[Dict]:
    records = []
    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    records.append(json.loads(line))
                except:
                    pass
    return records

def extract_rounds(records: List[Dict]) -> List[Dict]:
    """
    按 user 消息切分轮次
    每轮包含：user消息 + 后续的assistant/tool消息，直到下一个user
    """
    rounds = []
    current_round = None
    round_num = 0
    
    for record in records:
        if record.get('type') != 'message':
            continue
        
        msg = record.get('message', {})
        role = msg.get('role')
        
        # 新轮次开始（用户消息）
        if role == 'user':
            # 保存上一轮
            if current_round:
                rounds.append(current_round)
            
            round_num += 1
            content_parts = msg.get('content', [])
            text = ''
            for part in content_parts:
                if part.get('type') == 'text':
                    text = part.get('text', '')
            
            current_round = {
                'round_number': round_num,
                'user_message_id': record.get('id'),
                'user_content': text,
                'user_timestamp': record.get('timestamp'),
                'agent_messages': []  # 收集后续的assistant/tool消息
            }
        
        # assistant 或 toolResult 消息，加入当前轮次
        elif role in ('assistant', 'toolResult') and current_round:
            current_round['agent_messages'].append({
                'id': record.get('id'),
                'parentId': record.get('parentId'),
                'timestamp': record.get('timestamp'),
                'role': role,
                'message': msg
            })
    
    # 最后一轮
    if current_round:
        rounds.append(current_round)
    
    return rounds

def import_to_db(conn, rounds: List[Dict], session_id: str, source_file: str):
    cursor = conn.cursor()
    
    # 插入会话
    cursor.execute('''
        INSERT INTO sessions (id, created_at, updated_at, title, summary, source_file)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (session_id, datetime.now().isoformat(), datetime.now().isoformat(),
          f'会话 {session_id[:8]}', f'{len(rounds)} 轮对话', source_file))
    
    # 插入轮次
    for round_data in rounds:
        cursor.execute('''
            INSERT INTO rounds (session_id, round_number, user_message_id, user_content, user_timestamp, agent_messages)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (session_id, round_data['round_number'], round_data['user_message_id'],
              round_data['user_content'], round_data['user_timestamp'],
              json.dumps(round_data['agent_messages'], ensure_ascii=False)))
    
    conn.commit()
    print(f"✅ 已导入 {len(rounds)} 轮对话")

def main():
    args = parse_args()
    
    print(f"🔧 初始化数据库...")
    conn = init_db(args.db)
    
    print(f"📂 解析 {args.jsonl_file}...")
    records = parse_jsonl(args.jsonl_file)
    
    # 获取会话ID
    session_id = None
    for r in records:
        if r.get('type') == 'session':
            session_id = r.get('id')
            break
    if not session_id:
        session_id = os.path.basename(args.jsonl_file).replace('.jsonl', '')
    
    print(f"🔗 提取对话轮次...")
    rounds = extract_rounds(records)
    
    # 统计
    total_thoughts = 0
    total_tools = 0
    for r in rounds:
        for msg in r['agent_messages']:
            content = msg.get('message', {}).get('content', [])
            for part in content:
                if part.get('type') == 'thinking':
                    total_thoughts += 1
                elif part.get('type') == 'toolCall':
                    total_tools += 1
    
    print(f"📊 分析结果:")
    print(f"   对话轮次: {len(rounds)}")
    print(f"   思考次数: {total_thoughts}")
    print(f"   工具调用: {total_tools}")
    
    import_to_db(conn, rounds, session_id, args.jsonl_file)
    conn.close()
    print(f"\n🎉 导入完成!")

if __name__ == '__main__':
    main()
