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

- **Abstract Cognitive Network — Free Canvas** *(2026-03-14)*
  - `/egonetics` redesigned as a **free-form canvas system** (XMind/Miro style) for building knowledge networks
  - Multiple named canvases, each persistable. Canvas list at `/egonetics`; open canvas at `/egonetics/canvas/:id`
  - **Left sidebar**: all Tasks + Pages listed by type, click to add entity card to canvas, added items shown as ✓
  - **Canvas**: dot-grid background, mouse-drag pan, scroll-wheel zoom (centered on cursor), absolute-positioned entity cards
  - **Drag cards**: drag-to-reposition with 400ms debounced position persistence to DB
  - **L1–L4 expansion**: title only → +status → +relation list → (future: content preview)
  - **SVG bezier edges**: labeled with `relation.title`, drawn between all entity pairs that have relations AND are both on canvas; clicking edge navigates to `/relations/:id`
  - **Connection mode**: click ↗ on a card to enter connect mode → click target card → fill Relation form (title + description) → creates relation and immediately renders edge
  - **Relation detail page** at `/relations/:id`: edit title/description, extensible key-value properties, version history panel
  - **DB additions in `pages.db`**: `canvases` table (id/title/description/creator), `canvas_nodes` table (canvas_id/entity_type/entity_id/x/y/expanded_level)
  - **Relations enhanced**: `properties TEXT DEFAULT '{}'` column added; `GET/PUT /relations/:id/blocks` endpoints for rich block content; `relation_blocks` table with same schema as `blocks`
  - **New files**: `server/routes/canvases.js`, `server/scripts/migrate-blocks-v4.js`, `src/lib/canvas-api.ts`, `src/components/CanvasView.tsx`, `src/components/RelationDetailView.tsx`
  - **Migration**: `cd server && npm run migrate-v4`

- **Graph System v2 — Relation Types + Bottom Sheet + Tree Expand** *(2026-03-18)*
  - **Relation type system**: 9 preset types (contains / causal / derives / relates / assumes / chain / question / answer / based_on), each with its own color. Types stored as JSON in `settings` table (`key='relation_types'`), managed at runtime via full CRUD UI — no schema migration needed to add types
  - **Auto color assignment**: new types auto-pick the next unused color from a 15-color palette
  - **Edge coloring**: SVG bezier edges are colored by `relation_type`, updating live when type changes
  - **XMind-style tree expand**: `[+]` button on any card fetches direct children via `/pages/:id/subtree`, places them to the right in a vertical tree layout (`parent.x + CARD_W + 80`, children centered), auto-creates `contains` relations for each parent→child pair, marks parent `tree_expanded=1`; `[−]` removes all descendant canvas nodes
  - **Card fold**: `[⊟]` / `[⊞]` collapses/expands card to title bar only — state persisted in `canvas_nodes.collapsed`
  - **Fullscreen mode**: toolbar `[⤢]` button sets `position: fixed; inset: 0; z-index: 50`, escaping the app shell entirely. `Esc` exits
  - **Relation Bottom Sheet** (replaces right-side panel): clicking any edge opens a half-screen bottom sheet with draggable resize handle (drag top bar to resize from 200px to viewport−80px). Contains: type selector + title input (800ms auto-save), source→target chain row, publish form (POST snapshot with explanation), collapsible version history, full **BlockEditor** for rich content (1200ms debounced PUT `/relations/:id/blocks`)
  - **`relation_blocks` table**: created via `migrate-relation-blocks.js`; same schema as `blocks` table; CASCADE delete when relation is deleted
  - **`canvas_nodes` schema additions**: `collapsed INTEGER DEFAULT 0`, `tree_expanded INTEGER DEFAULT 0` (via `migrate-canvas-nodes.js`)
  - **`relations` schema addition**: `relation_type TEXT NOT NULL DEFAULT 'contains'` (via `migrate-relation-types.js`)
  - **New API**: `GET/POST/PATCH/DELETE /api/relation-types`; `POST /api/relations` and `PATCH /api/relations/:id` now accept/return `relation_type`
  - **New files**: `server/routes/relation-types.js`, `server/scripts/migrate-relation-types.js`, `server/scripts/migrate-canvas-nodes.js`, `server/scripts/migrate-relation-blocks.js`, `src/components/RelationBottomSheet.tsx`
  - **Migrations**: `node scripts/migrate-relation-types.js` → `node scripts/migrate-canvas-nodes.js` → `node scripts/migrate-relation-blocks.js`

