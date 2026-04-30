---
phase: 61-item-photos
plan: 04
subsystem: frontend-ui
tags: [items, photos, routes, i18n, checkpoint, integration]

# Dependency graph
requires:
  - phase: 61-item-photos
    plan: 01
    provides: "Item.primary_photo_thumbnail_url typing, itemPhotosApi.setPrimary, PhotoResponse.thumbnail_status"
  - phase: 61-item-photos
    plan: 02
    provides: "ItemThumbnailCell, ItemHeaderThumbnail presentational components"
  - phase: 61-item-photos
    plan: 03
    provides: "ItemPhotoGallery orchestrator, useItemPhotoGallery hook, ItemPhotoLightbox"
provides:
  - ItemDetailPage wired to ItemPhotoGallery (replaces Phase 60 placeholder)
  - ItemDetailPage header row with ItemHeaderThumbnail (64x64, dimmed when archived)
  - ItemsListPage first column THUMB with ItemThumbnailCell (40x40, dimmed when archived)
  - RetroTable header type widened from string to ReactNode (accepts sr-only JSX)
  - Lingui en + et catalogs extended with 32 Phase 61 msgids
  - Human-verify checkpoint gating phase sign-off (pending user approval)
affects: [none — final plan of Phase 61]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RetroTable header accepts ReactNode so columns can render sr-only labels for visually-unlabelled columns (accessibility pattern)"
    - "ItemDetailPage test pattern: stub ItemPhotoGallery via vi.mock and assert prop propagation through data-* attributes — keeps detail-page suite narrow (gallery owns its own suite)"
    - "Lingui extraction workflow: bun run i18n:extract — bun run i18n:compile — manual Estonian translation fill for new msgids only (scope boundary: pre-existing empty msgstrs untouched)"

key-files:
  created:
    - .planning/phases/61-item-photos/61-04-SUMMARY.md
  modified:
    - frontend2/src/features/items/ItemDetailPage.tsx
    - frontend2/src/features/items/ItemsListPage.tsx
    - frontend2/src/features/items/__tests__/ItemDetailPage.test.tsx
    - frontend2/src/features/items/__tests__/ItemsListPage.test.tsx
    - frontend2/src/components/retro/RetroTable.tsx
    - frontend2/locales/en/messages.po
    - frontend2/locales/et/messages.po

key-decisions:
  - "Widened RetroTable's column header type from string to ReactNode to accept <span className='sr-only'> for visually-hidden THUMB header (Rule 3 Blocking — plan offered this as the preferred path vs fallback workarounds)"
  - "Stubbed ItemPhotoGallery in ItemDetailPage.test.tsx via vi.mock rather than wiring every dependency of the gallery (itemPhotosApi, React Query, useItemPhotoGallery). Assertions target prop propagation through data-* attributes on the stub."
  - "Lingui scope boundary: only the 32 NEW Phase 61 msgids received Estonian translations. The 162 pre-existing empty et msgstrs (inherited from Phases 57–60) were left untouched — filling them is a separate polish task documented in deferred-items.md."
  - "Moved header thumbnail to the leftmost position inside the existing amber-rail heading container — preserved all existing classes and EDIT/ARCHIVE cluster; minimum-diff edit."

requirements-completed: [PHOTO-01, PHOTO-02, PHOTO-03, PHOTO-04]

# Metrics
duration: ~6min
completed: 2026-04-16
---

# Phase 61 Plan 04: Page Integration + i18n + Checkpoint Summary

**Wave-4 pure integration: ItemPhotoGallery replaces the Phase 60 PHOTOS placeholder, ItemHeaderThumbnail slots into the detail header, ItemsListPage gets a THUMB-first column, 32 new msgids land in en + et catalogs. Human-verify checkpoint awaiting sign-off.**

## Performance

- **Duration:** ~6 min (autonomous tasks 1–3; Task 4 awaits human)
- **Started:** 2026-04-16T18:06:52Z
- **Autonomous work complete:** 2026-04-16T18:12:41Z
- **Tasks:** 4 (3 `type="auto" tdd="true"`, 1 `checkpoint:human-verify` — pending)
- **Files modified:** 7
- **Files created:** 1 (this summary)
- **Commits:** 5 per-task + this doc commit

