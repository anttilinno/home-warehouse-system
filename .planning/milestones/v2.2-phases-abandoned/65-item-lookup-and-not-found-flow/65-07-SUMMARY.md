---
phase: 65-item-lookup-and-not-found-flow
plan: 07
subsystem: ui
tags: [scan, scan-page, route, wiring, match-effect, use-callback-identity, race-guard, d-22, integration, react-router, tdd]

requires:
  - phase: 65-item-lookup-and-not-found-flow
    provides: "Plan 65-04 — useScanLookup real body + useScanHistory.update (useCallback-stable, empty deps); Plan 65-05 — ItemFormPage (/items/new) component; Plan 65-06 — ScanResultBanner four-state widened prop surface + interim ScanPage callsite (lookupStatus='idle' / match=null)"
  - phase: 64-scanner-foundation-scan-page
    provides: "ScanPage orchestration shell + D-01 callsite lock (useScanLookup(banner?.code ?? null)) + ScanPage.test.tsx Test 15 gate + Phase 64 handleRetry (scanner-polyfill retry)"
provides:
  - "/items/new route registered between items and items/:id in routes/index.tsx (literal-before-param convention; eager import, not React.lazy — stays within ≤3 kB main-chunk budget)"
  - "ScanPage match-effect (D-22 race guard): useEffect that calls history.update(effectiveCode, { entityType: 'item', entityId, entityName }) ONLY when lookup.status === 'success' && lookup.match. Deps array: [lookup.status, lookup.match, banner?.code, history.update] — NOT [... history] (would re-fire every render)"
  - "ScanPage banner callsite widened to pass real props: lookupStatus={lookup.status}, match={lookup.match}, onViewItem, onCreateWithBarcode, onRetry. The useScanLookup callsite itself (banner?.code ?? null) is unchanged per Phase 64 D-18 + Test 15 gate"
  - "handleLookupRetry callback (distinct name from Phase 64 handleRetry) wires the banner's ERROR state RETRY button to lookup.refetch(). Both callbacks co-exist"
  - "void lookup; placeholder removed"
  - "3 new real it() green in ScanPage.test.tsx: Test 16 (match → history.update called), Test 17 (not-found → NEVER called), Test 18 (error → NEVER called). Test 15 preserved verbatim"
affects: ["65-08"]

tech-stack:
  added: []
  patterns:
    - "In-effect race guard via status+match gate: a useEffect that fires ONLY on success+match (not on not-found or error) naturally discards stale resolves because useScanHistory.update is noop-if-missing (Plan 65-04). Downstream code does not need to guard again"
    - "useCallback-stable deps for effect consumers: when an effect depends on a hook method, the dep MUST be the method reference (history.update) not the hook-return object (history). The hook returns a fresh object each render — depending on the whole object re-fires every render and defeats any gate the effect contains"
    - "Name-distinct co-existence of related callbacks: two retry callbacks with DIFFERENT scopes (scanner polyfill vs. lookup query) live side-by-side as handleRetry + handleLookupRetry. Pattern-scanner tooling matches both via distinct names rather than semantic merging"

key-files:
  created: []
  modified:
    - "frontend2/src/routes/index.tsx — +2 lines: ItemFormPage import + <Route path=\"items/new\" /> between items and items/:id"
    - "frontend2/src/features/scan/ScanPage.tsx — +~66 lines net: useEffect + useNavigate imports; navigate() instance; match-effect with D-22 comment block; handleViewItem + handleCreateWithBarcode + handleLookupRetry callbacks; widened ScanResultBanner callsite threading lookupStatus/match/onViewItem/onCreateWithBarcode/onRetry; void lookup placeholder removed"
    - "frontend2/src/features/scan/__tests__/fixtures.ts — layered MemoryRouter around the shared taxonomy renderWithProviders so ScanPage's new useNavigate() call has router context; uses createElement (no JSX) to keep the file .ts (no test import-path churn)"
    - "frontend2/src/features/scan/__tests__/ScanPage.test.tsx — spy extended to @/lib/scanner.updateScanHistory; new describe block \"ScanPage match-effect (D-22) — Phase 65\" with Test 16/17/18; Test 15 preserved verbatim"

