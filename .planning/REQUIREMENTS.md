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

- [ ] **TOKEN-01**: `styles/tokens.css` ports the locked premium-terminal palette from `.claude/skills/sketch-findings-home-warehouse-system/sources/themes/default.css` verbatim (--bg-base, --bg-panel, --bg-panel-2, --bg-elevated, --bg-hover, --bg-active, --fg-dim, --fg-mid, --fg-base, --fg-bright, --fg-glow, --amber, --amber-bright, --accent-{warn,danger,info}{,-bg}, --border-{thin,thick,glow}).
- [ ] **TOKEN-02**: Tailwind v4 `@theme` block exposes all token vars to utility classes (`bg-fg-mid`, `text-fg-bright`, etc.) so retro atoms can stay class-driven.
- [ ] **TOKEN-03**: Body globals apply scanline + radial-vignette background pattern, monospace anchor (`--font-sans: var(--font-mono)`), sharp corners (`--radius: 0` + utility-class overrides on `rounded-{sm..4xl}`), and JetBrains Mono Variable self-hosted via `@fontsource-variable/jetbrains-mono`.
- [ ] **TOKEN-04**: WCAG AAA contrast verified for `--fg-mid`/`--fg-base`/`--fg-bright` against `--bg-panel` (audit script in repo); `prefers-contrast: more` fallback path provided.
- [ ] **TOKEN-05**: Cyrillic + Estonian glyph metrics verified in JetBrains Mono (no column drift in monospace tables) — fallback to IBM Plex Mono recorded if drift observed.

### App Shell & Layout Primitives (SHELL)

- [ ] **SHELL-01**: 2×3 CSS-Grid `AppShell` (sketch 005 `grid-template-areas: "topbar topbar" / "sidebar main" / "sidebar bottombar"`) renders authenticated content; sidebar runs full-height; bottombar spans only the main column.
- [ ] **SHELL-02**: Sidebar collapse is a single `data-collapsed` attribute toggle on the grid root — no JavaScript layout work, no measure phase.
- [ ] **SHELL-03**: TopBar shows slim brand mark (30×30 beveled square + "HOME WAREHOUSE"), workspace pill, ONLINE indicator dot bound to live SSE state, and user pill with menu dropdown.
- [ ] **SHELL-04**: Sidebar groups nav into `// OVERVIEW`, `// INVENTORY`, and `// SYSTEM` sections with monospace amber labels; per-route active indicator (left-border bevel + glow); collapses to icon-rail with badge dot mode.
- [ ] **SHELL-05**: PageHeader renders `// {ROUTE}` breadcrumb plus `SESSION {hh:mm:ss} // LAST SYNC {hh:mm:ss}` system-status meta on every authenticated route.
- [ ] **SHELL-06**: AppShell is mobile-responsive — sidebar becomes a drawer at `<768px`; bottombar overflow plan keeps F1 and ESC right-anchored, the rest paged or in an overflow sheet.

### Function-Key Bottombar (BAR)

- [ ] **BAR-01**: Bottombar mounts on every authenticated route, renders `[KEY] LABEL` chips for the current route plus globals (F1 HELP), and a right-side `SESSION + LOCAL` clock pair updated every second.
- [ ] **BAR-02**: `useShortcuts(id, [{ key, label, action, danger? }])` hook is the single source of truth — registers shortcuts into a context indexed by `useId()`, the bar reads from context for both rendering AND the keydown listener.
- [ ] **BAR-03**: Keydown dispatcher honors an `isEditableTarget(e.target)` guard so single-letter shortcuts NEVER trigger when the user is typing in an input, textarea, select, or contenteditable surface (regression test on every form).
- [ ] **BAR-04**: Bottombar `[KEY]` chips use `bg-primary text-primary-foreground` so they read amber-on-near-black under retro and adopt the theme `primary` token under any other theme.
- [ ] **BAR-05**: F1 chip click and F1 keydown both open the keyboard-shortcuts help dialog (existing `useKeyboardShortcutsDialog` pattern from `/frontend`); ESC keydown is NOT bound to logout — confirm-before-logout pattern only via menu.

