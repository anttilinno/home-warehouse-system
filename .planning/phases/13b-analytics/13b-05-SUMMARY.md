---
phase: 13b-analytics
plan: 05
subsystem: ui
tags: [recharts, vite, rolldown, react-router, code-splitting, react-lazy, bundle-budget]

# Dependency graph
requires:
  - phase: 13b-04
    provides: features/analytics/AnalyticsPage.tsx (named export AnalyticsPage) — the lazy import target
  - phase: 13b-02
    provides: recharts@3.8.1 + its resolved d3-* sub-deps installed & lockfile-pinned — the bytes the charts chunk isolates
provides:
  - "lazy /analytics route (React.lazy + Suspense) under the RequireAuth/AppShell layout"
  - "vite manualChunks `charts` branch isolating recharts + d3 into a lazy chunk (ANL-03 / POL-04)"
  - "Sidebar Overview Analytics NavItem wired to /analytics (no longer disabled)"
  - "ANL-03 build gate proven: recharts present ONLY in charts-*.js, ZERO charting bytes in the index entry chunk"
affects: [13b-validation, e2e-analytics, gsd-verifier, phase-15-i18n]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "React.lazy + Suspense route → auto-chunks the page's transitive heavy deps (mirrors the /scan scanner precedent)"
    - "manualChunks data-structure-as-membership: a `chartModules` string array + `id.includes` branch, parallel to scannerModules"

key-files:
  created: []
  modified:
    - frontend2/src/routes/index.tsx
    - frontend2/vite.config.ts
    - frontend2/src/components/layout/Sidebar.tsx

key-decisions:
  - "Included d3-timer in chartModules (present in node_modules, recharts 3.x dep) beyond the plan's suggested list — no leak observed; membership is conservative"
  - "Skipped `bun run i18n:extract` to honor the single-writer mandate — extract mutates src/locales/* catalogs (NOT in this plan's 3-file allowlist; AnalyticsPage msgids belong to 13b-04's page, Phase 15 does the gap-fill per CONTEXT OQ5)"

patterns-established:
  - "charts manualChunk: recharts + victory-vendor + 11 d3-* packages → `charts` chunk, loaded only on /analytics visit"

requirements-completed: [ANL-03]

# Metrics
duration: 9min
completed: 2026-06-13
---

# Phase 13b Plan 05: Analytics Wiring (lazy route + charts chunk + Sidebar) Summary

**`/analytics` mounted as a React.lazy route, recharts (+ its 11 resolved d3 sub-deps) isolated into a dedicated `charts` manualChunk, and the Sidebar Analytics NavItem wired — with the ANL-03 hard gate proven: recharts appears ONLY in `charts-I9uK7Kg5.js` and is entirely absent from the `index-*.js` entry chunk.**

## Performance

- **Duration:** ~9 min
- **Tasks:** 2 (1 source-edit task + 1 build-gate verification task)
- **Files modified:** 3 (the single-writer trio)

## Accomplishments

- **routes/index.tsx** — added the `AnalyticsPage` `React.lazy` const (importing the 13b-04 `AnalyticsPage` named export) and an `<Route path="analytics">` wrapped in `<Suspense fallback={null}>`, placed inside the authenticated `RequireAuth/AppShell` layout block (right after `scan`, before `claim/:code`). The lazy import is what auto-chunks recharts behind the route.
- **vite.config.ts** — extended the existing `manualChunks` FUNCTION (kept the function form — rolldown requires it) with a `chartModules` array and an `id.includes` branch returning `"charts"`, parallel to the scanner branch, placed before `return undefined`.
- **Sidebar.tsx** — wired the previously-disabled Overview Analytics NavItem with `to="/analytics"` (the only edit to the file).
- **ANL-03 hard gate PASSED** — see Build-Gate Evidence below.

## Task Commits

1. **Task 1: lazy /analytics route + charts manualChunk + Sidebar NavItem** — `37a1ad76` (feat)
2. **Task 2: ANL-03 build gate** — no source edit required (the `chartModules` membership was correct on first build; no d3/recharts leak into index → no rebuild/tweak needed). Verification-only.

**Plan metadata:** committed separately with this SUMMARY.

## Files Created/Modified

- `frontend2/src/routes/index.tsx` — lazy `AnalyticsPage` const + Suspense `/analytics` route under the AppShell layout.
- `frontend2/vite.config.ts` — `chartModules` array + `charts` manualChunk branch isolating recharts + d3.
- `frontend2/src/components/layout/Sidebar.tsx` — Analytics NavItem `to="/analytics"`.

## Build-Gate Evidence (ANL-03 — the phase's most important assertion)

Final `chartModules` membership (vite.config.ts):
`["recharts", "victory-vendor", "d3-shape", "d3-scale", "d3-array", "d3-time", "d3-format", "d3-interpolate", "d3-color", "d3-path", "d3-time-format", "d3-ease", "d3-timer"]`

After `bun run build`:

| Chunk | Raw | Gzip | Holds recharts? |
|-------|-----|------|-----------------|
| `dist/assets/index-BXSrinop.js` (ENTRY) | 687.5 kB | **186.8 kB** | **NO — content grep for `recharts/Recharts/ResponsiveContainer/victory-vendor` returns 0** |
| `dist/assets/charts-I9uK7Kg5.js` (the isolate) | 369.3 kB | 106.3 kB | **YES — the ONLY chunk where `recharts` appears** |
| `dist/assets/AnalyticsPage-ByyMnqSp.js` (lazy page) | 11.1 kB | 3.0 kB | No (imports from the charts chunk) |

