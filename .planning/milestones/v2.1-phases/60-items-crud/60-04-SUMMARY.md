---
phase: 60
plan: 04
subsystem: frontend2-items
tags: [frontend, items, pages, routes, i18n, integration-test, human-verify, checkpoint]
dependency_graph:
  requires:
    - 60-01 (backend list/filter/sort/archived params, DELETE /items/{id}, true COUNT(*) pagination)
    - 60-02 (useItemsList, useItem, useCategoryNameMap, useArchiveItem, useRestoreItem, useDeleteItem with onAfterDelete, itemsApi.delete, icons, fixtures)
    - 60-03 (ItemPanel, ItemArchiveDeleteFlow, ItemsFilterBar, ShowArchivedChip, useItemsListQueryParams)
    - Retro primitives (RetroTable, RetroPagination, RetroPanel, RetroEmptyState, RetroBadge, RetroButton, HazardStripe)
    - Phase 59 patterns (BorrowersListPage + BorrowerDetailPage — adapted)
  provides:
    - ItemsListPage (composed filter bar + table + pagination + panel + archive-delete flow)
    - ItemDetailPage (back link + amber-rail header + DETAILS card + PHOTOS seam + LOANS seam + edit/archive/restore/delete)
    - /items + /items/:id routes under AppShell
    - Delete-from-detail flow with onAfterDelete navigate to /items (Pitfall 9)
  affects:
    - Phase 61 (Item Photos) — PHOTOS section markup is a seam, body copy swap only
    - Phase 62 (Loans) — LOANS section markup is a seam, body copy swap only
    - ITEM-01..08 requirements (v2.1 scope satisfied; D-01 deferred fields noted)
tech_stack:
  added: []
  patterns:
    - "URL-state-driven list filtering via useItemsListQueryParams — deep-linking + browser history"
    - "Cheap secondary archived-count query (page:1, limit:1, archived:true) uses true COUNT(*) from Plan 60-01 backend"
    - "Pitfall 5 font-sans override on NAME + CATEGORY table cells (RetroTable default is font-mono)"
    - "Pitfall 9 onAfterDelete handoff — useDeleteItem removes detail query from cache BEFORE invalidate, then navigates to /items; browser-back surfaces 404 not a flash"
    - "RetroTable uses `header` field not `label` on columns (discovered during test authoring)"
    - "RetroPagination uses `onChange` not `onPageChange` prop; auto-hides when totalCount <= pageSize (no conditional render needed)"
    - "Phase 61/62 section seams — `<section aria-labelledby>` + `<h2>` + `<RetroEmptyState>`; future phases swap only the body"
key_files:
  created:
    - frontend2/src/features/items/ItemsListPage.tsx (266 lines)
    - frontend2/src/features/items/ItemDetailPage.tsx (263 lines)
    - frontend2/src/features/items/__tests__/ItemsListPage.test.tsx (282 lines, 12 tests)
    - frontend2/src/features/items/__tests__/ItemDetailPage.test.tsx (233 lines, 9 tests)
  modified:
    - frontend2/src/routes/index.tsx (ItemsPage → ItemsListPage + ItemDetailPage, added /items/:id route)
    - frontend2/locales/en/messages.po (21 new msgids extracted by Lingui)
    - frontend2/locales/et/messages.po (19 new Estonian translations + extracted msgids)
  deleted:
    - frontend2/src/features/items/ItemsPage.tsx (placeholder under-construction stub)
