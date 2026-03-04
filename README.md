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
| **Bornfly Chronicle** | Append-only, curated record of memory, tasks, and theory with SHA-256 hash links |
| **Bornfly Theory** | Core value judgment and philosophy framework (versioned, lockable) |
| **Life Core** | Central orchestrator agent (in development) |
| **Egonetics** | Principles ensuring the system stays aligned with user intent |

### Features

**Implemented & Refactored (2025)**
- **Memory Module** — Dual-pane: Annotation Boards + Session Library
  - JSONL import (OpenClaw & Claude Code formats)
  - Drag-drop sessions into annotation boards
  - Session/step annotations
  - Publish to Chronicle
- **Task System** — Unified tasks.db for both /api/tasks and /api/kanban
  - Kanban board with drag-drop
  - Custom properties, version history
  - Task outcome/summary fields for Chronicle
  - Rich text block editor (Notion-style)
- **Theory/Pages** — Full-featured page manager
  - Hierarchical pages, tree structure
  - Block-based editing (text, headings, media, etc.)
  - Type-specific pages: theory/task/page
  - Versioning & locking (via Chronicle)
- **Chronicle** (reopened for development)
  - 3 entry types: memory | task | theory
  - Milestones (groups entries, lockable)
  - Collections (thematic bundles, draggable)
  - Post-lock annotations (V1 original, V2/V3+ amendments)
- **Agents** — SVG node graph visualization
- **4 SQLite databases** — Clean separation by data type

**In Progress**
- Chronicle hash chain integrity verification
- Theory page locking & versioning
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
| Backend | Express.js + SQLite3 (4 databases) |
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
npm run init-memory  # First time: init memory.db
npm run init-tasks   # First time: init tasks.db
npm run init-pages   # First time: init pages.db
npm run init-agents  # First time: init agents.db
npm run dev
```

**Other commands**

```bash
# Frontend
npm run build     # Type-check + bundle → dist/
npm run lint      # ESLint (zero-warnings)
npm run format    # Prettier format src/**
npm run preview   # Preview production build

