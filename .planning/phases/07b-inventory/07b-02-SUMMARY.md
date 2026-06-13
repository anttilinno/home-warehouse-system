---
phase: 07b-inventory
plan: 02
subsystem: ui
tags: [react, tanstack-query, typescript, msw, vitest, inventory, movements, inline-edit]

# Dependency graph
requires:
  - phase: 07b-inventory
    provides: "Plan 01 — inventoryApi/movementsApi typed boundaries, Condition/InventoryStatus → StatusPill variant+label maps, MSW inventory+movement route set"
  - phase: 07-items
    provides: "ItemsListPage density + URL-driven pager pattern, useItemsQuery/usePhotoMutations optimistic-reorder pattern, FilterBar/RetroTable/StatusPill atoms, useShortcuts SSOT"
provides:
  - "useInventoryQuery — ?page-only URL-state list query keyed [\"inventory\", wsId, params] (limit 25, no server facets — R1)"
  - "useInventoryMutations — optimistic qty/status/condition inline edits with snapshot+revert-on-error, archive/restore (prefix invalidation)"
  - "useMovementsQuery — per-entry history keyed [\"movements\", wsId, \"inventory\", invId]"
  - "InlineEditCell — click-to-edit qty/status/condition cell, Enter/blur commit, ESC field-local revert (no modal stack), invalid-qty gate"
  - "MovementsPanel + MovementsDrawer — mono from→to history list + blue RetroDialog, NO MOVEMENTS empty state"
  - "InventoryListPage — /inventory list with client filters/sort, inline edits, movements drawer, MOVE seam for Plan 04"
  - "Sidebar Inventory entry enabled + /inventory route registered"
