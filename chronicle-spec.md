# Chronicle Feature — Implementation Spec

> **Conflict resolution rule**: When earlier and later sections contradict, the LATER section wins.

---

## 1. Mental Model (Read First)

Chronicle is a **time-stamped archive** of three item types: Task, Memory, Theory.  
Items live on a vertical **Timeline**, grouped by **Milestone versions** (V1, V2…).  
Items can be organized into **Collections** (like Notion pages — nestable, colorful, with rich content).  
Collections can be connected with arrows in a **Workflow view**.

```
Timeline
 │
 ├─ V1 (published, locked 🔒)
 │   ├─ Collection: "熬出低谷"  ← nestable, has color + BlockEditor content
 │   │   ├─ [task]   Task title          ← click → right drawer
 │   │   ├─ [memory] Memory title        ← click → right drawer
 │   │   └─ [theory] Theory v1.0 🔒      ← click → right drawer
 │   │       └─ Sub-Collection: "核心记录"   ← collections nest like Notion
 │   │           └─ [task] subtask
 │   └─ Standalone entry: [memory] uncategorized
 │
 ├─ V2 (unpublished, editable)
 │   └─ Collection: "产品化探索"
 │       ├─ [task] xxx
 │       └─ [memory] yyy
 │
 └─ Unassigned entries (no milestone, no collection)
```

---

## 2. Core Rules

### 2.1 Locking

| State | CRUD buttons | Content | Annotations |
|-------|-------------|---------|-------------|
| Unpublished | Visible | Editable | No version tag |
| Published (locked) | Hidden, show 🔒 | Read-only | Allowed, auto-tagged `v{N+1}-note` |

- Lock is triggered by publishing a Milestone
- Lock applies to: the Milestone, all Collections under it, all entries under it
- **Locked ≠ hidden** — content is always visible/readable
- After locking, Collections can still be **repositioned** (drag position_x/position_y) — UI layout only, no data change

### 2.2 Annotation versioning

- `chronicle_annotations` table has `milestone_version TEXT` column
- Before any Milestone published → annotation has no version tag
- After V1 published → new annotations get `milestone_version = "v2-note"`
- After V2 published → new annotations get `milestone_version = "v3-note"`
- Rule: `milestone_version = "v{highest_published_milestone + 1}-note"`

### 2.3 Entry display

- Timeline shows: title + date + type icon only
- Click entry → right-side drawer slides open with full content
- Entry content is fetched **on click** via API (lazy load, not pre-loaded)
- Entries are NOT deleted when entering Chronicle — they are archived (become read-only if under published milestone)

---

## 3. Database Migrations

**File: `server/scripts/migrate-chronicle.js`**

Run these SQL statements:

