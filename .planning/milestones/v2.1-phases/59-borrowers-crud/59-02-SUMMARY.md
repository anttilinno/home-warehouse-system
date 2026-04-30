---
phase: 59-borrowers-crud
plan: 02
subsystem: frontend
tags: [frontend, borrower, api-client, zod, fixtures, react-query]

# Dependency graph
requires:
  - phase: 56-foundation-api-client-and-react-query
    provides: borrowersApi CRUD surface, borrowerKeys, HttpError helpers
  - phase: 57-retro-form-primitives
    provides: RetroFormField, RetroConfirmDialog, ToastProvider, useToast
  - phase: 58-taxonomy-categories-locations-containers
    provides: archive-first pattern reference, EntityPanel/SlideOverPanel, taxonomy fixtures to re-export
provides:
  - borrowersApi.archive + borrowersApi.restore client methods
  - BorrowerListParams.archived filter (undefined omits query key)
  - borrowerCreateSchema + borrowerUpdateSchema (zod, UX-bound)
  - BorrowerCreateValues + BorrowerUpdateValues inferred types
  - frontend2/src/features/borrowers/icons.tsx (8 inline SVGs incl. Trash2, ArrowLeft)
  - frontend2/src/features/borrowers/__tests__/fixtures.tsx (makeBorrower + re-exports)
affects: [59-03-borrower-forms-mutations, 59-04-borrower-list-detail-pages, 62-loans]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "archive/restore API methods mirror categoriesApi pattern"
    - "zod email optional + .or(z.literal('')) for controlled RHF inputs"
    - "Test fixtures re-export shared utilities from taxonomy fixtures to avoid duplication"

key-files:
  created:
    - frontend2/src/features/borrowers/forms/schemas.ts
    - frontend2/src/features/borrowers/icons.tsx
    - frontend2/src/features/borrowers/__tests__/fixtures.tsx
  modified:
    - frontend2/src/lib/api/borrowers.ts
    - frontend2/src/lib/api/__tests__/queryKeys.test.ts

key-decisions:
  - "UX-level length caps (name 120, email 254, phone 40, notes 1000) are stricter than backend (name 255, others unbounded) so the form trims before submit"
  - ".or(z.literal('')) on email to allow controlled empty inputs without triggering format validator; BorrowerForm (59-03) coerces '' to undefined before API call"
  - "Icons re-created inline (no lucide-react) preserving v2.0 no-runtime-deps lock"
  - "Fixtures re-export TestAuthContext/renderWithProviders/setupDialogMocks from taxonomy fixtures (single Lingui init idempotent)"

patterns-established:
  - "Entity API archive/restore: post<void>(`${base(wsId)}/${id}/archive`) — exact mirror of categoriesApi"
  - "Entity fixtures factory: makeBorrower(overrides) with sensible defaults + spread override for any field"

requirements-completed: [BORR-01, BORR-02, BORR-03]

# Metrics
duration: 5min
completed: 2026-04-16
---

# Phase 59 Plan 02: Borrower API Surface + Forms Contract Summary

**Extended borrowersApi with archive/restore + archived list filter, added zod create/update schemas with UX-bound validation, and seeded feature icons + test fixtures so Plans 59-03 and 59-04 can build against stable exports.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-16T09:21:05Z
- **Completed:** 2026-04-16T09:26:04Z
- **Tasks:** 3 (all autonomous, all TDD where applicable)
- **Files modified:** 2 (borrowers.ts, queryKeys.test.ts)
- **Files created:** 3 (schemas.ts, icons.tsx, fixtures.tsx)

## Accomplishments

