# 🏗️ 完整系统架构和部署指南

> 你现在拥有一个完整的看板系统！前端 + 后端都有了。

---

## 📊 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                    用户浏览器                               │
│  http://localhost:3000                                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ React 应用 (前端)                                    │  │
│  │ ├─ KanbanBoard (看板页面)                            │  │
│  │ │  ├─ 显示列和卡片                                  │  │
│  │ │  ├─ 支持拖拽排序                                  │  │
│  │ │  └─ 点击卡片导航到详情页                          │  │
│  │ │                                                    │  │
│  │ └─ TaskDetailPage (详情页)                           │  │
│  │    ├─ 显示任务完整信息                              │  │
│  │    ├─ 编辑任务                                      │  │
│  │    └─ 删除任务                                      │  │
│  │                                                      │  │
│  │ apiClient.ts (API 客户端)                            │  │
│  │ ├─ GET /api/tasks/:id    (获取任务详情) ⭐          │  │
│  │ ├─ PUT /api/tasks/:id    (更新任务)                 │  │
│  │ └─ DELETE /api/tasks/:id (删除任务)                 │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────┬──────────────────────┘
                                      │ HTTP/JSON
                                      ↓
┌─────────────────────────────────────────────────────────────┐
│                    API 服务器                              │
│  http://localhost:3003                                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Express.js 应用 (后端)                               │  │
│  │                                                      │  │
│  │ 看板接口:                                            │  │
│  │ ├─ GET /api/kanban              (获取看板)           │  │
│  │ ├─ PUT /api/kanban/columns      (更新列)             │  │
│  │ └─ PUT /api/kanban/tasks        (批量更新任务)       │  │
│  │                                                      │  │
│  │ 任务接口:                                            │  │
│  │ ├─ GET /api/tasks               (获取所有任务)       │  │
│  │ ├─ GET /api/tasks/:id           (获取单个任务) ⭐    │  │
│  │ ├─ POST /api/tasks              (创建任务)           │  │
│  │ ├─ PUT /api/tasks/:id           (更新任务) ⭐        │  │
│  │ └─ DELETE /api/tasks/:id        (删除任务) ⭐        │  │
│  │                                                      │  │
│  │ 数据存储: 内存 (可扩展为数据库)                      │  │
│  │ ├─ columns[]  (看板列)                               │  │
│  │ └─ tasks[]    (任务列表)                              │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 项目结构

```
项目根目录/
│
├── frontend/                          (前端项目)
│   ├── src/
│   │   ├── App.tsx                   ← Router 配置
│   │   ├── main.tsx
│   │   ├── components/
│   │   │   └── KanbanBoard.tsx       ← 看板组件
│   │   ├── pages/
│   │   │   └── TaskDetailPage.tsx    ← 详情页组件
│   │   └── utils/
│   │       └── apiClient.ts          ← API 客户端
│   ├── package.json
│   └── vite.config.ts (或 react-scripts)
│
├── backend/                           (后端项目)
│   ├── server.ts                     ← 完整的 API 实现
│   ├── package.json
│   ├── tsconfig.json
│   └── dist/                         (编译后的 JavaScript)
│
└── README.md                         (项目说明)
```

---

## 🚀 启动步骤

### 步骤 1: 启动后端服务器

```bash
cd backend
npm install
npm run dev
```

应该看到：
```
🚀 Kanban Board API Server
Server running at: http://localhost:3003/api
```

### 步骤 2: 启动前端开发服务器

```bash
cd frontend
npm install
npm run dev
```

应该看到：
```
VITE v4.x.x  ready in 300 ms

➜  Local:   http://localhost:3000/
➜  press h to show help
```

### 步骤 3: 打开浏览器

访问 `http://localhost:3000`，你应该看到看板应用。

---

## ✅ 功能检查清单

### 看板页面 (/tasks)
- [ ] 看到列和卡片
- [ ] 拖拽卡片能排序
- [ ] 右上角有"新建任务"按钮
- [ ] 卡片右侧有编辑按钮
- [ ] 卡片右侧有菜单按钮

### 点击卡片
- [ ] 点击卡片导航到 `/tasks/{taskId}`
- [ ] URL 栏显示正确的 URL
- [ ] 浏览器没有报错

### 详情页 (/tasks/:taskId)
- [ ] 页面加载任务数据
- [ ] 显示任务完整信息
- [ ] 左上角有返回按钮
- [ ] 右上角有编辑按钮
- [ ] 右上角有删除按钮

### 编辑功能
- [ ] 点击编辑弹出编辑弹窗
- [ ] 可以修改任务名称、优先级等
- [ ] 点击保存后更新显示

### 删除功能
- [ ] 点击删除按钮弹出确认
- [ ] 确认后删除任务
- [ ] 返回到看板
- [ ] 任务从列表消失

---

## 🔗 API 请求示例

