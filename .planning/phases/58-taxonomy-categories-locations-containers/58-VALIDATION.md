---
phase: 58
slug: taxonomy-categories-locations-containers
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-16
---

# Phase 58 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `frontend2/vitest.config.ts` |
| **Quick run command** | `cd frontend2 && npx vitest run --reporter=verbose src/features/taxonomy` |
| **Full suite command** | `cd frontend2 && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend2 && npx vitest run --reporter=verbose src/features/taxonomy`
- **After every plan wave:** Run `cd frontend2 && npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 58-01-01 | 01 | 1 | TAX-01 | — | N/A | unit | `cd frontend2 && npx vitest run src/features/taxonomy/hooks` | ❌ W0 | ⬜ pending |
| 58-01-02 | 01 | 1 | TAX-02 | — | N/A | unit | `cd frontend2 && npx vitest run src/features/taxonomy/hooks` | ❌ W0 | ⬜ pending |
| 58-01-03 | 01 | 1 | TAX-03 | — | N/A | unit | `cd frontend2 && npx vitest run src/features/taxonomy/hooks` | ❌ W0 | ⬜ pending |
| 58-01-04 | 01 | 1 | TAX-04 | — | N/A | unit | `cd frontend2 && npx vitest run src/features/taxonomy/forms` | ❌ W0 | ⬜ pending |
| 58-02-01 | 02 | 2 | TAX-05 | — | N/A | unit | `cd frontend2 && npx vitest run src/features/taxonomy/tree` | ❌ W0 | ⬜ pending |
| 58-02-02 | 02 | 2 | TAX-06 | — | N/A | unit | `cd frontend2 && npx vitest run src/features/taxonomy/tabs` | ❌ W0 | ⬜ pending |
| 58-02-03 | 02 | 2 | TAX-07 | — | N/A | unit | `cd frontend2 && npx vitest run src/features/taxonomy` | ❌ W0 | ⬜ pending |
| 58-03-01 | 03 | 3 | TAX-08 | — | N/A | unit | `cd frontend2 && npx vitest run src/features/taxonomy/panel` | ❌ W0 | ⬜ pending |
| 58-03-02 | 03 | 3 | TAX-09 | — | N/A | unit | `cd frontend2 && npx vitest run src/features/taxonomy/actions` | ❌ W0 | ⬜ pending |
| 58-03-03 | 03 | 3 | TAX-10 | — | N/A | unit | `cd frontend2 && npx vitest run src/features/taxonomy` | ❌ W0 | ⬜ pending |
| 58-03-04 | 03 | 3 | TAX-11 | — | N/A | unit | `cd frontend2 && npx vitest run src/features/taxonomy` | ❌ W0 | ⬜ pending |
| 58-03-05 | 03 | 3 | TAX-12 | — | N/A | unit | `cd frontend2 && npx vitest run src/features/taxonomy` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend2/src/features/taxonomy/__tests__/hooks.test.ts` — stubs for TAX-01, TAX-02, TAX-03
- [ ] `frontend2/src/features/taxonomy/__tests__/forms.test.ts` — stubs for TAX-04
- [ ] `frontend2/src/features/taxonomy/__tests__/tree.test.ts` — stubs for TAX-05
- [ ] `frontend2/src/features/taxonomy/__tests__/tabs.test.ts` — stubs for TAX-06, TAX-07
- [ ] `frontend2/src/features/taxonomy/__tests__/panel.test.ts` — stubs for TAX-08
- [ ] `frontend2/src/features/taxonomy/__tests__/actions.test.ts` — stubs for TAX-09, TAX-10, TAX-11, TAX-12

*Existing vitest infrastructure covers the framework — only test stubs are needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Retro styling renders correctly with theme | TAX-11 | Visual regression requires browser inspection | Open /taxonomy in browser, verify retro card borders, monospace font, and correct color tokens |
| 409 conflict warning toast renders and dismisses | TAX-09 | Requires live backend with items assigned | Assign an item to a category, attempt delete, verify toast copy matches spec |
| Slide-over panel animation | TAX-08 | CSS transform requires browser | Click edit on any node, verify panel slides in from right at correct z-layer |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
