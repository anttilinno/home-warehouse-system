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
- [~] **v2.2 Scanning & Stabilization** — Phases 64-66 (abandoned 2026-04-30; frontend2 wiped before completion)
- [ ] **v3.0 Premium-Terminal Frontend** — Phases 1-17 (planning, 2026-04-30; numbering reset since v2.2 wiped)

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

<details>
<summary>[~] v2.2 Scanning & Stabilization (Phases 64-72) — ABANDONED 2026-04-30 (frontend2 wiped before completion; planning artifacts archived under `.planning/milestones/v2.2-phases-abandoned/`)</summary>

Barcode scanning + mobile FAB brought to `/frontend2` at full v1.3 parity, wired into Loans and Quick Capture, with accumulated verification/coverage/hygiene debt from v1.9–v2.1 closed. Phase 64 + 65 shipped before the wipe; phases 66-72 never started. Phase Details below preserved for archaeology only — they no longer apply to v3.0.

- [x] **Phase 64: Scanner Foundation & Scan Page** — Scanner primitives, hooks, API, and the live `/scan` route with camera preview, torch, manual fallback, and scan history
- [x] **Phase 65: Item Lookup & Not-Found Flow** — Barcode → workspace-item lookup, not-found → create-item handoff with barcode prefill, optional external UPC enrichment (all 11 plans shipped; G-65-01 gap closure complete with Plan 65-11 landing Option C: Playwright E2E + Go HTTP+Postgres integration test — two matched regression guards, either fix reverted fails a test)
- [ ] **Phase 66: Quick-Action Menu** — Post-scan action overlay with default actions and state-adaptive behavior (archived / loaned / needs-review)
- [ ] **Phase 67: Mobile FAB with Radial Menu** — Context-aware floating action button mounted in AppShell with safe-area handling
- [ ] **Phase 68: Loan Scan Integration** — Loan action from scan menu preselects item on `/loans/new`
- [ ] **Phase 69: Quick Capture Port + Scan Integration** — Quick Capture ported to `/frontend2` with scan-to-autofill, auto-SKU, sticky batch settings, and Needs Review wiring
- [ ] **Phase 70: Taxonomy Cascade Policy** — Category / location delete warns with item count and requires explicit "Unassign and delete" confirmation
- [ ] **Phase 71: Stabilization — Docs & Process (Gap Closure)** — VERIFICATION.md backfill for v2.1 phases 58/59/60, `/demo` sign-off for Phase 57, Nyquist retroactive validation for v1.9 phases 43–47
- [ ] **Phase 72: Stabilization — Code & Tests (Gap Closure)** — pendingchange coverage ≥80%, jobs ProcessTask baseline, zero `waitForTimeout`, Vitest zero-failing

</details>

### v3.0 Premium-Terminal Frontend (Phases 1-17) — ACTIVE

Clean-slate rebuild of `/frontend2` with sketch 005 premium-terminal fidelity AND feature parity with the legacy `/frontend`. Phase numbering RESETS to start at 1 — v3.0 has no continuity with v2.2 (predecessor wiped). Online-only (CI grep-guarded). All 106 v3.0 requirements (FOUND/TOKEN/SHELL/BAR/PROV/AUTH/ITEM/LOAN/BORR/TAX/SCAN/SETT/DASH/I18N/SYS/TUI/POL) map to exactly one phase. Layout primitives precede retro atoms — predecessor's reverse order forced atom rebuilds twice.

- [ ] **Phase 1: Foundation + Conflict Spikes** — Vite + React 19 + TS + Tailwind 4 + RR7 scaffold, CI grep guard, carry-forward audit, three Phase 0 conflict resolutions (i18n library / mobile FAB scope / dashboard backend rollups)
- [ ] **Phase 2: Tokens + Type System** — `styles/tokens.css` palette + Tailwind v4 `@theme` block + JetBrains Mono Variable + scanline body overlay + WCAG AAA contrast audit + Cyrillic glyph metrics check
- [ ] **Phase 3: Layout Primitives + Bottombar** — AppShell 2×3 grid + TopBar + Sidebar (`// GROUP` labels + collapse-to-rail) + Bottombar with `useShortcuts` SSOT + `isEditableTarget` input-focus guard from first commit + PageHeader (`// ROUTE` + SESSION + LAST SYNC) + ShortcutChip + mobile breakpoint contract
- [ ] **Phase 4: Retro Atoms** — RetroPanel/Button/Badge/Input/Select/Combobox/Textarea/Checkbox/FileInput/FormField/Table family/Tabs/Dialog/ConfirmDialog/Toast/EmptyState/Pagination/StatusDot/HUD primitives — informed by Phase 3 layout constraints; modal-stack ESC, status pills with tabular-nums, SSE state in panel headers, multi-select Shift+Click on tables
- [ ] **Phase 5: Auth** — login + register + Google OAuth + GitHub OAuth + RequireAuth (with v2.0 spurious-logout-on-network-error bug fixed) + workspace switcher + sessions + password change + account deletion + connected accounts
- [ ] **Phase 6: Providers** — IntlProvider + QueryClientProvider + AuthProvider + SSEProvider (with `useSSEStatus()` selector) + ToastProvider + ShortcutsProvider mounted in canonical order; chrome wires to real state once
- [ ] **Phase 7: Items + Photos** — paginated list with search/filter/sort + detail with photo gallery + create/edit/archive/delete + multipart photo upload + `itemsApi.lookupByBarcode` (G-65-01 regression-guard pattern) + per-route `useShortcuts` registration
- [ ] **Phase 8: Loans** — Active/Overdue/History tabbed list + create with item + borrower picker + mark returned + edit + per-item active+history panels + `?itemId=` deep-link param
- [ ] **Phase 9: Borrowers** — flat paginated list + CRUD with active-loan delete guard + detail with active+history panels
- [ ] **Phase 10: Taxonomy** — categories tree + locations tree + containers grouped by location + create/edit/archive with usage warnings + container delete with unassign-and-delete cascade policy
- [ ] **Phase 11: Scan (single-route)** — `/scan` with `<BarcodeScanner>` mounted ONCE + QR/UPC/EAN/Code128 + pause-on-match (prop-driven) + Android torch + manual fallback + AudioContext + ios-haptics + scan history (last 10) + 4-state result banner + post-match quick-action overlay + UPC opt-in suggestion prefill
- [ ] **Phase 12: Settings hub** — landing with 8 grouped rows + Profile + Security + Appearance + Language + Regional Formats + Notifications + Connected Accounts + Data Storage (online-only — clear cache + export + import only)
- [ ] **Phase 13: Dashboard** — 4 stat tiles + activity table (TUI columns, relative <24h then absolute) + side rail (Pending Approvals + System Alerts) + HUD row (gauge + sparkline + counts) gated behind `VITE_FEATURE_HUD_ROLLUPS` flag (Conflict 3 resolution)
- [ ] **Phase 14: System group** — Approvals + My Changes + Sync History + Imports/Exports — all activity-table style with bulk operations dispatched via Bottombar
- [ ] **Phase 15: i18n catalog gap-fill (et + ru)** — extract en messages, translate to et + ru (lift from legacy `/frontend` next-intl + v2.1 Lingui archive), locale switcher, format hooks (`useDateFormat`/`useTimeFormat`/`useNumberFormat`) used everywhere
- [ ] **Phase 16: Command Palette** — Cmd+K / F2 cmdk surface filtering across routes, recent actions, and workspaces; keyboard-first navigation
- [ ] **Phase 17: Polish & Quality** — Playwright E2E + Go integration test for every cross-HTTP flow + axe-playwright a11y CI sweep + tab/keyboard navigation audit + bundle size CI guard + mobile breakpoint matrix re-test (320/360/768/1024/1440 px) + visual diff vs sketch 005

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
  2. User pointing the camera at a QR, UPC-A, EAN-13, or Code128 code decodes it within a second, hears an audio beep, sees a visual flash, and — on Android devices only — feels a haptic pulse via `navigator.vibrate` (iOS haptic via `ios-haptics` is deferred out of Phase 64 per CONTEXT.md D-17)
  3. User on an Android device sees a torch toggle that turns the flashlight on/off; the toggle is hidden on iOS and desktops without `MediaStreamTrack.getCapabilities().torch`
  4. User can switch to a "Manual" tab and submit a typed barcode string when the camera is unavailable or permission is denied
  5. User sees a History tab listing the last 10 scanned codes with timestamps, can tap any entry to re-lookup, and can clear the whole history after a confirm prompt