## Accomplishments

- **ItemDetailPage (Task 1):** swapped the Phase 60 PHOTOS placeholder for `<ItemPhotoGallery itemId={item.id} itemName={item.name} archived={item.is_archived ?? false} />`; slotted `<ItemHeaderThumbnail thumbnailUrl={item.primary_photo_thumbnail_url} dimmed={item.is_archived ?? false} />` as the leftmost child of the amber-rail heading row. Archived items dim the 64x64 thumbnail and make the gallery read-only (inherited from 61-03).
- **ItemsListPage (Task 2):** prepended a THUMB column to the existing 4-column table. Column header is `<span className="sr-only">{t\`Thumbnail\`}</span>` (visual column unlabelled); each row cell renders `<ItemThumbnailCell thumbnailUrl={item.primary_photo_thumbnail_url} dimmed={item.is_archived ?? false} />`. `className="w-14"` constrains column width to ~56px. Archived rows dim the thumbnail cell to match the existing line-through name treatment.
- **RetroTable (supporting change):** widened the `header` field of `RetroTableColumn` from `string` to `ReactNode` so JSX (specifically the sr-only span) type-checks cleanly. All six existing callers pass strings, which remain valid — zero runtime change.
- **Tests (flipped to match behaviour):** ItemDetailPage.test.tsx gained 5 new assertions (gallery wiring x3, header-thumbnail render x1, archived-dimming x1) and replaced the obsolete "Phase 61 placeholder copy" assertion. ItemsListPage.test.tsx gained 2 new assertions (THUMB column first + sr-only label; archived dimming). Every test green: 14/14 detail, 14/14 list, 437/437 full frontend suite.
- **Lingui (Task 3):** ran `bun run i18n:extract` → 32 new msgids appended to both catalogs. `locales/en/messages.po` contains every Phase 61 msgid (auto-populated msgstrs equal msgids). `locales/et/messages.po` received all 32 Estonian translations matching the plan's copywriting contract (tone rules: UPPERCASE for buttons/headings, sentence case for bodies/toasts, no orphan keys). `bun run i18n:compile` regenerated the compiled catalogs.

## Task Commits

Per-task atomic commits (TDD RED/GREEN where applicable):

1. **Task 1: ItemDetailPage — gallery + header thumbnail**
   - RED: `66bdf7d` — `test(61-04): add failing tests for ItemDetailPage photo gallery + header thumbnail`
   - GREEN: `c4aca6d` — `feat(61-04): wire ItemPhotoGallery + ItemHeaderThumbnail into ItemDetailPage`
2. **Task 2: ItemsListPage — THUMB column**
   - RED: `26d43c5` — `test(61-04): add failing tests for ItemsListPage THUMB column`
   - GREEN: `820d2c3` — `feat(61-04): prepend THUMB column to ItemsListPage (Phase 61 D-08)` — includes the RetroTable header-type widening
3. **Task 3: Lingui en + et extraction**
   - `bb89fb7` — `chore(61-04): extract Phase 61 strings to Lingui catalogs (en + et)`

## Files Created/Modified

### Created
- `.planning/phases/61-item-photos/61-04-SUMMARY.md` — this file

### Modified
- `frontend2/src/features/items/ItemDetailPage.tsx` — imports `ItemPhotoGallery` + `ItemHeaderThumbnail`, slot header thumbnail into heading row, replace PHOTOS placeholder with gallery (lines ~12-23 imports, ~122-125 heading, ~229-241 PHOTOS section)
- `frontend2/src/features/items/ItemsListPage.tsx` — import `ItemThumbnailCell`, prepend `thumb` column + row cell (lines ~30, ~109-124, ~128-133)
- `frontend2/src/features/items/__tests__/ItemDetailPage.test.tsx` — stub ItemPhotoGallery, new describe block for PHOTOS wiring, new describe block for header thumbnail (5 new assertions)
- `frontend2/src/features/items/__tests__/ItemsListPage.test.tsx` — new describe block for THUMB column (2 new assertions)
- `frontend2/src/components/retro/RetroTable.tsx` — `header: string` → `header: ReactNode` on `RetroTableColumn`
- `frontend2/locales/en/messages.po` — 32 new msgids + auto-populated en msgstrs
- `frontend2/locales/et/messages.po` — 32 new msgids + hand-written et msgstrs