key-decisions:
  - "useNavigate() on ScanPage triggered a shared-fixture Router regression (13 of 14 Phase 64 tests failed with 'useNavigate() may be used only in the context of a <Router> component')."
  - "Rule 3 Blocking auto-fix: layered MemoryRouter only inside the scan-feature fixtures (createElement form so the file stays .ts), NOT the shared taxonomy fixture. Scope containment: 40+ unrelated consumers of renderWithProviders are unaffected."
  - "Match-effect deps array is EXACTLY [lookup.status, lookup.match, banner?.code, history.update] — NOT the shorter [lookup, history]. Decomposing into primitives+callback identity defeats React's Object.is dep comparison that would re-fire every render when TanStack returns a fresh lookup object or useScanHistory returns a fresh return-value."
  - "In Test 17/18, the assertion pattern is 'await findByRole(heading matching NOT FOUND / LOOKUP FAILED) → tick once via new Promise(r => setTimeout(r, 0)) → expect(updateSpy).not.toHaveBeenCalled()'. This waits for the banner render AND a microtask flush so the effect has had a chance to decline to fire; we don't test the absence of a side-effect via a trivially-passing no-op."

patterns-established:
  - "Scan-feature fixture composition: feature-local renderWithProviders wraps shared provider helpers in MemoryRouter without modifying the shared helper. Uses createElement to avoid the .ts → .tsx rename cost (and the test-import-path churn it would cause)."
  - "Phase 65 D-22 race-guard idiom: useEffect gate on lookup.status === 'success' && lookup.match, effectiveCode fallback to match.barcode ?? banner?.code ?? '', deps array keyed on primitives + useCallback-stable method identity. Copyable to any future feature wiring post-query side-effects from a useScanLookup-like hook."
  - "Test co-existence of two retry paths: existing handleRetry kept VERBATIM; new handleLookupRetry named distinctly; acceptance criteria grep asserts both. Prevents future refactors from silently merging them."

requirements-completed: [LOOK-01, LOOK-02]

# Metrics
duration: 6min
completed: 2026-04-19
---

# Phase 65 Plan 07: Phase 65 → ScanPage Integration Wiring Summary

**Phase 65 wiring wave — `/items/new` route registered; ScanPage match-effect calls history.update ONLY on success+match with `[lookup.status, lookup.match, banner?.code, history.update]` deps (NOT `[history]`); banner callsite widened to thread real lookup state; handleLookupRetry co-exists with the Phase 64 handleRetry; Phase 64 Test 15 preserved verbatim; 3 new it() green (16/17/18) for D-22 race guard.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-04-19T10:11:14Z
- **Completed:** 2026-04-19T10:17:06Z
- **Tasks:** 3 / 3
- **Files modified:** 4

## Accomplishments