### 获取看板数据
```bash
curl http://localhost:3003/api/kanban
```

### 获取任务详情 ⭐
```bash
curl http://localhost:3003/api/tasks/task-1
```

### 更新任务
```bash
curl -X PUT http://localhost:3003/api/tasks/task-1 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "新的任务名称",
    "priority": "high",
    "assignee": "新的负责人"
  }'
```

### 删除任务
```bash
curl -X DELETE http://localhost:3003/api/tasks/task-1
```

---

## 🗂️ 文件说明

### 前端文件

| 文件 | 说明 |
|------|------|
| `KanbanBoard.tsx` | 看板主组件，支持拖拽和导航 |
| `TaskDetailPage.tsx` | 任务详情页，显示完整信息 |
| `apiClient.ts` | 统一的 API 调用接口 |
| `App.tsx` | React Router 配置 |

### 后端文件

| 文件 | 说明 |
|------|------|
| `server.ts` | Express 服务器，包含所有 API 端点 |
| `package.json` | 依赖配置 |

---

## 🐛 常见问题

### Q: 前端可以启动，但点击卡片后显示"任务不存在或已删除"
**A:** 后端服务器没启动。检查：
1. 后端是否在运行（http://localhost:3003/api/kanban）
2. 数据库中是否有任务数据
3. 浏览器 F12 → Network，查看 GET /api/tasks/:id 的响应

### Q: 编辑任务后，页面显示老数据
**A:** 可能是缓存问题。检查：
1. PUT /api/tasks/:id 请求是否成功（状态码 200）
2. 响应体是否包含更新后的数据
3. 前端是否正确处理了响应

### Q: 删除任务后，看板仍然显示该任务
**A:** 检查：
1. DELETE /api/tasks/:id 请求是否成功（状态码 200）
2. 前端是否正确处理了删除响应
3. 浏览器是否进行了硬刷新

### Q: 拖拽卡片后，数据没有保存
**A:** 检查：
1. PUT /api/kanban/tasks 请求是否发送
2. 后端是否成功更新了任务的 sortOrder
3. 网络标签中的请求响应是否正确

---

## 📦 部署指南

### 生产环境部署

#### 1. 后端部署（Node.js）

```bash
# 编译 TypeScript
npm run build

# 使用 PM2 或其他进程管理器
npm install -g pm2
pm2 start dist/server.js --name "kanban-api"

# 或使用 Docker
docker build -t kanban-api .
docker run -p 3003:3003 kanban-api
```

#### 2. 前端部署（静态文件）

```bash
# 构建生产版本
npm run build

# 生成的 dist 目录包含所有静态文件
# 上传到 Nginx、GitHub Pages、Vercel 等服务
```

#### 3. 环境变量配置

**后端** (.env):
```
NODE_ENV=production
PORT=3003
DATABASE_URL=your_database_url  # 如果使用数据库
```

**前端** (.env.production):
```
VITE_API_BASE=https://api.yourserver.com/api
```

---

## 🔄 数据持久化

当前实现使用内存存储。要实现持久化，可以：

### 选项 1: 使用 JSON 文件
```typescript
import fs from 'fs'
const tasksFile = 'tasks.json'
// 读写 JSON 文件
```

### 选项 2: 使用 MongoDB
```typescript
import mongoose from 'mongoose'
mongoose.connect('mongodb://localhost:27017/kanban')
// 定义 Schema 和 Model
```

### 选项 3: 使用 PostgreSQL
```typescript
import { Pool } from 'pg'
const pool = new Pool()
// 使用 SQL 查询
```

---

## 📊 监控和日志

添加日志以便调试：

```typescript
// 简单的日志中间件
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`)
  next()
})
```

---

## 🎯 系统完整性检查

使用以下脚本验证系统工作正常：

```bash
#!/bin/bash

# 检查后端
echo "检查后端..."
curl -s http://localhost:3003/api/kanban > /dev/null && echo "✅ 后端正常" || echo "❌ 后端失败"

# 检查前端
echo "检查前端..."
curl -s http://localhost:3000 > /dev/null && echo "✅ 前端正常" || echo "❌ 前端失败"

# 检查任务接口
echo "检查任务接口..."
curl -s http://localhost:3003/api/tasks/task-1 > /dev/null && echo "✅ 任务接口正常" || echo "❌ 任务接口失败"
```

---

## 🚀 总结

现在你有：

✅ **完整的前端应用**
- React + React Router
- 看板和详情页
- API 客户端

✅ **完整的后端 API**
- Express.js 服务器
- 所有必需的端点
- 样本数据

✅ **端到端的数据流**
- 前端请求后端
- 后端返回数据
- 数据在前端显示和编辑

**一切都已准备好！🎉**

---

## 📞 下一步

1. **短期**: 启动前后端，测试所有功能
2. **中期**: 使用数据库持久化数据
3. **长期**: 添加认证、日志、监控等