- `borrowersApi.archive(wsId, id)` and `borrowersApi.restore(wsId, id)` hit the backend archive/restore endpoints shipped by Plan 59-01
- `BorrowerListParams.archived?: boolean` threads through `toQuery` — undefined omits the key, matching the backend default of "active only"
- `borrowerCreateSchema` rejects empty name, 121-char name, and invalid email format; accepts empty-string email (for RHF controlled inputs); `borrowerUpdateSchema` is the `.partial()` variant
- `BorrowerCreateValues` / `BorrowerUpdateValues` inferred from zod schemas, ready to consume in Plan 59-03's BorrowerForm
- `icons.tsx` provides 8 inline SVG icons (6 copied from taxonomy + 2 new: Trash2, ArrowLeft) with no `lucide-react` dep
- `__tests__/fixtures.tsx` exports `makeBorrower` factory and re-exports `TestAuthContext`, `renderWithProviders`, `setupDialogMocks` from taxonomy fixtures

## Task Commits

1. **Task 1 RED: borrowerKeys archived distinguishability test** — `ce145f0` (test)
2. **Task 1 GREEN: archive/restore + archived list filter on borrowersApi** — `62a1008` (feat)
3. **Task 2: borrower zod create/update schemas + inferred types** — `287b462` (feat)
4. **Task 3: borrower feature icons + test fixtures** — `0d7cfdb` (feat)

## Files Created/Modified

- `frontend2/src/lib/api/borrowers.ts` — added `archived?: boolean` to `BorrowerListParams`, added `archive` and `restore` methods on `borrowersApi` (modified)
- `frontend2/src/lib/api/__tests__/queryKeys.test.ts` — added distinguishability test: `borrowerKeys.list({page,limit})` !== `borrowerKeys.list({page,limit,archived:true})` (modified)
- `frontend2/src/features/borrowers/forms/schemas.ts` — `borrowerCreateSchema`, `borrowerUpdateSchema`, inferred value types (created)
- `frontend2/src/features/borrowers/icons.tsx` — 8 inline SVG icons, no `lucide-react` dep (created)
- `frontend2/src/features/borrowers/__tests__/fixtures.tsx` — `makeBorrower` factory + re-exports from taxonomy fixtures (created)

## Exports Surfaced

**`frontend2/src/lib/api/borrowers.ts`:**
- types: `Borrower`, `BorrowerListResponse`, `BorrowerListParams` (now with `archived?: boolean`), `CreateBorrowerInput`, `UpdateBorrowerInput`
- API object: `borrowersApi` — added `archive`, `restore` alongside existing `list/get/create/update/remove`
- keys: `borrowerKeys` (unchanged — structural params already handle the new `archived` field)

**`frontend2/src/features/borrowers/forms/schemas.ts`:**
- schemas: `borrowerCreateSchema`, `borrowerUpdateSchema`
- types: `BorrowerCreateValues`, `BorrowerUpdateValues`

**`frontend2/src/features/borrowers/icons.tsx`:**
- inline SVGs: `ChevronRight`, `ChevronDown`, `Pencil`, `Archive`, `Undo2`, `Plus`, `Trash2`, `ArrowLeft`

**`frontend2/src/features/borrowers/__tests__/fixtures.tsx`:**
- factory: `makeBorrower`
- re-exports: `TestAuthContext`, `renderWithProviders`, `setupDialogMocks` (from taxonomy fixtures)

## Decisions Made

- **UX caps stricter than backend:** name 120 (backend 255), email 254 (backend unbounded), phone 40 (backend unbounded), notes 1000 (backend unbounded). Aligned with UI-SPEC bounds for consistency with category/location/container forms.
- **Empty-string email allowed via `.or(z.literal(""))`:** Enables controlled RHF inputs without spurious "Enter a valid email address" errors on empty state. The submit handler in Plan 59-03 coerces empty strings to undefined before calling the API.
- **Fixtures re-export from taxonomy:** Avoids duplicating `renderWithProviders` / `setupDialogMocks` / `TestAuthContext`. The Lingui `i18n.load("en", {}); i18n.activate("en")` side effect is idempotent and fires once at taxonomy fixtures module load.
- **Icons re-created inline:** v2.0 no-runtime-deps lock forbids `lucide-react`; copied the 6 taxonomy icons verbatim and added `Trash2` + `ArrowLeft` with matching stroke/viewBox conventions.

## Deviations from Plan

None — plan executed exactly as written. All three tasks followed the specified action steps, verification commands passed, and no auto-fix rules were triggered.

