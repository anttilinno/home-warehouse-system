# Phase 64: Scanner Foundation & Scan Page — Context

**Gathered:** 2026-04-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the live `/scan` route in `/frontend2` with a single-page scanner flow at v1.3 parity: camera preview, decode of QR + UPC-A + EAN-13 + Code128, audio/haptic/visual feedback on scan, Android torch toggle, Manual entry fallback, and Scan History (last 10, localStorage). Ship the reusable scanner primitives, hooks, and a stub API-client scaffold so Phase 65 (item lookup) and Phase 66 (quick-action menu) can plug in without rewiring.

**In scope:**
- `lib/scanner/` port from legacy `/frontend` (init-polyfill, feedback, scan-history, types)
- `components/scan/` retro primitives (BarcodeScanner, ManualBarcodeEntry, ScanErrorPanel, ScanOverlay)
- `features/scan/` page + hooks (ScanPage, useScanHistory, useScanFeedback, useScanLookup stub)
- `lib/api/scan.ts` empty API scaffold (Phase 65 fills in)
- `vite.config.ts` manualChunks for zxing-wasm; `/scan` route-lazy-split
- `package.json` adds for `@yudiel/react-qr-scanner@2.5.1`, `uuid@^13.0.0`, `@types/uuid@^11.0.0` (**`ios-haptics` dropped from Phase 64 per D-17** — see decisions)
- Lingui EN + ET catalog entries for every new string (gap-fill in this phase, per Phase 63 pattern)

**Out of scope (belong to later phases):**
- Real item lookup against the workspace → Phase 65 (LOOK-01)
- Not-found → create item flow with barcode prefill → Phase 65 (LOOK-02)
- External UPC enrichment banner → Phase 65 (LOOK-03)
- Post-scan QuickActionMenu (View / Loan / etc) → Phase 66
- FAB (mounted in AppShell) → Phase 67
- Loan preselect from scan → Phase 68
- Quick Capture inline scan → Phase 69

</domain>

<decisions>
## Implementation Decisions

### Scope & Post-Scan UX

- **D-01:** Phase 64 delivers primitives + stub API/hook. `lib/api/scan.ts` is created as an empty scaffold. `useScanLookup(code)` hook exists and returns a hardcoded `{ status: 'idle', match: null }` shape that Phase 65 replaces with the real TanStack Query call. This gives Phase 65 less new surface area while keeping the Phase 64 ↔ Phase 65 boundary clean.
- **D-02:** Post-scan UX is **pause + result banner**. On a successful decode the scanner pauses (stream stays mounted, no `track.stop()`), a retro banner shows the decoded code + format + a "SCAN AGAIN" button, and a history entry is written. Phase 66 replaces the banner with the full QuickActionMenu overlay — the paused-but-mounted pattern is established in this phase so the Phase 66 wire-up is a component swap, not a rearchitecture.
- **D-03:** Dedupe follows legacy: same code moves to the top of history, no duplicate entry. Scanner still pauses and re-shows the banner on each decode so the user gets feedback. Matches `frontend/lib/scanner/scan-history.ts` behavior and SCAN-06 intent.
- **D-04:** `useScanHistory()` is the single API surface: `{ entries, add, clear, remove }`. Components never touch `localStorage` directly. React state syncs automatically on mutations.

### Tabs & Camera Bootstrap

- **D-05:** Default tab on mount is **Scan**. Fastest path to the user's intent (FAB tap, dashboard card, direct URL). Matches legacy behavior.
- **D-06:** No tab persistence. Every `/scan` visit starts on the default tab. No URL hash, no localStorage for tab state.
- **D-07:** Camera permission prompt fires on page mount — the `Scanner` renders with `paused=false` immediately on first render of the Scan tab. No separate "Start scanning" button. Matches legacy UX and avoids an extra tap on every normal use.
- **D-08:** AudioContext is created and resumed via a `pointerdown` handler at the `RetroTabs` / page wrapper level on first user interaction. This works regardless of which tab the user lands on first, and satisfies iOS's "resume inside the opening user gesture" rule (Pitfall #19).

