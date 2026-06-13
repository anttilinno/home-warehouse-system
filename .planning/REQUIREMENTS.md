# Requirements: v3.0 Premium-Terminal Frontend

**Milestone:** v3.0
**Status:** Active
**Last updated:** 2026-04-30
**Source:** `.planning/research/SUMMARY.md` + 4 parallel research outputs (STACK, FEATURES, ARCHITECTURE, PITFALLS) + user scoping decisions

> **Scope:** Clean-slate rebuild of `/frontend2` with sketch 005 premium-terminal fidelity AND feature parity with the legacy `/frontend`. The v2.1 architectural spine (Vite + React 19 + Tailwind 4 + RR7 library mode + TanStack Query + cookie-JWT) survives the wipe; the chrome, atoms, and feature surfaces are all rebuilt. Online-only (CI grep-guarded). v2.0/v2.1 shipped predecessors live in `.planning/milestones/v2.{0,1}-phases/`; v2.2 was abandoned with this wipe (`.planning/milestones/v2.2-phases-abandoned/`).
>
> REQ-IDs use fresh per-category numbering for v3.0 — predecessor IDs from v2.0/v2.1/v2.2 archives are not bumped, since this rebuild redoes the implementations rather than extending them.

---

## v3.0 Requirements

### Foundation (FOUND)

- [ ] **FOUND-01**: User-facing scaffold — fresh Vite + React 19 + TypeScript 5.9 + Tailwind CSS 4 (`@tailwindcss/vite`) + React Router 7 (library mode) + TanStack Query 5 + react-hook-form 7 + zod 4 application boots from a blank `/frontend2` and serves a placeholder shell at `localhost:5173`.
- [ ] **FOUND-02**: CI-enforced online-only constraint — `scripts/check-forbidden-imports.mjs` (or equivalent) blocks any new import of `idb`, `serwist`, `offline`, or `sync*` and runs in the lint pipeline.
- [ ] **FOUND-03**: Carry-forward audit document at `.planning/research/CARRY-FORWARD.md` enumerates exactly what ports verbatim from `/frontend` (auth flow, OAuth callback, format hooks, Playwright auth helper, grep guard) versus what is rebuilt (chrome, atoms, layout, providers).
- [ ] **FOUND-04**: i18n library decision (Conflict 1) resolved by Phase 0 spike — empirical Vite-8-+-SWC compat test on Lingui v6 vs react-intl, locked decision documented in `.planning/research/I18N-DECISION.md`.
- [ ] **FOUND-05**: Mobile FAB scope (Conflict 2) explicitly resolved in v3.0 milestone scope — recorded as either "dropped, Bottombar replaces" or "kept alongside Bottombar with safe-area math".
- [ ] **FOUND-06**: Dashboard backend rollups (Conflict 3) decision recorded — either "ship feature-flagged with `VITE_FEATURE_HUD_ROLLUPS=false` default" or "defer dashboard HUD to v3.1"; backend coordination kicked off if shipping.

### Design Tokens & Type System (TOKEN)

- [x] **TOKEN-01**:
  - **ORIGINAL (2026-04-30, premium-terminal — SCRAPPED):** `styles/tokens.css` ports the locked premium-terminal palette from `.claude/skills/sketch-findings-home-warehouse-system/sources/themes/default.css` verbatim (--bg-base, --bg-panel, --bg-panel-2, --bg-elevated, --bg-hover, --bg-active, --fg-dim, --fg-mid, --fg-base, --fg-bright, --fg-glow, --amber, --amber-bright, --accent-{warn,danger,info}{,-bg}, --border-{thin,thick,glow}).
  - **REVISED (2026-06-11, retro-os):** `styles/tokens.css` ports the retro-os pastel palette from `.planning/sketches/themes/retro-os.css` (mirrored at `.claude/skills/sketch-findings-home-warehouse-system/sources/themes/retro-os.css`) verbatim: surfaces (--bg-desktop, --bg-panel, --bg-panel-2, --bg-pressed), ink (--fg-ink, --fg-muted, --fg-faint), pastel fills (--titlebar-blue, --titlebar-pink, --titlebar-mint, --titlebar-butter), deep companions (--accent-blue-deep, --accent-pink-deep, --accent-mint-deep, --warn-deep), status (--danger, --danger-bg, --warn-bg, --ok-bg, --info-bg), bevel system (--border-ink, --bevel-light, --bevel-shade, --shadow-hard, --shadow-hard-ink, --table-rule, --table-stripe), type (--font-display, --font-body, --font-mono), spacing (--sp-1..6). The scrapped --bg-base / --amber* / --fg-glow / --fg-dim/mid/bright / --border-glow vars and default.css are gone.
- [x] **TOKEN-02**:
  - **ORIGINAL (2026-04-30, premium-terminal — SCRAPPED):** Tailwind v4 `@theme` block exposes all token vars to utility classes (`bg-fg-mid`, `text-fg-bright`, etc.) so retro atoms can stay class-driven.
  - **REVISED (2026-06-11, retro-os):** Tailwind v4 `@theme inline` block exposes the tokens as utilities whose names mirror the var names (D-04) — `bg-bg-panel`, `text-fg-ink`, `bg-titlebar-mint`, `p-sp-3`, `gap-sp-2`, `rounded-chip`, `shadow-hard-ink`. (`inline` is required for the var-indirected tokens.) The premium-terminal `bg-fg-mid` / `text-fg-bright` utilities are gone.