# Backend (cd server/)
npm start         # Start without hot reload
npm run import    # Import JSONL sessions
npm run migrate   # Chronicle migration script
npm run backup    # Backup Claude Code projects (~/.claude/projects/) to memory.db
npm run backup:daemon  # Run backup every hour (daemon mode)
npm run backup:dry     # Preview backup without importing
```

### Project Structure

```
egonetics/
├── src/
│   ├── components/             # React UI components
│   │   ├── Sidebar.tsx         # Navigation + language toggle
│   │   ├── MemoryView.tsx      # Dual-pane: annotation boards + session library
│   │   ├── ChronicleView.tsx   # Timeline, milestones, collections
│   │   ├── TaskPageView.tsx    # Task detail (DO NOT MODIFY)
│   │   ├── KanbanBoard.tsx     # Kanban board (DO NOT MODIFY)
│   │   ├── TheoryPageView.tsx  # Theory pages
│   │   ├── NotionPageView.tsx  # Notion-style page wrapper
│   │   ├── PageManager.tsx     # Full page/block editor (DO NOT MODIFY)
│   │   ├── BlockEditor.tsx     # Rich text block editor
│   │   ├── AgentsView.tsx      # SVG node graph
│   │   ├── taskBoard/          # Kanban board components
│   │   └── apiClient.ts        # Theory/Pages API client
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
│   ├── index.js                # Slim Express server (port 3002)
│   ├── db.js                   # Unified 4-DB connection manager
│   ├── routes/                 # Modular route handlers
│   │   ├── memory.js           # /api/memory/* (sessions, annotations, boards)
│   │   ├── tasks.js            # /api/tasks/* + /api/kanban/*
│   │   ├── pages.js            # /api/pages/* + /api/notion/*
│   │   ├── chronicle.js        # /api/chronicle/*
│   │   ├── agents.js           # /api/agents/*
│   │   └── media.js            # /api/media/*
│   ├── scripts/                # DB initialization & migration
│   │   ├── init-memory-db.js
│   │   ├── init-tasks-db.js
│   │   ├── init-pages-db.js
│   │   ├── init-agents-db.js
│   │   ├── import-jsonl.js
│   │   ├── migrate-chronicle.js
│   │   └── tasks_schema.sql
│   ├── data/                   # SQLite databases (gitignored)
│   │   ├── memory.db
│   │   ├── tasks.db
│   │   ├── pages.db
│   │   └── agents.db
│   └── package.json
├── public/
├── vite.config.ts              # Port 3000, /api proxy → 3002
├── tailwind.config.js
├── CLAUDE.md                   # Claude Code instructions
└── package.json
```

### Routes

| Path | View |
|---|---|
| `/memory` | Memory: Annotation Boards + Session Library |
| `/chronicle` | Chronicle Timeline (reopened for dev) |
| `/theory` | Bornfly Theory (PageManager) |
| `/egonetics` | Egonetics principles |
| `/tasks` | Task Kanban Board |
| `/tasks/:taskId` | Task Detail Page |
| `/blog` | Blog / knowledge base |
| `/agents` | Agent SVG Node Graph |
| `/settings` | Settings |

### Databases

Four separate SQLite databases under `server/data/`:

| File | Purpose |
|---|---|
| `memory.db` | Chat sessions (sessions/rounds/steps), annotations, chronicle tables |
| `tasks.db` | Projects, tasks, kanban columns, blocks, properties, versions |
| `pages.db` | Page hierarchy, metadata (Theory/Task/Page pages) |
| `agents.db` | Agents and relations |

### Chronicle Design

**Curated Only**: Entries are user-approved before entering the chronicle.

**Entry Types**: `memory` | `task` | `theory`

**Core Structure**:
- **Milestones**: Group entries, publish = lock all entries + collections
- **Collections**: User-named thematic bundles (e.g. "熬出低谷"), draggable positioning
- **Annotations**: Post-lock amendments (V1=original, V2/V3+ in chronicle_annotations)

**Hash Chain**: (planned for Phase 2) — each entry cryptographically linked to previous

### API Endpoints

**Memory** (`/api/memory/*`)
- `GET /memory/sessions` — List sessions (pagination)
- `GET /memory/sessions/:id` — Get session detail
- `DELETE /memory/sessions/:id` — Delete session
- `GET /memory/sessions/:id/rounds` — Get rounds
- `GET /memory/rounds/:id/steps` — Get steps
- `PATCH /memory/sessions/:id/annotate` — Annotate session
- `POST /memory/sessions/:id/send-to-chronicle` — Publish to Chronicle
- `POST /memory/import` — Import JSONL
- `GET/POST /memory/boards` — Annotation boards
- `PATCH/DELETE /memory/boards/:id` — Update/delete board
- `POST /memory/boards/:id/send-to-chronicle` — Publish board

**Tasks** (`/api/tasks/*`, `/api/kanban/*`)
- `GET/POST /tasks` — List/create tasks
- `GET/PUT/DELETE /tasks/:id` — Task CRUD
- `POST /tasks/:id/send-to-chronicle` — Task to Chronicle
- `GET/PUT /tasks/:id/blocks` — Task body blocks
- `GET/POST /tasks/:id/properties` — Custom properties
- `GET/POST /tasks/:id/versions` — Version history
- `GET/PUT /kanban` — Kanban columns
- `GET/POST/PUT/PATCH/DELETE /kanban/tasks` — Kanban tasks

**Pages** (`/api/pages/*`, `/api/notion/*`)
- `GET/POST /pages` — List/create pages
- `PATCH/DELETE /pages/:id` — Update/delete page
- `GET/PUT /pages/:id/blocks` — Page blocks
- `GET/PUT /notion/blocks` — Notion-compatible API

**Chronicle** (`/api/chronicle/*`)
- `GET /chronicle` — Full timeline (entries, milestones, collections)
- `GET/POST /chronicle/entries` — Chronicle entries
- `PATCH /chronicle/entries/:id` — Update entry
- `GET/POST /chronicle/milestones` — Milestones
- `GET/POST /chronicle/collections` — Collections

**Agents** (`/api/agents/*`)
- `GET/POST /agents` — List/create agents
- `GET/PUT/DELETE /agents/:id` — Agent CRUD
- `GET/POST /agents/relations` — Agent relations

---

<a id="chinese"></a>

## 中文

**[Switch to English →](#english)**

### 什么是 Egonetics？

Egonetics（Ego + Cybernetics，自我 + 控制论）是一个个人智能体系统，通过防篡改的编年史记录自我进化过程。它使用密码学哈希链保存决策、记忆与成长轨迹，确保系统随时间推移保持与用户意图的一致性。

### 核心概念

| 概念 | 说明 |
|---|---|
| **Bornfly Chronicle** | 仅可追加的精选记录（记忆/任务/理论），SHA-256 哈希链接 |
| **Bornfly Theory** | 核心价值判断与哲学框架（版本化、可锁定） |
| **Life Core** | 中央协调智能体（开发中） |
| **Egonetics** | 确保系统始终与用户意图对齐的原则体系 |

### 功能特性

**已实现与重构 (2025)**
- **记忆模块** — 双栏布局：标注面板 + 会话库
  - JSONL 导入（支持 OpenClaw 和 Claude Code 格式）
  - 拖拽会话到标注面板
  - 会话/步骤级标注
  - 发布到 Chronicle
- **任务系统** — 统一 tasks.db 同时支持 /api/tasks 和 /api/kanban
  - 拖拽看板
  - 自定义属性、版本历史
  - 任务结果/摘要字段（用于 Chronicle）
  - 富文本块编辑器（Notion 风格）
- **理论/页面** — 全功能页面管理器
  - 层级页面树结构
  - 块编辑（文本、标题、媒体等）
  - 类型化页面：theory/task/page
  - 版本控制与锁定（通过 Chronicle）
- **Chronicle**（重新开放开发中）
  - 3 种条目类型：memory | task | theory
  - 里程碑（分组条目，可锁定）
  - 集合（主题包，可拖拽排序）
  - 锁定后注解（V1 原始版，V2/V3+ 修订版）
- **智能体** — SVG 节点图可视化
- **4 个 SQLite 数据库** — 按数据类型清晰分离

**开发中**
- Chronicle 哈希链完整性验证
- Theory 页面锁定与版本控制
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
| 后端 | Express.js + SQLite3（4 个数据库） |
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
npm run init-memory  # 首次运行：初始化 memory.db
npm run init-tasks   # 首次运行：初始化 tasks.db
npm run init-pages   # 首次运行：初始化 pages.db
npm run init-agents  # 首次运行：初始化 agents.db
npm run dev
```

**其他命令**

```bash
# 前端
npm run build     # 类型检查 + 打包 → dist/
npm run lint      # ESLint（零警告）
npm run format    # Prettier 格式化 src/**
npm run preview   # 预览生产构建

# 后端（cd server/）
npm start         # 不含热重载的启动
npm run import    # 导入 JSONL 会话
npm run migrate   # Chronicle 迁移脚本
npm run backup    # 备份 Claude Code 项目（~/.claude/projects/）到 memory.db
npm run backup:daemon  # 每小时备份一次（后台模式）
npm run backup:dry     # 预览备份（不实际导入）
```

### 项目结构

```
egonetics/
├── src/
│   ├── components/             # React UI 组件
│   │   ├── Sidebar.tsx         # 导航 + 语言切换
│   │   ├── MemoryView.tsx      # 双栏：标注面板 + 会话库
│   │   ├── ChronicleView.tsx   # 时间轴、里程碑、集合
│   │   ├── TaskPageView.tsx    # 任务详情（请勿修改）
│   │   ├── KanbanBoard.tsx     # 看板（请勿修改）
│   │   ├── TheoryPageView.tsx  # 理论页面
│   │   ├── NotionPageView.tsx  # Notion 风格页面包装
│   │   ├── PageManager.tsx     # 完整页面/块编辑器（请勿修改）
│   │   ├── BlockEditor.tsx     # 富文本块编辑器
│   │   ├── AgentsView.tsx      # SVG 节点图
│   │   ├── taskBoard/          # 看板组件
│   │   └── apiClient.ts        # Theory/Pages API 客户端
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
│   ├── index.js                # 精简 Express 服务（端口 3002）
│   ├── db.js                   # 统一 4 数据库连接管理器
│   ├── routes/                 # 模块化路由处理器
│   │   ├── memory.js           # /api/memory/*（会话、标注、面板）
│   │   ├── tasks.js            # /api/tasks/* + /api/kanban/*
│   │   ├── pages.js            # /api/pages/* + /api/notion/*
│   │   ├── chronicle.js        # /api/chronicle/*
│   │   ├── agents.js           # /api/agents/*
│   │   └── media.js            # /api/media/*
│   ├── scripts/                # 数据库初始化与迁移
│   │   ├── init-memory-db.js
│   │   ├── init-tasks-db.js
│   │   ├── init-pages-db.js
│   │   ├── init-agents-db.js
│   │   ├── import-jsonl.js
│   │   ├── migrate-chronicle.js
│   │   └── tasks_schema.sql
│   ├── data/                   # SQLite 数据库（git 忽略）
│   │   ├── memory.db
│   │   ├── tasks.db
│   │   ├── pages.db
│   │   └── agents.db
│   └── package.json
├── public/
├── vite.config.ts              # 端口 3000，/api 代理 → 3002
├── tailwind.config.js
├── CLAUDE.md                   # Claude Code 开发指南
└── package.json
```

### 路由列表

| 路径 | 视图 |
|---|---|
| `/memory` | 记忆：标注面板 + 会话库 |
| `/chronicle` | Chronicle 时间轴（重新开发中） |
| `/theory` | Bornfly 理论（PageManager） |
| `/egonetics` | Egonetics 原则 |
| `/tasks` | 任务看板 |
| `/tasks/:taskId` | 任务详情页 |
| `/blog` | 博客 / 知识库 |
| `/agents` | 智能体 SVG 节点图 |
| `/settings` | 设置 |

### 数据库

`server/data/` 目录下四个独立的 SQLite 数据库：

| 文件 | 用途 |
|---|---|
| `memory.db` | 聊天会话（sessions/rounds/steps）、标注、chronicle 表 |
| `tasks.db` | 项目、任务、看板列、blocks、属性、版本 |
| `pages.db` | 页面层级、元数据（Theory/Task/Page 页面） |
| `agents.db` | 智能体及关系 |

### Chronicle 设计

**仅精选内容**：条目需经用户批准后才能进入编年史。

**条目类型**：`memory` | `task` | `theory`

**核心结构**：
- **里程碑**：分组条目，发布 = 锁定所有条目 + 集合
- **集合**：用户命名的主题包（如"熬出低谷"），可拖拽排序
- **注解**：锁定后修订（V1=原版，V2/V3+ 在 chronicle_annotations）

**哈希链**：（Phase 2 计划）— 每条目与前一条密码学链接

### API 端点

**记忆** (`/api/memory/*`)
- `GET /memory/sessions` — 会话列表（分页）
- `GET /memory/sessions/:id` — 会话详情
- `DELETE /memory/sessions/:id` — 删除会话
- `GET /memory/sessions/:id/rounds` — 轮次
- `GET /memory/rounds/:id/steps` — 步骤
- `PATCH /memory/sessions/:id/annotate` — 标注会话
- `POST /memory/sessions/:id/send-to-chronicle` — 发布到 Chronicle
- `POST /memory/import` — 导入 JSONL
- `GET/POST /memory/boards` — 标注面板
- `PATCH/DELETE /memory/boards/:id` — 更新/删除面板
- `POST /memory/boards/:id/send-to-chronicle` — 发布面板

**任务** (`/api/tasks/*`, `/api/kanban/*`)
- `GET/POST /tasks` — 列表/创建任务
- `GET/PUT/DELETE /tasks/:id` — 任务 CRUD
- `POST /tasks/:id/send-to-chronicle` — 任务到 Chronicle
- `GET/PUT /tasks/:id/blocks` — 任务内容块
- `GET/POST /tasks/:id/properties` — 自定义属性
- `GET/POST /tasks/:id/versions` — 版本历史
- `GET/PUT /kanban` — 看板列
- `GET/POST/PUT/PATCH/DELETE /kanban/tasks` — 看板任务

**页面** (`/api/pages/*`, `/api/notion/*`)
- `GET/POST /pages` — 列表/创建页面
- `PATCH/DELETE /pages/:id` — 更新/删除页面
- `GET/PUT /pages/:id/blocks` — 页面块
- `GET/PUT /notion/blocks` — Notion 兼容 API

**Chronicle** (`/api/chronicle/*`)
- `GET /chronicle` — 完整时间轴（条目、里程碑、集合）
- `GET/POST /chronicle/entries` — Chronicle 条目
- `PATCH /chronicle/entries/:id` — 更新条目
- `GET/POST /chronicle/milestones` — 里程碑
- `GET/POST /chronicle/collections` — 集合

**智能体** (`/api/agents/*`)
- `GET/POST /agents` — 列表/创建智能体
- `GET/PUT/DELETE /agents/:id` — 智能体 CRUD
- `GET/POST /agents/relations` — 智能体关系

---

<div align="center">

**Egonetics** — Your digital self, anchored in time.

*MIT License · by [Bornfly](https://github.com/bornfly-detachment)*

</div>