### Providers (PROV)

- [ ] **PROV-01**: Provider stack mounts in this exact order: `IntlProvider > QueryClientProvider > AuthProvider > SSEProvider > ToastProvider > ShortcutsProvider > BrowserRouter`.
- [ ] **PROV-02**: SSEProvider opens a single EventSource (JWT in URL query param), exposes `useSSEStatus()` selector returning `{ connected: boolean, lastEventAt: Date | null }` for chrome consumers (TopBar ONLINE dot, PageHeader LAST SYNC), and a `useSSE({ onEvent })` subscribe API for feature consumers.
- [ ] **PROV-03**: ShortcutsProvider ports verbatim from `frontend/components/layout/shortcuts-context.tsx`; register-by-id Context pattern; supports unregister-on-unmount cleanup.
- [ ] **PROV-04**: ToastProvider mounts sonner with retro-skinned styling (sharp corners, monospace, panel bevel).

### Auth (AUTH)

- [ ] **AUTH-01**: User can log in with email + password via `POST /api/auth/login`; cookie-JWT (`credentials: "include"`); 401 refresh single-flighted in `lib/api.ts`.
- [ ] **AUTH-02**: User can register a new account via `POST /api/auth/register`.
- [ ] **AUTH-03**: User can log in via Google OAuth (PKCE + Authorization Code flow + one-time Redis code exchange); auto-link by verified email.
- [ ] **AUTH-04**: User can log in via GitHub OAuth (same flow with `/user/emails` for private-email accounts); auto-link by verified email.
- [ ] **AUTH-05**: `RequireAuth` route wrapper redirects unauthenticated users to `/login` AND DOES NOT log out on transient network errors (HttpError-status-aware, fixes v2.0 spurious-logout bug).
- [ ] **AUTH-06**: Workspace switcher in topbar lists user's workspaces and allows switching; selected workspaceId is the SSOT for all entity API calls.
- [ ] **AUTH-07**: Active sessions list in Settings → Security; user can revoke individual sessions or all-other-sessions; current-session badge.
- [ ] **AUTH-08**: User can change password (current-password verification + 8+ char zod validation); OAuth-only accounts get a "set password" path.
- [ ] **AUTH-09**: User can delete account with type-to-confirm (`DELETE`) + sole-owner workspace validation.
- [ ] **AUTH-10**: Connected Accounts subpage in Settings — link/unlink Google + GitHub providers with last-method-removal lockout guard.

### Items (ITEM)

- [ ] **ITEM-01**: User can browse items in a paginated list (25/page, RetroTable), with search input, filter chips (category, location, archived), sort headers, and URL-driven query params for deep-linking.
- [ ] **ITEM-02**: User can view an item detail page showing all fields, photo gallery (if any), active-loan panel (if any), and loan history panel.
- [ ] **ITEM-03**: User can create a new item via `/items/new`, with optional `?barcode={code}` query param prefilling the barcode field (forward-compat with scan flow).
- [ ] **ITEM-04**: User can edit an item via `/items/{id}/edit` and save with optimistic UI invalidation of `itemKeys.all` + relevant detail keys.
- [ ] **ITEM-05**: User can archive / unarchive an item; archived items are filtered out by default but visible via the "Show archived" filter chip.
- [ ] **ITEM-06**: User can delete an item with type-to-confirm dialog (only available for archived items per legacy convention).
- [ ] **ITEM-07**: User can upload up to N photos per item (JPEG/PNG/HEIC, client-resize, 10 MB cap per file); native FormData multipart, no upload library.
- [ ] **ITEM-08**: User can view item photos in a gallery + lightbox (keyboard nav: arrow keys + ESC); set primary thumbnail; delete individual photos with confirm.
- [ ] **ITEM-09**: `itemsApi.lookupByBarcode(workspaceId, code)` helper exists and calls `GET /api/workspaces/{wsId}/items/by-barcode/{code}` with workspace-scoped server-side authority + 404 → null mapping (G-65-01 regression guard pattern).
- [ ] **ITEM-10**: Items list page registers `useShortcuts("items", [{ key: "N", action: navTo("/items/new") }, { key: "/", action: focusSearch }, { key: "F", action: toggleFilters }])`.

