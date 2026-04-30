---
phase: 62-loans
verified: 2026-04-17T13:30:00Z
status: human_needed
score: 5/5
overrides_applied: 0
deferred:
  - truth: "Estonian (ET) msgstr values are populated for all Phase 62 strings"
    addressed_in: "Phase 63"
    evidence: "Phase 63 success criteria #4: 'All user-visible strings introduced in phases 56–62 are present in English and Estonian Lingui catalogs with no orphan keys'"
human_verification:
  - test: "End-to-end loan flow — create, edit, mark returned, tabs, detail pages"
    expected: "All 29 steps in the 62-04-PLAN.md how-to-verify block produce the described UX outcomes with no uncaught console errors"
    why_human: "Plan 62-04 Task 4 is a blocking human-verify checkpoint. The automated portion (Tasks 1–3) is green (483/483 tests, build exits 0) but end-to-end validation requires a running backend + frontend against real data"
---

# Phase 62: Loans — Verification Report

**Phase Goal:** Users can loan items to borrowers, track returns, and review loan history from both the item and borrower perspectives
**Verified:** 2026-04-17T13:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

All 5 ROADMAP success criteria are verified by code artifacts. One human-verify checkpoint (Plan 62-04 Task 4) remains as a blocking gate before the phase can be marked complete.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can view loans on a tabbed page showing Active, Overdue, and History with counts in each tab | VERIFIED | `LoansListPage.tsx` uses `useHashTab` with `TAB_KEYS = ["active", "overdue", "history"]`, mounts all three queries on load, renders `· N` or `· …` counts via `label(base, n)` helper (line 78) |
| 2 | User can create a loan by picking an item and a borrower via RetroCombobox and optionally setting a due date and notes | VERIFIED | `LoanForm.tsx` create mode renders `RetroCombobox` for both item and borrower; `LoanPanel.tsx` exposes `open("create")` handle wired in `LoansListPage`; `useCreateLoan` mutation in `useLoanMutations.ts` calls `loansApi.create` |
| 3 | User can mark any active loan as returned, and the loan moves to History immediately | VERIFIED | `LoanReturnFlow.tsx` opens amber confirm dialog and calls `useReturnLoan` with `{id, inventoryId, borrowerId}`; `useReturnLoan` invalidates `loanKeys.all + loanKeys.detail + itemKeys.detail + borrowerKeys.detail` on success |
| 4 | User can edit a non-returned loan's due date and notes without creating a new loan | VERIFIED | `PATCH /workspaces/{wsId}/loans/{id}` registered in `handler.go` (line 415); entity `Update()` method rejects returned loans; `LoanForm.tsx` edit mode shows locked details + editable due_date/notes; `useUpdateLoan` calls `loansApi.update` (not extend) |
| 5 | Item detail and borrower detail pages each show the entity's current active loan (if any) and historical loans | VERIFIED | `ItemDetailPage.tsx` imports + renders `ItemActiveLoanPanel` and `ItemLoanHistoryPanel`; `BorrowerDetailPage.tsx` imports + renders `BorrowerActiveLoansPanel` and `BorrowerLoanHistoryPanel`; all four panels wired to Plan 62-02 hooks |

**Score: 5/5 truths verified**

---

### Deferred Items

Items not yet met but explicitly addressed in later milestone phases.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Estonian (ET) msgstr values populated for all Phase 62 strings | Phase 63 | Phase 63 success criteria #4: "All user-visible strings introduced in phases 56–62 are present in English and Estonian Lingui catalogs with no orphan keys" |

---

## Required Artifacts

### Plan 62-01 (Backend)

