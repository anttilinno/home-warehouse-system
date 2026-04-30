# Feature Research — v3.0 Premium-Terminal Frontend (frontend2 rebuild)

**Domain:** Premium-terminal-aesthetic warehouse-management SPA — clean-slate rebuild of `/frontend2` reaching parity with the legacy `/frontend` (Next.js) AND landing the sketch 005 fidelity contract (slim brand topbar, sidebar `// GROUP` labels, function-key bottombar, HUD row, monospace, scanlines).
**Researched:** 2026-04-30
**Confidence:** HIGH for feature parity (predecessor shipped, code in tree); MEDIUM for TUI-on-web conventions (verified against k9s/lazygit/htop/midnight-commander references, but adaptation to mouse+touch web is judgment-driven); HIGH for sketch 005 contract (locked sketches + skill).

## Scope Framing

This is **not** greenfield product research. The legacy `/frontend` ships every feature listed below; the v2.0/v2.1/v2.2 wiped `/frontend2` shipped most of them once already. What's new in v3.0:

1. **Aesthetic contract is now load-bearing** — sketch 005 chrome is part of the deliverable, not a re-skin opt-in. Function-key bottombar, page-header `SESSION ... // LAST SYNC` meta, sidebar group labels, slim brand topbar, HUD row are first-class features.
2. **Online-only, lean** — v2.1 dropped the IndexedDB/Serwist stack (CI grep guards it). The rebuild stays online-only; offline returns as a separate later milestone if at all.
3. **Native TUI keyboard model** — function keys + ESC + per-route shortcut declarations replace ad-hoc shortcuts. This is a UX feature, not chrome.
4. **HUD widgets need real data** — capacity gauge implies `capacity_target` rollups; activity sparkline implies per-day activity rollups. Backend may not have either; either ship feature-flagged or scope a backend rollup endpoint.

**Categorization rule used below:**
- **Table stakes** = parity with `/frontend` legacy OR locked sketch 005 element. Missing = feature regression or aesthetic miss.
- **Differentiator** = sketch 005 polish OR a TUI-genre signature behavior (function-key dispatch, command palette, monospace-grid data) that elevates the rebuild above a "shadcn re-skin."
- **Anti-feature** = pattern from TUI culture, mobile UX, or competitor inventory tools that does NOT fit warehouse domain or actively breaks the aesthetic.

Each feature is annotated with **Complexity (S/M/L)**, **Dependencies** on existing /frontend code or backend endpoints, and **Aesthetic notes** specific to sketch 005.

---

## Feature Landscape

### Table Stakes (Users Expect These / Locked by Sketches)

#### A. Application Shell & Chrome (sketch 005 fidelity)

| Feature | Why Expected | Complexity | Dependencies | Aesthetic notes |
|---|---|---|---|---|
| **Slim brand topbar (48px)** with 30×30 beveled brand-mark + brand-text + spacer + workspace pill + ONLINE dot + user pill | Sketch 005 locked | S | None | Inset-bevel brand-mark = same treatment as user-menu avatar. ONLINE dot uses `step-end` blink (not smooth pulse). |
| **Sidebar with three `// GROUP` labels** (`// OVERVIEW`, `// INVENTORY`, `// SYSTEM`) | Sketch 005 locked + matches `eacaa01` legacy refactor | S | None | Labels: 11px, 700, 0.18em letter-spacing, `--fg-mid`. Group spacing 16px expanded → 8px collapsed. |
| **Sidebar collapse-to-rail (248px ↔ 60px)** | Sketch 005 locked + tablet/dense-operator escape hatch | S | None | Single CSS custom-property swap (`--sidebar-w`) on root grid. No JS layout. Group labels + item labels + badges hide; avatar centers. |
| **Two-rail active-nav indicator** (left 2px solid border + right 3px glowing rail) | Sketch 005 locked | S | None | Active icon uses `filter: drop-shadow(0 0 6px var(--fg-bright))`. |
| **Function-key Bottombar** (always visible, context-aware) with amber `[KEY]` chips + label + right-side `SESSION` + `LOCAL` clock | Sketch 005 locked — this is THE defining UX pattern | M | New `useShortcuts(page)` hook + `<ShortcutsContext>` provider + `<Bottombar>` component | `[KEY]` chips: amber bg `#ffd07a` on near-black `#1a0e00` text — must read as physical key cap, not green-on-green. Danger variant uses `--accent-danger`. Hover lifts cap with faint glow. |
| **Globals: F1 HELP, ESC LOGOUT/CANCEL** registered by Bottombar itself | Universal TUI convention (k9s, lazygit, mc — `?` for help is also acceptable but F1 is sketch-locked) | S | Help modal + auth | F1 opens contextual help overlay; ESC closes any modal stack OR (top level) prompts logout. |
| **Page-header pattern**: `// {ROUTE}` breadcrumb on left, `SESSION 0:42:18 // LAST SYNC 14:02:11` meta on right | Sketch 005 locked | S | Session start time (client) + last-sync-from-server time | Reads as system-status; do NOT drop the meta line — anti-pattern called out in `layout.md`. |
| **Panel component** (beveled bg + inset highlight + outer subtle amber glow) used for every card surface | Sketch 005 locked | S | None | `border: 2px solid var(--fg-dim); box-shadow: inset 1px 1px 0 rgba(255,255,255,0.05), inset -1px -1px 0 rgba(0,0,0,0.6), 0 0 16px rgba(255,208,122,0.04)` — verbatim from `components.md`. |
| **Panel header with `// meta` separator** (e.g. `RECENT ACTIVITY` left, `last 10 // sse: ● live` right) | Sketch 005 locked | S | SSE connection state already exists in legacy | Header bg = `--bg-panel-2` (different from body), bottom border 1px `--fg-dim`. |
| **Sharp corners everywhere** (`--radius: 0`) | Sketch 005 locked | S | None | Override Tailwind/utility class radii globally. |
| **Monospace globals** (`ui-monospace, "JetBrains Mono", ...`) | Sketch 005 locked | S | None | No proportional fonts anywhere — even body. Letter-spacing 0.04em on body, 0.18em on micro labels. |
| **Scanline body overlay** (subtle horizontal gradient + radial vignette, fixed-attach) | Sketch 005 locked | S | None | Disable on `prefers-reduced-motion: reduce`. |
| **User menu in sidebar footer** (avatar + name + email + caret, dropdown opens UPWARD) | Sketch 005 locked | M | Auth state | Beveled square avatar (NOT circular — anti-pattern). Collapsed-rail variant: avatar only, dropdown opens to the right. |

#### B. Auth Surface (/frontend parity)

