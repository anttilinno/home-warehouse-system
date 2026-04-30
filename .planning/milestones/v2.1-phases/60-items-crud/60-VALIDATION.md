---
phase: 60
slug: items-crud
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-16
---

# Phase 60 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | go test (backend) / vitest (frontend) |
| **Config file** | `backend/` (go test ./...) / `frontend2/vite.config.ts` |
| **Quick run command** | `cd backend && go build ./... && go vet ./...` |
| **Full suite command** | `cd backend && go test ./... && cd ../frontend2 && npm run build` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && go build ./... && go vet ./...`
- **After every plan wave:** Run `cd backend && go test ./... && cd ../frontend2 && npm run build`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 60-01-01 | 01 | 1 | ITEM-04/05 | T-60-01 | workspace-scoped delete (no cross-tenant) | unit | `cd backend && go test ./internal/items/...` | ❌ W0 | ⬜ pending |
| 60-01-02 | 01 | 1 | ITEM-01 | T-60-02 | paginated COUNT(*) not len(results) | unit | `cd backend && go test ./internal/items/...` | ❌ W0 | ⬜ pending |
| 60-01-03 | 01 | 1 | ITEM-04 | T-60-03 | hard delete vs archive are distinct ops | unit | `cd backend && go test ./internal/items/...` | ❌ W0 | ⬜ pending |
| 60-02-01 | 02 | 1 | ITEM-01 | — | N/A | build | `cd frontend2 && npm run build` | ✅ | ⬜ pending |
| 60-02-02 | 02 | 1 | ITEM-01/02 | — | N/A | build | `cd frontend2 && npm run build` | ✅ | ⬜ pending |
| 60-03-01 | 03 | 2 | ITEM-01/02 | — | N/A | build | `cd frontend2 && npm run build` | ✅ | ⬜ pending |
| 60-03-02 | 03 | 2 | ITEM-03 | — | N/A | build | `cd frontend2 && npm run build` | ✅ | ⬜ pending |
| 60-04-01 | 04 | 3 | ITEM-01/02 | — | N/A | e2e | `cd frontend2 && npm run build` | ✅ | ⬜ pending |
| 60-04-02 | 04 | 3 | ITEM-03/04/05 | — | N/A | e2e | `cd frontend2 && npm run build` | ✅ | ⬜ pending |
| 60-04-03 | 04 | 3 | ITEM-06/07/08 | — | N/A | e2e | `cd frontend2 && npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/internal/items/item_service_test.go` — stubs for ITEM-01..08 (Delete, pagination, search/filter/sort)
- [ ] `backend/internal/items/item_repository_test.go` — stubs for ListItemsFiltered, Delete, FindByWorkspace COUNT

*Existing frontend infrastructure (vitest / build) covers all frontend requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Archive/unarchive toggle visibility in list | ITEM-06 | No E2E automation configured | Open items list, archive item, verify hidden; toggle show-archived chip, verify visible |
| RetroConfirmDialog blocks accidental delete | ITEM-05 | UI interaction state | Click delete, verify dialog appears before deletion executes |
| Search debounce (300ms) feels correct | ITEM-01 | Subjective UX | Type in search box rapidly, verify no excessive API calls in Network tab |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
