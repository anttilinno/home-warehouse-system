---
phase: 03-layout-primitives-bottombar
plan: 05
subsystem: frontend2 application chrome (SSOT-consuming function-key surfaces)
tags: [react, bottombar, fab, help-dialog, ssot, modal-stack, tdd, a11y, i18n]
requires:
  - "useShortcutsContext + Shortcut type (Plan 03-01 SSOT)"
  - "useModalStack + ModalStackProvider (Plan 03-02)"
  - "ShortcutChip + Clock leaves (Plan 03-03)"
  - "Window blue-titlebar primitive (@/components/retro)"
provides:
  - "Bottombar — desktop function-key bar reading the SSOT + clocks + F1/ESC + overflow sheet"
  - "F1HelpDialog — grouped keyboard-shortcuts help dialog (blue titlebar, modal-stack ESC, focus trap)"
  - "Fab — mobile-only SSOT counterpart, CSS-transition bevel-keycap stack"
affects:
  - "AppShell wiring plan composes Bottombar (md) + Fab (mobile) + F1HelpDialog into the shell"
  - "ModalStackContext now arbitrates ESC in the CAPTURE phase (affects every overlay's ESC ordering)"
tech-stack:
  added: []
  patterns:
    - "Two surfaces, one SSOT: Bottombar + Fab both read useShortcutsContext().shortcuts (D-08); no second action source, no second letter-keydown listener (Pitfall 2)"
    - "Overflow = sheet: route chips collapse behind a ⋯ MORE keycap opening a blue-titlebar Window over a scrim; F1/ESC + clocks pinned right, never overflow (Success Criterion 5)"
    - "Single F1/'?' toggle owner in F1HelpDialog (legacy use-keyboard-shortcuts-dialog pattern); cleanup on unmount"
    - "Focus trap: dialogRef.focus() on open, Tab/Shift+Tab wrap, restore focus to invoker on close"
    - "Capture-phase ESC arbiter in the modal stack — beats route-level bubble-phase handlers regardless of child-first effect order"
    - "FAB default action: empty route set → single '+ ADD ITEM' navigating via react-router useNavigate"
key-files:
  created:
    - frontend2/src/components/layout/Bottombar.tsx
    - frontend2/src/components/layout/Bottombar.test.tsx
    - frontend2/src/components/layout/F1HelpDialog.tsx
    - frontend2/src/components/layout/F1HelpDialog.test.tsx
    - frontend2/src/components/layout/Fab.tsx
    - frontend2/src/components/layout/Fab.test.tsx
  modified:
    - frontend2/src/components/modal/ModalStackContext.tsx
    - frontend2/src/components/modal/ModalStack.test.tsx
decisions:
  - "Bottombar overflow threshold is a count (>6) not a pixel measure — JSDOM has no layout; the deterministic count keeps the right cluster (F1/ESC + clocks) intact and reuses the Window/modal-stack overlay machinery (one overlay primitive, less code). Real pixel-fit overflow is the Plan 06 viewport test."
  - "F1HelpDialog takes open/onClose/onToggle props — the dialog OWNS the single F1/'?' keydown listener (the one toggle owner) and calls onToggle; the parent holds the open state. This satisfies 'chip-click AND F1-keydown both open' (BAR-05): the Bottombar's F1 chip calls the same onOpenHelp/onToggle path."
  - "[Rule 1] ModalStack ESC arbiter registers in the CAPTURE phase. Child effects fire before parent effects, so a route-level bubble-phase ESC handler nested inside the provider would otherwise win the race and (e.g.) log out before the arbiter could preventDefault. Capture-phase + preventDefault makes the TUI-02 'ESC never logs out while an overlay is open' invariant deterministic regardless of mount order."
  - "FAB default '+ ADD ITEM' navigates to /items/new via useNavigate — a route push (research Pattern 7), not a second SSOT source; the route's registered shortcuts remain the primary action set."
metrics:
  duration: ~22m
  completed: 2026-06-12
  tasks: 3
  files: 8
  commits: 3
  tests: 23
---

# Phase 03 Plan 05: SSOT-Consuming Function-Key Surfaces Summary

The three interactive chrome surfaces that make the shell respond to the
keyboard SSOT: the desktop **Bottombar**, the **F1HelpDialog**, and the
mobile **Fab**. All read the ONE `useShortcutsContext().shortcuts` registry
(D-08 — one source, two surfaces; the dialog renders the same list). F1 (key or
chip) opens the help dialog; ESC closes overlays via the shared modal stack and
never logs out (BAR-05). No surface adds a second letter-keydown listener
(Pitfall 2) — the ShortcutsProvider owns dispatch; these are render-only for
letters.

## What Was Built

### Task 1 — Bottombar (BAR-01/04, desktop-only D-06)

