#!/usr/bin/env python3
"""
OpenClaw JSONL 会话文件导入脚本 v3
正确解析Agent思考链结构

JSONL结构：
- assistant消息: content包含thinking + toolCall
- toolResult消息: 工具返回结果
- usage: 仅assistant消息有Token消耗
"""

import json
import sqlite3
import argparse
import sys
import os
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple

def parse_args():
    parser = argparse.ArgumentParser(description='导入OpenClaw JSONL会话文件')
    parser.add_argument('jsonl_file', help='JSONL文件路径')
    parser.add_argument('--db', default='memory.db', help='SQLite数据库路径')
    return parser.parse_args()

def init_database(db_path: str):
    """初始化数据库"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 读取schema.sql
    schema_path = os.path.join(os.path.dirname(__file__), 'schema.sql')
    if os.path.exists(schema_path):
        with open(schema_path, 'r', encoding='utf-8') as f:
            cursor.executescript(f.read())
        print(f"✅ 数据库已初始化")
    else:
        print(f"❌ schema.sql不存在")
        sys.exit(1)
    
    conn.commit()
    return conn

def parse_jsonl_file(file_path: str) -> List[Dict]:
    """解析JSONL文件"""
    records = []
    with open(file_path, 'r', encoding='utf-8') as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                record = json.loads(line)
                records.append(record)
            except json.JSONDecodeError as e:
                print(f"⚠️ 第{line_num}行解析错误: {e}")
    print(f"📊 已解析 {len(records)} 条记录")
    return records

def extract_thinking_chain(records: List[Dict]) -> List[Dict]:
    """
    提取思考链结构
    
    返回结构:
    [
      {
        "type": "user",
        "id": "...",
        "content": "用户消息"
      },
      {
        "type": "thinking_step",
        "id": "...",
        "step_number": 1,
        "thinking": "思考内容",
        "tool_call": {...},  # 如果有
        "tool_result": {...}, # 如果有
        "usage": {"input": 12915, "output": 234},
        "provider": "deepseek",
        "model": "deepseek-reasoner",
        "timestamp": "..."
      },
      ...
    ]
    """
    chains = []
    tool_calls_map = {}  # toolCallId -> tool_call info
    
    for record in records:
        if record.get('type') != 'message':
            continue
        
        msg_data = record.get('message', {})
        role = msg_data.get('role')
        
        # 用户消息
        if role == 'user':
            content_parts = msg_data.get('content', [])
            text_content = ''
            for part in content_parts:
                if part.get('type') == 'text':
                    text_content = part.get('text', '')
            
            chains.append({
                'type': 'user',
                'id': record.get('id'),
                'content': text_content,
                'timestamp': record.get('timestamp')
            })
        
        # Agent消息 (assistant)
        elif role == 'assistant':
            content_parts = msg_data.get('content', [])
            thinking_text = ''
            tool_call = None
            
            for part in content_parts:
                if part.get('type') == 'thinking':
                    thinking_text = part.get('thinking', '')
                elif part.get('type') == 'toolCall':
                    tool_call = {
                        'id': part.get('id'),
                        'name': part.get('name'),
                        'arguments': part.get('arguments', {})
                    }
                    tool_calls_map[part.get('id')] = tool_call
            
            usage = msg_data.get('usage', {})
            
            chains.append({
                'type': 'thinking_step',
                'id': record.get('id'),
                'step_number': len([c for c in chains if c.get('type') == 'thinking_step']) + 1,
                'thinking': thinking_text,
                'tool_call': tool_call,
                'tool_result': None,  # 稍后填充
                'usage': {
                    'input': usage.get('input') or usage.get('prompt_tokens'),
                    'output': usage.get('output') or usage.get('completion_tokens'),
                    'total': usage.get('totalTokens')
                },
                'provider': msg_data.get('provider'),
                'model': msg_data.get('model'),
                'stopReason': msg_data.get('stopReason'),
                'timestamp': record.get('timestamp')
            })
        
        # 工具返回结果
        elif role == 'toolResult':
            tool_call_id = msg_data.get('toolCallId')
            content_parts = msg_data.get('content', [])
            result_text = ''
            for part in content_parts:
                if part.get('type') == 'text':
                    result_text = part.get('text', '')
            
            # 找到对应的thinking_step并填充tool_result
            for chain in reversed(chains):
                if chain.get('type') == 'thinking_step':
                    if chain.get('tool_call') and chain['tool_call'].get('id') == tool_call_id:
                        chain['tool_result'] = {
                            'id': record.get('id'),
                            'toolCallId': tool_call_id,
                            'toolName': msg_data.get('toolName'),
                            'content': result_text,
                            'isError': msg_data.get('isError', False)
                        }
                        break
    
    return chains

def import_to_database(conn, chains: List[Dict], session_id: str, source_file: str):
    """导入到数据库"""
    cursor = conn.cursor()
    
    # 创建会话
    first_ts = chains[0].get('timestamp') if chains else datetime.now().isoformat()
    last_ts = chains[-1].get('timestamp') if chains else datetime.now().isoformat()
    
    cursor.execute('''
        INSERT OR REPLACE INTO sessions (id, created_at, updated_at, title, summary, source_file)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (session_id, first_ts, last_ts, f'会话 {session_id[:8]}', 
          f'{len(chains)} 个交互步骤', source_file))
    
    # 导入消息
    for chain in chains:
        if chain['type'] == 'user':
            # 用户消息
            cursor.execute('''
                INSERT OR REPLACE INTO messages 
                (id, session_id, message_type, content, timestamp, role, raw_content)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (chain['id'], session_id, 'message', chain['content'], 
                  chain['timestamp'], 'user', json.dumps(chain, ensure_ascii=False)))
        
        elif chain['type'] == 'thinking_step':
            # 思考步骤 - 主消息
            thinking_content = f"[思考{chain['step_number']}] {chain['thinking']}"
            if chain.get('tool_call'):
                thinking_content += f"\n[工具调用] {chain['tool_call']['name']}"
            
            raw_data = {
                'thinking': chain['thinking'],
                'tool_call': chain.get('tool_call'),
                'usage': chain.get('usage'),
                'provider': chain.get('provider'),
                'model': chain.get('model')
            }
            
            cursor.execute('''
                INSERT OR REPLACE INTO messages 
                (id, session_id, message_type, content, timestamp, role, 
                 is_collapsible, raw_content)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (chain['id'], session_id, 'thinking', thinking_content,
                  chain['timestamp'], 'assistant', 
                  1 if chain.get('tool_call') else 0,
                  json.dumps(raw_data, ensure_ascii=False)))
            
            # 如果有工具返回，创建单独的tool_result消息
            if chain.get('tool_result'):
                tr = chain['tool_result']
                cursor.execute('''
                    INSERT OR REPLACE INTO messages 
                    (id, session_id, message_type, content, timestamp, role, 
                     is_collapsible, raw_content)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (tr['id'], session_id, 'tool_result', 
                      f"[工具结果] {tr['toolName']}\n{tr['content'][:500]}",
                      chain['timestamp'], 'tool', 1, 
                      json.dumps(tr, ensure_ascii=False)))
    
    conn.commit()
    print(f"✅ 已导入 {len(chains)} 个步骤")

def main():
    args = parse_args()
    
    print(f"🔧 初始化数据库: {args.db}")
    conn = init_database(args.db)
    
    print(f"📂 解析文件: {args.jsonl_file}")
    records = parse_jsonl_file(args.jsonl_file)
    
    if not records:
        print("❌ 没有可导入的记录")
        conn.close()
        return
    
    # 提取会话ID
    session_id = None
    for r in records:
        if r.get('type') == 'session':
            session_id = r.get('id')
            break
    if not session_id:
        session_id = os.path.basename(args.jsonl_file).replace('.jsonl', '')
    
    # 提取思考链
    print("🔗 提取思考链...")
    chains = extract_thinking_chain(records)
    
    # 统计
    user_count = len([c for c in chains if c['type'] == 'user'])
    thinking_count = len([c for c in chains if c['type'] == 'thinking_step'])
    tool_count = len([c for c in chains if c.get('tool_call')])
    
    print(f"📊 分析结果:")
    print(f"   用户消息: {user_count}")
    print(f"   思考步骤: {thinking_count}")
    print(f"   工具调用: {tool_count}")
    
    # 导入数据库
    import_to_database(conn, chains, session_id, args.jsonl_file)
    
    conn.close()
    print(f"\n🎉 导入完成!")

if __name__ == '__main__':
    main()
