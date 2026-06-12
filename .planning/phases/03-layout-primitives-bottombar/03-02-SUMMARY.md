---
phase: 03-layout-primitives-bottombar
plan: 02
subsystem: frontend2 application chrome
tags: [modal-stack, esc-ordering, keyboard, react-context, tdd]
requires:
  - react 19 context/hooks (already installed)
provides:
  - ModalStackProvider — single ESC arbiter (push/pop stack, one keydown listener)
  - useModalStackContext — typed accessor, throws outside provider
  - useModalStack(isOpen, onClose) — push-on-open / pop-on-close+unmount ergonomic
affects:
  - "Wave 2+ overlays (F1 help dialog, mobile drawer, FAB menu) will consume useModalStack"
tech-stack:
  added: []
  patterns:
    - "ref-backed stack (no re-render churn) read by a single document keydown listener"
    - "onClose held in a ref so handler identity changes never re-push the stack entry"
    - "single-listener-owner + cleanup discipline (mirrors the shortcuts provider idiom)"
key-files:
  created:
    - frontend2/src/components/modal/ModalStackContext.tsx
    - frontend2/src/components/modal/useModalStack.ts
    - frontend2/src/components/modal/index.ts
    - frontend2/src/components/modal/ModalStack.test.tsx
  modified: []
decisions:
  - "Stack lives in a useRef, not state — pushing/popping an overlay must not re-render the subtree; the keydown listener reads the live stack synchronously."
  - "useModalStack reads onClose through a ref so a fresh closure each render keeps the same stack entry (no churn), matching the stale-closure discipline from 03-RESEARCH Pitfall 3."
  - "No REFACTOR commit — GREEN implementation was already clean."
metrics:
  duration: ~6m
  completed: 2026-06-12
  tasks: 1
  files: 4
---

# Phase 3 Plan 02: Modal-Stack ESC-Ordering Provider Summary

The single ESC arbiter for the app chrome: `ModalStackProvider` owns one
document keydown listener that pops the TOPMOST overlay only, while an empty
stack makes ESC a proven no-op — so logout is never reachable via bare ESC.
`useModalStack(isOpen, onClose)` is the one-call ergonomic every later overlay
(F1 dialog, drawer, FAB) uses to push on open and pop on close/unmount.

## What Was Built

- **`ModalStackContext.tsx`** — `ModalStackProvider` holding a `useRef` stack of
  `{ token: symbol; close: () => void }`. `push(close)` returns a token;
  `pop(token)` removes that entry by identity. A single `document` `keydown`
  listener (installed once, cleaned up on unmount) handles ESC: empty stack →
  early return (no-op); otherwise `preventDefault()` and call the LAST entry's
  `close()`. `useModalStackContext()` throws outside the provider.
- **`useModalStack.ts`** — `useModalStack(isOpen, onClose)`: pushes when
  `isOpen` is true, pops on `isOpen → false` or unmount. `onClose` is read via a
  ref so the pushed entry is stable across renders (no stack churn) yet always
  invokes the latest callback.
- **`index.ts`** — barrel re-exporting the provider, hook, accessor, and type.
- **`ModalStack.test.tsx`** — 13 tests, including the two binding behaviors:
  two-overlays-open → only the top `close()` fires (the lower stays open), and
  empty-stack ESC → no `close()` and no throw (logout unreachable via bare ESC).
  Also covers pop-by-token, push-on-open/pop-on-close, pop-on-unmount balance,
  listener cleanup, and non-Escape keys being ignored.

## TDD Cycle

- **RED** (`dc4d7dc`): `test(03-02)` — failing tests committed first; the run
  failed at import resolution (modules absent), the expected RED state.
- **GREEN** (`85ace0d`): `feat(03-02)` — provider + hook + barrel; all 13 tests
  pass.
- **REFACTOR**: none needed.

## Verification

| Gate | Command | Result |
|------|---------|--------|
| Unit tests | `bunx vitest run src/components/modal/ModalStack.test.tsx` | 13 passed |
| Pops the TOP | `grep -Eq "length ?- ?1" ModalStackContext.tsx` | PASS |
| Single-owner cleanup | `grep -q "removeEventListener" ModalStackContext.tsx` | PASS |
| Types | `bun run lint:tsc` | exit 0 |
| Import guard | `bun run lint:imports` | OK |

## Must-Haves Coverage

- "Opening pushes a closer; closing pops it" — `useModalStack` push/pop; tested.
- "ESC pops only the TOPMOST; two overlays → top closes, lower stays open" —
  `stack[length-1].close()`; the two-overlay test asserts the lower `close` is
  never called.
- "Empty stack → ESC is a no-op, never logs out" — early return on empty stack;
  the empty-stack-noop test asserts no close + no throw.
- "Push-on-open / pop-on-unmount leaves the stack balanced" —
  pop-on-unmount + pop-on-close tests verify a fresh ESC reaches nothing.

## Threat Model Coverage

- **T-03-04** (bare ESC triggering logout) — *mitigated*: empty-stack ESC is a
  no-op; the empty-stack-noop test guards it.
- **T-03-05** (leaked listeners / unbalanced stack) — *mitigated*: single
  listener with cleanup (asserted) + `useModalStack` auto-pop on unmount
  (balanced-stack test).
- **T-03-SC** (package installs) — *accepted/N/A*: zero new packages
  (`bun install --frozen-lockfile` only).

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. This is a complete, self-contained context module with no placeholder
data; downstream overlays wire into it in later plans.

## Self-Check: PASSED

- Files exist: ModalStackContext.tsx, useModalStack.ts, index.ts,
  ModalStack.test.tsx — all FOUND.
- Commits exist: `dc4d7dc` (test), `85ace0d` (feat) — both FOUND in git log.