## Decisions Made

- **Stubbed ItemPhotoGallery in ItemDetailPage.test.tsx via `vi.mock` rather than wiring full integration.** The gallery brings in the full React Query + mutation stack (itemPhotosApi list/upload/setPrimary/delete) and `useItemPhotoGallery` hook. Wiring all that into ItemDetailPage.test.tsx would duplicate the existing ItemPhotoGallery.test.tsx coverage and break the "each component owns its own suite" convention. The stub surface asserts the three things this plan is responsible for: (1) gallery is rendered, (2) the right props reach it (`itemId`, `itemName`, `archived`), (3) archived flag propagates correctly. The gallery's behaviour continues to be verified by `ItemPhotoGallery.test.tsx` (Wave 3).
- **Widened `RetroTableColumn.header` from `string` to `ReactNode`.** The plan suggested fallbacks if the current API didn't accept JSX, but widening the type is the cleanest option: it's a superset of `string`, all six existing callers still compile, and it removes a small API limitation that other future columns (e.g. a sort-indicator icon) will want anyway. Zero runtime change; tsc verifies the change is safe.
- **Scope boundary on Lingui Estonian fills.** The `et` catalog had 162 pre-existing empty msgstrs before this plan ran — these were inherited from Phases 57–60 when certain strings were added to `en` but not translated. Plan 61-04's acceptance criterion explicitly reads "every NEW msgid" — so only the 32 new Phase 61 strings received translations. Filling the pre-existing 162 is a separate polish task and is tracked in `.planning/phases/60-items-crud/deferred-items.md`.
- **Minimum-diff heading change.** The existing heading container already has `flex items-center gap-md flex-wrap` — the spec's "wrap the heading in a new flex row" isn't necessary. Inserting `<ItemHeaderThumbnail>` as the first child sibling of the `<h1>` (both inside the same existing flex container) gives the correct visual result with a one-line diff.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Widened `RetroTableColumn.header` type from `string` to `ReactNode`**
- **Found during:** Task 2 (TypeScript check of THUMB column definition)
- **Issue:** The THUMB column's header is `<span className="sr-only">{t\`Thumbnail\`}</span>` — a JSX element, not a string. TypeScript rejected it with `Type 'Element' is not assignable to type 'string'`.
- **Fix:** Changed `header: string` to `header: ReactNode` in `RetroTableColumn`. `ReactNode` is a superset that includes `string`, so all existing RetroTable callers (BorrowersListPage, DemoPage, the existing ItemsListPage columns) still compile and run identically.
- **Why it's a deviation:** The plan explicitly flagged this as a possibility and offered a fallback ("If `RetroTable` accepts only string headers, fall back to `header: ''` and render the sr-only span inside the cell helper OR add a visually-hidden wrapper supported by the table"). Widening the type matches the plan's intent and is cleaner than the fallbacks.
- **Files modified:** `frontend2/src/components/retro/RetroTable.tsx`
- **Committed in:** `820d2c3` (together with the ItemsListPage THUMB column)
- **Verification:** `bunx tsc --noEmit` exits 0; `bunx vitest run` — 437/437 pass (including RetroTable.test.tsx baseline); the new THUMB column assertions pass.

---

**Total deviations:** 1 auto-fixed (Rule 3)
**Impact on plan:** None — the deviation was explicitly anticipated by the plan.

## Issues Encountered

