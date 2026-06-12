---
phase: 04-retro-atoms
plan: 03
subsystem: frontend2-retro-atoms
tags: [feedback-family, retro-os, status-dot, status-pill, empty-state, a11y]
requires:
  - frontend2/src/components/retro/RetroBadge.tsx
  - frontend2/src/components/retro/BevelButton.tsx
  - frontend2/src/styles/tokens.css
provides:
  - RetroStatusDot
  - StatusPill
  - RetroEmptyState
  - retro/feedback barrel
affects:
  - frontend2/src/styles/globals.css
tech-stack:
  added: []
  patterns:
    - "Prop-driven visual primitives (no data-source coupling) — TUI-03 dot takes a `state` prop only"
    - "Thin presets over shipped chrome (StatusPill = RetroBadge passthrough; no fork)"
    - "Source-grep test gate to forbid premature coupling (Pitfall 6)"
key-files:
  created:
    - frontend2/src/components/retro/feedback/RetroStatusDot.tsx
    - frontend2/src/components/retro/feedback/RetroStatusDot.test.tsx
    - frontend2/src/components/retro/feedback/StatusPill.tsx
    - frontend2/src/components/retro/feedback/StatusPill.test.tsx
    - frontend2/src/components/retro/feedback/RetroEmptyState.tsx
    - frontend2/src/components/retro/feedback/RetroEmptyState.test.tsx
    - frontend2/src/components/retro/feedback/index.ts
  modified:
    - frontend2/src/styles/globals.css
decisions:
  - "StatusPill = thin passthrough over RetroBadge (variant prop only) — keeps the ONE pill-chrome contract; UI-SPEC 'pastel fills carry ink text ONLY' is already satisfied by RetroBadge, so no *-deep text inside the fill."
  - "RetroStatusDot SSE-decoupling enforced by a source-read test (grep gate for useSSE/sseStatus/EventSource = 0), not just convention — comments reworded to avoid the literal forbidden tokens so the gate stays honest."
  - "RetroEmptyState owns layout/chrome only; copy is consumer-supplied (call sites wrap in <Trans>) so the no-data vs filtered variants are pure prop differences, not two components."
  - "Blink keyframe lives in an @layer components block in globals.css with a dedicated prefers-reduced-motion guard (animation:none → solid mint)."
metrics:
  duration: ~6m
  completed: 2026-06-13
  tasks: 2
  files: 8
  tests-added: 18
---

# Phase 4 Plan 03: Feedback-Visuals Family Summary

Prop-driven retro-os feedback atoms — `RetroStatusDot` (TUI-03, the `sse: ● live`
panel-header indicator as a DUMB primitive with zero live-stream coupling),
`StatusPill` (TUI-04, OK/WARN/INFO/DANGER as a thin preset over the shipped
RetroBadge), and `RetroEmptyState` — plus the single `globals.css` edit this wave
(the `status-blink` step-end keyframe with a reduced-motion guard).

## What Was Built

**Task 1 — RetroStatusDot (TUI-03) + status-blink keyframe** (commit `c25e400`)
- `RetroStatusDot({ state: "live" | "idle" | "error" })`: `font-mono text-[12px]`
  `sse:` key (muted) + an 8px square (`h-2 w-2`, radius 0) ink-bordered dot +
  the state word. live = `bg-titlebar-mint` + `status-dot--live` blink + word
  `live` (`text-accent-mint-deep`); idle = `bg-fg-faint` + word `offline`
  (`text-fg-muted`), no blink; error = `bg-danger` + word `error`
  (`text-danger`). Dot is `aria-hidden` (decorative); the word carries meaning.
- **Zero SSE coupling (Pitfall 6):** no live-stream hook / browser stream import.
  A test reads the source file and asserts `useSSE|sseStatus|EventSource` count = 0.
- `globals.css`: `@keyframes status-blink { 50% { opacity: 0 } }` +
  `.status-dot--live { animation: status-blink 1.4s steps(1, end) infinite }`
  inside `@layer components`, plus a `@media (prefers-reduced-motion: reduce)`
  guard that sets `animation: none` (dot stays solid mint).

