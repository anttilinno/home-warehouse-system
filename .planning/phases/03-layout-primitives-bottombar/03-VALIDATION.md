---
phase: 3
slug: layout-primitives-bottombar
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-12
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Port-and-restyle phase: 5/7 behavioral primitives have legacy reference
> implementations; risk is discipline (guard-first, ESC ordering, clock
> isolation), not novelty. See 03-RESEARCH.md Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + RTL (+ MSW where API touched); Playwright for viewport/E2E |
| **Config file** | `frontend2/vitest.config.ts`, `frontend2/playwright.config.ts` |
| **Quick run command** | `cd frontend2 && bun run test src/` |
| **Full suite command** | `cd frontend2 && bun run test && bun run build && bun run lint:imports` |
| **Estimated runtime** | ~10s unit · ~30s with build |

---

## Sampling Rate

- **After every task commit:** `cd frontend2 && bun run test src/` (affected specs at minimum)
- **After every plan wave:** full suite + build + `lint:imports` (CI grep guard — legacy port must strip idb/serwist/offline/sync imports)
- **Before phase verification:** full suite + build green
- **Max feedback latency:** 30 seconds

---

## Per-Requirement Verification Map

| Requirement | Behavior to prove | Test Type | Where |
|-------------|-------------------|-----------|-------|
| SHELL-01 | AppShell 2×3 grid renders TopBar/Sidebar/Bottombar/PageHeader on authenticated routes | unit (RTL render + role/test-id asserts) | AppShell spec |
| SHELL-02 | Collapse toggle flips single `data-collapsed` attribute; no JS measurement | unit (attribute assert before/after click) | Sidebar spec |
| SHELL-03/04 | Group labels render; active route gets active treatment (class/token assert) | unit | Sidebar spec |
| SHELL-05/06 | TopBar slots (switcher/bell/SSE/user) render placeholders; PageHeader breadcrumb + meta | unit | TopBar/PageHeader specs |
| BAR-01..04 | Bottombar chips from useShortcuts registry; F1 chip; clocks tick (fake timers); overflow | unit | Bottombar spec |
| BAR-05 / TUI-01 | **isEditableTarget guard: shortcut does NOT fire from input, textarea, select, contenteditable** (4 surfaces, first-commit test); fires from body | unit — MANDATORY Wave 0 | useShortcuts spec |
| TUI-01 (ESC) | ESC pops topmost modal only; bare ESC never reaches logout while stack non-empty | unit | modal-stack spec |
| D-05/D-06 | <768px: FAB no Bottombar; ≥768px: Bottombar no FAB — JSDOM asserts class strings/conditional render; true breakpoint behavior → Playwright viewport test | unit + e2e | responsive spec + e2e |

---

## Wave 0 Requirements

- [ ] `useShortcuts` provider + `isEditableTarget` guard tests exist BEFORE/WITH the first shortcut wiring commit (Success Criterion 3 demands guard from first commit)
- [ ] Modal-stack ESC-ordering test
- [ ] `lint:imports` stays green through the legacy port (strip OfflineProvider/PWA/motion imports)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Collapse animation feel (rail 60px) | SHELL-02 | transition smoothness is visual | toggle collapse on dev server, observe |
| FAB keycap-stack menu feel on touch | D-07 | touch interaction | mobile viewport, tap FAB |
| Chrome layout at real breakpoints | D-05/D-06 | JSDOM does no layout | resize browser through 768px |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