- **Pre-existing backend test failure (still out of scope):** `TestCleanupConfig_RetentionPeriodUsage` in `backend/internal/jobs/cleanup_test.go` fails with the same DST-related off-by-one assertion documented by Plan 61-01 under `.planning/phases/61-item-photos/deferred-items.md`. Not caused by this plan, not modified by this plan.

## Threat Flags

None — the plan's `<threat_model>` anticipates every new surface introduced in this plan (T-61-18..T-61-21). No new endpoints, no new trust boundaries, no new file access. Thumbnail `<img>` GETs (T-61-20) use `loading="lazy"` per ItemThumbnailCell / ItemHeaderThumbnail components (61-02). Archived-gallery read-only guard (T-61-21) accepted as UI-only.

## Known Stubs

None at runtime. The test-only `vi.mock` of ItemPhotoGallery inside `ItemDetailPage.test.tsx` is a test double, not a runtime stub — production code imports and renders the real gallery.

## User Setup Required

None — the human-verify checkpoint (Task 4) asks the user to exercise the full upload/view/set-primary/delete loop in a browser against a running backend. No environment configuration changes.

## Next Phase Readiness

Phase 61 is functionally complete pending the human-verify checkpoint. Phase 62 (loans) can build on the Phase 61 item-photo surface (e.g. showing the primary thumbnail in loan receipt screens) without new dependencies.

### Follow-up polish (queued for v2.2, NOT this phase)

- SSE-driven thumbnail readiness (D-11 alternative path) — currently thumbnails resolve via React Query refetch-on-focus + manual refresh
- Photo caption editing UI (backend supports it; no frontend surface yet)
- Photo reordering (drag to change `display_order`)
- Filling the 162 pre-existing empty `et` msgstrs (separate i18n polish effort)

## Verification Status

Autonomous task gate (Tasks 1–3):

- ✅ `cd frontend2 && bunx tsc --noEmit` — exits 0
- ✅ `cd frontend2 && bunx vitest run` — 437/437 pass (0 failed, 0 todo-only file regressions)
- ✅ `cd frontend2 && bun run i18n:compile` — Done in 350ms (no orphan msgids)
- ⚠️ `cd backend && go test ./...` — 1 pre-existing DST failure in `internal/jobs` (documented in Plan 61-01 deferred-items; out of scope for 61-04)
- ⏳ Task 4 human-verify — PENDING user approval

## Checkpoint

**Task 4 status:** awaiting human verification.
See plan `<how-to-verify>` for the 8 scenarios (A–H) to exercise. Resume signal: "approved" or specific scenario + step where behaviour diverged.

## Self-Check: PASSED

**File existence:**
- FOUND: frontend2/src/features/items/ItemDetailPage.tsx (modified, imports ItemPhotoGallery + ItemHeaderThumbnail)
- FOUND: frontend2/src/features/items/ItemsListPage.tsx (modified, imports ItemThumbnailCell + `thumb` column prepended)
- FOUND: frontend2/src/features/items/__tests__/ItemDetailPage.test.tsx (modified, 5 new assertions)
- FOUND: frontend2/src/features/items/__tests__/ItemsListPage.test.tsx (modified, 2 new assertions)
- FOUND: frontend2/src/components/retro/RetroTable.tsx (modified, header type widened)
- FOUND: frontend2/locales/en/messages.po (modified, 32 new Phase 61 msgids)
- FOUND: frontend2/locales/et/messages.po (modified, 32 new Estonian translations — no empty new msgstrs)

**Commit existence (verified via `git log --all`):**
- FOUND: 66bdf7d — test(61-04) ItemDetailPage RED
- FOUND: c4aca6d — feat(61-04) ItemDetailPage GREEN
- FOUND: 26d43c5 — test(61-04) ItemsListPage RED
- FOUND: 820d2c3 — feat(61-04) ItemsListPage GREEN (+ RetroTable widening)
- FOUND: bb89fb7 — chore(61-04) Lingui catalogs

---
*Phase: 61-item-photos*
*Plan: 61-04 — page integration + i18n + human checkpoint*
*Completed (autonomous): 2026-04-16*
*Awaiting: Task 4 human-verify approval*
