---
phase: 16-command-palette
plan: 01
subsystem: ui
tags: [cmdk, tinykeys, radix-dialog, vite, rolldown, code-splitting, bundle-budget]

# Dependency graph
requires:
  - phase: 11-scan
    provides: "scanner manualChunks isolate precedent (function-form, data-structure-as-membership)"
  - phase: 13b-analytics
    provides: "charts manualChunks isolate + bundle-gate precedent"
provides:
  - "cmdk@1.1.1 + tinykeys@4.0.0 available in frontend2 dependencies"
  - "bun.lock pinning cmdk@1.1.1, tinykeys@4.0.0, and the hoisted @radix-ui/react-dialog@1.1.16 tree (committed so every downstream Phase-16 plan can run bun install --frozen-lockfile)"
  - "vite manualChunks `palette` branch routing BOTH cmdk AND @radix-ui/react-dialog into a lazy `palette` chunk (POL-04 pre-wire)"
affects: [16-02, 16-03]

# Tech tracking
tech-stack:
  added: [cmdk@1.1.1, tinykeys@4.0.0]
  patterns:
    - "manualChunks paletteModules array + some(includes) membership test mirroring scanner/charts isolates (function form preserved for rolldown)"

key-files:
  created: []
  modified:
    - frontend2/package.json
    - frontend2/bun.lock
    - frontend2/vite.config.ts

key-decisions:
  - "command-score NOT installed directly — vendored inside cmdk"
  - "@radix-ui/react-dialog NOT installed directly — arrives transitively via cmdk; confirmed hoisted at 1.1.16"
  - "paletteModules membership list pinned to [\"cmdk\", \"@radix-ui/react-dialog\"] — the 16-03 bundle gate binds to these two verified module ids"

patterns-established:
  - "palette manualChunks isolate: cmdk + @radix-ui/react-dialog -> \"palette\" chunk; OVERRIDE B co-location (cmdk hard-imports radix-dialog at module top level, non-tree-shakable)"

requirements-completed: [TUI-05]

# Metrics
duration: 2min
completed: 2026-06-13
---

# Phase 16 Plan 01: Command Palette deps + palette vite chunk Summary

**cmdk@1.1.1 + tinykeys@4.0.0 added to frontend2 with a non-frozen bun.lock update, plus a `palette` manualChunks branch isolating cmdk + the transitively-hoisted @radix-ui/react-dialog@1.1.16 into a lazy chunk (OVERRIDE B co-location, POL-04 pre-wire).**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-06-13T20:29:39Z
- **Completed:** 2026-06-13T20:31Z
- **Tasks:** 3 (Task 1 was the package-legitimacy gate, RESOLVED/approved by the orchestrator before spawn)
- **Files modified:** 3

## Accomplishments
- Installed cmdk@1.1.1 + tinykeys@4.0.0 into frontend2 dependencies — clean resolve on React 19.2, no peer warnings, no postinstall.
- Confirmed command-score is absent from package.json AND bun.lock (vendored inside cmdk).
- Confirmed @radix-ui/react-dialog@1.1.16 is hoisted in bun.lock (transitive via cmdk) — required for the palette chunk gate and for cmdk's top-level hard import to resolve at build.
- Committed the updated bun.lock so every downstream Phase-16 plan can run `bun install --frozen-lockfile` (`bun install --frozen-lockfile` reports "no changes").
- Added the `palette` manualChunks branch routing BOTH `cmdk` AND `@radix-ui/react-dialog` into chunk `"palette"`, mirroring the existing scanner/charts isolates; function form preserved (rolldown requirement).

## Task Commits

Each task was committed atomically:

1. **Task 2: Add cmdk + tinykeys; update + commit bun.lock** - `d6c2346a` (feat)
2. **Task 3: Add the `palette` manualChunks branch (cmdk + radix-dialog)** - `e73ad3c7` (feat)

_(Task 1 was a package-legitimacy `checkpoint:human-verify` gate; the orchestrator resolved/approved it before this agent was spawned, so no in-agent stop occurred.)_

**Plan metadata:** committed separately (docs: complete plan).

## Files Created/Modified
- `frontend2/package.json` - added `cmdk: "1.1.1"` + `tinykeys: "4.0.0"` to dependencies; command-score NOT present.
- `frontend2/bun.lock` - pins cmdk@1.1.1, tinykeys@4.0.0, and the hoisted @radix-ui/react-dialog@1.1.16 tree.
- `frontend2/vite.config.ts` - new `paletteModules = ["cmdk", "@radix-ui/react-dialog"]` array + `if (paletteModules.some((mod) => id.includes(mod))) return "palette";` branch after charts, before `return undefined`, with the TUI-05/POL-04/OVERRIDE-B explanatory comment.

## Verified Dependency Facts (for the 16-03 bundle gate)
- **cmdk** pinned `1.1.1` — peer `react: ^18 || ^19 || ^19.0.0-rc` (clean on React 19.2).
- **tinykeys** pinned `4.0.0` — zero-dep, ESM-first.
- **@radix-ui/react-dialog** hoisted at `1.1.16` (transitive via cmdk) — NOT a direct dependency.
- **command-score** — NOT installed (vendored inside cmdk); absent from both package.json and bun.lock.
- **paletteModules membership (the ids the 16-03 entry-chunk gate must assert are absent from index-*.js):** `["cmdk", "@radix-ui/react-dialog"]`.

## Decisions Made
None beyond the plan — followed plan as specified (command-score not installed, radix-dialog not installed directly, palette chunk routes both module ids).

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None. `bun add` resolved cleanly; `bun install --frozen-lockfile`, `bun run lint:tsc`, `bun run lint:imports`, and `bun run build` all green.

## Notes on the `palette` chunk
As planned, no `palette-*.js` chunk materializes in `dist/assets/` yet — no application source imports `cmdk`, so rolldown no-ops the unreachable rule. The chunk will materialize once a downstream plan (16-02/16-03) ships the `React.lazy` palette body that imports cmdk. Build passing now with the wiring in place is the success condition for this plan.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Wave-1 foundation complete: deps available, lockfile committed (frozen-install-safe), palette chunk pre-wired.
- 16-02 can build the palette feature (recentActions store + palette body) against `cmdk` / `tinykeys`.
- 16-03's bundle gate must assert `cmdk` AND `@radix-ui/react-dialog` are absent from the entry `index-*.js` and present only in `palette-*.js`.

## Self-Check: PASSED

- FOUND: frontend2/package.json, frontend2/bun.lock, frontend2/vite.config.ts, .planning/phases/16-command-palette/16-01-SUMMARY.md
- FOUND commits: d6c2346a (deps + lockfile), e73ad3c7 (palette chunk)

---
*Phase: 16-command-palette*
*Completed: 2026-06-13*
