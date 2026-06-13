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
- [x] **v3.0 Retro-OS Pastel Frontend** — Phases 1-17 incl. lettered 7b/10b/13b/14b (shipped 2026-06-14; clean-slate frontend2 rebuild to Retro-OS Pastel fidelity + full legacy parity)
- [ ] **Backlog — DMS Migration: Docspell → Paperless-ngx** — unscheduled; repoint the stub Docspell integration (schema-only, no client) to Paperless-ngx, the DMS running in the homelab. Schema rename + settings reshape + fresh Paperless API client + drop the compose Docspell trio. Full task breakdown in `docs/ROADMAP.md` § "DMS Migration".
- [ ] **Backlog — Expiry & Warranty Alerting** — unscheduled; `inventory.warranty_expires`/`expiration_date` are captured but no job consumes them — new asynq reminder job (loan_reminders pattern) + notifications + "expiring soon" widget/filter. Cheapest high-value win. Breakdown in `docs/ROADMAP.md` § "Expiry & Warranty Alerting".
- [ ] **Backlog — Recurring Maintenance Schedules** — unscheduled; proactive counterpart to repair logs: `maintenance_schedules` table (interval + next_due), due-reminder job, complete-action writes a repair_log and advances next_due in one tx. Breakdown in `docs/ROADMAP.md` § "Recurring Maintenance Schedules".
- [ ] **Backlog — Shortlink Registry (s.go hardening)** — unscheduled; resolver + claim wizard already shipped — replace the 3-table per-workspace `short_code` scan with a global `warehouse.short_codes` registry (one PK lookup, collisions impossible; audit B5). Backfill with collision policy, then drop per-table indexes. Breakdown in `docs/ROADMAP.md` § "Shortlink Registry".
- [ ] **Backlog — Wishlist / Purchase Planning** — unscheduled; new `wishlist_items` entity (wanted/ordered/acquired) with acquire-flow handoff into the prefilled item create wizard. Breakdown in `docs/ROADMAP.md` § "Wishlist / Purchase Planning".

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

<details>
<summary>[x] v3.0 Retro-OS Pastel Frontend (Phases 1-17 incl. 7b/10b/13b/14b) — SHIPPED 2026-06-14</summary>

See `.planning/milestones/v3.0-ROADMAP.md` for full phase details and `.planning/MILESTONES.md` for the milestone summary.

**Delivered:** Clean-slate `frontend2` rebuilt to sketch 006-008 Retro-OS Pastel fidelity AND brought to full feature parity with legacy `frontend` — online-only, CI-guarded. All 149 v3.0 requirements satisfied.

