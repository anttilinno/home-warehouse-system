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
- ✅ **v2.0 Retro Frontend** — Phases 48-55 (shipped 2026-04-14)
- 📋 **v2.1 Feature Parity — Items, Loans & Scanning** — Phases 56-63 (planned)

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

<details>
<summary>✅ v2.0 Retro Frontend (Phases 48-55) — SHIPPED 2026-04-14</summary>

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

### 📋 v2.1 Feature Parity — Items, Loans & Scanning (Planned)

**Milestone Goal:** Bring `/frontend2` to core feature parity: Items CRUD (with photos), Loans + Borrowers, Categories/Locations/Containers taxonomy, and navigation wiring. Online-only, lean. Barcode scanning deferred to v2.2.

- [x] **Phase 56: Foundation — API Client & React Query** - Typed entity API modules and TanStack Query setup on top of existing `lib/api.ts` (completed 2026-04-15)
- [ ] **Phase 57: Retro Form Primitives** - RetroSelect, RetroCombobox, RetroTextarea, RetroCheckbox, RetroFileInput, RetroPagination, RetroConfirmDialog, RetroEmptyState, RetroFormField
- [x] **Phase 58: Taxonomy — Categories, Locations, Containers** - Hierarchical tree CRUD for categories and locations, container CRUD grouped by location (completed 2026-04-15)
- [ ] **Phase 59: Borrowers CRUD** - Flat borrower list, create/edit/delete with active-loan guard, detail page with loan history
- [x] **Phase 60: Items CRUD** - Paginated list with search/filter/sort, detail view, create/edit/delete, archive/unarchive toggle (completed 2026-04-16)
- [x] **Phase 61: Item Photos** - Multipart photo upload, gallery viewer, photo delete, primary thumbnail on list + detail (completed 2026-04-16)
- [ ] **Phase 62: Loans** - Tabbed Active/Overdue/History list, create loan, mark returned, edit, per-item and per-borrower history
- [ ] **Phase 63: Navigation & Polish** - Sidebar links for Items/Loans/Borrowers/Taxonomy, dashboard quick-access wiring, i18n sweep, empty states

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

### Phase 56: Foundation — API Client & React Query
**Goal**: Typed entity API modules and TanStack Query provider in place so every subsequent CRUD phase has a consistent server-state substrate
**Depends on**: Phase 55 (prior milestone complete)
**Requirements**: (infrastructure — no user-facing REQs; unblocks all v2.1 CRUD phases)
**Success Criteria** (what must be TRUE):
  1. `QueryClientProvider` wraps the app in `App.tsx` and React Query Devtools is available in dev mode
  2. `lib/api/` contains typed per-entity modules (items, itemPhotos, loans, borrowers, categories, locations, containers) exposing list/get/create/update/delete functions
  3. `lib/api.ts` provides a `postMultipart<T>` helper usable by future photo uploads
  4. A smoke test (or demo route) fetches one real list endpoint through React Query and shows loading/success/error states
  5. CI grep guard fails the build if `frontend2/src/**` imports `idb`, `serwist`, or any `*offline*`/`*sync*` module
**Plans:** 4/4 plans complete
Plans:
- [x] 56-01-PLAN.md — Install TanStack Query v5, QueryClient singleton, QueryClientProvider + lazy Devtools, postMultipart helper
- [x] 56-02-PLAN.md — Seven typed per-entity API modules (items, itemPhotos, loans, borrowers, categories, locations, containers) with TK-dodo queryKeys factories + barrel
- [x] 56-03-PLAN.md — Public /api-demo route demonstrating React Query loading/success/error/empty/anonymous states + Lingui catalogs
- [x] 56-04-PLAN.md — CI grep guard blocking idb/serwist/*offline*/*sync* imports under frontend2/src, wired to prebuild