- [x] **TOKEN-03**:
  - **ORIGINAL (2026-04-30, premium-terminal — SCRAPPED):** Body globals apply scanline + radial-vignette background pattern, monospace anchor (`--font-sans: var(--font-mono)`), sharp corners (`--radius: 0` + utility-class overrides on `rounded-{sm..4xl}`), and JetBrains Mono Variable self-hosted via `@fontsource-variable/jetbrains-mono`.
  - **REVISED (2026-06-11, retro-os):** Body globals apply a cream desktop (--bg-desktop) + barely-there dot-dither background, `font-family: var(--font-body)` (IBM Plex Sans humanist anchor, NOT a monospace anchor), radius 0 everywhere except badges (2px, `rounded-chip`), and self-host Silkscreen + IBM Plex Sans + IBM Plex Mono via `@fontsource/*` (per-weight, not variable). Scanline, radial-vignette, `--font-sans: var(--font-mono)`, and JetBrains Mono are gone.
- [x] **TOKEN-04**:
  - **ORIGINAL (2026-04-30, premium-terminal — SCRAPPED):** WCAG AAA contrast verified for `--fg-mid`/`--fg-base`/`--fg-bright` against `--bg-panel` (audit script in repo); `prefers-contrast: more` fallback path provided.
  - **REVISED (2026-06-11, retro-os):** WCAG **AA** (>=4.5:1) verified in `src/styles/tokens.test.ts` over the revised pair list (ink/panel, ink/desktop, muted/panel, muted/desktop, ink/each-of-4-titlebars, each *-deep/panel, two *-deep/desktop, danger/danger-bg); `prefers-contrast: more` overrides only --fg-faint → --fg-muted. The AAA target and the --fg-mid/base/bright pairing are gone.
- [x] **TOKEN-05**:
  - **ORIGINAL (2026-04-30, premium-terminal — SCRAPPED):** Cyrillic + Estonian glyph metrics verified in JetBrains Mono (no column drift in monospace tables) — fallback to IBM Plex Mono recorded if drift observed.
  - **REVISED (2026-06-11, retro-os):** Cyrillic + Estonian glyph coverage verified in **IBM Plex Mono** (ships cyrillic + latin-ext subsets; tabular-nums data face, no column drift). Coverage is asserted by `src/styles/glyph-coverage.test.ts`; perceived column drift is confirmed manually (02-VALIDATION.md). IBM Plex Mono is the primary data face here, not a JetBrains Mono fallback.

### App Shell & Layout Primitives (SHELL)

- [x] **SHELL-01**: 2×3 CSS-Grid `AppShell` (sketch 005 `grid-template-areas: "topbar topbar" / "sidebar main" / "sidebar bottombar"`) renders authenticated content; sidebar runs full-height; bottombar spans only the main column.
- [x] **SHELL-02**: Sidebar collapse is a single `data-collapsed` attribute toggle on the grid root — no JavaScript layout work, no measure phase.
- [x] **SHELL-03**: TopBar shows slim brand mark (30×30 beveled square + "HOME WAREHOUSE"), workspace pill, ONLINE indicator dot bound to live SSE state, and user pill with menu dropdown.
- [x] **SHELL-04**: Sidebar groups nav into `// OVERVIEW`, `// INVENTORY`, and `// SYSTEM` sections with monospace amber labels; per-route active indicator (left-border bevel + glow); collapses to icon-rail with badge dot mode.
- [x] **SHELL-05**: PageHeader renders `// {ROUTE}` breadcrumb plus `SESSION {hh:mm:ss} // LAST SYNC {hh:mm:ss}` system-status meta on every authenticated route.
- [x] **SHELL-06**: AppShell is mobile-responsive — sidebar becomes a drawer at `<768px`; bottombar overflow plan keeps F1 and ESC right-anchored, the rest paged or in an overflow sheet.

### Function-Key Bottombar (BAR)

- [x] **BAR-01**: Bottombar mounts on every authenticated route, renders `[KEY] LABEL` chips for the current route plus globals (F1 HELP), and a right-side `SESSION + LOCAL` clock pair updated every second.
- [x] **BAR-02**: `useShortcuts(id, [{ key, label, action, danger? }])` hook is the single source of truth — registers shortcuts into a context indexed by `useId()`, the bar reads from context for both rendering AND the keydown listener.
- [x] **BAR-03**: Keydown dispatcher honors an `isEditableTarget(e.target)` guard so single-letter shortcuts NEVER trigger when the user is typing in an input, textarea, select, or contenteditable surface (regression test on every form).
- [x] **BAR-04**: Bottombar `[KEY]` chips use `bg-primary text-primary-foreground` so they read amber-on-near-black under retro and adopt the theme `primary` token under any other theme.
- [x] **BAR-05**: F1 chip click and F1 keydown both open the keyboard-shortcuts help dialog (existing `useKeyboardShortcutsDialog` pattern from `/frontend`); ESC keydown is NOT bound to logout — confirm-before-logout pattern only via menu.

### Providers (PROV)

- [x] **PROV-01**: Provider stack mounts in this exact order: `IntlProvider > QueryClientProvider > AuthProvider > SSEProvider > ToastProvider > ShortcutsProvider > BrowserRouter`.
- [x] **PROV-02**: SSEProvider opens a single EventSource (JWT in URL query param), exposes `useSSEStatus()` selector returning `{ connected: boolean, lastEventAt: Date | null }` for chrome consumers (TopBar ONLINE dot, PageHeader LAST SYNC), and a `useSSE({ onEvent })` subscribe API for feature consumers.
- [x] **PROV-03**: ShortcutsProvider ports verbatim from `frontend/components/layout/shortcuts-context.tsx`; register-by-id Context pattern; supports unregister-on-unmount cleanup.
- [x] **PROV-04**: ToastProvider mounts sonner with retro-skinned styling (sharp corners, monospace, panel bevel).

