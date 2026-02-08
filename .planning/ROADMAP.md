# Roadmap: Home Warehouse System

## Milestones

- v1 **PWA Offline Completion** — Phases 1-5 (shipped 2026-01-24)
- v1.1 **Offline Entity Extension** — Phases 6-11 (shipped 2026-01-25)
- v1.2 **Phase 2 Completion** — Phases 12-17 (shipped 2026-01-25)
- v1.3 **Mobile UX Overhaul** — Phases 18-21 (shipped 2026-01-31)
- v1.4 **Test Overhaul** — Phases 22-26 (shipped 2026-01-31)
- v1.5 **Settings Enhancement** — Phases 27-29 (shipped 2026-02-03)
- v1.6 **Format Personalization** — Phases 30-34 (in progress)

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

### v1.6 Format Personalization (In Progress)

**Milestone Goal:** All dates, times, and numbers display according to user's chosen format preferences throughout the entire application.

#### Phase 30: Format Infrastructure
**Goal**: User preferences for time and number formats are persisted and accessible to the frontend via hooks
**Depends on**: Phase 29 (extends v1.5 user preferences infrastructure)
**Requirements**: TIME-01, TIME-02, NUM-01, NUM-02, NUM-03, SETTINGS-05
**Success Criteria** (what must be TRUE):
  1. User's time format preference (12-hour or 24-hour) is stored in the database and returned by the user profile API
  2. User's number format preferences (thousand separator, decimal separator) are stored in the database and returned by the user profile API
  3. Frontend hooks useTimeFormat and useNumberFormat are available and return the user's persisted preferences
  4. Hooks fall back to sensible defaults (24-hour time, comma thousands, period decimal) when no preference is set
**Plans:** 2 plans
**Status:** Complete (2026-02-08)

Plans:
- [x] 30-01-PLAN.md -- Backend migration and API for time/number format preferences
- [x] 30-02-PLAN.md -- Frontend hooks useTimeFormat and useNumberFormat

#### Phase 31: Format Settings UI
**Goal**: Users can configure all format preferences from a single settings page with immediate visual feedback
**Depends on**: Phase 30
**Requirements**: SETTINGS-01, SETTINGS-02, SETTINGS-03, SETTINGS-04, TIME-05, NUM-09
**Success Criteria** (what must be TRUE):
  1. User can select time format (12-hour or 24-hour) in settings and see a live preview of the current time in their chosen format
  2. User can select thousand separator (comma, period, space) and decimal separator (period, comma) in settings with live preview of a sample number
  3. Date format settings section is enhanced with live preview consistent with the time and number sections
  4. All format changes persist immediately and apply across the app without page reload
**Plans:** 2 plans
**Status:** Complete (2026-02-08)

Plans:
- [x] 31-01-PLAN.md -- TimeFormatSettings component + wire date/time format cards to settings page
- [x] 31-02-PLAN.md -- NumberFormatSettings component with separator conflict validation + complete settings page integration

#### Phase 32: Date Format Rollout
**Goal**: Every date displayed, entered, or exported in the application respects the user's chosen date format
**Depends on**: Phase 31 (settings UI must exist so users can change format)
**Requirements**: DATE-01, DATE-02, DATE-03, DATE-04, DATE-05, DATE-06, DATE-07, DATE-08, DATE-09, DATE-10
**Success Criteria** (what must be TRUE):
  1. User who sets DD/MM/YYYY sees dates in that format in all tables, cards, lists, and detail pages throughout the app
  2. Date input placeholders and date picker behavior match the user's chosen format (e.g., DD/MM/YYYY user sees "dd/mm/yyyy" placeholder, and typing "25/01/2026" is parsed correctly)
  3. DateTime displays (timestamps like "created at", "last modified") format the date portion per user's preference while preserving the time portion
  4. Form validation messages reference the user's chosen format (e.g., "Please enter a date in DD/MM/YYYY format")
  5. CSV/export downloads format all date columns according to the user's preference
**Plans:** 2 plans
**Status:** Complete (2026-02-08)

Plans:
- [x] 32-01-PLAN.md -- Extend useDateFormat hook + convert all display sites and CSV exports
- [x] 32-02-PLAN.md -- Date input format hints and validation messages

#### Phase 33: Time Format Rollout
**Goal**: Every timestamp displayed or entered in the application respects the user's chosen time format
**Depends on**: Phase 30 (useTimeFormat hook must exist)
**Requirements**: TIME-03, TIME-04
**Success Criteria** (what must be TRUE):
  1. User who selects 12-hour format sees all timestamps with AM/PM (e.g., "2:30 PM" instead of "14:30") across tables, detail pages, and activity feeds
  2. Time input fields adapt to the user's format -- 12-hour users see AM/PM selectors, 24-hour users see 00-23 range
**Plans:** 1 plan
**Status:** Complete (2026-02-08)

Plans:
- [x] 33-01-PLAN.md -- Fix formatDateTime time-awareness + convert all datetime display sites

#### Phase 34: Number Format Rollout
**Goal**: Every number displayed or entered in the application respects the user's chosen number format
**Depends on**: Phase 30 (useNumberFormat hook must exist)
**Requirements**: NUM-04, NUM-05, NUM-06, NUM-07, NUM-08
**Success Criteria** (what must be TRUE):
  1. User who sets period as thousand separator and comma as decimal sees "1.234,56" for prices and quantities throughout the app
  2. Inventory counts, quantities, prices, and dashboard statistics all use the user's number format consistently
  3. Number input fields accept values typed in the user's format (e.g., European user can type "1.234,56" and it parses correctly)
**Plans**: TBD

Plans:
- [ ] 34-01: Number format applied to all display components (counts, quantities, prices, stats)
- [ ] 34-02: Number input parsing respects user format

## Progress

**Execution Order:**
Phases execute in numeric order: 30 -> 31 -> 32 -> 33 -> 34

| Phase | Milestone | Plans | Status | Shipped |
|-------|-----------|-------|--------|---------|
| 1-5 | v1 | 14 | Complete | 2026-01-24 |
| 6-11 | v1.1 | 12 | Complete | 2026-01-25 |
| 12-17 | v1.2 | 19 | Complete | 2026-01-25 |
| 18-21 | v1.3 | 22 | Complete | 2026-01-31 |
| 22-26 | v1.4 | 20 | Complete | 2026-01-31 |
| 27-29 | v1.5 | 9 | Complete | 2026-02-03 |
| 30. Format Infrastructure | v1.6 | 2/2 | Complete | 2026-02-08 |
| 31. Format Settings UI | v1.6 | 2/2 | Complete | 2026-02-08 |
| 32. Date Format Rollout | v1.6 | 2/2 | Complete | 2026-02-08 |
| 33. Time Format Rollout | v1.6 | 1/1 | Complete | 2026-02-08 |
| 34. Number Format Rollout | v1.6 | 0/2 | Not started | - |

**Total:** 31 phases complete (103 plans executed), 1 phase planned (2 plans)

---
*Roadmap created: 2026-01-24*
*Last updated: 2026-02-08 after v1.6 roadmap created*
