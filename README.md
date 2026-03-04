<div align="center">

# Egonetics

**Bornfly's Personal Agent System & Life Core Interface**

[![Language](https://img.shields.io/badge/lang-English-blue)](#english) [![语言](https://img.shields.io/badge/语言-中文-red)](#chinese)

</div>

---

<a id="english"></a>

## English

**[切换中文 →](#chinese)**

### What is Egonetics?

Egonetics (Ego + Cybernetics) is a personal agent system with a tamper-evident chronicle for self-evolution. It provides a cryptographically hash-linked record of decisions, memories, and growth — ensuring continuity and alignment with user intent over time.

### Core Concepts

| Concept | Description |
|---|---|
| **Bornfly Chronicle** | Append-only, SHA-256 hash-linked record of decisions, memories, and evolution |
| **Bornfly Theory** | Core value judgment and philosophy framework |
| **Life Core** | Central orchestrator agent (in development) |
| **Egonetics** | Principles ensuring the system stays aligned with user intent |

### Features

**Implemented**
- Hash chain chronicle with tamper detection and chain integrity verification
- Task & project management (Kanban board, priority levels, status tracking)
- Rich text page editor (Tiptap + BlockNote)
- Drag-and-drop task board with `@dnd-kit`
- Multi-language UI (zh/en toggle)
- Memory/session storage via SQLite backend
- Dark theme with glassmorphism design

**In Progress**
- Agent spawning and coordination
- Bornfly Theory editor
- Blog / knowledge publishing

**Planned**
- External anchoring (Bitcoin / Ethereum timestamps)
- End-to-end encryption
- Multi-device sync
- Mobile apps (Tauri / Capacitor)

### Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Routing | React Router DOM v7 |
| State | Zustand (3 stores, localStorage persistence) |
| Styling | Tailwind CSS + Glassmorphism |
| Rich Text | Tiptap v3 + BlockNote |
| Drag & Drop | @dnd-kit |
| Cryptography | Web Crypto API (SHA-256) |
| Backend | Express.js + SQLite3 |
| Icons | Lucide React |

### Getting Started

**Prerequisites:** Node.js ≥ 18

```bash
# Clone the repository
git clone https://github.com/bornfly-detachment/egonetics.git
cd egonetics

# Install frontend dependencies
npm install

# Install backend dependencies
cd server && npm install && cd ..
```

**Development** (both servers must run concurrently)

```bash
# Terminal 1 — Frontend (http://localhost:3000)
npm run dev

# Terminal 2 — Backend (http://localhost:3002)
cd server
npm run init-db   # First time only: initialize SQLite databases
npm run dev
```

**Other commands**

```bash
# Frontend
npm run build     # Type-check + bundle → dist/
npm run lint      # ESLint (zero-warnings)
npm run format    # Prettier format src/**
npm run preview   # Preview production build

# Backend
npm start         # Start without hot reload
```

### Project Structure

```
egonetics/
├── src/
│   ├── components/             # React UI components
│   │   ├── Sidebar.tsx         # Navigation + language toggle
│   │   ├── ChroniclePageView.tsx
│   │   ├── MemoryView.tsx
│   │   ├── TaskPageView.tsx
│   │   ├── KanbanBoard.tsx
│   │   ├── BlogPage.tsx
│   │   ├── EgoneticsView.tsx
│   │   ├── TheoryPageView.tsx
│   │   ├── NotionPageView.tsx
│   │   ├── BlockEditor.tsx     # Tiptap rich text editor
│   │   └── ...
│   ├── lib/
│   │   ├── chronicle.ts        # BornflyChronicle class (hash chain)
│   │   ├── api.ts              # Memory/sessions API client
│   │   ├── tasks-api.ts        # Tasks/projects REST API client
│   │   └── translations.ts     # i18n (zh/en)
│   ├── stores/
│   │   ├── useChronicleStore.ts  # Primary store (UI state, entries, agents)
│   │   ├── useTasksStore.ts      # Server-synced tasks
│   │   └── useProjectsStore.ts   # Local-only projects
│   ├── types/                  # TypeScript type definitions
│   ├── App.tsx                 # Router + RouteSync
│   └── main.tsx
├── server/
│   ├── index.js                # Express API server (port 3002)
│   ├── init-db.js              # Initialize memory.db
│   ├── init-tasks-db.js        # Initialize tasks.db
│   ├── init-pages-db.js        # Initialize pages.db
│   └── package.json
├── public/
├── vite.config.ts              # Port 3000, /api proxy → 3002
├── tailwind.config.js
└── package.json
```

### Routes

| Path | View |
|---|---|
| `/memory` | Chat memory sessions |
| `/chronicle` | Hash chain chronicle |
| `/theory` | Bornfly Theory |
| `/egonetics` | Egonetics principles |
| `/tasks` | Task list |
| `/tasks/:taskId` | Task detail |
| `/blog` | Blog / knowledge base |
| `/agents` | Agent coordination |
| `/settings` | Settings |

### Hash Chain

Each chronicle entry is cryptographically linked to the previous one:

```typescript
{
  id: string,
  timestamp: string,
  content: string,
  type: 'memory' | 'decision' | 'evolution' | 'principle' | 'task',
  prev_hash: string,   // hash of the previous entry
  hash: string         // SHA256(timestamp + content + prev_hash)
}
```

Any modification to a past entry breaks all subsequent hashes, making tampering immediately detectable.

### Databases

Three separate SQLite databases under `server/`:

| File | Purpose |
|---|---|
| `memory.db` | Chat sessions and memory entries |
| `tasks.db` | Projects and tasks |
| `pages.db` | Rich text page content |

---

<a id="chinese"></a>

## 中文

**[Switch to English →](#english)**

### 什么是 Egonetics？

Egonetics（Ego + Cybernetics，自我 + 控制论）是一个个人智能体系统，通过防篡改的编年史记录自我进化过程。它使用密码学哈希链保存决策、记忆与成长轨迹，确保系统随时间推移保持与用户意图的一致性。

### 核心概念

| 概念 | 说明 |
|---|---|
| **Bornfly Chronicle** | 仅可追加的、SHA-256 哈希链接的决策、记忆和进化记录 |
| **Bornfly Theory** | 核心价值判断与哲学框架 |
| **Life Core** | 中央协调智能体（开发中） |
| **Egonetics** | 确保系统始终与用户意图对齐的原则体系 |

### 功能特性

**已实现**
- 哈希链编年史，支持防篡改检测和链完整性验证
- 任务与项目管理（看板、优先级、状态跟踪）
- 富文本页面编辑器（Tiptap + BlockNote）
- 基于 `@dnd-kit` 的拖拽任务看板
- 多语言 UI（中/英切换）
- 通过 SQLite 后端持久化记忆/会话
- 深色主题 + 毛玻璃（glassmorphism）设计

**开发中**
- 智能体生成与协调
- Bornfly Theory 编辑器
- 博客 / 知识发布

**计划中**
- 外部锚定（Bitcoin / Ethereum 时间戳）
- 端到端加密
- 多设备同步
- 移动端应用（Tauri / Capacitor）

### 技术栈

| 层级 | 技术 |
|---|---|
| 前端 | React 18 + TypeScript + Vite |
| 路由 | React Router DOM v7 |
| 状态管理 | Zustand（3 个 store，localStorage 持久化） |
| 样式 | Tailwind CSS + Glassmorphism |
| 富文本 | Tiptap v3 + BlockNote |
| 拖拽 | @dnd-kit |
| 密码学 | Web Crypto API（SHA-256） |
| 后端 | Express.js + SQLite3 |
| 图标 | Lucide React |

### 快速开始

**环境要求：** Node.js ≥ 18

```bash
# 克隆仓库
git clone https://github.com/bornfly-detachment/egonetics.git
cd egonetics

# 安装前端依赖
npm install

# 安装后端依赖
cd server && npm install && cd ..
```

**开发模式**（前后端需同时运行）

```bash
# 终端 1 — 前端（http://localhost:3000）
npm run dev

# 终端 2 — 后端（http://localhost:3002）
cd server
npm run init-db   # 首次运行：初始化 SQLite 数据库
npm run dev
```

**其他命令**

```bash
# 前端
npm run build     # 类型检查 + 打包 → dist/
npm run lint      # ESLint（零警告）
npm run format    # Prettier 格式化 src/**
npm run preview   # 预览生产构建

# 后端
npm start         # 不含热重载的启动
```

### 项目结构

```
egonetics/
├── src/
│   ├── components/             # React UI 组件
│   │   ├── Sidebar.tsx         # 导航 + 语言切换
│   │   ├── ChroniclePageView.tsx
│   │   ├── MemoryView.tsx
│   │   ├── TaskPageView.tsx
│   │   ├── KanbanBoard.tsx
│   │   ├── BlogPage.tsx
│   │   ├── EgoneticsView.tsx
│   │   ├── TheoryPageView.tsx
│   │   ├── NotionPageView.tsx
│   │   ├── BlockEditor.tsx     # Tiptap 富文本编辑器
│   │   └── ...
│   ├── lib/
│   │   ├── chronicle.ts        # BornflyChronicle 类（哈希链）
│   │   ├── api.ts              # 记忆/会话 API 客户端
│   │   ├── tasks-api.ts        # 任务/项目 REST API 客户端
│   │   └── translations.ts     # 国际化（中/英）
│   ├── stores/
│   │   ├── useChronicleStore.ts  # 主 store（UI 状态、条目、智能体）
│   │   ├── useTasksStore.ts      # 服务端同步任务
│   │   └── useProjectsStore.ts   # 纯本地项目管理
│   ├── types/                  # TypeScript 类型定义
│   ├── App.tsx                 # 路由 + RouteSync
│   └── main.tsx
├── server/
│   ├── index.js                # Express API 服务（端口 3002）
│   ├── init-db.js              # 初始化 memory.db
│   ├── init-tasks-db.js        # 初始化 tasks.db
│   ├── init-pages-db.js        # 初始化 pages.db
│   └── package.json
├── public/
├── vite.config.ts              # 端口 3000，/api 代理 → 3002
├── tailwind.config.js
└── package.json
```

### 路由列表

| 路径 | 视图 |
|---|---|
| `/memory` | 聊天记忆会话 |
| `/chronicle` | 哈希链编年史 |
| `/theory` | Bornfly 理论 |
| `/egonetics` | Egonetics 原则 |
| `/tasks` | 任务列表 |
| `/tasks/:taskId` | 任务详情 |
| `/blog` | 博客 / 知识库 |
| `/agents` | 智能体协调 |
| `/settings` | 设置 |

### 哈希链实现

每条编年史条目都与前一条密码学链接：

```typescript
{
  id: string,
  timestamp: string,
  content: string,
  type: 'memory' | 'decision' | 'evolution' | 'principle' | 'task',
  prev_hash: string,   // 前一条目的哈希值
  hash: string         // SHA256(timestamp + content + prev_hash)
}
```

对任意历史条目的修改都会破坏后续所有条目的哈希值，使篡改行为立即可被检测。

### 数据库

`server/` 目录下三个独立的 SQLite 数据库：

| 文件 | 用途 |
|---|---|
| `memory.db` | 聊天会话与记忆条目 |
| `tasks.db` | 项目与任务 |
| `pages.db` | 富文本页面内容 |

---

<div align="center">

**Egonetics** — Your digital self, anchored in time.

*MIT License · by [Bornfly](https://github.com/bornfly-detachment)*

</div>
