---
phase: 60-items-crud
plan: 02
subsystem: frontend
tags: [frontend, items, api-client, zod, react-query, mutation-hooks, tdd]

# Dependency graph
requires:
  - phase: 56-foundation-api-client-and-react-query
    provides: itemsApi base CRUD surface, itemKeys, HttpError helpers, del helper
  - phase: 57-retro-form-primitives
    provides: useToast, ToastProvider
  - phase: 58-taxonomy-categories-locations-containers
    provides: taxonomy fixtures to re-export (TestAuthContext, renderWithProviders, setupDialogMocks)
  - phase: 59-borrowers-crud
    provides: Reference pattern for 5-mutation-hook file + icons.tsx + fixtures re-export layout
provides:
  - itemsApi.delete(wsId, id) DELETE client method
  - ItemListParams with Phase 60 backend contract (search/category_id/archived/sort/sort_dir, no needs_review, no location_id)
  - Typed sort/sort_dir unions preventing ad-hoc string injection
  - itemCreateSchema + itemUpdateSchema zod schemas (name/sku/barcode/description/category_id)
  - generateSku() client helper producing ITEM-{base36 ts}-{4char base36 rand}
  - useItemsList(params) query hook with placeholderData for flicker-free pagination
  - useItem(id) detail query hook
  - useCategoryNameMap() name resolver with archived:true passthrough (Pitfall 7)
  - useCreateItem / useUpdateItem / useArchiveItem / useRestoreItem / useDeleteItem mutation hooks
  - isSkuCollision() predicate mapping 400 "SKU already" to specific toast
  - features/items/icons.tsx (8 inline SVG components)
  - features/items/__tests__/fixtures.ts (makeItem factory + re-exports)
affects: [60-03-items-ui, 60-04-items-detail, 62-loans]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Typed sort unions (not strings) for list params — compile-time rejection of invalid sort keys"
    - "placeholderData: (prev) => prev for TanStack Query v5 smooth pagination (replaces v4 keepPreviousData)"
    - "qc.removeQueries BEFORE qc.invalidateQueries on delete — prevents back-nav flash of stale deleted entity (Pitfall 9)"
    - "isSkuCollision HttpError predicate for domain-specific 400 mapping (Pitfall 6)"
    - "vi.hoisted for mock fn bindings referenced inside vi.mock factories"
    - "archived:true in category name-resolver fetch — historical-category names still resolve (Pitfall 7)"

key-files:
  created:
    - frontend2/src/features/items/icons.tsx
    - frontend2/src/features/items/forms/schemas.ts
    - frontend2/src/features/items/hooks/useItemsList.ts
    - frontend2/src/features/items/hooks/useItem.ts
    - frontend2/src/features/items/hooks/useCategoryNameMap.ts
    - frontend2/src/features/items/hooks/useItemMutations.ts
    - frontend2/src/features/items/__tests__/fixtures.ts
    - frontend2/src/features/items/__tests__/schemas.test.ts
    - frontend2/src/features/items/__tests__/useCategoryNameMap.test.ts
    - frontend2/src/features/items/__tests__/useItemMutations.test.ts
  modified:
    - frontend2/src/lib/api/items.ts
    - frontend2/src/lib/api/__tests__/queryKeys.test.ts

