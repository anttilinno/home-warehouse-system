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
- 📋 **v2.0 Retro Frontend** — Phases 48-55 (planned)

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

### 📋 v2.0 Retro Frontend (Planned)

**Milestone Goal:** Build a second standalone frontend (`/frontend2`) with a retro industrial game UI aesthetic -- Vite + React 19 + Tailwind CSS 4 + React Router v7, custom component library, 1:1 feature parity foundation (auth, dashboard, settings), i18n EN + ET, online-only.

- [x] **Phase 48: Project Scaffold** - Vite + React 19 project with routing, Tailwind retro tokens, Lingui i18n, and backend proxy (completed 2026-04-09)
- [x] **Phase 49: Auth & API Client** - Login, register, logout, route protection, and JWT-based API client (completed 2026-04-10)
- [x] **Phase 50: Design System** - Ten retro-styled components (buttons, panels, inputs, cards, dialogs, tables, tabs, toasts, badges) with demo page (completed 2026-04-14)
- [x] **Phase 51: App Layout** - Retro sidebar navigation, top bar, mobile-responsive shell, loading states, and error boundaries (completed 2026-04-11)
- [x] **Phase 52: Dashboard** - HUD-style inventory stats, retro terminal activity feed, and quick-access action cards (completed 2026-04-14)
- [x] **Phase 53: Settings Hub** - Eight settings subpages with retro panel navigation (profile, security, appearance, language, formats, notifications, data) (completed 2026-04-11)
- [x] **Phase 54: v2.0 Tech Debt — Code Fixes** - Sidebar nav entries, AuthContext error handling, DataPage null-guard, type fixes, i18n, and component consistency (completed 2026-04-14)
- [ ] **Phase 55: v2.0 Validation & Requirements Cleanup** - Nyquist VALIDATION.md for phases 48–53, requirements file section fixes, checkbox sign-off, and traceability table

## Phase Details

### Phase 48: Project Scaffold
**Goal**: A working Vite + React 19 development environment with routing, retro design tokens, i18n extraction, and backend API proxy
**Depends on**: Nothing (first phase of v2.0)
**Requirements**: SCAF-01, SCAF-02, SCAF-03, SCAF-04
**Success Criteria** (what must be TRUE):
  1. Running `bun run dev` in `/frontend2` starts a Vite dev server that proxies API requests to the Go backend
  2. Navigating between at least two placeholder routes works via React Router v7 (library mode) without full page reloads
  3. Tailwind utility classes using retro design tokens (e.g., `bg-retro-cream`, `border-retro-thick`) render correctly in the browser
  4. A test string wrapped in Lingui `t` macro renders in English by default and Estonian when locale is switched
**Plans:** 2/2 plans complete
Plans:
- [x] 48-01-PLAN.md — Scaffold Vite + React 19 project with Tailwind CSS 4 retro design tokens
- [x] 48-02-PLAN.md — React Router v7 routing, Lingui i18n, and placeholder pages

### Phase 49: Auth & API Client
**Goal**: Users can log in, register, and log out, with protected routes redirecting unauthenticated visitors to the login page
**Depends on**: Phase 48
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05
**Success Criteria** (what must be TRUE):
  1. User can log in with email and password and land on an authenticated page
  2. User visiting a protected route without a session is redirected to the login page
  3. User can register a new account and be logged in automatically
  4. User can log out from the app and is returned to the login page
  5. API client automatically refreshes expired JWT tokens via HttpOnly cookie without user action
**Plans**: TBD
**UI hint**: yes

### Phase 50: Design System
**Goal**: A complete set of retro-styled UI primitives that all feature pages build on, visually validated through a demo page
**Depends on**: Phase 48
**Requirements**: DS-01, DS-02, DS-03, DS-04, DS-05, DS-06, DS-07, DS-08, DS-09, DS-10
**Success Criteria** (what must be TRUE):
  1. All ten retro components (Button, Panel, Input, Card, Dialog, Table, Tabs, Toast, Badge, HazardStripe) render with thick outlines, beveled borders, and industrial styling
  2. RetroButton shows distinct visual states for default, hover, and pressed, with color variants (primary, danger, neutral)
  3. RetroInput displays monospace text, icon prefixes, and inline validation error states
  4. The `/demo` page showcases every component with interactive states, serving as a living style guide
  5. Components accept standard props (className, children, disabled, etc.) and compose cleanly with each other
**Plans**: TBD
**UI hint**: yes

### Phase 51: App Layout
**Goal**: Users navigate the app through a retro-styled sidebar and top bar that adapts to mobile screens, with consistent loading and error states
**Depends on**: Phase 49, Phase 50
**Requirements**: LAY-01, LAY-02, LAY-03
**Success Criteria** (what must be TRUE):
  1. Authenticated users see a sidebar with navigation links and a top bar with user info, styled in the retro industrial aesthetic
  2. On mobile viewports, the sidebar collapses into a hamburger menu or bottom navigation that preserves the retro look
  3. Route transitions show a retro-styled loading indicator, and uncaught errors display a retro error boundary page instead of a white screen
**Plans:** 2/2 plans complete
Plans:
- [x] 51-01-PLAN.md — Test stubs + layout components (Sidebar, TopBar, LoadingBar, ErrorBoundaryPage)
- [x] 51-02-PLAN.md — AppShell assembly + mobile drawer + route restructure
**UI hint**: yes

