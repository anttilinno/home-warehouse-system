---
phase: 07-items-photos
plan: 03
subsystem: frontend-items-list
tags: [items, list, filters, pagination, bulk, shortcuts, url-state, retro-os]
requires:
  - "07-01: itemsApi.list/archive/restore/del + photosApi.exportCsv + MSW handlers"
  - "Phase 4 retro atoms (FilterBar/FilterPopover/SavedFilters/RetroTable/RetroPagination/useTableSelection/BulkActionBar/RetroEmptyState/RetroConfirmDialog/StatusPill)"
  - "Phase 3 chrome (ShortcutsProvider SSOT, ModalStackProvider, AppShell)"
  - "Phase 6 SSE invalidation contract (['items', wsId] prefix)"
provides:
  - "useItemsQuery — URL-param-driven items query keyed ['items', wsId, params]"
  - "useItemMutations — archive/restore/del invalidating the ['items', wsId] prefix"
  - "ItemsListPage — the /items density surface (list window)"
  - "/items route registered + Sidebar Items entry enabled"
affects:
  - "Plans 05/06 append /items/new, /items/:id, /items/:id/edit routes in Wave 3"
  - "Sidebar Items NavLink now active (was disabled)"
tech-stack:
  added: []
  patterns:
    - "URL-driven list state via react-router useSearchParams (Pattern 1) — every filter/sort/page in ?q&category&archived&sort&sort_dir&page; deep-linkable"
    - "shortcut-binding memos depend on STABLE refs only (t via useRef, RQ mutate fns destructured) — avoids infinite re-register loop (Pitfall 3)"
    - "bulk actions registered into the Phase 3 shortcuts SSOT while a selection exists → desktop Bottombar chips (no second desktop bar); mobile renders BulkActionBar"
key-files:
  created:
    - frontend2/src/features/items/hooks/useItemsQuery.ts
    - frontend2/src/features/items/hooks/useItemsQuery.test.tsx
    - frontend2/src/features/items/hooks/useItemMutations.ts
    - frontend2/src/features/items/hooks/useItemMutations.test.tsx
    - frontend2/src/features/items/ItemsListPage.tsx
    - frontend2/src/features/items/ItemsListPage.test.tsx
  modified:
    - frontend2/src/routes/index.tsx
    - frontend2/src/components/layout/Sidebar.tsx
decisions:
  - "Sort headers are Name + SKU (the backend-sortable fields the wire ItemResponse carries); Category/Location/Qty/Status are display columns with a '—' placeholder where the wire shape lacks the field"
  - "ARCHIVED facet is a single-option FilterPopover checklist ('Show archived') mapping to ?archived=true — reusing the shipped multi-select atom rather than inventing a toggle"
  - "useLingui t and RQ mutation objects are NOT referentially stable — read t through a ref and destructure the stable .mutate fns so the useShortcuts registration effect doesn't loop"
metrics:
  duration: ~75m
  completed: 2026-06-13
requirements: [ITEM-01, ITEM-05, ITEM-06, ITEM-10]
---

# Phase 7 Plan 03: Items List Page Summary

The `/items` density surface (sketch 008): a mint Window composing the shipped
Phase 4 atoms into a URL-driven, filterable/sortable/paginated items table with
archived lifecycle, bulk archive/delete (archived-only delete), CSV export, and
`useShortcuts("items", [N,/,F])` — plus the URL-param query/mutation hooks that
back it and the route + Sidebar wiring that surfaces it.

## What Was Built

**Task 1 — useItemsQuery + useItemMutations** (`13889831`)
- `useItemsQuery`: reads `?q/category/archived/sort/sort_dir/page` from
  `useSearchParams`, keys `["items", wsId, params]` (Phase 6 prefix contract —
  the test asserts the first two segments are exactly `["items", wsId]`), fixes
  `limit` at 25, omits `archived` unless the facet is on, `enabled:!!wsId`.
  Exports `ITEMS_LIMIT`, `readItemsUrlState`, `toListParams` for the page.