### Phase 57: Retro Form Primitives
**Goal**: A full set of retro-styled form and list primitives so every CRUD page can compose forms, pickers, pagination, and confirmations without ad-hoc components
**Depends on**: Phase 56
**Requirements**: (infrastructure — no user-facing REQs; unblocks all CRUD forms)
**Success Criteria** (what must be TRUE):
  1. RetroSelect, RetroCombobox, RetroTextarea, RetroCheckbox, RetroFileInput, RetroPagination, RetroConfirmDialog, RetroEmptyState, and RetroFormField each render in the `/demo` page with interactive states
  2. RetroFormField integrates with react-hook-form + zod and surfaces inline validation errors in retro styling
  3. RetroCombobox supports async option loading with keyboard navigation and mobile-friendly 44px targets
  4. RetroPagination exposes page-size-aware navigation and shows "N of M" for any list
  5. All new primitives are exported from the `@/components/retro` barrel and consumed by at least one test or demo story
**Plans:** 3 plans
Plans:
- [ ] 57-01-PLAN.md — Install RHF/zod/floating-ui deps + RetroTextarea/Checkbox/FileInput
- [ ] 57-02-PLAN.md — RetroSelect/Combobox (floating-ui) + RetroFormField (RHF Controller)
- [ ] 57-03-PLAN.md — RetroPagination/ConfirmDialog/EmptyState + /demo wiring + i18n catalogs
**UI hint**: yes

### Phase 58: Taxonomy — Categories, Locations, Containers
**Goal**: Users can manage the taxonomy that items depend on: hierarchical categories and locations, plus containers grouped by location, with full CRUD and usage-aware delete
**Depends on**: Phase 57
**Requirements**: TAX-01, TAX-02, TAX-03, TAX-04, TAX-05, TAX-06, TAX-07, TAX-08, TAX-09, TAX-10, TAX-11, TAX-12
**Success Criteria** (what must be TRUE):
  1. User can view categories and locations as indented hierarchical trees and create/edit nodes with an optional parent picker and description
  2. User can view containers grouped by their parent location and create/edit containers with a required location and optional description
  3. User can archive or delete any taxonomy node; the UI shows the current usage count and warns when items are still assigned (handling 409 cascade responses)
  4. Taxonomy changes propagate to dependent selectors (e.g., item create/edit) on next open via React Query cache invalidation
  5. A unified `/taxonomy` tabbed page exposes Categories, Locations, and Containers with retro styling and empty states
**Plans:** 4/4 plans complete
Plans:
- [x] 58-01-PLAN.md — Pure utilities (buildTree, shortCode, zod schemas, useHashTab) + unit tests
- [x] 58-02-PLAN.md — Data hooks: read (trees + grouped containers) + CRUD mutations with HttpError 409 handling
- [x] 58-03-PLAN.md — Forms (Category/Location/Container) + SlideOverPanel + ArchiveDeleteFlow
- [x] 58-04-PLAN.md — TaxonomyPage + Tree components + tabs + route wiring + i18n + human checkpoint
**UI hint**: yes

### Phase 59: Borrowers CRUD
**Goal**: Users can manage borrowers as a flat list and see each borrower's active and historical loans on a detail page
**Depends on**: Phase 57 (can run in parallel with Phase 58)
**Requirements**: BORR-01, BORR-02, BORR-03, BORR-04, BORR-05
**Success Criteria** (what must be TRUE):
  1. User can view a borrowers list showing each borrower's name and active loan count
  2. User can create a borrower with required name and optional email, phone, and notes, and edit any of those fields later
  3. Attempting to delete a borrower with active loans is blocked and surfaces a clear retro error message
  4. Borrower detail page renders the borrower's active loans and historical loans in separate sections (loan data wired up in Phase 62)
  5. Empty states render a retro "no borrowers yet" panel with a primary create action
**Plans:** 3/4 plans executed
Plans:
- [x] 59-01-PLAN.md — Backend: add /archive + /restore endpoints, rewire DELETE to hard-delete with ErrHasActiveLoans guard, add archived list filter, split repo Archive/Restore/Delete
- [x] 59-02-PLAN.md — Frontend API: borrowersApi.archive/restore + archived list param, borrower zod schemas, icons module, test fixtures
- [x] 59-03-PLAN.md — Frontend composition: 2 query hooks + 5 mutation hooks (400-branch on delete), BorrowerForm + BorrowerPanel + BorrowerArchiveDeleteFlow
- [ ] 59-04-PLAN.md — Pages + routes: BorrowersListPage + BorrowerDetailPage + /borrowers routes + Lingui extract + human-verify checkpoint
**UI hint**: yes

