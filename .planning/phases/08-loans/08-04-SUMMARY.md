---
phase: 08-loans
plan: 04
subsystem: loans
tags: [loans, mutations, optimistic, dialogs, item-detail]
requires:
  - "08-01: loansApi.return/extend/update + loanStatus"
  - "08-02: LoanRowActions stub + useItemLoans in items/LoanPanels"
provides:
  - "useLoanMutations: optimistic return/extend/update with snapshot+revert"
  - "ReturnLoanDialog / ExtendLoanDialog / EditLoanDialog (blue titlebars)"
  - "LoanRowActions wired (overwrites Plan-02 stub, same export+props)"
  - "Real item-detail LoanPanels (LOAN-05): live RETURN/EXTEND + ⊕ LOAN THIS ITEM CTA"
affects:
  - "frontend2/src/features/loans"
  - "frontend2/src/features/items/components/LoanPanels.tsx"
  - "frontend2/src/features/items/ItemDetailPage.tsx"
tech-stack:
  added: []
  patterns:
    - "optimistic mutation mirror of useInventoryMutations (cancelQueries → getQueriesData snapshot → setQueriesData patch → onError restore+toast → onSettled invalidate)"
    - "bare {items} loan list-cache shape guard (Pitfall 4 / Array.isArray)"
    - "server-authoritative overdue display (loan.is_overdue, never client date math)"
key-files:
  created:
    - frontend2/src/features/loans/hooks/useLoanMutations.ts
    - frontend2/src/features/loans/hooks/useLoanMutations.test.tsx
    - frontend2/src/features/loans/components/ReturnLoanDialog.tsx
    - frontend2/src/features/loans/components/ExtendLoanDialog.tsx
    - frontend2/src/features/loans/components/EditLoanDialog.tsx
  modified:
    - frontend2/src/features/loans/components/LoanRowActions.tsx
    - frontend2/src/features/items/components/LoanPanels.tsx
    - frontend2/src/features/items/components/LoanPanels.test.tsx
    - frontend2/src/features/items/ItemDetailPage.tsx
decisions:
  - "Return dialog uses BLUE titlebar + primary confirm — a return is a reversible completion, not a destructive action (override; not pink)."
  - "Overdue chip/line read loan.is_overdue (server flag), never client due-date math (T-08-OVERDUE)."
  - "extendLoan optimistically patches due_date only; is_overdue left to onSettled re-invalidation so the server value wins."
metrics:
  duration: ~12m
  completed: 2026-06-13
---

# Phase 8 Plan 04: Loan Lifecycle Mutations + Dialogs + Real Item LoanPanels Summary

Wired the loan lifecycle (LOAN-03 return, LOAN-04 extend + edit) as optimistic
React-Query mutations with snapshot+revert, surfaced them through three
blue-titlebar dialogs, replaced the Plan-02 LoanRowActions stub with the wired
dialogs (same export + props, no LoansListPage edit), and made the Phase-7
item-detail LoanPanels REAL (LOAN-05) — live RETURN/EXTEND, a ⊕ LOAN THIS ITEM
CTA, server-authoritative overdue chip, and a three-way history status pill.

## What Was Built

### Task 1 — useLoanMutations (TDD)
`useLoanMutations.ts` mirrors `useInventoryMutations` exactly on the
`["loans", wsId]` prefix: `returnLoan` (optimistic `is_active:false` +
`returned_at`), `extendLoan` (patch `due_date`, wire body `{new_due_date}`),
`updateLoan` (patch `due_date`+`notes`). All three snapshot via
`getQueriesData`, restore on error with a persistent `retroToast.error`, and
`onSettled` invalidate so the server's recomputed `is_overdue` is authoritative
(T-08-04). List-cache shape is bare `{items}` with `Array.isArray` guard
(Pitfall 4). Test: 5/5 (optimistic flip, revert-on-4xx, extend body, update
patch, prefix invalidation).

### Task 2 — Dialogs + LoanRowActions
- `ReturnLoanDialog`: `RetroConfirmDialog`, **blue** titlebar, primary confirm,
  `Mark "{item}" returned by {borrower}?`, success toast → close.
- `ExtendLoanDialog`: blue `RetroDialog` (MoveDialog pattern), required date
  input (defaults current-due+7d / today+7d), sends `{new_due_date}` RFC3339.
- `EditLoanDialog`: blue `RetroDialog`, clearable due date + notes textarea.
- `LoanRowActions`: overwrote the Plan-02 stub body — same export + props
  `{loan, tab?}`, `stopPropagation` so row click doesn't navigate, history tab
  renders nothing. LoansListPage untouched.

### Task 3 — Real LoanPanels (TDD, LOAN-05)
`ActiveLoanPanel` gained `itemId`; available state renders `⊕ LOAN THIS ITEM`
→ `/loans/new?itemId=`; on-loan state renders live RETURN/EXTEND dialogs on
`active[0]`; overdue (server `is_overdue`) shows a danger chip + line above the
buttons. `LoanHistoryList` upgraded to the three-way `loanStatus` pill.
`ItemDetailPage` callsite threads `itemId={item.id}`. Test: 9/9.

## Deviations from Plan

None — plan executed as written. Test scaffolding additions required by the
real (non-stub) panel: wrapped `LoanPanels.test.tsx` renders in
`ModalStackProvider` + `MemoryRouter` and mocked `useWorkspace` (the dialogs
pull `useLoanMutations → useWorkspace`, and `RetroDialog` requires the modal
stack even when closed). These are test-infra adjustments, not behavior changes.

## Threat Model Compliance

- T-08-04 (optimistic tampering): onError restores the pre-mutation snapshot;
  onSettled re-invalidates — no client-trusted state survives a 4xx. Covered by
  the revert-on-422 test.
- T-08-OVERDUE (overdue spoofing): overdue chip/line read `loan.is_overdue`
  only; zero client date math.
- T-08-05 (info disclosure): all calls go through `loansApi.*` which scopes the
  `/workspaces/{wsId}/loans/{id}/...` path; server re-scopes by workspace_id.

## Verification

- `bun run lint:tsc` — clean
- `bun run lint:imports` — OK
- `bun run build` — built (pre-existing >500kB chunk warning, project-wide, out of scope)
- `bun run test src/features/loans/ src/features/items/components/LoanPanels.test.tsx` — **24/24 across 4 files**

## Known Stubs

None. The Plan-02 disabled-RETURN stub + "arrive in Phase 8" hint were removed
(grep returns 0).

## Self-Check: PASSED

All created files present; all task commits (913d9910, d891f306, e807611f) in
the branch history.