**Plans**: 10 plans (10/10 complete)
Plans:
- [x] 64-01-PLAN.md — Wave 0 deps + HazardStripe variant prop (no ios-haptics per D-17)
- [x] 64-02-PLAN.md — Wave 0 Vite manualChunks + test-infra mocks (yudiel-scanner, media-devices)
- [x] 64-03-PLAN.md — Wave 1 lib/scanner 5-file port + feedback/scan-history/init-polyfill unit tests
- [x] 64-04-PLAN.md — Wave 1 lib/api/scan.ts scaffold + useScanLookup stub (Phase 65 shape-lock)
- [x] 64-05-PLAN.md — Wave 2 useScanHistory + useScanFeedback hooks + tests
- [x] 64-06-PLAN.md — Wave 2 BarcodeScanner + ScanViewfinderOverlay + ScanTorchToggle (retro viewfinder trio)
- [x] 64-07-PLAN.md — Wave 2 ManualBarcodeEntry + ScanResultBanner + ScanErrorPanel (4 variants)
- [x] 64-08-PLAN.md — Wave 2 ScanHistoryList + scan-feature test fixtures (SCAN-07 confirm flow)
- [x] 64-09-PLAN.md — Wave 3 ScanPage 3-tab orchestration + components/scan barrel + routes/index.tsx React.lazy
- [x] 64-10-PLAN.md — Wave 4 i18n extract + ET gap-fill + [BLOCKING] bundle gate verification
**UI hint**: yes

### Phase 65: Item Lookup & Not-Found Flow
**Goal**: Scanned codes resolve to workspace items via the existing list endpoint with an exact-match guard; when no match exists, the user is handed off to create a new item with the barcode (and optional UPC metadata) pre-filled
**Depends on**: Phase 64
**Requirements**: LOOK-01, LOOK-02, LOOK-03
**Success Criteria** (what must be TRUE):
  1. When the scanned code matches an item in the current workspace, the user sees the matched item's name and identifier (via `GET /api/workspaces/{wsId}/items?search={code}&limit=1` with an exact-barcode guard), and the frontend asserts the returned `workspace_id` matches the session before rendering
  2. When no workspace item matches, the user sees a "Not found" result with a "Create item with this barcode" action that lands on `/items/new?barcode=<code>` with the barcode field pre-filled
  3. For codes matching `/^\d{8,14}$/`, the item-create form shows an opt-in suggestion banner with name/brand/category from `GET /api/barcode/{code}`; the user must explicitly accept to prefill those fields (never auto-written)
