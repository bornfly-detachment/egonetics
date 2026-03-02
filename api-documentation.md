# Egonetics 项目接口文档

## 项目概述

Egonetics 是一个个人智能助手系统，包含多个主要功能页面和接口。

### 主要页面：
- **Memory（记忆）** - 会话历史查看和管理
- **Tasks（任务）** - 任务管理和版本控制
- **Notion** - 笔记和文档管理

---

## 1. Memory（记忆）页面

### 1.1 后端接口

#### 1.1.1 获取会话列表
- **方法**：GET
- **URL**：`/api/sessions`
- **描述**：获取所有会话的基本信息列表
- **返回格式**：JSON
- **响应示例**：
  ```json
  {
    "sessions": [
      {
        "id": "b105a0c0-7c49-470e-aceb-1c6d0026e216",
        "created_at": "2026-02-27T14:09:35.944Z",
        "updated_at": "2026-03-01 05:20:01",
        "title": "测试会话标题",
        "summary": "57 条消息",
        "source_file": "/path/to/session.jsonl",
        "agent": "model_training"
      },
      // 其他会话...
    ]
  }
  ```

#### 1.1.2 获取会话详细信息
- **方法**：GET
- **URL**：`/api/sessions/:id`
- **描述**：获取单个会话的详细信息（包含消息和轮次）
- **参数**：
  - `id` - 会话ID（路径参数）
- **返回格式**：JSON
- **响应示例**：
  ```json
  {
    "id": "b105a0c0-7c49-470e-aceb-1c6d0026e216",
    "created_at": "2026-02-27T14:09:35.944Z",
    "updated_at": "2026-03-01 05:20:01",
    "title": "测试会话标题",
    "summary": "57 条消息",
    "source_file": "/path/to/session.jsonl",
    "agent": "model_training",
    "rounds": [
      {
        "id": "round-1",
        "round_number": 1,
        "user_message": {...},
        "agent_messages": [...]
      },
      // 其他轮次...
    ],
    "messages": [...]
  }
  ```

#### 1.1.3 更新会话标题
- **方法**：PUT
- **URL**：`/api/sessions/:id/title`
- **描述**：更新会话的标题
- **参数**：
  - `id` - 会话ID（路径参数）
  - `title` - 新标题（请求体）
- **返回格式**：JSON
- **请求体示例**：
  ```json
  {
    "title": "新会话标题"
  }
  ```
- **响应示例**：
  ```json
  {
    "success": true,
    "id": "b105a0c0-7c49-470e-aceb-1c6d0026e216",
    "title": "新会话标题"
  }
  ```

#### 1.1.4 保存标注
- **方法**：POST
- **URL**：`/api/messages/:id/annotation`
- **描述**：保存消息的标注信息
- **参数**：
  - `id` - 消息ID（路径参数）
  - `suggested_revision` - 标注内容（请求体）
- **返回格式**：JSON
- **请求体示例**：
  ```json
  {
    "suggested_revision": "这是一条标注"
  }
  ```
- **响应示例**：
  ```json
  {
    "success": true,
    "id": "annotation-1"
  }
  ```

#### 1.1.5 获取消息标注
- **方法**：GET
- **URL**：`/api/messages/:id/annotation`
- **描述**：获取消息的标注信息
- **参数**：
  - `id` - 消息ID（路径参数）
- **返回格式**：JSON
- **响应示例**：
  ```json
  {
    "annotation": {
      "id": "annotation-1",
      "message_id": "message-1",
      "suggested_revision": "这是一条标注",
      "created_at": "2026-03-01T05:20:01Z"
    }
  }
  ```

#### 1.1.6 创建标签
- **方法**：POST
- **URL**：`/api/tags`
- **描述**：创建新标签
- **参数**：
  - `name` - 标签名称（请求体）
- **返回格式**：JSON
- **请求体示例**：
  ```json
  {
    "name": "重要"
  }
  ```
- **响应示例**：
  ```json
  {
    "success": true,
    "name": "重要"
  }
  ```

