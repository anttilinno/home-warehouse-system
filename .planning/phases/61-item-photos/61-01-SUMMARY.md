---
phase: 61-item-photos
plan: 01
subsystem: api
tags: [items, photos, api, backend, sqlc, react-query, thumbnails, retro]

# Dependency graph
requires:
  - phase: 60-items-crud
    provides: items-list page + ItemResponse struct ready to decorate
  - phase: 57-retro-form-primitives
    provides: RetroFileInput component (updated in this plan to drop HEIC)
provides:
  - backend PhotoResponse.thumbnail_status JSON field (D-11)
  - backend ItemResponse.primary_photo_{url,thumbnail_url} omitempty fields (D-09)
  - backend itemphoto.GetPrimary + itemphoto.ListPrimaryByItemIDs service methods
  - sqlc query GetPrimaryPhotosByItemIDs (workspace-scoped batched fetch)
  - frontend lib/api put<T> helper
  - frontend itemPhotosApi.setPrimary method (PUT /workspaces/{wsId}/photos/{photoId}/primary)
  - frontend ItemPhoto.thumbnail_status typing
  - frontend Item.primary_photo_{url,thumbnail_url} typing
  - RetroFileInput accepts JPEG/PNG/WebP (HEIC removed)
  - 6 Wave 0 test files (5 component scaffolds + 1 real itemPhotos.test.ts)
  - makeItemPhoto test fixture factory
affects: [61-02-itemphoto-service-layer, 61-03-itemphoto-gallery-ui, 61-04-itemslist-thumbnail-column]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Item handler takes a narrow PrimaryPhotoLookup interface (not the full itemphoto.ServiceInterface) so list/detail decoration is testable without mocking unrelated methods"
    - "Photo decoration degrades gracefully: nil PrimaryPhotoLookup or error during lookup logs and serves ItemResponse without primary_photo_* fields"
    - "Wave 0 scaffold pattern: component test files ship as it.todo-only so downstream plans get green CI from day one; plans flip todos to real tests as components land"
    - "sqlc named parameters (@workspace_id, @item_ids::uuid[]) preferred over positional ($1, $2) to get meaningful generated field names"

key-files:
  created:
    - frontend2/src/features/items/photos/ItemPhotoGallery.test.tsx
    - frontend2/src/features/items/photos/ItemPhotoGrid.test.tsx
    - frontend2/src/features/items/photos/ItemPhotoTile.test.tsx
    - frontend2/src/features/items/photos/ItemPhotoLightbox.test.tsx
    - frontend2/src/features/items/photos/ItemThumbnailCell.test.tsx
    - frontend2/src/lib/api/itemPhotos.test.ts
  modified:
    - backend/db/queries/item_photos.sql
    - backend/internal/infra/queries/item_photos.sql.go (sqlc regen)
    - backend/internal/domain/warehouse/itemphoto/handler.go
    - backend/internal/domain/warehouse/itemphoto/repository.go
    - backend/internal/domain/warehouse/itemphoto/service.go
    - backend/internal/domain/warehouse/itemphoto/handler_test.go
    - backend/internal/domain/warehouse/itemphoto/service_test.go
    - backend/internal/infra/postgres/itemphoto_repository.go
    - backend/internal/domain/warehouse/item/handler.go
    - backend/internal/domain/warehouse/item/handler_test.go
    - backend/internal/api/router.go
    - frontend2/src/lib/api.ts
    - frontend2/src/lib/api/itemPhotos.ts
    - frontend2/src/lib/api/items.ts
    - frontend2/src/components/retro/RetroFileInput.tsx
    - frontend2/src/features/items/__tests__/fixtures.ts

key-decisions:
  - "Introduced PrimaryPhotoLookup narrow interface in item package (two methods: GetPrimary, ListPrimaryByItemIDs) so RegisterRoutes doesn't tightly couple to itemphoto.ServiceInterface; simpler mocking, optional dependency"
  - "toItemResponse grew a PrimaryPhotoURLGenerator parameter instead of injecting URL generation via global — keeps function pure and testable"
  - "Primary-photo lookup errors log but do not fail list/detail requests (thumbnails are decorative)"
  - "sqlc query uses named params @workspace_id / @item_ids for readable generated struct fields (ItemIds instead of Column2)"
  - "Wave 0 scaffolds use it.todo so the files compile AND the suite stays green — flipped to real tests in 61-03/61-04"