- [x] **Phase 1: Foundation + Conflict Spikes** — Vite + React 19 + TS + Tailwind 4 + RR7 scaffold, CI grep guard, carry-forward audit, three Phase 0 conflict resolutions (i18n library / mobile FAB scope / dashboard backend rollups) (completed 2026-05-01)
- [x] **Phase 2: Tokens + Type System** — `styles/tokens.css` retro-os pastel palette + Tailwind v4 `@theme` block + Silkscreen / IBM Plex Sans / IBM Plex Mono fonts + cream dot-dither body background + WCAG AA contrast audit + Cyrillic glyph metrics check (completed 2026-06-12)
- [x] **Phase 3: Layout Primitives + Bottombar** — AppShell 2×3 grid + TopBar + Sidebar (`// GROUP` labels + collapse-to-rail) + Bottombar with `useShortcuts` SSOT + `isEditableTarget` input-focus guard from first commit + PageHeader (`// ROUTE` + SESSION + LAST SYNC) + ShortcutChip + mobile breakpoint contract (completed 2026-06-12)
- [x] **Phase 4: Retro Atoms** — RetroPanel/Button/Badge/Input/Select/Combobox/Textarea/Checkbox/FileInput/FormField/Table family/Tabs/Dialog/ConfirmDialog/Toast/EmptyState/Pagination/StatusDot/HUD primitives — informed by Phase 3 layout constraints; modal-stack ESC, status pills with tabular-nums, SSE state in panel headers, multi-select Shift+Click on tables (completed 2026-06-12)
- [x] **Phase 5: Auth** — login + register + Google OAuth + GitHub OAuth + RequireAuth (with v2.0 spurious-logout-on-network-error bug fixed) + workspace switcher + sessions + password change + account deletion + connected accounts (completed 2026-06-12)
- [x] **Phase 6: Providers** — single cookie-authed SSEProvider (split `useSSEStatus()` selector + `useSSE` subscribe + generic invalidation dispatcher/contract doc) + RetroToaster/SSEProvider mounted in the verified canonical order; chrome (TopBar ONLINE dot + sse-slot RetroStatusDot + PageHeader LAST SYNC) wires to live state once; ShortcutsProvider/RetroToaster verified, not rebuilt (completed 2026-06-13)
- [x] **Phase 7: Items + Photos** — paginated list with search/filter/sort + detail with photo gallery + create/edit/archive/delete + multipart photo upload + `itemsApi.lookupByBarcode` (G-65-01 regression-guard pattern) + per-route `useShortcuts` registration (completed 2026-06-13)
- [x] **Phase 7b: Inventory** — inventory entries list + filters (virtualized when large) + create with item/location/container pickers + move dialog + quantity/status/condition inline edits + expiry/warranty fields + expiring view + movements history panel + per-item inventory panel (closes Phase 7 stub) [Gap G-1, critical] (completed 2026-06-13)
- [x] **Phase 8: Loans** — Active/Overdue/History tabbed list + create with item + borrower picker + mark returned + edit + per-item active+history panels + `?itemId=` deep-link param (completed 2026-06-13)
- [x] **Phase 9: Borrowers** — flat paginated list + CRUD with active-loan delete guard + detail with active+history panels (3 plans) (completed 2026-06-13)
- [x] **Phase 10: Taxonomy** — categories tree + locations tree + containers grouped by location + create/edit/archive with usage warnings + container delete with unassign-and-delete cascade policy (completed 2026-06-13)
- [x] **Phase 10b: Repairs + Maintenance** — repair log drawer/panel on inventory detail (CRUD + start/complete + cost rollup) + repair photos + repair attachments + maintenance schedule CRUD + due list + complete action + dashboard due-maintenance feed (consumed by Phase 13) [Gap G-2] (completed 2026-06-13)
- [x] **Phase 11: Scan (single-route)** — `/scan` with `<BarcodeScanner>` mounted ONCE + QR/UPC/EAN/Code128 + pause-on-match (prop-driven) + Android torch + manual fallback + AudioContext + ios-haptics + scan history (last 10) + 4-state result banner + post-match quick-action overlay + UPC opt-in suggestion prefill (completed 2026-06-13)
- [x] **Phase 12: Settings hub** — landing with 8 grouped rows + Profile + Security + Appearance + Language + Regional Formats + Notifications + Connected Accounts + Data Storage (online-only — clear cache + export + import only) (completed 2026-06-13)
- [x] **Phase 13: Dashboard** — 4 stat tiles + activity table (TUI columns, relative <24h then absolute) + side rail (Pending Approvals + System Alerts) + HUD row (gauge + sparkline + counts) gated behind `VITE_FEATURE_HUD_ROLLUPS` flag (Conflict 3 resolution) (completed 2026-06-13)
- [x] **Phase 13b: Analytics + Out-of-stock** — charts page (category breakdown, location values, condition/status distribution, top borrowers, monthly loan activity; lazy-loaded chart lib to protect POL-04 bundle budget) + out-of-stock table with item links. NOTE: charts aesthetic needs a Retro OS sketch (extend set 006-008) before planning [Gap G-6] (completed 2026-06-13)
- [x] **Phase 14: System group** — Approvals + My Changes + Sync History + Imports/Exports — all activity-table style with bulk operations dispatched via Bottombar (completed 2026-06-13)
- [x] **Phase 14b: Attachments + Paperless** (completed 2026-06-13) — item attachments panel on item detail (upload/list/set-primary/delete; FileInput atom from Phase 4) + Paperless-ngx settings page (slots into Settings hub) + Paperless doc search + link-to-item. NOTE: cross-tenant attachment IDOR audit finding must be fixed with this phase [Gap G-7]
- [x] **Phase 15: i18n catalog gap-fill (et + ru)** (completed 2026-06-13) — extract en messages, translate to et + ru (lift from legacy `/frontend` next-intl + v2.1 Lingui archive), locale switcher, format hooks (`useDateFormat`/`useTimeFormat`/`useNumberFormat`) used everywhere
- [x] **Phase 16: Command Palette** — Cmd+K / F2 cmdk surface filtering across routes, recent actions, and workspaces; keyboard-first navigation (completed 2026-06-14)
- [x] **Phase 17: Polish & Quality** — Playwright E2E + Go integration test for every cross-HTTP flow + axe-playwright a11y CI sweep + tab/keyboard navigation audit + bundle size CI guard + mobile breakpoint matrix re-test (320/360/768/1024/1440 px) + visual diff vs sketch 006 (completed 2026-06-14)

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
| 2 | v3.0 | 2/2 | Complete   | 2026-06-12 |
| 3 | v3.0 | 6/6 | Complete   | 2026-06-12 |
| 4 | v3.0 | 7/7 | Complete   | 2026-06-12 |
| 5 | v3.0 | 6/6 | Complete   | 2026-06-12 |
| 6 | v3.0 | 2/2 | Complete   | 2026-06-13 |
| 7 | v3.0 | 7/7 | Complete   | 2026-06-13 |
| 7b | v3.0 | 6/6 | Complete   | 2026-06-13 |
| 8 | v3.0 | 6/6 | Complete   | 2026-06-13 |
| 9 | v3.0 | 3/3 | Complete   | 2026-06-13 |
| 10 | v3.0 | 5/5 | Complete   | 2026-06-13 |
| 10b | v3.0 | 5/5 | Complete   | 2026-06-13 |
| 11 | v3.0 | 8/8 | Complete   | 2026-06-13 |
| 12 | v3.0 | 7/7 | Complete   | 2026-06-13 |
| 13 | v3.0 | 5/5 | Complete   | 2026-06-13 |
| 13b | v3.0 | 5/5 | Complete   | 2026-06-13 |
| 14 | v3.0 | 8/8 | Complete   | 2026-06-13 |
| 14b | v3.0 | 0/TBD | Not started | - |
| 15 | v3.0 | 4/4 | Complete   | 2026-06-13 |
| 16 | v3.0 | 3/3 | Complete   | 2026-06-13 |
| 17 | v3.0 | 4/4 | Complete   | 2026-06-14 |

