---
phase: 07-items-photos
plan: 01
subsystem: frontend-api-layer
tags: [items, photos, api-client, url-rewrite, lookupByBarcode, msw]
requires:
  - "frontend2/src/lib/api.ts (locked cookie-JWT client)"
provides:
  - "itemsApi (CRUD + archive/restore/delete + lookupByBarcode)"
  - "photosApi (multipart upload + JSON ops + bulk + blob download)"
  - "labelsApi / loansApi read+mutate helpers"
  - "toProxyUrl absolute->/api-relative photo URL rewrite"
  - "api.ts put + downloadBlob additive helpers"
  - "Item/Photo/Loan/Label/ItemListResponse/DuplicateInfo/DuplicateCheckResult types"
  - "MSW handlers for item/photo/loan/label/by-barcode routes"
affects:
  - "all Phase 7 feature plans (list/detail/forms/photo pipeline import from here)"
tech-stack:
  added: []
  patterns:
    - "URL rewrite at API mapper boundary (drop scheme+host, prefix /api)"
    - "404->null + encodeURIComponent for barcode lookup (Phase 65 locked pattern)"
    - "additive-only extension of locked api.ts (put mirrors patch; downloadBlob)"
key-files:
  created:
    - frontend2/src/lib/api/url.ts
    - frontend2/src/lib/api/url.test.ts
    - frontend2/src/lib/api/items.ts
    - frontend2/src/lib/api/items.test.ts
    - frontend2/src/lib/api/labels.ts
    - frontend2/src/lib/api/loans.ts
    - frontend2/src/lib/api/photos.ts
    - frontend2/src/lib/api/photos.test.ts
  modified:
    - frontend2/src/lib/api.ts
    - frontend2/src/lib/api.test.ts
    - frontend2/src/lib/types.ts
    - frontend2/src/test/msw/handlers.ts
decisions:
  - "loansApi does NOT rewrite embedded item.primary_photo_thumbnail_url (loan panels render borrower/dates, not the thumbnail); rewrite deferred to the consuming panel if it renders it"
  - "downloadBlob intentionally does NOT share request()'s 401 refresh path — a blob response is not JSON; a 401 surfaces as HttpError the caller routes"
metrics:
  duration: ~20m
  completed: 2026-06-13
requirements: [ITEM-09]
---

# Phase 7 Plan 01: Items + Photos API Layer Summary

Typed `itemsApi`/`photosApi`/`loansApi`/`labelsApi` boundary over the locked `api.ts`, plus the two load-bearing primitives every downstream Phase 7 plan depends on: additive `put`/`downloadBlob` helpers and the absolute→`/api`-relative photo URL rewrite (`toProxyUrl`). Re-adds `lookupByBarcode` (ITEM-09) per the locked Phase 65 pattern without touching the green backend integration test.

## What Was Built

**Task 1 — additive api.ts primitives + URL rewrite + types** (`8eb9402`)
- `put<T>(endpoint, data)` mirrors `patch` (method PUT) and flows through `request()`, inheriting `credentials:"include"` + the 401 single-flight refresh + retry path. JSON-only.
- `downloadBlob(endpoint, filename)`: `credentials:"include"` blob fetch, `HttpError(status)` on non-ok, object-URL anchor click + `revokeObjectURL`.
- `toProxyUrl(absolute)` in `lib/api/url.ts`: `new URL(...)` → `/api${pathname}${search}`; drops scheme+host (open-redirect guard T-07-01); parse failure → input unchanged.
- `types.ts`: `Item`, `Photo`, `Loan`, `Label`, `ItemListResponse`, `DuplicateInfo`, `DuplicateCheckResult` — typed only for fields this phase reads; `$schema` deliberately not modeled (Pitfall 7).
- Invariant-preservation tests prove get/patch/del signatures + `HttpError` thrown on non-ok are unchanged after the additions.

**Task 2 — itemsApi + labelsApi + loansApi** (`1cfc4aad`)
- `itemsApi`: `list` (omits empty params, rewrites primary-photo URLs), `get`, `create`, `update` (PATCH — no default injection, `""`=clear per Pitfall 4), `archive`/`restore`/`del`, and `lookupByBarcode`.
- `lookupByBarcode` (ITEM-09): `encodeURIComponent` path-injection guard (`AB/CD 12`→`AB%2FCD%2012`, T-07-02), 404→null, 500 rethrows, case-sensitive (no client normalization — Phase 65 D-07).
- `labelsApi`: `getItemLabelIds`/`attach`/`detach`/`listWorkspaceLabels`.
- `loansApi.byItem`: GET `/items/{itemId}/loans` → partition on `is_active` into `{active, history}` (Open Q2).

**Task 3 — photosApi + MSW handlers** (`8cb80793`)
- `photosApi`: `list`/`upload`/`checkDuplicate`/`setPrimary`/`updateCaption`/`reorder`/`del`/`bulkDelete`/`bulkCaption`/`downloadZip`/`exportCsv`.
- Every absolute `url`/`thumbnail_url` (and each `DuplicateInfo.thumbnail_url`) rewritten via `toProxyUrl` at the mapper boundary (Pitfall 1 / T-07-01).
- `upload` + `checkDuplicate` use FormData field name `photo`; `reorder` PUTs the full `{photo_ids}` ordered list.
- MSW handlers appended for items/by-barcode/labels/loans/photos with ABSOLUTE photo URLs in fixtures so consumer tests exercise the rewrite. Specific routes registered before `:id` catch-alls.

## Deviations from Plan

None — plan executed exactly as written. The plan's Task 3 verify command included `bun run test src/test/msw`; that path holds only the shared handlers (no spec file), so coverage of the handlers is via the full suite import (`onUnhandledRequest:"error"` makes any broken handler fail every test). Full suite + tsc + import-lint all green.

## Authentication Gates

None.

## Verification

- `cd frontend2 && bun run test` → 56 files, 372 tests passed.
- `cd frontend2 && bun run lint:tsc` → clean (exit 0).
- `cd frontend2 && bun run lint:imports` → OK.
- Per-task: api.test.ts+url.test.ts (18), items.test.ts (12), photos.test.ts (14) all green.
- Backend `-tags=integration` item suite UNTOUCHED (zero backend files changed — confirmed via `git diff --name-only` scope check).

## Scope Confirmation

Files changed are confined to plan territory (`lib/api*`, `lib/types.ts`, `test/msw/`). No backend, STATE.md, ROADMAP.md, vite.config.ts, or `lib/utils/image*` (plan 07-02 territory) touched.

## Self-Check: PASSED