#### 1.1.7 获取所有标签
- **方法**：GET
- **URL**：`/api/tags`
- **描述**：获取所有标签列表
- **返回格式**：JSON
- **响应示例**：
  ```json
  {
    "tags": [
      {
        "id": "tag-1",
        "name": "重要"
      },
      {
        "id": "tag-2",
        "name": "待办"
      }
    ]
  }
  ```

#### 1.1.8 为消息添加标签
- **方法**：POST
- **URL**：`/api/messages/:id/tags`
- **描述**：为消息添加标签
- **参数**：
  - `id` - 消息ID（路径参数）
  - `tag_names` - 标签名称数组（请求体）
- **返回格式**：JSON
- **请求体示例**：
  ```json
  {
    "tag_names": ["重要", "待办"]
  }
  ```
- **响应示例**：
  ```json
  {
    "success": true
  }
  ```

---

## 2. Tasks（任务）页面

### 2.1 后端接口

#### 2.1.1 获取所有任务
- **方法**：GET
- **URL**：`/api/tasks`
- **描述**：获取所有任务列表
- **返回格式**：JSON
- **响应示例**：
  ```json
  {
    "tasks": [
      {
        "id": "task-1",
        "name": "测试任务",
        "icon": "📝",
        "content": "<p>这是一个测试任务</p>",
        "content_plain": "这是一个测试任务",
        "created_at": "2026-03-01T05:20:01Z",
        "updated_at": "2026-03-01T05:20:01Z",
        "property_count": 2,
        "version_count": 3
      },
      // 其他任务...
    ]
  }
  ```

#### 2.1.2 获取单个任务
- **方法**：GET
- **URL**：`/api/tasks/:id`
- **描述**：获取单个任务的详细信息
- **参数**：
  - `id` - 任务ID（路径参数）
- **返回格式**：JSON
- **响应示例**：
  ```json
  {
    "id": "task-1",
    "name": "测试任务",
    "icon": "📝",
    "content": "<p>这是一个测试任务</p>",
    "content_plain": "这是一个测试任务",
    "created_at": "2026-03-01T05:20:01Z",
    "updated_at": "2026-03-01T05:20:01Z",
    "propertyDefs": [...],
    "properties": {...}
  }
  ```

#### 2.1.3 创建任务
- **方法**：POST
- **URL**：`/api/tasks`
- **描述**：创建新任务
- **参数**：
  - `name` - 任务名称（请求体）
  - `icon` - 任务图标（可选）
  - `content` - 任务内容（可选）
- **返回格式**：JSON
- **请求体示例**：
  ```json
  {
    "name": "新任务",
    "icon": "📚",
    "content": "<p>这是一个新任务</p>"
  }
  ```
- **响应示例**：
  ```json
  {
    "success": true,
    "id": "task-2",
    "task": {...}
  }
  ```

#### 2.1.4 更新任务
- **方法**：PUT
- **URL**：`/api/tasks/:id`
- **描述**：更新任务信息
- **参数**：
  - `id` - 任务ID（路径参数）
  - `name` - 任务名称（可选）
  - `icon` - 任务图标（可选）
  - `content` - 任务内容（可选）
- **返回格式**：JSON
- **请求体示例**：
  ```json
  {
    "name": "更新后的任务"
  }
  ```
- **响应示例**：
  ```json
  {
    "success": true,
    "updated_at": "2026-03-01T05:20:01Z"
  }
  ```

#### 2.1.5 删除任务
- **方法**：DELETE
- **URL**：`/api/tasks/:id`
- **描述**：删除任务
- **参数**：
  - `id` - 任务ID（路径参数）
- **返回格式**：JSON
- **响应示例**：
  ```json
  {
    "success": true
  }
  ```

#### 2.1.6 添加属性定义
- **方法**：POST
- **URL**：`/api/tasks/:id/properties/definitions`
- **描述**：为任务添加属性定义
- **参数**：
  - `id` - 任务ID（路径参数）
  - `name` - 属性名称
  - `type` - 属性类型
  - `options` - 属性选项（可选）
- **返回格式**：JSON
- **请求体示例**：
  ```json
  {
    "name": "状态",
    "type": "select",
    "options": ["待办", "进行中", "已完成"]
  }
  ```