### Auth (AUTH)

- [x] **AUTH-01**: User can log in with email + password via `POST /api/auth/login`; cookie-JWT (`credentials: "include"`); 401 refresh single-flighted in `lib/api.ts`.
- [x] **AUTH-02**: User can register a new account via `POST /api/auth/register`.
- [x] **AUTH-03**: User can log in via Google OAuth (PKCE + Authorization Code flow + one-time Redis code exchange); auto-link by verified email.
- [x] **AUTH-04**: User can log in via GitHub OAuth (same flow with `/user/emails` for private-email accounts); auto-link by verified email.
- [x] **AUTH-05**: `RequireAuth` route wrapper redirects unauthenticated users to `/login` AND DOES NOT log out on transient network errors (HttpError-status-aware, fixes v2.0 spurious-logout bug).
- [x] **AUTH-06**: Workspace switcher in topbar lists user's workspaces and allows switching; selected workspaceId is the SSOT for all entity API calls.
- [x] **AUTH-07**: Active sessions list in Settings → Security; user can revoke individual sessions or all-other-sessions; current-session badge.
- [x] **AUTH-08**: User can change password (current-password verification + 8+ char zod validation); OAuth-only accounts get a "set password" path.
- [x] **AUTH-09**: User can delete account with type-to-confirm (`DELETE`) + sole-owner workspace validation.
- [x] **AUTH-10**: Connected Accounts subpage in Settings — link/unlink Google + GitHub providers with last-method-removal lockout guard.

### Items (ITEM)

- [x] **ITEM-01**: User can browse items in a paginated list (25/page, RetroTable), with search input, filter chips (category, archived), sort headers, and URL-driven query params for deep-linking.
  - **ORIGINAL (2026-04-30):** "...with search input, filter chips (category, location, archived), sort headers..."
  - **REVISED (2026-06-13, 07-07):** The **location filter chip is DROPPED** (deliberate scope deviation). The backend `GET /items` exposes only `search`, `category_id`, `archived`, `sort`, `sort_dir`, `page`, `limit` — there is **no `location_id` list param** (verified `backend/internal/domain/warehouse/item/handler.go:683-692`), so the list ships **category + archived** filter chips only. Location remains a **display column** in the table (not a filter). Reason: 07-RESEARCH Open Question 1 (RESOLVED 2026-06-13) — client-side-only location filtering would break server pagination, so the chip is deferred pending a backend `location_id` param (revisit post-parity). NOTE: the ROADMAP Phase 7 Success Criterion mirror of this deviation is owned by the phase orchestrator (this plan does not edit ROADMAP.md).
- [x] **ITEM-02**: User can view an item detail page showing all fields, photo gallery (if any), active-loan panel (if any), and loan history panel.
- [x] **ITEM-03**: User can create a new item via `/items/new`, with optional `?barcode={code}` query param prefilling the barcode field (forward-compat with scan flow).
- [x] **ITEM-04**: User can edit an item via `/items/{id}/edit` and save with optimistic UI invalidation of `itemKeys.all` + relevant detail keys.
- [x] **ITEM-05**: User can archive / unarchive an item; archived items are filtered out by default but visible via the "Show archived" filter chip.
- [x] **ITEM-06**: User can delete an item with type-to-confirm dialog (only available for archived items per legacy convention).
- [x] **ITEM-07**: User can upload up to N photos per item, client-resize, 10 MB cap per file; native FormData multipart, no upload library.
  - **ORIGINAL (2026-04-30):** "User can upload up to N photos per item (JPEG/PNG/HEIC, client-resize, 10 MB cap per file); native FormData multipart, no upload library."
  - **REVISED (2026-06-13, 07-07):** JPEG/PNG/WebP only — HEIC is rejected server-side. The backend `AllowedMimeTypes` is `{image/jpeg, image/png, image/webp}` (a HEIC upload returns 400 "invalid file type: only JPEG, PNG, and WebP"), so the client `<FileInput accept>` excludes it and the visible accept-list copy drops "HEIC". Reason: 07-RESEARCH Pitfall 2 (verified `backend/internal/domain/warehouse/itemphoto/entity.go:42-45`, `handler.go:699`). HEIC client-side conversion is impractical under the no-deps lock and is noted as deferred; the backend never accepted HEIC, so the original prose was aspirational.
- [x] **ITEM-08**: User can view item photos in a gallery + lightbox (keyboard nav: arrow keys + ESC); set primary thumbnail; delete individual photos with confirm.
- [x] **ITEM-09**: `itemsApi.lookupByBarcode(workspaceId, code)` helper exists and calls `GET /api/workspaces/{wsId}/items/by-barcode/{code}` with workspace-scoped server-side authority + 404 → null mapping (G-65-01 regression guard pattern).
- [x] **ITEM-10**: Items list page registers `useShortcuts("items", [{ key: "N", action: navTo("/items/new") }, { key: "/", action: focusSearch }, { key: "F", action: toggleFilters }])`.

### Loans (LOAN)

- [x] **LOAN-01**: User can view loans in a tabbed view — Active / Overdue / History — with RetroTable rows showing item / borrower / due date / status pill.
- [x] **LOAN-02**: User can create a new loan via `/loans/new` with item picker + borrower picker; supports `?itemId={id}` URL param to preselect (deep-linkable from scan flow).
- [x] **LOAN-03**: User can mark a loan as returned via a confirm dialog; status transitions to History tab.
- [x] **LOAN-04**: User can edit a loan's due date and notes after creation.
- [x] **LOAN-05**: Item detail page renders an "Active Loan" panel (if any) and "Loan History" panel listing all past loans for the item.
- [x] **LOAN-06**: Borrower detail page renders an "Active Loans" panel and "Loan History" panel listing all loans for the borrower. _(Phase 8: `BorrowerLoanPanels` component + `useBorrowerLoans` shipped & unit-tested; the borrower detail page that mounts it lands in Phase 9 / BORR-03.)_