| Feature | Why Expected | Complexity | Dependencies | Aesthetic notes |
|---|---|---|---|---|
| Email/password login + register + logout | Legacy parity (v1.x) | S | Auth API exists | "LOG IN" button is sharp-corner uppercase amber ghost button. Use existing JWT cookie contract. |
| Google OAuth + GitHub OAuth (Authorization Code + PKCE flow) | Legacy parity (v1.8) | M | Existing OAuth backend (Redis code exchange, no client secret in browser) | "SIGN IN WITH GOOGLE" / "SIGN IN WITH GITHUB" — same beveled button, no provider color leakage. Disabled-when-offline state with `WifiOff` Lucide icon (translated). |
| Auto-link by verified email | Legacy parity (v1.8 SEC-01) | S | Backend handles | Show confirmation panel before linking; never auto-merge. |
| Connected accounts management in Security settings | Legacy parity (v1.8 ACCT-01..06) | S | Existing endpoints | List provider + linked-on date + Unlink button. Last-auth-method lockout guard already on backend. |
| Session listing + revoke | Legacy parity (v1.5 SEC-02) | S | Sessions API exists | Activity-table style: device / IP / last-active / Revoke. |
| Account deletion with type-to-confirm `"DELETE"` | Legacy parity (v1.5 ACCT-04) | S | API exists | Sole-owner workspace check on backend; UI shows blocking warning. |
| Password change | Legacy parity (v1.5 SEC-01) | S | API exists | OAuth-only users path (set-password without current-password) per v1.8 ACCT-03. |

#### C. Items (/frontend parity + sketch 005 list patterns)

| Feature | Why Expected | Complexity | Dependencies | Aesthetic notes |
|---|---|---|---|---|
| **Items list** — paginated 25/page, search, filter, sort, archived toggle | Legacy parity (v2.1 ITEM-01..08) | M | `GET /api/v1/items` already supports query params | Activity-table style: monospace columns, header bg `--bg-panel-2`, no zebra stripes (fight scanlines). 44px row min-height. |
| **Item detail** with photo gallery, primary thumbnail, metadata, active loan status | Legacy parity (v2.1 ITEM-04) | M | Items API + photos endpoints | Two-column: photos panel left, details panel right; on mobile collapse to stacked panels. |
| **Item create/edit** — full form with all fields + barcode + category + location + container pickers | Legacy parity | M | Items API + taxonomy APIs | Inline retro form components (RetroFormField, RetroSelect, RetroCombobox, RetroFileInput, RetroTextarea). |
| **Item archive/unarchive toggle** | Legacy parity | S | API supports | Status pill displays ARCHIVED state with `--accent-warn` color. |
| **Item delete** with confirmation dialog | Legacy parity | S | API + RetroConfirmDialog | Confirmation requires typing item name OR explicit confirm button — matches account-delete pattern. |
| **Item photos** — multipart upload (JPEG/PNG/HEIC, client-resize, 10 MB cap), gallery viewer, primary-thumbnail | Legacy parity (v2.1 PHOTO-01..04) | M | `postMultipart` helper + photo endpoints | Lightbox is full-screen panel, not a circular modal — keeps the chrome. |
| **Pagination component** (numeric + prev/next) | Legacy parity (v2.1 RetroPagination) | S | None | Show `[N] of M` in monospace + prev/next as `[<]`/`[>]` mini chips. |

#### D. Loans (/frontend parity)

| Feature | Why Expected | Complexity | Dependencies | Aesthetic notes |
|---|---|---|---|---|
| **Tabbed list** Active / Overdue / History | Legacy parity (v2.1 LOAN-01..06) | M | Loans API exists; status derived from due_date | Tabs use sketch 005 panel-header treatment with active-tab amber underline. |
| **Loan create** with item picker (RetroCombobox) + borrower picker + due date + notes | Legacy parity | M | Loans API + items + borrowers | UAT bug from v2.1 (`FindActiveLoanForInventory` returning ErrNotFound) is fixed in backend — DO NOT regress when porting. |
| **Mark returned** action | Legacy parity | S | Loans API PATCH | Quick action on row + on detail panel. |
| **Edit due date / notes** | Legacy parity | S | API supports | Inline edit on detail; full form on edit route. |
| **Per-item active-loan + history panels** on item detail | Legacy parity | S | Loan-by-item endpoint | Panel with `// ACTIVE LOAN` and `// LOAN HISTORY` headers. |
| **Per-borrower active + history panels** on borrower detail | Legacy parity | S | Loan-by-borrower endpoint | Same pattern. |
| **Overdue visual emphasis** — `--accent-danger` left border + tag pill | Legacy parity + aesthetic | S | Date math client-side | Use `.alert.danger` row variant from theme. |

#### E. Borrowers (/frontend parity)

| Feature | Why Expected | Complexity | Dependencies | Aesthetic notes |
|---|---|---|---|---|
| Flat borrower list + search | Legacy parity (v2.1 BORR-01..05) | S | Borrowers API exists | Activity-table style. |
| Borrower CRUD with active-loan guard on delete | Legacy parity | S | API enforces guard | Show blocking error with active-loan count. |
| Borrower detail with active + history loan panels | Legacy parity | S | Loan-by-borrower endpoint | Same as item detail loan panels. |

#### F. Taxonomy (/frontend parity)

| Feature | Why Expected | Complexity | Dependencies | Aesthetic notes |
|---|---|---|---|---|
| **Categories tree** — hierarchical CRUD with archive/delete + usage warning | Legacy parity (v2.1 TAX-01..12) | M | Categories API exists | Tree uses indented rows with `└─ ` ASCII connector or bordered indent rail — fits TUI aesthetic. |
| **Locations tree** — hierarchical CRUD | Legacy parity | M | Locations API | Same pattern. |
| **Containers grouped by location** — flat list within parent location | Legacy parity | S | Containers API | Group headers reuse panel-header treatment with location name. |
| **Tree expand/collapse** with persisted state per session | UX expectation; matches code-tree TUI tools | S | sessionStorage | `[+]` / `[-]` ASCII or Lucide chevron consistent with other expand affordances. |
| **Drag-and-drop reorder/reparent** within tree | Power-user expectation; legacy supports | M | API supports parent_id PATCH | OPTIONAL — keyboard reorder (`Alt+↑`/`Alt+↓`) is a fine TUI-friendly substitute if DnD adds complexity. |

#### G. Scan (/frontend v1.3 + v2.2 parity)

