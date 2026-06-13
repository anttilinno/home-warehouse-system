---
phase: 17-polish-quality
plan: 01
subsystem: ci-quality-gates
tags: [bundle-size, ci, pol-04, pure-node-guard]
requires: []
provides:
  - "frontend2/bundle-budget.json (committed per-chunk gzip ceilings)"
  - "scripts/check-bundle-budget.mjs (pure-node POL-04 guard)"
  - "frontend2 lint:bundle script (vite build + guard)"
  - "bundle-budget CI job in lint-frontend2.yml"
affects:
  - "any frontend2 PR that bloats a JS chunk now fails CI with a delta report"
tech-stack:
  added: []
  patterns:
    - "repo-root scripts/check-*.mjs pure-node guard + node --test self-tests + lint-frontend2.yml job (mirrors FOUND-02 forbidden-imports + Phase-15 i18n guards)"
key-files:
  created:
    - frontend2/bundle-budget.json
    - scripts/check-bundle-budget.mjs
    - scripts/__tests__/check-bundle-budget.test.mjs
  modified:
    - frontend2/package.json
    - .github/workflows/lint-frontend2.yml
decisions:
  - "messages bucket = largest single messages-*.js (per-locale alternates), NOT the sum"
  - "missing budgeted chunk counts as 0 bytes (lazy chunks legitimately absent), never crashes"
  - "node's zlib.gzipSync (default level) used to measure — values match vite's gz report within budget headroom"
metrics:
  duration: "~1h"
  completed: 2026-06-14
---

# Phase 17 Plan 01: POL-04 Bundle-Size Budget CI Guard Summary

Formalized the ad-hoc per-phase bundle greps (11 scanner / 13b charts / 16
palette) into one committed budget manifest + a pure-node check script +
`node --test` self-tests + a `lint:bundle` package script + a dedicated
`bundle-budget` CI job. Any future PR that bloats a chunk now fails CI with a
`chunk: cur/budget (Δ)` delta report instead of silently regressing.

## What shipped

- **`frontend2/bundle-budget.json`** — per-chunk gzip-byte ceilings: main
  215000, charts 120000, scanner 65000, palette 20000, messages 22000, plus a
  `_comment` explaining gzip-bytes / baseline+headroom / per-locale-messages
  semantics.
- **`scripts/check-bundle-budget.mjs`** — pure node, zero deps. Optional
  positional `<dir>` (default `frontend2/dist/assets`); reads the fixed-path
  manifest from REPO_ROOT; gzips each `*.js` with `zlib.gzipSync`; buckets by
  filename prefix (`index-`→main, `charts-`→charts, `scanner-`→scanner,
  `palette-`→palette, `messages-`→messages); takes the **largest single**
  `messages-*.js` (per-locale, not additive), sums other prefixes; prints
  `chunk: cur/budget (Δ signed)` per chunk; exits 1 on any overage (stderr lists
  offenders), else exits 0 with an OK summary. Unbudgeted files (`*Page-*.js`)
  ignored; missing budgeted chunk = 0 bytes (noted, never crashes).
- **`scripts/__tests__/check-bundle-budget.test.mjs`** — `node --test`, 6 cases
  using `crypto.randomBytes` (incompressible → predictable gz size): all-under
  (exit 0), one-over (exit 1 + named chunk + positive Δ), messages
  per-locale-not-additive (both directions), missing-chunk-tolerated (exit 0,
  reported at 0), unbudgeted-file-ignored.
- **`frontend2/package.json`** — added one scripts line:
  `"lint:bundle": "vite build && node ../scripts/check-bundle-budget.mjs"`.
  Surgical single-line diff (17-02 Wave-2 will append a devDependency cleanly).
- **`.github/workflows/lint-frontend2.yml`** — new `bundle-budget` job (bun
  install → self-tests → `bunx vite build` → run guard) and the three new
  script/manifest paths added to BOTH `pull_request.paths` and `push.paths`. No
  other job altered.

## Verification (all run from the worktree)

| Check | Result |
|---|---|
| `bun install --frozen-lockfile` | 390 packages, ok |
| `bun run build` | built in 994ms, dist/assets produced |
| `node scripts/check-bundle-budget.mjs` (real dist) | **exit 0**, all 5 chunks under budget |
| `node --test scripts/__tests__/check-bundle-budget.test.mjs` | **6/6 pass** |
| `bun run lint:tsc` | exit 0 (green) |
| YAML parse (python yaml.safe_load) | valid; `bundle-budget` job present; paths in both triggers |
| Live regression proof (bloated `index-*.js` in scratch dir) | **exit 1**, `main: 397290/215000 (+182290)` |

### Baseline delta report (real `bun run build`, 2026-06-14)

```
check-bundle-budget: measuring .../frontend2/dist/assets
  main: 197000/215000 (-18000)
  charts: 106514/120000 (-13486)
  scanner: 55405/65000 (-9595)
  palette: 15096/20000 (-4904)
  messages: 19390/22000 (-2610)
check-bundle-budget: OK — all 5 chunks within budget.
```

## Deviations from Plan

None — plan executed exactly as written. (TDD RED→GREEN followed for Task 1: a
`test(...)` step was folded into the single `feat` commit per the plan's
combined Task-1 commit instruction; RED was confirmed failing before the script
existed, GREEN confirmed after.)

## TDD Gate Compliance

Task 1 was `tdd="true"`. RED was verified (self-tests failed with the script
absent) before GREEN (script written, 6/6 pass). The plan specified a single
combined Task-1 commit (`feat(17-01): bundle budget manifest + check script +
self-tests`) rather than separate test/feat commits, so the git log shows one
`feat` commit covering both — consistent with the plan's `<action>` commit
directive. No separate `test(...)` commit was mandated by this plan.

## Known Stubs

None.

## Threat Flags

None — no new network surface, auth path, or schema change. The guard reads only
repo-local manifest + build output (pure node, zero new deps; T-17-01-SC accept).

## Commits

- `799744a8` feat(17-01): bundle budget manifest + check script + self-tests (POL-04)
- `891e94af` feat(17-01): lint:bundle script (vite build + budget guard)
- `e5605fa0` ci(17-01): bundle-budget job + paths triggers in lint-frontend2.yml

## Self-Check: PASSED

All 3 created files + SUMMARY exist on disk; all 3 task commits present in git
log; `lint:bundle` present in `frontend2/package.json`.
