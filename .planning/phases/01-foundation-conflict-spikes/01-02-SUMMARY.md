---
phase: 01-foundation-conflict-spikes
plan: 02
subsystem: ci
tags: [ci, github-actions, lint, forbidden-imports, typecheck, online-only-guard, bun, foundation]

# Dependency graph
requires:
  - phase: 01-foundation-conflict-spikes
    plan: 01
    provides: frontend2/src/** scaffold (so check-forbidden-imports.mjs scan root exists), frontend2/package.json scripts (lint:imports, lint:tsc), bun.lock for --frozen-lockfile
  - phase: v2.1-archive
    provides: scripts/check-forbidden-imports.mjs grep guard (c570d9f); scripts/__tests__/check-forbidden-imports.test.mjs self-tests
provides:
  - GitHub Actions PR merge gate at .github/workflows/lint-frontend2.yml (forbidden-imports + typecheck-frontend2 jobs)
  - Local end-to-end Phase 1 smoke at scripts/verify-phase-01-scaffold.sh (FOUND-01 + FOUND-02 in one bash script)
  - First .github/ directory in the repo root (created from scratch — verified absent at plan start)
affects: [phase-02-tokens, phase-03-layout-bottombar, all v3.0 frontend2 phases (every PR touching frontend2/** now blocked on the merge gate)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "GitHub Actions paths-filter scoping — frontend2/** + the grep guard script + the self-test file + the workflow itself trigger the workflow; backend Go changes do NOT trigger lint-frontend2"
    - "oven-sh/setup-bun@v2 with explicit bun-version pin (matches Standard Stack)"
    - "Two-job split: forbidden-imports runs without bun install (fast — node-only); typecheck-frontend2 runs bun install --frozen-lockfile"
    - "Self-tests run alongside the gate (paths trigger includes the script + test file so script edits re-run the assertions)"
    - "Local smoke parity — scripts/verify-phase-01-scaffold.sh replicates the CI gate and adds the Pitfall 4 devtools tree-shake assertion + CSR-aware dev-server check"

key-files:
  created:
    - .github/workflows/lint-frontend2.yml
    - scripts/verify-phase-01-scaffold.sh
  modified: []
  removed: []

key-decisions:
  - "CSR-aware dev-server smoke: replaced the plan-mandated curl|grep against React-rendered text (unsatisfiable for SPA) with an index.html shell assertion + a bundle-content assertion against dist/assets/. This mirrors the documented Deviation #6 from 01-01-SUMMARY.md and keeps the smoke meaningful without wiring a headless browser at Phase 1."
  - "bun-version: 1.3.13 honored verbatim per plan, even though the local mise install reports 1.3.12. The CI runner pulls 1.3.13 fresh via setup-bun; local smoke uses whichever bun is on PATH (semver-compatible). If a future Bun release breaks lint:tsc on 1.3.13 specifically, the version is in one place to bump."
  - "Two-job split (not one combined job): the forbidden-imports gate runs in seconds (no install step) while typecheck pays the bun install cost. Splitting lets the cheap gate fail fast and keeps the typecheck reusable for future Phase 1 plans (i18n spike, etc.)."
  - "`paths:` filter includes scripts/check-forbidden-imports.mjs and its self-test file — script regressions re-run the entire gate, catching weakened-regex tampering (T-02-02 mitigation)."

patterns-established:
  - "All frontend2 PRs blocked on lint-frontend2 — adds the v3.0 online-only constraint (no idb/serwist/offline/sync) to the merge contract"
  - "Local smoke script is the 'golden path' — every Phase 1 plan that touches scaffold/CI must keep `bash scripts/verify-phase-01-scaffold.sh` exit-0"

requirements-completed: [FOUND-02]

# Metrics
duration: ~2min execution-only (~5min wall-clock incl. Plan-01 SUMMARY review for the curl|grep deviation context)
completed: 2026-05-01
---

# Phase 01 Plan 02: CI Forbidden-Imports + Typecheck Gate Summary

**Wired the existing `scripts/check-forbidden-imports.mjs` grep guard into a GitHub Actions PR merge gate (with companion typecheck job) and added a local end-to-end smoke script that exercises FOUND-01 + FOUND-02 against the Phase 1 scaffold in one command. Closes FOUND-02 — the v3.0 "no offline/sync" constraint is now enforceable at PR-time on every frontend2/** change.**

## Performance

- **Duration:** ~2 min execution-only; ~5 min wall-clock
- **Started:** 2026-05-01T18:59:41Z
- **Completed:** 2026-05-01 (same session)
- **Tasks:** 1 / 1 (`type="auto"`, no checkpoints)
- **Files created:** 2 (workflow + smoke script)
- **Files modified:** 0
- **Commit count:** 1 task commit

## Accomplishments

- **GitHub Actions merge gate active** — `.github/workflows/lint-frontend2.yml` declares two jobs:
  - `forbidden-imports`: checkout → setup-bun@v2 (1.3.13) → `node scripts/check-forbidden-imports.mjs` → `node --test scripts/__tests__/check-forbidden-imports.test.mjs`
  - `typecheck-frontend2`: checkout → setup-bun@v2 (1.3.13) → `bun install --frozen-lockfile` → `bun run lint:tsc`
  Both jobs are required to pass for any PR that modifies `frontend2/**`, the grep guard script, the self-test file, or the workflow itself.
- **`paths:` filter scoped correctly** — backend (`backend/**`) changes do NOT trigger this workflow; only frontend2 + the gate's own files do. Reduces noise + Actions minutes.
- **Self-tests run as part of the gate** — `node --test scripts/__tests__/check-forbidden-imports.test.mjs` exercises the fixture cases (idb, offline, sync) AND the live `frontend2/src` pass; any tampering that weakens the regex set fails the self-tests inside the same workflow run.
- **Local smoke script** — `scripts/verify-phase-01-scaffold.sh` (mode +x) replicates the CI gate plus extras: typecheck, build, Pitfall 4 devtools tree-shake assertion, dev-server HTTP 200 check, bundle-content placeholder assertion. Exits 0 against the Plan 01 scaffold. Useful for `pre-merge` developer hygiene without spinning up a PR.
- **`.github/` directory created** — verified absent at plan start (`.github/` did not exist anywhere under the repo root prior to this plan); now contains a single `workflows/lint-frontend2.yml` file.
- **YAML structurally valid** — `python3 -c "import yaml; yaml.safe_load(...)"` exits 0. Full Actions semantics validated when the workflow first runs in a real PR (recommended manual test below).

## Source Material

| Element | Source | Notes |
|---------|--------|-------|
| Workflow YAML | 01-RESEARCH.md `## Code Examples → GitHub Actions workflow` (verbatim) | No edits — copied as-is. |
| Smoke script structure | 01-PLAN.md Task 1 step 2 (verbatim) | One Rule 1 fix to the dev-server smoke (see Deviations). |
| Pitfall 4 dist-grep | 01-01-SUMMARY.md (Devotools tree-shake check) | Carried forward into smoke. |
| `paths:` filter list | 01-PATTERNS.md `.github/workflows/lint-frontend2.yml` entry | Includes script + self-test paths so T-02-02 (script tampering) re-runs the gate. |

## Files Created/Modified

**Created (2):**
- `.github/workflows/lint-frontend2.yml` — 39 lines. PR merge gate with forbidden-imports + typecheck-frontend2 jobs.
- `scripts/verify-phase-01-scaffold.sh` — 50 lines, mode +x. Local end-to-end smoke that exercises FOUND-01 + FOUND-02.

**Modified:** none.

**Removed:** none.

## Task Commits

| Task | Name | Commit | Type |
|------|------|--------|------|
| 1 | Create GitHub Actions workflow + verification smoke script | `3fe5ff3` | feat |

## Decisions Made

- **CSR-aware dev-server smoke** — the plan's prescribed `curl -sf http://localhost:5173/ | grep -q "frontend2 — v3.0 placeholder shell"` cannot pass for a CSR React SPA (Vite serves the unmodified `index.html` whose body is `<div id="root"></div>`; the placeholder text is rendered by React at runtime, not by the server). Plan 01-01's SUMMARY explicitly documented this same issue (Deviation #6) and deferred the full DOM-render assertion to Phase 5/6 Playwright. Replaced with `(a) curl returns HTTP 200 with the index.html shell + (b) the placeholder text appears in the built bundle under dist/assets/`. Both assertions are real signals; together they confirm the dev server boots and the React tree compiles the route.
- **bun-version: 1.3.13 honored verbatim** — local mise install is 1.3.12, but CI runner pulls fresh via `oven-sh/setup-bun@v2`. Pinning at the workflow level (rather than letting `setup-bun` pick latest) keeps CI deterministic and gives one place to bump if a future Bun release breaks lint:tsc.
- **Two-job split (not one combined job)** — `forbidden-imports` is node-only and runs in seconds; `typecheck-frontend2` pays the `bun install` cost. Splitting lets the cheap gate fail fast on a PR that introduces `import 'idb'` without waiting for npm-registry round-trips, and keeps the typecheck reusable for future Phase 1 plans (i18n spike will likely need it too).
- **No frontend2/* changes** — success criteria explicitly forbids it; this plan's surface is one workflow + one script. `git status` post-commit shows zero modifications under `frontend2/`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] CSR dev-server smoke check unsatisfiable**
- **Found during:** Task 1 step 4 (`bash scripts/verify-phase-01-scaffold.sh`)
- **Issue:** The plan's prescribed dev-server check `curl -sf http://localhost:5173/ | grep -q "frontend2 — v3.0 placeholder shell"` cannot pass for a CSR React SPA. Vite serves the unmodified `index.html` whose body is `<div id="root"></div>`; the placeholder text is rendered by React at runtime in the browser, not by the dev server. Direct test: `curl http://localhost:5173/` returns HTML containing `<div id="root"></div>` but NOT the placeholder text. This exact issue was documented in Plan 01-01-SUMMARY.md as Deviation #6 (CSR vs SSR verification mismatch).
- **Fix:** Replaced the unsatisfiable assertion with two assertions that both work:
  - `curl -sf http://localhost:5173/ | grep -q '<div id="root">'` — proves dev server boots and serves the index.html shell (HTTP 200 path)
  - `grep -rq "frontend2 — v3.0 placeholder shell" dist/assets/` — proves the React route compiled and the placeholder text reaches the client bundle
  Together these capture the same intent (dev server boots; placeholder text exists in the app) without requiring a headless browser. Full DOM-render assertion is deferred to Phase 5/6 Playwright per the existing carry-forward.
- **Files modified:** `scripts/verify-phase-01-scaffold.sh` (smoke script only — workflow file unchanged)
- **Verification:** `bash scripts/verify-phase-01-scaffold.sh` exits 0; both new assertions pass against the Plan 01 scaffold.
- **Committed in:** `3fe5ff3` (Task 1 commit)

---

**Total deviations:** 1 (Rule 1 bug fix to a research-time spec mismatch)
**Impact:** Smoke script now actually verifies what it claims to verify. Workflow file untouched (no CI surface changes). Plan's load-bearing tokens (`check-forbidden-imports`, `__react-query-devtools`) preserved in the smoke script, satisfying the plan's automated grep-based verify block verbatim.

## Issues Encountered

- **Plan 01-01's SUMMARY already flagged the CSR mismatch** — but Plan 01-02 was authored before that SUMMARY landed (or the planner copy-pasted the smoke from RESEARCH without re-checking). Carrying the documented deviation into this SUMMARY keeps the carry-forward audit trail clean.
- **`@vitejs/plugin-react-swc` deprecation warning** during build (`esbuild option ... use 'oxc' instead`) — benign Vite 8 warning, no impact on the build artifact. Already noted in 01-01-SUMMARY's Issues section.

## Auth Gates

None encountered. This plan creates CI infrastructure with no external service auth (Actions runner uses no secrets per workflow definition; `bun install` uses public registry only).

## Threat Model Coverage

All `mitigate` dispositions in the plan's threat register are addressed by the workflow as written:

| Threat ID | Mitigation in Code |
|-----------|--------------------|
| T-02-01 (Tampering — bypass online-only) | `forbidden-imports` job runs `node scripts/check-forbidden-imports.mjs` — exit 1 fails the merge gate |
| T-02-02 (Tampering — weaken script regex) | `paths:` filter includes `scripts/check-forbidden-imports.mjs` + `scripts/__tests__/check-forbidden-imports.test.mjs`; script edits re-run the self-tests inside the same workflow run |
| T-02-05 (Repudiation — failed CI invisible) | Standard GitHub PR check UI surfaces failed jobs; no extra mitigation needed |
| T-02-06 (Info Disclosure — secret leakage) | Workflow declares no `secrets:` block; `bun install --frozen-lockfile` uses public registry only |

`accept` dispositions (T-02-03 setup-bun pin to `@v2`, T-02-04 hung install timeout) honored as-is per solo-developer threat model.

No new threat surface introduced beyond the plan's register.

## User Setup Required

**Manual negative test (recommended, not blocking)** — to validate the merge gate end-to-end on real GitHub Actions:

1. Create a throwaway branch: `git checkout -b ci-gate-smoke`
2. Add a test file: `echo 'import "idb";' > frontend2/src/_smoketest.ts`
3. Commit + push as a draft PR.
4. Confirm the `forbidden-imports` job fails red on the PR view.
5. Delete the branch + close the PR.

This negative test exercises the actual GitHub Actions runner with `oven-sh/setup-bun@v2` + `bun-version: 1.3.13` and confirms the gate produces the expected red check on a regression. Not required for plan completion since it requires a real GitHub PR + push permissions.

## Next Phase Readiness

**Ready for Plan 03 (Phase 1 Wave 2 — i18n spike):**
- The `typecheck-frontend2` job will catch any TS regressions when Plan 03 adds Lingui or react-intl + their plugins to vite/vitest configs.
- The `forbidden-imports` job's regex set (`/(offline|sync)/i`) does NOT match `i18n`, `lingui`, `intl`, `locale` — Plan 03 has clear runway.

**Ready for Plan 04 (Phase 1 Wave 2 — CARRY-FORWARD doc):**
- This plan's source-SHA-free origin (workflow YAML is verbatim from 01-RESEARCH.md, not from a v2.1 file) means CARRY-FORWARD doesn't need a row for it. The grep guard script itself was already carried forward in Plan 01-01's SUMMARY (cite SHA c570d9f).

**Phase 2 (Tokens + Type System) blockers:** none — the gate doesn't restrict CSS / `@theme` / type system work.

## Self-Check: PASSED

```
$ test -f .github/workflows/lint-frontend2.yml && echo "FOUND: workflow"
FOUND: workflow

$ test -x scripts/verify-phase-01-scaffold.sh && echo "FOUND: smoke +x"
FOUND: smoke +x

$ python3 -c "import yaml; yaml.safe_load(open('.github/workflows/lint-frontend2.yml'))" && echo "YAML valid"
YAML valid

$ git log --oneline | grep -E '3fe5ff3'
3fe5ff3 feat(01-02): add lint-frontend2 CI workflow + Phase 1 smoke script
# Task commit: FOUND.

$ bash scripts/verify-phase-01-scaffold.sh 2>&1 | tail -2
=== ALL CHECKS PASSED ===
# Smoke: exit 0.
```

All acceptance criteria from the plan's automated verify block satisfied:
- `.github/workflows/lint-frontend2.yml` exists ✓
- contains `check-forbidden-imports.mjs` ✓
- contains `oven-sh/setup-bun@v2` ✓
- contains `bun-version: 1.3.13` ✓
- contains `cd frontend2 && bun run lint:tsc` ✓
- contains `paths:` ✓
- contains `frontend2/**` ✓
- valid YAML (`yaml.safe_load`) ✓
- `scripts/verify-phase-01-scaffold.sh` exists + executable ✓
- contains `check-forbidden-imports` ✓
- contains `__react-query-devtools` ✓
- `bash scripts/verify-phase-01-scaffold.sh` exits 0 ✓

---
*Phase: 01-foundation-conflict-spikes*
*Plan: 02*
*Completed: 2026-05-01*
