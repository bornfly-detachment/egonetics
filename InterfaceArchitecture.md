# Interface Architecture — Developer Edition & Client Edition

**Status**: Requirements capture  
**Date**: 2026-04-24  
**Author**: bornfly + CC

---

## Core Principle

No chat box as primary UI. Primary interaction surface is the **decision queue** — AI works async while human is offline; human processes items one by one when online.

Two product targets sharing L2 surface, diverging below:

```
Developer Edition               Client Edition
L2: Constitution / Goal / Resource ←── shared surface ──→ L2: Constitution / Goal / Resource
    ↓ drill-in                                                 ↓ natural language input
L1: CLI collab + CI/CD panel             compiler → IR → L1 work objectives (approval only)
    ↓ drill-in                                                 ↓ fully automatic
L0: CFL runtime monitor                  compiler + physics engine + ops AI (invisible)
```

Navigation rule: **you don't see deeper layers until you drill in.** Each layer has its own interaction pattern.

---

## Shared: Decision Queue (both editions)

Primary async human-AI interaction surface.

- AI continues working while human is offline — no blocking
- Human processes queue items one by one when online
- Each item carries: **source layer (L0/L1/L2)**, **type** (V-verdict / resource conflict / rule approval), **urgency**
- Actions per item: approve / reject / defer / modify
- After processing → next item auto-advances

---

## Developer Edition

### L2 — Goals / Constitution / Resources

Human role: configure, govern, allocate.

- **Goals**: create and manage L2-level objectives; auto-decomposes to L1 work targets
- **Constitution**: define rules; establish-rule API registers kernel contracts; constitution violations surface to queue
- **Resources**: allocation configuration + ops responsibility — ensure resources are healthy and properly assigned; L2-level incidents appear here

### L1 — Multi-CLI Collaboration + CI/CD

Human role: coordinate, review, unblock.

- Multi-CLI status: current branch per CLI (opencode / codex / CC), PR state, review requests
- Automated CI/CD pipeline status
- L1 queue items: PR review requests, merge decisions, phase transition approvals
- Real-time event stream from KernelBus (broker decisions, V-verdicts, escalations)

### L0 — CFL Runtime Detail

Human role: observe, diagnose.

- Read-only view of kernel nodes, contracts, effect stream (current KernelOverlay)
- Locate and inspect any CFL node state at any tick
- Direct intervention (write node values, inject contracts, manual tick) is available but gated — requires explicit confirmation, high-risk operation

### Developer-only capability

Developer can **modify the compiler and physics engine** — constructing any interaction rule, setting the boundary and capability ceiling for the system.

---

## Client Edition

### L2 — Plain Language Input (same three roles)

Human role: express intent in plain language, no technical knowledge required.

- Three entry points: **Constitution** (rules, values, constraints), **Goal** (what to achieve), **Resources** (what's available)
- Input form is **step-gated**: compiler validates completeness before advancing to next step; incomplete or contradictory input is blocked with explanation
- Backend compiler translates natural language → IR automatically
- IR auto-generates L1 work objectives and CFL — no manual CLI or CI/CD operations

### L1 — Approval Layer Only (simplified)

- Auto-generated work plan shown in plain language
- Human action: approve / adjust / reject plan
- No CLI micromanagement, no branch/PR detail visible
- Extreme simplification: only show what requires a human decision

### L0 — Invisible

- Handled entirely by local compiler + physics engine + ops AI module
- Fallback: server API (T1/T2) if local resolution fails
- Human never sees L0 in client edition

### Client-only characteristic

A non-technical user who knows nothing about CLI or AI can still test whether the system works. The compiler maintains invariant completeness — bad input never reaches execution.

---

## Shared L2 Surface

Both editions use the same L2 visual entry point (宪法 / 目标 / 资源 three-sphere metaphor).

Divergence point:
- **Developer**: direct control over each sphere's underlying rules and runtime bindings
- **Client**: natural language → compiler → same backend; no access to compiler internals

---

## Open Design Questions (not blocking, to resolve later)

1. Client L2 input form: step-by-step guided wizard vs. free-text with completeness checklist returned by compiler
2. Whether the 3D three-body physics visual is retained for client edition or replaced with a flatter IA
3. L0 developer intervention: exact confirmation UX for high-risk write operations
4. Real-time event delivery: polling vs. SSE vs. WebSocket for KernelBus → frontend