| Feature | Why Expected | Complexity | Dependencies | Aesthetic notes |
|---|---|---|---|---|
| **Single-route `/scan`** that mounts `<BarcodeScanner>` once and overlays UI on top | iOS PWA permission persistence (v2.2 research) | M | `@yudiel/react-qr-scanner@2.5.1` (React 19 peer-dep confirmed) | Do NOT navigate between scan and quick-action. |
| **QR + UPC/EAN/Code128 detection** | Legacy parity (v1.3) | S | Library + `barcode-detector` polyfill | `SUPPORTED_FORMATS = ["qr_code","ean_13","ean_8","upc_a","upc_e","code_128"]` |
| **Lookup scanned code → item** | Legacy parity | S | `GET /api/v1/items?barcode=<code>` (verify endpoint shape during planning) | TanStack Query with no-cache for scan lookups. |
| **Pause-on-match** (prop-driven, NOT unmount) | iOS persistence | S | `paused` prop on `<Scanner>` | — |
| **Torch toggle** (Android/Chromium only — feature-detect + hide on iOS) | Warehouse low-light | S | `MediaTrackCapabilities.torch` | Lucide `Flashlight` / `FlashlightOff` icon. |
| **Manual barcode entry fallback** tab | Damaged labels | S | Same lookup endpoint | `autoCapitalize="off"` etc. mandatory. |
| **Scan history** (last 10, localStorage, dedup, re-lookup on tap) | Legacy parity | S | localStorage util port from `/frontend` | Activity-table style with timestamp formatting via existing `useDateFormat`. |
| **Quick-action overlay after match** (View / Loan / Edit) | Legacy parity | M | Items API state flags | Bottom-sheet panel; sketch 005 panel treatment. NEVER cover scanner with a centered modal. |
| **Not-found state with "Create item (prefilled barcode)"** | Legacy parity | S | Items create with `?barcode=` URL param | Hazard-stripe panel + scanned code shown verbatim. |
| **Audio (Web Audio API beep) + haptic (vibrate + ios-haptics) + visual feedback** | Warehouse noisy/gloved workflow | S | `ios-haptics` library | Single util; respect notification-prefs mute toggle. |

#### H. Settings (/frontend parity)

| Feature | Why Expected | Complexity | Dependencies | Aesthetic notes |
|---|---|---|---|---|
| **Settings hub landing** with iOS-style grouped rows | Legacy parity (v1.7 HUB-01..06) | S | Existing prefs API | Hub rows are mini-panels with right-aligned `→` chevron and current-value preview text. |
| **Profile** subpage (name/email/avatar) | Legacy parity (v1.7 PROF-01..03) | S | Profile API | Avatar upload reuses photo upload pattern. |
| **Appearance** subpage with theme toggle | Existing — but note sketch 005 IS the theme | S | next-themes equivalent (Vite app uses simpler `useState` + `data-theme`) | For v3.0: probably ship single retro-terminal theme + maybe a "high-contrast retro" variant. Light theme is out of scope per redesign mandate. |
| **Language** subpage (en / et / ru) | Legacy parity | S | i18n library (decision below) | Persist to backend prefs. |
| **Regional Formats** subpage (date / time / number / separators) | Legacy parity (v1.6 FMT-01..03) | M | Format hooks `useDateFormat`, `useTimeFormat`, `useNumberFormat` | All display components must use the hooks — no `Date.toLocaleString` calls outside them. CI grep guard. |
| **Security** subpage (password change, sessions, account deletion, connected accounts) | Legacy parity (v1.5 + v1.8) | M | Auth APIs | Cluster: Authentication / Active Sessions / Account zones. |
| **Data & Storage** subpage | Legacy parity (v1.7 DATA-01..05) — but ONLINE-ONLY scope shrinks this | S | Manual sync trigger — but no IndexedDB | For v3.0 online-only: shrinks to "Clear cached query data" + "Export workspace" + "Import workspace". Drop offline-storage usage display. |
| **Notifications** subpage with per-category SSE preference toggles | Legacy parity (v1.7 NOTF-01..05) | S | Existing JSONB on `users` | Display-only filtering — SSE data sync untouched per v1.7 decision. |

#### I. Dashboard (sketch 001/005 contract)

| Feature | Why Expected | Complexity | Dependencies | Aesthetic notes |
|---|---|---|---|---|
| **HUD row** — capacity gauge (semicircle SVG) + activity sparkline (14d bars SVG) + 3 stat tiles, ratio 1.2/1.2/1 | Sketch 001/005 locked | M | **Backend rollups** — `capacity_target` (PER-WORKSPACE setting; doesn't exist) and `activity-events-by-day` (doesn't exist) | **Behind feature flag if rollups absent.** Hand-rolled SVG only — NO charting library (skill anti-pattern). |
| **Activity table** — last 10 entries, columns Timestamp / Action / Entity / Actor / Status, full-width | Sketch 001/005 locked | M | New backend endpoint `GET /api/v1/activity?limit=10` (audit log already exists from `pendingchange`/`syncHistory`) | `td.code` for action codes (CREATE/UPDATE/DELETE) at `--fg-bright` 700 weight, `td.dim` for timestamps at `--fg-mid`. |
| **System Alerts panel** (right rail) | Sketch 001 locked | S | Reuse existing notification stream | `.alert` rows with colored left border + tag + message + `when`. |
| **Pending Approvals panel** (right rail) | Sketch 001 locked + legacy parity | S | Existing approvals endpoint | Counts in panel header; tap row → approvals page. |

#### J. Internationalization (en / et / ru)

| Feature | Why Expected | Complexity | Dependencies | Aesthetic notes |
|---|---|---|---|---|
| Three-language catalog (en/et/ru) | Legacy parity | M | i18n library — Lingui (existing v2.1) OR native `Intl` + lightweight runtime (e.g. `@formatjs/intl`) | **Decision: stick with Lingui for v3.0** — catalog is already pre-translated for legacy `/frontend` and v2.1; rewriting to native Intl adds risk without payoff. Confirm during phase planning. |
| Locale switcher in Language settings + persisted to backend prefs | Legacy parity | S | Prefs API | Restart-free language switch. |

---

### Differentiators (Premium-Terminal Polish + TUI-Genre Signatures)

#### K. Function-Key & Keyboard Model (TUI-genre)

| Feature | Value Proposition | Complexity | Dependencies | Aesthetic notes |
|---|---|---|---|---|
| **`useShortcuts(page)` hook** as single source of truth | One declaration drives both bottombar render AND keydown listener — no duplicate config drift | S | Bottombar component | Each route declares `[{key, label, action, danger?}]`. Globals (F1, ESC) appended by Bottombar. |
| **Per-route shortcut sets** (Dashboard: N=add S=scan L=loans Q=quick-capture; Approvals: A=approve R=reject D=defer; Items: N=new /=search F=filter; Loans: N=new R=mark-returned) | Each route has primary verbs accessible without mouse — matches mc/k9s/lazygit | S | Per route | Cap at 6–8 shortcuts visible on Bottombar (terminal-bar standard); overflow hides on narrow viewport (right-truncate with `...`). |
| **Function keys F1–F10 plus letters** | Mixes vim/emacs single-letter (`/` for search, `?` for help) with mainframe-TUI Fn keys (F1 HELP, F10 QUIT-equivalent = LOGOUT) | S | Bottombar dispatch | F1 = HELP everywhere; F2 = optional secondary; ESC = cancel/back-stack-pop; `/` = focus search input on any list page. |
| **Alt+letter for nav-jump shortcuts** (Alt+1 dashboard, Alt+2 items, Alt+3 loans...) | k9s `:items` / `:pods` muscle memory; numeric shortcuts faster than mouse for power users | S | Sidebar nav config | Number badges appear on hover/Alt-press over sidebar items. |
| **Command palette** (`Ctrl+K` / `Cmd+K`) — fuzzy command + entity search | TUI-genre signature; `/frontend` already has one (legacy GlobalSearchResults reference). Power-user accelerator. | M | Fuse.js or similar (already in legacy bundle) + command registry derived from useShortcuts + entity search endpoints | Full-screen panel with bordered list; type filters across pages, actions, entities. NOT a popover. |
| **Modal-stack ESC behavior** | TUI muscle memory — ESC always pops the topmost overlay | S | Stack tracking in app context | Order: open dropdown → close. Open dialog → close. Open command palette → close. Top of stack at root → confirm-logout dialog. |
| **Sequential vim-style chord support** (`g i` = go items, `g d` = dashboard) | Lazygit/k9s convention; truly fast for keyboard-only operators | M | Chord state machine in shortcut hook | OPTIONAL — defer until Bottombar lands. Document chord prefix in F1 help. |

