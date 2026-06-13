---
phase: 15-i18n-catalog
plan: 02
subsystem: ci-guards
tags: [i18n, ci, lint, tdd]
requires: []
provides:
  - "scripts/check-i18n-format.mjs (D-4 raw-locale-format grep guard)"
  - "scripts/check-i18n-catalog.mjs (D-5 po msgid-parity + empty-msgstr guard, --only flag)"
  - "frontend2 lint:i18n + lint:i18n:format scripts"
  - "lint-frontend2 CI jobs: i18n-format-guard + i18n-catalog-guard"
affects:
  - "Wave-2 translation plans (15-03 et / 15-04 ru) call check-i18n-catalog --only <locale>"
  - "orchestrator post-merge gate runs both guards real-tree-green"
tech-stack:
  added: []
  patterns:
    - "Repo-root scripts/*.mjs grep/manifest guards mirroring check-forbidden-imports.mjs"
    - "node:test self-tests with fixtures; temp-dir <locale>.po assembly for catalog guard"
key-files:
  created:
    - scripts/check-i18n-format.mjs
    - scripts/check-i18n-catalog.mjs
    - scripts/__tests__/check-i18n-format.test.mjs
    - scripts/__tests__/check-i18n-catalog.test.mjs
    - scripts/__tests__/fixtures-i18n-format/clean.tsx
    - scripts/__tests__/fixtures-i18n-format/offender-tolocale.tsx
    - scripts/__tests__/fixtures-i18n-format/ignored.tsx
    - scripts/__tests__/fixtures-i18n-format/clean-subset/ok.tsx
    - scripts/__tests__/fixtures-i18n-catalog/en.po
    - scripts/__tests__/fixtures-i18n-catalog/et-complete.po
    - scripts/__tests__/fixtures-i18n-catalog/et-empty.po
    - scripts/__tests__/fixtures-i18n-catalog/ru-complete.po
    - scripts/__tests__/fixtures-i18n-catalog/ru-missing-msgid.po
  modified:
    - frontend2/package.json
    - .github/workflows/lint-frontend2.yml
decisions:
  - "Format-guard self-test does NOT assert real-tree exit 0 (15-01 unmerged here → 5 offenders by design); replaced with a clean-subset negative control. Real-tree green is the orchestrator post-merge gate."
  - "Date.toString() match kept narrow (requires a Date construction/identifier context) to avoid flagging unrelated .toString(); documented in guard header."
  - "Catalog et↔ru parity enforced transitively via en (each checked vs en); no separate cross-pair pass."
metrics:
  duration: ~25m
  completed: 2026-06-13
---

# Phase 15 Plan 02: i18n CI Guards Summary

Two repo-root CI guards plus self-tests, package scripts, and workflow jobs that
lock in I18N-01 (catalog parity) and I18N-03 (no raw locale formatting): a grep
guard failing on un-ignored `toLocale*`/Date.toString in features+components, and a
po manifest guard failing on en/et/ru msgid divergence or empty et/ru translations.

## What Was Built

- **scripts/check-i18n-format.mjs** — scans `frontend2/src/features` +
  `frontend2/src/components`; flags `.toLocale{Date,Time,}String(` and a narrow
  `Date.toString()` form; exempts `// i18n-format-ignore` lines, `src/lib/format/`,
  and `*.test.*`; never flags `Intl.NumberFormat`. Optional CLI arg overrides the
  scan root (used by the self-test).
- **scripts/check-i18n-catalog.mjs** — minimal po parser (folded-continuation
  aware, skips the header entry); fails on msgid-set divergence across en/et/ru or
  any empty et/ru msgstr; `--only <locale>` restricts to one locale vs en for
  parallel Wave-2 verification. Real tree = `frontend2/src/locales/{en,et,ru}/messages.po`;
  optional dir arg = `<dir>/<locale>.po` for fixtures.
- **frontend2/package.json** — `lint:i18n:format` → `node ../scripts/check-i18n-format.mjs`,
  `lint:i18n` → `node ../scripts/check-i18n-catalog.mjs`. NOT added to `prebuild`.
- **.github/workflows/lint-frontend2.yml** — two new jobs (`i18n-format-guard`,
  `i18n-catalog-guard`) mirroring `forbidden-imports`; pull_request + push `paths`
  extended with the 4 new script/test paths.

## Tasks

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | check-i18n-format.mjs + self-test + fixtures | 5892803d |
| 2 | check-i18n-catalog.mjs + self-test + fixtures | 63009422 |
| 3 | package.json scripts + CI workflow wiring | f57af35b |

TDD: fixtures + self-tests written RED first (confirmed module-not-found / exit-1
mismatch), then implemented to GREEN for both guards.

## Verification

- `node --test` both self-tests: **11 tests pass, 0 fail**.
- `bun run lint:tsc`: clean. `bun run test`: **1098 tests pass (173 files)**.
- `bun run build`: succeeded (pre-existing chunk-size advisory only).
- `bun run lint:imports`: OK.
- Per HARD RULE, `bun run lint:i18n:format` was NOT run against the real tree (15-01
  render-site routing unmerged here → exits 1 by design). That is the orchestrator's
  post-merge gate.

## Deviations from Plan

**1. [Rule 1 — correctness] Format-guard self-test real-tree assertion replaced.**
- **Found during:** Task 1.
- **Issue:** The plan's `<behavior>` listed "real frontend2/src exit 0" as a
  cross-plan link (mirroring forbidden-imports). In this isolated Wave-1 worktree
  15-01 is unmerged, so the real tree has 5 raw-`toLocale*` offenders — that
  assertion fails BY DESIGN, and the orchestrator HARD RULE forbids running the
  format guard against the real tree here.
- **Fix:** Replaced the real-tree assertion with a `clean-subset/` negative-control
  fixture dir (clean + ignore-tagged + Intl only) asserting exit 0. Real-tree green
  remains the orchestrator's post-merge responsibility, documented in a code comment.
- **Files:** scripts/__tests__/check-i18n-format.test.mjs,
  scripts/__tests__/fixtures-i18n-format/clean-subset/ok.tsx.
- **Commit:** 5892803d.

## Known Stubs

None. Both guards are fully functional; the catalog guard's real-tree run is
expected-red until Wave 2 fills et/ru (by design, not a stub).

## Self-Check: PASSED