- **Block v2 — Process Versions & Relations** *(2026-03-14)*
  - Every block gains a collapsible header (visible on hover or when title is set): **title** input, **creator** label, **creation timestamp**, **Publish** button, **Memory** panel, **Relations** panel
  - **Process versions (过程记忆)**: clicking Publish creates an append-only snapshot in `process_versions` — records `start_time` (when editing began after last publish), `publish_time`, `publisher` (`human:username` / `ai:model`), full content snapshot, and explanation text. No publish = no history, just normal editing
  - **Publish panel**: inline content block (not a floating popover) — full-width textarea for recording intent, **Save Draft** persists explanation to DB (`blocks.draft_explanation`), survives page refresh and cross-device; draft indicator dot shown on Publish button when draft exists; draft auto-cleared after confirmed publish
  - **Relations**: open-description cross-entity edges. Source/target can be any of `block | task | memory | theory | label | label_system`. Each relation has a title + free-text description (not an enum). Relations also support publish/version history via `process_versions`. Stored in the `relations` table
  - **DB schema additions** in `pages.db`:
    - `blocks` table: added `title`, `creator`, `edit_start_time`, `draft_explanation` columns
    - New `process_versions` table: `entity_id`, `entity_type` ('block'|'relation'), `version_num`, `start_time`, `publish_time`, `publisher`, `title_snapshot`, `content_snapshot` (JSON), `explanation`
    - New `relations` table: `source_type/id`, `target_type/id`, `title`, `description`, `creator`, timestamps
  - **Bug fix**: `PUT /pages/:id/blocks` full-replace now preserves `created_at` via `COALESCE(?, CURRENT_TIMESTAMP)`
  - **New API endpoints**: `PATCH /blocks/:id/meta`, `POST /blocks/:id/publish`, `GET /blocks/:id/versions`; full CRUD + versioning under `/relations/*`
  - **New files**: `server/routes/relations.js`, `server/scripts/migrate-blocks-v2.js`, `server/scripts/migrate-blocks-v3.js`, `src/lib/block-graph-api.ts`
  - **Migrations**: `cd server && npm run migrate-v2` (schema) → `npm run migrate-v3` (draft_explanation)

- **PRVS 公理集 + 控制论 Hub 重构** *(2026-03-23)*
  - **PRVS Axiom Sets CRUD**: P/R/V/S each primitive has a leveled axiom hierarchy — Level 1 公理 (minimal complete set), Level 2 推论 (corollaries), Level 3 推理 (inferences). Full CRUD with BlockEditor per entry for rich text annotation. Backend: 5 REST endpoints backed by `docs/prvs-axiom-sets.json`
  - **Cybernetics Hub** (`/cybernetics`): Merged Constitution Editor + Ontology Graph into a single full-screen tab hub, removing redundant standalone routes `/constitution` and `/ontology`
  - **Ontology Graph redesign**: warm opaque node colors, text centered, node width auto-sizes to label length, removed redundant metadata lines, cleaner bezier edges
  - **PRVSPanel typography**: eliminated all sub-12px font sizes, upgraded to `text-xs`/`text-sm` minimum across all tabs
  - **Sidebar rename**: `cybernetics` → 控制论内核, `egonetics` → 主体图谱
  - **fix: PageManager dropdown menu clipped by overflow-hidden**: Rewrote menu rendering using `createPortal` + `fixed` positioning calculated from `getBoundingClientRect()`, so the delete/rename menu is never clipped by ancestor `overflow-hidden` containers

- **Notion Knowledge Base Import** *(2026-03-16)*
  - `POST /api/notion/import` — server calls Notion API directly, zero Claude token consumption, fully automated
  - Recursive children-first import: child pages imported before parent's blocks are saved, so `subpageId` values are always valid
  - Auto-pagination: `fetchAllBlocks()` loops on `has_more` cursor until all blocks retrieved
  - Full Notion → Egonetics block type mapping: paragraph, heading1/2/3, bullet, numbered, todo, code, quote, callout (info/warning/success/tip by color), divider, image, bookmark, table→markdown code block, child_page→subpage, column_list/column→flattened
  - `subpageTitle` sourced from page metadata (full title), not from parent's truncated block field
  - UTF-8 chunk boundary fix: HTTP response collected as `Buffer[]` then decoded once via `Buffer.concat().toString('utf8')`, eliminating `\ufffd` replacement characters in multi-byte CJK text
  - `parentPageId` parameter: import under any existing page (no new task created); omit to auto-create a same-title task
  - `NOTION_TOKEN` stored in shell env, never in project code or git
  - **In-page import button**: toolbar "↓ 导入" button opens inline dialog — paste Notion URL → import → page tree auto-refreshes. Available on all pages using `PageManager`
  - **Cascade delete**: `DELETE /tasks/:id` and `DELETE /kanban/tasks/:id` now recursively delete all associated pages and blocks via recursive CTE
  - **Sidebar ↔ content sync**: creating a child page from sidebar automatically appends a subpage block to the parent page's content; deleting a page removes its subpage block from parent
  - **New server file**: `server/routes/notion-import.js`
  - **New env var**: `NOTION_TOKEN` (your Notion integration token)

