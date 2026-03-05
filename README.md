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

**Implemented & Refactored (2025–2026)**
- **Auth & Access Control** *(2026-03-05)*
  - 3 roles: `admin` (CLI created) · `agent` (self-register, username+password) · `guest` (self-register, email+password)
  - JWT-based auth — admin/guest: 24h · agent: 30d. 401 auto-redirects to `/login`
  - Guest email verification via [Resend](https://resend.com) — 6-digit code, 10-min TTL
  - Login rate limiting — 5 failures per account / 10 per IP in 15 min → temporary lockout
  - Password rules enforced on both frontend and backend: min 8 chars, uppercase + lowercase + number
  - Real-time username/email uniqueness check during registration
  - Role-based route guard: guest sees `home/egonetics/tasks/blog`; agent adds `agents`; admin sees all
  - All mutations (POST/PUT/PATCH/DELETE) blocked for guests; agents limited to tasks/agents resources
  - `auth.db` — 5th SQLite database: `users`, `login_attempts`, `verification_codes`, `agent_tokens`
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
- **Rich-text Editor Architecture Refactor** *(2026-03-05)*
  - Separated rendering layer into `src/components/rich-editor/` (28 block types)
  - Edit/Preview fully decoupled per block type: `blocks/{type}/Editor` + `blocks/{type}/Preview`
  - Code blocks: CodeMirror 6 (edit) + highlight.js (preview) + Prettier 3 standalone (format on save)
  - Markdown blocks: ReactMarkdown + rehype-highlight preview
  - `/shortcut` direct block type trigger (e.g. `/code`, `/h1`, `/todo`) + Slash menu
  - Block-level permission interface (`canEdit`, `canDelete`, `canAdd`, `canReorder`) with reserved fields for per-block and tag-based permissions
  - `BlockEditor.tsx` reduced by 886 lines (old rendering layer fully replaced)
  - All 4 consumer pages (`/memory`, `/chronicle`, `/tasks/:id`, `/theory`) zero-change migration
- **Egonetics — Constitution Management System** *(2026-03-05)*
  - `/egonetics` — Subject card grid: create subjects with agent/model metadata, hover-to-delete
  - `/egonetics/:subjectId` — PageManager layout (read-only): left file tree + right block content
  - Mirrors `~/.claude/constitution/` directory structure exactly (folders → folder pages, files → content pages)
  - `PageManager` extended with `readOnly` prop: hides all edit/add/delete/drag controls, passes `readOnly` to `BlockEditor`
  - New `egonetics_pages` + `egonetics_page_blocks` tables in `agents.db`; full CRUD API at `/api/egonetics/pages/*`
  - `EgoneticsApiClient.ts` implements `ApiClient` interface scoped to a subject's page tree (write ops are no-ops in read-only mode)
  - Import scripts in `scripts/`: `import_constitution_tree.py` seeds full directory tree into any subject
  - Architecture design recorded in `chronicle-trace/events/`: directed semantic graph, version-DB forking, RL training data structure

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
| State | Zustand (3 stores + auth store, localStorage persistence) |
| Styling | Tailwind CSS + Glassmorphism |
| Rich Text | Custom Block System — CodeMirror 6 + highlight.js + Prettier 3 |
| Drag & Drop | react-dnd (block reorder) |
| Cryptography | Web Crypto API (SHA-256) · bcryptjs (passwords) · JWT (sessions) |
| Backend | Express.js + SQLite3 (5 databases) |
| Email | Resend (email verification) |
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

**First-time setup** (run once before starting the server)

```bash
cd server
npm run init-memory  # init memory.db
npm run init-tasks   # init tasks.db
npm run init-pages   # init pages.db
npm run init-agents  # init agents.db
npm run init-auth    # init auth.db + create admin account (interactive)
cd ..
```

**Environment variables** (create `server/.env` or set in shell)

```bash
JWT_SECRET=your-very-long-random-secret   # Required in production
RESEND_API_KEY=re_xxxxxxxxxxxx             # Resend API key for email verification
EMAIL_FROM=Egonetics <noreply@yourdomain.com>  # Verified sender domain
```

> Without `RESEND_API_KEY`, verification codes are printed to the backend console instead of emailed — useful for local development.

**Development** (single command)

```bash
./start.sh   # Starts frontend (3000) + backend (3002) concurrently
```

Or manually:

```bash
# Terminal 1 — Frontend (http://localhost:3000)
npm run dev

# Terminal 2 — Backend (http://localhost:3002)
cd server && npm run dev
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
│   │   ├── BlockEditor.tsx     # Block editor orchestrator (state, DnD, slash menu)
│   │   ├── CodeBlock.tsx       # Standalone code block (CodeMirror 6)
│   │   ├── rich-editor/        # Rendering layer — decoupled edit/preview per block type
│   │   │   ├── index.ts        # Public exports
│   │   │   ├── RichPreview.tsx # Read-only preview component
│   │   │   ├── types.ts        # Re-exports from shared types
│   │   │   ├── shared/
│   │   │   │   ├── BlockWrapper.tsx      # Edit/Preview router per block
│   │   │   │   ├── BlockEditorInner.tsx  # Edit dispatcher
│   │   │   │   ├── BlockPreviewInner.tsx # Preview dispatcher (all 28 types)
│   │   │   │   ├── blockTypeConfig.ts   # Single source of truth (shortcuts, icons)
│   │   │   │   ├── blockUtils.ts        # getPlainText, makeSegs, positionBetween…
│   │   │   │   └── RichText.tsx         # Inline rich text renderer
│   │   │   └── blocks/
│   │   │       ├── paragraph/{Editor,Preview}
│   │   │       ├── heading/{Editor,Preview}
│   │   │       └── code/{Editor,Preview}  # CodeMirror + hljs + Prettier
│   │   ├── AgentsView.tsx      # SVG node graph
│   │   ├── taskBoard/          # Kanban board components
│   │   └── apiClient.ts        # Theory/Pages API client
│   ├── lib/
│   │   ├── chronicle.ts        # BornflyChronicle class (hash chain)
│   │   ├── api.ts              # Memory/sessions API client
│   │   ├── tasks-api.ts        # Tasks/projects REST API client
│   │   ├── formatCode.ts       # Prettier 3 standalone — format on save
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

### Routes & Access Control

| Path | View | Guest | Agent | Admin |
|---|---|:---:|:---:|:---:|
| `/login` | Login / Register | public | public | public |
| `/home` | Home | ✓ | ✓ | ✓ |
| `/egonetics` | Constitution subjects | ✓ | ✓ | ✓ |
| `/egonetics/:id` | Subject detail (read-only) | ✓ | ✓ | ✓ |
| `/tasks` | Task Kanban Board | read | read+write | ✓ |
| `/tasks/:taskId` | Task Detail | read | read+write | ✓ |
| `/blog` | Blog / knowledge base | ✓ | ✓ | ✓ |
| `/agents` | Agent SVG Node Graph | — | read+write | ✓ |
| `/memory` | Memory sessions | — | — | ✓ |
| `/theory` | Bornfly Theory (PageManager) | — | — | ✓ |
| `/chronicle` | Chronicle Timeline | — | — | ✓ |

### Databases

Five separate SQLite databases under `server/data/`:

| File | Purpose |
|---|---|
| `memory.db` | Chat sessions (sessions/rounds/steps), annotations, chronicle tables |
| `tasks.db` | Projects, tasks, kanban columns, blocks, properties, versions |
| `pages.db` | Page hierarchy, metadata (Theory/Task/Page pages) |
| `agents.db` | Agents, relations, egonetics subjects, constitution pages & blocks |
| `auth.db` | Users, login attempts, email verification codes, agent tokens |

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

**已实现与重构 (2025–2026)**
- **认证与权限控制** *(2026-03-05)*
  - 三种角色：`admin`（CLI 创建）· `agent`（自主注册，用户名+密码）· `guest`（自主注册，邮箱+密码）
  - JWT 认证 — admin/guest 有效期 24h · agent 30d。401 自动跳转 `/login`
  - 游客邮箱验证通过 [Resend](https://resend.com) 发送 — 6 位数字验证码，10 分钟有效
  - 登录限速 — 单账号 5 次 / 单 IP 10 次（15 分钟内）→ 临时锁定
  - 密码规则前后端双重校验：最少 8 位，含大小写字母和数字
  - 注册时实时查库检查用户名/邮箱唯一性
  - 基于角色的路由守卫：游客可见 `home/egonetics/tasks/blog`；agent 增加 `agents`；admin 全部可见
  - 所有变更操作（POST/PUT/PATCH/DELETE）对游客屏蔽；agent 仅限操作 tasks/agents 相关资源
  - `auth.db` — 第 5 个 SQLite 数据库：`users`、`login_attempts`、`verification_codes`、`agent_tokens`
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
- **富文本编辑器架构重构** *(2026-03-05)*
  - 渲染层独立为 `src/components/rich-editor/`，支持 28 种块类型
  - 编辑/预览按块类型完全解耦：`blocks/{type}/Editor` + `blocks/{type}/Preview`
  - 代码块：CodeMirror 6（编辑）+ highlight.js（预览）+ Prettier 3 standalone（保存时格式化）
  - Markdown 块：ReactMarkdown + rehype-highlight 渲染
  - `/shortcut` 直接触发类型转换（如 `/code`、`/h1`、`/todo`）+ 斜杠菜单双模式
  - 块级权限接口（`canEdit`、`canDelete`、`canAdd`、`canReorder`），预留按块/按标签赋权扩展点
  - `BlockEditor.tsx` 精简 886 行（旧渲染层全量替换）
  - 四个消费页面（`/memory`、`/chronicle`、`/tasks/:id`、`/theory`）零改动迁移
- **Egonetics — 宪法管理系统** *(2026-03-05)*
  - `/egonetics` — 主题卡片网格：创建带 agent/model 元信息的主题，hover 显示删除按钮
  - `/egonetics/:subjectId` — PageManager 布局（只读）：左侧文件树 + 右侧块内容展示
  - 精确镜像 `~/.claude/constitution/` 目录结构（子目录 → folder page，文件 → content page）
  - `PageManager` 新增 `readOnly` prop：隐藏所有编辑/新建/删除/拖拽控件，透传至 `BlockEditor`
  - `agents.db` 新增 `egonetics_pages` + `egonetics_page_blocks` 表；完整 CRUD API `/api/egonetics/pages/*`
  - `EgoneticsApiClient.ts` 实现 `ApiClient` 接口，作用域限定到单个 subject 的页面树（只读模式下写操作为 no-op）
  - `scripts/import_constitution_tree.py` — 将 constitution 完整目录树导入指定 subject
  - 架构设计记录于 `chronicle-trace/events/`：有向语义图、版本 DB 分叉、RL 训练数据结构

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
| 状态管理 | Zustand（3 个 store + auth store，localStorage 持久化） |
| 样式 | Tailwind CSS + Glassmorphism |
| 富文本 | 自研块系统 — CodeMirror 6 + highlight.js + Prettier 3 |
| 拖拽 | react-dnd（块排序） |
| 密码学 | Web Crypto API（SHA-256）· bcryptjs（密码）· JWT（会话） |
| 后端 | Express.js + SQLite3（5 个数据库） |
| 邮件 | Resend（邮箱验证） |
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

**首次初始化**（只需执行一次）

```bash
cd server
npm run init-memory  # 初始化 memory.db
npm run init-tasks   # 初始化 tasks.db
npm run init-pages   # 初始化 pages.db
npm run init-agents  # 初始化 agents.db
npm run init-auth    # 初始化 auth.db + 交互式创建管理员账号
cd ..
```

**环境变量**（创建 `server/.env` 或在 shell 中设置）

```bash
JWT_SECRET=你的超长随机密钥        # 生产环境必须设置
RESEND_API_KEY=re_xxxxxxxxxxxx     # Resend API Key，用于邮箱验证
EMAIL_FROM=Egonetics <noreply@yourdomain.com>  # 已验证的发件域名
```

> 未设置 `RESEND_API_KEY` 时，验证码会直接打印到后端控制台，方便本地开发调试。

**开发模式**（一键启动）

```bash
./start.sh   # 同时启动前端（3000）+ 后端（3002）
```

或手动启动：

```bash
# 终端 1 — 前端（http://localhost:3000）
npm run dev

# 终端 2 — 后端（http://localhost:3002）
cd server && npm run dev
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
│   │   ├── BlockEditor.tsx     # 块编辑器编排层（状态、DnD、斜杠菜单）
│   │   ├── CodeBlock.tsx       # 独立代码块（CodeMirror 6）
│   │   ├── rich-editor/        # 渲染层 — 按块类型解耦编辑/预览
│   │   │   ├── index.ts        # 公共导出
│   │   │   ├── RichPreview.tsx # 只读预览组件
│   │   │   ├── types.ts        # 共享类型转发
│   │   │   ├── shared/
│   │   │   │   ├── BlockWrapper.tsx      # 单块编辑/预览路由
│   │   │   │   ├── BlockEditorInner.tsx  # 编辑分发器
│   │   │   │   ├── BlockPreviewInner.tsx # 预览分发器（28 种块类型）
│   │   │   │   ├── blockTypeConfig.ts   # 单一数据源（快捷键、图标）
│   │   │   │   ├── blockUtils.ts        # getPlainText、makeSegs、positionBetween…
│   │   │   │   └── RichText.tsx         # 行内富文本渲染
│   │   │   └── blocks/
│   │   │       ├── paragraph/{Editor,Preview}
│   │   │       ├── heading/{Editor,Preview}
│   │   │       └── code/{Editor,Preview}  # CodeMirror + hljs + Prettier
│   │   ├── AgentsView.tsx      # SVG 节点图
│   │   ├── taskBoard/          # 看板组件
│   │   └── apiClient.ts        # Theory/Pages API 客户端
│   ├── lib/
│   │   ├── chronicle.ts        # BornflyChronicle 类（哈希链）
│   │   ├── api.ts              # 记忆/会话 API 客户端
│   │   ├── tasks-api.ts        # 任务/项目 REST API 客户端
│   │   ├── formatCode.ts       # Prettier 3 standalone — 保存时格式化
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

### 路由列表与访问权限

| 路径 | 视图 | 游客 | Agent | Admin |
|---|---|:---:|:---:|:---:|
| `/login` | 登录 / 注册 | 公开 | 公开 | 公开 |
| `/home` | 主页 | ✓ | ✓ | ✓ |
| `/egonetics` | 宪法主题网格 | ✓ | ✓ | ✓ |
| `/egonetics/:id` | 主题详情（只读） | ✓ | ✓ | ✓ |
| `/tasks` | 任务看板 | 只读 | 读写 | ✓ |
| `/tasks/:taskId` | 任务详情 | 只读 | 读写 | ✓ |
| `/blog` | 博客 / 知识库 | ✓ | ✓ | ✓ |
| `/agents` | 智能体节点图 | — | 读写 | ✓ |
| `/memory` | 记忆会话库 | — | — | ✓ |
| `/theory` | Bornfly 理论 | — | — | ✓ |
| `/chronicle` | Chronicle 时间轴 | — | — | ✓ |

### 数据库

`server/data/` 目录下五个独立的 SQLite 数据库：

| 文件 | 用途 |
|---|---|
| `memory.db` | 聊天会话（sessions/rounds/steps）、标注、chronicle 表 |
| `tasks.db` | 项目、任务、看板列、blocks、属性、版本 |
| `pages.db` | 页面层级、元数据（Theory/Task/Page 页面） |
| `agents.db` | 智能体及关系、egonetics 主题、宪法页面树与块内容 |
| `auth.db` | 用户账号、登录记录、邮箱验证码、Agent API Token |

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