### Borrowers (BORR)

- [x] **BORR-01**: User can browse borrowers in a flat paginated list (no nesting), with search input + RetroPagination.
- [x] **BORR-02**: User can create a new borrower (name + optional contact info).
- [x] **BORR-03**: User can view a borrower's detail page (active + historical loan panels, see LOAN-06).
- [x] **BORR-04**: User can edit a borrower's profile.
- [x] **BORR-05**: User can delete a borrower; deletion is blocked while any loan is active (red badge + "View active loans" link).

### Taxonomy (TAX)

- [x] **TAX-01**: User can view categories as a hierarchical tree on the Taxonomy page (Categories tab); expand/collapse persisted to sessionStorage.
- [x] **TAX-02**: User can create / edit / archive categories at any level; usage warnings when archiving a category with assigned items.
- [x] **TAX-03**: User can view locations as a hierarchical tree on the Taxonomy page (Locations tab).
- [x] **TAX-04**: User can create / edit / archive locations at any level.
- [x] **TAX-05**: User can view containers grouped by location on the Taxonomy page (Containers tab).
- [x] **TAX-06**: User can create / edit / delete containers; container deletion is allowed when not assigned to items, otherwise unassign-and-delete behavior (matches v2.2 cascade decision).

### Scan (SCAN)

- [x] **SCAN-01**: User can open `/scan` and see a live rear-camera preview with scanner controls; `<BarcodeScanner>` mounts ONCE and stays mounted while overlays render on top — never navigates away mid-scan (iOS PWA camera-permission persistence).
- [x] **SCAN-02**: Scanner decodes QR, UPC-A, EAN-13, and Code128 formats via `@yudiel/react-qr-scanner@2.5.1` (exact pin); pause-on-match is prop-driven, NOT unmount.
- [x] **SCAN-03**: On successful scan, user hears AudioContext oscillator beep, feels haptic (ios-haptics on iOS 17.4+ Safari, navigator.vibrate elsewhere), and sees a visual flash/checkmark.
- [x] **SCAN-04**: User can toggle torch on Android devices that expose `MediaStreamTrack.getCapabilities().torch` (button auto-hidden on iOS).
- [x] **SCAN-05**: User can manually enter a barcode via a fallback Manual tab (RetroInput + LOOK UP CODE button) when camera scan fails or permission is denied.
- [x] **SCAN-06**: User sees the last 10 scanned codes in a History tab (localStorage key `hws-scan-history`), each row tap re-fires the post-scan flow.
- [x] **SCAN-07**: User can clear scan history with a confirm dialog.
- [x] **SCAN-08**: On scan/manual-entry, `itemsApi.lookupByBarcode` resolves to a 4-state banner — LOADING / MATCH / NOT-FOUND / ERROR — with a `prefers-reduced-motion`-aware blinking-cursor variant.
- [x] **SCAN-09**: NOT-FOUND state shows a "create item with this barcode" action navigating to `/items/new?barcode=<code>`.
- [x] **SCAN-10**: For codes matching `/^\d{8,14}$/`, the item-create form shows suggested name/brand from `GET /api/barcode/{code}` as opt-in prefill (suggestion banner with USE / USE ALL / DISMISS).
- [x] **SCAN-11**: After a MATCH, a quick-action overlay shows View Item / Loan / Back to Scan; menu is state-adaptive (Loan hidden if item on active loan, Unarchive if archived, Mark Reviewed if `needs_review`).

### Settings (SETT)

- [x] **SETT-01**: Settings landing page has iOS-style grouped rows linking to subpages — Profile, Security, Appearance, Language, Regional Formats, Notifications, Connected Accounts, Data Storage.
- [x] **SETT-02**: Profile subpage — edit name, email, avatar (upload + 150×150 thumbnail).
- [x] **SETT-03**: Security subpage — password change, active sessions list + revoke, account deletion.
- [x] **SETT-04**: Appearance subpage — theme picker; under v3.0 the only theme is premium-terminal (the design IS the product per anti-feature lock).
- [x] **SETT-05**: Language subpage — pick from English / Estonian / Russian.
- [x] **SETT-06**: Regional Formats subpage — date format, time format, thousand separator, decimal separator.
- [x] **SETT-07**: Notifications subpage — in-app preference toggles for SSE event types.
- [x] **SETT-08**: Connected Accounts subpage — link/unlink OAuth providers.
- [x] **SETT-09**: Data Storage subpage — clear cached query data, export workspace, import workspace (online-only — no offline-storage management surface).

### Dashboard (DASH)

- [ ] **DASH-01**: Dashboard renders four stat tiles (Total Items, Locations, Containers, Active Loans) with token-correct retro panel styling.
- [ ] **DASH-02**: Activity table renders the last N events with TUI-style columns: Timestamp / Action / Entity / Actor / Status pill; relative timestamps under 24h, absolute thereafter.
- [ ] **DASH-03**: Side rail stacks Pending Approvals + System Alerts panels.
- [ ] **DASH-04**: HUD row (capacity gauge + 14d activity sparkline + counts) renders behind `VITE_FEATURE_HUD_ROLLUPS` flag, default off; hand-rolled SVG (no charting library).
- [ ] **DASH-05**: Dashboard registers `useShortcuts("dashboard", [{ key: "N", action: navTo("/items/new") }, { key: "S", action: navTo("/scan") }, { key: "L", action: navTo("/loans") }])`.

