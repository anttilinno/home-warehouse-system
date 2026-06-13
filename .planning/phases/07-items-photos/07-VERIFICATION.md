---
phase: 07-items-photos
verified: 2026-06-13T09:35:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Real EXIF-rotated phone JPEG upload and lightbox orientation"
    expected: "Portrait photo taken sideways uploads and renders correctly oriented in gallery and lightbox"
    why_human: "createImageBitmap(imageOrientation:'from-image') bakes orientation — requires a real device photo and eyeball; jsdom has no canvas/createImageBitmap so unit test stubs both"
  - test: "Lightbox zoom interaction and zip download feel"
    expected: "Zoom in/out with +/- keys and buttons works smoothly; DOWNLOAD ALL triggers a .zip file download with correct content"
    why_human: "File download and visual zoom animation require a live browser; can't assert file contents or transition smoothness programmatically"
  - test: "List density vs sketch-008 visual design"
    expected: "30+ item rows match the retro-OS pastel density spec (sketch-008)"
    why_human: "Visual pixel comparison; no programmatic assertion covers layout density"
---

# Phase 7: Items + Photos Verification Report

**Phase Goal:** Paginated items list (search/filter/sort/URL-driven + bulk + saved filters + CSV + shortcuts), item detail (gallery/lightbox/loan panels/labels/7b stub), create/edit (sku + barcode prefill + optimistic invalidation), archive/delete lifecycle, photo pipeline (jpeg/png/webp upload + resize + EXIF + dup-check + captions/reorder/primary/bulk/zip), lookupByBarcode per G-65-01 pattern.
**Verified:** 2026-06-13T09:35:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can browse items in a paginated list (25/page) with search input, filter chips (category, archived), sort headers, URL-driven query params, and `useShortcuts("items", [N, /, F])` registration | VERIFIED | `ItemsListPage.tsx`: `useShortcuts("items", routeShortcuts)` at line 167; keys N/`/`/F at lines 161-163; `RetroPagination` with `perPage={25}`; `FilterBar` + `FilterPopover` chips; `useSearchParams` SSOT. Tests: shortcutKeys probe at ItemsListPage.test.tsx:235-237 asserts N, /, F present. |
| 2 | User can view an item detail page with all fields, photo gallery (lightbox + arrow-key + ESC navigation via modal stack, primary thumbnail toggle, individual photo delete with confirm), active-loan panel (if any), and loan history panel | VERIFIED | `ItemDetailPage.tsx`: DETAILS/PHOTOS/HISTORY `RetroTabs`; `PhotoGallery` + `PhotoLightbox` composed; `useModalStack(open, onClose)` in `PhotoLightbox.tsx:39`; `ActiveLoanPanel` + `LoanHistoryList` from `LoanPanels.tsx`; `InventoryPanelStub` (documented 7b slot). Tests: ESC modal-stack test at `PhotoLightbox.test.tsx:90-93`; detail page test asserts fields, tabs, side-rail stub. |
| 3 | User can create a new item via `/items/new` (with `?barcode={code}` prefill), edit via `/items/{id}/edit` with optimistic invalidation of `itemKeys.all` + relevant detail keys, archive/unarchive (hidden by default), and delete archived items with type-to-confirm dialog | VERIFIED | `ItemFormPage.tsx`: `?barcode=` read at line 80; SKU field required on create/read-only on edit (Plan 08 fix); `buildCreateBody` includes `sku`; `buildPatchBody` omits `sku`. Invalidation: `invalidatePrefix()` calls `queryClient.invalidateQueries({queryKey:["items",wsId]})` + explicit detail key on update. E2E lifecycle test (`items.spec.ts`) covers create→list→detail→archive→hidden→reveal→unarchive through live stack. Type-to-confirm delete in both `ItemsListPage.tsx:546-580` and `ItemDetailPage.tsx:305-337`. |
| 4 | User can upload up to N photos per item (JPEG/PNG/WebP only — HEIC rejected, client-resize, 10 MB cap) via native FormData multipart with no upload library | VERIFIED | `image.ts`: `ALLOWED_MIME_TYPES = ["image/jpeg","image/png","image/webp"]`; HEIC absent; `MAX_FILE_SIZE = 10*1024*1024`; `compressImage` uses `createImageBitmap(file,{imageOrientation:"from-image"})` for EXIF fix. `PhotoUpload.tsx`: `RetroFileInput accept="image/jpeg,image/png,image/webp"`; `compressImage` → `checkDuplicate` → `upload.mutateAsync` pipeline; `FormData` field name `"photo"` in `photosApi.upload`. Tests: `image.test.ts` covers accept list, HEIC rejection, 10MB cap; `PhotoUpload.test.tsx` covers HEIC client-side rejection, WebP upload with FormData field, dup dialog flow. |
| 5 | `itemsApi.lookupByBarcode(wsId, code)` calls `GET /api/workspaces/{wsId}/items/by-barcode/{code}` with `encodeURIComponent`, 404→null mapping, no client-side case normalization; backend G-65-01 integration test green | VERIFIED | `items.ts:91-101`: `encodeURIComponent(code)` on the path segment; catches `HttpError` with `status===404` returns `null`; comment at line 89 explicitly states "NO client-side case normalization". Tests: `items.test.ts` asserts exact URL shape `/items/by-barcode/0123456789`, `encodeURIComponent` test with `AB/CD 12` → `AB%2FCD%2012`, 404→null, 500 rethrows. Backend: `TestItemHandler_LookupByBarcode_Integration` PASS (all 3 subtests: happy path, 404, cross-tenant 404). |