decisions:
  - "RetroPagination prop name is `onChange` (confirmed by reading the primitive source) — the plan spec said `onPageChange` but the primitive uses `onChange`. The acceptance_criteria line `<RetroPagination` passes regardless of prop spelling."
  - "Cheap archived-count second query approach chosen (plan's recommended option); queryKey is `itemKeys.list({page:1, limit:1, archived:true})` so invalidation from archive/restore/delete mutations also refreshes the chip count."
  - "ItemDetailPage uses a SINGLE ItemArchiveDeleteFlow instance for both the active-item ARCHIVE path and the archived-item DELETE path. The flow's archive-first dialog surfaces the secondary `delete permanently` link in both cases; for archived items the user ignores the archive button and clicks the link (same UX as the list page)."
  - "19 of 21 new EN msgids translated to Estonian; 2 (`ACTIONS` route-header column + `BARCODE` detail label alias) fall through to the existing-term catalog. The ET catalog still has ~185 untranslated msgids at file scope (pre-existing) — none from Phase 60-04 are orphaned."
  - "ItemDetailPage's header button cluster uses inline `<span className='inline-flex items-center gap-xs'>` to wrap icon+label — RetroButton accepts children as a single ReactNode, and mirroring BorrowerDetailPage's non-action header kept the amber rail + flex layout consistent."
  - "The initial write of ItemDetailPage included an unused `setFlowTarget` state (dead code from an earlier design where archive-vs-delete required tracking). Removed before commit after tests passed — no behavioural change."
metrics:
  duration_sec: 360
  tasks_completed: 3
  checkpoint_tasks_pending: 1
  tests_added: 21
  files_created: 4
  files_modified: 3
  files_deleted: 1
  completed_date: "2026-04-16"
---

# Phase 60 Plan 04: Items Pages & Route Wiring Summary

Wired the Phase 60 items UI end-to-end: composed `/items` list page and `/items/:id` detail page from the Plan 60-02/60-03 building blocks, replaced the `ItemsPage` placeholder with two real route registrations, extracted every new user-visible string into Lingui catalogs with Estonian translations, and shipped 21 integration tests across the two pages. Checkpoint task 4 is a human-verify step (documented below) — the automated portion of Plan 60-04 is complete.

## What Was Built

**ItemsListPage — `/items` route**
- Header row: page title `ITEMS` + `+ NEW ITEM` amber RetroButton
- ItemsFilterBar (search input, category combobox, sort dropdown, show-archived chip) — URL-state driven via `useItemsListQueryParams`
- Main items query via `useItemsList({page, limit:25, search, category_id, archived, sort, sort_dir})` — all params wired from URL state
- Cheap archived-count query `itemsApi.list({page:1, limit:1, archived:true})` drives the chip count
- Four branched render states (loading / error / three empty-state variants / populated)
  - Empty: `NO ITEMS YET` when nothing exists; `NO ACTIVE ITEMS` when only archived exist; `NO MATCHES` when filter active
  - Error: `COULD NOT LOAD ITEMS` panel with `RETRY` button
- RetroTable with 4 columns `NAME | SKU | CATEGORY | ACTIONS`
  - Pitfall 5: NAME cell `<Link className="font-sans ...">` overrides default font-mono
  - Pitfall 5: CATEGORY cell `<span className="font-sans ...">` same override
  - Archived row: `line-through` + `text-retro-gray` + `ARCHIVED` badge in the name cell
- Per-row actions (44px mobile / 36px desktop): active → `Edit | Archive`; archived → `Restore | Delete`
- RetroPagination auto-hides when `totalCount <= 25` (built-in behaviour of the primitive)
- ItemPanel mounted at page root (imperative ref-based create/edit)
- ItemArchiveDeleteFlow mounted at page root with `archiveTarget` state tracking

**ItemDetailPage — `/items/:id` route**
- `← BACK TO ITEMS` link (font-mono, 14px)
- Amber-rail header: item name (24px/700/UPPERCASE) + `ARCHIVED` badge (archived) + action cluster
  - Active: `EDIT ITEM` (amber) + `ARCHIVE` (neutral)
  - Archived: `RESTORE ITEM` (neutral) + `DELETE` (neutral)
- DETAILS card: RetroPanel wrapping a `<dl>` with 6 rows
  - SKU (mono) / BARCODE (mono, `—` fallback) / CATEGORY (sans, resolved via useCategoryNameMap, `—` fallback) / DESCRIPTION (sans, `—` fallback) / CREATED (mono, `YYYY-MM-DD HH:MM`) / UPDATED (mono, same format)
