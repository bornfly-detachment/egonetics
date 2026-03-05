# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 开发宪法 — 必须遵守，优先级高于一切

### 核心原则：主动式设计，而非反应式修 bug

**禁止"打地鼠式开发"**：修一个冒一个，根因是每次只看局部，没有全局视角。

### 三条硬规则（违反前必须与用户沟通）

**规则 1 — 先设计，后编码**
开始任何模块前，必须先做设计对话：
- Claude 输出架构方案（数据结构 + 组件结构），不写代码
- 用户确认方案没问题，再开始写代码

**规则 2 — 问题积累到 ≥3 再行动**
模块内的问题和需求不积累到 ≥3 个不动手。
必须从架构层面找到这些问题的根因，给出统一解决方案，才值得行动。

**规则 3 — 三思而后行**

在动手前必须依次过三个检查：

> **思考 1**：改动是否会产生分歧和冲突，造成后续麻烦？
> → 如果是，停下，告知用户，先解决冲突

> **思考 2**：改动是否牺牲架构的高内聚低耦合，或重复造轮子？
> → 如果是，停下，告知用户，先讨论方案

> **思考 3**：需求是否明确？方案是否确定？是否能做到不影响其他模块的健壮性？
> → 如果否，停下，告知用户，先澄清需求

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