| Artifact | Status | Details |
|----------|--------|---------|
| `backend/internal/domain/warehouse/loan/handler.go` | VERIFIED | `huma.Patch(api, "/loans/{id}"` at line 415; `LoanEmbeddedItem`, `LoanEmbeddedBorrower`, `DecorationLookup`, `lookupLoanDecorations`, `decorateOneLoan`, `decorateLoans`; `RegisterRoutes` with `lookup DecorationLookup` param; `LoanResponse.Item` + `LoanResponse.Borrower` at lines 660–661; `UpdateLoanInput.Notes` maxLength 1000 at line 624 |
| `backend/internal/domain/warehouse/loan/service.go` | VERIFIED | `ServiceInterface.Update` at line 23; `func (s *Service) Update` at line 171 |
| `backend/internal/domain/warehouse/loan/repository.go` | VERIFIED | `Update(ctx context.Context, loanID, workspaceID uuid.UUID, ...)` at line 27 |
| `backend/internal/infra/postgres/loan_repository.go` | VERIFIED | `func (r *LoanRepository) Update(` at line 224 |
| `backend/db/queries/loans.sql` | VERIFIED | `-- name: UpdateLoan :one` at line 90 |
| `backend/internal/infra/queries/loans.sql.go` | VERIFIED | `func (q *Queries) UpdateLoan(` at line 747 |
| `backend/internal/domain/warehouse/loan/entity.go` | VERIFIED | `func (l *Loan) Update(` at line 131 |
| `backend/internal/infra/postgres/loan_decoration_lookup.go` | VERIFIED | File exists; wired in `router.go` at lines 423–424 |
| `backend/internal/domain/warehouse/loan/handler_test.go` | VERIFIED | `TestHandler_UpdateLoan_Success/AlreadyReturned/InvalidDueDate/NotFound/NotesOnly` at lines 610–714; `TestHandler_ListResponseIncludesEmbeds` at 760; `TestHandler_GetLoanByID_IncludesEmbeds` at 796 |
| `backend/internal/domain/warehouse/loan/service_test.go` | VERIFIED | `TestService_Update_Success/AlreadyReturned/InvalidDueDate/NotFound` at lines 1497–1608 |

### Plan 62-02 (Frontend Data Layer)

| Artifact | Status | Details |
|----------|--------|---------|
| `frontend2/src/lib/api/loans.ts` | VERIFIED | `LoanEmbeddedItem`, `LoanEmbeddedBorrower`, `UpdateLoanInput` interfaces; `Loan.item` + `Loan.borrower` required fields; `loansApi.update` uses `patch<Loan>` to `${base(wsId)}/${id}` (not /extend); `loansApi.listForItem`; `loanKeys.forItem` + `forBorrower`; `@deprecated` on extend |
| `frontend2/src/features/loans/hooks/useLoansActive.ts` | VERIFIED | Exports `useLoansActive`; `loanKeys.list({ active: true })`; `enabled: !!workspaceId` |
| `frontend2/src/features/loans/hooks/useLoansOverdue.ts` | VERIFIED | `loanKeys.list({ overdue: true })`; workspace-gated |
| `frontend2/src/features/loans/hooks/useLoansHistory.ts` | VERIFIED | `placeholderData: (prev) => prev` at line 22 |
| `frontend2/src/features/loans/hooks/useLoansForItem.ts` | VERIFIED | Returns `activeLoan` + `history`; calls `loansApi.listForItem`; partition via `useMemo` |
| `frontend2/src/features/loans/hooks/useLoansForBorrower.ts` | VERIFIED | Returns `activeLoans` + `history`; partition via `useMemo` |
| `frontend2/src/features/loans/hooks/useLoanMutations.ts` | VERIFIED | Exports `useCreateLoan`, `useUpdateLoan`, `useReturnLoan`; `instanceof HttpError` check; all 6 400-branch substrings present; correct invalidation sets |
| `frontend2/src/features/loans/icons.tsx` | VERIFIED | All 6 icons exported as inline SVG: `Plus`, `Pencil`, `Undo2`, `ArrowLeft`, `AlertTriangle`, `ImageOff` |
| `frontend2/src/features/loans/__tests__/fixtures.ts` | VERIFIED | `makeLoan` factory with `item:` and `borrower:` embedded; re-exports `renderWithProviders`, `setupDialogMocks` |
| `frontend2/src/features/loans/__tests__/useLoanMutations.test.ts` | VERIFIED | 12 `it()` blocks |

### Plan 62-03 (List Page UI)

