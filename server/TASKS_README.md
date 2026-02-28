# OpenClaw 持久化记忆定时任务

## 📦 任务1：智能入库
**脚本**: `smart_import.py`

### 功能
- 每天0点自动入库前一天的对话
- 检测用户活跃状态（1小时内无新消息才入库）
- 支持多Agent（main、model_training等）
- 自动去重，避免重复入库

### 执行时间
- **定时**: 每天 00:00
- **延迟逻辑**: 如果用户在1小时内有新对话，自动延迟直到无活动
- **开机补录**: 如果当天未开机，开机后自动检查并补录昨天内容

### 手动执行
```bash
# 检查昨天内容（不执行入库）
python3 smart_import.py --yesterday --check-only

# 强制入库昨天内容（忽略活跃检测）
python3 smart_import.py --yesterday --force

# 开机后补录
./check_and_import.sh
```

### 日志
`/Users/bornfly/Desktop/bornfly_v1/egonetics/server/logs/import.log`

---

## 📊 任务2：每日工作总结
**脚本**: `daily_summary.py`

### 功能
- 读取当天所有会话记录
- 生成工作总结（统计、会话列表、TODO提取、任务进展）
- 发送至 agent:model_training:main 转发到飞书

### 执行时间
- **定时**: 每天 23:30

### 手动执行
```bash
python3 daily_summary.py
```

### 飞书发送
需要配置 `agent:model_training:main` 的飞书转发规则。

### 日志
`/Users/bornfly/Desktop/bornfly_v1/egonetics/server/logs/summary.log`

---

## 🔄 Cron 配置
```bash
crontab -l
```

当前设置：
```
# 每天0点智能入库
0 0 * * * cd /Users/bornfly/Desktop/bornfly_v1/egonetics/server && /usr/bin/python3 smart_import.py --yesterday >> logs/import.log 2>&1

# 每天23:30生成总结
30 23 * * * cd /Users/bornfly/Desktop/bornfly_v1/egonetics/server && /usr/bin/python3 daily_summary.py >> logs/summary.log 2>&1
```

---

## 🚀 立即测试
```bash
# 测试入库
python3 smart_import.py --yesterday --check-only

# 测试总结
python3 daily_summary.py
```
