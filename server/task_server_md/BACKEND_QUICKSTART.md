# 🚀 后端 API 服务器 - 快速启动指南

> 你现在有完整的后端实现！

---

## 📦 文件清单

```
backend/
├── server.ts          ← 完整的 API 实现（含所有接口）
├── package.json       ← 依赖配置
└── tsconfig.json      ← TypeScript 配置（可选）
```

---

## ⚡ 快速启动（3 步）

### 步骤 1: 创建后端目录和文件

```bash
# 创建后端目录
mkdir backend
cd backend

# 复制文件
cp server.ts ./
cp package.json ./
```

### 步骤 2: 安装依赖

```bash
npm install
```

输出应该像这样：
```
added 65 packages, and audited 66 packages in 2s
```

### 步骤 3: 启动服务器

```bash
# 使用 ts-node 直接运行 TypeScript
npm run dev

# 或者先编译再运行
npm run build
npm start
```

你应该看到：
```
╔══════════════════════════════════════════════╗
║  🚀 Kanban Board API Server                 ║
║  Server running at: http://localhost:3003/api ║
║  Environment: development                  ║
╚══════════════════════════════════════════════╝

📋 Available Endpoints:
  
  看板接口:
  ✅ GET    /api/kanban                - 获取看板数据
  ✅ PUT    /api/kanban/columns        - 更新列
  ✅ PUT    /api/kanban/tasks          - 批量更新任务

  任务接口:
  ✅ GET    /api/tasks                 - 获取所有任务
  ✅ GET    /api/tasks/:id             - 获取单个任务（详情页）⭐
  ✅ POST   /api/tasks                 - 创建新任务
  ✅ PUT    /api/tasks/:id             - 更新任务（编辑）⭐
  ✅ DELETE /api/tasks/:id             - 删除任务⭐
```

---

## ✅ 验证服务器正常工作

### 方式 1: 浏览器测试

在浏览器地址栏输入：
```
http://localhost:3003/api/kanban
```

应该看到 JSON 响应，包含列和任务数据。

### 方式 2: 使用 curl

```bash
# 获取看板数据
curl http://localhost:3003/api/kanban

# 获取单个任务（这是你缺少的关键接口！）
curl http://localhost:3003/api/tasks/task-1

# 获取所有任务
curl http://localhost:3003/api/tasks
```

### 方式 3: 使用 Postman

1. 打开 Postman
2. 新建请求：`GET http://localhost:3003/api/kanban`
3. 点击 Send
4. 查看 JSON 响应

---

## 🔗 前端和后端连接

确保前端的 `apiClient.ts` 中的 API_BASE 正确：

```typescript
const API_BASE = 'http://localhost:3003/api'  // ✅ 确保这个地址正确
```

---

## 📋 API 接口详细说明

### 1. 获取看板数据
```
GET /api/kanban
```
**返回**: 
```json
{
  "columns": [...],
  "tasks": [...]
}
```

### 2. 获取单个任务详情 ⭐ (详情页需要)
```
GET /api/tasks/:id

例: GET /api/tasks/task-1
```
**返回**:
```json
{
  "id": "task-1",
  "name": "完成项目文档",
  "icon": "📝",
  "assignee": "Alice",
  "startDate": "2026-03-01",
  "dueDate": "2026-03-10",
  "priority": "high",
  "status": "col-doing",
  "description": "任务描述...",
  "tags": ["标签1", "标签2"],
  "created_at": "2026-02-28T10:00:00Z",
  "updated_at": "2026-03-02T00:00:00Z"
}
```

### 3. 更新任务 ⭐ (编辑功能需要)
```
PUT /api/tasks/:id

请求体:
{
  "name": "新的任务名称",
  "priority": "high",
  "assignee": "Bob",
  ...
}
```

### 4. 删除任务
```
DELETE /api/tasks/:id

例: DELETE /api/tasks/task-1
```

---

## 🐛 常见问题

### Q: 启动时报错 "command not found: ts-node"
A: 运行 `npm install`

### Q: 端口 3003 已被占用
A: 使用其他端口：
```bash
PORT=3004 npm run dev
```

### Q: 服务器启动后数据丢失
A: 这是正常的，这是内存存储。使用数据库可以持久化。

### Q: 如何持久化数据？
A: 目前使用内存存储。要持久化，可以：
- 使用 MongoDB
- 使用 PostgreSQL
- 使用文件（JSON）存储

---

## 📚 TypeScript 配置

如果需要，创建 `tsconfig.json`：

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["*.ts"],
  "exclude": ["node_modules"]
}
```

---

## 🎯 现在，你的完整系统应该是这样的

```
前端 (localhost:3000)
    ↓ API 调用
后端 (localhost:3003)
    ↓ 返回 JSON
前端显示数据
```

### 数据流

1. **看板加载**
   ```
   前端: GET /api/kanban
   后端: 返回所有列和任务
   ```

2. **点击卡片查看详情**
   ```
   前端: GET /api/tasks/{taskId}  ← ⭐ 这是你之前缺少的
   后端: 返回单个任务详情
   前端: 显示详情页
   ```

3. **编辑任务**
   ```
   前端: PUT /api/tasks/{taskId}
   后端: 更新任务
   前端: 刷新显示
   ```

4. **删除任务**
   ```
   前端: DELETE /api/tasks/{taskId}
   后端: 删除任务
   前端: 返回看板
   ```

---

## 🚀 下一步建议

### 短期
1. ✅ 启动后端服务器
2. ✅ 验证所有接口工作正常
3. ✅ 前端调用后端 API

### 中期
1. 使用数据库（MongoDB/PostgreSQL）
2. 添加认证（JWT）
3. 添加日志系统

### 长期
1. Docker 容器化
2. CI/CD 流程
3. 性能优化和监控

---

## ✨ 总结

现在你有：
- ✅ 完整的前端（KanbanBoard + TaskDetailPage）
- ✅ 完整的后端（server.ts + 所有接口）
- ✅ 样本数据（4 个任务 + 3 个列）

**一切都已准备好！启动服务器，你的看板应该能完全工作！** 🎉

---

**遇到问题？查看常见问题部分或告诉我！** 🆘