patterns-established:
  - "Narrow capability interface pattern: item handler declares PrimaryPhotoLookup locally instead of importing itemphoto.ServiceInterface — keeps packages loosely coupled"
  - "Graceful degradation for decorative lookups: photos source may be nil, may fail at runtime, and ItemResponse still renders (omitempty hides missing fields)"
  - "test-first scaffold pattern: create test file with it.todo blocks now so downstream plans inherit working test infrastructure"

requirements-completed: [PHOTO-01, PHOTO-02, PHOTO-03, PHOTO-04]

# Metrics
duration: ~28min
completed: 2026-04-16
---

# Phase 61 Plan 01: Foundation Closure Summary

**Items list now carries primary_photo_thumbnail_url per item (omitempty), PhotoResponse surfaces thumbnail_status, frontend itemPhotosApi gets setPrimary + put helper + correct multipart key, RetroFileInput drops HEIC, and 6 Wave 0 test scaffolds are green.**

## Performance

- **Duration:** ~28 min
- **Started:** 2026-04-16T17:02:00Z (approx, post worktree reset)
- **Completed:** 2026-04-16T17:30:56Z
- **Tasks:** 2 (both `type="auto" tdd="true"`)
- **Files modified:** 16 (9 backend, 7 frontend)
- **Files created:** 6 test files

## Accomplishments

- **Backend:** ItemResponse now decorated with primary_photo_thumbnail_url + primary_photo_url (omitempty) via a batched GetPrimaryPhotosByItemIDs query — one DB round trip per list request, no N+1. Detail endpoint also gets primary_photo_url via GetPrimary. PhotoResponse gains thumbnail_status for frontend PROCESSING placeholder. Workspace-scoped everywhere (T-61-02 mitigation).
- **Frontend API surface:** put<T> helper added; itemPhotosApi.setPrimary lands with correct PUT URL; ItemPhoto.thumbnail_status typed; Item.primary_photo_* typed; multipart upload key fixed from "file" to "photo" (T-61-01 mitigation).
- **RetroFileInput (D-10):** accept string changed to image/jpeg,image/png,image/webp and helper text reads "JPEG, PNG, or WebP" — HEIC fully removed.
- **Test infrastructure:** makeItemPhoto fixture + 6 Wave 0 test files so plans 61-02/03/04 have working npx vitest run targets from day one. itemPhotos.test.ts has 4 real assertions (setPrimary URL/method/body + upload form key).

## Task Commits

Each task was committed atomically:

1. **Task 1: Backend — PhotoResponse.thumbnail_status + primary-photo map for ItemResponse + sqlc query** - `fd08956` (feat)
2. **Task 2: Frontend API surface — put helper + itemPhotos gaps + items type + RetroFileInput HEIC→WebP + test fixtures + Wave 0 scaffolds** - `c469204` (feat)

_TDD note: tests and implementation were committed together per task because the changes to ServiceInterface/Repository required coordinated mock updates that would otherwise leave the suite non-compilable between RED and GREEN. Behaviour still verified end-to-end: handler tests assert JSON field presence, frontend tests assert fetch call shape._

## Files Created/Modified

### Created
- `backend/internal/infra/queries/item_photos.sql.go` — sqlc regenerated (GetPrimaryPhotosByItemIDs added)
- `frontend2/src/features/items/photos/ItemPhotoGallery.test.tsx` — Wave 0 scaffold
- `frontend2/src/features/items/photos/ItemPhotoGrid.test.tsx` — Wave 0 scaffold
- `frontend2/src/features/items/photos/ItemPhotoTile.test.tsx` — Wave 0 scaffold
- `frontend2/src/features/items/photos/ItemPhotoLightbox.test.tsx` — Wave 0 scaffold
- `frontend2/src/features/items/photos/ItemThumbnailCell.test.tsx` — Wave 0 scaffold
- `frontend2/src/lib/api/itemPhotos.test.ts` — real unit tests (setPrimary + upload form key)