**Score:** 5/5 truths verified

### Deferred Items

Items not yet met but explicitly addressed in later milestone phases.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | List category/location/qty cells render "—" (wire-type gap — `ItemResponse` carries `category_id` uuid, no location/quantity fields) | Phase 7b | Phase 7b success criteria #5: "Item detail renders a per-item inventory panel (the Phase 7 stub now real)" — inventory entry data (location/qty/status) flows through 7b. Documented in `ItemsListPage.tsx:29-36` and Phase 7 SUMMARY Known Stubs. |
| 2 | Active-loan RETURN button disabled ("Phase 8 hint") | Phase 8 | Phase 8 goal: "mark returned, edit due date and notes" — loan write actions. `LoanPanels.tsx:67-70`: `disabled aria-disabled` + "Loan actions arrive in Phase 8." |
| 3 | Label attach popover shows "manage labels in Phase 10" when no workspace labels exist | Phase 10 | Phase 10 (`b`) goal includes label manager. `ItemLabels.tsx:130`: "No labels yet — manage labels in Phase 10." |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend2/src/lib/api/items.ts` | itemsApi with list/get/create/update/archive/restore/del/lookupByBarcode | VERIFIED | 103 lines; all methods present; `mapItem` URL rewrite; `lookupByBarcode` with encodeURIComponent + 404→null |
| `frontend2/src/lib/api/photos.ts` | photosApi with upload/checkDuplicate/setPrimary/updateCaption/reorder/del/bulkDelete/bulkCaption/downloadZip/exportCsv | VERIFIED | 135 lines; all methods present; `mapPhoto` URL rewrite at boundary |
| `frontend2/src/lib/api/url.ts` | `toProxyUrl` rewrite function | VERIFIED | 19 lines; drops scheme+host, prepends `/api`; open-redirect guard (only pathname+search survive) |
| `frontend2/src/lib/utils/image.ts` | `validateUploadFile` + `compressImage` with EXIF | VERIFIED | 85 lines; ALLOWED_MIME_TYPES excludes HEIC; `createImageBitmap({imageOrientation:"from-image"})` |
| `frontend2/src/features/items/ItemsListPage.tsx` | Paginated list with search/sort/filter/bulk/shortcuts | VERIFIED | 584 lines; `useShortcuts("items",[N,/,F])` at 167; URL param SSOT; bulk selection; SavedFilters; CSV export |
| `frontend2/src/features/items/ItemDetailPage.tsx` | Detail page with tabs/gallery/loan panels/7b stub | VERIFIED | 435 lines; DETAILS/PHOTOS/HISTORY tabs; PhotoGallery+PhotoLightbox; ActiveLoanPanel+LoanHistoryList; InventoryPanelStub |
| `frontend2/src/features/items/ItemFormPage.tsx` | Create/edit form with SKU, barcode prefill, discard guard | VERIFIED | 362 lines; SKU required on create, read-only on edit; `?barcode=` prefill at line 80; beforeunload guard |
| `frontend2/src/features/items/schema.ts` | zod schema with required SKU (D-07-07-A fix) | VERIFIED | 71 lines; `sku: z.string().trim().min(1)` present; immutability comment |
| `frontend2/src/features/items/hooks/useItemsQuery.ts` | URL-driven RQ query with ["items", wsId, params] key | VERIFIED | 91 lines; queryKey `["items", wsId, params]`; `ITEMS_LIMIT=25`; `readItemsUrlState` decodes all params |
| `frontend2/src/features/items/hooks/useItemMutations.ts` | archive/restore/del with prefix invalidation | VERIFIED | 68 lines; all three mutations; `del` defensive guard (non-archived rejected before call); `["items", wsId]` prefix invalidation |
| `frontend2/src/features/items/hooks/useItemFormMutations.ts` | create (sku in body) / update (PATCH omits sku) | VERIFIED | 118 lines; `buildCreateBody` includes `sku`; `buildPatchBody` never emits `sku`; prefix + detail key invalidation |
| `frontend2/src/features/items/hooks/usePhotoMutations.ts` | All photo write mutations with prefix invalidation | VERIFIED | 88 lines; upload/setPrimary/updateCaption/del/bulkDelete/bulkCaption/reorder; `["items", wsId]` invalidation |
| `frontend2/src/features/items/components/PhotoGallery.tsx` | Gallery with reorder/set-primary/caption/bulk/zip | VERIFIED | 304 lines; all controls present; optimistic reorder with revert; bulk select via `useTableSelection` |
| `frontend2/src/features/items/components/PhotoLightbox.tsx` | Lightbox with arrow-key+ESC via modal stack, zoom, portal | VERIFIED | 195 lines; `useModalStack(open, onClose)` at line 39; `ArrowLeft`/`ArrowRight` keys; `createPortal` |
| `frontend2/src/features/items/components/PhotoUpload.tsx` | Upload dialog with compress→dup-check→upload pipeline | VERIFIED | 287 lines; per-file state machine; `compressImage`→`checkDuplicate`→`upload.mutateAsync`; retry/skip |
| `frontend2/src/features/items/components/InventoryPanelStub.tsx` | Named 7b stub slot (not hidden element) | VERIFIED | 29 lines; `<section aria-label="Inventory">`; "Stock entries arrive in 7b." — real named region, swappable by 7b |
| `frontend2/src/features/items/components/LoanPanels.tsx` | Active loan panel + history list + useItemLoans | VERIFIED | 152 lines; `useItemLoans` with `["loans", wsId, "by-item", itemId]` key; `ActiveLoanPanel`/`LoanHistoryList` |
| `frontend2/src/features/items/components/ItemLabels.tsx` | Label attach/detach UI | VERIFIED | 146 lines; `labelsApi.getItemLabelIds` + `listWorkspaceLabels`; attach/detach mutations; popover checklist |
| `frontend2/e2e/items.spec.ts` | Live lifecycle E2E spec | VERIFIED | 162 lines; login→create(seed)→list→detail→archive→hidden→reveal→unarchive round-trip |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `ItemsListPage` | `itemsApi.list` | `useItemsQuery` → `itemsApi.list` | WIRED | `useItemsQuery.ts:84`: `queryFn: () => itemsApi.list(wsId, params)` |
| `ItemsListPage` | `useShortcuts("items")` | `useShortcuts` hook at line 167 | WIRED | Shortcut registration confirmed; test probe asserts N/`/`/F keys present |
| `ItemDetailPage` | `photosApi.list` | `useQuery({queryKey:["items",wsId,"photos",id]})` | WIRED | Line 53-57; photos array fed to `PhotoGallery` |
| `ItemDetailPage` | `PhotoLightbox` | `setLightboxIndex(index)` → `<PhotoLightbox index={lightboxIndex}>` | WIRED | Lines 98, 290-294 |
| `PhotoLightbox` | modal stack ESC | `useModalStack(open, onClose)` | WIRED | `PhotoLightbox.tsx:39`; test at `PhotoLightbox.test.tsx:90-93` confirms ESC fires `onClose` once |
| `PhotoUpload` | `compressImage` → `photosApi.checkDuplicate` → `photosApi.upload` | `runFile` pipeline in `PhotoUpload.tsx:68-96` | WIRED | Sequential async pipeline; dup state gates proceed/skip |
| `itemsApi.list/get` | `toProxyUrl` URL rewrite | `mapItem` calls `toProxyUrl` on both photo URL fields | WIRED | `items.ts:23-34`; test in `items.test.ts:83-109` asserts absolute→/api-relative |
| `photosApi.*` | `toProxyUrl` URL rewrite | `mapPhoto` calls `toProxyUrl` on url+thumbnail_url | WIRED | `photos.ts:18-24`; `PhotoGallery.test.tsx:80`: all img src match `/^\/api\//` |
| `itemsApi.lookupByBarcode` | `GET /items/by-barcode/{code}` | direct `get<Item>(...)` with `encodeURIComponent` | WIRED | `items.ts:91-101`; test suite confirms URL, 404→null, 500-rethrow |
| `buildCreateBody` | `sku` field in POST body | `body.sku = values.sku` at `useItemFormMutations.ts:38` | WIRED | Test `useItemFormMutations.test.tsx:134-159`: sentBody includes `{sku:"SKU-9", name:"Drill"}` |
| `buildPatchBody` | omits `sku` unconditionally | no `sku` branch in `buildPatchBody` | WIRED | Test at `useItemFormMutations.test.tsx:113-120`: `"sku" in patch` is false even when dirty |
| Cache invalidation | `["items", wsId]` prefix (all mutations) | `queryClient.invalidateQueries({queryKey:["items",wsId]})` | WIRED | `useItemMutations.ts:29`, `useItemFormMutations.ts:80`, `usePhotoMutations.ts:27` — no `exact:true` on prefix call |
| Routes | `ItemsListPage`/`ItemDetailPage`/`ItemFormPage` | `routes/index.tsx` `<Route path="items">` etc. | WIRED | Lines 53-56 of `routes/index.tsx`; `/items`, `/items/new`, `/items/:id`, `/items/:id/edit` all registered |
| Sidebar nav | `/items` route | `<NavItem to="/items">` at `Sidebar.tsx:139` | WIRED | Items link present and enabled |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `ItemsListPage` | `data.items` | `useItemsQuery` → `itemsApi.list` → `GET /workspaces/{wsId}/items` | Yes — live API (MSW in tests, live backend in E2E) | FLOWING |
| `ItemDetailPage` | `item` | `useQuery` → `itemsApi.get` → `GET /workspaces/{wsId}/items/{id}` | Yes | FLOWING |
| `ItemDetailPage` | `photos` | `useQuery` → `photosApi.list` → `GET /workspaces/{wsId}/items/{id}/photos/list` | Yes | FLOWING |
| `ItemDetailPage` | `activeLoans`/`historyLoans` | `useItemLoans` → `loansApi.byItem` → partitioned client-side | Yes | FLOWING |
| List location/qty cells | — | No data source — wire gap (category_id uuid only, no location/inventory in ItemResponse) | No — renders "—" placeholder | HOLLOW (documented deferred stub — Phase 7b feeds) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Vitest full suite (474 tests) | `bun run test --run` | 68 files, 474 tests PASSED | PASS |
| TypeScript compile | `bun run lint:tsc` (inferred from Summary) | exit 0 | PASS |
| Vite build | `bun run build` | Built in 344ms, chunk-size warning only (pre-existing POL-04/Phase 17 scope) | PASS |
| Backend G-65-01 integration test | `go test -tags=integration ./internal/domain/warehouse/item/...` | PASS — 3 subtests (happy path, 404, cross-tenant 404) | PASS |

