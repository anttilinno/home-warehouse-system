# Frontend2 Feature Parity Plan

**Date:** 2026-06-12
**Goal:** Bring `frontend2/` (Vite + React 19, Retro OS Pastel, v3.0) to feature parity with the legacy `frontend/` (Next.js, v1.x) so the legacy app can be retired.
**Companion docs:** `.planning/ROADMAP.md` (v3.0 phases 1–17), `.planning/STATE.md` (locked decisions D-05..D-11), `.planning/sketches/MANIFEST.md` (Retro OS canonical sketches 006–008).

This document is the *parity contract*: an exhaustive inventory of what the legacy frontend does, where each capability lands in the v3.0 roadmap, and — critically — **what the current roadmap does not cover**. Sections 5–6 propose roadmap amendments for those gaps.

---

## 1. Current State Summary

### frontend2 today (Phase 1 complete, Phase 2 in flight)

| Area | Status |
|------|--------|
| Scaffold (Vite 8, React 19, TS, Tailwind 4, TanStack Query, RHF+zod, Lingui) | ✅ Done |
| API client (`src/lib/api.ts`): cookie-JWT, 401 single-flight refresh, multipart, `/api` proxy rewrite | ✅ Done (locked invariants) |
| Login page + RequireAuth guard | ✅ Done (email/password only) |
| Dashboard: 4 stat tiles, 8 entity counters, activity table | ✅ Done (real data) |
| Retro primitives: Window, BevelButton, RetroInput, RetroTable, StatCard, RetroBadge | ✅ Done |
| Design tokens (`src/styles/tokens.css`), WCAG AA audited, Cyrillic-safe fonts | ✅ Done |
| Sidebar (static, most items disabled) | ✅ Done |
| E2E harness (Playwright chromium+firefox), Vitest+RTL+MSW | ✅ Done |
| Everything else | 🔲 Not started |

### Legacy frontend scope (what "parity" means)

~30 routes, 19 API modules, 5 context providers, ~40 custom hooks, full PWA/offline stack, SSE real-time, barcode scanning, photo pipeline, approval workflow, import/export, i18n ×3 locales. Full inventory in Section 3.

### Explicit non-goals for v3.0 (parity exclusions)

These legacy capabilities are **deliberately dropped** — do not treat their absence as a parity failure:

1. **Offline/PWA stack** — IndexedDB cache, mutation queue, conflict resolution dialog, service-worker photo upload queue, offline Fuse.js search, PWA install prompt, persistent-storage request. v3.0 is online-only (CI grep guard already forbids `idb`/`serwist`/offline/sync imports).
2. **Sync conflict UI** (`/sync-history` as *conflict* log) — only meaningful with offline writes. Phase 14 reuses the route name for server-side audit/sync visibility; the local-conflict resolution UI does not return.
3. **Marketing landing page** — legacy `(marketing)` route group. v3.0 boots straight to `/login` / `/`. If a public landing is ever needed it is a separate project.
4. **URL-based locale routing** (`/en/...`, `/et/...`) — v3.0 uses runtime locale switching via Lingui, no locale path segment. Keep it that way; deep links stay locale-free.

---

## 2. Backend API Coverage Map

The backend (huma + chi) exposes ~220 endpoints across 25 domains. Parity requires frontend2 to consume the same surface the legacy frontend consumed. Domains and their consuming feature areas:

