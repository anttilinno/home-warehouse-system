---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: Premium-Terminal Frontend
status: planning
last_updated: "2026-04-30T20:07:55.345Z"
last_activity: 2026-04-30
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State: Home Warehouse System

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-18)

**Core value:** Reliable inventory access anywhere -- online or offline -- with seamless sync
**Current focus:** v3.0 Premium-Terminal Frontend — frontend2 redesign rebuild

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-04-30 — Milestone v3.0 started

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
| v2.2 | 9 | partial | Abandoned (frontend2 wiped before completion; phases 65–66 obsolete) |
| v3.0 | TBD | TBD | Planning |

## v2.2 Phase Overview (abandoned — kept for archaeology)

| Phase | Name | Reqs | Deps | Status |
|-------|------|------|------|--------|
| 64 | Scanner Foundation & Scan Page | SCAN-01..07 (7) | 63 | Complete (10/10 plans; all SCAN-0N green; bundle gate PASS) |
| 65 | Item Lookup & Not-Found Flow | LOOK-01..03 (3) | 64 | Complete (11/11 plans; G-65-01 closed with Option C regression guards — Playwright E2E + Go HTTP+Postgres integration tests; matched coverage at both reverted layers) |
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

Last session: 2026-04-30
Stopped at: v3.0 milestone initialized; planning research → requirements → roadmap
Next step: Run domain/stack/architecture/pitfalls research, then define requirements and roadmap.

