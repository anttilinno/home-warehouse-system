# Roadmap: Home Warehouse System

## Milestones

- [x] **v1 PWA Offline Completion** — Phases 1-5 (shipped 2026-01-24)
- [x] **v1.1 Offline Entity Extension** — Phases 6-11 (shipped 2026-01-25)
- [x] **v1.2 Phase 2 Completion** — Phases 12-17 (shipped 2026-01-25)
- [x] **v1.3 Mobile UX Overhaul** — Phases 18-21 (shipped 2026-01-31)
- [x] **v1.4 Test Overhaul** — Phases 22-26 (shipped 2026-01-31)
- [x] **v1.5 Settings Enhancement** — Phases 27-29 (shipped 2026-02-03)
- [x] **v1.6 Format Personalization** — Phases 30-34 (shipped 2026-02-08)
- [x] **v1.7 Modular Settings** — Phases 35-39 (shipped 2026-02-13)
- [x] **v1.8 Social Login** — Phases 40-42 (shipped 2026-02-22)
- [x] **v1.9 Quick Capture** — Phases 43-47 (shipped 2026-03-14)
- [x] **v2.0 Retro Frontend** — Phases 48-55 (shipped 2026-04-14)
- [x] **v2.1 Feature Parity — Items, Loans & Scanning** — Phases 56-63 (shipped 2026-04-17)
- [ ] **v2.2 Scanning & Stabilization** — Phases 64-72 (active)

## Phases

<details>
<summary>[x] v1 PWA Offline Completion (Phases 1-5) — SHIPPED 2026-01-24</summary>

See `.planning/MILESTONES.md` for full details.

**Delivered:** Complete offline capabilities for PWA - view workspace data and create/update items while offline with automatic sync.

- Phase 1: IndexedDB Setup (3 plans)
- Phase 2: Mutation Queue Infrastructure (3 plans)
- Phase 3: Conflict Resolution (2 plans)
- Phase 4: Sync Manager & iOS Fallback (3 plans)
- Phase 5: Item Form Migration (3 plans)

</details>

<details>
<summary>[x] v1.1 Offline Entity Extension (Phases 6-11) — SHIPPED 2026-01-25</summary>

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
<summary>[x] v1.2 Phase 2 Completion (Phases 12-17) — SHIPPED 2026-01-25</summary>

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
<summary>[x] v1.3 Mobile UX Overhaul (Phases 18-21) — SHIPPED 2026-01-31</summary>

See `.planning/milestones/v1.3-ROADMAP.md` for full details.

**Delivered:** Warehouse-grade mobile experience with barcode scanning, offline fuzzy search, floating action buttons with radial menus, and mobile-optimized multi-step forms.

- Phase 18: Fuzzy Search Infrastructure (4 plans)
- Phase 19: Barcode Scanning (6 plans)
- Phase 20: Mobile Navigation - FAB and Gestures (5 plans)
- Phase 21: Mobile Form Improvements (7 plans)

</details>

<details>
<summary>[x] v1.4 Test Overhaul (Phases 22-26) — SHIPPED 2026-01-31</summary>

See `.planning/milestones/v1.4-ROADMAP.md` for full details.

**Delivered:** Comprehensive test infrastructure and coverage with 82% requirements satisfied (14/17). Go test factories, backend coverage to 80%+ for 4 packages, 130 frontend unit tests, E2E auth stability, and CI parallelization with Codecov.

- Phase 22: Test Infrastructure Setup (3 plans)
- Phase 23: Backend Business Logic Tests (6 plans executed, 2 gap plans deferred)
- Phase 24: Backend API Testing (2 plans executed, 1 plan deferred)
- Phase 25: Frontend Unit Testing (5 plans)
- Phase 26: E2E Stability and Coverage (4 plans)

</details>

<details>
<summary>[x] v1.5 Settings Enhancement (Phases 27-29) — SHIPPED 2026-02-03</summary>

See `.planning/milestones/v1.5-ROADMAP.md` for full details.

**Delivered:** Complete user settings experience with profile management (avatar, email, name), security controls (password change, session management), and account lifecycle (deletion with safeguards).

- Phase 27: Account Settings (3 plans)
- Phase 28: Security Settings (4 plans)
- Phase 29: Account Deletion (2 plans)

</details>

<details>
<summary>[x] v1.6 Format Personalization (Phases 30-34) — SHIPPED 2026-02-08</summary>