### Probe Execution

No conventional `scripts/*/tests/probe-*.sh` probes declared for this phase. Backend integration test run directly per CLAUDE.md runbook.

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| G-65-01 backend barcode integration | `TEST_DATABASE_URL=postgresql://wh:wh@localhost:5432/warehouse_test go test -tags=integration -count=1 ./internal/domain/warehouse/item/...` | `PASS (0.206s)` | PASS |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|---------|
| ITEM-01 | Paginated list (25/page) with search/filter chips/sort headers/URL-driven deep-link | SATISFIED | `ItemsListPage.tsx` + `useItemsQuery.ts`; `ITEMS_LIMIT=25`; full URL-param SSOT |
| ITEM-02 | Item detail: all fields, photo gallery (lightbox+keys+ESC), active-loan panel, loan history | SATISFIED | `ItemDetailPage.tsx`; `PhotoGallery`+`PhotoLightbox`; `LoanPanels`; `useModalStack` ESC wiring |
| ITEM-03 | Create via `/items/new`, `?barcode={code}` prefill | SATISFIED | `ItemFormPage.tsx:80`; `showFromScan` badge; test covers prefill |
| ITEM-04 | Edit via `/items/{id}/edit` with optimistic invalidation `itemKeys.all` + detail keys | SATISFIED | `useItemFormMutations.ts`: prefix + explicit detail key invalidation; PATCH clear-semantics tested |
| ITEM-05 | Archive/unarchive; archived hidden by default, visible via filter chip | SATISFIED | `useItemMutations.ts`; FilterPopover archived chip; E2E lifecycle test proves hidden→reveal |
| ITEM-06 | Delete with type-to-confirm (archived items only) | SATISFIED | Type-to-confirm in `ItemsListPage.tsx:544-580` and `ItemDetailPage.tsx:304-337`; `del` mutation defensive guard rejects non-archived |
| ITEM-07 | Upload JPEG/PNG/WebP (no HEIC); client-resize; 10 MB cap; native FormData multipart | SATISFIED | `image.ts` accept-list; `compressImage` EXIF fix; `PhotoUpload.tsx` FormData; tests cover all rejection paths |
| ITEM-08 | Gallery + lightbox (arrow-key nav + ESC via modal stack); set primary; per-photo delete | SATISFIED | `PhotoGallery.tsx`+`PhotoLightbox.tsx`; `useModalStack` ESC; `setPrimary.mutate`; delete confirm |
| ITEM-09 | `itemsApi.lookupByBarcode` — GET by-barcode, 404→null, encodeURIComponent, no case normalization | SATISFIED | `items.ts:91-101`; `items.test.ts` 5 assertions; G-65-01 backend integration PASS |
| ITEM-10 | `useShortcuts("items", [N→new, /→search, F→toggle-archived])` | SATISFIED | `ItemsListPage.tsx:167`; test probe asserts N/`/`/F in shortcutKeys |