- **响应示例**：
  ```json
  {
    "success": true,
    "id": "prop-1"
  }
  ```

#### 2.1.7 更新属性值
- **方法**：PUT
- **URL**：`/api/tasks/:id/properties/:propertyName`
- **描述**：更新任务属性值
- **参数**：
  - `id` - 任务ID（路径参数）
  - `propertyName` - 属性名称（路径参数）
  - `value` - 属性值（请求体）
- **返回格式**：JSON
- **请求体示例**：
  ```json
  {
    "value": "进行中"
  }
  ```
- **响应示例**：
  ```json
  {
    "success": true
  }
  ```

#### 2.1.8 保存任务版本
- **方法**：POST
- **URL**：`/api/tasks/:id/versions`
- **描述**：保存任务版本
- **参数**：
  - `id` - 任务ID（路径参数）
  - `content` - 任务内容
  - `previousHash` - 前一版本哈希（可选）
- **返回格式**：JSON
- **请求体示例**：
  ```json
  {
    "content": "<p>更新后的任务内容</p>",
    "previousHash": "abc123"
  }
  ```
- **响应示例**：
  ```json
  {
    "success": true,
    "hash": "def456",
    "id": "version-1"
  }
  ```

#### 2.1.9 获取任务版本历史
- **方法**：GET
- **URL**：`/api/tasks/:id/versions`
- **描述**：获取任务的版本历史
- **参数**：
  - `id` - 任务ID（路径参数）
- **返回格式**：JSON
- **响应示例**：
  ```json
  {
    "versions": [
      {
        "id": "version-1",
        "task_id": "task-1",
        "content_hash": "def456",
        "content": "<p>更新后的任务内容</p>",
        "previous_version_hash": "abc123",
        "created_at": "2026-03-01T05:20:01Z"
      },
      // 其他版本...
    ]
  }
  ```

---

## 3. Notion（笔记）页面

### 3.1 后端接口

#### 3.1.1 获取所有页面
- **方法**：GET
- **URL**：`/api/notion/pages`
- **描述**：获取所有Notion页面列表
- **返回格式**：JSON

#### 3.1.2 获取单个页面
- **方法**：GET
- **URL**：`/api/notion/pages/:id`
- **描述**：获取单个Notion页面的详细信息
- **参数**：
  - `id` - 页面ID（路径参数）
- **返回格式**：JSON

#### 3.1.3 创建页面
- **方法**：POST
- **URL**：`/api/notion/pages`
- **描述**：创建新Notion页面
- **参数**：
  - `name` - 页面名称
  - `content` - 页面内容
- **返回格式**：JSON

#### 3.1.4 更新页面
- **方法**：PUT
- **URL**：`/api/notion/pages/:id`
- **描述**：更新Notion页面信息
- **参数**：
  - `id` - 页面ID（路径参数）
  - `name` - 页面名称（可选）
  - `content` - 页面内容（可选）
- **返回格式**：JSON

#### 3.1.5 删除页面
- **方法**：DELETE
- **URL**：`/api/notion/pages/:id`
- **描述**：删除Notion页面
- **参数**：
  - `id` - 页面ID（路径参数）
- **返回格式**：JSON

---

## 4. 通用接口

### 4.1 健康检查
- **方法**：GET
- **URL**：`/api/health`
- **描述**：检查服务器和数据库连接状态
- **返回格式**：JSON
- **响应示例**：
  ```json
  {
    "status": "ok",
    "timestamp": "2026-03-01T05:20:01Z",
    "databases": {
      "memory": "connected",
      "tasks": "connected"
    }
  }
  ```

---

## 5. 数据库架构

### 5.1 记忆数据库 (memory.db)

#### 5.1.1 会话表 (sessions)
```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  title TEXT,
  summary TEXT,
  source_file TEXT,
  agent TEXT
);
```

#### 5.1.2 消息表 (messages)
```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  parent_id TEXT,
  timestamp TIMESTAMP,
  role TEXT,
  message_type TEXT,
  content TEXT,
  tool_name TEXT,
  token_input INTEGER,
  token_output INTEGER,
  token_total INTEGER,
  duration_ms INTEGER,
  provider TEXT,
  model TEXT,
  raw_content TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);
```

