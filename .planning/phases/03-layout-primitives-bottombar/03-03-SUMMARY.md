---
phase: 03-layout-primitives-bottombar
plan: 03
subsystem: frontend2 application chrome
tags: [retro-os, keycap, clock, isolation, tdd, a11y, i18n]
requires:
  - "Shortcut type from frontend2/src/components/shortcuts (Plan 03-01)"
  - "Phase 2 token utilities (bevel-raised-ink, bg-*, text-*, sp-*)"
  - "BevelButton press idiom (frontend2/src/components/retro/BevelButton.tsx)"
  - "i18n singleton (frontend2/src/lib/i18n.ts) for <Trans>"
provides:
  - "ShortcutChip — reusable retro System-7 key-cap chip (BAR-04), aria-keyshortcuts + danger/current variants"
  - "Clock — isolated single-interval SESSION/LOCAL leaf (BAR-01, SHELL-05); local={false} for SESSION-only reuse"
affects:
  - "Bottombar (Plan 03-04) renders ShortcutChip rows + the Clock right cluster"
  - "F1 help dialog reuses ShortcutChip for visual consistency"
  - "PageHeader reuses Clock with local={false} for its SESSION meta readout"
tech-stack:
  added: []
  patterns:
    - "Isolated ticking leaf: one setInterval + the only ticking state live in the leaf, so a 1s tick never re-renders the shell (Pattern 6 / Pitfall 5)"
    - "Mount timestamp in a useRef (stable across renders); only `now` is state"
    - "Mutually-exclusive face resolver (danger > current > panel) for chip styling"
    - "<Trans> key strings render under the i18n singleton; tests wrap renders in <I18nProvider i18n={i18n}>"
key-files:
  created:
    - frontend2/src/components/layout/ShortcutChip.tsx
    - frontend2/src/components/layout/ShortcutChip.test.tsx
    - frontend2/src/components/layout/Clock.tsx
    - frontend2/src/components/layout/Clock.test.tsx
  modified: []
decisions:
  - "ShortcutChip props named `shortcutKey` (not `key`) — `key` is a reserved React prop; the value is still typed from Shortcut[\"key\"] so the chip stays bound to the SSOT shape."
  - "Clock initializes SESSION state synchronously from a useRef start timestamp (00:00:00 on first paint) instead of the legacy null-then-effect gap — cleaner first render, isolation guarantee unchanged."
  - "Face styling is danger > current > panel (mutually exclusive) — UI-SPEC reserves bg-titlebar-blue for the focused chip and bg-danger-bg for danger; a danger chip never also shows the accent face."
  - "Clock keys (SESSION/LOCAL) wrapped in <Trans> for i18n parity (plan requirement); Clock tests therefore render under the i18n singleton with the en catalog activated — <Trans> falls back to its source message with an empty catalog."
  - "No REFACTOR commits — both GREEN implementations were already clean."
metrics:
  duration: ~8m
  completed: 2026-06-12
  tasks: 2
  files: 4
---

# Phase 3 Plan 03: ShortcutChip + Isolated Clock Leaf Summary

The two leaf chrome primitives the Bottombar, FAB, PageHeader, and F1 dialog
all reuse: the retro System-7 **ShortcutChip** (`[KEY] LABEL` re-anchored to a
beveled pastel key-cap) and the **Clock** leaf (SESSION/LOCAL readout) whose
single `setInterval` re-renders only itself — the AppShell never re-renders on
the 1s tick (03-RESEARCH Pitfall 5).

## What Was Built

### Task 1 — ShortcutChip (BAR-04)

A focusable `<button type="button">` carrying an inset Plex Mono key glyph cell
(`bg-bg-panel-2` + ink border) and an uppercase Plex Sans label, with the
UI-SPEC §"Key-cap chip" chrome: 2px ink border, `bevel-raised-ink`, the
BevelButton press idiom (`active:translate-x-px active:translate-y-px
active:bg-bg-pressed active:bevel-pressed`). `aria-keyshortcuts={shortcutKey}`
announces the binding to AT. Face is mutually exclusive: `danger` →
`bg-danger-bg text-danger`, `current` → `bg-titlebar-blue`, else `bg-bg-panel`.
Props are typed from the `Shortcut` shape (`Shortcut["key"|"label"|"action"|"danger"]`)
so the chip stays bound to the Plan 03-01 SSOT. No Silkscreen (`font-display`)
anywhere — Pitfall 6 / hard rule 1 — and no raw hex.