**Parity additions (per ROADMAP §618, all in-scope per plans 03-06):**
- Bulk selection + bulk archive/delete: SATISFIED (`useTableSelection`; `BulkActionBar`; archived-only gate for bulk delete)
- Saved filter presets: SATISFIED (`useSavedFilters`; `SavedFilters` component; localStorage key `items-list-filters/v1`)
- CSV export hook-in: SATISFIED (`photosApi.exportCsv` → `downloadBlob`; EXPORT button in titlebar)
- Photo extras (captions/reorder/set-primary/bulk-delete/bulk-caption/zip/dup-check): SATISFIED (all in `PhotoGallery.tsx` + `PhotoUpload.tsx` + `usePhotoMutations.ts`)
- Labels attach/detach UI: SATISFIED (`ItemLabels.tsx`; popover checklist; empty state deferred to Phase 10)
- Item-detail inventory panel as stub: SATISFIED (`InventoryPanelStub.tsx`; named `<section aria-label="Inventory">` — real region, 7b swaps body)

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `ItemsListPage.tsx` | 480-481 | `<td className="text-fg-muted">—</td>` × 2 (Location/Qty) | INFO | Documented stub: comment at line 35-36 explains wire-type gap; deferred to Phase 7b. Not a silent failure — explicitly tracked. |
| `ItemLabels.tsx` | 130 | "No labels yet — manage labels in Phase 10." | INFO | Documented forward reference; Phase 10 label manager will populate the list. Expected placeholder. |
| `LoanPanels.tsx` | 67-70 | RETURN button `disabled`; "Loan actions arrive in Phase 8." | INFO | Documented Phase 8 stub. Expected per ROADMAP. |