| Backend domain | Endpoints (prefix, workspace-scoped unless noted) | Consuming feature (plan section) |
|---|---|---|
| Auth | `/auth/login`, `/auth/register`, `/auth/refresh`, `/auth/logout`, `/auth/oauth/*`, `/auth/authelia/login` | Phase 5 |
| User profile | `/users/me`, `/users/me/password`, `/users/me/preferences`, `/users/me/avatar`, `/users/me/can-delete`, `/users/me/workspaces`, `/users/me/sessions` | Phases 5, 12 |
| Workspaces + members | `/workspaces`, `/workspaces/by-slug/{slug}`, `/members/*` | Phases 5, 12 (+ gap G-9 member management) |
| Notifications | `/notifications/*` | Gap G-5 |
| Web push | `/push/*` | Gap G-5 (stretch) |
| Categories / Locations / Containers | full CRUD + archive/restore + breadcrumb + search | Phase 10 |
| Companies | full CRUD + archive/restore | Gap G-10 |
| Labels | full CRUD + archive/restore; `/items/{id}/labels/{label_id}` attach/detach | Phase 7 (attach UI) + Gap G-10 (label CRUD) |
| Items | list/search/by-barcode/by-category, CRUD, archive/restore, labels | Phases 7, 11 |
| Item photos | upload, serve, thumbnail, primary, caption, reorder, bulk-delete, bulk-caption, zip download, duplicate check | Phase 7 |
| Item attachments | list, upload, create, set-primary, delete | Gap G-7 |
| Inventory | list, by-item/location/container, available, total-quantity, expiring, CRUD, quantity, status, move, archive/restore | Gap G-1 (biggest roadmap hole) |
| Borrowers + Loans | full CRUD, active/overdue, return, extend, per-borrower/per-item/per-inventory loan lists | Phases 8, 9 |
| Repairs + repair photos + repair attachments | full CRUD, start/complete, cost rollup, photo + attachment subresources | Gap G-2 |
| Maintenance | CRUD, `/maintenance/due`, complete, per-inventory list | Gap G-2 |
| Wishlist | CRUD + status transitions | Gap G-3 |
| Declutter | `/declutter`, `/declutter/counts`, mark-used | Gap G-4 |
| Activity | `/activity`, `/activity/recent`, per-entity | Phase 13 (done for dashboard), Phase 14 |
| Movements | `/movements`, per-location, per-inventory | Gap G-1 (inventory detail) |
| Favorites | list, check, toggle | Gap G-10 (stretch) |
| Pending changes | list, detail, my-changes, approve, reject | Phase 14 |
| Import jobs | jobs list/detail/errors/delete, upload | Phase 14 |
| Paperless DMS | settings get/put/delete, search, document detail | Gap G-7 |
| Barcode / shortlink | `/barcode/{barcode}`, public `/r/{code}` redirect | Phase 11 + Gap G-8 (claim flow) |
| Analytics | `/analytics/dashboard`, `/analytics/activity`, summary, category-stats, location-values, top-borrowers, out-of-stock | Phase 13 (partial) + Gap G-6 |
| SSE | `GET /workspaces/{id}/sse` | Phase 6 |
| Sync (offline) | `/sync/deleted`, `/sync/batch` | **Not consumed** (offline dropped) |

---

## 3. Parity Matrix — Legacy Feature → v3.0 Phase

Legend: ✅ shipped in frontend2 · 🗺️ covered by existing roadmap phase · ⚠️ partially covered · ❌ **gap, not in roadmap** (see Section 5).

### 3.1 Auth & Account

| Legacy capability | Legacy location | v3.0 disposition |
|---|---|---|
| Email/password login | `app/[locale]/(auth)/login` | ✅ Shipped |
| Registration | `(auth)/register` | 🗺️ Phase 5 (AUTH) |
| Google/GitHub OAuth + callback + error handling | `(auth)/auth/callback`, `features/auth/social-login.tsx` | 🗺️ Phase 5 |
| Authelia SSO login | backend `/auth/authelia/login` | ⚠️ Phase 5 — confirm scope; backend shipped 2026-06 (commit 8e13faf), legacy frontend predates it. Needs a "Log in with SSO" button when env-configured. |
| Session list + revoke one / revoke all | settings/security | 🗺️ Phase 5 + 12 |
| Password change | settings/security | 🗺️ Phase 5 + 12 |
| Account deletion (can-delete check + "DELETE" confirm) | settings/security | 🗺️ Phase 5 + 12 |
| Connected OAuth accounts (link/unlink) | settings/integrations | 🗺️ Phase 5 + 12 |
| Workspace switcher | `components/dashboard/workspace-switcher.tsx` | 🗺️ Phase 5. Note: current DashboardPage hardcodes first workspace — switcher must replace that. |
| Logout (with revocation) | user menu | ⚠️ Phase 5. Audit flagged broken logout revocation (`docs/audit/`) — fix backend contract while wiring this. |