**Plans**: 11/11 complete (01-08 original scope + 09-11 gap closure for G-65-01)
Plans:
- [x] 65-01-PLAN.md — Wave 0 test scaffolds (7 files, 78 it.todo + 2 green) + shared QueryClient test helper + pre-phase bundle baseline (main gzip 135754 B / scanner gzip 58057 B @ b04ae7c)
- [x] 65-02-PLAN.md — Wave 1 itemsApi.lookupByBarcode (D-06/07/08 guards) + schemas.ts D-23 optional brand field + D-24 barcode regex loosened for hyphens/underscores; 10 Wave 0 todos converted green
- [x] 65-03-PLAN.md — Wave 1 lib/api/barcode.ts + barrel export + useBarcodeEnrichment hook with /^\d{8,14}$/ gate + silent failure
- [x] 65-04-PLAN.md — Wave 2 useScanLookup body swap + updateScanHistory + useScanHistory.update (D-22 race guard); 16 new real it() cases (8 useScanLookup + 3 scan-history + 5 useScanHistory.update); ScanPage Test 15 callsite gate preserved
- [x] 65-05-PLAN.md — Wave 2 ItemForm FormProvider wrap + BRAND field (D-23) + UpcSuggestionBanner + ItemFormPage (dirty-guard + D-04 scanKeys.lookup + itemKeys.all dual invalidation); 32 new real it() cases (3 ItemForm BRAND + 13 UpcSuggestionBanner + 19 ItemFormPage — +3 bonus)
- [x] 65-06-PLAN.md — Wave 3 ScanResultBanner widened to 4 states (LOADING/MATCH/NOT-FOUND/ERROR per D-17..D-21) + retro-cursor-blink keyframe with prefers-reduced-motion animation:none guard; 21 new real it() green (5 LOADING + 5 MATCH + 5 NOT-FOUND + 5 ERROR + 1 dual-state sweep T-65-06-03); 7 Phase 64 assertions migrated under MATCH describe; 2 Rule 3 auto-fixes (ScanPage interim callsite + ScanPage test regex migration); full vitest 707 passed / 0 todos
- [x] 65-07-PLAN.md — Wave 4 /items/new route registration (literal-before-param) + ScanPage match-effect wiring (deps [lookup.status, lookup.match, banner?.code, history.update] — NOT [history]) + banner callsite widened (lookupStatus/match/onViewItem/onCreateWithBarcode/onRetry) + handleLookupRetry co-existing with Phase 64 handleRetry + Test 16/17/18 green for D-22 race guard; Test 15 preserved verbatim; full vitest 710 passed / 0 todos; 1 Rule 3 auto-fix (scan-fixture MemoryRouter wrapper)
- [x] 65-08-PLAN.md — Wave 5 Lingui EN extract + ET gap-fill + [BLOCKING] bundle gate PASS (scanner byte-identical to baseline; main chunk SHRANK 21.3 kB gzip); 16 new msgids in EN+ET catalogs (plus 1 Rule 2 CANCEL auto-fix); full suite 710/710; typecheck + lint:imports + i18n:compile + build all clean
- [x] 65-09-PLAN.md — [GAP CLOSURE G-65-01] Wave 6 backend: GET /api/workspaces/{wsId}/items/by-barcode/{code} Huma route + Service.LookupByBarcode (shared.ErrNotFound → ErrItemNotFound normalisation mirrors Service.Delete); route ordered between /items/search and /items/{id} (literal-before-param chi idiom); 3 service subtests + 5 handler subtests green covering 200 happy path, 404 on not-found, 500 on opaque error, 400/422 on maxLength:64 violation (service NOT called), case-sensitivity guard (upper/lower are distinct codes); full item package green; full backend build clean. TDD gate: 2 RED + 2 GREEN commits (`bf33f8d`, `283a6bf`, `e3b31e1`, `59d4e3d`). Plan 65-10 unblocked.
- [x] 65-10-PLAN.md — [GAP CLOSURE G-65-01] Wave 7 frontend: itemsApi.lookupByBarcode swapped from list({search}) wrap to direct get<Item>(/workspaces/{wsId}/items/by-barcode/{encodeURIComponent(code)}) via @/lib/api; HttpError 404 → null, other errors propagate (D-21 ERROR banner fires); D-07 + D-08 defense-in-depth guards retained; test suite REWRITTEN (not migrated) — 6 itemsApi.list-mocked tests discarded with intent, 8 new global.fetch-mocked tests cover URL shape / encodeURIComponent / 200 / 404-null / D-07 / D-08 / 500-propagation. 65-CONTEXT.md D-06 + REQUIREMENTS.md:94 revised with dated ORIGINAL/REVISED annotation pairs. TDD gate: e5227d1 test RED + fbb2907 feat GREEN + 288497d docs + 192000f docs. Vitest 712/712 (exact plan match: 710 baseline − 6 + 8); typecheck + lint:imports + build clean; bundle byte-identical on main (114418 B) + scanner (58057 B at CLRWiLFx). Zero deviations.
- [x] 65-11-PLAN.md — [GAP CLOSURE G-65-01] Wave 8 regression test: Option C chosen (both branches). Branch A = Playwright E2E `frontend2/e2e/scan-lookup.spec.ts` (first Playwright surface in the repo; chromium + firefox projects) logs in via real `/login`, seeds item with unique barcode, `/scan` → MANUAL tab → asserts MATCHED banner. Branch B = Go HTTP+Postgres integration `backend/internal/domain/warehouse/item/handler_integration_test.go` under `//go:build integration` (real svc + real repo via existing `tests/testdb` harness); 3 subtests covering 200 happy path, 404 for never-existed code, and **404 for cross-tenant barcode leak** (the truth the handler unit test cannot assert — mocked service makes "other workspace" and "never existed" indistinguishable). CLAUDE.md (new project-root file) documents both suites. Verified green: Playwright spec passes on chromium+firefox; Go integration passes 3/3 subtests in 0.21s. Commits 5e77f98 (feat Branch A) + 8d4191d (test Branch B). 1 Rule 3 auto-fix (reused `tests/testdb` instead of creating parallel `internal/testutil/integration.go`).
**UI hint**: yes

### Phase 66: Quick-Action Menu
**Goal**: After a successful scan, the user sees a post-scan action overlay that stays on `/scan` (scanner paused but mounted) and adapts to the matched item's state so only relevant actions are shown
**Depends on**: Phase 65
**Requirements**: QA-01, QA-02, QA-03
**Success Criteria** (what must be TRUE):
  1. After a successful scan that resolves to a workspace item, the user sees a quick-action overlay sheet while the scanner remains paused-but-mounted (no navigation away from `/scan`)
  2. The overlay shows "View Item", "Loan", and "Back to Scan" actions by default, each navigating/acting correctly
  3. The overlay adapts to item state: "Loan" is hidden when the item is on an active loan; "Unarchive" replaces "Loan" for archived items; "Mark Reviewed" is shown when the item is flagged `needs_review`
**Plans:** 3 plans
Plans:
- [ ] 66-01-PLAN.md — Wave 1 pre-phase bundle baseline (66-BUNDLE-BASELINE.md) + useMarkReviewedItem mutation hook (D-18) + 5 new EN/ET msgids (LOAN, MARK REVIEWED, UNARCHIVE, BACK TO SCAN, Item marked reviewed.)
- [ ] 66-02-PLAN.md — Wave 2 QuickActionMenu.tsx component (4-state variant + D-16 matrix + RetroDialog lifecycle + gated useLoansForItem probe + internal useMarkReviewedItem/useRestoreItem mutations + structured console.error) + QuickActionMenu.test.tsx (D-16 matrix 6 rows + LOADING/NOT-FOUND/ERROR + LOAN skeleton/hidden + dismiss parity + dual-state sweep, ≥20 tests via TDD RED→GREEN)
- [ ] 66-03-PLAN.md — Wave 3 ScanPage swap (<ScanResultBanner> → <QuickActionMenu>; D-11 setBanner(null)-before-navigate applied to handleViewItem/handleCreateWithBarcode/handleLoan; handleLoan URL /loans/new?itemId=encodeURIComponent(id); handleMarkReviewed/handleUnarchive no-op) + delete ScanResultBanner.tsx + 2 banner test files + remove barrel export + re-run Lingui extract to re-anchor #: comments + [BLOCKING] bundle gate PASS (main ≤ +1024 gzip, scanner ≤ 0 gzip)
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

### Phase 1: Foundation + Conflict Spikes
**Goal**: A working Vite + React 19 + TS + Tailwind 4 + RR7 + TanStack Query scaffold serves a placeholder shell at `localhost:5173`, CI blocks online-only violations, and the three open Phase 0 conflicts (i18n library / mobile FAB scope / dashboard backend rollups) have documented decisions
**Depends on**: Nothing (first phase of v3.0)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, FOUND-06
**Success Criteria** (what must be TRUE):
  1. User running `bun run dev` in `/frontend2` from a freshly scaffolded checkout sees a working Vite + React 19 + TS + Tailwind 4 + RR7 + TanStack Query SPA serving a placeholder shell at `localhost:5173` with API requests proxied to `:8080`
  2. CI fails any PR introducing an `idb`, `serwist`, `offline`, or `sync*` import via `scripts/check-forbidden-imports.mjs`
  3. `.planning/research/CARRY-FORWARD.md` enumerates port-verbatim items (auth flow, OAuth callback, format hooks, Playwright auth helper, grep guard) versus rebuild items (chrome, atoms, layout, providers)
  4. `.planning/research/I18N-DECISION.md` records the empirical Vite-8-+-SWC compat result for Lingui v6 vs react-intl with a locked decision
  5. The mobile-FAB scope decision is recorded in v3.0 milestone scope (drop or keep with safe-area math); the dashboard-backend-rollups decision is recorded (ship feature-flagged or defer to v3.1) with backend coordination kicked off if shipping
**Plans**: TBD

