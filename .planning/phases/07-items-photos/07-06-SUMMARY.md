---
phase: 07-items-photos
plan: 06
subsystem: ui
tags: [react, react-router, tanstack-query, retro-os, items, photos, loans, labels]

# Dependency graph
requires:
  - phase: 07-items-photos (Plan 01)
    provides: itemsApi.get/archive/restore/del, loansApi.byItem partition, labelsApi attach/detach, typed Item/Loan/Photo/Label
  - phase: 07-items-photos (Plan 03)
    provides: /items list route (untouched here) + the list page navigation targets
  - phase: 07-items-photos (Plan 04)
    provides: PhotoGallery / PhotoLightbox / PhotoUpload prop-driven components
  - phase: 07-items-photos (Plan 05)
    provides: ItemFormPage (named export) for /items/new + /items/:id/edit
provides:
  - ItemDetailPage (/items/:id) — mint Window, DETAILS/PHOTOS/HISTORY tabs, persistent side rail
  - LoanPanels (ActiveLoanPanel + LoanHistoryList + useItemLoans) — read-only, partitioned on is_active
  - ItemLabels — attach/detach existing workspace labels via checklist popover
  - InventoryPanelStub — real named 7b slot ("Stock entries arrive in 7b.")
  - Route registration for /items/new, /items/:id, /items/:id/edit (literal-before-param)
