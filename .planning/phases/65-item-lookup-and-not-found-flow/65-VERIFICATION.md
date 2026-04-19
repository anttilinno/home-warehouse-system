---
phase: 65-item-lookup-and-not-found-flow
verified: 2026-04-19T13:41:00Z
status: human_needed
score: 18/18 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: null
  previous_score: null
  gaps_closed: []
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "iOS PWA camera permission resume after /scan → /items/new → back"
    expected: "Scanner resumes without re-prompting the OS-level camera permission"
    why_human: "Real iOS device + Safari PWA install required; Pitfall #1 cannot be asserted in JSDOM. Documented manual UAT in 65-VALIDATION.md §Manual-Only Verifications."
  - test: "Enrichment banner visual under live api.upcitemdb.com data"
    expected: "Scanning a real consumer UPC (e.g. 5449000000996) and navigating to /items/new shows UpcSuggestionBanner with name/brand rows + [USE] chips; tapping [USE] writes to the form; category renders as helper text only"
    why_human: "Depends on live public endpoint; staging the upstream JSON shape in a unit test would not exercise the real network/error semantics."
  - test: "prefers-reduced-motion: reduce opts out of LOADING cursor blink"
    expected: "Cursor glyph ▍ stays static (no opacity oscillation) when DevTools Rendering panel sets prefers-reduced-motion: reduce"
    why_human: "CSS @media rule effect cannot be asserted in JSDOM; the automated grep gate confirms the rule + animation:none declaration exist (Plan 65-06 Task 2). Documented in 65-VALIDATION.md."
  - test: "End-to-end scan → match → VIEW ITEM navigation in a real browser"
    expected: "Live decode of a barcode for an existing workspace item shows MATCHED banner with name + short_code; VIEW ITEM lands on /items/{id}"
    why_human: "Live camera + workspace-seeded item required; ScanPage.test.tsx Test 16 covers the history-backfill effect but not the navigate() call surface."
  - test: "End-to-end scan → not-found → CREATE ITEM → submit happy-path"
    expected: "Live decode of an unknown barcode shows NOT FOUND banner; CREATE ITEM navigates to /items/new?barcode=<encoded>; form submit creates the item; rescanning the same code now shows MATCHED"
    why_human: "Cross-route + cross-cache invalidation (Pitfall #7) is verified at the unit level (D-04 grep proof) but the user-perceptible round-trip requires a live workspace and backend."
---

# Phase 65: Item Lookup & Not-Found Flow — Verification Report

**Phase Goal:** Deliver LOOK-01 (matched item visible in scan banner), LOOK-02 (CREATE ITEM navigates to prefilled `/items/new`), LOOK-03 (optional UPC enrichment suggestion banner) end-to-end functional in both EN + ET locales with zero scanner-chunk bundle regression and ≤5 kB main-chunk delta.

**Verified:** 2026-04-19T13:41:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

Truths derived from the merged set of (a) ROADMAP Success Criteria #1/2/3, (b) per-plan must_haves frontmatter across the 8 plans, and (c) Phase-level guard contracts from 65-CONTEXT.md (decisions D-01..D-24).

