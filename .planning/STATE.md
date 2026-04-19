---
gsd_state_version: 1.0
milestone: v2.2
milestone_name: Scanning & Stabilization
status: executing
stopped_at: Phase 65 Plan 06 complete (ScanResultBanner 4-state widening — LOADING / MATCH / NOT-FOUND / ERROR with prop-surface growth + prefers-reduced-motion keyframe guard)
last_updated: "2026-04-19T10:05:26.000Z"
last_activity: 2026-04-19 -- Phase 65 Plan 06 complete (ScanResultBanner Phase 64 single-state → Phase 65 four-state in-place widening; prop surface gains lookupStatus+match+onViewItem+onCreateWithBarcode+onRetry; @keyframes retro-cursor-blink with @media prefers-reduced-motion: reduce { animation: none } guard; 21 new real it() green; 7 Phase 64 tests migrated under MATCH describe; full vitest 707 passed / 0 todos / 0 failed — 81/78 cumulative Wave-0 todos converted)
progress:
  total_phases: 6
  completed_phases: 6
  total_plans: 17
  completed_plans: 17
  percent: 100
---

# Project State: Home Warehouse System

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-18)

**Core value:** Reliable inventory access anywhere -- online or offline -- with seamless sync
**Current focus:** Phase 65 — item-lookup-and-not-found-flow

## Current Position

Phase: 65 (item-lookup-and-not-found-flow) — EXECUTING
Plan: 7 of 8 (Plans 01, 02, 03, 04, 05, 06 complete; Plans 07/08 next)
Status: Executing Phase 65
Last activity: 2026-04-19 -- Phase 65 Plan 06 complete (ScanResultBanner widened in place from Phase 64 single SCANNED state to Phase 65 four mutually-exclusive states LOADING / MATCH / NOT-FOUND / ERROR per D-17..D-21; prop surface gains lookupStatus: ScanLookupStatus + match: Item | null + onViewItem?(itemId) + onCreateWithBarcode?(code) + onRetry?; @keyframes retro-cursor-blink + .retro-cursor-blink class + @media (prefers-reduced-motion: reduce) { animation: none; opacity: 1; } guard in globals.css — automated grep gate + manual verification row already present in 65-VALIDATION.md; 21 new real it() green in ScanResultBanner.states.test.tsx; 7 Phase 64 assertions migrated under MATCH state describe; 2 Rule 3 auto-fixes: ScanPage callsite interim wire to lookupStatus='idle'+match=null and ScanPage test regex /SCANNED/ → /LOOKING UP/ — both unblock tsc + vitest gates until Plan 65-07 wires real useScanLookup; full vitest suite 707 passed / 0 todos / 0 failed — 81/78 cumulative Wave-0 todos converted)
Next step: Plan 65-07 (ScanPage match-effect + route registration) / 65-08 (i18n + bundle gate)

## Performance Metrics

**Velocity:**

- Total plans completed: 157
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
| 65 | Item Lookup & Not-Found Flow | LOOK-01..03 (3) | 64 | Not started |
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

Last session: 2026-04-19T10:05:26.000Z
Stopped at: Phase 65 Plan 06 complete (ScanResultBanner widened to 4 states + @keyframes retro-cursor-blink with reduced-motion guard)
Next step: Plan 65-07 (ScanPage match-effect + route registration) / 65-08 (i18n + bundle gate)