### 3.2 Core Entities

| Legacy capability | v3.0 disposition |
|---|---|
| Items list: search, filters, sort, infinite scroll, bulk select, saved filters, export | 🗺️ Phase 7 (ITEM-01..10). Saved-filter presets + bulk action bar: verify the phase plan includes them; legacy had `use-saved-filters`, `use-bulk-selection`, `bulk-action-bar.tsx`. |
| Item create / edit wizard, archive, restore, delete | 🗺️ Phase 7 |
| Item detail: photos, metadata, linked inventory entries | ⚠️ Phase 7 covers photos/metadata; **linked inventory panel depends on Gap G-1** |
| Item labels attach/detach | ⚠️ Phase 7 — attach UI; label CRUD itself is Gap G-10 |
| Duplicate-photo warning (perceptual hash check) | 🗺️ Phase 7 (backend `/photos/check-duplicate` exists) |
| Photo pipeline: upload w/ progress, compression, EXIF fix, gallery, viewer, captions, reorder, primary, bulk ops, zip download | 🗺️ Phase 7 — make sure bulk-caption/bulk-delete/zip-download endpoints are in scope, legacy used all of them |
| Quick Capture (camera strip + batch settings + auto-SKU) | ❌ **Gap G-11** |
| Locations: hierarchical list, breadcrumbs, CRUD, archive/restore, search | 🗺️ Phase 10 |
| Containers: CRUD, archive/restore, search, grouped by location | 🗺️ Phase 10 |
| Categories: hierarchical CRUD | 🗺️ Phase 10 |
| **Inventory entries: virtualized table, inline edit, condition/status, move dialog, quantity, expiry & warranty fields, repair-history drawer** | ❌ **Gap G-1 — the largest single omission in the roadmap** |
| Loans: list w/ tabs, create w/ pickers, return, extend, overdue, per-item panels, CSV export | 🗺️ Phase 8 (LOAN-01..06); CSV export → fold into Phase 14 export work |
| Borrowers: CRUD, search, loan history, delete guard | 🗺️ Phase 9 |

### 3.3 Smart Features

| Legacy capability | v3.0 disposition |
|---|---|
| Barcode/QR scan page (camera kept mounted, torch, formats, haptics, audio, history, manual entry, quick-action overlay) | 🗺️ Phase 11 (SCAN-01..11) — roadmap scope matches legacy well |
| Out-of-stock page (`/analytics/out-of-stock`) | ❌ **Gap G-6** |
| Wishlist (wanted/ordered/acquired tabs) | ❌ **Gap G-3** (backend shipped 2026-06-11) |
| Declutter (unused-items analysis, score badge, grouping, CSV export, mark-used) | ❌ **Gap G-4** |
| Analytics charts page (category breakdown, location value, condition/status distribution, top borrowers, monthly loan activity; lazy recharts) | ❌ **Gap G-6** (Phase 13 covers only dashboard tiles/HUD; sidebar lists "Analytics" as pending nav with no owning phase) |
| Expiring-items dashboard card (`/inventory/expiring`) | ⚠️ Phase 13 side-rail "System Alerts" — confirm expiry feed is included; depends on Gap G-1 types |
| Due-maintenance dashboard card (`/maintenance/due`) | ❌ part of **Gap G-2** |
| Global search (cross-entity) + command palette | 🗺️ Phase 16 (cmdk) — fold global entity search into palette rather than separate dropdown |
| Keyboard shortcuts (N/S/L/I, ? help dialog) | 🗺️ Phase 3 (useShortcuts SSOT) + Phase 16 |
| FAB with context actions (mobile) | 🗺️ Phase 3 (D-05/D-07) |

### 3.4 Workflow & Data

