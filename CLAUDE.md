# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 开发宪法 — 必须遵守，优先级高于一切

### 核心原则：主动式设计，而非反应式修 bug

**禁止"打地鼠式开发"**：修一个冒一个，根因是每次只看局部，没有全局视角。

### 开发铁律 — 优先级最高，无例外

**任何数据结构、配置、规则、参数的实现，必须支持完整 CRUD。**
- 后端：必须有 GET / POST / PATCH / DELETE 路由
- 前端：用户必须能在界面上增删改查，不能只读
- **不满足 CRUD 的功能，不做。宁可不实现，不做残缺品。**

违规案例（已发生，不得重犯）：
- V 层 reward functions 硬编码在 Python 文件里，用户无法增删改 → 已修复为 DB 驱动 + CRUD API
- 任何"写死在代码里的配置/常量/规则" → 必须迁移到 DB + 提供 CRUD 接口

---

### 三条硬规则（违反前必须与用户沟通）

**规则 1 — 先设计，后编码**
开始任何模块前，必须先做设计对话：
- Claude 输出架构方案（数据结构 + 组件结构），不写代码
- 用户确认方案没问题，再开始写代码

**规则 2 — 问题积累到 ≥3 再行动**
模块内的问题和需求不积累到 ≥3 个不动手。
必须从架构层面找到这些问题的根因，给出统一解决方案，才值得行动。

**规则 3 — 三思而后行 v2（守门 × 设计 双层串联）**

动手前必须依次完成两层三思，缺任何一层均视为违规。

#### 层一：守门三思（快速 pass/fail，任意 FAIL 立即停止告知用户）

> **守门思考 1**：改动是否会产生分歧和冲突，造成后续麻烦？
> → 如果是，停下，告知用户，先解决冲突

> **守门思考 2**：改动是否牺牲架构的高内聚低耦合，或重复造轮子？
> → 如果是，停下，告知用户，先讨论方案

> **守门思考 3**：需求是否明确？方案是否确定？是否能做到不影响其他模块的健壮性？
> → 如果否，停下，告知用户，先澄清需求

三项全 PASS → 进入层二。

#### 层二：设计三思（方案深度推演，每思最多 3 条，不得超出）

> **一思（白帽）**：从第一性原理出发，穷举理论和工程上可行的实现路径（≤3 条）

> **二思（黑帽）**：对每条路径找掣肘——影响范围、时间/资源成本、风险和失败概率（≤3 项）

> **三思（综合）**：综合前两思，得出唯一推荐方案，呈现给用户确认，获批后才动手

---

## Commands

### Frontend (root directory)
```bash
npm run dev       # Start Vite dev server on port 3000 (auto-opens browser)
npm run build     # Type-check with tsc, then bundle with Vite → dist/
npm run lint      # ESLint with zero-warnings tolerance
npm run format    # Prettier format src/**/*.{ts,tsx,css,md}
npm run preview   # Preview production build locally
```

### Backend (server/ directory)
```bash
npm run dev       # Start Express server on port 3002 with nodemon hot reload
npm start         # Start server without hot reload
npm run init-db   # Initialize SQLite databases (memory.db, tasks.db, pages.db)
```

For local development, both servers must run concurrently. Vite proxies `/api` → `http://localhost:3002`.

## Architecture

### What It Is
Egonetics is a personal agent system with a tamper-evident chronicle for self-evolution. Core concepts:
- **Bornfly Chronicle**: Append-only, cryptographically hash-linked (SHA-256) record of decisions, memories, and evolution
- **Life Core**: Central orchestrator agent (planned)
- **Egonetics**: Ego + Cybernetics principles ensuring alignment with user intent

### Project Structure
- **Frontend**: React 18 + TypeScript + Vite, served on port 3000
- **Backend**: Express.js + SQLite3, served on port 3002
- **Three SQLite databases**: `memory.db` (chat sessions), `tasks.db` (projects/tasks), `pages.db` (page content)

### State Management (Zustand)
Three stores in `src/stores/`:
- **`useChronicleStore`** — Primary store: chronicle entries, tasks, agents, UI state (`currentView`, `currentTaskId`, `sidebarOpen`, language). Persisted to localStorage.
- **`useTasksStore`** — Tasks fetched from server via `/api/tasks`. Handles loading/error states.
- **`useProjectsStore`** — Local-only project management. Persisted to localStorage.

### Routing
React Router DOM v7 in `App.tsx` with a `RouteSync` component that bidirectionally syncs URL paths with `useChronicleStore`'s `uiState.currentView`. Routes: `/memory`, `/theory`, `/chronicle`, `/egonetics`, `/tasks`, `/tasks/:taskId`, `/blog`, `/agents`, `/settings`.

### Core Library Files (`src/lib/`)
- **`chronicle.ts`** — `BornflyChronicle` class: SHA-256 hash chain, chain verification, localStorage persistence, genesis block
- **`api.ts`** — Memory/sessions API client
- **`tasks-api.ts`** — Tasks/projects REST API client
- **`translations.ts`** — i18n for zh/en (toggled via sidebar)

### Hash Chain
Each chronicle entry has a `prev_hash` field linking to the prior entry's hash. The `BornflyChronicle` class uses the Web Crypto API for SHA-256 (with a fallback for dev). Chain integrity is verified by recomputing all hashes and checking links.

### Adding New Features
- **New route**: Add to routes array in `App.tsx` + update `RouteSync` path-to-view mapping
- **New server-side data**: Add endpoint in `server/index.js`, create API client in `src/lib/`, optionally create a Zustand store
- **New view**: Create component in `src/components/`, add route, add sidebar nav item in `Sidebar.tsx`

### Key Config
- `vite.config.ts`: Port 3000, `@` alias → `src/`, `/api` proxy to port 3002, source maps enabled
- `tsconfig.json`: Strict mode, `noUnusedLocals`, `noUnusedParameters` — all unused variables are errors
- `tailwind.config.js`: Custom color palette (primary blue, secondary purple), glassmorphism design language, Inter + JetBrains Mono fonts