#### L. Status & Density UX

| Feature | Value Proposition | Complexity | Dependencies | Aesthetic notes |
|---|---|---|---|---|
| **Live SSE connection state** in panel headers (`sse: ● live` blinking dot) | TUI-style "connection ok" affordance; matches Bloomberg/mainframe convention | S | Existing SSE | `step-end` blink. Red dot when disconnected with retry countdown. |
| **Density toggle** (compact / comfortable) on data tables | Power-user expectation; one of few customizations TUI tools expose | S | localStorage pref | 32px row height (compact) ↔ 44px (comfortable, default). |
| **Status pills** with locked palette (OK/WARN/INFO/DANGER) | Sketch 005 locked + reusable across loans (overdue), items (archived), approvals (pending) | S | Theme tokens | `border: 1px solid currentColor; background: faint matching tint`. |
| **Activity-feed timestamp pattern** — relative for <24h ("2m ago", "13:42"), absolute for older ("2026-04-28 09:14:32") | Activity feeds: relative when content is fresh, absolute when historical (UX Movement). Monospace makes column-aligned absolute timestamps the natural choice for >24h. | S | Existing `useDateFormat` hook | Default to absolute on TUI-style tables; relative only on alerts/notifications dropdown. Hover any timestamp to see the other form. |
| **Right-aligned numeric columns** in tables, monospace tabular-nums | Standard data-table best practice (Pencil & Paper, Justinmind); monospace already provides it but explicitly `font-variant-numeric: tabular-nums` for safety | S | None | Counts, prices, quantities right-aligned; text columns left-aligned; status pills right-aligned. |
| **Inline edit on detail panels** (click value → input replaces it; Enter saves; Esc cancels) | TUI-genre — k9s `e` to edit; lazygit `Enter` to commit | M | Per-field PATCH endpoints (most exist) | Use existing RetroInput primitives; persist on blur OR Enter; visible "saving..." + saved-flash. |

#### M. Sketch 005 Aesthetic Polish

| Feature | Value Proposition | Complexity | Dependencies | Aesthetic notes |
|---|---|---|---|---|
| **CRT scanline + radial vignette body** | Brand-defining; the visual signature | S | Globals CSS | Disable on `prefers-reduced-motion`. |
| **Phosphor glow on hero text** (page titles, panel titles, stat values) | Sketch 005 locked — `text-shadow: 0 0 8px rgba(239,255,230,0.5)` | S | Per-class CSS | Subtle — 8px / 0.5 alpha only. Don't glow body text (anti-pattern). |
| **Brisk 80ms hover transitions** | Terminal/HMI character — not slow Material 200ms ease | S | CSS transitions | Apply to .btn, .qa, .nav-item, etc. uniformly. |
| **Phosphor live-dot on ONLINE indicator** with `step-end` blink | Sketch 005 locked | S | Connection state | `step-end` not `ease-in-out` — sharp on/off. |
| **Beveled square avatar** (NOT circular) for user menu + brand mark | Sketch 005 locked | S | None | Initials fallback when no image. |
| **`// ROUTE` breadcrumb meta line** with SESSION + LAST SYNC | Sketch 005 locked | S | Session start time + last-sync time tracking | Drives "system feels like a console" affordance. |
| **ASCII tree connectors** on category/location trees (`├─ `, `└─ `) | Genre-correct (mc, tree command); pure CSS doable but careful w/ RTL | S | None | OPTIONAL — bordered indent rail also acceptable. |
| **Lucide icons at 1.75px stroke, 16–20px** | Sketch 003/004 locked | S | Lucide already standard | Pixel-art declined per sketch 004. |

#### N. Workflow Accelerators (TUI-genre)

| Feature | Value Proposition | Complexity | Dependencies | Aesthetic notes |
|---|---|---|---|---|
| **Multi-select via Shift+Click range + Ctrl+Click toggle** on table rows | Standard mc/Norton Commander convention; faster than checkboxes for power users | M | Selection state in list pages | Selection bar appears at panel footer with bulk-action `[KEY]` chips. |
| **`Space` to toggle row selection / `Enter` to open** keyboard convention | mc + lazygit + k9s muscle memory | S | Per-list keyboard handler | `j`/`k` (or arrow keys) to navigate row focus. |
| **Bulk operations via Bottombar** when rows selected (e.g., `[A] Archive`, `[D] Delete`) — context dynamic | Genre-correct AND solves the "v2.1 had no bulk ops" gap | M | Bulk endpoints (some exist) | Bottombar shortcut set updates dynamically based on selection count. |
| **Quick-capture flow port to v3.0** | Legacy parity (v1.9) — single-route camera-first capture, save-reset loop, session counter | L | Multipart upload, camera, session state | OPTIONAL for v3.0 — could ship in a later milestone since it leaned on offline. Online-only quick-capture is feasible but scope-heavy. |
| **CSV import / export hub** | Legacy parity but not yet in v2.1 frontend2 | M | Existing import/export backend | Renders as a dedicated `// SYSTEM > IMPORT/EXPORT` route with progress panels. |
| **Approvals page + My Changes + Sync History** (under `// SYSTEM` group) | Legacy parity | M | Existing endpoints | Activity-table style; bulk approve/reject via Bottombar. |
| **Repair log tracking** | Legacy parity (v1.2) but never ported to frontend2 | L | Existing backend | DEFER — high cost, separate domain panel. Mark as v3.1 candidate. |
| **Declutter assistant** | Legacy parity (v1.2) but never ported | L | Existing backend | DEFER — algorithmic feature, not core re-skin scope. v3.1 candidate. |

---

### Anti-Features (Avoid — Common but Wrong for This Rebuild)