### Modified
- `backend/db/queries/item_photos.sql` — added GetPrimaryPhotosByItemIDs query
- `backend/internal/domain/warehouse/itemphoto/handler.go` — PhotoResponse.ThumbnailStatus + toPhotoResponse mapping
- `backend/internal/domain/warehouse/itemphoto/repository.go` — added ListPrimaryByItemIDs to Repository interface
- `backend/internal/domain/warehouse/itemphoto/service.go` — GetPrimary + ListPrimaryByItemIDs methods + ServiceInterface additions + shared import
- `backend/internal/infra/postgres/itemphoto_repository.go` — implemented ListPrimaryByItemIDs using sqlc query
- `backend/internal/domain/warehouse/item/handler.go` — PrimaryPhotoLookup interface, ItemResponse fields, toItemResponse signature, RegisterRoutes args, lookupPrimaryPhotos helper, stringPtrOrNil helper
- `backend/internal/domain/warehouse/item/handler_test.go` — tests for primary_photo_* present/omitted/degraded, mockPrimaryPhotoLookup
- `backend/internal/domain/warehouse/itemphoto/handler_test.go` — thumbnail_status assertion test, MockService adds GetPrimary + ListPrimaryByItemIDs
- `backend/internal/domain/warehouse/itemphoto/service_test.go` — MockRepository.ListPrimaryByItemIDs added
- `backend/internal/api/router.go` — item.RegisterRoutes now takes itemPhotoSvc + photoURLGenerator
- `frontend2/src/lib/api.ts` — put<T> helper exported
- `frontend2/src/lib/api/itemPhotos.ts` — thumbnail_status, setPrimary, form.append("photo", file)
- `frontend2/src/lib/api/items.ts` — primary_photo_thumbnail_url, primary_photo_url optional fields on Item
- `frontend2/src/components/retro/RetroFileInput.tsx` — HEIC → WebP (accept + helper text)
- `frontend2/src/features/items/__tests__/fixtures.ts` — exported NOW, added makeItemPhoto factory

## Decisions Made

- **PrimaryPhotoLookup narrow interface** — The item handler defines its own two-method interface (`GetPrimary`, `ListPrimaryByItemIDs`) rather than importing `itemphoto.ServiceInterface`. Rationale: ServiceInterface has 14 methods; tests only need 2. Narrow interface also lets RegisterRoutes accept `nil` safely for tests that don't exercise photo integration. Downstream wiring in router.go passes the real itemPhotoSvc (which now also satisfies this interface via the added methods).
- **Graceful photo decoration** — Passing `nil` photos source returns empty map; a live error from the repo logs and returns empty map. Request never fails because a thumbnail couldn't be fetched. This is codified as a test (`TestItemHandler_List_PhotoLookupErrorDegradesToNoThumbnail`).
- **Named sqlc params** — Used `@workspace_id` / `@item_ids::uuid[]` instead of `$1`/`$2` so the generated struct field names are meaningful (`ItemIds` instead of `Column2`).
- **GetPrimary tolerates "no primary"** — Service layer translates both `ErrPhotoNotFound` (domain) and `shared.ErrNotFound` (postgres) into `nil, nil` so callers distinguish "no primary exists" from "lookup failed".
- **Wave 0 scaffolds with it.todo** — Downstream plans (61-02/03/04) have pre-existing test files to flip to real tests; CI stays green from day one because `it.todo` entries don't fail.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `shared.ErrNotFound` handling in itemphoto.Service.GetPrimary**
- **Found during:** Task 1 (Backend primary-photo lookup)
- **Issue:** Plan called out that `GetPrimary` should return `(nil, nil)` for no-rows. The postgres `itemphoto_repository.GetPrimary` wraps `pgx.ErrNoRows` as `shared.ErrNotFound`, not `ErrPhotoNotFound`. Relying only on `ErrPhotoNotFound` would let a "no primary photo" response bubble up as a 500.
- **Fix:** Service-layer `GetPrimary` checks `errors.Is(err, ErrPhotoNotFound) || errors.Is(err, shared.ErrNotFound)` and returns nil for either.
- **Files modified:** `backend/internal/domain/warehouse/itemphoto/service.go`
- **Verification:** Handler tests (`TestItemHandler_Detail_IncludesPrimaryPhotoURL`, plus the existing "no photos" path) stay green; build passes.
- **Committed in:** `fd08956`

**2. [Rule 3 - Blocking] Exported `NOW` constant from fixtures.ts**
- **Found during:** Task 2 (makeItemPhoto factory)
- **Issue:** Plan provided a makeItemPhoto template using `NOW`, but the existing `NOW` constant in `fixtures.ts` was file-local (not exported). Using it across the new factory required export.
- **Fix:** Added `export` keyword to the `NOW` declaration.
- **Files modified:** `frontend2/src/features/items/__tests__/fixtures.ts`
- **Verification:** `tsc --noEmit` passes, vitest suite green.
- **Committed in:** `c469204`

