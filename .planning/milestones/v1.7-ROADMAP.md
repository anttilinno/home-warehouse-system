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

### v1.7 Modular Settings (In Progress)

**Milestone Goal:** Restructure the monolithic settings page into an iOS-style hub-and-subpage architecture with dedicated routes, adding three-way theme selection, per-category notification preferences, and client-side storage management.

#### Phase 35: Settings Shell and Route Structure
**Goal**: Users can navigate to a settings hub that shows organized groups of settings with subpage navigation
**Depends on**: Phase 34 (builds on v1.6 settings page)
**Requirements**: HUB-01, HUB-02, HUB-03, HUB-04, HUB-05, HUB-06
**Success Criteria** (what must be TRUE):
  1. User sees a settings landing page with iOS-style grouped rows showing icons, labels, descriptions, and chevrons for each settings category
  2. Each settings row displays a live preview of the current value (e.g., "Dark", "English", "DD/MM/YYYY") pulled from actual user preferences
  3. Settings are organized into visible sections: Profile card at top, Preferences group (Appearance, Language, Regional Formats), System & Security group (Security, Notifications, Data & Storage)
  4. On desktop, a persistent sidebar navigation is visible alongside the settings content; on mobile, the hub page serves as the navigation entry point
  5. Tapping any subpage and pressing back returns the user to the settings hub, and all navigation labels are translated in en, et, and ru
**Plans:** 2 plans
Plans:
- [x] 35-01-PLAN.md — Settings shell infrastructure (components, layout, i18n keys)
- [x] 35-02-PLAN.md — Hub page rewrite with live previews and 7 stub subpages
**Status:** Complete (2026-02-13)

#### Phase 36: Profile, Security, and Regional Formats
**Goal**: Users can manage their profile, security settings, and regional format preferences on dedicated subpages using existing components
**Depends on**: Phase 35 (route structure and layout must exist)
**Requirements**: PROF-01, PROF-02, PROF-03, SECU-01, SECU-02, SECU-03, FMTS-01, FMTS-02, FMTS-03
**Success Criteria** (what must be TRUE):
  1. User can navigate to a Profile subpage and edit their name, email, and avatar -- the same functionality as before, now on its own page
  2. The settings hub profile card displays the user's current avatar, full name, and email address
  3. User can navigate to a Security subpage and change their password, view/revoke active sessions, and delete their account -- all existing functionality relocated
  4. User can navigate to a Regional Formats subpage and configure date format, time format, and number format preferences -- all existing functionality relocated
**Plans:** 1 plan
Plans:
- [x] 36-01-PLAN.md — Wire existing settings components into profile, security, and regional-formats subpages
**Status:** Complete (2026-02-13)

#### Phase 37: Appearance and Language
**Goal**: Users can choose a visual theme (light, dark, or system) and language preference that persist across devices
**Depends on**: Phase 35 (route structure must exist)
**Requirements**: APPR-01, APPR-02, APPR-03, APPR-04, APPR-05, LANG-01, LANG-02
**Success Criteria** (what must be TRUE):
  1. User sees a three-way theme selector (Light, Dark, System) on the Appearance subpage and selecting an option changes the app theme instantly without page reload
  2. The CSS dark mode variant fix is applied (Tailwind v4 `:where` selector) so dark utilities work correctly on `<html>` and `<body>` elements
  3. User's theme preference persists to the backend so logging in on a different device loads the same theme, and the theme loads without a flash of the wrong theme on page load
  4. User can navigate to a Language subpage and select from the three available languages (en, et, ru), with the language preference persisted to the backend for cross-device sync
**Plans:** 1 plan
Plans:
- [x] 37-01-PLAN.md — ThemeSettings + LanguageSettings components, CSS dark mode fix, theme sync on login
**Status:** Complete (2026-02-13)

#### Phase 38: Data and Storage Management
**Goal**: Users can see their offline storage usage, manage cached data, trigger syncs, and access import/export functionality from a dedicated subpage
**Depends on**: Phase 35 (route structure must exist)
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, DATA-05
**Success Criteria** (what must be TRUE):
  1. User sees a storage usage display with progress bar showing IndexedDB and cache size on the Data & Storage subpage
  2. User can clear offline cache via a button that shows a confirmation dialog before deleting data, and can see persistent storage status with an option to request persistent storage from the browser
  3. User can trigger a manual sync and see the last-sync timestamp displayed on the page
  4. User can access import/export (backup/restore) functionality from the Data & Storage subpage -- the existing backup/restore feature relocated here
**Plans:** 1 plan
Plans:
- [x] 38-01-PLAN.md — Storage usage, cache management, sync controls, and backup/restore on data-storage subpage
**Status:** Complete (2026-02-13)

#### Phase 39: Notification Preferences
**Goal**: Users can control which categories of in-app notifications they receive, with preferences persisted to the backend
**Depends on**: Phase 35 (route structure must exist)
**Requirements**: NOTF-01, NOTF-02, NOTF-03, NOTF-04, NOTF-05
**Success Criteria** (what must be TRUE):
  1. User sees a master toggle to enable/disable all in-app notifications, and per-category toggles for Loans, Inventory, Workspace, and System notifications
  2. Toggle changes auto-save immediately without an explicit submit button -- the user flips a toggle and the preference is persisted
  3. Notification preferences are stored in the backend (JSONB column on auth.users) and sync across devices -- disabling "Loans" notifications on one device applies everywhere
  4. Notification preferences filter alert surfacing only -- SSE data sync continues regardless of preference settings so real-time data updates are never interrupted
**Plans:** 2 plans
Plans:
- [x] 39-01-PLAN.md — Backend: migration, Go entity/handler/service/repository for notification_preferences JSONB
- [x] 39-02-PLAN.md — Frontend: Switch toggles, notification preferences component, page wiring, i18n, dropdown filtering
**Status:** Complete (2026-02-13)

## Progress

**Execution Order:**
Phases execute in numeric order: 35 -> 36 -> 37 -> 38 -> 39

| Phase | Milestone | Plans | Status | Shipped |
|-------|-----------|-------|--------|---------|
| 1-5 | v1 | 14 | Complete | 2026-01-24 |
| 6-11 | v1.1 | 12 | Complete | 2026-01-25 |
| 12-17 | v1.2 | 19 | Complete | 2026-01-25 |
| 18-21 | v1.3 | 22 | Complete | 2026-01-31 |
| 22-26 | v1.4 | 20 | Complete | 2026-01-31 |
| 27-29 | v1.5 | 9 | Complete | 2026-02-03 |
| 30-34 | v1.6 | 9 | Complete | 2026-02-08 |
| 35. Settings Shell | v1.7 | 2 | Complete | 2026-02-13 |
| 36. Profile, Security, Formats | v1.7 | 1 | Complete | 2026-02-13 |
| 37. Appearance and Language | v1.7 | 1 | Complete | 2026-02-13 |
| 38. Data and Storage | v1.7 | 1 | Complete | 2026-02-13 |
| 39. Notification Preferences | v1.7 | 2 | Complete | 2026-02-13 |

**Total:** 39 phases complete (114 plans executed)

---
*Roadmap created: 2026-01-24*
*Last updated: 2026-02-13 after Phase 39 execution*
