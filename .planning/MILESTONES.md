# Project Milestones: Home Warehouse System

## v1.5 Settings Enhancement (Shipped: 2026-02-03)

**Delivered:** Complete user settings experience with profile management, security controls, and account lifecycle.

**Phases completed:** 27-29 (9 plans total)

**Key accomplishments:**

- User profile management — avatar upload with 150x150 thumbnails, name/email editing, Chi router multipart handling
- Date format personalization — user preference stored in database, applied throughout app via useDateFormat hook
- Password change UI — react-hook-form with zod validation, 8+ character requirement, current password verification
- Session tracking infrastructure — database schema for active sessions with device info and IP addresses
- Active sessions UI — view all sessions, revoke individual sessions, logout all other devices
- Account deletion with safeguards — type-to-confirm ("DELETE"), sole owner validation prevents orphaned workspaces

**Stats:**

- 63 files created/modified
- ~6,855 lines of TypeScript/Go
- 3 phases, 9 plans
- 1 day (Feb 3, 2026)

**Git range:** `e030519` → `ef7d626` (30+ commits)

**Requirements satisfied:** 8/8 (100%)
- ACCT-01 through ACCT-04: All satisfied
- SEC-01 through SEC-04: All satisfied

**Tech debt carried forward:**
- None significant

**What's next:** TBD — ready for next milestone

---

## v1.4 Test Overhaul (Shipped: 2026-01-31)

**Delivered:** Comprehensive test infrastructure and coverage bringing critical packages to 80%+ with CI parallelization, Codecov integration, and stable E2E tests.

**Phases completed:** 22-26 (20 plans executed of 24 planned)

**Key accomplishments:**

- Go test factories for 8 entity types with functional options pattern and gofakeit integration
- Backend business logic coverage: importexport 92.4%, importjob 86.3%, itemphoto 80.5%, repairlog 92.8%
- Frontend unit tests: 130 new tests for useOfflineMutation, SyncManager, MultiStepForm, BarcodeScanner, FloatingActionButton
- CI parallelization with matrix strategy and Codecov coverage reporting with README badge
- E2E auth timing fixed with proper wait conditions; 25 waitForTimeout calls removed from high-risk files
- Inventory E2E tests (18 tests) and loan CRUD flow tests (4 serial tests) added

**Stats:**

- 139 files created/modified
- ~33,500 lines of test code (TypeScript/Go)
- 5 phases, 20 plans executed
- 1 day (Jan 31, 2026)

**Git range:** `feat(22-01)` → `docs(26-04)` (60+ commits)

**Requirements satisfied:** 14/17 (82%)
- INFRA-01 through INFRA-05: All satisfied
- BE-01, BE-03, BE-05, BE-06: All satisfied (80%+ coverage)
- FE-01 through FE-05: All satisfied
- E2E-01 through E2E-03: All satisfied

**Tech debt carried forward:**
- BE-02: pendingchange at 57.3% (handler.go tested via integration, not unit tests)
- BE-04: jobs at 20.1% (architectural constraint — ProcessTask requires database mocking)
- API-03: 24-03 validation tests plan not executed
- 56 waitForTimeout calls remain in 24 lower-priority E2E files
- Go test factories orphaned (not adopted by Phase 23/24 tests)

**What's next:** TBD — ready for next milestone

---

## v1.3 Mobile UX Overhaul (Shipped: 2026-01-31)

**Delivered:** Warehouse-grade mobile experience with barcode scanning, offline fuzzy search, floating action buttons with radial menus, and mobile-optimized multi-step forms.

**Phases completed:** 18-21 (22 plans total)

**Key accomplishments:**

- Offline fuzzy search via Fuse.js — instant results despite typos, IndexedDB-backed, 300ms debounce
- Barcode/QR scanning — camera-based with audio/haptic feedback, quick action menu, scan history
- Floating action button — radial menu, context-aware actions, haptic feedback, ios-haptics integration
- Mobile form improvements — progressive disclosure, smart defaults, draft auto-save, 44px touch targets
- Create Item wizard — 3-step flow with inline photo capture and iOS keyboard handling

