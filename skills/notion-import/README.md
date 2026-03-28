# Notion 递归导入 Skill

## 概述

将 Notion 页面递归导入到 Egonetics 系统的指定 Task 下，保持原始格式，转换为 Markdown 存储。

## 功能特性

1. **原始格式保留**: 除表格外，所有内容保持 Notion 原始格式
2. **递归导入**: 自动处理子页面，逐个页面导入
3. **Markdown 转换**: 将 Notion block 转换为 Markdown 格式
4. **表格转义**: 自动转义表格中的特殊字符
5. **任务关联**: 导入的页面关联到指定 Task

## 目录结构

```
skills/notion-import/
├── README.md              # 本文件
├── import-notion.js       # 主导入脚本
├── lib/
│   └── importer.js        # 导入逻辑
└── examples/
    └── example-import.json  # 示例配置
```

## 快速开始

### 1. 创建导入任务

```bash
# 创建新的导入任务
curl -X POST http://localhost:3002/api/notion-md/import \
  -H "Content-Type: application/json" \
  -d '{
    "notionPageUrl": "https://www.notion.so/xxx",
    "targetTaskId": "task-xxx",
    "recursive": true
  }'
```

### 2. 获取 Notion 内容 (使用 MCP)

在 Claude Code 中:
```
使用 MCP 工具 notion-fetch 获取页面内容
```

### 3. 处理导入

```bash
# 将获取的内容发送到 API
curl -X POST http://localhost:3002/api/notion-md/import/{importId}/process \
  -H "Content-Type: application/json" \
  -d '{
    "notionPageData": <从MCP获取的页面数据>
  }'
```

## API 参考

### POST /api/notion-md/import

创建新的导入任务。

**请求体:**
```json
{
  "notionPageUrl": "https://www.notion.so/xxx",
  "targetTaskId": "task-xxx",
  "parentPageId": null,
  "recursive": true
}
```

**响应:**
```json
{
  "importId": "import-xxx",
  "status": "pending",
  "message": "导入任务已创建",
  "notionPageId": "xxx"
}
```

### POST /api/notion-md/import/:id/process

处理单个页面导入。

**请求体:**
```json
{
  "notionPageData": {
    "id": "xxx",
    "title": "页面标题",
    "blocks": [...]
  }
}
```

**响应:**
```json
{
  "success": true,
  "page": {
    "pageId": "page-xxx",
    "title": "页面标题"
  },
  "childPagesPending": [...]
}
```

### GET /api/notion-md/import/:id/status

获取导入任务状态。

**响应:**
```json
{
  "importId": "import-xxx",
  "status": "completed",
  "pagesImported": [...],
  "errors": []
}
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

## 注意事项

1. **MCP 集成**: 实际使用时需要配合 Claude Code 的 MCP 工具获取 Notion 内容
2. **递归深度**: 自动处理子页面递归，但建议控制递归深度避免循环
3. **错误处理**: 每个页面独立导入，失败不影响其他页面
4. **重复导入**: 相同标题的页面在同一父页面下会去重

## 故障排除

### 导入失败

检查后端服务是否运行:
```bash
curl http://localhost:3002/api/health
```

### 页面内容为空

确保 Notion 页面数据包含有效的 blocks 数组。

### 子页面未导入

检查 recursive 参数是否为 true，以及 child_page 类型的 block 是否正确解析。

## 版本历史

### v1.0.0
- 初始版本
- 支持基本 Notion block 到 Markdown 转换
- 支持递归子页面导入
- 支持表格转义

## License

MIT