| #  | Truth                                                                                                                                                                                | Status     | Evidence                                                                                                                                                                                                                                          |
| -- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1  | LOOK-01 SC#1: scanned code resolves to workspace item via `GET /api/workspaces/{wsId}/items?search={code}&limit=1` with exact-barcode guard, and frontend asserts workspace_id match | ✓ VERIFIED | `itemsApi.lookupByBarcode` (items.ts:103-118) wraps `list(wsId, { search: code, limit: 1 })`, asserts `candidate.barcode === code` (D-07 case-sensitive), asserts `candidate.workspace_id === wsId` (D-08); 6/6 unit tests green                   |
| 2  | LOOK-02 SC#2: when no workspace item matches, user sees "Not found" + "Create item with this barcode" action that lands on `/items/new?barcode=<code>` with barcode pre-filled       | ✓ VERIFIED | NOT-FOUND variant in ScanResultBanner.tsx:162-166 + onCreateWithBarcode handler in ScanPage.tsx:159-164 (`/items/new?barcode=${encodeURIComponent(code)}`); ItemFormPage reads `barcode` via `useSearchParams()` (ItemFormPage.tsx:52-53)          |
| 3  | LOOK-03 SC#3: for codes matching `/^\d{8,14}$/`, item-create form shows opt-in suggestion banner with name/brand/category from `GET /api/barcode/{code}` — never auto-written        | ✓ VERIFIED | `useBarcodeEnrichment` (useBarcodeEnrichment.ts:18-40) gates on `NUMERIC_8_TO_14.test(code)`; UpcSuggestionBanner renders per-field [USE] chips (D-14) + category as helper text only (D-15) — `setValue("category_id"` count = 0 in banner       |
| 4  | D-06: `itemsApi.lookupByBarcode(wsId, code)` wraps `itemsApi.list(wsId, { search: code, limit: 1 })` — no new HTTP endpoint                                                          | ✓ VERIFIED | items.ts:104 calls `itemsApi.list(wsId, { search: code, limit: 1 })`                                                                                                                                                                              |
| 5  | D-07: case-sensitive exact-barcode guard (`response.items[0]?.barcode === code`) returns null on mismatch or empty list                                                              | ✓ VERIFIED | items.ts:106-107 (`if (!candidate) return null; if (candidate.barcode !== code) return null;`)                                                                                                                                                    |
| 6  | D-08: workspace defense-in-depth — mismatch returns null AND emits structured `console.error({ kind: "scan-workspace-mismatch", ... })`                                              | ✓ VERIFIED | items.ts:108-116 (`kind: "scan-workspace-mismatch"` literal); test at items.lookupByBarcode.test.ts asserts log emission                                                                                                                          |
| 7  | D-09: `useScanLookup(code)` body uses real TanStack Query against `itemsApi.lookupByBarcode` with `staleTime: 30_000`, `gcTime: 300_000`, `enabled: !!code && !!workspaceId`         | ✓ VERIFIED | useScanLookup.ts:17-46 — exact pattern; explicit status mapping over query.isPending/isError prevents the TanStack v5 disabled-pending leak; D-18 ScanLookupResult shape preserved byte-identical (Phase 64 Test 15 still green: 18/18)           |
| 8  | D-11: `lib/api/barcode.ts` exports `barcodeApi.lookup(code)` calling `GET /barcode/{encodeURIComponent(code)}` (public, unauth) + `barcodeKeys` factory                              | ✓ VERIFIED | barcode.ts:18-27; exported via `lib/api/index.ts:9` (`export * from "./barcode"`); 5/5 unit tests green                                                                                                                                            |
| 9  | D-12: `useBarcodeEnrichment(code)` gated on `/^\d{8,14}$/`, `staleTime: Infinity`, `retry: false`                                                                                    | ✓ VERIFIED | useBarcodeEnrichment.ts:18,36-39 — `NUMERIC_8_TO_14 = /^\d{8,14}$/`, `staleTime: Infinity`, `gcTime: Infinity`, `retry: false`; 13/13 tests green covering full regex matrix                                                                      |
| 10 | D-13..D-16: UpcSuggestionBanner renders only on `data.found === true`, per-field [USE] writes via `setValue(field, value, { shouldDirty: true })`, never auto-writes category_id     | ✓ VERIFIED | UpcSuggestionBanner.tsx:34 (silent on `!data.found`); :42, :50 (setValue NAME + BRAND); category at :95-99 is plain helper text; grep `setValue("category_id"` returns 0; 13/13 tests green                                                       |
| 11 | D-17..D-21: ScanResultBanner renders four mutually-exclusive states (LOADING / MATCH / NOT-FOUND / ERROR) driven by `lookupStatus + match`                                           | ✓ VERIFIED | ScanResultBanner.tsx:70-79 derives single exclusive `variant`; SCAN AGAIN renders in every state; HazardStripe "yellow" on NOT-FOUND, "red" on ERROR, none on LOADING/MATCH; 21/21 states tests + 7 migrated Phase 64 tests green                |
| 12 | D-22: ScanPage match-effect calls `history.update(code, { entityType: "item", entityId, entityName })` ONLY on `lookup.status === "success" && lookup.match`                         | ✓ VERIFIED | ScanPage.tsx:101-112 — gated on success+match; deps `[lookup.status, lookup.match, banner?.code, history.update]` (NOT `[history]`); useScanHistory.update is useCallback-stable (`useScanHistory.ts:40-49`); Tests 16/17/18 green                |
| 13 | D-23: `itemCreateSchema` gains optional `brand: z.string().max(120).optional()` field; ItemForm renders BRAND RetroFormField                                                         | ✓ VERIFIED | schemas.ts:42-46 (brand field with max 120); ItemForm.tsx:154-161 (BRAND RetroFormField between BARCODE and DESCRIPTION); ItemForm submit coercion at :112 (`brand: values.brand || undefined`); 7/7 schema tests + 3 ItemForm BRAND tests green   |
| 14 | D-24: `itemCreateSchema.barcode` regex loosened from `/^[A-Za-z0-9]+$/` to `/^[A-Za-z0-9\-_]+$/` so Code128 scans (e.g. "TEST-CODE-123") pass zod                                    | ✓ VERIFIED | schemas.ts:39 — `regex(/^[A-Za-z0-9\-_]+$/, ...)`; pre-D-24 Phase 60 test re-pointed to `123/456` (still forbidden); space tripwire still rejects                                                                                                  |
| 15 | `/items/new` route registered between `/items` and `/items/:id` in routes/index.tsx                                                                                                  | ✓ VERIFIED | routes/index.tsx:108-110 (literal-before-param ordering: items @ 108 → items/new @ 109 → items/:id @ 110); ItemFormPage import at :11                                                                                                              |
| 16 | D-04 Pitfall #7 closure: ItemFormPage onSubmit invalidates `scanKeys.lookup(barcode)` AND useCreateItem invalidates `itemKeys.all` on success                                        | ✓ VERIFIED | ItemFormPage.tsx:88 (`qc.invalidateQueries({ queryKey: scanKeys.lookup(barcode) })`); useCreateItem hook handles itemKeys.all invalidation (Phase 60); navigates to `/items/${created.id}` :90                                                    |
| 17 | EN + ET Lingui catalogs cover every Phase 65 t`...` msgid (16 new); ET missing count is 0                                                                                            | ✓ VERIFIED | `bun run i18n:extract` reports en 509 / et 509 / et missing 0; all 16 Phase 65 msgids present in en/messages.po; ET translations include OTSIN…, VASTE LEITUD, EI LEITUD, OTSING EBAÕNNESTUS, BRÄND, KASUTA, KASUTA KÕIK, etc.                    |
| 18 | Bundle gate: scanner gzip ≤ 58057 (zero regression); main gzip ≤ 135754 + 5120 = 140874                                                                                              | ✓ VERIFIED | `gzip -c | wc -c` post-build: scanner-CLRWiLFx.js = 58057 B (delta 0, byte-identical to baseline); index-ChvbQJeu.js = 114418 B (delta −21336 B; well under +5120 budget). Hash unchanged on scanner chunk confirms zero content drift            |

