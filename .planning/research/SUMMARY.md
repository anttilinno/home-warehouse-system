# Project Research Summary

**Project:** v3.0 Premium-Terminal Frontend (`/frontend2` rebuild)
**Domain:** SPA rebuild — premium-terminal TUI aesthetic (sketch 005 fidelity), online-only multi-tenant inventory, full feature parity with legacy `/frontend`.
**Researched:** 2026-04-30
**Confidence:** HIGH on stack + parity contract; MEDIUM on dashboard backend coverage and i18n migration mechanics; LOW on whether mobile FAB belongs in v3.0.

## Executive Summary

This is a **clean-slate rebuild of `/frontend2`** after v2.0/v2.1/v2.2 was wiped. It is NOT greenfield: backend, API contract, and the legacy `/frontend` (Next.js) are stable and untouched, and the v2.1 architectural shape (Vite + React 19 + Tailwind 4 + RR7 library mode + TanStack Query + cookie-JWT auth + workspace-scoped REST + `features/*` folders) shipped successfully and is the validated baseline. The new mandate is **sketch 005 aesthetic fidelity** — slim brand topbar, sidebar `// GROUP` labels, function-key bottombar, page-header `SESSION ... // LAST SYNC` meta, panel bevels + scanlines + monospace + sharp corners — grafted onto that proven shape. The four research tracks converge: **keep the v2.1 spine, add layout primitives that drive what atoms need, and make every aesthetic phase carry a paired parity gate.**