### i18n (I18N)

- [ ] **I18N-01**: All user-facing strings ship in en, et, and ru — no inline literals; CI extract→merge→diff manifest guard catches missing/orphaned msgids.
- [ ] **I18N-02**: Locale switcher in Settings → Language persists choice to `users/me/preferences` and applies instantly without reload.
- [ ] **I18N-03**: Format hooks (`useDateFormat`, `useTimeFormat`, `useNumberFormat`) are used everywhere date/time/number values render — no raw `Date.toString()` or `Number.toLocaleString()` in feature code.

### System Group (SYS)

- [ ] **SYS-01**: Approvals page renders a paginated activity-table view of pending approval requests with bulk-action support (multi-select via Shift+Click + Bottombar A/R/D shortcuts).
- [ ] **SYS-02**: My Changes page lists the authenticated user's recent mutations across entities.
- [ ] **SYS-03**: Sync History page lists past sync events with timestamps, status, error details.
- [ ] **SYS-04**: Imports/Exports page surfaces CSV import + workspace export + import-history; uses the activity-table pattern from Phase 6.

### TUI Differentiators (TUI)

- [x] **TUI-01**: Per-route shortcut sets registered via `useShortcuts(routeName, [...])`; Bottombar reflects the active route's set without flicker on route change.
- [x] **TUI-02**: Modal-stack ESC pops the topmost overlay first (dialog → drawer → menu), never logging out while any modal is open.
- [x] **TUI-03**: SSE state in panel headers — live dot + `sse: ● live` text on panels that subscribe to entity events.
- [x] **TUI-04**: Status pills on row entities — OK / WARN / INFO / DANGER variants with color tokens; numeric columns use `tabular-nums`.
- [ ] **TUI-05**: Command palette (Cmd+K / F2) via `cmdk` — filters across routes, recent actions, and workspaces; keyboard-first navigation.
- [x] **TUI-06**: Multi-select via Shift+Click on RetroTable rows; Bottombar surfaces bulk actions for the active selection set.

### Polish & Quality (POL)

- [ ] **POL-01**: All flows that cross the HTTP boundary have at least one real-backend test — Playwright E2E for browser-driven flows + tagged Go integration test for server contract (Phase 65 Plan 65-11 pattern, applied from Day 1).
- [ ] **POL-02**: All interactive elements pass `axe-playwright` CI sweep — no contrast / focus-visible / touch-target / aria-label violations.
- [ ] **POL-03**: Tab/keyboard navigation audit — every page is fully keyboard-navigable; focus indicator visible (focus-visible, not focus); no keyboard traps.
- [ ] **POL-04**: Bundle size CI guard — `vite build` output stays under documented per-chunk budgets (main / scanner / vendor); regression-by-PR fails CI with clear delta report.
- [ ] **POL-05**: Mobile breakpoint matrix re-tested at 320 / 360 / 768 / 1024 / 1440 px; visual diff vs sketch 005 PNG for the dashboard route.

---

## v3.0 Parity Amendment Requirements (2026-06-12)

> Added by the roadmap amendment per `docs/FRONTEND2_FEATURE_PARITY_PLAN.md` (§§4-6). These close the gaps the original 106-requirement inventory missed. Existing IDs above are untouched. Each new ID maps to exactly one phase in the traceability table below.

### Inventory (INV) — Phase 7b (Gap G-1)

- [x] **INV-01**: User can browse inventory entries in a filterable list (item / location / container / quantity / status / condition), virtualized via `@tanstack/react-virtual` when the entry count warrants.
- [x] **INV-02**: User can create an inventory entry with item / location / container pickers (simple selects until Phase 10 type-ahead pickers land).
- [x] **INV-03**: User can record expiry + warranty fields on an inventory entry.
- [x] **INV-04**: User can move an entry between locations via a move dialog.
- [x] **INV-05**: User can edit quantity / status / condition inline on an inventory row.
- [x] **INV-06**: User can open an expiring view (`/inventory/expiring`) listing entries past or near expiry/warranty.
- [x] **INV-07**: User can view a movements history panel backed by the `/movements` endpoints (global + per-location + per-inventory).
- [x] **INV-08**: Item detail renders a per-item inventory panel (closing the Phase 7 stub) linking each entry to its location/container.

### Repairs (RPR) — Phase 10b (Gap G-2)

- [x] **RPR-01**: User can create / edit repairs on an inventory entry via a repair log drawer/panel, and start/complete them.
- [x] **RPR-02**: User sees a cost rollup across an inventory entry's repair history.
- [x] **RPR-03**: User can attach repair photos to a repair record (reusing the Phase 7 photo atoms).
- [x] **RPR-04**: User can attach non-photo repair attachments to a repair record. _(Frontend link/list/delete shipped; backend byte-storage is a pre-existing project-wide stub — file upload/serve deferred to Phase 14b attachment work.)_

### Maintenance (MNT) — Phase 10b (Gap G-2)

- [x] **MNT-01**: User can create / edit / delete recurring maintenance schedules on an inventory entry.
- [x] **MNT-02**: User can view a due-maintenance list (`/maintenance/due`) and complete a schedule (completion advances next-due).
- [x] **MNT-03**: A due-maintenance feed is produced for the Phase 13 dashboard side-rail card. _(`useMaintenanceDueQuery` shipped; Phase 13 mounts the dashboard card.)_