#### O. Aesthetic / Chrome Anti-Features

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|---|---|---|---|
| **Charting library for gauge/sparkline** (Recharts, Chart.js, Tremor) | "Sparklines are tricky to roll by hand" | Adds 30–80 KB; off-aesthetic (default styles fight monospace + scanlines); sketch skill explicitly forbids | Hand-rolled SVG `<rect>` + `<path>` per skill `references/components.md`. ~30 LOC each. |
| **Multi-theme picker (light/dark/retro/...)** | "Users expect theme choice" | v3.0 IS the theme — that's the whole point. Light theme dilutes the design contract. | Single retro-terminal theme. Optionally add "high-contrast retro" if accessibility surfaces a need. |
| **shadcn-default soft drop-shadows on cards** | Familiar Material/iOS convention | Reads "modern web app dark theme," not "CRT terminal" | Inset bevel + faint amber outer glow per panel spec. |
| **Rounded corners (`rounded-md`, `rounded-lg`)** | Tailwind defaults | Sketch 005 locks `--radius: 0`. Curves break the fixed-grid feel. | Sharp corners everywhere; no per-component overrides. |
| **Animated panel-border hover** (e.g., border-glow pulse) | Looks "alive" | Reads as glitchy in this aesthetic. Hover belongs on content (color shift), not chrome. | Hover on content only — per components anti-pattern. |
| **Smooth `ease-in-out` blink on status dots** | "Polished" | Reads soft / Apple-y. Terminal LEDs are sharp on/off. | `step-end` keyframes. |
| **Zebra-stripe alternating row backgrounds** on tables | Improves scanability in proportional fonts | Fights the scanline overlay; visually busy with monospace. | No zebra. Row hover background only. |
| **Colored-icon status indicators** (red/green/yellow filled circles next to text) | Familiar | Color carries meaning, but fight phosphor-glow palette. | Status pills with border+background, OR colored-text status codes (`OK`, `WARN`, `FAIL`) in monospace. |
| **Round avatars** | iOS/Material default | Sketch 005 says square + beveled (anti-pattern in components.md). | Square beveled avatar with initials fallback. |
| **Toast notifications stacked top-right with rounded corners** | shadcn/sonner default | Off-aesthetic; competes with status row | Bottom-overlay terminal-style ticker OR sketch 001 alert-row pattern. |
| **Hamburger menu on mobile** | Common mobile pattern | Sidebar collapse-to-rail already solves it; hamburger drops the icon-rail value | Sidebar collapses to 60px rail on mobile. Optional drawer-overlay mode for portrait phone. |
| **Skeleton loaders with shimmer animation** | Modern Suspense pattern | Shimmer reads off-aesthetic | Terminal-style "LOADING..." monospace text OR ASCII spinner (`/ - \ |`). |
| **Lottie animations / micro-interactions** | "Delight" | Off-aesthetic; battery cost | Static sharp transitions only. |

#### P. TUI-Adjacent Patterns That DON'T Fit Warehouse

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|---|---|---|---|
| **Vim-modal editing (Normal/Insert mode)** | "TUI is vim" | Most TUI tools (k9s, lazygit, mc, htop, btop) are modeless — only vim itself is modal. Warehouse users are mixed-skill; modal editing breaks every input. | Modeless. Single-letter shortcuts only when no input is focused; never re-purpose alphabet keys while typing. |
| **`:command` Ex-mode prompt** | "k9s has it" | k9s' `:pods` is for resource-type switching — narrow utility. For our app, sidebar + Cmd+K palette covers it. | Cmd+K command palette covers this need without a modal. |
| **Tmux/screen-style multiplexed panes / split views** | "Power users want multiple panes" | Adds enormous layout complexity; warehouse workflow is sequential not parallel | Single primary pane + side rails (alerts/approvals) — already in sketch 005. |
| **ASCII-art logos / banners on splash screens** | "Genre" | Reads kitschy/cosplay; sketches deliberately rejected pixel-art for the same reason | Slim brand-mark + brand-text (sketch 005 topbar). |
| **Mouse-disable / "true keyboard-only" mode** | "Hardcore TUI" | Web is not a terminal. Mouse + touch parity is required. Warehouse users on mobile have NO keyboard. | Keyboard parity, NOT keyboard exclusivity. Every shortcut has a clickable equivalent in the chrome. |
| **`Ctrl+C` to copy disabled in favor of TUI semantics (interrupt)** | "Match terminal" | Breaks browser fundamentals + accessibility | Standard browser shortcuts win. Keep `Ctrl+C` = copy. |
| **Beep/error audio on every misclick** | Feedback consistency | Warehouse users in shared offices mute audio; constant beeps annoy | Audio only on scan success/failure (per existing v1.3 pattern). UI sound is silent. |
| **Forced fullscreen mode** | "Console feel" | Browser chrome IS the user's escape hatch | Stay within page. PWA install gives near-fullscreen if user opts in. |
| **No animations / instant state changes everywhere** | "TUIs don't animate" | k9s and lazygit DO animate (fade lists, smooth scrolls). Strict zero-animation reads broken. | Brisk 80ms transitions per sketch. Disable on `prefers-reduced-motion`. |
| **Scrollbar-disable in favor of `j`/`k`-only** | "Terminal authentic" | Mobile users have no `j`/`k`. Discoverable scroll affordance required. | Custom-styled retro scrollbar (thin + amber thumb on black track) — present, just on-aesthetic. |
| **Workspace switching modeled as terminal-tab buttons across topbar** | "Multi-workspace UX" | Topbar is brand + identity per sketch 005 anti-pattern; no toolbars there | Workspace pill in topbar opens a popover-list — user can switch from there. |

#### Q. Scope Anti-Features (Don't Re-Add)

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|---|---|---|---|
| **Offline mutations / IndexedDB / Serwist** | Legacy v1.x had it; muscle-memory wants it back | Wiped deliberately in v2.1. CI grep guard protects it. Adding back doubles complexity for marginal value at v3.0 stage. | ONLINE-ONLY. Defer offline to a post-v3.0 milestone if data shows users actually go offline. |
| **NFC tag scanning** | "Cool" | Limited device support (iOS partially); QR/barcode covers the warehouse use case | Out of scope per PROJECT.md. |
| **AR overlay for item location** | "Innovative" | High complexity; not core to inventory UX | Out of scope. |
| **Hardware barcode scanner (USB/Bluetooth HID)** | "Pro-warehouse feature" | Out of scope per PROJECT.md; camera + manual entry suffice | Documented out-of-scope. |
| **Per-user multi-theme + custom palette editor** | Customization | Sketch contract is a fidelity target — let users override palette and the design fails. Theme is the product. | Single locked theme. Add high-contrast retro variant only if a11y testing requires it. |
| **Voice search / voice-to-text item create** | Hands-free warehouse | Privacy-awkward, slow, web-speech browser support is patchy | Manual entry + scanner. |
| **Real-time collaborative cursors** | "Modern SaaS" | Single-user-per-workspace is the typical case; cursor noise on a TUI aesthetic is jarring | SSE for data updates only — no presence indicators in v3.0. |
| **Auto-opening tutorial / onboarding overlays** | "Explain the UI" | Power users hate them; the function-key bar IS the documentation | F1 HELP overlay on every page. Opt-in `[?] Tour` chip on dashboard for new users. |
| **Color-customization / accessibility palettes beyond dark/contrast** | "A11y completeness" | Theme is locked. AAA contrast already achieved in dual-channel palette. | One high-contrast variant if surface-level a11y feedback requires it. |
| **Cross-device clipboard / handoff** | "Apple-like" | Tiny user base; high complexity | Out of scope. |
| **Auto-create item with auto-name on scan timeout** | "Fast capture" | Data-quality disaster | Always require explicit user confirm — per v2.2 anti-features. |
| **Continuous batch-scan mode** | "Stocktaking" | Quick-capture territory, not scan core | Out of scope for v3.0; revisit if quick-capture ships. |

