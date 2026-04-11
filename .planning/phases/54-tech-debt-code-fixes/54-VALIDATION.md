---
phase: 54
slug: tech-debt-code-fixes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-11
---

# Phase 54 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.3 |
| **Config file** | `frontend2/vitest.config.ts` |
| **Quick run command** | `cd frontend2 && bun run test` |
| **Full suite command** | `cd frontend2 && bun run test && bun run build` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend2 && bun run test`
- **After every plan wave:** Run `cd frontend2 && bun run test && bun run build`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 54-01-01 | 01 | 1 | SC-1 | — | N/A | unit | `cd frontend2 && bun run test -- Sidebar` | ✅ update existing | ⬜ pending |
| 54-01-02 | 01 | 1 | SC-2 | T-54-01 | Tokens only cleared on 401/403, not network errors | unit | `cd frontend2 && bun run test` | no new test needed | ⬜ pending |
| 54-01-03 | 01 | 1 | SC-3 | — | N/A | visual/manual | `cd frontend2 && bun run test` | no existing test | ⬜ pending |
| 54-02-01 | 02 | 1 | SC-4 | — | N/A | tsc | `cd frontend2 && bun run build` | N/A (type check) | ⬜ pending |
| 54-02-02 | 02 | 1 | SC-5 | — | N/A | catalog presence | `grep "SECTOR NOT FOUND" frontend2/locales/en/messages.po` | N/A | ⬜ pending |
| 54-02-03 | 02 | 1 | SC-6 | — | N/A | tsc | `cd frontend2 && bun run build` | N/A | ⬜ pending |
| 54-02-04 | 02 | 1 | SC-7 | — | N/A | grep | `grep -r "retro/RetroToast" frontend2/src/features/settings/` exits 1 | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test files need to be created.

- `frontend2/src/components/layout/__tests__/Sidebar.test.tsx` — update to cover all 4 NavLinks (exists ✅)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| DataPage buttons disabled when workspaceId null | SC-3 | No existing test coverage; visual state | Load DataPage with null workspaceId; verify EXPORT + IMPORT buttons are visually disabled and non-interactive |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