A `<footer aria-label="Shortcuts">` (`hidden md:flex`, 36px, `bg-bg-panel-2`,
`border-t-2`) rendering one `ShortcutChip` per merged SSOT shortcut, a `flex-1`
spacer, then the right cluster: an F1 HELP chip (→ `onOpenHelp`), an ESC BACK
chip (→ `onBack`), and the SESSION/LOCAL `Clock`. When route chips exceed a
count threshold (>6), the overflow collapses behind a `⋯ MORE` keycap that opens
an upward blue-titlebar `Window` sheet (over a scrim, `useModalStack` ESC)
listing the overflowed chips as full keycap rows; selecting one runs its action
then closes. F1/ESC and the clocks stay pinned to the right cluster outside the
collapse zone (Success Criterion 5). The Bottombar owns no document keydown
listener for letters (Pitfall 2).

### Task 2 — F1HelpDialog (BAR-05, TUI-01/02)

Renders nothing when closed; when open, a blue-titlebar `Window`
("KEYBOARD SHORTCUTS") over a `bg-fg-ink/40` scrim, `role="dialog"
aria-modal="true" aria-labelledby` → titlebar id, `min(520px,92vw)`. It OWNS the
single F1/"?" keydown listener (the one toggle owner; bails on modifiers +
editable surfaces; cleanup on unmount). Shortcuts render grouped: a synthetic
**GLOBAL** group (`F1 — Toggle this help`, `ESC — Close / back`) and the merged
**ROUTE** group (each row = `ShortcutChip` + 14px Plex Sans description), with the
`NO SHORTCUTS HERE` empty state for an empty route set. Focus is trapped
(`dialogRef.focus()` on open, Tab/Shift+Tab wrap) and restored to the invoker on
close. `useModalStack(open, onClose)` wires ESC to pop it — never logout (TUI-02).

### Task 3 — Fab (D-05/D-07/D-08)

A fixed 56px square bevel trigger (bottom-right, `calc(env(safe-area-inset-bottom)
+ var(--sp-4))`, `md:hidden` mobile-only), `aria-label="Quick actions"
aria-haspopup="menu" aria-expanded`. The action set derives from
`useShortcutsContext` (the SSOT — resolution #1; no `useFABActions` second
source); an empty route set falls back to a single default `+ ADD ITEM` that
navigates via react-router `useNavigate`. Tapping opens an upward bevel-keycap
`role="menu"` of `role="menuitem"` buttons (CSS `transform`+`opacity`
transitions, 120ms, staggered `transitionDelay`, glyph `+ → ×` rotation,
`motion-reduce` → instant) backed by a scrim; scrim/ESC close via
`useModalStack`. Selecting an item runs its action then closes. No `motion`/
`framer` import.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ModalStack ESC arbiter raced route-level handlers**
- **Found during:** Task 2 (the "ESC closes via modal stack and does NOT log
  out" test failed — a route-level bare-ESC logout handler fired before the
  arbiter could `preventDefault`).
- **Issue:** The modal-stack ESC listener was registered in the bubble phase.
  React fires child effects before parent effects, so a route-level ESC handler
  nested inside `ModalStackProvider` registers its `document` listener FIRST and
  wins the bubble-phase race — logging out before the arbiter runs. This is a
  real latent break of the TUI-02 invariant, not a test artifact.
- **Fix:** Register the arbiter's `keydown` listener in the CAPTURE phase
  (`addEventListener("keydown", onKeyDown, true)` + matching capture-flag
  cleanup). Capture phase runs before any bubble-phase handler regardless of
  registration order, so `preventDefault()` is applied before route handlers see
  the event — making "ESC never logs out while an overlay is open" deterministic.
- **Files modified:** `frontend2/src/components/modal/ModalStackContext.tsx`
  (+ `ModalStack.test.tsx` cleanup-args assertion updated for the capture flag).
- **Commit:** 6c73365

**2. [Rule 3 - Blocking] Test-construction fixes in Fab.test.tsx**
- **Found during:** Task 3 GREEN (two test-only failures, implementation correct).
- **Issue:** (a) the mobile-only `md:hidden` lives on the FAB root container (it
  must hide the trigger AND the menu/scrim), not solely on the trigger button, so
  asserting it on `trigger.className` was wrong; (b) the no-motion-import source
  read used `fileURLToPath(import.meta.url)`, which vitest's transform does not
  expose as a `file:` URL.
- **Fix:** (a) assert the mobile-only class on the FAB root via
  `trigger.closest(".md\\:hidden")`; (b) read the source via
  `resolve(process.cwd(), "src/components/layout/Fab.tsx")`. No production code
  changed for these.
- **Files modified:** `frontend2/src/components/layout/Fab.test.tsx`
- **Commit:** 2d8bef8