- `useItemMutations`: `archive`/`restore`/`del` each call `itemsApi` then
  `invalidateQueries({ queryKey: ["items", wsId] })` — prefix-match, NO
  `exact:true` (covers list + detail). `del` defensively rejects a non-archived
  id before the network call (ITEM-06); errors raise a non-auto `retroToast.error`.
- 10 MSW + QueryClient harness tests.

**Task 2 — ItemsListPage** (`288a1eba`)
- Mint `Window` `ITEMS — {workspace}` (`bodyClassName=""`, flush) with an
  `⤓ EXPORT` titlebar action. Body: `SavedFilters` row (above the FilterBar in
  the same panel-2 region) → `FilterBar` (search→?q, CATEGORY▾ + ARCHIVED▾
  facets, `{n} items` count, `⊕ ADD ITEM` mint CTA, active-filter chips) →
  `RetroTable` (select / 26×26 thumb / Name / SKU / Location / Qty / Status /
  actions) → `RetroPagination` (server-driven, `page {n} of {m} · 25 / page`).
- URL-driven: any filter/sort change resets `?page=1`; sort headers toggle
  `?sort`/`?sort_dir` with ↑/↓ glyphs; deep-links restore on mount. Row click →
  `/items/{id}` (checkbox + action cells `stopPropagation`).
- Archived hidden by default; ARCHIVED facet reveals; archived rows dim +
  `ARCHIVED` badge + RESTORE / DELETE… (type-to-confirm via RetroConfirmDialog,
  confirm disabled until the exact item name is typed — ITEM-06).
- `useTableSelection` drives bulk; while a selection exists it registers
  ARCHIVE/DELETE into the shortcuts SSOT (desktop Bottombar chips); mobile path
  renders `BulkActionBar`. Bulk DELETE gated on an all-archived selection
  (T-07-07) with a hint toast otherwise.
- CSV export → `photosApi.exportCsv(wsId)`. `useShortcuts("items", [N→/items/new,
  /→focus search, F→toggle Archived])` memoized on stable deps. Empty +
  filtered-empty states per UI-SPEC.
- 12 MSW tests (render, search→?q+page reset, ARCHIVED reveal, both sort-header
  paths, deep-link page restore, row→detail nav, N//F registration,
  archived-only bulk delete, CSV export, empty + filtered-empty).

**Task 3 — route + Sidebar** (`0f971732`)
- `routes/index.tsx`: `<Route path="items" element={<ItemsListPage/>} />` under
  the authenticated AppShell, before the wildcard (AP-1). Detail/create/edit
  routes deferred to Plans 05/06 (Wave 3) to avoid a route-file conflict.
- `Sidebar.tsx`: INVENTORY-group Items NavItem gets `to="/items"` → live NavLink
  (was disabled); `count={stats?.total_items}` binding intact.

## Deviations from Plan

### Backend data gap (Rule 3 — adapt to the shipped wire contract)

**1. [Rule 3 - Blocking] Item list columns degrade to the wire ItemResponse shape**
- **Found during:** Task 2.
- **Issue:** The UI-SPEC sketch-008 column set is Name / Category / Location /
  Qty / Status, but the shipped `Item` type (`lib/types.ts`, locked by Plan
  07-01) carries only `category_id` (a UUID, no name) and has NO `location`,
  `quantity`, or derived stock-status field. The MSW `ITEM` fixture confirms
  this (no category/location/qty/status keys).
- **Fix:** Render the full column structure per the sketch density, but the
  unbacked cells (Category-name / Location / Qty) show a `—` placeholder and
  Status shows a neutral `IN STOCK` pill (or the `ARCHIVED` badge for archived
  rows). Name + SKU are the live sortable columns (the two backend-sortable
  fields the wire shape exposes). No raw UUID is shown.
