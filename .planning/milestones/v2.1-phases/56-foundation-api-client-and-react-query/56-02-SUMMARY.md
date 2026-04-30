---
phase: 56
plan: 02
subsystem: frontend2/api-modules
tags: [react-query, tanstack, entity-api, query-keys, tdd]
completed: "2026-04-15"
duration_minutes: 12

dependency_graph:
  requires:
    - queryClient singleton (56-01 provides)
    - postMultipart helper in lib/api.ts (56-01 provides)
  provides:
    - frontend2/src/lib/api/items.ts (Item type + itemsApi + itemKeys)
    - frontend2/src/lib/api/itemPhotos.ts (ItemPhoto type + itemPhotosApi + itemPhotoKeys)
    - frontend2/src/lib/api/loans.ts (Loan type + loansApi + loanKeys)
    - frontend2/src/lib/api/borrowers.ts (Borrower type + borrowersApi + borrowerKeys)
    - frontend2/src/lib/api/categories.ts (Category type + categoriesApi + categoryKeys)
    - frontend2/src/lib/api/locations.ts (Location type + locationsApi + locationKeys)
    - frontend2/src/lib/api/containers.ts (Container type + containersApi + containerKeys)
    - frontend2/src/lib/api/index.ts (barrel re-export of all 7 modules)
  affects:
    - All v2.1 CRUD phases (57-63) — import *Api and *Keys from these modules
    - Phase 61 item photos — itemPhotosApi.upload exercises postMultipart

tech_stack:
  added: []
  patterns:
    - TK-dodo hierarchical query key factory (per D-03)
    - File-local toQuery helper (no premature shared util)
    - Co-located entity types in entity module (D-02)
    - workspaceId as opaque string parameter (D-01)
    - Lifecycle verbs matching backend reality (archive/restore vs delete vs return/extend)
    - TDD RED/GREEN cycle for all key factory behaviors

key_files:
  created:
    - frontend2/src/lib/api/items.ts
    - frontend2/src/lib/api/itemPhotos.ts
    - frontend2/src/lib/api/loans.ts
    - frontend2/src/lib/api/borrowers.ts
    - frontend2/src/lib/api/categories.ts
    - frontend2/src/lib/api/locations.ts
    - frontend2/src/lib/api/containers.ts
    - frontend2/src/lib/api/index.ts
    - frontend2/src/lib/api/__tests__/queryKeys.test.ts
  modified: []

decisions:
  - "Lifecycle verbs match backend exactly — no hard-delete on items (archive/restore only per Pitfall 6); borrowers support remove(); loans use return/extend not update"
  - "toQuery helper duplicated file-local in each entity module — 6 lines cheaper than a new shared util file before downstream CRUD phases land"
  - "LoanListResponse uses items[] envelope matching backend JSON shape; active/overdue lists also wrapped in same response type"
  - "ItemPhoto URL and thumbnail_url fields included from backend PhotoResponse (not in entity.go but present in handler response struct)"

metrics:
  tasks_completed: 2
  tasks_total: 2
  files_created: 9
  files_modified: 0
  tests_added: 35
  tests_passing: 35
---

# Phase 56 Plan 02: Entity API Modules Summary

**One-liner:** Seven typed entity API modules under `frontend2/src/lib/api/` with TK-dodo key factories, correct lifecycle verbs, and co-located types — satisfying SC-2 and unblocking all v2.1 CRUD phases.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Add failing queryKeys tests for items + itemPhotos | 8051c55 | src/lib/api/__tests__/queryKeys.test.ts |
| 1 (GREEN) | Create items.ts + itemPhotos.ts | fcb5c73 | src/lib/api/items.ts, src/lib/api/itemPhotos.ts |
| 2 (RED) | Extend queryKeys tests for 5 remaining entities | b30c9b5 | src/lib/api/__tests__/queryKeys.test.ts |
| 2 (GREEN) | Create loans/borrowers/categories/locations/containers + barrel | 6653e8c | 6 new files |

