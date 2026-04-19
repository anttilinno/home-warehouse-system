---
gsd_state_version: 1.0
milestone: v2.2
milestone_name: Scanning & Stabilization
status: executing
stopped_at: Phase 65 Plan 09 complete (G-65-01 gap closure Wave 6 backend: GET /items/by-barcode/{code} Huma route + Service.LookupByBarcode pass-through; 3+5 TDD subtests green; full item package + backend build clean)
last_updated: "2026-04-19T11:48:00.000Z"
last_activity: 2026-04-19 -- Phase 65 Plan 09 complete (Gap G-65-01 backend closure: dedicated GET /api/workspaces/{wsId}/items/by-barcode/{code} Huma route + ServiceInterface.LookupByBarcode pass-through. Service normalises shared.ErrNotFound → ErrItemNotFound mirroring Service.Delete pattern; handler maps the sentinel to 404, 500 on other errors, 400/422 on Huma path-param maxLength:64 violation. Route ordered between /items/search (literal) and /items/{id} (param) — literal-before-param chi matching idiom. LookupItemByBarcodeInput/Output types with path:"code" minLength:1 maxLength:64. TDD gate: 2 RED + 2 GREEN commits per task — test(65-09) bf33f8d adds failing TestService_LookupByBarcode (3 subtests: match / shared.ErrNotFound normalisation / arbitrary repo error passthrough); feat(65-09) 283a6bf adds Service impl + ServiceInterface extension + MockService.LookupByBarcode stub (1 Rule 3 fix: ServiceInterface extension broke MockService compile across handler_test.go, stub pulled from planned Task 2 to Task 1 GREEN to keep package compiling); test(65-09) e3b31e1 adds failing TestItemHandler_LookupByBarcode (5 subtests: 200 happy path / 404 on ErrItemNotFound / 500 on opaque error / 400/422 on oversize code via AssertNotCalled / case-sensitivity guard where ABC-123 and abc-123 are distinct service calls); feat(65-09) 59d4e3d registers the Huma route + types + best-effort primary-photo decoration mirroring GetByID convention. Handler uses errors.Is(err, ErrItemNotFound) style (matches Service.Delete convention) rather than err == ErrItemNotFound pointer equality used by adjacent GetByID handler. Local var `itm` (not `item`) in handler closure to avoid shadowing the item package name. Full item package green (service + handler + all pre-existing tests); backend go build ./... clean. One PRE-EXISTING test failure in internal/jobs package (TestCleanupConfig_RetentionPeriodUsage 30-day + 90-day subtests at cleanup_test.go:216) confirmed unrelated — reproduces on baseline e3b31e1 via git stash before any 65-09 changes; logged in phase deferred-items.md. Plan 65-10 frontend swap unblocked — backend endpoint exists and is ready for the itemsApi.lookupByBarcode swap.
progress:
  total_phases: 6
  completed_phases: 5
  total_plans: 18
  completed_plans: 18
  percent: 95
---

# Project State: Home Warehouse System

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-18)

**Core value:** Reliable inventory access anywhere -- online or offline -- with seamless sync
**Current focus:** Phase 65 — item-lookup-and-not-found-flow

## Current Position

Phase: 65 (item-lookup-and-not-found-flow) — gap-closure Wave 6 COMPLETE; Waves 7-8 ahead
Plan: 9 of 11 (plans 01-09 complete; 10 + 11 remain for G-65-01 closure)
Status: 65-09 backend endpoint shipped — Plan 65-10 frontend swap unblocked
Last activity: 2026-04-19 -- Phase 65 Plan 09 complete (G-65-01 backend closure: dedicated GET /api/workspaces/{wsId}/items/by-barcode/{code} Huma route + ServiceInterface.LookupByBarcode pass-through. Service normalises shared.ErrNotFound → ErrItemNotFound mirroring Service.Delete pattern; handler maps sentinel → 404, opaque error → 500, path-param minLength:1/maxLength:64 violation → 400/422. Route ordered between /items/search and /items/{id} (literal-before-param chi matching idiom). TDD gate: 2 RED + 2 GREEN commits per task — bf33f8d (test RED Task 1), 283a6bf (feat GREEN Task 1 + 1 Rule 3 auto-fix: pulled MockService.LookupByBarcode stub from planned Task 2 to Task 1 GREEN because ServiceInterface extension broke MockService compilation across handler_test.go), e3b31e1 (test RED Task 2), 59d4e3d (feat GREEN Task 2). TestService_LookupByBarcode 3/3 + TestItemHandler_LookupByBarcode 5/5 green; full item package green; backend go build ./... clean. One PRE-EXISTING test failure in internal/jobs package (TestCleanupConfig_RetentionPeriodUsage) confirmed unrelated via git stash reproduction on baseline e3b31e1 before any 65-09 changes — out of scope, logged in phase deferred-items.md.)
Next step: Plan 65-10 (frontend swap — itemsApi.lookupByBarcode stops calling list({search}), starts calling GET /items/by-barcode/{code}; migrate unit tests from mocking itemsApi.list to mocking global.fetch to catch the class of regression that caused G-65-01; revise D-06 in 65-CONTEXT.md)

