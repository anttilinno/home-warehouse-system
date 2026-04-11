---
phase: 52
slug: dashboard
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-11
---

# Phase 52 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `frontend2/vite.config.ts` |
| **Quick run command** | `cd frontend2 && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd frontend2 && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend2 && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd frontend2 && npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 52-01-01 | 01 | 1 | DASH-01 | — | workspaceId resolves from /workspaces | unit | `cd frontend2 && npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 52-01-02 | 01 | 1 | DASH-01 | — | AuthContext provides workspaceId | unit | `cd frontend2 && npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 52-02-01 | 02 | 2 | DASH-01 | — | stat panels render counts from API | unit | `cd frontend2 && npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 52-02-02 | 02 | 2 | DASH-02 | — | activity feed renders log lines correctly | unit | `cd frontend2 && npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 52-02-03 | 02 | 2 | DASH-02 | — | SSE reconnect closes EventSource on unmount | unit | `cd frontend2 && npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 52-02-04 | 02 | 2 | DASH-03 | — | quick-action cards navigate to correct routes | unit | `cd frontend2 && npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 52-03-01 | 03 | 3 | DASH-03 | — | stub routes render without crash | unit | `cd frontend2 && npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend2/src/features/dashboard/__tests__/DashboardPage.test.tsx` — stubs for DASH-01, DASH-02, DASH-03
- [ ] `frontend2/src/features/auth/__tests__/AuthContext.test.tsx` — stubs for workspace ID resolution
- [ ] `frontend2/src/test/mocks/eventSourceMock.ts` — EventSource mock pattern for JSDOM (known gap from research)

*Note: vitest already configured; no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SSE live update triggers activity feed refresh | DASH-02 | Requires live backend with EventSource | 1. Load dashboard 2. Create an item via API 3. Verify feed updates within 5s |
| Empty workspace redirect to /setup | DASH-01 | Requires fresh account state | 1. Log in with fresh account 2. Delete all workspaces 3. Confirm redirect to /setup |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