- **Task 1 — /items/new route.** 2-line addition to `frontend2/src/routes/index.tsx`: `import { ItemFormPage }` + `<Route path="items/new" element={<ItemFormPage />} />` placed literally between `items` and `items/:id` per the React Router literal-before-param project idiom (matches `borrowers` / `borrowers/:id` at lines 105-106). Eager import (not React.lazy) because ItemFormPage reuses already-bundled ItemForm + RetroConfirmDialog — stays within the ≤3 kB main-chunk budget.
- **Task 2 — ScanPage match-effect + widened banner callsite + handleLookupRetry.** Six mechanical sub-steps in ScanPage.tsx: (A) extend React import with `useEffect`; (B) add `import { useNavigate }` from react-router; (C) remove `void lookup;` placeholder + update the D-01 MANDATORY callsite-lock comment block to reflect that Phase 65 now consumes the hook; (D) instantiate `navigate = useNavigate()`; (E) add the D-22 match-effect with deps `[lookup.status, lookup.match, banner?.code, history.update]` (NOT `[..., history]`) + explicit comment block documenting the race-guard invariant and the deps-stability rationale; (F) add `handleViewItem` / `handleCreateWithBarcode` / `handleLookupRetry` callbacks (handleLookupRetry distinct from Phase 64 handleRetry — two retry paths co-exist); (G) widen `<ScanResultBanner>` callsite to thread lookupStatus / match / onViewItem / onCreateWithBarcode / onRetry alongside existing code / format / timestamp / onScanAgain. The `useScanLookup(banner?.code ?? null)` callsite stays VERBATIM per Phase 64 D-18 + Test 15 gate.
- **Task 3 — ScanPage.test.tsx Test 16/17/18.** New describe block `"ScanPage match-effect (D-22) — Phase 65"` with 3 real `it()` cases. Test 16 configures `useScanLookup` to return `{ status: "success", match: Item }`, asserts spy-on-`updateScanHistory` received `("X", { entityType: "item", entityId: "item-42", entityName: "Drill" })` exactly. Test 17 configures `{ status: "success", match: null }`, waits for NOT FOUND heading + tick, asserts spy NEVER called. Test 18 configures `{ status: "error", error, match: null }`, waits for LOOKUP FAILED heading + tick, asserts spy NEVER called. Test 15 preserved verbatim. Spy installed via extending the existing `@/lib/scanner` mock with `updateScanHistory: vi.fn()` — useScanHistory.update routes through the module function, so spying at that boundary intercepts every effect-driven backfill; existing Phase 64 tests keep lookup in the default `idle` stub so the effect never fires and the spy records zero calls.

## Output Spec (verbatim — from Plan Task <output> block)

### Final name of the retry callback (handleLookupRetry) + proof handleRetry co-exists

Both callbacks present in `frontend2/src/features/scan/ScanPage.tsx`:

- `const handleLookupRetry = useCallback(() => { lookup.refetch(); }, [lookup]);` (NEW Phase 65 — line 172-174)
- `const handleRetry = useCallback(() => { setErrorKind(null); setScannerKey((k) => k + 1); }, []);` (EXISTING Phase 64 — line 188-191)

Grep proof:
```bash
$ rg -c "const handleLookupRetry = useCallback" frontend2/src/features/scan/ScanPage.tsx
1
$ rg -c "const handleRetry = useCallback" frontend2/src/features/scan/ScanPage.tsx
1
```

### Match-effect deps array — literal line

```ts
}, [lookup.status, lookup.match, banner?.code, history.update]);
```

(ScanPage.tsx line 112 — copied verbatim from the source file.)

Grep proof:
```bash
$ rg -c "\[lookup\.status, lookup\.match, banner\?\.code, history\.update\]" frontend2/src/features/scan/ScanPage.tsx
1
```

### useScanHistory.update is useCallback-wrapped (Plan 65-04 Task 3) — literal line

```ts
const update = useCallback(
  (
    code: string,
    patch: Partial<Pick<ScanHistoryEntry, "entityType" | "entityId" | "entityName">>,
  ) => {
    updateScanHistory(code, patch);
    setEntries(getScanHistory());
  },
  [],
);
```

(useScanHistory.ts lines 40-49 — copied verbatim from source.)

Grep proof:
```bash
$ rg -c "const update = useCallback" frontend2/src/features/scan/hooks/useScanHistory.ts
1
```

### Phase 65 strings wired via t`...` in ScanPage.tsx (for Plan 65-08 extract)

ScanPage.tsx contains these `t\`...\`` strings — all from Phase 64, none added in Plan 65-07:

- `t\`SCAN\`` (heading at line 217)
- `t\`SCAN\`` (RetroTabs label at line 222)
- `t\`MANUAL\`` (RetroTabs label at line 223)
- `t\`HISTORY\`` (RetroTabs label at line 224)