---

## Mobile Fallback Strategy

Mobile is **not** out of scope — warehouse users walk around with phones. But the sketch 005 chrome was validated at desktop only. Translation rules:

### Stays the same on mobile (≤768px)

| Element | Adaptation |
|---|---|
| Premium-terminal palette + scanlines + monospace | Unchanged. |
| Topbar | Compresses: brand-mark + workspace pill + ONLINE dot remain; hide brand-text and user pill (user accessible via sidebar drawer). |
| Sidebar | **Collapses to off-canvas drawer** (overlay, not pushed). Trigger via topbar tap or `[≡]` chip. The 60px rail variant is for tablets/landscape, not portrait phones. |
| Page-header `// ROUTE` + meta | Stack: route on first line, SESSION+LAST SYNC compress to one line below. |
| Activity tables / data tables | Switch to **panel-list cards** (one row → one panel) when columns > 4. Keep terminal-table for ≤3 column views. |
| Status pills + alert rows | Unchanged. |
| Panel beveled chrome | Unchanged. |

### Degrades / disappears on mobile

| Element | Mobile fallback |
|---|---|
| **Function-key Bottombar** | Replaced by **3-icon Bottombar** (primary + secondary + overflow) — same `[KEY]` chip aesthetic but icon-led. F1/ESC merge into overflow menu (`[⋯]`). HUGE TUI-genre win: no soft keyboard `[KEY]` chips makes sense on touch — keep them, but tap-driven. |
| **Sidebar `// GROUP` labels** | Show in drawer at full size. Off-canvas drawer is full-width on portrait. |
| **Two-rail active indicator** | Drop right-rail (clipped); keep left-border. |
| **HUD row (gauge/sparkline/stats)** | Stack vertically; gauge first (largest), sparkline second, stats third. |
| **Inline column-edit on detail** | Promote to full-form sheet. |
| **Multi-select Shift+Click** | Long-press to enter selection mode (already in v1.3 pattern); checkbox column appears in selection mode. |
| **`/` to focus search, Cmd+K palette, vim-style chords** | Keep on desktop. On mobile, keyboard rarely focused — mobile UX leans on FAB + scan + drawer. |

### Mobile-only additions

| Feature | Why | Source |
|---|---|---|
| **FAB on mobile only** (`md:hidden`) — radial 3-action menu, context-aware | Legacy parity (v1.3) + v2.2 research validated it | v2.2 archive FEATURES.md FA8 |
| **Bottom-nav 3-tab swap-out for sidebar drawer** (Dashboard / Items / Loans) | Optional: native mobile pattern for the most-trafficked routes; sidebar drawer for the rest | OPTIONAL. Check during phase planning. |
| **Pull-to-refresh on lists** | Mobile expectation | Pulls latest TanStack Query cache. |
| **Swipe-to-archive on item rows** | Power-user mobile expectation | OPTIONAL. Shows colored stripe matching archive accent. |
| **iOS PWA safe-area handling** | iOS notch + home indicator | `env(safe-area-inset-bottom)` on Bottombar. |
| **44px minimum touch targets everywhere** | WCAG 2.5.5 AA | Already enforced in v1.3; carry forward. |
| **Visual Viewport API** for keyboard handling | iOS hides fixed elements when keyboard opens | Already in v1.3 codebase. |

### Accessibility / screen-reader strategy

The premium-terminal aesthetic is **visual** — semantic HTML beneath must be standard. Specific guarantees:

- All `[KEY]` chips have `aria-keyshortcuts` attributes mirroring the actual binding.
- Bottombar shortcuts are also rendered as a `<menu>` of `<button role="menuitem">` for AT navigation.
- Status pills carry `role="status"` with text content (the visible text, not the chrome).
- Live SSE dot has `aria-live="polite"` only when state CHANGES; not while merely blinking.
- Scanlines + glow effects use `prefers-reduced-motion` + `prefers-contrast` queries to disable when requested.
- Column-aligned absolute timestamps in tables are screen-reader-friendly because they're real text — no canvas-rendered glyphs.
- Activity table rows expose `<th scope="col">` for headers, `<td>` for cells; no ARIA gymnastics required.
- Modal stack uses `<dialog>` element (HTML5) for focus-trap semantics, not custom focus management.

---

## Feature Dependencies

```
Sketch 005 chrome (locked)
    │
    ├──> AppShell (topbar/sidebar/main/bottombar grid)
    │       │
    │       ├──> useShortcuts hook + ShortcutsContext
    │       │       │
    │       │       ├──> Bottombar render
    │       │       └──> Keyboard dispatcher (keydown listener)
    │       │
    │       ├──> Sidebar (// GROUP labels, collapse-to-rail, user menu footer)
    │       │       │
    │       │       └──> Auth context (for user menu + logout)
    │       │
    │       └──> Topbar (brand + workspace pill + ONLINE dot + user pill)
    │               │
    │               └──> SSE connection state
    │
    ├──> Page-header pattern (// ROUTE + SESSION + LAST SYNC)
    │       │
    │       └──> Session start time + last-sync tracker
    │
    └──> Panel + Pill + Status primitives
            │
            └──> Used by every feature page

Auth surface (legacy parity)
    │
    ├──> Login + Register routes
    └──> OAuth (Google + GitHub) ──> existing backend Redis exchange flow

Items + Item Photos (legacy parity)
    │
    ├──> Items API (exists) ──> List + Detail + Form components
    │       │
    │       └──> uses: Panel, Pill, Activity-table, RetroFormField, RetroSelect, RetroCombobox, RetroFileInput, RetroPagination
    │
    └──> Item-photos pipeline (multipart, asynq worker — backend exists)

Loans (legacy parity)
    │
    ├──> Loans API ──> Tabbed list (Active/Overdue/History)
    └──> integrates with Items detail (per-item loan panels) + Borrowers detail (per-borrower loan panels)

Borrowers (legacy parity)
    │
    └──> Borrowers API ──> CRUD + active-loan guard

Taxonomy (legacy parity)
    │
    ├──> Categories API ──> Hierarchical tree CRUD
    ├──> Locations API ──> Hierarchical tree CRUD
    └──> Containers API (depends on Locations) ──> Grouped CRUD

Scan (legacy v1.3 parity, partial v2.2)
    │
    ├──> @yudiel/react-qr-scanner ──> BarcodeScanner component
    ├──> Web Audio + Vibrate + ios-haptics ──> feedback util
    ├──> localStorage scan-history ──> history tab
    ├──> Items API ?barcode= ──> lookup
    └──> Items create ?barcode= ──> not-found path

Settings hub (legacy parity)
    │
    ├──> Profile + Security + Connected Accounts ──> Auth APIs
    ├──> Appearance ──> theme persist (single theme + maybe HC variant)
    ├──> Language ──> i18n switcher (Lingui)
    ├──> Regional Formats ──> useDateFormat / useTimeFormat / useNumberFormat hooks
    ├──> Notifications ──> JSONB pref endpoint
    └──> Data ──> manual sync + import/export (no offline storage display in v3.0)

Dashboard (sketch 001/005 contract)
    │
    ├──> HUD row
    │       ├──> Capacity gauge SVG ──> NEEDS backend `capacity_target` rollup (DOES NOT EXIST)
    │       ├──> Activity sparkline SVG ──> NEEDS backend `activity-by-day` rollup (DOES NOT EXIST)
    │       └──> 3 stat tiles ──> existing /stats endpoint
    │
    ├──> Activity table ──> NEW endpoint OR adapt from pendingchange/sync-history
    └──> Side rail ──> Pending Approvals + System Alerts (existing endpoints)

Differentiators (TUI-genre)
    │
    ├──> Command Palette (Cmd+K) ──> Fuse.js + command registry derived from useShortcuts
    ├──> Inline edit on detail panels ──> per-field PATCH endpoints
    ├──> Multi-select + bulk operations ──> bulk endpoints (some exist, audit needed)
    ├──> Density toggle ──> localStorage pref (no backend)
    └──> Vim-chord shortcuts (g i, g d) ──> chord state machine (OPTIONAL)

Cross-cutting
    │
    ├──> i18n catalog (en/et/ru) ──> Lingui (continue) — applies to every visible string
    ├──> Format hooks (date/time/number) ──> applies to every formatted value
    └──> SSE consumer ──> notifications, activity dot, last-sync time
```