| Artifact | Status | Details |
|----------|--------|---------|
| `frontend2/src/features/loans/forms/schemas.ts` | VERIFIED | `loanCreateSchema`, `loanEditSchema`, `LoanCreateValues`, `LoanEditValues`; notes `.max(1000)`; quantity `.min(1)` + `.max(999)` |
| `frontend2/src/features/loans/forms/LoanForm.tsx` | VERIFIED | `mode === "create"` and `mode === "edit"` branches; `LOAN DETAILS (LOCKED)` block; `onDirtyChange?.(formState.isDirty)`; `RetroCombobox` with `onSearch={setItemSearch}` |
| `frontend2/src/features/loans/panel/LoanPanel.tsx` | VERIFIED | `LoanPanel` + `LoanPanelHandle` exported; `forwardRef`; `useCreateLoan()` + `useUpdateLoan()`; `NEW LOAN` / `EDIT LOAN` / `CREATE LOAN` / `SAVE LOAN` labels |
| `frontend2/src/features/loans/actions/LoanReturnFlow.tsx` | VERIFIED | `LoanReturnFlow` + `LoanReturnFlowHandle`; `variant="soft"`; `CONFIRM RETURN` + `RETURN LOAN`; `{id: loan.id, inventoryId: loan.inventory_id, borrowerId: loan.borrower_id}` |
| `frontend2/src/features/loans/table/LoansTable.tsx` | VERIFIED | `tab === "history"` branch at line 48; history branch has NO `actions` key |
| `frontend2/src/features/loans/LoansListPage.tsx` | VERIFIED | `useHashTab`; `TAB_KEYS = ["active", "overdue", "history"]`; all 3 query hooks; `panelRef.current?.open("create")` + `panelRef.current?.open("edit", loan)`; `returnFlowRef.current?.open(loan)`; `<LoanPanel ref={panelRef} />` + `<LoanReturnFlow ref={returnFlowRef} />`; `NO ACTIVE LOANS`, `NO OVERDUE LOANS`, `NO LOAN HISTORY` |
| `frontend2/src/features/loans/LoansPage.tsx` | VERIFIED | Thin re-export: `export { LoansListPage as LoansPage }` |
| `frontend2/src/features/loans/__tests__/LoanForm.test.tsx` | VERIFIED | 6 `it()` blocks |
| `frontend2/src/features/loans/__tests__/LoanPanel.test.tsx` | VERIFIED | 4 `it()` blocks |
| `frontend2/src/features/loans/__tests__/LoanReturnFlow.test.tsx` | VERIFIED | 3 `it()` blocks |
| `frontend2/src/features/loans/__tests__/LoansListPage.test.tsx` | VERIFIED | 8 `it()` blocks |

### Plan 62-04 (Detail Pages + Router + i18n)

