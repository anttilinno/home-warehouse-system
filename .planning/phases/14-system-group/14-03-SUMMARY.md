---
phase: 14-system-group
plan: 03
subsystem: ui
tags: [wishlist, react-query, react-hook-form, zod, retro-tabs, msw, frontend2]

# Dependency graph
requires:
  - phase: 04-retro-component-library
    provides: RetroTabs / RetroDialog / RetroConfirmDialog / RetroBadge / RetroEmptyState / retro form atoms
  - phase: 10b-money
    provides: formatCents null-safe cents→currency helper
provides:
  - wishlistApi (list?status / create / update / remove) over /workspaces/{ws}/wishlist*
  - useWishlist(status) list hook keyed ["wishlist", wsId, status]
  - useWishlistMutations (create/update/remove) invalidating the ["wishlist", wsId] prefix
  - WishlistFormDialog (RHF+zod create/edit + status transition, cents conversion, 409-calm)
  - WishlistPage (status tabs + table + CRUD), exported as `WishlistPage`
affects: [14-08, e2e-wishlist]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "?status= searchParam → RetroTabs value → useWishlist(status) (mirrors LoansListPage ?tab=)"
    - "RetroDialog-hosted RHF+zod form (modal variant of the CategoryFormDialog field idiom)"
    - "price major-unit ↔ CENTS conversion explicit at form submit/load boundary"

key-files:
  created:
    - frontend2/src/lib/api/wishlist.ts
    - frontend2/src/lib/api/wishlist.test.ts
    - frontend2/src/features/wishlist/hooks/useWishlist.ts
    - frontend2/src/features/wishlist/hooks/useWishlistMutations.ts
    - frontend2/src/features/wishlist/hooks/useWishlist.test.tsx
    - frontend2/src/features/wishlist/components/WishlistFormDialog.tsx
    - frontend2/src/features/wishlist/components/WishlistFormDialog.test.tsx
    - frontend2/src/features/wishlist/WishlistPage.tsx
    - frontend2/src/features/wishlist/WishlistPage.test.tsx
  modified: []

key-decisions:
  - "List envelope is paged { items, total } (NOT bare { items }) — matches wishlist/handler.go:253"
  - "Status field is shown in EDIT mode only; the create form defaults status:wanted into the POST body"
  - "Submit button labels are mode-specific (ADD ITEM / Save changes); tests bind to the real labels"
  - "url rendered as an http(s)-only anchor (rel=noopener) — javascript: scheme never passes through (T-14-09)"

patterns-established:
  - "Per-row destructive action routes through RetroConfirmDialog before the remove mutation"
  - "formatCents called with a guarded currency (?? undefined) so a null currency_code never white-screens"

requirements-completed: [WISH-01, WISH-02]

# Metrics
duration: ~25min
completed: 2026-06-13
---

# Phase 14 Plan 03: Wishlist (WISH-01/02) Summary

**The /wishlist surface: wanted/ordered/acquired RetroTabs over `?status=` plus a full RHF+zod CRUD dialog (create/edit/delete/transition) over the retro form atoms, with cents-safe pricing and a calm 409 path for illegal status transitions.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3 / 3
- **Files created:** 9
- **Commits:** 4 (3 task + 1 docs)

## Accomplishments

- **wishlistApi** (`frontend2/src/lib/api/wishlist.ts`): `list(ws, status?)` resolves the paged `{ items, total }` envelope and appends `?status=` only when a status is set; `create`/`update`/`remove` map to POST/PATCH/DELETE `/workspaces/{ws}/wishlist...`. Exposes `WishlistStatus`, `WishlistItem` (price_estimate doc-commented as CENTS), `WishlistCreate`, `WishlistUpdate` (adds `status` + `acquired_item_id`).
- **useWishlist(status)**: `useQuery` keyed `["wishlist", wsId, status ?? "all"]`, enabled on `wsId`, `retry:false`; returns `{ rows, total, isLoading, isError }`.
- **useWishlistMutations**: create/update/remove `useMutation`s, each `onSuccess` invalidating the `["wishlist", wsId]` PREFIX. The 409 `ErrInvalidStatusTransition` is **not** swallowed — react-query surfaces the `HttpError` to the form.
- **WishlistFormDialog**: `RetroDialog`-hosted RHF + zod form (`mode: create|edit`, optional `item`). zod: name 1–200, url ≤2000, price ≥0 (major unit), currency `^[A-Z]{3}$`/empty, priority 1–5, status enum. price converts major-unit ↔ CENTS (×100 submit, ÷100 load). On `HttpError.status === 409` it sets a calm `root` form error (`That status change isn't allowed.`).
- **WishlistPage** (exported `WishlistPage`): blue `Window` titled `WISHLIST — {workspace}`; `?status=` searchParam (default `wanted`) drives three `RetroTabs`; each tab's content is the same table bound to `useWishlist(status)`. Columns: Name (safe http(s) anchor) / Price (`formatCents`, guarded currency) / Priority / Status (`RetroBadge`). `⊕ ADD` + per-row Edit open the dialog; per-row Delete confirms via `RetroConfirmDialog` then `remove`. Empty tab → `RetroEmptyState`.

## Contract / selectors (for 14-08 wiring + the live E2E spec)

- Page export: `WishlistPage` from `frontend2/src/features/wishlist/WishlistPage.tsx` (no route registered here — that is Wave 2 / 14-08).
- Query keys: list `["wishlist", wsId, status]` (status one of `wanted|ordered|acquired|all`); mutations invalidate the `["wishlist", wsId]` prefix.
- API shape: `wishlistApi.list(ws, status?)` → `{ items, total }`; `create(ws, body)`, `update(ws, id, body)`, `remove(ws, id)`.
- Tabs are `role="tab"` named WANTED / ORDERED / ACQUIRED; the active tab drives `GET /api/workspaces/{ws}/wishlist?status=<tab>`.
- Submit buttons: create = `Add item`, edit = `Save changes`.

## Deviations from Plan

**None.** The plan was executed as written across all three tasks. The artifact list named the schema inline in `WishlistFormDialog.tsx` (no separate schema file) — that is how it was built. Test assertions bind to the actual mode-specific submit-button labels (`Add item` / `Save changes`) rather than a single generic `/save/i`, which is a test-authoring detail, not a behavior change.

## Threat mitigations applied

- **T-14-07** (status transition the server rejects): the dialog reads `HttpError.status === 409` and renders a calm form-level error; the mutation invalidate re-reads the list — no optimistic transition is assumed.
- **T-14-08** (null currency white-screen): `formatCents(row.price_estimate, row.currency_code ?? undefined)` — a null/absent `currency_code` falls back inside `formatCents` (EUR), never a `RangeError`. Covered by the null-currency page test.
- **T-14-09** (url XSS/scheme): the name anchor is gated by `safeHref` (http(s) prefix only; `javascript:` returns undefined → plain text), with `rel="noopener noreferrer" target="_blank"`.

## Verification

- `cd frontend2 && bun run lint:tsc` → clean (no errors).
- `bun run test src/lib/api/wishlist.test.ts src/features/wishlist` → **4 files / 18 tests passed**.

## Known Stubs

None. All data is wired to real endpoints; no placeholder/empty-source rendering. The route registration + sidebar entry are intentionally deferred to Wave 2 (14-08) per the plan's DISJOINT scope — that is wiring, not a stub.

## Self-Check: PASSED

All 9 created source files exist on disk; all 3 task commits (338b875b, 9cce5e83, 68092727) are present in the branch history.
