# Phase 14 — VALIDATION (done-criteria)

Confirmed (orchestrator-verified 2026-06-13):
- Approvals: `/pending-changes` (envelope `changes`, owner/admin 403-gated), `/{id}/approve`, `/{id}/reject` (NO defer), `/my-pending-changes`. Frontend `pendingChanges.ts` + approvals hook/panel exist (Phase 13) — EXTEND.
- Imports/Exports: `/import/{entity}` + `/import/workspace` (format csv|json body); `/export/{entity}` + `/export/workspace` (?format, binary download Content-Disposition); `/imports/jobs` + `/{id}` + `/{id}/errors` (history). DataStoragePage already does workspace export/import.
- Sync: only `/sync/delta` (data pull) — NO event-history log; v3.0 online-only.
- Wishlist: `/wishlist` (+?status), `/wishlist/{id}` CRUD. Declutter: `/declutter`, `/declutter/counts`, `/inventory/{id}/mark-used`.
- Reuse: useTableSelection + BulkActionBar (bulk), RetroTable/RetroTabs, useShortcuts, loanCsv.ts pattern, money.ts.

Per-requirement done criteria:
- **SYS-01** — `/approvals` page: paginated activity-table of pending changes; Shift+Click multi-select (useTableSelection); BulkActionBar Approve/Reject chips firing `/pending-changes/{id}/approve|reject` (bulk = iterate selected); `useShortcuts("approvals", A→approve, R→reject)`. Defer: omitted (no backend) — documented. Owner/admin 403 → calm guard. Unit test: rows, select, bulk approve invalidates list.
- **SYS-02** — `/my-changes` page: lists caller's mutations from `/my-pending-changes` (activity-table). Unit test: rows render.
- **SYS-03** — `/sync-history` page: honest empty/informational state (online-only — no events). NO fabricated data, NO `/sync/delta` consumption. Unit test: page renders the informational state.
- **SYS-04** — `/imports` page: CSV import (POST /import/...) + import-history jobs table (`/imports/jobs`) + workspace export; activity-table pattern. Share logic with DataStoragePage, don't duplicate. Unit test: jobs table renders, import action wired.
- **WISH-01** — `/wishlist` page with wanted/ordered/acquired status tabs (RetroTabs over `?status=`). **WISH-02** — add/edit/delete wishlist items + status transition (RHF+zod form, mutations invalidate). Unit tests: tabs filter, CRUD + transition.
- **DECL-01** — `/declutter` page: unused-items analysis + score badge + grouping from `/declutter`. **DECL-02** — CSV export (client, loanCsv pattern) + mark-used (`POST /inventory/{id}/mark-used`). Unit tests: list+score render, mark-used invalidates, CSV builds.
- **Per-entity export** (parity §4) — export buttons on items/loans/inventory list pages hitting server `/export/{entity}?format=csv` download.
- **Wiring** — new routes in routes/index.tsx + SYSTEM-group nav items in Sidebar.tsx (+ optionally wire the still-disabled Settings nav).

Gate (phase): `bun run lint:tsc && bun run test && bun run build && bun run lint:imports` green (lint:tsc = `tsc -b`, NOT bare tsc — landmine); live E2E (navigate /approvals + /wishlist render); gsd-verifier PASS. lint:imports must stay green (no `sync*` import — FOUND-02; the sync-history page must NOT import any sync engine, just render static copy).

Landmines: render-loop on shortcut/hook deps; backend list `limit` caps 100; bare-tsc silent-pass; money null-currency white-screen; bulk actions = iterate (no bulk endpoint) — handle partial failures. Large phase: keep Wave-1 plans strictly disjoint; routes/index.tsx + Sidebar.tsx single-writer in the wiring plan; per-entity export buttons touch existing list files (single-writer each).