Plan 65-07 adds ZERO new t`...` strings to ScanPage.tsx — all new UI strings (LOOKING UP, MATCHED, NOT FOUND, LOOKUP FAILED, NAME, CODE, FORMAT, VIEW ITEM, RETRY, CREATE ITEM WITH THIS BARCODE, SCAN AGAIN, No item in this workspace matches this barcode., Could not reach the server. Check your connection and retry, or create a new item with this barcode.) live in `frontend2/src/components/scan/ScanResultBanner.tsx` (Plan 65-06) — Plan 65-08's `extract` run picks them up there.

### Exact diff line count for ScanPage.tsx

```bash
$ git diff de6011c~1 HEAD -- frontend2/src/features/scan/ScanPage.tsx | grep -c "^[+-]"
83
```

(Net: +66 lines from Plan 65-07's Task 2; the diff count of 83 includes both `+` and `-` lines — 66 additions net after subtracting the `void lookup;` line + the old interim-props callsite.)

### Test 15 assertion line unchanged (copied verbatim)

```ts
it("ScanPage invokes useScanLookup(null) pre-decode and useScanLookup(code) post-decode", async () => {
```

(ScanPage.test.tsx line 384 — copied verbatim; Plan 65-07 did NOT modify this test in any way.)

## Task Commits

1. **Task 1: Register /items/new route** — `de6011c` (feat)
2. **Task 2: Wire ScanPage match-effect + widen banner callsite + handleLookupRetry** — `012e672` (feat — single atomic commit; per Plan 65-07 Task 2 the `<behavior>` field explicitly says "Tested via Task 3's ScanPage.test.tsx extensions", so no separate RED/GREEN split)
3. **Task 3: Add Test 16/17/18 for D-22 match-effect race guard** — `27451ba` (test)

**Plan metadata (will be added with this SUMMARY):** `{pending}` (docs: complete 65-07 plan)

## Files Created/Modified

### Modified (4)

- `frontend2/src/routes/index.tsx` — +2 lines. ItemFormPage imported alongside ItemsListPage + ItemDetailPage; new `<Route path="items/new" element={<ItemFormPage />} />` between existing items and items/:id routes. Source-order verified (items:108 → items/new:109 → items/:id:110 — literal before param).
- `frontend2/src/features/scan/ScanPage.tsx` — +66 net lines. Details in Accomplishments Task 2 above.
- `frontend2/src/features/scan/__tests__/fixtures.ts` — feature-local `renderWithProviders` layers MemoryRouter (via `createElement` so the file stays `.ts`) around the shared taxonomy providers. Existing scan tests (ScanHistoryList + ScanPage) continue to import `{ renderWithProviders, setupDialogMocks }` from `./fixtures` with zero test-file edits required.
- `frontend2/src/features/scan/__tests__/ScanPage.test.tsx` — +112 lines. Extended `@/lib/scanner` mock to add `updateScanHistory: vi.fn()` spy; appended a new `describe("ScanPage match-effect (D-22) — Phase 65", ...)` block after the existing "useScanLookup callsite lock" describe. Three `it()` cases: Test 16 (match → update called with entityType:'item', entityId, entityName), Test 17 (not-found → NEVER called), Test 18 (error → NEVER called). Test 15 preserved VERBATIM.

## Decisions Made

- **Router context must flow to ScanPage for useNavigate().** The shared `renderWithProviders` in taxonomy fixtures intentionally does NOT wrap in a Router (40+ consumer tests across settings / borrowers / loans / etc. would inherit an unnecessary Router context otherwise). Instead, the scan-feature fixture layers MemoryRouter locally. `createElement` form keeps the file `.ts` — no test imports need updating.
- **Match-effect dep array decomposed into primitives + method identity.** `[lookup.status, lookup.match, banner?.code, history.update]` — NOT `[lookup, history]`. React uses `Object.is` on dep equality; TanStack Query returns a fresh lookup object every render (new shape identity) and the hook returns a fresh `{ entries, add, update, remove, clear }` object every render. Using primitives + the useCallback-stable method reference makes the effect re-run ONLY on the meaningful transitions (idle→loading→success(+match)→... ). This invariant is documented inline in ScanPage.tsx (DEPS NOTE comment block, lines 96-100).
- **handleLookupRetry is named distinctly from handleRetry, not merged.** Phase 64 `handleRetry` retries the scanner polyfill (clears errorKind + bumps scannerKey to remount BarcodeScanner). Phase 65 `handleLookupRetry` retries the TanStack Query via `lookup.refetch()`. Merging them would lose observability in pattern-scanner tooling and conflate two orthogonal failure domains. The `<interfaces>` block in Plan 65-07 explicitly calls out both.
- **Tests 17/18 assert absence of side-effect AFTER the banner renders.** Pattern: `await findByRole(heading) → new Promise(r => setTimeout(r, 0)) → expect(spy).not.toHaveBeenCalled()`. The `findByRole` waits for the banner to actually render (i.e. the match-effect has had a chance to fire), and the `setTimeout(0)` flushes the microtask queue to guarantee effect scheduling completed. Without this pattern, `.not.toHaveBeenCalled()` could trivially pass just because the render hadn't happened yet.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] ScanPage.test.tsx Router-context regression**
- **Found during:** Task 2 (widened ScanPage with useNavigate)
- **Issue:** Adding `const navigate = useNavigate();` to ScanPage.tsx broke 13 of 14 existing Phase 64 ScanPage tests with `Error: useNavigate() may be used only in the context of a <Router> component`. The shared `renderWithProviders` in `@/features/taxonomy/__tests__/fixtures.tsx` does NOT wrap in a Router (by design — 40+ unrelated consumers).
- **Fix:** Added a scan-feature-local `renderWithProviders` to `frontend2/src/features/scan/__tests__/fixtures.ts` that layers MemoryRouter OUTSIDE the taxonomy providers via `createElement` (keeping the file `.ts` so existing test import paths stay valid). The taxonomy fixture is unchanged — only scan-feature tests get the Router.
- **Files modified:** `frontend2/src/features/scan/__tests__/fixtures.ts`
- **Verification:** All 5 scan test files (49/49 tests) green; typecheck clean; full suite 710/710 passed.
- **Committed in:** `012e672` (part of the Task 2 feat commit — inseparable; the test fix is required for the Task 2 acceptance criteria `pnpm test:run exit 0` to hold).

---

**Total deviations:** 1 auto-fixed (Rule 3 — Blocking test-harness regression from the new `useNavigate()` usage).
**Impact on plan:** Zero scope creep. The fix is localized to the scan-feature test fixtures; ScanPage itself implements the plan exactly as specified. No other feature's tests are touched.

## Issues Encountered

- **READ-BEFORE-EDIT harness re-reminders fired 6 times** during Task 2 + Task 3 edits. Files were Read earlier in the session (ScanPage.tsx, routes/index.tsx, ScanPage.test.tsx, fixtures.ts) but the harness re-reminded on each successive Edit/Write. All operations succeeded per tool confirmations; no actual state drift or lost edits.
- **Build output chunk-naming differs from Plan 65-04 baseline.** Plan 65-04 recorded main 135754 B / scanner 58057 B (gzip) at commit `b04ae7c`. Current build at commit `27451ba` reports `index-DLbD6CtT.js 115.29 kB gzip` as the main chunk and `scanner-CLRWiLFx.js 58.88 kB gzip` — the rolldown tooling split the bundle differently (dedicated `ScanPage-*.js 5.56 kB`, `scan-*.js 62.29 kB`). Bundle-gate enforcement is Plan 65-08's scope; Plan 65-07 only verifies `bun run build` exits 0 (it does).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Plan 65-08 ready (i18n extract + bundle gate):** with Plan 65-07 wiring complete, the ScanResultBanner's t`...` strings are live-rendered when ScanPage's lookup hook drives it. Plan 65-08's `extract` run will pick up the new strings (LOOKING UP, MATCHED, NOT FOUND, LOOKUP FAILED, NAME, CODE, FORMAT, VIEW ITEM, RETRY, CREATE ITEM WITH THIS BARCODE, NOT-FOUND body, ERROR body) and the bundle gate can measure the final post-integration delta.
- **Phase 66 unblocked:** LOOK-01 (MATCH → VIEW ITEM → /items/:id) and LOOK-02 (NOT-FOUND → CREATE ITEM → /items/new?barcode=<encoded>) are end-to-end functional. Phase 66 QuickActionMenu replaces ScanResultBanner wholesale — prop surface bounded per Phase 65's "throwaway by design" framing.
- **LOOK-03 integration ready:** `/items/new?barcode=` with a `/^\d{8,14}$/` barcode triggers `useBarcodeEnrichment` (Plan 65-03) → `UpcSuggestionBanner` renders above ItemForm when `{ found: true }` (Plan 65-05). Plan 65-07's route registration + ScanPage onCreateWithBarcode navigation closes the loop.

## Self-Check: PASSED

Verified all claims:

- [x] `frontend2/src/routes/index.tsx` exists with ItemFormPage import + route — FOUND
- [x] `rg "<Route path=\"items/new\" element={<ItemFormPage />} />" frontend2/src/routes/index.tsx | wc -l` returns 1
- [x] Route source-ordering: items (line 108) → items/new (line 109) → items/:id (line 110) — FOUND via grep
- [x] `rg "void lookup;" frontend2/src/features/scan/ScanPage.tsx | wc -l` returns 0 (removed)
- [x] `rg "const lookup = useScanLookup\(banner\?\.code \?\? null\);" frontend2/src/features/scan/ScanPage.tsx | wc -l` returns 1 (callsite VERBATIM per Test 15 gate)
- [x] `rg "useEffect" frontend2/src/features/scan/ScanPage.tsx | wc -l` returns at least 1 (new match-effect)
- [x] `rg "history\.update\(effectiveCode" frontend2/src/features/scan/ScanPage.tsx | wc -l` returns 1
- [x] `rg "\[lookup\.status, lookup\.match, banner\?\.code, history\.update\]" frontend2/src/features/scan/ScanPage.tsx | wc -l` returns 1
- [x] `rg "const update = useCallback" frontend2/src/features/scan/hooks/useScanHistory.ts | wc -l` returns 1 (Plan 65-04 Task 3 upstream precondition)
- [x] `rg "const handleRetry = useCallback" frontend2/src/features/scan/ScanPage.tsx | wc -l` returns 1 (Phase 64 preserved)
- [x] `rg "const handleLookupRetry = useCallback" frontend2/src/features/scan/ScanPage.tsx | wc -l` returns 1 (Phase 65 NEW)
- [x] `rg "lookupStatus=\{lookup\.status\}" frontend2/src/features/scan/ScanPage.tsx | wc -l` returns 1
- [x] `rg "Test 15" frontend2/src/features/scan/__tests__/ScanPage.test.tsx | wc -l` returns at least 1 (preserved)
- [x] `rg "Test 16" frontend2/src/features/scan/__tests__/ScanPage.test.tsx | wc -l` returns at least 1 (new)
- [x] `rg "D-22" frontend2/src/features/scan/__tests__/ScanPage.test.tsx | wc -l` returns at least 1
- [x] Commits `de6011c` (Task 1), `012e672` (Task 2), `27451ba` (Task 3) all exist in `git log --oneline`
- [x] `bunx vitest run src/features/scan/__tests__/ScanPage.test.tsx` — 18/18 green
- [x] `bunx vitest run src/features/scan` — 49/49 green (all 5 scan test files)
- [x] `bunx vitest run` full suite — 710/710 passed (was 707 before Plan 65-07 → +3 from Test 16/17/18)
- [x] `bunx tsc -b --noEmit` — clean
- [x] `bun run lint:imports` — PASS
- [x] `bun run build` — clean (dist built, scanner chunk still manual-chunked correctly)

---

*Phase: 65-item-lookup-and-not-found-flow*
*Plan: 07*
*Completed: 2026-04-19*
