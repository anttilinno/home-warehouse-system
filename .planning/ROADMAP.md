# Roadmap: Home Warehouse System

## Milestones

- ✅ **v1 PWA Offline Completion** — Phases 1-5 (shipped 2026-01-24)
- ✅ **v1.1 Offline Entity Extension** — Phases 6-11 (shipped 2026-01-25)
- ✅ **v1.2 Phase 2 Completion** — Phases 12-17 (shipped 2026-01-25)
- ✅ **v1.3 Mobile UX Overhaul** — Phases 18-21 (shipped 2026-01-31)
- ✅ **v1.4 Test Overhaul** — Phases 22-26 (shipped 2026-01-31)
- ✅ **v1.5 Settings Enhancement** — Phases 27-29 (shipped 2026-02-03)
- ✅ **v1.6 Format Personalization** — Phases 30-34 (shipped 2026-02-08)
- ✅ **v1.7 Modular Settings** — Phases 35-39 (shipped 2026-02-13)
- ✅ **v1.8 Social Login** — Phases 40-42 (shipped 2026-02-22)
- ✅ **v1.9 Quick Capture** — Phases 43-47 (shipped 2026-03-14)

## Phases

<details>
<summary>✅ v1 PWA Offline Completion (Phases 1-5) — SHIPPED 2026-01-24</summary>

See `.planning/MILESTONES.md` for full details.

**Delivered:** Complete offline capabilities for PWA - view workspace data and create/update items while offline with automatic sync.

- Phase 1: IndexedDB Setup (3 plans)
- Phase 2: Mutation Queue Infrastructure (3 plans)
- Phase 3: Conflict Resolution (2 plans)
- Phase 4: Sync Manager & iOS Fallback (3 plans)
- Phase 5: Item Form Migration (3 plans)

</details>

<details>
<summary>✅ v1.1 Offline Entity Extension (Phases 6-11) — SHIPPED 2026-01-25</summary>

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
<summary>✅ v1.2 Phase 2 Completion (Phases 12-17) — SHIPPED 2026-01-25</summary>

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
<summary>✅ v1.3 Mobile UX Overhaul (Phases 18-21) — SHIPPED 2026-01-31</summary>

See `.planning/milestones/v1.3-ROADMAP.md` for full details.

**Delivered:** Warehouse-grade mobile experience with barcode scanning, offline fuzzy search, floating action buttons with radial menus, and mobile-optimized multi-step forms.

- Phase 18: Fuzzy Search Infrastructure (4 plans)
- Phase 19: Barcode Scanning (6 plans)
- Phase 20: Mobile Navigation - FAB and Gestures (5 plans)
- Phase 21: Mobile Form Improvements (7 plans)

</details>

<details>
<summary>✅ v1.4 Test Overhaul (Phases 22-26) — SHIPPED 2026-01-31</summary>

See `.planning/milestones/v1.4-ROADMAP.md` for full details.

**Delivered:** Comprehensive test infrastructure and coverage with 82% requirements satisfied (14/17). Go test factories, backend coverage to 80%+ for 4 packages, 130 frontend unit tests, E2E auth stability, and CI parallelization with Codecov.

- Phase 22: Test Infrastructure Setup (3 plans)
- Phase 23: Backend Business Logic Tests (6 plans executed, 2 gap plans deferred)
- Phase 24: Backend API Testing (2 plans executed, 1 plan deferred)
- Phase 25: Frontend Unit Testing (5 plans)
- Phase 26: E2E Stability and Coverage (4 plans)

</details>

<details>
<summary>✅ v1.5 Settings Enhancement (Phases 27-29) — SHIPPED 2026-02-03</summary>

See `.planning/milestones/v1.5-ROADMAP.md` for full details.

**Delivered:** Complete user settings experience with profile management (avatar, email, name), security controls (password change, session management), and account lifecycle (deletion with safeguards).

- Phase 27: Account Settings (3 plans)
- Phase 28: Security Settings (4 plans)
- Phase 29: Account Deletion (2 plans)

