#!/usr/bin/env python3
"""
发送消息到飞书
通过 agent:model_training:main 转发
"""

import sys
import subprocess
from datetime import datetime

def send_summary(text):
    """发送总结到 model_training:main agent，由其转发到飞书"""
    
    # 包装消息，标记为需要转发到飞书
    message = f"""📢 每日工作总结（需转发到飞书）

{text}

---
发送时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
"""
    
    try:
        # 使用 sessions_send 发送到 model_training:main
        result = subprocess.run(
            ["openclaw", "sessions", "send", 
             "--session", "agent:model_training:main",
             "--message", message],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            print("✅ 已发送至 agent:model_training:main")
            print("   请确保该 agent 配置了飞书转发规则")
            return True
        else:
            print(f"⚠️ 发送失败: {result.stderr}")
            return False
            
    except Exception as e:
        print(f"❌ 发送异常: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) > 1:
        with open(sys.argv[1], 'r', encoding='utf-8') as f:
            text = f.read()
        send_summary(text)
    else:
        print("Usage: send_to_feishu.py <summary_file>")
