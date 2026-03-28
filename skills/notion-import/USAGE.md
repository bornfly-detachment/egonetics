# Notion 导入 Skill - 快速使用指南

## 本次导入完成情况 ✅

**源页面**: https://www.notion.so/316aa55009ee80838b0cf22b6b0b69a8
**目标**: task-1773422058-d77c1f (从头训练 智能分身)
**导入时间**: 2026-03-16
**状态**: ✅ 完成 (5个页面)

### 导入的页面

| 页面 | 状态 |
|------|------|
| 从头训练 智能分身 (主页面) | ✅ |
| 第一性原理 | ✅ |
| 技术方案 | ✅ |
| claude code 切换模型 | ✅ |
| 自我控制论系统 | ✅ |

---

## 如何使用这个 Skill

### 方法 1: 使用 CLI (推荐)

```bash
# 进入 skill 目录
cd skills/notion-import/bin

# 执行导入
./import-notion.sh "https://notion.so/你的页面" task-你的任务ID
```

### 方法 2: 使用 JavaScript

```bash
node skills/notion-import/index.js "https://notion.so/你的页面" task-你的任务ID
```

### 方法 3: 直接调用 API

```bash
# 1. 创建导入任务
curl -X POST http://localhost:3002/api/notion-md/import \
  -H "Content-Type: application/json" \
  -d '{
    "notionPageUrl": "https://notion.so/xxx",
    "targetTaskId": "task-xxx",
    "recursive": true
  }'

# 2. 使用 MCP 获取 Notion 内容后，处理导入
curl -X POST http://localhost:3002/api/notion-md/import/{importId}/process \
  -H "Content-Type: application/json" \
  -d '{
    "notionPageData": { ...从MCP获取的数据... }
  }'
```

---

## 完整导入流程 (详细步骤)

### 步骤 1: 准备

```bash
# 确保后端服务运行
curl http://localhost:3002/api/health
```

### 步骤 2: 创建导入任务

```bash
curl -X POST http://localhost:3002/api/notion-md/import \
  -H "Content-Type: application/json" \
  -d '{
    "notionPageUrl": "https://www.notion.so/316aa55009ee80838b0cf22b6b0b69a8",
    "targetTaskId": "task-1773422058-d77c1f",
    "recursive": true
  }'
```

响应:
```json
{
  "importId": "import-xxx",
  "status": "pending",
  "notionPageId": "316aa55009ee80838b0cf22b6b0b69a8"
}
```

### 步骤 3: 使用 MCP 获取 Notion 内容

在 Claude Code 中:
```
使用 notion-fetch MCP 工具获取页面内容
页面 ID: 316aa55009ee80838b0cf22b6b0b69a8
```

### 步骤 4: 处理导入

```bash
curl -X POST http://localhost:3002/api/notion-md/import/{importId}/process \
  -H "Content-Type: application/json" \
  -d @notion-page-data.json
```

### 步骤 5: 检查状态

```bash
curl http://localhost:3002/api/notion-md/import/{importId}/status
```

---

## API 端点参考

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/notion-md/import` | POST | 创建导入任务 |
| `/api/notion-md/import/:id/process` | POST | 处理页面导入 |
| `/api/notion-md/import/:id/status` | GET | 获取导入状态 |

---

## 数据结构

### Notion Block 到 Markdown 映射

| Notion Block | Markdown 输出 |
|-------------|---------------|
| `heading_1` | `# 标题` |
| `heading_2` | `## 标题` |
| `heading_3` | `### 标题` |
| `paragraph` | 普通文本 |
| `bulleted_list_item` | `- 项目` |
| `numbered_list_item` | `1. 项目` |
| `to_do` | `- [ ] 任务` |
| `code` | ````代码```` |
| `quote` | `> 引用` |
| `divider` | `---` |
| `table` | Markdown 表格 |
| `child_page` | 子页面链接 |

---

## 故障排除

### 问题: 导入失败

**解决方案:**
1. 检查后端服务: `curl http://localhost:3002/api/health`
2. 检查 Notion URL 是否正确
3. 检查目标 Task ID 是否存在

### 问题: 子页面未导入

**解决方案:**
1. 确保 `recursive` 参数为 `true`
2. 检查 Notion 页面是否包含 `child_page` block
3. 检查子页面是否有权限访问

### 问题: Markdown 格式不对

**解决方案:**
1. 检查 Notion block 类型是否被支持
2. 查看转换日志
3. 手动编辑生成的 Markdown

---

## 示例代码

### 批量导入多个页面

```javascript
const pages = [
  { url: 'https://notion.so/page1', taskId: 'task-1' },
  { url: 'https://notion.so/page2', taskId: 'task-2' },
];

for (const page of pages) {
  const result = await fetch('http://localhost:3002/api/notion-md/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      notionPageUrl: page.url,
      targetTaskId: page.taskId,
      recursive: true,
    }),
  });

  const data = await result.json();
  console.log(`Created import task: ${data.importId}`);
}
```

---

## 更新日志

### v1.0.0 (2026-03-16)

- 初始版本发布
- 支持 Notion block 到 Markdown 转换
- 支持递归子页面导入
- 支持表格自动转义
- 提供 CLI 工具和 API 接口

---

## 许可证

MIT License