</details>

<details>
<summary>✅ v1.6 Format Personalization (Phases 30-34) — SHIPPED 2026-02-08</summary>

**Delivered:** Complete format personalization system with user preferences for date format, time format, and number format. All display sites, CSV exports, and inputs respect user's chosen formats.

- Phase 30: Format Infrastructure (2 plans)
- Phase 31: Format Settings UI (2 plans)
- Phase 32: Date Format Rollout (2 plans)
- Phase 33: Time Format Rollout (1 plan)
- Phase 34: Number Format Rollout (2 plans)

</details>

<details>
<summary>✅ v1.7 Modular Settings (Phases 35-39) — SHIPPED 2026-02-13</summary>

See `.planning/milestones/v1.7-ROADMAP.md` for full details.

**Delivered:** Modular iOS-style settings architecture with hub-and-subpage navigation, three-way theme toggle, per-category notification preferences, and offline storage management. 32/32 requirements satisfied.

- Phase 35: Settings Shell and Route Structure (2 plans)
- Phase 36: Profile, Security, and Regional Formats (1 plan)
- Phase 37: Appearance and Language (1 plan)
- Phase 38: Data and Storage Management (1 plan)
- Phase 39: Notification Preferences (2 plans)

</details>

<details>
<summary>✅ v1.8 Social Login (Phases 40-42) — SHIPPED 2026-02-22</summary>

See `.planning/milestones/v1.8-ROADMAP.md` for full details.

**Delivered:** Google and GitHub OAuth login alongside email/password authentication, with auto-linking by verified email, connected accounts management in Security settings, full i18n support, and offline-aware social login buttons. 25/25 requirements satisfied.

- [x] Phase 40: Database Migration and Backend OAuth Core (3 plans)
- [x] Phase 41: Frontend OAuth Flow and Connected Accounts (2 plans)
- [x] Phase 42: Error Handling, Internationalization, and Offline Polish (2 plans)

</details>

<details>
<summary>✅ v1.9 Quick Capture (Phases 43-47) — SHIPPED 2026-03-14</summary>

See `.planning/milestones/v1.9-ROADMAP.md` for full details.

**Delivered:** Camera-first rapid item entry for mobile bulk onboarding with full offline support and "needs details" completion workflow. 16/16 requirements satisfied.

- [x] Phase 43: Backend Schema and Needs Review API (2 plans)
- [x] Phase 44: Capture Infrastructure (2 plans)
- [x] Phase 45: Quick Capture UI (2 plans)
- [x] Phase 46: Photo Sync Pipeline (1 plan)
- [x] Phase 47: Completion Workflow and Polish (2 plans)

</details>

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-5 | v1 | 14 | Complete | 2026-01-24 |
| 6-11 | v1.1 | 12 | Complete | 2026-01-25 |
| 12-17 | v1.2 | 19 | Complete | 2026-01-25 |
| 18-21 | v1.3 | 22 | Complete | 2026-01-31 |
| 22-26 | v1.4 | 20 | Complete | 2026-01-31 |
| 27-29 | v1.5 | 9 | Complete | 2026-02-03 |
| 30-34 | v1.6 | 9 | Complete | 2026-02-08 |
| 35-39 | v1.7 | 7 | Complete | 2026-02-13 |
| 40-42 | v1.8 | 7 | Complete | 2026-02-22 |
| 43 | v1.9 | 2/2 | Complete | 2026-02-27 |
| 44 | v1.9 | 2/2 | Complete | 2026-02-27 |
| 45 | v1.9 | 2/2 | Complete | 2026-02-27 |
| 46 | v1.9 | 1/1 | Complete | 2026-03-14 |
| 47 | v1.9 | 2/2 | Complete | 2026-03-14 |

**Total:** 47 phases complete (130 plans executed) across 10 milestones

---
*Roadmap created: 2026-01-24*
*Last updated: 2026-03-14 after v1.9 milestone completion*