**Score:** 18/18 truths verified

### Required Artifacts

| Artifact                                                                       | Expected                                                                                | Status     | Details                                                                                                                                                                |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend2/src/lib/api/items.ts`                                               | itemsApi.lookupByBarcode with D-06/07/08 guards inlined                                 | ✓ VERIFIED | 119 lines; lookupByBarcode at :103-118 with all three guards; imported by useScanLookup                                                                                |
| `frontend2/src/lib/api/barcode.ts`                                             | barcodeApi.lookup + barcodeKeys factory + BarcodeProduct typed                          | ✓ VERIFIED | 27 lines; encodeURIComponent defense; barcodeKeys mirrors scanKeys shape                                                                                                |
| `frontend2/src/lib/api/index.ts`                                               | barrel re-exports `./barcode`                                                            | ✓ VERIFIED | line 9: `export * from "./barcode";`                                                                                                                                    |
| `frontend2/src/features/items/hooks/useBarcodeEnrichment.ts`                   | TanStack Query wrapper with regex gate + silent-fail structured log                     | ✓ VERIFIED | 41 lines; `NUMERIC_8_TO_14`, staleTime/gcTime Infinity, retry false, kind: upc-enrichment-fail                                                                          |
| `frontend2/src/features/scan/hooks/useScanLookup.ts`                           | Real TanStack Query body; ScanLookupResult shape preserved (Phase 64 D-18)              | ✓ VERIFIED | 46 lines; explicit status mapping prevents disabled-pending leak; Phase 64 Test 15 callsite gate green                                                                  |
| `frontend2/src/features/scan/hooks/useScanHistory.ts`                          | gains useCallback-stable .update(code, patch)                                           | ✓ VERIFIED | 62 lines; update at :40-49 wrapped in useCallback with empty deps                                                                                                       |
| `frontend2/src/lib/scanner/scan-history.ts`                                    | updateScanHistory(code, patch) with D-22 noop-if-missing race guard                     | ✓ VERIFIED | function at :153-173 with explicit `// D-22 race guard: noop-if-missing` comment; barrel-exported from `lib/scanner/index.ts:47`                                       |
| `frontend2/src/features/items/forms/schemas.ts`                                | D-23 optional brand field + D-24 loosened barcode regex                                 | ✓ VERIFIED | brand at :42-46 (max 120); barcode regex at :39 (`/^[A-Za-z0-9\-_]+$/`)                                                                                                |
| `frontend2/src/features/items/forms/ItemForm.tsx`                              | FormProvider wrap + BRAND field + beforeForm slot                                       | ✓ VERIFIED | 190 lines; FormProvider wraps the return at :122; BRAND RetroFormField at :154-161; beforeForm slot rendered inside FormProvider but outside `<form>` at :123          |
| `frontend2/src/features/items/UpcSuggestionBanner.tsx`                         | per-field [USE] + USE ALL + DISMISS; helper-text-only category; setValue("brand", ...)  | ✓ VERIFIED | 112 lines; setValue("brand") at :50, setValue("name") at :42, NEVER setValue("category_id"), NEVER setValue("description") — D-23 anti-workaround grep proof in summary  |
| `frontend2/src/features/items/ItemFormPage.tsx`                                | Page orchestrator: ?barcode= prefill, generateSku once, dirty-guard, dual invalidation  | ✓ VERIFIED | 149 lines; useState(() => generateSku()) lazy initializer at :60; scanKeys.lookup invalidate at :88; navigate(`/items/${created.id}`) at :90; RetroConfirmDialog at :138 |
| `frontend2/src/components/scan/ScanResultBanner.tsx`                           | Four-state widening (LOADING / MATCH / NOT-FOUND / ERROR) per D-17..D-21                | ✓ VERIFIED | 203 lines; exclusive variant derivation at :70-79; HazardStripe red on ERROR, yellow on NOT-FOUND, none on LOADING/MATCH; SCAN AGAIN in every state                    |
| `frontend2/src/features/scan/ScanPage.tsx`                                     | match-effect with D-22 race guard + widened banner callsite + handleLookupRetry         | ✓ VERIFIED | 278 lines; useEffect at :101-112 with deps `[lookup.status, lookup.match, banner?.code, history.update]`; widened banner props at :230-246; void lookup; removed       |
| `frontend2/src/routes/index.tsx`                                               | <Route path="items/new" element={<ItemFormPage />} /> registered                        | ✓ VERIFIED | line 109 between items (108) and items/:id (110); literal-before-param ordering correct                                                                                 |
| `frontend2/locales/en/messages.po`                                             | 16 new Phase 65 msgids + EN authoring                                                   | ✓ VERIFIED | All msgids present: SUGGESTIONS AVAILABLE, MATCHED, NOT FOUND, LOOKING UP…, LOOKUP FAILED, VIEW ITEM, CREATE ITEM WITH THIS BARCODE, USE ALL, DISMISS, BRAND, etc.       |
| `frontend2/locales/et/messages.po`                                             | ET hand-fills for every new msgid (missing count = 0)                                   | ✓ VERIFIED | i18n:extract reports `et missing: 0`; OTSIN…, VASTE LEITUD, EI LEITUD, OTSING EBAÕNNESTUS, VAATA ESET, LOO UUS ESE SELLE VÖÖTKOODIGA, KASUTA KÕIK, BRÄND, etc. present  |
| `frontend2/src/styles/globals.css`                                             | @keyframes retro-cursor-blink + prefers-reduced-motion guard with animation:none        | ✓ VERIFIED | @keyframes at :61-64; .retro-cursor-blink class; @media (prefers-reduced-motion: reduce) at :70 with `animation: none`                                                  |
| `.planning/phases/65-item-lookup-and-not-found-flow/65-BUNDLE-BASELINE.md`     | Pre-phase + post-phase chunk byte counts + PASS verdict                                 | ✓ VERIFIED | Pre: main 135754 / scanner 58057 @ b04ae7c. Post: main 114418 / scanner 58057 (delta −21336 / 0). PASS verdict at line 99-101                                          |