- **AI-Native Design System + PRVSE Protocol CRUD** *(2026-03-28)*
  - **5-layer AI Design System**: Design Tokens → Headless Primitives → Styled Components → AI-aware Components → Agent UI Layer
  - **`src/design/tokens.ts`** — Static design token source of truth: node colors (P/R/V/S/E), permission layers (l₀/l₁/l₂), edge styles (directed/constraint/mutual_constraint/contains/derives/signal), interaction tokens
  - **`TokenProvider.tsx`** — React Context that fetches `hm_protocol` overrides at runtime, deep-merges with static tokens, silent-fails to static defaults. All components consume `useTokens()` — no hardcoded colors anywhere
  - **`src/design/primitives.ts`** — Headless behavior hooks: `usePRVSEConstraint`, `useLayerPermission`, `useRewardGate`, `useNodeInteraction`, `useCollapsible`
  - **Styled components** (Layer 3): `Arrow.tsx` (SVG edge with ×/⊂ markers, unique per-edge SVG defs), `LayerBadge.tsx`, `SliderWidget.tsx` (矛盾↔统一), `TimelineWidget.tsx`, `InteractionChip.tsx` (Lucide icons, no obscure Unicode), `StateMachineVisual.tsx`, `VRewardVisual.tsx`
  - **`/protocol` page** — Human-Machine Collaboration Protocol CRUD: full table with inline visual rendering + JSON toggle, category filter tabs, `VisualTemplatePicker` (grid of clickable template cards for new entries)
  - **`hm_protocol` table** in `pages.db` — 50+ seeded entries across: interaction, layer, R relations, P patterns, V values, AOP stubs, S states
  - **PRVSEGraph rewrite**: all colors/styles driven by `useTokens()`, edge type selector from token map, per-edge unique SVG marker IDs

- **Task State Machine — PRVSE Schema Definition** *(2026-03-28)*
  - Three state machine dimensions defined as S protocol entries: `lifecycle` (building→running→waiting→suspended→archived), `feedback` (positive_loop↔negative_loop), `execution` (retrying→success/failure)
  - State transitions carry `guard: 'V_reward >= threshold'` annotations — guards are PRVSE graph evaluations (P→R+V→S), not standalone functions
  - **`StateMachineVisual`**: dimension-specific animated UIs — `DirectedFlow` (state chain with path-following animation), `FeedbackLoop` (↺↻ with bidirectional V-gate), `OutcomeTree` (branching success/failure with guard pills), scanline background texture, `SCHEMA` badge with pulse indicator
  - XState-compatible `machine_lang` JSON stored per entry for future runtime consumption

- **V Reward / Value System — Complete Schema Definition** *(2026-03-28)*
  - **V = {objective, external, internal}** — 3D reward vector:
    - **V1 objective** (5 types): `counter` (uint), `timer` (float/s), `token_consumption` (K/M/B input+output pair), `usage_pct/success_rate` (float [0,1], precision 2, dual-format 0.70=70.00%), `binary` (0/1 ✅❎ signal)
    - **V2 external** (7 types): confidence, relevance_prob, causal_prob, prediction_prob, narrative_legitimacy, narrative_completeness, narrative_logic — all 0~1 probability
    - **V3 internal** (5 types): constitutional_rule (template, instantiable), value_alignment, cognitive_eval, narrative_consistency, prediction_prob_internal
  - **φ functions** (4, independently defined): `φ_causal` (P(B|do(A))·C(E), maps R:derives/signal), `φ_temporal` (P(B|A,t_A≺t_B), maps R:directed), `φ_contradiction` (1−|P(A)−P(B)|·tension, maps R:mutual_constraint), `φ_dependency` (P(B|A)·I(A→B), maps R:constraint/contains)
  - V2/V3 entries declare type only; φ functions are independently defined; runtime dynamically composes `P(G) = ∏ φ(Node, Edge, Constraint)` over PRVSE graph — **factor graph probability model**
  - **`VRewardVisual`**: V1=animated live widgets (counter ticker, timer clock, token pair, probability bar, binary toggle), V2/V3=pulsing probability bar with φ-capable chips, φ=formula display + R-edge mapping + "1:N" label
  - **Design principle**: Policy = PRVSE Graph itself (P→R+V→S); layered decision emerges from graph topology, not a separate weighting function

- **Protocol — Human-Machine Collaboration Protocol v2** *(2026-03-29)*
  - **Allowed-components library** (`src/design/allowed-components/`): 42 components across 5 groups — Layout / Content / Action / Data / AI. Each component carries a PRVSE-compatible schema (category, tier, permission level)
  - **IR Renderer** (`src/design/ir/`): Intent Representation → UI Generator → Renderer pipeline; protocol entries define `ui_visual` as IR JSON, rendered dynamically without hardcoding components
  - **ProtocolView tab redesign**: 3-layer grouping — Resource & Permission & Communication layer / Constraint Control layer / Practice layer
  - **Resource tiers T0/T1/T2**: pipeline cards — T0 SEAI local (zero-latency, offline) → T1 MiniMax cloud (high-throughput) → T2 Claude expert (top reasoning)
  - **Permission layers T3/T2/T1/T0**: four-tier permission definitions anchored to tag tree nodes
  - **Communication mechanisms L0/L1/L2**: L0 descriptive / L1 request / L2 control — typed edges in the PRVSE graph
  - **`anchor_tag_id` on protocol entries**: each entry anchors to a tag tree node; deleting a tag that is referenced by protocol entries is blocked with a 409 error listing the referencing rules
  - **Seed scripts**: `seed-ui-components.js`, `seed-resource-tier.js`, `seed-permission-layers.js`, `seed-communication-protocol.js`
  - **Visuals**: `ResourceTierVisual`, `CommunicationVisual`, `UIComponentVisual` — new visual renderer routes in `ProtocolVisual`
  - **兼容层 LLM 客户端** (`server/lib/llm.js`): T0 `seaiClient` (localhost:8000) / T1 `minimaxClient` (MiniMax-M2.7) / T2 `claudeClient` (claude-sonnet-4-6); `getClientForTier()` no longer silently downgrades T2 — missing Anthropic auth now surfaces `AUTH_REQUIRED`

