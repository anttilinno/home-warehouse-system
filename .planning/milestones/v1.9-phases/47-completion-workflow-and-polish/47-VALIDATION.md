---
phase: 47
slug: completion-workflow-and-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 47 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (project standard) |
| **Config file** | `frontend/vitest.config.ts` |
| **Quick run command** | `cd frontend && npx vitest run` |
| **Full suite command** | `cd frontend && npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend && npx vitest run`
- **After every plan wave:** Run `cd frontend && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green + manual walkthrough
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 47-01-01 | 01 | 1 | COMP-04 | manual | `cd frontend && npx vitest run` | ✅ existing | ⬜ pending |
| 47-01-02 | 01 | 1 | COMP-04 | manual | `cd frontend && npx vitest run` | ✅ existing | ⬜ pending |
| 47-01-03 | 01 | 1 | COMP-04 | manual | `cd frontend && npx vitest run` | ✅ existing | ⬜ pending |
| 47-02-01 | 02 | 2 | COMP-04 | manual | `cd frontend && npx vitest run` | ✅ existing | ⬜ pending |
| 47-02-02 | 02 | 2 | COMP-04 | manual | `cd frontend && npx vitest run` | ✅ existing | ⬜ pending |
| 47-02-03 | 02 | 2 | COMP-04 | build check | `cd frontend && npx tsc --noEmit` | ✅ existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

No new test files are required. Phase changes are UI behavior changes (sheets, badges, buttons) that are not unit-testable without a browser environment. The existing Vitest suite covers unchanged infrastructure (hooks, utils, sync).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Session summary shows when captureCount > 0 on "Done" | COMP-04 | UI sheet interaction requires browser | Navigate quick capture → save ≥1 item → tap Done → verify sheet appears with count |
| Session summary thumbnails display captured item photos | COMP-04 | Requires real camera/photo blob lifecycle | Capture item with photo → tap Done → verify thumbnail(s) visible in summary sheet |
| "Needs Review" filter chip narrows items list | COMP-04 | Requires server-side API verification | Toggle filter → verify only needs_review=true items displayed |
| "Needs Review" badge appears on item detail | COMP-04 | Requires item with needs_review=true | Open quick-captured item → verify amber banner visible |
| "Mark as Reviewed" removes badge on tap | COMP-04 | Requires button interaction + reload | Tap "Mark as Reviewed" → verify banner disappears, toast shown |
| All new strings display correctly in ET/RU locales | COMP-04 | Locale switching required | Switch to Estonian/Russian → verify no raw key strings visible in summary + items |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
