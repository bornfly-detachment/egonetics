# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