#### 5.1.3 标注表 (annotations)
```sql
CREATE TABLE annotations (
  id TEXT PRIMARY KEY,
  message_id TEXT,
  suggested_revision TEXT,
  created_at TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES messages(id)
);
```

#### 5.1.4 标签表 (categories)
```sql
CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE
);
```

#### 5.1.5 消息标签关联表 (message_categories)
```sql
CREATE TABLE message_categories (
  message_id TEXT,
  category_id TEXT,
  PRIMARY KEY (message_id, category_id),
  FOREIGN KEY (message_id) REFERENCES messages(id),
  FOREIGN KEY (category_id) REFERENCES categories(id)
);
```

### 5.2 任务数据库 (tasks.db)

#### 5.2.1 任务表 (tasks)
```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  name TEXT,
  icon TEXT,
  content TEXT,
  content_plain TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

#### 5.2.2 任务属性定义表 (task_property_defs)
```sql
CREATE TABLE task_property_defs (
  id TEXT PRIMARY KEY,
  task_id TEXT,
  name TEXT,
  type TEXT,
  options TEXT,
  display_order INTEGER,
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);
```

#### 5.2.3 任务属性值表 (task_properties)
```sql
CREATE TABLE task_properties (
  id TEXT PRIMARY KEY,
  task_id TEXT,
  property_def_id TEXT,
  value_text TEXT,
  value_number REAL,
  value_date TEXT,
  value_boolean INTEGER,
  value_json TEXT,
  FOREIGN KEY (task_id) REFERENCES tasks(id),
  FOREIGN KEY (property_def_id) REFERENCES task_property_defs(id)
);
```

#### 5.2.4 任务版本表 (task_versions)
```sql
CREATE TABLE task_versions (
  id TEXT PRIMARY KEY,
  task_id TEXT,
  content_hash TEXT,
  content TEXT,
  previous_version_hash TEXT,
  created_at TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);
```

---

## 6. 前端组件架构

### 6.1 主组件

#### 6.1.1 MemoryView.tsx
- **功能**：记忆页面主组件
- **接口**：
  - 获取会话列表
  - 获取会话详细信息
  - 更新会话标题
  - 保存标注
  - 获取标注
  - 创建标签
  - 获取标签
  - 为消息添加标签

#### 6.1.2 TasksView.tsx
- **功能**：任务页面主组件
- **接口**：
  - 获取任务列表
  - 获取任务详细信息
  - 创建任务
  - 更新任务
  - 删除任务
  - 添加属性定义
  - 更新属性值
  - 保存任务版本
  - 获取版本历史

#### 6.1.3 NotionPageView.tsx
- **功能**：Notion页面主组件
- **接口**：
  - 获取页面列表
  - 获取页面详细信息
  - 创建页面
  - 更新页面
  - 删除页面

---

## 7. 技术架构

### 7.1 前端技术栈
- **React** - UI框架
- **TypeScript** - 类型检查
- **Vite** - 构建工具
- **Tailwind CSS** - 样式框架
- **Lucide React** - 图标库
- **SQLite3** - 数据库（前端存储）

### 7.2 后端技术栈
- **Express** - 服务器框架
- **SQLite3** - 数据库
- **CORS** - 跨域支持
- **Body Parser** - 请求体解析

---

## 8. 部署和运行

### 8.1 前端运行
```bash
cd /Users/bornfly/Desktop/bornfly_v1/egonetics
npm run dev
```
访问地址：http://localhost:3001

### 8.2 后端运行
```bash
cd /Users/bornfly/Desktop/bornfly_v1/egonetics
node server/index.js
```
访问地址：http://localhost:3002

### 8.3 数据库位置
- **记忆数据库**：`/Users/bornfly/Desktop/bornfly_v1/egonetics/server/memory.db`
- **任务数据库**：`/Users/bornfly/Desktop/bornfly_v1/egonetics/server/tasks.db`