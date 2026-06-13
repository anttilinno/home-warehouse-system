---
phase: 17-polish-quality
plan: 04
subsystem: testing
tags: [coverage, parity, playwright, go-integration, declutter, postgres]

requires:
  - phase: 17-polish-quality (17-02)
    provides: a11y-sweep + keyboard-nav E2E specs (cross-route coverage referenced by the matrix)
  - phase: 65 (65-11)
    provides: the tagged-Go-integration pattern (tests/testdb harness) reused for the declutter gap-fill
provides:
  - COVERAGE-MATRIX.md mapping every HTTP-crossing flow -> E2E spec + Go integration test (POL-01)
  - ENDPOINT-DIFF.md parity gate (legacy vs frontend2 endpoint diff + ~40-route checklist) (POL-06)
  - declutter_repository_integration_test.go closing the one genuine zero-coverage flow
affects: [final-review-checklist, v3.0-parity-signoff]

tech-stack:
  added: []
  patterns:
    - "real-backend coverage = E2E (live /api stack) OR tagged Go integration; mock unit tests and render-only a11y sweeps do NOT count"
    - "declutter threshold tests backdate created_at via direct SQL to make COALESCE(last_used_at, created_at) deterministic"

key-files:
  created:
    - .planning/phases/17-polish-quality/COVERAGE-MATRIX.md
    - .planning/phases/17-polish-quality/ENDPOINT-DIFF.md
    - backend/internal/infra/postgres/declutter_repository_integration_test.go
  modified: []

key-decisions:
  - "declutter is the single zero-coverage HTTP-crossing flow; filled with a tagged Go integration test (cheaper + more deterministic than a browser spec for the threshold math)"
  - "/paperless/settings DELETE is already present in frontend2 (deleteSettings) — corrected the CONTEXT draft delta from 'minor optional' to 'no delta'"
  - "/items/search?query= is served via itemsApi.list({search}) -> /items?search=, consumed by command-palette useEntitySearch — covered differently, not a gap"

patterns-established:
  - "Single-writer discipline: this plan owns only the two phase-dir docs + one NEW disjoint test file; no existing spec/test edited"

requirements-completed: [POL-01, POL-06]

duration: 18min
completed: 2026-06-14
---

# Phase 17 Plan 04: POL-01 Coverage Matrix + POL-06 Parity Gate Summary

**Committed flow→test coverage matrix proving every HTTP-crossing flow has ≥1 real-backend test, a parity-complete endpoint diff with a ~40-route checklist, and a single tagged-Go gap-fill closing the declutter domain's zero real-backend coverage.**

## Performance

- **Duration:** ~18 min
- **Tasks:** 3 (2 docs + 1 conditional gap-fill, which fired)
- **Files created:** 3 (+ this SUMMARY)
- **Files modified:** 0

## Accomplishments

- **COVERAGE-MATRIX.md (POL-01):** every HTTP-crossing flow grouped by domain
  (auth, items, inventory, maintenance, repairs, loans, borrowers, taxonomy,
  scan, analytics, approvals/pending-changes, wishlist, imports,
  attachments/paperless, notifications, settings, SSE, command-palette,
  multitenancy, declutter) mapped to its real E2E spec AND Go integration test,
  scored BOTH / E2E-only / Go-only / NONE. Every cell verified by grepping the
  worktree — no invented coverage.
- **Found exactly one genuine gap:** the **declutter** domain. Its only test was
  a `mock.Mock` unit test (`declutter/handler_test.go`, no DB, no integration
  tag); `/declutter` was only render-swept by `a11y-sweep.spec.ts`.
- **Gap-fill (POL-01):** new tagged Go integration test exercising the full
  declutter Service → repo → real Postgres stack — ListUnused + score, GetCounts
  cents aggregates, MarkUsed clears the unused flag, and cross-tenant MarkUsed →
  ErrNotFound. **Verified green** against `warehouse_test`.
- **ENDPOINT-DIFF.md (POL-06):** parity-essentially-complete conclusion, the 5
  residual deltas table (with the `/paperless/settings` DELETE correction), the
  ported-files map, a full ~40-route checklist reconciled against
  `routes/index.tsx`, and the 4 POL-06 residues routed to FINAL-REVIEW-CHECKLIST.

## Task Commits

1. **Task 1: COVERAGE-MATRIX.md (POL-01)** — `b0119839` (docs)
2. **Task 2: ENDPOINT-DIFF.md (POL-06)** — `2734fda5` (docs)
3. **Task 3: declutter gap-fill integration test (POL-01)** — `192e2854` (test)

## Files Created/Modified

- `.planning/phases/17-polish-quality/COVERAGE-MATRIX.md` — flow→E2E+Go coverage matrix, gaps section
- `.planning/phases/17-polish-quality/ENDPOINT-DIFF.md` — endpoint parity diff + route checklist
- `backend/internal/infra/postgres/declutter_repository_integration_test.go` — gap-fill (tagged `//go:build integration`)

## Decisions Made

- **Gap-fill was needed** (the conditional Task 3 fired): declutter had zero
  real-backend coverage. Chose a Go integration test over a browser spec — the
  unused-threshold and value-aggregate math is deterministic against direct-SQL
  backdating, and it reuses the existing `tests/testdb` harness with no new dep.
- **CONTEXT delta correction:** `/paperless/settings` DELETE is actually present
  in frontend2 (`paperless.ts:61` `deleteSettings`), so it is recorded as "no
  delta" rather than "minor optional".

## Deviations from Plan

None affecting scope. The conditional gap-fill (Task 3) executed because the
matrix found a genuine NONE row (declutter), exactly as the plan's OQ-3 gating
prescribes. One factual correction to the transcribed CONTEXT diff (paperless
DELETE) is documented in ENDPOINT-DIFF.md.

## Known Stubs

None. No stub/placeholder data introduced; the gap-fill test asserts real DB
behavior.

## Issues Encountered

- The gap-fill test initially asserted `Score > 0.0` (float); `DeclutterItem.Score`
  is an `int`. Fixed to `Score > 0` and the test passed against real Postgres.

## Verification

- `cd backend && go build ./...` → OK
- `go vet -tags=integration ./internal/infra/postgres/` → OK
- `TEST_DATABASE_URL=postgresql://wh:wh@localhost:5432/warehouse_test go test -tags=integration -run TestDeclutterService_UnusedLifecycle ./internal/infra/postgres/` → `ok` (4 subtests pass)
- No file touched with a `sync`/`idb`/`offline` substring; no STATE/ROADMAP/REQUIREMENTS/package.json/vite/CI edits.

## Next Phase Readiness

POL-01 + POL-06 satisfied. After this gap-fill there are **no remaining
zero-coverage HTTP-crossing flows**. Residues (one-week dogfooding, 3 niche
inventory endpoints, e2e-frontend2.yml first-PR validation, sketch-006 pixel
diff) are logged to FINAL-REVIEW-CHECKLIST per 17-VALIDATION.

## Self-Check: PASSED

- All 4 files exist on disk (COVERAGE-MATRIX, ENDPOINT-DIFF, gap-fill test, SUMMARY).
- All 3 task commits present in git: `b0119839`, `2734fda5`, `192e2854`.

---
*Phase: 17-polish-quality*
*Completed: 2026-06-14*