key-decisions:
  - "itemsApi.delete uses the reserved-ish keyword 'delete' as method name (matches Phase 60 plan intent). No TS/ESLint error observed; no need to fall back to 'remove' like borrowersApi."
  - "ItemListParams removed needs_review and location_id fields that no call site in features/ was using; the only call site is ApiDemoPage.tsx which passes only page/limit — no breakage."
  - "sort typed as union 'name' | 'sku' | 'created_at' | 'updated_at', sort_dir as 'asc' | 'desc' — compile-time rejection of bad sort keys while backend enum enforcement remains authoritative."
  - "CreateItemInput retains all optional fields (brand, model, warranty, obsidian, needs_review) even though Phase 60 form surfaces only 5 — backend still returns and accepts them. No interface change."
  - "HttpError constructor signature confirmed: new HttpError(status: number, message: string) — tests construct instances directly."
  - "generateSku format: ITEM-{base36 ms timestamp, UPPER}-{4 char base36, UPPER}. Observed samples pass /^ITEM-[A-Z0-9]+-[A-Z0-9]{4}$/."
  - "useToast contract in retro barrel returns only { addToast }; tests mock it as such (no 'clear' method)."
  - "Test files use React.createElement for provider wrappers to keep .test.ts extension (matches useCategoryMutations test pattern in taxonomy)."
  - "vi.hoisted required in useItemMutations.test.ts because mock fn bindings (addToast, itemsApiMock) are referenced inside vi.mock factories which hoist above their declaration."

patterns-established:
  - "Mutation file layout: 5 exported hooks in one file, each uses useAuth + useQueryClient + useToast + useLingui, onSuccess invalidates <entity>Keys.all, onError toasts generic message"
  - "Feature-specific 400 error mapping via predicate helper (isSkuCollision) inside the hook module"
  - "Delete with onAfterDelete option for navigation: useDeleteItem({ onAfterDelete: () => navigate('..') })"

requirements-completed: [ITEM-01, ITEM-02, ITEM-03, ITEM-04, ITEM-05, ITEM-06, ITEM-07, ITEM-08]

# Metrics
duration: ~8min
completed: 2026-04-16
---

# Phase 60 Plan 02: Items API Client & React Query Substrate Summary

**Extended itemsApi with a delete method and typed list params matching the Phase 60 backend, added zod schemas + SKU generator for item forms, shipped two query hooks and five mutation hooks with Pitfall 6/7/9 mitigations baked in, and laid down the icons module + test fixtures so Plans 60-03 and 60-04 can consume stable exports.**

## Performance

- **Duration:** ~8 min
- **Tasks:** 4 (all autonomous, TDD flavour with test-alongside implementation per task)
- **Files modified:** 2 (items.ts, queryKeys.test.ts)
- **Files created:** 10 (icons, schemas, 4 hooks, fixtures, 3 test files)
- **Tests added:** 28 (5 queryKeys + 9 schemas + 4 useCategoryNameMap + 10 useItemMutations)
- **Tests in full suite after this plan:** 333 passing across 55 files (no regressions)

## Accomplishments

- `itemsApi.delete(wsId, id)` hits `DELETE /workspaces/{wsId}/items/{id}` via the `del` helper
- `ItemListParams` now matches the Phase 60 backend contract: `page/limit/search/category_id/archived/sort/sort_dir` — with `sort` typed as `"name" | "sku" | "created_at" | "updated_at"` and `sort_dir` as `"asc" | "desc"`
- `needs_review` and `location_id` removed from `ItemListParams` (fields on `CreateItemInput` / `Item` left alone — backend still accepts/returns them)
- `itemCreateSchema` validates name (max 200), sku (max 64, `[A-Za-z0-9_-]+`), barcode (max 64, `[A-Za-z0-9]+`, optional), description (max 2000, optional), category_id (UUID, optional)
- `generateSku()` produces strings matching `/^ITEM-[A-Z0-9]+-[A-Z0-9]{4}$/` (example: `ITEM-LVLWLCNF-31BI`)
- `useItemsList(params)` returns the full TanStack Query result with `placeholderData: (prev) => prev` for flicker-free page transitions
- `useItem(id)` is safe to call with undefined id (enabled gate)
- `useCategoryNameMap()` requests `archived: true` so historical-category names still resolve on items assigned to a later-archived category; staleTime 60_000; returns `{map, isPending, isError}`
- `useCreateItem` / `useUpdateItem` map 400 errors containing "sku" to a specific toast "That SKU is already in use. Please regenerate or choose another." — everything else falls through to a generic save-failure toast (T-60-15: no backend leakage)
- `useDeleteItem` accepts `{ onAfterDelete }` option and calls `qc.removeQueries({ queryKey: itemKeys.detail(id) })` BEFORE `qc.invalidateQueries({ queryKey: itemKeys.all })` — Pitfall 9 prevents back-navigation flashing the deleted entity
- `useDeleteItem` has NO active-loans (400) branch — items have no equivalent guard (D-04); the test asserts this by rejecting with `HttpError(400, "active loans")` and verifying the generic "Could not delete item. Try again." toast fires
- All hooks read `workspaceId` via `useAuth()` (T-60-16 mitigation — no external workspaceId accepted)
- `features/items/icons.tsx` provides 8 SVG components (Pencil, Archive, Undo2, Trash2, ArrowLeft, Plus, ChevronRight, ChevronDown) copied verbatim from borrowers/icons.tsx
- `features/items/__tests__/fixtures.ts` provides `makeItem(overrides)` factory + re-exports of shared utilities