- **Why honest:** the contract-bound behaviors (URL state, filtering, sorting,
  pagination, archived lifecycle, bulk, export, shortcuts) are all fully wired
  and tested; only the three display-only cells lack a data source. See Known
  Stubs.
- **Files:** `ItemsListPage.tsx`. **Commit:** `288a1eba`.

### Auto-fixed (Rule 1 — render-loop bug found + fixed during Task 2)

**2. [Rule 1 - Bug] Infinite re-register loop in the shortcuts effect**
- **Found during:** Task 2 (the test suite hung — synchronous re-render loop
  blocked vitest's per-test timeout).
- **Issue:** The `useShortcuts` registration effect re-fires whenever its
  `bindings` array changes identity. The route/bulk binding memos depended on
  `useLingui()`'s `t` and on the `useMutation` wrapper objects — both of which
  get a NEW identity every render — so every render rebuilt the bindings,
  re-registered into the SSOT (`setGroups` → re-render), and looped forever.
- **Fix:** read `t` through a `useRef` inside the binding closures (drop it from
  the deps) and destructure the STABLE `.mutate` fns (`archiveItem`/`restoreItem`/
  `deleteItem`) rather than depending on the wrapper objects. The shipped
  DemoPage omits `t` from its bulk-action memo for the same reason.
- **Files:** `ItemsListPage.tsx`. **Commit:** `288a1eba`.

### Test assertion correction

**3. [Rule 1 - Test] Sort-header test asserted the wrong URL for the default column**
- The default sort is `name`, so clicking the Name header toggles `?sort_dir`
  (it does not re-emit `sort=name`). Split into two tests: clicking a
  non-default header (SKU) sets `?sort=sku`; clicking the active header (Name)
  toggles `?sort_dir=desc`. **Commit:** `288a1eba`.

## Authentication Gates

None.

## Verification

- `cd frontend2 && bun run test src/features/items/hooks/` → 10 passed.
- `cd frontend2 && bun run test src/features/items/ItemsListPage.test.tsx` → 12 passed.
- Full suite: `vitest run` → **60 files, 412 tests passed**.
- `tsc -b --noEmit` → clean (exit 0).
- `node ../scripts/check-forbidden-imports.mjs src` → OK.

## Known Stubs

| Stub | File | Reason / resolution |
|------|------|---------------------|
| Category-name / Location / Qty cells render `—` | `ItemsListPage.tsx` (table body) | The wire `ItemResponse` (Plan 07-01 `lib/types.ts`) does not carry a category NAME, a location path, or a quantity. The columns exist per the sketch-008 density; the cells degrade gracefully. Resolution: when the detail/inventory wire contract (7b) surfaces these fields, the cells bind to them — no structural change needed. |
| Status pill is `IN STOCK` for all non-archived rows | `ItemsListPage.tsx` (Status column) | No derived stock-status field on the list envelope. The archived path (ARCHIVED badge) IS data-driven (`is_archived`); the in-stock/low/out distinction needs the inventory wire (7b). |

These stubs do NOT block the plan's goal: ITEM-01/05/06/10 (browse, filter,
sort, deep-link, archive/restore, type-to-confirm delete, shortcuts) are all
fully wired against real data and tested. Only three display-only cells await a
richer wire contract.

## Threat Flags

None — no new network endpoints, auth paths, or trust-boundary surface beyond
the plan's threat model. T-07-07 (bulk-delete on a non-archived selection) is
mitigated as specified: DELETE is disabled + hint-toasted unless every selected
id is archived, AND the `useItemMutations.del` hook rejects a non-archived id
defensively; backend stays authoritative.

## Scope Confirmation

Files changed are confined to plan territory: `features/items/**`,
`routes/index.tsx`, `Sidebar.tsx`. No PhotoUpload/PhotoGallery/PhotoLightbox
(Plan 07-04 territory), no STATE.md/ROADMAP.md, no vite.config.ts touched.

## Self-Check: PASSED
