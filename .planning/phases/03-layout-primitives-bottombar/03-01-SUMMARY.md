---
phase: 03-layout-primitives-bottombar
plan: 01
subsystem: frontend2 application chrome (keyboard-shortcut SSOT)
tags: [react, shortcuts, keyboard, context, ssot, tdd]
requires:
  - "Phase 1/2 frontend2 stack (react 19, vitest 4, @testing-library)"
provides:
  - "src/components/shortcuts/ — isEditableTarget guard, ShortcutsProvider SSOT, useShortcuts hook, barrel"
  - "isEditableTarget(target) — pure four-surface editable guard (incl. nested contenteditable)"
  - "ShortcutsProvider — keyed registry + single document keydown dispatcher"
  - "useShortcuts(id?, bindings) — route-facing register hook with useId() fallback"
  - "Shortcut type { key; label; action; danger? }"
affects:
  - "Plan 03-05 Bottombar (consumes useShortcutsContext for render + reads merged shortcuts)"
  - "FAB (Plan 03-04/05) — same SSOT under D-08"
tech-stack:
  added: []
  patterns:
    - "Single-owner document keydown listener inside the provider (Pitfall 2)"
    - "shortcutsRef synced via effect — live bindings without re-subscribe (Pitfall 3)"
    - "Keyed registry: register(id, bindings) sets groups[id]; merged = Object.values(groups).flat()"
    - "useId() fallback id for caller-omitted registration (orchestrator resolution #3)"
key-files:
  created:
    - frontend2/src/components/shortcuts/isEditableTarget.ts
    - frontend2/src/components/shortcuts/isEditableTarget.test.ts
    - frontend2/src/components/shortcuts/ShortcutsContext.tsx
    - frontend2/src/components/shortcuts/useShortcuts.ts
    - frontend2/src/components/shortcuts/useShortcuts.test.tsx
    - frontend2/src/components/shortcuts/index.ts
  modified: []
decisions:
  - "id source: caller-supplied stable id with useId() fallback (resolution #3) — satisfies both BAR-02 (useId) and TUI-01 (route name)"
  - "Guard suppresses on meta/ctrl/alt too — single-letter shortcuts never collide with browser/OS combos"
metrics:
  duration: ~10m
  completed: 2026-06-12
  tasks: 2
  files: 6
  commits: 2
  tests: 17
---

# Phase 03 Plan 01: Keyboard-Shortcut SSOT + isEditableTarget Guard Summary

The keyboard-shortcut single source of truth both the Bottombar and the FAB will
consume (D-08): a keyed in-memory registry with one document-level keydown
dispatcher, fronted by `useShortcuts(id?, bindings)`, and guarded by the
`isEditableTarget` editable-surface check that ships in this first keydown-wiring
commit of the phase.

## What Was Built

- **`isEditableTarget.ts`** — pure guard returning true for INPUT / TEXTAREA /
  SELECT, `isContentEditable` elements, and any node nested inside a
  `contenteditable="true"` ancestor (via `closest`), false for div / body / null.
- **`isEditableTarget.test.ts`** — the headline BAR-03 regression suite: 8
  assertions over real DOM nodes (four editable surfaces + nested-contenteditable
  + 3 negatives). Ships in the FIRST keydown-wiring commit (Success Criterion 3 /
  Wave 0).
- **`ShortcutsContext.tsx`** — `ShortcutsProvider` holding `Record<string,
  Shortcut[]>`; `register`/`unregister` (`useCallback`), merged
  `Object.values(groups).flat()` (`useMemo`). The ONE document keydown dispatcher
  lives here (single owner — Pitfall 2): bails on meta/ctrl/alt, bails on
  `isEditableTarget(e.target)`, case-insensitive key match, `preventDefault()` +
  `action()`. A `shortcutsRef` is synced via effect so the handler reads live
  bindings without re-subscribing (Pitfall 3); the effect returns
  `removeEventListener` (StrictMode no-op). Exports `useShortcutsContext` (throws
  outside provider) and the `Shortcut` type.
