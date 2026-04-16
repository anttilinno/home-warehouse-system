---
phase: 61
slug: item-photos
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-16
---

# Phase 61 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (frontend) + go test (backend) |
| **Config file** | `frontend/vite.config.ts` / `backend/go.mod` |
| **Quick run command** | `cd frontend && npm run typecheck` |
| **Full suite command** | `cd frontend && npm run typecheck && cd ../backend && go test ./...` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend && npm run typecheck`
- **After every plan wave:** Run `cd frontend && npm run typecheck && cd ../backend && go test ./...`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 61-01-01 | 01 | 1 | PHOTO-01 | — | file size capped at 10MB client-side | manual | — | ❌ W0 | ⬜ pending |
| 61-01-02 | 01 | 1 | PHOTO-01 | — | form field name matches backend "photo" | unit | `cd backend && go test ./internal/item/...` | ✅ | ⬜ pending |
| 61-01-03 | 01 | 1 | PHOTO-03 | — | primary photo set via PUT /photos/{id}/primary | unit | `cd backend && go test ./internal/item/...` | ✅ | ⬜ pending |
| 61-02-01 | 02 | 1 | PHOTO-02 | — | gallery renders with prev/next nav | manual | — | ❌ W0 | ⬜ pending |
| 61-02-02 | 02 | 1 | PHOTO-02 | — | ObjectURLs revoked on unmount | manual | — | ❌ W0 | ⬜ pending |
| 61-03-01 | 03 | 2 | PHOTO-03 | — | delete confirmation step present | manual | — | ❌ W0 | ⬜ pending |
| 61-04-01 | 04 | 2 | PHOTO-04 | — | thumbnail shown in items list row | manual | — | ❌ W0 | ⬜ pending |
| 61-04-02 | 04 | 2 | PHOTO-04 | — | retro placeholder shown when no photo | manual | — | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing vitest and go test infrastructure covers automated checks
- Manual browser testing required for UI interactions (gallery nav, upload, delete confirm)

*Existing infrastructure covers all phase requirements for automated checks. Manual-only verifications documented below.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Upload JPEG/PNG/HEIC with client-side resize | PHOTO-01 | Browser File API required | Open item detail, click upload, select file >1MB, verify resize before upload |
| 10MB pre-upload size enforcement | PHOTO-01 | Browser File API required | Select file >10MB, verify rejection before network request |
| Gallery prev/next navigation | PHOTO-02 | Visual/interaction | Upload 2+ photos, verify prev/next buttons cycle correctly |
| ObjectURL memory revocation | PHOTO-02 | Browser devtools required | Upload photo, navigate away, check Memory tab for leak |
| Delete with confirmation | PHOTO-03 | Visual/interaction | Click delete on photo, verify confirm dialog, confirm, verify gallery updates |
| Thumbnail in items list | PHOTO-04 | Visual | Upload photo to item, go to items list, verify thumbnail shows in row |
| Retro placeholder | PHOTO-04 | Visual | View item with no photos in list/detail header, verify placeholder renders |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