### Phase 2: Tokens + Type System
**Goal**: The premium-terminal palette, monospace typography, scanline overlay, and sharp-corner globals from sketch 005 are loaded into the app via Tailwind v4 `@theme`, with WCAG AAA contrast verified and Cyrillic glyph metrics confirmed
**Depends on**: Phase 1
**Requirements**: TOKEN-01, TOKEN-02, TOKEN-03, TOKEN-04, TOKEN-05
**Success Criteria** (what must be TRUE):
  1. User opening the placeholder shell sees the premium-terminal palette (amber + green dual-channel, near-black backgrounds, panel bevel + scanline overlay + radial vignette) applied globally
  2. Tailwind utility classes like `bg-fg-mid`, `text-fg-bright`, `border-fg-dim` resolve to the locked CSS variables from `default.css`
  3. JetBrains Mono Variable (latin + latin-ext subsets) is self-hosted and renders without flash of fallback font
  4. A repo-resident contrast audit script confirms `--fg-mid`/`--fg-base`/`--fg-bright` against `--bg-panel` meet WCAG AAA, and a `prefers-contrast: more` fallback path is provided
  5. Cyrillic + Estonian glyph metrics in JetBrains Mono produce no column drift in monospace tables (or fallback to IBM Plex Mono is recorded)
**Plans**: TBD
**UI hint**: yes

### Phase 3: Layout Primitives + Bottombar
**Goal**: A user logging in to a placeholder route lands inside the locked sketch 005 chrome — slim brand topbar with workspace pill + ONLINE dot, sidebar with `// GROUP` labels + collapse-to-rail + user menu footer, function-key Bottombar with `[KEY] LABEL` chips + SESSION/LOCAL clocks driven by `useShortcuts(id, [...])` SSOT, page-header with `// ROUTE` breadcrumb + SESSION + LAST SYNC meta — and single-letter shortcuts NEVER fire while the user is typing in an input
**Depends on**: Phase 2
**Requirements**: SHELL-01, SHELL-02, SHELL-03, SHELL-04, SHELL-05, SHELL-06, BAR-01, BAR-02, BAR-03, BAR-04, BAR-05, TUI-01
**Success Criteria** (what must be TRUE):
  1. User on any authenticated route sees the 2×3 CSS-Grid AppShell render TopBar (brand mark + workspace pill + ONLINE dot + user pill), Sidebar (with `// OVERVIEW` / `// INVENTORY` / `// SYSTEM` group labels + active-route bevel + glow), Bottombar (with route shortcuts + F1 HELP + SESSION/LOCAL clocks updating every second), and PageHeader (with `// {ROUTE}` + `SESSION ... // LAST SYNC ...` meta)
  2. User clicking the sidebar collapse toggle sees the sidebar animate to 60px icon-rail mode via a single `data-collapsed` attribute toggle (no JavaScript layout / measure phase)
  3. User typing the letter `n` (or any other single-letter shortcut) into a `<input>`, `<textarea>`, `<select>`, or contenteditable surface DOES NOT trigger any Bottombar shortcut action — the `isEditableTarget(e.target)` guard is in place from the first commit, regression-tested on every form
  4. User pressing F1 (key OR Bottombar chip click) opens the keyboard-shortcuts help dialog; pressing ESC pops the topmost modal first and never logs out while any modal is open
  5. User on a viewport `<768px` sees the sidebar become a drawer and the Bottombar paginate or move overflow to a sheet while keeping F1 + ESC right-anchored
**Plans**: TBD
**UI hint**: yes

### Phase 4: Retro Atoms
**Goal**: Every retro UI atom required by feature pages exists with sketch 005 chrome (panel bevel, sharp corners, monospace, optional `// HEADER` slot, hazard-stripe variants), with the cross-cutting TUI-genre patterns (modal-stack ESC, status pills, tabular-nums numeric columns, SSE live-dot in panel headers, multi-select Shift+Click on tables) applied across the library
**Depends on**: Phase 3
**Requirements**: TUI-02, TUI-03, TUI-04, TUI-06
**Success Criteria** (what must be TRUE):
  1. User can render every atom on a `/demo` page — RetroPanel (with `// HEADER` slot), RetroButton (default + danger + key-chip), RetroBadge (with dot-mode for collapsed sidebar), RetroInput / Select / Combobox / Textarea / Checkbox / FileInput, RetroFormField, RetroTable (with multi-select), RetroTabs, RetroDialog, RetroConfirmDialog, RetroToast (sonner-skinned), RetroEmptyState, RetroPagination, RetroStatusDot, RetroHUD primitives — all with the locked chrome
  2. User pressing ESC inside a stack of overlays (dialog → drawer → menu) sees the topmost popped first; never logs out while any modal is open
  3. User scanning a row of status pills sees OK / WARN / INFO / DANGER variants with locked color tokens, and numeric columns in RetroTable use `font-variant-numeric: tabular-nums`
  4. User looking at any panel that subscribes to entity SSE events sees a `sse: ● live` text + step-end blinking dot in the panel header
  5. User Shift+Clicking rows in a RetroTable sees range selection state + Bottombar surfaces bulk-action chips for the active selection set
**Plans**: TBD
**UI hint**: yes

### Phase 5: Auth
**Goal**: User can log in with email + password OR Google OAuth OR GitHub OAuth, register a new account, switch workspaces, manage sessions, change password, delete account, and link/unlink connected accounts — all with cookie-JWT (`credentials: "include"`) + single-flight 401 refresh and the v2.0 spurious-logout-on-network-error bug fixed
**Depends on**: Phase 3
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-08, AUTH-09, AUTH-10
**Success Criteria** (what must be TRUE):
  1. User can log in via email + password, register a new account, and reach an authenticated placeholder route; cookie-JWT is set and 401 refresh is single-flighted in `lib/api.ts`
  2. User can log in via Google OAuth (PKCE + Authorization Code + one-time Redis exchange) or GitHub OAuth (with `/user/emails` for private-email accounts); auto-link by verified email works and unverified emails are rejected
  3. `RequireAuth` redirects unauthenticated users to `/login` BUT does NOT log out on transient network errors — only on HttpError 401/403
  4. User can switch workspaces from the topbar pill; the selected `workspaceId` is the SSOT for all entity API calls
  5. User can review active sessions + revoke individual / all-other sessions, change password (current-password verified, OAuth-only "set password" path), delete account with `DELETE` type-to-confirm + sole-owner workspace validation, and link/unlink Google + GitHub providers with last-method-removal lockout guard
**Plans**: TBD
**UI hint**: yes

