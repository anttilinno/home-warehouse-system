---
phase: 51
slug: app-layout
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-11
audited: 2026-04-11
---

# Phase 51 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.3 + Testing Library React 16.3.2 |
| **Config file** | `frontend2/vitest.config.ts` |
| **Quick run command** | `cd frontend2 && bun run test` |
| **Full suite command** | `cd frontend2 && bun run test && bun run build` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend2 && bun run test`
- **After every plan wave:** Run `cd frontend2 && bun run test && bun run build`
- **Before `/gsd-verify-work`:** Full suite must be green + build green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 51-01-01 | 01 | 0 | LAY-01 | — | N/A | unit stub | `cd frontend2 && bun vitest run src/components/layout/__tests__/AppShell.test.tsx` | ✅ | ✅ green |
| 51-01-02 | 01 | 0 | LAY-01 | — | N/A | unit stub | `cd frontend2 && bun vitest run src/components/layout/__tests__/Sidebar.test.tsx` | ✅ | ✅ green |
| 51-01-03 | 01 | 0 | LAY-01 | — | N/A | unit stub | `cd frontend2 && bun vitest run src/components/layout/__tests__/TopBar.test.tsx` | ✅ | ✅ green |
| 51-01-04 | 01 | 0 | LAY-03 | — | N/A | unit stub | `cd frontend2 && bun vitest run src/components/layout/__tests__/LoadingBar.test.tsx` | ✅ | ✅ green |
| 51-01-05 | 01 | 0 | LAY-03 | — | N/A | unit stub | `cd frontend2 && bun vitest run src/components/layout/__tests__/ErrorBoundary.test.tsx` | ✅ | ✅ green |
| 51-02-01 | 02 | 1 | LAY-01 | — | N/A | unit | `cd frontend2 && bun vitest run src/components/layout/__tests__/Sidebar.test.tsx` | ✅ | ✅ green |
| 51-02-02 | 02 | 1 | LAY-01 | — | N/A | unit | `cd frontend2 && bun vitest run src/components/layout/__tests__/TopBar.test.tsx` | ✅ | ✅ green |
| 51-02-03 | 02 | 1 | LAY-02 | — | N/A | unit | `cd frontend2 && bun vitest run src/components/layout/__tests__/AppShell.test.tsx` | ✅ | ✅ green |
| 51-02-04 | 02 | 1 | LAY-03 | — | N/A | unit | `cd frontend2 && bun vitest run src/components/layout/__tests__/LoadingBar.test.tsx` | ✅ | ✅ green |
| 51-02-05 | 02 | 1 | LAY-03 | — | N/A | unit | `cd frontend2 && bun vitest run src/components/layout/__tests__/ErrorBoundary.test.tsx` | ✅ | ✅ green |
| 51-03-01 | 02 | 2 | LAY-01, LAY-02, LAY-03 | — | Auth routes excluded from shell | integration | `cd frontend2 && bun run test && bun run build` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `frontend2/src/components/layout/__tests__/AppShell.test.tsx` — stubs for LAY-01a, LAY-02a, LAY-02b, LAY-02c
- [x] `frontend2/src/components/layout/__tests__/Sidebar.test.tsx` — stubs for LAY-01b, LAY-01c
- [x] `frontend2/src/components/layout/__tests__/TopBar.test.tsx` — stubs for LAY-01d
- [x] `frontend2/src/components/layout/__tests__/LoadingBar.test.tsx` — stub for LAY-03a
- [x] `frontend2/src/components/layout/__tests__/ErrorBoundary.test.tsx` — stub for LAY-03b

*All test files created and passing (150/150 tests green, build clean).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Retro visual styling matches BAM reference (amber active state, pressed shadow) | LAY-01 | CSS visual correctness cannot be automated | Open app, navigate to Dashboard and Settings; verify amber bg + pressed shadow on active item |
| Mobile drawer slide animation feels smooth | LAY-02 | Animation quality is subjective | Resize to mobile viewport, open/close drawer; verify smooth slide-in from left |
| Loading bar briefly visible on route change | LAY-03 | Synchronous routes make timing hard to test | Click nav links; verify thin amber bar flashes at top of viewport |
| Error boundary displays retro error page | LAY-03 | ErrorBoundary requires real render throw | Manually trigger error or use `?crash=1` test mode; verify RetroPanel with SYSTEM ERROR heading |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** 2026-04-11 — audit pass, 0 gaps found, 150/150 tests green, build clean

---

## Validation Audit 2026-04-11

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
| Tests passing | 150 / 150 |
| Build | clean |