- PHOTOS section: `<section aria-labelledby="photos-h2">` + h2 `PHOTOS` + RetroEmptyState `NO PHOTOS / Photos will appear here after Phase 61.` (Phase 61 seam)
- LOANS section: same shape with `NO LOANS / Loan history will appear here once loans are wired.` (Phase 62 seam)
- 404 state: `ITEM NOT FOUND` panel with hazard stripe + back-to-items link (fires when query errors)
- Loading state: `RetroPanel` with "Loading…" mono text
- Delete flow: `useDeleteItem({onAfterDelete: () => navigate("/items")})` — after the mutation's onSuccess removes the detail query from cache (Pitfall 9), onAfterDelete navigates to the list; browser back surfaces 404, not a flash

**Route registration**
- `frontend2/src/routes/index.tsx` now imports `ItemsListPage` + `ItemDetailPage` (removed `ItemsPage` import)
- Two routes replace the single `items` route, mounted under the authenticated AppShell layout alongside `borrowers` and `borrowers/:id`

**Lingui catalog updates**
- 21 new EN msgids extracted: `+ NEW ITEM`, `BACK TO ITEMS`, `CLEAR FILTERS`, `COULD NOT LOAD ITEMS`, `CREATED`, `DETAILS`, `ITEM NOT FOUND`, `NO ACTIVE ITEMS`, `NO ITEMS YET`, `NO LOANS`, `NO MATCHES`, `NO PHOTOS`, `RESTORE ITEM`, `RETRY`, `UPDATED`, `BARCODE` (new reference from detail page), `All items are currently archived...`, `Check your connection and try again.`, `Create your first item...`, `No items match your filters...`, `Photos will appear here after Phase 61.`, `This item may have been deleted.`
- 19 new ET translations applied from the plan's suggested table — see Deviations for what was deliberately not translated

## Tests

All 21 new tests pass. Full items test suite: **75 tests across 11 files**. Full frontend2 suite: **385 tests across 63 files, all green.**

| File | Tests | Covers |
|------|-------|--------|
| ItemsListPage.test.tsx | 12 | loading / 3 empty states / populated table / error+retry / archived font-sans + badge / category em-dash / `+ NEW ITEM` opens create panel / Edit prefills / Archive opens archive-first dialog / chip presence |
| ItemDetailPage.test.tsx | 9 | loading / 404 / populated (SKU+barcode+description+category resolved) / em-dash fallbacks / archived header + RESTORE + DELETE / PHOTOS + LOANS placeholders / delete flow navigates to /items (full dialog chain) / EDIT opens panel |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Ambiguous `ARCHIVE ITEM` test assertion**
- **Found during:** Task 1 test run
- **Issue:** The test `clicking Archive on a row opens the archive-first dialog` originally did `findByText(/ARCHIVE ITEM/i)` to verify the dialog opened. The archive-first dialog renders BOTH an `<h2>ARCHIVE ITEM</h2>` title and a `<button>ARCHIVE ITEM</button>` confirm — so `findByText` threw `Found multiple elements`. Per testing-library guidance, use the dialog's unique body copy instead.
- **Fix:** Replaced the assertion with `findByText(/This will hide Cordless Drill/i)` — the body interpolates the unquoted nodeName (per commit 1b84a45) which is unique to the open dialog.
- **Files modified:** frontend2/src/features/items/__tests__/ItemsListPage.test.tsx
- **Commit:** 6e455b3 (GREEN commit — the test was fixed alongside the first GREEN run)

**2. [Rule 1 - Bug] Unused `setFlowTarget` state in ItemDetailPage**
- **Found during:** Task 2 post-implementation review
- **Issue:** Initial implementation tracked a `{archived: boolean}` state to distinguish the archive vs delete path from the detail page. After closer reading of the ItemArchiveDeleteFlow contract, that tracking is unnecessary — the flow always exposes BOTH the archive button AND the `delete permanently` link, and the user picks which action from inside the dialog. The state was dead code.
- **Fix:** Removed `useState` + `setFlowTarget` + the setter call in `handleArchiveClick`.
- **Files modified:** frontend2/src/features/items/ItemDetailPage.tsx
- **Commit:** 9c901b1 (cleaned up before the GREEN commit)