### Loans (LOAN)

- [ ] **LOAN-01**: User can view loans in a tabbed view — Active / Overdue / History — with RetroTable rows showing item / borrower / due date / status pill.
- [ ] **LOAN-02**: User can create a new loan via `/loans/new` with item picker + borrower picker; supports `?itemId={id}` URL param to preselect (deep-linkable from scan flow).
- [ ] **LOAN-03**: User can mark a loan as returned via a confirm dialog; status transitions to History tab.
- [ ] **LOAN-04**: User can edit a loan's due date and notes after creation.
- [ ] **LOAN-05**: Item detail page renders an "Active Loan" panel (if any) and "Loan History" panel listing all past loans for the item.
- [ ] **LOAN-06**: Borrower detail page renders an "Active Loans" panel and "Loan History" panel listing all loans for the borrower.

### Borrowers (BORR)

- [ ] **BORR-01**: User can browse borrowers in a flat paginated list (no nesting), with search input + RetroPagination.
- [ ] **BORR-02**: User can create a new borrower (name + optional contact info).
- [ ] **BORR-03**: User can view a borrower's detail page (active + historical loan panels, see LOAN-06).
- [ ] **BORR-04**: User can edit a borrower's profile.
- [ ] **BORR-05**: User can delete a borrower; deletion is blocked while any loan is active (red badge + "View active loans" link).

### Taxonomy (TAX)

- [ ] **TAX-01**: User can view categories as a hierarchical tree on the Taxonomy page (Categories tab); expand/collapse persisted to sessionStorage.
- [ ] **TAX-02**: User can create / edit / archive categories at any level; usage warnings when archiving a category with assigned items.
- [ ] **TAX-03**: User can view locations as a hierarchical tree on the Taxonomy page (Locations tab).
- [ ] **TAX-04**: User can create / edit / archive locations at any level.
- [ ] **TAX-05**: User can view containers grouped by location on the Taxonomy page (Containers tab).
- [ ] **TAX-06**: User can create / edit / delete containers; container deletion is allowed when not assigned to items, otherwise unassign-and-delete behavior (matches v2.2 cascade decision).

### Scan (SCAN)

- [ ] **SCAN-01**: User can open `/scan` and see a live rear-camera preview with scanner controls; `<BarcodeScanner>` mounts ONCE and stays mounted while overlays render on top — never navigates away mid-scan (iOS PWA camera-permission persistence).
- [ ] **SCAN-02**: Scanner decodes QR, UPC-A, EAN-13, and Code128 formats via `@yudiel/react-qr-scanner@2.5.1` (exact pin); pause-on-match is prop-driven, NOT unmount.
- [ ] **SCAN-03**: On successful scan, user hears AudioContext oscillator beep, feels haptic (ios-haptics on iOS 17.4+ Safari, navigator.vibrate elsewhere), and sees a visual flash/checkmark.
- [ ] **SCAN-04**: User can toggle torch on Android devices that expose `MediaStreamTrack.getCapabilities().torch` (button auto-hidden on iOS).
- [ ] **SCAN-05**: User can manually enter a barcode via a fallback Manual tab (RetroInput + LOOK UP CODE button) when camera scan fails or permission is denied.
- [ ] **SCAN-06**: User sees the last 10 scanned codes in a History tab (localStorage key `hws-scan-history`), each row tap re-fires the post-scan flow.
- [ ] **SCAN-07**: User can clear scan history with a confirm dialog.
- [ ] **SCAN-08**: On scan/manual-entry, `itemsApi.lookupByBarcode` resolves to a 4-state banner — LOADING / MATCH / NOT-FOUND / ERROR — with a `prefers-reduced-motion`-aware blinking-cursor variant.
- [ ] **SCAN-09**: NOT-FOUND state shows a "create item with this barcode" action navigating to `/items/new?barcode=<code>`.
- [ ] **SCAN-10**: For codes matching `/^\d{8,14}$/`, the item-create form shows suggested name/brand from `GET /api/barcode/{code}` as opt-in prefill (suggestion banner with USE / USE ALL / DISMISS).
- [ ] **SCAN-11**: After a MATCH, a quick-action overlay shows View Item / Loan / Back to Scan; menu is state-adaptive (Loan hidden if item on active loan, Unarchive if archived, Mark Reviewed if `needs_review`).