### Dependency Notes

- **Sketch 005 chrome blocks every feature page** — AppShell + Bottombar + Page-header + Panel primitives must exist before any feature page can render correctly. Build them in Phase 1.
- **`useShortcuts` is single source of truth** — every page using shortcuts depends on it; building it in Phase 1 unlocks all per-page shortcut sets.
- **HUD row depends on backend rollups that don't exist** — either land backend rollups in parallel or feature-flag the HUD row and ship dashboard with stat tiles + activity table only.
- **Items / Loans / Borrowers / Taxonomy depend on retro form primitives** — RetroFormField, RetroSelect, RetroCombobox, RetroFileInput, RetroPagination, RetroConfirmDialog were shipped in v2.1 Phase 57 (lost with wipe). Re-port them in Phase 2 before feature pages.
- **Scan depends on Items list/create routes existing** — depends on Phase 3 (Items) for lookup target and not-found create flow.
- **Command Palette depends on shortcut registry** — must follow `useShortcuts` foundation in Phase 1.
- **Activity-table style is reused across Items list, Loans list, Borrowers list, Activity feed, Approvals, Sync history, Sessions** — single component variant covers all.
- **i18n affects every page** — wire Lingui in Phase 1; backfill catalogs as features land. Et/ru catalogs from legacy can be lifted (already translated).
- **Format hooks affect every page** — wire in Phase 1; CI grep guard prevents `Date.toLocaleString` calls outside hooks.

---

## MVP Definition

### Launch With (v3.0 MVP)

This is the "premium-terminal frontend ships and replaces v2.1 wholesale" line. Below this, the rebuild is incomplete relative to legacy parity OR aesthetic contract.

**Phase 1 — Shell:**
- [ ] AppShell grid (topbar/sidebar/main/bottombar)
- [ ] Topbar (brand + workspace + ONLINE + user pill)
- [ ] Sidebar with `// GROUP` labels + collapse-to-rail + user menu footer
- [ ] Function-key Bottombar + `useShortcuts` hook + globals (F1, ESC)
- [ ] Page-header pattern (route breadcrumb + SESSION + LAST SYNC)
- [ ] Panel + Pill + Live-dot + Button + Activity-table primitives
- [ ] Lingui i18n + format hooks wired
- [ ] Auth (login/register/logout/OAuth)

**Phase 2 — Form primitives:**
- [ ] RetroFormField, RetroSelect, RetroCombobox, RetroTextarea, RetroCheckbox, RetroFileInput
- [ ] RetroPagination, RetroConfirmDialog, RetroEmptyState
- [ ] (Re-port from v2.1 Phase 57)

**Phase 3 — Inventory core:**
- [ ] Items list (paginated, search, filter, sort, archived)
- [ ] Item detail
- [ ] Item create / edit / archive / delete
- [ ] Item photos (upload, gallery, primary)

**Phase 4 — Lending:**
- [ ] Loans tabs (Active/Overdue/History)
- [ ] Loan create / edit / mark returned
- [ ] Per-item + per-borrower loan panels
- [ ] Borrowers list + CRUD with active-loan guard
- [ ] Borrower detail with loan panels

**Phase 5 — Taxonomy:**
- [ ] Categories tree CRUD
- [ ] Locations tree CRUD
- [ ] Containers grouped CRUD

**Phase 6 — Scan:**
- [ ] Single-route /scan
- [ ] BarcodeScanner with torch + manual fallback
- [ ] Audio + haptic + visual feedback
- [ ] Scan history (last 10 localStorage)
- [ ] Quick-action overlay (View / Loan / Edit)
- [ ] Not-found → create with prefilled barcode

**Phase 7 — Settings hub:**
- [ ] Hub landing
- [ ] Profile, Security (incl. connected accounts), Language, Regional Formats, Notifications, Data, Appearance
- [ ] Sessions list + revoke
- [ ] Account deletion

**Phase 8 — Dashboard:**
- [ ] Stat tiles
- [ ] Activity table (last 10)
- [ ] Pending Approvals + System Alerts side rail
- [ ] HUD gauge + sparkline (FEATURE-FLAGGED until backend rollups land)

**Phase 9 — System (`// SYSTEM` group):**
- [ ] Approvals page
- [ ] My Changes
- [ ] Sync History
- [ ] Imports / Exports

### Add After Validation (v3.1)

Trigger: v3.0 lands and gets used. Add what observed friction reveals.

- [ ] Quick capture flow port (online-only camera-first capture loop) — ship if usage data shows item-create volume warrants it
- [ ] Command palette (Cmd+K) — ship if discoverability complaints surface
- [ ] Vim-chord shortcuts (g i, g d) — ship if Bottombar shortcuts feel insufficient
- [ ] Multi-select bulk operations across all entity lists — ship after v3.0 lands and a primary use case emerges
- [ ] Inline edit on detail panels — ship if "click → form route → save → back" feels heavy
- [ ] Density toggle (compact/comfortable) on tables — ship if dense-operator feedback comes in
- [ ] Drag-and-drop reorder on category/location trees — ship if keyboard reorder isn't enough
- [ ] Repair log tracking — port from legacy if user demand returns
- [ ] Declutter assistant — port from legacy if user demand returns
- [ ] HUD gauge + sparkline backend rollups (then unflag the panels)
- [ ] Mobile FAB radial menu polish (or replace with bottom-nav swap-out)