- **`useShortcuts.ts`** — `useShortcuts(id: string | undefined, bindings)`;
  defaults the id from `useId()` when omitted (resolution #3); register on mount,
  unregister on unmount. Documents the `useMemo`-your-bindings discipline
  (Pitfall 3) in a comment.
- **`index.ts`** — barrel re-exporting guard, provider, context hook,
  useShortcuts, and `Shortcut`.

## Verification

| Check | Command | Result |
|-------|---------|--------|
| Guard regression suite | `bunx vitest run src/components/shortcuts/isEditableTarget.test.ts` | 8/8 pass, exit 0 |
| Provider/hook behavior suite | `bunx vitest run src/components/shortcuts/useShortcuts.test.tsx` | 9/9 pass, exit 0 |
| Full shortcuts dir | `bunx vitest run src/components/shortcuts/` | 17/17 pass, exit 0 |
| Type check | `bun run lint:tsc` | exit 0 |
| Import guard | `bun run lint:imports` | exit 0 (no idb/serwist/offline/sync) |
| Nested-contenteditable branch present | `grep "closest('[contenteditable"` | matched |
| Guard wired into dispatcher | `grep isEditableTarget ShortcutsContext.tsx` | matched |
| Listener cleanup present | `grep removeEventListener ShortcutsContext.tsx` | matched |
| useId fallback | `grep useId useShortcuts.ts` | matched |

The 9-behavior provider suite covers: register/unregister, distinct-id merge,
same-id replace (not append), fire-exactly-once, input-focus suppression,
modifier-bail, case-insensitivity, useId() fallback, and throws-outside-provider.

## Must-Haves Coverage

| Truth | Where proven |
|-------|--------------|
| Guard true for 4 surfaces incl. nested, false for body/div | `isEditableTarget.test.ts` (8 assertions) |
| Single-letter shortcut does NOT fire while typing in editable surfaces | `useShortcuts.test.tsx` "does NOT fire while focus is in an <input>" + the guard suite |
| Register on mount / unregister on unmount; merged = union | `useShortcuts.test.tsx` register/unregister + merge tests |
| Re-registering same id replaces (no flicker) | `useShortcuts.test.tsx` replace-not-append test |
| Single owned listener dispatches exactly once (no StrictMode double-fire) | `useShortcuts.test.tsx` fire-exactly-once + provider's single-effect cleanup |

## Deviations from Plan

None — plan executed exactly as written. Both tasks followed the TDD
RED → GREEN flow (RED confirmed by import-resolution failure for Task 1 and a
failing suite for Task 2 before each implementation landed). No refactor commit
was needed (implementations were minimal-and-clean on first GREEN). No
auto-fixes (Rules 1-3) and no architectural decisions (Rule 4) arose.

## TDD Gate Compliance

This is a `type=execute` plan with two `tdd="true"` tasks. Each task wrote its
test first (RED), then the implementation (GREEN). Per-task commits combine the
test and its implementation into a single `feat(...)` commit per the plan's
acceptance criteria (the guard + four-surface suite explicitly ship together in
the first keydown commit). No separate `test(...)` RED commit was required by
this plan's structure; the RED state was verified by running the suite before
writing each module (Task 1: import error; Task 2: `VITEST_EXIT=1`).

## Notes for Downstream

- Bottombar/FAB MUST read the SSOT via `useShortcutsContext().shortcuts` — do
  NOT add a second document keydown listener (Pitfall 2; the provider owns it).
- Callers passing inline-array bindings should `useMemo` them (Pitfall 3 —
  documented in `useShortcuts.ts`).
- `App.tsx` / route composition must wrap the authed shell in
  `<ShortcutsProvider>` (deferred to the AppShell-wiring plan).
- F1/`?` help-dialog and ESC modal-stack listeners are SEPARATE owners (Plan
  03-02 ModalStack + later F1 dialog) — not added here.

## Known Stubs

None — every export is fully wired and tested; no placeholder data flows to UI
(this plan ships no UI, only the registry/guard/hook spine).

## Self-Check: PASSED

- FOUND: frontend2/src/components/shortcuts/isEditableTarget.ts
- FOUND: frontend2/src/components/shortcuts/isEditableTarget.test.ts
- FOUND: frontend2/src/components/shortcuts/ShortcutsContext.tsx
- FOUND: frontend2/src/components/shortcuts/useShortcuts.ts
- FOUND: frontend2/src/components/shortcuts/useShortcuts.test.tsx
- FOUND: frontend2/src/components/shortcuts/index.ts
- FOUND commit: 87abff1 (Task 1 — guard + regression suite)
- FOUND commit: c92cda7 (Task 2 — provider + dispatcher + hook + barrel)
