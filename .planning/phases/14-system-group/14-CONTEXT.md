# Phase 14 — System group — CONTEXT

**Synthesised:** 2026-06-13 (orchestrator, surface verified inline).
**Goal:** `// SYSTEM` sidebar group pages — approvals (bulk), my-changes, sync-history, imports/exports — using the activity-table pattern; PLUS wishlist page + declutter page + per-entity export buttons.
**Depends on:** Phase 7 (lists), Phase 13 (approvals hook/panel already built).
**Requirements:** SYS-01, SYS-02, SYS-03, SYS-04, WISH-01, WISH-02, DECL-01, DECL-02.

## Backend surface (VERIFIED — all workspace-scoped `/api/workspaces/{wsId}`, Huma bare-body unless noted)
### Approvals (SYS-01) + My-changes (SYS-02) — domain `pendingchange` (mounted router.go:589)
- `GET /pending-changes?status=pending|approved|rejected` → `{ changes, total }` (owner/admin only → 403 else). Envelope key `changes` (NOT items).
- `GET /pending-changes/{id}` → one change.
- `POST /pending-changes/{id}/approve` → applies the change (owner/admin; 403 else).
- `POST /pending-changes/{id}/reject` → rejects (owner/admin; 403 else).
- `GET /my-pending-changes` → the caller's own pending changes (all roles) → SYS-02 my-changes source.
- **NO `defer` endpoint exists.** SYS-01 roadmap says "A/R/D (Approve/Reject/Defer)" — Defer has no backend. RESOLVE: ship A/R only; Defer = either omit or a client-only "leave pending" no-op. Document.
- Frontend EXISTS: `lib/api/pendingChanges.ts` (list/get) + `features/approvals/hooks/usePendingChangesQuery.ts` + `PendingApprovalsPanel` (Phase 13). EXTEND: add approve/reject mutations + a full `/approvals` page (the route Phase 13's panel "Review" link targets — currently → PlaceholderShell).

### Imports/Exports (SYS-04) — domains `importexport` (router.go:575) + `importjob` (router.go:579)
- `POST /import/{entity_type}` + `POST /import/workspace` — body has `format` (csv|json). Import a CSV/JSON.
- `GET /export/{entity_type}?format=csv|json` + `GET /export/workspace?format=csv|json` → **binary download** (Content-Type text/csv, Content-Disposition attachment). Per-entity export buttons (parity §4) hit `/export/{entity_type}`.
- `GET /imports/jobs` + `/imports/jobs/{id}` + `/imports/jobs/{id}/errors` → import-history (the activity-table surface for SYS-04). Async import worker exists.
- Frontend partial: `features/settings/DataStoragePage.tsx` already does workspace export + import (Phase 12, online-only). The Phase-14 Imports page is the richer surface (CSV import + import-history jobs table + per-entity export); reconcile with DataStoragePage (don't duplicate — link or share the workspace export/import logic).
- `features/loans/loanCsv.ts` = existing client CSV pattern (loans). Per-entity export buttons may use the server `/export/{entity}` endpoint instead (real server CSV) — prefer server endpoint for fidelity.

### Sync-history (SYS-03) — domain `sync` (router.go:576)
- ONLY `GET /sync/delta?modified_since=<RFC3339>` exists — a DATA delta-pull, NOT an event log. **There is NO sync-event-history endpoint** (no timestamps/status/error-details log). v3.0 is ONLINE-ONLY (FOUND-02 CI-blocks any `sync*` import).
- **RESOLVE (OQ):** SYS-03 "sync history" is a vestigial offline-era concept. Ship a minimal `/sync-history` page with an honest empty/informational state ("This workspace runs online-only — no background sync events") — do NOT fabricate events or invent a backend log. Document as a parity-vestigial residue; flag for possible roadmap de-scope. Do NOT consume `/sync/delta` (wrong semantics — it's a data pull, not history).

### Wishlist (WISH-01/02) — domain `wishlist` (router.go:541)
- `GET /wishlist` (likely `?status=` for wanted/ordered/acquired tabs) → list; `POST /wishlist`; `GET/PATCH/DELETE /wishlist/{id}`. Planner: read `wishlist/entity.go`+`handler.go` for exact status enum (wanted/ordered/acquired) + field shapes + envelope.
- Greenfield frontend: build `lib/api/wishlist.ts` + `features/wishlist/` (page with status tabs + CRUD form + status transition).

### Declutter (DECL-01/02) — domain `declutter` (router.go:562)
- `GET /declutter` → unused-items analysis (score badge + grouping); `GET /declutter/counts`; `POST /inventory/{inventory_id}/mark-used` (DECL-02 mark-used). Planner: read `declutter/entity.go`+`handler.go` for the score/grouping/reason shape + envelope.
- DECL-02 CSV export = client-side CSV (mirror loanCsv.ts) of the declutter list.
- Greenfield: `lib/api/declutter.ts` + `features/declutter/`.

## Reuse (atoms/patterns — do NOT rebuild)
- **Activity-table pattern**: RetroTable + the dashboard/loans list pattern (paginated, TUI columns). Phase 13's relativeTime + status pills.
- **Bulk-select (SYS-01)**: `components/retro/data/useTableSelection.ts` (id-keyed Shift+Click range) + `components/retro/filters/BulkActionBar.tsx` (Bottombar bulk chips). Wire A/R bulk actions through these.
- **Shortcuts**: `useShortcuts("approvals", [A→approve, R→reject])` — stable refs, no render-loop (landmine ×4).
- Forms: react-hook-form + zod + retro form atoms (Phase 4). Tabs: RetroTabs. Money: null-safe money.ts.
- Sidebar `// SYSTEM` group (`components/layout/Sidebar.tsx:148`) — wire the new pages' nav items. NOTE: Sidebar Settings NavItem still unwired (no `to`) — wiring it could fold here. Single-writer Sidebar.tsx + routes/index.tsx.

## Open Questions (RESOLVED inline)
1. **Defer (SYS-01)?** → no backend; ship Approve/Reject only (bulk via BulkActionBar A/R chips + Shift+Click). Drop Defer or make it a client no-op label. Document.
2. **Sync-history (SYS-03)?** → online-only vestigial; honest empty-state page, no fabricated data, no `/sync/delta` consumption. Flag as roadmap de-scope candidate.
3. **Imports page vs DataStoragePage?** → DataStoragePage (Phase 12) keeps its workspace clear-cache/export/import; the new `/imports` page adds the import-history jobs table + per-entity export + CSV import surface. Share api, don't duplicate UI logic.
4. **Per-entity export** → use the SERVER `/export/{entity_type}?format=csv` download (real fidelity) for items/loans/inventory list-page export buttons, not a client re-serialize.
5. **Exact wishlist/declutter shapes** → planner reads the entity.go/handler.go files (status enums, score/grouping fields, envelopes) before writing TS types.

## Likely plan split (for planner — ~7-8 plans, 2-3 waves)
WAVE 1 (disjoint api/hooks/standalone): 
- A. pendingChanges approve/reject mutations + Approvals page (SYS-01, bulk).
- B. my-changes page (SYS-02, reuse my-pending-changes).
- C. wishlist api+hooks+page (WISH-01/02).
- D. declutter api+hooks+page + mark-used + CSV (DECL-01/02).
- E. imports api+hooks + Imports/Exports page (SYS-04, jobs table).
- F. sync-history page (SYS-03, empty-state).
- G. per-entity export buttons (items/loans/inventory list pages — these touch EXISTING list files = single-writer coordination; isolate per file).
WAVE 2 (single-writer wiring): routes/index.tsx (all new routes) + Sidebar.tsx (SYSTEM group nav items) — ONE wiring plan owns both.
SINGLE-WRITERS: routes/index.tsx, Sidebar.tsx (wiring plan). Per-entity export buttons touch ItemsListPage/LoansListPage/InventoryListPage — each is a single-writer; assign carefully (one plan per file or one export-buttons plan touching all three serially). Wave-1 plans must be disjoint.