### Future Consideration (v4+)

Trigger: product-market fit established, reasons documented per requirement.

- [ ] Offline mutations / IndexedDB / Serwist (only if usage data shows real offline trips)
- [ ] Cross-device scan history sync
- [ ] High-contrast retro theme variant (only if a11y testing surfaces a need)
- [ ] Multi-workspace tab UI (only if multi-workspace adoption climbs)
- [ ] AR / NFC / hardware scanner integrations (out-of-scope per PROJECT.md unless that changes)

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---|---|---|---|
| AppShell + Bottombar + useShortcuts | HIGH (everything depends on it + brand-defining) | MEDIUM | **P1** |
| Items CRUD + photos | HIGH (core domain) | MEDIUM | **P1** |
| Loans tabs + flow | HIGH (core domain) | MEDIUM | **P1** |
| Borrowers CRUD | HIGH (loans dependency) | LOW | **P1** |
| Taxonomy trees | HIGH (items dependency) | MEDIUM | **P1** |
| Auth + OAuth | HIGH (everything depends on it) | LOW (port) | **P1** |
| Scan single-route + lookup + history | HIGH (warehouse signature workflow) | MEDIUM | **P1** |
| Settings hub (all 8 subpages) | HIGH (regulatory: account deletion + security; UX: regional formats) | MEDIUM | **P1** |
| Dashboard activity table + side rail | HIGH (landing surface) | LOW | **P1** |
| Dashboard HUD gauge + sparkline | MEDIUM (visual polish; data may not exist) | MEDIUM | **P2** (feature-flag until backend rollups) |
| `// SYSTEM` group (Approvals/MyChanges/SyncHistory/Imports) | MEDIUM (audit + power-user) | MEDIUM | **P1** (legacy parity) |
| Command palette (Cmd+K) | MEDIUM (power-user; not table-stakes for warehouse) | MEDIUM | **P2** |
| Multi-select + bulk operations | MEDIUM (operator efficiency) | MEDIUM | **P2** |
| Inline edit on detail | MEDIUM (efficiency) | MEDIUM | **P2** |
| Density toggle | LOW (nice-to-have) | LOW | **P3** |
| Vim chord shortcuts | LOW (niche power-user) | MEDIUM | **P3** |
| Quick-capture port | MEDIUM (legacy parity but online-only is degraded) | HIGH | **P2** (separate phase) |
| Repair log + Declutter | LOW (legacy features rarely used; both v1.2 era) | HIGH | **P3** |
| Mobile FAB radial | MEDIUM (mobile workflow) | MEDIUM | **P2** (mobile fallback phase) |
| Pull-to-refresh / swipe-to-archive | LOW (mobile polish) | LOW | **P3** |
| Drag-and-drop tree reorder | LOW (keyboard reorder substitutes) | MEDIUM | **P3** |

**Priority key:**
- P1: Must have for v3.0 launch
- P2: Should have, add when phase scope allows OR v3.1
- P3: Nice to have, future consideration

---

## TUI-Influenced Web App References

Conventions cited above are sourced from:

- **k9s** (Kubernetes terminal UI): `?` for help, single-letter shortcuts (a-z, Shift+A-Z, Ctrl+A-Z), `:resource` for navigation, modeless. Source: [k9scli.io/topics/hotkeys](https://k9scli.io/topics/hotkeys/), [GitHub derailed/k9s issue #2793](https://github.com/derailed/k9s/issues/2793) (~78 shortcut slots conventional).
- **lazygit**: Single-letter shortcuts, `?` for context-help (different on each panel), Tab-cycle between panels, ESC pop-stack, modeless.
- **Midnight Commander (mc)**: `F1`–`F10` function keys are the load-bearing pattern (Help/Menu/View/Edit/Copy/Move/Mkdir/Delete/PullDn/Quit). The function-key bar at bottom is THE genre signature — sketch 005's bottombar is a direct lineage.
- **htop / btop**: Bottom-row function keys with `[KEY] LABEL` chip pattern. F1 HELP universal. F10 QUIT universal.
- **vim** (only when actually editing): Modal — but vim-style chords (`g g`, `d d`) are usable in modeless apps as long as letter keys are otherwise free (i.e., no input has focus).
- **GitHub Actions CLI / Linear desktop / Vercel CLI**: Cmd+K command palette is the modern bridge between TUI shortcuts and modern web — it's table-stakes for power-user productivity tools. Source: ubiquitous; Linear and Notion popularized it.
- **Bloomberg Terminal**: Per-route function-key sets, status bar with system-wide state — direct ancestor of sketch 005's page-header SESSION+LAST SYNC line.

**Web data-table conventions** (relative vs absolute timestamps): UX Movement — relative for fresh content, absolute for archival. Combined with monospace-tabular-nums right-alignment per Pencil & Paper / Justinmind data-table best practices.

---

## Sources

- `.planning/PROJECT.md` (v3.0 milestone definition + legacy feature inventory across v1.x–v2.1) — HIGH
- `.planning/MILESTONES.md` (full feature catalog by version) — HIGH
- `.planning/research/v2.2-archive/FEATURES.md` (predecessor scanning feature research, v2.2) — HIGH
- `.planning/research/v2.2-archive/FEATURES_MOBILE_UX.md` (v1.3 mobile UX research) — HIGH
- `.planning/RETRO-THEME-ROLLOUT.md` (frontend1 re-skin plan; defines the bottombar contract) — HIGH
- `.claude/skills/sketch-findings-home-warehouse-system/SKILL.md` (sketch findings index) — HIGH
- `.claude/skills/sketch-findings-home-warehouse-system/references/components.md` (panel/pill/button/qa/alert/table/gauge/sparkline/user-menu) — HIGH
- `.claude/skills/sketch-findings-home-warehouse-system/references/layout.md` (grid + bottombar + sidebar groups + HUD ratio) — HIGH
- `.claude/skills/sketch-findings-home-warehouse-system/references/typography.md` (scale + casing + glow rules) — HIGH
- [k9scli.io hotkeys](https://k9scli.io/topics/hotkeys/) — MEDIUM (TUI-genre keyboard convention reference)
- [k9s plugin shortcut limits (GitHub #2793)](https://github.com/derailed/k9s/issues/2793) — MEDIUM
- [UX Movement — Absolute vs Relative Timestamps](https://uxmovement.com/content/absolute-vs-relative-timestamps-when-to-use-which/) — MEDIUM
- [Pencil & Paper — Enterprise Data Tables](https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-data-tables) — MEDIUM
- [Justinmind — Data Table Design](https://www.justinmind.com/ui-design/data-table) — MEDIUM

---
*Feature research for: v3.0 Premium-Terminal Frontend rebuild of /frontend2*
*Researched: 2026-04-30*
