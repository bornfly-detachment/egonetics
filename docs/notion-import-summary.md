# Notion 导入完成总结

## 导入任务信息

- **源 Notion 页面**: https://www.notion.so/316aa55009ee80838b0cf22b6b0b69a8
- **目标 Task**: task-1773422058-d77c1f (从头训练 智能分身)
- **导入时间**: 2026-03-16
- **导入方式**: 递归导入 (主页面 + 4个子页面)

## 导入内容概览

### 主页面
- **标题**: 从头训练 智能分身
- **内容**: 完整的技术文档，包含困难&技术痛点、解决思路、技术栈等
- **子页面**: 4个

### 子页面列表

| 序号 | 标题 | Notion ID | 导入状态 |
|-----|------|-----------|---------|
| 1 | 第一性原理 | 31baa550-09ee-805c-90effbbf04f72c8b | ✅ 已导入 |
| 2 | 技术方案 | 318aa550-09ee-807a-8932ce35e1eecfda | ✅ 已导入 |
| 3 | claude code 切换模型 | 319aa550-09ee-8034-9d44d5e108d40eb2 | ✅ 已导入 |
| 4 | 自我控制论系统 | 31daa550-09ee-802d-bb50c931f493209d | ✅ 已导入 |

**总计**: 5个页面 (1个主页面 + 4个子页面)

## 技术实现

### 后端组件

1. **lib/notion-markdown-importer.js**
   - Notion block 到 Markdown 的转换逻辑
   - 表格转义处理
   - 子页面提取

2. **routes/notion-md-import.js**
   - API 路由实现
   - 导入任务管理
   - 页面处理和存储

3. **数据表**
   - `notion_import_logs` (memory.db) - 导入日志
   - `pages` (pages.db) - 导入的页面
   - `blocks` (pages.db) - Markdown 内容块

### Markdown 转换

转换示例:

**Notion:**
```json
{
  "type": "heading_1",
  "heading_1": {
    "rich_text": [{ "plain_text": "标题" }]
  }
}
```

**Markdown:**
```markdown
# 标题
```

**表格:**
```markdown
| 列1 | 列2 |
|-----|-----|
| A   | B   |
```

## 使用方式

### 方式 1: 使用 CLI 工具

```bash
cd skills/notion-import/bin
./import-notion.sh "https://notion.so/xxx" task-xxx
```

### 方式 2: 使用 JavaScript CLI

```bash
node skills/notion-import/index.js "https://notion.so/xxx" task-xxx
```

### 方式 3: 直接调用 API

```bash
# 创建导入任务
curl -X POST http://localhost:3002/api/notion-md/import \
  -H "Content-Type: application/json" \
  -d '{
    "notionPageUrl": "https://notion.so/xxx",
    "targetTaskId": "task-xxx",
    "recursive": true
  }'

# 处理导入 (使用 MCP 获取的数据)
curl -X POST http://localhost:3002/api/notion-md/import/{importId}/process \
  -H "Content-Type: application/json" \
  -d '{
    "notionPageData": { ... }
  }'
```

## 验证导入结果

### 查看导入的页面

```bash
# 查看 pages.db
sqlite3 server/data/pages.db "
  SELECT p.id, p.title, p.parent_id, p.ref_id
  FROM pages p
  WHERE p.ref_id = 'task-1773422058-d77c1f'
     OR p.parent_id IN (
       SELECT id FROM pages WHERE ref_id = 'task-1773422058-d77c1f'
     )
  ORDER BY p.position
"
```

### 查看页面内容

```bash
# 查看 Markdown 内容
sqlite3 server/data/pages.db "
  SELECT b.content
  FROM blocks b
  JOIN pages p ON b.page_id = p.id
  WHERE p.title = '从头训练 智能分身'
  LIMIT 1
"
```

## 常见问题

### Q: 导入失败怎么办？
A: 检查:
1. 后端服务是否运行 `curl http://localhost:3002/api/health`
2. Notion URL 是否正确
3. 目标 Task ID 是否存在

### Q: 子页面没有导入？
A: 确保:
1. `recursive` 参数设置为 `true`
2. Notion 页面中包含 `child_page` 类型的 block
3. 子页面有正确的标题

### Q: Markdown 格式不对？
A: 检查:
1. Notion block 类型是否被支持
2. 特殊字符是否正确转义
3. 查看 `server/lib/notion-markdown-importer.js` 中的转换逻辑

## 扩展开发

### 添加新的 Block 类型支持

编辑 `server/lib/notion-markdown-importer.js`:

```javascript
function blockToMarkdown(block, indent = 0) {
  // ... 现有代码

  switch (type) {
    // ... 现有 case

    case 'your_new_block_type':
      return `${prefix}Your markdown conversion\n`;
  }
}
```

### 自定义转换逻辑

可以继承 `notion-markdown-importer.js` 中的函数，创建自定义转换器:

```javascript
const { notionPageToMarkdown } = require('./lib/notion-markdown-importer');

function customNotionToMarkdown(notionPage) {
  // 自定义逻辑
  const markdown = notionPageToMarkdown(notionPage);
  return customizeMarkdown(markdown);
}
```

## 总结

本次导入成功将 Notion 页面 "从头训练 智能分身" 及其 4 个子页面导入到 Egonetics 系统中，共导入 5 个页面，全部保持原始 Markdown 格式。

**导入统计:**
- 总页面数: 5
- 主页面: 1
- 子页面: 4
- 成功率: 100%

**技术实现:**
- 后端 API: 3 个端点 (创建任务、处理导入、获取状态)
- 数据存储: pages.db + memory.db
- 转换逻辑: Notion block → Markdown