| Legacy capability | v3.0 disposition |
|---|---|
| Approvals queue + detail + approve/reject w/ reason | 🗺️ Phase 14 |
| My Changes | 🗺️ Phase 14 |
| Import jobs: history, upload (CSV/JSON/XLSX), per-row errors, job detail | 🗺️ Phase 14 |
| Per-entity CSV export from list pages | 🗺️ Phase 14 (verify list-page export buttons, not just a central export screen) |
| Workspace backup/restore (full export Excel/JSON, import) | 🗺️ Phase 12 (SETT Data Storage) |
| Claim link `/claim/[code]` (public scan-to-claim loan flow) | ❌ **Gap G-8** |
| Repair logs CRUD + start/complete + cost rollup + repair photos + repair attachments | ❌ **Gap G-2** |
| Maintenance schedules CRUD + complete | ❌ **Gap G-2** |
| Paperless-ngx: workspace settings, doc search, link documents | ❌ **Gap G-7** (backend migrated from Docspell 2026-06-11, commit 3dd349d) |
| Item attachments (non-photo files, set-primary) | ❌ **Gap G-7** |
| Workspace member management (invite, role change, remove) | ❌ **Gap G-9** (legacy UI was thin here; backend `/members/*` is full CRUD — decide scope explicitly) |

### 3.5 Cross-cutting

| Legacy capability | v3.0 disposition |
|---|---|
| SSE real-time (shared connection, auto-reconnect, per-entity list refresh, status indicator) | 🗺️ Phase 6 (SSEProvider) — list-page invalidation wiring must be added per feature phase as it lands |
| Notifications: dropdown, unread badge, mark read/all, prefs by type | ❌ **Gap G-5** (settings page for prefs is Phase 12, but the bell/dropdown/badge UI has no phase) |
| Web push subscribe/unsubscribe | ❌ Gap G-5 stretch — needs service worker; v3.0 has none by design. Decide: drop push or allow a minimal push-only SW. |
| Theme light/dark/system | ⚠️ Phase 12 Appearance — Retro OS tokens are light-only today; dark variant needs design work (token set v2) or the setting ships as "light only" initially. Decide before Phase 12. |
| i18n en/et/ru + locale switcher | 🗺️ Phase 15 |
| Regional formats (date/time/number/currency hooks honoring user prefs) | 🗺️ Phase 15 (format hooks) + Phase 12 (settings UI) |
| Toasts (sonner equivalent) | 🗺️ Phase 4 (Toast atom) + Phase 6 (ToastProvider) |
| Virtualized tables for big lists | 🗺️ Phase 4/7 — bring `@tanstack/react-virtual` when item count warrants |
| Form drafts (sessionStorage autosave) | ⚠️ nice-to-have; attach to Phase 7 create/edit forms if cheap, else drop |
| Skip links / a11y | 🗺️ Phase 17 (axe sweep) |
| Avatar upload | 🗺️ Phase 12 Profile |

---

## 4. Phase-by-Phase Execution Detail (existing roadmap, parity lens)

For each upcoming roadmap phase, the parity-critical deliverables and the legacy reference implementation to consult. Phases 2–4 and 6 are infrastructure; 5, 7–16 deliver parity features; 17 is verification.

### Phase 2 — Tokens + Type System *(in flight)*
Nothing parity-visible. Exit criterion relevant to parity: Cyrillic rendering verified (legacy supported ru fully).

### Phase 3 — Layout Primitives + Bottombar
Parity-critical: AppShell, TopBar, Sidebar collapse, mobile FAB (D-05/D-07), Bottombar (D-06), `useShortcuts` SSOT, PageHeader.
Legacy refs: `components/dashboard/dashboard-shell.tsx`, `header.tsx`, `sidebar.tsx`, `components/layout/bottombar.tsx`, `lib/hooks/use-fab-actions.tsx`, `use-keyboard-shortcuts.ts`.
Parity additions to verify in plan: TopBar must reserve slots for workspace switcher (Phase 5), notifications bell (Gap G-5), SSE status indicator (Phase 6), user menu.