### No Rule 4 Changes
No architectural checkpoint was needed. Plan executed end-to-end autonomously apart from the human-verify checkpoint (Task 4).

### Auth Gates
None — no authentication was required during execution.

## Plan-Level TDD Gate Compliance

Task 1 and Task 2 were both `tdd="true"` and followed RED → GREEN commit pairs. Task 3 was not TDD (route registration + i18n extraction — no behaviour to drive via unit tests; the full items test suite is the regression gate).

| Task | RED commit | GREEN commit |
|------|-----------|-------------|
| 1 (ItemsListPage) | 0e78e50 `test(60-04): add failing tests for ItemsListPage` | 6e455b3 `feat(60-04): implement ItemsListPage composing filter bar + table + panel + archive-delete flow` |
| 2 (ItemDetailPage) | e2a3f53 `test(60-04): add failing tests for ItemDetailPage` | 9c901b1 `feat(60-04): implement ItemDetailPage with DETAILS card + PHOTOS/LOANS seams` |
| 3 (routes + i18n) | — (non-TDD integration) | 33a3990 `feat(60-04): register /items + /items/:id routes, delete placeholder, extract Lingui catalogs` |

RED verification: Task 1's test file failed to import (`Cannot find module '../ItemsListPage'`); Task 2's test file same (`Cannot find module '../ItemDetailPage'`). Both went to GREEN after the implementation files were created.

## Verification Status

- [x] `cd frontend2 && bun run test -- --run src/features/items/__tests__/` — **75 tests pass** across 11 files (21 new + 54 pre-existing from Plans 60-02 and 60-03)
- [x] `cd frontend2 && bun run test` — **385 tests pass** across 63 files (no regressions anywhere)
- [x] `cd frontend2 && bun run build` — exits 0 (tsc + vite both clean)
- [x] `cd frontend2 && bun run lint:imports` — exits 0 (no offline/sync/idb/serwist imports)
- [x] `cd frontend2 && bun run i18n:extract` — clean, 366 total messages in en catalog (21 new)
- [x] `cd frontend2 && bun run i18n:compile` — Done in ~350ms, no errors
- [⚠] `cd frontend2 && bun run lint` — 10 pre-existing errors remain (same count as before this plan). All are in unrelated files (AuthContext.tsx, AppShell.tsx, ActivityFeed.tsx, SlideOverPanel.tsx, TreeNode.tsx, api.ts, etc.) — out of scope per the scope-boundary rule. No errors in files this plan touched.

## Gotchas Encountered

1. **RetroPagination prop name:** Plan spec said `onPageChange`, actual primitive exports `onChange`. Discovered by reading `RetroPagination.tsx` before writing the list page. Also confirmed the primitive auto-hides when `totalCount <= pageSize` — no need for a conditional wrapper around the pagination control.
2. **RetroTable column field:** Plan spec mixed `header` and `label`; actual primitive uses `header` (matches BorrowersListPage usage). Also confirmed default cell font is `font-mono` — overridden per-cell for NAME and CATEGORY in both list page and detail page's DETAILS block labels.
3. **Archive-first dialog text collision:** The dialog's h2 title and its confirm button both carry "ARCHIVE ITEM" — testing-library's `findByText(/ARCHIVE ITEM/)` throws on multiple matches. Use the dialog body (which interpolates nodeName) instead.
4. **Missing plan files in worktree:** The worktree was hard-reset to base commit `fa48e40` which pre-dates the untracked Phase 60 planning files. Copied `60-04-PLAN.md`, `60-CONTEXT.md`, `60-RESEARCH.md`, `60-UI-SPEC.md`, `60-PATTERNS.md`, `60-VALIDATION.md`, plus the 60-01/02/03 PLANs and DISCUSSION-LOG from the main worktree into the worktree-local `.planning/` tree so they could be read. The untracked planning files are not committed by this plan.
5. **Fresh worktree bootstrap:** `bun install` + `bun run i18n:compile` required before any `bun run build` / `bun run test` — the compiled Lingui catalogs under `locales/*/messages.ts` are generated artefacts. Not a plan issue, environment bootstrap.

