---
phase: 07b-inventory
plan: 04
subsystem: ui
tags: [react, tanstack-query, typescript, msw, vitest, inventory, expiring, routing, move]

# Dependency graph
requires:
  - phase: 07b-inventory
    plan: 01
    provides: "inventoryApi.expiring(wsId, days) → { items: ExpiringEntry[]; total }; ExpiringEntry type (YYYY-MM-DD date, expiration|warranty kind)"
  - phase: 07b-inventory
    plan: 02
    provides: "InventoryListPage with the onMove(entry) local-state seam, /inventory route, useInventoryQuery/Mutations"
  - phase: 07b-inventory
    plan: 03
    provides: "MoveDialog (props entry/locationOptions/containerOptions), usePickerOptions, InventoryFormPage (create at /inventory/new, edit at /inventory/:id/edit)"
provides:
  - "useExpiringQuery — ?days (7/30/90/365, default 30) drives query key [\"inventory\", wsId, \"expiring\", days] + inventoryApi.expiring; clamps invalid days to 30"
  - "ExpiringPage — /inventory/expiring butter Window with days selector, {n} count, client-computed near (butter) vs past (danger) When chips, date-asc sort, NOTHING EXPIRING empty state"
  - "InventoryListPage MOVE row action wired to MoveDialog (the onMove seam Plan 02 left)"
  - "Registered routes /inventory/new, /inventory/expiring, /inventory/:id/edit (literal-before-param, AP-1)"
affects: [07b-05 item-detail InventoryPanel (may reuse the expiring chip idiom), 07b sidebar Expiring entry if added later]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Client-side near/past classification: daysDelta = date − today (UTC date-only); ≥0 → butter `in {n}d`, <0 → danger `⚠ −{n}d`; the in/−/⚠ prefix is the non-color signal (R12)"
    - "Expiring query keyed UNDER the [\"inventory\", wsId, ...] prefix so the Phase 6 SSE prefix-invalidation covers it without an exact key"
    - "Per-target keyed dialog mount: MoveDialog mounts only while moveTarget is set, keyed by entry id so its useState seed re-initializes per entry"

key-files:
  created:
    - frontend2/src/features/inventory/hooks/useExpiringQuery.ts
    - frontend2/src/features/inventory/ExpiringPage.tsx
    - frontend2/src/features/inventory/ExpiringPage.test.tsx
  modified:
    - frontend2/src/features/inventory/InventoryListPage.tsx
    - frontend2/src/features/inventory/InventoryListPage.test.tsx
    - frontend2/src/routes/index.tsx

key-decisions:
  - "When chip is a plain styled span (bg-titlebar-butter / bg-danger-bg), not RetroBadge — RetroBadge has no butter variant and always renders ink text, whereas the past chip needs text-danger"
  - "daysDelta computed in UTC date-only (Date.UTC of the YYYY-MM-DD parts vs today's UTC date) so a clock/timezone offset never flips a same-day entry between near and past"
  - "MoveDialog mounted per-target and keyed by entry.id (rather than always-mounted with open toggling) so its entry-seeded useState reinitializes cleanly for each MOVE"
  - "Expiring rows sorted by date ascending via lexical compare on the zero-padded YYYY-MM-DD strings (order-correct, no Date allocation per comparison)"

patterns-established:
  - "Pattern 1: non-color-only state signal — color (butter/danger) is paired with a textual prefix (in / −) + glyph (⚠) so the near/past distinction survives for color-blind users"
  - "Pattern 2: URL-param-driven projection query — a single ?days key drives both the query key and the backend param, clamped to an allow-list with a safe default"

requirements-completed: [INV-06]

# Metrics
duration: ~12min
completed: 2026-06-13
---

# Phase 07b Plan 04: Expiring View + Route Registration + MoveDialog Wiring Summary

**The /inventory/expiring attention surface (a butter Window listing expiry/warranty entries with a days-window selector and client-computed near-butter vs past-danger When chips whose in/−/⚠ prefix carries the signal without relying on color), plus the create/edit/expiring route registrations and the live MOVE → MoveDialog wiring on the inventory list.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-06-13T10:08Z
- **Completed:** 2026-06-13T10:20Z
- **Tasks:** 2 (both TDD: RED test → GREEN impl)
- **Files:** 6 (3 created, 3 modified)

## Accomplishments
- `useExpiringQuery` reads `?days` (one of 7/30/90/365, invalid → 30), keys `["inventory", wsId, "expiring", days]` (under the inventory prefix so SSE invalidation covers it), calls `inventoryApi.expiring(wsId, days)`, enabled only with a workspace, retry:false.
- `ExpiringPage` renders a butter `EXPIRING SOON` Window: a header strip with a `Window` RetroSelect (7/30/90/365 → `?days`) + a mono `{n} expiring` count, then a 5-column RetroTable (Item / Qty / Kind / Date / When). Rows sort by `date` ascending (most-overdue first). Row click → `/items/{item_id}`. Kind renders a neutral `WARRANTY`/`EXPIRY` badge. The When chip is client-computed: butter `in {n}d` for `daysDelta ≥ 0` (`in 0d` = today), danger `⚠ −{n}d` for `daysDelta < 0`. Empty → `NOTHING EXPIRING` state with the active window in the body + a `← BACK TO INVENTORY` action.
- `InventoryListPage` MOVE action now opens the real `MoveDialog`: the `onMove(entry)` seam Plan 02 left now stores the full `Inventory` target; the dialog mounts keyed by entry id with location/container options from `usePickerOptions`, and closes on cancel/success (the dialog owns its own invalidation of both `["inventory"]` and `["movements"]`).
- `routes/index.tsx` registers `inventory/new`, `inventory/expiring`, and `inventory/:id/edit` — the two literals BEFORE the `:id` param route (AP-1 library mode) so "new"/"expiring" never parse as an id.