**Delivered:** Complete format personalization system with user preferences for date format, time format, and number format. All display sites, CSV exports, and inputs respect user's chosen formats.

- Phase 30: Format Infrastructure (2 plans)
- Phase 31: Format Settings UI (2 plans)
- Phase 32: Date Format Rollout (2 plans)
- Phase 33: Time Format Rollout (1 plan)
- Phase 34: Number Format Rollout (2 plans)

</details>

<details>
<summary>[x] v1.7 Modular Settings (Phases 35-39) — SHIPPED 2026-02-13</summary>

See `.planning/milestones/v1.7-ROADMAP.md` for full details.

**Delivered:** Modular iOS-style settings architecture with hub-and-subpage navigation, three-way theme toggle, per-category notification preferences, and offline storage management. 32/32 requirements satisfied.

- Phase 35: Settings Shell and Route Structure (2 plans)
- Phase 36: Profile, Security, and Regional Formats (1 plan)
- Phase 37: Appearance and Language (1 plan)
- Phase 38: Data and Storage Management (1 plan)
- Phase 39: Notification Preferences (2 plans)

</details>

<details>
<summary>[x] v1.8 Social Login (Phases 40-42) — SHIPPED 2026-02-22</summary>

See `.planning/milestones/v1.8-ROADMAP.md` for full details.

**Delivered:** Google and GitHub OAuth login alongside email/password authentication, with auto-linking by verified email, connected accounts management in Security settings, full i18n support, and offline-aware social login buttons. 25/25 requirements satisfied.

- [x] Phase 40: Database Migration and Backend OAuth Core (3 plans)
- [x] Phase 41: Frontend OAuth Flow and Connected Accounts (2 plans)
- [x] Phase 42: Error Handling, Internationalization, and Offline Polish (2 plans)

</details>

<details>
<summary>[x] v1.9 Quick Capture (Phases 43-47) — SHIPPED 2026-03-14</summary>

See `.planning/milestones/v1.9-ROADMAP.md` for full details.

**Delivered:** Camera-first rapid item entry for mobile bulk onboarding with full offline support and "needs details" completion workflow. 16/16 requirements satisfied.

- [x] Phase 43: Backend Schema and Needs Review API (2 plans)
- [x] Phase 44: Capture Infrastructure (2 plans)
- [x] Phase 45: Quick Capture UI (2 plans)
- [x] Phase 46: Photo Sync Pipeline (1 plan)
- [x] Phase 47: Completion Workflow and Polish (2 plans)

</details>

<details>
<summary>[x] v2.0 Retro Frontend (Phases 48-55) — SHIPPED 2026-04-14</summary>

**Delivered:** Standalone `/frontend2` (Vite + React 19 + Tailwind CSS 4 + React Router v7) with retro industrial aesthetic: auth, design system, layout, dashboard, settings hub. 33/33 requirements satisfied.

- [x] Phase 48: Project Scaffold (2 plans)
- [x] Phase 49: Auth & API Client (2 plans)
- [x] Phase 50: Design System (3 plans)
- [x] Phase 51: App Layout (2 plans)
- [x] Phase 52: Dashboard (2 plans)
- [x] Phase 53: Settings Hub (3 plans)
- [x] Phase 54: Tech Debt Code Fixes (2 plans)
- [x] Phase 55: Validation & Requirements Cleanup (2 plans)

</details>

<details>
<summary>[x] v2.1 Feature Parity — Items, Loans & Scanning (Phases 56-63) — SHIPPED 2026-04-17</summary>

See `.planning/milestones/v2.1-ROADMAP.md` for full details.

**Delivered:** Brought `/frontend2` to core feature parity — items, photos, loans, borrowers, hierarchical taxonomy, full navigation wiring. Online-only, lean. Barcode scanning deferred to v2.2.

- Phase 56: Foundation — API Client & React Query (4 plans)
- Phase 57: Retro Form Primitives (3 plans)
- Phase 58: Taxonomy (4 plans)
- Phase 59: Borrowers CRUD (4 plans)
- Phase 60: Items CRUD (2 plans)
- Phase 61: Item Photos (5 plans)
- Phase 62: Loans (4 plans)
- Phase 63: Navigation & Polish (1 plan)

</details>

### v2.2 Scanning & Stabilization (Phases 64-72) — ACTIVE