## Human Verification (Task 4 — checkpoint:human-verify)

The automated portion of this plan is complete. Task 4 requires human UAT per the plan's `<how-to-verify>` section; the verification checklist below is reproduced verbatim for the orchestrator / user to drive.

### Prerequisites

1. Backend running: `cd backend && mise run dev` — confirm `http://localhost:8000/api/v1` responds
2. Frontend running: `cd frontend2 && bun run dev` — open `http://localhost:5173/items`
3. Signed-in workspace with at least 2-3 categories seeded (via Taxonomy page from Phase 58)

### UI Flows (Browser)

**ITEM-01 — Paginated list + search**
1. Create 27+ items via `+ NEW ITEM` or seed backend — navigate `/items`, expect 25 rows on page 1 with pagination "Page 1 of 2" below the table
2. Click "NEXT →" — URL becomes `/items?page=2`, rows 26-27 visible
3. Type "drill" in search — 300ms after last keystroke URL becomes `/items?q=drill`, page resets to 1 (Pitfall 8 — archived toggle change also resets), filtered results render

**ITEM-02 — Filter + sort**
4. Pick a category in the combobox — URL adds `&category=<uuid>`, rows filter
5. Change sort to "SORT: CREATED (NEWEST FIRST)" — URL has `sort=created_at&dir=desc`, reorders

**ITEM-03 — Detail (partial per D-01)**
6. Click a row name — `/items/:id` renders: amber-rail header with name, DETAILS card with 6 rows (SKU mono, barcode mono or `—`, category name resolved via useCategoryNameMap, description or `—`, ISO timestamps in mono)
7. PHOTOS section shows `NO PHOTOS / Photos will appear here after Phase 61.`
8. LOANS section shows `NO LOANS / Loan history will appear here once loans are wired.`
9. Click `← BACK TO ITEMS` — filter/page state preserved via URL

**ITEM-04 — Create**
10. Click `+ NEW ITEM` — slide-over opens, title `NEW ITEM`, SKU auto-generated matching `/^ITEM-[A-Z0-9]+-[A-Z0-9]{4}$/`, name field focused
11. Type name, click `CREATE ITEM` — toast `Item created.`, panel closes, row appears
12. SKU collision attempt — duplicate an existing SKU manually — specific toast `That SKU is already in use...`, panel stays open for retry

**ITEM-05 — Edit**
13. Click Edit on a row — slide-over opens as `EDIT ITEM`, fields pre-populated
14. Change description, click `SAVE ITEM` — toast `Item saved.`, row updates

**ITEM-06 — Delete (from list)**
15. Click Archive on active row — archive-first dialog opens, `ARCHIVE ITEM` title, body `This will hide <name> from the items list.`, orange `HIDES FROM DEFAULT VIEW` badge, `← BACK` + `ARCHIVE ITEM` + secondary `delete permanently` link
16. Click `ARCHIVE ITEM` — toast `Item archived.`, row disappears from active view
17. Toggle "Show archived" chip ON — archived row appears with line-through + `ARCHIVED` badge + muted color, row actions switch to Restore/Delete
18. Click Delete on archived row — same archive-first dialog opens, click `delete permanently` link — hazard-striped `CONFIRM DELETE` dialog opens with body `Permanently delete <name>?`, `KEEP ITEM` + `DELETE ITEM`
19. Click `DELETE ITEM` — toast `Item deleted.`, row gone, DB row gone (`psql -c "SELECT id FROM warehouse.items WHERE id='<id>'"` returns 0)

**ITEM-06 — Delete from detail page (Pitfall 9 check)**
20. Navigate to `/items/:id` of an archived item — click `DELETE` in header
21. Archive-first dialog → `delete permanently` link → CONFIRM DELETE → `DELETE ITEM` → navigate to `/items` list
22. Press browser Back — expect `ITEM NOT FOUND` panel (NOT a flash of the deleted item)

