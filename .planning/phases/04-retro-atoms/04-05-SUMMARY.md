---
phase: 04-retro-atoms
plan: 05
subsystem: frontend2-feedback-atoms
tags: [toast, sonner, retro-os, feedback-family, a11y, TUI-04]
requires:
  - "sonner@2.0.7 (installed + legitimacy-gated in Plan 04-01)"
  - "retro-os tokens + bevel/pinstripes utilities (Plan 02 / globals.css)"
  - "feedback barrel (Plan 04-03)"
provides:
  - "RetroToaster — retro-skinned sonner <Toaster> region (mini-Window chrome)"
  - "retroToast — sonner toast re-export (incl. .promise); .error never auto-dismisses"
affects:
  - "Phase 6 provider stack (mounts RetroToaster) + every feature page firing toasts"
tech-stack:
  added: []
  patterns:
    - "sonner skin via toastOptions.unstyled + classNames (no fork, no motion lib)"
    - "per-type titlebar label rendered through the Toaster `icons` slot"
    - "danger-never-auto-dismiss enforced at the call surface (retroToast.error → duration:Infinity)"
key-files:
  created:
    - "frontend2/src/components/retro/feedback/RetroToast.tsx"
    - "frontend2/src/components/retro/feedback/retroToast.ts"
    - "frontend2/src/components/retro/feedback/RetroToast.test.tsx"
  modified:
    - "frontend2/src/components/retro/feedback/index.ts"
    - "frontend2/src/styles/globals.css"
decisions:
  - "retroToast is a forwarding function (copies sonner toast methods, overrides .error) — NOT a mutation of sonner's shared singleton, so importing the module has zero global side effect."
  - "Danger persistence is enforced in retroToast.error (duration:Infinity) because sonner reads duration per-toast and the Toaster cannot set a per-type duration."
  - "Per-type titlebar label (DONE/INFO/WARN/ERROR + glyph) is injected via the Toaster `icons` slot and stretched to a full-width pinstriped titlebar bar by .retro-toast CSS — gives the UI-SPEC mini-Window titlebar without a custom toast.custom render, keeping sonner's a11y live-region + hover-pause intact."
metrics:
  duration: "~13 min"
  completed: "2026-06-12"
  tasks: 1
  files: 5
  commits: 2
---

# Phase 4 Plan 05: RetroToast (sonner skin) Summary

RetroToaster skins sonner@2.0.7's `<Toaster>` (`unstyled` + `classNames`) into the retro-os mini-Window toast region, and `retroToast` re-exports sonner's `toast` (incl. `.promise`) with `.error` forced to never auto-dismiss.

## What shipped

- **`RetroToaster`** (`RetroToast.tsx`) — sonner `<Toaster position="bottom-right">` mounted `unstyled` with `classNames` that rebuild each toast as a mini-Window: `border-2 border-border-ink bevel-raised`, radius 0 (zero corner-radius utilities), `w-[min(360px,calc(100vw-2*var(--sp-4)))]`, IBM Plex 14px body, Silkscreen 16px uppercase titlebar label. Region offset above the 36px Bottombar (desktop) / 56px FAB + safe-area (mobile) via `offset` / `mobileOffset`.
- **Semantic titlebar stripes** via the Toaster `icons` slot — `success`=mint/`DONE`/✓, `info`=blue/`INFO`/●, `warning`=butter/`WARN`/⚠, `error`(danger)=pink/`ERROR`/✕ — each a pinstriped Silkscreen bar.
- **`retroToast`** (`retroToast.ts`) — sonner's `toast` re-exported as a forwarding function carrying all methods (`.promise`, `.success`, `.info`, `.warning`, `.loading`, `.custom`, `.dismiss`, `.message`). `.error` is overridden to default `duration: Infinity` so danger toasts NEVER auto-dismiss (callers may opt out with an explicit `duration`).
- **Close box** `aria-label="Dismiss"` via `toastOptions.closeButtonAriaLabel`; sonner gives hover-pause + a11y live-region natively; `prefers-reduced-motion` honored by sonner's own stylesheet (no motion lib added — CSS transitions only).
- **`globals.css`** `.retro-toast` rules reposition sonner's `[data-icon]` slot into a full-width titlebar bar and dock the close box top-right (radius 0, ≥22px hit target).
- **Barrel extended** (not overwritten): `feedback/index.ts` now also exports `RetroToaster` + `retroToast`.

