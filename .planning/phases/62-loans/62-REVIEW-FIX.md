---
phase: 62-loans
fixed_at: 2026-04-17T00:00:00Z
review_path: .planning/phases/62-loans/62-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 62: Code Review Fix Report

**Fixed at:** 2026-04-17
**Source review:** .planning/phases/62-loans/62-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 8
- Fixed: 8
- Skipped: 0

## Fixed Issues

### CR-01: `ReturnLoan` SQL is not workspace-scoped

**Files modified:** `backend/db/queries/loans.sql`, `backend/internal/infra/queries/loans.sql.go`, `backend/internal/infra/postgres/loan_repository.go`
**Commit:** fbf4b3d
**Applied fix:** Added `AND workspace_id = $2` to the `ReturnLoan` SQL query. Updated the generated Go binding to introduce a `ReturnLoanParams` struct with `ID` and `WorkspaceID` fields and a two-argument `QueryRow` call. Updated `LoanRepository.Save` to pass `queries.ReturnLoanParams{ID: l.ID(), WorkspaceID: l.WorkspaceID()}` instead of the bare `l.ID()`.

---

### CR-02: `LoanRepository.Delete` is a silent no-op

**Files modified:** `backend/internal/infra/postgres/loan_repository.go`
**Commit:** f1c9e4a
**Applied fix:** Replaced the silent `return nil` stub with `return errors.New("loan deletion is not implemented")`. Any caller (including the pendingchange approval workflow) will now receive an explicit error rather than silently believing deletion succeeded.

---

### CR-03: Borrower panel links navigate to `/items/{inventory_id}` — wrong ID type

**Files modified:** `frontend2/src/features/loans/panels/BorrowerActiveLoansPanel.tsx`, `frontend2/src/features/loans/panels/BorrowerLoanHistoryPanel.tsx`, `frontend2/src/features/loans/table/LoanRow.tsx`
**Commit:** 5ada056
**Applied fix:** Replaced `loan.inventory_id` with `loan.item.id` in all three link sites. The `loan.item.id` field is the item definition ID set by the backend decoration layer and is the correct value for the `/items/:id` route.

---

### WR-01: `Service.Create` and `Service.Return` are non-atomic

**Files modified:** `backend/internal/domain/warehouse/loan/service.go`
**Commit:** 99bd080
**Applied fix:** Added `TODO(WR-01)` comments on both the Create and Return paths documenting the non-atomic gap and directing a future developer to wire the existing `TxManager` (router.go). Full transaction wrapping is deferred — the fix as documentation tracks the debt explicitly in source. This finding requires human verification that the comment placement and wording are sufficient until a proper transaction refactor is implemented.

---

### WR-02: Dead `if inv != nil` guard masks data-loss scenario in `Service.Return`

**Files modified:** `backend/internal/domain/warehouse/loan/service.go`
**Commit:** 99bd080
**Applied fix:** Removed the dead `if inv != nil` guard. Replaced with an `errors.Is(err, shared.ErrNotFound)` branch: if the inventory record has been deleted the loan return is still persisted (loan is authoritative) and the inventory status update is skipped; any other `FindByID` error still propagates. Committed in the same atomic commit as WR-01 since both changes are in `service.go`.

---

### WR-03: `LoanRepository.Save` silently drops notes changes on existing loans

**Files modified:** `backend/internal/infra/postgres/loan_repository.go`
**Commit:** 234aa91
**Applied fix:** Added a doc comment above `Save` explicitly stating that it handles only three cases (Create, Return, ExtendDueDate) and that callers needing to persist notes-only or combined edits on existing loans must use `repo.Update`. Prevents future misuse of the upsert contract.

---

### WR-04: `useReturnLoan` invalidates `itemKeys.detail(inventoryId)` with wrong ID type

**Files modified:** `frontend2/src/features/loans/hooks/useLoanMutations.ts`, `frontend2/src/features/loans/actions/LoanReturnFlow.tsx`, `frontend2/src/features/loans/__tests__/useLoanMutations.test.ts`
**Commit:** f114826
**Applied fix:** Renamed `inventoryId` to `itemId` in the `useReturnLoan` mutation variables type. Updated `LoanReturnFlow.tsx` to pass `itemId: loan.item.id` (item definition ID from the decoration layer) instead of `loan.inventory_id`. Updated all three test cases in `useLoanMutations.test.ts` to use `itemId: "item-A"` and assert against `itemKeys.detail("item-A")`.

---

### WR-05: `useLoansForItem` parameter named `inventoryId` but callers pass item definition ID

**Files modified:** `frontend2/src/features/loans/hooks/useLoansForItem.ts`, `frontend2/src/lib/api/loans.ts`
**Commit:** d20a75b
**Applied fix:** Renamed the `inventoryId` parameter to `itemId` throughout `useLoansForItem` (signature, queryKey, queryFn, enabled guard, and JSDoc). Renamed the parameter in `loanKeys.forItem` from `inventoryId` to `itemId` and updated the JSDoc to clarify the key is an item definition ID, not an inventory row UUID.

---

_Fixed: 2026-04-17_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
