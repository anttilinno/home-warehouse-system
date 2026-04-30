---
phase: 46
slug: photo-sync-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 46 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (project standard) |
| **Config file** | `frontend/vitest.config.ts` |
| **Quick run command** | `cd frontend && npx vitest run lib/sync/__tests__/capture-photo-uploader.test.ts` |
| **Full suite command** | `cd frontend && npx vitest run` |
| **Estimated runtime** | ~10 seconds (unit only) / ~60 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend && npx vitest run lib/sync/__tests__/capture-photo-uploader.test.ts`
- **After every plan wave:** Run `cd frontend && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 46-01-01 | 01 | 1 | SYNC-03 | unit | `cd frontend && npx vitest run lib/sync/__tests__/capture-photo-uploader.test.ts` | ✅ (new test cases) | ⬜ pending |
| 46-01-02 | 01 | 1 | SYNC-03 | unit | `cd frontend && npx vitest run lib/sync/__tests__/capture-photo-uploader.test.ts` | ✅ (new test cases) | ⬜ pending |
| 46-01-03 | 01 | 1 | SYNC-04 | manual | Navigate items list after offline quick-capture on separate page | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. The `capture-photo-uploader.test.ts` file needs new test cases added (not a new file). No new test files or framework installation required.

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Quick-capture pending items appear in items list with pending indicator | SYNC-04 | Cross-page state that requires browser + IndexedDB interaction | 1. Go offline in browser devtools. 2. Open Quick Capture page. 3. Capture an item and save. 4. Navigate to Items list. 5. Verify item appears with amber row and pulsing Cloud "Pending" badge. 6. Go back online. 7. Verify item syncs and pending indicator clears. |
| Photos captured offline display from IndexedDB blobs before sync | SYNC-03 (offline display) | Requires real offline state + blob rendering | 1. Capture item with photos while offline. 2. Navigate to quick capture review (if applicable). 3. Verify photo thumbnails render from local blobs. 4. Go online; verify photos upload and server URLs are shown. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
