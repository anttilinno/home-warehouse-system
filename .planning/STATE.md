---
gsd_state_version: 1.0
milestone: v2.2
milestone_name: Scanning & Stabilization
status: executing
stopped_at: Phase 65 Plans 02 + 03 complete (LOOK-01 frontend guard + LOOK-03 enrichment data layer)
last_updated: "2026-04-19T12:35:00.000Z"
last_activity: 2026-04-19 -- Phase 65 Plan 02 complete (itemsApi.lookupByBarcode + D-23 brand + D-24 barcode regex; 10 Wave 0 todos green)
progress:
  total_phases: 6
  completed_phases: 6
  total_plans: 16
  completed_plans: 16
  percent: 100
---

# Project State: Home Warehouse System

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-18)

**Core value:** Reliable inventory access anywhere -- online or offline -- with seamless sync
**Current focus:** Phase 65 — item-lookup-and-not-found-flow

## Current Position

Phase: 65 (item-lookup-and-not-found-flow) — EXECUTING
Plan: 4 of 8 (Plans 01, 02, 03 complete; Plan 04 unblocked)
Status: Executing Phase 65
Last activity: 2026-04-19 -- Phase 65 Plan 02 complete (LOOK-01 frontend guard layer shipped; itemsApi.lookupByBarcode w/ D-06/D-07/D-08 guards + D-23 brand field + D-24 barcode regex loosening; 10 Wave 0 todos green)
Next step: Plan 65-04 (useScanLookup body swap + updateScanHistory) — now unblocked since Plan 65-02 landed itemsApi.lookupByBarcode

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

Last session: 2026-04-19T12:35:00.000Z
Stopped at: Phase 65 Plan 02 complete (LOOK-01 frontend guard layer; Plans 01 + 02 + 03 all landed)
Next step: Plan 65-04 — useScanLookup body swap + updateScanHistory (Wave 2, now unblocked)

---
*Updated: 2026-04-19 — Phase 65 Plan 02 complete (itemsApi.lookupByBarcode w/ D-06/D-07/D-08 guards + D-23 optional brand field + D-24 barcode regex loosened for hyphens/underscores; 10 Wave 0 todos converted green; cumulative 28/78 todos real; full suite 640 passed / 50 todos).*
*Updated: 2026-04-19 — Phase 65 Plan 03 complete (barcodeApi + barcodeKeys + useBarcodeEnrichment with /^d{8,14}$/ gate + silent-failure; 18 Wave 0 todos converted green; full suite 640 passed / 50 todos).*
*Updated: 2026-04-19 — Phase 65 Plan 01 complete (7 Wave 0 scaffolds + 78 it.todo + shared QueryClient helper + bundle baseline main 135754 B / scanner 58057 B @ b04ae7c).*
*Updated: 2026-04-18 — Phase 64 COMPLETE (10/10 plans; bundle gate PASS; EN+ET catalogs filled; all SCAN-0N requirements shippable)*