## Performance Metrics

**Velocity:**

- Total plans completed: 159
- Average duration: ~15 min per plan
- Total execution time: ~37 hours

**By Milestone:**

| Milestone | Phases | Plans | Status |
|-----------|--------|-------|--------|
| v1 | 5 | 14 | Complete |
| v1.1 | 6 | 12 | Complete |
| v1.2 | 6 | 19 | Complete |
| v1.3 | 4 | 22 | Complete |
| v1.4 | 5 | 20 | Complete |
| v1.5 | 3 | 9 | Complete |
| v1.6 | 5 | 9 | Complete |
| v1.7 | 5 | 7 | Complete |
| v1.8 | 3 | 7 | Complete |
| v1.9 | 5 | 9 | Complete |
| v2.0 | 8 | 18 | Complete |
| v2.1 | 8 | 29 | Complete |
| v2.2 | 9 | TBD | Roadmap created |

## v2.2 Phase Overview

| Phase | Name | Reqs | Deps | Status |
|-------|------|------|------|--------|
| 64 | Scanner Foundation & Scan Page | SCAN-01..07 (7) | 63 | Complete (10/10 plans; all SCAN-0N green; bundle gate PASS) |
| 65 | Item Lookup & Not-Found Flow | LOOK-01..03 (3) | 64 | Gap closure in progress (9/11 plans; 65-09 backend GET /items/by-barcode/{code} endpoint shipped; 65-10 frontend swap + 65-11 regression test remain for G-65-01) |
| 66 | Quick-Action Menu | QA-01..03 (3) | 65 | Not started |
| 67 | Mobile FAB with Radial Menu | FAB-01..04 (4) | 63 (parallelizable with 64-66) | Not started |
| 68 | Loan Scan Integration | INT-LOAN-01 (1) | 66 | Not started |
| 69 | Quick Capture Port + Scan Integration | INT-QC-01..04 (4) | 64 | Not started |
| 70 | Taxonomy Cascade Policy | CASC-01 (1) | 58 (independent) | Not started |
| 71 | Stabilization — Docs & Process | STAB-DOCS-01..05 (5) | — (parallel) | Not started |
| 72 | Stabilization — Code & Tests | STAB-CODE-01..04 (4) | — (parallel) | Not started |

**Coverage:** 32/32 v2.2 requirements mapped to exactly one phase (100%).

## Accumulated Context

### Decisions

