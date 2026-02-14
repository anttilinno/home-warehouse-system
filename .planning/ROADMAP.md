# Roadmap: Home Warehouse System

## Milestones

- v1 **PWA Offline Completion** — Phases 1-5 (shipped 2026-01-24)
- v1.1 **Offline Entity Extension** — Phases 6-11 (shipped 2026-01-25)
- v1.2 **Phase 2 Completion** — Phases 12-17 (shipped 2026-01-25)
- v1.3 **Mobile UX Overhaul** — Phases 18-21 (shipped 2026-01-31)
- v1.4 **Test Overhaul** — Phases 22-26 (shipped 2026-01-31)
- v1.5 **Settings Enhancement** — Phases 27-29 (shipped 2026-02-03)
- v1.6 **Format Personalization** — Phases 30-34 (shipped 2026-02-08)
- v1.7 **Modular Settings** — Phases 35-39 (shipped 2026-02-13)
- v1.8 **Docker Deployment** — Phases 40-42 (shipped 2026-02-14)

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

<details>
<summary>v1.4 Test Overhaul (Phases 22-26) — SHIPPED 2026-01-31</summary>

See `.planning/milestones/v1.4-ROADMAP.md` for full details.

**Delivered:** Comprehensive test infrastructure and coverage with 82% requirements satisfied (14/17). Go test factories, backend coverage to 80%+ for 4 packages, 130 frontend unit tests, E2E auth stability, and CI parallelization with Codecov.

- Phase 22: Test Infrastructure Setup (3 plans)
- Phase 23: Backend Business Logic Tests (6 plans executed, 2 gap plans deferred)
- Phase 24: Backend API Testing (2 plans executed, 1 plan deferred)
- Phase 25: Frontend Unit Testing (5 plans)
- Phase 26: E2E Stability and Coverage (4 plans)

**Tech debt:** pendingchange handler.go at 57.3%, jobs at 20.1% (architectural constraint), 56 E2E waitForTimeout calls in lower-priority files.

</details>

<details>
<summary>v1.5 Settings Enhancement (Phases 27-29) — SHIPPED 2026-02-03</summary>

See `.planning/milestones/v1.5-ROADMAP.md` for full details.

**Delivered:** Complete user settings experience with profile management (avatar, email, name), security controls (password change, session management), and account lifecycle (deletion with safeguards).

- Phase 27: Account Settings (3 plans)
- Phase 28: Security Settings (4 plans)
- Phase 29: Account Deletion (2 plans)

</details>

<details>
<summary>v1.6 Format Personalization (Phases 30-34) — SHIPPED 2026-02-08</summary>

**Delivered:** Complete format personalization system with user preferences for date format (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD), time format (12-hour with AM/PM, 24-hour), and number format (thousand/decimal separator choices). All 107 display sites, 6 CSV exports, and 1 decimal input field respect user's chosen formats with immediate reactivity.

- Phase 30: Format Infrastructure (2 plans)
- Phase 31: Format Settings UI (2 plans)
- Phase 32: Date Format Rollout (2 plans)
- Phase 33: Time Format Rollout (1 plan)
- Phase 34: Number Format Rollout (2 plans)

</details>

<details>
<summary>v1.7 Modular Settings (Phases 35-39) — SHIPPED 2026-02-13</summary>

See `.planning/milestones/v1.7-ROADMAP.md` for full details.

**Delivered:** Modular iOS-style settings architecture with hub-and-subpage navigation, three-way theme toggle, per-category notification preferences, and offline storage management. 32/32 requirements satisfied.

- Phase 35: Settings Shell and Route Structure (2 plans)
- Phase 36: Profile, Security, and Regional Formats (1 plan)
- Phase 37: Appearance and Language (1 plan)
- Phase 38: Data and Storage Management (1 plan)
- Phase 39: Notification Preferences (2 plans)

</details>

### v1.8 Docker Deployment (In Progress)

**Milestone Goal:** Production-ready Docker Compose deployment with clean dev/prod separation, optimized container images, and HTTPS reverse proxy.