```sql
-- Collections: add color, rich content, and nesting
ALTER TABLE chronicle_collections ADD COLUMN color TEXT DEFAULT '#6366f1';
ALTER TABLE chronicle_collections ADD COLUMN content TEXT;  -- Notion-style block JSON
ALTER TABLE chronicle_collections ADD COLUMN parent_id TEXT
  REFERENCES chronicle_collections(id);

-- Annotations: add milestone version tag
ALTER TABLE chronicle_annotations ADD COLUMN milestone_version TEXT;

-- New table: directional links between collections (for Workflow view arrows)
CREATE TABLE IF NOT EXISTS chronicle_collection_links (
  id         TEXT PRIMARY KEY,
  from_id    TEXT NOT NULL REFERENCES chronicle_collections(id) ON DELETE CASCADE,
  to_id      TEXT NOT NULL REFERENCES chronicle_collections(id) ON DELETE CASCADE,
  label      TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

---

## 4. Backend API

**File: `server/routes/chronicle.js`**

### 4.1 Existing endpoints to fix/extend

#### `GET /chronicle`
Must also return `collection_links` array in response:
```json
{
  "milestones": [...],
  "entries": [...],
  "collections": [...],
  "collection_links": [...]
}
```

#### `PATCH /chronicle/collections/:id`
Add support for these fields: `color`, `content`, `parent_id`

#### `POST /chronicle/entries/:id/annotations`
Auto-compute and write `milestone_version`:
```javascript
// Pseudocode
const maxVersion = await db.get(
  `SELECT MAX(version) FROM chronicle_milestones WHERE is_published = 1`
);
const milestoneVersion = maxVersion ? `v${maxVersion + 1}-note` : null;
// Insert annotation with milestone_version = milestoneVersion
```

### 4.2 New endpoints (add if missing)

| Method | Path | Condition | Description |
|--------|------|-----------|-------------|
| DELETE | `/chronicle/entries/:id` | `is_locked = 0` only | Delete entry |
| DELETE | `/chronicle/milestones/:id` | `is_published = 0` only | Delete milestone, set entries' milestone_id = null |
| POST | `/chronicle/collection-links` | — | Body: `{ from_id, to_id, label }` |
| GET | `/chronicle/collection-links` | — | Return all links |
| DELETE | `/chronicle/collection-links/:id` | — | Delete a link |

### 4.3 Existing item-fetch endpoints (used by drawer — do NOT create new ones)

These should already exist. Chronicle drawer calls them directly:

| Type | Endpoint |
|------|---------|
| task | `GET /api/kanban/tasks/:id` |
| memory | `GET /memory/sessions/:id` (+ rounds) |
| theory | `GET /api/pages/:id/blocks` |

---

## 5. Frontend — `src/components/ChronicleView.tsx`

**Full rewrite required.** Implement in this priority order:

### Priority 1 (highest): Entry Detail Drawer

Right-side drawer that slides in when any entry is clicked.

**Behavior:**
- Trigger: click any task/memory/theory entry in Timeline or Workflow
- Animation: slide in from right
- Close: X button or click outside

**Drawer content by type:**

| Type | API to call | Display |
|------|-------------|---------|
| task | `GET /api/kanban/tasks/:id` | Show task fields (title, status, description, etc.) — read-only |
| memory | `GET /memory/sessions/:id` | Show conversation rounds — read-only |
| theory | `GET /api/pages/:id/blocks` | BlockEditor with `permissions={{ canEdit:false, canDelete:false, canAdd:false }}` |

**Annotation section (bottom of drawer):**
```
─── Annotations ───────────────────────────────
[v1-note] 2026-01-10  "This was the turning point"
[v2-note] 2026-02-03  "Still relevant after V2"
─────────────────────────────────────────────────
[ Add annotation...                    ] [Submit]
```
- Load: `GET /chronicle/entries/:id/annotations` sorted by created_at ASC
- Submit: `POST /chronicle/entries/:id/annotations` — server auto-adds version tag
- If entry is locked: show version tag on new annotation in UI after submit
- If entry is unlocked: no version tag shown

---

### Priority 2: Timeline View Layout

**View switcher** (top bar):
```
[● Timeline]  [○ Workflow]          [+ Collection]  [+ Milestone]  [Library ▶]
```

**Timeline structure:**

```
── V1 · Jan 2026 · Published 🔒 ──────────────────────── [▼ collapse]
  Collection: 熬出低谷              🔵 (blue left border)   🔒
    ├── [task]   Egonetics Alpha                           → click = drawer
    ├── [memory] 2025-12-01 session                        → click = drawer
    ├── [theory] 系统设计 v1.0 🔒                          → click = drawer
    └── Collection: 核心记录  (nested)  🟣
          └── [task] subtask                               → click = drawer

── V2 · Feb 2026 · Unpublished ────────────────────────── [▼ collapse]
  Collection: 产品化探索             🟣 (purple left border) [Edit] [Delete]
    ├── [task] xxx
    └── [memory] yyy
  [Publish Milestone V2]

── Unassigned ──────────────────────────────────────────
  [task] ungrouped    [memory] ungrouped
