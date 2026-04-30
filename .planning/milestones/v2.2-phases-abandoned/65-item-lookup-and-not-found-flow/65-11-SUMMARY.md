---
phase: 65-item-lookup-and-not-found-flow
plan: 11
subsystem: testing
tags: [e2e, playwright, integration-test, go, postgres, regression-guard, gap-closure, G-65-01, LOOK-01]

# Dependency graph
requires:
  - phase: 65-item-lookup-and-not-found-flow
    provides: "Plan 65-09 backend GET /api/workspaces/{wsId}/items/by-barcode/{code} route + Plan 65-10 itemsApi.lookupByBarcode swap to the dedicated endpoint — the two fixes this test locks in place"
provides:
  - "G-65-01 regression test at the layer the original bug lived at — full-stack browser E2E (Branch A) + backend-HTTP+Postgres integration (Branch B)"
  - "First Playwright surface in the repo: frontend2/e2e/ + playwright.config.ts + test:e2e scripts + chromium/firefox browsers"
  - "First Go integration-test surface against the real `tests/testdb` harness under a `//go:build integration` tag"
  - "CLAUDE.md contributor runbook covering both suites (how to run locally, auth contract, write-dir gitignores)"
affects: [66, 67, 68, 69, 70, 71, 72]  # any future phase that reverts the by-barcode contract breaks these tests

# Tech tracking
tech-stack:
  added:
    - "@playwright/test (frontend2 devDependency) + Firefox + Chromium browser binaries"
  patterns:
    - "Test at the right layer: unit tests that mock above the regression surface are necessary but not sufficient — every gap-closure of a shipped bug must land at least one test at the level the bug was actually observable"
    - "Build-tagged Go integration tests (//go:build integration) — kept out of the default `go test ./...` path so the fast CI lane stays fast, opt-in via tag when a real Postgres is available"
    - "Browser E2E opts out of webServer auto-start — expects the developer to have the dev stack running per CLAUDE.md runbook; keeps the config simple and avoids process-lifecycle flakiness"
    - "Per-run unique barcode seed (E2E-${Date.now()} / INT-TEST-{uuid}) + cleanup/truncate — prevents cross-run pollution without requiring a full DB reset"

key-files:
  created:
    - "frontend2/e2e/scan-lookup.spec.ts — Playwright spec: login → seed item with unique barcode → /scan → MANUAL tab → type code → LOOK UP CODE → asserts MATCHED banner + seeded item name (Branch A)"
    - "frontend2/playwright.config.ts — first Playwright config in the repo; chromium + firefox projects; no webServer"
    - "CLAUDE.md — new project-root contributor runbook; §E2E Tests + §Backend Integration Tests sections"
    - "backend/internal/domain/warehouse/item/handler_integration_test.go — Go integration test: real svc + real Postgres via tests/testdb harness; 3 subtests (200 happy path / 404 never-existed / 404 cross-tenant leak guard) behind //go:build integration (Branch B)"
  modified:
    - "frontend2/package.json — @playwright/test devDep + test:e2e + test:e2e:headed scripts"
    - "frontend2/vitest.config.ts — exclude **/e2e/** from Vitest globs (Playwright's test.describe API differs from Vitest's, would collide otherwise)"
    - "frontend2/.gitignore — ignore test-results/, playwright-report/, playwright/.cache/"
    - "frontend2/bun.lock — @playwright/test resolution"