#### Phase 40: Compose Profiles and Environment
**Goal**: Developer runs `docker compose up` for dev and `docker compose --profile prod up` for full production stack with proper isolation
**Depends on**: Nothing (first phase of milestone)
**Requirements**: COMP-01, COMP-02, COMP-03, COMP-04, COMP-05, ENV-01, ENV-02, ENV-03
**Success Criteria** (what must be TRUE):
  1. Running `docker compose up` starts only Postgres and Redis with ports exposed to host
  2. Running `docker compose --profile prod up` starts the full stack (Postgres, Redis, backend, worker, scheduler, frontend, Angie) with prod Postgres isolated from dev
  3. Docspell services only start under the prod profile, not during dev
  4. Database migrations run and complete before backend/worker/scheduler accept traffic in prod
  5. Prod containers use production environment variables (NODE_ENV=production, no debug flags, no dev credentials) and photo storage persists via named volume
**Plans**: 1 plan

Plans:
- [ ] 40-01-PLAN.md — Compose profiles, prod Postgres isolation, and environment variable cleanup

#### Phase 41: Container Images
**Goal**: Each service builds into its own optimized, minimal container image via separate Dockerfiles
**Depends on**: Phase 40 (compose structure must exist for image testing)
**Requirements**: IMG-01, IMG-02, IMG-03, IMG-04
**Success Criteria** (what must be TRUE):
  1. Server image builds via Dockerfile.server (Go builder + Alpine runtime) with libwebp for photo processing
  2. Frontend image builds via Dockerfile (bun install/build + Node slim runner) with Next.js standalone output
  3. Worker has its own Dockerfile.worker — builds only the worker binary, includes only needed runtime dependencies (no libwebp if not required)
  4. Scheduler has its own Dockerfile.scheduler — builds only the scheduler binary with its runtime dependencies
**Plans**: 1 plan

Plans:
- [ ] 41-01-PLAN.md — Split backend into per-service Dockerfiles and update compose references

#### Phase 42: Reverse Proxy and End-to-End Validation
**Goal**: Angie reverse proxy routes all traffic correctly with HTTPS, and the full production stack works end-to-end
**Depends on**: Phase 40, Phase 41 (needs compose structure and working images)
**Requirements**: PROXY-01, PROXY-02, PROXY-03, PROXY-04
**Success Criteria** (what must be TRUE):
  1. Accessing the prod stack via HTTPS serves the frontend app, and API requests at /api/* reach the backend
  2. SSE connections (notifications, sync events) work through the proxy without premature timeout or buffering
  3. A self-signed certificate is generated via provided script and used by Angie for HTTPS
  4. HTTP requests on port 80 redirect to HTTPS on port 443
**Plans**: 1 plan

Plans:
- [x] 42-01-PLAN.md — Harden SSE proxy settings, add Angie healthcheck, validate end-to-end

## Progress

| Phase | Milestone | Plans | Status | Shipped |
|-------|-----------|-------|--------|---------|
| 1-5 | v1 | 14 | Complete | 2026-01-24 |
| 6-11 | v1.1 | 12 | Complete | 2026-01-25 |
| 12-17 | v1.2 | 19 | Complete | 2026-01-25 |
| 18-21 | v1.3 | 22 | Complete | 2026-01-31 |
| 22-26 | v1.4 | 20 | Complete | 2026-01-31 |
| 27-29 | v1.5 | 9 | Complete | 2026-02-03 |
| 30-34 | v1.6 | 9 | Complete | 2026-02-08 |
| 35-39 | v1.7 | 7 | Complete | 2026-02-13 |
| 40 | v1.8 | 1 | Complete | 2026-02-14 |
| 41 | v1.8 | 1 | Complete | 2026-02-14 |
| 42 | v1.8 | 1 | Complete | 2026-02-14 |

**Total:** 42 phases complete (115 plans executed) across 8 milestones

---
*Roadmap created: 2026-01-24*
*Last updated: 2026-02-14 after phase 42 completion*