### Error States & Retry

- **D-09:** Four distinct retro error panels, each with its own copy: **permission-denied**, **no-camera** (NotFoundError / OverconstrainedError), **library-init-fail** (WASM / polyfill load failure), and **unsupported-browser** (getUserMedia unavailable).
- **D-10:** Permission-denied panel shows platform-specific instructions (iOS: Settings → Safari → Camera; Android: lock icon → Permissions) PLUS a prominent "USE MANUAL ENTRY" button that switches the tab to Manual. No fake "Retry" button — permission state cannot be re-requested from JS once denied.
- **D-11:** Library-init-fail panel shows a "RETRY" button that dynamically re-imports the scanner module, and a "USE MANUAL ENTRY" fallback. Covers transient network blips without wiping scan history via a hard refresh.
- **D-12:** All error paths log a structured `console.error` with `{ kind, errorName, userAgent, timestamp }`. No backend telemetry — `/frontend2` has no analytics wired.

### Viewfinder + Manual Entry

- **D-13:** Viewfinder visual = thick retro-ink **corner reticle brackets** + single animated **amber horizontal scanline** sweeping top-to-bottom. Under `prefers-reduced-motion`, the scanline is static (or hidden) and the corners remain.
- **D-14:** Manual tab accepts any trimmed non-empty string (max 256 chars). No format gate — QR content can be a URL / free text, Code128 can be alphanumeric. Format is detected downstream. Matches legacy behavior.
- **D-15:** Tapping a history entry re-fires the post-scan flow: dedupe-to-top in history, pause scanner if on Scan tab, show the decoded-code banner. Exercises the same code path as a live decode, so Phase 65 has nothing to rewire when the real lookup lands.
- **D-16:** Torch button is **not rendered at all** when unsupported. Feature-detected per-stream via `MediaStreamTrack.getCapabilities().torch`. Matches SCAN-04 wording ("hidden on iOS and desktops without torch").

### Post-Discuss Amendments (locked 2026-04-18)

- **D-17:** iOS haptic via `ios-haptics` is **deferred out of Phase 64**. `feedback.ts` ports verbatim from legacy (`navigator.vibrate` only). Desktop + iOS get audio + visual feedback; Android also gets `navigator.vibrate` haptic. `ios-haptics@^0.1.4` is REMOVED from package.json adds. SCAN-03 on iOS ships audio + visual only; ROADMAP Phase 64 SC#2 is narrowed to match. iOS haptic is picked up in a later phase (not re-numbered here).
- **D-18:** `useScanLookup` stub defines the full `status: 'idle' | 'loading' | 'success' | 'error'` discriminated union in its return type even though it only ever returns `'idle'` in Phase 64. Phase 65 flips the state machine without touching any callsite.
- **D-19 (narrowed 2026-04-18):** Library-init-fail RETRY covers **`initBarcodePolyfill()` only**. Implemented as in-feature `errorKind` state + `scannerKey` bump on `BarcodeScanner`. React.lazy scanner-chunk load failures are handled by the existing route-level `ErrorBoundaryPage` (architectural constraint — lazy-chunk errors throw above any in-feature try/catch; catching them requires an Error Boundary class at the Suspense boundary, which was deemed not worth the extra class component for a transient-network case). Original ambition of "both paths via in-feature try/catch" is retired.
- **D-20:** History-entry tap renders the post-scan banner on the **current tab** (above the list when on History). No auto-switch to Scan tab. Aligns with D-06 no-auto-navigation and matches UI-SPEC.

### Claude's Discretion