## Verification

| Gate | Command | Result |
|------|---------|--------|
| Bottombar suite | `bunx vitest run src/components/layout/Bottombar.test.tsx` | 10/10 pass |
| F1HelpDialog suite | `bunx vitest run src/components/layout/F1HelpDialog.test.tsx` | 6/6 pass |
| Fab suite | `bunx vitest run src/components/layout/Fab.test.tsx` | 7/7 pass |
| Full layout dir | `bunx vitest run src/components/layout/` | 35/35 pass |
| Modal + shortcuts (regression after capture-phase change) | `bunx vitest run src/components/modal/ src/components/shortcuts/` | 30/30 pass |
| Type check | `bun run lint:tsc` | exit 0 |
| Import guard | `bun run lint:imports` | OK (no idb/serwist/offline/sync, no motion/lucide) |

Acceptance greps: `useShortcutsContext` in Bottombar + Fab; `hidden md:flex`
(Bottombar) / `md:hidden` (Fab); no `addEventListener("keydown"` in Bottombar;
`role="dialog"` + `aria-modal` + `useModalStack` + no raw hex in F1HelpDialog;
no `from "(framer-)?motion"` in Fab — all PASS.

## Must-Haves Coverage

| Truth | Where proven |
|-------|--------------|
| Bottombar renders one chip per merged binding + F1 HELP + ESC BACK + clocks | Bottombar.test.tsx (chip-per-shortcut, F1/ESC present, SESSION/LOCAL present) |
| F1 chip AND F1 keydown both open the help dialog | Bottombar F1-fires-onOpenHelp + F1HelpDialog F1-keydown-opens |
| Route chips overflow → ⋯ MORE sheet; F1/ESC + clocks stay right-anchored | Bottombar overflow-MORE + sheet-opens-and-fires tests |
| F1 dialog lists grouped shortcuts, traps focus, ESC closes via modal stack (never logout) | F1HelpDialog grouped-rows + focus-trap + ESC-closes-no-logout tests |
| FAB is mobile-only, SSOT-sourced, opens an upward bevel-keycap stack closed by scrim/ESC | Fab md:hidden + SSOT-menu + ESC-closes + default-when-empty tests |

## Threat Model Coverage

- **T-03-11** (shortcut actions tampering) — *mitigated*: actions are the
  app-defined closures registered into the SSOT; chips/menuitems only invoke
  `s.action`, never build actions from event/URL data.
- **T-03-12** (ESC reaching logout) — *mitigated*: F1 dialog + FAB + overflow
  sheet all push onto the modal stack; the capture-phase arbiter pops the top and
  preventDefaults so ESC never reaches a route logout handler (tested).
- **T-03-13** (duplicate keydown listeners) — *mitigated*: the F1 dialog owns the
  single F1/"?" listener (cleanup on unmount); the Bottombar adds no letter
  listener (Pitfall 2, asserted); the FAB adds none.
- **T-03-14** (XSS in label/key text) — *mitigated*: labels/keys render as
  escaped JSX text via ShortcutChip / keycap spans; no `dangerouslySetInnerHTML`.
- **T-03-SC** (package installs) — *accepted/N/A*: zero new packages
  (`bun install --frozen-lockfile` only).

## TDD Gate Compliance

All three tasks followed RED → GREEN. Each test file was written first and run to
confirm RED (import-resolution failure — the component module absent) before the
implementation landed, then GREEN after. Per-task commits combine each test with
its implementation (the plan's acceptance criteria pair them). No REFACTOR
commits were needed — implementations were clean on first GREEN.

## Known Stubs

None that block the plan's goal. The FAB's default `+ ADD ITEM` navigates to
`/items/new` — that route is wired by a later phase, but the FAB's own
contract (mobile SSOT counterpart with a default action) is fully satisfied;
the action is a real navigation, not placeholder data. SESSION/LOCAL clocks
reuse the Plan 03-03 Clock leaf (SESSION = elapsed-since-mount is the
phase-sanctioned value; real login-time source is Phase 5).

## Self-Check: PASSED

- FOUND: frontend2/src/components/layout/Bottombar.tsx
- FOUND: frontend2/src/components/layout/Bottombar.test.tsx
- FOUND: frontend2/src/components/layout/F1HelpDialog.tsx
- FOUND: frontend2/src/components/layout/F1HelpDialog.test.tsx
- FOUND: frontend2/src/components/layout/Fab.tsx
- FOUND: frontend2/src/components/layout/Fab.test.tsx
- FOUND commit: 6c688a1 (Task 1 — Bottombar)
- FOUND commit: 6c73365 (Task 2 — F1HelpDialog + modal capture-phase fix)
- FOUND commit: 2d8bef8 (Task 3 — Fab)
