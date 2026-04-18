# v2.2 Scanning & Stabilization — Research Summary

**Project:** Home Warehouse System — `/frontend2` (Vite 8 + React 19 + Tailwind 4 + React Router v7, online-only, retro aesthetic)
**Milestone:** v2.2 Scanning & Stabilization
**Researched:** 2026-04-18
**Overall confidence:** HIGH

---

## TL;DR

- **v2.2 ports the shipped v1.3 scanning + FAB UX into `/frontend2`**, wires it into Loans + Quick Capture, and closes accumulated verification / coverage / hygiene debt from v1.9–v2.1 on a parallel track. Nothing is greenfield: the legacy `/frontend` is the reference implementation and is already in the tree.
- **Three new dependencies, tiny footprint:** `@yudiel/react-qr-scanner@2.5.1` (pinned), `ios-haptics@^0.1.4`, `uuid@^13.0.0`. No `motion`, no `lucide-react`, no `idb`. Scanner WASM must be manual-chunked so users who never open `/scan` don't pay for it.
- **Dominant constraint: iOS PWA camera permission resets on navigation.** The single-route `/scan` pattern is load-bearing — action menu, not-found, loan/move must be overlays on the `/scan` route, never `navigate()` calls. Pitfalls #1, #2, #3, #4 all stem from this.
- **Backend lookup uses the existing items list endpoint** — `GET /api/workspaces/{wsId}/items?search={code}&limit=1`. No new HTTP route needed; the research prompt's assumption of `/api/items?barcode=` was wrong. The `/api/barcode/{code}` endpoint is an external UPC enrichment service, not a warehouse lookup.
- **Stabilization track runs in parallel.** The top hazard is retroactive VERIFICATION.md / coverage-inflation theatre — writing plausible-sounding docs or adding status-only tests that don't exercise real behavior. Non-negotiable: evidence citations + behavioral assertions.

---

## Stack Additions (consolidated delta)

Adds to existing v2.1 baseline (`frontend2/package.json`). Confirmed via `npm view` 2026-04-18.

```json
// dependencies
"@yudiel/react-qr-scanner": "2.5.1",   // EXACT, no caret — parity with /frontend
"ios-haptics": "^0.1.4",
"uuid": "^13.0.0"

// devDependencies
"@types/uuid": "^11.0.0"
```

**What this pulls transitively:** `barcode-detector@3.0.8` + `zxing-wasm@3.0.2` + `webrtc-adapter@9.0.3` (~700 kB unpacked; the bulk is the `zxing-wasm` binary which **must** be manual-chunked in `vite.config.ts`).

**React 19 peerDep:** `@yudiel/react-qr-scanner@2.5.1` declares `react ^17 || ^18 || ^19` — confirmed. No alternative library needed.