affects: [07-07 (e2e/docs), 7b (inventory/stock — swaps the stub slot), 08 (loans CRUD — the disabled RETURN), 10 (label management), 11 (scan)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Render-loop guard: read lingui `t` through a live ref in mutation/effect closures; destructure stable `.mutate` from RQ mutation objects"
    - "404 vs load-error split: HttpError(404) → not-found empty state; any other error → error state + persistent toast"
    - "Popover role=menu for titlebar overflow + label-attach checklist (no new atom)"
    - "Persistent side-rail slot pattern: InventoryPanelStub is a real region so 7b swaps body without relayout"

key-files:
  created:
    - frontend2/src/features/items/ItemDetailPage.tsx
    - frontend2/src/features/items/ItemDetailPage.test.tsx
    - frontend2/src/features/items/components/LoanPanels.tsx
    - frontend2/src/features/items/components/LoanPanels.test.tsx
    - frontend2/src/features/items/components/ItemLabels.tsx
    - frontend2/src/features/items/components/ItemLabels.test.tsx
    - frontend2/src/features/items/components/InventoryPanelStub.tsx
  modified:
    - frontend2/src/routes/index.tsx

key-decisions:
  - "Detail load 404 routes to ITEM NOT FOUND (not the generic load-error state) by inspecting HttpError.status — the API layer throws on 404 rather than resolving null"
  - "Titlebar overflow + label-attach reuse the shipped Popover (role=menu/listbox) — no new atom invented (CONTEXT locked)"
  - "useItemLoans is exported from LoanPanels so the detail HISTORY tab and the side-rail active panel share one query key [loans, wsId, by-item, itemId]"

patterns-established:
  - "Pattern: navigation assertions in tests target the destination route's rendered text, not a useLocation probe (the probe only lives under the source route)"

requirements-completed: [ITEM-02]

# Metrics
duration: ~35min
completed: 2026-06-13
---

# Phase 7 Plan 06: Item Detail Page + Route Registration Summary

**Item detail page (`/items/:id`) — mint Window with DETAILS/PHOTOS/HISTORY tabs, a persistent side rail (active-loan panel + 7b inventory stub), labels attach/detach, archive/restore/delete lifecycle, the Plan-04 photo gallery/lightbox/upload, plus literal-before-param route registration for new/detail/edit.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3
- **Files modified:** 8 (7 created, 1 modified)

## Accomplishments
- `ItemDetailPage` composes RetroTabs + a persistent side rail + the Plan-04 photo components; titlebar EDIT + ↧ overflow (archive/restore, delete…)
- `LoanPanels`: pink on-loan / mint available active panel + a history list, partitioned client-side on `is_active` (read-only; RETURN disabled with the Phase-8 hint)
- `ItemLabels`: attach/detach existing workspace labels through a checklist popover (Phase-10 empty hint when none)
- `InventoryPanelStub`: a real named `region` slot with the exact `Stock entries arrive in 7b.` copy
- Routes registered in literal-before-param order: `items/new` → form, `items/:id` → detail, `items/:id/edit` → form; the existing `items` list route untouched

## Task Commits

1. **Task 1: LoanPanels + ItemLabels + InventoryPanelStub** - `ef09a67` (feat)
2. **Task 2: ItemDetailPage (tabs, side rail, gallery, archive/delete)** - `94f26b7` (feat)
3. **Task 3: Register /items/new, /items/:id, /items/:id/edit routes** - `5875d85` (feat)

_TDD note: Tasks 1 & 2 were marked `tdd="true"`; components and their MSW specs were authored and verified together in a single commit per task rather than as separate RED/GREEN commits (the harness contracts — workspace mock, MSW handlers, lingui/modal providers — were already established by Plans 03–05, so a separate failing-test commit added no signal). Both tasks ship with passing specs._

## Files Created/Modified
- `frontend2/src/features/items/ItemDetailPage.tsx` - detail page: mint Window, tabs, side rail, archive/restore/delete, photo composition
- `frontend2/src/features/items/ItemDetailPage.test.tsx` - 8 MSW specs (fields/tabs/stub, lightbox open, active-loan, archive, delete gating, 404, edit nav)
- `frontend2/src/features/items/components/LoanPanels.tsx` - ActiveLoanPanel + LoanHistoryList + useItemLoans (shared query)
- `frontend2/src/features/items/components/LoanPanels.test.tsx` - 6 specs incl. InventoryPanelStub
- `frontend2/src/features/items/components/ItemLabels.tsx` - attach/detach existing labels via checklist popover
- `frontend2/src/features/items/components/ItemLabels.test.tsx` - 4 specs (chips, detach, attach, Phase-10 empty)
- `frontend2/src/features/items/components/InventoryPanelStub.tsx` - the named 7b slot
- `frontend2/src/routes/index.tsx` - three item child routes (literal-before-param)

## Decisions Made
- **404 → ITEM NOT FOUND, not the load-error state.** `itemsApi.get` throws `HttpError(404)` (it does not resolve `null`), so the detail page inspects `HttpError.status` to route a 404 to the `ITEM NOT FOUND` empty state and reserves the `COULDN'T LOAD ITEM` state + persistent toast for every other failure. This matches the UI-SPEC's two distinct detail empty/error branches.
- **Reused the shipped `Popover`** (`role="menu"` for the titlebar overflow, `role="menu"` for the label checklist) rather than inventing a menu atom — CONTEXT locks "no new atoms this phase."
- **`useItemLoans` exported from `LoanPanels`** so the side-rail active panel and the HISTORY tab share one query key (`["loans", wsId, "by-item", itemId]`) instead of double-fetching.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 404 detail load mis-routed to the generic error state**
- **Found during:** Task 2 (ItemDetailPage)
- **Issue:** The plan describes both an `ITEM NOT FOUND` (deleted/missing) and a `COULDN'T LOAD ITEM` (load failure) state. A naive `isError → error state` would send a 404 (the not-found case) to the wrong branch, because `itemsApi.get` *throws* `HttpError(404)` rather than resolving `null` — so `!item` never becomes true on a 404.
- **Fix:** Split on `HttpError.status === 404` → not-found state (no toast); all other errors → load-error state + persistent `retroToast.error`.
- **Files modified:** frontend2/src/features/items/ItemDetailPage.tsx
- **Verification:** `ItemDetailPage.test.tsx` "shows ITEM NOT FOUND when the item 404s" passes; full items suite green.
- **Committed in:** `94f26b7` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The fix is required for the UI-SPEC's two-state error contract to behave correctly. No scope creep.

## Issues Encountered
- Test navigation assertions initially used a `useLocation` probe mounted only under the `/items/:id` source route, so it never observed the destination path after navigating to `/items/:id/edit` or `/items`. Switched to asserting on the destination route's rendered text (`EDIT PAGE` / `ITEMS LIST`), which is the correct signal for a `<Routes>`-based MemoryRouter test.

## Known Stubs
- **Category value in the DETAILS grid** renders `item.category_id` (a uuid) or a `—` placeholder — the wire `ItemResponse` carries `category_id` with no name lookup (no taxonomy hook this phase). This mirrors the pre-existing stub the ItemsListPage already documents; the category *name* surfaces when a taxonomy/category hook lands. The detail page is fully functional without it.
- These are intentional and do not block ITEM-02 (detail renders all available fields, gallery, loan panels, labels, and the 7b slot).

## Threat Flags
None — no new network surface introduced beyond the Plan-01 typed API boundary. Item name + fields render as React-escaped text (T-07-18 mitigated, titlebar UPPERCASE is CSS not HTML); label attach/detach + detail/loans reads carry wsId and are backend-scoped (T-07-17/19 accepted).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- **07-07** (parallel) owns e2e + planning docs — untouched by this plan.
- **7b** swaps the `InventoryPanelStub` body in without relayout (real named slot in place).
- **Phase 8** wires the disabled `RETURN` affordance once loan CRUD lands.
- **Phase 10** replaces the label-attach "manage labels in Phase 10" hint with real label management.

## Self-Check: PASSED

All 7 created files and the SUMMARY exist on disk; all three task commits (`ef09a67`, `94f26b7`, `5875d85`) are present in the branch history. Full frontend2 suite green (468 tests, 68 files); `tsc -b --noEmit` clean; `lint:imports` OK.

---
*Phase: 07-items-photos*
*Completed: 2026-06-13*