affects: [07b-03 create/move form, 07b-04 expiring page + MoveDialog route wiring, item-detail InventoryPanel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Client-side filter/sort over the loaded page (the list endpoint has NO server facet params — R1); only ?page round-trips"
    - "Optimistic field-edit via getQueriesData snapshot + setQueriesData patch across ALL [\"inventory\", wsId] queries; onError restores the snapshot; onSettled re-invalidates so the server value is authoritative (T-07b-03)"
    - "Item-name client join via a sibling [\"items\", wsId, {limit}] query; unresolved labels render muted — (R7, no locations endpoint yet)"

key-files:
  created:
    - frontend2/src/features/inventory/hooks/useInventoryQuery.ts
    - frontend2/src/features/inventory/hooks/useInventoryMutations.ts
    - frontend2/src/features/inventory/hooks/useMovementsQuery.ts
    - frontend2/src/features/inventory/components/InlineEditCell.tsx
    - frontend2/src/features/inventory/components/MovementsPanel.tsx
    - frontend2/src/features/inventory/components/MovementsDrawer.tsx
    - frontend2/src/features/inventory/InventoryListPage.tsx
  modified:
    - frontend2/src/components/layout/Sidebar.tsx
    - frontend2/src/routes/index.tsx

key-decisions:
  - "InlineEditCell ESC is a field-local onKeyDown that stopPropagation()s — it NEVER pops useModalStack (R9, the cell is not a modal surface)"
  - "MOVE is an onMove(entry) local-state seam (setMoveTargetId) — Plan 04 connects it to MoveDialog; kept out to keep this plan import-independent of 07b-03"
  - "Condition edit rides the full PATCH bundled with the entry's current location_id + quantity (Pitfall 6 — no condition-only endpoint)"
  - "Glyph ⬚ for the Sidebar Inventory entry (▦ Dashboard / ▣ Items / ▢ Locations / ▥ Containers / ◇ Categories / ↧ Loans / ☺ Borrowers all taken)"

patterns-established:
  - "Pattern 1: inventory list filters/sort live in COMPONENT state (R1); the URL carries only ?page"
  - "Pattern 2: snapshot-every-query optimistic patch (getQueriesData/setQueriesData over the prefix) so any cached page reverts cleanly on a 4xx"

requirements-completed: [INV-01, INV-05, INV-07]

# Metrics
duration: 14min
completed: 2026-06-13
---

# Phase 07b Plan 02: Inventory List + Inline Edit + Movements Drawer Summary

**The /inventory management surface — a client-filterable/sortable paginated RetroTable with status+condition StatusPills, optimistic-with-revert inline qty/status/condition cell editing, a per-entry movements drawer, the enabled Sidebar Inventory entry, and the registered route.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-06-13T09:56Z
- **Completed:** 2026-06-13T10:10Z
- **Tasks:** 3 (all TDD)
- **Files modified:** 9 (7 created, 2 modified) + 4 test files

## Accomplishments
- `useInventoryQuery` reads only `?page` from the URL (R1 — inventory has no server facet params), keyed `["inventory", wsId, params]`, limit 25, enabled only with a workspace, retry:false.
- `useInventoryMutations` gives qty/status/condition optimistic edits: `onMutate` snapshots every `["inventory", wsId]` query and patches the matching entry, `onError` restores the snapshot + fires a persistent `retroToast.error`, `onSettled` invalidates the prefix. A 4xx reverts the cached value (proven in the hook test). Condition rides the full PATCH bundled with the current location_id + quantity. Archive/restore invalidate on success.
- `InlineEditCell` swaps a rest-state value (mono qty / StatusPill for status+condition) for a RetroInput/RetroSelect on click or Enter/Space; commits on blur OR Enter; ESC reverts field-locally (stopPropagation, never the modal stack — R9); empty/negative qty is blocked.
- `MovementsPanel` renders mono `{ts} {from} → {to} ×{qty} {who}` rows (null from → `— → {to}`, unresolved mover → `Unknown`) and the `NO MOVEMENTS` empty state; `MovementsDrawer` wraps it in a blue RetroDialog fed by `useMovementsQuery`.
- `InventoryListPage` mirrors ItemsListPage: mint `INVENTORY — {workspace}` Window, FilterBar with STATUS/CONDITION/ARCHIVED facets filtering CLIENT-side over the loaded page, client header sort on Qty/Status/Condition, item-name join from a sibling items query, inline-edit cells wired to the stable `.mutate` fns, a `↧` movements affordance, EDIT/ARCHIVE/RESTORE actions, a MOVE seam, and RetroPagination.
- Sidebar INVENTORY group now has an enabled `Inventory → /inventory` NavItem (glyph ⬚); the `/inventory` route is registered (literal, before any param route).

## Task Commits

Each task was committed atomically (TDD tasks captured test+impl in one commit per task):

1. **Task 1: query/mutations/movements hooks** - `7146b2a7` (feat)
2. **Task 2: InlineEditCell + MovementsPanel/Drawer** - `9fba2627` (feat)
3. **Task 3: InventoryListPage + Sidebar entry + /inventory route** - `15536a98` (feat)

## Files Created/Modified
- `frontend2/src/features/inventory/hooks/useInventoryQuery.ts` - ?page-only URL state + list query
- `frontend2/src/features/inventory/hooks/useInventoryMutations.ts` - optimistic qty/status/condition + archive/restore
- `frontend2/src/features/inventory/hooks/useMovementsQuery.ts` - per-entry movement history query
- `frontend2/src/features/inventory/components/InlineEditCell.tsx` - click-to-edit cell with field-local ESC
- `frontend2/src/features/inventory/components/MovementsPanel.tsx` - mono history list + empty state
- `frontend2/src/features/inventory/components/MovementsDrawer.tsx` - blue dialog over the panel
- `frontend2/src/features/inventory/InventoryListPage.tsx` - the /inventory list surface
- `frontend2/src/components/layout/Sidebar.tsx` - enabled Inventory NavItem (⬚)
- `frontend2/src/routes/index.tsx` - registered /inventory route

## Decisions Made
- InlineEditCell ESC is field-local (R9), never the modal stack — verified by the ESC-reverts-without-onCommit test.
- MOVE is a local `onMove(entry)` state seam, not a cross-plan import of 07b-03's MoveDialog, so this plan stays independently buildable.
- Item names join from a sibling `["items", wsId, {limit:200}]` query; location labels have no list endpoint this phase, so they render muted `—` (R7, sanctioned by UI-SPEC §1).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Sidebar group-label test broke from the new NavItem**
- **Found during:** Task 3 (Sidebar entry)
- **Issue:** Adding the `Inventory → /inventory` NavItem produced a second "Inventory" text node, so `Sidebar.test.tsx`'s `getByText("Inventory")` group-label assertion became ambiguous (found multiple elements) and failed.
- **Fix:** Re-targeted the three group-label assertions to `getByRole("heading", { name })` so they match the `<h3>` group headings unambiguously — the test's actual intent.
- **Files modified:** frontend2/src/components/layout/Sidebar.test.tsx
- **Verification:** Sidebar.test.tsx 8/8 green; full suite 525/525 green.
- **Committed in:** `15536a98` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — a test broken by an in-scope source change).
**Impact on plan:** The fix corrected a test made ambiguous by this plan's own Sidebar change; the assertion's intent (group headings render) is preserved. No scope creep.

## Issues Encountered
- A `bun install --frozen-lockfile` was needed to populate the worktree's absent `node_modules` (environment setup per the parallel-execution note; zero new packages). `vitest`/`tsc` are invoked via `bun run` / `bunx` because the sandbox PATH lacks the local bins directly.
- Two MovementsPanel test assertions initially failed because the `→` arrow (aria-hidden span) and `×{qty}` split the row text across DOM nodes — switched those assertions to read the row's `textContent` rather than a single text node. Test-only fix, no component change.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 04 can connect a MoveDialog to the `onMove(entry)` seam in InventoryListPage (currently a no-op state setter) and add the `/inventory/new` + `/inventory/:id/edit` routes (07b-03 ships the form; 07b-04 wires the routes — no conflict, the list already navigates to `/inventory/{id}/edit` and `/inventory/new`).
- `useInventoryMutations.updateCondition` already bundles location_id+quantity; the move flow should invalidate BOTH `["inventory", wsId]` and `["movements", wsId]` (movements have no SSE) when it lands.
- No STATE.md / ROADMAP.md / vite.config.ts / api.ts / backend changes were made (orchestrator owns those writes; parallel plan 07b-03 territory untouched).

## Self-Check: PASSED

All 9 created+modified source files and 4 test files present on disk; all 3 task commits (7146b2a7, 9fba2627, 15536a98) found in git log. Full vitest suite 525/525 green, tsc -b --noEmit clean, lint:imports clean, Sidebar `to="/inventory"` grep gate = 1.

---
*Phase: 07b-inventory*
*Completed: 2026-06-13*