### Analytics (ANL) — Phase 13b (Gap G-6)

- [ ] **ANL-01**: User sees category-breakdown, location-value, and condition/status-distribution charts on an Analytics page.
- [ ] **ANL-02**: User sees top-borrowers and monthly-loan-activity charts on the Analytics page.
- [ ] **ANL-03**: The chart library is lazy-loaded (dynamic import) so non-analytics routes carry zero charting weight and POL-04 budgets hold.
- [ ] **ANL-04**: User sees an out-of-stock table (`/analytics/out-of-stock`) with each row linking to its item.

### Attachments (ATT) — Phase 14b (Gap G-7)

- [ ] **ATT-01**: User can upload + list non-photo attachments on an item detail page using the Phase 4 FileInput atom.
- [ ] **ATT-02**: User can set a primary attachment and delete attachments.
- [ ] **ATT-03**: The cross-tenant attachment IDOR audit finding (`docs/audit/`) is fixed and guarded with a test.

### Paperless (PPL) — Phase 14b (Gap G-7)

- [ ] **PPL-01**: User can configure Paperless-ngx connection settings (get/put/delete) from a page that slots into the Settings hub.
- [ ] **PPL-02**: User can search Paperless documents from within the app.
- [ ] **PPL-03**: User can link a Paperless document to an item.

### Wishlist (WISH) — Phase 14 (Gap G-3)

- [ ] **WISH-01**: User can view a wishlist page with wanted / ordered / acquired status tabs.
- [ ] **WISH-02**: User can add / edit / delete wishlist items and transition their status.

### Declutter (DECL) — Phase 14 (Gap G-4)

- [ ] **DECL-01**: User can view a declutter page with unused-items analysis, a score badge, and grouping.
- [ ] **DECL-02**: User can export the declutter list to CSV and mark an item as used.

### Notifications UI (NOTIF) — Phase 13 (Gap G-5, in-app part)

- [ ] **NOTIF-01**: User sees a notifications bell in the TopBar.
- [ ] **NOTIF-02**: User can open a notifications dropdown and mark notifications read / all-read.
- [ ] **NOTIF-03**: User sees an unread-count badge on the bell.

### Filter Atoms (ATOM-FB) — Phase 4 (§4)

- [x] **ATOM-FB-01**: FilterBar retro atom exists and is consumed by Phases 7/8/14 list pages.
- [x] **ATOM-FB-02**: FilterPopover retro atom exists.
- [x] **ATOM-FB-03**: BulkActionBar retro atom exists, surfaced for multi-select bulk actions.
- [x] **ATOM-FB-04**: SavedFilters retro atom exists for saved filter presets.

### Auth parity additions (AUTH) — Phase 5 (§4, §8 risks 5-6)

- [x] **AUTH-11**: Env-gated "Log in with SSO" (Authelia) button wired to backend `/auth/authelia/login`; hidden when not configured.
- [x] **AUTH-12**: `POST /auth/logout` actually revokes the session server-side and clears refresh-token state client-side (closes the broken-logout-revocation audit finding).

### Taxonomy parity addition (TAX) — Phase 10 (Gap G-10 partial)

- [x] **TAX-07**: Label manager — simple CRUD list + color picker so item label-attach (Phase 7) has labels to attach.

### Scan parity addition (SCAN) — Phase 11 (Gap G-8)

- [x] **SCAN-12**: Claim flow `/claim/:code` (login required) — resolve barcode → MATCH navigates to the item, NOT-FOUND opens create-item-with-barcode. _(Scoped to PORT LEGACY create-entity per user decision 2026-06-13; original "claim-as-loan" text superseded — shipped legacy was create-entity + no resolve endpoint.)_

### Settings parity additions (SETT) — Phase 12 (Gaps G-9, theme decision)

- [x] **SETT-10**: Members page — list workspace members, change roles, remove members, invite/add a member by email.
- [x] **SETT-11**: Appearance subpage ships **light-only** under v3.0 with an explicit note; dark theme is deferred to backlog.

### Polish parity addition (POL) — Phase 17 (§7)

- [ ] **POL-06**: Parity verification gate — route checklist, endpoint coverage diff (legacy `frontend/lib/api/*` minus `frontend2/src`, excluding `/sync/*` + `/push/*`), full E2E flow list, i18n completeness, a11y + bundle budgets across new pages, and one week of dogfooding before legacy `frontend/` retirement.


---

## Future Requirements (deferred to v3.1+)

- **HUD rollup data** — backend `capacity_target` per workspace + `/api/workspaces/{ws}/activity?days=14` aggregate (UI ships flag-gated in v3.0 per DASH-04; data shipping later)
- **Quick Capture flow port** — camera-first rapid item entry from v1.9; deferred until item-create volume warrants the engineering cost
- **Inline edit on detail panels** — currently edit goes through `/{entity}/{id}/edit` route
- **Density toggle** — compact / comfortable / spacious table modes
- **Vim-chord shortcuts** — `g i`, `g d`, `g l` style multi-key navigation; optional differentiator, not table-stakes
- **Drag-and-drop tree reorder** — keyboard-only reorder is the v3.0 path (arrow keys + Ctrl+Up/Down)
- **Repair Log** — legacy v1.2 feature, low actual usage
- **Declutter Assistant** — legacy v1.2 feature, low actual usage

## Out of Scope (explicit exclusions for v3.0)