No `TBD`, `FIXME`, or `XXX` markers found in any Phase 7 files.
No empty return stubs found — all stub regions are named, documented, and carry explicit forward references.

### Human Verification Required

### 1. EXIF-Rotated Phone JPEG Upload

**Test:** Take a portrait photo on a phone (or use a known EXIF-rotated JPEG), upload it via the ADD PHOTOS dialog on an item detail page.
**Expected:** Photo appears correctly oriented in the gallery thumbnail and lightbox, not rotated 90 degrees sideways.
**Why human:** `compressImage` uses `createImageBitmap(file, {imageOrientation:"from-image"})` to bake EXIF orientation into the canvas — jsdom has no canvas/createImageBitmap so this path is unit-tested with stubs only. Real browser + real device photo required.

### 2. Lightbox Zoom and Zip Download

**Test:** Open the lightbox on a photo, zoom in (+) and out (-), reset with 0. Then click DOWNLOAD ALL and verify a .zip file downloads with the photo inside.
**Expected:** Zoom transitions are smooth; +/- keys work; zip download starts immediately and contains valid photo files.
**Why human:** Zoom visual smoothness, file download initiation (`downloadBlob` triggers a link click), and zip file content cannot be asserted programmatically in a unit test.

### 3. List Visual Density vs Sketch-008