- v2.0: React Router v7 library mode (not framework mode) -- SPA sufficient, no SSR needed
- v2.0: Lingui v5 for i18n -- compile-time catalogs, EN + ET to start
- v2.0: Fully custom component library -- shadcn/ui fights retro aesthetic
- v2.0: Online-only for this milestone -- reduces 30-40% complexity
- v2.0: HttpError class in api.ts -- callers distinguish HTTP status codes from network failures
- v2.0: AuthContext guards on HttpError 401/403 only -- transient network errors don't clear session
- v2.0: All retro component imports consolidated to @/components/retro barrel
- v2.1: Online-only, lean implementation -- match v2.0 approach, no offline/PWA
- v2.1: TanStack Query for server state -- centralised cache, per-entity mutation hooks with invalidation
- v2.1: react-hook-form + zod via RetroFormField -- standard form substrate before any CRUD
- v2.1: Photos via native FormData + fetch multipart -- no extra upload library
- v2.1: Barcode scanning deferred to v2.2 -- out of scope for this milestone
- v2.1: CI grep guard in frontend2 -- fail on idb/serwist/offline/sync imports
- v2.2: Single-route scan flow -- `/scan` uses overlays, never navigates away mid-scan (iOS PWA camera persistence)
- v2.2: Backend lookup via existing list endpoint -- `GET /api/workspaces/{wsId}/items?search={code}&limit=1` with exact-match guard; no new HTTP route
- v2.2: `@yudiel/react-qr-scanner@2.5.1` + `ios-haptics@^0.1.4` + `uuid@^13.0.0` -- pinned dep additions; scanner WASM manual-chunked in vite.config
- v2.2: FAB uses CSS transitions, not `motion` -- saves ~60 kB gzip and matches retro aesthetic
- v2.2: Scan history in `localStorage` key `hws-scan-history` -- not workspace-scoped; 10-entry cap
- v2.2: LoanForm preselect via URL param `?itemId=` -- URL-driven, deep-linkable, matches legacy pattern
- v2.2: Not-found → create navigates to `/items/new?barcode=<code>` -- not inline dialog (legacy parity; revisit if friction)
- v2.2: External UPC enrichment gated by `/^\d{8,14}$/` -- displayed as opt-in suggestion banner, never auto-written
- v2.2: Cascade policy for taxonomy delete -- "unassign and delete" (un-set FK), no silent cascade
- v2.2: Quick Capture included in v2.2 scope -- INT-QC-01..04 in Phase 69

### Pending Todos

- [ ] (During Phase 64 planning) Confirm `@yudiel/react-qr-scanner@2.5.1` dynamic-import tree-shaking under Vite 8 via `vite build --analyze`
- [ ] (During Phase 64 planning) Decide FAB icons: ASCII glyphs (recommended) vs lucide-react
- [ ] (During Phase 71) Pair-review every backfilled VERIFICATION.md evidence table before sign-off

### Blockers/Concerns

- None blocking — prep items resolve inside phase planning; research synthesis already answers the PROJECT.md prep questions (barcode lookup path, React 19 peerDep, cascade policy).

## Session Continuity

Last session: 2026-04-19T11:48:00.000Z
Stopped at: Phase 65 Plan 09 complete (G-65-01 gap closure Wave 6 backend: dedicated GET /api/workspaces/{wsId}/items/by-barcode/{code} Huma route + Service.LookupByBarcode pass-through, shared.ErrNotFound → ErrItemNotFound normalisation, handler maps sentinel → 404 / opaque → 500 / path-param validator → 400/422, route ordered between /items/search and /items/{id}. TDD 2 RED + 2 GREEN commits per task: bf33f8d, 283a6bf, e3b31e1, 59d4e3d. 3+5 subtests green; full item package + backend build clean. 1 Rule 3 auto-fix — MockService stub pulled from planned Task 2 to Task 1 GREEN to keep ServiceInterface compilation. PRE-EXISTING internal/jobs test failure logged in deferred-items.md — unrelated, confirmed via git stash reproduction.)
Next step: Plan 65-10 (frontend swap: itemsApi.lookupByBarcode → GET /items/by-barcode/{code}; migrate unit tests from mocking itemsApi.list to mocking global.fetch; revise D-06 in 65-CONTEXT.md)

---
*Updated: 2026-04-19 — Phase 65 Plan 09 complete (G-65-01 gap-closure Wave 6 backend endpoint. Added ServiceInterface.LookupByBarcode (+ Service impl pass-through normalising shared.ErrNotFound → ErrItemNotFound like Service.Delete) and GET /api/workspaces/{wsId}/items/by-barcode/{code} Huma route (ordered between /items/search and /items/{id} for literal-before-param chi matching). LookupItemByBarcodeInput path-param validated minLength:1 maxLength:64. TDD per-task RED→GREEN gate: bf33f8d test + 283a6bf feat for service; e3b31e1 test + 59d4e3d feat for handler. TestService_LookupByBarcode 3/3 subtests (match / shared.ErrNotFound normalisation / arbitrary repo error passthrough). TestItemHandler_LookupByBarcode 5/5 subtests (200 happy path / 404 on ErrItemNotFound / 500 on opaque error / 400-422 on oversize code with mockSvc.AssertNotCalled / case-sensitivity guard ABC-123 vs abc-123 distinct service calls). 1 Rule 3 auto-fix: MockService.LookupByBarcode stub pulled from planned Task 2 into Task 1 GREEN because ServiceInterface extension broke MockService compilation across handler_test.go — stub shipped one commit earlier than plan schedule. Full item package go test green; backend go build ./... clean. One PRE-EXISTING internal/jobs test failure (TestCleanupConfig_RetentionPeriodUsage 30-day + 90-day subtests) reproduced on baseline e3b31e1 via git stash — confirmed unrelated to 65-09 and logged in phase deferred-items.md for future stabilization. Plan 65-10 frontend swap now unblocked — backend endpoint exists and is ready for itemsApi.lookupByBarcode to start calling it instead of list({search:code}).)*