### Settings (SETT)

- [ ] **SETT-01**: Settings landing page has iOS-style grouped rows linking to subpages — Profile, Security, Appearance, Language, Regional Formats, Notifications, Connected Accounts, Data Storage.
- [ ] **SETT-02**: Profile subpage — edit name, email, avatar (upload + 150×150 thumbnail).
- [ ] **SETT-03**: Security subpage — password change, active sessions list + revoke, account deletion.
- [ ] **SETT-04**: Appearance subpage — theme picker; under v3.0 the only theme is premium-terminal (the design IS the product per anti-feature lock).
- [ ] **SETT-05**: Language subpage — pick from English / Estonian / Russian.
- [ ] **SETT-06**: Regional Formats subpage — date format, time format, thousand separator, decimal separator.
- [ ] **SETT-07**: Notifications subpage — in-app preference toggles for SSE event types.
- [ ] **SETT-08**: Connected Accounts subpage — link/unlink OAuth providers.
- [ ] **SETT-09**: Data Storage subpage — clear cached query data, export workspace, import workspace (online-only — no offline-storage management surface).

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

- [ ] **TUI-01**: Per-route shortcut sets registered via `useShortcuts(routeName, [...])`; Bottombar reflects the active route's set without flicker on route change.
- [ ] **TUI-02**: Modal-stack ESC pops the topmost overlay first (dialog → drawer → menu), never logging out while any modal is open.
- [ ] **TUI-03**: SSE state in panel headers — live dot + `sse: ● live` text on panels that subscribe to entity events.
- [ ] **TUI-04**: Status pills on row entities — OK / WARN / INFO / DANGER variants with color tokens; numeric columns use `tabular-nums`.
- [ ] **TUI-05**: Command palette (Cmd+K / F2) via `cmdk` — filters across routes, recent actions, and workspaces; keyboard-first navigation.
- [ ] **TUI-06**: Multi-select via Shift+Click on RetroTable rows; Bottombar surfaces bulk actions for the active selection set.

### Polish & Quality (POL)