## Engine arbitration honored

Per orchestrator arbitration, sonner is the FINAL engine; the UI-SPEC "sonner declined" note is superseded on the ENGINE only. The UI-SPEC toast VISUAL contract (region above Bottombar/FAB, mini-Window chrome, semantic titlebar stripes, danger never auto-dismiss) is realised entirely via `unstyled` + `classNames` — no hand-roll, dependency intact. The skin renders with **radius 0 and no motion lib** (CSS transitions only).

## Tests

`RetroToast.test.tsx` (9 tests, all green) covers: skin-wiring guards (sonner import, `unstyled`, `border-2`/`border-border-ink`/`bevel-raised`, NO `rounded`, no motion lib), `position="bottom-right"`, success=DONE/polite, error=ERROR persists past the default auto-dismiss window (fake timers, +15s), non-danger auto-dismiss, close box `aria-label="Dismiss"`, and `retroToast` callable + `.promise`/`.success`/`.error`. Full feedback dir: 27/27 green.

jsdom cannot assert visual corner-radius — the classNames-string assertions + the `/demo` manual check (Plan 04-06/07) cover the visual skin; this test asserts wiring + behavior (auto-dismiss policy, a11y roles, close box).

## TDD Gate Compliance

- RED gate: `test(04-05)` commit `90edb7c` (9 failing tests against stubs).
- GREEN gate: `feat(04-05)` commit `4749848` (all 9 green).
- REFACTOR: not needed — implementation is clean; no separate refactor commit.

## Verification

- `bun run test src/components/retro/feedback/RetroToast.test.tsx` → 9/9 pass.
- `bun run lint:tsc` → exit 0.
- `bun run lint:imports` → OK.
- Acceptance greps: `unstyled`=2 (≥1), `rounded`=0, `from "sonner"` present in both files (≥1).
- Manual (`/demo`, Plan 04-06/07): fire all 4 types, confirm mini-Window chrome (no rounded corners), stacking, hover-pause, danger persists — deferred to demo plans.

## Deviations from Plan

None of the Rule 1–4 kind. The plan's interface sketch left the per-type titlebar rendering open ("via sonner's type classNames or custom render"); chose the `icons`-slot + CSS-stretch approach (documented in decisions) over `toast.custom` to preserve sonner's native a11y live-region and hover-pause. The danger-never-auto-dismiss requirement is enforced in `retroToast.error` rather than the Toaster, because sonner has no per-type duration on the Toaster — this is the only mechanism that satisfies the test (`retroToast.error(...)` must persist).

## Threat Flags

None. T-04-05-XSS mitigated (sonner renders text via React auto-escaping; no `dangerouslySetInnerHTML`). T-04-05-MISS mitigated (`.error` → `duration:Infinity`, test-enforced). T-04-05-SC: sonner pinned + gated in 04-01; no new dependency introduced here. No new network endpoints, auth paths, or trust-boundary surface.

## Known Stubs

None. No hardcoded empty data, placeholders, or unwired data sources — toast content is supplied by callers at call-time (Phase 6+).

## Self-Check: PASSED

- FOUND: frontend2/src/components/retro/feedback/RetroToast.tsx
- FOUND: frontend2/src/components/retro/feedback/retroToast.ts
- FOUND: frontend2/src/components/retro/feedback/RetroToast.test.tsx
- FOUND commit 90edb7c (RED), 4749848 (GREEN)
- No STATE.md / ROADMAP.md changes (orchestrator owns those)