- **Cybernetics Hub v2 — SEAI Live Integration** *(2026-04-02)*
  - **CyberneticsSystemView** redesigned: left-side persistent tree navigation (PRVSE 5-layer × 3-question tag tree) + right-side content panel
  - **SEAI component panel**: fetches live component tree from `http://localhost:8000/e0/components`; displays PRVSE layer assignment, weight, activation status per component
  - **SEAIVPanel**: real-time V reward vector display from SEAI local endpoint; shows T0/T1/T2 routing status
  - **TagTreeView integrated**: tag tree CRUD now embedded in Cybernetics Hub as a first-class panel
  - **Global TagTreeStore** (`src/stores/useTagTreeStore.ts`): single source of truth for tag tree; `useBlockTags` hook refactored to delegate all operations to the store, enabling cross-component sync
  - **graph.js parameter fix**: Kuzu graph queries now use `prepare + execute` for parameterized queries instead of the broken `query(cypher, params)` pattern

- **PRVSE World — Three-Tier Progressive Cybernetics System** *(2026-04-02)*
  - Three-tier recursive control system: **L3 World** (full-screen 3D spherical canvas) / **L2 Cybernetics** (each sphere independently governed) / **L1 Granularity** (2D detail)
  - Route `/prvse-world` — full UI layer: `PrvseWorldView`, `Minimap`, `KernelOverlay`, `HumanQueuePanel`
  - **`src/kernel/`** — pure TypeScript zero-dependency kernel: `Constitution` / `Tick` / `Observer` / `Reality` four layers, 60+ tests
  - **L3AIInput** — single input bar with T0/T1/T2 tier selector: T0 → SEAI local (zero-latency), T1 → MiniMax cloud (high-throughput), T2 → Claude Code Agent (top reasoning)
  - **T2 Claude Code Agent** (tmux-based, `server/lib/code-agent.js`):
    - Persistent `claude --dangerously-skip-permissions` running inside `egonetics-coding-agent` tmux session
    - Input via `tmux send-keys`, output detection via `tmux capture-pane` — no spawning, no sockets, tmux IS the daemon
    - Runs on Max subscription OAuth — `ANTHROPIC_API_KEY` explicitly unset to avoid 403
    - Three-sphere architecture: `constitution/goals/resources` each have an independent tmux window, working directory set to `agent-spaces/{sphere}/`
    - Per-sphere serial request queue prevents concurrent send-keys collisions
  - **Interactive prompt relay**: when claude prompts for confirmation (numbered options, Y/N, Press Enter), options are forwarded to frontend as clickable amber buttons; user clicks from browser → `POST /api/code-agent/respond` → `tmux send-keys` reply
  - **PRVSE World Workspace** (`prvse_world_workspace/` — sibling dir outside repo):
    - `L2/storage/` → `egonetics/server/data` (relative symlink, tracked in git)
    - `L2/ai-resources/{constitution,goals,resources}/` → `egonetics/agent-spaces` (relative symlink, gitignored)
  - **`setup.sh`** — one-shot script for fresh clones: creates `prvse_world_workspace/` directory tree, recreates both symlinks

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