**Total:** 65 phases complete (185 plans executed: +65-11 gap-closure Wave 8 regression test for G-65-01, Phase 65 now 11/11 SHIPPABLE — Option C Playwright E2E + Go HTTP+Postgres integration test) across 12 milestones; v2.2 (Phases 64-72) active

## Backlog — deferred from v3.0 parity (2026-06-12)

Cut from v3.0 per `docs/FRONTEND2_FEATURE_PARITY_PLAN.md` §5/§8 with explicit decisions; revisit post-parity:

- **Quick capture (G-11)** — camera-first rapid item entry with batch settings + auto-SKU; Phase 7 create form + Phase 11 scan cover the core capture loop.
- **Web push (G-5 stretch)** — DECISION: dropped for v3.0; requires a service worker, which the online-only CI grep guard forbids. Notification prefs UI stays wired to in-app only; the grep guard stays intact.
- **Companies + favorites UI (G-10 remainder)** — backend has full CRUD + favorites toggle; no current UI use-case. Deferred deliberately.
- **Dark theme** — Retro OS tokens are light-only; v3.0 Appearance ships "light only". Dark variant needs a token set v2 (design work).

---
*Roadmap created: 2026-01-24*
*Last updated: 2026-06-12 — v3.0 roadmap amended per `docs/FRONTEND2_FEATURE_PARITY_PLAN.md`: added lettered phases 7b (Inventory/G-1), 10b (Repairs+Maintenance/G-2), 13b (Analytics+Out-of-stock/G-6), 14b (Attachments+Paperless/G-7); folded gap items into existing phases 3-17 (each carries a "Parity additions (2026-06-12)" note); added requirement IDs INV/RPR/MNT/ANL/ATT/PPL/WISH/DECL/NOTIF/ATOM-FB + AUTH-11/12, TAX-07, SCAN-12, SETT-10/11, POL-06; updated dependency edges (8→7b, 13→+7b+10b); deferred quick-capture/web-push/companies-favorites/dark-theme to backlog. Existing integer phase numbers and all 106 prior requirement IDs untouched.*
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