### Task 2 — Clock (BAR-01, SHELL-05)

A leaf owning exactly one `setInterval(…, 1000)` and the only ticking state.
SESSION = elapsed since mount (`hh:mm:ss` zero-padded; the real login-time
source lands in Phase 5), LOCAL = `new Date().toLocaleTimeString("et-EE")`
(sketch-006 locale). Both render as `font-mono text-[12px] tabular-nums` values
behind 11px uppercase Plex Sans keys. The mount timestamp lives in a `useRef`
(stable), so only `now` triggers a re-render — and that re-render is confined to
the Clock leaf. An optional `local={false}` prop renders the SESSION readout
alone so the PageHeader can reuse the same component. The interval is cleared on
unmount.

## Verification

- `bunx vitest run src/components/layout/ShortcutChip.test.tsx src/components/layout/Clock.test.tsx` → **12 passed** (7 chip + 5 clock).
- The clock isolation acceptance is green: **parent render-count stays 1** across a fake-timer tick while the SESSION value advances to `00:00:01`.
- `clearInterval`-on-unmount asserted (T-03-07 interval-leak mitigation).
- `bun run lint:tsc` → exit 0. `bun run lint:imports` → exit 0.
- Acceptance greps: `aria-keyshortcuts` present, no `font-display`, no raw hex (both files), `tabular-nums` + `clearInterval` present in Clock.

## Threat Model Coverage

- **T-03-06 (XSS in chip rendering):** labels/keys rendered as escaped JSX text expressions; no `dangerouslySetInnerHTML`. Mitigated.
- **T-03-07 (Clock interval leak):** single leaf-owned interval, `clearInterval` on unmount, unmount-clears-timer test asserts it. Mitigated.
- **T-03-SC (package legitimacy):** zero new packages this plan. N/A.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `<Trans>` requires an `I18nProvider` in the Clock test**
- **Found during:** Task 2 (Clock GREEN — tests threw "Trans component was rendered without I18nProvider").
- **Issue:** The plan mandates wrapping Clock key strings in `<Trans>` for i18n parity, but `<Trans>` reads the lingui context at runtime; an unwrapped test render throws.
- **Fix:** Clock tests render through a `renderClock` helper that wraps the tree in `<I18nProvider i18n={i18n}>`, with `i18n.load("en", {}) / i18n.activate("en")` in `beforeAll` (empty catalog → `<Trans>` falls back to the source message). No production code changed; matches the App.tsx provider-stack idiom.
- **Files modified:** frontend2/src/components/layout/Clock.test.tsx
- **Commit:** 8f64d38

## Known Stubs

None. SESSION = elapsed-since-mount and LOCAL = wall clock are the honest,
plan-sanctioned values for this phase (the real login-time SESSION source is
explicitly Phase 5, per CONTEXT.md §specifics and RESEARCH A1). No empty/mock
data flows to either component.

## Self-Check: PASSED

- FOUND: frontend2/src/components/layout/ShortcutChip.tsx
- FOUND: frontend2/src/components/layout/ShortcutChip.test.tsx
- FOUND: frontend2/src/components/layout/Clock.tsx
- FOUND: frontend2/src/components/layout/Clock.test.tsx
- FOUND commit 89e1615 (test: ShortcutChip RED)
- FOUND commit 3d0e4e4 (feat: ShortcutChip GREEN)
- FOUND commit a258a83 (test: Clock RED)
- FOUND commit 8f64d38 (feat: Clock GREEN)

## TDD Gate Compliance

Both tasks followed RED → GREEN. ShortcutChip: 89e1615 (test, RED — module
absent) → 3d0e4e4 (feat, GREEN). Clock: a258a83 (test, RED) → 8f64d38 (feat,
GREEN). No REFACTOR commits — both implementations were clean on first GREEN.