# Initialize workspace — creates prvse_world_workspace/ + symlinks (run once on new machine)
bash setup.sh

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
npm run migrate-v2     # Add process_versions + relations tables + block columns (title/creator/edit_start_time)
npm run migrate-v3     # Add draft_explanation column to blocks
npm run migrate-v4     # Add canvases + canvas_nodes + relation_blocks tables; relations.properties
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
│   │   ├── EgoneticsView.tsx   # Canvas list (new)
│   │   ├── CanvasView.tsx      # Free-form canvas editor (new)
│   │   ├── RelationDetailView.tsx  # Relation detail + properties + versions (new)
│   │   ├── AgentsView.tsx      # SVG node graph
│   │   ├── taskBoard/          # Kanban board components
│   │   └── apiClient.ts        # Theory/Pages API client
│   ├── lib/
│   │   ├── chronicle.ts        # BornflyChronicle class (hash chain)
│   │   ├── api.ts              # Memory/sessions API client
│   │   ├── tasks-api.ts        # Tasks/projects REST API client
│   │   ├── block-graph-api.ts  # Block meta / publish / relations API client
│   │   ├── canvas-api.ts       # Canvas + canvas nodes API client (new)
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
│   │   ├── pages.js            # /api/pages/* + /api/blocks/* + /api/notion/*
│   │   ├── relations.js        # /api/relations/* (cross-entity edges + blocks + versioning)
│   │   ├── canvases.js         # /api/canvases/* (canvas CRUD + node management) (new)
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
│   │   ├── migrate-blocks-v2.js   # process_versions + relations tables + block columns
│   │   ├── migrate-blocks-v3.js   # draft_explanation column
│   │   ├── migrate-blocks-v4.js   # canvases + canvas_nodes + relation_blocks; relations.properties
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
| `/egonetics` | Abstract Cognitive Network — canvas list | ✓ | ✓ | ✓ |
| `/egonetics/canvas/:id` | Free-form canvas editor | ✓ | ✓ | ✓ |
| `/egonetics/:id` | Subject detail (read-only, legacy) | ✓ | ✓ | ✓ |
| `/relations/:id` | Relation detail + properties + versions | — | — | ✓ |
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

**Pages & Blocks** (`/api/pages/*`, `/api/blocks/*`, `/api/notion/*`)
- `GET/POST /pages` — List/create pages
- `PATCH/DELETE /pages/:id` — Update/delete page
- `POST /pages/:id/move` — Move page in hierarchy
- `GET/PUT /pages/:id/blocks` — Get/save page blocks (full replace, preserves `created_at`)
- `PATCH /blocks/:id/meta` — Update block title / creator / editStartTime / draftExplanation
- `POST /blocks/:id/publish` — Publish process version snapshot; clears editStartTime + draftExplanation
- `GET /blocks/:id/versions` — List process versions for a block
- `GET/PUT /notion/blocks` — Notion-compatible API (legacy)
- `POST /notion/import` — Recursively import Notion page tree (body: `notionPageUrl`, opt. `parentPageId` / `taskId` / `pageType`)

**Relations** (`/api/relations/*`)
- `GET /relations` — Query relations by source_id / target_id / source_type / target_type
- `POST /relations` — Create relation (source + target entity ref + title + description)
- `GET/PATCH/DELETE /relations/:id` — Relation CRUD (`properties` JSON field extensible)
- `POST /relations/:id/publish` — Publish relation version snapshot
- `GET /relations/:id/versions` — List process versions for a relation
- `GET/PUT /relations/:id/blocks` — Relation rich block content (same schema as page blocks)

**Canvases** (`/api/canvases/*`)
- `GET /canvases` — List all canvases (with `node_count`)
- `POST /canvases` — Create canvas (title + description)
- `GET/PATCH/DELETE /canvases/:id` — Canvas CRUD
- `GET /canvases/:id/nodes` — Get all entity nodes on canvas
- `POST /canvases/:id/nodes` — Add entity to canvas (entity_type + entity_id + x/y + expanded_level)
- `PATCH /canvases/:id/nodes/:nodeId` — Update node position / expanded level
- `DELETE /canvases/:id/nodes/:nodeId` — Remove node from canvas

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

- **抽象认知网络 — 自由画布** *(2026-03-14)*
  - `/egonetics` 重新设计为**自由画布系统**（XMind/Miro 风格），用于构建跨实体知识网络
  - 支持多画布，每个画布独立持久化。画布列表入口 `/egonetics`；画布编辑 `/egonetics/canvas/:id`
  - **左侧栏**：所有 Task + Page 按类型分组列出，点击即将实体卡片添加到画布，已在画布上的条目显示 ✓ 变灰
  - **画布交互**：点网格背景；拖拽背景平移（pan）；滚轮缩放（以鼠标为中心）；实体卡片绝对定位
  - **卡片拖拽**：拖动重新定位，400ms debounce 后持久化坐标到 DB
  - **L1–L4 展开级别**：仅标题 → +状态 → +关系列表 → （未来：内容预览）
  - **SVG 贝塞尔曲线边**：以 `relation.title` 为标签，在同时存在于画布且有关系的实体对之间绘制；点击边跳转 `/relations/:id`
  - **连接模式**：点击卡片上 ↗ 进入连接模式 → 点击目标卡片 → 填写 Relation 表单（标题 + 描述）→ 创建关系并即时渲染边
  - **关系详情页** `/relations/:id`：编辑标题/描述、可扩展键值属性、版本历史面板
  - **`pages.db` 新增表**：`canvases`（id/title/description/creator）、`canvas_nodes`（canvas_id/entity_type/entity_id/x/y/expanded_level）
  - **关系增强**：新增 `properties TEXT DEFAULT '{}'` 字段；新增 `GET/PUT /relations/:id/blocks` 端点支持富文本内容；`relation_blocks` 表结构与 `blocks` 表一致
  - **新增文件**：`server/routes/canvases.js`、`server/scripts/migrate-blocks-v4.js`、`src/lib/canvas-api.ts`、`src/components/CanvasView.tsx`、`src/components/RelationDetailView.tsx`
  - **迁移命令**：`cd server && npm run migrate-v4`