*Updated: 2026-04-19 — Phase 65 COMPLETE (Plan 65-08: i18n EN extract + ET gap-fill + [BLOCKING] release gate. bun run i18n:extract pulled 16 new msgids from Plans 65-05/06/07 source into locales/en/messages.po (auto-filled EN msgstr = msgid) + locales/et/messages.po (empty msgstr awaiting fill). EN acceptance greps all pass: SUGGESTIONS AVAILABLE, CREATE ITEM WITH THIS BARCODE, LOOKING UP…, LOOKUP FAILED, NOT FOUND, MATCHED, VIEW ITEM, USE ALL, DISMISS, BRAND each = 1 entry; zod literal "Use letters, numbers, hyphens, or underscores only." NOT extracted (non-lingui-wrapped per repo convention). Starting-point ET table applied verbatim: [USE]→[KASUTA], BRAND→BRÄND, Category hint: {0} — pick manually below.→Kategooria vihje: {0} — vali all käsitsi., Could not reach the server…→Serverit ei õnnestunud tabada…, CREATE ITEM WITH THIS BARCODE→LOO UUS ESE SELLE VÖÖTKOODIGA, DISMISS→SULGE, e.g. DeWalt→nt DeWalt, LOOKING UP…→OTSIN…, LOOKUP FAILED→OTSING EBAÕNNESTUS, MATCHED→VASTE LEITUD, No item in this workspace matches…→Selle vöötkoodiga eset ei leitud selles tööruumis., NOT FOUND→EI LEITUD, SUGGESTIONS AVAILABLE→SOOVITUSED SAADAVAL, USE ALL→KASUTA KÕIK, VIEW ITEM→VAATA ESET. Rule 2 auto-fix: CANCEL msgid was absent from master HEAD b04ae7c et/messages.po (plan assumed Phase 60/57 reuse but git show confirmed otherwise), added TÜHISTA to match form-chrome register (DISCARD→LOOBU etc.). bun run i18n:extract post-fill: ET missing=0. [BLOCKING] release gate all green: bunx vitest run → 99 files / 710 tests / 0 failed, bun run lint:imports OK, bunx tsc -b --noEmit clean, bun run i18n:compile 0 warnings, bun run build ✓ 319ms. Bundle measurements (gzip -c | wc -c): main 135754→114418 B (−21336 B, −15.72% delta — PASS ≤+5120 budget); scanner 58057→58057 B (0 B, byte-identical — PASS ≤0 budget; CLRWiLFx hash unchanged confirms zero drift). Main chunk shrank because Plan 65-07 React.lazy /scan split moved scan-feature application code into new on-demand scan-Dju4dEQ1.js chunk (61.5 kB gzip) + ScanPage-NiCfBQCY.js (5.6 kB gzip); neither loads for non-scan routes. Chunk boundary grep verification passed: main chunk empty for yudiel/zxing-wasm/barcode-detector/webrtc-adapter/zxing, scanner chunk contains zxing, new scan chunk empty for scanner-dep strings — scanner deps stay isolated in scanner-*.js. 65-BUNDLE-BASELINE.md appended with POST-PHASE-65 measurements + delta tables + "## Gate result" / PASS verdict + notes. Commits 66432cd (Task 1 extract), 003c163 (Task 2 ET fill), 3f3f239 (Task 3 gate PASS baseline update). Phase 65 SHIPPABLE — all three LOOK-0N requirements have rendered user paths + automated tests + EN+ET translations + no bundle regression. Phase 66 unblocked.)*