**Deliberately rejected** (and why, so this doesn't get re-litigated):
- `barcode-detector` as a direct dep — it's already a transitive; declaring it forces version drift. The v2.1 SUMMARY's mention of a direct `barcode-detector@3.0.0` pin is superseded.
- `html5-qrcode`, `@zxing/browser`, `@ericblade/quagga2` — no React 19 peerDep, bigger bundles, worse ergonomics.
- `motion` / `framer-motion` — ~60 kB gzip for three FAB animations is disproportionate; CSS transitions suffice and match the retro aesthetic better.
- `lucide-react` — retro design doesn't use line-icon sets elsewhere; use ASCII glyphs in retro font.
- `@spaceymonk/react-radial-menu`, `@radix-ui/react-popover` — we already own `@floating-ui/react`; anything else would fight the retro theme.
- `idb` / IndexedDB — online-only constraint, blocked by CI grep guard. Scan history = localStorage.
- `@use-gesture/react` — legacy-only; not ported (FAB scroll-vs-tap handled inline).

**Scan audio:** native `AudioContext` oscillator (880 Hz × ~100 ms), no MP3 asset. Respects iOS silent switch (correct behavior for a scan beep).

**Scan history:** `localStorage` key `hws-scan-history` (verbatim from legacy), capped at 10 entries (~2 kB). Not workspace-scoped by design; stale history entries gracefully re-lookup to "not found."

**Bundle impact:** If the scanner route is lazy-loaded with `React.lazy` + manual-chunked WASM, first-paint budget for the rest of the app stays flat. If it isn't, main-bundle grows by ~500–700 kB gzip — unacceptable on 4G. This is a **required** acceptance check for the scanner foundation phase.

---

## Feature Categories

### Table stakes (must ship — v1.3 parity)

1. `<BarcodeScanner>` component on `/scan` with torch (Android-only, feature-detected), manual-entry fallback, permission-denied state, initialization state.
2. Decode QR + UPC-A + EAN-13/8 + Code128 via `@yudiel/react-qr-scanner` (library handles format restriction + polyfill).
3. Audio beep + haptic (Android `navigator.vibrate` + iOS via `ios-haptics`) + visual feedback on match.
4. AudioContext resumed inside the **opening user gesture** (FAB tap or "Start" button) — NOT lazily on first scan, or first beep is silent on iOS.
5. Lookup scanned code against workspace items via `itemsApi.lookupByBarcode(wsId, code)` (new thin helper wrapping the existing list endpoint).
6. Quick-action overlay (View / Loan / Edit) layered on the **paused** scanner — never navigate away.
7. "Item not found" → create flow with barcode prefill via URL param (`/items/new?barcode=<code>`).
8. Scan history (last 10, localStorage, dedupe-on-rescan, tap-to-re-lookup, Clear All, empty state). Port verbatim from `/frontend/lib/scanner/scan-history.ts`.
9. Single-page scan flow at `/scan`. 3-tab layout (Scan / Manual / History). **No sub-routes.**
10. Loan-create integration (Mode A): scanned item preselects in `LoanForm` via `/loans/new?itemId=<id>` query param. Requires `LoanForm` to read the param and set initial value.
11. `FloatingActionButton` mounted once in `AppShell`, mobile-only (`md:hidden`), radial 3-action menu.
12. Context-aware FAB actions via `useFABActions()` hook reading `useLocation()`. Hidden on `/scan`, `/settings/*`, `/auth`, `/setup`.
13. Safe-area-inset-bottom on FAB positioning (`bottom: max(1rem, env(safe-area-inset-bottom))`).
14. Keyboard + a11y on FAB radial (Tab cycle, Escape close, ARIA `menu`/`menuitem`, `aria-expanded`, `aria-haspopup`).
15. i18n catalog gap-fill (Estonian + Russian) for every new string — mandatory cross-cutting rule from v2.1.
16. Retroactive VERIFICATION.md backfill for v2.1 phases 58/59/60 **with evidence citations** (commit SHA + test path + UAT reference per REQ).
17. `/demo` sign-off for Phase 57 retro primitives — 8 checkpoints, each requires live visit + screenshot.
18. Nyquist retroactive validation for v1.9 phases 43–47 — records commit SHA validated against, confirms phase-era file paths still exist.
19. Backend `pendingchange` handler.go unit tests (57.3% → ≥80%) **with behavioral assertions** (response body / DB state / emitted events — NOT just `status == 200`).
20. Backend `jobs` ProcessTask mocking baseline via interface extraction (v1.4 pattern: `ProcessorDeps` interface + constructor injection).
21. Test hygiene: remove 56 `waitForTimeout` calls across 24 E2E files using event-driven waits; adopt orphaned Go factories from `testutil/factory/`; fix 4 pre-existing Vitest failures in legacy `/frontend`.

### Differentiators (ship if time)

- Retro CRT scanline viewfinder overlay (respect `prefers-reduced-motion`).
- Context-adaptive action menu (archived item → only View / Unarchive; loaned item → View loan / Mark returned; needs_review → Mark reviewed first).
- Active-loan borrower name on quick-action panel for already-loaned items.
- Backend UPC enrichment on not-found (`/api/barcode/{code}` — **gated by `/^\d{8,14}$/`** or it 422s). Suggest name/brand as hint, never auto-write.
- Differentiated haptic patterns (found: single tap; not-found: double tap).
- Error beep on not-found (lower pitch).
- Per-entry delete in scan history.
- Duplicate-scan soft warning (consult recent history before declaring not-found).
- Barcode normalization to GTIN-14 on both write + lookup (prevents UPC-A vs EAN-13 format-mismatch duplicates — **Pitfall #6**).

### Deferred / anti-features

| Deferred to | Why |
|-------------|-----|
| v2.3+ | Container/location scanning (items-only) — requires backend + data-model work |
| v2.3+ | Move action (inventory-reassign UI not in frontend2) |
| v2.3+ | Repair action (repair-log feature not in frontend2) |
| v2.3+ | Offline scan queue (online-only per v2.1; would need IndexedDB + grep-guard exemption) |
| v2.3+ | Cross-device scan history sync |
| v2.3+ | Borrower QR double-scan loan workflow (borrower entity has no `short_code` field yet) |
| v2.3+ | FAB auto-hide on scroll, drag-to-reposition, multi-FAB |
| Never | Hardware scanner (USB/Bluetooth HID) — explicit OOS per PROJECT.md |
| Never | NFC tag read — explicit OOS per PROJECT.md |
| Never | Auto-submit / auto-navigate / auto-create on scan — data-quality hazard |
| Never | Continuous batch-scan mode, multi-code simultaneous scan |
| Never | Scanning-from-uploaded-image mode |
| Never | Auto-populate SKU from barcode (SKU ≠ barcode — see Pitfall #8) |

**Cross-milestone dependency:** Quick Capture inclusion in v2.2 is provisional. If Quick Capture itself slips, the scan-in-capture integration (Feature Area 7) drops entirely.

---

## Architecture Decisions

### Module layout (new)

```
frontend2/src/
├── components/
│   ├── scan/                         # reusable scan primitives
│   │   ├── BarcodeScanner.tsx        # retro-themed wrapper over @yudiel Scanner
│   │   ├── ScanErrorPanel.tsx        # permission-denied / no-camera / lib-fail
│   │   ├── ScanOverlay.tsx           # torch toggle, pulse, reticle
│   │   ├── ManualBarcodeEntry.tsx    # RetroInput fallback
│   │   └── index.ts
│   ├── fab/
│   │   ├── FloatingActionButton.tsx  # 56×56, mobile-only, radial menu
│   │   ├── FABActionItem.tsx
│   │   └── useFABActions.tsx         # route-aware config
│   └── retro/                        # UNCHANGED — no new atoms needed
├── features/scan/
│   ├── ScanPage.tsx                  # replaces v2.1 stub; orchestrates flow
│   ├── QuickActionMenu.tsx           # post-scan action sheet
│   ├── ScanHistoryList.tsx
│   └── hooks/
│       ├── useScanLookup.ts          # TanStack Query over items + external
│       ├── useScanFeedback.ts        # beep + haptic + audio-context init
│       └── useScanHistory.ts         # localStorage read/write with React sync
├── lib/scanner/                      # pure-TS support modules
│   ├── init-polyfill.ts              # ported from /frontend (remove "use client")
│   ├── feedback.ts
│   ├── scan-history.ts
│   ├── types.ts
│   └── index.ts
└── lib/api/
    └── scan.ts                       # scanApi.lookupExternal + scanKeys factory
```

**`src/components/retro/` is NOT extended.** 19 retro atoms already cover everything; a scanner is a domain concept, not a UI atom.

### Integration points

| Where | What changes | Size |
|-------|--------------|------|
| `src/routes/index.tsx` | `/scan` stub is replaced, no new route | 0 lines |
| `src/components/layout/AppShell.tsx` | Add `<FloatingActionButton actions={useFABActions()} />` inside main column | 1 line |
| `src/lib/api/items.ts` | Add `lookupByBarcode(wsId, code): Item \| null` helper (~10 LOC, exact-match guard over FTS) | +10 LOC |
| `src/lib/api/index.ts` | `export * from "./scan"` | 1 line |
| `src/features/loans/LoanForm.tsx` | Read `?itemId=<id>` from `useSearchParams()` and pass as defaultValue | ~5 LOC |
| `src/features/items/ItemForm.tsx` | Already accepts `defaultValues.barcode` — no change needed | 0 lines |
| `vite.config.ts` | `rollupOptions.output.manualChunks` for scanner chunk | ~5 LOC |

### State management

- **Three-tier split, no Context, no global store.**
- Transient UI state (paused? current code?) → local `useState` in `ScanPage`.
- Lookup result → TanStack Query `scanKeys.lookup(code)` with `staleTime: 30_000`. **Do NOT invalidate `itemKeys` on scan** (scan is a read).
- Persistent scan history → `localStorage` via `useScanHistory()` hook (key `hws-scan-history`, not workspace-scoped, survives logout with graceful re-lookup).
- Post-scan navigation intent → URL params (`/items/:id`, `/loans/new?itemId=`, `/items/new?barcode=`). URL-driven means deep-linkable + back-button-sane.

### Backend endpoint decisions (confirmed from source)

| Purpose | Endpoint | Notes |
|---------|----------|-------|
| Workspace-item lookup | `GET /api/workspaces/{wsId}/items?search={code}&limit=1` | **Canonical.** FTS over name/SKU/barcode. `FindByBarcode` exists in repo but is NOT HTTP-registered; no new route needed. |
| External product enrichment | `GET /api/barcode/{barcode}` | Public, no-auth, OpenFoodFacts + OpenProductsDB. **Huma enforces minLength=8 / maxLength=14 numeric** — gate calls by `/^\d{8,14}$/` or get 422. |
| Create / loan / borrower search | existing | No change. |

**Defence in depth:** Even though the backend filters by workspace server-side, the frontend asserts the returned `item.workspace_id` matches `useAuth().workspaceId` before rendering. This guards Pitfall #5 from regressions.

### Error boundaries

- No new React error-boundary class. The shell-level `ErrorBoundaryPage` catches crashes.
- Scanner errors are **render-time conditional UI** rendered by `BarcodeScanner` into `ScanErrorPanel` (a retro-themed panel, not an error boundary).
- Dynamic-import Suspense boundary wraps the lazy `Scanner`; fallback is a retro loader.

### What NOT to build

- **No `ScanContext` / `ScanProvider`.** The library already owns the stream; provider-wrapping adds rerender blast radius.
- **No modal-over-route scanner.** `/scan` is deep-linkable; `RetroDialog` is not full-screen and fights the camera UI.
- **No sub-routes** (`/scan/result`, `/scan/manual`, `/scan/not-found`). Overlays + state on the single route — otherwise iOS re-prompts camera permission.
- **No `IDBDatabase` / `ScanDatabase` class.** CI grep guard blocks `idb`/`offline`/`sync` substrings.
- **No new backend endpoints.** Existing surface is sufficient.
- **No `itemKeys` invalidation on scan.** Only mutations (create/loan) invalidate.
- **No direct `<video>` element** hand-rolled. Use the library's `Scanner` component (it has `playsInline` + internal stream cleanup in 2.5.x).

---

## Watch Out For (TOP 5)

Most-likely-to-bite pitfalls, combining highest impact with highest recurrence probability given this project's v1.3/v1.9 history.

1. **#1 iOS PWA camera permission reset on navigation.** Any `navigate('/items/new')` mid-scan regresses the single-route pattern. → Prevention: `/scan` is a state machine with overlays; navigation only happens after explicit "Exit scanner" or "View" action, with `streamRef.current?.getTracks().forEach(t => t.stop())` before.
2. **#5 Workspace-scoping missed on barcode lookup → cross-tenant leak.** UPCs are globally unique across the world, so collisions between tenants are **guaranteed**. → Prevention: always `WHERE workspace_id = session.workspace_id` server-side; frontend asserts returned `item.workspace_id` matches current; Go integration test with two workspaces sharing a UPC.
3. **#6 / #7 Barcode normalization + TanStack stale cache after scan→create→rescan.** UPC-A vs EAN-13 differ by a leading zero; create then rescan returns cached null and user creates a duplicate. → Prevention: canonicalize to GTIN-14 on both write and lookup (`raw.replace(/\D/g,'').padStart(14,'0')`); `useCreateItem` invalidates `['items']` AND `['scan','lookup']` keys, or use `staleTime: 0` on scan lookups.
4. **#9 Retrofit VERIFICATION.md fiction.** The seductive shortcut: open old SUMMARY, write plausible-sounding VERIFICATION.md without running anything. Poisons the archive and is worse than acknowledged gaps. → Prevention: every backfilled REQ cites (a) implementing commit SHA, (b) test file path, (c) UAT.md section OR live MCP-browser check. No cell empty. Pair-review.
5. **#10 Backend coverage gaming.** Shallow tests that assert `status == 200` push `pendingchange` past 80% without protecting any behavior. → Prevention: every new test asserts response body / DB state / emitted event; test names describe behaviors (`TestConflictResolutionChoosesLocalWinsOnCriticalField`), not methods; PR reviewer reads the test diff, not the coverage badge.

**Honorable mentions** (also likely, lower severity):
- **#4 StrictMode double-mount** — dev-only, burns hours — fix with ref-array cleanup pattern.
- **#12 Bundle size bomb** — always route-lazy-split `/scan` and manual-chunk the WASM.
- **#19 AudioContext suspended on first scan** — resume inside the opening user gesture.

Full list (35 pitfalls + phase mapping): see `PITFALLS.md`.

---

## Open Decisions

Must be resolved during requirements definition or planning:

1. **Backend barcode-lookup endpoint path.**
   - **Answered by research (overrides PROJECT.md prep item):** use `GET /api/workspaces/{wsId}/items?search={code}&limit=1` with a client-side exact-match guard (`items.find(i => i.barcode === code)`) falling back to first FTS result. No new backend route.
   - **Still open:** should the helper also check `sku` equality as a tiebreaker, or is FTS ordering sufficient? (Low-impact; document chosen behavior in the API client JSDoc.)

2. **Quick Capture inclusion in v2.2.**
   - PROJECT.md lists it as active v2.2. If it slips to v2.3, Feature Area 7 (scan-in-capture) drops entirely from this milestone.
   - Needs a go/no-go call before requirements freeze.

3. **Cascade policy for category/location delete** (prep item from PROJECT.md).
   - Not scanner-related but listed as a v2.2 prep; needs `block` vs `cascade` vs `un-set` decision before any taxonomy work inside this milestone. Probably out of scope for v2.2; confirm.

4. **Motion library vs CSS for FAB animations.**
   - Research recommends CSS transitions (save ~60 kB, matches sharp mechanical retro aesthetic).
   - Adopting `motion@^12.27` would mean easier port of `/frontend/components/fab/` but adds dep for three animations.
   - **Default: CSS.** Revisit only if the radial stagger feels janky during the FAB phase's `/demo` checkpoint.

5. **LoanForm preselect API shape.**
   - Option A: extend `LoanForm` props with `defaultItemId?: string`.
   - Option B: read `useSearchParams().get("itemId")` inside `LoansListPage` (or a `/loans/new` route) and pipe into the form.
   - **Recommendation: B.** Simpler, URL-driven, matches legacy pattern (`/dashboard/loans/new?item=<id>`), deep-linkable.

6. **Not-found → create: inline dialog vs navigation.**
   - Inline dialog keeps scanner mounted (no iOS permission re-prompt) but requires shrinking or porting `ItemForm` into a dialog variant.
   - Navigation to `/items/new?barcode=<code>` is simpler but tears down the stream.
   - **Recommendation:** navigate for v2.2 (legacy parity; stop the stream deliberately first). Revisit if usage data shows friction.

7. **External UPC enrichment on not-found: opt-in or always?**
   - Enabling by default doubles the latency of not-found flows. Gating by length (`/^\d{8,14}$/`) is non-negotiable regardless.
   - **Recommendation:** always attempt when code matches length; display as "suggest these details?" hint, never auto-write.

8. **Scan-to-loan intent mode on `/scan`.**
   - Always show quick-action menu (including Loan) — simpler, default verb-neutral.
   - OR add an intent toggle (Lookup / Lend / Capture) that changes the post-scan default.
   - **Recommendation:** always show quick-action menu for v2.2; intent-mode toggle is a differentiator.

9. **FAB icons: lucide vs ASCII glyphs.**
   - Research recommends ASCII glyphs (retro-consistent, no dep). `[◉]` scan, `[+]` add, `[>>]` loan.
   - Decide before FAB phase begins.

---

## Phase Sequencing Hints

Dependency-first, outward from primitives. Two tracks run in parallel.

### Track A — Scanning + FAB (seven sequential + parallelizable integrations)

**Wave 1: Foundation (primitives, no UI)**
- **Phase A1 — Scanner support modules.** Port `lib/scanner/{init-polyfill,feedback,scan-history,types}.ts` from legacy (strip `"use client"`). Unit tests. No new deps.
- **Phase A2 — API client additions.** Add `lib/api/scan.ts` + `itemsApi.lookupByBarcode` + `scanKeys` factory. Unit tests with fetch mocks.
- **Phase A3 — Install scanner dep + chunk config.** `bun add @yudiel/react-qr-scanner@2.5.1 ios-haptics uuid`. `vite.config.ts` manual-chunk. Verify main-bundle gzip budget with `vite build --report`.

Acceptance gate: build passes, CI grep guard stays green, `/scan` main bundle contribution ≤20 kB.

**Wave 2: Primitives**
- **Phase A4 — `<BarcodeScanner>` + `<ManualBarcodeEntry>` + `<ScanErrorPanel>`.** Retro-themed wrapper over `@yudiel` Scanner with torch gate, permission-denied, StrictMode-safe cleanup (ref-array pattern). Component tests with mocked `@yudiel/react-qr-scanner` module.

**Wave 3: Hooks + page**
- **Phase A5 — Hooks.** `useScanLookup`, `useScanFeedback`, `useScanHistory`. TanStack Query harness for lookup tests.
- **Phase A6 — ScanPage + QuickActionMenu + ScanHistoryList.** Replace stub. 3-tab layout (Scan / Manual / History). Action menu overlay on paused scanner. Not-found panel with create + scan-again. E2E via manual-entry path.

**Wave 4: Integrations (can parallel-split)**
- **Phase A7 — FAB + useFABActions.** Can run in parallel with A6; both depend only on Wave 2 + Wave 3's API changes. Mount in `AppShell`. CSS-only animations. Safe-area-inset-bottom. Axe + keyboard-only walkthrough.
- **Phase A8 — Loan create preselect integration.** Add `?itemId=` param reading to `LoanForm`; wire action-menu "Loan" button.
- **Phase A9 — Quick Capture scan integration** (only if Quick Capture ships in v2.2): embedded Mode B inline scanner, barcode-field-only autofill.

**Critical path:** A1 → A2 → A3 → A4 → A5 → A6 → A8. Roughly 7 phases. A7 and A9 parallelize.

### Track B — Stabilization (runs concurrently throughout)

Not a blocker for Track A; scheduled alongside so Track A's phase handoffs can also sign off B items incrementally.

- **Phase B1 — VERIFICATION.md backfill for v2.1 phases 58/59/60.** Evidence citations required per REQ. Pair-reviewed.
- **Phase B2 — `/demo` sign-off for Phase 57.** 8 checkpoints, each with screenshot + timestamp. Visit live, don't imagine.
- **Phase B3 — Nyquist retroactive validation for v1.9 phases 43–47.** Record commit SHAs validated against; confirm phase-era file paths still resolve.
- **Phase B4 — pendingchange handler.go unit tests (57.3% → ≥80%).** Interface extraction (`PendingChangeDeps`) + behavioral-assertion tests. Adopt orphaned `testutil/factory/` factories.
- **Phase B5 — jobs ProcessTask baseline.** Interface extraction for DB + Asynq; first actionable unit tests. No target %; the goal is a foundation future tests can build on.
- **Phase B6 — Test hygiene.** Replace 56 `waitForTimeout` with event-driven waits; fix 4 pre-existing Vitest failures in `/frontend/lib/api/__tests__/` and `use-offline-mutation.test.ts` (localized to legacy `/frontend` — no `frontend2/` touches).

Track B has few inter-phase deps; can be 2-up parallel on any week Track A is in a long review.

### Ordering rationale

- **Primitives first (A1–A4) unblock all UI.** Writing `<BarcodeScanner>` before the feedback/history/API modules forces mocks; writing them afterward means every consumer just imports ready pieces.
- **Install dep in A3, not A1.** A1 has no dep on `@yudiel`; avoids polluting the package.json if the first primitive port reveals a blocker.
- **FAB is independent of ScanPage for design but depends on it for action destinations.** If A6 lags, A7 can ship with the Scan action pointing to the stub `/scan`; live destinations wire at A6 merge.
- **Quick Capture integration is last.** It's the only phase that could slip without blocking anything else — if QC itself drops from v2.2, A9 drops cleanly.
- **Loan integration is last-minus-one (A8) because LoanForm itself may need a small refactor** (`?itemId=` param reading) that's easiest once ScanPage's action menu is real.
- **Stabilization (Track B) runs throughout because its blocking risk is cultural, not technical.** Spacing it across weeks keeps the "one big doc push at the end" anti-pattern at bay.

### Research flags

**Needs research phase (moderate):**
- **Phase A3** — `vite.config.ts` chunking for `zxing-wasm` under Vite 8 + React 19. The library-side guidance is thin; first verification may need a bundle-analyzer deep-dive.
- **Phase A5** — TanStack Query `staleTime` / refetch-on-rescan behavior interaction with `useCreateItem` invalidation. Pitfall #7 is subtle; a 30-minute research spike on "TanStack invalidation scope for a computed query key" before planning is worth it.
- **Phase B4 + B5** — interface extraction in the backend. Pattern is documented (v1.4) but each new handler/job needs dependency analysis; expect one research pass per target file.

**Standard patterns (skip research):**
- Phase A1, A2, A7 — straight ports from legacy with known-good shape.
- Phase A4 — library wiring + v1.3 pattern; tests mirror legacy `BarcodeScanner.test.tsx`.
- Phase A8 — URL-param plumbing, one-line addition.
- Phase B1, B2, B3 — process-only, no new code.
- Phase B6 — mechanical find/replace using existing v1.4 pattern.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Every version registry-verified 2026-04-18. Legacy `/frontend` ships the same `@yudiel/react-qr-scanner@2.5.1` + `ios-haptics@0.1.4` in production; reuse is de-risking. iOS torch gap + `navigator.vibrate` gap documented by WebKit bug trackers. |
| Features | HIGH | v1.3 is the reference implementation, already shipped, audit-clean. PROJECT.md + `/frontend` source are ground truth, not speculation. Two gaps: (a) Quick Capture inclusion in v2.2 is provisional; (b) cascade-policy prep item is unrelated to scanner but still open. |
| Architecture | HIGH | Existing `/frontend2` surface inspected directly (routes, retro barrel, API clients, AppShell). CI grep guard constraints understood. Two research-prompt assumptions corrected: (1) no new `/api/items?barcode=` endpoint — use existing `?search=` on list endpoint; (2) `/api/barcode/{code}` is external enrichment, not warehouse lookup. |
| Pitfalls | HIGH | Grounded in shipped v1.3 + v1.9 + v2.1 audits and library-specific README confirmation. Every top-5 pitfall has either been hit by this project historically or is explicitly documented in ecosystem bug trackers. |

**Overall confidence:** HIGH — this milestone is a port-and-stabilize, not a greenfield build. The dominant risk is process (retrofit theatre, coverage gaming), not technical unknowns.

### Gaps to Address

- **Quick Capture inclusion in v2.2** — needs explicit go/no-go before requirements freeze. Impacts whether Feature Area 7 (scan-in-capture) is in scope, and whether Phase A9 exists at all.
- **Cascade policy for category/location delete** — PROJECT.md prep item, unrelated to scanner but still open. Surfaces if any taxonomy work enters v2.2; probably out of scope.
- **LoanForm preselect exact API shape** — URL param vs prop; recommendation is URL param, decide in phase A8 planning.
- **Not-found → create: navigate vs inline dialog** — recommendation is navigate for v2.2 parity; revisit later based on usage.
- **FAB animation strategy** — recommendation is CSS-only; may need revision if `/demo` checkpoint reveals jank.
- **Backend interface-extraction shapes for pendingchange and jobs** — each target file needs a dependency-analysis pass; deferred to phase planning.
- **`@yudiel/react-qr-scanner` dynamic-import tree-shaking under Vite 8** — not blocking but worth `vite build --analyze` verification in Phase A3. If the scanner statically imports < 30 kB gzip, skip Suspense and simplify.

---

## Sources

### Primary (HIGH confidence)

- `.planning/research/STACK.md` — stack additions, version matrix, Vite + iOS integration notes
- `.planning/research/FEATURES.md` — feature inventory with v1.3 reference crossmarks
- `.planning/research/ARCHITECTURE.md` — module layout, state split, backend endpoint audit
- `.planning/research/PITFALLS.md` — 35 pitfalls + phase mapping + recovery strategies
- `.planning/PROJECT.md` — v2.2 milestone scope, v1.3 + v1.9 + v2.1 validated requirements, Key Decisions
- `frontend2/package.json`, `frontend2/src/routes/index.tsx`, `frontend2/src/components/retro/index.ts` — current v2.1 baseline (direct source inspection)
- `frontend/lib/scanner/*`, `frontend/components/scanner/*`, `frontend/components/fab/*`, `frontend/lib/hooks/use-fab-actions.tsx` — legacy reference implementations to port
- `backend/internal/domain/warehouse/item/{handler.go:583, repository.go:28}` — confirmed FTS search over name/SKU/barcode on list endpoint; `FindByBarcode` is repo-only (not HTTP-registered)
- `backend/internal/domain/barcode/{handler.go, service.go}` — external enrichment endpoint shape
- `backend/internal/api/router.go:319` — confirmed `/api/barcode/{code}` is public/unauthenticated
- `scripts/check-forbidden-imports.mjs` — CI grep-guard rules (`idb`, `offline`, `sync` blocked)
- `npm view @yudiel/react-qr-scanner ios-haptics uuid` (2026-04-18) — version + peerDep verification

### Secondary (MEDIUM confidence)

- `.planning/milestones/v1.3-MILESTONE-AUDIT.md`, `.planning/milestones/v2.1-MILESTONE-AUDIT.md` — prior-milestone tech debt + VERIFICATION gap documentation
- WebKit bug #243075 — torch track constraint ignored on iOS (https://bugs.webkit.org/show_bug.cgi?id=243075)
- WebKit bug #215884 — getUserMedia recurring permissions prompts when hash changes (https://bugs.webkit.org/show_bug.cgi?id=215884)
- WebKit bug #185448 — getUserMedia not working in apps added to home screen (https://bugs.webkit.org/show_bug.cgi?id=185448)
- MDN: MediaStreamTrack.stop / getCapabilities / getTracks
- MDN: Web Audio API best practices
- TanStack Query v5 — Query Invalidation docs
- yudielcurbelo/react-qr-scanner README (2.5.1)
- tijnjh/ios-haptics — library source, checkbox-switch technique
- GS1 GTIN normalization — UPC-A ↔ EAN-13 ↔ GTIN-14 canonicalization rules

### Tertiary (LOW confidence, flagged for validation)

- MDN browser-compat-data issue #29166 — navigator.vibrate on iOS Safari inconsistent per community tracking
- html5-qrcode issue #641 — Two cameras appear on reload (class-of-bug reference for `@yudiel` library)
- Matt Montag — Unlock JavaScript Web Audio in Safari (AudioContext.resume() user-gesture pattern)
- ZXing-WASM bundle-size estimates — gzip ratios cited from npm are approximate; verify with `vite build --analyze` during Phase A3

---
*Research completed: 2026-04-18*
*Ready for roadmap: yes*
