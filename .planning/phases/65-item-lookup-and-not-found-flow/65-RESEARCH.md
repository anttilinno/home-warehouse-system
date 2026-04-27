# Phase 65: Item Lookup & Not-Found Flow — Research

**Researched:** 2026-04-19
**Domain:** TypeScript/React frontend (`/frontend2`) — workspace-scoped barcode lookup + create-item hand-off + opt-in UPC enrichment
**Confidence:** HIGH (every claim below is [VERIFIED] against the live `/frontend2` tree, Phase 64 shipped artifacts, Phase 65 CONTEXT/UI-SPEC, or the backend Go source; no [ASSUMED] claims in this phase)

## Summary

Phase 65 is a **surgical body-swap** on top of Phase 64's fully-shipped scanner foundation. The scanner callsite (`useScanLookup(banner?.code ?? null)` at ScanPage.tsx:82), the return type (`ScanLookupResult` in lib/api/scan.ts), and the `scanKeys` factory are all **locked** by Phase 64 D-18 and enforced by ScanPage.test.tsx Test 15. That tripwire means the hook's body is the only thing that changes for LOOK-01, not its shape.

The core technical surface for the phase is: (1) a thin `itemsApi.lookupByBarcode(wsId, code)` helper wrapping the existing `GET /api/workspaces/{wsId}/items?search=&limit=1` FTS endpoint with a case-sensitive exact-barcode guard AND a workspace_id defense-in-depth assertion (Pitfall #5); (2) four visual states on the existing `ScanResultBanner` (widened in-place, not split into siblings, because Phase 66 replaces it wholesale); (3) a new `/items/new` route + `ItemFormPage` that mirrors `ItemPanel`'s create-mode parity (generateSku-once, onDirtyChange, `RetroConfirmDialog` discard guard); (4) a public-endpoint enrichment hook gated on `/^\d{8,14}$/` feeding a new `UpcSuggestionBanner` with per-field [USE] chips + category-hint-only display (D-15); (5) a new `useScanHistory.update(code, patch)` mutator that backfills entityType/entityId post-lookup (D-22 explicitly mandates this be a separate method, not upsert-on-add, to prevent a race where lookup resolves after the user scans a second code).

Every user-facing string must land EN-first AND ET gap-filled in this same phase (per Phase 63/64 precedent — do NOT push to stabilization). The `/scan` chunk must not regress its Phase 64 main-chunk gzip baseline (−37.8 kB delta vs pre-Phase-64 baseline is the preserved savings), and total Phase 65 main-chunk delta is capped at ≤ 5 kB gzip.

**Primary recommendation:** Build it in four waves: (Wave 0) api + hook scaffold with tests, (Wave 1) scan-side widening, (Wave 2) /items/new page + enrichment, (Wave 3) i18n + bundle gate. Follow the `ItemPanel` dirty-guard + SKU-once patterns verbatim at page level; never duplicate mutation logic.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Workspace item lookup by barcode | API / Backend (Go) | Frontend guard | Backend owns FTS + workspace_id filter in SQL; frontend asserts `item.workspace_id === session.workspaceId` as defense-in-depth per Pitfall #5 (globally-unique UPCs guarantee cross-tenant collisions). No new HTTP endpoint. |
| External UPC enrichment | Browser / Client (fetch) + external upstream | — | Public `/api/barcode/{code}` is a pass-through to OpenFoodFacts + OpenProductsDB; Huma enforces 8–14 char length. Frontend owns the `/^\d{8,14}$/` gate (avoids 422 noise for QR codes / short alphanumeric). |
| TanStack Query cache for lookup | Browser / Client (React tree) | — | `scanKeys.lookup(code)` with `staleTime: 30_000`, `gcTime: 300_000` (D-09). Invalidation happens on `useCreateItem` success to guard Pitfall #7 (stale not-found after create→rescan). |
| Scan-history state (localStorage) | Browser / Client (persistence) | — | Key `hws-scan-history`, 10-entry cap, NOT workspace-scoped (intentional v2.2 decision). Backfill entityType/entityId on lookup match (D-22). |
| Post-scan routing (match/not-found) | Browser / Client (React Router) | — | `/items/{id}` on VIEW ITEM (MATCH), `/items/new?barcode=<code>` on CREATE ITEM (NOT-FOUND + ERROR fallback). Scanner stays mounted on `/scan` until nav; Pitfall #1 (iOS PWA camera reset) acknowledged and accepted (SC#2 explicitly navigates off /scan). |
| Form state + dirty guard | Browser / Client (react-hook-form) | — | `ItemFormPage` composes existing `ItemForm` (already supports `defaultValues.barcode` + `onDirtyChange`). Dirty-guard uses `RetroConfirmDialog` + `navigate(-1)` at page level; mirrors `ItemPanel`'s SlideOverPanel precedent. |
| i18n catalog gap-fill | Build-time (Lingui extract + compile) | — | EN first with `t\`…\``, ET gap-fill in-phase, `bun run i18n:compile` zero orphan warnings. |

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LOOK-01 | On scan, user sees the matched item via `GET /api/workspaces/{wsId}/items?search={code}&limit=1` (FTS over name, SKU, barcode) | `itemsApi.lookupByBarcode(wsId, code)` (D-06) wraps existing `list()`; exact-barcode guard (D-07, case-sensitive); workspace_id defense (D-08). `useScanLookup(code)` body swap (D-09) retains ScanLookupResult shape locked by Phase 64 D-18. Four-state `ScanResultBanner` (D-17..21). |
| LOOK-02 | If no item matches, user sees a "not found → create item" action that navigates to `/items/new?barcode=<code>` with barcode pre-filled | New `ItemFormPage.tsx` (D-02) at `Route path="items/new"` (D-01); reads `?barcode=` via `useSearchParams()`; reuses existing `ItemForm` with `defaultValues.barcode`; `generateSku()` once on mount (D-02, mirrors `ItemPanel`); dirty-guard via `RetroConfirmDialog` on CANCEL/navigate-away (D-03). `useCreateItem` onSuccess invalidates `itemKeys.all` + `scanKeys.lookup(code)` (D-04, Pitfall #7 guard). Exact URL "CREATE ITEM WITH THIS BARCODE" navigates to `/items/new?barcode=<encoded>` (D-19). |
| LOOK-03 | For codes matching `/^\d{8,14}$/`, the item-create form shows suggested name/brand from `GET /api/barcode/{code}` as opt-in prefill | New `lib/api/barcode.ts` (D-11) — `barcodeApi.lookup(code)` + `barcodeKeys` factory. New `useBarcodeEnrichment(code)` hook (D-12) gated on regex, `staleTime: Infinity`. New `UpcSuggestionBanner` (D-13) built on existing `RetroPanel` + hazard stripe; per-field `[USE]` chips (D-14) write via `setValue(field, value, { shouldDirty: true })`; category displayed as helper text only (D-15, never auto-written). Silent failure on error / found:false (D-16). |

## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01..D-22, verbatim from 65-CONTEXT.md)

**Route & Create-Item Hand-off (LOOK-02):**
- **D-01:** New `Route path="items/new"` in `frontend2/src/routes/index.tsx` alongside `/items` and `/items/:id`. Inherits `AppShell`.
- **D-02:** `ItemFormPage.tsx` reads `barcode` from `useSearchParams()`, calls `generateSku()` once on mount (stored in state, like `ItemPanel`), renders existing `ItemForm` with `defaultValues={{ barcode, sku }}`. No auto-fire enrichment from defaults — enrichment hook runs independently.
- **D-03:** Page chrome mirrors `ItemPanel` create mode: retro header "NEW ITEM", CREATE + CANCEL `RetroButton`s, `isDirty`-guard via existing `onDirtyChange` plumbing. CANCEL calls `navigate(-1)` with dirty-guard.
- **D-04:** On successful create, mutation's `onSuccess` invalidates `itemKeys.all` AND `scanKeys.lookup(code)`, then `navigate(/items/{created.id})`.
- **D-05:** `ItemPanel` slide-over on `/items` stays primary "add item" UX; `/items/new` is alternate entry (scan, bookmarks, future FAB). Both call `useCreateItem` — no mutation duplication.

**Barcode Lookup & Exact-Match Guard (LOOK-01):**
- **D-06:** `itemsApi.lookupByBarcode(wsId, code)` in `frontend2/src/lib/api/items.ts` wraps existing `list(wsId, { search: code, limit: 1 })` — no new HTTP endpoint. Guards live inside helper.
- **D-07:** Exact-barcode guard: **case-sensitive** `response.items[0]?.barcode === code`. Empty list OR guard-fail returns `null` (not-found). NOT exposed as separate "fuzzy match" state.
- **D-08:** Workspace defense-in-depth: helper asserts `response.items[0].workspace_id === session.workspaceId`. On mismatch emits `console.error({ kind: "scan-workspace-mismatch", code, returnedWs, sessionWs })` and returns `null`. Guards Pitfall #5.
- **D-09:** `useScanLookup(code)` body:
  ```
  useQuery({
    queryKey: scanKeys.lookup(code),
    queryFn: () => itemsApi.lookupByBarcode(workspaceId!, code),
    enabled: !!code && !!workspaceId,
    staleTime: 30_000,
    gcTime: 300_000,
  })
  ```
  Return shape EXACTLY as locked by Phase 64 D-18. Callsite at ScanPage.tsx line 82 unchanged — Test 15 gate holds.
- **D-10:** `useScanLookup` runs for MANUAL-format entries same as live decodes. Matches Phase 64 D-14/D-15 (single code path).

**External UPC Enrichment (LOOK-03):**
- **D-11:** New `lib/api/barcode.ts` — `barcodeApi.lookup(code)` calling `GET /barcode/{code}` (public / unauthenticated) + `barcodeKeys` factory. Exported via `lib/api/index.ts` barrel.
- **D-12:** New `useBarcodeEnrichment(code)` hook — `useQuery({ queryKey: barcodeKeys.lookup(code), queryFn: ..., enabled: /^\d{8,14}$/.test(code ?? ""), staleTime: Infinity })`. Regex gate IS the LOOK-03 spec.
- **D-13:** `UpcSuggestionBanner` built on existing `RetroPanel` + hazard-stripe. Header "SUGGESTIONS AVAILABLE". No new retro primitive — retro barrel not widened.
- **D-14:** Per-field `[USE]` chips write via `setValue(field, val, { shouldDirty: true })` + "USE ALL" convenience + "DISMISS" local collapse.
- **D-15:** External category string shown as helper text only — NEVER auto-writes `category_id`.
- **D-16:** Enrichment failure or `{ found: false }` is silent — banner simply doesn't render; structured `console.error({ kind: "upc-enrichment-fail", code, error })` for observability.

**Post-Scan Banner States:**
- **D-17:** `ScanResultBanner` widened to four mutually-exclusive states: LOADING / SUCCESS+match / SUCCESS+null / ERROR. All in same component — Phase 66 replaces wholesale with `QuickActionMenu`.
- **D-18:** MATCH shows "MATCHED" label + `match.name` + `match.short_code` + "VIEW ITEM" + "SCAN AGAIN".
- **D-19:** NOT-FOUND shows yellow hazard stripe + "NOT FOUND" + echoed code + "CREATE ITEM WITH THIS BARCODE" → `/items/new?barcode=<code>` + "SCAN AGAIN".
- **D-20:** LOADING shows "LOOKING UP…" + dimmed code + "SCAN AGAIN" (still interactive).
- **D-21:** ERROR (status: "error") shows red hazard stripe + "LOOKUP FAILED" + error copy + "RETRY" (`lookup.refetch()`) + "CREATE ITEM WITH THIS BARCODE" fallback + "SCAN AGAIN".

**Scan History Enrichment:**
- **D-22:** On match resolve, `ScanPage` invokes new `useScanHistory.update(code, { entityType: "item", entityId: match.id })`. **Separate method (not upsert-on-add)** — prevents race when user scans a second code before first lookup resolves.

### Claude's Discretion
- Exact retro copy for every new string (EN first; ET gap-fill this phase).
- Visual treatment of "LOOKING UP…" text (blinking cursor chosen per UI-SPEC).
- Whether `useScanHistory.update` is a separate method or `add()` gains upsert semantics (CONTEXT <specifics> recommends separate method per race-guard argument).
- Exact layout of `UpcSuggestionBanner` rows (UI-SPEC chose stacked rows).
- Dirty-guard dialog copy on CANCEL (UI-SPEC chose `DISCARD CHANGES?` / `Your edits will be lost.` — verbatim match to existing SlideOverPanel).
- Whether `/items/new` has its own `ErrorBoundaryPage` wrap (UI-SPEC chose inherit from route-level boundary).
- Precise structured-log `kind` strings (match Phase 64 D-12 vocabulary).
- Whether enrichment `staleTime: Infinity` is per-query or app-level (recommend per-query for simplicity and query-key isolation).

### Deferred Ideas (OUT OF SCOPE)
- Post-scan QuickActionMenu overlay → Phase 66
- FAB → Phase 67
- Loan preselect from scan → Phase 68
- Quick Capture inline scan → Phase 69
- Container/location barcode lookup → v2.3+
- Offline scan queue → v2.3+ (CI grep guard enforces)
- Duplicate-scan soft warning → v2.3+
- GTIN-14 canonicalization on write+lookup → revisit if duplicates surface
- "Did you mean" fuzzy suggestions → explicit anti-feature
- Inline dialog create-item flow on `/scan` → milestone-level revisit "if friction"
- Per-field enrichment rejection memory → v2.3+
- Fuzzy-match enrichment category to existing → v2.3+ (risky)
- Making `/items/new` canonical + deprecating ItemPanel → later refactor

**Never:** Auto-write UPC enrichment values; silent cross-tenant match; new backend `/api/items?barcode=` endpoint; ported shadcn/ui from legacy.

## Project Constraints (from CLAUDE.md)

Note: `./CLAUDE.md` at the home directory level references a Go MUD project ("ROT-MUD"), which is **not relevant to this TypeScript/React phase**. The additional_context explicitly flags this: "ignore those Go-specific rules for this phase; follow frontend2/ conventions documented in CONTEXT.md and research/ARCHITECTURE.md instead."

Binding constraints for Phase 65 come from the **project-level** sources below, NOT from the /home/antti/CLAUDE.md Go rules:

- **GSD Workflow Enforcement (from CLAUDE.md):** Edits must flow through a GSD command. Research → Plan → Execute Phase are the entry points. `[VERIFIED: CLAUDE.md §GSD Workflow Enforcement]`
- **CI grep guard (scripts/check-forbidden-imports.mjs):** NO imports matching `idb`, `serwist`, `@serwist/*`, or substring `offline` / `sync` (case-insensitive) in `frontend2/src/**`. Applies to BOTH `from '...'` AND `import('...')` forms. Filenames can contain `scan-history` (the word isn't forbidden; only specifier-level substrings of `sync`/`offline` trigger). Phase 65 is online-only — any caching stays in TanStack Query, not localStorage. `[VERIFIED: scripts/check-forbidden-imports.mjs:22-24]`
- **Retro barrel-only imports** (Phase 54 decision): all retro atoms imported from `@/components/retro`, not deep paths. `[VERIFIED: 65-CONTEXT.md "Established Patterns" + grep of /frontend2]`
- **TanStack Query for server state** (v2.1 decision): mandatory. `[VERIFIED: .planning/STATE.md §Accumulated Context]`
- **react-hook-form + zod via RetroFormField** (v2.1): standard form substrate; new pages do not bypass it. `[VERIFIED: ItemForm.tsx imports zodResolver + RetroFormField]`
- **Lingui `t\`…\`` for all new strings**, EN first + ET gap-fill same phase (per Phase 63/64 precedent). `[VERIFIED: Phase 64 Plan 64-10 shipped 36 translations in-phase]`
- **HttpError 401/403-only token clear** (v2.0): scanner's lookup failures (4xx/5xx) never log user out. `[VERIFIED: AuthContext.tsx:61]`
- **Single-route /scan** (v2.2): `/scan` uses overlays, never navigates away mid-scan. EXCEPTION: LOOK-02 CREATE ITEM explicitly DOES navigate off `/scan` to `/items/new` — this is the accepted cost per SC#2 (Pitfall #1 acknowledged but scope). `[VERIFIED: STATE.md §Accumulated Context + ROADMAP.md SC#2]`

## Standard Stack

### Core (all already installed — Phase 65 adds no new deps)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-query` | 5.99.0 (semver `^5`) | Server-state cache for lookup + enrichment queries | Pattern established across every `use*List`/`use*Detail` hook in `/frontend2`. Query-key factories per domain. `[VERIFIED: frontend2/node_modules/@tanstack/react-query/package.json]` |
| `react-router` | 7.14.0 (semver `^7`) | Declarative `<Routes>` + `useSearchParams()` + `useNavigate()` | React Router v7 library mode; `/items/new` is a declarative sibling route. `[VERIFIED: frontend2/node_modules/react-router/package.json + routes/index.tsx]` |
| `react-hook-form` | 7.72.1 | Form state + dirty tracking + setValue for enrichment acceptance | Existing `ItemForm` uses it; `setValue(field, val, { shouldDirty: true })` is the documented API for D-14 per-field chips. `[VERIFIED: ItemForm.tsx:59]` |
| `zod` | 4.3.6 (semver `^4`) | Schema validation (existing `itemCreateSchema`) | `ItemForm` already validates barcode against `/^[A-Za-z0-9]+$/` + max 64 — scanned codes containing hyphens (e.g. Code128) need to PASS this regex; see Open Question 1. `[VERIFIED: schemas.ts:30-36]` |
| `@lingui/react` + `@lingui/core` | 5.9.5 | i18n — `t\`…\`` tagged template + `useLingui` | Phase 64 pattern: extract → gap-fill both `en/` + `et/` catalogs, run `bun run i18n:compile` to verify zero orphans. `[VERIFIED: 64-10 SUMMARY + locales/*/messages.po]` |

### Supporting (existing, reused)

| Library / Module | Purpose | When to Use in Phase 65 |
|------------------|---------|--------------------------|
| `@floating-ui/react` | Dialog portal + focus trap (already powering `RetroDialog`, `RetroConfirmDialog`) | `RetroConfirmDialog` for dirty-guard on `/items/new` |
| `uuid` / `@types/uuid` | ID generation (Phase 64 dep) | Not needed — `generateSku()` uses `Date.now().toString(36)` (existing) |
| `@yudiel/react-qr-scanner` | Camera-stream scanner | NOT touched in Phase 65 — Phase 64 already integrated it; Phase 65 only consumes decoded `code` via `banner` state |

### Alternatives Considered (and why NOT chosen)

| Instead of | Could Use | Why NOT in Phase 65 |
|------------|-----------|---------------------|
| Widen `ScanResultBanner` in place | New `ScanNotFoundPanel` + `ScanMatchPanel` + `ScanLoadingPanel` siblings | Phase 66 replaces banner wholesale with `QuickActionMenu`; a sibling split creates coupling Phase 66 would have to unwind. CONTEXT `<specifics>` locks this. |
| Single-query `useCombinedLookup(code)` returning both match + enrichment | Two separate hooks | ROADMAP SC#3 explicitly wires enrichment to `/items/new`, NOT to scan result banner. Separation keeps scan flow fast (one query) + puts enrichment in form context. |
| `add()` gains upsert semantics | Separate `update()` method | Race hazard: `add` fires on decode (before lookup), `update` fires after lookup resolves. If mixed, a second scan between decode and lookup-resolve can mutate the wrong entry. CONTEXT `<specifics>` D-22 locks separate method. |
| `staleTime: Infinity` app-level on enrichment | Per-query `staleTime: Infinity` | Per-query is simpler and keeps the "session-scoped cache for enrichment" intent local. No QueryClient mutation needed. |
| Inline dialog create-item on `/scan` (keeps scanner mounted) | Navigate to `/items/new` | Legacy parity + SC#2 URL verbatim. Acknowledged friction with Pitfall #1 but explicit scope decision (CONTEXT `<deferred>` flags "revisit if friction"). |
| GTIN-14 canonicalization | Raw string compare (D-07) | Deferred to v2.3+ per CONTEXT `<deferred>`. If users report UPC-A vs EAN-13 duplicates post-LOOK-01, revisit. |

**Installation:** None required — all deps in place. `[VERIFIED: frontend2/package.json]`

**Version verification:** Core deps verified against installed node_modules as of 2026-04-19. TanStack Query v5.99.0 is current stable; `staleTime` + `gcTime` + `enabled` API used throughout `/frontend2` is stable. `[VERIFIED: node_modules/@tanstack/react-query/package.json]`

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│  /scan (Phase 64 infrastructure; Phase 65 reuses unchanged)          │
│                                                                      │
│   BarcodeScanner  ──onDecode──►  ScanPage.handleDecode               │
│        │                                │                            │
│        │                                ├─► useScanFeedback.trigger()│
│        │                                ├─► useScanHistory.add(      │
│        │                                │     entityType: "unknown") │
│        │                                └─► setBanner({code,format}) │
│        │                                                             │
│        ▼ (paused via banner≠null)       ▼ NEW effect (Phase 65)      │
│   [paused but mounted]            useScanLookup(banner.code)         │
│                                         │                            │
│                                         ▼ TanStack Query             │
│                                   itemsApi.lookupByBarcode(wsId,code)│
│                                         │                            │
│                              ┌──────────┴──────────┐                 │
│                              ▼                     ▼                 │
│                      GET .../items?search=     HttpError / network   │
│                      &limit=1 (FTS)                 │                │
│                              │                     ▼                 │
│                  ┌───────────┴──────────┐    status: "error"         │
│                  ▼                      ▼                            │
│         items[0].barcode === code   empty OR guard-fail              │
│         AND workspace_id match                                       │
│                  │                      │                            │
│                  ▼                      ▼                            │
│         status: "success"      status: "success"                     │
│         match: Item            match: null                           │
│                                                                      │
│   ScanResultBanner renders ONE of FOUR states:                       │
│                                                                      │
│   ┌─ LOADING (status=loading) ─ "LOOKING UP…" + SCAN AGAIN           │
│   ├─ MATCH   (success + match)── "MATCHED" + name + short_code +     │
│   │                                VIEW ITEM ──► /items/{id}         │
│   ├─ NOT-FOUND (success + null)─ "NOT FOUND" + CREATE ITEM ──►       │
│   │                                /items/new?barcode=<code>         │
│   └─ ERROR   (status=error) ──── "LOOKUP FAILED" + RETRY + CREATE    │
│                                                                      │
│   On MATCH resolve: useScanHistory.update(code, {entityType:"item",  │
│                                              entityId: match.id})    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
                                    │
                CREATE ITEM WITH THIS BARCODE  (user tap)
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│  /items/new?barcode=<code>   (NEW route Phase 65)                    │
│                                                                      │
│   ItemFormPage (NEW)                                                 │
│   ├─ useSearchParams() → barcode                                     │
│   ├─ useState(generateSku()) on mount  (once, like ItemPanel)        │
│   ├─ useBarcodeEnrichment(barcode)  ──► TanStack Query               │
│   │    │  enabled: /^\d{8,14}$/.test(barcode)                        │
│   │    │  staleTime: Infinity                                        │
│   │    │  queryFn: barcodeApi.lookup(barcode)                        │
│   │    ▼                                                             │
│   │  GET /barcode/{code}  (public, unauth)                           │
│   │    │                                                             │
│   │    ▼                                                             │
│   │  { found, name, brand, category, image_url }                     │
│   │                                                                  │
│   ├─ UpcSuggestionBanner (if enrichment.data?.found)                 │
│   │   ├─ [USE] chip per field (name, brand)                          │
│   │   │   onClick: setValue(field, val, { shouldDirty: true })       │
│   │   ├─ Category helper text ONLY (no [USE], no category_id write)  │
│   │   ├─ USE ALL button                                              │
│   │   └─ DISMISS (local collapse state)                              │
│   │                                                                  │
│   ├─ ItemForm  (existing — reused, not forked)                       │
│   │   defaultValues={ barcode, sku }                                 │
│   │   onDirtyChange={setIsDirty}                                     │
│   │   onSubmit → useCreateItem.mutateAsync                           │
│   │                                                                  │
│   └─ Footer: CREATE ITEM + CANCEL                                    │
│       CANCEL ► if isDirty: RetroConfirmDialog("DISCARD CHANGES?")    │
│                 confirm ► navigate(-1)                               │
│                                                                      │
│   useCreateItem.onSuccess:                                           │
│   ├─ qc.invalidateQueries({ queryKey: itemKeys.all })                │
│   ├─ qc.invalidateQueries({ queryKey: scanKeys.lookup(code) })  D-04 │
│   └─ navigate(`/items/${created.id}`)                                │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component / Module | Responsibility | File (new vs. extended) |
|-------------------|----------------|--------------------------|
| `itemsApi.lookupByBarcode` | Exact-match + workspace guard over existing list() | `frontend2/src/lib/api/items.ts` (extended) |
| `barcodeApi.lookup` + `barcodeKeys` | External enrichment client | `frontend2/src/lib/api/barcode.ts` (NEW) |
| lib/api barrel export | Add `export * from "./barcode"` | `frontend2/src/lib/api/index.ts` (extended) |
| `useScanLookup(code)` | TanStack Query wrapper; body-swap only (shape locked) | `frontend2/src/features/scan/hooks/useScanLookup.ts` (body swap) |
| `useScanHistory.update(code, patch)` | Post-lookup entityType/entityId backfill (D-22) | `frontend2/src/features/scan/hooks/useScanHistory.ts` (extended) |
| `updateScanHistory(code, patch)` (lib-level) | Module-scope mutator backing `useScanHistory.update` | `frontend2/src/lib/scanner/scan-history.ts` (extended) |
| `useBarcodeEnrichment(code)` | Enrichment query hook with regex gate | `frontend2/src/features/items/hooks/useBarcodeEnrichment.ts` (NEW) |
| `ScanResultBanner` | Four states: LOADING / MATCH / NOT-FOUND / ERROR | `frontend2/src/components/scan/ScanResultBanner.tsx` (widened in-place) |
| `ScanPage` | Remove `void lookup;` (line 83); wire match-effect calling `useScanHistory.update` | `frontend2/src/features/scan/ScanPage.tsx` (extended) |
| `ItemFormPage` | `/items/new?barcode=` page orchestrator | `frontend2/src/features/items/ItemFormPage.tsx` (NEW) |
| `UpcSuggestionBanner` | Per-field [USE] chips + USE ALL + DISMISS + category hint | `frontend2/src/features/items/UpcSuggestionBanner.tsx` (NEW) |
| Route registration | `<Route path="items/new" element={<ItemFormPage />} />` | `frontend2/src/routes/index.tsx` (extended) |
| EN catalog entries | New msgid entries for all new strings | `frontend2/locales/en/messages.po` (extended) |
| ET catalog entries | ET translations for every new msgid | `frontend2/locales/et/messages.po` (extended) |

### Recommended Project Structure (what Phase 65 writes to)

```
frontend2/
├── src/
│   ├── components/
│   │   └── scan/
│   │       └── ScanResultBanner.tsx        # WIDENED (four states)
│   ├── features/
│   │   ├── items/
│   │   │   ├── ItemFormPage.tsx            # NEW
│   │   │   ├── UpcSuggestionBanner.tsx     # NEW
│   │   │   └── hooks/
│   │   │       └── useBarcodeEnrichment.ts # NEW
│   │   └── scan/
│   │       ├── ScanPage.tsx                # small edit: remove void lookup; add match-effect
│   │       └── hooks/
│   │           ├── useScanLookup.ts        # body swap (shape locked)
│   │           └── useScanHistory.ts       # add update() method
│   ├── lib/
│   │   ├── api/
│   │   │   ├── barcode.ts                  # NEW
│   │   │   ├── items.ts                    # +lookupByBarcode helper
│   │   │   └── index.ts                    # +export * from "./barcode"
│   │   └── scanner/
│   │       └── scan-history.ts             # +updateScanHistory module function
│   └── routes/
│       └── index.tsx                       # +Route path="items/new"
└── locales/
    ├── en/messages.po                      # +new msgids
    └── et/messages.po                      # +ET translations for new msgids
```

### Pattern 1: TanStack Query workspace-scoped lookup with defense-in-depth

**What:** Wrap the existing list endpoint with a helper that performs BOTH the exact-barcode guard AND the workspace_id assertion inside the helper, so callers cannot forget either guard.

**When to use:** Every barcode-scoped lookup in Phase 65 (and future container/location lookups when they arrive).

**Example:** (derived from architecture research Q3 + D-06/D-07/D-08)
```ts
// frontend2/src/lib/api/items.ts — ADD to itemsApi
lookupByBarcode: async (wsId: string, code: string): Promise<Item | null> => {
  const res = await itemsApi.list(wsId, { search: code, limit: 1 });
  const candidate = res.items[0];
  if (!candidate) return null;
  // D-07: case-sensitive exact-barcode guard
  if (candidate.barcode !== code) return null;
  // D-08: workspace defense-in-depth (Pitfall #5)
  if (candidate.workspace_id !== wsId) {
    console.error({
      kind: "scan-workspace-mismatch",
      code,
      returnedWs: candidate.workspace_id,
      sessionWs: wsId,
    });
    return null;
  }
  return candidate;
},
```
Source: `[CITED: .planning/research/ARCHITECTURE.md §Q3 lines 158-169]` + `[VERIFIED: 65-CONTEXT.md D-06/D-07/D-08]`

### Pattern 2: Page-level dirty-guard mirroring `ItemPanel` / `SlideOverPanel`

**What:** `ItemFormPage` holds `isDirty` state fed by `ItemForm.onDirtyChange`; CANCEL and navigate-away attempts open a `RetroConfirmDialog` when dirty.

**When to use:** Every new full-page form in `/frontend2` that reuses `ItemForm` (or any react-hook-form-driven form).

**Example:** (pattern from `SlideOverPanel.tsx:52-63`, copy verbatim but at page level)
```ts
// frontend2/src/features/items/ItemFormPage.tsx
const [isDirty, setIsDirty] = useState(false);
const discardRef = useRef<RetroConfirmDialogHandle>(null);
const navigate = useNavigate();
const handleCancel = useCallback(() => {
  if (isDirty) {
    discardRef.current?.open();
    return;
  }
  navigate(-1);
}, [isDirty, navigate]);
// render:
<RetroConfirmDialog
  ref={discardRef}
  variant="destructive"
  title={t`DISCARD CHANGES?`}
  body={t`Your edits will be lost.`}
  escapeLabel={t`← BACK`}
  destructiveLabel={t`DISCARD`}
  onConfirm={() => navigate(-1)}
/>
```
Source: `[VERIFIED: frontend2/src/features/taxonomy/panel/SlideOverPanel.tsx:56-80, 125-135]`

### Pattern 3: SKU-generate-once on mount

**What:** Generate SKU inside `useState` initializer so it's stable across re-renders.

**When to use:** Any create-mode form that auto-generates SKU (LOOK-02 form page).

**Example:** (copy of `ItemPanel.tsx:36-48` pattern, simplified for page-level)
```ts
// frontend2/src/features/items/ItemFormPage.tsx
// NOT: const sku = generateSku();  // re-runs every render
// YES:
const [generatedSku] = useState(() => generateSku());
const [searchParams] = useSearchParams();
const barcode = searchParams.get("barcode") ?? "";
const defaultValues = useMemo(
  () => ({ sku: generatedSku, barcode }),
  [generatedSku, barcode],
);
```
Source: `[VERIFIED: frontend2/src/features/items/panel/ItemPanel.tsx:36-52]`

### Pattern 4: Structured console.error with `kind` discriminator (Phase 64 D-12 vocabulary)

**What:** All non-user-facing observability logs use `console.error({ kind, ...context })` so future telemetry can filter by `kind`.

**When to use:** D-08 workspace mismatch, D-16 enrichment failure, and any other silent failure that should still surface in dev-tools.

**Existing vocabulary** (verify before adding new `kind` strings): `[VERIFIED: grep for "kind:" in frontend2/src]`
- Phase 64 uses: `permission-denied`, `library-init-fail`, `no-camera`, `format-unsupported` (on `ScanErrorPanel`)
- Phase 65 NEW kinds: `scan-workspace-mismatch` (D-08), `upc-enrichment-fail` (D-16)

**Example:**
```ts
console.error({
  kind: "upc-enrichment-fail",
  code,
  error: err instanceof Error ? err.message : String(err),
  timestamp: Date.now(),
});
```
Source: `[VERIFIED: frontend2/src/components/scan/ScanErrorPanel.tsx:47-58]`

### Pattern 5: `workspaceId!` + `enabled: !!workspaceId` idiom

**What:** Workspace-scoped queries use the non-null assertion inside `queryFn` gated by `enabled`.

**When to use:** Every TanStack Query in `/frontend2` that depends on workspace context.

**Example:** `[VERIFIED: frontend2/src/features/items/hooks/useItemsList.ts:17-25]`
```ts
const { workspaceId } = useAuth();
return useQuery({
  queryKey: scanKeys.lookup(code),
  queryFn: () => itemsApi.lookupByBarcode(workspaceId!, code),
  enabled: !!code && !!workspaceId,
  staleTime: 30_000,
  gcTime: 300_000,
});
```

### Pattern 6: `useSearchParams()` for URL-driven state

**What:** Read URL query params declaratively via React Router v7's `useSearchParams`.

**When to use:** `?barcode=` on `/items/new` (D-02); any other deep-linkable parameter.

**Example:** `[VERIFIED: frontend2/src/features/items/filters/useItemsListQueryParams.ts:36-45]`
```ts
const [searchParams] = useSearchParams();
const barcode = searchParams.get("barcode") ?? "";
```

Note: `useSearchParams` returns live-tracking search params; re-renders when the URL changes. For write scenarios, the setter accepts either a `URLSearchParams` object or an updater function. Phase 65 only reads.

### Anti-Patterns to Avoid

- **Splitting banner into siblings:** Phase 66 replaces `ScanResultBanner` wholesale; sibling components would force Phase 66 to choose which to replace. CONTEXT `<specifics>` locks in-place widening.
- **Merging `add()` with `update()`:** Race hazard per D-22. Keep them as two methods.
- **Auto-writing category_id from enrichment string:** D-15 anti-feature. Helper-text-only or nothing.
- **Rendering enrichment banner on `ScanResultBanner`:** ROADMAP SC#3 wires it to the item-create form, NOT the scan-result banner. Two reasons: fast scan flow, and enrichment decision point where user is filling form.
- **Skipping workspace_id guard because backend already filters:** Pitfall #5 is real; frontend assertion catches backend regressions.
- **Calling `useBarcodeEnrichment` without the regex gate:** Backend enforces 8–14 numeric; calling with QR/alphanumeric returns 422 (not a functional error but noise + slow feedback).
- **Using `staleTime: 0` on `scanKeys.lookup`:** Rescanning within a session should hit cache (D-09 chose 30s). Only flip this if you observe stale "not found" bugs; invalidation on create success (D-04) is the intended guard.
- **Bypassing `ItemForm` and re-implementing the zod schema:** The existing form handles the barcode pattern `/^[A-Za-z0-9]+$/`; if scanned codes ever contain hyphens (Code128), adjust the schema once (see Open Question 1), not bypass it.
- **Adding a new retro atom:** Phase 65 explicitly does NOT widen the retro barrel (D-13). `UpcSuggestionBanner` composes `RetroPanel` + `HazardStripe` + `RetroButton`.
- **Mounting `ItemForm` without `onDirtyChange` wiring:** Dirty-guard breaks silently. Mirror `ItemPanel.tsx:128`.
- **Putting enrichment fetch in `ScanResultBanner`:** D-12 hook lives under `features/items/hooks/` because it's form-adjacent, not scan-adjacent.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Lookup result caching | Custom per-code memo | TanStack Query `scanKeys.lookup(code)` | Already the v2.1 data layer; `invalidateQueries` on create is idiomatic; handles deduplication + refetch semantics; `useQuery` exposes `refetch` for D-21 RETRY button |
| Dirty-form detection | Manual `useEffect` comparing values | `react-hook-form` `formState.isDirty` (already piped via `ItemForm.onDirtyChange`) | Built-in, dep-tracked, no stale-closure risk |
| Discard-changes confirmation | Custom dialog | `RetroConfirmDialog` (already used by `SlideOverPanel`) | Ships with focus trap, ESC key, a11y, retro styling; copy verbatim via `t\`…\`` |
| Barcode-string regex validation (existing `itemCreateSchema`) | Custom validator | zod `.regex(/^[A-Za-z0-9]+$/)` (already in schemas.ts) | Consistent error messaging; existing UI pattern |
| URL search-param parsing | `new URLSearchParams(location.search)` | `useSearchParams()` from react-router | Reactive to URL changes; integrates with history/back-button |
| Barcode canonicalization (UPC-A → EAN-13 padding) | Custom normalizer | **Deferred to v2.3+** (CONTEXT `<deferred>`) | Not in Phase 65 scope; raw-string compare per D-07; revisit if duplicates reported |
| Retro visual feedback (hazard stripe, panel, button) | Custom SVG/Tailwind chrome | `RetroPanel` / `HazardStripe` / `RetroButton` | Existing atoms; retro barrel closed for Phase 65 |
| i18n string handling | Hardcoded English | Lingui `t\`…\`` + `useLingui` | All other /frontend2 code uses this; extract+compile pipeline enforced |
| Post-lookup history backfill debouncing | setTimeout / manual dedupe | `useScanHistory.update(code, patch)` wired from an effect gated on `lookup.status === 'success'` | Single source of truth (localStorage); update is idempotent |

**Key insight:** Phase 65 is *entirely* a composition of already-owned primitives. Every new piece of code is either (a) a thin wrapper over an existing API/hook, or (b) wires already-built atoms into a new shape. No new libraries, no new retro atoms, no new CSS tokens. The temptation to "just inline a small dialog" or "quickly hand-roll the dirty check" should be resisted — existing patterns exist for every concern.

## Runtime State Inventory

**Phase 65 scope:** Code + feature addition (NOT a rename/refactor/migration). This section is included because Phase 65 writes to localStorage (`hws-scan-history`) and interacts with TanStack Query cache — both are forms of runtime state.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data (localStorage) | Phase 64 shipped `hws-scan-history` (array of `ScanHistoryEntry`). Phase 65 extends entries via D-22 backfill: entries now gain `entityType: "item"` + `entityId: <uuid>` after lookup resolve. | No migration needed — `ScanHistoryEntry` fields are optional (`entityId?`, `entityName?`). Old entries stay `entityType: "unknown"`; new entries after Phase 65 ship get backfilled post-lookup. `[VERIFIED: lib/scanner/types.ts:22-37]` |
| Live service config | None — Phase 65 adds no new services, no new env vars, no backend config changes. | None |
| OS-registered state | None — browser SPA; no tasks, services, or OS registrations touched. | None |
| Secrets / env vars | None — public `/api/barcode/{code}` endpoint is unauthenticated; no API key, no bearer token, no env var. | None |
| Build artifacts | After Phase 65 ships, `dist/assets/index-*.js` will include the new route chunk and the `lib/api/barcode.ts` helper. No stale artifacts — Vite full rebuild on every CI run. | Re-run `bun run build` after Phase 65 merges to refresh `/dist` for deployments. |
| TanStack Query cache | Runtime cache entries for `scanKeys.lookup(code)` (30s stale) and NEW `barcodeKeys.lookup(code)` (Infinity stale). | Create mutation must invalidate `scanKeys.lookup(code)` per D-04; `barcodeKeys` never invalidated (session-scoped enrichment cache). Document invalidation surface in Wave 0 test. |

**Key verification:** Phase 65 is NOT a rename — it's an additive phase. No Phase 64 files are renamed; locked references (`ScanLookupResult`, `scanKeys`, `useScanLookup(code)` signature, ScanPage callsite) must remain identical or Test 15 fails.

## Common Pitfalls

### Pitfall 1: Cross-tenant leak on globally-unique UPCs (PITFALLS.md #5 — BLOCKER)

**What goes wrong:** Every can of Coca-Cola in the world carries barcode `5449000000996`. If User A and User B both scan it and both have items with that barcode in their respective workspaces, a backend regression could return User B's item to User A's session.

**Why it happens:** Barcodes are global keys (GS1 intent). Developers model them as primary-ish and forget the multi-tenant constraint. The backend *currently* filters by workspace server-side, but v2.2 adds scan integrations that might invent new lookup query parameters without re-applying scoping.

**How to avoid:** D-08 frontend defense-in-depth — `lookupByBarcode` asserts `candidate.workspace_id === wsId`. On mismatch, emit structured `console.error({ kind: "scan-workspace-mismatch" })` and return `null` (treated as NOT-FOUND in UI per UI-SPEC "Error/empty states" table). `[VERIFIED: .planning/research/PITFALLS.md #5 lines 192-208 + 65-CONTEXT D-08]`

**Warning signs:**
- Any new barcode-related endpoint in `lib/api/` that doesn't accept `wsId` as first arg.
- Any TanStack Query that caches a barcode key without `workspaceId` in the dep chain.
- Two users in local-dev with the same barcode in different workspaces: acceptance test fixture.

**Phase gate:** MUST have a unit test asserting `lookupByBarcode` returns `null` (+ logs) when `response.items[0].workspace_id !== wsId`.

### Pitfall 2: TanStack Query "stale not-found" after scan→create→rescan (PITFALLS.md #7 — MAJOR)

**What goes wrong:**
1. User scans `5449000000996` → query fetches, gets empty/guard-fail, caches `null` under `scanKeys.lookup("5449000000996")`.
2. User creates item with that barcode on `/items/new`.
3. User navigates back to `/scan`, rescans. TanStack returns cached `null`. UI shows NOT-FOUND. User creates duplicate.

**Why it happens:** `useCreateItem.onSuccess` only invalidates `itemKeys.all` (current Phase 60 code at `useItemMutations.ts:40`). `scanKeys.lookup(code)` keeps the stale miss.

**How to avoid:** D-04 extends the onSuccess behavior for the `/items/new` create specifically — EITHER modify `useCreateItem` globally OR wire `onSuccess` at the `ItemFormPage` call-site passing `code` in closure. Recommended: do the invalidation at the `ItemFormPage` call-site to avoid coupling `useCreateItem` to scan concerns.

Implementation sketch:
```ts
// frontend2/src/features/items/ItemFormPage.tsx
const qc = useQueryClient();
const createMutation = useCreateItem();
const onSubmit = async (values: ItemCreateValues) => {
  const created = await createMutation.mutateAsync(values);
  // D-04 extra invalidation on top of useCreateItem's itemKeys.all invalidation
  if (barcode) {
    qc.invalidateQueries({ queryKey: scanKeys.lookup(barcode) });
  }
  navigate(`/items/${created.id}`);
};
```

Source: `[VERIFIED: PITFALLS.md #7 lines 240-265 + CONTEXT D-04]`

**Warning signs:** User reports "I created it but the scanner still says not found." Duplicate-item rows in the DB sharing the same `barcode`.

**Phase gate:** Integration test: mock create, then re-call `useScanLookup(code)`, assert it refetches (not cached `null`).

### Pitfall 3: iOS PWA camera permission reset on /scan → /items/new → back (PITFALLS.md #1 — BLOCKER, ACKNOWLEDGED)

**What goes wrong:** User scans on iOS PWA → taps CREATE ITEM WITH THIS BARCODE → navigates to `/items/new` → fills + submits → back to `/scan` → iOS re-prompts for camera permission (or returns `NotAllowedError`). In worst case, permission-prompt loop.

**Why it happens:** iOS Safari standalone-mode PWAs bind camera permission to a narrower scope than tabbed browser. Route-change with path alteration triggers fresh permission check. PITFALLS.md #1 documents this as the single most-impactful scanner constraint.

**How Phase 65 accepts this:** ROADMAP SC#2 explicitly wires CREATE ITEM to `/items/new?barcode=<code>` — a real navigation, not an in-place dialog. This is a **conscious scope decision** (see CONTEXT `<deferred>` "Inline RetroDialog create-item flow on `/scan`" marked "milestone-level revisit if friction").

The mitigation that DOES apply in Phase 65:
- Scanner stays mounted on `/scan` until the navigation fires. Phase 64's `paused` prop (not unmount) keeps the stream alive.
- On return from `/items/new` (browser back), React Router remounts `ScanPage`. Phase 64 scanner wraps `Scanner` with robust cleanup (`ref`-array + `cancelled` flag). `[VERIFIED: BarcodeScanner.tsx cleanup patterns via 64-RESEARCH]`
- No in-phase code change needed for Pitfall #1 — it's a Phase 64-owned concern.

**Open question race — documented but NOT a blocker:** Does `useScanHistory.update` race with nav unmount? Analysis: (a) `ScanPage` fires `update` from an effect gated on `lookup.status === "success"`. (b) The nav to `/items/new` happens AFTER user taps CREATE ITEM — but CREATE ITEM is a NOT-FOUND-state button, so `match` is `null`, so the `update` effect never fires for the not-found path. (c) On the MATCH path, the user taps VIEW ITEM (navigates to `/items/{id}`, NOT `/items/new`), which is OUT of Phase 65's create-flow scope. Conclusion: No race — update only fires on success+match; nav on success+match goes elsewhere; nav on not-found has no update. Document this invariant in `ScanPage.tsx` as a code comment.

**Phase gate:** Manual UAT entry in VERIFICATION.md (transferred from VALIDATION.md manual checklist — iOS-only): "Scan not-found code → CREATE ITEM → fill+submit → browser back to /scan → second decode does not re-prompt for permission."

### Pitfall 4: `ItemForm`'s barcode regex (`/^[A-Za-z0-9]+$/`) rejects scans with hyphens

**What goes wrong:** A Code128 scan of "ABC-123-XYZ" passes through the lookup hook (D-07 is a raw compare) but fails zod validation on `/items/new` — the form won't save. User hits a dead end.

**Why it happens:** `itemCreateSchema` was authored in Phase 60 before scanning existed. The regex was tightened to match SKU conventions (which exclude hyphens) — but barcode and SKU are distinct fields with different conventions.

**How to avoid:** Audit Phase 64 test fixtures — the mock scanner currently uses "ABC-123" and "TEST-CODE-123" and "HIST-01" etc. These have HYPHENS. Real-world Code128 symbologies commonly include hyphens. Two options:

1. **Loosen the schema** (recommended): change to `/^[A-Za-z0-9\-_]+$/` or `/^[\x20-\x7E]+$/` (printable ASCII). Low risk, matches scanner reality.
2. **Strip/sanitize on ingest**: reject in the lookup helper — hides the mismatch.

Option 1 is the smaller diff and more honest. If chosen: update `schemas.ts:34` regex + update `ItemPanel.tsx` test expectations + i18n error string.

**Note:** This is NOT one of the 22 locked decisions. It surfaced during research. The planner should flag this as an Open Question and ask the user before shipping. See Open Questions §1 below.

**Warning signs:**
- Automated test: submit `ItemFormPage` with `barcode: "ABC-123"` and assert no validation error fires on the barcode field.
- Manual UAT: scan a real Code128 sample with hyphen → CREATE ITEM → submit.

### Pitfall 5: React Router v7 useSearchParams + RHF defaultValues freshness

**What goes wrong:** If a user:
1. Scans code A → `/items/new?barcode=A` → browser back (URL returns to `/scan`).
2. Scans code B → `/items/new?barcode=B`.
3. RHF's `defaultValues` were initialized from URL on first mount. After browser-forward-nav, the form MIGHT show stale barcode `A` depending on whether the component remounts or reuses state.

**Why it happens:** React Router v7 navigations to the same route path don't always unmount; RHF's `useForm({ defaultValues })` initializes only on first mount.

**How to avoid:**
- In `ItemFormPage`, derive `defaultValues` inside `useMemo` keyed on `[searchParams.get("barcode"), generatedSku]`.
- If the page could be reused across nav (it won't be, since `/items/new` is a terminal destination), use `form.reset(defaultValues)` in a mount effect.
- Practical mitigation: React Router v7 with declarative routes DOES remount when the URL search string changes while the path is the same — verified behavior. `[VERIFIED: react-router v7 NavLink + useSearchParams docs; CITED: react-router.com/hooks/use-search-params]`

**How to avoid the broader class:** Use `key={searchParams.get("barcode")}` on `ItemForm` as a belt-and-suspenders remount trigger if real-world behavior shows staleness.

**Warning signs:**
- Scan A, back, scan B, observe form shows barcode A.
- RHF `formState.defaultValues` logged in devtools doesn't match URL.

**Phase gate:** Unit test: render `ItemFormPage` with `?barcode=A`, then re-render with `?barcode=B`, assert form shows B.

### Pitfall 6: Lingui extract/compile: catalog drift across phases

**What goes wrong:** New `t\`…\`` strings are added but `bun run i18n:extract` isn't run, so `messages.po` stays stale; catalog looks complete but shipping is missing the new keys.

**Why it happens:** Easy to forget the extract step. Phase 64 Plan 64-10 specifically carved out a dedicated i18n wave with a `bun run i18n:compile` zero-orphan-warning gate.

**How to avoid:**
- Reserve a dedicated wave (Wave 3) for i18n extract + ET gap-fill + compile verification, same as Phase 64 Plan 64-10.
- Gate: `cd frontend2 && bun run i18n:extract` must produce a diff; `bun run i18n:compile` must exit 0 with zero warnings.
- Check `frontend2/locales/et/messages.po` — every new `msgid` must have a non-empty `msgstr` matching the ET translation convention. `[VERIFIED: locales/et/messages.po header format]`

**Warning signs:**
- `lingui extract` produces unexpected diff in Wave 3.
- Compile warnings: `[warning] Missing translation for ...`.
- Tests fail after a translation edit that landed in `.po` but not in `.js`.

### Pitfall 7: Bundle regression on `/scan` chunk

**What goes wrong:** Phase 65's new enrichment code lands in the `/scan` chunk instead of `/items/new`, regressing the Phase 64 −37.8 kB gzip savings.

**Why it happens:** Vite's manual-chunk function in `vite.config.ts` currently groups `@yudiel/react-qr-scanner`, `barcode-detector`, `zxing-wasm`, `webrtc-adapter` into a single `scanner` chunk. Phase 65 adds NO entries to this list. However, if `useBarcodeEnrichment` is accidentally imported by `ScanPage` or `ScanResultBanner` (instead of staying in `features/items/`), the enrichment code could bleed into the scan route's chunk. `[VERIFIED: vite.config.ts:31-58]`

**How to avoid:**
- Keep `useBarcodeEnrichment` import tree under `features/items/**` only. Do NOT import from `features/scan/**`.
- `/items/new` is route-lazy-split via React.lazy (recommended). Even if React.lazy is skipped (eager import), the enrichment code goes into the main chunk, NOT the scan chunk.
- Wave 4 gate: `bun run build` + compare `dist/assets/scanner-*.js` gzip size against Phase 64 baseline (archived in 64-VERIFICATION.md). Delta must be 0 or negative.
- Overall main-chunk delta ≤ 5 kB gzip per CONTEXT budget (≤ 3 kB for the /items/new bits + ≤ 500 bytes for `lib/api/barcode.ts` + ≤ 1 kB each for hook and banner).

**Warning signs:**
- `dist/assets/scanner-<hash>.js` grows.
- `bun run build` output shows size increase on the scan chunk.

### Pitfall 8: Forbidden-import CI grep guard on `barcode.ts` / `enrichment`

**What goes wrong:** Module name or import specifier accidentally contains `offline` or `sync` substrings, CI fails on `bun run lint:imports`.

**Why it happens:** `scripts/check-forbidden-imports.mjs` checks **import specifiers** (in `from '...'` or `import('...')` clauses) for substring `offline|sync` (case-insensitive). It's NOT filename-based — it's whatever appears inside the quotes. `[VERIFIED: scripts/check-forbidden-imports.mjs:22-24]`

**How to avoid:**
- DO NOT name things like `barcode-sync-helper` or `enrichment-offline-fallback`.
- Safe names Phase 65 uses: `barcode.ts`, `useBarcodeEnrichment.ts`, `UpcSuggestionBanner.tsx`. None contain forbidden substrings.
- Verification: `cd frontend2 && bun run lint:imports` must exit 0 after every wave.

## Code Examples

All examples below are **sketches** (not complete files) derived from the verified patterns in the existing `/frontend2` tree. The planner should include full files with imports, types, and test coverage.

### Example 1: `itemsApi.lookupByBarcode` + unit test

```ts
// frontend2/src/lib/api/items.ts — APPEND to itemsApi object (do NOT remove existing list/get/create)

// D-06: wraps existing list() with D-07 exact-barcode guard + D-08 workspace_id defense
lookupByBarcode: async (wsId: string, code: string): Promise<Item | null> => {
  const res = await itemsApi.list(wsId, { search: code, limit: 1 });
  const candidate = res.items[0];
  if (!candidate) return null;
  if (candidate.barcode !== code) return null;          // D-07
  if (candidate.workspace_id !== wsId) {                // D-08 (Pitfall #5 guard)
    console.error({
      kind: "scan-workspace-mismatch",
      code,
      returnedWs: candidate.workspace_id,
      sessionWs: wsId,
    });
    return null;
  }
  return candidate;
},
```

```ts
// frontend2/src/lib/api/__tests__/items.lookupByBarcode.test.ts  (NEW)
import { describe, expect, it, vi } from "vitest";
import { itemsApi } from "@/lib/api/items";

describe("itemsApi.lookupByBarcode", () => {
  it("returns null on empty list", async () => {
    vi.spyOn(itemsApi, "list").mockResolvedValue({ items: [], total: 0, page: 1, total_pages: 0 });
    expect(await itemsApi.lookupByBarcode("ws-1", "5449000000996")).toBeNull();
  });

  it("returns null on guard-fail (barcode differs case-sensitively)", async () => {
    vi.spyOn(itemsApi, "list").mockResolvedValue({
      items: [{ id: "x", workspace_id: "ws-1", barcode: "abc-123" /* rest elided */ } as never],
      total: 1, page: 1, total_pages: 1,
    });
    expect(await itemsApi.lookupByBarcode("ws-1", "ABC-123")).toBeNull();
  });

  it("logs + returns null on workspace mismatch (Pitfall #5 guard)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(itemsApi, "list").mockResolvedValue({
      items: [{ id: "x", workspace_id: "ws-OTHER", barcode: "5449000000996" } as never],
      total: 1, page: 1, total_pages: 1,
    });
    expect(await itemsApi.lookupByBarcode("ws-1", "5449000000996")).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(expect.objectContaining({
      kind: "scan-workspace-mismatch",
      returnedWs: "ws-OTHER",
      sessionWs: "ws-1",
    }));
  });

  it("returns the item on exact match + workspace match", async () => {
    const item = { id: "x", workspace_id: "ws-1", barcode: "5449000000996" } as never;
    vi.spyOn(itemsApi, "list").mockResolvedValue({ items: [item], total: 1, page: 1, total_pages: 1 });
    expect(await itemsApi.lookupByBarcode("ws-1", "5449000000996")).toBe(item);
  });
});
```

### Example 2: `useScanLookup` body swap (shape locked)

```ts
// frontend2/src/features/scan/hooks/useScanLookup.ts (REWRITE body; keep shape)
import { useQuery } from "@tanstack/react-query";
import { itemsApi } from "@/lib/api/items";
import { scanKeys, type ScanLookupResult } from "@/lib/api/scan";
import { useAuth } from "@/features/auth/AuthContext";

export function useScanLookup(code: string | null): ScanLookupResult {
  const { workspaceId } = useAuth();
  const query = useQuery({
    queryKey: scanKeys.lookup(code ?? ""),
    queryFn: () => itemsApi.lookupByBarcode(workspaceId!, code!),
    enabled: !!code && !!workspaceId,
    staleTime: 30_000,
    gcTime: 300_000,
  });

  // Map TanStack status → ScanLookupStatus (D-18 union is exhaustive)
  // idle    = before enabled (no code, no workspace)
  // loading = fetching with no cached data
  // success = fetched (match may be Item or null)
  // error   = query errored
  let status: ScanLookupResult["status"];
  if (!code || !workspaceId) status = "idle";
  else if (query.isPending) status = "loading";
  else if (query.isError) status = "error";
  else status = "success";

  return {
    status,
    match: query.data ?? null,
    error: query.error ?? null,
    refetch: () => { void query.refetch(); },
  };
}
```

Note on `isPending` vs `isLoading`: TanStack Query v5 renamed `isLoading` → `isPending`. Use `isPending` for "no data yet, enabled, fetching". `[CITED: TanStack Query v5 migration guide — isPending is the v5 name]`

### Example 3: `useScanHistory.update` (D-22 separate method)

```ts
// frontend2/src/lib/scanner/scan-history.ts — ADD module-scope function
export function updateScanHistory(
  code: string,
  patch: Partial<Pick<ScanHistoryEntry, "entityType" | "entityId" | "entityName">>,
): void {
  if (typeof window === "undefined") return;
  try {
    const history = getScanHistory();
    const idx = history.findIndex((h) => h.code === code);
    if (idx === -1) return; // no matching entry — silently noop (D-22 race guard)
    const updated = [...history];
    updated[idx] = { ...updated[idx], ...patch };
    localStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(updated));
  } catch (error) {
    console.warn("[ScanHistory] Failed to update history:", error);
  }
}
```

```ts
// frontend2/src/features/scan/hooks/useScanHistory.ts — ADD update method
const update = useCallback(
  (code: string, patch: Partial<Pick<ScanHistoryEntry, "entityType" | "entityId" | "entityName">>) => {
    updateScanHistory(code, patch);
    setEntries(getScanHistory());
  },
  [],
);
return { entries, add, update, remove, clear };
```

```ts
// frontend2/src/features/scan/ScanPage.tsx — WIRE match-effect near useScanLookup callsite
// (inside ScanPage body, after the lookup line)
useEffect(() => {
  if (lookup.status === "success" && lookup.match) {
    history.update(lookup.match.barcode ?? banner?.code ?? "", {
      entityType: "item",
      entityId: lookup.match.id,
      entityName: lookup.match.name,
    });
  }
}, [lookup.status, lookup.match, banner?.code, history]);
```

### Example 4: `barcodeApi` + `useBarcodeEnrichment`

```ts
// frontend2/src/lib/api/barcode.ts (NEW)
import { get } from "@/lib/api";

export interface BarcodeProduct {
  barcode: string;
  name: string;
  brand?: string | null;
  category?: string | null;
  image_url?: string | null;
  found: boolean;
}

export const barcodeApi = {
  lookup: (code: string) => get<BarcodeProduct>(`/barcode/${encodeURIComponent(code)}`),
};

export const barcodeKeys = {
  all: ["barcode"] as const,
  lookups: () => [...barcodeKeys.all, "lookup"] as const,
  lookup: (code: string) => [...barcodeKeys.lookups(), code] as const,
};
```

```ts
// frontend2/src/features/items/hooks/useBarcodeEnrichment.ts (NEW)
import { useQuery } from "@tanstack/react-query";
import { barcodeApi, barcodeKeys, type BarcodeProduct } from "@/lib/api/barcode";

const NUMERIC_8_TO_14 = /^\d{8,14}$/;

export function useBarcodeEnrichment(code: string | null) {
  return useQuery<BarcodeProduct>({
    queryKey: barcodeKeys.lookup(code ?? ""),
    queryFn: async () => {
      try {
        return await barcodeApi.lookup(code!);
      } catch (error) {
        console.error({
          kind: "upc-enrichment-fail",
          code,
          error: error instanceof Error ? error.message : String(error),
          timestamp: Date.now(),
        });
        throw error; // let TanStack Query see the error; UI treats as "not found"
      }
    },
    enabled: !!code && NUMERIC_8_TO_14.test(code ?? ""),
    staleTime: Infinity,
    retry: false, // silent failure per D-16; don't hammer the public endpoint
  });
}
```

### Example 5: `ItemFormPage` skeleton

```tsx
// frontend2/src/features/items/ItemFormPage.tsx (NEW)
import { useCallback, useId, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useLingui } from "@lingui/react/macro";
import {
  RetroButton,
  RetroConfirmDialog,
  type RetroConfirmDialogHandle,
} from "@/components/retro";
import { ItemForm } from "./forms/ItemForm";
import { generateSku, type ItemCreateValues } from "./forms/schemas";
import { useCreateItem } from "./hooks/useItemMutations";
import { useBarcodeEnrichment } from "./hooks/useBarcodeEnrichment";
import { UpcSuggestionBanner } from "./UpcSuggestionBanner";
import { scanKeys } from "@/lib/api/scan";

export function ItemFormPage() {
  const { t } = useLingui();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const barcode = searchParams.get("barcode") ?? "";
  const formId = useId();

  const [generatedSku] = useState(() => generateSku());
  const [isDirty, setIsDirty] = useState(false);
  const discardRef = useRef<RetroConfirmDialogHandle>(null);

  const createMutation = useCreateItem();
  const enrichment = useBarcodeEnrichment(barcode || null);

  const defaultValues = useMemo<Partial<ItemCreateValues>>(
    () => ({ sku: generatedSku, barcode }),
    [generatedSku, barcode],
  );

  const onSubmit = useCallback(
    async (values: ItemCreateValues) => {
      const created = await createMutation.mutateAsync(values);
      if (barcode) qc.invalidateQueries({ queryKey: scanKeys.lookup(barcode) });
      navigate(`/items/${created.id}`);
    },
    [barcode, createMutation, navigate, qc],
  );

  const handleCancel = useCallback(() => {
    if (isDirty) { discardRef.current?.open(); return; }
    navigate(-1);
  }, [isDirty, navigate]);

  const isPending = createMutation.isPending;
  const submitLabel = isPending ? t`WORKING…` : t`CREATE ITEM`;

  return (
    <div className="max-w-[720px] mx-auto p-lg flex flex-col gap-lg">
      <h1 className="text-[20px] font-bold uppercase tracking-wider text-retro-ink">
        {t`NEW ITEM`}
      </h1>

      {enrichment.data?.found && (
        <UpcSuggestionBanner
          data={enrichment.data}
          formId={formId}
        />
      )}

      <ItemForm
        formId={formId}
        onSubmit={onSubmit}
        onDirtyChange={setIsDirty}
        defaultValues={defaultValues}
      />

      <div className="flex gap-sm justify-end">
        <RetroButton variant="neutral" type="button" onClick={handleCancel}>
          {t`CANCEL`}
        </RetroButton>
        <RetroButton variant="primary" type="submit" form={formId} disabled={isPending}>
          {submitLabel}
        </RetroButton>
      </div>

      <RetroConfirmDialog
        ref={discardRef}
        variant="destructive"
        title={t`DISCARD CHANGES?`}
        body={t`Your edits will be lost.`}
        escapeLabel={t`← BACK`}
        destructiveLabel={t`DISCARD`}
        onConfirm={() => navigate(-1)}
      />
    </div>
  );
}
```

Note: `UpcSuggestionBanner` needs a way to write to the form — two options: (a) pass the RHF `setValue` through props (hacky; `ItemForm` owns `setValue`), or (b) hoist form state out of `ItemForm` into `ItemFormPage` via `useForm` there, passing `control` + `setValue` down. Option (b) is cleaner but requires `ItemForm` to optionally accept external form control. The planner should decide — one acceptable approach is to expose a `useFormContext`-style prop on `ItemForm` OR split `UpcSuggestionBanner`'s setValue into the `onSubmit` callsite by accepting accept-handlers as props. **Planner discretion per Claude's Discretion.**

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| TanStack Query v4 `keepPreviousData: true` | v5 `placeholderData: (prev) => prev` | v5 release 2024-01 | Phase 65 doesn't use previous-data pattern (single-code lookup), but Pattern 5 (`workspaceId! + enabled`) is v5-current. `[VERIFIED: useItemsList.ts:23]` |
| TanStack Query v4 `isLoading` | v5 `isPending` | v5 release 2024-01 | Use `isPending` (no data yet, fetching) not `isLoading` in the hook status mapping. |
| Legacy `/frontend` scanner with IndexedDB lookups | `/frontend2` online-only via TanStack Query over REST | Phase 54 (v2.0 online-only decision) | Phase 65 has NO offline fallback; CI grep guard enforces. |
| Hand-rolled dialogs | `RetroConfirmDialog` + `RetroDialog` | Phase 57 retro-atom consolidation | Phase 65 reuses these; no custom dialog code. |
| shadcn/ui legacy frontend | Custom retro atoms under `@/components/retro` | v2.0 decision | Phase 65 does NOT widen retro barrel; all composition. |
| Next.js `router.push` (legacy) | React Router v7 `useNavigate()` | v2.0 React-Router-only | `/items/new?barcode=` deep-link style ported conceptually, not via `next/router`. |
| Phase 60 `/items` list + detail only | Phase 65 adds `/items/new` route | Phase 65 | Additive sibling route; no breaking changes. |

**Deprecated / outdated to avoid:**
- `keepPreviousData` in TanStack Query options — removed in v5.
- `isLoading` as primary "waiting for data" signal — use `isPending`.
- Direct file imports from `@/components/retro/RetroPanel` — barrel-only (`@/components/retro`).
- `lucide-react` or other icon libraries for /frontend2 — retro ASCII glyphs only.
- `motion` / `framer-motion` — explicitly rejected (CSS transitions sufficient).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| `@tanstack/react-query` | `useScanLookup`, `useBarcodeEnrichment` | ✓ | 5.99.0 | — |
| `react-router` | `useSearchParams`, `useNavigate`, `<Route>` | ✓ | 7.14.0 | — |
| `react-hook-form` | `ItemForm` form state / `setValue` for [USE] chips | ✓ | 7.72.1 | — |
| `zod` | `itemCreateSchema` validation | ✓ | 4.3.6 (via `^4`) | — |
| `@lingui/react` + `@lingui/core` | `t\`…\`` + `useLingui` on all new strings | ✓ | 5.9.5 | — |
| `@lingui/cli` (devDep) | `bun run i18n:extract`, `bun run i18n:compile` | ✓ | 5.9.5 | — |
| `vitest` + `@testing-library/react` + `@testing-library/user-event` + `jsdom` | All test coverage | ✓ | Vitest 4.1.3, RTL 16.3.2, user-event 14.6.1, jsdom 29.0.2 | — |
| Retro atoms (`RetroPanel`, `RetroButton`, `RetroConfirmDialog`, `HazardStripe`) | All new UI | ✓ | via `@/components/retro` barrel | — |
| `bun` (runtime / package manager) | `bun run test` / `build` / `lint:imports` / `i18n:*` | ✓ | via `.mise.toml` or system bun | — |
| Go backend `GET /api/workspaces/{wsId}/items?search=&limit=1` | LOOK-01 lookup | ✓ | shipped | — |
| Go backend `GET /api/barcode/{code}` | LOOK-03 enrichment | ✓ | shipped (public, 8–14 char numeric enforced by Huma) | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

## Validation Architecture

> MANDATORY for Phase 65 — Nyquist is enabled (workflow.nyquist_validation unset = enabled).
> Each acceptance criterion maps to a concrete test layer + file path. Wave 0 gaps flagged for test-scaffold-first ordering.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.3 + `@testing-library/react` 16.3.2 + `@testing-library/user-event` 14.6.1 + `@testing-library/jest-dom` 6.9.1 + `jsdom` 29.0.2 |
| Config file | `frontend2/vitest.config.ts` (exists; `setupFiles: ["./src/test-utils.tsx"]`) |
| Quick run command | `cd frontend2 && bun run test` |
| Quick run (changed only) | `cd frontend2 && bun run test -- --changed` |
| Full suite command | `cd frontend2 && bun run test && bun run lint:imports && bun run i18n:compile && bun run build` |
| Watch mode | `cd frontend2 && bun run test:watch` |

### Phase Requirements → Test Map

| Req ID / D# | Behavior | Test Type | Automated Command / File | File Exists? |
|-------------|----------|-----------|--------------------------|-------------|
| **LOOK-01 / D-06** | `itemsApi.lookupByBarcode(wsId, code)` wraps `list(wsId, { search, limit: 1 })` | unit | `pytest`→`vitest run frontend2/src/lib/api/__tests__/items.lookupByBarcode.test.ts` | ❌ Wave 0 |
| **LOOK-01 / D-07** | Exact-barcode guard case-sensitivity: `"ABC-123"` ≠ `"abc-123"` → returns null | unit | same file as above — add cases: `"ABC-123"` vs `"abc-123"`, `"5449"` vs `"5449000000996"` | ❌ Wave 0 |
| **LOOK-01 / D-08** | Workspace mismatch returns `null` + logs `kind: "scan-workspace-mismatch"` (Pitfall #5 guard) | unit | same file — spy on `console.error`, assert match args | ❌ Wave 0 |
| **LOOK-01 / D-09** | `useScanLookup(code)` returns `ScanLookupResult`-shaped value with TanStack Query wiring | unit (rewrite existing) | `frontend2/src/features/scan/hooks/__tests__/useScanLookup.test.ts` (REWRITE — existing tests assert stub behavior) | ✅ EXISTS — rewrite |
| **LOOK-01 / D-09** | `useScanLookup` status: idle (no code), loading (fetching), success+match, success+null, error | unit | same file as above | ✅ EXISTS — rewrite |
| **LOOK-01 / D-10** | Lookup hook runs for MANUAL-format entries (no format gating) | integration | `frontend2/src/features/scan/__tests__/ScanPage.test.tsx` — extend MANUAL submit test to assert `useScanLookupSpy.toHaveBeenCalledWith("MY-CODE-42")` | ✅ EXISTS — extend |
| **LOOK-01 / D-17** | `ScanResultBanner` renders 4 distinct states | component | `frontend2/src/components/scan/__tests__/ScanResultBanner.test.tsx` (extend with state-prop variants) | ✅ EXISTS — extend |
| **LOOK-01 / D-18** | MATCH state: "MATCHED" heading + name + short_code + VIEW ITEM button (onClick nav to `/items/{id}`) | component | same file — add test per state | ✅ EXISTS — extend |
| **LOOK-01 / D-19** | NOT-FOUND state: "NOT FOUND" + hazard stripe yellow + CREATE ITEM button wires to `/items/new?barcode=<code>` | component | same file | ✅ EXISTS — extend |
| **LOOK-01 / D-20** | LOADING state: "LOOKING UP…" + dimmed code + SCAN AGAIN interactive | component | same file | ✅ EXISTS — extend |
| **LOOK-01 / D-21** | ERROR state: "LOOKUP FAILED" + red hazard stripe + RETRY calls refetch + CREATE ITEM fallback | component | same file; spy on `refetch` | ✅ EXISTS — extend |
| **LOOK-01 / D-22** | `useScanHistory.update(code, patch)` backfills entityType/entityId on match | unit | `frontend2/src/features/scan/hooks/__tests__/useScanHistory.test.ts` (extend) | ✅ EXISTS — extend |
| **LOOK-01 / D-22** | `ScanPage` match-effect calls `useScanHistory.update` when lookup resolves to match (race-guard: no update on not-found path, no update mid-navigation) | integration | `ScanPage.test.tsx` — add Test 16 matching this behavior | ✅ EXISTS — extend |
| **LOOK-02 / D-01** | Route `<Route path="items/new" element={<ItemFormPage />} />` registered | smoke | render `AppRoutes` with MemoryRouter at `/items/new`, assert `ItemFormPage` renders | ❌ Wave 0 — `frontend2/src/routes/__tests__/routes.items-new.test.tsx` |
| **LOOK-02 / D-02** | `ItemFormPage` reads `?barcode=` via `useSearchParams()` + pre-fills form | component | `frontend2/src/features/items/__tests__/ItemFormPage.test.tsx` | ❌ Wave 0 |
| **LOOK-02 / D-02** | `generateSku()` fires exactly once per mount (not per render) | component (spy on schemas.generateSku) | same file | ❌ Wave 0 |
| **LOOK-02 / D-03** | CANCEL button with dirty form opens `RetroConfirmDialog`; with clean form calls `navigate(-1)` | component | same file + user-event type + cancel click | ❌ Wave 0 |
| **LOOK-02 / D-04** | On create success, `scanKeys.lookup(barcode)` is invalidated (Pitfall #7 guard) | component (QueryClient spy) | same file — spy on `invalidateQueries` | ❌ Wave 0 |
| **LOOK-02 / D-04** | On create success, `navigate(/items/{id})` fires | component | same file — spy on `navigate` | ❌ Wave 0 |
| **LOOK-02 / D-05** | `/items/new` route uses same `useCreateItem` as `ItemPanel` (no duplicate mutation logic) | type + code-review | grep assertion in plan description; test: `ItemFormPage` imports `useCreateItem` from `../hooks/useItemMutations` | ❌ Wave 0 (implicit in the ItemFormPage test's mock structure) |
| **LOOK-03 / D-11** | `barcodeApi.lookup(code)` calls `GET /barcode/{code}` (no wsId prefix) | unit | `frontend2/src/lib/api/__tests__/barcode.test.ts` — mock fetch, assert URL | ❌ Wave 0 |
| **LOOK-03 / D-11** | `barcodeKeys.lookup(code)` factory produces `["barcode", "lookup", code]` | unit | same file — simple assertion | ❌ Wave 0 |
| **LOOK-03 / D-12** | `useBarcodeEnrichment` regex gate: `"12345"` → `enabled: false` (no fetch) | unit | `frontend2/src/features/items/hooks/__tests__/useBarcodeEnrichment.test.ts` | ❌ Wave 0 |
| **LOOK-03 / D-12** | `useBarcodeEnrichment` regex gate: `"1234567"` → no fetch (<8) | unit | same file | ❌ Wave 0 |
| **LOOK-03 / D-12** | `useBarcodeEnrichment` regex gate: `"12345678"` → fetches (boundary: 8) | unit | same file | ❌ Wave 0 |
| **LOOK-03 / D-12** | `useBarcodeEnrichment` regex gate: `"12345678901234"` → fetches (boundary: 14) | unit | same file | ❌ Wave 0 |
| **LOOK-03 / D-12** | `useBarcodeEnrichment` regex gate: `"123456789012345"` → no fetch (>14) | unit | same file | ❌ Wave 0 |
| **LOOK-03 / D-12** | `useBarcodeEnrichment` regex gate: `"ABC12345678"` → no fetch (non-numeric) | unit | same file | ❌ Wave 0 |
| **LOOK-03 / D-12** | `useBarcodeEnrichment` `staleTime: Infinity` (session-scoped) | unit | same file — inspect query options via `useQueryClient` | ❌ Wave 0 |
| **LOOK-03 / D-13** | `UpcSuggestionBanner` renders yellow hazard stripe + "SUGGESTIONS AVAILABLE" heading | component | `frontend2/src/features/items/__tests__/UpcSuggestionBanner.test.tsx` | ❌ Wave 0 |
| **LOOK-03 / D-14** | Per-field [USE] chip → calls setValue with `{ shouldDirty: true }` | component (RHF wrapper) | same file | ❌ Wave 0 |
| **LOOK-03 / D-14** | USE ALL button applies all non-empty suggestion fields in one click | component | same file | ❌ Wave 0 |
| **LOOK-03 / D-14** | DISMISS collapses banner locally (no cache / form writes) | component | same file | ❌ Wave 0 |
| **LOOK-03 / D-15** | Category string rendered as helper text only; no [USE] chip; `category_id` never written | component | same file — assert no setValue("category_id", ...) call | ❌ Wave 0 |
| **LOOK-03 / D-16** | Enrichment fetch error → banner does NOT render; logs `kind: "upc-enrichment-fail"` | component + unit | `ItemFormPage.test.tsx` (integration) + `useBarcodeEnrichment.test.ts` (unit) | ❌ Wave 0 |
| **LOOK-03 / D-16** | Enrichment `{ found: false }` → banner does NOT render | component | `ItemFormPage.test.tsx` | ❌ Wave 0 |
| **D-22 race guard** | `useScanHistory.update("X", patch)` noops when no entry with code="X" exists (stale lookup resolve after user scanned different code) | unit | `useScanHistory.test.ts` — set history to `[{code:"Y"}]`, call `update("X", ...)`, assert unchanged | ❌ Wave 0 |
| **Phase 64 D-18 callsite lock** | `useScanLookup` return shape EXACTLY matches `ScanLookupResult` | unit (type + runtime) | `useScanLookup.test.ts` — existing Test "ScanLookupStatus accepts all four states" still green post-swap | ✅ PRESERVE |
| **Phase 64 D-01 Test 15 gate** | `ScanPage` calls `useScanLookup(banner?.code ?? null)` pre-decode AND with the decoded code post-decode | integration | `ScanPage.test.tsx` Test 15 — must stay green | ✅ PRESERVE |
| **i18n** | Every new `t\`…\`` string has an msgid in en/messages.po AND a non-empty msgstr in et/messages.po | build | `cd frontend2 && bun run i18n:compile` (zero orphan warnings) | — (run gate) |
| **Bundle gate** | Main-chunk gzip delta ≤ 5 kB vs Phase 64 baseline; `/scan` chunk unchanged | build-artifact | `cd frontend2 && bun run build` + manual size comparison | — (run gate) |
| **Guardrail** | No new forbidden imports (idb / serwist / offline / sync) | CI lint | `cd frontend2 && bun run lint:imports` | — (run gate) |
| **Type safety** | `tsc -b` passes with no new errors | build | `cd frontend2 && bun run build` | — (run gate) |

### Sampling Rate

- **Per task commit:** `cd frontend2 && bun run test -- --changed` (only affected tests green)
- **Per wave merge:** `cd frontend2 && bun run test && bun run lint:imports`
- **Phase gate:** Full suite green (`test && lint:imports && i18n:compile && build`) + manual UAT entries signed off in `65-VERIFICATION.md`

### Wave 0 Gaps (test-scaffold-first ordering)

- [ ] `frontend2/src/lib/api/__tests__/items.lookupByBarcode.test.ts` — covers D-06/07/08 (NEW)
- [ ] `frontend2/src/lib/api/__tests__/barcode.test.ts` — covers D-11 (NEW)
- [ ] `frontend2/src/features/items/hooks/__tests__/useBarcodeEnrichment.test.ts` — covers D-12 regex gate + staleTime + silent fail (NEW)
- [ ] `frontend2/src/features/items/__tests__/ItemFormPage.test.tsx` — covers D-01/02/03/04/05 + integration with D-13/14/15/16 (NEW)
- [ ] `frontend2/src/features/items/__tests__/UpcSuggestionBanner.test.tsx` — covers D-13/14/15 (NEW)
- [ ] `frontend2/src/routes/__tests__/routes.items-new.test.tsx` — covers route registration smoke (NEW; optional if ItemFormPage.test covers render well)

### Existing tests to extend (not create fresh)

- [ ] `frontend2/src/features/scan/hooks/__tests__/useScanLookup.test.ts` — **REWRITE** (stub tests no longer valid); new tests must use QueryClientProvider fixture + MSW or vi.spyOn(itemsApi, "list")
- [ ] `frontend2/src/features/scan/hooks/__tests__/useScanHistory.test.ts` — extend with `update()` tests
- [ ] `frontend2/src/components/scan/__tests__/ScanResultBanner.test.tsx` — add 3 new state tests + widen prop API
- [ ] `frontend2/src/features/scan/__tests__/ScanPage.test.tsx` — add Test 16 for match-effect; PRESERVE Test 15

### Manual UAT (gated on VERIFICATION.md signoff)

- [ ] Real device iOS PWA: scan → NOT-FOUND → CREATE ITEM WITH THIS BARCODE → land on `/items/new?barcode=...` with barcode pre-filled
- [ ] Real device iOS PWA: scan → MATCH → VIEW ITEM → land on `/items/{id}`; browser back → `/scan` still works (Pitfall #1 scope)
- [ ] Real Code128 label with hyphens scans and matches (verifies Pitfall #4 if schema is tightened) — OR fails zod validation (flagged)
- [ ] Real UPC scan (8–14 numeric) on /items/new → UpcSuggestionBanner appears with name/brand from external provider; [USE] chips write to form; USE ALL works; DISMISS collapses; category shown as helper text only
- [ ] Real UPC where external returns `{ found: false }` → NO banner renders; form still works normally
- [ ] External API down / 5xx → NO banner renders; form still works normally; `console.error({ kind: "upc-enrichment-fail" })` in devtools
- [ ] Cross-tenant defense: create item in Workspace A with barcode X, switch to Workspace B, scan X → NOT-FOUND (NOT workspace A's item) + `console.error({ kind: "scan-workspace-mismatch" })` in devtools
- [ ] Dirty-guard: fill `/items/new`, click CANCEL → `DISCARD CHANGES?` dialog; DISCARD → navigate back; ← BACK → dialog closes, form retained
- [ ] Stale-after-create: scan unknown barcode → NOT-FOUND → CREATE → submit → browser-back to /scan → rescan same barcode → MATCH (not cached NOT-FOUND) — verifies Pitfall #7 / D-04
- [ ] i18n: switch language to ET, navigate to `/scan` + `/items/new` — every Phase 65 string is translated (no raw EN bleeding through)

## Security Domain

Phase 65 interacts with data read/write paths, so security considerations apply. `security_enforcement` is enabled (default per config).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | yes (indirect) | AuthContext + RequireAuth wrap `/items/new`; public `/barcode/{code}` endpoint is intentionally unauthenticated per backend design |
| V3 Session Management | yes (indirect) | `useAuth().workspaceId` drives `lookupByBarcode`; D-08 asserts session workspace matches returned workspace |
| V4 Access Control | yes | Frontend defense-in-depth via D-08 workspace_id assertion — guards cross-tenant leak (Pitfall #5) |
| V5 Input Validation | yes | zod `itemCreateSchema` validates barcode (max 64 + regex); `encodeURIComponent` on `/barcode/{code}` URL; `useBarcodeEnrichment` regex gate prevents malformed queries to external endpoint |
| V6 Cryptography | no | No new cryptographic operations in Phase 65 |

### Known Threat Patterns for TS/React + REST-backend stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-tenant data leak on globally-unique UPC | Information disclosure | D-08 workspace_id assertion + structured log (Pitfall #5) |
| XSS via scanned barcode rendered in UI | Injection | React's default escaping in JSX `{code}` + `{match.name}`; no `dangerouslyInnerHTML` used anywhere in Phase 65 |
| URL-param injection via `?barcode=<code>` | Injection | `encodeURIComponent` on outbound, zod `.regex` on inbound; RHF `setValue` treats values as strings |
| External-API response injection (OpenFoodFacts returns unexpected shape) | Tampering | `BarcodeProduct` type + runtime check on `data.found === true` before render; `data.name`/`data.brand`/`data.category` accepted as strings only; NEVER evaluated |
| Unauthenticated external endpoint hammering | Denial of service (upstream) | Regex gate prevents spurious calls; `staleTime: Infinity` prevents re-fetching in session; `retry: false` per D-16 |
| Stale auth token during long session on `/items/new` | Elevation | Existing 401 refresh single-flight in `lib/api.ts`; no Phase 65 change |
| Typosquat of copied-pasted barcode | Tampering | D-07 case-sensitive match + D-08 workspace guard catch mismatches |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|

**This table is empty:** All claims in this research were either verified via tool (Read/Grep against live /frontend2 source, or Bash against node_modules/package.json), or cited from authoritative local planning documents (CONTEXT.md, UI-SPEC.md, PITFALLS.md, ARCHITECTURE.md, STATE.md, ROADMAP.md, REQUIREMENTS.md, 64-CONTEXT.md, 64-VALIDATION.md). No training-data-only claims remain — the research is grounded in this session's reads.

## Open Questions (RESOLVED 2026-04-19)

1. **Barcode regex in `itemCreateSchema` rejects hyphens** — **RESOLVED:** User approved loosening to `/^[A-Za-z0-9\-_]+$/` in Phase 65. Captured as CONTEXT.md D-24. Schemas.ts is now in-scope.
   - What we know: Current regex is `/^[A-Za-z0-9]+$/` (schemas.ts:34). Phase 64 tests use `"ABC-123"` and `"TEST-CODE-123"` as mock-scanner outputs. Code128 symbology commonly includes hyphens. If a real user scans a Code128 label containing `-`, the lookup will work (D-07 is raw compare) but the `/items/new` form will fail zod validation, dead-ending the create flow.
   - What's unclear: Should the regex be loosened (e.g., `/^[A-Za-z0-9\-_]+$/` or `/^[\x20-\x7E]+$/`) in Phase 65, or is this deferred? LOOK-02 requires "barcode pre-filled" — if the pre-fill fails validation, LOOK-02 isn't met.
   - Recommendation: **Loosen the regex in Phase 65** — it's a one-line schema change with one test update and an i18n error message tweak. Add as a small task in the same wave that ships `ItemFormPage`. Flag to planner for user confirmation before coding.

2. **`useBarcodeEnrichment` `staleTime: Infinity` — per-query or QueryClient-global?** — **RESOLVED:** Per-query. Matches `<claude's discretion>` in CONTEXT.md (session-scoped intent) + existing `/frontend2` idiom. No user escalation needed.
   - What we know: CONTEXT `<discretion>` says "Whether enrichment `staleTime: Infinity` is per-query or app-level (session-scoped is intended; pick the simpler TanStack idiom)."
   - What's unclear: App-level means editing `queryClient` defaults in `App.tsx`, which affects EVERY query. Per-query means setting `staleTime: Infinity` only in `useBarcodeEnrichment`.
   - Recommendation: **Per-query.** Simpler, more explicit, doesn't leak into unrelated queries. Verified usage pattern in `/frontend2` — per-query `staleTime` is the default idiom (e.g., `useItemsList.ts` uses `placeholderData` per-query, not globally).

3. **`UpcSuggestionBanner` accepting form writes — where does `setValue` come from?** — **RESOLVED:** Option (c) `FormProvider` + `useFormContext` in `ItemForm`. Smallest surface change. Claude's discretion per CONTEXT.md; no user escalation needed.
   - What we know: D-14 requires `setValue(field, value, { shouldDirty: true })`. `ItemForm` currently owns the `useForm` instance internally.
   - What's unclear: How does `UpcSuggestionBanner` (rendered OUTSIDE `ItemForm`) access `setValue`?
   - Options: (a) Hoist `useForm` into `ItemFormPage` and pass `control` + `setValue` down to `ItemForm` (clean but changes `ItemForm`'s API). (b) `UpcSuggestionBanner` accepts `onAccept(field, value)` callbacks and `ItemFormPage` wires them to `setValue` via a ref or `useFormContext`. (c) Use `FormProvider` pattern and `useFormContext` inside `UpcSuggestionBanner`.
   - Recommendation: **Option (c) — `FormProvider` / `useFormContext`.** Smallest surface change to `ItemForm` (wrap it in `FormProvider`), and `UpcSuggestionBanner` gets idiomatic access via `useFormContext`. Flag to planner.

4. **`useScanHistory.update` vs. `add()` upsert-semantics — locked by D-22 to separate method, but is the signature `update(code, patch)` or `update(entry)`?** — **RESOLVED:** Signature `update(code, patch)`, noop-if-missing. Matches D-22 <specifics> race-guard intent. JSDoc + direct unit test in Plan 65-04 Task 2 will document + enforce.
   - What we know: D-22 says "upserts the most-recent history entry for that code". Noops if code not found in history.
   - What's unclear: Should `update` also CREATE the entry if missing (true upsert), or only update existing? The <specifics> race-guard argument says "only update existing" — if the entry isn't there, a race already happened and updating wrong is worse than noop.
   - Recommendation: **Noop-if-missing.** Matches <specifics> race-guard intent. Document the semantics in the hook JSDoc + test the noop case.

5. **Bundle gate verification — what is the Phase 64 exact gzip baseline to measure against?** — **RESOLVED:** Plan 65-01 Wave 0 task captures baseline (`dist/assets/scanner-*.js | gzip -c | wc -c`) and writes it to `65-BUNDLE-BASELINE.md`; Plan 65-08 Task 3 [BLOCKING] gates against that number. Claude's discretion; no user escalation needed.
   - What we know: Phase 64 Plan 64-10 shipped with −37.8 kB gzip main-chunk delta vs pre-Phase-64 baseline. STATE.md records this.
   - What's unclear: The absolute byte number for `dist/assets/scanner-<hash>.js` gzip after Phase 64 isn't captured in 64-VERIFICATION.md at a specific byte level for comparison.
   - Recommendation: **Before Phase 65 starts**, run `cd frontend2 && git checkout <post-64-commit> && bun run build && du -b dist/assets/scanner-*.js | gzip -c | wc -c` to capture the baseline. Then gate Phase 65 on "scanner chunk gzip size ≤ captured baseline + 0 bytes" and "main chunk gzip size ≤ captured main + 5 kB". Attach the baseline number to the PLAN.md.

## Pattern Mapper Prep

**New files (Phase 65 creates these — pattern-mapper should compare against listed analogs):**

| New File | Analog (existing file) | Pattern to Mirror |
|----------|------------------------|-------------------|
| `frontend2/src/lib/api/barcode.ts` | `frontend2/src/lib/api/scan.ts` (shape) + `frontend2/src/lib/api/categories.ts` (API + keys factory) | One-file-per-domain with `xxxApi` object + `xxxKeys` query-key factory |
| `frontend2/src/features/items/hooks/useBarcodeEnrichment.ts` | `frontend2/src/features/items/hooks/useItemsList.ts` | `useQuery` with workspace/enabled gating (but here: regex gate instead of workspace) |
| `frontend2/src/features/items/ItemFormPage.tsx` | `frontend2/src/features/items/panel/ItemPanel.tsx` (create-mode logic) + `frontend2/src/features/items/ItemDetailPage.tsx` (page-level chrome) | SKU-once + dirty-guard + ItemForm consumer, at page level |
| `frontend2/src/features/items/UpcSuggestionBanner.tsx` | `frontend2/src/components/scan/ScanResultBanner.tsx` (retro banner composition) + `frontend2/src/components/scan/ScanErrorPanel.tsx` (structured log in useEffect) | `RetroPanel` + `HazardStripe` + `RetroButton` composition with structured observability |
| `frontend2/src/lib/api/__tests__/items.lookupByBarcode.test.ts` | `frontend2/src/lib/api/itemPhotos.test.ts` | `vi.spyOn` + assert structured args |
| `frontend2/src/lib/api/__tests__/barcode.test.ts` | `frontend2/src/lib/api/__tests__/` (any existing domain) | Mock fetch, assert URL + method |
| `frontend2/src/features/items/hooks/__tests__/useBarcodeEnrichment.test.ts` | `frontend2/src/features/scan/hooks/__tests__/useScanLookup.test.ts` (stub-era shape test) + `useItemsList.ts` (would-be query test) | `renderHook` + QueryClientProvider fixture + assert query is enabled/disabled by regex gate |
| `frontend2/src/features/items/__tests__/ItemFormPage.test.tsx` | `frontend2/src/features/items/panel/__tests__/ItemPanel.test.tsx` (if exists) + `frontend2/src/features/items/__tests__/ItemDetailPage.test.tsx` | Page-level render with MemoryRouter + QueryClient + user-event flows |
| `frontend2/src/features/items/__tests__/UpcSuggestionBanner.test.tsx` | `frontend2/src/components/scan/__tests__/ScanResultBanner.test.tsx` | Retro banner render + per-variant assertions |

**Modified files (Phase 65 extends these):**

| Modified File | What Changes | Risk |
|---------------|--------------|------|
| `frontend2/src/lib/api/items.ts` | Append `lookupByBarcode` to `itemsApi` | Low — single method add |
| `frontend2/src/lib/api/index.ts` | `export * from "./barcode"` | Low — single line |
| `frontend2/src/features/scan/hooks/useScanLookup.ts` | REWRITE body (shape locked by Phase 64 D-18) | Medium — test rewrite; Test 15 callsite gate must remain green |
| `frontend2/src/features/scan/hooks/useScanHistory.ts` | Add `update` method | Low — additive |
| `frontend2/src/lib/scanner/scan-history.ts` | Add `updateScanHistory` module function | Low — additive |
| `frontend2/src/features/scan/ScanPage.tsx` | Remove `void lookup;` (line 83); add match-effect | Low — small, localized change; Phase 64 tests must pass |
| `frontend2/src/components/scan/ScanResultBanner.tsx` | Widen prop API + add 3 new states | Medium — existing tests assert Phase 64 SCANNED-only shape; extend not break |
| `frontend2/src/routes/index.tsx` | Add `<Route path="items/new" element={<ItemFormPage />} />` | Low — sibling route |
| `frontend2/locales/en/messages.po` | Add ~10–15 new msgids | Low (managed by `bun run i18n:extract`) |
| `frontend2/locales/et/messages.po` | Add ET translations for all new msgids | Low (managed by `bun run i18n:extract` + manual fill) |
| `frontend2/src/features/items/forms/schemas.ts` | **POSSIBLE:** loosen barcode regex (Open Question 1) | Medium — downstream test + UI impact; flag for user confirmation |

**Search hints for pattern-mapper:**
- Retro atom composition: grep `from "@/components/retro"` in existing feature files
- TanStack Query + workspace: grep `enabled: !!workspaceId` across `/frontend2/src`
- Dirty-guard + `RetroConfirmDialog`: `frontend2/src/features/taxonomy/panel/SlideOverPanel.tsx` and `ItemPanel.tsx`
- Structured `console.error({ kind, ... })`: `frontend2/src/components/scan/ScanErrorPanel.tsx:47-58`
- `useSearchParams` pattern: `frontend2/src/features/items/filters/useItemsListQueryParams.ts:36-45`
- `generateSku` on mount: `frontend2/src/features/items/panel/ItemPanel.tsx:36-48`
- React Router v7 lazy-split + Suspense fallback: `frontend2/src/routes/index.tsx:17-19, 60-73`
- Phase 64 locked shapes: `frontend2/src/lib/api/scan.ts`, `frontend2/src/features/scan/hooks/useScanLookup.ts`

## Sources

### Primary (HIGH confidence — read in full during research)

- `frontend2/src/lib/api/scan.ts` — `ScanLookupResult` + `scanKeys` factory (locked by Phase 64 D-18)
- `frontend2/src/lib/api/items.ts` — `Item` interface + `itemsApi.list` signature + `itemKeys` factory
- `frontend2/src/lib/api/inventory.ts` — one-domain-per-file API pattern
- `frontend2/src/features/scan/hooks/useScanLookup.ts` — body-swap site
- `frontend2/src/features/scan/hooks/useScanHistory.ts` — `useScanHistory` surface
- `frontend2/src/features/scan/ScanPage.tsx` — callsite lock + match-effect wire-up site
- `frontend2/src/features/items/panel/ItemPanel.tsx` — SKU-generate-once pattern + dirty-guard plumbing
- `frontend2/src/features/items/forms/ItemForm.tsx` — form reuse target (supports `defaultValues.barcode` + `onDirtyChange`)
- `frontend2/src/features/items/forms/schemas.ts` — `itemCreateSchema` + `generateSku`
- `frontend2/src/features/items/hooks/useItemMutations.ts` — `useCreateItem` mutation pattern + existing invalidation
- `frontend2/src/features/items/hooks/useItemsList.ts` — canonical workspace + enabled + placeholderData query pattern
- `frontend2/src/features/auth/AuthContext.tsx` — `workspaceId` source + 401/403-only token clear
- `frontend2/src/routes/index.tsx` — declarative `<Route>` tree (add site for `/items/new`)
- `frontend2/src/components/scan/ScanResultBanner.tsx` — in-place widening target
- `frontend2/src/components/scan/ScanErrorPanel.tsx` — structured `console.error({ kind })` vocabulary
- `frontend2/src/components/retro/RetroPanel.tsx` — `UpcSuggestionBanner` substrate
- `frontend2/src/features/taxonomy/panel/SlideOverPanel.tsx` — `RetroConfirmDialog` + dirty-guard precedent
- `frontend2/src/lib/scanner/scan-history.ts` — `updateScanHistory` addition site
- `frontend2/src/lib/scanner/types.ts` — `ScanHistoryEntry` + `EntityMatch` shapes
- `frontend2/src/test/mocks/yudiel-scanner.ts` + `frontend2/src/features/scan/__tests__/fixtures.ts` — test infra for extending ScanPage tests
- `frontend2/src/features/items/filters/useItemsListQueryParams.ts` — `useSearchParams` precedent
- `frontend2/vite.config.ts` — manual-chunks `scanner` group (must not regress)
- `frontend2/vitest.config.ts` — test env (`jsdom` + setupFiles)
- `frontend2/package.json` — installed versions verification
- `frontend2/node_modules/@tanstack/react-query/package.json` — 5.99.0 confirmation
- `frontend2/node_modules/react-hook-form/package.json` — 7.72.1 confirmation
- `frontend2/node_modules/react-router/package.json` — 7.14.0 confirmation
- `frontend2/locales/en/messages.po` + `frontend2/locales/et/messages.po` — i18n gap-fill targets
- `scripts/check-forbidden-imports.mjs` — CI grep guard rules
- `backend/internal/domain/barcode/handler.go` — confirmed `ProductResponse` shape (barcode / name / brand / category / image_url / found) + Huma 8–14 length constraint
- `.planning/phases/65-item-lookup-and-not-found-flow/65-CONTEXT.md` — 22 locked decisions (D-01..D-22)
- `.planning/phases/65-item-lookup-and-not-found-flow/65-UI-SPEC.md` — Visual and interaction contract
- `.planning/phases/65-item-lookup-and-not-found-flow/65-DISCUSSION-LOG.md` — Alternatives considered
- `.planning/phases/64-scanner-foundation-scan-page/64-VALIDATION.md` — Nyquist validation format + existing test inventory
- `.planning/phases/64-scanner-foundation-scan-page/64-VERIFICATION.md` — Manual UAT format precedent
- `.planning/research/ARCHITECTURE.md` — §Q3 lookupByBarcode wrapper + §"Pitfall-flagged path — not found → create"
- `.planning/research/PITFALLS.md` — #1 iOS PWA (BLOCKER), #5 Workspace-scoping (BLOCKER), #7 TanStack stale cache (MAJOR), #S2.2-01 external endpoint length gate, #S2.2-03 external unauthenticated
- `.planning/research/FEATURES.md` — Feature Area 3 Not-Found → Create (table stakes + anti-features)
- `.planning/research/SUMMARY.md` — §"Not found → create flow with barcode prefill via URL param", §"Defence in depth"
- `.planning/REQUIREMENTS.md` — LOOK-01, LOOK-02, LOOK-03 text (lines 23-25) + out-of-scope list
- `.planning/ROADMAP.md` — Phase 65 goal + SC#1/2/3 (lines 347-356)
- `.planning/STATE.md` — v2.2 accumulated decisions list
- `.planning/phases/64-scanner-foundation-scan-page/64-CONTEXT.md` — D-18 callsite lock precedent

### Secondary (MEDIUM confidence — verified via cross-reference)

- TanStack Query v5 migration guide — `isLoading` → `isPending` rename (confirmed via existing /frontend2 hooks using `isPending`)
- React Router v7 library mode — `useSearchParams()` reactive behavior on URL change (confirmed via `useItemsListQueryParams.ts` pattern)
- Lingui v5 `t\`…\`` + `useLingui` + `bun run i18n:extract`/`i18n:compile` — pattern verified in `/frontend2` across 50+ components

### Tertiary (LOW confidence — none flagged)

- None. All claims are grounded in session-read files. No pure training-data claims shipped.

## Metadata

**Confidence breakdown:**

- **Standard stack:** HIGH — all versions verified against `frontend2/node_modules/*/package.json`; no alternatives considered post-Phase 64 lock
- **Architecture:** HIGH — every pattern cited from an existing /frontend2 file path with line numbers
- **Pitfalls:** HIGH — 65-specific pitfalls surfaced from PITFALLS.md + Phase 60 code (schemas.ts barcode regex) + Phase 64 fixtures; cross-tenant guard verified against backend code
- **Validation Architecture:** HIGH — maps each of 22 decisions + 3 REQ-IDs to a test layer; existing tests identified for extension; Wave 0 gaps explicitly listed
- **Security:** MEDIUM — ASVS V5 + V4 + V2 mappings are grounded but V1/V7/V8/V9/V10/V11/V12/V13/V14 not formally reviewed (out of Phase 65's injection surface); recommend backend review of `/api/barcode/{code}` rate-limiting separately

**Research date:** 2026-04-19
**Valid until:** 2026-05-19 (30 days for a stable stack; the /frontend2 codebase is in active development so re-check freshness of pattern cites if Phase 65 doesn't start within 2 weeks)