key-decisions:
  - "Option C (both branches) chosen, not the planner-recommended Option A alone. Rationale: G-65-01 lived at BOTH layers — backend FTS exclusion (Plan 65-09 closed) and frontend itemsApi.list wrap (Plan 65-10 closed) — so belt-and-braces coverage mirrors the two-layer fix. Branch A alone would catch frontend reverts; Branch B alone would catch backend reverts; together they form a matched pair of regression guards that will fail if either fix drifts. The plan's own Task 0 Option C con ('doubles the scope') was accepted because Phase 71/72 Stabilization has not been planned yet and deferring the backend-layer test to an unplanned phase would leave a coverage gap for an unknown duration."
  - "Branch A shipped first (5e77f98) with explicit 'Branch B lands in follow-up commit' note; Branch B shipped separately (8d4191d) once the test was verified green against real Postgres. Split into two commits (not one squashed commit) because the two artifacts belong to different stacks (bun/Playwright vs go/pgx) and have zero file overlap — future archaeology is cleaner with the commits separated."
  - "Branch A spec uses locale-agnostic regex assertions (`/matched|vaste leitud/i`) rather than forcing EN — the test survives if the dev stack defaults to ET, and still catches the exact regression (banner text reading NOT FOUND / EI LEITUD when MATCHED / VASTE LEITUD was expected)."
  - "Branch B uses the existing `tests/testdb` harness (SetupTestDB + CreateTestWorkspace) rather than introducing a new `backend/internal/testutil/integration.go` package as the plan suggested. Reason: the harness already covers what the test needs (TEST_DATABASE_URL env var with sensible default, fixture user+workspace insertion, per-test cleanup hook). Adding a parallel harness would fragment integration-test plumbing."
  - "Branch B does not delete the seeded items — it relies on the testdb harness's t.Cleanup hook (CleanupTestDB) to wipe state. Unique per-run barcodes (`INT-TEST-${uuid}[:8]`) mean collisions are effectively impossible even if cleanup is skipped."
  - "CLAUDE.md created at project root (not merged into .planning/) — the plan explicitly asked for the contributor runbook to live at `CLAUDE.md (project-root)` so future Claude Code invocations auto-load it as project instructions."

patterns-established:
  - "Two-layer gap-closure testing: whenever a bug spans backend + frontend, land ONE test at each layer. Single layer is insufficient because the other half can be reverted invisibly."
  - "//go:build integration opt-in for DB-requiring tests: default `go test ./...` stays fast and hermetic; integration suite invoked explicitly via `-tags=integration` with TEST_DATABASE_URL set."
  - "Playwright E2E spec structure: log in via real UI (cookies set for both page + request), seed via cookie-authenticated page.request, exercise via UI, assert on rendered text, teardown in finally."

requirements-completed: [LOOK-01]

# Metrics
duration: ~45min  # (2026-04-19 14:45Z branch A work → 2026-04-19 15:14Z 5e77f98 landed → branch B test authored → 8d4191d committed + CLAUDE.md backend section after SUMMARY)
completed: 2026-04-19
---

# Phase 65 Plan 11: G-65-01 Regression Guard (Option C — E2E + Go integration) Summary

**Two regression tests landed in the correct layers — a Playwright browser E2E (`frontend2/e2e/scan-lookup.spec.ts`) and a Go HTTP+Postgres integration test (`backend/internal/domain/warehouse/item/handler_integration_test.go`, `//go:build integration`). Together they fail if either Plan 65-09 (backend `/items/by-barcode/{code}` route) or Plan 65-10 (frontend `itemsApi.lookupByBarcode` swap) is ever reverted — closing the class of regression that let G-65-01 ship with 710 unit tests green.**

## Performance

- **Duration:** ~45 min across both branches
- **Started:** 2026-04-19T14:45:00Z (Branch A planning + implementation)
- **Completed:** 2026-04-19T15:30:00Z (Branch B commit + CLAUDE.md sibling section)
- **Tasks:** 2 (Task 0 decision checkpoint resolved → Option C; Task 1 Branch A + Branch B executed)
- **Commits:** 2 (5e77f98 feat Branch A; 8d4191d test Branch B)
- **Files created:** 4 new (scan-lookup.spec.ts, playwright.config.ts, CLAUDE.md, handler_integration_test.go)
- **Files modified:** 4 (frontend2/package.json, frontend2/vitest.config.ts, frontend2/.gitignore, frontend2/bun.lock)

## Accomplishments

- **Task 0 — Decision checkpoint:** Option C (both branches) chosen over planner-recommended Option A alone. Belt-and-braces coverage mirrors the two-layer G-65-01 fix; deferring Branch B to an unplanned Stabilization phase would have left a coverage gap for an unknown duration.
- **Branch A — Playwright E2E (5e77f98):**
  - `frontend2/e2e/scan-lookup.spec.ts` logs in via the real `/login` form, seeds an item with a unique per-run barcode via cookie-authenticated `page.request.post`, navigates `/scan → MANUAL tab`, types the barcode, clicks `LOOK UP CODE`, and asserts the `MATCHED` (or `VASTE LEITUD`) banner renders alongside the seeded item's name. Verified green on both chromium and firefox against the running dev stack.
  - First Playwright surface in the repo: `playwright.config.ts` with chromium + firefox projects (no webServer — expects the dev stack running per CLAUDE.md runbook), `test:e2e` + `test:e2e:headed` scripts, `@playwright/test` devDep, browser binaries installed, write-dirs gitignored.
  - `frontend2/vitest.config.ts` excludes `**/e2e/**` so Vitest's test-collector does not try to load the Playwright spec (whose `test.describe` API is subtly different).