### Phase 60: Items CRUD
**Goal**: Users can list, view, create, edit, archive, and delete inventory items with full search, filter, and sort over the paginated list
**Depends on**: Phase 58 (taxonomy FKs required)
**Requirements**: ITEM-01, ITEM-02, ITEM-03, ITEM-04, ITEM-05, ITEM-06, ITEM-07, ITEM-08
**Success Criteria** (what must be TRUE):
  1. User sees a paginated items list (25/page) with retro pagination and can search by name, SKU, or barcode
  2. User can filter the list by category and location and sort by name, SKU, created date, or updated date; a toggle shows or hides archived items
  3. User can open an item detail page that displays name, SKU, barcode, description, category, location, container, status, and notes
  4. User can create a new item with required name and all optional fields, edit any item, and delete an item after confirming via RetroConfirmDialog
  5. User can archive and unarchive an item from the detail page; archived items are excluded from the default list view
**Plans:** 4/4 plans complete
Plans:
- [x] 60-01-PLAN.md — Backend: ListItemsFiltered + CountItemsFiltered + DeleteItem SQL; fix repo.Delete to true hard-delete; extend ListItemsInput (search/category_id/archived/sort/sort_dir, default 25); register huma.Delete /items/{id}; ListFiltered on ServiceInterface + Delete with workspace ownership check
- [x] 60-02-PLAN.md — Frontend API + hooks: itemsApi.delete, updated ItemListParams, zod schemas + generateSku, 5 mutation hooks (SKU-collision mapping, removeQueries-before-invalidate on delete), useItemsList + useItem + useCategoryNameMap (archived:true), icons + test fixtures
- [x] 60-03-PLAN.md — Components: ItemForm (RHF + zod), ItemPanel (slide-over with SKU auto-gen), ItemArchiveDeleteFlow (no 400 branch), ShowArchivedChip (new composition), ItemsFilterBar (debounced search + category + sort), useItemsListQueryParams (URL state with page-reset on filter change)
- [x] 60-04-PLAN.md — Pages + routes: ItemsListPage + ItemDetailPage with PHOTOS/LOANS placeholders; replace ItemsPage placeholder; /items + /items/:id routes; Lingui EN + ET catalog extraction; human-verify checkpoint
**UI hint**: yes

### Phase 61: Item Photos
**Goal**: Users can attach photos to items, view them in a gallery, delete them, and see the primary thumbnail in the items list and detail header
**Depends on**: Phase 60
**Requirements**: PHOTO-01, PHOTO-02, PHOTO-03, PHOTO-04
**Success Criteria** (what must be TRUE):
  1. User can upload one or more photos (JPEG/PNG/HEIC) from the item detail page with client-side resize and a ~10 MB max enforced before upload
  2. Uploaded photos appear in a retro gallery viewer on the item detail page with previous/next navigation
  3. User can delete a photo from the gallery with a confirmation step and the gallery updates immediately
  4. Items list rows and item detail header show the primary/thumbnail photo when available and a retro placeholder otherwise
  5. Photo `ObjectURL`s are revoked via ref on unmount so repeated uploads do not leak memory (v1.9 lesson)
**Plans:** 5/5 plans complete
Plans:
- [x] 61-01-PLAN.md — Foundation: backend PhotoResponse.thumbnail_status + ItemResponse.primary_photo_* (server-side join) + frontend put/setPrimary/multipart-field-fix + RetroFileInput HEIC→WebP + Wave 0 test scaffolds
- [x] 61-02-PLAN.md — Presentational family: ItemPhotoTile (HazardStripe placeholder + PRIMARY badge) + ItemPhotoGrid (responsive 3/4 col) + ItemThumbnailCell (40×40 list cell) + ItemHeaderThumbnail (64×64 detail header)
- [x] 61-03-PLAN.md — Stateful composition: useItemPhotoGallery hook (sequential upload + optimistic setPrimary + delete + ObjectURL tracking) + ItemPhotoLightbox (FloatingPortal overlay + nested RetroConfirmDialog) + ItemPhotoGallery orchestrator
- [x] 61-04-PLAN.md — Page wiring + i18n + checkpoint: ItemDetailPage PHOTOS swap + header thumbnail, ItemsListPage THUMB column, Lingui EN + ET extract, human-verify end-to-end
**UI hint**: yes

