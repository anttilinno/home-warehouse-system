---
status: complete
phase: 62-loans
source: [62-VERIFICATION.md]
started: 2026-04-17T14:10:00Z
updated: 2026-04-17T20:20:00Z
---

## Current Test

[complete]

## Tests

### 1. End-to-end loan flow — create, edit, mark returned, tabs, detail pages
expected: All 29 steps in the 62-04-PLAN.md how-to-verify block produce the described UX outcomes with no uncaught console errors
result: **PASS** (with one bug found and fixed during testing)

**Prereqs:**
1. Backend running: `cd backend && mise run dev` (port 8080)
2. Frontend running: `cd frontend2 && bun run dev` (port 5173)
3. Workspace with ≥2 items and ≥2 borrowers

**Steps verified:**

- ✓ `/loans` tabbed page loads: AKTIIVSED / ÜLETATUD / AJALUGU tabs with correct counts
- ✓ Create loan via RetroCombobox pickers (item + borrower) — success toast "Laenutus loodud."
- ✓ Create failure path: item already on loan → toast "Sellele esemele pole saadaolevaid ühikuid."
- ✓ Edit loan due date and notes — save shows toast "Laenutus uuendatud."
- ✓ Mark returned via confirmation dialog → toast "Laenutus tagastatud." → loan moves from AKTIIVSED to AJALUGU
- ✓ `/items/:id` — AKTIIVNE LAENUTUS panel (empty when not on loan) and LAENUTUSTE AJALUGU panel with history entries
- ✓ `/borrowers/:id` — AKTIIVSED LAENUTUSED panel (active loan with overdue indicator) and LAENUTUSTE AJALUGU panel with returned entry
- ✓ Item links in borrower panels use item definition IDs (not inventory_id) — CR-03 fix verified
- ✓ Cache invalidation: after create/return, lists update immediately without manual refresh
- ✓ i18n: UI renders in Estonian (ET locale loaded correctly)
- ✓ Console sanity: zero uncaught errors throughout session

**Bug found and fixed during UAT:**

`LoanRepository.FindActiveLoanForInventory` was returning `shared.ErrNotFound` (via `pgx.ErrNoRows`) when no active loan exists — the normal state for a loanable item. `Service.Create` saw `err != nil` and propagated this as a 400 error, blocking ALL new loan creation.

Fix: changed `return nil, shared.ErrNotFound` → `return nil, nil` for the no-rows case in
`backend/internal/infra/postgres/loan_repository.go:FindActiveLoanForInventory`.

## Summary

total: 1
passed: 1
issues: 1
pending: 0
skipped: 0
blocked: 0

## Issues Found

### BUG-01: `FindActiveLoanForInventory` blocks all loan creation (FIXED)
- **Severity:** Critical (blocked all new loan creation)
- **File:** `backend/internal/infra/postgres/loan_repository.go` — `FindActiveLoanForInventory`
- **Root cause:** `pgx.ErrNoRows` was mapped to `shared.ErrNotFound` instead of `nil`; `Service.Create` treated non-nil error as failure
- **Fix:** Return `nil, nil` when no active loan found (normal case)
- **Status:** Fixed during UAT session

## Gaps

None — all test areas covered.