### Key Link Verification

| From                                                          | To                                                                                | Via                                                       | Status     | Details                                                                                                            |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------ |
| ScanPage.tsx                                                  | useScanLookup                                                                      | `useScanLookup(banner?.code ?? null)` (line 84)           | ✓ WIRED    | Phase 64 Test 15 callsite gate green                                                                                |
| useScanLookup                                                 | itemsApi.lookupByBarcode                                                           | queryFn calls `itemsApi.lookupByBarcode(workspaceId!, code!)` | ✓ WIRED    | useScanLookup.ts:21                                                                                                |
| itemsApi.lookupByBarcode                                      | itemsApi.list                                                                      | `itemsApi.list(wsId, { search: code, limit: 1 })`         | ✓ WIRED    | items.ts:104                                                                                                        |
| ScanResultBanner (NOT-FOUND state)                            | ScanPage.handleCreateWithBarcode                                                   | `onCreateWithBarcode(code)` prop                          | ✓ WIRED    | ScanResultBanner.tsx:193-195 → ScanPage.tsx:243 → handleCreateWithBarcode @ :159-164 navigates `/items/new?barcode=` |
| ScanPage.handleCreateWithBarcode                              | /items/new route                                                                   | `navigate(/items/new?barcode=${encodeURIComponent(code)})` | ✓ WIRED    | route registered at routes/index.tsx:109                                                                            |
| ItemFormPage                                                  | ItemForm + UpcSuggestionBanner (via beforeForm slot)                              | `beforeForm={enrichment.data?.found ? <UpcSuggestionBanner data={enrichment.data} /> : null}` | ✓ WIRED    | ItemFormPage.tsx:115-119; banner reads useFormContext from FormProvider in ItemForm |
| UpcSuggestionBanner [USE]                                     | ItemForm fields                                                                    | `useFormContext().setValue(field, value, { shouldDirty: true })` | ✓ WIRED    | banner :42, :50; ItemForm wraps FormProvider :122                                                                   |
| useBarcodeEnrichment                                          | barcodeApi.lookup                                                                  | queryFn calls `barcodeApi.lookup(code!)`                  | ✓ WIRED    | useBarcodeEnrichment.ts:25                                                                                          |
| ItemFormPage.onSubmit                                         | scanKeys.lookup invalidation                                                       | `qc.invalidateQueries({ queryKey: scanKeys.lookup(barcode) })` | ✓ WIRED    | ItemFormPage.tsx:88                                                                                                |
| ItemFormPage.onSubmit                                         | useCreateItem (itemKeys.all invalidation)                                          | useCreateItem hook handles itemKeys.all                   | ✓ WIRED    | useItemMutations.ts owns itemKeys.all invalidation per Phase 60                                                    |
| ScanPage match-effect                                         | useScanHistory.update                                                              | `history.update(effectiveCode, { entityType, entityId, entityName })` deps `[..., history.update]` | ✓ WIRED    | ScanPage.tsx:101-112; update useCallback-stable so deps don't re-fire                                              |
| ScanResultBanner (MATCH state)                                | ScanPage.handleViewItem                                                            | `onViewItem(match.id)` prop → navigate(`/items/${id}`)    | ✓ WIRED    | ScanResultBanner.tsx:182-185 → ScanPage.tsx:152-157                                                                  |
| ScanResultBanner (ERROR state)                                | ScanPage.handleLookupRetry                                                         | `onRetry` prop → `lookup.refetch()`                       | ✓ WIRED    | ScanResultBanner.tsx:187-191 → ScanPage.tsx:172-174                                                                  |