**Stats:**

- ~40 files created/modified
- ~4,822 lines of TypeScript
- 4 phases, 22 plans
- 2 days from start to ship (Jan 30-31, 2026)

**Git range:** `feat(18-01)` → `feat(21-07)` (67 commits)

**Tech debt carried forward:**
- Move action shows "Coming soon" in scanner quick actions
- SelectableListItem ready but not integrated into list views
- Physical device testing pending for scanner

**What's next:** TBD — ready for next feature work

---

## v1.2 Phase 2 Completion (Shipped: 2026-01-25)

**Delivered:** Enhanced item lifecycle management with repair tracking, declutter assistant, async thumbnail processing, bulk photo operations, and comprehensive SSE test coverage.

**Phases completed:** 12-17 (19 plans total)

**Key accomplishments:**

- Repair log tracking with full lifecycle — photos, attachments, warranty claims, maintenance reminders
- Declutter assistant — unused item detection, scoring, grouping by category/location, CSV export
- Background thumbnail processing via Asynq — async generation, WebP output, multiple sizes
- Bulk photo operations — multi-select, bulk delete/caption, zip download, duplicate detection
- SSE test coverage — 47 tests across 11 handlers with EventCapture pattern
- Import testing checklist — 8 comprehensive manual test scenarios

**Stats:**

- 80 files created/modified
- ~9,000 lines of TypeScript/Go (net +8,948)
- 6 phases, 19 plans
- 1 day from start to ship (Jan 25, 2026)

**Git range:** `88d19c7` → `b702771` (41 commits)

**Tech debt carried forward:**
- Linear retry delay in thumbnail processing (vs exponential backoff)
- No VERIFICATION.md for Phase 17 (tests serve as verification)

**What's next:** v1.3 Mobile UX Overhaul — scanning, search, quick actions

---

## v1.1 Offline Entity Extension (Shipped: 2026-01-25)

**Delivered:** Offline create/update support for all core entities (borrowers, categories, locations, containers, inventory) with dependency-aware sync ordering and conflict history UI.

**Phases completed:** 6-11 (12 plans total)

**Key accomplishments:**