The recommended approach is to **build layout primitives BEFORE retro atoms** (predecessor's reverse order forced atom rebuilds twice), to **ship the function-key shortcut model from Phase 1 with input-focus guard built-in** (every form is otherwise a landmine), and to **adopt the Phase 65 Plan 65-11 testing pattern from Day 1** — every flow that crosses the HTTP boundary gets at least one real-backend test (Playwright + tagged Go integration), not as gap-closure later. Online-only is CI-enforced via the existing `scripts/check-forbidden-imports.mjs` grep guard against `idb`/`serwist`/`offline`/`sync`.

The dominant risks are well-known from predecessor history. **Aesthetic theatre overriding parity** — v2.0 shipped 33/33 requirements but `LAY-01` was satisfied with a 2-item sidebar; v2.1 hit parity but never matched sketch 005. **Function-key bottombar swallowing input keystrokes**, **mock-only tests hiding contract drift** (G-65-01 precedent), and **i18n migration silently dropping et/ru keys** are the next-tier landmines. Three open conflicts surfaced by the parallel researchers must be resolved early — **i18n library** (STACK says Lingui v6 / ARCHITECTURE says drop Lingui for react-intl), **mobile FAB scope** (legacy parity vs bottombar-replaces-FAB), and **dashboard backend rollups** (`capacity_target` + `/activity` may not exist) — see Conflict Resolution below. Each is a Phase 1 decision spike, not a paper-over.

## Key Findings

### Recommended Stack

The v2.1 baseline survives intact, version-bumped to current registry stable. No fight-the-aesthetic libraries (shadcn/Material/Mantine/motion/framer-motion/chart libs) anywhere. Three TUI-pattern additions: **sonner** (toast stack management), **cmdk** (command palette F2/Ctrl+K), **tinykeys** (global shortcut registry). Self-host **JetBrains Mono Variable** (typography is load-bearing for a TUI).

**Core technologies:**
- **Vite 8 + React 19 + TypeScript 5.9** — proven SPA baseline; SWC compiler keeps i18n compile-pass viable
- **Tailwind CSS 4 + `@tailwindcss/vite`** — `@theme` block fits locked tokens
- **React Router 7 (library mode)** — declarative `<Routes>`; framework mode rejected (revalidates per nav, conflicts with TanStack Query, no SSR benefit)
- **TanStack Query 5** — server state + caching; the only persistence layer (CI grep guard enforces this)
- **react-hook-form 7 + zod 4 + `@hookform/resolvers` 5** — proven form stack
- **`@yudiel/react-qr-scanner` 2.5.1 (EXACT pin)** — React 19 peer-dep clean; built-in torch
- **`@floating-ui/react` 0.27** — positioning math without imposed chrome
- **lucide-react** — confirmed by sketch 004
- **sonner / cmdk / tinykeys** — TUI pattern additions
- **`@fontsource-variable/jetbrains-mono`** (latin + latin-ext for Estonian)
- **Vitest 4 + Playwright 1.59 + msw 2** — unit/component + E2E + fetch interception
- **i18n library — UNRESOLVED** (see Conflict Resolution)

### Expected Features

**Must have (table stakes / locked by sketches):**
- AppShell chrome (slim topbar, sidebar with `// OVERVIEW`/`// INVENTORY`/`// SYSTEM` + collapse-to-rail + user menu, function-key Bottombar, page-header `// ROUTE` + SESSION + LAST SYNC, panels + pills + live-dot + activity-table primitives, scanlines + monospace + sharp corners)
- Auth (email/password + Google OAuth + GitHub OAuth PKCE, sessions, account deletion, password change, connected accounts)
- Items (paginated list, detail with photos, full CRUD, archive, multipart photo upload)
- Loans (Active/Overdue/History tabs, create/edit/return, per-item + per-borrower panels)
- Borrowers (CRUD with active-loan guard, detail with loan panels)
- Taxonomy (categories tree, locations tree, containers grouped, archive/delete with usage warnings)
- Scan (single-route, QR + UPC/EAN/Code128, torch, manual fallback, pause-on-match, audio+haptic+visual feedback, last-10 history, quick-action overlay, "not found → create")
- Settings (hub + 8 subpages: Profile, Security, Appearance, Language, Regional Formats, Notifications, Connected Accounts, Data Storage)
- Dashboard (stat tiles, activity table, alerts/approvals side rail)
- i18n (en/et/ru parity; Regional Formats hooks used everywhere)
- `// SYSTEM` group (Approvals, My Changes, Sync History, Imports/Exports)

**Should have (TUI-genre differentiators):**
- `useShortcuts(page)` single source of truth (Bottombar render AND keydown dispatch)
- Per-route shortcut sets (Dashboard N/S/L/Q; Approvals A/R/D; Items N// /F; Loans N/R)
- Modal-stack ESC behavior (pop topmost overlay first)
- Live SSE state in panel headers (`sse: ● live`)
- Status pills (OK/WARN/INFO/DANGER), monospace tabular-nums on numeric columns
- Activity-feed timestamps (relative <24h, absolute >24h)
- Command palette (Cmd+K / F2) via cmdk
- Multi-select via Shift+Click + bulk operations dispatched via Bottombar

**Defer (v3.1+):**
- HUD gauge + sparkline (feature-flag if backend rollups absent — Conflict 3)
- Quick capture flow port (heavy; defer to data-driven trigger)
- Inline edit on detail panels, density toggle, vim-chord shortcuts
- Drag-and-drop tree reorder (keyboard reorder substitutes)
- Repair log + Declutter assistant (legacy v1.2 era)
- Mobile FAB (Conflict 2 — recommend dropping)

**Anti-features (explicitly rejected):**
- Animation libraries (motion/framer-motion) — fight 80ms CSS transitions
- shadcn/Material/Mantine/Chakra — drop-shadows + rounded corners fight locked theme
- IndexedDB/Serwist/PWA service workers — online-only is CI-enforced
- Fuse.js — server-side FTS covers the case; cmdk has its own filter
- Charting libs (Recharts/Chart.js/Tremor) — hand-rolled SVG (~30 LOC each)
- Multi-theme picker / per-user palette editor — theme IS the product
- Vim-modal editing / Ex-mode `:command` / multiplexed panes — TUI patterns that don't fit warehouse
- Skeleton shimmer / Lottie / spring physics

### Architecture Approach

The v2.1 spine is preserved verbatim: provider stack (`IntlProvider > QueryClientProvider > AuthProvider > SSEProvider > ToastProvider > ShortcutsProvider > BrowserRouter`), CSS-Grid app shell with `grid-template-areas` (single `data-collapsed` attribute toggle for sidebar collapse — no JS layout), TanStack Query + cookie-JWT auth + per-entity API modules in `lib/api/`, feature folders under `features/*` composing `components/retro/*` atoms. New: `components/layout/` owns chrome (TopBar, Sidebar, Bottombar, PageHeader, ShortcutsProvider, ShortcutChip) and depends on retro atoms but never the reverse. `lib/sse/` exposes `useSSEStatus()` for both topbar ONLINE indicator and page-header LAST SYNC meta.

**Major components:**
1. **AppShell** — owns 2×3 CSS grid + mounts TopBar/Sidebar/Bottombar + renders `<Outlet />`
2. **ShortcutsProvider + `useShortcuts(id, [...])`** — register-by-id Context (PORT VERBATIM from `/frontend`); SSOT for Bottombar render and keyboard dispatch
3. **SSEContext + `useSSEStatus()` selector** — single EventSource, subscribe API, JWT in URL query param
4. **AuthContext + RequireAuth** — cookie-JWT (`credentials: "include"`), workspaceId SSOT, single-flight 401 refresh in `lib/api.ts`
5. **Retro atoms (`components/retro/*`)** — Panel, Button, Badge, Input, FormField, Select, Combobox, Textarea, Checkbox, FileInput, Table, Tabs, Dialog, ConfirmDialog, Toast (sonner-skinned), EmptyState, Pagination, StatusDot, HUD primitives
6. **Feature modules (`features/*`)** — auth/dashboard/items/loans/borrowers/taxonomy/scan/settings; pages + hooks (TanStack Query gated on `!!workspaceId`) + forms
7. **`lib/api/`** — one file per backend resource segment; each exports `<entity>Api` + `<entity>Keys` factory

### Critical Pitfalls

1. **Aesthetic theatre overrides parity** — v2.0 precedent (33/33 met but 2-of-4 sidebar). Prevention: every aesthetic phase has a paired parity gate; DoD = parity AND aesthetic.
2. **Function-key bottombar swallows input keystrokes** — typing 'n' in search navigates to `/items/new`. Prevention: `isEditableTarget(e.target)` guard from Day 1; F-keys + Escape are universal exceptions; CI keystroke test on every form.
3. **Mock-based tests hide contract drift** — exact G-65-01 precedent. Prevention: every cross-HTTP flow gets one real-backend test (Playwright + tagged Go integration per Phase 65 Plan 65-11).
4. **Workspace-scoping regression on lookup endpoints** — barcodes globally unique, cross-tenant collisions guaranteed. Prevention: every helper preserves `WHERE workspace_id = $1 AND ... = $2`; integration test with two workspaces.
5. **i18n migration silently drops et/ru keys** — v2.0 + v1.8 precedent. Prevention: extract→merge→diff manifest CI guard; et/ru ship in lockstep with en.

Honorable mentions: scanlines + low contrast fail WCAG (cap overlay at 5%, honor `prefers-contrast: more`); Cyrillic monospace metrics drift columns (verify JetBrains Mono Cyrillic, use `min-width: NNpx` not `ch`); SSE reconnect storm during deploy (exponential backoff with jitter); mobile bottombar overflow hides F1/ESC; cookie-JWT regresses to localStorage Bearer in fresh rebuild (auth is NOT redesigned, only chrome).

## Conflict Resolution

### Conflict 1: i18n library — Lingui v6 vs react-intl (FormatJS)

- **STACK.md** recommends Lingui v6: predecessor catalog continuity, ~3KB runtime tree-shake, muscle memory.
- **ARCHITECTURE.md** recommends react-intl: Vite 8's pure-Rolldown pipeline conflicts with Lingui's SWC plugin.
- **PITFALLS.md** flags as Pitfall 9 (Phase 1 critical — silent et/ru key drops).

**Recommendation: defer to Phase 0/1 decision spike.** The decisive question is empirical: does Lingui v6 + `@lingui/swc-plugin@^6` actually run cleanly under Vite 8.0.10 + `@vitejs/plugin-react-swc@^4.3` today? **The migration mechanics matter more than the library choice** — whichever wins, the extract→merge→diff manifest CI guard is mandatory. Recommendation if no friction: **Lingui v6**. If friction: **react-intl**. Document in `.planning/research/I18N-DECISION.md`.

### Conflict 2: Mobile FAB scope

- **FEATURES.md** lists FAB under "Mobile Fallback Strategy" (legacy v1.3 + v2.2 parity).
- **PITFALLS.md** Pitfall 27 questions whether FAB belongs once Bottombar exists.
- **PROJECT.md** v3.0 target list does NOT include FAB.

**Recommendation: drop FAB from v3.0; Bottombar replaces it.** Predecessor `/frontend`'s FAB existed because it had no Bottombar; v3.0 has one. Pitfall 27 collision (FAB stacks above Bottombar; layout/safe-area math complex). Bottombar's per-route shortcuts + cmdk command palette covers mobile primary-action use case. Document in v3.0 scope: every former FAB action gets a Bottombar equivalent. Re-add FAB in v3.1 only if mobile usage data shows insufficiency.

### Conflict 3: Dashboard backend rollups (`capacity_target`, `/api/.../activity`)

- **FEATURES.md** notes both rollup endpoints "may not exist."
- **ARCHITECTURE.md** Phase 13: "verify backend; if not present, defer dashboard to v3.1."
- Backend coordination dependency, not frontend-only.

**Recommendation: ship Dashboard in v3.0 with HUD gauge + sparkline FEATURE-FLAGGED.** Phase 12 ships activity table (port from `pendingchange`/`syncHistory` audit log) + side rail (existing endpoints) + 3 stat tiles (existing `/stats`) immediately. HUD row gated behind `VITE_FEATURE_HUD_ROLLUPS` flag (default off); backend team adds `capacity_target` + `/api/workspaces/{ws}/activity?days=14` in parallel; flag flips on when backend ships. Unblocks v3.0 launch.

## Implications for Roadmap

Reconciled canonical proposal uses ARCHITECTURE.md's 15-phase spine (made layout-before-atoms lesson explicit) plus Phase 0 carry-forward audit (Pitfall 24 prevention).

### Phase 0: Carry-Forward Audit + Scaffold
**Rationale:** Explicitly enumerate what carries forward (cookie auth, OAuth callback, Playwright auth helper, format hooks, grep guard) vs what's replaced (component library, layout chrome). Document in `.planning/research/CARRY-FORWARD.md`.
**Delivers:** Vite + React 19 + TS + Tailwind 4 + RR7 + ESLint + Vitest + Playwright scaffold; CI grep guard ported; provider skeleton; **i18n spike + decision** (Conflict 1); **FAB scope decision** (Conflict 2); **dashboard backend coordination kickoff** (Conflict 3).
**Avoids:** Pitfall 24 (wipe-and-rebuild psychology), Pitfall 17 (online-only regression).

### Phase 1: Tokens + Tailwind Theme
**Rationale:** Tokens precede chrome precede atoms.
**Delivers:** `styles/tokens.css` from sketch 005 `themes/default.css`; `tailwind.config.ts` with `@theme`; `styles/globals.css` (resets + monospace + scanline overlay); JetBrains Mono Variable self-hosted; contrast audit script.
**Avoids:** Pitfall 7 (low contrast), Pitfall 5 (Cyrillic glyph metrics — typography spike).

### Phase 2: Layout Primitives (THE GRID + CHROME)
**Rationale:** Layout reveals atom constraints. Function-key Bottombar is the *defining* UX pattern — get it right Day 1.
**Delivers:** AppShell (2×3 grid + collapse attribute); TopBar (brand + workspace pill + ONLINE dot placeholder); Sidebar (`// GROUP` labels + nav + collapse-to-rail + user menu footer); Bottombar with hardcoded chips + SESSION/LOCAL clocks **AND `isEditableTarget` input-focus guard from first commit**; PageHeader; ShortcutChip (real `<button>` + `aria-keyshortcuts` + `aria-label`); mobile breakpoint contract (sidebar drawer at <768px, Bottombar overflow plan with F1+ESC right-anchored).
**Avoids:** Pitfalls 2 (input-keystroke swallow), 3 (Escape conflicts — confirm dialog before logout), 4 (Bottombar a11y), 25-28 (mobile patterns).

### Phase 3: Retro Atoms (informed by Phase 2 constraints)
**Rationale:** Atoms now know what shapes they need to take.
**Delivers:** ~19 atoms — RetroPanel (with `// HEADER` slot), RetroButton (default + danger + key-chip), RetroBadge (with dot-mode for collapsed sidebar), RetroInput, RetroSelect, RetroCombobox, RetroTextarea, RetroCheckbox, RetroFileInput, RetroFormField, RetroTable family, RetroTabs, RetroDialog, RetroConfirmDialog, RetroToast (sonner-skinned), RetroEmptyState, RetroPagination, RetroStatusDot, RetroHUD primitives (gauge SVG + sparkline SVG + counts).
**Avoids:** Pitfalls 12 (animating bevels), 15 (focus-visible vs glow), 13 (chart libs).

### Phase 4: Auth (login + OAuth + RequireAuth)
**Rationale:** Auth is a port, not a redesign.
**Delivers:** `lib/api.ts` (fetch + 401 refresh + HttpError + postMultipart); AuthContext + RequireAuth (with v2.0 spurious-logout-on-network-error bug fixed); LoginPage, RegisterPage, AuthCallbackPage; OAuth (Google + GitHub) buttons.
**Avoids:** Pitfall 10 (cookie/storage drift). E2E spec from Phase 65 Plan 65-11 pattern.

### Phase 5: Providers (SSE + Shortcuts + Toast + Intl)
**Rationale:** ARCHITECTURE.md "pinch point" — bundle them so chrome wires to real state once.
**Delivers:** SSEContext (PORT + `useSSEStatus` selector); ShortcutsProvider (PORT VERBATIM); IntlProvider (Lingui v6 OR react-intl per Conflict 1); Topbar ONLINE dot binds to `useSSEStatus().connected`; Bottombar reads from ShortcutsContext; PageHeader LAST SYNC binds to `useSSEStatus().lastEventAt`.
**Avoids:** Pitfalls 18, 30, 31, 32 (SSE patterns).

### Phase 6: Items (CRUD + Photos)
**Rationale:** Largest single entity; activity-table style reused across all later list views.
**Delivers:** `lib/api/items.ts` + `itemPhotos.ts` with `itemKeys` factory; useItemsList/useItem/useItemMutations; ItemsListPage (RetroTable + RetroPagination + URL search params); ItemDetailPage; ItemForm (rhf + zod); photo upload (multipart, JPEG/PNG/HEIC, client-resize, 10MB); `itemsApi.lookupByBarcode` helper (forward-compat with scan); `useShortcuts("items", [...])`.
**Avoids:** Pitfall 5 (workspace-scoping on `lookupByBarcode`).

### Phase 7: Loans
**Delivers:** `lib/api/loans.ts` + `borrowers.ts`; LoansListPage with RetroTabs (Active/Overdue/History); LoanForm + LoanReturnDialog; per-item + per-borrower loan panels; `?itemId=` URL param to preselect.

### Phase 8: Borrowers
**Delivers:** BorrowersListPage; BorrowerDetailPage with active + historical loan panels; CRUD with active-loan guard.

### Phase 9: Taxonomy
**Delivers:** TaxonomyPage with three sub-sections (categories tree, locations tree, containers grouped); hierarchical CRUD; expand/collapse persisted to sessionStorage.

### Phase 10: Scan (single-route)
**Delivers:** `/scan` with `<BarcodeScanner>` mounted once + UI overlays on top (NEVER navigate); QR + UPC/EAN/Code128; pause-on-match (prop-driven, NOT unmount); torch toggle; manual fallback; AudioContext oscillator + ios-haptics + visual feedback; scan history (last 10 localStorage); quick-action overlay; not-found → create with `?barcode=`.
**Avoids:** Pitfall 20 (SSE owned by AppShell, not page).

### Phase 11: Settings hub
**Delivers:** SettingsLandingPage (iOS-style rows); 8 subpages; format hooks ported from v1.6; sessions list + revoke; account deletion (type-to-confirm); password change (OAuth-only path per v1.8).
**Note:** Data & Storage subpage shrinks for online-only (clear cached query data + export workspace + import workspace only).

### Phase 12: Dashboard
**Rationale:** Composes most other features — building late means stub data isn't needed.
**Delivers:** Stat tiles (existing `/stats`); Activity table (port from `pendingchange`/`syncHistory`); side rail (existing approvals + alerts); HUD gauge + sparkline behind `VITE_FEATURE_HUD_ROLLUPS` flag (Conflict 3).

### Phase 13: System group (`// SYSTEM`)
**Delivers:** Approvals page; My Changes; Sync History; Imports/Exports — all activity-table style with bulk operations dispatched via Bottombar.

### Phase 14: i18n catalog gap-fill (et + ru)
**Delivers:** Extract en messages; translate to et + ru (lift from legacy `/frontend` next-intl + v2.1 Lingui archive); locale switcher in Settings → Language. Extract→merge→diff CI guard runs from Phase 0 onwards.
**Avoids:** Pitfall 9.

### Phase 15: Polish
**Delivers:** Tab/keyboard navigation audit; loading bar on route transitions; accessibility pass (axe-playwright CI, focus-visible audit, touch-target audit); final visual diff vs sketch 005 PNG; mobile breakpoint matrix re-tested (320/360/768/1024/1440); bundle-size CI guard.

### Phase Ordering Rationale

- **Layout primitives BEFORE retro atoms** — predecessor's reverse order forced atom rebuilds twice
- **Providers (Phase 5) bundled together** — predecessor's per-feature trickle produced inconsistent SSE patterns
- **Auth before data features but after layout** — chrome shows placeholders until Phase 4
- **Items before Loans** — Loans need item picker; forward-compat for scan flow
- **Borrowers between Loans and Taxonomy** — Loans surface borrower picker first
- **Scan after Items** — needs `lookupByBarcode` and items create form
- **Dashboard LATE** — composes most features
- **i18n catalog gap-fill late** — wire IntlProvider in Phase 5, backfill et/ru in Phase 14; CI manifest guard runs from Phase 0

### Research Flags

Phases likely needing deeper research (`/gsd-research-phase` recommended):
- **Phase 1:** Tailwind v4 + Vite 8 + React 19 compat; contrast audit; Cyrillic monospace metrics
- **Phase 2:** Sketch 005 grid CSS port; mobile breakpoint contract; ShortcutsProvider port; `isEditableTarget` guard
- **Phase 5:** SSE provider port; i18n spike resolution
- **Phase 10:** iOS PWA camera permission persistence; SSE-AppShell ownership
- **Phase 12:** Backend coordination — does `capacity_target` + `/activity` exist?
- **Phase 14:** Extract→merge→diff manifest mechanics; et/ru catalog conversion

Phases with standard patterns (skip research-phase):
- **Phase 4 (Auth):** Pure port; existing Playwright auth helper documented
- **Phases 6/7/8/9:** Established CRUD with retro atoms; v2.1 lineage solid
- **Phase 11 (Settings):** v1.5 + v1.7 + v1.8 architecture documented
- **Phase 13 (System group):** Activity-table reuse from Phase 6

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Every version registry-verified 2026-04-30; predecessor v2.1 baseline shipped; TUI additions all mature. |
| Features | HIGH (parity) / MEDIUM (TUI-on-web) | Legacy `/frontend` ships every parity feature; sketch 005 contract locked. TUI-genre keyboard model verified vs k9s/lazygit/htop/mc; mouse+touch web adaptation is judgment-driven. |
| Architecture | HIGH | Verified against live frontend1, sketch 005 source HTML, predecessor v2.1, backend API surface. CSS-Grid + register-by-id ShortcutsProvider + cookie-JWT + TanStack Query all proven. |
| Pitfalls | HIGH | Grounded in v1.4/v2.0/v2.1 audits + v1.9/v2.2 retros + sketch 005 anti-patterns + saved memory `feedback_reskin_not_redesign.md`. 32 pitfalls; TOP 7 tied to predecessor failure modes. |

**Overall confidence:** HIGH on the spine; MEDIUM on three open decisions (Conflicts 1/2/3) that Phase 0/1 must resolve.

### Gaps to Address

- **i18n library decision** — Phase 0 spike with documented criterion; output `.planning/research/I18N-DECISION.md`
- **Mobile FAB scope** — Phase 0 explicit decision in v3.0 milestone scope (recommend drop)
- **Dashboard backend rollups** — Phase 0 backend coordination kickoff (recommend ship with flag)
- **Sketch 005 → mobile fidelity** — Phase 2 establishes 3 breakpoints; Phase 15 re-tests at 5 widths
- **Tailwind v4 + React 19 + Vite 8 edge cases** — pin specific versions in Phase 0; budget time in Phase 1
- **Cyrillic + Estonian glyph metrics in JetBrains Mono** — verify in Phase 1; fall back to IBM Plex Mono if drift
- **Quick capture flow scope** — explicitly defer to v3.1 in PROJECT.md; trigger = data shows item-create volume warrants it

## Sources

### Primary (HIGH confidence)
- `.planning/PROJECT.md`, `.planning/MILESTONES.md`
- `.planning/research/{STACK,FEATURES,ARCHITECTURE,PITFALLS}.md`
- `.planning/research/v2.2-archive/{STACK,SUMMARY,FEATURES,FEATURES_MOBILE_UX}.md`
- `.planning/RETRO-THEME-ROLLOUT.md`
- `.claude/skills/sketch-findings-home-warehouse-system/SKILL.md` + `references/{components,layout,typography}.md` + `sources/themes/default.css` + `sources/005-interactive-nav/index.html`
- `frontend/components/layout/{bottombar,shortcuts-context}.tsx`, `frontend/lib/contexts/sse-context.tsx`
- `backend/internal/api/router.go`
- `CLAUDE.md` (Phase 65 Plan 65-11 testing pattern)
- npm registry verification (2026-04-30)

### Secondary (MEDIUM confidence)
- React Router v7 docs; LogRocket "Choosing the right React Router v7 mode"
- TanStack Query v5 + react-hook-form 7 + zod 4 + FormatJS / react-intl docs
- Tailwind CSS v4 `@theme` directive docs
- k9scli.io hotkeys, k9s issue #2793 (TUI-genre keyboard convention reference)
- UX Movement, Pencil & Paper, Justinmind (data-table + timestamp UX)

### Tertiary (LOW confidence — flagged for validation)
- Tailwind v4 + Vite 8 + React 19 compat — pin + verify Phase 0
- react-intl bundle size estimate (~30 KB gzipped) — verify with `vite build --analyze` Phase 5
- Lingui v6 + `@lingui/swc-plugin@^6` + Vite 8 SWC pipeline — Phase 0 spike (Conflict 1)
- Backend `capacity_target` + `/activity` rollup endpoint existence — Phase 0 backend coordination (Conflict 3)

---
*Research completed: 2026-04-30*
*Ready for roadmap: yes — pending Phase 0 resolution of three documented conflicts (i18n library / FAB scope / dashboard backend rollups)*