- **Block v2 — 过程版本与关系系统** *(2026-03-14)*
  - 每个块新增可折叠头部（hover 显示，设有标题时常驻）：**标题**输入框、**创建人**标签、**创建时间**、**发布**按钮、**记忆**面板、**关系**面板
  - **过程记忆**：点击发布后在 `process_versions` 表追加快照 — 记录 `start_time`（上次发布后首次编辑时间）、`publish_time`、`publisher`（`human:username` / `ai:model`）、完整内容快照和发布说明。未发布=无历史，与原有编辑逻辑一致
  - **发布面板**：内联内容块（非浮层弹窗）— 全宽 textarea 用于记录意图；**存草稿**将说明文字持久化到 DB（`blocks.draft_explanation`），刷新页面、跨设备均可恢复；有草稿时发布按钮显示蓝色小圆点提示；确认发布后服务端自动清空草稿
  - **关系**：开放描述的跨实体边，起点/终点可为 `block | task | memory | theory | label | label_system` 任意组合。每条关系有标题 + 自由文本描述（非枚举）。关系同样支持发布/版本历史（写入 `process_versions`），独立存储于 `relations` 表
  - **`pages.db` 结构扩展**：
    - `blocks` 表新增列：`title`、`creator`、`edit_start_time`、`draft_explanation`
    - 新增 `process_versions` 表：`entity_id`、`entity_type`（'block'|'relation'）、`version_num`、`start_time`、`publish_time`、`publisher`、`title_snapshot`、`content_snapshot`（JSON）、`explanation`
    - 新增 `relations` 表：`source_type/id`、`target_type/id`、`title`、`description`、`creator`、时间戳
  - **Bug 修复**：`PUT /pages/:id/blocks` 全量替换时通过 `COALESCE(?, CURRENT_TIMESTAMP)` 保留 `created_at`，防止创建时间被重置
  - **新增 API**：`PATCH /blocks/:id/meta`、`POST /blocks/:id/publish`、`GET /blocks/:id/versions`；`/relations/*` 完整 CRUD + 发布/版本历史
  - **新增文件**：`server/routes/relations.js`、`server/scripts/migrate-blocks-v2.js`、`server/scripts/migrate-blocks-v3.js`、`src/lib/block-graph-api.ts`
  - **迁移命令**：`cd server && npm run migrate-v2`（建表）→ `npm run migrate-v3`（draft_explanation 列）

- **PRVS 公理集 + 控制论 Hub 重构** *(2026-03-23)*
  - **PRVS 公理集 CRUD**：P/R/V/S 各原语支持层级公理管理 — 1级公理（最小完备集）、2级推论、3级推理。每条条目内嵌 BlockEditor 进行富文本标注，支持依赖关系追溯。后端：5 个 REST 端点，数据持久化到 `docs/prvs-axiom-sets.json`
  - **控制论 Hub** (`/cybernetics`)：将宪法编辑器与生变论本体图合并为统一全屏 Tab Hub，移除冗余独立路由 `/constitution` 和 `/ontology`
  - **生变论本体图重设计**：节点改为暖色调不透明配色，文字居中，节点宽度自适应文本长度，移除冗余元信息行，曲线边更简洁
  - **PRVSPanel 排版升级**：消除所有 9px/10px/11px 细字，全面升级到 `text-xs`/`text-sm` 最低标准
  - **侧边栏重命名**：`cybernetics` → 控制论内核，`egonetics` → 主体图谱
  - **fix：PageManager 下拉菜单被裁切**：改用 `createPortal` + `fixed` 定位（坐标由 `getBoundingClientRect()` 实时计算），彻底解决删除/重命名菜单被祖先 `overflow-hidden` 容器遮挡的问题

- **Notion 知识库导入** *(2026-03-16)*
  - `POST /api/notion/import` — 服务端直接调 Notion API，零 Claude token 消耗，完全自动化
  - children-first 递归导入：先导入子页面再处理父页面块，subpageId 始终有效
  - 自动翻页：`fetchAllBlocks()` 循环消费 `has_more` cursor，直到拉取全部块
  - 完整 Notion → Egonetics 块类型映射：paragraph、heading1/2/3、bullet、numbered、todo、code、quote、callout（按颜色分为 info/warning/success/tip）、divider、image、bookmark、table→markdown code 块、child_page→subpage、column_list/column→展开子块
  - `subpageTitle` 取自页面元数据（完整标题），不使用父块列表中的截断预览字段
  - UTF-8 chunk 边界修复：HTTP 响应改为收集 `Buffer[]` 后统一 `Buffer.concat().toString('utf8')` 解码，彻底消除中文 `\ufffd` 乱码
  - `parentPageId` 参数：传入时导入到指定页面下（不新建 task）；不传时自动建同名 task
  - `NOTION_TOKEN` 存于 shell 环境变量，不进项目代码和 git
  - **页面内导入按钮**：工具栏"↓ 导入"按钮，点击展开内联弹窗 — 粘贴 Notion URL → 导入 → 自动刷新页面树。适用于所有使用 `PageManager` 的页面
  - **级联删除**：`DELETE /tasks/:id` 和 `DELETE /kanban/tasks/:id` 通过递归 CTE 同步删除所有关联页面和块
  - **侧边栏与内容同步**：从侧边栏新建子页面时，自动向父页面内容末尾追加 subpage 块；删除页面时同步清理父页面中的对应 subpage 块
  - **新增服务端文件**：`server/routes/notion-import.js`
  - **新增环境变量**：`NOTION_TOKEN`（Notion Integration Token）