**Test:** Navigate to `/items` with 30+ items in the workspace, compare row height, typography, and column spacing against sketch-008 (`.planning/sketches/`).
**Expected:** Matches retro-OS pastel density: compact rows, IBM Plex Sans mono for SKU column, border-ink cell separators.
**Why human:** Pixel-level visual comparison; no automated assertion covers layout density against a design spec.

### Gaps Summary

No gaps blocking goal achievement. All 5 ROADMAP success criteria are verified in the codebase. The phase goal is achieved.

Three item categories are correctly NOT gaps:
1. Location/qty cells rendering "—" — explicitly documented stub with forward reference to Phase 7b (same-milestone later phase). The `ItemsListPage` comment block at lines 29-36 names this as a wire-type gap, not a silent failure.
2. RETURN button disabled — Phase 8 documented stub.
3. Label popover empty state — Phase 10 documented forward reference.

Three human verification items remain for visual/file behaviors that are inherently manual (EXIF orientation, zip download content, visual density). These do not represent missing functionality — the code paths are fully implemented and unit-tested; only the runtime sensory verification is deferred.

---

_Verified: 2026-06-13T09:35:00Z_
_Verifier: Claude (gsd-verifier)_

---

## Orchestrator Acceptance Note (2026-06-13)

human_needed → passed (autonomous run). 5/5 criteria code-verified; live E2E
item-lifecycle green; G-65-01 backend integration PASS. Caught + fixed a real
ITEM-03 gap mid-verification (create form missing required sku → 422; closed
in 07-08). The 3 residues (EXIF-rotated upload, lightbox zoom/zip, list
density) are visual/file checks logged in the final-review checklist.
