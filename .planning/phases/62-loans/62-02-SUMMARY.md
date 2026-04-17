---
phase: 62-loans
plan: 02
subsystem: frontend-data-layer
tags: [frontend, loans, api, hooks, react-query, tanstack-v5, invalidation]

# Dependency graph
requires:
  - phase: 62-01
    provides: PATCH /workspaces/{ws}/loans/{id} + LoanResponse shape with item + borrower embeds
  - phase: 60-items-crud
    provides: itemKeys factory (all/lists/detail)
  - phase: 59-borrowers-crud
    provides: borrowerKeys factory (all/lists/detail)
provides:
  - Loan TS interface with required item + borrower decoration matching 62-01 backend shape
  - loansApi.update (PATCH /loans/{id}) + loansApi.listForItem (GET /inventory/{id}/loans)
  - loanKeys.forItem + loanKeys.forBorrower tuple keys
  - Five query hooks (Active / Overdue / History / ForItem / ForBorrower)
  - Three mutation hooks (Create / Update / Return) with UI-SPEC-verified invalidation sets
  - Phase 62 loans icons barrel (inline SVG, matches items/borrowers convention)
  - Loan test fixtures with makeLoan factory including embedded decoration
affects: [62-03, 62-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TanStack Query v5 placeholderData: (prev) => prev for smooth pagination (NOT v4 keepPreviousData)"
    - "Partition hooks (useLoansForItem/ForBorrower): pure useMemo over query.data yields { activeLoan | activeLoans, history } — testable without useQuery mock"
    - "useReturnLoan takes caller-provided {id, inventoryId, borrowerId} so onSuccess invalidates without re-reading the response"
    - "HttpError substring matching via isHttp400 helper — server message never rendered directly (T-62-10 mitigation)"
    - "vi.hoisted for mock factories so vi.mock hoisting + factory reference is safe (matches Phase 60 useItemMutations test pattern)"

key-files:
  created:
    - frontend2/src/features/loans/hooks/useLoansActive.ts
    - frontend2/src/features/loans/hooks/useLoansOverdue.ts
    - frontend2/src/features/loans/hooks/useLoansHistory.ts
    - frontend2/src/features/loans/hooks/useLoansForItem.ts
    - frontend2/src/features/loans/hooks/useLoansForBorrower.ts
    - frontend2/src/features/loans/hooks/useLoanMutations.ts
    - frontend2/src/features/loans/icons.tsx
    - frontend2/src/features/loans/__tests__/fixtures.ts
    - frontend2/src/features/loans/__tests__/useLoanMutations.test.ts
  modified:
    - frontend2/src/lib/api/loans.ts

key-decisions:
  - "icons.tsx written as inline-SVG components (NOT lucide-react re-exports as the plan action suggested) — lucide-react is forbidden by the v2.0 no-new-runtime-deps lock that items/borrowers/taxonomy icons modules already respect; the plan action contradicted the project convention, so the project convention won (Rule 3 deviation)"
  - "Test file uses vi.hoisted mock pattern from Phase 60 useItemMutations.test.ts (not the plan's inline vi.fn()) because vi.mock() is hoisted above imports — vi.hoisted is the established, working pattern in this codebase"
  - "useUpdateLoan invalidates ONLY loanKeys.all — UI-SPEC says edit touches one loan, and the backend PATCH does not change inventory/borrower relationships (unlike create/return which cross aggregate boundaries)"
  - "useReturnLoan signature requires caller to pass {inventoryId, borrowerId} alongside {id} — avoids a second GET or parsing the void response, and the UI-SPEC mandates invalidating those details on success"
  - "useLoansForItem/ForBorrower return the full UseQueryResult spread plus computed fields; downstream components still have access to isPending/isError/data without losing the partition — idiomatic for the list+detail composition in Plans 62-03/04"

patterns-established:
  - "Any Phase 62 loan UI component reads workspaceId from useAuth() — never as a prop (CLAUDE.md rule, confirmed)"
  - "TanStack Query v5 idioms throughout: placeholderData as a function, invalidateQueries with { queryKey } object form"
  - "isHttp400(err, substring) helper is the canonical 400-branching primitive for Phase 62+ mutation hooks"
  - "Inline-SVG icons module per feature (mirrors items/, borrowers/, taxonomy/) — never introduce lucide-react or similar icon packages"

requirements-completed: [LOAN-01, LOAN-02, LOAN-03, LOAN-04, LOAN-05, LOAN-06]

# Metrics
duration: ~6min
completed: 2026-04-17
---

# Phase 62 Plan 02: Frontend Loan Data Layer Summary

**Ship the complete frontend data layer for Phase 62 — extended loansApi with the unified PATCH + per-item listing, the Loan TS interface carrying backend decoration embeds, five workspace-gated query hooks with client-side partitioning, and three mutation hooks whose invalidation sets match UI-SPEC Interaction Contracts verbatim, backed by 12 tests covering every invalidation path and 400-branch toast.**

## Performance

- **Duration:** ~6 min (plan estimate: ~15 min)
- **Started:** 2026-04-17T08:53:07Z
- **Completed:** 2026-04-17T08:59:00Z
- **Tasks:** 3 (all auto + TDD-flagged)
- **Files created:** 9
- **Files modified:** 1
- **Tests:** 12 new (all green); 449/449 full-suite tests pass (up from 437)

## Accomplishments

- `loansApi` extended with `update(wsId, id, body)` → `PATCH /workspaces/{ws}/loans/{id}` and `listForItem(wsId, inventoryId)` → `GET /workspaces/{ws}/inventory/{id}/loans`, both returning the decorated `Loan` / `LoanListResponse`.
- `Loan` TS interface now carries required `item: LoanEmbeddedItem` and `borrower: LoanEmbeddedBorrower` fields matching the 62-01 backend shape (id + name, plus optional thumbnail on items).
- `loansApi.extend` + `ExtendLoanInput` marked `@deprecated` — backward-compat only; new UI code MUST use `loansApi.update`.
- `loanKeys` factory gains `forItem(inventoryId)` and `forBorrower(borrowerId)` tuple keys for the detail-page partitioned hooks.
- Five query hooks, each workspace-gated via `!!workspaceId`:
  - `useLoansActive` → `GET /loans/active` under `loanKeys.list({ active: true })`
  - `useLoansOverdue` → `GET /loans/overdue` under `loanKeys.list({ overdue: true })`
  - `useLoansHistory(params)` → paginated `GET /loans?page&limit` with `placeholderData: (prev) => prev` (v5 idiom)
  - `useLoansForItem(inventoryId)` → `{ activeLoan: Loan | null, history: Loan[], ...queryMeta }` partitioned in a pure `useMemo`
  - `useLoansForBorrower(borrowerId)` → `{ activeLoans: Loan[], history: Loan[], ...queryMeta }` partitioned in a pure `useMemo`
- Three mutation hooks with exact UI-SPEC invalidation sets (see Invalidation Contract table below) and 400-branch toasts.
- Icons module (inline SVG) exporting `Plus`, `Pencil`, `Undo2`, `ArrowLeft`, `AlertTriangle`, `ImageOff` — mirrors items/borrowers conventions and passes the `lint:imports` forbidden-imports guard.
- `makeLoan` fixture factory + taxonomy fixture re-exports under `features/loans/__tests__/fixtures.ts`.
- 12 tests in `useLoanMutations.test.ts`: every mutation's success-path invalidation set is verified against actual `qc.invalidateQueries` calls (not just the presence of toasts), every named 400-branch toast is exercised, and the update hook has an explicit negative assertion that it does NOT invalidate item / borrower keys.

## Invalidation Contract (verbatim vs UI-SPEC)

| Mutation | Keys invalidated on success | UI-SPEC says |
|----------|----------------------------|--------------|
| `useCreateLoan` | `loanKeys.all`, `itemKeys.detail(loan.inventory_id)`, `borrowerKeys.detail(loan.borrower_id)`, `itemKeys.lists()`, `borrowerKeys.lists()` | ✓ exact match |
| `useUpdateLoan` | `loanKeys.all` only | ✓ exact match |
| `useReturnLoan` | `loanKeys.all`, `loanKeys.detail(id)`, `itemKeys.detail(inventoryId)`, `borrowerKeys.detail(borrowerId)` | ✓ exact match |

### 400-branch toasts

| Mutation | Server message substring | Toast |
|----------|-------------------------|-------|
| create | `already has an active loan` | "This item is already on loan." |
| create | `is not available` | "This item is not available for loan." |
| create | `exceeds available quantity` | "Not enough units available for loan." |
| create | (any other) | "Could not create loan. Check your connection and try again." |
| update | `cannot edit returned` | "This loan has already been returned." |
| update | `must be after loaned` | "Due date can't be before the loaned-on date." |
| update | (any other) | "Could not update loan. Try again." |
| return | `already been returned` | "This loan has already been returned." |
| return | (any other) | "Could not return loan. Try again." |

## Task Commits

1. **Task 1 — loansApi + Loan embeds + loanKeys extension** — `8cf4a86` (feat)
2. **Task 2 — query hooks + icons + fixtures** — `28a7145` (feat)
3. **Task 3 — mutation hooks + test** — `5a108be` (feat)

## Files Created/Modified

### Modified
- `frontend2/src/lib/api/loans.ts` — +34 lines. Added `LoanEmbeddedItem`, `LoanEmbeddedBorrower`, `UpdateLoanInput` interfaces; `Loan` gained required `item` + `borrower` fields; `loansApi.update` and `loansApi.listForItem` added; `loansApi.extend` and `ExtendLoanInput` marked `@deprecated`; `loanKeys.forItem` and `loanKeys.forBorrower` added.

### Created
- `frontend2/src/features/loans/hooks/useLoansActive.ts` — 20 lines; workspace-gated `useQuery` over `loansApi.listActive`, keyed on `loanKeys.list({ active: true })`.
- `frontend2/src/features/loans/hooks/useLoansOverdue.ts` — 20 lines; same shape under `loanKeys.list({ overdue: true })`.
- `frontend2/src/features/loans/hooks/useLoansHistory.ts` — 25 lines; paginated query with `placeholderData: (prev) => prev`.
- `frontend2/src/features/loans/hooks/useLoansForItem.ts` — 50 lines; enabled-gated query + pure-`useMemo` partition into `activeLoan` / `history`.
- `frontend2/src/features/loans/hooks/useLoansForBorrower.ts` — 50 lines; same pattern with `activeLoans` (plural) / `history`.
- `frontend2/src/features/loans/hooks/useLoanMutations.ts` — 137 lines; `useCreateLoan`, `useUpdateLoan`, `useReturnLoan` with invalidation sets + 400 branching via `isHttp400` helper.
- `frontend2/src/features/loans/icons.tsx` — 98 lines; inline-SVG `Plus`, `Pencil`, `Undo2`, `ArrowLeft`, `AlertTriangle`, `ImageOff`.
- `frontend2/src/features/loans/__tests__/fixtures.ts` — 58 lines; `makeLoan` factory with default embedded item/borrower + re-exports from taxonomy fixtures.
- `frontend2/src/features/loans/__tests__/useLoanMutations.test.ts` — 321 lines; 12 tests.

## Decisions Made

See `key-decisions` frontmatter above. Highlights:

1. **Rule 3 deviation — icons.tsx written as inline SVG, not lucide-react re-exports.** The plan's `action` section specified `export { Plus, Pencil, ... } from "lucide-react";` but `lucide-react` is NOT a `frontend2/package.json` dependency and all three other feature icons modules (items, borrowers, taxonomy) explicitly document "no `lucide-react` dependency (forbidden by v2.0 no-new-runtime-deps lock)". Adding the import would have failed `bun run build`. I applied the project convention — inline SVG components with the same `IconProps` shape and path data mirroring the canonical lucide glyphs — and documented this choice in the icons.tsx header comment. All six required icons are exported with the exact names the plan requires, so downstream consumers see zero API difference.
2. **Test file uses `vi.hoisted` mock factory pattern** rather than the plan's inline `vi.fn()` mocks. Matches the established, working pattern in `src/features/items/__tests__/useItemMutations.test.ts`. Functionally equivalent; just aligned with the local style so future refactors don't need to fight hoisting.
3. **Added negative assertion for `useUpdateLoan`:** the test `"invalidates loanKeys.all ONLY on success (no item/borrower detail invalidation)"` stringifies all recorded `invalidateQueries` calls and asserts no `"items"` or `"borrowers"` top-level keys appear. This is stronger than the plan required and guards against a future drift where someone "helpfully" adds cross-feature invalidation to update.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Cannot import from `lucide-react`**
- **Found during:** Task 2 (icons.tsx action)
- **Issue:** Plan action says `export { Plus, Pencil, Undo2, ArrowLeft, AlertTriangle, ImageOff } from "lucide-react";` but lucide-react is not installed and is explicitly forbidden per the three existing feature icons modules (items/, borrowers/, taxonomy/). The build would fail.
- **Fix:** Authored inline-SVG components with matching names and path data mirroring the canonical lucide glyphs; the module's public API (named exports) is identical, so downstream Plan 62-03 and 62-04 imports need no change.
- **Files modified:** `frontend2/src/features/loans/icons.tsx`
- **Commit:** `28a7145`

### Style Alignments (not strictly deviations)

**2. Test mock pattern uses `vi.hoisted` (Phase 60 convention)**
- The plan's test action used inline `vi.fn()` assigned at module scope, which does not play nicely with `vi.mock` hoisting. Switched to the `vi.hoisted` factory pattern already used by `useItemMutations.test.ts`. All plan acceptance criteria (exported names, ≥10 `it` blocks, test exits 0) remain satisfied.

## Issues Encountered

None. Build and full test suite green throughout; no cross-task rework.

## User Setup Required

None. Frontend-only TypeScript + test changes; no new env vars, no new runtime dependencies, no new backend routes.

## Next Phase Readiness

**Unblocked:**
- Plan 62-03 (loans list page) can import `useLoansActive`, `useLoansOverdue`, `useLoansHistory`, `useCreateLoan`, `useUpdateLoan`, `useReturnLoan`, and the six icons directly; `Loan` type carries item thumbnail + name and borrower name for row rendering with zero additional queries.
- Plan 62-04 (item detail + borrower detail loan panels) can import `useLoansForItem`, `useLoansForBorrower` and render the partitioned active/history arrays directly; mutation hooks' invalidation sets guarantee immediate UI refresh after create/return without explicit refetch calls.
- Cross-plan cache coherence: any create/return triggered from 62-03 or 62-04 will correctly invalidate the item detail page's loan panel AND the borrower detail page's loan list AND the items list / borrowers list summary cells.

**API surface changes consumers must mirror:**
- `Loan` interface gained two required fields (`item`, `borrower`). Any code that currently constructs `Loan` objects in tests must include these fields — the `makeLoan` fixture does. All existing 437 tests still pass because no prior code constructed `Loan` literals outside the new fixtures module.
- `loansApi.update` signature: `(wsId, id, { due_date?, notes? })`. The deprecated `loansApi.extend` is still callable but should NOT be wired into any new UI.
- `useReturnLoan.mutateAsync` input shape is `{ id: string, inventoryId: string, borrowerId: string }` — callers MUST pass the foreign keys alongside the loan id.

## Self-Check: PASSED

- [x] `frontend2/src/lib/api/loans.ts` contains `export interface LoanEmbeddedItem {` — FOUND
- [x] `frontend2/src/lib/api/loans.ts` contains `export interface LoanEmbeddedBorrower {` — FOUND
- [x] `frontend2/src/lib/api/loans.ts` `Loan` has `item: LoanEmbeddedItem` and `borrower: LoanEmbeddedBorrower` — FOUND
- [x] `frontend2/src/lib/api/loans.ts` contains `export interface UpdateLoanInput {` — FOUND
- [x] `frontend2/src/lib/api/loans.ts` `loansApi.update` uses `patch<Loan>(`${base(wsId)}/${id}`` (NOT `/extend`) — VERIFIED
- [x] `frontend2/src/lib/api/loans.ts` contains `/workspaces/${wsId}/inventory/${inventoryId}/loans` — FOUND
- [x] `frontend2/src/lib/api/loans.ts` `loanKeys.forItem` and `loanKeys.forBorrower` exist — FOUND
- [x] `loansApi.extend` still exists with `@deprecated` JSDoc — FOUND
- [x] All 5 query hook files exist and match spec — FOUND
- [x] `useLoansHistory.ts` uses `placeholderData: (prev) => prev` and NOT `keepPreviousData` (except in doc comment) — VERIFIED
- [x] `useLoansForItem.ts` returns `activeLoan` + `history`, calls `loansApi.listForItem` — VERIFIED
- [x] `useLoansForBorrower.ts` returns `activeLoans` + `history`, calls `loansApi.listForBorrower` — VERIFIED
- [x] `icons.tsx` exports all 6 icons (Plus, Pencil, Undo2, ArrowLeft, AlertTriangle, ImageOff) — FOUND (as inline-SVG components, not lucide re-exports — see Deviations §1)
- [x] `fixtures.ts` exports `makeLoan` and re-exports `renderWithProviders` + `setupDialogMocks` — FOUND
- [x] `fixtures.ts` `makeLoan` default includes `item:` and `borrower:` embedded objects — FOUND
- [x] `useLoanMutations.ts` exports `useCreateLoan`, `useUpdateLoan`, `useReturnLoan` — FOUND
- [x] `useLoanMutations.ts` has all required 400-branch substrings (6 total across the 3 mutations) — FOUND
- [x] `useLoanMutations.ts` contains `instanceof HttpError` check — FOUND
- [x] `useLoanMutations.test.ts` has 12 `it(` blocks (plan required ≥10) — VERIFIED
- [x] `cd frontend2 && bun run build` exits 0 — VERIFIED
- [x] `cd frontend2 && bun run test -- --run src/features/loans/__tests__/useLoanMutations.test.ts` exits 0 (12/12) — VERIFIED
- [x] `cd frontend2 && bun run test` exits 0 (449/449 — no regressions; +12 new tests) — VERIFIED
- [x] `cd frontend2 && bun run lint:imports` exits 0 (no forbidden idb/serwist/offline/sync imports) — VERIFIED
- [x] Commits exist:
  - `8cf4a86` (feat: Task 1 — loansApi extend) — FOUND
  - `28a7145` (feat: Task 2 — query hooks + icons + fixtures) — FOUND
  - `5a108be` (feat: Task 3 — mutation hooks + test) — FOUND

---
*Phase: 62-loans*
*Completed: 2026-04-17*
