---
phase: 59
slug: borrowers-crud
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-16
---

# Phase 59 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (frontend), go test (backend) |
| **Config file** | `frontend2/vite.config.ts` |
| **Quick run command** | `cd frontend2 && npx vitest run --reporter=verbose 2>&1 | tail -20` |
| **Full suite command** | `cd frontend2 && npx vitest run && cd .. && go test ./...` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend2 && npx vitest run --reporter=verbose 2>&1 | tail -20`
- **After every plan wave:** Run `cd frontend2 && npx vitest run && cd .. && go test ./...`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 59-01-01 | 01 | 1 | BORR-01 | — | N/A | unit | `go test ./internal/api/... -run TestBorrower` | ❌ W0 | ⬜ pending |
| 59-01-02 | 01 | 1 | BORR-02 | — | N/A | unit | `go test ./internal/api/... -run TestBorrower` | ❌ W0 | ⬜ pending |
| 59-01-03 | 01 | 1 | BORR-03 | — | N/A | unit | `cd frontend2 && npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 59-02-01 | 02 | 2 | BORR-01 | — | N/A | component | `cd frontend2 && npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 59-02-02 | 02 | 2 | BORR-02 | — | N/A | component | `cd frontend2 && npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 59-03-01 | 03 | 3 | BORR-04 | — | N/A | integration | `cd frontend2 && npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 59-03-02 | 03 | 3 | BORR-05 | — | N/A | integration | `cd frontend2 && npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend2/src/features/borrowers/__tests__/BorrowerForm.test.tsx` — stubs for BORR-01, BORR-02
- [ ] `frontend2/src/features/borrowers/__tests__/BorrowersListPage.test.tsx` — stubs for BORR-04, BORR-05
- [ ] `frontend2/src/features/borrowers/__tests__/BorrowerDetailPage.test.tsx` — stub for BORR-03
- [ ] Existing vitest infrastructure covers all phase requirements (no new framework install needed)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Retro visual styling of borrower list | BORR-04 | CSS/visual verification | Open /borrowers, confirm retro table with pixel border renders |
| Archive/delete blocked when active loans | BORR-03 | Requires live data state | Create a borrower with a loan, attempt delete, confirm 400 error renders |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
