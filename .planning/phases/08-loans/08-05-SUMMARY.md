---
phase: 08-loans
plan: 05
subsystem: loans (frontend2)
tags: [loans, borrower, component, LOAN-06]
requires:
  - "08-01: loansApi.byBorrower, PartitionedLoans, loanStatus"
  - "08-04: useLoanMutations, ReturnLoanDialog, ExtendLoanDialog"
provides:
  - "BorrowerLoanPanels — reusable borrower Active + History loan surfaces"
  - "useBorrowerLoans — per-borrower partitioned loans query"
affects:
  - "Phase 9 BORR-03 (borrower detail page mounts BorrowerLoanPanels)"
tech-stack:
  added: []
  patterns:
    - "Component-only delivery (no orphan route) — Phase 9 mounts it"
    - "Server-authoritative status/overdue (loanStatus + is_overdue), never client date math"
    - "Shared ['loans', wsId] query prefix so Plan-04 mutation onSettled invalidation covers by-borrower"
key-files:
  created:
    - frontend2/src/features/loans/hooks/useBorrowerLoans.ts
    - frontend2/src/features/loans/components/BorrowerLoanPanels.tsx
    - frontend2/src/features/loans/components/BorrowerLoanPanels.test.tsx
  modified: []
decisions:
  - "Due-chip DAY MAGNITUDE derived from due_date (display-only); the overdue DECISION stays server-owned (is_overdue)"
  - "Loan History titlebar uses 'plain' variant (the valid neutral Window variant; 'default' is not a TitlebarVariant)"
metrics:
  duration: ~20m
  completed: 2026-06-13
  tasks: 2
  files: 3
---

# Phase 8 Plan 05: BorrowerLoanPanels reusable component (LOAN-06) Summary

Reusable `borrowerId`-driven `BorrowerLoanPanels` component (Active Loans + Loan History) backed by `GET /borrowers/{borrowerId}/loans`, partitioned on `is_active`, reusing the Plan-04 Return/Extend dialogs and mutations — shipped component-only with unit tests (no borrower route exists until Phase 9 BORR-03 mounts it).

## What was built

- **`useBorrowerLoans(wsId, borrowerId)`** — `useQuery` keyed `["loans", wsId, "by-borrower", borrowerId]` (shares the `["loans", wsId]` prefix that `useLoanMutations.onSettled` invalidates), calling `loansApi.byBorrower` and partitioning the bare `{ items }` envelope into `{ active, history }` on `is_active`. `enabled` gated on both ids.
- **`BorrowerLoanPanels`** — two Windows mirroring the item-detail `LoanPanels` language:
  - *Active Loans*: pink titlebar with one row per active loan, mint `● Nothing out` when none. Each row: item-name `<Link>` → `/items/{item_id}`, a due chip (neutral `due in {n}d`, danger `⚠ −{n}d` when `is_overdue`), the three-way `loanStatus` pill, and `RETURN` + `EXTEND` buttons opening the Plan-04 `ReturnLoanDialog`/`ExtendLoanDialog` (per-row local open state).
  - *Loan History*: returned loans (item link · `loaned → returned` · status pill); empty → `NO LOAN HISTORY` / "This borrower hasn't returned anything yet."
- **Test** mounts the component directly in a `MemoryRouter` (no `<Routes>`), covering empty/active/overdue/history states and asserting RETURN fires the return mutation; a route-guard test asserts `routes/index.tsx` registers no borrower route (`path="borrowers` count = 0).

## Threat model adherence

- **T-08-OVERDUE (Spoofing)**: overdue chip branch reads `loan.is_overdue` only; the displayed day count is presentation magnitude derived from `due_date` and never drives the overdue decision.
- **T-08-04 (Tampering)**: row actions reuse Plan-04 `useLoanMutations` (snapshot/revert on 4xx).
- **T-08-06 (Information Disclosure)**: read goes through `loansApi.byBorrower` → `/workspaces/{wsId}/borrowers/{id}/loans`; workspace re-scoping is server-side.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Loan History Window used an invalid titlebar variant**
- **Found during:** Task 2 (GREEN)
- **Issue:** Initial draft used `titlebarVariant="default"`, which is not a member of `TitlebarVariant` (`blue|pink|mint|butter|plain`).
- **Fix:** Switched the neutral history Windows to `titlebarVariant="plain"`.
- **Files modified:** BorrowerLoanPanels.tsx
- **Commit:** 4b20d4c7

**2. [Rule 3 - Blocking] Test harness missing dialog context providers**
- **Found during:** Task 2 (GREEN)
- **Issue:** Mounting the component threw `useModalStackContext must be used within a <ModalStackProvider>` because the reused Plan-04 dialogs require `ModalStackProvider`/`ShortcutsProvider` — the component rendered empty.
- **Fix:** Wrapped the test render with `ShortcutsProvider` + `ModalStackProvider` (matching the LoansListPage test harness).
- **Files modified:** BorrowerLoanPanels.test.tsx
- **Commit:** 4b20d4c7

**3. [Rule 3 - Blocking] Route-guard file read used an unsupported file URL scheme**
- **Found during:** Task 2 (GREEN)
- **Issue:** `new URL("../routes/index.tsx", import.meta.url)` produced a non-`file:` URL under the Vitest transform, throwing "The URL must be of scheme file".
- **Fix:** Read `src/routes/index.tsx` via `path.resolve(process.cwd(), …)` instead.
- **Files modified:** BorrowerLoanPanels.test.tsx
- **Commit:** 4b20d4c7

**4. [Rule 1 - Bug] RETURN confirm button selector matched the row RETURN button**
- **Found during:** Task 2 (GREEN)
- **Issue:** `getByRole("button", { name: /^Return$/i })` matched BOTH the dialog's "Return" confirm and the row's "RETURN" button (case-insensitive), throwing "Found multiple elements".
- **Fix:** Scoped the confirm click to `within(await findByRole("dialog"))`.
- **Files modified:** BorrowerLoanPanels.test.tsx
- **Commit:** 4b20d4c7

> No changes were made to any locked file (STATE.md, ROADMAP.md, lib/api.ts, lib/api/loans.ts, vite.config.ts, routes/index.tsx, backend, or 08-06's e2e spec).

## Verification

- `bun run lint:tsc` → clean.
- `bun run test src/features/loans/components/BorrowerLoanPanels.test.tsx` → 6 passed.
- `bun run test src/features/loans/` → 5 files, 27 passed.
- `bun run build` → built clean (only pre-existing chunk-size advisory).
- `grep -c 'path="borrowers' src/routes/index.tsx` → 0 (no orphan route).

## Self-Check: PASSED

- FOUND: frontend2/src/features/loans/hooks/useBorrowerLoans.ts
- FOUND: frontend2/src/features/loans/components/BorrowerLoanPanels.tsx
- FOUND: frontend2/src/features/loans/components/BorrowerLoanPanels.test.tsx
- Commits: 8f76824d (hook), f0a8df1f (RED test), 4b20d4c7 (component GREEN)