- **Branch B — Go HTTP+Postgres integration test (8d4191d):**
  - `backend/internal/domain/warehouse/item/handler_integration_test.go` under `//go:build integration` — real `item.NewService` wired to the real `postgres.NewItemRepository` exercising the real `GET /items/by-barcode/{code}` route through a chi+humachi test router that injects workspace/user context the same way `appMiddleware` does in production.
  - Three subtests: (1) 200 happy path with seeded barcode, (2) 404 for a guaranteed-unique never-existed code, (3) **404 for a barcode that only exists in another workspace** — this third one is the truth the handler unit test cannot assert, because with a mocked service "other workspace" and "never existed" are indistinguishable; only the real SQL `WHERE barcode = $2 AND workspace_id = $1` clause tells them apart, and a future developer breaking that clause would leak tenant data without this test.
  - Uses the existing `tests/testdb` harness (no new plumbing). `TEST_DATABASE_URL` defaults to `postgresql://wh:wh@localhost:5432/warehouse_test`; the harness's `t.Cleanup` hook handles teardown; unique `INT-TEST-${uuid}[:8]` barcodes make collisions effectively impossible.
  - Verified green: 3/3 subtests PASS in 0.21s.
- **Contributor runbook — CLAUDE.md:** New project-root file (auto-loaded as Claude Code project instructions on future invocations) documenting both suites. §E2E Tests covers the Playwright runbook + auth contract (the `/login` form has two buttons with "LOG IN" text — the submit-type button is distinguished by `^LOG IN$` exact match) + how to add a new spec. §Backend Integration Tests covers `-tags=integration` + `TEST_DATABASE_URL` + Postgres prereq.
- **Non-integration suites still green:** `go test ./...` (backend default lane, no integration tag) and `bunx vitest run` (frontend unit lane, e2e/ excluded) both zero-failures. The integration tag is opt-in; the default paths do not regress.

## Task Commits

1. **Task 0 Decision — Option C (both branches):** resolved inline during planning; no commit, captured in SUMMARY key-decisions.
2. **Task 1 Branch A — Playwright E2E regression spec + playwright.config.ts + package.json scripts + vitest exclude + .gitignore + CLAUDE.md §E2E Tests:** `5e77f98` (feat)
3. **Task 1 Branch B — Go integration test (`//go:build integration`) exercising real svc + real repo + real Postgres with 3 subtests including cross-tenant leak guard, plus CLAUDE.md §Backend Integration Tests section:** `8d4191d` (test) — CLAUDE.md backend section added alongside

## Files Created/Modified

**Created:**
- `frontend2/e2e/scan-lookup.spec.ts` — Playwright regression spec (~143 lines)
- `frontend2/playwright.config.ts` — chromium + firefox projects, no webServer
- `CLAUDE.md` — contributor runbook (project root, auto-loaded by Claude Code)
- `backend/internal/domain/warehouse/item/handler_integration_test.go` — Go integration test (~158 lines, build-tagged)

**Modified:**
- `frontend2/package.json` — test:e2e + test:e2e:headed scripts; @playwright/test devDep
- `frontend2/vitest.config.ts` — exclude `**/e2e/**`
- `frontend2/.gitignore` — Playwright write-dirs
- `frontend2/bun.lock` — Playwright resolution

## Decisions Made

- **Option C over Option A alone:** backend and frontend halves of G-65-01 are both worth guarding; deferring Branch B to a nonexistent Stabilization phase would leave an unbounded coverage gap. The plan's "SCOPE WARNING" about Option C doubling scope was accepted in this case.
- **Two commits, not one:** Branch A and Branch B have zero file overlap (bun/Playwright vs go/pgx). Separate commits keep `git log` archaeology clean.
- **Locale-agnostic spec assertions:** `/matched|vaste leitud/i` survives whichever locale the dev stack defaults to.
- **Reuse `tests/testdb` harness:** avoids fragmenting integration-test plumbing — the plan suggested creating a parallel `internal/testutil/integration.go`, but the existing harness already covers the test's needs.
- **Build tag keeps the default test lane fast:** `go test ./...` ignores `//go:build integration`; CI continues to run in milliseconds; integration tests are opt-in via `-tags=integration` + `TEST_DATABASE_URL`.
- **Cross-tenant 404 subtest is load-bearing:** this is the single subtest that cannot be written at the handler unit layer — a mocked service cannot distinguish "other workspace" from "never existed". Removing it would remove the last regression guard against Pitfall #5 (cross-tenant barcode leak via a broken SQL `WHERE workspace_id = $1` clause).