| Artifact | Status | Details |
|----------|--------|---------|
| `frontend2/src/features/loans/panels/ItemActiveLoanPanel.tsx` | VERIFIED | `useLoansForItem(itemId)`; `<LoanReturnFlow ref={returnFlowRef} />`; `NO ACTIVE LOAN` (singular); `MARK RETURNED`; link to `/borrowers/${loan.borrower_id}`; `AlertTriangle` for overdue |
| `frontend2/src/features/loans/panels/ItemLoanHistoryPanel.tsx` | VERIFIED | `NO LOAN HISTORY`; `Past loans will appear here once anything is returned.` |
| `frontend2/src/features/loans/panels/BorrowerActiveLoansPanel.tsx` | VERIFIED | `useLoansForBorrower(borrowerId)`; `NO ACTIVE LOANS` (plural); `ItemThumbnailCell size={24}`; link to `/items/${loan.inventory_id}` |
| `frontend2/src/features/loans/panels/BorrowerLoanHistoryPanel.tsx` | VERIFIED | `NO LOAN HISTORY`; dimmed thumbnails |
| `frontend2/src/features/items/ItemDetailPage.tsx` | VERIFIED | Imports and renders `ItemActiveLoanPanel itemId={item.id}` + `ItemLoanHistoryPanel itemId={item.id}`; placeholder retired |
| `frontend2/src/features/borrowers/BorrowerDetailPage.tsx` | VERIFIED | `BorrowerActiveLoansPanel borrowerId={b.id}` + `BorrowerLoanHistoryPanel borrowerId={b.id}`; placeholder retired |
| `frontend2/src/routes/index.tsx` | VERIFIED | `import { LoansListPage } from "@/features/loans/LoansListPage"` at line 11; `<Route path="loans" element={<LoansListPage />} />` at line 84; no `<LoansPage` reference |
| `frontend2/locales/en/messages.po` | VERIFIED | `LOANS`, `NEW LOAN`, `CONFIRM RETURN`, `MARK RETURNED`, `NO ACTIVE LOAN`, `NO ACTIVE LOANS`, `NO OVERDUE LOANS`, `NO LOAN HISTORY`, `LOAN DETAILS (LOCKED)`, `Loan created.`, `Loan updated.`, `Loan returned.` all present |
| `frontend2/locales/et/messages.po` | VERIFIED | `LOANS` and `CONFIRM RETURN` present (msgstr empty — translation deferred to Phase 63, see deferred items) |
| `frontend2/src/features/loans/__tests__/ItemActiveLoanPanel.test.tsx` | VERIFIED | 3 `it()` blocks |
| `frontend2/src/features/loans/__tests__/ItemLoanHistoryPanel.test.tsx` | VERIFIED | 3 `it()` blocks |
| `frontend2/src/features/loans/__tests__/BorrowerActiveLoansPanel.test.tsx` | VERIFIED | 3 `it()` blocks |
| `frontend2/src/features/loans/__tests__/BorrowerLoanHistoryPanel.test.tsx` | VERIFIED | 3 `it()` blocks |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `huma.Patch /loans/{id}` | `svc.Update` | `svc.Update(ctx, input.ID, workspaceID, input.Body.DueDate, input.Body.Notes)` at handler.go:421 | WIRED | Direct call confirmed |
| `svc.Update` | `repo.Update` | `s.repo.Update(ctx, id, workspaceID, ...)` in service.go | WIRED | Via repository interface |
| `toLoanResponse` | `LoanEmbeddedItem + LoanEmbeddedBorrower` | `itemMap` + `borrowerMap` lookup; `LoanResponse.Item` + `LoanResponse.Borrower` at lines 660–661 | WIRED | All list + mutation handlers use `decorateLoans` or `decorateOneLoan` |
| `loansApi.update` | `PATCH /workspaces/{wsId}/loans/{id}` | `patch<Loan>(`${base(wsId)}/${id}`, body)` in loans.ts | WIRED | Not using /extend |
| `loansApi.listForItem` | `GET /workspaces/{wsId}/inventory/{inventoryId}/loans` | URL pattern in loans.ts | WIRED | Confirmed |
| `useCreateLoan onSuccess` | cross-feature cache invalidation | 5 `invalidateQueries` calls: `loanKeys.all`, `itemKeys.detail`, `borrowerKeys.detail`, `itemKeys.lists()`, `borrowerKeys.lists()` | WIRED | All 5 present in useLoanMutations.ts |
| `useReturnLoan onSuccess` | per-entity cache invalidation | 4 `invalidateQueries`: `loanKeys.all`, `loanKeys.detail(id)`, `itemKeys.detail(inventoryId)`, `borrowerKeys.detail(borrowerId)` | WIRED | All 4 confirmed |
| `ItemActiveLoanPanel` | `useLoansForItem(itemId).activeLoan` | `const query = useLoansForItem(itemId)` at panel line 29 | WIRED | |
| `BorrowerActiveLoansPanel` | `useLoansForBorrower(borrowerId).activeLoans` | `const query = useLoansForBorrower(borrowerId)` at panel line 34 | WIRED | |
| `ItemDetailPage LOANS section` | `ItemActiveLoanPanel + ItemLoanHistoryPanel` | Import + render at ItemDetailPage.tsx lines 262 + 269 | WIRED | Phase 60 placeholder retired |
| `BorrowerDetailPage ACTIVE LOANS + LOAN HISTORY` | `BorrowerActiveLoansPanel + BorrowerLoanHistoryPanel` | Import + render at BorrowerDetailPage.tsx lines 109 + 119 | WIRED | Phase 59 placeholders retired |
| `routes/index.tsx` | `LoansListPage` | Direct import at line 11; `<LoansListPage />` at line 84 | WIRED | Re-export hop retired |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `LoansListPage` | `activeQuery.data`, `overdueQuery.data`, `historyQuery.data` | `loansApi.listActive/listOverdue/list` → backend endpoints | Backend queries `warehouse.loans` via sqlc | FLOWING |
| `ItemActiveLoanPanel` | `query.activeLoan` | `useLoansForItem` → `loansApi.listForItem` → `GET /inventory/{id}/loans` | Backend `ListByInventory` handler + decoration lookup | FLOWING |
| `BorrowerActiveLoansPanel` | `query.activeLoans` | `useLoansForBorrower` → `loansApi.listForBorrower` → `GET /borrowers/{id}/loans` | Backend `ListByBorrower` handler + decoration lookup | FLOWING |
| `LoanResponse.Item/Borrower` | `itemMap`, `borrowerMap` | `lookupLoanDecorations` → `LoanDecorationLookup` → 3 SQL batch queries | `ListItemNamesByInventoryIDs`, `ListBorrowerNamesByIDs`, primary-photo lookup | FLOWING |

---

## Behavioral Spot-Checks