```

**Collection card rules:**
- Has: colored left border (use `color` field), title, optional BlockEditor for `content`
- Collections are **always expanded** (content visible by default, collapsible)
- Collections can be **nested**: child collections render indented inside parent
- Locked collection: hide Edit/Delete buttons, show 🔒, BlockEditor is read-only
- Unlocked collection: show Edit/Delete, BlockEditor fully editable
- Drag entries INTO a collection: `POST /chronicle/collections/:id/items`

**Entry chip inside collection:**
```
[📋 task]  Task Title Here                         (click → drawer)
[🧠 memory] Memory Title                           (click → drawer)
[📖 theory] Theory Title v1.0                      (click → drawer)
```

---

### Priority 3: Right-side Library Panel

Toggle button "Library ▶" in top bar opens/closes.

```
┌─ Library ──────────────────────┐
│ [Tasks] [Memory] [Theory]      │
│ ────────────────────────────── │
│ (showing items NOT in any      │
│  collection)                   │
│                                │
│  📋 Task Name A        [drag→] │
│  📋 Task Name B        [drag→] │
│  🧠 Memory 2026-01-05  [drag→] │
│  📖 Theory v2.0        [drag→] │
└────────────────────────────────┘
```

- Drag from library → drop onto collection = `POST /chronicle/collections/:id/items`
- After drop: item disappears from library panel, appears in collection

---

### Priority 4: Collection Nesting

- Collections follow the same nesting logic as Notion blocks
- Hierarchy: `Collection > Collection (nested) > task/memory/theory entries`
- `task/memory/theory` entries are **leaf nodes** — they cannot contain children
- Nesting stored via `parent_id` on `chronicle_collections`
- Render: recursive component, indented visually

---

### Priority 5 (lowest): Workflow SVG View

Activated by clicking "Workflow" tab in view switcher.

**Layout:**
- Each Collection = colored rectangle node (auto-height based on content)
- Entry chips inside the node: `[task]`=blue, `[memory]`=green, `[theory]`=orange
- Click entry chip → same right-side drawer as Timeline view
- Node drag: update `position_x`, `position_y` via `PATCH /chronicle/collections/:id`

**Arrow / Link mode:**
1. Click "Connect" button → enter link mode
2. Click source collection node → click target collection node
3. Popup: enter optional label text → confirm
4. Calls: `POST /chronicle/collection-links { from_id, to_id, label }`
5. Render arrow with label between nodes (SVG `<line>` or `<path>`)
6. Click existing arrow → confirm dialog → `DELETE /chronicle/collection-links/:id`

---

## 6. Acceptance Checklist

Before marking done, verify each item:

```
UI / Interaction
□ Click any entry (timeline or workflow) → right drawer slides open
□ Drawer shows correct content per type (task fields / memory rounds / theory blocks)
□ Drawer annotation list loads correctly
□ Add annotation in drawer → appears immediately in list
□ Locked entry: annotation added → shows milestone_version tag (e.g. "v2-note")
□ Unlocked entry: annotation added → no version tag

Timeline
□ Milestones render in version order (V1 before V2)
□ Milestone expand/collapse works
□ Collections show colored left border
□ Collections always show content (not collapsed by default)
□ Nested collections render indented correctly
□ Locked milestone/collection: CRUD buttons hidden, 🔒 shown
□ Unlocked: Edit/Delete buttons visible and functional

CRUD (unlocked only)
□ Delete entry → works when is_locked = 0, blocked when is_locked = 1
□ Delete milestone → works when is_published = 0, sets entries' milestone_id = null
□ Edit collection → color, content, parent_id all save correctly

Library Panel
□ Library panel toggles open/close
□ Shows only entries not in any collection
□ Tabs filter by type (Tasks / Memory / Theory)
□ Drag entry from library → drops into collection → entry moves correctly

Workflow View
□ Collections render as draggable nodes
□ Drag node → position persists after refresh
□ "Connect" mode: click source → click target → label input → arrow appears
□ Click arrow → delete confirmation → arrow removed
□ Click entry chip in workflow → same drawer opens
```

---

## 7. Key Implementation Notes

1. **Never pre-load entry content** — always fetch on drawer open (lazy)
2. **Collection content** (`content` field) stores Notion-style block JSON — use existing `BlockEditor` component
3. **Locking is additive** — once locked, never unlock (no unlock endpoint needed)
4. **Position drag in Workflow view** is purely cosmetic — does not affect Timeline ordering
5. **Timeline order** = by milestone version number, then by entry `created_at` within each milestone
6. Unassigned entries (no milestone_id, no collection) render at the bottom of Timeline