### Phase 6: Providers
**Goal**: All four providers (Intl, SSE, Toast, Shortcuts) mount in canonical order alongside QueryClientProvider, AuthProvider, and BrowserRouter so chrome wires to real state once — TopBar ONLINE dot + PageHeader LAST SYNC bind to live SSE state, Bottombar reads from ShortcutsContext, sonner toasts mount with retro skin
**Depends on**: Phase 5
**Requirements**: PROV-01, PROV-02, PROV-03, PROV-04
**Success Criteria** (what must be TRUE):
  1. `App.tsx` mounts the provider stack in this exact order: `IntlProvider > QueryClientProvider > AuthProvider > SSEProvider > ToastProvider > ShortcutsProvider > BrowserRouter`
  2. SSEProvider opens a single EventSource (JWT in URL query param), exposes `useSSEStatus()` returning `{ connected, lastEventAt }` consumed by the TopBar ONLINE dot + PageHeader LAST SYNC, and a `useSSE({ onEvent })` subscribe API for feature consumers
  3. ShortcutsProvider is the register-by-id Context (ported verbatim from `frontend/components/layout/shortcuts-context.tsx`) with unregister-on-unmount cleanup; Bottombar render and keyboard dispatch both read from it
  4. ToastProvider mounts sonner with retro-skinned styling (sharp corners, monospace, panel bevel) and `toast.promise` ergonomics work
**Plans**: TBD

### Phase 7: Items + Photos
**Goal**: User can browse a paginated items list with search/filter/sort, view item detail with photo gallery + active-loan + history panels, create / edit / archive / delete items, upload + manage photos, and look up items by barcode via the dedicated workspace-scoped lookup endpoint (G-65-01 regression-guard pattern preserved)
**Depends on**: Phase 4, Phase 6
**Requirements**: ITEM-01, ITEM-02, ITEM-03, ITEM-04, ITEM-05, ITEM-06, ITEM-07, ITEM-08, ITEM-09, ITEM-10
**Success Criteria** (what must be TRUE):
  1. User can browse items in a paginated list (25/page) with search input, filter chips (category, location, archived), sort headers, URL-driven query params for deep-linking, and `useShortcuts("items", [...])` registration (`N` new / `/` focus-search / `F` toggle filters)
  2. User can view an item detail page with all fields, photo gallery (lightbox + arrow-key + ESC navigation, primary thumbnail toggle, individual photo delete with confirm), active-loan panel (if any), and loan history panel
  3. User can create a new item via `/items/new` (with optional `?barcode={code}` query-param prefill), edit via `/items/{id}/edit` with optimistic UI invalidation of `itemKeys.all` + relevant detail keys, archive / unarchive (archived hidden by default, visible via filter chip), and delete archived items with type-to-confirm dialog
  4. User can upload up to N photos per item (JPEG/PNG/HEIC, client-resize, 10 MB cap) via native FormData multipart with no upload library
  5. `itemsApi.lookupByBarcode(workspaceId, code)` calls `GET /api/workspaces/{wsId}/items/by-barcode/{code}` with workspace-scoped server-side authority + 404 → null mapping; cross-tenant isolation guarded by integration test
**Plans**: TBD
**UI hint**: yes

### Phase 8: Loans
**Goal**: User can browse loans in Active/Overdue/History tabs, create a new loan (with `?itemId=` deep-link from scan flow), mark returned, edit due date and notes, and see per-item + per-borrower active + history loan panels
**Depends on**: Phase 7
**Requirements**: LOAN-01, LOAN-02, LOAN-03, LOAN-04, LOAN-05, LOAN-06
**Success Criteria** (what must be TRUE):
  1. User can view loans in a tabbed Active/Overdue/History RetroTable view showing item / borrower / due-date / status pill
  2. User can create a new loan via `/loans/new` with item picker + borrower picker; the `?itemId={id}` URL param preselects the item (deep-linkable from scan flow)
  3. User can mark a loan as returned via confirm dialog and see it transition to History; can edit due date and notes after creation
  4. Item detail page renders an "Active Loan" panel (if any) and "Loan History" panel; Borrower detail page renders "Active Loans" + "Loan History" panels
**Plans**: TBD
**UI hint**: yes

### Phase 9: Borrowers
**Goal**: User can browse borrowers in a flat paginated list with search, create / edit / delete borrowers (with active-loan deletion guard), and view a borrower detail page with active + historical loan panels
**Depends on**: Phase 8
**Requirements**: BORR-01, BORR-02, BORR-03, BORR-04, BORR-05
**Success Criteria** (what must be TRUE):
  1. User can browse borrowers in a flat paginated list (no nesting) with search input + RetroPagination
  2. User can create a new borrower (name + optional contact info) and edit a borrower's profile
  3. User can view a borrower's detail page with active + historical loan panels
  4. User trying to delete a borrower with any active loan sees a red badge + "View active loans" link blocking deletion
**Plans**: TBD
**UI hint**: yes

### Phase 10: Taxonomy
**Goal**: User can manage hierarchical categories + locations + flat-but-grouped containers via a Taxonomy page with three tabs; create / edit / archive at any level with usage warnings, and delete containers with the unassign-and-delete cascade policy when items are assigned
**Depends on**: Phase 4, Phase 6
**Requirements**: TAX-01, TAX-02, TAX-03, TAX-04, TAX-05, TAX-06
**Success Criteria** (what must be TRUE):
  1. User can view categories as a hierarchical tree on the Taxonomy page (Categories tab) with expand/collapse persisted to sessionStorage; create / edit / archive at any level with usage warnings when archiving a category with assigned items
  2. User can view locations as a hierarchical tree (Locations tab); create / edit / archive at any level
  3. User can view containers grouped by location (Containers tab); create / edit / delete with unassign-and-delete cascade behavior when items are assigned (matches v2.2 cascade decision)
**Plans**: TBD
**UI hint**: yes

### Phase 11: Scan (single-route)
**Goal**: User can open `/scan`, see a live rear-camera preview, decode QR + UPC-A + EAN-13 + Code128 with audio + haptic + visual feedback, toggle Android torch, fall back to manual entry, view last-10 scan history, and after a successful scan see a 4-state result banner + state-adaptive quick-action overlay (View Item / Loan / Back to Scan / Unarchive / Mark Reviewed) — the BarcodeScanner mounts ONCE and stays mounted for iOS PWA camera-permission persistence
**Depends on**: Phase 7
**Requirements**: SCAN-01, SCAN-02, SCAN-03, SCAN-04, SCAN-05, SCAN-06, SCAN-07, SCAN-08, SCAN-09, SCAN-10, SCAN-11
**Success Criteria** (what must be TRUE):
  1. User on `/scan` sees a live rear-camera preview; the `<BarcodeScanner>` (`@yudiel/react-qr-scanner@2.5.1` exact pin) mounts ONCE and stays mounted while overlays render on top — never navigates mid-scan, pause is prop-driven (NOT unmount)
  2. User pointing the camera at a QR / UPC-A / EAN-13 / Code128 code decodes within ~1 second, hears AudioContext oscillator beep, feels haptic (`ios-haptics` on iOS 17.4+ Safari, `navigator.vibrate` elsewhere), and sees a visual flash/checkmark
  3. User on Android with `MediaStreamTrack.getCapabilities().torch` sees a torch toggle (auto-hidden on iOS); user can switch to a Manual tab and submit a typed code; user can view + clear (with confirm) the last-10-codes history (`hws-scan-history` localStorage)
  4. After scan or manual entry, user sees a 4-state result banner — LOADING / MATCH / NOT-FOUND / ERROR — with a `prefers-reduced-motion`-aware blinking-cursor variant; NOT-FOUND offers "Create item with this barcode" → `/items/new?barcode=<code>`; codes matching `/^\d{8,14}$/` show an opt-in suggestion banner with USE / USE ALL / DISMISS for prefill from `GET /api/barcode/{code}`
  5. After a MATCH, user sees a state-adaptive quick-action overlay (View Item / Loan / Back to Scan; Loan hidden if item on active loan, Unarchive if archived, Mark Reviewed if `needs_review`)