Step 7b: SKIPPED for server-side Go endpoints (would require running backend). Frontend build + test suite used as proxy:

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Frontend builds without errors | `bun run build` | 0 (per SUMMARY) | PASS |
| All 483 frontend tests green | `bun run test` | 483/483 passing | PASS |
| Backend loan package tests pass | `go test ./internal/domain/warehouse/loan/... -count=1` | All pass (per SUMMARY) | PASS |
| No forbidden imports | `bun run lint:imports` | 0 (per SUMMARY) | PASS |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|------------|------------|-------------|--------|----------|
| LOAN-01 | 62-02, 62-03 | User can view loans in a tabbed list: Active, Overdue, and History | SATISFIED | `LoansListPage` with `useHashTab` + three parallel queries + tab counters |
| LOAN-02 | 62-02, 62-03 | User can create a loan by selecting an item and borrower, with optional due date and notes | SATISFIED | `LoanForm` create mode + `LoanPanel` + `useCreateLoan` |
| LOAN-03 | 62-02, 62-03 | User can mark an active loan as returned | SATISFIED | `LoanReturnFlow` + `useReturnLoan` with correct invalidation |
| LOAN-04 | 62-01, 62-02, 62-03 | User can edit a non-returned loan's due date and notes | SATISFIED | `PATCH /loans/{id}` + entity `Update()` + `LoanForm` edit mode + `useUpdateLoan` |
| LOAN-05 | 62-01, 62-02, 62-04 | Item detail page shows the item's active loan and loan history | SATISFIED | `ItemActiveLoanPanel` + `ItemLoanHistoryPanel` wired into `ItemDetailPage` |
| LOAN-06 | 62-01, 62-02, 62-04 | Borrower detail page shows the borrower's active loans and loan history | SATISFIED | `BorrowerActiveLoansPanel` + `BorrowerLoanHistoryPanel` wired into `BorrowerDetailPage` |

All 6 requirements covered. No orphaned LOAN-* requirements.

---

## Anti-Patterns Found

No blockers. Notable observations:

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `frontend2/src/features/loans/LoansPage.tsx` | Re-export shim (not a real component) | Info | Intentional — kept as transitional export; not referenced in `frontend2/src`; can be deleted in Phase 63 cleanup |
| `backend/internal/domain/warehouse/loan/service_test.go` | Pre-existing cleanup test flake (unrelated DST arithmetic in `TestCleanupConfig_RetentionPeriodUsage`) | Info | Documented in deferred-items.md; unrelated to Phase 62 |

---

## Human Verification Required

### 1. End-to-End Loan Flow Checkpoint (Plan 62-04 Task 4)

**Test:** Follow all 29 steps in the `62-04-PLAN.md` section `<how-to-verify>`:
- Navigate to `/loans`, verify three tabs with real counts
- Create a loan via RetroCombobox pickers
- Test create failure paths (already on loan, not available)
- Edit a loan's due date and notes
- Mark a loan as returned and verify it moves to HISTORY
- Verify `/items/:id` ACTIVE LOAN + LOAN HISTORY sections show real data
- Verify `/borrowers/:id` ACTIVE LOANS + LOAN HISTORY sections show real data
- Cross-feature cache invalidation spot checks
- i18n spot check (Estonian fallback to English msgid is acceptable)
- Accessibility spot checks (focus rings, aria-labels, Esc on dirty panel)
- Console sanity (no uncaught errors)

**Expected:** User types "approved" after confirming all 29 steps match the described behaviour. Any failing step must be reported with expected vs actual and any console/network errors.

**Why human:** Requires a running backend (`make dev` on port 8000) and frontend dev server (`bun run dev` on port 5173) with a populated workspace. Cannot be verified programmatically without a live integration environment.

**Prereqs:**
1. Backend running: `cd backend && mise run dev`
2. Frontend running: `cd frontend2 && bun run dev`
3. Workspace with ≥2 items and ≥2 borrowers

---

## Gaps Summary

No code gaps identified. All 6 LOAN requirements are verified in the codebase with substantive, wired implementations and data-flowing connections. The only outstanding item is the human-verify checkpoint (Plan 62-04 Task 4) which is a blocking gate defined in the plan itself — the plan explicitly states it will not proceed to SUMMARY until the user types "approved". The automated portion of all 4 plans is complete with 483/483 tests passing and build clean.

---

_Verified: 2026-04-17T13:30:00Z_
_Verifier: Claude (gsd-verifier)_
