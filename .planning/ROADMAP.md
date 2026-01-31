# Roadmap: Home Warehouse System

## Milestones

- v1 **PWA Offline Completion** — Phases 1-5 (shipped 2026-01-24)
- v1.1 **Offline Entity Extension** — Phases 6-11 (shipped 2026-01-25)
- v1.2 **Phase 2 Completion** — Phases 12-17 (shipped 2026-01-25)
- v1.3 **Mobile UX Overhaul** — Phases 18-21 (shipped 2026-01-31)
- v1.4 **Test Overhaul** — Phases 22-26 (in progress)

## Phases

<details>
<summary>v1 PWA Offline Completion (Phases 1-5) — SHIPPED 2026-01-24</summary>

See `.planning/MILESTONES.md` for full details.

**Delivered:** Complete offline capabilities for PWA - view workspace data and create/update items while offline with automatic sync.

- Phase 1: IndexedDB Setup (3 plans)
- Phase 2: Mutation Queue Infrastructure (3 plans)
- Phase 3: Conflict Resolution (2 plans)
- Phase 4: Sync Manager & iOS Fallback (3 plans)
- Phase 5: Item Form Migration (3 plans)

</details>

<details>
<summary>v1.1 Offline Entity Extension (Phases 6-11) — SHIPPED 2026-01-25</summary>

See `.planning/milestones/v1.1-ROADMAP.md` for full details.

**Delivered:** Offline mutations for all core entities with dependency-aware sync ordering and conflict history UI.

- Phase 6: Infrastructure & Borrowers (2 plans)
- Phase 7: Categories (2 plans)
- Phase 8: Locations (2 plans)
- Phase 9: Containers (2 plans)
- Phase 10: Inventory (3 plans)
- Phase 11: Conflict History (1 plan)

</details>

<details>
<summary>v1.2 Phase 2 Completion (Phases 12-17) — SHIPPED 2026-01-25</summary>

See `.planning/milestones/v1.2-ROADMAP.md` for full details.

**Delivered:** Enhanced item lifecycle management with repair tracking, declutter assistance, photo processing improvements, and SSE test coverage.

- Phase 12: Repair Log Foundation (3 plans)
- Phase 13: Repair Log Extensions (4 plans)
- Phase 14: Declutter Assistant (3 plans)
- Phase 15: Background Thumbnail Processing (3 plans)
- Phase 16: Bulk Photo Operations (2 plans)
- Phase 17: Testing & Polish (4 plans)

</details>

<details>
<summary>v1.3 Mobile UX Overhaul (Phases 18-21) — SHIPPED 2026-01-31</summary>

See `.planning/milestones/v1.3-ROADMAP.md` for full details.

**Delivered:** Warehouse-grade mobile experience with barcode scanning, offline fuzzy search, floating action buttons with radial menus, and mobile-optimized multi-step forms.

- Phase 18: Fuzzy Search Infrastructure (4 plans)
- Phase 19: Barcode Scanning (6 plans)
- Phase 20: Mobile Navigation - FAB and Gestures (5 plans)
- Phase 21: Mobile Form Improvements (7 plans)

</details>

### v1.4 Test Overhaul (In Progress)

**Milestone Goal:** Establish 80% minimum coverage standard with fast, reliable test infrastructure

See `.planning/milestones/v1.4-ROADMAP.md` for full details.

- [x] **Phase 22: Test Infrastructure Setup** - Testing foundations enable fast, reliable test development
  - [x] 22-01-PLAN.md — Go test factories for common entities
  - [x] 22-02-PLAN.md — Frontend coverage and mock utilities setup
  - [x] 22-03-PLAN.md — CI parallelization and coverage reporting
- [ ] **Phase 23: Backend Business Logic Tests** - Bring 6 packages to 80%+ coverage
  **Plans:** 8 plans (6 original + 2 gap closure)
  - [x] 23-01-PLAN.md — importexport workspace backup/restore tests
  - [x] 23-02-PLAN.md — pendingchange apply methods tests
  - [x] 23-03-PLAN.md — importjob handler and upload tests
  - [x] 23-04-PLAN.md — jobs thumbnail processor tests (60%+ target)
  - [x] 23-05-PLAN.md — itemphoto bulk operations and duplicate detection tests
  - [x] 23-06-PLAN.md — repairlog handler and service error path tests
  - [ ] 23-07-PLAN.md — pendingchange handler unit tests (gap closure)
  - [ ] 23-08-PLAN.md — jobs ProcessTask error paths (gap closure)
- [ ] **Phase 24: Backend API Testing** - Handler unit tests and integration tests
  **Plans:** 3 plans
  - [ ] 24-01-PLAN.md — repairphoto and declutter handler unit tests
  - [ ] 24-02-PLAN.md — repair workflow and sync integration tests
  - [ ] 24-03-PLAN.md — request/response validation tests
- [x] **Phase 25: Frontend Unit Testing** - Critical hooks and components have tests preventing sync and UI regressions
  **Plans:** 5 plans
  - [x] 25-01-PLAN.md — useOfflineMutation hook tests (29 tests)
  - [x] 25-02-PLAN.md — SyncManager comprehensive tests (34 tests)
  - [x] 25-03-PLAN.md — MultiStepForm component tests (21 tests)
  - [x] 25-04-PLAN.md — BarcodeScanner component tests (18 tests)
  - [x] 25-05-PLAN.md — FloatingActionButton component tests (28 tests)
- [ ] **Phase 26: E2E Stability and Coverage** - E2E test suite runs reliably and covers critical user flows
  **Plans:** 4 plans
  - [ ] 26-01-PLAN.md — Fix auth.setup.ts timing issues (E2E-01)
  - [ ] 26-02-PLAN.md — Stabilize flaky tests in high-risk files (E2E-02)
  - [ ] 26-03-PLAN.md — Add inventory page E2E tests (E2E-03)
  - [ ] 26-04-PLAN.md — Add loan CRUD flow tests and verify stability (E2E-03)

## Progress

| Phase | Milestone | Plans | Status | Shipped |
|-------|-----------|-------|--------|---------|
| 1-5 | v1 | 14 | Complete | 2026-01-24 |
| 6-11 | v1.1 | 12 | Complete | 2026-01-25 |
| 12-17 | v1.2 | 19 | Complete | 2026-01-25 |
| 18-21 | v1.3 | 22 | Complete | 2026-01-31 |
| 22-26 | v1.4 | 24 | In progress | - |

**Total:** 23 phases complete (75 plans), 3 phases remaining (19 plans)

---
*Roadmap created: 2026-01-24*
*Last updated: 2026-01-31 after Phase 26 planning*