**Plans**: TBD
**UI hint**: yes

### Phase 12: Settings hub
**Goal**: User can manage profile / security / appearance / language / regional formats / notifications / connected accounts / data storage from a Settings landing page with iOS-style grouped rows linking to 8 dedicated subpages
**Depends on**: Phase 5, Phase 6
**Requirements**: SETT-01, SETT-02, SETT-03, SETT-04, SETT-05, SETT-06, SETT-07, SETT-08, SETT-09
**Success Criteria** (what must be TRUE):
  1. User on `/settings` sees iOS-style grouped rows linking to 8 subpages: Profile, Security, Appearance, Language, Regional Formats, Notifications, Connected Accounts, Data Storage
  2. User can edit name + email + avatar (Profile); change password + view/revoke active sessions + delete account (Security); pick theme (Appearance — only premium-terminal under v3.0); pick en / et / ru (Language); set date / time / thousand / decimal formats (Regional Formats)
  3. User can toggle in-app preferences for SSE event types (Notifications), link/unlink Google + GitHub OAuth providers (Connected Accounts), and clear cached query data + export workspace + import workspace (Data Storage — online-only, no offline-storage management surface)
**Plans**: TBD
**UI hint**: yes

### Phase 13: Dashboard
**Goal**: User landing on `/` sees four stat tiles (Total Items, Locations, Containers, Active Loans), a TUI-style activity table (Timestamp / Action / Entity / Actor / Status), a side rail (Pending Approvals + System Alerts), and — when `VITE_FEATURE_HUD_ROLLUPS=true` — a HUD row with hand-rolled SVG capacity gauge + 14-day activity sparkline + counts (Conflict 3 resolution)
**Depends on**: Phase 6
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05
**Success Criteria** (what must be TRUE):
  1. User sees four stat tiles (Total Items / Locations / Containers / Active Loans) with token-correct retro panel styling
  2. User sees an activity table with TUI columns (Timestamp / Action / Entity / Actor / Status pill); timestamps are relative under 24h and absolute thereafter
  3. User sees a side rail stacking Pending Approvals + System Alerts panels
  4. With `VITE_FEATURE_HUD_ROLLUPS=true`, user sees a HUD row (hand-rolled SVG capacity gauge + 14-day activity sparkline + counts); flag default off ships dashboard immediately while backend coordinates rollups
  5. Dashboard registers `useShortcuts("dashboard", [{ key: "N", action: navTo("/items/new") }, { key: "S", action: navTo("/scan") }, { key: "L", action: navTo("/loans") }])`
**Plans**: TBD
**UI hint**: yes

### Phase 14: System group
**Goal**: User can review approvals (with bulk-action support), my-changes, sync history, and imports/exports under the sidebar `// SYSTEM` group — all using the same activity-table pattern from earlier feature phases
**Depends on**: Phase 7
**Requirements**: SYS-01, SYS-02, SYS-03, SYS-04
**Success Criteria** (what must be TRUE):
  1. User on `/approvals` sees a paginated activity-table view of pending approval requests with multi-select via Shift+Click + Bottombar A/R/D shortcuts (Approve / Reject / Defer)
  2. User on `/my-changes` sees a list of their recent mutations across entities
  3. User on `/sync-history` sees past sync events with timestamps, status, and error details
  4. User on `/imports` sees CSV import + workspace export + import-history surface using the activity-table pattern
**Plans**: TBD
**UI hint**: yes

### Phase 15: i18n catalog gap-fill (et + ru)
**Goal**: All user-facing strings ship in en / et / ru with no inline literals; CI extract→merge→diff manifest guard catches missing/orphaned msgids; locale switcher persists choice and applies instantly; format hooks are used everywhere date/time/number values render
**Depends on**: Phase 6, Phase 12
**Requirements**: I18N-01, I18N-02, I18N-03
**Success Criteria** (what must be TRUE):
  1. Every user-facing string ships in en + et + ru — no inline literals; CI extract→merge→diff manifest guard fails any PR with missing or orphaned msgids
  2. User picking a locale on Settings → Language sees the choice persisted to `users/me/preferences` and applied instantly without page reload
  3. Every component rendering a date / time / number uses `useDateFormat` / `useTimeFormat` / `useNumberFormat` — no raw `Date.toString()` or `Number.toLocaleString()` in feature code (CI grep guard)
**Plans**: TBD

### Phase 16: Command Palette
**Goal**: User can open a Cmd+K / F2 command palette filtering across routes, recent actions, and workspaces, with keyboard-first navigation
**Depends on**: Phase 6
**Requirements**: TUI-05
**Success Criteria** (what must be TRUE):
  1. User pressing Cmd+K (or Ctrl+K) or F2 sees a `cmdk`-driven command palette open with full-screen retro-panel chrome
  2. User typing a query sees fuzzy-filtered matches across routes, recent actions, and workspaces
  3. User can navigate matches with arrow keys, select with Enter, dismiss with ESC; tinykeys handles the open chord, cmdk owns filtering inside
**Plans**: TBD
**UI hint**: yes

### Phase 17: Polish & Quality
**Goal**: Every cross-HTTP flow has at least one real-backend test (Playwright E2E + tagged Go integration test, Phase 65 Plan 65-11 pattern); axe-playwright a11y CI sweep passes; tab/keyboard navigation audit passes; bundle-size CI guard enforced; mobile breakpoint matrix re-tested at 320 / 360 / 768 / 1024 / 1440 px with visual diff vs sketch 005 PNG for the dashboard route
**Depends on**: Phase 14
**Requirements**: POL-01, POL-02, POL-03, POL-04, POL-05
**Success Criteria** (what must be TRUE):
  1. Every flow that crosses the HTTP boundary has at least one real-backend test — Playwright E2E for browser-driven flows + tagged Go integration test for server contract (the Phase 65 Plan 65-11 pattern, applied from Day 1)
  2. CI runs `axe-playwright` across every route and fails on contrast / focus-visible / touch-target / aria-label violations; tab/keyboard navigation audit confirms every page is fully keyboard-navigable with visible focus indicator (focus-visible, not focus) and no keyboard traps
  3. CI fails any PR that pushes `vite build` output above documented per-chunk budgets (main / scanner / vendor) with a clear delta report
  4. Mobile breakpoint matrix re-tested at 320 / 360 / 768 / 1024 / 1440 px; dashboard route passes visual diff vs sketch 005 PNG
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
| 64 | v2.2 | 10/10 | Complete | 2026-04-18 |
| 65 | v2.2 | 10/11 | Gap closure in progress | - |
| 66 | v2.2 | 0/? | Abandoned | - |
| 67 | v2.2 | 0/? | Abandoned | - |
| 68 | v2.2 | 0/? | Abandoned | - |
| 69 | v2.2 | 0/? | Abandoned | - |
| 70 | v2.2 | 0/? | Abandoned | - |
| 71 | v2.2 | 0/? | Abandoned | - |
| 72 | v2.2 | 0/? | Abandoned | - |
| 1 | v3.0 | 0/TBD | Not started | - |
| 2 | v3.0 | 0/TBD | Not started | - |
| 3 | v3.0 | 0/TBD | Not started | - |
| 4 | v3.0 | 0/TBD | Not started | - |
| 5 | v3.0 | 0/TBD | Not started | - |
| 6 | v3.0 | 0/TBD | Not started | - |
| 7 | v3.0 | 0/TBD | Not started | - |
| 8 | v3.0 | 0/TBD | Not started | - |
| 9 | v3.0 | 0/TBD | Not started | - |
| 10 | v3.0 | 0/TBD | Not started | - |
| 11 | v3.0 | 0/TBD | Not started | - |
| 12 | v3.0 | 0/TBD | Not started | - |
| 13 | v3.0 | 0/TBD | Not started | - |
| 14 | v3.0 | 0/TBD | Not started | - |
| 15 | v3.0 | 0/TBD | Not started | - |
| 16 | v3.0 | 0/TBD | Not started | - |
| 17 | v3.0 | 0/TBD | Not started | - |