- **Offline mutations / IndexedDB / Serwist / sync** — CI grep guard enforces this. Online-only is a load-bearing constraint that simplifies the rebuild by ~30-40%. (Reason: predecessor v2.0/v2.1 shipped this way successfully; offline complexity does not pay back at current product stage.)
- **Mobile FAB** — pending Phase 0 spike resolution (FOUND-05); recommendation in research is to drop entirely since Bottombar covers the same surface. (Reason: predecessor `/frontend` had FAB because it had no Bottombar; v3.0 has one — collision risk and safe-area math complexity outweigh parity value.)
- **Animation libraries** (motion, framer-motion, react-spring) — fight the locked 80ms CSS transitions and break the retro aesthetic. CSS-only motion is the contract.
- **shadcn/Material/Mantine/Chakra/HeadlessUI default chrome** — drop-shadows + rounded corners + soft transitions actively fight `default.css`. Custom retro atoms only.
- **Charting libraries** (Recharts, Chart.js, Tremor, Plotly, etc.) — hand-rolled SVG (~30 LOC each) for HUD gauge + sparkline; matches aesthetic, costs nothing to maintain.
- **Multi-theme picker / per-user palette editor** — premium-terminal IS the product. (Reason: dilution kills the brand; if a user wants a soft pastel UI, `/frontend` exists.)
- **Vim-modal editing / Ex-mode `:command` bar / multiplexed pane splits** — TUI patterns that don't fit warehouse-management workflows.
- **Skeleton shimmer / Lottie / spring physics** — animated loading states fight monospace-density aesthetic.
- **Fuse.js / client-side fuzzy search** — server-side FTS covers the case; cmdk has its own filter algo.
- **PWA install prompt / service worker** — online-only constraint (see above).
- **Repair Log + Declutter Assistant** — legacy features, deferred to future milestone if usage data warrants.
- **Push notifications** — out of v3.0 scope; SSE handles real-time within the active session.

---

## Traceability

> Filled by the roadmapper agent after roadmap approval.