## Task Commits

1. **Task 1: useExpiringQuery + ExpiringPage** — `343ad9bd` (feat)
2. **Task 2: wire MoveDialog into the list + register routes** — `49e76443` (feat)

## Files Created/Modified
- `frontend2/src/features/inventory/hooks/useExpiringQuery.ts` — ?days-driven expiring query under the inventory prefix
- `frontend2/src/features/inventory/ExpiringPage.tsx` — the /inventory/expiring view with near/past When chips
- `frontend2/src/features/inventory/ExpiringPage.test.tsx` — future+past rows, non-color signal, date-asc sort, days param, empty state, row nav
- `frontend2/src/features/inventory/InventoryListPage.tsx` — MOVE → MoveDialog wiring via usePickerOptions
- `frontend2/src/features/inventory/InventoryListPage.test.tsx` — MOVE-opens-dialog test + picker seed helper
- `frontend2/src/routes/index.tsx` — registered inventory/new + inventory/expiring + inventory/:id/edit (literal-before-param)

## Decisions Made
- The When chip is a styled span, not a RetroBadge — RetroBadge has no butter variant and forces ink text, but the past chip needs `text-danger`. The styling mirrors the chip envelope (rounded-chip, ink border, mono tabular-nums).
- `daysDelta` is computed in UTC date-only (Date.UTC over the YYYY-MM-DD parts vs today's UTC date) so a timezone/clock offset can never flip a same-day entry between the near and past treatments.
- MoveDialog mounts per-target and is keyed by `entry.id` so its entry-seeded `useState` (target location/container) reinitializes for each MOVE rather than retaining the prior entry's selection.

## Deviations from Plan

None of substance.

- The plan's Task 1 `<action>` named a butter chip and a danger chip via the atoms; RetroBadge cannot express the danger chip (no butter variant + always-ink text), so the chips are plain styled spans matching the chip chrome. This is the UI-SPEC §5 treatment verbatim (`bg-titlebar-butter ink` / `bg-danger-bg text-danger`), not a scope change — recorded for transparency.
- The Task 1 empty-state test assertion was scoped to the full body sentence (`/expiring or out of warranty in the next 30 days/i`) rather than a bare `/30 days/i`, because the latter also matches the `30 days` select option text. Test-authoring tightening, no source impact.

## Known Stubs
None. The expiring view binds to the real `inventoryApi.expiring` read; the MoveDialog wiring uses the real `usePickerOptions` reads and the real move mutation. The Location column on the main list still renders muted `—` (no locations list endpoint join on the list — R7, inherited from Plan 02, out of this plan's scope).

## Threat Flags
None. No new network surface: the expiring read is `inventoryApi.expiring` (Plan 01, workspace-scoped, backend clamps days 1..365 — T-07b-09); the move write and the picker reads are all from Plan 01/03 and workspace-scoped server-side (T-07b-10). The edit route loads its entry via the workspace-scoped get; a cross-tenant id 404s server-side.

## Issues Encountered
- The worktree's `node_modules` was incomplete (vitest absent) despite the directory existing; a `bun install --frozen-lockfile` populated it (zero new packages, lockfile unchanged). An accidental `bunx vitest` had mutated `bun.lock` once — reverted before the frozen install, so the committed lockfile is untouched. Tests run via `./node_modules/.bin/vitest` / `./node_modules/.bin/tsc` because the sandbox PATH lacks the bins and the `test` npm script calls a bare `vitest`.

## Next Phase Readiness
- A Sidebar "Expiring" entry (or a list-toolbar `EXPIRING ▸` link) can now point at `/inventory/expiring` — the route resolves. UI-SPEC §5 left the navigation anchor to the planner; none was added this plan (no requirement).
- 07b-05 (item-detail InventoryPanel) may reuse the near/past When-chip idiom for per-entry expiry display.
- No STATE.md / ROADMAP.md / vite.config.ts / api.ts / backend changes were made (orchestrator owns those writes; the parallel 07b-05 ItemDetailPage territory was untouched).

## Self-Check: PASSED

All 3 created + 3 modified source/test files present on disk; both task commits (343ad9bd, 49e76443) found in git log. Full vitest suite 562/562 green, `tsc -b --noEmit` clean, `lint:imports` clean, `grep -c 'path="inventory/expiring"' src/routes/index.tsx` = 1.

---
*Phase: 07b-inventory*
*Completed: 2026-06-13*