### Data-Flow Trace (Level 4)

| Artifact                | Data Variable             | Source                                                    | Produces Real Data | Status     |
| ----------------------- | ------------------------- | --------------------------------------------------------- | ------------------ | ---------- |
| ScanResultBanner MATCH  | `match.name / .short_code` | useScanLookup → itemsApi.lookupByBarcode → backend FTS    | Yes — D-07 guard rejects empty/mismatched results; backend returns real Item rows from DB | ✓ FLOWING  |
| ScanResultBanner LOADING/ERROR | `lookupStatus`     | useScanLookup → query.isPending/isError                   | Yes — TanStack Query state                                                              | ✓ FLOWING  |
| UpcSuggestionBanner     | `data.name / data.brand / data.category` | useBarcodeEnrichment → barcodeApi.lookup → public /barcode/{code} backend | Yes — backend passes through OpenFoodFacts/OpenProductsDB; D-12 regex gate prevents wasted calls   | ✓ FLOWING  |
| ItemFormPage            | `barcode` URL param        | useSearchParams (set by ScanPage navigate)                | Yes — preserved through encodeURIComponent round-trip                                       | ✓ FLOWING  |
| ItemFormPage            | `defaultValues.sku`        | generateSku() called once in useState lazy init           | Yes — deterministic ITEM-{ts}-{rand} pattern                                                 | ✓ FLOWING  |
| ScanPage history backfill | `entityId / entityName` | match-effect on lookup.match                              | Yes — only fires on success+match; updateScanHistory noop-if-missing for stale resolves      | ✓ FLOWING  |