### Phase 4 — Retro Atoms
Parity-critical: full form-control family (Select, Combobox, Checkbox, FileInput), Dialog/ConfirmDialog, Tabs, Toast, EmptyState, Pagination, Table family.
Legacy refs: `components/ui/*` — especially `filter-bar.tsx`, `filter-popover.tsx`, `bulk-action-bar.tsx`, `saved-filters.tsx`, `infinite-scroll-trigger.tsx`. **Add to Phase 4 scope if missing:** FilterBar, FilterPopover, BulkActionBar, SavedFilters as retro atoms — Phases 7/8/14 all consume them; building them once here avoids three ad-hoc copies.

### Phase 5 — Auth
Parity-critical (AUTH-01..10): register, Google/GitHub OAuth (initiate → callback → exchange), workspace switcher, sessions, password change, account deletion, connected accounts.
Parity additions:
- **Authelia SSO button** (env-gated) — backend route exists; legacy never had UI for it. Cheap to add here.
- **Fix logout revocation** — audit finding; wire `POST /auth/logout` so the session is actually revoked server-side, and clear refresh-token state client-side.
- Workspace switcher must remove DashboardPage's "first workspace" hardcode; current-workspace becomes app-level state (context or router param — decide once, every workspace-scoped query keys off it).

### Phase 6 — Providers
Parity-critical: SSEProvider with auto-reconnect + backoff, event→query-invalidation map.
Legacy refs: `lib/contexts/sse-context.tsx`, `lib/hooks/use-sse.ts`.
Design note: define the invalidation contract now (event entity type → TanStack Query key prefixes) so Phases 7–10 only register keys, not plumbing. Include SSE status indicator atom (legacy `sse-status-indicator.tsx`).

### Phase 7 — Items + Photos
Parity-critical (ITEM-01..10): paginated list w/ search/filter/sort, detail w/ gallery, create/edit/archive/delete, multipart upload, barcode lookup regression guard.
Parity additions to confirm in phase plan:
- Bulk selection + bulk archive/delete; saved filter presets; per-list CSV export hook-in point.
- Photo extras legacy had: captions, reorder, set-primary, bulk-delete, bulk-caption, zip download, duplicate-check warning dialog, client-side compression + EXIF rotation before upload (`lib/utils/image.ts`).
- Labels attach/detach UI on item detail (needs at least read-only label list even before Gap G-10 CRUD).
- Item detail must link to inventory entries (stub until G-1 lands; ship the panel with G-1).

### Phase 8 — Loans
Parity-critical (LOAN-01..06): tabs (active/overdue/history), create with item+borrower pickers, return, extend (legacy `PATCH /loans/{id}/extend`), edit, per-item panels, `?itemId=` deep link.
Parity additions: overdue highlighting, CSV export of loan list.

### Phase 9 — Borrowers
Parity-critical (BORR-01..05): list, CRUD, active-loan delete guard, detail with loan panels. Matches legacy.

### Phase 10 — Taxonomy
Parity-critical (TAX-01..06): category tree, location tree + breadcrumbs, containers grouped by location, archive warnings, cascade policy.
Parity additions: search endpoints exist for locations/containers — wire type-ahead pickers here; Phases 7/8 and Gap G-1 forms reuse them.

### Phase 11 — Scan
Parity-critical (SCAN-01..11): roadmap already mirrors legacy scanner closely (single mount, torch, formats, haptics via ios-haptics, AudioContext beep, history ×10, manual fallback, quick actions, UPC opt-in).
Parity additions: legacy scan history persisted to localStorage (20 entries) — roadmap says 10; either is fine, just persist it. Re-add the **by-barcode Playwright spec** (CLAUDE.md flags this as a standing gap since the v2.2 wipe).

### Phase 12 — Settings hub
Parity-critical (SETT-01..09): profile (+avatar), security (sessions/password/delete), appearance, language, regional formats, notification prefs, connected accounts, data storage (workspace backup/restore).
Open decisions called out in Section 3.5: dark theme feasibility under Retro OS tokens; push-notification toggle only if Gap G-5 stretch is accepted.

