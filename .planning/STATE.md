---
gsd_state_version: 1.0
milestone: v2.2
milestone_name: Scanning & Stabilization
status: in_progress
stopped_at: Phase 64 COMPLETE (plan 64-10 Wave 4 i18n extract + ET gap-fill + [BLOCKING] bundle gate — 36 new ET msgstrs, scanner chunk 58.1 kB gzip isolated, main chunk SHRANK 37.8 kB gzip vs pre-phase baseline; 609/609 green; full phase gate clean)
last_updated: "2026-04-18T21:30:00Z"
last_activity: 2026-04-18 — Phase 64 plan 64-10 executed (1 commit, 36 EN+ET translations, [BLOCKING] bundle gate verified with −37.8 kB gzip main-chunk delta)
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
**Current focus:** v2.2 Scanning & Stabilization — Phase 64 COMPLETE; next phase 65 (Item Lookup & Not-Found Flow)

## Current Position

Phase: 64 COMPLETE (10/10 plans shipped)
Plan: —
Status: Phase 64 done. All seven SCAN-0N requirements have rendered user paths + automated tests + ET translations. [BLOCKING] bundle gate verified.
Last activity: 2026-04-18 — Plan 64-10 executed (1 commit, EN+ET catalogs filled with 36 new translations, i18n:compile clean, bundle gate PASS with −37.8 kB gzip main-chunk delta vs pre-phase baseline, 609/609 tests green)
Next step: begin Phase 65 (Item Lookup & Not-Found Flow — LOOK-01..03)

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

Last session: 2026-04-18T21:30:00Z
Stopped at: Phase 64 COMPLETE — plan 64-10 Wave 4 i18n extract + ET gap-fill + [BLOCKING] bundle gate verified (36 new ET msgstrs; scanner chunk 58.1 kB gzip isolated; main chunk SHRANK 37.8 kB gzip vs pre-phase 13e3bb8 baseline; full phase gate green test/lint:imports/tsc/build/i18n:compile)
Next step: begin Phase 65 (Item Lookup & Not-Found Flow — LOOK-01..03)

---
*Updated: 2026-04-18 — Phase 64 COMPLETE (10/10 plans; bundle gate PASS; EN+ET catalogs filled; all SCAN-0N requirements shippable)*