- Exact `RetroTabs` API fit (current barrel export) for the 3-tab Scan/Manual/History layout
- Scanline animation timing/easing (pick values consistent with retro feel; likely ~2s linear)
- Exact per-platform copy in the permission-denied panel (EN first; ET must be filled in this phase per Phase 63 gap-fill pattern)
- Banner visual arrangement (code, format label, SCAN AGAIN button position within the retro panel)
- Torch icon glyph (ASCII vs retro monospace bold); decide during implementation
- File split inside `lib/scanner/` — 1:1 port of legacy structure (init-polyfill / feedback / scan-history / types / index) with `"use client"` stripped and any Next.js dynamic-import replaced with Vite/React 19 equivalents
- AudioContext singleton ownership (hook vs module-scope) — whichever maps cleaner to `useScanFeedback`

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 64 Upstream (primary)

- `.planning/ROADMAP.md` — Phase 64 goal, depends-on, success criteria (search for "Phase 64: Scanner Foundation")
- `.planning/REQUIREMENTS.md` — SCAN-01..07 (the only reqs this phase owns)
- `.planning/PROJECT.md` — v2.2 scope, Key Decisions (scan-related rows: single-route scan flow, pinned deps, localStorage history, CSS-not-motion for FAB), tech stack, iOS PWA constraints
- `.planning/STATE.md` — v2.2 accumulated decisions (lines 77–103)

### Research Baseline (MANDATORY — read in full before planning)