- **人机协作协议 v2** *(2026-03-29)*
  - **Allowed-components 组件库** (`src/design/allowed-components/`)：42 个组件，分为 5 组 — Layout / Content / Action / Data / AI，每个组件携带 PRVSE 兼容 schema（category / tier / permission level）
  - **IR 渲染器** (`src/design/ir/`)：Intent Representation → UI Generator → Renderer 三层管道；协议条目 `ui_visual` 字段存储 IR JSON，运行时动态渲染，无需硬编码组件
  - **ProtocolView 标签重构**：三层分组 — 资源权限通信层 / 分级约束控制层 / 实践层
  - **资源分级 T0/T1/T2**：流水线卡片 — T0 SEAI 本地（零延迟，离线可用）→ T1 MiniMax 云端（高并发）→ T2 Claude 专家（顶级推理）
  - **权限层级 T3/T2/T1/T0**：四层权限定义，每条规则锚定到标签树节点（`anchor_tag_id`）
  - **通信机制 L0/L1/L2**：L0 描述型 / L1 请求型 / L2 控制型 — 类型化边，映射至 PRVSE 图中的 R 层
  - **标签锚定保护**：删除被协议规则引用的标签节点时，返回 409 错误并列出所有引用规则，防止悬空引用
  - **种子脚本**：`seed-ui-components.js`、`seed-resource-tier.js`、`seed-permission-layers.js`、`seed-communication-protocol.js`
  - **兼容层 LLM 客户端** (`server/lib/llm.js`)：T0 `seaiClient`（localhost:8000）/ T1 `minimaxClient`（MiniMax-M2.7）/ T2 `claudeClient`（claude-sonnet-4-6）；`getClientForTier()` 不再对 T2 做静默降级，缺少 Anthropic 认证时会显式返回 `AUTH_REQUIRED`

- **控制论 Hub v2 — SEAI 实时集成** *(2026-04-02)*
  - **CyberneticsSystemView 重设计**：左侧常驻树形导航（PRVSE 5层×3问标签树）+ 右侧内容区
  - **SEAI 组件面板**：实时从 `http://localhost:8000/e0/components` 拉取组件树；展示每个组件的 PRVSE 层级归属、权重、激活状态
  - **SEAIVPanel**：从 SEAI 本地端点实时展示 V 奖励向量；显示 T0/T1/T2 路由状态
  - **TagTreeView 内嵌**：标签树 CRUD 作为一等面板集成到控制论 Hub
  - **全局 TagTreeStore** (`src/stores/useTagTreeStore.ts`)：标签树单一数据源；`useBlockTags` hook 重构为委托 store，实现跨组件实时同步
  - **graph.js 参数化查询修复**：Kuzu 图数据库查询改用 `prepare + execute` 模式，修复带参数的 Cypher 查询失败问题

- **PRVSE World — 三层递进控制论系统** *(2026-04-02)*
  - 三层递进控制论：**L3 世界**（全屏 3D 球形画布）/ **L2 控制论**（各球根独立治理）/ **L1 粒度**（2D 细节层）
  - 路由 `/prvse-world` — 完整 UI 层：`PrvseWorldView`、`Minimap`、`KernelOverlay`、`HumanQueuePanel`
  - **`src/kernel/`** — 纯 TypeScript 零依赖 Kernel：Constitution / Tick / Observer / Reality 四层，60+ 测试
  - **L3AIInput** — 单一输入条，T0/T1/T2 档位选择器：T0 → SEAI 本地（零延迟）/ T1 → MiniMax 云端（高并发）/ T2 → Claude Code Agent（顶级推理）
  - **T2 Claude Code Agent**（tmux 方案，`server/lib/code-agent.js`）：
    - 在 `egonetics-coding-agent` tmux session 中持续运行 `claude --dangerously-skip-permissions`
    - 输入通过 `tmux send-keys`，输出通过 `tmux capture-pane` 检测 — 无子进程 spawn，无 socket，tmux 即 daemon
    - 使用 Max 订阅 OAuth，显式 unset `ANTHROPIC_API_KEY` 避免 403 错误
    - 三球架构：`constitution/goals/resources` 各自独立 tmux window，工作目录指向对应 `agent-spaces/{sphere}/`
    - 每球串行请求队列，防止并发 send-keys 冲突
  - **交互式确认中继**：当 claude code 弹出确认框（数字选项、Y/N、Press Enter），选项实时中继到前端显示为琥珀色可点击按钮；用户在浏览器点击 → `POST /api/code-agent/respond` → `tmux send-keys` 回复
  - **PRVSE World 工作区**（`prvse_world_workspace/`，仓库外同级目录）：
    - `L2/storage/` → `egonetics/server/data`（相对软链接，已入库 git）
    - `L2/ai-resources/{constitution,goals,resources}/` → `egonetics/agent-spaces`（相对软链接，gitignore 排除）
  - **`setup.sh`** — 新机器一键初始化：创建 `prvse_world_workspace/` 目录结构并重建两个软链接

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

