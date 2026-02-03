# Roadmap: Home Warehouse System

## Milestones

- v1 **PWA Offline Completion** — Phases 1-5 (shipped 2026-01-24)
- v1.1 **Offline Entity Extension** — Phases 6-11 (shipped 2026-01-25)
- v1.2 **Phase 2 Completion** — Phases 12-17 (shipped 2026-01-25)
- v1.3 **Mobile UX Overhaul** — Phases 18-21 (shipped 2026-01-31)
- v1.4 **Test Overhaul** — Phases 22-26 (shipped 2026-01-31)
- v1.5 **Settings Enhancement** — Phases 27-29 (shipped 2026-02-03)

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

### v1.5 Settings Enhancement (In Progress)

**Milestone Goal:** Complete user settings experience with profile management, security controls, and account lifecycle.

#### Phase 27: Account Settings
**Goal**: Users can manage their profile and personalize their experience
**Depends on**: None (new feature area)
**Requirements**: ACCT-01, ACCT-02, ACCT-03
**Success Criteria** (what must be TRUE):
  1. User can view and edit their full name from the settings page
  2. User can change their email address from the settings page
  3. User can upload an avatar image that displays in the app header
  4. User can select a date format preference that persists across sessions
  5. Date format preference is applied throughout the application
**Plans**: 3 plans

Plans:
- [x] 27-01-PLAN.md — Backend avatar and email update support
- [x] 27-02-PLAN.md — Frontend account settings UI with avatar upload
- [x] 27-03-PLAN.md — Date format preference and application-wide formatting

#### Phase 28: Security Settings
**Goal**: Users can manage password and control active sessions
**Depends on**: Phase 27 (settings page infrastructure)
**Requirements**: SEC-01, SEC-02, SEC-03, SEC-04
**Success Criteria** (what must be TRUE):
  1. User can change their password by providing current password and new password
  2. User can view a list of all active sessions showing device type and last activity
  3. User can revoke any individual session, logging out that device
  4. User can log out all other sessions at once, keeping only current session active
**Plans**: 4 plans

Plans:
- [x] 28-01-PLAN.md — Password change UI (frontend)
- [x] 28-02-PLAN.md — Sessions database infrastructure (migration + sqlc)
- [x] 28-03-PLAN.md — Sessions backend (service + handler + auth flow integration)
- [x] 28-04-PLAN.md — Active sessions UI with revocation

#### Phase 29: Account Deletion
**Goal**: Users can permanently delete their account with appropriate safeguards
**Depends on**: Phase 27 (settings page infrastructure)
**Requirements**: ACCT-04
**Success Criteria** (what must be TRUE):
  1. User can initiate account deletion from settings page
  2. User must confirm deletion with explicit action (type confirmation text or similar)
  3. Deletion removes all user data and logs user out
  4. Deletion is prevented if user is sole owner of any workspace
**Plans**: 2 plans

Plans:
- [x] 29-01-PLAN.md — Backend account deletion with sole owner validation
- [x] 29-02-PLAN.md — Frontend delete account dialog with type-to-confirm

## Progress

| Phase | Milestone | Plans | Status | Shipped |
|-------|-----------|-------|--------|---------|
| 1-5 | v1 | 14 | Complete | 2026-01-24 |
| 6-11 | v1.1 | 12 | Complete | 2026-01-25 |
| 12-17 | v1.2 | 19 | Complete | 2026-01-25 |
| 18-21 | v1.3 | 22 | Complete | 2026-01-31 |
| 22-26 | v1.4 | 20 | Complete | 2026-01-31 |
| 27 | v1.5 | 3 | Complete | 2026-02-03 |
| 28 | v1.5 | 4 | Complete | 2026-02-03 |
| 29 | v1.5 | 2 | Complete | 2026-02-03 |

**Total:** 29 phases complete (96 plans executed), v1.5 milestone complete

---
*Roadmap created: 2026-01-24*
*Last updated: 2026-02-03 after Phase 29 complete - v1.5 milestone shipped*