### Phase 13 — Dashboard
Already partially shipped. Remaining parity items: side rail (pending approvals count, system alerts), HUD row (D-09..D-11 — needs the two new backend stats endpoints), expiring-items card, due-maintenance card (after Gap G-2).

### Phase 14 — System group
Parity-critical (SYS-01..04): approvals (+ detail + reject-with-reason), my-changes, sync-history (server-side flavor), imports (job list/detail/errors + upload), exports.
Parity additions: per-entity export buttons on list pages (items/loans/inventory), not only a central screen. Legacy entity import (`POST /import/{entity}`) and workspace import both existed — confirm backend's current import surface (`/imports/upload` + jobs) covers both shapes.

### Phase 15 — i18n gap-fill
ru catalog completion, locale switcher, format hooks (`useDateFormat`/`useTimeFormat`/`useNumberFormat` honoring `/users/me/preferences`). Matches legacy capability.

### Phase 16 — Command Palette
Legacy had palette (Cmd+K) + separate global-search dropdown. Recommendation: merge — palette handles both nav and entity search (backend search endpoints per entity exist).

### Phase 17 — Polish & Quality
Parity verification gate — see Section 7.

---

## 5. Gaps: Features Missing From the Roadmap

These exist in the legacy frontend (and/or backend ships them today) but appear in **no** roadmap phase. Each needs a roadmap amendment. Ordered by recommended priority.

### G-1 · Inventory management UI — **critical**
The roadmap jumps from Items (Phase 7) to Loans (Phase 8) with no phase for *inventory entries* (item ⨯ location ⨯ quantity ⨯ condition ⨯ status ⨯ expiry ⨯ warranty). Legacy had a full `/dashboard/inventory` page (virtualized table, inline edit, move dialog, status/condition changes, expiry data) and 15 backend endpoints serve it. Loans reference inventory; the dashboard's low-stock tile derives from it; expiry alerts read it; declutter and maintenance hang off it.
**Proposal:** new phase **7b "Inventory"** between Items and Loans (Loans depends on it conceptually): list + filters, create entry (item/location/container pickers from Phase 10 search — or inline simple selects until then), move dialog, quantity/status/condition edits, expiring view, movements history panel (`/movements` endpoints), per-item inventory panel on item detail.
**Estimated weight:** comparable to Phase 7; the single biggest unplanned chunk.

### G-2 · Repairs & maintenance — high
Backend: repair logs (CRUD, start/complete, cost rollup), repair photos, repair attachments, maintenance schedules (CRUD, due list, complete). Legacy: repair-history drawer on inventory rows, maintenance schedules card, due-maintenance dashboard card. Backend maintenance shipped 2026-06-11 (migrations 002–006 batch).
**Proposal:** new phase after G-1 + Phase 8: repair log drawer/panel on inventory detail, repair photo upload (reuses Phase 7 photo atoms), maintenance schedule CRUD + due list + complete action, dashboard due-maintenance card (feeds Phase 13 side rail).

### G-3 · Wishlist — medium
Legacy: full page with wanted/ordered/acquired status tabs. Backend CRUD shipped 2026-06-11.
**Proposal:** small phase (or fold into Phase 14 "System group" as a fourth tab-page): list w/ status tabs, add/edit dialog, status transitions, delete.

### G-4 · Declutter — medium
Legacy: unused-items page (last-accessed analysis), score badge, grouping, CSV export, mark-used action. Backend: 3 endpoints.
**Proposal:** small phase alongside G-3. Reuses table/filter/export atoms.

### G-5 · Notifications UI — medium
Legacy: bell dropdown + unread badge + mark-read/all; push subscription. Phase 12 covers only the *preferences* page. Backend: 6 notification + 4 push endpoints.
**Proposal:** in-app part (bell, dropdown, badge, mark read) → attach to Phase 6 (providers) or Phase 13; it's small once TopBar exists. Web push → explicit decision: requires a service worker, which v3.0 forbids by convention. Recommend **drop push for v3.0**, revisit post-parity; the CI grep guard stays intact.