**Task 2 — StatusPill (TUI-04) + RetroEmptyState + barrel** (commit `8646fd3`)
- `StatusPill({ variant: "ok"|"warn"|"info"|"danger", children })`: passes
  `variant` straight to RetroBadge → locked fills (`bg-ok-bg` / `bg-warn-bg` /
  `bg-info-bg` / `bg-danger-bg`) with inherited `text-fg-ink` on the 2px-radius
  ink-bordered chip. No new tokens, no new contrast pairing, no `*-deep` text
  inside the fill.
- `RetroEmptyState({ eyebrow?, glyph?, heading, body, action? })`: centered
  `flex flex-col items-center gap-sp-2 py-sp-5 px-sp-4 text-center`; optional
  10px uppercase eyebrow; 32px glyph (default `◇`) in a 1px ink-bordered square
  thumb (`text-fg-faint` — the sanctioned faint use); 16px Silkscreen
  (`font-display`) uppercase heading; 14px `text-fg-muted` body; optional
  `BevelButton variant="primary"` action. Copy is consumer-supplied per
  UI-SPEC (`NOTHING HERE YET` / `NO MATCHES` variants are prop differences).
- `retro/feedback/index.ts` barrel exports all three atoms + their types.

## Verification

- `bun run test src/components/retro/feedback/` → **3 files, 18 tests, all green**.
- `bun run test` (full suite) → **19 files, 152 tests, all green** (no regressions).
- `bun run lint:tsc` → exit 0. `bun run lint:imports` → OK.
- Acceptance greps: SSE count in RetroStatusDot.tsx = **0**; `status-blink` in
  globals.css = 2; `prefers-reduced-motion` in globals.css = 3; `*-deep` text in
  StatusPill.tsx = 0.
- Manual blink + reduced-motion eyeball deferred to the `/demo` surface
  (Plan 04-06/07), per the plan's verification note.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `import.meta.url` is not a `file:` URL under Vitest**
- **Found during:** Task 1 (RetroStatusDot SSE-grep test).
- **Issue:** The source-read test used `fileURLToPath(new URL("./...", import.meta.url))`, which threw `TypeError: The URL must be of scheme file` because Vite rewrites `import.meta.url` to an http-style module URL in the test transform.
- **Fix:** Switched to `resolve(process.cwd(), "src/components/retro/feedback/RetroStatusDot.tsx")` — stable under the vitest runner (cwd is the `frontend2` package root). Same fix applied to the StatusPill source-grep test.
- **Files modified:** RetroStatusDot.test.tsx, StatusPill.test.tsx
- **Commits:** c25e400, 8646fd3

**2. [Rule 1 - Bug] Doc comment tripped the very grep gate it described**
- **Found during:** Task 1.
- **Issue:** The component's doc comment contained the literal word `EventSource` ("never imports an SSE hook or EventSource"), so the SSE-decoupling test matched and failed even though the code has no such import.
- **Fix:** Reworded the comment to "never imports a live-stream hook or a browser stream source" — preserves intent, keeps the grep gate honest (count = 0).
- **Files modified:** RetroStatusDot.tsx
- **Commit:** c25e400

## Known Stubs

None. RetroStatusDot is intentionally prop-driven with no data source — this is
the contracted TUI-03 design (Pitfall 6: the dashboard wires real connection
state into the `state` prop in Phase 6), not a stub. Documented in the component
doc comment and enforced by the SSE-grep test.

## TDD Gate Compliance

Both tasks followed RED → GREEN. RED was confirmed for each (tests failed on
unresolved imports of the not-yet-created modules) before implementation. Test
and implementation were committed together per the per-task commit protocol, so
the git log shows `feat(...)` commits rather than separate `test(...)`/`feat(...)`
pairs — acceptable for `type: execute` plans (the plan is not `type: tdd`).

## Authentication Gates

None.

## Self-Check: PASSED

- Files: all 8 key-files present on disk (verified below).
- Commits: c25e400 and 8646fd3 both present in git log.