Barcode scanning + mobile FAB brought to `/frontend2` at full v1.3 parity, wired into Loans and Quick Capture, with accumulated verification/coverage/hygiene debt from v1.9–v2.1 closed.

- [ ] **Phase 64: Scanner Foundation & Scan Page** — Scanner primitives, hooks, API, and the live `/scan` route with camera preview, torch, manual fallback, and scan history
- [ ] **Phase 65: Item Lookup & Not-Found Flow** — Barcode → workspace-item lookup, not-found → create-item handoff with barcode prefill, optional external UPC enrichment
- [ ] **Phase 66: Quick-Action Menu** — Post-scan action overlay with default actions and state-adaptive behavior (archived / loaned / needs-review)
- [ ] **Phase 67: Mobile FAB with Radial Menu** — Context-aware floating action button mounted in AppShell with safe-area handling
- [ ] **Phase 68: Loan Scan Integration** — Loan action from scan menu preselects item on `/loans/new`
- [ ] **Phase 69: Quick Capture Port + Scan Integration** — Quick Capture ported to `/frontend2` with scan-to-autofill, auto-SKU, sticky batch settings, and Needs Review wiring
- [ ] **Phase 70: Taxonomy Cascade Policy** — Category / location delete warns with item count and requires explicit "Unassign and delete" confirmation
- [ ] **Phase 71: Stabilization — Docs & Process (Gap Closure)** — VERIFICATION.md backfill for v2.1 phases 58/59/60, `/demo` sign-off for Phase 57, Nyquist retroactive validation for v1.9 phases 43–47
- [ ] **Phase 72: Stabilization — Code & Tests (Gap Closure)** — pendingchange coverage ≥80%, jobs ProcessTask baseline, zero `waitForTimeout`, Vitest zero-failing

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

### Phase 64: Scanner Foundation & Scan Page
**Goal**: A live `/scan` route where a user sees a rear-camera viewfinder, can scan supported barcode formats with audio/haptic/visual feedback, toggle the torch on Android, fall back to manual entry, and view recent scan history — with scanner primitives, hooks, and API client in place for downstream integrations
**Depends on**: Phase 63 (v2.1 close — /scan stub route, retro primitives, TanStack Query)
**Requirements**: SCAN-01, SCAN-02, SCAN-03, SCAN-04, SCAN-05, SCAN-06, SCAN-07
**Success Criteria** (what must be TRUE):
  1. User visits `/scan` and sees a live rear-camera preview with retro scan overlay; the scanner stays mounted across overlays (no navigation-induced permission re-prompt on iOS PWA)
  2. User pointing the camera at a QR, UPC-A, EAN-13, or Code128 code decodes it within a second and hears an audio beep, feels a haptic pulse (iOS via `ios-haptics`, Android via `navigator.vibrate`), and sees a visual flash
  3. User on an Android device sees a torch toggle that turns the flashlight on/off; the toggle is hidden on iOS and desktops without `MediaStreamTrack.getCapabilities().torch`
  4. User can switch to a "Manual" tab and submit a typed barcode string when the camera is unavailable or permission is denied
  5. User sees a History tab listing the last 10 scanned codes with timestamps, can tap any entry to re-lookup, and can clear the whole history after a confirm prompt
**Plans**: TBD
**UI hint**: yes

### Phase 65: Item Lookup & Not-Found Flow
**Goal**: Scanned codes resolve to workspace items via the existing list endpoint with an exact-match guard; when no match exists, the user is handed off to create a new item with the barcode (and optional UPC metadata) pre-filled
**Depends on**: Phase 64
**Requirements**: LOOK-01, LOOK-02, LOOK-03
**Success Criteria** (what must be TRUE):
  1. When the scanned code matches an item in the current workspace, the user sees the matched item's name and identifier (via `GET /api/workspaces/{wsId}/items?search={code}&limit=1` with an exact-barcode guard), and the frontend asserts the returned `workspace_id` matches the session before rendering
  2. When no workspace item matches, the user sees a "Not found" result with a "Create item with this barcode" action that lands on `/items/new?barcode=<code>` with the barcode field pre-filled
  3. For codes matching `/^\d{8,14}$/`, the item-create form shows an opt-in suggestion banner with name/brand/category from `GET /api/barcode/{code}`; the user must explicitly accept to prefill those fields (never auto-written)
**Plans**: TBD
**UI hint**: yes