**3. [Rule 3 - Blocking] Used 204 mock Response with no content-type in itemPhotos.test.ts**
- **Found during:** Task 2 (setPrimary/upload tests)
- **Issue:** Plan's template suggested `new Response(null, { status: 204, headers: { "content-type": "application/json" } })`. `parseResponse` in api.ts calls `.json()` on any content-type containing "application/json", which fails on an empty body. Tests hit "Unexpected end of JSON input".
- **Fix:** Dropped the content-type header — `parseResponse` short-circuits when content-type is absent/not JSON.
- **Files modified:** `frontend2/src/lib/api/itemPhotos.test.ts`
- **Verification:** 4/4 tests pass, the existing items/api suite stays green.
- **Committed in:** `c469204`

**4. [Rule 3 - Blocking] Ran `bun run i18n:compile` to produce lingui message catalogs**
- **Found during:** Task 2 verification (full vitest run)
- **Issue:** `src/features/settings/__tests__/LanguagePage.test.tsx` failed with "Failed to resolve import '../../locales/en/messages.ts'". Lingui catalogs are gitignored and must be compiled before vitest runs. Not caused by this plan but required to clear the overall verification gate.
- **Fix:** Ran `bun run i18n:compile`.
- **Files modified:** None tracked (catalogs are gitignored).
- **Verification:** `vitest run` → 389 passed / 21 todo / 0 failed.
- **Committed in:** — (no commit; runtime artifacts only)

---

**Total deviations:** 4 auto-fixed (all Rule 3 — blocking issues resolved inline so verification could complete)
**Impact on plan:** All auto-fixes necessary to make the code compile/test. No scope creep. No plan semantics changed.

## Issues Encountered

- **Pre-existing test failure: `TestCleanupConfig_RetentionPeriodUsage`** in `backend/internal/jobs/cleanup_test.go` — asserts `now.Sub(now.AddDate(0,0,-N)).Hours()/24 == N`, which is off-by-one across DST transitions (observed expected 30, actual 29; expected 90, actual 89). Not touched in this plan; logged to `.planning/phases/61-item-photos/deferred-items.md` per the scope-boundary rule.

## Threat Flags

None — every new surface matches an entry in the plan's `<threat_model>`:
- New `GetPrimaryPhotosByItemIDs` query is workspace-scoped (T-61-02 mitigated).
- New `setPrimary` PUT call hits an existing handler with auth/workspace checks (T-61-05 accepted).
- New `thumbnail_status` field leaks coarse-grained job state, already accepted (T-61-03).

## Known Stubs

None — 6 Wave 0 test files use `it.todo` which is a documented coverage placeholder, not a runtime stub. No component files were created with placeholder data that flows to UI.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 61-02 (itemphoto service layer) can now consume the `setPrimary` / `thumbnail_status` surface.
- Plan 61-03 (gallery UI) can flip the 5 Wave 0 scaffolds to real tests using `makeItemPhoto` + `itemPhotosApi.upload/setPrimary/remove`.
- Plan 61-04 (items-list thumbnail column) can use `Item.primary_photo_thumbnail_url` directly from list responses, no extra fetch needed.
- `ItemThumbnailCell.test.tsx` is ready to flip to real tests in 61-04.

## Self-Check: PASSED

**File existence (sampled):**
- FOUND: backend/db/queries/item_photos.sql (modified)
- FOUND: backend/internal/infra/queries/item_photos.sql.go (regenerated)
- FOUND: backend/internal/domain/warehouse/itemphoto/handler.go (modified)
- FOUND: backend/internal/domain/warehouse/item/handler.go (modified)
- FOUND: frontend2/src/lib/api.ts (modified)
- FOUND: frontend2/src/lib/api/itemPhotos.ts (modified)
- FOUND: frontend2/src/lib/api/items.ts (modified)
- FOUND: frontend2/src/components/retro/RetroFileInput.tsx (modified)
- FOUND: frontend2/src/features/items/__tests__/fixtures.ts (modified)
- FOUND: frontend2/src/lib/api/itemPhotos.test.ts (created)
- FOUND: frontend2/src/features/items/photos/ItemPhotoGallery.test.tsx (created)
- FOUND: frontend2/src/features/items/photos/ItemPhotoGrid.test.tsx (created)
- FOUND: frontend2/src/features/items/photos/ItemPhotoTile.test.tsx (created)
- FOUND: frontend2/src/features/items/photos/ItemPhotoLightbox.test.tsx (created)
- FOUND: frontend2/src/features/items/photos/ItemThumbnailCell.test.tsx (created)

**Commit existence:**
- FOUND: fd08956 (Task 1)
- FOUND: c469204 (Task 2)

---
*Phase: 61-item-photos*
*Completed: 2026-04-16*
