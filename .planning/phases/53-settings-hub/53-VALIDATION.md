---
phase: 53
slug: settings-hub
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-11
---

# Phase 53 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | frontend2/vite.config.ts |
| **Quick run command** | `cd frontend2 && npx vitest run --reporter=verbose 2>&1 | tail -20` |
| **Full suite command** | `cd frontend2 && npx vitest run 2>&1` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend2 && npx vitest run --reporter=verbose 2>&1 | tail -20`
- **After every plan wave:** Run `cd frontend2 && npx vitest run 2>&1`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 53-01-T0 | 01 | 0 | SET-01 | — | N/A | unit | `cd frontend2 && npx vitest run src/features/settings/__tests__ --reporter=verbose 2>&1 \| tail -20` | ❌ W0 | ⬜ pending |
| 53-01-T1 | 01 | 1 | SET-01, SET-08 | — | N/A | unit | `cd frontend2 && npx vitest run --reporter=verbose 2>&1 \| tail -20` | ❌ W0 | ⬜ pending |
| 53-02-T1 | 02 | 2 | SET-02 | — | Profile edit does not expose other users' data | unit | `cd frontend2 && npx vitest run --reporter=verbose 2>&1 \| tail -20` | ❌ W0 | ⬜ pending |
| 53-02-T2 | 02 | 2 | SET-03 | — | Password change requires current password | unit | `cd frontend2 && npx vitest run --reporter=verbose 2>&1 \| tail -20` | ❌ W0 | ⬜ pending |
| 53-03-T1 | 03 | 3 | SET-04, SET-05 | — | Theme token applied via data-theme attribute; language switch activates correct locale | unit | `cd frontend2 && npx vitest run --reporter=verbose 2>&1 \| tail -20` | ❌ W0 | ⬜ pending |
| 53-03-T2 | 03 | 3 | SET-06, SET-07 | — | Format preferences saved correctly; notification toggles respect master switch | unit | `cd frontend2 && npx vitest run --reporter=verbose 2>&1 \| tail -20` | ❌ W0 | ⬜ pending |
| 53-03-T3 | 03 | 3 | SET-08 | — | Import/export uses authenticated API endpoints | unit | `cd frontend2 && npx vitest run --reporter=verbose 2>&1 \| tail -20` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend2/src/features/settings/__tests__/SettingsPage.test.tsx` — stubs for SET-01
- [ ] `frontend2/src/features/settings/__tests__/ProfilePage.test.tsx` — stubs for SET-02
- [ ] `frontend2/src/features/settings/__tests__/SecurityPage.test.tsx` — stubs for SET-03
- [ ] `frontend2/src/features/settings/__tests__/AppearancePage.test.tsx` — stubs for SET-04
- [ ] `frontend2/src/features/settings/__tests__/LanguagePage.test.tsx` — stubs for SET-05
- [ ] `frontend2/src/features/settings/__tests__/FormatsPage.test.tsx` — stubs for SET-06
- [ ] `frontend2/src/features/settings/__tests__/NotificationsPage.test.tsx` — stubs for SET-07
- [ ] `frontend2/src/features/settings/__tests__/DataPage.test.tsx` — stubs for SET-08
- [ ] Existing vitest infrastructure covers framework — no new install needed

*Wave 0 stubs should import the yet-to-be-created components and assert they render without crashing.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Avatar upload preview renders correctly | SET-02 | File input + canvas preview | Upload a JPEG, verify thumbnail appears before save |
| Dark/light theme visual correctness | SET-04 | CSS visual rendering | Toggle theme, visually confirm retro-dark vars apply to all retro components |
| Language switch — all strings update | SET-05 | Full UI scan | Switch to Estonian, reload, verify no English strings remain |
| Active sessions list accuracy | SET-03 | Live session state | Login from two browsers, verify both appear in Security subpage |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