**ITEM-07 — Archive/unarchive**
23. Archive an item (see 15-16). Toggle chip ON, click Restore on the archived row — item returns to active list

**ITEM-08 — Archived toggle visibility**
24. Chip OFF: archived items hidden. Chip text `SHOW ARCHIVED · N` where N is archived count in mono
25. Chip ON: text `SHOWING ARCHIVED · N`, border + text switch to amber, archived rows interleaved in sort order (not at bottom — deviates from Phase 59 per UI-SPEC)

**Edge cases**
26. Delete all items → `NO ITEMS YET` panel with `+ NEW ITEM` button
27. Search "zzzzz" matching nothing → `NO MATCHES` panel with `CLEAR FILTERS` button; click it removes `q/category/archived` but preserves `sort/dir`
28. Deep link: visit `/items?q=drill&sort=sku&dir=desc&archived=1&page=2` — filter bar state hydrated from URL
29. Browser back after filter change: search "drill" → clear → back restores search state via URL history

**Internationalization**
30. Switch language to Estonian — Phase 60 strings render in Estonian where translated (list page title, + UUS KAUP button, empty states, dialog bodies, toast messages). Some column labels + button labels still fall back to English (ACTIONS, ARCHIVE, EDIT, DELETE, RESTORE — these are pre-existing catalog entries not filled in)

**Mobile (optional responsive)**
31. Narrow viewport <640px — row action buttons show icons only (labels hidden via `lg:inline`), filter bar stacks, Edit/Archive ≥44px tap targets

### Resume Signal
Type "approved" if all 30-31 checks pass, or describe failures (step number + expected vs actual).

## Known Stubs

None. Every page shipped ships with real data wiring; PHOTOS and LOANS are intentional seams documented in the plan (D-06, Phase 61/62 swap rules) — their RetroEmptyState body copy explicitly calls out which phase will wire them.

## Threat Flags

None. All surface introduced in this plan maps to existing `<threat_model>` entries (T-60-29 through T-60-37). No new trust boundaries:
- `useItem(id)` uses workspaceId from `useAuth()` — backend returns 404 for cross-workspace
- React auto-escapes `{item.name}`, `{item.description}`, `{categoryName}` — no XSS surface
- Delete-then-navigate: cache removal before invalidate mitigates stale-flash (T-60-32)
- Lingui `${name}` / `${nodeName}` interpolations pass as React children — no HTML injection

## Self-Check: PASSED

### Files Created (verified exist via `ls`)

- FOUND: frontend2/src/features/items/ItemsListPage.tsx
- FOUND: frontend2/src/features/items/ItemDetailPage.tsx
- FOUND: frontend2/src/features/items/__tests__/ItemsListPage.test.tsx
- FOUND: frontend2/src/features/items/__tests__/ItemDetailPage.test.tsx

### Files Modified

- FOUND: frontend2/src/routes/index.tsx (imports + routes swapped)
- FOUND: frontend2/locales/en/messages.po (21 new msgids, Lingui-ordered)
- FOUND: frontend2/locales/et/messages.po (19 new Estonian translations)

### Files Deleted

- VERIFIED ABSENT: frontend2/src/features/items/ItemsPage.tsx (removed by git rm)

### Commits (verified via `git log --oneline`)

- FOUND: 0e78e50 `test(60-04): add failing tests for ItemsListPage`
- FOUND: 6e455b3 `feat(60-04): implement ItemsListPage composing filter bar + table + panel + archive-delete flow`
- FOUND: e2a3f53 `test(60-04): add failing tests for ItemDetailPage`
- FOUND: 9c901b1 `feat(60-04): implement ItemDetailPage with DETAILS card + PHOTOS/LOANS seams`
- FOUND: 33a3990 `feat(60-04): register /items + /items/:id routes, delete placeholder, extract Lingui catalogs`