| REQ-ID | Phase | Status |
|--------|-------|--------|
| FOUND-01 | Phase 1 | Pending |
| FOUND-02 | Phase 1 | Pending |
| FOUND-03 | Phase 1 | Pending |
| FOUND-04 | Phase 1 | Pending |
| FOUND-05 | Phase 1 | Pending |
| FOUND-06 | Phase 1 | Pending |
| TOKEN-01 | Phase 2 | Complete |
| TOKEN-02 | Phase 2 | Complete |
| TOKEN-03 | Phase 2 | Complete |
| TOKEN-04 | Phase 2 | Complete |
| TOKEN-05 | Phase 2 | Complete |
| SHELL-01 | Phase 3 | Complete |
| SHELL-02 | Phase 3 | Complete |
| SHELL-03 | Phase 3 | Complete |
| SHELL-04 | Phase 3 | Complete |
| SHELL-05 | Phase 3 | Complete |
| SHELL-06 | Phase 3 | Complete |
| BAR-01 | Phase 3 | Complete |
| BAR-02 | Phase 3 | Complete |
| BAR-03 | Phase 3 | Complete |
| BAR-04 | Phase 3 | Complete |
| BAR-05 | Phase 3 | Complete |
| PROV-01 | Phase 6 | Complete |
| PROV-02 | Phase 6 | Complete |
| PROV-03 | Phase 6 | Complete |
| PROV-04 | Phase 6 | Complete |
| AUTH-01 | Phase 5 | Complete |
| AUTH-02 | Phase 5 | Complete |
| AUTH-03 | Phase 5 | Complete |
| AUTH-04 | Phase 5 | Complete |
| AUTH-05 | Phase 5 | Complete |
| AUTH-06 | Phase 5 | Complete |
| AUTH-07 | Phase 5 | Complete |
| AUTH-08 | Phase 5 | Complete |
| AUTH-09 | Phase 5 | Complete |
| AUTH-10 | Phase 5 | Complete |
| ITEM-01 | Phase 7 | Complete |
| ITEM-02 | Phase 7 | Complete |
| ITEM-03 | Phase 7 | Complete |
| ITEM-04 | Phase 7 | Complete |
| ITEM-05 | Phase 7 | Complete |
| ITEM-06 | Phase 7 | Complete |
| ITEM-07 | Phase 7 | Complete |
| ITEM-08 | Phase 7 | Complete |
| ITEM-09 | Phase 7 | Complete |
| ITEM-10 | Phase 7 | Complete |
| LOAN-01 | Phase 8 | Complete |
| LOAN-02 | Phase 8 | Complete |
| LOAN-03 | Phase 8 | Complete |
| LOAN-04 | Phase 8 | Complete |
| LOAN-05 | Phase 8 | Complete |
| LOAN-06 | Phase 8 | Complete (panels component; borrower-page mount Phase 9/BORR-03) |
| BORR-01 | Phase 9 | Complete |
| BORR-02 | Phase 9 | Complete |
| BORR-03 | Phase 9 | Complete |
| BORR-04 | Phase 9 | Complete |
| BORR-05 | Phase 9 | Complete |
| TAX-01 | Phase 10 | Complete |
| TAX-02 | Phase 10 | Complete |
| TAX-03 | Phase 10 | Complete |
| TAX-04 | Phase 10 | Complete |
| TAX-05 | Phase 10 | Complete |
| TAX-06 | Phase 10 | Complete |
| SCAN-01 | Phase 11 | Complete |
| SCAN-02 | Phase 11 | Complete |
| SCAN-03 | Phase 11 | Complete |
| SCAN-04 | Phase 11 | Complete |
| SCAN-05 | Phase 11 | Complete |
| SCAN-06 | Phase 11 | Complete |
| SCAN-07 | Phase 11 | Complete |
| SCAN-08 | Phase 11 | Complete |
| SCAN-09 | Phase 11 | Complete |
| SCAN-10 | Phase 11 | Complete |
| SCAN-11 | Phase 11 | Complete |
| SETT-01 | Phase 12 | Complete |
| SETT-02 | Phase 12 | Complete |
| SETT-03 | Phase 12 | Complete |
| SETT-04 | Phase 12 | Complete |
| SETT-05 | Phase 12 | Complete |
| SETT-06 | Phase 12 | Complete |
| SETT-07 | Phase 12 | Complete |
| SETT-08 | Phase 12 | Complete |
| SETT-09 | Phase 12 | Complete |
| DASH-01 | Phase 13 | Pending |
| DASH-02 | Phase 13 | Pending |
| DASH-03 | Phase 13 | Pending |
| DASH-04 | Phase 13 | Pending |
| DASH-05 | Phase 13 | Pending |
| I18N-01 | Phase 15 | Pending |
| I18N-02 | Phase 15 | Pending |
| I18N-03 | Phase 15 | Pending |
| SYS-01 | Phase 14 | Pending |
| SYS-02 | Phase 14 | Pending |
| SYS-03 | Phase 14 | Pending |
| SYS-04 | Phase 14 | Pending |
| TUI-01 | Phase 3 | Complete |
| TUI-02 | Phase 4 | Complete |
| TUI-03 | Phase 4 | Complete |
| TUI-04 | Phase 4 | Complete |
| TUI-05 | Phase 16 | Pending |
| TUI-06 | Phase 4 | Complete |
| POL-01 | Phase 17 | Pending |
| POL-02 | Phase 17 | Pending |
| POL-03 | Phase 17 | Pending |
| POL-04 | Phase 17 | Pending |
| POL-05 | Phase 17 | Pending |
| --- v3.0 parity amendment (2026-06-12) --- | | |
| INV-01 | Phase 7b | Complete |
| INV-02 | Phase 7b | Complete |
| INV-03 | Phase 7b | Complete |
| INV-04 | Phase 7b | Complete |
| INV-05 | Phase 7b | Complete |
| INV-06 | Phase 7b | Complete |
| INV-07 | Phase 7b | Complete |
| INV-08 | Phase 7b | Complete |
| RPR-01 | Phase 10b | Complete |
| RPR-02 | Phase 10b | Complete |
| RPR-03 | Phase 10b | Complete |
| RPR-04 | Phase 10b | Complete (link-only; byte-storage Phase 14b) |
| MNT-01 | Phase 10b | Complete |
| MNT-02 | Phase 10b | Complete |
| MNT-03 | Phase 10b | Complete (feed hook; card Phase 13) |
| ANL-01 | Phase 13b | Pending |
| ANL-02 | Phase 13b | Pending |
| ANL-03 | Phase 13b | Pending |
| ANL-04 | Phase 13b | Pending |
| ATT-01 | Phase 14b | Pending |
| ATT-02 | Phase 14b | Pending |
| ATT-03 | Phase 14b | Pending |
| PPL-01 | Phase 14b | Pending |
| PPL-02 | Phase 14b | Pending |
| PPL-03 | Phase 14b | Pending |
| WISH-01 | Phase 14 | Pending |
| WISH-02 | Phase 14 | Pending |
| DECL-01 | Phase 14 | Pending |
| DECL-02 | Phase 14 | Pending |
| NOTIF-01 | Phase 13 | Pending |
| NOTIF-02 | Phase 13 | Pending |
| NOTIF-03 | Phase 13 | Pending |
| ATOM-FB-01 | Phase 4 | Complete |
| ATOM-FB-02 | Phase 4 | Complete |
| ATOM-FB-03 | Phase 4 | Complete |
| ATOM-FB-04 | Phase 4 | Complete |
| AUTH-11 | Phase 5 | Complete |
| AUTH-12 | Phase 5 | Complete |
| TAX-07 | Phase 10 | Complete |
| SCAN-12 | Phase 11 | Complete (port-legacy create-entity) |
| SETT-10 | Phase 12 | Complete |
| SETT-11 | Phase 12 | Complete |
| POL-06 | Phase 17 | Pending |

**Total:** 106 base requirements across 17 categories + 43 parity-amendment requirements (2026-06-12) across 14 new/extended categories (INV 8, RPR 4, MNT 3, ANL 4, ATT 3, PPL 3, WISH 2, DECL 2, NOTIF 3, ATOM-FB 4, AUTH +2, TAX +1, SCAN +1, SETT +2, POL +1) = **149 total** — note prior summary said 91/14 but the actual list above (and the body of the document) contains 106 requirements across 17 categories: FOUND (6), TOKEN (5), SHELL (6), BAR (5), PROV (4), AUTH (10), ITEM (10), LOAN (6), BORR (5), TAX (6), SCAN (11), SETT (9), DASH (5), I18N (3), SYS (4), TUI (6), POL (5). All 106 mapped to exactly one phase below.

---

*Requirements defined: 2026-04-30*
*Roadmap + traceability: 2026-04-30 — all 106 requirements mapped to phases 1-17 of the v3.0 roadmap by the roadmapper agent*
*Milestone: v3.0 Premium-Terminal Frontend*

*Amended: 2026-06-12 — added 43 parity requirements per `docs/FRONTEND2_FEATURE_PARITY_PLAN.md` §§4-6 (INV/RPR/MNT/ANL/ATT/PPL/WISH/DECL/NOTIF/ATOM-FB + AUTH-11/12, TAX-07, SCAN-12, SETT-10/11, POL-06) mapped to phases 4-17 incl. new lettered phases 7b/10b/13b/14b. Existing 106 IDs untouched.*