### Phase 52: Dashboard
**Goal**: Users land on a retro HUD-style dashboard showing inventory stats, recent activity, and quick-access actions
**Depends on**: Phase 51
**Requirements**: DASH-01, DASH-02, DASH-03
**Success Criteria** (what must be TRUE):
  1. User sees a dashboard with retro HUD panels displaying total items, categories, and locations counts from the API
  2. A retro terminal-styled activity feed shows the most recent inventory actions (adds, edits, loans)
  3. Quick-access cards for "Add Item", "Scan Barcode", and "View Loans" are visible and navigate to their respective routes
**Plans**: TBD
**UI hint**: yes

### Phase 53: Settings Hub
**Goal**: Users can manage all account and app preferences through eight retro-styled settings subpages
**Depends on**: Phase 51
**Requirements**: SET-01, SET-02, SET-03, SET-04, SET-05, SET-06, SET-07, SET-08
**Success Criteria** (what must be TRUE):
  1. Settings hub displays eight grouped navigation rows (profile, security, appearance, language, formats, notifications, data) with retro panel styling
  2. User can edit their name, email, and avatar from the Profile subpage and see changes persist after page reload
  3. User can change their password and view active sessions from the Security subpage
  4. Appearance toggle switches between retro-light and retro-dark themes, and Language toggle switches between English and Estonian with all UI strings updating
  5. Regional Formats, Notifications, and Data subpages render their respective preference controls and save changes to the API
**Plans**: TBD
**UI hint**: yes

### Phase 54: v2.0 Tech Debt — Code Fixes
**Goal**: Close all actionable code-level tech debt from the v2.0 audit: complete sidebar navigation, harden auth error handling, fix type correctness, and ensure i18n and component consistency
**Depends on**: Phase 53
**Gap Closure**: Closes audit integration gap (Sidebar → /items + /loans) and 5 code-level tech debt items
**Success Criteria** (what must be TRUE):
  1. Sidebar shows 4 NavLinks: DASHBOARD, ITEMS, LOANS, SETTINGS
  2. AuthContext only clears refresh token on explicit auth errors (401/403), not transient network failures
  3. DataPage export/import buttons are disabled when `workspaceId` is null/undefined
  4. `lib/types.ts` `entity_name` typed as `string | null` matching backend contract
  5. NotFoundPage strings wrapped in `t` macro and present in EN + ET catalogs
  6. AuthCallbackPage uses `<HazardStripe>` component instead of inline div
  7. All settings pages import `useToast` from the barrel (`@/components/retro`)
**Plans**: 2 plans
Plans:
- [x] 54-01-PLAN.md — Nav + Auth hardening: Sidebar ITEMS/LOANS links, HttpError class, AuthContext 401/403-only token clear, DataPage null-guard
- [x] 54-02-PLAN.md — i18n + Type + Consistency: entity_name type fix, NotFoundPage t macro + catalogs, AuthCallbackPage HazardStripe, barrel imports for useToast

### Phase 55: v2.0 Validation & Requirements Cleanup
**Goal**: Bring Nyquist validation status current for all v2.0 phases, fix the requirements file to accurately reflect v2.0 scope, and mark all verified requirements as complete
**Depends on**: Phase 54
**Gap Closure**: Closes Nyquist gaps for phases 48–53 and fixes requirements documentation gaps from audit
**Success Criteria** (what must be TRUE):
  1. Phase 48 has a VALIDATION.md with `nyquist_compliant: true`
  2. Phases 49, 50, 52, 53 VALIDATION.md frontmatter updated to `nyquist_compliant: true` with sign-off date
  3. Requirements file Design System section lists DS-01 through DS-10 (not SYNC-01–04)
  4. Requirements file Dashboard section lists DASH-01 through DASH-03 (not COMP-01–04)
  5. All 33 v2.0 requirement checkboxes checked `[x]` (SCAF, AUTH, DS, LAY, DASH, SET)
  6. Traceability table includes all v2.0 REQ-IDs mapped to their phases with status Complete
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 48 -> 49 -> 50 -> 51 -> 52 -> 53
(Note: Phase 49 and 50 depend only on 48, so could run in parallel if desired.)

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
| 48. Scaffold | v2.0 | 2/2 | Complete    | 2026-04-09 |
| 49. Auth & API Client | v2.0 | 2/2 | Complete   | 2026-04-10 |
| 50. Design System | v2.0 | 0/TBD | Not started | - |
| 51. App Layout | v2.0 | 2/2 | Complete   | 2026-04-11 |
| 52. Dashboard | v2.0 | 0/TBD | Not started | - |
| 53. Settings Hub | v2.0 | 3/3 | Complete   | 2026-04-11 |
| 54. Tech Debt Code Fixes | v2.0 | 2/2 | Complete   | 2026-04-14 |
| 55. Validation & Requirements Cleanup | v2.0 | 0/TBD | Not started | - |

**Total:** 47 phases complete (130 plans executed) across 10 milestones + 8 phases planned for v2.0

---
*Roadmap created: 2026-01-24*
*Last updated: 2026-04-08 after Phase 48 planning (2 plans created)*