- Dependency-aware sync infrastructure with `dependsOn` field for prerequisite tracking
- Entity-type ordered sync processing (categories → locations → borrowers → containers → items → inventory)
- Topological sort (Kahn's algorithm) for hierarchical entities (categories, locations)
- Cross-entity dependency tracking for containers→locations and inventory→items/locations/containers
- Conflict history UI at `/dashboard/sync-history` with entity type and date range filtering
- Offline mutations for 5 entity types with optimistic UI and pending indicators

**Stats:**

- 25 files created/modified
- ~6,800 lines of TypeScript (net +4,700)
- 6 phases, 12 plans
- 2 days from start to ship (Jan 24-25, 2026)

**Git range:** `aaff4f3` → `3b4b6a8`

**Tech debt carried forward:**
- E2E tests blocked by auth setup timeout (test code correct, infrastructure issue)
- Modal edit and move dialog features not implemented
- Bulk status update uses direct API (not offline-enabled)

**What's next:** TBD — milestone complete, ready for next feature work

---

## v1 PWA Offline Completion (Shipped: 2026-01-24)

**Delivered:** Complete offline capabilities for the PWA — users can view all workspace data and create/update items while offline, with automatic sync on reconnection.

**Phases completed:** 1-5 (14 plans total)

**Key accomplishments:**

- IndexedDB offline storage with 8 entity stores and typed CRUD operations
- Mutation queue with UUIDv7 idempotency keys, exponential backoff retry, and 7-day TTL
- Conflict resolution with critical field detection (inventory quantity/status) and last-write-wins for non-critical
- PWA screenshots (1080x1920 mobile, 1920x1080 desktop) for install prompts
- Item forms migrated to offline mutation hooks with optimistic UI and pending indicators
- 17+ E2E tests covering offline flows, sync behavior, and multi-tab scenarios

**Stats:**

- 29 files created/modified
- ~5,200 lines of TypeScript
- 5 phases, 14 plans
- 2 days from start to ship (Jan 22-24, 2026)

**Git range:** `5c56812` → `b87dce7`

**Tech debt carried forward:**
- Conflict history UI not exposed (getConflictLog function exists)
- Safari iOS manual testing pending

**What's next:** TBD — milestone complete, ready for next feature work

---

## v1.7 Modular Settings (Shipped: 2026-02-13)

**Delivered:** Modular iOS-style settings architecture with hub-and-subpage navigation, three-way theme toggle, per-category notification preferences, and offline storage management.

**Phases completed:** 35-39 (7 plans, 17 tasks)

**Key accomplishments:**

- iOS-style settings hub with grouped rows, live preview values, and responsive sidebar/mobile navigation
- Three-way theme selector (light/dark/system) with instant switching, CSS dark mode fix (:where selector), and cross-device persistence via ThemeSyncer
- Dedicated subpages for Profile, Security, Regional Formats, Language -- existing features relocated to modular architecture
- Data & Storage management with offline storage usage display, cache clearing, persistent storage controls, and manual sync
- Per-category notification preferences (backend JSONB + frontend toggles) with auto-save and client-side dropdown filtering
- All labels translated in English, Estonian, and Russian

**Stats:**

- 60 files created/modified
- +6,739 / -379 lines of TypeScript/Go
- 5 phases, 7 plans, 17 tasks
- 1 day (Feb 13, 2026)

**Git range:** `feat(35-01)` → `docs(39-02)` (16 feature commits)

**Requirements satisfied:** 32/32 (100%)
- HUB-01 through HUB-06: All satisfied
- PROF-01 through PROF-03: All satisfied
- SECU-01 through SECU-03: All satisfied
- FMTS-01 through FMTS-03: All satisfied
- APPR-01 through APPR-05: All satisfied
- LANG-01, LANG-02: All satisfied
- DATA-01 through DATA-05: All satisfied
- NOTF-01 through NOTF-05: All satisfied

**Tech debt carried forward:**
- None from v1.7

**What's next:** TBD -- ready for next milestone

---


## v1.8 Docker Deployment (Shipped: 2026-02-14)

**Delivered:** Production-ready Docker Compose deployment with dev/prod profile separation, per-service optimized container images, and Angie HTTPS reverse proxy with SSE support.

**Phases completed:** 40-42 (3 plans, 6 tasks)

**Key accomplishments:**

- Dev/prod compose profile separation — `docker compose up` for infra only, `--profile prod` for full stack with isolated postgres-prod
- Per-service Dockerfiles — server and scheduler with CGO/libwebp, worker as pure Go (CGO_ENABLED=0) saving ~30MB
- Angie reverse proxy with HTTPS — self-signed certs, HTTP→HTTPS redirect, SSE proxy hardening (HTTP/1.1, no buffering/caching)
- Production environment hardening — required JWT_SECRET, parameterized credentials, NODE_ENV=production, no debug flags

**Stats:**

- 5 files created/modified
- 3 Dockerfiles + compose + angie config
- 3 phases, 3 plans, 6 tasks
- 1 day (Feb 14, 2026)

**Git range:** `7d12773a` → `31d9aeae` (7 feature commits)

**Requirements satisfied:** 16/16 (100%)
- COMP-01 through COMP-05: All satisfied
- IMG-01 through IMG-04: All satisfied
- PROXY-01 through PROXY-04: All satisfied
- ENV-01 through ENV-03: All satisfied

**Tech debt carried forward:**
- None from v1.8

**What's next:** TBD — ready for next milestone

---