# 初始化工作区 — 创建 prvse_world_workspace/ + 软链接（新机器执行一次）
bash setup.sh

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
npm run migrate-v2     # 新增 process_versions + relations 表 + block 元数据列
npm run migrate-v3     # 新增 draft_explanation 列
npm run migrate-v4     # 新增 canvases + canvas_nodes + relation_blocks 表；relations.properties 字段
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
│   │   ├── EgoneticsView.tsx   # 画布列表（新）
│   │   ├── CanvasView.tsx      # 自由画布编辑器（新）
│   │   ├── RelationDetailView.tsx  # 关系详情 + 属性 + 版本历史（新）
│   │   ├── AgentsView.tsx      # SVG 节点图
│   │   ├── taskBoard/          # 看板组件
│   │   └── apiClient.ts        # Theory/Pages API 客户端
│   ├── lib/
│   │   ├── chronicle.ts        # BornflyChronicle 类（哈希链）
│   │   ├── api.ts              # 记忆/会话 API 客户端
│   │   ├── tasks-api.ts        # 任务/项目 REST API 客户端
│   │   ├── block-graph-api.ts  # 块元信息 / 发布 / 关系 API 客户端
│   │   ├── canvas-api.ts       # 画布 + 节点 API 客户端（新）
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
│   │   ├── pages.js            # /api/pages/* + /api/blocks/* + /api/notion/*
│   │   ├── relations.js        # /api/relations/*（跨实体关系边 + 富文本块 + 版本历史）
│   │   ├── canvases.js         # /api/canvases/*（画布 CRUD + 节点管理）（新）
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
│   │   ├── migrate-blocks-v2.js   # process_versions + relations 表 + block 新列
│   │   ├── migrate-blocks-v3.js   # draft_explanation 列
│   │   ├── migrate-blocks-v4.js   # canvases + canvas_nodes + relation_blocks；relations.properties
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
| `/egonetics` | 抽象认知网络 — 画布列表 | ✓ | ✓ | ✓ |
| `/egonetics/canvas/:id` | 自由画布编辑器 | ✓ | ✓ | ✓ |
| `/egonetics/:id` | 主题详情（只读，旧版） | ✓ | ✓ | ✓ |
| `/relations/:id` | 关系详情 + 属性 + 版本历史 | — | — | ✓ |
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

**页面与块** (`/api/pages/*`, `/api/blocks/*`, `/api/notion/*`)
- `GET/POST /pages` — 列表/创建页面
- `PATCH/DELETE /pages/:id` — 更新/删除页面
- `POST /pages/:id/move` — 移动页面层级位置
- `GET/PUT /pages/:id/blocks` — 获取/保存页面块（全量替换，保留 `created_at`）
- `PATCH /blocks/:id/meta` — 更新块标题 / 创建人 / editStartTime / draftExplanation
- `POST /blocks/:id/publish` — 发布过程版本快照；自动清空 editStartTime + draftExplanation
- `GET /blocks/:id/versions` — 获取块的过程版本列表
- `GET/PUT /notion/blocks` — Notion 兼容 API（遗留）
- `POST /notion/import` — 递归导入 Notion 页面树（body: `notionPageUrl`，可选 `parentPageId` / `taskId` / `pageType`）

**关系** (`/api/relations/*`)
- `GET /relations` — 按 source_id / target_id / source_type / target_type 查询
- `POST /relations` — 创建关系（源/目标实体引用 + 标题 + 描述）
- `GET/PATCH/DELETE /relations/:id` — 关系 CRUD（`properties` JSON 字段可自由扩展）
- `POST /relations/:id/publish` — 发布关系版本快照
- `GET /relations/:id/versions` — 获取关系的过程版本列表
- `GET/PUT /relations/:id/blocks` — 关系富文本块（与页面块结构一致）

**画布** (`/api/canvases/*`)
- `GET /canvases` — 画布列表（含 `node_count`）
- `POST /canvases` — 创建画布（title + description）
- `GET/PATCH/DELETE /canvases/:id` — 画布 CRUD
- `GET /canvases/:id/nodes` — 获取画布上的所有实体节点
- `POST /canvases/:id/nodes` — 添加实体到画布（entity_type + entity_id + x/y + expanded_level）
- `PATCH /canvases/:id/nodes/:nodeId` — 更新节点位置 / 展开级别
- `DELETE /canvases/:id/nodes/:nodeId` — 从画布移除节点

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
