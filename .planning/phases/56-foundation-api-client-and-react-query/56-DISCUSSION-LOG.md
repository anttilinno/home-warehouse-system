# Phase 56: Foundation — API Client & React Query - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-15
**Phase:** 56-foundation-api-client-and-react-query
**Areas discussed:** Workspace ID strategy, Entity type placement, Query key design, Smoke test form

---

## Workspace ID Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| From a Zustand/context store | A useWorkspace hook or context exposes the current workspace ID — API modules read it internally | ✓ |
| Parameter on every call | Each function like items.list(workspaceId, params) receives the ID explicitly | |
| Baked into React Query hooks | useItemsQuery() reads workspaceId from context internally | |

**User's choice:** From a Zustand/context store (Recommended)
**Notes:** Resolved via codebase scouting — `AuthContext` already provides `workspaceId`. No new store needed. Hooks use `useAuth().workspaceId`.

---

## Entity Type Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Per-entity in lib/api/ files | types and API functions co-located in items.ts, loans.ts, etc. | ✓ |
| All in lib/types.ts | Extend existing lib/types.ts | |
| Separate lib/types/ directory | lib/types/items.ts, lib/types/loans.ts etc. | |

**User's choice:** Per-entity in lib/api/ files (Recommended)
**Notes:** Co-location keeps entity API surface contained. lib/types.ts stays for domain-agnostic types only.

---

## Query Key Design

| Option | Description | Selected |
|--------|-------------|----------|
| Query key factories | itemKeys.all, itemKeys.list(params), itemKeys.detail(id) | ✓ |
| Simple string arrays | ['items'], ['items', id], ['items', 'list', params] | |
| You decide | Claude picks the pattern | |

**User's choice:** Query key factories (Recommended)
**Notes:** TK-dodo hierarchical factory pattern. Enables `invalidateQueries(itemKeys.all)` to clear all item caches after mutations. Each entity module exports its own keys factory.

---

## Smoke Test Form

| Option | Description | Selected |
|--------|-------------|----------|
| Visible /api-demo route | Minimal dev page showing loading/success/error for a real list call | ✓ |
| Attach to existing /demo page | Add API & Query section to /demo | |
| Vitest integration test | Mount QueryClientProvider + hook, mock fetch, assert states | |

**User's choice:** Visible /api-demo route (Recommended)
**Notes:** Public dev route like /demo. Shows explicit loading → success → error states for a real endpoint. Removed or left as dev-only in production.

---

## Claude's Discretion

- TanStack Query version
- React Query Devtools mounting approach
- QueryClient default configuration
- lib/api/ barrel index
- /api-demo route styling
- CI guard implementation detail