## Task Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | e9b1937 | `feat(60-02): add itemsApi.delete, update ItemListParams to match backend contract` |
| 2 | d4cf4e3 | `feat(60-02): add item form zod schemas, generateSku, icons, test fixtures` |
| 3 | 7541e6a | `feat(60-02): add useItemsList, useItem, useCategoryNameMap query hooks` |
| 4 | 352b8d9 | `feat(60-02): add useItemMutations with 5 mutation hooks + SKU collision mapping` |

## Verification Gates

All plan acceptance criteria met:

- `cd frontend2 && bun run test -- --run src/lib/api/__tests__/queryKeys.test.ts` — 41 passed
- `cd frontend2 && bun run test -- --run src/features/items/__tests__/` — 23 passed across 3 files
- `cd frontend2 && bun run build` — green (tsc + vite both clean)
- `cd frontend2 && bun run lint:imports` — green (no idb/serwist/offline/sync imports)
- Full test suite: 333 passed across 55 files (no regressions)

Grep-verifiable acceptance checks:

- `items.ts` contains `import { get, post, patch, del } from "@/lib/api"` ✓
- `items.ts` contains `delete: (wsId: string, id: string) => del<void>` ✓
- `items.ts` contains `sort?: "name" | "sku" | "created_at" | "updated_at"` ✓
- `items.ts` contains `sort_dir?: "asc" | "desc"` ✓
- `ItemListParams` no longer contains `needs_review` or `location_id` (confirmed via diff context) ✓
- `queryKeys.test.ts` contains `discriminates by archived flag` ✓
- `forms/schemas.ts` contains `export const itemCreateSchema` and `export function generateSku` ✓
- `forms/schemas.ts` contains both `/^[A-Za-z0-9_-]+$/` (SKU) and `/^[A-Za-z0-9]+$/` (barcode) regexes ✓
- `__tests__/fixtures.ts` contains `export function makeItem` and `TestAuthContext` re-export ✓
- `hooks/useItemsList.ts` contains `placeholderData: (prev) => prev` and `enabled: !!workspaceId` ✓
- `hooks/useItem.ts` contains `enabled: !!workspaceId && !!id` ✓
- `hooks/useCategoryNameMap.ts` contains `archived: true`, `staleTime: 60_000`, `new Map<string, string>` ✓
- `hooks/useItemMutations.ts` exports all 5 hooks, `function isSkuCollision`, `qc.removeQueries({ queryKey: itemKeys.detail(id) })`, `opts?.onAfterDelete?.()` ✓
- `hooks/useItemMutations.ts` does NOT contain `active loans` or `HasActiveLoans` (grep exits 1) ✓

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing frontend2/node_modules in worktree**

- **Found during:** Task 1 verification
- **Issue:** Fresh worktree had no installed dependencies so `vitest` was not on PATH
- **Fix:** Ran `bun install` inside `frontend2/` worktree directory
- **Files modified:** None (transient)

**2. [Rule 3 - Blocking] Missing compiled Lingui catalogs in worktree**