### G-6 · Analytics page + out-of-stock — medium
Legacy: charts page (category breakdown, location values, condition/status distribution, top borrowers, monthly loan activity — lazy-loaded recharts) and a dedicated out-of-stock page. Backend endpoints all exist. The v3.0 sidebar already lists "Analytics" as a pending nav item, but no phase owns it.
**Proposal:** new phase after Phase 13: charts (lazy-load chart lib to protect bundle budget — POL-04), out-of-stock table with item links. Retro OS treatment of charts needs a sketch first (extend sketch set 006–008).

### G-7 · Attachments + Paperless — low/medium
Item attachments (non-photo files): 6 backend endpoints, legacy had upload + primary. Paperless-ngx: settings + search + doc detail; backend migrated 2026-06-11. Legacy had Paperless integration in settings.
**Proposal:** one phase: attachments panel on item detail (FileInput atom from Phase 4), Paperless settings page (slot into Phase 12's Connected Accounts group), Paperless doc search + link-to-item.

### G-8 · Claim link flow — low
Legacy `/dashboard/claim/[code]`: public shortlink (`/r/{code}` backend, shipped commit 86667fd) lands a scanner-less user on a claim page to register a loan.
**Proposal:** small addition to Phase 11 (scan) or Phase 8 (loans): route `/claim/:code`, resolve via shortlink/barcode lookup, present claim-as-loan form. Decide auth posture (legacy required login; keep that).

### G-9 · Workspace member management — low (scope decision needed)
Backend `/members/*` is full CRUD; legacy UI exposure was minimal. If multi-user workspaces matter for v3.0, add a Members page (list, role change, remove, add-by-email) to Phase 12; otherwise explicitly defer and note it.

### G-10 · Labels & Companies CRUD, Favorites — low
Backend has full CRUD for labels and companies, plus favorites toggle. Legacy UI: label attach only (no standalone label manager); companies and favorites effectively unused in UI.
**Proposal:** Label manager (simple CRUD list + color) → small Phase 10 addition since item label-attach (Phase 7) needs labels to exist. Companies + favorites → defer unless a use-case appears; document as deliberate.

### G-11 · Quick Capture — low (UX-driven)
Legacy `/items/quick-capture`: rapid photo-first item entry with batch category/location settings and auto-SKU. Power-user mobile flow; heavy (camera, photo strip, batch context).
**Proposal:** defer to post-parity backlog OR slot after Phase 11 (reuses camera + photo upload). Recommend deferring — Phase 7's create form plus Phase 11's scan covers the core capture loop; quick-capture is an optimization.

---

## 6. Recommended Roadmap Amendment

Insertion-point view (existing phases keep their numbers; new work slots as lettered phases to avoid renumbering 106 tracked requirements):

| Order | Phase | Content | Depends on |
|---|---|---|---|
| … | 7 | Items + Photos (+ bulk/saved-filters/labels-attach confirmations, §4) | 4, 5, 6 |
| **new** | **7b** | **Inventory (G-1)** + movements panel | 7 |
| … | 8 | Loans | 7b |
| … | 9 | Borrowers | 8 |
| … | 10 | Taxonomy (+ label manager, G-10) | 4 |
| **new** | **10b** | **Repairs + Maintenance (G-2)** | 7b |
| … | 11 | Scan (+ claim flow G-8) | 7 |
| … | 12 | Settings (+ Paperless settings G-7, members decision G-9, theme decision) | 5 |
| … | 13 | Dashboard completion (+ expiry card from 7b, maintenance card from 10b, notifications bell G-5) | 7b, 10b |
| **new** | **13b** | **Analytics + Out-of-stock (G-6)** | 13 |
| … | 14 | System group (+ wishlist G-3, declutter G-4, per-list exports) | 4 |
| **new** | **14b** | **Attachments + Paperless docs (G-7)** | 7, 12 |
| … | 15 | i18n gap-fill — *moves later in calendar, scope unchanged; re-extract after all new pages land* | all feature phases |
| … | 16 | Command palette (+ global entity search) | 3 |
| … | 17 | Polish & parity verification (Section 7) | everything |
| backlog | — | Quick capture (G-11), web push (G-5b), companies/favorites UI (G-10), dark theme (if cut from 12) | — |

Net added scope: ~4 new phases (7b, 10b, 13b, 14b) plus small additions inside existing ones. 7b is the only large one.

---

## 7. Parity Verification (extends Phase 17)

Definition of done for "feature parity":

1. **Route checklist** — every Section 3 row marked 🗺️/⚠️/❌-with-accepted-amendment is either shipped or explicitly waived in this doc's Section 1 exclusions list. Track as a living checklist (append status column per phase completion).
2. **Endpoint coverage diff** — script or manual audit: list backend endpoints consumed by legacy `frontend/lib/api/*` minus those consumed by `frontend2/src` (grep for path literals). Target: empty set, excluding `/sync/*`, `/push/*` (if dropped), and endpoints legacy itself never called.
3. **E2E flows** (Playwright, per CLAUDE.md conventions — real backend + Postgres): login (incl. one OAuth mock or skip-with-reason), item CRUD + photo upload, inventory create/move, loan create/return, borrower CRUD, taxonomy CRUD, scan by-barcode (standing G-65-01 guard), approval approve/reject, import job upload, settings save, wishlist, declutter mark-used.
4. **Go integration tests** for every new cross-HTTP contract introduced by parity work (per existing `tests/testdb` harness pattern).
5. **i18n completeness** — `bun run i18n:extract` after final feature phase; et + ru catalogs at 100% for all parity pages.
6. **a11y + bundle budgets** — POL-03/POL-04 apply to all new pages, including lazy-loaded chart lib (13b).
7. **Legacy retirement gate** — one full week of dogfooding frontend2 against production data with legacy still available; then legacy `frontend/` archived (kept in git history, removed from deploy).

---

## 8. Risks & Open Decisions

| # | Risk / decision | Owner action |
|---|---|---|
| 1 | **Inventory phase (7b) is unbudgeted** and sits on the critical path before Loans. | Amend ROADMAP before Phase 7 planning; re-estimate milestone. |
| 2 | Dark theme vs Retro OS light-only tokens. | Decide before Phase 12; if deferred, Appearance settings ships theme-less or "light only". |
| 3 | Web push without service worker conflicts with no-SW convention. | Recommend: drop push for v3.0, keep notification prefs UI wired to in-app only. |
| 4 | Charts aesthetic has no Retro OS sketch. | Sketch before 13b (extend `.planning/sketches/`, MANIFEST update). |
| 5 | Workspace switching state model (context vs route param) decided once in Phase 5 affects every query key after. | Decide in Phase 5 planning, document in STATE.md as D-12. |
| 6 | Logout revocation + cross-tenant attachment IDOR are open audit findings touching parity surface (auth, attachments). | Fix backend issues before/with Phase 5 and 14b respectively (`docs/audit/`). |
| 7 | Legacy entity-level import (`POST /import/{entity}`) vs current job-based import — backend surface may have diverged. | Verify during Phase 14 planning; adjust scope to whatever backend actually serves. |
| 8 | SSE invalidation contract built in Phase 6 but consumed by 7–10; under-specifying it forces rework. | Write the event→query-key map as a Phase 6 deliverable doc. |

---

## 9. Source Inventories

Compiled 2026-06-12 from:
- Legacy frontend: `frontend/app/**` (route tree), `frontend/lib/api/*` (19 API modules), `frontend/components/**`, `frontend/lib/hooks/**`, `frontend/lib/contexts/**`.
- frontend2: `frontend2/src/**` (routes, features, components, lib, styles, locales).
- Backend: `backend/internal/domain/**/handler.go` (~220 registered huma/chi routes across 25 domains).
- Planning: `.planning/ROADMAP.md` (v3.0, 17 phases, 106 requirements), `.planning/STATE.md` (D-05..D-11).
