---
phase: 02-tokens-type-system
plan: 02
subsystem: ui
tags: [vitest, fonts, ibm-plex-mono, fontsource, requirements, glyph-coverage, i18n]

# Dependency graph
requires:
  - phase: 02-tokens-type-system (Plan 02-01)
    provides: tokens.css/globals.css retro-os palette, @fontsource self-hosting, radius-0 reset, tokens.test.ts AA guard
provides:
  - Repo-resident Vitest glyph-coverage guard asserting IBM Plex Mono ships cyrillic + latin-ext woff2 subsets (TOKEN-05 coverage half)
  - Assertion that globals.css wires the data face (@fontsource/ibm-plex-mono/400.css) with tabular-nums no-drift baseline
  - Negative guard that Silkscreen stays latin-only (display-only, no cyrillic)
  - REQUIREMENTS.md TOKEN-01..05 prose corrected to the retro-os direction (premium-terminal preserved as dated ORIGINAL annotations)
affects: [verification, sign-off, future-font-bumps, phase-04-atoms]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-Node Vitest font-package supply-chain guard (readdirSync over node_modules/@fontsource/.../files, regex over subset filenames)"
    - "Dated ORIGINAL/REVISED annotation pair for auditable planning-doc spec swaps (mirrors v2.2-REQUIREMENTS.md:94)"

key-files:
  created:
    - frontend2/src/styles/glyph-coverage.test.ts
  modified:
    - .planning/REQUIREMENTS.md

key-decisions:
  - "Glyph coverage automated via filename-presence regex (offline, deterministic); perceived column drift left as the documented manual VALIDATION row — no brittle pixel/screenshot test (02-RESEARCH.md Open Question 1)"
  - "TOKEN prose rewritten with dated ORIGINAL (premium-terminal — SCRAPPED) / REVISED (retro-os) annotation pairs so the spec swap is traceable, not silently overwritten"
  - "Traceability table (REQUIREMENTS.md ~line 320-324) left Pending — flipping statuses is a verification-pass action, not a planning-doc edit"

patterns-established:
  - "Font subset presence as a CI guard: a dependency bump that drops cyrillic/latin-ext now fails a fast unit test"
  - "Anchored regex /^ibm-plex-mono-cyrillic-\\d+-normal\\.woff2$/ avoids false-positive matches on cyrillic-ext"

requirements-completed: [TOKEN-05, TOKEN-01, TOKEN-02, TOKEN-03, TOKEN-04]

# Metrics
duration: ~6min
completed: 2026-06-12
---

# Phase 2 Plan 02: Glyph-Coverage Guard + TOKEN Prose Correction Summary

**Added a pure-Node Vitest guard asserting IBM Plex Mono ships the cyrillic + latin-ext woff2 subsets (with the tabular-nums no-drift baseline), and rewrote REQUIREMENTS.md TOKEN-01..05 from the scrapped premium-terminal aesthetic to the as-built retro-os direction with dated audit annotations.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-06-12T19:21:00Z (approx)
- **Completed:** 2026-06-12T19:27:05Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 edited)

## Accomplishments
- `frontend2/src/styles/glyph-coverage.test.ts` — 5 assertions, all green: Plex Mono cyrillic subset present, Plex Mono latin-ext subset present, Silkscreen has no cyrillic subset (latin-only display face), globals.css imports `@fontsource/ibm-plex-mono/400.css`, globals.css declares `font-variant-numeric: tabular-nums`.
- TOKEN-05's automatable coverage half now has a repo-resident guard that fails on any future dependency bump dropping the subsets.
- REQUIREMENTS.md TOKEN-01..05 prose now measures the correct (retro-os) spec — Pitfall 3 closed (a verifier reading the old prose would have validated the correct retro-os implementation against the wrong premium-terminal criteria and failed it).
- Full Vitest suite still green: 34/34 across 3 files (16/16 contrast + sanity in tokens.test.ts, the new 5, plus existing others) — no regression to the AA contrast guard.

## Task Commits

Each task was committed atomically:

1. **Task 1: Glyph-coverage guard (TOKEN-05)** - `b3f8673` (test)
2. **Task 2: Rewrite TOKEN-01..05 prose to retro-os** - `98d68ca` (docs)

_Task 1 was TDD-flagged; per the plan the test asserts already-correct installed state (subsets + wired import already exist), so it is a single green commit rather than a RED→GREEN pair — the plan explicitly notes RED would only appear if a future change removed coverage._

## Files Created/Modified
- `frontend2/src/styles/glyph-coverage.test.ts` - Pure-Node Vitest guard over @fontsource/ibm-plex-mono `files/` subset filenames + globals.css wiring (cyrillic, latin-ext, tabular-nums).
- `.planning/REQUIREMENTS.md` - TOKEN-01..05 prose rewritten to retro-os with dated ORIGINAL/REVISED annotation pairs; traceability table untouched (Pending).

## Decisions Made
- Coverage check uses deterministic filename-presence regexes (offline) rather than a runtime/visual test; perceived drift stays the documented manual VALIDATION row.
- Anchored the cyrillic regex to `-cyrillic-\d+-normal\.woff2$` so `cyrillic-ext` files do not satisfy it by accident, and so italic/woff (non-woff2) variants are excluded.
- Used the existing repo ORIGINAL/REVISED annotation convention (v2.2-REQUIREMENTS.md:94) to preserve premium-terminal history.

## Deviations from Plan

None - plan executed exactly as written. (The TDD task produced a single green commit by design, as the plan anticipated — not a deviation.)

## Issues Encountered
- The worktree shipped without `node_modules/`, so Task 1's test could not run against real font files. Resolved by running the sanctioned `cd frontend2 && bun install --frozen-lockfile` (restores the pinned lockfile set; no new packages, bun.lock unchanged). node_modules is gitignored and was not committed.
- REQUIREMENTS.md was amended 2026-06-12 (commit 341e3d4): the traceability table shifted from the plan-quoted lines 215-219 to ~320-324. Confirmed via grep before editing; the TOKEN-01..05 prose lines were still at 27-31 as the plan stated. Only those prose lines were rewritten; no other requirement touched.

## Self-Check: PASSED

- `frontend2/src/styles/glyph-coverage.test.ts` — FOUND
- Commit `b3f8673` — FOUND
- Commit `98d68ca` — FOUND
- `frontend2 bun run test` full suite — 34/34 green
- REQUIREMENTS.md TOKEN-03 active prose names IBM Plex Mono; TOKEN-01 names retro-os; TOKEN-04 says AA/4.5; JetBrains Mono confined to ORIGINAL/SCRAPPED annotations; traceability rows still Pending — VERIFIED

## Next Phase Readiness
- TOKEN-05 coverage half has an automated guard; perceived drift documented as manual. TOKEN-01..05 prose now correct for verification sign-off.
- STATE.md / ROADMAP.md intentionally NOT updated (orchestrator owns those writes after the wave merges). Traceability statuses remain Pending for the verification pass to flip.

---
*Phase: 02-tokens-type-system*
*Completed: 2026-06-12*