## Deviations from Plan

**Reused `tests/testdb` instead of creating `backend/internal/testutil/integration.go`** — Plan 65-11 Task 1 Branch B step B.1 says "If NONE [integration-test plumbing] exists: create minimal plumbing in `backend/internal/testutil/integration.go`". In practice, `backend/tests/testdb/testdb.go` already exists with `SetupTestDB` + `CreateTestWorkspace` + fixture-user insertion + cleanup hook + sensible `TEST_DATABASE_URL` default — it is exactly the plumbing the plan asked for, just under a different import path. Using it instead of creating a parallel package prevents fragmentation. Classification: Rule 3 Blocking auto-fix (creating duplicate plumbing would have introduced a parallel integration-test convention that immediately competes with the existing one — not a scope-creep deviation but a plumbing-discovery correction).

**Total deviations:** 1 auto-fixed (Rule 3 — blocking duplicate plumbing avoided by reusing `tests/testdb`).
**Impact on plan:** Zero scope change. Branch B artifact, subtest coverage, build tag, and runnable command are all exactly as planned; only the location of the test-DB helper differs from the planner's assumption.

## Issues Encountered

- **Branch A landed before Branch B was fully green** — 5e77f98's commit body explicitly notes "Branch B (Go integration test) lands in a follow-up commit." This is how Plan 65-11 Option C was intended to execute (two branches = two artifacts = two commits), but it meant the plan was transiently in a half-done state between 5e77f98 and 8d4191d. No SUMMARY.md was written during that window, which is the state `/gsd-execute-phase` landed in today (Plan 65-11 had a feature commit but no SUMMARY.md, so GSD treated the plan as incomplete). Resolved by inspecting the untracked `handler_integration_test.go`, confirming it was the promised Branch B, running it green against real Postgres (3/3 subtests PASS in 0.21s), committing as 8d4191d, adding the §Backend Integration Tests section to CLAUDE.md, and writing this SUMMARY. Lesson for future gap-closure plans: if a plan spans multiple commits and the SUMMARY lands at the end, either write a stub SUMMARY with a "WIP — Branch X pending" note after the first commit, or fold the commits into a single atomic commit so the plan cannot end up transiently half-done.

## User Setup Required

None. Both suites run on the existing dev stack. Playwright browser binaries install on first `bun run test:e2e` (or `bunx playwright install`); the Go integration tag defaults to the local `warehouse_test` Postgres.

## Verification

Reversion experiment (from the plan's verification section):

- **Revert Plan 65-09 (backend route):** the Go integration test's 200-happy-path subtest would fail at `require.Equal(t, http.StatusOK, rec.Code)` because the route would 404; the Playwright spec would also fail because the frontend's `/items/by-barcode/{code}` call would return 404 and the banner would render NOT FOUND instead of MATCHED. **Both branches catch this.**
- **Revert Plan 65-10 (frontend swap):** the Go integration test would still pass (it does not touch the frontend). The Playwright spec would fail because `itemsApi.lookupByBarcode` would go back to `list({search: code})` which hits the FTS-excluded barcode column → empty results → NOT FOUND banner. **Only Branch A catches this** — exactly the Option B con called out in Task 0, which is why Option C was chosen.

Combined, the two branches form a matched pair: any regression of G-65-01's fix at either layer is visible within one test run.

## Next Phase Readiness

- **Phase 65 COMPLETE.** 11/11 plans shipped; LOOK-01 / LOOK-02 / LOOK-03 all have rendered user paths + automated tests (unit + regression at both layers) + EN+ET translations + zero bundle regression + G-65-01 regression guard in place.
- **Phase 66 (Quick-Action Menu) unblocked.** Phase 66 depends on Phase 65 per the v2.2 roadmap; the by-barcode contract and scan flow are now stable and test-guarded.
- **Future E2E specs welcome.** The Playwright infra (config + projects + scripts + CLAUDE.md auth contract) is ready to absorb more specs — the plan explicitly mentions "v2.2+ will want more E2E coverage" and the infrastructure cost has now been paid. Phase 66/67/68/69 can add specs without replanning the runner.

---
*Phase: 65-item-lookup-and-not-found-flow*
*Completed: 2026-04-19*