## Decisions Made

1. **Lifecycle verbs per entity match backend reality:** Items have `archive`/`restore` only (no hard-delete per 56-RESEARCH.md Pitfall 6). Borrowers have `remove()` (DELETE supported). Loans use `return` and `extend` (no generic update verb — the backend only exposes PATCH /{id}/extend). Categories and containers have `archive`/`restore`/`remove`. Locations have `archive`/`restore`/`remove`.

2. **toQuery duplicated file-local:** Each entity module contains its own 6-line `toQuery` helper rather than importing from a shared util. The plan explicitly preferred this: "duplication of 6 lines is cheaper than a new file." Will be unified if a shared api-utils module is ever created.

3. **Loan response uses `LoanListResponse { items: Loan[] }` envelope:** Backend returns `{ items: [...] }` for loan list (not an array directly), matching the handler's `loanListResponse` struct.

4. **ItemPhoto type adds `url` and `thumbnail_url`:** These fields appear in the backend's `PhotoResponse` handler struct but not in `entity.go`. They are included in the TypeScript type because they are present in every API response and are needed by photo-rendering consumers in phase 61.

## Deviations from Plan

None — plan executed exactly as written. The pre-existing Lingui locale compile failure (`LanguagePage.test.tsx`) was present before this plan and is unrelated to entity API modules.

## TDD Gate Compliance

- Task 1 RED gate commit: `8051c55` — `test(56-02): add failing queryKeys tests for items and itemPhotos (RED)`
- Task 1 GREEN gate commit: `fcb5c73` — `feat(56-02): create items.ts and itemPhotos.ts entity modules...`
- Task 2 RED gate commit: `b30c9b5` — `test(56-02): extend queryKeys tests for loans, borrowers, categories, locations, containers (RED)`
- Task 2 GREEN gate commit: `6653e8c` — `feat(56-02): create loans, borrowers, categories, locations, containers modules...`
- No REFACTOR gate needed (code was clean on first implementation)

## Known Stubs

None — these are pure API and key-factory modules with no UI components or data rendering.

## Threat Flags

None — no new network endpoints introduced. All entity modules route through the existing `request()` function in `lib/api.ts` which enforces JWT cookie auth and 401/refresh gate. The workspaceId parameter concern (T-56-06, cross-workspace stale keys) is documented in the plan's threat register and will be mitigated when downstream hooks (phases 57+) include workspaceId in `list(params)` calls.

## Verification Results

- `bunx tsc --noEmit`: PASSED (0 errors, strict TypeScript)
- `vitest run src/lib/api/__tests__/queryKeys.test.ts`: 35/35 passing (5 assertions × 7 entities)
- `vitest run src/lib/`: 48/48 passing (includes api.test.ts and api.multipart.test.ts from plan 56-01)
- `grep -l "from.*lib/types" src/lib/api/*.ts`: no hits (D-02 enforced — all entity types co-located)
- `grep -c "^export \* from" src/lib/api/index.ts`: 7 (all 7 modules re-exported)
- `grep -c "delete:\|remove:" src/lib/api/items.ts`: 0 (no hard-delete on items)

## Self-Check: PASSED

- `frontend2/src/lib/api/items.ts`: FOUND
- `frontend2/src/lib/api/itemPhotos.ts`: FOUND
- `frontend2/src/lib/api/loans.ts`: FOUND
- `frontend2/src/lib/api/borrowers.ts`: FOUND
- `frontend2/src/lib/api/categories.ts`: FOUND
- `frontend2/src/lib/api/locations.ts`: FOUND
- `frontend2/src/lib/api/containers.ts`: FOUND
- `frontend2/src/lib/api/index.ts`: FOUND (7 export * lines)
- `frontend2/src/lib/api/__tests__/queryKeys.test.ts`: FOUND (35 tests)
- Commits 8051c55, fcb5c73, b30c9b5, 6653e8c: all present in git log
