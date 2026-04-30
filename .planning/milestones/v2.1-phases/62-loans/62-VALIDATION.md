---
phase: 62
slug: loans
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-17
---

# Phase 62 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (frontend) + go test (backend) |
| **Config file** | `frontend2/vite.config.ts` / `go.mod` |
| **Quick run command** | `cd frontend2 && bun run test --run` |
| **Full suite command** | `cd frontend2 && bun run test --run && go test ./... -count=1` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend2 && bun run test --run`
- **After every plan wave:** Run `cd frontend2 && bun run test --run && go test ./... -count=1`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 62-01-01 | 01 | 1 | LOAN-01 | T-62-01 | Notes maxLength enforced server-side | unit | `go test ./internal/... -run TestLoan` | ❌ W0 | ⬜ pending |
| 62-01-02 | 01 | 1 | LOAN-02 | T-62-01 | PATCH rejects unauthorized loan updates | unit | `go test ./internal/... -run TestLoan` | ❌ W0 | ⬜ pending |
| 62-01-03 | 01 | 1 | LOAN-03 | — | Return marks loan as returned | unit | `go test ./internal/... -run TestLoan` | ❌ W0 | ⬜ pending |
| 62-02-01 | 02 | 1 | LOAN-01 | — | API client typed correctly | unit | `cd frontend2 && bun run test --run src/lib/api` | ❌ W0 | ⬜ pending |
| 62-02-02 | 02 | 1 | LOAN-02 | — | useLoans hook returns correct data shape | unit | `cd frontend2 && bun run test --run src/hooks` | ❌ W0 | ⬜ pending |
| 62-03-01 | 03 | 2 | LOAN-04 | — | Loans list renders tabs with counts | unit | `cd frontend2 && bun run test --run LoansPage` | ❌ W0 | ⬜ pending |
| 62-03-02 | 03 | 2 | LOAN-05 | — | Create loan form validates required fields | unit | `cd frontend2 && bun run test --run CreateLoan` | ❌ W0 | ⬜ pending |
| 62-04-01 | 04 | 2 | LOAN-06 | — | Item detail shows active loan | unit | `cd frontend2 && bun run test --run ItemDetail` | ❌ W0 | ⬜ pending |
| 62-04-02 | 04 | 2 | LOAN-06 | — | Borrower detail shows loan history | unit | `cd frontend2 && bun run test --run BorrowerDetail` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend2/src/pages/loans/__tests__/LoansPage.test.tsx` — stubs for LOAN-04, LOAN-05
- [ ] `frontend2/src/pages/loans/__tests__/CreateLoanForm.test.tsx` — stubs for LOAN-02
- [ ] `frontend2/src/hooks/__tests__/useLoans.test.ts` — stubs for LOAN-01
- [ ] `internal/loans/handler_test.go` — stubs for LOAN-01..LOAN-03

*Existing vitest + go test infrastructure covers phase; only test file stubs needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| RetroCombobox item/borrower picker UX | LOAN-02 | Requires browser interaction | Open create-loan slide-over, verify fuzzy search in both comboboxes, Esc closes combobox not slide-over |
| Overdue tab shows correct count | LOAN-04 | Requires real date comparison | Create loan with past due date, verify Overdue count increments in tab badge |
| Loan moves to History on return | LOAN-03 | Multi-tab state sync | Mark loan returned, verify Active count decrements and History shows entry |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
