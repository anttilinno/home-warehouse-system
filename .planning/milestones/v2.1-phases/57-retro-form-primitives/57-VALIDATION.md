---
phase: 57
slug: retro-form-primitives
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-15
---

# Phase 57 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest + @testing-library/react |
| **Config file** | `frontend2/vitest.config.ts` |
| **Quick run command** | `cd frontend2 && bun run test --run` |
| **Full suite command** | `cd frontend2 && bun run test --run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend2 && bun run test --run`
- **After every plan wave:** Run `cd frontend2 && bun run test --run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 57-01-01 | 01 | 0 | infra | — | N/A | install | `cd frontend2 && bun pm ls \| grep react-hook-form` | ✅ W0 | ⬜ pending |
| 57-01-02 | 01 | 1 | infra | — | N/A | unit | `cd frontend2 && bun run test --run RetroTextarea` | ❌ W0 | ⬜ pending |
| 57-01-03 | 01 | 1 | infra | — | N/A | unit | `cd frontend2 && bun run test --run RetroCheckbox` | ❌ W0 | ⬜ pending |
| 57-01-04 | 01 | 1 | infra | — | N/A | unit | `cd frontend2 && bun run test --run RetroFileInput` | ❌ W0 | ⬜ pending |
| 57-02-01 | 02 | 1 | infra | — | N/A | unit | `cd frontend2 && bun run test --run RetroSelect` | ❌ W0 | ⬜ pending |
| 57-02-02 | 02 | 1 | infra | — | N/A | unit | `cd frontend2 && bun run test --run RetroCombobox` | ❌ W0 | ⬜ pending |
| 57-02-03 | 02 | 2 | infra | — | N/A | unit | `cd frontend2 && bun run test --run RetroFormField` | ❌ W0 | ⬜ pending |
| 57-03-01 | 03 | 1 | infra | — | N/A | unit | `cd frontend2 && bun run test --run RetroPagination` | ❌ W0 | ⬜ pending |
| 57-03-02 | 03 | 1 | infra | — | N/A | unit | `cd frontend2 && bun run test --run RetroConfirmDialog` | ❌ W0 | ⬜ pending |
| 57-03-03 | 03 | 1 | infra | — | N/A | unit | `cd frontend2 && bun run test --run RetroEmptyState` | ❌ W0 | ⬜ pending |
| 57-03-04 | 03 | 2 | infra | — | N/A | unit | `cd frontend2 && bun run test --run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend2/src/components/retro/__tests__/RetroTextarea.test.tsx` — stubs for textarea rendering/behavior
- [ ] `frontend2/src/components/retro/__tests__/RetroCheckbox.test.tsx` — stubs for checkbox states
- [ ] `frontend2/src/components/retro/__tests__/RetroFileInput.test.tsx` — stubs for file input + reset
- [ ] `frontend2/src/components/retro/__tests__/RetroSelect.test.tsx` — stubs for listbox keyboard nav
- [ ] `frontend2/src/components/retro/__tests__/RetroCombobox.test.tsx` — stubs for async combobox + keyboard nav
- [ ] `frontend2/src/components/retro/__tests__/RetroFormField.test.tsx` — stubs for RHF integration + validation
- [ ] `frontend2/src/components/retro/__tests__/RetroPagination.test.tsx` — stubs for page navigation
- [ ] `frontend2/src/components/retro/__tests__/RetroConfirmDialog.test.tsx` — stubs for dialog open/confirm/cancel
- [ ] `frontend2/src/components/retro/__tests__/RetroEmptyState.test.tsx` — stubs for empty state rendering

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| RetroCombobox keyboard navigation feel | infra | UX feedback loop — keyboard flow requires visual verification | Open `/demo`, tab to combobox, type partial text, verify arrow-key navigation highlights options, Enter selects |
| RetroFileInput drag-and-drop | infra | JSDOM does not simulate drag events reliably | Open `/demo`, drag a file onto the input, verify it appears selected |
| RetroConfirmDialog focus trap | infra | Focus trapping requires real browser | Open `/demo`, trigger confirm dialog, press Tab repeatedly, verify focus stays inside dialog |
| 44px touch targets on mobile | infra | Requires device or DevTools mobile emulation | Open `/demo` in mobile emulation, verify all interactive elements meet 44px minimum |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
