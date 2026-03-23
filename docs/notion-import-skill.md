# Notion 递归导入 Skill

## 功能概述

将 Notion 页面递归导入到 Egonetics 系统的指定 Task 下，保持原始格式，转换为 Markdown 存储。

## 核心特性

1. **原始格式保留**: 除表格外，所有内容保持 Notion 原始格式
2. **递归导入**: 自动处理子页面，逐个导入
3. **Markdown 转换**: 将 Notion block 转换为 Markdown 格式
4. **表格转义**: 自动转义表格中的特殊字符
5. **任务关联**: 导入的页面关联到指定 Task

## API 端点

### 1. 创建导入任务

```http
POST /api/notion-md/import
Content-Type: application/json

{
  "notionPageUrl": "https://www.notion.so/xxx",
  "targetTaskId": "task-xxx",
  "parentPageId": null,
  "recursive": true
}
```

响应:
```json
{
  "importId": "import-xxx",
  "status": "pending",
  "message": "导入任务已创建",
  "notionPageId": "xxx",
  "nextSteps": [...]
}
```

### 2. 处理页面导入

```http
POST /api/notion-md/import/:importId/process
Content-Type: application/json

{
  "notionPageData": {
    "id": "xxx",
    "title": "页面标题",
    "icon": "📄",
    "blocks": [...]
  }
}
```

### 3. 获取导入状态

```http
GET /api/notion-md/import/:importId/status
```

## 数据格式

### Notion Block 到 Markdown 映射

| Notion Block | Markdown |
|-------------|----------|
| heading_1 | `# ` |
| heading_2 | `## ` |
| heading_3 | `### ` |
| paragraph | 普通文本 |
| bulleted_list_item | `- ` |
| numbered_list_item | `1. ` |
| to_do | `- [ ] ` / `- [x] ` |
| code | ` ``` ` |
| quote | `> ` |
| divider | `---` |
| table | Markdown 表格 |

### 表格转义

表格单元格中的特殊字符会被转义:
- `|` → `\|`
- `\` → `\\`
- `\n` → `<br>`

## 使用流程

### 完整导入示例

```bash
# 1. 创建导入任务
curl -X POST http://localhost:3002/api/notion-md/import \
  -H "Content-Type: application/json" \
  -d '{
    "notionPageUrl": "https://www.notion.so/xxx",
    "targetTaskId": "task-xxx",
    "recursive": true
  }'

# 2. 使用 MCP 获取 Notion 页面内容
# 在 Claude Code 中执行:
# mcp__notion__notion-fetch {"id": "xxx"}

# 3. 处理导入
curl -X POST http://localhost:3002/api/notion-md/import/{importId}/process \
  -H "Content-Type: application/json" \
  -d '{
    "notionPageData": <MCP返回的数据>
  }'

# 4. 检查状态
curl http://localhost:3002/api/notion-md/import/{importId}/status
```

## 文件结构

```
server/
├── lib/
│   └── notion-markdown-importer.js  # 核心导入逻辑
├── routes/
│   └── notion-md-import.js          # API 路由
└── scripts/
    └── run-notion-import-recursive.js  # CLI 工具
```

## 注意事项

1. **MCP 集成**: 实际使用时需要配合 Claude Code 的 MCP 工具获取 Notion 内容
2. **递归深度**: 自动处理子页面递归，但建议控制递归深度避免循环
3. **错误处理**: 每个页面独立导入，失败不影响其他页面
4. **重复导入**: 相同标题的页面在同一父页面下会去重

## 测试

创建测试任务验证导入:

```bash
# 创建测试 task
curl -X POST http://localhost:3002/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Notion导入测试",
    "column_id": "in-progress"
  }'
```