*Updated: 2026-04-19 — Phase 65 Plan 07 complete (Phase 65 → ScanPage integration wiring. (1) /items/new route registered in frontend2/src/routes/index.tsx between `items` and `items/:id` — eager import (not React.lazy), literal-before-param React Router convention. (2) ScanPage.tsx: `void lookup;` Phase 64 placeholder removed; match-effect `useEffect(() => { if (lookup.status === "success" && lookup.match) { const effectiveCode = lookup.match.barcode ?? banner?.code ?? ""; if (effectiveCode) { history.update(effectiveCode, { entityType: "item", entityId: lookup.match.id, entityName: lookup.match.name }); } } }, [lookup.status, lookup.match, banner?.code, history.update])` — D-22 race guard fires ONLY on success+match (updateScanHistory is noop-if-missing so stale resolves for de-duped codes silently discard). Deps array uses `history.update` (useCallback-stable empty-deps wrap from Plan 65-04 Task 3) NOT `history` (would re-fire every render because React returns a fresh return-object per hook call and TanStack returns a fresh lookup object per render). (3) Widened ScanResultBanner callsite threads lookupStatus={lookup.status} + match={lookup.match} + onViewItem={handleViewItem} + onCreateWithBarcode={handleCreateWithBarcode} + onRetry={handleLookupRetry} alongside existing code/format/timestamp/onScanAgain. Three new useCallback handlers: handleViewItem navigates to /items/:id, handleCreateWithBarcode navigates to /items/new?barcode=encodeURIComponent(code) (T-65-07-01 XSS mitigation layered with ItemFormPage zod schema on inbound), handleLookupRetry calls lookup.refetch(). handleLookupRetry is name-distinct from Phase 64's existing handleRetry (which clears errorKind + bumps scannerKey for scanner-polyfill retry) — two retry callbacks co-exist by design; acceptance grep asserts both present. (4) useScanLookup(banner?.code ?? null) callsite preserved VERBATIM per Phase 64 D-18 + Test 15 gate. 3 new real it() in ScanPage.test.tsx — Test 16 configures useScanLookup to resolve with a match Item fixture, asserts `updateScanHistory` spy called with ("X", { entityType:"item", entityId:"item-42", entityName:"Drill" }); Test 17 configures success+match:null, waits for NOT FOUND heading then microtask tick, asserts spy NEVER called; Test 18 configures status:error, waits for LOOKUP FAILED heading then tick, asserts spy NEVER called. Spy installed by extending existing @/lib/scanner mock factory with `updateScanHistory: vi.fn()` — useScanHistory.update routes through this module function, so spying at the module boundary intercepts every effect-driven backfill; existing Phase 64 tests keep lookup in the default `idle` stub via useScanLookup mock so the effect never fires and the spy records zero calls by default. 1 Rule 3 Blocking auto-fix: frontend2/src/features/scan/__tests__/fixtures.ts layered MemoryRouter (via React.createElement so the file stays .ts and no test import-path edits required) around the shared taxonomy renderWithProviders — ScanPage's new useNavigate() broke 13 of 14 existing Phase 64 ScanPage tests with "useNavigate() may be used only in the context of a <Router> component" before the fix. The shared taxonomy fixture (40+ consumer test files across settings/borrowers/loans/etc.) is unchanged. Full vitest 710 passed / 0 todos / 0 failed (was 707 — +3 from Tests 16/17/18); typecheck + lint:imports + build clean. Commits de6011c (feat Task 1 route), 012e672 (feat Task 2 match-effect + banner callsite + handleLookupRetry — single atomic commit because Plan 65-07 Task 2's <behavior> field explicitly defers testing to Task 3), 27451ba (test Task 3 16/17/18). Zero scope creep — the single deviation is a mechanical test-harness contract adjustment localized to scan-feature fixtures.)*

*Updated: 2026-04-19 — Phase 65 Plan 06 complete (ScanResultBanner widened in place from Phase 64 single SCANNED state to Phase 65 four mutually-exclusive states LOADING / MATCH / NOT-FOUND / ERROR — D-17..D-21; prop surface gains lookupStatus: ScanLookupStatus + match: Item | null + onViewItem?(itemId: string) + onCreateWithBarcode?(code: string) + onRetry?; LOADING renders a dimmed code echo plus ▍ blinking cursor with retro-cursor-blink className; MATCH renders NAME + match.short_code rows + VIEW ITEM button; NOT-FOUND renders yellow HazardStripe + helper line + CREATE ITEM WITH THIS BARCODE; ERROR renders red HazardStripe + remediation body + RETRY + CREATE ITEM fallback; SCAN AGAIN rendered and interactive in every state (T-65-06-04); single variant derivation ternary chain = structural dual-state-render guard (T-65-06-03); React JSX auto-escapes match.name / match.short_code / code for T-65-06-01 XSS mitigation. @keyframes retro-cursor-blink (1 Hz step-end) + .retro-cursor-blink class + @media (prefers-reduced-motion: reduce) { animation: none; opacity: 1; } guard appended to globals.css for T-65-06-02 motion-sickness mitigation; manual browser runtime verification row already present in 65-VALIDATION.md §Manual-Only Verifications. 21 new real it() green in ScanResultBanner.states.test.tsx (5 LOADING + 5 MATCH + 5 NOT-FOUND + 5 ERROR + 1 dual-state absence sweep T-65-06-03); 7 Phase 64 assertions re-homed under MATCH state describe in ScanResultBanner.test.tsx (SCANNED → MATCHED heading; CODE row now asserts match.short_code; Test 6 inverted to stripe-absence). 2 Rule 3 auto-fixes kept the plan's own typecheck + vitest gates green: (1) ScanPage.tsx callsite interim lookupStatus='idle' + match=null until Plan 65-07 wires real useScanLookup (falls through to LOADING variant in deriveVariant); (2) ScanPage.test.tsx /SCANNED/i → /LOOKING UP/i regex migration (11 replacements). Full vitest suite 707 passed / 0 todos / 0 failed (was 679 / 20 todos); typecheck + lint:imports + build clean. Cumulative 81/78 Wave-0 todos converted to date across Plans 65-02..06.*

*Updated: 2026-04-19 — Phase 65 Plan 05 complete (LOOK-02 + LOOK-03 render surface: ItemForm FormProvider wrap + BRAND RetroFormField D-23 + optional beforeForm slot for sibling banner access; UpcSuggestionBanner feature-local banner with per-field [USE] + USE ALL + DISMISS writing setValue("brand", ..., { shouldDirty: true }) directly — no description concatenation workaround; ItemFormPage /items/new page with ?barcode= URL prefill + generateSku once per mount + dirty-guard RetroConfirmDialog + scanKeys.lookup(barcode) + itemKeys.all dual invalidation on create success (D-04 Pitfall #7 closure); 32 new real it() — 60/78 cumulative Wave-0 todos converted; full suite 686 passed / 20 todos / 0 failed; typecheck + lint:imports clean; 1 Rule 3 auto-fix: added optional beforeForm?: ReactNode slot to ItemForm reconciling plan's Task 1 FormProvider-inside-ItemForm with Task 3's banner-as-sibling intent).*
*Updated: 2026-04-19 — Phase 65 Plan 04 complete (useScanLookup body swap to real TanStack Query against itemsApi.lookupByBarcode; ScanLookupResult shape preserved per Phase 64 D-18; updateScanHistory module fn + useScanHistory.update useCallback-wrapped for D-22 race guard; 8 + 3 + 5 = 16 new real it() cases green; ScanPage Test 15 callsite gate preserved; 3 tasks TDD RED+GREEN atomic commits).*
*Updated: 2026-04-19 — Phase 65 Plan 02 complete (itemsApi.lookupByBarcode w/ D-06/D-07/D-08 guards + D-23 optional brand field + D-24 barcode regex loosened for hyphens/underscores; 10 Wave 0 todos converted green; cumulative 28/78 todos real; full suite 640 passed / 50 todos).*
*Updated: 2026-04-19 — Phase 65 Plan 03 complete (barcodeApi + barcodeKeys + useBarcodeEnrichment with /^d{8,14}$/ gate + silent-failure; 18 Wave 0 todos converted green; full suite 640 passed / 50 todos).*
*Updated: 2026-04-19 — Phase 65 Plan 01 complete (7 Wave 0 scaffolds + 78 it.todo + shared QueryClient helper + bundle baseline main 135754 B / scanner 58057 B @ b04ae7c).*
*Updated: 2026-04-18 — Phase 64 COMPLETE (10/10 plans; bundle gate PASS; EN+ET catalogs filled; all SCAN-0N requirements shippable)*