## Issues Encountered

**Initial install:** `bun run test` failed with "vitest: command not found" because the worktree had no `node_modules/`. Resolved by running `bun install` (327ms, 371 packages) — standard worktree setup, not a plan issue.

**Initial typecheck:** `bun run build` failed on `src/lib/i18n.ts` lines 13/14 complaining that `../../locales/en/messages.ts` and `../../locales/et/messages.ts` don't exist. Resolved by running `bun run i18n:compile`, which is the standard Lingui compile step (pre-existing project requirement, not a plan gap).

## Verification Summary

- `bun run build` → passes (tsc -b clean, vite bundled in 345ms)
- `bun run test -- --run src/lib/api/__tests__/queryKeys.test.ts` → 36/36 tests pass
- `bun run test -- --run` (full suite) → 280/280 tests pass across 47 test files
- `bun run lint:imports` → passes (no idb/serwist/offline/sync imports added)

## Schema Behavior Verification (direct parse smoke test)

Ad-hoc smoke test of schema behavior confirmed all RED assertions GREEN:

- `borrowerCreateSchema.parse({name: ""})` throws "Name is required."
- `borrowerCreateSchema.parse({name: "x".repeat(121)})` throws "Must be 120 characters or fewer."
- `borrowerCreateSchema.parse({name: "Alice"})` returns `{name: "Alice"}`
- `borrowerCreateSchema.parse({name: "Alice", email: ""})` returns `{name: "Alice", email: ""}`
- `borrowerCreateSchema.parse({name: "Alice", email: "not-an-email"})` throws "Enter a valid email address."
- `borrowerUpdateSchema.parse({})` returns `{}`

No sqlc-vs-frontend type mismatches caught — Phase 59-01's backend Borrower shape matches the existing frontend `Borrower` interface exactly, and the new `archived` query param is consistent with backend query-param parsing.

## TDD Gate Compliance

- Task 1: RED (`ce145f0` test) → GREEN (`62a1008` feat) — gate sequence correct.
- Tasks 2 and 3: behavior-only verification via build + smoke test; no new test files were required by the plan (success criteria rely on build + grep), so traditional RED/GREEN commit pairing is not applicable. Schemas and fixtures/icons are leaf artifacts consumed by Plans 59-03 and 59-04.

## User Setup Required

None — no external service configuration required. No new runtime dependencies added. Existing `bun install` + `bun run i18n:compile` flow unchanged.

## Next Phase Readiness

- Plan 59-03 (Forms + Mutation Hooks) can now `import { borrowerCreateSchema, borrowerUpdateSchema } from "@/features/borrowers/forms/schemas"` and `import { borrowersApi } from "@/lib/api/borrowers"` (with archive/restore ready) without additional codebase exploration.
- Plan 59-04 (List + Detail Pages) can import icons (`Pencil`, `Archive`, `Undo2`, `Plus`, `Trash2`, `ArrowLeft`) and test fixtures (`makeBorrower`, `renderWithProviders`, `setupDialogMocks`) directly.
- No blockers for the next plan in the wave.

## Self-Check: PASSED

**Files verified present:**
- `frontend2/src/lib/api/borrowers.ts` FOUND
- `frontend2/src/lib/api/__tests__/queryKeys.test.ts` FOUND
- `frontend2/src/features/borrowers/forms/schemas.ts` FOUND
- `frontend2/src/features/borrowers/icons.tsx` FOUND
- `frontend2/src/features/borrowers/__tests__/fixtures.tsx` FOUND

**Commits verified in git log:**
- `ce145f0` FOUND — test(59-02): add archived filter distinguishability for borrowerKeys
- `62a1008` FOUND — feat(59-02): add archive/restore + archived list filter to borrowersApi
- `287b462` FOUND — feat(59-02): add borrowerCreateSchema + borrowerUpdateSchema
- `0d7cfdb` FOUND — feat(59-02): add borrower feature icons + test fixtures

---
*Phase: 59-borrowers-crud*
*Completed: 2026-04-16*