- [ ] **POL-01**: All flows that cross the HTTP boundary have at least one real-backend test — Playwright E2E for browser-driven flows + tagged Go integration test for server contract (Phase 65 Plan 65-11 pattern, applied from Day 1).
- [ ] **POL-02**: All interactive elements pass `axe-playwright` CI sweep — no contrast / focus-visible / touch-target / aria-label violations.
- [ ] **POL-03**: Tab/keyboard navigation audit — every page is fully keyboard-navigable; focus indicator visible (focus-visible, not focus); no keyboard traps.
- [ ] **POL-04**: Bundle size CI guard — `vite build` output stays under documented per-chunk budgets (main / scanner / vendor); regression-by-PR fails CI with clear delta report.
- [ ] **POL-05**: Mobile breakpoint matrix re-tested at 320 / 360 / 768 / 1024 / 1440 px; visual diff vs sketch 005 PNG for the dashboard route.

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
| FOUND-01 | TBD | Pending |
| FOUND-02 | TBD | Pending |
| FOUND-03 | TBD | Pending |
| FOUND-04 | TBD | Pending |
| FOUND-05 | TBD | Pending |
| FOUND-06 | TBD | Pending |
| TOKEN-01 | TBD | Pending |
| TOKEN-02 | TBD | Pending |
| TOKEN-03 | TBD | Pending |
| TOKEN-04 | TBD | Pending |
| TOKEN-05 | TBD | Pending |
| SHELL-01 | TBD | Pending |
| SHELL-02 | TBD | Pending |
| SHELL-03 | TBD | Pending |
| SHELL-04 | TBD | Pending |
| SHELL-05 | TBD | Pending |
| SHELL-06 | TBD | Pending |
| BAR-01 | TBD | Pending |
| BAR-02 | TBD | Pending |
| BAR-03 | TBD | Pending |
| BAR-04 | TBD | Pending |
| BAR-05 | TBD | Pending |
| PROV-01 | TBD | Pending |
| PROV-02 | TBD | Pending |
| PROV-03 | TBD | Pending |
| PROV-04 | TBD | Pending |
| AUTH-01 | TBD | Pending |
| AUTH-02 | TBD | Pending |
| AUTH-03 | TBD | Pending |
| AUTH-04 | TBD | Pending |
| AUTH-05 | TBD | Pending |
| AUTH-06 | TBD | Pending |
| AUTH-07 | TBD | Pending |
| AUTH-08 | TBD | Pending |
| AUTH-09 | TBD | Pending |
| AUTH-10 | TBD | Pending |
| ITEM-01 | TBD | Pending |
| ITEM-02 | TBD | Pending |
| ITEM-03 | TBD | Pending |
| ITEM-04 | TBD | Pending |
| ITEM-05 | TBD | Pending |
| ITEM-06 | TBD | Pending |
| ITEM-07 | TBD | Pending |
| ITEM-08 | TBD | Pending |
| ITEM-09 | TBD | Pending |
| ITEM-10 | TBD | Pending |
| LOAN-01 | TBD | Pending |
| LOAN-02 | TBD | Pending |
| LOAN-03 | TBD | Pending |
| LOAN-04 | TBD | Pending |
| LOAN-05 | TBD | Pending |
| LOAN-06 | TBD | Pending |
| BORR-01 | TBD | Pending |
| BORR-02 | TBD | Pending |
| BORR-03 | TBD | Pending |
| BORR-04 | TBD | Pending |
| BORR-05 | TBD | Pending |
| TAX-01 | TBD | Pending |
| TAX-02 | TBD | Pending |
| TAX-03 | TBD | Pending |
| TAX-04 | TBD | Pending |
| TAX-05 | TBD | Pending |
| TAX-06 | TBD | Pending |
| SCAN-01 | TBD | Pending |
| SCAN-02 | TBD | Pending |
| SCAN-03 | TBD | Pending |
| SCAN-04 | TBD | Pending |
| SCAN-05 | TBD | Pending |
| SCAN-06 | TBD | Pending |
| SCAN-07 | TBD | Pending |
| SCAN-08 | TBD | Pending |
| SCAN-09 | TBD | Pending |
| SCAN-10 | TBD | Pending |
| SCAN-11 | TBD | Pending |
| SETT-01 | TBD | Pending |
| SETT-02 | TBD | Pending |
| SETT-03 | TBD | Pending |
| SETT-04 | TBD | Pending |
| SETT-05 | TBD | Pending |
| SETT-06 | TBD | Pending |
| SETT-07 | TBD | Pending |
| SETT-08 | TBD | Pending |
| SETT-09 | TBD | Pending |
| DASH-01 | TBD | Pending |
| DASH-02 | TBD | Pending |
| DASH-03 | TBD | Pending |
| DASH-04 | TBD | Pending |
| DASH-05 | TBD | Pending |
| I18N-01 | TBD | Pending |
| I18N-02 | TBD | Pending |
| I18N-03 | TBD | Pending |
| SYS-01 | TBD | Pending |
| SYS-02 | TBD | Pending |
| SYS-03 | TBD | Pending |
| SYS-04 | TBD | Pending |
| TUI-01 | TBD | Pending |
| TUI-02 | TBD | Pending |
| TUI-03 | TBD | Pending |
| TUI-04 | TBD | Pending |
| TUI-05 | TBD | Pending |
| TUI-06 | TBD | Pending |
| POL-01 | TBD | Pending |
| POL-02 | TBD | Pending |
| POL-03 | TBD | Pending |
| POL-04 | TBD | Pending |
| POL-05 | TBD | Pending |

**Total:** 91 requirements across 14 categories.

---

*Requirements defined: 2026-04-30*
*Roadmap + traceability: pending roadmapper run*
*Milestone: v3.0 Premium-Terminal Frontend*