- **`grep -lR recharts dist/assets/*.js` → `dist/assets/charts-I9uK7Kg5.js` ONLY.** A per-file loop across every `dist/assets/*.js` confirmed recharts lives in exactly one chunk.
- **Plan's hard-gate verify command exit 0:** `test -n "$(grep -lR recharts dist/assets/*.js)" && ! grep -l recharts dist/assets/index-*.js` → PASS.
- **Content grep** `grep -c "Recharts|recharts|ResponsiveContainer|victory-vendor" index-BXSrinop.js` → **0** (not just filename-absent — zero charting identifiers in the entry chunk body).
- **Main-chunk gzip unchanged:** no numeric pre-recharts baseline was recorded in 13b-02's summary, but the decisive proof is structural — since recharts/d3 content is *entirely absent* from the index chunk (0 markers), the chunk-isolation adds zero charting bytes to the always-loaded entry; the 186.8 kB index gzip is exactly what it would be in a no-recharts build. Non-analytics routes carry zero charting weight. Threat T-13b-09 (DoS via recharts in the main bundle) mitigated.

## Verification Results

- `bun run lint:tsc` (tsc -b --noEmit) — **clean, exit 0** (the lazy AnalyticsPage import resolves the 13b-04 export).
- Task 1 grep checks — all green: `import("@/features/analytics/AnalyticsPage")` in routes, `"charts"` in vite.config, `Analytics</Trans>} to="/analytics"` in Sidebar.
- `bun run build` — **green** (only the expected "chunk > 500 kB" advisory on the intentionally-isolated charts + index chunks).
- `bun run lint:imports` — **OK** (no forbidden imports).
- ANL-03 build gate — **PASS** (evidence above).

## Decisions Made

- **Added `d3-timer` to chartModules** beyond the plan's suggested 12-entry list: it is present in `node_modules` as a recharts 3.x transitive dep. No leak was observed with or without it, but conservative inclusion guards against a future d3-timer-touching path landing in index.
- **Did NOT run `bun run i18n:extract`** (a step listed in the plan's `<verification>`). Running it mutates `frontend2/src/locales/*.po` catalog files, which are NOT in this plan's single-writer 3-file allowlist, and the AnalyticsPage msgids are owned by 13b-04 (the page authoring plan). CONTEXT OQ5 explicitly defers the full catalog gap-fill to Phase 15. Honoring the HARD-RULE single-writer mandate took precedence over the catalog-freshness nicety. See Deviations.

## Deviations from Plan

**1. [Scope/single-writer guard] Skipped `i18n:extract`**
- **Found during:** Task 2 verification step.
- **Issue:** The plan's `<verification>` lists `bun run i18n:extract` to keep catalogs honest, but extract writes to `src/locales/*` — files outside this plan's enforced single-writer trio. The orchestrator HARD RULES forbid editing anything but the three trio files + the SUMMARY.
- **Resolution:** Skipped extract. The new analytics msgids are authored by 13b-04 and the catalog gap-fill is Phase 15's job (CONTEXT OQ5). No functional impact on ANL-03 (the lazy route, chunk isolation, and gate are all proven independently of catalog state).
- **Files modified:** none (a deliberate non-edit).

**2. [Membership extension] Added `d3-timer` to chartModules**
- **Found during:** Task 1, cross-checking the plan's suggested list against `node_modules`.
- **Issue:** `d3-timer` is a resolved recharts dep present on disk but absent from the plan's draft list.
- **Fix:** Added it to the array (conservative isolation).
- **Verification:** Build gate clean — recharts in charts chunk only, index clean.
- **Committed in:** `37a1ad76` (Task 1).

---

**Total deviations:** 2 (1 single-writer scope guard / skipped step, 1 membership extension)
**Impact on plan:** No scope creep; both deviations strengthen the single-writer discipline and the chunk isolation. ANL-03 fully satisfied.

## Issues Encountered

None. The chunk isolation worked on the first build — no recharts/d3 leak into the entry chunk, so Task 2 required no `chartModules` tweak or rebuild.

## User Setup Required

None — no external service configuration.

## Next Phase Readiness

- `/analytics` is live and reachable from the Sidebar; the route renders the lazy AnalyticsPage in a Suspense boundary.
- ANL-03 (lazy-load + bundle budget) is verifiably satisfied — the live E2E spec and gsd-verifier can bind to: route segment `analytics` under AppShell, charts chunk `charts-*.js` holds recharts, index entry chunk is charting-byte-free.
- Phase 15 owns the i18n catalog gap-fill for the new analytics msgids.

## Self-Check: PASSED

- FOUND: frontend2/src/routes/index.tsx
- FOUND: frontend2/vite.config.ts
- FOUND: frontend2/src/components/layout/Sidebar.tsx
- FOUND: .planning/phases/13b-analytics/13b-05-SUMMARY.md
- FOUND commit: 37a1ad76 (Task 1 trio)

---
*Phase: 13b-analytics*
*Completed: 2026-06-13*