### Behavioral Spot-Checks

| Behavior                                          | Command                                                                                                               | Result                                                       | Status |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------ |
| Full Vitest suite runs green (no regressions)     | `cd frontend2 && bunx vitest run`                                                                                     | 99 files / 710 tests passed / 0 failed                       | ✓ PASS |
| TypeScript build compiles                         | `cd frontend2 && bunx tsc -b --noEmit`                                                                                | exit 0, no output                                            | ✓ PASS |
| CI grep guard (no offline/sync/idb/serwist imports) | `cd frontend2 && bun run lint:imports`                                                                              | "check-forbidden-imports: OK"                                | ✓ PASS |
| Production build succeeds                         | `cd frontend2 && bun run build`                                                                                       | "✓ built in 308ms"                                           | ✓ PASS |
| Lingui ET catalog has zero missing translations   | `cd frontend2 && bun run i18n:extract`                                                                                | en 509 / et 509 / et missing 0                               | ✓ PASS |
| Lingui catalogs compile cleanly                   | `cd frontend2 && bun run i18n:compile`                                                                                | "Compiling message catalogs… Done in 345ms" (no warnings)    | ✓ PASS |
| Scanner-chunk gzip ≤ 58057 (zero regression)      | `gzip -c dist/assets/scanner-CLRWiLFx.js | wc -c`                                                                     | 58057 (== baseline; byte-identical hash CLRWiLFx)            | ✓ PASS |
| Main-chunk gzip ≤ 140874 (baseline + 5 kB)        | `gzip -c dist/assets/index-ChvbQJeu.js | wc -c`                                                                       | 114418 (delta −21336 vs 135754 baseline)                     | ✓ PASS |
| No `it.todo` left in any source test file         | `Grep "it\.todo\(" frontend2/src` (all *.ts/.tsx)                                                                     | 0 matches across 0 files                                     | ✓ PASS |
| `void lookup;` placeholder removed                | `Grep "void lookup" frontend2/src/features/scan/ScanPage.tsx`                                                         | 0 matches                                                    | ✓ PASS |
| Phase 64 ScanPage Test 15 callsite gate still green | `cd frontend2 && bunx vitest run src/features/scan/__tests__/ScanPage.test.tsx`                                     | 18/18 tests passed (Test 15 + Tests 16/17/18)                | ✓ PASS |
| Phase 65 specific suites green                    | `bunx vitest run ItemFormPage.test.tsx UpcSuggestionBanner.test.tsx ScanResultBanner.states.test.tsx items.lookupByBarcode.test.ts` | 4 files / 59 tests passed                          | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan(s)                                          | Description                                                                                                  | Status        | Evidence                                                                                                                                                                                                                                                  |
| ----------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LOOK-01     | 65-02, 65-04, 65-06, 65-07                              | On scan, user sees the matched item via FTS endpoint with exact-barcode + workspace_id guards                | ✓ SATISFIED   | itemsApi.lookupByBarcode + useScanLookup + ScanResultBanner MATCH state + ScanPage match-effect end-to-end wired; LOOK-01 marked `[x]` in REQUIREMENTS.md:23                                                                                                |
| LOOK-02     | 65-02, 65-05, 65-06, 65-07                              | If no item matches, "not found → create item" navigates to `/items/new?barcode=<code>` with barcode prefilled | ✓ SATISFIED   | NOT-FOUND variant + onCreateWithBarcode + /items/new route + ItemFormPage ?barcode= prefill + D-24 schema loosening + dual invalidation; LOOK-02 marked `[x]` in REQUIREMENTS.md:24                                                                            |
| LOOK-03     | 65-03, 65-05                                            | For codes matching `/^\d{8,14}$/`, item-create form shows opt-in suggestion banner — never auto-written        | ✓ SATISFIED   | useBarcodeEnrichment regex gate + UpcSuggestionBanner per-field [USE] chips + D-15 helper-text-only category + D-23 first-class brand field; LOOK-03 marked `[x]` in REQUIREMENTS.md:25                                                                       |