- **Found during:** Task 1 build verification
- **Issue:** `locales/en/messages.ts` and `locales/et/messages.ts` were generated files absent from fresh worktree; TypeScript build failed with "Cannot find module"
- **Fix:** Ran `bun run i18n:compile` to generate catalog files
- **Files modified:** locale generated outputs (not tracked in plan)

**3. [Rule 1 - Bug] vi.hoisted needed for mock fn bindings in useItemMutations.test.ts**

- **Found during:** Task 4 first test run
- **Issue:** Initial test file declared `const addToast = vi.fn()` and `const itemsApiMock = {...}` at module scope above `vi.mock(...)` factories. vi.mock is hoisted above imports; the factory tried to close over bindings that didn't yet exist, causing `ReferenceError: Cannot access 'itemsApiMock' before initialization`.
- **Fix:** Wrapped both mock fn bindings in `vi.hoisted(() => ({ addToast: vi.fn(), itemsApiMock: {...} }))` so they initialize at the same hoisted phase as the mock factories.
- **Files modified:** frontend2/src/features/items/__tests__/useItemMutations.test.ts

### No Architectural Changes (Rule 4)

No Rule 4 checkpoint needed. Plan executed with only mechanical environment fixes.

## Auth Gates

None — plan is pure frontend TS, no backend or auth interaction.

## Known Stubs

None. Every hook ships with a real implementation and is fully exercised by tests. Plans 60-03/60-04 will wire these hooks into UI components.

## Threat Flags

None. All surface introduced in this plan maps to existing `<threat_model>` entries (T-60-13 through T-60-19). No new trust boundaries.

## Gotchas Encountered

- **Worktree vs. main-repo paths:** Initial edits accidentally targeted the main-repo copy at `/home/antti/Repos/Misc/home-warehouse-system/frontend2/...` instead of the worktree at `.claude/worktrees/agent-a224affb/frontend2/...`. Detected after first commit attempt showed `nothing to commit`. Reverted main-repo changes via `git checkout --` and redid the edits against worktree paths. All subsequent work stayed inside the worktree.
- **useToast contract:** The retro toast context only exposes `{ addToast }` — no `clear` method. Tests initially specced a `clear: vi.fn()` mock field which would have silently typed ok but wasn't needed; dropped it to match the real contract.
- **JSX in .test.ts:** The plan spec used inline JSX in the `.test.ts` files. Existing taxonomy mutation tests use `React.createElement` to keep the `.test.ts` extension. Followed the existing convention.
- **Bun's `bun run test --` argument passing:** Worked correctly: `bun run test -- --run src/features/items/__tests__/...` forwarded the filter to vitest.

## Self-Check: PASSED

Created files exist:

- frontend2/src/features/items/icons.tsx — FOUND
- frontend2/src/features/items/forms/schemas.ts — FOUND
- frontend2/src/features/items/hooks/useItemsList.ts — FOUND
- frontend2/src/features/items/hooks/useItem.ts — FOUND
- frontend2/src/features/items/hooks/useCategoryNameMap.ts — FOUND
- frontend2/src/features/items/hooks/useItemMutations.ts — FOUND
- frontend2/src/features/items/__tests__/fixtures.ts — FOUND
- frontend2/src/features/items/__tests__/schemas.test.ts — FOUND
- frontend2/src/features/items/__tests__/useCategoryNameMap.test.ts — FOUND
- frontend2/src/features/items/__tests__/useItemMutations.test.ts — FOUND

Modified files contain expected edits:

- frontend2/src/lib/api/items.ts — delete method + typed ItemListParams confirmed via post-edit read
- frontend2/src/lib/api/__tests__/queryKeys.test.ts — 5 new tests confirmed via post-edit read

Commits exist:

- e9b1937 (Task 1) — FOUND in git log
- d4cf4e3 (Task 2) — FOUND in git log
- 7541e6a (Task 3) — FOUND in git log
- 352b8d9 (Task 4) — FOUND in git log