### Phase 66: Quick-Action Menu
**Goal**: After a successful scan, the user sees a post-scan action overlay that stays on `/scan` (scanner paused but mounted) and adapts to the matched item's state so only relevant actions are shown
**Depends on**: Phase 65
**Requirements**: QA-01, QA-02, QA-03
**Success Criteria** (what must be TRUE):
  1. After a successful scan that resolves to a workspace item, the user sees a quick-action overlay sheet while the scanner remains paused-but-mounted (no navigation away from `/scan`)
  2. The overlay shows "View Item", "Loan", and "Back to Scan" actions by default, each navigating/acting correctly
  3. The overlay adapts to item state: "Loan" is hidden when the item is on an active loan; "Unarchive" replaces "Loan" for archived items; "Mark Reviewed" is shown when the item is flagged `needs_review`
**Plans**: TBD
**UI hint**: yes

### Phase 67: Mobile FAB with Radial Menu
**Goal**: A context-aware floating action button mounted once in `AppShell`, visible on mobile viewports across key routes, offering route-appropriate actions in a radial menu with proper safe-area handling
**Depends on**: Phase 63 (AppShell) — can parallelize with Phases 64–66 once `/scan` stub already exists; live scan destination firms up when Phase 64 ships
**Requirements**: FAB-01, FAB-02, FAB-03, FAB-04
**Success Criteria** (what must be TRUE):
  1. On mobile viewports, the user sees a floating action button in the bottom-right of Dashboard, Items, Loans, Borrowers, and Taxonomy routes, positioned above iOS `safe-area-inset-bottom`
  2. Tapping the FAB opens a radial menu of context-aware actions per route (e.g. Items shows Scan / Add Item / Quick Capture; Loans shows New Loan / Scan)
  3. The radial menu closes on outside-tap, ESC keypress, or action selection; all transitions use CSS only (no `motion` dependency)
  4. The FAB is hidden on `/scan`, `/auth/*`, and whenever a modal or drawer is open
**Plans**: TBD
**UI hint**: yes

### Phase 68: Loan Scan Integration
**Goal**: From a scan quick-action menu, the user can start a loan with the scanned item already selected in the loan-create form
**Depends on**: Phase 66 (quick-action menu "Loan" button) + existing `LoanForm` from v2.1
**Requirements**: INT-LOAN-01
**Success Criteria** (what must be TRUE):
  1. User on `/scan` taps "Loan" on the quick-action menu for a matched item and lands on `/loans/new?itemId=<id>` with the item preselected in the loan-create form
  2. The loan-create form reads `itemId` from URL search params and initializes the item picker with the correct item; submitting creates a valid loan without re-picking the item
**Plans**: TBD
**UI hint**: yes

### Phase 69: Quick Capture Port + Scan Integration
**Goal**: Quick Capture (camera-first rapid item entry, v1.9 parity) is available in `/frontend2`, with a scan button that autofills the barcode field and with captured items flagged `needs_review` and filterable in the items list
**Depends on**: Phase 64 (scanner primitives for the inline scan button)
**Requirements**: INT-QC-01, INT-QC-02, INT-QC-03, INT-QC-04
**Success Criteria** (what must be TRUE):
  1. User can navigate to a Quick Capture route in `/frontend2` and see a camera-first rapid-entry UI with photo capture + name entry + save-reset loop
  2. Quick Capture auto-generates SKUs in the format `QC-{timestamp}-{random}` and persists sticky batch settings (category, location) within the session
  3. Within Quick Capture, tapping a scan button opens an inline scanner that, on successful decode, autofills the item's barcode field without overwriting a user-typed SKU
  4. Items created via Quick Capture are flagged `needs_review` in the backend and surface under a "Needs Review" filter chip on the items list (with a one-tap "Mark Reviewed" affordance on item detail)
**Plans**: TBD
**UI hint**: yes

### Phase 70: Taxonomy Cascade Policy
**Goal**: Deleting a category or location that still has items assigned is never a silent cascade — the user sees the impact and explicitly confirms the unassign-and-delete action
**Depends on**: Phase 58 (v2.1 taxonomy) — independent of scanner track
**Requirements**: CASC-01
**Success Criteria** (what must be TRUE):
  1. When deleting a category or location with assigned items, the user sees a warning showing the count of affected items and must choose between "Cancel" and "Unassign items and delete"
  2. Choosing "Unassign items and delete" removes the category/location and un-sets the foreign key on affected items (no orphaned FKs, no silent cascade)
  3. Choosing "Cancel" leaves the taxonomy entry and items untouched