No orphaned requirements. No additional REQ-IDs map to Phase 65 in REQUIREMENTS.md beyond LOOK-01/02/03.

### Anti-Patterns Found

| File                                                       | Line | Pattern                          | Severity | Impact                                                                                                                                            |
| ---------------------------------------------------------- | ---- | -------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| (none found in Phase 65 production code)                   | —    | —                                | —        | Verified: zero `it.todo`, zero `TODO/FIXME/PLACEHOLDER` markers introduced by Phase 65, zero `console.log`-only handlers, zero hardcoded empty data on user-visible state. |

Verified anti-pattern scans on the 14 Phase 65 production files (items.ts, barcode.ts, useBarcodeEnrichment.ts, useScanLookup.ts, useScanHistory.ts, scan-history.ts, schemas.ts, ItemForm.tsx, UpcSuggestionBanner.tsx, ItemFormPage.tsx, ScanResultBanner.tsx, ScanPage.tsx, routes/index.tsx, lib/api/index.ts, lib/scanner/index.ts):

- TODO/FIXME/PLACEHOLDER: zero matches in any of the 14 modified files (the only `// D-22 race guard: noop-if-missing` is intentional documentation, not a placeholder)
- Empty implementations / `return null` only on guarded early-exits (D-08 workspace mismatch; UpcSuggestionBanner not-found defensive null; D-22 noop-if-missing) — all intentional and tested
- Hardcoded empty data: `match: null` in ScanResultBanner is a typed prop, not a stub fallback; `defaultValues` in ItemFormPage seed empty strings as RHF convention (overwritten by useSearchParams + generateSku before render)
- Console.log only handlers: zero — every console.error is structured (`{ kind, ... }`) per Phase 64 D-12 vocabulary

### Human Verification Required

Phase 65 ships LOOK-01/02/03 with full automated coverage of every D-01..D-24 decision contract, but five user-perceptible behaviors require live-environment verification before the phase can be declared shippable to a user. These are the same items already enumerated in `65-VALIDATION.md §Manual-Only Verifications`, plus two end-to-end happy-path checks that the orchestrator should run in a real browser against a seeded workspace:

