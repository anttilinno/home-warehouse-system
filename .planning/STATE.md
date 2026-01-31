# Project State: Home Warehouse System

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-01-31)

**Core value:** Reliable inventory access anywhere — online or offline — with seamless sync
**Current focus:** v1.4 Test Overhaul - COMPLETE

## Current Position

**Milestone:** v1.4 Test Overhaul
**Phase:** 26 of 26 (E2E Stability and Coverage) — Complete
**Plan:** 4 of 4 in current phase — 26-04 complete
**Status:** Milestone complete
**Last activity:** 2026-01-31 — Completed 26-04-PLAN.md (Loan CRUD Flow Tests)

Progress: [====================] 100% (20/20 plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 87 (from v1-v1.4)
- Average duration: ~15 min
- Total execution time: ~21.8 hours

**By Milestone:**

| Milestone | Phases | Plans | Status |
|-----------|--------|-------|--------|
| v1 | 5 | 14 | Complete |
| v1.1 | 6 | 12 | Complete |
| v1.2 | 6 | 19 | Complete |
| v1.3 | 4 | 22 | Complete |
| v1.4 | 5 | 20 | Complete |

## Accumulated Context

### Decisions

Key decisions logged in PROJECT.md Key Decisions table.
Milestone decisions archived in:
- `.planning/milestones/v1.3-ROADMAP.md`
- `.planning/milestones/v1.2-ROADMAP.md`
- `.planning/milestones/v1.1-ROADMAP.md`

**Recent Decisions:**
- DEC-26-04-01: Use test.skip() for missing prerequisites instead of failing
- DEC-26-04-02: Replace networkidle globally with domcontentloaded due to SSE
- DEC-26-04-03: Document comprehensive E2E gaps as future work (not scope of phase)
- DEC-26-03-01: Use role-based selectors for dialog title instead of class-based
- DEC-26-03-02: Test both table and empty state scenarios with conditional checks
- E2E-AUTH-01: Use waitForURL instead of waitForTimeout for navigation
- E2E-AUTH-02: Monitor API responses before waiting for navigation
- DEC-26-02-01: Use toHaveClass for theme class changes instead of getAttribute polling
- DEC-26-02-02: Use expect().toPass() for complex multi-condition waits

### Current Test Coverage Baseline

**Backend (Go) - Phase 23 Complete:**
- importexport: 31% -> 92.4% (BE-01 COMPLETE)
- pendingchange: 29% -> 57.3% (BE-02 COMPLETE - service layer comprehensive)
- importjob: 38% -> 86.3% (BE-03 COMPLETE)
- jobs: 17% -> 20.1% (BE-04 COMPLETE - limited by database dependencies)
- itemphoto: 40% -> 80.5% (BE-05 COMPLETE)
- repairlog: 36% -> 92.8% (BE-06 COMPLETE)

**Backend API Tests (Phase 24):**
- repairphoto: ~10% -> 20.5% (24-01 COMPLETE - handler tests)
- declutter: ~15% -> 41.6% (24-01 COMPLETE - handler tests)
- repair workflow: Integration tests complete (24-02 COMPLETE - auth/authz coverage)

**Frontend Unit Tests (Phase 25 COMPLETE):**
- useOfflineMutation: 29 test cases (25-01 COMPLETE - queue, optimistic, network, helpers)
- SyncManager: 83.46% statements, 73.55% branch, 34 test cases (25-02 COMPLETE)
- MultiStepForm: 21 test cases (25-03 COMPLETE - navigation, validation, draft persistence)
- BarcodeScanner: 18 test cases (25-04 COMPLETE - init, permissions, torch, pause)
- FloatingActionButton: 28 test cases (25-05 COMPLETE - toggle, keyboard, accessibility)

**E2E Test Stability (Phase 26 COMPLETE):**
- 26-01: Auth setup timing fixes (COMPLETE - waitForURL, API monitoring, retry logic)
- 26-02: High-risk E2E test stabilization (COMPLETE - 25 waitForTimeout calls removed)
- 26-03: Inventory E2E tests (COMPLETE - InventoryPage PO, 18 tests)
- 26-04: Loan CRUD flow tests (COMPLETE - 4 tests, 10 consecutive runs verified)

**Frontend - Infrastructure Status (Phase 22 Complete):**
- @vitest/coverage-v8 installed (22-02)
- Entity factories created (22-01, 22-02)
- Mock utilities for offline/sync created (22-02)
- CI workflow with parallel tests and Codecov (22-03)
- Coverage badges in README (22-03)

### Pending Todos

**Manual Testing Required (Phase 19 - Barcode Scanning):**
- [ ] SCAN-01 through SCAN-07: Barcode scanning manual verification
- [ ] iOS PWA: Camera permission persistence

**Future E2E Work (documented in 26-04-SUMMARY.md):**
- [ ] Complete CRUD in existing specs (items, locations, containers, borrowers, categories)
- [ ] Fix accessibility test failures (actual component issues)
- [ ] Remove remaining waitForTimeout instances (~30 in lower-priority files)
- [ ] Stabilize theme/command palette tests
- [ ] Add multi-entity flow tests

### Blockers/Concerns

Carried forward:
- Safari iOS manual testing pending
- CGO_ENABLED=0 build has webp library issue — dev builds work fine
- Jobs package coverage limited by pgxpool/Redis requirements (documented in JOBS-COV-01)
- E2E rate limiting: Backend limits auth to 5 req/min (documented, not a bug)

## Session Continuity

Last session: 2026-01-31
Stopped at: Completed 26-04-PLAN.md (Loan CRUD Flow Tests) - v1.4 Milestone Complete
Resume file: None
Next step: Plan next milestone or address pending todos

---
*Updated: 2026-01-31 after 26-04 complete - v1.4 Test Overhaul milestone complete*