**Total:** 65 phases complete (185 plans executed: +65-11 gap-closure Wave 8 regression test for G-65-01, Phase 65 now 11/11 SHIPPABLE — Option C Playwright E2E + Go HTTP+Postgres integration test) across 12 milestones; v2.2 (Phases 64-72) active

---
*Roadmap created: 2026-01-24*
*Last updated: 2026-04-30 — v2.2 abandoned (frontend2 wiped); v3.0 Premium-Terminal Frontend roadmap added with 17 phases mapping all 106 requirements (FOUND/TOKEN/SHELL/BAR/PROV/AUTH/ITEM/LOAN/BORR/TAX/SCAN/SETT/DASH/I18N/SYS/TUI/POL); phase numbering RESET to 1 since v2.2 has no continuity with the rebuild.*
*Last updated: 2026-04-19 — Phase 65 Plan 02 complete (LOOK-01 frontend guard layer: itemsApi.lookupByBarcode w/ D-06/D-07/D-08 guards inlined + schemas D-23 optional brand field + D-24 barcode regex loosened for hyphens/underscores; 10 Wave 0 todos converted green; full suite 640 passed / 50 todos)*
*Last updated: 2026-04-19 — Phase 65 Plan 03 complete (LOOK-03 data layer: lib/api/barcode.ts + useBarcodeEnrichment with /^\d{8,14}$/ gate + silent-fail structured log; 18 Wave 0 todos green; full suite 640 passed / 50 todos)*
*Last updated: 2026-04-19 — Phase 65 Plan 05 complete (LOOK-02 + LOOK-03 render surface: ItemForm FormProvider wrap + BRAND field D-23 + UpcSuggestionBanner + ItemFormPage with D-04 scanKeys.lookup + itemKeys.all dual invalidation and dirty-guard dialog; +32 real it() green (3 ItemForm BRAND + 13 UpcSuggestionBanner + 19 ItemFormPage — +3 bonus); cumulative 60/78 Wave-0 todos converted; full suite 686 passed / 20 todos / 0 failed)*
*Last updated: 2026-04-18 — Phase 64 COMPLETE (plan 64-10 i18n extract + ET gap-fill + [BLOCKING] bundle gate verified; 36 new msgids translated EN+ET; main chunk SHRANK 37.8 kB gzip vs pre-phase baseline; scanner chunk 58.1 kB gzip isolated; 609/609 green)*
*Last updated: 2026-04-19 — Phase 65 Plan 06 complete (ScanResultBanner widened in place Phase 64 single SCANNED → Phase 65 four-state LOADING/MATCH/NOT-FOUND/ERROR per D-17..D-21; @keyframes retro-cursor-blink + prefers-reduced-motion:reduce { animation: none; opacity: 1; } guard in globals.css; 21 new real it() green; 7 Phase 64 assertions migrated under MATCH describe; 2 Rule 3 auto-fixes kept tsc+vitest gates green during interim ScanPage wiring; full vitest suite 707 passed / 0 todos / 0 failed)*
*Last updated: 2026-04-19 — Phase 65 Plan 07 complete (Phase 65 → ScanPage integration wiring: /items/new route registered between items and items/:id (literal-before-param idiom, eager import); ScanPage match-effect with D-22 race guard — useEffect calls history.update(code, { entityType, entityId, entityName }) ONLY on lookup.status === "success" && lookup.match; deps array [lookup.status, lookup.match, banner?.code, history.update] — NOT [history], which would re-fire every render and defeat the gate; `void lookup;` placeholder removed; ScanResultBanner callsite widened to thread lookup.status / lookup.match / handleViewItem / handleCreateWithBarcode / handleLookupRetry alongside existing code/format/timestamp/onScanAgain; handleLookupRetry name-distinct from Phase 64 handleRetry — both callbacks co-exist (lookup-query retry vs scanner-polyfill retry); useScanLookup(banner?.code ?? null) callsite preserved VERBATIM per Phase 64 D-18 + Test 15 gate; 3 new it() green (Test 16 match → history.update called with entityType:'item' + entityId + entityName; Test 17 not-found → NEVER called; Test 18 error → NEVER called); Test 15 preserved verbatim; 1 Rule 3 auto-fix — scan-feature fixtures.ts layered with MemoryRouter (via createElement so file stays .ts) so ScanPage's new useNavigate() has router context without modifying shared taxonomy fixture; full vitest suite 710 passed / 0 todos / 0 failed; typecheck + lint:imports + build clean)*
*Last updated: 2026-04-19 — Phase 65 COMPLETE (plan 65-08 i18n EN extract + ET gap-fill + [BLOCKING] bundle gate PASS; 16 new msgids across ScanResultBanner 4-state surface + UpcSuggestionBanner + ItemFormPage + ItemForm BRAND placeholder; every ET msgstr hand-filled per plan's starting-point table (VASTE LEITUD, EI LEITUD, OTSIN…, OTSING EBAÕNNESTUS, SOOVITUSED SAADAVAL, BRÄND, [KASUTA], KASUTA KÕIK, SULGE, VAATA ESET, LOO UUS ESE SELLE VÖÖTKOODIGA, PROOVI UUESTI, nt DeWalt, Serverit ei õnnestunud tabada…, Selle vöötkoodiga eset ei leitud…, Kategooria vihje: {0} — vali all käsitsi.); 1 Rule 2 auto-fix — CANCEL msgid was absent from master HEAD b04ae7c catalog despite plan assuming Phase 60/57 reuse, added TÜHISTA; bundle gate result: scanner chunk byte-identical to baseline (58057 B gzip @ CLRWiLFx hash, zero content drift — confirms Pitfall #7 not triggered); main chunk SHRANK 21.3 kB gzip (135754 → 114418) because Plan 65-07's React.lazy split moved scan-feature application code into new on-demand scan-*.js (61.5 kB gzip) + ScanPage-*.js (5.6 kB gzip) chunks; delta is WELL within zero scanner + ≤5 kB main budgets; full phase gate green — vitest 710/710, lint:imports OK, tsc -b --noEmit clean, i18n:compile 0 warnings, build ✓ 319ms; LOOK-01/02/03 all shippable EN+ET)*
*Last updated: 2026-04-19 — Phase 65 Plan 10 complete (Gap G-65-01 frontend closure: itemsApi.lookupByBarcode in frontend2/src/lib/api/items.ts body swapped from list({search: code, limit: 1}) wrap to direct get<Item>(`${base(wsId)}/by-barcode/${encodeURIComponent(code)}`) with try/catch mapping HttpError.status===404 → null and propagating other errors. D-07 + D-08 defense-in-depth guards retained. Test suite REWRITTEN (not migrated): 6 itemsApi.list-mocked tests discarded with intent (their mock layer is precisely what hid G-65-01), 8 new global.fetch-mocked tests cover smoke / URL shape / encodeURIComponent / 200 happy / 404 → null / D-07 case-sensitivity / D-08 workspace mismatch / 500 HttpError propagation. 65-CONTEXT.md D-06 + REQUIREMENTS.md:94 revised with dated ORIGINAL/REVISED annotation pairs (auditable history preserved). TDD gate per Task 1: e5227d1 test RED (6 of 8 fail against old impl) + fbb2907 feat GREEN (all 8 pass); Task 2 288497d docs D-06 revision; Task 3 192000f docs REQUIREMENTS.md:94 revision. Full vitest suite 712 passed / 0 failed / 0 todos (EXACT match to plan done criteria: 710 baseline − 6 + 8); useScanLookup 18/18 still green (insulated by mocking the helper directly, proving body swap is contract-preserving). Typecheck + lint:imports + build all clean. Bundle ZERO regression: main chunk gzip 114418 B byte-identical (hash changed ChvbQJeu → nmHRivvj because body text changed but gzip size unchanged), scanner chunk gzip 58057 B at UNCHANGED hash CLRWiLFx. Zero deviations — plan executed exactly as written; no Rule 1/2/3 auto-fixes needed. Plan 65-11 regression test now unblocked.)*

*Last updated: 2026-04-19 — Phase 65 Plan 09 complete (Gap G-65-01 backend closure: dedicated GET /api/workspaces/{wsId}/items/by-barcode/{code} Huma route + ServiceInterface.LookupByBarcode pass-through. Service normalises shared.ErrNotFound → ErrItemNotFound mirroring Service.Delete pattern; handler maps the sentinel to 404, 500 on other errors, 400/422 on Huma path-param maxLength:64 violation. Route ordered between /items/search (literal) and /items/{id} (param) — literal-before-param chi matching idiom. LookupItemByBarcodeInput/Output types. TDD gate: 2 RED + 2 GREEN commits per task cycle — test(65-09) bf33f8d adds failing TestService_LookupByBarcode (3 subtests: match / shared.ErrNotFound normalisation / arbitrary repo error passthrough); feat(65-09) 283a6bf adds Service impl + ServiceInterface extension + MockService.LookupByBarcode stub (Rule 3 fix: ServiceInterface extension broke MockService compile, stub pulled from Task 2 to Task 1 GREEN); test(65-09) e3b31e1 adds failing TestItemHandler_LookupByBarcode (5 subtests: 200 happy path / 404 on ErrItemNotFound / 500 on opaque error / 400/422 on oversize code via AssertNotCalled / case-sensitivity guard ABC-123 vs abc-123 distinct codes); feat(65-09) 59d4e3d registers the Huma route + types + best-effort primary-photo decoration mirroring GetByID convention. Full item package green (service + handler + all pre-existing tests); backend go build ./... clean. Pre-existing test failure in internal/jobs package (TestCleanupConfig_RetentionPeriodUsage 30-day + 90-day subtests at cleanup_test.go:216) confirmed unrelated — reproduces on baseline e3b31e1 via git stash; logged in phase deferred-items.md. Plan 65-10 frontend swap is now unblocked — backend endpoint exists and is testable via curl/integration-test against a real workspace.)*

*Last updated: 2026-04-19 — Phase 65 COMPLETE (Plan 65-11 — Gap G-65-01 regression guard, Option C both branches. **Branch A** — first Playwright surface in repo at frontend2/e2e/scan-lookup.spec.ts; config at frontend2/playwright.config.ts with chromium + firefox projects and no webServer (expects dev stack running per new project-root CLAUDE.md runbook); test:e2e + test:e2e:headed scripts; Playwright devDep + browser binaries installed; vitest.config.ts excludes **/e2e/**; .gitignore covers test-results/ + playwright-report/ + playwright/.cache/. Spec logs in via real /login (cookies set for both page + request), seeds item with unique per-run barcode via cookie-authenticated page.request.post, navigates /scan → MANUAL tab → types code → clicks LOOK UP CODE → asserts MATCHED banner (locale-agnostic `/matched|vaste leitud/i`) + seeded item name, finally cleanup best-effort. Verified green on chromium + firefox. **Branch B** — first Go integration-test surface at backend/internal/domain/warehouse/item/handler_integration_test.go under `//go:build integration` (reuses existing backend/tests/testdb harness — 1 Rule 3 auto-fix vs plan's parallel internal/testutil/integration.go suggestion, which would have fragmented integration plumbing); real item.NewService + real postgres.NewItemRepository wired to a chi+humachi test router that injects workspace/user context exactly like appMiddleware does in prod. 3 subtests: 200 happy path on seeded barcode, 404 for guaranteed-unique never-existed code, and **404 cross-tenant leak guard** (barcode seeded in another workspace — the truth the handler unit test cannot assert because with a mocked service "other workspace" is indistinguishable from "never existed"). Verified green: 3/3 subtests PASS in 0.21s. **Coverage matrix:** Branch A catches backend OR frontend reverts (banner renders NOT FOUND); Branch B catches backend reverts AND the WHERE workspace_id = $1 clause specifically (cross-tenant leak). **CLAUDE.md** (new project root, auto-loaded by Claude Code) has §E2E Tests + §Backend Integration Tests with runbooks, auth contract notes, and how to add new specs. Commits 5e77f98 (feat Branch A) + 8d4191d (test Branch B) — two-commit split because artifacts have zero file overlap (bun/Playwright vs go/pgx), future archaeology cleaner. Non-integration suites still green: backend go test ./... default lane zero-failures; frontend bunx vitest run with e2e/ excluded 712/712. Phase 65 SHIPPABLE — all 3 LOOK-0N requirements have rendered user paths + unit tests + regression guards at the correct layers + EN+ET translations + zero bundle regression + G-65-01 closed end-to-end. Phase 66 Quick-Action Menu unblocked.)*