**1. iOS PWA camera permission resume after `/scan → /items/new → back`**

- **Test:** Install the PWA on an iOS device (Safari → Add to Home Screen). Open the app, navigate to `/scan`, decode a barcode, tap CREATE ITEM WITH THIS BARCODE, then tap CANCEL on `/items/new`.
- **Expected:** Scanner resumes immediately on return to `/scan` without re-prompting the OS-level camera permission. Pitfall #1 acknowledged: the navigate may force a permission re-prompt on iOS PWA — manual UAT confirms whether the LOOK-02 hand-off remains usable on iOS.
- **Why human:** Real iOS device + Safari PWA install required. JSDOM cannot model iOS Safari's PWA permission state machine.

**2. Enrichment banner visual under live `api.upcitemdb.com` data**

- **Test:** Scan a real consumer UPC (e.g. 5449000000996 — Coca-Cola). On `/items/new`, observe the UpcSuggestionBanner.
- **Expected:** Banner renders with NAME and BRAND rows + [USE] chips; tapping [USE] writes to the form (form becomes dirty); category renders as helper text only (no [USE] chip).
- **Why human:** Depends on the live public OpenFoodFacts / OpenProductsDB upstream. Unit tests stub the response shape.

**3. `prefers-reduced-motion: reduce` opts out of the LOADING cursor blink**

- **Test:** Open ScanPage in Chrome/Firefox/Safari. DevTools → Rendering panel → set `prefers-reduced-motion: reduce`. Trigger a loading state (or inject `.retro-cursor-blink` on any element).
- **Expected:** Cursor glyph ▍ is STATIC (no opacity oscillation). The automated grep gate confirms the CSS rule + `animation: none` declaration exist.
- **Why human:** CSS `@media` rule effect cannot be asserted in JSDOM. Plan 65-06 Task 2 added the rule; manual check confirms runtime effect.

**4. End-to-end scan → match → VIEW ITEM navigation in a real browser**

- **Test:** Seed the workspace with one item that has a known barcode. Navigate to `/scan` and decode (or manually enter) that barcode.
- **Expected:** MATCHED banner shows the item's `name` + `short_code`; tapping VIEW ITEM lands on `/items/{match.id}` with the item detail page rendered.
- **Why human:** Live camera + workspace-seeded item required. ScanPage Test 16 covers the history-backfill effect but not the navigate() call surface end-to-end.

**5. End-to-end scan → not-found → CREATE ITEM → submit happy-path (Pitfall #7 closure)**

- **Test:** Decode an unknown barcode on `/scan`. Tap CREATE ITEM WITH THIS BARCODE. On `/items/new`, fill in NAME + submit. Then navigate back to `/scan` and re-decode the same barcode.
- **Expected:** First decode shows NOT FOUND. After CREATE, second decode of the same code shows MATCHED with the newly-created item — proves D-04 dual invalidation actually clears the cached not-found.
- **Why human:** Cross-route + cross-cache invalidation is verified at the unit level (D-04 grep proof in Plan 65-05 SUMMARY) but the user-perceptible round-trip requires a live workspace and backend.

### Gaps Summary

No automated gaps found. Every D-01..D-24 decision in 65-CONTEXT.md maps to verifiable production code AND a green test; every ROADMAP Success Criterion is reflected in a wired call path; every Phase 65 must_have from per-plan frontmatter is satisfied; the bundle gate passes with large margin (scanner byte-identical, main 21.3 kB lighter than baseline); the i18n catalogs are complete in both EN and ET.

The phase status is **human_needed** rather than **passed** because the five live-environment checks above (iOS PWA permission, live enrichment API render, prefers-reduced-motion runtime, end-to-end navigation flows) cannot be fully verified by Vitest + JSDOM and are explicitly enumerated as Manual-Only in 65-VALIDATION.md. None of these block "code is correct" — they block "code behaves correctly under conditions JSDOM can't model".

---

_Verified: 2026-04-19T13:41:00Z_
_Verifier: Claude (gsd-verifier)_