**Plans**: TBD
**UI hint**: yes

### Phase 71: Stabilization — Docs & Process (Gap Closure)
**Goal**: Retroactive verification debt from v1.9 and v2.1 is closed with real evidence (test-run artifacts, live `/demo` visits, commit SHAs) — not memory reconstruction or plausible-sounding prose
**Depends on**: Nothing (fully parallelizable with Phases 64–70)
**Gap Closure**: Closes VERIFICATION.md gap for v2.1 phases 58/59/60, 8 unsigned `/demo` checkpoints for Phase 57, and Nyquist partial status for v1.9 phases 43–47
**Requirements**: STAB-DOCS-01, STAB-DOCS-02, STAB-DOCS-03, STAB-DOCS-04, STAB-DOCS-05
**Success Criteria** (what must be TRUE):
  1. Phase 58 (Taxonomy), Phase 59 (Borrowers), and Phase 60 (Items) each have a VERIFICATION.md produced from an actual verification pass, with every REQ citing commit SHA + test path + live-check evidence
  2. Phase 57's 8 `/demo` retro-primitive checkpoints each have a signed-off entry referencing an actual live `/demo` visit (screenshots or notes of rendered state — not speculative)
  3. v1.9 Phases 43–47 have Nyquist validation completed via `/gsd:validate-phase 43-47` with recorded commit SHAs and confirmation that phase-era file paths still resolve
  4. No backfilled VERIFICATION.md file contains empty evidence cells or references code paths that don't exist at the original phase's commit
**Plans**: TBD

### Phase 72: Stabilization — Code & Tests (Gap Closure)
**Goal**: Backend coverage debt on pendingchange and jobs is closed with behavioral tests (not status-code-only), and the frontend test hygiene debt (waitForTimeout, pre-existing Vitest failures) is eliminated
**Depends on**: Nothing (fully parallelizable with Phases 64–70)
**Gap Closure**: Closes v1.4 tech debt on pendingchange (57.3% → ≥80%) and jobs (20.1% → actionable baseline); closes v1.4 hygiene debt on 56 `waitForTimeout` calls and 4 pre-existing Vitest failures
**Requirements**: STAB-CODE-01, STAB-CODE-02, STAB-CODE-03, STAB-CODE-04
**Success Criteria** (what must be TRUE):
  1. Backend `internal/domain/syncpush/pendingchange/handler.go` has test coverage ≥80% with assertions on DB state changes, response body, and emitted events — not just `status == 200` (requires interface extraction for mockability)
  2. Backend `internal/jobs/ProcessTask` has an actionable coverage baseline: dependencies extracted behind an interface, Asynq client mocked, and at least one behavioral test per task type
  3. The Cypress/Playwright E2E suite contains zero `cy.wait(number)` or `waitForTimeout(ms)` calls (all replaced with event-driven waits like `cy.intercept().as()` or `page.waitForResponse`)
  4. The Vitest suite runs with zero failing tests — the 4 currently failing in `frontend/lib/api/__tests__/client.test.ts` and `use-offline-mutation.test.ts` are either fixed or explicitly skipped with a `TODO(v2.3)` reason
**Plans**: TBD

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
| 43-47 | v1.9 | 9 | Complete | 2026-03-14 |
| 48-55 | v2.0 | 18 | Complete | 2026-04-14 |
| 56-63 | v2.1 | 29 | Complete | 2026-04-17 |
| 64 | v2.2 | 0/? | Not started | - |
| 65 | v2.2 | 0/? | Not started | - |
| 66 | v2.2 | 0/? | Not started | - |
| 67 | v2.2 | 0/? | Not started | - |
| 68 | v2.2 | 0/? | Not started | - |
| 69 | v2.2 | 0/? | Not started | - |
| 70 | v2.2 | 0/? | Not started | - |
| 71 | v2.2 | 0/? | Not started | - |
| 72 | v2.2 | 0/? | Not started | - |

**Total:** 63 phases complete (177 plans executed) across 12 milestones; v2.2 (Phases 64-72) active

---
*Roadmap created: 2026-01-24*
*Last updated: 2026-04-18 — v2.2 Scanning & Stabilization phases appended (Phases 64-72)*