### Phase 62: Loans
**Goal**: Users can loan items to borrowers, track returns, and review loan history from both the item and borrower perspectives
**Depends on**: Phase 60 (items), Phase 59 (borrowers)
**Requirements**: LOAN-01, LOAN-02, LOAN-03, LOAN-04, LOAN-05, LOAN-06
**Success Criteria** (what must be TRUE):
  1. User can view loans on a tabbed page showing Active, Overdue, and History with counts in each tab
  2. User can create a loan by picking an item and a borrower via RetroCombobox and optionally setting a due date and notes
  3. User can mark any active loan as returned, and the loan moves to History immediately
  4. User can edit a non-returned loan's due date and notes without creating a new loan
  5. Item detail and borrower detail pages each show the entity's current active loan (if any) and historical loans
**Plans:** 2/4 plans executed
Plans:
- [x] 62-01-PLAN.md — Backend PATCH /loans/{id} + LoanResponse embed (item + borrower) decoration on all loan endpoints
- [x] 62-02-PLAN.md — Frontend loansApi.update/listForItem + query + mutation hooks with UI-SPEC invalidation sets
- [ ] 62-03-PLAN.md — /loans tabbed list page, LoanForm, LoanPanel slide-over, LoanReturnFlow confirm dialog
- [ ] 62-04-PLAN.md — Item/borrower detail-page loan panels + router swap to LoansListPage + Lingui extract + human-verify checkpoint
**UI hint**: yes

### Phase 63: Navigation & Polish
**Goal**: The retro sidebar and dashboard are wired to every new v2.1 section, i18n catalogs are complete, and every list has a proper empty state
**Depends on**: Phase 58, Phase 59, Phase 60, Phase 61, Phase 62
**Requirements**: NAV-01, NAV-02
**Success Criteria** (what must be TRUE):
  1. Retro sidebar shows links to Items, Loans, Borrowers, and Taxonomy in addition to Dashboard and Settings
  2. Dashboard quick-access action cards route to the Items list and Loans list (completing the v2.0 placeholders)
  3. Every v2.1 list page (items, loans, borrowers, categories, locations, containers) renders a RetroEmptyState with a primary action when empty
  4. All user-visible strings introduced in phases 56–62 are present in English and Estonian Lingui catalogs with no orphan keys
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 56 -> 57 -> (58 || 59) -> 60 -> 61 -> 62 -> 63
(Phase 58 and 59 depend only on Phase 57 and can run in parallel. Phase 61 follows 60. Phase 62 needs both 60 and 59.)

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
| 56. Foundation — API Client & React Query | v2.1 | 4/4 | Complete   | 2026-04-15 |
| 57. Retro Form Primitives | v2.1 | 3/3 | Complete   | 2026-04-15 |
| 58. Taxonomy — Categories, Locations, Containers | v2.1 | 4/4 | Complete   | 2026-04-15 |
| 59. Borrowers CRUD | v2.1 | 4/4 | Complete   | 2026-04-16 |
| 60. Items CRUD | v2.1 | 4/4 | Complete   | 2026-04-16 |
| 61. Item Photos | v2.1 | 5/5 | Complete    | 2026-04-16 |
| 62. Loans | v2.1 | 2/4 | In Progress|  |
| 63. Navigation & Polish | v2.1 | 0/TBD | Not started | - |

**Total:** 55 phases complete (148 plans executed) across 11 milestones + 8 phases planned for v2.1

---
*Roadmap created: 2026-01-24*
*Last updated: 2026-04-14 after v2.1 roadmap planning (Phases 56-63)*
