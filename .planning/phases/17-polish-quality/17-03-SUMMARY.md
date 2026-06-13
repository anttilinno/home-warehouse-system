---
phase: 17-polish-quality
plan: 03
subsystem: frontend2-e2e
tags: [responsive, playwright, e2e, POL-05, breakpoints]
requires:
  - "AppShell responsive contract (Sidebar .app-sidebar hidden md:block / Fab md:hidden)"
  - "CLAUDE.md auth contract (/login → Email/Password → /^log in$/i → /)"
provides:
  - "frontend2/e2e/responsive.spec.ts — 5-breakpoint structural matrix + dashboard screenshots"
affects:
  - "POL-05 mobile breakpoint verification gate"
tech-stack:
  added: []
  patterns:
    - "single login per test, then loop viewports (20/min auth limiter)"
    - "page.evaluate scrollWidth<=clientWidth+TOL overflow assertion"
    - "viewport-driven Sidebar/Fab visibility swap at Tailwind md (768px)"
key-files:
  created:
    - frontend2/e2e/responsive.spec.ts
  modified: []
decisions:
  - "Fab locator uses getByRole('button',{name:'Quick actions'}) to disambiguate from the role=menu ul that shares the aria-label and only renders when open."
  - "Sidebar locator scoped to .app-sidebar nav[aria-label='Primary'] to assert the desktop nav surface specifically."
  - "768 treated as DESKTOP (Tailwind md = min-width:768px is active AT 768) per 17-CONTEXT interfaces block."
  - "Bottombar NOT asserted at <768 — it is hidden md:flex (desktop-only); the Fab is the mobile counterpart."
metrics:
  duration: "~6 min"
  completed: "2026-06-14"
---

# Phase 17 Plan 03: POL-05 Mobile Breakpoint Matrix Summary

5-breakpoint Playwright responsive matrix asserting no horizontal overflow and
the AppShell Sidebar/Fab swap at 768px on `/` and `/items`, plus full-page
dashboard screenshots captured as POL-05 artifacts.

## What Was Built

`frontend2/e2e/responsive.spec.ts` — one chromium-gated spec (single login, then
loops `[320, 360, 768, 1024, 1440]` px):

- Per viewport × per route (`/`, `/items`):
  1. **No horizontal overflow** — `document.documentElement.scrollWidth <=
     clientWidth + 2px` tolerance, asserted true.
  2. **Nav-surface contract** — `<768` asserts the mobile Fab
     (`getByRole('button',{name:'Quick actions'})`) visible AND the Sidebar
     (`.app-sidebar nav[aria-label='Primary']`) hidden; `>=768` asserts the
     Sidebar visible and the Fab hidden.
- Per viewport: a full-page dashboard screenshot to
  `test-results/dashboard-<width>.png` (artifact for the OQ-5 human visual-diff
  residue — captured, NOT pixel-asserted).
- Top-of-file comment documents that the pixel diff vs `006-retro-os-dashboard`
  is a human-eye residue logged to FINAL-REVIEW-CHECKLIST; this spec asserts only
  the structural contract.

## Verification

- `bun install --frozen-lockfile` — clean (392 packages, no lockfile drift).
- `bun run lint:tsc` (`tsc -b --noEmit`) — **green**, spec compiles.
- Plan automated verify grep (`320` / `1440` / `setViewportSize` / `scrollWidth`)
  — **ok**.
- Filename forbidden-substring check (`sync`/`idb`/`offline`) — **clean**.
- The live spec was deliberately NOT run from the worktree: the dev stack serves
  the main checkout, not `.wt/17-03`. The orchestrator runs
  `bun run test:e2e e2e/responsive.spec.ts` post-merge (the hard human-check gate
  in the plan).

## Deviations from Plan

None — plan executed exactly as written. The only judgement call was the Fab
locator: the source has TWO `aria-label="Quick actions"` nodes (the toggle
`<button>` and a `role=menu <ul>` rendered only when open), so the locator pins
the `button` role to stay unambiguous and stable at rest.

## Self-Check: PASSED

- FOUND: frontend2/e2e/responsive.spec.ts
- Commit hash recorded below.