---
*Updated: 2026-04-19 — Phase 65 COMPLETE (Plan 65-11: G-65-01 regression guard, Option C both branches). **Branch A — Playwright E2E (5e77f98):** first Playwright surface in the repo. frontend2/e2e/scan-lookup.spec.ts logs in via real /login (cookies set for both page + request contexts), seeds item with unique per-run barcode (`E2E-${Date.now()}`) via cookie-authenticated `page.request.post("/api/workspaces/{wsId}/items", ...)`, navigates /scan → MANUAL tab → types code → clicks LOOK UP CODE → asserts MATCHED banner (locale-agnostic `/matched|vaste leitud/i`) + seeded item name; finally cleanup best-effort. frontend2/playwright.config.ts: chromium + firefox projects, no webServer (expects dev stack running per CLAUDE.md runbook). frontend2/package.json: @playwright/test devDep + test:e2e + test:e2e:headed scripts. frontend2/vitest.config.ts excludes **/e2e/** (Playwright's test.describe API differs from Vitest's, would collide). frontend2/.gitignore: test-results/ + playwright-report/ + playwright/.cache/. Verified green on chromium and firefox against the running dev stack. **Branch B — Go HTTP+Postgres integration test (8d4191d):** first Go integration-test surface at backend/internal/domain/warehouse/item/handler_integration_test.go under //go:build integration. Real item.NewService + real postgres.NewItemRepository wired to a chi+humachi test router that injects workspace/user context exactly like appMiddleware.GetWorkspaceID/GetUser do in production. Uses the existing backend/tests/testdb harness (SetupTestDB with TEST_DATABASE_URL default `postgresql://wh:wh@localhost:5432/warehouse_test`, fixture user+workspace, CleanupTestDB via t.Cleanup) rather than creating the parallel backend/internal/testutil/integration.go that Plan 65-11's Task 1 step B.1 suggested — classified as 1 Rule 3 Blocking auto-fix because creating parallel plumbing would have fragmented integration-test conventions against an already-sufficient harness. Three subtests: (1) 200 happy path on seeded unique barcode returns the item with barcode + workspace_id + name matching; (2) 404 for a guaranteed-unique `NEVER-EXISTED-{uuid}` code; (3) **404 cross-tenant leak guard** — seeds a barcode in `otherWorkspaceID` and queries from OUR workspace's router, asserts NotFound because the real SQL `WHERE barcode = $2 AND workspace_id = $1` clause is the source of truth; the handler unit test in handler_test.go cannot assert this because with a mocked ServiceInterface "other workspace" and "never existed" are indistinguishable (both return ErrItemNotFound). Verified green: 3/3 subtests PASS in 0.21s with TEST_DATABASE_URL=postgresql://wh:wh@localhost:5432/warehouse_test. **Coverage matrix:** Branch A catches both backend reverts (Plan 65-09) AND frontend reverts (Plan 65-10) — banner renders NOT FOUND under either; Branch B catches backend reverts AND specifically the workspace_id WHERE clause (cross-tenant leak guard). Together they form a matched pair of regression guards — any single-layer regression of G-65-01's two-layer fix fails at least one test. **CLAUDE.md (new project-root, auto-loaded by Claude Code as project instructions):** §E2E Tests section documents the Playwright runbook (start Postgres / backend / frontend dev; seeder creds E2E_USER=seeder@test.local + E2E_PASS=password123 overridable via env; `cd frontend2 && bun run test:e2e` or test:e2e:headed), how to add a new spec, and the auth contract (the /login form has two buttons with "LOG IN" text — the submit-type button is distinguished by `^LOG IN$` exact match; after login access_token cookie is set and inherited by both page context and page.request). §Backend Integration Tests section documents `-tags=integration` + TEST_DATABASE_URL + Postgres prereq and notes frontend-side reverts are NOT caught at this layer. **Two-commit split (not squashed):** 5e77f98 (feat Branch A) + 8d4191d (test Branch B) because artifacts have zero file overlap (bun/Playwright vs go/pgx) — future git archaeology stays cleaner with the stacks separated. **Non-integration default lanes still green:** backend `go test ./...` (no integration tag) zero-failures; frontend `bunx vitest run` with e2e/ excluded 712/712. **Phase 65 SHIPPABLE:** all 11 plans (01-10 original scope + 09-11 gap closure) shipped; LOOK-01/02/03 all have rendered user paths + unit tests + regression guards at the correct layers + EN+ET translations + zero bundle regression (main gzip 114418 B, scanner gzip 58057 B at CLRWiLFx hash) + G-65-01 closed end-to-end. Phase 66 Quick-Action Menu now unblocked.)*

*Updated: 2026-04-19 — Phase 65 Plan 10 complete (G-65-01 gap-closure Wave 7 frontend swap. itemsApi.lookupByBarcode in frontend2/src/lib/api/items.ts body swapped from list(wsId, {search: code, limit: 1}) wrap to direct get<Item>(`${base(wsId)}/by-barcode/${encodeURIComponent(code)}`) with try/catch mapping HttpError status=404 → null and propagating other errors. HttpError now imported from @/lib/api alongside get/post/patch/del. D-07 case-sensitive barcode guard + D-08 workspace-mismatch structured-console.error({kind: "scan-workspace-mismatch"}) guard retained as defense-in-depth — backend is now authoritative via Postgres WHERE barcode=$2 AND workspace_id=$1 but the frontend guards are cheap and catch cache/proxy/future-regression anomalies. useScanLookup hook + ScanPage callsite + 4-state banner state machine (D-17..D-21) all unchanged — Phase 64 D-18 ScanLookupResult contract byte-identical. Test suite REWRITTEN (not migrated): the 6 itemsApi.list-mocked tests were discarded with intent because their mock layer is precisely what hid G-65-01 in production; the 8 new tests mock global.fetch (mirrors the canonical pattern from itemPhotos.test.ts + barcode.test.ts) and cover smoke (itemsApi barrel siblings), URL shape (/api/workspaces/ws-1/items/by-barcode/5449000000996, NOT /items?search=), encodeURIComponent defense (AB/CD 12 → AB%2FCD%2012), 200 happy path returns Item, 404 HttpError → null (preserves useScanLookup not-found contract), D-07 case-sensitivity guard (stale.barcode:"abc-123" ≠ code:"ABC-123" → null), D-08 workspace-mismatch guard + structured-log assertion, 500 HttpError propagation with .rejects.toMatchObject({name:"HttpError", status:500}) (so D-21 ERROR banner fires). D-07 test has a comment noting GTIN-14 canonicalization would require revisiting the guard. 65-CONTEXT.md D-06 revised with ORIGINAL (2026-04-18) + Revised (2026-04-19, Plan 65-10 / gap G-65-01) annotation pair citing backend/db/migrations/001_initial_schema.sql:495-500 FTS search_vector barcode exclusion + 65-HUMAN-UAT.md Test 4/5 + 65-VERIFICATION.md G-65-01 evidence. REQUIREMENTS.md:94 "No new backend barcode-lookup HTTP endpoint" out-of-scope entry revised with ORIGINAL (2026-04-18) + REVISED (2026-04-19, G-65-01) annotation pair; the original "No new endpoint needed" text is preserved inside the ORIGINAL annotation per the auditable-history pattern. TDD gate for Task 1: e5227d1 test(65-10): RED — rewrite itemsApi.lookupByBarcode tests to mock global.fetch (6 of 8 tests fail against old list-wrap impl; 2 pass incidentally), fbb2907 feat(65-10): GREEN — swap itemsApi.lookupByBarcode to dedicated /items/by-barcode/{code} endpoint (closes G-65-01) (all 8 pass). Task 2: 288497d docs(65-10): revise D-06 after G-65-01. Task 3: 192000f docs(65-10): revise REQUIREMENTS.md:94 after G-65-01. Full vitest suite 712 passed / 0 failed / 0 todos (= 710 Phase 65 baseline − 6 discarded + 8 new — EXACT match to plan done criteria); useScanLookup test suite 18/18 still green (insulated by mocking itemsApi.lookupByBarcode directly not internals — proves body swap is contract-preserving). Typecheck clean, lint:imports OK, build ✓ 316ms. Bundle ZERO regression: main chunk gzip 114418 B byte-identical to Phase 65 baseline (hash changed ChvbQJeu → nmHRivvj because body text changed but gzip size unchanged); scanner chunk gzip 58057 B at UNCHANGED hash CLRWiLFx. Zero deviations — plan executed exactly as written; no Rule 1/2/3 auto-fixes, no Rule 4 checkpoint. Plan 65-11 regression test now unblocked — the helper calls the real backend endpoint so an integration test (Option A Playwright or Option B Go HTTP integration) can exercise the full stack and catch any future URL-contract drift.)*

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