---
*Updated: 2026-04-19 — Phase 65 Plan 06 complete (ScanResultBanner widened in place from Phase 64 single SCANNED state to Phase 65 four mutually-exclusive states LOADING / MATCH / NOT-FOUND / ERROR — D-17..D-21; prop surface gains lookupStatus: ScanLookupStatus + match: Item | null + onViewItem?(itemId: string) + onCreateWithBarcode?(code: string) + onRetry?; LOADING renders a dimmed code echo plus ▍ blinking cursor with retro-cursor-blink className; MATCH renders NAME + match.short_code rows + VIEW ITEM button; NOT-FOUND renders yellow HazardStripe + helper line + CREATE ITEM WITH THIS BARCODE; ERROR renders red HazardStripe + remediation body + RETRY + CREATE ITEM fallback; SCAN AGAIN rendered and interactive in every state (T-65-06-04); single variant derivation ternary chain = structural dual-state-render guard (T-65-06-03); React JSX auto-escapes match.name / match.short_code / code for T-65-06-01 XSS mitigation. @keyframes retro-cursor-blink (1 Hz step-end) + .retro-cursor-blink class + @media (prefers-reduced-motion: reduce) { animation: none; opacity: 1; } guard appended to globals.css for T-65-06-02 motion-sickness mitigation; manual browser runtime verification row already present in 65-VALIDATION.md §Manual-Only Verifications. 21 new real it() green in ScanResultBanner.states.test.tsx (5 LOADING + 5 MATCH + 5 NOT-FOUND + 5 ERROR + 1 dual-state absence sweep T-65-06-03); 7 Phase 64 assertions re-homed under MATCH state describe in ScanResultBanner.test.tsx (SCANNED → MATCHED heading; CODE row now asserts match.short_code; Test 6 inverted to stripe-absence). 2 Rule 3 auto-fixes kept the plan's own typecheck + vitest gates green: (1) ScanPage.tsx callsite interim lookupStatus='idle' + match=null until Plan 65-07 wires real useScanLookup (falls through to LOADING variant in deriveVariant); (2) ScanPage.test.tsx /SCANNED/i → /LOOKING UP/i regex migration (11 replacements). Full vitest suite 707 passed / 0 todos / 0 failed (was 679 / 20 todos); typecheck + lint:imports + build clean. Cumulative 81/78 Wave-0 todos converted to date across Plans 65-02..06.*

*Updated: 2026-04-19 — Phase 65 Plan 05 complete (LOOK-02 + LOOK-03 render surface: ItemForm FormProvider wrap + BRAND RetroFormField D-23 + optional beforeForm slot for sibling banner access; UpcSuggestionBanner feature-local banner with per-field [USE] + USE ALL + DISMISS writing setValue("brand", ..., { shouldDirty: true }) directly — no description concatenation workaround; ItemFormPage /items/new page with ?barcode= URL prefill + generateSku once per mount + dirty-guard RetroConfirmDialog + scanKeys.lookup(barcode) + itemKeys.all dual invalidation on create success (D-04 Pitfall #7 closure); 32 new real it() — 60/78 cumulative Wave-0 todos converted; full suite 686 passed / 20 todos / 0 failed; typecheck + lint:imports clean; 1 Rule 3 auto-fix: added optional beforeForm?: ReactNode slot to ItemForm reconciling plan's Task 1 FormProvider-inside-ItemForm with Task 3's banner-as-sibling intent).*
*Updated: 2026-04-19 — Phase 65 Plan 04 complete (useScanLookup body swap to real TanStack Query against itemsApi.lookupByBarcode; ScanLookupResult shape preserved per Phase 64 D-18; updateScanHistory module fn + useScanHistory.update useCallback-wrapped for D-22 race guard; 8 + 3 + 5 = 16 new real it() cases green; ScanPage Test 15 callsite gate preserved; 3 tasks TDD RED+GREEN atomic commits).*
*Updated: 2026-04-19 — Phase 65 Plan 02 complete (itemsApi.lookupByBarcode w/ D-06/D-07/D-08 guards + D-23 optional brand field + D-24 barcode regex loosened for hyphens/underscores; 10 Wave 0 todos converted green; cumulative 28/78 todos real; full suite 640 passed / 50 todos).*
*Updated: 2026-04-19 — Phase 65 Plan 03 complete (barcodeApi + barcodeKeys + useBarcodeEnrichment with /^d{8,14}$/ gate + silent-failure; 18 Wave 0 todos converted green; full suite 640 passed / 50 todos).*
*Updated: 2026-04-19 — Phase 65 Plan 01 complete (7 Wave 0 scaffolds + 78 it.todo + shared QueryClient helper + bundle baseline main 135754 B / scanner 58057 B @ b04ae7c).*
*Updated: 2026-04-18 — Phase 64 COMPLETE (10/10 plans; bundle gate PASS; EN+ET catalogs filled; all SCAN-0N requirements shippable)*