- `.planning/research/SUMMARY.md` — Full milestone research synthesis; module layout, state split, backend endpoint audit, top-5 pitfalls; Phase A1–A6 decomposition maps directly to this phase's internal task split
- `.planning/research/STACK.md` — Dependency matrix with registry-verified versions and transitive footprint; Vite manual-chunking guidance for `zxing-wasm`
- `.planning/research/FEATURES.md` — Feature inventory with v1.3 reference crossmarks (table-stakes list = this phase's acceptance checklist)
- `.planning/research/ARCHITECTURE.md` — Module layout, state management tiering, integration points
- `.planning/research/PITFALLS.md` — 35 pitfalls + phase mapping. Phase 64 is primarily exposed to **#1 iOS perm reset on navigation**, **#4 StrictMode double-mount**, **#12 Bundle size bomb**, **#19 AudioContext suspended on first scan**

### Legacy Reference (v1.3 — port baseline for `lib/scanner/*`)

- `frontend/lib/scanner/init-polyfill.ts` (49 LOC) — port verbatim, strip `"use client"`
- `frontend/lib/scanner/feedback.ts` (149 LOC) — port verbatim, strip `"use client"`
- `frontend/lib/scanner/scan-history.ts` (196 LOC) — port verbatim, strip `"use client"` — localStorage key `hws-scan-history`, 10-entry cap, dedupe-to-top
- `frontend/lib/scanner/types.ts` (51 LOC) — port with `/frontend2` type adjustments (drop IndexedDB entity imports; Phase 64 has no lookup)
- `frontend/lib/scanner/index.ts` (58 LOC) — barrel, port
- `frontend/components/scanner/barcode-scanner.tsx` (281 LOC) — **rewrite in retro aesthetic**, do NOT port verbatim (legacy uses shadcn + lucide)
- `frontend/components/scanner/manual-entry-input.tsx` (111 LOC) — rewrite using `RetroInput` + `RetroButton`
- `frontend/components/scanner/scan-history-list.tsx` (146 LOC) — rewrite using `RetroPanel` + `RetroEmptyState`

### Current `/frontend2` State

- `frontend2/src/features/scan/ScanPage.tsx` — Current "PAGE UNDER CONSTRUCTION" stub; Phase 64 replaces its contents
- `frontend2/src/routes/index.tsx:85` — `<Route path="scan" element={<ScanPage />} />` registration; no change
- `frontend2/src/components/retro/index.ts` — Retro barrel; **no new atoms** for Phase 64
- `frontend2/src/components/retro/RetroTabs.tsx` — Fit for Scan / Manual / History tab strip
- `frontend2/src/components/retro/RetroPanel.tsx` — Result banner + all four error panels
- `frontend2/src/components/retro/RetroInput.tsx` — Manual entry input
- `frontend2/src/components/retro/RetroEmptyState.tsx` — Empty history state
- `frontend2/src/components/retro/RetroButton.tsx` — Retry / Clear / Scan-Again / Use-Manual buttons
- `frontend2/package.json` — Target for dep adds (`@yudiel/react-qr-scanner@2.5.1`, `ios-haptics@^0.1.4`, `uuid@^13.0.0`, `@types/uuid@^11.0.0`)
- `frontend2/vite.config.ts` — `rollupOptions.output.manualChunks` for scanner WASM chunk

### Guardrails

- `scripts/check-forbidden-imports.mjs` — CI grep guard; no `idb`/`serwist`/`offline`/`sync` imports in `frontend2/`. Scan history uses `localStorage` only — do not reintroduce IndexedDB.

### Prior Phase Context

- `.planning/phases/63-navigation-and-polish/63-CONTEXT.md` — Phase 63 context: sidebar already omits `/scan` NavLink by design (D-03); ET catalog gap-fill is per-phase via `bun run extract` + manual fill; barrel-import pattern (`@/components/retro`) is mandatory per Phase 54

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `RetroTabs` — 3-tab strip for Scan / Manual / History; no new component needed
- `RetroPanel` — serves as container for result banner AND each of four error panels; thick retro border + hazard-stripe header are already in the design language
- `RetroInput` — Manual tab input; inherits validation error styling
- `RetroEmptyState` — history empty state; same copy pattern as Items / Borrowers empty states
- `RetroButton` — Retry / Clear History / Scan Again / Use Manual — existing variants cover all these
- `RetroConfirmDialog` — confirmation prompt for Clear History (SCAN-07)
- `frontend/lib/scanner/*` — 5 files, ~500 LOC, straight port baseline once `"use client"` and Next dynamic-import calls are stripped

### Established Patterns

- **TanStack Query for server state** (v2.1 foundation) — `useScanLookup` will use this in Phase 65; the Phase 64 stub should pre-shape its return type to match
- **Lingui macro for all UI strings** — every new string goes in EN catalog; `bun run extract` + ET gap-fill happens within this phase (per Phase 63's pattern — do NOT push it to a stabilization phase)
- **CI grep guard** blocks `idb` / `serwist` / `offline` / `sync` substrings in `/frontend2`
- **`@/components/retro` barrel-only imports** (Phase 54 decision) — no direct file imports from inside the retro folder
- **Stream cleanup** on unmount: `ref.current?.getTracks().forEach(t => t.stop())` — required to avoid Pitfall #1
- **StrictMode double-mount safety**: ref-array cleanup pattern required around the `Scanner` component in dev (Pitfall #4)

### Integration Points

- `frontend2/src/features/scan/ScanPage.tsx` — replaces the "UNDER CONSTRUCTION" stub; orchestrates the 3-tab flow
- `frontend2/vite.config.ts` — add `rollupOptions.output.manualChunks` entry that splits `@yudiel/react-qr-scanner` + `zxing-wasm` into their own chunk so users who never open `/scan` don't pay for the ~500–700 kB gzip
- `frontend2/src/routes/index.tsx` — wrap `ScanPage` in `React.lazy` + `Suspense` with a retro loader fallback, so the scanner WASM chunk is request-on-demand
- `frontend2/package.json` — three new runtime deps + one new devDep
- `frontend2/locales/en/messages.po` + `frontend2/locales/et/messages.po` — new catalog entries for every UI string added

### Bundle Budget (acceptance gate)

- `/scan` main-bundle contribution ≤ 20 kB gzip (measured via `vite build --report` or `--analyze`)
- If the scanner chunks leak into the main bundle because of a missed `manualChunks` rule, the phase is not shippable. Verify before sign-off.

</code_context>

<specifics>
## Specific Ideas

- Legacy `/frontend/lib/scanner/*` is the port baseline — keep algorithmic behavior (history dedupe, AudioContext init, torch detection) byte-for-byte where possible; only rewrite the `"use client"` and Next dynamic-import plumbing. The code has been in production since v1.3 and is audit-clean.
- Viewfinder visual is **corner brackets + amber scanline** (preview accepted during discussion; see DISCUSSION-LOG.md for the ASCII sketch that was picked). Scanline must respect `prefers-reduced-motion`.
- Permission-denied panel carries **platform-specific instruction text** (iOS Safari → Camera path; Android lock icon → Permissions path). Ship EN + ET together in this phase.
- Result banner is deliberately minimal — Phase 66 replaces it with QuickActionMenu. Do NOT over-design the banner with action affordances beyond "SCAN AGAIN"; that path leads to throwaway UI work.
- Scan history entry shape keeps the legacy format (`code`, `format`, `entityType: "unknown"`, `timestamp`) even though Phase 64 only ever writes `entityType: "unknown"`. Phase 65 will populate `entityType` and entity ID after lookup resolves — preserving the shape now avoids a migration.
- `useScanLookup` stub returns `{ status: 'idle', match: null }` with the final shape Phase 65 expects. Phase 65 replaces the implementation; the callsite (banner / history tap handler) stays untouched.

</specifics>

<deferred>
## Deferred Ideas

### Downstream phases (already in roadmap)

- Real workspace item lookup (`GET /api/workspaces/{wsId}/items?search=<code>&limit=1`) with exact-match guard → **Phase 65** (LOOK-01)
- "Not found → create item" navigation with barcode prefill (`/items/new?barcode=<code>`) → **Phase 65** (LOOK-02)
- External UPC enrichment suggestion banner (`GET /api/barcode/{code}`, gated by `/^\d{8,14}$/`) → **Phase 65** (LOOK-03)
- Quick-action overlay sheet (View / Loan / Back to Scan, state-adaptive) → **Phase 66** (QA-01..03)
- FAB mounted in AppShell (context-aware radial menu) → **Phase 67** (FAB-01..04)
- Loan preselect from scan (`/loans/new?itemId=<id>`) → **Phase 68** (INT-LOAN-01)
- Quick Capture inline scan → **Phase 69** (INT-QC-03)

### Beyond v2.2

- iOS haptic via `ios-haptics` (D-17 deferred from Phase 64) — pick up in a later scanner-polish phase; dep add + `feedback.ts` branching happens then, not here
- Container / location scanning (schema does not yet support barcode on those entities) → v2.3+
- Offline scan queue → v2.3+ (blocked by v2.1 online-only stance + CI grep guard)
- Cross-device scan history sync → v2.3+
- Full-viewport CRT scanline overlay (beyond the single-scanline accent chosen here) → v2.3+ differentiator
- Differentiated haptic patterns (found single-tap vs not-found double-tap) → v2.3+ differentiator
- Error beep on not-found (lower pitch) → v2.3+ differentiator
- Per-entry delete in scan history → v2.3+
- Duplicate-scan soft warning (consult recent history before declaring not-found) → v2.3+
- GTIN-14 canonicalization on write + lookup → revisit in Phase 65 if duplicate-barcode regressions surface; not in Phase 64 scope because no lookup happens here yet

### Never

- Hardware scanner (USB/Bluetooth HID) — explicit OOS per PROJECT.md
- NFC tag read — explicit OOS per PROJECT.md
- Auto-submit / auto-navigate / auto-create on scan — data-quality hazard
- Continuous batch-scan mode — data-quality hazard
- Scanning from uploaded image — OOS per research

</deferred>

---

*Phase: 64-scanner-foundation-scan-page*
*Context gathered: 2026-04-18*
